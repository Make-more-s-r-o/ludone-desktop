const { createRequester } = require("./upload-client.cjs");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[0-9a-f]{64}$/iu;
const REVISION_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const OWNER_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const TRACKS = Object.freeze(["delivery", "microphone", "system"]);
const CACHE_TTL_MS = 60_000;
const LIMIT_WINDOW_MS = 60 * 60 * 1_000;
const MAX_GETS_PER_WINDOW = 30;
const DEFAULT_RETRY_AFTER_MS = 60 * 60 * 1_000;
const CHUNK_BYTES = 8 * 1024 * 1024;

function contextChangedError() {
  return Object.assign(new Error("Kontext ověření se změnil"), { code: "context_changed" });
}

function normalizedTarget(value) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || typeof value.id !== "string"
    || !UUID_PATTERN.test(value.id)
    || typeof value.revision !== "string"
    || !REVISION_PATTERN.test(value.revision)
    || typeof value.ownerFingerprint !== "string"
    || !OWNER_PATTERN.test(value.ownerFingerprint)
    || !value.tracks
    || typeof value.tracks !== "object"
    || Array.isArray(value.tracks)
  ) {
    throw new TypeError("Trusted target ověření má neplatný tvar");
  }
  const names = Object.keys(value.tracks);
  if (
    names.length < 1
    || names.length > 2
    || names.some((name) => !TRACKS.includes(name))
    || (names.includes("delivery") && names.length !== 1)
  ) {
    throw new TypeError("Trusted target má neplatné stopy");
  }
  const tracks = {};
  for (const name of TRACKS) {
    if (!Object.prototype.hasOwnProperty.call(value.tracks, name)) continue;
    const track = value.tracks[name];
    if (
      !track
      || typeof track !== "object"
      || Array.isArray(track)
      || (track.recordingId !== null
        && (typeof track.recordingId !== "string" || !UUID_PATTERN.test(track.recordingId)))
      || !Number.isSafeInteger(track.declaredBytes)
      || track.declaredBytes < 0
      || (track.recordingId === null
        ? track.sha256 !== null
          && (typeof track.sha256 !== "string" || !SHA256_PATTERN.test(track.sha256))
        : typeof track.sha256 !== "string" || !SHA256_PATTERN.test(track.sha256))
    ) {
      throw new TypeError(`Trusted target má neplatnou stopu ${name}`);
    }
    tracks[name] = Object.freeze({
      recordingId: track.recordingId,
      declaredBytes: track.declaredBytes,
      sha256: typeof track.sha256 === "string" ? track.sha256.toLowerCase() : null,
    });
  }
  return Object.freeze({
    id: value.id,
    ownerFingerprint: value.ownerFingerprint,
    revision: value.revision,
    tracks: Object.freeze(tracks),
  });
}

function normalizedContext(value, ownerFingerprint) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  let issuer;
  try {
    issuer = new URL(value.issuer);
  } catch {
    return null;
  }
  if (
    issuer.protocol !== "https:"
    || issuer.username !== ""
    || issuer.password !== ""
    || issuer.pathname !== "/"
    || issuer.search !== ""
    || issuer.hash !== ""
    || issuer.origin !== value.issuer
    || value.resource !== `${issuer.origin}/api/mcp`
    || value.scope !== "nahravky:upload"
    || typeof value.accessToken !== "string"
    || value.accessToken.trim().length === 0
    || !Number.isSafeInteger(value.generation)
    || value.generation < 0
    || !OWNER_PATTERN.test(value.ownerFingerprint)
    || value.ownerFingerprint !== ownerFingerprint
  ) return null;
  return Object.freeze({
    accessToken: value.accessToken,
    generation: value.generation,
    issuer: issuer.origin,
    ownerFingerprint: value.ownerFingerprint,
    resource: value.resource,
    scope: value.scope,
  });
}

function statusResult(status, mismatchFields = []) {
  return Object.freeze({ status, mismatchFields: Object.freeze(mismatchFields) });
}

function resultForAll(target, status, verifiedAt) {
  return Object.freeze({
    id: target.id,
    revision: target.revision,
    tracks: Object.freeze(Object.fromEntries(
      Object.keys(target.tracks).map((track) => [track, statusResult(
        target.tracks[track].recordingId === null ? "not_verified" : status,
      )]),
    )),
    verifiedAt,
  });
}

function classifyPayload(payload, localTrack) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return statusResult("invalid_response");
  }
  if (
    !["stored", "normalized", "uploading", "failed"].includes(payload.state)
    ||
    !Array.isArray(payload.missing)
    || !Number.isSafeInteger(payload.declaredBytes)
    || payload.declaredBytes <= 0
    || typeof payload.sha256 !== "string"
    || !SHA256_PATTERN.test(payload.sha256)
  ) return statusResult("invalid_response");
  const chunkCount = Math.ceil(payload.declaredBytes / CHUNK_BYTES);
  const missing = new Set();
  for (const index of payload.missing) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= chunkCount || missing.has(index)) {
      return statusResult("invalid_response");
    }
    missing.add(index);
  }
  if (payload.state === "uploading") return statusResult("incomplete");
  if (payload.state === "failed") return statusResult("server_failed");
  const mismatchFields = [];
  if (payload.declaredBytes !== localTrack.declaredBytes) mismatchFields.push("declared_bytes");
  if (payload.sha256.toLowerCase() !== localTrack.sha256) mismatchFields.push("sha256");
  if (missing.size > 0) mismatchFields.push("missing_chunks");
  return mismatchFields.length > 0
    ? statusResult("mismatch", mismatchFields)
    : statusResult("complete");
}

function errorStatus(error) {
  if (error?.status === 404) return "not_found_for_account";
  if (error?.status === 401 || error?.status === 403) return "auth_error";
  if (error?.status === 429) return "rate_limited";
  return "network_error";
}

function createRecordingVerifier({ fetchImpl, getContext, isContextCurrent, now = Date.now }) {
  if (typeof fetchImpl !== "function" || typeof getContext !== "function"
    || typeof isContextCurrent !== "function" || typeof now !== "function") {
    throw new TypeError("Verifier vyžaduje fetch, kontext, current guard a hodiny");
  }
  const cache = new Map();
  const inFlight = new Map();
  const requestTimes = [];
  let reservedGets = 0;
  // Serverový cooldown je oddělený od cache. invalidate jej záměrně nemaže.
  const retryAtByOwner = new Map();
  let epoch = 0;

  async function currentOrThrow(context, expectedEpoch) {
    if (expectedEpoch !== epoch) throw contextChangedError();
    const current = await isContextCurrent(context);
    if (expectedEpoch !== epoch || current !== true) throw contextChangedError();
  }

  function pruneRequests(timestamp) {
    while (requestTimes.length > 0 && requestTimes[0] <= timestamp - LIMIT_WINDOW_MS) {
      requestTimes.shift();
    }
  }

  function reserveRequests(count, timestamp) {
    pruneRequests(timestamp);
    if (requestTimes.length + reservedGets + count > MAX_GETS_PER_WINDOW) return false;
    reservedGets += count;
    return true;
  }

  async function verify(targetValue) {
    const target = normalizedTarget(targetValue);
    const expectedEpoch = epoch;
    let rawContext;
    try {
      rawContext = await getContext();
    } catch {
      return resultForAll(target, "auth_error", new Date(now()).toISOString());
    }
    const context = normalizedContext(rawContext, target.ownerFingerprint);
    if (context === null) {
      return resultForAll(target, "auth_error", new Date(now()).toISOString());
    }
    await currentOrThrow(context, expectedEpoch);

    const key = JSON.stringify([
      context.generation, context.issuer, context.ownerFingerprint, target.id, target.revision,
      ...TRACKS.filter((name) => target.tracks[name]).map((name) => [
        name,
        target.tracks[name].recordingId,
        target.tracks[name].sha256,
        target.tracks[name].declaredBytes,
      ]),
    ]);
    const cached = cache.get(key);
    const cacheCheckAt = now();
    if (cached && cached.expiresAt > cacheCheckAt) {
      await currentOrThrow(context, expectedEpoch);
      return cached.result;
    }
    if (cached) cache.delete(key);
    const pending = inFlight.get(key);
    if (pending) return pending;

    const operation = (async () => {
      const knownTracks = TRACKS.filter((name) => (
        target.tracks[name]
        && typeof target.tracks[name].recordingId === "string"
        && UUID_PATTERN.test(target.tracks[name].recordingId)
      ));
      if (knownTracks.length === 0) {
        return resultForAll(target, "not_verified", new Date(now()).toISOString());
      }
      const ownerKey = `${context.issuer}\n${context.ownerFingerprint}`;
      const requestStartAt = now();
      const retryAt = retryAtByOwner.get(ownerKey) ?? 0;
      if (retryAt > requestStartAt) {
        return resultForAll(target, "rate_limited", new Date(requestStartAt).toISOString());
      }
      if (!reserveRequests(knownTracks.length, requestStartAt)) {
        return resultForAll(target, "local_rate_limited", new Date(requestStartAt).toISOString());
      }
      let unusedReservations = knownTracks.length;

      const request = createRequester({
        accessToken: context.accessToken,
        fetchImpl,
        origin: context.issuer,
        requestTimeoutMs: 120_000,
      });
      const tracks = {};
      let stoppedBy429 = false;
      try {
        for (const trackName of TRACKS) {
          const localTrack = target.tracks[trackName];
          if (!localTrack) continue;
          if (localTrack.recordingId === null) {
            tracks[trackName] = statusResult("not_verified");
            continue;
          }
          if (stoppedBy429 || (retryAtByOwner.get(ownerKey) ?? 0) > now()) {
            tracks[trackName] = statusResult("rate_limited");
            stoppedBy429 = true;
            continue;
          }
          await currentOrThrow(context, expectedEpoch);
          if ((retryAtByOwner.get(ownerKey) ?? 0) > now()) {
            tracks[trackName] = statusResult("rate_limited");
            stoppedBy429 = true;
            continue;
          }
          unusedReservations -= 1;
          reservedGets -= 1;
          const actualGetAt = now();
          pruneRequests(actualGetAt);
          requestTimes.push(actualGetAt);
          try {
            const payload = await request(`/api/nahravky/uploads/${localTrack.recordingId}`);
            await currentOrThrow(context, expectedEpoch);
            tracks[trackName] = classifyPayload(payload, localTrack);
          } catch (error) {
            const status = errorStatus(error);
            if (status === "rate_limited") {
              const retryAfterMs = Number.isFinite(error?.retryAfterMs) && error.retryAfterMs > 0
                ? error.retryAfterMs
                : DEFAULT_RETRY_AFTER_MS;
              retryAtByOwner.set(ownerKey, now() + retryAfterMs);
              stoppedBy429 = true;
            }
            await currentOrThrow(context, expectedEpoch);
            tracks[trackName] = statusResult(status);
          }
        }
      } finally {
        reservedGets -= unusedReservations;
      }
      await currentOrThrow(context, expectedEpoch);
      const verifiedAtMs = now();
      const verifiedAt = new Date(verifiedAtMs).toISOString();
      const result = Object.freeze({
        id: target.id,
        revision: target.revision,
        tracks: Object.freeze(tracks),
        verifiedAt,
      });
      if (!stoppedBy429) cache.set(key, { expiresAt: verifiedAtMs + CACHE_TTL_MS, result });
      return result;
    })();
    inFlight.set(key, operation);
    try {
      return await operation;
    } finally {
      if (inFlight.get(key) === operation) inFlight.delete(key);
    }
  }

  function invalidate() {
    epoch += 1;
    cache.clear();
    inFlight.clear();
  }

  return Object.freeze({ invalidate, verify });
}

module.exports = { createRecordingVerifier };
