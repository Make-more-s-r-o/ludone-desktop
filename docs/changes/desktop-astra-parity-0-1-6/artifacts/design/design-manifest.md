# Design manifest — LuDone Desktop 0.1.6: Astra „Nit dne“

**Stav:** uživatelem dříve schválená varianta; plná implementace čeká na E2E přejímku · **datum:** 24. 9. 2026 · **hlavní artefakt:** `../../../../desktop-redesign-2026-09-23/round2/variants/astra/index.html`

**Věrnost:** L2 — jde o novou kompozici celého desktopového toku, ne o drobnou opravu existující karty.

## Premisa a zdroje

- **Premisa:** vydaný desktop neodpovídá schválenému celku.
- **Výsledek ověření:** potvrzeno screenshotem 24. 9. a manifestem 0.1.5, který píše „realizuje se omezený výřez“.
- **Produktové zdroje:** `ROZHODNUTI.md`, `docs/changes/nahravky-dashboard/ZADANI-PRO-CODEX.md`, `docs/changes/_archive/desktop-astra-0-1-5/decisions.md`.
- **Designové zdroje:** `docs/changes/desktop-redesign-2026-09-23/round2/variants/astra/index.html`, `styles.css`, `manifest.json`, `FINALIZATION.md` a stavové screenshoty `evidence/`.

## Obrazovky a použité prvky

| # | obrazovka | Dnes | Astra návrh | věrnost | prvky | nové prvky | approvalRequired |
|---:|---|---|---|---|---|---|---|
| 1 | Teď / menu panel | Screenshot od Dana 24. 9. | Astra `home`, `working`, `meeting`, `save`, `record-only` | L2 | LuDone značka, současný recording flow, stav fronty | sjednocená navigace a hierarchie | `none` — směr B byl výslovně vybrán |
| 2 | Můj den | V produktu chybí | Astra `day`, jednotná stopa práce/nahrávek s filtrem a přístupem k detailu | L2 | existující dashboard/fronta, status badges | kompozice časové osy | `none` — dříve schválený prototyp |
| 3 | Detail nahrávky | Rozšíření je v dashboardu | Astra `detail`, lokální × fronta × server a kontext akce | L2 | existující detail a IPC/API akce | jednotné rozložení detailu | `none` |
| 4 | Nastavení / identita | Současné samostatné okno a záložky | Astra `settings`, `identity`; originální LuDone ikona a konzistentní shell | L2 | současné účet/audio/retence/fronta/diagnostika/update API | seskupení obsahu a navigace | `none` |
| 5 | Offline, recovery, update, onboarding | Existující stavy jsou oddělené | Astra odpovídající scénáře | L2 | stávající queue/auth/update logika | společné stavové zprávy a předání | `none` |

Původní plně klikací a schválený prototyp zůstává v `round2/variants/astra/`. Produktový renderer nesmí převzít jeho fiktivní časové úseky, vlastníka ani simulované úspěchy. Když stávající desktop nemá skutečnou podporu pro prototypovou akci, zobrazí ji jako nepřipravenou nebo předá do již existující podporované plochy.

## Matice pokrytí

| stav | plocha | důkaz v návrhu |
|---|---|---|
| `default` | Teď | `home`, `evidence/home.png` |
| `pending/loading` | Teď / Nastavení | stavové komponenty a scénář `update` |
| `empty` | Můj den | timeline bez záznamů, prázdný stav musí být součást implementace |
| `success` | uložení a detail | `save`, `detail` |
| `partial success` | záznam | `attention`, `record-only` |
| `recoverable error` | detail / Můj den | `attention`, `recovery` |
| `offline` | shell / fronta | `offline` |
| `auth expired` | přihlášení / detail | `attention`, `onboarding` |
| `disabled/degraded` | LuTrack | `home`, s produkčním ovládáním disabled |
| `update available` | shell / Nastavení | `update` |
| `identity` | Nastavení | `identity`, `evidence/identity.png` |

## Přijatelné rozdíly mezi mockupem a skutečným produktem

- Produkční appka používá výhradně skutečná data; demo data prototypu zůstávají jen v mockupu a E2E fixtuře.
- LuTrack nebude interaktivní a nevytvoří čas, dokud není jeho služba schváleně zapojená.
- Akce bez stávajícího desktopového API zůstane označená jako nepřipravená; nevytváří se serverová capability.
- Responzivní okno se může zúžit při malé dostupné ploše, nesmí ale změnit pořadí ani význam hlavních akcí.
