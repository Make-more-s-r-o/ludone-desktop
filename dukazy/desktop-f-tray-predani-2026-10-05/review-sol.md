# Nezávislé čtecí review Sol

5. 10. 2026, Sol s nízkým effortem. Bez zápisů a bez tvrzení o GUI či skutečném zvuku.

## Audit stávající tray autority

Produkce má osm stavů a template obrázky 18/36 px. `signed-out` dnes přebíjí nahrávání; ukládání a rozhodnutí nemají samostatný tray stav. F potřebuje odlišit tyto dvě fáze a zachovat nahrávání při expiraci/offline. Autorita musí zůstat v main procesu: skutečné session, zdroje a finalizace/export stage. Renderer nesmí posílat jméno hotového stavu. Zachovat Quit/update guardy a IPC vlastnictví.

Staré pixelové assertions a Astra E2E mají konkrétní návrhový kontrakt. Pro F přidat úplnou akceptaci, nezměnit stávající brány jen kvůli průchodu; případný přechod nebo výjimku popsat pro lidské rozhodnutí. F nesmí ubrat bezpečnostní nebo funkční podmínky.

## Review nové přípravy

P2: původní prompt napsal, že poslední podoba ikon je schválená, zatímco kontrakt i předání uvádějí čekání. Opraveno: viditelná podmínka použití promptu po posouzení/pokynu začít, odstraněné tvrzení o již uděleném schválení, odkaz na přímé zadání člověka. Samotný soubor neopravňuje zahájení ani vydání.

Další P1/P2 v předložených zdrojích nenalezené. HTML jen čte fiktivní stav a mění prezentaci, pořadí odpovídá kontraktu, originální geometrie značky má jednotné měřítko/posun, SVG a PNG používají stejné tvary a monochromatickou alfa masku. Předání rozlišuje přípravu a neověřenou produkci.

Doplněná síla kontroly podle námětu review: manifest se nyní porovnává s aktuálním souborem značky a SHA-256 zdroje `f-tray.js`; každé SVG se porovnává s aktuální definicí. Hash assetů sám není nezávislý důkaz správné rasterizace ani čitelnosti pro člověka.

## Audit celého F handoffu

Mock má natvrdo účet, firmy, data/velikosti souborů, časovače dokončení a aktualizace; Finder/web/koš/poslech/export diagnostiky pouze simuluje. Současná produkce už má skutečné služby. Implementátor je má zachovat a použít, nikoli převzít simulace. Do zadání zahrnuto: celý shell, reálná historie/období/hledání, všechny položky fronty bez mock limitu devíti, pět sekcí nastavení, autoritativní serverové ověření, trvalý draft a bezpečný update. LuTrack neaktivní.

⛔ Read-only zdrojové review není E2E aplikace ani zvukový důkaz.

Následná čtecí kontrola opravy promptu a validatoru: v těchto opravách nezbývá P1/P2.
