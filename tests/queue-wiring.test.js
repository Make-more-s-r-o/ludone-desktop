import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
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

afterEach(async () => {
  await Promise.all([...temporaryRoots].map((root) => (
    rm(root, { recursive: true, force: true })
  )));
  temporaryRoots.clear();
});

function fakeElectron(userDataPath) {
  const ipcHandlers = new Map();
  const ipcListeners = new Map();
  const windows = [];
  let readyCallback;
  let nextWebContentsId = 1;

  class FakeWebContents extends EventEmitter {
    constructor(id) {
      super();
      this.id = id;
      this.mainFrame = { url: "ludone://app/index.html" };
    }

    getURL() { return this.mainFrame.url; }
    isDestroyed() { return false; }
  }

  class FakeBrowserWindow extends EventEmitter {
    constructor() {
      super();
      this.visible = false;
      const contents = new FakeWebContents(nextWebContentsId);
      nextWebContentsId += 1;
      this.webContents = contents;
      windows.push(this);
    }

    loadFile(filePath) {
      this.webContents.mainFrame.url = pathToFileURL(filePath).toString();
      return Promise.resolve();
    }

    isDestroyed() { return false; }
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
    windows,
    async runReady() {
      if (!readyCallback) throw new Error("main.cjs nezaregistroval app.whenReady callback");
      await readyCallback();
      await Promise.resolve();
    },
  };
}

/**
 * @param {{ createOutboundQueueStore?: (...args: any[]) => any }} [options]
 */
async function loadMain({ createOutboundQueueStore } = {}) {
  const userDataPath = await mkdtemp(path.join(tmpdir(), "ludone-main-queue-test-"));
  temporaryRoots.add(userDataPath);
  const harness = fakeElectron(userDataPath);
  const queueStoreModule = actualRequire("./queue.cjs");
  const injectedRequire = (specifier) => {
    if (specifier === "electron") return harness.electron;
    if (specifier === "./queue.cjs" && createOutboundQueueStore) {
      return { ...queueStoreModule, createOutboundQueueStore };
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
    { env: { ...process.env, LUDONE_DATA_DIR: undefined }, platform: process.platform },
    import("../src/lib/manifest.js"),
    import("../src/lib/queue.js"),
  );
  return { ...harness, userDataPath };
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
});
