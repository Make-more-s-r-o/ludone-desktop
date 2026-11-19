import { ArchiveIcon, ArrowRightIcon } from "../../components/Icons.jsx";
import { useEffect, useState } from "react";
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
      source: item.source === "orphan" ? "orphan" : "queue",
      requiresHumanAction: item.requiresHumanAction === true,
      blockReason: typeof item.blockReason === "string" ? item.blockReason : null,
      lastFailureReason: typeof item.lastFailureReason === "string" ? item.lastFailureReason : null,
      nextAttemptAt: Number.isSafeInteger(item.nextAttemptAt) ? item.nextAttemptAt : null,
      sendingDisabledReason: typeof item.sendingDisabledReason === "string" ? item.sendingDisabledReason : null,
      actions: item.actions,
      localState: item.localState,
    }))
    .sort((first, second) => (Date.parse(second.createdAt ?? "") || 0) - (Date.parse(first.createdAt ?? "") || 0));
}

function queueFingerprint(items) {
  if (!Array.isArray(items)) return null;
  return JSON.stringify(items.filter((item) => item && typeof item === "object").map((item) => [
    item.id, item.revision, item.state, item.uploadIntent, item.ownership, item.requiresHumanAction,
    item.blockReason, item.lastFailureReason, item.nextAttemptAt, item.recordingInProgress,
  ]));
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
  const fingerprint = queueFingerprint(items);
  const [snapshot, setSnapshot] = useState(null);
  useEffect(() => {
    const list = window.ludone?.listLocalRecordings;
    if (typeof list !== "function") return undefined;
    const getSession = window.ludone?.getAuthSessionState;
    let generation = 0;
    let active = true;
    let lastSession;
    let sessionTimer;
    const refresh = async () => {
      const request = ++generation;
      try {
        const session = typeof getSession === "function" ? await getSession() : null;
        if (!active || generation !== request) return;
        lastSession = session;
        const value = await list();
        if (!Array.isArray(value?.items)) throw new TypeError("Neplatný přehled nahrávek");
        if (active && generation === request) setSnapshot({
          fingerprint, items: value.items,
          authState: session === "valid" ? "signed-in" : session === "expired" ? "expired"
            : session === "none" ? "signed-out" : undefined,
        });
      } catch {
        if (active && generation === request) { lastSession = undefined; setSnapshot(null); }
      }
    };
    const refreshAuth = () => { setSnapshot(null); void refresh(); };
    const refreshVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    const pollSession = async () => {
      try {
        const session = await getSession();
        if (active && session !== lastSession) refreshAuth();
      } catch {
        if (active) { generation += 1; lastSession = undefined; setSnapshot(null); }
      } finally {
        if (active) sessionTimer = window.setTimeout(pollSession, 1_000);
      }
    };
    void refresh();
    if (typeof getSession === "function") sessionTimer = window.setTimeout(pollSession, 1_000);
    const unsubscribe = window.ludone?.onAuthSessionChanged?.(refreshAuth);
    window.addEventListener("focus", refreshAuth);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      active = false;
      generation += 1;
      window.clearTimeout(sessionTimer);
      if (typeof unsubscribe === "function") unsubscribe();
      window.removeEventListener("focus", refreshAuth);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [fingerprint]);
  const currentSnapshot = snapshot?.fingerprint === fingerprint ? snapshot : null;
  const recordings = safeItems(currentSnapshot ? currentSnapshot.items : items);
  const loading = !currentSnapshot && items === null && !unavailable;
  const missing = !currentSnapshot && unavailable;

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
      {missing && (
        <p className="day-preview__empty" role="status">Stav fronty není dostupný.</p>
      )}
      {!loading && !missing && recordings.length === 0 && (
        <p className="day-preview__empty">Zatím tu nejsou schůzky. Všechny místní nahrávky najdeš v historii.</p>
      )}
      {!loading && !missing && recordings.length > 0 && (
        <ul className="day-preview__list" aria-label="Nahrávky ve frontě">
          {recordings.slice(0, 3).map((item) => {
            // Samotná fronta neobsahuje kontrolu místních souborů ani úplný kontext účtu.
            const statusItem = currentSnapshot ? item : { ...item, ownership: "unavailable", localState: undefined };
            const status = recordingDeliveryStatus(statusItem, { authState: currentSnapshot?.authState });
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
