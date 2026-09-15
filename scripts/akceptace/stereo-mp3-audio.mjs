// Skutečný převod syntetických tónů. Nejde o ui-smoke ani audio-smoke s mikrofonem.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { copyFile, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const options = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  assert(["--module", "--meeting-module", "--ffmpeg", "--ffprobe"].includes(name), `Neznámá volba ${name}`);
  assert(process.argv[index + 1], `Chybí hodnota ${name}`);
  options[name] = process.argv[index + 1];
}
const require = createRequire(import.meta.url);
const { convertToStereoMp3 } = require(path.resolve(options["--module"] ?? path.join(root, "electron/media-encoder.cjs")));
const { createLivePendingDelivery, ensureMeetingAudioReady } = require(path.resolve(options["--meeting-module"] ?? path.join(root, "electron/meeting-audio.cjs")));
const testFfmpeg = options["--ffmpeg"] ?? "ffmpeg";
const testFfprobe = options["--ffprobe"] ?? "ffprobe";
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "ludone-stereo-synthetic-"));
let failures = 0;
function run(executable, arguments_) {
  const result = spawnSync(executable, arguments_, { encoding: null, maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr?.toString());
  return result.stdout;
}
async function check(name, operation) {
  try { await operation(); console.log(`PASS ${name}`); }
  catch (error) { failures += 1; console.log(`FAIL ${name}: ${error.message}`); }
}
const base = ["-hide_banner", "-nostdin", "-nostats", "-loglevel", "error", "-n"];
const microphone = path.join(temporaryRoot, "microphone.webm");
const system = path.join(temporaryRoot, "system.webm");
const stereo = path.join(temporaryRoot, "stereo.webm");
const sha = async (file) => createHash("sha256").update(await readFile(file)).digest("hex");
function rms(samples, channel, from, to) {
  let power = 0;
  for (let index = from; index < to; index += 1) power += samples[index * 2 + channel] ** 2;
  return Math.sqrt(power / (to - from));
}
function tone(samples, channel, frequency) {
  let real = 0;
  let imaginary = 0;
  const from = 48000;
  const to = 3 * 48000;
  for (let index = from; index < to; index += 1) {
    const phase = 2 * Math.PI * frequency * index / 48000;
    real += samples[index * 2 + channel] * Math.cos(phase);
    imaginary += samples[index * 2 + channel] * Math.sin(phase);
  }
  return 2 * Math.hypot(real, imaginary) / (to - from);
}
async function verify(name, inputs, microphoneOnly = false, delayed = false) {
  const outputPath = path.join(temporaryRoot, `${name}.mp3`);
  await convertToStereoMp3({ ...inputs, outputPath });
  const metadata = JSON.parse(run(testFfprobe, ["-v", "error", "-show_streams", "-of", "json", outputPath]));
  assert.equal(metadata.streams.length, 1);
  assert.equal(metadata.streams[0].codec_name, "mp3");
  assert.equal(metadata.streams[0].channels, 2);
  assert.equal(metadata.streams[0].sample_rate, "48000");
  const pcm = run(testFfmpeg, ["-hide_banner", "-nostdin", "-loglevel", "error", "-xerror", "-i", outputPath, "-map", "0:a:0", "-f", "f32le", "-acodec", "pcm_f32le", "-"]);
  const samples = new Float32Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.length));
  const sampleCount = samples.length / 2;
  // Nejvýše jeden MP3 rámec; Xing/LAME metadata musí zachovat začátek a konec.
  assert(Math.abs(sampleCount - 12 * 48000) <= 1152, `Délka ${sampleCount} vzorků místo 576000`);
  assert(tone(samples, 0, 440) > 0.08, "Mikrofon není vlevo");
  assert(tone(samples, 0, 880) < 0.002, "Systémový tón pronikl doleva");
  if (microphoneOnly) assert(rms(samples, 1, 48000, 3 * 48000) < 0.00001, "Pravý kanál není tichý");
  else {
    assert(tone(samples, 1, 880) > 0.08, "Systémový zvuk není vpravo");
    assert(tone(samples, 1, 440) < 0.002, "Mikrofonní tón pronikl doprava");
  }
  if (delayed) {
    assert(rms(samples, 1, 0, Math.floor(0.15 * 48000)) < 0.002, "Chybí zpoždění systémové stopy");
    assert(rms(samples, 1, Math.floor(0.4 * 48000), 48000) > 0.05, "Systémová stopa po zpoždění chybí");
  }
  assert.equal((await stat(outputPath)).mode & 0o777, 0o600, "MP3 má zůstat soukromý (0600)");
  const before = await sha(outputPath);
  await assert.rejects(convertToStereoMp3({ ...inputs, outputPath }));
  assert.equal(await sha(outputPath), before, "Opakovaný převod přepsal existující MP3");
  console.log(JSON.stringify({ scenario: name, samples: sampleCount, left440: tone(samples, 0, 440), right880: tone(samples, 1, 880), bytes: (await stat(outputPath)).size }));
}
try {
  run(testFfmpeg, [...base, "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=12", "-c:a", "libopus", microphone]);
  run(testFfmpeg, [...base, "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=48000:duration=11.75", "-ac", "2", "-c:a", "libopus", system]);
  run(testFfmpeg, [...base, "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=12", "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=48000:duration=12", "-filter_complex", "[0:a][1:a]join=inputs=2:channel_layout=stereo:map=0.0-FL|1.0-FR[a]", "-map", "[a]", "-c:a", "libopus", stereo]);
  const originalHashes = await Promise.all([microphone, system, stereo].map(sha));
  await check("živý stereo WebM → jediný MP3, kanály, délka, soukromí a ochrana přepsání", () => verify("live", { stereoWebmPath: stereo }));
  await check("dva původní soubory → zarovnaný stereo MP3", () => verify("aligned", { microphoneWebmPath: microphone, systemWebmPath: system, timing: { durationMs: 12000, microphoneDelayMs: 0, systemDelayMs: 250 } }, false, true));
  await check("jen mikrofon → vlevo hlas, vpravo ticho", () => verify("microphone-only", { microphoneWebmPath: microphone, timing: { durationMs: 12000 } }, true));
  await check("skutečný runtime helper → přibalený encoder → trvalá identita po restartu", async () => {
    const clientRecordingId = randomUUID();
    const manifestPath = path.join(temporaryRoot, `${clientRecordingId}.manifest.json`);
    const masterPath = path.join(temporaryRoot, `${clientRecordingId}-stereo-master.webm`);
    const startedAt = "2026-09-15T08:00:00.000Z";
    const endedAt = "2026-09-15T08:00:12.000Z";
    await copyFile(stereo, masterPath);
    const tracks = {};
    for (const [source, file] of [["microphone", microphone], ["system", system]]) {
      tracks[source] = { fileName: path.basename(file), startedAt, endedAt,
        sizeBytes: (await stat(file)).size, sha256: await sha(file) };
    }
    await writeFile(manifestPath, JSON.stringify({ schemaVersion: 1, clientRecordingId,
      createdAt: startedAt, closedAt: endedAt, state: "complete", tracks }), { mode: 0o600 });
    const delivery = await createLivePendingDelivery({ clientRecordingId, manifestPath, masterPath,
      recordingsDirectory: temporaryRoot, startedAt, endedAt, captureSources: "microphone+system" });
    const item = { attempts: 0, clientRecordingId, manifestPath, delivery, server: {}, state: "ceka",
      tracks: { microphone, system } };
    const encoderOptions = { recordingsDirectory: temporaryRoot,
      projectRoot: options["--module"] ? path.resolve(path.dirname(options["--module"]), "..") : root };
    const ready = await ensureMeetingAudioReady(item, encoderOptions);
    assert.equal(ready.state, "ready");
    assert.equal(ready.mime, "audio/mpeg");
    assert.equal(ready.sha256, await sha(ready.filePath));
    assert.equal(ready.sizeBytes, (await stat(ready.filePath)).size);
    // Nový proces uvidí pouze JSON; encoder při obnově už nesmí běžet.
    const restored = JSON.parse(JSON.stringify({ ...item, delivery: ready,
      server: { companyTabidooId: randomUUID(), delivery: { recordingId: randomUUID(), uploadedBytes: 1 } } }));
    const reused = await ensureMeetingAudioReady(restored, { ...encoderOptions,
      convertToStereoMp3: () => { throw new Error("Obnova znovu spustila encoder"); } });
    assert.deepEqual(reused, ready);
    const metadata = JSON.parse(run(testFfprobe, ["-v", "error", "-show_streams", "-of", "json", ready.filePath]));
    assert.equal(metadata.streams[0].codec_name, "mp3");
    assert.equal(metadata.streams[0].channels, 2);
  });
  await check("původní soubory zůstaly bitově zachované", async () => assert.deepEqual(await Promise.all([microphone, system, stereo].map(sha)), originalHashes));
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
console.log(`FAILURES=${failures}`);
process.exitCode = failures === 0 ? 0 : 1;
