/* Ikonová revize vybrané Osy. Jen prezentace HTML makety, bez změn funkcí. */
(function () {
 const paths = {
  record: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3M9 21h6"/>',
  library: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8v3M11 6v7M14 8v3M8 17h8"/>',
  cloud: '<path d="M6 18a4.5 4.5 0 0 1-.5-9 6.5 6.5 0 0 1 12-2 5.5 5.5 0 0 1 .5 11M12 20V10m-4 4 4-4 4 4"/>',
  settings: '<path d="m10 3-.5 2-2 .9-1.9-.6-2 3.4 1.4 1.5v2.3l-1.4 1.5 2 3.4 1.9-.6 2 .9.5 2h4l.5-2 2-.9 1.9.6 2-3.4-1.4-1.5v-2.3L20.4 9l-2-3.4-1.9.6-2-.9L14 3Z"/><circle cx="12" cy="11.4" r="3"/>',
  update: '<path d="M20 10a8 8 0 0 0-13.7-3.7L3 10m0-5v5h5M4 14a8 8 0 0 0 13.7 3.7L21 14m0 5v-5h-5"/>',
  refresh: '<path d="M20 10a8 8 0 0 0-13.7-3.7L3 10m0-5v5h5M4 14a8 8 0 0 0 13.7 3.7L21 14m0 5v-5h-5"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  chevron: '<path d="m10 6 6 6-6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  back: '<path d="m14 6-6 6 6 6"/>',
  check: '<path d="m5 12 4.5 4.5L19 7"/>',
  close: '<path d="m7 7 10 10M7 17 17 7"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  sound: '<path d="M4 9h3l5-4v14l-5-4H4ZM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>',
  web: '<path d="M14 4h6v6M20 4l-9 9M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v6M12 7h.01"/>',
  keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M12 10h.01M17 10h.01M7 13h.01M12 13h.01M17 13h.01M8 16h8"/>',
  tray: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M14 6h3M9 11h9v6H9z"/>',
  alert: '<path d="m12 4 9 16H3ZM12 10v4M12 17h.01"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  waveform: '<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  device: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v3M8 21h8"/>',
  storage: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M7 15h.01M11 15h6"/>',
  diagnostics: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  sources: '<path d="M4 7h6M16 7h4M4 17h2M12 17h8"/><circle cx="13" cy="7" r="3"/><circle cx="9" cy="17" r="3"/>',
  start: '<circle cx="12" cy="12" r="5"/>'
 };
 // Přesná geometrie tří tahů z dodaného LuDone.svg; bez pozadí pro systémovou lištu.
 const mark = '<g transform="scale(.02)" fill="currentColor" stroke="none"><rect x="363.43" y="479.05" width="615.7" height="103.05" transform="translate(-143.27 792.56) rotate(-56.15)"/><rect x="352.1" y="457.81" width="103.05" height="403.78" transform="translate(-369.09 627.47) rotate(-56.15)"/><rect x="618.07" y="771.07" width="403.78" height="103.05" transform="translate(-329.27 654.46) rotate(-36.77)"/></g>';
 function icon(name) {
  return `<svg class="f-icon" data-icon="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${name === 'brand' ? mark : paths[name] || paths.info}</svg>`;
 }
 function replace(button, name) {
  if (button?.querySelector('svg')) button.querySelector('svg').outerHTML = icon(name);
 }
 function apply(s) {
  const trigger = document.querySelector('.menubar-trigger');
  const image=trigger.querySelector('img,.f-icon,.f-tray-icon');
  const live = trigger.querySelector('.menu-live-status');
  const tray=window.LuDoneFTray.describe({
   phase:s.phase,systemLost:s.systemLost,microphoneOnly:s.microphoneOnly,signed:s.signed,network:s.network,
   time:live.querySelector('[data-live-time]')?.textContent,
   pendingCount:s.recordings.filter(r=>['queued','rate'].includes(r.status)).length,
   attentionCount:s.recordings.filter(r=>['failed','unclaimed','missing','partial','unknown'].includes(r.status)).length
  });
  if(image)image.outerHTML=window.LuDoneFTray.svg(tray.name);
  live.innerHTML=tray.text?`<span${s.phase==='recording'?' data-live-time':''}>${tray.text}</span>`:'';
  trigger.dataset.trayState=tray.name;
  trigger.setAttribute('aria-label',tray.label);
  trigger.title = trigger.getAttribute('aria-label');
  replace(document.querySelector('[data-action=tray-menu]'), 'more');
  replace(document.querySelector('.head-actions [data-action=sources]'), 'sources');
  replace(document.querySelector('[data-action=start]'), 'start');
  document.querySelectorAll('.f-rail button').forEach(button => {
   const label = button.title;
   if (!button.querySelector('.f-nav-tooltip')) button.insertAdjacentHTML('beforeend', `<span class="f-nav-tooltip" aria-hidden="true">${label}</span>`);
  });
  const sections = {account:'user',audio:'sound',device:'device',storage:'storage',diagnostics:'diagnostics'};
  document.querySelectorAll('.settings-nav button[data-tab]').forEach(button => {
   if (!button.querySelector('.f-icon')) button.insertAdjacentHTML('afterbegin', icon(sections[button.dataset.tab]));
  });
 }
 window.LuDoneFIcons = {icon, apply, paths};
})();
