import { useEffect, useRef, useState } from "react";
import { AuthErrorScreen } from "./AuthErrorScreen.jsx";
import { RecordingTestStep } from "./RecordingTestStep.jsx";
import { createStereoLevelSession } from "../lib/audio-levels.js";
import { MICROPHONE_ONLY_TEXT } from "../features/recording/recording-copy.js";
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

const STEPS = [
  "Vítejte",
  "Přihlášení",
  "Čekání na prohlížeč",
  "Oprávnění",
  "Test záznamu",
  "Hotovo",
];

const AUTH_WAIT_SECONDS = 10 * 60;
const AUTH_URL_POLL_INTERVAL_MS = 250;
const AUTH_COPY_CONFIRMATION_MS = 2_000;
function completionCopy(recordingTestResult) {
  if (recordingTestResult === "passed") {
    return {
      detail: "Oba kanály slyším. Panel najdeš pod ikonou v horní liště.",
      title: "Připraveno",
      verificationState: "both",
    };
  }
  if (recordingTestResult === "microphone-only") {
    return {
      detail: MICROPHONE_ONLY_TEXT,
      title: "Nahrává se omezeně",
      verificationState: "microphone-only",
    };
  }
  return {
    detail: "Bez ní se nedá tvrdit, že to funguje.",
    title: "Neověřeno",
    verificationState: "unverified",
  };
}

function formatCountdown(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function unknownPermissionResult(permission) {
  return {
    permission,
    status: "unknown",
    granted: false,
    nextAction: "none",
    settingsUrl: null,
  };
}

function cancelAuthQuietly() {
  try {
    void Promise.resolve(window.ludone.cancelAuth()).catch(() => {});
  } catch {
    // Při zavírání rendereru už může být preload most nedostupný.
  }
}

export function Onboarding({ onAuthenticated, onComplete, reauthenticate = false, sessionExpired = false, embedded = false }) {
  const [step, setStep] = useState(reauthenticate ? 1 : 0);
  const [authBusy, setAuthBusy] = useState(false);
  const [authDeadline, setAuthDeadline] = useState(0);
  const [authFailure, setAuthFailure] = useState(sessionExpired ? "relace-vyprsela" : "");
  // Adresa se drží jen po dobu čekání; hlavní proces ji po skončení pokusu sám zahodí.
  const [authUrl, setAuthUrl] = useState("");
  const [authUrlAttempt, setAuthUrlAttempt] = useState(0);
  const [authCopyState, setAuthCopyState] = useState("idle");
  const [authSecondsRemaining, setAuthSecondsRemaining] = useState(AUTH_WAIT_SECONDS);
  const [authWaitingActionBusy, setAuthWaitingActionBusy] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState("");
  const [permissions, setPermissions] = useState({});
  const [recordingTestResult, setRecordingTestResult] = useState("not-run");
  const [recordingTestSession, setRecordingTestSession] = useState(null);
  const authAttemptRef = useRef(0);
  const authBusyRef = useRef(false);
  const authCopyRequestRef = useRef(0);
  const authCopyTimerRef = useRef();
  const mountedRef = useRef(true);
  const permissionStatusRequestRef = useRef(0);
  const recordingTestStartedRef = useRef(false);
  const microphoneGranted = permissions.microphone?.status === "granted";
  const systemAudioGranted = permissions["system-audio"]?.status === "granted";
  const completion = completionCopy(recordingTestResult);

  useEffect(() => {
    if (step !== 2 || !authBusy) return undefined;
    let expired = false;
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((authDeadline - Date.now()) / 1_000));
      setAuthSecondsRemaining(remaining);
      if (remaining !== 0 || expired) return;
      expired = true;
      authAttemptRef.current += 1;
      authBusyRef.current = false;
      setAuthBusy(false);
      setAuthUrl("");
      setAuthUrlAttempt(0);
      setAuthFailure("vyprselo");
      cancelAuthQuietly();
    };
    const timer = window.setInterval(updateCountdown, 1_000);
    return () => window.clearInterval(timer);
  }, [authBusy, authDeadline, step]);

  useEffect(() => {
    setAuthUrl("");
    if (step !== 2 || !authBusy || authUrlAttempt === 0) return undefined;
    let current = true;
    let timer;
    // Adresu si vyžádá renderer sám: hlavní proces nemá do panelu cestu, kterou by
    // ji poslal, a `beginAuth` se vrátí až na konci celého pokusu — tedy pozdě.
    // Řetězený timeout nepustí druhý IPC dotaz, dokud první neskončí. Jakmile
    // pokus skončí nebo URL dorazí, cleanup/absence dalšího timeoutu polling ukončí.
    const pollPendingUrl = async () => {
      let url = null;
      try {
        url = await window.ludone?.pendingAuthUrl?.();
      } catch {
        // Dočasná chyba dotazu nesmí odstranit jedinou náhradní cestu do prohlížeče.
      }
      if (!current) return;
      if (typeof url === "string" && url.length > 0) {
        setAuthUrl(url);
        return;
      }
      timer = window.setTimeout(() => {
        void pollPendingUrl();
      }, AUTH_URL_POLL_INTERVAL_MS);
    };
    void pollPendingUrl();
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [authBusy, authUrlAttempt, step]);

  useEffect(() => {
    authCopyRequestRef.current += 1;
    window.clearTimeout(authCopyTimerRef.current);
    authCopyTimerRef.current = undefined;
    setAuthCopyState("idle");
  }, [authUrlAttempt, step]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      authAttemptRef.current += 1;
      authCopyRequestRef.current += 1;
      permissionStatusRequestRef.current += 1;
      window.clearTimeout(authCopyTimerRef.current);
      if (!authBusyRef.current) return;
      authBusyRef.current = false;
      cancelAuthQuietly();
    };
  }, []);

  useEffect(() => {
    if (step !== 3 || typeof window.ludone.getPermissionStatus !== "function") {
      return undefined;
    }
    let active = true;

    const refreshPermissionStatus = async () => {
      const requestId = permissionStatusRequestRef.current + 1;
      permissionStatusRequestRef.current = requestId;
      const results = await Promise.all(PERMISSIONS.map(async ({ id }) => {
        try {
          return await window.ludone.getPermissionStatus(id);
        } catch {
          return unknownPermissionResult(id);
        }
      }));
      if (
        !active
        || !mountedRef.current
        || permissionStatusRequestRef.current !== requestId
      ) return;
      setPermissions((current) => ({
        ...current,
        ...Object.fromEntries(PERMISSIONS.map(({ id }, index) => [
          id,
          results[index] || unknownPermissionResult(id),
        ])),
      }));
    };
    const refreshWhenFocused = () => void refreshPermissionStatus();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshPermissionStatus();
    };

    window.addEventListener("focus", refreshWhenFocused);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      permissionStatusRequestRef.current += 1;
      window.removeEventListener("focus", refreshWhenFocused);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [step]);

  async function beginAuth() {
    const attemptId = authAttemptRef.current + 1;
    authAttemptRef.current = attemptId;
    authBusyRef.current = true;
    setAuthBusy(true);
    setAuthFailure("");
    setAuthUrl("");
    setAuthUrlAttempt(attemptId);
    setAuthDeadline(Date.now() + (AUTH_WAIT_SECONDS * 1_000));
    setAuthSecondsRemaining(AUTH_WAIT_SECONDS);
    setStep(2);
    try {
      const result = await window.ludone.beginAuth();
      if (authAttemptRef.current !== attemptId) return;
      if (!result?.ok) {
        setAuthFailure(
          typeof result?.duvod === "string" && result.duvod.length > 0
            ? result.duvod
            : "neznama",
        );
        return;
      }
      onAuthenticated(result.user);
      if (!reauthenticate) setStep(3);
    } catch {
      if (authAttemptRef.current !== attemptId) return;
      setAuthFailure("neznama");
    } finally {
      if (authAttemptRef.current === attemptId) {
        authBusyRef.current = false;
        setAuthUrl("");
        setAuthUrlAttempt(0);
        setAuthBusy(false);
      }
    }
  }

  async function copyPendingAuthUrl() {
    const requestId = authCopyRequestRef.current + 1;
    authCopyRequestRef.current = requestId;
    window.clearTimeout(authCopyTimerRef.current);
    authCopyTimerRef.current = undefined;
    setAuthCopyState("idle");

    let copied = false;
    try {
      copied = (await window.ludone?.copyPendingAuthUrl?.()) === true;
    } catch {
      copied = false;
    }
    if (!mountedRef.current || authCopyRequestRef.current !== requestId) return;
    if (!copied) {
      setAuthCopyState("error");
      return;
    }

    setAuthCopyState("success");
    authCopyTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current || authCopyRequestRef.current !== requestId) return;
      setAuthCopyState("idle");
      authCopyTimerRef.current = undefined;
    }, AUTH_COPY_CONFIRMATION_MS);
  }

  async function leaveAuthWaiting(retry) {
    if (authWaitingActionBusy) return;
    const actionId = authAttemptRef.current + 1;
    authAttemptRef.current = actionId;
    setAuthUrl("");
    setAuthUrlAttempt(0);
    setAuthWaitingActionBusy(true);
    let shouldRetry = false;
    try {
      await window.ludone.cancelAuth();
      if (!mountedRef.current || authAttemptRef.current !== actionId) return;
      authBusyRef.current = false;
      shouldRetry = retry;
      if (!retry) {
        setAuthBusy(false);
        setStep(1);
      }
    } catch {
      if (!mountedRef.current || authAttemptRef.current !== actionId) return;
      authBusyRef.current = false;
      setAuthFailure("neznama");
      setAuthBusy(false);
    } finally {
      if (mountedRef.current && authAttemptRef.current === actionId) {
        setAuthWaitingActionBusy(false);
      }
    }
    if (shouldRetry && mountedRef.current && authAttemptRef.current === actionId) {
      void beginAuth();
    }
  }

  function enterRecordingTest() {
    if (recordingTestStartedRef.current) return;
    recordingTestStartedRef.current = true;
    setRecordingTestResult("not-run");
    // Volání začíná přímo v click handleru, aby getDisplayMedia zachovalo
    // uživatelskou aktivaci. Komponenta pak převezme hotový promise i cleanup.
    startRecordingTestAttempt();
    setStep(4);
  }

  function continueFromPermissions() {
    if (!microphoneGranted) return;
    if (systemAudioGranted) {
      enterRecordingTest();
      return;
    }
    setRecordingTestResult("microphone-only");
    setStep(5);
  }

  function startRecordingTestAttempt() {
    const controller = new AbortController();
    setRecordingTestSession({
      cancel: () => controller.abort(),
      promise: createStereoLevelSession({ signal: controller.signal }),
    });
  }

  async function grantPermission(id) {
    const requestId = permissionStatusRequestRef.current + 1;
    permissionStatusRequestRef.current = requestId;
    setPermissionBusy(id);
    try {
      const result = await window.ludone.requestPermission(id);
      if (!mountedRef.current || permissionStatusRequestRef.current !== requestId) return;
      setPermissions((current) => ({
        ...current,
        [id]: result || unknownPermissionResult(id),
      }));
    } catch {
      if (!mountedRef.current || permissionStatusRequestRef.current !== requestId) return;
      setPermissions((current) => ({
        ...current,
        [id]: unknownPermissionResult(id),
      }));
    } finally {
      if (mountedRef.current) {
        setPermissionBusy((current) => current === id ? "" : current);
      }
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
    return <AuthErrorScreen busy={authBusy} onRetry={beginAuth} reason={authFailure} embedded={embedded} />;
  }

  const Container = embedded ? "section" : "main";
  return (
    <Container
      className={`onboarding${reauthenticate ? " onboarding--reauthenticate" : ""}${embedded ? " onboarding--embedded" : " window-surface"}`}
    >
      <div className="onboarding__topbar">
        <div className="brand-lockup"><LuDoneMark size={30} /><span>LuDone</span></div>
        {!reauthenticate && <span className="step-count">{step + 1} / {STEPS.length}</span>}
      </div>

      {!reauthenticate && (
        <div className="step-track" aria-label={`Krok ${step + 1} z ${STEPS.length}`}>
          {STEPS.map((item, index) => (
            <span
              key={item}
              className={index <= step ? "is-complete" : ""}
              aria-hidden="true"
            />
          ))}
        </div>
      )}

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
          {!reauthenticate && <p className="eyebrow">Přihlášení přes LuDone</p>}
          <h1>{reauthenticate ? "Nejsi připojený" : "Propojte svůj účet"}</h1>
          <p className="lead">
            {reauthenticate
              ? "Otevře se ti prohlížeč. Po potvrzení se sem vrátíš sám."
              : (
                <>
                  Přihlášení patří do prohlížeče. Aplikace nikdy neuvidí vaše heslo — zpět
                  dostane jen bezpečný přístupový token.
                </>
              )}
          </p>
          {!reauthenticate && (
            <div className="auth-flow" aria-label="Průběh přihlášení">
              <div><span>1</span><p><strong>Otevřít LuDone</strong><small>v prohlížeči</small></p></div>
              <i />
              <div><span>2</span><p><strong>Potvrdit přístup</strong><small>bez hesla v aplikaci</small></p></div>
              <i />
              <div><span>3</span><p><strong>Vrátit se sem</strong><small>pomocí callbacku</small></p></div>
            </div>
          )}
          <button
            type="button"
            className="button button--primary button--wide"
            disabled={authBusy}
            onClick={beginAuth}
          >
            <BrowserIcon /> {authBusy
              ? "Čekám na prohlížeč…"
              : "Přihlásit v prohlížeči"}
          </button>
          {!reauthenticate && (
            <button type="button" className="text-button" onClick={() => setStep(0)}>Zpět</button>
          )}
        </section>
      )}

      {step === 2 && (
        <section
          className="onboarding__content auth-waiting-step"
          data-auth-waiting-state="waiting"
          data-testid="auth-waiting-screen"
        >
          <div className="auth-waiting-spinner" aria-hidden="true" />
          <h1>Čekám na prohlížeč</h1>
          <time
            className="auth-waiting-countdown"
            data-testid="auth-waiting-countdown"
          >
            {formatCountdown(authSecondsRemaining)}
          </time>
          {authUrl && (
            <div className="auth-waiting-address">
              <code data-testid="auth-waiting-url">{authUrl}</code>
              <button
                type="button"
                className="text-button"
                data-testid="auth-waiting-copy"
                onClick={copyPendingAuthUrl}
              >
                {authCopyState === "success" ? "Zkopírováno" : "Kopírovat"}
              </button>
              <p
                aria-atomic="true"
                aria-live="polite"
                className={authCopyState === "error"
                  ? "auth-waiting-copy-feedback"
                  : "sr-only"}
                data-testid="auth-waiting-copy-feedback"
                role="status"
              >
                {authCopyState === "success"
                  ? "Zkopírováno"
                  : authCopyState === "error"
                    ? "Zkopírovat se nepodařilo."
                    : ""}
              </p>
            </div>
          )}
          <div className="auth-waiting-actions">
            <button
              type="button"
              className="button button--primary button--wide"
              data-testid="auth-waiting-retry"
              disabled={authWaitingActionBusy}
              onClick={() => leaveAuthWaiting(true)}
            >
              Zkusit znovu
            </button>
            <button
              type="button"
              className="button button--wide"
              data-testid="auth-waiting-cancel"
              disabled={authWaitingActionBusy}
              onClick={() => leaveAuthWaiting(false)}
            >
              Zrušit
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
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
                  data-permission-id={permission.id}
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
          {microphoneGranted && !systemAudioGranted && (
            <p
              className="permission-mode-note"
              data-testid="microphone-only-note"
              role="status"
            >
              {MICROPHONE_ONLY_TEXT}
            </p>
          )}
          <button
            type="button"
            className="button button--primary button--wide"
            disabled={!microphoneGranted || Boolean(permissionBusy)}
            onClick={continueFromPermissions}
          >
            Pokračovat <ArrowRightIcon />
          </button>
        </section>
      )}

      {step === 4 && recordingTestSession && (
        <RecordingTestStep
          sessionAttempt={recordingTestSession}
          onRetry={startRecordingTestAttempt}
          onPassed={() => {
            setRecordingTestResult("passed");
            setStep(5);
          }}
          onSkipped={(result) => {
            setRecordingTestResult(result);
            setStep(5);
          }}
        />
      )}

      {step === 5 && (
        <section
          className="onboarding__content done-step"
          data-recording-test-result={recordingTestResult}
          data-verification-state={completion.verificationState}
        >
          <div className="done-check">
            {completion.verificationState === "both"
              ? <CheckIcon />
              : completion.verificationState === "microphone-only" ? <MicIcon /> : <VolumeIcon />}
          </div>
          <p className="eyebrow">{completion.title}</p>
          <h1>LuDone čeká<br />v horní liště.</h1>
          <p className="lead">{completion.detail}</p>
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
    </Container>
  );
}
