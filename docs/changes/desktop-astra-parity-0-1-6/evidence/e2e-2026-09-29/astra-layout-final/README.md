# Astra design E2E — konečný lokální běh

**Příkaz:** `npm run test:design:e2e` · **Výsledek:** 🧪 exit 0, 12 akceptačních skupin; 30 automatických podmínek a 5 dvojic screenshotů; detailní výstup je v [acceptance-output.txt](acceptance-output.txt).
**Report:** [report.json](report.json) · **Porovnání:** [comparison.html](comparison.html)

E2E otevřelo sestavenou Electron aplikaci v izolovaném uživatelském profilu. Nahrávací důkaz tvoří syntetický mikrofon a syntetický systémový zvuk; `DESKTOP_UPLOAD_ENABLED=false`, takže se nic neposílalo na produkční server. Aktualizace byla testovací fixture a instalace byla odložena.

Snímky `astra-*.png` jsou schválené referenční obrazovky, očíslované snímky jsou výsledky aplikace. Automatické kontroly ověřují navigaci, chování, pořadí, rozměry, viditelnost a přetečení. Screenshoty jsou označené jako zachycené pro vizuální porovnání; automatický běh netvrdí pixelovou shodu. Obrazovka Teď je v reportu označená k ruční vizuální kontrole. Nezávislé vizuální review Sol 30. 9. potvrdilo, že po opravě překryvu v Nastavení nezůstává v kontrolovaných plochách problém P1/P2.

UI zachovává skutečné stavy: LuTrack zůstává vypnutý, účet E2E je odhlášený, firma není vybraná a připravenost zvukových oprávnění se nevydává za potvrzenou.

Tento důkaz neověřuje skutečný mikrofon, systémové oprávnění, přihlášení, produkční upload, veřejný aktualizační feed ani instalaci. Tyto kroky zůstávají pro přejímku na Danově Macu.
