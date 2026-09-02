
# CHECKPOINT — LuDone Desktop

Poslední zápis: **2. 9. 2026, 22:05**. Dan spí, běh pokračuje bez něj.

## ✅ CO JE OVĚŘENO NAOSTRO (Dan to viděl běžet)

- **Ikona v liště funguje.** Nebyla vidět proto, že Danova lišta byla plná — ne kvůli vadě.
  Po uvolnění místa se objevila. `getBounds()` přitom celou dobu hlásil nenulové rozměry;
  spor rozhodl až klik na hlášené souřadnice, který trefil aplikační menu.
- **Panel se otevře a odpovídá schválenému designu** — značka LuDone, „Připojení neověřeno",
  řádek Nahrávání s tlačítkem Nahrát, patička „1 čeká · Nastavení".

## Stav

| | |
|---|---|
| `main` | **446 passed \| 6 skipped (452)**, čistý |
| PR | **0 otevřených** — #25–#30 smergované |
| CI | ✅ zelené, repo veřejné, hostované runnery zdarma |
| záložní runner | `danuv-mac`, registrovaný, cizí PR vyžadují schválení |
| design v `main` | **18 z 21** obrazovek |

## Co zbývá postavit

1. 🔴 **Hláška při plné liště** — dnešní vada z Danova pohledu: aplikace mlčí, i když ji
   uživatel nikde nevidí. Nový uživatel usoudí, že nefunguje.
2. **lišta — kontextové menu (pravý klik)**
3. **panel — výpadek ostatního zvuku**
4. **panel — běží obojí**
5. Balení: `electron-builder` + `electron-updater` + verzování (podpis čeká na Apple Developer)

## Rozdělaná práce

- větev `orca/desktop-docs` (na originu) — pročištění infrastrukturních odkazů, 18 souborů.
  Job umřel, práce zachráněná a commitnutá. Zbývá přečíst, brány, PR.

## Čeká na Dana

- **Apple Developer** (ráno). Nic jiného.

---

## 🔴 CO JEŠTĚ DĚLÍ APLIKACI OD NÁVRHU (změřeno 2. 9. ve 22:30)

Dan po prvním pohledu řekl, že aplikace „nevypadá dokonale". Měl pravdu a měřením se
ukázalo proč. **Počítal jsem obrazovky, ne jejich věrnost.**

### 1. ✅ Písma — vyřešeno v PR #32

CSS předepisovalo `Instrument Sans` a `Public Sans`, ale **v repu nebyl jediný soubor
písma**, v CSS žádný `@font-face` a v systému je uživatel nemá. Všechno se kreslilo
náhradním systémovým písmem. Přibaleno lokálně (4 variabilní soubory, 92 kB, včetně
`latin-ext` pro češtinu) + brána proti návratu.

### 2. 🟡 Dvě palety vedle sebe — otevřená otázka na návrh

| kde | co používá | odstín |
|---|---|---|
| panel (co Dan viděl) | `--panel-accent: oklch(0.72 0.14 268)` | **modrá — přesně dle návrhu** |
| onboarding, nastavení, test záznamu | `.button--primary` → `--green: oklch(0.5 0.17 145)` | **zelená** |

Panel je věrný. Zelená se drží na **8 místech** (Onboarding 5×, RecordingTestStep,
Settings, RecordingCard).

⚠️ **Nepřekresluju to od stolu.** Zelená `oklch(0.5 0.17 145)` v návrhu existuje — ale
jako `--ok-base`, tedy „pozitivní/OK", ne jako barva hlavní akce. Jestli má být tlačítko
„Začít" modré nebo zelené, patří ověřit proti `design/navrh/nahled.html`, ne odhadnout.

### 3. Co naopak v pořádku JE

Aplikace není chudší než návrh: `border-radius` 48× proti 46×, `box-shadow` 5× proti 2×,
navíc přechody a animace, které návrh vůbec nemá.
