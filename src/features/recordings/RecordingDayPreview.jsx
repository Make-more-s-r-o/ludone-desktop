import { ArchiveIcon, ArrowRightIcon } from "../../components/Icons.jsx";

function safeItems(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object"
    && item.kind === "recording" && typeof item.id === "string")
    .map((item) => ({
      recordingInProgress: item.recordingInProgress === true,
      id: item.id,
      title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : "Nahrávka",
      createdAt: typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt))
        ? item.createdAt
        : null,
      durationMs: Number.isSafeInteger(item.durationMs) && item.durationMs >= 0
        ? item.durationMs
        : null,
      state: ["ceka", "odesila", "selhalo", "odeslano"].includes(item.state) ? item.state : "unknown",
      uploadIntent: item.uploadIntent === "approved" ? "approved" : "held",
    }))
    .sort((first, second) => (Date.parse(second.createdAt ?? "") || 0) - (Date.parse(first.createdAt ?? "") || 0));
}

function dateLabel(value) {
  if (!value) return "Datum není známé";
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(value));
}

function durationLabel(value) {
  if (value === null) return "Délka není známá";
  const minutes = Math.round(value / 60_000);
  return minutes > 0 ? `${minutes} min` : "Méně než minutu";
}

function stateLabel(item) {
  if (item.recordingInProgress) return "Nahrává se";
  if (item.state === "ceka" && item.uploadIntent === "held") return "Zůstává na Macu";
  if (item.state === "ceka") return "Čeká na odeslání";
  if (item.state === "odesila") return "Odesílá se";
  if (item.state === "selhalo") return "Odeslání selhalo";
  if (item.state === "odeslano") return "Odesláno podle fronty";
  return "Stav není ověřený";
}

export function RecordingDayPreview({ items, unavailable = false, onOpenDay }) {
  const recordings = safeItems(items);
  const loading = items === null && !unavailable;

  return (
    <section className="day-preview" aria-labelledby="day-preview-title" data-testid="day-preview">
      <header className="day-preview__header">
        <span className="day-preview__icon" aria-hidden="true"><ArchiveIcon /></span>
        <div>
          <p className="eyebrow">Stav fronty</p>
          <h2 id="day-preview-title">Nahrávky</h2>
        </div>
        <button type="button" className="day-preview__open" onClick={onOpenDay}>
          Můj den <ArrowRightIcon />
        </button>
      </header>
      {loading && <p className="day-preview__empty" role="status">Načítám stav fronty…</p>}
      {unavailable && (
        <p className="day-preview__empty" role="status">Stav fronty není dostupný.</p>
      )}
      {!loading && !unavailable && recordings.length === 0 && (
        <p className="day-preview__empty">Fronta je prázdná. Lokální nahrávky najdeš v Můj den.</p>
      )}
      {!loading && !unavailable && recordings.length > 0 && (
        <ul className="day-preview__list" aria-label="Nahrávky ve frontě">
          {recordings.slice(0, 3).map((item) => (
            <li className="day-preview__item" key={item.id}>
              <span className="day-preview__item-icon" aria-hidden="true"><ArchiveIcon /></span>
              <span className="day-preview__item-copy">
                <strong>{item.title}</strong>
                <small>{dateLabel(item.createdAt)} · {durationLabel(item.durationMs)}</small>
                <small className={`day-preview__state day-preview__state--${item.state}`}>{stateLabel(item)}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
