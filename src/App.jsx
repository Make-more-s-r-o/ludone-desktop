import { useCallback, useEffect, useRef, useState } from "react";
import { Onboarding } from "./components/Onboarding.jsx";
import { LuDoneMark } from "./components/Icons.jsx";
import { PanelContentHeightReporter } from "./components/PanelContentHeightReporter.jsx";
import { RecordingCard } from "./features/recording/RecordingCard.jsx";
import { QueueCard } from "./features/queue/QueueCard.jsx";
import { TrackingCard } from "./features/tracking/TrackingCard.jsx";
import { queueFooterStatus, queuePanelSummary } from "./lib/panel.js";

const ONBOARDING_KEY = "ludone.prototype.onboarding-complete";
const QUEUE_REFRESH_INTERVAL_MS = 1_000;

function normalizeUser(value) {
  const email = typeof value?.email === "string" ? value.email.trim() : "";
  const name = typeof value?.name === "string" ? value.name.trim() : "";
  if (!name && !email) return null;
  return { name: name || email, email };
}

export function App() {
  const runtime = window.ludone.runtime;
  const initiallyComplete = !runtime.resetOnboarding && window.localStorage.getItem(ONBOARDING_KEY) === "true";
  const [onboardingComplete, setOnboardingComplete] = useState(initiallyComplete);
  const [user, setUser] = useState(null);
  const [sessionExists, setSessionExists] = useState(null);
  const [recording, setRecording] = useState({ active: false, systemAudioState: "inactive" });
  const [tracking, setTracking] = useState({ active: false });
  const [queueSnapshot, setQueueSnapshot] = useState({ items: null, status: null });
  const [queueExpanded, setQueueExpanded] = useState(false);
  const [trayCommand, setTrayCommand] = useState(null);
  const authSessionRequestId = useRef(0);
  const queueRequestId = useRef(0);
  const trayCommandId = useRef(0);
  const panelActionsAvailableRef = useRef(onboardingComplete && sessionExists === true);
  panelActionsAvailableRef.current = onboardingComplete && sessionExists === true;

  const refreshAuthSession = useCallback(({ suspendActions = false } = {}) => {
    const requestId = authSessionRequestId.current + 1;
    authSessionRequestId.current = requestId;
    if (suspendActions) setSessionExists(null);
    const hasAuthSession = window.ludone.hasAuthSession;
    if (typeof hasAuthSession !== "function") {
      setSessionExists(false);
      return;
    }

    void Promise.resolve()
      .then(() => hasAuthSession())
      .then((result) => {
        if (requestId === authSessionRequestId.current) setSessionExists(result === true);
      })
      .catch(() => {
        if (requestId === authSessionRequestId.current) setSessionExists(false);
      });
  }, []);

  useEffect(() => {
    refreshAuthSession({ suspendActions: true });

    return () => {
      authSessionRequestId.current += 1;
    };
  }, [refreshAuthSession]);

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
      signedIn: sessionExists,
      // Zvukový stream žije jen v rendereru. Posíláme úzký boolean; jméno stavu
      // i ověření, že opravdu běží nahrávání, zůstává hlavnímu procesu.
      systemAudioLost: recording.active && recording.systemAudioState === "lost",
      tracking: tracking.active,
    });
  }, [recording.active, recording.systemAudioState, sessionExists, tracking.active]);

  useEffect(() => {
    if (typeof window.ludone.onTrayCommand !== "function") return undefined;
    return window.ludone.onTrayCommand((name) => {
      // Během onboardingu nejsou akční karty namountované. Příkaz přesto
      // spotřebujeme, ale neuchováváme: jinak by se provedl opožděně až po jeho dokončení.
      if (!panelActionsAvailableRef.current) return;
      trayCommandId.current += 1;
      setTrayCommand({ id: trayCommandId.current, name });
    });
  }, []);

  useEffect(() => {
    if (sessionExists !== true) setTrayCommand(null);
  }, [sessionExists]);

  const applyQueueItems = useCallback((items) => {
    const status = queueFooterStatus(items);
    const detailsAvailable = queuePanelSummary(items) !== null;
    setQueueSnapshot({ items: status ? items : null, status });
    if (!detailsAvailable) setQueueExpanded(false);
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
    if (typeof window.ludone.retryQueue !== "function") return;
    const result = await window.ludone.retryQueue();
    if (Array.isArray(result?.items)) applyQueueItems(result.items);
    await refreshQueueStatus();
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

  const handleTrackingChange = useCallback((nextTracking) => {
    setTracking(nextTracking);
  }, []);

  function rememberUser(nextUser) {
    authSessionRequestId.current += 1;
    setSessionExists(true);
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

  if (!onboardingComplete) {
    return (
      <PanelContentHeightReporter>
        <Onboarding onAuthenticated={rememberUser} onComplete={completeOnboarding} />
      </PanelContentHeightReporter>
    );
  }

  if (sessionExists === false) {
    return (
      <PanelContentHeightReporter>
        <Onboarding reauthenticate onAuthenticated={rememberUser} />
      </PanelContentHeightReporter>
    );
  }

  if (sessionExists === null) {
    return (
      <PanelContentHeightReporter>
        <main
          aria-busy="true"
          className="panel window-surface"
          data-panel-state="checking-session"
        >
          <header className="panel-header">
            <div className="panel-identity">
              <LuDoneMark size={22} variant="panel" />
              <span className="panel-identity__copy">
                <strong>LuDone</strong>
              </span>
            </div>
          </header>
        </main>
      </PanelContentHeightReporter>
    );
  }

  const bothActivitiesRunning = recording.active && tracking.active;
  const queueStatus = queueSnapshot.status;
  const queueDetailsAvailable = queuePanelSummary(queueSnapshot.items) !== null;
  const queueScreenVisible = queueExpanded && queueDetailsAvailable;

  return (
    <PanelContentHeightReporter>
      <main
        className="panel window-surface"
        data-panel-view={queueScreenVisible ? "queue" : "main"}
        data-panel-state={bothActivitiesRunning ? "recording-and-tracking" : "single-or-idle"}
      >
        <header className="panel-header">
          <div className="panel-identity">
            <LuDoneMark size={22} variant="panel" />
            <span className="panel-identity__copy">
              <strong>LuDone</strong>
              <small data-auth-state="signed-in">
                {user ? `${user.name} · připojeno` : "Přihlášeno"}
              </small>
            </span>
          </div>
        </header>

        <div className="panel-scroll">
          {queueScreenVisible && (
            <QueueCard
              items={queueSnapshot.items}
              onRetry={typeof window.ludone.retryQueue === "function" ? retryQueueNow : undefined}
            />
          )}
          <RecordingCard
            compact={bothActivitiesRunning}
            onActivityChange={handleRecordingChange}
            trayCommand={trayCommand}
          />
          <TrackingCard
            compact={bothActivitiesRunning}
            onActivityChange={handleTrackingChange}
            trayCommand={trayCommand}
          />
        </div>

        <footer className="panel-footer">
          {queueStatus && queueDetailsAvailable && (
            <button
              type="button"
              className={`queue-status queue-status--button queue-status--${queueStatus.tone}`}
              data-testid="queue-status"
              aria-controls="queue-screen"
              aria-expanded={queueScreenVisible}
              onClick={() => setQueueExpanded((expanded) => !expanded)}
            >
              <span className="queue-status__dot" aria-hidden="true" />
              <span role="status">{queueStatus.text}</span>
            </button>
          )}
          {queueStatus && !queueDetailsAvailable && (
            <div
              className={`queue-status queue-status--${queueStatus.tone}`}
              data-testid="queue-status"
              role="status"
            >
              <span className="queue-status__dot" aria-hidden="true" />
              <span>{queueStatus.text}</span>
            </div>
          )}
          <button
            type="button"
            className="panel-settings-button"
            aria-label="Otevřít nastavení"
            onClick={() => window.ludone.openSettings()}
          >
            Nastavení
          </button>
        </footer>
      </main>
    </PanelContentHeightReporter>
  );
}
