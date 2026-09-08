import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const temporaryRoots = new Set();

function loadSettingsModule() {
  return require("../electron/settings.cjs");
}

async function temporarySettingsPath(fileName = "aplikace.json") {
  const root = await mkdtemp(path.join(tmpdir(), "ludone-settings-test-"));
  temporaryRoots.add(root);
  return path.join(root, "nastaveni", fileName);
}

afterEach(async () => {
  await Promise.all([...temporaryRoots].map((root) => rm(root, { recursive: true, force: true })));
  temporaryRoots.clear();
});

describe("perzistence viditelnosti Docku", () => {
  it("bez souboru používá schválený bezpečný výchozí stav vypnuto", async () => {
    const { createDockVisibilityStore } = loadSettingsModule();
    const filePath = await temporarySettingsPath();

    const store = createDockVisibilityStore({ filePath, log: vi.fn() });

    expect(store.get()).toBe(false);
  });

  it("atomický zápis přežije novou instanci hlavního procesu", async () => {
    const { createDockVisibilityStore } = loadSettingsModule();
    const filePath = await temporarySettingsPath();
    const firstProcess = createDockVisibilityStore({ filePath, log: vi.fn() });

    await expect(firstProcess.set(true)).resolves.toBe(true);

    const secondProcess = createDockVisibilityStore({ filePath, log: vi.fn() });
    expect(secondProcess.get()).toBe(true);
    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({
      schemaVersion: 1,
      dockVisible: true,
    });
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    expect(await readdir(path.dirname(filePath))).toEqual(["aplikace.json"]);

    await expect(secondProcess.set(false)).resolves.toBe(false);
    const thirdProcess = createDockVisibilityStore({ filePath, log: vi.fn() });
    expect(thirdProcess.get()).toBe(false);
    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({
      schemaVersion: 1,
      dockVisible: false,
    });
  });

  it("poškozený nebo typově neplatný soubor nezapne Dock a setter přijme jen boolean", async () => {
    const { createDockVisibilityStore } = loadSettingsModule();
    const filePath = await temporarySettingsPath();
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify({ schemaVersion: 1, dockVisible: "true" }));

    const store = createDockVisibilityStore({ filePath, log: vi.fn() });

    expect(store.get()).toBe(false);
    await expect(Promise.resolve().then(() => store.set("true"))).rejects.toThrow(/boolean/u);
    expect(store.get()).toBe(false);
  });
});

describe("perzistence prostředí LuDone", () => {
  const PRODUCTION_ORIGIN = "https://app.ludone.cz";
  const LABS_ORIGIN = "https://labs.ludone.cz";

  it("povoluje přesně produkci a labs a seznam nejde rozšířit za běhu", () => {
    const { AUTH_ORIGINS } = loadSettingsModule();

    expect(AUTH_ORIGINS).toEqual([PRODUCTION_ORIGIN, LABS_ORIGIN]);
    expect(Object.isFrozen(AUTH_ORIGINS)).toBe(true);
  });

  it("atomický zápis přežije novou instanci hlavního procesu", async () => {
    const { createAuthOriginStore } = loadSettingsModule();
    const filePath = await temporarySettingsPath("prostredi.json");
    const firstProcess = createAuthOriginStore({ filePath, log: vi.fn() });

    expect(firstProcess.get()).toBe(PRODUCTION_ORIGIN);
    await expect(firstProcess.set(LABS_ORIGIN)).resolves.toBe(LABS_ORIGIN);

    const secondProcess = createAuthOriginStore({ filePath, log: vi.fn() });
    expect(secondProcess.get()).toBe(LABS_ORIGIN);
    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({
      schemaVersion: 1,
      authOrigin: LABS_ORIGIN,
    });
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    expect(await readdir(path.dirname(filePath))).toEqual(["prostredi.json"]);
  });

  it.each([
    "https://utocnik.example",
    "http://labs.ludone.cz",
    "https://labs.ludone.cz/",
    "labs.ludone.cz",
    "",
    42,
    null,
  ])("cizí hodnotu %j odmítne a ponechá poslední prostředí", async (foreignOrigin) => {
    const { createAuthOriginStore } = loadSettingsModule();
    const filePath = await temporarySettingsPath("prostredi.json");
    const store = createAuthOriginStore({ filePath, log: vi.fn() });
    await store.set(LABS_ORIGIN);

    await expect(Promise.resolve().then(() => store.set(foreignOrigin)))
      .rejects.toThrow(/prostředí|origin/u);
    expect(store.get()).toBe(LABS_ORIGIN);
    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({
      schemaVersion: 1,
      authOrigin: LABS_ORIGIN,
    });
  });
});

describe("perzistence vypínačů odesílání ve společném nastavení", () => {
  it("bez souboru jsou oba vypínače vypnuté a čtení žádný soubor nevytvoří", async () => {
    const { createApplicationSettingsStore } = loadSettingsModule();
    const filePath = await temporarySettingsPath();
    const store = createApplicationSettingsStore({ filePath, log: vi.fn() });

    expect(store.get("uploadEnabled")).toBe(false);
    expect(store.get("timeEnabled")).toBe(false);
    await expect(readFile(filePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("zápisy vypínačů a Docku se zachovají navzájem a přežijí restart", async () => {
    const { createApplicationSettingsStore, createDockVisibilityStore } = loadSettingsModule();
    const filePath = await temporarySettingsPath();
    const firstProcess = createApplicationSettingsStore({ filePath, log: vi.fn() });
    const dock = createDockVisibilityStore({ settingsStore: firstProcess });

    await expect(firstProcess.set("uploadEnabled", true)).resolves.toBe(true);
    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({
      schemaVersion: 1, uploadEnabled: true,
    });
    await expect(dock.set(true)).resolves.toBe(true);
    await expect(firstProcess.set("timeEnabled", true)).resolves.toBe(true);
    await expect(dock.set(false)).resolves.toBe(false);

    const secondProcess = createApplicationSettingsStore({ filePath, log: vi.fn() });
    expect(secondProcess.get("uploadEnabled")).toBe(true);
    expect(secondProcess.get("timeEnabled")).toBe(true);
    expect(secondProcess.get("dockVisible")).toBe(false);
    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({
      schemaVersion: 1, dockVisible: false, uploadEnabled: true, timeEnabled: true,
    });
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    expect(await readdir(path.dirname(filePath))).toEqual(["aplikace.json"]);

    await secondProcess.set("uploadEnabled", false);
    await secondProcess.set("timeEnabled", false);
    const thirdProcess = createApplicationSettingsStore({ filePath, log: vi.fn() });
    expect(thirdProcess.get("uploadEnabled")).toBe(false);
    expect(thirdProcess.get("timeEnabled")).toBe(false);
  });

  it.each([
    "{poškozený JSON",
    "null",
    "true",
    "[]",
    JSON.stringify({ schemaVersion: 2, uploadEnabled: true, timeEnabled: true }),
    ...["true", "false", 1, 0, null, [], {}, { enabled: true }].map((value) => (
      JSON.stringify({ schemaVersion: 1, uploadEnabled: value, timeEnabled: value })
    )),
    JSON.stringify({ schemaVersion: 1, dockVisible: true }),
  ])("neplatné nebo starší nastavení %s nechá vypínače vypnuté bez přepisu", async (contents) => {
    const { createApplicationSettingsStore } = loadSettingsModule();
    const filePath = await temporarySettingsPath();
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);

    const store = createApplicationSettingsStore({ filePath, log: vi.fn() });

    expect(store.get("uploadEnabled")).toBe(false);
    expect(store.get("timeEnabled")).toBe(false);
    expect(await readFile(filePath, "utf8")).toBe(contents);
  });

  it("neplatný zápis ani chyba disku nezmění účinnou hodnotu", async () => {
    const { createApplicationSettingsStore } = loadSettingsModule();
    const filePath = await temporarySettingsPath();
    const store = createApplicationSettingsStore({ filePath, log: vi.fn() });

    for (const key of ["uploadEnabled", "timeEnabled"]) {
      await expect(store.set(key, "true")).rejects.toThrow(/boolean/u);
      expect(store.get(key)).toBe(false);
    }
    await expect(store.set("neznamaVolba", true)).rejects.toThrow(/Neznámý/u);
    await expect(readFile(filePath)).rejects.toMatchObject({ code: "ENOENT" });

    // Adresář místo cílového souboru vynutí skutečné selhání atomického přejmenování.
    await mkdir(filePath, { recursive: true });
    for (const key of ["uploadEnabled", "timeEnabled"]) {
      await expect(store.set(key, true)).rejects.toThrow();
      expect(store.get(key)).toBe(false);
    }
    expect(await readdir(path.dirname(filePath))).toEqual(["aplikace.json"]);
  });
});
