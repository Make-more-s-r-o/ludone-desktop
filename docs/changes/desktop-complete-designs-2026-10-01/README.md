# Tři kompletní minimalistické návrhy LuDone Desktop

Dan 1. 10. upřesnil: tři odlišné designy celé aplikace, každý se zachováním všech funkcí; implementaci zahájit až po výslovném schválení. Tento běh připravuje pouze HTML makety. Původní částečné návrhy jsou zachované v `../desktop-clarity-2026-10-01/`.

- A — Mac: postranní navigace, systémové ovladače, seskupené nastavení.
- B — Studio: horní navigace, otevřená pracovní plocha, měkký fialový akcent.
- C — Deník: úzká navigace, teplý povrch, otevřené seznamy, větší typografie.

[Porovnání](design/index.html) · [Všechny obrazovky](design/gallery.html) · [Funkční rozsah](design/coverage.html) · [Brief a zdroje](BRIEF.md)

## Jak proklikávat

Otevři `design/index.html` v prohlížeči a vyber návrh. Každá maketa má stejné příklady a všechny funkční oblasti. Horní přepínač situací a tématu patří porovnání, nikoli budoucí aplikaci. Reset vrátí fiktivní data. Paměťová simulace se po načtení obnoví; není perzistentní produkční frontou.

Pro místní server z této složky lze spustit `python3 -m http.server 53302 --bind 127.0.0.1 --directory design`. Otevři `http://127.0.0.1:53302/`. Soubory fungují i přímo z disku bez sestavení aplikace.

## Rozsah a rozdíly proti současné aplikaci

Inventář odvozený z aktuálních komponent je v briefu. Přibylo navržené hledání, výběr období, stránkování, sjednocené okno a jasnější navigace. Firma a přístup, consent, zamčené zahájené uploady, samostatné převzetí, ověření serveru, bezpečný místní koš, zvuková zkouška, účet, retence, Dock, spuštění, diagnostika, updater, lišta a rychlé akce zůstávají dostupné ve všech variantách. LuTrack není připojený ani aktivní.

Systémová typografie reaguje na Danův požadavek na macOS a čitelnost. Značka LuDone zůstává. Toto není canonical preview webového DS ani SwiftUI implementace. HTML vykresluje jedinou ukázku okna; skutečné systémové ovladače řeší až schválená implementace.

## Ověření

🧪 Syntaxe JavaScriptu, 57 scénářů, 102 kontrol hlavních průchodů a kontrola rozložení 30 úzkých náhledů (640/400 px). Důkazy: `../../../dukazy/desktop-complete-designs-2026-10-01/`.

⛔ Skutečné nahrávání, OAuth, síťový upload, oprávnění macOS, Finder/koš, export diagnostiky a instalace se zde neověřují; všechny tyto akce jsou makety. HTML prokliky nejsou E2E nainstalované aplikace. Produkční `src/`, Electron, testy, brány, backend, cizí `design/` a release workflow nebyly změněny. Nové vydání nevzniklo.

🟡 Výběr a schválení návrhu čekají na Dana. Bez schválení nezačínat implementaci.
