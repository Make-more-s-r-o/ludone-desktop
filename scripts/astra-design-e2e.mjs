import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// D10: geometrie z potvrzené galerie 0dd87da, nikoli baseline aktuálního běhu.
export function homeGeometryValid(state) {
  const near = (value, expected) => Number.isFinite(value) && Math.abs(value - expected) <= 2;
  return Boolean(state.record && state.preview && state.future && state.footer && state.topline
    && near(state.viewportHeight, 700) && near(state.record.top, 123) && near(state.record.height, 212)
    && near(state.preview.height, 147) && near(state.future.height, 43)
    && state.record.bottom <= state.preview.top && state.preview.bottom <= state.future.top
    && state.future.bottom <= state.footer.top && near(state.footer.bottom, 692)
    && near(state.topline.left - state.future.left, 22)
    && state.futureControls.length === 3 && state.futureControls.every(control => control.disabled && !control.visible));
}

export function timelineGeometryValid(layout) {
  return Boolean(layout.entries?.length === 2 && layout.times?.length === 2 && layout.statuses?.length === 2
    && layout.groups?.length === layout.groupKeys?.length
    && JSON.stringify(layout.groupKeys) === JSON.stringify(layout.actualGroupKeys)
    && Math.abs(layout.groups[0]?.top - 323) <= 2 && Math.abs(layout.groups[0]?.height - 19) <= 1
    && Math.abs(layout.entries[0]?.top - 364) <= 2
    && layout.entries.every(entry => Math.abs(entry.height - 98) <= 2)
    && layout.entries[0].bottom <= layout.entries[1].top && layout.entries[1].bottom <= layout.footer?.top
    && !layout.textClipping && !layout.horizontalOverflow
    && layout.times.every((time, index) => time.width === 42 && time.height === 24
      && time.right <= layout.entries[index].left && time.top >= layout.entries[index].top && time.bottom <= layout.entries[index].bottom)
    && layout.statuses.every((status, index) => status.width > 0 && status.height > 0
      && status.left >= layout.entries[index].left && status.right <= layout.entries[index].right
      && status.top >= layout.entries[index].top && status.bottom <= layout.entries[index].bottom));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(projectRoot, ".runtime", "design-e2e");
const runId = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
const outputDir = path.join(outputRoot, runId);
const dataRoot = path.join(outputDir, "isolated-data");
const fixtureRecordingId = "40000000-0000-4000-8000-000000000001";
const electronBinary = require("electron");
const observations = [];
const screenshots = [];
const acceptanceGroups = [
  { label: "Teď", checks: ["now-hierarchy-and-safe-actions"] },
  { label: "Záznam a uložení", checks: [
    "recording-starts-two-synthetic-sources",
    "system-audio-loss-and-recovery",
    "recording-stop-offers-explicit-safe-choice",
    "saved-recording-astra-composition",
    "recording-saved-local-from-ui",
  ] },
  { label: "Můj den", checks: [
    "day-hierarchy-and-real-data",
    "day-shows-actual-recording-and-seeded-local-fixture",
    "local-recording-filter",
    "delivery-filter-empty-is-truthful",
  ] },
  { label: "Detail", checks: ["local-recording-detail-no-upload", "detail-back-to-day"] },
  { label: "Nastavení", checks: ["settings-shell", "settings-quick-actions"] },
  { label: "Aktualizace", checks: ["update-check-isolated-from-production", "update-banner-and-defer", "update-dedicated-surface"] },
  { label: "Offline a obnova", checks: [
    "offline-recording-continues-locally",
    "startup-loads-seeded-local-fixture",
    "saved-recording-visible-after-app-restart",
    "offline-keeps-local-recording",
    "unfinished-recording-preserved-after-restart",
  ] },
  { label: "Onboarding", checks: [
    "onboarding-first-use-and-honest-scope",
    "onboarding-account-step-without-external-login",
  ] },
  { label: "Světlé a tmavé téma", checks: [
    "light-theme-choice",
    "day-theme-light",
    "dark-theme-choice",
    "dark-settings-actions-contrast",
    "day-theme-dark",
    "theme-shared-across-windows",
  ] },
  { label: "LuTrack zůstává vypnutý", checks: ["lutrack-remains-disabled"] },
  { label: "Astra geometrie a pořadí", checks: [
    "astra-layout-offline",
    "astra-layout-day",
    "astra-layout-detail",
    "astra-layout-settings",
  ] },
];
const comparisonPairs = [
  {
    label: "Teď · hlavní panel",
    scenario: "home",
    width: 400,
    height: 700,
    app: "ted.png",
    layoutCheck: null,
    note: "Produktový LuTrack zůstává poctivě připravovaný; jeho prostor a shell se porovnávají se scénou Astra home.",
  },
  {
    label: "Můj den · místní nahrávky",
    scenario: "day",
    width: 640,
    height: 744,
    app: "muj-den.png",
    layoutCheck: "astra-layout-day",
    note: "Srovnává se stejná plocha a hierarchie; pracovní úseky prototypu se nepřenášejí do skutečných dat.",
  },
  {
    label: "Detail · místní kopie",
    scenario: "detail",
    width: 640,
    height: 744,
    app: "detail-nahravky.png",
    layoutCheck: "astra-layout-detail",
    note: "Produktová místní kopie a skutečné bezpečné akce se porovnávají s odpovídající scénou Astra detail.",
  },
  {
    label: "Nastavení · účet a předvolby",
    scenario: "settings",
    width: 640,
    height: 744,
    app: "nastaveni.png",
    layoutCheck: "astra-layout-settings",
    note: "Skutečný účet, zvuk, lokální kopie a aktualizace se porovnávají se scénou Astra Nastavení bez fiktivního profilu.",
  },
  {
    label: "Offline · místní nahrávka",
    scenario: "offline",
    width: 400,
    height: 700,
    app: "offline-active-recording.png",
    layoutCheck: "astra-layout-offline",
    note: "Porovnává probíhající nahrávání bez sítě; LuTrack zůstává vypnutý a jeho čas se nevymýšlí.",
  },
];
comparisonPairs.push(
  { label: "Uložení · jedna schůzka", scenario: "save", width: 400, height: 700, app: "nahravani-ulozeno.png", layoutCheck: "saved-recording-astra-composition", note: "Dvě výslovné akce a jedna schůzka; skutečný odhlášený účet a neaktivní LuTrack." },
  { label: "První spuštění", scenario: "onboarding", width: 400, height: 700, app: "00-prvni-pouziti.png", layoutCheck: null, note: "Společný Astra shell; skutečné kroky oprávnění a přihlášení se zachovávají." },
  { label: "Aktualizace · samostatná plocha", scenario: "update", width: 400, height: 700, app: "aktualizace-detail.png", layoutCheck: "update-dedicated-surface", note: "Proužek i samostatná aktualizační plocha zachovávají výslovnou volbu instalace." },
  { label: "Nastavení · tmavé", scenario: "settings-dark", width: 640, height: 744, app: "nastaveni-tmave.png", layoutCheck: null, note: "Tmavá reference ze stejné uložené Astry." },
  { label: "Můj den · tmavý", scenario: "day-dark", width: 640, height: 744, app: "muj-den-tmave.png", layoutCheck: null, note: "Tmavá reference bez přenosu pracovních demo dat." },
);
for (const pair of comparisonPairs) {
  pair.note = `D10: autoritou produktového rozložení je potvrzená galerie checkpointu 0dd87da. Astra zůstává historickou referencí; porovnání netvrdí shodu 1:1. ${pair.note}`;
}
const referenceImageDirectory = path.join(
  projectRoot,
  "docs/changes/desktop-astra-parity-0-1-6/artifacts/design/reference",
);

await mkdir(outputDir, { recursive: true });

async function seedLocalRecordingFixture() {
  const recordingsDirectory = path.join(dataRoot, "user-data", "nahravky");
  await mkdir(recordingsDirectory, { recursive: true });
  const startedAt = new Date(Date.now() - 90_000);
  const endedAt = new Date(startedAt.getTime() + 2_220);
  const audioPath = path.join(recordingsDirectory, "astra-e2e-synthetic-audio.webm");
  const manifestPath = path.join(recordingsDirectory, "astra-e2e-synthetic.manifest.json");
  // Dvoukanálový syntetický WebM/Opus z verzované testovací vzorkovny. Je to
  // validní stereo soubor, nikoli lidský záznam; profil běhu je izolovaný a upload blokovaný.
  const media = await readFile(path.join(
    projectRoot,
    "docs/changes/desktop-v1/vzorky/dvoustopa-440hz-880hz.webm",
  ));
  const sha256 = createHash("sha256").update(media).digest("hex");
  await writeFile(audioPath, media, { mode: 0o600, flag: "wx" });
  await writeFile(manifestPath, `${JSON.stringify({
    schemaVersion: 1,
    clientRecordingId: fixtureRecordingId,
    createdAt: startedAt.toISOString(),
    closedAt: endedAt.toISOString(),
    state: "complete",
    tracks: {
      microphone: {
        fileName: path.basename(audioPath),
        sha256,
        sizeBytes: media.byteLength,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
      },
    },
  }, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  return { audioPath, manifestPath };
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id || !this.pending.has(message.id)) return;
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} neodpověděl do 8 sekund.`));
      }, 8_000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.result?.description ?? "JavaScript v rendereru selhal.");
    }
    return result.result.value;
  }

  close() {
    if ([WebSocket.OPEN, WebSocket.CONNECTING].includes(this.socket.readyState)) this.socket.close();
  }
}

async function waitFor(check, label, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Čekání na „${label}“ vypršelo${lastError ? `: ${lastError.message}` : ""}.`);
}

async function getTargets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`Electron CDP vrátil ${response.status}.`);
  return response.json();
}

async function connectTarget(port, predicate, label) {
  const target = await waitFor(
    async () => (await getTargets(port)).find(predicate),
    `Electron okno ${label}`,
  );
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  const viewport = target.url.includes("#settings")
    ? { width: 640, height: 744 }
    : { width: 400, height: 700 };
  await client.send("Emulation.setDeviceMetricsOverride", {
    ...viewport,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  return client;
}

async function captureAstraReferences() {
  for (const pair of comparisonPairs) {
    const source = path.join(referenceImageDirectory, `astra-${pair.scenario}.png`);
    pair.referenceFile = path.join(outputDir, `astra-${pair.scenario}.png`);
    await copyFile(source, pair.referenceFile);
    pair.referenceScreenshot = path.relative(projectRoot, pair.referenceFile);
    const file = await readFile(pair.referenceFile);
    const width = file.readUInt32BE(16);
    const height = file.readUInt32BE(20);
    if (width !== pair.width || height !== pair.height) {
      throw new Error(`Snímek Astra ${pair.scenario} má ${width}×${height}, očekáváno ${pair.width}×${pair.height}.`);
    }
    observations.push({
      check: `reference-astra-${pair.scenario}`,
      viewport: { width, height },
      screenshot: pair.referenceScreenshot,
    });
  }
}

async function clickByText(client, text) {
  await ensureVisibleWindow(client);
  await waitFor(() => client.evaluate(`Boolean([...document.querySelectorAll('button')]
    .find(item => item.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)}))`), `tlačítko ${text}`);
  await client.evaluate(`(async () => {
    const target = [...document.querySelectorAll('button')]
      .find((item) => item.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)});
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    // Nativní hit-test musí po změně DOM a scrollu používat vykreslenou kompozici.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return Boolean(target);
  })()`);
  const point = await client.evaluate(`(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => item.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)});
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return rect.width > 0 && rect.height > 0 && (hit === button || button.contains(hit))
      ? { x, y } : null;
  })()`);
  if (!point) throw new Error(`Tlačítko „${text}“ není viditelné nebo dosažitelné.`);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved", x: point.x, y: point.y, button: "none",
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1,
  });
  const release = client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1,
  });
  if (text === "Teď") {
    // Návrat do Teď zavře právě ovládané Nastavení; ack CDP může zaniknout
    // spolu s oknem, takže autoritu má následná kontrola skutečného panelu.
    await Promise.race([release.catch(() => undefined), delay(500)]);
  } else {
    await release;
  }
  observations.push({ action: "click", text });
}

async function clickSelector(client, selector, label) {
  await ensureVisibleWindow(client);
  await waitFor(() => client.evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`), `prvek ${label}`);
  const point = await client.evaluate(`(async () => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target) return null;
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    // Nativní hit-test musí po změně DOM a scrollu používat vykreslenou kompozici.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return rect.width > 0 && rect.height > 0 && (hit === target || target.contains(hit))
      ? { x, y } : null;
  })()`);
  if (!point) throw new Error(`Prvek „${label}“ není viditelný nebo dosažitelný.`);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved", x: point.x, y: point.y, button: "none",
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1,
  });
  observations.push({ action: "click", target: label });
}

function compactText(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase("cs-CZ")
    .replace(/[\s\u00ad\u200b]+/gu, "");
}

async function ensureVisibleWindow(client) {
  // macOS může zastavit rAF zakrytého okna. Snímek vyžaduje skutečně vykreslené
  // okno; zvedneme je stejně jako při lidské vizuální přejímce, časový limit neměníme.
  await client.send("Page.bringToFront");
  // bringToFront neotevře skrytý macOS panel. Použijeme existující testovací
  // klik na lištu (povolený výhradně LUDONE_E2E), nikoli změnu renderer guardu.
  if (await client.evaluate("Boolean(document.querySelector('.panel')) && document.visibilityState !== 'visible'")) {
    const shown = await client.evaluate("window.ludone.testClickTray()");
    if (!shown?.allowed) throw new Error("Izolovaný panel nelze otevřít klikem na lištu.");
    if (!shown.visible) await client.evaluate("window.ludone.testClickTray()");
    await waitFor(() => client.evaluate("document.visibilityState === 'visible'"), "viditelný panel pro screenshot");
  }
  await waitFor(() => client.evaluate("document.visibilityState === 'visible'"), "viditelné okno pro proklik a snímání");
}

async function screenshot(client, name) {
  await ensureVisibleWindow(client);
  observations.push({ diagnostic: "screenshot-readiness", name,
    ...await client.evaluate(`({ visibility: document.visibilityState, focus: document.hasFocus(),
      animations: document.getAnimations().map(animation => ({ state: animation.playState,
        endTime: String(animation.effect?.getComputedTiming()?.endTime) })) })`),
  });
  // Čekáme na hotová písma a konečné přechody barev. Snímek uprostřed
  // změny tématu může aktivní tlačítko mylně zobrazit jako šedé/zakázané.
  await client.evaluate(`(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.allSettled(document.getAnimations().filter(animation => {
      const timing = animation.effect?.getComputedTiming();
      return timing && Number.isFinite(timing.endTime) && timing.endTime <= 2000;
    }).map(animation => animation.finished));
  })()`);
  const viewport = await client.evaluate("({ width: innerWidth, height: innerHeight })");
  const result = await client.send("Page.captureScreenshot", {
    format: "png", fromSurface: true, captureBeyondViewport: false,
  });
  const image = Buffer.from(result.data, "base64");
  const dimensions = { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
  if (dimensions.width !== viewport.width || dimensions.height !== viewport.height) {
    throw new Error(`Screenshot ${name} má ${dimensions.width}×${dimensions.height} px, viewport ${viewport.width}×${viewport.height} px.`);
  }
  const filePath = path.join(outputDir, `${String(screenshots.length + 1).padStart(2, "0")}-${name}.png`);
  await writeFile(filePath, image);
  screenshots.push(path.relative(projectRoot, filePath));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

async function writeComparisonPage() {
  const pairs = comparisonPairs.map((pair) => ({
    ...pair,
    appScreenshot: screenshots.find((item) => item.endsWith(`-${pair.app}`)) ?? null,
  }));
  const cards = pairs.map((pair) => {
    const reference = pair.referenceFile ? path.relative(outputDir, pair.referenceFile) : null;
    const productImage = pair.appScreenshot ? path.basename(pair.appScreenshot) : null;
    return `<section class="pair">
      <h2>${escapeHtml(pair.label)}</h2>
      <p>${escapeHtml(pair.note)}</p>
      <div class="images">
        <figure><figcaption>Skutečný renderer LuDone Desktop</figcaption>${productImage
          ? `<img src="${escapeHtml(productImage)}" alt="${escapeHtml(pair.label)} v aplikaci">`
          : "<p>Produktový screenshot nebyl zachycen.</p>"}</figure>
        <figure><figcaption>Schválená Astra · ${escapeHtml(pair.scenario)}</figcaption>${reference
          ? `<img src="${escapeHtml(reference)}" alt="${escapeHtml(pair.label)} v návrhu">`
          : "<p>Referenční screenshot nebyl zachycen.</p>"}</figure>
      </div>
    </section>`;
  }).join("\n");
  const html = `<!doctype html>
<html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LuDone Desktop · porovnání s Astrou</title>
<style>
  :root{font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#202124;background:#f4f5f6}
  body{margin:0 auto;max-width:1400px;padding:28px}
  h1{font-size:28px;line-height:1.2;margin:0 0 8px} header{margin-bottom:24px}
  header p{max-width:80ch;color:#555}
  .pair{background:#fff;border:1px solid #d9dce0;border-radius:12px;padding:18px;margin:16px 0}
  .pair h2{font-size:19px;margin:0 0 4px}.pair>p{color:#555;margin:0 0 16px}
  .images{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
  figure{margin:0;min-width:0}figcaption{font-weight:600;margin-bottom:8px}
  img{display:block;max-width:100%;height:auto;border:1px solid #d9dce0;border-radius:8px;background:#fff}
  @media(max-width:760px){body{padding:14px}.images{grid-template-columns:1fr}}
</style>
<body><header><h1>Skutečná aplikace vedle schválené Astry</h1>
<p>Vlevo je screenshot z běžícího Electron rendereru, vpravo referenční screenshot návrhu. Automatické kontroly ověřují rozměry, hranice a pořadí klíčových prvků; neprokazují pixelovou shodu. Poznámky vysvětlují produktové rozdíly. Výsledek vizuálního porovnání zůstává oddělený.</p></header>
${cards}
</body></html>\n`;
  const filePath = path.join(outputDir, "comparison.html");
  await writeFile(filePath, html);
  return path.relative(projectRoot, filePath);
}

let processHandle;
let panel;
let settings;
let log = "";
let exitCode = 1;
let recordingFixture;
let recordingProof;
let updateProof;
const e2eEnvironment = {
  ...process.env,
  LUDONE_E2E: "1",
  LUDONE_DESIGN_E2E: "1",
  DESKTOP_UPLOAD_ENABLED: "false",
  LUDONE_E2E_HARD_STOP_MS: "120000",
  LUDONE_DATA_DIR: dataRoot,
};

function launchDesktop(port, extraEnvironment = {}) {
  // Izolovanou vizuální přejímku nesmí macOS pozastavit při zakrytí jiným oknem.
  // Neměníme produkt ani assertions; stejné neškrcené vykreslování má fixture audit.
  const child = spawn(electronBinary, [".", `--remote-debugging-port=${port}`,
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows"], {
    cwd: projectRoot,
    env: { ...e2eEnvironment, ...extraEnvironment },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => { log += chunk.toString(); });
  child.stderr.on("data", (chunk) => { log += chunk.toString(); });
  return child;
}

async function stopDesktop() {
  panel?.close();
  settings?.close();
  panel = null;
  settings = null;
  const child = processHandle;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(5_000)]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

async function installSyntheticAudioCapture(client) {
  const installed = await client.evaluate(`(() => {
    const devices = navigator.mediaDevices;
    if (!devices || typeof AudioContext !== 'function' || typeof MediaStream !== 'function') return false;
    const sources = [];
    function toneStream(frequency, withVideo) {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const destination = context.createMediaStreamDestination();
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.05;
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start();
      const tracks = [...destination.stream.getAudioTracks()];
      if (withVideo) {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        tracks.push(...canvas.captureStream(1).getVideoTracks());
      }
      sources.push({ context, oscillator, tracks, withVideo });
      return new MediaStream(tracks);
    }
    Object.defineProperty(devices, 'getUserMedia', {
      configurable: true,
      value: async (constraints) => {
        if (!constraints?.audio || constraints.video !== false) {
          throw new TypeError('E2E očekávalo jen syntetický mikrofon.');
        }
        return toneStream(440, false);
      },
    });
    Object.defineProperty(devices, 'getDisplayMedia', {
      configurable: true,
      value: async (constraints) => {
        if (constraints?.audio !== true || constraints.video !== true) {
          throw new TypeError('E2E očekávalo syntetický systémový zvuk.');
        }
        return toneStream(880, true);
      },
    });
    window.__ludoneE2ESyntheticAudio = {
      sourceCount: () => sources.length,
      loseSystemTrack: () => {
        const source = sources.find((item) => item.withVideo);
        const track = source?.tracks.find((item) => item.kind === 'audio');
        if (!track) return false;
        track.stop();
        // MediaStreamTrack.stop() sám událost ended nevyvolává. Fixtura
        // výslovně simuluje stejnou událost jako odebraný systémový zdroj OS.
        track.dispatchEvent(new Event('ended'));
        return true;
      },
      close: async () => {
        for (const source of sources) {
          try { source.oscillator.stop(); } catch { /* Může už být ukončená. */ }
          await source.context.close().catch(() => {});
        }
      },
    };
    return true;
  })()`);
  if (!installed) throw new Error("Nepodařilo se připravit syntetický, lokální zvukový zdroj.");
}

async function latestE2eRecording() {
  const recordingsDirectory = path.join(dataRoot, "user-data", "nahravky");
  const entries = await readdir(recordingsDirectory);
  const candidates = [];
  for (const name of entries.filter((item) => item.endsWith(".manifest.json"))) {
    const manifest = JSON.parse(await readFile(path.join(recordingsDirectory, name), "utf8"));
    if (manifest.clientRecordingId !== fixtureRecordingId && manifest.state === "complete") {
      candidates.push({ manifest, manifestPath: path.join(recordingsDirectory, name) });
    }
  }
  candidates.sort((first, second) => Date.parse(second.manifest.createdAt) - Date.parse(first.manifest.createdAt));
  return candidates[0] ?? null;
}

try {
  if (typeof electronBinary !== "string") throw new Error("Cesta k Electronu není dostupná.");
  recordingFixture = await seedLocalRecordingFixture();
  await captureAstraReferences();
  const port = await freePort();
  processHandle = launchDesktop(port);

  await waitFor(
    () => log.includes("Při startu obnoveno nahrávek: 1."),
    "obnovení místní nahrávky při startu aplikace",
  );
  observations.push({
    check: "startup-loads-seeded-local-fixture",
    recoveredFromDisk: true,
    uploadTransportEnabled: false,
    fixtureId: fixtureRecordingId,
  });

  panel = await connectTarget(
    port,
    (target) => target.type === "page" && target.url.includes("/dist/index.html")
      && !target.url.endsWith("#settings"),
    "Teď",
  );
  await waitFor(
    () => panel.evaluate(`Boolean(document.querySelector('.onboarding .welcome-step'))`),
    "první obrazovka onboardingu v izolovaném profilu",
  );
  const onboarding = await panel.evaluate(`(() => ({
    title: document.querySelector('.onboarding .welcome-step h1')?.innerText.replace(/\\s+/g, ' ').trim(),
    step: document.querySelector('.onboarding .step-count')?.textContent.trim(),
    start: [...document.querySelectorAll('.onboarding .welcome-step button')]
      .some((button) => button.textContent.trim() === 'Začít' && !button.disabled),
    timerIcon: Boolean(document.querySelector('.welcome-visual__node--timer')),
    copy: document.querySelector('.onboarding .welcome-step')?.textContent.replace(/\\s+/g, ' ').trim(),
  }))()`);
  if (onboarding.title !== "Váš pracovní den. O kousek jednodušší." || onboarding.step !== "1 / 6"
    || !onboarding.start || onboarding.timerIcon
    || onboarding.copy.includes("měřit čas") || onboarding.copy.includes("Měří čas")) {
    throw new Error(`První použití slibuje nepřipravený LuTrack nebo nemá bezpečný vstup: ${JSON.stringify(onboarding)}.`);
  }
  observations.push({ check: "onboarding-first-use-and-honest-scope", ...onboarding });
  await screenshot(panel, "00-prvni-pouziti");
  await clickByText(panel, "Začít");
  await waitFor(
    () => panel.evaluate(`Boolean(document.querySelector('.onboarding .auth-step'))`),
    "krok přihlášení v onboardingu",
  );
  const authOnboarding = await panel.evaluate(`(() => ({
    title: document.querySelector('.onboarding .auth-step h1')?.textContent.trim(),
    loginButton: [...document.querySelectorAll('.onboarding .auth-step button')]
      .some((button) => button.textContent.replace(/\\s+/g, ' ').trim() === 'Přihlásit v prohlížeči'),
    urlStarted: Boolean(document.querySelector('[data-testid="auth-waiting-screen"]')),
  }))()`);
  if (authOnboarding.title !== "Propojte svůj účet" || !authOnboarding.loginButton
    || authOnboarding.urlStarted) {
    throw new Error(`Úvodní přihlášení neodpovídá bezpečnému toku: ${JSON.stringify(authOnboarding)}.`);
  }
  observations.push({ check: "onboarding-account-step-without-external-login", ...authOnboarding });
  await screenshot(panel, "00-prihlaseni");
  await clickByText(panel, "Zpět");
  await panel.evaluate(`localStorage.setItem('ludone.prototype.onboarding-complete', 'true')`);
  await panel.send("Page.reload");
  await waitFor(
    () => panel.evaluate(`(() => Boolean(
      document.querySelector('.panel[data-panel-state="single-or-idle"] .desktop-navigation')
    ))()`),
    "panel Teď po kontrole místního stavu relace",
  );
  await waitFor(
    () => panel.evaluate(`Boolean(document.querySelector('[data-testid="day-preview"]')
      && !document.querySelector('[data-testid="day-preview"]').textContent.includes('Načítám stav fronty'))`),
    "skutečný místní přehled posledních nahrávek",
  );
  const panelState = await panel.evaluate(`(() => {
    const nav = document.querySelector('.panel .desktop-navigation');
    const titlebar = document.querySelector('.panel .desktop-titlebar');
    const menubar = document.querySelector('.panel .panel-header');
    const buttons = [...(nav?.querySelectorAll('button') || [])];
    const rect = nav?.getBoundingClientRect();
    const box = (element) => {
      const bounds = element?.getBoundingClientRect();
      return bounds ? { top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right } : null;
    };
    return {
      labels: buttons.map((button) => button.textContent.trim()),
      active: buttons.find((button) => button.getAttribute('aria-current') === 'page')?.textContent.trim(),
      width: innerWidth,
      height: innerHeight,
      navFits: Boolean(rect && rect.width > 0 && rect.left >= 0 && rect.right <= innerWidth + 1),
      titlebar: box(titlebar),
      menubar: box(menubar),
      markLoaded: document.querySelector('.panel-brand-mark')?.naturalWidth > 0,
      theme: document.documentElement.dataset.theme,
    };
  })()`);
  if (JSON.stringify(panelState.labels) !== JSON.stringify(["Teď", "Můj den", "Nastavení"])
    || panelState.active !== "Teď" || panelState.width !== 400 || panelState.height !== 700
    || !panelState.navFits || !panelState.markLoaded
    || panelState.titlebar.left !== 9 || panelState.titlebar.top !== 36
    || panelState.titlebar.right !== 391 || panelState.menubar.top !== 0
    || panelState.menubar.bottom !== 28) {
    throw new Error(`Panel Teď neodpovídá Astra shellu: ${JSON.stringify(panelState)}.`);
  }
  observations.push({ check: "panel-shell", ...panelState });
  await screenshot(panel, "ted");

  if (await panel.evaluate(`document.querySelector('.desktop-titlebar__quick-actions')?.getAttribute('aria-label')`)
    !== "Rychlé akce (⌘K)") {
    throw new Error("V Astra titlebaru chybí tlačítko rychlých akcí z Opus ikon.");
  }
  await clickSelector(panel, ".desktop-titlebar__quick-actions", "Rychlé akce");
  await waitFor(
    () => panel.evaluate(`document.querySelector('.desktop-quick-actions')?.open === true`),
    "otevření rychlých akcí tlačítkem z titlebaru",
  );
  const quickActions = await panel.evaluate(`(() => ({
    title: document.querySelector('#desktop-quick-actions-title')?.textContent.trim(),
    items: [...document.querySelectorAll('.desktop-quick-actions__item')]
      .map((button) => button.querySelector('strong')?.textContent.trim()),
    shortcut: [...document.querySelectorAll('.desktop-quick-actions kbd')]
      .some((key) => key.textContent.trim() === '⌘ K'),
  }))()`);
  if (quickActions.title !== "Rychlé akce"
    || !quickActions.items.includes("Můj den")
    || !quickActions.items.includes("Nahrávky")
    || !quickActions.items.includes("Nastavení účtu")
    || quickActions.items.includes("Nahrát schůzku")
    || !quickActions.shortcut) {
    throw new Error(`Rychlé akce neodpovídají oprávnění skutečné odhlášené relace: ${JSON.stringify(quickActions)}.`);
  }
  observations.push({ check: "quick-actions-and-auth-boundary", ...quickActions });
  await panel.send("Input.dispatchKeyEvent", {
    type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27,
  });
  await panel.send("Input.dispatchKeyEvent", {
    type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27,
  });
  await waitFor(
    () => panel.evaluate(`document.querySelector('.desktop-quick-actions')?.open === false`),
    "zavření rychlých akcí klávesou Escape",
  );

  const homeState = await panel.evaluate(`(() => {
    const hero = document.querySelector('.astra-work-hero');
    const title = hero?.querySelector('h1');
    const record = document.querySelector('.recording-card[data-recording-phase="idle"]');
    const recordAction = record?.querySelector('.idle-feature-row__action');
    const future = hero;
    const preview = document.querySelector('[data-testid="day-preview"]');
    const footer = document.querySelector('.panel-footer');
    const bounds = (element) => {
      const rect = element?.getBoundingClientRect();
      return rect ? {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      } : null;
    };
    return {
      futureStatus: future?.querySelector('.future-feature__status')?.textContent.trim(),
      title: title?.textContent.trim(),
      brand: document.querySelector('.desktop-titlebar__brand span')?.textContent.trim(),
      introCopy: hero?.querySelector(':scope > p')?.textContent.trim(),
      hero: bounds(hero),
      record: bounds(record),
      future: bounds(future),
      preview: bounds(preview),
      footer: bounds(footer),
      viewportHeight: innerHeight,
      recordAction: bounds(recordAction),
      recordActionVisible: Boolean(recordAction && recordAction.getBoundingClientRect().width > 0),
      recordActionEnabled: recordAction?.disabled === false,
      futureControls: [...(future?.querySelectorAll('button, a, input, select') || [])]
        .map((control) => ({ tag: control.tagName.toLowerCase(), disabled: control.disabled === true, visible: control.getClientRects().length > 0 })),
      sourceActionVisible: Boolean(document.querySelector('.recording-card__sources')?.getBoundingClientRect().width > 0),
      sourceActionEnabled: document.querySelector('.recording-card__sources')?.disabled === false,
      previewTitle: preview?.querySelector('h2')?.textContent.trim(),
      previewEmpty: preview?.querySelector('.day-preview__empty')?.textContent.trim(),
      previewItems: [...(preview?.querySelectorAll('.day-preview__item') || [])].map((item) =>
        item.textContent.replace(/\\s+/g, ' ').trim()),
      titleFont: getComputedStyle(title).fontFamily,
      titleAlign: getComputedStyle(title).textAlign,
      topline: bounds(hero?.querySelector('.astra-work-hero__topline')),
      navActive: document.querySelector('.desktop-navigation [aria-current="page"]')?.textContent.trim(),
    };
  })()`);
  if (homeState.title !== "Pracovní čas se připravuje."
    || homeState.navActive !== "Teď"
    || homeState.brand !== "LuDone"
    || !homeState.introCopy?.includes("Nahrávání schůzek funguje")
    || !homeState.recordActionVisible || !homeState.recordActionEnabled
    || !homeState.recordAction || homeState.recordAction.width < 330
    || homeState.recordAction.top < homeState.record.top || homeState.recordAction.bottom > homeState.record.bottom
    || homeState.futureControls.length !== 3
    || !homeState.futureControls.every((control) => control.disabled)
    || !homeState.sourceActionVisible || !homeState.sourceActionEnabled
    || homeState.previewTitle !== "Nahrávky"
    || homeState.previewItems.length !== 1
    || !compactText(homeState.previewItems[0]).includes("macu")
    || compactText(homeState.previewItems[0]).includes("čekánaodeslání")
    || compactText(homeState.previewItems[0]).includes("odesláno")
    || homeState.futureStatus !== "Připravujeme"
    || !homeGeometryValid(homeState)
    || homeState.titleAlign !== "left"
    || !homeState.titleFont.includes("Public Sans")) {
    throw new Error(`Teď neodpovídá Astra kompozici nebo funkčním hranicím: ${JSON.stringify(homeState)}.`);
  }
  observations.push({ check: "now-hierarchy-and-safe-actions", ...homeState });
  observations.push({
    check: "lutrack-remains-disabled",
    label: "LuTrack se připravuje",
    disabledControlCount: homeState.futureControls.length,
    enabledControlCount: homeState.futureControls.filter((control) => !control.disabled).length,
  });

  await installSyntheticAudioCapture(panel);
  await clickSelector(panel, ".recording-card .idle-feature-row__action", "Nahrát syntetickou schůzku");
  await waitFor(
    () => panel.evaluate(`(() => {
      const status = document.querySelector('[data-testid="recording-running-state"]');
      const sources = [...document.querySelectorAll('.recording-source[data-testid^="recording-source-"]')];
      return Boolean(status && sources.length === 2
        && sources.every((source) => source.dataset.sourceState === 'live'));
    })()`),
    "živé syntetické mikrofonní a systémové zdroje",
  );
  await delay(1_250);
  const recordingActive = await panel.evaluate(`(() => {
    const status = document.querySelector('[data-testid="recording-running-state"]');
    return {
    label: [...(status?.children || [])]
      .find((element) => element.tagName === 'SPAN' && !element.classList.contains('activity-status__dot'))
      ?.textContent.trim(),
    sources: [...document.querySelectorAll('.recording-source[data-testid^="recording-source-"]')]
      .map((source) => ({ id: source.dataset.testid, state: source.dataset.sourceState })),
    syntheticStreams: window.__ludoneE2ESyntheticAudio?.sourceCount(),
  };
  })()`);
  if (recordingActive.label !== "Nahrává se" || recordingActive.sources.length !== 2
    || recordingActive.sources.some((source) => source.state !== "live")
    || recordingActive.syntheticStreams !== 2) {
    throw new Error(`Záznam nespustil obě syntetické stopy: ${JSON.stringify(recordingActive)}.`);
  }
  observations.push({ check: "recording-starts-two-synthetic-sources", ...recordingActive });

  await panel.send("Network.enable");
  await panel.send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
    connectionType: "none",
  });
  await waitFor(
    () => panel.evaluate("navigator.onLine === false && Boolean(document.querySelector('[data-testid=\"offline-notice\"]'))"),
    "offline stav při probíhajícím záznamu",
  );
  const offlineRecording = await panel.evaluate(`(() => {
    const status = document.querySelector('[data-testid="recording-running-state"]');
    return ({
    online: navigator.onLine,
    recording: [...(status?.children || [])]
      .find((element) => element.tagName === 'SPAN' && !element.classList.contains('activity-status__dot'))
      ?.textContent.trim(),
    recordingTitle: document.querySelector('.recording-running__title')?.textContent.trim(),
    recordingFormat: document.querySelector('.recording-running__format')?.textContent.trim(),
    liveSources: [...document.querySelectorAll('.recording-source[data-testid^="recording-source-"]')]
      .filter((source) => source.dataset.sourceState === 'live').length,
    notice: document.querySelector('[data-testid="offline-notice"]')?.textContent.replace(/\\s+/g, ' ').trim(),
    lutrack: (() => {
      const hero = document.querySelector('.astra-work-hero');
      const rect = hero?.getBoundingClientRect();
      return rect ? {
        visible: rect.width > 0 && rect.height > 0,
        height: Math.round(rect.height),
        status: hero.querySelector('.future-feature__status')?.textContent.trim(),
        recordingNote: hero.querySelector('.astra-work-hero__recording-note')?.textContent.replace(/\\s+/g, ' ').trim(),
        recordingNoteVisible: hero.querySelector('.astra-work-hero__recording-note')?.getClientRects().length > 0,
        noteBesideStatus: (() => {
          const statusRect = hero.querySelector('.future-feature__status')?.getBoundingClientRect();
          const noteRect = hero.querySelector('.astra-work-hero__recording-note')?.getBoundingClientRect();
          return Boolean(statusRect && noteRect && noteRect.left >= statusRect.right && noteRect.top < statusRect.bottom && noteRect.bottom > statusRect.top);
        })(),
        controls: [...hero.querySelectorAll('button, input, select')]
          .map((control) => ({ disabled: control.disabled === true, visible: control.getClientRects().length > 0 })),
      } : { visible: false, height: null, status: null, controls: [] };
    })(),
    recordingCard: (() => {
      const card = document.querySelector('.recording-card[data-recording-phase="recording"]');
      const rect = card?.getBoundingClientRect();
      return rect ? {
        top: Math.round(rect.top),
        height: Math.round(rect.height),
        bottom: Math.round(rect.bottom),
        borderTopWidth: getComputedStyle(card).borderTopWidth,
      } : null;
    })(),
    layout: (() => {
      const box = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height), width: Math.round(rect.width) };
      };
      return {
        status: box('[data-testid="recording-running-state"]'),
        title: box('.recording-running__title'),
        timer: box('.recording-running .elapsed'),
        sources: [...document.querySelectorAll('.recording-source[data-testid^="recording-source-"]')]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) };
          }),
        sourceAction: box('[data-testid="recording-open-sources"]'),
        stop: box('[data-testid="recording-stop"]'),
        luTrack: box('.astra-work-hero'),
      };
    })(),
    stopAction: (() => {
      const action = document.querySelector('[data-testid="recording-stop"]');
      const footer = document.querySelector('.panel-footer')?.getBoundingClientRect();
      const rect = action?.getBoundingClientRect();
      return rect ? {
        visible: rect.width > 0 && rect.height > 0,
        aboveFooter: !footer || rect.bottom <= footer.top,
      } : { visible: false, aboveFooter: false };
    })(),
    horizontalExtent: (() => {
      const element = document.querySelector('.panel-scroll');
      const overflowing = [...document.querySelectorAll('.panel-scroll *')]
        .filter((child) => !child.classList.contains('sr-only'))
        .filter((child) => child.getBoundingClientRect().width > 0
          && (child.scrollWidth > child.clientWidth + 1
            || child.getBoundingClientRect().left < element.getBoundingClientRect().left - 1
            || child.getBoundingClientRect().right > element.getBoundingClientRect().right + 1))
        .slice(0, 12)
        .map((child) => ({
          tag: child.tagName.toLowerCase(),
          className: typeof child.className === 'string' ? child.className : '',
          client: child.clientWidth,
          scroll: child.scrollWidth,
          left: Math.round(child.getBoundingClientRect().left),
          right: Math.round(child.getBoundingClientRect().right),
        }));
      return {
        client: element?.clientWidth ?? null,
        scroll: element?.scrollWidth ?? null,
        overflowing,
      };
    })(),
  });
  })()`);
  if (offlineRecording.online || offlineRecording.recording !== "Nahrává se"
    || offlineRecording.recordingTitle !== "Nahrávání schůzky"
    || offlineRecording.recordingFormat !== "Výsledkem bude jedna stereo nahrávka."
    || offlineRecording.liveSources !== 2
    || !offlineRecording.lutrack.visible || offlineRecording.lutrack.height !== 53
    || offlineRecording.lutrack.status !== "Připravujeme"
    || !offlineRecording.lutrack.recordingNoteVisible
    || !offlineRecording.lutrack.recordingNote?.includes("Pracovní čas se zatím neměří")
    || !offlineRecording.lutrack.noteBesideStatus
    || offlineRecording.lutrack.controls.length !== 3
    || offlineRecording.lutrack.controls.some((control) => !control.disabled || control.visible)
    || !offlineRecording.recordingCard || offlineRecording.recordingCard.height < 340
    || !offlineRecording.stopAction.visible || !offlineRecording.stopAction.aboveFooter
    || offlineRecording.horizontalExtent.client !== offlineRecording.horizontalExtent.scroll
    || offlineRecording.horizontalExtent.overflowing.length !== 0
    || !offlineRecording.notice?.includes("Nahrávky zůstávají na Macu.")) {
    throw new Error(`Probíhající offline záznam nepokračuje bezpečně: ${JSON.stringify(offlineRecording)}.`);
  }
  observations.push({ check: "offline-recording-continues-locally", ...offlineRecording });
  const recordingLayout = offlineRecording.layout;
  if (offlineRecording.recordingCard.borderTopWidth !== "0px"
    || !recordingLayout.sourceAction || recordingLayout.sourceAction.height < 18
    || recordingLayout.sources.length !== 2
    || !(recordingLayout.status.bottom <= recordingLayout.title.top
      && recordingLayout.title.bottom <= recordingLayout.timer.top
      && recordingLayout.timer.bottom <= recordingLayout.sources[0].top
      && recordingLayout.sources[0].bottom <= recordingLayout.sources[1].top
      && recordingLayout.sources[1].bottom <= recordingLayout.stop.top
      && recordingLayout.stop.bottom <= recordingLayout.luTrack.top)) {
    throw new Error(`Rozvržení probíhající nahrávky se rozchází s Astrou nebo se prvky překrývají: ${JSON.stringify(recordingLayout)}.`);
  }
  observations.push({ check: "astra-layout-offline", ...recordingLayout });
  await screenshot(panel, "offline-active-recording");
  await panel.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
    connectionType: "wifi",
  });
  await waitFor(() => panel.evaluate("navigator.onLine === true"), "síť po offline záznamu");

  if (!await panel.evaluate("window.__ludoneE2ESyntheticAudio.loseSystemTrack()")) {
    throw new Error("Fixtura nedokázala odebrat syntetický systémový zdroj.");
  }
  await waitFor(() => panel.evaluate(`Boolean(document.querySelector('[data-testid="system-audio-outage"]'))
    && document.querySelector('[data-testid="recording-source-system"]')?.dataset.sourceState === 'lost'
    && document.querySelector('[data-testid="recording-source-microphone"]')?.dataset.sourceState === 'live'`), 'ztracený systémový zvuk s pokračujícím mikrofonem');
  await screenshot(panel, "vypadek-systemoveho-zvuku");
  await clickSelector(panel, '[data-testid="retry-system-audio"]', 'Obnovit syntetický systémový zdroj');
  await waitFor(() => panel.evaluate(`!document.querySelector('[data-testid="system-audio-outage"]')
    && document.querySelector('[data-testid="recording-source-system"]')?.dataset.sourceState === 'live'
    && Boolean(document.querySelector('[data-testid="recording-stop"]'))`), 'obnovený systémový zvuk a dostupné dokončení');
  observations.push({ check: "system-audio-loss-and-recovery", syntheticOnly: true, microphoneContinued: true, sourceRecovered: true });
  await clickSelector(panel, '[data-testid="recording-stop"]', "Ukončit a uložit syntetický záznam");
  await waitFor(
    () => panel.evaluate(`Boolean(document.querySelector('.recording-saved')
      && document.querySelector('[data-testid="skip-recording-name"]')
      && document.querySelector('.recording-saved button[type="submit"]'))`),
    "dialog volby po dokončení záznamu",
    30_000,
  );
  const saveChoice = await panel.evaluate(`({
    title: document.querySelector('.recording-saved h2')?.textContent.trim(),
    keepEnabled: document.querySelector('[data-testid="skip-recording-name"]')?.disabled === false,
    sendDisabled: document.querySelector('.recording-saved button[type="submit"]')?.disabled === true,
  })`);
  if (saveChoice.title !== "Kam s nahrávkou?" || !saveChoice.keepEnabled || !saveChoice.sendDisabled) {
    throw new Error(`Volba uložení neodpovídá odhlášenému účtu: ${JSON.stringify(saveChoice)}.`);
  }
  observations.push({ check: "recording-stop-offers-explicit-safe-choice", ...saveChoice });
  const saveLayout = await panel.evaluate(`(() => {
    const box = (selector) => { const element = document.querySelector(selector); const rect = element?.getBoundingClientRect(); return rect ? {top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height} : null; };
    return { header: box('.panel-header'), nav: box('.desktop-navigation'), preview: box('.recording-saved__meta'), name: box('#recording-name'), send: box('.recording-saved button[type="submit"]'), keep: box('[data-testid="skip-recording-name"]'), footer: box('.panel-footer'), format: document.querySelector('.recording-saved__format')?.textContent.trim() };
  })()`);
  if (!saveLayout.header || saveLayout.header.top < 0 || saveLayout.header.bottom > 36
    || !saveLayout.preview || !saveLayout.format?.includes('Jedna nahrávka schůzky')
    || !saveLayout.name || !saveLayout.send || !saveLayout.keep || !saveLayout.footer
    || saveLayout.send.width < 300 || saveLayout.keep.width < 300
    || !(saveLayout.preview.bottom <= saveLayout.name.top && saveLayout.name.bottom <= saveLayout.send.top
      && saveLayout.send.bottom <= saveLayout.keep.top && saveLayout.keep.bottom <= saveLayout.footer.top)) {
    throw new Error(`Uložení nahrávky neodpovídá společnému Astra shellu a pořadí: ${JSON.stringify(saveLayout)}.`);
  }
  observations.push({ check: "saved-recording-astra-composition", ...saveLayout });
  await screenshot(panel, "nahravani-ulozeno");

  const completedManifest = await waitFor(latestE2eRecording, "dokončený lokální manifest z reálného UI toku", 15_000);
  const trackDetails = [];
  for (const [source, track] of Object.entries(completedManifest.manifest.tracks ?? {})) {
    const filePath = path.join(path.dirname(completedManifest.manifestPath), track.fileName);
    const info = await stat(filePath);
    trackDetails.push({ source, bytes: info.size });
  }
  if (completedManifest.manifest.state !== "complete" || trackDetails.length !== 2
    || trackDetails.some((track) => track.bytes <= 0)) {
    throw new Error(`Záznam neuložil dvě kompletní místní stopy: ${JSON.stringify(trackDetails)}.`);
  }
  recordingProof = {
    id: completedManifest.manifest.clientRecordingId,
    manifest: path.relative(projectRoot, completedManifest.manifestPath),
    tracks: trackDetails,
    syntheticOnly: true,
    uploadTransportEnabled: false,
  };
  await clickSelector(panel, '[data-testid="skip-recording-name"]', "Nechat na Macu");
  await waitFor(
    () => panel.evaluate(`(() => {
      const notice = document.querySelector('.idle-feature-row__notice--success');
      return Boolean(!document.querySelector('.recording-saved')
        && notice?.textContent.includes('jen na tomto Macu'));
    })()`),
    "potvrzení uložení jen na Macu",
    45_000,
  );
  const downloadsDirectory = path.join(dataRoot, "downloads");
  const downloads = await readdir(downloadsDirectory);
  const exportedWebms = [];
  for (const name of downloads.filter((item) => item.endsWith(".webm"))) {
    const info = await stat(path.join(downloadsDirectory, name));
    if (info.isFile() && info.size > 0) exportedWebms.push({ name, bytes: info.size });
  }
  if (exportedWebms.length !== 1) {
    throw new Error(`Volba „Nechat na Macu“ nevytvořila právě jeden místní WebM: ${JSON.stringify(exportedWebms)}.`);
  }
  recordingProof.savedCopy = exportedWebms[0];
  recordingProof.decision = "keep";
  recordingProof.uploadSetting = e2eEnvironment.DESKTOP_UPLOAD_ENABLED;
  await panel.evaluate("window.__ludoneE2ESyntheticAudio?.close()");
  observations.push({ check: "recording-saved-local-from-ui", ...recordingProof });

  const restartLogOffset = log.length;
  await stopDesktop();
  processHandle = launchDesktop(port);
  await waitFor(
    () => log.slice(restartLogOffset).includes("[queue] odesláno 0,"),
    "dokončení obnovy lokální fronty po restartu",
  );
  const restartLog = log.slice(restartLogOffset);
  if (restartLog.includes("Obnovenou nahrávku se nepodařilo zapsat do fronty")) {
    throw new Error("Obnova po restartu nahlásila chybu zápisu fronty.");
  }
  panel = await connectTarget(
    port,
    (target) => target.type === "page" && target.url.includes("/dist/index.html")
      && !target.url.endsWith("#settings"),
    "Teď po restartu",
  );
  await waitFor(
    () => panel.evaluate(`document.querySelectorAll('[data-testid="day-preview"] .day-preview__item').length === 2`),
    "obnovení obou lokálních záznamů v panelu po restartu",
  );
  observations.push({
    check: "saved-recording-visible-after-app-restart",
    queueReadyAfterRestart: restartLog.includes("[queue] odesláno 0,"),
    localRecordingsVisible: 2,
    recordingId: recordingProof.id,
  });

  await clickSelector(panel, ".recording-card__sources", "Zdroje zvuku");
  settings = await connectTarget(
    port,
    (target) => target.type === "page" && target.url.includes("/dist/index.html")
      && target.url.includes("#settings") && target.url.includes("settingsTab=audio"),
    "nastavení zvuku",
  );
  await waitFor(
    () => settings.evaluate(`document.querySelector('#settings-panel-audio')
      && document.querySelector('#settings-tab-audio')?.getAttribute('aria-selected') === 'true'`),
    "otevření nastavení zvuku z tlačítka Zdroje zvuku",
  );
  const audioSettings = await settings.evaluate(`({
    selectedTab: document.querySelector('.settings-tabs [aria-selected="true"]')?.textContent.trim(),
    audioPanelVisible: document.querySelector('#settings-panel-audio')?.hidden === false,
  })`);
  if (audioSettings.selectedTab !== "Zvuk" || !audioSettings.audioPanelVisible) {
    throw new Error(`Zdroje zvuku neotevřely správnou záložku: ${JSON.stringify(audioSettings)}.`);
  }
  observations.push({ check: "source-action-opens-audio-settings", ...audioSettings });

  await panel.send("Network.enable");
  await panel.send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
    connectionType: "none",
  });
  await waitFor(
    () => panel.evaluate(`navigator.onLine === false
      && document.querySelector('.desktop-menubar__status')?.getAttribute('aria-label')?.includes('Bez připojení')`),
    "offline stav v panelu",
  );
  const offline = await panel.evaluate(`(() => ({
    online: navigator.onLine,
    status: document.querySelector('.desktop-menubar__status')?.getAttribute('aria-label'),
    notice: document.querySelector('[data-testid="offline-notice"]')?.textContent.replace(/\\s+/g, ' ').trim(),
    noticeBounds: (() => {
      const rect = document.querySelector('[data-testid="offline-notice"]')?.getBoundingClientRect();
      return rect ? { left: rect.left, right: rect.right, width: rect.width } : null;
    })(),
    rows: [...(document.querySelectorAll('[data-testid="day-preview"] .day-preview__item') || [])]
      .map((item) => item.textContent.replace(/\\s+/g, ' ').trim()),
    horizontalExtent: {
      document: { client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth },
      body: { client: document.body.clientWidth, scroll: document.body.scrollWidth },
      panel: (() => {
        const element = document.querySelector('.panel');
        return element ? { client: element.clientWidth, scroll: element.scrollWidth } : null;
      })(),
      panelScroll: (() => {
        const element = document.querySelector('.panel-scroll');
        return element ? { client: element.clientWidth, scroll: element.scrollWidth } : null;
      })(),
    },
  }))()`);
  if (offline.online || !offline.status.includes("Bez připojení") || offline.rows.length !== 2
    || !compactText(offline.rows[0]).includes("macu")
    || compactText(offline.rows[0]).includes("odesláno")
    || offline.rows.some((row) => !compactText(row).includes("macu"))
    || !offline.notice?.includes("Bez připojení. Nahrávky zůstávají na Macu.")
    || !offline.notice.includes("Synchronizace a odesílání počkají.")
    || !offline.noticeBounds || offline.noticeBounds.left < 0 || offline.noticeBounds.right > 400) {
    throw new Error(`Offline panel neukazuje bezpečný místní stav: ${JSON.stringify(offline)}.`);
  }
  observations.push({ check: "offline-keeps-local-recording", ...offline });
  await screenshot(panel, "offline-panel-recovery");
  await panel.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
    connectionType: "wifi",
  });
  await waitFor(() => panel.evaluate("navigator.onLine === true"), "obnovení síťového stavu");

  await clickByText(panel, "Můj den");
  settings = await connectTarget(
    port,
    (target) => target.type === "page" && target.url.includes("/dist/index.html")
      && target.url.includes("#settings"),
    "Můj den",
  );
  await waitFor(
    () => settings.evaluate(`(() => document.querySelector('.recordings-dashboard')
      && document.querySelector('.settings-window')?.dataset.page === 'day')()`),
    "Můj den a lokální přehled",
  );
  await waitFor(
    () => settings.evaluate(`Boolean(document.querySelector(
      '.recordings-dashboard__empty, .recordings-dashboard__list, .recordings-dashboard__error'
    ))`),
    "dokončené načtení místních nahrávek",
  );
  const day = await settings.evaluate(`(async () => {
    const nav = document.querySelector('.desktop-navigation');
    const title = document.querySelector('.desktop-day-intro h1');
    const future = document.querySelector('[aria-label="LuTrack připravujeme"]');
    const dashboard = document.querySelector('.recordings-dashboard');
    const actual = await window.ludone.listLocalRecordings();
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
    };
    return {
      title: title?.textContent.trim(),
      active: [...nav.querySelectorAll('button')]
        .find((button) => button.getAttribute('aria-current') === 'page')?.textContent.trim(),
      viewport: { width: innerWidth, height: innerHeight },
      heading: box(title),
      future: box(future),
      dashboard: box(dashboard),
      layout: {
        toolbar: box(document.querySelector('.recordings-dashboard__toolbar')),
        notice: box(document.querySelector('.recordings-dashboard__notice')),
        groups: [...document.querySelectorAll('.recordings-day__heading')].map(box),
        groupKeys: [...document.querySelectorAll('.recordings-day')].map(group => group.dataset.day),
        actualGroupKeys: [...new Set(actual.items.map(item => {
          const date = new Date(item.createdAt);
          return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
        }))].sort().reverse(),
        textClipping: [...document.querySelectorAll('.recordings-timeline__time, .recording-queue-card__summary .recording-queue-card__delivery')]
          .some(element => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1),
        times: [...document.querySelectorAll('.recordings-timeline__time')].map(box),
        statuses: [...document.querySelectorAll('.recording-queue-card__summary .recording-queue-card__delivery')].map(box),
        entries: [...document.querySelectorAll('.recordings-dashboard__list li[data-recording-id]')].slice(0, 2)
          .map((entry) => box(entry.querySelector('.recording-queue-card__summary'))),
        footer: box(document.querySelector('.settings-footer')),
        horizontalOverflow: document.querySelector('.settings-content').scrollWidth
          > document.querySelector('.settings-content').clientWidth + 1,
      },
      futureControls: [...(future?.querySelectorAll('button, a, input, select') || [])]
        .map((control) => ({ tag: control.tagName.toLowerCase(), disabled: control.disabled === true })),
      renderedRows: document.querySelectorAll('.recordings-dashboard__list li[data-recording-id]').length,
      realRows: actual.items.length + actual.unreadableCount,
      fixture: actual.items.find((item) => item.id === ${JSON.stringify(fixtureRecordingId)}) ?? null,
      recordedByE2e: actual.items.find((item) => item.id === ${JSON.stringify(recordingProof.id)}) ?? null,
      fixtureRowText: document.querySelector('[data-recording-id="${fixtureRecordingId}"]')
        ?.textContent.replace(/\\s+/g, ' ').trim() ?? null,
      recordedRowText: document.querySelector('[data-recording-id="${recordingProof.id}"]')
        ?.textContent.replace(/\\s+/g, ' ').trim() ?? null,
      firstRowText: document.querySelector('.recordings-dashboard__list li[data-recording-id]')?.textContent.replace(/\\s+/g, ' ').trim() ?? null,
      emptyState: document.querySelector('.recordings-dashboard__empty')?.textContent.trim() ?? null,
    };
  })()`);
  const inBounds = (box) => box.width > 0 && box.height > 0 && box.left >= 0
    && box.right <= day.viewport.width + 1 && box.top >= 0 && box.top < day.viewport.height;
  if (day.title !== "Stopa dne" || day.active !== "Můj den"
    || day.viewport.width !== 640 || day.viewport.height !== 744
    || !inBounds(day.heading) || !inBounds(day.future) || !inBounds(day.dashboard)
    || !(day.heading.top < day.dashboard.top && day.future.top < day.dashboard.top
      && day.heading.bottom <= day.dashboard.top && day.future.bottom <= day.dashboard.top)
    || day.futureControls.length !== 0 || day.renderedRows !== day.realRows || day.realRows !== 2
    || day.fixture?.id !== fixtureRecordingId
    || day.fixture?.localState !== "complete-audio"
    || day.fixture?.source !== "queue"
    || day.fixture?.state !== "ceka"
    || day.fixture?.uploadIntent !== "held"
    || day.recordedByE2e?.id !== recordingProof.id
    || day.recordedByE2e?.localState !== "complete-audio"
    || day.recordedByE2e?.uploadIntent !== "held"
    || day.fixtureRowText?.includes("Odesláno podle stavu fronty")
    || !day.fixtureRowText?.includes("Zvuk je kompletní")
    || !day.recordedRowText?.includes("Zvuk je kompletní")) {
    throw new Error(`Můj den neodpovídá schválené hierarchii nebo skutečným lokálním datům: ${JSON.stringify(day)}.`);
  }
  observations.push({ check: "day-hierarchy-and-real-data", ...day });
  const dayLayout = day.layout;
  if (day.heading.top < 145 || day.heading.top > 205
    || Math.abs(dayLayout.toolbar.top - 240) > 2
    || !dayLayout.notice || dayLayout.notice.height > 42
    || dayLayout.notice.bottom > dayLayout.entries[0]?.top
    || dayLayout.entries.length !== 2
    || dayLayout.entries.some((entry) => !entry || Math.abs(entry.height - 98) > 2)
    || Math.abs(dayLayout.entries[0].top - 364) > 2
    || dayLayout.entries[1].top <= dayLayout.entries[0].top
    || dayLayout.footer.height !== 44 || dayLayout.footer.top !== 691
    || dayLayout.footer.bottom > day.viewport.height
    || dayLayout.entries[1]?.bottom > dayLayout.footer.top || dayLayout.horizontalOverflow
    || !timelineGeometryValid(dayLayout)) {
    throw new Error(`Rozvržení Mého dne neodpovídá kompozici Astry nebo obsah přetéká: ${JSON.stringify(dayLayout)}.`);
  }
  observations.push({ check: "astra-layout-day", ...dayLayout });
  const savedFixture = JSON.parse(await readFile(recordingFixture.manifestPath, "utf8"));
  const savedFixtureAudio = await readFile(recordingFixture.audioPath);
  if (savedFixture.state !== "complete" || savedFixtureAudio.byteLength === 0
    || day.fixture?.uploadIntent !== "held" || day.fixture?.allowedActions?.send !== false) {
    throw new Error("Lokální výsledek záznamu není bezpečný nebo chybí na disku.");
  }
  observations.push({
    check: "day-shows-actual-recording-and-seeded-local-fixture",
    manifestState: savedFixture.state,
    audioBytes: savedFixtureAudio.byteLength,
    uploadIntent: day.fixture.uploadIntent,
    sendAvailable: day.fixture.allowedActions.send,
    uploadSetting: e2eEnvironment.DESKTOP_UPLOAD_ENABLED,
  });
  await screenshot(settings, "muj-den");

  const recordingDetailSelector = `[data-recording-id="${recordingProof.id}"] [data-testid="recording-detail"] > summary`;
  await clickSelector(settings, recordingDetailSelector, "Detail skutečně pořízené nahrávky");
  await waitFor(
    () => settings.evaluate(`document.querySelector('[data-recording-id="${recordingProof.id}"] [data-testid="recording-detail"]')?.open === true`),
    "otevření detailu lokální nahrávky",
  );
  await waitFor(
    () => settings.evaluate(`document.querySelector('.settings-window--recording-detail') !== null`),
    "přechod na detailní plochu nahrávky",
  );
  const detail = await settings.evaluate(`(() => {
    const row = document.querySelector('[data-recording-id="${recordingProof.id}"]');
    const card = row?.querySelector('[data-testid="recording-detail"]');
    const buttons = [...(card?.querySelectorAll('button') || [])];
    const claim = buttons.find((button) => button.textContent.trim() === 'Převzít pod svůj účet');
    const soundValue = [...(card?.querySelectorAll('.recording-queue-card__storage dt') || [])]
      .find(item => item.textContent.trim() === 'Zvuk')?.nextElementSibling;
    return {
      open: card?.open === true,
      id: row?.dataset.recordingId,
      source: card?.querySelector('.recording-queue-card__storage')?.textContent.includes('Místní fronta'),
      localState: row?.querySelector('.recording-queue-card__local')?.textContent.trim(),
      delivery: row?.querySelector('.recording-queue-card__storage-heading .recording-queue-card__delivery')?.textContent.trim(),
      uploadIntent: row?.dataset.uploadIntent,
      backToDay: card?.querySelector('.recording-queue-card__back')?.textContent.includes('Zpět na den'),
      title: card?.querySelector('.recording-queue-card__detail-heading h1')?.textContent.trim(),
      stages: [...(card?.querySelectorAll('.recording-queue-card__journey li') || [])]
        .map((step) => ({ label: step.textContent.trim(), complete: step.classList.contains('is-complete') })),
      soundFormat: soundValue?.textContent.trim(),
      sendActionVisible: buttons.some((button) => button.textContent.trim() === 'Uložit a odeslat'),
      claimDisabled: claim?.disabled,
    };
  })()`);
  if (!detail.open || detail.id !== recordingProof.id || detail.source !== true
    || detail.localState !== "Zvuk připraven"
    || !detail.soundFormat?.includes("Stereo WebM/Opus")
    || detail.soundFormat.includes("MP3")
    || detail.delivery !== "Zůstává na Macu"
    || detail.uploadIntent !== "held" || detail.sendActionVisible || detail.claimDisabled !== true
    || !detail.backToDay || !detail.title || detail.stages.length !== 4
    || !detail.stages[0].complete || detail.stages.slice(1).some((step) => step.complete)) {
    throw new Error(`Detail lokální nahrávky není pravdivý nebo bezpečný: ${JSON.stringify(detail)}.`);
  }
  observations.push({ check: "local-recording-detail-no-upload", ...detail });
  await settings.evaluate(`document.querySelector('.settings-content')?.scrollTo({ top: 0 })`);
  await waitFor(
    () => settings.evaluate(`(() => {
      const card = document.querySelector('[data-testid="recording-detail"]');
      const button = [...(card?.querySelectorAll('button') || [])]
        .find((item) => item.textContent.trim() === 'Přesunout do koše');
      const rect = button?.getBoundingClientRect();
      return Boolean(rect && rect.top >= 0 && rect.bottom <= innerHeight - 48);
    })()`),
    "viditelné bezpečné akce v detailu",
  );
  const detailLayout = await settings.evaluate(`(() => {
    const boxFor = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), height: Math.round(rect.height) };
    };
    const card = document.querySelector('[data-recording-id="${recordingProof.id}"] [data-testid="recording-detail"]');
    const box = (selector) => boxFor(card?.querySelector(selector));
    const content = document.querySelector('.settings-content');
    const footer = document.querySelector('.settings-footer');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      back: box('.recording-queue-card__back'),
      heading: box('.recording-queue-card__detail-heading'),
      journey: box('.recording-queue-card__journey'),
      storage: box('.recording-queue-card__storage'),
      context: box('.recording-queue-card__context-card'),
      note: box('.recording-queue-card__web-note'),
      actions: box('.recording-queue-card__actions'),
      actionComposition: {
        claim: box('.recording-action--claim'),
        reveal: box('.recording-action--reveal'),
        delete: box('.recording-action--delete'),
      },
      sourceIconVisible: (card?.querySelector('.recording-queue-card__source-icon')
        ?.getBoundingClientRect().width ?? 0) > 0,
      visibleActions: [...(card?.querySelectorAll('.recording-queue-card__actions > button') || [])]
        .filter((button) => button.getBoundingClientRect().width > 0)
        .map((button) => ({ label: button.textContent.trim(), ...boxFor(button) })),
      footer: footer ? { display: getComputedStyle(footer).display, ...boxFor(footer) } : null,
      horizontalOverflow: content.scrollWidth > content.clientWidth + 1,
    };
  })()`);
  const detailVisible = (box) => box && box.width > 0 && box.height > 0
    && box.top >= 0 && box.bottom <= detailLayout.viewport.height - 44
    && box.left >= 0 && box.right <= detailLayout.viewport.width;
  const { claim, reveal, delete: deleteAction } = detailLayout.actionComposition;
  const actionHierarchyMatches = claim && reveal && deleteAction
    && claim.left <= detailLayout.actions.left + 1
    && claim.right >= detailLayout.actions.right - 1
    && reveal.top === deleteAction.top
    && reveal.bottom === deleteAction.bottom
    && reveal.right < deleteAction.left;
  if (detailLayout.viewport.width !== 640 || detailLayout.viewport.height !== 744
    || detailLayout.back.top < 150 || detailLayout.back.top > 180
    || detailLayout.heading.top < 180 || detailLayout.heading.top > 210
    || detailLayout.storage.top < 320 || detailLayout.storage.top > 370
    || !detailVisible(detailLayout.back) || !detailVisible(detailLayout.heading)
    || !detailVisible(detailLayout.journey) || !detailVisible(detailLayout.storage)
    || !detailVisible(detailLayout.context) || !detailVisible(detailLayout.note)
    || !detailVisible(detailLayout.actions) || detailLayout.visibleActions.length === 0
    || detailLayout.visibleActions.some((action) => !detailVisible(action))
    || !actionHierarchyMatches
    || detailLayout.sourceIconVisible
    || detailLayout.footer?.display !== "flex" || detailLayout.footer?.height !== 44
    || detailLayout.actions.bottom > detailLayout.footer.top || detailLayout.horizontalOverflow
    || !(detailLayout.back.bottom <= detailLayout.heading.top
      && detailLayout.heading.bottom <= detailLayout.journey.top
      && detailLayout.journey.bottom <= detailLayout.storage.top
      && detailLayout.storage.bottom <= detailLayout.context.top
      && detailLayout.context.bottom <= detailLayout.note.top
      && detailLayout.note.bottom <= detailLayout.actions.top)) {
    throw new Error(`Detail není celý čitelný nad spodní lištou a v pořadí schválené Astry: ${JSON.stringify(detailLayout)}.`);
  }
  observations.push({ check: "astra-layout-detail", ...detailLayout });
  await screenshot(settings, "detail-nahravky");

  await clickSelector(settings, recordingDetailSelector, "Zpět na den z detailu");
  await waitFor(
    () => settings.evaluate(`document.querySelector('.settings-window--recording-detail') === null`),
    "návrat z detailu na Můj den",
  );
  const detailBack = await settings.evaluate(`({
    active: document.querySelector('.desktop-navigation [aria-current="page"]')?.textContent.trim(),
    filtersVisible: [...document.querySelectorAll('.recordings-dashboard__filter')]
      .every((button) => button.getBoundingClientRect().width > 0),
    detailClosed: document.querySelector('[data-testid="recording-detail"]')?.open === false,
  })`);
  if (detailBack.active !== "Můj den" || !detailBack.filtersVisible || !detailBack.detailClosed) {
    throw new Error(`Návrat z detailu neobnovil přehled dne: ${JSON.stringify(detailBack)}.`);
  }
  observations.push({ check: "detail-back-to-day", ...detailBack });

  await clickSelector(settings, '[data-filter="local"]', "filtr Jen na Macu");
  await waitFor(() => settings.evaluate(`document.querySelector('[data-filter="local"]')?.getAttribute('aria-pressed') === 'true'
    && document.querySelectorAll('.recordings-dashboard__list li[data-recording-id]').length === 2`),
  "lokální filtr po dokončení obnovy při focusu");
  const localFilter = await settings.evaluate(`({
    active: document.querySelector('[data-filter="local"]')?.getAttribute('aria-pressed'),
    rows: document.querySelectorAll('.recordings-dashboard__list li[data-recording-id]').length,
  })`);
  if (localFilter.active !== "true" || localFilter.rows !== 2) {
    throw new Error(`Filtr Jen na Macu neodpovídá skutečné frontě: ${JSON.stringify(localFilter)}.`);
  }
  observations.push({ check: "local-recording-filter", ...localFilter });

  await clickSelector(settings, '[data-filter="delivery"]', "filtr Odesílání");
  await waitFor(() => settings.evaluate(`document.querySelector('[data-filter="delivery"]')?.getAttribute('aria-pressed') === 'true'
    && document.querySelectorAll('.recordings-dashboard__list li[data-recording-id]').length === 0
    && Boolean(document.querySelector('.recordings-dashboard__empty'))`), "pravdivý prázdný filtr odesílání");
  const deliveryFilter = await settings.evaluate(`({
    active: document.querySelector('[data-filter="delivery"]')?.getAttribute('aria-pressed'),
    rows: document.querySelectorAll('.recordings-dashboard__list li[data-recording-id]').length,
    empty: document.querySelector('.recordings-dashboard__empty')?.textContent.trim(),
  })`);
  if (deliveryFilter.active !== "true" || deliveryFilter.rows !== 0 || !deliveryFilter.empty) {
    throw new Error(`Filtr Odesílání skrývá nebo přidává nesprávné záznamy: ${JSON.stringify(deliveryFilter)}.`);
  }
  observations.push({ check: "delivery-filter-empty-is-truthful", ...deliveryFilter });
  await clickSelector(settings, '[data-filter="all"]', "filtr Vše");

  await clickByText(settings, "Nastavení");
  await waitFor(() => settings.evaluate("document.querySelector('.settings-window')?.dataset.page === 'settings'"), "Nastavení");
  await waitFor(
    () => settings.evaluate(`document.querySelector('.settings-content')?.scrollTop === 0
      && Boolean(document.querySelector('.desktop-settings-intro h1')?.getClientRects().length)`),
    "začátek Nastavení po návratu z přehledu dne",
  );
  await settings.send("Input.dispatchMouseEvent", {
    type: "mouseMoved", x: 20, y: 500, button: "none",
  });
  await delay(200);
  const settingsState = await settings.evaluate(`(() => ({
    active: document.querySelector('.desktop-navigation [aria-current="page"]')?.textContent.trim(),
    navigation: [...document.querySelectorAll('.desktop-navigation__item')].map((button) => ({
      label: button.textContent.trim(),
      active: button.dataset.active === 'true',
      background: getComputedStyle(button).backgroundColor,
      color: getComputedStyle(button).color,
    })),
    activeHasVisibleTreatment: (() => {
      const active = document.querySelector('.desktop-navigation__item[data-active="true"]');
      if (!active) return false;
      const style = getComputedStyle(active);
      return style.borderBottomWidth === '2px' && style.borderBottomColor !== 'transparent';
    })(),
    groups: [...document.querySelectorAll('.settings-tabs [role="tab"]')].map((tab) => tab.textContent.trim()),
    pageHeading: document.querySelector('.desktop-settings-intro h1')?.textContent.trim(),
    accountHeading: document.querySelector('#account-settings-title')?.textContent.trim(),
    contentScrollTop: document.querySelector('.settings-content')?.scrollTop,
    brand: Boolean(document.querySelector('.desktop-titlebar__brand svg')
      ?.getBoundingClientRect().width > 0),
    authState: document.querySelector('[data-testid="settings-account"]')?.dataset.authState,
    deviceName: document.querySelector('[data-testid="settings-device"]')?.textContent.trim(),
    updateCheckVisible: Boolean(document.querySelector('[data-testid="update-check-now"]')),
    updateCheckDisabled: document.querySelector('[data-testid="update-check-now"]')?.disabled,
  }))()`);
  if (settingsState.active !== "Nastavení" || settingsState.groups.length !== 5
    || settingsState.pageHeading !== "Nastavení"
    || settingsState.accountHeading !== "Váš účet a nové nahrávky"
    || settingsState.contentScrollTop !== 0
    || !settingsState.brand || settingsState.authState !== "signed-out"
    || settingsState.deviceName !== "Testovací Mac"
    || !settingsState.activeHasVisibleTreatment || !settingsState.updateCheckVisible
    || settingsState.updateCheckDisabled !== true) {
    throw new Error(`Nastavení nemá společný Astra shell a zachované skupiny: ${JSON.stringify(settingsState)}.`);
  }
  observations.push({ check: "settings-shell", ...settingsState });
  const settingsLayout = await settings.evaluate(`(() => {
    const box = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { top: Math.round(rect.top + content.scrollTop), bottom: Math.round(rect.bottom + content.scrollTop), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), height: Math.round(rect.height) };
    };
    const content = document.querySelector('.settings-content');
    const footer = document.querySelector('.settings-footer');
    const dock = [...document.querySelectorAll('.settings-group--local button[aria-label]')]
      .find((button) => button.getAttribute('aria-label') === 'Zobrazovat i ikonu v Docku');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      heading: box(document.querySelector('.desktop-settings-intro h1')),
      account: box(document.querySelector('#account-settings-title')),
      environment: box(document.querySelector('[data-testid="settings-environment"]')),
      company: box(document.querySelector('.upload-company-selector')),
      automatic: box(document.querySelector('[data-testid="automatic-upload-setting"]')),
      environmentRow: box(document.querySelector('[data-testid="settings-environment-row"]')),
      destination: box(document.querySelector('[data-testid="settings-destination"]')),
      audioHeading: box(document.querySelector('#audio-settings-title')),
      soundRows: [...document.querySelectorAll('#settings-panel-audio .settings-row--static')]
        .slice(0, 2).map(box),
      soundRowStates: [...document.querySelectorAll('#settings-panel-audio .settings-audio-source__state')]
        .map((state) => state.textContent.trim()),
      soundAction: box(document.querySelector('.settings-audio-action')),
      soundActionButton: box(document.querySelector('.settings-audio-action button')),
      soundActionLabel: document.querySelector('.settings-audio-action strong')?.textContent.trim(),
      localHeading: box(document.querySelector('#settings-local-title')),
      companyPlaceholder: document.querySelector('.upload-company-selector--signed-out select option')?.textContent.trim(),
      dock: box(dock),
      dockRow: box(dock?.closest('.settings-row')),
      footer: footer ? { display: getComputedStyle(footer).display, ...box(footer) } : null,
      horizontalOverflow: content.scrollWidth > content.clientWidth + 1,
    };
  })()`);
  const settingsVisible = (box) => box && box.width > 0 && box.height > 0
    && box.top >= 0
    && box.left >= 0 && box.right <= settingsLayout.viewport.width;
  if (settingsLayout.viewport.width !== 640 || settingsLayout.viewport.height !== 744
    || !settingsVisible(settingsLayout.heading) || !settingsVisible(settingsLayout.account)
    || !settingsVisible(settingsLayout.environment) || !settingsVisible(settingsLayout.company)
    || !settingsVisible(settingsLayout.automatic) || !settingsVisible(settingsLayout.audioHeading)
    || !settingsVisible(settingsLayout.environmentRow) || !settingsVisible(settingsLayout.destination)
    || !settingsVisible(settingsLayout.soundAction)
    || !settingsVisible(settingsLayout.soundActionButton) || !settingsVisible(settingsLayout.localHeading)
    || settingsLayout.soundActionButton.bottom > settingsLayout.soundAction.bottom + 1
    || settingsLayout.soundActionButton.bottom + 4 > settingsLayout.localHeading.top
    || settingsLayout.soundRows.length !== 2 || settingsLayout.soundRows.some((row) => !settingsVisible(row))
    || settingsLayout.soundRowStates.length !== 2
    || settingsLayout.soundRowStates.some((state) => /připraveno|zachycuje/iu.test(state))
    || settingsLayout.soundActionLabel !== "Zdroje a oprávnění"
    || settingsLayout.companyPlaceholder !== "Vyžaduje přihlášení"
    || !settingsVisible(settingsLayout.dock) || !settingsVisible(settingsLayout.dockRow)
    || !(settingsLayout.company.bottom <= settingsLayout.automatic.top
      && settingsLayout.automatic.bottom <= settingsLayout.environmentRow.top
      && settingsLayout.environmentRow.bottom <= settingsLayout.destination.top)
    || settingsLayout.footer?.display !== "flex" || settingsLayout.footer?.height !== 44
    || settingsLayout.footer?.top !== 691 || settingsLayout.footer?.bottom !== 735
    || settingsLayout.horizontalOverflow) {
    throw new Error(`Nastavení nemá zachovanou čitelnou kompozici: ${JSON.stringify(settingsLayout)}.`);
  }
  const settingsReachability = await settings.evaluate(`(() => {
    const content = document.querySelector('.settings-content');
    const footer = document.querySelector('.settings-footer');
    const originalScroll = content.scrollTop;
    const elements = [...document.querySelectorAll('.settings-group h2, .settings-group button, .settings-group select, .settings-group input, .settings-audio-action button, [data-testid="update-check-now"], .settings-footer button')];
    const results = elements.map(element => {
      element.scrollIntoView({ block: 'center', behavior: 'instant' });
      const rect = element.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const inFooter = footer.contains(element);
      const signedOutLogout = element.textContent.trim() === 'Odhlásit tento Mac'
        && document.querySelector('[data-testid="settings-account"]')?.dataset.authState === 'signed-out'
        && element.disabled === true && rect.width === 0 && rect.height === 0;
      return { label: element.getAttribute('aria-label') || element.textContent.trim() || element.id,
        top: rect.top, bottom: rect.bottom, height: rect.height,
        signedOutLogout,
        reachable: signedOutLogout || (rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= innerWidth
          && rect.top >= (inFooter ? footerRect.top : contentRect.top)
          && rect.bottom <= (inFooter ? innerHeight : footerRect.top)
          && Boolean(hit && (element.contains(hit) || hit.contains(element)))),
        disabled: element.disabled === true };
    });
    content.scrollTop = originalScroll;
    return results;
  })()`);
  if (settingsReachability.length < 10 || settingsReachability.some(item => !item.reachable)) {
    throw new Error(`Skupina nebo ovladač Nastavení není dosažitelný nad patičkou: ${JSON.stringify(settingsReachability)}.`);
  }
  observations.push({ check: "astra-layout-settings", ...settingsLayout, reachability: settingsReachability });
  observations.push({
    check: "update-check-isolated-from-production",
    visible: settingsState.updateCheckVisible,
    disabledInE2E: settingsState.updateCheckDisabled,
    automaticUpdatesDisabled: log.includes("automatické aktualizace vypnuté"),
    liveUpdateDownloaded: false,
  });
  await screenshot(settings, "nastaveni");

  await clickSelector(settings, ".desktop-titlebar__quick-actions", "Rychlé akce v Nastavení");
  await waitFor(
    () => settings.evaluate(`document.querySelector('.desktop-quick-actions')?.open === true`),
    "rychlé akce v okně Nastavení",
  );
  const settingsQuickActions = await settings.evaluate(`(() => ({
    items: [...document.querySelectorAll('.desktop-quick-actions__item')]
      .map((button) => button.querySelector('strong')?.textContent.trim()),
    shortcut: [...document.querySelectorAll('.desktop-quick-actions kbd')]
      .some((key) => key.textContent.trim() === '⌘ K'),
  }))()`);
  if (!settingsQuickActions.items.includes("Teď")
    || !settingsQuickActions.items.includes("Můj den")
    || !settingsQuickActions.items.includes("Nahrávky")
    || !settingsQuickActions.items.includes("Zvuk")
    || !settingsQuickActions.shortcut) {
    throw new Error(`Rychlé akce v Nastavení nezobrazují skutečné plochy: ${JSON.stringify(settingsQuickActions)}.`);
  }
  observations.push({ check: "settings-quick-actions", ...settingsQuickActions });
  await settings.send("Input.dispatchKeyEvent", {
    type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27,
  });
  await settings.send("Input.dispatchKeyEvent", {
    type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27,
  });
  await waitFor(
    () => settings.evaluate(`document.querySelector('.desktop-quick-actions')?.open === false`),
    "zavření rychlých akcí v Nastavení klávesou Escape",
  );

  await clickByText(settings, "Světlé");
  const lightTheme = await settings.evaluate(`document.documentElement.dataset.theme`);
  if (lightTheme !== "light") throw new Error(`Volba světlého tématu se neprojevila: ${lightTheme}.`);
  observations.push({ check: "light-theme-choice", theme: lightTheme });
  await screenshot(settings, "nastaveni-svetle");

  await clickByText(settings, "Můj den");
  await waitFor(() => settings.evaluate(`document.querySelector('.settings-window')?.dataset.page === 'day'
    && document.documentElement.dataset.theme === 'light'`), "Můj den ve světlém tématu");
  const dayThemeLight = await settings.evaluate(`document.documentElement.dataset.theme`);
  if (dayThemeLight !== "light") throw new Error("Světle zvolené téma se na stránce Můj den neprojevilo.");
  observations.push({ check: "day-theme-light", theme: dayThemeLight });
  await screenshot(settings, "muj-den-svetle");

  await clickByText(settings, "Nastavení");
  await waitFor(() => settings.evaluate("document.querySelector('.settings-window')?.dataset.page === 'settings'"), "Nastavení po přepnutí tématu");
  await clickByText(settings, "Tmavé");
  const darkTheme = await settings.evaluate(`document.documentElement.dataset.theme`);
  if (darkTheme !== "dark") throw new Error(`Volba tmavého tématu se neprojevila: ${darkTheme}.`);
  observations.push({ check: "dark-theme-choice", theme: darkTheme });
  await screenshot(settings, "nastaveni-tmave");
  const darkActions = await settings.evaluate(`(() => {
    const luminance = color => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d'); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
      const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
      return rgb.map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
        .reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
    };
    return ['[data-testid="open-audio-test"]', '.settings-footer .button--primary'].map(selector => {
      const button = document.querySelector(selector), css = button && getComputedStyle(button);
      const background = css && luminance(css.backgroundColor), foreground = css && luminance(css.color);
      return { selector, disabled: button?.disabled, opacity: css?.opacity, background: css?.backgroundColor, color: css?.color,
        contrast: (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05) };
    });
  })()`);
  if (darkActions.some(action => action.disabled !== false || action.opacity !== '1' || !Number.isFinite(action.contrast) || action.contrast < 4.5)) {
    throw new Error(`Aktivní tmavé akce nemají dostatečný kontrast: ${JSON.stringify(darkActions)}.`);
  }
  observations.push({ check: "dark-settings-actions-contrast", actions: darkActions });


  await clickByText(settings, "Můj den");
  await waitFor(() => settings.evaluate(`document.querySelector('.settings-window')?.dataset.page === 'day'
    && document.documentElement.dataset.theme === 'dark'`), "Můj den v tmavém tématu");
  const dayThemeDark = await settings.evaluate(`document.documentElement.dataset.theme`);
  if (dayThemeDark !== "dark") throw new Error("Tmavě zvolené téma se na stránce Můj den neprojevilo.");
  observations.push({ check: "day-theme-dark", theme: dayThemeDark });
  await screenshot(settings, "muj-den-tmave");

  await clickByText(settings, "Teď");
  await waitFor(
    async () => (await getTargets(port)).every((target) => !(
      target.url.includes("/dist/index.html") && target.url.includes("#settings")
    )),
    "návrat z Nastavení do panelu Teď",
  );
  const returnedPanel = await panel.evaluate(`(() => ({
    active: document.querySelector('.panel .desktop-navigation [aria-current="page"]')?.textContent.trim(),
    visible: document.visibilityState === 'visible',
  }))()`);
  if (returnedPanel.active !== "Teď" || !returnedPanel.visible) {
    throw new Error(`Návrat do panelu nevyšel: ${JSON.stringify(returnedPanel)}.`);
  }
  observations.push({ check: "return-to-now", ...returnedPanel });
  await screenshot(panel, "navrat-do-ted");

  const persistedTheme = await panel.evaluate(`document.documentElement.dataset.theme`);
  if (persistedTheme !== "dark") throw new Error(`Téma Nastavení se nesdílí s panelem Teď: ${persistedTheme}.`);
  observations.push({ check: "theme-shared-across-windows", theme: persistedTheme });

  const updateLogOffset = log.length;
  await stopDesktop();
  processHandle = launchDesktop(port, { LUDONE_E2E_UPDATE_FIXTURE: "downloaded" });
  await waitFor(
    () => log.slice(updateLogOffset).includes("DevTools listening on ws://"),
    "izolovaná relace k ověření upozornění aktualizace",
  );
  panel = await connectTarget(
    port,
    (target) => target.type === "page" && target.url.includes("/dist/index.html")
      && !target.url.endsWith("#settings"),
    "Teď s připravenou aktualizací",
  );
  await waitFor(
    () => panel.evaluate(`Boolean(document.querySelector('[data-testid="update-downloaded"]'))`),
    "viditelný pruh stažené aktualizace",
  );
  const updateBanner = await panel.evaluate(`(() => ({
    title: document.querySelector('[data-testid="update-downloaded"] strong')?.textContent.trim(),
    benefit: document.querySelector('[data-testid="update-downloaded"]')?.textContent.includes('Přehled nahrávek a sjednocený vzhled.'),
    install: document.querySelector('[data-testid="update-install"]')?.textContent.trim(),
    defer: document.querySelector('[data-testid="update-defer"]')?.textContent.trim(),
  }))()`);
  if (updateBanner.title !== "Nová verze 0.1.7 je stažená" || !updateBanner.benefit
    || updateBanner.install !== "Aktualizovat" || updateBanner.defer !== "Později") {
    throw new Error(`Stažená aktualizace nenabízí jasnou motivaci a volby: ${JSON.stringify(updateBanner)}.`);
  }
  await screenshot(panel, "aktualizace-stazena");
  await clickSelector(panel, '.application-update-detail__open', 'Otevřít samostatnou aktualizační plochu');
  await waitFor(() => panel.evaluate(`Boolean(document.querySelector('.application-update-status--detail'))`), 'samostatná plocha aktualizace');
  const updateDetail = await panel.evaluate(`(() => {
    const rect = document.querySelector('.application-update-status--detail')?.getBoundingClientRect();
    const action = document.querySelector('[data-testid="update-install"]')?.getBoundingClientRect();
    return { version: document.querySelector('.application-update-detail__version')?.textContent.trim(), title: document.querySelector('.application-update-detail__intro h1')?.textContent.trim(), action: action ? {top:action.top,bottom:action.bottom,width:action.width} : null, rect: rect ? {top:rect.top,bottom:rect.bottom} : null, viewport: innerHeight };
  })()`);
  if (!updateDetail.version?.includes('0.1.7') || !updateDetail.title || !updateDetail.action
    || updateDetail.action.width < 300 || !updateDetail.rect || updateDetail.rect.top < 100
    || updateDetail.action.top < updateDetail.rect.top || updateDetail.action.bottom > updateDetail.viewport) {
    throw new Error(`Samostatná aktualizační plocha není čitelná a dostupná: ${JSON.stringify(updateDetail)}.`);
  }
  observations.push({ check: "update-dedicated-surface", ...updateDetail });
  await screenshot(panel, "aktualizace-detail");
  await clickSelector(panel, '.application-update-detail__back', 'Zpět z aktualizační plochy');
  await waitFor(() => panel.evaluate(`!document.querySelector('.application-update-status--detail')`), 'návrat do původního proužku aktualizace');

  await clickSelector(panel, '[data-testid="update-defer"]', "Později u aktualizace");
  await waitFor(
    () => panel.evaluate(`document.querySelector('[data-testid="update-downloaded"]')
      ?.textContent.includes('Aktualizace počká. Připomínka zůstane tady v panelu.')`),
    "odložení stažené aktualizace bez instalace",
  );
  updateProof = {
    ...updateBanner,
    deferConfirmed: true,
    fixtureOnly: true,
    chosenAction: "Později",
  };
  observations.push({ check: "update-banner-and-defer", ...updateProof });

  // Obnova nedokončeného diskového vzorku. Nejde o fyzický výpadek Macu:
  // samostatný mikrofon má platná data, očekávaná systémová stopa je prázdná.
  await stopDesktop();
  const interruptedId = "50000000-0000-4000-8000-000000000001";
  const recordingsDirectory = path.join(dataRoot, "user-data", "nahravky");
  const interruptedPaths = ["astra-interrupted.manifest.json", "astra-interrupted-microphone.webm", "astra-interrupted-system.webm"]
    .map((name) => path.join(recordingsDirectory, name));
  const interruptedAt = new Date().toISOString();
  const interruptedManifest = Buffer.from(`${JSON.stringify({
    schemaVersion: 1, clientRecordingId: interruptedId, createdAt: interruptedAt,
    closedAt: null, state: "incomplete",
    tracks: Object.fromEntries(["microphone", "system"].map((source, index) => [source, {
      fileName: path.basename(interruptedPaths[index + 1]), startedAt: interruptedAt,
      endedAt: null, sizeBytes: 0, sha256: null,
    }])),
  }, null, 2)}\n`);
  const interruptedBytes = [interruptedManifest, await readFile(recordingFixture.audioPath), Buffer.alloc(0)];
  for (let index = 0; index < interruptedPaths.length; index += 1) {
    await writeFile(interruptedPaths[index], interruptedBytes[index], { mode: 0o600, flag: "wx" });
  }
  const recoveryLogOffset = log.length;
  processHandle = launchDesktop(port);
  await waitFor(() => log.slice(recoveryLogOffset).includes("[queue] odesláno 0,"), "obnova nedokončeného místního vzorku");
  panel = await connectTarget(port, (target) => target.type === "page" && target.url.includes("/dist/index.html")
    && !target.url.includes("#settings"), "Teď s nedokončenou nahrávkou");
  await clickByText(panel, "Můj den");
  settings = await connectTarget(port, (target) => target.type === "page" && target.url.includes("#settings"), "Můj den po obnově");
  await waitFor(() => settings.evaluate(`Boolean(document.querySelector('[data-recording-id="${interruptedId}"]'))`), "nedokončená nahrávka v přehledu");
  await clickSelector(settings, `[data-recording-id="${interruptedId}"] [data-testid="recording-detail"] > summary`, "Detail nedokončené nahrávky");
  await waitFor(
    () => settings.evaluate(`document.querySelector('[data-recording-id="${interruptedId}"] [data-testid="recording-detail"]')?.open === true`),
    "otevření detailu nedokončené nahrávky",
  );
  const recovery = await settings.evaluate(`(async () => {
    const snapshot = await window.ludone.listLocalRecordings();
    const item = snapshot.items.find(entry => entry.id === '${interruptedId}');
    const row = document.querySelector('[data-recording-id="${interruptedId}"]');
    return { id: item?.id, localState: item?.localState, localReason: item?.localReason,
      uploadIntent: item?.uploadIntent, allowedActions: item?.allowedActions,
      completeClaim: row?.textContent.includes('Zvuk je kompletní'),
      falseDelivery: Boolean(row?.querySelector('.recording-queue-card__journey li:last-child.is-complete')),
      unsafeActions: Boolean(row?.querySelector('.recording-action--send, .recording-action--retry, .recording-action--verify')),
      open: row?.querySelector('[data-testid="recording-detail"]')?.open };
  })()`);
  if (recovery.localState !== "partial-audio" || !recovery.localReason?.includes("nebyla dokončena")
    || recovery.completeClaim || recovery.falseDelivery || recovery.unsafeActions || !recovery.open
    || recovery.allowedActions?.send || recovery.allowedActions?.retry) {
    throw new Error(`Obnova tvrdí nepravdivý stav nebo nabízí nebezpečnou akci: ${JSON.stringify(recovery)}.`);
  }
  for (let index = 0; index < interruptedPaths.length; index += 1) {
    if (!(await readFile(interruptedPaths[index])).equals(interruptedBytes[index])) {
      throw new Error(`Obnova změnila původní soubor ${path.basename(interruptedPaths[index])}.`);
    }
  }
  observations.push({ check: "unfinished-recording-preserved-after-restart", ...recovery,
    fixtureOnly: true, originalBytesUnchanged: true, microphoneBytes: interruptedBytes[1].length, systemBytes: 0 });
  await screenshot(settings, "obnova-neuplne-nahravky");

  exitCode = 0;
} catch (error) {
  observations.push({ error: error instanceof Error ? error.message : String(error) });
  for (const [client, name] of [[settings, "chyba-den"], [panel, "chyba-panel"]]) {
    if (!client) continue;
    try { await screenshot(client, name); } catch { /* Uchováme hlavní chybu. */ }
  }
} finally {
  await stopDesktop();
  await writeFile(path.join(outputDir, "application.log"), log);
  const comparisonPage = await writeComparisonPage();
  const observedChecks = new Set(observations.filter((item) => item.check).map((item) => item.check));
  const acceptance = acceptanceGroups.map((group) => ({
    label: group.label,
    status: group.checks.every((check) => observedChecks.has(check)) ? "PASS" : "FAIL",
    checks: group.checks.map((check) => ({ check, status: observedChecks.has(check) ? "PASS" : "FAIL" })),
  }));
  const visualScreenshotPairs = comparisonPairs.map((pair) => ({
    label: pair.label,
    appScreenshot: screenshots.find((item) => item.endsWith(`-${pair.app}`)) ?? null,
    referenceScreenshot: pair.referenceScreenshot ?? null,
    layoutCheck: pair.layoutCheck,
    layoutStatus: pair.layoutCheck
      ? (observedChecks.has(pair.layoutCheck) ? "PASS" : "FAIL")
      : "MANUAL_REVIEW_REQUIRED",
  })).map((pair) => ({
    ...pair,
    status: pair.appScreenshot && pair.referenceScreenshot ? "CAPTURED" : "FAIL",
  }));
  acceptance.push({
    label: "Screenshoty zachycené pro vizuální kontrolu",
    status: visualScreenshotPairs.every((pair) => pair.status === "CAPTURED") ? "PASS" : "FAIL",
    pairs: visualScreenshotPairs,
  });
  if (acceptance.some((group) => group.status !== "PASS")) exitCode = 1;
  await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify({
    status: exitCode === 0 ? "PASS" : "FAIL",
    acceptance,
    visualScreenshotPairs,
    screenshots,
    comparisonPage,
    visualComparisons: comparisonPairs.map((pair) => ({
      label: pair.label,
      scenario: pair.scenario,
      width: pair.width,
      height: pair.height,
      note: pair.note,
      appScreenshot: screenshots.find((item) => item.endsWith(`-${pair.app}`)) ?? null,
      referenceScreenshot: pair.referenceScreenshot ?? null,
    })),
    observations,
    recordingProof,
    updateProof,
    testFixture: recordingFixture ? {
      id: fixtureRecordingId,
      uploadSetting: e2eEnvironment.DESKTOP_UPLOAD_ENABLED,
      media: "seeded local fixture for layout and state; separate synthetic UI capture proof is recorded under recordingProof",
      manifest: path.relative(projectRoot, recordingFixture.manifestPath),
    } : null,
    outputDir: path.relative(projectRoot, outputDir),
  }, null, 2)}\n`);
}

for (const observation of observations.filter((item) => item.check)) {
  console.log(`PASS  ${observation.check}`);
}
const observedChecks = new Set(observations.filter((item) => item.check).map((item) => item.check));
for (const group of acceptanceGroups) {
  const status = group.checks.every((check) => observedChecks.has(check)) ? "PASS" : "FAIL";
  console.log(`${status}  acceptance · ${group.label}`);
}
const visualScreenshotStatus = comparisonPairs.every((pair) => pair.referenceScreenshot
  && screenshots.some((item) => item.endsWith(`-${pair.app}`))) ? "CAPTURED" : "FAIL";
console.log(`${visualScreenshotStatus}  acceptance · Screenshoty zachycené pro vizuální kontrolu`);
console.log(`${exitCode === 0 ? "🧪" : "⛔"} Astra design E2E: ${path.relative(projectRoot, outputDir)}`);
process.exitCode = exitCode;

}
