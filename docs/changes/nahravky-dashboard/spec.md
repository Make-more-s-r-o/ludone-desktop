# Funkční kontrakt doplnění

Podrobnosti a pasti určuje [zadání](ZADANI-PRO-CODEX.md). Novější rozhodnutí jsou v [decisions.md](decisions.md).

| ID | Funkce | Akceptace |
|---|---|---|
| NRD-01 | Úplná a obnovitelná fronta | Po úspěchu nebo částečném uploadu soubor fronty zachová ID každé stopy a sezení; restart nezmění identitu dat. |
| NRD-02 | Výslovné převzetí | Bez platného účtu nelze převzít; potvrzení mění pouze vybranou aktuální položku, nikoli jiné ani již běžící uploady. |
| NRD-03 | Lokální přehled | Fronta, soubory mimo frontu a chybějící soubory jsou odlišitelné; poškození se nezobrazí jako prázdný seznam. |
| NRD-04 | Porovnání serveru | Na výslovnou akci se ověří známé ID obou stop. Neznámé ID, 404, 429, přihlášení a síť mají pravdivý odlišný stav. |
| NRD-05 | Odeslání podle volby | „Nechat na Macu“ nepustí nahrávku do pumpy. Zapnutí automatiky nepovolí staré položky. Název se přenese existujícím serverovým kontraktem. |
| NRD-06 | Akce nad záznamem | Opakování, potvrzené smazání, otevření složky a existující webové stránky fungují nad čerstvou konkrétní položkou. |
| NRD-07 | Produkční přihlášení | Finder aplikace získá upload scope a správnou identitu; odmítnutý klient se obnoví řízeně bez opakování starého refresh tokenu. |
| NRD-08 | Vydání a update | Podepsané balíčky projdou validací, upload publikuje metadata až po souborech. Uživatel vidí dostupnou aktualizaci; restart respektuje rozpracované činnosti. |

Nepřidává se serverový seznam ani archiv historie. Webová cesta byla doložena read-only v `LuDone/ludone-app`: upload UI otevírá `/nahravky/${recordingId}` a odpovídající detail route existuje. Přesný host vychází z platného prostředí uživatele.
