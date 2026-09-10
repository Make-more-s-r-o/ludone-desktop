import { describe, expect, it } from "vitest";
import {
  MICROPHONE_ONLY_TEXT,
  microphoneOnlyReason,
} from "../src/features/recording/recording-copy.js";

// 🔴 PROČ TENHLE SOUBOR VZNIKL: panel psal u systémového zvuku „ticho" i tehdy, když se
// stopa vůbec nezískala. Uživatel z obrazovky nemohl poznat, jestli má mluvit hlasitěji,
// nebo něco povolit — a aplikace přitom příčinu znala a zahazovala ji.
//
// 🔴 A ještě horší past, kterou tenhle soubor zamyká: aplikace se ptá na „Záznam
// obrazovky", jenže nahrávání zvuku z ostatních aplikací je od macOS 14.4 SAMOSTATNÉ
// oprávnění, na které Electron nemá API. Doloženo 10. 9. 2026: Záznam obrazovky povolený,
// nahrávka přesto jednostopá. Text proto nikdy nesmí tvrdit „všechno je v pořádku" jen
// proto, že prošla odpověď na jinou otázku.

const POVOLENI_ZVUKU = /samostatné povolení/;

describe("proč je ostatní zvuk ticho", () => {
  it.each([
    ["odepřené oprávnění", "denied"],
    ["nikdy se na ně neptalo", "not-determined"],
  ])("%s pošle člověka povolit Záznam obrazovky a restartovat", (_popis, status) => {
    const veta = microphoneOnlyReason({ permission: { status } });

    expect(veta).toContain("Záznam obrazovky");
    expect(veta).toMatch(/Povol ho/);
    // Bez věty o restartu je rada k ničemu: macOS oprávnění dřív neuzná.
    expect(veta).toMatch(/ukonči a spusť znovu/);
    expect(veta).not.toBe(MICROPHONE_ONLY_TEXT);
  });

  // Nejcennější případ: dřív vypadal úplně stejně jako ticho a odpověď „povoleno" na něj
  // svítila zeleně, protože se ptala na jiné oprávnění.
  it("povolený Záznam obrazovky NEZNAMENÁ, že je vše v pořádku", () => {
    const veta = microphoneOnlyReason({ permission: { status: "granted" } });

    expect(veta).toMatch(POVOLENI_ZVUKU);
    expect(veta).toMatch(/oddělené od Záznamu obrazovky/);
    expect(veta).toMatch(/ukonči a spusť znovu/);
    expect(veta).not.toBe(MICROPHONE_ONLY_TEXT);
  });

  it("zákaz od správce řekne rovnou, že s tím člověk sám nic neudělá", () => {
    const veta = microphoneOnlyReason({ permission: { status: "restricted" } });

    expect(veta).toMatch(/správce/);
    expect(veta).not.toMatch(/Povol ho/);
  });

  it.each([
    ["chybějící kontext", undefined],
    ["prázdný kontext", {}],
    ["chybějící odpověď o oprávnění", { permission: null }],
    ["neznámý stav", { permission: { status: "cosi-jineho" } }],
  ])("%s pořád vysvětlí samostatné povolení, nemlčí", (_popis, vstup) => {
    const veta = microphoneOnlyReason(vstup);
    expect(veta).toMatch(POVOLENI_ZVUKU);
    expect(veta).not.toBe(MICROPHONE_ONLY_TEXT);
  });

  it("technický důvod od systému připojí, když nějaký je", () => {
    const veta = microphoneOnlyReason({
      permission: { status: "granted" },
      error: new Error("CATapDescription initialization failed"),
    });

    expect(veta).toContain("systém hlásí: CATapDescription initialization failed");
  });

  it.each([
    ["chybějící chyba", undefined],
    ["prázdná hláška", new Error("")],
    ["samé mezery", new Error("   ")],
    ["cizí objekt", { kdovico: true }],
  ])("%s do věty nepřilepí prázdnou závorku", (_popis, error) => {
    const veta = microphoneOnlyReason({ permission: { status: "granted" }, error });
    expect(veta).not.toMatch(/systém hlásí/);
    expect(veta).not.toMatch(/\(\s*\)/);
    expect(veta).not.toContain("[object Object]");
  });

  it("dlouhý zásobník volání se zkrátí, ať věta zůstane čitelná", () => {
    const veta = microphoneOnlyReason({
      permission: { status: "granted" },
      error: new Error("x".repeat(400)),
    });

    // Měří se DÉLKA PŘIPOJENÉHO DŮVODU, ne celé věty: kdyby se měřila celá, test by
    // zčervenal při každé úpravě rady o povolení a nikdo by z něj nepoznal, co je vadné.
    const duvod = veta.slice(veta.indexOf("systém hlásí: "));
    expect(duvod).toContain("…");
    expect(duvod.length).toBeLessThan(150);
  });

  it("žádná z vět nezůstane prázdná ani s mezerami na kraji", () => {
    for (const status of ["denied", "not-determined", "granted", "restricted", "neznamy"]) {
      const veta = microphoneOnlyReason({ permission: { status } });
      expect(veta.length).toBeGreaterThan(40);
      expect(veta.trim()).toBe(veta);
    }
  });
});
