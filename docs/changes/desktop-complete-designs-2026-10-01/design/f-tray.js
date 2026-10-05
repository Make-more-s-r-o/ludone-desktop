/* Návrh systémové lišty F. Čistá prezentace a návrhový kontrakt, nikoli Electron stav. */
(function (root) {
 const rects = [
  [363.43,479.05,615.7,103.05,-143.27,792.56,-56.15],
  [352.1,457.81,103.05,403.78,-369.09,627.47,-56.15],
  [618.07,771.07,403.78,103.05,-329.27,654.46,-36.77]
 ];
 // Doslovné obdélníky originální značky: jen jednotné měřítko a posun.
 const raw = rects.map(([x,y,w,h,tx,ty,deg]) => {
  const a=deg*Math.PI/180;
  return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([u,v])=>[tx+u*Math.cos(a)-v*Math.sin(a),ty+u*Math.sin(a)+v*Math.cos(a)]);
 });
 const minX=Math.min(...raw.flat().map(p=>p[0])), minY=Math.min(...raw.flat().map(p=>p[1]));
 const scale=13.3/(Math.max(...raw.flat().map(p=>p[0]))-minX);
 const brand=raw.map(points=>({kind:'polygon',points:points.map(([x,y])=>[1+(x-minX)*scale,4.5+(y-minY)*scale])}));
 const line=(a,b,width=1.1)=>({kind:'line',a,b,width});
 const circle=(x,y,r,width=0)=>({kind:'circle',x,y,r,width});
 const polygon=points=>({kind:'polygon',points});
 const half=Array.from({length:17},(_,i)=>{const a=-Math.PI/2+i*Math.PI/16;return [15.1+1.65*Math.cos(a),2.75+1.65*Math.sin(a)];});
 const badges={
  idle:[], recording:[circle(15.1,2.75,1.85)],
  saving:[line([15.1,.8],[15.1,5.6]),line([12.9,3.6],[15.1,5.8]),line([15.1,5.8],[17.3,3.6])],
  decision:[line([13.2,.7],[16.9,.7]),line([16.9,.7],[16.9,6]),line([16.9,6],[13.2,6]),line([13.2,6],[13.2,.7]),line([14.4,3],[15.7,3],.85)],
  'queue-waiting':[circle(13.7,2.8,1),circle(16.6,2.8,1)],
  'signed-out':[circle(15.1,1.9,1.2),line([12.8,5.7],[13.5,4.3]),line([13.5,4.3],[16.7,4.3]),line([16.7,4.3],[17.4,5.7])],
  offline:[circle(15.1,2.9,2.1,1),line([13.7,4.3],[16.5,1.5],1)],
  'recording-audio-lost':[line([15.1,.8],[17.25,5.7]),line([17.25,5.7],[12.75,5.7]),line([12.75,5.7],[15.1,.8]),line([15.1,2.6],[15.1,3.7],.85),circle(15.1,4.65,.42)],
  'recording-microphone-only':[circle(15.1,2.75,2,.9),polygon(half)],
  attention:[line([15.1,.6],[15.1,3.8],1.5),circle(15.1,5.5,.8)]
 };
 const names={idle:'Připraveno',recording:'Nahrává se',saving:'Ukládá se',decision:'Čeká na uložení','queue-waiting':'Čeká na odeslání','signed-out':'Přihlásit se',offline:'Odesílání čeká na připojení','recording-audio-lost':'Nahrává se · výpadek systémového zvuku','recording-microphone-only':'Nahrává se · jen mikrofon',attention:'Odesílání vyžaduje pozornost'};
 function shapes(name){return brand.concat(badges[name]||badges.idle);}
 function content(name){return shapes(name).map(s=>{
  if(s.kind==='polygon')return `<polygon points="${s.points.map(p=>p.map(n=>n.toFixed(4)).join(',')).join(' ')}"/>`;
  if(s.kind==='line')return `<line x1="${s.a[0]}" y1="${s.a[1]}" x2="${s.b[0]}" y2="${s.b[1]}" stroke="currentColor" stroke-width="${s.width}" stroke-linecap="round"/>`;
  return `<circle cx="${s.x}" cy="${s.y}" r="${s.r}"${s.width?` fill="none" stroke="currentColor" stroke-width="${s.width}"`:''}/>`;
 }).join('');}
 function svg(name){return `<svg xmlns="http://www.w3.org/2000/svg" class="f-tray-icon" data-tray-icon="${name}" viewBox="0 0 18 18" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">${content(name)}</svg>`;}
 function describe(f){
  let name='idle',text='';
  if(f.phase==='recording')name=f.systemLost?'recording-audio-lost':f.microphoneOnly?'recording-microphone-only':'recording';
  else if(f.phase==='finalizing')name='saving';
  else if(f.phase==='draft')name='decision';
  else if(f.signed===false)name='signed-out';
  else if(f.pendingCount>0&&f.network===false)name='offline';
  else if(f.attentionCount>0)name='attention';
  else if(f.pendingCount>0)name='queue-waiting';
  if(f.phase==='recording')text=f.time||'00:00';
  else if(name==='saving')text='Ukládá se';
  else if(name==='decision')text='Uložit';
  const notes=[];
  if(f.signed===false&&name!=='signed-out')notes.push('odesílání čeká na přihlášení');
  if(f.network===false&&name!=='offline')notes.push('bez připojení');
  if(f.attentionCount>0&&name!=='attention')notes.push(`${f.attentionCount} položek vyžaduje pozornost`);
  if(f.pendingCount>0)notes.push(`${f.pendingCount} čeká na odeslání`);
  return {name,text,label:`LuDone · ${names[name]}${notes.length?' · '+notes.join(' · '):''}`};
 }
 root.LuDoneFTray={names,shapes,svg,describe};
})(globalThis);
