const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ludone", {
  runtime: Object.freeze({
    emptyCalendar: process.env.LUDONE_EMPTY_CALENDAR === "1",
    resetOnboarding: process.env.LUDONE_RESET_ONBOARDING === "1",
  }),
  beginAuth: () => ipcRenderer.invoke("auth:begin"),
  cancelAuth: () => ipcRenderer.invoke("auth:cancel"),
  logout: () => ipcRenderer.invoke("auth:logout"),
  requestPermission: (permission) =>
    ipcRenderer.invoke("permission:request", permission),
  beginRecording: () => ipcRenderer.invoke("recording:begin"),
  appendRecordingChunk: (sessionId, source, sequence, arrayBuffer) =>
    ipcRenderer.invoke("recording:append", sessionId, source, sequence, arrayBuffer),
  finishRecording: (sessionId) => ipcRenderer.invoke("recording:finish", sessionId),
  getTrayState: () => ipcRenderer.invoke("tray:get-state"),
  testClickTray: () => ipcRenderer.invoke("test:click-tray"),
  testQuit: () => ipcRenderer.invoke("test:quit"),
  setTrayState: (state) => ipcRenderer.send("tray:set-state", state),
  hidePanel: () => ipcRenderer.send("panel:hide"),
  openSettings: () => ipcRenderer.send("settings:open"),
  closeSettings: () => ipcRenderer.send("settings:close"),
});
