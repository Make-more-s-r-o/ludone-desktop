// Hodinový syntetický soubor; nejde o nahrávání mikrofonu ani produkční upload.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const options = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  assert(["--module", "--ffmpeg", "--ffprobe", "--resources"].includes(name));
  assert(process.argv[index + 1], `Chybí hodnota ${name}`);
  options[name] = process.argv[index + 1];
}
const require = createRequire(import.meta.url);
const { prepareStereoWebm } = require(path.resolve(options["--module"] ?? path.join(projectRoot, "electron/media-encoder.cjs")));
const ffmpeg = options["--ffmpeg"] ?? "ffmpeg";
const ffprobe = options["--ffprobe"] ?? "ffprobe";
const directory = await mkdtemp(path.join(tmpdir(), "ludone-hour-synthetic-"));
function run(executable, args, capture = false) {
  return new Promise((resolve, reject) => {
    let output = "";
    const child = spawn(executable, args, { stdio: ["ignore", capture ? "pipe" : "inherit", "inherit"] });
    if (capture) child.stdout.on("data", data => { output += data; });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve(output) : reject(new Error(`${executable}: exit ${code}`)));
  });
}
try {
  const input = path.join(directory, "hour-source.webm");
  const outputPath = path.join(directory, "hour-delivery.webm");
  await run(ffmpeg, ["-hide_banner", "-nostdin", "-nostats", "-loglevel", "error", "-n",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=3600",
    "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=48000:duration=3600",
    "-filter_complex", "[0:a][1:a]join=inputs=2:channel_layout=stereo:map=0.0-FL|1.0-FR[a]",
    "-map", "[a]", "-c:a", "libopus", "-b:a", "96k", input]);
  console.log("PASS vytvořen hodinový syntetický stereo Opus");
  const start = performance.now();
  await prepareStereoWebm({ stereoWebmPath: input, outputPath,
    ...(options["--resources"] ? { isPackaged: true, resourcesPath: path.resolve(options["--resources"]) } : {}) });
  const remuxSeconds = (performance.now() - start) / 1000;
  const details = JSON.parse(await run(ffprobe, ["-v", "error", "-show_entries",
    "format=duration:stream=codec_name,channels,sample_rate", "-of", "json", outputPath], true));
  assert.equal(details.streams.length, 1);
  assert.equal(details.streams[0].codec_name, "opus");
  assert.equal(details.streams[0].channels, 2);
  assert.equal(details.streams[0].sample_rate, "48000");
  assert(Math.abs(Number(details.format.duration) - 3600) < 0.1);
  console.log(JSON.stringify({ remuxSeconds,
    inputBytes: (await stat(input)).size, outputBytes: (await stat(outputPath)).size, ...details }));
  await run(ffmpeg, ["-hide_banner", "-nostdin", "-nostats", "-loglevel", "error",
    "-xerror", "-i", outputPath, "-f", "null", "-"]);
  console.log("PASS celý hodinový WebM/Opus se dekóduje bez chyby; živá schůzka zůstává neověřená");
} finally {
  await rm(directory, { recursive: true, force: true });
}
