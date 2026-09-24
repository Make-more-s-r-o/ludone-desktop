/* Náhradní běh při timeoutu Orcy, s již nainstalovaným místním Playwrightem. */
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('/Users/dan/Dev/ClaudeCode/LuDone/ludone-app/node_modules/@playwright/test');
const root=path.resolve(__dirname,'..'),lines=[];
const print=s=>{lines.push(s);console.log(s)};
(async()=>{
 let browser;
 try{
 print('COMMAND node evidence/verify-local.cjs');
 browser=await chromium.launch({headless:true,executablePath:'/Users/dan/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=pathToFileURL(path.join(root,'index.html')).href;
 for(const theme of ['light','professional','dark'])for(const scenario of JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).scenarios){
 const wide=['day','detail','attention','settings','identity'].includes(scenario);
 await page.setViewportSize({width:wide?640:400,height:wide?744:700});
 await page.goto(url+'?scenario='+scenario+'&theme='+theme);
 await page.evaluate(()=>document.fonts.ready);
 const ok=await page.evaluate(({scenario,theme})=>document.documentElement.dataset.scenario===scenario&&document.documentElement.dataset.theme===theme&&document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.content').scrollWidth<=document.querySelector('.content').clientWidth,{scenario,theme});
 if(!ok)throw Error('Scénář / overflow '+scenario+' '+theme);
 print('PASS direct '+scenario+' / '+theme+' / no horizontal overflow');
 if(theme==='light'&&['home','meeting','save','day'].includes(scenario)||theme==='dark'&&scenario==='meeting')await page.screenshot({path:path.join(root,'evidence',scenario+(theme==='dark'?'-dark':'')+'.png')});
 }
 const checks=await page.evaluate(fs.readFileSync(path.join(__dirname,'flows.js'),'utf8'));
 checks.passed.forEach(print);print('PASS flows: '+checks.checks+' assertions');
 if(errors.length)throw Error(errors.join('\n'));print('PASS browser console: no page errors');
 print('EXIT 0');
 }catch(e){print('FAIL '+e.stack);print('EXIT 1');process.exitCode=1;}finally{if(browser)await browser.close();fs.writeFileSync(path.join(__dirname,'verification.txt'),lines.join('\n')+'\n');}
})();
