import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test } from "node:test";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GENERATOR = path.join(ROOT, "scripts", "desktop-progress.mjs");
const docasneAdresare = [];

afterEach(async () => {
  await Promise.all(docasneAdresare.splice(0).map((adresar) => rm(adresar, { recursive: true, force: true })));
});

function vychoziStatus() {
  return {
    projekt: {
      nazev: "LuDone Desktop",
      aktualizovano: "2026-09-02",
      problem: "Měsíční paušál a cizí archiv.",
      cil: "Vlastní spouštěč nahrávání a měření času.",
      mimoRozsah: ["Archiv a přepisy v desktopu."],
    },
    zivotniCyklus: {
      aktualni: "stavba",
      kroky: [
        { id: "zamer", nazev: "Záměr", stav: "uzavreno" },
        { id: "stavba", nazev: "Stavba", stav: "aktualni" },
        { id: "overeni", nazev: "Ověření", stav: "ceka" },
      ],
    },
    funkce: [
      {
        id: "DSK-T001",
        nazev: "Funkce doložená jen testy",
        rozsah: "approved",
        dodani: "merged",
        vystaveni: "labs",
        overeni: "tests-green",
        dalsiKrok: "Spustit ji na skutečném Macu.",
      },
      {
        id: "DSK-T002",
        nazev: "Funkce s chybějícím údajem",
        rozsah: "approved",
        dodani: "coded",
        overeni: "unverified",
      },
    ],
    praveSeStavi: [],
    blockery: ["Živé ověření čeká na člověka."],
    nemereno: ["Skutečný běh aplikace."],
  };
}

async function zapisNastroj(adresar, nazev, telo) {
  const cesta = path.join(adresar, nazev);
  await writeFile(cesta, `#!/bin/sh\n${telo}\n`, "utf8");
  await chmod(cesta, 0o755);
}

async function pripravFixture({ status = vychoziStatus(), selzeGit = false, selzeNpm = false, selzeGh = false } = {}) {
  const adresar = await mkdtemp(path.join(tmpdir(), "LuDone progress žluťoučký "));
  docasneAdresare.push(adresar);

  const bin = path.join(adresar, "falešné nástroje");
  const repo = path.join(adresar, "repo s mezerou");
  const statusCesta = path.join(adresar, "status.json");
  const vystup = path.join(adresar, "výstup", "index.html");
  await mkdir(bin, { recursive: true });
  await mkdir(repo, { recursive: true });
  await writeFile(statusCesta, `${JSON.stringify(status, null, 2)}\n`, "utf8");

  await zapisNastroj(
    bin,
    "git",
    selzeGit
      ? "exit 1"
      : "[ \"$#\" -eq 4 ] && [ \"$1\" = '--no-pager' ] && [ \"$2\" = 'log' ] && [ \"$3\" = '-1' ] && [ \"$4\" = '--format=%H%n%cI' ] || exit 2\nprintf '%s\\n%s\\n' '0123456789abcdef0123456789abcdef01234567' '2026-09-02T20:09:43+02:00'",
  );
  await zapisNastroj(
    bin,
    "npm",
    selzeNpm
      ? "printf '%s\\n' 'testy se nespustily' >&2; exit 1"
      : "[ \"$#\" -eq 2 ] && [ \"$1\" = 'run' ] && [ \"$2\" = 'test:unit' ] || exit 2\nprintf '%s\\n' ' Test Files  1 passed (1)' '      Tests  7 passed | 1 skipped (8)'; exit 0",
  );
  await zapisNastroj(
    bin,
    "gh",
    selzeGh
      ? "printf '%s\\n' 'bez spojení' >&2; exit 1"
      : "[ \"$#\" -eq 8 ] && [ \"$1\" = 'pr' ] && [ \"$2\" = 'list' ] && [ \"$3\" = '--state' ] && [ \"$4\" = 'open' ] && [ \"$5\" = '--limit' ] && [ \"$6\" = '100' ] && [ \"$7\" = '--json' ] && [ \"$8\" = 'number,title,url,isDraft' ] || exit 2\nprintf '%s\\n' '[{\"number\":27,\"title\":\"Čekací obrazovka\",\"url\":\"https://example.test/pr/27\",\"isDraft\":false}]'; exit 0",
  );

  const env = {
    ...process.env,
    PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
    NO_COLOR: "1",
  };
  delete env.FORCE_COLOR;

  return { repo, statusCesta, vystup, env };
}

function spustGenerator(fixture) {
  return spawnSync(
    process.execPath,
    [GENERATOR, "--status", fixture.statusCesta, "--output", fixture.vystup, "--repo-root", fixture.repo],
    { cwd: fixture.repo, env: fixture.env, encoding: "utf8", shell: false },
  );
}

function vyzadujUspech(vysledek) {
  assert.equal(
    vysledek.status,
    0,
    `Generátor selhal.\nSTDOUT:\n${vysledek.stdout}\nSTDERR:\n${vysledek.stderr}`,
  );
}

function radekFunkce(html, id) {
  const bezpecneId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const shoda = html.match(new RegExp(`<tr[^>]*data-feature-id="${bezpecneId}"[\\s\\S]*?</tr>`));
  assert.ok(shoda, `V HTML chybí řádek funkce ${id}.`);
  return shoda[0];
}

test("🧪 se nikdy nevykreslí jako ✅ a offline stránka má data uvnitř", async () => {
  const status = vychoziStatus();
  status.projekt.problem = '</p><script id="cizi">selhani()</script>';
  status.funkce.push({
    id: "DSK-T003",
    nazev: "Skutečně živě ověřená funkce",
    rozsah: "approved",
    dodani: "merged",
    vystaveni: "labs",
    overeni: "verified-live",
    dalsiKrok: "Udržet živý scénář zelený.",
  });
  const fixture = await pripravFixture({ status });

  const vysledek = spustGenerator(fixture);
  vyzadujUspech(vysledek);
  const html = await readFile(fixture.vystup, "utf8");
  const radek = radekFunkce(html, "DSK-T001");

  assert.match(radek, /data-verification="tests-green"/);
  assert.match(radek, /🧪\s*zelené testy/i);
  assert.doesNotMatch(radek, /✅/);
  assert.doesNotMatch(html, /<script id="cizi">/);
  assert.doesNotMatch(html, /\bfetch\s*\(/);
  assert.doesNotMatch(html, /<(?:script|link)\b[^>]*(?:src|href)="https?:/i);
  assert.match(html, />3 funkce, čtyři nezávislé osy</);
  assert.match(html, /Podle matice:\s*1 z 3\./);
  assert.doesNotMatch(html, /stoh tří změn/i);
  assert.match(html, /data-live-fact="commit"[\s\S]{0,240}?01234567/);
  assert.match(html, /data-live-fact="test-count"[\s\S]{0,240}?<strong>8<\/strong>/);
  assert.match(html, /data-live-fact="open-prs"[\s\S]{0,240}?<strong>1<\/strong>/);
});

test("chybějící údaj i nezměřitelné živé fakty skončí jako ‚neměřeno‘", async () => {
  const status = vychoziStatus();
  status.projekt.aktualizovano = "2026-02-31";
  status.funkce[1].rozsah = "__proto__";
  status.funkce[1].riziko = "constructor";
  const fixture = await pripravFixture({ status, selzeGit: true, selzeNpm: true, selzeGh: true });

  const vysledek = spustGenerator(fixture);
  vyzadujUspech(vysledek);
  const html = await readFile(fixture.vystup, "utf8");
  const radek = radekFunkce(html, "DSK-T002");

  assert.match(radek, /data-axis="vystaveni"[^>]*>\s*<[^>]+>neměřeno</i);
  assert.match(radek, /data-axis="rozsah"[^>]*>\s*<[^>]+>neměřeno</i);
  assert.match(radek, /Riziko:\s*neměřeno/i);
  assert.match(html, /Stav vývoje · podklady k neměřeno/);
  for (const fakt of ["commit", "test-count", "open-prs"]) {
    assert.match(
      html,
      new RegExp(`data-live-fact="${fakt}"[\\s\\S]{0,240}?neměřeno`, "i"),
      `Živý fakt ${fakt} musí přiznat, že není změřený.`,
    );
  }
});

test("dvojí běh generátoru vyrobí bajtově totožný soubor", async () => {
  const fixture = await pripravFixture();

  const prvni = spustGenerator(fixture);
  vyzadujUspech(prvni);
  const prvniHtml = await readFile(fixture.vystup);

  const druhy = spustGenerator(fixture);
  vyzadujUspech(druhy);
  const druhyHtml = await readFile(fixture.vystup);

  assert.deepEqual(druhyHtml, prvniHtml);
});
