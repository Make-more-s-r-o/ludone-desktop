import "./features/recording/panel-polish.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Onboarding } from "./components/Onboarding.jsx";
import { OsaShell } from "./components/osa/index.js";
import { SettingsApp } from "./components/Settings.jsx";
import { useElapsedTime, formatElapsed } from "./hooks/useElapsedTime.js";
import { PanelContentHeightReporter } from "./components/PanelContentHeightReporter.jsx";
import { DesktopConnectivityNotice } from "./components/DesktopChrome.jsx";
import { ApplicationUpdateStatus } from "./components/ApplicationUpdateStatus.jsx";
import { RecordingCard } from "./features/recording/RecordingCard.jsx";
import { QueueCard } from "./features/queue/QueueCard.jsx";
import { RecordingDayPreview } from "./features/recordings/RecordingDayPreview.jsx";
import { queueFooterStatus, queuePanelSummary } from "./lib/panel.js";

const ONBOARDING_KEY = "ludone.prototype.onboarding-complete";
const QUEUE_REFRESH_INTERVAL_MS = 1_000;

function queueItemsFingerprint(items) {
  if (!Array.isArray(items)) return null;
  try {
    return JSON.stringify(items);
  } catch {
    return null;
  }
}

function normalizeUser(value) {
  const email = typeof value?.email === "string" ? value.email.trim() : "";
  const name = typeof value?.name === "string" ? value.name.trim() : "";
  if (!name && !email) return null;
  return { name: name || email, email };
}

export function App() {
  const runtime = window.ludone.runtime;
  const initiallyComplete = !runtime.resetOnboarding
    && window.localStorage.getItem(ONBOARDING_KEY) === "true";
  const [onboardingComplete, setOnboardingComplete] = useState(initiallyComplete);
  const [user, setUser] = useState(null);
  const [sessionState, setSessionState] = useState(null);
  const sessionExists = sessionState === null ? null : sessionState === "valid";
  const [recording, setRecording] = useState({ active: false, systemAudioState: "inactive" });
  const tracking = { active: false };
  const [page, setPage] = useState("home");
  const [settingsTab, setSettingsTab] = useState("account");
  const [authRequested, setAuthRequested] = useState(false);
  const elapsed = useElapsedTime(recording.active, recording.startedAt);
  const [queueSnapshot, setQueueSnapshot] = useState({ items: null, status: null, unavailable: false });
  const [queueRetryFeedback, setQueueRetryFeedback] = useState(null);
  const [trayCommand, setTrayCommand] = useState(null);
  const recordingCardRef = useRef(null);
  const authSessionRequestId = useRef(0);
  const queueRequestId = useRef(0);
  const queueItemsFingerprintRef = useRef(null);
  const trayCommandId = useRef(0);
  const panelActionsAvailable = onboardingComplete && sessionExists === true;
  const recordingControlsAvailable = recording.active || recording.pendingSave;
  const recordingControlsAvailableRef = useRef(recordingControlsAvailable);
  recordingControlsAvailableRef.current = recordingControlsAvailable;
  const panelActionsAvailableRef = useRef(panelActionsAvailable);
  panelActionsAvailableRef.current = panelActionsAvailable;

  const refreshAuthSession = useCallback(({ suspendActions = false } = {}) => {
    const requestId = authSessionRequestId.current + 1;
    authSessionRequestId.current = requestId;
    if (suspendActions) setSessionState(null);
    const getAuthSessionState = window.ludone.getAuthSessionState;
    const hasAuthSession = window.ludone.hasAuthSession;
    if (typeof getAuthSessionState !== "function" && typeof hasAuthSession !== "function") {
      setSessionState("none");
      return;
    }

    return Promise.resolve()
      .then(() => typeof getAuthSessionState === "function"
        ? getAuthSessionState()
        : Promise.resolve(hasAuthSession()).then((exists) => exists === true ? "valid" : "none"))
      .then((result) => {
        if (requestId === authSessionRequestId.current) {
          setSessionState(["valid", "expired"].includes(result) ? result : "none");
        }
      })
      .catch(() => {
        if (requestId === authSessionRequestId.current) setSessionState("none");
      });
  }, []);

  useEffect(() => {
    refreshAuthSession({ suspendActions: true });

    return () => {
      authSessionRequestId.current += 1;
    };
  }, [refreshAuthSession]);

  useEffect(() => {
    if (sessionState !== "valid" || typeof window.ludone.getAuthSessionState !== "function") return;
    // Vypršení není změna souboru ani fokusu. Otevřený panel ho musí zjistit sám.
    let cancelled = false;
    let timer;
    const poll = async () => {
      await refreshAuthSession();
      if (!cancelled) timer = window.setTimeout(poll, 1_000);
    };
    timer = window.setTimeout(poll, 1_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [refreshAuthSession, sessionState]);

  useEffect(() => {
    const refreshWhenFocused = () => refreshAuthSession();
    const refreshWhenShown = () => {
      if (document.visibilityState === "visible") refreshAuthSession();
    };
    const unsubscribe = typeof window.ludone.onAuthSessionChanged === "function"
      ? window.ludone.onAuthSessionChanged(() => {
        refreshAuthSession({ suspendActions: true });
      })
      : undefined;

    // Ve stavu bez session necháváme jen autoritativní oznámení z main procesu.
    // Návrat fokusu z OAuth prohlížeče tak rozpracované přihlášení neodmountuje.
    if (sessionExists === true) {
      window.addEventListener("focus", refreshWhenFocused);
      document.addEventListener("visibilitychange", refreshWhenShown);
    }
    return () => {
      window.removeEventListener("focus", refreshWhenFocused);
      document.removeEventListener("visibilitychange", refreshWhenShown);
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [refreshAuthSession, sessionExists]);

  // Hlásíme FAKTA, ne stav. Co z nich lišta ukáže, rozhoduje hlavní proces — jinak by
  // po pádu tohohle okna zůstala ikona viset na tom, co jsme řekli naposledy.
  useEffect(() => {
    if (typeof sessionExists !== "boolean") return;
    window.ludone.reportTrayFacts({
      panelActionsAvailable,
      signedIn: sessionExists,
      // Zvukový stream žije jen v rendereru. Posíláme úzký boolean; jméno stavu
      // i ověření, že opravdu běží nahrávání, zůstává hlavnímu procesu.
      systemAudioLost: recording.active && recording.systemAudioState === "lost",
      tracking: tracking.active,
    });
  }, [panelActionsAvailable, recording.active, recording.systemAudioState, sessionExists, tracking.active]);

  useEffect(() => {
    if (typeof window.ludone.onTrayCommand !== "function") return undefined;
    return window.ludone.onTrayCommand((name) => {
      // Během onboardingu nejsou akční karty namountované. Příkaz přesto
      // spotřebujeme, ale neuchováváme: jinak by se provedl opožděně až po jeho dokončení.
      if (!panelActionsAvailableRef.current
        && !(recordingControlsAvailableRef.current && name === "stop-recording")) return;
      trayCommandId.current += 1;
      setTrayCommand({ id: trayCommandId.current, name });
    });
  }, []);

  useEffect(() => {
    if (sessionExists !== true) {
      setTrayCommand(null);
      setQueueRetryFeedback(null);
    }
  }, [sessionExists]);

  const applyQueueItems = useCallback((items, { preserveRetryFeedback = false } = {}) => {
    const nextFingerprint = queueItemsFingerprint(items);
    if (!preserveRetryFeedback && nextFingerprint !== queueItemsFingerprintRef.current) {
      setQueueRetryFeedback(null);
    }
    queueItemsFingerprintRef.current = nextFingerprint;
    const status = queueFooterStatus(items);
    setQueueSnapshot({ items: status ? items : null, status, unavailable: status === null });

  }, []);

  const refreshQueueStatus = useCallback(async () => {
    const requestId = queueRequestId.current + 1;
    queueRequestId.current = requestId;
    if (typeof window.ludone.listQueue !== "function") {
      if (requestId === queueRequestId.current) {
        applyQueueItems(null);
      }
      return;
    }
    try {
      const items = await window.ludone.listQueue();
      if (requestId === queueRequestId.current) {
        applyQueueItems(items);
      }
    } catch {
      if (requestId === queueRequestId.current) {
        applyQueueItems(null);
      }
    }
  }, [applyQueueItems]);

  const retryQueueNow = useCallback(async () => {
    if (!panelActionsAvailableRef.current) return;
    if (typeof window.ludone.retryQueue !== "function") return;
    // Retry je novější autoritativní požadavek; žádné dříve zahájené čtení
    // nesmí později přepsat jeho výsledek ani zpětnou vazbu po výjimce.
    queueRequestId.current += 1;
    const result = await window.ludone.retryQueue();
    if (Array.isArray(result?.items)) {
      applyQueueItems(result.items, { preserveRetryFeedback: true });
      return result;
    }
    await refreshQueueStatus();
    return result;
  }, [applyQueueItems, refreshQueueStatus]);

  useEffect(() => {
    const refreshWhenShown = () => {
      if (document.visibilityState === "visible") void refreshQueueStatus();
    };
    document.addEventListener("visibilitychange", refreshWhenShown);
    return () => {
      queueRequestId.current += 1;
      document.removeEventListener("visibilitychange", refreshWhenShown);
    };
  }, [refreshQueueStatus]);

  useEffect(() => {
    if (!recording.active && !tracking.active) {
      void refreshQueueStatus();
    }
  }, [recording.active, refreshQueueStatus, tracking.active]);

  useEffect(() => {
    if (!onboardingComplete) return undefined;

    let cancelled = false;
    let timeoutId;

    const refreshVisibleQueue = async () => {
      if (document.visibilityState === "visible") {
        await refreshQueueStatus();
      }
      if (!cancelled) {
        timeoutId = window.setTimeout(refreshVisibleQueue, QUEUE_REFRESH_INTERVAL_MS);
      }
    };

    timeoutId = window.setTimeout(refreshVisibleQueue, QUEUE_REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [onboardingComplete, refreshQueueStatus]);

  const handleRecordingChange = useCallback((nextRecording) => {
    setRecording(nextRecording);
  }, []);


  function rememberUser(nextUser) {
    setAuthRequested(false);
    authSessionRequestId.current += 1;
    setSessionState("valid");
    const normalizedUser = normalizeUser(nextUser);
    if (!normalizedUser) {
      setUser(null);
      return;
    }
    setUser(normalizedUser);
  }

  function completeOnboarding() {
    window.localStorage.setItem(ONBOARDING_KEY, "true");
    setOnboardingComplete(true);
  }

  useEffect(() => window.ludone.onSettingsTabRequested?.((tab) => {
    setSettingsTab(tab);
    setPage(["day", "recordingQueue"].includes(tab) ? "library" : "settings");
  }), []);
  useEffect(() => {
    const nextPage = authRequested || (!onboardingComplete && !recordingControlsAvailable) ? "onboarding" : page;
    window.ludone.setPanelPage?.(nextPage)?.catch(() => {});
  }, [onboardingComplete, recordingControlsAvailable, page, authRequested]);

  function navigate(next) {
    setPage(next);
    if (next === "home" && recording.pendingSave) {
      window.requestAnimationFrame(() => document.querySelector(".recording-card--saved input")?.focus());
    }
  }

  const shellPage = authRequested || (!onboardingComplete && !recordingControlsAvailable) ? "onboarding" : page;
  const summary = queuePanelSummary(queueSnapshot.items);
  return (
    <PanelContentHeightReporter fixedHeight={660}>
      <OsaShell page={shellPage} onNavigate={navigate}
        onClose={() => window.ludone.hidePanel()}
        queueCount={summary ? summary.waitingCount + summary.failedCount + summary.humanActionCount : 0}
        recording={{ ...recording, elapsed: formatElapsed(elapsed), onStop: () => recordingCardRef.current?.stop() }}>
        <DesktopConnectivityNotice />
        <ApplicationUpdateStatus showVersion={page === "updates"} allowManualCheck={page === "updates"} />
        {shellPage === "onboarding" && <>
          <Onboarding reauthenticate={onboardingComplete} sessionExpired={sessionState === "expired"} onAuthenticated={rememberUser} onComplete={completeOnboarding} />
          <button type="button" className="button" onClick={() => { setOnboardingComplete(true); setAuthRequested(false); }}>Nahrávat bez přihlášení</button>
        </>}
        {/* Záznam zůstává namountovaný: přepnutí stránky nesmí zničit streamy. */}
        <section hidden={shellPage !== "home"} aria-label="Nahrávání schůzky">
          <RecordingCard ref={recordingCardRef} canSend={panelActionsAvailable}
            onActivityChange={handleRecordingChange}
            onOpenSources={() => { setSettingsTab("audio"); navigate("settings"); }} trayCommand={trayCommand} />
          {!recording.active && !recording.pendingSave && <>
            <RecordingDayPreview items={queueSnapshot.items} unavailable={queueSnapshot.unavailable} onOpenDay={() => navigate("library")} />
            <p className="osa-lutrack" aria-disabled="true">LuTrack <small>Připravujeme</small></p>
          </>}
          {sessionExists === false && <p role="status">{sessionState === "expired" ? "Přihlášení vypršelo." : "Místní režim."} Nahrávky zůstávají na tomto Macu.
            <button type="button" className="button button--small" onClick={() => { setAuthRequested(true); }}>Přihlásit se</button>
          </p>}
        </section>
        {shellPage === "queue" && <>
          {queueSnapshot.unavailable && <p role="alert">Stav fronty není dostupný.</p>}
          <QueueCard items={queueSnapshot.items} onRetry={panelActionsAvailable ? retryQueueNow : undefined} onRetryFeedback={setQueueRetryFeedback} retryError={queueRetryFeedback} />
          <SettingsApp embedded initialSection="recordingQueue" queueOnly />
        </>}
        {shellPage === "library" && <SettingsApp embedded initialSection="day" />}
        {shellPage === "settings" && <>
          {sessionExists === false && <button type="button" className="button" onClick={() => setAuthRequested(true)}>Přihlásit se</button>}
          <SettingsApp key={settingsTab} embedded initialSection={settingsTab} />
        </>}
        {shellPage === "updates" && <p>Před instalací aktualizace bezpečně dokončíme nahrávání i uložení.</p>}
        {recording.pendingSave && page !== "home" && <button type="button" className="button button--primary" onClick={() => navigate("home")}>Dokončit uložení</button>}
      </OsaShell>
    </PanelContentHeightReporter>
  );
}
