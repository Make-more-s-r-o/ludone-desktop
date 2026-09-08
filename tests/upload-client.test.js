import { createHash } from "node:crypto";
import { mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import queueStore from "../electron/queue.cjs";
import uploadClient from "../electron/upload-client.cjs";
import recordingExport from "../electron/recording-export.cjs";
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
  // ⚠️ Nahrávka může mít jen mikrofon — systémový zvuk nemusí být povolený. Bez téhle
  // možnosti nešlo takovou nahrávku v testech vůbec vyrobit, takže se na ni nedalo měřit.
  microphoneOnly = false,
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
      ...(microphoneOnly
        ? {}
        : { system: manifestTrack(path.basename(systemPath), actualSystemBytes) }),
    },
  };
  await writeFile(manifestPath, JSON.stringify(manifest));
  // 🔴 Jednostopou položku NESTAVÍ `enqueueRecording` ze `src/lib/queue.js` — ta obě stopy
  // vyžaduje. V provozu jde jednostopa vlastní větví produkčního storu, takže i test musí
  // jít tudy; ručně poskládaná položka by byla kopie logiky, která smí driftovat.
  const queued = microphoneOnly
    ? await queueStore.createOutboundQueueStore({
      filePath: path.join(root, "queue", "outgoing.json"),
      queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(),
    }).enqueueRecording({
      manifest,
      manifestPath,
      trackPaths: { microphone: microphonePath },
    })
    : enqueueRecording(createQueue(), {
      manifest,
      manifestPath,
      // Cesty musí odpovídat stopám v manifestu — fronta na neshodu upozorní.
      trackPaths: { microphone: microphonePath, system: systemPath },
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
  const uploadsByClientRecordingId = new Map();
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
        "declaredCaptureSources",
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
      // Kontrakt z 8. 9.: identitou je pole INITu. Shodný klíč vrací úspěch
      // s původním záznamem, i když druhý požadavek patří jiné stopě.
      let upload = uploadsByClientRecordingId.get(body.clientRecordingId);
      const idempotent = Boolean(upload);
      if (!upload) {
        upload = {
          body,
          finalized: false,
          id: serverRecordingId(sequence),
          received: new Set(),
        };
        sequence += 1;
        uploadsByClientRecordingId.set(body.clientRecordingId, upload);
        uploadsById.set(upload.id, upload);
      }
      return fakeResponse(idempotent ? 200 : 201, {
        chunkSize: CONTRACT_CHUNK_BYTES,
        idempotent,
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
  return { fetchImpl, uploadsById, uploadsByClientRecordingId };
}

describe("shodný obsah zvukových stop", () => {
  it.each([
    ["ticho", Buffer.alloc(32)],
    ["netichý obsah", Buffer.from("stejny-zvuk-v-obou-stopach")],
  ])("%s odmítne trvale před tokenem i prvním HTTP požadavkem bez úniku údajů", async (_label, bytes) => {
    const fixture = await recordingFixture({ microphoneBytes: bytes, sameContent: true });
    const server = createStatefulServer();
    const getUploadContext = vi.fn(async () => ({
      accessToken: TOKEN,
      companyTabidooId: COMPANY_ID,
      ownerFingerprint: OWNER_A,
    }));
    const { send } = createSend(server.fetchImpl, createLogger(), { getUploadContext });

    const error = await send(fixture.item).catch((error) => error);

    expect(server.fetchImpl).toHaveBeenCalledTimes(0);
    expect(getUploadContext).toHaveBeenCalledTimes(0);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      code: "identical_tracks",
      failureClass: "permanent",
      message: "Mikrofonní a systémová stopa obsahují totéž, nejspíš ticho. "
        + "Odeslání by nezachovalo dvě samostatné stopy a opakování nepomůže.",
    });
    const diagnostic = JSON.stringify(error, Object.getOwnPropertyNames(error));
    for (const track of Object.values(fixture.manifest.tracks)) {
      expect(diagnostic).not.toContain(track.sha256);
      expect(diagnostic).not.toContain(track.fileName);
    }
    for (const filePath of [fixture.microphonePath, fixture.systemPath, fixture.manifestPath]) {
      expect(diagnostic).not.toContain(filePath);
    }
  });

  it("fronta shodné stopy označí jako selhání s důvodem a další pokus nenaplánuje", async () => {
    const fixture = await recordingFixture({ sameContent: true });
    const server = createStatefulServer();
    const { send } = createSend(server.fetchImpl);
    const countedSend = vi.fn(send);
    const switches = { DESKTOP_UPLOAD_ENABLED: "true", DESKTOP_TIME_ENABLED: undefined };

    const first = await processNext(fixture.queue, switches, countedSend);
    const second = await processNext(first.queue, switches, countedSend);

    expect(first).toMatchObject({
      outcome: "failed",
      item: { attempts: 1, nextAttemptAt: null, sentAt: null, state: QUEUE_STATES.FAILED },
    });
    expect(first.reason).toContain("Mikrofonní a systémová stopa obsahují totéž");
    expect(reduceQueueForRenderer(first.queue)[0].lastFailureReason).toBe(first.reason);
    expect(second.outcome).toBe("idle");
    expect(countedSend).toHaveBeenCalledTimes(1);
    expect(server.fetchImpl).toHaveBeenCalledTimes(0);
    await expect(readFile(fixture.microphonePath)).resolves.toEqual(Buffer.from("mikrofon-webm"));
    await expect(readFile(fixture.systemPath)).resolves.toEqual(Buffer.from("mikrofon-webm"));
  });

  it("různé otisky i při stejné velikosti odešle jako dvě úplné stopy", async () => {
    const microphoneBytes = Buffer.alloc(32);
    const systemBytes = Buffer.alloc(32, 1);
    const fixture = await recordingFixture({ microphoneBytes, systemBytes });
    const server = createStatefulServer();
    const { send } = createSend(server.fetchImpl);

    await expect(send(fixture.item)).resolves.toEqual({
      completedUploads: 2,
      quotaWarning: false,
      uploads: [
        { quotaWarning: false, recordingId: serverRecordingId(1), track: "microphone" },
        { quotaWarning: false, recordingId: serverRecordingId(2), track: "system" },
      ],
    });
    expect(server.fetchImpl).toHaveBeenCalledTimes(8);
    expect([...server.uploadsById.values()].map((upload) => upload.finalized)).toEqual([true, true]);
    const uploadedBytes = server.fetchImpl.mock.calls
      .filter(([, options]) => options.method === "PUT")
      .map(([, options]) => options.body);
    expect(uploadedBytes).toEqual([microphoneBytes, systemBytes]);
  });
});

describe("kontrakt INITu nativní a prohlížečové cesty", () => {
  // ⚠️ Případ „totožný obsah stop" tady BYL, ale k INITu se už nedostane: shodné otisky
  // odmítne `identical_tracks` dřív, než padne první požadavek — jinak by server obě stopy
  // sloučil podle dvojice (uživatel, otisk) a druhou fyzicky smazal. Odmítnutí měří vlastní
  // sada „shodný obsah zvukových stop"; duplikovat ho sem by zakrylo, kde se to rozhoduje.
  it.each([
    ["různý obsah stop", false],
  ])("%s: dvě stopy nemají shodný clientRecordingId ani při opakování", async (
    _label, sameContent,
  ) => {
    const fixture = await recordingFixture({ sameContent });
    const server = createStatefulServer();
    const { send } = createSend(server.fetchImpl);

    const first = await send(fixture.item);
    // Nová instance klienta simuluje další pokus po restartu aplikace.
    const retried = await createSend(server.fetchImpl).send(fixture.item);

    expect(first.completedUploads).toBe(2);
    expect(first.uploads[0].recordingId).not.toBe(first.uploads[1].recordingId);
    expect(retried.uploads).toEqual(first.uploads);
    expect(server.uploadsByClientRecordingId.size).toBe(2);
    const initCalls = server.fetchImpl.mock.calls.filter(([input, options]) => (
      requestPath(input) === "/api/nahravky/uploads" && options.method === "POST"
    ));
    expect(initCalls).toHaveLength(4);
    const payloads = initCalls.map(([, options]) => JSON.parse(String(options.body)));
    const clientIds = payloads.map((body) => body.clientRecordingId);
    expect(clientIds[0]).not.toBe(clientIds[1]);
    expect(clientIds.slice(0, 2)).toEqual([
      `${fixture.manifest.clientRecordingId}:microphone`,
      `${fixture.manifest.clientRecordingId}:system`,
    ]);
    expect(clientIds.slice(2)).toEqual(clientIds.slice(0, 2));

    const browserUrl = new URL(recordingExport.buildRecordingUploadUrl(
      ORIGIN,
      { clientRecordingId: fixture.manifest.clientRecordingId },
      fixture.manifest,
    ));
    expect(browserUrl.searchParams.has("declaredCaptureSources")).toBe(true);
    for (const body of payloads) {
      expect(body.declaredCaptureSources).toBe(
        browserUrl.searchParams.get("declaredCaptureSources"),
      );
    }
  });
});

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

  // Tři různé stavy pod jedním statusem. Kdyby o třídě rozhodoval status, jedna z nich by
  // pokaždé dopadla špatně — proto se čte `retryable` z těla, ne číslo odpovědi.
  it.each([
    ["vypnuté úložiště čeká na člověka",
      { code: "storage_disabled" }, "storage_disabled", "paused"],
    ["přechodná chyba úložiště se opakuje",
      { code: "storage_failed", retryable: true }, "storage_failed", "retryable"],
    ["nedostupný registr firem se opakuje",
      { code: "scope_unavailable", retryable: true }, "scope_unavailable", "retryable"],
    ["neznámý důvod je fail-closed",
      { code: "neznamy_duvod" }, "neznamy_duvod", "paused"],
    ["samotné `retryable: false` nestačí k opakování",
      { code: "storage_failed", retryable: false }, "storage_failed", "paused"],
    // Bez kódu nemluví aplikace, ale nejspíš proxy před ní — takový výpadek je přechodný.
    // Klient si pak dosadí vlastní neutrální jméno.
    ["tělo bez kódu je přechodný výpadek, ne rozhodnutí aplikace",
      {}, "upload_failed", "retryable"],
  ])("HTTP 503: %s", async (_label, payload, code, failureClass) => {
    const fixture = await recordingFixture();
    const { send } = createSend(vi.fn(async () => fakeResponse(503, payload)));

    await expect(send(fixture.item)).rejects.toMatchObject({ code, failureClass, status: 503 });
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
    // 🔴 Tělo musí odpovídat tomu, co server SKUTEČNĚ posílá. Změřeno serverovou session
    // 9. 9. 2026: `storage_failed` nese `retryable: true`, a právě z toho příznaku se
    // přechodnost čte. Dřívější fixtura ho vynechávala, takže test tvrdil, že přechodnost
    // plyne ze samotného jména kódu — a to je vlastnost, kterou server nikdy nesliboval.
    const body = code === "storage_failed" ? { code, retryable: true } : { code };
    const { send } = createSend(vi.fn(async () => fakeResponse(status, body)));

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
    const fixture = await recordingFixture();
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

  it("stejný otisk odliší v identitě podle druhu stopy", () => {
    const hash = sha256(Buffer.from("stejny-obsah"));
    const microphone = deriveUploadIdentity(CLIENT_RECORDING_ID, "microphone", hash);
    const system = deriveUploadIdentity(CLIENT_RECORDING_ID, "system", hash);

    expect(microphone.idempotencyKey).not.toBe(system.idempotencyKey);
    expect(microphone.clientRecordingId).not.toBe(system.clientRecordingId);
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

  it("jiný obsah téže stopy mění hlavičku, ale zachová clientRecordingId a odhalí rozpor", async () => {
    const firstFixture = await recordingFixture();
    const secondFixture = await recordingFixture({
      microphoneBytes: Buffer.from("jiny-obsah-stejneho-mikrofonu"),
    });
    const server = createStatefulServer();
    const { send } = createSend(server.fetchImpl);

    await send(firstFixture.item);
    await expect(send(secondFixture.item)).rejects.toMatchObject({
      code: "idempotency_conflict",
      failureClass: "permanent",
    });

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
    const bodies = microphoneInitCalls.map(([, options]) => JSON.parse(String(options.body)));
    expect(bodies[1].clientRecordingId).toBe(bodies[0].clientRecordingId);
    expect(server.uploadsByClientRecordingId.size).toBe(2);
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

describe("záchytná síť proti záměně nahrávky", () => {
  // 🔴 Server při dokončení hledá duplikát podle dvojice (uživatel, otisk). Když ho najde,
  // TUHLE stopu označí za smazanou, její soubor FYZICKY SMAŽE a vrátí 200 se stavem
  // `stored` a `recordingId` TÉ CIZÍ. Doloženo serverovou session 8. 9. 2026 v jejím kódu.
  // `verifyRemoteIdentity` to nechytí — porovnává velikost a otisk, a ty u kolize SEDÍ.
  // Jediné, co se rozejde, je identifikátor, a právě ten tenhle test hlídá.
  it("odmítne dokončení, které vrátí cizí recordingId", async () => {
    const fixture = await recordingFixture({});
    const server = createStatefulServer();
    const CIZI = "11111111-2222-4333-8444-555555555555";
    const fetchImpl = vi.fn(async (url, options) => {
      const response = await server.fetchImpl(url, options);
      if (!requestPath(url).endsWith("/dokoncit")) return response;
      const telo = await response.json();
      return fakeResponse(200, { ...telo, recordingId: CIZI });
    });
    const { send } = createSend(fetchImpl);

    const error = await send(fixture.item).catch((error) => error);

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ code: "recording_replaced", failureClass: "permanent" });
    // Musí to přijít AŽ po dokončení — dřív o záměně vědět nemůžeme.
    expect(fetchImpl.mock.calls.some(([url]) => requestPath(url).endsWith("/dokoncit"))).toBe(true);
  });

  // 🔴 Porovnání otisků obou stop nesmí sáhnout na druhou stopu, když neexistuje.
  // Bez podmínky na počet stop by tady spadlo čtení `tracks[1].sha256`.
  it("jednostopá nahrávka projde a nespadne na chybějící druhé stopě", async () => {
    const fixture = await recordingFixture({ microphoneOnly: true });
    const server = createStatefulServer();
    const { send } = createSend(server.fetchImpl);

    await expect(send(fixture.item)).resolves.toBeDefined();
  });

  it("shodné recordingId nechá upload projít beze změny", async () => {
    const fixture = await recordingFixture({});
    const server = createStatefulServer();
    const { send } = createSend(server.fetchImpl);

    await expect(send(fixture.item)).resolves.toBeDefined();
  });
});
