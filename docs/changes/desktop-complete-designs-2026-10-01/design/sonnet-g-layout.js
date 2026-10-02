/* G · Příkaz: prezentační přeskupení. Pouze přesouvá existující uzly, nic nepíše do state. */
(function () {
 const ITEMS = [['home', 'Nahrávání'], ['library', 'Nahrávky'], ['queue', 'Odesílání'], ['settings', 'Nastavení'], ['updates', 'Aktualizace']];
 const TITLES = { home: 'Nahrávání', library: 'Nahrávky', detail: 'Nahrávka', queue: 'Odesílání', settings: 'Nastavení', updates: 'Aktualizace', onboarding: 'Začínáme' };
 const PHASE_TITLES = { recording: 'Nahrává se', finalizing: 'Ukládání', draft: 'Po schůzce' };
 const PENDING = ['queued', 'failed', 'unclaimed', 'rate', 'unknown', 'missing', 'partial'];
 const queueCount = () => (typeof state !== 'undefined' && state.recordings ? state.recordings.filter((r) => PENDING.includes(r.status)).length : 0);

 // Rozbalovací titulek místo trvalé navigace; vytvoří se jednou a při renderu se jen aktualizuje.
 function menu() {
  const popover = document.querySelector('.menu-popover');
  const header = popover?.querySelector('.menu-popover-header');
  if (!header) return;
  let details = popover.querySelector('.g-menu');
  if (!details) {
   details = document.createElement('details');
   details.className = 'g-menu';
   details.innerHTML = `<summary aria-label="Přejít na jinou část LuDone"><img src="LuDone.svg" alt=""><span class="g-title"></span><span class="g-count"></span><span class="g-chev" aria-hidden="true"></span></summary><div class="g-list">${ITEMS.map(([page, label]) => `<button type="button" data-action="nav" data-page="${page}">${label}<span class="g-count"></span></button>`).join('')}</div>`;
   header.after(details);
   if (!window.__luDoneGMenuBound) {
    window.__luDoneGMenuBound = true;
    document.addEventListener('click', (event) => {
     const open = document.querySelector('.g-menu[open]');
     if (open && (event.target.closest('.g-list [data-action=nav]') || !open.contains(event.target))) open.open = false;
    });
    document.addEventListener('keydown', (event) => {
     if (event.key === 'Escape') document.querySelector('.g-menu')?.removeAttribute('open');
    });
   }
  }
  const page = document.body.dataset.page;
  const phase = document.body.dataset.phase;
  details.querySelector('.g-title').textContent = page === 'home' && PHASE_TITLES[phase] ? PHASE_TITLES[phase] : TITLES[page] || 'LuDone';
  const n = queueCount();
  details.querySelector('summary > .g-count').textContent = n && page !== 'queue' ? `${n} čeká` : '';
  // Přístupný název začíná viditelným textem titulku.
  details.querySelector('summary').setAttribute('aria-label', `${details.querySelector('.g-title').textContent}${n && page !== 'queue' ? `, ${n} čeká` : ''}. Přejít na jinou část LuDone`);
  details.querySelectorAll('.g-list button').forEach((button) => {
   const current = page === 'detail' ? 'library' : page;
   if (button.dataset.page === current) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
   button.querySelector('.g-count').textContent = button.dataset.page === 'queue' && n ? String(n) : '';
  });
 }

 // Historie: období a stavy se přesunou do boční fazety, hledání, seznam a stránkování do výsledků.
 function facets() {
  const content = document.querySelector('.content');
  if (!content || content.querySelector('.g-lib')) return;
  const bars = content.querySelectorAll(':scope > .filter-bar');
  if (bars.length < 2) return;
  const search = bars[0].querySelector('.search-field');
  const period = bars[0].querySelector('select');
  const segment = bars[1].querySelector('.segment');
  const count = bars[1].querySelector('.muted');
  const range = content.querySelector(':scope > [data-action=range]');
  const list = content.querySelector(':scope > .history-list');
  const pagination = content.querySelector(':scope > .pagination');
  if (!search || !period || !segment || !list || !pagination) return;
  const caption = (text) => Object.assign(document.createElement('p'), { className: 'g-cap', textContent: text });
  const wrap = document.createElement('div');
  const side = document.createElement('div');
  const results = document.createElement('div');
  wrap.className = 'g-lib';
  side.className = 'g-facets';
  results.className = 'g-results';
  side.append(caption('Období'), period);
  if (range) side.append(range);
  side.append(caption('Stav'), segment);
  if (count) side.append(count);
  results.append(search, list, pagination);
  wrap.append(side, results);
  bars.forEach((bar) => bar.remove());
  // Při nahrávání zůstává live-strip prvním uzlem, aby Zastavit nikdy nespadlo pod seznam.
  const strip = content.querySelector(':scope > .live-strip');
  if (strip) strip.after(wrap); else content.prepend(wrap);
 }

 // Draft: u odesílací akce je vždy napsáno, komu a s jakým přístupem se nahrávka odešle. Jen čte hodnoty z DOM.
 function summary() {
  const aside = document.querySelector('.detail-aside');
  const actions = aside?.querySelector('.detail-actions');
  if (document.body.dataset.phase !== 'draft' || document.body.dataset.page !== 'home' || !actions) return;
  const company = document.querySelector('#target-company');
  const access = document.querySelector('#visibility');
  const label = (select) => (select && select.value ? select.selectedOptions[0].textContent.trim() : '');
  let line = aside.querySelector('.g-to');
  if (!line) {
   line = document.createElement('p');
   line.className = 'g-to';
   line.setAttribute('aria-live', 'polite');
   actions.after(line);
  }
  const name = label(company);
  const how = label(access);
  line.toggleAttribute('data-missing', !name);
  line.replaceChildren(document.createTextNode('Uložit a odeslat: '));
  const strong = document.createElement('b');
  strong.textContent = name || 'firma není vybraná';
  line.append(strong, document.createTextNode(how ? ` · ${how}. Nechat na Macu nic neodešle.` : '. Nechat na Macu nic neodešle.'));
 }

 // Odesláno bez ověření zůstává neutrální; zelený bod smí mít jen text „V LuDone · ověřeno“.
 function verified() {
  document.querySelectorAll('.badge.sent').forEach((b) => b.classList.toggle('is-verified', /^V LuDone · ověřeno/.test(b.textContent.trim())));
 }

 // Fronta: stavový bod podle textu výsledku.
 function tones() {
  document.querySelectorAll('.queue-row').forEach((row) => {
   const text = row.querySelector('p')?.textContent || '';
   row.dataset.tone = /selhal|chybí|není kompletní/.test(text) ? 'error' : /limit|za \d+ minut|Čeká|čeká/.test(text) ? 'warn' : 'run';
  });
 }

 window.applyLuDoneLayout = function () {
  menu();
  facets();
  summary();
  verified();
  tones();
 };
})();
