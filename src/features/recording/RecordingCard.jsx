import { useEffect, useRef, useState } from "react";
import { MicIcon, VolumeIcon } from "../../components/Icons.jsx";
import { formatElapsed, useElapsedTime } from "../../hooks/useElapsedTime.js";

export function RecordingCard({ request, onActivityChange }) {
  const [session, setSession] = useState({ active: false, startedAt: null, context: null });
  const [lastMessage, setLastMessage] = useState("");
  const handledRequest = useRef(null);
  const elapsed = useElapsedTime(session.active, session.startedAt);

  function start(context = null) {
    setLastMessage("");
    setSession({ active: true, startedAt: Date.now(), context });
  }

  function stop() {
    setSession({ active: false, startedAt: null, context: null });
    setLastMessage("Nahrávání ukončeno · odeslání je v této kostře jen naznačené.");
  }

  useEffect(() => {
    if (!request || request.id === handledRequest.current || session.active) return;
    handledRequest.current = request.id;
    start(request.event);
  }, [request, session.active]);

  useEffect(() => {
    onActivityChange({ active: session.active, context: session.context });
  }, [onActivityChange, session.active, session.context]);

  return (
    <section className={`feature-card recording-card${session.active ? " is-active" : ""}`}>
      <div className="feature-card__header">
        <span className="section-icon section-icon--recording"><MicIcon /></span>
        <div>
          <p className="eyebrow">Zachytit rozhovor</p>
          <h2>Nahrávání</h2>
        </div>
        <span className={`status-chip${session.active ? " status-chip--active" : ""}`}>
          {session.active ? "Nahrává" : "Připraveno"}
        </span>
      </div>

      {session.active ? (
        <div className="recording-live">
          <div>
            <p className="live-context">
              {session.context?.title ?? "Rychlá nahrávka"}
            </p>
            <p className="elapsed" aria-live="polite">{formatElapsed(elapsed)}</p>
          </div>
          <div className="source-line"><VolumeIcon /> Mikrofon + systémový zvuk</div>
          <button type="button" className="button button--stop button--wide" onClick={stop}>
            <span className="stop-square" /> Zastavit nahrávání
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="button button--primary button--wide recording-start"
            onClick={() => start()}
          >
            <span className="record-dot" /> Spustit nahrávání
          </button>
          {lastMessage && <p className="inline-note" role="status">{lastMessage}</p>}
        </>
      )}
    </section>
  );
}
