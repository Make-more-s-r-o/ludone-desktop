import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function functionSource(source, name) {
  const start = source.indexOf(`async function ${name}(`);
  if (start < 0) throw new Error(`Funkce ${name} nebyla nalezena`);

  const openingBrace = source.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Funkce ${name} nemá uzavřené tělo`);
}

describe("integrita pořadí nahrávacích chunků", () => {
  it("před zápisem porovná sekvenci s očekávaným pořadím a až potom pořadí posune", () => {
    const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
    const appendSource = functionSource(mainSource, "appendRecordingChunk");
    const guardIndex = appendSource.search(/sequence\s*!==\s*track\.nextSequence/);
    const incrementIndex = appendSource.search(/track\.nextSequence\s*\+=\s*1/);

    expect(guardIndex, "appendRecordingChunk musí odmítnout chunk mimo pořadí").toBeGreaterThan(-1);
    expect(incrementIndex, "po úspěšném zápisu se musí očekávaná sekvence posunout").toBeGreaterThan(guardIndex);
  });
});
