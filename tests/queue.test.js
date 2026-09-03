import { createHash, createHmac } from "node:crypto";
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

const {
  createOutboundQueueStore,
  deriveQueueOwnerFingerprint,
  loadQueue,
  recoverOrphanedRecordings,
  saveQueueAtomically,
} = queueStore;
const ORIGINAL_UPLOAD_SETTING = process.env.DESKTOP_UPLOAD_ENABLED;
const ORIGINAL_TIME_SETTING = process.env.DESKTOP_TIME_ENABLED;
const ENABLED_SETTING = ["tr", "ue"].join("");
const mainSource = fs.readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");

function sourceCodeMask(source) {
  let state = "code";
  let mask = "";

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (state === "code") {
      if (character === "/" && next === "/") {
        mask += "  ";
        index += 1;
        state = "line-comment";
      } else if (character === "/" && next === "*") {
        mask += "  ";
        index += 1;
        state = "block-comment";
      } else if (character === "'" || character === '"' || character === "`") {
        mask += " ";
        state = character;
      } else {
        mask += character;
      }
      continue;
    }

    if (state === "line-comment") {
      mask += character === "\n" || character === "\r" ? character : " ";
      if (character === "\n" || character === "\r") state = "code";
      continue;
    }

    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        mask += "  ";
        index += 1;
        state = "code";
      } else {
        mask += character === "\n" || character === "\r" ? character : " ";
      }
      continue;
    }

    if (character === "\\") {
      mask += " ";
      if (next !== undefined) {
        mask += next === "\n" || next === "\r" ? next : " ";
        index += 1;
      }
    } else if (character === state) {
      mask += " ";
      state = "code";
    } else {
      mask += character === "\n" || character === "\r" ? character : " ";
    }
  }

  return mask;
}

function functionDeclarationSource(source, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const codeMask = sourceCodeMask(source);
  const declarations = [...codeMask.matchAll(new RegExp(
    `^function\\s+${escapedName}\\s*\\(`,
    "gm",
  ))];
  if (declarations.length !== 1) {
    throw new Error(`Funkce ${name} musí mít právě jednu deklaraci, nalezeno ${declarations.length}`);
  }

  const start = declarations[0].index;
  const openingBrace = codeMask.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < codeMask.length; index += 1) {
    if (codeMask[index] === "{") depth += 1;
    if (codeMask[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Funkce ${name} nemá uzavřené tělo`);
}

const readProductionQueueKillswitches = Function(
  "process",
  `"use strict";
  ${functionDeclarationSource(mainSource, "queueKillswitches")}
  return queueKillswitches();`,
);

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

function microphoneOnlyRecording(
  clientRecordingId = "6a47ca7f-77c7-4133-bc47-d813c2a1a874",
) {
  const startedAt = "2026-09-03T08:00:00.000Z";
  const endedAt = "2026-09-03T08:30:00.000Z";
  return {
    manifest: {
      schemaVersion: 1,
      clientRecordingId,
      createdAt: startedAt,
      closedAt: endedAt,
      state: "complete",
      tracks: {
        microphone: {
          fileName: "session-microphone.webm",
          startedAt,
          endedAt,
          sizeBytes: 120,
          sha256: "a".repeat(64),
        },
      },
    },
    manifestPath: `/nahravky/${clientRecordingId}.manifest.json`,
    trackPaths: { microphone: "/nahravky/session-microphone.webm" },
  };
}

function oneItemQueue(clientRecordingId) {
  return enqueueRecording(createQueue(), recording(clientRecordingId), 1_777_000_000_000).queue;
}

describe("vlastník nahrávky v perzistentní frontě", () => {
  it("ukládá jen stabilní doménově oddělený SHA-256 otisk, ne čitelnou identitu", () => {
    const session = {
      issuer: "https://app.ludone.cz",
      identity: { name: "Ada Lovelace", email: "  Ada@LuDone.CZ  " },
    };
    const TAJEMSTVI_VLASTNIKA = Buffer.alloc(32, 7);

    const fingerprint = deriveQueueOwnerFingerprint(session, TAJEMSTVI_VLASTNIKA);
    const sameIdentity = deriveQueueOwnerFingerprint({
      issuer: "https://app.ludone.cz",
      identity: { email: "Ada@ludone.cz" },
    }, TAJEMSTVI_VLASTNIKA);
    const otherIssuer = deriveQueueOwnerFingerprint({
      issuer: "https://labs.ludone.cz",
      identity: { email: "Ada@ludone.cz" },
    }, TAJEMSTVI_VLASTNIKA);
    const expectedFingerprint = `sha256:${createHmac("sha256", TAJEMSTVI_VLASTNIKA)
      .update(JSON.stringify([
        "cz.ludone.desktop",
        "queue-owner",
        "v1",
        "https://app.ludone.cz",
        "email",
        "Ada@ludone.cz",
      ]), "utf8")
      .digest("hex")}`;

    expect(fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(fingerprint).toBe(expectedFingerprint);
    expect(sameIdentity).toBe(fingerprint);
    expect(otherIssuer).not.toBe(fingerprint);
    expect(JSON.stringify({ fingerprint })).not.toMatch(/Ada|ludone\.cz@/iu);
  });

  it("bez tajemství se otisk NEODVODÍ — musí vyjít null", () => {
    // 🔴 Fail-closed. Kdyby se při nedostupném tajemství vrátil nesolený sha256, ochrana
    // by tiše zeslábla na to, co jde uhodnout ze seznamu firemních e-mailů — a vypadala
    // by přitom stejně. Null se překládá na „vlastník neznámý", tedy pauzu.
    const session = {
      issuer: "https://app.ludone.cz",
      identity: { email: "ada@ludone.cz" },
    };

    expect(deriveQueueOwnerFingerprint(session, undefined)).toBeNull();
    expect(deriveQueueOwnerFingerprint(session, null)).toBeNull();
    expect(
      deriveQueueOwnerFingerprint(session, Buffer.alloc(31, 7)),
      "krátké tajemství je horší než žádné — vypadá jako ochrana",
    ).toBeNull();
    expect(deriveQueueOwnerFingerprint(session, "nejsem buffer")).toBeNull();
  });

  it("produkční store přidá otisk k dvoustopé i jednostopé položce", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-owner-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const ownerFingerprint = `sha256:${"a".repeat(64)}`;
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });

    try {
      await store.enqueueRecording({ ...recording(), ownerFingerprint });
      await store.enqueueRecording({
        ...microphoneOnlyRecording("3d4e7b61-e3d4-483c-94cc-a512454f6976"),
        ownerFingerprint,
      });

      const saved = await loadQueue(queuePath);
      expect(saved.items.map((item) => item.ownerFingerprint)).toEqual([
        ownerFingerprint,
        ownerFingerprint,
      ]);
      expect(JSON.stringify(saved)).not.toMatch(/Ada|@ludone\.cz/iu);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("anonymní enqueue zapíše null a pozdější opakování jej nepřivlastní", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-ownerless-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });

    try {
      const first = await store.enqueueRecording(recording());
      const second = await store.enqueueRecording({
        ...recording(),
        ownerFingerprint: `sha256:${"b".repeat(64)}`,
      });

      expect(first.added).toBe(true);
      expect(second.added).toBe(false);
      expect((await loadQueue(queuePath)).items[0]).toMatchObject({ ownerFingerprint: null });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("starou položku schématu v1 bez pole vlastníka načte beze ztráty jako neznámou", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-owner-migration-"));
    const queuePath = path.join(directory, "outgoing.json");
    const legacyQueue = oneItemQueue();
    delete legacyQueue.items[0].ownerFingerprint;
    await fs.promises.writeFile(queuePath, JSON.stringify(legacyQueue));

    try {
      const loaded = await loadQueue(queuePath);
      expect(loaded).toEqual({
        ...legacyQueue,
        items: [{ ...legacyQueue.items[0], ownerFingerprint: null }],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

async function writeRecoverableRecording(
  recordingsDirectory,
  clientRecordingId = "9e586e55-d688-43f1-8a80-a3d61e754f3e",
  { staleMetadata = false, state = "complete" } = {},
) {
  const microphoneBytes = Buffer.from("mikrofon");
  const systemBytes = Buffer.from("systém");
  const startedAt = "2026-08-25T08:00:00.000Z";
  const endedAt = "2026-08-25T08:30:00.000Z";
  const manifestPath = path.join(recordingsDirectory, "osiřelá.manifest.json");
  const manifest = {
    ...createManifest({
      clientRecordingId,
      createdAt: startedAt,
      closedAt: staleMetadata ? null : endedAt,
      tracks: {
        microphone: {
          fileName: "session-microphone.webm",
          startedAt,
          endedAt: staleMetadata ? null : endedAt,
          sizeBytes: staleMetadata ? 0 : microphoneBytes.byteLength,
          sha256: staleMetadata ? null : createHash("sha256").update(microphoneBytes).digest("hex"),
        },
        system: {
          fileName: "session-system.webm",
          startedAt,
          endedAt: staleMetadata ? null : endedAt,
          sizeBytes: staleMetadata ? 0 : systemBytes.byteLength,
          sha256: staleMetadata ? null : createHash("sha256").update(systemBytes).digest("hex"),
        },
      },
    }, state),
    title: "NELOGOVAT-TAJNOU-PORADU",
  };
  const trackPaths = {
    microphone: path.join(recordingsDirectory, manifest.tracks.microphone.fileName),
    system: path.join(recordingsDirectory, manifest.tracks.system.fileName),
  };
  await fs.promises.mkdir(recordingsDirectory, { recursive: true });
  await Promise.all([
    fs.promises.writeFile(manifestPath, JSON.stringify(manifest)),
    fs.promises.writeFile(trackPaths.microphone, microphoneBytes),
    fs.promises.writeFile(trackPaths.system, systemBytes),
  ]);
  return { manifest, manifestPath, trackPaths };
}

async function writeRecoverableMicrophoneOnlyRecording(recordingsDirectory) {
  const recordingValue = microphoneOnlyRecording();
  const microphoneBytes = Buffer.from("mikrofon");
  recordingValue.manifest.tracks.microphone.sizeBytes = microphoneBytes.byteLength;
  recordingValue.manifest.tracks.microphone.sha256 = createHash("sha256")
    .update(microphoneBytes)
    .digest("hex");
  recordingValue.manifestPath = path.join(recordingsDirectory, "jednostopa.manifest.json");
  recordingValue.trackPaths.microphone = path.join(
    recordingsDirectory,
    recordingValue.manifest.tracks.microphone.fileName,
  );
  await fs.promises.mkdir(recordingsDirectory, { recursive: true });
  await Promise.all([
    fs.promises.writeFile(recordingValue.manifestPath, JSON.stringify(recordingValue.manifest)),
    fs.promises.writeFile(recordingValue.trackPaths.microphone, microphoneBytes),
  ]);
  return recordingValue;
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

const PRODUCTION_KILLSWITCH_CASES = [
  {
    label: "nenastavený vypínač nahrávek zůstane disabled",
    environmentName: "DESKTOP_UPLOAD_ENABLED",
    queueFactory: oneItemQueue,
    value: undefined,
    expectedOutcome: "disabled",
    expectedCalls: 0,
  },
  {
    label: "false ve vypínači nahrávek zůstane disabled",
    environmentName: "DESKTOP_UPLOAD_ENABLED",
    queueFactory: oneItemQueue,
    value: "false",
    expectedOutcome: "disabled",
    expectedCalls: 0,
  },
  {
    label: "nepřesné TRUE vypínač nahrávek nezapne",
    environmentName: "DESKTOP_UPLOAD_ENABLED",
    queueFactory: oneItemQueue,
    value: "TRUE",
    expectedOutcome: "disabled",
    expectedCalls: 0,
  },
  {
    label: "přesný řetězec true zapne nahrávky",
    environmentName: "DESKTOP_UPLOAD_ENABLED",
    queueFactory: oneItemQueue,
    value: ENABLED_SETTING,
    expectedOutcome: "sent",
    expectedCalls: 1,
  },
  {
    label: "produkčně zapnutý časový vypínač nepovolí nahrávku",
    environmentName: "DESKTOP_TIME_ENABLED",
    queueFactory: oneItemQueue,
    value: ENABLED_SETTING,
    expectedOutcome: "disabled",
    expectedCalls: 0,
  },
  {
    label: "nenastavený vypínač času zůstane disabled",
    environmentName: "DESKTOP_TIME_ENABLED",
    queueFactory: oneTimeItemQueue,
    value: undefined,
    expectedOutcome: "disabled",
    expectedCalls: 0,
  },
  {
    label: "false ve vypínači času zůstane disabled",
    environmentName: "DESKTOP_TIME_ENABLED",
    queueFactory: oneTimeItemQueue,
    value: "false",
    expectedOutcome: "disabled",
    expectedCalls: 0,
  },
  {
    label: "nepřesné TRUE vypínač času nezapne",
    environmentName: "DESKTOP_TIME_ENABLED",
    queueFactory: oneTimeItemQueue,
    value: "TRUE",
    expectedOutcome: "disabled",
    expectedCalls: 0,
  },
  {
    label: "přesný řetězec true zapne čas",
    environmentName: "DESKTOP_TIME_ENABLED",
    queueFactory: oneTimeItemQueue,
    value: ENABLED_SETTING,
    expectedOutcome: "sent",
    expectedCalls: 1,
  },
  {
    label: "produkčně zapnutý vypínač nahrávek nepovolí čas",
    environmentName: "DESKTOP_UPLOAD_ENABLED",
    queueFactory: oneTimeItemQueue,
    value: ENABLED_SETTING,
    expectedOutcome: "disabled",
    expectedCalls: 0,
  },
];

describe("produkční čtení killswitchů", () => {
  it.each(PRODUCTION_KILLSWITCH_CASES)("$label", async ({
    environmentName,
    queueFactory,
    value,
    expectedOutcome,
    expectedCalls,
  }) => {
    delete process.env.DESKTOP_UPLOAD_ENABLED;
    delete process.env.DESKTOP_TIME_ENABLED;
    if (value !== undefined) process.env[environmentName] = value;
    const send = vi.fn().mockResolvedValue(undefined);

    const result = await processNext(
      queueFactory(),
      readProductionQueueKillswitches(process),
      send,
      { now: 1_777_000_001_000 },
    );

    expect(result.outcome).toBe(expectedOutcome);
    expect(send).toHaveBeenCalledTimes(expectedCalls);
  });
});

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

  it("produkční store zařadí jednostopu pravdivě a idempotentně", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-microphone-only-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });

    try {
      const first = await store.enqueueRecording(microphoneOnlyRecording());
      const second = await store.enqueueRecording(microphoneOnlyRecording());

      expect(first.added).toBe(true);
      expect(second.added).toBe(false);
      const [item] = (await loadQueue(queuePath)).items;
      expect(item.tracks).toEqual({ microphone: "/nahravky/session-microphone.webm" });
      expect(item.server.uploadedBytes).toEqual({ microphone: 0 });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("shodné ID jiné položky nesmí předstírat idempotentní obnovu nahrávky", () => {
    const clientRecordingId = recording().manifest.clientRecordingId;
    const time = enqueueTimeEntry(
      createQueue(),
      { ...timeEntry(), clientTimeEntryId: clientRecordingId },
      1_777_000_000_000,
    );

    expect(() => enqueueRecording(time.queue, recording(), 1_777_000_001_000))
      .toThrow(/koliz/i);
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

  it("sentAt vznikne až po dokončení odesílání", async () => {
    const startedAt = 1_777_000_001_000;
    const completedAt = 1_777_000_009_000;
    let releaseSend;
    let sendCompleted = false;
    const sendReleased = new Promise((resolve) => { releaseSend = resolve; });
    vi.spyOn(Date, "now").mockImplementation(() => (
      sendCompleted ? completedAt : startedAt
    ));

    const processing = processNext(
      oneItemQueue(),
      killswitches(ENABLED_SETTING),
      vi.fn(async () => {
        await sendReleased;
        sendCompleted = true;
      }),
    );

    await vi.waitFor(() => expect(Date.now).toHaveBeenCalledTimes(1));
    releaseSend();
    const result = await processing;

    expect(sendCompleted).toBe(true);
    expect(result.item.sentAt).toBe(new Date(completedAt).toISOString());
    expect(Date.now).toHaveBeenCalledTimes(2);
  });

  it("retry prodlevu počítá až od dokončení neúspěšného pokusu", async () => {
    const startedAt = 1_777_000_001_000;
    const failedAt = 1_777_000_009_000;
    let failSend;
    const send = vi.fn(() => new Promise((_resolve, reject) => { failSend = reject; }));
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(startedAt)
      .mockReturnValueOnce(failedAt);

    const processing = processNext(oneItemQueue(), killswitches(ENABLED_SETTING), send, {
      random: () => 0,
      retryPolicy: { baseDelayMs: 1_000 },
    });
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    failSend(new Error("dočasná chyba po dlouhém pokusu"));
    const result = await processing;

    expect(result.outcome).toBe("retry_scheduled");
    expect(result.item.nextAttemptAt).toBe(failedAt + 1_000);
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
    const queue = oneItemQueue();
    const ownerFingerprint = `sha256:${"a".repeat(64)}`;
    queue.items[0].ownerFingerprint = ownerFingerprint;
    const view = reduceQueueForRenderer(queue);
    expect(JSON.stringify(view)).not.toContain("/nahravky/");
    expect(JSON.stringify(view)).not.toContain("manifestPath");
    expect(JSON.stringify(view)).not.toContain(ownerFingerprint);
    expect(view[0]).toEqual({
      id: "9e586e55-d688-43f1-8a80-a3d61e754f3e",
      kind: QUEUE_ITEM_KINDS.RECORDING,
      state: QUEUE_STATES.WAITING,
      attempts: 0,
      nextAttemptAt: null,
      lastFailureReason: null,
    });
  });

  it.each(["queue_owner_revoked", "session_owner_expired"])(
    "NEZNÁMÝ vlastnický důvod se bere jako čekající na člověka: %s",
    async (code) => {
      // 🔴 FAIL-CLOSED. Původní verze vyjmenovávala jen `mismatch` a `unknown`, takže nový
      // vlastnický důvod by se tiše zařadil mezi obyčejné čekající — a vrátila by se přesně
      // ta vada, kvůli které klasifikace vznikla: položka, která se sama nikdy neodešle,
      // vypadala jako položka, která čeká na odeslání. Radši zbytečně vidět než schované.
      const result = await processNext(
        oneItemQueue(),
        killswitches(ENABLED_SETTING),
        async () => {
          throw Object.assign(new Error("nový vlastnický důvod"), {
            code,
            failureClass: FAILURE_CLASSES.PAUSED,
          });
        },
      );

      expect(result.outcome).toBe("paused");
      expect(result.queue.items[0]).toHaveProperty("requiresHumanAction", true);
    },
  );

  it.each([
    "Nahrávka patří jinému účtu",
    "Vlastník nahrávky není potvrzený; před odesláním je nutné potvrzení člověkem",
    "Identitu aktuálního přihlášení nelze ověřit",
  ])("rozpozná už uložený vlastnický důvod bez nového příznaku: %s", (lastFailureReason) => {
    const queue = oneItemQueue();
    queue.items[0] = {
      ...queue.items[0],
      lastFailureReason,
      ownerFingerprint: `sha256:${"a".repeat(64)}`,
    };

    expect(reduceQueueForRenderer(queue)[0]).toMatchObject({ requiresHumanAction: true });
  });

  it("libovolná jiná pauza se slovem owner nepatří bez výslovného kontraktu člověku", async () => {
    const result = await processNext(
      oneItemQueue(),
      killswitches(ENABLED_SETTING),
      async () => {
        throw Object.assign(new Error("dočasně nedostupný vlastník databáze"), {
          code: "database_owner_unavailable",
          failureClass: FAILURE_CLASSES.PAUSED,
        });
      },
    );

    expect(result.queue.items[0]).toHaveProperty("requiresHumanAction", false);
    expect(reduceQueueForRenderer(result.queue)[0]).not.toHaveProperty("requiresHumanAction");
  });

  it.each([
    "Vlastník databáze je potvrzen, ale server není dostupný",
    "Identitu zařízení se po přihlášení nepodařilo načíst",
    "Nahrávka se kvůli síti nepřiřadila jinému účtu",
  ])("volná podobnost historické zprávy nevytvoří lidský zásah: %s", (lastFailureReason) => {
    const queue = oneItemQueue();
    queue.items[0] = { ...queue.items[0], lastFailureReason };

    expect(reduceQueueForRenderer(queue)[0]).not.toHaveProperty("requiresHumanAction");
  });

  it("další pumpa položku čekající na člověka sama znovu nezkouší", async () => {
    const ownerPaused = await processNext(
      oneItemQueue(),
      killswitches(ENABLED_SETTING),
      async () => {
        throw Object.assign(new Error("Nahrávka patří jinému účtu"), {
          code: "queue_owner_mismatch",
          failureClass: FAILURE_CLASSES.PAUSED,
        });
      },
    );
    const send = vi.fn().mockResolvedValue(undefined);
    const stillPaused = await processNext(
      ownerPaused.queue,
      killswitches(ENABLED_SETTING),
      send,
    );

    expect(send).not.toHaveBeenCalled();
    expect(stillPaused.outcome).toBe("idle");
    expect(stillPaused.queue).toEqual(ownerPaused.queue);
    expect(reduceQueueForRenderer(stillPaused.queue)[0])
      .toHaveProperty("requiresHumanAction", true);
  });
});

describe("trvalé uložení fronty", () => {
  it("po restartu zachová data a doplní neznámého vlastníka", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-restart-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const queue = oneItemQueue();
    try {
      await saveQueueAtomically(queuePath, queue);
      const afterRestart = await loadQueue(queuePath);
      expect(afterRestart).toEqual({
        ...queue,
        items: queue.items.map((item) => ({ ...item, ownerFingerprint: null })),
      });
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

describe("obnova osiřelých nahrávek", () => {
  it("obnoví dokončenou jednostopu bez vymyšleného systémového souboru", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-recovery-one-track-"));
    const recordingsDirectory = path.join(directory, "nahravky");
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const fixture = await writeRecoverableMicrophoneOnlyRecording(recordingsDirectory);
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });

    try {
      await expect(recoverOrphanedRecordings({
        logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
        manifestModulePromise: import("../src/lib/manifest.js"),
        queueStore: store,
        recordingsDirectory,
      })).resolves.toMatchObject({ recovered: 1, skipped: 0 });
      const [item] = (await loadQueue(queuePath)).items;
      expect(item.manifestPath).toBe(fixture.manifestPath);
      expect(item.ownerFingerprint).toBeNull();
      expect(Object.keys(item.tracks)).toEqual(["microphone"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("dvojí obnova nevytvoří dvě položky", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-recovery-idempotent-"));
    const recordingsDirectory = path.join(directory, "nahravky");
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });
    await writeRecoverableRecording(recordingsDirectory);

    try {
      const options = {
        logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
        manifestModulePromise: import("../src/lib/manifest.js"),
        queueStore: store,
        recordingsDirectory,
      };
      const [first, second] = await Promise.all([
        recoverOrphanedRecordings(options),
        recoverOrphanedRecordings(options),
      ]);

      expect([first.recovered, second.recovered].sort()).toEqual([0, 1]);
      expect([first.alreadyQueued, second.alreadyQueued].sort()).toEqual([0, 1]);
      expect((await loadQueue(queuePath)).items).toHaveLength(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("poškozený manifest obnovu nezastaví, zůstane ležet a neprozradí název", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-recovery-corrupt-"));
    const recordingsDirectory = path.join(directory, "nahravky");
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const damagedName = "00-NELOGOVAT-TAJNOU-PORADU.manifest.json";
    const damagedPath = path.join(recordingsDirectory, damagedName);
    const damagedContents = "{\"title\":\"NELOGOVAT-TAJNOU-PORADU\"";
    const logger = { error: vi.fn(), log: vi.fn(), warn: vi.fn() };
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });
    await writeRecoverableRecording(recordingsDirectory);
    await fs.promises.writeFile(damagedPath, damagedContents);

    try {
      await expect(recoverOrphanedRecordings({
        logger,
        manifestModulePromise: import("../src/lib/manifest.js"),
        queueStore: store,
        recordingsDirectory,
      })).resolves.toMatchObject({ recovered: 1, skipped: 1 });

      expect((await loadQueue(queuePath)).items).toHaveLength(1);
      await expect(fs.promises.readFile(damagedPath, "utf8")).resolves.toBe(damagedContents);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("NELOGOVAT-TAJNOU-PORADU");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("incomplete manifest opraví do uploadovatelného sidecaru a originál zachová", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-recovery-incomplete-"));
    const recordingsDirectory = path.join(directory, "nahravky");
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const fixture = await writeRecoverableRecording(
      recordingsDirectory,
      undefined,
      { staleMetadata: true, state: "incomplete" },
    );
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });

    try {
      await expect(recoverOrphanedRecordings({
        logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
        manifestModulePromise: import("../src/lib/manifest.js"),
        queueStore: store,
        recordingsDirectory,
      })).resolves.toMatchObject({ recovered: 1, skipped: 0 });

      const [item] = (await loadQueue(queuePath)).items;
      expect(item.manifestPath).not.toBe(fixture.manifestPath);
      expect(item.sourceManifestPath).toBe(fixture.manifestPath);
      await expect(fs.promises.readFile(fixture.manifestPath, "utf8").then(JSON.parse))
        .resolves.toMatchObject({ state: "incomplete" });
      await expect(fs.promises.readFile(item.manifestPath, "utf8").then(JSON.parse))
        .resolves.toMatchObject({
          state: "complete",
          tracks: {
            microphone: { sizeBytes: 8, sha256: expect.stringMatching(/^[a-f0-9]{64}$/u) },
            system: { sizeBytes: 7, sha256: expect.stringMatching(/^[a-f0-9]{64}$/u) },
          },
        });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("jednu nulovou stopu zařadí jako chráněný raw incomplete záznam", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-recovery-empty-"));
    const recordingsDirectory = path.join(directory, "nahravky");
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const fixture = await writeRecoverableRecording(
      recordingsDirectory,
      undefined,
      { staleMetadata: true, state: "incomplete" },
    );
    await fs.promises.writeFile(fixture.trackPaths.system, Buffer.alloc(0));
    const logger = { error: vi.fn(), log: vi.fn(), warn: vi.fn() };
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });

    try {
      await expect(recoverOrphanedRecordings({
        logger,
        manifestModulePromise: import("../src/lib/manifest.js"),
        queueStore: store,
        recordingsDirectory,
      })).resolves.toMatchObject({ recovered: 1, skipped: 0 });
      const [item] = (await loadQueue(queuePath)).items;
      expect(item).toMatchObject({
        manifestPath: fixture.manifestPath,
        recoveredIncomplete: true,
      });
      expect(fs.existsSync(`${fixture.manifestPath}.recovered-upload-v1.json`)).toBe(false);
      await expect(fs.promises.readFile(fixture.manifestPath, "utf8"))
        .resolves.toContain("incomplete");
      expect(logger.warn).not.toHaveBeenCalled();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("complete manifest s jednou nulovou stopou obnoví do viditelné fronty", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-recovery-complete-empty-"));
    const recordingsDirectory = path.join(directory, "nahravky");
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const fixture = await writeRecoverableRecording(recordingsDirectory);
    fixture.manifest.tracks.system.sizeBytes = 0;
    fixture.manifest.tracks.system.sha256 = createHash("sha256").update(Buffer.alloc(0)).digest("hex");
    await Promise.all([
      fs.promises.writeFile(fixture.trackPaths.system, Buffer.alloc(0)),
      fs.promises.writeFile(fixture.manifestPath, JSON.stringify(fixture.manifest)),
    ]);
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });

    try {
      await expect(recoverOrphanedRecordings({
        logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
        manifestModulePromise: import("../src/lib/manifest.js"),
        queueStore: store,
        recordingsDirectory,
      })).resolves.toMatchObject({ recovered: 1, skipped: 0 });
      const [item] = (await loadQueue(queuePath)).items;
      expect(item).toMatchObject({ manifestPath: fixture.manifestPath });
      expect(item.recoveredIncomplete).toBeUndefined();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("obě nulové stopy incomplete manifestu nechá na disku bez položky", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-recovery-both-empty-"));
    const recordingsDirectory = path.join(directory, "nahravky");
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const fixture = await writeRecoverableRecording(
      recordingsDirectory,
      undefined,
      { staleMetadata: true, state: "incomplete" },
    );
    await Promise.all([
      fs.promises.writeFile(fixture.trackPaths.microphone, Buffer.alloc(0)),
      fs.promises.writeFile(fixture.trackPaths.system, Buffer.alloc(0)),
    ]);
    const logger = { error: vi.fn(), log: vi.fn(), warn: vi.fn() };
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });

    try {
      await expect(recoverOrphanedRecordings({
        logger,
        manifestModulePromise: import("../src/lib/manifest.js"),
        queueStore: store,
        recordingsDirectory,
      })).resolves.toMatchObject({ recovered: 0, skipped: 1 });
      expect((await loadQueue(queuePath)).items).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledOnce();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("complete stopu nad upload limitem zařadí bez čtení celého souboru", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-recovery-oversized-"));
    const recordingsDirectory = path.join(directory, "nahravky");
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const fixture = await writeRecoverableRecording(recordingsDirectory);
    const oversizedBytes = 512 * 1024 * 1024 + 1;
    await fs.promises.truncate(fixture.trackPaths.system, oversizedBytes);
    fixture.manifest.tracks.system.sizeBytes = oversizedBytes;
    fixture.manifest.tracks.system.sha256 = "c".repeat(64);
    await fs.promises.writeFile(fixture.manifestPath, JSON.stringify(fixture.manifest));
    const realOpen = fs.promises.open.bind(fs.promises);
    const oversizedRead = vi.fn(async () => {
      throw new Error("Nadlimitní stopa se při obnově nesmí hashovat");
    });
    vi.spyOn(fs.promises, "open").mockImplementation(async (target, ...args) => {
      const handle = await realOpen(target, ...args);
      if (String(target) !== fixture.trackPaths.system) return handle;
      return {
        close: handle.close.bind(handle),
        read: oversizedRead,
        stat: handle.stat.bind(handle),
      };
    });
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });

    try {
      await expect(recoverOrphanedRecordings({
        logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
        manifestModulePromise: import("../src/lib/manifest.js"),
        queueStore: store,
        recordingsDirectory,
      })).resolves.toMatchObject({ recovered: 1, skipped: 0 });
      expect((await loadQueue(queuePath)).items).toHaveLength(1);
      expect(oversizedRead).not.toHaveBeenCalled();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("selhání zápisu obnovené položky nezamění za vadný manifest", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-recovery-enospc-"));
    const recordingsDirectory = path.join(directory, "nahravky");
    const fixture = await writeRecoverableRecording(recordingsDirectory);
    const logger = { error: vi.fn(), log: vi.fn(), warn: vi.fn() };
    const queueError = Object.assign(new Error("Na disku není místo"), { code: "ENOSPC" });

    try {
      await expect(recoverOrphanedRecordings({
        logger,
        manifestModulePromise: import("../src/lib/manifest.js"),
        queueStore: { enqueueRecording: vi.fn(async () => { throw queueError; }) },
        recordingsDirectory,
      })).resolves.toMatchObject({ failed: 1, recovered: 0, skipped: 0 });
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("zapsat do fronty"));
      expect(logger.warn).not.toHaveBeenCalled();
      await expect(fs.promises.readFile(fixture.manifestPath, "utf8"))
        .resolves.toContain(fixture.manifest.clientRecordingId);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("existující sidecar přijme jen při přesně shodném bezpečném obsahu", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-recovery-sidecar-"));
    const recordingsDirectory = path.join(directory, "nahravky");
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const fixture = await writeRecoverableRecording(
      recordingsDirectory,
      undefined,
      { staleMetadata: true, state: "incomplete" },
    );
    const logger = { error: vi.fn(), log: vi.fn(), warn: vi.fn() };

    try {
      await recoverOrphanedRecordings({
        logger,
        manifestModulePromise: import("../src/lib/manifest.js"),
        queueStore: { enqueueRecording: vi.fn(async () => { throw new Error("test stop"); }) },
        recordingsDirectory,
      });
      const sidecarPath = `${fixture.manifestPath}.recovered-upload-v1.json`;
      const unsafeSidecar = {
        ...JSON.parse(await fs.promises.readFile(sidecarPath, "utf8")),
        state: "incomplete",
        visibility: "company",
      };
      await fs.promises.writeFile(sidecarPath, JSON.stringify(unsafeSidecar));
      const store = createOutboundQueueStore({
        filePath: queuePath,
        queueModulePromise: import("../src/lib/queue.js"),
        send: vi.fn(),
      });

      await expect(recoverOrphanedRecordings({
        logger,
        manifestModulePromise: import("../src/lib/manifest.js"),
        queueStore: store,
        recordingsDirectory,
      })).resolves.toMatchObject({ recovered: 0, skipped: 1 });
      expect((await loadQueue(queuePath)).items).toHaveLength(0);
      await expect(fs.promises.readFile(sidecarPath, "utf8").then(JSON.parse))
        .resolves.toMatchObject({ state: "incomplete", visibility: "company" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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

  it("ruční retry přeskočí vlastníka čekajícího na člověka a opravdu odešle běžnou položku", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-human-retry-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const firstId = "9e586e55-d688-43f1-8a80-a3d61e754f3e";
    const secondId = "3d4e7b61-e3d4-483c-94cc-a512454f6976";
    const send = vi.fn(async (item) => {
      if (item.clientRecordingId === firstId) {
        throw Object.assign(new Error("Nahrávka patří jinému účtu"), {
          code: "queue_owner_mismatch",
          failureClass: FAILURE_CLASSES.PAUSED,
        });
      }
    });
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send,
    });

    try {
      await store.enqueueRecording(recording(firstId));
      expect((await store.pump(killswitches(ENABLED_SETTING))).outcome).toBe("paused");
      const humanBefore = (await loadQueue(queuePath)).items[0];
      await store.enqueueRecording(recording(secondId));

      const retried = await store.retry(killswitches(ENABLED_SETTING));

      expect(retried.outcome).toBe("sent");
      expect(send).toHaveBeenCalledTimes(2);
      expect(send.mock.calls[1][0].clientRecordingId).toBe(secondId);
      const persisted = await loadQueue(queuePath);
      expect(persisted.items[0]).toEqual(humanBefore);
      expect(persisted.items[1]).toMatchObject({
        clientRecordingId: secondId,
        state: QUEUE_STATES.SENT,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("renderer dostane přesný součet skutečných souborů, ne velikost odhadem z manifestu", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-size-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const recordingsDirectory = path.join(directory, "nahravky");
    const microphonePath = path.join(recordingsDirectory, "microphone.webm");
    const systemPath = path.join(recordingsDirectory, "system.webm");
    const item = recording();
    item.trackPaths = { microphone: microphonePath, system: systemPath };
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });

    try {
      await fs.promises.mkdir(recordingsDirectory, { recursive: true });
      await fs.promises.writeFile(microphonePath, Buffer.alloc(7));
      await fs.promises.writeFile(systemPath, Buffer.alloc(11));
      await store.enqueueRecording(item);

      const reopenedStore = createOutboundQueueStore({
        filePath: queuePath,
        queueModulePromise: import("../src/lib/queue.js"),
        send: vi.fn(),
      });
      const view = await reopenedStore.list();

      expect(view[0]).toMatchObject({ sizeBytes: 18 });
      expect(JSON.stringify(view)).not.toContain(directory);

      await fs.promises.unlink(systemPath);
      expect((await reopenedStore.list())[0]).not.toHaveProperty("sizeBytes");
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
