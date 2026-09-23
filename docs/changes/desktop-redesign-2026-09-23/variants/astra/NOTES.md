# Astra — LuDone Desktop

23. září 2026. Samostatný klikací návrh inspirovaný LuDone DS, nikoli canonical produkční komponenty. Podle společného zadání a dodatku MAC-ADDENDUM. Výstup je pouze v této složce; žádné změny produktu ani druhé varianty.

## Nosná myšlenka

Jedna klidná plocha pro jednu právě důležitou věc. Panel začíná cílovou firmou, pokračuje nahráváním a končí stálou hlavní akcí. Člověk vidí, kam data půjdou, ještě než začne. Po stopu dostane prostor název a výslovné rozhodnutí o odeslání; vedlejší agendy ustoupí. Místní přehled ukazuje tři rozdílné situace současně, s dalším krokem přímo u nahrávky. Detail odděluje kopii na Macu od skutečnosti na serveru. Vizuální identitu drží původní pulz LuDone, Brockmann, Public Sans a sémantické tokeny. Jemné linky nahrazují vnořené karty. Výrazná typografie patří hlavně názvu a času, barva je podpůrná.

## Tři podstatné změny

1. **Cíl odeslání přímo v toku.** V běžném panelu je firma nahoře. Při chybějící firmě je výběr rovnou u uložené nahrávky, včetně vysvětlení a samostatného uložení. Výběr neodesílá; potom následuje výslovné „Uložit a odeslat“.
2. **Stavy říkají, co se opravdu stalo.** „Uloženo na Macu“, „Ve frontě“, „Odesláno“ a „Ověřeno v LuDone“ nejsou zaměnitelné. Obnova přihlášení, opakování, vlastnictví a limit mají vlastní další krok. Otevření webu je dostupné až po ověření.
3. **Postupné odkrývání detailu.** Tři nahrávky a jejich hlavní akce se vejdou do základního okna. Klik na název otevře detail; nabídka u názvu zpřístupní souborové akce. Koš a převzetí vždy jmenují konkrétní nahrávku. Při ukládání panel věnuje místo rozhodnutí o nahrávce.

## Mapa akcí

| Současná akce / oblast | Nové místo |
|---|---|
| Nahrát; Ukončit a uložit | Pevný spodní blok panelu |
| Název po stopu; Uložit a odeslat; Nechat na Macu | Dokončovací panel; firma přímo pod názvem |
| Výběr firmy | Panel i Nastavení → Účet; vždy výslovně uložit |
| Fronta / lokální nahrávky | Spodní řádek panelu → Nastavení → Nahrávky |
| Obnovit přehled | Ikona se jménem „Obnovit přehled“ v hlavičce místního seznamu |
| Opakování / přihlášení / odeslání / ověření / otevření | Kontextová akce u položky i v detailu |
| Finder / koš | Nabídka u názvu položky a detail; koš s potvrzením |
| Převzít pod svůj účet | Kontextová akce při jiném vlastníkovi; potvrzení konkrétní položky |
| Přihlášení / odhlášení tohoto Macu | Nastavení → Účet; přímá obnova také u blokované položky |
| Dock / start po přihlášení / téma | Nastavení → Účet |
| Zdroje / oprávnění / test zvuku / automatika | Nastavení → Zvuk |
| Retence „Záznamy“ | Srozumitelněji pojmenované Nastavení → Ukládání |
| Export diagnostiky | Nastavení → Diagnostika |
| Labs | Účet → Pokročilé; produkce zůstává běžný cíl |
| Kontrola aktualizací | Patička Nastavení i Diagnostika |
| Aktualizovat / Později | Proužek v panelu; běžící činnosti odkládají instalaci |
| LuTrack | Malý řádek panelu, od začátku označený jako ukázka bez ukládání |
| Detail nahrávky | Klik na název v seznamu; samostatná plocha stejného okna |
| Ikona a lišta | Diagnostika → Ikona a lišta; doplňkový návrhový scénář |

## Spuštění a kontrakt

Otevřít `index.html` přímo v prohlížeči, bez serveru či buildu. Lokální fonty a kopie společných tokenů jsou v `assets/`, takže varianta funguje i samostatně.

- `index.html?scenario=idle&theme=light`
- Scénáře: `idle`, `recording`, `saved`, `blocked-company`, `uploading`, `retry`, `settings`, `update`, **`identity`**, **`detail`**.
- Témata: `light` (výchozí), `professional`, `dark`.
- Panel: šířka **366 px**, ověřovací výška **650 px**; hlavní akce dostupná i při **500 px**. Prostor pod 650 px převezme interní scroll. Nastavení, přehled, identita a detail: **448 × 676 px**.
- `data-scenario` a `data-theme` na `<html>` odpovídají aktuálnímu stavu.
- Přijímaná zpráva pouze od `window.parent`: `{type:'ludone-design:set', scenario, theme}`. Neplatné hodnoty se odmítnou, povolené jsou i jednotlivé platné parametry.
- Při každém vykreslení v iframe odejde `{type:'ludone-design:state', scenario, theme}`. Rodič podle scénáře může upravit rozměry. Samostatná stránka rodiči nic neposílá.
- „Stavy ukázky“ v patičce umožní přepnout scénář/téma a simulovat dokončení uploadu, serverový limit či jiného vlastníka první nahrávky. Není to navržená produkční funkce.

## Co je simulace nebo nový návrh

Všechna data jsou fiktivní, stav žije pouze v paměti stránky. Reload jej resetuje. Čas nahrávání je záměrně stabilních 12:34 a měřáky jsou statické ilustrace vstupů; pouze ukázkový LuTrack počítá místní sekundy. Přihlášení, odeslání, ověření, oprávnění, Finder, koš, export i aktualizace mají lokální odezvu a nikdy nevolají systém či server. CSP zakazuje síťová spojení. Předvolby jsou místně přepínatelné. Automatika při stopu vloží do simulované fronty pouze právě novou nahrávku, pokud je zvolená firma a platné ukázkové přihlášení; existující položky nemění. Bez firmy či přihlášení přejde k místně uložené nahrávce s opravou blokace. Napojení na skutečný záznam, retenci a odesílání není implementované.

Novým návrhem jsou kompozice, přímý výběr firmy po stopu, přejmenování retence na Ukládání, detail jedné místní nahrávky, tematický přepínač a sada SVG ikon. Detail nezavádí přehrávač ani přepis. Převzetí záměrně končí místním stavem a vyžaduje nový výslovný klik pro odeslání. Tato bezpečnější dvojice kroků je produktový návrh, ne tvrzení o dnešní 0.1.4.

Fiktivní 0.1.5 není skutečné oznámení vydání. Jednorázové oznámení macOS se nespouští; jeho případný klik má vést na tentýž aktualizační proužek. Nativní titulková lišta v HTML jen rezervuje prostor ovladačů; tři šedé kruhy jsou vizuální zástupci systémového chromu, nikoli webová tlačítka pro řízení skutečných oken.

Při dokončování nahrávky je klidový LuTrack schovaný. Pokud ukázkový časovač běží, zůstává vidět jeho malý řádek s časem a tlačítkem Zastavit i při pojmenování. Instalace čeká také na něj.

## Ikony a macOS

`assets/app-icon.svg` používá temný neutrální podklad a bílý původní pulz; preview má 128, 64, 32 a 16 px. Zaoblení patří pouze obalu ikony aplikace. Vnitřní plochy UI mají radius 0, ovladače 2 px, dialog 4 px.

`tray-idle.svg`, `tray-recording.svg`, `tray-attention.svg`, `tray-recording-tracking.svg` mají skutečný rozměr 18 × 18 px. Černý jednobarevný výkres je podklad pro template image; ve vzorku tmavé lišty se pouze invertuje. Původní pulz označuje klid, plný bod nahrávání, vykřičník pozornost a hodiny souběh s časovačem. Klik na každý vzorek otevře odpovídající simulovaný panel. ICNS, template flag a pixelové doladění 1×/2× jsou práce až pro implementaci.

## Inspirace a historické podklady

Přečteny Danovy preference z 1. září, relevantní kompozice `design/navrh/{nahled,Main.dc,Lista.dc}.html`, situační plochy `design/canvas/{Nahravani,Fronta,ZtrataStopy,Opravneni}.dc.html` a oba historické návrhy Astra z 6. září včetně jejich zdůvodnění. Nikdy nebyla otevřena současná konkurenční varianta. `src/ui/Icons.jsx` neexistuje; skutečná ikonografie je v `src/components/Icons.jsx`. Geometrie pulzu vychází z tohoto souboru a `scripts/tray-ikony.mjs` (`M4 18 10 6 14 14 20 9`).

Přebírám stabilní pořadí činností, pravdivé pojmenování umístění dat a tvarové stavy lišty. Z historických návrhů už neplatí ruční předání souboru na web, systémové/Instrument Sans nadpisy, barevně závislé stavy lišty ani představa funkčního LuTracku. Kalendář, projekty, archiv a desktopový přepis se nevracejí.

Kompoziční inspirace: Plaud — dominance nahrávání a přechod k záznamu (reference [z briefu](https://support.plaud.ai/hc/article_attachments/58675725815065)); [Raycast](https://www.raycast.com/) — malé desktopové ovládání a jasný focus; Linear a Notion podle historického Danova zadání — přesná hierarchie a postupné odkrývání. Nevzniká command palette ani sidebar. [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/app-icons) je referenční odkaz pro následné nativní zpracování; webový nástroj poskytl pouze JS shell, takže tento běh netvrdí audit souladu s aktuální úplnou HIG.

## Náročnost a rizika

**M celkem.** Kompozice, copy, tokeny a přejmenování retence S; stavové propojení panelu, výběru firmy, detailu a fronty M; export finálních nativních ikon S–M podle testů malých velikostí. Žádný nový backend není v návrhu předpokládán.

- Cíl položky musí zůstat snapshotem schváleného odeslání. Změna firmy účtu nesmí přepsat cíle staré fronty.
- Místní stav přenosu není důkaz serverového ověření. UI musí číst existující nezávislé skutečnosti a respektovat limit serveru.
- Převzetí, odhlášení a koš vyžadují při implementaci review nad skutečným diffem, nikoli důvěru v HTML simulaci.
- Nativní titlebar, životní cyklus oken, přístup přes Dock a čitelnost ikon pod výřezem vyžadují samostatnou přejímku na Macu.
- Keyboard smoke prohlížeče není test VoiceOver. Ovládání stojí na nativních button/select/input/details/dialog, má popisky, focus a návrat focusu z dialogu.

## Důkaz ověření

Rozsah a doslovný výstup lokálního akceptačního skriptu jsou v [evidence/verification.txt](evidence/verification.txt). Cílené opravy z nezávislé QA a klávesnice jsou doložené zvlášť v [evidence/verification-focused.txt](evidence/verification-focused.txt). Reprodukce používá existující prohlížeč Orcy a [verify.py](verify.py), nic neinstaluje:

```sh
python3 docs/changes/desktop-redesign-2026-09-23/variants/astra/verify.py 8151c6ff-05fe-4f2c-8390-af768da9c110
python3 docs/changes/desktop-redesign-2026-09-23/variants/astra/verify-focused.py 8151c6ff-05fe-4f2c-8390-af768da9c110
```

Základní kontrola proběhla před závěrečnou opravou chybné značky `option` pro Studio Sever a doplněním simulace automatiky. Cílená kontrola následně znovu ověřuje a snímá oba opravené výběry ve třech tématech, kontroluje zachování starých položek při automatice a pokouší se ověřit Enter; po jeho selhání se skript zastavil, takže Escape už neproběhl. Nejde o přebarvení či odstranění brány.

Skript otevírá query URL ve skutečném browseru, nastaví viewport, kontroluje horizontální přetečení, font, dostupnost hlavní akce, klikací tok i whitelist zpráv. Ukládá 30 snímků základních stavů plus poruchu zvuku a potvrzení koše. Kontrola postMessage je syntetická událost se skutečným `window.parent`; integrování do sjednoceného iframe koordinátora je samostatné ověření.

🧪 Základní skript: **67 PASS, exit 0**, včetně 30 kombinací scénář/téma. Cílený skript: **23 PASS** pro firmy a automatiku; následně **FAIL klávesového Enter, exit 1** (FAIL je v doslovném logu zopakován také zachycenou výjimkou). ⚠️ Orca vrací `pressed: Enter`, ale stránka hlásí `document.hasFocus() === false` a její listener nezaznamenal žádný `keydown`; totéž po přepnutí tabu a alternativním `press Enter`. Doslovný [diagnostický výstup](evidence/keyboard-tool-diagnostic.txt) zůstává zachovaný. ⛔ Klávesové Enter/Escape a VoiceOver proto nejsou tímto během ověřené; tvrzení o chybě aplikace z tohoto pokusu nelze odvodit. Sada nebyla oslabena, přeskočena ani přebarvena na zelenou. `node --check` skončil 0, viz [výpis](evidence/syntax-check.txt).

Vizuálně byly zkontrolované skutečné browserové snímky panelu, blokace firmy, přehledu, Nastavení, detailu a identity napříč všemi třemi tématy. Browserové kontroly a vizuální kontrola lokálního HTML jsou oddělené od produktu. ⛔ Žádné skutečné audio, upload, přihlášení, notarizovaný build, Dock/menu bar macOS ani produkční nasazení tímto během ověřeny nejsou. Nebyly spuštěny `ui-smoke` ani `audio-smoke`. Uživatelské testování neproběhlo.
