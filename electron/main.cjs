const {
  app,
  BrowserWindow,
  desktopCapturer,
  Tray,
  ipcMain,
  nativeImage,
  net,
  protocol,
  screen,
  session,
  shell,
  systemPreferences,
} = require("electron");
const { createHash, randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");
const { createPermissionRequestHandler } = require("./auth.cjs");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DIST_ROOT = path.join(PROJECT_ROOT, "dist");
const manifestModulePromise = import(
  pathToFileURL(path.join(PROJECT_ROOT, "src", "lib", "manifest.js")).href
);
const IS_TEST_RUN = process.env.LUDONE_E2E === "1";
const PANEL_WIDTH = 366;
const PANEL_HEIGHT = 792;
const MAX_RECORDING_CHUNK_BYTES = 8 * 1024 * 1024;
const RECORDING_TRACKS = new Map([
  ["microphone", "mikrofon"],
  ["system", "system"],
]);
const recordingSessions = new Map();
const recordingOwnersPreparing = new Map();

let tray;
let panelWindow;
let settingsWindow;
let trayState = "signed-out";
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
    return details.mediaTypes.length === 1 && details.mediaTypes[0] === "audio";
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

function trayImage(state) {
  const encoded = Buffer.from(traySvg(trayIconName(state))).toString("base64");
  return nativeImage
    .createFromDataURL(`data:image/svg+xml;base64,${encoded}`)
    .resize({ width: 18, height: 18 });
}

function updateTray(nextState) {
  trayState = trayIconName(nextState);
  if (!tray) return;
  const labels = {
    "signed-out": "LuDone · nepřihlášeno",
    idle: "LuDone · připraveno",
    recording: "LuDone · nahrává",
    tracking: "LuDone · LuTrack běží",
  };
  tray.setImage(trayImage(trayState));
  tray.setToolTip(labels[trayState]);
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

function createPanelWindow() {
  panelWindow = new BrowserWindow({
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

  const panelContents = panelWindow.webContents;
  panelWindow.loadFile(path.join(DIST_ROOT, "index.html"));
  panelContents.on("render-process-gone", (_event, details) => {
    console.error(`[recording] Renderer skončil: ${JSON.stringify(details)}`);
    finalizeRecordingSessionsForOwner(panelContents.id, "pád rendereru");
  });
  panelContents.once("destroyed", () => {
    finalizeRecordingSessionsForOwner(panelContents.id, "zničení okna");
  });
  panelContents.on("did-start-navigation", (_event, _url, _isInPlace, isMainFrame) => {
    if (isMainFrame) {
      finalizeRecordingSessionsForOwner(panelContents.id, "navigace nebo reload");
    }
  });
  panelWindow.once("ready-to-show", () => {
    positionPanel();
    panelWindow.show();
  });
  panelWindow.on("blur", () => {
    if (!IS_TEST_RUN && !settingsWindow?.isVisible()) panelWindow.hide();
  });
  panelWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      panelWindow.hide();
    }
  });
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
    if (!recordingSession.owner.isDestroyed()) {
      recordingSession.owner.removeListener("destroyed", recordingSession.destroyedListener);
    }
    if (firstError) throw firstError;
    console.log(`[recording] Uloženo: mikrofon ${files.microphone.size} B, systém ${files.system.size} B.`);
    return { startedAt: recordingSession.startedAt, files };
  })();
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
}

onValidated("tray:set-state", ["panel"], (_event, state) => updateTray(state));
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
handleValidated("recording:finish", ["panel"], (event, sessionId) => {
  ownedRecordingSession(event, sessionId);
  return finalizeRecordingSession(sessionId, "complete");
});

handleValidated("auth:begin", ["panel"], async () => {
  if (process.env.LUDONE_OPEN_AUTH_BROWSER === "1") {
    await shell.openExternal("https://app.ludone.cz");
  }
  await new Promise((resolve) => setTimeout(resolve, 650));
  return {
    ok: true,
    callback: "ludone://auth/callback?code=demo-code",
    token: "mock-token-not-persisted",
    user: { name: "Daniel Novák", email: "daniel@ludone.cz" },
  };
});

const requestPermission = createPermissionRequestHandler({ systemPreferences, shell });
handleValidated("permission:request", ["panel"], (_event, permission) => (
  requestPermission(permission)
));

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

app.whenReady().then(() => {
  registerAppProtocol();
  installMediaHandlers();
  if (process.platform === "darwin") app.dock.hide();
  tray = new Tray(trayImage(trayState));
  tray.setTitle("");
  tray.on("click", togglePanel);
  updateTray(trayState);
  createPanelWindow();
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
