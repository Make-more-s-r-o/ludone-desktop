
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
