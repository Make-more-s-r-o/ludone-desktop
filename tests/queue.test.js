import { createHash, createHmac } from "node:crypto";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import queueStore from "../electron/queue.cjs";
import verification from "../electron/recording-verification.cjs";
import { createManifest } from "../src/lib/manifest.js";
import {
  FAILURE_CLASSES,
  QUEUE_ITEM_KINDS,
  QUEUE_STATES,
  UPLOAD_DISABLED_REASON,
  applyServerProgress,
  claimRecording,
  createQueue,
  enqueueRecording,
  enqueueTimeEntry,
  killswitchNameForKind,
  processNext,
  queueItemRequiresHumanAction,
  reduceQueueForRenderer,
  retryDelayMs,
  retryFailedItem,
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
const SERVER_MICROPHONE_ID = "00000000-0000-4000-8000-000000000001";
const SERVER_SYSTEM_ID = "00000000-0000-4000-8000-000000000002";
const SERVER_SESSION_ID = "00000000-0000-4000-8000-000000000101";
const CURRENT_OWNER = `sha256:${"c".repeat(64)}`;
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

// Vypínače čte produkce přes `desktopKillswitch()` a `timeTrackingKillswitch()`,
// takže se sem musí vytáhnout i obě závislosti. Uložené odesílání je v atrapě
// vypnuté; testy tak měří produkční zapojení nad podstrčeným prostředím.
const readProductionQueueKillswitches = Function(
  "applicationSettingsStore",
  "process",
  `"use strict";
  ${functionDeclarationSource(mainSource, "desktopKillswitch")}
  ${functionDeclarationSource(mainSource, "timeTrackingKillswitch")}
  ${functionDeclarationSource(mainSource, "queueKillswitches")}
  return queueKillswitches();`,
).bind(null, { get: () => false });

afterEach(() => {
  if (ORIGINAL_UPLOAD_SETTING === undefined) delete process.env.DESKTOP_UPLOAD_ENABLED;
  else process.env.DESKTOP_UPLOAD_ENABLED = ORIGINAL_UPLOAD_SETTING;
  if (ORIGINAL_TIME_SETTING === undefined) delete process.env.DESKTOP_TIME_ENABLED;
  else process.env.DESKTOP_TIME_ENABLED = ORIGINAL_TIME_SETTING;
  vi.restoreAllMocks();
});

describe("read-only lokální přehled nahrávek", () => {
  const ids = {
    queue: "9e586e55-d688-43f1-8a80-a3d61e754f3e",
    orphan: "11111111-1111-4111-8111-111111111111",
    invalid: "22222222-2222-4222-8222-222222222222",
  };

  function localManifest(id, microphoneName, systemName = null) {
    const tracks = {
      microphone: {
        fileName: microphoneName,
        sha256: "a".repeat(64),
        sizeBytes: 1,
        startedAt: "2026-09-14T10:00:00.000Z",
        endedAt: "2026-09-14T10:00:01.000Z",
      },
    };
    if (systemName !== null) tracks.system = { ...tracks.microphone, fileName: systemName };
    return {
      schemaVersion: 1,
      clientRecordingId: id,
      createdAt: "2026-09-14T10:00:00.000Z",
      closedAt: "2026-09-14T10:00:01.000Z",
      state: "complete",
      tracks,
    };
  }

  it("spojí frontu s orphan manifesty, ignoruje sidecar a rozliší úplnost i nulový soubor", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-local-dashboard-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const recordingsDirectory = path.join(directory, "nahravky");
    const queueManifestPath = path.join(recordingsDirectory, "queue.manifest.json");
    const orphanManifestPath = path.join(recordingsDirectory, "orphan.manifest.json");
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });
    try {
      await fs.promises.mkdir(recordingsDirectory, { recursive: true });
      const queueManifest = localManifest(ids.queue, "queue-mic.webm", "queue-system.webm");
      await fs.promises.writeFile(queueManifestPath, JSON.stringify(queueManifest));
      await fs.promises.writeFile(path.join(recordingsDirectory, "queue-mic.webm"), "mikrofon");
      await store.enqueueRecording({
        manifest: queueManifest,
        manifestPath: queueManifestPath,
        trackPaths: {
          microphone: path.join(recordingsDirectory, "queue-mic.webm"),
          system: path.join(recordingsDirectory, "queue-system.webm"),
        },
      });

      const orphanManifest = localManifest(ids.orphan, "orphan-zero.webm");
      await fs.promises.writeFile(orphanManifestPath, JSON.stringify(orphanManifest));
      await fs.promises.writeFile(path.join(recordingsDirectory, "orphan-zero.webm"), Buffer.alloc(0));
      await fs.promises.writeFile(
        `${orphanManifestPath}.recovered-upload-v1.json`,
        JSON.stringify(orphanManifest),
      );

      const snapshot = await store.listLocalRecordings();
      expect(snapshot.items).toHaveLength(2);
      expect(snapshot.items.find((item) => item.id === ids.queue)).toMatchObject({
        source: "queue",
        localState: "partial-audio",
        revision: expect.stringMatching(/^sha256:/u),
        fileRevision: expect.stringMatching(/^sha256:/u),
      });
      expect(snapshot.items.find((item) => item.id === ids.orphan)).toMatchObject({
        source: "orphan",
        localState: "complete-audio",
        sizeBytes: 0,
        revision: null,
        allowedActions: { claim: false, delete: false, retry: false, send: false },
      });
      expect(snapshot.unreadableCount).toBe(0);
      expect(JSON.stringify(snapshot)).not.toContain(directory);
      expect(JSON.stringify(snapshot)).not.toContain("ownerFingerprint");

      const persisted = JSON.parse(await fs.promises.readFile(queuePath, "utf8"));
      persisted.items[0].state = "selhalo";
      persisted.items[0].nextAttemptAt = 123_456;
      persisted.items[0].lastFailureReason = `token-like /Users/utocnik/${"s".repeat(48)}`;
      await fs.promises.writeFile(queuePath, JSON.stringify(persisted));
      const sanitized = await store.listLocalRecordings();
      expect(sanitized.items.find((item) => item.id === ids.queue).blockReason)
        .toBe("Předchozí pokus se nezdařil.");
      expect(sanitized.items.find((item) => item.id === ids.queue).nextAttemptAt).toBe(123_456);
      expect(JSON.stringify(sanitized)).not.toContain("token-like");
      expect(JSON.stringify(sanitized)).not.toContain("/Users/utocnik");

      for (const inheritedObjectKey of ["__proto__", "constructor"]) {
        persisted.items[0].lastFailureReason = inheritedObjectKey;
        await fs.promises.writeFile(queuePath, JSON.stringify(persisted));
        const protectedSnapshot = await store.listLocalRecordings();
        const protectedReason = protectedSnapshot.items.find((item) => item.id === ids.queue)
          .blockReason;
        expect(protectedReason).toBe("Předchozí pokus se nezdařil.");
        expect(typeof protectedReason).toBe("string");
      }

      await fs.promises.writeFile(queueManifestPath, JSON.stringify({
        ...queueManifest,
        clientRecordingId: ids.invalid,
      }));
      const mismatched = await store.listLocalRecordings();
      expect(mismatched.items.find((item) => item.id === ids.queue)).toMatchObject({
        localState: "invalid-manifest",
        allowedActions: { claim: false, delete: false, retry: false, send: false },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("odliší missing a invalid manifest, neuhodne ID a fileRevision reaguje na disk", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-local-dashboard-invalid-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const recordingsDirectory = path.join(directory, "nahravky");
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });
    try {
      await fs.promises.mkdir(recordingsDirectory, { recursive: true });
      const orphanPath = path.join(recordingsDirectory, "missing.manifest.json");
      await fs.promises.writeFile(orphanPath, JSON.stringify(localManifest(ids.orphan, "missing.webm")));
      await fs.promises.writeFile(
        path.join(recordingsDirectory, "invalid.manifest.json"),
        JSON.stringify({ ...localManifest(ids.invalid, "../unik.webm"), tracks: {
          microphone: { ...localManifest(ids.invalid, "x").tracks.microphone, fileName: "../unik.webm" },
        } }),
      );
      await fs.promises.writeFile(path.join(recordingsDirectory, "broken.manifest.json"), "{tajna-cesta:/tmp/x");

      const first = await store.listLocalRecordings();
      expect(first.items.find((item) => item.id === ids.orphan)).toMatchObject({
        localState: "missing-audio",
        sizeBytes: null,
      });
      expect(first.items.find((item) => item.id === ids.invalid)).toMatchObject({
        localState: "invalid-manifest",
        fileRevision: expect.stringMatching(/^sha256:/u),
      });
      expect(first.unreadableCount).toBe(1);
      expect(JSON.stringify(first)).not.toContain("tajna-cesta");
      expect(JSON.stringify(first)).not.toContain("../unik.webm");

      await fs.promises.writeFile(path.join(recordingsDirectory, "missing.webm"), "nový zvuk");
      const second = await store.listLocalRecordings();
      expect(second.items.find((item) => item.id === ids.orphan)).toMatchObject({
        localState: "complete-audio",
        sizeBytes: 10,
      });
      expect(second.items.find((item) => item.id === ids.orphan).fileRevision)
        .not.toBe(first.items.find((item) => item.id === ids.orphan).fileRevision);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rozbitou frontu odmítne před scanem a nic na disku nezmění", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-local-dashboard-queue-error-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const recordingsDirectory = path.join(directory, "nahravky");
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });
    try {
      await fs.promises.mkdir(path.dirname(queuePath), { recursive: true });
      await fs.promises.mkdir(recordingsDirectory, { recursive: true });
      await fs.promises.writeFile(queuePath, JSON.stringify({ schemaVersion: 1, items: [] }));
      const orphanPath = path.join(recordingsDirectory, "orphan.manifest.json");
      await fs.promises.writeFile(orphanPath, JSON.stringify(localManifest(ids.orphan, "zero.webm")));
      await expect(store.listLocalRecordings()).resolves.toMatchObject({ unreadableCount: 0 });
      await fs.promises.writeFile(queuePath, "{rozbita-fronta");
      const beforeQueue = await fs.promises.readFile(queuePath, "utf8");
      const beforeManifest = await fs.promises.readFile(orphanPath, "utf8");

      await expect(store.listLocalRecordings()).rejects.toThrow();
      expect(await fs.promises.readFile(queuePath, "utf8")).toBe(beforeQueue);
      expect(await fs.promises.readFile(orphanPath, "utf8")).toBe(beforeManifest);
      expect(await fs.promises.readdir(recordingsDirectory)).toEqual(["orphan.manifest.json"]);
      await expect(store.enqueueRecording({})).rejects.toThrow(/JSON/u);
      expect(await fs.promises.readFile(queuePath, "utf8")).toBe(beforeQueue);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("symlink a podadresář nesmí vytvořit použitelnou orphan kartu", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-local-dashboard-symlink-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const recordingsDirectory = path.join(directory, "nahravky");
    const outside = path.join(directory, "outside.manifest.json");
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });
    try {
      await fs.promises.mkdir(recordingsDirectory, { recursive: true });
      await fs.promises.mkdir(path.join(recordingsDirectory, "nested"));
      await fs.promises.writeFile(outside, JSON.stringify(localManifest(ids.orphan, "x.webm")));
      await fs.promises.symlink(outside, path.join(recordingsDirectory, "link.manifest.json"));
      await fs.promises.writeFile(
        path.join(recordingsDirectory, "nested", "ignored.manifest.json"),
        JSON.stringify(localManifest(ids.invalid, "x.webm")),
      );

      const snapshot = await store.listLocalRecordings();
      expect(snapshot.items).toEqual([]);
      expect(snapshot.unreadableCount).toBe(1);
      expect(JSON.stringify(snapshot)).not.toContain(directory);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("queue řádek bez UUID skončí jen v unreadableCount", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-local-dashboard-bad-id-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    try {
      await fs.promises.mkdir(path.dirname(queuePath), { recursive: true });
      await fs.promises.mkdir(path.join(directory, "nahravky"));
      await fs.promises.writeFile(queuePath, JSON.stringify({
        schemaVersion: 1,
        items: [{
          clientRecordingId: "/Users/utocnik/token-like",
          kind: "recording",
          state: "ceka",
          attempts: 0,
          nextAttemptAt: null,
          lastFailureReason: "secret",
          manifestPath: "/Users/utocnik/secret.manifest.json",
          tracks: {},
        }],
      }));
      const store = createOutboundQueueStore({
        filePath: queuePath,
        queueModulePromise: import("../src/lib/queue.js"),
        send: vi.fn(),
      });
      const snapshot = await store.listLocalRecordings();
      expect(snapshot).toEqual({ items: [], unreadableCount: 1 });
      expect(JSON.stringify(snapshot)).not.toContain("utocnik");
      expect(JSON.stringify(snapshot)).not.toContain("secret");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("odmítne symlink kořene před čtením a nadlimitní manifest jen bezpečně sečte", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-local-dashboard-root-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const recordingsDirectory = path.join(directory, "nahravky");
    const targetDirectory = path.join(directory, "cil");
    try {
      await fs.promises.mkdir(path.dirname(queuePath), { recursive: true });
      await fs.promises.writeFile(queuePath, JSON.stringify({ schemaVersion: 1, items: [] }));
      await fs.promises.mkdir(targetDirectory);
      await fs.promises.symlink(targetDirectory, recordingsDirectory);
      const unsafeStore = createOutboundQueueStore({
        filePath: queuePath,
        queueModulePromise: import("../src/lib/queue.js"),
        send: vi.fn(),
      });
      await expect(unsafeStore.listLocalRecordings()).rejects.toThrow(/adresář nahrávek/u);

      await fs.promises.unlink(recordingsDirectory);
      await fs.promises.mkdir(recordingsDirectory);
      await fs.promises.writeFile(
        path.join(recordingsDirectory, "oversize.manifest.json"),
        Buffer.alloc((1024 * 1024) + 1, 123),
      );
      const safeStore = createOutboundQueueStore({
        filePath: queuePath,
        queueModulePromise: import("../src/lib/queue.js"),
        send: vi.fn(),
      });
      await expect(safeStore.listLocalRecordings()).resolves.toEqual({
        items: [],
        unreadableCount: 1,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
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

function ownedRecording(clientRecordingId) {
  return { ...recording(clientRecordingId), ownerFingerprint: CURRENT_OWNER };
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
      expect(item.server).toEqual({
        sessionId: null,
        tracks: {
          microphone: { recordingId: null, uploadedBytes: 0 },
          system: { recordingId: null, uploadedBytes: 0 },
        },
      });
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

  it("🔴 po 429 počká přesně tolik, kolik řekl server, ne podle vlastního rozvrhu", async () => {
    // Náš rozvrh by z `now` udělal `now + 30 000`. Server ale řekl 90 sekund, a jeho okno
    // ještě běží — kdybychom se probudili dřív, každý pokus by se mu do limitu počítal
    // znovu a okno bychom si sami posunuli. Proto musí vyhrát hodnota od serveru.
    const now = 1_777_000_001_000;
    const send = vi.fn(async () => {
      throw Object.assign(new Error("rate_limited (HTTP 429)"), {
        code: "rate_limited",
        failureClass: FAILURE_CLASSES.RETRYABLE,
        retryAfterMs: 90_000,
        status: 429,
      });
    });

    const result = await processNext(oneItemQueue(), killswitches(ENABLED_SETTING), send, {
      now,
      random: () => 0,
    });

    expect(result).toMatchObject({
      outcome: "rate_limited",
      retryAt: now + 90_000,
      item: { attempts: 0, nextAttemptAt: null, state: QUEUE_STATES.WAITING },
    });
  });

  it("429 zachová původní attempts i částečný per-track progress a bez intervalu čeká hodinu", async () => {
    const now = 1_777_000_001_000;
    const queue = oneItemQueue();
    queue.items[0].attempts = 4;
    const result = await processNext(
      queue,
      killswitches(ENABLED_SETTING),
      async (_item, reportProgress) => {
        await reportProgress({
          track: "microphone",
          recordingId: SERVER_MICROPHONE_ID,
          sessionId: SERVER_SESSION_ID,
          uploadedBytes: 120,
        });
        throw Object.assign(new Error("jakýkoli text"), { status: 429 });
      },
      { now },
    );

    expect(result).toMatchObject({
      outcome: "rate_limited",
      retryAt: now + 60 * 60 * 1_000,
      item: {
        attempts: 4,
        state: QUEUE_STATES.WAITING,
        server: {
          sessionId: SERVER_SESSION_ID,
          tracks: { microphone: { recordingId: SERVER_MICROPHONE_ID, uploadedBytes: 120 } },
        },
      },
    });
  });

  it("HTTP 429 u timeentry zachová původní retryable kontrakt bez rate_limited outcome", async () => {
    const queued = enqueueTimeEntry(createQueue(), {
      clientTimeEntryId: "9e586e55-d688-43f1-8a80-a3d61e754f3e",
      projectId: "865a78f8-b47f-4bb8-8b34-f4ec07f6f516",
      startedAt: "2026-09-14T08:00:00.000Z",
      endedAt: "2026-09-14T08:30:00.000Z",
    }).queue;
    const result = await processNext(
      queued,
      killswitches(undefined, ENABLED_SETTING),
      async () => {
        throw Object.assign(new Error("time limit"), { status: 429, retryAfterMs: 90_000 });
      },
      { now: 1_777_000_001_000, random: () => 0 },
    );

    expect(result).toMatchObject({
      outcome: "retry_scheduled",
      item: { attempts: 1, kind: QUEUE_ITEM_KINDS.TIME },
    });
    expect(result).not.toHaveProperty("retryAt");
  });

  it("cooldown na přesné hraně expirace není chyba a dovolí recording send", async () => {
    const now = 1_777_000_001_000;
    const send = vi.fn(async () => {});
    const result = await processNext(
      {
        ...oneItemQueue(),
        items: [{ ...oneItemQueue().items[0], ownerFingerprint: CURRENT_OWNER }],
      },
      killswitches(ENABLED_SETTING),
      send,
      {
        currentOwnerFingerprint: CURRENT_OWNER,
        now,
        recordingCooldownRetryAt: now,
      },
    );

    expect(result.outcome).toBe("sent");
    expect(send).toHaveBeenCalledOnce();
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

  it.each([`sha256:${"a".repeat(64)}`, null])(
    "vrátí selhalo do ceka bez změny důvodu, vlastníka (%s) a vstupní fronty",
    (ownerFingerprint) => {
      const queued = enqueueRecording(
        oneItemQueue(),
        recording("3d4e7b61-e3d4-483c-94cc-a512454f6976"),
        1_777_000_001_000,
      ).queue;
      queued.items[1] = {
        ...queued.items[1],
        attempts: 3,
        lastFailureReason: "manifest není platný",
        nextAttemptAt: 1_777_000_031_000,
        ownerFingerprint,
        state: QUEUE_STATES.FAILED,
      };
      const before = structuredClone(queued);

      const result = retryFailedItem(queued, queued.items[1].clientRecordingId);

      expect(result.item).toEqual({
        ...before.items[1],
        attempts: 0,
        nextAttemptAt: null,
        // Příznak „čeká na člověka" se sráží výslovně, jinak by ho odvození z uloženého
        // důvodu zvedlo znovu a položka by v `ceka` uvízla, aniž by to bylo vidět.
        requiresHumanAction: false,
        state: QUEUE_STATES.WAITING,
      });
      expect(result.item.lastFailureReason).toBe("manifest není platný");
      expect(result.item.ownerFingerprint).toBe(ownerFingerprint);
      expect(result.queue).not.toBe(queued);
      expect(result.queue.items).not.toBe(queued.items);
      expect(result.queue.items).toEqual([before.items[0], result.item]);
      expect(result.queue.items[0]).toBe(queued.items[0]);
      expect(result.queue.items[1]).toBe(result.item);
      expect(result.item).not.toBe(queued.items[1]);
      expect(queued).toEqual(before);
    },
  );

  it.each([QUEUE_STATES.WAITING, QUEUE_STATES.SENDING, QUEUE_STATES.SENT])(
    "vrácení položky ve stavu %s ponechá původní frontu i položku",
    (state) => {
      const queued = oneItemQueue();
      queued.items[0] = {
        ...queued.items[0],
        attempts: 2,
        lastFailureReason: "Nahrávka patří jinému účtu",
        nextAttemptAt: 1_777_000_031_000,
        ownerFingerprint: `sha256:${"a".repeat(64)}`,
        requiresHumanAction: true,
        state,
      };
      const before = structuredClone(queued);

      const result = retryFailedItem(queued, queued.items[0].clientRecordingId);

      expect(result.queue).toBe(queued);
      expect(result.item).toBe(queued.items[0]);
      expect(queued).toEqual(before);
    },
  );

  // Položka uložená starším schématem nenese `requiresHumanAction`; příznak se odvozuje
  // z uloženého důvodu. Bez výslovného sražení by návrat do fronty jen vypadal, že proběhl.
  it("vrácená položka se opravdu dostane k dalšímu pokusu, ne jen do stavu ceka", async () => {
    const queued = oneItemQueue();
    const bezPriznaku = {
      ...queued.items[0],
      attempts: 3,
      lastFailureReason: "server odmítl nahrávku",
      state: QUEUE_STATES.FAILED,
    };
    // Klíč tu nesmí být vůbec — jinak by se příznak četl z něj a ne z uloženého důvodu,
    // což je právě ta cesta, kterou tenhle test měří.
    delete bezPriznaku.requiresHumanAction;
    queued.items[0] = bezPriznaku;

    const retried = retryFailedItem(queued, queued.items[0].clientRecordingId);
    expect(queueItemRequiresHumanAction(retried.item)).toBe(false);

    const send = vi.fn().mockResolvedValue(undefined);
    const result = await processNext(retried.queue, killswitches(ENABLED_SETTING), send, {
      now: 1_777_000_001_000,
    });

    expect(send).toHaveBeenCalledOnce();
    expect(result.outcome).toBe("sent");
  });

  it.each([
    ["kód rodiny vlastnictví", "queue_owner_mismatch"],
    ["starší česká hláška", "Nahrávka patří jinému účtu"],
  ])("%s se ručním vrácením neobejde", (_label, lastFailureReason) => {
    const queued = oneItemQueue();
    queued.items[0] = {
      ...queued.items[0],
      attempts: 3,
      lastFailureReason,
      state: QUEUE_STATES.FAILED,
    };
    const before = structuredClone(queued);

    const result = retryFailedItem(queued, queued.items[0].clientRecordingId);

    expect(result.queue).toBe(queued);
    expect(result.item).toBe(queued.items[0]);
    expect(result.item.state).toBe(QUEUE_STATES.FAILED);
    expect(queued).toEqual(before);
  });

  it("vrácení neznámého clientRecordingId odmítne a frontu nezmění", () => {
    const queued = oneItemQueue();
    queued.items[0] = { ...queued.items[0], attempts: 3, state: QUEUE_STATES.FAILED };
    const before = structuredClone(queued);

    expect(() => retryFailedItem(queued, "nezname-id"))
      .toThrow("položka fronty nebyla nalezena");
    expect(queued).toEqual(before);
  });

  it.each([FAILURE_CLASSES.PERMANENT, FAILURE_CLASSES.RETRYABLE])(
    "po selhání %s umožní nový pokus s obnoveným rozpočtem pokusů",
    async (failureClass) => {
      const queued = oneItemQueue();
      queued.items[0] = { ...queued.items[0], attempts: 2 };
      const failed = await processNext(queued, killswitches(ENABLED_SETTING), async () => {
        throw Object.assign(new Error("server odmítl nahrávku"), { failureClass });
      }, {
        now: 1_777_000_001_000,
        retryPolicy: { maxAttempts: 3 },
      });
      expect(failed.outcome).toBe("failed");
      const retried = retryFailedItem(failed.queue, failed.item.clientRecordingId);
      const send = vi.fn().mockResolvedValue(undefined);

      const result = await processNext(retried.queue, killswitches(ENABLED_SETTING), send, {
        now: 1_777_000_001_000,
      });

      expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        clientRecordingId: failed.item.clientRecordingId,
        attempts: 1,
        lastFailureReason: "server odmítl nahrávku",
        state: QUEUE_STATES.SENDING,
      }), expect.any(Function));
      expect(result.outcome).toBe("sent");
      expect(result.item.state).toBe(QUEUE_STATES.SENT);
    },
  );

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
      recordingId: SERVER_MICROPHONE_ID,
      uploadedBytes: { microphone: 90, system: 180 },
    });
    const correctedByServer = applyServerProgress(
      first.queue,
      queued.items[0].clientRecordingId,
      {
        recordingId: SERVER_MICROPHONE_ID,
        uploadedBytes: { microphone: 40, system: 80 },
      },
    );

    expect(correctedByServer.item.server).toEqual({
      legacyRecordingId: SERVER_MICROPHONE_ID,
      sessionId: null,
      tracks: {
        microphone: { recordingId: null, uploadedBytes: 40 },
        system: { recordingId: null, uploadedBytes: 80 },
      },
    });
  });

  it("ukládá recordingId po stopách a odmítne pozdější změnu ID nebo session", () => {
    const queued = oneItemQueue();
    const microphone = applyServerProgress(queued, queued.items[0].clientRecordingId, {
      recordingId: SERVER_MICROPHONE_ID,
      sessionId: SERVER_SESSION_ID,
      track: "microphone",
    });
    const completed = applyServerProgress(
      microphone.queue,
      queued.items[0].clientRecordingId,
      {
        recordingId: SERVER_MICROPHONE_ID,
        sessionId: SERVER_SESSION_ID,
        track: "microphone",
        uploadedBytes: 120,
      },
    );

    expect(completed.item.server).toEqual({
      sessionId: SERVER_SESSION_ID,
      tracks: {
        microphone: { recordingId: SERVER_MICROPHONE_ID, uploadedBytes: 120 },
        system: { recordingId: null, uploadedBytes: 0 },
      },
    });
    expect(() => applyServerProgress(completed.queue, completed.item.clientRecordingId, {
      recordingId: "00000000-0000-4000-8000-000000000099",
      sessionId: SERVER_SESSION_ID,
      track: "microphone",
    })).toThrow(/změnil recordingId/u);
    expect(() => applyServerProgress(completed.queue, completed.item.clientRecordingId, {
      recordingId: SERVER_SYSTEM_ID,
      sessionId: "00000000-0000-4000-8000-000000000199",
      track: "system",
    })).toThrow(/změnil sessionId/u);
  });

  it("odmítne neplatné nebo společné recordingId dvou stop", () => {
    const queued = oneItemQueue();
    expect(() => applyServerProgress(queued, queued.items[0].clientRecordingId, {
      recordingId: "server-microphone",
      sessionId: SERVER_SESSION_ID,
      track: "microphone",
    })).toThrow(/recordingId musí být GUID/u);

    const microphone = applyServerProgress(queued, queued.items[0].clientRecordingId, {
      recordingId: SERVER_MICROPHONE_ID,
      sessionId: SERVER_SESSION_ID,
      track: "microphone",
    });
    expect(() => applyServerProgress(microphone.queue, queued.items[0].clientRecordingId, {
      recordingId: SERVER_MICROPHONE_ID,
      sessionId: SERVER_SESSION_ID,
      track: "system",
    })).toThrow(/stejné recordingId dvěma stopám/u);
  });

  it("propustí ověřený návrat senderu do výsledku i per-stopového stavu fronty", async () => {
    const sendResult = {
      completedUploads: 2,
      quotaWarning: false,
      uploads: [
        {
          recordingId: SERVER_MICROPHONE_ID,
          sessionId: SERVER_SESSION_ID,
          track: "microphone",
          uploadedBytes: 120,
        },
        {
          recordingId: SERVER_SYSTEM_ID,
          sessionId: SERVER_SESSION_ID,
          track: "system",
          uploadedBytes: 240,
        },
      ],
    };

    const result = await processNext(
      oneItemQueue(),
      killswitches(ENABLED_SETTING),
      async () => sendResult,
      { now: 1_777_000_001_000 },
    );

    expect(result).toMatchObject({ outcome: "sent", sendResult });
    expect(result.item.server).toEqual({
      sessionId: SERVER_SESSION_ID,
      tracks: {
        microphone: { recordingId: SERVER_MICROPHONE_ID, uploadedBytes: 120 },
        system: { recordingId: SERVER_SYSTEM_ID, uploadedBytes: 240 },
      },
    });
  });

  it("výsledek senderu nesmí uložit neexistující stopu ani označit položku jako odeslanou", async () => {
    const result = await processNext(
      oneItemQueue(),
      killswitches(ENABLED_SETTING),
      async () => ({
        completedUploads: 1,
        uploads: [{
          recordingId: "server-camera",
          sessionId: SERVER_SESSION_ID,
          track: "camera",
          uploadedBytes: 10,
        }],
      }),
      { now: 1_777_000_001_000, random: () => 0 },
    );

    expect(result.outcome).toBe("retry_scheduled");
    expect(result.queue.items[0].state).toBe(QUEUE_STATES.WAITING);
    expect(result.queue.items[0].server.tracks.microphone.recordingId).toBeNull();
  });

  // Postup pro nahrávku, která ve frontě NENÍ, znamená, že se rozešel stav klienta a serveru.
  // Tiché přijetí by ten rozpor schovalo a offsety by se zapsaly někam, kde je nikdo nečeká.
  it("postup k neznámé nahrávce odmítne a frontu nezmění", () => {
    const queued = oneItemQueue();
    const before = structuredClone(queued);

    expect(() => applyServerProgress(queued, "nezname-id", {
      recordingId: "server-recording-id",
      uploadedBytes: { microphone: 10, system: 20 },
    })).toThrow("položka fronty nebyla nalezena");
    expect(queued).toEqual(before);
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
      createdAt: null,
      durationMs: null,
      sizeBytes: null,
      server: {
        sessionId: null,
        tracks: {
          microphone: { recordingId: null, uploadedBytes: 0 },
          system: { recordingId: null, uploadedBytes: 0 },
        },
      },
      blockReason: null,
      ownership: "unavailable",
    });
  });

  it("projekce odliší neznámého, vlastního a cizího vlastníka bez zveřejnění otisku", () => {
    const currentOwner = `sha256:${"a".repeat(64)}`;
    const otherOwner = `sha256:${"b".repeat(64)}`;
    const queue = createQueue();
    queue.items = [
      { ...oneItemQueue("11111111-1111-4111-8111-111111111111").items[0], ownerFingerprint: null },
      {
        ...oneItemQueue("22222222-2222-4222-8222-222222222222").items[0],
        lastFailureReason: "unauthorized",
        ownerFingerprint: currentOwner,
        requiresHumanAction: true,
      },
      { ...oneItemQueue("33333333-3333-4333-8333-333333333333").items[0], ownerFingerprint: otherOwner },
    ];

    const view = reduceQueueForRenderer(queue, currentOwner);

    expect(view.map((item) => item.ownership)).toEqual(["unknown", "current", "other"]);
    expect(view[0]).not.toHaveProperty("requiresHumanAction");
    expect(JSON.stringify(view)).not.toContain(currentOwner);
    expect(JSON.stringify(view)).not.toContain(otherOwner);
    expect(reduceQueueForRenderer(queue).map((item) => item.ownership))
      .toEqual(["unknown", "unavailable", "unavailable"]);
  });

  it("projekce zpřístupní jen bezpečná serverová pole a přesný důvod blokace", () => {
    const queue = oneItemQueue();
    queue.items[0] = {
      ...queue.items[0],
      createdAt: "2026-08-25T08:00:00.000Z",
      durationMs: 1_800_000,
      sizeBytes: 360,
      lastFailureReason: "Nahrávka patří jinému účtu",
      requiresHumanAction: true,
      server: {
        sessionId: SERVER_SESSION_ID,
        token: "nesmí ven",
        tracks: {
          microphone: {
            recordingId: SERVER_MICROPHONE_ID,
            uploadedBytes: 120,
            signedUrl: "https://example.invalid/tajne",
          },
          system: { recordingId: SERVER_SYSTEM_ID, uploadedBytes: 240 },
        },
      },
    };

    const [view] = reduceQueueForRenderer(queue);

    expect(view).toMatchObject({
      blockReason: "Nahrávka patří jinému účtu",
      createdAt: "2026-08-25T08:00:00.000Z",
      durationMs: 1_800_000,
      sizeBytes: 360,
      server: {
        sessionId: SERVER_SESSION_ID,
        tracks: {
          microphone: { recordingId: SERVER_MICROPHONE_ID, uploadedBytes: 120 },
          system: { recordingId: SERVER_SYSTEM_ID, uploadedBytes: 240 },
        },
      },
    });
    expect(JSON.stringify(view)).not.toContain("nesmí ven");
    expect(JSON.stringify(view)).not.toContain("signedUrl");
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

  it("nevybraná firma je čekání na člověka, ne tiché stání fronty", async () => {
    // Dřív z toho byla obyčejná pauza bez příznaku — panel pak ukázal jen „N čeká na
    // odeslání" a ŽÁDNOU příčinu. Uživatel viděl frontu, která se nehýbe, a nevěděl proč.
    const result = await processNext(
      oneItemQueue(),
      killswitches(ENABLED_SETTING),
      async () => {
        throw Object.assign(new Error("Není vybraná firma, pod kterou se má nahrávka odeslat"), {
          code: "company_not_chosen",
          failureClass: FAILURE_CLASSES.PAUSED,
        });
      },
    );

    expect(result.outcome).toBe("paused");
    expect(result.queue.items[0]).toHaveProperty("requiresHumanAction", true);
    expect(reduceQueueForRenderer(result.queue)[0]).toMatchObject({ requiresHumanAction: true });
  });

  it("nedosažitelný seznam firem je opakovatelný a frontu nezastaví", async () => {
    // 🔴 Opak předchozího: tohle je přechodné (výpadek, přesměrování na přihlášení), takže
    // se má zkusit znovu — a hlavně to NESMÍ zmrazit celou frontu jako pauza.
    const send = vi.fn(async () => {
      throw Object.assign(new Error("Seznam firem se nepodařilo získat"), {
        code: "company_offer_unavailable",
        failureClass: FAILURE_CLASSES.RETRYABLE,
      });
    });

    const result = await processNext(oneItemQueue(), killswitches(ENABLED_SETTING), send);

    expect(result.outcome).toBe("retry_scheduled");
    expect(result.queue.items[0]).toHaveProperty("requiresHumanAction", false);
    expect(result.queue.items[0].nextAttemptAt).not.toBeNull();
  });

  it("insufficient_scope (HTTP 403) je čekání na člověka, ne tichá nekonečná smyčka", async () => {
    // Nastane v přechodovém okně po zapnutí uploadu: uložená session ještě nese starý scope
    // `mcp:read`, upload routa vyžaduje `nahravky:upload` → 403. Opakování nepomůže, spraví
    // to jedině nové přihlášení — proto to musí být vidět jako „čeká na člověka".
    const result = await processNext(
      oneItemQueue(),
      killswitches(ENABLED_SETTING),
      async () => {
        throw Object.assign(new Error("insufficient_scope (HTTP 403)"), {
          code: "insufficient_scope",
          status: 403,
          failureClass: FAILURE_CLASSES.PAUSED,
        });
      },
    );

    expect(result.outcome).toBe("paused");
    expect(result.queue.items[0]).toHaveProperty("requiresHumanAction", true);
  });

  it("položka pauznutá na insufficient_scope se další pumpou sama nezkusí", async () => {
    const paused = await processNext(
      oneItemQueue(),
      killswitches(ENABLED_SETTING),
      async () => {
        throw Object.assign(new Error("insufficient_scope (HTTP 403)"), {
          code: "insufficient_scope",
          status: 403,
          failureClass: FAILURE_CLASSES.PAUSED,
        });
      },
    );
    const send = vi.fn().mockResolvedValue(undefined);
    const still = await processNext(paused.queue, killswitches(ENABLED_SETTING), send);

    expect(send).not.toHaveBeenCalled();
    expect(still.outcome).toBe("idle");
    expect(reduceQueueForRenderer(still.queue)[0]).toHaveProperty("requiresHumanAction", true);
  });

  // 🔴 Sada k vadě z 11. 9. 2026: jedna nahrávka bez vlastníka spotřebovala celý pump, takže
  // 19 takových položek v čele fronty ji zmrazilo napořád a nové nahrávky se nikdy nedostaly
  // na řadu. Pump je teď smí přeskočit — ale JEN je, chyba přihlášení musí pořád zastavit.
  const uploadEnabled = () => ({
    [killswitchNameForKind(QUEUE_ITEM_KINDS.RECORDING)]: ENABLED_SETTING,
  });
  const queueWithRecordings = (ids) => ids.reduce(
    (accumulated, id, order) => enqueueRecording(
      accumulated,
      recording(id),
      1_777_000_000_000 + order,
    ).queue,
    createQueue(),
  );
  const PRVNI = "11111111-1111-4111-8111-111111111111";
  const DRUHA = "22222222-2222-4222-8222-222222222222";
  const TRETI = "33333333-3333-4333-8333-333333333333";
  const bezVlastnika = () => Object.assign(new Error("Vlastník nahrávky není potvrzený"), {
    code: "queue_owner_unknown",
    failureClass: FAILURE_CLASSES.PAUSED,
  });

  it("nahrávku bez vlastníka přeskočí a odešle další v pořadí", async () => {
    const send = vi.fn(async (item) => {
      if (item.clientRecordingId === PRVNI) throw bezVlastnika();
    });

    const result = await processNext(
      queueWithRecordings([PRVNI, DRUHA]),
      uploadEnabled(),
      send,
    );

    // Odešle se DRUHÁ — první jen překáží a sama se odeslat nedá.
    expect(result.outcome).toBe("sent");
    expect(result.item.clientRecordingId).toBe(DRUHA);
    expect(send).toHaveBeenCalledTimes(2);
    // A ta přeskočená zůstane označená, takže ji příští pump už nebude zkoušet.
    const skipped = result.queue.items.find((item) => item.clientRecordingId === PRVNI);
    expect(skipped).toMatchObject({ state: QUEUE_STATES.WAITING, requiresHumanAction: true });
  });

  it("když jsou všechny připravené bez vlastníka, označí je všechny a nic neodešle", async () => {
    const send = vi.fn(async () => {
      throw bezVlastnika();
    });

    const result = await processNext(
      queueWithRecordings([PRVNI, DRUHA, TRETI]),
      uploadEnabled(),
      send,
    );

    expect(result.outcome).toBe("paused");
    expect(send).toHaveBeenCalledTimes(3);
    expect(result.queue.items.every((item) => item.requiresHumanAction === true)).toBe(true);
    expect(result.reason).toMatch(/3 nahrávek čeká na potvrzení vlastníka/u);
  });

  it("🔴 chyba přihlášení pump ZASTAVÍ a zbytek fronty vůbec nezkouší", async () => {
    // Kdyby se pokračovalo i tady, 401 by se zopakovalo u každé položky fronty — desítky
    // marných požadavků a vyčerpaný limit serveru. Proto se pokračuje jen u vlastnictví.
    const send = vi.fn(async () => {
      throw Object.assign(new Error("unauthorized"), {
        code: "unauthorized",
        status: 401,
        failureClass: FAILURE_CLASSES.PAUSED,
      });
    });

    const result = await processNext(
      queueWithRecordings([PRVNI, DRUHA, TRETI]),
      uploadEnabled(),
      send,
    );

    expect(result.outcome).toBe("paused");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("neznámý důvod pauzy pump taky zastaví (fail-closed)", async () => {
    const send = vi.fn(async () => {
      throw Object.assign(new Error("dočasně nedostupný vlastník databáze"), {
        code: "database_owner_unavailable",
        failureClass: FAILURE_CLASSES.PAUSED,
      });
    });

    const result = await processNext(
      queueWithRecordings([PRVNI, DRUHA]),
      uploadEnabled(),
      send,
    );

    expect(result.outcome).toBe("paused");
    expect(send).toHaveBeenCalledTimes(1);
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
  it("potvrzené převzetí změní jedinou položku, vyčistí cizí serverová ID a zůstane držené", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-claim-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const firstId = recording().manifest.clientRecordingId;
    const secondId = "3d4e7b61-e3d4-483c-94cc-a512454f6976";
    const oldOwner = `sha256:${"a".repeat(64)}`;
    const newOwner = `sha256:${"b".repeat(64)}`;
    const queue = oneItemQueue(firstId);
    queue.items.push(oneItemQueue(secondId).items[0]);
    queue.items[0] = {
      ...queue.items[0],
      lastFailureReason: "Nahrávka patří jinému účtu",
      ownerFingerprint: oldOwner,
      requiresHumanAction: true,
      server: {
        sessionId: SERVER_SESSION_ID,
        tracks: {
          microphone: { recordingId: SERVER_MICROPHONE_ID, uploadedBytes: 120 },
          system: { recordingId: SERVER_SYSTEM_ID, uploadedBytes: 240 },
        },
      },
    };
    queue.items[1] = { ...queue.items[1], ownerFingerprint: oldOwner };
    queue.uploadCooldowns = [{ ownerFingerprint: oldOwner, retryAt: Date.now() + 60_000 }];
    await saveQueueAtomically(queuePath, queue);
    const send = vi.fn();
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send,
    });

    try {
      const before = await store.list(oldOwner);
      const result = await store.claimRecording(firstId, before[0].revision, newOwner, {
        guard: vi.fn(async () => true),
      });
      const persisted = await loadQueue(queuePath);

      expect(result).toMatchObject({ claimed: true, item: { id: firstId } });
      expect(result.item).not.toHaveProperty("ownerFingerprint");
      expect(JSON.stringify(result)).not.toContain(directory);
      expect(persisted.items[0]).toMatchObject({
        attempts: 0,
        clientRecordingId: firstId,
        ownerFingerprint: newOwner,
        requiresHumanAction: true,
        state: QUEUE_STATES.WAITING,
      });
      expect(persisted.items[0].lastFailureReason).toMatch(/volbu odeslání/u);
      expect(persisted.items[0].server).toEqual({
        sessionId: null,
        tracks: {
          microphone: { recordingId: null, uploadedBytes: 0 },
          system: { recordingId: null, uploadedBytes: 0 },
        },
      });
      expect(persisted.items[0].manifestPath).toBe(queue.items[0].manifestPath);
      expect(persisted.items[0].tracks).toEqual(queue.items[0].tracks);
      expect(persisted.items[1]).toEqual(queue.items[1]);
      expect(persisted.uploadCooldowns).toEqual(queue.uploadCooldowns);
      expect(send).not.toHaveBeenCalled();

      const reopened = createOutboundQueueStore({
        filePath: queuePath,
        queueModulePromise: import("../src/lib/queue.js"),
        send,
      });
      await expect(reopened.list(newOwner)).resolves.toEqual(result.items);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("stale revision a zamítnutý guard nezapíšou převzetí", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-claim-stale-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const owner = `sha256:${"b".repeat(64)}`;
    const queue = oneItemQueue();
    queue.items[0] = {
      ...queue.items[0],
      ownerFingerprint: null,
      lastFailureReason: "Vlastník nahrávky není potvrzený; před odesláním je nutné potvrzení člověkem",
      requiresHumanAction: true,
    };
    await saveQueueAtomically(queuePath, queue);
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });

    try {
      const [snapshot] = await store.list();
      await expect(store.claimRecording(queue.items[0].clientRecordingId, `sha256:${"0".repeat(64)}`, owner, {
        guard: vi.fn(async () => true),
      })).rejects.toThrow(/neaktuální/u);
      await expect(store.claimRecording(queue.items[0].clientRecordingId, snapshot.revision, owner, {
        guard: vi.fn(async () => false),
      })).rejects.toThrow(/identit/u);
      expect(await loadQueue(queuePath)).toEqual(queue);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each([
    ["jednostopé", ["microphone"], "microphone"],
    ["dvoustopé", ["microphone", "system"], null],
  ])("staré %s serverové schéma načte beze lži o stopě", async (
    _label,
    trackKinds,
    assignedTrack,
  ) => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-server-migration-"));
    const queuePath = path.join(directory, "outgoing.json");
    const legacy = oneItemQueue();
    legacy.items[0].tracks = Object.fromEntries(trackKinds.map((track) => [
      track,
      `/nahravky/${track}.webm`,
    ]));
    legacy.items[0].server = {
      recordingId: "legacy-server-id",
      uploadedBytes: { microphone: 11 },
    };
    await fs.promises.writeFile(queuePath, JSON.stringify(legacy));

    try {
      const [loaded] = (await loadQueue(queuePath)).items;
      expect(loaded.server.tracks).toEqual({
        microphone: {
          recordingId: assignedTrack === "microphone" ? "legacy-server-id" : null,
          uploadedBytes: 11,
        },
        system: { recordingId: null, uploadedBytes: 0 },
      });
      if (assignedTrack === null) {
        expect(loaded.server.legacyRecordingId).toBe("legacy-server-id");
      } else {
        expect(loaded.server).not.toHaveProperty("legacyRecordingId");
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

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

describe("čisté převzetí nahrávky", () => {
  it.each([QUEUE_STATES.SENDING, QUEUE_STATES.SENT])("odmítne stav %s", (state) => {
    const queue = oneItemQueue();
    queue.items[0] = { ...queue.items[0], state };
    expect(() => claimRecording(
      queue,
      queue.items[0].clientRecordingId,
      `sha256:${"b".repeat(64)}`,
    )).toThrow(/odesíl|odeslan/u);
  });

  it.each([null, "", "sha256:kratke", `sha256:${"G".repeat(64)}`])(
    "odmítne neplatný otisk %j",
    (ownerFingerprint) => {
      expect(() => claimRecording(
        oneItemQueue(),
        recording().manifest.clientRecordingId,
        ownerFingerprint,
      )).toThrow(/otisk/u);
    },
  );

  it("odmítne převzetí pod už uloženého vlastníka", () => {
    const owner = `sha256:${"b".repeat(64)}`;
    const queue = oneItemQueue();
    queue.items[0] = { ...queue.items[0], ownerFingerprint: owner };

    expect(() => claimRecording(queue, queue.items[0].clientRecordingId, owner))
      .toThrow(/už patří/u);
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
  it("429 atomicky uloží queue i cooldown a restart ani ruční retry nepošlou request", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-cooldown-restart-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const now = 1_777_000_001_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const firstId = recording().manifest.clientRecordingId;
    const secondId = "3d4e7b61-e3d4-483c-94cc-a512454f6976";
    const stored = createQueue();
    for (const id of [firstId, secondId]) {
      const queued = enqueueRecording(stored, recording(id), now).item;
      stored.items.push({ ...queued, attempts: id === firstId ? 4 : 0, ownerFingerprint: CURRENT_OWNER });
    }
    await saveQueueAtomically(queuePath, stored);
    const send = vi.fn(async () => {
      throw Object.assign(new Error("limit"), { status: 429, retryAfterMs: 90_000 });
    });
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send,
    });

    try {
      const limited = await store.pump(killswitches(ENABLED_SETTING), CURRENT_OWNER);
      const persisted = await loadQueue(queuePath);
      expect(limited).toMatchObject({ outcome: "rate_limited", odeslanoVDavce: 0 });
      expect(send).toHaveBeenCalledOnce();
      expect(persisted.items.map((item) => item.attempts)).toEqual([4, 0]);
      expect(persisted.uploadCooldowns).toEqual([{
        ownerFingerprint: CURRENT_OWNER,
        retryAt: now + 90_000,
      }]);
      expect(limited.queue).toEqual(persisted);

      const restartedSend = vi.fn();
      const restarted = createOutboundQueueStore({
        filePath: queuePath,
        queueModulePromise: import("../src/lib/queue.js"),
        send: restartedSend,
      });
      await expect(restarted.pump(killswitches(ENABLED_SETTING), CURRENT_OWNER))
        .resolves.toMatchObject({ outcome: "rate_limited" });
      await expect(restarted.retry(killswitches(ENABLED_SETTING), CURRENT_OWNER))
        .resolves.toMatchObject({ outcome: "rate_limited" });
      expect(restartedSend).not.toHaveBeenCalled();
      expect(await loadQueue(queuePath)).toEqual(persisted);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("cooldowny zůstávají per-owner přes A→B→A a expirace se uklidí atomickou mutací", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-cooldown-owners-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const ownerA = `sha256:${"a".repeat(64)}`;
    const ownerB = `sha256:${"b".repeat(64)}`;
    let now = 1_777_000_001_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const queue = createQueue();
    const aItem = enqueueRecording(queue, recording(), now).item;
    const bItem = enqueueRecording(queue, recording("3d4e7b61-e3d4-483c-94cc-a512454f6976"), now).item;
    await saveQueueAtomically(queuePath, {
      ...queue,
      items: [
        { ...aItem, ownerFingerprint: ownerA },
        { ...bItem, ownerFingerprint: ownerB },
      ],
      uploadCooldowns: [{ ownerFingerprint: ownerA, retryAt: now + 60_000 }],
    });
    const send = vi.fn(async () => {});
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send,
    });

    try {
      await expect(store.pump(killswitches(ENABLED_SETTING), ownerA))
        .resolves.toMatchObject({ outcome: "rate_limited" });
      expect(send).not.toHaveBeenCalled();
      await expect(store.pump(killswitches(ENABLED_SETTING), ownerB))
        .resolves.toMatchObject({ odeslanoVDavce: 1 });
      expect(send).toHaveBeenCalledOnce();
      await expect(store.pump(killswitches(ENABLED_SETTING), ownerA))
        .resolves.toMatchObject({ outcome: "rate_limited" });
      expect(send).toHaveBeenCalledOnce();

      now += 60_001;
      const expiryQueuePath = path.join(directory, "expiry", "outgoing.json");
      await saveQueueAtomically(expiryQueuePath, {
        ...queue,
        items: [{ ...aItem, ownerFingerprint: ownerA }],
        uploadCooldowns: [{ ownerFingerprint: ownerA, retryAt: now - 1 }],
      });
      const expirySend = vi.fn(async () => {});
      const expiryStore = createOutboundQueueStore({
        filePath: expiryQueuePath,
        queueModulePromise: import("../src/lib/queue.js"),
        send: expirySend,
      });
      await expect(expiryStore.pump(killswitches(ENABLED_SETTING), ownerA))
        .resolves.toMatchObject({ odeslanoVDavce: 1 });
      expect(expirySend).toHaveBeenCalledOnce();
      expect((await loadQueue(expiryQueuePath)).uploadCooldowns).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("vadný cooldown se načte fail-closed a read-only list expirovaný záznam nemaže", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-cooldown-validation-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    try {
      await fs.promises.mkdir(path.dirname(queuePath), { recursive: true });
      await fs.promises.writeFile(queuePath, JSON.stringify({
        schemaVersion: 1,
        items: [],
        uploadCooldowns: [{ ownerFingerprint: "sha256:kratke", retryAt: Date.now() + 1_000 }],
      }));
      await expect(loadQueue(queuePath)).rejects.toThrow(/uploadCooldowns\.ownerFingerprint/u);
      await fs.promises.writeFile(queuePath, JSON.stringify({
        schemaVersion: 1,
        items: [],
        uploadCooldowns: [{ ownerFingerprint: [CURRENT_OWNER], retryAt: Date.now() + 1_000 }],
      }));
      await expect(loadQueue(queuePath)).rejects.toThrow(/uploadCooldowns\.ownerFingerprint/u);

      const expired = {
        schemaVersion: 1,
        items: [],
        uploadCooldowns: [{ ownerFingerprint: CURRENT_OWNER, retryAt: 1 }],
      };
      await fs.promises.writeFile(queuePath, JSON.stringify(expired));
      const store = createOutboundQueueStore({
        filePath: queuePath,
        queueModulePromise: import("../src/lib/queue.js"),
        send: vi.fn(),
      });
      await store.list(CURRENT_OWNER);
      expect(JSON.parse(await fs.promises.readFile(queuePath, "utf8"))).toEqual(expired);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("cooldown nahrávek neblokuje časovou položku s vlastním killswitchem", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-cooldown-time-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const now = Date.now();
    const time = enqueueTimeEntry(createQueue(), {
      clientTimeEntryId: "9e586e55-d688-43f1-8a80-a3d61e754f3e",
      projectId: "865a78f8-b47f-4bb8-8b34-f4ec07f6f516",
      startedAt: "2026-09-14T08:00:00.000Z",
      endedAt: "2026-09-14T08:30:00.000Z",
    }, now).queue;
    await saveQueueAtomically(queuePath, {
      ...time,
      uploadCooldowns: [{ ownerFingerprint: CURRENT_OWNER, retryAt: now + 60_000 }],
    });
    const send = vi.fn(async (item) => { void item; });
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send,
    });

    try {
      const result = await store.pump(
        killswitches(ENABLED_SETTING, ENABLED_SETTING),
        CURRENT_OWNER,
      );
      expect(result.odeslanoVDavce).toBe(1);
      expect(send).toHaveBeenCalledOnce();
      expect(send.mock.calls[0][0].kind).toBe(QUEUE_ITEM_KINDS.TIME);
      expect((await loadQueue(queuePath)).uploadCooldowns).toHaveLength(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("store ukotví cooldown na okamžik přijetí pomalé 429 odpovědi", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-cooldown-response-time-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const startedAt = 1_777_000_001_000;
    const receivedAt = startedAt + 120_000;
    let now = startedAt;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const send = vi.fn(async () => {
      now = receivedAt;
      throw Object.assign(new Error("limit"), { status: 429, retryAfterMs: 90_000 });
    });
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send,
    });

    try {
      await store.enqueueRecording(ownedRecording());
      await expect(store.pump(killswitches(ENABLED_SETTING), CURRENT_OWNER))
        .resolves.toMatchObject({ outcome: "rate_limited" });
      expect((await loadQueue(queuePath)).uploadCooldowns).toEqual([{
        ownerFingerprint: CURRENT_OWNER,
        retryAt: receivedAt + 90_000,
      }]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
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
      await store.enqueueRecording(ownedRecording());
      await store.pump(killswitches(ENABLED_SETTING), CURRENT_OWNER);
      for (let pass = 0; pass < 4; pass += 1) {
        await store.pump(killswitches(ENABLED_SETTING), CURRENT_OWNER);
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

  it("🔴 jedna pumpa pošle víc nahrávek, ale zastaví se na první systémové chybě", async () => {
    // Dvě vlastnosti naráz, protože každá z nich sama o sobě je vada:
    //
    // 1. Do 11. 9. 2026 posunula jedna pumpa JEDINOU položku a nikdo ji neopakoval, takže
    //    člověk se čtrnácti frontovanými nahrávkami potřeboval čtrnáct restartů appky.
    // 2. Smyčka ale nesmí být slepá. Kdyby pokračovala i po chybě přihlášení, zopakuje ji
    //    na KAŽDÉ položce fronty — a neúspěšné ověření tokenu má na serveru vlastní strop
    //    30/min na IP, který SDÍLÍ s `/api/mcp`. Jedna rozbitá session by tak člověku
    //    shodila i MCP. Proto se tu měří i to, že se čtvrtá položka už vůbec nezkusila.
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-drain-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const prvni = "1f0c4f2a-51b7-4e63-9d71-2c8a6d0e91b4";
    const druha = "2a7d9c31-6e84-4b12-8f05-7d3e1a4c62f8";
    const treti = "3c5b8e47-92af-4d70-a613-5e9f2b81c04d";
    const ctvrta = "4e9a1d63-b075-4c28-9e34-8a1c7f50d2b6";
    const send = vi.fn(async (item) => {
      if (item.clientRecordingId === treti) {
        throw Object.assign(new Error("Přihlášení pro upload nelze načíst"), {
          code: "session_missing",
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
      await store.enqueueRecording(ownedRecording(prvni));
      await store.enqueueRecording(ownedRecording(druha));
      await store.enqueueRecording(ownedRecording(treti));
      await store.enqueueRecording(ownedRecording(ctvrta));

      const vysledek = await store.pump(killswitches(ENABLED_SETTING), CURRENT_OWNER);

      // Jediná pumpa sáhla na tři položky — dřív by to byla jedna a zbytek by čekal na
      // další spuštění appky.
      expect(send).toHaveBeenCalledTimes(3);
      expect(send.mock.calls.map(([item]) => item.clientRecordingId))
        .toEqual([prvni, druha, treti]);
      // 🔴 Čtvrtá se nezkusila. Na tomhle stojí celá obrana proti vystřílení limitu.
      expect(vysledek.outcome).not.toBe("sent");

      const ulozena = await loadQueue(queuePath);
      expect(ulozena.items[0].state).toBe(QUEUE_STATES.SENT);
      expect(ulozena.items[1].state).toBe(QUEUE_STATES.SENT);
      expect(ulozena.items[3]).toMatchObject({ attempts: 0, state: QUEUE_STATES.WAITING });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("🔴 pumpa řekne, KOLIK odeslala, ne jen jak dopadla poslední", async () => {
    // 11. 9. 2026 znala appka jen POSLEDNÍ výsledek smyčky. Jenže po úspěšném vyprázdnění
    // je poslední výsledek „žádná položka není připravená" — pumpa přece skončí až ve chvíli,
    // kdy nic nezbývá. Přečetl jsem to jako „nic se neodeslalo", ohlásil to Danovi i serverové
    // session a požádal je, ať vypnou hlídač. Na serveru mezitím ležely tři nové nahrávky
    // včetně dvoustopého páru, na který jsme celé odpoledne čekali.
    //
    // 🔴 Koncový stav běhu NENÍ jeho výsledek. Tenhle test drží ten rozdíl.
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-pocet-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const send = vi.fn(async () => {});
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send,
    });

    try {
      await store.enqueueRecording(ownedRecording("5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"));
      await store.enqueueRecording(ownedRecording("6b2c3d4e-5f6a-4b7c-8d8e-0f1a2b3c4d5e"));
      await store.enqueueRecording(ownedRecording("7c3d4e5f-6a7b-4c8d-8e9f-1a2b3c4d5e6f"));

      const vysledek = await store.pump(killswitches(ENABLED_SETTING), CURRENT_OWNER);

      // Odeslaly se tři — a to musí být vidět, i když poslední průchod už nic nenašel.
      expect(vysledek.odeslanoVDavce).toBe(3);
      expect(send).toHaveBeenCalledTimes(3);
      // Poslední výsledek je „nic nezbylo". Právě tenhle řádek dřív svedl k opačnému závěru.
      expect(vysledek.outcome).not.toBe("sent");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("🔴 jedna pumpa nepřekročí strop, i když je fronta delší", async () => {
    // Strop drží limit serveru: zahájení má 30 za hodinu, okno je PEVNÉ (ne klouzavé),
    // počítá se i idempotentní opakování a klíčem je UŽIVATEL, ne zařízení — takže se
    // stejného stropu dotýká i web téhož člověka. Kdyby tuhle kontrolu nikdo nedržel,
    // stačilo by přepsat konstantu na tisíc a jediná pumpa by vystřílela celé okno.
    //
    // ⚠️ Tenhle test vznikl POTÉ, co sabotáž se zvednutým stropem zůstala zelená. Strop
    // byl do té chvíle číslo, které nikdo neměřil — a přitom je to jediné, co nás dělí
    // od `429` bez `Retry-After`, tedy od hodiny slepého čekání.
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-queue-strop-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const send = vi.fn(async () => {});
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send,
    });

    try {
      for (let poradi = 0; poradi < 25; poradi += 1) {
        await store.enqueueRecording(
          ownedRecording(`00000000-0000-4000-8000-${String(poradi).padStart(12, "0")}`),
        );
      }

      const vysledek = await store.pump(killswitches(ENABLED_SETTING), CURRENT_OWNER);

      // Odešlo jich právě tolik, kolik strop dovolí — ne celá fronta.
      expect(send).toHaveBeenCalledTimes(20);
      // A pumpa skončila úspěchem, ne chybou: zbytek fronty čeká na další probuzení.
      expect(vysledek.outcome).toBe("sent");
      const ulozena = await loadQueue(queuePath);
      expect(ulozena.items.filter((item) => item.state === QUEUE_STATES.SENT)).toHaveLength(20);
      expect(ulozena.items.filter((item) => item.state === QUEUE_STATES.WAITING))
        .toHaveLength(5);
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
      await store.enqueueRecording(ownedRecording());
      const first = await store.pump(killswitches(ENABLED_SETTING), CURRENT_OWNER);
      expect(first.outcome).toBe("retry_scheduled");
      expect((await loadQueue(queuePath)).items[0].nextAttemptAt).not.toBeNull();

      const retried = await store.retry(killswitches(ENABLED_SETTING), CURRENT_OWNER);

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
      await store.enqueueRecording(ownedRecording(firstId));
      expect((await store.pump(killswitches(ENABLED_SETTING), CURRENT_OWNER)).outcome).toBe("paused");
      const humanBefore = (await loadQueue(queuePath)).items[0];
      await store.enqueueRecording(ownedRecording(secondId));

      const retried = await store.retry(killswitches(ENABLED_SETTING), CURRENT_OWNER);

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
    item.manifestPath = path.join(recordingsDirectory, "recording.manifest.json");
    item.trackPaths = { microphone: microphonePath, system: systemPath };
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });

    try {
      await fs.promises.mkdir(recordingsDirectory, { recursive: true });
      await fs.promises.writeFile(item.manifestPath, JSON.stringify(item.manifest));
      await fs.promises.writeFile(microphonePath, Buffer.alloc(7));
      await fs.promises.writeFile(systemPath, Buffer.alloc(11));
      await store.enqueueRecording(item);

      const reopenedStore = createOutboundQueueStore({
        filePath: queuePath,
        queueModulePromise: import("../src/lib/queue.js"),
        send: vi.fn(),
      });
      const view = await reopenedStore.list();

      expect(view[0]).toMatchObject({
        createdAt: "2026-08-25T08:00:00.000Z",
        durationMs: 1_800_000,
        sizeBytes: 18,
      });
      expect(JSON.stringify(view)).not.toContain(directory);

      await fs.promises.unlink(systemPath);
      expect((await reopenedStore.list())[0]).toHaveProperty("sizeBytes", null);
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
      await store.enqueueRecording(ownedRecording());
      const result = await store.pump(killswitches(), CURRENT_OWNER);

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

describe("trusted detail pro serverové ověření", () => {
  it("čte čerstvý primární manifest podle row ID/revize a nevrací cesty", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-verification-target-"));
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const recordingsDirectory = path.join(directory, "nahravky");
    const manifestPath = path.join(recordingsDirectory, "meeting.manifest.json");
    const microphonePath = path.join(recordingsDirectory, "meeting-microphone.webm");
    const systemPath = path.join(recordingsDirectory, "meeting-system.webm");
    const id = "9e586e55-d688-43f1-8a80-a3d61e754f3e";
    const owner = `sha256:${"a".repeat(64)}`;
    const manifest = createManifest({
      clientRecordingId: id,
      createdAt: "2026-09-14T10:00:00.000Z",
      closedAt: "2026-09-14T10:00:01.000Z",
      tracks: {
        microphone: {
          fileName: path.basename(microphonePath),
          sha256: "b".repeat(64), sizeBytes: 12,
          startedAt: "2026-09-14T10:00:00.000Z", endedAt: "2026-09-14T10:00:01.000Z",
        },
        system: {
          fileName: path.basename(systemPath),
          sha256: "c".repeat(64), sizeBytes: 34,
          startedAt: "2026-09-14T10:00:00.000Z", endedAt: "2026-09-14T10:00:01.000Z",
        },
      },
    }, "complete");
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });
    try {
      await fs.promises.mkdir(recordingsDirectory, { recursive: true });
      await Promise.all([
        fs.promises.writeFile(manifestPath, JSON.stringify(manifest)),
        fs.promises.writeFile(microphonePath, "microphone"),
        fs.promises.writeFile(systemPath, "system"),
      ]);
      await store.enqueueRecording({
        manifest, manifestPath, ownerFingerprint: owner,
        trackPaths: { microphone: microphonePath, system: systemPath },
      });
      const persisted = await loadQueue(queuePath);
      persisted.items[0].server.tracks.microphone.recordingId = SERVER_MICROPHONE_ID;
      persisted.items[0].server.tracks.system.recordingId = SERVER_SYSTEM_ID;
      await saveQueueAtomically(queuePath, persisted);
      const snapshot = await store.listLocalRecordings(owner);
      const revision = snapshot.items[0].revision;

      const trusted = await store.getRecordingVerificationTarget(id, revision, owner);
      expect(trusted).toEqual({
        id,
        ownerFingerprint: owner,
        revision,
        tracks: {
          microphone: { recordingId: SERVER_MICROPHONE_ID, declaredBytes: 12, sha256: "b".repeat(64) },
          system: { recordingId: SERVER_SYSTEM_ID, declaredBytes: 34, sha256: "c".repeat(64) },
        },
      });
      expect(JSON.stringify(trusted)).not.toContain(directory);
      await expect(store.getRecordingVerificationTarget(id, `sha256:${"f".repeat(64)}`, owner))
        .rejects.toThrow(/neaktuální/u);
      await expect(store.getRecordingVerificationTarget(id, revision, `sha256:${"e".repeat(64)}`))
        .rejects.toThrow(/nepatří/u);

      await fs.promises.unlink(systemPath);
      await fs.promises.symlink(microphonePath, systemPath);
      await expect(store.getRecordingVerificationTarget(id, revision, owner))
        .rejects.toThrow(/bezpečný soubor/u);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("recovery sidecar zachová deklarovaná data pro mock GET při chybějícím audiu a zachovaných serverových ID", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-verification-recovery-"));
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
      await recoverOrphanedRecordings({
        logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
        manifestModulePromise: import("../src/lib/manifest.js"),
        queueStore: store,
        recordingsDirectory,
      });
      const queue = await loadQueue(queuePath);
      queue.items[0].ownerFingerprint = CURRENT_OWNER;
      queue.items[0].server.tracks.microphone.recordingId = SERVER_MICROPHONE_ID;
      queue.items[0].server.tracks.system.recordingId = SERVER_SYSTEM_ID;
      await saveQueueAtomically(queuePath, queue);
      await Promise.all(Object.values(fixture.trackPaths).map((trackPath) => fs.promises.unlink(trackPath)));
      const snapshot = await store.listLocalRecordings(CURRENT_OWNER);
      const trusted = await store.getRecordingVerificationTarget(
        fixture.manifest.clientRecordingId,
        snapshot.items[0].revision,
        CURRENT_OWNER,
      );
      const trustedTracks = /** @type {any} */ (trusted.tracks);
      const fetchImpl = vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          state: "stored",
          missing: [],
          declaredBytes: trustedTracks.microphone.declaredBytes,
          sha256: trustedTracks.microphone.sha256,
        }),
      }));
      const verifier = verification.createRecordingVerifier({
        fetchImpl,
        getContext: async () => ({
          accessToken: "token",
          generation: 1,
          issuer: "https://labs.ludone.cz",
          ownerFingerprint: CURRENT_OWNER,
          resource: "https://labs.ludone.cz/api/mcp",
          scope: "nahravky:upload",
        }),
        isContextCurrent: () => true,
        now: () => 1_000,
      });
      const result = await verifier.verify(trusted);
      expect(result.tracks.microphone.status).toBe("complete");
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(trusted)).not.toContain(directory);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("legacy recovery bez ID a bez známého hashe vrátí not_verified a nula GET", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-verification-legacy-"));
    const recordingsDirectory = path.join(directory, "nahravky");
    const queuePath = path.join(directory, "queue", "outgoing.json");
    const fixture = await writeRecoverableRecording(
      recordingsDirectory,
      undefined,
      { staleMetadata: true, state: "incomplete" },
    );
    await fs.promises.writeFile(fixture.trackPaths.system, Buffer.alloc(0));
    const store = createOutboundQueueStore({
      filePath: queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });
    try {
      await recoverOrphanedRecordings({
        logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
        manifestModulePromise: import("../src/lib/manifest.js"),
        queueStore: store,
        recordingsDirectory,
      });
      const queue = await loadQueue(queuePath);
      queue.items[0].ownerFingerprint = CURRENT_OWNER;
      await saveQueueAtomically(queuePath, queue);
      const snapshot = await store.listLocalRecordings(CURRENT_OWNER);
      const trusted = await store.getRecordingVerificationTarget(
        fixture.manifest.clientRecordingId,
        snapshot.items[0].revision,
        CURRENT_OWNER,
      );
      const trustedTracks = /** @type {any} */ (trusted.tracks);
      expect(trustedTracks.system).toMatchObject({ recordingId: null, declaredBytes: 0, sha256: null });
      const fetchImpl = vi.fn();
      const verifier = verification.createRecordingVerifier({
        fetchImpl,
        getContext: async () => ({
          accessToken: "token", generation: 1, issuer: "https://labs.ludone.cz",
          ownerFingerprint: CURRENT_OWNER, resource: "https://labs.ludone.cz/api/mcp",
          scope: "nahravky:upload",
        }),
        isContextCurrent: () => true,
        now: () => 1_000,
      });
      const result = await verifier.verify(trusted);
      expect(result.tracks).toMatchObject({
        microphone: { status: "not_verified" }, system: { status: "not_verified" },
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
