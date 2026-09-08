import { useEffect, useState } from "react";
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

export function ApplicationUpdateStatus({ showVersion = true }) {
  const [status, setStatus] = useState({ revision: -1, downloadedVersion: null, checkFailed: false });

  useEffect(() => {
    let active = true;
    const applyStatus = (next) => {
      if (!active || !Number.isSafeInteger(next?.revision)) return;
      // Starší odpověď počátečního čtení nesmí přepsat mezitím doručenou událost.
      setStatus((current) => next.revision >= current.revision ? next : current);
    };
    const unsubscribe = window.ludone.onUpdateStatusChanged?.(applyStatus);
    // Čtení po přihlášení listeneru pokryje i stažení před otevřením či reloadem panelu.
    Promise.resolve().then(() => window.ludone.getUpdateStatus?.()).then(applyStatus).catch(() => {});
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  if (!showVersion && !status.downloadedVersion && !status.checkFailed) return null;

  return (
    <div className="application-update-status">
      {showVersion && <ApplicationVersion />}
      <div aria-live="polite" aria-atomic="true">
        {status.downloadedVersion && (
          <div className="feature-card idle-feature-row has-notice" role="status" data-testid="update-downloaded">
            <div className="idle-feature-row__copy">
              <strong>Nová verze {status.downloadedVersion} je stažená</strong>
              <small>Až dokončíš nahrávání, uložení nahrávky a měření času, aplikace se automaticky restartuje a aktualizuje.</small>
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
      </div>
    </div>
  );
}
