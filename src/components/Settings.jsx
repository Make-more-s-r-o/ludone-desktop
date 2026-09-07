import { useEffect, useRef, useState } from "react";
import { countLabel } from "../lib/count-label.js";
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
  retention: "7 dní po odeslání",
};
const SETTINGS_TABS = Object.freeze([
  { id: "account", label: "Účet" },
  { id: "audio", label: "Zvuk" },
  { id: "recordings", label: "Záznamy" },
  { id: "diagnostics", label: "Diagnostika" },
]);
const AUTH_ENVIRONMENTS = Object.freeze([
  {
    label: "produkce · app.ludone.cz",
    name: "produkce",
    origin: "https://app.ludone.cz",
    targetName: "produkci",
  },
  {
    label: "labs · labs.ludone.cz",
    name: "labs",
    origin: "https://labs.ludone.cz",
    targetName: "labs",
  },
]);

const PERMISSION_LABELS = Object.freeze({
  denied: "Nepovoleno",
  granted: "Povoleno",
  "not-determined": "Zatím neurčeno",
  restricted: "Omezeno systémem",
  unknown: "Stav není známý",
});

function logoutFailureMessage(reason) {
  const messages = {
    "recording-active": "Nejdřív ukonči nahrávání.",
    "tracking-active": "Nejdřív zastav LuTrack.",
  };
  return messages[reason] ?? "Odhlášení se nepodařilo.";
}

function permissionView(value) {
  const status = typeof value?.status === "string" && PERMISSION_LABELS[value.status]
    ? value.status
    : "unknown";
  return { status, label: PERMISSION_LABELS[status] };
}

function isSafeCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function localDateTime(iso) {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  }).format(date);
  return `${day} v ${time}`;
}

function normalizeDiagnostics(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rawVersion = typeof value.version === "string" ? value.version.trim() : "";
  const version = /^\d{1,9}\.\d{1,9}\.\d{1,9}(?:-[0-9A-Za-z.-]{1,32})?(?:\+[0-9A-Za-z.-]{1,32})?$/u
    .test(rawVersion) && rawVersion.length <= 64
    ? rawVersion
    : "Neznámá";
  const architecture = ["Apple Silicon", "Intel"].includes(value.architecture)
    ? value.architecture
    : "Neznámá";
  const queueAvailable = value.queue?.available === true
    && isSafeCount(value.queue?.waiting)
    && isSafeCount(value.queue?.sending)
    && isSafeCount(value.queue?.failed);
  const rawLastSuccessfulAt = value.serverConnection?.lastSuccessfulAt;
  const parsedLastSuccessfulAt = typeof rawLastSuccessfulAt === "string"
    ? new Date(rawLastSuccessfulAt)
    : null;
  const lastSuccessfulAt = parsedLastSuccessfulAt
    && Number.isFinite(parsedLastSuccessfulAt.getTime())
    && parsedLastSuccessfulAt.toISOString() === rawLastSuccessfulAt
    && parsedLastSuccessfulAt.getTime() <= Date.now()
    ? rawLastSuccessfulAt
    : null;

  return {
    version,
    architecture,
    permissions: {
      microphone: permissionView(value.permissions?.microphone),
      systemAudio: permissionView(value.permissions?.systemAudio),
    },
    serverConnection: lastSuccessfulAt && value.serverConnection?.status === "last-success"
      ? {
          status: "last-success",
          lastSuccessfulAt,
          label: `Poslední potvrzené odeslání: ${localDateTime(lastSuccessfulAt)}`,
        }
      : {
          status: "unknown",
          lastSuccessfulAt: null,
          label: "Zatím bez zaznamenaného úspěšného volání",
        },
    queue: {
      available: queueAvailable,
      waiting: queueAvailable ? value.queue.waiting : 0,
      sending: queueAvailable ? value.queue.sending : 0,
      failed: queueAvailable ? value.queue.failed : 0,
    },
  };
}

function queueStatusText(queue) {
  if (!queue?.available) return "Stav fronty není dostupný";
  const parts = [];
  if (queue.waiting > 0) parts.push(countLabel(queue.waiting, "čeká", "čekají", "čeká"));
  if (queue.sending > 0) {
    parts.push(countLabel(queue.sending, "se odesílá", "se odesílají", "se odesílá"));
  }
  if (queue.failed > 0) parts.push(countLabel(queue.failed, "selhala", "selhaly", "selhalo"));
  return parts.length > 0 ? parts.join(" · ") : "Nic nečeká";
}

function safeExportFileName(value) {
  if (typeof value !== "string") return null;
  return /^ludone-diagnostika-[0-9-]+\.txt$/u.test(value) ? value : null;
}

function normalizeIdentityPart(value) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return /^(?:undefined|null)$/iu.test(normalized) ? "" : normalized;
}

function normalizeIdentity(value) {
  const email = normalizeIdentityPart(value?.email);
  const name = normalizeIdentityPart(value?.name);
  if (!/^[^\s@]+@[^\s@]+$/u.test(email)) return null;
  return { name: name || null, email, hasName: Boolean(name) };
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
      retention: stored.retention ?? DEFAULTS.retention,
    };
  } catch {
    return DEFAULTS;
  }
}

function useSystemBooleanSetting(getterName, setterName) {
  const [state, setState] = useState({ value: false, loaded: false, busy: false, failed: false });
  const active = useRef(false);

  useEffect(() => {
    active.current = true;
    const getter = window.ludone?.[getterName];
    const setter = window.ludone?.[setterName];
    if (typeof getter !== "function" || typeof setter !== "function") {
      return () => { active.current = false; };
    }

    Promise.resolve()
      .then(() => getter())
      .then((value) => {
        if (!active.current || typeof value !== "boolean") return;
        setState({ value, loaded: true, busy: false, failed: false });
      })
      .catch(() => {
        if (active.current) setState({ value: false, loaded: false, busy: false, failed: false });
      });

    return () => { active.current = false; };
  }, [getterName, setterName]);

  const update = (nextValue) => {
    if (!state.loaded || state.busy || typeof nextValue !== "boolean") return;
    const setter = window.ludone?.[setterName];
    if (typeof setter !== "function") {
      setState((current) => ({ ...current, failed: true }));
      return;
    }
    const previousValue = state.value;
    setState({ ...state, value: nextValue, busy: true });
    Promise.resolve()
      .then(() => setter(nextValue))
      .then((storedValue) => {
        if (!active.current) return;
        if (typeof storedValue !== "boolean") {
          throw new TypeError("Hlavní proces nevrátil boolean systémového nastavení");
        }
        setState({ value: storedValue, loaded: true, busy: false, failed: storedValue !== nextValue });
      })
      .catch(async () => {
        let value = previousValue;
        try {
          const actualValue = await window.ludone?.[getterName]?.();
          if (typeof actualValue === "boolean") value = actualValue;
        } catch {
          // Pokud selže i čtení, ponecháme poslední známou hodnotu s chybou.
        }
        if (active.current) {
          setState({ value, loaded: true, busy: false, failed: true });
        }
      });
  };

  return { ...state, update };
}

export function SettingsApp() {
  const [activeTab, setActiveTab] = useState("account");
  const [settings, setSettings] = useState(loadSettings);
  const [account, setAccount] = useState({ state: "unknown", identity: null });
  const [destination, setDestination] = useState({ state: "unknown", origin: null });
  const [device, setDevice] = useState({ state: "unknown", name: null });
  const [diagnostics, setDiagnostics] = useState({ state: "loading", value: null });
  const [exportState, setExportState] = useState({ state: "idle", fileName: null });
  const [logoutState, setLogoutState] = useState({ state: "idle", message: "" });
  const [environmentState, setEnvironmentState] = useState({ state: "idle", message: "" });
  const authActionInFlight = useRef(false);
  const identityRequestGeneration = useRef(0);
  const refreshIdentityRequest = useRef(
    /** @type {null | (() => void)} */ (null),
  );
  const dock = useSystemBooleanSetting("getDockVisible", "setDockVisible");
  const login = useSystemBooleanSetting("getOpenAtLogin", "setOpenAtLogin");
  const update = (key, value) => {
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
  };

  useEffect(() => {
    let active = true;
    const getAuthIdentity = window.ludone?.getAuthIdentity;
    if (typeof getAuthIdentity !== "function") return () => { active = false; };

    const refreshIdentity = () => {
      identityRequestGeneration.current += 1;
      const currentRequestId = identityRequestGeneration.current;
      setAccount({ state: "unknown", identity: null });
      Promise.resolve()
        .then(() => getAuthIdentity())
        .then((value) => {
          if (!active || currentRequestId !== identityRequestGeneration.current) return;
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
          if (active && currentRequestId === identityRequestGeneration.current) {
            setAccount({ state: "unknown", identity: null });
          }
        });
    };
    const refreshVisibleIdentity = () => {
      if (document.visibilityState === "visible") refreshIdentity();
    };

    refreshIdentityRequest.current = refreshIdentity;
    window.addEventListener("focus", refreshIdentity);
    document.addEventListener("visibilitychange", refreshVisibleIdentity);
    refreshIdentity();

    return () => {
      active = false;
      identityRequestGeneration.current += 1;
      if (refreshIdentityRequest.current === refreshIdentity) {
        refreshIdentityRequest.current = null;
      }
      window.removeEventListener("focus", refreshIdentity);
      document.removeEventListener("visibilitychange", refreshVisibleIdentity);
    };
  }, []);

  const revalidateAccountIdentity = () => {
    identityRequestGeneration.current += 1;
    setAccount({ state: "unknown", identity: null });
    refreshIdentityRequest.current?.();
  };

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

  useEffect(() => {
    let active = true;
    const getDeviceName = window.ludone?.getDeviceName;
    if (typeof getDeviceName !== "function") return () => { active = false; };

    Promise.resolve()
      .then(() => getDeviceName())
      .then((value) => {
        if (!active) return;
        const name = typeof value === "string" ? value.trim() : "";
        setDevice(name
          ? { state: "resolved", name }
          : { state: "unknown", name: null });
      })
      .catch(() => {
        if (active) setDevice({ state: "unknown", name: null });
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    let requestId = 0;
    if (activeTab !== "recordings" && activeTab !== "diagnostics") {
      return () => { active = false; };
    }
    const getDiagnostics = window.ludone?.getDiagnostics;
    if (typeof getDiagnostics !== "function") {
      setDiagnostics({ state: "unknown", value: null });
      return () => { active = false; };
    }

    const refreshDiagnostics = () => {
      requestId += 1;
      const currentRequestId = requestId;
      setDiagnostics((current) => (
        current.value ? current : { state: "loading", value: null }
      ));
      Promise.resolve()
        .then(() => getDiagnostics())
        .then((value) => {
          if (!active || currentRequestId !== requestId) return;
          const normalized = normalizeDiagnostics(value);
          setDiagnostics(normalized
            ? { state: "ready", value: normalized }
            : { state: "unknown", value: null });
        })
        .catch(() => {
          if (active && currentRequestId === requestId) {
            setDiagnostics({ state: "unknown", value: null });
          }
        });
    };
    const refreshVisibleDiagnostics = () => {
      if (document.visibilityState === "visible") refreshDiagnostics();
    };

    window.addEventListener("focus", refreshDiagnostics);
    document.addEventListener("visibilitychange", refreshVisibleDiagnostics);
    refreshDiagnostics();

    return () => {
      active = false;
      requestId += 1;
      window.removeEventListener("focus", refreshDiagnostics);
      document.removeEventListener("visibilitychange", refreshVisibleDiagnostics);
    };
  }, [activeTab]);

  const selectRelativeTab = (event, currentIndex) => {
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % SETTINGS_TABS.length;
    else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length;
    } else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = SETTINGS_TABS.length - 1;
    else return;

    event.preventDefault();
    const nextTab = SETTINGS_TABS[nextIndex];
    setActiveTab(nextTab.id);
    document.getElementById(`settings-tab-${nextTab.id}`)?.focus();
  };

  const logoutThisMac = async () => {
    const logout = window.ludone?.logout;
    if (
      logoutState.state === "busy"
      || environmentState.state === "busy"
      || authActionInFlight.current
      || typeof logout !== "function"
    ) return;
    authActionInFlight.current = true;
    setLogoutState({ state: "busy", message: "" });
    try {
      const result = await logout();
      if (result?.signedOutLocally === true) {
        identityRequestGeneration.current += 1;
        setAccount({ state: "signed-out", identity: null });
        setLogoutState(result.serverRevoked === true
          ? { state: "done", message: "Tento Mac je odhlášený." }
          : {
            state: "warning",
            message: "Tento Mac je odhlášený. Přihlášení na serveru může dál platit. Odhlas se i na webu LuDone.",
          });
        return;
      }
      setLogoutState({
        state: "error",
        message: logoutFailureMessage(result?.reason),
      });
      revalidateAccountIdentity();
    } catch {
      setLogoutState({ state: "error", message: "Odhlášení se nepodařilo." });
      revalidateAccountIdentity();
    } finally {
      authActionInFlight.current = false;
    }
  };

  const changeEnvironment = async (nextOrigin) => {
    const nextEnvironment = AUTH_ENVIRONMENTS.find(({ origin }) => origin === nextOrigin);
    if (
      !nextEnvironment
      || nextOrigin === destination.origin
      || environmentState.state === "busy"
      || logoutState.state === "busy"
      || authActionInFlight.current
    ) return;
    authActionInFlight.current = true;
    let signedOutLocally = false;
    try {
      const confirmed = window.confirm(
        `Přepnout na ${nextEnvironment.targetName}?\n\n`
        + "Přepnutí tě odhlásí z tohoto Macu. Potom se budeš muset znovu přihlásit.",
      );
      if (!confirmed) return;

      const switchAuthOrigin = window.ludone?.switchAuthOrigin;
      if (typeof switchAuthOrigin !== "function") {
        setEnvironmentState({ state: "error", message: "Prostředí se nepodařilo změnit." });
        return;
      }

      setEnvironmentState({ state: "busy", message: "Odhlašuji a přepínám…" });
      const switchResult = await switchAuthOrigin(nextOrigin);
      if (switchResult?.signedOutLocally !== true) {
        setEnvironmentState({
          state: "error",
          message: logoutFailureMessage(switchResult?.reason),
        });
        revalidateAccountIdentity();
        return;
      }

      signedOutLocally = true;
      identityRequestGeneration.current += 1;
      setAccount({ state: "signed-out", identity: null });
      const effectiveOrigin = switchResult.origin;
      const effectiveEnvironment = AUTH_ENVIRONMENTS.find(
        ({ origin }) => origin === effectiveOrigin,
      );
      if (!effectiveEnvironment) throw new TypeError("Hlavní proces vrátil neznámé prostředí");
      setDestination({ state: "resolved", origin: effectiveOrigin });
      setLogoutState({ state: "idle", message: "" });
      if (effectiveOrigin !== nextOrigin) {
        setEnvironmentState({
          state: "error",
          message: `Tento Mac je odhlášený. LUDONE_ORIGIN ponechává aktivní prostředí: ${effectiveEnvironment.name}.`,
        });
        return;
      }
      setEnvironmentState({
        state: "done",
        message: `Aktivní prostředí: ${effectiveEnvironment.name}. Tento Mac je odhlášený.`,
      });
    } catch {
      if (!signedOutLocally) revalidateAccountIdentity();
      setEnvironmentState({
        state: "error",
        message: signedOutLocally
          ? "Tento Mac je odhlášený, ale prostředí se nepodařilo změnit."
          : "Prostředí se nepodařilo změnit. Stav odhlášení není známý.",
      });
    } finally {
      authActionInFlight.current = false;
    }
  };

  const exportDiagnostics = async () => {
    if (
      exportState.state === "busy"
      || typeof window.ludone?.exportDiagnostics !== "function"
    ) return;
    setExportState({ state: "busy", fileName: null });
    try {
      // Bez argumentu schválně: snapshot znovu sestaví hlavní proces. Renderer tak
      // do souboru nemůže přimíchat identitu, token, název schůzky ani cestu.
      const result = await window.ludone.exportDiagnostics();
      const fileName = result?.ok === true ? safeExportFileName(result.fileName) : null;
      setExportState(fileName
        ? { state: "done", fileName }
        : { state: "error", fileName: null });
    } catch {
      setExportState({ state: "error", fileName: null });
    }
  };

  const signedIn = account.state === "signed-in" && account.identity;
  const diagnosticValues = diagnostics.value;
  const queueText = diagnostics.state === "loading"
    ? "Načítám stav fronty…"
    : queueStatusText(diagnosticValues?.queue);

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

      <nav className="settings-tabs" role="tablist" aria-label="Části nastavení">
        {SETTINGS_TABS.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            id={`settings-tab-${tab.id}`}
            className="settings-tab"
            role="tab"
            aria-controls={`settings-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => selectRelativeTab(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="settings-content">
        <section
          id="settings-panel-account"
          className="settings-tab-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-account"
          hidden={activeTab !== "account"}
        >
          <section className="settings-group" aria-labelledby="account-settings-title">
            <div className="settings-group__heading">
              <span><UserIcon /></span>
              <div><p className="eyebrow">Účet</p><h2 id="account-settings-title">Tento Mac</h2></div>
            </div>
            <div
              className={`account-card account-card--${account.state}`}
              data-testid="settings-account"
              data-auth-state={account.state}
            >
              {signedIn && (
                <div className="avatar" data-testid="settings-avatar" aria-hidden="true">
                  {identityAvatar(account.identity)}
                </div>
              )}
              <div className="account-card__facts">
                {(!signedIn || account.identity.hasName) && (
                  <div className="settings-fact-row">
                    <small>Přihlášen</small>
                    {signedIn ? (
                      <strong data-testid="settings-identity-name">{account.identity.name}</strong>
                    ) : (
                      <strong>
                        {account.state === "signed-out" ? "Nikdo" : "Identita není známá"}
                      </strong>
                    )}
                  </div>
                )}
                <div className="settings-fact-row">
                  <small>E-mail</small>
                  <strong
                    data-testid={signedIn ? "settings-identity-email" : undefined}
                  >
                    {signedIn ? account.identity.email : "—"}
                  </strong>
                </div>
                <div className="settings-fact-row">
                  <small>Zařízení</small>
                  <strong data-testid="settings-device">
                    {device.name ?? "Název zařízení není známý"}
                  </strong>
                </div>
                <div className="settings-fact-row">
                  <small><label htmlFor="settings-environment">Prostředí</label></small>
                  <select
                    id="settings-environment"
                    data-testid="settings-environment"
                    aria-describedby="settings-environment-explanation"
                    value={destination.origin ?? ""}
                    disabled={
                      destination.state !== "resolved"
                      || environmentState.state === "busy"
                      || logoutState.state === "busy"
                    }
                    onChange={(event) => void changeEnvironment(event.target.value)}
                  >
                    {destination.origin === null && (
                      <option value="" disabled>Není známo</option>
                    )}
                    {AUTH_ENVIRONMENTS.map((environment) => (
                      <option key={environment.origin} value={environment.origin}>
                        {environment.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <span
                className={signedIn ? "connected" : "connection-state"}
                data-testid="settings-account-status"
                role="status"
              >
                {signedIn && <CheckIcon />}
                {signedIn ? "Přihlášen" : (account.state === "signed-out" ? "Odhlášen" : "Stav neznámý")}
              </span>
            </div>
            <p
              id="settings-environment-explanation"
              className="settings-hint settings-environment-hint"
              data-testid="settings-environment-explanation"
            >
              Na produkci modul nahrávek schválně není. Na labs ho uvidí jen admin.
              {" "}Prostředí se během dne často aktualizuje.
            </p>
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
            <div className="settings-action-row">
              <button
                type="button"
                className="button button--small"
                disabled={
                  !signedIn
                  || logoutState.state === "busy"
                  || environmentState.state === "busy"
                }
                onClick={logoutThisMac}
              >
                {logoutState.state === "busy" ? "Odhlašuji…" : "Odhlásit tento Mac"}
              </button>
              <small>Fronta zůstane a odešle se po dalším přihlášení.</small>
            </div>
            {logoutState.message && (
              <p
                className={`settings-feedback settings-feedback--${logoutState.state === "warning" ? "error" : logoutState.state}`}
                role={logoutState.state === "warning" ? "alert" : "status"}
              >
                {logoutState.message}
              </p>
            )}
            {environmentState.message && (
              <p
                className={`settings-feedback settings-feedback--${environmentState.state}`}
                data-testid="settings-environment-feedback"
                role={environmentState.state === "error" ? "alert" : "status"}
              >
                {environmentState.message}
              </p>
            )}
            <div className="settings-divider" />
            <div className="settings-row">
              <div>
                <strong>Zobrazovat i ikonu v Docku</strong>
                <small>Zapni, když se ti ikona v liště schovává za notch nebo za jinou aplikaci.</small>
              </div>
              <Toggle
                checked={dock.value}
                disabled={!dock.loaded || dock.busy}
                onChange={dock.update}
                label="Zobrazovat i ikonu v Docku"
              />
            </div>
            <div className="settings-row">
              <div><strong>Spouštět po přihlášení do systému</strong></div>
              <Toggle
                checked={login.value}
                disabled={!login.loaded || login.busy}
                onChange={login.update}
                label="Spouštět po přihlášení do systému"
              />
            </div>
          </section>
        </section>

        <section
          id="settings-panel-audio"
          className="settings-tab-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-audio"
          hidden={activeTab !== "audio"}
        >
          <section className="settings-group" aria-labelledby="recording-settings-title">
            <div className="settings-group__heading">
              <span><MicIcon /></span>
              <div>
                <p className="eyebrow">Doporučení</p>
                <h2 id="recording-settings-title">Kdy nahrávat</h2>
              </div>
            </div>
            <div className="settings-row settings-row--static">
              <div><strong>Nahrávání spouštíš ručně.</strong></div>
            </div>
          </section>

          <section className="settings-group" aria-labelledby="audio-settings-title">
            <div className="settings-group__heading">
              <span><VolumeIcon /></span>
              <div>
                <p className="eyebrow">Dvě oddělené stopy</p>
                <h2 id="audio-settings-title">Co se děje se zvukem</h2>
              </div>
            </div>
            <div className="settings-row settings-row--static">
              <div><strong>Mikrofon</strong><small>Tvůj hlas se ukládá samostatně.</small></div>
            </div>
            <div className="settings-row settings-row--static">
              <div>
                <strong>Ostatní zvuk</strong>
                <small>Je-li povolený, hlasy z hovoru se ukládají do druhé stopy.</small>
              </div>
            </div>
          </section>
        </section>

        <section
          id="settings-panel-recordings"
          className="settings-tab-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-recordings"
          hidden={activeTab !== "recordings"}
        >
          <section className="settings-group" aria-labelledby="recordings-settings-title">
            <div className="settings-group__heading">
              <span><CloudIcon /></span>
              <div>
                <p className="eyebrow">Lokální soubory</p>
                <h2 id="recordings-settings-title">Záznamy</h2>
              </div>
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
            <p className="settings-hint">Neodeslané záznamy se automaticky nemažou.</p>
            <div className="settings-row settings-row--static" data-testid="settings-queue-summary">
              <div><strong>Fronta</strong><small>{queueText}</small></div>
            </div>
          </section>
        </section>

        <section
          id="settings-panel-diagnostics"
          className="settings-tab-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-diagnostics"
          hidden={activeTab !== "diagnostics"}
        >
          <section className="settings-group" aria-labelledby="diagnostics-settings-title">
            <div className="settings-group__heading">
              <span><CloudIcon /></span>
              <div>
                <p className="eyebrow">Podpora</p>
                <h2 id="diagnostics-settings-title">Diagnostika</h2>
              </div>
            </div>
            <p className="settings-diagnostics-intro">
              Když něco nefunguje, tohle pošleš. Bez zvuku, bez tokenu, bez názvů schůzek.
            </p>
            <div className="diagnostics-card">
              <div className="settings-fact-row">
                <small>Verze</small>
                <strong data-testid="diagnostics-version">
                  {diagnosticValues?.version ?? "Stav není známý"}
                </strong>
              </div>
              <div className="settings-fact-row">
                <small>Architektura</small>
                <strong data-testid="diagnostics-architecture">
                  {diagnosticValues?.architecture ?? "Stav není známý"}
                </strong>
              </div>
              <div className="settings-fact-row">
                <small>Mikrofon</small>
                <strong
                  className="diagnostics-status"
                  data-testid="diagnostics-microphone"
                  data-status={diagnosticValues?.permissions.microphone.status ?? "unknown"}
                >
                  {diagnosticValues?.permissions.microphone.label ?? "Stav není známý"}
                </strong>
              </div>
              <div className="settings-fact-row">
                <small>Ostatní zvuk</small>
                <strong
                  className="diagnostics-status"
                  data-testid="diagnostics-system-audio"
                  data-status={diagnosticValues?.permissions.systemAudio.status ?? "unknown"}
                >
                  {diagnosticValues?.permissions.systemAudio.label ?? "Stav není známý"}
                </strong>
              </div>
              <div className="settings-fact-row">
                <small>Spojení se serverem</small>
                <strong
                  data-testid="diagnostics-server"
                  data-status={diagnosticValues?.serverConnection.status ?? "unknown"}
                >
                  {diagnosticValues?.serverConnection.label ?? "Stav není známý"}
                </strong>
              </div>
              <div className="settings-fact-row">
                <small>Fronta</small>
                <strong data-testid="diagnostics-queue">{queueText}</strong>
              </div>
            </div>
            <div className="settings-action-row settings-action-row--export">
              <button
                type="button"
                className="button button--small"
                disabled={exportState.state === "busy"}
                onClick={exportDiagnostics}
              >
                {exportState.state === "busy" ? "Exportuji…" : "Exportovat diagnostiku"}
              </button>
              <small>
                Textový soubor do Stažených. Nikdy neobsahuje zvuk, přihlašovací údaje,
                tokeny, názvy schůzek ani cesty k souborům.
              </small>
            </div>
            {exportState.state === "done" && (
              <p className="settings-feedback settings-feedback--done" role="status">
                Uloženo do Stažených: {exportState.fileName}
              </p>
            )}
            {exportState.state === "error" && (
              <p className="settings-feedback settings-feedback--error" role="status">
                Diagnostiku se nepodařilo uložit.
              </p>
            )}
          </section>
        </section>
      </div>

      <footer className="settings-footer">
        {dock.failed || login.failed ? (
          <p className="settings-feedback settings-feedback--error" role="alert">
            {[
              dock.failed && "Viditelnost ikony v Docku se nepodařilo změnit.",
              login.failed && "Spouštění po přihlášení se nepodařilo změnit.",
            ].filter(Boolean).join(" ")}
          </p>
        ) : (
          <span><CheckIcon /> Změny se ukládají automaticky</span>
        )}
        <button type="button" className="button button--primary" onClick={() => window.ludone.closeSettings()}>
          Hotovo
        </button>
      </footer>
    </main>
  );
}
