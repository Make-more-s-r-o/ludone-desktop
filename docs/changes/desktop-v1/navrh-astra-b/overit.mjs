// Akceptace samostatného návrhu. Neměří produkční aplikaci ani skutečnou geometrii.
// Spuštění z kořene repozitáře: node docs/changes/desktop-v1/navrh-astra-b/overit.mjs
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const base = new URL('./', import.meta.url);
const html = readFileSync(new URL('nahled.html', base), 'utf8');
const original = new JSDOM(readFileSync(new URL('../navrh-astra/nahled.html', base), 'utf8'));
const errors = [];
const consoleCapture = new VirtualConsole();
consoleCapture.on('jsdomError', error => errors.push(error.message));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: new URL('nahled.html', base).href,
  pretendToBeVisual: true, virtualConsole: consoleCapture,
});
const w = dom.window, d = w.document;
let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}
const states = [...d.querySelectorAll('[data-state]')];
const previous = [...original.window.document.querySelectorAll('[data-state]')].map(el => el.dataset.state);
check('Stejných 34 stavů a stejné pořadí jako Astra A',
  states.length === 34 && JSON.stringify(states.map(el => el.dataset.state)) === JSON.stringify(previous));
check('24 panelů/menu a 10 ukázek ikony',
  d.querySelectorAll('.panel').length === 24 && d.querySelectorAll('.tray-specimen').length === 10);
check('Každý stav má vlastní vysvětlení', states.every(el =>
  (el.querySelector('.rationale') || el.querySelector('p'))?.textContent.trim().length > 30));
check('České samostatné HTML', d.documentElement.lang === 'cs' && !!d.querySelector('meta[charset]'));
check('Všechny panely mají 366 px a border-box podle CSS', [...d.querySelectorAll('.panel')].every(el => {
  const css = w.getComputedStyle(el);
  return css.width === '366px' && css.boxSizing === 'border-box';
}), 'JSDOM nevykresluje; toto není měření skutečné šířky');
const ids = [...d.querySelectorAll('[id]')].map(el => el.id);
check('Identifikátory jsou jedinečné', ids.length === new Set(ids).size);
check('Všechny odkazy vedou na existující místní cíle', [...d.querySelectorAll('a[href]')].every(el => {
  const href = el.getAttribute('href');
  return href.startsWith('#') && d.getElementById(href.slice(1));
}));
check('Každý formulářový prvek má popisek', [...d.querySelectorAll('input,select')].every(el =>
  el.getAttribute('aria-label') || el.closest('label') || d.querySelector(`label[for="${el.id}"]`)));
check('Žádné externí zdroje ani síťové akce',
  !d.querySelector('[src],[srcset],link[href],iframe,object,embed') &&
  !/@import|url\s*\(/i.test(d.querySelector('style').textContent) &&
  !/(fetch|XMLHttpRequest|WebSocket|getUserMedia|getDisplayMedia)\s*\(/.test(d.querySelector('script').textContent));
check('CSP zakazuje připojení i odeslání formuláře',
  d.querySelector('[http-equiv="Content-Security-Policy"]').content.includes("connect-src 'none'") &&
  d.querySelector('[http-equiv="Content-Security-Policy"]').content.includes("form-action 'none'"));
for (const theme of ['dark', 'light']) {
  d.querySelector(`[data-theme-choice="${theme}"]`).click();
  check(`Přepnutí motivu ${theme}`, d.documentElement.dataset.theme === theme &&
    d.querySelectorAll('[data-theme-choice][aria-pressed="true"]').length === 1);
}
check('Deset ikon na obou pozadích', d.querySelectorAll('.tray-test.light-bar').length === 10 &&
  d.querySelectorAll('.tray-test.dark-bar').length === 10);
const concurrency = d.querySelector('#soubeh .split');
check('Souběh má dva sloupce s vlastními konci',
  concurrency.children.length === 2 && w.getComputedStyle(concurrency).gridTemplateColumns === '1fr 1fr' &&
  concurrency.children[0].querySelector('a[href="#zastaveno"]') &&
  concurrency.children[1].querySelector('a[href="#cas-zastaven"]'));
check('Mikrofon a systém ve správném pořadí', [...d.querySelectorAll('.meters')].every(el =>
  /L\s*Mikrofon/.test(el.children[0].textContent) && /P\s*Systém/.test(el.children[1].textContent)));
check('Přijatý mikrofon a neočekávaný výpadek se neslévají',
  d.querySelector('#mikrofon .missing').textContent.includes('Nezapojen') &&
  d.querySelector('#vypadek .missing').textContent.includes('Vypadl') &&
  d.querySelector('#vypadek .notice').textContent.includes('Nahrávání pokračuje'));
check('Fronta obsahuje pouze dvě čekající nahrávky a jeden místní čas',
  d.querySelectorAll('#fronta .queue-row').length === 3 &&
  d.querySelectorAll('#fronta .queue-row a').length === 2 &&
  d.querySelector('#fronta').textContent.includes('Automatické odesílání je vypnuté'));
check('Lokální omezení času je vidět před startem i za běhu',
  d.querySelector('#klid .lane[aria-label="Měření času"]').textContent.includes('Čas se do výkazu neodesílá') &&
  d.querySelector('#soubeh .lane[aria-label="Měření času"]').textContent.includes('Do výkazu se neodesílá'));
const dock = d.querySelector('[data-dock]');
check('Dock je výchozí vypnutý', [...d.querySelectorAll('[data-dock]')].every(el => !el.checked));
dock.checked = true; dock.dispatchEvent(new w.Event('change'));
check('Změna Docku se promítne do všech ukázek', [...d.querySelectorAll('[data-dock]')].every(el => el.checked) &&
  d.querySelector('[data-dock-preview]').classList.contains('enabled'));
const name = d.querySelector('#recording-name');
name.value = '<Porada & plán>'; name.dispatchEvent(new w.Event('input'));
check('Název se přenáší jako prostý text',
  d.querySelector('[data-export-name]').textContent === '<Porada & plán> · zvukový soubor' &&
  d.querySelector('[data-export-name]').children.length === 0);
name.value = 'x'.repeat(501); name.dispatchEvent(new w.Event('input'));
const tooLongClick = new w.MouseEvent('click', { bubbles: true, cancelable: true });
d.querySelector('#prepare-export').dispatchEvent(tooLongClick);
check('Příliš dlouhý název neprojde do exportu', tooLongClick.defaultPrevented &&
  !d.querySelector('#name-error').hidden && name.getAttribute('aria-invalid') === 'true');
name.value = ' '.repeat(3) + 'x'.repeat(500) + ' '; name.dispatchEvent(new w.Event('input'));
check('500 jednotek po trim je přípustných', d.querySelector('#name-error').hidden && name.getAttribute('aria-invalid') === 'false');
name.value = 'LuDone Desktop'; name.dispatchEvent(new w.Event('input'));
const heard = d.querySelector('#heard-test');
heard.checked = false; heard.dispatchEvent(new w.Event('change'));
const noHearingClick = new w.MouseEvent('click', { bubbles: true, cancelable: true });
d.querySelector('#finish-test').dispatchEvent(noHearingClick);
check('Dokončení zkoušky vyžaduje potvrzený poslech', noHearingClick.defaultPrevented &&
  d.querySelector('#finish-test').getAttribute('aria-disabled') === 'true');
heard.checked = true; heard.dispatchEvent(new w.Event('change'));
check('Potvrzení poslechu znovu zpřístupní dokončení', d.querySelector('#finish-test').getAttribute('aria-disabled') === 'false');
const demo = d.querySelector('[data-demo]'); demo.click();
check('Ukázková akce má vysvětlení', !d.querySelector('.toast').hidden && d.querySelector('#demo-message').textContent.length > 20);
d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
check('Escape zavře vysvětlení a vrátí focus', d.querySelector('.toast').hidden && d.activeElement === demo);
let callback, delay;
w.setTimeout = (fn, ms) => { callback = fn; delay = ms; return 17; };
w.location.hash = 'zastaveno'; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
check('Nabídka zastavení času má limit 10 sekund', delay === 10000 && typeof callback === 'function');
callback();
check('Po limitu je stále přístupné zastavení běžícího času',
  d.querySelector('[data-auto-offer]').hidden &&
  !!d.querySelector('#zastaveno .livebar a[href="#cas-zastaven"]'));
check('Viditelný focus a respektování omezení pohybu', html.includes(':focus-visible') && html.includes('prefers-reduced-motion:reduce'));
function luminance(hex) {
  const values = hex.trim().slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}
for (const [index, theme] of ['světlý', 'tmavý'].entries()) {
  const css = d.styleSheets[0].cssRules[index].style;
  const pairs = [['--ink', '--paper'], ['--dim', '--page'], ['--dim', '--soft'],
    ['--dim', '--paper'], ['--dim', '--rec-tint'], ['--dim', '--time-tint'], ['--dim', '--warn-tint'],
    ['--rec', '--paper'], ['--rec', '--rec-tint'], ['--time', '--paper'], ['--time', '--time-tint'],
    ['--warn', '--warn-tint'], ['--action-ink', '--action']];
  const values = pairs.map(([a, b]) => contrast(css.getPropertyValue(a), css.getPropertyValue(b)));
  check(`Kontrast deklarovaných barev textu: ${theme}`, values.every(value => value >= 4.5),
    `minimum ${Math.min(...values).toFixed(2)} : 1`);
}
const why = readFileSync(new URL('PROC.md', base), 'utf8');
check('Stručné zdůvodnění s přínosy, cenou a přednostmi A', why.split(/\s+/).length <= 750 &&
  why.includes('Co první návrh dělá líp') && why.includes('Co ztratí') && why.includes('Nejistoty a rozpory'),
  `${why.split(/\s+/).length} slov; Markdown nemá pevné stránkování`);
check('Žádné chyby skriptu v JSDOM', errors.length === 0, errors.join('; '));
console.log('OMEZENÍ: ⛔ neověřeno — skutečné vykreslení, geometrie, nativní interakce a zvuk.');
console.log('OMEZENÍ: Toto je kontrola návrhu, nikoli ui-smoke nebo audio-smoke aplikace.');
dom.window.close(); original.window.close();
process.exitCode = failures ? 1 : 0;
