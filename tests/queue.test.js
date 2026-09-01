import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import queueStore from "../electron/queue.cjs";
import { createManifest } from "../src/lib/manifest.js";
import {
  FAILURE_CLASSES,
  QUEUE_ITEM_KINDS,
  QUEUE_STATES,
  UPLOAD_DISABLED_REASON,
  applyServerProgress,
  createQueue,
  enqueueRecording,
  enqueueTimeEntry,
  killswitchNameForKind,
  processNext,
  reduceQueueForRenderer,
  retryDelayMs,
} from "../src/lib/queue.js";

const { createOutboundQueueStore, loadQueue, saveQueueAtomically } = queueStore;
const ORIGINAL_UPLOAD_SETTING = process.env.DESKTOP_UPLOAD_ENABLED;
const ORIGINAL_TIME_SETTING = process.env.DESKTOP_TIME_ENABLED;
const ENABLED_SETTING = ["tr", "ue"].join("");

afterEach(() => {
  if (ORIGINAL_UPLOAD_SETTING === undefined) delete process.env.DESKTOP_UPLOAD_ENABLED;
  else process.env.DESKTOP_UPLOAD_ENABLED = ORIGINAL_UPLOAD_SETTING;
  if (ORIGINAL_TIME_SETTING === undefined) delete process.env.DESKTOP_TIME_ENABLED;
  else process.env.DESKTOP_TIME_ENABLED = ORIGINAL_TIME_SETTING;
  vi.restoreAllMocks();
});

function recording(clientRecordingId = "9e586e55-d688-43f1-8a80-a3d61e754f3e") {
  const startedAt = "2026-08-25T08:00:00.000Z";
  const endedAt = "2026-08-25T08:30:00.000Z";
  const manifest = createManifest({
    clientRecordingId,
    createdAt: startedAt,
    closedAt: endedAt,
    tracks: {
      microphone: {
        fileName: "session-microphone.webm",
        startedAt,
        endedAt,
        sizeBytes: 120,
        sha256: "a".repeat(64),
      },
      system: {
        fileName: "session-system.webm",
        startedAt,
        endedAt,
        sizeBytes: 240,
        sha256: "b".repeat(64),
      },
    },
  }, "complete");

  return {
    manifest,
    manifestPath: `/nahravky/${clientRecordingId}.manifest.json`,
    trackPaths: {
      microphone: `/nahravky/${manifest.tracks.microphone.fileName}`,
      system: `/nahravky/${manifest.tracks.system.fileName}`,
    },
  };
}

function oneItemQueue(clientRecordingId) {
  return enqueueRecording(createQueue(), recording(clientRecordingId), 1_777_000_000_000).queue;
}

function timeEntry(clientTimeEntryId = "7c1f9ab3-1a84-47b3-91eb-7cd4c13f86d8") {
  return {
    clientTimeEntryId,
    projectId: "b3d0d7ee-53c2-4bc9-9e74-59f7f62b799f",
    startedAt: "2026-09-01T08:00:00.000Z",
    endedAt: "2026-09-01T09:00:00.000Z",
    minutes: 60,
    state: "uzavreno",
    closedReason: "stop",
  };
}

function oneTimeItemQueue(clientTimeEntryId) {
  return enqueueTimeEntry(
    createQueue(),
    timeEntry(clientTimeEntryId),
    1_777_000_000_000,
  ).queue;
}

/**
 * @param {unknown} upload
 * @param {unknown} time
 */
function killswitches(upload = process.env.DESKTOP_UPLOAD_ENABLED, time = process.env.DESKTOP_TIME_ENABLED) {
  return {
    DESKTOP_UPLOAD_ENABLED: upload,
    DESKTOP_TIME_ENABLED: time,
  };
}

describe("killswitch odchozí fronty", () => {
  it("s nenastaveným DESKTOP_UPLOAD_ENABLED záměrně nic neodešle", async () => {
    delete process.env.DESKTOP_UPLOAD_ENABLED;
    const send = vi.fn();

    const result = await processNext(
      oneItemQueue(),
      killswitches(),
      send,
    );

    expect(send).toHaveBeenCalledTimes(0);
    expect(result).toMatchObject({ outcome: "disabled", reason: UPLOAD_DISABLED_REASON });
    expect(result.queue.items[0].state).toBe(QUEUE_STATES.WAITING);
  });

  it("s hodnotou false nic neodešle a vrátí důvod vypnutí", async () => {
    process.env.DESKTOP_UPLOAD_ENABLED = "false";
    const send = vi.fn();

    const result = await processNext(
      oneItemQueue(),
      killswitches(),
      send,
    );

    expect(send).toHaveBeenCalledTimes(0);
    expect(result.reason).toBe(UPLOAD_DISABLED_REASON);
  });

  it("s hodnotou true zavolá pouze mockovanou odesílací vrstvu", async () => {
    process.env.DESKTOP_UPLOAD_ENABLED = ["tr", "ue"].join("");
    const send = vi.fn().mockResolvedValue({ recordingId: "server-id" });

    const result = await processNext(
      oneItemQueue(),
      killswitches(),
      send,
      { now: 1_777_000_001_000 },
    );

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ state: QUEUE_STATES.SENDING, attempts: 1 });
    expect(result.queue.items[0]).toMatchObject({ state: QUEUE_STATES.SENT, attempts: 1 });
  });

  it("jiná pravdivostní hodnota odesílání nezapne", async () => {
    const send = vi.fn();
    await processNext(oneItemQueue(), killswitches(true), send);
    expect(send).toHaveBeenCalledTimes(0);
  });

  it("časová položka používá samostatný zapnutý vypínač", async () => {
    const send = vi.fn().mockResolvedValue(undefined);

    const result = await processNext(
      oneTimeItemQueue(),
      killswitches(undefined, ENABLED_SETTING),
      send,
      { now: 1_777_000_001_000 },
    );

    expect(send).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("sent");
  });

  it("zapnutý vypínač času nepovolí nahrávku", async () => {
    const send = vi.fn();

    const result = await processNext(
      oneItemQueue(),
      killswitches(undefined, ENABLED_SETTING),
      send,
    );

    expect(send).toHaveBeenCalledTimes(0);
    expect(result.outcome).toBe("disabled");
  });

  it("zapnutý vypínač nahrávek nepovolí časovou položku", async () => {
    const send = vi.fn();

    const result = await processNext(
      oneTimeItemQueue(),
      killswitches(ENABLED_SETTING, undefined),
      send,
    );

    expect(send).toHaveBeenCalledTimes(0);
    expect(result.outcome).toBe("disabled");
  });

  it("boolean true časový vypínač fail-closed nezapne", async () => {
    const send = vi.fn();

    const result = await processNext(
      oneTimeItemQueue(),
      killswitches(undefined, true),
      send,
    );

    expect(send).toHaveBeenCalledTimes(0);
    expect(result.outcome).toBe("disabled");
  });

  it("blokovaná položka má přednost před položkou čekající na čas", async () => {
    const blocked = oneItemQueue();
    const future = enqueueTimeEntry(blocked, timeEntry(), 1_777_000_000_000).queue;
    future.items[1] = { ...future.items[1], nextAttemptAt: 1_777_000_100_000 };

    const result = await processNext(
      future,
      killswitches(undefined, ENABLED_SETTING),
      vi.fn(),
      { now: 1_777_000_001_000 },
    );

    expect(result.outcome).toBe("disabled");
  });
});

describe("stavový automat fronty", () => {
  it("zařazená nahrávka nese rozlišovač typu", () => {
    const { item } = enqueueRecording(createQueue(), recording(), 1_777_000_000_000);
    expect(item.kind).toBe(QUEUE_ITEM_KINDS.RECORDING);
    expect(item).not.toHaveProperty("manifest");
  });

  it("zařazený časový záznam nese typ time a klíč z B5", () => {
    const entry = timeEntry();
    const { item } = enqueueTimeEntry(createQueue(), entry, 1_777_000_000_000);

    expect(item).toMatchObject({
      kind: QUEUE_ITEM_KINDS.TIME,
      clientRecordingId: entry.clientTimeEntryId,
      state: QUEUE_STATES.WAITING,
    });
  });

  it("časový záznam se sazbou se odmítne", () => {
    expect(() => enqueueTimeEntry(
      createQueue(),
      { ...timeEntry(), hourlyRate: 850 },
      1_777_000_000_000,
    )).toThrow(/sazb/i);
  });

  it("do časové položky se nedostane žádné pole se sazbou", () => {
    const { item } = enqueueTimeEntry(createQueue(), timeEntry(), 1_777_000_000_000);
    expect(Object.keys(item.entry)).toEqual(["projectId", "startedAt", "endedAt"]);
  });

  it("dvojí zařazení stejného clientTimeEntryId vytvoří jedinou položku", () => {
    const first = enqueueTimeEntry(createQueue(), timeEntry(), 1_777_000_000_000);
    const second = enqueueTimeEntry(first.queue, timeEntry(), 1_777_000_001_000);

    expect(first.added).toBe(true);
    expect(second.added).toBe(false);
    expect(second.queue.items).toHaveLength(1);
  });

  it("dvojí zařazení stejného clientRecordingId vytvoří jedinou položku", () => {
    const first = enqueueRecording(createQueue(), recording(), 1_777_000_000_000);
    const second = enqueueRecording(first.queue, recording(), 1_777_000_001_000);

    expect(first.added).toBe(true);
    expect(second.added).toBe(false);
    expect(second.queue.items).toHaveLength(1);
  });

  it("neúspěch ponechá položku ve frontě a zvýší počet pokusů", async () => {
    const result = await processNext(oneItemQueue(), killswitches(ENABLED_SETTING), async () => {
      throw new Error("server je dočasně nedostupný");
    }, {
      now: 1_777_000_001_000,
      random: () => 0,
    });

    expect(result.queue.items).toHaveLength(1);
    expect(result.queue.items[0]).toMatchObject({
      attempts: 1,
      lastFailureReason: "server je dočasně nedostupný",
      state: QUEUE_STATES.WAITING,
    });
    expect(result.queue.items[0].nextAttemptAt).toBe(1_777_000_031_000);
  });

  it("po vyčerpání pokusů označí položku jako selhalo a nesmaže ji", async () => {
    const queued = oneItemQueue();
    queued.items[0] = { ...queued.items[0], attempts: 2 };

    const result = await processNext(queued, killswitches(ENABLED_SETTING), async () => {
      throw new Error("trvalý neúspěch");
    }, {
      now: 1_777_000_001_000,
      retryPolicy: { maxAttempts: 3 },
    });

    expect(result.outcome).toBe("failed");
    expect(result.queue.items).toHaveLength(1);
    expect(result.queue.items[0]).toMatchObject({
      attempts: 3,
      lastFailureReason: "trvalý neúspěch",
      nextAttemptAt: null,
      state: QUEUE_STATES.FAILED,
    });
  });

  it("opakování používá rostoucí exponenciální prodlevu s pevným stropem", () => {
    const policy = { baseDelayMs: 100, maxDelayMs: 350, jitterRatio: 0.2 };
    expect(retryDelayMs(1, policy, () => 0)).toBe(100);
    expect(retryDelayMs(2, policy, () => 0)).toBe(200);
    expect(retryDelayMs(3, policy, () => 1)).toBe(350);
    expect(retryDelayMs(8, policy, () => 0)).toBe(350);
  });

  it("offsety obou stop vždy převezme ze serveru místo lokálního odhadu", () => {
    const queued = oneItemQueue();
    const first = applyServerProgress(queued, queued.items[0].clientRecordingId, {
      recordingId: "server-recording-id",
      uploadedBytes: { microphone: 90, system: 180 },
    });
    const correctedByServer = applyServerProgress(
      first.queue,
      queued.items[0].clientRecordingId,
      {
        recordingId: "server-recording-id",
        uploadedBytes: { microphone: 40, system: 80 },
      },
    );

    expect(correctedByServer.item.server).toEqual({
      recordingId: "server-recording-id",
      uploadedBytes: { microphone: 40, system: 80 },
    });
  });

  it("vyžaduje killswitch v podpisu spolu s odesílací vrstvou", async () => {
    await expect(processNext(oneItemQueue())).rejects.toThrow(/povinné argumenty/);
  });

  it("trvalá chyba skončí při prvním pokusu a neopakuje se pětkrát", async () => {
    const send = vi.fn(async () => {
      throw Object.assign(new Error("403 company_out_of_scope"), {
        failureClass: FAILURE_CLASSES.PERMANENT,
      });
    });
    let queue = oneItemQueue();

    for (let pass = 0; pass < 5; pass += 1) {
      const result = await processNext(
        queue,
        killswitches(ENABLED_SETTING),
        send,
        {
          now: 1_777_000_001_000 + pass,
          retryPolicy: {
            baseDelayMs: 1,
            maxDelayMs: 1,
            maxAttempts: 5,
            jitterRatio: 0,
          },
          random: () => 0,
        },
      );
      queue = result.queue;
    }

    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.items[0]).toMatchObject({
      attempts: 1,
      state: QUEUE_STATES.FAILED,
      nextAttemptAt: null,
      lastFailureReason: "403 company_out_of_scope",
    });
  });

  it("pauza invalid_grant nespotřebuje pokus", async () => {
    const queue = oneItemQueue();
    queue.items[0] = {
      ...queue.items[0],
      attempts: 2,
      nextAttemptAt: 1_777_000_000_500,
    };
    const send = vi.fn(async () => {
      throw Object.assign(new Error("invalid_grant"), {
        failureClass: FAILURE_CLASSES.PAUSED,
      });
    });
    const result = await processNext(
      queue,
      killswitches(ENABLED_SETTING),
      send,
      { now: 1_777_000_001_000 },
    );

    expect(send).toHaveBeenCalledTimes(1);
    expect(result.queue.items[0]).toMatchObject({
      attempts: 2,
      state: QUEUE_STATES.WAITING,
      nextAttemptAt: 1_777_000_000_500,
      lastFailureReason: "invalid_grant",
    });
  });

  it("starší položka bez kind se čte jako nahrávka", async () => {
    const queue = oneItemQueue();
    delete queue.items[0].kind;
    const send = vi.fn().mockResolvedValue(undefined);

    await processNext(queue, killswitches(ENABLED_SETTING), send, {
      now: 1_777_000_001_000,
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(killswitchNameForKind(undefined)).toBe("DESKTOP_UPLOAD_ENABLED");
  });

  it("pohled pro renderer neobsahuje absolutní cesty ani manifest", () => {
    const view = reduceQueueForRenderer(oneItemQueue());
    expect(JSON.stringify(view)).not.toContain("/nahravky/");
    expect(JSON.stringify(view)).not.toContain("manifestPath");
    expect(view[0]).toEqual({
      id: "9e586e55-d688-43f1-8a80-a3d61e754f3e",
      kind: QUEUE_ITEM_KINDS.RECORDING,
      state: QUEUE_STATES.WAITING,
      attempts: 0,
      nextAttemptAt: null,
      lastFailureReason: null,
    });
  });
});

describe("trvalé uložení fronty", () => {
  it("uložená a po restartu načtená fronta je stejná", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-restart-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const queue = oneItemQueue();
    try {
      await saveQueueAtomically(queuePath, queue);
      const afterRestart = await loadQueue(queuePath);
      expect(afterRestart).toEqual(queue);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("atomický zápis fsyncne data i adresář", async () => {
    const events = [];
    vi.spyOn(fs.promises, "mkdir").mockImplementation(async () => undefined);
    vi.spyOn(fs.promises, "rename").mockImplementation(async () => {
      events.push("rename");
    });
    vi.spyOn(fs.promises, "unlink").mockImplementation(async () => undefined);
    vi.spyOn(fs.promises, "open").mockImplementation(async (_filePath, flags) => {
      if (flags === "wx") {
        expect(path.dirname(String(_filePath))).toBe("/virtual/queue");
        expect(path.basename(String(_filePath))).toMatch(/^\.outgoing\.json\..+\.tmp$/);
        return /** @type {any} */ ({
          async writeFile() { events.push("write:wx"); },
          async sync() { events.push("sync:wx"); },
          async close() { events.push("close:wx"); },
        });
      }
      if (flags === "r") {
        expect(String(_filePath)).toBe("/virtual/queue");
        return /** @type {any} */ ({
          async sync() { events.push("sync:r"); },
          async close() { events.push("close:r"); },
        });
      }
      throw new Error(`Neočekávaný režim open: ${String(flags)}`);
    });

    await saveQueueAtomically("/virtual/queue/outgoing.json", oneItemQueue());

    expect(events).toEqual([
      "write:wx",
      "sync:wx",
      "close:wx",
      "rename",
      "sync:r",
      "close:r",
    ]);
  });
});

describe("perzistentní pumpa fronty", () => {
  it("po selhání fsync adresáře znovu načte stav po dokončeném rename", async () => {
    const queuePath = "/virtual/queue/outgoing.json";
    const files = new Map();
    let failDirectorySync = true;

    vi.spyOn(fs.promises, "readFile").mockImplementation(async (target) => {
      const contents = files.get(String(target));
      if (contents !== undefined) return contents;
      throw Object.assign(new Error("soubor neexistuje"), { code: "ENOENT" });
    });
    vi.spyOn(fs.promises, "mkdir").mockImplementation(async () => undefined);
    vi.spyOn(fs.promises, "open").mockImplementation(async (target, flags) => {
      if (flags === "wx") {
        return /** @type {any} */ ({
          async writeFile(contents) { files.set(String(target), String(contents)); },
          async sync() {},
          async close() {},
        });
      }
      if (flags === "r") {
        return /** @type {any} */ ({
          async sync() {
            if (failDirectorySync) {
              failDirectorySync = false;
              throw new Error("simulovaný fsync adresáře");
            }
          },
          async close() {},
        });
      }
      throw new Error(`Neočekávaný režim open: ${String(flags)}`);
    });
    vi.spyOn(fs.promises, "rename").mockImplementation(async (source, target) => {
      files.set(String(target), files.get(String(source)));
      files.delete(String(source));
    });
    vi.spyOn(fs.promises, "unlink").mockImplementation(async (target) => {
      files.delete(String(target));
    });

    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });
    await expect(store.enqueueTimeEntry(timeEntry(
      "7c1f9ab3-1a84-47b3-91eb-7cd4c13f86d8",
    ))).rejects.toThrow("simulovaný fsync adresáře");

    await store.enqueueTimeEntry(timeEntry("9100c152-bb29-4e8c-b5f3-23904030b697"));

    const saved = JSON.parse(files.get(queuePath));
    expect(saved.items.map((item) => item.clientRecordingId)).toEqual([
      "7c1f9ab3-1a84-47b3-91eb-7cd4c13f86d8",
      "9100c152-bb29-4e8c-b5f3-23904030b697",
    ]);
  });

  it("serializuje souběžná zařazení bez ztráty položky", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-lock-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });

    try {
      await Promise.all([
        store.enqueueRecording(recording("9e586e55-d688-43f1-8a80-a3d61e754f3e")),
        store.enqueueRecording(recording("3d4e7b61-e3d4-483c-94cc-a512454f6976")),
      ]);

      const saved = await loadQueue(queuePath);
      expect(saved.items.map((item) => item.clientRecordingId)).toEqual([
        "9e586e55-d688-43f1-8a80-a3d61e754f3e",
        "3d4e7b61-e3d4-483c-94cc-a512454f6976",
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("trvalý první pokus uloží s attempts 1 a další pumpy ho neopakují", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-permanent-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const send = vi.fn(async () => {
      throw Object.assign(new Error("403 company_out_of_scope"), {
        failureClass: FAILURE_CLASSES.PERMANENT,
      });
    });
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send,
    });

    try {
      await store.enqueueRecording(recording());
      await store.pump(killswitches(ENABLED_SETTING));
      for (let pass = 0; pass < 4; pass += 1) {
        await store.pump(killswitches(ENABLED_SETTING));
      }

      expect(send).toHaveBeenCalledTimes(1);
      expect((await loadQueue(queuePath)).items[0]).toMatchObject({
        attempts: 1,
        lastFailureReason: "403 company_out_of_scope",
        nextAttemptAt: null,
        state: QUEUE_STATES.FAILED,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("ruční retry vynuluje prodlevu, uloží ji a hned probudí pumpu", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-retry-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const send = vi.fn()
      .mockRejectedValueOnce(new Error("dočasná chyba"))
      .mockResolvedValueOnce(undefined);
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send,
    });

    try {
      await store.enqueueRecording(recording());
      const first = await store.pump(killswitches(ENABLED_SETTING));
      expect(first.outcome).toBe("retry_scheduled");
      expect((await loadQueue(queuePath)).items[0].nextAttemptAt).not.toBeNull();

      const retried = await store.retry(killswitches(ENABLED_SETTING));

      expect(retried.outcome).toBe("sent");
      expect(send).toHaveBeenCalledTimes(2);
      expect((await loadQueue(queuePath)).items[0]).toMatchObject({
        attempts: 2,
        nextAttemptAt: null,
        state: QUEUE_STATES.SENT,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("pumpa s vypnutými přepínači položku zachová bez pokusu", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-pump-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const send = vi.fn();
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send,
    });

    try {
      await store.enqueueRecording(recording());
      const result = await store.pump(killswitches());

      expect(result).toMatchObject({ outcome: "disabled" });
      expect(send).toHaveBeenCalledTimes(0);
      expect((await loadQueue(queuePath)).items[0]).toMatchObject({
        attempts: 0,
        state: QUEUE_STATES.WAITING,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
