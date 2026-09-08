export const QUEUE_SCHEMA_VERSION = 1;

export const QUEUE_ITEM_KINDS = Object.freeze({
  RECORDING: "recording",
  TIME: "time",
});

export const FAILURE_CLASSES = Object.freeze({
  PERMANENT: "permanent",
  PAUSED: "paused",
  RETRYABLE: "retryable",
});

export const QUEUE_STATES = Object.freeze({
  WAITING: "ceka",
  SENDING: "odesila",
  SENT: "odeslano",
  FAILED: "selhalo",
});

export const UPLOAD_DISABLED_REASON = "odesílání je vypnuté";

const LEGACY_HUMAN_ACTION_FAILURE_REASONS = new Set([
  "Nahrávka patří jinému účtu",
  "Vlastník nahrávky není potvrzený; před odesláním je nutné potvrzení člověkem",
  "Identitu aktuálního přihlášení nelze ověřit",
]);

export const DEFAULT_RETRY_POLICY = Object.freeze({
  baseDelayMs: 30_000,
  maxDelayMs: 6 * 60 * 60 * 1_000,
  maxAttempts: 5,
  jitterRatio: 0.2,
});

const PROJECT_GUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

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

function requireGuid(value, field) {
  requireNonEmptyString(value, field);
  if (!PROJECT_GUID_PATTERN.test(value)) {
    throw new TypeError(`${field} musí být GUID`);
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

function errorFailureClass(error) {
  if (!error || typeof error !== "object") return FAILURE_CLASSES.RETRYABLE;
  if (error.code === "unauthorized" || error.status === 401) return FAILURE_CLASSES.PAUSED;
  if (error.failureClass === FAILURE_CLASSES.PERMANENT) return FAILURE_CLASSES.PERMANENT;
  if (error.failureClass === FAILURE_CLASSES.PAUSED) return FAILURE_CLASSES.PAUSED;
  return FAILURE_CLASSES.RETRYABLE;
}

// 🔴 FAIL-CLOSED pro celou rodinu `*_owner_*`. Původní verze vyjmenovávala konkrétní
// důvody (`mismatch`, `unknown`), takže nový kód — třeba `queue_owner_revoked` — by se
// tiše zařadil mezi obyčejné čekající. A přesně to je vada, kvůli které tahle funkce
// vznikla: položka, která se sama nikdy neodešle, vypadala jako položka, která čeká
// na odeslání. Nový důvod o vlastnictví má být raději vidět zbytečně než schovaný.
function failureCodeRequiresHumanAction(code) {
  if (typeof code !== "string") return false;
  const [source, subject, reason, ...extra] = code.split("_");
  if (extra.length > 0 || subject !== "owner") return false;
  if (typeof reason !== "string" || reason.length === 0) return false;
  return source === "queue" || source === "session";
}

function failureRequiresHumanAction(error) {
  // 🔴 HTTP 401 na uploadové cestě NEZNAMENÁ „vypršel token" — znamená „tudy cesta
  // nevede". Změřila to serverová session 8. 9. 2026: uploadové routy `Authorization:
  // Bearer` vůbec nečtou, jedou na přihlášení přes cookie. Dokud tohle 401 nezvedalo
  // příznak, položka mlčky stála a v panelu neměla ani tlačítko, ani vysvětlení —
  // člověk viděl nahrávku, která nikdy neodejde, a nevěděl proč.
  // ⚠️ Zvednutí příznaku má i druhý účel: brání tomu, aby se 401 vykládal jako
  // pobídka k obnově tokenu. Souběžná obnova spustí na serveru reuse detekci,
  // která revokuje CELOU rodinu tokenů — tedy odhlásí člověka úplně.
  if (error?.status === 401 || error?.code === "unauthorized") return true;
  // Konkrétní kódy vlastní upload klient. Fronta jejich společný kontrakt
  // vyhodnotí jednou a rendereru pošle už jen význam, ne druhý seznam kódů.
  return failureCodeRequiresHumanAction(error?.code);
}

function storedFailureRequiresHumanAction(item) {
  if (Object.prototype.hasOwnProperty.call(item, "requiresHumanAction")) {
    return item.requiresHumanAction === true;
  }
  if (failureCodeRequiresHumanAction(item.lastFailureReason)) return true;
  // Přesná jednorázová migrace položek, které starší schéma uložilo jen jako
  // českou error.message. Nové výsledky vždy nesou explicitní boolean.
  return LEGACY_HUMAN_ACTION_FAILURE_REASONS.has(item.lastFailureReason);
}

/**
 * Jediná klasifikace položek, které bez rozhodnutí člověka nesmějí do dalšího
 * pokusu. Používá ji projekce, automatická pumpa i ruční retry, aby se jejich
 * význam nemohl mezi vrstvami rozejít.
 */
export function queueItemRequiresHumanAction(item) {
  requireObject(item, "item");
  return item.state === QUEUE_STATES.WAITING && storedFailureRequiresHumanAction(item);
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
  const sourceManifestPath = recording.sourceManifestPath === undefined
    ? manifestPath
    : requireNonEmptyString(recording.sourceManifestPath, "sourceManifestPath");
  if (
    recording.recoveredIncomplete !== undefined
    && typeof recording.recoveredIncomplete !== "boolean"
  ) {
    throw new TypeError("recoveredIncomplete musí být boolean");
  }
  const recoveredIncomplete = recording.recoveredIncomplete === true;
  const tracks = normalizeTrackPaths(recording.trackPaths);
  const existing = queue.items.find(
    (item) => item.clientRecordingId === manifest.clientRecordingId,
  );
  if (existing) {
    const sameRecording = existing.kind === QUEUE_ITEM_KINDS.RECORDING
      && (existing.sourceManifestPath ?? existing.manifestPath) === sourceManifestPath
      && existing.manifestPath === manifestPath
      && existing.tracks?.microphone === tracks.microphone
      && existing.tracks?.system === tracks.system
      && (existing.recoveredIncomplete === true) === recoveredIncomplete;
    if (sameRecording) return { added: false, item: existing, queue };
    throw new Error("Kolize clientRecordingId s jinou položkou fronty");
  }

  const item = {
    attempts: 0,
    clientRecordingId: manifest.clientRecordingId,
    enqueuedAt: new Date(timestamp(now, "now")).toISOString(),
    kind: QUEUE_ITEM_KINDS.RECORDING,
    lastFailureReason: null,
    manifestPath,
    nextAttemptAt: null,
    ...(recoveredIncomplete ? { recoveredIncomplete: true } : {}),
    sentAt: null,
    server: {
      recordingId: null,
      uploadedBytes: { microphone: 0, system: 0 },
    },
    state: QUEUE_STATES.WAITING,
    ...(sourceManifestPath !== manifestPath ? { sourceManifestPath } : {}),
    tracks,
  };
  return {
    added: true,
    item,
    queue: { ...queue, items: [...queue.items, item] },
  };
}

export function enqueueTimeEntry(queue, entry, now = Date.now()) {
  requireQueue(queue);
  requireObject(entry, "entry");
  const rateField = Object.keys(entry).find((field) => /(?:rate|sazb)/i.test(field));
  if (rateField) throw new TypeError(`časový záznam nesmí obsahovat sazbu (${rateField})`);

  if (
    entry.clientTimeEntryId !== undefined
    && entry.trackingId !== undefined
    && entry.clientTimeEntryId !== entry.trackingId
  ) {
    throw new TypeError("clientTimeEntryId a trackingId se nesmí lišit");
  }
  const clientTimeEntryId = requireGuid(
    entry.clientTimeEntryId ?? entry.trackingId,
    "entry.clientTimeEntryId",
  );
  const projectId = requireGuid(entry.projectId, "entry.projectId");
  const startedAt = requireNonEmptyString(entry.startedAt, "entry.startedAt");
  const endedAt = requireNonEmptyString(entry.endedAt, "entry.endedAt");
  const existing = queue.items.find((item) => item.clientRecordingId === clientTimeEntryId);
  if (existing) return { added: false, item: existing, queue };

  const item = {
    attempts: 0,
    clientRecordingId: clientTimeEntryId,
    enqueuedAt: new Date(timestamp(now, "now")).toISOString(),
    entry: { projectId, startedAt, endedAt },
    kind: QUEUE_ITEM_KINDS.TIME,
    lastFailureReason: null,
    nextAttemptAt: null,
    sentAt: null,
    state: QUEUE_STATES.WAITING,
  };
  return {
    added: true,
    item,
    queue: { ...queue, items: [...queue.items, item] },
  };
}

export function killswitchNameForKind(kind = QUEUE_ITEM_KINDS.RECORDING) {
  if (kind === QUEUE_ITEM_KINDS.RECORDING) return "DESKTOP_UPLOAD_ENABLED";
  if (kind === QUEUE_ITEM_KINDS.TIME) return "DESKTOP_TIME_ENABLED";
  throw new TypeError(`neznámý typ položky fronty: ${String(kind)}`);
}

export function reduceQueueForRenderer(queue) {
  requireQueue(queue);
  return queue.items.map((item) => ({
    id: item.clientRecordingId,
    kind: item.kind ?? QUEUE_ITEM_KINDS.RECORDING,
    state: item.state,
    attempts: item.attempts,
    nextAttemptAt: item.nextAttemptAt,
    lastFailureReason: item.lastFailureReason,
    ...(
      Number.isSafeInteger(item.sizeBytes) && item.sizeBytes >= 0
        ? { sizeBytes: item.sizeBytes }
        : {}
    ),
    ...(
      queueItemRequiresHumanAction(item)
        ? { requiresHumanAction: true }
        : {}
    ),
  }));
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

export function retryFailedItem(queue, clientRecordingId) {
  requireQueue(queue);
  requireNonEmptyString(clientRecordingId, "clientRecordingId");
  const index = queue.items.findIndex((item) => item.clientRecordingId === clientRecordingId);
  if (index === -1) throw new Error("položka fronty nebyla nalezena");

  const originalItem = queue.items[index];
  if (originalItem.state !== QUEUE_STATES.FAILED) return { item: originalItem, queue };
  // 🔴 Blokádu kvůli VLASTNICTVÍ tudy obejít nejde. „Zkusit znovu" je rozhodnutí o tom, že
  // se má opakovat pokus — ne potvrzení, že nahrávka patří tomu, kdo je zrovna přihlášený.
  // Kdyby to tahle cesta srazila, položka by odešla pod cizí relací a kontrola vlastníka
  // by existovala jen naoko. Taková položka se proto vrací beze změny.
  if (
    failureCodeRequiresHumanAction(originalItem.lastFailureReason)
    || LEGACY_HUMAN_ACTION_FAILURE_REASONS.has(originalItem.lastFailureReason)
  ) {
    return { item: originalItem, queue };
  }

  const item = {
    ...originalItem,
    attempts: 0,
    nextAttemptAt: null,
    // 🔴 Důvod zůstává, aby bylo pořád vidět, proč to minule selhalo. Jenže právě z něj se
    // u položek uložených starším schématem odvozuje „čeká na člověka" — a pumpa takovou
    // položku ve stavu `ceka` navždy přeskakuje. Bez tohohle výslovného `false` by tedy
    // návrat do fronty vypadal, že proběhl, a nahrávka by přesto nikdy neodešla.
    requiresHumanAction: false,
    state: QUEUE_STATES.WAITING,
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
 * Zpracuje nejvýše jednu připravenou položku. Oba killswitche jsou povinné
 * a každý typ povolují výhradně při přesné řetězcové hodnotě "true".
 */
export async function processNext(queue, killswitches, send, options = {}) {
  requireQueue(queue);
  if (arguments.length < 3) {
    throw new TypeError("queue, killswitches a send jsou povinné argumenty");
  }
  requireObject(killswitches, "killswitches");
  if (typeof send !== "function") throw new TypeError("send musí být funkce");

  const now = timestamp(options.now ?? Date.now(), "options.now");
  const waitingItems = queue.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.state === QUEUE_STATES.WAITING);
  const automaticWaitingItems = waitingItems.filter(
    ({ item }) => !queueItemRequiresHumanAction(item),
  );
  const isEnabled = (item) => {
    try {
      return killswitches[killswitchNameForKind(item.kind)] === "true";
    } catch {
      return false;
    }
  };
  const readyEnabled = automaticWaitingItems.find(({ item }) => (
    isEnabled(item) && (item.nextAttemptAt === null || item.nextAttemptAt <= now)
  ));
  const index = readyEnabled?.index ?? -1;
  if (index === -1) {
    if (automaticWaitingItems.some(({ item }) => !isEnabled(item))) {
      return { item: null, outcome: "disabled", queue, reason: UPLOAD_DISABLED_REASON };
    }
    return { item: null, outcome: "idle", queue, reason: "žádná položka není připravená" };
  }

  const policy = normalizeRetryPolicy(options.retryPolicy);
  const sendingItem = {
    ...queue.items[index],
    attempts: queue.items[index].attempts + 1,
    requiresHumanAction: false,
    state: QUEUE_STATES.SENDING,
  };
  const sendingQueue = replaceItem(queue, index, sendingItem);

  try {
    await send(sendingItem);
    const sentAt = timestamp(options.now ?? Date.now(), "options.now");
    const sentItem = {
      ...sendingItem,
      lastFailureReason: null,
      nextAttemptAt: null,
      sentAt: new Date(sentAt).toISOString(),
      state: QUEUE_STATES.SENT,
    };
    return {
      item: sentItem,
      outcome: "sent",
      queue: replaceItem(sendingQueue, index, sentItem),
      reason: null,
    };
  } catch (error) {
    const failureClass = errorFailureClass(error);
    if (failureClass === FAILURE_CLASSES.PERMANENT) {
      const failedItem = {
        ...sendingItem,
        lastFailureReason: errorReason(error),
        nextAttemptAt: null,
        state: QUEUE_STATES.FAILED,
      };
      return {
        item: failedItem,
        outcome: "failed",
        queue: replaceItem(sendingQueue, index, failedItem),
        reason: failedItem.lastFailureReason,
      };
    }
    if (failureClass === FAILURE_CLASSES.PAUSED) {
      const originalItem = queue.items[index];
      const pausedItem = {
        ...sendingItem,
        attempts: originalItem.attempts,
        lastFailureReason: errorReason(error),
        nextAttemptAt: originalItem.nextAttemptAt,
        requiresHumanAction: failureRequiresHumanAction(error),
        state: QUEUE_STATES.WAITING,
      };
      return {
        item: pausedItem,
        outcome: "paused",
        queue: replaceItem(sendingQueue, index, pausedItem),
        reason: pausedItem.lastFailureReason,
      };
    }
    const exhausted = sendingItem.attempts >= policy.maxAttempts;
    const failedAt = timestamp(options.now ?? Date.now(), "options.now");
    const failedItem = {
      ...sendingItem,
      lastFailureReason: errorReason(error),
      nextAttemptAt: exhausted
        ? null
        : failedAt + retryDelayMs(sendingItem.attempts, policy, options.random),
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
