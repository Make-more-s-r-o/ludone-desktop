import {createRequire} from "node:module";
import {mkdtemp,rm,stat} from "node:fs/promises";
import {spawn} from "node:child_process";
import {tmpdir} from "node:os";
import path from "node:path";
const require=createRequire(import.meta.url);
const {convertToStereoMp3}=require("/Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/stereo-encoder/electron/media-encoder.cjs");
const dir=await mkdtemp(path.join(tmpdir(),"ludone-hour-synthetic-"));
const input=path.join(dir,"hour.webm"), outputPath=path.join(dir,"hour.mp3");
function run(exe,args){return new Promise((resolve,reject)=>{const c=spawn(exe,args,{stdio:["ignore","inherit","inherit"]});c.on("error",reject);c.on("exit",code=>code===0?resolve():reject(new Error(`exit ${code}`)));});}
try {
 await run("/Users/dan/.local/bin/ffmpeg",["-hide_banner","-nostdin","-nostats","-loglevel","error","-n","-f","lavfi","-i","sine=frequency=440:sample_rate=48000:duration=3600","-f","lavfi","-i","sine=frequency=880:sample_rate=48000:duration=3600","-filter_complex","[0:a][1:a]join=inputs=2:channel_layout=stereo:map=0.0-FL|1.0-FR[a]","-map","[a]","-c:a","libopus","-b:a","96k",input]);
 console.log("PASS vytvořen hodinový syntetický stereo vstup");
 const start=performance.now(); await convertToStereoMp3({stereoWebmPath:input,outputPath});
 console.log(JSON.stringify({conversionSeconds:(performance.now()-start)/1000,mp3Bytes:(await stat(outputPath)).size}));
 await run("/Users/dan/.local/bin/ffprobe",["-v","error","-show_entries","format=duration:stream=codec_name,channels,sample_rate","-of","json",outputPath]);
 await run("/Users/dan/.local/bin/ffmpeg",["-hide_banner","-nostdin","-nostats","-loglevel","error","-xerror","-i",outputPath,"-f","null","-"]);
 console.log("PASS celý hodinový MP3 se dekóduje bez chyby; nejde o živou schůzku");
} finally {await rm(dir,{recursive:true,force:true});}
