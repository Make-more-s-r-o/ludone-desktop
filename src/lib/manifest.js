import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const MANIFEST_SCHEMA_VERSION = 1;
export const MANIFEST_STATES = Object.freeze(["recording", "complete", "incomplete"]);
export const MANIFEST_TRACK_KINDS = Object.freeze(["microphone", "system"]);

function requireNonEmptyString(value, field) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${field} musí být neprázdný řetězec`);
  }
  return value;
}

function requireTimestampOrNull(value, field) {
  if (value === null) return null;
  requireNonEmptyString(value, field);
  if (!Number.isFinite(Date.parse(value))) {
    throw new TypeError(`${field} musí být platná časová značka`);
  }
  return value;
}

function normalizeTrack(track, kind) {
  if (!track || typeof track !== "object" || Array.isArray(track)) {
    throw new TypeError(`tracks.${kind} musí být objekt`);
  }
  if (!Number.isSafeInteger(track.sizeBytes) || track.sizeBytes < 0) {
    throw new TypeError(`tracks.${kind}.sizeBytes musí být nezáporné celé číslo`);
  }
  if (track.sha256 !== null && !/^[a-f0-9]{64}$/.test(track.sha256)) {
    throw new TypeError(`tracks.${kind}.sha256 musí být SHA-256 nebo null`);
  }

  return {
    endedAt: requireTimestampOrNull(track.endedAt, `tracks.${kind}.endedAt`),
    fileName: requireNonEmptyString(track.fileName, `tracks.${kind}.fileName`),
    sha256: track.sha256,
    sizeBytes: track.sizeBytes,
    startedAt: requireTimestampOrNull(track.startedAt, `tracks.${kind}.startedAt`),
  };
}

function normalizeTracks(tracks) {
  if (!tracks || typeof tracks !== "object" || Array.isArray(tracks)) {
    throw new TypeError("tracks musí být objekt");
  }
  const keys = Object.keys(tracks).sort();
  const expectedKeys = [...MANIFEST_TRACK_KINDS].sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    throw new TypeError("manifest musí obsahovat právě stopy microphone a system");
  }
  return {
    microphone: normalizeTrack(tracks.microphone, "microphone"),
    system: normalizeTrack(tracks.system, "system"),
  };
}

/**
 * Sestaví manifest schématu v1. Stav je samostatný povinný argument, aby ho
 * žádný volající nemohl nechtěně získat implicitním defaultem.
 */
export function createManifest(metadata, state) {
  if (!MANIFEST_STATES.includes(state)) {
    throw new TypeError("state musí být recording, complete nebo incomplete");
  }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new TypeError("metadata manifestu musí být objekt");
  }

  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    clientRecordingId: requireNonEmptyString(metadata.clientRecordingId, "clientRecordingId"),
    createdAt: requireTimestampOrNull(metadata.createdAt, "createdAt"),
    closedAt: requireTimestampOrNull(metadata.closedAt, "closedAt"),
    state,
    tracks: normalizeTracks(metadata.tracks),
  };
  if (state === "complete" && manifest.closedAt === null) {
    throw new TypeError("complete manifest musí mít closedAt");
  }
  return manifest;
}

/** Povolený stavový automat manifestu: recording končí complete nebo incomplete. */
export function transitionManifest(manifest, nextState, updates = {}) {
  if (!manifest || manifest.state !== "recording") {
    throw new Error("přejít lze jen z manifestu ve stavu recording");
  }
  if (nextState !== "complete" && nextState !== "incomplete") {
    throw new Error("recording lze uzavřít jen jako complete nebo incomplete");
  }
  return createManifest({
    clientRecordingId: manifest.clientRecordingId,
    createdAt: manifest.createdAt,
    closedAt: Object.hasOwn(updates, "closedAt") ? updates.closedAt : manifest.closedAt,
    tracks: Object.hasOwn(updates, "tracks") ? updates.tracks : manifest.tracks,
  }, nextState);
}

function sortJsonValue(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("kanonický JSON nepodporuje neplatná čísla");
    return value;
  }
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined) {
        throw new TypeError("kanonický JSON nepodporuje undefined");
      }
      sorted[key] = sortJsonValue(value[key]);
    }
    return sorted;
  }
  throw new TypeError(`kanonický JSON nepodporuje typ ${typeof value}`);
}

/** UTF-8 obsah bez BOM, odřádkování a nevýznamových mezer. */
export function canonicalJson(value) {
  return JSON.stringify(sortJsonValue(value));
}

export function manifestSha256(manifest) {
  return createHash("sha256").update(canonicalJson(manifest), "utf8").digest("hex");
}

/** Atomický zápis ve stejném adresáři: dočasný soubor, fsync a rename. */
export async function writeManifestAtomically(filePath, manifest) {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await fs.promises.open(temporaryPath, "wx", 0o600);
    await handle.writeFile(canonicalJson(manifest), "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.promises.rename(temporaryPath, filePath);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fs.promises.unlink(temporaryPath).catch(() => {});
    throw error;
  }

  // Název dočasného souboru je ve stejném adresáři; rename proto zůstává atomický.
  return path.resolve(filePath);
}
