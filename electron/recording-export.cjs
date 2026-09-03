const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const OPUS_HEAD = Buffer.from("OpusHead", "ascii");
const WEBM_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const HEADER_READ_BYTES = 64 * 1024;
const MAX_STEREO_BOUNDARY_LAG_MS = 1_000;
const MAX_TRACK_TIMING_DELTA_MS = 1_000;
const MAX_RECORDING_NAME_CHARACTERS = 40;
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

// 🔴 Server názvy nad limit zahazuje CELÉ, ne po částech — poslat delší tedy znamená
// přijít o název úplně, bez chyby a bez hlášky. Ořezáváme proto my.
//
// Limit je 200 **UTF-16 jednotek** (serverové `.length`), ne 200 znaků. To není totéž:
// emoji je surrogate pair, tedy dvě jednotky na jeden znak, takže 200 emoji = 400 jednotek
// a server by je zahodil všechny. Zjištěno 3. 9. 2026 měřením proti serverovému `handoff.ts`;
// obě strany si přitom myslely, že jejich limity sedí.
//
// Ořezávat rovnou podle `.length` by ale rozpůlilo emoji uprostřed páru. Bereme proto
// znaky po jednom a sčítáme jejich SKUTEČNOU délku v jednotkách — nikdy nepřekročíme
// limit a nikdy nerozřízneme znak.
const MAX_UPLOAD_NAME_UTF16_UNITS = 200;

function orezNaJednotky(text, limit) {
  let vysledek = "";
  for (const znak of text) {
    if (vysledek.length + znak.length > limit) break;
    vysledek += znak;
  }
  return vysledek;
}

function buildRecordingUploadUrl(origin, metadata = {}) {
  const url = new URL("/nahravky/nahrat", origin);
  for (const key of ["clientRecordingId", "startedAt", "endedAt"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.length > 0) url.searchParams.set(key, value);
  }

  // Do jména souboru jde sanitizovaná podoba („Porada-provozu"), do formuláře ale
  // patří to, co člověk opravdu napsal. Prázdný parametr neposíláme vůbec — server
  // chybějící a prázdný nemusí řešit stejně.
  const nazev = typeof metadata.nazev === "string" ? metadata.nazev.trim() : "";
  if (nazev.length > 0) {
    const orezany = orezNaJednotky(nazev, MAX_UPLOAD_NAME_UTF16_UNITS);
    if (orezany.length > 0) url.searchParams.set("nazev", orezany);
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

  // Čtyřicet Unicode code pointů zabere nejvýš 160 B. I s prefixem, časem,
  // plným GUID a příponou tak komponenta zůstane pod běžným limitem 255 B.
  return Array.from(normalized)
    .slice(0, MAX_RECORDING_NAME_CHARACTERS)
    .join("")
    .replace(/-+$/u, "");
}

function exportFileName(clientRecordingId, startedAt, recordingName) {
  const safeStartedAt = startedAt.replace(/[:.]/g, "-");
  const safeRecordingName = sanitizeRecordingName(recordingName);
  const nameSegment = safeRecordingName ? `${safeRecordingName}-` : "";
  return `LuDone-${safeStartedAt}-${nameSegment}${clientRecordingId}.webm`;
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

async function exportRecordingCopy({
  downloadsDirectory,
  manifest: manifestValue,
  openExternal,
  origin,
  recordingName = "",
  stagePath,
  stereoTiming,
}) {
  const manifest = requiredManifest(manifestValue);
  const timeline = recordingTimeline(manifest, stereoTiming);
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
  const uploadUrl = buildRecordingUploadUrl(origin, {
    clientRecordingId: manifest.clientRecordingId,
    startedAt: timeline.startedAt,
    endedAt: timeline.endedAt,
    nazev: recordingName,
  });
  try {
    await openExternal(uploadUrl);
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
  buildRecordingUploadUrl,
  exportRecordingCopy,
  inspectOpusWebm,
  recordingTimeline,
  sanitizeRecordingName,
};
