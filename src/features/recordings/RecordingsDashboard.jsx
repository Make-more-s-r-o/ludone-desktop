import { useCallback, useEffect, useRef, useState } from "react";

const RECORDING_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const REVISION_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function safeText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function normalizeRecordingItem(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (
    value.kind !== "recording"
    || typeof value.id !== "string"
    || !RECORDING_ID_PATTERN.test(value.id)
  ) return null;
  const revision = typeof value.revision === "string" && REVISION_PATTERN.test(value.revision)
    ? value.revision
    : null;
  const rawCreatedAt = safeText(value.createdAt);
  const createdAt = rawCreatedAt && Number.isFinite(Date.parse(rawCreatedAt)) ? rawCreatedAt : null;
  return {
    id: value.id,
    revision,
    state: safeText(value.state) ?? "neznámý",
    createdAt,
    durationMs: safeNonNegativeInteger(value.durationMs),
    sizeBytes: safeNonNegativeInteger(value.sizeBytes),
    blockReason: safeText(value.blockReason) ?? safeText(value.lastFailureReason),
    ownership: ["unknown", "current", "other", "unavailable"].includes(value.ownership)
      ? value.ownership
      : "unavailable",
    requiresHumanAction: value.requiresHumanAction === true,
    source: value.source === "orphan" ? "orphan" : "queue",
    localState: ["complete-audio", "partial-audio", "missing-audio", "invalid-manifest"]
      .includes(value.localState) ? value.localState : "invalid-manifest",
    localReason: safeText(value.localReason),
    canClaim: value.allowedActions?.claim === true,
  };
}

function normalizeSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.items)) {
    throw new TypeError("Hlavní proces nevrátil lokální přehled nahrávek");
  }
  return {
    items: value.items.map(normalizeRecordingItem).filter(Boolean),
    unreadableCount: safeNonNegativeInteger(value.unreadableCount) ?? 0,
  };
}

function formatCreatedAt(value) {
  if (!value) return "Datum není známé";
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(value) {
  if (value === null) return "Délka není známá";
  const totalSeconds = Math.round(value / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`;
}

function formatSize(value) {
  if (value === null) return "Velikost není známá";
  if (value < 1_000) return `${value} B`;
  if (value < 1_000_000) return `${Math.max(1, Math.round(value / 1_000))} kB`;
  return `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 }).format(value / 1_000_000)} MB`;
}

function accountExplanation(authState) {
  if (authState === "expired") {
    return "Přihlášení vypršelo. Otevři panel LuDone a přihlas se znovu.";
  }
  if (authState === "signed-out") {
    return "Pro převzetí nahrávky se nejdřív přihlas v panelu LuDone.";
  }
  if (authState !== "signed-in") {
    return "Stav přihlášení není ověřený. Převzetí teď není dostupné.";
  }
  return null;
}

const LOCAL_STATE_LABELS = Object.freeze({
  "complete-audio": "Zvuk je kompletní",
  "partial-audio": "Část zvuku chybí",
  "missing-audio": "Zvukové soubory chybí",
  "invalid-manifest": "Data nahrávky jsou poškozená",
});

export function RecordingsDashboard({ authState }) {
  const [view, setView] = useState({
    state: "loading", items: [], unreadableCount: 0, message: "",
  });
  const [claimingId, setClaimingId] = useState(null);
  const active = useRef(true);
  const claimInFlight = useRef(false);
  const loadGeneration = useRef(0);
  const previousAuthState = useRef(authState);

  const load = useCallback(() => {
    const requestGeneration = ++loadGeneration.current;
    const listLocalRecordings = window.ludone?.listLocalRecordings;
    if (typeof listLocalRecordings !== "function") {
      setView({ state: "error", items: [], unreadableCount: 0, message: "Přehled nahrávek není dostupný." });
      return Promise.resolve();
    }
    setView((current) => ({ ...current, state: "loading", message: "" }));
    return Promise.resolve()
      .then(() => listLocalRecordings())
      .then((snapshotValue) => {
        if (active.current && requestGeneration === loadGeneration.current) {
          const snapshot = normalizeSnapshot(snapshotValue);
          setView({ state: "ready", ...snapshot, message: "" });
        }
      })
      .catch(() => {
        if (active.current && requestGeneration === loadGeneration.current) {
          setView({ state: "error", items: [], unreadableCount: 0, message: "Nahrávky se nepodařilo načíst." });
        }
      });
  }, []);

  useEffect(() => {
    active.current = true;
    void load();
    return () => { active.current = false; };
  }, [load]);

  useEffect(() => {
    if (previousAuthState.current === authState) return;
    previousAuthState.current = authState;
    void load();
  }, [authState, load]);

  const claim = async (item) => {
    if (
      claimInFlight.current
      || authState !== "signed-in"
      || !item.revision
      || typeof window.ludone?.claimRecording !== "function"
    ) return;
    claimInFlight.current = true;
    loadGeneration.current += 1;
    setClaimingId(item.id);
    try {
      const result = await window.ludone.claimRecording(item.id, item.revision);
      if (result?.claimed === true || result?.claimed === false) {
        await load();
      }
    } catch {
      if (active.current) {
        setView({
          state: "error",
          items: [],
          unreadableCount: 0,
          message: "Převzetí se nepodařilo. Načti čerstvý seznam a zkus to znovu.",
        });
      }
    } finally {
      claimInFlight.current = false;
      if (active.current) setClaimingId(null);
    }
  };

  const disabledExplanation = accountExplanation(authState);

  return (
    <div className="recordings-dashboard" data-testid="recordings-dashboard">
      <p className="recordings-dashboard__intro">
        Přehled spojuje frontu s nahrávkami, které zůstaly jen na tomto Macu. Převzetí ji neodešle.
      </p>
      <div className="recordings-dashboard__toolbar">
        <button
          type="button"
          className="button button--small"
          disabled={view.state === "loading"}
          onClick={() => void load()}
        >
          Obnovit přehled
        </button>
      </div>
      {disabledExplanation && (
        <p className="recordings-dashboard__notice" role="status">{disabledExplanation}</p>
      )}
      {view.state === "loading" && <p role="status">Načítám nahrávky…</p>}
      {view.state === "error" && (
        <div className="recordings-dashboard__error" role="alert">
          <p>{view.message}</p>
          <button type="button" className="button button--small" onClick={() => void load()}>
            Načíst znovu
          </button>
        </div>
      )}
      {view.state === "ready" && view.items.length === 0 && view.unreadableCount === 0 && (
        <p className="recordings-dashboard__empty">Na tomto Macu nejsou žádné nahrávky k zobrazení.</p>
      )}
      {view.state === "ready" && (view.items.length > 0 || view.unreadableCount > 0) && (
        <ul className="recordings-dashboard__list" aria-label="Lokální nahrávky">
          {view.items.map((item) => {
            const claimable = item.source === "queue" && item.canClaim
              && ["unknown", "other"].includes(item.ownership)
              && ["ceka", "selhalo"].includes(item.state);
            return (
              <li className="recording-queue-card" key={item.id} data-recording-id={item.id}>
                <strong>{formatCreatedAt(item.createdAt)}</strong>
                <div className="recording-queue-card__facts">
                  <span>{item.source === "orphan" ? "Jen na Macu" : "Ve frontě"}</span>
                  <span>{formatDuration(item.durationMs)}</span>
                  <span>{formatSize(item.sizeBytes)}</span>
                </div>
                <p className={`recording-queue-card__local recording-queue-card__local--${item.localState}`}>
                  {LOCAL_STATE_LABELS[item.localState]}
                </p>
                <p>{item.localReason ?? item.blockReason ?? (item.source === "orphan"
                  ? "Nahrávka není ve frontě a nemá dostupnou akci."
                  : "Nahrávka čeká ve frontě.")}</p>
                {claimable && (
                  <button
                    type="button"
                    className="button button--small"
                    disabled={authState !== "signed-in" || claimingId !== null || !item.revision}
                    onClick={() => void claim(item)}
                  >
                    {claimingId === item.id ? "Přebírám…" : "Převzít pod svůj účet"}
                  </button>
                )}
              </li>
            );
          })}
          {view.unreadableCount > 0 && (
            <li className="recording-queue-card recording-queue-card--invalid" data-testid="unreadable-recordings">
              <strong>Poškozená data bez bezpečné identity</strong>
              <p>
                {view.unreadableCount === 1
                  ? "Jednu nahrávku nelze bezpečně zobrazit ani použít."
                  : `${view.unreadableCount} nahrávek nelze bezpečně zobrazit ani použít.`}
              </p>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
