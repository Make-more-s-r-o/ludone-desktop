// Samostatný náhled drží rozměr aplikace také ve velkém prohlížeči.
const params=new URLSearchParams(location.search);
const variant=params.get('variant')==='astra'?'astra':'opus';
const scenarioSelect=document.querySelector('#scenario'),themeSelect=document.querySelector('#theme'),frame=document.querySelector('#preview');
const scenarios=Array.from(scenarioSelect.options,o=>o.value),themes=['light','professional','dark'];
scenarioSelect.value=scenarios.includes(params.get('scenario'))?params.get('scenario'):'idle';
themeSelect.value=themes.includes(params.get('theme'))?params.get('theme'):'light';
document.querySelector('#focus-title').textContent='Návrh '+(variant==='opus'?'A':'B')+' · LuDone pro Mac';
function size(s){frame.style.width=['settings','uploading','retry','identity','detail'].includes(s)?'448px':'366px'}
function load(){const scenario=scenarioSelect.value,theme=themeSelect.value;size(scenario);frame.src='variants/'+variant+'/index.html?'+new URLSearchParams({scenario,theme,preview:Date.now()});history.replaceState(null,'','?'+new URLSearchParams({variant,scenario,theme}));}
scenarioSelect.addEventListener('change',load);themeSelect.addEventListener('change',load);
window.addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.type!=='ludone-design:state')return;if(scenarios.includes(e.data.scenario)){scenarioSelect.value=e.data.scenario;size(e.data.scenario)}if(themes.includes(e.data.theme))themeSelect.value=e.data.theme});load();
