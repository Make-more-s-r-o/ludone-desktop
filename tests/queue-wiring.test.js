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

/**
 * @param {string} userDataPath
 * @param {{
 *   deferPanelLoad?: boolean,
 *   isPackaged?: boolean,
 *   deferSettingsRead?: boolean,
 *   navigateDuringSettingsRead?: boolean,
 *   primaryWorkArea?: {x: number, y: number, width: number, height: number},
 *   settingsReadError?: Error | null,
 *   storedSettings?: string | null,
 *   trayBounds?: {x: number, y: number, width: number, height: number} | Error,
 * }} [options]
 */
function fakeElectron(userDataPath, {
  deferPanelLoad = false,
  deferSettingsRead = false,
  isPackaged = false,
  navigateDuringSettingsRead = false,
  primaryWorkArea = { x: 0, y: 0, width: 1_440, height: 900 },
  storedSettings = null,
  settingsReadError = null,
  trayBounds = { x: 0, y: 0, width: 0, height: 18 },
} = {}) {
  const ipcHandlers = new Map();
  const ipcListeners = new Map();
  const trays = [];
  const windows = [];
  let readyCallback;
  let nextWebContentsId = 1;
  let pendingPanelLoad;
  let trayVisibilityCheck;
  let trayVisibilityDelay;
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
      this.send = vi.fn();
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
    constructor(options = {}) {
      super();
      this.options = options;
      this.visible = false;
      this.focused = false;
      this.shownInactive = false;
      this.destroyed = false;
      this.loadCalls = [];
      this.bounds = {
        x: 0,
        y: 0,
        width: options.width ?? 0,
        height: options.height ?? 0,
      };
      this.setPosition = vi.fn((x, y) => {
        this.bounds.x = x;
        this.bounds.y = y;
      });
      this.setSize = vi.fn((width, height) => {
        this.bounds.width = width;
        this.bounds.height = height;
      });
      const contents = new FakeWebContents(nextWebContentsId);
      nextWebContentsId += 1;
      this.webContents = contents;
      windows.push(this);
    }

    loadFile(filePath, options = {}) {
      this.loadCalls.push({ kind: "file", target: filePath, options });
      const fileUrl = new URL(pathToFileURL(filePath));
      if (options.hash) fileUrl.hash = options.hash;
      this.webContents.mainFrame.url = fileUrl.toString();
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

    loadURL(url) {
      this.loadCalls.push({ kind: "url", target: url });
      this.webContents.mainFrame.url = url;
      this.webContents.finishLoad();
      return Promise.resolve();
    }

    isDestroyed() { return this.destroyed; }
    isVisible() { return this.visible; }
    show() { this.visible = true; }
    showInactive() {
      this.visible = true;
      this.shownInactive = true;
    }
    hide() { this.visible = false; }
    focus() { this.focused = true; }
    close() {
      let prevented = false;
      this.emit("close", { preventDefault: () => { prevented = true; } });
      if (prevented) return;
      this.destroyed = true;
      this.webContents.destroy();
      this.emit("closed");
    }
    getBounds() { return { ...this.bounds }; }
    getSize() { return [this.bounds.width, this.bounds.height]; }
  }

  class FakeTray extends EventEmitter {
    constructor() {
      super();
      this.popUpContextMenu = vi.fn();
      this.setContextMenu = vi.fn();
      trays.push(this);
    }

    setTitle() {}
    setImage() {}
    setToolTip() {}
    getBounds() {
      if (trayBounds instanceof Error) throw trayBounds;
      return { ...trayBounds };
    }
  }

  const app = Object.assign(new EventEmitter(), {
    commandLine: { appendSwitch: vi.fn() },
    dock: { hide: vi.fn() },
    getPath: vi.fn(() => userDataPath),
    isPackaged,
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
    Menu: {
      buildFromTemplate: vi.fn((template) => ({ template })),
    },
    nativeImage: {
      createFromDataURL: vi.fn(() => ({ resize() { return this; } })),
      // Ikona lišty se od PNG opravy skládá z bufferů (běžné + retina rozlišení).
      // Stub musí umět totéž co produkce, jinak testy padají na chybějící metodě —
      // a to není nález o kódu, jen o harnessu.
      createFromBuffer: vi.fn(() => ({
        addRepresentation() { return this; },
        isEmpty: () => false,
        resize() { return this; },
        setTemplateImage() { return this; },
      })),
    },
    net: { fetch: vi.fn() },
    protocol: {
      handle: vi.fn(),
      registerSchemesAsPrivileged: vi.fn(),
    },
    safeStorage: {
      decryptString: vi.fn((encrypted) => encrypted.toString("utf8")),
      encryptString: vi.fn((value) => Buffer.from(value, "utf8")),
      isEncryptionAvailable: vi.fn(() => true),
    },
    screen: Object.assign(new EventEmitter(), {
      getDisplayMatching: vi.fn(() => ({
        workArea: primaryWorkArea,
      })),
      getDisplayNearestPoint: vi.fn(() => ({
        workArea: primaryWorkArea,
      })),
      getPrimaryDisplay: vi.fn(() => ({ workArea: primaryWorkArea })),
    }),
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

  function controlledSetTimeout(callback, delay, ...args) {
    if (delay === 2_000) {
      trayVisibilityDelay = delay;
      trayVisibilityCheck = () => callback(...args);
      return { unref: vi.fn() };
    }
    return globalThis.setTimeout(callback, delay, ...args);
  }

  return {
    controlledSetTimeout,
    electron,
    ipcHandlers,
    ipcListeners,
    settingsReadStarted,
    trays,
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
    runTrayVisibilityCheck() {
      if (!trayVisibilityCheck) throw new Error("Kontrola viditelnosti lišty nebyla naplánovaná");
      return trayVisibilityCheck();
    },
    trayVisibilityDelay: () => trayVisibilityDelay,
  };
}

/**
 * @param {{
 *   applyRetention?: (...args: any[]) => Promise<any>,
 *   autoUpdater?: EventEmitter & Record<string, any>,
 *   createLogoutController?: (...args: any[]) => any,
 *   createOutboundQueueStore?: (...args: any[]) => any,
 *   createTrackingStore?: (...args: any[]) => any,
 *   deferPanelLoad?: boolean,
 *   deferSettingsRead?: boolean,
 *   env?: Record<string, string | undefined>,
 *   isPackaged?: boolean,
 *   loadQueue?: (...args: any[]) => Promise<any>,
 *   navigateDuringSettingsRead?: boolean,
 *   primaryWorkArea?: {x: number, y: number, width: number, height: number},
 *   settingsReadError?: Error | null,
 *   storedSettings?: string | null,
 *   trayBounds?: {x: number, y: number, width: number, height: number} | Error,
 * }} [options]
 */
async function loadMain({
  applyRetention,
  autoUpdater,
  createLogoutController,
  createOutboundQueueStore,
  createTrackingStore,
  deferPanelLoad = false,
  deferSettingsRead = false,
  env = {},
  isPackaged = false,
  loadQueue,
  navigateDuringSettingsRead = false,
  primaryWorkArea,
  settingsReadError = null,
  storedSettings = null,
  trayBounds,
} = {}) {
  const userDataPath = await mkdtemp(path.join(tmpdir(), "ludone-main-queue-test-"));
  temporaryRoots.add(userDataPath);
  const harness = fakeElectron(userDataPath, {
    deferPanelLoad,
    deferSettingsRead,
    isPackaged,
    navigateDuringSettingsRead,
    primaryWorkArea,
    storedSettings,
    settingsReadError,
    trayBounds,
  });
  const queueStoreModule = actualRequire("./queue.cjs");
  const retentionModule = actualRequire("./retention.cjs");
  const trackingModule = actualRequire("./tracking.cjs");
  const injectedRequire = (specifier) => {
    if (specifier === "electron") return harness.electron;
    if (specifier === "electron-updater" && autoUpdater) return { autoUpdater };
    if (specifier === "./auth.cjs" && createLogoutController) {
      return { ...actualRequire("./auth.cjs"), createLogoutController };
    }
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
    if (specifier === "./tracking.cjs" && createTrackingStore) {
      return { ...trackingModule, createTrackingStore };
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
    "setTimeout",
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
    harness.controlledSetTimeout,
    import("../src/lib/manifest.js"),
    import("../src/lib/queue.js"),
  );
  return { ...harness, quietConsole, userDataPath };
}

function fakeAutoUpdater() {
  return Object.assign(new EventEmitter(), {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    checkForUpdates: vi.fn(async () => ({ updateInfo: null })),
    quitAndInstall: vi.fn(),
  });
}

const DAY_MS = 24 * 60 * 60 * 1_000;
const PROJECT_A = "865a78f8-b47f-4bb8-8b34-f4ec07f6f516";

function stereoWebmBytes() {
  return Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
    Buffer.from("test-WebM-Opus-"),
    Buffer.from("OpusHead", "ascii"),
    Buffer.from([1, 2, 0, 0, 0x80, 0xbb, 0, 0, 0, 0, 0]),
    Buffer.from("audio-payload"),
  ]);
}

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

/** @param {unknown | ((...args: unknown[]) => unknown)} [invokeResult] */
function loadPreload(invokeResult = true) {
  let exposedApi;
  const invoke = vi.fn(async (...args) => (
    typeof invokeResult === "function" ? invokeResult(...args) : invokeResult
  ));
  const listeners = new Map();
  const evaluatePreload = Function(
    "require",
    `"use strict";\n${preloadSource}`,
  );
  evaluatePreload((specifier) => {
    if (specifier !== "electron") throw new Error(`Neočekávaný preload modul: ${specifier}`);
    return {
      contextBridge: {
        exposeInMainWorld(name, api) {
          if (name !== "ludone") throw new Error(`Neočekávaný název mostu: ${name}`);
          exposedApi = api;
        },
      },
      ipcRenderer: {
        invoke,
        on: vi.fn((channel, listener) => listeners.set(channel, listener)),
        removeListener: vi.fn((channel, listener) => {
          if (listeners.get(channel) === listener) listeners.delete(channel);
        }),
        send: vi.fn(),
      },
    };
  });
  return {
    api: exposedApi,
    emit(channel) {
      const listener = listeners.get(channel);
      if (!listener) throw new Error(`Preload neposlouchá kanál ${channel}`);
      return listener({}, undefined);
    },
    invoke,
  };
}

function openSettingsAndCreateEvent(harness) {
  const panelContents = harness.windows[0].webContents;
  const panelEvent = { sender: panelContents, senderFrame: panelContents.mainFrame };
  const openSettings = harness.ipcListeners.get("settings:open");
  expect(openSettings).toBeTypeOf("function");
  openSettings(panelEvent);
  const settingsContents = harness.windows[1]?.webContents;
  expect(settingsContents).toBeTruthy();
  return {
    panelEvent,
    settingsEvent: { sender: settingsContents, senderFrame: settingsContents.mainFrame },
  };
}

function storedAuthSession({
  identity = { name: "Ada Lovelace", email: "ada@ludone.cz" },
  issuer = "https://app.ludone.cz",
} = {}) {
  return {
    v: 1,
    issuer,
    clientId: "desktop-client",
    resource: `${issuer}/api/mcp`,
    scope: "mcp:read",
    accessToken: "TAJNY-ACCESS-TOKEN",
    refreshToken: "TAJNY-REFRESH-TOKEN",
    identity,
  };
}

describe("zjištění uložené OAuth session", () => {
  it("hlavní proces vrací pro chybějící, platnou a poškozenou session jen boolean", async () => {
    const harness = await loadMain();
    await harness.runReady();
    const panelContents = harness.windows[0].webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };
    const hasSession = harness.ipcHandlers.get("auth:has-session");

    expect(hasSession).toBeTypeOf("function");

    const missing = await hasSession(event);
    const tokenPath = actualRequire("./auth.cjs").tokenSessionFilePath(harness.electron.app);
    await mkdir(path.dirname(tokenPath), { recursive: true });
    const completeMetadata = {
      v: 1,
      issuer: "https://app.ludone.cz",
      clientId: "desktop-client",
      resource: "https://app.ludone.cz/api/mcp",
      scope: "mcp:read",
    };
    await writeFile(tokenPath, harness.electron.safeStorage.encryptString(JSON.stringify({
      ...completeMetadata,
      accessToken: "TAJNY-ACCESS-TOKEN",
    })));
    const accessTokenOnly = await hasSession(event);
    await writeFile(tokenPath, harness.electron.safeStorage.encryptString(JSON.stringify({
      ...completeMetadata,
      refreshToken: "TAJNY-REFRESH-TOKEN",
    })));
    const refreshTokenOnly = await hasSession(event);
    await writeFile(tokenPath, harness.electron.safeStorage.encryptString(JSON.stringify({
      ...completeMetadata,
      accessToken: "",
      refreshToken: "",
    })));
    const withoutToken = await hasSession(event);
    await writeFile(tokenPath, harness.electron.safeStorage.encryptString(JSON.stringify({
      v: 1,
      issuer: "https://app.ludone.cz",
      accessToken: "TOKEN-BEZ-METADAT",
    })));
    const withoutMetadata = await hasSession(event);
    await writeFile(tokenPath, harness.electron.safeStorage.encryptString(JSON.stringify({
      ...completeMetadata,
      issuer: "http://app.ludone.cz",
      accessToken: "TOKEN-OD-NEPLATNEHO-ISSUERA",
    })));
    const invalidIssuer = await hasSession(event);
    await writeFile(tokenPath, harness.electron.safeStorage.encryptString(JSON.stringify({
      ...completeMetadata,
      v: 2,
      accessToken: "TOKEN-NEZNAME-VERZE",
    })));
    const unknownVersion = await hasSession(event);
    await writeFile(tokenPath, Buffer.from("poškozený blob", "utf8"));
    const damaged = await hasSession(event);

    const results = [
      missing,
      accessTokenOnly,
      refreshTokenOnly,
      withoutToken,
      withoutMetadata,
      invalidIssuer,
      unknownVersion,
      damaged,
    ];
    expect(results).toEqual([false, true, true, false, false, false, false, false]);
    expect(results
      .every((value) => typeof value === "boolean")).toBe(true);
    expect(JSON.stringify(results)).not.toContain("TAJNY");
  });

  it("při nedostupném bezpečném úložišti selže zavřeně", async () => {
    const harness = await loadMain();
    await harness.runReady();
    const panelContents = harness.windows[0].webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };
    const hasSession = harness.ipcHandlers.get("auth:has-session");
    const tokenPath = actualRequire("./auth.cjs").tokenSessionFilePath(harness.electron.app);
    await mkdir(path.dirname(tokenPath), { recursive: true });
    await writeFile(tokenPath, harness.electron.safeStorage.encryptString(JSON.stringify({
      v: 1,
      issuer: "https://app.ludone.cz",
      clientId: "desktop-client",
      resource: "https://app.ludone.cz/api/mcp",
      scope: "mcp:read",
      accessToken: "TOKEN-V-NEDOSTUPNEM-ULOZISTI",
    })));
    harness.electron.safeStorage.isEncryptionAvailable.mockReturnValue(false);
    await expect(hasSession(event)).resolves.toBe(false);

    harness.electron.safeStorage.isEncryptionAvailable.mockImplementation(() => {
      throw new Error("Keychain není dostupný");
    });

    expect(hasSession).toBeTypeOf("function");
    await expect(hasSession(event)).resolves.toBe(false);
  });

  it("kanál odmítne jiné okno stejným validačním wrapperem jako ostatní", async () => {
    const harness = await loadMain();
    await harness.runReady();
    const hasSession = harness.ipcHandlers.get("auth:has-session");
    const foreignContents = {
      getURL: () => "https://utocnik.example/",
      isDestroyed: () => false,
      mainFrame: {},
    };

    expect(hasSession).toBeTypeOf("function");
    expect(() => hasSession({ sender: foreignContents, senderFrame: foreignContents.mainFrame }))
      .toThrow(/nedůvěryhodný odesílatel/);
  });

  it("během souběžného odhlášení nikdy nevrátí zastaralé true", async () => {
    let finishLogout;
    const logoutPending = new Promise((resolve) => { finishLogout = resolve; });
    const createLogoutController = vi.fn(() => ({ logout: () => logoutPending }));
    const harness = await loadMain({ createLogoutController });
    await harness.runReady();
    const panelContents = harness.windows[0].webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };
    const tokenPath = actualRequire("./auth.cjs").tokenSessionFilePath(harness.electron.app);
    await mkdir(path.dirname(tokenPath), { recursive: true });
    await writeFile(tokenPath, harness.electron.safeStorage.encryptString(JSON.stringify({
      v: 1,
      issuer: "https://app.ludone.cz",
      clientId: "desktop-client",
      resource: "https://app.ludone.cz/api/mcp",
      scope: "mcp:read",
      accessToken: "TOKEN-PRED-ODHLASENIM",
    })));

    const logout = harness.ipcHandlers.get("auth:logout")(event);
    await expect(harness.ipcHandlers.get("auth:has-session")(event)).resolves.toBe(false);
    finishLogout({ signedOutLocally: false, serverRevoked: false, reason: "offline" });
    await logout;
    await expect(harness.ipcHandlers.get("auth:has-session")(event)).resolves.toBe(true);
  });

  it("rozpracované čtení po dokončeném odhlášení nevrátí zastaralé true", async () => {
    const createLogoutController = vi.fn(() => ({
      logout: vi.fn(async () => ({
        signedOutLocally: false,
        serverRevoked: false,
        reason: "offline",
      })),
    }));
    const harness = await loadMain({ createLogoutController });
    await harness.runReady();
    const panelContents = harness.windows[0].webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };
    const tokenPath = actualRequire("./auth.cjs").tokenSessionFilePath(harness.electron.app);
    await mkdir(path.dirname(tokenPath), { recursive: true });
    await writeFile(tokenPath, harness.electron.safeStorage.encryptString(JSON.stringify({
      v: 1,
      issuer: "https://app.ludone.cz",
      clientId: "desktop-client",
      resource: "https://app.ludone.cz/api/mcp",
      scope: "mcp:read",
      accessToken: "TOKEN-PRED-ODHLASENIM",
    })));

    let reportReadStarted;
    let releaseRead;
    const readStarted = new Promise((resolve) => { reportReadStarted = resolve; });
    const readReleased = new Promise((resolve) => { releaseRead = resolve; });
    const encryptedSession = await readFile(tokenPath);
    const fsPromises = actualRequire("node:fs").promises;
    const readSpy = vi.spyOn(fsPromises, "readFile").mockImplementation(async (filePath) => {
      if (filePath !== tokenPath) throw new Error(`Neočekávané čtení: ${filePath}`);
      reportReadStarted();
      await readReleased;
      return encryptedSession;
    });

    try {
      const sessionResult = harness.ipcHandlers.get("auth:has-session")(event);
      await readStarted;
      await harness.ipcHandlers.get("auth:logout")(event);
      releaseRead();
      await expect(sessionResult).resolves.toBe(false);
    } finally {
      releaseRead();
      readSpy.mockRestore();
    }
  });

  it("preload volá getter bez argumentů a odpověď nijak nerozšiřuje", async () => {
    const { api, invoke } = loadPreload();
    const untrusted = loadPreload({ accessToken: "TOKEN-Z-MAIN" });

    await expect(api.hasAuthSession()).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledExactlyOnceWith("auth:has-session");
    const untrustedResult = await untrusted.api.hasAuthSession();
    expect(untrustedResult).toBe(false);
    expect(JSON.stringify(untrustedResult)).not.toContain("TOKEN-Z-MAIN");
    expect(untrusted.invoke).toHaveBeenCalledExactlyOnceWith("auth:has-session");
  });

  it("kanál identity vrátí nastavení jen jméno a e-mail z platné šifrované session", async () => {
    const harness = await loadMain();
    await harness.runReady();
    const { panelEvent, settingsEvent } = openSettingsAndCreateEvent(harness);
    const identity = harness.ipcHandlers.get("auth:identity");
    const tokenPath = actualRequire("./auth.cjs").tokenSessionFilePath(harness.electron.app);
    await mkdir(path.dirname(tokenPath), { recursive: true });
    await writeFile(tokenPath, harness.electron.safeStorage.encryptString(JSON.stringify(
      storedAuthSession({ identity: { name: "  Ada Lovelace  ", email: " ada@ludone.cz " } }),
    )));

    expect(identity).toBeTypeOf("function");
    await expect(identity(settingsEvent)).resolves.toEqual({
      name: "Ada Lovelace",
      email: "ada@ludone.cz",
    });
    const response = await identity(settingsEvent);
    expect(Object.keys(response).sort()).toEqual(["email", "name"]);
    expect(JSON.stringify(response)).not.toMatch(/TAJNY|accessToken|refreshToken|clientId/u);
    expect(() => identity(panelEvent)).toThrow(/nedůvěryhodný odesílatel/);
  });

  it("kanál identity rozliší chybějící session, chybějící jméno a nečitelnou identitu", async () => {
    const harness = await loadMain();
    await harness.runReady();
    const { settingsEvent } = openSettingsAndCreateEvent(harness);
    const identity = harness.ipcHandlers.get("auth:identity");
    const tokenPath = actualRequire("./auth.cjs").tokenSessionFilePath(harness.electron.app);

    expect(identity).toBeTypeOf("function");
    await expect(identity(settingsEvent)).resolves.toBeNull();

    await mkdir(path.dirname(tokenPath), { recursive: true });
    await writeFile(tokenPath, harness.electron.safeStorage.encryptString(JSON.stringify({
      ...storedAuthSession(),
      v: 2,
    })));
    await expect(identity(settingsEvent)).rejects.toThrow();

    await writeFile(tokenPath, harness.electron.safeStorage.encryptString(JSON.stringify([])));
    await expect(identity(settingsEvent)).rejects.toThrow();

    await writeFile(tokenPath, harness.electron.safeStorage.encryptString(JSON.stringify(
      storedAuthSession({ identity: { name: null, email: "alice@example.cz" } }),
    )));
    await expect(identity(settingsEvent)).resolves.toEqual({
      name: null,
      email: "alice@example.cz",
    });

    await writeFile(tokenPath, harness.electron.safeStorage.encryptString(JSON.stringify(
      storedAuthSession({ identity: { name: "undefined", email: "alice@example.cz" } }),
    )));
    await expect(identity(settingsEvent)).resolves.toEqual({
      name: null,
      email: "alice@example.cz",
    });

    await writeFile(tokenPath, harness.electron.safeStorage.encryptString(JSON.stringify(
      storedAuthSession({ identity: { name: "Ada Lovelace", email: "neni-email" } }),
    )));
    await expect(identity(settingsEvent)).rejects.toThrow();

    await writeFile(tokenPath, harness.electron.safeStorage.encryptString(JSON.stringify(
      storedAuthSession({ identity: null }),
    )));
    await expect(identity(settingsEvent)).rejects.toThrow();
    await writeFile(tokenPath, Buffer.from("nečitelná session", "utf8"));
    await expect(identity(settingsEvent)).rejects.toThrow();
  });

  it("origin vrací validovanou konfiguraci a identitu nespojí se session jiného originu", async () => {
    const harness = await loadMain({ env: { LUDONE_ORIGIN: "https://labs.ludone.cz" } });
    await harness.runReady();
    const { panelEvent, settingsEvent } = openSettingsAndCreateEvent(harness);
    const identity = harness.ipcHandlers.get("auth:identity");
    const origin = harness.ipcHandlers.get("auth:origin");
    const tokenPath = actualRequire("./auth.cjs").tokenSessionFilePath(harness.electron.app);
    await mkdir(path.dirname(tokenPath), { recursive: true });
    await writeFile(tokenPath, harness.electron.safeStorage.encryptString(JSON.stringify(
      storedAuthSession({ issuer: "https://app.ludone.cz" }),
    )));

    expect(origin).toBeTypeOf("function");
    expect(origin(settingsEvent)).toBe("https://labs.ludone.cz");
    await expect(identity(settingsEvent)).resolves.toBeNull();
    expect(() => origin(panelEvent)).toThrow(/nedůvěryhodný odesílatel/);
  });

  it("preload předá identity a origin přes oddělené bezargumentové kanály", async () => {
    const identityResponse = { name: null, email: "alice@example.cz" };
    const { api, invoke } = loadPreload((channel) => (
      channel === "auth:identity" ? identityResponse : "https://labs.ludone.cz"
    ));

    await expect(api.getAuthIdentity()).resolves.toBe(identityResponse);
    await expect(api.getAuthOrigin()).resolves.toBe("https://labs.ludone.cz");
    expect(invoke.mock.calls).toEqual([
      ["auth:identity"],
      ["auth:origin"],
    ]);
  });
});

describe("výška panelu podle obsahu", () => {
  async function resizeHarness() {
    const harness = await loadMain();
    await harness.runReady();
    const panel = harness.windows[0];
    const panelContents = panel.webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };
    const resize = harness.ipcHandlers.get("panel:set-content-height");
    expect(resize).toBeTypeOf("function");
    return { event, harness, panel, resize };
  }

  it("výšku pod rozumným minimem ořízne na 180 bodů a šířku nechá 366", async () => {
    const { event, panel, resize } = await resizeHarness();

    await resize(event, 260);
    panel.setSize.mockClear();
    const appliedHeight = await resize(event, 40);

    expect(appliedHeight).toBe(180);
    expect(panel.setSize).toHaveBeenCalledExactlyOnceWith(366, 180, false);
    expect(panel.getSize()).toEqual([366, 180]);
  });

  it("výšku nad monitorem ořízne pod spodní hranu pracovní plochy", async () => {
    const { event, harness, panel, resize } = await resizeHarness();
    const display = { workArea: { x: 0, y: 24, width: 1_200, height: 600 } };
    harness.electron.screen.getDisplayMatching.mockReturnValue(display);
    harness.electron.screen.getDisplayNearestPoint.mockReturnValue(display);

    const appliedHeight = await resize(event, 5_000);
    const bounds = panel.getBounds();

    expect(appliedHeight).toBe(584);
    expect(bounds).toEqual({ x: 8, y: 32, width: 366, height: 584 });
    expect(bounds.y + bounds.height).toBe(616);
  });

  it("po skutečné změně výšky panel znovu přilepí pod ikonu", async () => {
    const { event, panel, resize } = await resizeHarness();

    await resize(event, 320);

    expect(panel.setSize).toHaveBeenCalledExactlyOnceWith(366, 320, false);
    expect(panel.setPosition).toHaveBeenCalledExactlyOnceWith(8, 26, false);
    expect(panel.setSize.mock.invocationCallOrder[0])
      .toBeLessThan(panel.setPosition.mock.invocationCallOrder[0]);
  });

  it("po změně parametrů monitoru hned omezí a pak obnoví přirozenou výšku", async () => {
    const { event, harness, panel, resize } = await resizeHarness();
    const highDisplay = { workArea: { x: 0, y: 0, width: 1_440, height: 900 } };
    const lowDisplay = { workArea: { x: 0, y: 0, width: 1_200, height: 400 } };
    harness.electron.screen.getDisplayMatching.mockReturnValue(highDisplay);
    await resize(event, 700);
    panel.setSize.mockClear();
    panel.setPosition.mockClear();

    harness.electron.screen.getDisplayMatching.mockReturnValue(lowDisplay);
    harness.electron.screen.emit("display-metrics-changed");

    expect(panel.setSize).toHaveBeenCalledExactlyOnceWith(366, 366, false);
    expect(panel.setPosition).toHaveBeenCalledExactlyOnceWith(8, 26, false);
    expect(panel.setSize.mock.invocationCallOrder[0])
      .toBeLessThan(panel.setPosition.mock.invocationCallOrder[0]);
    panel.setSize.mockClear();
    panel.setPosition.mockClear();

    harness.electron.screen.getDisplayMatching.mockReturnValue(highDisplay);
    harness.electron.screen.emit("display-metrics-changed");

    expect(panel.setSize).toHaveBeenCalledExactlyOnceWith(366, 700, false);
    expect(panel.setPosition).toHaveBeenCalledExactlyOnceWith(8, 26, false);
  });

  it("stejná výška podruhé nespustí další změnu ani přepozicování", async () => {
    const { event, panel, resize } = await resizeHarness();

    await resize(event, 320);
    await resize(event, 320);

    expect(panel.setSize).toHaveBeenCalledTimes(1);
    expect(panel.setPosition).toHaveBeenCalledTimes(1);
  });

  it("kanál přijme právě jednu konečnou číselnou výšku", async () => {
    const { event, resize } = await resizeHarness();

    await expect(Promise.resolve().then(() => resize(event, "320"))).rejects.toThrow(/výšk/i);
    await expect(Promise.resolve().then(() => resize(event, { height: 320 })))
      .rejects.toThrow(/výšk/i);
    await expect(Promise.resolve().then(() => resize(event, Number.POSITIVE_INFINITY)))
      .rejects.toThrow(/výšk/i);
    await expect(Promise.resolve().then(() => resize(event, 320, 321)))
      .rejects.toThrow(/výšk/i);
  });

  it("preload posílá hlavnímu procesu pouze číslo", async () => {
    const { api, invoke } = loadPreload(240);

    await expect(api.setPanelContentHeight(240)).resolves.toBe(240);
    expect(invoke).toHaveBeenCalledExactlyOnceWith("panel:set-content-height", 240);
  });

  it("preload nečíselnou výšku do IPC vůbec neodešle", () => {
    const { api, invoke } = loadPreload();

    expect(() => api.setPanelContentHeight({ height: 240 })).toThrow(/výšk/i);
    expect(() => api.setPanelContentHeight(Number.POSITIVE_INFINITY)).toThrow(/výšk/i);
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("viditelnost ikony a klikání na lištu", () => {
  it("počká na ustálení a u pravděpodobně nevykreslené ikony ukáže varování bez fokusu", async () => {
    const harness = await loadMain({
      trayBounds: { x: 599, y: 0, width: 34, height: 33 },
    });

    await harness.runReady();

    expect(harness.trayVisibilityDelay()).toBe(2_000);
    expect(harness.windows).toHaveLength(1);

    harness.runTrayVisibilityCheck();

    expect(harness.windows).toHaveLength(2);
    const warning = harness.windows[1];
    expect(warning.options.show).toBe(false);
    expect(warning.loadCalls).toEqual([
      expect.objectContaining({
        kind: "url",
        target: expect.stringContaining("#tray-space-warning"),
      }),
    ]);

    warning.emit("ready-to-show");

    expect(warning.shownInactive).toBe(true);
    expect(warning.focused).toBe(false);
  });

  it("varuje i těsně vlevo od přesné hranice 45 %", async () => {
    const harness = await loadMain({
      primaryWorkArea: { x: 0, y: 0, width: 100, height: 90 },
      trayBounds: { x: 43.999, y: 0, width: 1, height: 18 },
    });
    await harness.runReady();

    harness.runTrayVisibilityCheck();

    expect(harness.windows).toHaveLength(2);
  });

  it.each([
    ["ikona vpravo", { x: 1_300, y: 0, width: 18, height: 18 }],
    ["přesně na konzervativní hranici", { x: 630, y: 0, width: 18, height: 18 }],
    ["nulová šířka", { x: 599, y: 0, width: 0, height: 33 }],
    ["nezjistitelné rozměry", new Error("macOS rozměry neposkytl")],
  ])("u stavu %s mlčí", async (_label, trayBounds) => {
    const harness = await loadMain({ trayBounds });
    await harness.runReady();

    harness.runTrayVisibilityCheck();

    expect(harness.windows).toHaveLength(1);
  });

  it("varuje nejvýš jednou za spuštění i po zavření okna", async () => {
    const harness = await loadMain({
      trayBounds: { x: 599, y: 0, width: 34, height: 33 },
    });
    await harness.runReady();

    harness.runTrayVisibilityCheck();
    harness.windows[1].close();
    harness.runTrayVisibilityCheck();

    expect(harness.windows).toHaveLength(2);
  });

  it("pravý klik otevře schválené popup menu a panel nechá být", async () => {
    const harness = await loadMain({
      trayBounds: { x: 1_300, y: 0, width: 18, height: 18 },
    });
    await harness.runReady();
    const panel = harness.windows[0];
    const tray = harness.trays[0];

    tray.emit("right-click");

    expect(harness.electron.Menu.buildFromTemplate).toHaveBeenCalledOnce();
    const template = harness.electron.Menu.buildFromTemplate.mock.calls[0][0];
    expect(template.map((item) => item.type === "separator" ? "separator" : item.label)).toEqual([
      "Ukončit nahrávání",
      "Spustit LuTrack",
      "separator",
      "Otevřít panel",
      "Otevřít LuDone v prohlížeči",
      "separator",
      "Nastavení…",
      "O aplikaci",
      "separator",
      "Ukončit LuDone",
    ]);
    expect(template.map((item) => item.accelerator ?? null)).toEqual([
      "Control+Option+R",
      "Control+Option+T",
      null,
      "Control+Option+L",
      null,
      null,
      "CommandOrControl+,",
      null,
      null,
      "CommandOrControl+Q",
    ]);
    expect(tray.popUpContextMenu).toHaveBeenCalledExactlyOnceWith(
      harness.electron.Menu.buildFromTemplate.mock.results[0].value,
    );
    expect(tray.setContextMenu).not.toHaveBeenCalled();
    expect(panel.visible).toBe(false);
    expect(panel.focused).toBe(false);
  });

  it("rychlé akce předá panelu jediným validovaným kanálem i před jeho odběrem", async () => {
    const harness = await loadMain({
      trayBounds: { x: 1_300, y: 0, width: 18, height: 18 },
    });
    await harness.runReady();
    const panelContents = harness.windows[0].webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };
    const tray = harness.trays[0];

    tray.emit("right-click");
    const template = harness.electron.Menu.buildFromTemplate.mock.calls[0][0];
    template[1].click();
    tray.emit("right-click");
    harness.electron.Menu.buildFromTemplate.mock.calls[1][0][1].click();

    expect(panelContents.send).toHaveBeenCalledTimes(2);
    expect(panelContents.send).toHaveBeenNthCalledWith(1, "tray:command");
    expect(panelContents.send).toHaveBeenNthCalledWith(2, "tray:command");
    const takeCommand = harness.ipcHandlers.get("tray:command");
    expect(takeCommand).toBeTypeOf("function");
    expect(takeCommand(event)).toEqual(["start-tracking", "start-tracking"]);
    expect(takeCommand(event)).toEqual([]);
  });

  it("čekající rychlou akci nepřenese do nové generace rendereru", async () => {
    const harness = await loadMain({
      trayBounds: { x: 1_300, y: 0, width: 18, height: 18 },
    });
    await harness.runReady();
    const panelContents = harness.windows[0].webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };
    const tray = harness.trays[0];

    tray.emit("right-click");
    harness.electron.Menu.buildFromTemplate.mock.calls[0][0][1].click();
    panelContents.emit(
      "did-start-navigation",
      {},
      "ludone://app/index.html",
      false,
      true,
    );

    const takeCommand = harness.ipcHandlers.get("tray:command");
    expect(takeCommand(event)).toEqual([]);
  });

  it("preload po registraci vyzvedne i dříve čekající rychlé akce", async () => {
    const responses = [
      ["stop-recording", "start-tracking"],
      [],
    ];
    const { api, emit, invoke } = loadPreload(() => responses.shift() ?? []);
    let deliveryTurn = 0;
    const deliveryTurns = [];
    const listener = vi.fn((command) => {
      deliveryTurns.push([command, deliveryTurn]);
      setTimeout(() => {
        deliveryTurn += 1;
      }, 0);
    });

    const unsubscribe = api.onTrayCommand(listener);
    await vi.waitFor(() => {
      expect(listener.mock.calls).toEqual([
        ["stop-recording"],
        ["start-tracking"],
      ]);
    });
    await emit("tray:command");

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenNthCalledWith(1, "tray:command");
    expect(invoke).toHaveBeenNthCalledWith(2, "tray:command");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(deliveryTurns).toEqual([
      ["stop-recording", 0],
      ["start-tracking", 1],
    ]);
    unsubscribe();
  });

  it("levý klik dál otevře a napozicuje panel, nikoli kontextové menu", async () => {
    const harness = await loadMain({
      trayBounds: { x: 1_300, y: 0, width: 18, height: 18 },
    });
    await harness.runReady();
    const panel = harness.windows[0];
    const tray = harness.trays[0];

    tray.emit("click");

    expect(panel.visible).toBe(true);
    expect(panel.focused).toBe(true);
    expect(panel.setPosition).toHaveBeenCalledExactlyOnceWith(1_066, 26, false);
    expect(tray.popUpContextMenu).not.toHaveBeenCalled();
  });
});

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

  it("pojmenování přes preload předá časování, GUID i název na přesné IPC kanály", async () => {
    const { api, invoke } = loadPreload({ ok: true });
    const timing = {
      startedAt: "2026-09-02T12:00:00.150Z",
      endedAt: "2026-09-02T12:30:00.450Z",
    };

    await api.finishRecordingExport("session-1", { succeeded: true, timing });
    await api.exportRecording("session-1", "Porada provozu");

    expect(invoke).toHaveBeenNthCalledWith(
      1,
      "recording:finish-export",
      "session-1",
      { succeeded: true, timing },
    );
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      "recording:export",
      "session-1",
      "Porada provozu",
    );
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
    await finish(event, sessionId, {
      microphone: {
        startedAt: "2026-09-02T12:00:00.100Z",
        endedAt: "2026-09-02T12:00:01.100Z",
      },
      system: {
        startedAt: "2026-09-02T12:00:00.125Z",
        endedAt: "2026-09-02T12:00:01.125Z",
      },
    });

    expect(await list(event)).toEqual([
      expect.objectContaining({
        id: sessionId,
        kind: "recording",
        state: "ceka",
        attempts: 0,
      }),
    ]);
  });

  it("pojmenování projde hlavním procesem do jednoho stereo souboru", async () => {
    const harness = await loadMain({ env: { LUDONE_ORIGIN: "https://labs.ludone.cz" } });
    await harness.runReady();
    const panelContents = harness.windows[0].webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };
    const begin = harness.ipcHandlers.get("recording:begin");
    const append = harness.ipcHandlers.get("recording:append");
    const finish = harness.ipcHandlers.get("recording:finish");
    const finishExport = harness.ipcHandlers.get("recording:finish-export");
    const exportRecording = harness.ipcHandlers.get("recording:export");
    const microphoneTiming = {
      startedAt: "2026-09-02T12:00:00.100Z",
      endedAt: "2026-09-02T12:30:00.500Z",
    };
    const systemTiming = {
      startedAt: "2026-09-02T12:00:00.125Z",
      endedAt: "2026-09-02T12:30:00.525Z",
    };

    const { sessionId } = await begin(event);
    await append(event, sessionId, "microphone", 0, Uint8Array.from([1, 2, 3]).buffer);
    await append(event, sessionId, "system", 0, Uint8Array.from([4, 5]).buffer);
    await append(event, sessionId, "stereo", 0, Uint8Array.from(stereoWebmBytes()).buffer);

    // Dokončení originálů na stereo finalizaci nečeká.
    const saved = await finish(event, sessionId, {
      microphone: microphoneTiming,
      system: systemTiming,
    });
    expect(saved.trackStartDeltaMs).toBe(25);
    const pendingExport = exportRecording(event, sessionId, "Porada / provozu: Q3");
    await finishExport(event, sessionId, {
      succeeded: true,
      timing: {
        startedAt: "2026-09-02T12:00:00.075Z",
        endedAt: "2026-09-02T12:30:00.550Z",
      },
    });
    const exported = await pendingExport;

    expect(exported).toMatchObject({
      ok: true,
      clientRecordingId: sessionId,
      format: { container: "WebM", codec: "Opus", channels: 2 },
      trackStartDeltaMs: 25,
    });
    expect(exported.fileName).toContain("Porada-provozu-Q3");
    expect(exported.fileName).not.toMatch(/[/:]/);
    const exportLogs = harness.quietConsole.log.mock.calls
      .map(([message]) => message)
      .filter((message) => typeof message === "string" && message.startsWith("[recording-export]"));
    expect(exportLogs).toEqual([expect.stringContaining(sessionId)]);
    expect(exportLogs.join("\n")).not.toContain("Porada");
    expect(harness.electron.shell.openExternal).toHaveBeenCalledWith(
      "https://labs.ludone.cz/nahravky/nahrat"
      + `?clientRecordingId=${sessionId}`
      + "&startedAt=2026-09-02T12%3A00%3A00.100Z"
      + "&endedAt=2026-09-02T12%3A30%3A00.525Z",
    );
    await expect(readFile(path.join(harness.userDataPath, exported.fileName)))
      .resolves.toEqual(stereoWebmBytes());
    await expect(readFile(path.join(
      harness.userDataPath,
      "nahravky",
      saved.files.microphone.name,
    ))).resolves.toEqual(Buffer.from([1, 2, 3]));
    await expect(readFile(path.join(
      harness.userDataPath,
      "nahravky",
      saved.files.system.name,
    ))).resolves.toEqual(Buffer.from([4, 5]));
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

describe("produkční zapojení automatických aktualizací", () => {
  it("zkontroluje vydání po startu a znovu po šesti hodinách", async () => {
    vi.useFakeTimers();
    const autoUpdater = fakeAutoUpdater();
    const harness = await loadMain({ autoUpdater, isPackaged: true });

    await harness.runReady();

    expect(autoUpdater.autoDownload).toBe(true);
    expect(autoUpdater.autoInstallOnAppQuit).toBe(false);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1_000);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it("běžící nahrávání odloží restart a po celém dokončení jej uplatní", async () => {
    vi.useFakeTimers();
    const autoUpdater = fakeAutoUpdater();
    const harness = await loadMain({ autoUpdater, isPackaged: true });
    await harness.runReady();
    const panelContents = harness.windows[0].webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };
    const begin = harness.ipcHandlers.get("recording:begin");
    const finish = harness.ipcHandlers.get("recording:finish");
    const finishExport = harness.ipcHandlers.get("recording:finish-export");
    const { sessionId } = await begin(event);

    autoUpdater.emit("update-downloaded", { version: "0.1.1" });
    await vi.advanceTimersByTimeAsync(90_000);
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();

    const finishing = finish(event, sessionId, {
      microphone: {
        startedAt: "2026-09-02T12:00:00.100Z",
        endedAt: "2026-09-02T12:00:01.100Z",
      },
      system: {
        startedAt: "2026-09-02T12:00:00.125Z",
        endedAt: "2026-09-02T12:00:01.125Z",
      },
    });
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    await Promise.all([
      finishing,
      finishExport(event, sessionId, { succeeded: false }),
    ]);
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30_000);
    await vi.waitFor(() => expect(autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1));
  });

  it("běžící LuTrack odloží restart a po zastavení jej uplatní", async () => {
    vi.useFakeTimers();
    const autoUpdater = fakeAutoUpdater();
    const harness = await loadMain({
      autoUpdater,
      env: { DESKTOP_TIME_ENABLED: "true" },
      isPackaged: true,
    });
    await harness.runReady();
    const panelContents = harness.windows[0].webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };
    const startTracking = harness.ipcHandlers.get("tracking:start");
    const stopTracking = harness.ipcHandlers.get("tracking:stop");

    await startTracking(event, { projectId: PROJECT_A, note: null });
    autoUpdater.emit("update-downloaded", { version: "0.1.1" });
    await vi.advanceTimersByTimeAsync(90_000);
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();

    await stopTracking(event);
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.waitFor(() => expect(autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1));
  });

  it("odloží restart i pro LuTrack hlášený současným panelem", async () => {
    vi.useFakeTimers();
    const autoUpdater = fakeAutoUpdater();
    const harness = await loadMain({ autoUpdater, isPackaged: true });
    await harness.runReady();
    const panelContents = harness.windows[0].webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };
    const reportFacts = harness.ipcListeners.get("tray:report-facts");

    reportFacts(event, { signedIn: true, tracking: true });
    autoUpdater.emit("update-downloaded", { version: "0.1.1" });
    await vi.advanceTimersByTimeAsync(90_000);
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();

    reportFacts(event, { signedIn: true, tracking: false });
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.waitFor(() => expect(autoUpdater.quitAndInstall).toHaveBeenCalledOnce());
  });

  it("počká i na právě zapisovaný start LuTracku", async () => {
    vi.useFakeTimers();
    let enterStart;
    let releaseStart;
    const startEntered = new Promise((resolve) => { enterStart = resolve; });
    const startReleased = new Promise((resolve) => { releaseStart = resolve; });
    let state = { schemaVersion: 1, aktualni: null, uzavrene: [] };
    /** @type {Promise<any>} */
    let queue = Promise.resolve();
    const enqueue = (operation) => {
      const result = queue.then(operation);
      queue = result.catch(() => {});
      return result;
    };
    const trackingStore = {
      getState: () => structuredClone(state),
      load: () => enqueue(async () => structuredClone(state)),
      start: () => enqueue(async () => {
        enterStart();
        await startReleased;
        const entry = {
          clientTimeEntryId: "98e55275-b912-447c-a0de-417b1860f9d9",
          projectId: PROJECT_A,
          startedAt: "2026-09-02T12:00:00.000Z",
          startedAtRaw: "2026-09-02T12:00:01.000Z",
          processStartedAt: "2026-09-02T11:59:00.000Z",
          note: null,
          state: "bezi",
        };
        state = { ...state, aktualni: entry };
        return { outcome: "started", entry, closed: null };
      }),
      stop: () => enqueue(async () => {
        const closed = {
          clientTimeEntryId: state.aktualni.clientTimeEntryId,
          projectId: state.aktualni.projectId,
          startedAt: state.aktualni.startedAt,
          endedAt: "2026-09-02T12:01:00.000Z",
          state: "uzavreno",
          closedReason: "stop",
          minutes: 1,
        };
        state = { ...state, aktualni: null, uzavrene: [closed] };
        return { outcome: "stopped", entry: null, closed };
      }),
      switchProject: vi.fn(),
      resolveRecovered: vi.fn(),
    };
    const autoUpdater = fakeAutoUpdater();
    const harness = await loadMain({
      autoUpdater,
      createTrackingStore: () => trackingStore,
      env: { DESKTOP_TIME_ENABLED: "true" },
      isPackaged: true,
    });
    await harness.runReady();
    const panelContents = harness.windows[0].webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };
    const startTracking = harness.ipcHandlers.get("tracking:start");
    const stopTracking = harness.ipcHandlers.get("tracking:stop");

    const starting = startTracking(event, { projectId: PROJECT_A, note: null });
    await startEntered;
    autoUpdater.emit("update-downloaded", { version: "0.1.1" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();

    releaseStart();
    await starting;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();

    await stopTracking(event);
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.waitFor(() => expect(autoUpdater.quitAndInstall).toHaveBeenCalledOnce());
  });

  it("nepřehlédne LuTrack spuštěný až během kontroly odchozí fronty", async () => {
    vi.useFakeTimers();
    let reportListStarted;
    let releaseList;
    let reportListFinished;
    let reportTrackingStarted;
    let releaseTrackingStart;
    const listStarted = new Promise((resolve) => { reportListStarted = resolve; });
    const listReleased = new Promise((resolve) => { releaseList = resolve; });
    const listFinished = new Promise((resolve) => { reportListFinished = resolve; });
    const trackingStarted = new Promise((resolve) => { reportTrackingStarted = resolve; });
    const trackingStartReleased = new Promise((resolve) => { releaseTrackingStart = resolve; });
    let blockNextList = false;
    let state = { schemaVersion: 1, aktualni: null, uzavrene: [] };
    const list = vi.fn(async () => {
      if (!blockNextList) return [];
      blockNextList = false;
      reportListStarted();
      await listReleased;
      reportListFinished();
      return [];
    });
    const createOutboundQueueStore = vi.fn(() => ({
      enqueueRecording: vi.fn(),
      enqueueTimeEntry: vi.fn(),
      list,
      pump: vi.fn(async () => ({ outcome: "idle" })),
      retry: vi.fn(),
    }));
    const trackingStore = {
      getState: () => structuredClone(state),
      load: vi.fn(async () => structuredClone(state)),
      start: vi.fn(async () => {
        reportTrackingStarted();
        await trackingStartReleased;
        const entry = {
          clientTimeEntryId: "38e55275-b912-447c-a0de-417b1860f9d9",
          projectId: PROJECT_A,
          startedAt: "2026-09-02T12:00:00.000Z",
          startedAtRaw: "2026-09-02T12:00:01.000Z",
          processStartedAt: "2026-09-02T11:59:00.000Z",
          note: null,
          state: "bezi",
        };
        state = { ...state, aktualni: entry };
        return { outcome: "started", entry, closed: null };
      }),
      stop: vi.fn(async () => {
        state = { ...state, aktualni: null };
        return { outcome: "stopped", entry: null, closed: null };
      }),
      switchProject: vi.fn(),
      resolveRecovered: vi.fn(),
    };
    const autoUpdater = fakeAutoUpdater();
    const harness = await loadMain({
      autoUpdater,
      createOutboundQueueStore,
      createTrackingStore: () => trackingStore,
      isPackaged: true,
    });
    await harness.runReady();
    const panelContents = harness.windows[0].webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };
    const startTracking = harness.ipcHandlers.get("tracking:start");
    const stopTracking = harness.ipcHandlers.get("tracking:stop");

    blockNextList = true;
    autoUpdater.emit("update-downloaded", { version: "0.1.1" });
    await listStarted;
    const starting = startTracking(event, { projectId: PROJECT_A, note: null });
    await trackingStarted;
    releaseList();
    await listFinished;
    await vi.advanceTimersByTimeAsync(0);

    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    releaseTrackingStart();
    await starting;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();

    await stopTracking(event);
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.waitFor(() => expect(autoUpdater.quitAndInstall).toHaveBeenCalledOnce());
  });

  it("čeká po finalizaci nahrávky na serializační bariéru fronty", async () => {
    vi.useFakeTimers();
    let reportEnqueueStarted;
    let releaseEnqueue;
    const enqueueStarted = new Promise((resolve) => { reportEnqueueStarted = resolve; });
    const enqueueReleased = new Promise((resolve) => { releaseEnqueue = resolve; });
    /** @type {Promise<any>} */
    let queue = Promise.resolve();
    const enqueueRecording = vi.fn(() => {
      const result = queue.then(async () => {
        reportEnqueueStarted();
        await enqueueReleased;
        return {
          added: true,
          item: { clientRecordingId: "fronta-test" },
        };
      });
      queue = result.catch(() => {});
      return result;
    });
    const list = vi.fn(() => queue.then(() => []));
    const createOutboundQueueStore = vi.fn(() => ({
      enqueueRecording,
      enqueueTimeEntry: vi.fn(),
      list,
      pump: vi.fn(async () => ({ outcome: "idle" })),
      retry: vi.fn(),
    }));
    const autoUpdater = fakeAutoUpdater();
    const harness = await loadMain({ autoUpdater, createOutboundQueueStore, isPackaged: true });
    await harness.runReady();
    const panelContents = harness.windows[0].webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };
    const begin = harness.ipcHandlers.get("recording:begin");
    const finish = harness.ipcHandlers.get("recording:finish");
    const finishExport = harness.ipcHandlers.get("recording:finish-export");
    const { sessionId } = await begin(event);
    autoUpdater.emit("update-downloaded", { version: "0.1.1" });

    const finishing = finish(event, sessionId, {
      microphone: {
        startedAt: "2026-09-02T12:00:00.100Z",
        endedAt: "2026-09-02T12:00:01.100Z",
      },
      system: {
        startedAt: "2026-09-02T12:00:00.125Z",
        endedAt: "2026-09-02T12:00:01.125Z",
      },
    });
    await Promise.all([
      enqueueStarted,
      finishExport(event, sessionId, { succeeded: false }),
    ]);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();

    releaseEnqueue();
    await finishing;
    await vi.waitFor(() => expect(autoUpdater.quitAndInstall).toHaveBeenCalledOnce());
    expect(list).toHaveBeenCalled();
  });

  it("bez aktivity uplatní staženou aktualizaci právě jednou", async () => {
    const autoUpdater = fakeAutoUpdater();
    const harness = await loadMain({ autoUpdater, isPackaged: true });
    await harness.runReady();

    autoUpdater.emit("update-downloaded", { version: "0.1.1" });
    autoUpdater.emit("update-downloaded", { version: "0.1.1" });

    await vi.waitFor(() => expect(autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1));
  });

  it("při předání instalace dovolí zavřít panel a nepřijme novou aktivitu", async () => {
    const autoUpdater = fakeAutoUpdater();
    const harness = await loadMain({ autoUpdater, isPackaged: true });
    await harness.runReady();
    const panelContents = harness.windows[0].webContents;
    const event = { sender: panelContents, senderFrame: panelContents.mainFrame };
    const begin = harness.ipcHandlers.get("recording:begin");

    autoUpdater.emit("update-downloaded", { version: "0.1.1" });
    await vi.waitFor(() => expect(autoUpdater.quitAndInstall).toHaveBeenCalledOnce());

    expect(() => begin(event)).toThrow(/ukončuje/);
    harness.windows[0].close();
    expect(harness.windows[0].isDestroyed()).toBe(true);
  });

  it("ošetří odmítnutí downloadPromise bez nezachycené chyby", async () => {
    let rejectDownload;
    const downloadPromise = new Promise((_resolve, reject) => { rejectDownload = reject; });
    const autoUpdater = fakeAutoUpdater();
    autoUpdater.checkForUpdates.mockResolvedValue(/** @type {any} */ ({ downloadPromise }));
    const harness = await loadMain({ autoUpdater, isPackaged: true });
    await harness.runReady();

    rejectDownload(new Error("síťový test"));

    await vi.waitFor(() => {
      expect(harness.quietConsole.error).toHaveBeenCalledWith(
        expect.stringContaining("síťový test"),
      );
    });
  });

  it("po asynchronní chybě instalace bezpečně dovolí další pokus", async () => {
    const autoUpdater = fakeAutoUpdater();
    const harness = await loadMain({ autoUpdater, isPackaged: true });
    await harness.runReady();

    autoUpdater.emit("update-downloaded", { version: "0.1.1" });
    await vi.waitFor(() => expect(autoUpdater.quitAndInstall).toHaveBeenCalledOnce());
    autoUpdater.emit("error", new Error("nativní instalace selhala"));
    autoUpdater.emit("update-downloaded", { version: "0.1.1" });

    await vi.waitFor(() => expect(autoUpdater.quitAndInstall).toHaveBeenCalledTimes(2));
  });

  it("v zabaleném E2E běhu updater vůbec nespustí", async () => {
    const autoUpdater = fakeAutoUpdater();
    const harness = await loadMain({
      autoUpdater,
      env: { LUDONE_E2E: "1" },
      isPackaged: true,
    });

    await harness.runReady();

    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(autoUpdater.listenerCount("update-downloaded")).toBe(0);
  });
});
