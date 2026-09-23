#!/usr/bin/env python3
"""Ověření lokálního prototypu přes existující prohlížeč Orcy, bez instalací."""
import base64, json, pathlib, subprocess, sys
root = pathlib.Path(__file__).resolve().parent
page = sys.argv[1]
evidence = root / 'evidence'
evidence.mkdir(exist_ok=True)
lines=[]
def call(command, *args):
    result = subprocess.run(['orca', command, '--page', page, *args, '--json'],capture_output=True,text=True)
    data=json.loads(result.stdout)
    if result.returncode or not data.get('ok'): raise RuntimeError(data)
    return data['result']
def evaluate(js):
    out=call('eval','--expression','JSON.stringify('+js+')')['result']
    return json.loads(out)
def check(label, ok, detail=''):
    line=('PASS ' if ok else 'FAIL ')+label+(' · '+detail if detail else '')
    print(line,flush=True);lines.append(line)
    if not ok: raise AssertionError(label)
def navigate(s,t,w,h):
    call('goto','--url',root.as_uri()+'/index.html?scenario='+s+'&theme='+t)
    call('exec','--command',f'set viewport {w} {h}')
def click(action):
    return evaluate('(()=>{const b=document.querySelector(\'[data-action="'+action+'"]\');if(!b||b.disabled)return false;b.click();return true})()')
def shot(name):
    data=call('screenshot')['data'];(evidence/name).write_bytes(base64.b64decode(data))
def run():
    for s in ['idle','recording','saved','blocked-company','uploading','retry','settings','update','identity','detail']:
      for t in ['light','professional','dark']:
        w,h=(448,676) if s in ['uploading','retry','settings','identity','detail'] else (366,650)
        navigate(s,t,w,h)
        data=evaluate('({scenario:document.documentElement.dataset.scenario,theme:document.documentElement.dataset.theme,width:innerWidth,height:innerHeight,overflow:document.body.scrollWidth>innerWidth,primaryVisible:[...document.querySelectorAll(".panel-actions button")].every(b=>b.getBoundingClientRect().bottom<=innerHeight),font:document.fonts.check("500 19px Brockmann")})')
        check(f'{s}/{t} {w}×{h}',data['scenario']==s and data['theme']==t and data['width']==w and data['height']==h and not data['overflow'] and data['primaryVisible'] and data['font'],json.dumps(data,ensure_ascii=False))
        shot(f'{s}-{t}-{w}.png')
    navigate('idle','light',366,650)
    check('Oba zdroje bez scrollu při 366×650',evaluate('document.querySelector("main").scrollHeight<=document.querySelector("main").clientHeight+1'))
    check('Nahrát → běžící nahrávání',click('record') and evaluate('document.documentElement.dataset.scenario==="recording"'))
    evaluate('(()=>{const e=document.querySelector("#system-failure");e.checked=true;e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
    check('Výpadek vysvětluje omezení a nabízí opravu',evaluate('document.body.innerText.includes("Druhou stranu teď nezachycujete")&&!!document.querySelector("[data-action=reconnect]")'))
    shot('recording-failure-366.png')
    check('Obnovení systémového zvuku',click('reconnect') and evaluate('!document.querySelector("#system-failure").checked'))
    check('Stop → uložená nahrávka',click('stop') and evaluate('document.documentElement.dataset.scenario==="saved"'))
    check('Uložit a odeslat → Ve frontě',click('send-saved') and evaluate('document.body.innerText.includes("Ve frontě")&&!document.body.innerText.includes("Ověřeno v LuDone")'))
    navigate('blocked-company','professional',366,650)
    check('Chybějící firma blokuje odeslání',evaluate('document.querySelector("[data-action=send-saved]").disabled'))
    evaluate('(()=>{document.querySelector("#company").value="Ateliér Jih";return true})()')
    check('Firma se uloží bez odeslání',click('save-company') and evaluate('document.documentElement.dataset.scenario==="blocked-company"&&!document.querySelector("[data-action=send-saved]").disabled&&document.body.innerText.includes("Žádná nahrávka se tím neodeslala")'))
    check('Odeslání až po druhém výslovném kliku',click('send-saved') and evaluate('document.documentElement.dataset.scenario==="uploading"&&document.body.innerText.includes("Ateliér Jih")'))
    navigate('saved','light',366,650)
    check('Nechat na Macu neodesílá',click('keep') and evaluate('document.body.innerText.includes("Nic se neodeslalo")'))
    navigate('retry','dark',448,676)
    check('Opakování vlastní položky',click('retry-row') and evaluate('!!document.querySelector("[role=progressbar]")'))
    check('Přihlášení má přímou cestu',click('login') and evaluate('document.querySelector("dialog").open'))
    check('Obnova přihlášení',click('confirm-login') and evaluate('document.body.innerText.includes("Přihlášení obnoveno")&&!document.body.innerText.includes("Přihlášení vypršelo")'))
    evaluate('(()=>{document.querySelectorAll(".record-detail")[1].open=true;return true})()')
    evaluate('(()=>{document.querySelector("[data-action=trash][data-id=\\"2\\"]").click();return true})()')
    check('Koš žádá potvrzení konkrétní nahrávky',evaluate('document.querySelector("dialog").open&&document.querySelector("dialog").innerText.includes("Návrh webu")&&document.querySelectorAll(".record-item").length===3'))
    shot('trash-confirmation-448.png')
    check('Zrušení koše data ponechá',click('close-dialog') and evaluate('document.querySelectorAll(".record-item").length===3'))
    navigate('uploading','light',448,676)
    click('demo');click('demo-sent')
    check('Odesláno se nerovná ověřeno',evaluate('!!document.querySelector("[data-action=verify]")&&!document.querySelector("[data-action=open-web]")'))
    check('Ověření zpřístupní otevření',click('verify') and evaluate('!!document.querySelector("[data-action=open-web]")'))
    click('demo');click('demo-owner')
    check('Vlastnictví vyžaduje konkrétní potvrzení',click('takeover') and evaluate('document.querySelector("dialog").innerText.includes("Týdenní domluva")&&document.querySelector("dialog").innerText.includes("Alex Novák")'))
    check('Převzetí samo neodešle',click('confirm-takeover') and evaluate('document.body.innerText.includes("Odeslání je potřeba potvrdit zvlášť")'))
    click('demo');click('demo-limit')
    check('Limit nenabízí předčasné opakování',evaluate('document.querySelector("[data-row=\\"1\\"]").innerText.includes("15:30")&&!document.querySelector("[data-row=\\"1\\"] [data-action=retry-row]")'))
    navigate('settings','light',448,676)
    for tab in ['account','sound','storage','recordings','diagnostics']:
      check('Sekce Nastavení '+tab,evaluate('(()=>{document.querySelector(\'[data-tab="'+tab+'"]\').click();return document.querySelector(\'[data-tab="'+tab+'"]\').getAttribute("aria-current")==="page"&&document.body.scrollWidth===innerWidth})()'))
    navigate('update','professional',366,650)
    evaluate('(()=>{const e=document.querySelector("#update-busy");e.checked=true;e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
    check('Aktualizace během nahrávání čeká',click('install') and evaluate('document.body.innerText.includes("Instalace čeká")&&!!document.querySelector("[data-action=stop]")'))
    click('stop');click('keep')
    check('Odložená instalace až po uložení',evaluate('document.body.innerText.includes("aktualizace by se nyní nainstalovala")'))
    navigate('uploading','light',448,676)
    check('Vstup ze seznamu do detailu',click('detail') and evaluate('document.documentElement.dataset.scenario==="detail"&&document.body.innerText.includes("Na tomto Macu")&&document.body.innerText.includes("V LuDone")'))
    check('Návrat z detailu zachová seznam',click('list-back') and evaluate('document.querySelectorAll(".record-item").length===3'))
    navigate('detail','dark',448,676)
    check('Detail umožní ověřit a otevřít',click('verify') and evaluate('!!document.querySelector("[data-action=open-web]")'))
    navigate('identity','light',448,676)
    check('Ikony Docku 128/64/32/16',evaluate('JSON.stringify([...document.querySelectorAll(".dock-preview img")].map(i=>i.width))==="[128,64,32,16]"'))
    check('Lišta má osm náhledů 18 px',evaluate('document.querySelectorAll(".tray-preview img").length===8&&[...document.querySelectorAll(".tray-preview img")].every(i=>i.width===18&&i.height===18)'))
    check('Ikona otevře panel',click('tray-state') and evaluate('document.documentElement.dataset.scenario==="idle"'))
    navigate('idle','light',366,500)
    check('Hlavní akce při malé výšce 366×500',evaluate('document.querySelector("[data-action=record]").getBoundingClientRect().bottom<innerHeight'))
    navigate('idle','light',366,650)
    evaluate('(()=>{window.dispatchEvent(new MessageEvent("message",{source:null,data:{type:"ludone-design:set",scenario:"retry",theme:"dark"}}));return true})()')
    check('Zpráva od cizího zdroje odmítnuta',evaluate('document.documentElement.dataset.scenario==="idle"'))
    evaluate('(()=>{window.dispatchEvent(new MessageEvent("message",{source:window.parent,data:{type:"ludone-design:set",scenario:"invalid",theme:"dark"}}));return true})()')
    check('Neplatný scénář odmítnut',evaluate('document.documentElement.dataset.scenario==="idle"&&document.documentElement.dataset.theme==="light"'))
    evaluate('(()=>{window.dispatchEvent(new MessageEvent("message",{source:window.parent,data:{type:"ludone-design:set",scenario:"recording",theme:"dark"}}));return true})()')
    check('Platná zpráva přepne scénář a téma',evaluate('document.documentElement.dataset.scenario==="recording"&&document.documentElement.dataset.theme==="dark"'))
    navigate('idle','light',366,650)
    call('snapshot')
    shot('idle-light-366.png')
try:
    run();lines.append('EXIT CODE: 0');code=0
except Exception as error:
    lines.append('FAIL '+str(error));lines.append('EXIT CODE: 1');print(error);code=1
(evidence/'verification.txt').write_text('\n'.join(lines)+'\n')
sys.exit(code)
