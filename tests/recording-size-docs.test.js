import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const documentPath = new URL("../docs/navrh-velikost-nahravek.md", import.meta.url);
const documentText = readFileSync(documentPath, "utf8");

describe("stav návrhu velikosti nahrávek", () => {
  it("odděluje chování před variantou A od aktuálního stavu", () => {
    const downloadsRow = documentText.split("\n")
      .find((line) => line.startsWith("| `Stažené/LuDone-"));

    expect(downloadsRow).toContain("Před variantou A:");
    expect(downloadsRow).toContain("send`, `keep` i automatické odeslání vytvářely kopii");
    expect(downloadsRow).toContain("Po variantě A:");
    expect(downloadsRow).toContain("vznikne jen výslovným");
    expect(documentText).toContain("Starší `recording:export` IPC");
    expect(documentText).toContain("ale soubor nekopíruje");
  });
});
