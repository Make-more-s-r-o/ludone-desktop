# Rozhodnutí běhu 14. 9. 2026

| ID | Rozhodnutí | Zdroj a důvod |
|---|---|---|
| D1 | Backend, LuTrack a `design/` bez změn; redesign odložen. | Danův vložený goal. |
| D2 | Výchozí volba odeslání po každé nahrávce; automatika jen pro nové nahrávky. | Danův vložený goal; zapnutí nesmí rozeslat stará data. |
| D3 | Přihlášení a upload musí fungovat z Finderu bez shellových proměnných. | Danův goal nahrazuje staré odložení přepínače v §12 zadání. Scope a zdroj identity zůstávají spolu. |
| D4 | Astra řídí a reviewuje, Sol implementuje, nejvýše tři workery současně. | Danův goal; git a worktree pravidla určuje AGENTS.md. |
| D5 | Převzetí jen potvrzeným klikem u jediné položky, s platnou aktuální identitou. | Zadání T2; žádné automatické připsání vlastníka při obnově. |
| D6 | Serverové ověření na výslovnou akci, mezipaměť v paměti hlavního procesu, bez nového archivu. | Implementační rozhodnutí; GET limit sdílí desktop s webem i uploadem. Přesný rozpočet bude doložen s T4. |
| D7 | Existující instalační hosting používá SCP; přístupové hodnoty pouze z GitHub Secrets/Variables. | Read-only průzkum LuDone/DAN-TODO.md doložil SCP a statický adresář; hodnoty tajemství se nečtou ani neukládají do repozitáře. |
| D8 | Finální tag a zveřejnění aktualizace provede Dan po převzetí. | Výslovná hranice vloženého goalu a zadání §11. |
| D9 | Použít masterplan skill pro stav, evidenci a přehled. | Dan 14. 9.: „pak masterplan taky aktualizuj podle skillu“. Projektový overlay chybí, používá se univerzální proces s předností už schváleného goalu a AGENTS.md. |
| D10 | Nevytvářet nové schválení designu ani znovu žádat potvrzení plánu. | Dan schválil samostatnou implementaci funkcí a výslovně odložil redesign. L0 kontrakt níže popisuje autorizované chování; žádný falešný hookový approval se nevyrábí. |

## Čeká na ověření

Publikační GitHub Secrets/Variables, záloha podpisového klíče, nový podepsaný build a Danův skutečný test zůstávají samostatné ověřovací kroky. Chybějící přístup neblokuje implementaci.
