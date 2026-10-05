/* Společný výběr situace mění pouze makety v porovnání. */
const screens=[['ready','Připraveno'],['recording','Nahrávání'],['save','Po schůzce'],['history','Historie'],['detail','Detail na Macu'],['sent','Detail v LuDone'],['queue','Odesílání'],['settings','Účet'],['audio','Zvuk a zkouška'],['device','Zařízení'],['storage','Ukládání'],['diagnostics','Diagnostika'],['updates','Aktualizace'],['onboarding','První použití'],['tray','Panel v liště'],['offline','Bez sítě'],['expired','Vypršelé přihlášení'],['unclaimed','Převzetí vlastníka'],['rate','Limit serveru'],['missing','Soubor chybí'],['system-lost','Výpadek kanálu'],['microphone-only','Jen mikrofon'],['companies-error','Chyba firem']];
const params=new URLSearchParams(location.search),view=document.querySelector('#view'),theme=document.querySelector('#theme');
view.innerHTML=screens.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');view.value=screens.some(([v])=>v===params.get('scenario'))?params.get('scenario'):'ready';
theme.value=['light','dark','professional'].includes(params.get('theme'))?params.get('theme'):'light';
function show(){
 document.body.dataset.theme=theme.value;
 for(const variant of ['f','g']){
  const tab=['audio','device','storage','diagnostics'].includes(view.value)?view.value:null;
  const qs=new URLSearchParams({variant,scenario:tab?'settings':view.value,theme:theme.value,embedded:'1'});
  if(variant==='f')qs.set('revision','icons-20261005');
  if(tab)qs.set('tab',tab);
  document.querySelector(`#${variant}-frame`).src='app.html?'+qs;
  document.querySelector(`#${variant}-link`).href=`viewer.html?variant=${variant}&scenario=${view.value}&theme=${theme.value}`;
 }
}
view.addEventListener('change',show);theme.addEventListener('change',show);show();
