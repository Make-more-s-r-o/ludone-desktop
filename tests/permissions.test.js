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
const decisionSource = functionSource(mainSource, "decidePermissionResult");
const decidePermissionResult = Function(
  `"use strict"; ${decisionSource}; return decidePermissionResult;`,
)();

describe("rozhodnutí podle skutečného stavu oprávnění macOS", () => {
  it("považuje granted za udělené a nic dalšího nedělá", () => {
    const result = decidePermissionResult("microphone", "granted");

    expect(result).toMatchObject({ status: "granted", granted: true, nextAction: "none" });
  });

  it("považuje denied za neudělené a posílá do Nastavení", () => {
    const result = decidePermissionResult("system-audio", "denied");

    expect(result).toMatchObject({ status: "denied", granted: false, nextAction: "open-settings" });
    expect(result.settingsUrl).toContain("Privacy_ScreenCapture");
  });

  it("u dosud neurčeného mikrofonu žádá macOS o oprávnění", () => {
    const result = decidePermissionResult("microphone", "not-determined");

    expect(result).toMatchObject({
      status: "not-determined",
      granted: false,
      nextAction: "request",
    });
  });

  it("u dosud neurčeného systémového zvuku posílá člověka do Nastavení", () => {
    const result = decidePermissionResult("system-audio", "not-determined");

    expect(result).toMatchObject({
      status: "not-determined",
      granted: false,
      nextAction: "open-settings",
    });
    expect(result.settingsUrl).toContain("Privacy_ScreenCapture");
  });

  it("považuje restricted za neudělené a nevyvolává další akci", () => {
    const result = decidePermissionResult("microphone", "restricted");

    expect(result).toMatchObject({ status: "restricted", granted: false, nextAction: "none" });
  });

  it("neznámý stav odmítne fail-closed", () => {
    const result = decidePermissionResult("microphone", "future-status");

    expect(result).toMatchObject({ status: "unknown", granted: false, nextAction: "none" });
  });

  it("chybějící stav odmítne fail-closed", () => {
    const result = decidePermissionResult("system-audio");

    expect(result).toMatchObject({ status: "unknown", granted: false, nextAction: "none" });
  });

  it("nepodporovaný typ oprávnění odmítne bez ohledu na stav", () => {
    const result = decidePermissionResult("calendar", "granted");

    expect(result).toMatchObject({
      permission: "calendar",
      status: "unknown",
      granted: false,
      nextAction: "none",
    });
  });
});
