import { useMemo, useState } from "react";
import { AuthErrorScreen } from "./AuthErrorScreen.jsx";
import {
  ArrowRightIcon,
  BrowserIcon,
  CheckIcon,
  LuDoneMark,
  MicIcon,
  TimerIcon,
  VolumeIcon,
} from "./Icons.jsx";

const PERMISSIONS = [
  {
    id: "microphone",
    title: "Mikrofon",
    description: "Hlas u počítače",
    icon: MicIcon,
  },
  {
    id: "system-audio",
    title: "Systémový zvuk",
    description: "Hlasy ze schůzky · zapíná se ručně v Nastavení systému",
    icon: VolumeIcon,
  },
];

const STEPS = ["Vítejte", "Přihlášení", "Oprávnění", "Hotovo"];

export function Onboarding({ onAuthenticated, onComplete }) {
  const [step, setStep] = useState(0);
  const [authBusy, setAuthBusy] = useState(false);
  const [authFailure, setAuthFailure] = useState("");
  const [permissionBusy, setPermissionBusy] = useState("");
  const [permissions, setPermissions] = useState({});
  const allGranted = useMemo(
    () => PERMISSIONS.every((permission) => permissions[permission.id]?.status === "granted"),
    [permissions],
  );

  async function beginAuth() {
    setAuthBusy(true);
    setAuthFailure("");
    try {
      const result = await window.ludone.beginAuth();
      if (!result?.ok) {
        setAuthFailure(
          typeof result?.duvod === "string" && result.duvod.length > 0
            ? result.duvod
            : "neznama",
        );
        return;
      }
      onAuthenticated(result.user);
      setStep(2);
    } catch {
      setAuthFailure("neznama");
    } finally {
      setAuthBusy(false);
    }
  }

  async function grantPermission(id) {
    setPermissionBusy(id);
    try {
      const result = await window.ludone.requestPermission(id);
      setPermissions((current) => ({
        ...current,
        [id]: result || { status: "unknown", granted: false, nextAction: "none" },
      }));
    } catch {
      setPermissions((current) => ({
        ...current,
        [id]: { status: "unknown", granted: false, nextAction: "none" },
      }));
    } finally {
      setPermissionBusy("");
    }
  }

  function permissionState(permission) {
    const result = permissions[permission.id];
    const status = result?.status || "not-determined";
    if (status === "granted") {
      return { granted: true, label: "Povoleno", detail: permission.description };
    }
    if (status === "denied") {
      return {
        granted: false,
        label: "Otevřít Nastavení",
        detail: "Oprávnění bylo odmítnuto. Povolte ho v Nastavení systému.",
        alert: true,
      };
    }
    if (status === "restricted") {
      return {
        granted: false,
        label: "Omezeno systémem",
        detail: "Oprávnění blokuje nastavení systému nebo zásada vaší organizace.",
        alert: true,
        disabled: true,
      };
    }
    if (status === "unknown") {
      return {
        granted: false,
        label: "Znovu ověřit",
        detail: "Stav se nepodařilo zjistit. LuDone oprávnění nepovažuje za udělené.",
        alert: true,
      };
    }
    return {
      granted: false,
      label: permission.id === "system-audio" ? "Otevřít Nastavení" : "Požádat",
      detail: permission.id === "system-audio"
        ? "Záznam obrazovky musí člověk zapnout ručně v Nastavení systému."
        : "macOS se na přístup k mikrofonu zatím nezeptal.",
    };
  }

  if (authFailure) {
    return <AuthErrorScreen busy={authBusy} onRetry={beginAuth} reason={authFailure} />;
  }

  return (
    <main className="onboarding window-surface">
      <div className="onboarding__topbar">
        <div className="brand-lockup"><LuDoneMark size={30} /><span>LuDone</span></div>
        <span className="step-count">{step + 1} / {STEPS.length}</span>
      </div>

      <div className="step-track" aria-label={`Krok ${step + 1} z ${STEPS.length}`}>
        {STEPS.map((item, index) => (
          <span
            key={item}
            className={index <= step ? "is-complete" : ""}
            aria-hidden="true"
          />
        ))}
      </div>

      {step === 0 && (
        <section className="onboarding__content welcome-step">
          <div className="welcome-visual" aria-hidden="true">
            <div className="welcome-visual__ring welcome-visual__ring--one" />
            <div className="welcome-visual__ring welcome-visual__ring--two" />
            <div className="welcome-visual__core"><LuDoneMark size={58} /></div>
            <span className="welcome-visual__node welcome-visual__node--mic"><MicIcon /></span>
            <span className="welcome-visual__node welcome-visual__node--timer"><TimerIcon /></span>
          </div>
          <p className="eyebrow">Spouštěč pro váš pracovní den</p>
          <h1>Rozhovory a čas.<br />Pěkně po ruce.</h1>
          <p className="lead">
            LuDone žije v horní liště a nechá vás jedním klikem nahrávat nebo měřit čas.
          </p>
          <button type="button" className="button button--primary button--wide" onClick={() => setStep(1)}>
            Začít <ArrowRightIcon />
          </button>
          <p className="privacy-note">Žádný archiv navíc. Všechno důležité zůstává na app.ludone.cz.</p>
        </section>
      )}

      {step === 1 && (
        <section className="onboarding__content auth-step">
          <div className="onboarding-icon"><BrowserIcon /></div>
          <p className="eyebrow">Přihlášení přes LuDone</p>
          <h1>Propojte svůj účet</h1>
          <p className="lead">
            Přihlášení patří do prohlížeče. Aplikace nikdy neuvidí vaše heslo — zpět dostane
            jen bezpečný přístupový token.
          </p>
          <div className="auth-flow" aria-label="Průběh přihlášení">
            <div><span>1</span><p><strong>Otevřít LuDone</strong><small>v prohlížeči</small></p></div>
            <i />
            <div><span>2</span><p><strong>Potvrdit přístup</strong><small>bez hesla v aplikaci</small></p></div>
            <i />
            <div><span>3</span><p><strong>Vrátit se sem</strong><small>pomocí callbacku</small></p></div>
          </div>
          <button
            type="button"
            className="button button--primary button--wide"
            disabled={authBusy}
            onClick={beginAuth}
          >
            <BrowserIcon /> {authBusy ? "Čekám na prohlížeč…" : "Přihlásit v prohlížeči"}
          </button>
          <button type="button" className="text-button" onClick={() => setStep(0)}>Zpět</button>
        </section>
      )}

      {step === 2 && (
        <section className="onboarding__content permission-step">
          <div className="onboarding-icon"><MicIcon /></div>
          <p className="eyebrow">Dvě srozumitelná oprávnění</p>
          <h1>Aby LuDone pomohlo</h1>
          <p className="lead">LuDone ukazuje skutečný stav macOS. Záznam obrazovky je potřeba zapnout ručně v Nastavení systému.</p>
          <div className="permission-list">
            {PERMISSIONS.map((permission) => {
              const Icon = permission.icon;
              const state = permissionState(permission);
              return (
                <div
                  className={`permission-row${state.granted ? " is-granted" : ""}`}
                  key={permission.id}
                  role={state.alert ? "alert" : undefined}
                >
                  <span className="permission-row__icon"><Icon /></span>
                  <span className="permission-row__copy">
                    <strong>{permission.title}</strong>
                    <small>{state.detail}</small>
                  </span>
                  <button
                    type="button"
                    className="button button--small"
                    data-testid="permission-action"
                    disabled={state.granted || state.disabled || permissionBusy === permission.id}
                    onClick={() => grantPermission(permission.id)}
                  >
                    {state.granted
                      ? <><CheckIcon /> {state.label}</>
                      : permissionBusy === permission.id ? "Čekám…" : state.label}
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="button button--primary button--wide"
            disabled={!allGranted}
            onClick={() => setStep(3)}
          >
            Pokračovat <ArrowRightIcon />
          </button>
        </section>
      )}

      {step === 3 && (
        <section className="onboarding__content done-step">
          <div className="done-check"><CheckIcon /></div>
          <p className="eyebrow">Všechno je připravené</p>
          <h1>LuDone čeká<br />v horní liště.</h1>
          <p className="lead">
            Odtud spustíte nahrávání a zapnete LuTrack. Bez zbytečného přepínání oken.
          </p>
          <div className="tray-preview" aria-label="Ukázka stavů ikony v horní liště">
            <div><span className="tray-symbol tray-symbol--idle" /><small>Nečinná</small></div>
            <div><span className="tray-symbol tray-symbol--recording" /><small>Nahrává</small></div>
            <div><span className="tray-symbol tray-symbol--tracking" /><small>Měří čas</small></div>
          </div>
          <button type="button" className="button button--primary button--wide" onClick={onComplete}>
            Otevřít můj panel <ArrowRightIcon />
          </button>
        </section>
      )}
    </main>
  );
}
