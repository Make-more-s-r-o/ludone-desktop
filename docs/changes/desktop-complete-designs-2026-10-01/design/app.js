/* Samostatná maketa: pouze fiktivní data v paměti, žádné Electron API nebo HTTP. */
const $ = (s) => globalThis.document.querySelector(s);
const query = new globalThis.URLSearchParams(globalThis.location.search);
const concepts = { a: ['Mac','mac.css'], b: ['Studio','studio.css'], c: ['Deník','journal.css'], d: ['Sloupec · Sonnet 5.5','sonnet-d.css'], e: ['Kapsle · Sonnet 5.5','sonnet-e.css'], f: ['Osa · Sonnet 5.5','sonnet-f.css'], g: ['Příkaz · Sonnet 5.5','sonnet-g.css'] };
const concept = concepts[query.get('variant')] ? query.get('variant') : 'a';
const refinedFIcons = concept==='f' && query.get('icons')!=='original';
globalThis.document.body.dataset.concept = concept;
if(query.get('embedded')==='1')globalThis.document.body.classList.add('embedded');
globalThis.document.documentElement.dataset.theme = ['light','dark','professional'].includes(query.get('theme')) ? query.get('theme') : 'light';
const style = globalThis.document.createElement('link'); style.rel='stylesheet'; style.href=concepts[concept][1]+'?v=16'; globalThis.document.head.append(style);
const menuStyle=globalThis.document.createElement('link');menuStyle.rel='stylesheet';menuStyle.href='menu.css?v=1';globalThis.document.head.append(menuStyle);
if(['d','e'].includes(concept))globalThis.document.head.append(style);
const integrationStyle=globalThis.document.createElement('link');integrationStyle.rel='stylesheet';integrationStyle.href='menu-integration.css?v=1';globalThis.document.head.append(integrationStyle);
/* Nové směry mohou přestavět prezentaci; funkční stav a akce zůstávají společné. */
if(['f','g'].includes(concept)){
 globalThis.document.head.append(style);
 const creativeIntegration=globalThis.document.createElement('link');creativeIntegration.rel='stylesheet';creativeIntegration.href='creative-integration.css?v=1';globalThis.document.head.append(creativeIntegration);
 if(refinedFIcons){const iconsStyle=globalThis.document.createElement('link');iconsStyle.rel='stylesheet';iconsStyle.href='f-icons.css?v=2';globalThis.document.head.append(iconsStyle);}
}
const paths = {
 record:'<rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8"/>',
 library:'<path d="M4 5h16v15H4zM2 2h20v4H2zM9 11h6"/>',
 cloud:'<path d="M6 18a5 5 0 0 1 0-10 6 6 0 0 1 11-2 5 5 0 0 1 1 12M12 9v11M8 13l4-4 4 4"/>',
 settings:'<path d="M3 6h5M14 6h7M3 12h11M20 12h1M3 18h2M11 18h10"/><circle cx="11" cy="6" r="3"/><circle cx="17" cy="12" r="3"/><circle cx="8" cy="18" r="3"/>',
 update:'<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5M12 8v5l3 2"/>',
 chevron:'<path d="m9 5 7 7-7 7"/>', search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
 back:'<path d="m14 5-7 7 7 7"/>', check:'<path d="m4 12 5 5L20 6"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>',
 stop:'<rect x="5" y="5" width="14" height="14" rx="2"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 sound:'<path d="m3 9 4 0 5-5v16l-5-5H3zM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/>',
 folder:'<path d="M3 5h6l2 3h10v12H3z"/>', trash:'<path d="M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
 web:'<path d="M14 3h7v7M21 3l-10 10M10 3H3v18h18v-7"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.01"/>',
 keyboard:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M7 16h10"/>',
 tray:'<path d="M4 4h16v16H4zM7 9l4 4 6-6"/>', alert:'<path d="m12 3 10 18H2zM12 9v5M12 17v.01"/>', user:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
 waveform:'<path d="M3 10v4M7 6v12M11 3v18M15 7v10M19 5v14M23 10v4"/>', play:'<path d="m7 4 14 8-14 8z"/>'
};
const icon = (name) => refinedFIcons ? globalThis.LuDoneFIcons.icon(name) : `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.info}</svg>`;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn = (text, action, cls='', glyph='', extra='') => `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${glyph?icon(glyph):''}${text}</button>`;
const companies = ['Ateliér Sever s.r.o.','Studio Forma','LuDone Demo'];
const scenarios = [ ['ready','Připraveno'],['recording','Nahrávání'],['saving','Ukládání'],['save','Po schůzce'],['history','Historie'],['detail','Detail na Macu'],['sent','Detail na webu'],['queue','Fronta a chyby'],['offline','Bez sítě'],['expired','Vypršelé přihlášení'],['unclaimed','Převzetí vlastnictví'],['rate','Limit serveru'],['missing','Chybějící zvuk'],['system-lost','Výpadek kanálu'],['microphone-only','Jen mikrofon'],['companies-error','Chyba výběru firmy'],['onboarding','První použití'],['settings','Nastavení'],['updates','Aktualizace'],['tray','Panel v liště'] ];
let state;
function seed() {
 const titles=['Týdenní domluva','Návrh nové spolupráce','Produktová konzultace','Plán na další týden','Schůzka s týmem','Poznámky k projektu'];
 const kinds=['local','sent','queued','failed','sent','unclaimed','local','rate','missing','partial','sent','unknown'];
 const recordings=Array.from({length:46},(_,i)=>({id:'demo-'+i,title:titles[i%6]+(i>5?' · '+(Math.floor(i/6)+1):''),date:new Date(Date.UTC(2026,9,1-i*4,9+i%7,15)).toISOString(),duration:i===0?'24:18':`${14+i%39}:${String(i*7%60).padStart(2,'0')}`,size:(4.1+i*.37).toFixed(1).replace('.',',')+' MB',status:kinds[i%12],company:companies[i%3],visibility:i%5===0?'private':'company',verified:i%12===1?false:null,claimed:i%12!==5,localPresent:!['missing'].includes(kinds[i%12]),locked:['sent','queued','unknown','rate','failed'].includes(kinds[i%12]),progress:i%12===2?42:0}));
 return {page:'home',tab:'account',filter:'all',period:'30',search:'',pageIndex:0,selected:'demo-0',recordings,phase:'idle',seconds:0,defaultCompany:companies[0],companyChoice:companies[0],companyDirty:false,auto:false,dock:true,launch:false,retention:'7',environment:'prod',signed:true,scope:true,network:true,mic:true,system:true,systemLost:false,microphoneOnly:false,companyError:false,draft:{title:'Týdenní domluva',company:companies[0],visibility:'company'},draftDirty:false,test:'idle',heardMic:false,heardSystem:false,onboarding:0,update:'current',deferred:false,installRequested:false,rangeStart:'2026-04-01',rangeEnd:'2026-10-01'};
}
const current = () => state.recordings.find(r=>r.id===state.selected);
const companyOptions=(value)=>(value?'':'<option value="" selected>Vyberte firmu</option>')+companies.map(c=>`<option ${c===value?'selected':''}>${esc(c)}</option>`).join('');
const dateLabel=(iso)=>new Date(iso).toLocaleDateString('cs-CZ',{day:'numeric',month:'long',year:'numeric'});
const timeLabel=(iso)=>new Date(iso).toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'});
const statusText={local:'Na Macu',sent:'Odesláno · neověřeno',queued:'Odesílá se',failed:'Zkusit znovu',unclaimed:'Potvrdit vlastníka',rate:'Čeká na limit',missing:'Soubor chybí',partial:'Neúplný zvuk',unknown:'Ověřit v LuDone'};
const badge=(r)=>`<span class="badge ${r.status==='sent'?'sent':['failed','missing','partial','unclaimed'].includes(r.status)?'error':r.status==='local'?'local':'waiting'}">${r.verified===true?'V LuDone · ověřeno':statusText[r.status]}</span>`;
function waveform(live=false) {return `<div class="waveform ${live?'is-live':''}" aria-label="${live?'Ukázka zvukových úrovní':'Ukázka zvukové stopy'}">${Array.from({length:44},(_,i)=>`<i style="height:${live?8+(i*17)%40:3+(i*13)%20}px"></i>`).join('')}</div>`;}
function row(r) {return `<button class="record-row" data-action="detail" data-id="${r.id}"><span class="row-icon">${icon('waveform')}</span><span class="row-main"><strong>${esc(r.title)}</strong><small>${timeLabel(r.date)} · ${r.duration} · ${esc(r.company)}</small></span><span class="row-tail">${badge(r)}${icon('chevron')}</span></button>`;}
function notice(title,text,action='',label='',tone='warning'){return `<div class="notice ${tone}" role="status">${icon(tone==='error'?'alert':'info')}<div><strong>${title}</strong>${text?`<p>${text}</p>`:''}</div>${action?btn(label,action,'subtle'):''}</div>`;}
function nav() {
 const items=[['home','record','Nahrávat'],['library','library','Nahrávky'],['queue','cloud','Odesílání']];
 const active=state.page==='detail'?'library':state.page;
 const item=(id,glyph,label)=>`<button class="nav-item ${active===id?'active':''}" data-action="nav" data-page="${id}" aria-label="${label}" ${active===id?'aria-current="page"':''}><span class="nav-icon">${icon(glyph)}</span><span class="nav-label">${label}</span>${id==='queue'?'<span class="count">'+state.recordings.filter(r=>['queued','failed','unclaimed','rate','unknown','missing','partial'].includes(r.status)).length+'</span>':''}</button>`;
 return `<div class="brand"><img src="LuDone.svg" alt=""><span>LuDone</span></div><div class="nav-primary">${items.map(x=>item(...x)).join('')}</div><div class="nav-bottom">${item('settings','settings','Nastavení')}${item('updates','update','Aktualizace')}</div><div class="nav-user"><span class="avatar">${state.signed?'AK':'—'}</span><span>${state.signed?'Alex Král':'Odhlášeno'}</span></div>`;
}
function pageHead(){
 const map={home:['Nahrávání','Vše ze schůzky. V jednom záznamu.'],library:['Nahrávky','Vaše schůzky na Macu i v LuDone.'],queue:['Odesílání','Přehled čekajících nahrávek.'],detail:['Nahrávka',''],settings:['Nastavení',''],updates:['Aktualizace',''],onboarding:['Vítejte v LuDone','']};
 const [title,subtitle]=map[state.page]||map.home;
 const actions=state.page==='detail'?btn('Zpět','nav','subtle','back','data-page="library"'):['library','queue'].includes(state.page)?btn('<span>Obnovit</span>','refresh','','update'):state.page==='home'?btn('Zdroje','sources','subtle','settings'):'';
 return `<div><h1>${title}</h1>${subtitle?`<p class="subtitle">${subtitle}</p>`:''}</div><div class="head-actions">${actions}</div>`;
}
function globalNotice(){
 if(state.page==='onboarding')return '';
 if(!state.network)return notice('Jste offline','Nahrávky zůstávají na Macu. Odesílání počká.','reconnect','Zkusit připojení');
 if(!state.signed)return notice('Přihlaste se pro odesílání','Lokální nahrávky zůstávají uložené.','login','Přihlásit se');
 if(!state.scope)return notice('Chybí oprávnění k odesílání','Potvrďte přístup v prohlížeči.','login','Povolit odesílání');
 if(state.update==='ready'&&!state.deferred&&state.page!=='updates'&&state.page!=='onboarding')return notice('Nová verze je připravená','','nav','Zobrazit','success').replace('data-action="nav"','data-action="nav" data-page="updates"');
 return '';
}
let menuOpen=true;
function render(){
 const windowView=state.page==='detail';
 globalThis.document.body.dataset.surface=windowView?'window':'tray';
 globalThis.document.body.dataset.page=state.page;
 globalThis.document.body.dataset.phase=state.phase;
 const workspace=$('.workspace');
 (windowView?$('.app-layout'):$('.menu-popover-body')).append(workspace);
 $('.window').hidden=!windowView;
 $('.desktop-stage').hidden=!windowView;
 $('.menu-popover').hidden=windowView||!menuOpen;
 $('.menubar-trigger').classList.toggle('is-recording',state.phase==='recording');
 $('.menubar-trigger').setAttribute('aria-expanded',String(!windowView&&menuOpen));
 $('.menubar-trigger .menu-live-status').innerHTML=state.phase==='recording'?`<i class="dot red"></i><span data-live-time>${clock()}</span>`:'';
 $('.app-nav').innerHTML=nav(); $('.workspace-head').innerHTML=pageHead(); $('.global-notice').innerHTML=globalNotice(); $('.global-notice').hidden=!$('.global-notice').innerHTML;
 const renderers={home:home,library:history,queue:queuePage,detail:detail,settings:settings,updates:updates,onboarding:onboarding};
 $('.content').innerHTML=(state.phase==='recording'&&state.page!=='home'?`<div class="live-strip"><span><i class="dot red"></i>Nahrává se <b data-live-time>${clock()}</b></span>${btn('Zastavit','stop','stop-button','stop')}</div>`:'')+(renderers[state.page]||home)();
 $('.app-title span').textContent=state.phase==='recording'?'LuDone · nahrává se':'LuDone Desktop';
 globalThis.document.querySelectorAll('.menu-tab').forEach(button=>button.classList.toggle('active',button.dataset.page===state.page));
 globalThis.applyLuDoneLayout?.();
 if(refinedFIcons)globalThis.LuDoneFIcons.apply(state);
}
function clock(){return Math.floor(state.seconds/60).toString().padStart(2,'0')+':'+(state.seconds%60).toString().padStart(2,'0');}
function home(){
 if(state.phase==='draft')return draftPage();
 if(state.phase==='finalizing')return `<div class="empty">${icon('cloud')}<h2>Ukládám schůzku</h2><p>Než zavřete aplikaci, počkejte na dokončení.</p></div>`;
 const live=state.phase==='recording';
 return `<div class="home-grid"><section class="recorder"><div class="record-head"><span class="eyebrow">${live?'<i class="dot red"></i> Nahrává se':'Připraveno k nahrávání'}</span>${live?'<span class="badge local">Na tomto Macu</span>':icon('record')}</div><div class="record-time" data-live-time>${live?clock():'00:00'}</div>${waveform(live)}<div class="source-summary"><span>${icon('record')}Mikrofon <i class="dot"></i></span><span>${icon('sound')}${state.microphoneOnly?'Systém nedostupný':'Zvuk schůzky'} <i class="dot ${state.systemLost||state.microphoneOnly?'red':''}"></i></span></div>${state.microphoneOnly?notice('Nahrává se jen mikrofon','Druhá strana schůzky se nezachytává.','sources','Zvuk a oprávnění'):''}${state.systemLost?notice('Zvuk schůzky vypadl','Mikrofon pokračuje. Chybějící část se nedoplní.','recover-sound','Obnovit kanál','error'):''}<div class="record-actions">${live?btn('Zastavit nahrávání','stop','stop-button','stop'):btn('Nahrávat schůzku','start','record-button','record')}${btn('Zkouška zvuku','sources','subtle','sound')}</div><div class="context-summary">${icon('cloud')}<span>${esc(state.defaultCompany)} · ${state.auto?'Automatické odesílání':'Rozhodnete po schůzce'}</span></div></section><section class="recent-section"><div class="section-head"><h2>Poslední schůzky</h2>${btn('Všechny','nav','subtle','','data-page="library"')}</div>${state.recordings.slice(0,3).map(row).join('')}<div class="quiet-row"><span>${icon('clock')}LuTrack</span><span>Připravujeme</span></div></section></div>`;
}
function preferences(value,dirty=false){return `<div class="form-grid"><div class="field"><label for="target-company">Firma</label><select id="target-company" data-field="${state.phase==='draft'&&state.page==='home'?'draft-company':'record-company'}" ${state.companyError?'disabled':''}>${companyOptions(value.company)}</select></div><div class="field"><label for="visibility">Přístup</label><select id="visibility" data-field="${state.phase==='draft'&&state.page==='home'?'draft-visibility':'record-visibility'}"><option value="company" ${value.visibility==='company'?'selected':''}>Sdílená ve firmě</option><option value="private" ${value.visibility==='private'?'selected':''}>Soukromá · jen pro vás</option></select><small>${value.visibility==='private'?'V LuDone ji uvidíte pouze vy.':'Přístup mají lidé s oprávněním ve vybrané firmě.'}</small></div></div>${state.companyError?notice('Firmy nelze načíst','Uložená volba zůstává zachovaná.','load-companies','Načíst znovu','error'):''}${dirty?'<p class="small-note">Změny čekají na uložení.</p>':''}`;}
function draftPage(){return `<div class="detail-layout"><section class="detail-main"><div class="detail-hero"><span class="badge local">Uloženo na Macu</span><h2 style="margin-top:18px">Schůzka je nahraná</h2><div class="facts"><span>${clock()}</span><span>${state.microphoneOnly?'Jen mikrofon':'Jeden stereo soubor'}</span><span>WebM · Opus</span></div></div><div class="form-grid"><div class="field"><label for="draft-title">Název</label><input id="draft-title" data-field="draft-title" value="${esc(state.draft.title)}"></div>${preferences(state.draft)}</div></section><aside class="detail-aside"><h3>Co dál?</h3><div class="detail-actions">${btn('Uložit a odeslat','save-send','primary','cloud',!state.signed||!state.scope||!state.network||state.companyError||!state.draft.company?'disabled':'')}${btn('Nechat na Macu','save-local','','folder')}</div><p class="small-note">Odesláním zpřístupníte nahrávku podle zvolené firmy a přístupu. Přepis otevřete na webu.</p></aside></div>`;}
function filtered(){
 const end=new Date('2026-10-02T00:00:00Z').getTime();
 return state.recordings.filter(r=>{
  const text=(r.title+' '+r.company).toLocaleLowerCase('cs');
  if(!text.includes(state.search.toLocaleLowerCase('cs')))return false;
  if(state.filter==='local'&&!['local','unclaimed','missing','partial'].includes(r.status))return false;
  if(state.filter==='delivery'&&!['queued','failed','rate','unknown'].includes(r.status))return false;
  if(state.filter==='sent'&&r.status!=='sent')return false;
  const date=new Date(r.date).getTime();
  if(state.period==='custom')return date>=new Date(state.rangeStart+'T00:00:00Z').getTime()&&date<new Date(state.rangeEnd+'T23:59:59Z').getTime();
  return state.period==='all'||date>=end-Number(state.period)*86400000;
 });
}
function history(){
 const list=filtered(),pages=Math.max(1,Math.ceil(list.length/7));state.pageIndex=Math.min(state.pageIndex,pages-1);
 let last='';const rows=list.slice(state.pageIndex*7,state.pageIndex*7+7).map(r=>{const day=dateLabel(r.date),head=last!==day?`<div class="day-heading">${day}</div>`:'';last=day;return head+row(r);}).join('');
 return `<div class="filter-bar"><label class="search-field">${icon('search')}<input type="search" aria-label="Hledat nahrávky" placeholder="Hledat schůzku nebo firmu" data-field="search" value="${esc(state.search)}"></label><select aria-label="Období" data-field="period">${[['7','7 dní'],['30','30 dní'],['180','Půl roku'],['all','Celá historie'],['custom','Vlastní období']].map(([v,l])=>`<option value="${v}" ${state.period===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="filter-bar"><div class="segment" role="group" aria-label="Stav nahrávek">${[['all','Vše'],['local','Na Macu'],['delivery','Odesílání'],['sent','V LuDone']].map(([v,l])=>`<button class="${state.filter===v?'active':''}" data-action="filter" data-value="${v}" aria-pressed="${state.filter===v}">${l}</button>`).join('')}</div><span class="muted" style="font-size:13px;margin-left:auto">${list.length} ${list.length===1?'nahrávka':list.length<5?'nahrávky':'nahrávek'}</span></div>${state.period==='custom'?btn(`${dateLabel(state.rangeStart)} – ${dateLabel(state.rangeEnd)}`,'range','','clock'):''}<div class="history-list">${rows||`<div class="empty">${icon('search')}<h2>Žádná schůzka v tomto výběru</h2><p>Zkuste jiné období nebo hledaný výraz.</p>${btn('Zrušit filtry','reset-filters')}</div>`}</div><div class="pagination"><span>${list.length?state.pageIndex*7+1:0}–${Math.min((state.pageIndex+1)*7,list.length)} z ${list.length}</span><div>${btn('Předchozí','previous','','back',state.pageIndex===0?'disabled':'')}${btn('Další','next','','chevron',state.pageIndex===pages-1?'disabled':'')}</div></div>`;
}
function detail(){
 const r=current();if(!r)return `<div class="empty"><h2>Nahrávka není v přehledu</h2>${btn('Zpět na nahrávky','nav','','','data-page="library"')}</div>`;
 const local=r.localPresent===false?'Místní kopie není k dispozici':['missing','partial'].includes(r.status)?r.status==='missing'?'Soubor chybí':'Zvuk není úplný':'Zvuk je uložený';
 const remote=r.verified===true?'Dokončeno · ověřeno':r.verified==='missing'?'Na serveru nenalezeno':r.status==='sent'?'Odesláno · neověřeno':r.status==='queued'?`Odesílá se · ${r.progress} %`:r.status==='unknown'?'Stav není známý':'Zatím neodesláno';
 const canSend=(!r.locked||r.status==='failed')&&r.localPresent!==false&&r.claimed&&!['missing','partial'].includes(r.status)&&state.signed&&state.network&&state.scope&&!state.companyError&&!state.draftDirty;
 const issue=r.status==='unclaimed'?notice('Nahrávka není přiřazená','Nejprve ji převezměte pod svůj účet. Převzetí nic neodešle.','claim','Převzít'):r.status==='rate'?notice('Server teď omezuje odesílání','Další pokus za 12 minut. Soubor je v bezpečí.','','','warning'):r.status==='missing'?notice('Místní soubor chybí','Nahrávku nelze odeslat. Zkontrolujte složku ve Finderu.','','','error'):r.status==='partial'?notice('Zvuk není úplný','Tuto nahrávku nelze bezpečně odeslat.','','','error'):r.status==='failed'?notice('Odeslání se nepodařilo','Po kontrole připojení můžete opakovat pokus.','','','error'):'';
 return `<div class="detail-layout"><div class="detail-main"><div class="detail-hero"><h2>${esc(r.title)}</h2>${badge(r)}<div class="facts"><span>${dateLabel(r.date)} · ${timeLabel(r.date)}</span><span>${r.duration}</span><span>${r.size}</span></div>${waveform()}</div>${issue}<div class="status-pair"><section class="status-cell"><small>Na tomto Macu</small><strong>${local}</strong><p>${r.localPresent===false?'Webový záznam zůstává v přehledu':r.microphoneOnly?'Jen mikrofon · WebM':'Jeden stereo soubor · WebM'}</p></section><section class="status-cell"><small>V LuDone</small><strong>${remote}</strong><p>${r.verified===true?'Ověřeno právě teď':'Stav ověřte před spoléháním na upload.'}</p></section></div><h3 style="margin-bottom:18px">Firma a přístup</h3>${r.locked?`<div class="surface"><strong style="font-size:14px">${esc(r.company)}</strong><p class="small-note">${r.visibility==='company'?'Sdílená ve firmě':'Soukromá'} · Volby jsou zamčené, odesílání už začalo.</p></div>`:preferences(r,state.draftDirty)+`<div style="margin-top:17px">${btn('Uložit volby','save-preferences','','',!state.draftDirty||state.companyError?'disabled':'')}</div><p class="small-note">Uložení voleb nahrávku neodešle.</p>`}<details class="technical"><summary>Technické údaje</summary><p>ID: ${r.id}<br>Server: app.ludone.cz<br>Formát: WebM / Opus, stereo<br>${r.locked?'Upload byl zahájen.':'Upload dosud nezačal.'}</p></details></div><aside class="detail-aside"><h3>Akce</h3><div class="detail-actions">${r.status==='local'||r.status==='failed'?btn(r.status==='failed'?'Zkusit znovu':'Uložit a odeslat',r.status==='failed'?'retry':'send','primary','cloud',canSend?'':'disabled'):''}${r.status==='unclaimed'?btn('Převzít pod svůj účet','claim','primary','user',state.signed?'':'disabled'):''}${r.locked?btn('Ověřit v LuDone','verify','','update',state.signed&&state.network?'':'disabled'):''}${r.verified===true?btn('Otevřít v LuDone','open-web','','web'):''}${btn('Ukázat ve Finderu','finder','','folder',r.localPresent===false&&r.status==='sent'?'disabled':'')}${btn('Přesunout do koše','trash','danger','trash',r.status==='queued'||r.localPresent===false?'disabled':'')}</div>${r.status==='queued'?`<p class="small-note">Mazání počká na dokončení odesílání.</p><div class="progress"><i style="width:${r.progress}%"></i></div>`:''}<p class="small-note">Přepis a analýza jsou dostupné na webu.</p></aside></div>`;
}
function queuePage(){
 const list=state.recordings.filter(r=>['queued','failed','unclaimed','rate','unknown','missing','partial'].includes(r.status));
 return `<div class="page-intro"><p>${list.length} čekajících nahrávek · automatické obnovení po restartu</p></div>${notice('Uložené na tomto Macu','Další pokus neodesílá nahrávky čekající na potvrzení vlastníka.','retry-queue','Zkusit teď')}<div style="margin-top:14px">${list.slice(0,9).map(r=>`<section class="queue-row"><div class="row-head"><div><h3>${esc(r.title)}</h3><p>${r.status==='rate'?'Další pokus za 12 minut':r.status==='unclaimed'?'Čeká na převzetí vlastníka':r.status==='unknown'?'Odeslání čeká na ověření serveru':r.status==='missing'?'Místní soubor chybí':r.status==='partial'?'Zvuk není kompletní':r.status==='failed'?'Přenos selhal · soubor zůstal uložený':`Odesílá se · ${r.progress} %`} · ${r.size}</p></div>${btn('Detail','detail','','chevron',`data-id="${r.id}"`)}</div>${r.status==='queued'?`<div class="progress"><i style="width:${r.progress}%"></i></div>`:''}</section>`).join('')}</div><p class="small-note">Čekající přenosy se obnoví i po opětovném spuštění.</p>`;
}
const tabs=[['account','Účet'],['audio','Zvuk'],['device','Zařízení'],['storage','Ukládání'],['diagnostics','Diagnostika']];
function toggle(label,key,help=''){return `<div class="setting-row"><div class="setting-label"><strong>${label}</strong>${help?`<small>${help}</small>`:''}</div><button class="switch" role="switch" aria-label="${label}" aria-checked="${state[key]}" data-action="toggle" data-key="${key}"><i></i></button></div>`;}
function settings(){return `<div class="settings-layout"><nav class="settings-nav" aria-label="Části nastavení">${tabs.map(([id,label])=>`<button class="${state.tab===id?'active':''}" data-action="settings-tab" data-tab="${id}" aria-current="${state.tab===id?'page':'false'}">${label}</button>`).join('')}</nav><div class="settings-content">${settingContent()}</div></div>`;}
function settingContent(){
 if(state.tab==='account')return `<section class="settings-section"><h2>Účet a odesílání</h2><div class="group"><div class="setting-row"><span class="avatar">AK</span><div class="setting-label"><strong>${state.signed?'Alex Král':'Odhlášeno'}</strong><small>${state.signed?'alex@example.invalid':'Lokální nahrávky zůstávají uložené.'}</small></div>${btn(state.signed?'Odhlásit':'Přihlásit',state.signed?'logout':'login','subtle')}</div><div class="setting-row"><div class="field"><label for="default-company">Výchozí firma</label><select id="default-company" data-field="company-choice" ${state.companyError?'disabled':''}>${companyOptions(state.companyChoice)}</select><small>Pro nové nahrávky. U jednotlivé schůzky ji můžete změnit.</small>${state.companyError?btn('Načíst firmy','load-companies'):''}${state.companyDirty?btn('Uložit výchozí firmu','save-company','primary'):''}</div></div>${toggle('Nové nahrávky odesílat automaticky','auto','Starší schůzky se tím neodešlou.')}</div><details class="technical"><summary>Pokročilé · prostředí</summary><div class="setting-row"><div class="setting-label"><strong>Server LuDone</strong><small>${state.environment==='prod'?'app.ludone.cz':'labs.ludone.cz'}</small></div><select data-field="environment" aria-label="Prostředí"><option value="prod" ${state.environment==='prod'?'selected':''}>Produkce</option><option value="labs" ${state.environment==='labs'?'selected':''}>Labs</option></select></div></details></section>`;
 if(state.tab==='audio')return `<section class="settings-section"><h2>Zvuk schůzky</h2><div class="group"><div class="setting-row"><div class="setting-label"><strong>${icon('record')} Mikrofon</strong><small>Levý kanál</small></div>${state.mic?'<span class="badge sent">Povoleno</span>':btn('Povolit','grant-mic')}</div><div class="setting-row"><div class="setting-label"><strong>${icon('sound')} Systémový zvuk</strong><small>Pravý kanál</small></div>${state.system?'<span class="badge sent">Povoleno</span>':btn('Nastavení macOS','grant-system')}</div></div><h3>Zkouška zvuku</h3><p class="small-note">Spusťte zkoušku a ověřte oba kanály poslechem.</p>${testUI()}<p class="small-note">Jeden výsledný soubor · mikrofon vlevo, schůzka vpravo.</p></section>`;
 if(state.tab==='device')return `<section class="settings-section"><h2>Tento Mac</h2><div class="group">${toggle('Ikona také v Docku','dock')}${toggle('Spouštět po přihlášení','launch')}</div><h3>Vzhled</h3><div class="segment" style="margin-top:17px;display:inline-flex" role="group" aria-label="Barevné téma">${[['light','Světlé'],['professional','Profesionální'],['dark','Tmavé']].map(([v,l])=>`<button class="${globalThis.document.documentElement.dataset.theme===v?'active':''}" data-action="theme" data-value="${v}" aria-pressed="${globalThis.document.documentElement.dataset.theme===v}">${l}</button>`).join('')}</div><div style="margin-top:30px">${btn('Klávesové zkratky','shortcuts','','keyboard')}${btn('Panel v liště','tray','subtle','tray')}</div></section>`;
 if(state.tab==='storage')return `<section class="settings-section"><h2>Lokální soubory</h2><div class="group"><div class="setting-row"><div class="field"><label for="retention">Po odeslání ponechat na Macu</label><select id="retention" data-field="retention">${[['0','Ihned smazat'],['1','24 hodin'],['7','7 dní'],['30','30 dní'],['never','Nemazat']].map(([v,l])=>`<option value="${v}" ${state.retention===v?'selected':''}>${l}</option>`).join('')}</select><small>Neodeslané nahrávky se automaticky nemažou.</small></div></div><div class="setting-row"><div class="setting-label"><strong>${state.recordings.length} nahrávek</strong><small>Přehled lokálního archivu</small></div>${btn('Zobrazit složku','finder','','folder')}</div></div>${btn('Přejít na odesílání','nav','','cloud','data-page="queue"')}</section>`;
 return `<section class="settings-section"><h2>Diagnostika</h2><p class="small-note">Přehled stavu pro podporu. Neobsahuje zvuk ani přístupové tokeny.</p><div class="diag-grid">${[['Verze','0.1.7'],['Architektura','Apple Silicon'],['Mikrofon',state.mic?'Povoleno':'Chybí oprávnění'],['Systémový zvuk',state.system?'Povoleno':'Chybí oprávnění'],['Server',state.network?'Připojení v pořádku':'Offline'],['Přihlášení',state.signed?'Aktivní · upload povolen':'Vypršelo']].map(([l,v])=>`<div><small>${l}</small><strong>${v}</strong></div>`).join('')}</div>${btn('Exportovat diagnostiku','export','','folder')}${btn('Ověřit zvuk','sources','subtle','sound')}</section>`;
}
function testUI(){return `<div class="surface"><div class="record-head"><strong style="font-size:14px">${state.test==='running'?'Zkouška běží':state.test==='stopped'?'Záznam zkoušky je připraven':'Zkouška není spuštěná'}</strong>${btn(state.test==='running'?'Zastavit zkoušku':'Spustit zkoušku','audio-test',state.test==='running'?'danger':'','record')}</div>${state.test==='running'?waveform(true)+btn('Přehrát testovací zvuk','test-tone','','sound'):''}${state.test==='stopped'?`<p class="small-note">Přehrajte záznam a potvrďte, co skutečně slyšíte.</p>${btn('Přehrát záznam zkoušky','test-play','','play')}<label class="check-field"><input type="checkbox" data-field="heard-mic" ${state.heardMic?'checked':''}>Slyším mikrofon</label><label class="check-field"><input type="checkbox" data-field="heard-system" ${state.heardSystem?'checked':''}>Slyším systémový zvuk</label><span class="badge ${state.heardMic&&state.heardSystem?'sent':'local'}">${state.heardMic&&state.heardSystem?'Oba kanály potvrzené':'Čeká na vaše potvrzení'}</span>`:''}</div>`;}
function updates(){
 const active=state.update==='ready',busy=state.phase==='recording'||state.phase==='finalizing'||state.phase==='draft';
 return `<section class="update-hero"><img class="logo" src="LuDone.svg" alt="LuDone"><span class="eyebrow">LuDone Desktop · 0.1.7</span><h2 style="margin-top:10px">${state.update==='current'?'Používáte aktuální verzi':state.update==='downloading'?'Stahuje se nová verze':state.update==='failed'?'Aktualizaci nelze ověřit':state.installRequested?'Aktualizace počká':'Nová verze je připravená'}</h2><p>${state.installRequested?'Dokončete nahrávání a uložení. Teprve pak může aplikace restartovat.':active?'Přehlednější práce s nahrávkami a úpravy každodenního používání.':'Kontrola probíhá automaticky po spuštění a každých šest hodin.'}</p>${state.update==='downloading'?'<div class="progress" style="max-width:390px"><i style="width:64%"></i></div><p class="small-note">Staženo 64 % · instalaci spustíte sami.</p>':''}<div class="record-actions">${active?btn(state.installRequested?'Čeká na dokončení':'Aktualizovat a restartovat','install','primary','update',state.installRequested?'disabled':'')+btn('Později','defer'):btn('Zkontrolovat aktualizace','check-update','primary','update')}</div>${busy&&active?'<p class="small-note">Nahrávání ani ukládání se aktualizací nepřeruší.</p>':''}</section><div class="group"><div class="setting-row"><div class="setting-label"><strong>Jedno oznámení macOS pro každou verzi</strong><small>Připomínka zůstává také v aplikaci.</small></div>${btn('Ukázka','update-notification','subtle')}</div><div class="setting-row"><div class="setting-label"><strong>Co je nové</strong><small>0.1.8 je zde pouze fiktivní návrh.</small></div>${btn('Zobrazit','release-notes','subtle')}</div></div>`;
}
function onboarding(){
 const step=state.onboarding;
 const pages=[`<img class="logo" src="LuDone.svg" alt="LuDone"><h2>Vaše schůzky.<br>V jednom místě.</h2><p>Nahrajte schůzku na Macu. Přepis a analýzu otevřete v LuDone na webu.</p>${btn('Začít','onboarding-next','primary','chevron')}`,`<h2>Propojte LuDone</h2><p>Přihlášení a souhlas s odesíláním proběhnou v prohlížeči.</p>${btn('Přihlásit přes prohlížeč','login','primary','web')}`,`<h2>Povolte zvuk</h2><p>Oba zdroje vytvoří jeden stereo záznam.</p><div class="permission-row">${icon('record')}<div><strong>Mikrofon</strong><small>Váš hlas · levý kanál</small></div>${btn(state.mic?'Povoleno':'Povolit','grant-mic',state.mic?'subtle':'', '',state.mic?'disabled':'')}</div><div class="permission-row">${icon('sound')}<div><strong>Systémový zvuk</strong><small>Zvuk schůzky · pravý kanál</small></div>${btn(state.system?'Povoleno':'Nastavení macOS','grant-system',state.system?'subtle':'','',state.system?'disabled':'')}</div><div class="record-actions" style="margin-top:25px">${btn('Pokračovat','onboarding-next','primary','',state.mic?'':'disabled')}${btn('Znovu ověřit','permission-check','subtle')}</div>`,`<h2>Zkuste oba kanály</h2><p>Samotné oprávnění nezaručuje, že je zvuk slyšet.</p>${testUI()}<div class="record-actions" style="margin-top:25px">${btn('Oba kanály slyším','onboarding-next','primary','',''+(!state.heardMic||!state.heardSystem?'disabled':''))}${btn('Pokračovat bez ověření','onboarding-next','subtle')}</div>`,`<img class="logo" src="LuDone.svg" alt=""><h2>Připraveno.</h2><p>Panel najdete pod ikonou LuDone v horní liště.</p>${!state.heardMic||!state.heardSystem?notice('Zvuk zůstává neověřený','Před důležitou schůzkou dokončete zkoušku.'):''}<div style="margin-top:25px">${btn('Otevřít LuDone','finish-onboarding','primary','chevron')}</div>`];
 return `<div class="onboarding"><div class="steps" aria-label="Krok ${step+1} z 5">${Array.from({length:5},(_,i)=>`<i class="${i<=step?'active':''}"></i>`).join('')}</div>${pages[step]}</div>`;
}
let modalReturnFocus;
function modal(title,body,actions){modalReturnFocus=globalThis.document.activeElement;$('.modal-layer').innerHTML=`<section class="sheet" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header class="sheet-head"><h2 id="dialog-title">${title}</h2><button class="icon-btn" data-action="close-modal" aria-label="Zavřít">${icon('close')}</button></header><div class="sheet-body">${body}</div><footer class="sheet-actions">${actions}</footer></section>`;$('.modal-layer').hidden=false;globalThis.requestAnimationFrame(()=>$('.modal-layer').querySelector('input,select,button')?.focus());}
function closeModal(){ $('.modal-layer').hidden=true;modalReturnFocus?.isConnected&&modalReturnFocus.focus(); }
let toastTimer;
function toast(text){$('.toast').textContent=text;$('.toast').hidden=false;globalThis.clearTimeout(toastTimer);toastTimer=globalThis.setTimeout(()=>$('.toast').hidden=true,4200);}
function login(){modal('Přihlášení v prohlížeči',`<p>Potvrďte účet a oprávnění k odesílání v LuDone. Tato ukázka neotevírá skutečné přihlášení.</p><div class="notice"><div><strong>Čekám na prohlížeč</strong><p>app.ludone.cz · platnost odkazu 10 minut</p></div></div><p class="small-note">Pokud se prohlížeč neotevřel, zkopírujte odkaz.</p>${btn('Kopírovat odkaz','copy-login','subtle','web')}`,btn('Zrušit','close-modal')+btn('Simulovat návrat','login-complete','primary'));}
function navigate(page){
 if(state.draftDirty&&state.page==='detail'&&page!=='detail'){modal('Uložit změny?',`<p>Firma a přístup této schůzky mají neuložené změny.</p>`,btn('Zůstat','close-modal')+btn('Zahodit změny','discard-nav','','',`data-page="${page}"`)+btn('Uložit a přejít','save-nav','primary','',`data-page="${page}"`));return;}
 if(state.companyDirty&&state.page==='settings'&&page!=='settings'){modal('Uložit výchozí firmu?',`<p>Změna ještě není uložená.</p>`,btn('Zůstat','close-modal')+btn('Zahodit změnu','discard-nav','','',`data-page="${page}"`)+btn('Uložit a přejít','save-nav','primary','',`data-page="${page}"`));return;}
 menuOpen=true;state.page=page;render();$('.content').scrollTop=0;
}
function saveRecording(send){
 if(send&&(!state.signed||!state.network||!state.scope||state.companyError||!state.draft.company))return;
 state.recordings.unshift({id:'new-'+Date.now(),title:state.draft.title.trim()||'Nová schůzka',date:'2026-10-01T10:05:00Z',duration:clock(),size:'5,2 MB',status:send?'queued':'local',company:state.draft.company,visibility:state.draft.visibility,verified:null,claimed:true,localPresent:true,microphoneOnly:state.microphoneOnly,locked:send,progress:0});state.phase='idle';state.draftDirty=false;state.page='home';state.period='30';state.pageIndex=0;state.search='';state.filter='all';render();toast(send?'Zařazeno k odeslání · ukázka':'Nahrávka zůstává na Macu · ukázka');finishInstall();
}
function finishInstall(){if(state.installRequested&&state.phase==='idle'){state.installRequested=false;state.update='current';render();toast('Ukázka: po bezpečném uložení by proběhl restart a instalace.');}}
function applyScenario(name){
 state=seed();menuOpen=true;recordOriginal=null;closeModal();$('.scenario').value=name;
 if(name==='recording'||name==='system-lost'){state.phase='recording';state.seconds=1458;state.systemLost=name==='system-lost';}
 if(name==='save'){state.phase='draft';state.seconds=1458;}
 if(name==='saving'){state.phase='finalizing';state.seconds=1458;}
 if(name==='history')state.page='library';
 if(['detail','sent','unclaimed','rate','missing'].includes(name)){state.page='detail';state.selected={detail:'demo-0',sent:'demo-1',unclaimed:'demo-5',rate:'demo-7',missing:'demo-8'}[name];}
 if(name==='queue')state.page='queue';
 if(name==='offline'){state.network=false;state.page='queue';}
 if(name==='expired'){state.signed=false;state.page='queue';}
 if(name==='microphone-only'){state.phase='recording';state.seconds=1458;state.system=false;state.microphoneOnly=true;}
 if(name==='companies-error'){state.companyError=true;state.phase='draft';state.seconds=1458;}
 if(name==='settings')state.page='settings';
 if(name==='updates'){state.page='updates';state.update='ready';}
 if(name==='onboarding'){state.page='onboarding';state.signed=false;state.mic=false;state.system=false;}
 render();$('.content').scrollTop=0;if(name==='tray')openTray();
}
function openTray(){menuOpen=true;closeModal();navigate('home');}

let recordOriginal;
globalThis.document.addEventListener('click',event=>{
 const el=event.target.closest('[data-action]');if(!el||el.disabled)return;const action=el.dataset.action,r=current();
 if(action==='menu-toggle'){if(state.page==='detail'){openTray();}else{menuOpen=!menuOpen;render();}return;}
 if(action==='hide-menu'){menuOpen=false;render();return;}
 if(action==='nav'){menuOpen=true;navigate(el.dataset.page||'updates');return;}
 if(action==='settings-tab'){state.tab=el.dataset.tab;render();$('.content').scrollTop=0;return;}
 if(action==='detail'){if(state.draftDirty){navigate('library');return;}closeModal();state.selected=el.dataset.id;recordOriginal={...current()};state.page='detail';state.draftDirty=false;render();$('.content').scrollTop=0;return;}
 if(action==='close-modal'){closeModal();return;}
 if(action==='start'){menuOpen=true;closeModal();if(state.phase==='draft'||state.phase==='finalizing'){state.page='home';render();return;}if(!state.mic){state.page='settings';state.tab='audio';render();toast('Nejprve povolte mikrofon.');return;}if(!state.system){modal('Nahrávat jen mikrofon?',`<p>Druhá strana schůzky se nezachytí. Můžete povolit systémový zvuk nebo pokračovat omezeně.</p>`,btn('Zvuk a oprávnění','quick-nav','','sound','data-page="settings" data-tab="audio"')+btn('Nahrát jen mikrofon','start-microphone','primary'));return;}if(state.phase==='draft'){state.page='home';render();return;}state.microphoneOnly=false;state.phase='recording';state.seconds=0;state.page='home';render();return;}
 if(action==='start-microphone'){closeModal();state.microphoneOnly=true;state.phase='recording';state.seconds=0;state.page='home';render();return;}
 if(action==='stop'){menuOpen=true;closeModal();state.phase='finalizing';state.page='home';render();globalThis.setTimeout(()=>{state.phase='draft';state.draft={title:'Nová schůzka',company:state.defaultCompany,visibility:'company'};if(state.auto&&state.signed&&state.network&&state.scope&&state.defaultCompany&&!state.companyError){saveRecording(true);}else render();},650);return;}
 if(action==='save-send'||action==='save-local'){saveRecording(action==='save-send');return;}
 if(action==='sources'){closeModal();state.tab='audio';navigate('settings');return;}
 if(action==='refresh'){render();toast('Přehled obnoven · pouze fiktivní data');return;}
 if(action==='reconnect'){state.network=true;render();toast('Připojení obnoveno · ukázka');return;}
 if(action==='login'){login();return;}
 if(action==='login-complete'){state.signed=true;state.scope=true;closeModal();if(state.page==='onboarding')state.onboarding=2;render();toast('Přihlášení a upload oprávnění potvrzené · ukázka');return;}
 if(action==='copy-login'){toast('Zde by se zkopíroval přihlašovací odkaz.');return;}
 if(action==='logout'){modal('Odhlásit tento Mac?',`<p>Lokální nahrávky zůstanou uložené. Odesílání se pozastaví do dalšího přihlášení.</p>`,btn('Zrušit','close-modal')+btn('Odhlásit','logout-confirm','danger'));return;}
 if(action==='logout-confirm'){state.signed=false;closeModal();render();return;}
 if(action==='filter'){state.filter=el.dataset.value;state.pageIndex=0;render();return;}
 if(action==='reset-filters'){state.search='';state.period='all';state.filter='all';state.pageIndex=0;render();return;}
 if(action==='previous'||action==='next'){state.pageIndex+=action==='next'?1:-1;render();$('.content').scrollTop=0;return;}
 if(action==='range'){modal('Vlastní období',`<div class="form-grid"><div class="field"><label for="range-from">Od · den. měsíc. rok</label><input id="range-from" placeholder="1. 4. 2026" value="${new Date(state.rangeStart).toLocaleDateString('cs-CZ')}" inputmode="numeric"></div><div class="field"><label for="range-to">Do · den. měsíc. rok</label><input id="range-to" placeholder="1. 10. 2026" value="${new Date(state.rangeEnd).toLocaleDateString('cs-CZ')}" inputmode="numeric"></div><p class="small-note" id="range-error">Datum například 1. 4. 2026.</p></div>`,btn('Zrušit','close-modal')+btn('Použít období','apply-range','primary'));return;}
 if(action==='apply-range'){const parse=(v)=>{const m=v.match(/^\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})\s*$/);if(!m)return null;const y=+m[3],mo=+m[2],d=+m[1],dt=new Date(Date.UTC(y,mo-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo-1&&dt.getUTCDate()===d?`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`:null;};const from=parse($('#range-from').value),to=parse($('#range-to').value);if(!from||!to||from>to){$('#range-error').textContent='Zadejte platné datum a pořadí od–do.';return;}state.rangeStart=from;state.rangeEnd=to;state.period='custom';state.pageIndex=0;closeModal();render();return;}
 if(action==='save-preferences'){state.draftDirty=false;recordOriginal={...r};render();toast('Volby uloženy. Nahrávka se neodeslala.');return;}
 if(action==='send'||action==='retry'){if(!r||(r.locked&&action!=='retry')||state.draftDirty||!state.signed||!state.network||!state.scope)return;modal('Odeslat do LuDone?',`<p><strong>${esc(r.title)}</strong></p><div class="status-pair"><div class="status-cell"><small>Firma</small><strong>${esc(r.company)}</strong></div><div class="status-cell"><small>Přístup</small><strong>${r.visibility==='private'?'Soukromá':'Sdílená ve firmě'}</strong></div></div>`,btn('Zrušit','close-modal')+btn('Odeslat','send-confirm','primary','cloud'));return;}
 if(action==='send-confirm'){r.status='queued';r.locked=true;r.progress=0;closeModal();render();toast('Zařazeno k odeslání · simulace');return;}
 if(action==='claim'){if(!state.signed){toast('Nejprve se přihlaste.');return;}modal('Převzít nahrávku?',`<p>Nahrávka <strong>${esc(r.title)}</strong> bude přiřazena účtu Alex Král. Převzetí ji neodešle.</p>`,btn('Zrušit','close-modal')+btn('Převzít pod svůj účet','claim-confirm','primary'));return;}
 if(action==='claim-confirm'){if(!state.signed)return;r.claimed=true;r.status='local';r.locked=false;closeModal();render();toast('Převzato. Odeslání musí být samostatně potvrzené.');return;}
 if(action==='verify'){if(r.status==='queued'){toast('Ukázka ověření: přenos není dokončený.');return;}r.verified=r.status==='unknown'?'missing':true;if(r.verified==='missing'){r.status='failed';}render();toast(r.verified===true?'Ukázka: server potvrdil dokončený soubor.':'Ukázka: server soubor nenalezl.');return;}
 if(action==='finder'){toast('Ve skutečné aplikaci se otevře složka ve Finderu.');return;}
 if(action==='open-web'){toast('Ve skutečné aplikaci se otevře tato nahrávka na app.ludone.cz.');return;}
 if(action==='trash'){modal('Odstranit soubor z tohoto Macu?',`<p><strong>${esc(r.title)}</strong></p><p>${r.verified===true?'Nahrávka v LuDone zůstane zachovaná.':'Ověřená kopie v LuDone není potvrzená. Můžete odstranit jediný záznam.'}</p>`,btn('Zrušit','close-modal')+btn('Přesunout do koše','trash-confirm','danger','trash'));return;}
 if(action==='trash-confirm'){if(r.locked||r.verified===true){r.localPresent=false;}else state.recordings=state.recordings.filter(x=>x.id!==state.selected);closeModal();state.page='library';render();toast('Místní soubor odstraněn pouze z fiktivní makety.');return;}
 if(action==='retry-queue'){if(!state.signed||!state.network||!state.scope){toast('Odesílání počká na připojení a přihlášení.');return;}state.recordings.filter(r=>r.status==='failed').forEach(r=>{r.status='queued';r.locked=true;r.progress=0;});render();toast('Opakovány pouze schválené přenosy · simulace');return;}
 if(action==='toggle'){state[el.dataset.key]=!state[el.dataset.key];render();return;}
 if(action==='save-company'){state.defaultCompany=state.companyChoice;state.companyDirty=false;render();toast('Výchozí firma uložena pro nové schůzky.');return;}
 if(action==='load-companies'){state.companyError=false;render();toast('Nabídka firem obnovena · simulace');return;}
 if(action==='discard-nav'||action==='save-nav'){if(action==='save-nav'&&state.companyDirty)state.defaultCompany=state.companyChoice;if(action==='discard-nav'){state.companyChoice=state.defaultCompany;if(recordOriginal&&r&&state.draftDirty)Object.assign(r,recordOriginal);}state.companyDirty=false;state.draftDirty=false;closeModal();navigate(el.dataset.page);return;}
 if(action==='theme'){globalThis.document.documentElement.dataset.theme=el.dataset.value;$('.theme-select').value=el.dataset.value;render();return;}
 if(action==='grant-mic'||action==='grant-system'){modal(action==='grant-mic'?'Povolit mikrofon':'Povolit systémový zvuk',`<p>${action==='grant-system'?'V nastavení macOS povolte LuDone záznam systémového zvuku. Pak se vraťte do aplikace.':'macOS zobrazí žádost o přístup k mikrofonu.'}</p><p class="small-note">Tady je pouze návrh postupu, žádná skutečná žádost se neposílá.</p>`,btn('Zrušit','close-modal')+btn('Simulovat povolení','grant-confirm','primary','',`data-key="${action==='grant-mic'?'mic':'system'}"`));return;}
 if(action==='grant-confirm'){state[el.dataset.key]=true;closeModal();render();return;}
 if(action==='permission-check'){render();toast('Ukázka kontroly oprávnění dokončena.');return;}
 if(action==='audio-test'){state.test=state.test==='running'?'stopped':'running';state.heardMic=false;state.heardSystem=false;render();return;}
 if(action==='test-tone'||action==='test-play'){toast('Zvuková zkouška je zde pouze vizuální maketa.');return;}
 if(action==='recover-sound'){state.systemLost=false;render();toast('Kanál obnoven · chybějící část se nedoplňuje (ukázka).');return;}
 if(action==='export'){modal('Export diagnostiky',`<p>Ve skutečné aplikaci vznikne soubor s verzí, oprávněními a stavem fronty. Zvuk, tokeny a osobní údaje neobsahuje.</p>`,btn('Hotovo','close-modal','primary'));return;}
 if(action==='environment-confirm'){state.environment=el.dataset.value;state.signed=false;state.defaultCompany='';state.companyChoice='';closeModal();render();toast('Prostředí změněno pouze v maketě. Přihlaste se k novému serveru.');return;}
 if(action==='quick-actions'){modal('Rychlé akce',`<div class="detail-actions">${btn('Nahrávání','quick-nav','','record','data-page="home"')}${btn('Nahrávky','quick-nav','','library','data-page="library"')}${btn('Odesílání','quick-nav','','cloud','data-page="queue"')}${btn('Zvuk','quick-nav','','sound','data-page="settings" data-tab="audio"')}${btn('Účet','quick-nav','','user','data-page="settings" data-tab="account"')}</div>`,btn('Klávesové zkratky','shortcuts','subtle','keyboard')+btn('Zavřít','close-modal'));return;}
 if(action==='quick-nav'){closeModal();if(el.dataset.tab)state.tab=el.dataset.tab;navigate(el.dataset.page);return;}
 if(action==='quit'){modal('Ukončit LuDone?',`<p>${state.phase==='recording'?'Nejprve zastavte nahrávání a uložte schůzku.':state.phase==='draft'||state.phase==='finalizing'?'Před ukončením dokončete uložení schůzky.':'Místní nahrávky zůstanou uložené. Čekající přenosy se obnoví po spuštění.'}</p>`,btn('Zrušit','close-modal')+btn(state.phase==='idle'?'Ukončit · ukázka':'Přejít k nahrávání',state.phase==='idle'?'quit-confirm':'quick-nav','primary','',state.phase==='idle'?'':'data-page="home"'));return;}
 if(action==='quit-confirm'){closeModal();toast('Ukázka ukončení. Návrh zůstává otevřený.');return;}
 if(action==='about'){modal('O LuDone Desktop',`<p>LuDone Desktop · 0.1.7<br>Schůzky na Macu, přepis v LuDone.</p><p class="small-note">Tato obrazovka je návrh, ne nainstalovaná aplikace.</p>`,btn('Hotovo','close-modal','primary'));return;}
 if(action==='shortcuts'){modal('Klávesové zkratky',`<div class="shortcut-row"><span>Rychlé akce</span><kbd>⌘ K</kbd></div><div class="shortcut-row"><span>Ukončit nahrávání</span><kbd>⌃ ⌥ R</kbd></div><div class="shortcut-row"><span>Panel v liště</span><kbd>⌃ ⌥ L</kbd></div><div class="shortcut-row"><span>Nahrát / zastavit v maketě</span><kbd>⌘ ⇧ R</kbd></div><div class="shortcut-row"><span>Hledat v nahrávkách</span><kbd>⌘ F</kbd></div><div class="shortcut-row"><span>Nastavení</span><kbd>⌘ ,</kbd></div><div class="shortcut-row"><span>Zavřít dialog</span><kbd>Esc</kbd></div>`,btn('Hotovo','close-modal','primary'));return;}
 if(action==='tray'){openTray();return;}
 if(action==='tray-menu'){modal('LuDone · nabídka',`<div class="detail-actions">${btn('Otevřít LuDone na webu','open-web','','web')}${btn('Nastavení','quick-nav','','settings','data-page="settings"')}${btn('Aktualizace','quick-nav','','update','data-page="updates"')+btn('Klávesové zkratky','shortcuts','','keyboard')+btn('O aplikaci','about','','info')}${btn('Ukončit LuDone','quit','danger')}</div>`,btn('Zavřít','close-modal'));return;}
 if(action==='check-update'){state.update='downloading';render();globalThis.setTimeout(()=>{state.update='ready';render();toast('Fiktivní verze 0.1.8 je připravená.');},900);return;}
 if(action==='defer'){state.deferred=true;render();toast('Aktualizace odložena. Najdete ji v navigaci.');return;}
 if(action==='install'){state.installRequested=true;render();if(state.phase==='idle')finishInstall();return;}
 if(action==='update-notification'){modal('Ukázka oznámení macOS',`<div class="notice"><img src="LuDone.svg" width="28" alt=""><div><strong>LuDone Desktop</strong><p>Nová verze je připravená. Aktualizujte, až se vám to hodí.</p></div></div>`,btn('Hotovo','close-modal','primary'));return;}
 if(action==='release-notes'){modal('Co je nové · ukázka',`<p>Přehlednější historie, čitelnější nastavení a jednodušší práce se schůzkami.</p><p class="small-note">Nejde o skutečně vydanou verzi.</p>`,btn('Hotovo','close-modal','primary'));return;}
 if(action==='onboarding-next'){state.onboarding=Math.min(4,state.onboarding+1);render();return;}
 if(action==='finish-onboarding'){state.page='home';render();return;}
});
globalThis.document.addEventListener('input',event=>{
 const el=event.target,key=el.dataset.field;
 if(key==='draft-title'){state.draft.title=el.value;return;}
 if(key==='search'){
  const start=el.selectionStart,end=el.selectionEnd,scroll=$('.content').scrollTop;
  state.search=el.value;state.pageIndex=0;render();const search=$('[data-field=search]');
  search.focus({preventScroll:true});search.setSelectionRange(start,end);$('.content').scrollTop=scroll;
 }
});
globalThis.document.addEventListener('change',event=>{
 const el=event.target,key=el.dataset.field;
 if(key==='period'){state.period=el.value;state.pageIndex=0;render();if(el.value==='custom')$('[data-action=range]').click();return;}
 if(key==='draft-company')state.draft.company=el.value;
 if(key==='draft-visibility')state.draft.visibility=el.value;
 if(key==='record-company'||key==='record-visibility'){const r=current();recordOriginal??={...r};r[key==='record-company'?'company':'visibility']=el.value;state.draftDirty=true;}
 if(key==='company-choice'){state.companyChoice=el.value;state.companyDirty=state.companyChoice!==state.defaultCompany;}
 if(key==='retention')state.retention=el.value;
 if(key==='heard-mic')state.heardMic=el.checked;
 if(key==='heard-system')state.heardSystem=el.checked;
 if(key==='environment'){modal('Změnit prostředí?',`<p>Pro přechod na jiný server je potřeba nové přihlášení. Místní nahrávky zůstanou zachované.</p>`,btn('Zrušit','close-modal')+btn('Změnit a odhlásit','environment-confirm','primary','',`data-value="${el.value}"`));return;}
 if(key){render();globalThis.document.querySelector(`[data-field="${key}"]`)?.focus({preventScroll:true});}
});
globalThis.document.addEventListener('keydown',event=>{
 if(event.key==='Escape'){if(!$('.modal-layer').hidden){closeModal();}else if(state.page!=='detail'){menuOpen=false;render();}return;}
 if(!$('.modal-layer').hidden&&event.key==='Tab'){const items=[...$('.sheet').querySelectorAll('button:not(:disabled),input,select,a[href]')];const i=items.indexOf(globalThis.document.activeElement);if(event.shiftKey&&i===0){event.preventDefault();items.at(-1)?.focus();}else if(!event.shiftKey&&i===items.length-1){event.preventDefault();items[0]?.focus();}return;}
 if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();if(!$('.modal-layer').hidden)closeModal();else $('[data-action=quick-actions]')?.click();return;}
 if(!$('.modal-layer').hidden)return;
 if(event.ctrlKey&&event.altKey&&event.key.toLowerCase()==='l'){event.preventDefault();openTray();return;}
 if(event.ctrlKey&&event.altKey&&event.key.toLowerCase()==='r'&&state.phase==='recording'){event.preventDefault();navigate('home');$('[data-action=stop]')?.click();return;}
 if((event.metaKey||event.ctrlKey)&&event.shiftKey&&event.key.toLowerCase()==='r'){event.preventDefault();if(state.page!=='home')navigate('home');if(!$('.modal-layer').hidden)return;$(`[data-action=${state.phase==='recording'?'stop':'start'}]`)?.click();}
 if((event.metaKey||event.ctrlKey)&&event.key===','){event.preventDefault();navigate('settings');}
 if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='f'){event.preventDefault();navigate('library');$('[data-field=search]')?.focus();}
});
globalThis.document.body.innerHTML=`<header class="preview-bar"><div class="preview-label"><strong>${concept.toUpperCase()} · ${concepts[concept][0]}</strong> <span class="muted">Celá aplikace · klikací maketa</span></div><a href="index.html">Porovnat návrhy</a><select class="scenario" aria-label="Ukázková situace">${scenarios.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select><select class="theme-select" aria-label="Téma makety"><option value="light">Světlé</option><option value="professional">Profesionální</option><option value="dark">Tmavé</option></select><button data-action="reset-preview">Reset</button></header><section class="menubar-scene" aria-label="Návrh ovládání z horní lišty"><header class="mac-menubar"><span class="menu-os-brand" aria-hidden="true">◆ &nbsp; LuDone Desktop</span><button class="menubar-trigger" data-action="menu-toggle" aria-label="LuDone v horní liště" aria-expanded="true"><img src="LuDone.svg" alt=""><span class="menu-live-status"></span></button><span class="menu-os-time" aria-hidden="true">Pá 10:32</span></header><section class="menu-popover" aria-label="Panel LuDone"><header class="menu-popover-header"><div class="menu-brand"><img src="LuDone.svg" alt=""><h1 class="menu-popover-title">LuDone</h1></div><div class="popover-actions"><button class="icon-btn" data-action="tray-menu" aria-label="Další možnosti">${icon('settings')}</button><button class="icon-btn" data-action="hide-menu" aria-label="Zavřít panel">${icon('close')}</button></div></header><div class="menu-popover-body"></div><footer class="menu-popover-footer"><button class="menu-tab" data-action="nav" data-page="home" aria-label="Nahrávat">${icon('record')}<span>Nahrávat</span></button><button class="menu-tab" data-action="nav" data-page="library" aria-label="Nahrávky">${icon('library')}<span>Nahrávky</span></button><button class="menu-tab" data-action="nav" data-page="queue" aria-label="Odesílání">${icon('cloud')}<span>Odesílání</span></button><button class="menu-tab" data-action="nav" data-page="settings" aria-label="Nastavení">${icon('settings')}<span>Nastavení</span></button></footer></section></section><div class="desktop-stage"><div class="window"><header class="titlebar"><span class="traffic"><button class="window-close" data-action="tray" aria-label="Zavřít detail a vrátit se do lišty"></button><i></i><i></i></span><div class="app-title"><img src="LuDone.svg" alt=""><span>LuDone Desktop</span></div><div class="window-actions"><button class="icon-btn" data-action="tray" aria-label="Panel v liště" title="Panel v liště">${icon('tray')}</button><button class="icon-btn" data-action="quick-actions" aria-label="Rychlé akce (⌘K)" title="Rychlé akce (⌘K)">${icon('keyboard')}</button></div></header><div class="app-layout"><nav class="app-nav" aria-label="Hlavní navigace"></nav><main class="workspace"><header class="workspace-head menu-page-head"></header><div class="global-notice menu-notice"></div><div class="content menu-content"></div></main></div></div></div><div class="modal-layer" hidden></div><div class="toast" hidden role="status"></div>`;
$('.theme-select').value=globalThis.document.documentElement.dataset.theme;
$('.theme-select').addEventListener('change',event=>{globalThis.document.documentElement.dataset.theme=event.target.value;render();});
$('.scenario').addEventListener('change',event=>applyScenario(event.target.value));
$('[data-action=reset-preview]').addEventListener('click',()=>applyScenario($('.scenario').value));
applyScenario(scenarios.some(([v])=>v===query.get('scenario'))?query.get('scenario'):'ready');
if(state.page==='settings'&&tabs.some(([id])=>id===query.get('tab'))){state.tab=query.get('tab');render();}
globalThis.setInterval(()=>{if(state.phase==='recording'){state.seconds++;globalThis.document.querySelectorAll('[data-live-time]').forEach(el=>el.textContent=clock());}},1000);

// Výslovné sdílené rozhraní návrhu; getter sleduje výměnu scénáře.
globalThis.LuDonePreview = Object.freeze({ get state() { return state; }, icon });

/* Oddělený prezentační hook se volá až po inicializaci fiktivního stavu. */
if(['f','g'].includes(concept)){
 const layoutScript=globalThis.document.createElement('script');layoutScript.src=`sonnet-${concept}-layout.js?v=1`;
 layoutScript.onload=()=>render();globalThis.document.head.append(layoutScript);
}
