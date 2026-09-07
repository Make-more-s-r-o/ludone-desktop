const { contextBridge, ipcRenderer } = require("electron");

const AUTH_ORIGINS = Object.freeze([
  "https://app.ludone.cz",
  "https://labs.ludone.cz",
]);
const AUTH_SESSION_STATUS_CHANNEL = "auth:has-session";

function requireAuthOrigin(value) {
  if (!AUTH_ORIGINS.includes(value)) {
    throw new TypeError("Hodnota prostředí musí být jeden ze dvou známých originů");
  }
  return value;
}

function requireAuthOriginSwitchResponse(value) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || typeof value.signedOutLocally !== "boolean"
    || typeof value.serverRevoked !== "boolean"
    || (value.reason !== null && typeof value.reason !== "string")
    || (value.origin !== null && !AUTH_ORIGINS.includes(value.origin))
  ) {
    throw new TypeError("Hlavní proces nevrátil platný výsledek změny prostředí");
  }
  return {
    signedOutLocally: value.signedOutLocally,
    serverRevoked: value.serverRevoked,
    reason: value.reason,
    origin: value.origin,
  };
}

function setPanelContentHeight(height) {
  if (typeof height !== "number" || !Number.isFinite(height)) {
    throw new TypeError("Výška obsahu panelu musí být konečné číslo");
  }
  return ipcRenderer.invoke("panel:set-content-height", height);
}

function getBooleanSetting(channel) {
  return ipcRenderer.invoke(channel).then(requireBooleanSettingResponse);
}

function requireBooleanSettingResponse(value) {
  if (typeof value !== "boolean") {
    throw new TypeError("Hlavní proces nevrátil boolean systémového nastavení");
  }
  return value;
}

function setBooleanSetting(channel, value) {
  if (typeof value !== "boolean") {
    throw new TypeError("Systémové nastavení musí být boolean");
  }
  return ipcRenderer.invoke(channel, value).then(requireBooleanSettingResponse);
}

function onAuthSessionChanged(callback) {
  if (typeof callback !== "function") {
    throw new TypeError("Odběratel změny přihlášení musí být funkce");
  }
  const listener = () => callback();
  ipcRenderer.on(AUTH_SESSION_STATUS_CHANNEL, listener);
  return () => ipcRenderer.removeListener(AUTH_SESSION_STATUS_CHANNEL, listener);
}

function onTrayCommand(callback) {
  if (typeof callback !== "function") {
    throw new TypeError("Odběratel rychlé akce musí být funkce");
  }
  let active = true;
  let draining = false;
  let drainRequested = false;
  const drain = async () => {
    if (!active) return;
    if (draining) {
      // Wake může dorazit během rozpracovaného invoke. Příznak zajistí ještě
      // jedno vyzvednutí po jeho dokončení a zachová pořadí callbacků.
      drainRequested = true;
      return;
    }
    draining = true;
    try {
      do {
        drainRequested = false;
        const commands = await ipcRenderer.invoke("tray:command");
        if (!Array.isArray(commands)) return;
        for (let index = 0; index < commands.length; index += 1) {
          const command = commands[index];
          if (!active) return;
          if (
            command === "stop-recording"
            || command === "start-tracking"
            || command === "stop-tracking"
          ) {
            try {
              callback(command);
            } catch (error) {
              console.error(`[tray] Rychlou akci ${command} se nepodařilo zpracovat: ${error.message}`);
            }
            // Každý příkaz dostane vlastní event-loop tah. React by jinak víc
            // synchronních setState sloučil a komponenty by viděly jen poslední akci.
            if (index < commands.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }
        }
      } while (active && drainRequested);
    } catch (error) {
      console.error(`[tray] Rychlou akci se nepodařilo převzít: ${error.message}`);
    } finally {
      draining = false;
      if (active && drainRequested) void drain();
    }
  };
  const listener = () => drain();
  ipcRenderer.on("tray:command", listener);
  // První vyzvednutí je handshake pro kliknutí, které přišlo ještě před
  // instalací listeneru. Probouzecí událost sama totiž nemá trvalou frontu.
  void drain();
  return () => {
    active = false;
    ipcRenderer.removeListener("tray:command", listener);
  };
}

contextBridge.exposeInMainWorld("ludone", {
  runtime: Object.freeze({
    resetOnboarding: process.env.LUDONE_RESET_ONBOARDING === "1",
  }),
  beginAuth: () => ipcRenderer.invoke("auth:begin"),
  cancelAuth: () => ipcRenderer.invoke("auth:cancel"),
  pendingAuthUrl: () => ipcRenderer.invoke("auth:pending-url"),
  copyPendingAuthUrl: async () => (
    (await ipcRenderer.invoke("auth:copy-pending-url")) === true
  ),
  hasAuthSession: async () => (await ipcRenderer.invoke(AUTH_SESSION_STATUS_CHANNEL)) === true,
  onAuthSessionChanged,
  getAuthIdentity: () => ipcRenderer.invoke("auth:identity"),
  getAuthOrigin: () => ipcRenderer.invoke("auth:origin"),
  setAuthOrigin: (value) => {
    const authOrigin = requireAuthOrigin(value);
    return ipcRenderer.invoke("auth:set-origin", authOrigin).then(requireAuthOrigin);
  },
  switchAuthOrigin: (value) => {
    const authOrigin = requireAuthOrigin(value);
    return ipcRenderer.invoke("auth:switch-origin", authOrigin)
      .then(requireAuthOriginSwitchResponse);
  },
  logout: () => ipcRenderer.invoke("auth:logout"),
  getDeviceName: () => ipcRenderer.invoke("settings:get-device-name"),
  getDockVisible: () => getBooleanSetting("settings:get-dock-visible"),
  setDockVisible: (value) => setBooleanSetting("settings:set-dock-visible", value),
  getOpenAtLogin: () => getBooleanSetting("settings:get-open-at-login"),
  setOpenAtLogin: (value) => setBooleanSetting("settings:set-open-at-login", value),
  getDiagnostics: () => ipcRenderer.invoke("diagnostics:get"),
  exportDiagnostics: () => ipcRenderer.invoke("diagnostics:export"),
  getPermissionStatus: (permission) =>
    ipcRenderer.invoke("permission:status", permission),
  requestPermission: (permission) =>
    ipcRenderer.invoke("permission:request", permission),
  beginRecording: (sources) => ipcRenderer.invoke("recording:begin", sources),
  appendRecordingChunk: (sessionId, source, sequence, arrayBuffer) =>
    ipcRenderer.invoke("recording:append", sessionId, source, sequence, arrayBuffer),
  finishRecording: (sessionId, trackTimings) =>
    ipcRenderer.invoke("recording:finish", sessionId, trackTimings),
  finishRecordingExport: (sessionId, outcome) =>
    ipcRenderer.invoke("recording:finish-export", sessionId, outcome),
  confirmRecordingExportFailure: (sessionId) =>
    ipcRenderer.invoke("recording:confirm-export-failure", sessionId),
  // Druhý argument nese { recordingName, openUploadPage } — most ho jen předává dál,
  // rozhodnutí o otevření nahrávací stránky patří volajícímu a hlavní proces ho vymáhá.
  exportRecording: (clientRecordingId, volby) =>
    ipcRenderer.invoke("recording:export", clientRecordingId, volby),
  listQueue: () => ipcRenderer.invoke("queue:list"),
  retryQueue: () => ipcRenderer.invoke("queue:retry"),
  startTracking: (payload) => ipcRenderer.invoke("tracking:start", payload),
  switchTrackingProject: (payload) =>
    ipcRenderer.invoke("tracking:switch-project", payload),
  stopTracking: () => ipcRenderer.invoke("tracking:stop"),
  getTrackingState: () => ipcRenderer.invoke("tracking:get-state"),
  resolveRecoveredTracking: (payload) =>
    ipcRenderer.invoke("tracking:resolve-recovered", payload),
  getTrayState: () => ipcRenderer.invoke("tray:get-state"),
  onTrayCommand,
  testClickTray: () => ipcRenderer.invoke("test:click-tray"),
  testQuit: () => ipcRenderer.invoke("test:quit"),
  setPanelContentHeight,
  reportTrayFacts: (facts) => ipcRenderer.send("tray:report-facts", facts),
  hidePanel: () => ipcRenderer.send("panel:hide"),
  openSettings: () => ipcRenderer.send("settings:open"),
  closeSettings: () => ipcRenderer.send("settings:close"),
});
