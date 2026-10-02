# Další dva návrhy — Sonnet 5.5, 2. 10. 2026

Dan chce další **dva odlišné minimalistické návrhy celé macOS aplikace**, pak vybere. Zásadní nový pokyn: aplikace žije v horní liště. Spuštění, průběh, zastavení i rozhodnutí „Uložit a odeslat / Nechat na Macu“ probíhají v popoveru z ikony LuDone. Velké okno se otevře pouze pro detail nahrávky. Historie, hledání, období, odesílání a všechny části nastavení jsou dostupné v panelu; nesmějí otevírat hlavní okno automaticky. Žádná implementace produkční aplikace ani vydání.

Použij svou invenci. Nejen jiné barvy existujícího Mac/Studio/Deník. Navrhni dvě výrazně jiné hierarchie, kompozice a proporce menu panelu a detailu. Minimalismus jako macOS / Apple / Plaud: čitelné systémové písmo, málo textu, jednoznačné primární akce, žádné samoúčelné rámečky. Značka je existující `design/LuDone.svg`, monochromatické ikonové pojetí. LuTrack zůstává malý neaktivní řádek.

## Pravidla a zdroje

- Čti `AGENTS.md`, pak `ROZHODNUTI.md`, `PLAN.md`, `DAN-TODO.md` a `docs/changes/desktop-complete-designs-2026-10-01/BRIEF.md`. Aktuální pokyn Dana výše má přednost před starými výtvarnými rozhodnutími.
- Inventář funkcí je v BRIEF.md, ve všech návrzích musí zůstat dostupný. Žádné vymyšlené produkční funkce (AI přepis v desktopu, kalendář, automatická detekce schůzek, aktivní LuTrack).
- Renderer `design/app.js` a `design/base.css` čti pro DOM/akce, **neměň** je; root souběžně doplňuje nový menu tok. Barvy a rozložení všech funkcí můžeš měnit vlastními styly.
- Piš pouze do **`design/sonnet-d.css`, `design/sonnet-e.css`, `SONNET-NOTES.md`**. Žádné jiné změny. Žádné commity, síť, instalace, produkční `src/`, backend, tajemství ani cizí `design/` v kořeni repa. Jeden zapisovatel v tomto worktree.
- Nemáš Bash ani síťové nástroje; použij Read / Write / Edit. Root ověří výsledek v browseru. Pojmenuj směry sám; autor bude v porovnání označen Sonnet 5.5.

## Nový menu DOM připravovaný rootem

Root zachová stávající DOM všech obrazovek z BRIEF.md a doplní toto:

```
.menubar-scene
  .mac-menubar
    .menu-os-brand
    .menubar-trigger (logo LuDone, krátký stav, tlačítko)
  .menu-popover (container-name: app-window, container-type: inline-size)
    .menu-popover-header (.menu-brand, .menu-popover-title, .popover-actions)
    .menu-popover-body
      .menu-notice (stejné .notice jako jinde)
      .menu-page-head (h1, akce, případně Zpět)
      .menu-content (home/draft/history/queue/settings/updates/onboarding ze stejného rendereru)
    .menu-popover-footer (tlačítka Nahrávky, Odesílání, Nastavení, Další)
.desktop-stage > .window (je vidět pouze při detailu)
```

Kořen `body` má `data-concept="d"` / `"e"`, `data-surface="tray"` / `"window"`, `data-page="home"` apod. Menu panel lze zavřít klikem na ikonu a znovu otevřít, nahrávání pokračuje. Větší popover pro historie/nastavení je povolen. Detail používá `.window` a dosavadní `.app-nav`, `.workspace`, `.detail-layout` apod. Téma je `html[data-theme=light|professional|dark]`.

Definuj hlavně `--popover-width`, `--window-width`, `--window-height` na `body[data-concept=d/e]`. Menu je ukotveno pod ikonou, neměň ho na rozlehlý dashboard. Samotný panel musí fungovat i v 400 px náhledu; žádné vodorovné přetečení. Container queries na `.window` / `.menu-popover` řídí skutečnou šířku; nepoužívej browser šířku místo okna. Root společně zabezpečí fungování akcí a uchování stavu při zavření panelu.

Sdílené CSS poskytuje základní flex/grid rozložení, ale vlastní styl musí tvořit soudržný design pro připraveno, nahrávání, po schůzce, historii/hledání/období, detail lokální a serverový, frontu/chyby, všech pět částí nastavení, první použití, aktualizaci, dialogy, potvrzení a tmavé téma. Pokud chceš odlišit stavy či hierarchii, používej `body[data-page=...]` a descendant selektory.

## Předání

Napiš oba kompletní styly a krátké SONNET-NOTES.md: název každého směru, doporučené proporce panelu/detailu, proč se používá jinak než druhý, stručný průchod nahrávání → rozhodnutí → detail. Přidej zjištěné DOM/UX limity, žádné tvrzení o browser ověření, které jsi neprovedl. Finální odpověď stručná, seznam vytvořených souborů.
