import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 🔴 Brána proti tichému návratu zrušené funkce.
//
// Kalendář („Co mě dnes čeká") Dan 1. 9. 2026 na design approval gate ZRUŠIL.
// Kód po tom rozhodnutí zůstal v aplikaci ještě den a nikdo si toho nevšiml, dokud
// aplikaci někdo nespustil — testy byly celou dobu zelené, protože odstranění funkce
// nemá přirozené měřidlo.
//
// Změřeno při odstraňování: vrácení `TodayAgenda.jsx` i s importem v `App.jsx` prošlo
// `328 passed` a `lint EXIT=0`. Nic by se neozvalo.
//
// 🔴 Tenhle test se NEPTÁ MĚ, ale SCHVÁLENÉHO DESIGNU. Kdyby Dan kalendář někdy vrátil,
// nestačí smazat tenhle soubor — musí se změnit `design/approved.json`, a test se pak
// odmlčí sám. Tím drží pravdu na jednom místě, ne na dvou.

const KOREN = fileURLToPath(new URL("..", import.meta.url));

function bezKomentaru(text) {
  // Jen celořádkové komentáře — kdo maže každé `//`, rozřízne i URL uvnitř řetězce.
  return text
    .split("\n")
    .map((radek) => (radek.trim().startsWith("//") ? "" : radek))
    .join("\n");
}

function zdrojeRendereru() {
  const koren = path.join(KOREN, "src");
  const nalezene = [];
  const projdi = (adresar) => {
    for (const polozka of readdirSync(adresar, { withFileTypes: true })) {
      const cesta = path.join(adresar, polozka.name);
      if (polozka.isDirectory()) projdi(cesta);
      else if (/\.(jsx?|tsx?)$/.test(polozka.name)) {
        nalezene.push([path.relative(KOREN, cesta), bezKomentaru(readFileSync(cesta, "utf8"))]);
      }
    }
  };
  projdi(koren);
  return nalezene;
}

const design = JSON.parse(readFileSync(path.join(KOREN, "design", "approved.json"), "utf8"));
const kalendarZrusen = (design.explicitlyCut || []).some((polozka) => /kalendář/i.test(polozka));

describe("kalendář zůstává zrušený, dokud to říká schválený design", () => {
  it("schválený design ho pořád vede jako zrušený", () => {
    // Pojistka proti tomu, aby se obě větve minuly: kdyby `explicitlyCut` zmizelo nebo
    // změnilo tvar, tohle spadne dřív, než se cokoli začne tvrdit o kódu.
    expect(Array.isArray(design.explicitlyCut), "design/approved.json nemá explicitlyCut").toBe(true);
    expect(typeof kalendarZrusen).toBe("boolean");
  });

  it.runIf(kalendarZrusen)("v rendereru po něm nezbyla ani stopa", () => {
    const provinilci = zdrojeRendereru()
      .filter(([, obsah]) => /TodayAgenda|features\/calendar|dnes čeká/i.test(obsah))
      .map(([cesta]) => cesta);

    expect(
      provinilci,
      "kalendář je podle design/approved.json zrušený, ale v kódu zase je",
    ).toEqual([]);
  });

  it.runIf(kalendarZrusen)("nezbyl ani přepínač prázdného kalendáře v mostu", () => {
    // `LUDONE_EMPTY_CALENDAR` existoval jen kvůli prázdnému stavu kalendáře. Kdyby se
    // vrátil, znamená to, že se vrací i funkce — jen jinými dveřmi.
    const preload = bezKomentaru(readFileSync(path.join(KOREN, "electron", "preload.cjs"), "utf8"));
    expect(preload, "LUDONE_EMPTY_CALENDAR patřil zrušenému kalendáři").not.toContain("EMPTY_CALENDAR");
  });

  it.runIf(!kalendarZrusen)("KALENDÁŘ BYL V DESIGNU OBNOVEN — tenhle soubor je na smazání", () => {
    // Když Dan kalendář vrátí do designu, brána se odmlčí a nahlas řekne proč.
    expect(kalendarZrusen).toBe(false);
  });
});
