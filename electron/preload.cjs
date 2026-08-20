const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ludone", {
  runtime: Object.freeze({
    emptyCalendar: process.env.LUDONE_EMPTY_CALENDAR === "1",
    resetOnboarding: process.env.LUDONE_RESET_ONBOARDING === "1",
  }),
  beginAuth: () => ipcRenderer.invoke("auth:begin"),
  requestPermission: (permission) =>
    ipcRenderer.invoke("permission:request", permission),
  getTrayState: () => ipcRenderer.invoke("tray:get-state"),
  testClickTray: () => ipcRenderer.invoke("test:click-tray"),
  setTrayState: (state) => ipcRenderer.send("tray:set-state", state),
  hidePanel: () => ipcRenderer.send("panel:hide"),
  openSettings: () => ipcRenderer.send("settings:open"),
  closeSettings: () => ipcRenderer.send("settings:close"),
});
