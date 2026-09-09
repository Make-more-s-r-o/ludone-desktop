import fs, { existsSync, readFileSync } from "node:fs";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Linter } from "eslint";
import { afterEach, describe, expect, it, vi } from "vitest";
import trackingModule from "../electron/tracking.cjs";

const {
  TRACKING_SAVED_LOG_PREFIX,
  TRACKING_STATES,
  TIME_DISABLED_REASON,
  createTrackingStore,
  floorToMinute,
  handleRendererGone,
} = trackingModule;

const GUID_A = "11111111-1111-4111-8111-111111111111";
const GUID_B = "22222222-2222-4222-8222-222222222222";
const ENTRY_ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENTRY_ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROCESS_A = "2026-09-01T06:20:11.004Z";
const PROCESS_B = "2026-09-01T12:00:00.000Z";
const CLOCK_ROLLBACK_ANOMALY = "wall-clock-moved-backward";
const temporaryRoots = [];
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

async function temporaryFile() {
  const root = await mkdtemp(path.join(os.tmpdir(), "ludone-tracking-test-"));
  temporaryRoots.push(root);
  return path.join(root, "cas", "casovac.json");
}

function ids(...values) {
  let index = 0;
  return () => values[index++] ?? ENTRY_ID_B;
}

function storeFor(filePath, overrides = {}) {
  return createTrackingStore({
    filePath,
    timeEnabled: "true",
    processStartedAt: PROCESS_A,
    now: () => Date.parse("2026-09-01T08:55:47.312Z"),
    newId: ids(ENTRY_ID_A, ENTRY_ID_B),
    log: () => {},
    ...overrides,
  });
}

async function onDisk(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
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

const mainCodeWithoutComments = withoutComments(readFileSync(
  new URL("../electron/main.cjs", import.meta.url),
  "utf8",
));
const createProductionTrackingStore = Function(
  "createTrackingStore",
  "path",
  "app",
  "process",
  "PROCESS_STARTED_AT",
  "applicationSettingsStore",
  `"use strict";
   let trackingStore;
   ${functionSource(mainCodeWithoutComments, "desktopKillswitch")}
   ${functionSource(mainCodeWithoutComments, "timeTrackingKillswitch")}
   ${functionSource(mainCodeWithoutComments, "getTrackingStore")}
   return getTrackingStore();`,
);

function storeFromProductionWiring(filePath, timeEnabled) {
  const environment = {};
  if (timeEnabled !== undefined) environment.DESKTOP_TIME_ENABLED = timeEnabled;
  const userDataPath = path.dirname(path.dirname(filePath));
  const createStore = vi.fn((deps) => createTrackingStore(deps));
  const store = createProductionTrackingStore(
    createStore,
    path,
    {
      getPath(name) {
        if (name !== "userData") throw new Error(`Neočekávaná cesta aplikace: ${name}`);
        return userDataPath;
      },
    },
    { env: environment },
    PROCESS_A,
    { get: () => false },
  );
  return { createStore, store };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("start a ořez času", () => {
  it("uloží klíč proti duplicitě před návratem ze startu", async () => {
    const filePath = await temporaryFile();
    const store = storeFor(filePath);
    const result = await store.start({ projectId: GUID_A });
    const saved = await onDisk(filePath);
    expect(result.entry.clientTimeEntryId).toMatch(/^[0-9a-f-]{36}$/);
    expect(saved.aktualni?.clientTimeEntryId).toBe(result.entry.clientTimeEntryId);
    expect(saved.aktualni.projectId).toBe(GUID_A);
  });

  it("ořezává dolů na celou minutu", () => {
    expect(floorToMinute("2026-09-01T08:55:47.312Z")).toBe("2026-09-01T08:55:00.000Z");
    expect(floorToMinute(Date.parse("2026-09-01T14:11:59.999Z")))
      .toBe("2026-09-01T14:11:00.000Z");
  });

  it("počítá minuty z ořezaných konců, ne ze surového rozdílu", async () => {
    const filePath = await temporaryFile();
    let current = Date.parse("2026-09-01T08:55:59.000Z");
    const store = storeFor(filePath, { now: () => current });
    await store.start({ projectId: GUID_A });
    current = Date.parse("2026-09-01T09:56:01.000Z");
    const result = await store.stop();
    expect(result.closed.startedAt).toBe("2026-09-01T08:55:00.000Z");
    expect(result.closed.endedAt).toBe("2026-09-01T09:56:00.000Z");
    expect(result.closed.minutes).toBe(61);
  });

  it("odmítne název, prázdný projekt i chybějící projekt", async () => {
    const filePath = await temporaryFile();
    const store = storeFor(filePath);
    await expect(store.start({ projectId: "LuDone Desktop" }))
      .rejects.toThrow("projectId musí být GUID projektu, ne název");
    await expect(store.start({ projectId: "" })).rejects.toThrow(TypeError);
    await expect(store.start({})).rejects.toThrow(TypeError);
  });

  it("nikdy nepersistuje sazbu, částku ani měnu z rendereru", async () => {
    const filePath = await temporaryFile();
    await storeFor(filePath).start({
      projectId: GUID_A,
      hourlyRate: 9_999,
      amount: 123_456,
      currency: "CZK",
    });
    const serialized = await readFile(filePath, "utf8");
    expect(serialized).not.toContain("hourlyRate");
    expect(serialized).not.toContain("amount");
    expect(serialized).not.toContain("currency");
  });

  it("druhý souběžný start je noop a první úsek neztratí", async () => {
    const filePath = await temporaryFile();
    const store = storeFor(filePath);
    const [first, second] = await Promise.all([
      store.start({ projectId: GUID_A }),
      store.start({ projectId: GUID_B }),
    ]);
    const saved = await onDisk(filePath);
    expect(first.outcome).toBe("started");
    expect(second.outcome).toBe("noop");
    expect(saved.uzavrene.length + (saved.aktualni ? 1 : 0)).toBe(1);
    expect(saved.aktualni.projectId).toBe(GUID_A);
  });
});

describe("stop a přepnutí projektu", () => {
  it("skok hodin zpět při stop uloží nulový kandidát s anomálií a ponechá ho k rozhodnutí", async () => {
    const filePath = await temporaryFile();
    let current = Date.parse("2026-09-01T08:55:47.312Z");
    const store = storeFor(filePath, { now: () => current });
    const started = await store.start({ projectId: GUID_A });
    current = Date.parse("2026-09-01T08:55:30.000Z");

    const result = await store.stop();
    const pendingOnDisk = await onDisk(filePath);
    expect(result).toMatchObject({
      outcome: "pending",
      entry: {
        clientTimeEntryId: started.entry.clientTimeEntryId,
        state: TRACKING_STATES.PENDING,
        endedAt: started.entry.startedAt,
        minutes: 0,
        clockAnomaly: CLOCK_ROLLBACK_ANOMALY,
      },
      closed: null,
    });
    expect(pendingOnDisk.aktualni).toEqual(result.entry);
    expect(pendingOnDisk.uzavrene, "nula se před rozhodnutím nesmí tiše započítat")
      .toHaveLength(0);

    const resolved = await store.resolveRecovered({
      decision: "ukoncit",
      endedAt: "2026-09-01T09:10:00.000Z",
    });
    expect(resolved.closed).toMatchObject({
      minutes: 15,
      clockAnomaly: CLOCK_ROLLBACK_ANOMALY,
    });
    expect((await onDisk(filePath)).uzavrene[0]).toEqual(resolved.closed);
  });

  it("historická anomálie po srovnání hodin nepovolí skutečně budoucí konec", async () => {
    const filePath = await temporaryFile();
    let current = Date.parse("2026-09-01T08:55:47.312Z");
    const store = storeFor(filePath, { now: () => current });
    await store.start({ projectId: GUID_A });
    current = Date.parse("2026-09-01T07:30:00.000Z");
    await store.stop();

    current = Date.parse("2026-09-01T10:00:00.000Z");
    await expect(store.resolveRecovered({
      decision: "ukoncit",
      endedAt: "2026-09-01T11:00:00.000Z",
    })).rejects.toThrow("endedAt nesmí být v budoucnosti");
    expect((await onDisk(filePath)).aktualni.state).toBe(TRACKING_STATES.PENDING);
  });

  it("skok hodin zpět při přepnutí nechá starý projekt čekat a nový tiše nespustí", async () => {
    const filePath = await temporaryFile();
    let current = Date.parse("2026-09-01T08:55:47.312Z");
    const store = storeFor(filePath, { now: () => current });
    const started = await store.start({ projectId: GUID_A });
    current = Date.parse("2026-09-01T07:30:00.000Z");

    const result = await store.switchProject({ projectId: GUID_B });
    const saved = await onDisk(filePath);
    expect(result).toMatchObject({
      outcome: "pending",
      entry: {
        clientTimeEntryId: started.entry.clientTimeEntryId,
        projectId: GUID_A,
        state: TRACKING_STATES.PENDING,
        endedAt: started.entry.startedAt,
        minutes: 0,
        clockAnomaly: CLOCK_ROLLBACK_ANOMALY,
      },
      closed: null,
    });
    expect(saved.aktualni).toEqual(result.entry);
    expect(saved.uzavrene).toHaveLength(0);
    expect(JSON.stringify(saved)).not.toContain(GUID_B);
  });

  it("normální běh se zastaví jako dřív a žádnou anomálii nezapíše", async () => {
    const filePath = await temporaryFile();
    let current = Date.parse("2026-09-01T08:55:59.000Z");
    const store = storeFor(filePath, { now: () => current });
    await store.start({ projectId: GUID_A });
    current = Date.parse("2026-09-01T09:56:01.000Z");

    const result = await store.stop();
    const saved = await onDisk(filePath);
    expect(result).toMatchObject({ outcome: "stopped", closed: { minutes: 61 } });
    expect(result.closed).not.toHaveProperty("clockAnomaly");
    expect(saved.uzavrene[0]).not.toHaveProperty("clockAnomaly");
    expect(saved.aktualni).toBeNull();
  });

  it("stop uloží uzavřený úsek na disk", async () => {
    const filePath = await temporaryFile();
    const store = storeFor(filePath);
    await store.start({ projectId: GUID_A });
    const result = await store.stop();
    const saved = await onDisk(filePath);
    expect(result.outcome).toBe("stopped");
    expect(saved.uzavrene).toHaveLength(1);
    expect(saved.uzavrene[0].closedReason).toBe("stop");
    expect(saved.aktualni).toBeNull();
  });

  it("přepnutí uloží starý projekt a nový nechá běžet bez mezery", async () => {
    const filePath = await temporaryFile();
    let current = Date.parse("2026-09-01T08:55:47.312Z");
    const store = storeFor(filePath, { now: () => current });
    await store.start({ projectId: GUID_A });
    current = Date.parse("2026-09-01T09:12:30.000Z");
    const result = await store.switchProject({ projectId: GUID_B });
    const saved = await onDisk(filePath);
    expect(result.outcome).toBe("switched");
    expect(result.closed.endedAt).toBe(result.entry.startedAt);
    expect(result.entry.clientTimeEntryId).not.toBe(result.closed.clientTimeEntryId);
    expect(saved.uzavrene[0].projectId).toBe(GUID_A);
    expect(result.closed).not.toHaveProperty("clockAnomaly");
    expect(result.entry).not.toHaveProperty("clockAnomaly");
    expect(saved.uzavrene[0]).not.toHaveProperty("clockAnomaly");
    expect(saved.aktualni).not.toHaveProperty("clockAnomaly");
    expect(saved.aktualni.projectId).toBe(GUID_B);
    expect(saved.aktualni.state).toBe(TRACKING_STATES.RUNNING);
  });

  it("stop bez běžícího časovače je noop a nezapisuje", async () => {
    const filePath = await temporaryFile();
    const result = await storeFor(filePath).stop();
    expect(result.outcome).toBe("noop");
    expect(existsSync(filePath)).toBe(false);
  });
});

describe("obnova po pádu", () => {
  it("ukončí obnovený úsek i když jsou nástěnné hodiny před jeho začátkem", async () => {
    const filePath = await temporaryFile();
    const first = storeFor(filePath);
    await first.start({ projectId: GUID_A });
    const second = storeFor(filePath, {
      processStartedAt: PROCESS_B,
      now: () => Date.parse("2026-09-01T07:00:00.000Z"),
    });

    const recovered = await second.load();
    expect(recovered.aktualni).toMatchObject({
      state: TRACKING_STATES.PENDING,
      endedAt: "2026-09-01T08:55:00.000Z",
      minutes: 0,
      clockAnomaly: CLOCK_ROLLBACK_ANOMALY,
    });
    expect((await onDisk(filePath)).aktualni).toEqual(recovered.aktualni);
    const resolved = await second.resolveRecovered({
      decision: "ukoncit",
      endedAt: "2026-09-01T09:30:00.000Z",
    });
    expect(resolved.closed).toMatchObject({
      minutes: 35,
      state: TRACKING_STATES.CLOSED,
      clockAnomaly: CLOCK_ROLLBACK_ANOMALY,
    });
    expect((await onDisk(filePath)).uzavrene[0]).toEqual(resolved.closed);
  });

  it("anomálii vzniklou až po načtení přenese rozhodnutí do uzavřeného úseku", async () => {
    const filePath = await temporaryFile();
    await storeFor(filePath).start({ projectId: GUID_A });
    let current = Date.parse("2026-09-01T10:00:00.000Z");
    const second = storeFor(filePath, {
      processStartedAt: PROCESS_B,
      now: () => current,
    });
    const recovered = await second.load();
    expect(recovered.aktualni).not.toHaveProperty("clockAnomaly");

    current = Date.parse("2026-09-01T08:55:30.000Z");
    await expect(second.resolveRecovered({
      decision: "ukoncit",
      endedAt: "2026-09-01T08:54:00.000Z",
    })).rejects.toThrow("endedAt nesmí být dřív než startedAt");
    expect((await onDisk(filePath)).aktualni).toMatchObject({
      endedAt: "2026-09-01T08:55:00.000Z",
      minutes: 0,
      clockAnomaly: CLOCK_ROLLBACK_ANOMALY,
    });

    current = Date.parse("2026-09-01T10:00:00.000Z");
    const resolved = await second.resolveRecovered({
      decision: "ukoncit",
      endedAt: "2026-09-01T09:30:00.000Z",
    });
    expect(resolved.closed).toMatchObject({
      minutes: 35,
      clockAnomaly: CLOCK_ROLLBACK_ANOMALY,
    });
    expect((await onDisk(filePath)).uzavrene[0]).toEqual(resolved.closed);
  });

  it("pokračování zachová anomálii a další stop ji tiše nezapočítá", async () => {
    const filePath = await temporaryFile();
    let current = Date.parse("2026-09-01T08:55:47.312Z");
    const store = storeFor(filePath, { now: () => current });
    await store.start({ projectId: GUID_A });
    current = Date.parse("2026-09-01T07:30:00.000Z");
    await store.stop();

    const continued = await store.resolveRecovered({ decision: "pokracovat" });
    expect(continued.entry).toMatchObject({
      state: TRACKING_STATES.RUNNING,
      clockAnomaly: CLOCK_ROLLBACK_ANOMALY,
    });
    expect(continued.entry).not.toHaveProperty("endedAt");
    expect(continued.entry).not.toHaveProperty("minutes");

    current = Date.parse("2026-09-01T10:00:00.000Z");
    const stoppedAgain = await store.stop();
    expect(stoppedAgain).toMatchObject({
      outcome: "pending",
      entry: {
        state: TRACKING_STATES.PENDING,
        minutes: 65,
        clockAnomaly: CLOCK_ROLLBACK_ANOMALY,
      },
      closed: null,
    });
    const saved = await onDisk(filePath);
    expect(saved.aktualni).toEqual(stoppedAgain.entry);
    expect(saved.uzavrene).toHaveLength(0);
  });

  it("opakované načtení nepřepíše už uložený pending kandidát", async () => {
    const filePath = await temporaryFile();
    let current = Date.parse("2026-09-01T08:55:47.312Z");
    const first = storeFor(filePath, { now: () => current });
    await first.start({ projectId: GUID_A });
    current = Date.parse("2026-09-01T07:30:00.000Z");
    await first.stop();
    await first.resolveRecovered({ decision: "pokracovat" });
    current = Date.parse("2026-09-01T10:00:00.000Z");
    await first.stop();
    const pendingBeforeReload = await onDisk(filePath);
    expect(pendingBeforeReload.aktualni).toMatchObject({
      endedAt: "2026-09-01T10:00:00.000Z",
      minutes: 65,
      clockAnomaly: CLOCK_ROLLBACK_ANOMALY,
    });

    current = Date.parse("2026-09-01T07:00:00.000Z");
    const second = storeFor(filePath, {
      processStartedAt: PROCESS_B,
      now: () => current,
    });
    const reloaded = await second.load();
    expect(reloaded).toEqual(pendingBeforeReload);
    expect(await onDisk(filePath)).toEqual(pendingBeforeReload);
  });

  it("po restartu procesu zachová klíč i začátek a čeká na rozhodnutí", async () => {
    const filePath = await temporaryFile();
    const first = storeFor(filePath);
    const started = await first.start({ projectId: GUID_A });
    expect(first.getState().aktualni.state, "kanárek: před pádem časovač opravdu běžel")
      .toBe(TRACKING_STATES.RUNNING);
    const second = storeFor(filePath, { processStartedAt: PROCESS_B });
    const recovered = await second.load();
    expect(recovered.aktualni.clientTimeEntryId).toBe(started.entry.clientTimeEntryId);
    expect(recovered.aktualni.startedAt).toBe(started.entry.startedAt);
    expect(recovered.aktualni.state).toBe(TRACKING_STATES.PENDING);
    expect(recovered.uzavrene).toHaveLength(0);
  });

  it("ve stejném procesu nechá časovač běžet", async () => {
    const filePath = await temporaryFile();
    const store = storeFor(filePath);
    await store.start({ projectId: GUID_A });
    expect((await store.load()).aktualni.state).toBe(TRACKING_STATES.RUNNING);
  });

  it("obnovu načte i s vypnutým vypínačem", async () => {
    const filePath = await temporaryFile();
    const started = await storeFor(filePath).start({ projectId: GUID_A });
    const disabled = storeFor(filePath, { timeEnabled: undefined, processStartedAt: PROCESS_B });
    expect((await disabled.load()).aktualni.clientTimeEntryId)
      .toBe(started.entry.clientTimeEntryId);
  });

  it("neexistující soubor vrátí prázdný stav a nic nezaloží", async () => {
    const filePath = await temporaryFile();
    const state = await storeFor(filePath).load();
    expect(state).toEqual({ schemaVersion: 1, aktualni: null, uzavrene: [] });
    expect(existsSync(filePath)).toBe(false);
  });

  it("rozbitý JSON ani jinou chybu čtení nepřevádí na prázdný stav", async () => {
    const filePath = await temporaryFile();
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "{rozbito", "utf8");
    await expect(storeFor(filePath).load()).rejects.toThrow(SyntaxError);
  });

  it("sémanticky poškozený běžící záznam odmítne místo jeho přepsání", async () => {
    const filePath = await temporaryFile();
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify({
      schemaVersion: 1,
      aktualni: { state: TRACKING_STATES.RUNNING },
      uzavrene: [],
    }), "utf8");
    await expect(storeFor(filePath).load())
      .rejects.toThrow("soubor časovače neodpovídá schématu v1");

    await writeFile(filePath, JSON.stringify({
      schemaVersion: 1,
      aktualni: {
        clientTimeEntryId: ENTRY_ID_A,
        projectId: GUID_A,
        startedAt: "2026-09-01T08:55:00.000Z",
        startedAtRaw: "2026-09-01T08:55:47.312Z",
        processStartedAt: PROCESS_A,
        note: null,
        state: TRACKING_STATES.PENDING,
        clockAnomaly: CLOCK_ROLLBACK_ANOMALY,
      },
      uzavrene: [],
    }), "utf8");
    await expect(storeFor(filePath).load())
      .rejects.toThrow("soubor časovače neodpovídá schématu v1");
  });

  it("pokračování zachová klíč i původní začátek", async () => {
    const filePath = await temporaryFile();
    const first = storeFor(filePath);
    const started = await first.start({ projectId: GUID_A });
    const second = storeFor(filePath, { processStartedAt: PROCESS_B });
    await second.load();
    const result = await second.resolveRecovered({ decision: "pokracovat" });
    expect(result.entry.clientTimeEntryId).toBe(started.entry.clientTimeEntryId);
    expect(result.entry.startedAt).toBe(started.entry.startedAt);
    expect(result.entry.state).toBe(TRACKING_STATES.RUNNING);
    expect((await onDisk(filePath)).aktualni.clientTimeEntryId)
      .toBe(started.entry.clientTimeEntryId);
  });

  it("ukončení po obnově uloží úsek na disk", async () => {
    const filePath = await temporaryFile();
    await storeFor(filePath).start({ projectId: GUID_A });
    const second = storeFor(filePath, {
      processStartedAt: PROCESS_B,
      now: () => Date.parse("2026-09-01T10:30:00.000Z"),
    });
    await second.load();
    const result = await second.resolveRecovered({
      decision: "ukoncit",
      endedAt: "2026-09-01T10:00:45.000Z",
    });
    const saved = await onDisk(filePath);
    expect(result.outcome).toBe("resolved");
    expect(saved.uzavrene).toHaveLength(1);
    expect(saved.uzavrene[0].closedReason).toBe("potvrzeno-po-obnove");
    expect(saved.aktualni).toBeNull();
  });

  it("odmítne chybějící, předčasný a budoucí endedAt", async () => {
    const filePath = await temporaryFile();
    await storeFor(filePath).start({ projectId: GUID_A });
    const second = storeFor(filePath, {
      processStartedAt: PROCESS_B,
      now: () => Date.parse("2026-09-01T10:00:00.000Z"),
    });
    await second.load();
    await expect(second.resolveRecovered({ decision: "ukoncit" }))
      .rejects.toThrow("endedAt musí být platná ISO značka");
    await expect(second.resolveRecovered({ decision: "ukoncit", endedAt: 1_788_264_000_000 }))
      .rejects.toThrow("endedAt musí být platná ISO značka");
    await expect(second.resolveRecovered({
      decision: "ukoncit",
      endedAt: "2026-09-01T07:00:00.000Z",
    })).rejects.toThrow("endedAt nesmí být dřív než startedAt");
    await expect(second.resolveRecovered({
      decision: "ukoncit",
      endedAt: "2026-09-01T11:00:00.000Z",
    })).rejects.toThrow("endedAt nesmí být v budoucnosti");
  });

  it("výslovné zahození zachová auditní stopu s nulou minut", async () => {
    const filePath = await temporaryFile();
    await storeFor(filePath).start({ projectId: GUID_A });
    const second = storeFor(filePath, { processStartedAt: PROCESS_B });
    await second.load();
    await second.resolveRecovered({ decision: "zahodit" });
    const saved = await onDisk(filePath);
    expect(saved.uzavrene[0]).toMatchObject({
      closedReason: "zahozeno-clovekem",
      minutes: 0,
    });
    expect(saved.aktualni).toBeNull();
  });

  it("obnova nemá výchozí rozhodnutí", async () => {
    const filePath = await temporaryFile();
    await storeFor(filePath).start({ projectId: GUID_A });
    const second = storeFor(filePath, { processStartedAt: PROCESS_B });
    await second.load();
    await expect(second.resolveRecovered({}))
      .rejects.toThrow("decision musí být pokracovat, ukoncit nebo zahodit");
  });
});

describe("vypínač DESKTOP_TIME_ENABLED", () => {
  it.each([undefined, "false", "1"])(
    "pro hodnotu %s fail-closed zakáže všechny zapisující metody",
    async (timeEnabled) => {
      const filePath = await temporaryFile();
      const store = storeFor(filePath, { timeEnabled });
      const calls = [
        () => store.start({ projectId: GUID_A }),
        () => store.switchProject({ projectId: GUID_B }),
        () => store.stop(),
        () => store.resolveRecovered({ decision: "zahodit" }),
      ];
      for (const call of calls) {
        await expect(call()).resolves.toMatchObject({
          outcome: "disabled",
          reason: TIME_DISABLED_REASON,
        });
      }
      expect(existsSync(filePath)).toBe(false);
    },
  );

  it.each([
    [undefined, "disabled"],
    ["false", "disabled"],
    ["TRUE", "disabled"],
    ["1", "disabled"],
    [" true ", "disabled"],
    ["true", "started"],
  ])(
    "produkční wiring s hodnotou %s skončí jako %s",
    async (timeEnabled, expectedOutcome) => {
      const filePath = await temporaryFile();
      const { createStore, store } = storeFromProductionWiring(filePath, timeEnabled);

      const result = await store.start({ projectId: GUID_A });

      expect(createStore).toHaveBeenCalledOnce();
      expect(createStore.mock.calls[0][0]).toMatchObject({
        filePath,
        processStartedAt: PROCESS_A,
        timeEnabled,
      });
      expect(result.outcome).toBe(expectedOutcome);
      expect(existsSync(filePath)).toBe(expectedOutcome === "started");
    },
  );
});

describe("atomická perzistence", () => {
  it("po úspěchu nezůstane temp a adresář založený kódem má 0700", async () => {
    const filePath = await temporaryFile();
    await storeFor(filePath).start({ projectId: GUID_A });
    const directory = path.dirname(filePath);
    expect((await readdir(directory)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
    expect((await stat(directory)).mode & 0o777).toBe(0o700);
  });

  it("selhání uprostřed zápisu zachová celý předchozí stav a uklidí temp", async () => {
    const filePath = await temporaryFile();
    let failWrites = false;
    const injectedFs = {
      promises: {
        ...fs.promises,
        async open(target, flags, mode) {
          const handle = await fs.promises.open(target, flags, mode);
          if (!String(target).endsWith(".tmp")) return handle;
          return new Proxy(handle, {
            get(value, property) {
              if (property === "writeFile" && failWrites) {
                return async () => { throw new Error("simulovaný plný disk"); };
              }
              const member = value[property];
              return typeof member === "function" ? member.bind(value) : member;
            },
          });
        },
      },
    };
    const store = storeFor(filePath, { fs: injectedFs });
    await store.start({ projectId: GUID_A });
    failWrites = true;
    await expect(store.stop()).rejects.toThrow("simulovaný plný disk");
    const saved = await onDisk(filePath);
    expect(saved.aktualni.clientTimeEntryId).toBe(ENTRY_ID_A);
    expect((await readdir(path.dirname(filePath))).filter((name) => name.endsWith(".tmp")))
      .toEqual([]);
  });

  it("atomický zápis casovac.json fsyncne data i adresář", async () => {
    const filePath = "/virtual/cas/casovac.json";
    const directory = path.dirname(filePath);
    const events = [];
    let temporaryPath;
    const unlink = vi.fn(async () => undefined);
    const observableStep = (name) => {
      events.push(`${name}:start`);
      return new Promise((resolve) => {
        setImmediate(() => {
          events.push(`${name}:done`);
          resolve(undefined);
        });
      });
    };
    const injectedFs = {
      promises: {
        async readFile(target, encoding) {
          expect(String(target)).toBe(filePath);
          expect(encoding).toBe("utf8");
          throw Object.assign(new Error("soubor neexistuje"), { code: "ENOENT" });
        },
        async mkdir(target, options) {
          expect(String(target)).toBe(directory);
          expect(options).toEqual({ recursive: true, mode: 0o700 });
        },
        async open(target, flags, mode) {
          const targetPath = String(target);
          if (flags === "wx") {
            temporaryPath = targetPath;
            expect(path.dirname(targetPath)).toBe(directory);
            expect(path.basename(targetPath)).toMatch(/^\.casovac\.json\..+\.tmp$/);
            expect(mode).toBe(0o600);
            return {
              writeFile(contents, encoding) {
                expect(encoding).toBe("utf8");
                expect(JSON.parse(contents)).toMatchObject({
                  schemaVersion: 1,
                  aktualni: {
                    projectId: GUID_A,
                    state: TRACKING_STATES.RUNNING,
                  },
                  uzavrene: [],
                });
                return observableStep("write:wx");
              },
              sync() { return observableStep("sync:wx"); },
              close() { return observableStep("close:wx"); },
            };
          }
          if (flags === "r") {
            expect(targetPath).toBe(directory);
            expect(mode).toBeUndefined();
            return {
              sync() { return observableStep("sync:r"); },
              close() { return observableStep("close:r"); },
            };
          }
          throw new Error(`Neočekávaný režim open: ${String(flags)}`);
        },
        rename(source, target) {
          expect(String(source)).toBe(temporaryPath);
          expect(String(target)).toBe(filePath);
          return observableStep("rename");
        },
        unlink,
      },
    };

    await storeFor(filePath, { fs: injectedFs }).start({ projectId: GUID_A });

    expect(unlink).not.toHaveBeenCalled();
    expect(events).toEqual([
      "write:wx:start",
      "write:wx:done",
      "sync:wx:start",
      "sync:wx:done",
      "close:wx:start",
      "close:wx:done",
      "rename:start",
      "rename:done",
      "sync:r:start",
      "sync:r:done",
      "close:r:start",
      "close:r:done",
    ]);
  });

  it("produkční zápis používá wx, fsync a rename až po fsync", () => {
    const source = withoutComments(
      readFileSync(new URL("../electron/tracking.cjs", import.meta.url), "utf8"),
    );
    const writer = functionSource(source, "writeStateAtomically");
    expect(writer).toContain("open(");
    expect(writer).toContain('"wx"');
    expect(writer).toContain(".sync()");
    expect(writer).toContain("rename(");
    expect(writer.indexOf("rename(")).toBeGreaterThan(writer.indexOf(".sync()"));
  });

  it("po úspěšném uložení zapíše kanárek", async () => {
    const filePath = await temporaryFile();
    const log = vi.fn();
    await storeFor(filePath, { log }).start({ projectId: GUID_A });
    expect(log.mock.calls.some(([line]) => line.startsWith(TRACKING_SAVED_LOG_PREFIX))).toBe(true);
  });
});

describe("pád rendereru", () => {
  it("prokazatelně běžící časovač nezastaví ani nezmění soubor", async () => {
    const filePath = await temporaryFile();
    const store = storeFor(filePath);
    await store.start({ projectId: GUID_A });
    expect(store.getState().aktualni.state, "kanárek: časovač před pádem běží")
      .toBe(TRACKING_STATES.RUNNING);
    const before = await readFile(filePath, "utf8");
    handleRendererGone(store, { log: () => {} });
    expect(await readFile(filePath, "utf8")).toBe(before);
    expect(store.getState().aktualni.state).toBe(TRACKING_STATES.RUNNING);
  });

  it("hook nevolá žádnou mutující metodu", () => {
    const source = withoutComments(
      readFileSync(new URL("../electron/tracking.cjs", import.meta.url), "utf8"),
    );
    const hook = functionSource(source, "handleRendererGone");
    for (const forbidden of ["stop(", "switchProject(", "resolveRecovered(", "writeStateAtomically("]) {
      expect(hook).not.toContain(forbidden);
    }
  });
});

describe("IPC povrch", () => {
  const mainSource = withoutComments(
    readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8"),
  );
  const preloadSource = withoutComments(
    readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8"),
  );

  it.each([
    ["tracking:start", '["panel"]'],
    ["tracking:switch-project", '["panel"]'],
    ["tracking:stop", '["panel"]'],
    ["tracking:get-state", '["panel", "settings"]'],
    ["tracking:resolve-recovered", '["panel"]'],
  ])("registruje %s výhradně přes handleValidated", (channel, allowedKinds) => {
    expect(mainSource).toContain(`handleValidated("${channel}", ${allowedKinds}`);
    expect(mainSource).not.toContain(`ipcMain.handle("${channel}"`);
  });

  it.each([
    ["startTracking", "tracking:start"],
    ["switchTrackingProject", "tracking:switch-project"],
    ["stopTracking", "tracking:stop"],
    ["getTrackingState", "tracking:get-state"],
    ["resolveRecoveredTracking", "tracking:resolve-recovered"],
  ])("preload vystavuje %s přes %s", (method, channel) => {
    expect(preloadSource).toContain(`${method}:`);
    expect(preloadSource).toContain(`ipcRenderer.invoke("${channel}"`);
  });

  it("tracking modul zůstává načitatelný bez Electronu", () => {
    const source = withoutComments(
      readFileSync(new URL("../electron/tracking.cjs", import.meta.url), "utf8"),
    );
    expect(source).not.toContain('require("electron")');
  });

  it("hlavní proces registruje nemutující hook na pád rendereru", () => {
    const hookStart = mainSource.indexOf('panelContents.on("render-process-gone", () =>');
    expect(hookStart).toBeGreaterThan(-1);
    expect(mainSource.slice(hookStart, hookStart + 180)).toContain("handleRendererGone(");
  });
});

describe("R22: klíč proti duplikaci musí být jedinečný i BEZ podstrčeného generátoru", () => {
  // 🔴 Tenhle test vznikl ze sabotáže, která zůstala ZELENÁ. Přepsal jsem produkční výchozí
  // `newId = randomUUID` na konstantu — tedy stav, kdy každý záznam nese TÝŽ klíč proti
  // duplikaci — a všech 158 testů prošlo. Důvod: každý test si `newId` podstrkuje, takže
  // produkční výchozí hodnota se nikdy nespustila. Test na různost klíčů měřil můj generátor,
  // ne kód. Na money cestě je to díra: duplicitní klíč znamená dvakrát vykázaný čas.
  it("dva starty za sebou dostanou různé klíče", async () => {
    const filePath = path.join(await mkdtemp(path.join(os.tmpdir(), "ludone-r22-")), "stav.json");
    // ŽÁDNÝ newId override — schválně. Tenhle test měří produkční `randomUUID`.
    const store = createTrackingStore({
      filePath,
      timeEnabled: "true",
      processStartedAt: PROCESS_A,
      log: () => {},
    });

    const prvni = await store.start({ projectId: GUID_A });
    const prvniKlic = prvni.entry?.clientTimeEntryId ?? (await onDisk(filePath)).aktualni.clientTimeEntryId;
    await store.stop();
    const druhy = await store.start({ projectId: GUID_A });
    const druhyKlic = druhy.entry?.clientTimeEntryId ?? (await onDisk(filePath)).aktualni.clientTimeEntryId;

    expect(prvniKlic).toBeTruthy();
    expect(druhyKlic).toBeTruthy();
    expect(druhyKlic).not.toBe(prvniKlic);
  });
});

describe("produkční výchozí hodnota času", () => {
  it("bez now override použije Date.now a nevymyslí anomálii", async () => {
    const filePath = await temporaryFile();
    const before = Date.now();
    const store = createTrackingStore({
      filePath,
      timeEnabled: "true",
      log: () => {},
    });

    const result = await store.start({ projectId: GUID_A });
    const after = Date.now();
    const startedAtRaw = Date.parse(result.entry.startedAtRaw);
    expect(startedAtRaw).toBeGreaterThanOrEqual(before);
    expect(startedAtRaw).toBeLessThanOrEqual(after);
    expect(result.entry.startedAt).toBe(floorToMinute(result.entry.startedAtRaw));
    expect(result.entry).not.toHaveProperty("clockAnomaly");
    expect((await onDisk(filePath)).aktualni).not.toHaveProperty("clockAnomaly");
  });
});
