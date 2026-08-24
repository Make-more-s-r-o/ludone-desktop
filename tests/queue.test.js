import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import queueStore from "../electron/queue.cjs";
import { createManifest } from "../src/lib/manifest.js";
import {
  QUEUE_STATES,
  UPLOAD_DISABLED_REASON,
  applyServerProgress,
  createQueue,
  enqueueRecording,
  processNext,
  retryDelayMs,
} from "../src/lib/queue.js";

const { loadQueue, saveQueueAtomically } = queueStore;
const ORIGINAL_UPLOAD_SETTING = process.env.DESKTOP_UPLOAD_ENABLED;

afterEach(() => {
  if (ORIGINAL_UPLOAD_SETTING === undefined) delete process.env.DESKTOP_UPLOAD_ENABLED;
  else process.env.DESKTOP_UPLOAD_ENABLED = ORIGINAL_UPLOAD_SETTING;
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

describe("killswitch odchozí fronty", () => {
  it("s nenastaveným DESKTOP_UPLOAD_ENABLED záměrně nic neodešle", async () => {
    delete process.env.DESKTOP_UPLOAD_ENABLED;
    const send = vi.fn();

    const result = await processNext(
      oneItemQueue(),
      process.env.DESKTOP_UPLOAD_ENABLED,
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
      process.env.DESKTOP_UPLOAD_ENABLED,
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
      process.env.DESKTOP_UPLOAD_ENABLED,
      send,
      { now: 1_777_000_001_000 },
    );

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ state: QUEUE_STATES.SENDING, attempts: 1 });
    expect(result.queue.items[0]).toMatchObject({ state: QUEUE_STATES.SENT, attempts: 1 });
  });

  it("jiná pravdivostní hodnota odesílání nezapne", async () => {
    const send = vi.fn();
    await processNext(oneItemQueue(), true, send);
    expect(send).toHaveBeenCalledTimes(0);
  });
});

describe("stavový automat fronty", () => {
  it("dvojí zařazení stejného clientRecordingId vytvoří jedinou položku", () => {
    const first = enqueueRecording(createQueue(), recording(), 1_777_000_000_000);
    const second = enqueueRecording(first.queue, recording(), 1_777_000_001_000);

    expect(first.added).toBe(true);
    expect(second.added).toBe(false);
    expect(second.queue.items).toHaveLength(1);
  });

  it("neúspěch ponechá položku ve frontě a zvýší počet pokusů", async () => {
    const result = await processNext(oneItemQueue(), ["tr", "ue"].join(""), async () => {
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

    const result = await processNext(queued, ["tr", "ue"].join(""), async () => {
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
});
