// Zjisti, jestli Electron v TETO relaci vidi zvukova zarizeni.
const { app, BrowserWindow } = require('electron')
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } })
  await w.loadFile(require('path').join(__dirname, 't.html'))
  const out = await w.webContents.executeJavaScript(`(async () => {
    const r = { devices: [], loopback: null, mic: null }
    try {
      const d = await navigator.mediaDevices.enumerateDevices()
      r.devices = d.filter(x => x.kind.includes('audio')).map(x => x.kind + ':' + (x.label || '(bez jmena)'))
    } catch (e) { r.devices = ['CHYBA: ' + e.message] }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      r.mic = 'OK, stop: ' + s.getAudioTracks().length
      s.getTracks().forEach(t => t.stop())
    } catch (e) { r.mic = 'CHYBA: ' + e.name + ' — ' + e.message }
    return r
  })()`)
  console.log('VYSLEDEK ' + JSON.stringify(out))
  app.quit()
})
setTimeout(() => { console.log('VYSLEDEK {"timeout":true}'); app.quit() }, 25000)
