const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const MANIFEST_MAX_BYTES = 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const TRACK_SOURCES = new Set(["microphone", "system"]);
const SAFE_LEGACY_REASONS = new Set([
  "Nahrávka patří jinému účtu",
  "Vlastník nahrávky není potvrzený; před odesláním je nutné potvrzení člověkem",
  "Identitu aktuálního přihlášení nelze ověřit",
  "Převzatá nahrávka čeká na volbu odeslání",
]);

function sameStats(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

function directChild(root, candidate, alternateRoot = root) {
  if (typeof candidate !== "string" || candidate.length === 0 || !path.isAbsolute(candidate)) {
    return null;
  }
  const resolved = path.resolve(candidate);
  if (path.dirname(resolved) !== root && path.dirname(resolved) !== alternateRoot) return null;
  return path.join(root, path.basename(resolved));
}

async function readStableRegularFile(filePath, maxBytes = MANIFEST_MAX_BYTES) {
  const initial = await fs.promises.lstat(filePath);
  if (
    !initial.isFile()
    || initial.isSymbolicLink()
    || initial.size < 1
    || initial.size > maxBytes
  ) {
    throw new TypeError("manifest není bezpečný běžný soubor");
  }
  const noFollow = fs.constants.O_NOFOLLOW ?? 0;
  const nonBlock = fs.constants.O_NONBLOCK ?? 0;
  const handle = await fs.promises.open(filePath, fs.constants.O_RDONLY | noFollow | nonBlock);
  try {
    const before = await handle.stat();
    if (!before.isFile() || !sameStats(initial, before)) {
      throw new TypeError("manifest není bezpečný běžný soubor");
    }
    const buffer = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) throw new Error("manifest se během čtení zkrátil");
      offset += bytesRead;
    }
    const contents = buffer.toString("utf8");
    const after = await handle.stat();
    const current = await fs.promises.lstat(filePath);
    if (!current.isFile() || current.isSymbolicLink() || !sameStats(before, after) || !sameStats(after, current)) {
      throw new Error("manifest se během čtení změnil");
    }
    return { contents, stats: after };
  } finally {
    await handle.close().catch(() => {});
  }
}

function canonicalTimestamp(value, nullable = true) {
  if (value === null && nullable) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new TypeError("neplatný čas");
  if (new Date(Date.parse(value)).toISOString() !== value) throw new TypeError("nekanonický čas");
  return value;
}

function validateManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("neplatný manifest");
  if (value.schemaVersion !== 1 || !["complete", "incomplete"].includes(value.state)) {
    throw new TypeError("nepodporovaný manifest");
  }
  if (typeof value.clientRecordingId !== "string" || !UUID_PATTERN.test(value.clientRecordingId)) {
    throw new TypeError("manifest nemá platné UUID");
  }
  canonicalTimestamp(value.createdAt, false);
  canonicalTimestamp(value.closedAt);
  if (!value.tracks || typeof value.tracks !== "object" || Array.isArray(value.tracks)) {
    throw new TypeError("neplatné stopy");
  }
  const sources = Object.keys(value.tracks).sort();
  if (
    sources.length < 1
    || sources.length > 2
    || sources[0] !== "microphone"
    || sources.some((source) => !TRACK_SOURCES.has(source))
  ) {
    throw new TypeError("nepodporované stopy");
  }
  const names = new Set();
  for (const source of sources) {
    const track = value.tracks[source];
    if (!track || typeof track !== "object" || Array.isArray(track)) throw new TypeError("neplatná stopa");
    if (
      typeof track.fileName !== "string"
      || track.fileName.length === 0
      || path.basename(track.fileName) !== track.fileName
      || track.fileName === "."
      || track.fileName === ".."
      || names.has(track.fileName)
      || !Number.isSafeInteger(track.sizeBytes)
      || track.sizeBytes < 0
      || (track.sha256 !== null && !/^[a-f0-9]{64}$/u.test(track.sha256))
    ) {
      throw new TypeError("nebezpečná nebo neplatná stopa");
    }
    canonicalTimestamp(track.startedAt);
    canonicalTimestamp(track.endedAt);
    names.add(track.fileName);
  }
  if (value.state === "complete" && value.closedAt === null) throw new TypeError("neuzavřený manifest");
  return { manifest: value, sources };
}

async function inspectTrack(root, fileName) {
  const filePath = directChild(root, path.join(root, fileName));
  if (filePath === null) return { exists: false, marker: "unsafe" };
  try {
    const before = await fs.promises.lstat(filePath);
    if (!before.isFile() || before.isSymbolicLink() || !Number.isSafeInteger(before.size) || before.size < 0) {
      return { exists: false, marker: "unsafe" };
    }
    const noFollow = fs.constants.O_NOFOLLOW ?? 0;
    const nonBlock = fs.constants.O_NONBLOCK ?? 0;
    const handle = await fs.promises.open(filePath, fs.constants.O_RDONLY | noFollow | nonBlock);
    try {
      const opened = await handle.stat();
      const current = await fs.promises.lstat(filePath);
      if (!opened.isFile() || !sameStats(before, opened) || !sameStats(opened, current)) {
        return { exists: false, marker: "changed" };
      }
      return {
        exists: true,
        marker: [opened.dev, opened.ino, opened.size, opened.mtimeMs, opened.ctimeMs],
        sizeBytes: opened.size,
      };
    } finally {
      await handle.close().catch(() => {});
    }
  } catch {
    return { exists: false, marker: "missing" };
  }
}

function durationFromManifest(manifest, sources) {
  const durations = sources.map((source) => {
    const { startedAt, endedAt } = manifest.tracks[source];
    if (startedAt === null || endedAt === null) return null;
    const duration = Date.parse(endedAt) - Date.parse(startedAt);
    return Number.isSafeInteger(duration) && duration >= 0 ? duration : null;
  }).filter((value) => value !== null);
  return durations.length > 0 ? Math.max(...durations) : null;
}

function revisionFor(manifestRead, tracks) {
  const manifestDigest = createHash("sha256").update(manifestRead.contents, "utf8").digest("hex");
  return `sha256:${createHash("sha256").update(JSON.stringify({
    manifest: [
      manifestDigest,
      manifestRead.stats.dev,
      manifestRead.stats.ino,
      manifestRead.stats.size,
      manifestRead.stats.mtimeMs,
      manifestRead.stats.ctimeMs,
    ],
    tracks: tracks.map(({ marker }) => marker),
  }), "utf8").digest("hex")}`;
}

function invalidRevision(marker, read = null) {
  const value = read
    ? [
      marker,
      createHash("sha256").update(read.contents, "utf8").digest("hex"),
      read.stats.dev,
      read.stats.ino,
      read.stats.size,
      read.stats.mtimeMs,
      read.stats.ctimeMs,
    ]
    : [marker];
  return `sha256:${createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex")}`;
}

async function inspectManifest(recordingsDirectory, manifestPath, derivativePaths = []) {
  const safePath = directChild(recordingsDirectory, manifestPath);
  if (safePath === null || !safePath.endsWith(".manifest.json")) {
    return { identifiedId: null, invalid: true, fileRevision: invalidRevision("unsafe-manifest") };
  }
  let read;
  let parsed;
  try {
    read = await readStableRegularFile(safePath);
    parsed = JSON.parse(read.contents);
  } catch {
    return { identifiedId: null, invalid: true, fileRevision: invalidRevision("unreadable-manifest") };
  }
  const identifiedId = typeof parsed?.clientRecordingId === "string" && UUID_PATTERN.test(parsed.clientRecordingId)
    ? parsed.clientRecordingId
    : null;
  let validated;
  try {
    validated = validateManifest(parsed);
  } catch {
    return {
      identifiedId,
      invalid: true,
      fileRevision: invalidRevision("invalid-manifest", read),
    };
  }
  const tracks = await Promise.all(validated.sources.map(
    (source) => inspectTrack(recordingsDirectory, validated.manifest.tracks[source].fileName),
  ));
  const derivatives = await Promise.all(derivativePaths.map((filePath) => (
    inspectTrack(recordingsDirectory, path.basename(filePath))
  )));
  const allFiles = [...tracks, ...derivatives];
  const existing = allFiles.filter((track) => track.exists);
  // Přítomný soubor ještě nedokládá dokončený zvuk: rozpracovaný manifest
  // a prázdná očekávaná stopa musejí zůstat viditelně neúplné.
  const incomplete = validated.manifest.state !== "complete";
  const emptyAudio = existing.some((track) => track.sizeBytes === 0);
  const localState = existing.length === 0 ? "missing-audio"
    : existing.length === allFiles.length && !incomplete && !emptyAudio
      ? "complete-audio" : "partial-audio";
  const localReason = incomplete ? "Nahrávka nebyla dokončena. Dostupné původní zvukové soubory zůstávají na Macu."
    : emptyAudio ? "Očekávaný zvukový soubor je prázdný. Původní soubory zůstávají na Macu."
      : null;
  const sizeBytes = existing.length > 0
    ? existing.reduce((sum, track) => sum + track.sizeBytes, 0) : null;
  // Velikost se uživateli ukazuje podle souboru, který jde na server: hotový stereo.webm,
  // jinak smíchaný master. Původní stopy jsou jen místní kopie a sčítají se zvlášť.
  const uploadIndex = ["-stereo.webm", "-stereo-master.webm"].map((suffix) => (
    derivatives.findIndex((file, index) => file.exists
      && path.basename(derivativePaths[index]).endsWith(suffix))
  )).find((index) => index >= 0);
  const uploadSizeBytes = uploadIndex === undefined ? null : derivatives[uploadIndex].sizeBytes;
  const existingOriginals = tracks.filter((track) => track.exists);
  const originalsSizeBytes = existingOriginals.length > 0
    ? existingOriginals.reduce((sum, track) => sum + track.sizeBytes, 0) : null;
  return {
    identifiedId,
    uploadPreferencesLocked: typeof parsed.sessionId === "string" && parsed.sessionId.length > 0,
    invalid: false,
    createdAt: validated.manifest.createdAt,
    durationMs: durationFromManifest(validated.manifest, validated.sources),
    fileRevision: revisionFor(read, allFiles),
    localState,
    localReason,
    sizeBytes,
    uploadSizeBytes,
    originalsSizeBytes,
    originalsCount: existingOriginals.length,
    sources: validated.sources,
    trackNames: Object.fromEntries(validated.sources.map(
      (source) => [source, validated.manifest.tracks[source].fileName],
    )),
  };
}

function deliveryFilesForSnapshot(item, root, configuredRoot) {
  if (item.delivery === undefined) return [];
  const delivery = item.delivery;
  if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) return null;
  const expectedBase = path.join(
    root,
    path.basename(path.resolve(item.sourceManifestPath ?? item.manifestPath)),
  ).slice(0, -".manifest.json".length);
  const candidates = [delivery.sidecarPath];
  if (delivery.masterPath !== null) candidates.push(delivery.masterPath);
  if (delivery.state === "ready") candidates.push(delivery.filePath);
  if (
    delivery.clientRecordingId !== item.clientRecordingId
    || !["pending", "ready", "failed"].includes(delivery.state)
    || delivery.channels !== 2
    || delivery.mime !== "audio/webm"
    || delivery.channelMap?.left !== "microphone"
    || !["system", "silence"].includes(delivery.channelMap?.right)
    || directChild(root, delivery.sidecarPath, configuredRoot) !== `${expectedBase}.manifest.json.meeting-audio-v1.json`
    || directChild(root, delivery.filePath, configuredRoot) !== `${expectedBase}-stereo.webm`
    || (delivery.source === "live-stereo"
      && directChild(root, delivery.masterPath, configuredRoot) !== `${expectedBase}-stereo-master.webm`)
  ) return null;
  const safe = candidates.map((candidate) => directChild(root, candidate, configuredRoot));
  return safe.some((candidate) => candidate === null) || new Set(safe).size !== safe.length ? null : safe;
}

function safeQueueManifestPath(recordingsDirectory, configuredDirectory, item) {
  return directChild(
    recordingsDirectory,
    item.sourceManifestPath ?? item.manifestPath,
    configuredDirectory,
  );
}

function pausedWithoutRetry(item) {
  return item.state === "ceka" && item.uploadIntent === "approved"
    && item.requiresHumanAction !== true
    // Prošlý termín plánovač znovu nenaplánuje (review #201 k4): naplánované je jen budoucí opakování.
    && !(Number.isSafeInteger(item.nextAttemptAt) && item.nextAttemptAt > Date.now())
    && typeof item.lastFailureReason === "string" && item.lastFailureReason.trim().length > 0;
}

function safeQueueReason(value, paused = false) {
  if (typeof value !== "string" || value.length === 0) return null;
  if (SAFE_LEGACY_REASONS.has(value)) return value;
  if (value === "session_owner_unknown") return "Identitu aktuálního přihlášení nelze ověřit";
  if (/^(queue|session)_owner_[a-z0-9-]+$/u.test(value)) {
    return "Nahrávka čeká na potvrzení vlastnictví.";
  }
  const known = {
    unauthorized: "Server odmítl odeslání.",
    "rate_limited (HTTP 429)": "Server dočasně omezil odesílání.",
    "unauthorized (HTTP 401)": "Server odmítl odeslání.",
    network_error: "Spojení se serverem se nepodařilo.",
    "Síťový požadavek uploadu vypršel": "Spojení se serverem se nepodařilo.",
    "Seznam firem se nepodařilo získat; zkontrolujte přihlášení a spojení": "Seznam firem není dostupný.",
    insufficient_scope: "Přihlášení nemá oprávnění k odeslání.",
    "insufficient_scope (HTTP 403)": "Přihlášení nemá oprávnění k odeslání.",
    "Pro upload chybí přihlášení": "Pro odeslání chybí přihlášení.",
    "Přihlášení pro upload nelze načíst": "Přihlášení nelze ověřit.",
    "Přihlášení patří jinému serveru": "Přihlášení patří jinému serveru",
    company_not_chosen: "Před odesláním je potřeba vybrat firmu.",
    "Není vybraná firma, pod kterou se má nahrávka odeslat": "Před odesláním je potřeba vybrat firmu.",
    "Pro upload chybí identifikátor firmy": "Před odesláním je potřeba vybrat firmu.",
    company_binding_missing: "U této rozpracované nahrávky nelze bezpečně určit firmu.",
    "Rozpracovaná nahrávka nemá bezpečně uloženou firmu; otevřete Nastavení": "U této rozpracované nahrávky nelze bezpečně určit firmu.",
    "Uložená firma nahrávky není platná": "U této rozpracované nahrávky nelze bezpečně určit firmu.",
    company_out_of_scope: "Vybraná firma nahrávku nepřijala.",
    "company_out_of_scope (HTTP 403)": "Vybraná firma nahrávku nepřijala.",
    "403 company_out_of_scope": "Vybraná firma nahrávku nepřijala.",
    "Nedokončenou obnovenou nahrávku nelze bezpečně převést na stereo WebM":
      "Nahrávka nebyla dokončena a nelze ji bezpečně převést na stereo WebM.",
    "Nedokončenou nahrávku nelze bezpečně převést na stereo WebM":
      "Nahrávka nebyla dokončena a nelze ji bezpečně převést na stereo WebM.",
    "WebM po možném zahájení uploadu chybí; nesmí se znovu vytvořit s jinými bajty":
      "WebM po možném zahájení odeslání chybí. Nahrávka je pozastavená, aby se nezměnila její identita.",
    "Uložený WebM neodpovídá neměnné identitě připravené před uploadem":
      "Uložený WebM se změnil proti souboru připravenému před odesláním.",
    "Připravenému souboru chybí trvalá identita v sidecaru":
      "Připravenému souboru chybí ověřitelná identita. Odeslání je bezpečně pozastavené.",
    "Delivery sidecar neodpovídá neměnné identitě této nahrávky":
      "Uložená identita souboru nesouhlasí s nahrávkou. Odeslání je bezpečně pozastavené.",
    "Ready delivery sidecar změnil neměnnou identitu WebM":
      "Uložená identita připraveného souboru se změnila. Odeslání je bezpečně pozastavené.",
    "Rozpracovaný WebM nelze bezpečně nahradit":
      "Rozpracovaný soubor nelze bezpečně obnovit; původní stopy zůstávají uložené.",
    "Starší nahrávka mohla být na serveru už založena; automatický převod by vytvořil další záznam":
      "Starší nahrávka mohla být na serveru už založena. Automatické odeslání je pozastavené, aby nevznikl duplicitní záznam.",
    "Stereo master se před převodem změnil":
      "Stereo master se před převodem změnil; originály zůstávají uložené.",
  };
  const pausedCode = value.match(/^(storage_disabled|quota_exceeded|session_missing|session_not_found)(?: \(HTTP [0-9]{3}\))?$/u)?.[1];
  if (pausedCode === "storage_disabled") return "Úložiště serveru je dočasně vypnuté.";
  if (pausedCode === "quota_exceeded") return "Na serveru není dostatek místa pro nahrávku.";
  if (["session_missing", "session_not_found"].includes(pausedCode)) return "Serverovou relaci nahrávky nelze najít.";
  if (value.startsWith("Síťový požadavek uploadu selhal:")) return "Spojení se serverem se nepodařilo.";
  if (!Object.hasOwn(known, value) && /^[a-z0-9_]+ \(HTTP 403\)$/u.test(value)) return "Server odeslání odmítl.";
  return Object.hasOwn(known, value) ? known[value]
    : paused ? "Odeslání je pozastavené — důvod nezjištěn." : "Předchozí pokus se nezdařil.";
}

// Stejná kontrola jako po pokusu o navázání firmy v actOnRecording.
function companyRebindConflict(original, rebound, companyTabidooId) {
  return rebound === original && rebound.server?.companyTabidooId !== companyTabidooId;
}

function recordingActions({ rawItem, projected, inspected, queueModule, cooldown, sendingDisabled,
  currentCompanyId, identityKnown }) {
  const yes = () => ({ allowed: true, reason: null });
  const no = (reason, retryAt = null) => ({ allowed: false, reason,
    ...(retryAt !== null ? { retryAt } : {}) });
  const localProblem = inspected.invalid ? "Data nahrávky nelze bezpečně přečíst."
    : inspected.localState === "missing-audio" ? "Zvukové soubory chybí." : null;
  const unavailableOwner = projected.ownership === "unavailable"
    ? "Přihlášení k nahrávce nelze ověřit." : "Nahrávka nepatří aktuálnímu účtu.";
  const common = localProblem ?? (projected.ownership !== "current" ? unavailableOwner : null);
  const transport = sendingDisabled ? "Odesílání je vypnuté."
    : cooldown ? "Server dočasně omezil odesílání." : null;
  const transportNo = () => no(transport, cooldown?.retryAt ?? null);
  const send = common ? no(common) : transport ? transportNo()
    : projected.state === "ceka" && projected.uploadIntent === "held" ? yes()
      : no("Nahrávka není připravená k ručnímu odeslání.");

  let retry;
  if (common) retry = no(common);
  else if (transport) retry = transportNo();
  else if (projected.uploadIntent !== "approved" || !(projected.state === "selhalo"
    || (projected.state === "ceka" && (projected.requiresHumanAction === true || pausedWithoutRetry(projected))))) {
    retry = no("Nahrávka zatím nevyžaduje ruční opakování.");
  } else {
    const original = { ...rawItem, state: projected.state,
      lastFailureReason: rawItem.lastFailureReason ?? projected.lastFailureReason };
    const queue = { schemaVersion: 1, items: [original] };
    const rejected = ["company_out_of_scope (HTTP 403)", "403 company_out_of_scope"]
      .includes(original.lastFailureReason);
    if (rejected && original.uploadPreferences?.companyId != null) {
      retry = no(projected.uploadPreferencesLocked || inspected.uploadPreferencesLocked
        ? "Firmu této nahrávky už nelze změnit. Obrať se na správce LuDone."
        : "Nejdřív změň a ulož firmu této nahrávky.");
    } else if (rejected && !currentCompanyId) {
      retry = no("Aktuální výchozí firmu nelze v tomto přehledu bezpečně ověřit.");
    } else {
      try {
        const rebound = rejected
          ? queueModule.rebindCompanyOutOfScopeItem(queue, original.clientRecordingId, currentCompanyId)
          : { item: original, queue };
        if (rejected && companyRebindConflict(original, rebound.item, currentCompanyId)) {
          retry = no("Připnutá firma nahrávky neodpovídá aktuální výchozí firmě.");
        } else {
          const retried = queueModule.retryFailedItem(rebound.queue, original.clientRecordingId);
          retry = retried.item === original && original.state !== "ceka"
            ? no("Tuto nahrávku nelze bezpečně opakovat.") : yes();
        }
      } catch {
        retry = no("Podmínky opakování nelze bezpečně ověřit.");
      }
    }
  }
  const claim = localProblem ? no(localProblem)
    : !["ceka", "selhalo"].includes(projected.state) ? no("Nahrávku v tomto stavu nelze převzít.")
      : !["unknown", "other"].includes(projected.ownership) ? no("Nahrávku nelze převzít pod tento účet.")
        : projected.ownership === "unknown" && !identityKnown
          ? no("Přihlášení k převzetí nelze v tomto přehledu ověřit.") : yes();
  return { send, retry, claim };
}

function safeProjectedItem(projected) {
  return {
    id: projected.id,
    kind: "recording",
    state: ["ceka", "odesila", "odeslano", "selhalo"].includes(projected.state)
      ? projected.state : "neznámý",
    attempts: Number.isSafeInteger(projected.attempts) && projected.attempts >= 0
      ? projected.attempts : 0,
    nextAttemptAt: Number.isSafeInteger(projected.nextAttemptAt) && projected.nextAttemptAt >= 0
      ? projected.nextAttemptAt : null,
    server: projected.server,
    uploadPreferences: projected.uploadPreferences ?? null,
    uploadPreferencesLocked: projected.uploadPreferencesLocked === true,
    revision: projected.revision,
    ownership: ["unknown", "current", "other", "unavailable"].includes(projected.ownership)
      ? projected.ownership : "unavailable",
    requiresHumanAction: projected.requiresHumanAction === true,
    blockReason: safeQueueReason(projected.blockReason
      ?? (projected.requiresHumanAction === true || projected.state === "selhalo"
        || pausedWithoutRetry(projected) ? projected.lastFailureReason : null), pausedWithoutRetry(projected)),
    title: typeof projected.title === "string" ? projected.title : "",
    uploadIntent: projected.uploadIntent === "approved" ? "approved" : "held",
  };
}

function queueTracksMatchManifest(recordingsDirectory, configuredDirectory, item, inspected) {
  if (inspected.invalid || !Array.isArray(inspected.sources) || !inspected.trackNames) return false;
  if (!item.tracks || typeof item.tracks !== "object" || Array.isArray(item.tracks)) return false;
  const sources = Object.keys(item.tracks).sort();
  if (
    sources.length !== inspected.sources.length
    || sources.some((source, index) => source !== inspected.sources[index])
  ) return false;
  return sources.every((source) => {
    const queuePath = directChild(recordingsDirectory, item.tracks[source], configuredDirectory);
    return queuePath !== null
      && queuePath === path.join(recordingsDirectory, inspected.trackNames[source]);
  });
}

async function validateRecordingsRoot(root) {
  try {
    const stats = await fs.promises.lstat(root);
    if (!stats.isDirectory() || stats.isSymbolicLink()) throw new TypeError("neplatný adresář nahrávek");
    return { canonicalRoot: await fs.promises.realpath(root), exists: true };
  } catch (error) {
    if (error?.code === "ENOENT") return { canonicalRoot: root, exists: false };
    throw error;
  }
}

/**
 * @param {{ queue: any, queueItems: any[], recordingsDirectory: string, currentCompanyId?: string | null,
 *   identityKnown?: boolean }} options
 */
async function createLocalRecordingsSnapshot({ queue, queueItems, recordingsDirectory, currentCompanyId = null,
  identityKnown: identityKnownInput }) {
  const configuredRoot = path.resolve(recordingsDirectory);
  if (!queue || !Array.isArray(queue.items) || !Array.isArray(queueItems)) {
    throw new TypeError("lokální přehled vyžaduje platnou frontu a její projekci");
  }
  const { canonicalRoot: root, exists: rootExists } = await validateRecordingsRoot(configuredRoot);
  const queueById = new Map(queueItems.map((item) => [item.id, item]));
  const queueModule = await import("../src/lib/queue.js");
  // Výslovná informace od mainu má přednost; odhad z ostatních položek jen pro starší volající.
  const identityKnown = typeof identityKnownInput === "boolean" ? identityKnownInput
    : queueItems.some((item) => ["current", "other"].includes(item.ownership));
  const representedPaths = new Set();
  const seenIds = new Set();
  const items = [];
  let unreadableCount = 0;

  for (const rawItem of queue.items) {
    if ((rawItem.kind ?? "recording") !== "recording") continue;
    if (typeof rawItem.clientRecordingId !== "string" || !UUID_PATTERN.test(rawItem.clientRecordingId)) {
      unreadableCount += 1;
      continue;
    }
    const projected = queueById.get(rawItem.clientRecordingId);
    if (!projected) continue;
    const primaryPath = safeQueueManifestPath(root, configuredRoot, rawItem);
    if (primaryPath !== null) representedPaths.add(primaryPath);
    const derivativePaths = primaryPath === null ? null
      : deliveryFilesForSnapshot(rawItem, root, configuredRoot);
    const inspected = primaryPath === null || !rootExists || derivativePaths === null
      ? {
        invalid: true,
        identifiedId: rawItem.clientRecordingId,
        fileRevision: invalidRevision(primaryPath === null || derivativePaths === null
          ? "unsafe-manifest" : "missing-root"),
      }
      : await inspectManifest(root, primaryPath, derivativePaths);
    if (inspected.identifiedId !== null && inspected.identifiedId !== rawItem.clientRecordingId) {
      inspected.invalid = true;
      inspected.localState = undefined;
      inspected.createdAt = undefined;
      inspected.durationMs = undefined;
      inspected.sizeBytes = undefined;
    }
    if (!inspected.invalid && !queueTracksMatchManifest(root, configuredRoot, rawItem, inspected)) {
      inspected.invalid = true;
      inspected.localState = undefined;
      inspected.createdAt = undefined;
      inspected.durationMs = undefined;
      inspected.sizeBytes = undefined;
    }
    seenIds.add(projected.id);
    // Stejný přepínač jako v main.cjs platí i pro ruční send a retry v blokovaných stavech.
    const sendingDisabled = process.env.DESKTOP_UPLOAD_ENABLED !== undefined
      && process.env.DESKTOP_UPLOAD_ENABLED !== "true";
    // Limit patří účtu; otisk ani limit jiného vlastníka se do rendereru neposílají.
    const cooldown = projected.ownership === "current" && rawItem.ownerFingerprint
      ? (queue.uploadCooldowns ?? []).find((entry) => entry.ownerFingerprint === rawItem.ownerFingerprint
        && Number.isSafeInteger(entry.retryAt) && entry.retryAt > Date.now()) : null;
    const actions = recordingActions({ rawItem, projected, inspected, queueModule, cooldown,
      sendingDisabled, currentCompanyId, identityKnown });
    items.push({
      ...safeProjectedItem(projected),
      sendingDisabledReason: sendingDisabled ? "odesílání je vypnuté" : null,
      uploadRetryAt: cooldown?.retryAt ?? null,
      source: "queue",
      uploadPreferencesLocked: projected.uploadPreferencesLocked === true || inspected.uploadPreferencesLocked === true,
      localState: inspected.invalid ? "invalid-manifest" : inspected.localState,
      localReason: inspected.invalid ? "Primární manifest nelze bezpečně přečíst." : inspected.localReason ?? null,
      fileRevision: inspected.fileRevision ?? null,
      createdAt: inspected.createdAt ?? projected.createdAt ?? null,
      durationMs: inspected.durationMs ?? projected.durationMs ?? null,
      sizeBytes: inspected.invalid ? null : inspected.sizeBytes,
      uploadSizeBytes: inspected.invalid ? null : inspected.uploadSizeBytes ?? null,
      originalsSizeBytes: inspected.invalid ? null : inspected.originalsSizeBytes ?? null,
      originalsCount: inspected.invalid ? 0 : inspected.originalsCount ?? 0,
      deliveryState: rawItem.delivery?.state ?? null,
      uploadLocked: projected.uploadLocked === true,
      canConfigureUpload: !inspected.invalid && inspected.localState !== "missing-audio"
        && projected.ownership === "current" && !projected.uploadPreferencesLocked
        && !inspected.uploadPreferencesLocked
        && (projected.uploadIntent === "held" || queueModule.recordingCompanyRepairAvailable(rawItem)),
      actions,
      allowedActions: {
        claim: actions.claim.allowed,
        delete: !inspected.invalid && projected.state !== "odesila"
          && !projected.uploadLocked,
        retry: actions.retry.allowed,
        send: actions.send.allowed,
      },
    });
  }

  const entries = rootExists ? await fs.promises.readdir(root, { withFileTypes: true }) : [];
  const candidates = entries
    .filter((entry) => entry.name.endsWith(".manifest.json"))
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of candidates) {
    const candidatePath = path.join(root, entry.name);
    if (representedPaths.has(candidatePath)) continue;
    if (!entry.isFile() || entry.isSymbolicLink()) {
      unreadableCount += 1;
      continue;
    }
    const inspected = await inspectManifest(root, candidatePath);
    if (inspected.identifiedId === null || seenIds.has(inspected.identifiedId)) {
      unreadableCount += 1;
      continue;
    }
    seenIds.add(inspected.identifiedId);
    items.push({
      id: inspected.identifiedId,
      kind: "recording",
      source: "orphan",
      state: "orphan",
      revision: null,
      ownership: "unavailable",
      requiresHumanAction: false,
      blockReason: null,
      createdAt: inspected.createdAt ?? null,
      durationMs: inspected.durationMs ?? null,
      sizeBytes: inspected.invalid ? null : inspected.sizeBytes,
      uploadSizeBytes: inspected.invalid ? null : inspected.uploadSizeBytes ?? null,
      originalsSizeBytes: inspected.invalid ? null : inspected.originalsSizeBytes ?? null,
      originalsCount: inspected.invalid ? 0 : inspected.originalsCount ?? 0,
      localState: inspected.invalid ? "invalid-manifest" : inspected.localState,
      localReason: inspected.invalid ? "Primární manifest nelze bezpečně přečíst." : inspected.localReason ?? null,
      fileRevision: inspected.fileRevision ?? null,
      actions: Object.fromEntries(["send", "retry", "claim"].map((action) => [action,
        { allowed: false, reason: "Nahrávka není zařazená ve frontě." }])),
      allowedActions: { claim: false, delete: !inspected.invalid, retry: false, send: false },
    });
  }
  return { items, unreadableCount };
}

module.exports = {
  createLocalRecordingsSnapshot,
  companyRebindConflict,
  readStableRegularFile,
};
