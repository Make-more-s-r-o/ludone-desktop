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

// Nad touhle korelací obálek se obě stopy pohybují společně — tedy přeslech,
// a měření neplatí bez ohledu na to, jak dobře vyšlo všechno ostatní.
const PRESLECH_KORELACE_MAX = 0.6;

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
    out[i] = 20 * Math.log10(Math.max(Math.sqrt(s / FRAME_SAMPLES), 1e-5));
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

function korelaceObalek(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 10) return 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i += 1) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sab = 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    sab += da * db; sa += da * da; sb += db * db;
  }
  if (sa === 0 || sb === 0) return 0;
  return sab / Math.sqrt(sa * sb);
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

const sysPodlaha = Math.max(percentil(sysObal, 0.1), ABSOLUTNI_PODLAHA_DB);
const micPodlaha = Math.max(percentil(micObal, 0.1), ABSOLUTNI_PODLAHA_DB);
const sysPrah = sysPodlaha + PRAH_NAD_PODLAHOU_DB;
const micPrah = micPodlaha + PRAH_NAD_PODLAHOU_DB;

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
const korelace = korelaceObalek(sysObal, micObal);

// --- verdikt ---------------------------------------------------------------
// Pořadí podmínek není libovolné: přeslech se musí vyloučit DŘÍV, než se cokoli
// prohlásí za úspěch, protože přeslech vypadá jako úspěch ve všech ostatních číslech.
let zaver;
let duvod;
if (korelace > PRESLECH_KORELACE_MAX) {
  zaver = "NEPLATNÉ";
  duvod = "Obě stopy se pohybují společně (korelace obálek " + korelace.toFixed(3) + "). "
    + "Nejspíš jsi neměl sluchátka a reproduktor hrál protistranu do mikrofonu. "
    + "Měření nic nedokazuje — zopakuj se sluchátky.";
} else if (podilProtistrany >= MIN_PODIL_PROTISTRANY) {
  zaver = "FUNGUJE";
  duvod = "Systémová stopa nese řeč po dobu " + fmt(naS(jenProtistrana)) + ", kdy mikrofon mlčí. "
    + "To může být jen protistrana. Zachycení systémového zvuku tedy funguje i v hovoru.";
} else if (jenProtistrana === 0 && obaNaraz === 0) {
  zaver = "NEFUNGUJE";
  duvod = "V systémové stopě není řeč vůbec. Buď ji potlačení ozvěny odečetlo, "
    + "nebo se systémový zvuk nezachytával. Tohle je selhání kritéria A6.";
} else {
  zaver = "NEPRŮKAZNÉ";
  duvod = "Protistrana mluví jen " + (podilProtistrany * 100).toFixed(1) + " % času, "
    + "což je pod prahem " + (MIN_PODIL_PROTISTRANY * 100) + " %. Zopakuj na schůzce, "
    + "kde druhá strana mluví víc.";
}

console.log("Archivuji surová data…");
await mkdir(slozka, { recursive: true });
await copyFile(args.system, path.join(slozka, `system${path.extname(args.system) || ".webm"}`));
await copyFile(args.mikrofon, path.join(slozka, `mikrofon${path.extname(args.mikrofon) || ".webm"}`));

const zaznam = {
  nazev,
  kdy: new Date().toISOString(),
  vstupy: { system: args.system, mikrofon: args.mikrofon },
  metoda: {
    popis: "Detekce řeči v obou stopách zvlášť; hledají se úseky, kdy mikrofon mlčí a systémová stopa má řeč.",
    duvod: "Bez referenčního signálu nelze korelovat. Úsek, kdy mluví jen systémová stopa, může nést pouze protistranu.",
    obranaProtiPreslechu: "Korelace obálek obou stop; nad " + PRESLECH_KORELACE_MAX + " se výsledek prohlásí za neplatný.",
    prahyDb: { system: sysPrah, mikrofon: micPrah, podlahaSystem: sysPodlaha, podlahaMikrofon: micPodlaha },
  },
  delkaSekundy: delkaS,
  rozpad: {
    jenProtistranaSekundy: naS(jenProtistrana),
    jenTySekundy: naS(jenTy),
    obaNarazSekundy: naS(obaNaraz),
    tichoSekundy: naS(ticho),
    podilProtistrany,
  },
  korelaceObalek: korelace,
  zaver,
  duvod,
};

await writeFile(path.join(slozka, "vysledek.json"), `${JSON.stringify(zaznam, null, 2)}\n`, "utf8");

const md = [
  `# Měření A6 ze skutečné schůzky — ${nazev}`,
  "",
  `Kdy: ${zaznam.kdy}`,
  `Délka: ${fmt(delkaS)}`,
  "",
  `## Závěr: **${zaver}**`,
  "",
  duvod,
  "",
  "## Jak se čas rozdělil",
  "",
  "| Kdo mluví | Čas | Podíl |",
  "|---|---|---|",
  `| jen protistrana | ${fmt(naS(jenProtistrana))} | ${(jenProtistrana / n * 100).toFixed(1)} % |`,
  `| jen ty | ${fmt(naS(jenTy))} | ${(jenTy / n * 100).toFixed(1)} % |`,
  `| oba naráz | ${fmt(naS(obaNaraz))} | ${(obaNaraz / n * 100).toFixed(1)} % |`,
  `| ticho | ${fmt(naS(ticho))} | ${(ticho / n * 100).toFixed(1)} % |`,
  "",
  `Korelace obálek: **${korelace.toFixed(3)}** (nad ${PRESLECH_KORELACE_MAX} = přeslech, měření neplatí)`,
  "",
  "## Jak to funguje",
  "",
  "Nemáme referenční signál, se kterým by se dalo korelovat. Místo toho se hledají úseky,",
  "kdy **mikrofon mlčí a systémová stopa má řeč** — v takové chvíli může mluvit jedině",
  "protistrana, takže zachycení funguje.",
  "",
  "Práh řeči se počítá z nahrávky samotné (podlaha + 12 dB), ne pevně — každá místnost",
  "a každý mikrofon má jinou podlahu. Úseky kratší než třetina sekundy se zahazují,",
  "aby se nechytaly lupance a dech.",
  "",
  "Proti tomu, aby se za úspěch vydal přeslech ze sluchátek či reproduktoru, stojí korelace",
  "obálek: když se obě stopy pohybují společně, výsledek se prohlásí za neplatný.",
  "",
  "Surová data jsou v této složce, výsledek jde přepočítat kdykoli znovu.",
  "",
];
await writeFile(path.join(slozka, "README.md"), `${md.join("\n")}\n`, "utf8");

console.log("");
console.log(`délka schůzky        ${fmt(delkaS)}`);
console.log(`jen protistrana      ${fmt(naS(jenProtistrana))}  (${(jenProtistrana / n * 100).toFixed(1)} %)`);
console.log(`jen ty               ${fmt(naS(jenTy))}  (${(jenTy / n * 100).toFixed(1)} %)`);
console.log(`oba naráz            ${fmt(naS(obaNaraz))}  (${(obaNaraz / n * 100).toFixed(1)} %)`);
console.log(`ticho                ${fmt(naS(ticho))}  (${(ticho / n * 100).toFixed(1)} %)`);
console.log(`korelace obálek      ${korelace.toFixed(3)}`);
console.log("");
console.log(`ZÁVĚR: ${zaver}`);
console.log(duvod);
console.log("");
console.log(`Důkaz uložen do ${path.relative(projectRoot, slozka)}`);
console.log("");

if (zaver === "NEFUNGUJE" || zaver === "NEPLATNÉ") process.exitCode = 1;
