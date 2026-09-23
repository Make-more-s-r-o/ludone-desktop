const SCENARIOS = new Set(["ready", "running", "saved", "blocked"]);
const THEMES = new Set(["light", "professional", "dark"]);
const DEMO_PROJECTS = [
  { id: "redakce", name: "Ukázka — redakce webu" },
  { id: "planovani", name: "Ukázka — interní plánování" },
  { id: "podpora", name: "Ukázka — podpora týmu" },
];
const params = new URLSearchParams(location.search);
const initialScenario = SCENARIOS.has(params.get("scenario")) ? params.get("scenario") : "ready";
const initialTheme = THEMES.has(params.get("theme")) ? params.get("theme") : "light";
const state = {
  scenario: initialScenario,
  theme: initialTheme,
  project: "redakce",
  work: "Příprava obsahu stránky",
  runningSince: initialScenario === "running" ? Date.now() - 32 * 60_000 : null,
  recording: initialScenario === "running",
  entries: [{ project: "planovani", work: "Plán týdenní práce", minutes: 23, sample: true }],
};
const scene = document.querySelector("#scene");
const themeSelect = document.querySelector("#theme-select");
const icon = {
  play: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m6 4 10 6-10 6V4Z" fill="currentColor"/></svg>',
  stop: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="5" y="5" width="10" height="10" fill="currentColor"/></svg>',
  info: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7" stroke="currentColor"/><path d="M10 9v5M10 6v1" stroke="currentColor" stroke-width="1.4"/></svg>',
  lock: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="4" y="8" width="12" height="9" stroke="currentColor"/><path d="M7 8V6a3 3 0 0 1 6 0v2" stroke="currentColor"/></svg>',
};

function safe(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function projectName(id) {
  return DEMO_PROJECTS.find((project) => project.id === id)?.name ?? "Ukázkový projekt";
}
function projectOptions(selected) {
  return DEMO_PROJECTS.map((project) => `<option value="${project.id}"${project.id === selected ? " selected" : ""}>${safe(project.name)}</option>`).join("");
}
function minutesText(minutes) {
  if (minutes < 1) return "&lt; 1 min";
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min` : `${minutes} min`;
}
function elapsedMinutes() {
  return state.runningSince === null ? 0 : Math.max(0, Math.floor((Date.now() - state.runningSince) / 60_000));
}
function clockText() {
  const minutes = elapsedMinutes();
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}
function recordingRow() {
  return `<div class="card recording-row" aria-label="Nahrávání, samostatná simulace">
    <span class="recording-glyph" aria-hidden="true">${state.recording ? '<span style="width:9px;height:9px;border-radius:50%;background:currentColor"></span>' : icon.stop}</span>
    <div class="recording-copy"><strong>Nahrávání schůzky</strong><small>${state.recording ? "Běží zvlášť · časovač je nezávislý" : "Neběží · samostatná agenda"}</small></div>
    <button type="button" class="btn" data-action="recording" aria-label="${state.recording ? "Zastavit ukázku nahrávání" : "Spustit ukázku nahrávání"}">${state.recording ? "Stop" : "Spustit"}</button>
  </div>`;
}
function readyView() {
  return `<div class="section-heading"><div><span class="eyebrow">01 / příprava</span><h2>Na čem pracujete?</h2></div><span class="subtle">Pouze ukázka</span></div>
  <div class="card"><div class="card-head"><h3>Nové měření času</h3><span class="status"><i class="status-dot"></i>Neaktivní</span></div>
    <label class="field" for="project"><span>Projekt</span><select id="project" data-field="project">${projectOptions(state.project)}</select></label>
    <label class="field" for="work"><span>Práce</span><input id="work" data-field="work" maxlength="80" value="${safe(state.work)}" placeholder="Například příprava obsahu"></label>
    <p class="field-hint">Položky jsou fiktivní. Vydaná aplikace zatím projekty z LuTracku nenačítá.</p>
    <button type="button" class="btn primary full" data-action="start">${icon.play} Spustit místní časovač</button>
  </div>
  <div class="notice"><strong>Čas zůstane jen v tomto náhledu</strong><p>Po zastavení se objeví místní ukázková položka. Skutečný výkaz do LuTracku nevznikne.</p></div>`;
}
function runningView() {
  return `<div class="section-heading"><div><span class="eyebrow">02 / běží</span><h2>Práce se měří</h2></div><span class="subtle">Místní simulace</span></div>
  <div class="card"><div class="card-head"><h3>LuTrack</h3><span class="status"><i class="status-dot active"></i>Časovač běží</span></div>
    <div class="running-clock" id="elapsed" role="timer">${clockText()}</div>
    <div class="running-project">${safe(projectName(state.project))}</div>
    <p class="running-work">${safe(state.work || "Bez popisu práce")}</p>
    <hr class="divider">
    <label class="field" for="switch-project"><span>Přepnout projekt</span><select id="switch-project" data-field="project">${projectOptions(state.project)}</select></label>
    <div class="actions"><button type="button" class="btn primary" data-action="stop">${icon.stop} Zastavit čas</button><span class="mini-label">Nahrávání pokračuje zvlášť.</span></div>
  </div>
  ${recordingRow()}
  <div class="notice"><strong>Čas je zatím pouze místní</strong><p>Přepnutí ani zastavení nic neposílá do LuTracku.</p></div>`;
}
function savedView() {
  const entries = state.entries.slice().reverse().map((entry) => `<li><span class="entry-time">${minutesText(entry.minutes)}</span><span class="entry-copy"><strong>${safe(projectName(entry.project))}</strong><small>${safe(entry.work || "Bez popisu práce")}${entry.sample ? " · předpřipravený příklad" : " · právě zastaveno"}</small></span></li>`).join("");
  return `<div class="section-heading"><div><span class="eyebrow">03 / zastaveno</span><h2>Dnešní ukázka</h2></div><span class="subtle">Jen v prokliku</span></div>
  <div class="notice attention" role="status"><strong>Není odesláno do LuTracku</strong><p>Tyto položky existují pouze v této otevřené simulaci. Po načtení stránky zmizí.</p></div>
  <div class="card"><div class="card-head"><h3>Místní položky</h3><span class="mini-label">Dnes · ukázka</span></div><ul class="entry-list">${entries}</ul></div>
  ${state.recording ? recordingRow() : ""}
  <div class="actions" style="margin-top:13px"><button type="button" class="btn primary" data-action="new">${icon.play} Nové měření</button><button type="button" class="btn" data-action="blocked">Proč nejde odeslat?</button></div>`;
}
function blockedView() {
  return `<div class="section-heading"><div><span class="eyebrow">04 / hranice produktu</span><h2>Ještě není zapojeno</h2></div></div>
  <div class="card"><div class="blocked-icon">${icon.lock}</div><h3>Projekt ani odeslání času teď nejsou dostupné</h3>
    <p class="blocked-copy" style="margin-top:9px">Tento návrh používá <strong>fiktivní projekty</strong>. Vydaná aplikace nezná váš výběr práce a nemá cestu pro odeslání hodin do LuTracku.</p>
    <p class="blocked-step"><strong>Co dál:</strong> Pro skutečné vykázání zatím použijte současný LuTrack v prohlížeči. Desktopové měření se zapojí až po dokončení kontraktu v aplikaci LuDone.</p>
  </div>
  <div class="notice">${icon.info}<strong style="display:inline;margin-left:7px">Bezpečný návrh</strong><p style="margin-top:4px">Žádný čas ani popis práce z tohoto prokliku se neukládá na server.</p></div>
  <div class="actions" style="margin-top:13px"><button type="button" class="btn" data-action="back">Zpět k návrhu</button></div>`;
}
function updateUrl() {
  const next = new URL(location.href);
  next.searchParams.set("scenario", state.scenario);
  next.searchParams.set("theme", state.theme);
  history.replaceState(null, "", next);
}
function render() {
  document.documentElement.dataset.theme = state.theme;
  themeSelect.value = state.theme;
  document.querySelectorAll("[data-scenario]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.scenario === state.scenario)));
  scene.innerHTML = ({ ready: readyView, running: runningView, saved: savedView, blocked: blockedView })[state.scenario]();
  updateUrl();
}
document.querySelector(".scenario-switch").addEventListener("click", (event) => {
  const button = event.target.closest("[data-scenario]");
  if (!button) return;
  state.scenario = button.dataset.scenario;
  if (state.scenario === "running" && state.runningSince === null) {
    state.runningSince = Date.now() - 32 * 60_000;
    state.recording = true;
  }
  render();
});
themeSelect.addEventListener("change", () => { state.theme = themeSelect.value; render(); });
scene.addEventListener("input", (event) => {
  if (event.target.dataset.field === "work") state.work = event.target.value;
});
scene.addEventListener("change", (event) => {
  if (event.target.dataset.field === "project") {
    const nextProject = event.target.value;
    if (state.scenario === "running" && state.runningSince !== null && nextProject !== state.project) {
      state.entries.push({ project: state.project, work: state.work, minutes: elapsedMinutes(), sample: false });
      state.runningSince = Date.now();
    }
    state.project = nextProject;
    render();
  }
});
scene.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  switch (button.dataset.action) {
    case "start": state.runningSince = Date.now(); state.scenario = "running"; break;
    case "stop": {
      const duration = Math.max(0, Math.floor((Date.now() - state.runningSince) / 60_000));
      state.entries.push({ project: state.project, work: state.work, minutes: duration, sample: false });
      state.runningSince = null;
      state.scenario = "saved";
      break;
    }
    case "recording": state.recording = !state.recording; break;
    case "new": state.scenario = "ready"; break;
    case "blocked": state.scenario = "blocked"; break;
    case "back": state.scenario = "ready"; break;
    default: return;
  }
  render();
});
window.setInterval(() => {
  if (state.scenario === "running" && state.runningSince !== null) {
    const timer = document.querySelector("#elapsed");
    if (timer) timer.textContent = clockText();
  }
}, 1_000);
render();
