/**
 * Postup, jak se zjistí firma pro odeslání — od uložené volby přes nabídku serveru
 * až po jednorázový překlad názvu, který zadal člověk.
 *
 * Závislosti se vkládají zvenčí (síť, ukládání, poznámky do logu), takže celý postup jde
 * otestovat beze zbytku a bez Electronu. Samotné rozhodovací pravidlo bydlí v
 * `upload-company.js`; tenhle modul kolem něj jen řadí kroky a rozhoduje, kdy se nesmí hádat.
 */

import { COMPANY_SELECTION, COMPANY_ID_PATTERN, resolveUploadCompany } from "./upload-company.js";

export const COMPANY_RESOLUTION_REASONS = Object.freeze({
  OFFER_FAILED: "nabidku-se-nepodarilo-ziskat",
  NO_COMPANY: "zadna-firma",
  MUST_CHOOSE: "musi-vybrat-clovek",
});

function note(onNote, message) {
  try {
    onNote?.(message);
  } catch {
    // Poznámka do logu nesmí změnit výsledek odesílání.
  }
}

/**
 * @param {{
 *   storedCompanyId?: unknown,
 *   configuredCompanyName?: unknown,
 *   fetchOffer: () => Promise<{ companies?: unknown, defaultCompanyId?: unknown }>,
 *   persistChoice?: (companyTabidooId: string) => Promise<unknown>,
 *   onNote?: (message: string) => void,
 * }} options
 * @returns {Promise<{ companyTabidooId: string|null, reason?: string }>}
 */
export async function resolveCompanyForUpload(options) {
  const ulozena = typeof options.storedCompanyId === "string" ? options.storedCompanyId : "";
  // Jakmile je volba jednou uložená, na síť se nesahá vůbec. Odesílání se děje často;
  // vyzvedávat nabídku pokaždé by znamenalo požadavek navíc u každé nahrávky.
  if (COMPANY_ID_PATTERN.test(ulozena)) return { companyTabidooId: ulozena };

  let nabidka;
  try {
    nabidka = await options.fetchOffer();
  } catch (error) {
    // 🔴 Výpadek sítě ani odmítnutí serveru nesmí shodit přípravu odeslání. Projeví se jako
    // „firma není“ — stav, který fronta umí a který nahrávku podrží, místo aby ji zahodil.
    note(options.onNote, `Seznam firem se nepodařilo získat: ${error?.code ?? "chyba"}`);
    return { companyTabidooId: null, reason: COMPANY_RESOLUTION_REASONS.OFFER_FAILED };
  }

  const companies = Array.isArray(nabidka?.companies) ? nabidka.companies : [];
  const rozhodnuti = resolveUploadCompany({
    companies,
    defaultCompanyId: nabidka?.defaultCompanyId,
    storedCompanyId: ulozena,
  });

  if (rozhodnuti.stav === COMPANY_SELECTION.CHOSEN) {
    return ulozit(options, rozhodnuti.companyTabidooId);
  }
  if (rozhodnuti.stav === COMPANY_SELECTION.NONE) {
    note(options.onNote, "Účet nemá k dispozici žádnou firmu, pod kterou by šlo odeslat.");
    return { companyTabidooId: null, reason: COMPANY_RESOLUTION_REASONS.NO_COMPANY };
  }

  // Zbývá „musí vybrat člověk“. Název, který člověk zadal, se použije PRÁVĚ JEDNOU — dál se
  // pracuje jen s GUID, protože názvy se na serveru mění a řídit se jimi je zakázané.
  const zadany = typeof options.configuredCompanyName === "string"
    ? options.configuredCompanyName.trim()
    : "";
  const shody = zadany === "" ? [] : companies.filter((firma) => firma?.name === zadany);
  if (shody.length === 1 && COMPANY_ID_PATTERN.test(shody[0]?.id ?? "")) {
    return ulozit(options, shody[0].id);
  }

  // 🔴 Tady se NEHÁDÁ. Vybrat „tu první“ nebo „nejpodobnější“ by znamenalo odeslat schůzku
  // pod cizí firmu — a to je horší než nahrávka, která počká na rozhodnutí člověka.
  note(
    options.onNote,
    `Firma se nevybrala: zadáno "${zadany || "nic"}", odpovídá ${shody.length} z `
      + `${companies.length} nabízených. Nehádám.`,
  );
  return { companyTabidooId: null, reason: COMPANY_RESOLUTION_REASONS.MUST_CHOOSE };
}

async function ulozit(options, companyTabidooId) {
  try {
    await options.persistChoice?.(companyTabidooId);
  } catch (error) {
    // Uložení je best-effort: když se mezitím přepnul účet, zápis se zahodí. Odeslání ale
    // proběhne s právě zjištěnou firmou a příště se nabídka vyzvedne znovu.
    note(options.onNote, `Volbu firmy se nepodařilo uložit: ${error?.code ?? "chyba"}`);
  }
  return { companyTabidooId };
}
