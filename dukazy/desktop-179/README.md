# Desktop #179 — průběžný úklid, účinná retence a místo

🧪 646 testů v osmi souborech, lint 0 errors a typecheck prošly (exit 0).
Doslovné příkazy a výstupy včetně exit kódů jsou v `testy.log`, `lint.log`
a `typecheck.log`. Běh používá Node v22.23.4; repozitář vyžaduje 24.19.x (#176).
Testový harness `queue-wiring` během ověření vypisoval chyby síťového downloaderu
`@electron/get`; testy přesto prošly. Není tím doložená funkčnost Electronu.

Úklid při startu i za běhu volá stejné `applyRetention`. Průběžný úklid běží
po trvalém zápisu potvrzeného uploadu a každou hodinu. Sdílí transakční řadu
fronty se všemi uploady a zápisy; dva současné spouštěče sdílejí jeden Promise.
Guard blokuje mazání během přípravy, nahrávání, dokončování, exportu a uploadu.
Kontroluje se i po asynchronním preflightu, před jednotlivými unlink operacemi.
Test porovnává doslovný seznam mazání při startu a za běhu pro všech pět voleb,
včetně stereo derivátů, recovery sidecaru a chráněné neúplné nahrávky.
Další test pozastaví skutečnou metodu send ve storu a ověří, že úklid čeká
na dokončení uploadu a že notifikace vznikne až po trvalém zápisu `odeslano`.
Hodinové spuštění je ověřeno přes main harness a skutečný store bez restartu.

Main uchovává retenci v `nastaveni/retence.json`. Při prvním startu převezme
historickou hodnotu z localStorage panelu; chybějící či vadná znamená `Nemazat`.
Existující vadné main nastavení rovněž znamená `Nemazat`, nepřebírá znovu starou
volbu. Renderer v aplikaci čte a zapisuje přes validované IPC. Během čtení
ukazuje načítání. Samostatný prototyp bez IPC zachovává historický formát zápisu.
Výchozí očekávání v GUI smoke skriptu bylo změněno na `Nemazat`, aby odpovídalo
novému zobrazení; jeho kontroly ani existující testové podmínky nebyly oslabeny.
Seznam kanálů v testu ochrany IPC byl rozšířen o tři nové validované kanály.
Nové integrační testy ověřují odmítnutí cizího odesílatele i vadných payloadů.

Součet z mainu rekurzivně zahrnuje všechny běžné soubory pod `nahravky/`
a `queue/`, tedy originály, systémovou stopu, master, delivery, manifesty,
sidecary, zbytky JSON i dočasné encoder adresáře. Nenásleduje symlinky;
hardlinky se stejnou dvojicí device/inode započítá jednou. Vrací bajty,
počet souborů, čas měření a příznak úplnosti. UI obnovuje údaj po dokončení
nahrávky/exportu, po úklidu a při otevření; během zobrazení také každých 15 s.
Jde o součet velikostí souborů, nikoli alokovaných bloků nebo volného místa disku.

Stažené se neskenují: aplikace nemá bezpečný přehled všech historických exportů
ani jejich případných změn. UI je uvádí jako soubory mimo aplikaci bez číselného
odhadu. Automatický export, originály, master, bitrate, limity ani pravidla
způsobilosti k mazání se nemění.

🧪 Všechny tři dočasné sabotáže skončily exit 1 a byly vráceny:

- Průběžný úklid zruší ochranu neúplných položek: čtyři porovnání seznamů FAIL.
- UI opět použije sedm dní bez uložené volby: test výchozího zobrazení FAIL.
- Součet vynechá systémovou stopu a master: test skutečných bajtů FAIL.

Filtrované sabotáže vybírají jen příslušné testy pomocí `-t`; ostatní testy
Vitest vypisuje jako skipped kvůli filtru. Žádný skip do zdrojů nebyl přidán.

⛔ GUI, skutečný zvuk a produkční upload nebyly spuštěny. Ověření proběhlo pouze
v testech se simulovaným Electronem a dočasnými soubory. Nebyl proveden commit,
push ani jiná změna gitu; důkazy jsou připravené k převzetí koordinátorem.

## Kolo 2 — obnovené zapojení a sabotáž ochrany

Obnoveno zapojení v `electron/main.cjs`: migrace retence do main storu,
validované IPC pro účinnou retenci a součet místa, notifikace po dokončení
nahrávky/exportu a úklidu, callback po potvrzeném uploadu a hodinový časovač.
Průběžný úklid používá serializovanou metodu existujícího queue storu.

Nový `tests/runtime-retention-wiring.test.js` načítá doslovné funkce
`retentionFilesIdle` a `retainOutboundRecordings` z produkčního `main.cjs`.
Spouští je se skutečným queue storem a retenčním modulem nad dočasnými soubory.
Samostatně ověřuje přípravu, nahrávání, dokončování, export a odesílání:
během operace zůstanou audio i fronta zachované; po uvolnění se stejná
způsobilá nahrávka uklidí. Electron ani aplikace se nespouští.

🧪 Finální běh po obnově: 651 PASS v devíti souborech, exit 0; lint 0 errors
a typecheck exit 0.

🧪 Sabotáž těla `retentionFilesIdle` na `return true` shodila všech pět
nových testů (exit 1). Původní obsah byl obnoven ručně v `finally`, bez gitu,
a shoda obnoveného obsahu byla ověřena. Doslovný výstup je v
`kolo2-sabotaz-guard.log`; finální zelený běh všech devíti souborů je v
`kolo2-testy-obnoveno.log`. Lint a typecheck jsou v `kolo2-lint.log`
a `kolo2-typecheck.log`, včetně příkazů a exit kódů.

Limity, množina způsobilá k mazání, Stažené, kodek, originály a master
se v tomto kole nemění. Node v22.23.4. ⛔ GUI, zvuk a produkční upload
zůstávají neověřené. Žádná mutace gitu, MCP ani subagent nebyly použity.
