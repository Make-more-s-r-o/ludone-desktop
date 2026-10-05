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
let matrix = [];
const modes = (process.env.LUDONE_OSA_MODES || "complete,expired,companies-error,rate,incomplete,mismatch,offline").split(",");
try {
  for (const mode of modes) {
    const parent = await realpath(await mkdtemp(path.join(os.tmpdir(), "ludone-osa-auth-e2e-")));
    const root = path.join(parent, "isolated-data");
    await mkdir(root, { mode: 0o700 });
    await writeFile(path.join(root, ".public-synthetic-identity"), "OSA_PUBLIC_FIXTURE_V1\n", { mode: 0o600 });
    const port = await freePort(); let log = ""; let panel; let detail; let scenarioCompleted = false; const priorAudits = [];
    const launch = () => { const started = spawn(electron, ["scripts/osa-auth-e2e-bootstrap.cjs", `--remote-debugging-port=${port}`, "--disable-background-timer-throttling"], {
      cwd: project, env: { ...process.env, LUDONE_E2E: "1", LUDONE_DESIGN_E2E: "1", LUDONE_OSA_AUTH_E2E: "1", LUDONE_OSA_TRANSPORT_FIXTURE: mode, LUDONE_DATA_DIR: root, DESKTOP_UPLOAD_ENABLED: "false", LUDONE_E2E_HARD_STOP_MS: "300000" }, stdio: ["ignore", "pipe", "pipe"],
    });
    started.stdout.on("data", value => { log += value; }); started.stderr.on("data", value => { log += value; });
    return started; };
    let child = launch();
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
      await client.evaluate(`(()=>{document.querySelector('[data-osa-pointer-target]')?.removeAttribute('data-osa-pointer-target');const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)}));if(!b)throw new Error('Chybí tlačítko');b.dataset.osaPointerTarget='true';})()`);
      await click('[data-osa-pointer-target="true"]', client);
    };
    const capture = async (name, client = panel) => {
      if (client === detail) await client.evaluate("document.querySelector('.osa-workspace').scrollTop=0");
      await delay(200);
      await client.evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
      const data = await client.evaluate("window.ludone.testCaptureWindow()");
      if (!data?.startsWith("data:image/png;base64,")) throw new Error("Chybí nativní snímek");
      await writeFile(path.join(output, `${mode}-${name}.png`), Buffer.from(data.split(",")[1], "base64"));
      check(`${mode}-${name}-system-font`, await client.evaluate("[...document.querySelectorAll('h1,h2,h3,p,button,label,select,input,strong,small,time')].filter(el=>el.getClientRects().length).every(el=>getComputedStyle(el).fontFamily.includes('-apple-system'))"));
      check(`${mode}-${name}-no-horizontal-overflow`, await client.evaluate("document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('.osa-workspace')].every(el=>el.scrollWidth<=el.clientWidth)"));
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
          await panel.evaluate(`localStorage.setItem('ludone.desktop.theme',${JSON.stringify(theme)});document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
          check(`${theme}-onboarding-axis-is-vertical`,await panel.evaluate("(()=>{const nodes=[...document.querySelectorAll('.osa-onboarding__axis>li')].map(el=>el.getBoundingClientRect());return nodes.length===6&&nodes.every((r,i)=>Math.abs(r.left-nodes[0].left)<1&&(i===0||r.top>nodes[i-1].bottom));})()"));
          await capture(`${theme}-onboarding`);
          check(`${theme}-onboarding-no-nested-chrome`,await panel.evaluate("!document.querySelector('.onboarding .desktop-titlebar,.onboarding .desktop-navigation')&&Boolean(document.querySelector('.osa-onboarding__axis'))"));
          await clickText("Začít",panel); await capture(`${theme}-onboarding-auth`);
          await clickText("Přihlásit v prohlížeči",panel); await capture(`${theme}-onboarding-waiting`);
          await waitFor(()=>panel.evaluate("Boolean(document.querySelector('.permission-step'))"),"actual onboarding permission step");
          for (const source of ['microphone','system-audio']) if (await panel.evaluate(`!document.querySelector('[data-permission-id=${source}] button').disabled`)) await click(`[data-permission-id=${source}] button`);
          await capture(`${theme}-onboarding-permissions`);
          await installSyntheticAudioCapture(panel);
          await click('.permission-step>.button');
          await waitFor(()=>panel.evaluate("Boolean(document.querySelector('[data-testid=recording-test-screen]'))"),"actual onboarding audio step");
          check(`${theme}-onboarding-does-not-claim-human-hearing`,await panel.evaluate("document.querySelector('[data-testid=recording-test-continue]').disabled"));
          await capture(`${theme}-onboarding-audio`);
          await click('[data-testid=recording-test-skip]');
          check(`${theme}-onboarding-skip-stays-unverified`,await panel.evaluate("document.querySelector('.done-step')?.dataset.verificationState==='unverified'"));
          await capture(`${theme}-onboarding-done`);
          await panel.evaluate("location.reload()");
          await waitFor(()=>panel.evaluate("Boolean(document.querySelector('.welcome-step'))"),"reset only incomplete onboarding view");
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
        await panel.evaluate(`localStorage.setItem('ludone.desktop.theme',${JSON.stringify(theme)});document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
        await navigate("home"); await capture(`${theme}-ready`);
        await navigate("library");
        check(`${theme}-${mode}-history-node-centers`, await panel.evaluate("(()=>{const list=document.querySelector('.recordings-dashboard__list');const entries=[...document.querySelectorAll('.recordings-timeline__entry,.recordings-day__heading')];if(!list||!entries.length)return false;const line=getComputedStyle(list,'::before');const center=list.getBoundingClientRect().left+parseFloat(line.left)+parseFloat(line.width)/2;return entries.every(el=>{const node=getComputedStyle(el,'::before');const x=el.getBoundingClientRect().left+parseFloat(node.left)+parseFloat(node.width)/2;return Math.abs(x-center)<=1;});})()"));
        check(`${theme}-${mode}-one-update-banner`,await panel.evaluate("document.querySelectorAll('[data-testid=update-downloaded]').length<=1"));
        await capture(`${theme}-history`);
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
        await detail.evaluate(`localStorage.setItem('ludone.desktop.theme',${JSON.stringify(theme)});document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
        if (!["expired", "companies-error", "offline"].includes(mode)) {
          await clickText("Ověřit v LuDone");
          const expected = { complete: "complete", incomplete: "incomplete", mismatch: "mismatch", rate: "rate_limited" }[mode];
          await waitFor(() => detail.evaluate(`Boolean(document.querySelector('.recording-queue-card__track[data-status=${expected}]'))`), `actual verifier ${expected}`).catch(async error => {await capture(`${theme}-verifier-failed`,detail);throw error;});
          check(`${theme}-${mode}-actual-verifier`, true);
          if (mode === "rate") check(`${theme}-rate-recovery-first-viewport`,await detail.evaluate("(()=>{document.querySelector('.osa-workspace').scrollTop=0;const station=document.querySelector('[data-station=error]');const button=document.querySelector('.recording-action--verify');return !!station&&station.textContent.includes('omezil')&&station.getBoundingClientRect().bottom<=innerHeight&&!!button&&!button.disabled;})()"));
          check(`${theme}-${mode}-verified-action-hover-readable`, await detail.evaluate("(()=>{const el=document.querySelector('.recording-action--verify');if(!el)return false;const style=getComputedStyle(el);const luminance=color=>{const values=color.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*values[0]+.7152*values[1]+.0722*values[2];};const a=luminance(style.color),b=luminance(style.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5;})()"));
        }
        if (mode === "companies-error") {
          await waitFor(() => detail.evaluate("document.body.textContent.includes('Firmy nelze ověřit')"), "actual company failure");
          check(`${theme}-company-failure-visible`, true);
        }
        await capture(`${theme}-detail`, detail);
        await detail.evaluate("window.ludone.closeSettings()"); detail.close(); detail = null; await delay(100);
        await navigate("queue");
        check(`${theme}-${mode}-queue-one-update-banner`,await panel.evaluate("document.querySelectorAll('[data-testid=update-downloaded]').length<=1"));
        await capture(`${theme}-queue`);
        if (mode === "companies-error") {
          await navigate("home"); await installSyntheticAudioCapture(panel);
          await click('.recording-card .idle-feature-row__action');
          await waitFor(() => panel.evaluate("window.ludone.getTrayState().then(s=>s==='recording')"), "company-error actual recording");
          await click('[data-testid=recording-stop],[data-testid=degraded-recording-stop]');
          await waitFor(() => panel.evaluate("Boolean(document.querySelector('.recording-card--saved'))&&document.body.textContent.includes('Firmy nelze ověřit')"), "company-error actual post-stop decision",20000);
          await panel.evaluate("(()=>{const el=document.querySelector('[data-testid=recording-name-input]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'Porada zachovaná při chybě firem');el.dispatchEvent(new Event('input',{bubbles:true}));})()");
          check(`${theme}-company-default-retained-during-failure`,await panel.evaluate("window.ludone.getUploadCompanyDefault().then(v=>v.companyId==='50000000-0000-4000-8000-000000000001')"));
          check(`${theme}-company-error-send-blocked-local-available`,await panel.evaluate("document.querySelector('.recording-saved__skip')?.disabled===false&&[...document.querySelectorAll('.recording-saved__actions>button')].some(b=>b!==document.querySelector('.recording-saved__skip')&&b.disabled)&&Boolean(document.querySelector('.recording-saved input')?.value)"));
          await capture(`${theme}-companies-error`);
          const companyCallsBefore = JSON.parse(await readFile(path.join(root,"transport-audit.json"),"utf8")).calls.filter(c=>c.path.endsWith("/firmy")).length;
          await clickText("Načíst firmy",panel);
          await waitFor(async()=>JSON.parse(await readFile(path.join(root,"transport-audit.json"),"utf8")).calls.filter(c=>c.path.endsWith("/firmy")).length>companyCallsBefore,"actual company offer retry");
          check(`${theme}-company-retry-retains-title`,await panel.evaluate("document.querySelector('[data-testid=recording-name-input]').value==='Porada zachovaná při chybě firem'"));
          await waitFor(() => panel.evaluate("document.body.textContent.includes('Firmy nelze ověřit')"),"company retry remains truthful");
          await click('.recording-saved__skip');
          await waitFor(() => panel.evaluate("!document.querySelector('.recording-card--saved')"),"company failure safe local decision");
        }
        if (mode === "complete") {
          await navigate("updates");
          await writeFile(path.join(root,".public-update-available"),"OSA_PUBLIC_FIXTURE_V1");
          if (await panel.evaluate("Boolean(document.querySelector('[data-testid=update-check-now]'))")) await click('[data-testid=update-check-now]');
          await waitFor(() => panel.evaluate("Boolean(document.querySelector('[data-testid=update-downloaded]'))"), "actual updater downloaded");
          check(`${theme}-update-controller-actions`, await panel.evaluate("window.ludone.getUpdateStatus().then(s=>s.downloadedVersion==='0.1.9'&&s.manualCheckAvailable&&!s.installRequested)") && await panel.evaluate("!document.querySelector('[data-testid=update-install]').disabled"));
          await capture(`${theme}-updates`);
          await navigate("home"); await panel.evaluate("window.ludone.hidePanel()");
          await panel.evaluate("window.ludone.testClickTray()"); await capture(`${theme}-tray`);
          for (const [scenario, fixtureId] of [["unclaimed", "003"], ["missing", "004"]]) {
            await panel.evaluate(`window.ludone.openRecordingDetail('40000000-0000-4000-8000-000000000${fixtureId}')`);
            detail = await connect(await waitFor(async () => (await getTargets(port)).find(t=>t.url.includes("recordingId=")), scenario));
            await waitFor(() => detail.evaluate("Boolean(document.querySelector('.recording-queue-card__detail'))"), scenario);
            await detail.evaluate(`localStorage.setItem('ludone.desktop.theme',${JSON.stringify(theme)});document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
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
          check(`${theme}-system-lost-stop-contrast`, await panel.evaluate("(()=>{const el=document.querySelector('.recording-outage__stop');if(!el||el.disabled)return false;const s=getComputedStyle(el);const l=c=>{const v=c.match(/[0-9.]+/g).slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];};const a=l(s.color),b=l(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5;})()"));
          await capture(`${theme}-system-lost`);
          await writeFile(path.join(root, ".public-hold-finalization"), "OSA_PUBLIC_FIXTURE_V1");
          await click('[data-testid=recording-stop],[data-testid=degraded-recording-stop]');
          await waitFor(() => panel.evaluate("window.ludone.getTrayState().then(s=>s==='saving')"), "actual held finalization");
          await capture(`${theme}-saving`);
          await unlink(path.join(root, ".public-hold-finalization"));
          await waitFor(() => panel.evaluate("Boolean(document.querySelector('.recording-card--saved'))"), "real save decision", 20000);
          check(`${theme}-save-actions-side-by-side-visible`, await panel.evaluate("(()=>{const buttons=[...document.querySelectorAll('.recording-saved__actions>button')];if(buttons.length!==2)return false;const [a,b]=buttons.map(el=>el.getBoundingClientRect());return a.width>0&&b.width>0&&Math.abs(a.top-b.top)<2&&a.bottom<=innerHeight&&b.bottom<=innerHeight;})()"));
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
          await detail.evaluate(`localStorage.setItem('ludone.desktop.theme',${JSON.stringify(theme)});document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
          check(`${theme}-local-detail-editable-first-viewport`,await detail.evaluate("[...document.querySelectorAll('[data-testid=recording-upload-company],[data-testid=recording-upload-visibility]')].length===2&&[...document.querySelectorAll('[data-testid=recording-upload-company],[data-testid=recording-upload-visibility]')].every(el=>{const r=el.getBoundingClientRect();return !el.disabled&&r.top>=48&&r.bottom<=innerHeight;})"));
          check(`${theme}-actual-scroll-owner-overflow-and-stability`,await detail.evaluate("(()=>{const el=document.querySelector('.osa-workspace');if(!el||!['auto','scroll'].includes(getComputedStyle(el).overflowY)||el.scrollHeight<=el.clientHeight)return false;el.scrollTop=37;const before=el.scrollTop;document.querySelector('.recording-queue-card__storage').dataset.measurement='same-size';return before>0&&el.scrollTop===before&&innerHeight===580;})()"));
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
        const secondCompany = "50000000-0000-4000-8000-000000000002";
        await navigate("settings");
        await waitFor(() => panel.evaluate("Boolean(document.querySelector('[data-testid=upload-company-select]:not(:disabled)'))"), "account company offer");
        await panel.evaluate(`(()=>{const el=document.querySelector('[data-testid=upload-company-select]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,${JSON.stringify(secondCompany)});el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
        await click('[data-testid="upload-company-save"]');
        await waitFor(() => panel.evaluate(`window.ludone.getUploadCompanyDefault().then(v=>v.companyId===${JSON.stringify(secondCompany)})`), "stored explicit company");
        await delay(200);
        panel.close(); child.kill("SIGTERM");
        await Promise.race([new Promise(resolve => child.once("exit", resolve)), delay(3000)]);
        if (child.exitCode === null) { child.kill("SIGKILL"); await new Promise(resolve=>child.once("exit",resolve)); }
        priorAudits.push(JSON.parse(await readFile(path.join(root, "transport-audit.json"), "utf8")));
        child = launch();
        panel = await connect(await waitFor(async () => (await getTargets(port)).find(t=>t.url.includes("/dist/index.html")&&!t.url.includes("#settings")), "actual restarted panel"));
        await waitFor(() => panel.evaluate("document.querySelector('.osa-auth-status')?.dataset.authState==='signed-in'"), "restarted scoped session");
        check("company-default-survives-actual-process-restart", await panel.evaluate(`window.ludone.getUploadCompanyDefault().then(v=>v.companyId===${JSON.stringify(secondCompany)})`));
        await navigate("home"); await installSyntheticAudioCapture(panel);
        await click('.recording-card .idle-feature-row__action');
        await waitFor(() => panel.evaluate("window.ludone.getTrayState().then(s=>s==='recording')"), "post-restart recording");
        await delay(500);
        await navigate("updates"); await click('[data-testid=update-install]');
        check("update-install-waits-for-real-recording",await panel.evaluate("window.ludone.getUpdateStatus().then(s=>s.installRequested)")&&await panel.evaluate("window.ludone.getTrayState().then(s=>s==='recording')"));
        await delay(300);
        check("no-install-before-safe-confirmed-moment",JSON.parse(await readFile(path.join(root,"transport-audit.json"),"utf8")).updaterAudit.installs===0);
        await click('[data-testid=update-defer]');
        check("actual-update-defer",await panel.evaluate("window.ludone.getUpdateStatus().then(s=>s.installDeferred&&!s.installRequested)"));
        await navigate("home"); await click('[data-testid=recording-stop]');
        await waitFor(() => panel.evaluate("Boolean(document.querySelector('.recording-card--saved'))"), "post-restart save", 20000);
        check("new-recording-uses-stored-company-and-company-visibility", await panel.evaluate(`document.querySelector('[data-testid=recording-upload-company]')?.value===${JSON.stringify(secondCompany)}&&document.querySelector('[data-testid=recording-upload-visibility]')?.value==='company'`));
        await click('.recording-saved__skip');
        await waitFor(() => panel.evaluate("!document.querySelector('.recording-card--saved')"), "post-restart local decision");
        await navigate("updates"); await click('[data-testid=update-install]');
        await waitFor(async()=>JSON.parse(await readFile(path.join(root,"transport-audit.json"),"utf8")).updaterAudit.installs===1,"explicit inert installation through actual controller");
        check("one-inert-install-only-after-explicit-safe-confirmation",true);
      }
      scenarioCompleted = true;
    } catch (error) {
      console.error(`Scénář ${mode}: ${error.message}`);
      throw error;
    } finally {
      panel?.close(); detail?.close();
      if (child.exitCode === null) { child.kill("SIGTERM"); await Promise.race([new Promise(resolve => child.once("exit", resolve)), delay(3000)]); if (child.exitCode === null) { child.kill("SIGKILL"); await new Promise(resolve=>child.once("exit",resolve)); } }
      await writeFile(path.join(output, `${mode}-electron.log`), log);
      const audit = JSON.parse(await readFile(path.join(root, "transport-audit.json"), "utf8"));
      if (priorAudits.length) {
        check("prior-processes-one-hook-and-no-upload", priorAudits.every(a=>a.identityHookCount===1&&a.calls.every(c=>c.allowed&&c.method==="GET")));
        audit.dialogChoices = [...priorAudits.flatMap(a=>a.dialogChoices), ...audit.dialogChoices];
        audit.calls = [...priorAudits.flatMap(a=>a.calls), ...audit.calls];
        audit.processCount = priorAudits.length + 1;
        check("update-notification-once-per-version-across-restart",priorAudits.reduce((count,a)=>count+a.updaterAudit.notifications,0)+audit.updaterAudit.notifications===1);
      }
      await writeFile(path.join(output, `${mode}-transport.json`), JSON.stringify(audit, null, 2));
      check(`${mode}-one-identity-projection-hook`, audit.identityHookCount === 1);
      check(`${mode}-no-unexpected-network`, audit.calls.every(call => call.allowed));
      check(`${mode}-no-upload`, audit.calls.every(call => call.method === "GET"));
      if (mode === "complete" && scenarioCompleted) check("dirty-all-three-dialog-decisions", JSON.stringify(audit.dialogChoices) === "[2,1,0]");
    }
  }
  if (["complete", "expired", "companies-error", "rate", "offline"].every(mode => modes.includes(mode))) {
    const scenes = { ready: ["complete", "ready"], recording: ["complete", "recording"], saving: ["complete", "saving"], save: ["complete", "save"], history: ["complete", "history"], detail: ["complete", "local-detail"], sent: ["complete", "detail"], queue: ["complete", "queue"], offline: ["offline", "queue"], expired: ["expired", "queue"], unclaimed: ["complete", "unclaimed"], rate: ["rate", "detail"], missing: ["complete", "missing"], "system-lost": ["complete", "system-lost"], "microphone-only": ["complete", "microphone-only"], "companies-error": ["companies-error", "companies-error"], onboarding: ["complete", "onboarding"], settings: ["complete", "account"], "settings-audio": ["complete", "audio"], "settings-device": ["complete", "device"], "settings-storage": ["complete", "storage"], "settings-diagnostics": ["complete", "diagnostics"], updates: ["complete", "updates"], tray: ["complete", "tray"] };
    for (const [scenario, [mode, view]] of Object.entries(scenes)) {
      for (const theme of ["light", "professional", "dark"]) {
        const file = `${mode}-${theme}-${view}.png`;
        const bytes = await readFile(path.join(output, file));
        check(`matrix-${scenario}-${theme}`, bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
        matrix.push({ scenario, theme, file, actualElectron: true, syntheticIdentity: true, syntheticTransport: true });
      }
    }
    check("matrix-24-scenarios-three-themes", matrix.length === 72);
  }
  exitCode = 0;
} catch (error) { console.error(error.message); }
await writeFile(path.join(output, "results.json"), JSON.stringify({ exitCode, observations, matrix, matrixComplete: matrix.length === 72, syntheticIdentity: true, syntheticTransport: true, syntheticAuthFlow: true, syntheticPermissions: true, syntheticUpdater: true, inertInstallOnly: true, productionServerVerified: false }, null, 2));
console.log(`Důkazy: ${output}\nEXIT_CODE=${exitCode}`); process.exitCode = exitCode;
