import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  SMOKE_SURFACE,
  buildSmokeReport,
  chooseInitialSmokeRoute,
  formatScreenshotList,
  formatSmokeReport,
  recognizeSmokeSurface,
  validateAuthWaitingUrl,
  validatePngScreenshot,
} from "../src/lib/ui-smoke.js";

const DEBUG_PORT = Number(process.env.LUDONE_DEBUG_PORT || 9333);
// Seznam připuštěných prostředí bereme z kódu aplikace, ne z vlastní kopie: kdyby někdo
// přidal třetí prostředí a zapomněl na bránu, ať to praskne tady, ne u uživatele.
const { AUTH_ORIGINS } = createRequire(import.meta.url)("../electron/settings.cjs");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const outputRoot = path.join(projectRoot, ".runtime", "smoke");
const runId = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
const outputDir = path.join(outputRoot, runId);
const observations = [];
const screens = [];
const RECORDING_NAME_SELECTOR = '[data-testid="recording-name-input"]';
const SKIP_RECORDING_NAME_SELECTOR = '[data-testid="skip-recording-name"]';

await mkdir(outputDir, { recursive: true });

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(check, label, timeout = 8000) {
  const deadline = Date.now() + timeout;
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
  throw new Error(`Timeout: ${label}${lastError ? ` (${lastError.message})` : ""}`);
}

async function targets() {
  const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  if (!response.ok) throw new Error(`CDP /json/list vrátil ${response.status}`);
  return response.json();
}

class CdpClient {
  constructor(webSocketUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.socket = new WebSocket(webSocketUrl);
    let rejectReady;
    this.ready = new Promise((resolve, reject) => {
      rejectReady = reject;
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    const rejectPending = (error) => {
      rejectReady(error);
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(error);
      }
      this.pending.clear();
    };
    this.socket.addEventListener("close", () => {
      rejectPending(new Error("CDP spojení se zavřelo."));
    });
    this.socket.addEventListener("error", () => {
      rejectPending(new Error("CDP spojení selhalo."));
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) {
        this.events.push(message);
        if (this.events.length > 200) this.events.shift();
        return;
      }
      if (!this.pending.has(message.id)) return;
      const { resolve, reject, timer } = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(timer);
      if (message.error) reject(new Error(`${message.error.code}: ${message.error.message}`));
      else resolve(message.result);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    if (this.socket.readyState !== WebSocket.OPEN) {
      throw new Error(`CDP spojení není otevřené pro ${method}.`);
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP příkaz ${method} neodpověděl do 8 sekund.`));
      }, 8000);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.socket.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || "Chyba Runtime.evaluate");
    }
    return result.result.value;
  }

  close() {
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
      this.socket.close();
    }
  }
}

async function connectTarget(predicate, label) {
  const target = await waitFor(
    async () => (await targets()).find(predicate),
    `nenalezen CDP target: ${label}`,
  );
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Log.enable");
  await client.send("Page.reload", { ignoreCache: true });
  await waitFor(
    () => client.evaluate("document.readyState === 'complete'"),
    `načtení targetu: ${label}`,
  );
  return client;
}

async function bodyText(client) {
  return client.evaluate("document.body.innerText");
}

async function assertText(client, text) {
  try {
    await waitFor(async () => (await bodyText(client)).includes(text), `text „${text}“`);
  } catch (error) {
    const actual = await bodyText(client);
    const diagnostics = await client.evaluate(`(() => ({
      href: location.href,
      readyState: document.readyState,
      ludoneBridge: typeof window.ludone,
      root: document.querySelector('#root')?.innerHTML,
      scripts: [...document.scripts].map((script) => ({ src: script.src, type: script.type })),
      resources: performance.getEntriesByType('resource').map((entry) => entry.name),
    }))()`);
    const scriptFetch = await client.evaluate(`fetch(document.scripts[0].src)
      .then(async (response) => ({
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get('content-type'),
        sample: (await response.text()).slice(0, 120),
      }))
      .catch((fetchError) => ({ error: String(fetchError) }))`);
    const relevantEvents = client.events.filter((event) =>
      ["Runtime.exceptionThrown", "Log.entryAdded"].includes(event.method),
    );
    throw new Error(
      `${error.message}; DOM obsahuje: ${JSON.stringify(actual.slice(0, 1200))}; diagnostika: ${JSON.stringify(diagnostics)}; scriptFetch: ${JSON.stringify(scriptFetch)}; events: ${JSON.stringify(relevantEvents)}`,
    );
  }
  observations.push({ check: "text", value: text });
}

async function readSmokeSurface(client) {
  const markers = await client.evaluate(`(() => ({
    authentication: document.querySelector('.auth-step') !== null,
    authWaiting: document.querySelector('[data-testid="auth-waiting-screen"]') !== null,
    checkingSession: document.querySelector('[data-panel-state="checking-session"]') !== null,
    panel: document.querySelector('main.panel[data-panel-state]') !== null,
    signedIn: document.querySelector('main.panel [data-auth-state="signed-in"]') !== null,
    welcome: document.querySelector('.welcome-step') !== null,
  }))()`);
  const surface = recognizeSmokeSurface(markers);
  return { markers, route: chooseInitialSmokeRoute(surface), surface };
}

async function waitForInitialRoute(client) {
  let checkingSessionCaptured = false;
  const resolved = await waitFor(async () => {
    const state = await readSmokeSurface(client);
    if (state.surface === SMOKE_SURFACE.CHECKING_SESSION && !checkingSessionCaptured) {
      await screenshot(client, "checking-session");
      checkingSessionCaptured = true;
    }
    return ["panel-and-settings", "onboarding-to-auth-boundary", "auth-boundary"]
      .includes(state.route) ? state : null;
  }, "rozpoznání přihlášeného panelu nebo onboardingu");
  observations.push({
    check: "initial-route",
    route: resolved.route,
    surface: resolved.surface,
  });
  return resolved;
}

async function waitForSurface(client, expected, label) {
  return waitFor(async () => {
    const state = await readSmokeSurface(client);
    return state.surface === expected ? state : null;
  }, label);
}

async function waitForAuthUrl(client, expectedOrigin, previous = null) {
  const presentation = await waitFor(async () => {
    const value = await client.evaluate(`(() => {
      const element = document.querySelector('[data-testid="auth-waiting-url"]');
      if (!element) return null;
      const text = element.textContent.trim();
      if (!text) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        text,
        visible: style.display !== "none"
          && style.visibility !== "hidden"
          && rect.width > 0
          && rect.height > 0
          && rect.bottom > 0
          && rect.right > 0
          && rect.top < innerHeight
          && rect.left < innerWidth,
      };
    })()`);
    if (previous !== null && value?.text === previous.href) return null;
    return value;
  }, previous === null ? "adresa přihlášení" : "nová adresa přihlášení po opakování");
  if (!presentation.visible) {
    throw new Error("Adresa přihlášení na čekací obrazovce není viditelná.");
  }
  // Validace je úmyslně mimo obecný polling: neplatná zobrazená URL je okamžitý
  // nález, ne důvod čekat osm sekund a přebalit ho zavádějícím Timeoutem.
  const parsed = validateAuthWaitingUrl(presentation.text, expectedOrigin);
  if (previous !== null && parsed.state === previous.state) {
    throw new Error("Nový OAuth pokus zachoval state předchozího pokusu.");
  }
  if (previous !== null && parsed.origin !== previous.origin) {
    throw new Error("Opakovaný pokus zamířil do jiného prostředí než ten předchozí.");
  }
  observations.push({
    check: "auth-url",
    origin: parsed.origin,
    pathname: parsed.pathname,
    renewed: previous !== null,
  });
  return parsed;
}

async function clickElement(client, label, locator, settleMilliseconds = 120) {
  const point = await client.evaluate(`(() => {
    const element = (${locator});
    if (!element) return { ok: false, reason: "prvek nenalezen" };
    if (element.disabled) return { ok: false, reason: "prvek je disabled" };
    element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return { ok: false, reason: "prvek není viditelný" };
    }
    if (style.pointerEvents === "none") {
      return { ok: false, reason: "prvek má pointer-events:none" };
    }
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return { ok: false, reason: "nulová plocha" };
    }
    const x = rect.left + (rect.width / 2);
    const y = rect.top + (rect.height / 2);
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) {
      return {
        ok: false,
        reason: "bod [" + Math.round(x) + "," + Math.round(y)
          + "] je mimo viewport " + innerWidth + "×" + innerHeight,
      };
    }
    const hit = document.elementFromPoint(x, y);
    if (!hit || !(hit === element || element.contains(hit))) {
      return { ok: false, reason: "bod překrývá <" + (hit ? hit.tagName : "nic") + ">" };
    }
    return {
      ok: true,
      text: element.textContent.replace(/\\s+/g, " ").trim(),
      x,
      y,
    };
  })()`);
  if (!point?.ok) throw new Error(`Nelze kliknout na „${label}“: ${point?.reason || "neznámý důvod"}`);
  const at = { clickCount: 1, x: point.x, y: point.y };
  await client.send("Input.dispatchMouseEvent", {
    ...at,
    button: "none",
    buttons: 0,
    type: "mouseMoved",
  });
  await client.send("Input.dispatchMouseEvent", {
    ...at,
    button: "left",
    buttons: 1,
    type: "mousePressed",
  });
  await client.send("Input.dispatchMouseEvent", {
    ...at,
    button: "left",
    buttons: 0,
    type: "mouseReleased",
  });
  observations.push({
    action: "click",
    point: [Math.round(point.x), Math.round(point.y)],
    target: label,
    text: point.text,
  });
  if (settleMilliseconds > 0) await delay(settleMilliseconds);
}

async function clickByText(client, text, settleMilliseconds = 120) {
  await clickElement(
    client,
    text,
    `[...document.querySelectorAll("button")]
      .find((item) => item.textContent.replace(/\\s+/g, " ").trim().includes(${JSON.stringify(text)}))`,
    settleMilliseconds,
  );
}

async function clickByAria(client, label) {
  await clickElement(
    client,
    label,
    `document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)})`,
  );
}

async function clickBySelector(client, selector, label) {
  await clickElement(
    client,
    label,
    `document.querySelector(${JSON.stringify(selector)})`,
  );
}

async function verifyClipboardCopy(client, expectedUrl) {
  const installed = await client.evaluate(`(() => {
    const clipboard = navigator.clipboard;
    if (!clipboard || typeof clipboard.writeText !== "function") {
      return { ok: false, reason: "Clipboard API není dostupné" };
    }
    const original = clipboard.writeText;
    const ownDescriptor = Object.getOwnPropertyDescriptor(clipboard, "writeText");
    const probe = { calls: [], errors: [], resolved: [] };
    try {
      Object.defineProperty(clipboard, "writeText", {
        configurable: true,
        value(value) {
          const text = String(value);
          probe.calls.push(text);
          return Promise.resolve(original.call(clipboard, text)).then(
            () => { probe.resolved.push(text); },
            (error) => {
              probe.errors.push(String(error));
              throw error;
            },
          );
        },
      });
    } catch (error) {
      return { ok: false, reason: String(error) };
    }
    window.__ludoneUiSmokeClipboard = { clipboard, ownDescriptor, probe };
    return { ok: true };
  })()`);
  if (!installed?.ok) {
    throw new Error(`Kopírování adresy nejde ověřit: ${installed?.reason || "neznámý důvod"}`);
  }

  try {
    await clickBySelector(client, '[data-testid="auth-waiting-copy"]', "Kopírovat");
    const result = await waitFor(
      () => client.evaluate(`(() => {
        const probe = window.__ludoneUiSmokeClipboard?.probe;
        if (!probe || (probe.resolved.length === 0 && probe.errors.length === 0)) return null;
        return {
          copied: probe.resolved.at(-1) || null,
          error: probe.errors.at(-1) || null,
        };
      })()`),
      "zkopírování adresy přihlášení",
    );
    if (result.error || result.copied !== expectedUrl) {
      throw new Error(`Kopírování adresy selhalo: ${JSON.stringify(result)}`);
    }
    observations.push({ check: "auth-url-copy", value: "displayed-url" });
  } finally {
    await client.evaluate(`(() => {
      const saved = window.__ludoneUiSmokeClipboard;
      if (!saved) return;
      if (saved.ownDescriptor) {
        Object.defineProperty(saved.clipboard, "writeText", saved.ownDescriptor);
      } else {
        delete saved.clipboard.writeText;
      }
      delete window.__ludoneUiSmokeClipboard;
    })()`);
  }
}

async function assertTray(client, expected) {
  const actual = await waitFor(
    async () => {
      const value = await client.evaluate("window.ludone.getTrayState()");
      return value === expected ? value : null;
    },
    `tray state ${expected}`,
  );
  observations.push({ check: "tray", value: actual });
}

async function verifyTrayToggle(client) {
  const hidden = await client.evaluate("window.ludone.testClickTray()");
  if (!hidden.allowed || hidden.visible) {
    throw new Error(`První tray click panel neskryl: ${JSON.stringify(hidden)}`);
  }
  await waitFor(
    () => client.evaluate("document.visibilityState === 'hidden'"),
    "panel skrytý tray clickem",
  );
  observations.push({ action: "tray-click", result: "hidden" });

  const shown = await client.evaluate("window.ludone.testClickTray()");
  if (!shown.allowed || !shown.visible) {
    throw new Error(`Druhý tray click panel neotevřel: ${JSON.stringify(shown)}`);
  }
  await waitFor(
    () => client.evaluate("document.visibilityState === 'visible'"),
    "panel otevřený tray clickem",
  );
  observations.push({ action: "tray-click", result: "visible" });
}

async function screenshot(client, name) {
  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const png = Buffer.from(result.data, "base64");
  validatePngScreenshot(png);
  const sequence = String(screens.length + 1).padStart(2, "0");
  const target = path.join(outputDir, `${sequence}-${name}.png`);
  await writeFile(target, png);
  const displayPath = path.relative(projectRoot, target);
  screens.push({ name, path: displayPath });
  observations.push({ artifact: target, screen: name });
  return target;
}

async function captureRecordingTransition(client, names) {
  const phase = await waitFor(
    () => client.evaluate(`(() => {
      const phase = document.querySelector('.recording-card')?.dataset.recordingPhase || null;
      return ${JSON.stringify(Object.keys(names))}.includes(phase) ? phase : null;
    })()`),
    `fáze nahrávání ${Object.keys(names).join("/")}`,
  );
  if (names[phase]) await screenshot(client, names[phase]);
  return phase;
}

async function assertRecordingElapsed(client) {
  const elapsed = await waitFor(
    () => client.evaluate(`(() => {
      const value = document.querySelector('.recording-card .elapsed')?.textContent.trim() || "";
      const parts = value.split(":").map(Number);
      if (!parts.length || parts.some((part) => !Number.isSafeInteger(part))) return null;
      const seconds = parts.reduce((total, part) => (total * 60) + part, 0);
      return seconds >= 1 ? value : null;
    })()`),
    "počítadlo nahrávání alespoň 1 sekunda",
  );
  observations.push({ check: "recording-elapsed", value: elapsed });
}

async function setPanelInputs(client) {
  const result = await client.evaluate(`(() => {
    const select = document.querySelector('.tracking-card select');
    const input = document.querySelector('.tracking-card input');
    select.value = 'Web · klientská zóna';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Příprava demo flow');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { project: select.value, description: input.value };
  })()`);
  if (result.project !== "Web · klientská zóna" || result.description !== "Příprava demo flow") {
    throw new Error(`LuTrack vstupy se nepropsaly: ${JSON.stringify(result)}`);
  }
  observations.push({ action: "configure-tracking", ...result });
  await delay(120);
}

async function assertRecordingNaming(client) {
  const state = await waitFor(
    () => client.evaluate(`(() => {
      const card = document.querySelector('[data-recording-phase="saved"]');
      const input = document.querySelector(${JSON.stringify(RECORDING_NAME_SELECTOR)});
      if (!card || !input) return null;
      const state = {
        focused: document.activeElement === input,
        value: input.value,
      };
      return state.focused && state.value.trim().length > 0 ? state : null;
    })()`),
    "panel pojmenování nahrávky",
  );
  if (!state.focused || state.value.trim().length === 0) {
    throw new Error(`Pojmenování není předvyplněné a fokusované: ${JSON.stringify(state)}`);
  }
  observations.push({ check: "recording-naming", ...state });
}

async function skipRecordingNaming(client) {
  await clickBySelector(client, SKIP_RECORDING_NAME_SELECTOR, "Přeskočit pojmenování");
  await waitFor(
    () => client.evaluate("document.querySelector('[data-recording-phase=\"idle\"]') !== null"),
    "přeskočení pojmenování",
    20_000,
  );
  observations.push({ check: "recording-name-skipped" });
}

async function submitRecordingName(client, value) {
  const changed = await client.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(RECORDING_NAME_SELECTOR)});
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input.value === ${JSON.stringify(value)};
  })()`);
  if (!changed) throw new Error("Název nahrávky nešel změnit.");
  await delay(120);
  await clickBySelector(
    client,
    '.recording-saved button[type="submit"]',
    "Uložit a odeslat",
  );
  await waitFor(
    () => client.evaluate("document.querySelector('[data-recording-phase=\"idle\"]') !== null"),
    "potvrzení názvu nahrávky",
    20_000,
  );
  observations.push({ check: "recording-name-submitted", value });
}

// Tyto dvě hodnoty jsou úmyslně pevné. Druhá je běžný testovací cíl a produkční
// default slouží jako náhradní cíl, když jej přihlášený profil už změnil na 30 dní.
// tests/retention.test.js hlídá, že obě volby existují a default zůstává ve shodě s UI.
const OCEKAVANA_VYCHOZI_RETENCE = "7 dní po odeslání";
const NASTAVOVANA_RETENCE = "30 dní po odeslání";

async function selectSettingsTab(client, id, expectedText) {
  await clickBySelector(client, `#settings-tab-${id}`, `záložka ${expectedText}`);
  await waitFor(
    () => client.evaluate(`(() => {
      const tab = document.querySelector(${JSON.stringify(`#settings-tab-${id}`)});
      const panel = document.querySelector(${JSON.stringify(`#settings-panel-${id}`)});
      return tab?.getAttribute("aria-selected") === "true" && panel?.hidden === false;
    })()`),
    `otevření záložky ${expectedText}`,
  );
  await assertText(client, expectedText);
  observations.push({ check: "settings-tab", value: id });
}

async function readAskOther(client) {
  return client.evaluate(
    "document.querySelector('[aria-label=\"Ptát se před nahráváním ostatních hovorů\"]')?.getAttribute('aria-checked')",
  );
}

async function toggleAskOther(client, expected) {
  await clickByAria(client, "Ptát se před nahráváním ostatních hovorů");
  const actual = await waitFor(
    async () => {
      const value = await readAskOther(client);
      return value === expected ? value : null;
    },
    `uložení přepínače na ${expected}`,
  );
  observations.push({ action: "settings-ask-other", value: actual });
}

async function readRetention(client) {
  return client.evaluate("document.querySelector('.settings-select select')?.value || null");
}

async function setRetention(client, value) {
  // Nativní rozbalovací nabídka macOS není přes CDP dosažitelná. U selectu proto
  // nastavujeme hodnotu a posíláme skutečnou událost change; tlačítka se klikají přes hit-test.
  const changed = await client.evaluate(`(() => {
    const select = document.querySelector('.settings-select select');
    if (!select || select.closest('[role="tabpanel"]')?.hidden) return false;
    const optionExists = [...select.options].some((option) => option.value === ${JSON.stringify(value)});
    if (!optionExists) return false;
    select.value = ${JSON.stringify(value)};
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  if (!changed) throw new Error(`Retenci nešlo nastavit na „${value}".`);
  await waitFor(
    async () => (await readRetention(client)) === value,
    `uložení retence „${value}"`,
  );
  observations.push({ action: "settings-retention", value });
}

async function waitForDiagnostics(client) {
  const state = await waitFor(
    () => client.evaluate(`(() => {
      const panel = document.querySelector('#settings-panel-diagnostics');
      const queue = panel?.querySelector('[data-testid="diagnostics-queue"]');
      if (!panel || panel.hidden || !queue) return null;
      const queueText = queue.textContent.trim();
      if (!queueText || queueText === "Načítám stav fronty…") return null;
      return {
        architecture: panel.querySelector('[data-testid="diagnostics-architecture"]')
          ?.textContent.trim() || "",
        queue: queueText,
        version: panel.querySelector('[data-testid="diagnostics-version"]')
          ?.textContent.trim() || "",
      };
    })()`),
    "načtení diagnostiky",
  );
  if (
    !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(state.version)
    || !["Apple Silicon", "Intel"].includes(state.architecture)
    || state.queue === "Stav fronty není dostupný"
  ) {
    throw new Error(`Diagnostika neukázala platný stav: ${JSON.stringify(state)}`);
  }
  observations.push({ check: "settings-diagnostics", ...state });
}

async function restoreSettingsStorage(client, original) {
  const restored = await client.evaluate(`(() => {
    const original = ${JSON.stringify(original)};
    if (original === null) localStorage.removeItem("ludone.prototype.settings");
    else localStorage.setItem("ludone.prototype.settings", original);
    return localStorage.getItem("ludone.prototype.settings") === original;
  })()`);
  if (!restored) throw new Error("Původní uložené nastavení se nepodařilo přesně obnovit.");
  observations.push({ cleanup: "settings-storage", result: "restored" });
}

async function exerciseSettings(client) {
  const storageSnapshot = await client.evaluate(
    "localStorage.getItem('ludone.prototype.settings')",
  );
  let originalAsk = null;
  let originalRetention = null;
  let primaryError = null;
  const cleanupErrors = [];

  try {
    await assertText(client, "Tento Mac");
    await waitFor(
      () => client.evaluate(
        "document.querySelector('[data-testid=\"settings-account\"]')?.dataset.authState === 'signed-in'",
      ),
      "přihlášený účet v nastavení",
    );
    await screenshot(client, "settings-account");

    await selectSettingsTab(client, "audio", "Kdy nahrávat");
    originalAsk = await readAskOther(client);
    if (!["true", "false"].includes(originalAsk)) {
      throw new Error(`Přepínač nahrávání má neplatný stav ${JSON.stringify(originalAsk)}.`);
    }
    await screenshot(client, "settings-audio");
    await toggleAskOther(client, originalAsk === "true" ? "false" : "true");
    await screenshot(client, "settings-audio-changed");

    await selectSettingsTab(client, "recordings", "Záznamy");
    originalRetention = await readRetention(client);
    if (typeof originalRetention !== "string" || originalRetention.length === 0) {
      throw new Error("Nastavení retence nemá vybranou platnou hodnotu.");
    }
    await screenshot(client, "settings-recordings");
    await setRetention(
      client,
      originalRetention === NASTAVOVANA_RETENCE
        ? OCEKAVANA_VYCHOZI_RETENCE
        : NASTAVOVANA_RETENCE,
    );
    await screenshot(client, "settings-recordings-changed");

    await selectSettingsTab(client, "diagnostics", "Diagnostika");
    await waitForDiagnostics(client);
    await screenshot(client, "settings-diagnostics");
  } catch (error) {
    primaryError = error;
    try {
      await screenshot(client, "settings-failure-before-restore");
    } catch (screenshotError) {
      observations.push({
        artifactError: screenshotError instanceof Error
          ? screenshotError.message
          : String(screenshotError),
        scope: "settings-before-restore",
      });
    }
  }

  // Smoke běží i nad skutečným přihlášeným profilem. Obnova proto proběhne i
  // po chybě uprostřed kontroly a raw snapshot je poslední pojistka přesné hodnoty.
  if (originalAsk !== null) {
    try {
      await selectSettingsTab(client, "audio", "Kdy nahrávat");
      if (await readAskOther(client) !== originalAsk) await toggleAskOther(client, originalAsk);
      await screenshot(client, "settings-audio-restored");
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (originalRetention !== null) {
    try {
      await selectSettingsTab(client, "recordings", "Záznamy");
      if (await readRetention(client) !== originalRetention) {
        await setRetention(client, originalRetention);
      }
      await screenshot(client, "settings-recordings-restored");
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  try {
    await restoreSettingsStorage(client, storageSnapshot);
  } catch (error) {
    cleanupErrors.push(error);
  }

  for (const error of cleanupErrors) {
    observations.push({
      cleanupError: error instanceof Error ? error.message : String(error),
      scope: "settings",
    });
  }
  if (primaryError) throw primaryError;
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "Obnova nastavení po ui-smoke selhala.");
  }
}

async function assertUsableAuthEntry(client) {
  const state = await client.evaluate(`(() => {
    const waiting = document.querySelector('[data-testid="auth-waiting-screen"]');
    const entry = document.querySelector('.auth-step');
    const button = [...document.querySelectorAll("button")].find((item) =>
      item.textContent.replace(/\\s+/g, " ").trim().includes("Přihlásit v prohlížeči")
    );
    if (waiting || !entry || !button || button.disabled) return { ok: false };
    const rect = button.getBoundingClientRect();
    const x = rect.left + (rect.width / 2);
    const y = rect.top + (rect.height / 2);
    const hit = document.elementFromPoint(x, y);
    return {
      ok: rect.width > 0 && rect.height > 0 && Boolean(hit)
        && (hit === button || button.contains(hit)),
    };
  })()`);
  if (!state?.ok) {
    throw new Error("Zrušit nevrátilo použitelnou přihlašovací obrazovku.");
  }
  await waitFor(
    () => client.evaluate("window.ludone.pendingAuthUrl().then((value) => value === null)"),
    "ukončení OAuth pokusu po Zrušit",
  );
  observations.push({ check: "auth-cancel-return", value: "usable-auth-entry" });
}

async function runOnboardingToAuthBoundary(client, initialState) {
  const verifiedChecks = [];
  const expectedOrigin = AUTH_ORIGINS;
  if (initialState.surface === SMOKE_SURFACE.WELCOME) {
    await assertText(client, "Rozhovory a čas.");
    await assertTray(client, "signed-out");
    await screenshot(client, "welcome-signed-out");
    verifiedChecks.push("welcome");
    await clickByText(client, "Začít");
    await waitForSurface(client, SMOKE_SURFACE.AUTHENTICATION, "přihlašovací obrazovka");
  }

  if (initialState.surface === SMOKE_SURFACE.AUTH_WAITING) {
    await assertText(client, "Čekám na prohlížeč");
    await waitForAuthUrl(client, expectedOrigin);
    await screenshot(client, "auth-waiting-initial");
    await clickBySelector(client, '[data-testid="auth-waiting-cancel"]', "Zrušit");
    await waitForSurface(
      client,
      SMOKE_SURFACE.AUTHENTICATION,
      "návrat z původní čekací obrazovky",
    );
    await assertUsableAuthEntry(client);
  }

  await assertText(client, "Přihlásit v prohlížeči");
  await screenshot(client, "auth-entry");
  verifiedChecks.push("auth-entry");
  await clickByText(client, "Přihlásit v prohlížeči");
  await waitForSurface(client, SMOKE_SURFACE.AUTH_WAITING, "čekací obrazovka OAuth");

  await assertText(client, "Čekám na prohlížeč");
  const firstUrl = await waitForAuthUrl(client, expectedOrigin);
  await screenshot(client, "auth-waiting");
  verifiedChecks.push("auth-waiting", "auth-url");

  await verifyClipboardCopy(client, firstUrl.href);
  verifiedChecks.push("auth-copy");

  await clickBySelector(client, '[data-testid="auth-waiting-retry"]', "Zkusit znovu");
  const retriedUrl = await waitForAuthUrl(client, expectedOrigin, firstUrl);
  await screenshot(client, "auth-waiting-retry");
  verifiedChecks.push("auth-retry");

  await clickBySelector(client, '[data-testid="auth-waiting-cancel"]', "Zrušit");
  await waitForSurface(
    client,
    SMOKE_SURFACE.AUTHENTICATION,
    "návrat na přihlašovací obrazovku po Zrušit",
  );
  await assertUsableAuthEntry(client);
  await screenshot(client, "auth-entry-after-cancel");

  // Pouhé viditelné tlačítko historickou slepou uličku neodhalí. Po návratu proto
  // opravdu zahájíme další pokus, vyžádáme nový state a nakonec jej znovu uklidíme.
  await clickByText(client, "Přihlásit v prohlížeči");
  await waitForSurface(client, SMOKE_SURFACE.AUTH_WAITING, "nový OAuth pokus po Zrušit");
  await assertText(client, "Čekám na prohlížeč");
  await waitForAuthUrl(client, expectedOrigin, retriedUrl);
  await screenshot(client, "auth-waiting-after-cancel-reentry");
  await clickBySelector(client, '[data-testid="auth-waiting-cancel"]', "Zrušit");
  await waitForSurface(
    client,
    SMOKE_SURFACE.AUTHENTICATION,
    "konečný návrat na přihlašovací obrazovku",
  );
  await assertUsableAuthEntry(client);
  await screenshot(client, "auth-entry-final");
  verifiedChecks.push("auth-cancel");

  return buildSmokeReport({ outcome: "auth-boundary", screens, verifiedChecks });
}

async function runPanelAndSettings(client) {
  const verifiedChecks = [];
  await assertText(client, "Spustit nahrávání");
  await assertTray(client, "idle");
  await verifyTrayToggle(client);
  await screenshot(client, "panel-idle");
  verifiedChecks.push("panel");

  await clickByText(client, "Spustit nahrávání", 0);
  await captureRecordingTransition(client, {
    checking: "recording-checking",
    recording: null,
  });
  await assertText(client, "Obě stopy ověřeny");
  await assertRecordingElapsed(client);
  await assertTray(client, "recording");
  await screenshot(client, "recording");

  await clickByAria(client, "Spustit LuTrack");
  await delay(1150);
  await assertTray(client, "recording-tracking");
  await assertText(client, "Stop");
  await screenshot(client, "recording-and-tracking");

  await clickByText(client, "Ukončit a uložit", 0);
  await captureRecordingTransition(client, {
    saved: null,
    stopping: "recording-stopping-before-skip",
  });
  await assertRecordingNaming(client);
  await screenshot(client, "recording-naming-before-skip");
  await skipRecordingNaming(client);
  await assertTray(client, "tracking");
  await screenshot(client, "tracking-only");
  await clickByAria(client, "Zastavit LuTrack");
  await assertTray(client, "idle");
  await screenshot(client, "panel-idle-after-tracking");
  verifiedChecks.push("tracking");

  await setPanelInputs(client);
  await screenshot(client, "panel-configured");
  await clickByAria(client, "Spustit LuTrack");
  await delay(1100);
  const trackingValues = await client.evaluate(`(() => ({
    project: document.querySelector('.tracking-card select').value,
    description: document.querySelector('.tracking-card input').value,
    locked: document.querySelector('.tracking-card select').disabled,
  }))()`);
  if (!trackingValues.locked || trackingValues.project !== "Web · klientská zóna") {
    throw new Error(`Běžící LuTrack neuzamkl projekt: ${JSON.stringify(trackingValues)}`);
  }
  await assertTray(client, "tracking");
  await screenshot(client, "configured-tracking");
  await clickByAria(client, "Zastavit LuTrack");
  await assertTray(client, "idle");
  await screenshot(client, "panel-idle-after-configured-tracking");

  await clickByText(client, "Spustit nahrávání", 0);
  await captureRecordingTransition(client, {
    checking: "quick-recording-checking",
    recording: null,
  });
  await assertRecordingElapsed(client);
  await assertText(client, "Rychlá nahrávka");
  await assertTray(client, "recording");
  await screenshot(client, "quick-recording");
  await clickByText(client, "Ukončit a uložit", 0);
  await captureRecordingTransition(client, {
    saved: null,
    stopping: "recording-stopping-before-submit",
  });
  await assertRecordingNaming(client);
  await screenshot(client, "recording-naming-before-submit");
  await submitRecordingName(client, "Porada provozu");
  await assertTray(client, "idle");
  await screenshot(client, "panel-after-submit");
  verifiedChecks.push("recording");

  await clickByAria(client, "Otevřít nastavení");
  settings = await connectTarget(
    (target) => target.type === "page"
      && target.url.startsWith("file://")
      && target.url.includes("/dist/index.html#settings"),
    "nastavení",
  );
  await exerciseSettings(settings);
  verifiedChecks.push(
    "settings-account",
    "settings-audio",
    "settings-recordings",
    "settings-diagnostics",
    "settings-restored",
  );
  await clickByText(settings, "Hotovo");
  await waitFor(
    async () => !(await targets()).some((target) => (
      target.url.startsWith("file://") && target.url.includes("/dist/index.html#settings")
    )),
    "zavření nastavení",
  );
  settings.close();
  settings = undefined;

  await assertText(client, "Spustit nahrávání");
  await assertTray(client, "idle");
  await screenshot(client, "panel-final");
  verifiedChecks.push("panel-return");

  return buildSmokeReport({
    outcome: "authenticated-profile",
    screens,
    verifiedChecks,
  });
}

async function cleanupScreenshot(client, name) {
  try {
    await screenshot(client, name);
  } catch (error) {
    observations.push({
      artifactError: error instanceof Error ? error.message : String(error),
      scope: `cleanup/${name}`,
    });
  }
}

async function cleanupPendingAuth(client) {
  const pending = await client.evaluate("window.ludone.pendingAuthUrl()");
  const waiting = await client.evaluate(
    "document.querySelector('[data-testid=\"auth-waiting-screen\"]') !== null",
  );
  if (!pending && !waiting) return;
  if (waiting) {
    await cleanupScreenshot(client, "cleanup-auth-waiting");
    try {
      await clickBySelector(client, '[data-testid="auth-waiting-cancel"]', "Zrušit");
    } catch (error) {
      observations.push({
        cleanupWarning: error instanceof Error ? error.message : String(error),
        scope: "auth-ui",
      });
      await client.evaluate("window.ludone.cancelAuth()");
    }
  } else {
    await client.evaluate("window.ludone.cancelAuth()");
  }
  await waitFor(
    () => client.evaluate("window.ludone.pendingAuthUrl().then((value) => value === null)"),
    "úklid OAuth pokusu",
  );
  const returnedToEntry = await client.evaluate(
    "document.querySelector('.auth-step') !== null",
  );
  if (returnedToEntry) await cleanupScreenshot(client, "cleanup-auth-entry");
  observations.push({ cleanup: "auth", result: "cancelled" });
}

async function cleanupPanelActivity(client) {
  const tracking = await client.evaluate(
    "document.querySelector('.tracking-card')?.dataset.activityState === 'tracking'",
  );
  if (tracking) {
    await cleanupScreenshot(client, "cleanup-tracking-active");
    await clickByAria(client, "Zastavit LuTrack");
    await waitFor(
      () => client.evaluate(
        "document.querySelector('.tracking-card')?.dataset.activityState === 'idle'",
      ),
      "úklid LuTracku",
    );
    observations.push({ cleanup: "tracking", result: "stopped" });
  }

  let phase = await client.evaluate(
    "document.querySelector('.recording-card')?.dataset.recordingPhase || null",
  );
  if (phase === "checking") {
    await cleanupScreenshot(client, "cleanup-recording-checking");
    phase = await waitFor(
      () => client.evaluate(`(() => {
        const value = document.querySelector('.recording-card')?.dataset.recordingPhase || null;
        return value !== "checking" ? value : null;
      })()`),
      "dokončení kontroly zvuku při úklidu",
    );
    await cleanupScreenshot(client, `cleanup-recording-${phase}`);
  }
  if (phase === "recording") {
    await cleanupScreenshot(client, "cleanup-recording-active");
    const selector = await client.evaluate(`document.querySelector('[data-testid="recording-stop"]')
      ? '[data-testid="recording-stop"]'
      : '[data-testid="degraded-recording-stop"]'`);
    await clickBySelector(client, selector, "ukončit nahrávání při úklidu");
    phase = "stopping";
    await cleanupScreenshot(client, "cleanup-recording-stopping");
  }
  if (phase === "stopping") {
    phase = await waitFor(
      () => client.evaluate(`(() => {
        const value = document.querySelector('.recording-card')?.dataset.recordingPhase || null;
        return ["idle", "saved"].includes(value) ? value : null;
      })()`),
      "uložení nahrávky při úklidu",
      20_000,
    );
    await cleanupScreenshot(client, `cleanup-recording-${phase}`);
  }
  if (phase === "saved") {
    await skipRecordingNaming(client);
    await cleanupScreenshot(client, "cleanup-recording-idle");
  }
  if (["checking", "recording", "saved", "stopping"].includes(phase)) {
    await waitFor(
      () => client.evaluate(
        "document.querySelector('.recording-card')?.dataset.recordingPhase === 'idle'",
      ),
      "klidový stav nahrávání po úklidu",
      20_000,
    );
    observations.push({ cleanup: "recording", result: "stopped" });
  }
}

async function writeObservations(payload) {
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  await writeFile(path.join(outputDir, "observations.json"), serialized);
  await writeFile(path.join(outputRoot, "observations.json"), serialized);
}

let panel;
let settings;

try {
  panel = await connectTarget(
    (target) => target.type === "page"
      && target.url.startsWith("file://")
      && target.url.includes("/dist/index.html")
      && !target.url.endsWith("#settings"),
    "hlavní panel",
  );
  const initialState = await waitForInitialRoute(panel);
  const report = initialState.route === "panel-and-settings"
    ? await runPanelAndSettings(panel)
    : await runOnboardingToAuthBoundary(panel, initialState);

  await writeObservations({
    ...report,
    checks: observations.length,
    observations,
    outputDir,
  });
  console.log(formatSmokeReport(report));
  process.exitCode = report.exitCode;
} catch (error) {
  let failureScreenshotSaved = false;
  for (const failureClient of [settings, panel].filter(Boolean)) {
    try {
      await screenshot(failureClient, "failure");
      failureScreenshotSaved = true;
      break;
    } catch (screenshotError) {
      observations.push({
        artifactError: screenshotError instanceof Error
          ? screenshotError.message
          : String(screenshotError),
      });
    }
  }
  if (!failureScreenshotSaved) {
    observations.push({ artifactError: "Snímek selhání se nepodařilo uložit." });
  }

  const cleanupErrors = [];
  if (settings) {
    try {
      await settings.evaluate("window.ludone.closeSettings()");
      observations.push({ cleanup: "settings-window", result: "close-requested" });
    } catch (cleanupError) {
      cleanupErrors.push({
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        scope: "settings-window",
      });
    }
  }
  if (panel) {
    for (const [scope, cleanup] of [
      ["auth", () => cleanupPendingAuth(panel)],
      ["panel", () => cleanupPanelActivity(panel)],
    ]) {
      try {
        await cleanup();
      } catch (cleanupError) {
        cleanupErrors.push({
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          scope,
        });
      }
    }
  }
  if (panel && cleanupErrors.length > 0) {
    try {
      const result = await panel.evaluate("window.ludone.testQuit()");
      if (result?.allowed !== true) {
        throw new Error(`test:quit nebyl povolen: ${JSON.stringify(result)}`);
      }
      observations.push({ cleanup: "safe-quit", result: "requested" });
    } catch (cleanupError) {
      cleanupErrors.push({
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        scope: "safe-quit",
      });
    }
  }
  await writeObservations({
    complete: false,
    cleanupErrors,
    error: error instanceof Error ? error.stack : String(error),
    exitCode: 1,
    observations,
    outputDir,
    screenshots: screens.map((screen) => screen.path),
    status: "failed",
  });
  console.error(error instanceof Error ? error.stack : error);
  for (const cleanupError of cleanupErrors) {
    console.error(`⚠️ Úklid ${cleanupError.scope} selhal: ${cleanupError.error}`);
  }
  process.exitCode = 1;
} finally {
  settings?.close();
  panel?.close();
  console.log(formatScreenshotList(screens.map((screen) => screen.path)));
}
