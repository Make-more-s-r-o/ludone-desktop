import { useEffect, useState } from "react";
import { ChevronDownIcon, TimerIcon } from "../../components/Icons.jsx";
import { formatElapsed, useElapsedTime } from "../../hooks/useElapsedTime.js";

const PROJECTS = ["LuDone Desktop", "Web · klientská zóna", "Interní provoz"];

export function TrackingCard({ onActivityChange, todaySummary = null }) {
  const [project, setProject] = useState(PROJECTS[0]);
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [lastMessage, setLastMessage] = useState("");
  const elapsed = useElapsedTime(active, startedAt);

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
    onActivityChange({ active, project, description });
  }, [active, description, onActivityChange, project]);

  return (
    <section
      className={`feature-card tracking-card${active ? " is-active" : " idle-feature-row"}${!active && lastMessage ? " has-notice" : ""}`}
      data-testid={active ? undefined : "idle-action-row"}
      aria-label="LuTrack"
    >
      {active ? (
        <div className="feature-card__header">
          <span className="section-icon section-icon--tracking"><TimerIcon /></span>
          <div>
            <p className="eyebrow">LuTrack</p>
            <h2>Časovač</h2>
          </div>
          <p className="tracking-time" aria-live="polite">{formatElapsed(elapsed)}</p>
        </div>
      ) : (
        <>
          <span className="idle-feature-row__icon"><TimerIcon variant="idle" /></span>
          <span className="idle-feature-row__copy">
            <strong>LuTrack</strong>
            {lastMessage ? (
              <small className="idle-feature-row__notice" role="status">
                {lastMessage}
              </small>
            ) : todaySummary && (
              <small data-testid="tracking-daily-summary">{todaySummary}</small>
            )}
          </span>
          <button
            type="button"
            className="idle-feature-row__action"
            role="switch"
            aria-checked="false"
            aria-label="Spustit LuTrack"
            onClick={toggleTracking}
          >
            Spustit
          </button>
        </>
      )}

      <div className="tracking-controls" hidden={!active}>
        <label className="select-field">
          <span className="sr-only">Projekt</span>
          <select value={project} disabled={active} onChange={(event) => setProject(event.target.value)}>
            {PROJECTS.map((item) => <option key={item}>{item}</option>)}
          </select>
          <ChevronDownIcon />
        </label>
        <button
          type="button"
          className={`track-toggle${active ? " track-toggle--active" : ""}`}
          role="switch"
          aria-checked={active}
          aria-label={active ? "Zastavit LuTrack" : "Spustit LuTrack"}
          onClick={toggleTracking}
        >
          <span className="track-toggle__thumb">
            {active ? <span className="stop-square" /> : <span className="play-triangle" />}
          </span>
          <span>{active ? "Stop" : "Start"}</span>
        </button>
      </div>

      <label className="description-field" hidden={!active}>
        <span className="sr-only">Volitelný popis práce</span>
        <input
          value={description}
          disabled={active}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Co právě dělám? (volitelné)"
        />
      </label>
    </section>
  );
}
