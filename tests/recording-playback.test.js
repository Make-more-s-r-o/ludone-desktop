import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import vm from "node:vm";
import queueStore from "../electron/queue.cjs";
import meetingAudio from "../electron/meeting-audio.cjs";
const { MeetingAudioError } = meetingAudio;
import { afterEach, describe, expect, it, vi } from "vitest";

const source = fs.readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
const helpers = source.slice(source.indexOf("function recordingPlaybackErrorOutcome("),
  source.indexOf("function validateRecordingUploadPreferences("));
const systemCode = source.slice(source.indexOf("function recordingExportSystemCode("),
  source.indexOf("function recordingExportFailureMessage("));
const handler = source.slice(source.indexOf('handleValidated("recordings:play"'),
  source.indexOf('// Pouze pevná lokální složka; renderer neposílá cestu ani oprávnění.'));
const roots = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function harness({ row = { outcome: "ready", label: "Místní zvuk" }, error, guards = [true], logsFail = false, resolver } = {}) {
  const root = fs.mkdtempSync(path.join(tmpdir(), "ludone-playback-"));
  roots.push(root);
  const payload = { id: "9e586e55-d688-43f1-8a80-a3d61e754f3e", queueRev: "queue", fileRev: "file" };
  const resolveRecordingAudio = resolver ?? vi.fn(async (input) => {
    if (error) throw error;
    expect(await input.guard()).toBe(true);
    return row;
  });
  const offers = new Map();
  const logger = { error: vi.fn() };
  const create = Function("fs", "path", "app", "console", "handleValidated",
    "validRecordingFileActionPayload", "recordingFileActionGuard", "getOutboundQueueStore", "playbackOffers", "randomUUID", "MeetingAudioError",
    `${systemCode}\n${helpers}\n${handler}`);
  let callback;
  let index = 0;
  create(fs, path, { getPath: () => logsFail ? path.join(root, "absent", "logs") : root }, logger,
    (_channel, _roles, value) => { callback = value; },
    (value) => value === payload, () => guards[Math.min(index++, guards.length - 1)],
    async () => ({ resolveRecordingAudio }), offers, () => "11111111-1111-4111-8111-111111111111", MeetingAudioError);
  return { invoke: (value = payload, ...extra) => callback({}, value, ...extra), resolveRecordingAudio,
    offers, payload, logger, logPath: path.join(root, "recording-playback.log") };
}

describe("IPC přehrávání a soukromý diagnostický log", () => {
  it("ready vydá nabídku a pouze bezpečnou URL", async () => {
    const test = harness();
    await expect(test.invoke()).resolves.toEqual({ outcome: "ready", label: "Místní zvuk", url: "ludone://app/media/11111111-1111-4111-8111-111111111111" });
    expect(test.offers.size).toBe(1);
    expect(fs.existsSync(test.logPath)).toBe(false);
  });
  it.each(["missing", "stale", "unconfirmed", "unknown", undefined])("outcome %s nevytvoří nabídku", async (outcome) => {
    const test = harness({ row: { outcome, label: "Tajná porada", filePath: "/tajne/porada.webm" } });
    const expected = ["missing", "stale", "unconfirmed"].includes(outcome) ? outcome : "unconfirmed";
    await expect(test.invoke()).resolves.toEqual({ outcome: expected });
    expect(test.offers.size).toBe(0);
    expect(fs.readFileSync(test.logPath, "utf8")).toMatch(new RegExp(`outcome=${expected}`));
  });
  it.each([
    ["Snímek nahrávky je neaktuální; načtěte seznam znovu", "stale"],
    ["Soubory nahrávky se během přípravy akce změnily", "stale"],
    ["Přehrávání už nelze potvrdit", "unconfirmed"],
  ])("původní očekávaná chyba resolveru: %s", async (message, outcome) => {
    const test = harness({ error: new Error(message) });
    await expect(test.invoke()).resolves.toEqual({ outcome });
    expect(fs.readFileSync(test.logPath, "utf8")).toContain(`outcome=${outcome}`);
  });
  it("guard před resolverem odmítne akci bez čtení", async () => {
    const test = harness({ guards: [false] });
    await expect(test.invoke()).resolves.toEqual({ outcome: "unconfirmed" });
    expect(test.resolveRecordingAudio).not.toHaveBeenCalled();
  });
  it("guard po resolveru nesmí vydat ready", async () => {
    const test = harness({ guards: [true, true, false] });
    await expect(test.invoke()).resolves.toEqual({ outcome: "unconfirmed" });
    expect(test.offers.size).toBe(0);
  });
  it("log má čas, třídu, kód, bezpečný text a režim 0600 bez názvu, cesty a celého ID", async () => {
    const title = "Tajná porada vedení";
    const filePath = `/Users/dan/${title}.webm`;
    const error = Object.assign(new Error(`EACCES: ${filePath}`), {
      code: "EACCES", name: title, failureClass: title, diagnostic: filePath,
    });
    const test = harness({ error });
    await expect(test.invoke()).rejects.toBe(error);
    const log = fs.readFileSync(test.logPath, "utf8");
    expect(log).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z \[recording-playback\] outcome=unconfirmed/u);
    expect(log).toContain("typ=Error; kód=EACCES; zpráva=Akci přehrávání nelze dokončit");
    for (const secret of [title, filePath, test.payload.id]) expect(log).not.toContain(secret);
    expect(fs.statSync(test.logPath).mode & 0o777).toBe(0o600);
  });
  it("chyba delivery zachová vlastní kód a třídu bez libovolného textu", async () => {
    const error = new MeetingAudioError("delivery_identity_mismatch", "Tajná porada /Users/dan/zvuk.webm", "permanent");
    const test = harness({ error });
    await expect(test.invoke()).rejects.toBe(error);
    const log = fs.readFileSync(test.logPath, "utf8");
    expect(log).toContain("typ=MeetingAudioError; kód=delivery_identity_mismatch");
    expect(log).toContain("třída=permanent");
    expect(log).not.toContain("Tajná porada");
    expect(log).not.toContain("/Users/dan");
  });
  it("cizí kód ani třída nejsou libovolný text v logu", async () => {
    const error = Object.assign(new Error("Tajná porada"), { code: "TAJNA_PORADA", name: "Tajná porada" });
    const test = harness({ error });
    await expect(test.invoke()).rejects.toBe(error);
    expect(fs.readFileSync(test.logPath, "utf8")).not.toMatch(/TAJNA_PORADA|Tajná porada/u);
  });
  it("selhání zápisu nezmění očekávaný outcome ani původní výjimku", async () => {
    await expect(harness({ row: { outcome: "missing" }, logsFail: true }).invoke()).resolves.toEqual({ outcome: "missing" });
    const error = new Error("původní chyba");
    await expect(harness({ error, logsFail: true }).invoke()).rejects.toBe(error);
  });
  it("validace payloadu a extra argumentů zůstane TypeError a zaloguje se", async () => {
    const test = harness();
    await expect(test.invoke({})).rejects.toBeInstanceOf(TypeError);
    await expect(test.invoke(test.payload, true)).rejects.toBeInstanceOf(TypeError);
    expect(test.resolveRecordingAudio).not.toHaveBeenCalled();
    expect(fs.readFileSync(test.logPath, "utf8")).toContain("typ=TypeError");
  });
});

describe("kontrakt preloadu", () => {
  it.each([
    [{ outcome: "ready", url: "ludone://app/media/11111111-1111-4111-8111-111111111111", label: "Zvuk" }, "ready"],
    [{ outcome: "ready", url: "file:///tajne.webm" }, "unconfirmed"],
    [{ outcome: "missing", url: "file:///tajne.webm" }, "missing"],
    [{ outcome: "stale" }, "stale"], [{ outcome: "unconfirmed" }, "unconfirmed"],
    [{ outcome: "unknown" }, "unconfirmed"], [null, "unconfirmed"],
  ])("předá jen uzavřený stav %s", async (result, outcome) => {
    let bridge;
    const invoke = vi.fn(async () => result);
    vm.runInNewContext(fs.readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8"), {
      process: { platform: "darwin", env: {} },
      require: () => ({ contextBridge: { exposeInMainWorld: (_name, api) => { bridge = api; } },
        ipcRenderer: { on: vi.fn(), invoke } }),
    });
    const payload = { id: "9e586e55-d688-43f1-8a80-a3d61e754f3e", queueRev: `sha256:${"a".repeat(64)}`, fileRev: `sha256:${"b".repeat(64)}` };
    const response = await bridge.playRecording(payload);
    expect(response.outcome).toBe(outcome);
    if (outcome !== "ready") expect(Object.keys(response)).toEqual(["outcome"]);
    expect(invoke).toHaveBeenCalledWith("recordings:play", payload);
  });
});

// Skutečné soubory a skutečný resolver, vždy jen pod os.tmpdir().
describe("příčiny skutečného resolveru", () => {
  it.each(["ready", "missing", "stale", "unconfirmed"])("provede %s přes produkční queue a IPC", async (outcome) => {
    const root = fs.mkdtempSync(path.join(tmpdir(), "ludone-playback-queue-"));
    roots.push(root);
    const directory = path.join(root, "nahravky");
    fs.mkdirSync(directory, { mode: 0o700 });
    const id = "9e586e55-d688-43f1-8a80-a3d61e754f3e";
    const audioPath = path.join(directory, "porada-microphone.webm");
    const manifestPath = path.join(directory, "porada.manifest.json");
    const manifest = { schemaVersion: 1, clientRecordingId: id, state: "complete",
      createdAt: "2026-10-12T10:00:00.000Z", closedAt: "2026-10-12T10:01:00.000Z",
      tracks: { microphone: { fileName: path.basename(audioPath), sizeBytes: 4, sha256: null,
        startedAt: "2026-10-12T10:00:00.000Z", endedAt: "2026-10-12T10:01:00.000Z" } } };
    fs.writeFileSync(audioPath, outcome === "missing" ? "" : "zvuk");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const store = queueStore.createOutboundQueueStore({ filePath: path.join(root, "queue", "outgoing.json"),
      queueModulePromise: import("../src/lib/queue.js"), send: vi.fn() });
    await store.enqueueRecording({ manifest, manifestPath, ownerFingerprint: `sha256:${"a".repeat(64)}`,
      trackPaths: { microphone: audioPath } });
    const row = (await store.listLocalRecordings()).items.find(value => value.id === id);
    const resolver = input => store.resolveRecordingAudio({ ...input,
      guard: outcome === "unconfirmed" ? async () => false : input.guard });
    const test = harness({ resolver });
    Object.assign(test.payload, { id, queueRev: outcome === "stale" ? `sha256:${"f".repeat(64)}` : row.revision,
      fileRev: row.fileRevision });
    expect((await test.invoke()).outcome).toBe(outcome);
    expect(fs.readFileSync(audioPath, "utf8")).toBe(outcome === "missing" ? "" : "zvuk");
    expect(fs.readFileSync(manifestPath, "utf8")).toBe(JSON.stringify(manifest));
  });
});

describe("druhé ověření při otevření audio URL", () => {
  it.each(["missing", "stale", "unconfirmed", "unknown", "exception", "expired", "range"])("zaloguje %s a zachová HTTP odpověď", async (outcome) => {
    const register = source.slice(source.indexOf("function registerAppProtocol()"), source.indexOf("function isTrustedAppUrl("));
    const logs = vi.fn();
    let callback;
    const offer = { expiresAt: outcome === "expired" ? 0 : Date.now() + 60_000, event: {}, payload: {} };
    const error = Object.assign(new Error("Tajná porada /Users/dan/zvuk.webm"), { code: "EACCES" });
    Function("protocol", "playbackOffers", "recordingFileActionGuard", "recordingAudioResponse",
      "getOutboundQueueStore", "logRecordingPlaybackFailure", "Response", `${helpers.slice(0, helpers.indexOf("function logRecordingPlaybackFailure("))}\n${register}\nregisterAppProtocol();`)(
      { handle: (_scheme, value) => { callback = value; } }, new Map([["11111111-1111-4111-8111-111111111111", offer]]),
      () => true, async (_request, resolve) => { await resolve(); return new Response(null, { status: 416 }); },
      async () => ({ resolveRecordingAudio: async () => {
        if (outcome === "exception") throw error;
        if (outcome === "stale") throw new Error("Snímek nahrávky je neaktuální; načtěte seznam znovu");
        if (outcome === "unconfirmed") throw new Error("Přehrávání už nelze potvrdit");
        return { outcome: outcome === "range" ? "ready" : outcome };
      } }), logs, Response);
    const response = await callback({ url: "ludone://app/media/11111111-1111-4111-8111-111111111111" });
    expect(response.status).toBe(outcome === "expired" ? 403 : outcome === "range" ? 416 : 409);
    expect(logs).toHaveBeenCalledOnce();
    expect(logs.mock.calls[0][0]).toBe(["missing", "stale"].includes(outcome) ? outcome : "unconfirmed");
    if (outcome === "exception") expect(logs.mock.calls[0][1]).toBe(error);
  });
});
