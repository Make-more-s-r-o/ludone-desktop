const { createHash } = require("node:crypto");
const { constants: fsConstants } = require("node:fs");
const { lstat, open, unlink } = require("node:fs/promises");
const path = require("node:path");

const DAY_MS = 24 * 60 * 60 * 1_000;
const HASH_BUFFER_BYTES = 1024 * 1024;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

const RETENTION_POLICIES = Object.freeze({
  IHNED: "Ihned smazat",
  HODINY_24: "24 hodin po odeslání",
  DNI_7: "7 dní po odeslání",
  DNI_30: "30 dní po odeslání",
  NEMAZAT: "Nemazat",
});

/**
 * @param {unknown} policy
 * @returns {number | null}
 */
function retentionMs(policy) {
  switch (policy) {
    case RETENTION_POLICIES.IHNED:
      return 0;
    case RETENTION_POLICIES.HODINY_24:
      return DAY_MS;
    case RETENTION_POLICIES.DNI_7:
      return 7 * DAY_MS;
    case RETENTION_POLICIES.DNI_30:
      return 30 * DAY_MS;
    case RETENTION_POLICIES.NEMAZAT:
    default:
      return null;
  }
}

/**
 * @param {unknown} tracks
 * @returns {[string, string] | null}
 */
function trackFiles(tracks) {
  if (!tracks || typeof tracks !== "object" || Array.isArray(tracks)) return null;
  const values = /** @type {Record<string, unknown>} */ (tracks);
  if (typeof values.microphone !== "string" || typeof values.system !== "string") return null;
  return [values.microphone, values.system];
}

function safeErrorCode(error) {
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
  return new Set(["EACCES", "EBUSY", "EIO", "EISDIR", "ENOENT", "ENOSPC", "ENOTDIR", "EPERM"])
    .has(code) ? code : "IO_ERROR";
}

function isImmediateChild(root, candidate) {
  return typeof candidate === "string"
    && path.isAbsolute(candidate)
    && path.dirname(path.resolve(candidate)) === root;
}

async function readRegularJson(filePath) {
  const noFollow = fsConstants.O_NOFOLLOW ?? 0;
  const handle = await open(filePath, fsConstants.O_RDONLY | noFollow);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size < 1 || before.size > MAX_MANIFEST_BYTES) {
      throw Object.assign(new Error("Neplatný manifest"), { code: "EINVAL" });
    }
    const serialized = await handle.readFile("utf8");
    const after = await handle.stat();
    if (
      before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs
      || before.ctimeMs !== after.ctimeMs
    ) {
      throw Object.assign(new Error("Manifest se během čtení změnil"), { code: "EAGAIN" });
    }
    return JSON.parse(serialized);
  } finally {
    await handle.close();
  }
}

function sameFileStats(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

async function inspectTrackForDeletion(filePath, declared, source) {
  if (
    !declared
    || !Number.isSafeInteger(declared.sizeBytes)
    || declared.sizeBytes < 0
    || typeof declared.sha256 !== "string"
    || !SHA256_PATTERN.test(declared.sha256)
  ) {
    return { ok: false, error: { code: "MANIFEST_MISMATCH", source } };
  }

  const noFollow = fsConstants.O_NOFOLLOW ?? 0;
  let handle;
  try {
    handle = await open(filePath, fsConstants.O_RDONLY | noFollow);
  } catch (error) {
    const code = safeErrorCode(error);
    if (code === "ENOENT") return { ok: true, missing: true };
    return { ok: false, error: { code, source } };
  }

  try {
    const before = await handle.stat();
    if (!before.isFile()) return { ok: false, error: { code: "UNSAFE_TRACK", source } };
    if (before.size !== declared.sizeBytes) {
      return { ok: false, error: { code: "TRACK_SIZE_MISMATCH", source } };
    }

    const hash = createHash("sha256");
    let position = 0;
    while (position < before.size) {
      const buffer = Buffer.allocUnsafe(Math.min(HASH_BUFFER_BYTES, before.size - position));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      if (bytesRead === 0) {
        return { ok: false, error: { code: "TRACK_CHANGED", source } };
      }
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }

    const after = await handle.stat();
    const current = await lstat(filePath);
    if (
      !current.isFile()
      || current.isSymbolicLink()
      || !sameFileStats(before, after)
      || !sameFileStats(after, current)
    ) {
      return { ok: false, error: { code: "TRACK_CHANGED", source } };
    }
    if (hash.digest("hex") !== declared.sha256) {
      return { ok: false, error: { code: "TRACK_HASH_MISMATCH", source } };
    }
    return { ok: true, missing: false, stats: after };
  } catch (error) {
    return { ok: false, error: { code: safeErrorCode(error), source } };
  } finally {
    await handle.close().catch(() => {});
  }
}

async function trackStillMatches(filePath, inspected) {
  try {
    const current = await lstat(filePath);
    return !inspected.missing
      && current.isFile()
      && !current.isSymbolicLink()
      && sameFileStats(inspected.stats, current);
  } catch (error) {
    return inspected.missing && safeErrorCode(error) === "ENOENT";
  }
}

async function verifyDeletionCandidate(candidate, recordingsRoot) {
  const item = candidate.item;
  if (
    !recordingsRoot
    || item.recoveredIncomplete === true
    || typeof item.sourceManifestPath === "string"
    || !isImmediateChild(recordingsRoot, item.manifestPath)
    || !item.manifestPath.endsWith(".manifest.json")
    // 🔴 OBRANA DO HLOUBKY — odstranění TÉHLE řádky testy nezčervená, a je to v pořádku.
    // Zkoušeno 3. 9. pěti způsoby (cizí soubor, vnořený adresář, shodné jméno, bajtově
    // shodná kopie mimo kořen, i s předaným `recordingsDirectory`). Pokaždé zelená,
    // protože tytéž případy odmítne dřív kontrola identity manifestu, shody jmen,
    // velikosti a otisku. Řádku NEODSTRAŇUJ: chrání případ, kdy by někdo podvrhl
    // frontu i manifest tak, že projdou — pak je umístění poslední, co zbývá.
    || !candidate.files.every((filePath) => isImmediateChild(recordingsRoot, filePath))
    || candidate.files[0] === candidate.files[1]
  ) {
    return { ok: false, error: { code: "UNVERIFIED_RECORDING" } };
  }

  let manifest;
  try {
    const manifestStats = await lstat(item.manifestPath);
    if (!manifestStats.isFile() || manifestStats.isSymbolicLink()) {
      return { ok: false, error: { code: "UNVERIFIED_RECORDING" } };
    }
    manifest = await readRegularJson(item.manifestPath);
  } catch (error) {
    return { ok: false, error: { code: safeErrorCode(error) } };
  }

  if (
    !manifest
    || manifest.schemaVersion !== 1
    || manifest.state !== "complete"
    || manifest.clientRecordingId !== item.clientRecordingId
    || manifest.tracks?.microphone?.fileName !== path.basename(candidate.files[0])
    || manifest.tracks?.system?.fileName !== path.basename(candidate.files[1])
    || manifest.tracks.microphone.fileName === manifest.tracks.system.fileName
  ) {
    return { ok: false, error: { code: "MANIFEST_MISMATCH" } };
  }

  const sources = ["microphone", "system"];
  const inspectedTracks = await Promise.all(candidate.files.map((filePath, index) => (
    inspectTrackForDeletion(filePath, manifest.tracks[sources[index]], sources[index])
  )));
  const failedTrack = inspectedTracks.find((track) => !track.ok);
  if (failedTrack) {
    return { ok: false, error: failedTrack.error };
  }
  return { ok: true, inspectedTracks };
}

/**
 * Přijímá jen tvar, který do fronty zapisuje `Date#toISOString`.
 * @param {unknown} value
 * @returns {number | null}
 */
function canonicalTimestampMs(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  return new Date(milliseconds).toISOString() === value ? milliseconds : null;
}

/**
 * @param {{ items?: Array<Record<string, unknown>> }} queue
 * @param {unknown} policy
 * @param {number | Date} now
 */
function planRetention(queue, policy, now) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const limit = retentionMs(policy);
  const nowMs = now instanceof Date ? now.getTime() : now;
  if (limit === null || !Number.isFinite(nowMs)) {
    return { toDelete: [], kept: [...items] };
  }

  const toDelete = [];
  const kept = [];
  for (const item of items) {
    const sentAtMs = canonicalTimestampMs(item.sentAt);
    const files = trackFiles(item.tracks);
    const isRecording = item.kind === "recording" || item.kind === undefined;
    if (
      isRecording
      && item.state === "odeslano"
      // Násilně ukončený WebM může mít správný hash, ale nemusí být přehratelný.
      // Lokální originál proto zůstává, dokud jeho smazání výslovně nerozhodne člověk.
      && item.recoveredIncomplete !== true
      && Number.isFinite(sentAtMs)
      && files !== null
      && nowMs - sentAtMs >= limit
    ) {
      toDelete.push({ item, files });
    } else {
      kept.push(item);
    }
  }

  return {
    toDelete,
    kept,
  };
}

/**
 * @param {{ queue: { items?: Array<Record<string, unknown>> }, policy: unknown, now: number | Date, recordingsDirectory?: string }} options
 */
async function applyRetention({ queue, policy, now, recordingsDirectory }) {
  const plan = planRetention(queue, policy, now);
  const deletedFiles = [];
  const deletedItems = [];
  const errors = [];
  let recordingsRoot = null;
  if (typeof recordingsDirectory === "string" && path.isAbsolute(recordingsDirectory)) {
    try {
      const rootStats = await lstat(recordingsDirectory);
      if (rootStats.isDirectory() && !rootStats.isSymbolicLink()) {
        recordingsRoot = path.resolve(recordingsDirectory);
      }
    } catch {
      // Neexistující nebo nečitelný kořen znamená pouze zákaz mazání.
    }
  }

  for (const candidate of plan.toDelete) {
    const verified = await verifyDeletionCandidate(candidate, recordingsRoot);
    if (!verified.ok) {
      errors.push(verified.error);
      continue;
    }
    const stillMatches = await Promise.all(candidate.files.map((filePath, index) => (
      trackStillMatches(filePath, verified.inspectedTracks[index])
    )));
    const changedIndex = stillMatches.findIndex((matches) => !matches);
    if (changedIndex !== -1) {
      errors.push({
        code: "TRACK_CHANGED",
        source: changedIndex === 0 ? "microphone" : "system",
      });
      continue;
    }
    let itemFailed = false;
    for (let index = 0; index < candidate.files.length; index += 1) {
      if (verified.inspectedTracks[index].missing) continue;
      const filePath = candidate.files[index];
      try {
        await unlink(filePath);
        deletedFiles.push(filePath);
      } catch (error) {
        const code = safeErrorCode(error);
        if (code !== "ENOENT") {
          itemFailed = true;
          errors.push({ code, source: index === 0 ? "microphone" : "system" });
        }
      }
    }
    if (!itemFailed) deletedItems.push(candidate.item);
  }

  const deleted = new Set(deletedItems);
  const items = Array.isArray(queue?.items) ? queue.items : [];
  return {
    deletedFiles,
    deletedItems,
    keptItems: items.filter((item) => !deleted.has(item)),
    errors,
  };
}

module.exports = {
  RETENTION_POLICIES,
  retentionMs,
  planRetention,
  applyRetention,
};
