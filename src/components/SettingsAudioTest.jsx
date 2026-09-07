import { useRef, useState } from "react";
import { createStereoLevelSession } from "../lib/audio-levels.js";
import { RecordingTestStep } from "./RecordingTestStep.jsx";
import { MicIcon } from "./Icons.jsx";

export function SettingsAudioTest() {
  const [sessionAttempt, setSessionAttempt] = useState(null);
  const attemptRef = useRef(null);

  function stopTest() {
    attemptRef.current?.cancel();
    attemptRef.current = null;
    setSessionAttempt(null);
  }

  function startTest() {
    attemptRef.current?.cancel();
    const controller = new AbortController();
    // Zachytávání musí začít přímo při kliknutí kvůli getDisplayMedia.
    // RecordingTestStep převezme měření i uvolnění stop při odpojení komponenty.
    const attempt = {
      cancel: () => controller.abort(),
      promise: createStereoLevelSession({ signal: controller.signal }),
    };
    attemptRef.current = attempt;
    setSessionAttempt(attempt);
  }

  return (
    <section className="settings-group" aria-labelledby="settings-audio-test-title">
      <div className="settings-group__heading">
        <span><MicIcon /></span>
        <div><h2 id="settings-audio-test-title">Zkouška zvuku</h2></div>
      </div>
      <div className="settings-row">
        <div>
          <strong>Vyzkoušej mikrofon a ostatní zvuk</strong>
          <small>Zkouška se neukládá. Spustí se až po kliknutí.</small>
        </div>
        <button type="button" className="button button--small" onClick={sessionAttempt ? stopTest : startTest}>
          {sessionAttempt ? "Zastavit zkoušku" : "Spustit zkoušku"}
        </button>
      </div>
      {sessionAttempt && (
        <RecordingTestStep
          variant="settings"
          sessionAttempt={sessionAttempt}
          onRetry={startTest}
        />
      )}
    </section>
  );
}
