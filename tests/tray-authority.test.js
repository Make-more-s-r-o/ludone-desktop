import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Funkce ${name} nebyla nalezena`);

  // 🔴 Seznam parametrů se musí přeskočit ZÁVORKAMI, ne hledáním první `{`. Funkce
  // s rozbaleným parametrem — `function f({ a, b }) {` — má složenou závorku už v hlavičce,
  // takže naivní hledání vyřízne jen hlavičku bez těla a výsledek se ani nedá spustit.
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = source.indexOf("(", start); index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    if (source[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = source.indexOf("{", index);
        break;
      }
    }
  }
  if (bodyStart < 0) throw new Error(`Funkce ${name} nemá hlavičku, kterou umím přeskočit`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Funkce ${name} nemá uzavřené tělo`);
}

const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
const preloadSource = readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

const trayIconName = Function(
  `"use strict"; ${functionSource(mainSource, "trayIconName")}; return trayIconName;`,
)();

// Hlavní proces se nedá načíst bez Electronu, tak si z něj vyřízneme rozhodovací funkce
// a spustíme je nad podstrčeným stavem. Testuje se tím SKUTEČNÝ produkční kód, ne jeho
// kopie — kdyby se `main.cjs` změnil, změní se i to, co tady běží.
function trayHarness({
  signedIn = false,
  preparing = [],
  sessions = [],
  trackingOwners = [],
} = {}) {
  const finalized = [];
  const factory = Function(
    "recordingOwnersPreparing",
    "recordingSessions",
    "appState",
    "trayIconName",
    "trayImage",
    "TRAY_LABELS",
    "tray",
    "finalizeRecordingSession",
    `"use strict";
     let trayState = "signed-out";
     const applied = [];
     ${functionSource(mainSource, "hasLiveRecording")}
     ${functionSource(mainSource, "deriveTrayState")}
     ${functionSource(mainSource, "refreshTray")}
     ${functionSource(mainSource, "finalizeRecordingSessionsForOwner")}
     ${functionSource(mainSource, "forgetOwnerActivity")}
     ${functionSource(mainSource, "applyReportedFacts")}
     return {
       refreshTray,
       forgetOwnerActivity,
       applyReportedFacts,
       hasLiveRecording,
       deriveTrayState,
       applied,
       // Metoda, ne getter. Rozbalení objektu níž by getter vyhodnotilo JEDNOU a uložilo
       // jeho tehdejší hodnotu, takže by stav navždy zamrzl na signed-out a test by hlásil
       // vadu kódu tam, kde je vada harnessu.
       getTrayState: () => trayState,
     };`,
  );

  const images = [];
  const tooltips = [];
  return {
    finalized,
    images,
    tooltips,
    ...factory(
      new Map(preparing),
      new Map(sessions),
      { signedIn, trackingOwners: new Set(trackingOwners) },
      trayIconName,
      (state) => `obrazek:${state}`,
      { "signed-out": "L·odhlášeno", idle: "L·připraveno", recording: "L·nahrává", tracking: "L·lutrack" },
      { setImage: (value) => images.push(value), setToolTip: (value) => tooltips.push(value) },
      // Atrapa je až TADY, o patro níž. Kdyby stála za finalizeRecordingSessionsForOwner,
      // neprovedl by se produkční řádek, který ruší rozdělanou přípravu — a test by měřil
      // chování atrapy místo chování kódu.
      (sessionId, reason) => {
        finalized.push({ sessionId, reason });
        return Promise.resolve({ files: { microphone: { size: 0 }, system: { size: 0 } } });
      },
    ),
  };
}

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

  // Tahle asserce se NEMĚNÍ — je to invariant, který platil před B3 i po ní.
  it("výběr obrázku používá čisté mapování stavu", () => {
    expect(functionSource(mainSource, "trayImage")).toContain("trayIconName(state)");
  });

  // Týž invariant, přesunutý na funkci, která nahradila `updateTray`. Kdyby se smazal
  // místo přesunutí, bylo by to oslabení brány.
  it("uložený stav lišty používá stejné čisté mapování", () => {
    expect(functionSource(mainSource, "refreshTray")).toContain("trayIconName(");
  });
});

describe("stav vlastní hlavní proces, ne renderer", () => {
  it("renderer už nemá jak stav rozhodnout", () => {
    // Nejlevnější a zároveň nejsilnější důkaz nového směru: kanál, kterým renderer
    // posílal ROZHODNUTÍ, nesmí existovat na žádné ze tří stran.
    // Hledá se REGISTRACE kanálu, tedy jméno v uvozovkách — ne zmínka o něm. Komentáře
    // v `main.cjs` ten kanál jmenují schválně, aby bylo vidět, co se sem vrátit nesmí,
    // a kontrola, která by na ně padala, by byla přecitlivělá a někdo by ji oslabil.
    expect(mainSource).not.toContain('"tray:set-state"');
    expect(preloadSource).not.toContain('"tray:set-state"');
    expect(preloadSource).not.toContain("setTrayState");
    expect(appSource).not.toContain("setTrayState");
    expect(mainSource).not.toContain("function updateTray(");
  });

  it("renderer hlásí fakta, ne jméno ikony", () => {
    const handler = mainSource.slice(mainSource.indexOf('onValidated("tray:report-facts"'));
    expect(handler).toContain("applyReportedFacts");
    // Do kanálu faktů se nesmí dostat jméno stavu — tím by se `tray:set-state` vrátil
    // pod jiným jménem.
    expect(functionSource(mainSource, "applyReportedFacts")).not.toContain("trayIconName");
  });

  it.each([
    [{ signedIn: false }, "signed-out"],
    [{ signedIn: true }, "idle"],
    [{ signedIn: true, trackingOwners: [1] }, "tracking"],
    [{ signedIn: true, preparing: [[1, { cancelled: false }]] }, "recording"],
    [{ signedIn: true, sessions: [["s", { ownerId: 1 }]] }, "recording"],
    // Nahrávání má přednost před časovačem.
    [{ signedIn: true, trackingOwners: [1], preparing: [[1, { cancelled: false }]] }, "recording"],
    // Zrušená příprava a doběhnutá session se za nahrávání NEPOČÍTAJÍ.
    [{ signedIn: true, preparing: [[1, { cancelled: true }]] }, "idle"],
    [{ signedIn: true, sessions: [["s", { ownerId: 1, finalizePromise: Promise.resolve() }]] }, "idle"],
  ])("odvodí stav %j jako %s", (input, expected) => {
    const harness = trayHarness(input);
    harness.refreshTray();
    expect(harness.getTrayState()).toBe(expected);
  });
});

describe("pád rendereru", () => {
  it("nechá lištu hlásit správný stav, ne ten poslední odeslaný", () => {
    const harness = trayHarness({
      signedIn: true,
      trackingOwners: [7],
      preparing: [[7, { cancelled: false }]],
    });
    harness.refreshTray();
    expect(harness.getTrayState()).toBe("recording");

    harness.forgetOwnerActivity(7, "pád rendereru");

    // 🔴 Tohle je celý smysl B3. Dokud stav posílal renderer, zůstala ikona po jeho pádu
    // viset na „nahrává“ — nikdo ji neměl jak přepnout zpět.
    expect(harness.getTrayState()).toBe("idle");
    // Příprava se zrušila produkčním kódem, ne atrapou; sessions žádné nebyly.
    expect(harness.finalized).toEqual([]);
  });

  it("NEODHLÁSÍ uživatele — session drží hlavní proces", () => {
    const harness = trayHarness({ signedIn: true, trackingOwners: [7] });
    harness.refreshTray();
    harness.forgetOwnerActivity(7, "pád rendereru");

    // Cílový stav po pádu je `idle`, ne `signed-out`. Kdo to splete, postaví autoritu,
    // která se tváří, že pád okna uživatele odhlásil.
    expect(harness.getTrayState()).toBe("idle");
    expect(harness.getTrayState()).not.toBe("signed-out");
  });

  it("zapomene jen padlé okno, ostatní nechá běžet", () => {
    const harness = trayHarness({ signedIn: true, trackingOwners: [7, 9] });
    harness.refreshTray();
    harness.forgetOwnerActivity(7, "pád rendereru");
    expect(harness.getTrayState()).toBe("tracking");
  });
});

describe("lišta se překresluje jen při skutečné změně", () => {
  it("stejný stav podruhé už obrázek nesahá", () => {
    const harness = trayHarness({ signedIn: true });
    harness.refreshTray();
    const poPrvni = harness.images.length;
    harness.refreshTray();
    expect(harness.images.length).toBe(poPrvni);
  });

  it("změna stavu obrázek i popisek přepíše", () => {
    const harness = trayHarness({ signedIn: true });
    harness.refreshTray();
    harness.applyReportedFacts(3, { signedIn: true, tracking: true });
    expect(harness.getTrayState()).toBe("tracking");
    expect(harness.images.at(-1)).toBe("obrazek:tracking");
    expect(harness.tooltips.at(-1)).toBe("L·lutrack");
  });
});
