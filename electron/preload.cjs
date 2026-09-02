const { contextBridge, ipcRenderer } = require("electron");

function setPanelContentHeight(height) {
  if (typeof height !== "number" || !Number.isFinite(height)) {
    throw new TypeError("Výška obsahu panelu musí být konečné číslo");
  }
  return ipcRenderer.invoke("panel:set-content-height", height);
}

contextBridge.exposeInMainWorld("ludone", {
  runtime: Object.freeze({
    resetOnboarding: process.env.LUDONE_RESET_ONBOARDING === "1",
  }),
  beginAuth: () => ipcRenderer.invoke("auth:begin"),
  cancelAuth: () => ipcRenderer.invoke("auth:cancel"),
  hasAuthSession: async () => (await ipcRenderer.invoke("auth:has-session")) === true,
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
  exportRecording: (clientRecordingId) =>
    ipcRenderer.invoke("recording:export", clientRecordingId),
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
  testClickTray: () => ipcRenderer.invoke("test:click-tray"),
  testQuit: () => ipcRenderer.invoke("test:quit"),
  setPanelContentHeight,
  reportTrayFacts: (facts) => ipcRenderer.send("tray:report-facts", facts),
  hidePanel: () => ipcRenderer.send("panel:hide"),
  openSettings: () => ipcRenderer.send("settings:open"),
  closeSettings: () => ipcRenderer.send("settings:close"),
});
