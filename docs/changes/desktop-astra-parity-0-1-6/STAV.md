# Stav běhu `desktop-astra-parity-0-1-6`

## Verze 0.1.7 je vydaná

**30. 9. 2026:** ✅ PR #158 sloučený, nový neměnný tag `v0.1.7` na `a149a55`,
podpis/notarizace a publikace pro arm64/x64 prošly. Workflow 36767124908 SUCCESS;
nezávislý GET feedu 0.1.7 a osm HEAD HTTP200 potvrzené.
[Publikační důkazy](evidence/release-0-1-7-2026-09-30/README.md).

🧪 Zdroj `2bf1da4`: 1 654 PASS / 3 původní skipy, 35 hlavních Electron
podmínek, 18 stavů a 41 produktových cest v šířkách 400/640 px.
Nezávislé core/UI/vizuální review bez zbývající P1/P2; přesná brána D10 zelená.
Nahrávání je první, LuTrack kompaktní a neaktivní. Nastavení obnoví uložený
default firmy; konkrétní nahrávka má vlastní firmu/přístup a uložení nic neodesílá.
D11 mění výchozí přístup pouze novým nahrávkám na firemní. Historické chybějící
preference zůstávají soukromé; existující serverová vazba/progress zamyká změny.
[Finální přejímka](evidence/acceptance-0-1-7-2026-09-30/README.md).

🟡 Fyzický zvuk, produkční OAuth/upload a instalace aktualizace čekají na člověka
podle [Mac přejímky](MAC-PREJIMKA.md). Syntetická E2E to neověřuje naostro.
Následující 0.1.6 důkazy popisují historickou publikaci.

**30. 9. 2026 · ✅ verze 0.1.6 podepsaná, notarizovaná a publikovaná · PR #152, #153 a #154 sloučené · 🟡 fyzická Mac přejímka čeká**

## Živý proklik po instalaci 30. 9.

- ✅ Dan instalaci potvrdil; v běžící aplikaci z Applications je vidět 0.1.6 a fungují přechody Teď / Můj den / Nastavení.
- ⚠️ Na skutečné historii a frontě byly nalezeny nedostatky: chybí členění historie po dnech, fronta odsouvá nahrávání, zůstal starý odkaz do Nastavení a diagnostika se při běžném vstupu nenačte. Rozpracované nahrávání se v přehledu tváří jako neúplné. Vizuální přejímka tím není uzavřená; předchozí lokální review se nevydává za důkaz bezchybné instalace.
- 🟡 Nový upload, zvuk výsledného souboru a zbývající živé prokliky čekají. Běžící nahrávání nebylo přerušeno. [Konkrétní nálezy a rozsah kontroly](evidence/mac-ui-2026-09-30/README.md).

## Implementace a přejímka

- 🧪 Celý Astra shell, Teď, Můj den, detail, Nastavení, onboarding a aktualizační plocha jsou implementované s vybranými Opus ikonami. LuTrack je připravený a vypnutý; nevytváří pracovní minuty. Používají se skutečná data účtu/nahrávek, nikoli demo stavy.
- 🧪 Finální gates: 78 souborů, 1 582 PASS, původní 3 skipy; lint, typecheck a kontrola přeskočení exit 0. Žádná brána, skip ani baseline nebyly oslabeny.
- 🧪 Skutečné Electron main/preload/renderer E2E: 12 skupin, 35 podmínek, 18 snímků a 10 dvojic s uloženou Astrou; exit 0. Prošla ztráta a obnova syntetické systémové stopy i restart s neúplnou nahrávkou bez změny původních bajtů a bez falešného odeslání.
- 🧪 Samostatná stavová E2E: 18/18 PASS. Lokální fixture nahrazují preload a server, veškerá externí síť je zablokovaná (0 pokusů), produkční IPC 0. Netestuje produkční OAuth/upload ani instalační bránu main procesu.
- 🟡 Nezávislé vizuální review přijalo kompozici Astry s pravdivými produktovými rozdíly, bez zbývající P1/P2. Nejde o automatickou pixelovou shodu. Zachovává se šest skutečných bezpečnostních kroků onboardingu a neaktivní LuTrack; nahrávky nemají fiktivní serverové potvrzení.
- 🧪 Nezávislý review výsledného diffu a lokální integrity nenašel P1/P2. Nulová stopa a rozpracovaný manifest už nejsou označené jako kompletní; původní soubory, serverová fakta a oprávnění akcí zůstávají zachované.

[Důkazy a přímé porovnání](evidence/acceptance-electron43-2026-09-30/README.md) · [Mac přejímka](MAC-PREJIMKA.md)

## Publikace a co ještě není ověřené

- 🟡 Skutečný mikrofon, systémový zvuk, oprávnění macOS, instalace z Finderu, produkční přihlášení/odeslání a skutečná aktualizace čekají na Dana podle krátkého Mac postupu. Zvuk má do té doby nejvýš 🧪.
- 🟡 Hlavní E2E má upload vypnutý; všechny síťové zápisy jeho main procesu nejsou instrumentované. Stavová E2E je plně lokální. Žádný z těchto běhů neověřuje produkční server.
- 🧪 CI implementace `2405df1`, release notes `3570432` i runtime opravy `d4428a1` prošlo; PR #152–154 jsou sloučené.
- ✅ [Vydání0.1.6](evidence/release-2026-09-30/README.md): workflow 36649506694 SUCCESS, veřejný feed 0.1.6 a všech osm artefaktů HTTP200. První canceled run zůstává v archivu, obnoven pouze dosud nepublikovaný tag s přesným lease. Publikovaný tag je nyní neměnný.
- 🧪 Electron 43.7.6 zachovává macOS 12 a opravuje čtyři high runtime advisories. Oprava prázdného profilu prošla nezávislým security review; dva nové skutečné main/preload průchody mají 35/35 podmínek, stavové E2E 18/18. Vizuální review deseti dvojic bez P1/P2. [Důkazy včetně zachovaných FAIL](evidence/acceptance-electron43-2026-09-30/README.md).

## Masterplan

- 🧪 Kanonický stav a HTML spravuje `mp-status` přímo přes Node ze skillu. Packety, DAG a evidence byly normalizované; `mp-lint` a `mp-progress --check` měly exit 0. Finální `mp-lint` má 0 nálezů a `mp-progress --check` exit 0.
- ⚠️ Plán formálně zůstává draft, protože tento Codex harness nemá Claude ExitPlanMode schvalovací hook. Přímé zadání Dana k samostatné implementaci a vydání platí; historické schválení, docs-first pořadí ani worker dispatch se nepředstírají. Pending historické tasky neznamenají chybějící implementaci; faktický stav dodání je na ose funkce a v důkazech.

Rozsah zůstal pouze v desktopovém repozitáři. Backend, `app.ludone.cz`, aktivace LuTracku a cizí `design/` se neměnily.
