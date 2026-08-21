const { app, BrowserWindow, session, desktopCapturer } = require('electron')
const path = require('path')
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false })
  session.defaultSession.setDisplayMediaRequestHandler(async (req, cb) => {
    try {
      const src = await desktopCapturer.getSources({ types: ['screen'] })
      cb({ video: src[0], audio: 'loopback' })
    } catch (e) { cb({}) }
  }, { useSystemPicker: false })
  await w.loadFile(path.join(__dirname, 't.html'))
  const out = await w.webContents.executeJavaScript(`(async () => {
    const r = {}
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      const a = s.getAudioTracks(), v = s.getVideoTracks()
      r.audioStop = a.length; r.videoStop = v.length
      r.audioLabel = a.length ? a[0].label : null
      if (a.length) {
        const rec = new MediaRecorder(new MediaStream([a[0]]))
        const chunks = []
        rec.ondataavailable = e => chunks.push(e.data)
        rec.start()
        await new Promise(x => setTimeout(x, 5000))
        await new Promise(x => { rec.onstop = x; rec.stop() })
        r.bajtu = chunks.reduce((n, c) => n + c.size, 0)
      }
      s.getTracks().forEach(t => t.stop())
    } catch (e) { r.chyba = e.name + ' — ' + e.message }
    return r
  })()`)
  console.log('VYSLEDEK ' + JSON.stringify(out))
  app.quit()
})
setTimeout(() => { console.log('VYSLEDEK {"timeout":true}'); app.quit() }, 40000)
