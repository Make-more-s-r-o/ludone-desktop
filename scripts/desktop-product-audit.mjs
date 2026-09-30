import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";


// Prázdný nebo neúplný důkaz nemůže vyjít zeleně.
export const REQUIRED_PATHS = [
  "day-groups-and-filters", "detail-verification-finder-focus",
  ...["identity", "origin", "revision", "fileRevision", "unknown"].map(m => `verification-invalidates-${m}`),
  "day-empty", "day-expired-send-disabled", "now-offline",
  ...["send", "retry", "claim", "delete"].map(a => `fixture-action-${a}`),
  "detail-partial", "detail-active-safe", "settings-normal-diagnostics",
  ...["light", "professional", "dark"].map(t => `settings-theme-${t}`),
  "settings-audio-quick-focus", "keyboard-escape-quick-actions", "now-navigation-queue-layout",
  ...["absent", "available", "downloaded"].map(u => `update-${u}`),
];
export function auditExitCode(results, networkAttempts) {
  return networkAttempts !== 0 || !Array.isArray(results) || results.length === 0
    || REQUIRED_PATHS.some(name => results.filter(r => r.name === name).length !== 1)
    || results.some(r => r.status !== "PASS" || !r.screenshot || !(r.screenshotBytes > 0) || r.screenshotError
      || ![400, 640].every(width => r.viewportScreenshots?.some(s => s.width === width && s.screenshot && s.bytes > 0))) ? 1 : 0;
}

// Samostatný renderer bez produkčního preloadu, tokenů a IPC. Neověřuje backend.
const require = createRequire(import.meta.url);
const script = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(script), "..");
const preview = process.argv.includes("--preview");
const panelPreview = process.argv.includes("--panel");
const output = process.versions.electron ? process.argv[2] : path.join(root, ".runtime", "desktop-product-audit", new Date().toISOString().replaceAll(":", "-"));
if (!process.versions.electron && process.argv[1] === script) {
  await mkdir(output, { recursive: true });
  const child = spawn(require("electron"), [path.join(root, "scripts/desktop-product-audit-bootstrap.cjs"), output, ...process.argv.slice(2).filter(arg => ["--preview", "--panel"].includes(arg))], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, DESKTOP_UPLOAD_ENABLED: "false" },
  });
  let log = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => {
    log += chunk.toString();
    process.stdout.write(chunk);
  });
  const timer = setTimeout(() => child.kill("SIGTERM"), preview ? 900_000 : 120_000);
  let code = await new Promise((resolve) => {
    child.once("error", (error) => { log += error.message; resolve(1); });
    child.once("exit", (code) => resolve(code ?? 1));
  });
  clearTimeout(timer);
  await writeFile(path.join(output, "command.log"), `node scripts/desktop-product-audit.mjs\n${log}\nexit_code=${code}\n`);
  if (preview) {
    await writeFile(path.join(output, "preview-status.json"), JSON.stringify({ mode: "preview", verification: "⛔", fixtureOnly: true, exitCode: code, unverified: ["Audit přejímka", "Fyzický zvuk", "Skutečný upload"] }, null, 2));
    process.exit(code);
  }
  try { await access(path.join(output, "report.json")); } catch {
    code = code || 1;
    await writeFile(path.join(output, "report.json"), JSON.stringify({ status: "FAIL", exitCode: code || 1, fixtureOnly: true, results: [], error: "Electron harness nevytvořil report; žádný scénář není ověřený." }, null, 2));
  }
  try {
    const report = JSON.parse(await readFile(path.join(output, "report.json"), "utf8"));
    if (report.status !== "PASS" || auditExitCode(report.results, report.networkAttempts)) code = 1;
    if (code) { report.status = "FAIL"; report.exitCode = code; await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2)); }
  } catch { code = 1; }
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
const watchdog = preview ? null : setTimeout(async () => {
  await writeFile(path.join(runOutput, "report.json"), JSON.stringify({ status: "FAIL", exitCode: 1, fixtureOnly: true, networkAttempts, results, error: "Audit překročil limit 120 sekund" }, null, 2));
  app.exit(1);
}, 120_000);

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
  state.identity = { name: "Fixture audit", email: "fixture@example.invalid" };
  state.origin = "https://app.ludone.cz";
  state.items = Array.from({ length: 24 }, (_, n) => {
    const date = new Date(); date.setDate(date.getDate() - Math.floor(n / 8)); date.setHours(8 + n % 8, 15, 0, 0);
    const kinds = ["local", "queued", "sent", "error", "owner", "partial", "active", "delete"];
    const kind = kinds[n % 8];
    return { ...item, id: `40000000-0000-4000-8000-${String(n + 1).padStart(12, "0")}`,
      title: n === 0 ? "Velmi dlouhý název pracovní schůzky ".repeat(12) : `Fixture ${kind} ${n}`,
      createdAt: date.toISOString(), state: kind === "sent" ? "odeslano" : kind === "error" ? "selhalo" : "ceka",
      uploadIntent: ["queued", "sent", "error"].includes(kind) ? "approved" : "held",
      ownership: kind === "owner" ? "other" : "current", recordingInProgress: kind === "active",
      localState: ["partial", "active"].includes(kind) ? "partial-audio" : "complete-audio",
      allowedActions: { send: kind === "local", retry: kind === "error", claim: kind === "owner", delete: kind === "delete" },
    };
  }).reverse();
  if (scenario.preview) {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem("ludone.fixture.preview-state"));
      if (saved) { Object.assign(state, saved); calls.push(...(saved.calls ?? [])); state.calls = calls; }
    } catch { /* Nový izolovaný profil nemá uložený stav. */ }
  }
  state.listeners = listeners;

  state.update ??= { revision: 1, availableVersion: null, downloadedVersion: null, downloading: false,
    installRequested: false, installDeferred: false, ...scenario.update };
  window.localStorage.setItem("ludone.prototype.onboarding-complete", "true");
  window.__astraFixture = state;
  const action = (name) => async (value) => { calls.push({ name, value }); return { outcome: "fixture_only" }; };
  const persist = () => {
    if (scenario.preview) window.sessionStorage.setItem("ludone.fixture.preview-state", JSON.stringify({ ...state, listeners: undefined }));
  };
  if (scenario.preview) window.addEventListener("pagehide", persist);
  const navigate = (tab) => {
    calls.push({ name: tab === null ? "returnToNowPanel" : "openSettings", value: tab });
    if (!scenario.preview) return;
    persist();
    const next = new URL(window.location.href);
    next.search = tab === null ? "" : `?settingsTab=${encodeURIComponent(tab)}`;
    next.hash = tab === null ? "" : "settings";
    window.location.href = next.href;
  };
  window.ludone = Object.freeze({
    runtime: Object.freeze({ resetOnboarding: false, designE2E: scenario.designE2E !== false }),
    getAuthSessionState: async () => state.auth,
    getAuthIdentity: async () => state.auth === "valid" ? state.identity : null,
    getAuthOrigin: async () => state.origin, getDeviceName: async () => "Izolovaný E2E Mac",
    getDockVisible: async () => false, getOpenAtLogin: async () => false, getUploadEnabled: async () => false,
    getPermissionStatus: async () => "denied", listQueue: async () => state.items.map(i => ({ ...i, tracks: ["delivery"], totalBytes: i.sizeBytes })),
    listLocalRecordings: async () => {
      calls.push({ name: "listLocalRecordings" });
      if (state.mode === "loading") return pending();
      if (state.mode === "error") throw new Error("Izolovaná chyba seznamu");
      return { items: state.mode === "empty" ? [] : state.items, unreadableCount: 0 };
    },
    verifyRecording: async (recordingId, expectedRevision) => {
      calls.push({ name: "verifyRecording", recordingId, expectedRevision });
      if (state.verification === "throw") throw new Error("Izolovaná chyba ověření");
      return { id: recordingId, revision: expectedRevision, verifiedAt: new Date().toISOString(), tracks: { delivery: { status: state.verification, mismatchFields: [] } } };
    },
    sendRecording: action("sendRecording"), retryRecording: action("retryRecording"), deleteRecording: action("deleteRecording"),
    revealRecording: action("revealRecording"),
    claimRecording: async (recordingId, expectedRevision) => { calls.push({ name: "claimRecording", recordingId, expectedRevision }); return { claimed: false }; },
    openRecordingInLuDone: action("openRecordingInLuDone"),
    getDiagnostics: async () => { calls.push({ name: "getDiagnostics" }); return { version: "0.1.6", architecture: "Apple Silicon", permissions: { microphone: "unknown", systemAudio: "unknown" }, queue: { available: true, waiting: 20, sending: 0, failed: 3 }, serverConnection: { status: "unknown" } }; },
    setDockVisible: action("setDockVisible"), setOpenAtLogin: action("setOpenAtLogin"),
    returnToNowPanel: () => navigate(null), closeSettings: () => navigate(null), openSettings: (tab = "account") => navigate(tab),
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
    deferUpdate: async () => { calls.push({ name: "deferUpdate" }); state.update = { ...state.update, revision: 2, installDeferred: true }; return state.update; },
  });
}

async function bounded(promise, label, milliseconds = 10000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timeout ${label}`)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}

async function scenario(name, fixture, check, panel = false) {
  let win;
  const row = { name, status: "FAIL", fixtureOnly: true, viewportScreenshots: [] };
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
      const ok = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e || e.disabled) return false; e.focus(); e.click(); return true; })()`);
      if (!ok) throw new Error(`Akce není dostupná: ${selector}`);
    };
    await bounded(win.loadFile(path.join(root, "dist/index.html"), panel ? {} : { query: { settingsTab: fixture.page ?? "day" }, hash: "settings" }), `${name}: loadFile`);
    console.log(`LOADED ${name}`);
    await wait("Boolean(document.querySelector('#root')?.textContent.trim())");
    const pressEscape = async () => {
      win.webContents.sendInputEvent({ type: "keyDown", keyCode: "ESCAPE" });
      win.webContents.sendInputEvent({ type: "keyUp", keyCode: "ESCAPE" });
      await delay(80);
    };
    await check({ evaluate, wait, click, pressEscape });
    for (const width of [400, 640]) {
      win.setContentSize(width, 744); await delay(80);
      const overflow = await evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1");
      if (overflow) throw new Error(`Horizontální overflow při ${width}px`);
      const shot = await win.webContents.capturePage();
      if (shot.isEmpty()) throw new Error(`Prázdný screenshot při ${width}px`);
      const png = shot.toPNG();
      if (png.length === 0) throw new Error(`Prázdný PNG při ${width}px`);
      const screenshot = path.join(runOutput, `${name}-${width}.png`);
      await writeFile(screenshot, png);
      row.viewportScreenshots.push({ width, screenshot, bytes: png.length });
    }
    row.status = "PASS";
    row.calls = await evaluate("window.__astraFixture.calls");
  } catch (error) { row.error = error.message; }
  finally {
    if (win && !win.isDestroyed()) {
      try {
        const image = await bounded(win.webContents.capturePage(), `${name}: capturePage`, 3000);
        if (image.isEmpty()) { row.status = "FAIL"; row.screenshotError = "Prázdný screenshot"; }
        row.screenshot = path.join(runOutput, `${name}.png`);
        const png = image.toPNG(); row.screenshotBytes = png.length; await writeFile(row.screenshot, png);
      } catch (error) { row.status = "FAIL"; row.screenshotError = error.message; }
      win.destroy();
    }
    results.push(row);
    console.log(`${row.status} ${name}${row.error ? ` · ${row.error}` : ""}`);
  }
}
// Viditelný proklik není automatická přejímka a nikdy nezapisuje audit PASS.
if (preview) {
  const win = new BrowserWindow({ show: true, width: panelPreview ? 400 : 640, height: 744,
    title: "LuDone — izolovaný fixture preview",
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true,
      backgroundThrottling: false, partition: "product-preview-fixture" } });
  win.webContents.session.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }, (_request, callback) => {
    networkAttempts += 1; console.error("PREVIEW blokovaný síťový pokus"); callback({ cancel: true });
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(new URL(`file://${path.join(root, "dist/index.html")}`).href)) event.preventDefault();
  });
  const stop = setTimeout(() => { console.log("PREVIEW hardstop 15 minut"); app.exit(0); }, 900_000);
  win.on("closed", () => { clearTimeout(stop); app.exit(0); });
  await bounded(win.loadURL("about:blank"), "preview inicializace");
  win.webContents.debugger.attach("1.3");
  await win.webContents.debugger.sendCommand("Page.enable");
  await win.webContents.debugger.sendCommand("Page.addScriptToEvaluateOnNewDocument", {
    source: `(${installFixture.toString()})(window, ${JSON.stringify({ preview: true })})`,
  });
  await win.loadFile(path.join(root, "dist/index.html"), panelPreview ? {} : { query: { settingsTab: "day" }, hash: "settings" });
  await writeFile(path.join(runOutput, "preview-status.json"), JSON.stringify({ mode: "preview", verification: "⛔", fixtureOnly: true, networkAttempts, renderer: "dist/index.html", productionPreloadLoaded: false, hardstopMs: 900000 }, null, 2));
  console.log(`PREVIEW připraven: ${runOutput}`);
  return;
}
const textHas = (text) => `document.body.textContent.includes(${JSON.stringify(text)})`;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

try {
  const entry = (n) => `[data-recording-id="40000000-0000-4000-8000-${String(n + 1).padStart(12, "0")}"]`;
  const ready = async ({ wait }) => wait("document.querySelectorAll('[data-recording-id]').length === 24");
  const open = async (tools, n) => { await ready(tools); await tools.click(`${entry(n)} summary`); await tools.wait(`Boolean(document.querySelector('${entry(n)} details[open]'))`); };
  await scenario("day-groups-and-filters", {}, async (t) => {
    await ready(t);
    const groups = await t.evaluate("[...document.querySelectorAll('.recordings-day')].map(g => ({ day:g.dataset.day, times:[...g.querySelectorAll('time')].map(e=>Date.parse(e.dateTime)) }))");
    assert(groups.length === 3 && groups.every(g => g.times.length === 8), "Chybí 24 položek ve třech dnech");
    assert(groups.every((g,i) => !i || groups[i-1].day > g.day), "Dny nejsou od nejnovějšího");
    assert(groups.every(g => g.times.every((v,i) => !i || v >= g.times[i-1])), "Časy nejsou chronologické");
    await t.wait(textHas("Dnes"));
    for (const [filter,count] of [["local",15],["delivery",9],["all",24]]) {
      await t.click(`[data-filter=${filter}]`); await t.wait(`document.querySelectorAll('[data-recording-id]').length === ${count}`);
    }
  });
  await scenario("detail-verification-finder-focus", {}, async (t) => {
    await open(t,2); await t.click(`${entry(2)} .recording-action--verify`);
    await t.wait(`Boolean(document.querySelector('${entry(2)} [data-status=complete]'))`);
    await t.click(`${entry(2)} .recording-action--reveal`);
    await t.wait("window.__astraFixture.calls.some(c=>c.name==='revealRecording')");
    await t.evaluate("window.dispatchEvent(new Event('focus'))");
    await t.wait(`Boolean(document.querySelector('${entry(2)} [data-status=complete]'))`);
    await t.click(`${entry(2)} .recording-queue-card__track button`);
    await t.wait("window.__astraFixture.calls.some(c=>c.name==='openRecordingInLuDone')");
    await t.click(`${entry(2)} summary`);
    await t.wait("!document.querySelector('[data-testid=recording-detail][open]')");
  });
  for (const mutation of ["identity", "origin", "revision", "fileRevision", "unknown"]) {
    await scenario(`verification-invalidates-${mutation}`, {}, async (t) => {
      await open(t,2); await t.click(`${entry(2)} .recording-action--verify`);
      await t.wait(`Boolean(document.querySelector('${entry(2)} [data-status=complete]'))`);
      if (mutation === "identity") await t.evaluate("window.__astraFixture.identity.email='other@example.invalid'; window.__astraFixture.listeners.auth()");
      else if (mutation === "origin") await t.evaluate("window.__astraFixture.origin='https://labs.ludone.cz'; window.__astraFixture.listeners.auth()");
      else if (mutation === "unknown") await t.evaluate("window.__astraFixture.identity=null; window.__astraFixture.listeners.auth()");
      else {
        await t.evaluate(`window.__astraFixture.items.find(i=>i.id.endsWith('000000000003')).${mutation}='sha256:'+'b'.repeat(64)`);
        await t.click('.recordings-dashboard__toolbar > button');
      }
      await t.wait(`!document.querySelector('${entry(2)} [data-status=complete]')`);
    });
  }
  await scenario("day-empty", { mode: "empty" }, async (t) => { await t.wait(textHas("Na tomto Macu nejsou žádné nahrávky k zobrazení.")); });
  await scenario("day-expired-send-disabled", { auth: "expired" }, async (t) => { await open(t,0); await t.wait(`Boolean(document.querySelector('${entry(0)} .recording-action--send:disabled'))`); });
  await scenario("now-offline", {}, async (t) => { await t.evaluate("Object.defineProperty(navigator,'onLine',{value:false,configurable:true}); window.dispatchEvent(new Event('offline'))"); await t.wait("Boolean(document.querySelector('[data-testid=offline-notice]'))"); }, true);
  for (const [n,action] of [[0,'send'],[3,'retry'],[4,'claim'],[7,'delete']]) {
    await scenario(`fixture-action-${action}`, {}, async (t) => {
      await open(t,n); await t.click(`${entry(n)} .recording-action--${action}`);
      await t.wait(`window.__astraFixture.calls.some(c=>c.name==='${action}Recording')`);
    });
  }
  await scenario("detail-partial", {}, async (t) => { await open(t,5); await t.wait(textHas("Část zvuku chybí")); });
  await scenario("detail-active-safe", {}, async (t) => {
    await open(t,6); await t.wait(textHas("Nahrávání ještě není dokončené"));
    assert(await t.evaluate(`![...document.querySelectorAll('${entry(6)} .recording-queue-card__actions button')].some(b=>!b.disabled)`), "Běžící záznam má dostupnou akci");
  });
  await scenario("settings-normal-diagnostics", { page: "account" }, async (t) => {
    await t.wait("window.__astraFixture.calls.some(c=>c.name==='getDiagnostics')");
    await t.wait("document.querySelector('[data-testid=diagnostics-version]')?.textContent.trim()==='0.1.6'");
    assert(await t.evaluate("document.querySelector('[data-testid=diagnostics-server]').dataset.status==='unknown'"), "Neznámý server je hlášen úspěšný");
  });
  for (const [theme,label] of [["light","Světlé"],["professional","Profesionální"],["dark","Tmavé"]]) {
    await scenario(`settings-theme-${theme}`, { page: "account" }, async (t) => {
      await t.wait("Boolean(document.querySelector('.settings-theme__choices'))");
      await t.evaluate(`([...document.querySelectorAll('.settings-theme__choice')].find(b=>b.textContent==='${label}')).click()`);
      await t.wait(`document.documentElement.dataset.theme==='${theme}'`);
    });
  }
  await scenario("settings-audio-quick-focus", { page: "account" }, async (t) => {
    await t.click('.desktop-titlebar__quick-actions');
    await t.wait("Boolean(document.querySelector('.desktop-quick-actions')?.open)");
    await t.evaluate("[...document.querySelectorAll('.desktop-quick-actions__item')].find(b=>b.textContent.includes('Zvuk')).click()");
    await t.wait("Boolean(document.activeElement?.closest('#settings-panel-audio'))");
    assert(await t.evaluate("document.querySelector('#settings-panel-audio').getBoundingClientRect().top >= 0 && document.querySelector('#settings-panel-audio').getBoundingClientRect().top < innerHeight"), "Zvuk není odscrollován do viditelné plochy");
  });
  await scenario("keyboard-escape-quick-actions", { page: "account" }, async (t) => {
    await t.click('.desktop-titlebar__quick-actions'); await t.wait("Boolean(document.querySelector('.desktop-quick-actions')?.open)");
    await t.pressEscape();
    await t.wait("!document.querySelector('.desktop-quick-actions')?.open");
    await t.wait("document.activeElement?.matches('.desktop-titlebar__quick-actions')");
  });
  await scenario("now-navigation-queue-layout", {}, async (t) => {
    await t.wait("Boolean(document.querySelector('[data-testid=queue-status]'))");
    const before = await t.evaluate("window.__astraFixture.calls.length");
    await t.click('.desktop-navigation__item[aria-current=page]');
    assert(await t.evaluate(`window.__astraFixture.calls.length===${before}`), "Aktivní navigace spustila akci");
    await t.click('[data-testid=queue-status]'); await t.wait("Boolean(document.querySelector('[data-testid=queue-screen]'))");
    assert(await t.evaluate("Boolean(document.querySelector('.recording-card').compareDocumentPosition(document.querySelector('[data-testid=queue-screen]')) & Node.DOCUMENT_POSITION_FOLLOWING)"), "Fronta předchází nahrávání");
    assert(await t.evaluate("getComputedStyle(document.querySelector('[data-testid=queue-screen]')).maxHeight !== 'none'"), "Fronta nemá omezenou výšku");
  }, true);
  for (const [name, update] of [["absent",{}],["available",{availableVersion:"0.1.7"}],["downloaded",{downloadedVersion:"0.1.7"}]]) {
    await scenario(`update-${name}`, { update }, async (t) => {
      if (name === "absent") { await t.wait("Boolean(document.querySelector('.desktop-navigation'))"); assert(await t.evaluate("!document.querySelector('.application-update-detail__open')"), "Bez aktualizace je prázdný detail"); return; }
      await t.wait(`Boolean(document.querySelector('[data-testid=update-${name}]'))`);
      await t.click('.application-update-detail__open'); await t.wait("Boolean(document.querySelector('.application-update-detail__back'))");
      if (name === "downloaded") {
        await t.click('[data-testid=update-defer]'); await t.wait("window.__astraFixture.calls.some(c=>c.name==='deferUpdate')");
        await t.click('[data-testid=update-install]'); await t.wait("window.__astraFixture.calls.some(c=>c.name==='installUpdate')");
      }
      await t.click('.application-update-detail__back'); await t.wait("!document.querySelector('.application-update-detail__back')");
    }, true);
  }
} catch (error) { results.push({ name: "harness", status: "FAIL", error: error.message }); }
const code = auditExitCode(results, networkAttempts);
await writeFile(path.join(runOutput, "report.json"), JSON.stringify({
  status: code ? "FAIL" : "PASS", exitCode: code, verification: "🧪", fixtureOnly: true,
  productionPreloadLoaded: false, networkAttempts, kontrolniNula: { networkWrites: 0, productionIpcCalls: 0 }, results,
  unverified: ["Produkční OAuth, serverové potvrzení a upload", "Skutečný Mac audio-smoke a ui-smoke", "Vizuální shoda s Astrou a úplnost Opus ikon", "Skutečné blokování instalace hlavním procesem při nahrávání; testuje se pouze renderer odpovědi installRequested", "Pád během nahrávání, výpadek zdroje a souběh uploadů"],
}, null, 2));
console.log(`Report: ${path.join(runOutput, "report.json")}`);
clearTimeout(watchdog);
app.exit(code);

}
if (process.versions.electron) void runElectron().catch((error) => {
  console.error(error.stack || error.message);
  writeFile(path.join(output, preview ? "preview-status.json" : "report.json"), JSON.stringify({ status: "FAIL", exitCode: 1, fixtureOnly: true, results: [], error: error.message }, null, 2)).finally(() => require("electron").app.exit(1));
});

