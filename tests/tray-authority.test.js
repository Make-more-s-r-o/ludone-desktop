import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
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

const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
const trayIconNameSource = functionSource(mainSource, "trayIconName");
const trayIconName = Function(
  `"use strict"; ${trayIconNameSource}; return trayIconName;`,
)();

describe("autorita stavu tray ikony", () => {
  it.each([
    ["signed-out", "signed-out"],
    ["idle", "idle"],
    ["recording", "recording"],
    ["tracking", "tracking"],
    ["neznámý stav", "signed-out"],
  ])("mapuje stav %s na ikonu %s", (state, expectedIcon) => {
    expect(trayIconName(state)).toBe(expectedIcon);
  });

  it("výběr obrázku používá čisté mapování stavu", () => {
    expect(functionSource(mainSource, "trayImage")).toContain("trayIconName(state)");
  });

  it("uložený stav lišty používá stejné čisté mapování", () => {
    expect(functionSource(mainSource, "updateTray")).toContain("trayIconName(nextState)");
  });
});
