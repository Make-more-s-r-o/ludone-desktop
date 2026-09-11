import { afterEach, beforeEach, vi } from "vitest";

// 🔴 TESTY NESMÍ SAHAT NA SKUTEČNOU SÍŤ.
//
// 11. 9. 2026 se ukázalo, že naše sada volá ŽIVÝ server. Každý běh poslal na labs šest
// pokusů o obnovu tokenu a dva dotazy na seznam firem — všechno odmítnuté `401`, protože
// `client_id` je vymyšlené z fixture. Testy přitom zůstaly ZELENÉ: kontrolují jen odvozený
// stav („Přihlášení vypršelo"), který nastane při úspěchu i při selhání úplně stejně.
//
// Cena nebyla nulová:
//  · protistrana dostala přes 200 odmítnutých požadavků za jedno odpoledne (CI i lokální běhy),
//  · lokální běhy čerpaly uživatelův limit neúspěšného ověření, který server SDÍLÍ
//    s `/api/mcp` — pár souběžných běhů testů a člověku spadne vlastní MCP na `429`,
//  · a stálo to celý večer hledání „druhé instance aplikace", která neexistovala; ten jev
//    vyráběla právě tahle sada při každém spuštění.
//
// Proto je zákaz GLOBÁLNÍ a ne záplata na dva konkrétní testy. Opravit jen dnešní viníky by
// past nechalo nastraženou pro test, který někdo napíše příště — a ten by byl zase zelený.
//
// Test, který síť opravdu potřebuje simulovat, si atrapu podstrčí sám: buď předá `fetchImpl`,
// nebo v těle testu zavolá `vi.stubGlobal("fetch", …)`. Obojí je vidět v kódu testu, což je
// přesně ten rozdíl proti tichému volání ven.
// 🔴 Čítač není ozdoba — bez něj je tenhle zákaz sám neměřitelný.
//
// Když jsem zákaz nasadil, sada zůstala zelená a já usoudil, že se nechytil ani jednou.
// Byl to omyl: zákaz se chytal, ale PRODUKČNÍ KÓD tu výjimku SPOLKNE. Obnova tokenu i výběr
// firem mají vlastní ošetření síťové chyby, takže test doběhl zeleně a v jeho výstupu po
// zásahu nezbyla stopa. Postavil jsem pojistku, jejíž vlastní zásahy nebyly vidět — přesně
// ta vada, kterou jsem ten den lovil u všeho ostatního.
//
// Proto se počítá přímo ve stubu a test se shodí podle ČÍTAČE, ne podle toho, jestli
// výjimka někam probublala. Spolknutou výjimku takhle nikdo neschová.
let zasahyVTestu = 0;

function sitVTestechZakazana() {
  zasahyVTestu += 1;
  throw new Error(
    "Síť je v testech zakázaná: tenhle test sáhl na skutečný `fetch`. "
    + "Předej testovanému kódu atrapu (`fetchImpl`), nebo si fetch v testu výslovně "
    + "podstrč přes `vi.stubGlobal(\"fetch\", …)`.",
  );
}

vi.stubGlobal("fetch", sitVTestechZakazana);

// Znovu před každým testem: kdyby si předchozí test fetch podstrčil, nesmí to „přetéct"
// do dalšího a tiše mu povolit síť.
beforeEach(() => {
  zasahyVTestu = 0;
  vi.stubGlobal("fetch", sitVTestechZakazana);
});

afterEach(() => {
  if (zasahyVTestu === 0) return;
  const kolik = zasahyVTestu;
  zasahyVTestu = 0;
  throw new Error(
    `Tenhle test ${kolik}× sáhl na skutečný \`fetch\`. Zákaz ho zastavil, takže ven nic `
    + "neodešlo — ale testovaný kód tu výjimku spolkl, takže by jinak prošel zeleně. "
    + "Podstrč mu atrapu (`fetchImpl`), nebo si fetch v testu výslovně nastav.",
  );
});
