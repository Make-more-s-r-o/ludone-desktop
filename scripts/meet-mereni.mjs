#!/usr/bin/env node
// Měřidlo pro vyřazovací kritérium A6 — zachytí desktop zvuk protistrany z Google Meetu?
//
// PROČ TENHLE SKRIPT EXISTUJE
// Rozhodnutí A6 říká, že Meet v prohlížeči je vyřazovací kritérium: když se z něj
// nedá nahrát druhá strana hovoru, projekt v současné podobě ztrácí smysl. Dosud se
// testoval jen `afplay` — tedy zvuk přehraný lokálně, ne zvuk přišlý po síti.
//
// ČEHO SE BOJÍME
// Meet potlačuje ozvěnu (AEC). Může hlas protistrany ze systémové odbočky odečíst
// a vrátit ticho. To se nepozná jinak než měřením.
//
// PROČ OBÁLKA ENERGIE, A NE VZORKOVÁ KORELACE
// Měření z 20.–21. 8. korelovalo vzorky, protože `Glass.aiff` hrál lokálně a fáze
// se zachovala. Přes Meet jde zvuk zakódovaný Opusem, převzorkovaný a zpožděný —
// vzorková korelace by vyšla nízká i tehdy, když zvuk PROJDE. Proto se porovnává
// obálka energie po 10 ms rámcích: ta překódování přežije a pořád jednoznačně říká,
// jestli je v nahrávce TÁŽ řeč.
//
// CO SE MĚŘÍ
//   1. korelace obálky systémové stopy s referenčním souborem  → má být VYSOKÁ
//   2. korelace obálky mikrofonní stopy s referenčním souborem → má být NÍZKÁ
//   3. hlasitost obou stop
// Rozhoduje ROZDÍL mezi 1 a 2. Kdyby byly obě vysoké, znamená to, že reproduktor
// slyšel do mikrofonu — tedy že měříme přeslech, ne systémovou odbočku.
//
// POUŽITÍ
//   node scripts/meet-mereni.mjs --priprav
//   node scripts/meet-mereni.mjs --system <cesta> --mikrofon <cesta> [--reference <cesta>]
//
// Skript NIC nenahrává. Nahrává aplikace; tenhle skript nahrávku posoudí a rovnou
// zaarchivuje do `dukazy/`, aby se neopakovalo, co se stalo 20. 8.: surová data
// se ztratila a čísla 0,9638 / 0,0098 dnes nikdo nereprodukuje.

import { spawn } from "node:child_process";
import { mkdir, writeFile, copyFile, access, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 16 kHz stačí: řeč má užitečnou energii hluboko pod Nyquistem a menší vzorkovací
// kmitočet zmenší paměť i čas. Rám 10 ms je kompromis mezi rozlišením obálky
// a odolností proti drobnému kolísání zpoždění.
const SAMPLE_RATE = 16_000;
const FRAME_MS = 10;
const FRAME_SAMPLES = (SAMPLE_RATE * FRAME_MS) / 1000;

// Prahy z PLAN.md, kritérium etapy E1. Práh korelace je pro obálku, ne pro vzorky.
const KORELACE_PRAH = 0.8;
const HLASITOST_PRAH_DB = -40;
// Když je korelace mikrofonu takhle blízko systémové, neměříme systémovou odbočku,
// ale přeslech ze sluchátek nebo reproduktoru.
const PRESLECH_ROZDIL_MIN = 0.3;

const REFERENCNI_TEXT = [
  "Tohle je referenční nahrávka pro měření systémového zvuku.",
  "Číslo jedna, číslo dvě, číslo tři, číslo čtyři, číslo pět.",
  "Přeskočila veverka přes shnilý pařez, přes shnilý pařez přeskočila veverka.",
  "Měříme, jestli druhá strana hovoru projde do systémové stopy.",
  "Číslo šest, číslo sedm, číslo osm, číslo devět, číslo deset.",
  "Pokud tuhle větu vidíte v přepisu, zachycení funguje.",
].join(" ");

function vypisNapovedu() {
  console.log(`
Měření A6 — projde zvuk protistrany z Google Meetu do systémové stopy?

  node scripts/meet-mereni.mjs --priprav
      Vyrobí referenční soubor, který se bude přehrávat na DRUHÉM zařízení.

  node scripts/meet-mereni.mjs --system <soubor> --mikrofon <soubor> [--reference <soubor>]
      Posoudí hotovou nahrávku a uloží důkaz do dukazy/.

Volby:
  --reference <soubor>   referenční zvuk (výchozí: dukazy/meet-<datum>/referencni.aiff)
  --nazev <text>         jmenovka běhu, např. "meet-s-mikrofonem" nebo "kontrola-ticho"
  --help                 tahle nápověda
`);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const klic = a.slice(2);
      const dalsi = argv[i + 1];
      if (dalsi === undefined || dalsi.startsWith("--")) {
        out[klic] = true;
      } else {
        out[klic] = dalsi;
        i += 1;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function spustit(prikaz, argumenty, { zachytitStdout = false } = {}) {
  return new Promise((resolve, reject) => {
    const proces = spawn(prikaz, argumenty, {
      stdio: [ "ignore", zachytitStdout ? "pipe" : "ignore", "pipe" ],
    });
    const kusy = [];
    const chyby = [];
    if (zachytitStdout) proces.stdout.on("data", (d) => kusy.push(d));
    proces.stderr.on("data", (d) => chyby.push(d));
    proces.on("error", reject);
    proces.on("close", (kod) => {
      if (kod !== 0) {
        reject(new Error(`${prikaz} skončil kódem ${kod}: ${Buffer.concat(chyby).toString().slice(-600)}`));
        return;
      }
      resolve({ stdout: Buffer.concat(kusy), stderr: Buffer.concat(chyby).toString() });
    });
  });
}

// Dekóduje libovolný vstup na mono float32 při SAMPLE_RATE. Vrací Float32Array.
async function nactiVzorky(soubor) {
  await access(soubor);
  const { stdout } = await spustit("ffmpeg", [
    "-v", "error",
    "-i", soubor,
    "-ac", "1",
    "-ar", String(SAMPLE_RATE),
    "-f", "f32le",
    "-",
  ], { zachytitStdout: true });
  if (stdout.length < 4) throw new Error(`Ze souboru ${soubor} nevyšel žádný zvuk`);
  return new Float32Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.length / 4));
}

// Obálka energie: efektivní hodnota po rámcích, převedená do decibelů.
// Decibely (ne lineární energie) proto, že řeč má obrovský dynamický rozsah
// a v lineární škále by korelaci ovládlo pár nejhlasitějších slabik.
function obalka(vzorky) {
  const pocet = Math.floor(vzorky.length / FRAME_SAMPLES);
  const out = new Float64Array(pocet);
  for (let i = 0; i < pocet; i += 1) {
    let soucet = 0;
    const zacatek = i * FRAME_SAMPLES;
    for (let j = 0; j < FRAME_SAMPLES; j += 1) {
      const v = vzorky[zacatek + j];
      soucet += v * v;
    }
    const rms = Math.sqrt(soucet / FRAME_SAMPLES);
    // -100 dB je podlaha: chrání log před nulou a zároveň drží digitální ticho
    // pohromadě, aby se korelace nechytala na šum kvantizace.
    out[i] = 20 * Math.log10(Math.max(rms, 1e-5));
  }
  return out;
}

function stredniHodnota(pole) {
  let s = 0;
  for (let i = 0; i < pole.length; i += 1) s += pole[i];
  return s / pole.length;
}

// Normalizovaná křížová korelace dvou obálek přes všechna možná posunutí.
// Vrací nejlepší shodu a posunutí, při kterém nastala.
function nejlepsiKorelace(kratsi, delsi) {
  if (kratsi.length === 0 || delsi.length < kratsi.length) {
    return { korelace: 0, posunSekundy: 0, poznamka: "referenční signál je delší než nahrávka" };
  }
  const n = kratsi.length;
  const prumerK = stredniHodnota(kratsi);
  const kOdchylky = new Float64Array(n);
  let kNorma = 0;
  for (let i = 0; i < n; i += 1) {
    kOdchylky[i] = kratsi[i] - prumerK;
    kNorma += kOdchylky[i] * kOdchylky[i];
  }
  kNorma = Math.sqrt(kNorma);
  if (kNorma === 0) return { korelace: 0, posunSekundy: 0, poznamka: "referenční signál je konstantní" };

  const maxPosun = delsi.length - n;
  let nej = -1;
  let nejPosun = 0;
  // Krok 1 rámce = 10 ms. Pro nahrávku v řádu minut je to nejvýš pár desítek tisíc
  // posunutí krát pár tisíc rámců — na dnešním stroji zlomek sekundy.
  for (let posun = 0; posun <= maxPosun; posun += 1) {
    let soucet = 0;
    let dNorma = 0;
    let prumerD = 0;
    for (let i = 0; i < n; i += 1) prumerD += delsi[posun + i];
    prumerD /= n;
    for (let i = 0; i < n; i += 1) {
      const d = delsi[posun + i] - prumerD;
      soucet += kOdchylky[i] * d;
      dNorma += d * d;
    }
    dNorma = Math.sqrt(dNorma);
    if (dNorma === 0) continue;
    const r = soucet / (kNorma * dNorma);
    if (r > nej) {
      nej = r;
      nejPosun = posun;
    }
  }
  return {
    korelace: nej,
    posunSekundy: (nejPosun * FRAME_MS) / 1000,
    poznamka: null,
  };
}

function celkovaHlasitostDb(vzorky) {
  let soucet = 0;
  for (let i = 0; i < vzorky.length; i += 1) soucet += vzorky[i] * vzorky[i];
  const rms = Math.sqrt(soucet / vzorky.length);
  return 20 * Math.log10(Math.max(rms, 1e-7));
}

function razitko() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function priprav(args) {
  const nazev = typeof args.nazev === "string" ? args.nazev : "meet";
  const slozka = path.join(projectRoot, "dukazy", `${nazev}-${razitko().slice(0, 10)}`);
  await mkdir(slozka, { recursive: true });
  const referencni = path.join(slozka, "referencni.aiff");

  await spustit("say", ["-v", "Zuzana", "-r", "180", "-o", referencni, REFERENCNI_TEXT]);
  const info = await stat(referencni);
  const vzorky = await nactiVzorky(referencni);
  const delka = vzorky.length / SAMPLE_RATE;

  await writeFile(path.join(slozka, "referencni-text.txt"), `${REFERENCNI_TEXT}\n`, "utf8");

  console.log(`
Referenční soubor je hotový.

  ${referencni}
  délka ${delka.toFixed(1)} s, ${(info.size / 1024).toFixed(0)} kB

JAK MĚŘIT — postup má tři běhy, ne jeden. Bez kontrolních běhů nelze výsledek obhájit.

  PŘÍPRAVA
   1. Nasaď si SLUCHÁTKA. Bez nich reproduktor slyší do mikrofonu a měření je bezcenné.
   2. Zkopíruj ${path.basename(referencni)} na druhé zařízení.
   3. Založ schůzku v Google Meetu a připoj se z obou zařízení.

  BĚH 1 — ostrý (tohle rozhoduje)
   4. Na Macu spusť aplikaci a začni nahrávat.
   5. Chvíli mlč, pak na DRUHÉM zařízení přehraj referenční soubor.
      Nejlépe přes „Sdílet obrazovku → sdílet i zvuk", ne z reproduktoru do mikrofonu.
   6. Po dohrání ještě chvíli mlč a ukonči nahrávání.

  BĚH 2 — kontrola ticha
   7. Nahraj asi třicet sekund, kdy na druhé straně NIC nehraje.
      Tenhle běh musí vyjít s korelací u nuly. Když ne, měřidlo lže.

  BĚH 3 — kontrola přeslechu
   8. Sundej sluchátka, pusť zvuk z reproduktoru Macu a nahraj znovu.
      Tenhle běh MÁ ukázat vysokou korelaci i na mikrofonu — tím se ověří,
      že měřidlo přeslech vůbec pozná.

  VYHODNOCENÍ (pro každý běh zvlášť)
      node scripts/meet-mereni.mjs \\
        --system <cesta-k-system.webm> \\
        --mikrofon <cesta-k-mikrofon.webm> \\
        --reference ${referencni} \\
        --nazev beh-1-ostry

  Nahrávky aplikace najdeš v:
      ~/Library/Application Support/<app>/nahravky/
`);
}

async function vyhodnot(args) {
  const systemCesta = args.system;
  const mikrofonCesta = args.mikrofon;
  if (typeof systemCesta !== "string" || typeof mikrofonCesta !== "string") {
    throw new Error("Chybí --system nebo --mikrofon. Spusť s --help.");
  }
  const referenceCesta = typeof args.reference === "string" ? args.reference : null;
  if (!referenceCesta) {
    throw new Error("Chybí --reference. Vyrob ho příkazem --priprav.");
  }

  const nazev = typeof args.nazev === "string" ? args.nazev : "meet-mereni";
  const stopa = razitko();
  const slozka = path.join(projectRoot, "dukazy", `${nazev}-${stopa}`);
  await mkdir(slozka, { recursive: true });

  console.log("Načítám zvuk…");
  const [referenceVz, systemVz, mikrofonVz] = await Promise.all([
    nactiVzorky(referenceCesta),
    nactiVzorky(systemCesta),
    nactiVzorky(mikrofonCesta),
  ]);

  const refObalka = obalka(referenceVz);
  const systemObalka = obalka(systemVz);
  const mikrofonObalka = obalka(mikrofonVz);

  console.log("Počítám korelaci obálek…");
  const system = nejlepsiKorelace(refObalka, systemObalka);
  const mikrofon = nejlepsiKorelace(refObalka, mikrofonObalka);

  const systemDb = celkovaHlasitostDb(systemVz);
  const mikrofonDb = celkovaHlasitostDb(mikrofonVz);
  const rozdil = system.korelace - mikrofon.korelace;

  // Archivace SUROVÝCH dat proběhne dřív, než se cokoli vyhodnotí. Poučení
  // z 20. 8.: tehdy se čísla zapsala, ale nahrávky se ztratily, takže je dnes
  // nikdo nereprodukuje.
  console.log("Archivuji surová data…");
  await copyFile(systemCesta, path.join(slozka, `system${path.extname(systemCesta) || ".webm"}`));
  await copyFile(mikrofonCesta, path.join(slozka, `mikrofon${path.extname(mikrofonCesta) || ".webm"}`));
  await copyFile(referenceCesta, path.join(slozka, `referencni${path.extname(referenceCesta) || ".aiff"}`));

  const podminky = [
    {
      klic: "system-korelace",
      popis: `Systémová stopa nese referenční zvuk (korelace obálky > ${KORELACE_PRAH})`,
      namereno: system.korelace,
      prosel: system.korelace > KORELACE_PRAH,
    },
    {
      klic: "system-hlasitost",
      popis: `Systémová stopa je slyšitelná (nad ${HLASITOST_PRAH_DB} dB)`,
      namereno: systemDb,
      prosel: systemDb > HLASITOST_PRAH_DB,
    },
    {
      klic: "neni-preslech",
      popis: `Nejde o přeslech do mikrofonu (rozdíl korelací > ${PRESLECH_ROZDIL_MIN})`,
      namereno: rozdil,
      prosel: rozdil > PRESLECH_ROZDIL_MIN,
    },
  ];

  const vsechnyProsly = podminky.every((p) => p.prosel);

  const zaznam = {
    nazev,
    kdy: new Date().toISOString(),
    vstupy: { system: systemCesta, mikrofon: mikrofonCesta, reference: referenceCesta },
    metoda: {
      popis: "Normalizovaná křížová korelace obálky energie po 10 ms rámcích, v decibelech.",
      duvod: "Přes Meet jde zvuk překódovaný Opusem a zpožděný; vzorková korelace by selhala i při úspěchu.",
      vzorkovaciKmitocet: SAMPLE_RATE,
      ramMs: FRAME_MS,
    },
    delkySekundy: {
      reference: referenceVz.length / SAMPLE_RATE,
      system: systemVz.length / SAMPLE_RATE,
      mikrofon: mikrofonVz.length / SAMPLE_RATE,
    },
    vysledky: {
      systemKorelace: system.korelace,
      systemPosunSekundy: system.posunSekundy,
      mikrofonKorelace: mikrofon.korelace,
      mikrofonPosunSekundy: mikrofon.posunSekundy,
      rozdilKorelaci: rozdil,
      systemHlasitostDb: systemDb,
      mikrofonHlasitostDb: mikrofonDb,
    },
    podminky,
    zaver: vsechnyProsly ? "PASS" : "FAIL",
  };

  await writeFile(path.join(slozka, "vysledek.json"), `${JSON.stringify(zaznam, null, 2)}\n`, "utf8");

  const radky = [];
  radky.push(`# Měření A6 — ${nazev}`);
  radky.push("");
  radky.push(`Kdy: ${zaznam.kdy}`);
  radky.push("");
  radky.push("Metoda: normalizovaná křížová korelace **obálky energie** po 10 ms rámcích.");
  radky.push("Vzorková korelace se nepoužívá — přes Meet jde zvuk překódovaný a zpožděný,");
  radky.push("takže by vyšla nízká i tehdy, když zachycení funguje.");
  radky.push("");
  radky.push("| Co | Naměřeno | Práh | Výsledek |");
  radky.push("|---|---|---|---|");
  for (const p of podminky) {
    radky.push(`| ${p.popis} | ${p.namereno.toFixed(4)} | — | ${p.prosel ? "✅ PASS" : "🔴 FAIL"} |`);
  }
  radky.push("");
  radky.push("## Naměřené hodnoty");
  radky.push("");
  radky.push(`- korelace systémové stopy: **${system.korelace.toFixed(4)}** (posun ${system.posunSekundy.toFixed(2)} s)`);
  radky.push(`- korelace mikrofonní stopy: **${mikrofon.korelace.toFixed(4)}** (posun ${mikrofon.posunSekundy.toFixed(2)} s)`);
  radky.push(`- rozdíl: **${rozdil.toFixed(4)}**`);
  radky.push(`- hlasitost systémové stopy: **${systemDb.toFixed(1)} dB**`);
  radky.push(`- hlasitost mikrofonní stopy: **${mikrofonDb.toFixed(1)} dB**`);
  radky.push("");
  radky.push("## Jak číst výsledek");
  radky.push("");
  radky.push("Rozhoduje ROZDÍL mezi korelací systémové a mikrofonní stopy, ne samotná výše.");
  radky.push("Kdyby byly obě vysoké, znamená to, že reproduktor slyšel do mikrofonu — pak");
  radky.push("se neměří systémová odbočka, ale přeslech, a závěr neplatí.");
  radky.push("");
  radky.push("Surová data jsou v této složce. Výsledek jde přepočítat kdykoli znovu.");
  radky.push("");

  await writeFile(path.join(slozka, "README.md"), `${radky.join("\n")}\n`, "utf8");

  console.log("");
  for (const p of podminky) {
    console.log(`${p.prosel ? "✅ PASS" : "🔴 FAIL"}  ${p.popis}`);
    console.log(`         naměřeno ${p.namereno.toFixed(4)}`);
  }
  console.log("");
  console.log(`systémová stopa  korelace ${system.korelace.toFixed(4)}   hlasitost ${systemDb.toFixed(1)} dB`);
  console.log(`mikrofonní stopa korelace ${mikrofon.korelace.toFixed(4)}   hlasitost ${mikrofonDb.toFixed(1)} dB`);
  console.log(`rozdíl           ${rozdil.toFixed(4)}`);
  console.log("");
  console.log(`ZÁVĚR: ${zaznam.zaver}`);
  console.log(`Důkaz uložen do ${path.relative(projectRoot, slozka)}`);
  console.log("");

  if (!vsechnyProsly) process.exitCode = 1;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  vypisNapovedu();
} else if (args.priprav) {
  await priprav(args);
} else if (args.system || args.mikrofon) {
  await vyhodnot(args);
} else {
  vypisNapovedu();
  process.exitCode = 1;
}
