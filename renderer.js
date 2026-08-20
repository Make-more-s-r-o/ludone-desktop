'use strict'

const RECORDING_MS = 10_000
const CAPTURE_SETUP_TIMEOUT_MS = 30_000
const ACTIVE_RMS_THRESHOLD = 0.0005
const recordButton = document.querySelector('#record')
const statusElement = document.querySelector('#status')
const metaElement = document.querySelector('#meta')
const logElement = document.querySelector('#log')

let experimentInfo

function describeError(error) {
  if (!error) return 'neznámá chyba'
  return `${error.name || 'Error'}: ${error.message || String(error)}`
}

function writeLog(message, data, level = 'info') {
  const suffix = data === undefined ? '' : ` ${JSON.stringify(data)}`
  const line = `${new Date().toISOString()} ${message}${suffix}`
  logElement.textContent += `${line}\n`
  logElement.scrollTop = logElement.scrollHeight
  console[level === 'error' ? 'error' : 'log'](message, data ?? '')
  window.experiment.log(level, message, data)
}

function setStatus(message) {
  statusElement.textContent = message
  writeLog(message)
}

function audioOnlyStream(stream, label) {
  const tracks = stream.getAudioTracks()
  if (tracks.length === 0) {
    throw new Error(`${label}: stream neobsahuje žádnou audio stopu`)
  }
  writeLog(`${label}: audio stopa`, tracks.map((track) => ({
    label: track.label,
    enabled: track.enabled,
    muted: track.muted,
    readyState: track.readyState,
    settings: track.getSettings()
  })))
  return new MediaStream(tracks)
}

function supportedMimeType() {
  for (const candidate of ['audio/webm;codecs=opus', 'audio/webm']) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate
  }
  return ''
}

function startRecorder(stream, label) {
  const chunks = []
  const mimeType = supportedMimeType()
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 128_000 } : undefined)
  let resolveStopped
  let rejectStopped
  const stopped = new Promise((resolve, reject) => {
    resolveStopped = resolve
    rejectStopped = reject
  })

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })
  recorder.addEventListener('error', (event) => {
    rejectStopped(event.error || new Error(`${label}: MediaRecorder error`))
  }, { once: true })
  recorder.addEventListener('stop', () => {
    const finalType = recorder.mimeType || mimeType || 'audio/webm'
    resolveStopped(new Blob(chunks, { type: finalType }))
  }, { once: true })

  recorder.start(250)
  writeLog(`${label}: MediaRecorder spuštěn`, { mimeType: recorder.mimeType })
  return { recorder, stopped }
}

function monitorSignal(context, stream, label) {
  const source = context.createMediaStreamSource(stream)
  const analyser = context.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)

  const values = new Float32Array(analyser.fftSize)
  let checks = 0
  let activeChecks = 0
  let rmsSum = 0
  let maxRms = 0

  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(values)
    let squareSum = 0
    for (const value of values) squareSum += value * value
    const rms = Math.sqrt(squareSum / values.length)
    checks += 1
    rmsSum += rms
    maxRms = Math.max(maxRms, rms)
    if (rms > ACTIVE_RMS_THRESHOLD) activeChecks += 1
  }, 50)

  return () => {
    clearInterval(timer)
    source.disconnect()
    const measurement = {
      checks,
      activeChecks,
      activeThreshold: ACTIVE_RMS_THRESHOLD,
      meanRms: checks ? rmsSum / checks : 0,
      maxRms
    }
    writeLog(`${label}: RMS měření`, measurement)
    return measurement
  }
}

function startTestTone(context) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const startAt = context.currentTime + 0.15

  oscillator.type = 'sine'
  gain.gain.setValueAtTime(0, startAt)
  for (let second = 0; second < 10; second += 1) {
    const pulseAt = startAt + second
    oscillator.frequency.setValueAtTime(second % 2 === 0 ? 659.25 : 987.77, pulseAt)
    gain.gain.setValueAtTime(0.075, pulseAt)
    gain.gain.setValueAtTime(0, pulseAt + 0.32)
  }
  oscillator.connect(gain).connect(context.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + 9.8)
  writeLog('Testovací tón spuštěn: 10 pulzů 659/988 Hz, gain 0,075.')

  return () => {
    try {
      oscillator.stop()
    } catch {
      // Oscilátor už skončil podle plánu.
    }
    oscillator.disconnect()
    gain.disconnect()
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function captureWithTimeout(capturePromise, label) {
  let timedOut = false
  let timeoutId

  const guardedCapture = capturePromise.then((stream) => {
    if (timedOut) {
      for (const track of stream.getTracks()) track.stop()
      throw new DOMException(`${label} se vrátil až po timeoutu`, 'TimeoutError')
    }
    return stream
  })

  const timeout = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true
      reject(new DOMException(
        `${label} nevrátil stream do ${CAPTURE_SETUP_TIMEOUT_MS / 1_000} s`,
        'TimeoutError'
      ))
    }, CAPTURE_SETUP_TIMEOUT_MS)
  })

  return Promise.race([guardedCapture, timeout]).finally(() => clearTimeout(timeoutId))
}

async function decodeAndPlayFromDisk(context, name, label) {
  const bytes = await window.experiment.read(name)
  const decoded = await context.decodeAudioData(bytes.slice(0))
  const source = context.createBufferSource()
  const gain = context.createGain()
  const playbackSeconds = Math.min(1.25, decoded.duration)
  gain.gain.value = 0.18
  source.buffer = decoded
  source.connect(gain).connect(context.destination)

  const ended = new Promise((resolve) => source.addEventListener('ended', resolve, { once: true }))
  const clockAtStart = context.currentTime
  source.start(0, 0, playbackSeconds)
  await Promise.race([ended, wait(2_000)])
  try {
    source.stop()
  } catch {
    // Zdroj už dohrál.
  }
  const clockAdvanced = context.currentTime - clockAtStart
  source.disconnect()
  gain.disconnect()

  const result = {
    durationSeconds: decoded.duration,
    sampleRate: decoded.sampleRate,
    channels: decoded.numberOfChannels,
    playbackRequestedSeconds: playbackSeconds,
    audioContextClockAdvancedSeconds: clockAdvanced
  }
  writeLog(`${label}: soubor z disku dekódován a krátce přehrán`, result)
  return result
}

async function runExperiment() {
  recordButton.disabled = true
  logElement.textContent = ''
  const startedAt = performance.now()
  const allOriginalStreams = []
  let audioContext
  let stopTone = () => {}
  const result = {
    ok: false,
    route: experimentInfo.route,
    versions: experimentInfo.versions,
    macOS: experimentInfo.macOS,
    initialPermissionStatus: experimentInfo.permissionStatus,
    files: {},
    rms: {},
    playback: {},
    errors: []
  }

  try {
    setStatus('Žádám současně o mikrofon a systémový zvuk…')

    let resumePromise = Promise.resolve()
    if (experimentInfo.skipWebAudio) {
      writeLog('Web Audio je pro tuto diagnostickou cestu vypnuté; tón, živé RMS a interní playback přeskočím.')
    } else {
      writeLog('Vytvářím AudioContext pro testovací tón, RMS a playback…')
      audioContext = new AudioContext({ latencyHint: 'interactive' })
      resumePromise = audioContext.resume()
      writeLog('AudioContext vytvořen; volám capture API.')
    }

    writeLog('Volám getUserMedia pro mikrofon…')
    const microphonePromise = captureWithTimeout(navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      },
      video: false
    }), 'Mikrofon')
    const preparePromise = window.experiment.prepare()

    if (experimentInfo.micOnly) {
      const [resumeResult, microphoneResult, prepareResult] = await Promise.allSettled([
        resumePromise,
        microphonePromise,
        preparePromise
      ])
      if (resumeResult.status === 'rejected') {
        throw new Error(`AudioContext.resume selhal: ${describeError(resumeResult.reason)}`)
      }
      if (prepareResult.status === 'rejected') {
        throw new Error(`Příprava výstupů selhala: ${describeError(prepareResult.reason)}`)
      }
      if (microphoneResult.status === 'rejected') {
        throw new Error(`mikrofon: ${describeError(microphoneResult.reason)}`)
      }

      allOriginalStreams.push(microphoneResult.value)
      const microphoneStream = audioOnlyStream(microphoneResult.value, 'Mikrofon')
      const microphoneRecorder = startRecorder(microphoneStream, 'Mikrofon')
      const recordingStartedAt = performance.now()
      setStatus('Nahrávám mikrofon přesně 10 sekund…')
      await wait(RECORDING_MS)
      microphoneRecorder.recorder.stop()
      result.actualRecordingMs = performance.now() - recordingStartedAt
      writeLog('Desetisekundový mikrofonní interval skončil.', {
        actualRecordingMs: result.actualRecordingMs
      })

      const microphoneBlob = await microphoneRecorder.stopped
      result.files.microphone = await window.experiment.save(
        'mikrofon.webm',
        await microphoneBlob.arrayBuffer()
      )
      result.rms.microphone = { skipped: true, reason: 'SKIP_WEB_AUDIO=1' }
      result.playback = { skipped: true, reason: 'ověří externí ffmpeg' }
      result.systemAudioAttempted = false
      result.permissionEvents = await window.experiment.permissionEvents()
      result.totalMs = performance.now() - startedAt
      result.ok = true
      setStatus('HOTOVO: mikrofon je uložený; systémový zvuk už vyčerpal tři cesty.')
      return
    }

    writeLog('Volám getDisplayMedia pro systémový zvuk…')
    const displayPromise = captureWithTimeout(
      navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }),
      'Systémový zvuk'
    )

    const [resumeResult, microphoneResult, displayResult, prepareResult] = await Promise.allSettled([
      resumePromise,
      microphonePromise,
      displayPromise,
      preparePromise
    ])

    if (resumeResult.status === 'rejected') {
      throw new Error(`AudioContext.resume selhal: ${describeError(resumeResult.reason)}`)
    }
    if (prepareResult.status === 'rejected') {
      throw new Error(`Příprava výstupů selhala: ${describeError(prepareResult.reason)}`)
    }
    if (microphoneResult.status === 'rejected') {
      result.errors.push(`mikrofon: ${describeError(microphoneResult.reason)}`)
    } else {
      allOriginalStreams.push(microphoneResult.value)
    }
    if (displayResult.status === 'rejected') {
      result.errors.push(`systém: ${describeError(displayResult.reason)}`)
    } else {
      allOriginalStreams.push(displayResult.value)
    }

    if (microphoneResult.status === 'rejected' || displayResult.status === 'rejected') {
      throw new Error(result.errors.join('; '))
    }

    const microphoneStream = audioOnlyStream(microphoneResult.value, 'Mikrofon')
    const systemStream = audioOnlyStream(displayResult.value, 'Systém')
    const microphoneRecorder = startRecorder(microphoneStream, 'Mikrofon')
    const systemRecorder = startRecorder(systemStream, 'Systém')
    const stopMicrophoneMonitor = audioContext
      ? monitorSignal(audioContext, microphoneStream, 'Mikrofon')
      : () => ({ skipped: true, reason: 'SKIP_WEB_AUDIO=1' })
    const stopSystemMonitor = audioContext
      ? monitorSignal(audioContext, systemStream, 'Systém')
      : () => ({ skipped: true, reason: 'SKIP_WEB_AUDIO=1' })

    const recordingStartedAt = performance.now()
    if (audioContext) stopTone = startTestTone(audioContext)
    setStatus('Nahrávám přesně 10 sekund…')
    await wait(RECORDING_MS)
    microphoneRecorder.recorder.stop()
    systemRecorder.recorder.stop()
    const actualRecordingMs = performance.now() - recordingStartedAt
    result.actualRecordingMs = actualRecordingMs
    writeLog('Společný desetisekundový interval skončil.', { actualRecordingMs })

    const [microphoneBlob, systemBlob] = await Promise.all([
      microphoneRecorder.stopped,
      systemRecorder.stopped
    ])
    result.rms.microphone = stopMicrophoneMonitor()
    result.rms.system = stopSystemMonitor()
    stopTone()
    stopTone = () => {}

    setStatus('Ukládám obě oddělené stopy…')
    result.files.microphone = await window.experiment.save('mikrofon.webm', await microphoneBlob.arrayBuffer())
    result.files.system = await window.experiment.save('system.webm', await systemBlob.arrayBuffer())

    if (audioContext) {
      setStatus('Načítám soubory zpět z disku a ověřuji přehrání…')
      result.playback.microphone = await decodeAndPlayFromDisk(audioContext, 'mikrofon.webm', 'Mikrofon')
      result.playback.system = await decodeAndPlayFromDisk(audioContext, 'system.webm', 'Systém')
    } else {
      result.playback = { skipped: true, reason: 'SKIP_WEB_AUDIO=1; ověří externí ffmpeg' }
      writeLog('Interní playback přeskočen; oba soubory ověří externí ffmpeg.')
    }
    result.permissionEvents = await window.experiment.permissionEvents()
    result.totalMs = performance.now() - startedAt
    result.ok = true
    setStatus(audioContext
      ? 'HOTOVO: oba soubory jsou uložené, dekódované a přehrané.'
      : 'HOTOVO: oba soubory jsou uložené; následuje externí kontrola ffmpeg.')
  } catch (error) {
    result.errors.push(describeError(error))
    result.permissionEvents = await window.experiment.permissionEvents().catch(() => [])
    result.totalMs = performance.now() - startedAt
    setStatus(`CHYBA: ${describeError(error)}`)
    writeLog(error.stack || String(error), undefined, 'error')
  } finally {
    stopTone()
    for (const stream of allOriginalStreams) {
      for (const track of stream.getTracks()) track.stop()
    }
    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close().catch(() => {})
    }
    recordButton.disabled = false
    window.experiment.complete(result)
  }
}

recordButton.addEventListener('click', runExperiment)

window.experiment.info().then((info) => {
  experimentInfo = info
  metaElement.textContent = `Cesta: ${info.route} · Electron ${info.versions.electron} · Chromium ${info.versions.chrome} · macOS ${info.macOS}`
  writeLog('Připraveno', {
    route: info.route,
    displayAudioMode: info.displayAudioMode,
    explicitFeatureFlag: info.explicitFeatureFlag,
    skipWebAudio: info.skipWebAudio,
    micOnly: info.micOnly,
    permissionStatus: info.permissionStatus,
    versions: {
      electron: info.versions.electron,
      chrome: info.versions.chrome,
      node: info.versions.node
    },
    macOS: info.macOS
  })
}).catch((error) => {
  recordButton.disabled = true
  setStatus(`Inicializace selhala: ${describeError(error)}`)
})
