const { unlink } = require("node:fs/promises");

const DAY_MS = 24 * 60 * 60 * 1_000;

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

/**
 * @param {unknown} error
 * @returns {{ code: string | null, message: string }}
 */
function describeError(error) {
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : null;
  const message = error instanceof Error ? error.message : String(error);
  return { code, message };
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
 * @param {{ queue: { items?: Array<Record<string, unknown>> }, policy: unknown, now: number | Date }} options
 */
async function applyRetention({ queue, policy, now }) {
  const plan = planRetention(queue, policy, now);
  const deletedFiles = [];
  const deletedItems = [];
  const errors = [];

  for (const candidate of plan.toDelete) {
    let itemFailed = false;
    for (const filePath of candidate.files) {
      try {
        await unlink(filePath);
        deletedFiles.push(filePath);
      } catch (error) {
        const detail = describeError(error);
        if (detail.code !== "ENOENT") {
          itemFailed = true;
          errors.push({ filePath, ...detail });
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
