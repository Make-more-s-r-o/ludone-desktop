#!/usr/bin/env node
// Brána proti tichému usínání testů.
//
// 🔴 PROČ EXISTUJE: 3. 9. 2026 porazil obyčejný refaktor detekci `it.runIf(...)` a DVA
// strážní testy se přestaly spouštět — včetně toho, který hlídá, že se neodhlašujeme nad
// běžícím časovačem. Výpis přitom zůstal zelený, jen o dva testy kratší. Všiml jsem si toho
// jen proto, že jsem se náhodou koukal na číslo u „skipped".
//
// Podmíněné přeskakování je legitimní (test nad chybějící službou, drahé volání). Není
// legitimní, aby jejich POČET rostl, aniž o tom někdo rozhodl. Tenhle skript proto drží
// baseline: víc přeskočených než minule = červená, dokud někdo baseline vědomě nezvedne.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KOREN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = path.join(KOREN, "tests", "preskocene-baseline.json");

function spustTesty() {
  // Vitest končí nenulově, když testy padají — nás ale zajímá počet PŘESKOČENÝCH
  // i tehdy. Výstup si proto vezmeme i z výjimky; červené testy shodí `npm run test:unit`
  // před námi, tahle brána je na jinou vadu.
  let surovy;
  try {
    surovy = execFileSync(
      process.execPath,
      ["node_modules/vitest/vitest.mjs", "run", "--reporter=json"],
      { cwd: KOREN, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (chyba) {
    surovy = chyba.stdout;
    if (typeof surovy !== "string" || surovy.length === 0) throw chyba;
  }
  // Reportér umí před JSON vypsat i řádky z testů; bereme poslední úplný objekt.
  const zacatek = surovy.indexOf("{");
  if (zacatek === -1) throw new Error("Vitest nevrátil JSON — bránu nelze vyhodnotit");
  return JSON.parse(surovy.slice(zacatek));
}

function preskocene(vysledek) {
  const podleSouboru = new Map();
  for (const soubor of vysledek.testResults ?? []) {
    const nazev = path.relative(KOREN, soubor.name ?? "");
    const kolik = (soubor.assertionResults ?? [])
      .filter((test) => test.status === "pending" || test.status === "skipped" || test.status === "todo")
      .length;
    if (kolik > 0) podleSouboru.set(nazev, kolik);
  }
  return podleSouboru;
}

const vysledek = spustTesty();
const ted = preskocene(vysledek);
const celkem = [...ted.values()].reduce((soucet, kolik) => soucet + kolik, 0);

if (process.argv.includes("--zapis-baseline")) {
  writeFileSync(BASELINE, `${JSON.stringify({ celkem, podleSouboru: Object.fromEntries([...ted].sort()) }, null, 2)}\n`);
  console.log(`[preskocene] Baseline zapsána: ${celkem} přeskočených.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
if (celkem <= baseline.celkem) {
  console.log(`[preskocene] ${celkem} přeskočených, baseline ${baseline.celkem} — v pořádku.`);
  if (celkem < baseline.celkem) {
    console.log("[preskocene] Přeskočených ubylo. Sniž baseline: npm run preskocene:baseline");
  }
  process.exit(0);
}

console.error(`[preskocene] 🔴 Přeskočených testů přibylo: ${baseline.celkem} → ${celkem}.`);
console.error("[preskocene] Kde:");
for (const [soubor, kolik] of [...ted].sort()) {
  const drive = baseline.podleSouboru?.[soubor] ?? 0;
  if (kolik > drive) console.error(`  ${soubor}: ${drive} → ${kolik}`);
}
console.error(
  "\n[preskocene] Test, který se přestal spouštět, vypadá stejně jako test, který prošel.\n"
  + "Zjisti, PROČ usnul. Když je to v pořádku, zvedni baseline vědomě:\n"
  + "  npm run preskocene:baseline",
);
process.exit(1);
