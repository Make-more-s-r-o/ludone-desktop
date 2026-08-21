import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEBUG_PORT = Number(process.env.LUDONE_DEBUG_PORT || 9333);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const outputDir = path.join(projectRoot, ".runtime", "smoke");
const observations = [];

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
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) {
        this.events.push(message);
        if (this.events.length > 200) this.events.shift();
        return;
      }
      if (!this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.code}: ${message.error.message}`));
      else resolve(message.result);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
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
      throw new Error(result.exceptionDetails.exception?.description || "Chyba Runtime.evaluate");
    }
    return result.result.value;
  }

  close() {
    this.socket.close();
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

async function clickByText(client, text) {
  const result = await client.evaluate(`(() => {
    const normalize = (value) => value.replace(/\\s+/g, " ").trim();
    const control = [...document.querySelectorAll("button")]
      .find((item) => normalize(item.textContent).includes(${JSON.stringify(text)}) && !item.disabled);
    if (!control) return { ok: false };
    control.click();
    return { ok: true, text: normalize(control.textContent) };
  })()`);
  if (!result?.ok) throw new Error(`Klikací tlačítko s textem „${text}“ nebylo nalezeno.`);
  observations.push({ action: "click", target: result.text });
  await delay(120);
}

async function clickByAria(client, label) {
  const result = await client.evaluate(`(() => {
    const control = document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)});
    if (!control || control.disabled) return false;
    control.click();
    return true;
  })()`);
  if (!result) throw new Error(`Klikací prvek aria-label „${label}“ nebyl nalezen.`);
  observations.push({ action: "click", target: label });
  await delay(120);
}

async function clickFirstMeeting(client) {
  const result = await client.evaluate(`(() => {
    const control = document.querySelector('button[aria-label^="Nahrát schůzku"]');
    if (!control || control.disabled) return false;
    control.click();
    return control.getAttribute("aria-label");
  })()`);
  if (!result) throw new Error("Tlačítko Nahrát u schůzky nebylo nalezeno.");
  observations.push({ action: "click", target: result });
  await delay(120);
}

async function assertTray(client, expected) {
  const actual = await waitFor(
    () => client.evaluate("window.ludone.getTrayState()"),
    `tray state ${expected}`,
  );
  if (actual !== expected) throw new Error(`Tray stav: čekám ${expected}, dostal jsem ${actual}`);
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
  const target = path.join(outputDir, `${name}.png`);
  await writeFile(target, Buffer.from(result.data, "base64"));
  observations.push({ artifact: target });
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

async function setSettings(client) {
  const result = await client.evaluate(`(() => {
    const auto = document.querySelector('[aria-label="Automaticky nahrávat schůzky z kalendáře"]');
    const ask = document.querySelector('[aria-label="Ptát se před nahráváním ostatních hovorů"]');
    auto.click();
    ask.click();
    const select = document.querySelector('.settings-select select');
    select.value = '7 dní po odeslání';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!result) throw new Error("Nastavení nebylo možné změnit.");
  await delay(180);
  const values = await client.evaluate(`(() => ({
    auto: document.querySelector('[aria-label="Automaticky nahrávat schůzky z kalendáře"]').getAttribute('aria-checked'),
    ask: document.querySelector('[aria-label="Ptát se před nahráváním ostatních hovorů"]').getAttribute('aria-checked'),
    retention: document.querySelector('.settings-select select').value,
  }))()`);
  if (values.auto !== "true" || values.ask !== "false" || values.retention !== "7 dní po odeslání") {
    throw new Error(`Nastavení má jiné hodnoty: ${JSON.stringify(values)}`);
  }
  observations.push({ action: "settings", ...values });
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

  if (process.env.LUDONE_EXPECT_EMPTY_CALENDAR === "1") {
    await assertText(panel, "Dnešek je volný.");
    await assertText(panel, "Ideální chvíle dotáhnout věci bez dalšího hovoru.");
    const eventRows = await panel.evaluate("document.querySelectorAll('.event-row').length");
    if (eventRows !== 0) throw new Error(`Empty calendar obsahuje ${eventRows} řádků událostí.`);
    await assertTray(panel, "idle");
    await screenshot(panel, "10-empty-calendar");
    const reportPath = path.join(outputDir, "empty-calendar-observations.json");
    await writeFile(reportPath, `${JSON.stringify({ ok: true, observations }, null, 2)}\n`);
    console.log(JSON.stringify({ ok: true, mode: "empty-calendar", checks: observations.length }, null, 2));
    panel.close();
    process.exit(0);
  }

  await assertText(panel, "Rozhovory a čas.");
  await assertTray(panel, "signed-out");
  await screenshot(panel, "01-welcome-signed-out");

  await clickByText(panel, "Začít");
  await assertText(panel, "Propojte svůj účet");
  await clickByText(panel, "Přihlásit v prohlížeči");
  await assertText(panel, "Aby LuDone pomohlo");

  for (let index = 0; index < 3; index += 1) {
    await clickByText(panel, "Povolit");
    await delay(350);
  }
  await assertText(panel, "Povoleno");
  await clickByText(panel, "Pokračovat");
  await assertText(panel, "LuDone čeká");
  await screenshot(panel, "02-onboarding-done");

  await clickByText(panel, "Otevřít můj panel");
  await assertText(panel, "Co mě dnes čeká");
  await assertTray(panel, "idle");
  await verifyTrayToggle(panel);
  await screenshot(panel, "03-panel-idle");

  await clickFirstMeeting(panel);
  await delay(1150);
  await assertText(panel, "Obě stopy ověřeny");
  await assertText(panel, "00:00:01");
  await assertTray(panel, "recording");
  await screenshot(panel, "04-meeting-recording");

  await clickByAria(panel, "Spustit LuTrack");
  await delay(1150);
  await assertTray(panel, "recording");
  await assertText(panel, "Stop");
  await screenshot(panel, "05-recording-and-tracking");

  await clickByText(panel, "Zastavit nahrávání");
  await assertTray(panel, "tracking");
  await screenshot(panel, "06-tracking-only");
  await clickByAria(panel, "Zastavit LuTrack");
  await assertTray(panel, "idle");

  await setPanelInputs(panel);
  await clickByAria(panel, "Spustit LuTrack");
  await delay(1100);
  const trackingValues = await panel.evaluate(`(() => ({
    project: document.querySelector('.tracking-card select').value,
    description: document.querySelector('.tracking-card input').value,
    locked: document.querySelector('.tracking-card select').disabled,
  }))()`);
  if (!trackingValues.locked || trackingValues.project !== "Web · klientská zóna") {
    throw new Error(`Běžící LuTrack neuzamkl projekt: ${JSON.stringify(trackingValues)}`);
  }
  await assertTray(panel, "tracking");
  await screenshot(panel, "07-configured-tracking");
  await clickByAria(panel, "Zastavit LuTrack");

  await clickByText(panel, "Spustit nahrávání");
  await delay(1100);
  await assertText(panel, "Rychlá nahrávka");
  await assertTray(panel, "recording");
  await clickByText(panel, "Zastavit nahrávání");
  await assertTray(panel, "idle");

  await clickByAria(panel, "Otevřít nastavení");
  settings = await connectTarget(
    (target) => target.type === "page"
      && target.url.startsWith("file://")
      && target.url.includes("/dist/index.html#settings"),
    "nastavení",
  );
  await assertText(settings, "Kdy nahrávat");
  await setSettings(settings);
  await screenshot(settings, "08-settings-changed");
  await clickByText(settings, "Hotovo");
  await waitFor(
    async () => !(await targets()).some((target) => (
      target.url.startsWith("file://") && target.url.includes("/dist/index.html#settings")
    )),
    "zavření nastavení",
  );

  await assertText(panel, "Co mě dnes čeká");
  await assertTray(panel, "idle");
  await screenshot(panel, "09-panel-final");

  const reportPath = path.join(outputDir, "observations.json");
  await writeFile(reportPath, `${JSON.stringify({ ok: true, observations }, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, checks: observations.length, outputDir }, null, 2));
} catch (error) {
  const reportPath = path.join(outputDir, "observations.json");
  await writeFile(
    reportPath,
    `${JSON.stringify({ ok: false, error: error.stack, observations }, null, 2)}\n`,
  );
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  settings?.close();
  panel?.close();
}
