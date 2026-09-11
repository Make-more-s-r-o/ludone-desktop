import { describe, expect, it } from "vitest";
import {
  COMPANY_SELECTION,
  resolveUploadCompany,
} from "../src/lib/upload-company.js";

const PRVNI = "11111111-1111-4111-8111-111111111111";
const DRUHA = "22222222-2222-4222-8222-222222222222";
const TRETI = "33333333-3333-4333-8333-333333333333";

const nabidka = (...ids) => ids.map((id, poradi) => ({ id, name: `Firma ${poradi + 1}` }));

describe("výběr firmy pro odeslání nahrávky", () => {
  it("použije uloženou volbu, když je pořád v nabídce", () => {
    expect(resolveUploadCompany({
      companies: nabidka(PRVNI, DRUHA),
      defaultCompanyId: null,
      storedCompanyId: DRUHA,
    })).toEqual({ stav: COMPANY_SELECTION.CHOSEN, companyTabidooId: DRUHA });
  });

  it("🔴 uloženou volbu mimo nabídku ZAHODÍ a zeptá se znovu, nenahradí ji jinou", () => {
    // Kdyby se tiše vybrala jiná firma, odešla by schůzka pod firmu, na kterou už člověk
    // nemá právo — a vypadalo by to jako vada serveru, ne jako odebrané oprávnění.
    const vysledek = resolveUploadCompany({
      companies: nabidka(PRVNI, DRUHA),
      defaultCompanyId: null,
      storedCompanyId: TRETI,
    });

    expect(vysledek.stav).toBe(COMPANY_SELECTION.MUST_CHOOSE);
    expect(vysledek).not.toHaveProperty("companyTabidooId");
  });

  it("bez uložené volby použije výchozí firmu od serveru", () => {
    expect(resolveUploadCompany({
      companies: nabidka(PRVNI),
      defaultCompanyId: PRVNI,
      storedCompanyId: null,
    })).toEqual({ stav: COMPANY_SELECTION.CHOSEN, companyTabidooId: PRVNI });
  });

  it("výchozí firmu mimo nabídku ignoruje (fail-closed)", () => {
    expect(resolveUploadCompany({
      companies: nabidka(PRVNI, DRUHA),
      defaultCompanyId: TRETI,
      storedCompanyId: null,
    }).stav).toBe(COMPANY_SELECTION.MUST_CHOOSE);
  });

  it("víc firem a žádná volba = musí vybrat člověk, neuhodne se", () => {
    const vysledek = resolveUploadCompany({
      companies: nabidka(PRVNI, DRUHA, TRETI),
      defaultCompanyId: null,
      storedCompanyId: null,
    });

    expect(vysledek.stav).toBe(COMPANY_SELECTION.MUST_CHOOSE);
    expect(vysledek.companies).toEqual([PRVNI, DRUHA, TRETI]);
  });

  it("prázdná nabídka znamená „žádná firma“, ne výběr", () => {
    expect(resolveUploadCompany({ companies: [], defaultCompanyId: null }).stav)
      .toBe(COMPANY_SELECTION.NONE);
    expect(resolveUploadCompany({}).stav).toBe(COMPANY_SELECTION.NONE);
  });

  it("nabídku nikdy neřídí název firmy, jen GUID", () => {
    // Server výslovně říká, že se ani nabídka, ani brána neřídí názvem — názvy se mění.
    const stejneNazvy = [{ id: PRVNI, name: "Make more" }, { id: DRUHA, name: "Make more" }];

    expect(resolveUploadCompany({
      companies: stejneNazvy,
      storedCompanyId: DRUHA,
    })).toEqual({ stav: COMPANY_SELECTION.CHOSEN, companyTabidooId: DRUHA });
  });

  it("položky s neplatným GUID se do nabídky nepočítají", () => {
    expect(resolveUploadCompany({
      companies: [{ id: "nesmysl", name: "X" }, { id: 42 }, { name: "bez id" }],
      storedCompanyId: "nesmysl",
    }).stav).toBe(COMPANY_SELECTION.NONE);
  });
});
