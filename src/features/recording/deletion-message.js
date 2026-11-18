/** @param {any} failure */
export function recordingDeletionFailureMessage(failure) {
  if (failure?.outcome === "partial_failure") {
    const reason = {
      file_changed: "Soubor se změnil během přesunu do koše.",
      guard_changed: "Bezpečný stav pro mazání už nelze potvrdit.",
      access_denied: "macOS nepovolil přístup k některému souboru.",
      trash_failed: "Přesun do koše selhal; podrobnější důvod není k dispozici.",
    }[failure.reason] ?? "Část souborů se nepodařilo přesunout.";
    return `${reason} Zbývající soubory i záznam ve frontě zůstaly zachované. Obnov přehled a zkus to znovu.`;
  }

  const message = typeof failure?.message === "string"
    ? failure.message.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/u, "").trim()
    : "";
  if (/odesílání už začalo/iu.test(message)) {
    return "Odesílání už začalo, nahrávku nelze smazat. Zkontroluj její stav v přehledu.";
  }
  if (/nahrávka se právě odesílá/iu.test(message)) {
    return "Nahrávka se právě odesílá. Počkej na dokončení a zkontroluj její stav v přehledu.";
  }
  if (/neaktuální|se .*změnil|se .*změnily/iu.test(message)) {
    return "Nahrávka nebo její soubory se změnily. Obnov přehled a zkus to znovu.";
  }
  if (/akci už nelze bezpečně potvrdit/iu.test(message)) {
    return "Bezpečný stav pro mazání nelze potvrdit. Ukonči případné nahrávání nebo odesílání a zkus to znovu.";
  }
  if (/\b(?:EACCES|EPERM)\b/u.test(message)) {
    return "macOS nepovolil přístup k některému souboru. Zkontroluj oprávnění a zkus to znovu.";
  }
  if (/\bENOENT\b/u.test(message)) {
    return "Některý soubor nahrávky chybí. Obnov přehled a zkus to znovu.";
  }
  if (message) return `Nahrávku se nepodařilo smazat: ${message} Zkontroluj ji v přehledu a zkus to znovu.`;
  return "Nahrávku se nepodařilo smazat. Důvod není známý; obnov přehled a zkus to znovu.";
}
