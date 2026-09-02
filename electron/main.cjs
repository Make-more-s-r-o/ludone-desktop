const {
  app,
  BrowserWindow,
  desktopCapturer,
  Tray,
  ipcMain,
  nativeImage,
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
  saveQueueAtomically,
} = require("./queue.cjs");
const { RETENTION_POLICIES, applyRetention } = require("./retention.cjs");
const {
  TRACKING_STATES,
  createTrackingStore,
  handleRendererGone,
} = require("./tracking.cjs");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DIST_ROOT = path.join(PROJECT_ROOT, "dist");
const manifestModulePromise = import(
  pathToFileURL(path.join(PROJECT_ROOT, "src", "lib", "manifest.js")).href
);
const queueModulePromise = import(
  pathToFileURL(path.join(PROJECT_ROOT, "src", "lib", "queue.js")).href
);
const IS_TEST_RUN = process.env.LUDONE_E2E === "1";
const PANEL_WIDTH = 366;
const PANEL_HEIGHT = 792;
const PANEL_LOAD_TIMEOUT_MS = 5_000;
const RETENTION_READ_TIMEOUT_MS = 1_000;
const MAX_RECORDING_CHUNK_BYTES = 8 * 1024 * 1024;
const RECORDING_TRACKS = new Map([
  ["microphone", "mikrofon"],
  ["system", "system"],
]);
const PROCESS_STARTED_AT = new Date().toISOString();
const recordingSessions = new Map();
const recordingOwnersPreparing = new Map();

let tray;
let panelWindow;
let settingsWindow;
let trayState = "signed-out";
let trayApplied = false;
let isQuitting = false;

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
    return handler(event, ...args);
  });
}

function onValidated(channel, allowedKinds, handler) {
  ipcMain.on(channel, (event, ...args) => {
    try {
      requireTrustedSender(event, allowedKinds);
      return handler(event, ...args);
    } catch (error) {
      console.error(`[ipc] Odmítnuto ${channel}: ${error.message}`);
      return undefined;
    }
  });
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

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function traySvg(state) {
  const variants = {
    "signed-out": `
      <circle cx="9" cy="9" r="6.3" fill="none" stroke="#737373" stroke-width="1.8"/>
      <path d="M4.5 13.5 13.5 4.5" stroke="#737373" stroke-width="1.8" stroke-linecap="round"/>`,
    idle: `
      <circle cx="9" cy="9" r="6.2" fill="none" stroke="#d4d4d4" stroke-width="1.8"/>
      <circle cx="9" cy="9" r="2.1" fill="#d4d4d4"/>`,
    recording: `
      <circle cx="9" cy="9" r="7" fill="#2f9e44"/>
      <rect x="6.5" y="5.4" width="5" height="7.2" rx="2.5" fill="#f7fff8"/>`,
    tracking: `
      <circle cx="9" cy="9" r="6.3" fill="none" stroke="#75d38c" stroke-width="1.8"/>
      <path d="M9 5.2V9l2.7 1.8" fill="none" stroke="#75d38c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">${variants[state]}</svg>`;
}

function trayIconName(state) {
  switch (state) {
    case "signed-out":
    case "idle":
    case "recording":
    case "tracking":
      return state;
    default:
      return "signed-out";
  }
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

function trayImage(state) {
  const encoded = Buffer.from(traySvg(trayIconName(state))).toString("base64");
  return nativeImage
    .createFromDataURL(`data:image/svg+xml;base64,${encoded}`)
    .resize({ width: 18, height: 18 });
}

const TRAY_LABELS = {
  "signed-out": "LuDone · nepřihlášeno",
  idle: "LuDone · připraveno",
  recording: "LuDone · nahrává",
  tracking: "LuDone · LuTrack běží",
};

// 🔴 Jediný zdroj pravdy o tom, co lišta ukazuje. Renderer sem hlásí FAKTA, stav z nich
// odvozuje hlavní proces — proto tahle funkce nebere argument. Dokud stav posílal renderer,
// přežil jeho pád i jeho omyl: spadlé okno nechalo ikonu viset na „nahrává“ donekonečna.
const appState = {
  signedIn: false,
  trackingOwners: new Set(),
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

// Čistá funkce schválně — je to jediný způsob, jak tohle rozhodnutí otestovat bez GUI
// (viz tests/tray-authority.test.js). Stejný důvod jako u shouldHidePanelOnBlur.
function deriveTrayState({ signedIn, recording, tracking }) {
  if (!signedIn) return "signed-out";
  // Nahrávání má přednost před časovačem: zabírá mikrofon a je to ten stav, jehož
  // přehlédnutí stojí nahrávku. Pátý stav „recording-tracking“ zatím NEEXISTUJE —
  // jeho ikony patří do zmrazené T1 (viz DAN-TODO.md, BD-N5).
  if (recording) return "recording";
  if (tracking) return "tracking";
  return "idle";
}

function refreshTray() {
  const recording = hasLiveRecording();
  const tracking = appState.trackingOwners.size > 0;
  const next = trayIconName(deriveTrayState({
    signedIn: appState.signedIn,
    recording,
    tracking,
  }));
  // `trayApplied` odděluje odvozený stav od naposledy skutečně vykresleného. Bez něj se při
  // startu obojí rovná „signed-out“, funkce skončí předčasně a popisek se nenastaví NIKDY.
  if (next === trayState && trayApplied) return;
  trayState = next;
  console.log(
    `[tray] ${new Date().toISOString()} stav=${trayState} nahrávání=${recording} `
    + `lutrack=${tracking} přihlášen=${appState.signedIn}`,
  );
  if (!tray) return;
  tray.setImage(trayImage(trayState));
  tray.setToolTip(TRAY_LABELS[trayState]);
  trayApplied = true;
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

  appState.signedIn = facts.signedIn;
  if (facts.tracking) appState.trackingOwners.add(ownerId);
  else appState.trackingOwners.delete(ownerId);
  refreshTray();
  return true;
}

function positionPanel() {
  if (!panelWindow || !tray) return;
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const workArea = display.workArea;
  const proposedX = Math.round(trayBounds.x + trayBounds.width / 2 - PANEL_WIDTH / 2);
  const x = Math.max(
    workArea.x + 8,
    Math.min(proposedX, workArea.x + workArea.width - PANEL_WIDTH - 8),
  );
  const y = Math.max(workArea.y + 8, trayBounds.y + trayBounds.height + 8);
  panelWindow.setPosition(x, y, false);
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
    height: PANEL_HEIGHT,
    minWidth: PANEL_WIDTH,
    maxWidth: PANEL_WIDTH,
    minHeight: PANEL_HEIGHT,
    maxHeight: PANEL_HEIGHT,
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
    forgetOwnerActivity(panelContents.id, "pád rendereru");
  });
  panelContents.on("render-process-gone", () => {
    if (trackingStore) handleRendererGone(trackingStore, {});
  });
  panelContents.once("destroyed", () => {
    forgetOwnerActivity(panelContents.id, "zničení okna");
  });
  panelContents.on("did-start-navigation", (_event, _url, _isInPlace, isMainFrame) => {
    if (isMainFrame) {
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

function togglePanel() {
  if (!panelWindow) return;
  if (panelWindow.isVisible()) {
    panelWindow.hide();
  } else {
    positionPanel();
    panelWindow.show();
    panelWindow.focus();
  }
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

async function recordingFileSha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function recordingManifestTracks(tracks, startedAt, endedAt = null, files = null) {
  return Object.fromEntries([...tracks].map(([source, track]) => [source, {
    fileName: path.basename(track.filePath),
    startedAt,
    endedAt,
    sizeBytes: files?.[source]?.size ?? 0,
    sha256: files?.[source]?.sha256 ?? null,
  }]));
}

async function createRecordingSession(event) {
  requireTrustedRecordingSender(event);
  const ownerId = event.sender.id;
  if (recordingOwnersPreparing.has(ownerId) || [...recordingSessions.values()].some((activeSession) => (
    activeSession.ownerId === ownerId
  ))) {
    throw new Error("V tomto okně už jedna nahrávací session běží");
  }
  const preparation = { cancelled: false };
  recordingOwnersPreparing.set(ownerId, preparation);
  refreshTray();
  const tracks = new Map();
  let manifestWasWritten = false;
  try {
    const startedAt = new Date();
    const timestamp = startedAt.toISOString().replace(/[:.]/g, "-");
    const sessionId = randomUUID();
    const prefix = `${timestamp}-${sessionId.slice(0, 8)}`;
    const recordingsDirectory = path.join(app.getPath("userData"), "nahravky");
    await fs.promises.mkdir(recordingsDirectory, { recursive: true, mode: 0o700 });

    for (const source of RECORDING_TRACKS.keys()) {
      tracks.set(source, await openRecordingTrack(recordingsDirectory, prefix, source));
    }
    if (preparation.cancelled || event.sender.isDestroyed()) {
      throw new Error("Příprava nahrávání byla zrušena při navigaci nebo pádu rendereru");
    }

    const manifestPath = path.join(recordingsDirectory, `${prefix}.manifest.json`);
    const { createManifest, transitionManifest, writeManifestAtomically } = await manifestModulePromise;
    const manifest = createManifest({
      clientRecordingId: sessionId,
      createdAt: startedAt.toISOString(),
      closedAt: null,
      tracks: recordingManifestTracks(tracks, startedAt.toISOString()),
    }, "recording");
    // Recovery kopie musí existovat dřív, než session ID dostane renderer a může poslat první chunk.
    await writeManifestAtomically(manifestPath, transitionManifest(manifest, "incomplete"));
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
    recordingSession.destroyedListener = () => {
      void finalizeRecordingSession(sessionId, "incomplete").catch((error) => {
        console.error(`[recording] Finalizace po pádu rendereru selhala: ${error.stack || error.message}`);
      });
    };
    event.sender.once("destroyed", recordingSession.destroyedListener);
    recordingSessions.set(sessionId, recordingSession);
    refreshTray();
    console.log(`[recording] Připraveny oddělené soubory s prefixem ${prefix}.`);
    return { sessionId, startedAt: recordingSession.startedAt };
  } catch (error) {
    await Promise.allSettled([...tracks.values()].map(async (track) => {
      await track.handle.close();
      if (!manifestWasWritten) await fs.promises.unlink(track.filePath).catch(() => {});
    }));
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

async function appendRecordingChunk(event, sessionId, source, sequence, arrayBuffer) {
  const recordingSession = ownedRecordingSession(event, sessionId);
  const track = recordingSession.tracks.get(source);
  if (!track) throw new Error("Neplatný zdroj nahrávacího chunku");
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

async function finalizeRecordingSession(sessionId, finalState) {
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

    if (!firstError) {
      try {
        const { transitionManifest, writeManifestAtomically } = await manifestModulePromise;
        const finalManifest = transitionManifest(recordingSession.manifest, finalState, {
          closedAt,
          tracks: recordingManifestTracks(
            recordingSession.tracks,
            recordingSession.startedAt,
            closedAt,
            files,
          ),
        });
        await writeManifestAtomically(recordingSession.manifestPath, finalManifest);
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
    console.log(`[recording] Uloženo: mikrofon ${files.microphone.size} B, systém ${files.system.size} B.`);
    return { startedAt: recordingSession.startedAt, files };
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
      console.warn(`[recording] Session uzavřena po události „${reason}“: mikrofon ${result.files.microphone.size} B, systém ${result.files.system.size} B.`);
    }).catch((error) => {
      console.error(`[recording] Uzavření po události „${reason}“ selhalo: ${error.stack || error.message}`);
    });
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
  refreshTray();
}

onValidated("tray:report-facts", ["panel"], (event, facts) => {
  if (!applyReportedFacts(event.sender.id, facts)) {
    console.warn("[tray] Odmítnut neplatný report faktů; předchozí stav zachován.");
  }
});
handleValidated("tray:get-state", ["panel", "settings"], () => trayState);
handleValidated("test:click-tray", ["panel"], () => {
  if (!IS_TEST_RUN || !tray || !panelWindow) return { allowed: false, visible: false };
  tray.emit("click");
  return { allowed: true, visible: panelWindow.isVisible() };
});
onValidated("panel:hide", ["panel"], () => panelWindow?.hide());
onValidated("settings:open", ["panel"], () => createSettingsWindow());
onValidated("settings:close", ["settings"], () => settingsWindow?.close());
handleValidated("recording:begin", ["panel"], (event) => createRecordingSession(event));
handleValidated("recording:append", ["panel"], (event, sessionId, source, sequence, arrayBuffer) => (
  appendRecordingChunk(event, sessionId, source, sequence, arrayBuffer)
));

let outboundQueueStore;
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
    const result = await applyRetention({ queue, policy, now: Date.now() });
    if (result.deletedItems.length > 0) {
      await saveQueueAtomically(filePath, { ...queue, items: result.keptItems });
    }
    if (result.errors.length > 0) {
      console.error(`[retention] Některé soubory nešlo odstranit: ${JSON.stringify(result.errors)}`);
    }
    return result;
  } catch (error) {
    console.error(`[retention] Úklid selhal; start pokračuje: ${error.stack || error.message}`);
    return { deletedFiles: [], deletedItems: [], keptItems: [], errors: [error] };
  }
}

function queueKillswitches() {
  return {
    DESKTOP_UPLOAD_ENABLED: process.env.DESKTOP_UPLOAD_ENABLED,
    DESKTOP_TIME_ENABLED: process.env.DESKTOP_TIME_ENABLED,
  };
}

function unavailableQueueSend() {
  const error = new Error("odesílací vrstva zatím neexistuje; fronta je pozastavená");
  error.failureClass = "paused";
  throw error;
}

async function getOutboundQueueStore() {
  await outboundQueueRetentionReady;
  if (!outboundQueueStore) {
    outboundQueueStore = createOutboundQueueStore({
      filePath: outboundQueueFilePath(),
      queueModulePromise,
      send: unavailableQueueSend,
    });
  }
  return outboundQueueStore;
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

function finishRecordingAndEnqueue(event, sessionId) {
  const recordingSession = ownedRecordingSession(event, sessionId);
  return finalizeRecordingSession(sessionId, "complete").then(async (result) => {
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
    } catch (error) {
      console.error(`[queue] Zařazení nahrávky selhalo: ${error.stack || error.message}`);
    }
    return result;
  });
}

handleValidated("recording:finish", ["panel"], finishRecordingAndEnqueue);
handleValidated("queue:list", ["panel", "settings"], async () => (
  (await getOutboundQueueStore()).list()
));
handleValidated("queue:retry", ["panel"], async () => {
  const result = await (await getOutboundQueueStore()).retry(queueKillswitches());
  console.log(`[queue] ${result.reason ?? result.outcome}`);
  return result;
});

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
  if (store.getState().aktualni?.state === TRACKING_STATES.RUNNING) {
    appState.trackingOwners.add(TRACKING_STORE_OWNER_ID);
  } else {
    appState.trackingOwners.delete(TRACKING_STORE_OWNER_ID);
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
      const store = await getOutboundQueueStore();
      const queued = await store.enqueueTimeEntry({
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

handleValidated("tracking:start", ["panel"], (_event, payload) => (
  runTrackingMutation("start", payload)
));
handleValidated("tracking:switch-project", ["panel"], (_event, payload) => (
  runTrackingMutation("switchProject", payload)
));
handleValidated("tracking:stop", ["panel"], () => runTrackingMutation("stop"));
handleValidated("tracking:get-state", ["panel", "settings"], async () => {
  const store = await getReadyTrackingStore();
  return store.getState();
});
handleValidated("tracking:resolve-recovered", ["panel"], (_event, payload) => (
  runTrackingMutation("resolveRecovered", payload)
));

// 🔴 Identifikátor klienta se NEUHODNE a nezadrátuje. Musí odpovídat záznamu, který někdo
// založil na serveru — a ten zatím neexistuje. Zadrátovaná hodnota by se serveru nesešla
// a přihlášení by spadlo na nesrozumitelnou serverovou chybu místo na srozumitelné
// „ještě to není nastavené". Rozhodnutí BD-N6: statická registrace, povinný clientId,
// fail-closed. Dynamická registrace se nepoužije ani jako záloha (kancelář za jednou NAT IP
// vyčerpá 20 registrací za hodinu a dostane 429).
function resolveAuthClientId(env) {
  const value = env?.LUDONE_OAUTH_CLIENT_ID;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      "Přihlášení zatím není nastavené: chybí identifikátor klienta. "
      + "Doplní ho správce v nastavení aplikace.",
    );
  }
  return value.trim();
}

function resolveAuthIssuer(env) {
  const value = env?.LUDONE_ORIGIN ?? "https://app.ludone.cz";
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

function createAuthBeginHandler(createController) {
  return function configureAuthBegin({
    app,
    coordinator,
    env,
    isTestRun,
    logger,
    safeStorage,
    shell,
  }) {
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
      if (isTestRun && app?.isPackaged !== true) {
        return {
          ok: true,
          user: { name: "Testovací uživatel", email: "test@ludone.cz" },
        };
      }

      try {
        const issuer = resolveAuthIssuer(env);
        const clientId = resolveAuthClientId(env);

        writeAuthLog("log", "[auth] Přihlášení zahájeno");
        const controller = createController({
          issuer,
          clientId,
          app,
          coordinator,
          safeStorage,
          shell,
        });
        const attempt = await controller.start();
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
          /Adresa přihlášení|HTTPS origin|přihlášení zatím není nastavené|OAuth issuer|MCP resource|MCP scopy|Chybí Electron/i.test(message)
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
const beginAuth = createAuthBeginHandler(createAuthController)({
  app,
  coordinator: authSessionCoordinator,
  env: process.env,
  isTestRun: IS_TEST_RUN,
  logger: console,
  safeStorage,
  shell,
});

async function hasStoredAuthSession() {
  try {
    const generation = authSessionGeneration;
    if (authLogoutsInFlight > 0 || safeStorage?.isEncryptionAvailable?.() !== true) return false;
    const encrypted = await fs.promises.readFile(tokenSessionFilePath(app));
    const sessionValue = safeStorage.decryptString(encrypted);
    const storedSession = JSON.parse(sessionValue);
    if (!storedSession || typeof storedSession !== "object" || Array.isArray(storedSession)) {
      return false;
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
    const issuer = new URL(storedSession.issuer);
    const hasValidIssuer = issuer.protocol === "https:"
      && issuer.username === ""
      && issuer.password === ""
      && issuer.search === ""
      && issuer.hash === "";
    return authLogoutsInFlight === 0
      && generation === authSessionGeneration
      && storedSession.v === 1
      && hasRequiredMetadata
      && hasValidIssuer
      && (hasAccessToken || hasRefreshToken);
  } catch {
    return false;
  }
}

handleValidated("auth:has-session", ["panel"], async () => {
  try {
    return (await hasStoredAuthSession()) === true;
  } catch {
    return false;
  }
});

handleValidated("auth:begin", ["panel"], async () => {
  const attempt = new AbortController();
  activeAuthAttempts.add(attempt);
  authAttemptsInFlight += 1;
  try {
    return await beginAuth({ signal: attempt.signal });
  } finally {
    authAttemptsInFlight -= 1;
    activeAuthAttempts.delete(attempt);
  }
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
handleValidated("auth:logout", ["panel"], async () => {
  authSessionGeneration += 1;
  authLogoutsInFlight += 1;
  try {
    const result = await logoutAuthController.logout();
    if (result.signedOutLocally) {
      try {
        // Hlavní proces po B3 stav lišty NENASTAVUJE, jen mění fakt a nechá ho odvodit.
        // Kdyby se tu ikona přepsala natvrdo, přebila by běžící nahrávku a lišta by
        // tvrdila „odhlášeno" nad session, která pořád píše na disk.
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
  if (panelWindow) {
    positionPanel();
    panelWindow.show();
    panelWindow.focus();
  }
});

app.whenReady().then(async () => {
  registerAppProtocol();
  installMediaHandlers();
  if (process.platform === "darwin") app.dock.hide();
  tray = new Tray(trayImage(trayState));
  tray.setTitle("");
  tray.on("click", togglePanel);
  refreshTray();
  const panelStartup = createPanelWindow();
  await applyOutboundQueueRetention(panelStartup);
  markOutboundQueueRetentionReady();
  void pumpOutboundQueue();
  const hardStop = Number.parseInt(process.env.LUDONE_E2E_HARD_STOP_MS || "", 10);
  if (IS_TEST_RUN && Number.isFinite(hardStop) && hardStop > 0) {
    setTimeout(() => {
      console.error(`[test] Bezpečnostní ukončení po ${hardStop} ms.`);
      app.quit();
    }, hardStop);
  }
});

app.on("activate", () => {
  if (!panelWindow) createPanelWindow();
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  // Menu-bar aplikace zůstává aktivní, dokud ji uživatel výslovně neukončí.
});
