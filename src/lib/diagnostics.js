import { open as openFile, unlink } from "node:fs/promises";
import path from "node:path";

const PERMISSION_LABELS = Object.freeze({
  denied: "Nepovoleno",
  granted: "Povoleno",
  "not-determined": "Zatím neurčeno",
  restricted: "Omezeno systémem",
  unknown: "Stav není známý",
});

const ARCHITECTURE_LABELS = Object.freeze({
  arm64: "Apple Silicon",
  x64: "Intel",
});

function normalizedPermission(status) {
  const normalized = Object.hasOwn(PERMISSION_LABELS, status) ? status : "unknown";
  return Object.freeze({ status: normalized, label: PERMISSION_LABELS[normalized] });
}

function normalizedVersion(value) {
  if (typeof value !== "string") return "Neznámá";
  const version = value.trim();
  return /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/u.test(version) ? version : "Neznámá";
}

function normalizedArchitecture(value) {
  return ARCHITECTURE_LABELS[value] ?? "Neznámá";
}

function canonicalIso(value) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function localTime(iso) {
  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  }).format(new Date(iso));
}

function queueProjection(queueItems) {
  if (!Array.isArray(queueItems)) {
    return {
      queue: Object.freeze({ available: false, waiting: 0, sending: 0, failed: 0 }),
      lastSuccessfulAt: null,
    };
  }

  let waiting = 0;
  let sending = 0;
  let failed = 0;
  let lastSuccessfulAt = null;
  let lastSuccessfulMilliseconds = Number.NEGATIVE_INFINITY;

  for (const item of queueItems) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    if (item.state === "ceka") waiting += 1;
    else if (item.state === "odesila") sending += 1;
    else if (item.state === "selhalo") failed += 1;
    else if (item.state === "odeslano") {
      const sentAt = canonicalIso(item.sentAt);
      const milliseconds = sentAt === null ? Number.NaN : Date.parse(sentAt);
      if (Number.isFinite(milliseconds) && milliseconds > lastSuccessfulMilliseconds) {
        lastSuccessfulMilliseconds = milliseconds;
        lastSuccessfulAt = sentAt;
      }
    }
  }

  return {
    queue: Object.freeze({ available: true, waiting, sending, failed }),
    lastSuccessfulAt,
  };
}

/**
 * Sestaví jedinou bezpečnou projekci pro UI. Celé položky fronty zůstanou v hlavním
 * procesu: do rendereru se nedostanou ID, důvody chyb, názvy ani cesty.
 */
export function createDiagnosticsSnapshot({
  appVersion,
  architecture,
  microphoneStatus,
  queueItems,
  systemAudioStatus,
}) {
  const projectedQueue = queueProjection(queueItems);
  const queue = projectedQueue.queue;
  const lastSuccessfulAt = projectedQueue.lastSuccessfulAt;
  const serverConnection = lastSuccessfulAt === null
    ? {
        status: "unknown",
        label: "Zatím bez zaznamenaného úspěšného volání",
        lastSuccessfulAt: null,
      }
    : {
        status: "last-success",
        label: `Naposledy v pořádku v ${localTime(lastSuccessfulAt)}`,
        lastSuccessfulAt,
      };

  return Object.freeze({
    version: normalizedVersion(appVersion),
    architecture: normalizedArchitecture(architecture),
    permissions: Object.freeze({
      microphone: normalizedPermission(microphoneStatus),
      systemAudio: normalizedPermission(systemAudioStatus),
    }),
    serverConnection: Object.freeze(serverConnection),
    queue,
  });
}

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function normalizedSnapshotForExport(snapshot) {
  const microphone = normalizedPermission(snapshot?.permissions?.microphone?.status);
  const systemAudio = normalizedPermission(snapshot?.permissions?.systemAudio?.status);
  const lastSuccessfulAt = snapshot?.serverConnection?.status === "last-success"
    ? canonicalIso(snapshot.serverConnection.lastSuccessfulAt)
    : null;
  const queueAvailable = snapshot?.queue?.available === true;

  return {
    version: normalizedVersion(snapshot?.version),
    architecture: ["Apple Silicon", "Intel"].includes(snapshot?.architecture)
      ? snapshot.architecture
      : "Neznámá",
    microphone: microphone.label,
    systemAudio: systemAudio.label,
    lastSuccessfulAt,
    queue: {
      available: queueAvailable,
      waiting: queueAvailable ? safeCount(snapshot?.queue?.waiting) : 0,
      sending: queueAvailable ? safeCount(snapshot?.queue?.sending) : 0,
      failed: queueAvailable ? safeCount(snapshot?.queue?.failed) : 0,
    },
  };
}

/**
 * Text se skládá z pevného allowlistu. Záměrně tu není JSON.stringify ani spread
 * vstupu: nové pole ve stavu aplikace se samo do exportu nikdy nedostane.
 */
export function formatDiagnosticsExport(snapshot) {
  const safe = normalizedSnapshotForExport(snapshot);
  const server = safe.lastSuccessfulAt === null
    ? "zatím bez zaznamenaného úspěšného volání"
    : `naposledy potvrzeno ${safe.lastSuccessfulAt}`;
  const queue = safe.queue.available
    ? `čeká ${safe.queue.waiting}; odesílá se ${safe.queue.sending}; selhalo ${safe.queue.failed}`
    : "stav není dostupný";

  return [
    "LuDone Desktop — diagnostika",
    `Verze: ${safe.version}`,
    `Architektura: ${safe.architecture}`,
    `Mikrofon: ${safe.microphone}`,
    `Ostatní zvuk: ${safe.systemAudio}`,
    `Spojení se serverem: ${server}`,
    `Fronta: ${queue}`,
    "",
    "Soubor neobsahuje zvuk, přihlašovací údaje, tokeny, názvy schůzek ani cesty k souborům.",
    "",
  ].join("\n");
}

function timestampForFileName(exportedAt) {
  const date = exportedAt instanceof Date ? exportedAt : new Date(exportedAt);
  if (!Number.isFinite(date.getTime())) throw new TypeError("Čas exportu není platný");
  return date.toISOString()
    .slice(0, 19)
    .replace("T", "-")
    .replaceAll(":", "");
}

/** Zapíše nový soubor s právy 0600 a nikdy nevrací jeho absolutní cestu. */
export async function writeDiagnosticsExport({ downloadsDirectory, exportedAt, snapshot }) {
  if (typeof downloadsDirectory !== "string" || downloadsDirectory.length === 0) {
    throw new TypeError("Složka Stažené není dostupná");
  }
  const root = path.resolve(downloadsDirectory);
  const stem = `ludone-diagnostika-${timestampForFileName(exportedAt)}`;
  const contents = formatDiagnosticsExport(snapshot);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    const fileName = `${stem}${suffix}.txt`;
    const targetPath = path.resolve(root, fileName);
    if (path.dirname(targetPath) !== root) {
      throw new Error("Cílový soubor neleží přímo ve složce Stažené");
    }

    let handle;
    try {
      handle = await openFile(targetPath, "wx", 0o600);
    } catch (error) {
      if (error?.code === "EEXIST") continue;
      throw error;
    }

    try {
      await handle.writeFile(contents, { encoding: "utf8" });
      await handle.chmod(0o600);
      await handle.sync();
      await handle.close();
      handle = undefined;
      return { ok: true, fileName };
    } catch (error) {
      await handle?.close().catch(() => {});
      await unlink(targetPath).catch(() => {});
      throw error;
    }
  }

  throw new Error("Pro diagnostiku se nepodařilo vybrat volný název souboru");
}
