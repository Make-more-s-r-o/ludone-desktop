import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { UPLOAD_SCOPE, validatedMcpScope } = require("../electron/auth.cjs");

// 🔴 PROČ TENHLE SOUBOR VZNIKL: serverová session postavila 10. 9. 2026 tvrdou podmínku —
// oprávnění k odesílání nahrávek se smí žádat VÝHRADNĚ SAMO. Důvod není formální: kdyby
// šlo požádat o „nahravky:upload mcp:read" najednou, vznikl by jediný token, kterým jde
// současně nahrávat zvuk A číst všechny MCP nástroje — mzdy, rozpočty, nabídky i cizí
// přepisy. Právě proto rozšíření `mcp:read` zamítli a udělali oprávnění nové.
//
// Podmínka se má držet KONSTRUKCÍ, ne kázní volajícího. Tenhle soubor je ta konstrukce.

describe("oprávnění k odesílání se žádá samostatně", () => {
  it("samotné oprávnění k odesílání projde", () => {
    expect(validatedMcpScope(UPLOAD_SCOPE)).toBe(UPLOAD_SCOPE);
  });

  it.each([
    ["čtení napřed", `mcp:read ${UPLOAD_SCOPE}`],
    ["čtení vzadu", `${UPLOAD_SCOPE} mcp:read`],
    ["s návrhem", `${UPLOAD_SCOPE} mcp:draft`],
    ["se dvěma MCP", `mcp:read mcp:draft ${UPLOAD_SCOPE}`],
  ])("%s: kombinace s MCP se odmítne", (_popis, scope) => {
    // Tohle je ta nebezpečná varianta — token, který umí odesílat i číst cizí data.
    expect(() => validatedMcpScope(scope)).toThrow(/samostatně/);
  });

  it("oprávnění k odesílání nesmí být doplněné ani o neznámé", () => {
    expect(() => validatedMcpScope(`${UPLOAD_SCOPE} cosi:jineho`)).toThrow();
  });

  it.each([
    ["čtení", "mcp:read"],
    ["návrh", "mcp:draft"],
    ["obojí", "mcp:read mcp:draft"],
  ])("MCP oprávnění (%s) fungují dál beze změny", (_popis, scope) => {
    expect(validatedMcpScope(scope)).toBe(scope);
  });

  it.each([
    ["vymyšlené", "mcp:zapis"],
    ["cizí", "nahravky:cti"],
    ["prázdné", "   "],
  ])("%s oprávnění se odmítne", (_popis, scope) => {
    expect(() => validatedMcpScope(scope)).toThrow();
  });

  it("nadbytečné mezery nevyrobí prázdnou položku, která by prošla", () => {
    // Bez odfiltrování prázdných řetězců by „mcp:read  " rozpadlo na tři položky
    // a prostřední prázdná by v množině nebyla — funkce by spadla na nesprávné hlášce.
    expect(validatedMcpScope("  mcp:read   mcp:draft  ")).toBe("mcp:read mcp:draft");
  });

  it("jméno oprávnění je přesně to, na kterém se strany dohodly", () => {
    // Překlep by se projevil až odmítnutím od serveru, a to až u uživatele.
    expect(UPLOAD_SCOPE).toBe("nahravky:upload");
  });
});
