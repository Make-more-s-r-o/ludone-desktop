const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");

const QUEUE_SCHEMA_VERSION = 1;
const RECOVERABLE_MANIFEST_STATES = new Set(["complete", "incomplete"]);
const RECOVERY_HASH_BUFFER_BYTES = 1024 * 1024;
const RECOVERY_MANIFEST_MAX_BYTES = 1024 * 1024;
const RECOVERY_TRACK_MAX_BYTES = 512 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

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
  return queue;
}

/** Načte frontu; neexistující soubor znamená dosud prázdnou frontu. */
async function loadQueue(filePath) {
  try {
    const contents = await fs.promises.readFile(filePath, "utf8");
    return validateQueue(JSON.parse(contents));
  } catch (error) {
    if (error && error.code === "ENOENT") return emptyQueue();
    throw error;
  }
}

/** Atomický zápis ve stejném adresáři: temp soubor, fsync a rename. */
async function saveQueueAtomically(filePath, queue) {
  validateQueue(queue);
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
  for (const source of ["microphone", "system"]) {
    canonicalIsoTimestamp(manifest.tracks[source].startedAt, `${source}.startedAt`);
    canonicalIsoTimestamp(manifest.tracks[source].endedAt, `${source}.endedAt`);
  }
}

function completedAtForRecovery(manifest, inspectedTracks) {
  const knownTimes = [
    manifest.createdAt,
    manifest.closedAt,
    manifest.tracks.microphone.endedAt,
    manifest.tracks.system.endedAt,
  ]
    .filter((value) => value !== null)
    .map((value) => Date.parse(value));
  knownTimes.push(inspectedTracks.microphone.mtimeMs, inspectedTracks.system.mtimeMs);
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
  const manifest = createManifest(parsed, parsed.state);
  validateManifestIdentityAndTimes(manifest);
  if (manifest.tracks.microphone.fileName === manifest.tracks.system.fileName) {
    throw new TypeError("obě stopy nesmějí být tentýž soubor");
  }
  const trackPaths = Object.fromEntries(["microphone", "system"].map((source) => [
    source,
    recoveredTrackPath(recordingsDirectory, manifest.tracks[source].fileName),
  ]));
  const inspectedTracks = Object.fromEntries(await Promise.all(
    ["microphone", "system"].map(async (source) => [
      source,
      await inspectStableTrack(trackPaths[source]),
    ]),
  ));
  for (const source of ["microphone", "system"]) {
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
  const uploadManifest = createManifest({
    clientRecordingId: manifest.clientRecordingId,
    closedAt,
    createdAt: manifest.createdAt,
    tracks: Object.fromEntries(["microphone", "system"].map((source) => [source, {
      ...manifest.tracks[source],
      endedAt: manifest.tracks[source].endedAt ?? closedAt,
      sha256: inspectedTracks[source].sha256,
      sizeBytes: inspectedTracks[source].sizeBytes,
      startedAt: manifest.tracks[source].startedAt ?? manifest.createdAt,
    }])),
  }, "complete");
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
    createManifest(existingRaw, existingRaw.state);
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
      "processNext",
      "reduceQueueForRenderer",
    ]) {
      if (typeof queueModule[name] !== "function") {
        throw new TypeError(`modul fronty nemá funkci ${name}`);
      }
    }
    return queueModule;
  }

  async function ensureLoaded() {
    if (!loaded) {
      currentQueue = await loadQueue(filePath);
      loaded = true;
    }
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
  }

  function enqueueRecording(recording) {
    return serialize(async () => {
      const queueModule = await loadQueueModule();
      const result = queueModule.enqueueRecording(await ensureLoaded(), recording);
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

  async function processOne(killswitches) {
    const queueModule = await loadQueueModule();
    const before = await ensureLoaded();
    const result = await queueModule.processNext(before, killswitches, send);
    if (result.queue !== before) await commit(result.queue);
    return { queueModule, result };
  }

  function pump(killswitches) {
    return serialize(async () => (await processOne(killswitches)).result);
  }

  function list() {
    return serialize(async () => {
      const queueModule = await loadQueueModule();
      return queueModule.reduceQueueForRenderer(await ensureLoaded());
    });
  }

  function retry(killswitches) {
    return serialize(async () => {
      const queueModule = await loadQueueModule();
      const queue = await ensureLoaded();
      let changed = false;
      const items = queue.items.map((item) => {
        if (item.state !== "ceka" || item.nextAttemptAt === null) return item;
        changed = true;
        return { ...item, nextAttemptAt: null };
      });
      if (changed) await commit({ ...queue, items });

      const { result } = await processOne(killswitches);
      return {
        outcome: result.outcome,
        reason: result.reason,
        items: queueModule.reduceQueueForRenderer(currentQueue),
      };
    });
  }

  return Object.freeze({ enqueueRecording, enqueueTimeEntry, list, pump, retry });
}

module.exports = {
  createOutboundQueueStore,
  loadQueue,
  recoverOrphanedRecordings,
  saveQueueAtomically,
};
