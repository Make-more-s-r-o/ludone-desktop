import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

function sourceWithoutComments(source) {
  return source.replace(
    /("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,
    (match, literal) => literal ?? "",
  );
}

function functionSource(source, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const declarations = [...source.matchAll(new RegExp(
    `^\\s*(?:async\\s+)?function\\s+${escapedName}\\s*\\(`,
    "gm",
  ))];
  if (declarations.length !== 1) {
    throw new Error(`Funkce ${name} musí mít právě jednu deklaraci, nalezeno ${declarations.length}`);
  }
  const declaration = declarations[0];
  const start = declaration.index + declaration[0].indexOf("function");

  const openingBrace = source.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Funkce ${name} nemá uzavřené tělo`);
}

const mainUrl = new URL("../electron/main.cjs", import.meta.url);
const mainSource = readFileSync(mainUrl, "utf8");
const modulePromiseDeclarations = `const manifestModulePromise = import(
  pathToFileURL(path.join(PROJECT_ROOT, "src", "lib", "manifest.js")).href
);
const queueModulePromise = import(
  pathToFileURL(path.join(PROJECT_ROOT, "src", "lib", "queue.js")).href
);`;
if (!mainSource.includes(modulePromiseDeclarations)) {
  throw new Error("main.cjs nemá očekávané deklarace modulů manifestu a fronty");
}
const executableMainSource = mainSource.replace(
  modulePromiseDeclarations,
  `const manifestModulePromise = injectedManifestModulePromise;
const queueModulePromise = injectedQueueModulePromise;`,
);
const preloadSource = readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8");
const queueStoreSource = readFileSync(new URL("../electron/queue.cjs", import.meta.url), "utf8");
const mainCode = sourceWithoutComments(mainSource);
const preloadCode = sourceWithoutComments(preloadSource);
const queueStoreCode = sourceWithoutComments(queueStoreSource);
const mainFilename = fileURLToPath(mainUrl);
const mainDirectory = path.dirname(mainFilename);
const actualRequire = createRequire(mainUrl);
const temporaryRoots = new Set();
const RETENTION_STORAGE_KEY = "ludone.prototype.settings";

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all([...temporaryRoots].map((root) => (
    rm(root, { recursive: true, force: true })
  )));
  temporaryRoots.clear();
});

function fakeElectron(userDataPath, {
  deferPanelLoad = false,
  deferSettingsRead = false,
  navigateDuringSettingsRead = false,
  storedSettings = null,
  settingsReadError = null,
} = {}) {
  const ipcHandlers = new Map();
  const ipcListeners = new Map();
  const windows = [];
  let readyCallback;
  let nextWebContentsId = 1;
  let pendingPanelLoad;
  let reportSettingsReadStarted;
  const settingsReadStarted = new Promise((resolve) => {
    reportSettingsReadStarted = resolve;
  });

  class FakeWebContents extends EventEmitter {
    constructor(id) {
      super();
      this.id = id;
      this.mainFrame = { url: "ludone://app/index.html" };
      this.pageLoaded = false;
      this.destroyed = false;
      this.localStorage = new Map();
      this.executeJavaScript = vi.fn(async (source) => {
        reportSettingsReadStarted(undefined);
        if (!this.pageLoaded) return null;
        if (settingsReadError) throw settingsReadError;
        const expectedSource = `window.localStorage.getItem(${JSON.stringify(RETENTION_STORAGE_KEY)})`;
        if (source !== expectedSource) throw new Error(`Neočekávaný skript rendereru: ${source}`);
        if (navigateDuringSettingsRead) this.mainFrame.url = "https://neduveryhodny.example/";
        if (deferSettingsRead) return new Promise(() => {});
        return this.localStorage.get(RETENTION_STORAGE_KEY) ?? null;
      });
    }

    finishLoad() {
      if (storedSettings !== null) {
        this.localStorage.set(RETENTION_STORAGE_KEY, storedSettings);
      }
      this.pageLoaded = true;
      this.emit("did-finish-load");
    }

    destroy() {
      this.destroyed = true;
      this.emit("destroyed");
    }

    getURL() { return this.mainFrame.url; }
    isDestroyed() { return this.destroyed; }
  }

  class FakeBrowserWindow extends EventEmitter {
    constructor() {
      super();
      this.visible = false;
      this.destroyed = false;
      const contents = new FakeWebContents(nextWebContentsId);
      nextWebContentsId += 1;
      this.webContents = contents;
      windows.push(this);
    }

    loadFile(filePath) {
      this.webContents.mainFrame.url = pathToFileURL(filePath).toString();
      if (deferPanelLoad && windows[0] === this) {
        return new Promise((resolve, reject) => {
          pendingPanelLoad = {
            finish: () => {
              this.webContents.finishLoad();
              resolve(undefined);
            },
            reject,
          };
        });
      }
      this.webContents.finishLoad();
      return Promise.resolve();
    }

    isDestroyed() { return this.destroyed; }
    isVisible() { return this.visible; }
    show() { this.visible = true; }
    hide() { this.visible = false; }
    focus() {}
    close() { this.emit("closed"); }
    setPosition() {}
  }

  class FakeTray extends EventEmitter {
    setTitle() {}
    setImage() {}
    setToolTip() {}
    getBounds() { return { x: 0, y: 0, width: 18, height: 18 }; }
  }

  const app = Object.assign(new EventEmitter(), {
    commandLine: { appendSwitch: vi.fn() },
    dock: { hide: vi.fn() },
    getPath: vi.fn(() => userDataPath),
    quit: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true),
    setAppLogsPath: vi.fn(),
    setName: vi.fn(),
    setPath: vi.fn(),
    whenReady: vi.fn(() => ({
      then(callback) {
        readyCallback = callback;
        return Promise.resolve();
      },
    })),
  });

  const electron = {
    app,
    BrowserWindow: FakeBrowserWindow,
    desktopCapturer: { getSources: vi.fn(async () => []) },
    ipcMain: {
      handle: vi.fn((channel, handler) => ipcHandlers.set(channel, handler)),
      on: vi.fn((channel, handler) => ipcListeners.set(channel, handler)),
    },
    nativeImage: {
      createFromDataURL: vi.fn(() => ({ resize() { return this; } })),
    },
    net: { fetch: vi.fn() },
    protocol: {
      handle: vi.fn(),
      registerSchemesAsPrivileged: vi.fn(),
    },
    screen: {
      getDisplayNearestPoint: vi.fn(() => ({
        workArea: { x: 0, y: 0, width: 1_440, height: 900 },
      })),
    },
    session: {
      defaultSession: {
        setDisplayMediaRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
        setPermissionRequestHandler: vi.fn(),
      },
    },
    shell: { openExternal: vi.fn(async () => undefined) },
    systemPreferences: {
      askForMediaAccess: vi.fn(async () => false),
      getMediaAccessStatus: vi.fn(() => "denied"),
    },
    Tray: FakeTray,
  };

  return {
    electron,
    ipcHandlers,
    settingsReadStarted,
    windows,
    finishPanelLoad() {
      if (!pendingPanelLoad) throw new Error("Panel nemá čekající načtení");
      pendingPanelLoad.finish();
      pendingPanelLoad = undefined;
    },
    failPanelLoad(error) {
      if (!pendingPanelLoad) throw new Error("Panel nemá čekající načtení");
      pendingPanelLoad.reject(error);
      pendingPanelLoad = undefined;
    },
    closePanelBeforeLoad() {
      if (!pendingPanelLoad) throw new Error("Panel nemá čekající načtení");
      windows[0].destroyed = true;
      windows[0].emit("closed");
    },
    destroyPanelRendererBeforeLoad() {
      if (!pendingPanelLoad) throw new Error("Panel nemá čekající načtení");
      windows[0].webContents.destroy();
    },
    async runReady() {
      if (!readyCallback) throw new Error("main.cjs nezaregistroval app.whenReady callback");
      await readyCallback();
      await Promise.resolve();
    },
  };
}

/**
 * @param {{
 *   applyRetention?: (...args: any[]) => Promise<any>,
 *   createOutboundQueueStore?: (...args: any[]) => any,
 *   deferPanelLoad?: boolean,
 *   deferSettingsRead?: boolean,
 *   env?: Record<string, string | undefined>,
 *   loadQueue?: (...args: any[]) => Promise<any>,
 *   navigateDuringSettingsRead?: boolean,
 *   settingsReadError?: Error | null,
 *   storedSettings?: string | null,
 * }} [options]
 */
async function loadMain({
  applyRetention,
  createOutboundQueueStore,
  deferPanelLoad = false,
  deferSettingsRead = false,
  env = {},
  loadQueue,
  navigateDuringSettingsRead = false,
  settingsReadError = null,
  storedSettings = null,
} = {}) {
  const userDataPath = await mkdtemp(path.join(tmpdir(), "ludone-main-queue-test-"));
  temporaryRoots.add(userDataPath);
  const harness = fakeElectron(userDataPath, {
    deferPanelLoad,
    deferSettingsRead,
    navigateDuringSettingsRead,
    storedSettings,
    settingsReadError,
  });
  const queueStoreModule = actualRequire("./queue.cjs");
  const retentionModule = actualRequire("./retention.cjs");
  const injectedRequire = (specifier) => {
    if (specifier === "electron") return harness.electron;
    if (specifier === "./queue.cjs" && (createOutboundQueueStore || loadQueue)) {
      return {
        ...queueStoreModule,
        ...(createOutboundQueueStore ? { createOutboundQueueStore } : {}),
        ...(loadQueue ? { loadQueue } : {}),
      };
    }
    if (specifier === "./retention.cjs" && applyRetention) {
      return { ...retentionModule, applyRetention };
    }
    return actualRequire(specifier);
  };
  const loadedModule = { exports: {} };
  const quietConsole = { error: vi.fn(), log: vi.fn(), warn: vi.fn() };
  const evaluateMain = Function(
    "require",
    "module",
    "exports",
    "__filename",
    "__dirname",
    "console",
    "process",
    "injectedManifestModulePromise",
    "injectedQueueModulePromise",
    `"use strict";\n${executableMainSource}`,
  );
  evaluateMain(
    injectedRequire,
    loadedModule,
    loadedModule.exports,
    mainFilename,
    mainDirectory,
    quietConsole,
    {
      env: {
        ...process.env,
        DESKTOP_TIME_ENABLED: undefined,
        DESKTOP_UPLOAD_ENABLED: undefined,
        LUDONE_DATA_DIR: undefined,
        ...env,
      },
      platform: process.platform,
    },
    import("../src/lib/manifest.js"),
    import("../src/lib/queue.js"),
  );
  return { ...harness, quietConsole, userDataPath };
}

const DAY_MS = 24 * 60 * 60 * 1_000;
const PROJECT_A = "865a78f8-b47f-4bb8-8b34-f4ec07f6f516";

async function writeOldSentRecording(userDataPath) {
  const queuePath = path.join(userDataPath, "queue", "outgoing.json");
  const recordingsPath = path.join(userDataPath, "nahravky");
  const microphonePath = path.join(recordingsPath, "stara-mikrofon.webm");
  const systemPath = path.join(recordingsPath, "stara-system.webm");
  await mkdir(path.dirname(queuePath), { recursive: true });
  await mkdir(recordingsPath, { recursive: true });
  await Promise.all([
    writeFile(microphonePath, "mikrofon"),
    writeFile(systemPath, "system"),
  ]);
  await writeFile(queuePath, JSON.stringify({
    schemaVersion: 1,
    items: [{
      attempts: 1,
      clientRecordingId: "8241f325-a970-4f36-a2e4-9b7812e4ae24",
      enqueuedAt: new Date(Date.now() - 9 * DAY_MS).toISOString(),
      kind: "recording",
      lastFailureReason: null,
      manifestPath: path.join(recordingsPath, "stara.manifest.json"),
      nextAttemptAt: null,
      sentAt: new Date(Date.now() - 8 * DAY_MS).toISOString(),
      server: {
        recordingId: "server-recording",
        uploadedBytes: { microphone: 8, system: 6 },
      },
      state: "odeslano",
      tracks: { microphone: microphonePath, system: systemPath },
    }],
  }));
  return { microphonePath, queuePath, systemPath };
}

async function fileExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function waitForQueuePump(harness) {
  await vi.waitFor(() => {
    expect(harness.quietConsole.log.mock.calls.some(
      ([message]) => typeof message === "string" && message.startsWith("[queue] "),
    )).toBe(true);
  });
}

describe("produkční zapojení odchozí fronty", () => {
  it("hlavní proces načítá modul fronty ze src/lib", () => {
    expect(mainCode).toContain('path.join(PROJECT_ROOT, "src", "lib", "queue.js")');
  });

  it("dokončení nahrávky zařazuje do fronty", () => {
    expect(mainCode).toContain(
      'handleValidated("recording:finish", ["panel"], finishRecordingAndEnqueue)',
    );
    const finish = functionSource(mainCode, "finishRecordingAndEnqueue");
    expect(finish).toContain("ownedRecordingSession");
    expect(finish).toContain("finalizeRecordingSession");
    expect(finish).toContain("enqueueRecording");
    expect(finish.indexOf("enqueueRecording")).toBeGreaterThan(
      finish.indexOf("finalizeRecordingSession"),
    );
    expect(finish).not.toContain("pumpOutboundQueue");
  });

  it("po startu aplikace proběhne pumpa produkční fronty bez testového override", () => {
    const ready = mainCode.slice(mainCode.indexOf("app.whenReady()"));
    expect(ready.slice(0, 1_500)).toContain("pumpOutboundQueue()");
    expect(functionSource(mainCode, "pumpOutboundQueue")).toContain(".pump(");
    expect(queueStoreCode).toContain("queueModule.processNext");
  });

  it("produkční odesílací vrstva je pouze pauza a nevolá server", () => {
    const unavailableSend = functionSource(mainCode, "unavailableQueueSend");
    expect(unavailableSend).toContain('failureClass = "paused"');
    expect(unavailableSend).not.toMatch(/fetch|https?:\/\//);
  });

  it("preload vystavuje oba validační kanály fronty", () => {
    expect(preloadCode).toContain('ipcRenderer.invoke("queue:list")');
    expect(preloadCode).toContain('ipcRenderer.invoke("queue:retry")');
  });

  it("IPC fronty používá předepsané role odesílatele", () => {
    expect(mainCode).toContain('handleValidated("queue:list", ["panel", "settings"]');
    expect(mainCode).toContain('handleValidated("queue:retry", ["panel"]');
  });

  it("zaregistrované dokončení nahrávky ji zpřístupní přes queue:list", async () => {
    const harness = await loadMain();
    await harness.runReady();
    const panelContents = harness.windows[0].webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };
    const begin = harness.ipcHandlers.get("recording:begin");
    const finish = harness.ipcHandlers.get("recording:finish");
    const list = harness.ipcHandlers.get("queue:list");

    const { sessionId } = await begin(event);
    await finish(event, sessionId);

    expect(await list(event)).toEqual([
      expect.objectContaining({
        id: sessionId,
        kind: "recording",
        state: "ceka",
        attempts: 0,
      }),
    ]);
  });

  it("start aplikace zavolá pumpu fronty právě jednou", async () => {
    const pump = vi.fn().mockResolvedValue({ outcome: "idle" });
    const createOutboundQueueStore = vi.fn(() => ({
      enqueueRecording: vi.fn(),
      list: vi.fn(),
      pump,
      retry: vi.fn(),
    }));
    const harness = await loadMain({ createOutboundQueueStore });

    expect(pump).toHaveBeenCalledTimes(0);
    await harness.runReady();
    expect(createOutboundQueueStore).toHaveBeenCalledTimes(1);
    expect(pump).toHaveBeenCalledTimes(1);
  });

  it("po trvalém uzavření časovače zařadí přes produkční store přesný časový záznam", async () => {
    let harness;
    let stateSeenDuringEnqueue;
    const queueStoreModule = actualRequire("./queue.cjs");
    const enqueueTimeEntry = vi.fn();
    const createOutboundQueueStore = vi.fn((deps) => {
      const store = queueStoreModule.createOutboundQueueStore(deps);
      enqueueTimeEntry.mockImplementation(async (entry) => {
        stateSeenDuringEnqueue = JSON.parse(readFileSync(
          path.join(harness.userDataPath, "cas", "casovac.json"),
          "utf8",
        ));
        return store.enqueueTimeEntry(entry);
      });
      return { ...store, enqueueTimeEntry };
    });
    harness = await loadMain({
      createOutboundQueueStore,
      env: { DESKTOP_TIME_ENABLED: "true" },
    });
    await harness.runReady();
    const panelContents = harness.windows[0].webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };

    const started = await harness.ipcHandlers.get("tracking:start")(event, {
      projectId: PROJECT_A,
      note: "Fakturovatelná práce",
    });
    const stopped = await harness.ipcHandlers.get("tracking:stop")(event);

    expect(stopped.outcome).toBe("stopped");
    expect(stateSeenDuringEnqueue).toMatchObject({
      aktualni: null,
      uzavrene: [expect.objectContaining({
        clientTimeEntryId: started.entry.clientTimeEntryId,
        state: "uzavreno",
      })],
    });
    expect(enqueueTimeEntry).toHaveBeenCalledExactlyOnceWith({
      clientTimeEntryId: started.entry.clientTimeEntryId,
      projectId: PROJECT_A,
      startedAt: stopped.closed.startedAt,
      endedAt: stopped.closed.endedAt,
    });
    await expect(harness.ipcHandlers.get("queue:list")(event)).resolves.toEqual([
      expect.objectContaining({
        attempts: 0,
        id: started.entry.clientTimeEntryId,
        kind: "time",
        state: "ceka",
      }),
    ]);
  });

  it.each([undefined, "false", "1"])(
    "při DESKTOP_TIME_ENABLED=%s nezařadí žádný časový záznam",
    async (timeEnabled) => {
      const enqueueTimeEntry = vi.fn();
      const createOutboundQueueStore = vi.fn(() => ({
        enqueueRecording: vi.fn(),
        enqueueTimeEntry,
        list: vi.fn(async () => []),
        pump: vi.fn(async () => ({ outcome: "idle" })),
        retry: vi.fn(),
      }));
      const harness = await loadMain({
        createOutboundQueueStore,
        env: { DESKTOP_TIME_ENABLED: timeEnabled },
      });
      await harness.runReady();
      const panelContents = harness.windows[0].webContents;
      const event = { sender: panelContents, senderFrame: panelContents.mainFrame };

      await expect(harness.ipcHandlers.get("tracking:start")(event, {
        projectId: PROJECT_A,
      })).resolves.toMatchObject({ outcome: "disabled" });
      await expect(harness.ipcHandlers.get("tracking:stop")(event))
        .resolves.toMatchObject({ outcome: "disabled" });
      expect(enqueueTimeEntry).not.toHaveBeenCalled();
    },
  );

  it("při startu použije uložený sedmidenní výběr a odstraní starou odeslanou kopii", async () => {
    const harness = await loadMain({
      storedSettings: JSON.stringify({ retention: "7 dní po odeslání" }),
    });
    const fixture = await writeOldSentRecording(harness.userDataPath);

    await harness.runReady();
    await waitForQueuePump(harness);

    expect(harness.windows[0].webContents.executeJavaScript).toHaveBeenCalledWith(
      'window.localStorage.getItem("ludone.prototype.settings")',
      true,
    );
    expect(await fileExists(fixture.microphonePath)).toBe(false);
    expect(await fileExists(fixture.systemPath)).toBe(false);
    await expect(readFile(fixture.queuePath, "utf8").then(JSON.parse))
      .resolves.toEqual({ schemaVersion: 1, items: [] });
  });

  it("při startu čeká s retenčním čtením na skutečné dokončení loadFile", async () => {
    let storedQueue;
    const loadQueue = vi.fn(async () => storedQueue);
    const harness = await loadMain({
      deferPanelLoad: true,
      loadQueue,
      storedSettings: JSON.stringify({ retention: "7 dní po odeslání" }),
    });
    const fixture = await writeOldSentRecording(harness.userDataPath);
    storedQueue = JSON.parse(await readFile(fixture.queuePath, "utf8"));
    vi.useFakeTimers();

    const ready = harness.runReady();
    await vi.advanceTimersByTimeAsync(4_999);

    const executeJavaScript = harness.windows[0].webContents.executeJavaScript;
    expect(harness.windows[0].webContents.pageLoaded).toBe(false);
    expect(executeJavaScript).not.toHaveBeenCalled();

    harness.finishPanelLoad();
    await ready;
    vi.useRealTimers();
    await waitForQueuePump(harness);

    expect(executeJavaScript).toHaveBeenCalledOnce();
    expect(await fileExists(fixture.microphonePath)).toBe(false);
    expect(await fileExists(fixture.systemPath)).toBe(false);
  });

  it.each([
    ["chybě načtení", (harness) => harness.failPanelLoad(new Error("did-fail-load"))],
    ["zavření okna", (harness) => harness.closePanelBeforeLoad()],
    ["zničení rendereru", (harness) => harness.destroyPanelRendererBeforeLoad()],
  ])("při %s pokračuje start bez čtení a bez mazání", async (_label, endLoad) => {
    const harness = await loadMain({
      deferPanelLoad: true,
      storedSettings: JSON.stringify({ retention: "7 dní po odeslání" }),
    });
    const fixture = await writeOldSentRecording(harness.userDataPath);

    const ready = harness.runReady();
    endLoad(harness);
    await expect(ready).resolves.toBeUndefined();
    await waitForQueuePump(harness);

    expect(harness.windows[0].webContents.executeJavaScript).not.toHaveBeenCalled();
    expect(await fileExists(fixture.microphonePath)).toBe(true);
    expect(await fileExists(fixture.systemPath)).toBe(true);
    await expect(readFile(fixture.queuePath, "utf8").then(JSON.parse))
      .resolves.toMatchObject({ items: [expect.objectContaining({ state: "odeslano" })] });
    expect(harness.electron.app.quit).not.toHaveBeenCalled();
  });

  it("po pěti sekundách ukončí čekání na nenačtené okno fail-closed", async () => {
    const harness = await loadMain({
      deferPanelLoad: true,
      storedSettings: JSON.stringify({ retention: "7 dní po odeslání" }),
    });
    const fixture = await writeOldSentRecording(harness.userDataPath);
    vi.useFakeTimers();

    const ready = harness.runReady();
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(ready).resolves.toBeUndefined();
    vi.useRealTimers();
    await waitForQueuePump(harness);

    expect(harness.windows[0].webContents.executeJavaScript).not.toHaveBeenCalled();
    expect(await fileExists(fixture.microphonePath)).toBe(true);
    expect(await fileExists(fixture.systemPath)).toBe(true);
    await expect(readFile(fixture.queuePath, "utf8").then(JSON.parse))
      .resolves.toMatchObject({ items: [expect.objectContaining({ state: "odeslano" })] });
    expect(harness.quietConsole.warn).toHaveBeenCalledWith(
      expect.stringContaining("načtení překročilo 5000 ms"),
    );
    expect(harness.electron.app.quit).not.toHaveBeenCalled();
  });

  it("po jedné sekundě ukončí neodpovídající čtení rendereru fail-closed", async () => {
    const harness = await loadMain({
      deferSettingsRead: true,
      storedSettings: JSON.stringify({ retention: "7 dní po odeslání" }),
    });
    const fixture = await writeOldSentRecording(harness.userDataPath);
    vi.useFakeTimers();

    const ready = harness.runReady();
    await harness.settingsReadStarted;
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(ready).resolves.toBeUndefined();
    vi.useRealTimers();
    await waitForQueuePump(harness);

    expect(await fileExists(fixture.microphonePath)).toBe(true);
    expect(await fileExists(fixture.systemPath)).toBe(true);
    expect(harness.quietConsole.warn).toHaveBeenCalledWith(
      expect.stringContaining("čtení nastavení překročilo 1000 ms"),
    );
    expect(harness.electron.app.quit).not.toHaveBeenCalled();
  });

  it("po změně dokumentu během čtení zachová data fail-closed", async () => {
    const harness = await loadMain({
      navigateDuringSettingsRead: true,
      storedSettings: JSON.stringify({ retention: "7 dní po odeslání" }),
    });
    const fixture = await writeOldSentRecording(harness.userDataPath);

    await expect(harness.runReady()).resolves.toBeUndefined();
    await waitForQueuePump(harness);

    expect(harness.windows[0].webContents.executeJavaScript).toHaveBeenCalledOnce();
    expect(await fileExists(fixture.microphonePath)).toBe(true);
    expect(await fileExists(fixture.systemPath)).toBe(true);
    expect(harness.quietConsole.warn).toHaveBeenCalledWith(
      expect.stringContaining("během čtení změnil dokument"),
    );
  });

  it.each([
    ["chybějící", null, null],
    ["nečitelná", "{poškozený-json", null],
    ["nedostupná", null, new Error("localStorage není dostupné")],
    ["neznámá", JSON.stringify({ retention: "Smazat bez ptaní" }), null],
  ])("%s politika retence nesmaže žádná data", async (_label, storedSettings, settingsReadError) => {
    const harness = await loadMain({ storedSettings, settingsReadError });
    const fixture = await writeOldSentRecording(harness.userDataPath);

    await expect(harness.runReady()).resolves.toBeUndefined();
    await waitForQueuePump(harness);

    await expect(readFile(fixture.microphonePath, "utf8")).resolves.toBe("mikrofon");
    await expect(readFile(fixture.systemPath, "utf8")).resolves.toBe("system");
    await expect(readFile(fixture.queuePath, "utf8").then(JSON.parse))
      .resolves.toMatchObject({ items: [expect.objectContaining({ state: "odeslano" })] });
  });

  it("selhání načtení retenční fronty nezastaví start ani její pumpu", async () => {
    const pump = vi.fn(async () => ({ outcome: "idle" }));
    const createOutboundQueueStore = vi.fn(() => ({
      enqueueRecording: vi.fn(),
      enqueueTimeEntry: vi.fn(),
      list: vi.fn(),
      pump,
      retry: vi.fn(),
    }));
    const harness = await loadMain({
      createOutboundQueueStore,
      storedSettings: JSON.stringify({ retention: "7 dní po odeslání" }),
    });
    const queuePath = path.join(harness.userDataPath, "queue", "outgoing.json");
    await mkdir(path.dirname(queuePath), { recursive: true });
    await writeFile(queuePath, "{neplatná-fronta");

    await expect(harness.runReady()).resolves.toBeUndefined();
    await waitForQueuePump(harness);

    expect(pump).toHaveBeenCalledOnce();
    expect(harness.electron.app.quit).not.toHaveBeenCalled();
    expect(harness.quietConsole.error).toHaveBeenCalledWith(
      expect.stringContaining("[retention]"),
    );
  });

  it("store fronty se nezpřístupní, dokud startupová retence nedokončí zápis", async () => {
    let releaseRetention;
    let reportRetentionStarted;
    const retentionStarted = new Promise((resolve) => { reportRetentionStarted = resolve; });
    const retentionReleased = new Promise((resolve) => { releaseRetention = resolve; });
    const applyRetention = vi.fn(async ({ queue }) => {
      reportRetentionStarted();
      await retentionReleased;
      return {
        deletedFiles: [],
        deletedItems: [],
        errors: [],
        keptItems: queue.items,
      };
    });
    const list = vi.fn(async () => []);
    const createOutboundQueueStore = vi.fn(() => ({
      enqueueRecording: vi.fn(),
      enqueueTimeEntry: vi.fn(),
      list,
      pump: vi.fn(async () => ({ outcome: "idle" })),
      retry: vi.fn(),
    }));
    const harness = await loadMain({
      applyRetention,
      createOutboundQueueStore,
      storedSettings: JSON.stringify({ retention: "7 dní po odeslání" }),
    });

    const ready = harness.runReady();
    await retentionStarted;
    const panelContents = harness.windows[0].webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };
    const queuedList = harness.ipcHandlers.get("queue:list")(event);
    await Promise.resolve();
    const storeWasOpenedDuringRetention = createOutboundQueueStore.mock.calls.length > 0;
    releaseRetention();
    await Promise.all([ready, queuedList]);
    await waitForQueuePump(harness);

    expect(storeWasOpenedDuringRetention).toBe(false);
    expect(list).toHaveBeenCalledOnce();
  });
});
