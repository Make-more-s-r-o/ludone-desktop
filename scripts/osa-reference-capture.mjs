import http from 'node:http';
import path from 'node:path';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Referenční maketa má vlastní loopback server pouze nad verzovanou návrhovou složkou.
const projectRoot = path.resolve(process.env.LUDONE_OSA_PROJECT_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const designRoot = await realpath(path.join(projectRoot, 'docs/changes/desktop-complete-designs-2026-10-01/design'));
const outputDir = path.join(projectRoot, '.runtime/osa-reference', new Date().toISOString().replaceAll(':', '-'));
await mkdir(outputDir, { recursive: true });
const mime = { '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json', '.woff2':'font/woff2' };
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const candidate = path.resolve(designRoot, '.' + pathname);
    if (candidate !== designRoot && !candidate.startsWith(designRoot + path.sep)) { response.writeHead(403); response.end(); return; }
    const canonical = await realpath(candidate);
    if (!canonical.startsWith(designRoot + path.sep)) { response.writeHead(403); response.end(); return; }
    const contents = await readFile(canonical);
    response.writeHead(200, { 'Content-Type':mime[path.extname(canonical)] || 'application/octet-stream', 'Cache-Control':'no-store' }); response.end(contents);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0,'127.0.0.1',resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
const helperPath = path.join(outputDir, 'capture.cjs');
const screens = ['ready','recording','saving','save','history','detail','sent','queue','settings','audio','device','storage','diagnostics','updates','onboarding','tray','offline','expired','unclaimed','rate','missing','system-lost','microphone-only','companies-error'];
const helper = `const {app,BrowserWindow,session}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
const output=${JSON.stringify(outputDir)},origin=${JSON.stringify(origin)},screens=${JSON.stringify(screens)};
app.setPath('userData',path.join(output,'isolated-data'));
app.whenReady().then(async()=>{
const records=[];let win;
try{
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{callback({cancel:!details.url.startsWith(origin+'/')});});
 win=new BrowserWindow({width:1200,height:1100,useContentSize:true,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 for(const theme of ['light','professional','dark'])for(const scenario of screens){
 const tab=['audio','device','storage','diagnostics'].includes(scenario)?scenario:null;
 const url=new URL('/app.html',origin);url.searchParams.set('variant','f');url.searchParams.set('scenario',tab?'settings':scenario);url.searchParams.set('theme',theme);url.searchParams.set('revision','tray-20261005');if(tab)url.searchParams.set('tab',tab);
 await win.loadURL(url.href);
 await win.webContents.executeJavaScript('document.fonts.ready');
 await new Promise(r=>setTimeout(r,100));
 const bounds=await win.webContents.executeJavaScript(\`(()=>{const selector=document.body.dataset.page==='detail'?'.window':'.menu-popover';const el=document.querySelector(selector);const b=el?.getBoundingClientRect();if(!b||b.width<=0||b.height<=0)throw new Error('Chybí vykreslená F plocha');return {selector,x:Math.floor(b.x),y:Math.floor(b.y),width:Math.ceil(b.width),height:Math.ceil(b.height),page:document.body.dataset.page,theme:document.documentElement.dataset.theme}})()\`);
 if(bounds.x<0||bounds.y<0||bounds.x+bounds.width>1200||bounds.y+bounds.height>1100)throw new Error('Reference přesahuje viewport: '+JSON.stringify(bounds));
 const image=await win.webContents.capturePage({x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height});const file=theme+'-'+scenario+'.png';await fs.writeFile(path.join(output,file),image.toPNG());records.push({scenario,theme,file,bounds,url:url.href});console.log('PASS reference '+theme+' '+scenario);
 }
 await fs.writeFile(path.join(output,'index.json'),JSON.stringify({design:'F Osa',referenceOnly:true,records},null,2));app.exit(0);
}catch(error){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({error:error.stack,records},null,2));console.error(error);app.exit(1);}
});`;
await writeFile(helperPath,helper);
const require=createRequire(path.join(projectRoot,'package.json'));
let exitCode=1;
try {
 const child=spawn(require('electron'),[helperPath],{cwd:projectRoot,stdio:['ignore','inherit','inherit'],env:{...process.env}});
 exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));});
} finally { await new Promise(resolve=>server.close(resolve)); }
console.log(`Reference: ${outputDir}\nexit code: ${exitCode}`);
process.exitCode=exitCode;
