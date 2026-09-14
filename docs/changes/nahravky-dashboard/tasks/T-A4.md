# Zadání T-A4 — výběr firmy v aplikaci a trvalá firma uploadu

Pracuješ ve worktree {{WORKTREE}}. Na začátku spusť `pwd` a ověř přidělený strom.

Plan ID `nahravky-dashboard`; feature `NRD-07`, návaznost `NRD-01/NRD-06`. Závislosti **T-05 a T-A3 musí být přijaté před dispatchem**. T-A3 je `0340c8e`; přesný integrační commit po T5 dodá root při dispatchi. Tento packet nepovoluje žádnou souběžnou změnu T5 hotspotů.

## Mantinely

- Pouze desktop, mock HTTP a dočasná data. Žádný backend, LuTrack, design/, produkční účet, živá síť, GUI ani audio smoke.
- **NEDĚLEJ ŽÁDNOU ZÁPISOVOU GIT OPERACI** (`add`, `commit`, `checkout`, `fetch`, `merge`, `rebase`, `stash`, `push`, `reset`, `tag`, `branch`, `cherry-pick`, `revert`, `clean`, `switch`, `restore`). Jediný povolený Git příkaz je závěrečný read-only self-check v postupu.
- Žádný příkaz nesmí čekat na vstup ani `stdin`; použij `GIT_PAGER=cat`, `PAGER=cat` a vstup z `/dev/null`, je-li třeba.
- **NIC NEINSTALUJ** (`npm install`, `npm ci` ani jiný instalační režim).
- **NEVYRÁBĚJ VÝJIMKU Z BRÁNY**: žádný exempt marker, nový skip ani baseline. Existující testy neoslabuj; změnu fixture vynucenou novým kontraktem výslovně vysvětli v reportu.
- **SMÍŠ MĚNIT VÝHRADNĚ** následující soubory:
  - `electron/main.cjs`
  - `electron/main.test.cjs`
  - `electron/preload.cjs`
  - `electron/preload.test.cjs`
  - `electron/companies.cjs`
  - `electron/companies.test.cjs`
  - `electron/queue.cjs`
  - `electron/queue.test.cjs`
  - `electron/upload-client.cjs`
  - `electron/upload-client.test.cjs`
  - `src/lib/queue.js`
  - `src/lib/queue.test.js`
  - `src/lib/upload-company-resolution.js`
  - `src/lib/upload-company-resolution.test.js`
  - `src/components/Settings.jsx`
  - `src/components/Settings.test.jsx`
  - `tests/queue-wiring.test.js`
  - `tests/queue.test.js`
  - `tests/upload-client.test.js`
  - `tests/ipc-sender-guard.test.js`
  - `tests/logout.test.js`
  - `tests/settings.test.js`
  - `tests/zjisteni-firmy.test.js`
  - `tests/firma-pro-odeslani.test.js`
  - `tests/upload-company-wiring.test.js`
  - `tests/upload-company-binding.test.js`
  - `docs/changes/nahravky-dashboard/evidence/tasks/T-A4.report.json`
  - `dukazy/nahravky-dashboard-2026-09-14/A4/typecheck.log`
  - `dukazy/nahravky-dashboard-2026-09-14/A4/gates.log`
  - `dukazy/nahravky-dashboard-2026-09-14/A4/sabotaz-pin.log`
  - `dukazy/nahravky-dashboard-2026-09-14/A4/sabotaz-sender.log`
- Hotspoty `electron/main.cjs`, `electron/preload.cjs`, `electron/queue.cjs`, `electron/upload-client.cjs`, `src/lib/queue.js` a `src/components/Settings.jsx` přebírá výhradně T-A4 až po T5. Měň pouze volbu firmy, související upload context/progress a úzkou retry ochranu.
- Hotspoty `electron/companies.cjs` a `src/lib/upload-company-resolution.js` vlastní T-A4 pouze pro zachování/validaci skutečné nabídky a bezpečný kontext firmy. Auth, A3 controller a selector jsou již přijaté a read-only.
- Git, masterplan a širší integrační dokumenty vlastní root.

## Co si přečti jako první

1. AGENTS.md, D15/D16, NRD-07 a aktuální T5 report.
2. T-A3 report, controller `electron/upload-company-selection.cjs`, komponentu `UploadCompanySelector.jsx`, `updateStoredAuthSessionCompany` v auth.cjs.
3. Skutečný main auth lifecycle, settings-only sender guard, T4 current-context guard, T5 per-item akce a scheduler.
4. `fetchCompanies`, `resolveCompanyForUpload`, `normalizedContext`, `sendRecording`, `uploadTrack`, `applyServerProgress` a obě normalizace queue server metadat. Nepiš nový HTTP/auth framework.

## Tělo zadání

### Skutečné Nastavení a IPC

Zapoj existující `UploadCompanySelector({authState})` do části Účet v Settings. Preload poskytne přesně `listUploadCompanies()` a `selectUploadCompany(offerToken, companyId)`. Nové kanály přijímají pouze existující hlavní frame důvěryhodného okna Nastavení, přesný počet a tvar argumentů; žádný rendererem dodaný origin, token, requester nebo cesta.

Main vytvoří controller T-A3 s reálnými závislostmi. `readContext` musí vrátit platnou upload relaci, uložený snapshot, issuer/resource/scope, owner a generaci, bez přechodu účtu. `isContextCurrent` znovu čte session a ověřuje stejný token/owner/issuer/generaci. Commit adapter použije `updateStoredAuthSessionCompany` se synchronním guardem senderu a generace uvnitř token-storage transakce a vrátí true jen při skutečném zápisu. Guard nesmí reentrantně čekat na token-storage zámek. Po login/logout/origin změně invaliduj také nabídky firmy; opuštěné okno nesmí dokončit zápis. Renderer dostává jen bezpečnou nabídku a výsledek, žádné tokeny, fingerprints nebo raw chyby.

Síťový adapter používá stávající `fetchCompanies` a předaný AbortSignal. Oprav konkrétní ztrátu informace: vadné `companies` se dnes normalizuje na `[]` a neplatný default na null. Skutečná vadná 200 odpověď musí být chyba i přes produkční adapter. Zachovej validní nabídku zero/one/many i původní automatickou volbu jediné firmy. Žádný výběr první položky při více firmách.

Volba firmy **neschvaluje žádnou nahrávku, nevolá pumpu ani hromadné retry**. Její účinek je uložená volba pro budoucí explicitní odeslání. Nabídka se načítá jen klikem komponenty, ne při mountu Nastavení.

### Trvalá firma před prvním INIT

Aktuální `uploadTrack` při každém pokusu znovu provádí idempotentní INIT; nestačí předpokládat, že uložené recordingId samo zabrání jiné firmě druhé stopy. Přidej jediné interní pole `item.server.companyTabidooId`. Zachovej jej v obou normalizacích a při každém per-track progress/failure/commit. Nevystavuj ho jako náhradu owner fingerprintu.

Před prvním POST INIT ulož validní GUID přes awaitovaný existující `reportServerProgress` a jeho skutečný durable store commit. Úzký pre-init progress event může mít `{companyTabidooId}`; jiné neplatné kombinace odmítni. Chyba persist znamená **nula HTTP**. Následující INIT všech stop používá tento pin, také po restartu a změně globální volby; automatický retry nikdy nepřepíše pin. Zachovej session a známá ID, stávající hash/size/idempotency ochrany a title z T5.

Legacy položka s jakýmkoli serverovým sessionId, track/legacy recordingId nebo nenulovým server progress a bez známé firmy musí skončit jasnou lokální blokací před HTTP. Dnešní globální firma není důkaz původní firmy. U skutečně nové položky bez serverového stavu se pin vytvoří z platného současného kontextu. V UI přidej bezpečný srozumitelný důvod přes existující projekci, bez nového archivu.

### Odmítnutá firma a ruční opakování

`company_out_of_scope` zůstává explicitní lidsky řešitelnou chybou, nikoli obecnou automatickou retry smyčkou. Po této odpovědi podmíněně vyčisti globální volbu pouze přes A3 CAS: stále stejná relace a přesně odmítnuté `expectedCompanyId`. Opožděná chyba nesmí smazat novou volbu ani cizí účet. Žádný raw token do chyby/logu; serverový stav položky se tím nemění.

Per-item ruční retry po nové volbě může odemknout odmítnutou nahrávku pouze při **nulových serverových ID/session/progress**, nebo když vybraná firma souhlasí s již uloženým pinem. Rebind zero-ID položky po `company_out_of_scope` smí provést pouze explicitní T5 akce uvnitř její serializace, kontroly revizí, aktuálního vlastníka a auth guardu; samotné uložení firmy ani pumpa to nedělají. Jakékoli initialized metadata bez pinu nebo s odlišnou zvolenou firmou v této opravné cestě zůstane bez změn a HTTP. V běžném automatickém pokračování již povoleného uploadu se použije původní pin.

Převzetí vlastníka z T2 zachovává již schválený kontrakt: výslovně potvrzený claim resetuje celý serverový stav, tedy i nový pin, a drží položku bez consentu. Tento task zákazem initialized claimu nepřepisuje přijaté produktové rozhodnutí. Běžná změna firmy není claim a reset serverových ID jí není povolen.

## Akceptace

- Skutečný preload/IPC + Settings klik načíst → vybrat → uložit zapíše GUID stejné relace bez shellu; mount, cizí/subframe sender, forged/extra args a změna účtu způsobí nula nepovolených fetch/zápisů. Souběžný logout nezablokuj na nabídce.
- Validní zero/one/many a vadná skutečná 200 nabídka se rozlišují přes produkční fetch adapter; request používá pouze trusted origin, Bearer, redirect error a AbortSignal.
- Pin je na disku před INIT; chyba jeho persist znamená nula requestů. Přerušení po mic INIT + restart + nová globální firma zachová původní firmu a session obou stop.
- Initialized legacy bez pinu se nepokusí o INIT. Explicitní oprava odmítnuté zero-ID položky po nové volbě může pin změnit, initialized položka nemění ID ani firmu. Samotný select žádnou položku neschválí/neodešle.
- Pozdní 403 nesmaže novou firmu ani jinou relaci. Přesný starý odmítnutý výběr se podmíněně vyčistí; uživatel dostane odkaz na Nastavení přes existující vysvětlení.
- Existující 429, consent, ownership, save/delete, auth a upload testy zůstanou; žádná síť naostro nebo oslabená brána.

## Sabotáže — spusť je, vypiš doslovný výstup

### MUSÍ ZČERVENAT

1. Dočasně vyřaď await persist pinu před INIT; regresní test pořadí a nulové HTTP při selhání persist musí zčervenat. Obnov kód.
2. Dočasně vyřaď settings-only sender guard nového select kanálu; test cizího okna musí zčervenat. Obnov kód.

### MUSÍ ZŮSTAT ZELENÉ

Po obnovení platná explicitní volba, normální dual upload s původní firmou, CAS reset a zero-ID ruční retry zůstanou zelené; held položky se nerozešlou.

## Postup — dodrž pořadí

1. Ověř premisu ve skutečném integrovaném kódu a napiš cílené RED regrese; implementuj pouze allowlist.
2. Spusť `npm run typecheck`, ulož celý výpis a exit kód do A4/typecheck.log.
3. Spusť testy příkazem `npm run gates`, celý výpis a exit kód ulož do A4/gates.log. Po konkrétní opravě appendni cílené ověření; nic nezahazuj.
4. Proveď obě reálné sabotáže, ulož úplné výpisy/exit kódy, obnov kód a ověř opravu cílenými testy.
5. Jediný závěrečný Git self-check: `git --no-pager status --porcelain`; ověř nulový zápis mimo allowlist.
6. Ulož report a předej rootovi skutečné výsledky, ne parafrázi příkazů.

## Output contract

```json
{
  "summary":"Skutečný výsledek a zbývající hranice.",
  "premisaPlatila":true,
  "premisaPoznamka":"Skutečné server/client kontrakty a odchylky.",
  "ocekavanePocty":{"httpPriSelhaniPersist":0,"zmenInicializovaneFirmy":0,"uploaduPriVolbeFirmy":0,"produkcnichRequestu":0},
  "kontrolniNula":{"souboruMimoAllowlist":0,"zmenBackendLuTrackDesign":0,"novychSkipuBaseline":0,"gitZapisu":0},
  "zmenyExistujicichTestu":[],
  "sabotaze":[{"nazev":"","ocekavano":"","vysledek":"","doslovnyVystup":"Úplný výpis včetně exit kódu."}],
  "doslovnyVystupTestu":"Úplné doslovné výstupy včetně exit kódů.",
  "coJsemNEOVERIL":["Produkční přihlášení/upload, GUI, zvuk, instalaci a aktualizaci."],
  "notes":[]
}
```

Stejný objekt ulož do evidence/tasks/T-A4.report.json. Nepravdivou premisu popiš, nic nevymýšlej; pokračuj nejmenší bezpečnou cestou v rozsahu a předej konkrétní blocker rootovi.
