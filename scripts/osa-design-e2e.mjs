import { installSyntheticAudioCapture } from "./osa-synthetic-capture.mjs";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { CdpClient, freePort, waitFor, getTargets } from "./osa-cdp.mjs";
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
  await mkdir(recordingsDirectory, { recursive: true, mode: 0o700 });
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
  const baseManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  for (let index = 2; index <= 9; index++) {
    const id = '40000000-0000-4000-8000-' + String(index).padStart(12, '0');
    const name = `osa-fixture-${index}`;
    const createdAt = new Date(startedAt.getTime() - index * 60_000).toISOString();
    const manifest = { ...baseManifest, clientRecordingId: id, createdAt,
      tracks: { microphone: { ...baseManifest.tracks.microphone, fileName: name + '.webm' } } };
    await writeFile(path.join(recordingsDirectory,name+'.webm'),media,{mode:0o600});
    await writeFile(path.join(recordingsDirectory,name+'.manifest.json'),JSON.stringify(manifest),{mode:0o600});
  }
  return { audioPath, manifestPath };
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
async function screenshot(name, client=panel) {
  if(client===panel) await visible();
  const data = await client.evaluate('window.ludone.testCaptureWindow()');
  if (!data?.startsWith('data:image/png;base64,')) throw new Error('Nativní snímek okna není dostupný');
  await writeFile(path.join(outputDir,name+'.png'),Buffer.from(data.split(',')[1],'base64'));
}
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
  check('pagination-first-seven',await panel.evaluate("document.querySelectorAll('[data-recording-id]').length===7"));
  await click('[aria-label="Další stránka"]');
  check('pagination-reaches-rest',await panel.evaluate("document.querySelectorAll('[data-recording-id]').length===2"));
  await click('[aria-label="Předchozí stránka"]');
  check('library-search-period-pagination',await panel.evaluate("Boolean(document.querySelector('input[type=search]') && document.querySelector('.osa-pagination') && document.querySelector('option[value=custom]'))"));
  await panel.evaluate("(()=>{const el=document.querySelector('input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'nenalezitelná položka');el.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await waitFor(()=>panel.evaluate("document.querySelectorAll('[data-recording-id]').length===0"),'real search no results');
  check('real-search-filters-disk-recordings',true);
  await panel.evaluate("(()=>{const el=document.querySelector('input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'');el.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await waitFor(()=>panel.evaluate(`Boolean(document.querySelector('[data-recording-id="${fixtureRecordingId}"]'))`),'search restored');
  const playback = await panel.evaluate(`(async()=>{const snapshot=await window.ludone.listLocalRecordings();const item=snapshot.items.find(i=>i.id==='${fixtureRecordingId}');const media=await window.ludone.playRecording({id:item.id,queueRev:item.revision,fileRev:item.fileRevision});const audio=new Audio(media.url);window.__osaTestAudio=audio;await new Promise((resolve,reject)=>{audio.onloadedmetadata=resolve;audio.onerror=()=>reject(new Error('Audio decoder: '+audio.error?.code));setTimeout(()=>reject(new Error('Audio metadata timeout')),6000);audio.load();});const facts={duration:audio.duration,readyState:audio.readyState,url:media.url};audio.pause();audio.removeAttribute('src');audio.load();return facts;})()`);
  check('actual-protected-audio-decoder',playback.readyState>=1&&playback.url.startsWith('ludone://app/media/'),{readyState:playback.readyState});

  await navigate('settings');
  check('five-settings-sections',await panel.evaluate("document.querySelectorAll('.osa-settings-section').length===5"));
  check('settings-no-second-window',(await getTargets(port)).filter(t=>t.type==='page'&&t.url.includes('/dist/index.html')).length===1);
  await navigate('library');
  await click(`[data-recording-id="${fixtureRecordingId}"] summary`);
  const detailTarget=await waitFor(async()=>(await getTargets(port)).find(t=>t.url.includes('recordingId=')),'separate detail');detail=await connect(detailTarget);
  await waitFor(()=>detail.evaluate("Boolean(document.querySelector('.recording-queue-card__detail'))"),'detail content');
  check('detail-separate-860-580',await detail.evaluate('innerWidth===860 && innerHeight===580'));
  check('detail-actual-fixture',await detail.evaluate(`Boolean(document.querySelector('[data-recording-id="${fixtureRecordingId}"]'))`));
  await detail.evaluate("document.querySelector('.osa-station button')?.click()");
  await waitFor(()=>detail.evaluate("Boolean(document.querySelector('audio'))"),'React playback element');
  await detail.evaluate("document.querySelector('audio').muted=true");
  await waitFor(()=>detail.evaluate("document.querySelector('audio')?.currentTime>0.1"),'React playback advances');
  check('detail-react-playback-advances',await detail.evaluate("document.querySelector('audio').readyState>=2 && !document.querySelector('audio').error"));
  await detail.evaluate("document.querySelector('audio').pause()");
  await screenshot('detail',detail);
  await panel.evaluate('window.ludone.returnToNowPanel()');await delay(300);await navigate('home');
  await installSyntheticAudioCapture(panel);
  await click('.recording-card .idle-feature-row__action');
  await waitFor(()=>panel.evaluate("document.querySelector('.recording-card')?.classList.contains('is-active')"),'recording');
  check('two-synthetic-sources',await panel.evaluate('window.__ludoneE2ESyntheticAudio.sourceCount()===2'));
  const mainBefore=await panel.evaluate('window.ludone.getRecordingActivity()');
  const before=await panel.evaluate("document.querySelector('.elapsed')?.textContent");
  await panel.send('Network.enable');await panel.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await delay(300);
  const offline=await panel.evaluate('window.ludone.getTrayState()');
  check('signed-out-offline-recording-priority',offline==='recording', {tray:offline});
  await panel.evaluate('window.ludone.hidePanel()');await delay(1600);
  const hidden=await panel.evaluate('window.ludone.getTrayState()');
  check('hidden-panel-recording-authority',hidden==='recording',{hidden});
  const mainAfter=await panel.evaluate('window.ludone.getRecordingActivity()');
  check('main-clock-advances-while-hidden',mainAfter.active&&mainAfter.startedAt===mainBefore.startedAt&&mainAfter.title!==mainBefore.title);
  await visible();await delay(200);const after=await panel.evaluate("document.querySelector('.elapsed')?.textContent");check('hidden-panel-time-continues',before!==after,{before,after});await navigate('library');
  await panel.evaluate('window.__ludoneE2ESyntheticAudio.loseSystemTrack()');
  await waitFor(()=>panel.evaluate("window.ludone.getTrayState().then(s=>s==='recording-audio-lost')"),'main system audio loss');
  check('system-audio-loss-main-priority',true);await screenshot('recording-system-lost');
  check('live-stop-outside-home',await panel.evaluate("Boolean(document.querySelector('.osa-live-strip button:not(:disabled)'))"));
  await click('.osa-live-strip button');
  await waitFor(()=>panel.evaluate("Boolean(document.querySelector('.recording-card--saved'))"),'safe save decision',20000);
  const decision=await panel.evaluate('window.ludone.getTrayState()');check('main-save-decision-priority',decision==='decision',{tray:decision});
  await navigate('home');await panel.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await screenshot('save-decision');
  check('explicit-local-and-send-actions',await panel.evaluate("document.querySelector('.recording-card--saved').textContent.includes('Nechat na Macu') && document.querySelector('.recording-card--saved').textContent.includes('Uložit a odeslat')"));
  await click('.recording-saved__skip');
  await waitFor(()=>panel.evaluate("!document.querySelector('.recording-card--saved')"),'local save');
  const manifests=await readdir(path.join(dataRoot,'user-data','nahravky'));check('recording-persisted-on-disk',manifests.filter(n=>n.endsWith('.manifest.json')).length>=10);
  check('one-stereo-delivery-file',manifests.filter(n=>n.endsWith('-stereo.webm')).length===1);
  check('new-recording-playback-selects-stereo',await panel.evaluate("(async()=>{const s=await window.ludone.listLocalRecordings();const i=s.items.find(i=>!i.id.startsWith('40000000')&&i.localState==='complete-audio');const r=await window.ludone.playRecording({id:i.id,queueRev:i.revision,fileRev:i.fileRevision});return r.label==='Stereo nahrávka';})()"));
  check('upload-held-without-network',await panel.evaluate("window.ludone.listLocalRecordings().then(s=>s.items.filter(i=>i.state!=='odeslano').every(i=>i.uploadIntent!=='approved'))"),{transportEnabled:false});
  await navigate('home');await installSyntheticAudioCapture(panel);await click('.recording-card .idle-feature-row__action');
  await waitFor(()=>panel.evaluate("document.querySelector('.recording-card')?.classList.contains('is-active')"),'second recording');
  await panel.send('Page.crash').catch(()=>{});panel.close();
  const recoveredTarget=await waitFor(async()=>(await getTargets(port)).find(t=>t.type==='page'&&t.url.includes('/dist/index.html')&&!t.url.includes('#settings')),'recovered target');
  panel=await connect(recoveredTarget);
  await waitFor(()=>panel.evaluate("Boolean(document.querySelector('.osa-shell'))"),'renderer recovery',20000);
  await waitFor(()=>panel.evaluate("window.ludone.getRecordingActivity().then(a=>!a.active)"),'crash finalization',20000);
  check('renderer-crash-main-finalizes-and-recovers',true);
  await navigate('library');await screenshot('crash-recovered');
  const recoveredManifests=await readdir(path.join(dataRoot,'user-data','nahravky'));
  check('crashed-recording-preserved',recoveredManifests.filter(n=>n.endsWith('.manifest.json')).length>=11);
  await waitFor(()=>panel.evaluate("window.ludone.getRecordingActivity().then(a=>!a.active&&!a.saving)"),'crash disk flush');
  panel.close();child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),delay(3000)]);if(child.exitCode===null)child.kill('SIGKILL');
  child=spawn(electronBinary,['.',`--remote-debugging-port=${port}`,'--disable-background-timer-throttling','--disable-renderer-backgrounding'],{cwd:projectRoot,env:{...process.env,LUDONE_E2E:'1',LUDONE_DESIGN_E2E:'1',DESKTOP_UPLOAD_ENABLED:'false',LUDONE_DATA_DIR:dataRoot,LUDONE_E2E_HARD_STOP_MS:'120000'},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
  const restartedTarget=await waitFor(async()=>(await getTargets(port)).find(t=>t.type==='page'&&t.url.includes('/dist/index.html')&&!t.url.includes('#settings')),'restarted panel');
  panel=await connect(restartedTarget);await waitFor(()=>panel.evaluate("Boolean(document.querySelector('.osa-rail'))"),'persisted onboarding');
  await navigate('library');
  await waitFor(()=>panel.evaluate("window.ludone.listLocalRecordings().then(s=>s.items.length>=11)"),'restart recovery');
  check('restart-preserves-recordings-and-held-intent',await panel.evaluate("window.ludone.listLocalRecordings().then(s=>s.items.length>=11&&s.items.every(i=>i.uploadIntent!=='approved'))"));
  await screenshot('restarted-library');
  exitCode=0;
} catch(error) {console.error('FAIL',error.stack);observations.push({error:error.message});}
finally { panel?.close();detail?.close();if(child&&child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),delay(3000)]);if(child.exitCode===null)child.kill('SIGKILL');} await writeFile(path.join(outputDir,'electron.log'),log);await writeFile(path.join(outputDir,'results.json'),JSON.stringify({exitCode,observations,physicalAudioVerified:false},null,2));console.log(`Důkazy: ${outputDir}\nexit code: ${exitCode}`);process.exitCode=exitCode; }
