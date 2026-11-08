import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, expect, it, vi } from "vitest";
import { createManifest } from "../src/lib/manifest.js";
import * as queueModule from "../src/lib/queue.js";
import queueStore from "../electron/queue.cjs";

const DAY_MS = 24 * 60 * 60 * 1000;
const roots = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

// Spouštíme doslovné produkční funkce, nikoli kopii jejich rozhodování.
// Skutečný store a retence mažou skutečné dočasné soubory.
const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
function productionFunction(name) {
  const declaration = mainSource.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^}`, "m"));
  if (!declaration) throw new Error(`Chybí produkční funkce ${name}`);
  return declaration[0];
}

async function writeOldSentRecording(userDataPath) {
  const queuePath = path.join(userDataPath, "queue", "outgoing.json");
  const recordingsPath = path.join(userDataPath, "nahravky");
  const microphonePath = path.join(recordingsPath, "stara-mikrofon.webm");
  const systemPath = path.join(recordingsPath, "stara-system.webm");
  const manifestPath = path.join(recordingsPath, "stara.manifest.json");
  const clientRecordingId = "8241f325-a970-4f36-a2e4-9b7812e4ae24";
  const startedAt = new Date(Date.now() - 9 * DAY_MS).toISOString();
  const endedAt = new Date(Date.now() - 8 * DAY_MS).toISOString();
  const microphoneBytes = Buffer.from("mikrofon");
  const systemBytes = Buffer.from("system");
  const manifest = createManifest({
    clientRecordingId,
    createdAt: startedAt,
    closedAt: endedAt,
    tracks: {
      microphone: {
        fileName: path.basename(microphonePath),
        startedAt,
        endedAt,
        sizeBytes: microphoneBytes.byteLength,
        sha256: createHash("sha256").update(microphoneBytes).digest("hex"),
      },
      system: {
        fileName: path.basename(systemPath),
        startedAt,
        endedAt,
        sizeBytes: systemBytes.byteLength,
        sha256: createHash("sha256").update(systemBytes).digest("hex"),
      },
    },
  }, "complete");
  await mkdir(path.dirname(queuePath), { recursive: true });
  await mkdir(recordingsPath, { recursive: true });
  await Promise.all([
    writeFile(microphonePath, microphoneBytes),
    writeFile(systemPath, systemBytes),
    writeFile(manifestPath, JSON.stringify(manifest)),
  ]);
  await writeFile(queuePath, JSON.stringify({
    schemaVersion: 1,
    items: [{
      attempts: 1,
      clientRecordingId,
      enqueuedAt: new Date(Date.now() - 9 * DAY_MS).toISOString(),
      kind: "recording",
      lastFailureReason: null,
      manifestPath,
      nextAttemptAt: null,
      sentAt: new Date(Date.now() - 8 * DAY_MS).toISOString(),
      server: {
        recordingId: "server-recording",
        uploadedBytes: { microphone: 8, system: 6 },
      },
      state: "odeslano",
      tracks: { microphone: microphonePath, system: systemPath },
    }],
  }));
  return { microphonePath, queuePath, systemPath };
}

it.each([
  "recordingOwnersPreparing", "recordingSessions", "recordingCompletionsInFlight",
  "recordingExportStages", "outboundQueueSendsInFlight",
])("průběžný úklid přes main chrání %s a po uvolnění uklidí stejné soubory #179", async operation => {
  const userDataPath = await mkdtemp(path.join(tmpdir(), "desktop-179-guard-"));
  roots.push(userDataPath);
  const fixture = await writeOldSentRecording(userDataPath);
  const store = queueStore.createOutboundQueueStore({
    filePath: fixture.queuePath,
    queueModulePromise: Promise.resolve(queueModule),
    send: async () => {},
  });
  const state = {
    recordingOwnersPreparing: new Map(),
    recordingSessions: new Map(),
    recordingCompletionsInFlight: new Set(),
    recordingExportStages: new Map(),
    outboundQueueSendsInFlight: 0,
    getOutboundQueueStore: async () => store,
    retentionSettingsStore: { get: () => "Ihned smazat" },
    notifyRecordingStorageChanged: vi.fn(),
  };
  if (operation === "outboundQueueSendsInFlight") state.outboundQueueSendsInFlight = 1;
  else if (operation === "recordingCompletionsInFlight") state.recordingCompletionsInFlight.add("aktivní");
  else state[operation].set("aktivní", {});
  const retain = runInNewContext([
    productionFunction("retentionFilesIdle"),
    productionFunction("retainOutboundRecordings"),
    "retainOutboundRecordings;",
  ].join("\n"), state);

  const blocked = await retain();
  expect(blocked.deletedFiles).toEqual([]);
  expect(blocked.deletedItems).toEqual([]);
  expect(existsSync(fixture.microphonePath)).toBe(true);
  expect(existsSync(fixture.systemPath)).toBe(true);
  expect(JSON.parse(readFileSync(fixture.queuePath, "utf8")).items).toHaveLength(1);

  if (operation === "outboundQueueSendsInFlight") state.outboundQueueSendsInFlight = 0;
  else state[operation].clear();
  const cleaned = await retain();
  expect(cleaned.errors).toEqual([]);
  expect(cleaned.deletedItems).toHaveLength(1);
  expect(existsSync(fixture.microphonePath)).toBe(false);
  expect(existsSync(fixture.systemPath)).toBe(false);
  expect(state.notifyRecordingStorageChanged).toHaveBeenCalledTimes(2);
});
