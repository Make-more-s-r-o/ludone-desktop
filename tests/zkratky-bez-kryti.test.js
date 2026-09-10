import { readFileSync } from "node:fs";
import { Linter } from "eslint";
import { describe, expect, it, vi } from "vitest";

// 🔴 PROČ TENHLE SOUBOR VZNIKL: nabídka v liště nabízela pět klávesových zkratek a
// `globalShortcut` se v celém repu nevolal ANI JEDNOU. Aplikace navíc běží jako accessory
// (`LSUIElement`), takže nekreslí lištu menu a lokální akcelerátory nemají kde vzniknout.
// Uživateli se tedy zobrazoval slib bez krytí — a žádný test se na to neptal, protože
// všechny měřily obsah nabídky, ne to, jestli ty zkratky něco dělají.
//
// Zámek je proto postavený na PŘÍČINĚ: popisek se do nabídky dostane jedině tehdy, když
// systém zkratku opravdu přijal. Kdo popisek vrátí natvrdo, zčervená tady.

const parsedSources = new Map();

function sourceCodeFor(source) {
  if (parsedSources.has(source)) return parsedSources.get(source);
  const linter = new Linter();
  const messages = linter.verify(source, [{
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
  }]);
  const fatal = messages.find((message) => message.fatal);
  if (fatal) throw new Error(`Zdroj nejde analyzovat: ${fatal.message}`);
  const sourceCode = linter.getSourceCode();
  if (!sourceCode) throw new Error("Zdroj se nepodařilo analyzovat");
  parsedSources.set(source, sourceCode);
  return sourceCode;
}

function withoutComments(source) {
  let result = source;
  for (const comment of sourceCodeFor(source).getAllComments().toReversed()) {
    const [start, end] = comment.range;
    const whitespace = source.slice(start, end).replace(/[^\r\n]/g, " ");
    result = `${result.slice(0, start)}${whitespace}${result.slice(end)}`;
  }
  return result;
}

function functionSource(source, name) {
  const declarations = sourceCodeFor(source).ast.body.filter((node) => (
    node.type === "FunctionDeclaration" && node.id?.name === name
  ));
  if (declarations.length === 0) throw new Error(`Funkce ${name} nebyla nalezena`);
  if (declarations.length > 1) {
    throw new Error(`Funkce ${name} je deklarovaná ${declarations.length}x — nevím, kterou měřit`);
  }
  const [start, end] = declarations[0].range;
  return source.slice(start, end);
}

const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
const mainCode = withoutComments(mainSource);

/** Vyřízne registraci zkratek i s jejich soupisem a spustí ji nad podstrčeným systémem. */
function harness({ prijme }) {
  const spustene = [];
  const zaregistrovane = [];
  const build = Function(
    "appState",
    "showPanel",
    "queueTrayCommand",
    "hasLiveRecording",
    "canStartTrackingFromTray",
    "console",
    `"use strict";
     ${/^const GLOBALNI_ZKRATKY = [\s\S]*?\]\);/m.exec(mainCode)[0]}
     ${/^const prijateZkratky = [^;]+;/m.exec(mainCode)[0]}
     ${functionSource(mainCode, "zkratkaProAkci")}
     ${functionSource(mainCode, "prepnoutTrackingZListy")}
     ${functionSource(mainCode, "spustAkciZkratky")}
     ${functionSource(mainCode, "registerGlobalShortcuts")}
     return { registerGlobalShortcuts, zkratkaProAkci, GLOBALNI_ZKRATKY };`,
  );
  const api = build(
    { trackingOwners: new Set(), panelActionOwners: new Set(["panel"]), signedIn: true },
    () => spustene.push("panel"),
    (prikaz) => spustene.push(prikaz),
    () => true,
    () => true,
    { log: () => {}, error: () => {} },
  );
  const shortcuts = {
    register: vi.fn((zkratka, handler) => {
      const prijato = prijme(zkratka);
      if (prijato) zaregistrovane.push({ zkratka, handler });
      return prijato;
    }),
  };
  return { api, shortcuts, spustene, zaregistrovane };
}

describe("zkratky v liště nejsou slib bez krytí", () => {
  it("přijatá zkratka se ukáže v nabídce, nepřijatá ne", () => {
    const { api, shortcuts } = harness({ prijme: (z) => z !== "Control+Option+T" });

    expect(api.registerGlobalShortcuts(shortcuts)).toBe(2);
    expect(api.zkratkaProAkci("stop-recording")).toBe("Control+Option+R");
    expect(api.zkratkaProAkci("otevrit-panel")).toBe("Control+Option+L");
    // Zabranou zkratku drží jiná aplikace — položka zůstane, popisek zmizí.
    expect(api.zkratkaProAkci("prepnout-tracking")).toBeUndefined();
  });

  it("když systém nepřijme nic, nabídka nenabízí ani jednu zkratku", () => {
    const { api, shortcuts } = harness({ prijme: () => false });

    expect(api.registerGlobalShortcuts(shortcuts)).toBe(0);
    for (const { akce } of api.GLOBALNI_ZKRATKY) {
      expect(api.zkratkaProAkci(akce)).toBeUndefined();
    }
  });

  it("výjimka při registraci nesmí shodit start aplikace", () => {
    const { api } = harness({ prijme: () => true });
    const vybuchne = { register: () => { throw new Error("systém odmítl"); } };

    expect(() => api.registerGlobalShortcuts(vybuchne)).not.toThrow();
    expect(api.zkratkaProAkci("otevrit-panel")).toBeUndefined();
  });

  it("stisk zkratky opravdu spustí tu akci, ke které patří", () => {
    const { api, shortcuts, spustene, zaregistrovane } = harness({ prijme: () => true });
    api.registerGlobalShortcuts(shortcuts);

    for (const { handler } of zaregistrovane) handler();

    expect(spustene).toEqual(["stop-recording", "start-tracking", "panel"]);
  });

  it("opakovaná registrace nezdvojí soupis přijatých zkratek", () => {
    const { api, shortcuts } = harness({ prijme: () => true });

    expect(api.registerGlobalShortcuts(shortcuts)).toBe(3);
    expect(api.registerGlobalShortcuts(shortcuts)).toBe(3);
  });

  it.each([
    ["nastavení", "CommandOrControl+,"],
    ["ukončení", "CommandOrControl+Q"],
  ])("zkratku pro %s si aplikace nesmí vzít globálně", (_popis, zkratka) => {
    // Globální `Cmd+,` nebo `Cmd+Q` by LuDone ukradl VŠEM ostatním aplikacím. Oprava
    // jedné lži by tím vyrobila horší vadu, takže se ty popisky rovnou nenabízejí.
    const { api } = harness({ prijme: () => true });
    expect(api.GLOBALNI_ZKRATKY.map(({ zkratka: z }) => z)).not.toContain(zkratka);
    expect(mainCode).not.toContain(`accelerator: "${zkratka}"`);
  });

  it("v nabídce nezůstal žádný natvrdo napsaný popisek zkratky", () => {
    // Přesně ta vada, kterou tenhle soubor zamyká: `accelerator` musí pokaždé plynout
    // z toho, co systém přijal, ne z konstanty v šabloně nabídky.
    const sablona = functionSource(mainCode, "trayContextMenuTemplate");
    expect(sablona).not.toMatch(/accelerator:\s*"/);
    expect(sablona).toMatch(/accelerator: zkratkaProAkci\(/);
  });

  it("aplikace zkratky při ukončení uvolní", () => {
    // Bez uvolnění by je systém držel dál a další spuštění by je nezískalo —
    // z „funguje" by se stalo „fungovalo jednou po restartu".
    expect(mainCode).toMatch(/app\.on\("will-quit"[\s\S]{0,200}unregisterAll\(\)/);
  });
});
