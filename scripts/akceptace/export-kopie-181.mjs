#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const vitest = resolve(root, "node_modules/vitest/vitest.mjs");

const checks = [
  {
    name: "N1: identita a prostředí panelové exportní fáze",
    files: ["tests/queue-wiring.test.js"],
    pattern: /po logoutu účtu A a loginu účtu B odmítne export staré fáze bez souboru|odmítne fázi vytvořenou v jiném prostředí|před publikací znovu ověří účet fáze bez spoléhání na generační čítač/u.source,
  },
  {
    name: "N2: exportní čtení fronty neblokuje serializované operace",
    files: ["tests/queue-wiring.test.js"],
    pattern: /pozastavené čtení exportu neblokuje list ani bezpečný restart po abortu/u.source,
  },
  {
    name: "N3: výměna dočasného jména za cizí inode nebo alias zdroje",
    files: ["tests/recording-export.test.js"],
    pattern: /před zveřejněním odmítne nahrazené dočasné jméno za cizím souborem|před zveřejněním odmítne nahrazené dočasné jméno za hardlinkem zdroje|před zveřejněním odmítne nahrazené dočasné jméno za symlinkem zdroje/u.source,
  },
  {
    name: "Nálezy kola 4: quit po timeoutu a poslední upravený název",
    files: ["tests/queue-wiring.test.js", "tests/recordings-dashboard.test.js"],
    pattern: /nekončící kopie nezadrží běžný quit ani tři další Cmd\+Q po 15 sekundách|po timeoutu dokončená kopie neobnoví timeout visícího LuTracku|po několika skutečných úpravách exportuje poslední název se snapshot revizemi/u.source,
  },
  {
    name: "Atomický export: hotový soubor, metadata shodné kopie a kolize",
    files: ["tests/recording-export.test.js"],
    pattern: /zveřejní jen hotový soubor přes nový režim 0600 a zdroj nechá beze změny|opakovaný shodný export ponechá inode i metadata cíle beze změny|odmítne odlišný obsah pod existujícím jménem a zachová původní cíl|rozliší zrušení po předání linku a přijme jen úplný finální soubor/u.source,
  },
  {
    name: "Přerušení: bariéry zápisu, publikace, timeout a ukončení",
    files: ["tests/queue-wiring.test.js", "tests/recording-export.test.js"],
    pattern: /zrušení po prvním skutečně zapsaném bloku předá quit a odstraní jen staging|zrušení v bariéře před publikací nevyrobí finální soubor|quit během již předaného linku nečeká a případný cíl je úplný|timeout hlavního exportéru vyřídí skutečný IPC bez pozdního úspěchu|120sekundová lhůta pokrývá i ověření snapshotu před otevřením exportéru|zrušení před publikací se vrátí, i když úklidový hook nikdy nedokončí/u.source,
  },
  {
    name: "Varianta A: žádná automatická kopie a explicitní export zůstává dostupný",
    files: ["tests/queue-wiring.test.js", "tests/recording-card.test.js"],
    pattern: /starší preloadový most s openUploadPage=.*neuloží kopii|starší renderer potvrzuje .* bez tvrzení o Stažených|automatické odeslání přes starší most nevytvoří kopii ani neslibuje Stažené|výslovně exportuje kopii ve Stažených bez rozhodnutí o odeslání/u.source,
  },
];

if (!existsSync(vitest)) {
  process.stderr.write("FAIL: Vitest není dostupný v node_modules/vitest/vitest.mjs.\n");
  process.exit(1);
}

let failed = false;
for (const check of checks) {
  const result = spawnSync(process.execPath, [
    vitest,
    "run",
    ...check.files,
    "--maxWorkers=2",
    "--testNamePattern",
    check.pattern,
  ], { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  const report = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const passed = Number(report.match(/Tests\s+(\d+)\s+passed/u)?.[1] ?? 0);
  const ok = result.status === 0 && passed > 0;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}: ${check.name} — ${passed} testů, exit ${result.status ?? "null"}.\n`);
  if (!ok) {
    failed = true;
    process.stderr.write(report);
  }
}

process.exitCode = failed ? 1 : 0;
