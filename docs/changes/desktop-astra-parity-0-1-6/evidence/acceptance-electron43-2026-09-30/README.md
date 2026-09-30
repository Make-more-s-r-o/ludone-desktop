---
kind: verification
ref: desktop-astra-parity-0-1-6-electron43
verdict: "🧪 zelené testy"
measuredAt: 2026-09-30T00:05:00Z
scope:
  - bezpečnostní aktualizace desktop runtime a start prázdného profilu
  - skutečná Electron main/preload přejímka a vizuální porovnání Astry
measuredFrom:
  - gates-final.txt a skutečné main/preload reporty v electron/ a second-green/
  - nezávislé security review, vizuální review a oddělená rendererová stavová E2E
---

# Electron 43.7.6 před vydáním 0.1.6

🧪 Plné brány mají 78 souborů, 1 582 PASS, 3 původní skipy a exit 0. Lint, typecheck a kontrola přeskočení prošly. Skutečná main/preload E2E prošla dvakrát po sobě: 12 skupin, 35 podmínek, 18 snímků a 10 dvojic s uloženou Astrou. [Přímé porovnání](electron/comparison.html), [první report](electron/report.json), [druhý report](second-green/report.json), doslovné příkazy `design-e2e-final.txt` a `design-e2e-confirmed.txt`. Starý výstup prvního úspěchu obsahuje ✅; v následujícím běhu je správně 🧪. Jde o syntetická média a vypnutý upload, nikoli ověření naostro.

🧪 Oddělená stavová E2E má 18/18 PASS a exit 0 (`states/report.json`, `state-e2e.txt`). Používá lokální fixture, blokuje externí síť a nemá produkční preload. Klíčenku, OAuth/upload, instalaci ani fyzický zvuk nepotvrzuje.

🟡 Nezávislé [vizuální review](ludone-visual-review-electron43.md) přijalo všech deset dvojic bez P1/P2. Nejde o automatickou pixelovou shodu. Neaktivní LuTrack, nepřihlášený účet, skutečné kroky onboardingu a chybějící serverová potvrzení zůstávají pravdivými produktovými rozdíly proti demo datům návrhu.

## Opravy a zachované neúspěchy

Electron 39.8.10 zasahovaly čtyři high advisories. Přesný pin 43.7.6 je mimo dotčené rozsahy, je podporovaný a zachovává minimum macOS 12; zdroje jsou v D6. Full npm audit má nadále exit 1 pro devtoolchain undici high a Vitest moderate. Electron ani starý extract-zip již nehlásí. Není to tvrzení o celkové bezpečnosti ani důvod používat omit-dev jako měřítko dodaného runtime.

První gates správně selhaly kvůli chybějícímu majoru 43 v tabulce macOS minim. Doplněna doložená položka 43=12.0.0; žádná aserce ani skip se neměnily. FAIL zůstává v `gates.txt`.

Dva úvodní main/preload běhy měly exit 1 při startu. Profil vlastní izolované instance ukázal čekání v SecItemCopyMatching. Čtečka uložené identity nyní nejprve ověří existenci encrypted session a při ENOENT vrací null bez Keychain. Existující blob dál vyžaduje původní šifrování, dešifrování, validaci identity a logout/generation guard. Devět nových testů a 286 existujících queue-wiring testů prošlo; [nezávislé security review](ludone-auth-empty-store-security-review.md) bez P1/P2. Žádná oprávnění macOS ani produkční Keychain se neměnily.

Následující main E2E odhalila kliknutí CDP do předchozí Audio plochy po navigaci. Diagnostická stopa `detail-probe-trace.txt` dokládá SECTION jako skutečný hit target. Dvě requestAnimationFrame po scrollu synchronizují výpočet bodu s vykreslením; pořád se používá skutečná CDP myš, bez DOM click fallbacku či retry. Všechny aserce a 12s limity zůstaly. [Nezávislé review měřidla](ludone-cdp-paint-security-review.md) bez oslabování. Poté prošly oba plné běhy.

## Proč to není chyba měřidla

Main E2E spouští skutečný Electron a preload, ověřuje výsledná lokální data po restartu a původní bajty neúplné nahrávky. Kladný výsledek stavových fixture ji nenahrazuje. CDP diagnostika i aserce skutečného otevření detailu zůstávají přísné; první neúspěšné výpisy se nemažou. Vizuální review hodnotí skutečné snímky vedle verzované reference, nikoli samotný geometrický CAPTURED.

První release workflow 36645632382 byl zrušený před podpisem, notarizací a publikací. Před obnovou veřejný feed stále ukazuje 0.1.5. Publikační důkaz bude samostatný. 🟡 Fyzická Mac přejímka podle MAC-PREJIMKA.md nadále čeká na Dana.

🧪 Masterplan lint: 7 packetů, 28 pravidel, 126 souborů, 0 nálezů; progress --check exit 0. ⚠️ git diff --check nad generovaným přehledem hlásí whitespace na prázdném řádku renderTasks; známý nález generátoru se nezamlčuje a HTML se ručně nepřepisuje. Zdrojový diff je čistý.
