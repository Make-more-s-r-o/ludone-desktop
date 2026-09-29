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
  it("zachovává systémové fallback barvy a aktivní Astra barvy", () => {
    // Komentáře jsou odstraněné před každým hledáním, aby zakomentovaná deklarace
    // nemohla bránu ani falešně shodit, ani falešně zazelenat.
    const zelenaMimoStavSuccess = [
      ...stylyBezKomentaru.matchAll(
        /(--[\w-]+\s*:\s*oklch\([^)]*?\s145(?:\.0+)?(?:deg)?(?=\s*(?:\/|\)))[^)]*\))/gi,
      ),
    ].map(([, deklarace]) => deklarace.replace(/\s+/g, " ").trim());
    expect(
      zelenaMimoStavSuccess,
      "zelený odstín Astra patří jen k úspěšnému stavu",
    ).toEqual([
      "--panel-ok: oklch(0.48 0.15 145)",
      "--panel-ok: oklch(0.72 0.16 145)",
    ]);

    const rootBloky = [...stylyBezKomentaru.matchAll(/:root\s*\{([^}]*)\}/g)];
    expect(rootBloky, "v CSS musí být právě jeden blok :root").toHaveLength(1);
    const root = rootBloky[0]?.[1];
    expect(root, "v CSS chybí blok :root").toBeDefined();
    const svetlyMotiv = /@media\s*\(prefers-color-scheme:\s*light\)\s*\{\s*html\s*\{([^}]*)\}/.exec(stylyBezKomentaru)?.[1];
    expect(svetlyMotiv, "světlý motiv musí mít vlastní přístupné sémantické barvy").toBeDefined();
    const astraSvetlyBlok = /html\[data-theme="light"\]\s*,\s*html\[data-theme="professional"\]\s*\{([^}]*)\}/.exec(stylyBezKomentaru)?.[1];
    const astraTmavyBlok = /html\[data-theme="dark"\]\s*\{([^}]*)\}/.exec(stylyBezKomentaru)?.[1];
    expect(astraSvetlyBlok, "chybí světlé tokeny Astra").toBeDefined();
    expect(astraTmavyBlok, "chybí tmavé tokeny Astra").toBeDefined();
    const svetleBarvy = [
      "--panel-accent: oklch(0.55 0.16 274);",
      "--panel-ok: oklch(0.49 0.12 177);",
      "--panel-wait: oklch(0.58 0.13 76);",
      "--panel-bad: oklch(0.55 0.17 30);",
    ];
    for (const deklarace of SEMANTICKE_BARVY) {
      expect(root, `${deklarace} musí být definovaná v :root`).toContain(deklarace);
      const nazev = deklarace.slice(0, deklarace.indexOf(":"));
      const bezpecnyNazev = nazev.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const definice = [...stylyBezKomentaru.matchAll(new RegExp(`${bezpecnyNazev}\\s*:`, "g"))];
      const svetlaDeklarace = svetleBarvy.find((barva) => barva.startsWith(`${nazev}:`));
      const pocetDefinic = nazev === "--panel-accent" ? 5 : 4;
      expect(definice, `${nazev} má mít fallback i přesně definované varianty Astra`).toHaveLength(pocetDefinic);
      expect(svetlyMotiv).toContain(svetlaDeklarace);
    }
    for (const deklarace of [
      "--panel-accent: oklch(0.16 0 0);",
      "--panel-ok: oklch(0.48 0.15 145);",
      "--panel-wait: oklch(0.54 0.14 72);",
      "--panel-bad: oklch(0.53 0.19 28);",
    ]) expect(astraSvetlyBlok).toContain(deklarace);
    for (const deklarace of [
      "--panel-accent: oklch(0.94 0 0);",
      "--panel-ok: oklch(0.72 0.16 145);",
      "--panel-wait: oklch(0.79 0.14 76);",
      "--panel-bad: oklch(0.72 0.17 28);",
    ]) expect(astraTmavyBlok).toContain(deklarace);
  });
});
