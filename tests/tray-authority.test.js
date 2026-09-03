import { readFileSync } from "node:fs";
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";
import trackingModule from "../electron/tracking.cjs";

const { TRACKING_STATES } = trackingModule;
const parsedSources = new Map();

function sourceCodeFor(source) {
  if (parsedSources.has(source)) return parsedSources.get(source);
  const linter = new Linter();
  const messages = linter.verify(source, [{
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
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
  const comments = sourceCodeFor(source).getAllComments().toReversed();
  for (const comment of comments) {
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
const preloadSource = readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const mainCodeWithoutComments = withoutComments(mainSource);
const preloadCodeWithoutComments = withoutComments(preloadSource);
const appCodeWithoutComments = withoutComments(appSource);
const trackingStoreOwnerId = Function(
  `"use strict";
   ${/^const TRACKING_STORE_OWNER_ID = [^;]+;/m.exec(mainCodeWithoutComments)[0]}
   return TRACKING_STORE_OWNER_ID;`,
)();

const createTrackingMutationRunner = Function(
  "getReadyTrackingStore",
  "appState",
  "refreshTray",
  "TRACKING_STATES",
  "TRACKING_STORE_OWNER_ID",
  `"use strict";
   ${functionSource(mainCodeWithoutComments, "syncTrackingTray")}
   ${functionSource(mainCodeWithoutComments, "runTrackingMutation")}
   return runTrackingMutation;`,
);

function trackingMutationHarness({ method, initialEntry, initialOwners, nextEntry }) {
  const trackingOwners = new Set(initialOwners);
  const calls = [];
  const refreshSnapshots = [];
  let state = { aktualni: initialEntry };
  let markMutationStarted;
  let releaseMutation;
  const mutationStarted = new Promise((resolve) => { markMutationStarted = resolve; });
  const mutationReleased = new Promise((resolve) => { releaseMutation = resolve; });
  const store = {
    getState: () => state,
    async [method](payload) {
      calls.push({ method, payload });
      markMutationStarted();
      await mutationReleased;
      state = { aktualni: nextEntry };
      return { method, payload };
    },
  };
  const runTrackingMutation = createTrackingMutationRunner(
    async () => store,
    { trackingOwners },
    () => { refreshSnapshots.push([...trackingOwners]); },
    TRACKING_STATES,
    trackingStoreOwnerId,
  );
  return {
    calls,
    mutationStarted,
    releaseMutation,
    refreshSnapshots,
    runTrackingMutation,
    trackingOwners,
  };
}

// Konstantu bereme z PRODUKČNÍHO zdroje, ne z kopie. Kdyby si ji test definoval sám,
// měřil by svoji představu a rozšíření povolených klíčů v main.cjs by prošlo nepovšimnuto.
const reportedFactKeys = Function(
  `"use strict"; ${/const REPORTED_FACT_KEYS = \[[^\]]*\];/.exec(mainCodeWithoutComments)[0]}; return REPORTED_FACT_KEYS;`,
)();

const trayIconName = Function(
  `"use strict"; ${functionSource(mainCodeWithoutComments, "trayIconName")}; return trayIconName;`,
)();

// Hlavní proces se nedá načíst bez Electronu, tak si z něj vyřízneme rozhodovací funkce
// a spustíme je nad podstrčeným stavem. Testuje se tím SKUTEČNÝ produkční kód, ne jeho
// kopie — kdyby se `main.cjs` změnil, změní se i to, co tady běží.
function trayHarness({
  signedIn = false,
  preparing = [],
  queueWaitingCount = 0,
  sessions = [],
  systemAudioLostOwners = [],
  trackingOwners = [],
} = {}) {
  const finalized = [];
  const factory = Function(
    "recordingOwnersPreparing",
    "recordingSessions",
    "recordingExportStages",
    "appState",
    "trayIconName",
    "trayImage",
    "TRAY_LABELS",
    "tray",
    "currentTrayIconTheme",
    "refreshTrayTitle",
    "finalizeRecordingSession",
    "finalizeRecordingExportStage",
    "maybeCompleteDeferredQuit",
    "tryInstallDownloadedUpdate",
    "REPORTED_FACT_KEYS",
    `"use strict";
     let trayState = "signed-out";
     let trayApplied = false;
     let trayThemeApplied;
     const applied = [];
     ${functionSource(mainCodeWithoutComments, "hasLiveRecording")}
     ${functionSource(mainCodeWithoutComments, "hasLiveSystemAudioLoss")}
     ${functionSource(mainCodeWithoutComments, "deriveTrayState")}
     ${functionSource(mainCodeWithoutComments, "refreshTray")}
     ${functionSource(mainCodeWithoutComments, "finalizeRecordingSessionsForOwner")}
     ${functionSource(mainCodeWithoutComments, "forgetOwnerActivity")}
     ${functionSource(mainCodeWithoutComments, "applyReportedFacts")}
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
      new Map(),
      {
        outboundQueueWaitingCount: queueWaitingCount,
        signedIn,
        systemAudioLostOwners: new Set(systemAudioLostOwners),
        trackingOwners: new Set(trackingOwners),
      },
      trayIconName,
      (state) => `obrazek:${state}`,
      {
        "signed-out": "L·odhlášeno",
        idle: "L·připraveno",
        recording: "L·nahrává",
        tracking: "L·lutrack",
        "recording-tracking": "L·nahrává+lutrack",
        "queue-waiting": "L·čeká fronta",
        "recording-audio-lost": "L·výpadek zvuku",
      },
      { setImage: (value) => images.push(value), setToolTip: (value) => tooltips.push(value) },
      () => "dark",
      () => {},
      // Atrapa je až TADY, o patro níž. Kdyby stála za finalizeRecordingSessionsForOwner,
      // neprovedl by se produkční řádek, který ruší rozdělanou přípravu — a test by měřil
      // chování atrapy místo chování kódu.
      (sessionId, reason) => {
        finalized.push({ sessionId, reason });
        return Promise.resolve({ files: { microphone: { size: 0 }, system: { size: 0 } } });
      },
      () => Promise.resolve(),
      () => {},
      () => {},
      reportedFactKeys,
    ),
  };
}

describe("autorita stavu tray ikony", () => {
  it.each([
    ["signed-out", "signed-out"],
    ["idle", "idle"],
    ["recording", "recording"],
    ["tracking", "tracking"],
    ["recording-tracking", "recording-tracking"],
    ["queue-waiting", "queue-waiting"],
    ["recording-audio-lost", "recording-audio-lost"],
    ["neznámý stav", "signed-out"],
  ])("mapuje stav %s na ikonu %s", (state, expectedIcon) => {
    expect(trayIconName(state)).toBe(expectedIcon);
  });

  // Tahle asserce se NEMĚNÍ — je to invariant, který platil před B3 i po ní.
  it("výběr obrázku používá čisté mapování stavu", () => {
    expect(functionSource(mainCodeWithoutComments, "trayImage")).toContain("trayIconName(state)");
  });

  // Týž invariant, přesunutý na funkci, která nahradila `updateTray`. Kdyby se smazal
  // místo přesunutí, bylo by to oslabení brány.
  it("uložený stav lišty používá stejné čisté mapování", () => {
    expect(functionSource(mainCodeWithoutComments, "refreshTray")).toContain("trayIconName(");
  });
});

describe("stav vlastní hlavní proces, ne renderer", () => {
  it("renderer už nemá jak stav rozhodnout", () => {
    // Nejlevnější a zároveň nejsilnější důkaz nového směru: kanál, kterým renderer
    // posílal ROZHODNUTÍ, nesmí existovat na žádné ze tří stran.
    // Hledá se REGISTRACE kanálu, tedy jméno v uvozovkách — ne zmínka o něm. Komentáře
    // v `main.cjs` ten kanál jmenují schválně, aby bylo vidět, co se sem vrátit nesmí,
    // a kontrola, která by na ně padala, by byla přecitlivělá a někdo by ji oslabil.
    expect(mainCodeWithoutComments).not.toContain('"tray:set-state"');
    expect(preloadCodeWithoutComments).not.toContain('"tray:set-state"');
    expect(preloadCodeWithoutComments).not.toContain("setTrayState");
    expect(appCodeWithoutComments).not.toContain("setTrayState");
    expect(mainCodeWithoutComments).not.toContain("function updateTray(");
  });

  it("renderer hlásí fakta, ne jméno ikony", () => {
    const handler = mainCodeWithoutComments.slice(
      mainCodeWithoutComments.indexOf('onValidated("tray:report-facts"'),
    );
    expect(handler).toContain("applyReportedFacts");
    // Do kanálu faktů se nesmí dostat jméno stavu — tím by se `tray:set-state` vrátil
    // pod jiným jménem.
    expect(functionSource(mainCodeWithoutComments, "applyReportedFacts")).not.toContain("trayIconName");
  });

  it.each([
    [{ signedIn: false }, "signed-out"],
    [{ signedIn: true }, "idle"],
    [{ signedIn: true, trackingOwners: [1] }, "tracking"],
    [{ signedIn: true, preparing: [[1, { cancelled: false }]] }, "recording"],
    [{ signedIn: true, sessions: [["s", { ownerId: 1 }]] }, "recording"],
    [{ signedIn: true, queueWaitingCount: 1 }, "queue-waiting"],
    [{ signedIn: true, systemAudioLostOwners: [1] }, "idle"],
    [
      {
        signedIn: true,
        preparing: [[1, { cancelled: false }]],
        systemAudioLostOwners: [1],
      },
      "recording-audio-lost",
    ],
    // Souběh se neztratí: nahrávání zůstává hlavní agenda a LuTrack odznak.
    [
      { signedIn: true, trackingOwners: [1], preparing: [[1, { cancelled: false }]] },
      "recording-tracking",
    ],
    // Výpadek je zhoršená varianta hlavní nahrávací agendy. Překryje LuTrack i frontu,
    // ale přihlášení zůstává nejvyšší historickou prioritou.
    [
      {
        signedIn: true,
        trackingOwners: [1],
        preparing: [[1, { cancelled: false }]],
        queueWaitingCount: 2,
        systemAudioLostOwners: [1],
      },
      "recording-audio-lost",
    ],
    [
      { signedIn: true, trackingOwners: [1], queueWaitingCount: 2 },
      "tracking",
    ],
    [
      {
        signedIn: false,
        trackingOwners: [1],
        preparing: [[1, { cancelled: false }]],
        queueWaitingCount: 2,
        systemAudioLostOwners: [1],
      },
      "signed-out",
    ],
    // Zrušená příprava a doběhnutá session se za nahrávání NEPOČÍTAJÍ.
    [{ signedIn: true, preparing: [[1, { cancelled: true }]] }, "idle"],
    [{ signedIn: true, sessions: [["s", { ownerId: 1, finalizePromise: Promise.resolve() }]] }, "idle"],
  ])("odvodí stav %j jako %s", (input, expected) => {
    const harness = trayHarness(input);
    harness.refreshTray();
    expect(harness.getTrayState()).toBe(expected);
  });

  it("při souběhu spojí fakt LuTracku se skutečným nahráváním z hlavního procesu", () => {
    const harness = trayHarness({
      signedIn: true,
      preparing: [[7, { cancelled: false }]],
    });
    harness.refreshTray();
    expect(harness.getTrayState()).toBe("recording");

    expect(harness.applyReportedFacts(7, {
      signedIn: true,
      systemAudioLost: false,
      tracking: true,
    })).toBe(true);
    expect(harness.getTrayState()).toBe("recording-tracking");
    expect(harness.images.at(-1)).toBe("obrazek:recording-tracking");
    expect(harness.tooltips.at(-1)).toBe("L·nahrává+lutrack");
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
    expect(harness.getTrayState()).toBe("recording-tracking");

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

  it("po pádu odstraní i rendererový fakt výpadku, ne výpadek cizí živé session", () => {
    const harness = trayHarness({
      signedIn: true,
      sessions: [
        ["padla", { ownerId: 7 }],
        ["ziva", { ownerId: 9 }],
      ],
      systemAudioLostOwners: [7],
    });
    harness.refreshTray();
    expect(harness.getTrayState()).toBe("recording-audio-lost");

    harness.forgetOwnerActivity(7, "pád rendereru");

    expect(harness.getTrayState()).toBe("recording");
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
    harness.applyReportedFacts(3, {
      signedIn: true,
      systemAudioLost: false,
      tracking: true,
    });
    expect(harness.getTrayState()).toBe("tracking");
    expect(harness.images.at(-1)).toBe("obrazek:tracking");
    expect(harness.tooltips.at(-1)).toBe("L·lutrack");
  });
});

describe("každá změna nahrávacího faktu lištu přepočítá", () => {
  // 🔴 Tenhle test vznikl z díry, kterou 92 zelených testů NEVIDĚLO: odvození stavu bylo
  // správné, jenže se po startu nahrávání nikdo nezeptal. Chybělo měřidlo ZAPOJENÍ.
  //
  // 🔴 A pak měl díru sám. Nezávislé review doložilo, že pátá položka měřila KOMENTÁŘ:
  // `indexOf("return recordingSession.finalizePromise;")` se trefil do dřívějšího
  // předčasného návratu a okno za ním uspokojila věta z komentáře, ve které se
  // `refreshTray()` jen jmenuje. Skutečné volání nebylo měřené vůbec — sabotáž, která ho
  // smazala, nechala všech 112 testů zelených.
  //
  // Proto se teď měří nad zdrojem BEZ celořádkových komentářů a každá položka říká,
  // na které straně mutace má přepočet stát.
  const kodBezKomentaru = mainCodeWithoutComments;

  const mutace = [
    { kotva: "recordingOwnersPreparing.set(ownerId, preparation);", strana: "za" },
    { kotva: "recordingSessions.set(sessionId, recordingSession);", strana: "za" },
    { kotva: "recordingOwnersPreparing.delete(ownerId);", strana: "za" },
    { kotva: "recordingSessions.delete(sessionId);", strana: "za" },
    // Přiřazení finalizePromise je okamžik, kdy session přestává být živé nahrávání.
    // Přepočet stojí PŘED návratem, a ten návrat je v souboru dvakrát — bereme poslední.
    { kotva: "return recordingSession.finalizePromise;", strana: "pred", posledni: true },
  ];

  it.each(mutace)("u „$kotva“ stojí refreshTray() $strana ní", ({ kotva, strana, posledni }) => {
    const index = posledni ? kodBezKomentaru.lastIndexOf(kotva) : kodBezKomentaru.indexOf(kotva);
    expect(index, `kotva se v main.cjs nenašla: ${kotva}`).toBeGreaterThan(-1);
    const okno = strana === "za"
      ? kodBezKomentaru.slice(index, index + kotva.length + 220)
      : kodBezKomentaru.slice(Math.max(0, index - 220), index);
    expect(okno).toContain("refreshTray()");
  });

  it("kotva pátého případu se v kódu vyskytuje víckrát — proto lastIndexOf", () => {
    // Kdyby ten předčasný návrat zmizel, `posledni: true` přestane být nutné a někdo by
    // ho mohl „uklidit". Tenhle test řekne, že nutné pořád je.
    const vyskytu = kodBezKomentaru.split("return recordingSession.finalizePromise;").length - 1;
    expect(vyskytu).toBeGreaterThan(1);
  });

  it("žádná mutace nezůstala nezmapovaná", () => {
    const vyskytu = (vzor) => kodBezKomentaru.split(vzor).length - 1;
    expect(vyskytu("recordingOwnersPreparing.set(")).toBe(1);
    expect(vyskytu("recordingOwnersPreparing.delete(")).toBe(1);
    expect(vyskytu("recordingSessions.set(")).toBe(1);
    expect(vyskytu("recordingSessions.delete(")).toBe(1);
    // Přiřazení finalizePromise chybělo v původním výčtu úplně.
    expect(vyskytu("recordingSession.finalizePromise = (async ()")).toBe(1);
    // 🔴 A `preparation.cancelled` taky. `hasLiveRecording()` čte ČTYŘI fakta, ne dvě:
    // kromě členství v obou mapách i zrušenou přípravu a rozběhnutou finalizaci. Kdyby
    // přibylo druhé místo, které přípravu ruší bez přepočtu, počitadlo nad samotným
    // členstvím by o tom mlčelo. Nález nezávislého review.
    expect(vyskytu("preparation.cancelled = ")).toBe(1);
  });

  it("zrušení přípravy lištu přepočítá — jen až za smyčkou, a to schválně", () => {
    // Tenhle případ ZÁMĚRNĚ není v okénkové kontrole výš: `preparation.cancelled = true`
    // stojí na začátku `finalizeRecordingSessionsForOwner`, ale `refreshTray()` musí přijít
    // až ZA smyčkou přes sessions — jinak by přepočet viděl stav, ve kterém část session
    // ještě nemá přiřazenou finalizaci. Měříme proto, že obojí je v TÉŽE funkci a ve
    // správném pořadí, ne že jsou vedle sebe.
    const telo = functionSource(mainCodeWithoutComments, "finalizeRecordingSessionsForOwner");
    const zruseni = telo.indexOf("preparation.cancelled = ");
    const prepocet = telo.lastIndexOf("refreshTray()");
    expect(zruseni, "zrušení přípravy se ve funkci nenašlo").toBeGreaterThan(-1);
    expect(prepocet, "přepočet se ve funkci nenašel").toBeGreaterThan(-1);
    expect(prepocet).toBeGreaterThan(zruseni);
  });
});

describe("kanál faktů nesmí být tray:set-state pod jiným jménem", () => {
  // 🔴 Nezávislé review našlo, že `Boolean(facts.signedIn)` a `if (facts.tracking)` berou
  // cokoli pravdivého. Renderer tím mohl protlačit doslovné jméno ikony (tracking:"tracking")
  // a prázdný objekt tiše přepsal přihlášení na false. To je přesně ten starý rozhodovací
  // kanál pod novým jménem — jen se to nepozná, protože se to tváří jako fakt.
  it("odmítne hodnotu, která není boolean, a fakta NECHÁ být", () => {
    const harness = trayHarness({ signedIn: true, trackingOwners: [] });
    harness.refreshTray();
    expect(harness.getTrayState()).toBe("idle");

    expect(harness.applyReportedFacts(1, {
      signedIn: true,
      systemAudioLost: false,
      tracking: "tracking",
    })).toBe(false);
    expect(harness.getTrayState()).toBe("idle");
  });

  it("prázdný objekt uživatele NEODHLÁSÍ", () => {
    const harness = trayHarness({ signedIn: true });
    harness.refreshTray();
    expect(harness.applyReportedFacts(1, {})).toBe(false);
    expect(harness.getTrayState()).toBe("idle");
  });

  it.each([
    [undefined], [null], ["idle"], [42],
    [{ signedIn: 1, systemAudioLost: false, tracking: false }],
    [{ signedIn: true }],
    [{ signedIn: true, tracking: false }],
    // Klíč navíc je pašerácký vektor: kdo umí přiložit `state`, přiloží i jméno ikony.
    // Přijímáme PRÁVĚ tři klíče, nic víc.
    [{ signedIn: true, systemAudioLost: false, tracking: false, state: "recording" }],
    [{ signedIn: true, systemAudioLost: false, tracking: false, icon: "recording" }],
  ])("odmítne %j a nechá fakta být", (payload) => {
    const harness = trayHarness({ signedIn: true });
    harness.refreshTray();
    expect(harness.applyReportedFacts(1, payload)).toBe(false);
    expect(harness.getTrayState()).toBe("idle");
  });

  it("platnou trojici boolean přijme", () => {
    const harness = trayHarness({ signedIn: false });
    harness.refreshTray();
    expect(harness.applyReportedFacts(1, {
      signedIn: true,
      systemAudioLost: false,
      tracking: true,
    })).toBe(true);
    expect(harness.getTrayState()).toBe("tracking");
  });

  it("výpadek přijme jen jako boolean, neplatný report stav nezmění a obnova vrátí nahrávání", () => {
    const harness = trayHarness({
      signedIn: true,
      preparing: [[1, { cancelled: false }]],
    });
    harness.refreshTray();
    expect(harness.getTrayState()).toBe("recording");

    expect(harness.applyReportedFacts(1, {
      signedIn: true,
      systemAudioLost: true,
      tracking: false,
    })).toBe(true);
    expect(harness.getTrayState()).toBe("recording-audio-lost");

    expect(harness.applyReportedFacts(1, {
      signedIn: true,
      systemAudioLost: "lost",
      tracking: false,
    })).toBe(false);
    expect(harness.getTrayState()).toBe("recording-audio-lost");

    expect(harness.applyReportedFacts(1, {
      signedIn: true,
      systemAudioLost: false,
      tracking: false,
    })).toBe(true);
    expect(harness.getTrayState()).toBe("recording");
  });
});

describe("první vykreslení lišty", () => {
  // 🔴 Review: při startu je odvozený stav i uložený stav „signed-out“, takže se refreshTray
  // ukončil PŘED setToolTip a popisek „LuDone · nepřihlášeno“ se nenastavil nikdy.
  it("nastaví obrázek i popisek, i když se stav nezměnil", () => {
    const harness = trayHarness({ signedIn: false });
    harness.refreshTray();
    expect(harness.images.at(-1)).toBe("obrazek:signed-out");
    expect(harness.tooltips.at(-1)).toBe("L·odhlášeno");
  });

  it("podruhé už na lištu nesahá", () => {
    const harness = trayHarness({ signedIn: false });
    harness.refreshTray();
    const po = harness.images.length;
    harness.refreshTray();
    expect(harness.images.length).toBe(po);
  });
});

describe("povolené klíče kanálu faktů", () => {
  it("jsou právě signedIn, systemAudioLost a tracking", () => {
    // Kdyby do nich někdo přidal třetí, protlačí jím rozhodnutí a testy výš by o tom mlčely,
    // protože si povolené klíče berou z produkce.
    expect([...reportedFactKeys].sort()).toEqual(["signedIn", "systemAudioLost", "tracking"]);
  });
});

describe("každá změna časovače lištu přepočítá z faktu hlavního procesu", () => {
  const unrelatedOwnerId = "renderer-window";

  it("běžící store drží stabilní vlastník mimo renderer a vždy volá refreshTray", () => {
    const source = functionSource(mainCodeWithoutComments, "syncTrackingTray");
    expect(source).toContain("appState.trackingOwners.add(TRACKING_STORE_OWNER_ID)");
    expect(source).toContain("appState.trackingOwners.delete(TRACKING_STORE_OWNER_ID)");
    expect(source).toContain("refreshTray()");
  });

  it.each([
    ["tracking:start", "start"],
    ["tracking:switch-project", "switchProject"],
    ["tracking:stop", "stop"],
    ["tracking:resolve-recovered", "resolveRecovered"],
  ])("kanál %s prochází společnou mutací %s", (channel, method) => {
    const start = mainCodeWithoutComments.indexOf(`handleValidated("${channel}"`);
    expect(start, `kanál ${channel} se v main.cjs nenašel`).toBeGreaterThan(-1);
    const registration = mainCodeWithoutComments.slice(start, start + 260);
    expect(registration).toContain(`runTrackingMutation("${method}"`);
  });

  it.each([
    [
      "start",
      { projectId: "projekt-a" },
      null,
      [unrelatedOwnerId],
      { state: TRACKING_STATES.RUNNING },
      [unrelatedOwnerId, trackingStoreOwnerId],
    ],
    [
      "switchProject",
      { projectId: "projekt-b" },
      { state: TRACKING_STATES.RUNNING },
      [unrelatedOwnerId, trackingStoreOwnerId],
      { state: TRACKING_STATES.RUNNING },
      [unrelatedOwnerId, trackingStoreOwnerId],
    ],
    [
      "stop",
      undefined,
      { state: TRACKING_STATES.RUNNING },
      [unrelatedOwnerId, trackingStoreOwnerId],
      null,
      [unrelatedOwnerId],
    ],
    [
      "resolveRecovered",
      { decision: "pokracovat" },
      { state: TRACKING_STATES.PENDING },
      [unrelatedOwnerId],
      { state: TRACKING_STATES.RUNNING },
      [unrelatedOwnerId, trackingStoreOwnerId],
    ],
  ])(
    "%s skutečně synchronizuje trackingOwners a právě jednou překreslí lištu",
    async (method, payload, initialEntry, initialOwners, nextEntry, expectedOwners) => {
      const harness = trackingMutationHarness({
        method,
        initialEntry,
        initialOwners,
        nextEntry,
      });

      const mutation = harness.runTrackingMutation(method, payload);
      await harness.mutationStarted;
      const refreshesBeforeMutationFinished = [...harness.refreshSnapshots];
      harness.releaseMutation();

      expect(refreshesBeforeMutationFinished).toEqual([]);
      await expect(mutation).resolves.toEqual({ method, payload });

      expect(harness.calls).toEqual([{ method, payload }]);
      expect([...harness.trackingOwners]).toEqual(expectedOwners);
      expect(harness.refreshSnapshots).toEqual([expectedOwners]);
    },
  );
});
