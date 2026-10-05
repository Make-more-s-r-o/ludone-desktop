/* F · Osa: prezentační přeskupení. Pouze přesouvá existující uzly, nic nepíše do state. */
(function () {
 const NAV = [['home', 'Nahrávání', 'record'], ['library', 'Nahrávky', 'library'], ['queue', 'Odesílání', 'cloud'], ['settings', 'Nastavení', 'settings'], ['updates', 'Aktualizace', 'update']];
 const PENDING = ['queued', 'failed', 'unclaimed', 'rate', 'unknown', 'missing', 'partial'];
 const glyph = (name) => (typeof icon === 'function' ? globalThis.LuDonePreview?.icon(name) : '');
 const queueCount = () => (typeof state !== 'undefined' && globalThis.LuDonePreview?.state.recordings ? globalThis.LuDonePreview?.state.recordings.filter((r) => PENDING.includes(r.status)).length : 0);

 // Trvalá levá lišta; vytvoří se jednou, při dalších renderech se jen aktualizuje stav.
 function rail() {
  const body = globalThis.document.querySelector('.menu-popover-body');
  if (!body) return;
  let el = body.querySelector('.f-rail');
  if (!el) {
   el = globalThis.document.createElement('nav');
   el.className = 'f-rail';
   el.setAttribute('aria-label', 'Části LuDone');
   el.innerHTML = NAV.map(([page, label, ico], i) => `<button type="button" class="${i === 3 ? 'f-low' : ''}" data-action="nav" data-page="${page}" aria-label="${label}" title="${label}">${glyph(ico)}</button>`).join('');
   body.prepend(el);
  }
  const current = globalThis.document.body.dataset.page === 'detail' ? 'library' : globalThis.document.body.dataset.page;
  el.querySelectorAll('button').forEach((b) => {
   if (b.dataset.page === current) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  const queue = el.querySelector('[data-page=queue]');
  queue.querySelector('.f-count')?.remove();
  const n = queueCount();
  if (n) queue.insertAdjacentHTML('beforeend', `<span class="f-count" aria-hidden="true">${n}</span>`);
  queue.setAttribute('aria-label', n ? `Odesílání, čeká ${n}` : 'Odesílání');
  el.querySelector('[data-page=home]').setAttribute('aria-label', globalThis.document.body.dataset.phase === 'recording' ? 'Nahrávání, právě se nahrává' : 'Nahrávání');
 }

 // Zelený/akcentní uzel smí mít jen text „V LuDone · ověřeno“. Odesláno bez ověření zůstává prázdný kroužek.
 function verified() {
  globalThis.document.querySelectorAll('.badge.sent').forEach((b) => b.classList.toggle('is-verified', /^V LuDone · ověřeno/.test(b.textContent.trim())));
 }

 // Fronta: barva uzlu podle textu výsledku, nikdy zelená u problému.
 function tones() {
  globalThis.document.querySelectorAll('.queue-row').forEach((row) => {
   const text = row.querySelector('p')?.textContent || '';
   row.dataset.tone = /selhal|chybí|není kompletní/.test(text) ? 'error' : /limit|za \d+ minut|Čeká|čeká/.test(text) ? 'warn' : 'run';
  });
 }

 // Nastavení: pět částí zůstává viditelných, obsah aktivní části se rozbalí pod její řádek.
 function accordion() {
  const nav = globalThis.document.querySelector('.settings-nav');
  const content = globalThis.document.querySelector('.settings-content');
  if (!nav || !content || nav.querySelector('.f-sec')) return;
  [...nav.querySelectorAll(':scope > button')].forEach((button) => {
   const section = globalThis.document.createElement('div');
   section.className = 'f-sec';
   nav.append(section);
   section.append(button);
   const open = button.getAttribute('aria-current') === 'page';
   button.setAttribute('aria-expanded', String(open));
   if (open) {
    content.id = 'f-settings-panel';
    button.setAttribute('aria-controls', content.id);
    section.classList.add('is-open');
    section.append(content);
   }
  });
 }

 // Detail: akce se přesunou ke stanici, které se týkají. Tlačítka se nekopírují.
 function pipeline() {
  const cells = globalThis.document.querySelectorAll('.detail-main .status-cell');
  const aside = globalThis.document.querySelector('.detail-aside');
  const actions = aside?.querySelector('.detail-actions');
  // Barva stanice vychází z textu: Mac je ok / chyba, server je prázdný, dokud text neříká „ověřeno“.
  if (cells.length >= 2) {
   const mac = cells[0].querySelector('strong')?.textContent || '';
   const server = cells[1].querySelector('strong')?.textContent || '';
   cells[0].dataset.station = /chybí|není úplný|není k dispozici/.test(mac) ? 'error' : 'ok';
   cells[1].dataset.station = /^Dokončeno · ověřeno/.test(server) ? 'ok-verified' : /nenalezeno/.test(server) ? 'error' : 'pending';
  }
  if (cells.length < 2 || !actions || cells[0].querySelector('.f-acts')) return;
  const mac = globalThis.document.createElement('div');
  const server = globalThis.document.createElement('div');
  mac.className = server.className = 'f-acts';
  [...actions.children].forEach((button) => (['finder', 'trash'].includes(button.dataset.action) ? mac : server).append(button));
  if (mac.children.length) cells[0].append(mac);
  if (server.children.length) cells[1].append(server);
  const progress = aside.querySelector('.progress');
  if (progress) cells[1].append(progress);
 }

 globalThis.applyLuDoneLayout = function () {
  rail();
  verified();
  tones();
  accordion();
  pipeline();
 };
})();
