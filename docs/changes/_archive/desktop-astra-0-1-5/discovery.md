# Discovery — LuDone Desktop 0.1.5

**Rozsah:** desktopový repozitář, pracovní strom verze 0.1.5 · **ověřeno:** 24. 9. 2026.

| Požadavek | Už existuje | Částečně | Chybí | Důkaz | Dopad |
|---|---|---|---|---|---|
| Běžná nahrávací a uploadová cesta zůstane funkční. | ✓ |  |  | `src/features/recording/RecordingCard.jsx`, `src/features/queue/QueueCard.jsx`, `src/lib/queue.js` a produkční IPC testy. | Změna nemění kontrakt nahrávání ani uploadu; plné testy neověřují zvuk nebo skutečný server. |
| Uživatel otevře přehled Nahrávek přímo z hlavního panelu. |  | ✓ |  | Přehled existuje v Nastavení (`src/components/Settings.jsx`); dříve chyběla přímá cesta z panelu. Navigaci nyní pokrývají `tests/settings.test.js` a `tests/queue-wiring.test.js`. | Otevřít existující okno do existující části a zachovat jeho bezpečnostní identitu `#settings`. |
| Aplikace se pozná jako LuDone a stav lišty zůstane rozlišitelný. |  | ✓ |  | Značka je v `src/assets/LuDone.svg`; generátor stavů je `scripts/tray-ikony.mjs`; obrazové testy jsou v `tests/tray-ikony.test.js`. | Použít oficiální značku a tvarové odlišení stavů zvoleného návrhu. |
| LuTrack nesmí předstírat funkční měření ani napojení. |  | ✓ |  | Původní `src/features/tracking/TrackingCard.jsx` měl lokální demonstrativní časovač; hlavní panel a lišta dříve nabízely jeho akce. | Zobrazit pouze neaktivní informaci. Samostatný budoucí UX návrh zůstává v `docs/changes/desktop-redesign-2026-09-23/lutrack/`; žádné volání API `app.ludone.cz` pro čas se nepřidává. |
| Verze 0.1.5 projde stávajícím podepsaným a aktualizačním vydáním. | ✓ |  |  | `.github/workflows/release-macos.yml`, `scripts/package-mac.mjs`, `package.json`; pipeline ověřuje tag, secrets, podpis, notarizaci a zveřejní metadata jako poslední. | Použít existující workflow a potvrdit výsledný release i veřejný feed až po spuštění pipeline. |
| Ověřit skutečný záznam, upload a instalaci na Macu. |  |  | ✓ | Tyto úkony potřebují skutečné zařízení a účet; `OVERENI-NA-MACU.md` obsahuje postup. | Zůstávají 🟡 do Dana; automatické brány jsou nejvýše 🧪. |

## Rozsah měření a hranice důkazu

Porovnány byly současný kód, testy, `.github/workflows/release-macos.yml` a schválené návrhy z 23.–24. 9. 2026. Automatické testy, unit build ani čtení workflow nepotvrzují zachycení zvuku, upload do produkce, macOS oprávnění, podpis, notarizaci ani instalaci. Podpisové secrets nebyly čteny ani vypisovány.

## Rozpory a autorita

- Starší prototypy ukazují LuTrack jako použitelný časovač, současné zadání říká, že služba zatím není připravená. Autoritou je novější výslovné rozhodnutí D2: ponechat pouze návrh a neaktivní informaci.
- Návrh LuTracku je budoucí uživatelský zážitek; nepovoluje implementovat časovač ani napojení času na `app.ludone.cz`.
- Původní session obvykle otevírala Nastavení na účtu. Nová cesta smí změnit jen záložku přes allowlistovaný query parametr; bezpečnostní hash `#settings` zůstává autoritativní.

## Worktrees a kolize

Tato změna se integruje v jediném worktree. T-01 a T-02 dokončil jeden integrační zapisovatel před T-03; další editace hlavních procesů, nastavení a nahrávací fronty se nesouběží. Cizí `design/`, backend ani repozitář LuTracku nejsou součástí změny.
