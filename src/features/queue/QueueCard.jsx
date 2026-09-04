import { useState } from "react";
import { CloudIcon, UserIcon } from "../../components/Icons.jsx";
import { queuePanelSummary } from "../../lib/panel.js";

function countLabel(count, singular, few, many) {
  if (count === 1) return `1 ${singular}`;
  if (count >= 2 && count <= 4) return `${count} ${few}`;
  return `${count} ${many}`;
}

function formatSize(bytes) {
  const units = [
    [1024 ** 3, "GB"],
    [1024 ** 2, "MB"],
    [1024, "kB"],
  ];
  for (const [divisor, unit] of units) {
    if (bytes >= divisor) {
      const value = bytes / divisor;
      const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
      return `${rounded} ${unit}`;
    }
  }
  return `${bytes} B`;
}

function formatNextAttempt(nextAttemptAt, now) {
  if (nextAttemptAt === null) return null;
  const remainingMinutes = Math.ceil((nextAttemptAt - now) / 60_000);
  if (remainingMinutes <= 0) return "další pokus teď";
  return `další pokus za ${remainingMinutes} min`;
}

const RETRY_FAILED_MESSAGE = "Pokus se nepodařilo spustit.";

function returnedFailureMessage(result) {
  if (result?.outcome === "sent") return null;
  if (typeof result?.reason === "string" && result.reason.trim().length > 0) {
    return result.reason;
  }
  return RETRY_FAILED_MESSAGE;
}

export function QueueCard({ items, onRetry, onRetryFeedback, retryError: controlledRetryError }) {
  const now = Date.now();
  const summary = queuePanelSummary(items, now);
  const [retrying, setRetrying] = useState(false);
  const [localRetryError, setLocalRetryError] = useState(null);
  if (!summary) return null;

  const retryError = controlledRetryError === undefined ? localRetryError : controlledRetryError;

  function reportRetryFeedback(message) {
    setLocalRetryError(message);
    if (typeof onRetryFeedback === "function") onRetryFeedback(message);
  }

  const retryAvailable = summary.retryableWaitingCount > 0 && typeof onRetry === "function";
  const metadata = [];
  if (summary.waitingSizeBytes !== null) metadata.push(formatSize(summary.waitingSizeBytes));
  const nextAttempt = formatNextAttempt(summary.nextAttemptAt, now);
  if (nextAttempt) metadata.push(nextAttempt);
  metadata.push(...summary.sendingDisabledReasons);

  async function retryNow() {
    if (retrying || !retryAvailable) return;
    setRetrying(true);
    reportRetryFeedback(null);
    try {
      const result = await onRetry();
      reportRetryFeedback(returnedFailureMessage(result));
    } catch {
      reportRetryFeedback(RETRY_FAILED_MESSAGE);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <section id="queue-screen" className="feature-card queue-card" data-testid="queue-screen">
      <div className="queue-card__heading">
        <span className="queue-card__icon" aria-hidden="true"><CloudIcon /></span>
        <div>
          <h2>Čeká fronta</h2>
          <p>Nic se neztratilo, jen to zatím neodešlo.</p>
        </div>
      </div>

      {summary.waitingCount > 0
        && summary.humanActionCount > 0
        && summary.sizeBytes !== null && (
          <p className="queue-card__total" data-testid="queue-total-size">
            {formatSize(summary.sizeBytes)} celkem
          </p>
      )}

      {summary.waitingCount > 0 && (
        <div className="queue-card__summary" data-testid="queue-waiting-summary">
          <div className="queue-card__copy">
            <strong>{countLabel(
              summary.waitingCount,
              "čeká na odeslání",
              "čekají na odeslání",
              "čeká na odeslání",
            )}</strong>
            {metadata.length > 0 && <small>{metadata.join(" · ")}</small>}
          </div>
          {retryAvailable && (
            <button
              type="button"
              className="queue-card__retry"
              data-action="retry-queue"
              disabled={retrying}
              onClick={() => void retryNow()}
            >
              Zkusit teď
            </button>
          )}
        </div>
      )}

      {retryError && <p className="queue-card__error" role="alert">{retryError}</p>}

      {summary.humanActionCount > 0 && (
        <div className="queue-card__human" data-testid="queue-human-action" role="alert">
          <span className="queue-card__human-icon" aria-hidden="true"><UserIcon /></span>
          <div className="queue-card__copy">
            <strong>{countLabel(
              summary.humanActionCount,
              "čeká na potvrzení vlastníka",
              "čekají na potvrzení vlastníka",
              "čeká na potvrzení vlastníka",
            )}</strong>
            <small>Další pokus nepomůže; před odesláním je potřeba potvrdit vlastníka nahrávky.</small>
            {summary.humanActionSizeBytes !== null && (
              <small>{formatSize(summary.humanActionSizeBytes)}</small>
            )}
            {summary.humanReasons.map((reason) => <small key={reason}>{reason}</small>)}
          </div>
        </div>
      )}

      {summary.sendingCount > 0 && (
        <div className="queue-card__secondary" role="status">
          <strong>{countLabel(summary.sendingCount, "se odesílá", "se odesílají", "se odesílá")}</strong>
        </div>
      )}

      {summary.failedCount > 0 && (
        <div className="queue-card__failed" role="alert">
          <div className="queue-card__copy">
            <strong>{countLabel(summary.failedCount, "selhalo", "selhaly", "selhalo")}</strong>
            {summary.failureReasons.map((reason) => <small key={reason}>{reason}</small>)}
          </div>
        </div>
      )}
    </section>
  );
}
