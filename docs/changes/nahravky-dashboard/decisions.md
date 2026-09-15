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
| D8 | Finální tag a zveřejnění aktualizace měl podle původního pověření provést Dan po převzetí. | Historická hranice vloženého goalu a zadání §11; pro vydání 0.1.3 ji nahrazuje D19. |
| D9 | Použít masterplan skill pro stav, evidenci a přehled. | Dan 14. 9.: „pak masterplan taky aktualizuj podle skillu“. Projektový overlay chybí, používá se univerzální proces s předností už schváleného goalu a AGENTS.md. |
| D10 | Nevytvářet nové schválení designu ani znovu žádat potvrzení plánu. | Dan schválil samostatnou implementaci funkcí a výslovně odložil redesign. L0 kontrakt níže popisuje autorizované chování; žádný falešný hookový approval se nevyrábí. |
| D11 | Souhlas s odesláním se ukládá u každé nahrávky jako `held` nebo `approved`; legacy a recovery jsou bez souhlasu. | Ruční odeslání musí fungovat i při vypnuté automatice a přežít restart. Uložená volba `uploadEnabled` bude určovat jen automatiku nových nahrávek; explicitní proměnná prostředí zůstává tvrdou transportní stopkou. Samotné zapnutí automatiky staré položky neschválí. |
| D12 | Potvrzené lokální smazání použije systémový koš, manifest až jako poslední soubor. | Více souborů nelze odstranit jednou atomickou operací. Koš umožní obnovu, částečné selhání ponechá frontu i zbývající manifest a nezaloží nový desktopový archiv. Serverová data se nemažou. |
| D13 | Odhlášený panel zpřístupní Nastavení přímo. | Skutečný GUI průchod ukázal, že jinak je dostupné jen přes kontextové menu ikony v liště. Lokální přehled má být použitelný i bez přihlášení. |
| D14 | Ověření obnovené nahrávky smí číst již existující přesně pojmenovaný recovery upload manifest. | Primární manifest po pádu obsahuje neúplná metadata, skutečný upload používá `${primary}.recovered-upload-v1.json`. Primární manifest zůstává autoritou identity a cest. Známý sidecar se přijme jen při shodě UUID, času, zdrojů, názvů souborů a všech již známých hashů a velikostí primárního manifestu; obě čtení musí být omezená, stabilní a bez následování symlinků. Ověření nic negeneruje ani nepřepisuje a musí fungovat také při chybějícím audiu, dokud fronta obsahuje uložená serverová ID. Skutečná retence může odstranit celou queue položku; zbylý orphan pak ID nemá a zůstává neověřený. |
| D15 | Dokončit výslovný výběr upload firmy v existujícím Nastavení a atomicky jej vázat na skutečnou session/identitu. | Průzkum kódu potvrdil, že více firem bez uložené volby dosud vyžaduje LUDONE_UPLOAD_COMPANY z terminálu. To blokuje schválené odesílání z Finderu. Controller a samostatná komponenta vzniknou nezávisle, main/preload/Settings se zapojí až po T5. Volba nic neodešle a nesmí přepsat cizí účet ani přesunout inicializovaný záznam do jiné firmy. |
| D16 | Před prvním INIT trvale připnout firmu k uploadu; automatické pokračování ji nemění. | Klient při každém pokusu opakuje idempotentní INIT, proto pouhé uložení recordingId nezabrání použití nové globální firmy pro další stopu. Interní server.companyTabidooId se uloží přes existující durable progress před HTTP. Legacy initialized bez známé firmy se bezpečně zablokuje. Výslovné retry po company_out_of_scope může změnit pin jen při nulových serverových ID/session/progress; již přijatý explicitní claim vlastníka dál resetuje celý serverový stav a drží nahrávku bez consentu. |
| D17 | Retry také pro vlastní schválenou čekající nahrávku vyžadující ruční zásah. | Dan 15. 9. nahlásil chybějící tlačítko; read-only kontrola potvrdila mezeru po nevybrané firmě. Výběr firmy sám nic neodešle a kontroly akce zůstávají. |
| D18 | Proužek s přínosem a jednorázové oznámení macOS; automatické stažení, instalace po kliknutí, možnost odložit. | Obě výslovné Danovy odpovědi 15. 9. Zachovat kontrolu po startu a šesti hodinách a bezpečné dokončení nahrávání, uložení, fronty a časovače. |
| D19 | Koordinátor smí vytvořit a pushnout tag `v0.1.3` a spustit tím podepsané vydání na `stahnout.ludone.cz`. | Dan 15. 9. výslovně: „Ano, vydej 0.1.3 sám.“ Jde o jednorázové pověření pro 0.1.3; živou instalaci, zvuk a update dál ověřuje Dan na Macu. |

| D20 | Jedna schůzka se odesílá jako jeden stereo MP3: mikrofon vlevo, systém vpravo; původní stopy zůstanou na Macu. | Dan 15. 9. výslovně žádá jeden záznam na app.ludone a následně formát MP3. Nahrazuje dvoustopý upload v P1/P5; podrobnosti a přechod starých položek viz [STEREO-MP3](STEREO-MP3.md). |

## Čeká na ověření

Vydání 0.1.3 je doložené úspěšným workflow 34948618429 a nezávislou veřejnou kontrolou.
V době kontroly po vydání zůstává na Macu 0.1.2. Živý upload, aktualizace při rozpracované
činnosti, skutečné oznámení a zvuk po instalaci nadále čekají na ověření.
