#!/usr/bin/env node
// Měřidlo A6 nad SKUTEČNOU schůzkou — bez referenčního signálu.
//
// PROČ EXISTUJE VEDLE `meet-mereni.mjs`
// To druhé měřidlo potřebuje referenční soubor, který se přehraje na druhém zařízení,
// a korelovat s ním. Je přesnější, ale vyžaduje připravený pokus. Tohle měřidlo nepotřebuje
// nic než dvě stopy z běžné schůzky — a proto ho lze pustit na cokoli, co už bylo nahráno.
//
// MYŠLENKA
// Nemáme s čím korelovat, ale máme dvě stopy z téhož času. Hledáme okamžiky, kdy
// MIKROFON MLČÍ a SYSTÉMOVÁ STOPA MÁ ŘEČ. V takové chvíli mluví protistrana a nikdo jiný —
// tedy zachycení funguje. Když systémová stopa mlčí celou dobu, potlačení ozvěny ji odečetlo
// (nebo se vůbec nezachytávala) a rozhodnutí A6 padá.
//
// PROTI ČEMU SE MĚŘIDLO BRÁNÍ
// Kdyby uživatel neměl sluchátka, reproduktor by hrál protistranu do mikrofonu a OBĚ stopy
// by nesly totéž. Vypadalo by to jako úspěch. Proto se počítá i korelace obálek: když je
// vysoká, měření NEPLATÍ a skript to řekne — nevydá to za úspěch.
//
// POUŽITÍ
//   node scripts/schuzka-mereni.mjs --system <cesta> --mikrofon <cesta> [--nazev <text>]

import { spawn } from "node:child_process";
import { mkdir, writeFile, copyFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SAMPLE_RATE = 16_000;
const FRAME_MS = 10;
const FRAME_SAMPLES = (SAMPLE_RATE * FRAME_MS) / 1000;

// Řeč se od šumu nepozná pevným prahem — každá místnost a každý mikrofon má jinou
// podlahu. Práh se proto počítá z nahrávky samotné: podlaha je 10. percentil rámců,
// řeč začíná o PRAH_NAD_PODLAHOU_DB výš. Absolutní pojistka drží měření při zemi
// u nahrávek, které jsou ticho celé.
const PRAH_NAD_PODLAHOU_DB = 12;
const ABSOLUTNI_PODLAHA_DB = -55;

// Kratší úsek než třetina sekundy není promluva, ale lupnutí, dech nebo klik myší.
const MIN_PROMLUVA_RAMCU = 30;

// Kolik procent času musí protistrana mluvit, aby se dalo mluvit o důkazu.
// Při schůzce, kde druhá strana nemluví skoro vůbec, měření nic nedokazuje.
const MIN_PODIL_PROTISTRANY = 0.05;

// Kolik decibelů nad vlastní podlahou smí být mikrofon ve chvíli, kdy mluví protistrana.
// Při čistém oddělení je mikrofon u své podlahy. Když je znatelně výš, prosakuje do něj
// reproduktor — a měření pak nic nedokazuje.
//
// 🔴 GLOBÁLNÍ KORELACE OBÁLEK SE NEPOUŽÍVÁ. Vypadá jako rozumná obrana proti přeslechu,
// ale na skutečné schůzce je slepá: při střídání replik jsou obálky PROTIkorelované
// a globální průměr přeslech vyruší. Změřeno — přeslech utlumený o 12 dB dal korelaci
// −0,155, tedy hluboko pod jakýmkoli prahem, a prošel by jako úspěch. Práh 0,6 z první
// verze byl na hovoru nedosažitelný a ověřovací případ ho splnil jen proto, že v mikrofonní
// stopě nikdo nemluvil — stav, který na schůzce nenastane.
const PROSAK_MAX_DB = 6;

// Řeč není energie. Hudba, sdílené video nebo trvalý tón mají energii taky. Řeč se od nich
// pozná tím, že její hlasitost KOLÍSÁ v rytmu slabik, tedy zhruba 2–8× za sekundu.
//
// 🔴 HRANICE TÉHLE KONTROLY, ať ji nikdo nepřeceňuje: chytá TRVALÉ zvuky (tón, šum, hukot),
// ale NECHYTÁ opakované krátké zvuky. Změřeno: řada systémových gongů po 2,5 s dala index
// 0,875, tedy vysoko nad prahem — protože rychlý doznívající náběh gongu leží v témže pásmu
// jako slabiky. Z obálky se to rozlišit nedá a nepředstírej, že ano.
//
// Proto skript na konci VŽDYCKY vyřízne ukázku systémové stopy k poslechu. Lidské ucho
// rozliší řeč od zvonění okamžitě a je to jediná spolehlivá kontrola, kterou máme.
const MIN_MODULACE = 0.18;

// Podíl sám nestačí: na pětisekundové nahrávce je 0,5 s zvuku „9,9 %“. Potřeba i absolutní
// minimum a několik oddělených replik, aby to nebyl jeden osamocený zvuk.
const MIN_PROTISTRANA_SEKUND = 20;
const MIN_REPLIK = 4;

// Když se délky stop liší o víc, nejsou z téže nahrávky a měření nedává smysl.
const MAX_ROZDIL_DELKY = 0.03;

function spustit(prikaz, argumenty) {
  return new Promise((resolve, reject) => {
    const p = spawn(prikaz, argumenty, { stdio: ["ignore", "pipe", "pipe"] });
    const out = [];
    const err = [];
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => err.push(d));
    p.on("error", reject);
    p.on("close", (kod) => {
      if (kod !== 0) {
        reject(new Error(`${prikaz} skončil kódem ${kod}: ${Buffer.concat(err).toString().slice(-500)}`));
        return;
      }
      resolve(Buffer.concat(out));
    });
  });
}

async function nactiVzorky(soubor) {
  await access(soubor);
  const buf = await spustit("ffmpeg", [
    "-v", "error", "-i", soubor, "-ac", "1", "-ar", String(SAMPLE_RATE), "-f", "f32le", "-",
  ]);
  if (buf.length < 4) throw new Error(`Ze souboru ${soubor} nevyšel žádný zvuk`);
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
}

function obalka(vzorky) {
  const pocet = Math.floor(vzorky.length / FRAME_SAMPLES);
  const out = new Float64Array(pocet);
  for (let i = 0; i < pocet; i += 1) {
    let s = 0;
    const z = i * FRAME_SAMPLES;
    for (let j = 0; j < FRAME_SAMPLES; j += 1) {
      const v = vzorky[z + j];
      s += v * v;
    }
    out[i] = 20 * Math.log10(Math.max(Math.sqrt(s / FRAME_SAMPLES), 1e-7));
  }
  return out;
}

function percentil(pole, p) {
  const kopie = Array.from(pole).sort((a, b) => a - b);
  return kopie[Math.min(kopie.length - 1, Math.max(0, Math.floor(kopie.length * p)))];
}

// Vrátí pole boolean: mluví se / nemluví, po rámcích. Krátké ostrůvky se zahazují.
function detekujRec(obal, prah) {
  const syrove = new Uint8Array(obal.length);
  for (let i = 0; i < obal.length; i += 1) syrove[i] = obal[i] > prah ? 1 : 0;

  // Uvnitř slov jsou závěry 20-80 ms. Bez přemostění detektor rozseká jednu promluvu
  // na kusy pod minimální délkou a zahodí ji celou — změřeno 88,6 % místo 99,8 %.
  const MEZERA_RAMCU = 20;
  let g = 0;
  while (g < syrove.length) {
    if (syrove[g]) { g += 1; continue; }
    let h = g;
    while (h < syrove.length && !syrove[h]) h += 1;
    if (h - g <= MEZERA_RAMCU && g > 0 && h < syrove.length) syrove.fill(1, g, h);
    g = h;
  }

  const cisty = new Uint8Array(obal.length);
  let i = 0;
  while (i < syrove.length) {
    if (!syrove[i]) { i += 1; continue; }
    let j = i;
    while (j < syrove.length && syrove[j]) j += 1;
    if (j - i >= MIN_PROMLUVA_RAMCU) cisty.fill(1, i, j);
    i = j;
  }
  return cisty;
}


// Kolísá hlasitost v rytmu slabik? Řeč ano (2–8× za sekundu), tón po náběhu ne.
// Počítá se jen přes rámce, kde detektor slyší zvuk — jinak by ticho index rozředilo.
function modulacniIndex(obal, maska) {
  const vzorky = [];
  for (let i = 0; i < obal.length; i += 1) if (!maska || maska[i]) vzorky.push(obal[i]);
  if (vzorky.length < 100) return 0;
  const prumer = vzorky.reduce((a, b) => a + b, 0) / vzorky.length;
  const stred = vzorky.map((v) => v - prumer);
  const fs = 1000 / FRAME_MS;

  // Diskrétní Fourier jen pro pásma, která nás zajímají — celý spektrální rozklad
  // by tu byl zbytečně drahý.
  const vykon = (odHz, doHz) => {
    let soucet = 0;
    const krok = 0.25;
    for (let f = odHz; f <= doHz; f += krok) {
      let re = 0;
      let im = 0;
      for (let i = 0; i < stred.length; i += 1) {
        const uhel = (2 * Math.PI * f * i) / fs;
        re += stred[i] * Math.cos(uhel);
        im += stred[i] * Math.sin(uhel);
      }
      soucet += (re * re + im * im);
    }
    return soucet;
  };

  const rec = vykon(2, 8);
  const vse = vykon(0.5, 20);
  return vse > 0 ? rec / vse : 0;
}

function fmt(sekundy) {
  const m = Math.floor(sekundy / 60);
  const s = Math.floor(sekundy % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const k = argv[i].slice(2);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) { out[k] = true; } else { out[k] = v; i += 1; }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (args.help || (!args.system && !args.mikrofon)) {
  console.log(`
Měření A6 nad skutečnou schůzkou — bez referenčního signálu.

  node scripts/schuzka-mereni.mjs --system <soubor> --mikrofon <soubor> [--nazev <text>]

Vezme dvě stopy z jedné nahrané schůzky a zjistí, jestli systémová stopa nese hlas
protistrany. Nepotřebuje připravený pokus ani druhé zařízení — stačí nahrát běžnou schůzku.

Nahrávky aplikace najdeš v ~/Library/Application Support/<app>/nahravky/
`);
  process.exit(args.help ? 0 : 1);
}

if (typeof args.system !== "string" || typeof args.mikrofon !== "string") {
  console.error("Chybí --system nebo --mikrofon.");
  process.exit(1);
}

const nazev = typeof args.nazev === "string" ? args.nazev : "schuzka";
const stopa = new Date().toISOString().replace(/[:.]/g, "-");
const slozka = path.join(projectRoot, "dukazy", `${nazev}-${stopa}`);

console.log("Načítám zvuk…");
const [sysVz, micVz] = await Promise.all([nactiVzorky(args.system), nactiVzorky(args.mikrofon)]);

const sysObal = obalka(sysVz);
const micObal = obalka(micVz);
const delkaS = Math.min(sysObal.length, micObal.length) * (FRAME_MS / 1000);

const sysPodlaha = percentil(sysObal, 0.1);
const micPodlaha = percentil(micObal, 0.1);
const sysPrah = Math.max(sysPodlaha, ABSOLUTNI_PODLAHA_DB) + PRAH_NAD_PODLAHOU_DB;
const micPrah = Math.max(micPodlaha, ABSOLUTNI_PODLAHA_DB) + PRAH_NAD_PODLAHOU_DB;

const sysRec = detekujRec(sysObal, sysPrah);
const micRec = detekujRec(micObal, micPrah);

const n = Math.min(sysRec.length, micRec.length);
let jenProtistrana = 0;
let jenTy = 0;
let obaNaraz = 0;
let ticho = 0;
for (let i = 0; i < n; i += 1) {
  if (sysRec[i] && !micRec[i]) jenProtistrana += 1;
  else if (!sysRec[i] && micRec[i]) jenTy += 1;
  else if (sysRec[i] && micRec[i]) obaNaraz += 1;
  else ticho += 1;
}
const naS = (r) => (r * FRAME_MS) / 1000;
const podilProtistrany = jenProtistrana / n;

// Kolik oddělených replik protistrana pronesla. Jeden souvislý zvuk není hovor.
let replikProtistrany = 0;
for (let i = 0; i < n; i += 1) {
  if (sysRec[i] && !micRec[i] && !(i > 0 && sysRec[i - 1] && !micRec[i - 1])) replikProtistrany += 1;
}

// Prosakování: jak vysoko nad SVOU podlahou je mikrofon, když mluví protistrana.
let prosakSoucet = 0;
let prosakPocet = 0;
for (let i = 0; i < n; i += 1) {
  if (sysRec[i] && !micRec[i]) { prosakSoucet += micObal[i]; prosakPocet += 1; }
}
const prosakDb = prosakPocet > 0 ? (prosakSoucet / prosakPocet) - micPodlaha : 0;

const modulaceSys = modulacniIndex(sysObal, sysRec);
const rozdilDelky = Math.abs(sysObal.length - micObal.length) / Math.max(sysObal.length, micObal.length, 1);

// --- verdikt ---------------------------------------------------------------
// Pořadí není libovolné. Každá podmínka vylučuje způsob, jak by měřidlo mohlo lhát,
// a musí se vyloučit DŘÍV, než se cokoli prohlásí za úspěch — protože každý z těch
// stavů vypadá v ostatních číslech jako úspěch.
let zaver;
let duvod;

if (rozdilDelky > MAX_ROZDIL_DELKY) {
  zaver = "NEPLATNÉ";
  duvod = "Stopy se liší v délce o " + (rozdilDelky * 100).toFixed(1) + " %, takže nejsou "
    + "z téže nahrávky. Zkontroluj, že obě patří k jedné schůzce.";
} else if (naS(jenTy) + naS(obaNaraz) < 5) {
  zaver = "NEPLATNÉ";
  duvod = "V mikrofonní stopě není řeč (" + fmt(naS(jenTy) + naS(obaNaraz)) + "). Buď byl "
    + "mikrofon ztlumený, nebo se nahrával jiný vstup. Bez živého mikrofonu prohlásí měřidlo "
    + "za protistranu jakýkoli zvuk — takový výsledek nic nedokazuje.";
} else if (prosakPocet > 0 && prosakDb > PROSAK_MAX_DB) {
  zaver = "NEPLATNÉ";
  duvod = "Když mluví protistrana, je mikrofon " + prosakDb.toFixed(1) + " dB nad svou podlahou "
    + "(limit " + PROSAK_MAX_DB + " dB). Prosakuje do něj reproduktor — nejspíš jsi neměl "
    + "sluchátka. Zopakuj se sluchátky.";
} else if (jenProtistrana === 0 && obaNaraz === 0) {
  zaver = "NEFUNGUJE";
  duvod = "V systémové stopě není žádný zvuk, zatímco v mikrofonní ano. Buď hlas protistrany "
    + "odečetlo potlačení ozvěny, nebo se systémový zvuk vůbec nezachytával. To je selhání "
    + "kritéria A6.";
} else if (modulaceSys < MIN_MODULACE) {
  zaver = "NEFUNGUJE";
  duvod = "Systémová stopa sice má zvuk, ale nekolísá v rytmu řeči (index " + modulaceSys.toFixed(3)
    + ", potřeba nad " + MIN_MODULACE + "). Je to nejspíš tón, zvonění při připojení nebo hudba, "
    + "ne hlas. Hlas protistrany se tedy nezachytil.";
} else if (naS(jenProtistrana) < MIN_PROTISTRANA_SEKUND || replikProtistrany < MIN_REPLIK
           || podilProtistrany < MIN_PODIL_PROTISTRANY) {
  zaver = "NEPRŮKAZNÉ";
  duvod = "Protistrana mluví jen " + fmt(naS(jenProtistrana)) + " ve " + replikProtistrany
    + " replikách (" + (podilProtistrany * 100).toFixed(1) + " % času). Potřeba aspoň "
    + MIN_PROTISTRANA_SEKUND + " s ve " + MIN_REPLIK + " replikách. Zopakuj na schůzce, "
    + "kde druhá strana mluví víc — z tohohle se nedá nic uzavřít.";
} else {
  zaver = "FUNGUJE";
  duvod = "Systémová stopa nese řeč " + fmt(naS(jenProtistrana)) + " ve " + replikProtistrany
    + " replikách, kdy mikrofon mlčí, kolísá v rytmu řeči (index " + modulaceSys.toFixed(3)
    + ") a mikrofon je přitom u své podlahy (+" + prosakDb.toFixed(1) + " dB). "
    + "Zachycení systémového zvuku v hovoru tedy funguje.";
}

console.log("Archivuji surová data…");
await mkdir(slozka, { recursive: true });
await copyFile(args.system, path.join(slozka, `system${path.extname(args.system) || ".webm"}`));
await copyFile(args.mikrofon, path.join(slozka, `mikrofon${path.extname(args.mikrofon) || ".webm"}`));

// Do `dukazy/` se commituje (viz .gitignore) a Dan zvažuje repozitář zveřejnit.
// Absolutní cesty nesou domovský adresář uživatele, takže se zapisuje jen jméno
// souboru — k doložení měření stačí, k identifikaci stroje ne.
const bezCesty = (p) => path.basename(String(p ?? ""));

const zaznam = {
  nazev,
  kdy: new Date().toISOString(),
  vstupy: { system: bezCesty(args.system), mikrofon: bezCesty(args.mikrofon) },
  metoda: {
    popis: "Detekce řeči v obou stopách zvlášť; hledají se úseky, kdy mikrofon mlčí a systémová stopa má řeč.",
    duvod: "Bez referenčního signálu nelze korelovat. Úsek, kdy mluví jen systémová stopa, může nést pouze protistranu.",
    obranyProtiLzi: [
      "délka obou stop se musí shodovat (jinak nejsou z téže nahrávky)",
      "mikrofonní stopa musí nést řeč (jinak projde jako protistrana cokoli)",
      "mikrofon musí být u své podlahy, když mluví protistrana (jinak prosakuje reproduktor)",
      "systémová stopa musí kolísat v rytmu řeči (jinak je to tón nebo zvonění, ne hlas)",
      "protistrana musí mluvit aspoň " + MIN_PROTISTRANA_SEKUND + " s ve " + MIN_REPLIK + " replikách",
    ],
  },
  delkaSekundy: delkaS,
  rozpad: {
    jenProtistranaSekundy: naS(jenProtistrana),
    jenTySekundy: naS(jenTy),
    obaNarazSekundy: naS(obaNaraz),
    tichoSekundy: naS(ticho),
    podilProtistrany,
    replikProtistrany,
  },
  kontroly: {
    modulacniIndexSystemu: modulaceSys,
    prosakDoMikrofonuDb: prosakDb,
    rozdilDelekStop: rozdilDelky,
    podlahaSystemDb: sysPodlaha,
    podlahaMikrofonDb: micPodlaha,
    prahSystemDb: sysPrah,
    prahMikrofonDb: micPrah,
  },
  zaver,
  duvod,
};

await writeFile(path.join(slozka, "vysledek.json"), `${JSON.stringify(zaznam, null, 2)}\n`, "utf8");

const md = [
  `# Měření A6 ze skutečné schůzky — ${nazev}`, "",
  `Kdy: ${zaznam.kdy}`, `Délka: ${fmt(delkaS)}`, "",
  `## Závěr: **${zaver}**`, "", duvod, "",
  "## Jak se čas rozdělil", "",
  "| Kdo mluví | Čas | Podíl |", "|---|---|---|",
  `| jen protistrana | ${fmt(naS(jenProtistrana))} | ${(jenProtistrana / n * 100).toFixed(1)} % |`,
  `| jen ty | ${fmt(naS(jenTy))} | ${(jenTy / n * 100).toFixed(1)} % |`,
  `| oba naráz | ${fmt(naS(obaNaraz))} | ${(obaNaraz / n * 100).toFixed(1)} % |`,
  `| ticho | ${fmt(naS(ticho))} | ${(ticho / n * 100).toFixed(1)} % |`, "",
  "## Kontroly proti falešnému úspěchu", "",
  "| Co | Naměřeno | Musí být |", "|---|---|---|",
  `| řeč v mikrofonu | ${fmt(naS(jenTy) + naS(obaNaraz))} | přes 0:05 |`,
  `| prosak do mikrofonu | ${prosakDb.toFixed(1)} dB | pod ${PROSAK_MAX_DB} dB |`,
  `| kolísání v rytmu řeči | ${modulaceSys.toFixed(3)} | nad ${MIN_MODULACE} |`,
  `| replik protistrany | ${replikProtistrany} | aspoň ${MIN_REPLIK} |`,
  `| rozdíl délek stop | ${(rozdilDelky * 100).toFixed(2)} % | pod ${MAX_ROZDIL_DELKY * 100} % |`, "",
  "## Proč tolik kontrol", "",
  "První verze tohohle měřidla prohlásila za úspěch nahrávku tří gongů — a v odůvodnění",
  "sama napsala „nese řeč po dobu 0:00\". Každá kontrola výš vylučuje jeden způsob,",
  "kterým měřidlo dokázalo lhát:",
  "",
  "- **mrtvý mikrofon** byl nejsebejistější možné „funguje\" — bez řeči v mikrofonní stopě",
  "  projde jako protistrana jakýkoli zvuk;",
  "- **energie není řeč** — gong, oznámení systému i hudba mají energii;",
  "- **globální korelace obálek je na hovoru slepá** — při střídání replik jsou obálky",
  "  protikorelované a přeslech se v průměru vyruší; proto se místo ní měří, jak vysoko",
  "  je mikrofon nad svou podlahou ve chvílích, kdy mluví protistrana.",
  "",
  "Surová data jsou v této složce, výsledek jde přepočítat kdykoli znovu.", "",
];
await writeFile(path.join(slozka, "README.md"), `${md.join("\n")}\n`, "utf8");

console.log("");
console.log(`délka                ${fmt(delkaS)}`);
console.log(`jen protistrana      ${fmt(naS(jenProtistrana))}  (${(jenProtistrana / n * 100).toFixed(1)} %, ${replikProtistrany} replik)`);
console.log(`jen ty               ${fmt(naS(jenTy))}  (${(jenTy / n * 100).toFixed(1)} %)`);
console.log(`oba naráz            ${fmt(naS(obaNaraz))}  (${(obaNaraz / n * 100).toFixed(1)} %)`);
console.log("");
console.log(`kolísání v rytmu řeči ${modulaceSys.toFixed(3)}  (musí nad ${MIN_MODULACE})`);
console.log(`prosak do mikrofonu   ${prosakDb.toFixed(1)} dB  (musí pod ${PROSAK_MAX_DB})`);
console.log(`rozdíl délek stop     ${(rozdilDelky * 100).toFixed(2)} %`);
console.log("");
console.log(`ZÁVĚR: ${zaver}`);
console.log(duvod);
console.log("");
// Žádná z automatických kontrol nerozliší řeč od opakovaného zvonění (viz MIN_MODULACE).
// Ukázka k poslechu je proto povinná součást důkazu, ne bonus.
const ukazka = path.join(slozka, "ukazka-systemove-stopy.m4a");
try {
  const zacatek = Math.max(0, Math.min(delkaS - 30, delkaS * 0.3));
  await spustit("ffmpeg", ["-v", "error", "-y", "-ss", String(Math.floor(zacatek)),
    "-i", args.system, "-t", "30", "-ac", "1", "-c:a", "aac", "-b:a", "64k", ukazka]);
  console.log(`Ukázka k poslechu: ${path.relative(projectRoot, ukazka)}`);
  console.log("🔴 POSLECHNI SI JI. Ani jedna z kontrol výš nerozliší řeč od opakovaného");
  console.log("   zvonění nebo hudby — tvoje ucho ano, a trvá to půl minuty.");
} catch {
  console.log("(ukázku k poslechu se nepodařilo vyříznout)");
}
console.log("");
console.log(`Důkaz uložen do ${path.relative(projectRoot, slozka)}`);
console.log("");

// Jediný stav, který smí být zelený, je FUNGUJE. NEPRŮKAZNÉ dřív končilo nulou,
// takže pro jakoukoli bránu nebo obal vypadalo jako úspěch — a je to přitom
// nejpravděpodobnější výsledek.
if (zaver !== "FUNGUJE") process.exitCode = 1;
