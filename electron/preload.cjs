const { contextBridge, ipcRenderer } = require("electron");

function setPanelContentHeight(height) {
  if (typeof height !== "number" || !Number.isFinite(height)) {
    throw new TypeError("Výška obsahu panelu musí být konečné číslo");
  }
  return ipcRenderer.invoke("panel:set-content-height", height);
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
          if (command === "stop-recording" || command === "start-tracking") {
            callback(command);
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
  hasAuthSession: async () => (await ipcRenderer.invoke("auth:has-session")) === true,
  getAuthIdentity: () => ipcRenderer.invoke("auth:identity"),
  getAuthOrigin: () => ipcRenderer.invoke("auth:origin"),
  logout: () => ipcRenderer.invoke("auth:logout"),
  requestPermission: (permission) =>
    ipcRenderer.invoke("permission:request", permission),
  beginRecording: () => ipcRenderer.invoke("recording:begin"),
  appendRecordingChunk: (sessionId, source, sequence, arrayBuffer) =>
    ipcRenderer.invoke("recording:append", sessionId, source, sequence, arrayBuffer),
  finishRecording: (sessionId, trackTimings) =>
    ipcRenderer.invoke("recording:finish", sessionId, trackTimings),
  finishRecordingExport: (sessionId, outcome) =>
    ipcRenderer.invoke("recording:finish-export", sessionId, outcome),
  exportRecording: (clientRecordingId, recordingName) =>
    ipcRenderer.invoke("recording:export", clientRecordingId, recordingName),
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
