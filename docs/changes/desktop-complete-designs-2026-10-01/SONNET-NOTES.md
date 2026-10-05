# Sonnet 5.5 — dva návrhy menu bar aplikace (2. 10. 2026)

Autor: Sonnet 5.5. Soubory: `design/sonnet-d.css`, `design/sonnet-e.css` (v tomto adresáři změny). Jde jen o styly; renderer, `base.css`, produkční kód ani cizí `design/` v kořeni jsem neměnil.

⛔ **Neověřeno v prohlížeči.** Neměl jsem Bash ani browser, takže jsem styly pouze napsal a přečetl. Vzhled, přetečení v 400 px ani chování nestingu jsem nezkoušel. Tomu odpovídá i seznam limitů níže.

## D — „Sloupec“

Jeden úzký grafitový sloupec bez rámečků. Hierarchii nesou typografie a vlásečnice, ne plochy.

- **Panel:** 360 × max. 660 px. Obrovský světlý čas vlevo (64 px), tenká vlnka, červené tlačítko přes celou šířku. Nedávné schůzky jsou text s vlásečnicemi, bez ikon. Spodní lišta záložek (ikona nad popiskem) má čtyři tlačítka. Po schůzce se akce přilepí dole přes celou šířku.
- **Nastavení:** podtržené záložky nahoře, řádky bez karet.
- **Detail:** tichý dokument 760 × 820 px. Navigace je ikonová lišta o šířce 62 px. Obsah je sloupec max. 640 px: nadpis, stav Mac / LuDone v řadě s vlásečnicí, **akce hned pod stavem**, pak formulář a technické údaje.
- **Barva:** grafit jako akcent (tlačítka černá, v tmavém tématu světlá), červená jen pro nahrávání.

## E — „Kapsle“

Širší, měkký a průsvitný. Zaoblené plochy bez rámečků, zelenomodrý akcent.

- **Panel:** 420 px, pro historii, odesílání, nastavení a aktualizace se přes `body[data-page]` rozšíří na 480 px. Rádius 22 px, vibrancy. Vše na střed: čip stavu, čas 60 px, vlnka v měkké kartě, kulaté červené tlačítko. Nedávné schůzky jsou jedna zaoblená skupina s kulatými ikonami. Navigace je plovoucí přepínač (ikona + popisek) dole. Po schůzce jsou dvě akce vedle sebe, primární je kulatá.
- **Nastavení:** sekce jako pilulky, skupiny jako měkké karty.
- **Detail:** široké okno 1040 × 640 px. Navigace je vodorovná nahoře. Vlevo obsah, vpravo **inspektor akcí** (300 px, přilepený nahoře). Stav LuDone je zvýrazněný tónem akcentu.

## Proč se liší

| | D Sloupec | E Kapsle |
|---|---|---|
| Panel | 360 px, zarovnání vlevo, text a vlásečnice | 420–480 px, střed, měkké plochy |
| Záznam | tlačítko přes šířku, velký lehký čas | kulaté tlačítko, čip stavu |
| Navigace panelu | spodní záložky (ikona nad popiskem) | plovoucí pilulka |
| Detail | úzký svislý dokument, akce uprostřed toku | široké okno, boční inspektor |
| Navigace okna | ikonová lišta vlevo | horizontální lišta nahoře |
| Akcent | grafit | zelenomodrá |

## Průchod: nahrávání → rozhodnutí → detail

1. Klik na ikonu v liště otevře panel. D: čas vlevo a široké červené tlačítko. E: čip „Připraveno“ a kulaté tlačítko.
2. Po spuštění se zobrazí běžící čas a vlnka. Zdroje jsou pod nimi a výpadek kanálu je `.notice` nad tlačítkem. Panel lze zavřít a znovu otevřít, nahrávání pokračuje (řeší root).
3. Zastavení → „Po schůzce“ v tomtéž panelu: název, firma, přístup a dole **Uložit a odeslat / Nechat na Macu**. D je skládá pod sebe, E vedle sebe. Obě akce jsou přilepené ke spodku panelu.
4. Pro detail se v seznamu Nahrávky klikne na řádek. Root přepne `data-surface=window` a otevře `.window`, panel se skryje.

## DOM a UX limity (zjištěno čtením, neověřeno spuštěním)

- Adresář: zdroje `design/` jsou v `docs/changes/desktop-complete-designs-2026-10-01/design/`; v kořeni worktree žádné `design/` není. Soubory proto leží vedle `base.css` a `app.js`.
- Aktuální `app.js` ještě nemá menu DOM (`.menubar-scene`, `.menu-popover` …). Styly jsou psané podle briefu, takže přesné vnitřní značky (`.menu-brand`, tlačítka v `.menubar-trigger`, `.active` / `aria-current` na patičce) je nutné po integraci porovnat.
- Skrývání: `data-surface=window` skryje panel a `data-surface=tray` skryje `.desktop-stage`. Když chce root při otevřeném detailu panel znovu ukázat, musí to přepsat nebo změnit atribut. Chybí-li `data-surface`, je výchozí tray.
- Stav „nahrává se“ v liště stylizuji jen přes spekulativní třídu `.recording` / `.is-recording` na `.menubar-trigger`. Pokud root použije jiný název, červené zvýraznění se neukáže.
- Na stránce `home` skrývám `.menu-page-head`, protože nadpis „Nahrávání“ v panelu jen zabírá místo. Tlačítko „Zdroje“ z hlavičky tím mizí, zůstává „Zkouška zvuku“ v rekordéru.
- D v panelu skrývá `.row-icon` a šipky v řádcích. Nahrávky pak odliší jen odznak stavu. V kontejneru užším než 340 px mizí i odznak a stav je vidět až v detailu.
- E zobrazuje `.row-icon` jako akcentový kruh. V seznamech je stejný pro všechny stavy, takže stav nese opět jen odznak.
- Akce po schůzce jsou `position:sticky` v rodiči, který má vlastní padding. Přesné doléhání ke spodku je třeba vidět v prohlížeči.
- D mění pořadí detailu v okně přes `display:contents` na `.detail-main`. Pořadí závisí na DOM rendereru (hero, notice, `.status-pair`, aside). Nový blok na této úrovni by skončil na konci.
- Používám CSS nesting a `color-mix()` (Safari 17.2+, Chrome 120+). Starší prohlížeče styl neaplikují.
- Světlé / profesionální / tmavé téma je dopsané pro `body[data-concept=…]` tokeny. Tmavé téma jsem neprohlížel.
- Preview bar (`.preview-bar`) a kořenový `embedded` režim nestyluji; běží na stylech rootu.
