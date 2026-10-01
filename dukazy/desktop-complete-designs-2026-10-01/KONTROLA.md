# Kontrola tří úplných návrhů — 1. 10. 2026

## Stav a rozsah

🧪 Pouze samostatné HTML makety: 57 kontrol scénářů (19 × A/B/C), 102 ověřených kroků hlavních průchodů, 30 kontrol šířky 640/400. Výsledky v `scenarios.json`, `actions.json`, `responsive.json`; snímky skutečně vykreslených maket jsou vedle tohoto souboru. Nejde o E2E nainstalované Electron aplikace.

⛔ Skutečné zvukové cesty, OAuth, produkční upload, aktualizace, Finder/koš a oprávnění macOS se v tomto běhu neprováděly. Žádná backendová změna ani vydání.

🟡 Dan má vybrat a schválit nový design. Před schválením neměnit produkční aplikaci.

## Proklikané průchody

Ve všech třech: hledání v půlroční historii, stránkování, prázdný filtr; změna firmy blokuje upload do uložení; explicitní souhlas zamkne metadata; převzetí pouze přiřadí vlastníka; ověření odemkne web; místní koš zachová webový záznam; výchozí firma zůstane při návratu; první použití, prohlížeč, oprávnění a potvrzení slyšených kanálů; aktualizace čeká na dokončení a uložení; rychlé akce; všechny sekce nastavení; export diagnostiky; neplatné a platné vlastní období; automatika pouze nové nahrávky; režim jen mikrofon je označený jako omezený.

## Review a opravy

Nezávislý Sol read-only review identifikoval šest chyb ve společné simulaci. Opraveno: dokončení odložené aktualizace, opakování při serverovém „nenalezeno“, zachování webové historie po místním koši, zámek metadat selhaného uploadu, kontrola účtu při převzetí a zobrazení chybějících/neúplných souborů ve frontě. Hlavní průchody byly poté proklikány.

První kontrola 400 px našla tři přetečení: filtry A/C a minimální šířku home gridu B. Doslovný původní výsledek je v `responsive-before-fix.json`; byly opraveny styly, ne měřidlo. Následná kontrola všech 30 náhledů nemá přetečení. Tmavé téma zpočátku přebarvilo značku do bílé plochy; odstraněn nevhodný filtr a snímky obnoveny.

## Příkazy

Doslovný záznam syntaxe a kontroly diffu s exit kódem: `syntax.log`. Produkční testy ani brány nebyly změněny. Celé produkční testy se nespouštěly pro samostatné návrhy bez změny aplikace; jejich úspěch by tyto HTML návrhy neověřil.

Dva autoři vzhledu pracovali v oddělených worktrees (Mac, Studio), root vlastnil společný renderer, Deník, integraci a browser kontrolu. Cizí design/worktrees nebyly upraveny. Všechna data ve snímcích jsou fiktivní.
