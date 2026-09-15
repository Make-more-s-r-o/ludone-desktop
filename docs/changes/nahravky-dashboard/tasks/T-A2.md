# Zadání T-A2 — identita uploadu výhradně z userinfo

Pracuješ ve worktree {{WORKTREE}}. Na začátku spusť `pwd` a ověř cestu přidělenou koordinátorem.

Plan ID: `nahravky-dashboard`, funkce `NRD-07`, přímá závislost na přijatém T-A1. Jde o konkrétní nález nezávislého review nad `0109d0e..bf4aa92`, nikoli nové produktové rozhodnutí. Nečeká na žádnou otevřenou Q. Integrační základ určí koordinátor při dispatchi.

## Mantinely

- Jen desktopová auth oprava, mockované HTTP a syntetické identity. Žádný backend, LuTrack, design, produkční síť, tajemství, podpis nebo živý login.
- **NEDĚLEJ ŽÁDNOU ZÁPISOVOU GIT OPERACI**; jediný povolený Git příkaz je závěrečný read-only self-check v postupu.
- Žádný příkaz nesmí čekat na vstup ani na `stdin`.
- **NIC NEINSTALUJ**; dependencies připravil koordinátor.
- **NEVYRÁBĚJ VÝJIMKU Z BRÁNY**; nepřidávej exempt marker, skip, změnu timeoutu, oslabení testu ani baseline místo opravy.
- **SMÍŠ MĚNIT VÝHRADNĚ**:
  - `electron/auth.cjs`
  - `electron/auth.test.cjs`
  - `tests/auth-identity-fallback.test.js`
  - `tests/auth-controller-wiring.test.js`
  - `tests/auth-refresh.test.js`
  - `docs/changes/nahravky-dashboard/evidence/tasks/T-A2.report.json`
  - `dukazy/nahravky-dashboard-2026-09-14/A2/testy.log`
  - `dukazy/nahravky-dashboard-2026-09-14/A2/sabotaz.log`
- Hotspot `electron/auth.cjs` vlastní výhradně T-A2; main, queue a ostatní runtime soubory jsou read-only. T-R1 může souběžně měnit svůj samostatný worktree bez tohoto souboru.
- Status, commity, integraci a push provádí koordinátor. `ui-smoke` ani `audio-smoke` nespouštěj.

## Co si přečti jako první

1. AGENTS.md, ROZHODNUTI.md, PLAN.md, DAN-TODO.md, intent, spec NRD-07, rozhodnutí D1/D5/D10 a tasks/DAG.md.
2. `electron/auth.cjs` — `resolveUserIdentity`, scope kontrakt v controlleru a oddělený refresh uložené relace.
3. Existující auth identity/controller/refresh testy a převzatý report T-A1. Zachovej loopback, invalid_client, issuer/resource a sanitizaci chyb.

## Nález a požadovaná oprava

`resolveUserIdentity` začíná identitou z token response a doplňuje ji přes nakonfigurovaný userinfo endpoint. Pokud endpoint selže nebo vrátí jen část, zůstane email/name z token response. Upload potom může použít tuto neověřenou identitu pro vlastnictví místo bezpečného pozastavení.

V explicitně nakonfigurované identitní cestě začni prázdnou identitou a přijmi pouze výsledek tohoto resolveru. Chyba, deadline nebo chybějící pole nesmějí doplnit email/name z token response ani spustit MCP fallback. Platný token může být uložen s neznámou identitou; jde o existující best-effort kontrakt, nikoli vymyšlené vlastnictví. Nenaruš legacy větev bez explicitního resolveru ani důvěryhodnou identitu zachovanou při refreshi dříve uložené relace.

## Akceptace

- Mock token response obsahuje syntetické email/name a userinfo vrátí 503: controller i uložená relace mají oba identity údaje null, žádný MCP request.
- Částečný userinfo výsledek má jen jedno pole: druhé se nedoplní sentinel hodnotou z tokenu.
- Deadline/chyba resolveru zachová neznámou identitu; úspěšný userinfo dodá pravou syntetickou identitu.
- Legacy bez explicitního resolveru dál používá původní token/MCP identitu a refresh zachová dříve ověřenou uloženou identitu.
- Ověř skutečný controller → uloženou session, ne jen izolovanou normalizační funkci. Testy nesmějí vytisknout tokeny.

## Sabotáže

### MUSÍ ZČERVENAT

1. Dočasně obnov počáteční identitu z token response v explicitní větvi. Regrese userinfo 503 musí selhat na nečekané tokenové identitě. Ulož doslovný výstup a obnov opravu.

### MUSÍ ZŮSTAT ZELENÉ

1. Po obnovení opravy projdou userinfo failure/partial/deadline, úspěch, legacy i refresh. Žádný skutečný request.

## Postup — dodrž pořadí

1. Ověř předpoklad a přidej regresní test nad skutečným controllerem s očekávaným RED, potom nejmenší opravu uvnitř allowlistu.
2. Proveď obě poloviny sabotáže, ulož doslovný výstup do `A2/sabotaz.log` a obnov legitimní kód. Dále opakuj jen dotčené testy při nálezu; plnou integrační bránu spustí root.
3. Spusť typecheck `npm run typecheck`; ulož doslovný výstup a exit kód do `A2/testy.log`.
4. Spusť testy `npx vitest run tests/auth-identity-fallback.test.js tests/auth-controller-wiring.test.js tests/auth-refresh.test.js`; připoj doslovný výstup a exit kód do `A2/testy.log`.
5. Spusť `git --no-pager status --porcelain` jako jediný povolený Git self-check.

Potom zapiš report a předej koordinátorovi. Když premisa neplatí, zapiš `premisaPlatila:false` a naměřenou realitu; neptej se a doběhni nezávislou práci.

## Output contract

```json
{
  "summary": "Konkrétní oprava userinfo fallbacku.",
  "premisaPlatila": true,
  "premisaPoznamka": "Změřená chyba a zachovaný refresh kontrakt.",
  "kontrolniNula": { "souboruMimoAllowlist": 0, "produkcnichRequestu": 0, "pridanychSkipuBaseline": 0, "gitZapisu": 0 },
  "sabotaze": [{ "nazev": "tokenová identita při userinfo failure", "vysledek": "RED a obnovený GREEN včetně exit kódů", "doslovnyVystup": "Výstup nebo přesná cesta k archivovanému doslovnému logu." }],
  "doslovnyVystupTestu": "Výstup nebo přesná cesta k doslovnému logu včetně exit kódů.",
  "coJsemNEOVERIL": ["produkční přihlášení z Finderu"]
}
```

Stejný objekt ulož do `docs/changes/nahravky-dashboard/evidence/tasks/T-A2.report.json`.
