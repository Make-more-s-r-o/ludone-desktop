---
kind: review
ref: desktop-astra-parity-0-1-6
verdict: "🧪 zelené testy"
measuredAt: 2026-09-29T23:12:07.825144+00:00
scope:
  - výsledný diff vůči origin/main
measuredFrom:
  - electron a preload IPC
  - renderer a testové brány
---

# Read-only review výsledného diffu vůči `origin/main`

**Výsledek:** Nenašel jsem P1/P2 regresi v kontrolovaném diffu `electron/`, `src/`, `scripts/astra*` a `tests/queue*`. `git diff --check origin/main` prošel.

- Nový kanál `settings:return-to-panel` v hlavním procesu používá `onValidated` s rolí `settings` a odmítá payload; preload povoluje jen známé cesty do Nastavení. Nahrávací, uploadové a tokenové IPC kontrakty se tím nerozšiřují.
- Testovací `downloadedVersion: 0.1.7` je v `electron/main.cjs` pod současným `IS_TEST_RUN`, `!app.isPackaged`, `LUDONE_DESIGN_E2E` a explicitní update fixture proměnnou. Produkční updater dál čerpá stav z hlavního procesu. Rendererový `astra-state-e2e` používá lokálně injektované fixture; jeho PASS není důkazem produkčního OAuth, uploadu či instalace, což report výslovně uvádí.
- Detail aktualizace používá stávající `installUpdate`/`deferUpdate` přes preload. Test odložení ověřuje IPC a nepřítomnost `quitAndInstall`; nový text tlačítka nemění instalační oprávnění.
- `RecordingCard` zachovává volby „Uložit a odeslat“ / „Nechat na Macu“ a `canSend` guard. Nové rychlé akce volají tytéž metody `start`/`stop` jako karta. Fronta při opakované obnově vrací existující položku beze změny, pokud sedí ID, manifestové cesty, stopy a `recoveredIncomplete`; vlastnictví ani souhlas nepřepisuje.
- Úprava `tests/queue.test.js` pro nulový zvuk odpovídá změně skutečného kontraktu `complete-audio` → `partial-audio` a doplňuje kontrolu důvodu; nejde o výjimku, skip ani oslabení brány. Předchozí samostatné review lokální integrity zůstává v platnosti.

**Meze review:** Jde o statickou kontrolu diffu a `git diff --check`; produkční zvuk, upload, OAuth ani skutečná instalace aktualizace zde nebyly spuštěny.
