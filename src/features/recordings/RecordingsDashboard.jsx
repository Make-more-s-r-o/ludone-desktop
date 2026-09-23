import { useCallback, useEffect, useRef, useState } from "react";

const RECORDING_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const REVISION_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const VERIFICATION_STATUSES = new Set([
  "complete", "incomplete", "server_failed", "mismatch", "invalid_response",
  "not_verified", "not_found_for_account", "rate_limited", "local_rate_limited",
  "auth_error", "network_error",
]);

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
    fileRevision: typeof value.fileRevision === "string" && REVISION_PATTERN.test(value.fileRevision)
      ? value.fileRevision : null,
    title: safeText(value.title),
    uploadIntent: value.uploadIntent === "approved" ? "approved" : "held",
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
    canDelete: value.allowedActions?.delete === true,
    canRetry: value.allowedActions?.retry === true,
    canSend: value.allowedActions?.send === true,
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

function normalizeVerification(value, item) {
  if (
    !value || typeof value !== "object" || Array.isArray(value)
    || value.id !== item.id || value.revision !== item.revision
    || typeof value.verifiedAt !== "string" || !Number.isFinite(Date.parse(value.verifiedAt))
    || !value.tracks || typeof value.tracks !== "object" || Array.isArray(value.tracks)
  ) throw new TypeError("Hlavní proces nevrátil platné ověření nahrávky");
  const tracks = {};
  for (const track of ["delivery", "microphone", "system"]) {
    const result = value.tracks[track];
    if (!result) continue;
    if (
      typeof result !== "object" || Array.isArray(result)
      || !VERIFICATION_STATUSES.has(result.status)
      || !Array.isArray(result.mismatchFields)
      || result.mismatchFields.some((field) => !["declared_bytes", "sha256", "missing_chunks"].includes(field))
    ) throw new TypeError("Hlavní proces nevrátil platný výsledek stopy");
    tracks[track] = { status: result.status, mismatchFields: [...new Set(result.mismatchFields)] };
  }
  if (Object.keys(tracks).length === 0) throw new TypeError("Ověření neobsahuje žádnou stopu");
  return { tracks, verifiedAt: value.verifiedAt };
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

function deliveryStateLabel(item) {
  if (item.source === "orphan") return "Zůstává jen na tomto Macu";
  if (item.state === "odesila") return "Odesílá se do LuDone";
  if (item.state === "odeslano") return "Odesláno podle stavu fronty";
  if (item.state === "selhalo") return "Odeslání selhalo";
  if (item.state === "ceka" && item.uploadIntent === "approved") {
    return "Schváleno k odeslání · čeká ve frontě";
  }
  if (item.state === "ceka") return "Zůstává na Macu";
  return "Stav odeslání není známý";
}

const VERIFICATION_LABELS = Object.freeze({
  complete: "Na serveru je úplná a shoduje se",
  incomplete: "Na serveru ještě není úplná",
  server_failed: "Server zpracování označil jako neúspěšné",
  mismatch: "Serverová data se neshodují s lokálním manifestem",
  invalid_response: "Server vrátil neplatnou odpověď",
  not_verified: "Na serveru nelze ověřit bez známého ID",
  not_found_for_account: "Pro tento účet server záznam nenašel",
  rate_limited: "Server dočasně omezil další ověřování",
  local_rate_limited: "Hodinový limit ručního ověřování je vyčerpaný",
  auth_error: "Ověření vyžaduje nové platné přihlášení",
  network_error: "Server se nepodařilo kontaktovat",
});

const TRACK_LABELS = Object.freeze({
  delivery: "Stereo MP3",
  microphone: "Mikrofon",
  system: "Systémový zvuk",
});

export function RecordingsDashboard({ authState }) {
  const [view, setView] = useState({
    state: "loading", items: [], unreadableCount: 0, message: "",
  });
  const [claimingId, setClaimingId] = useState(null);
  const [actingId, setActingId] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);
  const [verificationById, setVerificationById] = useState({});
  const [verificationErrorById, setVerificationErrorById] = useState({});
  const active = useRef(true);
  const claimInFlight = useRef(false);
  const loadGeneration = useRef(0);
  const verificationGeneration = useRef(0);
  const previousAuthState = useRef(authState);

  const load = useCallback(() => {
    const requestGeneration = ++loadGeneration.current;
    verificationGeneration.current += 1;
    setVerificationById({});
    setVerificationErrorById({});
    setVerifyingId(null);
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
    setVerificationById({});
    setVerificationErrorById({});
    void load();
  }, [authState, load]);

  const verify = async (item) => {
    if (
      verifyingId !== null || authState !== "signed-in" || !item.revision
      || typeof window.ludone?.verifyRecording !== "function"
    ) return;
    const actionGeneration = verificationGeneration.current;
    setVerifyingId(item.id);
    setVerificationErrorById((current) => ({ ...current, [item.id]: null }));
    try {
      const raw = await window.ludone.verifyRecording(item.id, item.revision);
      const result = normalizeVerification(raw, item);
      if (active.current && actionGeneration === verificationGeneration.current) {
        setVerificationById((current) => ({ ...current, [item.id]: result }));
      }
    } catch {
      if (active.current && actionGeneration === verificationGeneration.current) {
        setVerificationErrorById((current) => ({
          ...current,
          [item.id]: "Serverové ověření se nepodařilo. Lokální nahrávka zůstává beze změny.",
        }));
      }
    } finally {
      if (active.current && actionGeneration === verificationGeneration.current) {
        setVerifyingId(null);
      }
    }
  };

  const openWeb = async (item, track) => {
    if (typeof window.ludone?.openRecordingInLuDone !== "function" || !item.revision) return;
    try {
      await window.ludone.openRecordingInLuDone(item.id, item.revision, track);
    } catch {
      if (active.current) {
        setVerificationErrorById((current) => ({
          ...current,
          [item.id]: "Detail v LuDone se nepodařilo otevřít.",
        }));
      }
    }
  };

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
  const runAction = async (item, method) => {
    if (actingId !== null || !item.fileRevision || (method !== "deleteRecording"
      && method !== "revealRecording" && !item.revision)
      || typeof window.ludone?.[method] !== "function") return;
    setActingId(item.id);
    try {
      const result = await window.ludone[method]({
        id: item.id, queueRev: item.revision, fileRev: item.fileRevision,
      });
      await load();
      if (result?.outcome === "partial_failure" && active.current) {
        setVerificationErrorById((current) => ({
          ...current,
          [item.id]: "Část souborů se nepodařilo přesunout. Zbývající soubory i záznam ve frontě zůstaly zachované.",
        }));
      }
    } catch {
      if (active.current) setVerificationErrorById((current) => ({
        ...current, [item.id]: "Akci nelze provést nad neaktuální nahrávkou. Obnov přehled.",
      }));
    } finally {
      if (active.current) setActingId(null);
    }
  };

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
            const verification = verificationById[item.id];
            const canVerify = item.source === "queue" && item.ownership === "current"
              && item.revision && item.localState !== "invalid-manifest";
            return (
              <li className="recording-queue-card" key={item.id} data-recording-id={item.id}>
                <strong>{item.title ?? formatCreatedAt(item.createdAt)}</strong>
                <div className="recording-queue-card__facts">
                  <span>{item.source === "orphan" ? "Jen na Macu" : "V aplikaci"}</span>
                  {item.title && <span>{formatCreatedAt(item.createdAt)}</span>}
                  <span>{formatDuration(item.durationMs)}</span>
                  <span>{formatSize(item.sizeBytes)}</span>
                  <span>ID: {item.id.slice(0, 8)}</span>
                </div>
                <p className={`recording-queue-card__local recording-queue-card__local--${item.localState}`}>
                  {LOCAL_STATE_LABELS[item.localState]}
                </p>
                <p>{deliveryStateLabel(item)}</p>
                {item.localReason && <p>{item.localReason}</p>}
                {item.blockReason && item.blockReason !== item.localReason && <p>{item.blockReason}</p>}
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
                {canVerify && (
                  <button
                    type="button"
                    className="button button--small"
                    disabled={authState !== "signed-in" || verifyingId !== null}
                    onClick={() => void verify(item)}
                  >
                    {verifyingId === item.id ? "Ověřuji…" : "Ověřit v LuDone"}
                  </button>
                )}
                {item.canSend && (
                  <button type="button" className="button button--small"
                    disabled={authState !== "signed-in" || actingId !== null}
                    onClick={() => void runAction(item, "sendRecording")}>Uložit a odeslat</button>
                )}
                {item.canRetry && (
                  <button type="button" className="button button--small"
                    disabled={authState !== "signed-in" || actingId !== null}
                    onClick={() => void runAction(item, "retryRecording")}>Zkusit znovu</button>
                )}
                {item.fileRevision && item.localState !== "invalid-manifest" && (
                  <button type="button" className="button button--small"
                    disabled={actingId !== null}
                    onClick={() => void runAction(item, "revealRecording")}>Ukázat ve Finderu</button>
                )}
                {item.canDelete && (
                  <button type="button" className="button button--small"
                    disabled={actingId !== null}
                    onClick={() => void runAction(item, "deleteRecording")}>Přesunout do koše</button>
                )}
                {verification && (
                  <div className="recording-queue-card__verification" aria-label="Výsledek serverového ověření">
                    {Object.entries(verification.tracks).map(([track, result]) => (
                      <div className="recording-queue-card__track" key={track} data-status={result.status}>
                        <span><strong>{TRACK_LABELS[track]}</strong>: {VERIFICATION_LABELS[result.status]}</span>
                        {result.status === "complete" && (
                          <button
                            type="button"
                            className="button button--small"
                            onClick={() => void openWeb(item, track)}
                          >
                            Otevřít v LuDone
                          </button>
                        )}
                      </div>
                    ))}
                    <small>Ověřeno {formatCreatedAt(verification.verifiedAt)}</small>
                  </div>
                )}
                {verificationErrorById[item.id] && (
                  <p className="recording-queue-card__verification-error" role="alert">
                    {verificationErrorById[item.id]}
                  </p>
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
