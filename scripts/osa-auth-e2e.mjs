import { mkdtemp, mkdir, realpath, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { installSyntheticAudioCapture } from "./osa-synthetic-capture.mjs";
import { CdpClient, freePort, waitFor, getTargets } from "./osa-cdp.mjs";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electron = createRequire(import.meta.url)("electron");
const output = path.join(project, ".runtime/osa-auth-e2e", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const observations = [];
function check(name, value) {
  observations.push({ name, pass: Boolean(value), syntheticTransport: true });
  console.log(`${value ? "PASS" : "FAIL"} ${name}`);
  if (!value) throw new Error(name);
}
let exitCode = 1;
try {
  for (const mode of (process.env.LUDONE_OSA_MODES || "complete,expired,companies-error,rate,incomplete,mismatch,offline").split(",")) {
    const parent = await realpath(await mkdtemp(path.join(os.tmpdir(), "ludone-osa-auth-e2e-")));
    const root = path.join(parent, "isolated-data");
    await mkdir(root, { mode: 0o700 });
    await writeFile(path.join(root, ".public-synthetic-identity"), "OSA_PUBLIC_FIXTURE_V1\n", { mode: 0o600 });
    const port = await freePort(); let log = ""; let panel; let detail; let scenarioCompleted = false;
    const child = spawn(electron, ["scripts/osa-auth-e2e-bootstrap.cjs", `--remote-debugging-port=${port}`, "--disable-background-timer-throttling"], {
      cwd: project, env: { ...process.env, LUDONE_E2E: "1", LUDONE_DESIGN_E2E: "1", LUDONE_OSA_AUTH_E2E: "1", LUDONE_OSA_TRANSPORT_FIXTURE: mode, LUDONE_DATA_DIR: root, DESKTOP_UPLOAD_ENABLED: "false", LUDONE_E2E_HARD_STOP_MS: "300000" }, stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", value => { log += value; }); child.stderr.on("data", value => { log += value; });
    const connect = async target => { const client = new CdpClient(target.webSocketDebuggerUrl); await client.ready; await client.send("Page.enable"); return client; };
    const click = async (selector, client = panel) => {
      await client.send("Page.bringToFront");
      await delay(150);
      if (await client.evaluate("document.hidden")) await client.evaluate("window.ludone.testClickTray()");
      const point = await client.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled)throw new Error('Nedostupný prvek: '+${JSON.stringify(selector)});el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const top=document.elementFromPoint(x,y);if(!r.width||!r.height||!(top===el||el.contains(top)))throw new Error('Prvek není dosažitelný ukazatelem');return {x,y};})()`);
      await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
      await delay(100);
      await client.send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
      await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
      await delay(150);
    };
    const clickText = async (text, client = detail) => {
      await client.send("Page.bringToFront");
      await delay(400);
      await client.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)}));if(!b)throw new Error('Chybí tlačítko');b.dataset.osaPointerTarget='true';})()`);
      await click('[data-osa-pointer-target="true"]', client);
      await client.evaluate("document.querySelector('[data-osa-pointer-target]')?.removeAttribute('data-osa-pointer-target')");
    };
    const capture = async (name, client = panel) => {
      const data = await client.evaluate("window.ludone.testCaptureWindow()");
      if (!data?.startsWith("data:image/png;base64,")) throw new Error("Chybí nativní snímek");
      await writeFile(path.join(output, `${mode}-${name}.png`), Buffer.from(data.split(",")[1], "base64"));
      check(`${mode}-${name}-no-horizontal-overflow`, await client.evaluate("document.documentElement.scrollWidth<=innerWidth"));
    };
    const navigate = async page => {
      await click(`.osa-rail [data-page=${page}]`);
      await waitFor(() => panel.evaluate(`document.querySelector('.osa-shell')?.dataset.osaPage===${JSON.stringify(page)}`), page);
    };
    try {
      const target = await waitFor(async () => (await getTargets(port)).find(item => item.type === "page" && item.url.includes("/dist/index.html") && !item.url.includes("#settings")), `panel ${mode}`);
      panel = await connect(target);
      await waitFor(() => panel.evaluate("Boolean(document.querySelector('.osa-shell'))"), "shell");
      if (mode === "complete") {
        for (const theme of ["light", "professional", "dark"]) {
          await panel.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
          await capture(`${theme}-onboarding`);
        }
      }
      await panel.evaluate("localStorage.setItem('ludone.prototype.onboarding-complete','true');location.reload()");
      await waitFor(() => panel.evaluate("Boolean(document.querySelector('.osa-rail'))"), "home");
      await waitFor(() => panel.evaluate(`document.querySelector('.osa-auth-status')?.dataset.authState===${JSON.stringify(mode === "expired" ? "expired" : "signed-in")}`), "scoped synthetic session");
      check(`${mode}-actual-scoped-session`, true);
      if (mode === "offline") {
        await panel.send("Network.enable");
        await panel.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
        await waitFor(() => panel.evaluate("navigator.onLine===false"), "actual renderer offline");
      }
      const snapshot = await panel.evaluate("window.ludone.listLocalRecordings()");
      check(`${mode}-four-real-disk-recordings`, snapshot.items.length === 4);
      for (const theme of ["light", "professional", "dark"]) {
        await panel.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
        await navigate("home"); await capture(`${theme}-ready`);
        await navigate("library"); await capture(`${theme}-history`);
        if (mode === "complete") {
          await navigate("settings");
          for (const [scenario, section] of [["account", "account"], ["audio", "audio"], ["device", "device"], ["storage", "recordings"], ["diagnostics", "diagnostics"]]) {
            await click(`.osa-settings-section:has(#osa-section-${section})>button`);
            check(`${theme}-${section}-expanded`, await panel.evaluate(`document.querySelector('#osa-section-${section}')?.hidden===false`));
            await capture(`${theme}-${scenario}`);
          }
        }
        const id = mode === "companies-error" ? "40000000-0000-4000-8000-000000000004" : "40000000-0000-4000-8000-000000000001";
        await panel.evaluate(`window.ludone.openRecordingDetail(${JSON.stringify(id)})`);
        const detailTarget = await waitFor(async () => (await getTargets(port)).find(item => item.url.includes("recordingId=")), "detail");
        detail?.close(); detail = await connect(detailTarget);
        await waitFor(() => detail.evaluate("Boolean(document.querySelector('.recording-queue-card__detail'))"), "detail loaded");
        await detail.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
        if (!["expired", "companies-error", "offline"].includes(mode)) {
          await clickText("Ověřit v LuDone");
          const expected = { complete: "complete", incomplete: "incomplete", mismatch: "mismatch", rate: "rate_limited" }[mode];
          await waitFor(() => detail.evaluate(`Boolean(document.querySelector('.recording-queue-card__track[data-status=${expected}]'))`), `actual verifier ${expected}`).catch(async error => {await capture(`${theme}-verifier-failed`,detail);throw error;});
          check(`${theme}-${mode}-actual-verifier`, true);
        }
        if (mode === "companies-error") {
          await waitFor(() => detail.evaluate("document.body.textContent.includes('Firmy nelze ověřit')"), "actual company failure");
          check(`${theme}-company-failure-visible`, true);
        }
        await capture(`${theme}-detail`, detail);
        await detail.evaluate("window.ludone.closeSettings()"); detail.close(); detail = null; await delay(100);
        await navigate("queue"); await capture(`${theme}-queue`);
        if (mode === "complete") {
          await navigate("updates"); await capture(`${theme}-updates`);
          await navigate("home"); await panel.evaluate("window.ludone.hidePanel()");
          await panel.evaluate("window.ludone.testClickTray()"); await capture(`${theme}-tray`);
          for (const [scenario, fixtureId] of [["unclaimed", "003"], ["missing", "004"]]) {
            await panel.evaluate(`window.ludone.openRecordingDetail('40000000-0000-4000-8000-000000000${fixtureId}')`);
            detail = await connect(await waitFor(async () => (await getTargets(port)).find(t=>t.url.includes("recordingId=")), scenario));
            await waitFor(() => detail.evaluate("Boolean(document.querySelector('.recording-queue-card__detail'))"), scenario);
            await detail.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
            check(`${theme}-${scenario}-actual-disk-state`, await detail.evaluate(scenario === "unclaimed" ? "document.body.textContent.includes('Převzít')" : "!document.querySelector('.osa-station button')?.textContent.includes('Přehrát')"));
            await capture(`${theme}-${scenario}`,detail);
            await detail.evaluate("window.ludone.closeSettings()"); detail.close();detail=null;
          }
          await navigate("home"); await installSyntheticAudioCapture(panel);
          await click('.recording-card .idle-feature-row__action');
          await waitFor(() => panel.evaluate("document.querySelector('.recording-card')?.classList.contains('is-active')"), "real synthetic recording");
          check(`${theme}-recording-main-authority`, await panel.evaluate("window.ludone.getTrayState().then(s=>s==='recording')"));
          await capture(`${theme}-recording`);
          await panel.evaluate("window.__ludoneE2ESyntheticAudio.loseSystemTrack()");
          await waitFor(() => panel.evaluate("window.ludone.getTrayState().then(s=>s==='recording-audio-lost')"), "real channel loss");
          await capture(`${theme}-system-lost`);
          await writeFile(path.join(root, ".public-hold-finalization"), "OSA_PUBLIC_FIXTURE_V1");
          await click('[data-testid=recording-stop],[data-testid=degraded-recording-stop]');
          await waitFor(() => panel.evaluate("window.ludone.getTrayState().then(s=>s==='saving')"), "actual held finalization");
          await capture(`${theme}-saving`);
          await unlink(path.join(root, ".public-hold-finalization"));
          await waitFor(() => panel.evaluate("Boolean(document.querySelector('.recording-card--saved'))"), "real save decision", 20000);
          await capture(`${theme}-save`);
          await click('.recording-saved__skip');
          await waitFor(() => panel.evaluate("!document.querySelector('.recording-card--saved')"), "local decision persisted");
          await installSyntheticAudioCapture(panel, { microphoneOnly: true });
          await click('.recording-card .idle-feature-row__action');
          await waitFor(() => panel.evaluate("window.ludone.getTrayState().then(s=>s==='recording-microphone-only')"), "real microphone-only path");
          await capture(`${theme}-microphone-only`);
          await click('[data-testid=recording-stop],[data-testid=degraded-recording-stop]');
          await waitFor(() => panel.evaluate("Boolean(document.querySelector('.recording-card--saved'))"), "microphone-only decision", 20000);
          await click('.recording-saved__skip');
          await waitFor(() => panel.evaluate("!document.querySelector('.recording-card--saved')"), "microphone-only local saved");
        }
      }
      if (mode === "complete") {
        await panel.evaluate("window.ludone.openRecordingDetail('40000000-0000-4000-8000-000000000003')");
        detail = await connect(await waitFor(async () => (await getTargets(port)).find(item => item.url.includes("recordingId=")), "claim detail"));
        await waitFor(() => detail.evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Převzít'))"), "explicit claim");
        await clickText("Převzít");
        await waitFor(() => detail.evaluate("window.ludone.listLocalRecordings().then(s=>s.items.find(i=>i.id.endsWith('003'))?.ownership==='current')"), "actual claim ownership");
        const claimed = await detail.evaluate("window.ludone.listLocalRecordings().then(s=>s.items.find(i=>i.id.endsWith('003')))");
        check("claim-disk-owner-without-upload", claimed.uploadIntent === "held" && claimed.ownership === "current");
        for (const theme of ["light", "professional", "dark"]) {
          await detail.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
          await capture(`${theme}-local-detail`, detail);
        }
        const targetVisibility = claimed.uploadPreferences?.visibility === "private" ? "company" : "private";
        const originalPreferences = JSON.stringify(claimed.uploadPreferences);
        const snapshotItem = () => panel.evaluate("window.ludone.listLocalRecordings().then(s=>s.items.find(i=>i.id.endsWith('003')))");
        const editVisibility = async () => {
          await waitFor(() => detail.evaluate("Boolean(document.querySelector('[data-testid=recording-upload-visibility]:not(:disabled)'))"), "editable preferences");
          await detail.send("Page.bringToFront");
          await delay(300);
          // CDP nativní macOS popup selectu blokuje; posíláme skutečný change Reactu.
          // Dosažitelnost tlačítek Save/Discard/Stay měří skutečný ukazatel zvlášť.
          await detail.evaluate("(()=>{const el=document.querySelector('[data-testid=recording-upload-visibility]');if(el.disabled)throw new Error('Přístup není editovatelný');el.focus();Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'"+targetVisibility+"');el.dispatchEvent(new Event('change',{bubbles:true}));})()");
          await waitFor(() => detail.evaluate("document.querySelector('[data-testid=recording-upload-visibility]')?.value==='"+targetVisibility+"'"), "actual private selection");
          await delay(200);
        };
        await editVisibility();
        await writeFile(path.join(root, ".public-close-choice"), "2");
        await clickText("Zpět do panelu");
        await delay(300);
        check("dirty-stay-keeps-detail", (await getTargets(port)).some(t=>t.url.includes("recordingId=40000000-0000-4000-8000-000000000003")));
        check("dirty-stay-does-not-write", JSON.stringify((await snapshotItem()).uploadPreferences) === originalPreferences);
        await capture("dirty-stay", detail);
        await writeFile(path.join(root, ".public-close-choice"), "1");
        await clickText("Zpět do panelu");
        await waitFor(async () => !(await getTargets(port)).some(t=>t.url.includes("recordingId=")), "discard closed detail");
        detail.close(); detail = null;
        check("dirty-discard-does-not-write", JSON.stringify((await snapshotItem()).uploadPreferences) === originalPreferences);
        await panel.evaluate("window.ludone.openRecordingDetail('40000000-0000-4000-8000-000000000003')");
        detail = await connect(await waitFor(async () => (await getTargets(port)).find(t=>t.url.includes("recordingId=")), "save detail"));
        await editVisibility();
        await writeFile(path.join(root, ".public-close-choice"), "0");
        await clickText("Zpět do panelu");
        await waitFor(async () => !(await getTargets(port)).some(t=>t.url.includes("recordingId=")), "saved closed detail");
        detail.close(); detail = null;
        const saved = await snapshotItem();
        check("dirty-save-actual-CAS-without-upload", saved.uploadPreferences?.visibility === targetVisibility && saved.uploadIntent === "held");
      }
      scenarioCompleted = true;
    } catch (error) {
      console.error(`Scénář ${mode}: ${error.message}`);
      throw error;
    } finally {
      panel?.close(); detail?.close();
      if (child.exitCode === null) { child.kill("SIGTERM"); await Promise.race([new Promise(resolve => child.once("exit", resolve)), delay(3000)]); if (child.exitCode === null) child.kill("SIGKILL"); }
      await writeFile(path.join(output, `${mode}-electron.log`), log);
      const audit = JSON.parse(await readFile(path.join(root, "transport-audit.json"), "utf8"));
      await writeFile(path.join(output, `${mode}-transport.json`), JSON.stringify(audit, null, 2));
      check(`${mode}-one-identity-projection-hook`, audit.identityHookCount === 1);
      check(`${mode}-no-unexpected-network`, audit.calls.every(call => call.allowed));
      check(`${mode}-no-upload`, audit.calls.every(call => call.method === "GET"));
      if (mode === "complete" && scenarioCompleted) check("dirty-all-three-dialog-decisions", JSON.stringify(audit.dialogChoices) === "[2,1,0]");
    }
  }
  exitCode = 0;
} catch (error) { console.error(error.message); }
await writeFile(path.join(output, "results.json"), JSON.stringify({ exitCode, observations, syntheticIdentity: true, syntheticTransport: true, productionServerVerified: false }, null, 2));
console.log(`Důkazy: ${output}\nEXIT_CODE=${exitCode}`); process.exitCode = exitCode;
