const fs = require("node:fs");
const path = require("node:path");
const { createHash, createHmac, randomUUID } = require("node:crypto");
const {
  createLocalRecordingsSnapshot,
  readStableRegularFile: readStableDashboardFile,
} = require("./recordings-dashboard.cjs");

const QUEUE_SCHEMA_VERSION = 1;
const RECOVERABLE_MANIFEST_STATES = new Set(["complete", "incomplete"]);
const RECOVERY_HASH_BUFFER_BYTES = 1024 * 1024;
const RECOVERY_MANIFEST_MAX_BYTES = 1024 * 1024;
const RECOVERY_TRACK_MAX_BYTES = 512 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const QUEUE_OWNER_FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const QUEUE_ITEM_REVISION_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const QUEUE_OWNER_FINGERPRINT_DOMAIN = Object.freeze([
  "cz.ludone.desktop",
  "queue-owner",
  "v1",
]);

function emptyQueue() {
  return { schemaVersion: QUEUE_SCHEMA_VERSION, items: [] };
}

function validateQueue(queue) {
  if (
    !queue
    || typeof queue !== "object"
    || Array.isArray(queue)
    || queue.schemaVersion !== QUEUE_SCHEMA_VERSION
    || !Array.isArray(queue.items)
  ) {
    throw new TypeError("soubor fronty neodpovídá schématu v1");
  }
  if (
    Object.prototype.hasOwnProperty.call(queue, "uploadCooldowns")
    && !Array.isArray(queue.uploadCooldowns)
  ) {
    throw new TypeError("uploadCooldowns musí být pole");
  }
  const seenCooldownOwners = new Set();
  for (const cooldown of queue.uploadCooldowns ?? []) {
    if (!cooldown || typeof cooldown !== "object" || Array.isArray(cooldown)) {
      throw new TypeError("záznam uploadCooldowns musí být objekt");
    }
    const keys = Object.keys(cooldown).sort();
    if (keys.length !== 2 || keys[0] !== "ownerFingerprint" || keys[1] !== "retryAt") {
      throw new TypeError("záznam uploadCooldowns má neplatný tvar");
    }
    if (
      typeof cooldown.ownerFingerprint !== "string"
      || !QUEUE_OWNER_FINGERPRINT_PATTERN.test(cooldown.ownerFingerprint)
    ) {
      throw new TypeError("uploadCooldowns.ownerFingerprint musí být platný otisk");
    }
    if (!Number.isSafeInteger(cooldown.retryAt) || cooldown.retryAt <= 0) {
      throw new TypeError("uploadCooldowns.retryAt musí být platný čas v milisekundách");
    }
    if (seenCooldownOwners.has(cooldown.ownerFingerprint)) {
      throw new TypeError("uploadCooldowns nesmí obsahovat stejného vlastníka dvakrát");
    }
    seenCooldownOwners.add(cooldown.ownerFingerprint);
  }
  let changed = false;
  const items = queue.items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item) || item.kind === "time") {
      return item;
    }
    const ownerFingerprint = normalizeQueueOwnerFingerprint(item.ownerFingerprint);
    const server = normalizeStoredServer(item);
    const uploadIntent = item.uploadIntent === "approved" ? "approved" : "held";
    if (
      Object.prototype.hasOwnProperty.call(item, "ownerFingerprint")
      && item.ownerFingerprint === ownerFingerprint
      && item.uploadIntent === uploadIntent
      && JSON.stringify(item.server) === JSON.stringify(server)
    ) {
      return item;
    }
    changed = true;
    return { ...item, ownerFingerprint, server, uploadIntent };
  });
  return changed ? { ...queue, items } : queue;
}

function safeNonEmptyString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function safeUploadedBytes(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function queueItemRevision(item) {
  return `sha256:${createHash("sha256").update(JSON.stringify(item), "utf8").digest("hex")}`;
}

function normalizeStoredServer(item) {
  const stored = item.server && typeof item.server === "object" ? item.server : {};
  const server = {
    sessionId: typeof stored.sessionId === "string" && UUID_PATTERN.test(stored.sessionId)
      ? stored.sessionId
      : null,
    tracks: {
      microphone: {
        recordingId: typeof stored.tracks?.microphone?.recordingId === "string"
          && UUID_PATTERN.test(stored.tracks.microphone.recordingId)
          ? stored.tracks.microphone.recordingId
          : null,
        uploadedBytes: safeUploadedBytes(
          stored.tracks?.microphone?.uploadedBytes ?? stored.uploadedBytes?.microphone,
        ),
      },
      system: {
        recordingId: typeof stored.tracks?.system?.recordingId === "string"
          && UUID_PATTERN.test(stored.tracks.system.recordingId)
          ? stored.tracks.system.recordingId
          : null,
        uploadedBytes: safeUploadedBytes(
          stored.tracks?.system?.uploadedBytes ?? stored.uploadedBytes?.system,
        ),
      },
    },
  };
  const itemTracks = Object.keys(item.tracks ?? {});
  const legacyRecordingId = safeNonEmptyString(stored.recordingId ?? stored.legacyRecordingId);
  if (legacyRecordingId !== null) {
    if (itemTracks.length === 1 && itemTracks[0] in server.tracks) {
      server.tracks[itemTracks[0]].recordingId ??= legacyRecordingId;
    } else {
      server.legacyRecordingId = legacyRecordingId;
    }
  }
  return server;
}

function normalizeQueueOwnerFingerprint(value) {
  return typeof value === "string" && QUEUE_OWNER_FINGERPRINT_PATTERN.test(value)
    ? value
    : null;
}

function canonicalQueueOwnerEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().normalize("NFC");
  const separator = email.lastIndexOf("@");
  if (
    separator <= 0
    || separator === email.length - 1
    || /\s/u.test(email)
    || email.indexOf("@") !== separator
  ) {
    return null;
  }
  const localPart = email.slice(0, separator);
  const domain = email.slice(separator + 1).toLocaleLowerCase("en-US");
  return `${localPart}@${domain}`;
}

/**
 * Jednosměrný otisk váže člověka i issuer. Jméno, e-mail ani token se do
 * outgoing.json nikdy neukládají; tokeny navíc expirují nebo rotují.
 */
// 🔴 `secret` je POVINNÝ a bez něj se vrací null. Materiál bez tajemství by šlo
// slovníkově uhodnout ze známých firemních e-mailů — otisk by pak neskrýval nic.
// Null se překládá na „vlastník neznámý", tedy pauzu; nikdy na slabší otisk.
function deriveQueueOwnerFingerprint(session, secret) {
  if (!Buffer.isBuffer(secret) || secret.length < 32) return null;
  if (!session || typeof session !== "object" || Array.isArray(session)) return null;
  const email = canonicalQueueOwnerEmail(session.identity?.email);
  if (email === null) return null;

  let issuer;
  try {
    const candidate = new URL(session.issuer);
    if (
      candidate.protocol !== "https:"
      || candidate.username !== ""
      || candidate.password !== ""
      || candidate.pathname !== "/"
      || candidate.search !== ""
      || candidate.hash !== ""
    ) {
      return null;
    }
    issuer = candidate.origin;
  } catch {
    return null;
  }

  const material = JSON.stringify([
    ...QUEUE_OWNER_FINGERPRINT_DOMAIN,
    issuer,
    "email",
    email,
  ]);
  const digest = createHmac("sha256", secret).update(material, "utf8").digest("hex");
  return `sha256:${digest}`;
}

function addOwnerToNewRecording(result, ownerFingerprint) {
  if (!result.added) return result;
  const item = { ...result.item, ownerFingerprint };
  const itemIndex = result.queue.items.findIndex((candidate) => candidate === result.item);
  if (itemIndex < 0) throw new Error("Nová položka fronty nebyla nalezena");
  const items = [...result.queue.items];
  items[itemIndex] = item;
  return { ...result, item, queue: { ...result.queue, items } };
}

function requiredObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} musí být objekt`);
  }
  return value;
}

function requiredNonEmptyString(value, field) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${field} musí být neprázdný řetězec`);
  }
  return value;
}

function normalizedRecordingTitle(value) {
  const title = typeof value === "string" ? value.trim() : "";
  if (title.length > 500) throw new TypeError("Název nahrávky je příliš dlouhý");
  return title;
}

function microphoneOnlyRecording(recording) {
  const trackKinds = Object.keys(recording?.manifest?.tracks ?? {});
  return trackKinds.length === 1 && trackKinds[0] === "microphone";
}

function enqueueMicrophoneOnlyRecording(queue, recording, now = Date.now()) {
  queue = validateQueue(queue);
  requiredObject(recording, "recording");
  const manifest = normalizeMicrophoneOnlyManifest(recording.manifest);
  const manifestPath = requiredNonEmptyString(recording.manifestPath, "manifestPath");
  const sourceManifestPath = recording.sourceManifestPath === undefined
    ? manifestPath
    : requiredNonEmptyString(recording.sourceManifestPath, "sourceManifestPath");
  if (
    recording.recoveredIncomplete !== undefined
    && typeof recording.recoveredIncomplete !== "boolean"
  ) {
    throw new TypeError("recoveredIncomplete musí být boolean");
  }
  const recoveredIncomplete = recording.recoveredIncomplete === true;
  const trackPaths = requiredObject(recording.trackPaths, "trackPaths");
  if (Object.keys(trackPaths).length !== 1 || !trackPaths.microphone) {
    throw new TypeError("jednostopé trackPaths musí obsahovat právě stopu microphone");
  }
  const normalizedTracks = {
    microphone: requiredNonEmptyString(trackPaths.microphone, "trackPaths.microphone"),
  };
  const existing = queue.items.find(
    (item) => item.clientRecordingId === manifest.clientRecordingId,
  );
  if (existing) {
    const sameRecording = existing.kind === "recording"
      && (existing.sourceManifestPath ?? existing.manifestPath) === sourceManifestPath
      && existing.manifestPath === manifestPath
      && existing.tracks?.microphone === normalizedTracks.microphone
      && Object.keys(existing.tracks ?? {}).length === 1
      && (existing.recoveredIncomplete === true) === recoveredIncomplete;
    if (sameRecording) return { added: false, item: existing, queue };
    throw new Error("Kolize clientRecordingId s jinou položkou fronty");
  }
  const enqueuedAt = new Date(now);
  if (!Number.isFinite(enqueuedAt.getTime())) throw new TypeError("now musí být platný čas");
  const item = {
    attempts: 0,
    clientRecordingId: manifest.clientRecordingId,
    enqueuedAt: enqueuedAt.toISOString(),
    kind: "recording",
    lastFailureReason: null,
    manifestPath,
    nextAttemptAt: null,
    ...(recoveredIncomplete ? { recoveredIncomplete: true } : {}),
    sentAt: null,
    server: {
      sessionId: null,
      tracks: {
        microphone: { recordingId: null, uploadedBytes: 0 },
        system: { recordingId: null, uploadedBytes: 0 },
      },
    },
    state: "ceka",
    uploadIntent: "held",
    ...(sourceManifestPath !== manifestPath ? { sourceManifestPath } : {}),
    tracks: normalizedTracks,
  };
  return {
    added: true,
    item,
    queue: { ...queue, items: [...queue.items, item] },
  };
}

/** Načte frontu; neexistující soubor znamená dosud prázdnou frontu. */
async function loadQueue(filePath, { includeMigration = false } = {}) {
  try {
    const contents = await fs.promises.readFile(filePath, "utf8");
    const parsed = JSON.parse(contents);
    const queue = validateQueue(parsed);
    return includeMigration ? { queue, migrated: JSON.stringify(queue) !== JSON.stringify(parsed) } : queue;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      const queue = emptyQueue();
      return includeMigration ? { queue, migrated: false } : queue;
    }
    throw error;
  }
}

/** Atomický zápis ve stejném adresáři: temp soubor, fsync a rename. */
async function saveQueueAtomically(filePath, queue) {
  queue = validateQueue(queue);
  const directory = path.dirname(filePath);
  await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await fs.promises.open(temporaryPath, "wx", 0o600);
    await handle.writeFile(JSON.stringify(queue), "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.promises.rename(temporaryPath, filePath);

    // fsync adresáře zajišťuje, že rename přežije i náhlý pád procesu nebo stroje.
    const directoryHandle = await fs.promises.open(directory, "r");
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fs.promises.unlink(temporaryPath).catch(() => {});
    throw error;
  }

  return path.resolve(filePath);
}

function safeRecoveryLog(logger, level, message) {
  try {
    logger?.[level]?.(message);
  } catch {
    // Diagnostika nesmí zastavit obnovu dalších nahrávek.
  }
}

function recoveredTrackPath(recordingsDirectory, fileName) {
  if (
    typeof fileName !== "string"
    || fileName.length === 0
    || fileName === "."
    || fileName === ".."
    || path.basename(fileName) !== fileName
  ) {
    throw new TypeError("manifest obsahuje nebezpečný název stopy");
  }
  const directory = path.resolve(recordingsDirectory);
  const filePath = path.resolve(directory, fileName);
  if (path.dirname(filePath) !== directory) {
    throw new TypeError("stopa neleží v adresáři nahrávek");
  }
  return filePath;
}

function canonicalIsoTimestamp(value, field, { nullable = true } = {}) {
  if (value === null && nullable) return null;
  if (typeof value !== "string") throw new TypeError(`${field} nemá platný ISO čas`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new TypeError(`${field} nemá platný ISO čas`);
  }
  return value;
}

function normalizeMicrophoneOnlyManifest(parsed) {
  requiredObject(parsed, "manifest");
  if (parsed.schemaVersion !== 1) {
    throw new TypeError("jednostopý manifest musí mít schemaVersion 1");
  }
  if (!RECOVERABLE_MANIFEST_STATES.has(parsed.state)) {
    throw new TypeError("jednostopý manifest musí být complete nebo incomplete");
  }
  const sourceTrack = requiredObject(parsed.tracks?.microphone, "tracks.microphone");
  if (Object.keys(parsed.tracks ?? {}).length !== 1) {
    throw new TypeError("jednostopý manifest musí obsahovat právě stopu microphone");
  }
  if (!Number.isSafeInteger(sourceTrack.sizeBytes) || sourceTrack.sizeBytes < 0) {
    throw new TypeError("tracks.microphone.sizeBytes musí být nezáporné celé číslo");
  }
  if (sourceTrack.sha256 !== null && !/^[a-f0-9]{64}$/u.test(sourceTrack.sha256)) {
    throw new TypeError("tracks.microphone.sha256 musí být SHA-256 nebo null");
  }
  const manifest = {
    schemaVersion: 1,
    clientRecordingId: requiredNonEmptyString(parsed.clientRecordingId, "clientRecordingId"),
    createdAt: canonicalIsoTimestamp(parsed.createdAt, "createdAt", { nullable: false }),
    closedAt: canonicalIsoTimestamp(parsed.closedAt, "closedAt"),
    state: parsed.state,
    tracks: {
      microphone: {
        endedAt: canonicalIsoTimestamp(sourceTrack.endedAt, "tracks.microphone.endedAt"),
        fileName: requiredNonEmptyString(sourceTrack.fileName, "tracks.microphone.fileName"),
        sha256: sourceTrack.sha256,
        sizeBytes: sourceTrack.sizeBytes,
        startedAt: canonicalIsoTimestamp(
          sourceTrack.startedAt,
          "tracks.microphone.startedAt",
        ),
      },
    },
  };
  if (manifest.state === "complete" && manifest.closedAt === null) {
    throw new TypeError("complete manifest musí mít closedAt");
  }
  return manifest;
}

function recoverableTrackSources(manifest) {
  const sources = Object.keys(requiredObject(manifest.tracks, "tracks")).sort();
  const valid = sources.length >= 1
    && sources.length <= 2
    && sources[0] === "microphone"
    && sources.every((source) => source === "microphone" || source === "system");
  if (!valid) throw new TypeError("manifest nemá podporovaný seznam stop");
  return sources;
}

function sameFileStats(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

async function readStableRegularFile(filePath, maxBytes) {
  const noFollow = fs.constants.O_NOFOLLOW ?? 0;
  const handle = await fs.promises.open(filePath, fs.constants.O_RDONLY | noFollow);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size > maxBytes) {
      throw new TypeError("soubor obnovy není bezpečný běžný soubor");
    }
    const contents = await handle.readFile("utf8");
    const after = await handle.stat();
    if (!sameFileStats(before, after)) throw new Error("soubor se během obnovy změnil");
    const current = await fs.promises.lstat(filePath);
    if (!current.isFile() || !sameFileStats(after, current)) {
      throw new Error("cesta souboru se během obnovy změnila");
    }
    return contents;
  } finally {
    await handle.close().catch(() => {});
  }
}

async function inspectStableTrack(filePath) {
  const noFollow = fs.constants.O_NOFOLLOW ?? 0;
  const handle = await fs.promises.open(filePath, fs.constants.O_RDONLY | noFollow);
  try {
    const before = await handle.stat();
    if (
      !before.isFile()
      || !Number.isSafeInteger(before.size)
      || before.size < 0
    ) {
      throw new TypeError("stopa nemá bezpečnou velikost");
    }
    const oversized = before.size > RECOVERY_TRACK_MAX_BYTES;
    let sha256 = null;
    if (!oversized) {
      const hash = createHash("sha256");
      let position = 0;
      while (position < before.size) {
        const buffer = Buffer.allocUnsafe(Math.min(
          RECOVERY_HASH_BUFFER_BYTES,
          before.size - position,
        ));
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
        if (bytesRead === 0) throw new Error("stopa se během obnovy zkrátila");
        hash.update(buffer.subarray(0, bytesRead));
        position += bytesRead;
      }
      sha256 = hash.digest("hex");
    }
    const after = await handle.stat();
    if (!sameFileStats(before, after)) throw new Error("stopa se během obnovy změnila");
    const current = await fs.promises.lstat(filePath);
    if (!current.isFile() || !sameFileStats(after, current)) {
      throw new Error("cesta stopy se během obnovy změnila");
    }
    return {
      mtimeMs: after.mtimeMs,
      oversized,
      sha256,
      sizeBytes: after.size,
    };
  } finally {
    await handle.close().catch(() => {});
  }
}

function validateManifestIdentityAndTimes(manifest) {
  if (!UUID_PATTERN.test(manifest.clientRecordingId)) {
    throw new TypeError("manifest nemá platné UUID");
  }
  canonicalIsoTimestamp(manifest.createdAt, "createdAt", { nullable: false });
  canonicalIsoTimestamp(manifest.closedAt, "closedAt");
  for (const source of recoverableTrackSources(manifest)) {
    canonicalIsoTimestamp(manifest.tracks[source].startedAt, `${source}.startedAt`);
    canonicalIsoTimestamp(manifest.tracks[source].endedAt, `${source}.endedAt`);
  }
}

function completedAtForRecovery(manifest, inspectedTracks) {
  const knownTimes = [
    manifest.createdAt,
    manifest.closedAt,
    ...Object.values(manifest.tracks).map(({ endedAt }) => endedAt),
  ]
    .filter((value) => value !== null)
    .map((value) => Date.parse(value));
  knownTimes.push(...Object.values(inspectedTracks).map(({ mtimeMs }) => mtimeMs));
  return new Date(Math.max(...knownTimes)).toISOString();
}

function assertDeclaredTrackMatches(manifest, source, inspected) {
  const declared = manifest.tracks[source];
  if (manifest.state === "complete" || declared.sizeBytes > 0) {
    if (declared.sizeBytes !== inspected.sizeBytes) {
      throw new Error("velikost stopy neodpovídá manifestu");
    }
  }
  if (inspected.sha256 !== null && (manifest.state === "complete" || declared.sha256 !== null)) {
    if (declared.sha256 !== inspected.sha256) {
      throw new Error("otisk stopy neodpovídá manifestu");
    }
  }
}

async function fsyncDirectory(directory) {
  const handle = await fs.promises.open(directory, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function prepareRecoveredRecording({
  canonicalJson,
  createManifest,
  entry,
  recordingsDirectory,
  writeManifestAtomically,
}) {
  if (!entry.isFile()) throw new TypeError("manifest není běžný soubor");
  const manifestPath = path.join(recordingsDirectory, entry.name);
  const parsed = JSON.parse(await readStableRegularFile(
    manifestPath,
    RECOVERY_MANIFEST_MAX_BYTES,
  ));
  if (parsed?.schemaVersion !== 1 || !RECOVERABLE_MANIFEST_STATES.has(parsed?.state)) {
    throw new TypeError("manifest nemá obnovitelný stav nebo verzi");
  }
  const parsedSources = recoverableTrackSources(parsed);
  const manifest = parsedSources.length === 1
    ? normalizeMicrophoneOnlyManifest(parsed)
    : createManifest(parsed, parsed.state);
  const sources = recoverableTrackSources(manifest);
  validateManifestIdentityAndTimes(manifest);
  if (
    sources.length === 2
    && manifest.tracks.microphone.fileName === manifest.tracks.system.fileName
  ) {
    throw new TypeError("obě stopy nesmějí být tentýž soubor");
  }
  const trackPaths = Object.fromEntries(sources.map((source) => [
    source,
    recoveredTrackPath(recordingsDirectory, manifest.tracks[source].fileName),
  ]));
  const inspectedTracks = Object.fromEntries(await Promise.all(
    sources.map(async (source) => [
      source,
      await inspectStableTrack(trackPaths[source]),
    ]),
  ));
  for (const source of sources) {
    assertDeclaredTrackMatches(manifest, source, inspectedTracks[source]);
  }

  if (manifest.state === "complete") {
    return { manifest, manifestPath, trackPaths };
  }

  const inspectedValues = Object.values(inspectedTracks);
  if (inspectedValues.every((track) => track.sizeBytes === 0)) {
    throw new TypeError("nedokončený manifest neobsahuje žádná zvuková data");
  }
  if (inspectedValues.some((track) => track.sizeBytes === 0 || track.oversized)) {
    return {
      manifest,
      manifestPath,
      recoveredIncomplete: true,
      trackPaths,
    };
  }

  const closedAt = completedAtForRecovery(manifest, inspectedTracks);
  const completedMetadata = {
    clientRecordingId: manifest.clientRecordingId,
    closedAt,
    createdAt: manifest.createdAt,
    tracks: Object.fromEntries(sources.map((source) => [source, {
      ...manifest.tracks[source],
      endedAt: manifest.tracks[source].endedAt ?? closedAt,
      sha256: inspectedTracks[source].sha256,
      sizeBytes: inspectedTracks[source].sizeBytes,
      startedAt: manifest.tracks[source].startedAt ?? manifest.createdAt,
    }])),
  };
  const uploadManifest = sources.length === 1
    ? normalizeMicrophoneOnlyManifest({
      schemaVersion: 1,
      ...completedMetadata,
      state: "complete",
    })
    : createManifest(completedMetadata, "complete");
  const uploadManifestPath = `${manifestPath}.recovered-upload-v1.json`;
  try {
    const existingRaw = JSON.parse(await readStableRegularFile(
      uploadManifestPath,
      RECOVERY_MANIFEST_MAX_BYTES,
    ));
    if (
      existingRaw?.schemaVersion !== 1
      || existingRaw?.state !== "complete"
      || canonicalJson(existingRaw) !== canonicalJson(uploadManifest)
    ) {
      throw new Error("existující obnovovací sidecar má jiný obsah");
    }
    if (sources.length === 1) normalizeMicrophoneOnlyManifest(existingRaw);
    else createManifest(existingRaw, existingRaw.state);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await writeManifestAtomically(uploadManifestPath, uploadManifest);
  }
  // Sidecar musí být durable dřív než outgoing.json, který na něj začne ukazovat.
  await fsyncDirectory(recordingsDirectory);
  return {
    manifest: uploadManifest,
    manifestPath: uploadManifestPath,
    recoveredIncomplete: true,
    sourceManifestPath: manifestPath,
    trackPaths,
  };
}

/**
 * Najde atomicky dopsané manifesty bez položky ve frontě. Každý soubor se
 * posuzuje samostatně: neplatný zůstane beze změny na disku a nezastaví další.
 * @param {{
 *   logger?: {
 *     error?: (...args: any[]) => void,
 *     log?: (...args: any[]) => void,
 *     warn?: (...args: any[]) => void,
 *   },
 *   manifestModulePromise: Promise<any>,
 *   queueStore: {enqueueRecording: (recording: any) => Promise<any>},
 *   recordingsDirectory: string,
 * }} options
 */
async function recoverOrphanedRecordings({
  logger = console,
  manifestModulePromise,
  queueStore,
  recordingsDirectory,
}) {
  if (typeof recordingsDirectory !== "string" || recordingsDirectory.length === 0) {
    throw new TypeError("recordingsDirectory je povinný");
  }
  if (!queueStore || typeof queueStore.enqueueRecording !== "function") {
    throw new TypeError("queueStore musí umět enqueueRecording");
  }
  if (!manifestModulePromise || typeof manifestModulePromise.then !== "function") {
    throw new TypeError("manifestModulePromise je povinný Promise");
  }

  let entries;
  try {
    const directoryStats = await fs.promises.lstat(recordingsDirectory);
    if (!directoryStats.isDirectory()) throw new TypeError("adresář nahrávek není adresář");
    entries = await fs.promises.readdir(recordingsDirectory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { alreadyQueued: 0, failed: 0, recovered: 0, skipped: 0 };
    }
    safeRecoveryLog(
      logger,
      "warn",
      "[queue] Obnova nemohla přečíst adresář nahrávek; start pokračuje.",
    );
    return { alreadyQueued: 0, failed: 0, recovered: 0, skipped: 0 };
  }

  let canonicalJson;
  let createManifest;
  let writeManifestAtomically;
  try {
    ({ canonicalJson, createManifest, writeManifestAtomically } = await manifestModulePromise);
    if (
      typeof canonicalJson !== "function"
      || typeof createManifest !== "function"
      || typeof writeManifestAtomically !== "function"
    ) {
      throw new TypeError("modul manifestu nemá funkce pro bezpečnou obnovu");
    }
  } catch {
    safeRecoveryLog(
      logger,
      "warn",
      "[queue] Obnova nemohla ověřit manifesty; start pokračuje.",
    );
    return { alreadyQueued: 0, failed: 0, recovered: 0, skipped: 0 };
  }

  const result = { alreadyQueued: 0, failed: 0, recovered: 0, skipped: 0 };
  const candidates = entries
    .filter((entry) => entry.name.endsWith(".manifest.json"))
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of candidates) {
    let recording;
    try {
      recording = await prepareRecoveredRecording({
        canonicalJson,
        createManifest,
        entry,
        recordingsDirectory,
        writeManifestAtomically,
      });
    } catch {
      result.skipped += 1;
      safeRecoveryLog(
        logger,
        "warn",
        "[queue] Obnova přeskočila neplatný nebo nedokončený manifest; soubory zůstaly beze změny.",
      );
      continue;
    }

    try {
      const queued = await queueStore.enqueueRecording(recording);
      if (queued.added) result.recovered += 1;
      else result.alreadyQueued += 1;
    } catch {
      result.failed += 1;
      safeRecoveryLog(
        logger,
        "error",
        "[queue] Obnovenou nahrávku se nepodařilo zapsat do fronty; soubory zůstaly beze změny.",
      );
    }
  }
  return result;
}

/**
 * Vlastník perzistentní fronty. Všechny operace nad jedním souborem řadí do
 * jediného promise řetězu, aby souběžná IPC volání nemohla přepsat novější stav.
 */
function createOutboundQueueStore({ filePath, queueModulePromise, send }) {
  if (typeof filePath !== "string" || filePath.length === 0) {
    throw new TypeError("filePath fronty je povinný");
  }
  if (!queueModulePromise || typeof queueModulePromise.then !== "function") {
    throw new TypeError("queueModulePromise je povinný Promise");
  }
  if (typeof send !== "function") throw new TypeError("send musí být funkce");

  let currentQueue;
  let loaded = false;
  let migrationPending = false;
  const recordingsDirectory = path.join(path.dirname(path.dirname(path.resolve(filePath))), "nahravky");
  /** @type {Promise<unknown>} */
  let operations = Promise.resolve();

  /**
   * @template T
   * @param {() => Promise<T>} operation
   * @returns {Promise<T>}
   */
  function serialize(operation) {
    const result = operations.then(operation);
    operations = result.then(() => undefined, () => undefined);
    return result;
  }

  async function loadQueueModule() {
    const queueModule = await queueModulePromise;
    for (const name of [
      "enqueueRecording",
      "enqueueTimeEntry",
      "claimRecording",
      "processNext",
      "queueItemRequiresHumanAction",
      "reduceQueueForRenderer",
    ]) {
      if (typeof queueModule[name] !== "function") {
        throw new TypeError(`modul fronty nemá funkci ${name}`);
      }
    }
    return queueModule;
  }

  async function recordingSizeBytes(item) {
    if ((item.kind ?? "recording") !== "recording") return null;
    const trackPaths = Object.values(item.tracks ?? {});
    if (trackPaths.length === 0 || trackPaths.some(
      (trackPath) => typeof trackPath !== "string" || trackPath.length === 0,
    )) {
      return null;
    }
    let total = 0;
    try {
      for (const trackPath of trackPaths) {
        const resolvedTrackPath = path.resolve(trackPath);
        if (path.dirname(resolvedTrackPath) !== recordingsDirectory) return null;
        // lstat záměrně nenásleduje symlink. Projekce smí ukázat jen velikost
        // skutečných zvukových souborů, nikdy údaj o cizím cíli podvržené cesty.
        const stats = await fs.promises.lstat(resolvedTrackPath);
        if (!stats.isFile() || !Number.isSafeInteger(stats.size) || stats.size < 0) return null;
        total += stats.size;
        if (!Number.isSafeInteger(total)) return null;
      }
    } catch {
      // Chybějící nebo nečitelnou stopu nevydáváme za nulovou. Renderer údaj
      // prostě nedostane a nic neodhaduje.
      return null;
    }
    return total;
  }

  async function recordingMetadata(item) {
    if ((item.kind ?? "recording") !== "recording") return null;
    if (typeof item.manifestPath !== "string" || item.manifestPath.length === 0) return null;
    const manifestPath = path.resolve(item.manifestPath);
    if (path.dirname(manifestPath) !== recordingsDirectory) return null;

    try {
      const manifest = JSON.parse(await readStableRegularFile(
        manifestPath,
        RECOVERY_MANIFEST_MAX_BYTES,
      ));
      if (manifest.clientRecordingId !== item.clientRecordingId) return null;
      const createdAt = canonicalIsoTimestamp(
        manifest.createdAt,
        "createdAt",
        { nullable: false },
      );
      const durations = Object.values(requiredObject(manifest.tracks, "tracks"))
        .map((track) => {
          if (!track || typeof track !== "object" || Array.isArray(track)) return null;
          const startedAt = canonicalIsoTimestamp(track.startedAt, "track.startedAt");
          const endedAt = canonicalIsoTimestamp(track.endedAt, "track.endedAt");
          if (startedAt === null || endedAt === null) return null;
          const durationMs = Date.parse(endedAt) - Date.parse(startedAt);
          return Number.isSafeInteger(durationMs) && durationMs >= 0 ? durationMs : null;
        })
        .filter((durationMs) => durationMs !== null);
      return {
        createdAt,
        durationMs: durations.length > 0 ? Math.max(...durations) : null,
      };
    } catch {
      // Poškozený nebo mezitím smazaný manifest nesmí shodit celý dashboard.
      return null;
    }
  }

  async function reduceForRenderer(queueModule, queue, currentOwnerFingerprint = null) {
    const items = await Promise.all(queue.items.map(async (item) => {
      const [sizeBytes, metadata] = await Promise.all([
        recordingSizeBytes(item),
        recordingMetadata(item),
      ]);
      return {
        ...item,
        createdAt: metadata?.createdAt ?? null,
        durationMs: metadata?.durationMs ?? null,
        revision: queueItemRevision(item),
        sizeBytes,
      };
    }));
    return queueModule.reduceQueueForRenderer({ ...queue, items }, currentOwnerFingerprint);
  }

  function reduceForLocalDashboard(queueModule, queue, currentOwnerFingerprint = null) {
    const items = queue.items.map((item) => ({
      ...item,
      createdAt: null,
      durationMs: null,
      revision: queueItemRevision(item),
      sizeBytes: null,
    }));
    return queueModule.reduceQueueForRenderer({ ...queue, items }, currentOwnerFingerprint);
  }

  async function ensureLoaded() {
    if (!loaded) {
      const loadedQueue = await loadQueue(filePath, { includeMigration: true });
      currentQueue = loadedQueue.queue;
      loaded = true;
      migrationPending = loadedQueue.migrated;
    }
    if (migrationPending) await commit(currentQueue);
    return currentQueue;
  }

  async function commit(queue) {
    try {
      await saveQueueAtomically(filePath, queue);
    } catch (error) {
      // Rename už mohl uspět a selhat mohl až fsync adresáře. Další operace
      // proto musí znovu načíst disk místo přepsání novějšího stavu starou cache.
      currentQueue = undefined;
      loaded = false;
      throw error;
    }
    currentQueue = queue;
    loaded = true;
    migrationPending = false;
  }

  function requireCurrentOwnerFingerprint(value) {
    if (
      value !== null
      && (typeof value !== "string" || !QUEUE_OWNER_FINGERPRINT_PATTERN.test(value))
    ) {
      throw new TypeError("currentOwnerFingerprint musí být platný otisk nebo null");
    }
    return value;
  }

  function activeCooldown(queue, ownerFingerprint, now) {
    if (ownerFingerprint === null) return null;
    return (queue.uploadCooldowns ?? []).find((cooldown) => (
      cooldown.ownerFingerprint === ownerFingerprint && cooldown.retryAt > now
    )) ?? null;
  }

  function withoutExpiredCooldowns(queue, now) {
    if (!Object.prototype.hasOwnProperty.call(queue, "uploadCooldowns")) return queue;
    const uploadCooldowns = queue.uploadCooldowns.filter((cooldown) => cooldown.retryAt > now);
    return uploadCooldowns.length === queue.uploadCooldowns.length
      ? queue
      : { ...queue, uploadCooldowns };
  }

  function withCooldown(queue, ownerFingerprint, retryAt) {
    const uploadCooldowns = (queue.uploadCooldowns ?? []).filter(
      (cooldown) => cooldown.ownerFingerprint !== ownerFingerprint,
    );
    uploadCooldowns.push({ ownerFingerprint, retryAt });
    return { ...queue, uploadCooldowns };
  }

  function enqueueRecording(recording) {
    return serialize(async () => {
      const queueModule = await loadQueueModule();
      const queue = await ensureLoaded();
      const enqueued = microphoneOnlyRecording(recording)
        ? enqueueMicrophoneOnlyRecording(queue, recording)
        : queueModule.enqueueRecording(queue, recording);
      const result = addOwnerToNewRecording(
        enqueued,
        normalizeQueueOwnerFingerprint(recording?.ownerFingerprint),
      );
      if (result.added) await commit(result.queue);
      return result;
    });
  }

  function enqueueTimeEntry(entry) {
    return serialize(async () => {
      const queueModule = await loadQueueModule();
      const result = queueModule.enqueueTimeEntry(await ensureLoaded(), entry);
      if (result.added) await commit(result.queue);
      return result;
    });
  }

  function claimRecording(clientRecordingId, expectedRevision, ownerFingerprint, options = {}) {
    if (typeof clientRecordingId !== "string" || !UUID_PATTERN.test(clientRecordingId)) {
      throw new TypeError("clientRecordingId musí být GUID");
    }
    if (typeof expectedRevision !== "string" || !QUEUE_ITEM_REVISION_PATTERN.test(expectedRevision)) {
      throw new TypeError("expectedRevision musí být platná revize");
    }
    if (
      typeof ownerFingerprint !== "string"
      || !QUEUE_OWNER_FINGERPRINT_PATTERN.test(ownerFingerprint)
    ) {
      throw new TypeError("ownerFingerprint musí být platný otisk vlastníka");
    }
    if (typeof options?.guard !== "function") {
      throw new TypeError("options.guard musí být funkce");
    }

    return serialize(async () => {
      const queueModule = await loadQueueModule();
      const queue = await ensureLoaded();
      const currentItem = queue.items.find(
        (item) => item.clientRecordingId === clientRecordingId,
      );
      if (!currentItem) throw new Error("nahrávka ve frontě nebyla nalezena");
      if (queueItemRevision(currentItem) !== expectedRevision) {
        throw new Error("Snímek nahrávky je neaktuální; načtěte seznam znovu");
      }
      const claimed = queueModule.claimRecording(queue, clientRecordingId, ownerFingerprint);
      const allowed = await options.guard(Object.freeze({
        clientRecordingId,
        revision: expectedRevision,
      }));
      if (allowed !== true) {
        throw new Error("Aktuální identitu nelze bezpečně potvrdit");
      }
      await commit(claimed.queue);
      const items = await reduceForRenderer(queueModule, claimed.queue, ownerFingerprint);
      return {
        claimed: true,
        item: items.find((item) => item.id === clientRecordingId),
        items,
      };
    });
  }

  function decideRecording(clientRecordingId, ownerFingerprint, title, approve, options = {}) {
    if (typeof clientRecordingId !== "string" || !UUID_PATTERN.test(clientRecordingId)) {
      throw new TypeError("clientRecordingId musí být GUID");
    }
    if (ownerFingerprint !== null
      && (typeof ownerFingerprint !== "string" || !QUEUE_OWNER_FINGERPRINT_PATTERN.test(ownerFingerprint))) {
      throw new TypeError("ownerFingerprint musí být platný otisk");
    }
    if (typeof approve !== "boolean") throw new TypeError("approve musí být boolean");
    if (approve && typeof options.guard !== "function") {
      throw new TypeError("Schválení vyžaduje aktuální guard identity");
    }
    const normalizedTitle = normalizedRecordingTitle(title);
    return serialize(async () => {
      const queue = await ensureLoaded();
      const index = queue.items.findIndex((item) => item.clientRecordingId === clientRecordingId);
      if (index < 0) throw new Error("nahrávka ve frontě nebyla nalezena");
      const original = queue.items[index];
      if ((original.kind ?? "recording") !== "recording" || original.ownerFingerprint !== ownerFingerprint) {
        throw new Error("nahrávka nepatří aktuálnímu účtu");
      }
      if (["odesila", "odeslano"].includes(original.state)) {
        throw new Error("o nahrávce už bylo rozhodnuto");
      }
      const approved = approve && ownerFingerprint !== null && await options.guard() === true;
      const item = {
        ...original,
        title: normalizedTitle,
        uploadIntent: approved ? "approved" : "held",
        ...(approved ? { requiresHumanAction: false } : {}),
      };
      const items = [...queue.items];
      items[index] = item;
      const next = { ...queue, items };
      await commit(next);
      return { approved, item, queue: next, revision: queueItemRevision(item) };
    });
  }

  function actOnRecording({ clientRecordingId, expectedRevision, expectedFileRevision,
    currentOwnerFingerprint, mode, killswitches, guard }) {
    if (typeof clientRecordingId !== "string" || !UUID_PATTERN.test(clientRecordingId)) {
      throw new TypeError("clientRecordingId musí být GUID");
    }
    if (typeof expectedRevision !== "string" || !QUEUE_ITEM_REVISION_PATTERN.test(expectedRevision)
      || typeof expectedFileRevision !== "string" || !QUEUE_ITEM_REVISION_PATTERN.test(expectedFileRevision)) {
      throw new TypeError("Akce vyžaduje platnou queue i file revizi");
    }
    requireCurrentOwnerFingerprint(currentOwnerFingerprint);
    if (!new Set(["send", "retry"]).has(mode)) throw new TypeError("Neplatná akce nahrávky");
    if (!killswitches || typeof killswitches !== "object") throw new TypeError("Chybí killswitche");
    if (typeof guard !== "function") throw new TypeError("Akce vyžaduje aktuální guard");
    return serialize(async () => {
      const queueModule = await loadQueueModule();
      const loadedQueue = await loadQueue(filePath, { includeMigration: true });
      let queue = loadedQueue.queue;
      currentQueue = loadedQueue.queue;
      loaded = true;
      migrationPending = loadedQueue.migrated;
      if (migrationPending) await commit(queue);
      const queueItems = reduceForLocalDashboard(queueModule, queue, currentOwnerFingerprint);
      const snapshot = await createLocalRecordingsSnapshot({ queue, queueItems, recordingsDirectory });
      const projected = snapshot.items.find((item) => item.id === clientRecordingId);
      const index = queue.items.findIndex((item) => item.clientRecordingId === clientRecordingId);
      const original = queue.items[index];
      if (!projected || index < 0 || projected.revision !== expectedRevision
        || projected.fileRevision !== expectedFileRevision || projected.source !== "queue"
        || projected.localState === "invalid-manifest" || projected.localState === "missing-audio") {
        throw new Error("Snímek nahrávky je neaktuální; načtěte seznam znovu");
      }
      if (currentOwnerFingerprint === null || original.ownerFingerprint !== currentOwnerFingerprint) {
        throw new Error("Nahrávka nepatří aktuálnímu účtu");
      }
      if (await guard() !== true) throw new Error("Aktuální identitu nelze bezpečně potvrdit");
      if (original.state === "odesila" || original.state === "odeslano") {
        throw new Error("Nahrávku teď nelze odeslat");
      }
      const now = Date.now();
      const cooldown = activeCooldown(queue, currentOwnerFingerprint, now);
      if (cooldown) return { outcome: "rate_limited", retryAt: cooldown.retryAt, items: snapshot.items };
      let item = original;
      if (mode === "retry") {
        const retried = queueModule.retryFailedItem(queue, clientRecordingId);
        queue = retried.queue;
        item = retried.item;
        if (item === original && original.state !== "ceka") {
          throw new Error("Nahrávku nelze opakovat");
        }
      }
      item = { ...item, uploadIntent: "approved", nextAttemptAt: null, requiresHumanAction: false };
      const items = [...queue.items];
      items[index] = item;
      queue = { ...queue, items };
      await commit(queue);
      if (await guard() !== true) throw new Error("Aktuální identitu nelze bezpečně potvrdit");
      const { result } = await processOne(killswitches,
        currentOwnerFingerprint, clientRecordingId);
      return { ...result, items: await reduceForRenderer(queueModule, currentQueue, currentOwnerFingerprint) };
    });
  }

  async function freshActionTarget(clientRecordingId, expectedRevision, expectedFileRevision) {
    const loadedQueue = await loadQueue(filePath, { includeMigration: true });
    const queue = loadedQueue.queue;
    currentQueue = queue;
    loaded = true;
    migrationPending = loadedQueue.migrated;
    const queueModule = await loadQueueModule();
    const queueItems = reduceForLocalDashboard(queueModule, queue, null);
    const snapshot = await createLocalRecordingsSnapshot({ queue, queueItems, recordingsDirectory });
    const projected = snapshot.items.find((item) => item.id === clientRecordingId);
    if (!projected || projected.revision !== expectedRevision
      || projected.fileRevision !== expectedFileRevision || projected.localState === "invalid-manifest") {
      throw new Error("Snímek nahrávky je neaktuální; načtěte seznam znovu");
    }
    let rawItem = queue.items.find((item) => item.clientRecordingId === clientRecordingId) ?? null;
    let manifestPath = rawItem ? rawItem.sourceManifestPath ?? rawItem.manifestPath : null;
    const primaryManifests = [];
    const entries = await fs.promises.readdir(recordingsDirectory, { withFileTypes: true });
    for (const entry of entries
      .filter((candidate) => candidate.isFile() && candidate.name.endsWith(".manifest.json"))
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const candidatePath = path.join(recordingsDirectory, entry.name);
      try {
        const parsed = JSON.parse((await readStableDashboardFile(
          candidatePath,
          RECOVERY_MANIFEST_MAX_BYTES,
        )).contents);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)
          || typeof parsed.clientRecordingId !== "string" || !UUID_PATTERN.test(parsed.clientRecordingId)
          || !parsed.tracks || typeof parsed.tracks !== "object" || Array.isArray(parsed.tracks)) continue;
        const trackNames = Object.values(parsed.tracks).map((track) => track?.fileName);
        if (trackNames.length < 1 || trackNames.length > 2
          || trackNames.some((name) => typeof name !== "string" || path.basename(name) !== name)) continue;
        primaryManifests.push({ path: candidatePath, clientRecordingId: parsed.clientRecordingId, trackNames });
      } catch { /* nečitelný manifest není bezpečný zdroj reference */ }
    }
    if (manifestPath === null) {
      const matches = primaryManifests.filter(
        (candidate) => candidate.clientRecordingId === clientRecordingId,
      );
      if (matches.length !== 1) {
        throw new Error("Nahrávka nemá jednoznačný primární manifest");
      }
      manifestPath = matches[0].path;
    }
    if (typeof manifestPath !== "string") throw new Error("Manifest nahrávky nebyl nalezen");
    const rootStats = await fs.promises.lstat(recordingsDirectory);
    if (!rootStats.isDirectory() || rootStats.isSymbolicLink() || (rootStats.mode & 0o077) !== 0) {
      throw new Error("Adresář nahrávek nemá bezpečný režim");
    }
    const root = await fs.promises.realpath(recordingsDirectory);
    const primaryPath = path.join(root, path.basename(path.resolve(manifestPath)));
    if (path.dirname(path.resolve(manifestPath)) !== root
      && path.dirname(path.resolve(manifestPath)) !== path.resolve(recordingsDirectory)) {
      throw new Error("Manifest neleží v adresáři nahrávek");
    }
    const manifest = JSON.parse((await readStableDashboardFile(primaryPath, RECOVERY_MANIFEST_MAX_BYTES)).contents);
    if (manifest.clientRecordingId !== clientRecordingId || !manifest.tracks
      || typeof manifest.tracks !== "object" || Array.isArray(manifest.tracks)) {
      throw new Error("Manifest nahrávky není platný");
    }
    const audioPaths = [];
    for (const source of Object.keys(manifest.tracks).sort()) {
      const fileName = manifest.tracks[source]?.fileName;
      if (!["microphone", "system"].includes(source) || typeof fileName !== "string"
        || path.basename(fileName) !== fileName) throw new Error("Manifest obsahuje nebezpečnou stopu");
      audioPaths.push(path.join(root, fileName));
    }
    const targetAudioNames = new Set(audioPaths.map((audioPath) => path.basename(audioPath)));
    const sharedManifestReference = primaryManifests.some((candidate) => (
      path.basename(candidate.path) !== path.basename(primaryPath)
      && candidate.trackNames.some((name) => targetAudioNames.has(name))
    ));
    const sharedQueueReference = queue.items.some((candidate) => (
      candidate !== rawItem
      && (candidate.kind ?? "recording") === "recording"
      && Object.values(candidate.tracks ?? {}).some((trackPath) => {
        if (typeof trackPath !== "string") return false;
        const resolved = path.resolve(trackPath);
        return (path.dirname(resolved) === root
          || path.dirname(resolved) === path.resolve(recordingsDirectory))
          && targetAudioNames.has(path.basename(resolved));
      })
    ));
    if (sharedManifestReference || sharedQueueReference) {
      throw new Error("Audio soubor používá také jiný primární manifest nebo queue položka");
    }
    const sidecarPath = `${primaryPath}.recovered-upload-v1.json`;
    try {
      const sidecar = JSON.parse((await readStableDashboardFile(sidecarPath, RECOVERY_MANIFEST_MAX_BYTES)).contents);
      const { canonicalJson } = await import("../src/lib/manifest.js");
      if (manifest.state === "complete") {
        if (canonicalJson(sidecar) !== canonicalJson(manifest)) {
          throw new Error("Recovery sidecar nesouhlasí s manifestem");
        }
      } else {
        const sources = Object.keys(manifest.tracks).sort();
        const sidecarSources = Object.keys(sidecar?.tracks ?? {}).sort();
        const invalidSidecar = !sidecar || typeof sidecar !== "object" || Array.isArray(sidecar)
          || sidecar.schemaVersion !== 1 || sidecar.clientRecordingId !== clientRecordingId
          || !["complete", "incomplete"].includes(sidecar.state)
          || sidecar.createdAt !== manifest.createdAt
          || sources.join("|") !== sidecarSources.join("|")
          || sources.some((source) => {
            const primaryTrack = manifest.tracks[source];
            const recoveredTrack = sidecar.tracks[source];
            return !recoveredTrack || typeof recoveredTrack !== "object" || Array.isArray(recoveredTrack)
              || recoveredTrack.fileName !== primaryTrack.fileName
              || !Number.isSafeInteger(recoveredTrack.sizeBytes) || recoveredTrack.sizeBytes < 0
              || (recoveredTrack.sha256 !== null
                && (typeof recoveredTrack.sha256 !== "string"
                  || !/^[a-f0-9]{64}$/u.test(recoveredTrack.sha256)))
              || (Number.isSafeInteger(primaryTrack.sizeBytes) && primaryTrack.sizeBytes > 0
                && primaryTrack.sizeBytes !== recoveredTrack.sizeBytes)
              || (typeof primaryTrack.sha256 === "string" && /^[a-f0-9]{64}$/u.test(primaryTrack.sha256)
                && primaryTrack.sha256 !== recoveredTrack.sha256);
          });
        if (invalidSidecar) {
          throw new Error("Recovery sidecar nesouhlasí s manifestem");
        }
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const latestQueueItems = reduceForLocalDashboard(queueModule, queue, null);
    const latestSnapshot = await createLocalRecordingsSnapshot({
      queue, queueItems: latestQueueItems, recordingsDirectory,
    });
    const latestProjected = latestSnapshot.items.find((item) => item.id === clientRecordingId);
    if (!latestProjected || latestProjected.revision !== expectedRevision
      || latestProjected.fileRevision !== expectedFileRevision) {
      throw new Error("Soubory nahrávky se během přípravy akce změnily");
    }
    return { audioPaths, manifestPath: primaryPath, projected, queue, rawItem, sidecarPath };
  }

  async function stableTrashStat(file) {
    try {
      const before = await fs.promises.lstat(file);
      if (!before.isFile() || before.isSymbolicLink()) throw new Error("Cíl není bezpečný soubor");
      const handle = await fs.promises.open(file, fs.constants.O_RDONLY
        | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
      try {
        const opened = await handle.stat();
        const current = await fs.promises.lstat(file);
        if (!opened.isFile() || !sameFileStats(before, opened) || !sameFileStats(opened, current)) {
          throw new Error("Soubor se během kontroly změnil");
        }
        return { dev: current.dev, ino: current.ino, size: current.size,
          mtimeMs: current.mtimeMs, ctimeMs: current.ctimeMs };
      } finally { await handle.close(); }
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  function sameTrashStat(first, second) {
    return first === null ? second === null : second !== null
      && first.dev === second.dev && first.ino === second.ino && first.size === second.size
      && first.mtimeMs === second.mtimeMs && first.ctimeMs === second.ctimeMs;
  }

  function deleteRecording({ clientRecordingId, expectedRevision, expectedFileRevision, guard, trashItem }) {
    if (typeof guard !== "function" || typeof trashItem !== "function") {
      throw new TypeError("Smazání vyžaduje guard a koš");
    }
    return serialize(async () => {
      if (await guard() !== true) throw new Error("Akci už nelze bezpečně potvrdit");
      const target = await freshActionTarget(clientRecordingId, expectedRevision, expectedFileRevision);
      if (target.rawItem?.state === "odesila") throw new Error("Nahrávka se právě odesílá");
      const planned = [...target.audioPaths, target.sidecarPath, target.manifestPath];
      const initial = await Promise.all(planned.map(stableTrashStat));
      try {
        for (let index = 0; index < planned.length; index += 1) {
          if (await guard() !== true) throw new Error("Akci už nelze bezpečně potvrdit");
          const current = await stableTrashStat(planned[index]);
          if (await guard() !== true) throw new Error("Akci už nelze bezpečně potvrdit");
          if (!sameTrashStat(initial[index], current)) throw new Error("Soubor se před přesunem změnil");
          if (current !== null) {
            if (await guard() !== true) throw new Error("Akci už nelze bezpečně potvrdit");
            await trashItem(planned[index]);
          }
        }
      } catch {
        return { outcome: "partial_failure" };
      }
      if (target.rawItem) {
        const items = target.queue.items.filter((item) => item !== target.rawItem);
        await commit({ ...target.queue, items });
      }
      return { outcome: "deleted" };
    });
  }

  function revealRecording({ clientRecordingId, expectedRevision, expectedFileRevision, guard }) {
    if (typeof guard !== "function") throw new TypeError("Reveal vyžaduje guard");
    return serialize(async () => {
      const target = await freshActionTarget(clientRecordingId, expectedRevision, expectedFileRevision);
      for (const candidate of [...target.audioPaths, target.manifestPath]) {
        if (await guard() !== true) throw new Error("Akci už nelze bezpečně potvrdit");
        if (await stableTrashStat(candidate) !== null) {
          if (await guard() !== true) throw new Error("Akci už nelze bezpečně potvrdit");
          return { outcome: "shown", filePath: candidate };
        }
      }
      return { outcome: "missing" };
    });
  }

  async function processOne(killswitches, currentOwnerFingerprint, clientRecordingId, kind) {
    const queueModule = await loadQueueModule();
    const now = Date.now();
    let before = withoutExpiredCooldowns(await ensureLoaded(), now);
    if (before !== currentQueue) await commit(before);
    const cooldown = activeCooldown(before, currentOwnerFingerprint, now);
    const guardedSend = async (item, reportServerProgress) => {
      if ((item.kind ?? "recording") !== "recording") return send(item, reportServerProgress);
      if (currentOwnerFingerprint === null) {
        throw Object.assign(new Error("Identitu aktuálního přihlášení nelze ověřit"), {
          code: "queue_owner_unknown",
          failureClass: "paused",
        });
      }
      if (item.ownerFingerprint !== currentOwnerFingerprint) {
        throw Object.assign(new Error("Nahrávka patří jinému účtu"), {
          code: "queue_owner_mismatch",
          failureClass: "paused",
        });
      }
      return send(item, reportServerProgress);
    };
    const result = await queueModule.processNext(before, killswitches, guardedSend, {
      currentOwnerFingerprint,
      // Už jsme uvnitř `serialize()`. Přímý commit drží jednu transakci; volání veřejné
      // metody storu odsud by čekalo samo na sebe a vytvořilo deadlock.
      persistProgress: commit,
      ...(cooldown ? { recordingCooldownRetryAt: cooldown.retryAt } : {}),
      ...(clientRecordingId ? { clientRecordingId } : {}),
      ...(kind ? { kind } : {}),
    });
    const queueAfterResult = result.outcome === "rate_limited" && result.item !== null
      ? withCooldown(result.queue, currentOwnerFingerprint, result.retryAt)
      : result.queue;
    if (queueAfterResult !== currentQueue) await commit(queueAfterResult);
    return { queueModule, result: { ...result, queue: queueAfterResult } };
  }

  // 🔴 `processNext` odešle vždy nejvýš JEDNU položku a je to záměr (viz její komentář):
  // uvnitř pokračuje výhradně přes položky, které na server nic neposílají. Opakované
  // volání je proto na volajícím — a TO JE PRÁVĚ TO, co tu do 11. 9. 2026 chybělo: pump
  // zavolal `processOne` jednou a skončil, takže jeden start appky posunul jedinou
  // nahrávku a člověk se čtrnácti frontovanými by potřeboval čtrnáct restartů.
  //
  // Smyčka pokračuje VÝHRADNĚ po úspěchu. Každý jiný výsledek — pauza, vypnuté odesílání,
  // prázdná fronta, chyba — ji zastaví. Tím zůstává fail-closed: chyba přihlášení se
  // nezopakuje na každé položce fronty. To není opatrnost: neúspěšné ověření tokenu má
  // u serveru vlastní strop 30/min na IP, který SDÍLÍ s `/api/mcp`, takže rozbitá session
  // hnaná přes celou frontu by člověku shodila i MCP.
  //
  // Strop existuje kvůli limitu zahájení (30/h, počítá se i opakování, okno je pevné
  // a `429` zatím nenese `Retry-After`). Jedním během proto nechceme vyčerpat celé okno.
  const MAX_POLOZEK_NA_JEDNU_PUMPU = 20;

  function pump(killswitches, currentOwnerFingerprint = null) {
    requireCurrentOwnerFingerprint(currentOwnerFingerprint);
    return serialize(async () => {
      let posledni = null;
      let odeslano = 0;
      for (let poradi = 0; poradi < MAX_POLOZEK_NA_JEDNU_PUMPU; poradi += 1) {
        posledni = (await processOne(killswitches, currentOwnerFingerprint)).result;
        if (posledni.outcome !== "sent") break;
        odeslano += 1;
      }
      // 🔴 Počet odeslaných MUSÍ ven ze smyčky. Bez něj zná appka jen POSLEDNÍ výsledek — a
      // ten je po úspěšném vyprázdnění „žádná položka není připravená", protože pumpa skončí
      // až ve chvíli, kdy nic nezbývá. 11. 9. 2026 jsem přesně takový log přečetl jako „nic
      // se neodeslalo", ohlásil to Danovi i serverové session a požádal je, ať vypnou hlídač.
      // Na serveru mezitím ležely tři nové nahrávky včetně dvoustopého páru, na který jsme
      // celé odpoledne čekali. Koncový stav běhu není totéž co jeho výsledek.
      return { ...posledni, odeslanoVDavce: odeslano };
    });
  }

  function list(currentOwnerFingerprint = null) {
    if (
      currentOwnerFingerprint !== null
      && (
        typeof currentOwnerFingerprint !== "string"
        || !QUEUE_OWNER_FINGERPRINT_PATTERN.test(currentOwnerFingerprint)
      )
    ) {
      throw new TypeError("currentOwnerFingerprint musí být platný otisk nebo null");
    }
    return serialize(async () => {
      const queueModule = await loadQueueModule();
      return reduceForRenderer(queueModule, await ensureLoaded(), currentOwnerFingerprint);
    });
  }

  function listLocalRecordings(currentOwnerFingerprint = null) {
    if (
      currentOwnerFingerprint !== null
      && (
        typeof currentOwnerFingerprint !== "string"
        || !QUEUE_OWNER_FINGERPRINT_PATTERN.test(currentOwnerFingerprint)
      )
    ) {
      throw new TypeError("currentOwnerFingerprint musí být platný otisk nebo null");
    }
    return serialize(async () => {
      const queueModule = await loadQueueModule();
      // Přehled čte frontu pokaždé z disku. Poškození vzniklé mimo proces tak
      // nezakryje dříve načtená cache a disk se začne skenovat až po platné frontě.
      let queue;
      try {
        const loadedQueue = await loadQueue(filePath, { includeMigration: true });
        queue = loadedQueue.queue;
        migrationPending = loadedQueue.migrated;
      } catch (error) {
        currentQueue = undefined;
        loaded = false;
        throw error;
      }
      currentQueue = queue;
      loaded = true;
      const queueItems = reduceForLocalDashboard(queueModule, queue, currentOwnerFingerprint);
      return createLocalRecordingsSnapshot({ queue, queueItems, recordingsDirectory });
    });
  }

  function getRecordingVerificationTarget(
    clientRecordingId,
    expectedRevision,
    currentOwnerFingerprint,
  ) {
    if (typeof clientRecordingId !== "string" || !UUID_PATTERN.test(clientRecordingId)) {
      throw new TypeError("clientRecordingId musí být GUID");
    }
    if (typeof expectedRevision !== "string" || !QUEUE_ITEM_REVISION_PATTERN.test(expectedRevision)) {
      throw new TypeError("expectedRevision musí být platná revize");
    }
    if (
      typeof currentOwnerFingerprint !== "string"
      || !QUEUE_OWNER_FINGERPRINT_PATTERN.test(currentOwnerFingerprint)
    ) {
      throw new TypeError("currentOwnerFingerprint musí být platný otisk");
    }

    return serialize(async () => {
      let queue;
      try {
        const loadedQueue = await loadQueue(filePath, { includeMigration: true });
        queue = loadedQueue.queue;
        migrationPending = loadedQueue.migrated;
      } catch (error) {
        currentQueue = undefined;
        loaded = false;
        throw error;
      }
      currentQueue = queue;
      loaded = true;
      const queueModule = await loadQueueModule();
      const queueItems = reduceForLocalDashboard(queueModule, queue, currentOwnerFingerprint);
      const firstSnapshot = await createLocalRecordingsSnapshot({
        queue, queueItems, recordingsDirectory,
      });
      const projected = firstSnapshot.items.find((candidate) => candidate.id === clientRecordingId);
      const item = queue.items.find((candidate) => (
        (candidate.kind ?? "recording") === "recording"
        && candidate.clientRecordingId === clientRecordingId
      ));
      if (
        !item
        || !projected
        || projected.source !== "queue"
        || projected.revision !== expectedRevision
        || typeof projected.fileRevision !== "string"
        || !QUEUE_ITEM_REVISION_PATTERN.test(projected.fileRevision)
        || projected.localState === "invalid-manifest"
      ) throw new Error("Snímek nahrávky je neaktuální; načtěte seznam znovu");
      if (item.ownerFingerprint !== currentOwnerFingerprint) {
        throw new Error("Nahrávka nepatří aktuálnímu účtu");
      }

      const configuredRoot = path.resolve(recordingsDirectory);
      const canonicalRoot = await fs.promises.realpath(configuredRoot);
      const rawPrimaryPath = item.sourceManifestPath ?? item.manifestPath;
      const rawUploadPath = item.manifestPath;
      if (typeof rawPrimaryPath !== "string" || typeof rawUploadPath !== "string") {
        throw new Error("Manifest není dostupný");
      }
      const resolvedPrimaryPath = path.resolve(rawPrimaryPath);
      const resolvedUploadPath = path.resolve(rawUploadPath);
      for (const candidate of [resolvedPrimaryPath, resolvedUploadPath]) {
        if (
          path.dirname(candidate) !== configuredRoot
          && path.dirname(candidate) !== canonicalRoot
        ) throw new Error("Manifest neleží v adresáři nahrávek");
      }
      if (
        resolvedUploadPath !== resolvedPrimaryPath
        && resolvedUploadPath !== `${resolvedPrimaryPath}.recovered-upload-v1.json`
      ) throw new Error("Uploadovací manifest není známý recovery sidecar");
      const primaryPath = path.join(canonicalRoot, path.basename(resolvedPrimaryPath));
      const uploadPath = path.join(canonicalRoot, path.basename(resolvedUploadPath));
      const primaryRead = await readStableDashboardFile(primaryPath, RECOVERY_MANIFEST_MAX_BYTES);
      const uploadRead = uploadPath === primaryPath
        ? primaryRead
        : await readStableDashboardFile(uploadPath, RECOVERY_MANIFEST_MAX_BYTES);
      const primaryManifest = JSON.parse(primaryRead.contents);
      const manifest = JSON.parse(uploadRead.contents);
      if (
        !primaryManifest || typeof primaryManifest !== "object" || Array.isArray(primaryManifest)
        || !manifest || typeof manifest !== "object" || Array.isArray(manifest)
        || primaryManifest.schemaVersion !== 1 || manifest.schemaVersion !== 1
        || primaryManifest.clientRecordingId !== clientRecordingId
        || manifest.clientRecordingId !== clientRecordingId
        || !["complete", "incomplete"].includes(primaryManifest.state)
        || !["complete", "incomplete"].includes(manifest.state)
        || !primaryManifest.tracks || typeof primaryManifest.tracks !== "object"
        || Array.isArray(primaryManifest.tracks)
        || !manifest.tracks || typeof manifest.tracks !== "object" || Array.isArray(manifest.tracks)
        || primaryManifest.createdAt !== manifest.createdAt
      ) throw new Error("Primární manifest není platný");
      const trackNames = Object.keys(manifest.tracks);
      const primaryTrackNames = Object.keys(primaryManifest.tracks);
      if (
        trackNames.length < 1
        || trackNames.length > 2
        || !trackNames.includes("microphone")
        || trackNames.some((name) => !["microphone", "system"].includes(name))
        || [...primaryTrackNames].sort().join("|") !== [...trackNames].sort().join("|")
        || Object.keys(item.tracks ?? {}).sort().join("|") !== [...trackNames].sort().join("|")
      ) throw new Error("Primární manifest nemá očekávané stopy");

      const trustedTracks = {};
      for (const name of ["microphone", "system"]) {
        if (!trackNames.includes(name)) continue;
        const manifestTrack = manifest.tracks[name];
        const storedRecordingId = item.server?.tracks?.[name]?.recordingId;
        const recordingId = typeof storedRecordingId === "string"
          && UUID_PATTERN.test(storedRecordingId)
          ? storedRecordingId
          : null;
        if (
          !manifestTrack
          || typeof manifestTrack !== "object"
          || Array.isArray(manifestTrack)
          || typeof manifestTrack.fileName !== "string"
          || path.basename(manifestTrack.fileName) !== manifestTrack.fileName
          || !Number.isSafeInteger(manifestTrack.sizeBytes)
          || manifestTrack.sizeBytes < 0
          || (recordingId === null
            ? manifestTrack.sha256 !== null
              && (typeof manifestTrack.sha256 !== "string"
                || !/^[a-f0-9]{64}$/u.test(manifestTrack.sha256))
            : manifestTrack.sizeBytes <= 0
              || typeof manifestTrack.sha256 !== "string"
              || !/^[a-f0-9]{64}$/u.test(manifestTrack.sha256))
        ) throw new Error("Primární manifest obsahuje neplatnou stopu");
        const primaryTrack = primaryManifest.tracks[name];
        if (
          !primaryTrack
          || typeof primaryTrack !== "object"
          || Array.isArray(primaryTrack)
          || primaryTrack.fileName !== manifestTrack.fileName
          || (Number.isSafeInteger(primaryTrack.sizeBytes)
            && primaryTrack.sizeBytes > 0
            && primaryTrack.sizeBytes !== manifestTrack.sizeBytes)
          || (typeof primaryTrack.sha256 === "string"
            && /^[a-f0-9]{64}$/u.test(primaryTrack.sha256)
            && primaryTrack.sha256 !== manifestTrack.sha256)
        ) throw new Error("Recovery sidecar nesouhlasí s primárním manifestem");
        const queueTrackPath = path.resolve(item.tracks[name]);
        if (
          (path.dirname(queueTrackPath) !== configuredRoot
            && path.dirname(queueTrackPath) !== canonicalRoot)
          || path.basename(queueTrackPath) !== manifestTrack.fileName
        ) throw new Error("Cesta stopy není důvěryhodná");
        try {
          const trackStats = await fs.promises.lstat(path.join(
            canonicalRoot,
            path.basename(queueTrackPath),
          ));
          if (!trackStats.isFile() || trackStats.isSymbolicLink()) {
            throw new Error("Cesta stopy není bezpečný soubor");
          }
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
        trustedTracks[name] = Object.freeze({
          recordingId,
          declaredBytes: manifestTrack.sizeBytes,
          sha256: manifestTrack.sha256,
        });
      }
      const secondSnapshot = await createLocalRecordingsSnapshot({
        queue, queueItems, recordingsDirectory,
      });
      const currentProjected = secondSnapshot.items.find(
        (candidate) => candidate.id === clientRecordingId,
      );
      if (
        !currentProjected
        || currentProjected.revision !== expectedRevision
        || currentProjected.fileRevision !== projected.fileRevision
        || currentProjected.localState === "invalid-manifest"
      ) throw new Error("Primární manifest se během ověření změnil");
      return Object.freeze({
        id: clientRecordingId,
        ownerFingerprint: currentOwnerFingerprint,
        revision: expectedRevision,
        tracks: Object.freeze(trustedTracks),
      });
    });
  }

  function retry(killswitches, currentOwnerFingerprint = null) {
    requireCurrentOwnerFingerprint(currentOwnerFingerprint);
    return serialize(async () => {
      const queueModule = await loadQueueModule();
      const now = Date.now();
      let queue = withoutExpiredCooldowns(await ensureLoaded(), now);
      if (queue !== currentQueue) await commit(queue);
      const cooldown = activeCooldown(queue, currentOwnerFingerprint, now);
      let changed = false;
      const items = queue.items.map((item) => {
        if (
          item.state !== "ceka"
          || item.nextAttemptAt === null
          || queueModule.queueItemRequiresHumanAction(item)
          || (item.kind ?? "recording") === "recording"
          || ((item.kind ?? "recording") === "recording" && (
            currentOwnerFingerprint === null
            || item.ownerFingerprint !== currentOwnerFingerprint
            || cooldown !== null
          ))
        ) {
          return item;
        }
        changed = true;
        return { ...item, nextAttemptAt: null };
      });
      if (changed) await commit({ ...queue, items });

      const { result } = await processOne(killswitches, currentOwnerFingerprint, undefined, "time");
      return {
        outcome: result.outcome,
        reason: result.reason,
        items: await reduceForRenderer(queueModule, currentQueue),
      };
    });
  }

  function nextRecordingRetryAt(currentOwnerFingerprint) {
    requireCurrentOwnerFingerprint(currentOwnerFingerprint);
    return serialize(async () => {
      if (currentOwnerFingerprint === null) return null;
      const queue = await ensureLoaded();
      const candidates = queue.items.filter((item) => (item.kind ?? "recording") === "recording"
        && item.ownerFingerprint === currentOwnerFingerprint && item.uploadIntent === "approved"
        && item.state === "ceka" && item.requiresHumanAction !== true);
      if (candidates.length === 0) return null;
      const cooldown = activeCooldown(queue, currentOwnerFingerprint, Date.now());
      if (cooldown) return cooldown.retryAt;
      const times = candidates.map((item) => item.nextAttemptAt)
        .filter((value) => Number.isSafeInteger(value) && value > Date.now());
      return times.length > 0 ? Math.min(...times) : null;
    });
  }

  return Object.freeze({
    actOnRecording,
    claimRecording,
    decideRecording,
    deleteRecording,
    enqueueRecording,
    enqueueTimeEntry,
    getRecordingVerificationTarget,
    list,
    listLocalRecordings,
    nextRecordingRetryAt,
    pump,
    revealRecording,
    retry,
  });
}

module.exports = {
  createOutboundQueueStore,
  deriveQueueOwnerFingerprint,
  loadQueue,
  recoverOrphanedRecordings,
  saveQueueAtomically,
};
