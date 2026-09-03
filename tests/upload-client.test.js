import { createHash } from "node:crypto";
import { mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import uploadClient from "../electron/upload-client.cjs";
import {
  QUEUE_STATES,
  createQueue,
  enqueueRecording,
  processNext,
  reduceQueueForRenderer,
} from "../src/lib/queue.js";
import { queueFooterStatus } from "../src/lib/panel.js";

const {
  RECORDING_CHUNK_BYTES,
  RECORDING_MAX_BYTES,
  createRecordingUploadSend,
  deriveUploadIdentity,
} = uploadClient;

const CLIENT_RECORDING_ID = "9e586e55-d688-43f1-8a80-a3d61e754f3e";
const COMPANY_ID = "865a78f8-b47f-4bb8-8b34-f4ec07f6f516";
const TOKEN = "TAJNY-UPLOAD-TOKEN-ktery-nesmi-do-logu";
const ORIGIN = "https://labs.ludone.cz";
const STARTED_AT = "2026-09-03T08:00:00.000Z";
const ENDED_AT = "2026-09-03T08:30:00.000Z";
const CONTRACT_CHUNK_BYTES = 8 * 1024 * 1024;
const CONTRACT_MAX_BYTES = 512 * 1024 * 1024;
const OWNER_A = `sha256:${"a".repeat(64)}`;
const OWNER_B = `sha256:${"b".repeat(64)}`;
const temporaryRoots = new Set();

if (RECORDING_CHUNK_BYTES !== CONTRACT_CHUNK_BYTES) {
  throw new Error("Upload klient nepoužívá smluvní velikost části 8 MiB");
}
if (RECORDING_MAX_BYTES !== CONTRACT_MAX_BYTES) {
  throw new Error("Upload klient nepoužívá smluvní limit souboru 512 MiB");
}

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await Promise.all([...temporaryRoots].map((root) => (
    rm(root, { recursive: true, force: true })
  )));
  temporaryRoots.clear();
});

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fakeResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => payload),
  };
}

function requestHeaders(options) {
  return new Headers(options?.headers);
}

function requestPath(input) {
  return new URL(String(input)).pathname;
}

function manifestTrack(fileName, bytes) {
  return {
    endedAt: ENDED_AT,
    fileName,
    sha256: sha256(bytes),
    sizeBytes: bytes.byteLength,
    startedAt: STARTED_AT,
  };
}

async function recordingFixture({
  microphoneBytes = Buffer.from("mikrofon-webm"),
  systemBytes = Buffer.from("system-webm"),
  sameContent = false,
} = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "ludone-upload-client-"));
  temporaryRoots.add(root);
  const microphonePath = path.join(root, "schuzka-microphone.webm");
  const systemPath = path.join(root, "schuzka-system.webm");
  const manifestPath = path.join(root, "schuzka.manifest.json");
  const actualSystemBytes = sameContent ? microphoneBytes : systemBytes;
  await Promise.all([
    writeFile(microphonePath, microphoneBytes),
    writeFile(systemPath, actualSystemBytes),
  ]);
  const manifest = {
    schemaVersion: 1,
    clientRecordingId: CLIENT_RECORDING_ID,
    createdAt: STARTED_AT,
    closedAt: ENDED_AT,
    state: "complete",
    companyTabidooId: COMPANY_ID,
    tracks: {
      microphone: manifestTrack(path.basename(microphonePath), microphoneBytes),
      system: manifestTrack(path.basename(systemPath), actualSystemBytes),
    },
  };
  await writeFile(manifestPath, JSON.stringify(manifest));
  const queued = enqueueRecording(createQueue(), {
    manifest,
    manifestPath,
    trackPaths: {
      microphone: microphonePath,
      system: systemPath,
    },
  }, Date.parse(ENDED_AT));
  const item = { ...queued.item, ownerFingerprint: OWNER_A };
  return {
    item,
    manifest,
    manifestPath,
    microphonePath,
    queue: { ...queued.queue, items: [item] },
    systemPath,
  };
}

function createLogger() {
  return { error: vi.fn(), log: vi.fn(), warn: vi.fn() };
}

function createSend(fetchImpl, logger = createLogger(), options = {}) {
  return {
    logger,
    send: createRecordingUploadSend({
      fetchImpl,
      getUploadContext: vi.fn(async () => ({
        accessToken: TOKEN,
        companyTabidooId: COMPANY_ID,
        deviceLabel: "Testovací Mac",
        ownerFingerprint: OWNER_A,
      })),
      logger,
      origin: ORIGIN,
      ...options,
    }),
  };
}

describe("vlastník nahrávky před uploadem", () => {
  it("položku pořízenou přihlášeným odešle pod toutéž session", async () => {
    const fixture = await recordingFixture();
    const server = createStatefulServer();
    const getUploadContext = vi.fn(async () => ({
      accessToken: TOKEN,
      companyTabidooId: COMPANY_ID,
      ownerFingerprint: OWNER_A,
    }));
    const { send } = createSend(server.fetchImpl, createLogger(), { getUploadContext });

    await expect(send(fixture.item)).resolves.toMatchObject({ completedUploads: 2 });
    expect(getUploadContext).toHaveBeenCalledOnce();
    expect(server.fetchImpl).toHaveBeenCalled();
    for (const [, options] of server.fetchImpl.mock.calls) {
      expect(requestHeaders(options).get("authorization")).toBe(`Bearer ${TOKEN}`);
    }
  });

  it("jiná session položku pozastaví, zachová a nic neodešle", async () => {
    const fixture = await recordingFixture();
    const fetchImpl = vi.fn();
    const { send } = createSend(fetchImpl, createLogger(), {
      getUploadContext: vi.fn(async () => ({
        accessToken: "TOKEN-JINEHO-UCTU",
        companyTabidooId: COMPANY_ID,
        ownerFingerprint: OWNER_B,
      })),
    });

    const result = await processNext(
      fixture.queue,
      { DESKTOP_UPLOAD_ENABLED: "true", DESKTOP_TIME_ENABLED: undefined },
      send,
    );

    expect(result).toMatchObject({
      outcome: "paused",
      item: {
        attempts: 0,
        ownerFingerprint: OWNER_A,
        sentAt: null,
        state: QUEUE_STATES.WAITING,
      },
      queue: { items: [expect.objectContaining({ ownerFingerprint: OWNER_A })] },
    });
    expect(result.reason).toMatch(/jinému účtu/i);
    expect(result.queue.items).toHaveLength(1);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(queueFooterStatus(reduceQueueForRenderer(result.queue))).toEqual({
      text: "1 čeká na potvrzení",
      tone: "waiting",
    });
  });

  it("neznámého vlastníka nepřiřadí první přihlášené session a nechá jej čekat", async () => {
    const fixture = await recordingFixture();
    fixture.item.ownerFingerprint = null;
    fixture.queue.items[0] = fixture.item;
    const fetchImpl = vi.fn();
    const { send } = createSend(fetchImpl);

    const result = await processNext(
      fixture.queue,
      { DESKTOP_UPLOAD_ENABLED: "true", DESKTOP_TIME_ENABLED: undefined },
      send,
    );

    expect(result).toMatchObject({
      outcome: "paused",
      item: {
        attempts: 0,
        ownerFingerprint: null,
        sentAt: null,
        state: QUEUE_STATES.WAITING,
      },
    });
    expect(result.reason).toMatch(/vlastník.*potvr/i);
    expect(result.queue.items).toHaveLength(1);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(queueFooterStatus(reduceQueueForRenderer(result.queue))).toEqual({
      text: "1 čeká na potvrzení",
      tone: "waiting",
    });
  });

  it("neověřená identita session je vidět jako čekání na potvrzení", async () => {
    const fixture = await recordingFixture();
    const fetchImpl = vi.fn();
    const { send } = createSend(fetchImpl, createLogger(), {
      getUploadContext: vi.fn(async () => ({
        accessToken: TOKEN,
        companyTabidooId: COMPANY_ID,
        ownerFingerprint: null,
      })),
    });

    const result = await processNext(
      fixture.queue,
      { DESKTOP_UPLOAD_ENABLED: "true", DESKTOP_TIME_ENABLED: undefined },
      send,
    );

    expect(result).toMatchObject({
      outcome: "paused",
      item: { attempts: 0, state: QUEUE_STATES.WAITING },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(queueFooterStatus(reduceQueueForRenderer(result.queue))).toEqual({
      text: "1 čeká na potvrzení",
      tone: "waiting",
    });
  });

  it("chybějící přihlášení se dál počítá jako běžné čekání", async () => {
    const fixture = await recordingFixture();
    const fetchImpl = vi.fn();
    const { send } = createSend(fetchImpl, createLogger(), {
      getUploadContext: vi.fn(async () => null),
    });

    const result = await processNext(
      fixture.queue,
      { DESKTOP_UPLOAD_ENABLED: "true", DESKTOP_TIME_ENABLED: undefined },
      send,
    );

    expect(result).toMatchObject({
      outcome: "paused",
      item: { attempts: 0, state: QUEUE_STATES.WAITING },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(queueFooterStatus(reduceQueueForRenderer(result.queue))).toEqual({
      text: "1 čeká",
      tone: "waiting",
    });
  });

  it("starší položku bez pole vlastníka považuje za neznámou a neodešle ji", async () => {
    const fixture = await recordingFixture();
    delete fixture.item.ownerFingerprint;
    fixture.queue.items[0] = fixture.item;
    const fetchImpl = vi.fn();
    const { send } = createSend(fetchImpl);

    const result = await processNext(
      fixture.queue,
      { DESKTOP_UPLOAD_ENABLED: "true", DESKTOP_TIME_ENABLED: undefined },
      send,
    );

    expect(result).toMatchObject({
      outcome: "paused",
      item: { attempts: 0, sentAt: null, state: QUEUE_STATES.WAITING },
    });
    expect(result.queue.items).toHaveLength(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

function serverRecordingId(sequence) {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

function createStatefulServer({ failOnceAtIndex = null, quotaWarning = false } = {}) {
  const uploadsByKey = new Map();
  const uploadsById = new Map();
  let sequence = 1;
  let failed = false;
  const fetchImpl = vi.fn(async (input, options = {}) => {
    const pathname = requestPath(input);
    const method = options.method ?? "GET";
    const headers = requestHeaders(options);
    expect(headers.get("authorization")).toBe(`Bearer ${TOKEN}`);

    if (method === "POST" && pathname === "/api/nahravky/uploads") {
      const body = JSON.parse(String(options.body));
      const key = headers.get("idempotency-key");
      expect(Object.keys(body).sort()).toEqual([
        "chunkCount",
        "chunkSize",
        "clientRecordingId",
        "companyTabidooId",
        "declaredBytes",
        "declaredMime",
        "deviceLabel",
        "endedAt",
        "sessionId",
        "sha256",
        "startedAt",
        "title",
        "visibility",
      ]);
      expect(key).toMatch(/^[a-f0-9]{64}$/);
      expect(body.chunkSize).toBe(CONTRACT_CHUNK_BYTES);
      expect(body.chunkCount).toBe(Math.ceil(body.declaredBytes / CONTRACT_CHUNK_BYTES));
      expect(body.title).toEqual(expect.any(String));
      expect(body.title.length).toBeGreaterThan(0);
      expect(body.companyTabidooId).toBe(COMPANY_ID);
      let upload = uploadsByKey.get(key);
      if (!upload) {
        upload = {
          body,
          finalized: false,
          id: serverRecordingId(sequence),
          received: new Set(),
        };
        sequence += 1;
        uploadsByKey.set(key, upload);
        uploadsById.set(upload.id, upload);
      }
      return fakeResponse(upload === uploadsByKey.get(key) && upload.received.size > 0 ? 200 : 201, {
        chunkSize: CONTRACT_CHUNK_BYTES,
        idempotent: upload.received.size > 0,
        quotaWarning,
        recordingId: upload.id,
        state: upload.finalized ? "stored" : "uploading",
      });
    }

    const statusMatch = pathname.match(/^\/api\/nahravky\/uploads\/([^/]+)$/);
    if (method === "GET" && statusMatch) {
      const upload = uploadsById.get(statusMatch[1]);
      if (!upload) return fakeResponse(404, { code: "recording_not_found" });
      const all = Array.from({ length: upload.body.chunkCount }, (_, index) => index);
      const receivedChunks = [...upload.received].sort((left, right) => left - right);
      return fakeResponse(200, {
        declaredBytes: upload.body.declaredBytes,
        missing: all.filter((index) => !upload.received.has(index)),
        receivedChunks,
        sha256: upload.body.sha256,
        state: upload.finalized ? "stored" : "uploading",
      });
    }

    const chunkMatch = pathname.match(/^\/api\/nahravky\/uploads\/([^/]+)\/casti\/(\d+)$/);
    if (method === "PUT" && chunkMatch) {
      const upload = uploadsById.get(chunkMatch[1]);
      const index = Number(chunkMatch[2]);
      if (!upload) return fakeResponse(404, { code: "recording_not_found" });
      expect(options.body).toBeInstanceOf(Buffer);
      const expectedLength = Math.min(
        CONTRACT_CHUNK_BYTES,
        upload.body.declaredBytes - index * CONTRACT_CHUNK_BYTES,
      );
      expect(options.body.byteLength).toBe(expectedLength);
      expect(headers.get("content-type")).toBe("application/octet-stream");
      expect(headers.get("content-length")).toBe(String(expectedLength));
      expect(headers.get("x-chunk-sha256")).toBe(sha256(options.body));
      if (!failed && failOnceAtIndex === index) {
        failed = true;
        throw new Error(`simulovaná síťová chyba s ${TOKEN}`);
      }
      upload.received.add(index);
      return fakeResponse(200, {
        missing: Array.from({ length: upload.body.chunkCount }, (_, candidate) => candidate)
          .filter((candidate) => !upload.received.has(candidate)),
        received: [...upload.received],
      });
    }

    const finalizeMatch = pathname.match(/^\/api\/nahravky\/uploads\/([^/]+)\/dokoncit$/);
    if (method === "POST" && finalizeMatch) {
      const upload = uploadsById.get(finalizeMatch[1]);
      if (!upload) return fakeResponse(404, { code: "recording_not_found" });
      if (upload.received.size !== upload.body.chunkCount) {
        const missing = Array.from({ length: upload.body.chunkCount }, (_, index) => index)
          .filter((index) => !upload.received.has(index));
        return fakeResponse(409, { code: "incomplete", missing });
      }
      upload.finalized = true;
      return fakeResponse(201, {
        durationMs: null,
        recordingId: upload.id,
        sha256: upload.body.sha256,
        sizeBytes: upload.body.declaredBytes,
        state: "stored",
      });
    }

    throw new Error(`Neočekávaný HTTP požadavek: ${method} ${pathname}`);
  });
  return { fetchImpl, uploadsById, uploadsByKey };
}

describe("mapování serverových chyb do tříd fronty", () => {
  it("HTTP 507 quota_exceeded frontu pozastaví a nikdy položku nevzdá", async () => {
    const fixture = await recordingFixture();
    const fetchImpl = vi.fn(async () => fakeResponse(507, {
      code: "quota_exceeded",
      quotaBytes: 200,
      usedBytes: 190,
      wouldAddBytes: 20,
    }));
    const { send } = createSend(fetchImpl);

    const result = await processNext(
      fixture.queue,
      { DESKTOP_UPLOAD_ENABLED: "true", DESKTOP_TIME_ENABLED: undefined },
      send,
    );

    expect(result).toMatchObject({
      outcome: "paused",
      item: { attempts: 0, state: QUEUE_STATES.WAITING },
    });
    expect(result.reason).toContain("quota_exceeded");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("quota_exceeded zachová všechny tři naměřené hodnoty kvóty", async () => {
    const fixture = await recordingFixture();
    const { send } = createSend(vi.fn(async () => fakeResponse(507, {
      code: "quota_exceeded",
      quotaBytes: 200,
      usedBytes: 190,
      wouldAddBytes: 20,
    })));

    await expect(send(fixture.item)).rejects.toMatchObject({
      code: "quota_exceeded",
      failureClass: "paused",
      quota: { quotaBytes: 200, usedBytes: 190, wouldAddBytes: 20 },
    });
  });

  it("unauthorized na posledním pokusu frontu pozastaví místo trvalého selhání", async () => {
    const fixture = await recordingFixture();
    fixture.queue.items[0] = { ...fixture.queue.items[0], attempts: 4 };
    const fetchImpl = vi.fn(async () => fakeResponse(401, { code: "unauthorized" }));
    const { send } = createSend(fetchImpl);

    const result = await processNext(
      fixture.queue,
      { DESKTOP_UPLOAD_ENABLED: "true", DESKTOP_TIME_ENABLED: undefined },
      send,
    );

    expect(result).toMatchObject({
      outcome: "paused",
      item: { attempts: 4, state: QUEUE_STATES.WAITING },
    });
    expect(result.reason).toContain("unauthorized");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("idempotency_conflict je permanentní, neopakuje se a je hlasitě v logu", async () => {
    const fixture = await recordingFixture();
    const fetchImpl = vi.fn(async () => fakeResponse(409, {
      code: "idempotency_conflict",
    }));
    const { logger, send } = createSend(fetchImpl);

    const first = await processNext(
      fixture.queue,
      { DESKTOP_UPLOAD_ENABLED: "true", DESKTOP_TIME_ENABLED: undefined },
      send,
    );
    const second = await processNext(
      first.queue,
      { DESKTOP_UPLOAD_ENABLED: "true", DESKTOP_TIME_ENABLED: undefined },
      send,
    );

    expect(first).toMatchObject({
      outcome: "failed",
      item: { attempts: 1, state: QUEUE_STATES.FAILED },
    });
    expect(second.outcome).toBe("idle");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("idempotency_conflict"));
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(TOKEN);
  });

  it.each([
    ["storage_disabled", "paused"],
    ["session_missing", "paused"],
    ["session_not_found", "paused"],
    ["session_forbidden", "permanent"],
    ["company_out_of_scope", "permanent"],
    ["unsupported_content_type", "permanent"],
    ["too_large", "permanent"],
    ["invalid_input", "permanent"],
    ["sha256_mismatch", "permanent"],
    ["invalid_json", "retryable"],
    ["storage_failed", "retryable"],
  ])("kód %s dostane třídu %s", async (code, failureClass) => {
    const fixture = await recordingFixture();
    const status = code === "storage_disabled" || code === "storage_failed" ? 503 : 400;
    const { send } = createSend(vi.fn(async () => fakeResponse(status, { code })));

    await expect(send(fixture.item)).rejects.toMatchObject({ code, failureClass });
  });

  it.each([503, 507])("HTTP %i bez aplikačního kódu zůstává přechodné", async (status) => {
    const fixture = await recordingFixture();
    const { send } = createSend(vi.fn(async () => fakeResponse(status, {})));

    await expect(send(fixture.item)).rejects.toMatchObject({ failureClass: "retryable" });
  });
});

describe("resumable upload", () => {
  it("po výpadku zopakuje stejný init, přečte stav a neodesílá hotovou část znovu", async () => {
    const microphoneBytes = Buffer.alloc(CONTRACT_CHUNK_BYTES + 31, 0x2a);
    const fixture = await recordingFixture({ microphoneBytes });
    const server = createStatefulServer({ failOnceAtIndex: 1 });
    const { send } = createSend(server.fetchImpl);

    await expect(send(fixture.item)).rejects.toMatchObject({
      code: "network_error",
      failureClass: "retryable",
    });
    await expect(send(fixture.item)).resolves.toMatchObject({ completedUploads: 2 });

    const initCalls = server.fetchImpl.mock.calls.filter(([input, options]) => (
      requestPath(input) === "/api/nahravky/uploads" && options.method === "POST"
    ));
    const firstKey = requestHeaders(initCalls[0][1]).get("idempotency-key");
    expect(requestHeaders(initCalls[1][1]).get("idempotency-key")).toBe(firstKey);
    const firstRecordingId = [...server.uploadsById.keys()][0];
    const firstChunkZeroCalls = server.fetchImpl.mock.calls.filter(([input, options]) => (
      options.method === "PUT"
      && requestPath(input) === `/api/nahravky/uploads/${firstRecordingId}/casti/0`
    ));
    expect(firstChunkZeroCalls).toHaveLength(1);
    const firstStatusCalls = server.fetchImpl.mock.calls.filter(([input, options]) => (
      options.method === "GET"
      && requestPath(input) === `/api/nahravky/uploads/${firstRecordingId}`
    ));
    expect(firstStatusCalls).toHaveLength(2);
    const firstUpload = server.uploadsById.get(firstRecordingId);
    expect([...firstUpload.received].sort((left, right) => left - right)).toEqual([0, 1]);
    expect(firstUpload.finalized).toBe(true);
  });

  it("po ztracené odpovědi finalizace uzná stav stored a nefinalizuje podruhé", async () => {
    const fixture = await recordingFixture();
    const server = createStatefulServer();
    let loseFinalizeResponse = true;
    const fetchImpl = vi.fn(async (input, options) => {
      const response = await server.fetchImpl(input, options);
      if (
        loseFinalizeResponse
        && options?.method === "POST"
        && requestPath(input).endsWith("/dokoncit")
      ) {
        loseFinalizeResponse = false;
        throw new Error("odpověď finalizace se cestou ztratila");
      }
      return response;
    });
    const { send } = createSend(fetchImpl);

    await expect(send(fixture.item)).rejects.toMatchObject({ code: "network_error" });
    await expect(send(fixture.item)).resolves.toMatchObject({ completedUploads: 2 });

    const firstRecordingId = [...server.uploadsById.keys()][0];
    const firstFinalizeCalls = fetchImpl.mock.calls.filter(([input, options]) => (
      options?.method === "POST"
      && requestPath(input) === `/api/nahravky/uploads/${firstRecordingId}/dokoncit`
    ));
    expect(firstFinalizeCalls).toHaveLength(1);
  });

  it("části všech stop posílá přísně sériově", async () => {
    const fixture = await recordingFixture({
      microphoneBytes: Buffer.alloc(CONTRACT_CHUNK_BYTES * 2 + 17, 0x11),
      systemBytes: Buffer.alloc(CONTRACT_CHUNK_BYTES + 19, 0x22),
    });
    const server = createStatefulServer();
    let active = 0;
    let maxActive = 0;
    const fetchImpl = vi.fn(async (...args) => {
      const [input, options] = args;
      if (options?.method === "PUT") {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setImmediate(resolve));
        const response = await server.fetchImpl(input, options);
        active -= 1;
        return response;
      }
      return server.fetchImpl(input, options);
    });
    const { send } = createSend(fetchImpl);

    await send(fixture.item);

    expect(maxActive).toBe(1);
    const indexes = fetchImpl.mock.calls
      .filter(([, options]) => options?.method === "PUT")
      .map(([input]) => Number(requestPath(input).split("/").at(-1)));
    expect(indexes).toEqual([0, 1, 2, 0, 1]);
    const lengths = fetchImpl.mock.calls
      .filter(([, options]) => options?.method === "PUT")
      .map(([, options]) => options.body.byteLength);
    expect(lengths).toEqual([
      CONTRACT_CHUNK_BYTES,
      CONTRACT_CHUNK_BYTES,
      17,
      CONTRACT_CHUNK_BYTES,
      19,
    ]);
  });

  it("soubor nad 512 MiB odmítne před prvním HTTP požadavkem", async () => {
    const fixture = await recordingFixture();
    const handle = await open(fixture.systemPath, "r+");
    await handle.truncate(CONTRACT_MAX_BYTES + 1);
    await handle.close();
    fixture.manifest.tracks.system.sizeBytes = CONTRACT_MAX_BYTES + 1;
    await writeFile(fixture.manifestPath, JSON.stringify(fixture.manifest));
    const fetchImpl = vi.fn();
    const { send } = createSend(fetchImpl);

    await expect(send(fixture.item)).rejects.toMatchObject({
      code: "too_large",
      failureClass: "permanent",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("starší položku fronty bez kind dál odešle jako nahrávku", async () => {
    const fixture = await recordingFixture();
    delete fixture.item.kind;
    const server = createStatefulServer();
    const { send } = createSend(server.fetchImpl);

    await expect(send(fixture.item)).resolves.toMatchObject({ completedUploads: 2 });
  });

  it("stabilní klíč váže clientRecordingId, druh stopy a otisk obsahu", async () => {
    const fixture = await recordingFixture({ sameContent: true });
    const server = createStatefulServer();
    const { send } = createSend(server.fetchImpl);

    await send(fixture.item);
    await send(fixture.item);

    const initCalls = server.fetchImpl.mock.calls.filter(([input, options]) => (
      requestPath(input) === "/api/nahravky/uploads" && options.method === "POST"
    ));
    const keys = initCalls.map(([, options]) => requestHeaders(options).get("idempotency-key"));
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys.slice(2)).toEqual(keys.slice(0, 2));
    const clientIds = initCalls.map(([, options]) => JSON.parse(String(options.body)).clientRecordingId);
    expect(clientIds[0]).not.toBe(clientIds[1]);
    expect(clientIds.slice(2)).toEqual(clientIds.slice(0, 2));
  });

  it("změna clientRecordingId nebo otisku vždy změní idempotenční klíč", () => {
    const original = deriveUploadIdentity(CLIENT_RECORDING_ID, "microphone", "a".repeat(64));
    const otherRecording = deriveUploadIdentity(
      "4b439407-541e-4a41-af10-e17e233ed878",
      "microphone",
      "a".repeat(64),
    );
    const otherContent = deriveUploadIdentity(CLIENT_RECORDING_ID, "microphone", "b".repeat(64));

    expect(otherRecording.idempotencyKey).not.toBe(original.idempotencyKey);
    expect(otherContent.idempotencyKey).not.toBe(original.idempotencyKey);
  });

  it("jiný obsah téže stopy mění klíč i v odeslaném initu", async () => {
    const firstFixture = await recordingFixture();
    const secondFixture = await recordingFixture({
      microphoneBytes: Buffer.from("jiny-obsah-stejneho-mikrofonu"),
    });
    const server = createStatefulServer();
    const { send } = createSend(server.fetchImpl);

    await send(firstFixture.item);
    await send(secondFixture.item);

    const microphoneInitCalls = server.fetchImpl.mock.calls.filter(([input, options]) => {
      if (options?.method !== "POST" || requestPath(input) !== "/api/nahravky/uploads") {
        return false;
      }
      return JSON.parse(String(options.body)).title.endsWith("mikrofon");
    });
    const keys = microphoneInitCalls.map(([, options]) => (
      requestHeaders(options).get("idempotency-key")
    ));
    expect(keys).toHaveLength(2);
    expect(keys[1]).not.toBe(keys[0]);
  });
});

describe("bezpečné dokončení a diagnostika", () => {
  it("token se neposkládá do chyby ani do žádného logu", async () => {
    const fixture = await recordingFixture();
    const globalFetch = vi.fn(() => {
      throw new Error("Test sáhl na globální síť");
    });
    vi.stubGlobal("fetch", globalFetch);
    const fetchImpl = vi.fn(async (_input, options) => {
      expect(requestHeaders(options).get("authorization")).toBe(`Bearer ${TOKEN}`);
      throw new Error(`transport vypsal Authorization: Bearer ${TOKEN}`);
    });
    const { logger, send } = createSend(fetchImpl);

    const result = await processNext(
      fixture.queue,
      { DESKTOP_UPLOAD_ENABLED: "true", DESKTOP_TIME_ENABLED: undefined },
      send,
    );

    expect(result.outcome).toBe("retry_scheduled");
    expect(result.reason).not.toContain(TOKEN);
    const allLogCalls = [
      ...logger.error.mock.calls,
      ...logger.log.mock.calls,
      ...logger.warn.mock.calls,
    ];
    expect(JSON.stringify(allLogCalls)).not.toContain(TOKEN);
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it("visící HTTP požadavek skončí sanitizovaným přechodným timeoutem", async () => {
    const fixture = await recordingFixture();
    const fetchImpl = vi.fn(() => new Promise(() => {}));
    const { send } = createSend(fetchImpl, createLogger(), { requestTimeoutMs: 5 });

    await expect(send(fixture.item)).rejects.toMatchObject({
      code: "network_error",
      failureClass: "retryable",
    });
  });

  it("quotaWarning zaloguje a přesto dokončí obě stopy", async () => {
    const fixture = await recordingFixture();
    const server = createStatefulServer({ quotaWarning: true });
    const { logger, send } = createSend(server.fetchImpl);

    await expect(send(fixture.item)).resolves.toMatchObject({
      completedUploads: 2,
      quotaWarning: true,
    });

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("quotaWarning"));
    expect(server.fetchImpl.mock.calls.filter(([input, options]) => (
      options.method === "POST" && requestPath(input).endsWith("/dokoncit")
    ))).toHaveLength(2);
  });

  it("úspěšné HTTP bez potvrzeného dokončení položku neoznačí jako odeslanou", async () => {
    const fixture = await recordingFixture();
    const server = createStatefulServer();
    const fetchImpl = vi.fn(async (...args) => {
      const [input, options] = args;
      if (options?.method === "POST" && requestPath(input).endsWith("/dokoncit")) {
        return fakeResponse(200, { state: "uploading" });
      }
      return server.fetchImpl(input, options);
    });
    const { send } = createSend(fetchImpl);

    const result = await processNext(
      fixture.queue,
      { DESKTOP_UPLOAD_ENABLED: "true", DESKTOP_TIME_ENABLED: undefined },
      send,
    );

    expect(result).toMatchObject({
      outcome: "retry_scheduled",
      item: { state: QUEUE_STATES.WAITING },
    });
    await expect(readFile(fixture.microphonePath)).resolves.toBeInstanceOf(Buffer);
    await expect(readFile(fixture.systemPath)).resolves.toBeInstanceOf(Buffer);
  });

  it("samotný stav stored bez velikosti a otisku není potvrzení dokončení", async () => {
    const fixture = await recordingFixture();
    const server = createStatefulServer();
    const fetchImpl = vi.fn(async (input, options) => {
      if (options?.method === "POST" && requestPath(input).endsWith("/dokoncit")) {
        return fakeResponse(200, { state: "stored" });
      }
      return server.fetchImpl(input, options);
    });
    const { send } = createSend(fetchImpl);

    const result = await processNext(
      fixture.queue,
      { DESKTOP_UPLOAD_ENABLED: "true", DESKTOP_TIME_ENABLED: undefined },
      send,
    );

    expect(result).toMatchObject({
      outcome: "retry_scheduled",
      item: { state: QUEUE_STATES.WAITING },
    });
    await expect(readFile(fixture.microphonePath)).resolves.toBeInstanceOf(Buffer);
    await expect(readFile(fixture.systemPath)).resolves.toBeInstanceOf(Buffer);
  });

  it("jiná velikost ve finálním potvrzení je permanentní konflikt, ale soubory zůstanou", async () => {
    const fixture = await recordingFixture();
    const server = createStatefulServer();
    const fetchImpl = vi.fn(async (input, options) => {
      if (options?.method === "POST" && requestPath(input).endsWith("/dokoncit")) {
        const recordingId = requestPath(input).split("/").at(-2);
        return fakeResponse(200, {
          recordingId,
          sha256: fixture.manifest.tracks.microphone.sha256,
          sizeBytes: fixture.manifest.tracks.microphone.sizeBytes + 1,
          state: "stored",
        });
      }
      return server.fetchImpl(input, options);
    });
    const { logger, send } = createSend(fetchImpl);

    const result = await processNext(
      fixture.queue,
      { DESKTOP_UPLOAD_ENABLED: "true", DESKTOP_TIME_ENABLED: undefined },
      send,
    );

    expect(result).toMatchObject({
      outcome: "failed",
      item: { state: QUEUE_STATES.FAILED },
    });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("idempotency_conflict"));
    await expect(readFile(fixture.microphonePath)).resolves.toBeInstanceOf(Buffer);
    await expect(readFile(fixture.systemPath)).resolves.toBeInstanceOf(Buffer);
  });

  it("časovou položku nikdy nepošle na endpoint nahrávek", async () => {
    const fetchImpl = vi.fn();
    const { send } = createSend(fetchImpl);

    await expect(send({ kind: "time" })).rejects.toMatchObject({
      code: "time_upload_unavailable",
      failureClass: "paused",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
