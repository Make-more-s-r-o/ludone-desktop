import { useCallback, useEffect, useRef, useState } from "react";
import { ArchiveIcon, ArrowLeftIcon, ArrowRightIcon, CheckIcon, MicIcon, RefreshIcon, WaitingIcon } from "../../components/Icons.jsx";

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

function formatClockTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("cs-CZ", { hour: "2-digit", minute: "2-digit" })
    .format(new Date(value));
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

function recordingSourceLabel(item) {
  return item.source === "orphan" ? "Jen na Macu" : "Místní fronta";
}

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

function isLocalOnly(item) {
  return item.source === "orphan" || (item.state === "ceka" && item.uploadIntent === "held");
}

function matchesRecordingFilter(item, filter) {
  if (filter === "local") return isLocalOnly(item);
  if (filter === "delivery") return !isLocalOnly(item);
  return true;
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
  delivery: "Stereo WebM/Opus",
  microphone: "Mikrofon",
  system: "Systémový zvuk",
});

export function RecordingsDashboard({ authState, onDetailChange }) {
  const [view, setView] = useState({
    state: "loading", items: [], unreadableCount: 0, message: "",
  });
  const [claimingId, setClaimingId] = useState(null);
  const [actingId, setActingId] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);
  const [verificationById, setVerificationById] = useState({});
  const [verificationErrorById, setVerificationErrorById] = useState({});
  const [filter, setFilter] = useState("all");
  const [openDetailId, setOpenDetailId] = useState(null);
  const openDetailIdRef = useRef(null);
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
          if (openDetailIdRef.current && !snapshot.items.some((item) => item.id === openDetailIdRef.current)) {
            openDetailIdRef.current = null;
            setOpenDetailId(null);
            onDetailChange?.(false);
          }
        }
      })
      .catch(() => {
        if (active.current && requestGeneration === loadGeneration.current) {
          setView({ state: "error", items: [], unreadableCount: 0, message: "Nahrávky se nepodařilo načíst." });
        }
      });
  }, [onDetailChange]);

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
  const filteredItems = view.items.filter((item) => matchesRecordingFilter(item, filter));
  const filterCounts = {
    all: view.items.length,
    local: view.items.filter((item) => matchesRecordingFilter(item, "local")).length,
    delivery: view.items.filter((item) => matchesRecordingFilter(item, "delivery")).length,
  };
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
    <div className={`recordings-dashboard${openDetailId ? " recordings-dashboard--detail" : ""}`} data-testid="recordings-dashboard">
      <div className="recordings-dashboard__toolbar">
        {view.state === "ready" && view.items.length > 0 && (
          <div className="recordings-dashboard__filters" role="group" aria-label="Filtrovat nahrávky">
            {[
              ["all", "Vše"],
              ["local", "Jen na Macu"],
              ["delivery", "Odesílání"],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                className="recordings-dashboard__filter"
                data-filter={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}<span>{filterCounts[value]}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="button button--small"
          disabled={view.state === "loading"}
          onClick={() => void load()}
        >
          <RefreshIcon />
          Obnovit přehled
        </button>
      </div>
      <p
        className={`recordings-dashboard__notice${disabledExplanation ? " recordings-dashboard__notice--account" : ""}`}
        role={disabledExplanation ? "status" : undefined}
      >
        Převzetí nahrávky ji neodešle.{disabledExplanation ? ` ${disabledExplanation}` : ""}
      </p>
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
      {view.state === "ready" && view.items.length > 0 && filteredItems.length === 0 && (
        <p className="recordings-dashboard__empty">V tomto přehledu teď nejsou žádné nahrávky.</p>
      )}
      {view.state === "ready" && (filteredItems.length > 0 || view.unreadableCount > 0) && (
        <ul className="recordings-dashboard__list" aria-label="Lokální nahrávky">
          {filteredItems.map((item) => {
            const claimable = item.source === "queue" && item.canClaim
              && ["unknown", "other"].includes(item.ownership)
              && ["ceka", "selhalo"].includes(item.state);
            const verification = verificationById[item.id];
            const verified = verification
              && Object.values(verification.tracks).length > 0
              && Object.values(verification.tracks).every((track) => track.status === "complete");
            const journeyStage = verified ? 3
              : item.state === "odeslano" ? 2
                : item.state === "odesila" || (item.state === "ceka" && item.uploadIntent === "approved") ? 1
                  : item.localState === "complete-audio" ? 0 : -1;
            const ownerLabel = item.ownership === "current" ? "Tento účet"
              : item.ownership === "other" ? "Jiný účet" : "Vlastník není ověřen";
            const canVerify = item.source === "queue" && item.ownership === "current"
              && item.revision && item.localState !== "invalid-manifest";
            return (
              <li className="recordings-timeline__entry" key={item.id} data-recording-id={item.id}
                data-recording-state={item.state} data-upload-intent={item.uploadIntent}
                data-detail-active={openDetailId === item.id ? "true" : "false"}>
                <time className="recordings-timeline__time" dateTime={item.createdAt ?? undefined}>
                  {formatClockTime(item.createdAt)}
                </time>
                <details
                  className="recording-queue-card"
                  data-testid="recording-detail"
                  open={openDetailId === item.id}
                  onToggle={(event) => {
                    const isOpen = event.currentTarget.open;
                    openDetailIdRef.current = isOpen ? item.id : null;
                    setOpenDetailId(isOpen ? item.id : null);
                    onDetailChange?.(isOpen);
                  }}
                >
                  <summary className="recording-queue-card__summary">
                    <span className="recording-queue-card__back"><ArrowLeftIcon /> Zpět na den</span>
                    <span className="recording-queue-card__detail-date">Dnes · {formatClockTime(item.createdAt)}</span>
                    <span className="recording-queue-card__source-icon" aria-hidden="true"><MicIcon /></span>
                    <span className="recording-queue-card__heading">
                      <strong>{item.title ?? "Nahrávka"}</strong>
                      <span className={`recording-queue-card__delivery recording-queue-card__delivery--${item.source === "orphan" ? "local" : item.state}`}>
                        {deliveryStateLabel(item)}
                      </span>
                    </span>
                    <span className="recording-queue-card__facts">
                      <span>{formatCreatedAt(item.createdAt)}</span>
                      <span>{formatDuration(item.durationMs)}</span>
                      {item.sizeBytes !== null && <span>{formatSize(item.sizeBytes)}</span>}
                    </span>
                    <span className={`recording-queue-card__local recording-queue-card__local--${item.localState}`}>
                      {item.localState === "complete-audio" ? "Zvuk připraven" : LOCAL_STATE_LABELS[item.localState]}
                    </span>
                    <span className="recording-queue-card__detail-label">Otevřít detail</span>
                    <ArrowRightIcon />
                  </summary>
                  <div className="recording-queue-card__detail">
                    <header className="recording-queue-card__detail-heading">
                      <h1>{item.title ?? "Nahrávka"}</h1>
                      <p>{formatCreatedAt(item.createdAt)} · {formatDuration(item.durationMs)} · {formatSize(item.sizeBytes)}</p>
                    </header>
                    <ol className="recording-queue-card__journey" aria-label="Postup nahrávky">
                      {["Na Macu", "Ve frontě", "Odesláno", "Ověřeno"].map((label, index) => (
                        <li className={index <= journeyStage ? "is-complete" : ""} key={label}>
                          {index <= journeyStage ? <CheckIcon /> : <WaitingIcon />}
                          <span>{label}</span>
                        </li>
                      ))}
                    </ol>
                    <section className="recording-queue-card__storage" aria-labelledby={`recording-storage-${item.id}`}>
                      <div className="recording-queue-card__storage-heading">
                        <h2 id={`recording-storage-${item.id}`}>Uložení a přístup</h2>
                        <span className={`recording-queue-card__delivery recording-queue-card__delivery--${item.source === "orphan" ? "local" : item.state}`}>
                          {deliveryStateLabel(item)}
                        </span>
                      </div>
                      <dl>
                        <dt>Vlastník</dt><dd>{ownerLabel}</dd>
                        <dt>Zvuk</dt><dd>{item.localState === "complete-audio" ? "Stereo WebM/Opus · Zvuk je kompletní" : LOCAL_STATE_LABELS[item.localState]}</dd>
                        <dt>Lokální kopie</dt><dd>{item.localState === "complete-audio" ? "Zachována na tomto Macu" : "Stav místních souborů vyžaduje pozornost"}</dd>
                        <dt>Uložení</dt><dd>{recordingSourceLabel(item)}</dd>
                      </dl>
                    </section>
                    <section className="recording-queue-card__context-card" aria-label="Pracovní kontext">
                      <span className="recording-queue-card__context-icon" aria-hidden="true"><ArchiveIcon /></span>
                      <div>
                        <strong>Bez pracovního úseku</strong>
                        <p>K nahrávce zatím není připojený pracovní kontext.</p>
                        <small>LuTrack v desktopové aplikaci zatím není aktivní.</small>
                      </div>
                    </section>
                    {item.localReason && <p className="recording-queue-card__issue" role="status">{item.localReason}</p>}
                    {item.blockReason && item.blockReason !== item.localReason && <p className="recording-queue-card__issue" role="status">{item.blockReason}</p>}
                    <p className="recording-queue-card__web-note">Přepis a analýzu otevřeš v LuDone na webu.</p>
                    <div className="recording-queue-card__actions">
                {claimable && (
                  <button
                    type="button"
                    className="button button--small recording-action--claim"
                    disabled={authState !== "signed-in" || claimingId !== null || !item.revision}
                    onClick={() => void claim(item)}
                  >
                    {claimingId === item.id ? "Přebírám…" : "Převzít pod svůj účet"}
                  </button>
                )}
                {canVerify && (
                  <button
                    type="button"
                    className="button button--small recording-action--verify"
                    disabled={authState !== "signed-in" || verifyingId !== null}
                    onClick={() => void verify(item)}
                  >
                    {verifyingId === item.id ? "Ověřuji…" : "Ověřit v LuDone"}
                  </button>
                )}
                {item.canSend && (
                  <button type="button" className="button button--small recording-action--send"
                    disabled={authState !== "signed-in" || actingId !== null}
                    onClick={() => void runAction(item, "sendRecording")}>Uložit a odeslat</button>
                )}
                {item.canRetry && (
                  <button type="button" className="button button--small recording-action--retry"
                    disabled={authState !== "signed-in" || actingId !== null}
                    onClick={() => void runAction(item, "retryRecording")}>Zkusit znovu</button>
                )}
                {item.fileRevision && item.localState !== "invalid-manifest" && (
                  <button type="button" className="button button--small recording-action--reveal"
                    disabled={actingId !== null}
                    onClick={() => void runAction(item, "revealRecording")}>Ukázat ve Finderu</button>
                )}
                {item.canDelete && (
                  <button type="button" className="button button--small recording-action--delete"
                    disabled={actingId !== null}
                    onClick={() => void runAction(item, "deleteRecording")}>Přesunout do koše</button>
                )}
                    </div>
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
                    <details className="recording-queue-card__technical">
                      <summary>Technické údaje</summary>
                      <code>ID: {item.id.slice(0, 8)}</code>
                    </details>
                  </div>
                </details>
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
