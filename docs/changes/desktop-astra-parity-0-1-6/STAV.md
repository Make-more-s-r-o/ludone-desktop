# Stav běhu `desktop-astra-parity-0-1-6`

**30. 9. 2026 · větev `feat/desktop-astra-parity` · PR [#152](https://github.com/Make-more-s-r-o/ludone-desktop/pull/152)**

## Implementace a přejímka

- 🧪 Celý Astra shell, Teď, Můj den, detail, Nastavení, onboarding a aktualizační plocha jsou implementované s vybranými Opus ikonami. LuTrack je připravený a vypnutý; nevytváří pracovní minuty. Používají se skutečná data účtu/nahrávek, nikoli demo stavy.
- 🧪 Finální gates: 77 souborů, 1 573 PASS, původní 3 skipy; lint, typecheck a kontrola přeskočení exit 0. Žádná brána, skip ani baseline nebyly oslabeny.
- 🧪 Skutečné Electron main/preload/renderer E2E: 12 skupin, 35 podmínek, 18 snímků a 10 dvojic s uloženou Astrou; exit 0. Prošla ztráta a obnova syntetické systémové stopy i restart s neúplnou nahrávkou bez změny původních bajtů a bez falešného odeslání.
- 🧪 Samostatná stavová E2E: 18/18 PASS. Lokální fixture nahrazují preload a server, veškerá externí síť je zablokovaná (0 pokusů), produkční IPC 0. Netestuje produkční OAuth/upload ani instalační bránu main procesu.
- 🟡 Nezávislé vizuální review přijalo kompozici Astry s pravdivými produktovými rozdíly, bez zbývající P1/P2. Nejde o automatickou pixelovou shodu. Zachovává se šest skutečných bezpečnostních kroků onboardingu a neaktivní LuTrack; nahrávky nemají fiktivní serverové potvrzení.
- 🧪 Nezávislý review výsledného diffu a lokální integrity nenašel P1/P2. Nulová stopa a rozpracovaný manifest už nejsou označené jako kompletní; původní soubory, serverová fakta a oprávnění akcí zůstávají zachované.

[Důkazy a přímé porovnání](evidence/acceptance-2026-09-30/README.md) · [Mac přejímka](MAC-PREJIMKA.md)

## Co ještě není ověřené

- 🟡 Skutečný mikrofon, systémový zvuk, oprávnění macOS, instalace z Finderu, produkční přihlášení/odeslání a skutečná aktualizace čekají na Dana podle krátkého Mac postupu. Zvuk má do té doby nejvýš 🧪.
- 🟡 Hlavní E2E má upload vypnutý; všechny síťové zápisy jeho main procesu nejsou instrumentované. Stavová E2E je plně lokální. Žádný z těchto běhů neověřuje produkční server.
- 🟡 Tag a podepsaná publikace 0.1.6 ještě neproběhly. Poslední dřívější CI `ea41bc0` prošlo; po finálním pushi se ověří nový commit samostatně.

## Masterplan

- 🧪 Kanonický stav a HTML spravuje `mp-status` přímo přes Node ze skillu. Packety, DAG a evidence byly normalizované; `mp-lint` a `mp-progress --check` měly exit 0. Finální `mp-lint` má 0 nálezů a `mp-progress --check` exit 0.
- ⚠️ Plán formálně zůstává draft, protože tento Codex harness nemá Claude ExitPlanMode schvalovací hook. Přímé zadání Dana k samostatné implementaci a vydání platí; historické schválení, docs-first pořadí ani worker dispatch se nepředstírají. Pending historické tasky neznamenají chybějící implementaci; faktický stav dodání je na ose funkce a v důkazech.

Rozsah zůstal pouze v desktopovém repozitáři. Backend, `app.ludone.cz`, aktivace LuTracku a cizí `design/` se neměnily.
