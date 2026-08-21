import { useCallback, useEffect, useMemo, useState } from "react";
import { Onboarding } from "./components/Onboarding.jsx";
import { CloseIcon, LuDoneMark, SettingsIcon } from "./components/Icons.jsx";
import { TodayAgenda } from "./features/calendar/TodayAgenda.jsx";
import { RecordingCard } from "./features/recording/RecordingCard.jsx";
import { TrackingCard } from "./features/tracking/TrackingCard.jsx";

const ONBOARDING_KEY = "ludone.prototype.onboarding-complete";
const DEFAULT_USER = { name: "Daniel Novák", email: "daniel@ludone.cz" };

export function App() {
  const runtime = window.ludone.runtime;
  const initiallyComplete = !runtime.resetOnboarding && window.localStorage.getItem(ONBOARDING_KEY) === "true";
  const [onboardingComplete, setOnboardingComplete] = useState(initiallyComplete);
  const [user, setUser] = useState(initiallyComplete ? DEFAULT_USER : null);
  const [recording, setRecording] = useState({ active: false, busy: false, context: null });
  const [tracking, setTracking] = useState({ active: false });
  const [recordingRequest, setRecordingRequest] = useState(null);

  const trayState = useMemo(() => {
    if (!user) return "signed-out";
    if (recording.active) return "recording";
    if (tracking.active) return "tracking";
    return "idle";
  }, [recording.active, tracking.active, user]);

  const statusCopy = {
    "signed-out": "Nepřihlášeno",
    idle: "Připraveno",
    recording: "Nahrává",
    tracking: "LuTrack běží",
  }[trayState];

  useEffect(() => {
    window.ludone.setTrayState(trayState);
  }, [trayState]);

  const handleRecordingChange = useCallback((nextRecording) => {
    setRecording(nextRecording);
  }, []);

  const handleTrackingChange = useCallback((nextTracking) => {
    setTracking(nextTracking);
  }, []);

  function requestMeetingRecording(event) {
    setRecordingRequest({ id: `${event.id}-${Date.now()}`, event });
  }

  function completeOnboarding() {
    window.localStorage.setItem(ONBOARDING_KEY, "true");
    setUser((current) => current ?? DEFAULT_USER);
    setOnboardingComplete(true);
  }

  if (!onboardingComplete) {
    return <Onboarding onAuthenticated={setUser} onComplete={completeOnboarding} />;
  }

  return (
    <main className="panel window-surface">
      <header className="panel-header">
        <div className="brand-lockup"><LuDoneMark size={30} /><span>LuDone</span></div>
        <div className={`global-status global-status--${trayState}`} aria-live="polite">
          <span /> {statusCopy}
        </div>
        <button
          type="button"
          className="icon-button panel-close"
          aria-label="Skrýt panel"
          onClick={() => window.ludone.hidePanel()}
        >
          <CloseIcon />
        </button>
      </header>

      <div className="panel-scroll">
        <TodayAgenda
          empty={runtime.emptyCalendar}
          recordingActive={recording.active}
          recordingBusy={recording.busy}
          recordingContext={recording.context}
          onRecord={requestMeetingRecording}
        />
        <RecordingCard request={recordingRequest} onActivityChange={handleRecordingChange} />
        <TrackingCard onActivityChange={handleTrackingChange} />
      </div>

      <footer className="panel-footer">
        <div className="account-summary">
          <span className="avatar avatar--small">DN</span>
          <span><strong>{user.name}</strong><small>{user.email}</small></span>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Otevřít nastavení"
          onClick={() => window.ludone.openSettings()}
        >
          <SettingsIcon />
        </button>
      </footer>
    </main>
  );
}
