# Stav běhu `desktop-astra-parity-0-1-6`

**Aktualizováno:** 30. 9. 2026, Europe/Prague · **Větev:** `feat/desktop-astra-parity` · **Verze:** 0.1.6 · **commit / push / PR / tag / publikace:** zatím neproběhly

## Výsledek v pracovním stromě

- 🧪 Desktopový shell, Teď, Můj den, detail místní nahrávky, Nastavení, témata a vybrané ikony z Opus návrhu jsou implementované. LuTrack zůstává vypnutý a nevytváří pracovní minuty. Produktová UI zobrazují skutečný stav účtu, zvuku a odeslání.
- 🧪 `npm run test:design:e2e` prošel s exit kódem 0: 12 akceptačních skupin, 30 automatických podmínek a 5 dvojic screenshotů. Kontroly geometrie pro Můj den, detail, Nastavení a offline scénář prošly. Snímky Teď jsou pořízené a report je správně označuje pro ruční vizuální kontrolu; automatický běh netvrdí pixelovou shodu.
- 🧪 Nezávislé vizuální review Sol 30. 9. porovnalo poslední snímky s Astrou. Našlo překryv zvukové akce s nastavením zařízení; ten byl opraven a E2E nově ověřuje, že tlačítko zůstane uvnitř karty a nadpis následující sekce nezačne dřív než 4 px pod ním. Závěrečné review už nenašlo problém priority P1/P2. Zbývající rozdíly odpovídají skutečnému odhlášenému účtu, místním nahrávkám, neověřeným oprávněním a vypnutému LuTracku.
- 🧪 `npm run gates` prošel po posledních úpravách: lint, typecheck, 76 testovacích souborů, 1 567 PASS, 3 dosavadní skipy (baseline 3) a kontrola `preskocene`; exit kód 0.
- 🧪 E2E zároveň sestavilo `0.1.6` přes `npm run build`. Doslovné výpisy včetně exit kódů, report, screenshoty a [porovnání](evidence/e2e-2026-09-29/astra-layout-final/comparison.html) jsou v [důkazech E2E](evidence/e2e-2026-09-29/astra-layout-final/).
- 🧪 Předchozí nezávislé bezpečnostní review proti `f036788` nenašlo nový nález; kontrolovalo session/tokeny, převzetí a idempotenci fronty, IPC sender guard, testovací updater fixture a audio IPC. Nejde o ověření produkční cesty.

## Co důkazy neprokazují

- 🟡 E2E použilo syntetický mikrofon a syntetický systémový zvuk. Skutečný mikrofon, oprávnění macOS, systémový zvuk a instalace aplikace na Danově Macu čekají na přejímku.
- 🟡 V E2E bylo `DESKTOP_UPLOAD_ENABLED=false`, položky zůstaly místní a nedošlo k přihlášení ani produkčnímu uploadu. Úspěšný běh proto neověřuje přijetí nahrávky serverem.
- 🟡 Aktualizace byla testovací fixture. Veřejný feed, stažení, podpis a instalace aktualizace nebyly tímto E2E ověřeny.
- ⛔ Počet všech síťových zápisů není instrumentován; report proto netvrdí, že aplikace neprovedla žádný externí zápis. Doložené je vypnuté odesílání z konkrétního E2E toku.
- 🟡 Zvukovou cestu, přihlášení, skutečné odeslání a aktualizaci ověří Dan na fyzickém Macu. Podle pravidel repozitáře nemůže mít tvrzení o zvuku před touto přejímkou vyšší stav než 🧪.

## Masterplan a další dodání

- ⚠️ Kanonický masterplan zůstává `phase: project_context`, `planVersion: draft`, guard `plan-approved`; `plan.md` nemá schválení ani SHA. Schvalovací pole jsem ručně neměnil.
- ⚠️ Poslední uložený výstup `mp-lint` hlásí 76 nálezů v 7 starších task packetech a vazbách DAG/status; `mp-progress --check` hlásí zastaralý HTML přehled. Výpisy z kontroly 29. 9. jsou v `evidence/masterplan-check-2026-09-29/`.
- ⚠️ Masterplan skill svěřuje změny `status.json` nástroji `mp-status` a schválení harnessu. V tomto běhu není dostupný příkaz `mp-status` ani schvalovací hook, takže nebylo možné bezpečně aktualizovat kanonické strojové stavy ani schválit plán. Lidsky čitelný stav a příslušné důkazy jsou aktualizované zde a v `PLAN.md`.
- 🟡 PR, CI a příprava podepsaného vydání ještě čekají. Tag `v0.1.6` a publikaci nepovažuj za hotové; finální tag zůstává Danovi podle původního zadání.

## Rozsah

Změny jsou pouze v desktopovém repozitáři. Backend, webová aplikace `app.ludone.cz`, LuTrack a cizí `design/` nebyly upraveny. E2E nepoužilo skutečné přihlašovací údaje ani produkční upload.
