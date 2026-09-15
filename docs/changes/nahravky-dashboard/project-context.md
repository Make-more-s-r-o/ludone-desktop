# Kontext projektu — nahravky-dashboard

Verze výřezu: 14. 9. 2026. Jde o zpětně doplněný kontext již autorizovaného běhu, ne o nové rozšíření rozsahu.

## Repozitář a pracovní prostor

- Konkrétní packet určuje vlastnictví souborů; každý zapisovatel používá vlastní worktree a cizí změny neuklízí (`AGENTS.md:3-4`, `AGENTS.md:18-24`).
- Dokumentace a komentáře jsou česky, commit messages anglicky (`AGENTS.md:6-10`).

## Produkt a uživatelé

- Uživatel má v existujícím desktopu získat pravdivou cestu od nahrání přes volbu odeslání po lokální a výslovně ověřený serverový stav (`docs/changes/nahravky-dashboard/spec.md:7-11`, `docs/changes/nahravky-dashboard/spec.md:62-66`).
- Archiv, hledání, redesign, backend a LuTrack jsou mimo běh; automatika nesmí zpětně odeslat staré položky (`docs/changes/nahravky-dashboard/spec.md:13-18`).

## Technologie

- Aplikace je Electron s hlavním vstupem `electron/main.cjs`, ESM projektem a React rendererem (`package.json:7-8`, `package.json:82-97`).
- macOS build používá hardened runtime, notarizaci, DMG i ZIP pro arm64 a x64 a generic update feed (`package.json:23-60`).

## Příkazy a brány

- `npm run gates` spouští lint, typecheck, unit testy a kontrolu přeskočených testů (`package.json:72-80`).
- `npm run gates:clean` ověřuje stejný výsledek nad čistým checkoutem; audio smoke je samostatný lidský krok (`package.json:71-80`, `AGENTS.md:31-36`).

## Architektonické invarianty

- Hlavní proces vlastní trvalý stav a citlivou identitu; renderer nesmí dostat cestu, token ani owner fingerprint a nový IPC kanál musí ověřit odesílatele (`docs/changes/nahravky-dashboard/spec.md:56-73`).
- Queue mutace jsou serializované, akce nad položkou ověřují čerstvé ID/revize a 429 zastavuje společnou pumpu bez spotřeby pokusu (`docs/changes/nahravky-dashboard/spec.md:75-81`).

## Doménová pravidla

- Lokální existence, queue stav a serverové ověření jsou nezávislé; obě zvukové stopy mají samostatný výsledek (`docs/changes/nahravky-dashboard/spec.md:58-66`).
- Consent nové nahrávky je per item, volba „Nechat na Macu“ přežije restart a automatika platí jen pro pozdější nahrávky (`docs/changes/nahravky-dashboard/spec.md:123-135`).

## Bezpečnost a hranice schvalování

- Tajemství a `.p12` nesmějí do repozitáře; podpisový klíč se nesmí použít před ověřenou zálohou ve firemním správci hesel (`AGENTS.md:47-54`).
- Dan schválil implementační běh, odložil redesign a ponechal si release tag i živou přejímku; chybějící hookový design approval se zpětně nevyrábí (`docs/changes/nahravky-dashboard/decisions.md:9-14`, `docs/changes/nahravky-dashboard/plan.md:9-15`).

## Zdroje

1. **Danův schválený záměr a rozhodnutí D1–D13** — produktový rozsah, autonomie a lidské stopky (`docs/changes/nahravky-dashboard/intent.md:1-18`, `docs/changes/nahravky-dashboard/decisions.md:1-19`).
2. **AGENTS.md** — repo pravidla, důkazy, bezpečnost a práce ve worktrees (`AGENTS.md:1-69`).
3. **Specifikace a plán běhu** — chování, pořadí a akceptace (`docs/changes/nahravky-dashboard/spec.md:1-180`, `docs/changes/nahravky-dashboard/plan.md:26-84`).
4. **Zdrojový kód a package.json** — aktuální technický kontrakt a brány (`package.json:1-99`, `electron/main.cjs:303-314`).

Rozpor řeší `decisions.md`. Chybějící `artifacts/design/approved.json` je procesní mezera popsaná v design manifestu; není to nové produktové Q ani důvod zpětně vyrábět schválení.
