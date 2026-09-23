const { createHash, randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MEETING_AUDIO_VERSION = 1;
const MAX_SIDECAR_BYTES = 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

class MeetingAudioError extends Error {
  constructor(code, message, failureClass = "paused") {
    super(message);
    this.name = "MeetingAudioError";
    this.code = code;
    this.failureClass = failureClass;
  }
}

function canonicalTimestamp(value, field) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new TypeError(`${field} musí být platný ISO čas`);
  }
  if (new Date(Date.parse(value)).toISOString() !== value) {
    throw new TypeError(`${field} musí být kanonický ISO čas`);
  }
  return value;
}

function directChild(root, candidate, field) {
  if (typeof candidate !== "string" || !path.isAbsolute(candidate)) {
    throw new TypeError(`${field} musí být absolutní cesta`);
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  if (path.dirname(resolved) !== resolvedRoot) {
    throw new TypeError(`${field} musí ležet přímo v adresáři nahrávek`);
  }
  return resolved;
}

function descriptorPaths(manifestPath, recordingsDirectory) {
  const safeManifestPath = directChild(recordingsDirectory, manifestPath, "manifestPath");
  if (!safeManifestPath.endsWith(".manifest.json")) {
    throw new TypeError("manifestPath musí končit .manifest.json");
  }
  const base = safeManifestPath.slice(0, -".manifest.json".length);
  return {
    filePath: `${base}-stereo.mp3`,
    sidecarPath: `${safeManifestPath}.meeting-audio-v1.json`,
  };
}

function pendingDescriptor({
  captureSources,
  clientRecordingId,
  endedAt,
  filePath,
  masterPath = null,
  masterSha256 = null,
  masterSizeBytes = null,
  sidecarPath,
  source,
  startedAt,
  timing = null,
}) {
  if (!UUID_PATTERN.test(clientRecordingId)) throw new TypeError("clientRecordingId musí být UUID");
  if (!["microphone", "microphone+system"].includes(captureSources)) {
    throw new TypeError("captureSources musí popisovat mikrofon nebo mikrofon a systém");
  }
  if (!["live-stereo", "separate-tracks"].includes(source)) {
    throw new TypeError("source musí být live-stereo nebo separate-tracks");
  }
  const startMs = Date.parse(canonicalTimestamp(startedAt, "startedAt"));
  const endMs = Date.parse(canonicalTimestamp(endedAt, "endedAt"));
  const normalizedTiming = timing ?? {
    durationMs: endMs - startMs,
    microphoneDelayMs: 0,
    systemDelayMs: 0,
  };
  for (const field of ["durationMs", "microphoneDelayMs", "systemDelayMs"]) {
    if (!Number.isSafeInteger(normalizedTiming[field]) || normalizedTiming[field] < 0) {
      throw new TypeError(`timing.${field} musí být nezáporné celé číslo`);
    }
  }
  if (normalizedTiming.durationMs <= 0) throw new TypeError("timing.durationMs musí být kladné");
  return {
    version: MEETING_AUDIO_VERSION,
    state: "pending",
    source,
    captureSources,
    channels: 2,
    channelMap: {
      left: "microphone",
      right: captureSources === "microphone+system" ? "system" : "silence",
    },
    clientRecordingId,
    startedAt: new Date(startMs).toISOString(),
    endedAt: new Date(endMs).toISOString(),
    timing: {
      durationMs: normalizedTiming.durationMs,
      microphoneDelayMs: normalizedTiming.microphoneDelayMs,
      systemDelayMs: normalizedTiming.systemDelayMs,
    },
    mime: "audio/mpeg",
    filePath,
    sidecarPath,
    masterPath,
    masterSizeBytes,
    masterSha256,
    sizeBytes: null,
    sha256: null,
    encoderVersion: null,
  };
}

function validateDescriptor(value, recordingsDirectory) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("delivery musí být objekt");
  }
  if (value.version !== MEETING_AUDIO_VERSION || !["pending", "ready", "failed"].includes(value.state)) {
    throw new TypeError("delivery má neplatnou verzi nebo stav");
  }
  const expectedRight = value.captureSources === "microphone+system" ? "system" : "silence";
  if (
    value.channels !== 2
    || value.mime !== "audio/mpeg"
    || value.channelMap?.left !== "microphone"
    || value.channelMap?.right !== expectedRight
  ) {
    throw new TypeError("delivery neodpovídá pevnému stereo mapování");
  }
  if (value.source === "live-stereo" && (
    !Number.isSafeInteger(value.masterSizeBytes)
    || value.masterSizeBytes <= 0
    || !SHA256_PATTERN.test(value.masterSha256)
  )) {
    throw new TypeError("živý stereo master nemá pevnou identitu");
  }
  const descriptor = pendingDescriptor({
    captureSources: value.captureSources,
    clientRecordingId: value.clientRecordingId,
    endedAt: value.endedAt,
    filePath: directChild(recordingsDirectory, value.filePath, "delivery.filePath"),
    masterPath: value.masterPath === null
      ? null
      : directChild(recordingsDirectory, value.masterPath, "delivery.masterPath"),
    sidecarPath: directChild(recordingsDirectory, value.sidecarPath, "delivery.sidecarPath"),
    source: value.source,
    startedAt: value.startedAt,
    timing: value.timing,
    masterSizeBytes: value.masterSizeBytes ?? null,
    masterSha256: value.masterSha256 ?? null,
  });
  if (!descriptor.filePath.endsWith(".mp3") || !descriptor.sidecarPath.endsWith(".meeting-audio-v1.json")) {
    throw new TypeError("delivery má neplatnou příponu souboru");
  }
  if (value.state === "ready") {
    if (!Number.isSafeInteger(value.sizeBytes) || value.sizeBytes <= 0 || !SHA256_PATTERN.test(value.sha256)) {
      throw new TypeError("ready delivery nemá platnou velikost nebo SHA-256");
    }
    if (typeof value.encoderVersion !== "string" || value.encoderVersion.length === 0) {
      throw new TypeError("ready delivery nemá verzi encoderu");
    }
  }
  return {
    ...descriptor,
    state: value.state,
    sizeBytes: value.state === "ready" ? value.sizeBytes : null,
    sha256: value.state === "ready" ? value.sha256 : null,
    encoderVersion: value.state === "ready" ? value.encoderVersion : null,
  };
}

function sidecarValue(descriptor) {
  return {
    ...descriptor,
    filePath: path.basename(descriptor.filePath),
    sidecarPath: path.basename(descriptor.sidecarPath),
    masterPath: descriptor.masterPath === null ? null : path.basename(descriptor.masterPath),
  };
}

async function writeJsonAtomically(filePath, value) {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await fs.promises.open(temporaryPath, "wx", 0o600);
    await handle.writeFile(JSON.stringify(value), "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.promises.rename(temporaryPath, filePath);
    const directory = await fs.promises.open(path.dirname(filePath), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } catch (error) {
    await handle?.close().catch(() => {});
    await fs.promises.unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

async function readStableRegularFile(filePath, maxBytes = MAX_SIDECAR_BYTES) {
  const noFollow = fs.constants.O_NOFOLLOW ?? 0;
  const nonBlock = fs.constants.O_NONBLOCK ?? 0;
  const handle = await fs.promises.open(filePath, fs.constants.O_RDONLY | noFollow | nonBlock);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size < 1 || before.size > maxBytes) {
      throw new TypeError("sidecar není bezpečný běžný soubor");
    }
    const buffer = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) throw new Error("sidecar se během čtení zkrátil");
      offset += bytesRead;
    }
    const after = await handle.stat();
    const current = await fs.promises.lstat(filePath);
    if (!current.isFile() || current.isSymbolicLink()
      || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs
      || after.dev !== current.dev || after.ino !== current.ino || after.size !== current.size
      || after.mtimeMs !== current.mtimeMs || after.ctimeMs !== current.ctimeMs) {
      throw new Error("sidecar se během čtení změnil");
    }
    return buffer.toString("utf8");
  } finally {
    await handle.close().catch(() => {});
  }
}

async function readSidecar(sidecarPath, recordingsDirectory) {
  const parsed = JSON.parse(await readStableRegularFile(sidecarPath));
  if (
    typeof parsed?.filePath !== "string"
    || path.basename(parsed.filePath) !== parsed.filePath
    || typeof parsed?.sidecarPath !== "string"
    || path.basename(parsed.sidecarPath) !== parsed.sidecarPath
    || parsed.sidecarPath !== path.basename(sidecarPath)
    || (parsed.masterPath !== null && (
      typeof parsed.masterPath !== "string" || path.basename(parsed.masterPath) !== parsed.masterPath
    ))
  ) throw new TypeError("delivery sidecar obsahuje neplatné jméno souboru");
  return validateDescriptor({
    ...parsed,
    filePath: path.join(recordingsDirectory, parsed.filePath),
    sidecarPath: path.join(recordingsDirectory, parsed.sidecarPath),
    masterPath: parsed.masterPath === null ? null : path.join(recordingsDirectory, parsed.masterPath),
  }, recordingsDirectory);
}

function sameDescriptorIdentity(left, right) {
  return [
    "version", "source", "captureSources", "channels", "clientRecordingId", "startedAt",
    "endedAt", "mime", "filePath", "sidecarPath", "masterPath", "masterSizeBytes",
    "masterSha256",
  ].every((field) => left[field] === right[field])
    && JSON.stringify(left.channelMap) === JSON.stringify(right.channelMap)
    && JSON.stringify(left.timing) === JSON.stringify(right.timing);
}

async function fileIdentity(filePath, { allowEmpty = false } = {}) {
  const noFollow = fs.constants.O_NOFOLLOW ?? 0;
  const nonBlock = fs.constants.O_NONBLOCK ?? 0;
  const handle = await fs.promises.open(filePath, fs.constants.O_RDONLY | noFollow | nonBlock);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size < 0 || (!allowEmpty && before.size === 0)) {
      throw new MeetingAudioError("delivery_asset_invalid", "Zvukový soubor není bezpečný běžný soubor", "permanent");
    }
    const hash = createHash("sha256");
    const stream = handle.createReadStream({ autoClose: false, start: 0 });
    for await (const chunk of stream) hash.update(chunk);
    const after = await handle.stat();
    const current = await fs.promises.lstat(filePath);
    if (!current.isFile() || current.isSymbolicLink()
      || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs
      || after.dev !== current.dev || after.ino !== current.ino || after.size !== current.size
      || after.mtimeMs !== current.mtimeMs || after.ctimeMs !== current.ctimeMs) {
      throw new MeetingAudioError("delivery_asset_changed", "Zvukový soubor se během ověření změnil", "permanent");
    }
    return { sizeBytes: after.size, sha256: hash.digest("hex") };
  } finally {
    await handle.close().catch(() => {});
  }
}

async function discardUnboundOutput(filePath) {
  try {
    const identity = await fileIdentity(filePath);
    if (identity.sizeBytes <= 0) throw new Error("prázdný soubor");
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw new MeetingAudioError(
      "delivery_unbound_output_unsafe",
      "Rozpracovaný MP3 nelze bezpečně nahradit",
      "permanent",
    );
  }
}

function hasLegacyUploadEvidence(item) {
  const server = item?.server && typeof item.server === "object" ? item.server : {};
  return item?.legacyDeliveryBarrier === true
    || (Number.isSafeInteger(item?.attempts) && item.attempts > 0)
    || item?.state === "odesila"
    || item?.state === "odeslano"
    || item?.sentAt !== null && item?.sentAt !== undefined
    || item?.nextAttemptAt !== null && item?.nextAttemptAt !== undefined
    || item?.lastFailureReason !== null && item?.lastFailureReason !== undefined
    || typeof server.companyTabidooId === "string"
    || typeof server.sessionId === "string"
    || typeof server.recordingId === "string"
    || typeof server.legacyRecordingId === "string"
    || Object.values(server.tracks ?? {}).some((progress) => (
      typeof progress?.recordingId === "string" || Number(progress?.uploadedBytes) > 0
    ));
}

function hasDeliveryUploadEvidence(item) {
  const server = item?.server && typeof item.server === "object" ? item.server : {};
  return item?.state === "odeslano"
    || item?.sentAt !== null && item?.sentAt !== undefined
    || typeof server.companyTabidooId === "string"
    || typeof server.sessionId === "string"
    || typeof server.delivery?.recordingId === "string"
    || Number(server.delivery?.uploadedBytes) > 0;
}

async function manifestForLegacy(item, recordingsDirectory, { allowEmptyRaw = false } = {}) {
  if (item.recoveredIncomplete === true) {
    throw new MeetingAudioError(
      "legacy_incomplete",
      "Nedokončenou obnovenou nahrávku nelze bezpečně převést na stereo MP3",
    );
  }
  const primaryPath = directChild(
    recordingsDirectory,
    item.sourceManifestPath ?? item.manifestPath,
    "sourceManifestPath",
  );
  const manifest = JSON.parse(await readStableRegularFile(primaryPath));
  if (manifest.state !== "complete" || manifest.clientRecordingId !== item.clientRecordingId) {
    throw new MeetingAudioError(
      "legacy_incomplete",
      "Nedokončenou nahrávku nelze bezpečně převést na stereo MP3",
    );
  }
  const sources = Object.keys(manifest.tracks ?? {}).sort();
  if (sources.length < 1 || sources.length > 2 || !sources.includes("microphone")
    || sources.some((source) => !["microphone", "system"].includes(source))) {
    throw new MeetingAudioError("legacy_manifest_invalid", "Manifest nemá bezpečné původní stopy", "permanent");
  }
  for (const source of sources) {
    canonicalTimestamp(manifest.tracks[source]?.startedAt, `tracks.${source}.startedAt`);
    canonicalTimestamp(manifest.tracks[source]?.endedAt, `tracks.${source}.endedAt`);
    const trackPath = directChild(recordingsDirectory, item.tracks?.[source], `tracks.${source}`);
    if (path.basename(trackPath) !== manifest.tracks[source].fileName) {
      throw new MeetingAudioError("legacy_manifest_invalid", "Původní stopa nesouhlasí s manifestem", "permanent");
    }
    const allowEmpty = allowEmptyRaw || item.delivery?.source === "live-stereo";
    const identity = await fileIdentity(trackPath, { allowEmpty });
    const expectedSha256 = manifest.tracks[source].sha256;
    if (identity.sizeBytes !== manifest.tracks[source].sizeBytes
      || (identity.sizeBytes === 0
        ? expectedSha256 !== null && identity.sha256 !== expectedSha256
        : identity.sha256 !== expectedSha256)) {
      throw new MeetingAudioError("legacy_manifest_invalid", "Původní stopa změnila velikost nebo otisk", "permanent");
    }
  }
  return { manifest, primaryPath, sources };
}

async function createLegacyDescriptor(item, recordingsDirectory) {
  if (item.delivery ? hasDeliveryUploadEvidence(item) : hasLegacyUploadEvidence(item)) {
    throw new MeetingAudioError(
      "legacy_upload_may_have_started",
      "Starší nahrávka mohla být na serveru už založena; automatický převod by vytvořil další záznam",
    );
  }
  const { manifest, primaryPath, sources } = await manifestForLegacy(item, recordingsDirectory);
  const paths = descriptorPaths(primaryPath, recordingsDirectory);
  const starts = sources.map((source) => Date.parse(manifest.tracks[source].startedAt));
  const ends = sources.map((source) => Date.parse(manifest.tracks[source].endedAt));
  const meetingStart = Math.min(...starts);
  const meetingEnd = Math.max(...ends);
  return pendingDescriptor({
    captureSources: sources.includes("system") ? "microphone+system" : "microphone",
    clientRecordingId: manifest.clientRecordingId,
    startedAt: new Date(meetingStart).toISOString(),
    endedAt: new Date(meetingEnd).toISOString(),
    filePath: paths.filePath,
    sidecarPath: paths.sidecarPath,
    source: "separate-tracks",
    timing: {
      durationMs: meetingEnd - meetingStart,
      microphoneDelayMs: Date.parse(manifest.tracks.microphone.startedAt) - meetingStart,
      systemDelayMs: sources.includes("system")
        ? Date.parse(manifest.tracks.system.startedAt) - meetingStart
        : 0,
    },
  });
}

async function createLivePendingDelivery({
  captureSources,
  clientRecordingId,
  endedAt,
  manifestPath,
  masterPath,
  recordingsDirectory,
  startedAt,
}) {
  const paths = descriptorPaths(manifestPath, recordingsDirectory);
  const safeMasterPath = directChild(recordingsDirectory, masterPath, "masterPath");
  const masterIdentity = await fileIdentity(safeMasterPath);
  const descriptor = pendingDescriptor({
    captureSources,
    clientRecordingId,
    endedAt,
    filePath: paths.filePath,
    masterPath: safeMasterPath,
    masterSizeBytes: masterIdentity.sizeBytes,
    masterSha256: masterIdentity.sha256,
    sidecarPath: paths.sidecarPath,
    source: "live-stereo",
    startedAt,
  });
  await writeJsonAtomically(descriptor.sidecarPath, sidecarValue(descriptor));
  return descriptor;
}

/**
 * @param {any} item
 * @param {{convertToStereoMp3?: Function, onDescriptorPrepared?: Function, encoderOptions?: {
 *   isPackaged?: boolean, resourcesPath?: string, projectRoot?: string,
 *   arch?: string, platform?: string
 * }, recordingsDirectory: string}} options
 */
async function ensureMeetingAudioReady(item, {
  convertToStereoMp3,
  encoderOptions = {},
  onDescriptorPrepared,
  recordingsDirectory,
}) {
  if (typeof recordingsDirectory !== "string") throw new TypeError("recordingsDirectory je povinný");
  const primaryPath = directChild(
    recordingsDirectory,
    item.sourceManifestPath ?? item.manifestPath,
    "sourceManifestPath",
  );
  const expectedPaths = descriptorPaths(primaryPath, recordingsDirectory);
  let descriptor;
  if (item?.delivery) {
    descriptor = validateDescriptor(item.delivery, recordingsDirectory);
  } else {
    if (hasLegacyUploadEvidence(item)) {
      throw new MeetingAudioError(
        "legacy_upload_may_have_started",
        "Starší nahrávka mohla být na serveru už založena; automatický převod by vytvořil další záznam",
      );
    }
    try {
      descriptor = await readSidecar(expectedPaths.sidecarPath, recordingsDirectory);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      descriptor = await createLegacyDescriptor(item, recordingsDirectory);
    }
  }
  if (descriptor.filePath !== expectedPaths.filePath || descriptor.sidecarPath !== expectedPaths.sidecarPath) {
    throw new MeetingAudioError("delivery_identity_mismatch", "Delivery cesty nepatří manifestu této schůzky", "permanent");
  }
  if (descriptor.clientRecordingId !== item.clientRecordingId) {
    throw new MeetingAudioError("delivery_identity_mismatch", "Delivery patří jiné schůzce", "permanent");
  }
  const { manifest: primaryManifest, sources } = await manifestForLegacy(item, recordingsDirectory, {
    allowEmptyRaw: descriptor.source === "live-stereo",
  });
  const starts = sources.map((source) => Date.parse(primaryManifest.tracks[source].startedAt));
  const ends = sources.map((source) => Date.parse(primaryManifest.tracks[source].endedAt));
  const expectedStartedAt = new Date(Math.min(...starts)).toISOString();
  const expectedEndedAt = new Date(Math.max(...ends)).toISOString();
  const expectedCaptureSources = sources.includes("system") ? "microphone+system" : "microphone";
  if (
    descriptor.startedAt !== expectedStartedAt
    || descriptor.endedAt !== expectedEndedAt
    || descriptor.captureSources !== expectedCaptureSources
  ) {
    throw new MeetingAudioError(
      "delivery_identity_mismatch",
      "Delivery časování nebo zdroje nesouhlasí s primárním manifestem",
      "permanent",
    );
  }
  if (descriptor.source === "live-stereo") {
    const expectedMasterPath = primaryPath.slice(0, -".manifest.json".length) + "-stereo-master.webm";
    if (descriptor.masterPath !== expectedMasterPath) {
      throw new MeetingAudioError("delivery_identity_mismatch", "Stereo master nepatří manifestu této schůzky", "permanent");
    }
  }

  try {
    const sidecar = await readSidecar(descriptor.sidecarPath, recordingsDirectory);
    if (!sameDescriptorIdentity(descriptor, sidecar)) {
      throw new MeetingAudioError(
        "delivery_identity_mismatch",
        "Delivery sidecar neodpovídá neměnné identitě této nahrávky",
        "permanent",
      );
    }
    if (
      descriptor.state === "ready"
      && (sidecar.state !== "ready" || sidecar.sizeBytes !== descriptor.sizeBytes
        || sidecar.sha256 !== descriptor.sha256
        || sidecar.encoderVersion !== descriptor.encoderVersion)
    ) {
      throw new MeetingAudioError(
        "delivery_identity_mismatch",
        "Ready delivery sidecar změnil neměnnou identitu MP3",
        "permanent",
      );
    }
    if (descriptor.state === "failed" && sidecar.state !== "failed") {
      throw new MeetingAudioError(
        "delivery_identity_mismatch",
        "Selhané delivery změnilo stav bez výslovného opakování",
        "permanent",
      );
    }
    descriptor = sidecar;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await writeJsonAtomically(descriptor.sidecarPath, sidecarValue(descriptor));
  }

  if (descriptor.state === "ready") {
    const identity = await fileIdentity(descriptor.filePath);
    if (identity.sizeBytes !== descriptor.sizeBytes || identity.sha256 !== descriptor.sha256) {
      throw new MeetingAudioError(
        "delivery_identity_mismatch",
        "Uložený MP3 neodpovídá neměnné identitě připravené před uploadem",
        "permanent",
      );
    }
    return descriptor;
  }
  if (item.delivery ? hasDeliveryUploadEvidence(item) : hasLegacyUploadEvidence(item)) {
    throw new MeetingAudioError(
      "delivery_asset_missing_after_init",
      "MP3 po možném zahájení uploadu chybí; nesmí se znovu vytvořit s jinými bajty",
      "permanent",
    );
  }

  if (descriptor.masterPath !== null) {
    const masterIdentity = await fileIdentity(descriptor.masterPath);
    if (masterIdentity.sizeBytes !== descriptor.masterSizeBytes
      || masterIdentity.sha256 !== descriptor.masterSha256) {
      throw new MeetingAudioError("delivery_source_changed", "Stereo master se před převodem změnil", "permanent");
    }
  }
  if (onDescriptorPrepared !== undefined) {
    if (typeof onDescriptorPrepared !== "function") {
      throw new TypeError("onDescriptorPrepared musí být funkce");
    }
    await onDescriptorPrepared(descriptor);
  }
  // Encoder publikuje výstup atomickým hard-linkem ještě před sidecarem. Pád v tomto
  // úzkém okně nechá MP3 bez identity; před jakýmkoli HTTP jej nesmíme převzít, ale
  // můžeme jej bezpečně zahodit a z neměnných originálů vytvořit znovu.
  await discardUnboundOutput(descriptor.filePath);

  let converter = convertToStereoMp3;
  if (typeof converter !== "function") {
    const encoderModulePath = path.join(__dirname, "media-encoder.cjs");
    ({ convertToStereoMp3: converter } = require(encoderModulePath));
  }
  const converted = await converter({
    isPackaged: encoderOptions.isPackaged === true,
    ...(typeof encoderOptions.resourcesPath === "string"
      ? { resourcesPath: encoderOptions.resourcesPath } : {}),
    ...(typeof encoderOptions.projectRoot === "string"
      ? { projectRoot: encoderOptions.projectRoot } : {}),
    ...(typeof encoderOptions.arch === "string" ? { arch: encoderOptions.arch } : {}),
    ...(typeof encoderOptions.platform === "string" ? { platform: encoderOptions.platform } : {}),
    stereoWebmPath: descriptor.masterPath ?? undefined,
    microphoneWebmPath: item.tracks?.microphone,
    systemWebmPath: item.tracks?.system,
    timing: descriptor.timing,
    outputPath: descriptor.filePath,
  });
  const identity = await fileIdentity(descriptor.filePath);
  if (converted?.outputPath !== descriptor.filePath
    || converted?.mime !== "audio/mpeg"
    || converted?.channels !== 2
    || converted?.size !== identity.sizeBytes
    || typeof converted?.encoderVersion !== "string"
    || converted.encoderVersion.length === 0) {
    throw new MeetingAudioError("encoder_result_invalid", "Encoder nepotvrdil neměnný stereo MP3", "permanent");
  }
  const ready = {
    ...descriptor,
    state: "ready",
    sizeBytes: identity.sizeBytes,
    sha256: identity.sha256,
    encoderVersion: converted.encoderVersion,
  };
  await writeJsonAtomically(ready.sidecarPath, sidecarValue(ready));
  return ready;
}

async function verifyMeetingAudioForDeletion(item, recordingsDirectory) {
  if (!item?.delivery) return [];
  const descriptor = validateDescriptor(item.delivery, recordingsDirectory);
  const primaryPath = directChild(
    recordingsDirectory,
    item.sourceManifestPath ?? item.manifestPath,
    "sourceManifestPath",
  );
  const expected = descriptorPaths(primaryPath, recordingsDirectory);
  const expectedMaster = `${primaryPath.slice(0, -".manifest.json".length)}-stereo-master.webm`;
  if (
    descriptor.clientRecordingId !== item.clientRecordingId
    || descriptor.filePath !== expected.filePath
    || descriptor.sidecarPath !== expected.sidecarPath
    || (descriptor.source === "live-stereo" && descriptor.masterPath !== expectedMaster)
    || (descriptor.source === "separate-tracks" && descriptor.masterPath !== null)
  ) throw new MeetingAudioError("delivery_identity_mismatch", "Delivery nepatří mazané nahrávce", "permanent");
  await manifestForLegacy(item, recordingsDirectory);
  const sidecar = await readSidecar(descriptor.sidecarPath, recordingsDirectory);
  if (!sameDescriptorIdentity(descriptor, sidecar) || sidecar.state !== descriptor.state
    || sidecar.sizeBytes !== descriptor.sizeBytes || sidecar.sha256 !== descriptor.sha256
    || sidecar.encoderVersion !== descriptor.encoderVersion) {
    throw new MeetingAudioError("delivery_identity_mismatch", "Delivery sidecar nesouhlasí s frontou", "permanent");
  }
  if (descriptor.masterPath !== null) {
    const master = await fileIdentity(descriptor.masterPath);
    if (master.sizeBytes !== descriptor.masterSizeBytes || master.sha256 !== descriptor.masterSha256) {
      throw new MeetingAudioError("delivery_source_changed", "Stereo master se změnil", "permanent");
    }
  }
  if (descriptor.state === "ready") {
    const delivery = await fileIdentity(descriptor.filePath);
    if (delivery.sizeBytes !== descriptor.sizeBytes || delivery.sha256 !== descriptor.sha256) {
      throw new MeetingAudioError("delivery_identity_mismatch", "Stereo MP3 se změnil", "permanent");
    }
  }
  return [
    ...(descriptor.masterPath === null ? [] : [descriptor.masterPath]),
    ...(descriptor.state === "ready" ? [descriptor.filePath] : []),
    descriptor.sidecarPath,
  ];
}

module.exports = {
  MEETING_AUDIO_VERSION,
  MeetingAudioError,
  createLivePendingDelivery,
  descriptorPaths,
  ensureMeetingAudioReady,
  hasLegacyUploadEvidence,
  verifyMeetingAudioForDeletion,
  validateDescriptor,
};
