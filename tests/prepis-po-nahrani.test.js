import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import queueStore from "../electron/queue.cjs";
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
const { createOutboundQueueStore, loadQueue, saveQueueAtomically } = queueStore;
const TOKEN = "tajny-pristupovy-token";

afterEach(() => vi.unstubAllGlobals());

function response(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, headers: new Headers(), json: async () => payload };
}

const RECORDING_ID = "5b0e8d2c-3c1f-4a6e-9f10-0123456789ab";
const OWNER = `sha256:${"c".repeat(64)}`;

/** Položka po uložení uploadu, jak ji vidí žádost o přepis. */
function sentItem(overrides = {}) {
  return { clientRecordingId: randomUUID(), ownerFingerprint: OWNER, server: { delivery: { recordingId: RECORDING_ID, uploadedBytes: 1 } },
    state: "odeslano", transcribeAfterUpload: true, transcription: { outcome: "pending", code: null }, ...overrides };
}

/** Žádost o přepis proti zmockovanému serveru; žádný skutečný (placený) požadavek neodejde. */
function transcriptionWith(statuses, { context = { accessToken: TOKEN, issuer: "https://labs.ludone.cz", ownerFingerprint: OWNER } } = {}) {
  const calls = [];
  const queued = [...statuses];
  const fetchImpl = vi.fn(async (url, options = {}) => {
    calls.push({ pathname: new URL(url).pathname, options });
    const next = queued.shift() ?? { status: 202, body: {} };
    if (next.throws) throw new TypeError("fetch failed");
    return response(next.body ?? {}, next.status);
  });
  /** @type {number[]} */
  const sleeps = [];
  const sleep = async (/** @type {number} */ milliseconds) => { sleeps.push(milliseconds); };
  const logger = { error: vi.fn(), log: vi.fn(), warn: vi.fn() };
  const request = uploadClient.createTranscriptionRequest({
    fetchImpl, getContext: async () => context, logger, origin: "https://labs.ludone.cz", sleep,
  });
  return { calls, fetchImpl, logger, request, sleeps };
}

describe("upload sám přepis nežádá", () => {
  it("sendRecording s přáním přepisu po dokončení nic dalšího nevolá a přepis nenese", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "ludone-prepis-"));
    const clientRecordingId = randomUUID();
    const sessionId = randomUUID();
    const ownerFingerprint = OWNER;
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
    const paths = [];
    const fetchImpl = vi.fn(async (url, options = {}) => {
      const pathname = new URL(url).pathname;
      paths.push(pathname);
      if (pathname === "/api/nahravky/uploads" && options.method === "POST") return response({ recordingId: RECORDING_ID, sessionId });
      if (pathname === `/api/nahravky/uploads/${RECORDING_ID}`) {
        return response({ declaredBytes: bytes.length, sha256, state: "initialized", missing: [0] });
      }
      if (pathname.endsWith("/casti/0")) return response({ ok: true });
      if (pathname.endsWith("/dokoncit")) return response({ recordingId: RECORDING_ID, sessionId, sizeBytes: bytes.length, sha256, state: "stored" });
      throw new Error(`neočekávaná cesta ${pathname}`);
    });
    const send = createRecordingUploadSend({
      fetchImpl,
      getUploadContext: async () => ({ accessToken: TOKEN, companyTabidooId: randomUUID(), deviceLabel: "Test", ownerFingerprint }),
      logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
      origin: "https://labs.ludone.cz",
      requireSingleDelivery: true,
    });
    const result = await send({
      attempts: 0, clientRecordingId, manifestPath, ownerFingerprint, server: {}, state: "ceka", title: "Porada",
      tracks: { microphone: path.join(directory, "mic.webm") }, uploadIntent: "approved", transcribeAfterUpload: true,
      delivery: {
        version: 1, state: "ready", source: "live-stereo", captureSources: "microphone+system", channels: 2,
        channelMap: { left: "microphone", right: "system" }, clientRecordingId, startedAt, endedAt,
        timing: { durationMs: 3_600_000, microphoneDelayMs: 0, systemDelayMs: 0 }, mime: "audio/webm", filePath,
        sidecarPath: `${manifestPath}.meeting-audio-v1.json`, masterPath: path.join(directory, "master.webm"),
        sizeBytes: bytes.length, sha256, encoderVersion: "test-1",
      },
    }, async () => {});
    expect(result).toMatchObject({ completedUploads: 1 });
    expect(result).not.toHaveProperty("transcription");
    expect(paths.at(-1)).toMatch(/\/dokoncit$/u);
    expect(paths.some((pathname) => pathname.endsWith("/prepis"))).toBe(false);
  });
});

describe("žádost o přepis (main proces, zmockovaný server, žádná prodleva)", () => {
  it("202 = zahájen; požadavek je POST bez těla s Bearer tokenem a bez logu tokenu", async () => {
    const { calls, logger, request, sleeps } = transcriptionWith([
      { status: 202, body: { recordingId: "x", transcriptId: "t", state: "queued", idempotent: false } }]);
    await expect(request(sentItem())).resolves.toEqual({ outcome: "started", code: null });
    expect(calls).toHaveLength(1);
    expect(calls[0].pathname).toBe(`/api/nahravky/uploads/${RECORDING_ID}/prepis`);
    expect(calls[0].options).toMatchObject({ method: "POST", redirect: "error", headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(calls[0].options.body).toBeUndefined();
    expect(sleeps).toEqual([]);
    expect(JSON.stringify(logger.warn.mock.calls) + JSON.stringify(logger.log.mock.calls)).not.toContain(TOKEN);
  });

  it("opakovaný idempotentní 202 je stále zahájený přepis", async () => {
    const { request } = transcriptionWith([{ status: 202, body: { idempotent: true } }]);
    await expect(request(sentItem())).resolves.toEqual({ outcome: "started", code: null });
  });

  it("404, 404, 202: počká 5 s a 15 s a pak je přepis zahájen jedním pokusem o přepis", async () => {
    const { calls, request, sleeps } = transcriptionWith([
      { status: 404, body: { ok: false, code: "recording_not_found" } },
      { status: 404, body: { ok: false, code: "recording_not_found" } },
      { status: 202, body: {} }]);
    await expect(request(sentItem())).resolves.toEqual({ outcome: "started", code: null });
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([5_000, 15_000]);
  });

  it("pětkrát 404: po 5, 15, 30 a 60 s skončí jako nezačal a nahrávka zůstane odeslaná", async () => {
    const { calls, request, sleeps } = transcriptionWith(Array.from({ length: 5 }, () => (
      { status: 404, body: { ok: false, code: "recording_not_found" } })));
    await expect(request(sentItem())).resolves.toEqual({ outcome: "failed", code: "recording_not_found" });
    expect(calls).toHaveLength(5);
    expect(sleeps).toEqual([5_000, 15_000, 30_000, 60_000]);
  });

  it("skutečné časovače: mezi pokusy opravdu čeká a nic jiného neblokuje", async () => {
    vi.useFakeTimers();
    try {
      const calls = [];
      const request = uploadClient.createTranscriptionRequest({
        fetchImpl: async (url) => { calls.push(url); return calls.length < 3 ? response({ code: "recording_not_found" }, 404) : response({}, 202); },
        getContext: async () => ({ accessToken: TOKEN, issuer: "https://labs.ludone.cz", ownerFingerprint: OWNER }),
        logger: { warn: vi.fn() }, origin: "https://labs.ludone.cz",
      });
      const done = request(sentItem());
      await vi.advanceTimersByTimeAsync(4_999);
      expect(calls).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(calls).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(15_000);
      await expect(done).resolves.toEqual({ outcome: "started", code: null });
    } finally { vi.useRealTimers(); }
  });

  it.each([
    [503, "transcription_disabled"], [503, "transcription_configuration_error"], [503, "transcription_queue_failed"],
    [503, "scope_unavailable"], [403, "insufficient_scope"], [403, "forbidden"], [403, "scope_empty"], [401, "unauthorized"],
  ])("%s %s se nezkouší znovu a vrátí důvod", async (status, code) => {
    const { calls, request, sleeps } = transcriptionWith([{ status, body: { ok: false, code } }]);
    await expect(request(sentItem())).resolves.toEqual({ outcome: "failed", code });
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it("409 už běžící přepis není chyba", async () => {
    const { request } = transcriptionWith([{ status: 409, body: { ok: false, code: "transcription_already_running" } }]);
    await expect(request(sentItem())).resolves.toEqual({ outcome: "already_running", code: "transcription_already_running" });
  });

  it("chyba bez kódu se přeloží podle stavu, síťová chyba i chybějící přihlášení nikdy nevyhodí", async () => {
    await expect(transcriptionWith([{ status: 500, body: {} }]).request(sentItem()))
      .resolves.toEqual({ outcome: "failed", code: "transcription_unavailable" });
    await expect(transcriptionWith([{ throws: true }]).request(sentItem()))
      .resolves.toEqual({ outcome: "failed", code: "network_error" });
    const cizi = transcriptionWith([], { context: { accessToken: TOKEN, issuer: "https://labs.ludone.cz", ownerFingerprint: `sha256:${"d".repeat(64)}` } });
    await expect(cizi.request(sentItem())).resolves.toEqual({ outcome: "failed", code: "unauthorized" });
    expect(cizi.fetchImpl).not.toHaveBeenCalled();
    const bez = transcriptionWith([], { context: null });
    await expect(bez.request(sentItem())).resolves.toEqual({ outcome: "failed", code: "unauthorized" });
    expect(bez.fetchImpl).not.toHaveBeenCalled();
  });

  it("bez serverového recordingId se nevolá nic", async () => {
    const { fetchImpl, request } = transcriptionWith([]);
    await expect(request(sentItem({ server: { delivery: { recordingId: null, uploadedBytes: 0 } } })))
      .resolves.toMatchObject({ outcome: "failed" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

function readyDelivery(clientRecordingId) {
  return { version: 1, state: "ready", source: "live-stereo", captureSources: "microphone+system", channels: 2,
    channelMap: { left: "microphone", right: "system" }, clientRecordingId, mime: "audio/webm",
    filePath: "/nahravky/s.webm", sidecarPath: "/nahravky/s.json", sizeBytes: 5, sha256: "a".repeat(64) };
}

/** Odesílač, který se tváří jako úspěšný upload jediného doručeného WebM. */
function fakeUploadSend(sentItems = []) {
  return async (/** @type {any} */ item, /** @type {any} */ report) => {
    sentItems.push(item);
    await report({ delivery: readyDelivery(item.clientRecordingId) });
    await report({ recordingId: RECORDING_ID, sessionId: randomUUID(), track: "delivery" });
    return {};
  };
}

describe("značka žádosti o přepis ve frontě", () => {
  function approvedQueue(extra = {}) {
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
    queue.items[0] = { ...queue.items[0], ownerFingerprint: OWNER, uploadIntent: "approved", ...extra };
    return queue;
  }
  const run = (queue, send) => processNext(queue, { DESKTOP_UPLOAD_ENABLED: "true" }, send,
    { currentOwnerFingerprint: OWNER, now: 1_777_000_001_000 });

  it("přání z fronty dorazí do senderu a odeslaná položka dostane značku pending hned se stavem odesláno", async () => {
    /** @type {any[]} */
    const sentItems = [];
    const result = await run(approvedQueue({ transcribeAfterUpload: true }), fakeUploadSend(sentItems));
    expect(sentItems[0]).toMatchObject({ transcribeAfterUpload: true });
    expect(result.outcome).toBe("sent");
    expect(result.item).toMatchObject({ state: "odeslano", transcription: { outcome: "pending", code: null } });
    expect(reduceQueueForRenderer(result.queue, OWNER)[0].transcription).toEqual({ outcome: "pending", code: null });
  });

  it("bez přání nebo bez serverového recordingId se žádná značka nezapíše", async () => {
    const bez = await run(approvedQueue(), fakeUploadSend());
    expect(bez.item).not.toHaveProperty("transcription");
    expect(reduceQueueForRenderer(bez.queue, OWNER)[0]).not.toHaveProperty("transcription");
    const bezId = await run(approvedQueue({ transcribeAfterUpload: true }), vi.fn(async () => ({})));
    expect(bezId.item).not.toHaveProperty("transcription");
  });

  it("existující značka se nepřepíše, takže opakovaný upload nevyrobí novou počáteční žádost", async () => {
    const marker = { outcome: "failed", code: "transcription_interrupted" };
    const result = await run(approvedQueue({ transcribeAfterUpload: true, transcription: marker }), fakeUploadSend());
    expect(result.item.transcription).toEqual(marker);
  });

  it.each([
    [{ outcome: "pending", code: null }, "Přepis se zahajuje…"],
    [{ outcome: "started", code: null }, "Přepis byl zahájen. Výsledek najdeš v LuDone na webu."],
    [{ outcome: "already_running", code: "transcription_already_running" }, "Přepis už běží."],
    [{ outcome: "failed", code: "transcription_disabled" }, "Přepis nezačal: přepis je vypnutý."],
    [{ outcome: "failed", code: "recording_not_found" }, "Přepis nezačal: server nahrávku nenašel. Spusť ho v LuDone na webu."],
    [{ outcome: "failed", code: "transcription_interrupted" }, "Přepis nezačal: aplikace se mezitím ukončila. Spusť ho v LuDone na webu."],
    [{ outcome: "failed", code: "něco neznámého" }, "Přepis nezačal: server přepis nezahájil. Spusť ho v LuDone na webu."],
  ])("věta pro člověka %j", (value, expected) => {
    expect(transcriptionNotice(value)).toBe(expected);
  });

  it("neznámý tvar výsledku se nezobrazí", () => {
    expect(transcriptionNotice(null)).toBeNull();
    expect(transcriptionNotice({ outcome: "jiné" })).toBeNull();
  });
});

describe("žádost o přepis nezdržuje frontu (store na disku)", () => {
  const dirs = [];
  afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

  async function fixture(requestTranscription, ids) {
    const directory = await mkdtemp(path.join(os.tmpdir(), "ludone-prepis-store-"));
    dirs.push(directory);
    const recordingsDirectory = path.join(directory, "nahravky");
    await mkdir(recordingsDirectory);
    const filePath = path.join(directory, "queue", "outgoing.json");
    const sentItems = [];
    const makeStore = (request = requestTranscription) => createOutboundQueueStore({
      filePath, queueModulePromise: import("../src/lib/queue.js"), send: fakeUploadSend(sentItems),
      requestTranscription: request,
    });
    const store = makeStore();
    for (const [id, transcribe] of ids) {
      const startedAt = "2026-08-25T08:00:00.000Z";
      const endedAt = "2026-08-25T08:30:00.000Z";
      const manifest = createManifest({ clientRecordingId: id, createdAt: startedAt, closedAt: endedAt, tracks: {
        microphone: { fileName: `${id}-m.webm`, startedAt, endedAt, sizeBytes: 120, sha256: "a".repeat(64) },
        system: { fileName: `${id}-s.webm`, startedAt, endedAt, sizeBytes: 240, sha256: "b".repeat(64) },
      } }, "complete");
      const manifestPath = path.join(recordingsDirectory, `${id}.manifest.json`);
      const trackPaths = {};
      for (const [source, track] of Object.entries(manifest.tracks)) {
        trackPaths[source] = path.join(recordingsDirectory, track.fileName);
        await writeFile(trackPaths[source], "zvuk");
      }
      await writeFile(manifestPath, JSON.stringify(manifest));
      await store.enqueueRecording({ manifest, manifestPath, trackPaths, ownerFingerprint: OWNER });
      await store.decideRecording(id, OWNER, "Porada", true, { guard: async () => true, transcribeAfterUpload: transcribe });
    }
    return { filePath, makeStore, sentItems, store };
  }
  const pump = (store) => store.pump({ DESKTOP_UPLOAD_ENABLED: "true" }, OWNER);
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  const find = async (filePath, id) => (await loadQueue(filePath)).items.find((item) => item.clientRecordingId === id);

  it("zatímco A čeká na přepis (404 opakování), B se normálně odešle; výsledek A se pak zapíše", async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const seenOnDisk = [];
    /** @type {any} */ let ctx;
    const request = vi.fn(async (item) => {
      // První požadavek smí odejít až PO zápisu značky a stavu odesláno na disk.
      seenOnDisk.push(await find(ctx.filePath, item.clientRecordingId));
      await gate;
      return { outcome: "started", code: null };
    });
    ctx = await fixture(request, [[A, true], [B, false]]);
    await ctx.store.pump({ DESKTOP_UPLOAD_ENABLED: "true" }, OWNER);  // odešle A i B (jedna pumpa jde přes celou frontu)
    expect(ctx.sentItems.map((item) => item.clientRecordingId)).toEqual([A, B]);
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    expect(seenOnDisk[0]).toMatchObject({ state: "odeslano", transcription: { outcome: "pending" } });
    expect(await find(ctx.filePath, B)).toMatchObject({ state: "odeslano" });
    expect(await find(ctx.filePath, B)).not.toHaveProperty("transcription");
    release();
    await vi.waitFor(async () => expect(await find(ctx.filePath, A)).toMatchObject({ transcription: { outcome: "started" } }));
    expect(request).toHaveBeenCalledOnce();
  });

  it("restart uprostřed čekání nikdy nepošle druhou počáteční žádost; značka se změní na nezačal", async () => {
    const request = vi.fn(() => new Promise(() => {}));
    const ctx = await fixture(request, [[A, true]]);
    await pump(ctx.store);
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    expect(await find(ctx.filePath, A)).toMatchObject({ transcription: { outcome: "pending" } });
    const novaZadost = vi.fn(async () => ({ outcome: "started", code: null }));
    const restarted = ctx.makeStore(novaZadost);
    const [row] = await restarted.list(OWNER);
    expect(row.transcription).toEqual({ outcome: "failed", code: "transcription_interrupted" });
    expect(await find(ctx.filePath, A)).toMatchObject({ transcription: { outcome: "failed", code: "transcription_interrupted" } });
    await pump(restarted);
    expect(novaZadost).not.toHaveBeenCalled();
  });

  it("položka s existující značkou se po opakovaném uploadu znovu nežádá", async () => {
    const request = vi.fn(async () => ({ outcome: "started", code: null }));
    const ctx = await fixture(request, [[A, true]]);
    const queue = await loadQueue(ctx.filePath);
    queue.items[0] = { ...queue.items[0], transcription: { outcome: "failed", code: "transcription_interrupted" } };
    await saveQueueAtomically(ctx.filePath, queue);
    await pump(ctx.makeStore());
    expect(request).not.toHaveBeenCalled();
    expect(await find(ctx.filePath, A)).toMatchObject({ state: "odeslano", transcription: { outcome: "failed", code: "transcription_interrupted" } });
  });

  it("selhání samotné žádosti nechá nahrávku odeslanou a uloží důvod", async () => {
    const request = vi.fn(async () => { throw new Error("neočekávané"); });
    const ctx = await fixture(request, [[A, true]]);
    await pump(ctx.store);
    await vi.waitFor(async () => expect(await find(ctx.filePath, A)).toMatchObject({
      state: "odeslano", transcription: { outcome: "failed", code: "transcription_unavailable" } }));
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
