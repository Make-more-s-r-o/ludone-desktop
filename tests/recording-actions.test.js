import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import queueStore from "../electron/queue.cjs";
import meetingAudio from "../electron/meeting-audio.cjs";

const { createLivePendingDelivery, ensureMeetingAudioReady } = meetingAudio;

const OWNER = `sha256:${"a".repeat(64)}`;
const roots = new Set();

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all([...roots].map((root) => rm(root, { recursive: true, force: true })));
  roots.clear();
});

async function fixture({ sidecar = false } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "ludone-recording-actions-"));
  roots.add(root);
  const recordingsDirectory = path.join(root, "nahravky");
  await mkdir(recordingsDirectory, { recursive: true, mode: 0o700 });
  const id = "11111111-1111-4111-8111-111111111111";
  const audioName = "porada-microphone.webm";
  const audioPath = path.join(recordingsDirectory, audioName);
  const manifestPath = path.join(recordingsDirectory, "porada.manifest.json");
  const bytes = Buffer.from("bezpečný zvuk");
  const manifest = {
    schemaVersion: 1,
    clientRecordingId: id,
    createdAt: "2026-09-15T00:00:00.000Z",
    closedAt: "2026-09-15T00:01:00.000Z",
    state: "complete",
    tracks: {
      microphone: {
        fileName: audioName,
        startedAt: "2026-09-15T00:00:00.000Z",
        endedAt: "2026-09-15T00:01:00.000Z",
        sizeBytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    },
  };
  await Promise.all([
    writeFile(audioPath, bytes),
    writeFile(manifestPath, JSON.stringify(manifest)),
  ]);
  const sidecarPath = `${manifestPath}.recovered-upload-v1.json`;
  if (sidecar) await writeFile(sidecarPath, JSON.stringify(manifest));
  const queuePath = path.join(root, "queue", "outgoing.json");
  const store = queueStore.createOutboundQueueStore({
    filePath: queuePath,
    queueModulePromise: import("../src/lib/queue.js"),
    send: vi.fn(),
  });
  await store.enqueueRecording({
    manifest,
    manifestPath,
    ownerFingerprint: OWNER,
    trackPaths: { microphone: audioPath },
  });
  const snapshot = await store.listLocalRecordings();
  const row = snapshot.items.find((item) => item.id === id);
  return { audioPath, id, manifest, manifestPath, queuePath, row, sidecarPath, store };
}

describe("bezpečné lokální akce nahrávky", () => {
  it("po pádu před navázáním stereo masteru koš zachová všechny soubory i queue řádek", async () => {
    const value = await fixture();
    const masterPath = path.join(path.dirname(value.audioPath), "porada-stereo-master.webm");
    await writeFile(masterPath, "osiřelý-stereo-master");
    const trashItem = vi.fn();
    await expect(value.store.deleteRecording({
      clientRecordingId: value.id,
      expectedRevision: value.row.revision,
      expectedFileRevision: value.row.fileRevision,
      guard: async () => true,
      trashItem,
    })).rejects.toThrow(/není navázaný na frontu/u);
    expect(trashItem).not.toHaveBeenCalled();
    expect(await readFile(masterPath, "utf8")).toBe("osiřelý-stereo-master");
    expect(await readFile(value.audioPath, "utf8")).toBe("bezpečný zvuk");
    expect((await queueStore.loadQueue(value.queuePath)).items).toHaveLength(1);
  });

  it("před zařazením do fronty souborový řádek s osiřelým masterem také nesmaže", async () => {
    const value = await fixture();
    const masterPath = path.join(path.dirname(value.audioPath), "porada-stereo-master.webm");
    await writeFile(masterPath, "osiřelý-stereo-master");
    const fileOnlyStore = queueStore.createOutboundQueueStore({
      filePath: path.join(path.dirname(value.queuePath), "jina-fronta.json"),
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });
    const row = (await fileOnlyStore.listLocalRecordings()).items.find((item) => item.id === value.id);
    expect(row.source).toBe("orphan");
    const trashItem = vi.fn();
    await expect(fileOnlyStore.deleteRecording({
      clientRecordingId: value.id,
      expectedRevision: row.revision,
      expectedFileRevision: row.fileRevision,
      guard: async () => true,
      trashItem,
    })).rejects.toThrow(/není navázaný na frontu/u);
    expect(trashItem).not.toHaveBeenCalled();
    expect(await readFile(masterPath, "utf8")).toBe("osiřelý-stereo-master");
  });

  it("smaže jeden připravený WebM, trvalý master, sidecar a originál pod stejnou revizí", async () => {
    const value = await fixture();
    const recordingsDirectory = path.dirname(value.audioPath);
    const masterPath = path.join(recordingsDirectory, "porada-stereo-master.webm");
    await writeFile(masterPath, "stereo-master");
    const pending = await createLivePendingDelivery({
      captureSources: "microphone", clientRecordingId: value.id,
      startedAt: value.manifest.tracks.microphone.startedAt,
      endedAt: value.manifest.tracks.microphone.endedAt,
      manifestPath: value.manifestPath, masterPath, recordingsDirectory,
    });
    await value.store.setRecordingDelivery(value.id, pending);
    const deliveryBytes = Buffer.from("stereo-webm-opus");
    const ready = await ensureMeetingAudioReady({
      attempts: 0, clientRecordingId: value.id, delivery: pending,
      manifestPath: value.manifestPath, server: {}, state: "ceka",
      tracks: { microphone: value.audioPath },
    }, {
      prepareStereoWebm: async ({ outputPath }) => {
        await writeFile(outputPath, deliveryBytes);
        return { outputPath, size: deliveryBytes.length,
          mime: "audio/webm", channels: 2, encoderVersion: "test-delete" };
      },
      recordingsDirectory,
    });
    await value.store.setRecordingDelivery(value.id, ready);
    const row = (await value.store.listLocalRecordings()).items.find((item) => item.id === value.id);
    const trashed = [];
    await value.store.deleteRecording({
      clientRecordingId: value.id,
      expectedRevision: row.revision,
      expectedFileRevision: row.fileRevision,
      guard: async () => true,
      trashItem: async (file) => { trashed.push(file); },
    });
    const root = await realpath(recordingsDirectory);
    expect(trashed).toEqual([
      path.join(root, path.basename(value.audioPath)),
      masterPath,
      ready.filePath,
      ready.sidecarPath,
      path.join(root, path.basename(value.manifestPath)),
    ]);
    expect((await queueStore.loadQueue(value.queuePath)).items).toHaveLength(0);
  });

  it("ruční koš s pending sidecarem a již publikovaným WebM nesáhne na žádný soubor", async () => {
    const value = await fixture();
    const recordingsDirectory = path.dirname(value.audioPath);
    const masterPath = path.join(recordingsDirectory, "porada-stereo-master.webm");
    await writeFile(masterPath, "stereo-master");
    const pending = await createLivePendingDelivery({
      captureSources: "microphone", clientRecordingId: value.id,
      startedAt: value.manifest.tracks.microphone.startedAt,
      endedAt: value.manifest.tracks.microphone.endedAt,
      manifestPath: value.manifestPath, masterPath, recordingsDirectory,
    });
    await value.store.setRecordingDelivery(value.id, pending);
    await writeFile(pending.filePath, "publikovany-webm");
    const row = (await value.store.listLocalRecordings()).items.find((item) => item.id === value.id);
    const trashItem = vi.fn();
    await expect(value.store.deleteRecording({
      clientRecordingId: value.id,
      expectedRevision: row.revision,
      expectedFileRevision: row.fileRevision,
      guard: async () => true,
      trashItem,
    })).rejects.toThrow(/bez připravené identity/u);
    expect(trashItem).not.toHaveBeenCalled();
    expect(await readFile(pending.filePath, "utf8")).toBe("publikovany-webm");
    expect(await readFile(masterPath, "utf8")).toBe("stereo-master");
    expect((await queueStore.loadQueue(value.queuePath)).items).toHaveLength(1);
  });
  it("přesune audio, známý sidecar a manifest poslední a teprve pak odstraní queue řádek", async () => {
    const value = await fixture({ sidecar: true });
    const canonicalRoot = await realpath(path.dirname(value.audioPath));
    const trashed = [];

    const result = await value.store.deleteRecording({
      clientRecordingId: value.id,
      expectedRevision: value.row.revision,
      expectedFileRevision: value.row.fileRevision,
      guard: async () => true,
      trashItem: async (file) => { trashed.push(file); },
    });

    expect(result).toEqual({ outcome: "deleted" });
    expect(trashed).toEqual([
      path.join(canonicalRoot, path.basename(value.audioPath)),
      path.join(canonicalRoot, path.basename(value.sidecarPath)),
      path.join(canonicalRoot, path.basename(value.manifestPath)),
    ]);
    expect((await queueStore.loadQueue(value.queuePath)).items).toHaveLength(0);
  });

  it("změněný manifest po snapshotu odmítne před prvním košem", async () => {
    const value = await fixture();
    const trashItem = vi.fn();
    await writeFile(value.manifestPath, JSON.stringify({ ...value.manifest, closedAt: null }));

    await expect(value.store.deleteRecording({
      clientRecordingId: value.id,
      expectedRevision: value.row.revision,
      expectedFileRevision: value.row.fileRevision,
      guard: async () => true,
      trashItem,
    })).rejects.toThrow(/neaktuální|změnily/u);
    expect(trashItem).not.toHaveBeenCalled();
  });

  it("sidecar se stejným UUID a názvem stopy, ale jiným obsahem odmítne", async () => {
    const value = await fixture({ sidecar: true });
    await writeFile(value.sidecarPath, JSON.stringify({
      ...value.manifest,
      closedAt: "2026-09-15T00:02:00.000Z",
    }));
    const fresh = await value.store.listLocalRecordings();
    const row = fresh.items.find((item) => item.id === value.id);
    const trashItem = vi.fn();
    await expect(value.store.deleteRecording({
      clientRecordingId: value.id,
      expectedRevision: row.revision,
      expectedFileRevision: row.fileRevision,
      guard: async () => true,
      trashItem,
    })).rejects.toThrow(/sidecar/u);
    expect(trashItem).not.toHaveBeenCalled();
  });

  it("incomplete primary s platným complete sidecarem smaže zbytky i bez audia a hashování", async () => {
    const value = await fixture();
    const incomplete = {
      ...value.manifest,
      closedAt: null,
      state: "incomplete",
      tracks: { microphone: {
        ...value.manifest.tracks.microphone,
        endedAt: null,
        sha256: null,
        sizeBytes: 0,
      } },
    };
    await Promise.all([
      writeFile(value.manifestPath, JSON.stringify(incomplete)),
      writeFile(value.sidecarPath, JSON.stringify(value.manifest)),
      rm(value.audioPath),
    ]);
    const row = (await value.store.listLocalRecordings()).items.find((item) => item.id === value.id);
    const trashed = [];

    await expect(value.store.deleteRecording({
      clientRecordingId: value.id,
      expectedRevision: row.revision,
      expectedFileRevision: row.fileRevision,
      guard: async () => true,
      trashItem: async (file) => { trashed.push(file); },
    })).resolves.toEqual({ outcome: "deleted" });
    const canonicalRoot = await realpath(path.dirname(value.manifestPath));
    expect(trashed).toEqual([
      path.join(canonicalRoot, path.basename(value.sidecarPath)),
      path.join(canonicalRoot, path.basename(value.manifestPath)),
    ]);
  });

  it("dva orphan manifesty se stejným UUID odmítne jako nejednoznačný cíl", async () => {
    const value = await fixture();
    const secondAudioName = "druha-microphone.webm";
    const secondAudioPath = path.join(path.dirname(value.audioPath), secondAudioName);
    const secondBytes = Buffer.from("druhý bezpečný zvuk");
    const secondManifest = {
      ...value.manifest,
      tracks: { microphone: {
        ...value.manifest.tracks.microphone,
        fileName: secondAudioName,
        sizeBytes: secondBytes.length,
        sha256: createHash("sha256").update(secondBytes).digest("hex"),
      } },
    };
    await Promise.all([
      writeFile(secondAudioPath, secondBytes),
      writeFile(path.join(path.dirname(value.manifestPath), "a.manifest.json"), JSON.stringify(secondManifest)),
      writeFile(value.queuePath, JSON.stringify({ schemaVersion: 1, items: [] })),
    ]);
    const restarted = queueStore.createOutboundQueueStore({
      filePath: value.queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });
    const row = (await restarted.listLocalRecordings()).items.find((item) => item.id === value.id);
    const trashItem = vi.fn();

    await expect(restarted.deleteRecording({
      clientRecordingId: value.id,
      expectedRevision: row.revision,
      expectedFileRevision: row.fileRevision,
      guard: async () => true,
      trashItem,
    })).rejects.toThrow(/jednoznačný/u);
    expect(trashItem).not.toHaveBeenCalled();
  });

  it("nesmaže audio, na které odkazuje jiný bezpečný primární manifest", async () => {
    const value = await fixture();
    const secondManifest = {
      ...value.manifest,
      clientRecordingId: "22222222-2222-4222-8222-222222222222",
    };
    await writeFile(
      path.join(path.dirname(value.manifestPath), "druha.manifest.json"),
      JSON.stringify(secondManifest),
    );
    const trashItem = vi.fn();

    await expect(value.store.deleteRecording({
      clientRecordingId: value.id,
      expectedRevision: value.row.revision,
      expectedFileRevision: value.row.fileRevision,
      guard: async () => true,
      trashItem,
    })).rejects.toThrow(/jiný primární manifest/u);
    expect(trashItem).not.toHaveBeenCalled();
    await expect(readFile(value.audioPath)).resolves.toEqual(Buffer.from("bezpečný zvuk"));
  });

  it("nesmaže audio sdílené jinou queue položkou s chybějícím manifestem", async () => {
    const value = await fixture();
    const queue = await queueStore.loadQueue(value.queuePath);
    queue.items.push({
      ...structuredClone(queue.items[0]),
      clientRecordingId: "33333333-3333-4333-8333-333333333333",
      manifestPath: path.join(path.dirname(value.manifestPath), "chybi.manifest.json"),
    });
    await writeFile(value.queuePath, JSON.stringify(queue));
    const trashItem = vi.fn();

    await expect(value.store.deleteRecording({
      clientRecordingId: value.id,
      expectedRevision: value.row.revision,
      expectedFileRevision: value.row.fileRevision,
      guard: async () => true,
      trashItem,
    })).rejects.toThrow(/queue položka/u);
    expect(trashItem).not.toHaveBeenCalled();
  });

  it("změna guardu během preflightu zastaví první koš a zachová queue řádek", async () => {
    const value = await fixture();
    const trashItem = vi.fn();
    const guard = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);

    await expect(value.store.deleteRecording({
      clientRecordingId: value.id,
      expectedRevision: value.row.revision,
      expectedFileRevision: value.row.fileRevision,
      guard,
      trashItem,
    })).resolves.toEqual({ outcome: "partial_failure" });
    expect(trashItem).not.toHaveBeenCalled();
    expect((await queueStore.loadQueue(value.queuePath)).items).toHaveLength(1);
  });

  it("částečná chyba koše ponechá queue položku i primární manifest", async () => {
    const value = await fixture({ sidecar: true });
    const trashItem = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("simulovaná chyba koše"));

    await expect(value.store.deleteRecording({
      clientRecordingId: value.id,
      expectedRevision: value.row.revision,
      expectedFileRevision: value.row.fileRevision,
      guard: async () => true,
      trashItem,
    })).resolves.toEqual({ outcome: "partial_failure" });
    expect((await queueStore.loadQueue(value.queuePath)).items).toHaveLength(1);
    await expect(readFile(value.manifestPath, "utf8")).resolves.toContain(value.id);
  });

  it("reveal vrátí jen čerstvou přímou audio stopu a stale revize nic neukáže", async () => {
    const value = await fixture();
    const canonicalAudioPath = path.join(
      await realpath(path.dirname(value.audioPath)),
      path.basename(value.audioPath),
    );
    await expect(value.store.revealRecording({
      clientRecordingId: value.id,
      expectedRevision: value.row.revision,
      expectedFileRevision: value.row.fileRevision,
      guard: async () => true,
    })).resolves.toEqual({ outcome: "shown", filePath: canonicalAudioPath });

    await writeFile(value.audioPath, Buffer.from("změněný zvuk"));
    await expect(value.store.revealRecording({
      clientRecordingId: value.id,
      expectedRevision: value.row.revision,
      expectedFileRevision: value.row.fileRevision,
      guard: async () => true,
    })).rejects.toThrow(/neaktuální|změnily/u);
  });
});

describe("durable souhlas nahrávky", () => {
  it.each([undefined, "neplatny"])(
    "read-only přehled legacy intent %s nezapíše, první transport jej atomicky drží",
    async (legacyIntent) => {
      const value = await fixture();
      const persisted = await queueStore.loadQueue(value.queuePath);
      const legacy = structuredClone(persisted);
      if (legacyIntent === undefined) delete legacy.items[0].uploadIntent;
      else legacy.items[0].uploadIntent = legacyIntent;
      await writeFile(value.queuePath, JSON.stringify(legacy));
      const send = vi.fn();
      const restarted = queueStore.createOutboundQueueStore({
        filePath: value.queuePath,
        queueModulePromise: import("../src/lib/queue.js"),
        send,
      });

      await restarted.listLocalRecordings(OWNER);
      const afterRead = JSON.parse(await readFile(value.queuePath, "utf8"));
      if (legacyIntent === undefined) expect(afterRead.items[0]).not.toHaveProperty("uploadIntent");
      else expect(afterRead.items[0].uploadIntent).toBe(legacyIntent);

      await restarted.pump({ DESKTOP_UPLOAD_ENABLED: "true" }, OWNER);
      expect(send).not.toHaveBeenCalled();
      expect((await queueStore.loadQueue(value.queuePath)).items[0].uploadIntent).toBe("held");
    },
  );

  it("deduplikace neschválí held a auth loss uloží title stále jako held", async () => {
    const value = await fixture();
    const duplicate = await value.store.enqueueRecording({
      manifest: value.manifest,
      manifestPath: value.manifestPath,
      ownerFingerprint: OWNER,
      trackPaths: { microphone: value.audioPath },
    });
    expect(duplicate.added).toBe(false);
    expect((await queueStore.loadQueue(value.queuePath)).items[0].uploadIntent).toBe("held");

    const decided = await value.store.decideRecording(
      value.id,
      OWNER,
      "Porada výroby",
      true,
      { guard: async () => false },
    );
    expect(decided).toMatchObject({ approved: false, item: {
      title: "Porada výroby", uploadIntent: "held",
    } });
  });

  it("fresh guard schválí právě jednu položku a title přežije restart storu", async () => {
    const value = await fixture();
    await value.store.decideRecording(
      value.id,
      OWNER,
      "Porada výroby",
      true,
      { guard: async () => true },
    );
    const restarted = queueStore.createOutboundQueueStore({
      filePath: value.queuePath,
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    });
    const [item] = await restarted.list(OWNER);
    expect(item).toMatchObject({ title: "Porada výroby", uploadIntent: "approved" });
  });
});
