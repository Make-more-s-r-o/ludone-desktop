---
kind: e2e
ref: desktop-astra-parity-0-1-6
verdict: 🧪 zelené testy
measuredAt: 2026-09-29T20:56:22Z
scope:
  - renderer E2E v Electronu
  - screenshoty Astra 1:1 viewport
  - syntetické audio a izolované lokální soubory
measuredFrom:
  - scripts/astra-design-e2e.mjs
  - evidence/e2e-2026-09-29/final/report.json
  - nezávislé read-only vizuální review Sol
---

# Důkazy E2E — LuDone Desktop 0.1.6 — 29. 9. 2026

Otevři [porovnání aplikace se schválenou Astrou](final/comparison.html). Snímky mají totožné view porty: rychlý panel 400×700, větší plocha 640×744.

## Výsledek

`npm run test:design:e2e` skončil `EXIT_CODE=0`. V reportu je 11 akceptačních skupin, 26 seskupených podmínek a pět párů screenshotů. Skupiny chování jsou `PASS`; screenshoty jsou pouze `CAPTURED`, protože jejich pořízení samo neprokazuje vizuální shodu. Sol následně screenshoty porovnal a přijal kompozici jako věrnou produktovou adaptaci s doloženými rozdíly.

Záznam použil syntetický mikrofon a systémový stream; vznikly dvě lokální stopy a uživatelská volba „Nechat na Macu“. `DESKTOP_UPLOAD_ENABLED=false`, upload intent zůstal `held`, odesílací akce nebyla dostupná. Neproběhl produkční upload. Veškeré síťové zápisy nejsou instrumentované, proto se jejich počet nevydává za nulu. Update scénář použil pouze fixture stažené verze a odložení.

## Soubory důkazu

- `final/output.txt` — doslovný výpis Electron E2E včetně exit kódu.
- `final/report.json` — strojový report E2E; uvádí původní `.runtime` cesty, PNG stejného názvu jsou archivované vedle něj.
- `final/comparison.html` — pět párů aplikace/reference vedle sebe.
- `final/application.log` — izolovaný log aplikace.
- `final/*.png` — screenshoty aplikace a schválených referencí.
- `final/build-output.txt` — samostatný `npm run build`.
- `final/gates-output.txt` — `npm run gates`, úplný výpis s exit kódem.
- `../tasks/T-06.report.json` — shrnutí kontrol, vizuálního review a omezení měření.

Živý mikrofon/systémový zvuk, produkční upload, veřejný aktualizační feed a instalace aktualizace čekají na fyzickou přejímku na Macu.
