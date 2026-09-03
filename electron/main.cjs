const {
  app,
  BrowserWindow,
  desktopCapturer,
  Tray,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  net,
  protocol,
  safeStorage,
  screen,
  session,
  shell,
  systemPreferences,
} = require("electron");
const { createHash, randomUUID } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");
const {
  createAuthController,
  createAuthSessionCoordinator,
  createPermissionRequestHandler,
  tokenSessionFilePath,
} = require("./auth.cjs");
const {
  createOutboundQueueStore,
  loadQueue,
  recoverOrphanedRecordings,
  saveQueueAtomically,
} = require("./queue.cjs");
const { createRecordingUploadSend } = require("./upload-client.cjs");
const { RETENTION_POLICIES, applyRetention } = require("./retention.cjs");
const {
  AUTH_ORIGINS,
  createAuthOriginStore,
  createDockVisibilityStore,
} = require("./settings.cjs");
const {
  TRACKING_STATES,
  createTrackingStore,
  handleRendererGone,
} = require("./tracking.cjs");
const {
  exportRecordingCopy,
  inspectOpusWebm,
} = require("./recording-export.cjs");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DIST_ROOT = path.join(PROJECT_ROOT, "dist");
const manifestModulePromise = import(
  pathToFileURL(path.join(PROJECT_ROOT, "src", "lib", "manifest.js")).href
);
const queueModulePromise = import(
  pathToFileURL(path.join(PROJECT_ROOT, "src", "lib", "queue.js")).href
);
const diagnosticsModulePromise = import(
  pathToFileURL(path.join(PROJECT_ROOT, "src", "lib", "diagnostics.js")).href
);
const IS_TEST_RUN = process.env.LUDONE_E2E === "1";
const PANEL_WIDTH = 366;
const PANEL_MIN_HEIGHT = 180;
const PANEL_SCREEN_MARGIN = 8;
const PANEL_LOAD_TIMEOUT_MS = 5_000;
const TRAY_SETTLE_DELAY_MS = 2_000;
const TRAY_TITLE_INTERVAL_MS = 1_000;
const TRAY_COMMAND_CHANNEL = "tray:command";
const RETENTION_READ_TIMEOUT_MS = 1_000;
const EXPORT_STAGE_READY_TIMEOUT_MS = 15_000;
const GRACEFUL_QUIT_TIMEOUT_MS = 15_000;
const MAX_RECORDING_CHUNK_BYTES = 8 * 1024 * 1024;
const RECORDING_EXPORT_TRACKS_PRESERVED = "Původní dvě stopy zůstaly uložené.";
const RECORDING_EXPORT_MICROPHONE_PRESERVED = "Původní mikrofonní stopa zůstala uložená.";
const RECORDING_EXPORT_GENERIC_ERROR = "Export se nepodařilo dokončit. Zkuste export znovu.";
const RECORDING_EXPORT_SYSTEM_ERRORS = new Map([
  ["ENOSPC", "Na disku není dost volného místa. Uvolněte místo a zkuste export znovu."],
  ["EDQUOT", "Na disku není dost volného místa. Uvolněte místo a zkuste export znovu."],
  [
    "EACCES",
    "Chybí oprávnění k uložení do složky Stažené. Zkontrolujte oprávnění a zkuste export znovu.",
  ],
  [
    "EPERM",
    "Chybí oprávnění k uložení do složky Stažené. Zkontrolujte oprávnění a zkuste export znovu.",
  ],
  ["ENOENT", "Soubor potřebný k exportu už není dostupný. Zkuste export znovu."],
]);
const RECORDING_TRACKS = new Map([
  ["microphone", "mikrofon"],
  ["system", "system"],
]);
const PROCESS_STARTED_AT = new Date().toISOString();
const recordingSessions = new Map();
const recordingOwnersPreparing = new Map();
const recordingExportStages = new Map();
const recordingCompletionsInFlight = new Set();
const trackingMutationsInFlight = new Set();

let tray;
let panelWindow;
let panelContentHeight = PANEL_MIN_HEIGHT;
let settingsWindow;
let traySpaceWarningWindow;
let trayState = "signed-out";
let trayApplied = false;
let trayThemeApplied;
let trayTitleApplied;
let trayTitleTimer;
let trayTitleUpdatesStopped = false;
let traySpaceWarningShown = false;
let trayVisibilityTimer;
let isQuitting = false;
let deferredQuitRequest;
const pendingTrayCommands = [];

// Jen tato třída smí předat svůj text uživateli. Přepsání věty její identitu nezmění.
class RecordingExportUserError extends Error {
  constructor(message) {
    super(message);
    this.name = "RecordingExportUserError";
  }
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "ludone",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function registerAppProtocol() {
  protocol.handle("ludone", (request) => {
    const requestedPath = decodeURIComponent(new URL(request.url).pathname)
      .replace(/^\/+/, "") || "index.html";
    const targetPath = path.resolve(DIST_ROOT, requestedPath);
    const isInsideDist = targetPath === DIST_ROOT || targetPath.startsWith(`${DIST_ROOT}${path.sep}`);
    if (!isInsideDist) return new Response("Zakázaná cesta", { status: 403 });
    return net.fetch(pathToFileURL(targetPath).toString());
  });
}

function isTrustedAppUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "ludone:") {
      return url.hostname === "app"
        && url.username === ""
        && url.password === ""
        && url.port === ""
        && url.pathname === "/index.html";
    }
    if (url.protocol !== "file:") return false;
    return path.resolve(fileURLToPath(url)) === path.join(DIST_ROOT, "index.html");
  } catch {
    return false;
  }
}

function isTrustedWebContents(webContents) {
  try {
    return Boolean(webContents && !webContents.isDestroyed() && isTrustedAppUrl(webContents.getURL()));
  } catch {
    return false;
  }
}

function isTrustedRecordingSender(event, expectedWebContents) {
  const sender = event?.sender;
  return Boolean(
    expectedWebContents
    && isTrustedWebContents(sender)
    && sender === expectedWebContents
    && event.senderFrame
    && event.senderFrame === sender.mainFrame
  );
}

function requireTrustedRecordingSender(event) {
  if (!isTrustedRecordingSender(event, panelWindow?.webContents)) {
    throw new Error("Nahrávací IPC odmítnuto: nedůvěryhodný odesílatel");
  }
}

function trustedSenderKind(event) {
  if (isTrustedRecordingSender(event, panelWindow?.webContents)) return "panel";
  if (isTrustedRecordingSender(event, settingsWindow?.webContents)) return "settings";
  return null;
}

function requireTrustedSender(event, allowedKinds) {
  const senderKind = trustedSenderKind(event);
  if (!senderKind || !allowedKinds.includes(senderKind)) {
    throw new Error("IPC odmítnuto: nedůvěryhodný odesílatel");
  }
}

function isAllowedMediaPermission(webContents, permission, details) {
  let senderFrame = null;
  try {
    if (details?.isMainFrame === true) senderFrame = webContents?.mainFrame;
    requireTrustedSender({ sender: webContents, senderFrame }, ["panel"]);
  } catch {
    return false;
  }

  if (!isTrustedAppUrl(details?.requestingUrl)) return false;
  if (permission === "display-capture") return true;
  if (permission !== "media") return false;

  if (Array.isArray(details.mediaTypes)) {
    // Electron hlásí getDisplayMedia se systémovým zvukem jako `media` s prázdným
    // mediaTypes. Tohle povolení samo nic nezachytí: navazující
    // setDisplayMediaRequestHandler znovu ověří důvěryhodný rám panelu a vrátí
    // výhradně obrazovku s audio: "loopback". Jde tedy o dvě nezávislé brány.
    return details.mediaTypes.length === 0
      || (details.mediaTypes.length === 1 && details.mediaTypes[0] === "audio");
  }
  return details.mediaType === "audio";
}

function isTrustedPanelFrame(frame) {
  const panelWebContents = panelWindow?.webContents;
  return Boolean(
    frame
    && panelWebContents
    && trustedSenderKind({ sender: panelWebContents, senderFrame: frame }) === "panel"
    && isTrustedAppUrl(frame.url)
  );
}

function handleValidated(channel, allowedKinds, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    requireTrustedSender(event, allowedKinds);
    if (isQuitting) throw new Error("IPC odmítnuto: aplikace se ukončuje");
    noteUpdateRelevantActivity(channel);
    return handler(event, ...args);
  });
}

function onValidated(channel, allowedKinds, handler) {
  ipcMain.on(channel, (event, ...args) => {
    try {
      requireTrustedSender(event, allowedKinds);
      if (isQuitting) throw new Error("IPC odmítnuto: aplikace se ukončuje");
      noteUpdateRelevantActivity(channel);
      return handler(event, ...args);
    } catch (error) {
      console.error(`[ipc] Odmítnuto ${channel}: ${error.message}`);
      return undefined;
    }
  });
}

function requireNoPayload(channel, extraPayload) {
  if (extraPayload.length > 0) {
    throw new TypeError(`Kanál ${channel} nepřijímá payload`);
  }
}

function requireBooleanPayload(channel, value, extraPayload) {
  if (typeof value !== "boolean" || extraPayload.length > 0) {
    throw new TypeError(`Kanál ${channel} přijímá právě jeden boolean`);
  }
}

function requireAuthOriginPayload(channel, value, extraPayload) {
  if (extraPayload.length > 0 || !AUTH_ORIGINS.includes(value)) {
    throw new TypeError(`Kanál ${channel} přijímá právě jeden známý origin prostředí`);
  }
}

function applyDockVisibility(dockVisible) {
  if (process.platform !== "darwin") return dockVisible;
  if (dockVisible) {
    return Promise.resolve(app.dock.show()).then(() => dockVisible);
  } else {
    app.dock.hide();
    // Electron ignoruje hide() méně než sekundu po show(). Accessory policy je
    // okamžitá pojistka pro rychlé přepnutí a odpovídá výchozímu LSUIElement režimu.
    app.setActivationPolicy("accessory");
  }
  return dockVisible;
}

function queueDockVisibility(dockVisible, { persist = false } = {}) {
  const transition = dockVisibilityTransition.then(async () => {
    if (!persist) return applyDockVisibility(dockVisible);

    const previousValue = dockVisibilityStore.get();
    await dockVisibilityStore.set(dockVisible);
    try {
      return await applyDockVisibility(dockVisible);
    } catch (error) {
      try {
        await dockVisibilityStore.set(previousValue);
        await applyDockVisibility(previousValue);
      } catch (rollbackError) {
        console.error(`[settings] Návrat nastavení Docku selhal: ${rollbackError.message}`);
      }
      throw error;
    }
  });
  // Další změna musí navázat i po chybě předchozího nativního volání. Serializace
  // zároveň brání tomu, aby pomalejší show přebilo novější hide.
  dockVisibilityTransition = transition.catch(() => undefined);
  return transition;
}

function configureWritablePaths() {
  const requestedRoot = process.env.LUDONE_DATA_DIR;
  if (!requestedRoot) return;

  const dataRoot = path.resolve(requestedRoot);
  const pathMap = {
    userData: path.join(dataRoot, "user-data"),
    sessionData: path.join(dataRoot, "session-data"),
    cache: path.join(dataRoot, "cache"),
    crashDumps: path.join(dataRoot, "crash-dumps"),
    temp: path.join(dataRoot, "temp"),
  };

  fs.mkdirSync(dataRoot, { recursive: true });
  for (const [name, target] of Object.entries(pathMap)) {
    fs.mkdirSync(target, { recursive: true });
    app.setPath(name, target);
  }
  const logsPath = path.join(dataRoot, "logs");
  fs.mkdirSync(logsPath, { recursive: true });
  app.setAppLogsPath(logsPath);
}

configureWritablePaths();
app.setName("LuDone Desktop");
app.commandLine.appendSwitch("disable-breakpad");

// Dock musí znát svou hodnotu ještě před existencí rendereru. Synchronní konstrukce
// načte jediný boolean z hlavního procesu; renderer je jen projekce tohoto stavu.
const dockVisibilityStore = createDockVisibilityStore({
  filePath: path.join(app.getPath("userData"), "nastaveni", "aplikace.json"),
  log: (message) => console.warn(message),
});
const authOriginStore = createAuthOriginStore({
  filePath: path.join(app.getPath("userData"), "nastaveni", "prostredi.json"),
  log: (message) => console.warn(message),
});
let dockVisibilityTransition = Promise.resolve();

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function trayIconName(state) {
  const names = ["signed-out", "idle", "recording", "tracking", "recording-tracking"];
  // Brána čte seznam bez druhého výčtu; nový stav se tak přidává na jediné místo.
  if (arguments.length === 0) return [...names];
  return names.includes(state) ? state : "signed-out";
}

// Kolik systémových dialogů o oprávnění právě běží. Dokud je to > 0, panel se po
// ztrátě fokusu NESMÍ schovat: dialog mu fokus vezme vždycky, a protože aplikace nemá
// ikonu v Docku, zmizelý panel je k nerozeznání od pádu. Doloženo 26. 8. 2026 při
// prvním pokusu o test na Google Meetu — uživatel povolil mikrofon a aplikace podle
// něj „spadla“, přestože běžela dál.
let permissionPromptsInFlight = 0;
// Pokusy evidujeme čítačem, protože dvě souběžná přihlášení mohou skončit v jiném
// pořadí; boolean by panel uvolnil už při dokončení prvního z nich.
let authAttemptsInFlight = 0;
let authLogoutsInFlight = 0;
let authOriginChangeInFlight = false;
let authSessionGeneration = 0;
const activeAuthAttempts = new Set();
const AUTH_CANCEL_CHANNEL = "auth:cancel";

// Vytažené do samostatné čisté funkce schválně — je to jediný způsob, jak tohle
// rozhodnutí otestovat bez GUI (viz tests/panel-blur-guard.test.js).
function shouldHidePanelOnBlur({
  authAttemptsInFlight,
  isTestRun,
  permissionPromptsInFlight,
  settingsVisible,
}) {
  if (isTestRun) return false;
  if (authAttemptsInFlight > 0) return false;
  if (permissionPromptsInFlight > 0) return false;
  if (settingsVisible) return false;
  return true;
}

function currentTrayIconTheme() {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

function trayImage(state, theme = currentTrayIconTheme()) {
  const iconName = trayIconName(state);
  const iconDirectory = path.join(__dirname, "ikony");
  const iconTheme = theme === "light" ? "light" : "dark";
  const fileName = `${iconTheme}-${iconName}`;
  const imageBuffer = fs.readFileSync(path.join(iconDirectory, `${fileName}.png`));
  const retinaBuffer = fs.readFileSync(path.join(iconDirectory, `${fileName}@2x.png`));
  const image = nativeImage.createFromBuffer(imageBuffer, { scaleFactor: 1 });
  const retinaImage = nativeImage.createFromBuffer(retinaBuffer, { scaleFactor: 1 });

  if (image.isEmpty() || retinaImage.isEmpty()) {
    throw new Error(`Ikona lišty ${iconName} se nenačetla`);
  }

  image.addRepresentation({ scaleFactor: 2, buffer: retinaBuffer });
  return image;
}

const TRAY_LABELS = {
  "signed-out": "LuDone · nepřihlášeno",
  idle: "LuDone · připraveno",
  recording: "LuDone · nahrává",
  tracking: "LuDone · LuTrack běží",
  "recording-tracking": "LuDone · nahrává + LuTrack běží",
};

// 🔴 Jediný zdroj pravdy o tom, co lišta ukazuje. Renderer sem hlásí FAKTA, stav z nich
// odvozuje hlavní proces — proto tahle funkce nebere argument. Dokud stav posílal renderer,
// přežil jeho pád i jeho omyl: spadlé okno nechalo ikonu viset na „nahrává“ donekonečna.
const appState = {
  acceptRendererSignIn: true,
  signedIn: false,
  trackingOwners: new Set(),
  trackingStartedAtByOwner: new Map(),
};

// Nahrávání běží, dokud je aspoň jedna příprava nezrušená nebo aspoň jedna session
// bez rozběhnuté finalizace. Obojí drží hlavní proces sám, takže se na to nikoho neptáme.
function hasLiveRecording() {
  for (const preparation of recordingOwnersPreparing.values()) {
    if (!preparation.cancelled) return true;
  }
  for (const recordingSession of recordingSessions.values()) {
    if (!recordingSession.finalizePromise) return true;
  }
  return false;
}

function hasRecordingExportInFlight() {
  for (const exportStage of recordingExportStages.values()) {
    if (exportStage.exportInFlight) return true;
  }
  return false;
}

// Čistá funkce schválně — je to jediný způsob, jak tohle rozhodnutí otestovat bez GUI
// (viz tests/tray-authority.test.js). Stejný důvod jako u shouldHidePanelOnBlur.
function deriveTrayState({ signedIn, recording, tracking }) {
  if (!signedIn) return "signed-out";
  // Nahrávání zůstává při souběhu hlavní agendou, LuTrack ukazuje odznak.
  if (recording && tracking) return "recording-tracking";
  if (recording) return "recording";
  if (tracking) return "tracking";
  return "idle";
}

// TDD_TRAY_TITLE_IMPL_20260903: stejný tvar jako panelový formatElapsed.
function formatElapsed(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

// Dva plné časy by v úzké liště zabraly 19 znaků. Při souběhu proto každý údaj
// držíme na pěti: do hodiny MM:SS, potom HHhMM a od 100 hodin 100h+.
function formatCompactTrayElapsed(totalSeconds) {
  const normalizedSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);
  if (hours >= 100) return "100h+";
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}h${String(minutes).padStart(2, "0")}`;
  }
  const seconds = normalizedSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function timestampMilliseconds(value) {
  const milliseconds = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function oldestLiveRecordingStartedAt() {
  const candidates = [];
  for (const preparation of recordingOwnersPreparing.values()) {
    if (preparation.cancelled) continue;
    const startedAt = timestampMilliseconds(preparation.startedAt);
    if (startedAt !== null) candidates.push(startedAt);
  }
  for (const recordingSession of recordingSessions.values()) {
    if (recordingSession.finalizePromise) continue;
    const startedAt = timestampMilliseconds(recordingSession.startedAt);
    if (startedAt !== null) candidates.push(startedAt);
  }
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

function oldestTrackingStartedAt() {
  const candidates = [];
  for (const ownerId of appState.trackingOwners) {
    const startedAt = timestampMilliseconds(appState.trackingStartedAtByOwner.get(ownerId));
    if (startedAt !== null) candidates.push(startedAt);
  }
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

function currentTrayTitle() {
  const recordingStartedAt = oldestLiveRecordingStartedAt();
  const trackingStartedAt = oldestTrackingStartedAt();
  if (recordingStartedAt === null && trackingStartedAt === null) return "";

  const now = Date.now();
  const elapsedSeconds = (startedAt) => (
    Math.max(0, Math.floor((now - startedAt) / 1_000))
  );
  if (recordingStartedAt !== null && trackingStartedAt !== null) {
    // Nahrávání je hlavní agenda stejně jako u ikony, proto zůstává první.
    return `${formatCompactTrayElapsed(elapsedSeconds(recordingStartedAt))}`
      + ` · ${formatCompactTrayElapsed(elapsedSeconds(trackingStartedAt))}`;
  }

  const startedAt = recordingStartedAt ?? trackingStartedAt;
  if (startedAt === null) return "";
  return formatElapsed(elapsedSeconds(startedAt));
}

function clearTrayTitleTimer() {
  if (!trayTitleTimer) return;
  clearInterval(trayTitleTimer);
  trayTitleTimer = undefined;
}

function applyTrayTitle() {
  if (!tray) return;
  const nextTitle = currentTrayTitle();
  if (nextTitle === trayTitleApplied) return;
  tray.setTitle(nextTitle, { fontType: "monospacedDigit" });
  trayTitleApplied = nextTitle;
}

function refreshTrayTitle() {
  if (trayTitleUpdatesStopped) {
    clearTrayTitleTimer();
    return;
  }
  const activityRunning = hasLiveRecording() || appState.trackingOwners.size > 0;
  applyTrayTitle();
  if (!activityRunning) {
    clearTrayTitleTimer();
    return;
  }
  if (trayTitleTimer) return;
  trayTitleTimer = setInterval(applyTrayTitle, TRAY_TITLE_INTERVAL_MS);
  trayTitleTimer.unref?.();
}

function stopTrayTitleUpdates() {
  trayTitleUpdatesStopped = true;
  clearTrayTitleTimer();
}

function refreshTray() {
  const recording = hasLiveRecording();
  const tracking = appState.trackingOwners.size > 0;
  const theme = currentTrayIconTheme();
  const next = trayIconName(deriveTrayState({
    signedIn: appState.signedIn,
    recording,
    tracking,
  }));
  // `trayApplied` odděluje odvozený stav od naposledy skutečně vykresleného. Bez něj se při
  // startu obojí rovná „signed-out“, funkce skončí předčasně a popisek se nenastaví NIKDY.
  if (next !== trayState || theme !== trayThemeApplied || !trayApplied) {
    trayState = next;
    console.log(
      `[tray] ${new Date().toISOString()} stav=${trayState} nahrávání=${recording} `
      + `lutrack=${tracking} přihlášen=${appState.signedIn}`,
    );
    if (tray) {
      tray.setImage(trayImage(trayState, theme));
      tray.setToolTip(TRAY_LABELS[trayState]);
      trayApplied = true;
      trayThemeApplied = theme;
    }
  }
  refreshTrayTitle();
}

function trayIsProbablyOutsideStatusArea(bounds, workArea) {
  if (!bounds || !workArea) return false;
  if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.width)) return false;
  if (!Number.isFinite(workArea.width) || workArea.width <= 0 || bounds.width <= 0) return false;

  // Stavové ikony bydlí v pravé části lišty. Souřadnice končící už před 45 % šířky
  // primární pracovní plochy odpovídá pozorovanému přidělení do levé oblasti aplikačního
  // menu, kde macOS položku přijme, ale nenakreslí. Práh je úmyslně konzervativní:
  // falešné varování u viditelné ikony je horší než mlčení při nejistotě.
  return bounds.x + bounds.width < workArea.width * 0.45;
}

function createTraySpaceWarningWindow() {
  const createdWarningWindow = new BrowserWindow({
    width: 420,
    height: 280,
    minWidth: 420,
    maxWidth: 420,
    minHeight: 280,
    maxHeight: 280,
    show: false,
    backgroundColor: "#2f3034",
    resizable: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    title: "LuDone běží",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  traySpaceWarningWindow = createdWarningWindow;
  createdWarningWindow.once("ready-to-show", () => {
    if (!createdWarningWindow.isDestroyed()) createdWarningWindow.showInactive();
  });
  createdWarningWindow.on("closed", () => {
    if (traySpaceWarningWindow === createdWarningWindow) traySpaceWarningWindow = undefined;
  });
  void createdWarningWindow
    .loadURL("ludone://tray-warning/index.html#tray-space-warning")
    .catch((error) => {
      console.error(`[tray] Vysvětlující okno se nepodařilo načíst: ${error.message}`);
      if (!createdWarningWindow.isDestroyed()) createdWarningWindow.close();
    });
}

function checkTrayVisibilityAfterStartup() {
  if (traySpaceWarningShown || isQuitting || !tray) return;

  let probablyOutsideStatusArea;
  try {
    const bounds = tray.getBounds();
    const workArea = screen.getPrimaryDisplay()?.workArea;
    probablyOutsideStatusArea = trayIsProbablyOutsideStatusArea(bounds, workArea);
  } catch {
    return;
  }
  if (!probablyOutsideStatusArea) return;

  // Nastavujeme před vytvořením okna: ani selhání vykreslení nesmí uživatele zasypat
  // opakovanými pokusy během jediného spuštění.
  traySpaceWarningShown = true;
  try {
    createTraySpaceWarningWindow();
  } catch (error) {
    console.error(`[tray] Vysvětlující okno se nepodařilo vytvořit: ${error.message}`);
  }
}

function scheduleTrayVisibilityCheck() {
  trayVisibilityTimer = setTimeout(checkTrayVisibilityAfterStartup, TRAY_SETTLE_DELAY_MS);
  trayVisibilityTimer.unref?.();
}

// Renderer sem hlásí FAKTA, která zatím zná jen on — jestli je někdo přihlášený a jestli
// běží časovač. Stav z nich odvozuje hlavní proces, takže se sem nikdy nesmí dostat jméno
// ikony. To je celý rozdíl proti smazanému `tray:set-state`: ten posílal ROZHODNUTÍ.
//
// Až přistane B5 (časovač do hlavního procesu) a B8 (skutečné přihlášení), budou obě fakta
// pocházet přímo z hlavního procesu a tenhle kanál se zúží nebo zmizí.
// 🔴 Přijímá PRÁVĚ dva klíče a PRÁVĚ boolean. Volnější kontrola by z tohohle kanálu udělala
// `tray:set-state` pod novým jménem: `{ tracking: "tracking" }` protlačí doslovné jméno ikony
// a `{}` tiše přepíše přihlášení na false. Neplatný obsah proto NIC nemění — fail-closed,
// protože zapomenout fakt je horší než ho neaktualizovat.
const REPORTED_FACT_KEYS = ["signedIn", "tracking"];

function applyReportedFacts(ownerId, facts) {
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) return false;
  const klice = Object.keys(facts);
  if (klice.length !== REPORTED_FACT_KEYS.length) return false;
  if (!REPORTED_FACT_KEYS.every((klic) => typeof facts[klic] === "boolean")) return false;

  // Po odhlášení může starý panel ještě jednou nahlásit stav, který si drží
  // v Reactu. Hlavní proces takový report nepřijme, dokud sám nedokončí nové
  // přihlášení; bezpečnostní akci proto renderer nemůže tiše vrátit zpět.
  if (!facts.signedIn || appState.acceptRendererSignIn !== false) {
    appState.signedIn = facts.signedIn;
  }
  const trackingStartedAtByOwner = appState.trackingStartedAtByOwner
    ?? (appState.trackingStartedAtByOwner = new Map());
  if (facts.tracking) {
    if (!appState.trackingOwners.has(ownerId)) {
      trackingStartedAtByOwner.set(ownerId, Date.now());
    }
    appState.trackingOwners.add(ownerId);
  } else {
    appState.trackingOwners.delete(ownerId);
    trackingStartedAtByOwner.delete(ownerId);
  }
  refreshTray();
  return true;
}

function panelPlacement() {
  if (!tray) return null;
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayMatching(trayBounds);
  const workArea = display.workArea;
  const proposedX = Math.round(trayBounds.x + trayBounds.width / 2 - PANEL_WIDTH / 2);
  const x = Math.max(
    workArea.x + PANEL_SCREEN_MARGIN,
    Math.min(
      proposedX,
      workArea.x + workArea.width - PANEL_WIDTH - PANEL_SCREEN_MARGIN,
    ),
  );
  const y = Math.max(
    workArea.y + PANEL_SCREEN_MARGIN,
    trayBounds.y + trayBounds.height + PANEL_SCREEN_MARGIN,
  );
  const maximumHeight = Math.max(
    1,
    Math.floor(
      workArea.y + workArea.height - PANEL_SCREEN_MARGIN - y,
    ),
  );
  return { maximumHeight, x, y };
}

function constrainedPanelHeight(reportedHeight, maximumHeight) {
  // Na běžném monitoru platí minimum 180 bodů. Kdyby pracovní plocha byla
  // výjimečně menší, má přednost tvrdý bezpečnostní strop obrazovky.
  const minimumHeight = Math.min(PANEL_MIN_HEIGHT, maximumHeight);
  return Math.min(
    Math.max(Math.ceil(reportedHeight), minimumHeight),
    maximumHeight,
  );
}

function positionPanel() {
  if (!panelWindow) return;
  const placement = panelPlacement();
  if (!placement) return;
  const nextHeight = constrainedPanelHeight(panelContentHeight, placement.maximumHeight);
  const [, currentHeight] = panelWindow.getSize();
  if (currentHeight !== nextHeight) {
    panelWindow.setSize(PANEL_WIDTH, nextHeight, false);
  }
  panelWindow.setPosition(placement.x, placement.y, false);
}

function setPanelContentHeight(reportedHeight) {
  if (typeof reportedHeight !== "number" || !Number.isFinite(reportedHeight)) {
    throw new TypeError("Výška obsahu panelu musí být konečné číslo");
  }
  if (!panelWindow || panelWindow.isDestroyed()) {
    throw new Error("Výšku nelze změnit bez živého panelu");
  }
  const placement = panelPlacement();
  if (!placement) throw new Error("Výšku nelze změnit bez ikony v liště");

  // Přirozenou výšku uchováváme i po clampu. Při přesunu ikony na jiný monitor
  // ji positionPanel znovu omezí podle nové pracovní plochy, případně obnoví.
  panelContentHeight = reportedHeight;
  const nextHeight = constrainedPanelHeight(reportedHeight, placement.maximumHeight);
  const [, currentHeight] = panelWindow.getSize();
  if (currentHeight === nextHeight) return nextHeight;

  panelWindow.setSize(PANEL_WIDTH, nextHeight, false);
  // Změna rozměru nesmí spoléhat na původní souřadnice. Tímto znovu používáme
  // jedinou autoritu pro přilepení panelu pod ikonu v liště.
  positionPanel();
  return nextHeight;
}

function waitForPanelPromise(window, webContents, promise, {
  failureReason,
  timeoutMs,
  timeoutReason,
}) {
  return new Promise((resolve) => {
    let settled = false;
    let timer;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeListener("closed", onClosed);
      webContents.removeListener("destroyed", onDestroyed);
      resolve(result);
    };
    const onClosed = () => finish({ succeeded: false, reason: "okno bylo zavřeno" });
    const onDestroyed = () => finish({ succeeded: false, reason: "renderer byl zničen" });

    window.once("closed", onClosed);
    webContents.once("destroyed", onDestroyed);
    timer = setTimeout(() => {
      finish({ succeeded: false, reason: timeoutReason });
    }, timeoutMs);
    timer.unref?.();

    Promise.resolve(promise).then(
      (value) => finish({ succeeded: true, value }),
      (error) => finish({ succeeded: false, error, reason: failureReason }),
    );
    if (window.isDestroyed() || webContents.isDestroyed()) {
      finish({ succeeded: false, reason: "okno nebo renderer už neexistuje" });
    }
  });
}

function createPanelWindow() {
  const createdPanelWindow = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_MIN_HEIGHT,
    minWidth: PANEL_WIDTH,
    maxWidth: PANEL_WIDTH,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: "#282828",
    resizable: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    roundedCorners: true,
    hasShadow: true,
    title: "LuDone Desktop",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  panelWindow = createdPanelWindow;

  const panelContents = createdPanelWindow.webContents;
  let loadPromise;
  try {
    loadPromise = createdPanelWindow.loadFile(path.join(DIST_ROOT, "index.html"));
  } catch (error) {
    loadPromise = Promise.reject(error);
  }
  const readyForRetention = waitForPanelPromise(createdPanelWindow, panelContents, loadPromise, {
    failureReason: "načtení selhalo",
    timeoutMs: PANEL_LOAD_TIMEOUT_MS,
    timeoutReason: `načtení překročilo ${PANEL_LOAD_TIMEOUT_MS} ms`,
  });
  panelContents.on("render-process-gone", (_event, details) => {
    console.error(`[recording] Renderer skončil: ${JSON.stringify(details)}`);
    pendingTrayCommands.length = 0;
    forgetOwnerActivity(panelContents.id, "pád rendereru");
  });
  panelContents.on("render-process-gone", () => {
    if (trackingStore) handleRendererGone(trackingStore, {});
  });
  panelContents.once("destroyed", () => {
    pendingTrayCommands.length = 0;
    forgetOwnerActivity(panelContents.id, "zničení okna");
  });
  panelContents.on("did-start-navigation", (_event, _url, _isInPlace, isMainFrame) => {
    if (isMainFrame) {
      // Rychlá akce patří dokumentu, který byl aktivní při kliknutí. Zejména
      // staré „Ukončit nahrávání“ se nesmí po reloadu aplikovat na novou session.
      pendingTrayCommands.length = 0;
      forgetOwnerActivity(panelContents.id, "navigace nebo reload");
    }
  });
  panelWindow.once("ready-to-show", () => {
    positionPanel();
    panelWindow.show();
  });
  panelWindow.on("blur", () => {
    if (
      shouldHidePanelOnBlur({
        authAttemptsInFlight,
        isTestRun: IS_TEST_RUN,
        permissionPromptsInFlight,
        settingsVisible: Boolean(settingsWindow?.isVisible()),
      })
    ) {
      panelWindow.hide();
    }
  });
  panelWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      panelWindow.hide();
    }
  });
  return { readyForRetention, webContents: panelContents, window: createdPanelWindow };
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 448,
    height: 676,
    minWidth: 448,
    maxWidth: 448,
    minHeight: 676,
    maxHeight: 676,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: "#282828",
    resizable: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    roundedCorners: true,
    hasShadow: true,
    title: "Nastavení · LuDone",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  settingsWindow.loadFile(path.join(DIST_ROOT, "index.html"), { hash: "settings" });
  settingsWindow.once("ready-to-show", () => settingsWindow.show());
  settingsWindow.on("closed", () => {
    settingsWindow = undefined;
  });
}

function showPanel() {
  if (!panelWindow || panelWindow.isDestroyed()) return;
  positionPanel();
  panelWindow.show();
  panelWindow.focus();
}

function togglePanel() {
  if (!panelWindow) return;
  if (panelWindow.isVisible()) {
    panelWindow.hide();
  } else {
    showPanel();
  }
}

function queueTrayCommand(command) {
  if (!panelWindow || panelWindow.isDestroyed() || panelWindow.webContents.isDestroyed()) {
    return false;
  }
  pendingTrayCommands.push(command);
  try {
    // Událost pouze probudí preload. Samotný příkaz si renderer vyzvedne přes
    // validovaný handle níž, takže ho nemůže podvrhnout jiné okno.
    panelWindow.webContents.send(TRAY_COMMAND_CHANNEL);
    return true;
  } catch (error) {
    pendingTrayCommands.pop();
    console.error(`[tray] Rychlou akci se nepodařilo předat panelu: ${error.message}`);
    return false;
  }
}

function openLuDoneInBrowser() {
  let origin;
  try {
    origin = resolveCurrentAuthIssuer();
  } catch (error) {
    console.error(`[tray] LuDone nelze otevřít: ${error.message}`);
    return;
  }
  void Promise.resolve(shell.openExternal(origin)).catch((error) => {
    console.error(`[tray] LuDone nelze otevřít: ${error.message}`);
  });
}

function trayContextMenuTemplate() {
  const tracking = appState.trackingOwners.size > 0;
  return [
    {
      label: "Ukončit nahrávání",
      accelerator: "Control+Option+R",
      enabled: hasLiveRecording(),
      click: () => queueTrayCommand("stop-recording"),
    },
    {
      label: tracking ? "Zastavit měření času" : "Spustit LuTrack",
      accelerator: "Control+Option+T",
      enabled: true,
      click: () => queueTrayCommand(tracking ? "stop-tracking" : "start-tracking"),
    },
    { type: "separator" },
    {
      label: "Otevřít panel",
      accelerator: "Control+Option+L",
      click: showPanel,
    },
    {
      label: "Otevřít LuDone v prohlížeči",
      click: openLuDoneInBrowser,
    },
    { type: "separator" },
    {
      label: "Nastavení…",
      accelerator: "CommandOrControl+,",
      click: createSettingsWindow,
    },
    {
      label: "O aplikaci",
      click: () => app.showAboutPanel(),
    },
    { type: "separator" },
    {
      label: "Ukončit LuDone",
      accelerator: "CommandOrControl+Q",
      click: () => app.quit(),
    },
  ];
}

function showTrayContextMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate(trayContextMenuTemplate());
  tray.popUpContextMenu(menu);
}

function installMediaHandlers() {
  const defaultSession = session.defaultSession;
  defaultSession.setPermissionCheckHandler((webContents, permission, _origin, details) => (
    isAllowedMediaPermission(webContents, permission, details)
  ));
  defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(isAllowedMediaPermission(webContents, permission, details));
  });
  defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (
      !isTrustedPanelFrame(request.frame)
      || request.audioRequested !== true
      || request.videoRequested !== true
    ) {
      callback({});
      return;
    }

    try {
      const sources = await desktopCapturer.getSources({ types: ["screen"] });
      if (sources.length === 0) throw new Error("Nebyla nalezena žádná obrazovka");
      console.log(`[recording] Systémový zvuk povolen přes obrazovku ${JSON.stringify(sources[0].name)}.`);
      callback({ video: sources[0], audio: "loopback" });
    } catch (error) {
      console.error(`[recording] Získání systémového zvuku selhalo: ${error.stack || error.message}`);
      try {
        callback({});
      } catch (callbackError) {
        console.error(`[recording] Odmítnutí display capture selhalo: ${callbackError.message}`);
      }
    }
  }, { useSystemPicker: false });
}

async function openRecordingTrack(recordingsDirectory, prefix, source) {
  const suffix = RECORDING_TRACKS.get(source);
  const filePath = path.join(recordingsDirectory, `${prefix}-${suffix}.webm`);
  const handle = await fs.promises.open(filePath, "wx", 0o600);
  return {
    source,
    filePath,
    handle,
    nextSequence: 0,
    queue: Promise.resolve(),
    writeError: null,
  };
}

async function openRecordingExportStage(prefix) {
  const exportDirectory = path.join(app.getPath("temp"), "ludone-exporty");
  await fs.promises.mkdir(exportDirectory, { recursive: true, mode: 0o700 });
  const filePath = path.join(exportDirectory, `${prefix}-stereo.webm`);
  const handle = await fs.promises.open(filePath, "wx", 0o600);
  return {
    source: "stereo",
    filePath,
    handle,
    nextSequence: 0,
    queue: Promise.resolve(),
    writeError: null,
  };
}

async function recordingFileSha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function validRecordingTimestamp(value, field) {
  const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new TypeError(`${field} musí být platná ISO časová značka`);
  }
  return value;
}

function recordingTrackTiming(trackTimings, source, fallbackStartedAt, fallbackEndedAt) {
  if (trackTimings === undefined || trackTimings === null) {
    return { startedAt: fallbackStartedAt, endedAt: fallbackEndedAt };
  }
  if (!trackTimings || typeof trackTimings !== "object" || Array.isArray(trackTimings)) {
    throw new TypeError("Časy nahrávacích stop musí být objekt");
  }
  const timing = trackTimings[source];
  if (!timing || typeof timing !== "object" || Array.isArray(timing)) {
    throw new TypeError(`Chybí časování stopy ${source}`);
  }
  const startedAt = validRecordingTimestamp(timing.startedAt, `${source}.startedAt`);
  const endedAt = validRecordingTimestamp(timing.endedAt, `${source}.endedAt`);
  if (Date.parse(endedAt) < Date.parse(startedAt)) {
    throw new TypeError(`Stopa ${source} končí před svým začátkem`);
  }
  return { startedAt, endedAt };
}

function recordingManifestTracks(
  tracks,
  trackTimings,
  fallbackStartedAt,
  fallbackEndedAt = null,
  files = null,
) {
  return Object.fromEntries([...tracks].map(([source, track]) => [source, {
    fileName: path.basename(track.filePath),
    ...recordingTrackTiming(trackTimings, source, fallbackStartedAt, fallbackEndedAt),
    sizeBytes: files?.[source]?.size ?? 0,
    sha256: files?.[source]?.sha256 ?? null,
  }]));
}

function normalizeRecordingSources(value) {
  if (value === undefined) return [...RECORDING_TRACKS.keys()];
  if (!Array.isArray(value)) throw new TypeError("Seznam zdrojů nahrávání musí být pole");
  const requested = new Set();
  for (const source of value) {
    if (!RECORDING_TRACKS.has(source)) {
      throw new TypeError(`Neznámý zdroj nahrávání: ${String(source)}`);
    }
    if (requested.has(source)) {
      throw new TypeError(`Zdroj nahrávání ${source} je uveden dvakrát`);
    }
    requested.add(source);
  }
  if (!requested.has("microphone")) {
    throw new TypeError("Bez mikrofonu nelze nahrávání spustit");
  }
  return [...RECORDING_TRACKS.keys()].filter((source) => requested.has(source));
}

function createMicrophoneOnlyManifest(metadata, state) {
  return {
    schemaVersion: 1,
    clientRecordingId: metadata.clientRecordingId,
    createdAt: metadata.createdAt,
    closedAt: metadata.closedAt,
    state,
    tracks: { microphone: metadata.tracks.microphone },
  };
}

function recordingTracksPreservedMessage(recording) {
  return recording?.tracks?.size === 1
    ? RECORDING_EXPORT_MICROPHONE_PRESERVED
    : RECORDING_EXPORT_TRACKS_PRESERVED;
}

function completedRecordingTimeline(tracks) {
  const timings = tracks instanceof Map ? [...tracks.values()] : Object.values(tracks);
  const starts = timings.map(({ startedAt }) => Date.parse(startedAt));
  const ends = timings.map(({ endedAt }) => Date.parse(endedAt));
  return {
    startedAt: new Date(Math.min(...starts)).toISOString(),
    endedAt: new Date(Math.max(...ends)).toISOString(),
    trackStartDeltaMs: starts.length === 2 ? Math.abs(starts[0] - starts[1]) : null,
  };
}

async function createRecordingSession(event, sources) {
  requireTrustedRecordingSender(event);
  const ownerId = event.sender.id;
  if (recordingOwnersPreparing.has(ownerId) || [...recordingSessions.values()].some((activeSession) => (
    activeSession.ownerId === ownerId
  ))) {
    throw new Error("V tomto okně už jedna nahrávací session běží");
  }
  const startedAt = new Date();
  const preparation = { cancelled: false, startedAt: startedAt.toISOString() };
  recordingOwnersPreparing.set(ownerId, preparation);
  refreshTray();
  const tracks = new Map();
  let exportTrack;
  let manifestWasWritten = false;
  try {
    const timestamp = startedAt.toISOString().replace(/[:.]/g, "-");
    const sessionId = randomUUID();
    const prefix = `${timestamp}-${sessionId.slice(0, 8)}`;
    const recordingsDirectory = path.join(app.getPath("userData"), "nahravky");
    await fs.promises.mkdir(recordingsDirectory, { recursive: true, mode: 0o700 });

    for (const source of sources) {
      tracks.set(source, await openRecordingTrack(recordingsDirectory, prefix, source));
    }
    exportTrack = await openRecordingExportStage(prefix);
    if (preparation.cancelled || event.sender.isDestroyed()) {
      throw new Error("Příprava nahrávání byla zrušena při navigaci nebo pádu rendereru");
    }

    const manifestPath = path.join(recordingsDirectory, `${prefix}.manifest.json`);
    const { createManifest, transitionManifest, writeManifestAtomically } = await manifestModulePromise;
    const manifestMetadata = {
      clientRecordingId: sessionId,
      createdAt: startedAt.toISOString(),
      closedAt: null,
      tracks: recordingManifestTracks(tracks, null, startedAt.toISOString()),
    };
    const manifest = sources.length === 1
      ? createMicrophoneOnlyManifest(manifestMetadata, "recording")
      : createManifest(manifestMetadata, "recording");
    // Recovery kopie musí existovat dřív, než session ID dostane renderer a může poslat první chunk.
    const recoveryManifest = sources.length === 1
      ? createMicrophoneOnlyManifest(manifestMetadata, "incomplete")
      : transitionManifest(manifest, "incomplete");
    await writeManifestAtomically(manifestPath, recoveryManifest);
    manifestWasWritten = true;
    if (preparation.cancelled || event.sender.isDestroyed()) {
      throw new Error("Příprava nahrávání byla zrušena po zápisu obnovovacího manifestu");
    }

    const recordingSession = {
      sessionId,
      ownerId,
      owner: event.sender,
      startedAt: startedAt.toISOString(),
      tracks,
      manifest,
      manifestPath,
      finalizePromise: null,
      destroyedListener: null,
    };
    let resolveExportReady;
    const exportReady = new Promise((resolve) => {
      resolveExportReady = resolve;
    });
    const exportStage = {
      sessionId,
      ownerId,
      owner: event.sender,
      track: exportTrack,
      manifestPath,
      exportInFlight: false,
      finalizePromise: null,
      finalizationSettled: false,
      destroyedListener: null,
      ownerGone: false,
      preserveFileRequested: false,
      ready: exportReady,
      recordingFinishSucceeded: false,
      releaseRequested: false,
      resolveReady: resolveExportReady,
      result: null,
      timing: null,
      tracks,
    };
    recordingSession.destroyedListener = () => {
      void finalizeRecordingSession(sessionId, "incomplete").catch((error) => {
        console.error(`[recording] Finalizace po pádu rendereru selhala: ${error.stack || error.message}`);
      });
    };
    event.sender.once("destroyed", recordingSession.destroyedListener);
    exportStage.destroyedListener = () => {
      exportStage.ownerGone = true;
      requestRecordingExportStageRelease(exportStage, { preserveFile: true });
    };
    event.sender.once("destroyed", exportStage.destroyedListener);
    recordingSessions.set(sessionId, recordingSession);
    recordingExportStages.set(sessionId, exportStage);
    refreshTray();
    const preparationMessage = sources.length === 1
      ? "Připraven mikrofonní soubor"
      : "Připraveny oddělené soubory";
    console.log(`[recording] ${preparationMessage} s prefixem ${prefix}.`);
    return { sessionId, startedAt: recordingSession.startedAt };
  } catch (error) {
    await Promise.allSettled([...tracks.values()].map(async (track) => {
      await track.handle.close();
      if (!manifestWasWritten) await fs.promises.unlink(track.filePath).catch(() => {});
    }));
    if (exportTrack) {
      await exportTrack.handle.close().catch(() => {});
      await fs.promises.unlink(exportTrack.filePath).catch(() => {});
    }
    throw error;
  } finally {
    if (recordingOwnersPreparing.get(ownerId) === preparation) {
      recordingOwnersPreparing.delete(ownerId);
      refreshTray();
    }
  }
}

function ownedRecordingSession(event, sessionId) {
  requireTrustedRecordingSender(event);
  const recordingSession = recordingSessions.get(sessionId);
  if (!recordingSession || recordingSession.ownerId !== event.sender.id) {
    throw new Error("Neznámá nebo cizí nahrávací session");
  }
  if (recordingSession.finalizePromise) throw new Error("Nahrávací session se už uzavírá");
  return recordingSession;
}

function ownedRecordingExportStage(event, sessionId) {
  requireTrustedRecordingSender(event);
  const exportStage = recordingExportStages.get(sessionId);
  if (!exportStage || exportStage.ownerId !== event.sender.id) {
    throw new Error("Neznámý nebo cizí stereo export");
  }
  return exportStage;
}

async function appendRecordingChunk(event, sessionId, source, sequence, arrayBuffer) {
  const track = source === "stereo"
    ? ownedRecordingExportStage(event, sessionId).track
    : ownedRecordingSession(event, sessionId).tracks.get(source);
  if (!track) throw new Error("Neplatný zdroj nahrávacího chunku");
  if (source === "stereo" && recordingExportStages.get(sessionId)?.finalizePromise) {
    throw new Error("Stereo export se už uzavírá");
  }
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error("Neplatné pořadí nahrávacího chunku");
  }
  if (!(arrayBuffer instanceof ArrayBuffer)) throw new Error("Nahrávací chunk není ArrayBuffer");
  const bytes = Buffer.from(arrayBuffer);
  if (bytes.length === 0 || bytes.length > MAX_RECORDING_CHUNK_BYTES) {
    throw new Error(`Neplatná velikost nahrávacího chunku: ${bytes.length} B`);
  }

  const operation = track.queue.then(async () => {
    if (track.writeError) throw track.writeError;
    if (sequence !== track.nextSequence) {
      throw new Error(`Chybné pořadí chunku ${source}: čekám ${track.nextSequence}, přišlo ${sequence}`);
    }
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesWritten } = await track.handle.write(bytes, offset, bytes.length - offset, null);
      if (bytesWritten === 0) throw new Error(`Zápis chunku ${source} se zastavil`);
      offset += bytesWritten;
    }
    await track.handle.sync();
    track.nextSequence += 1;
    return { sequence, bytes: bytes.length };
  });
  track.queue = operation.catch((error) => {
    track.writeError = error;
  });
  return operation;
}

async function recordingFileHeader(filePath) {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(64 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function completeRecordingExportStageRelease(exportStage) {
  if (
    !exportStage.releaseRequested
    || !exportStage.finalizationSettled
    || exportStage.exportInFlight
    || recordingExportStages.get(exportStage.sessionId) !== exportStage
  ) return;
  recordingExportStages.delete(exportStage.sessionId);
  refreshTray();
  void maybeCompleteDeferredQuit();
  void tryInstallDownloadedUpdate();
}

function requestRecordingExportStageRelease(exportStage, { preserveFile = false } = {}) {
  if (recordingExportStages.get(exportStage.sessionId) !== exportStage) return;
  exportStage.releaseRequested = true;
  if (preserveFile) exportStage.preserveFileRequested = true;
  const settlement = exportStage.finalizePromise ?? finalizeRecordingExportStage(
    exportStage.sessionId,
    { succeeded: false, reason: "Vlastník stereo exportu už není dostupný" },
    { preserveFile },
  );
  void Promise.resolve(settlement).then(
    () => completeRecordingExportStageRelease(exportStage),
    () => {
      console.error("[recording-export] Uzavření opuštěného exportu selhalo; soubor zůstává zachovaný.");
    },
  );
  completeRecordingExportStageRelease(exportStage);
}

async function finalizeRecordingExportStage(sessionId, outcome, { preserveFile = false } = {}) {
  const exportStage = recordingExportStages.get(sessionId);
  if (!exportStage) return { ok: false, message: "Stereo export už není dostupný" };
  if (exportStage.finalizePromise) return exportStage.finalizePromise;

  exportStage.finalizePromise = (async () => {
    let firstError = null;
    try {
      await exportStage.track.queue;
      if (exportStage.track.writeError) throw exportStage.track.writeError;
      await exportStage.track.handle.sync();
    } catch (error) {
      firstError = error;
    } finally {
      try {
        await exportStage.track.handle.close();
      } catch (error) {
        firstError ??= error;
      }
    }

    let format;
    let timing;
    if (outcome?.succeeded === true && !firstError) {
      try {
        timing = {
          startedAt: validRecordingTimestamp(outcome.timing?.startedAt, "stereo.startedAt"),
          endedAt: validRecordingTimestamp(outcome.timing?.endedAt, "stereo.endedAt"),
        };
        if (Date.parse(timing.endedAt) <= Date.parse(timing.startedAt)) {
          throw new Error("Stereo export nemá kladnou délku");
        }
        format = inspectOpusWebm(await recordingFileHeader(exportStage.track.filePath));
      } catch (error) {
        firstError = error;
      }
    } else if (!firstError) {
      firstError = new Error("Příprava dvoukanálového souboru selhala");
    }

    if (firstError) {
      if (!preserveFile && !exportStage.preserveFileRequested) {
        await fs.promises.unlink(exportStage.track.filePath).catch(() => {});
      }
      exportStage.result = {
        ok: false,
        message: `Dvoukanálový export se nepodařilo připravit. ${recordingTracksPreservedMessage(exportStage)}`,
      };
    } else {
      exportStage.timing = timing;
      exportStage.result = { ok: true, format };
    }
    if (!exportStage.owner.isDestroyed()) {
      exportStage.owner.removeListener("destroyed", exportStage.destroyedListener);
    }
    exportStage.resolveReady(exportStage.result);
    return exportStage.result;
  })().finally(() => {
    exportStage.finalizationSettled = true;
    completeRecordingExportStageRelease(exportStage);
  });
  return exportStage.finalizePromise;
}

async function finalizeRecordingSession(sessionId, finalState, trackTimings = null) {
  if (finalState !== "complete" && finalState !== "incomplete") {
    throw new Error("Nahrávací session lze uzavřít jen jako complete nebo incomplete");
  }
  const recordingSession = recordingSessions.get(sessionId);
  if (!recordingSession) throw new Error("Neznámá nahrávací session");
  if (recordingSession.finalizePromise) return recordingSession.finalizePromise;

  // Přiřazení `finalizePromise` je okamžik, kdy session přestává být živé nahrávání.
  // `refreshTray()` musí přijít až ZA ním, jinak by ještě viděl starý stav.
  recordingSession.finalizePromise = (async () => {
    const files = {};
    const closedAt = new Date().toISOString();
    let stateToWrite = finalState;
    let validatedTrackTimings = trackTimings;
    let completionTimingError = null;
    if (finalState === "complete") {
      try {
        for (const source of recordingSession.tracks.keys()) {
          recordingTrackTiming(trackTimings, source, recordingSession.startedAt, closedAt);
        }
      } catch (error) {
        completionTimingError = error;
        stateToWrite = "incomplete";
        validatedTrackTimings = null;
      }
    }
    let firstError = null;
    for (const [source, track] of recordingSession.tracks) {
      try {
        await track.queue;
        if (track.writeError) throw track.writeError;
        await track.handle.sync();
      } catch (error) {
        firstError ??= error;
      } finally {
        try {
          await track.handle.close();
        } catch (error) {
          firstError ??= error;
        }
      }

      try {
        const stats = await fs.promises.stat(track.filePath);
        files[source] = {
          name: path.basename(track.filePath),
          size: stats.size,
          sha256: await recordingFileSha256(track.filePath),
        };
      } catch (error) {
        firstError ??= error;
      }
    }

    let finalManifest;
    if (!firstError) {
      try {
        const { transitionManifest, writeManifestAtomically } = await manifestModulePromise;
        const finalMetadata = {
          clientRecordingId: recordingSession.sessionId,
          createdAt: recordingSession.startedAt,
          closedAt,
          tracks: recordingManifestTracks(
            recordingSession.tracks,
            validatedTrackTimings,
            recordingSession.startedAt,
            closedAt,
            files,
          ),
        };
        finalManifest = recordingSession.tracks.size === 1
          ? createMicrophoneOnlyManifest(finalMetadata, stateToWrite)
          : transitionManifest(recordingSession.manifest, stateToWrite, finalMetadata);
        await writeManifestAtomically(recordingSession.manifestPath, finalManifest);
        recordingSession.manifest = finalManifest;
      } catch (error) {
        firstError ??= error;
      }
    }

    recordingSessions.delete(sessionId);
    refreshTray();
    if (!recordingSession.owner.isDestroyed()) {
      recordingSession.owner.removeListener("destroyed", recordingSession.destroyedListener);
    }
    if (firstError) throw firstError;
    if (completionTimingError) throw completionTimingError;
    const sizes = recordingSession.tracks.size === 1
      ? `mikrofon ${files.microphone.size} B`
      : `mikrofon ${files.microphone.size} B, systém ${files.system.size} B`;
    console.log(`[recording] Uloženo: ${sizes}.`);
    const timeline = completedRecordingTimeline(finalManifest.tracks);
    return {
      clientRecordingId: recordingSession.sessionId,
      ...timeline,
      files,
    };
  })();
  refreshTray();
  return recordingSession.finalizePromise;
}

function finalizeRecordingSessionsForOwner(ownerId, reason) {
  const preparation = recordingOwnersPreparing.get(ownerId);
  if (preparation) preparation.cancelled = true;
  for (const recordingSession of recordingSessions.values()) {
    if (recordingSession.ownerId !== ownerId) continue;
    void finalizeRecordingSession(recordingSession.sessionId, "incomplete").then((result) => {
      const sizes = result.files.system
        ? `mikrofon ${result.files.microphone.size} B, systém ${result.files.system.size} B`
        : `mikrofon ${result.files.microphone.size} B`;
      console.warn(`[recording] Session uzavřena po události „${reason}“: ${sizes}.`);
    }).catch((error) => {
      console.error(`[recording] Uzavření po události „${reason}“ selhalo: ${error.stack || error.message}`);
    }).finally(() => {
      void maybeCompleteDeferredQuit();
      void tryInstallDownloadedUpdate();
    });
  }
  for (const exportStage of recordingExportStages.values()) {
    if (exportStage.ownerId !== ownerId) continue;
    exportStage.ownerGone = true;
    requestRecordingExportStageRelease(exportStage, { preserveFile: true });
  }
  // Synchronně: přiřazení finalizePromise proběhlo před návratem z volání výš, takže
  // hasLiveRecording() už tady vrací false, aniž bychom čekali na zápis na disk.
  refreshTray();
}

// Okno zmizelo — zapomeň na všechno, co k němu patřilo. `appState.signedIn` se přitom
// NEMĚNÍ: pád okna nikoho neodhlásil, takže cílový stav je `idle`, ne `signed-out`.
//
// ⚠️ Ale bez příkras: hlavní proces se dnes o přihlášení dozvídá JEN z reportu rendereru.
// Když renderer spadne dřív, než první report pošle, zůstane `signedIn` na false a lišta
// ukáže `signed-out`. Skutečné vlastnictví session přijde s B8, který zapojí auth controller;
// do té doby je tohle chování popsané správně jen PO prvním reportu. Nepiš sem, že session
// vlastní main — zatím ji nevlastní.
function forgetOwnerActivity(ownerId, reason) {
  finalizeRecordingSessionsForOwner(ownerId, reason);
  appState.trackingOwners.delete(ownerId);
  appState.trackingStartedAtByOwner?.delete(ownerId);
  refreshTray();
}

onValidated("tray:report-facts", ["panel"], (event, facts) => {
  if (!applyReportedFacts(event.sender.id, facts)) {
    console.warn("[tray] Odmítnut neplatný report faktů; předchozí stav zachován.");
    return;
  }
  void maybeCompleteDeferredQuit();
});
handleValidated("tray:get-state", ["panel", "settings"], () => trayState);
handleValidated(TRAY_COMMAND_CHANNEL, ["panel"], (_event, ...extraPayload) => {
  if (extraPayload.length > 0) {
    throw new TypeError("Kanál rychlé akce nepřijímá data z rendereru");
  }
  // Jedna atomická dávka uchová pořadí a umožní nově načtenému preloadu
  // vyzvednout i události, jejichž probouzecí zpráva přišla před registrací listeneru.
  return pendingTrayCommands.splice(0);
});
handleValidated("test:click-tray", ["panel"], () => {
  if (!IS_TEST_RUN || !tray || !panelWindow) return { allowed: false, visible: false };
  tray.emit("click");
  return { allowed: true, visible: panelWindow.isVisible() };
});
onValidated("panel:hide", ["panel"], () => panelWindow?.hide());
handleValidated("panel:set-content-height", ["panel"], (_event, height, ...extraPayload) => {
  if (extraPayload.length > 0) {
    throw new TypeError("Výškový kanál přijímá právě jednu číselnou výšku");
  }
  return setPanelContentHeight(height);
});
onValidated("settings:open", ["panel"], () => createSettingsWindow());
onValidated("settings:close", ["settings"], () => settingsWindow?.close());
handleValidated("settings:get-device-name", ["settings"], (_event, ...extraPayload) => {
  requireNoPayload("settings:get-device-name", extraPayload);
  try {
    const deviceName = os.hostname().trim();
    return deviceName || "Název zařízení není známý";
  } catch {
    return "Název zařízení není známý";
  }
});
handleValidated("settings:get-dock-visible", ["settings"], (_event, ...extraPayload) => {
  requireNoPayload("settings:get-dock-visible", extraPayload);
  return dockVisibilityStore.get();
});
handleValidated(
  "settings:set-dock-visible",
  ["settings"],
  (_event, dockVisible, ...extraPayload) => {
    requireBooleanPayload("settings:set-dock-visible", dockVisible, extraPayload);
    return queueDockVisibility(dockVisible, { persist: true });
  },
);
handleValidated("settings:get-open-at-login", ["settings"], (_event, ...extraPayload) => {
  requireNoPayload("settings:get-open-at-login", extraPayload);
  return app.getLoginItemSettings().openAtLogin === true;
});
handleValidated(
  "settings:set-open-at-login",
  ["settings"],
  (_event, openAtLogin, ...extraPayload) => {
    requireBooleanPayload("settings:set-open-at-login", openAtLogin, extraPayload);
    app.setLoginItemSettings({ openAtLogin });
    // Nativní setter vrací void a může selhat bez JS výjimky. Renderer proto dostane
    // skutečný stav po zápisu, nikoli jen zopakovanou žádost.
    return app.getLoginItemSettings().openAtLogin === true;
  },
);
handleValidated("recording:begin", ["panel"], async (event, sources, ...extraPayload) => {
  if (extraPayload.length > 0) {
    throw new TypeError("Kanál recording:begin přijímá nejvýše jeden seznam zdrojů");
  }
  const normalizedSources = normalizeRecordingSources(sources);
  ensureNewActivityIsAllowed("nahrávání");
  await waitForOutboundQueueRecovery();
  ensureNewActivityIsAllowed("nahrávání");
  return createRecordingSession(event, normalizedSources);
});
handleValidated("recording:append", ["panel"], (event, sessionId, source, sequence, arrayBuffer) => (
  appendRecordingChunk(event, sessionId, source, sequence, arrayBuffer)
));
handleValidated("recording:finish-export", ["panel"], async (event, sessionId, outcome) => {
  const exportStage = ownedRecordingExportStage(event, sessionId);
  try {
    const result = await finalizeRecordingExportStage(sessionId, outcome);
    if (!result?.ok) {
      noteDeferredQuitFailure(
        `Příprava stereo exportu selhala: ${result?.message || "neznámý výsledek"}`,
      );
      requestRecordingExportStageRelease(exportStage);
    }
    return result;
  } finally {
    void maybeCompleteDeferredQuit();
  }
});

let outboundQueueStore;
let outboundQueueSendsInFlight = 0;
let markOutboundQueueRecoveryReady = () => {};
const outboundQueueRecoveryReady = new Promise((resolve) => {
  markOutboundQueueRecoveryReady = resolve;
});
let markOutboundQueueRetentionReady = () => {};
const outboundQueueRetentionReady = new Promise((resolve) => {
  markOutboundQueueRetentionReady = resolve;
});

const RETENTION_STORAGE_KEY = "ludone.prototype.settings";
const KNOWN_RETENTION_POLICIES = new Set(Object.values(RETENTION_POLICIES));

function outboundQueueFilePath() {
  return path.join(app.getPath("userData"), "queue", "outgoing.json");
}

async function readRetentionPolicy(panelStartup) {
  try {
    const loadResult = await panelStartup.readyForRetention;
    if (!loadResult.succeeded) {
      const detail = loadResult.error?.message || loadResult.reason;
      console.warn(`[retention] Panel není připraven; data zůstávají zachována: ${detail}`);
      return undefined;
    }
    const webContents = panelStartup.webContents;
    if (!isTrustedWebContents(webContents)) {
      console.warn("[retention] Renderer není důvěryhodný; data zůstávají zachována.");
      return undefined;
    }
    let readPromise;
    try {
      readPromise = webContents.executeJavaScript(
        `window.localStorage.getItem(${JSON.stringify(RETENTION_STORAGE_KEY)})`,
        true,
      );
    } catch (error) {
      readPromise = Promise.reject(error);
    }
    const readResult = await waitForPanelPromise(
      panelStartup.window,
      webContents,
      readPromise,
      {
        failureReason: "čtení nastavení selhalo",
        timeoutMs: RETENTION_READ_TIMEOUT_MS,
        timeoutReason: `čtení nastavení překročilo ${RETENTION_READ_TIMEOUT_MS} ms`,
      },
    );
    if (!readResult.succeeded) {
      const detail = readResult.error?.message || readResult.reason;
      console.warn(`[retention] Nastavení nelze přečíst; data zůstávají zachována: ${detail}`);
      return undefined;
    }
    if (!isTrustedWebContents(webContents)) {
      console.warn("[retention] Renderer během čtení změnil dokument; data zůstávají zachována.");
      return undefined;
    }
    const serialized = readResult.value;
    if (typeof serialized !== "string") return undefined;
    const settings = JSON.parse(serialized);
    if (
      !settings
      || typeof settings !== "object"
      || Array.isArray(settings)
      || !Object.prototype.hasOwnProperty.call(settings, "retention")
      || !KNOWN_RETENTION_POLICIES.has(settings.retention)
    ) {
      return undefined;
    }
    return settings.retention;
  } catch (error) {
    console.warn(`[retention] Nastavení nelze přečíst; data zůstávají zachována: ${error.message}`);
    return undefined;
  }
}

async function applyOutboundQueueRetention(panelStartup) {
  try {
    const filePath = outboundQueueFilePath();
    const queue = await loadQueue(filePath);
    const policy = await readRetentionPolicy(panelStartup);
    const result = await applyRetention({
      queue,
      policy,
      now: Date.now(),
      recordingsDirectory: path.join(app.getPath("userData"), "nahravky"),
    });
    if (result.deletedItems.length > 0) {
      await saveQueueAtomically(filePath, { ...queue, items: result.keptItems });
    }
    if (result.errors.length > 0) {
      console.error(`[retention] Některé soubory nešlo bezpečně odstranit: ${result.errors.length}.`);
    }
    return result;
  } catch {
    console.error("[retention] Úklid selhal; start pokračuje a data zůstávají zachována.");
    return {
      deletedFiles: [],
      deletedItems: [],
      keptItems: [],
      errors: [{ code: "RETENTION_FAILED" }],
    };
  }
}

function queueKillswitches() {
  return {
    DESKTOP_UPLOAD_ENABLED: process.env.DESKTOP_UPLOAD_ENABLED,
    DESKTOP_TIME_ENABLED: process.env.DESKTOP_TIME_ENABLED,
  };
}

async function recordingUploadContext() {
  const storedSession = await readStoredAuthSession();
  if (storedSession === null) return null;
  if (
    !Number.isFinite(storedSession.accessExpiresAt)
    || storedSession.accessExpiresAt <= Date.now()
  ) return null;
  return {
    accessToken: storedSession.accessToken,
    companyTabidooId: storedSession.companyTabidooId
      ?? storedSession.identity?.companyTabidooId,
    deviceLabel: app.getName?.() ?? "LuDone Desktop",
    issuer: storedSession.issuer,
  };
}

function createQueueSend() {
  // Store fronty zůstává po celý běh jediný. Konkrétní sender se vytvoří až pro
  // jednotlivý pokus, aby po bezpečném přepnutí použil právě platný origin.
  return async (item) => {
    if (authOriginChangeInFlight) {
      const error = new Error("Změna prostředí právě probíhá");
      error.failureClass = "paused";
      throw error;
    }
    outboundQueueSendsInFlight += 1;
    try {
      const send = createRecordingUploadSend({
        fetchImpl: (...args) => net.fetch(...args),
        getUploadContext: recordingUploadContext,
        logger: console,
        origin: resolveCurrentAuthIssuer(),
      });
      return await send(item);
    } finally {
      outboundQueueSendsInFlight -= 1;
    }
  };
}

async function getOutboundQueueStore() {
  await outboundQueueRetentionReady;
  if (!outboundQueueStore) {
    outboundQueueStore = createOutboundQueueStore({
      filePath: outboundQueueFilePath(),
      queueModulePromise,
      send: createQueueSend(),
    });
  }
  return outboundQueueStore;
}

async function waitForOutboundQueueRecovery() {
  await outboundQueueRecoveryReady;
}

async function recoverOutboundRecordings() {
  const result = await recoverOrphanedRecordings({
    logger: console,
    manifestModulePromise,
    queueStore: await getOutboundQueueStore(),
    recordingsDirectory: path.join(app.getPath("userData"), "nahravky"),
  });
  if (result.recovered > 0) {
    console.log(`[queue] Při startu obnoveno nahrávek: ${result.recovered}.`);
  }
  return result;
}

async function pumpOutboundQueue() {
  try {
    const store = await getOutboundQueueStore();
    const result = await store.pump(queueKillswitches());
    console.log(`[queue] ${result.reason ?? result.outcome}`);
    return result;
  } catch (error) {
    console.error(`[queue] Pumpa selhala: ${error.stack || error.message}`);
    return { outcome: "error", reason: error.message };
  }
}

async function waitForRecordingExportStage(exportStage) {
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve({
      ok: false,
      message: `Příprava dvoukanálového souboru nedoběhla včas. ${RECORDING_EXPORT_TRACKS_PRESERVED}`,
    }), EXPORT_STAGE_READY_TIMEOUT_MS);
  });
  return Promise.race([exportStage.ready, timeout]).finally(() => clearTimeout(timeoutId));
}

function recordingExportSystemCode(error) {
  const code = error && typeof error === "object" ? error.code : null;
  return typeof code === "string" && /^[A-Z][A-Z0-9_]*$/u.test(code) ? code : null;
}

function recordingExportFailureMessage(error, exportStage) {
  const detail = error instanceof RecordingExportUserError
    ? error.message
    : RECORDING_EXPORT_SYSTEM_ERRORS.get(recordingExportSystemCode(error))
      ?? RECORDING_EXPORT_GENERIC_ERROR;
  return `${detail} ${recordingTracksPreservedMessage(exportStage)}`;
}

function logRecordingExportFailure(error) {
  const code = recordingExportSystemCode(error);
  const codeDetail = code ? ` (kód ${code})` : "";
  console.error(
    `[recording-export] Export selhal${codeDetail}; původní stopy zůstaly uložené.`,
  );
}

async function exportCompletedRecording(event, clientRecordingId, recordingName) {
  const exportStage = ownedRecordingExportStage(event, clientRecordingId);
  let claimedExport = false;
  try {
    if (authOriginChangeInFlight) {
      throw new RecordingExportUserError("Handover nelze zahájit během změny prostředí");
    }
    if (exportStage.releaseRequested) {
      throw new RecordingExportUserError("Stereo export už není dostupný");
    }
    if (exportStage.exportInFlight) {
      throw new RecordingExportUserError("Stereo export už probíhá");
    }
    exportStage.exportInFlight = true;
    claimedExport = true;
    const ready = await waitForRecordingExportStage(exportStage);
    if (!ready.ok) return ready;
    const manifest = JSON.parse(await fs.promises.readFile(exportStage.manifestPath, "utf8"));
    if (manifest.clientRecordingId !== clientRecordingId) {
      throw new RecordingExportUserError("Identifikátor exportu nesouhlasí s manifestem");
    }
    const result = await exportRecordingCopy({
      downloadsDirectory: app.getPath("downloads"),
      manifest,
      openExternal: (url) => shell.openExternal(url),
      origin: resolveCurrentAuthIssuer(),
      recordingName,
      stagePath: exportStage.track.filePath,
      stereoTiming: exportStage.timing,
    });
    await fs.promises.unlink(exportStage.track.filePath).catch(() => {});
    recordingExportStages.delete(clientRecordingId);
    void maybeCompleteDeferredQuit();
    const timingDetail = result.trackStartDeltaMs === null
      ? "jednostopý režim bez porovnání stop"
      : `rozdíl startů ${result.trackStartDeltaMs} ms`;
    console.log(`[recording-export] Uloženo ${result.clientRecordingId}; ${timingDetail}.`);
    return {
      ok: true,
      clientRecordingId: result.clientRecordingId,
      fileName: result.fileName,
      format: result.format,
      startedAt: result.startedAt,
      endedAt: result.endedAt,
      trackStartDeltaMs: result.trackStartDeltaMs,
      trackDurationDeltaMs: result.trackDurationDeltaMs,
    };
  } catch (error) {
    if (error?.recordingExported === true) {
      return {
        ok: false,
        recordingExported: true,
        fileName: error.fileName,
        message: "Soubor je uložený ve Stažených, ale nahrávací stránku se nepodařilo otevřít. "
          + recordingTracksPreservedMessage(exportStage),
      };
    }
    // Systémová chyba může obsahovat cílovou cestu odvozenou z názvu schůzky.
    logRecordingExportFailure(error);
    return {
      ok: false,
      recordingExported: false,
      message: recordingExportFailureMessage(error, exportStage),
    };
  } finally {
    if (claimedExport) {
      exportStage.exportInFlight = false;
      completeRecordingExportStageRelease(exportStage);
    }
  }
}

async function finishRecordingAndEnqueue(event, sessionId, trackTimings) {
  const recordingSession = ownedRecordingSession(event, sessionId);
  recordingCompletionsInFlight.add(sessionId);
  try {
    let result;
    try {
      result = await finalizeRecordingSession(sessionId, "complete", trackTimings);
    } catch (error) {
      noteDeferredQuitFailure(`Čistá finalizace nahrávky selhala: ${error.message}`);
      showPanel();
      const exportStage = recordingExportStages.get(sessionId);
      if (exportStage) {
        requestRecordingExportStageRelease(exportStage, { preserveFile: true });
      }
      throw error;
    }

    try {
      const store = await getOutboundQueueStore();
      const queued = await store.enqueueRecording({
        manifest: recordingSession.manifest,
        manifestPath: recordingSession.manifestPath,
        trackPaths: Object.fromEntries(
          [...recordingSession.tracks].map(([source, track]) => [source, track.filePath]),
        ),
      });
      if (queued.added) {
        console.log(`[queue] Zařazeno ${queued.item.clientRecordingId} (recording).`);
      }
      const exportStage = recordingExportStages.get(sessionId);
      if (exportStage) exportStage.recordingFinishSucceeded = true;
    } catch (error) {
      console.error(`[queue] Zařazení nahrávky selhalo: ${error.stack || error.message}`);
      const exportStage = recordingExportStages.get(sessionId);
      noteDeferredQuitFailure(
        `Lokální zařazení nahrávky selhalo: ${error.message}`,
        { requiresUserConfirmation: true },
      );
      showPanel();
      if (exportStage) {
        requestRecordingExportStageRelease(exportStage, { preserveFile: true });
      }
      throw error;
    }
    return result;
  } finally {
    // Quit smí pokračovat až po dokončení manifestu i lokálního enqueue. Samostatná
    // evidence kryje mezeru, kdy už session zmizela z mapy, ale enqueue ještě běží.
    recordingCompletionsInFlight.delete(sessionId);
    void maybeCompleteDeferredQuit();
    void tryInstallDownloadedUpdate();
  }
}

handleValidated("recording:finish", ["panel"], finishRecordingAndEnqueue);
handleValidated("recording:export", ["panel"], exportCompletedRecording);
handleValidated("queue:list", ["panel", "settings"], async () => {
  await waitForOutboundQueueRecovery();
  return (await getOutboundQueueStore()).list();
});
handleValidated("queue:retry", ["panel"], async () => {
  await waitForOutboundQueueRecovery();
  const result = await (await getOutboundQueueStore()).retry(queueKillswitches());
  console.log(`[queue] ${result.reason ?? result.outcome}`);
  return result;
});

function readDiagnosticsPermissionStatus(mediaType) {
  try {
    return systemPreferences.getMediaAccessStatus(mediaType);
  } catch {
    return "unknown";
  }
}

async function readDiagnosticsQueueItems() {
  try {
    await waitForOutboundQueueRecovery();
    // list() je serializační bariéra. Teprve po ní čteme atomický soubor, aby
    // poslední potvrzené sentAt ani čerstvé položky nezůstaly jen v rozpracované operaci.
    await (await getOutboundQueueStore()).list();
    const queue = await loadQueue(outboundQueueFilePath());
    return Array.isArray(queue.items) ? queue.items : null;
  } catch {
    // Chyba může nést absolutní cestu. Do logu ani IPC proto neposíláme její text.
    console.warn("[diagnostics] Stav fronty není dostupný.");
    return null;
  }
}

async function createCurrentDiagnosticsSnapshot() {
  const { createDiagnosticsSnapshot } = await diagnosticsModulePromise;
  return createDiagnosticsSnapshot({
    appVersion: app.getVersion(),
    architecture: process.arch,
    microphoneStatus: readDiagnosticsPermissionStatus("microphone"),
    queueItems: await readDiagnosticsQueueItems(),
    // Onboarding pro ostatní zvuk používá tentýž stav Záznamu obrazovky.
    systemAudioStatus: readDiagnosticsPermissionStatus("screen"),
  });
}

async function exportCurrentDiagnostics() {
  const snapshot = await createCurrentDiagnosticsSnapshot();
  const { writeDiagnosticsExport } = await diagnosticsModulePromise;
  return writeDiagnosticsExport({
    downloadsDirectory: app.getPath("downloads"),
    exportedAt: new Date(),
    snapshot,
  });
}

const TRACKING_STORE_OWNER_ID = "main-process-timer";
let trackingStore;
let trackingStoreReady;

function getTrackingStore() {
  if (!trackingStore) {
    trackingStore = createTrackingStore({
      filePath: path.join(app.getPath("userData"), "cas", "casovac.json"),
      timeEnabled: process.env.DESKTOP_TIME_ENABLED,
      processStartedAt: PROCESS_STARTED_AT,
    });
  }
  return trackingStore;
}

function syncTrackingTray(store) {
  const currentEntry = store.getState().aktualni;
  const trackingStartedAtByOwner = appState.trackingStartedAtByOwner
    ?? (appState.trackingStartedAtByOwner = new Map());
  if (currentEntry?.state === TRACKING_STATES.RUNNING) {
    appState.trackingOwners.add(TRACKING_STORE_OWNER_ID);
    const rawStartedAt = currentEntry.startedAtRaw ?? currentEntry.startedAt;
    const parsedStartedAt = typeof rawStartedAt === "number" ? rawStartedAt : Date.parse(rawStartedAt);
    trackingStartedAtByOwner.set(
      TRACKING_STORE_OWNER_ID,
      Number.isFinite(parsedStartedAt) ? parsedStartedAt : Date.now(),
    );
  } else {
    appState.trackingOwners.delete(TRACKING_STORE_OWNER_ID);
    trackingStartedAtByOwner.delete(TRACKING_STORE_OWNER_ID);
  }
  refreshTray();
}

async function getReadyTrackingStore() {
  const store = getTrackingStore();
  if (!trackingStoreReady) {
    trackingStoreReady = store.load().then(() => {
      syncTrackingTray(store);
      return store;
    });
  }
  return trackingStoreReady;
}

async function runTrackingMutation(method, payload) {
  const store = await getReadyTrackingStore();
  const result = await store[method](payload);
  syncTrackingTray(store);
  if (
    process.env.DESKTOP_TIME_ENABLED === "true"
    && result.closed
    && result.closed.closedReason !== "zahozeno-clovekem"
  ) {
    try {
      const queueStore = await getOutboundQueueStore();
      const queued = await queueStore.enqueueTimeEntry({
        clientTimeEntryId: result.closed.clientTimeEntryId,
        projectId: result.closed.projectId,
        startedAt: result.closed.startedAt,
        endedAt: result.closed.endedAt,
      });
      if (queued.added) {
        console.log(`[queue] Zařazeno ${queued.item.clientRecordingId} (time).`);
      }
    } catch (error) {
      console.error(`[queue] Zařazení času selhalo: ${error.stack || error.message}`);
    }
  }
  return result;
}

function trackTrackingMutation(promise, method) {
  const trackedMutation = { method, promise: undefined };
  trackedMutation.promise = Promise.resolve(promise).finally(() => {
    trackingMutationsInFlight.delete(trackedMutation);
    void maybeCompleteDeferredQuit();
  });
  trackingMutationsInFlight.add(trackedMutation);
  return trackedMutation.promise;
}

function recordingInterruptionIsBlocked() {
  return recordingOwnersPreparing.size > 0
    || recordingSessions.size > 0
    || recordingCompletionsInFlight.size > 0
    || recordingExportStages.size > 0;
}

function recordingExportAwaitsUserDecision() {
  return [...recordingExportStages.values()].some((stage) => (
    stage.recordingFinishSucceeded
    && !stage.releaseRequested
    && !stage.ownerGone
  ));
}

function trackingWorkBlocksQuit() {
  return trackingMutationsInFlight.size > 0 || appState.trackingOwners.size > 0;
}

function quitActivitySnapshot() {
  const pendingExports = recordingExportStages.size;
  return `přípravy=${recordingOwnersPreparing.size}, session=${recordingSessions.size}, `
    + `dokončení=${recordingCompletionsInFlight.size}, finalizace-exportu=${pendingExports}, `
    + `mutace-lutrack=${trackingMutationsInFlight.size}, lutrack=${appState.trackingOwners.size}`;
}

function noteDeferredQuitFailure(reason, { requiresUserConfirmation = false } = {}) {
  const request = deferredQuitRequest;
  if (!request || request.committed) return;
  const isNewFailure = !request.failureReason;
  if (isNewFailure) request.failureReason = reason;
  const upgradesConfirmation = requiresUserConfirmation && !request.userConfirmationRequired;
  if (upgradesConfirmation) {
    request.userConfirmationRequired = true;
    console.error(`[quit] ${reason}; ukončení čeká na opakované potvrzení uživatele.`);
    showPanel();
    return;
  }
  if (!isNewFailure) return;
  console.error(`[quit] ${reason}; po dokončení zbývající práce se aplikace přesto ukončí.`);
}

function ensureNewActivityIsAllowed(activity) {
  if (authOriginChangeInFlight) {
    throw new Error(`Prostředí se mění; nové ${activity} teď nelze spustit`);
  }
  if (!isQuitting && (!deferredQuitRequest || deferredQuitRequest.committed)) return;
  throw new Error(`Aplikace se ukončuje; nové ${activity} už nelze spustit`);
}

function commitDeferredQuit({ forced = false, reason = "" } = {}) {
  const request = deferredQuitRequest;
  if (!request || request.committed) return;
  request.committed = true;
  clearTimeout(request.timeoutId);
  isQuitting = true;
  if (forced) {
    console.error(
      `[quit] ${reason}; následuje vynucené ukončení. ${quitActivitySnapshot()}`,
    );
  } else {
    console.log("[quit] Aktivní agendy jsou čistě zastavené a zapsané; pokračuji v ukončení.");
  }
  app.quit();
}

async function maybeCompleteDeferredQuit() {
  const request = deferredQuitRequest;
  if (!request || request.committed || request.completionCheckInFlight) return;
  if (!request.trackingSettled) return;

  if (request.recordingStopDeliveryFailed) {
    commitDeferredQuit({ forced: true, reason: request.failureReason });
    return;
  }
  if (request.userConfirmationRequired) return;
  if (recordingInterruptionIsBlocked() || trackingMutationsInFlight.size > 0) return;
  if (request.failureReason) {
    commitDeferredQuit({ forced: true, reason: request.failureReason });
    return;
  }
  if (appState.trackingOwners.size > 0) {
    commitDeferredQuit({
      forced: true,
      reason: "LuTrack po pokusu o čisté zastavení stále hlásí běh",
    });
    return;
  }

  request.completionCheckInFlight = true;
  try {
    // `list()` je serializační bariéra stejná jako u updateru: nedovolí quitu
    // předběhnout enqueue, které navazuje na zápis kompletního manifestu.
    await (await getOutboundQueueStore()).list();
    if (deferredQuitRequest !== request || request.committed) return;
    if (
      !request.trackingSettled
      || recordingInterruptionIsBlocked()
      || trackingMutationsInFlight.size > 0
    ) return;
    if (appState.trackingOwners.size > 0) {
      commitDeferredQuit({
        forced: true,
        reason: "LuTrack se znovu rozběhl během kontroly bezpečného ukončení",
      });
      return;
    }
    commitDeferredQuit();
  } catch (error) {
    if (deferredQuitRequest !== request || request.committed) return;
    commitDeferredQuit({
      forced: true,
      reason: `Bezpečný zápis před ukončením nelze ověřit: ${error.message}`,
    });
  } finally {
    request.completionCheckInFlight = false;
  }
}

function beginDeferredQuit() {
  if (deferredQuitRequest) return;
  const hasRecording = recordingInterruptionIsBlocked();
  const hasTracking = trackingWorkBlocksQuit();
  const request = {
    committed: false,
    completionCheckInFlight: false,
    failureReason: "",
    recordingStopDeliveryFailed: false,
    timeoutId: undefined,
    trackingSettled: !hasTracking,
    userConfirmationRequired: false,
  };
  deferredQuitRequest = request;

  // 15 sekund odpovídá existujícímu limitu stereo finalizace. Chunky jsou průběžně
  // fsyncnuté, takže zbývá flush, hash, manifest a lokální enqueue; po této lhůtě
  // je důležitější nezamknout uživatele v aplikaci a quit se hlasitě vynutí.
  request.timeoutId = setTimeout(() => {
    if (request.userConfirmationRequired || recordingExportAwaitsUserDecision()) {
      console.warn("[quit] Ukončení zůstává odložené, dokud uživatel nerozhodne o uložené nahrávce.");
      return;
    }
    commitDeferredQuit({
      forced: true,
      reason: `Čisté zastavení se nedokončilo do ${GRACEFUL_QUIT_TIMEOUT_MS} ms`,
    });
  }, GRACEFUL_QUIT_TIMEOUT_MS);

  if (hasRecording && hasLiveRecording() && !queueTrayCommand("stop-recording")) {
    request.recordingStopDeliveryFailed = true;
    request.failureReason = "Příkaz k čistému zastavení nahrávání se nepodařilo předat";
    console.error(`[quit] ${request.failureReason}; aplikace se přesto ukončí.`);
  }

  if (hasTracking) {
    void Promise.resolve()
      // TDD_OPRAVA_QUIT_ZAVODY_20260903: nejprve doběhnou mutace, které začaly před
      // žádostí o quit. Start se tak nemůže zapsat až za naším stopem.
      .then(() => Promise.allSettled(
        [...trackingMutationsInFlight].map((mutation) => mutation.promise),
      ))
      .then(() => {
        if (request.committed || appState.trackingOwners.size === 0) return null;
        return trackTrackingMutation(runTrackingMutation("stop"), "stop");
      })
      .then((result) => {
        if (request.committed || result === null) return;
        if (result?.outcome !== "stopped") {
          throw new Error(`hlavní proces vrátil výsledek „${result?.outcome ?? "neznámý"}“`);
        }
        // Rendererový report může ještě obsahovat starý fakt. Perzistentní store je po
        // úspěšném stopu autorita a aplikace se stejně bezprostředně ukončí.
        appState.trackingOwners.clear();
        appState.trackingStartedAtByOwner.clear();
        refreshTray();
      })
      .catch((error) => {
        noteDeferredQuitFailure(`Čisté zastavení LuTracku selhalo: ${error.message}`);
      })
      .finally(() => {
        request.trackingSettled = true;
        void maybeCompleteDeferredQuit();
      });
  }

  void maybeCompleteDeferredQuit();
}

handleValidated("tracking:start", ["panel"], (_event, payload) => {
  ensureNewActivityIsAllowed("měření času");
  return trackTrackingMutation(runTrackingMutation("start", payload), "start");
});
handleValidated("tracking:switch-project", ["panel"], (_event, payload) => {
  ensureNewActivityIsAllowed("přepnutí měření času");
  return trackTrackingMutation(
    runTrackingMutation("switchProject", payload),
    "switchProject",
  );
});
handleValidated("tracking:stop", ["panel"], () => (
  trackTrackingMutation(runTrackingMutation("stop"), "stop")
));
handleValidated("tracking:get-state", ["panel", "settings"], async () => {
  const store = await getReadyTrackingStore();
  return store.getState();
});
handleValidated("tracking:resolve-recovered", ["panel"], (_event, payload) => {
  ensureNewActivityIsAllowed("obnovení měření času");
  return trackTrackingMutation(
    runTrackingMutation("resolveRecovered", payload),
    "resolveRecovered",
  );
});

// Automatické aktualizace jsou schválně uzavřené v jednom bloku. Updater se načítá až
// v zabalené aplikaci, takže vývoj, unit testy ani GUI měřidla nemohou sáhnout na síť.
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000;
const UPDATE_INSTALL_RETRY_MS = 30_000;
let autoUpdateClient;
let updateCheckInFlight = false;
let updateInstallAttemptInFlight = false;
let updateInstallCommitted = false;
let downloadedUpdatePending = false;
let updateInstallRetryTimer;
let updateRelevantActivityGeneration = 0;

function noteUpdateRelevantActivity(channel) {
  if (
    channel === "tray:report-facts"
    || channel.startsWith("recording:")
    || (channel.startsWith("tracking:") && channel !== "tracking:get-state")
  ) {
    updateRelevantActivityGeneration += 1;
  }
}

function updateBlockingActivityIsRunning() {
  // Session zůstává v mapě až do fsync a zápisu manifestu; následné zařazení chrání
  // serializační bariéra fronty níž. Export stage se smaže až po potvrzeném
  // `recording:export`, takže zahrnuje i uloženou nahrávku čekající na pojmenování.
  return recordingInterruptionIsBlocked()
    || appState.trackingOwners.size > 0;
}

function ensureUpdateInstallRetry() {
  if (updateInstallRetryTimer) return;
  updateInstallRetryTimer = setInterval(() => {
    void tryInstallDownloadedUpdate();
  }, UPDATE_INSTALL_RETRY_MS);
  updateInstallRetryTimer.unref?.();
}

function clearUpdateInstallRetry() {
  if (!updateInstallRetryTimer) return;
  clearInterval(updateInstallRetryTimer);
  updateInstallRetryTimer = undefined;
}

async function updateRestartIsSafe() {
  await waitForOutboundQueueRecovery();
  if (updateBlockingActivityIsRunning()) return false;
  const observedActivityGeneration = updateRelevantActivityGeneration;

  try {
    // Perzistentní LuTrack se musí načíst dřív, než prohlásíme aplikaci za neaktivní.
    const store = await getReadyTrackingStore();
    // `load()` je zároveň bariéra interní fronty start/stop/switch a vrací stav z disku.
    await store.load();
    syncTrackingTray(store);
  } catch (error) {
    console.error(
      `[updater] Stav LuTracku nelze ověřit; restart se odkládá: ${error.message}`,
    );
    return false;
  }
  if (
    updateBlockingActivityIsRunning()
    || updateRelevantActivityGeneration !== observedActivityGeneration
  ) return false;

  try {
    // `list()` je serializační bariéra: počká i na právě dokončované zařazení nahrávky.
    await (await getOutboundQueueStore()).list();
  } catch (error) {
    console.error(`[updater] Frontu nelze ověřit; restart se odkládá: ${error.message}`);
    return false;
  }
  return !updateBlockingActivityIsRunning()
    && updateRelevantActivityGeneration === observedActivityGeneration;
}

async function tryInstallDownloadedUpdate() {
  if (
    !downloadedUpdatePending
    || updateInstallAttemptInFlight
    || updateInstallCommitted
    || !autoUpdateClient
  ) return;

  updateInstallAttemptInFlight = true;
  try {
    if (!(await updateRestartIsSafe())) return;
    updateInstallCommitted = true;
    downloadedUpdatePending = false;
    clearUpdateInstallRetry();
    console.log("[updater] Stažená aktualizace se instaluje; aplikace se restartuje.");
    // electron-updater zavírá okna ještě před Electron událostí before-quit. Flag proto
    // nastavujeme sami a IPC od této chvíle nepřijme novou nahrávku ani LuTrack.
    isQuitting = true;
    autoUpdateClient.quitAndInstall(false, true);
  } catch (error) {
    isQuitting = false;
    updateInstallCommitted = false;
    downloadedUpdatePending = true;
    ensureUpdateInstallRetry();
    console.error(`[updater] Instalaci nelze spustit; zkusím ji později: ${error.message}`);
  } finally {
    updateInstallAttemptInFlight = false;
  }
}

async function checkForApplicationUpdate() {
  if (!autoUpdateClient || updateCheckInFlight) return;
  updateCheckInFlight = true;
  try {
    const result = await autoUpdateClient.checkForUpdates();
    await result?.downloadPromise;
  } catch (error) {
    console.error(`[updater] Kontrola aktualizace selhala: ${error.message}`);
  } finally {
    updateCheckInFlight = false;
  }
}

async function initializeAutoUpdates() {
  if (IS_TEST_RUN) {
    console.log("[updater] V E2E běhu jsou automatické aktualizace vypnuté.");
    return;
  }
  if (!app.isPackaged) {
    console.log("[updater] Ve vývojovém běhu jsou automatické aktualizace vypnuté.");
    return;
  }

  try {
    ({ autoUpdater: autoUpdateClient } = require("electron-updater"));
  } catch (error) {
    console.error(`[updater] Modul se nepodařilo načíst: ${error.message}`);
    return;
  }

  autoUpdateClient.autoDownload = true;
  // Aktualizaci nikdy nenecháme vynutit při quit události mimo naši kontrolu aktivity.
  autoUpdateClient.autoInstallOnAppQuit = false;
  autoUpdateClient.on("update-downloaded", (info) => {
    const version = typeof info?.version === "string" ? info.version : "neznámá";
    console.log(`[updater] Verze ${version} je stažená; čekám na bezpečný restart.`);
    downloadedUpdatePending = true;
    ensureUpdateInstallRetry();
    void tryInstallDownloadedUpdate();
  });
  autoUpdateClient.on("error", (error) => {
    console.error(`[updater] Chyba aktualizace: ${error?.message || "neznámá chyba"}`);
    if (updateInstallCommitted) {
      updateInstallCommitted = false;
      downloadedUpdatePending = true;
      isQuitting = false;
      ensureUpdateInstallRetry();
    }
  });

  void checkForApplicationUpdate();
  const checkTimer = setInterval(() => {
    void checkForApplicationUpdate();
  }, UPDATE_CHECK_INTERVAL_MS);
  checkTimer.unref?.();

  try {
    await getReadyTrackingStore();
  } catch (error) {
    // Kontroly a stažení smějí pokračovat, jen bezpečnostní brána restart nepovolí.
    console.error(`[updater] Stav LuTracku se při startu nenačetl: ${error.message}`);
  }
}

// Běžný tok clientId nepředává: auth.cjs si veřejného klienta zaregistruje přes
// registration_endpoint právě zvoleného issueru. Volitelný override zůstává pro
// cílené testy a provozní konfiguraci, ale prázdná hodnota DCR nevypíná.
function resolveAuthClientId(env) {
  const value = env?.LUDONE_OAUTH_CLIENT_ID;
  if (value === undefined || (typeof value === "string" && value.trim().length === 0)) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error("Identifikátor klienta OAuth má neplatný typ");
  }
  return value.trim();
}

function resolveAuthIssuer(env, storedOrigin = "https://app.ludone.cz") {
  const value = env?.LUDONE_ORIGIN ?? storedOrigin;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Adresa přihlášení není nastavená");
  }

  let issuer;
  try {
    issuer = new URL(value);
  } catch {
    throw new Error("Adresa přihlášení není platná");
  }
  if (
    issuer.protocol !== "https:"
    || issuer.username
    || issuer.password
    || issuer.pathname !== "/"
    || issuer.search
    || issuer.hash
  ) {
    throw new Error("Adresa přihlášení musí být čistý HTTPS origin");
  }
  if (!["app.ludone.cz", "labs.ludone.cz"].includes(issuer.host)) {
    throw new Error("Adresa přihlášení míří na nepovoleného hostitele");
  }
  return issuer.origin;
}

function resolveCurrentAuthIssuer() {
  return resolveAuthIssuer(process.env, authOriginStore.get());
}

function createAuthBeginHandler(createController) {
  return function configureAuthBegin({
    app,
    coordinator,
    env,
    getStoredOrigin,
    isTestRun,
    logger,
    publishAuthorizationUrl,
    safeStorage,
    shell,
  }) {
    // TDD_OPRAVA_AUTH_GENERACE_20260903: pouze nejnovější souběžný pokus smí
    // zveřejnit nebo smazat svou URL. Cancel staršího pokusu může doběhnout později.
    let authorizationUrlGeneration = 0;

    function publishAuthorizationUrlFor(generation, url) {
      if (generation === authorizationUrlGeneration) publishAuthorizationUrl?.(url);
    }

    function writeAuthLog(level, line) {
      try {
        const pending = logger?.[level]?.(line);
        pending?.catch?.(() => {});
      } catch {
        // Selhání diagnostiky nesmí změnit výsledek přihlášení.
      }
    }

    function authErrorClassName(error) {
      try {
        if (!(error instanceof Error)) return typeof error;
        const name = Object.getPrototypeOf(error)?.constructor?.name;
        const isSafeName = typeof name === "string"
          && /^[A-Za-z_$][A-Za-z0-9_$]{0,79}(?:Error|Exception)$/.test(name)
          && !/token|bearer|code|verifier|e-?mail|name|user/i.test(name);
        return isSafeName ? name : "Error";
      } catch {
        return "Error";
      }
    }

    function authErrorMessage(error) {
      try {
        const value = error instanceof Error ? error.message : error;
        return typeof value === "string" ? value : String(value);
      } catch {
        return "Chybovou zprávu se nepodařilo přečíst";
      }
    }

    function authErrorMessageForLog(message) {
      try {
        const normalized = Array.from(String(message), (character) => {
          const codePoint = character.codePointAt(0);
          const isControl = codePoint <= 0x1f
            || (codePoint >= 0x7f && codePoint <= 0x9f)
            || (codePoint >= 0x2028 && codePoint <= 0x202e)
            || (codePoint >= 0x2066 && codePoint <= 0x2069);
          return isControl ? " " : character;
        })
          .join("")
          .replace(/ +/g, " ")
          .trim();
        const containsSensitiveValue = [
          /token/i,
          /\bbearer\b/i,
          /\b(?:pkce[ _-]?)?verifier\b/i,
          /code[_ -]?verifier/i,
          /(?:authorization|authorisation|auth)[_ -]?code/i,
          /autorizační(?:ho)?[ _-]*k[oó]d(?:u)?/i,
          /(?:^|[^A-Za-z0-9_])["']?code["']?\s*[:=]/i,
          /["']?code["']?\s+(?:is|was|je|byl)\b/i,
          /[^\s@]+@[^\s@]+/u,
          /(?:^|[^A-Za-z0-9_])["']?(?:e-?mail|display[_ -]?name|full[_ -]?name|first[_ -]?name|last[_ -]?name|given[_ -]?name|family[_ -]?name|preferred[_ -]?username|username|user[_ -]?name|name|jméno|user)["']?\s*[:=]/i,
          /\b(?:client[_ -]?secret|password|heslo)\b/i,
          /\b[A-Za-z0-9_-]{32,}\b/,
        ].some((pattern) => pattern.test(normalized));
        if (containsSensitiveValue) return "[citlivý obsah skryt]";
        return normalized.length > 500 ? `${normalized.slice(0, 500)}…` : normalized;
      } catch {
        return "[zprávu se nepodařilo bezpečně přečíst]";
      }
    }

    return async function beginAuth({ signal } = {}) {
      const publicationGeneration = authorizationUrlGeneration + 1;
      authorizationUrlGeneration = publicationGeneration;
      // První pokus začíná nad procesním `null`; retry navíc synchronně smaže URL
      // předchozího pokusu ještě před asynchronním `controller.start()`.
      if (publicationGeneration > 1) publishAuthorizationUrlFor(publicationGeneration, null);
      if (isTestRun && app?.isPackaged !== true) {
        return {
          ok: true,
          user: { name: "Testovací uživatel", email: "test@ludone.cz" },
        };
      }

      try {
        const issuer = resolveAuthIssuer(env, getStoredOrigin?.());
        const clientId = resolveAuthClientId(env);

        writeAuthLog("log", "[auth] Přihlášení zahájeno");
        const controllerOptions = {
          issuer,
          app,
          coordinator,
          safeStorage,
          shell,
        };
        if (clientId !== undefined) controllerOptions.clientId = clientId;
        const controller = createController(controllerOptions);
        const attempt = await controller.start();
        // Čekací obrazovka potřebuje URL, dokud pokus běží — když se prohlížeč neotevře,
        // je to jediná cesta uživatele dál. Po skončení pokusu MUSÍ zmizet: stará URL
        // už nikam nevede a otevřít ji podruhé znamená přihlášení, které nikdo nečeká.
        publishAuthorizationUrlFor(publicationGeneration, attempt.authorizationUrl ?? null);
        const cancel = () => attempt.cancel();
        if (signal?.aborted) {
          cancel();
        } else {
          signal?.addEventListener?.("abort", cancel, { once: true });
        }

        try {
          const result = await attempt.result;
          const rawName = result?.user?.name;
          const rawEmail = result?.user?.email;
          const name = typeof rawName === "string" && rawName.length > 0 ? rawName : null;
          const email = typeof rawEmail === "string" && rawEmail.length > 0 ? rawEmail : null;
          writeAuthLog("log", "[auth] Přihlášení dokončeno úspěšně");
          return { ok: true, user: { name, email } };
        } finally {
          signal?.removeEventListener?.("abort", cancel);
          publishAuthorizationUrlFor(publicationGeneration, null);
        }
      } catch (error) {
        const message = authErrorMessage(error);
        let duvod = "neznama";
        if (/časovém limitu/i.test(message)) {
          duvod = "vyprselo";
        } else if (/access_denied|Chybí autorizační kód|zrušeno/i.test(message)) {
          duvod = "odmitnuto";
        } else if (/Bezpečné úložiště|cílové úložiště/i.test(message)) {
          duvod = "uloziste";
        } else if (
          // 🔴 Klasifikuje se podle VĚT, které sami házíme, ne podle volného podřetězce.
          // Dřív tu stálo i holé `clientId`, a to je natolik volné, že se do „konfigurace"
          // trefila i programátorská chyba `ReferenceError: resolveAuthClientId is not
          // defined` — uživatel by dostal „doplní správce" u vady, kterou žádný správce
          // neopraví. Chyba, kterou neumíme zařadit, musí zůstat „neznama".
          /Adresa přihlášení|HTTPS origin|Identifikátor klienta OAuth|OAuth issuer|MCP resource|MCP scopy|Chybí Electron/i.test(message)
        ) {
          duvod = "konfigurace";
        } else if (error instanceof TypeError || /fetch failed|net::ERR_|ENOTFOUND|ECONNREFUSED/i.test(message)) {
          duvod = "bez-site";
        }
        const response = { ok: false, duvod };
        const detail = duvod === "neznama"
          ? `; ${authErrorClassName(error)}: ${authErrorMessageForLog(message)}`
          : "";
        writeAuthLog("warn", `[auth] Přihlášení skončilo: ${JSON.stringify(response)}${detail}`);
        return response;
      }
    };
  };
}

const authSessionCoordinator = createAuthSessionCoordinator();
// Drží se jen po dobu běžícího pokusu; `beginAuth` ji sám nuluje ve svém finally.
let pendingAuthorizationUrl = null;

const beginAuth = createAuthBeginHandler(createAuthController)({
  app,
  coordinator: authSessionCoordinator,
  env: process.env,
  getStoredOrigin: () => authOriginStore.get(),
  isTestRun: IS_TEST_RUN,
  logger: console,
  publishAuthorizationUrl: (url) => {
    pendingAuthorizationUrl = typeof url === "string" && url.length > 0 ? url : null;
  },
  safeStorage,
  shell,
});

async function readStoredAuthSession() {
  const generation = authSessionGeneration;
  if (authLogoutsInFlight > 0) return null;

  let encryptionAvailable;
  try {
    encryptionAvailable = safeStorage?.isEncryptionAvailable?.() === true;
  } catch {
    throw new Error("Bezpečné úložiště identity není dostupné");
  }
  if (!encryptionAvailable) {
    throw new Error("Bezpečné úložiště identity není dostupné");
  }

  let encrypted;
  try {
    encrypted = await fs.promises.readFile(tokenSessionFilePath(app));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error("Uloženou identitu se nepodařilo načíst");
  }

  let storedSession;
  try {
    const sessionValue = safeStorage.decryptString(encrypted);
    storedSession = JSON.parse(sessionValue);
  } catch {
    throw new Error("Uloženou identitu se nepodařilo přečíst");
  }
  if (!storedSession || typeof storedSession !== "object" || Array.isArray(storedSession)) {
    throw new Error("Uložená session identity má neplatný formát");
  }
  const hasAccessToken = typeof storedSession.accessToken === "string"
    && storedSession.accessToken.length > 0;
  const hasRefreshToken = typeof storedSession.refreshToken === "string"
    && storedSession.refreshToken.length > 0;
  const hasRequiredMetadata = [
    storedSession.clientId,
    storedSession.resource,
    storedSession.scope,
  ].every((value) => typeof value === "string" && value.length > 0);
  let hasValidIssuer = false;
  try {
    const issuer = new URL(storedSession.issuer);
    hasValidIssuer = issuer.protocol === "https:"
      && issuer.username === ""
      && issuer.password === ""
      && issuer.pathname === "/"
      && issuer.search === ""
      && issuer.hash === ""
      && storedSession.issuer === issuer.origin;
  } catch {
    hasValidIssuer = false;
  }
  if (
    authLogoutsInFlight > 0
    || generation !== authSessionGeneration
  ) {
    return null;
  }
  if (
    storedSession.v !== 1
    || !hasRequiredMetadata
    || !hasValidIssuer
  ) {
    throw new Error("Uložená session identity má neplatný formát");
  }
  if (!hasAccessToken && !hasRefreshToken) {
    return null;
  }
  return storedSession;
}

async function hasStoredAuthSession() {
  try {
    return (await readStoredAuthSession()) !== null;
  } catch {
    return false;
  }
}

function normalizedIdentityPart(value) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return /^(?:undefined|null)$/iu.test(normalized) ? "" : normalized;
}

async function readStoredAuthIdentity() {
  if (authAttemptsInFlight > 0) {
    throw new Error("Identitu právě ověřuje probíhající přihlášení");
  }
  const storedSession = await readStoredAuthSession();
  if (storedSession === null) return null;
  if (authAttemptsInFlight > 0) {
    throw new Error("Identitu právě ověřuje probíhající přihlášení");
  }

  const configuredOrigin = resolveCurrentAuthIssuer();
  if (storedSession.issuer !== configuredOrigin) return null;

  const name = normalizedIdentityPart(storedSession.identity?.name);
  const email = normalizedIdentityPart(storedSession.identity?.email);
  if (!/^[^\s@]+@[^\s@]+$/u.test(email)) {
    throw new Error("Uložená session neobsahuje ověřitelnou identitu");
  }

  // IPC projekce je záměrně nový objekt se dvěma poli. Session, tokeny ani interní ID
  // se do rendereru Nastavení nesmějí dostat ani omylem přes spread.
  return { name: name || null, email };
}

handleValidated("auth:has-session", ["panel"], async () => {
  try {
    return (await hasStoredAuthSession()) === true;
  } catch {
    return false;
  }
});

handleValidated("auth:identity", ["settings"], () => readStoredAuthIdentity());

handleValidated("auth:origin", ["settings"], (_event, ...extraPayload) => {
  requireNoPayload("auth:origin", extraPayload);
  return resolveCurrentAuthIssuer();
});

function requireIdleAuthOriginChange() {
  if (hasLiveRecording()) {
    throw new Error("Prostředí nelze změnit během nahrávání");
  }
  if (trackingWorkBlocksQuit()) {
    throw new Error("Prostředí nelze změnit, dokud běží LuTrack");
  }
  if (hasRecordingExportInFlight()) {
    throw new Error("Prostředí nelze změnit během handover exportu");
  }
  if (outboundQueueSendsInFlight > 0) {
    throw new Error("Prostředí nelze změnit během odesílání fronty");
  }
  if (authAttemptsInFlight > 0 || authLogoutsInFlight > 0 || appState.signedIn) {
    throw new Error("Před změnou prostředí je nutné dokončit přihlášení a odhlásit tento Mac");
  }
}

handleValidated("auth:set-origin", ["settings"], async (_event, authOrigin, ...extraPayload) => {
  requireAuthOriginPayload("auth:set-origin", authOrigin, extraPayload);
  if (authOriginChangeInFlight) {
    throw new Error("Změna prostředí už probíhá");
  }
  authOriginChangeInFlight = true;
  try {
    requireIdleAuthOriginChange();

    // Renderer vždy nejdřív volá auth:logout. Tahle kontrola drží stejné pořadí i
    // proti přímému invoke z okna Nastavení a nepolyká poškozenou session jako
    // hasStoredAuthSession(), protože ani nečitelný token nesmí přetéct mezi originy.
    const sessionGeneration = authSessionGeneration;
    const storedSession = await readStoredAuthSession();
    if (sessionGeneration !== authSessionGeneration) {
      throw new Error("Během změny prostředí se změnil stav odhlášení");
    }
    if (storedSession !== null) {
      throw new Error("Před změnou prostředí je nutné odhlásit uloženou session");
    }
    requireIdleAuthOriginChange();

    await authOriginStore.set(authOrigin);
    return resolveCurrentAuthIssuer();
  } finally {
    authOriginChangeInFlight = false;
  }
});

handleValidated("diagnostics:get", ["settings"], async (_event, ...extraPayload) => {
  requireNoPayload("diagnostics:get", extraPayload);
  try {
    return await createCurrentDiagnosticsSnapshot();
  } catch {
    // Import i systémová chyba mohou nést lokální cestu. Renderer dostane jen
    // nepřítomná data a sám je zobrazí jako neznámý stav.
    console.error("[diagnostics] Stav diagnostiky není dostupný.");
    return null;
  }
});

handleValidated("diagnostics:export", ["settings"], async (_event, ...extraPayload) => {
  requireNoPayload("diagnostics:export", extraPayload);
  try {
    return await exportCurrentDiagnostics();
  } catch {
    // Renderer nedostane error.message: systémová chyba může obsahovat domovskou cestu.
    console.error("[diagnostics] Export se nepodařilo uložit.");
    return { ok: false, fileName: null };
  }
});

handleValidated("auth:pending-url", ["panel"], () => pendingAuthorizationUrl);

handleValidated("auth:begin", ["panel"], async () => {
  if (authOriginChangeInFlight) {
    throw new Error("Přihlášení nelze zahájit během změny prostředí");
  }
  const attempt = new AbortController();
  activeAuthAttempts.add(attempt);
  authAttemptsInFlight += 1;
  let result;
  try {
    result = await beginAuth({ signal: attempt.signal });
  } finally {
    authAttemptsInFlight -= 1;
    activeAuthAttempts.delete(attempt);
  }
  if (result?.ok === true) {
    appState.acceptRendererSignIn = true;
    appState.signedIn = true;
    refreshTray();
    void waitForOutboundQueueRecovery().then(() => pumpOutboundQueue());
  }
  return result;
});

handleValidated(AUTH_CANCEL_CHANNEL, ["panel"], () => {
  const cancelled = activeAuthAttempts.size;
  for (const attempt of activeAuthAttempts) attempt.abort();
  return { ok: true, cancelled };
});

const { createLogoutController } = require("./auth.cjs");
const logoutAuthController = createLogoutController({
  app,
  coordinator: authSessionCoordinator,
  safeStorage,
  logger: console,
});
handleValidated("auth:logout", ["panel", "settings"], async () => {
  if (authOriginChangeInFlight) {
    return {
      signedOutLocally: false,
      serverRevoked: false,
      reason: "environment-change-active",
    };
  }
  // Není rozhodnuto, zda má odhlášení aktivní agendy samo ukončovat. Do té doby
  // je bezpečný výchozí stav akci odmítnout: nahrávka nezůstane běžet pod
  // odhlášenou ikonou a minuty LuTracku nepřejdou na další účet.
  if (hasLiveRecording()) {
    return {
      signedOutLocally: false,
      serverRevoked: false,
      reason: "recording-active",
    };
  }
  if (trackingWorkBlocksQuit()) {
    return {
      signedOutLocally: false,
      serverRevoked: false,
      reason: "tracking-active",
    };
  }
  authSessionGeneration += 1;
  authLogoutsInFlight += 1;
  try {
    const result = await logoutAuthController.logout();
    if (result.signedOutLocally) {
      try {
        // Hlavní proces po B3 stav lišty NENASTAVUJE, jen mění fakt a nechá ho odvodit.
        // Kdyby se tu ikona přepsala natvrdo, přebila by běžící nahrávku a lišta by
        // tvrdila „odhlášeno" nad session, která pořád píše na disk.
        appState.acceptRendererSignIn = false;
        appState.signedIn = false;
        refreshTray();
      } catch (error) {
        try {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[auth] Stav ikony po odhlášení se nepodařilo změnit: ${message}`);
        } catch {
          // Diagnostika stavu ikony nesmí změnit hodnotový výsledek odhlášení.
        }
      }
    }
    return result;
  } finally {
    authLogoutsInFlight -= 1;
  }
});

const requestPermission = createPermissionRequestHandler({ systemPreferences, shell });
handleValidated("permission:request", ["panel"], async (_event, permission) => {
  permissionPromptsInFlight += 1;
  try {
    return await requestPermission(permission);
  } finally {
    permissionPromptsInFlight -= 1;
    // Po zavření systémového dialogu nemusí panel dostat fokus zpátky sám.
    if (!IS_TEST_RUN && panelWindow && !panelWindow.isDestroyed()) {
      if (!panelWindow.isVisible()) panelWindow.show();
      panelWindow.focus();
    }
  }
});

handleValidated("test:quit", ["panel"], (event) => {
  requireTrustedRecordingSender(event);
  if (!IS_TEST_RUN) return { allowed: false };
  setImmediate(() => app.quit());
  return { allowed: true };
});

app.on("second-instance", () => {
  showPanel();
});

app.whenReady().then(async () => {
  try {
    const dockVisibleAtStartup = dockVisibilityStore.get();
    if (dockVisibleAtStartup) {
      await queueDockVisibility(true);
    } else {
      // hide() je synchronní. Nevkládáme před vytvoření panelu zbytečný mikroúkol;
      // show() je naopak Promise a výš se na něj kvůli pořadí čeká.
      void applyDockVisibility(false);
    }
  } catch (error) {
    // Selhání nativního Dock API nesmí připravit uživatele i o ikonu v liště.
    console.error(`[settings] Viditelnost Docku se při startu nepodařila uplatnit: ${error.message}`);
  }
  registerAppProtocol();
  installMediaHandlers();
  tray = new Tray(trayImage(trayState, currentTrayIconTheme()));
  nativeTheme.on("updated", refreshTray);
  tray.on("click", togglePanel);
  tray.on("right-click", showTrayContextMenu);
  scheduleTrayVisibilityCheck();
  refreshTray();
  const panelStartup = createPanelWindow();
  // Otevřený panel nesmí po změně rozlišení, pracovního prostoru ani monitoru
  // zůstat přes okraj. positionPanel zároveň znovu uplatní uloženou výšku obsahu.
  screen.on("display-metrics-changed", positionPanel);
  await applyOutboundQueueRetention(panelStartup);
  markOutboundQueueRetentionReady();
  void recoverOutboundRecordings()
    .catch(() => {
      console.error("[queue] Obnova nahrávek neočekávaně selhala; start pokračuje.");
    })
    .finally(markOutboundQueueRecoveryReady)
    .then(() => pumpOutboundQueue());
  await initializeAutoUpdates();
  const hardStop = Number.parseInt(process.env.LUDONE_E2E_HARD_STOP_MS || "", 10);
  if (IS_TEST_RUN && Number.isFinite(hardStop) && hardStop > 0) {
    setTimeout(() => {
      console.error(`[test] Bezpečnostní ukončení po ${hardStop} ms.`);
      app.quit();
    }, hardStop);
  }
});

app.on("activate", () => {
  if (!panelWindow || panelWindow.isDestroyed()) {
    createPanelWindow();
  } else {
    showPanel();
  }
});

app.on("before-quit", (event) => {
  clearTimeout(trayVisibilityTimer);
  trayVisibilityTimer = undefined;
  stopTrayTitleUpdates();
  // Jediná brána platí pro menu, Cmd+Q, Dock i systémové ukončení. Při druhém
  // before-quit po našem vlastním app.quit() už Electron nezastavujeme.
  if (isQuitting || deferredQuitRequest?.committed) return;
  if (deferredQuitRequest?.userConfirmationRequired) {
    event.preventDefault();
    commitDeferredQuit({
      forced: true,
      reason: "Uživatel po zobrazení chyby ukončení výslovně zopakoval",
    });
    return;
  }
  if (!recordingInterruptionIsBlocked() && !trackingWorkBlocksQuit()) {
    isQuitting = true;
    return;
  }

  event.preventDefault();
  beginDeferredQuit();
});

app.on("will-quit", stopTrayTitleUpdates);

app.on("window-all-closed", () => {
  // Menu-bar aplikace zůstává aktivní, dokud ji uživatel výslovně neukončí.
});
