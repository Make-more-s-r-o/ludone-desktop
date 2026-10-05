// Jen spustitelná E2E fixtura. Produkční entrypoint ji nenačítá.
const process = require("node:process");
const console = require("node:console");
const { Buffer } = require("node:buffer");
const { setInterval } = require("node:timers");
const { setTimeout: delay } = require("node:timers/promises");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const Module = require("node:module");
const { pathToFileURL, fileURLToPath } = require("node:url");
const electron = require("electron");
const project = path.resolve(process.env.LUDONE_OSA_PROJECT_ROOT || process.cwd());
const root = path.resolve(process.env.LUDONE_DATA_DIR ?? "");
const { isOsaAuthFixture } = require("./osa-auth-fixture-guard.cjs");
if (!isOsaAuthFixture({ isPackaged: electron.app.isPackaged, env: process.env })) throw new Error("Neizolovaná auth fixtura");
const mode = process.env.LUDONE_OSA_TRANSPORT_FIXTURE ?? "complete";
if (!["complete", "incomplete", "mismatch", "rate", "companies-error", "expired", "offline"].includes(mode)) throw new Error("Neznámý scénář fixtury");
const companyId = "50000000-0000-4000-8000-000000000001";
const identity = {
  v: 1, issuer: "https://app.ludone.cz", resource: "https://app.ludone.cz/api/mcp", scope: "nahravky:upload",
  clientId: "osa-public-synthetic-client", accessToken: "osa-public-fixture-not-a-valid-token",
  accessExpiresAt: Date.now() + (mode === "expired" ? -60000 : 3600000), companyTabidooId: companyId,
  identity: { name: "Syntetický účet", email: "osa-fixture@example.test" },
};
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (text) => Buffer.from("OSA_PUBLIC_FIXTURE_V1\n" + text),
  decryptString: (bytes) => {
    const text = bytes.toString("utf8");
    if (!text.startsWith("OSA_PUBLIC_FIXTURE_V1\n")) throw new Error("Fixtura odmítla cizí úložiště");
    return text.slice("OSA_PUBLIC_FIXTURE_V1\n".length);
  },
};
const calls = [];
let identityHookCount = 0;
const dialogChoices = [];
let fixturePrepared;
const fixtureReady = new Promise(resolve => { fixturePrepared = resolve; });
const media = fs.readFileSync(path.join(project, "docs/changes/desktop-v1/vzorky/dvoustopa-440hz-880hz.webm"));
const sha256 = createHash("sha256").update(media).digest("hex");
const response = (body, status = 200, headers = {}) => new globalThis.Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
async function fixtureFetch(input, options = {}) {
  const url = new globalThis.URL(typeof input === "string" ? input : input.url);
  const method = options.method ?? (typeof input === "object" ? input.method : null) ?? "GET";
  const call = { method, path: url.pathname, allowed: false };
  calls.push(call);
  if (url.origin !== identity.issuer || url.search || url.hash || url.username || url.password || method !== "GET") throw new Error("Fixtura zablokovala nepovolený transport");
  if (url.pathname === "/api/nahravky/uploads/firmy") {
    call.allowed = true;
    if (mode === "offline") throw new Error("Syntetická síť je offline");
    return mode === "companies-error" ? response({ code: "forbidden" }, 403) : response({ companies: [{ id: companyId, name: "Testovací firma · dlouhý název pro ověření kompozice a přístupu" }], defaultCompanyId: companyId });
  }
  if (/^\/api\/nahravky\/uploads\/60000000-0000-4000-8000-00000000000[12]$/u.test(url.pathname)) {
    call.allowed = true;
    if (mode === "offline") throw new Error("Syntetická síť je offline");
    if (mode === "rate") return response({ code: "rate_limited" }, 429, { "retry-after": "60" });
    return response({ state: mode === "incomplete" ? "uploading" : "stored", declaredBytes: media.length, sha256: mode === "mismatch" ? "0".repeat(64) : sha256, missing: mode === "incomplete" ? [0] : [] });
  }
  throw new Error("Fixtura odmítla nepovolenou cestu");
}
const realLoad = Module._load;
const net = new Proxy(electron.net, { get(target, key) {
  if (key === "fetch") return (input, options) => {
    if (!String(input).startsWith("file:")) return fixtureFetch(input, options);
    const file = fs.realpathSync(fileURLToPath(input));
    if (!file.startsWith(fs.realpathSync(path.join(project, "dist")) + path.sep)) throw new Error("Fixtura odmítla cizí soubor");
    return target.fetch(input, options);
  };
  if (key === "request") return () => { calls.push({ method: "net.request", path: "blocked", allowed: false }); throw new Error("Fixtura blokuje net.request"); };
  if (key === "isOnline") return () => mode !== "offline";
  return Reflect.get(target, key);
} });
const dialog = new Proxy(electron.dialog, { get(target, key) {
  if (key !== "showMessageBox") return Reflect.get(target, key);
  return async (...args) => {
    const options = args.at(-1);
    if (options.title === "Převzít nahrávku?") return { response: 1 };
    if (options.title === "Neuložené volby nahrávky") {
      const choicePath = path.join(root, ".public-close-choice");
      const text = fs.existsSync(choicePath) ? fs.readFileSync(choicePath, "utf8") : "2";
      if (!/^[012]$/.test(text)) throw new Error("Neplatná veřejná volba testového dialogu");
      const choice = Number(text);
      dialogChoices.push(choice);
      if (![0, 1, 2].includes(choice)) throw new Error("Neplatná volba testového dialogu");
      return { response: choice };
    }
    throw new Error("Fixtura odmítla neočekávaný dialog");
  };
} });
const shell = new Proxy(electron.shell, { get(target, key) {
  if (key === "openExternal") return async (url) => {
    const value = new globalThis.URL(url);
    calls.push({ method: "shell.openExternal", path: value.pathname, allowed: false });
    throw new Error("Fixtura blokuje externí aplikaci");
  };
  return Reflect.get(target, key);
} });
const app = new Proxy(electron.app, { get(target, key) {
  if (key === "whenReady") return () => fixtureReady.then(() => target.whenReady());
  const value = Reflect.get(target, key);
  return typeof value === "function" ? value.bind(target) : value;
} });
const facade = new Proxy(electron, { get(target, key) {
  if (key === "app") return app;
  if (key === "safeStorage") return safeStorage;
  if (key === "net") return net;
  if (key === "dialog") return dialog;
  if (key === "shell") return shell;
  return Reflect.get(target, key);
} });
Module._load = function(request, ...args) {
  if (request === "electron") return facade;
  const actual = realLoad.call(this, request, ...args);
  if (request === "./meeting-audio.cjs" && args[0]?.filename === path.join(project, "electron/main.cjs")) {
    return { ...actual, createLivePendingDelivery: async (...values) => {
      // Testovací bariéra pouze čeká; výsledek vždy vytvoří skutečná služba.
      const marker = path.join(root, ".public-hold-finalization");
      const deadline = Date.now() + 30000;
      while (fs.existsSync(marker)) {
        if (Date.now() > deadline) throw new Error("Testovací bariéra finalizace vypršela");
        await delay(50);
      }
      return actual.createLivePendingDelivery(...values);
    } };
  }
  return actual;
};
// Změna pouze testového kompilátoru: místo anonymního shortcutu DESIGN_E2E
// registruje tutéž produkční projekci identity nad skutečným čtecím validátorem.
// Produkční main.cjs ani jeho publikovaný entrypoint se tím nemění.
const realCompile = Module.prototype._compile;
Module.prototype._compile = function(source, filename) {
  if (filename === path.join(project, "electron/main.cjs")) {
    Module.prototype._compile = realCompile;
    identityHookCount += 1;
    const fixtureRegistration = `
      ipcMain.removeHandler("auth:identity");
      handleValidated("auth:identity", ["panel", "settings"], () => readStoredAuthIdentity());
    `;
    return realCompile.call(this, source + fixtureRegistration, filename);
  }
  return realCompile.call(this, source, filename);
};
globalThis.fetch = fixtureFetch;
const persistAudit = () => fs.writeFileSync(path.join(root, "transport-audit.json"), JSON.stringify({ syntheticTransport: true, identityHookCount, dialogChoices, calls }, null, 2));
process.on("exit", persistAudit);
setInterval(persistAudit, 100).unref();
(async () => {
  const appData = path.join(root, "app-data");
  fs.mkdirSync(appData, { recursive: true, mode: 0o700 });
  electron.app.setPath("appData", appData);
  const auth = require("../electron/auth.cjs");
  const sessionPath = auth.tokenSessionFilePath(electron.app);
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true, mode: 0o700 });
  if (!fs.existsSync(sessionPath)) fs.writeFileSync(sessionPath, safeStorage.encryptString(JSON.stringify(identity)), { mode: 0o600, flag: "wx" });
  const { createQueueOwnerSecretStore } = require("../electron/settings.cjs");
  const { deriveQueueOwnerFingerprint, createOutboundQueueStore, loadQueue, saveQueueAtomically } = require("../electron/queue.cjs");
  const userData = path.join(root, "user-data");
  fs.mkdirSync(path.join(userData, "nahravky"), { recursive: true, mode: 0o700 });
  const owner = deriveQueueOwnerFingerprint(identity, createQueueOwnerSecretStore({ filePath: path.join(userData, "nastaveni/fronta-vlastnik.json"), log: () => {} }).get());
  const queuePath = path.join(userData, "queue/outgoing.json");
  if (!fs.existsSync(queuePath)) {
    const store = createOutboundQueueStore({ filePath: queuePath, queueModulePromise: import(pathToFileURL(path.join(project, "src/lib/queue.js")).href), send: async () => { throw new Error("Upload ve fixtuře zakázán"); } });
    for (let index = 1; index <= 4; index++) {
      const id = `40000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
      const name = `osa-auth-${index}`;
      const createdAt = new Date(Date.now() - index * 3600000).toISOString();
      const endedAt = new Date(Date.parse(createdAt) + 2220).toISOString();
      const file = path.join(userData, "nahravky", name + ".webm");
      const manifestPath = path.join(userData, "nahravky", name + ".manifest.json");
      const manifest = { schemaVersion: 1, clientRecordingId: id, createdAt, closedAt: endedAt, state: "complete", tracks: { microphone: { fileName: path.basename(file), sizeBytes: media.length, sha256, startedAt: createdAt, endedAt } } };
      fs.writeFileSync(file, media, { mode: 0o600 }); fs.writeFileSync(manifestPath, JSON.stringify(manifest), { mode: 0o600 });
      await store.enqueueRecording({ manifest, manifestPath, trackPaths: { microphone: file }, ownerFingerprint: index === 3 ? null : owner, title: index === 1 ? "Dlouhá porada o skutečných stavech nahrávek a jejich bezpečném odeslání" : `Syntetická porada ${index}` });
    }
    const queue = await loadQueue(queuePath);
    for (const item of queue.items) {
      if (item.clientRecordingId.endsWith("001") || item.clientRecordingId.endsWith("002")) {
        item.state = "odeslano"; item.sentAt = new Date().toISOString();
        item.server.tracks.microphone.recordingId = "60000000-0000-4000-8000-00000000000" + (item.clientRecordingId.endsWith("001") ? "1" : "2");
      }
      if (item.clientRecordingId.endsWith("004")) fs.unlinkSync(item.tracks.microphone);
    }
    await saveQueueAtomically(queuePath, queue);
  }
  await electron.app.whenReady();
  electron.session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed = /^(?:file:|ludone:|devtools:|data:)/u.test(details.url);
    if (!allowed) calls.push({ method: details.method, path: new globalThis.URL(details.url).pathname, allowed: false, renderer: true });
    callback({ cancel: !allowed });
  });
  fixturePrepared();
})().catch(error => { console.error(error.message); electron.app.exit(1); });

// Main registruje protokol ještě před ready; jeho startup čeká na durable seed.
require("../electron/main.cjs");
