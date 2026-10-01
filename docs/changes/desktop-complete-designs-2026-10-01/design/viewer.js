/* Porovnávací ovladače patří maketě; produkční aplikace se nemění. */
const params = new URLSearchParams(location.search);
const screens = [
 ['Základní obrazovky',[
  ['ready','Nahrávání'],['recording','Během nahrávání'],['save','Po schůzce · uložit a odeslat'],
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
let variant = ['a','b','c'].includes(params.get('variant')) ? params.get('variant') : 'a';
const view = document.querySelector('#view');
const theme = document.querySelector('#theme');
const iframe = document.querySelector('#prototype');
const size = document.querySelector('#size');
const windowSizes = {a:[900,650],b:[1100,720],c:[720,800]};
size.value=params.get('size')==='equal'?'equal':'native';
function fitWindow(){
 const [width,height]=windowSizes[variant];
 document.body.dataset.size=size.value;
 document.querySelector('.preview').style.setProperty('--window-width',width+'px');
 document.querySelector('.preview').style.setProperty('--window-height',height+'px');
 document.querySelector('#dimensions').textContent=size.value==='equal'?'Společný rám':`${width} × ${height}`;
}
view.innerHTML = screens.map(([group,items])=>`<optgroup label="${group}">${items.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</optgroup>`).join('');
view.value = allScreens.includes(params.get('scenario')) ? params.get('scenario') : 'ready';
if(['audio','device','storage','diagnostics'].includes(params.get('tab')))view.value=params.get('tab');
theme.value = ['light','dark','professional'].includes(params.get('theme')) ? params.get('theme') : 'light';
function show(){
 fitWindow();
 const tab = ['audio','device','storage','diagnostics'].includes(view.value) ? view.value : null;
 const url = new URL('app.html',location.href);
 url.searchParams.set('variant',variant);
 url.searchParams.set('scenario',tab?'settings':view.value);
 url.searchParams.set('theme',theme.value);
 if(tab)url.searchParams.set('tab',tab);
 document.querySelector('#standalone').href=url.href;
 url.searchParams.set('embedded','1');
 iframe.src=url.href;
 document.body.dataset.theme=theme.value;
 document.querySelectorAll('[data-variant]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.variant===variant)));
 document.title=`LuDone · ${variant.toUpperCase()} · ${view.selectedOptions[0].textContent}`;
}
document.querySelectorAll('[data-variant]').forEach(button=>button.addEventListener('click',()=>{variant=button.dataset.variant;show();}));
view.addEventListener('change',show);
theme.addEventListener('change',show);
size.addEventListener('change',fitWindow);
show();
