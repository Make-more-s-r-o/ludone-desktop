import console from 'node:console';
import { updateStatus } from '/Users/dan/.claude/skills/masterplan/scripts/mp-status.mjs';
import { readFileSync } from 'node:fs';
const repoRoot='/Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/desktop-astra-parity';
const id='desktop-astra-parity-0-1-6';
const intent=readFileSync(`${repoRoot}/docs/changes/${id}/intent.md`,'utf8');
const section=(title)=>intent.split(`## ${title}\n`)[1].split('\n## ')[0].trim();
// Exportovaná transakce mp-status zachovává validaci, odvozené stavy i render hubu.
// CLI nemá operaci pro opravu kontextu projektu či přejmenování ID obrazovky.
const result=updateStatus({id,repoRoot},status=>{
 status.project.problem=section('Problém');
 status.project.targetOutcome=section('Cílový výsledek');
 status.project.audiences=['Dan na Macu'];
 status.project.outOfScope=['Backend a app.ludone.cz','Funkční LuTrack','Cizí design/'];
 for(const screen of status.screens){if(/^\d+$/.test(screen.id))screen.id=`screen-${screen.id}`;}
 return {changeText:'Kontext projektu převzat ze záměru; ID obrazovek sjednocena s normalizací manifestu přes exportovanou transakci mp-status. Schvalovací metadata se nemění.'};
});
console.log(JSON.stringify(result));
