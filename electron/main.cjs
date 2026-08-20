const {
  app,
  BrowserWindow,
  Tray,
  ipcMain,
  nativeImage,
  net,
  protocol,
  screen,
  shell,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const IS_TEST_RUN = process.env.LUDONE_E2E === "1";
const PANEL_WIDTH = 366;
const PANEL_HEIGHT = 792;
const VALID_TRAY_STATES = new Set(["signed-out", "idle", "recording", "tracking"]);

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
  const distRoot = path.join(PROJECT_ROOT, "dist");
  protocol.handle("ludone", (request) => {
    const requestedPath = decodeURIComponent(new URL(request.url).pathname)
      .replace(/^\/+/, "") || "index.html";
    const targetPath = path.resolve(distRoot, requestedPath);
    const isInsideDist = targetPath === distRoot || targetPath.startsWith(`${distRoot}${path.sep}`);
    if (!isInsideDist) return new Response("Zakázaná cesta", { status: 403 });
    return net.fetch(pathToFileURL(targetPath).toString());
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

function trayImage(state) {
  const encoded = Buffer.from(traySvg(state)).toString("base64");
  return nativeImage
    .createFromDataURL(`data:image/svg+xml;base64,${encoded}`)
    .resize({ width: 18, height: 18 });
}

function updateTray(nextState) {
  trayState = VALID_TRAY_STATES.has(nextState) ? nextState : "signed-out";
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

  panelWindow.loadURL("ludone://app/index.html");
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

  settingsWindow.loadURL("ludone://app/index.html#settings");
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

ipcMain.on("tray:set-state", (_event, state) => updateTray(state));
ipcMain.handle("tray:get-state", () => trayState);
ipcMain.handle("test:click-tray", () => {
  if (!IS_TEST_RUN || !tray || !panelWindow) return { allowed: false, visible: false };
  tray.emit("click");
  return { allowed: true, visible: panelWindow.isVisible() };
});
ipcMain.on("panel:hide", () => panelWindow?.hide());
ipcMain.on("settings:open", () => createSettingsWindow());
ipcMain.on("settings:close", () => settingsWindow?.close());

ipcMain.handle("auth:begin", async () => {
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

ipcMain.handle("permission:request", async (_event, permission) => {
  const supported = new Set(["microphone", "system-audio", "calendar"]);
  if (!supported.has(permission)) return { granted: false };
  await new Promise((resolve) => setTimeout(resolve, 280));
  return { granted: true, permission };
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
  if (process.platform === "darwin") app.dock.hide();
  tray = new Tray(trayImage(trayState));
  tray.setTitle("");
  tray.on("click", togglePanel);
  updateTray(trayState);
  createPanelWindow();
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
