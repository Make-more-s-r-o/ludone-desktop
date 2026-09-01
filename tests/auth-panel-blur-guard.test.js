import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Funkce ${name} nebyla nalezena`);

  const openingParen = source.indexOf("(", start);
  let parenDepth = 0;
  let afterParams = -1;
  for (let index = openingParen; index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    if (source[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        afterParams = index;
        break;
      }
    }
  }

  const openingBrace = source.indexOf("{", afterParams);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Funkce ${name} nemá uzavřené tělo`);
}

const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
const shouldHidePanelOnBlur = Function(
  `${functionSource(mainSource, "shouldHidePanelOnBlur")}; return shouldHidePanelOnBlur;`,
)();

const zaklad = {
  authAttemptsInFlight: 0,
  isTestRun: false,
  permissionPromptsInFlight: 0,
  settingsVisible: false,
};

describe("panel během přihlášení", () => {
  it.each([1, 2])("se při %i souběžných pokusech neschová", (authAttemptsInFlight) => {
    expect(shouldHidePanelOnBlur({ ...zaklad, authAttemptsInFlight })).toBe(false);
  });

  it("eviduje pokusy čítačem a vrací ho ve finally", () => {
    expect(mainSource).toMatch(/authAttemptsInFlight \+= 1/);
    expect(mainSource).toMatch(/finally\s*{[^}]*authAttemptsInFlight -= 1/s);
  });

  it("registruje zrušení přihlášení přes validovaný IPC wrapper", () => {
    expect(mainSource).toMatch(/const AUTH_CANCEL_CHANNEL = "auth:cancel"/);
    expect(mainSource).toMatch(/handleValidated\(AUTH_CANCEL_CHANNEL, \["panel"\]/);
  });

  it("zachovává ochranu pro dialogy oprávnění", () => {
    expect(shouldHidePanelOnBlur({ ...zaklad, permissionPromptsInFlight: 1 })).toBe(false);
  });
});
