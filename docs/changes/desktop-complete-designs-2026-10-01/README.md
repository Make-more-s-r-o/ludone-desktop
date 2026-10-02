# Pět kompletních návrhů LuDone Desktop z horní lišty

Dan 1. 10. požádal o tři odlišné minimalistické návrhy celé aplikace; implementaci zahájit až po schválení. Dne 2. 10. upřesnil nahrávání z horní lišty a další dva návrhy od Sonnetu 5.5. Tento běh upravuje pouze HTML makety s fiktivními daty.

| Návrh | Autor | Panel | Samostatný detail | Směr |
|---|---|---|---|---|
| A Mac | Původní návrh | 400 px | 900 × 650 px | Známé ovladače a modrý akcent |
| B Studio | Původní návrh | 440 px | 1100 × 720 px | Otevřená kompozice a fialový akcent |
| C Deník | Původní návrh | 390 px | 720 × 800 px | Teplý povrch a vzdušná typografie |
| D Sloupec | Sonnet 5.5 | 360 px | 760 × 820 px | Grafit, textové seznamy, svislý dokument |
| E Kapsle | Sonnet 5.5 | 420–480 px | 1040 × 640 px | Průsvitný panel, měkké skupiny, boční inspektor |

[Živé návrhy](design/viewer.html?variant=d) · [Porovnání](design/index.html) · [Aktuální galerie](design/menu-gallery.html) · [Funkční rozsah](design/coverage.html) · [Brief](BRIEF.md)

## Jak proklikávat

Otevři `design/viewer.html`. Přepni A–E a v nabídce „Obrazovka“ jednu z 23 obrazovek či situací. Pak klikej přímo v maketě. Každá varianta má vlastní proporce; „Stejná pro porovnání“ je volitelný technický rám. Horní ovladače a popisky autora patří porovnání, nikoli budoucí aplikaci. Přepnutí obnoví fiktivní data. Hodnota výběru obrazovek se při navigaci uvnitř makety nemění.

1. Klikni na ikonu LuDone v horní liště a spusť nahrávání v panelu.
2. Zavři panel: čas v liště pokračuje. Otevři jej znovu a zastav nahrávání.
3. V témže panelu změň název, firmu a přístup; zvol Uložit a odeslat nebo Nechat na Macu.
4. Klikni na konkrétní schůzku: teprve nyní se otevře okno detailu. Červené zavírací tlačítko vrací do panelu.
5. Historie má hledání, období včetně půl roku a vlastního rozsahu, filtry a stránkování. Nastavení a fronta zůstávají v panelu.

Galerie obsahuje 55 aktuálních snímků; obrázky nejsou ovladače, odkazy „Proklikat“ otevírají živou situaci. Původní galerie 42 snímků je označená jako starší.

## Přístup přes Tailscale

Server podkladů běží jen nad adresářem návrhů: místně `http://127.0.0.1:53302/viewer.html`, přes VPN `http://100.101.162.108:53302/viewer.html`. Dva servery jsou vázané na loopback a konkrétní Tailscale IP; nejde o veřejné vystavení repozitáře. Pro opětovné spuštění z této složky: `python3 -m http.server 53302 --bind 100.101.162.108 --directory design`.

## Autorství a archivace

D/E vznikly v odděleném worktree `desktop-sonnet-concepts` přes Claude Code s `--model claude-sonnet-5-5 --effort medium`. Model měl pouze Read/Write/Edit a rozpočtový strop 3 USD, bez Bash a MCP. [Zadání](SONNET-BRIEF.md), [poznámky autora](SONNET-NOTES.md), doslovné CSS a metadata výsledku jsou archivované. `menu-integration.css` vlastní Codex: řeší skutečný DOM, společný tok, dostupné odznaky stavů a formulář bez překrývání tlačítek. Obě varianty sdílejí funkční renderer, mají vlastní kompozici i proporce.

Původní návrhy A–C před změnou na lištu jsou zachované v commitu `08db89abc15fabf85e908f3a45f284a8185cd8e4`. Částečné starší návrhy zůstávají v `../desktop-clarity-2026-10-01/`.

## Ověření 2. 10. 2026

🧪 Prokliky v prohlížeči: nahrávání, zavření/otevření panelu, zastavení, firma/soukromí, místní uložení a detail ve všech pěti variantách; přímý výběr 115 obrazovek a situací bez vodorovného přetékání. Dalších 60 kontrol při šířkách 400/640 px ověřilo přetékání a dostupnost spodní navigace. V D/E také hledání a stránkování, uložená firma pro novou schůzku, firemní výchozí přístup, zámek voleb po odeslání a samostatné potvrzené převzetí, které nic neodešle. Syntaxe a kontrola diffu jsou zaznamenané v archivu.

Důkazy: `../../../dukazy/desktop-menu-sonnet-2026-10-02/`. Při první kontrole D přetékala navigace nastavení o 18 px; oprava je v integračním CSS a následných 115 kontrol je zelených. Původní kontrola zůstává v záznamu.

⛔ Skutečný zvuk, OAuth, serverový upload, systémová oprávnění, Finder/koš, restart a instalace se v HTML maketě neověřují. Proklik není E2E nainstalované aplikace. Produkční kód, testy, brány, backend a publikační workflow se nezměnily; nové vydání nevzniklo.

🟡 Výběr a schválení návrhu čekají na Dana. Bez schválení nezačínat implementaci. Historické ověření původních maket z 1. 10. je uložené v `../../../dukazy/desktop-complete-designs-2026-10-01/` a není důkazem tohoto nového toku.
