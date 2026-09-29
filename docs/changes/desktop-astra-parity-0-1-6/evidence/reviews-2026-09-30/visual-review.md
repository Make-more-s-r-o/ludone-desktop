---
kind: design
ref: evidence/reviews-2026-09-30/visual-review.md
verdict: "🟡 podmíněně platné nebo čekající na výslovně uvedené ověření"
measuredAt: 2026-09-29T22:38:00Z
scope:
  - Astra screenshoty a Opus ikonografie
measuredFrom:
  - skutečné Electron screenshoty z astra-layout-final
  - původní Astra a Opus zdroj a screenshoty
---

# Závěrečné vizuální review Astra / Opus (read-only)

**Verdikt: 🟡 podmíněně platné.** Hlavní plochy Teď, Můj den, detail, Nastavení a offline nahrávání mají shodné rozměry panelu (400 × 700) či většího okna (640 × 744) a věrnou základní hierarchii Astra. Nelze tvrdit pixelovou shodu ani úplnou kompoziční paritu všech 14 scénářů. Automatické `CAPTURED` v `comparison.html` pouze potvrzuje existenci dvojic snímků.

**Prohlédnuté produktové snímky:** `01-00-prvni-pouziti.png`, `02-00-prihlaseni.png`, `03-ted.png`, `04-offline-active-recording.png`, `05-nahravani-ulozeno.png`, `06-offline-panel-recovery.png`, `07-muj-den.png`, `08-detail-nahravky.png`, `09-nastaveni.png`, `10-nastaveni-svetle.png`, `11-muj-den-svetle.png`, `12-nastaveni-tmave.png`, `13-muj-den-tmave.png`, `14-navrat-do-ted.png`, `15-aktualizace-stazena.png` v `docs/changes/desktop-astra-parity-0-1-6/evidence/e2e-2026-09-29/astra-layout-final/`. Reference: tamtéž `astra-home.png`, `astra-day.png`, `astra-detail.png`, `astra-settings.png`, `astra-offline.png`; dále původní Astra `round2/variants/astra/evidence/{save,identity,home,day,meeting-dark}.png` a zdroj `round2/variants/astra/index.html`. Pro ikonografii také `round2/variants/opus/index.html`, `assets/LuDone.svg` a ukázky Opus onboarding/update/light/dark.

## Zbývající rozdíly podle priority

- **P2 — uložení nahrávky:** `05-nahravani-ulozeno.png` je samostatný formulář se značnou prázdnou spodní částí. Astra `evidence/save.png` zachovává plný panel, nad formulářem stav probíhající práce a pod názvem cílovou firmu, náhled souboru i dvě široké akce. Neexistující pracovní čas a nemožnost vybrat firmu bez účtu jsou oprávněné; prázdná plocha a chybějící náhled souboru jsou vizuální/obsahová odchylka, kterou tyto podmínky samy nevyžadují.
- **P2 — onboarding a update:** produktový onboarding (`01`, `02`) je samostatný šestikrokový 400 × 700 tok, zatímco Astra `renderOnboarding()` je dvoukroková plocha ve společném shellu. Produktové kroky přihlášení, oprávnění a pravdivý místní režim mají důvod, ale kompozice není 1:1. `15-aktualizace-stazena.png` ukazuje vložený banner nad Teď; Astra `renderUpdate()` má samostatnou obrazovku aktualizace s verzí, bezpečnostním stavem a hlavními akcemi. Zde rovněž zůstává odlišná kompozice. Netvrdím, že banner je nefunkční; jen neodpovídá schválené scéně.
- **P2 — tmavé téma:** `12-nastaveni-tmave.png` a `13-muj-den-tmave.png` zachovávají pořadí sekcí a čitelný základní text. Oproti světlé Astře a ukázce Opus `settings-dark.png` mají velmi nízký kontrast sekundárních popisků, přepínačů a některých akcí; zvlášť `Otevřít zkoušku` a spodní `Hotovo` v tmavém Nastavení působí jako zakázané. Vyžaduje cílenou kontrolu čitelnosti, nikoli domněnku o funkčním stavu z obrázku.
- **P2 — stav obnovy:** `06-offline-panel-recovery.png` ukazuje offline banner a návrat do Teď, ale záběr končí na začátku fronty; proti původním stavům Astra recovery není v důkazu vidět celá opravná akce. Je to mezera důkazu, nikoli prokázaná vada implementace.

Na hlavních pěti dvojicích nevidím novou P1 vadu překryvu či ořezu. `07`/`08`/`09` mají viditelný spodní pruh; `09` již má zarovnané zdroje zvuku bez překryvu s další sekcí. `14` potvrzuje návrat do stejného shellu. Rozdíly titulů, dat, délky nahrávky, přihlášeného uživatele, firmy, serverového ověření, absence pracovních úseků a nižší karty LuTracku jsou nutné pro pravdivý produktový stav. LuTrack se nikde netváří jako aktivní služba. V detailu je převzetí místní nahrávky správně nedostupné; jeho šedá akce proto nemůže mít černý aktivní vzhled referenčního uploadu.

## Ikony

`src/components/Icons.jsx` používá sdílený `OpusIcon` pro hlavní stavové a akční symboly; tvary `check`, `wait`, `alert`, `work`, `wave`, `gear`, `wifiOff`, `window` a `stop` odpovídají kresbě v `round2/variants/opus/index.html` (s upravenou velikostí/tloušťkou v rendereru). `src/assets/LuDone.svg` je binárně shodný s `round2/variants/opus/assets/LuDone.svg` (`cmp` exit 0). Komponenty DesktopChrome, RecordingCard, Settings, Onboarding a RecordingsDashboard tyto sdílené ikony používají. Některé doplňkové symboly (`arrow`, `folder`, `user`, `download`, `keyboard`, `refresh`) jsou nově kreslené v téže obrysové řeči; nejsou doslovnými kopiemi ikon Opus. Samostatný `LockIcon` je ještě mimo `OpusIcon`. Nenašel jsem převzatou konkurenční ikonovou sadu, ale výrok „každá ikona je přesně z prototypu Opus“ by byl silnější než doložený stav.

**Stav:** 🧪 zelené E2E podle uloženého reportu; ⛔ skutečný zvuk a finální vzhled na Danově Macu zde nejsou ověřeny. ⚠️ Uvedené P2 kompoziční rozdíly brání tvrzení o úplné 1:1 shodě návrhu.
