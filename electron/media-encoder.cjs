const { randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");
const { access, chmod, link, lstat, mkdir, mkdtemp, open, rm, stat } = require("node:fs/promises");
const { constants } = require("node:fs");
const path = require("node:path");

const ENCODER_VERSION = "6.1.6";
const STDERR_LIMIT = 64 * 1024;
const SUPPORTED_ARCHITECTURES = new Set(["arm64", "x64"]);

function resolveMediaEncoderPath({
  resourcesPath = process.resourcesPath,
  isPackaged = false,
  arch = process.arch,
  platform = process.platform,
  projectRoot = path.resolve(__dirname, ".."),
} = {}) {
  if (platform !== "darwin") throw new Error("Přibalený media encoder podporuje pouze macOS");
  if (!SUPPORTED_ARCHITECTURES.has(arch)) throw new Error(`Nepodporovaná architektura encoderu: ${arch}`);
  if (isPackaged) {
    if (typeof resourcesPath !== "string" || resourcesPath.length === 0) {
      throw new Error("Chybí cesta Resources pro přibalený media encoder");
    }
    return path.join(resourcesPath, "media-encoder", "ffmpeg");
  }
  return path.join(
    projectRoot,
    ".runtime",
    "media-encoder",
    `ffmpeg-${ENCODER_VERSION}`,
    `darwin-${arch}`,
    "ffmpeg",
  );
}

function numericTiming(timing, name, fallback) {
  const value = timing?.[name] ?? fallback;
  if (!Number.isFinite(value) || value < 0) throw new Error(`Neplatné časování: ${name}`);
  return value;
}

function seconds(milliseconds) {
  return (milliseconds / 1000).toFixed(3);
}

function commonOutputArguments(temporaryPath) {
  return [
    "-vn",
    "-c:a", "libmp3lame",
    "-b:a", "192k",
    "-joint_stereo", "0",
    "-write_xing", "1",
    "-map_metadata", "-1",
    "-id3v2_version", "0",
    "-f", "mp3",
    temporaryPath,
  ];
}

function conversionArguments({
  stereoWebmPath = undefined,
  microphoneWebmPath = undefined,
  systemWebmPath = undefined,
  timing = undefined,
  temporaryPath,
}) {
  const prefix = ["-nostdin", "-hide_banner", "-loglevel", "error", "-n"];
  if (stereoWebmPath) {
    return [
      ...prefix,
      "-i", stereoWebmPath,
      "-map", "0:a:0",
      "-af", "aresample=48000:async=1:first_pts=0,aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo",
      ...commonOutputArguments(temporaryPath),
    ];
  }
  if (!microphoneWebmPath) throw new Error("Převod vyžaduje stereo WebM nebo mikrofonní stopu");
  const durationMs = numericTiming(timing, "durationMs");
  if (durationMs <= 0) throw new Error("Neplatné časování: durationMs");
  const microphoneDelayMs = numericTiming(timing, "microphoneDelayMs", 0);
  const systemDelayMs = numericTiming(timing, "systemDelayMs", 0);
  const duration = seconds(durationMs);
  const microphoneFilter = [
    "[0:a:0]aresample=48000:async=1:first_pts=0",
    `adelay=${Math.round(microphoneDelayMs)}:all=1`,
    "apad",
    `atrim=duration=${duration}`,
    "asetpts=N/SR/TB",
    "aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=mono[mic]",
  ].join(",");
  if (!systemWebmPath) {
    return [
      ...prefix,
      "-i", microphoneWebmPath,
      "-filter_complex", `${microphoneFilter};[mic]pan=stereo|c0=c0|c1=0*c0[out]`,
      "-map", "[out]",
      ...commonOutputArguments(temporaryPath),
    ];
  }
  const systemFilter = [
    "[1:a:0]aresample=48000:async=1:first_pts=0",
    `adelay=${Math.round(systemDelayMs)}:all=1`,
    "apad",
    `atrim=duration=${duration}`,
    "asetpts=N/SR/TB",
    "aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=mono[sys]",
  ].join(",");
  return [
    ...prefix,
    "-i", microphoneWebmPath,
    "-i", systemWebmPath,
    "-filter_complex", `${microphoneFilter};${systemFilter};[mic][sys]join=inputs=2:channel_layout=stereo[out]`,
    "-map", "[out]",
    ...commonOutputArguments(temporaryPath),
  ];
}

function redactedDiagnostic(stderr, privatePaths) {
  let diagnostic = stderr.slice(-STDERR_LIMIT);
  for (const privatePath of privatePaths.filter(Boolean)) {
    diagnostic = diagnostic.replaceAll(privatePath, "<soubor>");
    diagnostic = diagnostic.replaceAll(path.basename(privatePath), "<soubor>");
  }
  return diagnostic.trim();
}

function runEncoder(executable, arguments_, { signal, privatePaths, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let forceKillTimer;
    const child = spawn(executable, arguments_, {
      env: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
      shell: false,
      stdio: ["ignore", "ignore", "pipe"],
    });
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      clearTimeout(forceKillTimer);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(undefined);
    };
    const terminate = (reason) => {
      if (reason === "timeout") timedOut = true;
      if (!child.kill("SIGTERM")) return;
      forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
      forceKillTimer.unref?.();
    };
    const abort = () => terminate("abort");
    const timeoutTimer = setTimeout(() => terminate("timeout"), timeoutMs);
    timeoutTimer.unref?.();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-STDERR_LIMIT);
    });
    child.once("error", (cause) => {
      const error = Object.assign(new Error("Media encoder se nepodařilo spustit", { cause }), {
        code: "MEDIA_ENCODER_START_FAILED",
      });
      finish(error);
    });
    child.once("exit", (code, exitSignal) => {
      if (signal?.aborted) {
        const error = Object.assign(new Error("Převod MP3 byl zrušen"), {
          code: "MEDIA_ENCODER_ABORTED",
        });
        error.name = "AbortError";
        finish(error);
      } else if (timedOut) {
        const error = Object.assign(new Error("Media encoder překročil časový limit"), {
          code: "MEDIA_ENCODER_TIMEOUT",
          diagnostic: redactedDiagnostic(stderr, privatePaths),
        });
        finish(error);
      } else if (code !== 0) {
        const error = Object.assign(
          new Error(`Media encoder skončil s kódem ${code ?? `signál ${exitSignal}`}`),
          {
            code: "MEDIA_ENCODER_FAILED",
            diagnostic: redactedDiagnostic(stderr, privatePaths),
          },
        );
        finish(error);
      } else {
        finish();
      }
    });
  });
}

async function syncPath(filePath) {
  const handle = await open(filePath, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function validateInput(filePath, label) {
  let info;
  try {
    info = await stat(filePath);
  } catch {
    throw new Error(`${label} nelze načíst`);
  }
  if (!info.isFile() || info.size <= 0) throw new Error(`${label} není neprázdný soubor`);
}

async function validateEncoder(executable) {
  let info;
  try {
    info = await lstat(executable);
  } catch {
    throw new Error("Media encoder v aplikaci chybí");
  }
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Media encoder není běžný soubor");
  await access(executable, constants.X_OK);
}

async function convertToStereoMp3(options) {
  const {
    stereoWebmPath,
    microphoneWebmPath,
    systemWebmPath,
    timing,
    outputPath,
    signal,
  } = options ?? {};
  const timeoutMs = options?.timeoutMs ?? 2 * 60 * 60 * 1000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 6 * 60 * 60 * 1000) {
    throw new Error("Neplatný limit doby převodu");
  }
  if (typeof outputPath !== "string" || path.extname(outputPath).toLowerCase() !== ".mp3") {
    throw new Error("Výstup převodu musí být cesta s příponou .mp3");
  }
  const executable = options.encoderPath ?? resolveMediaEncoderPath(options);
  await validateEncoder(executable);
  if (stereoWebmPath) await validateInput(stereoWebmPath, "Stereo vstup");
  else {
    await validateInput(microphoneWebmPath, "Mikrofonní vstup");
    if (systemWebmPath) await validateInput(systemWebmPath, "Systémový vstup");
  }
  try {
    await lstat(outputPath);
    throw new Error("Výstupní MP3 už existuje");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  try {
    await mkdir(path.dirname(outputPath), { recursive: true });
  } catch {
    throw new Error("Adresář pro MP3 nelze připravit");
  }
  let temporaryDirectory;
  try {
    temporaryDirectory = await mkdtemp(path.join(path.dirname(outputPath), ".media-encoder-"));
  } catch {
    throw new Error("Soukromý dočasný adresář pro MP3 nelze vytvořit");
  }
  await chmod(temporaryDirectory, 0o700);
  const temporaryPath = path.join(temporaryDirectory, `${randomUUID()}.mp3`);
  const privatePaths = [stereoWebmPath, microphoneWebmPath, systemWebmPath, outputPath, temporaryPath, temporaryDirectory];
  let conversionResult;
  const cleanupWarnings = [];
  try {
    const arguments_ = conversionArguments({
      stereoWebmPath,
      microphoneWebmPath,
      systemWebmPath,
      timing,
      temporaryPath,
    });
    await runEncoder(executable, arguments_, { signal, privatePaths, timeoutMs });
    const result = await lstat(temporaryPath);
    if (!result.isFile() || result.isSymbolicLink() || result.size <= 0) {
      throw new Error("Media encoder nevytvořil neprázdný běžný MP3 soubor");
    }
    await chmod(temporaryPath, 0o600);
    await syncPath(temporaryPath);
    await link(temporaryPath, outputPath);
    try {
      await syncPath(path.dirname(outputPath));
    } catch {
      cleanupWarnings.push("output_directory_sync_failed");
    }
    conversionResult = {
      outputPath,
      size: result.size,
      mime: "audio/mpeg",
      channels: 2,
      channelMap: { left: "microphone", right: systemWebmPath ? "system" : stereoWebmPath ? "preserved" : "silence" },
      source: stereoWebmPath ? "live-stereo" : "separate-tracks",
      encoderVersion: ENCODER_VERSION,
    };
  } catch (error) {
    const message = redactedDiagnostic(error?.message || "Převod MP3 se nezdařil", privatePaths);
    const safeError = Object.assign(new Error(message || "Převod MP3 se nezdařil"), {
      code: error?.code,
      diagnostic: undefined,
    });
    if (typeof error?.diagnostic === "string") {
      safeError.diagnostic = redactedDiagnostic(error.diagnostic, privatePaths);
    }
    try {
      await rm(temporaryDirectory, { recursive: true, force: true });
    } catch {
      throw new Error("Soukromé dočasné soubory po převodu nelze uklidit");
    }
    throw safeError;
  }
  try {
    await rm(temporaryDirectory, { recursive: true, force: true });
  } catch {
    cleanupWarnings.push("temporary_cleanup_failed");
  }
  if (cleanupWarnings.length > 0) conversionResult.cleanupWarning = cleanupWarnings.join(",");
  return conversionResult;
}

module.exports = {
  ENCODER_VERSION,
  conversionArguments,
  convertToStereoMp3,
  resolveMediaEncoderPath,
};
