const nodeFs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const TRACKING_SCHEMA_VERSION = 1;
const TRACKING_STATES = Object.freeze({
  RUNNING: "bezi",
  PENDING: "ceka-na-potvrzeni",
  CLOSED: "uzavreno",
});
const TIME_DISABLED_REASON = "měření času je vypnuté";
const TRACKING_SAVED_LOG_PREFIX = "[tracking] Uloženo:";
const WALL_CLOCK_MOVED_BACKWARD = "wall-clock-moved-backward";
const PROJECT_GUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const RECOVERY_DECISIONS = new Set(["pokracovat", "ukoncit", "zahodit"]);
const CLOSED_REASONS = new Set([
  "stop",
  "switch",
  "potvrzeno-po-obnove",
  "zahozeno-clovekem",
]);

function emptyState() {
  return { schemaVersion: TRACKING_SCHEMA_VERSION, aktualni: null, uzavrene: [] };
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function timestampMilliseconds(value, fieldName) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new TypeError(`${fieldName} musí být platná ISO značka`);
  }
  const milliseconds = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new TypeError(`${fieldName} musí být platná ISO značka`);
  }
  return milliseconds;
}

function requireIsoTimestamp(value, fieldName) {
  const milliseconds = typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (
    typeof value !== "string"
    || !Number.isFinite(milliseconds)
    || new Date(milliseconds).toISOString() !== value
  ) {
    throw new TypeError(`${fieldName} musí být platná ISO značka`);
  }
  return milliseconds;
}

function floorToMinute(value) {
  const milliseconds = timestampMilliseconds(value, "čas");
  return new Date(Math.floor(milliseconds / 60_000) * 60_000).toISOString();
}

function requireProjectGuid(projectId) {
  if (typeof projectId !== "string" || !PROJECT_GUID_PATTERN.test(projectId)) {
    throw new TypeError("projectId musí být GUID projektu, ne název");
  }
  return projectId;
}

function requireNote(note) {
  if (note === undefined || note === null) return null;
  if (typeof note !== "string") throw new TypeError("note musí být text nebo null");
  return note;
}

function isGuid(value) {
  return typeof value === "string" && PROJECT_GUID_PATTERN.test(value);
}

function isCanonicalIso(value) {
  if (typeof value !== "string") return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function isCurrentEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
  if (!isGuid(entry.clientTimeEntryId) || !isGuid(entry.projectId)) return false;
  if (!isCanonicalIso(entry.startedAt) || !isCanonicalIso(entry.startedAtRaw)) return false;
  if (!isCanonicalIso(entry.processStartedAt)) return false;
  if (floorToMinute(entry.startedAt) !== entry.startedAt) return false;
  if (Date.parse(entry.startedAtRaw) < Date.parse(entry.startedAt)) return false;
  if (entry.note !== null && typeof entry.note !== "string") return false;
  if (entry.clockAnomaly !== undefined && entry.clockAnomaly !== WALL_CLOCK_MOVED_BACKWARD) {
    return false;
  }

  const hasEndedAt = Object.prototype.hasOwnProperty.call(entry, "endedAt");
  const hasMinutes = Object.prototype.hasOwnProperty.call(entry, "minutes");
  if (hasEndedAt !== hasMinutes) return false;
  if (
    entry.state === TRACKING_STATES.PENDING
    && entry.clockAnomaly === WALL_CLOCK_MOVED_BACKWARD
    && !hasEndedAt
  ) {
    return false;
  }
  if (hasEndedAt) {
    if (entry.state !== TRACKING_STATES.PENDING) return false;
    if (entry.clockAnomaly !== WALL_CLOCK_MOVED_BACKWARD) return false;
    if (!isCanonicalIso(entry.endedAt) || floorToMinute(entry.endedAt) !== entry.endedAt) {
      return false;
    }
    const expectedMinutes = (Date.parse(entry.endedAt) - Date.parse(entry.startedAt)) / 60_000;
    if (
      !Number.isSafeInteger(entry.minutes)
      || entry.minutes < 0
      || entry.minutes !== expectedMinutes
    ) {
      return false;
    }
  }
  return entry.state === TRACKING_STATES.RUNNING || entry.state === TRACKING_STATES.PENDING;
}

function isClosedEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
  if (!isGuid(entry.clientTimeEntryId) || !isGuid(entry.projectId)) return false;
  if (!isCanonicalIso(entry.startedAt) || !isCanonicalIso(entry.endedAt)) return false;
  if (floorToMinute(entry.startedAt) !== entry.startedAt) return false;
  if (floorToMinute(entry.endedAt) !== entry.endedAt) return false;
  const expectedMinutes = (Date.parse(entry.endedAt) - Date.parse(entry.startedAt)) / 60_000;
  return entry.state === TRACKING_STATES.CLOSED
    && CLOSED_REASONS.has(entry.closedReason)
    && (entry.clockAnomaly === undefined || entry.clockAnomaly === WALL_CLOCK_MOVED_BACKWARD)
    && Number.isSafeInteger(entry.minutes)
    && entry.minutes >= 0
    && entry.minutes === expectedMinutes;
}

function validateState(value) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || value.schemaVersion !== TRACKING_SCHEMA_VERSION
    || (value.aktualni !== null && !isCurrentEntry(value.aktualni))
    || !Array.isArray(value.uzavrene)
    || !value.uzavrene.every(isClosedEntry)
  ) {
    throw new TypeError("soubor časovače neodpovídá schématu v1");
  }
  return value;
}

function operationResult(outcome, { entry = null, closed = null, reason = null } = {}) {
  return { outcome, entry: copy(entry), closed: copy(closed), reason };
}

function observedEndBoundary(entry, nowValue) {
  const startedAtMilliseconds = timestampMilliseconds(entry.startedAt, "startedAt");
  const startedAtRawMilliseconds = timestampMilliseconds(entry.startedAtRaw, "startedAtRaw");
  const observedNowMilliseconds = timestampMilliseconds(nowValue, "endedAt");
  const observedEndedAt = floorToMinute(nowValue);
  const observedEndedAtMilliseconds = timestampMilliseconds(observedEndedAt, "endedAt");
  return {
    endedAt: new Date(Math.max(startedAtMilliseconds, observedEndedAtMilliseconds)).toISOString(),
    movedBackward: observedNowMilliseconds < startedAtRawMilliseconds,
  };
}

function pendingClockAnomalyEntry(entry, endedAt) {
  const startedAtMilliseconds = timestampMilliseconds(entry.startedAt, "startedAt");
  const endedAtMilliseconds = timestampMilliseconds(endedAt, "endedAt");
  return {
    ...entry,
    endedAt,
    minutes: (endedAtMilliseconds - startedAtMilliseconds) / 60_000,
    state: TRACKING_STATES.PENDING,
    clockAnomaly: WALL_CLOCK_MOVED_BACKWARD,
  };
}

function closedEntry(entry, endedAt, closedReason, forcedMinutes) {
  const startMilliseconds = timestampMilliseconds(entry.startedAt, "startedAt");
  const endMilliseconds = timestampMilliseconds(endedAt, "endedAt");
  if (endMilliseconds < startMilliseconds) {
    throw new TypeError("endedAt nesmí být dřív než startedAt");
  }
  const minutes = forcedMinutes ?? (endMilliseconds - startMilliseconds) / 60_000;
  if (!Number.isSafeInteger(minutes) || minutes < 0) {
    throw new TypeError("minutes nesmí být záporné ani necelé");
  }
  const closed = {
    clientTimeEntryId: entry.clientTimeEntryId,
    projectId: entry.projectId,
    startedAt: entry.startedAt,
    endedAt,
    minutes,
    state: TRACKING_STATES.CLOSED,
    closedReason,
  };
  if (entry.clockAnomaly === WALL_CLOCK_MOVED_BACKWARD) {
    closed.clockAnomaly = WALL_CLOCK_MOVED_BACKWARD;
  }
  return closed;
}

/** Atomický zápis: temp soubor, fsync dat, rename a fsync adresáře. */
async function writeStateAtomically(filePath, state, { fs = nodeFs, log = console.log } = {}) {
  validateState(state);
  const directory = path.dirname(filePath);
  await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await fs.promises.open(temporaryPath, "wx", 0o600);
    await handle.writeFile(JSON.stringify(state), "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.promises.rename(temporaryPath, filePath);

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
  log(`${TRACKING_SAVED_LOG_PREFIX} ${path.resolve(filePath)}`);
  return path.resolve(filePath);
}

function createTrackingStore(deps) {
  if (!deps || typeof deps !== "object" || Array.isArray(deps)) {
    throw new TypeError("závislosti časovače musí být objekt");
  }
  if (typeof deps.filePath !== "string" || deps.filePath.length === 0) {
    throw new TypeError("filePath je povinný");
  }
  if (!Object.prototype.hasOwnProperty.call(deps, "timeEnabled")) {
    throw new TypeError("timeEnabled je povinný argument");
  }

  const {
    filePath,
    timeEnabled,
    processStartedAt = new Date().toISOString(),
    fs = nodeFs,
    now = Date.now,
    newId = randomUUID,
    log = console.log,
  } = deps;
  timestampMilliseconds(processStartedAt, "processStartedAt");
  let state = emptyState();
  let loaded = false;
  /** @type {Promise<unknown>} */
  let queue = Promise.resolve();

  /**
   * @template T
   * @param {() => T | Promise<T>} operation
   * @returns {Promise<T>}
   */
  function enqueue(operation) {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  }

  async function readState() {
    try {
      const contents = await fs.promises.readFile(filePath, "utf8");
      return validateState(JSON.parse(contents));
    } catch (error) {
      if (error && error.code === "ENOENT") return emptyState();
      throw error;
    }
  }

  async function commit(nextState) {
    await writeStateAtomically(filePath, nextState, { fs, log });
    state = nextState;
    loaded = true;
  }

  async function loadCurrentState() {
    const loadedState = await readState();
    const currentEntry = loadedState.aktualni;
    if (currentEntry) {
      const boundary = observedEndBoundary(currentEntry, now());
      if (
        currentEntry.state === TRACKING_STATES.PENDING
        && currentEntry.clockAnomaly === WALL_CLOCK_MOVED_BACKWARD
      ) {
        state = loadedState;
        loaded = true;
        return state;
      }
      const restarted = currentEntry.state === TRACKING_STATES.RUNNING
        && currentEntry.processStartedAt !== processStartedAt;
      const clockMovedBackward = boundary.movedBackward;
      if (!restarted && !clockMovedBackward) {
        state = loadedState;
        loaded = true;
        return state;
      }

      let pendingEntry = { ...currentEntry, state: TRACKING_STATES.PENDING };
      if (
        clockMovedBackward
        || currentEntry.clockAnomaly === WALL_CLOCK_MOVED_BACKWARD
      ) {
        pendingEntry = pendingClockAnomalyEntry(currentEntry, boundary.endedAt);
      }
      const recoveredState = {
        ...loadedState,
        aktualni: pendingEntry,
      };
      await commit(recoveredState);
      return state;
    }
    state = loadedState;
    loaded = true;
    return state;
  }

  async function ensureLoaded() {
    if (!loaded) await loadCurrentState();
  }

  function disabledResult() {
    return operationResult("disabled", { reason: TIME_DISABLED_REASON });
  }

  async function load() {
    return enqueue(async () => copy(await loadCurrentState()));
  }

  function getState() {
    return copy(state);
  }

  async function start(payload = {}) {
    return enqueue(async () => {
      if (timeEnabled !== "true") return disabledResult();
      const projectId = requireProjectGuid(payload.projectId);
      const note = requireNote(payload.note);
      await ensureLoaded();
      if (state.aktualni) return operationResult("noop", { entry: state.aktualni });

      const startedAtRaw = new Date(now()).toISOString();
      const clientTimeEntryId = newId();
      if (typeof clientTimeEntryId !== "string" || !PROJECT_GUID_PATTERN.test(clientTimeEntryId)) {
        throw new TypeError("newId musí vrátit neprázdný UUID");
      }
      const entry = {
        clientTimeEntryId,
        projectId,
        startedAt: floorToMinute(startedAtRaw),
        startedAtRaw,
        processStartedAt,
        note,
        state: TRACKING_STATES.RUNNING,
      };
      await commit({ ...state, aktualni: entry });
      return operationResult("started", { entry });
    });
  }

  async function switchProject(payload = {}) {
    return enqueue(async () => {
      if (timeEnabled !== "true") return disabledResult();
      const projectId = requireProjectGuid(payload.projectId);
      await ensureLoaded();
      if (state.aktualni?.state !== TRACKING_STATES.RUNNING) {
        return operationResult("noop", { entry: state.aktualni });
      }

      const boundaryRaw = new Date(now()).toISOString();
      const boundary = observedEndBoundary(state.aktualni, boundaryRaw);
      if (
        boundary.movedBackward
        || state.aktualni.clockAnomaly === WALL_CLOCK_MOVED_BACKWARD
      ) {
        const entry = pendingClockAnomalyEntry(state.aktualni, boundary.endedAt);
        await commit({ ...state, aktualni: entry });
        return operationResult("pending", { entry });
      }

      const closed = closedEntry(state.aktualni, boundary.endedAt, "switch");
      const clientTimeEntryId = newId();
      if (typeof clientTimeEntryId !== "string" || !PROJECT_GUID_PATTERN.test(clientTimeEntryId)) {
        throw new TypeError("newId musí vrátit neprázdný UUID");
      }
      const entry = {
        clientTimeEntryId,
        projectId,
        startedAt: boundary.endedAt,
        startedAtRaw: boundaryRaw,
        processStartedAt,
        note: null,
        state: TRACKING_STATES.RUNNING,
      };
      await commit({
        ...state,
        aktualni: entry,
        uzavrene: [...state.uzavrene, closed],
      });
      return operationResult("switched", { entry, closed });
    });
  }

  async function stop() {
    return enqueue(async () => {
      if (timeEnabled !== "true") return disabledResult();
      await ensureLoaded();
      if (state.aktualni?.state !== TRACKING_STATES.RUNNING) {
        return operationResult("noop", { entry: state.aktualni });
      }

      const boundary = observedEndBoundary(state.aktualni, now());
      if (
        boundary.movedBackward
        || state.aktualni.clockAnomaly === WALL_CLOCK_MOVED_BACKWARD
      ) {
        const entry = pendingClockAnomalyEntry(state.aktualni, boundary.endedAt);
        await commit({ ...state, aktualni: entry });
        return operationResult("pending", { entry });
      }

      const closed = closedEntry(state.aktualni, boundary.endedAt, "stop");
      await commit({
        ...state,
        aktualni: null,
        uzavrene: [...state.uzavrene, closed],
      });
      return operationResult("stopped", { closed });
    });
  }

  async function resolveRecovered(payload = {}) {
    return enqueue(async () => {
      if (timeEnabled !== "true") return disabledResult();
      const { decision, endedAt } = payload;
      if (!RECOVERY_DECISIONS.has(decision)) {
        throw new TypeError("decision musí být pokracovat, ukoncit nebo zahodit");
      }
      await ensureLoaded();
      if (state.aktualni?.state !== TRACKING_STATES.PENDING) {
        return operationResult("noop", { entry: state.aktualni });
      }

      const wallClockNow = now();
      const boundary = observedEndBoundary(state.aktualni, wallClockNow);
      let currentEntry = state.aktualni;
      if (
        boundary.movedBackward
        && currentEntry.clockAnomaly !== WALL_CLOCK_MOVED_BACKWARD
      ) {
        currentEntry = pendingClockAnomalyEntry(currentEntry, boundary.endedAt);
        await commit({ ...state, aktualni: currentEntry });
      }

      if (decision === "pokracovat") {
        const entry = {
          ...currentEntry,
          processStartedAt,
          state: TRACKING_STATES.RUNNING,
        };
        delete entry.endedAt;
        delete entry.minutes;
        await commit({ ...state, aktualni: entry });
        return operationResult("resolved", { entry });
      }

      let closed;
      if (decision === "ukoncit") {
        const endedAtMilliseconds = requireIsoTimestamp(endedAt, "endedAt");
        const startedAtMilliseconds = timestampMilliseconds(currentEntry.startedAt, "startedAt");
        if (endedAtMilliseconds < startedAtMilliseconds) {
          throw new TypeError("endedAt nesmí být dřív než startedAt");
        }
        const clockMovedBackward = boundary.movedBackward;
        if (endedAtMilliseconds > wallClockNow && !clockMovedBackward) {
          throw new TypeError("endedAt nesmí být v budoucnosti");
        }
        closed = closedEntry(
          currentEntry,
          floorToMinute(endedAtMilliseconds),
          "potvrzeno-po-obnove",
        );
      } else {
        closed = closedEntry(
          currentEntry,
          currentEntry.startedAt,
          "zahozeno-clovekem",
          0,
        );
      }
      await commit({
        ...state,
        aktualni: null,
        uzavrene: [...state.uzavrene, closed],
      });
      return operationResult("resolved", { closed });
    });
  }

  return { load, getState, start, switchProject, stop, resolveRecovered };
}

function handleRendererGone(store, { log = console.log } = {}) {
  const state = store.getState();
  if (state.aktualni?.state === TRACKING_STATES.RUNNING) {
    log(`[tracking] Renderer skončil, časovač běží dál: ${state.aktualni.clientTimeEntryId}`);
  }
}

module.exports = {
  TRACKING_SCHEMA_VERSION,
  TRACKING_STATES,
  TIME_DISABLED_REASON,
  TRACKING_SAVED_LOG_PREFIX,
  floorToMinute,
  createTrackingStore,
  handleRendererGone,
};
