const { contextBridge, ipcRenderer } = require("electron");

const ENABLE_DOCK_CHANNEL = "tray-space-warning:enable-dock";

function requireDockEnabled(value) {
  if (value !== true) {
    throw new TypeError("Hlavní proces nepotvrdil zapnutí ikony v Docku");
  }
  return true;
}

contextBridge.exposeInMainWorld("ludoneTraySpaceWarning", Object.freeze({
  enableDockIcon: () => ipcRenderer.invoke(ENABLE_DOCK_CHANNEL).then(requireDockEnabled),
}));
