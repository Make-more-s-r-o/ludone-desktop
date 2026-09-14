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
| D11 | Souhlas s odesláním se ukládá u každé nahrávky jako `held` nebo `approved`; legacy a recovery jsou bez souhlasu. | Ruční odeslání musí fungovat i při vypnuté automatice a přežít restart. Uložená volba `uploadEnabled` bude určovat jen automatiku nových nahrávek; explicitní proměnná prostředí zůstává tvrdou transportní stopkou. Samotné zapnutí automatiky staré položky neschválí. |
| D12 | Potvrzené lokální smazání použije systémový koš, manifest až jako poslední soubor. | Více souborů nelze odstranit jednou atomickou operací. Koš umožní obnovu, částečné selhání ponechá frontu i zbývající manifest a nezaloží nový desktopový archiv. Serverová data se nemažou. |
| D13 | Odhlášený panel zpřístupní Nastavení přímo. | Skutečný GUI průchod ukázal, že jinak je dostupné jen přes kontextové menu ikony v liště. Lokální přehled má být použitelný i bez přihlášení. |
| D14 | Ověření obnovené nahrávky smí číst již existující přesně pojmenovaný recovery upload manifest. | Primární manifest po pádu obsahuje neúplná metadata, skutečný upload používá `${primary}.recovered-upload-v1.json`. Primární manifest zůstává autoritou identity a cest. Známý sidecar se přijme jen při shodě UUID, času, zdrojů, názvů souborů a všech již známých hashů a velikostí primárního manifestu; obě čtení musí být omezená, stabilní a bez následování symlinků. Ověření nic negeneruje ani nepřepisuje a musí fungovat také při chybějícím audiu, dokud fronta obsahuje uložená serverová ID. Skutečná retence může odstranit celou queue položku; zbylý orphan pak ID nemá a zůstává neověřený. |

| D15 | Dokončit výslovný výběr upload firmy v existujícím Nastavení a atomicky jej vázat na skutečnou session/identitu. | Průzkum kódu potvrdil, že více firem bez uložené volby dosud vyžaduje LUDONE_UPLOAD_COMPANY z terminálu. To blokuje schválené odesílání z Finderu. Controller a samostatná komponenta vzniknou nezávisle, main/preload/Settings se zapojí až po T5. Volba nic neodešle a nesmí přepsat cizí účet ani přesunout inicializovaný záznam do jiné firmy. |

## Čeká na ověření

Publikační GitHub Secrets/Variables, záloha podpisového klíče, nový podepsaný build a Danův skutečný test zůstávají samostatné ověřovací kroky. Chybějící přístup neblokuje implementaci.
