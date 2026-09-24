#!/usr/bin/env python3
"""Cílená přejímka opravy výběru firmy a automatiky z nezávislé QA."""
import subprocess,json,pathlib,base64,sys
root=pathlib.Path(__file__).resolve().parent
page=sys.argv[1]
lines=[]
def call(cmd,*args):
 r=subprocess.run(['orca',cmd,'--page',page,*args,'--json'],capture_output=True,text=True)
 d=json.loads(r.stdout)
 if r.returncode or not d.get('ok'):raise RuntimeError(d)
 return d['result']
def ev(js):return json.loads(call('eval','--expression','JSON.stringify('+js+')')['result'])
def click(a):return ev('(()=>{document.querySelector(\'[data-action="'+a+'"]\').click();return true})()')
def check(name,ok):
 line=('PASS ' if ok else 'FAIL ')+name;print(line,flush=True);lines.append(line)
 if not ok:raise AssertionError(name)
def nav(s,t='light',w=448,h=676):
 call('goto','--url',root.as_uri()+'/index.html?scenario='+s+'&theme='+t)
 call('exec','--command',f'set viewport {w} {h}')
def shot(name):
 (root/'evidence'/name).write_bytes(base64.b64decode(call('screenshot')['data']))
try:
 for scenario in ['blocked-company','settings']:
  for theme in ['light','professional','dark']:
   w,h=(366,650) if scenario=='blocked-company' else (448,676)
   nav(scenario,theme,w,h)
   check(f'{scenario}/{theme}: obě firmy jsou skutečné option',ev('JSON.stringify([...document.querySelector("#company").options].map(o=>o.value))===JSON.stringify(["","Studio Sever","Ateliér Jih"])'))
   check(f'{scenario}/{theme}: správná výchozí volba',ev('document.querySelector("#company").value')==('' if scenario=='blocked-company' else 'Studio Sever'))
   shot(f'{scenario}-{theme}-{w}.png')
   before=ev('JSON.stringify(state.rows)')
   ev('(()=>{document.querySelector("#company").value="Studio Sever";return true})()');click('save-company')
   check(f'{scenario}/{theme}: volba Studia Sever neodesílá',ev('JSON.stringify(state.rows)')==before)
 nav('settings')
 before=ev('JSON.stringify(state.rows)')
 ev('(()=>{document.querySelector("[data-tab=sound]").click();const a=document.querySelector("#auto");a.checked=true;a.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
 check('Zapnutí automatiky nemění staré nahrávky',ev('JSON.stringify(state.rows)')==before)
 click('back');click('record');click('stop')
 check('Stop s automatikou vloží právě jednu novou položku',ev('state.rows.length===4&&state.rows[0].status==="queued"&&state.rows[0].company==="Studio Sever"'))
 check('Automatika zachová původní položky beze změny',ev('JSON.stringify(state.rows.slice(1))')==before)
 shot('auto-new-recording-448.png')
 nav('settings')
 ev('(()=>{document.querySelector("[data-tab=sound]").click();const a=document.querySelector("#auto");a.checked=true;a.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
 click('back');click('record');click('stop')
 check('Automatika dává srozumitelný výsledek',ev('document.body.innerText.includes("Staré položky se nezměnily")'))
 nav('settings')
 click('logout');click('confirm-logout')
 ev('(()=>{document.querySelector("[data-tab=sound]").click();const a=document.querySelector("#auto");a.checked=true;a.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
 before=ev('JSON.stringify(state.rows)')
 click('back');click('record');click('stop')
 check('Bez firmy automatika neodešle a nabídne výběr',ev('document.documentElement.dataset.scenario==="blocked-company"&&!!document.querySelector("#company")&&document.querySelector("[data-action=send-saved]").disabled') and ev('JSON.stringify(state.rows)')==before)
 nav('idle','light',366,650)
 snap=call('snapshot');ref=next(k for k,v in snap['refs'].items() if v.get('role')=='button' and v.get('name')=='Nahrát')
 call('focus','--element','@'+ref);call('keypress','--key','Enter')
 check('Klávesnice: Enter spustí nahrávání',ev('document.documentElement.dataset.scenario==="recording"'))
 click('track');click('stop')
 check('Stop ukázkového časovače je dostupný i při ukládání',ev('!!document.querySelector("[data-action=track]")&&!!document.querySelector("#track-time")'))
 nav('retry')
 ev('(()=>{document.querySelectorAll(".record-detail")[1].open=true;document.querySelector(\'[data-action=trash][data-id="2"]\').click();return true})()')
 check('Dialog drží focus uvnitř',ev('document.querySelector("dialog").contains(document.activeElement)'))
 call('keypress','--key','Escape')
 check('Escape zavře potvrzení bez smazání',ev('!document.querySelector("dialog").open&&document.querySelectorAll(".record-item").length===3'))
 nav('idle','light',366,650)
 lines.append('EXIT CODE: 0');code=0
except Exception as e:
 print(e);lines+=['FAIL '+str(e),'EXIT CODE: 1'];code=1
(root/'evidence'/'verification-focused.txt').write_text('\n'.join(lines)+'\n')
sys.exit(code)
