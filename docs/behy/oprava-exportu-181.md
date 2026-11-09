# Oprava exportu kopie — PR #181

## Premisa a rozsah

Pracovní adresář odpovídal zadání: /Users/dev_ludone/orca/workspaces/ludone-desktop/issue-179-velikost. HEAD byl ověřen přímým čtením worktree reference jako 95fd904abb049ea7675ae0e10f3e483e976740f1; nebyl spuštěn žádný git příkaz. Použitý Node byl v24.22.2 (rozsah .nvmrc: 24.19.0).

Změna zachovává variantu A: kopii vytváří jen explicitní export. Send, keep, automatické odeslání a upload používají interní delivery. Zrušení je nevratné; před předáním atomického hardlinku nevznikne finální soubor, po předání může doběhnout jen kompletní ověřená kopie a výsledek je označený jako neurčitý. Nikdy se dodatečně nemaže finální soubor. Úklid ověřuje identitu a odstraňuje pouze dočasné jméno daného pokusu. Při ukončení procesu nebo zaseknutém filesystému může vlastní dočasný soubor zůstat ve Stažených.

Přepsaná očekávání mají nyní výslovné nové aserce:

- Čekání na kopii při quitu se změnilo na její zrušení a pokračování quitu; test zároveň kontroluje, že nekončící LuTrack nepřijde o svůj původní timeout.
- Odmítnutí logoutu kvůli kopii se změnilo na zrušení kopie a pokračování logoutu. Test samostatně porovnává frontu i bajty chráněných souborů.
- Odmítnutí potvrzeného koše kvůli kopii se změnilo na zrušení kopie a provedení koše. Test porovnává přesný seznam přesunutých souborů, prázdný adresář a odstraněný řádek fronty.
- Odmítnutí runtime retence kvůli kopii se změnilo na zrušení kopie a původní oprávněný úklid. Test ověřuje přesný seznam souborů, odstraněný řádek a nulové chyby retence.
- Odmítnutí změny prostředí kvůli kopii se změnilo na zrušení kopie a provedení změny. Samostatně jsou pokryté auth:set-origin i auth:switch-origin.

Reprodukce obou nálezů kola 4 byly přidány před opravou: produkční quit handler s trvale pozastavenou kopií a falešným časem přes 15 sekund včetně tří opakovaných Cmd+Q; a skutečný dashboard DOM se třemi samostatnými změnami názvu a exportem poslední hodnoty. Původní cesta držela quit na rezervaci kopie a odložený updater názvu četl event.currentTarget až po skončení události. Opravené reprodukce jsou součástí akceptační skupiny „Nálezy kola 4“.

## Cílené testy

Všechny čtyři příkazy byly spuštěny postupně pod Node v24.22.2; výpisy jsou doslovné. Exit kód je uveden hned za každým výpisem.

### 1. Export a dashboard

~~~text
$ PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:unit -- tests/recording-export.test.js tests/recordings-dashboard.test.js --maxWorkers=2

> ludone-desktop-prototype@0.1.11 test:unit
> vitest run tests/recording-export.test.js tests/recordings-dashboard.test.js --maxWorkers=2


 RUN  v4.1.11 /Users/dev_ludone/orca/workspaces/ludone-desktop/issue-179-velikost


 Test Files  2 passed (2)
      Tests  127 passed (127)
   Start at  17:12:43
   Duration  923ms (transform 117ms, setup 22ms, import 337ms, tests 1.02s, environment 0ms)

exit: 0
~~~

### 2. Queue a RecordingCard

~~~text
$ PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:unit -- tests/queue-wiring.test.js tests/recording-card.test.js --maxWorkers=2

> ludone-desktop-prototype@0.1.11 test:unit
> vitest run tests/queue-wiring.test.js tests/recording-card.test.js --maxWorkers=2


 RUN  v4.1.11 /Users/dev_ludone/orca/workspaces/ludone-desktop/issue-179-velikost


 Test Files  2 passed (2)
      Tests  429 passed (429)
   Start at  17:12:47
   Duration  12.90s (transform 374ms, setup 23ms, import 879ms, tests 13.87s, environment 0ms)

exit: 0
~~~

### 3. Logout a runtime retence

~~~text
$ PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:unit -- tests/logout.test.js tests/runtime-retention-wiring.test.js --maxWorkers=2

> ludone-desktop-prototype@0.1.11 test:unit
> vitest run tests/logout.test.js tests/runtime-retention-wiring.test.js --maxWorkers=2


 RUN  v4.1.11 /Users/dev_ludone/orca/workspaces/ludone-desktop/issue-179-velikost


 Test Files  2 passed (2)
      Tests  29 passed | 1 skipped (30)
   Start at  17:13:03
   Duration  513ms (transform 58ms, setup 21ms, import 64ms, tests 677ms, environment 0ms)

exit: 0
~~~

Jeden přeskočený test je existující; žádný skip ani brána nebyly upraveny.

### 4. Recording actions a Settings

~~~text
$ PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run test:unit -- tests/recording-actions.test.js tests/settings.test.js --maxWorkers=2

> ludone-desktop-prototype@0.1.11 test:unit
> vitest run tests/recording-actions.test.js tests/settings.test.js --maxWorkers=2


 RUN  v4.1.11 /Users/dev_ludone/orca/workspaces/ludone-desktop/issue-179-velikost


 Test Files  2 passed (2)
      Tests  88 passed (88)
   Start at  17:13:08
   Duration  1.91s (transform 172ms, setup 20ms, import 385ms, tests 1.84s, environment 0ms)

exit: 0
~~~

## Statické a akceptační kontroly

TypeScript kontrola: PATH=/opt/homebrew/opt/node@24/bin:$PATH ./node_modules/.bin/tsc --noEmit -p jsconfig.json — prázdný výstup, exit 0.

ESLint změněných implementačních, testovacích a akceptačních souborů:

~~~text
$ PATH=/opt/homebrew/opt/node@24/bin:$PATH ./node_modules/.bin/eslint electron/main.cjs electron/queue.cjs electron/recording-export.cjs src/features/recording/RecordingCard.jsx src/features/recordings/RecordingsDashboard.jsx tests/recording-export.test.js tests/queue-wiring.test.js tests/recordings-dashboard.test.js tests/recording-card.test.js tests/logout.test.js tests/runtime-retention-wiring.test.js tests/recording-actions.test.js scripts/akceptace/export-kopie-181.mjs
výstup: prázdný
exit: 0
~~~

Syntax kontrola příkazem PATH=/opt/homebrew/opt/node@24/bin:$PATH node --check electron/main.cjs && PATH=/opt/homebrew/opt/node@24/bin:$PATH node --check electron/queue.cjs && PATH=/opt/homebrew/opt/node@24/bin:$PATH node --check electron/recording-export.cjs && PATH=/opt/homebrew/opt/node@24/bin:$PATH node --check scripts/akceptace/export-kopie-181.mjs — prázdný výstup, exit 0.

Akceptační skript PATH=/opt/homebrew/opt/node@24/bin:$PATH node scripts/akceptace/export-kopie-181.mjs:

~~~text
PASS: Nálezy kola 4: quit po timeoutu a poslední upravený název — 3 testů, exit 0.
PASS: Atomický export: hotový soubor, metadata shodné kopie a kolize — 4 testů, exit 0.
PASS: Přerušení: bariéry zápisu, publikace, timeout a ukončení — 6 testů, exit 0.
PASS: Varianta A: žádná automatická kopie a explicitní export zůstává dostupný — 6 testů, exit 0.
~~~

Skript celkem hlásí 19 pokrytých testů ve čtyřech nezávislých skupinách; exit 0.

## Behaviorální sabotáže

Každá mutace byla provedena samostatně, bez změny testu, po ní spuštěn níže uvedený test a opravený soubor vrácen z kontrolní kopie před další mutací. Všech deset mutací vyvolalo behaviorální červený test; žádná se nepočítá pouze kvůli syntaktické chybě.

| # | Skutečná mutace | Test, který selhal | Červených |
|---|---|---|---:|
| 1 | Odstraněno cancelRecordingCopyOperations("quit") z before-quit. | zrušení po prvním skutečně zapsaném bloku předá quit a odstraní jen staging; požadované recordingExported: false se změnilo na úspěšně zveřejněnou kopii. | 1 |
| 2 | Odstraněno cancelRecordingCopyOperations("update-install") před quitAndInstall. | souhlas uživatele s aktualizací zruší kopii před quitAndInstall; signal nebyl abortnut (aborted: false). | 1 |
| 3 | Vráceno čekání na běžící kopii do povinné quit agendy. | běžný quit nečeká na rozběhnutou kopii; quit znovu volal preventDefault. | 1 |
| 4 | Odstraněn časovač 120 sekund při registraci operace. | 120sekundová lhůta pokrývá i ověření snapshotu před otevřením exportéru; skutečný IPC požadavek zůstal viset a test vypršel. | 1 |
| 5 | Externí abort relay exportéru změněn na no-op. | po zrušení v bariéře prvního zápisu nevytvoří cíl a dovolí nový export; export pokračoval po abortu a dokončil soubor. | 1 |
| 6 | Atomické link nahrazeno zveřejněním přepisujícím cíl. | odmítne odlišný obsah pod existujícím jménem a zachová původní cíl; kolize byla přijata místo odmítnutí. | 1 |
| 7 | Kontrola SHA-256 zúžena na samotnou velikost. | před zveřejněním odmítne změněný SHA-256 a původní soubor nedotkne; pozměněný obsah byl zveřejněn. | 1 |
| 8 | Úklid změněn z vlastního dočasného jména na finální cestu. | zveřejní jen hotový soubor přes nový režim 0600 a zdroj nechá beze změny; po úklidu chyběl finální soubor. | 1 |
| 9 | Do updateru názvu vráceno čtení event.currentTarget uvnitř state updateru. | po několika skutečných úpravách exportuje poslední název se snapshot revizemi; test skončil na TypeError při čtení value z nulového currentTarget. | 1 |
| 10 | Vráceno automatické kopírování do potvrzení send/keep. | čekající kopie nezablokuje rozhodnutí keep a čekající kopie nezablokuje rozhodnutí send; oba testy zachytily další volání exportRecordingCopy. | 2 |

Zelené kontroly: pomalá platná kopie před timeoutem; opakovaný shodný export se stejným inode a metadaty; nový úspěšný export po předchozím zrušení.

## Kontrolní nuly a neprovedené přejímky

- Automatické kopie do Stažených: 0; testy pokrývají moderní i kompatibilní send/keep a automatické odeslání.
- Zápisy, chmod, trash nebo odstranění zdrojového delivery exportérem: 0; ověřuje se neměnný zdroj, čtení pouze přes read-only deskriptor a volání unlink pouze pro vlastní dočasné jméno.
- Změny pravidel, lhůt, výběru či ochrany runtime retence: 0; změněné je pouze zrušení volitelných kopií před vložením retence do fronty.
- npm run gates a npm run build nebyly v tomto běhu spuštěny: vyžadují CI nad finálním headem. Lokální build nebyl spuštěn, protože zapisuje artefakty dist mimo povolený rozsah změn.
- Skutečné ukončení macOS/Electron, GUI, zvuk, instalace aktualizace a upload nejsou tímto paměťovým testem ověřeny; zůstávají samostatnými lidskými přejímkami.

## Kolo 6 — review nálezy N1–N3 (9. 11. 2026)

Výchozí `HEAD` byl ověřen přímým čtením worktree reference: `505f257ed8e57ad3cbacfff970313a116a07d360`. V tomto kole nebyla spuštěna žádná git operace, MCP, subagent ani instalace závislostí.

- **N1 — panelová fáze a identita:** fáze ukládá origin a otisk účtu vzniklý při nahrávání. Otisk identity se počítá i pro starší `mcp:read` session, která nemá platný otisk vlastníka fronty. Před zahájením exportu a znovu v podmínce `canPublish` se porovnává aktuální účet i prostředí. Regrese pokrývají logout A → login B, změnu prostředí a výměnu účtu těsně před publikací bez změny generačního čítače.
- **N2 — serializace fronty:** načtení `outgoing.json` na začátku i konci ověřování probíhá mimo společný operations řetěz. V řetězu zůstává pouze krátké porovnání položky se stavem v paměti. Regrese pozastaví exportní čtení, zruší export a ověří, že projde `store.list()` i `updateRestartIsSafe()`.
- **N3 — inode dočasného souboru:** těsně před `link()` se porovná `dev+ino` otevřeného deskriptoru s `lstat` dočasného jména a ověří velikost. `lstat` symlink nenásleduje. Testy odmítnou náhradu cizím souborem, hardlinkem zdrojové nahrávky i symlinkem na zdroj. Úklid cizí inode neodstraní.

### Cílené testy a statické kontroly

Příkaz pod Node v24.22.2:

~~~text
$ PATH=/opt/homebrew/opt/node@24/bin:$PATH ./node_modules/.bin/vitest run tests/recording-card.test.js tests/logout.test.js tests/recording-actions.test.js tests/upload-client.test.js tests/ipc-sender-guard.test.js tests/recording-storage.test.js tests/queue.test.js tests/recording-export.test.js tests/recording-playback.test.js tests/runtime-retention-wiring.test.js tests/queue-wiring.test.js tests/recordings-dashboard.test.js tests/renderer-failure-feedback.test.js tests/retention.test.js --maxWorkers=2

 Test Files  14 passed (14)
      Tests  1005 passed | 1 skipped (1006)
exit: 0
~~~

Typecheck `PATH=/opt/homebrew/opt/node@24/bin:$PATH ./node_modules/.bin/tsc --noEmit -p jsconfig.json`: prázdný výstup, exit 0.

ESLint `PATH=/opt/homebrew/opt/node@24/bin:$PATH ./node_modules/.bin/eslint electron/main.cjs electron/queue.cjs electron/recording-export.cjs tests/recording-export.test.js tests/queue-wiring.test.js scripts/akceptace/export-kopie-181.mjs`: prázdný výstup, exit 0.

### Akceptační skript

`PATH=/opt/homebrew/opt/node@24/bin:$PATH node scripts/akceptace/export-kopie-181.mjs`:

~~~text
PASS: N1: identita a prostředí panelové exportní fáze — 3 testů, exit 0.
PASS: N2: exportní čtení fronty neblokuje serializované operace — 1 testů, exit 0.
PASS: N3: výměna dočasného jména za cizí inode nebo alias zdroje — 3 testů, exit 0.
PASS: Nálezy kola 4: quit po timeoutu a poslední upravený název — 3 testů, exit 0.
PASS: Atomický export: hotový soubor, metadata shodné kopie a kolize — 4 testů, exit 0.
PASS: Přerušení: bariéry zápisu, publikace, timeout a ukončení — 6 testů, exit 0.
PASS: Varianta A: žádná automatická kopie a explicitní export zůstává dostupný — 6 testů, exit 0.
~~~

Skript pokrývá 26 testů v sedmi skupinách; všechny skončily exit 0.

### Sabotáže N1–N3

Každá změna implementace byla samostatně vrácena, cílený test spuštěn a zdroj obnoven z kontrolní kopie. `cmp -s` po každém obnovení skončil exit 0.

| Nález | Sabotáž | Výsledek |
|---|---|---|
| N1 | Kontrola `recordingExportStageMatchesCurrentIdentity` vrácena na bezpodmínečné `true`. | 3 červené: účet B, jiné prostředí a změna účtu před publikací byly zveřejněny. |
| N2 | Počáteční `loadQueue(outgoing.json)` vráceno dovnitř `serialize`. | 1 červený test se 2 červenými asercemi: `store.list()` i restartovací bariéra updateru zůstaly blokované. |
| N3 | Kontrola otevřeného a pojmenovaného dočasného inode odstraněna. | 3 červené: cizí soubor, hardlink i symlink byly zveřejněny jako úspěšný export. |

Soubory `electron/main.cjs`, `electron/queue.cjs` a `electron/recording-export.cjs` byly po sabotážích porovnány s kontrolními kopiemi přes `cmp -s`; všechny tři porovnání: exit 0.

## Kolo 7 — opravy nálezů N1–N3 (9. 11. 2026)

Pracovní adresář byl `/Users/dev_ludone/orca/workspaces/ludone-desktop/issue-179-velikost`; `HEAD` ověřený čtením worktree metadat byl `08949b1f4c66616d938b8e8eb351855ad053ccd5`. Nebyl spuštěn žádný příkaz Git, MCP, subagent ani instalace balíčků.
Příkazy testů běžely pod Node `v24.22.2`.

- **N1 — publikace:** export vytváří přes `fs.mkdtemp` skrytý `.ludone-export-*` adresář ve Stažených s právy `0700`; soubor uvnitř má `0600`. Před hardlinkem do cílového jména bez přepisu kontroluje `dev+ino` otevřeného deskriptoru proti pojmenovanému souboru. Cílový soubor, který již existuje, se ověří a nepřepisuje.
- **N2 — úklid:** odstraní jen ověřené dočasné jméno uvnitř vlastního adresáře a prázdný adresář odstraní přes `rmdir`, bez rekurze. Při nesouladu identity nebo práv úklid přeskočí a zaloguje; test s cizím obsahem ověřuje, že zůstane zachován.
- **N3 — identita:** fáze exportu se při zahájení i těsně před publikací váže na stabilní fingerprint účtu a origin. `queueOwnerFingerprint` už rozhodnutí o přímé kopii neovlivňuje. Přechod scope `mcp:read` → `nahravky:upload` stejného účtu export povolí; jiný účet i prostředí se odmítnou.

### Zbytkové riziko podle modelu hrozby

Proces pod stejným uživatelským účtem může v reálném čase vyměnit soubor uvnitř soukromého dočasného adresáře i po poslední kontrole inode. Akceptovaný test tuto situaci reprodukuje: link může zveřejnit nahrazený obsah a úklid jeho jméno ponechá, protože inode nesouhlasí. Tato obrana je mimo stanovený model hrozby; stejný proces má přímý přístup k nahrávkám v uživatelském profilu. Adresář `0700` chrání proti jiným uživatelům systému a izoluje souběžné exporty aplikace.

### Cílené testy

Doslovný příkaz a výsledek:

~~~text
$ PATH=/opt/homebrew/opt/node@24/bin:$PATH ./node_modules/.bin/vitest run tests/recording-export.test.js tests/queue-wiring.test.js tests/recordings-dashboard.test.js tests/recording-card.test.js tests/logout.test.js tests/runtime-retention-wiring.test.js tests/recording-actions.test.js --maxWorkers=2

 Test Files  7 passed (7)
      Tests  614 passed | 1 skipped (615)
exit_code: 0
~~~

Typecheck `PATH=/opt/homebrew/opt/node@24/bin:$PATH ./node_modules/.bin/tsc --noEmit -p jsconfig.json`: prázdný výstup, exit 0.

ESLint změněných JavaScriptových souborů `PATH=/opt/homebrew/opt/node@24/bin:$PATH ./node_modules/.bin/eslint electron/recording-export.cjs electron/main.cjs tests/recording-export.test.js tests/queue-wiring.test.js scripts/akceptace/export-kopie-181.mjs`: prázdný výstup, exit 0.

### Akceptační příkaz a doslovný výpis

~~~text
$ PATH=/opt/homebrew/opt/node@24/bin:$PATH node scripts/akceptace/export-kopie-181.mjs
PASS: N3: stabilní identita účtu a prostředí panelové exportní fáze — 4 testů, exit 0.
PASS: Zachovaná kontrola fronty: exportní čtení neblokuje serializované operace — 1 testů, exit 0.
PASS: N1+N2: soukromý staging, bezpečný úklid a známé zbytkové riziko — 6 testů, exit 0.
PASS: Nálezy kola 4: quit po timeoutu a poslední upravený název — 3 testů, exit 0.
PASS: Atomický export: hotový soubor, metadata shodné kopie a kolize — 4 testů, exit 0.
PASS: Přerušení: bariéry zápisu, publikace, timeout a ukončení — 6 testů, exit 0.
PASS: Varianta A: žádná automatická kopie a explicitní export zůstává dostupný — 6 testů, exit 0.
exit_code: 0
~~~

Skript pokryl 30 testů v sedmi skupinách.

### Sabotáže N1–N3

Každá sabotáž byla samostatná. Po běhu jsem zdroj obnovil kontrolní kopií a ověřil `cmp -s` s exit 0.

| Nález | Sabotáž a cílený test | Červených | Obnova |
|---|---|---:|---|
| N1 | Dočasný soubor se vrátil přímo do Stažených; test ověřující privátní staging odmítl jeho umístění. | 1 | `electron/recording-export.cjs`; `cmp -s`: exit 0 |
| N2 | `rmdir` byl nahrazen rekurzivním `rm`; test zjistil smazání cizího souboru v adresáři. | 1 | `electron/recording-export.cjs`; `cmp -s`: exit 0 |
| N3 | Do vazby exportu bylo vráceno porovnání scope-závislého fingerprintu fronty; test přechodu scope stejného účtu zčervenal. | 1 | `electron/main.cjs`; `cmp -s`: exit 0 |
