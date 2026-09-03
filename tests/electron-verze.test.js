import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const balicek = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

// Každý major Electronu si nese vlastní minimum macOS. Když se tabulka po upgradu nedoplní,
// test spadne schválně — je to levnější než zjistit od uživatele, že mu aplikace nestartuje.
const MINIMUM_MACOS_PODLE_MAJORU = {
  37: "10.15.0",
  38: "11.0.0",
  39: "12.0.0",
};

function major(verze) {
  return Number.parseInt(String(verze).replace(/^[^\d]*/, ""), 10);
}

describe("verze Electronu a minimum macOS", () => {
  const verzeElectronu = balicek.devDependencies?.electron;
  const majorElectronu = major(verzeElectronu);

  it("balíček deklaruje přesnou verzi Electronu, ne rozsah", () => {
    // Rozsah (`^39.0.0`) by dovolil, aby se major změnil sám při instalaci — a s ním
    // i minimum macOS, aniž by o tom kdokoli rozhodl.
    expect(verzeElectronu, "electron musí být připnutý na přesnou verzi").toMatch(
      /^\d+\.\d+\.\d+$/,
    );
  });

  it("pro použitý major Electronu známe minimum macOS", () => {
    expect(
      MINIMUM_MACOS_PODLE_MAJORU[majorElectronu],
      `Electron ${majorElectronu} není v tabulce minim macOS — doplň ho, `
      + "jinak nevíme, komu se aplikace nespustí",
    ).toBeDefined();
  });

  it("balíček deklaruje minimum macOS odpovídající majoru Electronu", () => {
    // Bez tohohle údaje macOS instalaci nezastaví: uživatel na starší verzi aplikaci
    // nainstaluje a ta mu jen nenaběhne, bez vysvětlení.
    expect(balicek.build?.mac?.minimumSystemVersion).toBe(
      MINIMUM_MACOS_PODLE_MAJORU[majorElectronu],
    );
  });
});
