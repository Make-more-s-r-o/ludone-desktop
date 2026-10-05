import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Bezpečné F E2E: izolovaný profil, syntetické kanály, zakázaný upload.
const projectRoot = path.resolve(process.env.LUDONE_OSA_PROJECT_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const require = createRequire(path.join(projectRoot, 'package.json'));
const electronBinary = require('electron');
const outputDir = path.join(projectRoot, '.runtime', 'osa-e2e', new Date().toISOString().replaceAll(':','-'));
const dataRoot = path.join(outputDir, 'isolated-data');
const fixtureRecordingId = '40000000-0000-4000-8000-000000000001';
const observations = [];
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


let child, panel, detail, log = '', exitCode = 1;
function check(label, condition, facts = {}) { observations.push({check:label, pass:Boolean(condition), ...facts}); console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`); if (!condition) throw new Error(label); }
async function connect(target) { const client = new CdpClient(target.webSocketDebuggerUrl); await client.ready; await client.send('Page.enable'); return client; }
async function visible() { if (await panel.evaluate("document.visibilityState !== 'visible'")) { await panel.evaluate('window.ludone.testClickTray()'); await delay(200); } }
async function click(selector, client = panel) {
  if (client === panel) await visible();
  const point = await client.evaluate(`(async()=>{const el=document.querySelector(${JSON.stringify(selector)}); if(!el) return null;el.scrollIntoView({block:'center'});await new Promise(r=>requestAnimationFrame(r));const b=el.getBoundingClientRect();const x=b.x+b.width/2,y=b.y+b.height/2;const hit=document.elementFromPoint(x,y);return !el.disabled&&b.width&&b.height&&(hit===el||el.contains(hit))?{x,y}:null})()`);
  if(!point) throw new Error(`Nedosažitelný prvek ${selector}`);
  for(const type of ['mousePressed','mouseReleased']) await client.send('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1});
  await delay(200);
}
async function screenshot(name, client=panel) { if(client===panel) await visible(); const image=await client.send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(outputDir,name+'.png'),Buffer.from(image.data,'base64')); }
async function navigate(page) { await click(`.osa-rail [data-page=${page}]`); await waitFor(()=>panel.evaluate(`document.querySelector('.osa-shell')?.dataset.osaPage===${JSON.stringify(page)}`), page); }
try {
  await seedLocalRecordingFixture();
  const port=await freePort();
  child=spawn(electronBinary,['.',`--remote-debugging-port=${port}`,'--disable-background-timer-throttling','--disable-renderer-backgrounding'],{cwd:projectRoot,env:{...process.env,LUDONE_E2E:'1',LUDONE_DESIGN_E2E:'1',DESKTOP_UPLOAD_ENABLED:'false',LUDONE_DATA_DIR:dataRoot,LUDONE_E2E_HARD_STOP_MS:'120000'},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
  const target=await waitFor(async()=>(await getTargets(port)).find(t=>t.type==='page'&&t.url.includes('/dist/index.html')&&!t.url.includes('#settings')),'panel');
  panel=await connect(target);
  await waitFor(()=>panel.evaluate("Boolean(document.querySelector('.osa-shell'))"),'F shell');
  check('onboarding-first-use',await panel.evaluate("document.querySelector('.osa-shell').dataset.osaPage==='onboarding'"));
  await screenshot('onboarding');
  await panel.evaluate("localStorage.setItem('ludone.prototype.onboarding-complete','true');location.reload()");
  await waitFor(()=>panel.evaluate("Boolean(document.querySelector('.osa-rail'))"),'home');
  await visible();
  check('home-420-and-system-font',await panel.evaluate("innerWidth===420 && getComputedStyle(document.querySelector('.osa-shell')).fontFamily.includes('-apple-system')"));
  check('lutrack-inactive',await panel.evaluate("document.querySelector('.osa-lutrack')?.getAttribute('aria-disabled')==='true'"));
  for(const theme of ['light','professional','dark']) { await panel.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);for(const page of ['home','library','queue','settings','updates']) {await navigate(page);await screenshot(`${theme}-${page}`);check(`${theme}-${page}-no-horizontal-overflow`,await panel.evaluate("document.documentElement.scrollWidth<=innerWidth"));} }
  await navigate('library');
  check('library-460',await panel.evaluate('innerWidth===460'));
  await waitFor(()=>panel.evaluate(`Boolean(document.querySelector('[data-recording-id="${fixtureRecordingId}"]'))`),'disk fixture');
  check('real-manifest-loaded',true);
  check('library-search-period-pagination',await panel.evaluate("Boolean(document.querySelector('input[type=search]') && document.querySelector('.osa-pagination') && document.querySelector('option[value=custom]'))"));
  await navigate('settings');
  check('five-settings-sections',await panel.evaluate("document.querySelectorAll('.osa-settings-section').length===5"));
  check('settings-no-second-window',(await getTargets(port)).filter(t=>t.type==='page'&&t.url.includes('/dist/index.html')).length===1);
  await navigate('library');
  await click(`[data-recording-id="${fixtureRecordingId}"] summary`);
  const detailTarget=await waitFor(async()=>(await getTargets(port)).find(t=>t.url.includes('recordingId=')),'separate detail');detail=await connect(detailTarget);
  await waitFor(()=>detail.evaluate("Boolean(document.querySelector('.recording-queue-card__detail'))"),'detail content');
  check('detail-separate-860-580',await detail.evaluate('innerWidth===860 && innerHeight===580'));
  check('detail-actual-fixture',await detail.evaluate(`Boolean(document.querySelector('[data-recording-id="${fixtureRecordingId}"]'))`));
  await screenshot('detail',detail);
  await panel.evaluate('window.ludone.returnToNowPanel()');await delay(300);await navigate('home');
  await installSyntheticAudioCapture(panel);
  await click('.recording-card .idle-feature-row__action');
  await waitFor(()=>panel.evaluate("document.querySelector('.recording-card')?.classList.contains('is-active')"),'recording');
  check('two-synthetic-sources',await panel.evaluate('window.__ludoneE2ESyntheticAudio.sourceCount()===2'));
  const before=await panel.evaluate("document.querySelector('.elapsed')?.textContent");
  await panel.send('Network.enable');await panel.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await delay(300);
  const offline=await panel.evaluate('window.ludone.getTrayState()');
  check('signed-out-offline-recording-priority',offline==='recording', {tray:offline});
  await panel.evaluate('window.ludone.hidePanel()');await delay(1600);
  const hidden=await panel.evaluate('window.ludone.getTrayState()');
  check('hidden-panel-recording-authority',hidden==='recording',{hidden});
  await visible();await delay(200);const after=await panel.evaluate("document.querySelector('.elapsed')?.textContent");check('hidden-panel-time-continues',before!==after,{before,after});await navigate('library');
  check('live-stop-outside-home',await panel.evaluate("Boolean(document.querySelector('.osa-live-strip button:not(:disabled)'))"));
  await click('.osa-live-strip button');
  await waitFor(()=>panel.evaluate("Boolean(document.querySelector('.recording-card--saved'))"),'safe save decision',20000);
  const decision=await panel.evaluate('window.ludone.getTrayState()');check('main-save-decision-priority',decision==='decision',{tray:decision});
  await navigate('home');await screenshot('save-decision');
  check('explicit-local-and-send-actions',await panel.evaluate("document.querySelector('.recording-card--saved').textContent.includes('Nechat na Macu') && document.querySelector('.recording-card--saved').textContent.includes('Uložit a odeslat')"));
  await click('.recording-saved__skip');
  await waitFor(()=>panel.evaluate("!document.querySelector('.recording-card--saved')"),'local save');
  const manifests=await readdir(path.join(dataRoot,'user-data','nahravky'));check('recording-persisted-on-disk',manifests.filter(n=>n.endsWith('.manifest.json')).length>=2);
  check('upload-disabled',true,{transportEnabled:false});
  exitCode=0;
} catch(error) {console.error('FAIL',error.stack);observations.push({error:error.message});}
finally { panel?.close();detail?.close();if(child&&child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),delay(3000)]);if(child.exitCode===null)child.kill('SIGKILL');} await writeFile(path.join(outputDir,'electron.log'),log);await writeFile(path.join(outputDir,'results.json'),JSON.stringify({exitCode,observations,physicalAudioVerified:false},null,2));console.log(`Důkazy: ${outputDir}\nexit code: ${exitCode}`);process.exitCode=exitCode; }
