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
export const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60 * 60 * 1_000;

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
const COMPANY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const QUEUE_OWNER_FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/u;

export const CLAIMED_RECORDING_HOLD_REASON = "Převzatá nahrávka čeká na volbu odeslání";
export const RECORDING_UPLOAD_INTENTS = Object.freeze({ HELD: "held", APPROVED: "approved" });

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
  // 🔴 `insufficient_scope` (HTTP 403) NENÍ o vlastnictví, proto nespadá pod `*_owner_*`,
  // ale je to stejná třída „opakování nepomůže": token nemá upload oprávnění. Nastane hlavně
  // v přechodovém okně po zapnutí uploadu — uložená session ještě nese starý scope `mcp:read`
  // a token se čte z ní bez nového přihlášení. Bez tohoto příznaku by se položka zkoušela
  // donekonečna a v panelu vypadala jako obyčejné „čeká na odeslání", zatímco ji spraví jedině
  // nové přihlášení. Raději viditelně „čeká na člověka" než tichá nekonečná smyčka.
  if (error?.code === "insufficient_scope") return true;
  // 🔴 Nevybraná firma taky není o vlastnictví, ale opakování ji nespraví — spraví ji jedině
  // člověk. Bez tohohle příznaku by položka zůstala jako obyčejné „čeká“ a panel by neukázal
  // ŽÁDNOU příčinu: uživatel by viděl frontu, která se nehýbe, a nevěděl proč.
  if (error?.code === "company_not_chosen" || error?.code === "company_binding_missing") return true;
  if (typeof error?.code === "string" && (
    error.code.startsWith("legacy_") || error.code.startsWith("delivery_")
  )) return true;
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

/** @returns {any} */
function emptyServerProgress(hasDelivery = false) {
  return {
    sessionId: null,
    ...(hasDelivery ? { delivery: { recordingId: null, uploadedBytes: 0 } } : {}),
    tracks: {
      microphone: { recordingId: null, uploadedBytes: 0 },
      system: { recordingId: null, uploadedBytes: 0 },
    },
  };
}

function normalizedStoredServer(item) {
  /** @type {any} */
  const normalized = emptyServerProgress();
  const server = item.server && typeof item.server === "object" ? item.server : {};
  if (typeof server.companyTabidooId === "string" && COMPANY_ID_PATTERN.test(server.companyTabidooId)) {
    normalized.companyTabidooId = server.companyTabidooId;
  }
  normalized.sessionId = safeGuid(server.sessionId);
  if (item.delivery !== undefined || server.delivery !== undefined) {
    normalized.delivery = {
      recordingId: safeGuid(server.delivery?.recordingId),
      uploadedBytes: safeUploadedBytes(server.delivery?.uploadedBytes),
    };
  }
  for (const track of ["microphone", "system"]) {
    const progress = server.tracks?.[track];
    normalized.tracks[track] = {
      recordingId: safeGuid(progress?.recordingId),
      uploadedBytes: safeUploadedBytes(progress?.uploadedBytes ?? server.uploadedBytes?.[track]),
    };
  }
  const itemTracks = Object.keys(item.tracks ?? {});
  const legacyRecordingId = safeNullableString(server.recordingId);
  if (legacyRecordingId !== null) {
    if (itemTracks.length === 1 && itemTracks[0] in normalized.tracks) {
      normalized.tracks[itemTracks[0]].recordingId ??= legacyRecordingId;
    } else {
      // U staré dvoustopé položky nevíme, které stopě jediný identifikátor patřil.
      // Hodnotu zachováme pro diagnostiku, ale T4 ji nesmí vydávat za ověřenou stopu.
      normalized.legacyRecordingId = legacyRecordingId;
    }
  }
  return normalized;
}

function hasInitializedServerProgress(server) {
  return server.sessionId !== null || server.legacyRecordingId !== undefined
    || server.delivery?.recordingId !== null && server.delivery?.recordingId !== undefined
    || (server.delivery?.uploadedBytes ?? 0) > 0
    || Object.values(server.tracks).some(
      (progress) => progress.recordingId !== null || progress.uploadedBytes > 0,
    );
}

function safeUploadedBytes(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function safeNullableString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function safeGuid(value) {
  return typeof value === "string" && PROJECT_GUID_PATTERN.test(value) ? value : null;
}

function serverForRenderer(item) {
  const server = item.server && typeof item.server === "object" ? item.server : {};
  const uploadedBytes = server.uploadedBytes && typeof server.uploadedBytes === "object"
    ? server.uploadedBytes
    : {};
  const perTrack = server.tracks && typeof server.tracks === "object" ? server.tracks : {};
  const itemTrackKinds = Object.keys(item.tracks ?? {});
  const legacyRecordingId = safeGuid(server.recordingId);

  return {
    sessionId: safeGuid(server.sessionId),
    ...(item.delivery !== undefined || server.delivery !== undefined ? { delivery: {
      recordingId: safeGuid(server.delivery?.recordingId),
      uploadedBytes: safeUploadedBytes(server.delivery?.uploadedBytes),
    } } : {}),
    tracks: Object.fromEntries(["microphone", "system"].map((track) => {
      const trackProgress = perTrack[track] && typeof perTrack[track] === "object"
        ? perTrack[track]
        : {};
      // Staré schéma má jedno nepojmenované recordingId. Lze je bezpečně přiřadit
      // jen jednostopé položce; u dvou stop bychom jinak jednu z nich vydávali za ověřenou.
      const legacyTrackId = itemTrackKinds.length === 1 && itemTrackKinds[0] === track
        ? legacyRecordingId
        : null;
      return [track, {
        recordingId: safeGuid(trackProgress.recordingId) ?? legacyTrackId,
        uploadedBytes: safeUploadedBytes(
          trackProgress.uploadedBytes ?? uploadedBytes[track],
        ),
      }];
    })),
  };
}

function queueItemBlockReason(item) {
  const blocked = queueItemRequiresHumanAction(item) || item.state === QUEUE_STATES.FAILED;
  return blocked ? safeNullableString(item.lastFailureReason) : null;
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
  const delivery = recording.delivery === undefined ? undefined : requireObject(recording.delivery, "delivery");
  const existing = queue.items.find(
    (item) => item.clientRecordingId === manifest.clientRecordingId,
  );
  if (existing) {
    const sameRecording = existing.kind === QUEUE_ITEM_KINDS.RECORDING
      && (existing.sourceManifestPath ?? existing.manifestPath) === sourceManifestPath
      && existing.manifestPath === manifestPath
      && existing.tracks?.microphone === tracks.microphone
      && existing.tracks?.system === tracks.system
      && JSON.stringify(existing.delivery) === JSON.stringify(delivery)
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
    server: emptyServerProgress(Boolean(delivery)),
    state: QUEUE_STATES.WAITING,
    uploadIntent: RECORDING_UPLOAD_INTENTS.HELD,
    ...(sourceManifestPath !== manifestPath ? { sourceManifestPath } : {}),
    tracks,
    ...(delivery ? { delivery } : {}),
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

export function reduceQueueForRenderer(queue, currentOwnerFingerprint = null) {
  requireQueue(queue);
  if (
    currentOwnerFingerprint !== null
    && (
      typeof currentOwnerFingerprint !== "string"
      || !QUEUE_OWNER_FINGERPRINT_PATTERN.test(currentOwnerFingerprint)
    )
  ) {
    throw new TypeError("currentOwnerFingerprint musí být platný otisk nebo null");
  }
  return queue.items.map((item) => ({
    id: item.clientRecordingId,
    kind: item.kind ?? QUEUE_ITEM_KINDS.RECORDING,
    state: item.state,
    ...((item.kind ?? QUEUE_ITEM_KINDS.RECORDING) === QUEUE_ITEM_KINDS.RECORDING
      ? { uploadIntent: item.uploadIntent === RECORDING_UPLOAD_INTENTS.APPROVED
          ? RECORDING_UPLOAD_INTENTS.APPROVED : RECORDING_UPLOAD_INTENTS.HELD }
      : {}),
    ...((item.kind ?? QUEUE_ITEM_KINDS.RECORDING) === QUEUE_ITEM_KINDS.RECORDING
      ? { title: safeNullableString(item.title) }
      : {}),
    attempts: item.attempts,
    nextAttemptAt: item.nextAttemptAt,
    lastFailureReason: item.lastFailureReason,
    createdAt: safeNullableString(item.createdAt),
    durationMs: Number.isSafeInteger(item.durationMs) && item.durationMs >= 0
      ? item.durationMs
      : null,
    sizeBytes: Number.isSafeInteger(item.sizeBytes) && item.sizeBytes >= 0
      ? item.sizeBytes
      : null,
    server: serverForRenderer(item),
    blockReason: queueItemBlockReason(item),
    ownership: item.ownerFingerprint === null || item.ownerFingerprint === undefined
      ? "unknown"
      : (currentOwnerFingerprint === null
          ? "unavailable"
          : (item.ownerFingerprint === currentOwnerFingerprint ? "current" : "other")),
    ...(
      typeof item.revision === "string" && /^sha256:[a-f0-9]{64}$/u.test(item.revision)
        ? { revision: item.revision }
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
 * Přepíše vlastníka jediné lokální nahrávky. Nový vlastník tím ještě neschvaluje
 * odeslání, proto položka zůstává držená pro navazující volbu v T5.
 */
export function claimRecording(queue, clientRecordingId, ownerFingerprint) {
  requireQueue(queue);
  requireGuid(clientRecordingId, "clientRecordingId");
  if (
    typeof ownerFingerprint !== "string"
    || !QUEUE_OWNER_FINGERPRINT_PATTERN.test(ownerFingerprint)
  ) {
    throw new TypeError("ownerFingerprint musí být platný otisk vlastníka");
  }
  const index = queue.items.findIndex((item) => item.clientRecordingId === clientRecordingId);
  if (index === -1) throw new Error("nahrávka ve frontě nebyla nalezena");
  const originalItem = queue.items[index];
  if ((originalItem.kind ?? QUEUE_ITEM_KINDS.RECORDING) !== QUEUE_ITEM_KINDS.RECORDING) {
    throw new Error("převzít lze jen nahrávku");
  }
  if (originalItem.state === QUEUE_STATES.SENDING) {
    throw new Error("právě odesílanou nahrávku nelze převzít");
  }
  if (originalItem.state === QUEUE_STATES.SENT) {
    throw new Error("odeslanou nahrávku nelze převzít");
  }
  if (originalItem.state !== QUEUE_STATES.WAITING && originalItem.state !== QUEUE_STATES.FAILED) {
    throw new Error("nahrávka není ve stavu, který lze převzít");
  }
  if (originalItem.ownerFingerprint === ownerFingerprint) {
    throw new Error("nahrávka už patří aktuálnímu účtu");
  }

  const item = {
    ...originalItem,
    attempts: 0,
    lastFailureReason: CLAIMED_RECORDING_HOLD_REASON,
    nextAttemptAt: null,
    ownerFingerprint,
    requiresHumanAction: true,
    sentAt: null,
    server: emptyServerProgress(Boolean(originalItem.delivery)),
    state: QUEUE_STATES.WAITING,
    uploadIntent: RECORDING_UPLOAD_INTENTS.HELD,
  };
  return { item, queue: replaceItem(queue, index, item) };
}

/**
 * Přepíše lokální postup hodnotami potvrzenými serverem. Offsety se záměrně
 * nepřičítají ani neporovnávají s lokálním odhadem: server je zdroj pravdy.
 */
export function applyServerProgress(queue, clientRecordingId, serverProgress) {
  requireQueue(queue);
  requireNonEmptyString(clientRecordingId, "clientRecordingId");
  requireObject(serverProgress, "serverProgress");
  const index = queue.items.findIndex((item) => item.clientRecordingId === clientRecordingId);
  if (index === -1) throw new Error("položka fronty nebyla nalezena");

  const originalItem = queue.items[index];
  const server = normalizedStoredServer(originalItem);
  const progressKeys = Object.keys(serverProgress).sort();
  if (progressKeys.length === 1 && progressKeys[0] === "companyTabidooId") {
    const companyTabidooId = serverProgress.companyTabidooId;
    if (typeof companyTabidooId !== "string" || !COMPANY_ID_PATTERN.test(companyTabidooId)) {
      throw new TypeError("serverProgress.companyTabidooId musí být platný GUID malými písmeny");
    }
    const hasServerProgress = server.sessionId !== null
      || server.legacyRecordingId !== undefined
      || server.delivery?.recordingId !== null && server.delivery?.recordingId !== undefined
      || (server.delivery?.uploadedBytes ?? 0) > 0
      || Object.values(server.tracks).some(
        (progress) => progress.recordingId !== null || progress.uploadedBytes > 0,
      );
    if (hasServerProgress) throw new Error("firmu nelze připnout po zahájení uploadu");
    if (server.companyTabidooId !== undefined && server.companyTabidooId !== companyTabidooId) {
      throw new Error("firmu již připnuté nahrávky nelze změnit");
    }
    server.companyTabidooId = companyTabidooId;
    const item = { ...originalItem, server };
    return { item, queue: replaceItem(queue, index, item) };
  }
  if (Object.prototype.hasOwnProperty.call(serverProgress, "companyTabidooId")) {
    throw new TypeError("připnutí firmy musí být samostatný progress event");
  }
  if (Object.prototype.hasOwnProperty.call(serverProgress, "delivery")) {
    const delivery = requireObject(serverProgress.delivery, "serverProgress.delivery");
    if (
      !["pending", "ready"].includes(delivery.state)
      || delivery.clientRecordingId !== originalItem.clientRecordingId
      || delivery.mime !== "audio/mpeg"
      || delivery.channels !== 2
      || !delivery.channelMap
      || delivery.channelMap.left !== "microphone"
      || !["system", "silence"].includes(delivery.channelMap.right)
      || typeof delivery.filePath !== "string"
      || typeof delivery.sidecarPath !== "string"
      || (delivery.state === "ready" && (
        !Number.isSafeInteger(delivery.sizeBytes)
        || delivery.sizeBytes <= 0
        || typeof delivery.sha256 !== "string"
        || !/^[a-f0-9]{64}$/u.test(delivery.sha256)
      ))
      || (delivery.state === "pending" && (
        delivery.sizeBytes !== null || delivery.sha256 !== null || delivery.encoderVersion !== null
      ))
    ) {
      throw new TypeError("serverProgress.delivery musí být platný descriptor MP3 stejné nahrávky");
    }
    if (
      (server.delivery?.recordingId !== null && server.delivery?.recordingId !== undefined)
      || (server.delivery?.uploadedBytes ?? 0) > 0
    ) {
      throw new Error("delivery nelze změnit po zahájení uploadu");
    }
    if (originalItem.delivery?.state === "ready" && delivery.state !== "ready") {
      throw new Error("ready delivery nelze vrátit do pending stavu");
    }
    const item = { ...originalItem, delivery, server: {
      ...server,
      delivery: server.delivery ?? { recordingId: null, uploadedBytes: 0 },
    } };
    return { item, queue: replaceItem(queue, index, item) };
  }
  if (serverProgress.track === "delivery") {
    if (originalItem.delivery?.state !== "ready") {
      throw new TypeError("serverProgress.track delivery vyžaduje připravený MP3");
    }
    const recordingId = requireGuid(serverProgress.recordingId, "serverProgress.recordingId");
    server.delivery ??= { recordingId: null, uploadedBytes: 0 };
    if (server.delivery.recordingId !== null && server.delivery.recordingId !== recordingId) {
      throw new Error("server změnil recordingId připraveného MP3");
    }
    const sessionId = serverProgress.sessionId === undefined
      ? server.sessionId
      : requireGuid(serverProgress.sessionId, "serverProgress.sessionId");
    if (server.sessionId !== null && sessionId !== server.sessionId) {
      throw new Error("server změnil sessionId už známé nahrávky");
    }
    const uploadedBytes = serverProgress.uploadedBytes === undefined
      ? server.delivery.uploadedBytes
      : serverProgress.uploadedBytes;
    if (!Number.isSafeInteger(uploadedBytes) || uploadedBytes < 0) {
      throw new TypeError("serverProgress.uploadedBytes musí být nezáporné celé číslo");
    }
    server.sessionId = sessionId;
    server.delivery = { recordingId, uploadedBytes };
    const item = { ...originalItem, server };
    return { item, queue: replaceItem(queue, index, item) };
  }
  const track = serverProgress.track;

  // Starý čistý kontrakt zůstává čitelný pro položky schématu v1. Jediný identifikátor
  // nelze pravdivě přiřadit dvěma stopám, proto se u dvojice zachová jen jako legacy údaj.
  if (track === undefined) {
    const recordingId = requireGuid(
      serverProgress.recordingId,
      "serverProgress.recordingId",
    );
    const uploadedBytes = requireUploadedBytes(serverProgress.uploadedBytes);
    server.tracks.microphone.uploadedBytes = uploadedBytes.microphone;
    server.tracks.system.uploadedBytes = uploadedBytes.system;
    const itemTracks = Object.keys(originalItem.tracks ?? {});
    if (itemTracks.length === 1 && itemTracks[0] in server.tracks) {
      server.tracks[itemTracks[0]].recordingId = recordingId;
    } else {
      server.legacyRecordingId = recordingId;
    }
  } else {
    if (track !== "microphone" && track !== "system") {
      throw new TypeError("serverProgress.track musí být microphone nebo system");
    }
    if (!Object.prototype.hasOwnProperty.call(originalItem.tracks ?? {}, track)) {
      throw new TypeError("serverProgress.track není stopou položky fronty");
    }
    const recordingId = requireGuid(
      serverProgress.recordingId,
      "serverProgress.recordingId",
    );
    const previousRecordingId = server.tracks[track].recordingId;
    if (previousRecordingId !== null && previousRecordingId !== recordingId) {
      throw new Error("server změnil recordingId už známé stopy");
    }
    const duplicateTrack = Object.entries(server.tracks).find(([otherTrack, progress]) => (
      otherTrack !== track && progress.recordingId === recordingId
    ));
    if (duplicateTrack) {
      throw new Error("server přiřadil stejné recordingId dvěma stopám");
    }
    const sessionId = serverProgress.sessionId === undefined
      ? server.sessionId
      : requireGuid(serverProgress.sessionId, "serverProgress.sessionId");
    if (server.sessionId !== null && sessionId !== server.sessionId) {
      throw new Error("server změnil sessionId už známé nahrávky");
    }
    const uploadedBytes = serverProgress.uploadedBytes === undefined
      ? server.tracks[track].uploadedBytes
      : serverProgress.uploadedBytes;
    if (!Number.isSafeInteger(uploadedBytes) || uploadedBytes < 0) {
      throw new TypeError("serverProgress.uploadedBytes musí být nezáporné celé číslo");
    }
    server.sessionId = sessionId;
    server.tracks[track] = { recordingId, uploadedBytes };
  }

  const item = {
    ...originalItem,
    server,
  };
  return { item, queue: replaceItem(queue, index, item) };
}

/** Připojí lokálně připravený descriptor před prvním síťovým požadavkem. */
export function attachRecordingDelivery(queue, clientRecordingId, delivery) {
  requireQueue(queue);
  requireObject(delivery, "delivery");
  const index = queue.items.findIndex((item) => item.clientRecordingId === clientRecordingId);
  if (index === -1) throw new Error("položka fronty nebyla nalezena");
  const originalItem = queue.items[index];
  if ((originalItem.kind ?? QUEUE_ITEM_KINDS.RECORDING) !== QUEUE_ITEM_KINDS.RECORDING) {
    throw new Error("delivery lze připojit jen k nahrávce");
  }
  const server = normalizedStoredServer(originalItem);
  if (
    originalItem.delivery !== undefined
    || server.sessionId !== null
    || server.companyTabidooId !== undefined
    || server.delivery?.recordingId !== null && server.delivery?.recordingId !== undefined
    || (server.delivery?.uploadedBytes ?? 0) > 0
  ) throw new Error("delivery nelze připojit po zahájení uploadu");
  if (
    !["pending", "ready"].includes(delivery.state)
    || delivery.clientRecordingId !== clientRecordingId
    || delivery.mime !== "audio/mpeg"
    || delivery.channels !== 2
    || delivery.channelMap?.left !== "microphone"
    || !["system", "silence"].includes(delivery.channelMap?.right)
  ) throw new TypeError("delivery má neplatný lokální descriptor");
  const item = { ...originalItem, delivery, server: {
    ...server,
    delivery: server.delivery ?? { recordingId: null, uploadedBytes: 0 },
  } };
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

/** Výslovná oprava pouze firmy odmítnuté serverem, ještě před vznikem serverových ID. */
export function rebindCompanyOutOfScopeItem(queue, clientRecordingId, companyTabidooId) {
  requireQueue(queue);
  requireNonEmptyString(clientRecordingId, "clientRecordingId");
  if (typeof companyTabidooId !== "string" || !COMPANY_ID_PATTERN.test(companyTabidooId)) {
    throw new TypeError("companyTabidooId musí být platný GUID malými písmeny");
  }
  const index = queue.items.findIndex((item) => item.clientRecordingId === clientRecordingId);
  if (index === -1) throw new Error("položka fronty nebyla nalezena");
  const originalItem = queue.items[index];
  const rejectedCompany = originalItem.lastFailureReason === "company_out_of_scope (HTTP 403)"
    || originalItem.lastFailureReason === "403 company_out_of_scope";
  if (originalItem.state !== QUEUE_STATES.FAILED || !rejectedCompany) {
    return { item: originalItem, queue };
  }
  const server = normalizedStoredServer(originalItem);
  if (server.companyTabidooId === companyTabidooId) return { item: originalItem, queue };
  if (hasInitializedServerProgress(server)) return { item: originalItem, queue };
  server.companyTabidooId = companyTabidooId;
  const item = { ...originalItem, server };
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

// 🔴 Když server řekne, jak dlouho čekat (`429` nese `Retry-After`), POSLECHNEME HO místo
// vlastního exponenciálního rozvrhu. Náš rozvrh by se probudil za 30 s, tedy uvnitř okna,
// které ještě běží — a každý takový pokus se do limitu počítá znovu, i idempotentní. Sami
// bychom si tím okno posouvali. Strop politiky platí dál jako pojistka proti nesmyslné
// hodnotě; server posílá nejvýš 3600 s, což se do něj vejde bez ořezu.
function odkladPoSelhani(error, attempts, policy, random) {
  const odServeru = error?.retryAfterMs;
  if (Number.isFinite(odServeru) && odServeru > 0) {
    return Math.min(policy.maxDelayMs, Math.round(odServeru));
  }
  return retryDelayMs(attempts, policy, random);
}

// 🔴 Rozlišuje pauzu, která patří JEDNÉ POLOŽCE, od pauzy, která patří CELÉMU PŘIHLÁŠENÍ.
// Je to jádro obrany proti dvěma opačným vadám:
//  · Kdyby se nerozlišovalo a pump se po každé pauze zastavil, jediná nahrávka bez vlastníka
//    zmrazí frontu napořád — změřeno 11. 9. 2026: 19 takových položek stálo v čele a nové
//    nahrávky se nikdy nedostaly na řadu, i když byly v pořádku.
//  · Kdyby se naopak pokračovalo VŽDY, chyba přihlášení (401 / chybějící oprávnění) by se
//    zopakovala u každé položky fronty — desítky marných požadavků a vyčerpaný limit serveru.
// Proto: pokračuj jen u důvodů vázaných na položku (`queue_owner_*`), u všeho ostatního zastav.
// Neznámý důvod pauzy zastavuje — fail-closed, protože nevíme, koho se týká.
function pauseBelongsToItem(error) {
  const code = error?.code;
  if (typeof code !== "string") return false;
  const [source, subject, reason, ...extra] = code.split("_");
  if (extra.length > 0 || source !== "queue" || subject !== "owner") return false;
  return typeof reason === "string" && reason.length > 0;
}

/**
 * Odešle nejvýše JEDNU položku. Položky, které odeslat nelze kvůli vlastnictví, cestou
 * označí a přeskočí — jinak by první taková zmrazila celou frontu (viz `pauseBelongsToItem`).
 * Oba killswitche jsou povinné a každý typ povolují výhradně při přesné hodnotě "true".
 */
export async function processNext(queue, killswitches, send, options = {}) {
  requireQueue(queue);
  if (arguments.length < 3) {
    throw new TypeError("queue, killswitches a send jsou povinné argumenty");
  }
  requireObject(killswitches, "killswitches");
  if (typeof send !== "function") throw new TypeError("send musí být funkce");
  if (options.persistProgress !== undefined && typeof options.persistProgress !== "function") {
    throw new TypeError("options.persistProgress musí být funkce");
  }

  const now = timestamp(options.now ?? Date.now(), "options.now");
  if (
    options.recordingCooldownRetryAt !== undefined
    && (
      !Number.isSafeInteger(options.recordingCooldownRetryAt)
      || options.recordingCooldownRetryAt <= 0
    )
  ) {
    throw new TypeError("options.recordingCooldownRetryAt musí být kladný čas v milisekundách");
  }
  const waitingItems = queue.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.state === QUEUE_STATES.WAITING)
    .filter(({ item }) => options.clientRecordingId === undefined
      || item.clientRecordingId === options.clientRecordingId)
    .filter(({ item }) => options.kind === undefined || item.kind === options.kind);
  const automaticWaitingItems = waitingItems.filter(
    ({ item }) => !queueItemRequiresHumanAction(item)
      && ((item.kind ?? QUEUE_ITEM_KINDS.RECORDING) !== QUEUE_ITEM_KINDS.RECORDING
        || item.uploadIntent === RECORDING_UPLOAD_INTENTS.APPROVED),
  );
  const isEnabled = (item) => {
    try {
      return killswitches[killswitchNameForKind(item.kind)] === "true";
    } catch {
      return false;
    }
  };
  const readyEnabledIncludingCooldown = automaticWaitingItems.filter(({ item }) => (
    isEnabled(item) && (item.nextAttemptAt === null || item.nextAttemptAt <= now)
  ));
  const recordingUnavailableForOwner = ({ item }) => (
    (item.kind ?? QUEUE_ITEM_KINDS.RECORDING) === QUEUE_ITEM_KINDS.RECORDING
    && options.currentOwnerFingerprint !== undefined
    && (
      options.currentOwnerFingerprint === null
      || item.ownerFingerprint !== options.currentOwnerFingerprint
    )
  );
  const recordingBlockedByCooldown = ({ item }) => (
    (item.kind ?? QUEUE_ITEM_KINDS.RECORDING) === QUEUE_ITEM_KINDS.RECORDING
    && options.recordingCooldownRetryAt !== undefined
    && options.recordingCooldownRetryAt > now
    && !recordingUnavailableForOwner({ item })
  );
  const readyEnabled = readyEnabledIncludingCooldown.filter(
    (candidate) => (
      !recordingUnavailableForOwner(candidate) && !recordingBlockedByCooldown(candidate)
    ),
  );
  if (readyEnabled.length === 0) {
    if (readyEnabledIncludingCooldown.some(recordingBlockedByCooldown)) {
      return {
        item: null,
        outcome: "rate_limited",
        queue,
        reason: "odesílání nahrávek čeká na vypršení serverového limitu",
        retryAt: options.recordingCooldownRetryAt,
      };
    }
    if (readyEnabledIncludingCooldown.some(recordingUnavailableForOwner)) {
      return {
        item: null,
        outcome: "paused",
        queue,
        reason: "bez platného vlastníka nelze nahrávku odeslat",
      };
    }
    if (automaticWaitingItems.some(({ item }) => !isEnabled(item))) {
      return { item: null, outcome: "disabled", queue, reason: UPLOAD_DISABLED_REASON };
    }
    return { item: null, outcome: "idle", queue, reason: "žádná položka není připravená" };
  }

  const policy = normalizeRetryPolicy(options.retryPolicy);
  // Smyčka je konečná z definice: jde právě přes připravené položky a každou vezme nejvýš
  // jednou. Odeslat se smí pořád jen JEDNA — pokračuje se výhradně přes položky, které
  // odeslat nešlo kvůli vlastnictví, a ty žádný požadavek na server neposílají.
  let workingQueue = queue;
  let lastSkipped = null;
  let skippedCount = 0;

  for (const { index } of readyEnabled) {
    const originalItem = workingQueue.items[index];
    const sendingItem = {
      ...originalItem,
      attempts: originalItem.attempts + 1,
      requiresHumanAction: false,
      state: QUEUE_STATES.SENDING,
    };
    let progressQueue = workingQueue;
    const reportServerProgress = async (serverProgress) => {
      const previousItem = progressQueue.items[index];
      const progressed = applyServerProgress(
        progressQueue,
        originalItem.clientRecordingId,
        serverProgress,
      );
      if (JSON.stringify(progressed.item.server) === JSON.stringify(previousItem.server)
        && JSON.stringify(progressed.item.delivery) === JSON.stringify(previousItem.delivery)) return;
      progressQueue = progressed.queue;
      // Persistuje se čekající položka, ne přechodný stav `odesila`. Když proces po fsync
      // spadne, nový běh ji smí bezpečně zvednout přes idempotentní INIT.
      if (options.persistProgress) await options.persistProgress(progressQueue);
    };

    try {
      const sendResult = await send(sendingItem, reportServerProgress, Object.freeze({
        preAttemptItem: originalItem,
      }));
      if (sendResult?.uploads !== undefined) {
        if (!Array.isArray(sendResult.uploads)) {
          throw new TypeError("sendResult.uploads musí být pole");
        }
        if (
          sendResult.completedUploads !== undefined
          && sendResult.completedUploads !== sendResult.uploads.length
        ) {
          throw new TypeError("sendResult.completedUploads neodpovídá počtu stop");
        }
        const progressedItem = progressQueue.items[index];
        const expectedTracks = progressedItem.delivery?.state === "ready"
          ? ["delivery"]
          : Object.keys(progressedItem.tracks ?? {}).sort();
        const reportedTracks = sendResult.uploads.map((upload) => upload?.track).sort();
        if (
          reportedTracks.length !== expectedTracks.length
          || reportedTracks.some((track, trackIndex) => track !== expectedTracks[trackIndex])
        ) {
          throw new TypeError("sendResult.uploads neodpovídá stopám položky");
        }
        // Výsledek je druhá kontrola callbacku a současně kompatibilní cesta pro sender,
        // který průběžný callback nepoužil. Nekonzistentní ID nebo session apply odmítne.
        for (const upload of sendResult.uploads) await reportServerProgress(upload);
      }
      const sentAt = timestamp(options.now ?? Date.now(), "options.now");
      const sentItem = {
        ...sendingItem,
        delivery: progressQueue.items[index].delivery,
        server: progressQueue.items[index].server,
        lastFailureReason: null,
        nextAttemptAt: null,
        sentAt: new Date(sentAt).toISOString(),
        state: QUEUE_STATES.SENT,
      };
      return {
        item: sentItem,
        outcome: "sent",
        queue: replaceItem(progressQueue, index, sentItem),
        reason: null,
        sendResult,
      };
    } catch (error) {
      const progressedSendingItem = {
        ...sendingItem,
        delivery: progressQueue.items[index].delivery,
        server: progressQueue.items[index].server,
      };
      const failureClass = errorFailureClass(error);
      if (
        (progressedSendingItem.kind ?? QUEUE_ITEM_KINDS.RECORDING) === QUEUE_ITEM_KINDS.RECORDING
        && error?.status === 429
      ) {
        const retryAfterMs = Number.isFinite(error.retryAfterMs) && error.retryAfterMs > 0
          ? Math.min(policy.maxDelayMs, Math.round(error.retryAfterMs))
          : DEFAULT_RATE_LIMIT_COOLDOWN_MS;
        const retryAt = timestamp(options.now ?? Date.now(), "options.now") + retryAfterMs;
        const rateLimitedItem = {
          ...progressedSendingItem,
          attempts: originalItem.attempts,
          lastFailureReason: errorReason(error),
          nextAttemptAt: originalItem.nextAttemptAt,
          requiresHumanAction: false,
          state: QUEUE_STATES.WAITING,
        };
        return {
          item: rateLimitedItem,
          outcome: "rate_limited",
          queue: replaceItem(progressQueue, index, rateLimitedItem),
          reason: rateLimitedItem.lastFailureReason,
          retryAt,
        };
      }
      if (failureClass === FAILURE_CLASSES.PERMANENT) {
        const failedItem = {
          ...progressedSendingItem,
          lastFailureReason: errorReason(error),
          nextAttemptAt: null,
          state: QUEUE_STATES.FAILED,
        };
        return {
          item: failedItem,
          outcome: "failed",
          queue: replaceItem(progressQueue, index, failedItem),
          reason: failedItem.lastFailureReason,
        };
      }
      if (failureClass === FAILURE_CLASSES.PAUSED) {
        const pausedItem = {
          ...progressedSendingItem,
          attempts: originalItem.attempts,
          lastFailureReason: errorReason(error),
          nextAttemptAt: originalItem.nextAttemptAt,
          requiresHumanAction: failureRequiresHumanAction(error),
          state: QUEUE_STATES.WAITING,
        };
        const pausedQueue = replaceItem(progressQueue, index, pausedItem);
        // Vlastnictví je vada TÉHLE položky: označ ji a zkus další. Cokoli jiného
        // (401, chybějící oprávnění, neznámý důvod) je vada přihlášení a zastavuje.
        if (pauseBelongsToItem(error)) {
          workingQueue = pausedQueue;
          lastSkipped = pausedItem;
          skippedCount += 1;
          continue;
        }
        return {
          item: pausedItem,
          outcome: "paused",
          queue: pausedQueue,
          reason: pausedItem.lastFailureReason,
        };
      }
      const exhausted = progressedSendingItem.attempts >= policy.maxAttempts;
      const failedAt = timestamp(options.now ?? Date.now(), "options.now");
      const failedItem = {
        ...progressedSendingItem,
        lastFailureReason: errorReason(error),
        nextAttemptAt: exhausted
          ? null
          : failedAt + odkladPoSelhani(
            error,
            progressedSendingItem.attempts,
            policy,
            options.random,
          ),
        state: exhausted ? QUEUE_STATES.FAILED : QUEUE_STATES.WAITING,
      };
      return {
        item: failedItem,
        outcome: exhausted ? "failed" : "retry_scheduled",
        queue: replaceItem(progressQueue, index, failedItem),
        reason: failedItem.lastFailureReason,
      };
    }
  }

  // Sem se dojde jen tehdy, když VŠECHNY připravené položky byly neodeslatelné kvůli
  // vlastnictví. Jsou označené, takže příští pump je přeskočí a sáhne rovnou po nových.
  return {
    item: lastSkipped,
    outcome: "paused",
    queue: workingQueue,
    reason: skippedCount > 1
      ? `${skippedCount} nahrávek čeká na potvrzení vlastníka; žádná jiná není připravená`
      : lastSkipped?.lastFailureReason ?? null,
  };
}
