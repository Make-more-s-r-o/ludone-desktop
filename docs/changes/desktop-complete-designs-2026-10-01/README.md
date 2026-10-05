# Sedm kompletních návrhů LuDone Desktop z horní lišty

**5. 10. 2026 — aktuální:** Dan vybral **F Osa** a upřesnil hlavně ikony **horní systémové lišty**. [Nový přehled deseti stavů](design/f-tray.html), [kontrakt](F-TRAY-KONTRAKT.md), [celé implementační zadání](IMPLEMENTACE-F.md) a [předání s promptem pro Mac mini](PREDANI.md) jsou připravené. Čtecí remote preflight prošel; vývoj ještě není zahájený.

**Předchozí ikonový průchod 5. 10. 2026:** Dan vybral **F Osa**, ikony ještě rozpracovat. [Upravená F](design/viewer.html?variant=f&preview=icons-20261005), [přehled ikon](design/f-icons.html) a [rozsah revize](F-IKONY.md). Kompozice je od Sonnetu, ikonová vrstva od Codexu; původní podoba a ostatní návrhy jsou zachované. 🟡 Ikony čekají na posouzení. Produkce ani vydání se v této etapě nemění; starší výběrové checkpointy níže jsou historické.

Dan 1. 10. požádal o tři odlišné minimalistické návrhy celé aplikace; implementaci zahájit až po schválení. Dne 2. 10. upřesnil nahrávání z horní lišty a další dva návrhy od Sonnetu 5.5. Tento běh upravuje pouze HTML makety s fiktivními daty.

| Návrh | Autor | Panel | Samostatný detail | Směr |
|---|---|---|---|---|
| A Mac | Původní návrh | 400 px | 900 × 650 px | Známé ovladače a modrý akcent |
| B Studio | Původní návrh | 440 px | 1100 × 720 px | Otevřená kompozice a fialový akcent |
| C Deník | Původní návrh | 390 px | 720 × 800 px | Teplý povrch a vzdušná typografie |
| D Sloupec | Sonnet 5.5 | 360 px | 760 × 820 px | Grafit, textové seznamy, svislý dokument |
| E Kapsle | Sonnet 5.5 | 420–480 px | 1040 × 640 px | Průsvitný panel, měkké skupiny, boční inspektor |
| F Osa | Sonnet 5.5 | 420–460 px | 860 × 580 px | Osa schůzek, boční lišta, akce u stanice Mac/LuDone |
| G Příkaz | Sonnet 5.5 | 380–640 px, draft 480 px | 700 × 540 px | Přímá akce, rozbalovací navigace, boční filtry a dok v detailu |

[Nové F/G vedle sebe](design/creative.html) · [Živé návrhy](design/viewer.html?variant=f) · [Porovnání](design/index.html) · [Aktuální galerie](design/menu-gallery.html) · [Funkční rozsah](design/coverage.html) · [Brief](BRIEF.md)

## Jak proklikávat

Otevři `design/viewer.html`. Přepni A–G a v nabídce „Obrazovka“ jednu z 23 obrazovek či situací. Pak klikej přímo v maketě. Každá varianta má vlastní proporce; „Stejná pro porovnání“ je volitelný technický rám. Horní ovladače a popisky autora patří porovnání, nikoli budoucí aplikaci. Přepnutí obnoví fiktivní data. Hodnota výběru obrazovek se při navigaci uvnitř makety nemění.

1. Klikni na ikonu LuDone v horní liště a spusť nahrávání v panelu.
2. Zavři panel: čas v liště pokračuje. Otevři jej znovu a zastav nahrávání.
3. V témže panelu změň název, firmu a přístup; zvol Uložit a odeslat nebo Nechat na Macu.
4. Klikni na konkrétní schůzku: teprve nyní se otevře okno detailu. Červené zavírací tlačítko vrací do panelu.
5. Historie má hledání, období včetně půl roku a vlastního rozsahu, filtry a stránkování. Nastavení a fronta zůstávají v panelu.

Galerie obsahuje 77 snímků, z toho 22 nových F/G; obrázky nejsou ovladače, odkazy „Proklikat“ otevírají živou situaci. Původní galerie 42 snímků je označená jako starší.

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

## Kreativní doplnění F/G — 2. 10. 2026

Dan požádal o dva další kreativnější směry a lepší zadání pro Sonnet. [Nový brief](SONNET-CREATIVE-BRIEF.md) už dovoluje změnit prezentační DOM, navigaci a odhalování voleb při zachování společného funkčního stavu. Sonnet nejprve navrhl šest kompozic a vybral dvě v [plánu](SONNET-CREATIVE-PLAN.md). [Reference](REFERENCES.md): oficiální Raycast, Screen Studio a Granola; oficiální skill Anthropic frontend-design je uchovaný v references/. Nativní systémové písmo respektuje Danovo aktuální zadání.

Autorovy [původní poznámky](SONNET-CREATIVE-NOTES.md) a [druhý průchod](SONNET-CREATIVE-REVIEW.md) zůstávají doslovné v archivu. První poznámky přiznávají nedostupnost skillu mimo workspace. Druhý běh dostal jeho plný obsah, přečetl jej a provedl konkrétní opravy. Staré tvrzení plánu o měsíční ose je překonané: skutečné seskupení je po dnech, po sedmi záznamech na stránku. Oba návrhy používají systémové SF; Osa už nemá monospace čas.

🧪 138 finálních kontrol obrazovek ve třech tématech, funkční prokliky celého běžného toku a cílené kontroly posledních úprav. Archiv [důkazů](../../../dukazy/desktop-sonnet-creative-2026-10-02/README.md) obsahuje původní neúspěšné pokusy i opravu kurzoru v hledání, přesné autorské soubory, metadata, nezávislé review Sol a snímky.

Koordinátor doplnil `creative-integration.css` pro plné znění firmy/přístupu v draftu a srovnané formuláře. Společný renderer nyní při hledání uchovává pozici kurzoru; při změně voleb uchovává fokus. Žádná funkční simulace se nezměnila na skutečný serverový či zvukový přístup.

🟡 Výběr a schválení stále čekají na Dana. ⛔ Makety neověřují produkční aplikaci a nejsou nová verze.
