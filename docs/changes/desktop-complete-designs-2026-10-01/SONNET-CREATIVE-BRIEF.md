# Sonnet 5.5: dva skutečně nové návrhy celé LuDone Desktop

## Zadání od Dana

Dan chce víc kreativity, moderní minimalistickou macOS aplikaci, která se dobře čte a působí promyšleně jako produkt Apple / Plaud / Notion. Předchozí dva návrhy D/E byly moc podobné: oba stejné vertikální pořadí velký čas → waveform → zdroje → tlačítko → poslední schůzky. CSS-only zadání je svazovalo. Tentokrát máš volnost přestavět prezentační DOM a odhalování voleb. Navrhni další dva celé směry F/G, různé i bez barvy a fontu. Názvy si vyber sám. Nechceme jen dvě nová témata.

**Pouze makety k výběru, žádná produkční implementace ani release.** Nahrávání je v horní liště: spuštění, průběh, zastavení, název, firma/přístup, odeslat/nechat. Panel lze zavřít a znovu otevřít bez zastavení. Hlavní okno se otvírá pouze pro detail nahrávky. Historie/fronta/nastavení/aktualizace/onboarding jsou v popoveru. LuTrack jen malý neaktivní řádek Připravujeme.

## Nejdřív přemýšlej, pak tvoř

1. Čti AGENTS.md → ROZHODNUTI.md → PLAN.md → DAN-TODO.md. Potom BRIEF.md, REFERENCES.md a skutečný skill frontend-design na cestě uvedené v REFERENCES.md. Aktuální zadání Dana má přednost před starým vizuálním stylem.
2. Vymysli 6 odlišných kompozic / interaction modelů, v poznámkách v jedné větě vysvětli každý. Vyber dvě nejodlišnější a vysvětli, proč nejsou D/E s novými barvami. Drž se existujících funkcí.
3. Před stavbou napiš SONNET-CREATIVE-PLAN.md: princip, 4–6 pojmenovaných hex tokenů, typografie, rozměry panel/detail, ASCII kompozice ready / recording / draft / history / detail; odlišnosti i v nastavení/frontě. Proveď vlastní kritiku proti kritériím níže a oprav slabý plán před implementací.
4. Vytvoř dva kompletní směry, nikoli jen home screen. Systémové SF / -apple-system písmo je záměrný nativní výběr. Základ textu 15–16 px, názvy čitelné; drobná metadata pouze sekundární. Méně textu, progresivní odhalování, konkrétní akce. Není třeba bitmapových dekorací. Inspiruj se principy z referencí, ne jejich marketingem.

## Povolené soubory a izolace

V tomto worktree jsi jediný zapisovatel. Zapisuj pouze do:
- design/sonnet-f.css, design/sonnet-g.css
- design/sonnet-f-layout.js, design/sonnet-g-layout.js
- SONNET-CREATIVE-PLAN.md, SONNET-CREATIVE-NOTES.md
Vše relativně k docs/changes/desktop-complete-designs-2026-10-01/.
Žádné změny app.js, base.css, menu.css, menu-integration.css ani starých A–E. Žádný src/, backend, release, cizí kořenový design/, Git operace, síť, instalace, tajemství, admin. Máš jen Read/Write/Edit. Browser QA udělá koordinátor; nevydávej neprovedené ověření za důkaz.

## Prezentační API – můžeš skutečně změnit strukturu

Čti nynější design/app.js, base.css, menu.css a menu-integration.css. Obsah všech stavů již existuje. Koordinátor načte tvůj CSS **jako poslední** a tvůj layout skript pro daný směr. Na konci každého renderu zavolá:

```
window.applyLuDoneLayout?.()
```

Každý z tvých layout skriptů nastaví `window.applyLuDoneLayout = function () { ... }`. Skript se načte po spuštění hlavního app.js; po načtení koordinátor znovu zavolá render. Hook musí být idempotentní pro trvalé elementy a opakovatelný pro obsah (content.innerHTML se při renderu nahradí). Kořen body má data-concept=f/g, data-page=home/library/detail/queue/settings/updates/onboarding, data-phase=idle/recording/finalizing/draft, data-surface=tray/window. Žádný přímý zápis do state, žádné přepisování rendererů či akcí.

Můžeš:
- přesunout existující DOM uzly do nových wrapperů, změnit kompozici, rozdělit dlouhé formuláře do logických `<details>`;
- přesunout navigaci z patičky do jiného místa, přidat vizuální ovladače které používají stávající data-action / data-page;
- změnit prezentační copy u vybraných titulků (ne bezpečnostní význam), zkrátit opakovaný vysvětlující text při zachování dostupnosti v disclosure;
- doplnit čistě lokální prezentační listener (přepínání vlastního disclosure/panelu), tak aby se neduplikoval při renderu.

Musíš zachovat `.workspace`, `.content`, `.workspace-head`, `.global-notice`, `.window`, `.menu-popover`, `.menu-popover-body`, `.menubar-trigger`, `.menu-live-status` a jejich původní referenci: app.js je hledá. `.workspace` se mezi popoverem/detailem přesouvá, neduplikuj ji. Zachovej původní ID a data-field všech formulářových elementů. Akce se delegují přes data-action. Neodstraň kontrolu disabled, aria-label, potvrzovací dialogy ani chyby. Právě jeden živý formulář, žádné klonování aktivních tlačítek/inputs. Pro nový ikonový button stačí atribut aria-label + title; odkrytí historie/nastavení musí být zjevné i bez klávesnice.

Definuj --popover-width a --window-width/height na body[data-concept=f/g], rozsah a změna šířky pro podstránky povoleny (kompaktní po spuštění, širší podle účelu). Panel pořád ukotven pod LuDone, žádný dashboard místo panelu. V 400 px viewportu nesmí být vodorovné přetečení. Container queries dle panelu, ne jen browser viewport. Detail může mít vlastní proporce – ne další kopie dokumentu D či pravého inspectoru E.

## Rozsah funkcí (vše zachovat a zpřístupnit)

- Připraveno / nahrávání obou kanálů / výpadek / explicitní jen mikrofon. Stop vidět okamžitě. Výpadek systému a neúplný zvuk nesmí zmizet.
- Po schůzce název, konkrétní firma, přístup (default firemní), dvě volby Uložit a odeslat / Nechat na Macu. Ani jednu neskrýt. Firma ani převzetí nic samo neodesílá.
- Historie ~6 měsíců: hledání, 7/30/180/vše i vlastní období, statusové filtry, stránkování, detail. Dan nechce půl roku scrollovat.
- Detail Mac vs server, zvuk, firma/přístup, odeslat, retry, ověřit skutečný stav, web, Finder, bezpečný místní koš. Bez smazání serveru či lokálního přepisu/analýzy. Zamčená metadata po zahájení uploadu nesmí jít měnit. Neověřeno není ověřeno. Explicitní převzetí vlastníka oddělené od send.
- Fronta: offline, expirace přihlášení, limit serveru, chybějící soubor, neúplný zvuk, nejasný stav. Výsledek neúspěchu s akcí, žádné falešné zelené success.
- Nastavení všech 5 částí: účet + uložená výchozí firma + auto pouze nové + pokročilé prostředí; zvuk + zkouška + potvrzení kanálů poslechem; zařízení + Dock + autostart + témata + zkratky; ukládání + retence; diagnostika.
- Onboarding 5 kroků, login simulace prohlížeč/kopie/návrat, nedokončené nastavení, chyby firm.
- Aktualizace kontrola/download/install/defer, ruční instalace až po zastavení a uložení. Menu / klávesové akce / zavírací guardy.
- Světlé/profesionální/tmavé, dlouhé názvy, úzký panel, focus, přístupné cíle min32 px.

## Kritéria kreativního review

1. Směry jsou odlišné kompozicí i v grayscale. Barva, zaoblení a font nejsou důkaz rozdílu.
2. Ne oba stejná svislá hromada čas/wave/action/recent. Každý jiný dominantní prvek, hustota a délka pohledu.
3. Ne oba čtyři stejné trvalé spodní taby. Navigace však nesmí být neobjevitelná.
4. Idle / recording / draft slouží jinému účelu; žádný obří nulový čas bez významu.
5. Po schůzce různý způsob uspořádání rozhodnutí; primární/sekundární akce jasné, firma/privacy skutečně přístupné před uploadem.
6. Historie odlišná organizace při zachování všech filtrů, období a stránkování.
7. Detail jiný kompoziční princip; funkční akce vztahovat ke konkrétním stavům.
8. Koncept se promítne do settings/queue/onboarding/errors. Není to pouze pole CSS.

Žádné dekorativní glassmorphism všude, plovoucí obří pill nav, hero gradient, falešné waveform jako hlavní kreativita, titěrný text, AI reklamní copy ani generický SaaS layout. Odvaha v jednom jasném nápadu, zbytek tichý a praktický.

## Předání

SONNET-CREATIVE-NOTES.md: finální názvy, proč to funguje, průchod ready→record→save→detail, postup k nastavení a historii, seznam skutečně vytvořených souborů a přiznané limity. Dokonči 2 CSS + 2 JS + plán + poznámky. Celkem 6 vlastních souborů. Nekonči u plánu.
