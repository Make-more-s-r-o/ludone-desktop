# CHECKPOINT — LuDone Desktop

Poslední zápis: **2. 9. 2026, 23:20**. Dan spí, běh pokračuje bez něj.

## 🎉 CELÝ SCHVÁLENÝ DESIGN STOJÍ

**21 z 21 desktopových obrazovek je v `main`** (22. je serverová obrazovka souhlasu, ne naše).
Poslední tři dorazily dnes v noci: kontextové menu lišty, výpadek ostatního zvuku, běží obojí.

| | |
|---|---|
| `main` | **473 passed \| 6 skipped (479)**, čistý |
| otevřené PR | **0** — #25 až #34 smergované |
| CI | ✅ zelené, repozitář veřejný, hostované runnery zdarma |
| záložní runner | `danuv-mac`, registrovaný; cizí PR vyžadují schválení |

## ✅ Ověřeno naostro (Dan to viděl běžet)

- **Ikona v liště funguje.** Nebyla vidět proto, že Danova lišta byla plná. `getBounds()`
  přitom celou dobu hlásil nenulové rozměry — spor rozhodl až klik na hlášené souřadnice,
  který trefil aplikační menu. Z toho vznikl PR #33: aplikace už v takové situaci nemlčí.
- **Panel se otevře a odpovídá návrhu** — značka, stav přihlášení, řádek Nahrávání, patička.
- **`npm run gates:clean`** — brány nad čistým klonem, spuštěno a zelené.
- **Vlastní GitHub runner** na Danově Macu — job na něm proběhl zeleně.

## 🧪 Postaveno, ale nikdo to neviděl běžet

Prakticky všechno ostatní: export do stereo souboru · pojmenování schůzky · onboarding
včetně testu záznamu · adresa přihlášení · výpadek ostatního zvuku · kontextové menu ·
hláška při plné liště · přibalená písma.

## Rozdělaná práce

- **`orca/desktop-baleni`** — electron-builder + electron-updater. Job běžel při psaní
  tohohle zápisu; po doběhnutí commitnout, brány, sabotáže, PR.

## Co zbývá

1. Dotáhnout balení (běží).
2. 🟡 **Barva hlavního tlačítka** — panel má modrou dle návrhu, onboarding a nastavení
   zelenou na 8 místech. Rozhodnutí pro Dana, ne pro mě.
3. Podpis a notarizace — až bude Apple Developer.
4. Ruční ověření na Macu: plná lišta, výpadek zvuku odpojením sluchátek, přehrání
   stereo exportu.

## Čeká na Dana

- **Apple Developer** — na koho zapsat (Individual × firma; mezi nimi se nepřechází).
  Bez něj to jde, ale nepojedou automatické aktualizace ani trvalá oprávnění.
- **Barva hlavního tlačítka** v onboardingu a nastavení.
