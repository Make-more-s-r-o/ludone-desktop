from pathlib import Path
import subprocess, json, hashlib, ctypes
ROOT=Path('/Users/dev_ludone/orca/workspaces/ludone-desktop/issue-179-velikost')
OUT=Path(__file__).resolve().parent
commands=[]
def run(args):
    r=subprocess.run([str(a) for a in args],stdin=subprocess.DEVNULL,capture_output=True,timeout=120)
    commands.append({'argv':[str(a) for a in args], 'exit_code':r.returncode, 'stderr':r.stderr.decode(errors='replace')})
    (OUT/'prikazy.json').write_text(json.dumps(commands,ensure_ascii=False,indent=2))
    if r.returncode: raise RuntimeError(r.stderr.decode(errors='replace'))
    return r.stdout
FF=['/opt/homebrew/bin/ffmpeg','-nostdin','-hide_banner','-loglevel','error','-n']
def probe(p):
    return json.loads(run(['/opt/homebrew/bin/ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_name,sample_rate,channels','-of','json',p]))
ref=ROOT/'dukazy/meet-2026-09-01/referencni.aiff'
assert float(probe(ref)['format']['duration'])>28
# Opakovaná syntetická řeč; v každé půlminutě mluví mikrofon 0–18 s,
# systém 12–27 s, obě strany 12–18 s, pauza obou 27–30 s. Vpravo posun 7 s.
filters=("[0:a]aresample=48000,asplit=2[a][b];"
"[a]volume='if(lt(mod(t,30),18),0.7,0)':eval=frame[m];"
"[b]adelay=7000,volume='if(between(mod(t,30),12,27),0.55,0)':eval=frame[s];"
"[m][s]join=inputs=2:channel_layout=stereo[v];"
"anoisesrc=color=pink:amplitude=0.002:sample_rate=48000:duration=180:seed=179[n1];"
"anoisesrc=color=pink:amplitude=0.002:sample_rate=48000:duration=180:seed=180[n2];"
"[n1][n2]join=inputs=2:channel_layout=stereo[n];"
"[v][n]amix=inputs=2:normalize=0[out]")
run(FF+['-stream_loop','-1','-i',ref,'-filter_complex',filters,'-map','[out]','-t','180','-c:a','pcm_s16le',OUT/'reference-180s.wav'])
run(FF+['-ss','30','-i',OUT/'reference-180s.wav','-t','60','-c:a','pcm_s16le',OUT/'reference-60s.wav'])
files={}
def encode(name,source,bitrate,channels,af=None,rate=48000):
    p=OUT/name
    args=FF+['-i',source]
    if af: args+=['-af',af]
    # WebM/Opus VBR; 60 ms paket je aproximace starších Chromium důkazů,
    # aplikace explicitně délku rámce nenastavuje.
    args+=['-vn','-c:a','libopus','-b:a',str(bitrate)+'k','-vbr','on','-application','audio','-frame_duration','60','-ar',str(rate),'-ac',str(channels),'-map_metadata','-1','-f','webm',p]
    run(args)
    return p
for kb in [96,64,48]:
    for seconds in [180,60]:
        master=encode(f'master-{kb}kbps-{seconds}s.webm',OUT/f'reference-{seconds}s.wav',kb,2)
        dest=OUT/f'poslech-{kb}kbps-60s.webm' if seconds==60 else OUT/f'upload-{kb}kbps-180s.webm'
        # Produkční funkce určuje remux přímo z kódu, jen binárka je místní.
        js='const m=require(process.argv[1]);process.stdout.write(JSON.stringify(m.conversionArguments({stereoWebmPath:process.argv[2],temporaryPath:process.argv[3]})));'
        args=json.loads(run(['node','-e',js,ROOT/'electron/media-encoder.cjs',master,dest]))
        run(['/opt/homebrew/bin/ffmpeg']+args)
        files[f'upload_{kb}_{seconds}']=dest
        if seconds==180: files[f'master_{kb}']=master
files['original_mic_128']=encode('original-mic-128kbps-180s.webm',OUT/'reference-180s.wav',128,1,'pan=mono|c0=c0')
files['original_system_128']=encode('original-system-128kbps-180s.webm',OUT/'reference-180s.wav',128,2,'pan=stereo|c0=c1|c1=c1')
# Pouze výzkumná varianta: mono ruší smluvené mapování účastníků L/R.
for seconds in [180,60]:
    files[f'mono48_{seconds}']=encode(f'mono-16khz-48kbps-{seconds}s.webm',OUT/f'reference-{seconds}s.wav',48,1,rate=16000)
results={}
for name,p in files.items():
    info=probe(p)
    raw=run(FF[:-1]+['-i',p,'-map','0:a:0','-f','s16le','-'])
    stream=info['streams'][0]
    decoded_seconds=len(raw)/(2*int(stream['sample_rate'])*stream['channels'])
    intended=60 if name.endswith('_60') else 180
    assert abs(decoded_seconds-intended)<0.05,(name,decoded_seconds)
    results[name]={'path':str(p),'bytes':p.stat().st_size,'duration_source_s':intended,'duration_decoded_s':decoded_seconds,'mb_h':p.stat().st_size/1_000_000*3600/intended,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'probe':info}
    print(name,results[name]['bytes'],round(results[name]['mb_h'],5),flush=True)
# Kontrola, že remux zachoval audio pakety (není druhé ztrátové kódování).
for kb in [96,64,48]:
    streams=[]
    for key in [f'master_{kb}',f'upload_{kb}_180']:
        streams.append(run(FF[:-1]+['-i',files[key],'-map','0:a:0','-c:a','copy','-f','data','-']))
    assert streams[0]==streams[1],kb
lib=ctypes.CDLL('/opt/homebrew/lib/libopus.dylib'); lib.opus_get_version_string.restype=ctypes.c_char_p
summary={'ffmpeg':run(['/opt/homebrew/bin/ffmpeg','-version']).decode().splitlines()[0], 'libopus':lib.opus_get_version_string().decode(), 'source_sha256':hashlib.sha256(ref.read_bytes()).hexdigest(), 'files':results}
a=results['original_mic_128']['mb_h']+results['original_system_128']['mb_h']
summary['totals']={'originals_mb_h':a}
for kb in [96,64,48]:
    m=results[f'master_{kb}']['mb_h']; u=results[f'upload_{kb}_180']['mb_h']
    summary['totals'][str(kb)]={'today_with_download':a+m+2*u,'without_download_before_upload':a+m+u,'without_download_after_verified_upload_and_master_release':a+u}
(OUT/'vysledky.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
print(json.dumps(summary['totals'],indent=2))
print('PASS vzorky, délky, velikosti a shoda paketů remuxu; exit 0')
