'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('experiment', {
  info: () => ipcRenderer.invoke('experiment:info'),
  prepare: () => ipcRenderer.invoke('experiment:prepare'),
  save: (name, arrayBuffer) => ipcRenderer.invoke('experiment:save', name, arrayBuffer),
  read: (name) => ipcRenderer.invoke('experiment:read', name),
  permissionEvents: () => ipcRenderer.invoke('experiment:permission-events'),
  log: (level, message, data) => ipcRenderer.send('experiment:log', level, message, data),
  complete: (result) => ipcRenderer.send('experiment:complete', result)
})
