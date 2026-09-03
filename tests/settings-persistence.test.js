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

async function temporarySettingsPath() {
  const root = await mkdtemp(path.join(tmpdir(), "ludone-settings-test-"));
  temporaryRoots.add(root);
  return path.join(root, "nastaveni", "aplikace.json");
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
