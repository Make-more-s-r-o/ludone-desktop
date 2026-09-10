export const MICROPHONE_ONLY_TEXT = "Můžeš povolit jen mikrofon. Časovač poběží a nahrávka bude jednostopá — jen se dozvíš, že chybí druhá strana.";

export const MICROPHONE_REQUIRED_TEXT = "Tvůj hlas. Bez něj nenahraješ nic.";

/**
 * 🔴 Panel psal u systémového zvuku slovo „ticho" i tehdy, když se stopa vůbec nezískala.
 * Z obrazovky tedy nešlo poznat, jestli má člověk mluvit hlasitěji, nebo něco povolit —
 * a aplikace přitom příčinu znala: `captureAudioSources` ji vrací v `systemAudioError`
 * a nikdo ji nečetl.
 *
 * 🔴 A pozor na past, na kterou jsme sami naletěli: **„Záznam obrazovky" NENÍ oprávnění,
 * které tahle cesta potřebuje.** Od macOS 14.4 je nahrávání zvuku z ostatních aplikací
 * samostatná položka (Chromium na něj jde přes Core Audio process tap), a Electron na ni
 * nemá API — takže `getMediaAccessStatus("screen")` odpoví „povoleno" i ve chvíli, kdy
 * zvuk povolený není. Doloženo 10. 9. 2026 na Danově Macu: Záznam obrazovky povolený,
 * nahrávka přesto jednostopá, a v systému chyběl řádek právě pro nahrávání zvuku —
 * zatímco všechny ostatní aplikace, které to na tom stroji umí, ho měly.
 *
 * Proto tahle funkce **nikdy netvrdí, že je vše v pořádku, jen protože Záznam obrazovky
 * prošel.** Zelená na špatné otázce je horší než žádná odpověď.
 *
 * @param {{
 *   permission?: { status?: string } | null,
 *   error?: unknown,
 * }} [context]
 * @returns {string}
 */
export function microphoneOnlyReason(context) {
  const { permission, error } = context ?? {};
  const status = typeof permission?.status === "string" ? permission.status : "unknown";

  if (status === "restricted") {
    return "Ostatní zvuk se nenahrává: záznam obrazovky i zvuku zakazuje správce tohoto "
      + "počítače. Nahrávka bude jednostopá a s tím sám nic neuděláš.";
  }

  if (status === "denied" || status === "not-determined") {
    return "Ostatní zvuk se nenahrává, protože LuDone nemá povolený Záznam obrazovky. "
      + "Povol ho v Nastavení systému, v Soukromí a zabezpečení, a potom aplikaci úplně "
      + "ukonči a spusť znovu — macOS ho dřív neuzná.";
  }

  // Sem se dojde i tehdy, když Záznam obrazovky povolený JE. To není protimluv: nahrávání
  // zvuku z jiných aplikací je samostatné oprávnění a systém se na ně ptá až při prvním
  // pokusu. Když se dialog nikdy neukázal, k tomu pokusu se aplikace nedostala.
  return "Ostatní zvuk se nenahrává. Nahrávání zvuku z jiných aplikací je na macOS "
    + "samostatné povolení, oddělené od Záznamu obrazovky — najdeš ho v Nastavení systému "
    + "v Soukromí a zabezpečení. Zkontroluj, že tam je LuDone zapnutý, a aplikaci potom "
    + "úplně ukonči a spusť znovu."
    + (describeSystemAudioError(error) ?? "");
}

/**
 * Technický důvod se připojuje jen tehdy, když opravdu existuje a dá se přečíst. Prázdná
 * závorka nebo `[object Object]` na obrazovce je horší než nic — vypadá jako porucha
 * aplikace a odvádí pozornost od rady o povolení.
 *
 * @param {unknown} error
 * @returns {string | null}
 */
function describeSystemAudioError(error) {
  const message = error instanceof Error
    ? error.message
    : (typeof error === "string" ? error : "");
  const trimmed = message.trim();
  if (trimmed === "") return null;
  // Delší hlášky bývají zásobníky volání; do věty pro člověka patří jen její začátek.
  const shortened = trimmed.length > 120 ? `${trimmed.slice(0, 119)}…` : trimmed;
  return ` (systém hlásí: ${shortened})`;
}
