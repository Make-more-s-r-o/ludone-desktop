const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const QUEUE_SCHEMA_VERSION = 1;

function emptyQueue() {
  return { schemaVersion: QUEUE_SCHEMA_VERSION, items: [] };
}

function validateQueue(queue) {
  if (
    !queue
    || typeof queue !== "object"
    || Array.isArray(queue)
    || queue.schemaVersion !== QUEUE_SCHEMA_VERSION
    || !Array.isArray(queue.items)
  ) {
    throw new TypeError("soubor fronty neodpovídá schématu v1");
  }
  return queue;
}

/** Načte frontu; neexistující soubor znamená dosud prázdnou frontu. */
async function loadQueue(filePath) {
  try {
    const contents = await fs.promises.readFile(filePath, "utf8");
    return validateQueue(JSON.parse(contents));
  } catch (error) {
    if (error && error.code === "ENOENT") return emptyQueue();
    throw error;
  }
}

/** Atomický zápis ve stejném adresáři: temp soubor, fsync a rename. */
async function saveQueueAtomically(filePath, queue) {
  validateQueue(queue);
  const directory = path.dirname(filePath);
  await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await fs.promises.open(temporaryPath, "wx", 0o600);
    await handle.writeFile(JSON.stringify(queue), "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.promises.rename(temporaryPath, filePath);

    // fsync adresáře zajišťuje, že rename přežije i náhlý pád procesu nebo stroje.
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

  return path.resolve(filePath);
}

/**
 * Vlastník perzistentní fronty. Všechny operace nad jedním souborem řadí do
 * jediného promise řetězu, aby souběžná IPC volání nemohla přepsat novější stav.
 */
function createOutboundQueueStore({ filePath, queueModulePromise, send }) {
  if (typeof filePath !== "string" || filePath.length === 0) {
    throw new TypeError("filePath fronty je povinný");
  }
  if (!queueModulePromise || typeof queueModulePromise.then !== "function") {
    throw new TypeError("queueModulePromise je povinný Promise");
  }
  if (typeof send !== "function") throw new TypeError("send musí být funkce");

  let currentQueue;
  let loaded = false;
  /** @type {Promise<unknown>} */
  let operations = Promise.resolve();

  /**
   * @template T
   * @param {() => Promise<T>} operation
   * @returns {Promise<T>}
   */
  function serialize(operation) {
    const result = operations.then(operation);
    operations = result.then(() => undefined, () => undefined);
    return result;
  }

  async function loadQueueModule() {
    const queueModule = await queueModulePromise;
    for (const name of [
      "enqueueRecording",
      "enqueueTimeEntry",
      "processNext",
      "reduceQueueForRenderer",
    ]) {
      if (typeof queueModule[name] !== "function") {
        throw new TypeError(`modul fronty nemá funkci ${name}`);
      }
    }
    return queueModule;
  }

  async function ensureLoaded() {
    if (!loaded) {
      currentQueue = await loadQueue(filePath);
      loaded = true;
    }
    return currentQueue;
  }

  async function commit(queue) {
    try {
      await saveQueueAtomically(filePath, queue);
    } catch (error) {
      // Rename už mohl uspět a selhat mohl až fsync adresáře. Další operace
      // proto musí znovu načíst disk místo přepsání novějšího stavu starou cache.
      currentQueue = undefined;
      loaded = false;
      throw error;
    }
    currentQueue = queue;
    loaded = true;
  }

  function enqueueRecording(recording) {
    return serialize(async () => {
      const queueModule = await loadQueueModule();
      const result = queueModule.enqueueRecording(await ensureLoaded(), recording);
      if (result.added) await commit(result.queue);
      return result;
    });
  }

  function enqueueTimeEntry(entry) {
    return serialize(async () => {
      const queueModule = await loadQueueModule();
      const result = queueModule.enqueueTimeEntry(await ensureLoaded(), entry);
      if (result.added) await commit(result.queue);
      return result;
    });
  }

  async function processOne(killswitches) {
    const queueModule = await loadQueueModule();
    const before = await ensureLoaded();
    const result = await queueModule.processNext(before, killswitches, send);
    if (result.queue !== before) await commit(result.queue);
    return { queueModule, result };
  }

  function pump(killswitches) {
    return serialize(async () => (await processOne(killswitches)).result);
  }

  function list() {
    return serialize(async () => {
      const queueModule = await loadQueueModule();
      return queueModule.reduceQueueForRenderer(await ensureLoaded());
    });
  }

  function retry(killswitches) {
    return serialize(async () => {
      const queueModule = await loadQueueModule();
      const queue = await ensureLoaded();
      let changed = false;
      const items = queue.items.map((item) => {
        if (item.state !== "ceka" || item.nextAttemptAt === null) return item;
        changed = true;
        return { ...item, nextAttemptAt: null };
      });
      if (changed) await commit({ ...queue, items });

      const { result } = await processOne(killswitches);
      return {
        outcome: result.outcome,
        reason: result.reason,
        items: queueModule.reduceQueueForRenderer(currentQueue),
      };
    });
  }

  return Object.freeze({ enqueueRecording, enqueueTimeEntry, list, pump, retry });
}

module.exports = { createOutboundQueueStore, loadQueue, saveQueueAtomically };
