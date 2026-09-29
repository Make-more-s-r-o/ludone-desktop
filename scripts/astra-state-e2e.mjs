import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { stateAcceptanceExitCode } from "./astra-state-acceptance.mjs";

// Samostatný renderer bez produkčního preloadu, tokenů a IPC. Neověřuje backend.
const require = createRequire(import.meta.url);
const script = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(script), "..");
const output = process.versions.electron ? process.argv[2] : path.join(root, ".runtime", "astra-state-e2e", new Date().toISOString().replaceAll(":", "-"));
if (!process.versions.electron) {
  await mkdir(output, { recursive: true });
  const child = spawn(require("electron"), [path.join(root, "scripts/astra-state-e2e-bootstrap.cjs"), output], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, DESKTOP_UPLOAD_ENABLED: "false" },
  });
  let log = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => {
    log += chunk.toString();
    process.stdout.write(chunk);
  });
  const timer = setTimeout(() => child.kill("SIGTERM"), 120_000);
  let code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  clearTimeout(timer);
  await writeFile(path.join(output, "command.log"), `node scripts/astra-state-e2e.mjs\n${log}\nexit_code=${code}\n`);
  try { await access(path.join(output, "report.json")); } catch {
    code = code || 1;
    await writeFile(path.join(output, "report.json"), JSON.stringify({ status: "FAIL", exitCode: code || 1, fixtureOnly: true, results: [], error: "Electron harness nevytvořil report; žádný scénář není ověřený." }, null, 2));
  }
  process.exit(code);
}
async function runElectron() {
console.log("START isolated bundled renderer fixtures");
const { app, BrowserWindow } = require("electron");

const runOutput = process.argv[2];
if (!app.isReady()) throw new Error("Test musí spustit CJS bootstrap po Electron ready");
console.log("READY Electron");
const results = [];
let networkAttempts = 0;
let index = 0;

// Vkládá se přes CDP před načtením Reactu. Veškeré metody jsou lokální fixture.
function installFixture(window, scenario) {
  const id = "40000000-0000-4000-8000-000000000001";
  const revision = `sha256:${"a".repeat(64)}`;
  const calls = [];
  const listeners = {};
  const state = { auth: scenario.auth ?? "valid", mode: scenario.mode, calls, verification: scenario.verification ?? "complete" };
  const pending = () => new Promise(() => {});
  const observe = (name) => (fn) => { listeners[name] = fn; return () => { delete listeners[name]; }; };
  const item = {
    kind: "recording", id, revision, fileRevision: revision,
    title: "Izolovaná E2E nahrávka", createdAt: new Date().toISOString(), durationMs: 2000, sizeBytes: 1024,
    uploadIntent: "held", state: "ceka", ownership: "current", source: "queue", localState: "complete-audio",
    allowedActions: { send: true, retry: false, claim: false, delete: false },
  };
  if (scenario.kind === "queued") { item.uploadIntent = "approved"; item.allowedActions.send = false; }
  if (["sent", "verified", "limit", "verify-error"].includes(scenario.kind)) {
    item.state = "odeslano"; item.uploadIntent = "approved"; item.allowedActions.send = false;
  }
  if (scenario.kind === "error") {
    item.state = "selhalo"; item.blockReason = "Síť je nedostupná. Zkus odeslání znovu.";
    item.allowedActions.send = false; item.allowedActions.retry = true;
  }
  if (scenario.kind === "owner") {
    item.ownership = "other"; item.blockReason = "Nahrávka patří jinému účtu.";
    item.allowedActions.send = false; item.allowedActions.claim = true;
  }
  if (scenario.kind === "missing") {
    item.localState = "missing-audio"; item.localReason = "Místní zvukový soubor chybí.";
    item.allowedActions.send = false;
  }
  state.item = item;
  state.update = { revision: 1, availableVersion: null, downloadedVersion: null, downloading: false,
    installRequested: false, installDeferred: false, ...scenario.update };
  window.localStorage.setItem("ludone.prototype.onboarding-complete", "true");
  window.__astraFixture = state;
  const action = (name) => async (value) => { calls.push({ name, value }); return { outcome: "fixture_only" }; };
  window.ludone = Object.freeze({
    runtime: Object.freeze({ resetOnboarding: false, designE2E: scenario.designE2E !== false }),
    getAuthSessionState: async () => state.auth,
    getAuthIdentity: async () => state.auth === "valid" ? { name: "E2E Fixture", email: "fixture@example.invalid" } : null,
    getAuthOrigin: async () => "https://app.ludone.cz", getDeviceName: async () => "Izolovaný E2E Mac",
    getDockVisible: async () => false, getOpenAtLogin: async () => false, getUploadEnabled: async () => false,
    getPermissionStatus: async () => "denied", listQueue: async () => [],
    listLocalRecordings: async () => {
      calls.push({ name: "listLocalRecordings" });
      if (state.mode === "loading") return pending();
      if (state.mode === "error") throw new Error("Izolovaná chyba seznamu");
      return { items: state.mode === "empty" ? [] : [item], unreadableCount: 0 };
    },
    verifyRecording: async (recordingId, expectedRevision) => {
      calls.push({ name: "verifyRecording", recordingId, expectedRevision });
      if (state.verification === "throw") throw new Error("Izolovaná chyba ověření");
      return { id, revision, verifiedAt: new Date().toISOString(), tracks: { delivery: { status: state.verification, mismatchFields: [] } } };
    },
    sendRecording: action("sendRecording"), retryRecording: action("retryRecording"),
    revealRecording: action("revealRecording"),
    claimRecording: async (recordingId, expectedRevision) => { calls.push({ name: "claimRecording", recordingId, expectedRevision }); return { claimed: false }; },
    openRecordingInLuDone: action("openRecordingInLuDone"),
    onAuthSessionChanged: observe("auth"), onUpdateStatusChanged: observe("update"),
    reportTrayFacts: () => {}, setPanelContentHeight: () => {},
    beginAuth: () => { calls.push({ name: "beginAuth" }); return pending(); },
    cancelAuth: async () => { calls.push({ name: "cancelAuth" }); }, pendingAuthUrl: async () => null,
    getUpdateStatus: async () => state.update,
    installUpdate: async (version) => {
      calls.push({ name: "installUpdate", version });
      state.update = { ...state.update, revision: 2, installRequested: true };
      return state.update;
    },
    deferUpdate: async () => { state.update = { ...state.update, revision: 2, installDeferred: true }; return state.update; },
  });
}

async function bounded(promise, label, milliseconds = 10000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timeout ${label}`)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}

async function scenario(name, fixture, check, panel = false) {
  let win;
  const row = { name, status: "FAIL", fixtureOnly: true };
  try {
    console.log(`BEGIN ${name}`);
    win = new BrowserWindow({ show: false, width: panel ? 400 : 640, height: panel ? 700 : 744,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false, partition: `astra-fixture-${++index}` } });
    win.webContents.session.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }, (_request, callback) => {
      networkAttempts += 1;
      callback({ cancel: true });
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    // První prázdná navigace založí renderer; CDP před ní nemá živý target.
    await bounded(win.loadURL("about:blank"), `${name}: initialize renderer`);
    console.log(`TARGET ${name}`);
    win.webContents.debugger.attach("1.3");
    await bounded(win.webContents.debugger.sendCommand("Page.enable"), `${name}: CDP Page.enable`);
    console.log(`CDP ${name}`);
    await bounded(win.webContents.debugger.sendCommand("Page.addScriptToEvaluateOnNewDocument", {
      source: `(${installFixture.toString()})(window, ${JSON.stringify(fixture)})`,
    }), `${name}: CDP fixture injection`);
    const evaluate = (source) => bounded(win.webContents.executeJavaScript(source), `${name}: executeJavaScript`, 6000);
    const wait = async (source) => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) { if (await evaluate(source)) return; await delay(50); }
      throw new Error(`Stav se neobjevil: ${source}`);
    };
    const click = async (selector) => {
      const ok = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e || e.disabled) return false; e.click(); return true; })()`);
      if (!ok) throw new Error(`Akce není dostupná: ${selector}`);
    };
    await bounded(win.loadFile(path.join(root, "dist/index.html"), panel ? {} : { query: { settingsTab: "day" }, hash: "settings" }), `${name}: loadFile`);
    console.log(`LOADED ${name}`);
    await wait("Boolean(document.querySelector('#root')?.textContent.trim())");
    await check({ evaluate, wait, click });
    row.status = "PASS";
    row.calls = await evaluate("window.__astraFixture.calls");
  } catch (error) { row.error = error.message; }
  finally {
    if (win && !win.isDestroyed()) {
      try {
        const image = await bounded(win.webContents.capturePage(), `${name}: capturePage`, 3000);
        if (image.isEmpty()) { row.status = "FAIL"; row.screenshotError = "Prázdný screenshot"; }
        row.screenshot = path.join(runOutput, `${name}.png`);
        await writeFile(row.screenshot, image.toPNG());
      } catch (error) { row.status = "FAIL"; row.screenshotError = error.message; }
      win.destroy();
    }
    results.push(row);
    console.log(`${row.status} ${name}${row.error ? ` · ${row.error}` : ""}`);
  }
}
const textHas = (text) => `document.body.textContent.includes(${JSON.stringify(text)})`;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

try {
  await scenario("day-loading", { mode: "loading" }, async ({ wait, evaluate }) => {
    await wait(textHas("Načítám nahrávky…"));
    assert(await evaluate("!document.querySelector('.recordings-dashboard__filters')"), "Načítání nesmí ukázat falešné počty");
  });
  await scenario("day-empty", { mode: "empty" }, async ({ wait }) => {
    await wait(textHas("Na tomto Macu nejsou žádné nahrávky k zobrazení."));
  });
  await scenario("day-error-retry", { mode: "error" }, async ({ wait, evaluate, click }) => {
    await wait("Boolean(document.querySelector('.recordings-dashboard__error'))");
    await evaluate("window.__astraFixture.mode = 'empty'");
    await click(".recordings-dashboard__error button");
    await wait(textHas("Na tomto Macu nejsou žádné nahrávky k zobrazení."));
  });
  const cases = [
    ["local", "Zůstává na Macu", "sendRecording", ".recording-action--send"],
    ["queued", "Schváleno k odeslání · čeká ve frontě"],
    ["sent", "Odesláno podle stavu fronty"],
    ["verified", "Odesláno podle stavu fronty", "verifyRecording", ".recording-action--verify", "Na serveru je úplná a shoduje se"],
    ["error", "Odeslání selhalo", "retryRecording", ".recording-action--retry"],
    ["limit", "Odesláno podle stavu fronty", "verifyRecording", ".recording-action--verify", "Server dočasně omezil další ověřování"],
    ["owner", "Jiný účet", "claimRecording", ".recording-action--claim"],
    ["missing", "Zvukové soubory chybí"],
    ["verify-error", "Odesláno podle stavu fronty", "verifyRecording", ".recording-action--verify", "Serverové ověření se nepodařilo. Lokální nahrávka zůstává beze změny."],
  ];
  for (const [kind, label, action, selector, result] of cases) {
    await scenario(`detail-${kind}`, { kind, verification: kind === "limit" ? "rate_limited" : kind === "verify-error" ? "throw" : "complete" }, async ({ wait, click, evaluate }) => {
      await wait("Boolean(document.querySelector('[data-testid=recording-detail]'))");
      await click(".recording-queue-card__summary");
      await wait("Boolean(document.querySelector('[data-testid=recording-detail][open]'))");
      await wait(textHas(label));
      assert(await evaluate("!document.querySelector('.recording-queue-card__journey li:last-child.is-complete')"), "Neověřená nahrávka nesmí být označená jako ověřená");
      if (["owner", "missing", "queued", "sent"].includes(kind)) {
        assert(await evaluate("!document.querySelector('.recording-action--send')"), "Nepovolené odeslání je viditelné");
      }
      if (kind === "owner") assert(await evaluate("!document.querySelector('.recording-action--verify')"), "Ověření cizího vlastníka je viditelné");
      if (action) {
        await click(selector);
        await wait(`window.__astraFixture.calls.some(c => c.name === ${JSON.stringify(action)})`);
        const call = await evaluate(`window.__astraFixture.calls.find(c => c.name === ${JSON.stringify(action)})`);
        assert(action === "verifyRecording" || action === "claimRecording" ? call.recordingId === "40000000-0000-4000-8000-000000000001" : call.value.id === "40000000-0000-4000-8000-000000000001", "Akce nepředala správné ID");
      }
      if (result) await wait(textHas(result));
      if (kind === "verified") {
        await wait("Boolean(document.querySelector('.recording-queue-card__journey li:last-child.is-complete'))");
        await click(".recording-queue-card__track button");
        await wait("window.__astraFixture.calls.some(c => c.name === 'openRecordingInLuDone')");
      }
      if (["limit", "verify-error"].includes(kind)) assert(await evaluate("!document.querySelector('.recording-queue-card__journey li:last-child.is-complete')"), "Chyba ověření nesmí znamenat úspěch");
    });
  }
  await scenario("auth-signed-in", {}, async ({ wait }) => { await wait("Boolean(document.querySelector('.desktop-menubar [data-auth-state=\"signed-in\"]'))"); });
  await scenario("auth-expired", { auth: "expired" }, async ({ wait, evaluate }) => {
    await wait(textHas("Přihlášení vypršelo"));
    await wait("Boolean(document.querySelector('.recording-action--send:disabled'))");
    assert(await evaluate("window.__astraFixture.calls.every(c => c.name !== 'sendRecording')"), "Expirace vyvolala odeslání");
  });
  await scenario("auth-oauth-pending-cancel", { auth: "none", designE2E: false }, async ({ wait, evaluate, click }) => {
    await wait(textHas("Přihlásit v prohlížeči"));
    const clicked = await evaluate("(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Přihlásit v prohlížeči')); b?.click(); return !!b; })()");
    assert(clicked, "Chybí přihlášení");
    await wait("Boolean(document.querySelector('[data-testid=auth-waiting-screen]'))");
    await click("[data-testid=auth-waiting-cancel]");
    await wait("window.__astraFixture.calls.some(c => c.name === 'cancelAuth')");
    await wait("!document.querySelector('[data-testid=auth-waiting-screen]')");
  }, true);
  for (const [name, update, selector] of [
    ["available", { availableVersion: "0.1.7" }, "update-available"],
    ["downloading", { availableVersion: "0.1.7", downloading: true, downloadPercent: 37 }, "update-downloading"],
    ["install-waits", { downloadedVersion: "0.1.7" }, "update-downloaded"],
  ]) {
    await scenario(`update-${name}`, { update }, async ({ wait, click, evaluate }) => {
      await wait(`Boolean(document.querySelector('[data-testid=${selector}]'))`);
      if (name === "downloading") await wait(textHas("Staženo 37 %"));
      if (name === "install-waits") {
        await click("[data-testid=update-install]");
        await wait("Boolean(document.querySelector('[data-testid=update-install]:disabled'))");
        await wait(textHas("Aktualizace se spustí, jakmile nebude probíhat nahrávání"));
        assert(await evaluate("window.__astraFixture.calls.filter(c => c.name === 'installUpdate').length === 1"), "Instalace se vyžádala vícekrát");
      }
    }, true);
  }
} catch (error) { results.push({ name: "harness", status: "FAIL", error: error.message }); }
const code = stateAcceptanceExitCode(results, networkAttempts);
await writeFile(path.join(runOutput, "report.json"), JSON.stringify({
  status: code ? "FAIL" : "PASS", exitCode: code, verification: "🧪", fixtureOnly: true,
  productionPreloadLoaded: false, networkAttempts, kontrolniNula: { networkWrites: 0, productionIpcCalls: 0 }, results,
  unverified: ["Produkční OAuth, serverové potvrzení a upload", "Skutečný Mac audio-smoke a ui-smoke", "Vizuální shoda s Astrou a úplnost Opus ikon", "Skutečné blokování instalace hlavním procesem při nahrávání; testuje se pouze renderer odpovědi installRequested", "Pád během nahrávání, výpadek zdroje a souběh uploadů"],
}, null, 2));
console.log(`Report: ${path.join(runOutput, "report.json")}`);
app.exit(code);

}
void runElectron().catch((error) => {
  console.error(error.stack || error.message);
  require("electron").app.exit(1);
});
