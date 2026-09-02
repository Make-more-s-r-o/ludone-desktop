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
    result[item.state] += 1;
    return result;
  }, { ceka: 0, odesila: 0, odeslano: 0, selhalo: 0 });

  const parts = [];
  if (counts.odesila > 0) parts.push("Odesílá se");
  if (counts.ceka > 0) parts.push(waitingLabel(counts.ceka));
  if (counts.selhalo > 0) parts.push(`${counts.selhalo} selhalo`);

  if (parts.length === 0) return { text: "Vše odesláno", tone: "ok" };
  return {
    text: parts.join(" · "),
    tone: counts.selhalo > 0 ? "error" : "waiting",
  };
}
