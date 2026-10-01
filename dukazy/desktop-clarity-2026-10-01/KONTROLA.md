# Kontrola samostatného návrhu — 1. 10. 2026

- 🧪 Syntaxe JavaScriptu: skutečný příkaz a exit kód jsou v `syntax.log`.
- 🧪 Koordinátor otevřel a proklikal maketu v in-app browseru na tomto Macu. Filtry Vše → hledání „dodavatelem“ → Jen na Macu zobrazily 1 odpovídající záznam; detail se otevřel.
- 🧪 Výběr celé historie ukázal 44 ukázkových nahrávek a 5 stránek. Další stránka změnila seznam a čítač na 2 / 5. Hledání nenalezeného názvu ukázalo prázdný výsledek, zrušení filtrů jej obnovilo.
- 🧪 Skok o půl roku zpět zobrazil duben 2026 a 7 ukázkových nahrávek. Výběr září zobrazil září 2026 a 7 nahrávek. Předchozí den bez záznamů měl odpovídající prázdný stav. Escape zavřel výběr měsíce a vrátil fokus tlačítku data.
- 🧪 Změna ukázkové firmy zobrazila Neuložená změna a Uložit; po kliknutí Uloženo. Vzhled přepnul také vnější ovládání tématu. Přepínač zvuku změnil svou hodnotu.
- 🧪 Simulovaný start → stop → Nechat na Macu přidal záznam do paměti makety. Mikrofon, soubor, Finder ani server nebyly aktivovány.
- 🧪 Skutečné DOM měření v renderovaném okně 400 px: základ 15 px, název řádku 16 px, systémové písmo -apple-system, bez vodorovného přetečení okna a obsahu. Snímky zachycují maketové šířky 400 a 630 px. Šířka 740 px byla vizuálně kontrolována při prvním otevření. Nejde o měření fyzického nativního okna ani mobilního viewportu.
- 🟡 Návrh čeká na reakci Dana. Není schválen pro implementaci.
- ⛔ Produkční implementace tohoto návrhu, instalace, nativní titlebar a zvuková/produkční E2E přejímka tímto nejsou ověřené. Stávající aplikace nebyla změněna.

Snímky obsahují pouze fiktivní údaje. Soukromé screenshoty od uživatele do archivu nepatří. Starší agentovy self-checky nejsou náhradou této přejímky.
