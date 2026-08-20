'use strict'

const {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  session,
  systemPreferences
} = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const ROOT = __dirname
const RECORDINGS_DIR = path.join(ROOT, 'nahravky')
const OUTPUT_FILES = new Map([
  ['mikrofon.webm', path.join(RECORDINGS_DIR, 'mikrofon.webm')],
  ['system.webm', path.join(RECORDINGS_DIR, 'system.webm')]
])
const VALID_ROUTES = new Set(['loopback', 'loopbackWithMute', 'loopback-feature'])
const requestedRoute = process.env.SYSTEM_AUDIO_ROUTE || 'loopback'
const route = VALID_ROUTES.has(requestedRoute) ? requestedRoute : 'loopback'
const displayAudioMode = route === 'loopbackWithMute' ? 'loopbackWithMute' : 'loopback'
const explicitFeatureFlag = route === 'loopback-feature'
const skipWebAudio = process.env.SKIP_WEB_AUDIO === '1'
const micOnly = process.env.MIC_ONLY === '1'
const permissionEvents = []

if (route !== requestedRoute) {
  console.error(`[main] Neznámá cesta ${JSON.stringify(requestedRoute)}; používám loopback.`)
}

const runtimePaths = {
  userData: path.join(ROOT, '.electron-user-data'),
  sessionData: path.join(ROOT, '.electron-session-data'),
  temp: path.join(ROOT, '.runtime-tmp'),
  logs: path.join(ROOT, '.electron-user-data', 'logs'),
  crashDumps: path.join(ROOT, '.electron-user-data', 'crash-dumps')
}

for (const directory of [RECORDINGS_DIR, ...Object.values(runtimePaths)]) {
  fs.mkdirSync(directory, { recursive: true })
}

app.setName('LuDone zvukový důkaz')
for (const [name, directory] of Object.entries(runtimePaths)) {
  app.setPath(name, directory)
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
if (explicitFeatureFlag) {
  app.commandLine.appendSwitch('enable-features', 'MacCatapLoopbackAudioForScreenShare')
}

function logPermission(kind, details) {
  const event = {
    time: new Date().toISOString(),
    kind,
    details
  }
  permissionEvents.push(event)
  console.log(`[permission] ${kind}: ${JSON.stringify(details)}`)
}

function isTrustedSender(event) {
  const allowedPrefix = pathToFileURL(`${ROOT}${path.sep}`).href
  const senderUrl = event.senderFrame?.url || event.sender.getURL()
  return senderUrl.startsWith(allowedPrefix)
}

function requireTrustedSender(event) {
  if (!isTrustedSender(event)) {
    throw new Error('IPC odmítnuto: nedůvěryhodný odesílatel')
  }
}

function outputPathFor(name) {
  const outputPath = OUTPUT_FILES.get(name)
  if (!outputPath) {
    throw new Error(`Nepovolený název výstupu: ${name}`)
  }
  return outputPath
}

async function initialPermissionStatus() {
  const result = {}
  for (const mediaType of ['microphone', 'screen']) {
    try {
      result[mediaType] = systemPreferences.getMediaAccessStatus(mediaType)
    } catch (error) {
      result[mediaType] = `nelze zjistit: ${error.message}`
    }
  }
  return result
}

function installPermissionHandlers() {
  const ses = session.defaultSession

  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
    const allowed = permission === 'media' || permission === 'display-capture'
    logPermission('kontrola', { permission, requestingOrigin, details, allowed })
    return allowed
  })

  ses.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const allowed = permission === 'media' || permission === 'display-capture'
    logPermission('žádost Electronu', { permission, details, allowed })
    callback(allowed)
  })

  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    console.log(`[display-handler] video=${request.videoRequested} audio=${request.audioRequested} gesture=${request.userGesture} cesta=${route}`)
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: false
      })
      if (sources.length === 0) {
        throw new Error('desktopCapturer nevrátil žádnou obrazovku')
      }

      const streams = { video: sources[0] }
      if (request.audioRequested) {
        streams.audio = displayAudioMode
      }
      console.log(`[display-handler] povoluji zdroj ${JSON.stringify(sources[0].name)} a audio=${streams.audio || 'ne'}`)
      callback(streams)
    } catch (error) {
      console.error(`[display-handler] selhal: ${error.stack || error.message}`)
      callback({})
    }
  })
}

function installIpcHandlers() {
  ipcMain.handle('experiment:info', async (event) => {
    requireTrustedSender(event)
    return {
      route,
      displayAudioMode,
      explicitFeatureFlag,
      skipWebAudio,
      micOnly,
      featureName: 'MacCatapLoopbackAudioForScreenShare',
      versions: process.versions,
      macOS: process.getSystemVersion(),
      permissionStatus: await initialPermissionStatus()
    }
  })

  ipcMain.handle('experiment:prepare', async (event) => {
    requireTrustedSender(event)
    await fs.promises.mkdir(RECORDINGS_DIR, { recursive: true })
    for (const outputPath of OUTPUT_FILES.values()) {
      try {
        await fs.promises.unlink(outputPath)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    console.log('[main] Výstupy pro nový pokus jsou připravené.')
  })

  ipcMain.handle('experiment:save', async (event, name, arrayBuffer) => {
    requireTrustedSender(event)
    const outputPath = outputPathFor(name)
    const bytes = Buffer.from(arrayBuffer)
    await fs.promises.writeFile(outputPath, bytes)
    const stats = await fs.promises.stat(outputPath)
    console.log(`[main] Uloženo ${name}: ${stats.size} B`)
    return { name, size: stats.size }
  })

  ipcMain.handle('experiment:read', async (event, name) => {
    requireTrustedSender(event)
    const bytes = await fs.promises.readFile(outputPathFor(name))
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  })

  ipcMain.handle('experiment:permission-events', (event) => {
    requireTrustedSender(event)
    return permissionEvents
  })

  ipcMain.on('experiment:log', (event, level, message, data) => {
    if (!isTrustedSender(event)) return
    const suffix = data === undefined ? '' : ` ${JSON.stringify(data)}`
    const line = `[renderer] ${message}${suffix}`
    if (level === 'error') console.error(line)
    else console.log(line)
  })

  ipcMain.on('experiment:complete', (event, result) => {
    if (!isTrustedSender(event)) return
    console.log(`[EXPERIMENT_RESULT] ${JSON.stringify(result)}`)
    const delay = Number.parseInt(process.env.AUTO_QUIT_DELAY_MS || '', 10)
    if (Number.isFinite(delay) && delay >= 0) {
      setTimeout(() => app.quit(), delay)
    }
  })
}

function createWindow() {
  const window = new BrowserWindow({
    width: 780,
    height: 680,
    minWidth: 620,
    minHeight: 500,
    title: 'LuDone – důkaz zachycení zvuku',
    backgroundColor: '#f5f2e9',
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.loadFile('index.html')
  window.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[main] Renderer skončil: ${JSON.stringify(details)}`)
  })
}

app.whenReady().then(async () => {
  installPermissionHandlers()
  installIpcHandlers()

  console.log(`[main] Electron ${process.versions.electron}, Chromium ${process.versions.chrome}, macOS ${process.getSystemVersion()}`)
  console.log(`[main] Cesta systémového zvuku: ${route}; explicitní feature flag: ${explicitFeatureFlag}`)
  console.log(`[main] Stav oprávnění před pokusem: ${JSON.stringify(await initialPermissionStatus())}`)

  createWindow()

  const hardStop = Number.parseInt(process.env.EXPERIMENT_HARD_STOP_MS || '', 10)
  if (Number.isFinite(hardStop) && hardStop > 0) {
    setTimeout(() => {
      console.error(`[main] Bezpečnostní ukončení po ${hardStop} ms.`)
      app.quit()
    }, hardStop)
  }
})

app.on('window-all-closed', () => app.quit())
