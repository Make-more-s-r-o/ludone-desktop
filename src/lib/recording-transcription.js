const REASONS = Object.freeze({
  unauthorized: "přihlášení vypršelo, přihlas se znovu",
  insufficient_scope: "přihlášení nemá oprávnění k přepisu",
  forbidden: "k přepisu nemáš oprávnění",
  scope_empty: "k přepisu nemáš oprávnění",
  recording_not_found: "server nahrávku nenašel",
  transcription_disabled: "přepis je na serveru vypnutý",
  transcription_configuration_error: "přepis není na serveru správně nastavený",
  transcription_queue_failed: "server přepis nepřijal do fronty",
  scope_unavailable: "server teď nemůže ověřit oprávnění",
  network_error: "spojení se serverem se nepodařilo",
});

/**
 * Česká věta o výsledku žádosti o přepis uložená u nahrávky; nahrávka sama zůstává odeslaná.
 * @param {{ outcome?: string, code?: string | null } | null | undefined} transcription
 * @returns {string | null}
 */
export function transcriptionNotice(transcription) {
  if (!transcription || typeof transcription !== "object") return null;
  if (transcription.outcome === "started") return "Přepis byl zahájen. Výsledek najdeš v LuDone na webu.";
  if (transcription.outcome === "already_running") return "Přepis už běží. Výsledek najdeš v LuDone na webu.";
  if (transcription.outcome !== "failed") return null;
  const reason = Object.hasOwn(REASONS, transcription.code ?? "") ? REASONS[transcription.code]
    : "server přepis nezahájil";
  return `Nahrávka je odeslaná, ale přepis se nespustil: ${reason}.`;
}
