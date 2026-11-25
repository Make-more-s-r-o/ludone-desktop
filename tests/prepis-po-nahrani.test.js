import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import uploadClient from "../electron/upload-client.cjs";
import { createManifest } from "../src/lib/manifest.js";
import { createQueue, enqueueRecording, processNext, reduceQueueForRenderer } from "../src/lib/queue.js";
import {
  DEFAULT_SAVE_CHOICE,
  RECORDING_SAVE_CHOICE_STORAGE_KEY,
  getRecordingSaveChoicePreference,
  persistRecordingSaveChoicePreference,
} from "../src/lib/recording-save-choice.js";
import { transcriptionNotice } from "../src/lib/recording-transcription.js";

const { createRecordingUploadSend } = uploadClient;
const TOKEN = "tajny-pristupovy-token";

afterEach(() => vi.unstubAllGlobals());

function response(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, headers: new Headers(), json: async () => payload };
}

/** Plný upload jednoho stereo WebM proti zmockovanému serveru; žádný skutečný požadavek neodejde. */
async function uploadWith({ transcribeAfterUpload, transcribe, finalizeStatus = 200 }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ludone-prepis-"));
  const clientRecordingId = randomUUID();
  const recordingId = randomUUID();
  const sessionId = randomUUID();
  const companyTabidooId = randomUUID();
  const ownerFingerprint = `sha256:${"a".repeat(64)}`;
  const startedAt = "2026-09-15T08:00:00.000Z";
  const endedAt = "2026-09-15T09:00:00.000Z";
  const bytes = Buffer.from("ID3\x04\x00\x00\x00\x00\x00\x00\xff\xfbmeeting");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const filePath = path.join(directory, "meeting-stereo.webm");
  const manifestPath = path.join(directory, "meeting.manifest.json");
  await writeFile(filePath, bytes);
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1, clientRecordingId, createdAt: startedAt, closedAt: endedAt, state: "complete",
    tracks: { microphone: { fileName: "mic.webm", startedAt, endedAt, sizeBytes: 1, sha256: "b".repeat(64) } },
  }));
  const calls = [];
  const fetchImpl = vi.fn(async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    calls.push({ pathname, options });
    if (pathname === "/api/nahravky/uploads" && options.method === "POST") return response({ recordingId, sessionId });
    if (pathname === `/api/nahravky/uploads/${recordingId}`) {
      return response({ declaredBytes: bytes.length, sha256, state: "initialized", missing: [0] });
    }
    if (pathname.endsWith("/casti/0")) return response({ ok: true });
    if (pathname.endsWith("/dokoncit")) {
      return finalizeStatus === 200
        ? response({ recordingId, sessionId, sizeBytes: bytes.length, sha256, state: "stored" })
        : response({ ok: false, code: "upload_failed" }, finalizeStatus);
    }
    if (pathname.endsWith("/prepis")) return transcribe(options);
    throw new Error(`neočekávaná cesta ${pathname}`);
  });
  const logger = { error: vi.fn(), log: vi.fn(), warn: vi.fn() };
  const send = createRecordingUploadSend({
    fetchImpl,
    getUploadContext: async () => ({ accessToken: TOKEN, companyTabidooId, deviceLabel: "Test", ownerFingerprint }),
    logger,
    origin: "https://labs.ludone.cz",
    requireSingleDelivery: true,
  });
  const item = {
    attempts: 0, clientRecordingId, manifestPath, ownerFingerprint, server: {}, state: "ceka", title: "Porada",
    tracks: { microphone: path.join(directory, "mic.webm") }, uploadIntent: "approved",
    ...(transcribeAfterUpload ? { transcribeAfterUpload: true } : {}),
    delivery: {
      version: 1, state: "ready", source: "live-stereo", captureSources: "microphone+system", channels: 2,
      channelMap: { left: "microphone", right: "system" }, clientRecordingId, startedAt, endedAt,
      timing: { durationMs: 3_600_000, microphoneDelayMs: 0, systemDelayMs: 0 }, mime: "audio/webm", filePath,
      sidecarPath: `${manifestPath}.meeting-audio-v1.json`, masterPath: path.join(directory, "master.webm"),
      sizeBytes: bytes.length, sha256, encoderVersion: "test-1",
    },
  };
  /** @type {{ value?: any, error?: any }} */
  const outcome = await send(item, async () => {}).then((value) => ({ value }), (error) => ({ error }));
  return { calls, logger, outcome, recordingId };
}

describe("přepis po úplném dokončení uploadu (main proces, zmockovaný server)", () => {
  it("bez přání se přepis nežádá a výsledek žádný přepis nenese", async () => {
    const transcribe = vi.fn();
    const { calls, outcome } = await uploadWith({ transcribeAfterUpload: false, transcribe });
    expect(outcome.value.transcription).toBeUndefined();
    expect(transcribe).not.toHaveBeenCalled();
    expect(calls.some(({ pathname }) => pathname.endsWith("/prepis"))).toBe(false);
  });

  it("přepis se žádá až po dokončit, bez těla, přes stejný autorizovaný požadavek", async () => {
    const transcribe = vi.fn(async () => response({ recordingId: "x", transcriptId: "t", state: "queued", idempotent: false }, 202));
    const { calls, logger, outcome, recordingId } = await uploadWith({ transcribeAfterUpload: true, transcribe });
    expect(outcome.value).toMatchObject({ completedUploads: 1, transcription: { outcome: "started", code: null } });
    expect(calls.map(({ pathname }) => pathname.replace(recordingId, "{id}"))).toEqual([
      "/api/nahravky/uploads", "/api/nahravky/uploads/{id}", "/api/nahravky/uploads/{id}/casti/0",
      "/api/nahravky/uploads/{id}/dokoncit", "/api/nahravky/uploads/{id}/prepis",
    ]);
    const last = calls.at(-1);
    expect(last.options).toMatchObject({ method: "POST", redirect: "error", headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(last.options.body).toBeUndefined();
    expect(JSON.stringify(logger.log.mock.calls) + JSON.stringify(logger.warn.mock.calls)).not.toContain(TOKEN);
  });

  it("opakovaný idempotentní 202 je stále zahájený přepis", async () => {
    const { outcome } = await uploadWith({ transcribeAfterUpload: true,
      transcribe: async () => response({ recordingId: "x", transcriptId: "t", state: "queued", idempotent: true }, 202) });
    expect(outcome.value.transcription).toEqual({ outcome: "started", code: null });
  });

  it.each([
    [503, "transcription_disabled"], [503, "transcription_configuration_error"], [503, "transcription_queue_failed"],
    [503, "scope_unavailable"], [403, "insufficient_scope"], [403, "forbidden"], [403, "scope_empty"],
    [404, "recording_not_found"], [401, "unauthorized"],
  ])("selhání zahájení %s %s neshodí dokončený upload a vrátí důvod", async (status, code) => {
    const { outcome } = await uploadWith({ transcribeAfterUpload: true,
      transcribe: async () => response({ ok: false, code }, status) });
    expect(outcome.error).toBeUndefined();
    expect(outcome.value).toMatchObject({ completedUploads: 1, transcription: { outcome: "failed", code } });
  });

  it("409 už běžící přepis není chyba", async () => {
    const { outcome } = await uploadWith({ transcribeAfterUpload: true,
      transcribe: async () => response({ ok: false, code: "transcription_already_running" }, 409) });
    expect(outcome.value.transcription).toEqual({ outcome: "already_running", code: "transcription_already_running" });
  });

  it("chyba bez kódu se přeloží podle stavu a síťová chyba nikdy upload neshodí", async () => {
    const bezKodu = await uploadWith({ transcribeAfterUpload: true, transcribe: async () => response({}, 500) });
    expect(bezKodu.outcome.value.transcription).toEqual({ outcome: "failed", code: "transcription_unavailable" });
    const sit = await uploadWith({ transcribeAfterUpload: true, transcribe: async () => { throw new TypeError("fetch failed"); } });
    expect(sit.outcome.error).toBeUndefined();
    expect(sit.outcome.value.transcription).toEqual({ outcome: "failed", code: "network_error" });
  });

  it("když upload sám selže, přepis se vůbec nežádá", async () => {
    const transcribe = vi.fn();
    const { calls, outcome } = await uploadWith({ transcribeAfterUpload: true, transcribe, finalizeStatus: 500 });
    expect(outcome.error).toBeDefined();
    expect(transcribe).not.toHaveBeenCalled();
    expect(calls.some(({ pathname }) => pathname.endsWith("/prepis"))).toBe(false);
  });
});

describe("výsledek přepisu ve frontě a v přehledu", () => {
  const OWNER = `sha256:${"c".repeat(64)}`;
  function approvedQueue(transcribeAfterUpload) {
    const clientRecordingId = "9e586e55-d688-43f1-8a80-a3d61e754f3e";
    const startedAt = "2026-08-25T08:00:00.000Z";
    const endedAt = "2026-08-25T08:30:00.000Z";
    const manifest = createManifest({ clientRecordingId, createdAt: startedAt, closedAt: endedAt, tracks: {
      microphone: { fileName: "m.webm", startedAt, endedAt, sizeBytes: 1, sha256: "a".repeat(64) },
      system: { fileName: "s.webm", startedAt, endedAt, sizeBytes: 1, sha256: "b".repeat(64) },
    } }, "complete");
    const queue = enqueueRecording(createQueue(), {
      manifest, manifestPath: "/nahravky/m.manifest.json", trackPaths: { microphone: "/nahravky/m.webm", system: "/nahravky/s.webm" },
      ownerFingerprint: OWNER,
    }, 1_777_000_000_000).queue;
    queue.items[0] = { ...queue.items[0], ownerFingerprint: OWNER, uploadIntent: "approved", ...(transcribeAfterUpload ? { transcribeAfterUpload: true } : {}) };
    return queue;
  }

  it("položka po úspěšném uploadu nese výsledek přepisu a přání z fronty dorazí do senderu", async () => {
    /** @type {any[]} */
    const sentItems = [];
    const send = async (/** @type {any} */ item) => {
      sentItems.push(item);
      return { transcription: { outcome: "failed", code: "transcription_disabled", tajne: "zahodit" } };
    };
    const result = await processNext(approvedQueue(true), { DESKTOP_UPLOAD_ENABLED: "true" }, send,
      { currentOwnerFingerprint: OWNER, now: 1_777_000_001_000 });
    expect(sentItems[0]).toMatchObject({ transcribeAfterUpload: true });
    expect(result.outcome).toBe("sent");
    expect(result.item).toMatchObject({ state: "odeslano", transcription: { outcome: "failed", code: "transcription_disabled" } });
    expect(result.item.transcription).not.toHaveProperty("tajne");
    expect(reduceQueueForRenderer(result.queue, OWNER)[0].transcription).toEqual({ outcome: "failed", code: "transcription_disabled" });
  });

  it("bez výsledku přepisu položka žádný přepis nenese", async () => {
    const result = await processNext(approvedQueue(false), { DESKTOP_UPLOAD_ENABLED: "true" }, vi.fn(async () => ({})),
      { currentOwnerFingerprint: OWNER, now: 1_777_000_001_000 });
    expect(result.item).not.toHaveProperty("transcription");
    expect(reduceQueueForRenderer(result.queue, OWNER)[0]).not.toHaveProperty("transcription");
  });

  it.each([
    [{ outcome: "started", code: null }, /Přepis byl zahájen/u],
    [{ outcome: "already_running", code: "transcription_already_running" }, /Přepis už běží/u],
    [{ outcome: "failed", code: "transcription_disabled" }, /Nahrávka je odeslaná, ale přepis se nespustil: přepis je na serveru vypnutý\./u],
    [{ outcome: "failed", code: "insufficient_scope" }, /nespustil: přihlášení nemá oprávnění k přepisu/u],
    [{ outcome: "failed", code: "něco neznámého" }, /nespustil: server přepis nezahájil/u],
  ])("věta pro člověka %j", (value, expected) => {
    expect(transcriptionNotice(value)).toMatch(expected);
  });

  it("neznámý tvar výsledku se nezobrazí", () => {
    expect(transcriptionNotice(null)).toBeNull();
    expect(transcriptionNotice({ outcome: "jiné" })).toBeNull();
  });
});

describe("paměť poslední bezpečné volby na tomto Macu", () => {
  it.each([[null, DEFAULT_SAVE_CHOICE], ["keep", "keep"], ["send", "send"], ["send-transcribe", "send-transcribe"],
    ["delete", DEFAULT_SAVE_CHOICE], ["smazat", DEFAULT_SAVE_CHOICE]])("uložená hodnota %s se načte jako %s", (stored, expected) => {
    vi.stubGlobal("window", { localStorage: { getItem: vi.fn(() => stored) } });
    expect(getRecordingSaveChoicePreference()).toBe(expected);
  });

  it("zapíše jen bezpečnou volbu a Smazat odmítne", () => {
    const setItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { setItem } });
    expect(persistRecordingSaveChoicePreference("send-transcribe")).toBe(true);
    expect(setItem).toHaveBeenCalledExactlyOnceWith(RECORDING_SAVE_CHOICE_STORAGE_KEY, "send-transcribe");
    expect(() => Reflect.apply(persistRecordingSaveChoicePreference, null, ["delete"])).toThrow(TypeError);
    expect(setItem).toHaveBeenCalledOnce();
  });

  it("nedostupné úložiště nic nerozbije", () => {
    vi.stubGlobal("window", { get localStorage() { throw new Error("nedostupné"); } });
    expect(getRecordingSaveChoicePreference()).toBe(DEFAULT_SAVE_CHOICE);
    expect(persistRecordingSaveChoicePreference("keep")).toBe(false);
  });
});
