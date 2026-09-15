import { useCallback, useEffect, useRef, useState } from "react";
import { version } from "../../package.json";

const BUILD_DATE = import.meta.env.APP_BUILD_DATE;

export function ApplicationVersion({ withBuildDate = true }) {
  return (
    <p className="application-version" data-testid="application-version">
      Verze {version}
      {withBuildDate && BUILD_DATE && <span className="application-version__build">sestaveno <time dateTime={BUILD_DATE}>
        {new Date(BUILD_DATE).toLocaleDateString("cs-CZ")}
      </time></span>}
    </p>
  );
}

export function ApplicationUpdateStatus({ showVersion = true, allowManualCheck = false }) {
  const [status, setStatus] = useState({
    revision: -1,
    availableVersion: null,
    downloading: false,
    downloadPercent: null,
    downloadedVersion: null,
    benefit: null,
    checkFailed: false,
    manualCheckAvailable: false,
    manualCheckState: "idle",
    installRequested: false,
    installDeferred: false,
  });
  const [actionFailed, setActionFailed] = useState(false);
  const acceptedRevision = useRef(-1);
  const applyStatus = useCallback((next) => {
    if (!Number.isSafeInteger(next?.revision) || next.revision < acceptedRevision.current) return;
    acceptedRevision.current = next.revision;
    setStatus(next);
    setActionFailed(false);
  }, []);

  useEffect(() => {
    let active = true;
    const applyActiveStatus = (next) => {
      if (active) applyStatus(next);
    };
    const unsubscribe = window.ludone.onUpdateStatusChanged?.(applyActiveStatus);
    // Čtení po přihlášení listeneru pokryje i stažení před otevřením či reloadem panelu.
    Promise.resolve().then(() => window.ludone.getUpdateStatus?.()).then(applyActiveStatus).catch(() => {});
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [applyStatus]);

  const availableVersion = typeof status.availableVersion === "string" ? status.availableVersion : null;
  const downloadedVersion = typeof status.downloadedVersion === "string" ? status.downloadedVersion : null;
  const downloading = status.downloading === true;
  const benefit = typeof status.benefit === "string" && status.benefit.trim()
    ? status.benefit.trim()
    : null;
  const downloadPercent = Number.isInteger(status.downloadPercent)
    && status.downloadPercent >= 0
    && status.downloadPercent <= 100
    ? status.downloadPercent
    : null;

  const runAction = (name) => {
    const action = window.ludone?.[name];
    if (typeof action !== "function") return;
    setActionFailed(false);
    Promise.resolve().then(() => action()).then((next) => {
      applyStatus(next);
    }).catch(() => setActionFailed(true));
  };

  if (
    !showVersion && !allowManualCheck && !availableVersion && !downloading
    && !downloadedVersion && !status.checkFailed
  ) return null;

  return (
    <div className="application-update-status">
      {showVersion && <ApplicationVersion />}
      <div aria-live="polite" aria-atomic="true">
        {!downloadedVersion && downloading && (
          <div className="feature-card idle-feature-row has-notice" role="status" data-testid="update-downloading">
            <div className="idle-feature-row__copy">
              <strong>{availableVersion ? `Stahuje se nová verze ${availableVersion}` : "Stahuje se nová verze"}</strong>
              {benefit && <small><b>Co je nové:</b> {benefit}</small>}
              <small>{downloadPercent === null
                ? "Stahování probíhá na pozadí. Po dokončení instalaci spustíš tlačítkem Aktualizovat."
                : `Staženo ${downloadPercent} %. Po dokončení instalaci spustíš tlačítkem Aktualizovat.`}</small>
            </div>
          </div>
        )}
        {!downloadedVersion && !downloading && availableVersion && (
          <div className="feature-card idle-feature-row has-notice" role="status" data-testid="update-available">
            <div className="idle-feature-row__copy">
              <strong>Je dostupná nová verze {availableVersion}</strong>
              {benefit && <small><b>Co je nové:</b> {benefit}</small>}
              <small>Aplikace ji automaticky stáhne na pozadí. Instalaci pak spustíš ty.</small>
            </div>
          </div>
        )}
        {downloadedVersion && (
          <div className="feature-card idle-feature-row has-notice" role="status" data-testid="update-downloaded">
            <div className="idle-feature-row__copy">
              <strong>Nová verze {downloadedVersion} je stažená</strong>
              {benefit && <small><b>Co je nové:</b> {benefit}</small>}
              <small>{status.installRequested
                ? "Aktualizace se spustí, jakmile nebude probíhat nahrávání, ukládání ani měření času."
                : status.installDeferred
                  ? "Aktualizace počká. Připomínka zůstane tady v panelu."
                  : "Instalace aplikaci restartuje. Během nahrávání, ukládání nebo měření času počká na bezpečný okamžik."}</small>
              <div className="application-update-status__actions">
                <button
                  type="button"
                  className="idle-feature-row__action"
                  data-testid="update-install"
                  disabled={status.installRequested === true}
                  onClick={() => runAction("installUpdate")}
                >
                  {status.installRequested ? "Čekám na bezpečný okamžik…" : "Aktualizovat"}
                </button>
                {!status.installDeferred && (
                  <button
                    type="button"
                    className="application-update-status__later"
                    data-testid="update-defer"
                    onClick={() => runAction("deferUpdate")}
                  >
                    Později
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {status.checkFailed && (
          <div className="feature-card idle-feature-row has-notice" role="alert" data-testid="update-check-failed">
            <div className="idle-feature-row__copy">
              <strong>Aktualizace opakovaně selhávají</strong>
              <small className="idle-feature-row__notice--error">Nedaří se ověřit nebo stáhnout novou verzi. Můžeš mít starší aplikaci. Zkontroluj připojení; pokud potíže trvají, obrať se na správce. Další pokus proběhne automaticky.</small>
            </div>
          </div>
        )}
        {allowManualCheck && !availableVersion && !downloading && !downloadedVersion && (
          <div className="application-update-status__manual">
            <button
              type="button"
              className="application-update-status__check"
              data-testid="update-check-now"
              disabled={status.manualCheckAvailable !== true || status.manualCheckState === "checking"}
              title={status.manualCheckAvailable === true
                ? undefined
                : "Kontrola je dostupná v nainstalované aplikaci."}
              onClick={() => runAction("checkForUpdates")}
            >
              {status.manualCheckState === "checking" ? "Kontroluji…" : "Zkontrolovat aktualizace"}
            </button>
            {status.manualCheckState === "current" && (
              <small role="status" data-testid="update-current">Používáš aktuální verzi.</small>
            )}
            {status.manualCheckState === "failed" && (
              <small role="alert" data-testid="update-check-now-failed">Kontrola se nepodařila.</small>
            )}
          </div>
        )}
        {actionFailed && <small className="idle-feature-row__notice--error" role="alert">
          Akci s aktualizací se nepodařilo dokončit.
        </small>}
      </div>
    </div>
  );
}
