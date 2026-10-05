# Nezávislé review autentizované F E2E a migrace fronty

5. 10. 2026. Read-only kontrola integračního stromu s HEAD `a60ed8867e10850df932f444cf26f25d728f496a` a tehdy necommitnutých změn. Reviewer nepsal do integrace; tento záznam vznikl ve vlastní větvi `fix/osa-authority-tests`.

## Rozsah a identita kontrolovaných zdrojů

```text
0f57c50719a328ad3e6b3799ab3b09d68e450b051962f0430bb06f193c704fa2  scripts/osa-auth-e2e-bootstrap.cjs
85a0a35c77d7f53fb552b88da3e304a7490928a5f07875659ac36f2cd8d08791  scripts/osa-auth-fixture-guard.cjs
acc743ea1366beba499e61289783bb9b94a0755f2c3c866103fd2ca1953fa67a  scripts/osa-auth-e2e.mjs
2c97e2e443a17f230f2b2c99ed82058c1d2f9aea96d7fe450cb30516d1848c7c  tests/queue-wiring.test.js
```

## Závěr bezpečnostní kontroly

V prohlédnutém bootstrapu a fixture guardu nebyl nalezen konkrétní P1/P2 bezpečnostní problém.

- Guard vyžaduje přesně `isPackaged === false`, všechny tři testové flagy, absolutní canonical `isolated-data` pod novým temp adresářem s určeným prefixem a přesný veřejný marker. Běžný profil, relativní cesta a symlink nesplní podmínky.
- Bootstrap používá pouze veřejnou fiktivní identitu. Náhradní safeStorage odmítne cizí blob; nevolá skutečný Keychain. AppData i userData patří izolovanému profilu. Produkční main ani publikovaný entrypoint fixture nenahrávají, fixture soubory žijí v `scripts/` mimo balení.
- Kompilační hook má přesnou cestu main, obnoví původní `_compile` před kompilací a přidává pouze registraci `auth:identity` přes stejný validační wrapper a skutečný privátní `readStoredAuthIdentity`. Žádný volný setter identity, vlastníka ani serverového stavu neexistuje. Audit i runner vyžadují právě jeden hook.
- Global fetch a net.fetch přijímají jen GET na výslovně povolený issuer a company/verification routy. Neznámý transport se odmítne; offline zůstává až za routovým whitelistem. File fetch kontroluje realpath uvnitř dist. Net.request a externí shell.openExternal jsou blokované; rendererové vzdálené requests blokuje defaultSession před spuštěním main startupu.
- Upload vypíná env killswitch; audit nepřipustí žádný nepovolený požadavek ani metodu odlišnou od GET. Serverová ID a odpovědi jsou explicitně seedované syntetické fixture, nikoli důkaz produkčního uploadu či dostupnosti serveru. Skutečný verifier zpracuje normální Response a vlastní kontroly.
- Veřejný soubor dialogové volby přijme jen doslovné `0`, `1`, `2`; nemůže obsahovat kód nebo cestu. Dialog adapter je omezen na dva konkrétní titulky.

## Pravdivost UI scénářů

Runner provádí skutečné pointer kliknutí s kontrolou hit-testu, dosažitelnosti a disabled stavu. Změnu přístupu volí skutečnou klávesnicovou interakcí selectu. Nepřepisuje renderovaný stav ověření ani metadata formuláře.

Claim kontroluje aktuální ownership a held uploadIntent přes skutečný main store. Save/Discard/Stay používají skutečný detail-close guard, původní IPC a configure CAS: Stay ponechá detail i původní přístup, Discard zavře bez změny přístupu, Save zavře až po zápisu private při stále held intent. Syntetický native dialog není fyzická přejímka macOS dialogu.

Doporučení pro přesnější důkaz: v complete scénáři doplnit přesné assertion `audit.dialogChoices` proti `[2, 1, 0]`. Runner již tuto informaci zaznamenává; explicitní kontrola přímo doloží všechny tři zamýšlené větve. Současné koncové UI/store kontroly zůstávají platné.

## Jeden nález v rovnocenné migraci testů

**P2 — `tests/queue-wiring.test.js:1138`: ztráta přesného počtu událostí při přepnutí nastavení.** Původní `toHaveBeenCalledExactlyOnceWith` se změnil na `toHaveBeenCalledWith` pro panel. To propustí duplicitní `settings:select-tab` událost. F správně mění cílové okno, ale počítadlo událostí je původní funkční podmínka.

Navržená oprava: před druhým otevřením zaznamenat počet panel.send volání a následně ověřit právě jednu novou událost a `toHaveBeenLastCalledWith("settings:select-tab", "account")`; alternativně přesně jednou filtrovat tuto konkrétní událost. Rootovi byl nález předán, tento záznam jeho pozdější opravu nepředjímá.

Zbytek prohlédnuté migrace má odpovídající ekvivalenci: panelové negativní testy nyní používají skutečně cizí BrowserWindow se stejnou důvěryhodnou URL/mainFrame, takže neztrácejí kontrolu vlastnictví. Cizí iframe, payload, auth generation, CAS a owner assertions zůstávají. Held draft neukazuje souhlas s odesláním; approved fixture zachovává původní čekající scénář. Layout a runtime masky odpovídají F, původní golden PNG se nemění. Diff neodstraňuje testové bloky.

## Nezávislé ověření

🧪 Guard + queue-wiring aktuálního integračního zdroje: **300 PASS, 0 FAIL, 0 skip** (7 guard + 293 queue-wiring). Tento reviewer nespouštěl autentizovaný Electron E2E ani fyzický zvuk. Zelené service testy nejsou důkazem produkčního serveru.

Doslovný příkaz:

```sh
/Users/dev_ludone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run tests/osa-auth-fixture-guard.test.js tests/queue-wiring.test.js
```

Doslovný výpis:

```text
 RUN  v4.1.11 /Users/dev_ludone/Dev/ludone-desktop/.claude/worktrees/desktop-osa

 Test Files  2 passed (2)
      Tests  300 passed (300)
   Start at  16:45:59
   Duration  7.58s (transform 321ms, setup 39ms, import 694ms, tests 6.82s, environment 0ms)

exit code: 0
```

## Finalni doplneni 5. 10. 2026

Read-only review bf94447 a navazujiciho diffu: puvodni P2 exact-once je opraven. Zadne dalsi konkretni P1/P2. Bari era finalizace je omezena presnym importem main, izolovanym markerem a 30 sekundami; pote vola skutecnou createLivePendingDelivery s puvodnimi argumenty. Nevytvari nahradni vysledek. Audit zustava v izolovanem profilu, rozhodnuti dialogu ma striktni poradi [2,1,0].

Select pres DOM setter a change event je automatizovany renderer vstup, nikoli fyzicke ovladani macOS popupu. Tlacitka pouzivaji ukazatel. Kontrola dvou viditelnych akci ve stejne rade odpovida kompozici; save/skip handlery zustaly zachovany. Fixture neni skutecne overeni serveru ani fyzickeho zvuku.

Dve typove opravy explicitne zuzuji existenci queueWaitingCount; tooltip assertions a pripady se nezmenily.

Doslovne overeni izolovaneho stromu, Node 24.19.0:
```text
node node_modules/typescript/bin/tsc --noEmit -p jsconfig.json
EXIT_CODE=0
node node_modules/vitest/vitest.mjs run tests/tray-authority.test.js tests/ipc-sender-guard.test.js tests/diagnostics.test.js
Test Files 3 passed (3)
Tests 131 passed (131)
Duration 333ms
EXIT_CODE=0
```
Fyzicka pre jimka Macu nebyla provedena.

### Závěrečné doplnění auditu transportu

Připomínka nezávislého review k pořadí čtení auditu po restartu byla zapracovaná: předchozí audit se načítá až po potvrzeném ukončení procesu. Zápis je synchronní a atomický při každé transportní události. Finální E2E ověřuje všechny procesy, jediný projekční hook na proces a pouze povolené GET; žádný upload. Produkční auth/IPC/queue tímto testovacím adaptérem nejsou nahrazené.
