/* Porovnávací ovladače patří maketě; produkční aplikace se nemění. */
const params = new globalThis.URLSearchParams(globalThis.location.search);
const screens = [
 ['Základní obrazovky',[
  ['ready','Nahrávání'],['recording','Během nahrávání'],['saving','Ukládání souboru'],['save','Po schůzce · uložit a odeslat'],
  ['history','Historie · hledání a období'],['detail','Detail na Macu'],['sent','Detail v LuDone'],['queue','Odesílání'],
  ['settings','Nastavení · Účet'],['audio','Nastavení · Zvuk a zkouška'],['device','Nastavení · Zařízení'],
  ['storage','Nastavení · Ukládání'],['diagnostics','Nastavení · Diagnostika'],['updates','Aktualizace'],
  ['onboarding','První použití'],['tray','Panel v horní liště']
 ]],['Situace a chyby',[
  ['offline','Bez připojení'],['expired','Vypršelé přihlášení'],['unclaimed','Převzetí vlastnictví'],
  ['rate','Limit serveru'],['missing','Chybějící zvuk'],['system-lost','Výpadek zvukového kanálu'],
  ['microphone-only','Jen mikrofon'],['companies-error','Nelze načíst firmy']
 ]]
];
const allScreens = screens.flatMap(([,items])=>items.map(([value])=>value));
let variant = ['a','b','c','d','e','f','g'].includes(params.get('variant')) ? params.get('variant') : 'a';
const view = globalThis.document.querySelector('#view');
const theme = globalThis.document.querySelector('#theme');
const iframe = globalThis.document.querySelector('#prototype');
const size = globalThis.document.querySelector('#size');
const windowSizes = {a:[900,650],b:[1100,720],c:[720,800],d:[760,820],e:[1040,640],f:[860,580],g:[700,540]};
const panelWidths={a:'400',b:'440',c:'390',d:'360',e:'420–480',f:'420–460',g:'380–640'};
const authors={a:'Původní návrh · Mac',b:'Původní návrh · Studio',c:'Původní návrh · Deník',d:'Sonnet 5.5 · Sloupec',e:'Sonnet 5.5 · Kapsle',f:'Sonnet 5.5 · Osa',g:'Sonnet 5.5 · Příkaz'};
size.value=params.get('size')==='equal'?'equal':'native';
function fitWindow(){
 const [width,height]=windowSizes[variant];
 globalThis.document.body.dataset.size=size.value;
 globalThis.document.querySelector('.preview').style.setProperty('--window-width',width+'px');
 globalThis.document.querySelector('.preview').style.setProperty('--window-height',height+'px');
 globalThis.document.querySelector('#dimensions').textContent=size.value==='equal'?'Společný rám':`Panel ${panelWidths[variant]} px · detail ${width} × ${height}`;
}
view.innerHTML = screens.map(([group,items])=>`<optgroup label="${group}">${items.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</optgroup>`).join('');
view.value = allScreens.includes(params.get('scenario')) ? params.get('scenario') : 'ready';
if(['audio','device','storage','diagnostics'].includes(params.get('tab')))view.value=params.get('tab');
theme.value = ['light','dark','professional'].includes(params.get('theme')) ? params.get('theme') : 'light';
function show(){
 fitWindow();
 const tab = ['audio','device','storage','diagnostics'].includes(view.value) ? view.value : null;
 const url = new globalThis.URL('app.html',globalThis.location.href);
 url.searchParams.set('variant',variant);
 url.searchParams.set('scenario',tab?'settings':view.value);
 url.searchParams.set('theme',theme.value);
 if(variant==='f')url.searchParams.set('revision','tray-20261005');
 if(params.get('icons')==='original')url.searchParams.set('icons','original');
 if(tab)url.searchParams.set('tab',tab);
 globalThis.document.querySelector('#standalone').href=url.href;
 url.searchParams.set('embedded','1');
 iframe.src=url.href;
 globalThis.document.body.dataset.theme=theme.value;
 globalThis.document.querySelectorAll('[data-variant]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.variant===variant)));
 globalThis.document.querySelector('#author').textContent=authors[variant]+(variant==='f'&&params.get('icons')!=='original'?' · ikony Codex':'');
 globalThis.document.querySelector('#f-icons-link').hidden=variant!=='f';
 globalThis.document.title=`LuDone · ${variant.toUpperCase()} · ${view.selectedOptions[0].textContent}`;
}
globalThis.document.querySelectorAll('[data-variant]').forEach(button=>button.addEventListener('click',()=>{variant=button.dataset.variant;show();}));
view.addEventListener('change',show);
theme.addEventListener('change',show);
size.addEventListener('change',fitWindow);
show();
