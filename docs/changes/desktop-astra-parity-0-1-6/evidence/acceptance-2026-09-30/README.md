---
kind: verification
ref: desktop-astra-parity-0-1-6
verdict: "🧪 zelené testy"
measuredAt: 2026-09-29T23:14:43.122707+00:00
scope:
  - Astra kompozice, nahrávání a restart se syntetickým zvukem
  - stavová matice a lokální integrita
measuredFrom:
  - electron/report.json a skutečné soubory nahrávání
  - states/report.json a nezávislé review referencí
---

# Finální přejímka 0.1.6

🧪 `npm run gates`: 77 souborů, 1 573 PASS, původní 3 skipy; lint, typecheck a `preskocene` prošly, exit 0. Žádný skip ani baseline nebyl přidán.

🧪 `npm run test:design:e2e`: 12 skupin, 35 podmínek, 18 produktových screenshotů a 10 referenčních dvojic; exit 0. [Porovnání Astry](electron/comparison.html) hodnotil nezávislý reviewer v [závěrečném review](../reviews-2026-09-30/visual-final.md). Žádná zbývající P1/P2 kompoziční vada; nejde o automatickou pixelovou shodu.

🧪 Stavová E2E: 18 PASS nad stejným buildem, [galerie](states/index.html). Na rozdíl od hlavní E2E nepoužívá produkční preload; lokální fixture zastupují serverové odpovědi. Všechny externí síťové požadavky jsou zablokované, pokusů 0, produkčních IPC volání 0. Hlavní E2E používá skutečné main/preload, ale má vypnutý upload; pro celý tento proces síťové zápisy nepočítá.

🧪 Ztráta a obnovení syntetické systémové stopy prošla se stále běžícím mikrofonem. Samostatný restart s nedokončeným diskovým vzorkem zachoval všechny původní bajty, oznámil neúplnost a nenabídl odeslání/opakování/serverové potvrzení. To není měření fyzického výpadku zvuku či pádu Macu.

🧪 Kontrast aktivních tmavých akcí po ustálení přechodu: Otevřít zkoušku 15,18 : 1, Hotovo 18,62 : 1, obě enabled a opacity 1. Staré šedé snímky byly zachycené uprostřed přechodu. Screenshoty nyní čekají na písma, vykreslení a konečné animace.

## Proč to není chyba měřidla

Chybějící referenční screenshot byl dočasně odebrán: brána vrátila exit 1 a ENOENT, žádný scénář neprohlásila za splněný. Zdroj byl beze změny obnoven; doslovný výpis i report sabotáže jsou zde. Diskové testy neúplných/nulových souborů kontrolují hlavní snapshot, renderer i zachování původních bajtů. Dvě stará očekávání kompletnosti nulových souborů byla změněna na pravdivý `partial-audio` s kontrolou důvodu; testy se nevyřadily.

## Meze

🟡 Fyzický mikrofon, systémový zvuk, oprávnění, Finder instalace, přihlášení, produkční upload a skutečná aktualizace čekají na [Mac přejímku](../../MAC-PREJIMKA.md). Testovací update nabízí budoucí 0.1.7 přes striktně vývojovou fixture; neslibuje skutečné vydání 0.1.7. Podepsané vydání a veřejný feed budou mít samostatné důkazy.

Původní JSON reporty a doslovné výpisy zachovávají `.runtime` cesty jako provenienci. Snímky a přenosná HTML galerie jsou zde archivované; izolované profily a syntetické audio se do repozitáře nekopírují.

🧪 Stavová brána nově vyžaduje všech18 unikátních scénářů, PASS, výslovnou izolaci a screenshot; síťový pokus vrací exit1. Deset skutečných negativních/pozitivních testů pokrývá i neplatný profil, chybějící Electron ready a watchdog. CI unit sada je spouští přes Node runner; výpisy `state-gate-sabotages.txt` a `state-gate-unit.txt`. Tím je vyřešený nález chybějících testů v packetu bez výjimky nebo vymyšleného odkazu.
