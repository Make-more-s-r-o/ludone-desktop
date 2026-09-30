# Produktové dotažení po živém auditu 0.1.6

**Datum:** 30. 9. 2026 · **rozsah:** pokračování stejné změny, tier L.
**Mandát:** Dan požádal o úplný agentní proklik a opravy. Následně výslovně dovolil
vylepšit schválenou Astru na úroveň produktového designu Apple / Notion / Plaud.
Nečeká se na novou volbu designového směru; Astra, LuDone značka a Opus ikony zůstávají.

## Produktový kontrakt

- Teď je klidná plocha pro nahrávání. Hlavní akce a běžící čas mají přednost před
  archivem i frontou. Fronta se otevře z kompaktního souhrnu; její důvody a opravy
  nezmizí. Rozbalení nesmí vytlačit běžící nahrávání nebo volbu uložení.
- Můj den odlišuje dnešek od historie. Skutečné položky jsou seskupené po místních
  kalendářních dnech, nejnovější den je první; uvnitř dne je čitelná časová stopa.
  Historie zůstane dostupná a filtry nad ní fungují. Datum není UTC substring.
- Detail poskytuje jednoznačný místní stav, odděleně stav odeslání a ověření.
  Primární akce vychází z povolených akcí, technické identifikátory mají nižší prioritu.
  Rozpracované nahrávání není hlášeno jako poškozený dokončený soubor.
- Nastavení má srozumitelné skupiny, čitelnou hustotu a konzistentní ovladače.
  Údaje se načtou při běžném otevření stránky, nikoli přes skrytou původní záložku.
  Rychlá akce Zvuk skutečně přivede ke zvukové části. Neznámý stav není úspěch.
- Uložení potvrdí lidský výsledek a dostupnou další akci. Dlouhý název souboru,
  UUID a implementační rady nebudou dominantní text rychlého panelu.
- Zachovat tři témata a klávesnici včetně focusu, Escape, návratu a rychlých akcí.
  LuTrack je jen připravovaná funkce; nehraje dominantní roli a nelze jej spustit.

## Inspirace a hranice

[Apple layout](https://developer.apple.com/design/human-interface-guidelines/layout)
vede k jednoznačné hierarchii a stabilní hlavní akci;
[Notion sidebar](https://www.notion.com/help/navigate-with-the-sidebar) k předvídatelné
navigaci a postupnému odhalení detailů;
[Plaud Desktop](https://support.plaud.ai/hc/en-us/articles/53792807283225-Download-the-Plaud-Desktop)
k soustředění desktopu na nahrávání a pokračování přepisu na webu. Konkrétní kompozice
je návrh LuDone; nekopíruje cizí obrazovky. Pravidla LuDone DS byla načtena z aktuálního
webového repozitáře pouze pro čtení. Desktop zachová své existující komponenty a tokeny;
nevydává je za canonical webové komponenty a nemění webový DS.

## Audit a měřítko přijetí

1. Inventář všech viditelných akcí s výsledkem: dostupná cesta, disabled s důvodem,
   bez vedlejšího účinku nebo bezpečně odmítnutá. Na osobním profilu nedělat upload,
   logout, změnu firmy, převzetí či mazání; tyto větve prokliknout na syntetických datech.
2. Živá instalace tvoří vstupní audit. Kandidát bude prokliknut v izolovaném profilu,
   s pravdivě přiznanou simulací serveru/zvuku. Osobní nahrávání se nesmí přerušit.
3. Kontroly alespoň 20 položek z více dnů, velké fronty, prázdna, dlouhých názvů,
   běžícího a neúplného záznamu, offline, expirace, retry, aktualizace a všech témat.
4. Stávající brány beze změny. Nové regresní testy doloží nalezené funkční vady;
   nový auditový skript doplňuje původní E2E, neoslabí jej.
5. Review diffu i aktuálních screenshotů nezávislým modelem. Nevyřešený P1/P2
   blokuje vydání. Fyzický zvuk a skutečný upload zůstávají zvláštní lidskou přejímkou.

## Vlastnictví a pořadí

T-08 Nastavení a T-09 Den jsou nezávislé, každý má samostatný worktree a vlastní CSS.
T-10 Teď/fronta/uložení má třetí worktree. Sdílený `astra-parity.css`, `main.jsx`,
Electron main/preload, auditový skript, verzi a dokumentaci mění výlučně koordinátor
v integračním stromě. Agentům je zakázáno ovládat sdílenou GUI relaci. Koordinátor
integruje sekvenčně a sám spustí finální brány; T-11 závisí na T-08 až T-10.

Formální historická metadata plánu zůstávají draft: Codex nemá Claude schvalovací
hook. Přímý mandát Dana není přepsán na vymyšlený klik hooku. Dosavadní tasky T-01–07
se zpětně neoznačují jako dispatched/completed. Nové reporty doloží tento běh.
