import { useEffect, useState } from "react";
import {
  CalendarIcon,
  CheckIcon,
  CloseIcon,
  CloudIcon,
  LuDoneMark,
  UserIcon,
  VolumeIcon,
} from "./Icons.jsx";
import { Toggle } from "./Toggle.jsx";

const STORAGE_KEY = "ludone.prototype.settings";
const DEFAULTS = {
  autoCalendar: false,
  askOther: true,
  retention: "24 hodin po odeslání",
};

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(window.localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return DEFAULTS;
  }
}

export function SettingsApp() {
  const [settings, setSettings] = useState(loadSettings);
  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  return (
    <main className="settings-window window-surface">
      <header className="settings-header">
        <div className="brand-lockup"><LuDoneMark size={30} /><span>Nastavení</span></div>
        <button
          type="button"
          className="icon-button"
          aria-label="Zavřít nastavení"
          onClick={() => window.ludone.closeSettings()}
        >
          <CloseIcon />
        </button>
      </header>

      <div className="settings-content">
        <section className="settings-group" aria-labelledby="recording-settings-title">
          <div className="settings-group__heading">
            <span><CalendarIcon /></span>
            <div><p className="eyebrow">Doporučení</p><h2 id="recording-settings-title">Kdy nahrávat</h2></div>
          </div>
          <div className="settings-row">
            <div><strong>Schůzky z kalendáře</strong><small>Spustit nahrávání automaticky</small></div>
            <Toggle
              checked={settings.autoCalendar}
              onChange={(value) => update("autoCalendar", value)}
              label="Automaticky nahrávat schůzky z kalendáře"
            />
          </div>
          <div className="settings-row">
            <div><strong>Ostatní hovory</strong><small>Nejdřív se zeptat</small></div>
            <Toggle
              checked={settings.askOther}
              onChange={(value) => update("askOther", value)}
              label="Ptát se před nahráváním ostatních hovorů"
            />
          </div>
        </section>

        <section className="settings-group" aria-labelledby="audio-settings-title">
          <div className="settings-group__heading">
            <span><VolumeIcon /></span>
            <div><p className="eyebrow">Lokální soubory</p><h2 id="audio-settings-title">Co se děje se zvukem</h2></div>
          </div>
          <label className="settings-select">
            <span><strong>Ponechat na tomto Macu</strong><small>Po odeslání do LuDone</small></span>
            <select value={settings.retention} onChange={(event) => update("retention", event.target.value)}>
              <option>Ihned smazat</option>
              <option>24 hodin po odeslání</option>
              <option>7 dní po odeslání</option>
              <option>30 dní po odeslání</option>
            </select>
          </label>
          <p className="settings-hint">V prototypu se žádný zvukový soubor nevytváří ani nemaže.</p>
        </section>

        <section className="settings-group" aria-labelledby="account-settings-title">
          <div className="settings-group__heading">
            <span><UserIcon /></span>
            <div><p className="eyebrow">Účet a připojení</p><h2 id="account-settings-title">Kam data míří</h2></div>
          </div>
          <div className="account-card">
            <div className="avatar">DN</div>
            <div><strong>Daniel Novák</strong><small>daniel@ludone.cz</small></div>
            <span className="connected"><CheckIcon /> Připojeno</span>
          </div>
          <div className="destination-row">
            <CloudIcon />
            <span><small>Cílový prostor</small><strong>app.ludone.cz · LuDone tým</strong></span>
          </div>
        </section>
      </div>

      <footer className="settings-footer">
        <span><CheckIcon /> Změny se ukládají automaticky</span>
        <button type="button" className="button button--primary" onClick={() => window.ludone.closeSettings()}>
          Hotovo
        </button>
      </footer>
    </main>
  );
}
