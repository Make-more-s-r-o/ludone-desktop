# Poznámky F/G: Osa a Příkaz

Autor: Sonnet 5.5, 2. 10. 2026. Jen makety k výběru.

## Stav ověření

- ⛔ **Nic jsem nespustil v prohlížeči.** Měl jsem jen Read/Write/Edit. Rozložení, kontejnerové dotazy, kontrast a 400 px viewport jsou napsané podle čtení app.js a CSS a čekají na QA koordinátora.
- ⚠️ **Skill frontend-design jsem nepřečetl.** Leží v `~/.claude/plugins/...` mimo povolený adresář a Read tam vrátil chybu. Postupoval jsem podle shrnutí v REFERENCES.md: jedna výrazná myšlenka na směr, zbytek tichý, žádné generické karty ani hero gradient. Zkontrolujte to proti skutečnému skillu.
- ⚠️ **Z AGENTS.md → ROZHODNUTI.md → PLAN.md → DAN-TODO.md jsem četl AGENTS.md a prvních 90 řádků ROZHODNUTI.md.** PLAN.md a DAN-TODO.md ne. ROZHODNUTI A14 (směr „ne nativní macOS") jsem podle briefu přepsal aktuálním zadáním: systémové SF písmo.
- Reference jsem prohlédl. Z Screen Studia beru jednu pracovní plochu a nástroje oddělené od obsahu (dok v G). Z Granoly beru čitelné prosté plátno. Nepřebral jsem jejich barvy, přechody ani funkce.

## Názvy a proč fungují

### F · Osa
- **Myšlenka:** celý panel je páska dne. Svislá linka s uzly nese nahrávání, schůzky, historii, frontu i kroky onboardingu.
- **Navigace:** levá ikonová lišta, ne spodní taby. Nahrávání ukazuje červenou tečku, Odesílání počet čekajících.
- **Idle:** žádný čas ani vlna. Je to uzel „Připraveno", dva kanály pod sebou a tlačítko Nahrávat.
- **Detail:** dvě stanice na vodorovné lince (Na Macu → V LuDone). Tlačítka z postranního panelu se přesouvají ke stanici, které se týkají.
- **Rozměry:** panel 420 px (historie 460, onboarding 440), detail 860 × 580.

### G · Příkaz
- **Myšlenka:** panel se otevírá jako příkazový řádek. Jedna široká akce „Nahrávat schůzku ⌘⇧R" a pod ní výsledky.
- **Navigace:** žádná trvalá lišta. Titulek stránky se rozbalí do seznamu pěti částí. Když něco čeká ve frontě, titulek to ukazuje.
- **Idle:** řádek, jedna věta o zdrojích, nedávné schůzky.
- **Detail:** plátno s větou o stavu a spodním dokem. Dok je jedna řada akcí, Koš je odsunutý doprava.
- **Rozměry:** panel 380 px (po schůzce 400, fronta 520, historie a nastavení 640), detail 700 × 540.

Proč to nejsou D/E v nových barvách: liší se strukturou DOM a pořadím, ne tokeny. F nemá nahoře čas a G nemá spodní lištu. Rozdíl by zůstal i v grayscale.

## Průchod ready → record → save → detail

**F**
1. Ready: uzel „Připraveno k nahrávání", kanály pod sebou, červené Nahrávat.
2. Record: uzel je červený a pulzuje, pod ním je čas v SF Mono. Zastavit je hned pod ním. Výpadek zvuku a režim jen mikrofon zůstávají jako upozornění s barevnou boční linkou.
3. Save: formulář je po lince (Název, Firma, Přístup). Dole jsou pevně dvě akce pod sebou: Uložit a odeslat (vyplněné), Nechat na Macu (obrys).
4. Detail: historie → řádek → okno 860 × 580 s pipeline.

**G**
1. Ready: příkazový řádek a seznam.
2. Record: řádek se změní na červený rámeček s časem vpravo a velkým Zastavit.
3. Save: dvě velké volby jsou úplně nahoře a formulář pod nimi. Firma a přístup jsou vedle sebe, nic se neodesílá samo.
4. Detail: okno 700 × 540, dok dole.

## Historie a nastavení

- **Historie F:** hledání plus období nahoře, stavové filtry pod ním, dny jako uzly. Stránkování 7 na stránku zůstává. Vlastní období otevírá existující dialog.
- **Historie G:** při šířce panelu nad 540 px vlevo fazety (Období, Stav, počet, vlastní období), vpravo hledání, seznam a stránkování. Pod 540 px se fazety složí do řádku nad výsledky.
- **Nastavení F:** akordeon. Pět řádků pod sebou, aktivní se rozbalí pod svůj řádek. Pokročilé prostředí zůstává v `<details>` z app.js.
- **Nastavení G:** dvě pole. Vlevo seznam pěti částí, vpravo obsah.
- **Odkud se tam dostanu:** F má ikonu Nastavení v levé liště a ikonu v hlavičce (Další možnosti). G má titulek → Nastavení.

## Co hook dělá

`window.applyLuDoneLayout` jen přesouvá existující uzly a doplňuje trvalé prvky (F lišta, G rozbalovací titulek). Nic nepíše do state a nekopíruje žádné ovládací prvky.

| Soubor | Co dělá |
|---|---|
| `sonnet-f-layout.js` | Vytvoří levou lištu jednou a při každém renderu aktualizuje `aria-current` a počet ve frontě. Přesune obsah aktivní části nastavení pod její řádek. Přesune tlačítka detailu ke stanici. Označí řádky fronty barvou výsledku. |
| `sonnet-g-layout.js` | Vytvoří rozbalovací titulek jednou (listener se váže jednou, hlídá ho `window.__luDoneGMenuBound`). Přesune filtry historie do fazet. Označí řádky fronty barvou výsledku. |

Hook předpokládá klasický skript. Při čtení `state` a `icon` používá globální deklarace z app.js a kontroluje `typeof`, takže bez nich nespadne.

## Vytvořené soubory

Vše v `docs/changes/desktop-complete-designs-2026-10-01/`:
- `design/sonnet-f.css`, `design/sonnet-f-layout.js`
- `design/sonnet-g.css`, `design/sonnet-g-layout.js`
- `SONNET-CREATIVE-PLAN.md`, `SONNET-CREATIVE-NOTES.md`

Nic jiného jsem nezměnil. Žádné Git operace.

## Co musí udělat koordinátor

- Do `app.js` doplnit `f` a `g` do `concepts`. Nesmím jej měnit.
- Načíst `sonnet-f.css` / `sonnet-g.css` poslední a příslušný layout skript po app.js, potom znovu zavolat render.

## Přiznané limity

1. **Neověřeno v prohlížeči.** Je to hlavní riziko, viz výše. Nejpravděpodobnější chyby jsou specificita proti `menu.css` a `menu-integration.css`, pozice uzlů na lince (ladil jsem je výpočtem) a výška popoveru při přepnutí šířky.
2. **Tlačítka v detailu F** se přesouvají podle `data-action` (`finder`, `trash` → Mac, ostatní → LuDone). Pokud app.js přidá novou akci, spadne k LuDone.
3. **Barvu uzlů a stavových bodů** určuje CSS z už vykresleného stavu (`:has(.badge.sent)` atd.) a ve frontě JS podle textu. Změní-li se copy ve frontě, regulární výrazy v `tones()` se musí upravit.
4. **G záměrně zobrazuje dvě stavy ve stejném textu** (stavový bod i štítek), protože štítek je zdroj pravdy z app.js. Barva sama nic nenese, text říká všechno.
5. **Klávesová nápověda `⌘⇧R` a `⌃⌥R`** v G je jen CSS text a odpovídá seznamu zkratek v app.js. Skutečné zkratky se v maketě neměnily.
6. **Posun hlavičky v G:** `.menu-popover-header` je absolutně přes řádek titulku, aby v panelu nebyly dva řádky. Pokud by se hlavička v app.js změnila, překryje se s titulkem.
7. **Tmavé a profesionální téma** je navržené, ale pro oba směry nevidím výsledek. Zvlášť kontrast akcentu v tmavé variantě G (světlý akcent s tmavým textem).
8. **Detail v 400 px viewportu:** řeší se jen kontejnerovými dotazy na okno. Ověřit.
9. **Onboarding v F** potřebuje vyzkoušet při všech pěti krocích. Svislá linka je napsaná pro 12 grid řádků a při delším obsahu může být pod ním volné místo.
10. **Poslední schůzky:** neparsuji čas z textu řádku, takže F nemá v rail sloupci časy. To je kompromis pro méně kódu.
