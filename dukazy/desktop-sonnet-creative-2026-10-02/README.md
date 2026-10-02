# Dva kreativní návrhy F/G, 2. 10. 2026

## Výsledek a autorství

F Osa a G Příkaz napsal skutečný Claude Sonnet 5.5 ve dvou průchodech. Metadata uchovávají canonicalModel, délku běhu, cenu podle ceníku CLI a SHA-256 přesných autorských souborů. První průchod 504 s a 1,347179 USD; druhý 178 s a 0,7339556 USD. Částky jsou modelové metadata podle ceníku, nikoli potvrzené účtování předplatného.

První běh nemohl přečíst skill mimo workspace a nepřečetl celé povinné dokumenty. Koordinátor už pravidla a aktuální brief četl; pro druhý běh vložil plný oficiální frontend-design skill dovnitř worktree. Sonnet ho přečetl a opravil návrhy. Povinná dlouhá čtení ani ve druhém běhu nedokončil; tento limit je doslovně uchovaný v jeho review. Rozsah a rozhodnutí převzal a zkontroloval koordinátor: jen makety, žádný src/, backend, cizí design/, testová brána nebo vydání.

`autorske-soubory/` obsahují doslovný první výstup, `autorske-soubory-po-review/` druhý. Používané čtyři CSS/JS v návrhu odpovídají druhému výstupu. Codex integrace je samostatná: načítání hooku, porovnání, souhrn obrazovek, správný fokus hledání a `creative-integration.css`. Ten u G odstraní duplicitní text a rozšíří draft na 480 px, aby firma i přístup byly vidět v přirozeném panelu. U F srovná formulář v detailu.

## Důkazy

- 🧪 `prokliky.json`: 287 zaznamenaných kontrol, 285 PASS a dva historické FAIL. Jeden odhalil kurzor na začátku hledání; oprava a kontrola psaní po znacích jsou PASS. Druhý byl nedokončený postup testu, který nepotvrdil simulovaná oprávnění; správně zůstal zablokovaný pokračovací krok. Oba celé opakované průchody jsou PASS. Staré výsledky nejsou smazané.
- 🧪 Finální kontrola 138 obrazovek ve vlastních proporcích: 23 situací × 2 návrhy × 3 témata, bez přetékání či duplicitních formulářových ID. Po drobných úpravách draftu a zarovnání následovaly cílené kontroly změněných formulářů.
- 🧪 Finální malá šířka: 24 kontrol při 400/640 px a další dvě cílené po poslední úpravě. Dřívějších 32 kontrol zůstává v záznamu.
- 🧪 Funkční prokliky: nahrávání/zavření panelu/stop/místní uložení/detail; výchozí firma, automatické odeslání nové schůzky a zámek; historie, půl roku, stránkování, hledání po znacích a vlastní rozsah; pět nastavení; explicitní převzetí; ověření serveru a potvrzení místního koše; pět kroků onboardingu včetně simulovaného loginu a testu; stop v historii; instalace čekající na stop a uložení.
- 🧪 22 skutečných snímků v [previews](../../docs/changes/desktop-complete-designs-2026-10-01/design/previews/), seznam v `snimky.json`. Starších 55 snímků A–E zůstává; galerie má 77 snímků. Screenshot porovnání je `porovnani.jpg`.
- 🧪 Syntaxe a kontrola diffu: doslovný výstup a exit kódy v `kontroly.txt`.

⛔ Není to E2E nainstalované aplikace. Všechen zvuk, síť, login, upload, oprávnění, Finder, koš a instalace jsou simulované. VoiceOver ani skutečná zvuková cesta nejsou tímto během ověřené.

🟡 Návrhy čekají na Danův výběr a schválení. Produkční změny ani vydání neproběhly.
