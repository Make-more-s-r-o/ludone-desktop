/**
 * Která firma se použije pro odeslání nahrávky.
 *
 * Server firmu z tokenu NEODVOZUJE a v zahájení uploadu ji vyžaduje — je to jeho jediná
 * hranice práv a rozsah jednoho člověka může obsahovat víc firem. Nabídku vrací
 * `GET /api/nahravky/uploads/firmy` jako `{ companies: [{ id, name }], defaultCompanyId }`.
 *
 * Tenhle modul je ZÁMĚRNĚ bez vstupů a výstupů: jen pravidlo. Síť, ukládání volby i případné
 * zeptání se člověka patří jinam — díky tomu jde pravidlo otestovat celé a beze zbytku.
 */

/** Server posílá GUID malými písmeny; porovnává se přesně, nikdy „nejpodobnější“. */
export const COMPANY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export const COMPANY_SELECTION = Object.freeze({
  CHOSEN: "vybrano",
  MUST_CHOOSE: "musi-vybrat",
  NONE: "zadna-firma",
});

function offeredIds(companies) {
  if (!Array.isArray(companies)) return [];
  return companies
    .map((company) => (typeof company?.id === "string" ? company.id : ""))
    .filter((id) => COMPANY_ID_PATTERN.test(id));
}

/**
 * @param {{
 *   companies?: Array<{ id?: unknown, name?: unknown }>,
 *   defaultCompanyId?: unknown,
 *   storedCompanyId?: unknown,
 * }} vstup
 */
export function resolveUploadCompany(vstup = {}) {
  const nabidnute = offeredIds(vstup.companies);
  if (nabidnute.length === 0) {
    // Prázdná nabídka není „vyber si nic“ — server pro nedostupný registr vrací 503,
    // takže sem se dá dojít jen u člověka, který opravdu žádnou firmu nemá.
    return { stav: COMPANY_SELECTION.NONE };
  }

  // 🔴 Uložená volba se VŽDY ověřuje proti aktuální nabídce. Kdyby se jen převzala, přežila by
  // odebrání firmy z rozsahu a nahrávka by odešla pod firmu, na kterou už člověk nemá právo —
  // respektive by ji server odmítl a vypadalo by to jako vada klienta. Neplatná volba se proto
  // zahazuje a ptá se znovu; NIKDY se tiše nenahradí jinou firmou.
  const ulozena = typeof vstup.storedCompanyId === "string" ? vstup.storedCompanyId : "";
  if (nabidnute.includes(ulozena)) {
    return { stav: COMPANY_SELECTION.CHOSEN, companyTabidooId: ulozena };
  }

  // Výchozí firmu server vyplní jen tehdy, když má člověk v rozsahu právě jednu. I tak ji
  // ověřujeme proti nabídce — fail-closed, ať se nepošle GUID, který v seznamu není.
  const vychozi = typeof vstup.defaultCompanyId === "string" ? vstup.defaultCompanyId : "";
  if (nabidnute.includes(vychozi)) {
    return { stav: COMPANY_SELECTION.CHOSEN, companyTabidooId: vychozi };
  }

  // Víc firem a žádná platná volba: rozhodnout musí člověk. Tenhle stav se NESMÍ uhodnout —
  // vybrat „tu první“ by znamenalo tiše poslat cizí schůzku pod špatnou firmu.
  return { stav: COMPANY_SELECTION.MUST_CHOOSE, companies: nabidnute };
}
