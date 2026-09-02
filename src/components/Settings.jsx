import { useEffect, useState } from "react";
import {
  CheckIcon,
  CloseIcon,
  CloudIcon,
  LuDoneMark,
  MicIcon,
  UserIcon,
  VolumeIcon,
} from "./Icons.jsx";
import { Toggle } from "./Toggle.jsx";

const STORAGE_KEY = "ludone.prototype.settings";
const DEFAULTS = {
  askOther: true,
  retention: "7 dní po odeslání",
};

function normalizeIdentityPart(value) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return /^(?:undefined|null)$/iu.test(normalized) ? "" : normalized;
}

function normalizeIdentity(value) {
  const email = normalizeIdentityPart(value?.email);
  const name = normalizeIdentityPart(value?.name);
  if (!/^[^\s@]+@[^\s@]+$/u.test(email)) return null;
  return { name: name || email, email, hasName: Boolean(name) };
}

function firstCharacter(value) {
  return Array.from(value)[0] ?? "";
}

function identityAvatar(identity) {
  if (identity.hasName) {
    const words = identity.name.split(/\s+/u).filter(Boolean);
    const selected = words.length > 1 ? [words[0], words.at(-1)] : words;
    return selected.map((word) => firstCharacter(word)).join("").toLocaleUpperCase("cs");
  }
  const localPart = identity.email.split("@", 1)[0];
  return firstCharacter(localPart).toLocaleUpperCase("cs");
}

function loadSettings() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return {
      askOther: stored.askOther ?? DEFAULTS.askOther,
      retention: stored.retention ?? DEFAULTS.retention,
    };
  } catch {
    return DEFAULTS;
  }
}

export function SettingsApp() {
  const [settings, setSettings] = useState(loadSettings);
  const [account, setAccount] = useState({ state: "unknown", identity: null });
  const [destination, setDestination] = useState({ state: "unknown", origin: null });
  const update = (key, value) => {
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
  };

  useEffect(() => {
    let active = true;
    let requestId = 0;
    const getAuthIdentity = window.ludone?.getAuthIdentity;
    if (typeof getAuthIdentity !== "function") return () => { active = false; };

    const refreshIdentity = () => {
      requestId += 1;
      const currentRequestId = requestId;
      setAccount({ state: "unknown", identity: null });
      Promise.resolve()
        .then(() => getAuthIdentity())
        .then((value) => {
          if (!active || currentRequestId !== requestId) return;
          if (value === null) {
            setAccount({ state: "signed-out", identity: null });
            return;
          }
          const identity = normalizeIdentity(value);
          setAccount(identity
            ? { state: "signed-in", identity }
            : { state: "unknown", identity: null });
        })
        .catch(() => {
          if (active && currentRequestId === requestId) {
            setAccount({ state: "unknown", identity: null });
          }
        });
    };
    const refreshVisibleIdentity = () => {
      if (document.visibilityState === "visible") refreshIdentity();
    };

    window.addEventListener("focus", refreshIdentity);
    document.addEventListener("visibilitychange", refreshVisibleIdentity);
    refreshIdentity();

    return () => {
      active = false;
      requestId += 1;
      window.removeEventListener("focus", refreshIdentity);
      document.removeEventListener("visibilitychange", refreshVisibleIdentity);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const getAuthOrigin = window.ludone?.getAuthOrigin;
    if (typeof getAuthOrigin !== "function") return () => { active = false; };

    Promise.resolve()
      .then(() => getAuthOrigin())
      .then((value) => {
        if (!active) return;
        const origin = typeof value === "string" ? value.trim() : "";
        setDestination(origin
          ? { state: "resolved", origin }
          : { state: "unknown", origin: null });
      })
      .catch(() => {
        if (active) setDestination({ state: "unknown", origin: null });
      });

    return () => { active = false; };
  }, []);

  const signedIn = account.state === "signed-in" && account.identity;

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
            <span><MicIcon /></span>
            <div><p className="eyebrow">Doporučení</p><h2 id="recording-settings-title">Kdy nahrávat</h2></div>
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
              <option>Nemazat</option>
            </select>
          </label>
          <p className="settings-hint">V prototypu se žádný zvukový soubor nevytváří ani nemaže.</p>
        </section>

        <section className="settings-group" aria-labelledby="account-settings-title">
          <div className="settings-group__heading">
            <span><UserIcon /></span>
            <div><p className="eyebrow">Účet a připojení</p><h2 id="account-settings-title">Kam data míří</h2></div>
          </div>
          <div
            className={`account-card account-card--${account.state}`}
            data-testid="settings-account"
            data-auth-state={account.state}
          >
            {signedIn && (
              <div className="avatar" data-testid="settings-avatar">
                {identityAvatar(account.identity)}
              </div>
            )}
            <div>
              {signedIn ? (
                <>
                  <strong data-testid="settings-identity-name">{account.identity.name}</strong>
                  {account.identity.hasName && (
                    <small data-testid="settings-identity-email">{account.identity.email}</small>
                  )}
                </>
              ) : (
                <strong>{account.state === "signed-out" ? "Nikdo není přihlášený" : "Identita není známá"}</strong>
              )}
            </div>
            <span
              className={signedIn ? "connected" : "connection-state"}
              data-testid="settings-account-status"
              role="status"
            >
              {signedIn && <CheckIcon />}
              {signedIn ? "Připojeno" : (account.state === "signed-out" ? "Nepřipojeno" : "Stav neznámý")}
            </span>
          </div>
          <div
            className="destination-row"
            data-testid="settings-destination"
            data-destination-state={destination.state}
            data-origin={destination.origin ?? undefined}
          >
            <CloudIcon />
            <span>
              <small>Cílový prostor</small>
              <strong>{destination.origin ?? "Adresa není známá"}</strong>
            </span>
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
