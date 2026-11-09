const { createHash, randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Transform, Writable } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const OPUS_HEAD = Buffer.from("OpusHead", "ascii");
const WEBM_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const HEADER_READ_BYTES = 64 * 1024;
const MAX_STEREO_BOUNDARY_LAG_MS = 1_000;
const MAX_TRACK_TIMING_DELTA_MS = 1_000;
const MAX_EXPORT_FILE_NAME_BYTES = 255;
// Osm bajtů nechává místo např. pro „ (99999)“ při duplikování ve Finderu.
// Formát času a GUID se do rezervy neodhaduje: měří se celá skutečná pevná část.
const EXPORT_FILE_NAME_RESERVE_BYTES = 8;
const EXPORT_ATTEMPT_TIMEOUT_MS = 120_000;
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

function inspectMp3(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  let offset = buffer.subarray(0, 3).toString("ascii") === "ID3" && buffer.length >= 10
    ? 10 + ((buffer[6] & 0x7f) << 21) + ((buffer[7] & 0x7f) << 14)
      + ((buffer[8] & 0x7f) << 7) + (buffer[9] & 0x7f)
    : 0;
  let found = false;
  for (; offset + 1 < buffer.length; offset += 1) {
    if (buffer[offset] === 0xff && (buffer[offset + 1] & 0xe6) === 0xe2) {
      found = true;
      break;
    }
  }
  if (!found) throw new Error("Exportní soubor nemá platnou MP3 hlavičku");
  return { container: "MP3", codec: "MP3", channels: 2 };
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

function exportFileName(clientRecordingId, startedAt, recordingName, extension = ".webm") {
  const safeStartedAt = startedAt.replace(/[:.]/g, "-");
  const prefix = `LuDone-${safeStartedAt}-`;
  const suffix = `${clientRecordingId}${extension}`;
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

/** @returns {Error & { code?: string, recordingExported?: boolean | null, publicationPending?: boolean, fileName?: string }} */
function abortError(signal, state) {
  const timedOut = signal.reason?.name === "TimeoutError";
  const error = /** @type {Error & { code?: string, recordingExported?: boolean | null, publicationPending?: boolean, fileName?: string }} */ (new Error(timedOut
    ? "Export kopie překročil časový limit"
    : "Export kopie byl zrušen"));
  error.name = timedOut ? "TimeoutError" : "AbortError";
  error.code = timedOut ? "EXPORT_TIMEOUT" : "ABORT_ERR";
  error.recordingExported = state.published ? true : state.publicationSubmitted ? null : false;
  error.publicationPending = state.publicationSubmitted && !state.published;
  if (state.publicationSubmitted || state.published) error.fileName = state.fileName;
  return error;
}

function throwIfAborted(signal, state) {
  if (signal.aborted) throw abortError(signal, state);
}

function awaitAbortable(value, signal, state, onAbort = undefined) {
  const promise = Promise.resolve(value);
  if (signal.aborted) {
    onAbort?.();
    promise.catch(() => {});
    return Promise.reject(abortError(signal, state));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, result) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onSignalAbort);
      callback(result);
    };
    const onSignalAbort = () => {
      onAbort?.();
      finish(reject, abortError(signal, state));
    };
    signal.addEventListener("abort", onSignalAbort, { once: true });
    promise.then(
      (result) => finish(resolve, result),
      (error) => finish(reject, error),
    );
  });
}

function fileIdentity(stats) {
  return {
    dev: stats.dev,
    ino: stats.ino,
    size: stats.size,
    mode: stats.mode,
    mtimeMs: stats.mtimeMs,
    ctimeMs: stats.ctimeMs,
  };
}

function sameFileIdentity(first, second) {
  return first.dev === second.dev && first.ino === second.ino;
}

function sameFileSnapshot(first, second) {
  return sameFileIdentity(first, second)
    && first.size === second.size
    && first.mode === second.mode
    && first.mtimeMs === second.mtimeMs
    && first.ctimeMs === second.ctimeMs;
}

function regularFileIdentity(stats, label) {
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`${label} není běžný soubor`);
  }
  return fileIdentity(stats);
}

async function readHeaderFromHandle(handle, signal, state) {
  const buffer = Buffer.alloc(HEADER_READ_BYTES);
  const result = await awaitAbortable(handle.read(buffer, 0, buffer.length, 0), signal, state);
  throwIfAborted(signal, state);
  return buffer.subarray(0, result.bytesRead);
}

function makeHashTransform({ hash, count, signal, state, afterChunk }) {
  return new Transform({
    transform(chunk, _encoding, callback) {
      try {
        throwIfAborted(signal, state);
        hash.update(chunk);
        count.bytes += chunk.length;
      } catch (error) {
        callback(error);
        return;
      }
      Promise.resolve(afterChunk?.({ bytesCopied: count.bytes, chunkBytes: chunk.length }))
        .then(() => {
          try {
            throwIfAborted(signal, state);
            callback(null, chunk);
          } catch (error) {
            callback(error);
          }
        }, callback);
    },
  });
}

async function streamHash(handle, { signal, state, afterChunk = undefined }) {
  const hash = createHash("sha256");
  const count = { bytes: 0 };
  const source = handle.createReadStream({ autoClose: false, start: 0 });
  const transform = makeHashTransform({ hash, count, signal, state, afterChunk });
  const sink = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const work = pipeline(source, transform, sink);
  work.catch(() => {});
  await awaitAbortable(work, signal, state, () => {
    source.destroy();
    transform.destroy();
    sink.destroy();
    void handle.close().catch(() => {});
  });
  throwIfAborted(signal, state);
  return { bytes: count.bytes, sha256: hash.digest("hex") };
}

async function verifyExistingExport({
  filePath,
  expectedSizeBytes,
  expectedSha256,
  sourceIdentity,
  signal,
  state,
}) {
  const beforePath = await awaitAbortable(fs.promises.lstat(filePath), signal, state);
  throwIfAborted(signal, state);
  const before = regularFileIdentity(beforePath, "Existující export");
  const openPromise = fs.promises.open(filePath,
    fs.constants.O_RDONLY
      | (fs.constants.O_NOFOLLOW ?? 0)
      | (fs.constants.O_NONBLOCK ?? 0));
  let handle;
  try {
    handle = await awaitAbortable(openPromise, signal, state, () => {
      void openPromise.then((lateHandle) => lateHandle.close(), () => {});
    });
    throwIfAborted(signal, state);
    const opened = regularFileIdentity(
      await awaitAbortable(handle.stat(), signal, state, () => { void handle.close().catch(() => {}); }),
      "Existující export",
    );
    throwIfAborted(signal, state);
    const currentPath = regularFileIdentity(
      await awaitAbortable(fs.promises.lstat(filePath), signal, state),
      "Existující export",
    );
    throwIfAborted(signal, state);
    if (!sameFileSnapshot(before, opened) || !sameFileSnapshot(opened, currentPath)) {
      throw new Error("Existující export se během ověření změnil");
    }
    if (sameFileIdentity(opened, sourceIdentity)) {
      throw new Error("Cílový soubor je aliasem zdroje nahrávky");
    }
    if (opened.size !== expectedSizeBytes) {
      throw new Error(`Ve Stažených už existuje jiný soubor ${path.basename(filePath)}`);
    }
    const identity = await streamHash(handle, { signal, state });
    throwIfAborted(signal, state);
    const afterHandle = regularFileIdentity(
      await awaitAbortable(handle.stat(), signal, state),
      "Existující export",
    );
    throwIfAborted(signal, state);
    const afterPath = regularFileIdentity(
      await awaitAbortable(fs.promises.lstat(filePath), signal, state),
      "Existující export",
    );
    throwIfAborted(signal, state);
    if (!sameFileSnapshot(opened, afterHandle) || !sameFileSnapshot(afterHandle, afterPath)) {
      throw new Error("Existující export se během ověření změnil");
    }
    if (identity.bytes !== expectedSizeBytes || identity.sha256 !== expectedSha256) {
      throw new Error(`Ve Stažených už existuje jiný soubor ${path.basename(filePath)}`);
    }
    return false;
  } finally {
    if (handle) void handle.close().catch(() => {});
  }
}

function validateTestHooks(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.entries(value).some(([key, hook]) => key === "timeoutMs"
      ? !Number.isSafeInteger(hook) || hook <= 0 || hook > EXPORT_ATTEMPT_TIMEOUT_MS
      : hook !== undefined && typeof hook !== "function")) {
    throw new TypeError("Testovací bariéry exportu jsou neplatné");
  }
  return value;
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
 * @param {{ sizeBytes: number, sha256: string }} options.expectedDelivery
 * @param {AbortSignal} options.signal
 * @param {() => boolean | Promise<boolean>} options.canPublish
 * @param {(result: { fileName: string, filePath: string }) => void} [options.onPublicationSubmitted]
 * @param {(result: { created: boolean, errorCode?: string }) => void} [options.onPublicationSettled]
 * @param {Record<string, any>} [options.testHooks]
 */
async function exportRecordingCopy({
  canPublish,
  downloadsDirectory,
  expectedDelivery,
  manifest: manifestValue,
  openExternal,
  openUploadPage,
  origin,
  recordingName = "",
  onPublicationSubmitted = undefined,
  onPublicationSettled = undefined,
  stagePath,
  signal: externalSignal,
  stereoTiming,
  testHooks: hooksValue = undefined,
}) {
  if (typeof openUploadPage !== "boolean") {
    throw new TypeError("openUploadPage musí být výslovně boolean");
  }
  if (!externalSignal || typeof externalSignal.aborted !== "boolean"
    || typeof externalSignal.addEventListener !== "function") {
    throw new TypeError("Export kopie vyžaduje AbortSignal");
  }
  if (typeof canPublish !== "function") {
    throw new TypeError("Export kopie vyžaduje podmínku publikace");
  }
  if (!expectedDelivery || typeof expectedDelivery !== "object"
    || !Number.isSafeInteger(expectedDelivery.sizeBytes) || expectedDelivery.sizeBytes <= 0
    || !/^[a-f0-9]{64}$/u.test(expectedDelivery.sha256)) {
    throw new TypeError("Export kopie vyžaduje ověřenou velikost a SHA-256 delivery");
  }
  if (onPublicationSubmitted !== undefined && typeof onPublicationSubmitted !== "function") {
    throw new TypeError("Oznámení publikace musí být funkce");
  }
  if (onPublicationSettled !== undefined && typeof onPublicationSettled !== "function") {
    throw new TypeError("Výsledek publikace musí být funkce");
  }
  const hooks = validateTestHooks(hooksValue);
  const manifest = requiredManifest(manifestValue);
  const timeline = recordingTimeline(manifest, stereoTiming);
  // Název odmítneme před kopírováním; staging zůstane připravený k dalšímu pokusu.
  const uploadUrl = buildRecordingUploadUrl(origin, {
    clientRecordingId: manifest.clientRecordingId,
    startedAt: timeline.startedAt,
    endedAt: timeline.endedAt,
    nazev: recordingName,
  }, manifest);
  const extension = path.extname(stagePath).toLowerCase();
  const fileName = exportFileName(
    manifest.clientRecordingId,
    timeline.startedAt,
    recordingName,
    extension === ".mp3" ? ".mp3" : ".webm",
  );
  const downloadsRoot = path.resolve(downloadsDirectory);
  const filePath = path.join(downloadsRoot, fileName);
  if (path.dirname(filePath) !== downloadsRoot) {
    throw new Error("Název exportu opustil složku Stažené");
  }
  const controller = new AbortController();
  const state = { fileName, publicationSubmitted: false, published: false };
  const relayAbort = () => controller.abort(externalSignal.reason);
  if (externalSignal.aborted) relayAbort();
  else externalSignal.addEventListener("abort", relayAbort, { once: true });
  const signal = controller.signal;
  const timeoutReason = Object.assign(new Error("Export kopie překročil časový limit"), {
    name: "TimeoutError",
  });
  const timeoutId = setTimeout(
    () => controller.abort(timeoutReason),
    hooks.timeoutMs ?? EXPORT_ATTEMPT_TIMEOUT_MS,
  );
  let sourceHandle;
  let temporaryHandle;
  let sourceStream;
  let transformStream;
  let outputStream;
  let temporaryPath;
  let temporaryIdentity;
  let temporaryCleanupPromise;

  const destroyStreams = () => {
    sourceStream?.destroy();
    transformStream?.destroy();
    outputStream?.destroy();
  };
  const cleanupTemporary = () => {
    if (!temporaryPath || !temporaryIdentity) return Promise.resolve(false);
    if (temporaryCleanupPromise) return temporaryCleanupPromise;
    temporaryCleanupPromise = (async () => {
      await hooks.beforeCleanup?.({ filePath: temporaryPath });
      let current;
      try {
        current = await fs.promises.lstat(temporaryPath);
      } catch (error) {
        if (error?.code === "ENOENT") return false;
        throw error;
      }
      if (!current.isFile() || current.isSymbolicLink()) return false;
      if (!sameFileIdentity(temporaryIdentity, fileIdentity(current))) return false;
      await fs.promises.unlink(temporaryPath);
      return true;
    })();
    temporaryCleanupPromise.catch(() => {});
    return temporaryCleanupPromise;
  };
  const closeHandlesWithoutWaiting = () => {
    if (sourceHandle) void sourceHandle.close().catch(() => {});
    if (temporaryHandle) void temporaryHandle.close().catch(() => {});
  };
  const cancelWork = () => {
    destroyStreams();
    void cleanupTemporary().catch(() => {});
    closeHandlesWithoutWaiting();
  };

  try {
    throwIfAborted(signal, state);
    await awaitAbortable(Promise.resolve(hooks.beforeSourceOpen?.()), signal, state);
    throwIfAborted(signal, state);

    const sourcePath = path.resolve(stagePath);
    const sourcePathStats = regularFileIdentity(
      await awaitAbortable(fs.promises.lstat(sourcePath), signal, state),
      "Zdroj delivery",
    );
    throwIfAborted(signal, state);
    const sourceOpenPromise = fs.promises.open(sourcePath,
      fs.constants.O_RDONLY
        | (fs.constants.O_NOFOLLOW ?? 0)
        | (fs.constants.O_NONBLOCK ?? 0));
    sourceHandle = await awaitAbortable(sourceOpenPromise, signal, state, () => {
      void sourceOpenPromise.then((lateHandle) => lateHandle.close(), () => {});
    });
    throwIfAborted(signal, state);
    const sourceOpened = regularFileIdentity(
      await awaitAbortable(sourceHandle.stat(), signal, state, () => {
        void sourceHandle.close().catch(() => {});
      }),
      "Zdroj delivery",
    );
    throwIfAborted(signal, state);
    const sourceAfterOpen = regularFileIdentity(
      await awaitAbortable(fs.promises.lstat(sourcePath), signal, state),
      "Zdroj delivery",
    );
    throwIfAborted(signal, state);
    if (!sameFileSnapshot(sourcePathStats, sourceOpened)
      || !sameFileSnapshot(sourceOpened, sourceAfterOpen)) {
      throw new Error("Zdroj delivery se během otevření změnil");
    }
    if (sourceOpened.size !== expectedDelivery.sizeBytes) {
      throw new Error("Velikost zdroje delivery nesouhlasí s ověřenou identitou");
    }
    const sourceIdentity = sourceOpened;
    const header = await readHeaderFromHandle(sourceHandle, signal, state);
    const format = extension === ".mp3" ? inspectMp3(header) : inspectOpusWebm(header);
    throwIfAborted(signal, state);

    const downloadsPathStats = await awaitAbortable(fs.promises.lstat(downloadsRoot), signal, state);
    throwIfAborted(signal, state);
    if (!downloadsPathStats.isDirectory() || downloadsPathStats.isSymbolicLink()) {
      throw new Error("Adresář Stažené není bezpečný adresář");
    }
    const downloadsIdentity = fileIdentity(downloadsPathStats);
    const downloadsOpenPromise = fs.promises.open(downloadsRoot,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const downloadsHandle = await awaitAbortable(downloadsOpenPromise, signal, state, () => {
      void downloadsOpenPromise.then((lateHandle) => lateHandle.close(), () => {});
    });
    try {
      const openedDownloads = await awaitAbortable(downloadsHandle.stat(), signal, state);
      throwIfAborted(signal, state);
      if (!openedDownloads.isDirectory()
        || !sameFileIdentity(downloadsIdentity, fileIdentity(openedDownloads))) {
        throw new Error("Adresář Stažené se během exportu změnil");
      }
    } finally {
      void downloadsHandle.close().catch(() => {});
    }

    temporaryPath = path.join(downloadsRoot, `.ludone-export-${randomBytes(24).toString("hex")}.tmp`);
    const temporaryOpenPromise = fs.promises.open(temporaryPath,
      fs.constants.O_CREAT
        | fs.constants.O_EXCL
        | fs.constants.O_WRONLY
        | (fs.constants.O_NOFOLLOW ?? 0),
      0o600);
    const temporaryReady = temporaryOpenPromise.then(async (handle) => {
      temporaryHandle = handle;
      try {
        const createdStats = await handle.stat();
        temporaryIdentity = regularFileIdentity(createdStats, "Dočasný export");
        if ((createdStats.mode & 0o777) !== 0o600) {
          throw new Error("Dočasný export nemá práva 0600");
        }
        if (signal.aborted) {
          void cleanupTemporary().catch(() => {});
          void handle.close().catch(() => {});
          throw abortError(signal, state);
        }
        return handle;
      } catch (error) {
        if (!temporaryIdentity) void handle.close().catch(() => {});
        throw error;
      }
    });
    temporaryReady.catch(() => {});
    temporaryHandle = await awaitAbortable(temporaryReady, signal, state, () => {
      void temporaryReady.then(() => cleanupTemporary(), () => {});
    });
    throwIfAborted(signal, state);

    const hash = createHash("sha256");
    const count = { bytes: 0 };
    sourceStream = sourceHandle.createReadStream({ autoClose: false, start: 0 });
    transformStream = makeHashTransform({
      hash,
      count,
      signal,
      state,
      afterChunk: hooks.afterChunk,
    });
    outputStream = new Writable({
      write(chunk, _encoding, callback) {
        const bytes = Buffer.from(chunk);
        const writeRange = async (start, end) => {
          let offset = start;
          while (offset < end) {
            throwIfAborted(signal, state);
            const result = await temporaryHandle.write(bytes, offset, end - offset, null);
            if (result.bytesWritten === 0) throw new Error("Zápis dočasného exportu se zastavil");
            offset += result.bytesWritten;
          }
        };
        const write = async () => {
          if (hooks.afterPartialWrite && bytes.length > 1) {
            const split = Math.floor(bytes.length / 2);
            await writeRange(0, split);
            await hooks.afterPartialWrite({ bytesWritten: split, chunkBytes: bytes.length });
            await writeRange(split, bytes.length);
            return;
          }
          await writeRange(0, bytes.length);
        };
        write().then(() => callback(), callback);
      },
    });
    const writing = pipeline(sourceStream, transformStream, outputStream);
    writing.catch(() => {});
    await awaitAbortable(writing, signal, state, cancelWork);
    throwIfAborted(signal, state);
    const copiedSha256 = hash.digest("hex");
    if (count.bytes !== expectedDelivery.sizeBytes || copiedSha256 !== expectedDelivery.sha256) {
      throw new Error("Zdroj delivery neodpovídá ověřené velikosti nebo SHA-256");
    }

    const sourceAfterCopy = regularFileIdentity(
      await awaitAbortable(sourceHandle.stat(), signal, state),
      "Zdroj delivery",
    );
    throwIfAborted(signal, state);
    const sourcePathAfterCopy = regularFileIdentity(
      await awaitAbortable(fs.promises.lstat(sourcePath), signal, state),
      "Zdroj delivery",
    );
    throwIfAborted(signal, state);
    if (!sameFileSnapshot(sourceIdentity, sourceAfterCopy)
      || !sameFileSnapshot(sourceAfterCopy, sourcePathAfterCopy)) {
      throw new Error("Zdroj delivery se během exportu změnil");
    }

    await awaitAbortable(temporaryHandle.sync(), signal, state, cancelWork);
    throwIfAborted(signal, state);
    await awaitAbortable(Promise.resolve(hooks.beforePublish?.({ filePath, temporaryPath })), signal, state);
    throwIfAborted(signal, state);
    const mayPublish = await awaitAbortable(Promise.resolve(canPublish()), signal, state);
    throwIfAborted(signal, state);
    if (mayPublish !== true) throw new Error("Export už nelze bezpečně zveřejnit");
    throwIfAborted(signal, state);

    // Cizí proces mohl během kopírování vyměnit dočasné jméno. Ověř, že
    // otevřený deskriptor i cesta stále ukazují na náš ověřený inode; lstat
    // záměrně neprochází případný symlink. Po kontrole už nesmí být žádný await
    // před předáním atomického linku.
    const temporaryOpened = regularFileIdentity(
      await awaitAbortable(temporaryHandle.stat(), signal, state),
      "Dočasný export",
    );
    throwIfAborted(signal, state);
    const temporaryNamed = regularFileIdentity(
      await awaitAbortable(fs.promises.lstat(temporaryPath), signal, state),
      "Dočasný export",
    );
    throwIfAborted(signal, state);
    if (!sameFileIdentity(temporaryIdentity, temporaryOpened)
      || !sameFileIdentity(temporaryOpened, temporaryNamed)
      || temporaryOpened.size !== expectedDelivery.sizeBytes) {
      throw new Error("Dočasný export se během přípravy změnil");
    }

    const linkPromise = fs.promises.link(temporaryPath, filePath);
    state.publicationSubmitted = true;
    onPublicationSubmitted?.({ fileName, filePath });
    const publication = linkPromise.then(() => {
      state.published = true;
      onPublicationSettled?.({ created: true });
      return true;
    }, (error) => {
      if (error?.code === "EEXIST") state.publicationSubmitted = false;
      onPublicationSettled?.({
        created: false,
        ...(typeof error?.code === "string" ? { errorCode: error.code } : {}),
      });
      throw error;
    });
    publication.catch(() => {});
    let created;
    try {
      created = await awaitAbortable(publication, signal, state, cancelWork);
    } catch (error) {
      if (signal.aborted) throw error;
      if (error?.code !== "EEXIST") throw error;
      created = await verifyExistingExport({
        filePath,
        expectedSizeBytes: expectedDelivery.sizeBytes,
        expectedSha256: expectedDelivery.sha256,
        sourceIdentity,
        signal,
        state,
      });
      throwIfAborted(signal, state);
    }
    throwIfAborted(signal, state);

    if (created) {
      const directoryOpenPromise = fs.promises.open(downloadsRoot,
        fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
      const directoryHandle = await awaitAbortable(directoryOpenPromise, signal, state, () => {
        void directoryOpenPromise.then((lateHandle) => lateHandle.close(), () => {});
      });
      try {
        const currentDirectory = await awaitAbortable(directoryHandle.stat(), signal, state);
        throwIfAborted(signal, state);
        if (!currentDirectory.isDirectory()
          || !sameFileIdentity(downloadsIdentity, fileIdentity(currentDirectory))) {
          throw new Error("Adresář Stažené se změnil při zveřejnění exportu");
        }
        await awaitAbortable(directoryHandle.sync(), signal, state, () => {
          void directoryHandle.close().catch(() => {});
        });
        throwIfAborted(signal, state);
      } finally {
        void directoryHandle.close().catch(() => {});
      }
    }

    await awaitAbortable(cleanupTemporary(), signal, state, cancelWork);
    throwIfAborted(signal, state);
    await awaitAbortable(sourceHandle.close(), signal, state);
    sourceHandle = null;
    throwIfAborted(signal, state);
    await awaitAbortable(temporaryHandle.close(), signal, state);
    temporaryHandle = null;
    throwIfAborted(signal, state);

    if (openUploadPage) {
      await awaitAbortable(Promise.resolve(openExternal(uploadUrl)), signal, state);
    }
    throwIfAborted(signal, state);
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
  } catch (error) {
    destroyStreams();
    try {
      await awaitAbortable(cleanupTemporary(), signal, state);
    } catch { /* zrušení nesmí čekat na úklid dočasného souboru */ }
    closeHandlesWithoutWaiting();
    if (signal.aborted) throw abortError(signal, state);
    if (state.published) {
      error.recordingExported = true;
      error.fileName = fileName;
      error.filePath = filePath;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal.removeEventListener("abort", relayAbort);
    if (temporaryPath && temporaryIdentity && !temporaryCleanupPromise) {
      void cleanupTemporary().catch(() => {});
    }
  }
}

module.exports = {
  RecordingNameValidationError,
  buildRecordingUploadUrl,
  declaredCaptureSourcesFromManifest,
  exportRecordingCopy,
  inspectOpusWebm,
  inspectMp3,
  recordingTimeline,
  sanitizeRecordingName,
  validateUploadRecordingName,
};
