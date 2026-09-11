"use strict";

/**
 * Vyzvednutí seznamu firem, pod které smí přihlášený člověk odeslat nahrávku.
 *
 * Server firmu z tokenu NEODVOZUJE — je to jeho jediná hranice práv a rozsah jednoho člověka
 * může obsahovat víc firem. Nabídku proto vrací zvlášť, za TOUŽ branou jako upload.
 *
 * Tenhle modul umí jen vyzvednout nabídku. Rozhodnutí, která firma se použije, dělá pravidlo
 * v `src/lib/upload-company.js`, a uložení volby patří k přihlášené session — každé zvlášť,
 * ať jde každá část otestovat sama.
 */

const COMPANIES_PATH = "/api/nahravky/uploads/firmy";

/**
 * Chyby, které nejsou selháním sítě, ale odpovědí serveru. Volající podle nich pozná,
 * jestli má cenu opakovat (`503`) nebo jestli je vada v oprávnění (`403`).
 */
function companiesError(status, code) {
  return Object.assign(new Error(`Seznam firem selhal (HTTP ${status})`), {
    code: typeof code === "string" && code !== "" ? code : `http_${status}`,
    status,
  });
}

/**
 * @param {{
 *   accessToken: string,
 *   fetchImpl: (input: string, options?: Record<string, any>) => Promise<any>,
 *   issuer: string,
 *   signal?: AbortSignal,
 *   trustedRemoteEndpoint: (value: string, issuer: string, name: string) => string,
 * }} options
 */
async function fetchCompanies(options) {
  const { accessToken, fetchImpl, issuer, signal } = options;
  if (typeof accessToken !== "string" || accessToken === "") {
    throw new TypeError("accessToken je povinný");
  }
  // Validaci originu si nepíšeme vlastní — sdílíme tutéž, kterou používá přihlášení.
  // Třetí kopie téhle kontroly by se dřív nebo později rozešla s ostatními dvěma.
  const endpoint = options.trustedRemoteEndpoint(
    new URL(COMPANIES_PATH, issuer).href,
    issuer,
    "seznam firem",
  );

  const response = await fetchImpl(endpoint, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    redirect: "error",
    signal,
  });

  if (!response?.ok) {
    let code;
    try {
      code = (await response.json())?.code;
    } catch {
      // Tělo bez JSON nesmí zakrýt stavový kód, který je sám o sobě informace.
    }
    throw companiesError(response?.status ?? 0, code);
  }

  const payload = await response.json();
  return {
    companies: Array.isArray(payload?.companies) ? payload.companies : [],
    // `null` je legitimní odpověď: server ji pošle vždy, když má člověk v rozsahu víc firem.
    defaultCompanyId: typeof payload?.defaultCompanyId === "string"
      ? payload.defaultCompanyId
      : null,
  };
}

module.exports = { COMPANIES_PATH, fetchCompanies };
