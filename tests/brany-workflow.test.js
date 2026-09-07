import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const manifest = require("../package.json");

// 🔴 PROČ TENHLE TEST EXISTUJE: `.github/workflows/release-macos.yml` si brány vypisoval
// sám (lint → typecheck → test:unit) místo toho, aby zavolal `npm run gates`. Když do
// `gates` přibyla čtvrtá brána `preskocene`, vydání o ní nevědělo a jelo o jednu kontrolu
// chudší než obyčejný push. Dva výčty téhož se vždycky rozejdou — a rozejdou se TIŠE,
// protože obě cesty zůstanou zelené. Test proto hlídá, že výčet je v repozitáři JEN JEDEN
// (v `package.json`) a že ho obě cesty volají celý.

const WORKFLOWY = [".github/workflows/ci.yml", ".github/workflows/release-macos.yml"];

function prikazyWorkflow(cesta) {
  const zdroj = readFileSync(new URL(`../${cesta}`, import.meta.url), "utf8");
  // Bereme jen jednořádkové `run:` kroky; víceřádkové bloky (`run: |`) brány nespouštějí.
  return [...zdroj.matchAll(/^\s*(?:- )?run:[ \t]+(?!\|)(.+)$/gm)].map(([, prikaz]) => prikaz.trim());
}

function clenoveBrany() {
  return [...manifest.scripts.gates.matchAll(/npm run ([\w:-]+)/g)].map(([, nazev]) => nazev);
}

describe("brány v CI a ve vydání", () => {
  it("`npm run gates` skládá všechny čtyři brány", () => {
    expect(clenoveBrany()).toEqual(["lint", "typecheck", "test:unit", "preskocene"]);
  });

  it.each(WORKFLOWY)("%s volá celou bránu `npm run gates`", (cesta) => {
    expect(prikazyWorkflow(cesta)).toContain("npm run gates");
  });

  it.each(WORKFLOWY)("%s si brány nevypisuje po svém", (cesta) => {
    const prikazy = prikazyWorkflow(cesta);
    const vlastniVycet = clenoveBrany().filter((brana) => prikazy.includes(`npm run ${brana}`));
    expect(vlastniVycet).toEqual([]);
  });
});
