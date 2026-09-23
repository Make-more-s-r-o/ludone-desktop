import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import { applyServerProgress, claimRecording, enqueueRecording, processNext, retryFailedItem } from "../src/lib/queue.js";

const require = createRequire(import.meta.url);
const {
  createLivePendingDelivery,
  ensureMeetingAudioReady,
  hasLegacyUploadEvidence,
  verifyMeetingAudioForDeletion,
} = require("../electron/meeting-audio.cjs");

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ludone-meeting-audio-"));
  const id = randomUUID();
  const manifestPath = path.join(directory, `${id}.manifest.json`);
  const microphonePath = path.join(directory, `${id}-mikrofon.webm`);
  const systemPath = path.join(directory, `${id}-system.webm`);
  const masterPath = path.join(directory, `${id}-stereo-master.webm`);
  const startedAt = "2026-09-15T08:00:00.000Z";
  const endedAt = "2026-09-15T09:00:00.000Z";
  await Promise.all([
    writeFile(microphonePath, "mic"),
    writeFile(systemPath, "system"),
    writeFile(masterPath, "stereo"),
    writeFile(manifestPath, JSON.stringify({
      schemaVersion: 1,
      clientRecordingId: id,
      createdAt: startedAt,
      closedAt: endedAt,
      state: "complete",
      tracks: {
        microphone: { fileName: path.basename(microphonePath), startedAt, endedAt, sizeBytes: 3,
          sha256: createHash("sha256").update("mic").digest("hex") },
        system: { fileName: path.basename(systemPath), startedAt, endedAt, sizeBytes: 6,
          sha256: createHash("sha256").update("system").digest("hex") },
      },
    })),
  ]);
  return { directory, endedAt, id, manifestPath, masterPath, microphonePath, startedAt, systemPath };
}

describe("jediný delivery asset schůzky", () => {
  it("koš odmítne pending sidecar, pokud encoder již publikoval kanonický WebM", async () => {
    const data = await fixture();
    const pending = await createLivePendingDelivery({
      captureSources: "microphone+system", clientRecordingId: data.id,
      endedAt: data.endedAt, manifestPath: data.manifestPath,
      masterPath: data.masterPath, recordingsDirectory: data.directory,
      startedAt: data.startedAt,
    });
    const item = { attempts: 0, clientRecordingId: data.id, delivery: pending,
      manifestPath: data.manifestPath, server: {}, state: "ceka",
      tracks: { microphone: data.microphonePath, system: data.systemPath } };
    await expect(verifyMeetingAudioForDeletion(item, data.directory))
      .resolves.toEqual([pending.masterPath, pending.sidecarPath]);
    await writeFile(pending.filePath, "publikovany-webm");
    await expect(verifyMeetingAudioForDeletion(item, data.directory))
      .rejects.toMatchObject({ code: "delivery_unbound_output_unsafe" });
    expect(await readFile(pending.filePath, "utf8")).toBe("publikovany-webm");
  });

  it("živý stereo master převede jednou, uloží neměnný hash a po restartu jej nepřekóduje", async () => {
    const data = await fixture();
    const pending = await createLivePendingDelivery({
      captureSources: "microphone+system",
      clientRecordingId: data.id,
      endedAt: data.endedAt,
      manifestPath: data.manifestPath,
      masterPath: data.masterPath,
      recordingsDirectory: data.directory,
      startedAt: data.startedAt,
    });
    const bytes = Buffer.from("ID3\x04\x00\x00\x00\x00\x00\x00\xff\xfbwebm");
    const convert = vi.fn(async ({ outputPath }) => {
      await writeFile(outputPath, bytes);
      return {
        outputPath,
        size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        mime: "audio/webm",
        channels: 2,
        channelMap: { left: "microphone", right: "system" },
        source: "live-stereo",
        encoderVersion: "test-1",
      };
    });
    const item = {
      attempts: 0,
      clientRecordingId: data.id,
      delivery: pending,
      manifestPath: data.manifestPath,
      server: {},
      state: "ceka",
      tracks: { microphone: data.microphonePath, system: data.systemPath },
    };

    const ready = await ensureMeetingAudioReady(item, {
      prepareStereoWebm: convert,
      recordingsDirectory: data.directory,
    });
    const afterRestart = await ensureMeetingAudioReady({ ...item, delivery: ready }, {
      prepareStereoWebm: convert,
      recordingsDirectory: data.directory,
    });

    expect(convert).toHaveBeenCalledTimes(1);
    expect(afterRestart).toEqual(ready);
    expect(ready).toMatchObject({
      state: "ready",
      mime: "audio/webm",
      channels: 2,
      channelMap: { left: "microphone", right: "system" },
      captureSources: "microphone+system",
      timing: { durationMs: 3_600_000, microphoneDelayMs: 0, systemDelayMs: 0 },
    });
    expect(JSON.parse(await readFile(ready.sidecarPath, "utf8"))).toMatchObject({
      state: "ready",
      filePath: path.basename(ready.filePath),
      masterPath: path.basename(data.masterPath),
    });
  });

  it("po možném INITu chybějící asset nikdy znovu nevyrábí", async () => {
    const data = await fixture();
    const pending = await createLivePendingDelivery({
      captureSources: "microphone+system",
      clientRecordingId: data.id,
      endedAt: data.endedAt,
      manifestPath: data.manifestPath,
      masterPath: data.masterPath,
      recordingsDirectory: data.directory,
      startedAt: data.startedAt,
    });
    const convert = vi.fn();
    await expect(ensureMeetingAudioReady({
      attempts: 0,
      clientRecordingId: data.id,
      delivery: pending,
      manifestPath: data.manifestPath,
      server: { companyTabidooId: randomUUID() },
      state: "ceka",
      tracks: { microphone: data.microphonePath, system: data.systemPath },
    }, { prepareStereoWebm: convert, recordingsDirectory: data.directory }))
      .rejects.toMatchObject({ code: "delivery_asset_missing_after_init" });
    expect(convert).not.toHaveBeenCalled();
  });

  it("ready queue identitu nelze přepsat jiným ready sidecarem", async () => {
    const data = await fixture();
    const pending = await createLivePendingDelivery({
      captureSources: "microphone+system", clientRecordingId: data.id,
      endedAt: data.endedAt, manifestPath: data.manifestPath, masterPath: data.masterPath,
      recordingsDirectory: data.directory, startedAt: data.startedAt,
    });
    const bytes = Buffer.from("ID3\x04\x00\x00\x00\x00\x00\x00\xff\xfbwebm");
    const convert = async ({ outputPath }) => {
      await writeFile(outputPath, bytes);
      return { outputPath, size: bytes.length, mime: "audio/webm", channels: 2,
        encoderVersion: "test-1" };
    };
    const item = { attempts: 0, clientRecordingId: data.id, delivery: pending,
      manifestPath: data.manifestPath, server: {}, state: "ceka",
      tracks: { microphone: data.microphonePath, system: data.systemPath } };
    const ready = await ensureMeetingAudioReady(item, {
      prepareStereoWebm: convert, recordingsDirectory: data.directory,
    });
    const sidecar = JSON.parse(await readFile(ready.sidecarPath, "utf8"));
    sidecar.sha256 = "f".repeat(64);
    await writeFile(ready.sidecarPath, JSON.stringify(sidecar));
    await expect(ensureMeetingAudioReady({ ...item, delivery: ready }, {
      prepareStereoWebm: vi.fn(), recordingsDirectory: data.directory,
    })).rejects.toMatchObject({ code: "delivery_identity_mismatch" });
  });

  it("připravené bajty nelze ve frontě změnit a ztracený ready sidecar nezakládá novou identitu", async () => {
    const data = await fixture();
    const pending = await createLivePendingDelivery({
      captureSources: "microphone+system", clientRecordingId: data.id,
      endedAt: data.endedAt, manifestPath: data.manifestPath, masterPath: data.masterPath,
      recordingsDirectory: data.directory, startedAt: data.startedAt,
    });
    const bytes = Buffer.from("stereo-webm");
    const item = { attempts: 0, clientRecordingId: data.id, delivery: pending,
      manifestPath: data.manifestPath, server: {}, state: "ceka",
      tracks: { microphone: data.microphonePath, system: data.systemPath } };
    const ready = await ensureMeetingAudioReady(item, {
      prepareStereoWebm: async ({ outputPath }) => {
        await writeFile(outputPath, bytes);
        return { outputPath, size: bytes.length, mime: "audio/webm", channels: 2,
          encoderVersion: "test-immutable" };
      }, recordingsDirectory: data.directory,
    });
    const queue = { schemaVersion: 1, items: [{ ...item, delivery: ready }] };
    expect(() => applyServerProgress(queue, data.id, { delivery: {
      ...ready, sha256: "f".repeat(64),
    } })).toThrow(/neměnné bajty/u);
    await unlink(ready.sidecarPath);
    await expect(ensureMeetingAudioReady({ ...item, delivery: ready }, {
      prepareStereoWebm: vi.fn(), recordingsDirectory: data.directory,
    })).rejects.toMatchObject({ code: "delivery_identity_mismatch" });
  });

  it("lokální selhání převodu uloží pending před encoderem a po restartu se bezpečně opakuje", async () => {
    const data = await fixture();
    const item = { attempts: 0, clientRecordingId: data.id,
      manifestPath: data.manifestPath, server: {}, state: "ceka",
      tracks: { microphone: data.microphonePath, system: data.systemPath } };
    let savedPending;
    const firstConverter = vi.fn(async () => { throw new Error("encoder není dostupný"); });
    await expect(ensureMeetingAudioReady(item, {
      onDescriptorPrepared: async (descriptor) => { savedPending = descriptor; },
      prepareStereoWebm: firstConverter,
      recordingsDirectory: data.directory,
    })).rejects.toThrow("encoder není dostupný");
    expect(savedPending).toMatchObject({ state: "pending", mime: "audio/webm" });
    const bytes = Buffer.from("opakovany-opus");
    const ready = await ensureMeetingAudioReady({ ...item, attempts: 1, delivery: savedPending }, {
      prepareStereoWebm: async ({ outputPath }) => {
        await writeFile(outputPath, bytes);
        return { outputPath, size: bytes.length, mime: "audio/webm", channels: 2,
          encoderVersion: "test-retry" };
      },
      recordingsDirectory: data.directory,
    });
    expect(ready.state).toBe("ready");
    expect(await readFile(ready.filePath)).toEqual(bytes);
  });

  it("po pádu mezi publikací WebM a sidecarem před HTTP překóduje z pevných zdrojů", async () => {
    const data = await fixture();
    const pending = await createLivePendingDelivery({
      captureSources: "microphone+system", clientRecordingId: data.id,
      endedAt: data.endedAt, manifestPath: data.manifestPath, masterPath: data.masterPath,
      recordingsDirectory: data.directory, startedAt: data.startedAt,
    });
    await writeFile(pending.filePath, "nepřiřazené-bajty");
    const replacement = Buffer.from("ID3\x04\x00\x00\x00\x00\x00\x00\xff\xfbnew");
    const convert = vi.fn(async ({ outputPath }) => {
      await writeFile(outputPath, replacement);
      return { outputPath, size: replacement.length, mime: "audio/webm", channels: 2,
        encoderVersion: "test-recovery" };
    });
    const ready = await ensureMeetingAudioReady({
      attempts: 1, clientRecordingId: data.id, delivery: pending,
      manifestPath: data.manifestPath, server: {}, state: "ceka",
      tracks: { microphone: data.microphonePath, system: data.systemPath },
    }, { prepareStereoWebm: convert, recordingsDirectory: data.directory });
    expect(convert).toHaveBeenCalledOnce();
    expect(await readFile(ready.filePath)).toEqual(replacement);
  });

  it("po restartu obnoví pending live sidecar, který před commitem osiřel", async () => {
    const data = await fixture();
    await createLivePendingDelivery({
      captureSources: "microphone+system", clientRecordingId: data.id,
      endedAt: data.endedAt, manifestPath: data.manifestPath, masterPath: data.masterPath,
      recordingsDirectory: data.directory, startedAt: data.startedAt,
    });
    const bytes = Buffer.from("obnovené-webm");
    const ready = await ensureMeetingAudioReady({
      attempts: 0, clientRecordingId: data.id, manifestPath: data.manifestPath,
      server: {}, state: "ceka",
      tracks: { microphone: data.microphonePath, system: data.systemPath },
    }, {
      prepareStereoWebm: async ({ outputPath }) => {
        await writeFile(outputPath, bytes);
        return { outputPath, size: bytes.length, mime: "audio/webm", channels: 2,
          encoderVersion: "test-orphan" };
      },
      recordingsDirectory: data.directory,
    });
    expect(ready).toMatchObject({ state: "ready", source: "live-stereo",
      masterPath: data.masterPath });
  });

  it("první processNext předá pristine legacy snapshot a uloží jedno delivery před HTTP", async () => {
    const data = await fixture();
    const manifest = JSON.parse(await readFile(data.manifestPath, "utf8"));
    const enqueued = enqueueRecording({ schemaVersion: 1, items: [] }, {
      manifest, manifestPath: data.manifestPath,
      trackPaths: { microphone: data.microphonePath, system: data.systemPath },
    });
    const queue = { ...enqueued.queue, items: [{ ...enqueued.item, uploadIntent: "approved" }] };
    const bytes = Buffer.from("legacy-webm");
    const result = await processNext(queue, { DESKTOP_UPLOAD_ENABLED: "true" },
      async (_sending, report, preparation) => {
        const delivery = await ensureMeetingAudioReady(preparation.preAttemptItem, {
          prepareStereoWebm: async ({ outputPath }) => {
            await writeFile(outputPath, bytes);
            return { outputPath, size: bytes.length, mime: "audio/webm", channels: 2,
              encoderVersion: "test-legacy" };
          },
          recordingsDirectory: data.directory,
        });
        await report({ delivery });
        return { uploads: [{ track: "delivery", recordingId: randomUUID(), uploadedBytes: bytes.length }] };
      }, { now: Date.parse("2026-09-15T10:00:00.000Z") });
    expect(result).toMatchObject({ outcome: "sent", item: {
      delivery: { state: "ready", source: "separate-tracks" },
      server: { delivery: { uploadedBytes: bytes.length } },
    } });
  });

  it("čerstvě převzatá legacy nahrávka se může převést, zahájený starý upload zůstane blokovaný", async () => {
    const data = await fixture();
    const manifest = JSON.parse(await readFile(data.manifestPath, "utf8"));
    const enqueued = enqueueRecording({ schemaVersion: 1, items: [] }, {
      manifest, manifestPath: data.manifestPath,
      trackPaths: { microphone: data.microphonePath, system: data.systemPath },
    });
    const owner = `sha256:${"a".repeat(64)}`;
    const fresh = claimRecording(enqueued.queue, data.id, owner).item;
    expect(fresh.legacyDeliveryBarrier).not.toBe(true);
    const prepared = vi.fn();
    await ensureMeetingAudioReady(fresh, {
      onDescriptorPrepared: prepared,
      prepareStereoWebm: async ({ outputPath }) => {
        const bytes = Buffer.from("claimed-opus");
        await writeFile(outputPath, bytes);
        return { outputPath, size: bytes.length, mime: "audio/webm", channels: 2,
          encoderVersion: "test-claim" };
      },
      recordingsDirectory: data.directory,
    });
    expect(prepared).toHaveBeenCalledOnce();

    const started = { ...enqueued.queue, items: [{ ...enqueued.item,
      server: { ...enqueued.item.server, tracks: {
        ...enqueued.item.server.tracks,
        microphone: { recordingId: randomUUID(), uploadedBytes: 1 },
      } },
    }] };
    const claimedStarted = claimRecording(started, data.id, owner).item;
    expect(claimedStarted.legacyDeliveryBarrier).toBe(true);
    await expect(ensureMeetingAudioReady(claimedStarted, {
      prepareStereoWebm: vi.fn(), recordingsDirectory: data.directory,
    })).rejects.toMatchObject({ code: "legacy_upload_may_have_started" });
  });

  it("selhání encoderu v durable frontě po restartu a ručním retry připraví stejné pending delivery", async () => {
    const data = await fixture();
    const manifest = JSON.parse(await readFile(data.manifestPath, "utf8"));
    const enqueued = enqueueRecording({ schemaVersion: 1, items: [] }, {
      manifest, manifestPath: data.manifestPath,
      trackPaths: { microphone: data.microphonePath, system: data.systemPath },
    });
    const queue = { ...enqueued.queue, items: [{ ...enqueued.item, uploadIntent: "approved" }] };
    let diskQueue;
    const send = async (_sending, report, preparation) => {
      const ready = await ensureMeetingAudioReady(preparation.preAttemptItem, {
        onDescriptorPrepared: (descriptor) => report({ delivery: descriptor }),
        prepareStereoWebm: async ({ outputPath }) => {
          if (!diskQueue?.items[0]?.delivery) throw new Error("pending není trvalé");
          if (diskQueue.items[0].state !== "selhalo") throw new Error("encoder není dostupný");
          const bytes = Buffer.from("retry-opus");
          await writeFile(outputPath, bytes);
          return { outputPath, size: bytes.length, mime: "audio/webm", channels: 2,
            encoderVersion: "test-retry" };
        },
        recordingsDirectory: data.directory,
      });
      await report({ delivery: ready });
      return { uploads: [{ track: "delivery", recordingId: randomUUID(), uploadedBytes: ready.sizeBytes }] };
    };
    const options = { now: Date.parse("2026-09-15T10:00:00.000Z"),
      retryPolicy: { maxAttempts: 1 },
      persistProgress: async (progress) => { diskQueue = structuredClone(progress); } };
    const first = await processNext(queue, { DESKTOP_UPLOAD_ENABLED: "true" }, send, options);
    expect(first).toMatchObject({ outcome: "failed", item: { delivery: { state: "pending" } } });
    diskQueue = structuredClone(first.queue);
    const resumed = retryFailedItem(diskQueue, data.id);
    const second = await processNext(resumed.queue, { DESKTOP_UPLOAD_ENABLED: "true" }, send, options);
    expect(second).toMatchObject({ outcome: "sent", item: {
      delivery: { state: "ready", mime: "audio/webm" },
      server: { delivery: { uploadedBytes: 10 } },
    } });
  });

  it("legacy bariéra přežívá smazání per-track ID při převzetí", () => {
    expect(hasLegacyUploadEvidence({
      attempts: 0,
      legacyDeliveryBarrier: true,
      server: { tracks: {} },
      state: "ceka",
    })).toBe(true);
  });

  it("recovered incomplete blokuje podle primárního manifestu, ne podle complete sidecaru", async () => {
    const data = await fixture();
    const primary = JSON.parse(await readFile(data.manifestPath, "utf8"));
    primary.state = "incomplete";
    primary.closedAt = null;
    await writeFile(data.manifestPath, JSON.stringify(primary));
    const recoveredPath = `${data.manifestPath}.recovered-upload-v1.json`;
    await writeFile(recoveredPath, JSON.stringify({ ...primary, state: "complete", closedAt: data.endedAt }));
    await expect(ensureMeetingAudioReady({
      attempts: 0,
      clientRecordingId: data.id,
      manifestPath: recoveredPath,
      recoveredIncomplete: true,
      sourceManifestPath: data.manifestPath,
      server: {},
      state: "ceka",
      tracks: { microphone: data.microphonePath, system: data.systemPath },
    }, { prepareStereoWebm: vi.fn(), recordingsDirectory: data.directory }))
      .rejects.toMatchObject({ code: "legacy_incomplete" });
  });
});
