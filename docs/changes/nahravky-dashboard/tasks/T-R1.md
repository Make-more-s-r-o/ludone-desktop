# Zadání T-R1 — trvalý cooldown uploadu po HTTP 429

Pracuješ ve worktree {{WORKTREE}}. Na začátku spusť `pwd` a ověř, že odpovídá worktree předanému koordinátorem.

Plan ID je `nahravky-dashboard`, zdrojový commit aktuálního integračního plánu je `3550ef1`. Funkce: `NRD-01`. Task přímo závisí na přijatém `T-03` a musí být převzatý před `T-04`, protože sdílejí hotspoty `electron/queue.cjs` a `electron/main.cjs`.

## Mantinely

- Jen desktopová fronta s mockovaným HTTP. Žádný backend, databáze, nová historie, auth změna, UI, produkční request, ostrý účet, audio nebo UI smoke.
- **NEDĚLEJ ŽÁDNOU ZÁPISOVOU GIT OPERACI** (`add`, `commit`, `checkout`, `fetch`, `merge`, `rebase`, `stash`, `push`, `reset`, `tag`, `branch`, `cherry-pick`, `revert`, `clean`, `switch`, `restore`); jediný povolený Git příkaz je závěrečný read-only self-check uvedený v postupu.
- Žádný příkaz nesmí čekat na vstup ani na `stdin`; nastav `GIT_PAGER=cat`, `PAGER=cat` a vstup přesměruj z `/dev/null`, když je to potřeba.
- **NIC NEINSTALUJ** a nespouštěj `npm install`, `npm ci` ani jiný správce balíčků v instalačním režimu.
- **NEVYRÁBĚJ VÝJIMKU Z BRÁNY**; nepřidávej exempt marker, skip, neoslabuj ani nemaž test a nezapisuj baseline místo opravy.
- **SMÍŠ MĚNIT VÝHRADNĚ** tyto soubory:
  - `src/lib/queue.js`
  - `src/lib/queue.test.js`
  - `electron/queue.cjs`
  - `electron/queue.test.cjs`
  - `electron/main.cjs`
  - `electron/main.test.cjs`
  - `tests/queue.test.js`
  - `tests/queue-wiring.test.js`
  - `tests/upload-client.test.js`
  - `docs/changes/nahravky-dashboard/evidence/tasks/T-R1.report.json`
  - `dukazy/nahravky-dashboard-2026-09-14/TR1/typecheck.log`
  - `dukazy/nahravky-dashboard-2026-09-14/TR1/gates.log`
  - `dukazy/nahravky-dashboard-2026-09-14/TR1/sabotaz-store-cooldown.log`
  - `dukazy/nahravky-dashboard-2026-09-14/TR1/sabotaz-attempts.log`
- Hotspot `src/lib/queue.js` vlastní během dispatchu výhradně `T-R1`; měň jen výsledek 429 a zachovej ostatní klasifikace i per-track progress.
- Hotspot `electron/queue.cjs` vlastní během dispatchu výhradně `T-R1`; měň jen validaci, atomické uložení a kontrolu sdíleného cooldownu.
- Hotspot `electron/main.cjs` vlastní během dispatchu výhradně `T-R1`; předej current owner do všech existujících vstupů pumpy a retry, bez změny auth kontraktu.
- Commity, push, merge, tag a zápis stavu masterplánu dělá koordinátor po převzetí.

## Co si přečti jako první

1. `docs/changes/nahravky-dashboard/intent.md`, `spec.md` (`NRD-01`), `plan.md` a `tasks/DAG.md`.
2. Přijatý integrační kód a report T-03 — zachovej skutečné queue schema, serializaci, claim, list a dashboard kontrakty.
3. `src/lib/queue.js` a `tests/queue.test.js` — `processNext`, attempts, server progress a stávající klasifikace chyb.
4. `electron/queue.cjs` a jeho store testy — safe HMAC, atomická mutace, restart, pump a retry jsou zdroje pravdy.
5. `electron/main.cjs`, `tests/queue-wiring.test.js` a `tests/upload-client.test.js` — všechny vstupy pumpy, current owner a existující parser `Retry-After`.

## Rozhodnutí a závislosti

- HTTP 429 je jediný důvod nového outcome `rate_limited`; nespotřebuje pokus položky a vytvoří sdílený cooldown vlastníka.
- Server limituje podle user ID, ale desktop má bez dalšího serverového dotazu jen HMAC fingerprint normalizovaného e-mailu a issueru. Změna e-mailu stejného serverového uživatele proto může vytvořit nový fingerprint; toto známé omezení zapiš do reportu a nevymýšlej nový identity lookup.
- T-R1 přímo závisí na T-03 a předchází T-04 kvůli společným hotspotům. Packet neblokuje žádná otevřená Q.

## Tělo zadání

### Výsledek 429 v čisté frontě

V `processNext` rozpoznej `rate_limited` výhradně podle HTTP statusu 429, ne podle volného textu nebo serverového code. Vrať samostatný outcome `rate_limited`, obnov `attempts` na původní hodnotu, ponech položku ve stavu čekání a zachovej již uložený per-track server progress. Druhou položku ani další stopu po tomto výsledku neposílej.

Platný `Retry-After` má přednost. Když chybí nebo je neplatný, použij přesně 60 minut od předaného `now`. Síťové chyby a 5xx zůstávají retryable; 401, 403 a quota/paused důvody zůstávají paused bez spotřeby pokusu; 413, `too_large` a `invalid_input` zůstávají permanent. Neměň jejich dosavadní stavový kontrakt.

### Perzistentní cooldown vlastníka

Rozšiř existující `outgoing.json` o volitelné top-level pole `uploadCooldowns: [{ ownerFingerprint, retryAt }]`. Vše zůstává pod existující safe HMAC integritou. Validuj tvar, fingerprint i timestamp fail-closed; vadný záznam nesmí být potichu zahozen ani nahrazen prázdnou hodnotou. Expirované záznamy ukliď až uvnitř atomické store mutace, ne při read-only čtení.

Udržuj současně cooldowny více vlastníků. Logout, claim ani retry cooldown nemažou. Návrat ownera A po práci ownera B musí dál respektovat dosud platný blok A.

Store `pump` i `retry` přijmou current owner. Před každým send a před ručním resetem položky ověř odpovídající sdílený cooldown. Aktivní cooldown skončí bezpečným výsledkem bez requestu a bez mutace attempts. Když send vrátí `rate_limited`, ulož změněnou queue položku a cooldown jedním atomickým commitem; nesmí existovat mezistav, kdy je uložen jen jeden z nich.

### Zapojení main procesu

Všechny existující vstupy pumpy po restartu, loginu a dalších lifecycle událostech i ruční `queue:retry` předají store právě platný current owner stejným způsobem. Bez platného ownera nic neposílej ani neresetuj. Nepřidávej nový auth flow, IPC kanál, UI nebo timer; cooldown se vyhodnotí při existujícím vstupu.

## Akceptace

- Položka s `attempts: 4`, po ní druhá položka, a mock 429 vytvoří jediný request; první zůstane na 4, druhá na 0 a store atomicky obsahuje queue i cooldown.
- Nová store instance nad stejným skutečným dočasným `outgoing.json` po restartu nepošle během cooldownu žádný request.
- Ruční retry cooldown nesmaže ani neresetuje položku; logout/claim jej také nezruší.
- Owner A zůstává blokovaný po přepnutí na B a návratu k A; B může postupovat podle vlastního cooldownu.
- Po expiraci atomická mutace odstraní starý záznam a pump může pokračovat. Vadný nebo chybějící `Retry-After` vytvoří cooldown 60 minut.
- Částečný per-track server progress po 429 zůstane zachovaný.
- Regresní testy potvrdí původní klasifikaci network/5xx, 401/403/quota a 413/`too_large`/`invalid_input`.
- Main wiring test pokryje restart, login a ruční retry se stejným current-owner guardem.
- Všechny HTTP testy používají mock; nevznikne produkční request ani živé ověření.

## Sabotáže — spusť je, vypiš doslovný výstup

### MUSÍ ZČERVENAT

1. Dočasně vyřaď kontrolu store cooldownu před send; restartovací test musí provést zakázaný request a selhat. Obnov kód.
2. Dočasně ponech po 429 zvýšené `attempts`; regresní test s původní hodnotou 4 musí selhat. Obnov kód.

### MUSÍ ZŮSTAT ZELENÉ

1. Po obnovení obou ochran musí restart, dva vlastníci, expiry a ruční retry zůstat zelené bez předčasného requestu.
2. Network/5xx, paused a permanent klasifikace i zachování částečného per-track progress musí zůstat zelené.

## Postup — dodrž pořadí

1. Ověř integrační HEAD, queue schema a všechny aktuální vstupy pumpy. Napiš mockované a restartovací případy s očekávaným RED a potom nejmenší implementaci uvnitř allowlistu.
2. Spusť typecheck příkazem `npm run typecheck > dukazy/nahravky-dashboard-2026-09-14/TR1/typecheck.log 2>&1`; zachovej doslovný výstup a exit kód.
3. Spusť testy příkazem `npm run gates > dukazy/nahravky-dashboard-2026-09-14/TR1/gates.log 2>&1`; zachovej doslovný výstup a exit kód.
4. Proveď obě sabotáže, ulož doslovné výstupy do určených logů a obnov legitimní kód.
5. Spusť `git --no-pager status --porcelain` jako jediný povolený Git self-check a ověř nulový zásah mimo allowlist.
6. Teprve potom zapiš report a odpověz koordinátorovi přesně podle output contractu.

## Output contract

```json
{
  "summary": "Co vzniklo a jak je 429 trvale blokovaný pro vlastníka.",
  "premisaPlatila": true,
  "premisaPoznamka": "Skutečné queue schema, owner fingerprint a případné odchylky od packetu.",
  "znameOmezeniIdentity": "Server limituje podle user ID; desktopový cooldown je svázán s HMAC e-mailu a issueru a změna e-mailu může vytvořit nový fingerprint.",
  "ocekavanePocty": {
    "requestuPoPrvnim429VeStejnePumpe": 0,
    "requestuBehemCooldownuPoRestartu": 0,
    "prirustekAttemptsPo429": 0,
    "produkcnichRequestu": 0
  },
  "kontrolniNula": {
    "souboruMimoAllowlist": 0,
    "novychDatabaziHistoriiAuthUI": 0,
    "pridanychExemptMarkeruSkipuBaseline": 0,
    "gitZapisu": 0
  },
  "namereneKlasifikace": {},
  "novychTestu": 0,
  "sabotaze": [
    {
      "nazev": "Název provedené sabotáže.",
      "ocekavano": "Která ochrana měla zčervenat nebo zůstat zelená.",
      "vysledek": "Naměřený výsledek a exit kód.",
      "doslovnyVystup": "Doslovný výstup příkazu sabotáže."
    }
  ],
  "doslovnyVystupTestu": "Doslovný výstup typechecku a testovací brány včetně exit kódů.",
  "coJsemNEOVERIL": [],
  "notes": []
}
```

Stejný objekt ulož do `docs/changes/nahravky-dashboard/evidence/tasks/T-R1.report.json`. Když kritérium neplatí, zapiš `premisaPlatila:false` s naměřenou hodnotou a doběhni. Neptej se. Realita má přednost před packetem.
