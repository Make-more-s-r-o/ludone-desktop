import { createRequire } from "node:module";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { createQueue, enqueueRecording, processNext, reduceQueueForRenderer } from "../src/lib/queue.js";
import { recordingDeliveryStatus } from "../src/lib/recording-delivery-status.js";

const require = createRequire(import.meta.url);
const { createLocalRecordingsSnapshot } = require("../electron/recordings-dashboard.cjs");
const { createOutboundQueueStore, saveQueueAtomically } = require("../electron/queue.cjs");
const { RecordingUploadError, failureClassForStatus } = require("../electron/upload-client.cjs");
const id = "9e586e55-d688-43f1-8a80-a3d61e754f3e";
const owner = `sha256:${"d".repeat(64)}`;
const revision = `sha256:${"a".repeat(64)}`;

async function withRecording(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ludone-actions-"));
  const recordingsDirectory = path.join(root, "nahravky");
  const manifestPath = path.join(recordingsDirectory, "meeting.manifest.json");
  const audio = path.join(recordingsDirectory, "meeting.webm");
  const system = path.join(recordingsDirectory, "system.webm");
  const manifest = { schemaVersion: 1, clientRecordingId: id, state: "complete",
    createdAt: "2026-09-14T10:00:00.000Z", closedAt: "2026-09-14T10:00:01.000Z",
    tracks: { microphone: { fileName: "meeting.webm", sha256: "a".repeat(64), sizeBytes: 8,
      startedAt: "2026-09-14T10:00:00.000Z", endedAt: "2026-09-14T10:00:01.000Z" },
    system: { fileName: "system.webm", sha256: "b".repeat(64), sizeBytes: 6,
      startedAt: "2026-09-14T10:00:00.000Z", endedAt: "2026-09-14T10:00:01.000Z" } } };
  try {
    await mkdir(recordingsDirectory);
    await writeFile(manifestPath, JSON.stringify(manifest));
    await writeFile(audio, "mikrofon");
    await writeFile(system, "system");
    const queue = enqueueRecording(createQueue(), { manifest, manifestPath, trackPaths: { microphone: audio, system } }).queue;
    queue.items[0] = { ...queue.items[0], ownerFingerprint: owner, uploadIntent: "approved" };
    const project = async (value, extra = {}) => (await createLocalRecordingsSnapshot({ queue: value,
      queueItems: reduceQueueForRenderer(value, owner).map(item => ({ ...item, revision })),
      recordingsDirectory, ...extra })).items[0];
    await run({ queue, project, audio, root });
  } finally { await rm(root, { recursive: true, force: true }); }
}

it.each([false, true])("HTTP 503 storage_failed s retryable=%s projde frontou i projekcí", async retryable => {
  await withRecording(async ({ queue, project }) => {
    const payload = { code: "storage_failed", retryable };
    const error = new RecordingUploadError("storage_failed (HTTP 503)", { code: payload.code, status: 503,
      failureClass: failureClassForStatus(503, payload.code, payload) });
    const actual = await processNext(queue, { DESKTOP_UPLOAD_ENABLED: "true" }, async () => { throw error; },
      { currentOwnerFingerprint: owner, now: Date.now(), random: () => 0 });
    const item = await project(actual.queue);
    if (retryable) {
      expect(actual.outcome).toBe("retry_scheduled");
      expect(recordingDeliveryStatus(item).label).toContain("další pokus v");
      expect(item.actions.retry.allowed).toBe(false);
    } else {
      expect(actual.outcome).toBe("paused");
      expect(item.blockReason).toBe("Odeslání je pozastavené — důvod nezjištěn.");
      expect(recordingDeliveryStatus(item).label).toContain("důvod nezjištěn");
      expect(item.actions.retry.allowed).toBe(true);
    }
  });
});

it("limit účtu je ve všech akcích a viditelný i při automatickém čekání", async () => {
  await withRecording(async ({ queue, project }) => {
    const retryAt = Date.now() + 120_000;
    const item = await project({ ...queue, uploadCooldowns: [{ ownerFingerprint: owner, retryAt }] });
    expect(item.actions.send).toMatchObject({ allowed: false, retryAt });
    expect(item.actions.retry).toMatchObject({ allowed: false, retryAt });
    expect(recordingDeliveryStatus(item).label).toContain(new Intl.DateTimeFormat("cs-CZ", {
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(retryAt)));
  });
});

it("skutečné HTTP 429 ve frontě ukáže čas i po novém snímku s důvodem selhání", async () => {
  await withRecording(async ({ queue, project }) => {
    const now = Date.now();
    const actual = await processNext(queue, { DESKTOP_UPLOAD_ENABLED: "true" }, async () => {
      throw new RecordingUploadError("rate_limited (HTTP 429)", { code: "rate_limited", status: 429, retryAfterMs: 120_000 });
    }, { currentOwnerFingerprint: owner, now });
    expect(actual.outcome).toBe("rate_limited");
    expect(actual.item.lastFailureReason).toContain("429");
    const item = await project({ ...actual.queue, uploadCooldowns: [{ ownerFingerprint: owner, retryAt: actual.retryAt }] });
    expect(item.actions.retry.allowed).toBe(false);
    const clock = new Intl.DateTimeFormat("cs-CZ", { hour: "2-digit", minute: "2-digit" }).format(new Date(actual.retryAt));
    expect(recordingDeliveryStatus(item).label).toContain(clock);
  });
});

it.each([true, false])("projekce a skutečná akce se shodnou při shodě připnuté firmy: %s", async matches => {
  await withRecording(async ({ queue, project, root }) => {
    const pinned = "11111111-1111-4111-8111-111111111111";
    const current = matches ? pinned : "33333333-3333-4333-8333-333333333333";
    queue.items[0] = { ...queue.items[0], state: "selhalo", lastFailureReason: "company_out_of_scope (HTTP 403)",
      uploadPreferences: { companyId: null, visibility: "private" },
      server: { ...queue.items[0].server, companyTabidooId: pinned, sessionId: "22222222-2222-4222-8222-222222222222" } };
    const projected = await project(queue, { currentCompanyId: current });
    expect(projected.actions.retry.allowed).toBe(matches);
    const queuePath = path.join(root, "fronta", "queue.json");
    await mkdir(path.dirname(queuePath));
    await saveQueueAtomically(queuePath, queue);
    const send = vi.fn(async () => {});
    const store = createOutboundQueueStore({ filePath: queuePath, queueModulePromise: import("../src/lib/queue.js"), send });
    const actual = (await store.listLocalRecordings(owner)).items[0];
    const result = store.actOnRecording({ clientRecordingId: id, expectedRevision: actual.revision,
      expectedFileRevision: actual.fileRevision, currentOwnerFingerprint: owner, mode: "retry",
      killswitches: { DESKTOP_UPLOAD_ENABLED: "true" }, guard: async () => true, getCurrentCompany: async () => current });
    if (matches) {
      await expect(result).resolves.toMatchObject({ outcome: "sent" });
      expect(send).toHaveBeenCalledOnce();
    } else {
      await expect(result).rejects.toThrow(/Inicializovanou nahrávku/u);
      expect(send).not.toHaveBeenCalled();
    }
  });
});

it("při neznámé současné firmě po 403 nepovolí opakování", async () => {
  await withRecording(async ({ queue, project }) => {
    queue.items[0] = { ...queue.items[0], state: "selhalo", lastFailureReason: "company_out_of_scope (HTTP 403)",
      server: { ...queue.items[0].server, companyTabidooId: "11111111-1111-4111-8111-111111111111",
        sessionId: "22222222-2222-4222-8222-222222222222" } };
    const item = await project(queue);
    expect(item.actions.retry.allowed).toBe(false);
    expect(item.actions.retry.reason).toMatch(/firm/u);
  });
});

it("převzetí bez informace o přihlášené identitě zůstává bezpečně nepovolené", async () => {
  await withRecording(async ({ queue, project }) => {
    queue.items[0] = { ...queue.items[0], ownerFingerprint: null, requiresHumanAction: true };
    const item = await project(queue);
    expect(item.ownership).toBe("unknown");
    expect(item.actions.claim).toMatchObject({ allowed: false, reason: expect.stringContaining("nelze") });
    expect(item.allowedActions.claim).toBe(false);
  });
});

it("prezentační stav respektuje pouze rozhodnutí actions hlavního procesu", () => {
  const item = { state: "selhalo", ownership: "current", uploadIntent: "approved", localState: "complete-audio",
    blockReason: "unauthorized", allowedActions: { retry: true },
    actions: { retry: { allowed: false, reason: "Zvukové soubory chybí." } } };
  expect(recordingDeliveryStatus(item).action).toBeNull();
  expect(recordingDeliveryStatus(item).disabledReason).toBe("Zvukové soubory chybí.");
});

// Danova „klárka“ (#201): jediná nahrávka s neznámým vlastníkem ve frontě. Přihlášení zná main výslovně,
// projekce ho nesmí odhadovat z ostatních položek — jinak by převzetí u jediné položky zmizelo.
it.each([[owner, true], [null, false]])("převzetí jediné nahrávky bez vlastníka přes skutečnou frontu (přihlášen=%s)", async (current, allowed) => {
  await withRecording(async ({ queue, root }) => {
    queue.items[0] = { ...queue.items[0], ownerFingerprint: null, uploadIntent: "approved", requiresHumanAction: true };
    const queuePath = path.join(root, "fronta", "queue.json");
    await mkdir(path.dirname(queuePath));
    await saveQueueAtomically(queuePath, queue);
    const store = createOutboundQueueStore({ filePath: queuePath, queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(async () => {}) });
    const item = (await store.listLocalRecordings(current)).items[0];
    expect(item.ownership).toBe("unknown");
    expect(item.actions.claim.allowed).toBe(allowed);
    expect(item.allowedActions.claim).toBe(allowed);
  });
});

it("firma předaná z mainu dojde přes skutečnou frontu až k rozhodnutí o opakování po 403", async () => {
  await withRecording(async ({ queue, root }) => {
    const pinned = "11111111-1111-4111-8111-111111111111";
    queue.items[0] = { ...queue.items[0], state: "selhalo", lastFailureReason: "company_out_of_scope (HTTP 403)",
      uploadPreferences: { companyId: null, visibility: "private" },
      server: { ...queue.items[0].server, companyTabidooId: pinned, sessionId: "22222222-2222-4222-8222-222222222222" } };
    const queuePath = path.join(root, "fronta", "queue.json");
    await mkdir(path.dirname(queuePath));
    await saveQueueAtomically(queuePath, queue);
    const store = createOutboundQueueStore({ filePath: queuePath, queueModulePromise: import("../src/lib/queue.js"),
      send: vi.fn(async () => {}) });
    expect((await store.listLocalRecordings(owner, { currentCompanyId: pinned })).items[0].actions.retry.allowed).toBe(true);
    expect((await store.listLocalRecordings(owner)).items[0].actions.retry.allowed).toBe(false);
  });
});

it("pauza s prošlým termínem opakování zachová důvod a povolí ruční opakování (review k4)", async () => {
  await withRecording(async ({ queue, project }) => {
    queue.items[0] = { ...queue.items[0], state: "ceka", uploadIntent: "approved", requiresHumanAction: false,
      lastFailureReason: "storage_failed (HTTP 503)", nextAttemptAt: Date.now() - 60_000 };
    const item = await project(queue);
    expect(item.blockReason).toBeTruthy();
    expect(item.actions.retry.allowed).toBe(true);
    expect(recordingDeliveryStatus(item).tone).toBe("attention");
  });
});

it("HTTP 429 bez kódu v těle se v projekci ukáže jako známý limit (review k5)", async () => {
  await withRecording(async ({ queue, project }) => {
    queue.items[0] = { ...queue.items[0], state: "ceka", uploadIntent: "approved", requiresHumanAction: false,
      lastFailureReason: "upload_failed (HTTP 429)", nextAttemptAt: null };
    const item = await project(queue);
    expect(item.blockReason).toBe("Server dočasně omezil odesílání.");
    expect(recordingDeliveryStatus(item).label).not.toContain("důvod nezjištěn");
  });
});
