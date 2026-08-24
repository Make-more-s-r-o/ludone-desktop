import { CalendarIcon } from "../../components/Icons.jsx";

const EVENTS = [
  { id: "design", time: "09:30", title: "Design review · Mobilní aplikace" },
  { id: "product", time: "11:00", title: "Produktový sync" },
  { id: "client", time: "14:30", title: "Konzultace · Studio North" },
];

export function TodayAgenda({
  empty = false,
  recordingActive,
  recordingBusy,
  recordingContext,
  onRecord,
}) {
  return (
    <section className="agenda" aria-labelledby="agenda-title">
      <div className="section-heading">
        <span className="section-icon"><CalendarIcon /></span>
        <div>
          <p className="eyebrow">Čtvrtek 20. srpna</p>
          <h2 id="agenda-title">Co mě dnes čeká</h2>
        </div>
      </div>

      {empty ? (
        <div className="empty-state">
          <div className="empty-state__orb"><CalendarIcon /></div>
          <p>Dnešek je volný.</p>
          <span>Ideální chvíle dotáhnout věci bez dalšího hovoru.</span>
        </div>
      ) : (
        <div className="event-list">
          {EVENTS.map((event) => {
            const isCurrent = recordingActive && recordingContext?.id === event.id;
            return (
              <div className={`event-row${isCurrent ? " event-row--active" : ""}`} key={event.id}>
                <time>{event.time}</time>
                <span className="event-row__title">{event.title}</span>
                <button
                  type="button"
                  className="button button--small"
                  disabled={recordingBusy}
                  onClick={() => onRecord(event)}
                  aria-label={`Nahrát schůzku ${event.title}`}
                >
                  {isCurrent ? "Běží" : "Nahrát"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
