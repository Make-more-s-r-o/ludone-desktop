import { useEffect, useId, useRef, useState } from "react";
import { TimerIcon } from "../../components/Icons.jsx";
import { formatElapsed, useElapsedTime } from "../../hooks/useElapsedTime.js";

function formatCompactElapsed(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function TrackingCard({
  compact = false,
  onActivityChange,
  todaySummary = null,
  trayCommand = null,
}) {
  const [active, setActive] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [lastMessage, setLastMessage] = useState("");
  const lastTrayCommandId = useRef(null);
  const elapsed = useElapsedTime(active, startedAt);
  const demoNoticeId = useId();
  const demoNotice = (
    <div className="tracking-demo-notice" id={demoNoticeId} role="note">
      <small className="idle-feature-row__notice" role={lastMessage ? "status" : undefined}>
        {lastMessage || "Uložení do LuTracku je zatím ukázkové."}
      </small>
      <span>Ukládání není zapojené. Odměřený čas se nikam neuloží.</span>
    </div>
  );

  function toggleTracking() {
    if (active) {
      setActive(false);
      setStartedAt(null);
      setLastMessage("Čas zastaven · uložení do LuTracku je ukázkové.");
    } else {
      setLastMessage("");
      setStartedAt(Date.now());
      setActive(true);
    }
  }

  useEffect(() => {
    // Ukázka nemá skutečný projekt ani popis k uložení.
    onActivityChange({ active, project: null, description: "" });
  }, [active, onActivityChange]);

  useEffect(() => {
    if (!trayCommand || trayCommand.id === lastTrayCommandId.current) return;
    lastTrayCommandId.current = trayCommand.id;
    if (trayCommand.name === "start-tracking" && !active) {
      setLastMessage("");
      setStartedAt(Date.now());
      setActive(true);
    }
    // Bez téhle větve by položka „Zastavit měření času" v kontextovém menu poslala
    // příkaz, který nikdo nezpracuje — tlačítko by se tvářilo funkčně a nedělalo nic.
    // Testy hlavního procesu to nechytnou: ověřují, že se příkaz ODESLAL, ne že někdo
    // zareagoval. Zjištěno 3. 9. 2026 při konsolidaci.
    if (trayCommand.name === "stop-tracking" && active) {
      setActive(false);
      setStartedAt(null);
      setLastMessage("Čas zastaven · uložení do LuTracku je ukázkové.");
    }
  }, [active, trayCommand]);

  return (
    <section
      className={`feature-card tracking-card${active ? " is-active" : " idle-feature-row has-notice"}`}
      data-activity-state={active ? "tracking" : "idle"}
      data-layout={active && compact ? "compact" : "default"}
      data-testid={active ? undefined : "idle-action-row"}
      aria-label="LuTrack"
    >
      {active && compact ? (
        <div className="tracking-compact">
          <div
            className="activity-status activity-status--tracking"
            data-testid="tracking-running-state"
            role="status"
          >
            <span className="activity-status__dot" aria-hidden="true" />
            <span>Běží ukázka časovače</span>
            <span className="tracking-compact__time" data-panel-height-neutral="true">
              {formatCompactElapsed(elapsed)}
            </span>
          </div>
          <p className="tracking-compact__project">Ukázka bez projektu</p>
          <div className="tracking-compact__actions">
            <button
              type="button"
              className="tracking-compact__stop"
              data-testid="tracking-stop"
              aria-label="Zastavit LuTrack"
              aria-describedby={demoNoticeId}
              onClick={toggleTracking}
            >
              Stop
            </button>
          </div>
        </div>
      ) : active ? (
        <div className="feature-card__header">
          <span className="section-icon section-icon--tracking"><TimerIcon /></span>
          <div>
            <p className="eyebrow">LuTrack · ukázka</p>
            <h2 data-testid="tracking-running-state">Časovač</h2>
          </div>
          <p className="tracking-time" aria-live="polite">{formatElapsed(elapsed)}</p>
        </div>
      ) : (
        <>
          <span className="idle-feature-row__icon"><TimerIcon variant="idle" /></span>
          <div className="idle-feature-row__copy">
            <strong>LuTrack</strong>
            {demoNotice}
            {!lastMessage && todaySummary && (
              <small data-testid="tracking-daily-summary">{todaySummary}</small>
            )}
          </div>
          <button
            type="button"
            className="idle-feature-row__action"
            role="switch"
            aria-checked="false"
            aria-label="Spustit LuTrack"
            aria-describedby={demoNoticeId}
            title="Spustit ukázku časovače"
            onClick={toggleTracking}
          >
            Spustit
          </button>
        </>
      )}

      {active && demoNotice}

      <div className="tracking-controls" hidden={!active || compact}>
        <label className="select-field">
          <span className="sr-only">Projekt</span>
          <select value="" disabled>
            <option value="">Projekty nejsou zapojené</option>
          </select>
        </label>
        <button
          type="button"
          className={`track-toggle${active ? " track-toggle--active" : ""}`}
          data-testid={active ? "tracking-stop" : undefined}
          role="switch"
          aria-checked={active}
          aria-label={active ? "Zastavit LuTrack" : "Spustit LuTrack"}
          aria-describedby={demoNoticeId}
          onClick={toggleTracking}
        >
          <span className="track-toggle__thumb">
            {active ? <span className="stop-square" /> : <span className="play-triangle" />}
          </span>
          <span>{active ? "Stop" : "Start"}</span>
        </button>
      </div>

      <label className="description-field" hidden={!active || compact}>
        <span className="sr-only">Popis práce není zapojený</span>
        <input
          value=""
          disabled
          placeholder="Popis práce není zapojený"
        />
      </label>
    </section>
  );
}
