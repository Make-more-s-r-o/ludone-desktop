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
      ...stylyBezKomentaru.matchAll(/oklch\([^)]*?\s145(?:\s*\/[^)]*)?\)/gi),
    ].map(([barva]) => barva);
    expect(
      zakazanaZelena,
      "schválený návrh neobsahuje zelený odstín 145",
    ).toEqual([]);

    for (const deklarace of SEMANTICKE_BARVY) {
      expect(stylyBezKomentaru, `v CSS chybí přesná deklarace ${deklarace}`).toContain(deklarace);
    }

    const root = stylyBezKomentaru.match(/:root\s*\{([^}]*)\}/)?.[1];
    expect(root, "v CSS chybí blok :root").toBeDefined();
    for (const deklarace of SEMANTICKE_BARVY) {
      expect(root, `${deklarace} musí být definovaná v :root`).toContain(deklarace);
    }
  });
});
