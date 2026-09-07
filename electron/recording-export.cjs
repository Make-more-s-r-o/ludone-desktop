const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const OPUS_HEAD = Buffer.from("OpusHead", "ascii");
const WEBM_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const HEADER_READ_BYTES = 64 * 1024;
const MAX_STEREO_BOUNDARY_LAG_MS = 1_000;
const MAX_TRACK_TIMING_DELTA_MS = 1_000;
const MAX_EXPORT_FILE_NAME_BYTES = 255;
// Osm bajtů nechává místo např. pro „ (99999)“ při duplikování ve Finderu.
// Formát času a GUID se do rezervy neodhaduje: měří se celá skutečná pevná část.
const EXPORT_FILE_NAME_RESERVE_BYTES = 8;
const RECORDING_NAME_SEGMENTER = new Intl.Segmenter("cs", { granularity: "grapheme" });
const CONTROL_OR_FORMAT_CHARACTER = /[\p{Cc}\p{Cf}]/u;

function requiredTimestamp(value, field) {
  const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new TypeError(`${field} musí být platná ISO časová značka`);
  }
  return value;
}

function requiredManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new TypeError("Chybí manifest dokončené nahrávky");
  }
  if (manifest.state !== "complete") {
    throw new Error("Exportovat lze jen dokončenou nahrávku");
  }
  if (typeof manifest.clientRecordingId !== "string" || manifest.clientRecordingId.length === 0) {
    throw new TypeError("Manifest nemá clientRecordingId");
  }
  if (!manifest.tracks?.microphone) {
    throw new TypeError("Manifest nemá povinnou mikrofonní stopu");
  }
  const trackKinds = Object.keys(manifest.tracks).sort();
  if (
    trackKinds.length > 2
    || trackKinds.some((kind) => kind !== "microphone" && kind !== "system")
  ) {
    throw new TypeError("Manifest obsahuje neznámou původní stopu");
  }
  return manifest;
}

function inspectOpusWebm(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buffer.indexOf(WEBM_MAGIC) !== 0) {
    throw new Error("Exportní soubor nemá hlavičku WebM");
  }
  const opusHeadOffset = buffer.indexOf(OPUS_HEAD);
  if (opusHeadOffset < 0 || opusHeadOffset + OPUS_HEAD.length + 2 > buffer.length) {
    throw new Error("Exportní soubor nemá hlavičku Opus");
  }
  const version = buffer[opusHeadOffset + OPUS_HEAD.length];
  const channels = buffer[opusHeadOffset + OPUS_HEAD.length + 1];
  if (version !== 1) throw new Error(`Exportní Opus má nepodporovanou verzi ${version}`);
  if (channels !== 2) {
    throw new Error(`Exportní Opus musí mít dva kanály, nalezeno ${channels}`);
  }
  return { container: "WebM", codec: "Opus", channels };
}

function recordingTimeline(manifestValue, stereoTiming) {
  const manifest = requiredManifest(manifestValue);
  const microphoneStartedAt = requiredTimestamp(
    manifest.tracks.microphone.startedAt,
    "tracks.microphone.startedAt",
  );
  const microphoneEndedAt = requiredTimestamp(
    manifest.tracks.microphone.endedAt,
    "tracks.microphone.endedAt",
  );
  const systemStartedAt = manifest.tracks.system
    ? requiredTimestamp(manifest.tracks.system.startedAt, "tracks.system.startedAt")
    : null;
  const systemEndedAt = manifest.tracks.system
    ? requiredTimestamp(manifest.tracks.system.endedAt, "tracks.system.endedAt")
    : null;
  const stereoStartedAt = requiredTimestamp(stereoTiming?.startedAt, "stereo.startedAt");
  const stereoEndedAt = requiredTimestamp(stereoTiming?.endedAt, "stereo.endedAt");

  const microphoneStartMs = Date.parse(microphoneStartedAt);
  const microphoneEndMs = Date.parse(microphoneEndedAt);
  const systemStartMs = systemStartedAt === null ? null : Date.parse(systemStartedAt);
  const systemEndMs = systemEndedAt === null ? null : Date.parse(systemEndedAt);
  const stereoStartMs = Date.parse(stereoStartedAt);
  const stereoEndMs = Date.parse(stereoEndedAt);
  const hasSystemTrack = systemStartMs !== null && systemEndMs !== null;
  const firstTrackStartMs = hasSystemTrack
    ? Math.min(microphoneStartMs, systemStartMs)
    : microphoneStartMs;
  const lastTrackEndMs = hasSystemTrack
    ? Math.max(microphoneEndMs, systemEndMs)
    : microphoneEndMs;
  const trackStartDeltaMs = hasSystemTrack
    ? Math.abs(microphoneStartMs - systemStartMs)
    : null;
  const trackDurationDeltaMs = hasSystemTrack
    ? Math.abs(
      (microphoneEndMs - microphoneStartMs) - (systemEndMs - systemStartMs),
    )
    : null;

  // Stereo recorder se spouští první a zastavuje poslední. Musí proto obalit
  // obě originální stopy; při nejistotě se nic neposouvá ani nedoplňuje tichem.
  if (stereoStartMs > firstTrackStartMs || firstTrackStartMs - stereoStartMs > MAX_STEREO_BOUNDARY_LAG_MS) {
    throw new Error("Stereo derivát nezačal spolehlivě před oběma stopami");
  }
  if (stereoEndMs < lastTrackEndMs || stereoEndMs - lastTrackEndMs > MAX_STEREO_BOUNDARY_LAG_MS) {
    throw new Error("Stereo derivát neskončil spolehlivě po obou stopách");
  }
  if (stereoEndMs <= stereoStartMs) throw new Error("Stereo derivát má neplatnou délku");
  if (hasSystemTrack && trackStartDeltaMs > MAX_TRACK_TIMING_DELTA_MS) {
    throw new Error(`Rozdíl startů stop ${trackStartDeltaMs} ms překročil bezpečný limit`);
  }
  if (hasSystemTrack && trackDurationDeltaMs > MAX_TRACK_TIMING_DELTA_MS) {
    throw new Error(`Rozdíl délek stop ${trackDurationDeltaMs} ms překročil bezpečný limit`);
  }

  return {
    startedAt: !hasSystemTrack || microphoneStartMs <= systemStartMs
      ? microphoneStartedAt
      : systemStartedAt,
    endedAt: !hasSystemTrack || microphoneEndMs >= systemEndMs
      ? microphoneEndedAt
      : systemEndedAt,
    stereoStartedAt,
    stereoEndedAt,
    trackStartDeltaMs,
    trackDurationDeltaMs,
  };
}

// Shodné se serverem: String.length po trim(), tedy UTF-16 jednotky.
// Mění se současně na serveru i v RecordingCard.jsx; název se nikdy tiše nezkracuje.
const MAX_UPLOAD_NAME_UTF16_UNITS = 500;

class RecordingNameValidationError extends Error {
  constructor() {
    super("Název je příliš dlouhý. Zkraťte ho.");
    this.name = "RecordingNameValidationError";
  }
}

function validateUploadRecordingName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  if (name.length > MAX_UPLOAD_NAME_UTF16_UNITS) throw new RecordingNameValidationError();
  return name;
}

function declaredCaptureSourcesFromManifest(manifest) {
  const tracks = manifest?.tracks;
  if (!tracks || typeof tracks !== "object" || Array.isArray(tracks)) return null;
  const trackKinds = Object.keys(tracks);
  if (
    trackKinds.length === 0
    || trackKinds.some((kind) => kind !== "microphone" && kind !== "system")
  ) return null;

  // Autoritou jsou stopy zapsané hlavním procesem. Dva kanály exportu ani
  // velikost systémové stopy neříkají, zda se zachytával jen mikrofon.
  //
  // Obě ohlašované hodnoty tvrdí mikrofon, takže bez jeho stopy nemáme co ohlásit:
  // nahrávání bez mikrofonu dnes nezačne, ale `declared` server bere jako naše slovo
  // a tvrzení, které neumíme podložit, se posílat nesmí ani jako nedosažitelná větev.
  if (!trackKinds.includes("microphone")) return null;
  return trackKinds.includes("system") ? "microphone+system" : "microphone";
}

function buildRecordingUploadUrl(origin, metadata = {}, manifest = null) {
  const url = new URL("/nahravky/nahrat", origin);
  for (const key of ["clientRecordingId", "startedAt", "endedAt"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.length > 0) url.searchParams.set(key, value);
  }

  // Do jména souboru jde sanitizovaná podoba („Porada-provozu"), do formuláře ale
  // patří to, co člověk opravdu napsal. Prázdný parametr neposíláme vůbec — server
  // chybějící a prázdný nemusí řešit stejně.
  const nazev = validateUploadRecordingName(metadata.nazev);
  if (nazev.length > 0) url.searchParams.set("nazev", nazev);
  const declaredCaptureSources = declaredCaptureSourcesFromManifest(manifest);
  if (declaredCaptureSources !== null) {
    url.searchParams.set("declaredCaptureSources", declaredCaptureSources);
  }
  return url.href;
}

function sanitizeRecordingName(value) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new TypeError("Název nahrávky musí být text");
  }

  const normalized = Array.from(value.normalize("NFKC"), (character) => {
    // ZWJ drží složené emoji pohromadě. Ostatní neviditelné řídicí a
    // formátovací znaky nahrazujeme, protože mohou klamat směrem zobrazení.
    if (character === "\u200D") return character;
    return CONTROL_OR_FORMAT_CHARACTER.test(character) ? "-" : character;
  }).join("")
    // Tečky měníme také: tím se `..` nemůže stát segmentem cesty ani po ořezu.
    .replace(/[<>:"/\\|?*.]+/gu, "-")
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return normalized;
}

function truncateRecordingNameBytes(name, byteBudget) {
  let result = "";
  let usedBytes = 0;
  // Celé grafémy zachovají i kombinovanou diakritiku a složené emoji se ZWJ.
  for (const { segment } of RECORDING_NAME_SEGMENTER.segment(name)) {
    const segmentBytes = Buffer.byteLength(segment, "utf8");
    if (usedBytes + segmentBytes > byteBudget) break;
    result += segment;
    usedBytes += segmentBytes;
  }
  return result.replace(/-+$/u, "");
}

function exportFileName(clientRecordingId, startedAt, recordingName) {
  const safeStartedAt = startedAt.replace(/[:.]/g, "-");
  const prefix = `LuDone-${safeStartedAt}-`;
  const suffix = `${clientRecordingId}.webm`;
  const byteBudget = MAX_EXPORT_FILE_NAME_BYTES
    - Buffer.byteLength(`${prefix}-${suffix}`, "utf8")
    - EXPORT_FILE_NAME_RESERVE_BYTES;
  // NFKC může text rozšířit, proto se bajty omezují až po sanitizaci.
  const safeRecordingName = truncateRecordingNameBytes(
    sanitizeRecordingName(recordingName), byteBudget,
  );
  const nameSegment = safeRecordingName ? `${safeRecordingName}-` : "";
  return `${prefix}${nameSegment}${suffix}`;
}

async function readHeader(filePath) {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(HEADER_READ_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function fileSha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function copyExportOnce(sourcePath, targetPath) {
  try {
    await fs.promises.copyFile(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const [sourceStat, targetStat] = await Promise.all([
      fs.promises.stat(sourcePath),
      fs.promises.stat(targetPath),
    ]);
    if (
      sourceStat.size !== targetStat.size
      || await fileSha256(sourcePath) !== await fileSha256(targetPath)
    ) {
      throw new Error(`Ve Stažených už existuje jiný soubor ${path.basename(targetPath)}`);
    }
  }
  await fs.promises.chmod(targetPath, 0o600);
}

/**
 * @param {object} options
 * @param {string} options.downloadsDirectory
 * @param {object} options.manifest
 * @param {(url: string) => Promise<unknown>} options.openExternal
 * @param {boolean} options.openUploadPage Výslovná volba otevření nahrávací stránky.
 * @param {string} options.origin
 * @param {string} [options.recordingName]
 * @param {string} options.stagePath
 * @param {{ startedAt: string, endedAt: string }} options.stereoTiming
 */
async function exportRecordingCopy({
  downloadsDirectory,
  manifest: manifestValue,
  openExternal,
  openUploadPage,
  origin,
  recordingName = "",
  stagePath,
  stereoTiming,
}) {
  if (typeof openUploadPage !== "boolean") {
    throw new TypeError("openUploadPage musí být výslovně boolean");
  }
  const manifest = requiredManifest(manifestValue);
  const timeline = recordingTimeline(manifest, stereoTiming);
  // Název odmítneme před kopírováním; staging zůstane připravený k dalšímu pokusu.
  const uploadUrl = buildRecordingUploadUrl(origin, {
    clientRecordingId: manifest.clientRecordingId,
    startedAt: timeline.startedAt,
    endedAt: timeline.endedAt,
    nazev: recordingName,
  }, manifest);
  const format = inspectOpusWebm(await readHeader(stagePath));
  const fileName = exportFileName(
    manifest.clientRecordingId,
    timeline.startedAt,
    recordingName,
  );
  const downloadsRoot = path.resolve(downloadsDirectory);
  const filePath = path.join(downloadsRoot, fileName);
  if (path.dirname(filePath) !== downloadsRoot) {
    throw new Error("Název exportu opustil složku Stažené");
  }
  await copyExportOnce(stagePath, filePath);
  try {
    if (openUploadPage) await openExternal(uploadUrl);
  } catch (error) {
    const exportedError = Object.assign(
      error instanceof Error ? error : new Error(String(error)),
      {
        recordingExported: true,
        fileName,
        filePath,
        uploadUrl,
      },
    );
    throw exportedError;
  }
  return {
    clientRecordingId: manifest.clientRecordingId,
    fileName,
    filePath,
    format,
    startedAt: timeline.startedAt,
    endedAt: timeline.endedAt,
    stereoStartedAt: timeline.stereoStartedAt,
    stereoEndedAt: timeline.stereoEndedAt,
    trackStartDeltaMs: timeline.trackStartDeltaMs,
    trackDurationDeltaMs: timeline.trackDurationDeltaMs,
    uploadUrl,
  };
}

module.exports = {
  RecordingNameValidationError,
  buildRecordingUploadUrl,
  exportRecordingCopy,
  inspectOpusWebm,
  recordingTimeline,
  sanitizeRecordingName,
  validateUploadRecordingName,
};
