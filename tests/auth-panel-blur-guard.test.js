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

  it("blur handler PŘEDÁVÁ čítač do volání — ne jen že funkce umí rozhodnout", () => {
    // 🔴 Nález nezávislého review: testy výš skládají vstupní objekt samy a volají čistou
    // funkci. Tím dokazují ROZHODNUTÍ a nikdy ZAPOJENÍ — kdyby volající místo v `main.cjs`
    // přestalo `authAttemptsInFlight` posílat, panel by se během přihlašování zase schovával
    // a všechny ostatní testy v tomhle souboru by zůstaly zelené.
    //
    // Porovnáváme proto PARAMETRY funkce s KLÍČI, které jí volající skutečně předává. Chytí
    // to obojí: když volající pole vypustí, i když funkce dostane nový parametr, který jí
    // nikdo neposílá.
    const kodBezKomentaru = mainSource
      .split("\n")
      .map((radek) => (radek.trim().startsWith("//") ? "" : radek))
      .join("\n");

    const hlavicka = /function shouldHidePanelOnBlur\(\{([^}]*)\}\)/.exec(kodBezKomentaru);
    expect(hlavicka, "hlavička shouldHidePanelOnBlur se nenašla").not.toBeNull();
    const parametry = hlavicka[1]
      .split(",").map((kus) => kus.trim().split(":")[0].trim()).filter(Boolean).sort();

    const volani = /shouldHidePanelOnBlur\(\{([^}]*)\}\)/g;
    const volaci = [...kodBezKomentaru.matchAll(volani)]
      .map((m) => m[1])
      // Hlavička se do téhle množiny taky trefí; poznáme ji podle toho, že jí předchází
      // `function `. Ta nás nezajímá, zajímá nás skutečné volání.
      .filter((_, i) => i > 0);
    expect(volaci.length, "volání shouldHidePanelOnBlur se v main.cjs nenašlo").toBeGreaterThan(0);

    for (const argumenty of volaci) {
      const klice = argumenty
        .split(",").map((kus) => kus.trim().split(":")[0].trim()).filter(Boolean).sort();
      expect(klice).toEqual(parametry);
    }
  });

  it("zachovává ochranu pro dialogy oprávnění", () => {
    expect(shouldHidePanelOnBlur({ ...zaklad, permissionPromptsInFlight: 1 })).toBe(false);
  });
});
