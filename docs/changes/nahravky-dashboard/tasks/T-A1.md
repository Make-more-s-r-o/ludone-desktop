# Zadání T-A1 — produkční auth pro upload

Pracuješ ve worktree {{WORKTREE}}. Na začátku spusť `pwd` a ověř, že odpovídá worktree předanému koordinátorem.

Tento packet je zpětně zapsaný přehled již provedeného auth zadání z `ZADANI-PRO-CODEX.md`. Není dokladem původního masterplan dispatchu. Task nemá přímou závislost. Commity `f9dd296`, `ccb47e7` a `c0cc32e` byly převzaty po bezpečnostním review; report je `evidence/tasks/A1.report.json` a integrační review `dukazy/nahravky-dashboard-2026-09-14/integrace/A1-review.md`.

## Mantinely

- Retrospektiva nesmí měnit runtime, auth konfiguraci, secrets ani tvrdit živý Finder login.
- **NEDĚLEJ ŽÁDNOU ZÁPISOVOU GIT OPERACI**; jediný povolený Git příkaz při případné reprodukci je závěrečný read-only self-check v postupu.
- Žádný příkaz nesmí čekat na vstup ani na `stdin`.
- **NIC NEINSTALUJ**; nespouštěj `npm install`, `npm ci` ani instalační režim jiného správce.
- **NEVYRÁBĚJ VÝJIMKU Z BRÁNY**; žádný exempt marker, skip, oslabený test ani baseline místo opravy.
- **SMÍŠ MĚNIT VÝHRADNĚ** níže uvedené soubory; jde o historický allowlist, ne nový dispatch:
  - `electron/auth.cjs`
  - `electron/auth.test.cjs`
  - `electron/main.cjs`
  - `electron/main.test.cjs`
  - `tests/auth-controller-wiring.test.js`
  - `tests/auth-identity-fallback.test.js`
  - `tests/auth-refresh.test.js`
  - `tests/queue-wiring.test.js`
  - `tests/ipc-sender-guard.test.js`
  - `docs/changes/nahravky-dashboard/evidence/tasks/A1.report.json`
  - `dukazy/nahravky-dashboard-2026-09-14/integrace/A1-testy.log`
  - `dukazy/nahravky-dashboard-2026-09-14/integrace/A1-sabotaz.log`
- Hotspoty `electron/auth.cjs` a `electron/main.cjs` vlastnil při provedení výhradně `T-A1`; dnešní vlastnictví určuje DAG.

## Převzatý výsledek

- Default produkční origin, upload scope/resource a issuer se určují uvnitř aplikace bez shellového přednastavení.
- `invalid_client` z refresh i loopback callbacku zneplatní odmítnutou klientskou relaci; nový klient vzniká až dalším výslovným přihlášením.
- OAuth error copy přijímá jen bezpečný allowlist kódů a nepropouští syrový query text.
- Review zachytilo neomezený error text a chybějící callback větev; obě vady byly opravené. Výsledek je 🧪, protože produkční Finder login neproběhl.

## Sabotáže

Jde o historický důkaz, ne o pokyn měnit přijatý kód.

### MUSÍ ZČERVENAT

1. Vyřazení allowlistu OAuth error code musí propustit nedůvěryhodný text a shodit regresní test; doslovný výstup je v `A1-sabotaz.log`.

### MUSÍ ZŮSTAT ZELENÉ

1. Produkční default, správný upload scope/resource, refresh i loopback `invalid_client` zůstávají zelené bez živého přihlášení.

## Postup při případné reprodukci — dodrž pořadí

1. Ověř převzaté commity a report; nečti tokeny ani secrets.
2. Spusť typecheck `npm run typecheck` a zachovej doslovný výstup i exit kód.
3. Spusť testy `npx vitest run tests/auth-identity-fallback.test.js tests/auth-refresh.test.js tests/auth-controller-wiring.test.js tests/queue-wiring.test.js tests/ipc-sender-guard.test.js` a zachovej doslovný výstup i exit kód.
4. Porovnej archivovanou sabotáž s obnoveným kódem.
5. Spusť `git --no-pager status --porcelain` jako jediný read-only Git self-check.

## Output contract

```json
{
  "summary": "Retrospektivní popis převzaté auth opravy.",
  "premisaPlatila": true,
  "kontrolniNula": { "novychAuthZmen": 0, "ctenychTokenu": 0, "liveLoginu": 0, "gitZapisu": 0 },
  "sabotaze": [{ "nazev": "OAuth error allowlist", "vysledek": "viz archivovaný log", "doslovnyVystup": "odkaz na nezměněný log" }],
  "doslovnyVystupTestu": "viz evidence/tasks/A1.report.json a archivované logy včetně exit kódu",
  "coJsemNEOVERIL": ["produkční přihlášení z Finderu"]
}
```

Existující report needituj ani nepřepisuj. Když retrospektivní tvrzení neodpovídá reportu nebo commitům, zapiš `premisaPlatila:false` při koordinátorově další aktualizaci stavu a doběhni. Neptej se. Realita má přednost před packetem.
