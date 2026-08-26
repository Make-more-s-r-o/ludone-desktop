import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Stejný postup jako u tray-authority: vytáhneme zdroj čisté funkce z main.cjs
// a spustíme ji izolovaně. Testovat ji přes mock Electronu nemá smysl — mock by
// vracel pevnou hodnotu bez ohledu na vstup a nehlídal by nic.
function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Funkce ${name} nebyla nalezena`);

  // Tělo funkce hledáme až ZA seznamem parametrů. Naivní "první { za jménem"
  // by u destrukturovaného parametru chytlo závorku v argumentech a vrátilo
  // useknutý zdroj — projeví se to jako SyntaxError až při vyhodnocení.
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
  if (afterParams < 0) throw new Error(`Funkce ${name} nemá uzavřené parametry`);

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

const zaklad = { isTestRun: false, permissionPromptsInFlight: 0, settingsVisible: false };

describe("panel se po ztrátě fokusu schová jen tehdy, kdy má", () => {
  it("běžná ztráta fokusu panel schová", () => {
    expect(shouldHidePanelOnBlur(zaklad)).toBe(true);
  });

  it("běžící systémový dialog o oprávnění panel NESCHOVÁ", () => {
    // Tohle je ta vada z 26. 8. 2026: uživatel povolil mikrofon, panel zmizel
    // a bez ikony v Docku to vypadalo jako pád aplikace.
    expect(shouldHidePanelOnBlur({ ...zaklad, permissionPromptsInFlight: 1 })).toBe(false);
  });

  it("víc souběžných dialogů drží panel taky", () => {
    expect(shouldHidePanelOnBlur({ ...zaklad, permissionPromptsInFlight: 2 })).toBe(false);
  });

  it("otevřené okno Nastavení panel drží dál", () => {
    expect(shouldHidePanelOnBlur({ ...zaklad, settingsVisible: true })).toBe(false);
  });

  it("v testovacím běhu se panel neschovává nikdy", () => {
    expect(shouldHidePanelOnBlur({ ...zaklad, isTestRun: true })).toBe(false);
  });

  it("po doběhnutí dialogu se chování vrátí k normálu", () => {
    // Počitadlo se v handleru snižuje ve finally, takže i chyba dialogu
    // musí vrátit panel do stavu, kdy se zase umí schovat.
    expect(shouldHidePanelOnBlur({ ...zaklad, permissionPromptsInFlight: 0 })).toBe(true);
  });
});
