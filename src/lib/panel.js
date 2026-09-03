const QUEUE_STATES = new Set(["ceka", "odesila", "odeslano", "selhalo"]);

function waitingLabel(count) {
  if (count === 1) return "1 čeká";
  if (count >= 2 && count <= 4) return `${count} čekají`;
  return `${count} čeká`;
}

/**
 * Převádí redukovaný stav odchozí fronty na krátký text do patičky panelu.
 * Neznámá nebo neúplná data se raději nezobrazí, aby panel netvrdil něco,
 * co hlavní proces nepotvrdil.
 */
export function queueFooterStatus(items) {
  if (!Array.isArray(items)) return null;
  if (items.some((item) => !item || !QUEUE_STATES.has(item.state))) return null;

  const counts = items.reduce((result, item) => {
    if (item.state === "ceka" && item.requiresHumanAction === true) {
      result.requiresHumanAction += 1;
    } else {
      result[item.state] += 1;
    }
    return result;
  }, {
    ceka: 0,
    odesila: 0,
    odeslano: 0,
    requiresHumanAction: 0,
    selhalo: 0,
  });

  const parts = [];
  if (counts.odesila > 0) parts.push("Odesílá se");
  if (counts.ceka > 0) parts.push(waitingLabel(counts.ceka));
  if (counts.requiresHumanAction > 0) {
    parts.push(`${waitingLabel(counts.requiresHumanAction)} na potvrzení`);
  }
  if (counts.selhalo > 0) parts.push(`${counts.selhalo} selhalo`);

  if (parts.length === 0) return { text: "Vše odesláno", tone: "ok" };
  return {
    text: parts.join(" · "),
    tone: counts.selhalo > 0 ? "error" : "waiting",
  };
}

/**
 * Připraví ověřený souhrn pro rozbalenou kartu fronty. Velikost se ukáže jen
 * tehdy, když ji hlavní proces dodal pro každou započítanou položku; částečný
 * součet by se tvářil jako celek a byl by horší než chybějící údaj.
 */
export function queuePanelSummary(items, now = Date.now()) {
  if (!Array.isArray(items) || !Number.isFinite(now)) return null;
  if (items.some((item) => !item || !QUEUE_STATES.has(item.state))) return null;

  const pending = items.filter((item) => item.state !== "odeslano");
  if (pending.length === 0) return null;

  const waiting = pending.filter((item) => item.state === "ceka");
  const humanAction = waiting.filter((item) => item.requiresHumanAction === true);
  const ordinaryWaiting = waiting.filter((item) => item.requiresHumanAction !== true);
  const completeSize = (selectedItems) => {
    if (
      selectedItems.length === 0
      || selectedItems.some((item) => !Number.isSafeInteger(item.sizeBytes)
        || item.sizeBytes < 0)
    ) {
      return null;
    }
    const total = selectedItems.reduce((sum, item) => sum + item.sizeBytes, 0);
    return Number.isSafeInteger(total) ? total : null;
  };
  const nextAttempts = ordinaryWaiting.map((item) => (
    item.nextAttemptAt === null ? now : item.nextAttemptAt
  )).filter(Number.isFinite);
  const humanReasons = [...new Set(humanAction
    .map((item) => item.lastFailureReason)
    .filter((reason) => typeof reason === "string" && reason.trim().length > 0))];
  const failureReasons = [...new Set(pending
    .filter((item) => item.state === "selhalo")
    .map((item) => item.lastFailureReason)
    .filter((reason) => typeof reason === "string" && reason.trim().length > 0))];

  return {
    failedCount: pending.filter((item) => item.state === "selhalo").length,
    failureReasons,
    humanActionCount: humanAction.length,
    humanActionSizeBytes: completeSize(humanAction),
    humanReasons,
    nextAttemptAt: nextAttempts.length > 0 ? Math.min(...nextAttempts) : null,
    sendingCount: pending.filter((item) => item.state === "odesila").length,
    sizeBytes: completeSize(waiting),
    waitingCount: ordinaryWaiting.length,
    waitingSizeBytes: completeSize(ordinaryWaiting),
  };
}
