const REASONS = Object.freeze({
  unauthorized: "přihlášení nebylo platné",
  insufficient_scope: "přihlášení nemá oprávnění k přepisu",
  forbidden: "k přepisu nemáš oprávnění",
  scope_empty: "k přepisu nemáš oprávnění",
  recording_not_found: "server nahrávku nenašel",
  transcription_configuration_error: "přepis není na serveru nastavený",
  transcription_queue_failed: "server přepis nepřijal do fronty",
  scope_unavailable: "server nemohl ověřit oprávnění",
  network_error: "spojení se serverem se nepodařilo",
  transcription_interrupted: "aplikace se mezitím ukončila",
});

/**
 * Česká věta o žádosti o přepis uložené u nahrávky. Aplikace žádost později sama neopakuje,
 * proto při neúspěchu říká, co udělat: spustit přepis v LuDone na webu. Nahrávka je odeslaná.
 * @param {{ outcome?: string, code?: string | null } | null | undefined} transcription
 * @returns {string | null}
 */
export function transcriptionNotice(transcription) {
  if (!transcription || typeof transcription !== "object") return null;
  if (transcription.outcome === "pending") return "Přepis se zahajuje…";
  if (transcription.outcome === "started") return "Přepis byl zahájen. Výsledek najdeš v LuDone na webu.";
  if (transcription.outcome === "already_running") return "Přepis už běží.";
  if (transcription.outcome !== "failed") return null;
  if (transcription.code === "transcription_disabled") return "Přepis nezačal: přepis je vypnutý.";
  const reason = Object.hasOwn(REASONS, transcription.code ?? "") ? REASONS[transcription.code]
    : "server přepis nezahájil";
  return `Přepis nezačal: ${reason}. Spusť ho v LuDone na webu.`;
}
