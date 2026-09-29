# Důkazy E2E — LuDone Desktop 0.1.6

## Finální běh

Otevři [porovnání aplikace se schválenou Astrou](final/comparison.html). Snímky mají stejné view porty: panel 400×700, větší plocha 640×744. [Strojový report](../tasks/T-06.report.json) obsahuje jednotlivé kontroly, přesné výpisy příkazů, exit kódy, kontrolní nuly a popsané vizuální rozdíly.

- `final/output.txt` — doslovný výpis design E2E, včetně exit kódu.
- `final/gates-output.txt` — doslovný výpis `npm run gates`, včetně exit kódu.
- `final/report.json` — strojový výsledek vygenerovaný E2E.
- `final/application.log` — izolovaný log desktopového procesu.
- `final/*.png` — snímky skutečného rendereru a schválených referencí.

## Výsledek

34 kontrol pokrývá 11 oblastí: Teď, nahrávání a uložení, Můj den, detail, Nastavení, aktualizaci, offline/obnovu, onboarding, světlé/tmavé téma, vypnutý LuTrack a existenci screenshotů pro všech pět porovnání.

Nahrávací důkaz používá syntetický mikrofonní a systémový stream; aplikace vyrobila lokální stereo WebM/Opus a po restartu jej znovu načetla. `DESKTOP_UPLOAD_ENABLED=false`, testovací datový adresář je izolovaný, skutečná identita je v E2E vypnutá. Update scénář použil pouze fixture stažené verze; neproběhl síťový download ani instalace.

Vizuální přejímka je lidské porovnání screenshotů vedle sebe, ne pixelový diff. Pracovní úseky a ověřený serverový vlastník se liší záměrně: LuTrack není implementovaný a skutečná aplikace nesmí převzít fiktivní hodnoty z makety. Zvuk a instalace aktualizace čekají na fyzickou kontrolu na Macu.
