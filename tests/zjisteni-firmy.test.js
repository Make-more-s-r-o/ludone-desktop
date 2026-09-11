import { describe, expect, it, vi } from "vitest";
import {
  COMPANY_RESOLUTION_REASONS,
  resolveCompanyForUpload,
} from "../src/lib/upload-company-resolution.js";

const MAKE_MORE = "11111111-1111-4111-8111-111111111111";
const JINA = "22222222-2222-4222-8222-222222222222";
const NAZEV = "Make more s.r.o.";

const nabidka = (...firmy) => ({ companies: firmy, defaultCompanyId: null });
const firma = (id, name) => ({ id, name });

function harness(prepis = {}) {
  const fetchOffer = prepis.fetchOffer
    ?? vi.fn(async () => nabidka(firma(MAKE_MORE, NAZEV), firma(JINA, "Jiná firma")));
  const persistChoice = prepis.persistChoice ?? vi.fn(async () => {});
  const poznamky = [];
  return {
    fetchOffer,
    persistChoice,
    poznamky,
    volat: (dalsi = {}) => resolveCompanyForUpload({
      configuredCompanyName: NAZEV,
      fetchOffer,
      onNote: (zprava) => poznamky.push(zprava),
      persistChoice,
      storedCompanyId: null,
      ...dalsi,
    }),
  };
}

describe("zjištění firmy pro odeslání", () => {
  it("uloženou volbu použije a na síť vůbec nesáhne", async () => {
    const { fetchOffer, persistChoice, volat } = harness();

    await expect(volat({ storedCompanyId: MAKE_MORE }))
      .resolves.toEqual({ companyTabidooId: MAKE_MORE });
    // Odesílá se často — vyzvedávat nabídku u každé nahrávky by byl požadavek navíc pokaždé.
    expect(fetchOffer).not.toHaveBeenCalled();
    expect(persistChoice).not.toHaveBeenCalled();
  });

  it("podle zadaného názvu přeloží firmu na GUID a volbu si zapamatuje", async () => {
    const { persistChoice, volat } = harness();

    await expect(volat()).resolves.toEqual({ companyTabidooId: MAKE_MORE });
    expect(persistChoice).toHaveBeenCalledWith(MAKE_MORE);
  });

  it("🔴 při víc shodách názvu NEHÁDÁ a nic neuloží", async () => {
    const { persistChoice, poznamky, volat } = harness({
      fetchOffer: vi.fn(async () => nabidka(firma(MAKE_MORE, NAZEV), firma(JINA, NAZEV))),
    });

    await expect(volat()).resolves.toEqual({
      companyTabidooId: null,
      reason: COMPANY_RESOLUTION_REASONS.MUST_CHOOSE,
    });
    expect(persistChoice).not.toHaveBeenCalled();
    expect(poznamky.join(" ")).toMatch(/odpovídá 2 z 2/u);
  });

  it("když název neodpovídá ničemu, taky nehádá", async () => {
    const { persistChoice, volat } = harness();

    await expect(volat({ configuredCompanyName: "Neexistující s.r.o." })).resolves.toMatchObject({
      companyTabidooId: null,
      reason: COMPANY_RESOLUTION_REASONS.MUST_CHOOSE,
    });
    expect(persistChoice).not.toHaveBeenCalled();
  });

  it("bez zadaného názvu se firma nevybere, i když je nabídka krátká", async () => {
    const { persistChoice, volat } = harness();

    await expect(volat({ configuredCompanyName: "" })).resolves.toMatchObject({
      companyTabidooId: null,
      reason: COMPANY_RESOLUTION_REASONS.MUST_CHOOSE,
    });
    expect(persistChoice).not.toHaveBeenCalled();
  });

  it("jedinou firmu v nabídce vezme z výchozí hodnoty serveru, bez ohledu na název", async () => {
    const { persistChoice, volat } = harness({
      fetchOffer: vi.fn(async () => ({
        companies: [firma(MAKE_MORE, "Přejmenovaná firma")],
        defaultCompanyId: MAKE_MORE,
      })),
    });

    await expect(volat()).resolves.toEqual({ companyTabidooId: MAKE_MORE });
    expect(persistChoice).toHaveBeenCalledWith(MAKE_MORE);
  });

  it("🔴 selhání nabídky nevyletí ven, jen se firma nezjistí", async () => {
    const { persistChoice, poznamky, volat } = harness({
      fetchOffer: vi.fn(async () => {
        throw Object.assign(new Error("nedostupné"), { code: "scope_unavailable" });
      }),
    });

    await expect(volat()).resolves.toEqual({
      companyTabidooId: null,
      reason: COMPANY_RESOLUTION_REASONS.OFFER_FAILED,
    });
    expect(persistChoice).not.toHaveBeenCalled();
    expect(poznamky.join(" ")).toMatch(/scope_unavailable/u);
  });

  it("🔴 selhání uložení odeslání nezastaví — firma se vrátí i tak", async () => {
    const { volat, poznamky } = harness({
      persistChoice: vi.fn(async () => {
        throw Object.assign(new Error("relace zmizela"), { code: "session_gone" });
      }),
    });

    await expect(volat()).resolves.toEqual({ companyTabidooId: MAKE_MORE });
    expect(poznamky.join(" ")).toMatch(/session_gone/u);
  });

  it("prázdná nabídka je „žádná firma“, ne výběr", async () => {
    const { persistChoice, volat } = harness({
      fetchOffer: vi.fn(async () => nabidka()),
    });

    await expect(volat()).resolves.toEqual({
      companyTabidooId: null,
      reason: COMPANY_RESOLUTION_REASONS.NO_COMPANY,
    });
    expect(persistChoice).not.toHaveBeenCalled();
  });

  it("neplatnou uloženou volbu zahodí a zjistí firmu znovu", async () => {
    const { fetchOffer, persistChoice, volat } = harness();

    await expect(volat({ storedCompanyId: "nesmysl" }))
      .resolves.toEqual({ companyTabidooId: MAKE_MORE });
    expect(fetchOffer).toHaveBeenCalledTimes(1);
    expect(persistChoice).toHaveBeenCalledWith(MAKE_MORE);
  });
});
