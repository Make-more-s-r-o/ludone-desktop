from pathlib import Path
import json, hashlib, math, subprocess
p=Path(__file__).resolve().parent
d=json.loads((p/'vysledky.json').read_text())
for k,f in d['files'].items():
    a=Path(f['path']); assert a.is_file() and a.stat().st_size==f['bytes'],k
    assert hashlib.sha256(a.read_bytes()).hexdigest()==f['sha256'],k
print('PASS všech 13 měřených souborů existuje; bajty i SHA-256 souhlasí')
for f in d['files'].values():
    assert math.isclose(f['mb_h'],f['bytes']*3600/f['duration_source_s']/1e6,abs_tol=1e-10)
    assert math.isclose(f['duration_decoded_s'],f['duration_source_s'],abs_tol=.05)
print('PASS přepočet MB/h ze skutečných velikostí a dekódované délky 180/60 s')
for kb,expected in [(96,667387),(64,436819),(48,331088)]:
    a=p/f'poslech-{kb}kbps-60s.webm'; assert a.stat().st_size==expected
    r=subprocess.run(['/opt/homebrew/bin/ffprobe','-v','error','-show_entries','format=duration:stream=channels,codec_name,sample_rate','-of','json',str(a)],stdin=subprocess.DEVNULL,capture_output=True,timeout=15,check=True)
    info=json.loads(r.stdout); s=info['streams'][0]
    assert s['codec_name']=='opus' and s['channels']==2 and s['sample_rate']=='48000'
    assert abs(float(info['format']['duration'])-60)<.05
print('PASS tři poslechové varianty: správné velikosti, WebM/Opus stereo 48 kHz, stejná minuta')
o=d['files']['original_mic_128']['mb_h']+d['files']['original_system_128']['mb_h']
for kb in [96,64,48]:
    m=d['files'][f'master_{kb}']['mb_h']; u=d['files'][f'upload_{kb}_180']['mb_h']; t=d['totals'][str(kb)]
    assert math.isclose(t['today_with_download'],o+m+2*u,abs_tol=1e-10)
    assert math.isclose(t['without_download_before_upload'],o+m+u,abs_tol=1e-10)
    assert math.isclose(t['without_download_after_verified_upload_and_master_release'],o+u,abs_tol=1e-10)
print('PASS součty všech audio kopií dnes a ve třech variantách návrhu')
commands=json.loads((p/'prikazy.json').read_text()); assert all(c['exit_code']==0 for c in commands)
print('PASS všechny uložené příkazy měření mají exit 0; shoda Opus paketů kontrolována v mereni.py')
print('🧪 Simulace a výpočty prošly; ⛔ živá aplikace, poslech a Gemini přepis neověřeny')
