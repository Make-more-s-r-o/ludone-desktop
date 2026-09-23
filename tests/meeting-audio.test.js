import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import { enqueueRecording, processNext } from "../src/lib/queue.js";

const require = createRequire(import.meta.url);
const {
  createLivePendingDelivery,
  ensureMeetingAudioReady,
  hasLegacyUploadEvidence,
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
    const bytes = Buffer.from("ID3\x04\x00\x00\x00\x00\x00\x00\xff\xfbmp3");
    const convert = vi.fn(async ({ outputPath }) => {
      await writeFile(outputPath, bytes);
      return {
        outputPath,
        size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        mime: "audio/mpeg",
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
      convertToStereoMp3: convert,
      recordingsDirectory: data.directory,
    });
    const afterRestart = await ensureMeetingAudioReady({ ...item, delivery: ready }, {
      convertToStereoMp3: convert,
      recordingsDirectory: data.directory,
    });

    expect(convert).toHaveBeenCalledTimes(1);
    expect(afterRestart).toEqual(ready);
    expect(ready).toMatchObject({
      state: "ready",
      mime: "audio/mpeg",
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
    }, { convertToStereoMp3: convert, recordingsDirectory: data.directory }))
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
    const bytes = Buffer.from("ID3\x04\x00\x00\x00\x00\x00\x00\xff\xfbmp3");
    const convert = async ({ outputPath }) => {
      await writeFile(outputPath, bytes);
      return { outputPath, size: bytes.length, mime: "audio/mpeg", channels: 2,
        encoderVersion: "test-1" };
    };
    const item = { attempts: 0, clientRecordingId: data.id, delivery: pending,
      manifestPath: data.manifestPath, server: {}, state: "ceka",
      tracks: { microphone: data.microphonePath, system: data.systemPath } };
    const ready = await ensureMeetingAudioReady(item, {
      convertToStereoMp3: convert, recordingsDirectory: data.directory,
    });
    const sidecar = JSON.parse(await readFile(ready.sidecarPath, "utf8"));
    sidecar.sha256 = "f".repeat(64);
    await writeFile(ready.sidecarPath, JSON.stringify(sidecar));
    await expect(ensureMeetingAudioReady({ ...item, delivery: ready }, {
      convertToStereoMp3: vi.fn(), recordingsDirectory: data.directory,
    })).rejects.toMatchObject({ code: "delivery_identity_mismatch" });
  });

  it("po pádu mezi publikací MP3 a sidecarem před HTTP překóduje z pevných zdrojů", async () => {
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
      return { outputPath, size: replacement.length, mime: "audio/mpeg", channels: 2,
        encoderVersion: "test-recovery" };
    });
    const ready = await ensureMeetingAudioReady({
      attempts: 1, clientRecordingId: data.id, delivery: pending,
      manifestPath: data.manifestPath, server: {}, state: "ceka",
      tracks: { microphone: data.microphonePath, system: data.systemPath },
    }, { convertToStereoMp3: convert, recordingsDirectory: data.directory });
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
    const bytes = Buffer.from("obnovené-mp3");
    const ready = await ensureMeetingAudioReady({
      attempts: 0, clientRecordingId: data.id, manifestPath: data.manifestPath,
      server: {}, state: "ceka",
      tracks: { microphone: data.microphonePath, system: data.systemPath },
    }, {
      convertToStereoMp3: async ({ outputPath }) => {
        await writeFile(outputPath, bytes);
        return { outputPath, size: bytes.length, mime: "audio/mpeg", channels: 2,
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
    const bytes = Buffer.from("legacy-mp3");
    const result = await processNext(queue, { DESKTOP_UPLOAD_ENABLED: "true" },
      async (_sending, report, preparation) => {
        const delivery = await ensureMeetingAudioReady(preparation.preAttemptItem, {
          convertToStereoMp3: async ({ outputPath }) => {
            await writeFile(outputPath, bytes);
            return { outputPath, size: bytes.length, mime: "audio/mpeg", channels: 2,
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
    }, { convertToStereoMp3: vi.fn(), recordingsDirectory: data.directory }))
      .rejects.toMatchObject({ code: "legacy_incomplete" });
  });
});
