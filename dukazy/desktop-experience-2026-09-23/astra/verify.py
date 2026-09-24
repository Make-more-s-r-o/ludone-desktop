"""Ověření výhradně lokálního HTML přes vlastní kartu Orca; bez instalací."""
import base64,json,pathlib,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parent.parent
PAGE=sys.argv[1]
LOG=[]
def call(*args):
    p=subprocess.run(['orca',*args,'--page',PAGE,'--json'],capture_output=True,text=True)
    d=json.loads(p.stdout)
    if p.returncode or not d.get('ok'): raise RuntimeError(str(d))
    return d['result']
def evaluate(js):
    return call('eval','--expression',js)['result']
def line(s):
    print(s,flush=True);LOG.append(s)
def main():
    check=subprocess.run(['node','--check',str(ROOT/'app.js')],capture_output=True,text=True)
    line('COMMAND node --check app.js\n'+check.stdout+check.stderr+'EXIT '+str(check.returncode))
    if check.returncode:raise RuntimeError('Syntaxe')
    scenarios=json.loads((ROOT/'manifest.json').read_text())['scenarios']
    for theme in ['light','professional','dark']:
        for s in scenarios:
            wide=s in ['day','detail','attention','settings','identity']
            call('goto','--url',ROOT.as_uri()+'/index.html?scenario='+s+'&theme='+theme)
            call('exec','--command','set viewport '+('640 744' if wide else '400 700'))
            result=evaluate("JSON.stringify({scenario:document.documentElement.dataset.scenario,theme:document.documentElement.dataset.theme,viewport:[innerWidth,innerHeight],content:document.querySelector('.content').textContent.length,overflow:document.documentElement.scrollWidth>innerWidth||document.querySelector('.content').scrollWidth>document.querySelector('.content').clientWidth,heading:document.querySelectorAll('h1').length})")
            result=json.loads(result)
            assert result['scenario']==s and result['theme']==theme and result['content']>80 and not result['overflow'],result
            assert result['viewport']==([640,744] if wide else [400,700]),result
            line('PASS direct '+s+' / '+theme+' / no horizontal overflow')
            if (theme=='light' and s in ['home','meeting','save','day']) or (theme=='dark' and s=='meeting'):
                shot=call('screenshot');(ROOT/'evidence'/(s+('-dark' if theme=='dark' else '')+'.png')).write_bytes(base64.b64decode(shot['data']))
    call('exec','--command','set viewport 400 700')
    call('goto','--url',ROOT.as_uri()+'/index.html')
    results=evaluate((ROOT/'evidence/flows.js').read_text())
    if isinstance(results,str):results=json.loads(results)
    for text in results['passed']:line(text)
    line('PASS flows: '+str(results['checks'])+' assertions')
    line('EXIT 0')
try:main()
except Exception as e:
    line('FAIL '+str(e));line('EXIT 1');sys.exit(1)
finally:(ROOT/'evidence/verification.txt').write_text('\n'.join(LOG)+'\n')
