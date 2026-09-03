import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styly = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const stylyBezKomentaru = styly.replace(/\/\*[\s\S]*?\*\//g, "");

const SEMANTICKE_BARVY = [
  "--panel-accent: oklch(0.72 0.14 268);",
  "--panel-ok: oklch(0.78 0.11 178);",
  "--panel-wait: oklch(0.8 0.13 76);",
  "--panel-bad: oklch(0.75 0.14 34);",
];

describe("schválená barevná paleta", () => {
  it("platí pro celou aplikaci a neobsahuje starý zelený odstín", () => {
    // Komentáře jsou odstraněné před každým hledáním, aby zakomentovaná deklarace
    // nemohla bránu ani falešně shodit, ani falešně zazelenat.
    const zakazanaZelena = [
      ...stylyBezKomentaru.matchAll(
        /oklch\([^)]*?\s145(?:\.0+)?(?:deg)?(?=\s*(?:\/|\)))[^)]*\)/gi,
      ),
    ].map(([barva]) => barva);
    expect(
      zakazanaZelena,
      "schválený návrh neobsahuje zelený odstín 145",
    ).toEqual([]);

    const rootBloky = [...stylyBezKomentaru.matchAll(/:root\s*\{([^}]*)\}/g)];
    expect(rootBloky, "v CSS musí být právě jeden blok :root").toHaveLength(1);
    const root = rootBloky[0]?.[1];
    expect(root, "v CSS chybí blok :root").toBeDefined();
    for (const deklarace of SEMANTICKE_BARVY) {
      expect(root, `${deklarace} musí být definovaná v :root`).toContain(deklarace);
      const nazev = deklarace.slice(0, deklarace.indexOf(":"));
      const bezpecnyNazev = nazev.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const definice = [...stylyBezKomentaru.matchAll(new RegExp(`${bezpecnyNazev}\\s*:`, "g"))];
      expect(definice, `${nazev} nesmí přepsat druhá definice`).toHaveLength(1);
    }
  });
});
