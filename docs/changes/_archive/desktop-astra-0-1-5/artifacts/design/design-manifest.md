# Design manifest — LuDone Desktop 0.1.5

**Stav:** schválený směr Astra, realizuje se omezený výřez · **datum:** 2026-09-24 · **hlavní artefakt:** `../../../../desktop-redesign-2026-09-23/round2/variants/astra/index.html`

**Věrnost implementačního výřezu:** L1 — upravuje existující panel, nastavení a přístup do přehledu; nevzniká nové sdílené UI ani kompletní redesign. Původní klikací prototypy round 2 mají vyšší interaktivní věrnost a zůstávají zachované.

## Premisa a zdroje

- **Premisa:** Před vydáním 0.1.5 potřebuje uživatel skutečný rychlý vstup do nahrávek a rozpoznatelnou aplikaci, ale LuTrack ještě není funkční.
- **Výsledek ověření premisy:** hlavní panel má skutečné ovládání nahrávání, Nastavení obsahuje přehled fronty a LuTrack UI obsahovalo lokální demonstrativní timer; ověřeno čtením desktopového kódu a testů.
- **Produktové zdroje:** `intent.md`, `outcome-contract.md`, `spec.md` a původní `docs/changes/nahravky-dashboard/`.
- **Designové zdroje:** `docs/changes/desktop-redesign-2026-09-23/round2/VYBER.md`, `round2/ICON-ADDENDUM.md`, oba prototypy A/B a oficiální `round2/shared-assets/brand/LuDone.svg`.

## Obrazovky

| ID | obrazovka a obsah | Dnes | Návrh | věrnost a důvod | canonical prvky / existující primitiva | nové prvky | approvalRequired |
|---:|---|---|---|---|---|---|---|
| panel | **Hlavní panel.** Značka, nahrávání, odkaz na Nahrávky a pravdivý neaktivní LuTrack. | **Dnes:** screenshot přiložený uživatelem 23. 9. 2026; runtime stav nepořízen. | **Návrh:** [Astra Nit dne](../../../../desktop-redesign-2026-09-23/round2/variants/astra/index.html) | L1 pro úzký implementační výřez, plný návrh je L2 v uloženém prototypu. | Oficiální LuDone SVG, existující recording card a styl panelu. | Žádný sdílený prvek. | `composition` |
| settings | **Nastavení.** Širší levá navigace s ikonami a přímé otevření Nahrávek. | **Dnes:** screenshot přiložený uživatelem 23. 9. 2026; runtime stav nepořízen. | **Návrh:** Astra Identity/Settings stavy a Nahrávky z `round2/variants/astra/index.html`. | L1; zůstává existující okno a jeho obsah. | Stávající `SettingsApp`, canonical LuDone značka, stejné IPC brány. | Žádný sdílený prvek. | `composition` |
| recordings | **Přehled nahrávek.** Lokální/odeslané položky a existující akce. | **Dnes:** existující přehled v Settings, bez nového živého screenshotu. | **Návrh:** `round2/variants/astra/index.html?scenario=recordings` a specifikace nahrávek. | L1; dashboard se funkčně nepřestavuje. | Současný dashboard a jeho existující tlačítka. | Žádný. | `composition` |

## Matice pokrytí stavů

| stav | obrazovka | viditelný důkaz v návrhu |
|---|---|---|
| `default` | panel | Astra varianta B ukazuje výchozí stav nahrávání. |
| `pending/loading` | nahrávky | Existující dashboard ponechává načítání. |
| `empty` | nahrávky a LuTrack | Prototyp prázdného přehledu a zakázaný stav LuTracku. |
| `success` | nahrávky | Stav odeslání v existujícím workflow. |
| `partial success` | nahrávky | Smíšený stav položek ve frontě. |
| `recoverable error` | nahrávky | Existující akce opakovat a důvod selhání. |
| `fatal/unavailable` | panel | LuTrack vysvětluje nepřipravenost bez ovládací akce. |
| `timeout/offline` | nahrávky | Prototyp obsahuje stav bez sítě; produkční recovery zůstává v existujícím dashboardu. |
| `invalid input` | nastavení | Neznámá záložka odmítnuta IPC; automatizovaný test. |
| `conflict/concurrency` | nahrávky | Stávající vlastnická pravidla; návrh nemění chování. |
| `forbidden/redacted` | nahrávky | Stávající serverové oprávnění a redakce. |
| `disabled/degraded` | panel | LuTrack nese jasný štítek „připravujeme“. |
| `retry/rollback` | nahrávky | Existující retry tlačítko; rollback vydání v plánu. |
| `archived/superseded` | prototypy | Astra i Opus zůstávají v round2; prototypy neobsluhují skutečná data. |

## Varianty a rozhodnutí

| varianta | kompozice | trade-off |
|---|---|---|
| **A — Dvě stopy / Opus 5.5** | Práce a zvuk mají oddělená místa a více ovládacích prvků. | Více přímých funkcí, ale hustší panel. |
| **B — Nit dne / Astra** | Panel soustředí pozornost na právě důležitou činnost; vybráno pro 0.1.5. | Jednodušší panel; méně akcí přímo v panelu. |
| **C — nevyrobena** | Záměrně chybí třetí varianta. | Uživatel výslovně chtěl porovnat právě dva nezávislé návrhy a už zvolil B; další varianta by nepřinesla rozhodovací hodnotu. |

**Doporučení:** B, protože odpovídá Danovu výběru a umožní soustředit aktuální vydání na reálné nahrávání a jasný přehled.

## Co je schválené

Dan zvolil variantu Astra v chatu a povolil implementaci, zachování návrhů a vydání. Otevřené otázky designu: žádné. Předschválené jsou copy, stavy a přístupnost, pokud nemění produktový význam ani existující upload consent.

## Implementační poznámky

- Značka aplikace musí používat přesné originální LuDone SVG. Lišta může použít Opus styl rozlišení stavu; tvar při ztrátě zvuku musí být jiný i bez barvy.
- Nahrávky otevři přímo, ale zachovej bezpečnostní hash `#settings`. LuTrack zatím pouze vysvětli.
