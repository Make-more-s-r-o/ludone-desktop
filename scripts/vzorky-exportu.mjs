import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow } from "electron";

const require = createRequire(import.meta.url);
const { inspectOpusWebm } = require("../electron/recording-export.cjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT_DIRECTORY = path.join(ROOT, "docs", "changes", "desktop-v1", "vzorky");
const MIME_TYPE = "audio/webm;codecs=opus";
const AUDIO_BITS_PER_SECOND = 128_000;
const RECORDING_TIMESLICE_MS = 1_000;
const RECORDING_DURATION_MS = 2_200;
const RECORDER_EVENT_TIMEOUT_MS = 5_000;
const SOURCE_SAMPLE_RATE = 48_000;
const HEADER_READ_BYTES = 64 * 1024;
const TWO_TRACK_FILE = "dvoustopa-440hz-880hz.webm";
const MICROPHONE_ONLY_FILE = "jednostopa-440hz-ticho.webm";
const runtimeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ludone-vzorky-electron-"));

for (const [name, directory] of Object.entries({
  cache: "cache",
  crashDumps: "crash-dumps",
  sessionData: "session-data",
  temp: "temp",
  userData: "user-data",
})) {
  const target = path.join(runtimeDirectory, directory);
  fs.mkdirSync(target, { recursive: true });
  app.setPath(name, target);
}
const logsDirectory = path.join(runtimeDirectory, "logs");
fs.mkdirSync(logsDirectory, { recursive: true });
app.setAppLogsPath(logsDirectory);
process.once("exit", () => fs.rmSync(runtimeDirectory, { force: true, recursive: true }));

function parseOutputDirectory(argv) {
  if (argv.length === 0) return DEFAULT_OUTPUT_DIRECTORY;
  if (argv.length === 2 && argv[0] === "--output" && argv[1]) {
    return path.resolve(argv[1]);
  }
  throw new Error("Použití: npm run vzorky -- [--output <adresář>]");
}

function moduleDataUrl(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

async function generateInChromium({
  audioBitsPerSecond,
  durationMs,
  eventTimeoutMs,
  microphoneOnlyModuleUrl,
  mimeType,
  sampleRate,
  stereoModuleUrl,
  timesliceMs,
}) {
  const [{ createStereoCapture }, { createMicrophoneOnlyExportCapture }] = await Promise.all([
    import(stereoModuleUrl),
    import(microphoneOnlyModuleUrl),
  ]);
  const AudioContextConstructor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  const MediaRecorderConstructor = globalThis.MediaRecorder;
  if (!AudioContextConstructor || !MediaRecorderConstructor) {
    throw new Error("Chromium neposkytl Web Audio nebo MediaRecorder");
  }
  if (!MediaRecorderConstructor.isTypeSupported(mimeType)) {
    throw new Error(`Chromium nepodporuje produkční MIME ${mimeType}`);
  }

  const sourceContext = new AudioContextConstructor({ sampleRate });
  const sources = [];

  function tone(frequency) {
    const destination = sourceContext.createMediaStreamDestination();
    destination.channelCount = 1;
    destination.channelCountMode = "explicit";
    const oscillator = sourceContext.createOscillator();
    const gain = sourceContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.18;
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start();
    const source = {
      destination,
      gain,
      oscillator,
      stop() {
        oscillator.stop();
        oscillator.disconnect();
        gain.disconnect();
      },
    };
    sources.push(source);
    return source;
  }

  function wait(milliseconds) {
    return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
  }

  function recorderTransition(recorder, eventName, action, timeoutMessage) {
    return new Promise((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => {
        cleanup();
        reject(new Error(timeoutMessage));
      }, eventTimeoutMs);
      const cleanup = () => {
        globalThis.clearTimeout(timeout);
        recorder.removeEventListener(eventName, onExpectedEvent);
        recorder.removeEventListener("error", onError);
      };
      const onExpectedEvent = () => {
        cleanup();
        resolve();
      };
      const onError = (event) => {
        cleanup();
        reject(event.error ?? new Error(timeoutMessage));
      };
      recorder.addEventListener(eventName, onExpectedEvent, { once: true });
      recorder.addEventListener("error", onError, { once: true });
      try {
        action();
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  async function record(stream) {
    const tracks = stream.getAudioTracks();
    if (tracks.length !== 1) {
      throw new Error(`Exportní stream má ${tracks.length} audio stop místo jedné`);
    }
    const chunks = [];
    const recorder = new MediaRecorderConstructor(stream, {
      mimeType,
      audioBitsPerSecond,
    });
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });

    await recorderTransition(
      recorder,
      "start",
      () => recorder.start(timesliceMs),
      "MediaRecorder nepotvrdil start",
    );
    await wait(durationMs);
    await recorderTransition(
      recorder,
      "stop",
      () => recorder.stop(),
      "MediaRecorder nepotvrdil zastavení",
    );

    const blob = new globalThis.Blob(chunks, { type: recorder.mimeType });
    return {
      bytes: [...new Uint8Array(await blob.arrayBuffer())],
      mimeType: recorder.mimeType,
      requestedBitsPerSecond: audioBitsPerSecond,
      trackSettings: tracks[0].getSettings?.() ?? {},
    };
  }

  function rms(samples, start, end) {
    let sum = 0;
    for (let index = start; index < end; index += 1) sum += samples[index] ** 2;
    return Math.sqrt(sum / Math.max(1, end - start));
  }

  function amplitudeAt(samples, decodedSampleRate, frequency, start, end) {
    let sine = 0;
    let cosine = 0;
    for (let index = start; index < end; index += 1) {
      const phase = 2 * Math.PI * frequency * index / decodedSampleRate;
      sine += samples[index] * Math.sin(phase);
      cosine += samples[index] * Math.cos(phase);
    }
    return 2 * Math.hypot(sine, cosine) / Math.max(1, end - start);
  }

  async function analyze(encodedBytes) {
    const decodeContext = new AudioContextConstructor({ sampleRate });
    try {
      const byteArray = Uint8Array.from(encodedBytes);
      const decoded = await decodeContext.decodeAudioData(byteArray.buffer);
      const margin = Math.min(
        Math.floor(decoded.sampleRate * 0.15),
        Math.floor(decoded.length / 4),
      );
      const start = margin;
      const end = decoded.length - margin;
      const channels = [];
      for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
        const samples = decoded.getChannelData(channel);
        channels.push({
          rms: rms(samples, start, end),
          amplitude440Hz: amplitudeAt(samples, decoded.sampleRate, 440, start, end),
          amplitude880Hz: amplitudeAt(samples, decoded.sampleRate, 880, start, end),
        });
      }
      return {
        channels,
        durationSeconds: decoded.length / decoded.sampleRate,
        frameCount: decoded.length,
        numberOfChannels: decoded.numberOfChannels,
        sampleRate: decoded.sampleRate,
      };
    } finally {
      await decodeContext.close();
    }
  }

  if (sourceContext.state === "suspended") await sourceContext.resume();
  const microphone = tone(440);
  const system = tone(880);
  let twoTrackCapture;
  let microphoneOnlyCapture;
  try {
    twoTrackCapture = await createStereoCapture(
      microphone.destination.stream.getAudioTracks()[0],
      system.destination.stream.getAudioTracks()[0],
    );
    const twoTrack = await record(twoTrackCapture.stream);
    await twoTrackCapture.close();
    twoTrackCapture = null;

    microphoneOnlyCapture = await createMicrophoneOnlyExportCapture(
      microphone.destination.stream.getAudioTracks()[0],
    );
    const microphoneOnly = await record(microphoneOnlyCapture.stream);
    await microphoneOnlyCapture.close();
    microphoneOnlyCapture = null;

    return {
      microphoneOnly: {
        ...microphoneOnly,
        analysis: await analyze(microphoneOnly.bytes),
      },
      twoTrack: {
        ...twoTrack,
        analysis: await analyze(twoTrack.bytes),
      },
    };
  } finally {
    await twoTrackCapture?.close().catch(() => {});
    await microphoneOnlyCapture?.close().catch(() => {});
    for (const source of sources) source.stop();
    await sourceContext.close();
  }
}

function opusHeader(bytes) {
  const opusHeadOffset = bytes.indexOf(Buffer.from("OpusHead", "ascii"));
  if (opusHeadOffset < 0 || opusHeadOffset + 19 > bytes.length) {
    throw new Error("Ve vzorku chybí úplná hlavička OpusHead");
  }
  return {
    channels: bytes[opusHeadOffset + 9],
    inputSampleRate: bytes.readUInt32LE(opusHeadOffset + 12),
    mappingFamily: bytes[opusHeadOffset + 18],
    version: bytes[opusHeadOffset + 8],
  };
}

function ebmlVintLength(firstByte) {
  for (let length = 1; length <= 8; length += 1) {
    if ((firstByte & (1 << (8 - length))) !== 0) return length;
  }
  throw new Error("Neplatné EBML VINT");
}

function readEbmlId(bytes, offset) {
  const length = ebmlVintLength(bytes[offset]);
  if (offset + length > bytes.length) throw new Error("Neúplné EBML ID");
  let value = 0;
  for (let index = 0; index < length; index += 1) value = value * 256 + bytes[offset + index];
  return { length, value };
}

function readEbmlSize(bytes, offset) {
  const length = ebmlVintLength(bytes[offset]);
  if (offset + length > bytes.length) throw new Error("Neúplná EBML velikost");
  const markerMask = 1 << (8 - length);
  let value = bytes[offset] & (markerMask - 1);
  for (let index = 1; index < length; index += 1) value = value * 256 + bytes[offset + index];
  return { length, value };
}

function webmAudioTrack(bytes) {
  const clusterOffset = bytes.indexOf(Buffer.from([0x1f, 0x43, 0xb6, 0x75]));
  const searchEnd = clusterOffset < 0 ? bytes.length : clusterOffset;
  for (let offset = 0; offset < searchEnd; offset += 1) {
    if (bytes[offset] !== 0xe1) continue;
    try {
      const audioSize = readEbmlSize(bytes, offset + 1);
      let childOffset = offset + 1 + audioSize.length;
      const audioEnd = childOffset + audioSize.value;
      if (audioEnd > searchEnd) continue;
      let channels = null;
      let samplingFrequency = null;
      while (childOffset < audioEnd) {
        const id = readEbmlId(bytes, childOffset);
        const size = readEbmlSize(bytes, childOffset + id.length);
        const dataOffset = childOffset + id.length + size.length;
        const dataEnd = dataOffset + size.value;
        if (dataEnd > audioEnd) throw new Error("Prvek přesahuje EBML Audio");
        if (id.value === 0xb5 && (size.value === 4 || size.value === 8)) {
          samplingFrequency = size.value === 4
            ? bytes.readFloatBE(dataOffset)
            : bytes.readDoubleBE(dataOffset);
        }
        if (id.value === 0x9f && size.value >= 1 && size.value <= 4) {
          channels = bytes.readUIntBE(dataOffset, size.value);
        }
        childOffset = dataEnd;
      }
      if (Number.isFinite(samplingFrequency) && Number.isInteger(channels)) {
        return { channels, samplingFrequency };
      }
    } catch {
      // Bajt E1 mimo TrackAudio není kandidát; pokračujeme jen v hlavičce před Clusterem.
    }
  }
  throw new Error("WebM neobsahuje čitelný prvek TrackAudio");
}

function ratioDb(numerator, denominator) {
  return 20 * Math.log10(Math.max(Number.MIN_VALUE, numerator)
    / Math.max(Number.MIN_VALUE, denominator));
}

function rmsDbfs(value) {
  return value === 0 ? "−∞" : (20 * Math.log10(value)).toFixed(1);
}

function validateSample(sample, expectedMode) {
  const bytes = Buffer.from(sample.bytes);
  const inspected = inspectOpusWebm(bytes.subarray(0, HEADER_READ_BYTES));
  const header = opusHeader(bytes);
  const trackAudio = webmAudioTrack(bytes.subarray(0, HEADER_READ_BYTES));
  assert.equal(sample.mimeType, MIME_TYPE, "MediaRecorder musí potvrdit produkční MIME");
  assert.deepEqual(inspected, { container: "WebM", codec: "Opus", channels: 2 });
  assert.equal(header.version, 1, "OpusHead musí mít verzi 1");
  assert.equal(header.channels, 2, "OpusHead musí deklarovat dva kanály");
  assert.equal(header.inputSampleRate, SOURCE_SAMPLE_RATE, "OpusHead musí uvádět 48 kHz");
  assert.deepEqual(
    trackAudio,
    { channels: 2, samplingFrequency: SOURCE_SAMPLE_RATE },
    "WebM TrackAudio musí deklarovat stereo při 48 kHz",
  );
  assert.equal(sample.analysis.numberOfChannels, 2, "Dekodér musí vrátit dva kanály");
  assert.equal(sample.analysis.sampleRate, SOURCE_SAMPLE_RATE, "Dekodér musí vrátit 48 kHz");
  assert.ok(
    sample.analysis.durationSeconds >= 1.5 && sample.analysis.durationSeconds <= 4,
    `Neočekávaná dekódovaná délka ${sample.analysis.durationSeconds} s`,
  );
  assert.ok(bytes.length >= 1_000 && bytes.length <= 100_000, `Neočekávaná velikost ${bytes.length} B`);

  const [left, right] = sample.analysis.channels;
  assert.ok(left.rms > 0.01, "Levý kanál neobsahuje slyšitelný tón");
  assert.ok(
    ratioDb(left.amplitude440Hz, left.amplitude880Hz) >= 20,
    "V levém kanálu nepřevažuje 440 Hz alespoň o 20 dB",
  );
  if (expectedMode === "two-track") {
    assert.ok(right.rms > 0.01, "Pravý kanál dvoustopého vzorku neobsahuje slyšitelný tón");
    assert.ok(
      ratioDb(right.amplitude880Hz, right.amplitude440Hz) >= 20,
      "V pravém kanálu nepřevažuje 880 Hz alespoň o 20 dB",
    );
  } else {
    assert.ok(
      right.rms <= Math.max(1e-6, left.rms * 1e-4),
      `Pravý kanál jednostopého vzorku není tichý (RMS ${right.rms})`,
    );
  }

  return { bytes, header, inspected, trackAudio };
}

async function writeAtomically(filePath, contents) {
  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  let handle;
  try {
    handle = await fs.promises.open(temporaryPath, "wx", 0o600);
    await handle.writeFile(contents);
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.promises.rename(temporaryPath, filePath);
  } catch (error) {
    await handle?.close().catch(() => {});
    await fs.promises.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function inspectWrittenFile(filePath, expectedBytes) {
  const writtenBytes = await fs.promises.readFile(filePath);
  assert.ok(writtenBytes.equals(expectedBytes), `Zapsaný soubor ${path.basename(filePath)} změnil bajty`);
  return inspectOpusWebm(writtenBytes.subarray(0, HEADER_READ_BYTES));
}

function readmeFor({ electronVersion, microphoneOnly, outputDirectory, twoTrack }) {
  const relativeDirectory = path.relative(ROOT, outputDirectory) || ".";
  const row = (fileName, validated, sample, channels) => [
    `\`${fileName}\``,
    `${validated.inspected.container} / ${validated.inspected.codec}`,
    String(validated.inspected.channels),
    `${validated.trackAudio.samplingFrequency} Hz`,
    `${sample.analysis.durationSeconds.toFixed(3)} s`,
    `${validated.bytes.length} B`,
    channels,
  ].join(" | ");

  return `# Syntetické vzorky exportu

Tyto soubory neobsahují žádnou skutečnou schůzku. Příkaz \`npm run vzorky\`
je vytvořil syntetickými oscilátory ve skrytém Electronu ${electronVersion} a skutečným
Chromium \`MediaRecorder\`, který používá i aplikace. Výstupní adresář:
\`${relativeDirectory}\`.

| soubor | kontejner / kodek | kanály | vzorkovací frekvence | dekódovaná délka | velikost | obsah kanálů |
|---|---|---:|---:|---:|---:|---|
| ${row(TWO_TRACK_FILE, twoTrack, twoTrack.sample, "vlevo 440 Hz; vpravo 880 Hz")} |
| ${row(MICROPHONE_ONLY_FILE, microphoneOnly, microphoneOnly.sample, "vlevo 440 Hz; vpravo digitální ticho na vstupu enkodéru")} |

## Jak vznikly

Generátor načítá přímo produkční funkce \`createStereoCapture\` a
\`createMicrophoneOnlyExportCapture\`. Nahrává s produkčními parametry
\`audio/webm;codecs=opus\`, požadavkem 128 000 bit/s a chunky po 1 000 ms.
Soubory jsou prostým spojením chunků \`MediaRecorder\`; neproběhl remux ani převod
přes ffmpeg.

U jednostopé varianty je pravý vstup dvoukanálového \`ChannelMerger\` nezapojený.
Proto do enkodéru vstupuje digitální nula. Opus je ztrátový kodek, takže se po
dekódování kontroluje zanedbatelná úroveň pravého kanálu, ne nulové PCM bajty;
naměřené RMS je ${rmsDbfs(microphoneOnly.sample.analysis.channels[1].rms)} dBFS.

Vzorkovací frekvence v tabulce je hodnota \`SamplingFrequency\` načtená přímo
z prvku \`TrackAudio\` ve vyrobeném WebM. Délka vychází z počtu dekódovaných
vzorků; dekodér při měření pracuje při 48 kHz.

## Kontrola

Oba soubory generátor po vytvoření dekóduje, měří oddělení tónů a nechá projít
přímo produkční funkcí \`inspectOpusWebm\` nad prvními 64 KiB:

- \`${TWO_TRACK_FILE}\`: PASS ${JSON.stringify(twoTrack.inspected)}
- \`${MICROPHONE_ONLY_FILE}\`: PASS ${JSON.stringify(microphoneOnly.inspected)}

Celková délka se měří z počtu dekódovaných vzorků. Streamovaný WebM z Chromium
\`MediaRecorder\` nemusí mít v kontejneru zapsaný prvek Duration.
`;
}

async function generateSamples() {
  const outputDirectory = parseOutputDirectory(process.argv.slice(2));
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      partition: `ludone-vzorky-${process.pid}-${randomUUID()}`,
      sandbox: true,
    },
  });

  try {
    await window.loadURL("about:blank");
    const generated = await window.webContents.executeJavaScript(
      `(${generateInChromium.toString()})(${JSON.stringify({
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        durationMs: RECORDING_DURATION_MS,
        eventTimeoutMs: RECORDER_EVENT_TIMEOUT_MS,
        microphoneOnlyModuleUrl: moduleDataUrl(
          path.join(ROOT, "src", "features", "recording", "microphone-only-capture.js"),
        ),
        mimeType: MIME_TYPE,
        sampleRate: SOURCE_SAMPLE_RATE,
        stereoModuleUrl: moduleDataUrl(path.join(ROOT, "src", "lib", "stereo-recording.js")),
        timesliceMs: RECORDING_TIMESLICE_MS,
      })})`,
      true,
    );
    const twoTrack = {
      ...validateSample(generated.twoTrack, "two-track"),
      sample: generated.twoTrack,
    };
    const microphoneOnly = {
      ...validateSample(generated.microphoneOnly, "microphone-only"),
      sample: generated.microphoneOnly,
    };

    await fs.promises.mkdir(outputDirectory, { recursive: true });
    await Promise.all([
      writeAtomically(path.join(outputDirectory, TWO_TRACK_FILE), twoTrack.bytes),
      writeAtomically(path.join(outputDirectory, MICROPHONE_ONLY_FILE), microphoneOnly.bytes),
    ]);
    const [twoTrackDiskInspection, microphoneOnlyDiskInspection] = await Promise.all([
      inspectWrittenFile(path.join(outputDirectory, TWO_TRACK_FILE), twoTrack.bytes),
      inspectWrittenFile(path.join(outputDirectory, MICROPHONE_ONLY_FILE), microphoneOnly.bytes),
    ]);
    assert.deepEqual(twoTrackDiskInspection, twoTrack.inspected);
    assert.deepEqual(microphoneOnlyDiskInspection, microphoneOnly.inspected);
    twoTrack.inspected = twoTrackDiskInspection;
    microphoneOnly.inspected = microphoneOnlyDiskInspection;
    await writeAtomically(
      path.join(outputDirectory, "README.md"),
      readmeFor({
        electronVersion: process.versions.electron,
        microphoneOnly,
        outputDirectory,
        twoTrack,
      }),
    );

    const lineTwoTrack = `PASS inspectOpusWebm ${TWO_TRACK_FILE}: ${JSON.stringify(twoTrack.inspected)}`;
    const lineMicrophoneOnly = `PASS inspectOpusWebm ${MICROPHONE_ONLY_FILE}: ${JSON.stringify(microphoneOnly.inspected)}`;
    console.log(lineTwoTrack);
    console.log(lineMicrophoneOnly);
    console.log(JSON.stringify({
      cimJsemVyrobil: `Electron ${process.versions.electron}, produkční Web Audio graf a Chromium MediaRecorder`,
      coJeVKanalech: "dvoustopý: vlevo 440 Hz, vpravo 880 Hz; jednostopý: vlevo 440 Hz, vpravo digitální ticho",
      prosloKontrolou: `${lineTwoTrack}; ${lineMicrophoneOnly}`,
      tvarSouboru: [
        `${TWO_TRACK_FILE}: WebM, Opus, 2 kanály, ${twoTrack.trackAudio.samplingFrequency} Hz, ${twoTrack.sample.analysis.durationSeconds.toFixed(3)} s`,
        `${MICROPHONE_ONLY_FILE}: WebM, Opus, 2 kanály, ${microphoneOnly.trackAudio.samplingFrequency} Hz, ${microphoneOnly.sample.analysis.durationSeconds.toFixed(3)} s`,
      ].join("; "),
    }));
  } finally {
    window.destroy();
  }
}

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("disable-breakpad");
app.whenReady().then(async () => {
  await generateSamples();
  app.quit();
}).catch((error) => {
  console.error(error.stack || error.message);
  app.exit(1);
});
