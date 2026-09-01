# Task packet B6 — REVIDOVANÁ VERZE

> **Jak tenhle packet číst.** Je dlouhý, protože nese změřené věci, ne proto, že je upovídaný.
> Nečti ho lineárně. **Minimum před první editací:** §12 (vlastnictví bloků — co smíš změnit
> a čeho se nesmíš dotknout ani o řádek), §13 (TDD kroky s doslovnými červenými výpisy),
> §14 (sabotáže). Zbytek je odůvodnění, do kterého se vracej, až něco nesedí.
>
> 🔴 **Sekce `Co NEBYLO ověřeno v kódu` na konci není formalita.** Skeptik packet četl proti
> kódu a tohle zůstalo bez důkazu — než na tom postavíš implementaci, otevři to.
>
> Packet napsal agent, přečetl skeptik proti kódu. **Když v něm najdeš nepravdu, je to nález,
> ne překážka** — zapiš ho a jeď dál podle `spec.md` a `plan.md`, ty jsou nadřazené.

---


**Výběr projektu z alokací přes adaptér** · 🔴 **MONEY PATH** — chyba tady stojí lidi vykázané hodiny.

> ⚠️ **Tahle verze vznikla revizí návrhu.** Revize našla dvě skryté rozpory ve zmrazených
> dokumentech, pět děr v měřidle a jednu chybnou sabotáž. Změny jsou vypsané v sekci
> **„Co revize opravila"** na konci. Kdo četl návrh, ať čte i tu sekci — několik pravidel
> se OTOČILO.

---

## 1. Plan ID a Plan SHA

| Co | Hodnota | Ověřeno |
|---|---|---|
| **Plan ID** | `desktop-v1` — `docs/changes/desktop-v1/plan.md` (**ZMRAZENO**) | — |
| **Plan SHA** | `c7b1bb715f87f53ca0a209d5d3b96e6018e1e437` | ✅ `git log -1 --format=%H -- docs/changes/desktop-v1/plan.md` |
| **HEAD `main`** | `0380bc0014c54231d1bbe045d7d87176ddbce847`, strom čistý | ✅ `git rev-parse HEAD` + `git status --short` prázdný |
| Spec | `docs/changes/desktop-v1/spec.md` (**ZMRAZENO**) | — |
| Rozhodnutí | `docs/changes/desktop-v1/decisions.md`, `intent.md` | — |

🔴 **Návrh packetu uváděl HEAD `cb1de26a…`. To je commit o šest starší** (`cb1de26` = „Hand the
overnight session a prompt…"). Mezitím přišlo šest commitů, poslední `0380bc0` mění stav
designového artefaktu — viz §6. Baseline jsem proto **přeměřil znovu na skutečném HEAD**, viz §13.

🔴 **Spec ani plán neměň.** Když v nich najdeš chybu, zapiš ji do `DAN-TODO.md` a pokračuj po tom,
co na ní nezávisí (`BEH-NOC.md`).

---

## 2. Task ID

**B6** — `plan.md` §2, řádek 89: *„B6 · Výběr projektu z alokací přes adaptér · Codex · Závisí: B5 · Blokuje: —"*.

Název PR (anglicky, `plan.md` §2b řádek 147): **`Offer only projects with a valid allocation`**.
Odhad diffu bez testů: ~150 řádků. Dělitelné: **ne**.

⚠️ **Značka `⛔B1` v DAG diagramu (`plan.md:78`) je ROZHODNUTÍ B1, ne story B1** — a je to
**odvození, ne doložený fakt**. Opora: v témže diagramu stojí `B7 fronta ⛔C2` a `B9 odhlášení ⛔B2`;
`decisions.md:67/68/72` má B1, B2 i C2 jako rozhodnutí. Rozhodnutí **B1** zní: *„v1 každý vidí jen
svoje; sdílený účet `zasedacka@makemore.cz` je SOUČÁSTÍ v1"*.

**Co z ⛔B1 pro B6 plyne, i když sdílený účet staví B10:** nabídka projektů je **vázaná na
přihlášeného člověka**. Po přepnutí účtu se **musí zahodit** — cache nabídky přes změnu identity
je na `zasedacka@` tichý únik cizích projektů. To je jediný požadavek, který B6 z ⛔B1 nese.

---

## 3. Feature ID

**`DSK-F012` — Výběr projektu z alokací.**

Stav v matici `spec.md` §3 **před** touto story (ověřeno, řádek existuje doslova):

| ID | Funkce | Riziko | scope | delivery | exposure | verification |
|---|---|---|---|---|---|---|
| `DSK-F012` | Výběr projektu z alokací | **money** | approved | no-code ⁸ | disabled | unverified |

Poznámka ⁸ ze specu doslova: *„Tamtéž, řádek 5: `const PROJECTS = ["LuDone Desktop", "Web · klientská zóna", "Interní provoz"]`. Tři řetězce natvrdo. Žádná alokace, žádné GUID."*
**Ověřeno naostro v kódu:** `src/features/tracking/TrackingCard.jsx:5` — přesně tak to tam je,
soubor má 77 řádků, `export function TrackingCard` je na řádku 7.

Cílový stav po této story: **delivery `pr-open` · exposure `disabled` · verification `tests-green`**.
🔴 **Nic v PR nesmí tvrdit `verified-live`** — to smí říct jen člověk, který to viděl běžet.

---

## 4. Cíl story

Nahradit tři natvrdo zapsané řetězce projektů skutečnou nabídkou postavenou na **alokacích**,
tekoucí přes **adaptér**, tak aby:

1. se nabízely **jen projekty s platnou alokací k dnešnímu datu** (R6),
2. projekt s čerpáním **nad 110 %** byl zašedlý, s důvodem a **nešel vybrat ani spustit** (R7),
3. identitou projektu bylo **GUID**, nikdy název (R6),
4. klient **nikdy neposlal hodinovou sazbu** (R8),
5. celá agenda zůstala **fail-closed**: když adaptér selže nebo je vypínač času vypnutý,
   nenabídne se **nic** — nikdy se nespadne zpět na natvrdo zapsaný seznam.

Rozhodnutí **N1** (`intent.md:91`, ověřeno): *„Kam desktop píše hodiny — Dan rozhodl: **zatím nikam**,
později přes `app.ludone.cz`. Do té doby lokální úložiště za adaptérem."*
Proto je v1 implementace adaptéru **lokální** a serverová se doplní **beze změny volajících**
(`plan.md` §1, Kontrakty).

🔴 **Bod 2 se oproti návrhu packetu zpřísnil o slovo „ani spustit".** Acceptance ve `spec.md` §8 zní
*„je zašedlý s důvodem a **nejde na něj vykázat**"*. Samotné `selectable: false` v seznamu to
nesplňuje — viz díra D1 v §10.2.

---

## 5. User-visible chování

Panel, karta LuTrack. Podle schváleného návrhu (`design/navrh/nahled.html`, blok `.pv` č. 2
„Výběr projektu", řádky 419–441; podnadpis doslova **„Jen projekty, na které máš dnes platnou alokaci."**):

| Prvek | Chování |
|---|---|
| Hledání | Pole s placeholderem **„Hledat projekt…"**, filtruje podle názvu; identita zůstává GUID |
| Skupina **Naposledy** | Projekty s nejnovějším `lastUsedAt` z adaptéru, nejvýš 3 |
| Skupina **Všechny** | Zbytek nabídky |
| Řádek projektu | Název + druhý řádek se zbývajícím časem — **tvar viz OQ-4 níž, návrh packetu ho popsal špatně** |
| Přečerpaný projekt (>110 %) | Zůstává v seznamu, **zašedlý**, přerušovaný okraj, důvod červeně: **„rozpočet vyčerpán — vykazovat nejde"**, **bez** řádku se zbývajícím časem (tak to kreslí návrh). Klik nic nespustí |
| Prázdno (žádná platná alokace) | **„Nemáš dnes žádný projekt s alokací"** + věta odkazující do LuDone (`app.ludone.cz`) jako **prostý text**, viz §10.3. ⚠️ **Tahle obrazovka nemá schválený artboard** — viz §6 |
| Vypnutý `DESKTOP_TIME_ENABLED` | Nenabízí se nic, panel řekne, že měření času je vypnuté |
| Přepnutí za běhu | Časovač **se nezastaví** (R11); z pohledu uživatele jen změní projekt |

**OQ-4 (otevřená otázka, NEHÁDÁM):** návrh packetu tvrdil, že každý řádek nese
`zbývá H:MM z alokace`. **V náhledu to tak není.** Ověřeno na `design/navrh/nahled.html`:
- řádek 428 (zvýrazněný, první v „Naposledy"): `zbývá 116:19 z alokace`
- řádek 430: `zbývá 42:00` — **bez** „z alokace"
- řádek 435: `zbývá 8:30` — **bez** „z alokace"
- řádek 437 (přečerpaný): **žádný časový řádek**, jen červený důvod

Tři různé tvary na čtyřech řádcích. **Nevím, jestli je to záměr (dlouhý tvar jen u zvýrazněného
řádku) nebo nedůslednost náhledu.** Pracovní default: **dlouhý tvar `zbývá H:MM z alokace`
u prvního řádku skupiny „Naposledy", krátký `zbývá H:MM` u ostatních, u přečerpaného žádný.**
To reprodukuje schválený obrázek 1:1. Do PR napsat jako otevřenou otázku pro Dana.

Přístupnost (`spec.md` §7, ověřeno doslova, závazné):
- stav se **nikdy nesděluje jen barvou** — zašedlý projekt nese i text důvodu;
- vše ovladatelné klávesnicí, viditelný focus, `prefers-reduced-motion` se respektuje;
- copy česky; 🔴 **nikdy „MCP", „scope", „token"** v textu, který vidí uživatel.

🔴 **Nesmí vzniknout podmínka „nejdřív spusť LuTrack, pak smíš nahrávat".** Zdroj té hranice je
**`docs/ux/cesta-uzivatele-2026-09-01.md:17` (verdikt kalendář)**, ne `decisions.md` M9 — M9 zní
jen *„Jedna aplikace, dvě agendy — nahrávání schůzek a výkaz času"*. Projekt se do nahrávky smí
jen **předvyplnit**, nikdy podmiňovat.

---

## 6. Odkaz na schválený Claude Design artefakt

| Co | Kde | Ověřeno |
|---|---|---|
| Schválení | `design/approved.json` — `status: approved`, `approvedBy: Dan`, `approvedAt: 2026-09-01`, `approvedDirection: strong-fit` | ✅ přečten celý |
| Závazný náhled | `design/navrh/nahled.html`, blok `.pv` č. **2 „Výběr projektu"**, řádky **419–441** | ✅ přečteno 395–455 |
| `coveredScreens` | obsahuje **„panel — výběr projektu"** a „panel — měří se čas" | ✅ |
| `coveredStates` | obsahuje **„projekt s vyčerpaným rozpočtem (zablokovaný)"** | ✅ |
| Doplňkový artboard | `design/canvas/LuTrack.dc.html:110` — pozn. u `track.idle`: *„Projekty se načtou ze serveru. Dnes je to natvrdo zapsané pole tří řetězců."* | ✅ |

### 🔴 Dvě věci, které návrh packetu zamlčel

**1. Zdrojový designový projekt UŽ NEEXISTUJE.** `approved.json` sám říká:
`"designProject": "LuDone Přístroj Design System (c5ee8498-…) — v době schválení nedostupný"`.
Commit **`0380bc0`** („Note that the design artifact is gone…") k tomu dodává, že artefakt
pro tenhle účet **zmizel úplně** a *„tokeny mimo barvy nemohou přijít ze zdroje vůbec"*.
**Důsledek pro B6:** `design/navrh/nahled.html` je **jediná dochovaná autorita** pro tuhle
obrazovku. Není kam se doptat, není co stáhnout. Co v něm není, není schválené.

**2. Prázdný stav nemá schválený artboard.** V `coveredScreens` ani `coveredStates` **není**
„panel — výběr projektu, prázdno". Grep přes `design/**` na text *„Nemáš dnes žádný projekt
s alokací"* vrací **nulu** — ta věta žije jen v `spec.md` §6 a v `sekce-navrhy/journeys-ia.md`.
**Copy je tedy schválené, vzhled ne.**
➡️ **OQ-1 (otevřená otázka):** prázdný stav se má složit **výhradně z prvků, které v bloku 2
náhledu jsou** (nadpis + podnadpis + jeden textový řádek). **Nový design-system pattern
nevymýšlet** — `approvedNewDesignSystemElements` jmenuje tři prvky a výběr projektu mezi nimi
není. Do PR napsat, že prázdný stav je nakreslen bez artboardu.

### Doslovné texty z náhledu, které se přepisují 1:1

- `Jen projekty, na které máš dnes platnou alokaci.` (řádek 421)
- `Hledat projekt…` (424)
- `Naposledy` (425) · `Všechny` (432)
- `zbývá 116:19 z alokace` (428) — tvar viz **OQ-4** v §5
- `rozpočet vyčerpán — vykazovat nejde` (437)

🔴 **`Zbývá z alokace` NENÍ copy B6.** Návrh packetu ho sem zařadil; ověřeno, že leží v bloku 3
(„Měří se čas", běžící karta) a v `design/navrh/Main.dc.html:121`. **Ta karta patří B5.** Nesahat.

🔴 **Na `design/**` se NESAHÁ** (`plan.md` §4, `BEH-NOC.md`). Design se čte, nemění.

⚠️ **Tokeny mimo barvy (písmo, tvar, pohyb, mezery) v repozitáři nejsou** (`STAV.md:47`) — jsou
opsané z artboardů, ne ze zdroje, a zdroj už neexistuje. Používej existující třídy
v `src/styles.css`, nevymýšlej škálu.

---

## 7. Relevantní výřez EXPERIENCE.md

🔴 **`EXPERIENCE.md` v tomhle repozitáři NEEXISTUJE** (ověřeno `find . -name "EXPERIENCE*"` → nic).
Jeho roli hraje **`docs/ux/cesta-uzivatele-2026-09-01.md`**. Následující výřezy jsou z něj,
ověřené grepem doslova.

**Verdikt kalendář (řádek 17)** — o projektu z LuTracku jako signálu:

> (2) PROJEKT z LuTracku, který appka už drží — nejsilnější a nejlevnější signál v celém výzkumu,
> žádné API, žádné oprávnění, žádný nativní modul; POZOR na hranici: projekt se smí jen
> PŘEDVYPLNIT, nikdy z něj nesmí vzniknout podmínka „nejdřív spusť LuTrack, pak smíš nahrávat“ —
> agendy nesdílejí start ani stop.

**Moment 19 „M19 Souběh obou agend" (řádek 49)** — proč stav nesmí vlastnit renderer:

> Autoritou stavu ikony je dnes renderer, ne hlavní proces — po pádu okna zůstane v liště
> falešné „nahrává se“.

⚠️ Pozor na kolizi značek: **tohle „M19" je číslo momentu ve výzkumu**, ne rozhodnutí M19
v `decisions.md` (tam M19 = *„Pojmenování při stopu: předvyplněný název + čas od–do"*).

**Moment 21 „M21 Nečinnost a LuTrack" (řádek 51)** — hranice, kterou B6 nesmí překročit:

> Čas se nikdy tiše nesmaže ani tiše nezapočítá.

**Konvence macOS (řádek 95)** — proč je panel popover, a je to obhájené právě přepínačem projektu:

> Panel 366×792 je popover. Výjimka sedí: dvě nezávislé agendy, **přepínač projektu**, poznámka
> a stav dvou stop se do NSMenu opravdu nevejdou. Výjimku obhájit složitostí a držet ji.

**Notifikace (řádek 101)** — co B6 nesmí oznamovat:

> Neoznamovat start/stop nahrávání, **přepnutí projektu** ani přihlášení. […] Jméno klienta
> a projektu do textu NEDÁVAT — na sdílené obrazovce by bylo vidět.

---

## 8. Relevantní business pravidla

Doslovně ze `spec.md` §4 (ověřeno na řádcích 150–169) a `plan.md` §1.
**Tohle je money path — čti to jako zákon, ne jako kontext.**

| # | Pravidlo (doslova) | Co z toho pro B6 plyne |
|---|---|---|
| **R6** | *Nabízet **jen projekty s platnou alokací k dnešnímu datu**. Identita projektu je **GUID**, nikdy název — přejmenování firem 23. 7. 2026 srazilo platby na pět dní.* | Filtr platnosti + GUID jako jediná identita; název je popisek |
| **R7** | *Projekt s čerpáním **nad 110 %** je zašedlý a s důvodem. Databáze to nehlídá.* | Práh 110 %; „databáze to nehlídá" = klient je jediná brána |
| **R8** | *Klient **nikdy neposílá hodinovou sazbu**. Dosazuje ji databáze z alokace.* | V DTO ani v UI **žádné pole se sazbou** |
| **R9** | *Start i stop se ořezávají na **celé minuty**, zobrazuje se `5h 16m`, ne `5:16:07`.* | Týká se **měřeného času** (B5) |
| **R10** | *Klíč proti duplikaci vzniká při **STARTU** časovače, ne při odeslání. Do Tabidoo teče týdenní souhrn, takže duplicita není vidět — jen tiše zvedne hodiny do mzdových nákladů.* | B6 klíč **nevyrábí** — dělá to B5. B6 mu jen předá GUID projektu |
| **R11** | *Přepnutí projektu za běhu časovač **nezastaví**.* | Přepnutí = jeden příkaz „switch", nikdy „stop + start" |
| **R18** | *Dva samostatné vypínače (C2): `DESKTOP_UPLOAD_ENABLED` a `DESKTOP_TIME_ENABLED`. Oba **fail-closed** — chybějící hodnota znamená vypnuto a musí mít vlastní test.* | `timeEnabled` je **povinný argument**; cokoli jiného než přesný řetězec `"true"` = nenabízí se nic |
| **R20** | *Nahrávky jsou **majetkem firmy** (B2). Admin je vidí všechny.* | Kontext RBAC; B6 sám žádné RBAC nevyhodnocuje |

### 🔴 OQ-2 — ROZPOR MEZI ZMRAZENÝMI DOKUMENTY NA MONEY HRANICI

Návrh packetu tenhle rozpor **zamlčel a rozhodl ho sám za sebe (P4/P6)**. To je přesně to, co
`MASTERPLAN.md` §9 zakazuje: *„Implementátor nesmí … rozhodnout nové money nebo RBAC pravidlo."*
Tři zmrazené věty říkají tři různé věci:

| Zdroj | Doslovné znění | Co z toho plyne |
|---|---|---|
| `spec.md:152` (**R7**) | *„Projekt s čerpáním **nad 110 %** je zašedlý a s důvodem."* | Přečerpaný je **VIDĚT**, jen nejde vybrat. Hranice: `> 110` ⇒ **110,0 % ještě jde** |
| `plan.md:49` (§1 Jak se chrání peníze, bod 3) | *„Nabízí se jen projekty s platnou alokací a čerpáním **pod 110 %**."* | Hranice `< 110` ⇒ **110,0 % už NEJDE**. O jeden případ jinam než R7 |
| `plan.md:147` (§2b, přejímka PR pro B6) | *„Přečerpaný projekt (>110 %) **není v nabídce**."* | Přečerpaný se **NEZOBRAZUJE VŮBEC** — opak R7 |

**Autorita při rozporu** (`spec.md`, hlavička, a `MASTERPLAN.md` §501): *chování → `spec.md`;
technická realizace → `plan.md`*. „Je vidět, nebo není" a „kde přesně je hranice" je **chování**,
tedy rozhoduje `spec.md` R7. Pracovní výklad je proto:

- přečerpaný projekt **zůstává v seznamu**, zašedlý, s důvodem (R7 + schválený náhled řádek 437);
- hranice je **ostrá**: `spentPercent > 110` blokuje, **přesně 110,0 % je ještě vybratelné**.

🔴 **Ale je to výklad, ne fakt, a je to money hranice.** Proto:
1. **Napiš to do PR jako otevřenou otázku pro Dana**, s citací všech tří vět.
2. **Zapiš do `DAN-TODO.md`** větu: *„R7 (spec) vs. `plan.md` §1 bod 3 vs. `plan.md` §2b přejímka
   B6 se rozcházejí v tom, jestli se přečerpaný projekt zobrazuje, a v tom, kam patří přesných
   110,0 %. B6 jede podle R7. Dan rozhodne, který text se opraví."*
3. **Reviewer si toho MUSÍ všimnout**: přejímka v `plan.md` §2b říká „není v nabídce", takže PR,
   který ji splní doslova, poruší R7 a schválený design. Tenhle packet vědomě plní R7.

### Jak se chrání peníze (`plan.md` §1, doslova)

> 1. Klient neposílá sazbu. Nikdy.
> 2. Klíč proti duplikaci vzniká **při startu** časovače.
> 3. Nabízí se jen projekty s platnou alokací a čerpáním pod 110 %.
> 4. **Zápis do Tabidoo přímo z desktopu je zakázaný** za všech okolností.

### Acceptance scénář ze `spec.md` §8 — přejímka téhle story

> **`DSK-F012` přečerpaný projekt nejde vybrat**
> Given projekt s čerpáním 112 % · When otevřu výběr · Then je zašedlý s důvodem
> a **nejde na něj vykázat**.

🔴 **„Nejde na něj vykázat" je silnější než „nejde ho vybrat v seznamu".** Návrh packetu splnil
jen druhou půlku. Viz díra **D1** v §10.2.

### Matice stavů `spec.md` §6, dva řádky patřící B6

| Stav | Panel | Kde je dnes |
|---|---|---|
| Projekt přečerpán | zašedlý s důvodem | chybí |
| Prázdno (žádná alokace) | „Nemáš dnes žádný projekt s alokací“ + odkaz do LuDone | chybí |

### Role a viditelnost (`spec.md` §2, `plan.md` §1)

v1 vidí každý **jen své vlastní** záznamy; admin vše. 🔴 **Tři nezávislé osy práv**
(modul-gate × company-scope × citlivá pole), vše **default-deny**. Desktop **žádnou z nich
nevyhodnocuje sám** — ptá se serveru a odpověď respektuje.
V B6 to znamená: adaptér **nesmí** filtrovat podle role ani firmy vlastní logikou; dostane už
odfiltrovaný seznam. Vymyslet si RBAC pravidlo je zakázané (`MASTERPLAN.md` §9).

---

## 9. Relevantní Architecture Spine invarianty

`plan.md` §1, hranice modulů — **doslova, ověřeno, a podřízené úkoly to nesmějí předefinovat**:

| Modul | Vlastní | Nesmí |
|---|---|---|
| `electron/main.cjs` | okno, tray, IPC, životní cyklus | rozhodovat o stavu podle rendereru |
| `electron/tracking.cjs` *(nový)* | stav časovače a jeho perzistence | volat server přímo |
| `electron/queue.cjs` | odchozí fronta obou typů položek | znát obsah nahrávky |
| `electron/auth.cjs` | přihlášení, obnova, odvolání | ukládat token jinam než přes `safeStorage` |
| `src/**` (renderer) | **jen zobrazení** | držet stav, který musí přežít pád |
| `src/lib/adapters/**` *(nový)* | **překlad do backendu** | **obsahovat business pravidla** |

🔴 **Poslední řádek je pro B6 rozhodující.** Pravidla R6/R7/R8/R11 jsou **business pravidla**,
takže **NESMÍ ležet v `src/lib/adapters/**`**. Proto packet dělí story na dva moduly (§12):
adaptér = jen překlad a zdroj dat, samostatný čistý modul = pravidla.

⚠️ **Oprava proti návrhu packetu:** návrh to obhajoval větou *„`src/lib/queue.js` je precedens:
čistá logika mimo `adapters/`, **sdílená rendererem i hlavním procesem**"*. **Druhá půlka je
nepravda.** Ověřeno `grep -rn "lib/queue" src/ electron/ tests/ scripts/`: `src/lib/queue.js`
importuje **jen jeho vlastní test** (`tests/queue.test.js:15`) a existenci mu kontroluje
`scripts/akceptace/E5.sh:60`. **Žádný soubor v `src/` ani `electron/` ho neimportuje** — přesně
to říká i `spec.md` poznámka ⁵: *„zelené testy nad nezapojeným kódem"*. `electron/queue.cjs`
je 69řádkový samostatný CJS soubor (jen `loadQueue` + `saveQueueAtomically`), který s ním
nesdílí ani řádek.
**Precedens tedy platí zúženě:** čistá logika smí bydlet v `src/lib/*.js` mimo `adapters/`
a mít vlastní testy. **Není** to důkaz, že ji umí sdílet oba procesy — to tady zatím nikdo
neudělal. Vědomě to neřeš, ale ani se na to neodvolávej.

### Kdo vlastní stav (`plan.md` §1, doslova)

> 🔴 **Stav, který musí přežít pád rendereru, vlastní hlavní proces.** Renderer hlásí fakta,
> neurčuje stav.

Pro B6: **běžící projekt a čas jsou stav hlavního procesu** (B5, `electron/tracking.cjs`).
Renderer smí držet jen pomíjivé věci: text ve vyhledávacím poli a načtený seznam nabídky.
🔴 **Do rendereru nepatří „aktuálně vybraný projekt" jako zdroj pravdy.**

### Kontrakty · Vypínače · Rollback

Čas jde **přes adaptér**; v1 lokální, serverová se doplní **beze změny volajících**. Identita
projektu je **GUID**, nikdy název. Vypínače `DESKTOP_UPLOAD_ENABLED` a `DESKTOP_TIME_ENABLED`,
oba fail-closed, každý s vlastním testem. *„Každá story je samostatně revertovatelná. Žádná
migrace v1 (desktop nikam nepíše)."*

### Co plán nepokrývá

🔴 Serverovou stranu (S1) a MCP nástroje (S2). B6 tedy **nevolá žádný server, nezakládá HTTP
klienta a nesahá na `app.ludone.cz`**.

### 🔴 NOVĚ: mantinel prostředí, který návrh packetu vynechal

`eslint.config.js` (ověřeno, přečten celý) dává bloku `files: ["src/**/*.{js,jsx}"]`
**`globals: globals.browser`** a `js.configs.recommended` (tedy `no-undef: error`).
**Důsledek:** v `src/lib/adapters/projects.js` ani `src/lib/project-allocations.js`
**nesmí být `process`, `process.env`, `require`, `__dirname` ani import z `node:*`.**
`npm run lint` na tom spadne s `no-undef`.

➡️ **Lokální vzorek alokací musí být konstanta uvnitř modulu**, ne čtení ze souboru
a ne čtení z prostředí. `timeEnabled` proto **nemůže** adaptér zjistit sám — musí přijít
argumentem odjinud (viz §10.3 a §11).

---

## 10. Vstupní a výstupní rozhraní

🔴 Tvar dat není ve zmrazených dokumentech nikde určený. **Tenhle packet ho fixuje** jako
technický kontrakt. Není to nové money pravidlo — money pravidla jsou R6/R7/R8 a ta se nemění.
Kdo potřebuje jiný tvar, **zastaví se a zeptá**, neupravuje si ho sám.

⚠️ **Bloky níž jsou PSEUDO-PODPISY, ne kód k opsání.** Návrh packetu je nabídl ve fence `js`
se syntaxí TypeScriptu (`fixture?`, `): Allocation`, `): OfferResult`). **Opsané doslova
rozbijí `npm run lint` i `npm run typecheck`** — `.js` soubor TS anotace neumí.
Skutečný kód piš jako **prostý JS + JSDoc**.

### 10.1 Adaptér — `src/lib/adapters/projects.js` (jen překlad)

```
PROJECT_SOURCE_SCHEMA_VERSION = 1

Allocation (JSDoc @typedef, žádné pole se sazbou — R8):
  projectId        string   GUID. Jediná identita projektu (R6).
  projectName      string   Jen popisek. Nikdy identita.
  validFrom        string   'YYYY-MM-DD', platnost VČETNĚ tohoto dne.
  validTo          string   'YYYY-MM-DD', platnost VČETNĚ tohoto dne.
  allocatedMinutes number   Celé minuty, > 0.
  spentMinutes     number   Celé minuty, >= 0.
  lastUsedAt       string|null  ISO 8601 v UTC nebo null. Podklad pro „Naposledy".

createLocalProjectSource(fixture)  → { listAllocations(): Promise<Allocation[]> }
normalizeAllocation(raw)           → Allocation   (žádné filtrování, žádné prahy)
rateFieldName(value)               → string|null  (jméno prvního zakázaného pole, nebo null)
```

**Povinné chování adaptéru:**
- `normalizeAllocation` **vyhodí `TypeError`**, když záznam nese pole odpovídající
  `/(sazb|rate|hourly|mzd|wage|price|cena|czk)/i` — R8 se vymáhá už na vstupu.
- `listAllocations()` je **`async`**, aby serverová varianta mohla nastoupit beze změny
  volajících (`plan.md` §1).
- Adaptér **nefiltruje, neřadí podle pravidel, nezná práh 110 %, nezná `timeEnabled`.**
- **Vzorek je konstanta v modulu** (viz mantinel prostředí v §9) — **čtyři projekty s názvy
  ze schváleného náhledu**: `Make more Finanční řízení 2026`, `LuDone Desktop`,
  `Maker Faire Praha 2026`, `MF M. Boleslav 2026` (poslední **přečerpaný**).
  🔴 **GUID jsou synteticky vymyšlené a musí to být v komentáři napsané.** Skutečné GUID
  z Tabidoo se do repozitáře nekopírují.

### 10.2 Pravidla — `src/lib/project-allocations.js` (R6, R7, R8, R11)

```
OVERSPEND_LIMIT_PERCENT = 110                             // R7
TIME_DISABLED_REASON  = "měření času je vypnuté"
OVERSPENT_REASON      = "rozpočet vyčerpán — vykazovat nejde"
NO_ALLOCATION_MESSAGE = "Nemáš dnes žádný projekt s alokací"

spentPercent(allocation)                → number
isWithinValidity(allocation, today)     → boolean          today = 'YYYY-MM-DD'
remainingMinutes(allocation)            → number           nikdy záporné

offerProjects(allocations, timeEnabled, today) → {
  outcome: "disabled" | "empty" | "ok",
  reason:  string | null,
  offered: Array<{
    projectId, projectName,
    remainingMinutes, spentPercent,
    selectable: boolean, blockedReason: string|null, recent: boolean
  }>
}

projectSwitchIntent(offer, currentProjectId, nextProjectId, isRunning) → {
  kind: "start" | "switch" | "noop" | "blocked",
  reason: string | null
}
```

#### 🔴 D1 — DÍRA, KTEROU REVIZE NAŠLA A KTEROU TENHLE PODPIS ZAVÍRÁ

Návrh packetu měl `projectSwitchIntent(currentProjectId, nextProjectId, isRunning)` — **bez
přístupu k nabídce**. Ta funkce tedy **neměla jak vědět, že projekt je přečerpaný**, a na
GUID přečerpaného projektu vesele vrátila `{ kind: "start" }`.
**Všech jedenáct testů z návrhu by přitom bylo zelených.** Acceptance `spec.md` §8
*„nejde na něj vykázat"* by nebyla splněná a nikdo by to nepoznal — přesně ta třída vady,
kvůli které tenhle repozitář má čtyřsloupcovou matici.

➡️ **`projectSwitchIntent` proto bere `offer` jako první argument** a vrací
`{ kind: "blocked", reason }`, když `nextProjectId` v `offer.offered` **není**, nebo tam je
se `selectable: false`. To je druhá, nezávislá brána nad toutéž pravdou — obrana do hloubky,
protože UI je jen zobrazení a spolehnout se na zašedlé tlačítko nestačí.

#### Povinné chování pravidel

| Vstup | Výstup |
|---|---|
| `timeEnabled` není přesně řetězec `"true"` (včetně `undefined`, `"1"`, `true`, `"TRUE"`) | `{ outcome: "disabled", reason: TIME_DISABLED_REASON, offered: [] }` — R18 fail-closed. Precedens: `src/lib/queue.js:202` `if (uploadEnabled !== "true")` (✅ ověřeno na řádku) |
| `allocations` není pole | vyhodí `TypeError` (styl `queue.js`) |
| Kterýkoli prvek `allocations` nese pole se sazbou (`rateFieldName(a) !== null`) | vyhodí `TypeError` — R8 se vymáhá i tady, ne jen v adaptéru (viz D3) |
| Alokace mimo platnost k `today` | **vypadne z nabídky úplně** (R6) |
| `allocatedMinutes <= 0` | **vypadne z nabídky úplně** — nulová alokace není platná alokace (R6). ⚠️ **změna oproti návrhu, viz OQ-3** |
| `spentPercent > 110` | zůstává v `offered`, `selectable: false`, `blockedReason: OVERSPENT_REASON` (R7 — viz **OQ-2**) |
| `spentPercent === 110` přesně | **`selectable: true`** — podle R7 „nad 110 %" (viz **OQ-2**) |
| `offered.length === 0` | `{ outcome: "empty", reason: NO_ALLOCATION_MESSAGE }` |
| `offered.length > 0`, ale **žádný** `selectable: true` | `{ outcome: "ok", reason: null }`, `offered` **zůstává naplněné** zašedlými řádky. ⚠️ **změna oproti návrhu, viz OQ-3** |
| `projectSwitchIntent`: `nextProjectId` není v `offered` nebo má `selectable: false` | `{ kind: "blocked", reason: <blockedReason nebo NO_ALLOCATION_MESSAGE> }` — **nikdy `start`** |
| `isRunning === true`, jiný a vybratelný `nextProjectId` | `{ kind: "switch" }` — **nikdy** stop+start (R11) |
| `isRunning === true`, stejný `nextProjectId` | `{ kind: "noop" }` |
| `isRunning === false`, vybratelný `nextProjectId` | `{ kind: "start" }` |

🔴 **`today` je povinný argument ve tvaru `'YYYY-MM-DD'`.** Uvnitř čistých funkcí se
**nesmí volat `new Date()`** — jinak test neuhlídá hranici dne a naostro se to pozná až
podle chybějících hodin.

**OQ-3 (otevřená otázka, dvě změny oproti návrhu):**
1. Návrh dával `allocatedMinutes = 0` do nabídky jako zašedlé s textem *„rozpočet vyčerpán"*.
   To je **nepravda na obrazovce** — nulová alokace není vyčerpaný rozpočet. A vyžádalo by
   si to copy, kterou nikdo neschválil. Pracovní default: **vyřadit z nabídky** (není to
   platná alokace ve smyslu R6). Není v žádném pravidle — do PR jako otevřená otázka.
2. Návrh vracel `outcome: "empty"` vždy, když nebyl žádný `selectable`. Jenže když má člověk
   jedinou alokaci a je přečerpaná, hláška *„Nemáš dnes žádný projekt s alokací"* **lže** —
   alokaci má, jen je vyčerpaná. Pracovní default: `"empty"` jen při **prázdném** `offered`;
   jinak `"ok"` se samými zašedlými řádky. Do PR jako otevřená otázka.

**Poznámka k testu hranice 110,0 %:** volit vstupy, které jsou v binární plovoucí čárce přesné
(např. `allocatedMinutes: 1000, spentMinutes: 1100`). `1100/1000*100` dá přesně `110`.
Nepoužívat trojky a sedminy — `110` z nich vyjde jako `109.99999999999999` a test bude
zelený nebo červený podle náhody, ne podle pravidla.

### 10.3 Renderer — `src/features/tracking/TrackingCard.jsx`

**Ověřený současný stav** (soubor přečten celý, 77 řádků):
- `:5` `const PROJECTS = [...]` — tři řetězce
- `:8` `useState(PROJECTS[0])` — vybraný projekt v rendereru
- `:43–49` `<label className="select-field">`, uvnitř `<select>` na `:45–47`
  (⚠️ návrh packetu psal „`<select>` na 43–49"; `<select>` je na 45–47, 43–49 je ten `<label>`)
- `:28` `onActivityChange({ active, project, description })` — projekt teče ven **jako název**

**Vstup:** `props` z `App.jsx` **beze změny jejich tvaru**. Ověřeno `src/App.jsx:86`:
`<TrackingCard onActivityChange={handleTrackingChange} />` — **jiný prop tam dnes není**
a přidat ho nelze, `App.jsx` patří B3/B5/B7/B8/B9 (§12). Adaptér a pravidla se proto berou
**importem**, ne propem.

**Výstup směrem k časovači:** **výhradně `projectId` (GUID)** předané mostem, který
vystavila story **B5** (`window.ludone.tracking.*`).

🔴 **B6 nesmí přidat ani změnit jediný IPC kanál** (§12).

**Prázdný stav** ukazuje `NO_ALLOCATION_MESSAGE` a adresu `app.ludone.cz` jako **prostý text**.
🔴 **Žádný `<a href>`**: okno je `loadFile(dist/index.html)` (✅ ověřeno `electron/main.cjs:311`)
a `main.cjs:319` (`did-start-navigation`, `isMainFrame`) volá
`finalizeRecordingSessionsForOwner(…, "navigace nebo reload")` — ✅ ověřeno na řádku. Skutečný
odkaz by uprostřed schůzky **ukončil běžící nahrávku**. Most `openExternal` v `preload.cjs`
neexistuje (✅ ověřeno, preload má 22 řádků a `openExternal` mezi nimi není) a B6 ho přidat
nesmí → zapiš do `DAN-TODO.md`.

---

## 11. Dependencies

### 🔴 PŘEDPODMÍNKA, KTEROU MUSÍŠ OVĚŘIT DŘÍV, NEŽ NAPÍŠEŠ PRVNÍ ŘÁDEK

Návrh packetu psal: *„`timeEnabled` … když ji [cestu] nemá, předej `undefined` — chování je pak
fail-closed »nenabízí se nic«, což je správný výsledek, ne chyba k obejití."*

**To je nejnebezpečnější věta v celém návrhu a revize ji ruší.** Ověřeno v kódu:

- `electron/preload.cjs` (celý, 22 řádků) vystavuje `runtime: { emptyCalendar, resetOnboarding }`,
  `beginAuth`, `requestPermission`, `beginRecording`, `appendRecordingChunk`, `finishRecording`,
  `getTrayState`, `testClickTray`, `testQuit`, `setTrayState`, `hidePanel`, `openSettings`,
  `closeSettings`. **Žádné `tracking:*`. Žádný `timeEnabled`. Žádný `DESKTOP_TIME_ENABLED`.**
- `electron/tracking.cjs` **neexistuje** (✅ `electron/` obsahuje jen `auth.cjs`, `main.cjs`,
  `preload.cjs`, `queue.cjs`).
- `.env.example` má **jen** `DESKTOP_UPLOAD_ENABLED=false` (✅ přečten celý, 2 řádky).

Kdyby se B6 pustilo dnes a řídilo se návrhem, vzniklo by UI, které **vždy a navždy nenabídne nic**,
a **všechny brány by byly zelené**. To je doslova ta vada, kterou `spec.md` §3 popisuje větou
*„v srpnu tu devět zelených bran hlásilo hotovou práci, která se nikdy nespustila"*.

➡️ **Před startem spusť tuhle kontrolu. Když nevrátí obojí, B6 SE NESPOUŠTÍ:**

```
test -f electron/tracking.cjs                  # musí existovat (B5)
grep -n "tracking" electron/preload.cjs        # musí vystavovat tracking:* most
grep -n "timeEnabled\|DESKTOP_TIME_ENABLED" electron/preload.cjs electron/main.cjs
```

Když most není: **zastav, zapiš blocker do `DAN-TODO.md`, napiš to do reportu a jdi na jinou
story.** `undefined` jako „správný výsledek" je zakázané.

### Tabulka závislostí

| Závislost | Stav | Co z toho plyne |
|---|---|---|
| **B5** — „Časovač do hlavního procesu, atomická perzistence" | 🔴 **není hotová**; `electron/tracking.cjs` neexistuje | B6 se **nespouští**, dokud neprojde kontrola výš |
| **B5** vystavuje přepnutí projektu za běhu | ⚠️ **NEOVĚŘITELNÉ** — ownership B5 v `plan.md` §2 zní jen *„registrace `tracking:*` kanálů, hook na pád rendereru"*, konkrétní kanál pro switch nikde uvedený není | R11 může být po dokončení B5 **nedosažitelné**. Pak je to blocker, ne úkol, a B6 si most **nedodělává** |
| Rozhodnutí **B1** (kolo 2) | rozhodnuto | v1 každý vidí jen svoje; sdílené zařízení řeší **B10**. Pro B6: nabídku **nekešovat přes změnu účtu** (§2) |
| Rozhodnutí **N1** | rozhodnuto (`intent.md:91`) | adaptér v1 lokální |
| Rozhodnutí **S1/S2** | rozhodnuto | žádný server, žádné MCP |
| **B7** (fronta) | souběžná ve vlně 3 | sdílí `TrackingCard.jsx` → 🔴 **nesmí běžet ve stejném stromě zároveň** |
| **B1** (story, `ui-smoke`) | ⚠️ `ui-smoke` je na `main` **červený** (✅ `DAN-TODO.md:257`, příčina `ui-smoke.mjs:301`, tlačítko „Povolit" chybí v `Onboarding.jsx`) | viz §12.4 |
| Blokuje | **nic** (`plan.md` §2, řádek 89) | |

**Pořadí z `plan.md:170`:** *„Třetí: B6 · B7 (obě po B5…) · B8 (po B4)."*

---

## 12. Přesné soubory

### 12.1 Co B6 vytváří a mění

| Soubor | Akce | Poznámka |
|---|---|---|
| `src/lib/adapters/projects.js` | **nový** | Adresář `src/lib/adapters/` zakládá tato story — ✅ ověřeno, `src/lib/` obsahuje jen `manifest.js`, `oauth.js`, `queue.js` |
| `src/lib/project-allocations.js` | **nový** | Business pravidla R6/R7/R8/R11. **Nesmí** být v `adapters/` (Spine) |
| `src/features/tracking/TrackingCard.jsx` | mění | Zrušit `const PROJECTS` (`:5`), `<label class="select-field">` (`:43–49`) nahradit nabídkou podle návrhu |
| `tests/project-allocations.test.js` | **nový** | Cílený test story |
| `src/styles.css` | mění, **jen v ohraničeném bloku** | viz 12.3 |

### 12.2 🔴 VLASTNICTVÍ BLOKŮ

`plan.md` §2 (doslova):

> 🔴 **Původní rozvržení bylo špatně a Codexovo vytěžení to odhalilo.** Devět z dvanácti stories
> sahá do `electron/main.cjs`, osm do `electron/preload.cjs` […] rozhoduje, kdo píše do kterého souboru.
>
> 🔴 **Task packet musí vlastnictví zadat VÝČTEM, ne větou „nesahej na cizí".** Próza prohraje
> s prvním „tady to logicky patří taky"; výčet umí vykonavatel použít jako filtr při každé editaci.

| Story | Vlastní v `main.cjs` | Vlastní v `preload.cjs` |
|---|---|---|
| **B3** | `trayIconName`, `updateTray`, `deriveTrayState`, registrace tray | odebrat `setTrayState` |
| **B4** | `shouldHidePanelOnBlur` a jeho čítače | nic |
| **B5** | registrace `tracking:*` kanálů, hook na pád rendereru | přidat `tracking:*` |
| **B7** | zapojení fronty, `queue:*` kanály | přidat `queue:*` |
| **B8** | `auth:begin` a jeho okolí | `beginAuth` |
| **B9** | `auth:logout` | přidat `logout` |
| **B11** | nic | nic |

#### 🔴 OQ-5 — ROZPOR, KTERÝ NÁVRH PACKETU VYDÁVAL ZA JISTOTU

Návrh tvrdil kategoricky: *„B6 nevlastní v `electron/main.cjs` ANI JEDEN blok. […] Potvrzuje to
i `plan.md` §2b."* — a jako zdroj tabulky sdílených souborů uvedl `podklady-vytezene.md`.
**Dva zdroje říkají opak a návrh je oba vynechal:**

| Zdroj | Doslovné znění |
|---|---|
| `plan.md:170` | *„**Třetí:** B6 · B7 (obě po B5, ale **sahají do jiných bloků `main.cjs`**)"* |
| `podklady-vytezene.md:172` | *„\| **B6** \| `electron/tracking.cjs`; `electron/main.cjs`; `electron/preload.cjs`; `src/features/tracking/TrackingCard.jsx` \|"* |

Proti tomu stojí `plan.md:147` (§2b), kde jsou soubory B6 jen `src/lib/adapters/`,
`TrackingCard.jsx`, a tabulka vlastnictví bloků, kde **B6 řádek nemá**.

**Pracovní výklad — bezpečný směr:** B6 **do `main.cjs` ani `preload.cjs` nepíše**. Důvody:
(a) při návrhu z §10 to není potřeba — B6 jen volá most, který vystavila B5;
(b) story bez řádku v tabulce vlastnictví nemá **žádný** blok, do kterého by směla psát,
a psát do cizího je horší chyba než nenapsat nic;
(c) souběžná B7 ve vlně 3 do `main.cjs` píše — nevlastněný zápis by srazil obě.

🔴 **Ale je to výklad.** Napiš ho do PR a do `DAN-TODO.md`: *„`plan.md:170` a
`podklady-vytezene.md:172` říkají, že B6 sahá do `main.cjs`/`preload.cjs`; `plan.md:147`
a tabulka vlastnictví říkají opak. B6 jela podle druhého. Když B5 nevystaví most, je to blocker."*

#### Filtr pro každou jednotlivou editaci — polož si tuhle otázku před KAŽDÝM zápisem

1. Je cesta souboru jedna z těch pěti v tabulce 12.1? Když ne → **nezapisuj**.
2. Je to `electron/main.cjs` nebo `electron/preload.cjs`? → **nezapisuj, ani o řádek**.
   Potřebuješ tam něco? To je **blocker**, ne úkol: do PR a do `DAN-TODO.md`.
3. Je to `electron/tracking.cjs`? → **nezapisuj**, patří B5. Jen se volá skrz most.
4. Je to `scripts/ui-smoke.mjs`? → **nezapisuj**, patří B1 a B3.
5. Je to `src/App.jsx`? → **nezapisuj**, patří B3, B5, B7, B8, B9.
6. Je to `design/**`, `docs/changes/desktop-v1/spec.md` nebo `plan.md`? → **nezapisuj**, zmrazeno.
7. Je to `.env.example`? → **nezapisuj**; chybějící `DESKTOP_TIME_ENABLED` patří B5 → `DAN-TODO.md`.

#### Sdílené soubory (✅ ověřeno `podklady-vytezene.md:188` a `:191`)

| Soubor | Kdo všechno | Pravidlo pro B6 |
|---|---|---|
| `src/features/tracking/TrackingCard.jsx` | B5, B6, B7 | B6 vlastní **výběr projektu**: seznam, hledání, skupiny, zablokovaný řádek, prázdný stav. **Nesahá** na blok časovače od B5 ani na blok fronty od B7 |
| `src/styles.css` | B3, B4, B9, B11 (+ B6) | viz 12.3. ⚠️ `podklady-vytezene.md:172` `styles.css` u B6 **neuvádí** — přidává ho tenhle packet, protože nové UI potřebuje třídy. Do PR napsat |

### 12.3 `src/styles.css` — pravidlo proti konfliktu

Soubor má **1353 řádků** (✅ ověřeno) a sahají do něj čtyři další stories. **Nové třídy pište
výhradně do jednoho souvislého bloku na konci souboru**, ohraničeného značkami:

```css
/* B6 — výběr projektu z alokací — začátek */
…
/* B6 — výběr projektu z alokací — konec */
```

Existující třídy **používej, neupravuj**. ✅ Ověřené pozice:
`.sr-only:134` · `.inline-note:307` · `.tracking-controls:596` · `.select-field:602` ·
`.select-field select:606,618` · `.select-field > svg:623` · `.description-field:677`.
⚠️ **`.tracking-card` jako samostatná třída v `styles.css` NENÍ** — existuje jen
`.tracking-card.is-active:482`; základní vzhled nese `.feature-card`. Návrh packetu ji uváděl
mezi „existujícími třídami"; neopírej se o ni.
Kdo změní kteroukoli z nich, rozbije B3/B4/B9/B11.

### 12.4 ⚠️ Známá kolize, kterou B6 NEOPRAVUJE

`scripts/ui-smoke.mjs` sahá **přímo do `<select>`**, který tahle story odstraňuje.
✅ Čísla řádků ověřena čtením souboru:

- `:224` `const select = document.querySelector('.tracking-card select');`
- `:226` `select.value = 'Web · klientská zóna';`
- `:234` `if (result.project !== "Web · klientská zóna" || result.description !== …)`
- `:338–342` tytéž selektory + `select.disabled` jako důkaz uzamčení projektu za běhu

Po B6 tyhle řádky **nemají co najít**. **B6 je NEOPRAVUJE** — `ui-smoke.mjs` patří B1/B3.
Navíc je `ui-smoke` na `main` **červený už teď** z jiného důvodu (`DAN-TODO.md:257`,
příčina `ui-smoke.mjs:301` — klik na „Povolit", které v `Onboarding.jsx` neexistuje),
a v CI je vypnutý (✅ `.github/workflows/ci.yml`, `if: ${{ false }}` u obou smoke kroků),
takže **projektové brány to nezastaví**.

⚠️ **Pozor, co B6 NEROZBIJE:** `.tracking-card input` (popis práce) a `clickByAria(panel,
"Spustit LuTrack")` zůstávají. Kolize je jen na `<select>`.

**Povinnost B6:** napsat tuhle kolizi do PR jmenovitě, s čísly řádků, a zapsat ji do
`DAN-TODO.md` jako práci pro vlastníka `ui-smoke.mjs`. Tichá regrese měřidla je vada.

---

## 13. TDD kroky

Pořadí je závazné (`MASTERPLAN.md` §13 RED → GREEN → REFACTOR, ověřeno na řádcích 810–836).
**Do PR patří DOSLOVNÝ výpis červené**, ne věta „test padal".

### ✅ Baseline PŘEMĚŘENÝ na skutečném HEAD `0380bc0` (1. 9. 2026, měřeno před rourou)

```
npm run lint       → EXIT=0
npm run typecheck  → EXIT=0    (tsc --noEmit -p jsconfig.json)
npm run test:unit  → EXIT=0    Test Files 9 passed (9) · Tests 77 passed (77)
```

⚠️ Návrh packetu měřil na `cb1de26`. Čísla vyšla stejně, ale commit byl špatný — proto
tenhle přeměřený řádek. Sabotáž nad červeným baseline nic neměří; kdyby baseline zelený
nebyl, **zastav se**.

### RED 1 — strukturální brána nad produkčním souborem karty

Soubor: `tests/project-allocations.test.js`, blok `describe("výběr projektu — TrackingCard")`.
Test čte **skutečný produkční soubor**, ne kopii. Precedens `tests/tray-authority.test.js`
(✅ přečten celý — čte `../electron/main.cjs` a přes `functionSource` + `Function()` spouští
skutečný zdroj).

```js
const trackingCardSource = readFileSync(
  new URL("../src/features/tracking/TrackingCard.jsx", import.meta.url), "utf8",
);

it("kanárek: čte skutečný soubor karty", () => {          // ← povinný kanárek
  expect(trackingCardSource.length).toBeGreaterThan(400);
  expect(trackingCardSource).toContain("export function TrackingCard");
});

// NEGATIVNÍ půlka
it("nenabízí natvrdo zapsané projekty", () => {
  expect(trackingCardSource).not.toMatch(/const\s+PROJECTS\s*=/);
  expect(trackingCardSource).not.toContain("Web · klientská zóna");   // ← NOVĚ
  expect(trackingCardSource).not.toContain("Interní provoz");         // ← NOVĚ
});

// POZITIVNÍ půlka — bez ní je brána fail-open, viz D2
it("nabídku bere z pravidel a adaptéru", () => {                      // ← NOVĚ
  expect(trackingCardSource).toMatch(/from\s+["']\.\.\/\.\.\/lib\/project-allocations\.js["']/);
  expect(trackingCardSource).toMatch(/from\s+["']\.\.\/\.\.\/lib\/adapters\/projects\.js["']/);
  expect(trackingCardSource).toContain("offerProjects(");
  expect(trackingCardSource).toContain("projectSwitchIntent(");
});
```

#### 🔴 D2 — DÍRA, KTEROU REVIZE NAŠLA

Návrh packetu měl **jen negativní** assertion `not.toMatch(/const\s+PROJECTS\s*=/)`.
Tři způsoby, jak nad ní projít se stále přítomnou vadou:
1. přejmenovat konstantu na `PROJEKTY` / `FALLBACK_PROJECTS` — regulární výraz ji mine;
2. napsat pole rovnou do JSX bez pojmenované konstanty;
3. **smazat výběr projektu úplně** a nenahradit ho ničím — negativní brána je nejzelenější
   nad prázdnou obrazovkou.
Pozitivní půlka výš zavírá všechny tři. **Brána, která umí být zelená nad smazanou funkcí,
neměří.**

**Co to vypíše dnes** (`npm run test:unit -- project-allocations`), ověř, že hlásí právě tohle:
- kanárek **projde** (soubor existuje, má 77 řádků a `export function TrackingCard` na `:7`),
- „nenabízí natvrdo zapsané projekty" **padne** na `const PROJECTS` z `TrackingCard.jsx:5`,
- „nabídku bere z pravidel a adaptéru" **padne** na chybějícím importu.

Když padne kanárek, **nepokračuj** — čteš jiný soubor, než myslíš.

### RED 2 — pravidla R6/R7 (dvoukrokově, aby červená měla správný důvod)

1. Napiš testy nad `offerProjects` **dřív než modul**. První běh spadne na nenalezeném modulu.
   🔴 **Tohle je INSTALAČNÍ červená, ne důkaz** — zapiš ji, ale neber ji jako splněný krok 1 §18.
   ⚠️ Přesné znění hlášky vitestu při chybějícím modulu **jsem neověřil** (nešlo to bez vytvoření
   souborů v repozitáři, který mám jen pro čtení). **Do PR vlož skutečný výpis, ne tenhle popis.**
2. Vytvoř `src/lib/project-allocations.js` s **minimální, ještě neúplnou** implementací
   (`offerProjects` vrátí všechny alokace jako `selectable: true`). Spusť znovu.
   **Tohle je ta pravá červená** a musí vypsat konkrétní rozpor, například:
   - `přečerpaný projekt (112 %) není vybratelný` → `expected true to be false`
   - `alokace platná do včerejška se nenabízí` → `expected length 4 to be 3`
   Doslovný výpis obou běhů do PR.

#### Povinné případy (minimum)

| # | Test | Vstup | Očekávání |
|---|---|---|---|
| 1 | R7 nad prahem | `spentMinutes/allocatedMinutes = 112 %` | v `offered`, `selectable: false`, `blockedReason: "rozpočet vyčerpán — vykazovat nejde"` |
| 2 | R7 hranice | přesně `110,0 %` (`1100/1000`) | `selectable: true` |
| 3 | R7 těsně nad | `110,1 %` (`1101/1000`) | `selectable: false` |
| 4 | R7 těsně pod | `109,9 %` (`1099/1000`) | `selectable: true` |
| 5 | R6 platnost | `validTo` = včerejší den vůči `today` | v nabídce **vůbec není** |
| 6 | R6 platnost, budoucnost | `validFrom` = zítřejší den | v nabídce **vůbec není** |
| 7 | R6 platnost, okraje | `validFrom === today` i `validTo === today` | v nabídce **je** (včetně) |
| 8 | R6 GUID | dva projekty se **shodným názvem**, jiným GUID | oba v nabídce, rozlišené `projectId` |
| 9 | R6 přejmenování | týž `projectId`, změněný `projectName` | výběr se nemění |
| 10 | R18 fail-closed | `timeEnabled` = `undefined` / `"1"` / `true` / `"TRUE"` / `""` | `outcome: "disabled"`, `offered: []` |
| 11 | Prázdno | žádná platná alokace | `outcome: "empty"`, `reason: "Nemáš dnes žádný projekt s alokací"` |
| 12 | Nula alokace | `allocatedMinutes = 0` | **v nabídce není** (OQ-3), `spentPercent` nikde nevrací `NaN` |
| 13 | Samé přečerpané | jediná alokace, 130 % | `outcome: "ok"`, `offered.length === 1`, `selectable: false` — hláška „nemáš žádný projekt" **se neukáže** (OQ-3) |
| 14 | **R11 switch** | `projectSwitchIntent(offer, "A", "B", true)`, B vybratelné | `{ kind: "switch" }` — **nikdy `stop`** |
| 15 | **R11 noop** | `projectSwitchIntent(offer, "A", "A", true)` | `{ kind: "noop" }` |
| 16 | 🔴 **D1 přečerpaný nejde spustit** | `projectSwitchIntent(offer, null, "<GUID přečerpaného>", false)` | `{ kind: "blocked" }` — **nikdy `start`**. Tohle je acceptance `spec.md` §8 |
| 17 | 🔴 **D1 přečerpaný nejde přepnout za běhu** | `projectSwitchIntent(offer, "A", "<GUID přečerpaného>", true)` | `{ kind: "blocked" }` — **nikdy `switch`** |
| 18 | 🔴 **D1 neznámé GUID** | `projectSwitchIntent(offer, null, "guid-mimo-nabidku", false)` | `{ kind: "blocked" }` |

### RED 3 — money guard R8 (sazba se nikdy neodesílá)

```js
it("adaptér odmítne alokaci se sazbou", () => {
  expect(() => normalizeAllocation({ ...vzor, hourlyRate: 850 })).toThrow(TypeError);
});
it("pravidla odmítnou alokaci se sazbou i mimo adaptér", () => {          // ← NOVĚ, viz D3
  expect(() => offerProjects([{ ...vzor, sazbaKc: 850 }], "true", "2026-09-01"))
    .toThrow(TypeError);
});
it("rateFieldName pozná zakázané pole", () => {                            // ← NOVĚ
  expect(rateFieldName({ hourlyRate: 1 })).toBe("hourlyRate");
  expect(rateFieldName({ projectId: "x" })).toBeNull();
});
```

#### 🔴 D3 — DÍRA, KTEROU REVIZE NAŠLA

Návrh packetu měl jako druhý money test:
`for (const item of offer.offered) expect(rateFieldName(item)).toBeNull();`
**To je tautologie.** Položky v `offered` skládá `offerProjects` pole po poli z pevného
seznamu sedmi klíčů — sazba se tam z principu dostat nemůže, ať je vstup jakýkoli.
Test by byl zelený i nad implementací, která `normalizeAllocation` vůbec nemá.
Skutečné riziko je jinde: **`offerProjects` bere `allocations` jako libovolné pole a nikde
neříká, že musely projít adaptérem.** Server ve v2 pošle syrová data a někdo je předá přímo.
Proto pravidla R8 vymáhají **znovu, na svém vstupu** (řádek v tabulce §10.2) a test výš to měří.

### ZELENÉ, které musí ZŮSTAT zelené (poměr 2–3 červené : 1 zelená, `plan.md` §3 bod 4)

1. Projekt se **109,9 %** a platnou alokací **je** v nabídce a `selectable: true` (případ 4).
2. Všech **77 stávajících testů** zůstává zelených — zejména `tests/queue.test.js` (11 `it`)
   a `tests/tray-authority.test.js` (2 bloky, z toho `it.each` s pěti případy → **7 testů**;
   ✅ obě čísla ověřena). Nová story do nich nesahá.

### Zákazy při psaní testů

- 🔴 **Nepřidávej závislost** (`@testing-library/react` ani jinou). `vitest.config.js` má
  `environment: "node"` (✅ ověřeno) a React render test by si vynutil jsdom i novou knihovnu —
  to je rozšíření scope. Logika je proto čistá a testuje se v Node; komponenta se kryje
  strukturální bránou (RED 1) a live-verifikací.
  ⚠️ Pozn.: `jsdom` **je** v `devDependencies` (`^29.1.1`), ale `vitest.config.js` ho nepoužívá.
  To není pozvánka ho zapnout — změna `environment` je změna měřidla pro všech 77 testů.
- 🔴 **Netestuj kopii logiky.** Test smí volat jen **produkční** export, případně číst
  **produkční** soubor.
- Nové moduly spadají do `jsconfig.json` `include: ["src/lib/**/*.js", "tests/**/*.js"]`
  (✅ ověřeno) → **jedou přes `tsc --noEmit -p jsconfig.json` s `checkJs: true`**. JSDoc typy
  proto musí sedět, jinak spadne `npm run typecheck`.
- 🔴 **`src/lib/**` má v ESLintu jen `globals.browser`** (§9) — žádný `process`, `require`
  ani `node:*`. Testy v `tests/**` mají `globals.node`, tam `readFileSync` v pořádku je.

---

## 14. Sabotážní testy

Vzor je `scripts/akceptace/E2-sabotaze.sh` (✅ funkce `zelena_brana:13`, `cervena_brana:25`,
`over_cisty_cil:37`).

### 🔴 Kdo sabotáže pouští

Návrh packetu si protiřečil: §14 nařizoval `git add`, `git commit`, `git checkout` a `git mv`,
zatímco §19 psal *„Codex ve worktree needituje git … `git add`, `fetch`, `merge`, `checkout`
mu v sandboxu spadnou na `Operation not permitted`"*.
➡️ **Sabotážní kolo pouští ORCHESTRÁTOR, ne Codex.** Codex napíše kód a testy a skončí;
orchestrátor commitne a teprve pak sabotuje. Pořadí je závazné: **nejdřív
`git add -A && git commit`, teprve pak brány a sabotáže** — kolo končí `git checkout`
a nad necommitnutou prací by práci smazalo (`BEH-NOC.md`).

### Schéma pro každou sabotáž

**zelený baseline → mutace → ověř, že mutace TREFILA cíl → brána MUSÍ zčervenat →
`git checkout HEAD -- <soubor>` → brána MUSÍ být zase zelená.**
Sabotáž, kterou brána nechytí, je **důkaz, že brána neměří** — pak se opravuje brána, ne test.

🔴 **`perl -0pi -e` bez shody skončí EXIT=0 a soubor nechá být.** Proto je po každé mutaci
**povinný `git diff --stat -- <soubor>` s nenulovým výstupem**; samotný `grep -c` nestačí,
protože u záměny na již existující řetězec vrátí kladné číslo i bez provedené změny.
**Mutace, která minula cíl, vyrábí falešnou červenou a je bezcenná.**

⚠️ **Řetězce v mutacích níž jsou odhad tvaru kódu, který ještě neexistuje.** Ani jednu jsem
nespustil — nebylo proti čemu. **Definice sabotáže je proto SÉMANTICKÁ** (sloupec „co se
rozbije"); příkaz je jen návrh. Když neprojde `git diff`, uprav příkaz podle skutečného
zdroje — **ne bránu**.

| # | Co se v produkčním kódu rozbije | Návrh mutace | Která brána musí zčervenat |
|---|---|---|---|
| **S1** | Odstraněný práh 110 % | `perl -0pi -e 's/spentPercent\(allocation\) > OVERSPEND_LIMIT_PERCENT/false/s' src/lib/project-allocations.js` | `npm run test:unit -- project-allocations`, případy 1 a 3 |
| **S1b** | 🔴 **NOVĚ** — obrácená ostrost hranice (`>` → `>=`) | v témž výrazu zaměň `>` za `>=` | případ 2 (přesných 110,0 % musí zůstat vybratelných) |
| **S2** | Posunutý práh nahoru | `perl -0pi -e 's/OVERSPEND_LIMIT_PERCENT = 110/OVERSPEND_LIMIT_PERCENT = 200/' src/lib/project-allocations.js` | případy 1 a 3 |
| **S2b** | 🔴 **NOVĚ** — posunutý práh dolů | totéž s `= 100` | případ 4 (109,9 % musí zůstat zelené) |
| **S3** | Vypnutý fail-closed vypínač | `perl -0pi -e 's/timeEnabled !== "true"/false/' src/lib/project-allocations.js` | případ 10 |
| **S4** | Sazba propuštěná do DTO (R8) | 🔴 **OPRAVENÝ CÍL:** `perl -0pi -e 's/\(sazb\|rate\|hourly\|mzd\|wage\|price\|cena\|czk\)/nikdy-neexistujici-pole/' `**`src/lib/adapters/projects.js`** | RED 3, všechny tři testy |
| **S5** | Návrat natvrdo zapsaných projektů | `perl -0pi -e 's/export function TrackingCard/const PROJECTS = ["A"];\nexport function TrackingCard/' src/features/tracking/TrackingCard.jsx` | RED 1, negativní půlka |
| **S5b** | 🔴 **NOVĚ** — natvrdo zapsané projekty **pod jiným jménem** | totéž, ale `const PROJEKTY = ["A"];` a odstraň volání `offerProjects(` | RED 1, **pozitivní** půlka. Bez ní S5b projde |
| **S6** | 🔴 **Kanárek brány** — přejmenovaný soubor karty | `mv src/features/tracking/TrackingCard.jsx src/features/tracking/TrackingCardX.jsx` (**`mv`, ne `git mv`** — viz „Kdo sabotáže pouští"); zpět `mv` opačně | RED 1 musí **zčervenat** (`ENOENT` při načtení modulu / padlý kanárek), **ne projít**. Když projde, brána je fail-open |
| **S7** | Identita podle názvu místo GUID | `perl -0pi -e 's/allocation\.projectId/allocation.projectName/' src/lib/project-allocations.js` | případ 8 |
| **S8** | 🔴 **NOVĚ** — odstraněný filtr platnosti (R6) | zneškodni tělo `isWithinValidity` tak, aby vracelo vždy `true` | případy 5 a 6. **Bez S8 se dá smazat celý datový filtr a všech sedm sabotáží z návrhu zůstane zelených** |
| **S9** | 🔴 **NOVĚ** — přepnutí projektu přes stop (R11) | v `projectSwitchIntent` zaměň návrat `"switch"` za `"start"` | případ 14 |
| **S10** | 🔴 **NOVĚ** — díra D1: přečerpaný projekt jde spustit | v `projectSwitchIntent` odstraň větev vracející `"blocked"` | případy 16, 17, 18 |

**Před každou mutací:** `git diff --quiet HEAD -- <soubor>` musí projít (cíl je shodný s `HEAD`).
**Po každém kole:** `git checkout HEAD -- <soubor>` (u S6 přejmenovat zpět) a
`git status --short` musí být **prázdný**.

⚠️ **Nespouštěj `scripts/akceptace/E2-sabotaze.sh`** — jeho část (b) staví na `ui-smoke`
(✅ ověřeno, `:59` `node scripts/ui-smoke.mjs`, `:92` `zelena_brana "ui-smoke před mutací"`),
který je na `main` červený, takže skript korektně odmítne měřit a nic ti neřekne.
Sabotáže B6 se pouštějí jednotlivě, ručně, příkazy výš.

---

## 15. Projektové brány

**Měř stav PŘED případnou rourou** (`AGENTS.md`). **Na macOS nepoužívej `timeout`.**

```
npm run lint        # eslint .                        → EXIT musí být 0
npm run typecheck   # tsc --noEmit -p jsconfig.json   → EXIT musí být 0  (kryje nové src/lib/**/*.js)
npm run test:unit   # vitest run                      → EXIT musí být 0
npm run build       # vite build                      → EXIT musí být 0  (CI ho pouští také)
```

Zkratka `npm run gates` = `lint && typecheck && test:unit` (✅ ověřeno v `package.json`).
CI (`.github/workflows/ci.yml`) běží na `macos-latest`, Node 22, `npm ci` → `npm run gates`
→ `npm run build`. `ui-smoke` i `audio-smoke` jsou v CI vypnuté (`if: ${{ false }}`) —
potřebují GUI, zvuk a oprávnění Záznam obrazovky. **Spouští je člověk na svém Macu.**

🔴 **Zakázané „opravy" při padající bráně** (`MASTERPLAN.md` §13, ověřeno doslova):
*oprav vadu · neoslabuj assertion · nemaž test · nepřidávej baseline · nepoužívej force ·
nevypínej workflow · nepoužívej skip CI jako cestu kolem skutečné brány.*
**Po třetím neúspěšném opravném kole zastav a vrať přesný blocker a důkazy.**

---

## 16. Live-verification scénář

Kroky pro **člověka u Macu**. `ui-smoke` ani `audio-smoke` **nespouštěj v sandboxu**
(`plan.md` §4) — tenhle scénář je ruční.

### Příprava (dvě pasti, které stojí celé kolo)

1. 🔴 **`ps aux | grep "[l]udone-desktop.*Electron"` musí být PRÁZDNÉ.**
   `main.cjs` volá `requestSingleInstanceLock()` a druhá instance skončí **exit 0 bez jediné
   hlášky** — vypadá to jako čistý konec, ne jako kolize (`DAN-TODO.md` §3a, řádek 295).
2. `npm run gates` → tři EXIT=0. Pak `npm run build` — panel se načítá přes
   `loadFile(dist/index.html)` (✅ `main.cjs:311`), takže **bez buildu testuješ starou verzi**.
3. `npm start`.

### Kroky

| # | Krok | Očekávaný výsledek |
|---|---|---|
| 1 | Klik na ikonu v liště | Otevře se panel 366×792 |
| 2 | Otevři výběr projektu v kartě LuTrack | Zobrazí se pole „Hledat projekt…", skupiny „Naposledy" a „Všechny" |
| 3 | **KANÁREK A** — spočítej řádky | **≥ 3 nabízené projekty** a **právě 1 zašedlý** s textem „rozpočet vyčerpán — vykazovat nejde" |
| 4 | **POZITIVNÍ KONTROLA** — spusť měření na platném projektu | Časovač **se rozeběhne**, hlavička ukazuje „Měří se čas" |
| 5 | Zastav a klikni na **zašedlý** projekt | **Nic se nespustí**, hlavička zůstává v klidu |
| 6 | Spusť platný projekt a **za běhu přepni** na jiný platný | Uplynulý čas **nespadne na nulu** (R11). Zapiš hodnotu před a po |
| 7 | 🔴 **NOVĚ — KANÁREK B (GUID):** ve vzorku doč jsou dva projekty se **shodným názvem** a jiným GUID. Spusť měření na tom druhém | To, co si aplikace pamatuje jako běžící projekt, **musí odpovídat druhému GUID**, ne prvnímu se stejným názvem. Bez toho není R6 ověřená naostro — jen v testu |
| 8 | 🔴 **NOVĚ:** za běhu klikni na **zašedlý** projekt | Časovač **běží dál na původním projektu** a nepřepne se (D1 + R11) |
| 9 | Napiš do hledání kus názvu | Seznam se zúží, zašedlý řádek zůstává zašedlý |
| 10 | Projdi výběr **jen klávesnicí** (Tab, šipky, Enter) | Focus je vidět, blokovaný řádek se nedá potvrdit |
| 11 | Screenshot do `.runtime/` a porovnej s `design/navrh/nahled.html`, blok 2 (řádky 419–441) | Hierarchie, mezery, copy sedí |

### 🔴 KANÁRKY — kdy je výsledek ⛔ NEMĚŘENO, ne ✅

Brána, která nic nenajde, **není zelená — je nezměřená** (`spec.md` §11).

| Pozorování | Verdikt |
|---|---|
| V kroku 3 je seznam **prázdný** nebo v něm **není zašedlý řádek** | ⛔ **NEMĚŘENO** — nenačetl se vzorek, nebo je `DESKTOP_TIME_ENABLED` vypnuté, nebo B5 nevystavila most. **Ne** ✅ |
| Krok 4 (pozitivní kontrola) **nerozeběhne** časovač | ⛔ **NEMĚŘENO pro celý scénář.** Bez ní je „zašedlý projekt nic nespustil" k nerozeznání od „nespustí se nic a nikdy". Negativní test bez pozitivní kontroly není důkaz |
| Krok 6 nebo 8 nejde provést, protože B5 přepnutí za běhu nevystavila | ⛔ **NEMĚŘENO** pro R11 + zapsat blocker |
| Krok 7 nejde provést, protože nevidíš, které GUID appka drží | ⛔ **NEMĚŘENO** pro R6 — a napiš to; „názvy sedí" není důkaz GUID |
| Panel se během kontroly schová (ztráta fokusu) | ⛔ opakuj; `shouldHidePanelOnBlur` má výjimku jen pro dialogy oprávnění a Nastavení |
| Cokoli z toho projde | 🧪 nebo ✅ podle toho, co jsi **opravdu viděl**; zelené testy zůstávají 🧪 |

Výstup zapiš značkami `✅ ověřeno naostro · 🧪 zelené testy · ⛔ neověřeno` (`AGENTS.md`).
Screenshoty nech v `.runtime/` (✅ `.gitignore:15`); do `dukazy/` patří jen `vysledek.json`
a `README.md` (✅ `.gitignore:33–40`, R24).

---

## 17. Rollback

- **Jeden PR = jedna story = jeden revert.** `plan.md` §1: *„Každá story je samostatně
  revertovatelná. Žádná migrace v1 (desktop nikam nepíše)."*
- Postup: `git revert <sha merge/commitu B6>`. Nic dalšího.
- **Žádná migrace, žádná perzistovaná data, žádný flip vypínače** — B6 nic z toho nedělá.
  Vypínač `DESKTOP_TIME_ENABLED` se v této story **nezapíná**; leží mimo ni a v `.env.example`
  zatím vůbec není (✅ ověřeno).
- Po revertu se `TrackingCard.jsx` vrátí k natvrdo zapsaným projektům a `DSK-F012` v matici
  `spec.md` §3 se vrací na `delivery: no-code`. Tuhle větu napiš do PR.
- Nové soubory `src/lib/adapters/projects.js` a `src/lib/project-allocations.js` revert odstraní.
  **Před mergem ověř, že je nikdo jiný neimportuje**
  (`grep -rn "project-allocations\|adapters/projects" src/ electron/ tests/`) — dnes ✅ nula,
  ale B7 běží souběžně a mohla by si je vzít.

---

## 18. Definition of Done

**Převzato z `plan.md` §3 — doslova (✅ ověřeno na řádcích 178–187):**

1. Cílený test **napřed** a viděný **červený** ze správného důvodu.
2. `npm run lint`, `typecheck`, `test:unit` — všechny EXIT=0, **měřeno před rourou**.
3. Sabotáž, která prokazatelně chytá odstranění guardu, s **doslovným výpisem**.
4. Nejméně jeden případ, který musí zůstat **zelený** (poměr 2–3 červené : 1 zelená).
5. Diff přečtený Claudem, u money a RBAC povinně.
6. PR odkazuje na Feature ID a tenhle plán.
7. **Bez produkce a bez merge** před Danovým finálním schválením.

**Navíc, specificky pro B6 (money path):**

8. V PR je **doslovný výpis obou červených z RED 2** — instalační i té pravé nad existujícím modulem.
9. Sabotáže **S1–S10 doloženy jednotlivě**, u každé **`git diff --stat` po mutaci** jako důkaz,
   že mutace trefila. Včetně **S6 (kanárek)**: přejmenování `TrackingCard.jsx` musí bránu
   **zčervenat**. Fail-open brána = story není hotová.
10. `git status --short` je po sabotážním kole **prázdný**.
11. **Žádná změna v `electron/main.cjs`, `electron/preload.cjs`, `electron/tracking.cjs`,
    `src/App.jsx`, `scripts/ui-smoke.mjs`, `design/**`** — doloženo výpisem `git diff --stat`.
12. `grep -rn "hourlyRate\|sazb\|hourlyRadeSnapshot\|wage\|price" src/lib/ src/features/tracking/`
    vrací nulu — a v PR je i **kanárek k tomuhle grepu**:
    `grep -c "rateFieldName" src/lib/adapters/projects.js` musí být ≥ 1.
    Grep, který nenajde ani kanárka, je rozbitý grep, ne důkaz čistoty.
13. **Identita je GUID**: v diffu se nikde neporovnávají projekty podle názvu.
14. 🔴 **Acceptance `spec.md` §8 je doložená celá**: nejen že přečerpaný projekt je v seznamu
    zašedlý, ale že `projectSwitchIntent` na jeho GUID vrací `blocked` (případy 16–18).
    Samotné `selectable: false` **nestačí**.
15. Kolize s `scripts/ui-smoke.mjs` (řádky 224, 226, 234, 338–342) je v PR **jmenovitě popsaná**
    a zapsaná v `DAN-TODO.md`; `ui-smoke.mjs` **není** v diffu.
16. Čtyři osy `DSK-F012` po změně vypsané v PR:
    `scope: approved · delivery: pr-open · exposure: disabled · verification: tests-green`.
    🔴 **Ne `verified-live`.**
17. 🔴 **Všech pět otevřených otázek OQ-1 až OQ-5 je v PR vypsaných** i s tím, jaký pracovní
    výklad story zvolila. **OQ-2 (money hranice) a OQ-5 (vlastnictví main.cjs) jsou i v `DAN-TODO.md`.**
18. Každý blocker (chybějící most B5, chybějící `openExternal`, chybějící `DESKTOP_TIME_ENABLED`
    v `.env.example`) je v `DAN-TODO.md` s doporučeným defaultem.

---

## 19. Implementátor

**Codex** (`gpt-5.6-sol`), viditelně v Orce:
`~/.claude/scripts/orca-codex.sh start "B6 výběr projektu z alokací" "<zadání>"`.

🔴 **Codex ve worktree needituje git, edituje jen SOUBORY.** `git add`, `fetch`, `merge`,
`checkout` mu v sandboxu spadnou na `Operation not permitted`. Do zadání patří věta
**„NEDĚLEJ ŽÁDNOU git operaci"**; commituje orchestrátor, **hned po doběhnutí**, a on
také pouští sabotážní kolo (§14).

🔴 **Jeden strom = jeden zapisovatel.** B6 a B7 sdílejí `TrackingCard.jsx` — **nesmějí běžet
ve stejném worktree současně**. Vlastní strom:
`orca worktree create --name desktop-b6 --display-name "Desktop: výběr projektu z alokací"`.

🔴 **Nejdřív předpodmínka z §11.** Když `electron/tracking.cjs` neexistuje nebo preload nemá
`tracking:*`, Codex se **nespouští vůbec**.

### 🔴 Co implementátor NESMÍ (`MASTERPLAN.md` §9, ověřeno doslova na řádcích 636–645)

- **rozšířit scope;**
- **změnit schválený design;**
- **vytvořit nový design-system pattern bez tasku a schválení;**
- **změnit API/datový kontrakt bez aktualizace plánu;**
- **oslabit test;**
- **obejít bránu;**
- **rozhodnout nové money nebo RBAC pravidlo.**

> Pokud task packet nestačí, vrátí konkrétní otázku koordinátorovi. **Nehádá.**

A navíc, z `plan.md` §4 (doslova) a `BEH-NOC.md`:
zapojovat frontu k serveru, který neexistuje · sahat na `design/**` · flipovat cizí vypínače ·
**psát do Tabidoo (za všech okolností, i nepřímo)** · pushovat do `main` · vyrábět výjimku
z brány · pouštět `ui-smoke` v sandboxu · pouštět migraci B12 · číst nebo vypisovat secrets
(`.env*`, `*.key`, `*.pem`, `~/.ssh`) · commitnout zvuk ze skutečné schůzky · rozmrazit T1.

**Při rozporu mezi dokumenty se implementátor ZASTAVÍ a vrátí konkrétní otázku**
(`spec.md`, Autorita při rozporu). Pořadí autority: záměr → `intent.md`; chování → `spec.md`;
vzhled a interakce → schválený design čtený přes `spec.md`; technická realizace → `plan.md`.
🔴 **Pět takových rozporů už tenhle packet našel a předrozhodl je (OQ-1 až OQ-5).** Zbylé
neřeš sám — vrať otázku.

---

## 20. Reviewer

**Claude (hlavní session / Opus)** — čtení diffu je u této story **povinné**, ne volitelné:

- `plan.md` §3 bod 5: *„Diff přečtený Claudem, u money a RBAC povinně."*
- `BEH-NOC.md`: *„Money-critical kód od Codexu nikdy nemerguj bez přečtení diffu."*
- `AGENTS.md`: *„Money-critical a bezpečnostní kód vyžaduje review nad diffem."*

**Na co se reviewer dívá především:**

1. **Práh 110 % a jeho ostrost** — je porovnání `>`, ne `>=`? Testuje se 109,9 · 110,0 · 110,1?
   Jsou vstupy v plovoucí čárce přesné (`1100/1000`, ne třetiny)?
2. 🔴 **D1 — druhá brána.** Vrací `projectSwitchIntent` na GUID přečerpaného projektu `blocked`
   i pro `start` i pro `switch`? **Bez toho acceptance `spec.md` §8 není splněná**, i kdyby
   bylo všechno ostatní zelené.
3. **GUID vs. název** — nikde se neporovnává podle `projectName`; nabídka drží dva stejnojmenné.
4. **R8** — v žádném DTO, propu ani logu není sazba; `offerProjects` odmítá syrový vstup se sazbou.
5. **Fail-closed** — `timeEnabled !== "true"`; chybějící hodnota nenabídne nic; selhání
   adaptéru nespadne zpět na natvrdo zapsaný seznam.
6. 🔴 **RED 1 má pozitivní půlku** (importy + `offerProjects(` + `projectSwitchIntent(`).
   Brána jen s `not.toMatch` je fail-open a story není hotová.
7. **Vlastnictví bloků** — `git diff --stat` neobsahuje `electron/main.cjs`, `preload.cjs`,
   `tracking.cjs`, `scripts/ui-smoke.mjs`, `src/App.jsx`, `design/**`, `spec.md`, `plan.md`.
8. **Sabotáže** — každá doložena doslovným výpisem **a `git diff --stat` po mutaci**;
   **S6 kanárek** musí být červený; **S8, S9, S10** existují.
9. **Ani jeden `✅`** u něčeho, co nikdo neviděl běžet.
10. **OQ-1 až OQ-5 jsou v PR vypsané**, OQ-2 a OQ-5 i v `DAN-TODO.md`.

**Review passy podle `MASTERPLAN.md` §14 (✅ ověřeno, řádky 887–907):** Correctness ·
Security a RBAC · **Money safety** · Spec compliance · Plan compliance · Design compliance ·
Verification evidence.

---

## Příloha — otevřené otázky a rozhodnutí packetu

🔴 **Rozdíl proti návrhu:** návrh měl devět „rozhodnutí packetu" (P1–P9) a **žádnou otevřenou
otázku**. Tři z nich byla ve skutečnosti **money rozhodnutí přes rozpor ve zmrazených
dokumentech**, což `MASTERPLAN.md` §9 implementátorovi zakazuje. Rozdělené správně:

### A. Otevřené otázky — MUSÍ do PR, dvě i do `DAN-TODO.md`

| # | Otázka | Pracovní výklad (aby šlo pokračovat) | Kam |
|---|---|---|---|
| **OQ-1** | Prázdný stav nemá schválený artboard — copy ano (`spec.md` §6), vzhled ne (není v `coveredScreens`) | Složit jen z prvků bloku 2 náhledu; nový pattern nevymýšlet | PR |
| **OQ-2** | 🔴 **Money hranice.** `spec.md` R7 („nad 110 %", vidět) × `plan.md` §1 bod 3 („pod 110 %") × `plan.md` §2b („není v nabídce"). Tři věty, tři významy | Podle **R7**: zašedlý a vidět; `> 110` blokuje; přesně 110,0 % ještě jde | **PR + `DAN-TODO.md`** |
| **OQ-3** | Co s `allocatedMinutes = 0` a co s případem „všechny alokace přečerpané" | 0 minut → z nabídky pryč; samé přečerpané → `outcome: "ok"`, ne lživé „nemáš žádný projekt" | PR |
| **OQ-4** | Tvar zbývajícího času: náhled má na čtyřech řádcích tři různé tvary | Dlouhý u prvního „Naposledy", krátký u ostatních, žádný u přečerpaného — reprodukuje obrázek 1:1 | PR |
| **OQ-5** | 🔴 **Vlastnictví.** `plan.md:170` a `podklady-vytezene.md:172` říkají, že B6 sahá do `main.cjs`/`preload.cjs`; `plan.md:147` a tabulka vlastnictví říkají opak | B6 tam **nepíše**; když je most potřeba a chybí, je to **blocker**, ne úkol | **PR + `DAN-TODO.md`** |

### B. Rozhodnutí packetu — technická, nemění money pravidla

| # | Rozhodnutí | Proč | Riziko |
|---|---|---|---|
| P1 | Pravidla R6/R7/R8/R11 leží v `src/lib/project-allocations.js`, **ne** v `src/lib/adapters/**` | Architecture Spine zakazuje business pravidla v adaptérech | Odchylka od doslovného výčtu souborů v `plan.md` §2b — do PR napsat |
| P2 | Tvar `Allocation` (minuty, `YYYY-MM-DD`, `lastUsedAt`) | Ve zmrazených dokumentech není nikde | Server může chtít jiný tvar; překlad je pak věcí adaptéru, ne volajících |
| P3 | `today` jako `YYYY-MM-DD`, platnost **včetně** obou krajů, `new Date()` uvnitř čistých funkcí zakázané | R6 říká „k dnešnímu datu" a nic víc | Půlnoc a časová zóna — kdo `today` skládá, rozhoduje o hranici dne. Leží to mimo B6 |
| P4 | Přečerpaný projekt **zůstává v seznamu** zašedlý | R7 + schválený náhled řádek 437 | Viz **OQ-2** |
| P5 | „Naposledy" se bere z `lastUsedAt` v adaptéru, ne z paměti rendereru | Spine: renderer nedrží stav | Zdroj `lastUsedAt` ve v1 neexistuje → v lokálním vzorku je vymyšlený, a musí to být v komentáři |
| P6 | Vypínač času se v pravidlech kontroluje znovu (obrana do hloubky) | R18 „musí mít vlastní test"; precedens `queue.js:202` | Zdvojení s bránou v `tracking.cjs` od B5 — neškodné, obojí fail-closed |
| P7 | Prázdný stav ukazuje `app.ludone.cz` **jako text**, ne odkaz | Navigace v panelu ukončuje běžící nahrávku (`main.cjs:319`) | Uživatel musí adresu opsat ručně, dokud most `openExternal` nevznikne |
| P8 | 🔴 **NOVĚ:** `projectSwitchIntent` bere `offer` a umí `blocked` | Bez toho acceptance `spec.md` §8 („nejde na něj vykázat") není vymáhaná nikde | Změna podpisu proti návrhu packetu — kdo návrh už četl, musí ho přepsat |
| P9 | 🔴 **NOVĚ:** vzorek alokací je konstanta v modulu, ne soubor ani `process.env` | `eslint.config.js` dává `src/**` jen `globals.browser`; `no-undef` je error | Serverová varianta bude asynchronní — proto je `listAllocations()` už dnes `async` |

---

## Co revize opravila

Revize otevřela kód, spustila brány a porovnala packet s pěti zmrazenými dokumenty.
Návrh packetu byl věcný a většina čísel řádků v něm seděla. Neseděly tyhle věci:

### Nepravdy proti kódu a dokumentům

1. **HEAD byl špatný.** Návrh psal `cb1de26a…`; skutečný HEAD je
   `0380bc0014c54231d1bbe045d7d87176ddbce847` — o šest commitů dál. Baseline přeměřen naostro
   (lint 0 · typecheck 0 · 9 souborů / 77 testů, EXIT 0). **Plan SHA `c7b1bb7` byl správně.**
2. **„`src/lib/queue.js` je sdílená rendererem i hlavním procesem" je nepravda.**
   `grep -rn "lib/queue"` ukazuje, že ji importuje **jen její vlastní test**; `spec.md`
   poznámka ⁵ to říká taky. `electron/queue.cjs` s ní nesdílí ani řádek. Byla to jediná
   opora pro architektonické rozhodnutí P1 — P1 zůstává, opora se zúžila.
3. **`<select>` je na řádcích 45–47, ne 43–49** (43–49 je obalující `<label class="select-field">`).
4. **`.tracking-card` jako samostatná třída ve `styles.css` neexistuje** — jen
   `.tracking-card.is-active:482`. Návrh ji uváděl mezi „existujícími třídami k použití".
5. **Tvar `zbývá H:MM z alokace` neplatí pro všechny řádky.** Náhled má na čtyřech řádcích
   tři různé tvary a u přečerpaného žádný. Otevřeno jako **OQ-4**.
6. **`Zbývá z alokace` není copy B6** — je z bloku 3 (běžící karta), který patří B5.
7. **„agendy nesdílejí start ani stop" není `decisions.md` M9**, ale verdikt kalendář
   v `docs/ux/cesta-uzivatele-2026-09-01.md:17`. M9 zní jinak.
8. **`npm run typecheck` je `tsc --noEmit -p jsconfig.json`**, ne bare `tsc --noEmit`.

### Rozpory ve zmrazených dokumentech, které návrh zamlčel a rozhodl sám

9. 🔴 **OQ-2 — money hranice.** `spec.md` R7 („nad 110 %", zašedlý a vidět),
   `plan.md:49` („čerpáním **pod** 110 %") a `plan.md:147` (přejímka B6: „přečerpaný projekt
   **není v nabídce**") říkají tři různé věci. Návrh je vydával za jednu a rozhodl je jako
   P4/P6 bez zmínky. To je **money rozhodnutí**, které `MASTERPLAN.md` §9 implementátorovi
   výslovně zakazuje. Teď je to otevřená otázka do PR i do `DAN-TODO.md`, s doloženým
   pracovním výkladem (R7 vyhrává, protože rozpor je o chování).
10. 🔴 **OQ-5 — vlastnictví `main.cjs`.** Návrh tvrdil kategoricky „ANI JEDEN blok" a jako
    zdroj tabulky sdílených souborů uvedl `podklady-vytezene.md` — ale vynechal jeho řádek 172,
    který B6 přiřazuje `electron/tracking.cjs`, `main.cjs` i `preload.cjs`, a `plan.md:170`,
    kde stojí *„B6 · B7 … sahají do jiných bloků `main.cjs`"*.

### Díry v měřidle (test zelený, vada přítomná)

11. 🔴 **D1 — přečerpaný projekt se dal spustit.** `projectSwitchIntent` v návrhu neměl přístup
    k nabídce, takže na GUID přečerpaného projektu vracel `{ kind: "start" }` — a **všech
    jedenáct testů z návrhu bylo zelených**. Acceptance `spec.md` §8 („nejde na něj vykázat")
    tím nebyla vymáhaná nikde. Podpis změněn, přibyly případy 16–18 a sabotáž S10.
12. 🔴 **D2 — strukturální brána byla fail-open.** Měla jen `not.toMatch(/const PROJECTS =/)`.
    Projde nad přejmenovanou konstantou, nad polem vepsaným rovnou do JSX i nad **úplně
    smazaným výběrem projektu**. Přibyla pozitivní půlka (importy, `offerProjects(`,
    `projectSwitchIntent(`) a sabotáž S5b.
13. 🔴 **D3 — money test R8 byl tautologie.** `for (item of offer.offered) rateFieldName(item)`
    testoval objekty, které si `offerProjects` samo skládá z pevného seznamu klíčů — zelený
    i nad implementací bez jediného guardu. Nahrazeno vymáháním R8 na vstupu `offerProjects`.
14. **Chyběla sabotáž na filtr platnosti (R6) i na R11.** Smazání celého datového filtru
    nechávalo všech sedm sabotáží z návrhu zelených. Přibyly **S8** a **S9**, plus **S1b/S2b**
    na ostrost a směr posunu prahu.
15. **Sabotáž S4 mířila na špatný soubor** — regulární výraz sazby žije podle §10.1
    v `src/lib/adapters/projects.js`, S4 mutovala `src/lib/project-allocations.js`.
    `perl -0pi` bez shody skončí EXIT=0 a tiše nic neudělá. Cíl opraven a u **všech** sabotáží
    je nově povinný `git diff --stat` jako důkaz zásahu (samotný `grep -c` nestačí).
16. **S6 používala `git mv`, zatímco §19 Codexu git zakazuje.** Vyjasněno, že sabotážní kolo
    pouští orchestrátor; příkaz změněn na prosté `mv`.

### Blockery, které návrh zlehčil

17. 🔴 **Nejnebezpečnější věta návrhu:** *„timeEnabled … když ji nemá, předej `undefined` —
    fail-closed je správný výsledek, ne chyba k obejití."* `electron/preload.cjs` (přečten celý)
    **nevystavuje žádné `tracking:*` ani `timeEnabled`**, `electron/tracking.cjs` neexistuje
    a `App.jsx:86` předává jediný prop. Podle návrhu by tedy vznikl panel, který **nikdy nic
    nenabídne**, se všemi branami zelenými — přesně to, co `spec.md` §3 popisuje jako
    „devět zelených bran nad prací, která se nikdy nespustila". Změněno na **tvrdou
    předpodmínku se spustitelnou kontrolou**: bez mostu se B6 nespouští.
18. **Chyběl mantinel prostředí:** `eslint.config.js` dává `src/**` jen `globals.browser`,
    takže `process.env`, `require` ani `node:fs` v `src/lib/**` neprojdou přes `npm run lint`.
    Lokální vzorek proto musí být konstanta v modulu (P9).
19. **Pseudo-podpisy v §10 byly ve fence `js`, ale se syntaxí TypeScriptu** (`fixture?`,
    `): Allocation`). Opsané doslova rozbijí lint i typecheck. Označeny jako pseudo-podpisy.
20. **Zmizelý designový zdroj.** `approved.json` říká, že designový projekt byl nedostupný už
    při schvalování, a commit `0380bc0` dodává, že artefakt **zmizel úplně**. `nahled.html` je
    jediná dochovaná autorita — doplněno do §6. Zároveň doloženo, že **prázdný stav nemá
    schválený artboard** (v `coveredScreens` není, grep na jeho copy přes `design/**` vrací nulu).

### Doplněno do live-verifikace

21. Přibyl **kanárek B (GUID)** — dva stejnojmenné projekty s jiným GUID; bez něj se R6 ověřuje
    jen v testu a „názvy sedí" se vydává za důkaz identity. A krok 8: klik na zašedlý projekt
    **za běhu** nesmí přepnout ani zastavit.

### Co revize potvrdila jako správné

Plan SHA `c7b1bb7` · `TrackingCard.jsx:5` a jeho 77 řádků · `queue.js:202` `uploadEnabled !== "true"` ·
`main.cjs:311` `loadFile` a `:319` `did-start-navigation` · `ui-smoke.mjs` řádky 224, 226, 234,
338–342 · `ci.yml` `if: ${{ false }}` u obou smoke kroků · `.env.example` bez `DESKTOP_TIME_ENABLED` ·
`jsconfig.json` include `src/lib/**` s `checkJs` · `vitest.config.js` `environment: "node"` ·
`queue.test.js` 11 testů a `tray-authority.test.js` 7 testů · `styles.css` 1353 řádků ·
`design/navrh/nahled.html` blok 2 na řádcích 419–441 a všechny citované copy · `intent.md:91` (N1) ·
`DAN-TODO.md:257` (červený `ui-smoke`) · `STAV.md:47` (chybějící tokeny) · všechny čtyři citace
z `docs/ux/cesta-uzivatele-2026-09-01.md` · `spec.md` §3 poznámka ⁸, §4 R6–R20, §6, §7, §8 ·
`MASTERPLAN.md` §9 (dvacet polí, sedm zákazů) a §13 · `src/lib/adapters/` neexistuje ·
úvaha, že `⛔B1` v DAG je rozhodnutí B1, ne story B1 (doloženo `decisions.md:67/68/72`).

## Co packetu chybí ve spec/plan

- OQ-2 — MONEY HRANICE, největší chybějící vstup: spec.md:152 (R7) říká „nad 110 % je zašedlý a s důvodem“ (tedy VIDĚT, hranice > 110), plan.md:49 říká „nabízí se jen projekty s čerpáním POD 110 %“ (hranice < 110, o jeden případ jinam) a plan.md:147 (přejímka PR pro B6) říká „přečerpaný projekt (>110 %) NENÍ V NABÍDCE“ (opak R7). Tři zmrazené věty, tři významy. Dan musí rozhodnout, který text se opraví. Packet jede podle R7, protože rozpor je o chování, ale je to výklad.
- OQ-5 — VLASTNICTVÍ main.cjs/preload.cjs: plan.md:170 („B6 · B7 … sahají do jiných bloků main.cjs“) a podklady-vytezene.md:172 (B6 = electron/tracking.cjs; electron/main.cjs; electron/preload.cjs; TrackingCard.jsx) říkají, že B6 do main.cjs a preload.cjs píše. Tabulka vlastnictví bloků v plan.md §2 B6 řádek NEMÁ a plan.md:147 uvádí jen src/lib/adapters/ a TrackingCard.jsx. Není určeno, který zdroj platí.
- Co přesně vystaví B5 na mostě: electron/tracking.cjs neexistuje a electron/preload.cjs (přečten celý, 22 řádků) nemá žádný tracking:* kanál. Ownership B5 v plan.md §2 zní jen „registrace tracking:* kanálů, hook na pád rendereru“ — konkrétní kanál pro PŘEPNUTÍ PROJEKTU ZA BĚHU (R11) není jmenovaný nikde. Bez něj je R11 nedosažitelné a B6 si most dodělat nesmí.
- Jak se timeEnabled (DESKTOP_TIME_ENABLED) dostane do rendereru. Vypínač není v .env.example (přečten celý — jen DESKTOP_UPLOAD_ENABLED=false), není v preload.cjs a App.jsx:86 předává TrackingCard jediný prop onActivityChange. Cesta není určená v žádném dokumentu a B6 nesmí sáhnout ani do preload.cjs, ani do App.jsx, ani do .env.example.
- Tvar dat alokace (Allocation DTO): jednotky (minuty vs hodiny), formát platnosti, existence a zdroj lastUsedAt. Ve spec.md, plan.md ani decisions.md není nikde. Packet ho fixuje jako P2, ale je to vymyšlené — pozn.: ludone-data ví, že allocationMD v Tabidoo jsou HODINY, ne člověkodny, takže překlad na minuty je netriviální a v KONTRAKT.md se neověřoval.
- Vzhled prázdného stavu („Nemáš dnes žádný projekt s alokací“): copy je schválené ve spec.md §6, ale obrazovka NENÍ v design/approved.json coveredScreens ani coveredStates a grep na tu větu přes design/** vrací nulu. Artboard neexistuje a zdrojový designový projekt už je pryč (commit 0380bc0).
- Tvar řádku se zbývajícím časem: design/navrh/nahled.html má na čtyřech řádcích tři různé tvary (řádek 428 „zbývá 116:19 z alokace“, 430 „zbývá 42:00“, 435 „zbývá 8:30“, 437 přečerpaný bez časového řádku). Není určeno, jestli je to záměr nebo nedůslednost náhledu.
- Chování při allocatedMinutes = 0 a při stavu „všechny platné alokace jsou přečerpané“. V žádném pravidle není. Druhý případ je nepříjemný: hláška „Nemáš dnes žádný projekt s alokací“ by lhala.
- Jak se vyhodnocuje nabídka na sdíleném účtu zasedacka@makemore.cz. DAG značka ⛔B1 na B6 ukazuje právě sem, ale plan.md §1 posílá sdílené zařízení do story B10. Není určeno, jestli B6 smí nabídku kešovat přes změnu přihlášeného člověka.
- Rozsah CSS pro B6: podklady-vytezene.md:172 u B6 src/styles.css NEUVÁDÍ, ale nové UI (skupiny, zašedlý řádek, hledání, prázdný stav) se bez nových tříd nepostaví. Packet styles.css přidává a ohraničuje značkami, ale je to rozšíření proti podkladu.

## 🔴 Co NEBYLO ověřeno v kódu

Skeptik packet přečetl proti kódu, ale tohle zůstalo bez důkazu.
**Než na tom postavíš implementaci, otevři to.**

- Nespustil jsem scripts/ui-smoke.mjs ani aplikaci (npm start, npm run build). Tvrzení, že B6 rozbije řádky 224/226/234/338–342 ui-smoke.mjs, plyne ze ČTENÍ obou souborů, ne z běhu. Že panel jede z dist/index.html, je z kódu (main.cjs:311), ne z běhu.
- Nespustil jsem ANI JEDNU z dvanácti sabotáží (S1–S10 včetně nových). Nebylo proti čemu — src/lib/project-allocations.js a src/lib/adapters/projects.js neexistují. Perl výrazy jsou odhad tvaru budoucího kódu. Proto jsem definice sabotáží přepsal na sémantické a přidal povinný git diff --stat po každé mutaci; příkazy zůstávají návrhem.
- Neověřil jsem přesné znění hlášky vitestu při chybějícím modulu (RED 2, instalační červená). Packet předepisuje TVAR výstupu a nařizuje implementátorovi vložit do PR doslovný skutečný výpis.
- Neověřil jsem, co skutečně vystaví story B5. electron/tracking.cjs v repozitáři není. Všechno, co packet říká o mostu tracking:*, o předání GUID a o přepnutí projektu za běhu, je odvozené z plan.md §2 a z toho, co dnes preload.cjs NEMÁ — ne z existujícího kódu.
- Neotevřel jsem electron/main.cjs celý (25 507 B). Přečetl jsem jen řádky 305–330 (loadFile, render-process-gone, did-start-navigation, blur). Tvrzení o vlastnictví bloků a o requestSingleInstanceLock stojí na plan.md §2 a DAN-TODO.md, ne na úplném přečtení souboru.
- Neotevřel jsem electron/auth.cjs vůbec, ani src/components/* (Onboarding.jsx, Settings.jsx, Toggle.jsx, Icons.jsx), ani src/features/recording/RecordingCard.jsx, ani src/hooks/useElapsedTime.js. Tvrzení, že „Povolit“ v Onboarding.jsx chybí, přebírám z DAN-TODO.md:267, negrepoval jsem to.
- src/App.jsx jsem nečetl celý (105 řádků) — jen grep na TrackingCard, onActivityChange, window.ludone a useMemo. Tvrzení, že TrackingCard dostává jediný prop, stojí na řádku 86; nevylučuji, že handleTrackingChange dělá něco, co B6 ovlivní.
- src/lib/queue.js jsem četl jen řádky 195–215. Tvrzení, že ji nikdo neimportuje, je z grepu přes src/ electron/ tests/ scripts/, ne z přečtení souboru.
- Nepřečetl jsem docs/ux/cesta-uzivatele-2026-09-01.md celý (44 KB) — jen pět cílených grepů (verdikt kalendář, moment 19, moment 21, konvence macOS, notifikace). Mohl mi uniknout další relevantní moment o výběru projektu.
- Nepřečetl jsem docs/MASTERPLAN.md celý (1161 řádků) — jen osnovu, §9 (řádky 608–650) a §13 (810–845) doslova, plus grep na review passy.
- Nepřečetl jsem docs/changes/desktop-v1/spec.md celý — přečetl jsem §3 (59–136), §4 (137–172), §6/§7/§8/§9/§10 a začátek §11 (201–290). §11 R21–R25 mám jen z nadpisů a z prvních vět R21. Sekci „Autorita při rozporu“ (řádek 10) jsem viděl jen jako název v osnově, její doslovné znění jsem NEOTEVŘEL — pravidlo o pořadí autority cituji z packetu a z MASTERPLAN §501, který jsem taky neotevřel.
- Nepřečetl jsem docs/changes/desktop-v1/decisions.md celý — jen grepy na B1/B2/C2/N1/M9/M19/M21. Rozhodnutí C1, C2 detailně a rozhodnutí M15–M20 z memory jsem neověřoval.
- Nepřečetl jsem BEH-NOC.md, CHECKPOINT.md, AGENTS.md, KONTRAKT.md ani docs/changes/desktop-v1/tasks/B1-ui-smoke.md. Citace z BEH-NOC.md a AGENTS.md přebírám z návrhu packetu — NEOVĚŘENÉ. Nevím tedy ani, jestli existující packet B1 neříká o ui-smoke něco, co s §12.4 koliduje.
- Nepřečetl jsem DAN-TODO.md celý (27 688 B) — jen grep na 3a, ui-smoke a Povolit. Existenci a znění zápisů, do kterých má B6 přidávat, jsem neověřil.
- Nepřečetl jsem design/canvas/LuTrack.dc.html ani design/navrh/Main.dc.html celé — z prvního jen dva grepnuté řádky (107, 110). Obrazovku „výběr projektu“ jsem četl výhradně v design/navrh/nahled.html, řádky 395–455.
- src/styles.css jsem nečetl (1353 řádků) — jen wc -l a grep na šest jmenovaných tříd. Nevím, jestli tam nejsou další třídy, které by nové UI mohlo omylem přebít.
- Nespouštěl jsem npm run build. Baseline lint/typecheck/test:unit jsem spustil naostro (EXIT 0, 9 souborů, 77 testů), build ne.
- Neověřil jsem, zda jsou v repozitáři další packety pro souběžné stories (vlna 3: B7, B8), které by si s B6 mohly protiřečit ve vlastnictví TrackingCard.jsx — v docs/changes/desktop-v1/tasks/ je zatím jen B1.
- Neověřil jsem chování perl -0pi -e při nenalezené shodě přímo (že skončí EXIT=0 a soubor nechá být) — je to obecná znalost o perl -p, ne měření v tomhle repozitáři. Proto je v packetu git diff --stat jako povinný důkaz místo spolehnutí na exit kód.
