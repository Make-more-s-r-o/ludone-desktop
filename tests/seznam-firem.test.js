import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { COMPANIES_PATH, fetchCompanies } = require("../electron/companies.cjs");

const ISSUER = "https://labs.ludone.cz";
const TOKEN = "testovaci-token-nepatri-do-logu";
const PRVNI = "11111111-1111-4111-8111-111111111111";
const DRUHA = "22222222-2222-4222-8222-222222222222";

/** Skutečnou validaci originu vlastní auth.cjs; sem se injektuje, ať jde ověřit, že se VOLÁ. */
const passThroughEndpoint = vi.fn((value) => value);

function odpoved(payload, { ok = true, status = 200 } = {}) {
  return { ok, status, json: vi.fn(async () => payload) };
}

function harness(response, { trustedRemoteEndpoint = passThroughEndpoint } = {}) {
  let volani = null;
  const fetchImpl = vi.fn(async (url, options) => {
    volani = { url, options };
    return response;
  });
  return {
    fetchImpl,
    posledniVolani: () => volani,
    volat: () => fetchCompanies({
      accessToken: TOKEN,
      fetchImpl,
      issuer: ISSUER,
      trustedRemoteEndpoint,
    }),
  };
}

describe("vyzvednutí seznamu firem", () => {
  it("volá správnou adresu GETem a s Bearer tokenem", async () => {
    const { fetchImpl, volat } = harness(odpoved({
      companies: [{ id: PRVNI, name: "Make more s.r.o." }],
      defaultCompanyId: PRVNI,
    }));

    await expect(volat()).resolves.toEqual({
      companies: [{ id: PRVNI, name: "Make more s.r.o." }],
      defaultCompanyId: PRVNI,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${ISSUER}${COMPANIES_PATH}`);
    expect(options).toMatchObject({
      headers: { accept: "application/json", authorization: `Bearer ${TOKEN}` },
      redirect: "error",
    });
    // GET = výchozí chování fetche, tedy žádné `method` (server tuhle routu má jako GET).
    expect(options.method).toBeUndefined();
  });

  it("🔴 validaci originu si nepíše vlastní — volá tu injektovanou a její chybu propustí", async () => {
    const trustedRemoteEndpoint = vi.fn(() => {
      throw new Error("seznam firem musí být HTTPS endpoint na originu issueru");
    });
    const { fetchImpl, volat } = harness(odpoved({}), { trustedRemoteEndpoint });

    await expect(volat()).rejects.toThrow("musí být HTTPS endpoint");
    // Klíčové: když validace neprojde, NESMÍ se na síť vůbec sáhnout.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("`defaultCompanyId: null` je legitimní odpověď, ne chyba", async () => {
    const { volat } = harness(odpoved({
      companies: [{ id: PRVNI, name: "A" }, { id: DRUHA, name: "B" }],
      defaultCompanyId: null,
    }));

    await expect(volat()).resolves.toEqual({
      companies: [{ id: PRVNI, name: "A" }, { id: DRUHA, name: "B" }],
      defaultCompanyId: null,
    });
  });

  it("chybějící nebo nesmyslná pole nepropadnou dál jako undefined", async () => {
    const { volat } = harness(odpoved({ defaultCompanyId: 42 }));

    await expect(volat()).resolves.toEqual({ companies: [], defaultCompanyId: null });
  });

  it.each([
    [403, "insufficient_scope"],
    [403, "scope_empty"],
    [503, "scope_unavailable"],
    [401, undefined],
  ])("chybu %s vrátí se stavem i kódem serveru", async (status, code) => {
    const { volat } = harness(odpoved(code === undefined ? {} : { code }, { ok: false, status }));

    // Volající podle toho pozná, jestli má cenu opakovat (503) nebo jde o oprávnění (403).
    await expect(volat()).rejects.toMatchObject({
      status,
      code: code ?? `http_${status}`,
    });
  });

  it("odpověď bez JSON těla nezakryje stavový kód", async () => {
    const { volat } = harness({
      ok: false,
      status: 503,
      json: vi.fn(async () => {
        throw new SyntaxError("není JSON");
      }),
    });

    await expect(volat()).rejects.toMatchObject({ status: 503, code: "http_503" });
  });

  it("bez tokenu se na síť vůbec nesáhne", async () => {
    const fetchImpl = vi.fn();

    await expect(fetchCompanies({
      accessToken: "",
      fetchImpl,
      issuer: ISSUER,
      trustedRemoteEndpoint: passThroughEndpoint,
    })).rejects.toThrow("accessToken je povinný");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
