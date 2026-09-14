# Zadání T-I1 — pravdivé popisky stavu a korelace položky

Pracuješ ve worktree {{WORKTREE}}. Ověř `pwd`. Plan ID `nahravky-dashboard`,
funkce NRD-03 a NRD-06, závislost T-05 již přijatá. Základ dodá koordinátor.
Jde o konkrétní integrační nález, nikoli redesign nebo nové produktové rozhodnutí.

## Mantinely

Čti AGENTS.md, ROZHODNUTI.md, PLAN.md, DAN-TODO.md, spec NRD-03/NRD-06 a DAG.
**NEDĚLEJ ŽÁDNOU ZÁPISOVOU GIT OPERACI**; jediný povolený Git příkaz je závěrečný read-only self-check.
Žádný příkaz nesmí čekat na vstup ani na `stdin`. **NIC NEINSTALUJ**.
Žádná produkční síť, GUI, audio, podpis ani další agent. Backend, LuTrack a design/ jsou zakázané.
**NEVYRÁBĚJ VÝJIMKU Z BRÁNY**: žádný exempt marker, nový skip ani baseline.
Existující testy a aserce neoslabuj.

- **SMÍŠ MĚNIT VÝHRADNĚ** následující soubory:
  - `src/features/recordings/RecordingsDashboard.jsx`
  - `src/features/recordings/RecordingsDashboard.test.jsx`
  - `tests/recordings-status.test.js`
  - `docs/changes/nahravky-dashboard/evidence/tasks/T-I1.report.json`
  - `dukazy/nahravky-dashboard-2026-09-14/I1/testy.log`
  - `dukazy/nahravky-dashboard-2026-09-14/I1/sabotaz.log`

T-A4 souběžně vlastní main, queue, bezpečnou projekci, Settings a
`tests/recordings-dashboard.test.js`; těch se nedotýkej. Existující testy si přečti.

## Konkrétní oprava

Karta zatím pro každý queue item píše „Ve frontě“ a bez důvodu „Nahrávka čeká ve frontě“,
i pro `odeslano`. Zobraz pevné srozumitelné texty podle skutečného `state` a consentu:
odesílání, odesláno podle fronty, čekající schválené, lokálně ponechané, selhání a neznámý
stav. Odesláno podle fronty nikdy nevydávej za skutečnou serverovou shodu; ta dál vzniká
jen existujícím ručním ověřením. Konkrétní lokální/chybový důvod se nesmí ztratit.
Nevymýšlej procenta ani datum posledního serverového ověření.

V existujícím facts bloku zobraz bezpečný prefix `ID: ` a prvních osm znaků již
validovaného clientRecordingId. Stejný prefix používá native dialog. Zobraz také datum,
pokud hlavičku tvoří vlastní název. Bez změny CSS/layoutu, nové obrazovky nebo IPC.

## Akceptace

- Cílené React/JSDOM regrese v novém test souboru pokryjí výše uvedené stavy.
- Sent karta neobsahuje tvrzení, že čeká ve frontě, a bez GET není serverově ověřená.
- Vlastní název ponechá datum a krátké ID; nezobrazuje plné UUID, token ani cestu.

## Sabotáže

### MUSÍ ZČERVENAT

1. Dočasně vrať univerzální čekající text; sent regrese selže.

### MUSÍ ZŮSTAT ZELENÉ

1. Po obnovení zachováno rozlišení a původní dashboard testy.

## Postup — dodrž pořadí

1. Ověř premisu, přidej regrese a proveď nejmenší opravu. Proveď sabotáž a obnov legitimní kód; doslovný RED/GREEN výstup ulož do I1/sabotaz.log.
2. Spusť typecheck `npm run typecheck`; doslovný výstup a exit kód před jakoukoli rourou ulož do I1/testy.log.
3. Spusť testy `npm run test:unit -- tests/recordings-status.test.js tests/recordings-dashboard.test.js`; doslovný výstup a exit kód připoj do I1/testy.log.
4. Jediný závěrečný Git self-check: `git --no-pager status --porcelain`.

Plné gates spustí root při integraci. Zastav zápisy a předej report, žádný commit.

## Output contract

```json
{
  "summary": "Konkrétní oprava popisků a identifikace.",
  "premisaPlatila": true,
  "premisaPoznamka": "Změřený nesprávný text a zachovaný kontrakt.",
  "kontrolniNula": {"souboruMimoAllowlist": 0, "gitZapisu": 0, "produkcnichRequestu": 0, "novychSkipuBaseline": 0},
  "sabotaze": [{"nazev": "sent zobrazen jako čekající", "vysledek": "RED a obnovený GREEN", "doslovnyVystup": "Přesná cesta k archivovanému doslovnému výstupu včetně exit kódů."}],
  "doslovnyVystupTestu": "Skutečný doslovný výstup nebo přesná cesta k archivovanému logu včetně exit kódů.",
  "coJsemNEOVERIL": ["Živá aplikace, audio a produkční server."]
}
```

Stejný objekt ulož do evidence/tasks/T-I1.report.json.
