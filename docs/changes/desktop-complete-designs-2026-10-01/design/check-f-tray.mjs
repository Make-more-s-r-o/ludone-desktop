/* Akceptace přípravy, nikoli náhrada produkčních testů nebo Mac přejímky. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(here,'f-tray.js'),'utf8'),context);
const T=context.LuDoneFTray;
let failures=0;
function check(label,ok){console.log(`${ok?'PASS':'FAIL'}: ${label}`);if(!ok)failures++;}
const contracts=[
 [{phase:'idle',signed:true},'idle',''],
 [{phase:'recording',signed:false,network:false,pendingCount:8,attentionCount:2,time:'12:34'},'recording','12:34'],
 [{phase:'recording',systemLost:true,microphoneOnly:true,signed:false,time:'12:34'},'recording-audio-lost','12:34'],
 [{phase:'recording',microphoneOnly:true,network:false,time:'12:34'},'recording-microphone-only','12:34'],
 [{phase:'finalizing',signed:false,attentionCount:5},'saving','Ukládá se'],
 [{phase:'draft',signed:false,network:false},'decision','Uložit'],
 [{phase:'idle',signed:false,pendingCount:4,attentionCount:2},'signed-out',''],
 [{phase:'idle',signed:true,pendingCount:4,network:false,attentionCount:2},'offline',''],
 [{phase:'idle',signed:true,attentionCount:2,pendingCount:4},'attention',''],
 [{phase:'idle',signed:true,pendingCount:4},'queue-waiting',''],
 [{phase:'idle',signed:true,systemLost:true,microphoneOnly:true},'idle',''],
 [{phase:'idle',signed:true,network:false,pendingCount:0},'idle','']
];
for(const [facts,name,text] of contracts){const d=T.describe(facts);check(`priorita ${JSON.stringify(facts)} → ${name}`,d.name===name&&d.text===text);}
const active=T.describe({phase:'recording',signed:false,network:false,pendingCount:3,time:'00:45'});
check('odhlášení a offline jsou ve vysvětlení, nepřebijí nahrávání',active.label.includes('přihlášení')&&active.label.includes('bez připojení')&&active.label.includes('3 čeká'));
const assets=path.join(here,'f-tray-assets'),manifest=JSON.parse(fs.readFileSync(path.join(assets,'manifest.json'),'utf8'));
check('původní značka shodná s archivem Opus',manifest.brandSha256==='dd15c49cb35f53b3d08e9a0b72ccb9378630df44493022557d82ac8a60d9f06a');
check('manifest odpovídá aktuálnímu originálu značky',manifest.brandSha256===createHash('sha256').update(fs.readFileSync(path.join(here,'LuDone.svg'))).digest('hex'));
check('manifest odpovídá aktuálnímu zdroji kresby',manifest.sourceSha256===createHash('sha256').update(fs.readFileSync(path.join(here,'f-tray.js'))).digest('hex'));
check('úplný manifest 10 SVG + 20 PNG',manifest.files.length===30);
const alphaHashes={18:new Set(),36:new Set()};
for(const entry of manifest.files){
 const data=fs.readFileSync(path.join(assets,entry.file));
 check(`SHA-256 ${entry.file}`,createHash('sha256').update(data).digest('hex')===entry.sha256);
 if(!entry.width){check(`SVG odpovídá aktuální definici ${entry.file}`,data.toString()===T.svg(entry.file.replace('.svg','')));continue;}
 const size=entry.width;
 check(`rozměry ${entry.file}`,data.readUInt32BE(16)===size&&data.readUInt32BE(20)===size&&data[24]===8&&data[25]===6);
 const idats=[];for(let i=8;i<data.length;){const len=data.readUInt32BE(i);if(data.toString('ascii',i+4,i+8)==='IDAT')idats.push(data.subarray(i+8,i+8+len));i+=12+len;}
 const rows=inflateSync(Buffer.concat(idats)),alpha=[];let black=true,filters=true;
 for(let y=0;y<size;y++){filters&&=rows[y*(1+size*4)]===0;for(let x=0;x<size;x++){const i=y*(1+size*4)+1+x*4;black&&=rows[i]===0&&rows[i+1]===0&&rows[i+2]===0;alpha.push(rows[i+3]);}}
 check(`template alfa, bez barev a dlaždice ${entry.file}`,filters&&black&&alpha.some(n=>n>0)&&alpha.some(n=>n===0));
 alphaHashes[size].add(createHash('sha256').update(Buffer.from(alpha)).digest('hex'));
}
for(const size of [18,36])check(`všech deset stavů má odlišnou alfa masku v ${size} px`,alphaHashes[size].size===10);
console.log('⛔ Toto není důkaz čitelnosti skutečné systémové lišty, zvuku, IPC ani uploadu.');
process.exitCode=failures?1:0;
