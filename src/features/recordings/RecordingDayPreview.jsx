import { ArchiveIcon, ArrowRightIcon } from "../../components/Icons.jsx";
import { recordingDisplayTitle } from "../../lib/recording-display.js";
import { recordingDeliveryStatus } from "../../lib/recording-delivery-status.js";

function safeItems(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object"
    && item.kind === "recording" && typeof item.id === "string")
    .map((item) => ({
      recordingInProgress: item.recordingInProgress === true,
      id: item.id,
      title: recordingDisplayTitle(item.title, item.createdAt),
      createdAt: typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt))
        ? item.createdAt
        : null,
      durationMs: Number.isSafeInteger(item.durationMs) && item.durationMs >= 0
        ? item.durationMs
        : null,
      state: ["ceka", "odesila", "selhalo", "odeslano"].includes(item.state) ? item.state : "unknown",
      uploadIntent: item.uploadIntent === "approved" ? "approved" : "held",
      ownership: ["current", "other", "unknown", "unavailable"].includes(item.ownership) ? item.ownership : "unavailable",
      requiresHumanAction: item.requiresHumanAction === true,
      blockReason: typeof item.blockReason === "string" ? item.blockReason : null,
      lastFailureReason: typeof item.lastFailureReason === "string" ? item.lastFailureReason : null,
      nextAttemptAt: Number.isSafeInteger(item.nextAttemptAt) ? item.nextAttemptAt : null,
      localState: item.localState,
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

export function RecordingDayPreview({ items, unavailable = false, onOpenDay }) {
  const recordings = safeItems(items);
  const loading = items === null && !unavailable;

  return (
    <section className="day-preview" aria-labelledby="day-preview-title" data-testid="day-preview">
      <header className="day-preview__header">
        <span className="day-preview__icon" aria-hidden="true"><ArchiveIcon /></span>
        <div>
          <p className="eyebrow">Poslední schůzky</p>
          <h2 id="day-preview-title">Poslední schůzky</h2>
        </div>
        <button type="button" className="day-preview__open" onClick={onOpenDay}>
          Všechny <ArrowRightIcon />
        </button>
      </header>
      {loading && <p className="day-preview__empty" role="status">Načítám stav fronty…</p>}
      {unavailable && (
        <p className="day-preview__empty" role="status">Stav fronty není dostupný.</p>
      )}
      {!loading && !unavailable && recordings.length === 0 && (
        <p className="day-preview__empty">Zatím tu nejsou schůzky. Všechny místní nahrávky najdeš v historii.</p>
      )}
      {!loading && !unavailable && recordings.length > 0 && (
        <ul className="day-preview__list" aria-label="Nahrávky ve frontě">
          {recordings.slice(0, 3).map((item) => {
            const status = recordingDeliveryStatus(item);
            return (
            <li className="day-preview__item" key={item.id}>
              <span className="day-preview__item-icon" aria-hidden="true"><ArchiveIcon /></span>
              <span className="day-preview__item-copy">
                <strong>{item.title}</strong>
                <small>{dateLabel(item.createdAt)} · {durationLabel(item.durationMs)}</small>
                <small className={`day-preview__state day-preview__state--${status.tone}`}>{status.label}</small>
              </span>
            </li>
          ); })}
        </ul>
      )}
    </section>
  );
}
