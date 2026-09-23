import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import uploadClient from "../electron/upload-client.cjs";

const { createRecordingUploadSend } = uploadClient;

function response(payload) {
  return { ok: true, status: 200, headers: new Headers(), json: async () => payload };
}

describe("produkční upload jednoho stereo MP3", () => {
  it("odešle právě jeden INIT, jeden obsah a jedno dokončení se stabilní identitou schůzky", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "ludone-meeting-upload-"));
    const clientRecordingId = randomUUID();
    const recordingId = randomUUID();
    const sessionId = randomUUID();
    const companyTabidooId = randomUUID();
    const ownerFingerprint = `sha256:${"a".repeat(64)}`;
    const startedAt = "2026-09-15T08:00:00.000Z";
    const endedAt = "2026-09-15T09:00:00.000Z";
    const bytes = Buffer.from("ID3\x04\x00\x00\x00\x00\x00\x00\xff\xfbmeeting");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const filePath = path.join(directory, "meeting-stereo.mp3");
    const manifestPath = path.join(directory, "meeting.manifest.json");
    await writeFile(filePath, bytes);
    await writeFile(manifestPath, JSON.stringify({
      schemaVersion: 1,
      clientRecordingId,
      createdAt: startedAt,
      closedAt: endedAt,
      state: "complete",
      tracks: { microphone: { fileName: "mic.webm", startedAt, endedAt, sizeBytes: 1, sha256: "b".repeat(64) } },
    }));
    const calls = [];
    const fetchImpl = vi.fn(async (url, options = {}) => {
      calls.push({ path: new URL(url).pathname, options });
      const pathname = new URL(url).pathname;
      if (pathname === "/api/nahravky/uploads" && options.method === "POST") {
        return response({ recordingId, sessionId });
      }
      if (pathname === `/api/nahravky/uploads/${recordingId}`) {
        return response({ declaredBytes: bytes.length, sha256, state: "initialized", missing: [0] });
      }
      if (pathname.endsWith("/casti/0")) return response({ ok: true });
      if (pathname.endsWith("/dokoncit")) {
        return response({ recordingId, sessionId, sizeBytes: bytes.length, sha256, state: "stored" });
      }
      throw new Error(`neočekávaná cesta ${pathname}`);
    });
    const send = createRecordingUploadSend({
      fetchImpl,
      getUploadContext: async () => ({
        accessToken: "token",
        companyTabidooId,
        deviceLabel: "Testovací Mac",
        ownerFingerprint,
      }),
      origin: "https://labs.ludone.cz",
      requireSingleDelivery: true,
    });
    const progress = [];
    const result = await send({
      attempts: 0,
      clientRecordingId,
      delivery: {
        version: 1,
        state: "ready",
        source: "live-stereo",
        captureSources: "microphone+system",
        channels: 2,
        channelMap: { left: "microphone", right: "system" },
        clientRecordingId,
        startedAt,
        endedAt,
        timing: { durationMs: 3_600_000, microphoneDelayMs: 0, systemDelayMs: 0 },
        mime: "audio/mpeg",
        filePath,
        sidecarPath: `${manifestPath}.meeting-audio-v1.json`,
        masterPath: path.join(directory, "meeting-stereo-master.webm"),
        sizeBytes: bytes.length,
        sha256,
        encoderVersion: "test-1",
      },
      manifestPath,
      ownerFingerprint,
      server: {},
      state: "ceka",
      title: "Porada výroby",
      tracks: { microphone: path.join(directory, "mic.webm") },
      uploadIntent: "approved",
    }, async (value) => { progress.push(value); });

    expect(result).toMatchObject({ completedUploads: 1, uploads: [{ track: "delivery", recordingId }] });
    expect(calls.map(({ options }) => options.method ?? "GET")).toEqual(["POST", "GET", "PUT", "POST"]);
    const init = JSON.parse(calls[0].options.body);
    expect(init).toMatchObject({
      clientRecordingId,
      title: "Porada výroby",
      declaredMime: "audio/mpeg",
      declaredCaptureSources: "microphone+system",
      sessionId: null,
    });
    expect(init.title).not.toMatch(/mikrofon|systémový/u);
    expect(progress).toEqual([
      { companyTabidooId },
      { recordingId, sessionId, track: "delivery" },
      { quotaWarning: false, recordingId, sessionId, track: "delivery", uploadedBytes: bytes.length },
    ]);
  });

  it("bez delivery produkční režim neudělá žádný HTTP request", async () => {
    const fetchImpl = vi.fn();
    const send = createRecordingUploadSend({
      fetchImpl,
      getUploadContext: vi.fn(),
      origin: "https://labs.ludone.cz",
      requireSingleDelivery: true,
    });
    await expect(send({ kind: "recording" })).rejects.toMatchObject({ code: "delivery_not_ready" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
