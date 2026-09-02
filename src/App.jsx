import { useCallback, useEffect, useRef, useState } from "react";
import { Onboarding } from "./components/Onboarding.jsx";
import { LuDoneMark } from "./components/Icons.jsx";
import { RecordingCard } from "./features/recording/RecordingCard.jsx";
import { TrackingCard } from "./features/tracking/TrackingCard.jsx";
import { queueFooterStatus } from "./lib/panel.js";

const ONBOARDING_KEY = "ludone.prototype.onboarding-complete";
const USER_KEY = "ludone.panel.authenticated-user";

function normalizeUser(value) {
  const email = typeof value?.email === "string" ? value.email.trim() : "";
  const name = typeof value?.name === "string" ? value.name.trim() : "";
  if (!name && !email) return null;
  return { name: name || email, email };
}

function readStoredUser() {
  try {
    return normalizeUser(JSON.parse(window.localStorage.getItem(USER_KEY)));
  } catch {
    return null;
  }
}

export function App() {
  const runtime = window.ludone.runtime;
  const initiallyComplete = !runtime.resetOnboarding && window.localStorage.getItem(ONBOARDING_KEY) === "true";
  const [onboardingComplete, setOnboardingComplete] = useState(initiallyComplete);
  const [user, setUser] = useState(() => (initiallyComplete ? readStoredUser() : null));
  const [connectionVerified, setConnectionVerified] = useState(false);
  const [recording, setRecording] = useState({ active: false });
  const [tracking, setTracking] = useState({ active: false });
  const [queueStatus, setQueueStatus] = useState(null);
  const queueRequestId = useRef(0);

  // Hlásíme FAKTA, ne stav. Co z nich lišta ukáže, rozhoduje hlavní proces — jinak by
  // po pádu tohohle okna zůstala ikona viset na tom, co jsme řekli naposledy.
  useEffect(() => {
    window.ludone.reportTrayFacts({ signedIn: Boolean(user), tracking: tracking.active });
  }, [user, tracking.active]);

  const refreshQueueStatus = useCallback(async () => {
    const requestId = queueRequestId.current + 1;
    queueRequestId.current = requestId;
    if (typeof window.ludone.listQueue !== "function") {
      if (requestId === queueRequestId.current) setQueueStatus(null);
      return;
    }
    try {
      const nextStatus = queueFooterStatus(await window.ludone.listQueue());
      if (requestId === queueRequestId.current) setQueueStatus(nextStatus);
    } catch {
      if (requestId === queueRequestId.current) setQueueStatus(null);
    }
  }, []);

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

  const handleRecordingChange = useCallback((nextRecording) => {
    setRecording(nextRecording);
  }, []);

  const handleTrackingChange = useCallback((nextTracking) => {
    setTracking(nextTracking);
  }, []);

  function rememberUser(nextUser) {
    const normalizedUser = normalizeUser(nextUser);
    if (!normalizedUser) return;
    setUser(normalizedUser);
    setConnectionVerified(true);
    window.localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
  }

  function completeOnboarding() {
    window.localStorage.setItem(ONBOARDING_KEY, "true");
    setOnboardingComplete(true);
  }

  if (!onboardingComplete) {
    return <Onboarding onAuthenticated={rememberUser} onComplete={completeOnboarding} />;
  }

  return (
    <main className="panel window-surface">
      <header className="panel-header">
        <div className="panel-identity">
          <LuDoneMark size={22} variant="panel" />
          <span className="panel-identity__copy">
            <strong>LuDone</strong>
            <small>
              {user
                ? `${user.name} · ${connectionVerified ? "připojeno" : "připojení neověřeno"}`
                : "Připojení neověřeno"}
            </small>
          </span>
        </div>
      </header>

      <div className="panel-scroll">
        <RecordingCard onActivityChange={handleRecordingChange} />
        <TrackingCard onActivityChange={handleTrackingChange} />
      </div>

      <footer className="panel-footer">
        {queueStatus && (
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
  );
}
