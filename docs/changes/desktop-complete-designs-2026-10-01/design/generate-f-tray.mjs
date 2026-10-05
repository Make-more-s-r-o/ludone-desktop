/* Reprodukovatelné exporty návrhu. Žádné produkční ikony se nepřepisují. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(here,'f-tray.js'),'utf8'),context);
const T=context.LuDoneFTray;
const out=path.join(here,'f-tray-assets');
fs.mkdirSync(out,{recursive:true});
function crc32(b){let c=0xffffffff;for(const n of b){c^=n;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const kind=Buffer.from(type);const n=Buffer.alloc(4);n.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([kind,data])));return Buffer.concat([n,kind,data,crc]);}
function inside(s,x,y){
 if(s.kind==='circle'){const d=Math.hypot(x-s.x,y-s.y);return s.width?Math.abs(d-s.r)<=s.width/2:d<=s.r;}
 if(s.kind==='line'){const dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1],t=Math.max(0,Math.min(1,((x-s.a[0])*dx+(y-s.a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-s.a[0]-t*dx,y-s.a[1]-t*dy)<=s.width/2;}
 let yes=false;for(let i=0,j=s.points.length-1;i<s.points.length;j=i++){
  const a=s.points[i],b=s.points[j];
  if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;
 }return yes;
}
function png(name,size){
 const shapes=T.shapes(name),rows=Buffer.alloc(size*(1+size*4)),samples=8,scale=size/18;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let hits=0;for(let sy=0;sy<samples;sy++)for(let sx=0;sx<samples;sx++){
   const u=(x+(sx+.5)/samples)/scale,v=(y+(sy+.5)/samples)/scale;
   if(shapes.some(s=>inside(s,u,v)))hits++;
  }
  rows[y*(1+size*4)+1+x*4+3]=Math.round(hits*255/(samples*samples));
 }
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
const files=[];
for(const name of Object.keys(T.names)){
 const svg=Buffer.from(T.svg(name));fs.writeFileSync(path.join(out,`${name}.svg`),svg);
 files.push({file:`${name}.svg`,sha256:createHash('sha256').update(svg).digest('hex')});
 for(const size of [18,36]){const filename=`${name}${size===36?'@2x':''}.png`,data=png(name,size);fs.writeFileSync(path.join(out,filename),data);files.push({file:filename,width:size,height:size,sha256:createHash('sha256').update(data).digest('hex')});}
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({description:'Návrh F: černé RGB a alfa maska pro macOS template; Retina při scaleFactor 2, bez produkční integrace.',source:'../f-tray.js',sourceSha256:createHash('sha256').update(fs.readFileSync(path.join(here,'f-tray.js'))).digest('hex'),brandSource:'../LuDone.svg',brandSha256:createHash('sha256').update(fs.readFileSync(path.join(here,'LuDone.svg'))).digest('hex'),files},null,2)+'\n');
console.log(`PASS: ${Object.keys(T.names).length} SVG a ${files.filter(f=>f.width).length} PNG (18/36 px) v adresáři návrhu.`);
