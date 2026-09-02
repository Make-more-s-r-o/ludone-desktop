/* global Buffer, __dirname, console, process */
const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");
const { inspectOpusWebm } = require("../electron/recording-export.cjs");

// Ruční měřicí běh používá skutečný Chromium MediaRecorder, ale syntetické zdroje.
// Nežádá proto o mikrofon ani Záznam obrazovky a výsledek je opakovatelný v sandboxu.
async function measureStereoRecorder() {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  await window.loadURL("about:blank");

  const moduleSource = fs.readFileSync(
    path.join(__dirname, "..", "src", "lib", "stereo-recording.js"),
    "utf8",
  );
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`;
  const measured = await window.webContents.executeJavaScript(`
    (async () => {
      const { createStereoCapture } = await import(${JSON.stringify(moduleUrl)});
      const sourceContext = new AudioContext({ sampleRate: 48_000 });
      await sourceContext.resume();

      function tone(frequency) {
        const destination = sourceContext.createMediaStreamDestination();
        destination.channelCount = 1;
        destination.channelCountMode = "explicit";
        const oscillator = sourceContext.createOscillator();
        oscillator.frequency.value = frequency;
        oscillator.connect(destination);
        oscillator.start();
        return { destination, oscillator };
      }

      function measuredRecorder(stream) {
        const chunks = [];
        const recorder = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
          audioBitsPerSecond: 128_000,
        });
        let resolveStarted;
        const started = new Promise((resolve) => { resolveStarted = resolve; });
        recorder.addEventListener("start", (event) => {
          resolveStarted(performance.timeOrigin + event.timeStamp);
        }, { once: true });
        recorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        });
        return {
          recorder,
          start() {
            recorder.start(100);
            return started;
          },
          stop() {
            return new Promise((resolve, reject) => {
              recorder.addEventListener("error", (event) => reject(event.error), { once: true });
              recorder.addEventListener("stop", async (event) => {
                const blob = new Blob(chunks, { type: recorder.mimeType });
                resolve({
                  bytes: [...new Uint8Array(await blob.arrayBuffer())],
                  endedAtMs: performance.timeOrigin + event.timeStamp,
                });
              }, { once: true });
              recorder.stop();
            });
          },
        };
      }

      const microphone = tone(440);
      const system = tone(880);
      const capture = await createStereoCapture(
        microphone.destination.stream.getAudioTracks()[0],
        system.destination.stream.getAudioTracks()[0],
      );
      const microphoneRecorder = measuredRecorder(microphone.destination.stream);
      const systemRecorder = measuredRecorder(system.destination.stream);
      const stereoRecorder = measuredRecorder(capture.stream);

      const microphoneStartPromise = microphoneRecorder.start();
      const systemStartPromise = systemRecorder.start();
      const [microphoneStartedAtMs, systemStartedAtMs] = await Promise.all([
        microphoneStartPromise,
        systemStartPromise,
      ]);
      const stereoStartedAtMs = await stereoRecorder.start();
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      const stereo = await stereoRecorder.stop();
      await Promise.all([microphoneRecorder.stop(), systemRecorder.stop()]);

      microphone.oscillator.stop();
      system.oscillator.stop();
      await capture.close();
      await sourceContext.close();
      return {
        bytes: stereo.bytes,
        microphoneStartedAtMs,
        systemStartedAtMs,
        stereoStartedAtMs,
        stereoEndedAtMs: stereo.endedAtMs,
      };
    })()
  `, true);

  const outputPath = path.join(app.getPath("temp"), `ludone-stereo-mereni-${process.pid}.webm`);
  const bytes = Buffer.from(measured.bytes);
  fs.writeFileSync(outputPath, bytes, { mode: 0o600 });
  const format = inspectOpusWebm(bytes);
  window.destroy();
  return {
    outputPath,
    bytes: bytes.length,
    format,
    microphoneStartedAt: new Date(measured.microphoneStartedAtMs).toISOString(),
    systemStartedAt: new Date(measured.systemStartedAtMs).toISOString(),
    stereoStartedAt: new Date(measured.stereoStartedAtMs).toISOString(),
    stereoEndedAt: new Date(measured.stereoEndedAtMs).toISOString(),
    rawTrackStartDeltaMs: Math.abs(
      measured.microphoneStartedAtMs - measured.systemStartedAtMs,
    ),
    manifestTrackStartDeltaMs: Math.abs(
      Date.parse(new Date(measured.microphoneStartedAtMs).toISOString())
      - Date.parse(new Date(measured.systemStartedAtMs).toISOString()),
    ),
  };
}

app.whenReady().then(async () => {
  console.log(JSON.stringify(await measureStereoRecorder()));
  app.quit();
}).catch((error) => {
  console.error(error.stack || error.message);
  app.exit(1);
});
