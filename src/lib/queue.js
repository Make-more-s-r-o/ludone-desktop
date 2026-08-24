export const QUEUE_SCHEMA_VERSION = 1;

export const QUEUE_STATES = Object.freeze({
  WAITING: "ceka",
  SENDING: "odesila",
  SENT: "odeslano",
  FAILED: "selhalo",
});

export const UPLOAD_DISABLED_REASON = "odesílání je vypnuté";

export const DEFAULT_RETRY_POLICY = Object.freeze({
  baseDelayMs: 30_000,
  maxDelayMs: 6 * 60 * 60 * 1_000,
  maxAttempts: 5,
  jitterRatio: 0.2,
});

function requireObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${field} musí být objekt`);
  }
  return value;
}

function requireNonEmptyString(value, field) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${field} musí být neprázdný řetězec`);
  }
  return value;
}

function requireQueue(queue) {
  requireObject(queue, "queue");
  if (queue.schemaVersion !== QUEUE_SCHEMA_VERSION || !Array.isArray(queue.items)) {
    throw new TypeError("queue musí odpovídat schématu fronty v1");
  }
  return queue;
}

function normalizeTrackPaths(trackPaths) {
  requireObject(trackPaths, "trackPaths");
  const keys = Object.keys(trackPaths).sort();
  if (keys.length !== 2 || keys[0] !== "microphone" || keys[1] !== "system") {
    throw new TypeError("trackPaths musí obsahovat právě stopy microphone a system");
  }
  return {
    microphone: requireNonEmptyString(trackPaths.microphone, "trackPaths.microphone"),
    system: requireNonEmptyString(trackPaths.system, "trackPaths.system"),
  };
}

function validateManifest(manifest) {
  requireObject(manifest, "manifest");
  requireNonEmptyString(manifest.clientRecordingId, "manifest.clientRecordingId");
  requireObject(manifest.tracks, "manifest.tracks");
  if (!manifest.tracks.microphone || !manifest.tracks.system) {
    throw new TypeError("manifest musí odkazovat na stopy microphone a system");
  }
  return manifest;
}

function timestamp(value, field) {
  const milliseconds = value instanceof Date ? value.getTime() : value;
  if (!Number.isFinite(milliseconds)) {
    throw new TypeError(`${field} musí být platný čas v milisekundách`);
  }
  return milliseconds;
}

function normalizeRetryPolicy(overrides = {}) {
  const policy = { ...DEFAULT_RETRY_POLICY, ...overrides };
  for (const field of ["baseDelayMs", "maxDelayMs", "maxAttempts"]) {
    if (!Number.isSafeInteger(policy[field]) || policy[field] <= 0) {
      throw new TypeError(`${field} musí být kladné celé číslo`);
    }
  }
  if (policy.maxDelayMs < policy.baseDelayMs) {
    throw new TypeError("maxDelayMs nesmí být menší než baseDelayMs");
  }
  if (typeof policy.jitterRatio !== "number" || policy.jitterRatio < 0 || policy.jitterRatio > 1) {
    throw new TypeError("jitterRatio musí být číslo od 0 do 1");
  }
  return policy;
}

function errorReason(error) {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function replaceItem(queue, index, item) {
  const items = [...queue.items];
  items[index] = item;
  return { ...queue, items };
}

function requireUploadedBytes(uploadedBytes) {
  requireObject(uploadedBytes, "uploadedBytes");
  for (const kind of ["microphone", "system"]) {
    if (!Number.isSafeInteger(uploadedBytes[kind]) || uploadedBytes[kind] < 0) {
      throw new TypeError(`uploadedBytes.${kind} musí být nezáporné celé číslo`);
    }
  }
  return {
    microphone: uploadedBytes.microphone,
    system: uploadedBytes.system,
  };
}

/** Vytvoří prázdnou, serializovatelnou frontu. */
export function createQueue() {
  return { schemaVersion: QUEUE_SCHEMA_VERSION, items: [] };
}

/**
 * Zařadí uzavřený manifest a cesty k oběma stopám. Identita manifestu je
 * současně idempotency key; opakované zařazení proto vrátí původní položku.
 */
export function enqueueRecording(queue, recording, now = Date.now()) {
  requireQueue(queue);
  requireObject(recording, "recording");
  const manifest = validateManifest(recording.manifest);
  const manifestPath = requireNonEmptyString(recording.manifestPath, "manifestPath");
  const tracks = normalizeTrackPaths(recording.trackPaths);
  const existing = queue.items.find(
    (item) => item.clientRecordingId === manifest.clientRecordingId,
  );
  if (existing) return { added: false, item: existing, queue };

  const item = {
    attempts: 0,
    clientRecordingId: manifest.clientRecordingId,
    enqueuedAt: new Date(timestamp(now, "now")).toISOString(),
    lastFailureReason: null,
    manifestPath,
    nextAttemptAt: null,
    sentAt: null,
    server: {
      recordingId: null,
      uploadedBytes: { microphone: 0, system: 0 },
    },
    state: QUEUE_STATES.WAITING,
    tracks,
  };
  return {
    added: true,
    item,
    queue: { ...queue, items: [...queue.items, item] },
  };
}

/**
 * Přepíše lokální postup hodnotami potvrzenými serverem. Offsety se záměrně
 * nepřičítají ani neporovnávají s lokálním odhadem: server je zdroj pravdy.
 */
export function applyServerProgress(queue, clientRecordingId, serverProgress) {
  requireQueue(queue);
  requireNonEmptyString(clientRecordingId, "clientRecordingId");
  requireObject(serverProgress, "serverProgress");
  const recordingId = requireNonEmptyString(serverProgress.recordingId, "serverProgress.recordingId");
  const uploadedBytes = requireUploadedBytes(serverProgress.uploadedBytes);
  const index = queue.items.findIndex((item) => item.clientRecordingId === clientRecordingId);
  if (index === -1) throw new Error("položka fronty nebyla nalezena");

  const item = {
    ...queue.items[index],
    server: { recordingId, uploadedBytes },
  };
  return { item, queue: replaceItem(queue, index, item) };
}

/** Exponenciální prodleva s kladným jitterem a pevným stropem. */
export function retryDelayMs(attempts, retryPolicy = {}, random = Math.random) {
  if (!Number.isSafeInteger(attempts) || attempts <= 0) {
    throw new TypeError("attempts musí být kladné celé číslo");
  }
  if (typeof random !== "function") throw new TypeError("random musí být funkce");
  const policy = normalizeRetryPolicy(retryPolicy);
  const randomValue = random();
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue > 1) {
    throw new TypeError("random musí vracet číslo od 0 do 1");
  }
  const exponential = policy.baseDelayMs * (2 ** (attempts - 1));
  return Math.min(
    policy.maxDelayMs,
    Math.round(exponential * (1 + randomValue * policy.jitterRatio)),
  );
}

/**
 * Zpracuje nejvýše jednu připravenou položku. Killswitch je povinný argument
 * a povoluje odesílací vrstvu výhradně při přesné řetězcové hodnotě "true".
 */
export async function processNext(queue, uploadEnabled, send, options = {}) {
  requireQueue(queue);
  if (arguments.length < 3) {
    throw new TypeError("queue, uploadEnabled a send jsou povinné argumenty");
  }
  if (typeof send !== "function") throw new TypeError("send musí být funkce");

  if (uploadEnabled !== "true") {
    return { item: null, outcome: "disabled", queue, reason: UPLOAD_DISABLED_REASON };
  }

  const now = timestamp(options.now ?? Date.now(), "options.now");
  const index = queue.items.findIndex((item) => (
    item.state === QUEUE_STATES.WAITING
      && (item.nextAttemptAt === null || item.nextAttemptAt <= now)
  ));
  if (index === -1) {
    return { item: null, outcome: "idle", queue, reason: "žádná položka není připravená" };
  }

  const policy = normalizeRetryPolicy(options.retryPolicy);
  const sendingItem = {
    ...queue.items[index],
    attempts: queue.items[index].attempts + 1,
    state: QUEUE_STATES.SENDING,
  };
  const sendingQueue = replaceItem(queue, index, sendingItem);

  try {
    await send(sendingItem);
    const sentItem = {
      ...sendingItem,
      lastFailureReason: null,
      nextAttemptAt: null,
      sentAt: new Date(now).toISOString(),
      state: QUEUE_STATES.SENT,
    };
    return {
      item: sentItem,
      outcome: "sent",
      queue: replaceItem(sendingQueue, index, sentItem),
      reason: null,
    };
  } catch (error) {
    const exhausted = sendingItem.attempts >= policy.maxAttempts;
    const failedItem = {
      ...sendingItem,
      lastFailureReason: errorReason(error),
      nextAttemptAt: exhausted
        ? null
        : now + retryDelayMs(sendingItem.attempts, policy, options.random),
      state: exhausted ? QUEUE_STATES.FAILED : QUEUE_STATES.WAITING,
    };
    return {
      item: failedItem,
      outcome: exhausted ? "failed" : "retry_scheduled",
      queue: replaceItem(sendingQueue, index, failedItem),
      reason: failedItem.lastFailureReason,
    };
  }
}
