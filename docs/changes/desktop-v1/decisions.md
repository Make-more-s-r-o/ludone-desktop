# Rozhodnutí — LuDone Desktop v1

Auditní stopa. **Není to paralelní specifikace** — schválené rozhodnutí se musí propsat i do
`intent.md`, `spec.md` nebo `plan.md` podle povahy.

## Proces (1. 9. 2026)

| # | Rozhodnutí | Kdo |
|---|---|---|
| M1 | Masterplán platí pro LuDone Desktop; brief pro modul do `ludone-app` až na konci | Dan |
| M2 | Řez = co je na `main`. Nová práce jde přes `docs/changes/<id>/` | Dan |
| M3 | Design gate stojí na Claude Design | Dan |
| M4 | Masterplán vyhrává všude. Globální „dotáhni to sám až na prod bez ptaní" se **v tomhle repu ruší** | Dan |
| M5 | Rozsah = dotáhnout až po E10, plná náhrada Plaudu | Dan |
| M6 | Vynucení jen dokumentem a AGENTS.md. Žádný hook, žádný skill | Dan |
| M7 | Worktrees = Orca `~/orca/workspaces/` | Dan |
| M8 | Úklid stromu i oprava `ui-smoke` před startem | Dan |
| M13 | Bezpečnostní nálezy C4 expedovány do `LuDone/DAN-TODO.md`, **necommitnuto** | Dan |

## Produkt

| # | Rozhodnutí | Kdo |
|---|---|---|
| M9 | Jedna aplikace, dvě agendy — nahrávání schůzek a výkaz času | Dan |
| M10 | Desktopový LuTrack = **jen časovač**. Přehled, Management i Admin na webu | Dan |
| M11 | 🟡 **Odloženo:** osud živého LuTracku | Dan |
| M12 | Vzhled = LuDone Přístroj DS. Z LuTracku jen logika a názvosloví | Dan |
| M15 | **Kalendář se ruší.** Nahrávku identifikuje datum, čas, projekt z časovače a pole při stopu | Dan + doložení |
| M16 | **Varianta Divergent zrušena** — stála na časové ose dne, tedy na rušeném kalendáři | Claude, Dan potvrdil |
| M17 | Klidová agenda je v panelu jeden řádek, rozbalí se jen běžící | Claude (Dan: „rozhodni") |
| M18 | Ikona v Docku výchozí vypnutá, přepínač v Nastavení | Claude, Dan potvrdil |
| M19 | Pojmenování při stopu: předvyplněný název + čas od–do, editovatelné; čas se ukládá zvlášť | Dan |
| M20 | Připomínky ve zvolené dny a hodiny, když neběží časovač. Nikdy během nahrávání | Dan |

## Technická rozhodnutí přijatá orchestrátorem

Dan u nich řekl „je mi jedno" nebo „nerozumím" — masterplán §4 velí rozhodnout a zapsat.

| Rozhodnutí | Důvod |
|---|---|
| Serverový kontrakt `/api/desktop/recordings` | Hotová fronta stojí na něm; druhá varianta znamená přepsat frontu i testy |
| **Statická** registrace klienta, ne dynamická | Jediná varianta odvolatelná jedním UPDATE. Dnešní kód dělá DCR a vynucuje ji i brána `E7.sh:49` — obojí se musí srovnat |
| Přejmenovat běhová čísla na `B1–B8`, rozhodnutí běhu na `BD1–BD7` | `E0–E10` a `D1–D7` patří výhradně plánu. Bez toho si masterplán odškrtne 4,5–7 ČD neexistující práce |
| Neplatit GitHub Pro ani nezveřejňovat repo | Bránu drží orchestrátor + sedm bran do CI. Nestojí to nic |

## Odchylky od masterplánu, přijaté vědomě

| # | Odchylka | Důvod |
|---|---|---|
| **O8** | T1 běžel v hlavním checkoutu, ne ve worktree | Worktree nemá `node_modules`, takže by v něm brána neběžela. Jediný zapisovatel, strom čistý a commitnutý |
| **O9** | Obě měřidla A6 psal orchestrátor, ne Codex | Měřidlo vyřazovacího kritéria je nástroj, kterým se rozhoduje o projektu. Příště delegovat |
| **O7** | Design approval gate proběhl bez samostatného UX contract draftu | Jeho obsah nese `design/zadani/BRIEF.md`, který se sám označuje za závazné zadání, a statický náhled s 22 obrazovkami |

## Otevřené, s doporučeným defaultem

Viz `intent.md` § Open questions. Nic z toho neblokuje práci na nezávislých větvích DAG.

---

## Kolo 2 — rozhodovací balík zodpovězen (1. 9. 2026 večer)

| # | Rozhodnutí | Proti doporučení? |
|---|---|---|
| **A1** | Nahrávat **kdykoli**, nečeká se na právní rámec | 🔴 ano |
| **A2** | Apple Developer Program **nekupovat**, dokud neproběhne P1/P2 | ne |
| **A3** | `gemini-3.5-transcribe` jako default. **Klíče měnitelné v `app.ludone.cz`**, ne natvrdo v kódu | ne, ale přidává požadavek |
| **B1** | v1: **každý vidí jen svoje**. **Sdílený účet `zasedacka@makemore.cz` je SOUČÁSTÍ v1** | 🔴 ano |
| **B2** | Nahrávky jsou **majetkem firmy**. **Admin vidí vše** | ne |
| **B3** | Retence **7 dní**, nastavitelné | ne |
| **B4** | **Zamknout pravidla v databázi HNED**, ne později | 🔴 ano |
| **C1** | Časovač se s nahráváním **nezastaví**, jen se nabídne | ne |
| **C2** | **Dva samostatné vypínače** | ne |
| **C3** | LuTrack: **jen příprava**. Vlastní spec a masterplán později | ne |

### Co z toho plyne, a co jsem k tomu neřekl dopředu

**A1 — riziko přijaté vědomě.** Nahrávky nesou hlasy lidí, kteří o aplikaci nevědí, včetně lidí
mimo firmu. Dan rozhodl, že se nečeká. Zapsáno jako přijaté riziko, ne jako opomenutí.

**A3 — nový požadavek na server.** „Klíče měnitelné v `app.ludone.cz`" znamená správu klíčů
v hlavní aplikaci, ne konstantu v kódu. To je **práce na straně serveru**, která v žádném dosavadním
plánu nebyla. Patří do etapy přepisu (E9), ne do desktopu.

🔴 **B4 — zásah do ostrého provozu, který se nedá udělat naslepo.** Přidat unikátní index
a zákaz překryvů na živou tabulku, kde **už překrývající se řádky existují**, migrace **odmítne**.
Nejdřív se musí změřit, kolik jich je, a rozhodnout, co s nimi. Do té doby je to **stopka**:
plánuju to, nespouštím.

🔴 **B1 — sdílený účet je nová etapa, ne detail.** „Zasedačka" znamená vyřešit: jak se pozná
sdílené zařízení od osobního · komu se přiřadí nahrávka, když se u jednoho Macu vystřídají tři lidé ·
co se stane s frontou při odhlášení uprostřed odesílání · jestli sdílený účet smí měřit čas
(a komu by se ty hodiny připsaly). **Odhad +2 až 3 ČD** a dotýká se to RBAC.

---

## Kolo 3 — rozsah a MCP (1. 9. 2026 večer)

| # | Rozhodnutí |
|---|---|
| **S1** | **Serverová část NENÍ v tomhle plánu.** Desktop se dotáhne kompletně, sepíše se technická dokumentace kontraktu, a na straně `ludone-app` proběhne **vlastní průchod masterplánem** |
| **S2** | **MCP je věc aplikace, ne desktopu.** Na nahrávky a hodiny se ptá přes LuDone MCP nad `app.ludone.cz`. Desktop žádné MCP nástroje nevystavuje |
| **S3** | **Pořadí: nejdřív desktop, server potom** |

### Co z S1 plyne pro tenhle běh

Desktop **nemá kam odesílat** a v tomhle plánu mít nebude. Fronta se tedy postaví a otestuje,
ale zůstane za vypnutým `DESKTOP_UPLOAD_ENABLED`. Úspěšný signál z `intent.md` „nahrávka doputuje
sama" **v této vlně nelze splnit** — je to vědomé, ne opomenutí.

Most k příštímu běhu je `docs/server-modul/KONTRAKT.md`: jeden dokument, proti kterému bude
aplikační strana stavět.

### Co z S2 plyne

Masterplán §17 chce agent-support od začátku. Splní se **na straně aplikace**, ne v desktopu.
Desktop musí jen zajistit, aby data, která pošle, byla přes MCP čitelná — tedy nést vlastníka,
projekt jako GUID a časy v UTC. Do specu jako požadavek na tvar dat, ne jako funkce desktopu.

---

## O10 — design zůstává v `design/`, ne v `artifacts/design/`

**1. 9. 2026, rozhodl orchestrátor.** Masterplán §3 předepisuje kanonickou cestu
`docs/changes/<change-id>/artifacts/design/`. Design ale bydlí v `design/` v kořeni repozitáře
a ukazuje na něj `.gitignore`, `approved.json` i všechny odkazy v návrhu.

**Přesun den před nočním během by rozbil odkazy** a nic by nezískal. Místo přesunu vznikl
`artifacts/design/design-manifest.md`, který kanonické místo pojmenovává. Není to druhý zdroj
pravdy — je to rozcestník k jedinému.

**Kdyby to mělo být podle masterplánu doslova**, je to přesun po nočním běhu, ne před ním.

## O11 — režimy `/goal` a `/loop` chyběly ve spouštěcím promptu

**1. 9. 2026, našel Dan.** První verze promptu říkala „pracuj autonomně", ale nenesla
měřitelný completion condition (`/goal`) ani způsob, jak se vrátit po resetu limitů (`/loop`).
Bez `/goal` běh neví, kdy uspěl; bez `/loop` se po vyčerpání limitu nerozjede.

Doplněno. 🔴 **`/loop` úmyslně úzce** — masterplán §11 ho zakazuje jako stavový automat,
důkaz dokončení i náhradu task DAG. Slouží jen k čekání na Codex, CI a reset limitů.

## O12 — tenhle modul je PILOT procesu, ne jen modul

**1. 9. 2026.** Masterplán §20 chce, aby se proces nejdřív ověřil na malém modulu a skončil
verdiktem `VALIDATED` / `PARTIAL` / `INVALIDATED`. Do téhle chvíle to nikde nestálo a běh by
odevzdal jen kód.

Noční běh proto ráno vrací **i verdikt o procesu** — zvlášť k tomu, jestli šel packet
implementovat bez produktového hádání a jestli hlavní session zůstala kontextově úsporná.
**Neúspěšný pilot je platný výsledek**, když přesně ukáže, co změnit.

## O13 — přepsat `tray-authority.test.js` NENÍ oslabení testu

**1. 9. 2026 22:5x, zeptal se noční běh před tím, než to udělal.** Správně — „neoslabuj test"
je tvrdé pravidlo a výjimka z něj patří na papír předem, ne do PR dodatečně.

**Nález:** `tests/tray-authority.test.js:39` tvrdí, že `updateTray` obsahuje
`trayIconName(nextState)`. Jenže `specs/E3` §3 přikazuje `updateTray(nextState)` **nahradit
funkcí `refreshTray()` BEZ ARGUMENTU** a jako podmínku hotovo uvádí doslova:
*„`grep -n 'updateTray' electron/main.cjs` nevrátí nic."* Pomocná funkce `functionSource`
navíc **hodí výjimku**, když funkci nenajde — takže smazání `updateTray` ten test rozbije.

**Rozhodnutí: přepsání je výměna zámku, ne jeho odstranění.** Test zamyká směr, který
`plan.md` §1 výslovně ruší („renderer hlásí fakta, neurčuje stav"). Ale platí tři podmínky,
protože „není to oslabení" se dá zneužít:

1. 🔴 **Invariant musí přežít, ne zmizet.** Co ten test chrání, je *„volba ikony je čisté
   mapování ze stavu"*. Po B3 se to tvrdí o `refreshTray`, se stejnou silou. **Smazat
   to tvrzení místo přesunutí JE oslabení.**
2. 🔴 **A musí zesílit tam, kde je nový směr silnější.** Dnešní test čte `main.cjs` jako
   **text** — autoritu tím prokázat nejde. B3 dluží **test chování**: po pádu rendereru
   lišta pořád hlásí správný stav. `specs/E3` §3 k tomu dává i měřidlo — řádek
   `[tray] <ISO čas> stav=… nahrávání=… lutrack=… přihlášen=…`.
3. 🔴 **Nejsilnější jediný důkaz, který B3 může nechat: `tray:set-state` musí zmizet.**
   `specs/E3` §4 velí „kanál `tray:set-state` SMAZAT celý", a `preload.cjs:18` ho dnes
   pořád vystavuje jako `setTrayState`. Test, že se ani jedno jméno nikde nevyskytuje,
   je levný zámek na **nový** směr.

⚠️ **A jedna past, kterou spec zmiňuje a implementace snadno mine:** `appState.signedIn` se
při pádu rendereru **NEMĚNÍ** — session drží main, takže cílový stav po `kill -9` je
**`idle`, ne `signed-out`**. Kdo to splete, postaví „autoritu v main procesu", která se při
pádu chová jako by uživatele odhlásila.

**Zůstává zelené:** `it("výběr obrázku používá čisté mapování stavu")` nad `trayImage` —
tenhle případ se nemění a je to ta jedna zelená v poměru 2–3 červené : 1 zelená.

## O14 — kalendář je zrušený designem, ale žádná story ho neodstraňuje

**1. 9. 2026 22:4x, našel skeptik packetu B1. Změřeno, ne odvozeno.**

`design/approved.json` má v `explicitlyCut` doslova: *„kalendář a sekce Dnešní schůzky —
**ruší se**"* a *„varianta Divergent — stála na časové ose dne, tedy na rušeném kalendáři"*.
Je to Danovo rozhodnutí M15/M16.

**Jenže:**

| Kde | Co tam je |
|---|---|
| `src/features/calendar/TodayAgenda.jsx:22` | `<h2 id="agenda-title">Co mě dnes čeká</h2>` — komponenta **žije** |
| `scripts/ui-smoke.mjs:310` a `:374` | `assertText(panel, "Co mě dnes čeká")` — měřidlo to **vyžaduje** |
| `scripts/ui-smoke.mjs:243`, `:255` | přepínač „Automaticky nahrávat schůzky z kalendáře" |
| `scripts/ui-smoke.mjs:170` | tlačítko „Nahrát schůzku" u položky kalendáře |
| `plan.md` §2, DAG B1–B12 | **grep na „kalendář" nevrací nic** — žádná story ho neodstraňuje |

🔴 **Je to díra v mém plánu, ne v designu.** Schválený design něco ruší a task DAG na to nemá
úkol. Kdyby to nikdo nenašel, dopadlo by to takhle: `ui-smoke` se opraví tak, aby kalendář
**vyžadoval**, tím se zrušená obrazovka zamkne testem — a až ji někdo bude odstraňovat,
narazí na zelenou bránu, která ji brání.

### Rozhodnutí (bezpečný default, reverzibilní)

**Dnes v noci kalendář NEODSTRAŇOVAT.** Je to user-visible změna a žádný packet ji nekryje —
tedy hard gate, přeskakuje se. **B1 tím není blokovaná:** komponenta zatím existuje, takže
`ui-smoke` na ni smí asertovat a je to pravdivé měření dnešního stavu.

**Vzniká story `B13 — odstranit zrušený kalendář`**, mimo dnešní běh:

1. smazat `src/features/calendar/` a jeho zapojení v panelu,
2. odebrat asertace `ui-smoke.mjs:170, 243, 255, 310, 374`,
3. sladit `spec.md` §3 — dnes tam kalendář jako Feature ID **vůbec není**, což je konzistentní
   se zrušením, takže se jen doplní poznámka, že komponenta v kódu přežívá.

⚠️ **Pořadí je důležité:** B13 musí jít **po** B1, ne před ním. Kdyby se asertace odebraly
dřív, než `ui-smoke` vůbec běží, nikdo by neuviděl, že je odebral správně — měřidlo se
neopravuje a nezkracuje v jednom kroku.


---

## BD-N6 a BD-N7 — dva blokery B8, rozhodnuté koordinátorem 1. 9. 2026 ve 23:20

Packet `tasks/B8-zapojit-auth.md` odmítl obojí rozhodnout sám a udělal správně — jsou to
rozpory mezi zdroji, ne mezery v zadání. Dan v 23:15 nařídil, že se běh **nemá ptát**:
*„Bezpečné, reverzibilní technické defaulty rozhodni s doporučením a zapiš."* Takže:

### BD-N6 — registrace klienta: **statická, a fail-closed**

**Rozhodnuto: (a) s pojistkou.** `createAuthController` se zapojí tak, že **`clientId` je
POVINNÝ**. Když chybí, přihlášení **selže s českou hláškou** — a **dynamická registrace se
NEPOUŽIJE ANI JAKO ZÁLOHA**.

**Proč ne (b) „zatím DCR":** `decisions.md:42` statickou registraci už rozhodl. Zapojit DCR by
Danovo rozhodnutí tiše zrušilo — a je to změřená vada, ne teorie: kancelář za jednou NAT IP
vyčerpá **20 registrací za hodinu** a přihlášení spadne na **429**
(`docs/ux/cesta-uzivatele-2026-09-01.md`).

**Proč ne (c) „počkat na server":** zastavilo by to celou větev B8 → B9, a Dan nařídil
*„nezastavuj celý běh, dokud existuje bezpečná práce"*. Přeskakuje se jen dotčený task.

🔴 **Co to znamená prakticky:** dokud `clientId` neexistuje, **přihlášení naostro nepůjde** —
a to je záměr, ne nedodělek. Fail-closed je lepší než tiše zapojená zamítnutá varianta.
**Vratné:** je to jedna proměnná prostředí a jedna větev v kódu.

### BD-N7 — název proměnné: **`LUDONE_ORIGIN`**, nová se nezavádí

**Rozhodnuto: `LUDONE_ORIGIN`.** Packetem navržená `LUDONE_ISSUER` se **zamítá**.

**Proč:** `specs/E6-prihlaseni-a-fronta.md` §11 tu konvenci už zavádí a masterplán §9 zakazuje
*„změnit API/datový kontrakt bez aktualizace plánu"*. Druhá proměnná pro **týž origin** je přesně to.

**Výchozí hodnota zůstává `https://app.ludone.cz`** podle E6 §11 — `spec.md` a `plan.md` jsou
zmrazené a nebudu je za pochodu opravovat.

⚠️ **Ale pozor, a patří to do reportu:** **všechna živá evidence v repu míří do labs prostředí**
(`E7.sh:45-46`, `tests/oauth-state.test.js:45,51,54`). Proti `app.ludone.cz` **nikdy neproběhl
celý OAuth tok** — jen discovery HTTP 200 z 24. 8. ⇒ **ověření naostro se musí spouštět
s `LUDONE_ORIGIN` nastaveným na HTTPS origin labs prostředí**, jinak se testuje adresa,
kterou nikdo nezměřil.

### Kdo B8 vykonává

`plan.md` §2 dává B8 Claudovi (bezpečnostní cesta). Danův pokyn z 23:15 říká
*„Mechanika primárně Codex, Claude koordinace a review"* — a je novější. Dělba je tedy:
**koordinátor rozhodl oba blokery (výš) a přečte diff; Codex napíše kód.** Záměr plánu
zůstal: bezpečnostní rozhodnutí neudělal vykonavatel.

---

## BD-N8 — nový IPC kanál `tray:report-facts` (koordinátor, 1. 9. 2026, 23:45)

Nezávislé review B3 vytklo, že B3 zavedla **nový IPC kontrakt, který není v plánu ani
v rozhodnutích**. Má pravdu, tak ho sem zapisuju — mlčky zavedený kontrakt je přesně to,
co masterplán §9 zakazuje.

**Kanál:** `tray:report-facts`, směr renderer → hlavní proces, přes `onValidated([...panel])`.

**Proč vznikl.** Smazáním `tray:set-state` by hlavní proces ztratil jediný zdroj dvou faktů,
které dnes zná jen renderer: jestli je někdo přihlášený a jestli běží časovač. Bez náhrady by
lišta zůstala navždy na „nepřihlášeno". `plan.md` §1 přitom ten směr určuje sám:
*„Renderer hlásí fakta, neurčuje stav."*

**Kontrakt — a je úzký schválně:**

| | |
|---|---|
| přijímá | **právě dva klíče**: `signedIn`, `tracking` |
| typ | **oba striktně `boolean`**, nic jiného |
| klíč navíc | **odmítnuto** (`state`, `icon`, cokoli) |
| neplatný obsah | **NIC nemění**, zaloguje se; fail-closed |
| jméno ikony | do kanálu **nesmí** — hlídá to test |

**Proč tak úzký:** volnější kontrola z něj udělá `tray:set-state` pod novým jménem. Doloženo
review: `{ tracking: "tracking" }` by protlačilo doslovné jméno ikony a `{}` by tiše přepsalo
přihlášení na false. Ověřeno sabotážemi — obě rozvolnění brána chytí.

🔴 **Je to DOČASNÝ stav.** Až přistane **B5** (časovač v hlavním procesu) a **B8** (skutečné
přihlášení), budou obě fakta pocházet přímo z hlavního procesu a kanál se **zúží nebo zmizí**.
Kdo bude dělat B5 nebo B8, ať to nezapomene — jinak tu zůstane cesta, kterou renderer ovlivňuje
stav, přestože ji už nikdo nepotřebuje.

### Vlastnictví crash hooků — přiznaná odchylka od zmrazeného plánu

`plan.md` §2 dává tři posluchače smrti rendereru story **B5**. B3 je změnila, protože bez nich
`refreshTray()` po pádu okna nikdo nezavolá a story nedodá nic. Packet `B3-tray-autorita.md`
si tuhle odchylku sám přiznává v §12.1b. **Zmrazený plán neopravuju za pochodu** — zapsáno tady,
aby se to při B5 nevyřešilo podruhé a jinak.

---

## BD-N10 — `LUDONE_OAUTH_CLIENT_ID` je druhá a POSLEDNÍ nová proměnná B8 (koordinátor, 2. 9. 2026, 00:10)

BD-N6 rozhodlo „statická registrace, `clientId` povinný". Vykonavatel to splnil jinak, než
bylo myšleno: **vymyslel si dvě konkrétní ID** (`ldmcp_oauth_client_prod_v1_desktop`
a `…_labs_…`) a zadrátoval je do `main.cjs` — a **v téže odpovědi přiznal**, že serverový
repozitář takový záznam nemá a že ID „vycházejí z předepsaného tvaru".

🔴 **Uhodnutý identifikátor NENÍ fail-closed.** Neselže srozumitelně u nás — selže až na
serveru hláškou o neznámém klientovi, kterou uživatel ani správce neumí zařadit. To je horší
než odmítnout start.

**Rozhodnuto:** jediným zdrojem je proměnná prostředí **`LUDONE_OAUTH_CLIENT_ID`**. Chybí-li,
je prázdná, jsou v ní jen mezery nebo není řetězec, **přihlášení se ani nepokusí** a vrátí
důvod `konfigurace` s českou větou. Ověřeno testem, který kontroluje **nulu pokusů** o vytvoření
controlleru — ne jen návratovou hodnotu. Kanárek hlídá, že se zadrátovaná ID nevrátí.

**Počet nových proměnných B8 je tedy 2** (`LUDONE_ORIGIN` z BD-N7 + tahle), ne 1, jak jsem
původně napsal do output contractu. Je to důsledek BD-N6, ne rozšíření rozsahu: „clientId
z konfigurace" bez zdroje konfigurace nejde splnit.

⚠️ **Pro Dana:** dokud ta hodnota neexistuje, **přihlášení naostro nepůjde** — a to je záměr.
Potřebuje statického OAuth klienta na serveru (S1, jiný repozitář).

### Vedlejší nález ze stejného místa

Mapování chyb na důvody bralo **volný podřetězec `clientId`**, takže `ReferenceError:
resolveAuthClientId is not defined` se uživateli ohlásil jako **„konfigurace"** — programátorská
vada převlečená za něco, co „doplní správce". Zúženo na věty, které házíme sami; nezařaditelná
chyba zůstává `neznama`. Má vlastní test i povinně zelený protějšek.

**Obecně:** klasifikátor chyb, který se chytá podřetězců z identifikátorů, dřív nebo později
zamění vadu kódu za vadu konfigurace. Chytej se vět, ne jmen proměnných.

---

## BD-N12 — B6 se dnes v noci NEDĚLÁ (koordinátor, 2. 9. 2026, 00:55)

Vykonavatel B6 **nezačal psát produkční kód** a udělal správně. Narazil na dva blokery
a zapsal je místo toho, aby si money pravidlo domyslel.

### 🛑 Bloker 1 — dva ZMRAZENÉ dokumenty si o money pravidle odporují

| zdroj | co říká o projektu s čerpáním nad 110 % |
|---|---|
| `spec.md` R7, ř. 152 | *„je **zašedlý a s důvodem**. Databáze to nehlídá."* ⇒ **zobrazit**, jen nejde vybrat |
| `plan.md` §2b, ř. 147 | *„Přečerpaný projekt (>110 %) **není v nabídce**"* ⇒ **skrýt** |

**To není nejasnost v zadání, to je rozpor mezi dvěma zmrazenými texty** — a rozhoduje o tom,
co uživatel uvidí, když chce vykázat čas na přečerpaný projekt. **Zašedlý s důvodem** a
**neexistující** jsou pro člověka dvě různé odpovědi: první říká „tenhle projekt znám, ale
nemůžeš", druhá „takový projekt nemám".

🔴 **Nerozhoduju to.** Je to money pravidlo a hard gate. Danův pokyn zní přeskočit **dotčený
task**, ne celý běh — a to dělám.

**Doporučený default, až se k tomu Dan dostane:** vyhrát má **`spec.md` R7** (zašedlý s důvodem).
Spec je v hierarchii nad plánem, a „vidím, proč to nejde" je lepší UX než mlčky chybějící
položka — uživatel jinak hledá projekt, který má, a myslí si, že se rozbil výběr. Ale je to
**doporučení, ne rozhodnutí**.

⚠️ Otevřený zůstává i **přesně 110,0 %**: `< 110` nebo `<= 110`. Ostrá nerovnost tam není
napsaná nikde.

### 🛑 Bloker 2 — stav vypínače se rendereru nevystavuje (technický, TEN rozhoduju)

`DESKTOP_TIME_ENABLED` zná jen hlavní proces; `tracking:get-state` vrací stav časovače, ne
stav vypínače. Renderer tedy nepozná, jestli je časová agenda zapnutá — a B6 by musela buď
nabízet projekty i při vypnutém vypínači, nebo zůstat trvale fail-closed a nenabídnout nic.

**Rozhodnuto (vratné, technické, žádné money pravidlo):** až se B6 pustí, **smí rozšířit
`tracking:get-state` o jediné boolean pole „časová agenda je zapnutá"** a vystavit ho
v preloadu. Vlastnictví toho bloku jí tímto přiděluji, přestože `plan.md` §2 ho dává B5.

🔴 **Do kanálu smí jít JEN ta jedna boolean hodnota** — žádná další data, žádná business
pravidla. Jinak z něj vznikne druhá cesta, kterou renderer rozhoduje o penězích.

### Co to znamená pro plán

B6 zůstává **nezapočatá**. **B11 (retence) na ní nezávisí** — visí na B7. Běh tedy pokračuje.

**Vedlejší nález vykonavatele, který stojí za zapsání:** `plan.md:170` a
`podklady-vytezene.md:172` připisují B6 zásahy do `main.cjs`/`preload.cjs`, zatímco tabulka
vlastnictví v `plan.md:147` jí žádný takový blok nedává. Vykonavatel zvolil **bezpečnější**
výklad a do obou souborů nesáhl. To je přesně to chování, které od něj chceme.

---

## BD-N16 — reviduju vlastní odložení B9b (koordinátor, 2. 9. 2026, po obnovení limitů)

V BD-N14 jsem napsal, že B9b *„se musí dělat až s možností ověřit to naostro"*. **Reviduju to
a stavím ji teď.** Změna rozhodnutí patří do záznamu stejně jako to původní.

**Proč to původní bylo příliš opatrné:** spletl jsem si dvě různé věci — *„ověřit, že ta race
nastane naostro"* a *„ověřit, že oprava funguje"*. To druhé jde bez serveru:

| oprava | čím se dá změřit bez sítě |
|---|---|
| jeden zámek přes přihlášení i odhlášení | řízené pořadí volání, obě pořadí |
| deadline na discovery a revoke | falešné časovače (`vi.useFakeTimers()`) |
| úklid zbylých `.oauth.enc.*.tmp` | dočasný adresář přes `mkdtemp` |

**Skutečný důvod odložení byl limit a hodina, ne technická překážka.** Obojí pominulo.

🔴 **Co se tím NEMĚNÍ:** živé chování proti serveru zůstává **⛔ neověřené**. Zelené testy jsou
🧪. A pořád platí, že bez `LUDONE_OAUTH_CLIENT_ID` se přihlášení naostro ani nepokusí.

**Fail-closed směr, který jsem určil:** když se přihlášení a odhlášení sejdou, **vyhrává
odhlášení**. Kdo klikl na odhlásit, nesmí skončit přihlášený — ani když přihlášení doběhne
o chvíli později. Opačná volba by znamenala, že se uživatel po odhlášení tiše vrátí do session,
což je horší selhání než zbytečné odhlášení.

## BD-N17 — dva neopravené nálezy review: jeden hotov, druhý čeká na doběhnutí B9b

**BD-N13 bod 2 (počítadlo mutací) je HOTOVÝ.** `hasLiveRecording()` čte čtyři fakta, počitadlo
hlídalo dvě. Doplněno o `preparation.cancelled` a přibyl **test pořadí**: přepočet musí stát
za smyčkou, ne před ní, protože před ní by viděl stav, kde část session ještě nemá přiřazenou
finalizaci. Ověřeno sabotáží — přesunutí přepočtu před smyčku test chytí.

**BD-N13 bod 1 (test čítače přihlášení měří rozhodnutí, ne zapojení) ČEKÁ.** Je na větvi `b4`,
nad kterou právě staví B9b. Sáhnout na `b4` teď by znamenalo přebasovat `b8`, `b9` i běžící
`b9b` — tedy pracovat pod rukama běžícímu jobu. **Udělá se hned po jeho doběhnutí.**

---

## BD-N18 — sabotoval jsem nad necommitnutou prací a smazal si vlastní opravu

**Stalo se mi to, přestože to mám jako pravidlo ve vlastním skillu.** Zapisuju to, protože
tichá chyba, kterou nikdo nepojmenuje, se zopakuje.

**Průběh:** opravil jsem tautologickou kontrolu v `ui-smoke.mjs`, **necommitl** ji a rovnou
spustil sabotážní kolo. Každá iterace končí `git checkout HEAD -- <soubor>` — a protože moje
oprava v `HEAD` nebyla, **první úklid ji smazal**. Další dvě sabotáže pak hlásily
„KOTVA NESEDÍ", protože hledaly text, který už v souboru nebyl, a strom zůstal po kole
**červený** se čtyřmi padajícími testy.

🔴 **Nejzrádnější na tom je, že to vypadá jako nález.** „Sabotáž nedopadla" a čtyři červené
testy se snadno přečtou jako vada kódu. Byla to vada postupu.

**Co to potvrzuje:** pravidlo *„první akce po každém `--write` běhu je `git add -A && git
commit`, teprve pak brány a sabotáže"* neplatí jen pro **Codexovu** práci. Platí pro **jakoukoli
necommitnutou práci ve stromě**, včetně mé vlastní.

**Doloženo obojím směrem:** po commitu proběhly tytéž dvě sabotáže bez potíží a poměr vyšel
3 červené : 1 zelená.

---

## BD-N19 — skok hodin zpět: neházet, ale ZEPTAT SE (koordinátor, 2. 9. 2026)

Nález z adversariálního review, **změřený sondou**: délka úseku se počítá z nástěnných hodin.
Když se čas pohne zpět (korekce NTP po probuzení se špatnou RTC, ruční přenastavení),
`stop()` i `switchProject()` spadnou na výjimce a **časovač zůstane ve stavu `bezi`**.
Restart nepomůže — po něm je záznam `ceka-na-potvrzeni` a větev `ukoncit` chce současně
`endedAt >= startedAt` **a** `endedAt <= now()`, což při pozadu jdoucích hodinách nejde splnit.
**Průchozí je jediné rozhodnutí: `zahodit`, které zapíše nula minut.**

⇒ Uživatel, kterému stroj odpoledne opraví čas, má na výběr **nezastavit časovač vůbec**,
nebo **přijít o celou naměřenou práci**. To je přesně to, co R21 zakazuje slovy *„nikdy tiše
nesmazat ani tiše nezapočítat"*.

### Rozhodnutí: minimální oprava, ne plně monotónní čas

Review doporučuje měřit monotónně (`process.hrtime.bigint()`). **Volím minimální variantu**
a tady je důvod, proč to není zlevnění:

🔴 **Monotónní zdroj RESTART PROCESU NEPŘEŽIJE.** `hrtime` se počítá od startu procesu, takže
u časovače, jehož celý smysl je přežít pád a restart, je stejně nutná **kotva na nástěnný čas**
uložená na disk. Monotónní hodiny by tedy problém neodstranily, jen posunuly — a přidaly druhý
zdroj pravdy o čase.

**Co se udělá místo toho:**

1. **Skok zpět NEHÁZÍ výjimku.** `endedAt` se ořízne na `max(startedAt, floor(now))`.
2. **Anomálie se ZAPÍŠE do úseku** — ne jako poznámka, ale jako pole, ze kterého se pozná,
   že naměřená délka je nedůvěryhodná.
3. **Úsek jde do `ceka-na-potvrzeni`** a rozhodne člověk. Nesmí se tiše započítat nula,
   ani tiše započítat nesmyslná délka.
4. **`ukoncit` přijme `endedAt >= startedAt`** i tehdy, když nástěnné hodiny jdou pozadu.

**Proč zrovna tahle hranice:** ztratit hodinu práce a tvrdit „nula minut" je horší selhání než
říct „hodiny se pohnuly, kolik ti mám započítat". První je tiché, druhé je vidět.

**Vratné:** je to chování jedné větve a jeho testy; žádná změna kontraktu ani úložiště.

---

## BD-N20 — `updateTray` v odhlášení: místo poznámky KONTROLA, která se sama ozve

**Nález review:** `auth:logout` volá `updateTray("signed-out")` — přesně tu funkci, kterou
O13 a `specs/E3` §3 přikazují smazat.

**Ale na větvi `b9` je to v pořádku.** Linie `main → b4 → b8 → b9` story **B3 neobsahuje**,
takže tam `updateTray` legitimně existuje. Problém vznikne **až při mergi obou linií**.

### Proč jsem to neopravil „rovnou"

Na `b9` **nejde napsat cílový tvar** — `refreshTray` ani `appState` tam neexistují. Zbývaly
dvě možnosti a obě jsou špatné:

| možnost | proč ne |
|---|---|
| poznámka „až přistane B3, opravit" | **nikdo ji nepřečte** — brána je zelená a poznámky se čtou, až když něco spadne |
| přetáhnout B3 do `b9` | rozšíření rozsahu a druhý zapisovatel v cizí story |

### Co jsem udělal místo toho

**Kontrolu, která se ptá na SKUTEČNOST:** je `refreshTray` v `main.cjs`?

- **není** → zelená, a nahlas **vypisuje, co vědomě neměří**,
- **je** (tedy obě linie se potkaly) → **červená** s konkrétním pokynem: `auth:logout` má
  nastavit `appState.signedIn = false` a zavolat `refreshTray()`, a `updateTray` má zmizet.

🔴 **Ta brána nemůže zestárnout.** Ověřeno simulací: jakmile se `refreshTray` v souboru
objeví, test spadne přesně na té asertaci. Je to tentýž vzor jako u ratchetu — podmínka,
na kterou se musí někdo rozpomenout, je splněná náhodou.

**Pro merge:** až se obě linie potkají, tenhle test **spadne schválně** a řekne co dopsat.
Není to regrese, je to zabudovaná připomínka.

## BD-N21 — osy v PR se hlásí proti ZMRAZENÉ MATICI, ne proti dojmu

PR #9 tvrdil `delivery: no-code → pr-open` a `exposure: disabled`, jenže `spec.md` §3 ř. 92
má `DSK-F015` na **`coded`** a **`labs`**. Rozpor byl **uvnitř téhož diffu** — `DAN-TODO.md`,
který ten PR přidává, v bodě O-B11-10 sám píše *„Matice má F015 už na `labs`"*.

Vykonavatel si toho tedy všiml a tělo PR přesto tvrdilo opak. **Opraveno v PR #9.**

⚠️ **Otevřená otázka, kterou NEROZHODUJI** (O-B11-11): patří mazací mechanismus vůbec pod
`DSK-F015` („Nastavení: účet, zvuk, záznamy, připomínky, diagnostika")? Ta funkce mazání
nepopisuje. Buď se retence povede pod F015, nebo dostane vlastní `DSK-F017`. **Je to změna
zmrazené matice, tedy Danovo rozhodnutí.** Doporučený default: vlastní ID, protože „Nastavení"
je obrazovka, ne chování.

---

## Sloučení stohu do main — 2. 9. 2026

### BD-N22 — 🔴 `gh pr merge` na stohovaný PR ho sloučí do RODIČE, ne do `main`

Sloučil jsem #2, #3, #5, #8, #10 jedním během. Výsledek: **#5 skončil v `orca/desktop-b4`,
#8 v `b8` a #10 v `b9`.** Na `main` dojely jen B1 a B4; B8, B9 a B9b zůstaly o patro níž.

**Proč:** GitHub přesměruje potomka na `main` až ve chvíli, kdy se base větev po mergi
**smaže**. Bez `--delete-branch` se PR sloučí přesně tam, kam míří — do rodiče.

**Zákeřné je, že to vypadá jako úspěch.** Všech pět hlásilo `MERGED`, `gh pr list` byl prázdný
a nic nezčervenalo. Odhalilo to až ověření `git merge-base --is-ancestor <větev> origin/main`.

**Náprava:** větve se po fast-forwardech vršily, takže `b9` obsahovala celou linii. Ověřil
jsem to **porovnáním obsahu, ne rodokmenu** — `git diff --stat` proti ověřenému zelenému
pokusu byl prázdný — a dovezl to jedním PR #11.

**Pravidlo napříště:** stoh se merguje **odspodu a po jednom**, s ověřením `is-ancestor` po
každém kroku. Nebo se všechny PR napřed přesměrují na `main` (`gh pr edit <n> --base main`).

### BD-N23 — atrapa `auth:begin` z linie časovače se při slučování zahazuje

Obě linie vkládaly blok na totéž místo v `main.cjs`; strana časovače nesla starý
`handleValidated("auth:begin", …)` s `LUDONE_OPEN_AUTH_BROWSER`, který linie přihlášení
nahradila skutečným handlerem. **Naivní „vezmi obě strany" by kanál zaregistrovala dvakrát**
a `ipcMain.handle` na to v Electronu vyhodí výjimku **při startu** — aplikace by se neotevřela.

### BD-N24 — test odhlášení se nepřemluvil, ale zesílil

`auth:logout` po B3 mění fakt a nechá stav odvodit. Test proto zaznamenává hodnotu faktu
**v okamžiku přepočtu**, takže neprojde ani obrácené pořadí. Bez toho by sabotáž (c)
prošla zeleně — změřeno.

### BD-N25 — inventura IPC kanálů čte kód, ne prózu

Povinně zelená sabotáž (komentář vypadající jako registrace) **zčervenala**. Inventura teď
odstraňuje **celořádkové** komentáře — schválně jen ty: kdo maže každé `//`, rozřízne
i `"https://app.ludone.cz"` uvnitř řetězce. Přibyla asserce, která duplicitní kanál
**pojmenuje**; o dvacet minut později si na sebe vydělala při rebase B7.

### BD-N26 — delegace na Codex dnes dvakrát selhala, práci jsem udělal sám

První pokus spadl na hranici sandboxu (`patch rejected: writing outside of the project` —
`orca-codex.sh` ho pustil v kořeni hlavního checkoutu, ne ve worktree), druhý pokus se
selektorem `worktree` **vůbec nezaložil panel** a po dvou minutách vypršel.

Podle vlastního pravidla („dostupnost není preference") jsem to **řekl nahlas a udělal sám**
místo třetího pokusu. Zbývá zjistit, jak `orca-codex.sh` předat kořen worktree — zapsáno
v `DAN-TODO.md`.

### BD-N27 — oprava vlastního tvrzení v PR #6

Napsal jsem tam, že mezeru „odebrání importu nechytí unit testy" zavře `queue-wiring` v B7.
**Změřeno na přebazované B7: nezavře** — `306 passed`, stejně zeleno. Modul se načte, ale
`TRACKING_STATES` se čte až uvnitř funkcí, které ten test nevolá. Jediné měřidlo té vady
zůstává `lint`. Bylo to napsané jako předpoklad, ne jako měření; PR #6 je opravený.

---

## Danova rozhodnutí 2. 9. 2026 (u počítače, dotazem)

### BD-N28 — pravidlo 110 % patří na SERVER, ne do desktopu; B6 není priorita

Dan: *„časovač. priorita není. toto nastavení by se mělo udělat v app.ludone a aplikace ho
pouze přebírá. Alespoň tak si představuju, že půjde nastavit. Neumím teď říct, musíme na to
být připravení, ale není priorita."*

**Co to mění:** spor `spec.md` R7 („zašedlý a s důvodem") × `plan.md` B6 („není v nabídce")
se **neřeší volbou jedné z těch dvou vět**. Obě popisují chování, které má určit **server**.
Desktop pravidlo **nevyhodnocuje, přebírá ho**.

**Důsledky pro implementaci, až na B6 dojde:**
- 🔴 **Nezadrátovat ani jednu variantu.** Hranice 110 % ani způsob zobrazení nepatří do
  desktopu jako konstanta.
- Desktop dostane od serveru u každého projektu **rozhodnutí a důvod**, ne surová čísla
  k porovnání. Money pravidlo se nesmí počítat na dvou místech.
- **Fail-closed:** když server rozhodnutí nepošle, projekt se **nenabídne**. Nabídnout
  projekt, o kterém nevíme, jestli smí, je horší než nenabídnout nic.

**Stav:** B6 zůstává zablokovaná, **nově ale vědomě a s určeným směrem**, ne kvůli sporu
dvou dokumentů. S ní čeká i zapojení F011/F012/F013 — časovač bez výběru projektu nemá
co nabídnout.

### BD-N29 — aplikace musí umět i instalace jiných klientů

Dan: *„mysleme na to, aby fungovala aplikace i pro jiné instalace app.ludone pro jiné klienty."*

**Změřeno:** `electron/auth.cjs` **nemá zadrátovanou žádnou adresu serveru** — issuer je
parametr, endpointy se dohledávají přes `/.well-known/oauth-authorization-server` a ověřuje
se, že leží na stejném originu. Architektura tedy multi-tenant **už umí**.

🔴 **Brání tomu jediná kontrola** — `main.cjs:970` má výslovný seznam dvou správcem
schválených hostitelů pro produkční a labs prostředí. Nedá se jen smazat: brání odeslání
tokenu na podvržený server. Přesné hodnoty jsou provozní konfigurace, ne veřejný kontrakt.

Návrh a tři varianty jsou v [`OAUTH-CO-ZALOZIT.md`](OAUTH-CO-ZALOZIT.md) §3; doporučená je
**B — origin zadá správce při instalaci**. Je to změna specu u `security` funkce, takže
čeká na Dana.

**Druhý důsledek, který se snadno přehlédne:** každá instalace má vlastní OAuth server,
tedy **vlastní client ID**. Jedna globální proměnná `LUDONE_OAUTH_CLIENT_ID` multi-tenant
neuveze — client ID musí být uložené **v páru s originem**.

### BD-N30 — stavové osy v matici se smějí aktualizovat, zbytek specu zůstává zmrazený

Dan schválil. Zmrazení chrání **požadavky** (R1–R25, acceptance scénáře), ne stavové
sloupce. Matice `spec.md` §3 byla od 1. 9. neaktuální a tvrdila `no-code` u funkcí, které
jsou mergnuté — masterplán přitom osy označuje za jediný zdroj pravdy o stavu.

### BD-N31 — panel se schválenému designu NEODPOVÍDÁ; sladí se AŽ po zapojení

**Zjištěno 2. 9. 2026 spuštěním aplikace a srovnáním se schváleným náhledem** — nikoli
čtením kódu. Dan se podíval sám a rozdílu si všiml dřív, než jsem ho stihl nahlásit.

Schválený design má u klidového panelu jedinou hlavní větu: **„Panel má dvě věci a nic
jiného."** Skutečnost má tři a obě karty jsou výrazně těžší, než návrh předepisuje.

| | schválený design | běží dnes |
|---|---|---|
| kalendář | `explicitlyCut` — „ruší se" | 🔴 je tam (odstraňuje Codex) |
| hlavička | `LuDone · Dan Jirotka · připojeno` | odznak „Připraveno" |
| Nahrávání | řádek + souhrn `Dnes 2 nahrávky · 1h 12m` | velká karta s chybovým textem |
| LuTrack | řádek + souhrn `Dnes vykázáno 3h 05m` | karta s výběrem projektu a popisem |
| patička | 🔴 `Vše odesláno · 13:58` + Nastavení | jméno uživatele + ozubené kolo |
| měřáky stop | schválený nový prvek DS | ⛔ neexistuje |

🔴 **Nejcennější zjištění není vzhled, ale patička.** `Vše odesláno · 13:58` je **jediné
místo v celém designu, kde je vidět odchozí fronta**. Fronta je postavená a otestovaná, ale
neměla kde se zobrazit — teď víme proč: design jí dal domov a implementace ho nepostavila.

**Danovo rozhodnutí: sladit AŽ PO zapojení.** Důvod, který rozhodl: design počítá se souhrny
(„Dnes 2 nahrávky", „Vše odesláno"), a to jsou **data, která zatím nikdo nepočítá**. Překreslit
panel teď by znamenalo vyrobit další atrapy — a atrapa, která vypadá hotově, je nejnebezpečnější
druh rozdělané práce. Tenhle projekt už jednu takovou má: časovač, který sám přiznává
„uložení do LuTracku je ukázkové".

**Co z toho plyne pro pořadí prací:** zapojení (časovač, fronta, odhlášení) → teprve pak
překreslení panelu podle designu, protože až tehdy budou souhrny čím naplnit.

⚠️ **Poučení do procesu:** masterplán velí porovnávat diff proti schválenému designu. U hlavního
procesu se to dělalo, **u vzhledu panelu ne** — a nikdo si toho nevšiml, dokud aplikaci někdo
nespustil. Zelené testy tuhle třídu vady nezachytí ani náhodou.

### BD-N32 — přihlášení se nesmí zahodit kvůli chybějícímu jménu

**Nález z PRVNÍHO živého přihlášení, 2. 9. 2026.** Dan potvrdil souhlas, server vydal token —
a desktop celé přihlášení zahodil včetně odvolání tokenu. Doslovně:

```
[auth] Přihlášení zahájeno
[SONDA] surova chyba: Error | LuDone nevrátilo úplnou identitu uživatele
[auth] Přihlášení skončilo: {"ok":false,"duvod":"neznama"}
```

**Příčina, změřená proti skutečnému serveru:**

| co se čeká | co server dává |
|---|---|
| `normalizeIdentity` chce **jméno i e-mail** (`auth.cjs:263`) | token endpoint vrací **jen** `access_token`, `token_type`, `expires_in`, `refresh_token`, `scope` |
| bez `identityEndpoint` se čte z tokenové odpovědi | discovery **nemá `userinfo_endpoint`** |
| — | `ludone_ping` vrací **jen e-mail**, jméno nezná nikdo |

🔴 **Úspěšné přihlášení se rušilo kvůli zobrazovanému jménu.** Přihlášení je bezpečnostní
akce, popisek u avatara ne — ta nepřiměřenost je vada sama o sobě, nezávisle na tom, odkud
jméno vzít.

**Danovo rozhodnutí: obojí.** Desktop přestane přihlášení zahazovat (běží na Codexu),
požadavek na jméno ze serveru jde do `DAN-TODO.md`.

⚠️ **Nešlo to najít jinak než spuštěním.** Všech 331 testů bylo zelených; testy si identitu
podstrkovaly, protože skutečný tvar odpovědi nikdo neviděl. Tohle je ta hranice mezi
🧪 „zelené testy" a ✅ „ověřeno naostro", kvůli které ji masterplán drží.

### BD-N33 — klasifikátor chyb musí surovou chybu ZALOGOVAT

Když `duvod` skončí jako `neznama`, dnes se surová zpráva **zahodí** — uživatel dostane
„neznámá chyba" a vývojář taky. Kvůli tomu se muselo do produkčního kódu dočasně vložit
`console.error`, aby se vůbec zjistilo, co se stalo.

**Návrh:** nezařaditelnou chybu logovat (název třídy + zpráva), ale **bez autorizačního kódu
a bez tokenu**. Zapsáno jako práce, ne rozhodnutí — čeká na volnou frontu.

---

## Danova rozhodnutí o serverové straně — 2. 9. 2026 odpoledne

### BD-N34 — nahrávání ve DVOU FÁZÍCH; scope se odkládá, neruší

Dan: *„drag and drop vem zpět. Prostě 2 možnosti… Preferoval bych tlačítko nahrát /
automatický sync s serverem."* a *„zvol nejjednodušší cestu."*

🔴 **Zjištění, které tenhle rozhovor odhalil:** „tlačítko nahrát" původně znamenalo, že
nahrává DESKTOP — a ten se musí autorizovat. Token s `mcp:read` právo zápisu nedává, takže
by se scope vrátil zpátky, přestože ho Dan chtěl zrušit.

**Řešení, které scope nepotřebuje:**

| fáze | jak | právo |
|---|---|---|
| **1 (teď)** | tlačítko v panelu **uloží schůzku jako jeden soubor do Stažených** a otevře nahrávací stránku app.ludone; nahrává **prohlížeč** pod běžnou session | **žádné nové** |
| **1b** | drag & drop téhož souboru do app.ludone | žádné nové |
| **2 (později)** | automatický sync desktop → server, **defaultně vypnutý** | **teprve tady** scope pro zápis |

**Proč takhle:** fáze 1 je funkčně to, co Dan chce („po schůzce klik a je to na serveru"),
nevyžaduje ani nový scope, ani změnu souhlasové obrazovky, ani přeregistraci klienta. Scope
se tím **neruší, jen odkládá na okamžik, kdy ho poprvé opravdu potřebujeme.**

⚠️ **Web musí umět nahrát JAKÝKOLI zvukový soubor**, ne jen ten z desktopu — Dan výslovně
zmínil nahrávku z telefonu. Je to tentýž endpoint, jen jiný zdroj.

### BD-N35 — musí být poznat, KDO mluvil

Dan: *„Určitě by mělo být poznat, kdo přesně mluvil. Když bude víc lidí atp."*

Dvě různé věci, obě potřeba:

1. **Dva kanály v jednom souboru** (mikrofon vlevo, systém vpravo) — zadarmo oddělí
   „já" × „druhá strana". Desktop je nahrává odděleně už dnes, stačí je nemixovat do mono.
2. **Diarizace u přepisu** — rozdělení podle hlasu, když je na druhé straně víc lidí.
   To kanály neumí; musí to umět **přepisová služba**.

🔴 **Z toho plyne kritérium pro výběr přepisové služby: musí umět diarizaci a češtinu.**
Bez toho je ze zápisu ze schůzky jeden slepý text a ztrácí většinu hodnoty.

### BD-N36 — místo se hlídá kvótou, ne mazáním za zády

Dan: *„postavil bych prostě možnosti v nastavení modulu… bude se počítat třeba místo, které
bude dedikované těm zápisům, přes které by se nemělo jít, aby na serveru nebyly kraviny."*

- Retence a limity **jsou volby v nastavení modulu**, ne konstanty v kódu.
- Sleduje se **obsazené místo** proti vyhrazené kvótě.
- **Zvuk a přepis se počítají zvlášť** — přepis zabírá kilobajty, zvuk stovky megabajtů.

🔴 **Výchozí chování při plné kvótě (rozhodl běh, ne Dan — potvrdit):** nové nahrávání se
**odmítne se srozumitelnou hláškou**, nic se nesmaže automaticky. Tiché smazání dat, o která
uživatel nepožádal, je horší než odmítnutá nahrávka.

### BD-N37 — všechny kroky nad nahrávkou jsou na kliknutí

Dan: *„všechno na klik."*

Nahrávka po nahrání jen leží. Teprve klik **Přepsat** vyrobí text; **Shrnout** a **Přeložit**
jsou další samostatné kroky. Nic se neplatí za schůzky, které nikdo neotevře.

⚠️ Dan k tomu dodal: *„když agent načte, tak jemu stačí transkript a může si udělat shrnutí
sám."* ⇒ MCP potřebuje **nástroj na čtení přepisu** (spadá pod stávající `mcp:read`),
a shrnutí na serveru je pak volba pro člověka, ne povinný krok.

### BD-N38 — LuTrack se na serveru NEŘEŠÍ; kontrakt určí APLIKACE, desktop se přizpůsobí

Dan: *„ten LuTrack bych zatím neřešil na serveru, až časem. LuTrack bych udělal naopak, že
to vymyslí app, a desktop se pak přizpůsobí."*

**Dvě věci najednou, a ta druhá je důležitější:**

1. **Odklad.** Časová agenda vypadává z rozsahu serverové práce. Zůstávají jen nahrávky.
2. 🔴 **Obrácené vlastnictví.** Tvar časového záznamu **určí `ludone-app`**, ne desktop.

**Co to ruší z dřívějška:** v `SERVER-CO-POSTAVIT.md` stálo, že tvar položky `time-entry`
je *„zmrazený, spolehni se na něj"*. **To po tomhle rozhodnutí NEPLATÍ** — byl to popis toho,
co desktop dnes umí, ne závazný kontrakt. Opraveno, aby serverová session nestavěla podle
desktopu, když má být rozhodnutí opačným směrem.

**Co to znamená pro desktop:**
- `enqueueTimeEntry` a jeho tvar **zůstávají jako dnes** — nic se nemaže, jen se to zatím
  nikam neodesílá. Fronta časové položky přijímá a drží.
- Až aplikace kontrakt určí, desktop se **přizpůsobí jí**, ne naopak.
- Tím padá i otázka „kudy se autorizuje čas" — odkládá se spolu s celou agendou do fáze 2.

⚠️ **Důsledek, který stojí za pojmenování:** LuTrack v panelu tak zůstane funkční jen lokálně
a naměřený čas nikam neodejde. To je vědomý stav, ne nedodělek — ale **nesmí vypadat jako
hotová funkce**, jinak si někdo odklikne den práce, který se nikam nezapíše.

### BD-N39 — nahrávky zatím na LOKÁLNÍ disk, cesta ale konfigurovatelná

Dan se ptal, zda pro uložení použít už zakoupené externí síťové úložiště.

**Změřeno na hostu 2. 9. 2026:**

```
Produkční disk: 301G celkem · 170G použito · 119G volných (59 %)
Externí síťové úložiště NENÍ připojené
LuFak ukládá do adresáře s nahranými soubory na lokálním disku serveru
```

Hodinová schůzka = 80–240 MB (dvě stopy) ⇒ **119 GB ≈ 500–1500 hodin**, pro tým na rok.

**Rozhodnutí: začít lokálně, cestu k úložišti udělat konfigurovatelnou.**

Důvod není pohodlí, ale **počet věcí, které se ladí naráz**: síťové úložiště přidává nové
způsoby selhání — výpadek mountu uprostřed streamovaného uploadu, jiná sémantika `rename`,
pomalejší `fsync`. `E5` přitom stojí na atomických zápisech, které se na CIFS chovají jinak
než na lokálním disku.

**Kdy externí síťové úložiště zapojit:** při obsazenosti nad ~100 GB, **nebo dřív kvůli zálohám**
odděleným od stroje. Záloha je lepší důvod než kapacita a měla by přijít první.

### BD-N40 — „vidět design brzo" se týká DESKTOPU, ne serveru

Dan upřesnil: *„ten design jsem myslel pro tebe. Té desktop app."*

Schválený návrh má **22 obrazovek**; postavené a sladěné jsou **čtyři** (klidový panel,
oprávnění, nahrávání, nastavení).

> 🔴 **OPRAVA 3. 9. 2026: „nastavení" v té čtveřici NEPLATÍ.** Dan poslal snímek a měl
> pravdu. Změřeno proti `design/navrh/nahled.html:520–600`: návrh chce **čtyři záložky**
> (Účet · Zvuk · Záznamy · Diagnostika), my máme **jednu rolovací stránku se třemi sekcemi**.
> Chybí navíc řádky **Zařízení** a **Prostředí**, oba přepínače (Dock, start po přihlášení)
> a **celá záložka Diagnostika**. `spec.md` přitom vede `DSK-F015` jako **merged**.
> Sladěné obrazovky jsou tedy **tři**, ne čtyři. Nesladěné zůstávají zejména: **onboarding**, stav
**„nahrává se" s měřáky stop**, **výběr projektu** a **chybové obrazovky**
(přihlášení vypršelo · účet nemá přístup · bez sítě).

⇒ Další práce na desktopu je **sladit zbývající obrazovky se schváleným návrhem**, ne přidávat
funkce. Serverová session dostala krok 0 „design napřed" pro svůj vlastní modul — to platí dál
a s tímhle se to neplete.

## BD-N41 — Repozitář půjde na public, docs se předtím pročistí (Dan, 2. 9. 2026)

Dan zvolil **„public, ale docs napřed pročistit"**. Důvod: Actions jsou u veřejných
repozitářů zdarma a bez limitu minut, a **GitHub Releases** je rovnou distribuční kanál
i feed pro aktualizace. Alternativy odmítnuty: privátní repo znamená platit Actions
a distribuovat jinudy, „public rovnou" by zveřejnilo vnitřní dokumentaci beze změny.

**Podklad k rozhodnutí (měřeno, ne odhadnuto):** `gitleaks` projel 204 commitů a našel
**jediný nález** — `access_token = "ya29.TESTOVACI"` v `sekce-navrhy/audit-redaction.md`,
tedy falešný token v dokumentu o tom, jak tokeny neuniknout do logů. Žádné klíče, hesla
ani skutečné tokeny. Klientská OAuth ID jsou public client dle RFC 8252
(`client_secret_hash=NULL`) a v repu navíc jen zkrácená.

🔴 **Co pročištění NEVYŘEŠÍ:** zveřejněním se zpřístupní **celá historie**. V historických
commitech jsou dohledatelné dva interní hostname, tři konkrétní serverové cesty a další
starší provozní identifikátory, ale žádné přihlašovací údaje. Úprava současných souborů
historii nepřepíše. Znalost cesty přístup nedává a hostname bývají dohledatelné z veřejných
certifikátových logů.

Kdyby Dan chtěl nulovou stopu, existují jen invazivní cesty: přepsat historii
(`git filter-repo`, rozbije všechny klony a otevřené PR), nebo založit nový veřejný
repozitář se slitou historií. Obojí stojí historii; doporučení je **přijmout to**.

## BD-N42 — Aktualizace přes electron-updater s podepsanou aplikací (Dan, 2. 9. 2026)

Dan kupuje **Apple Developer účet** a chce to postavit pořádně: `electron-builder`
+ `electron-updater` + notarizace, feed na GitHub Releases.

Dnešní stav změřen: v repu **není** electron-builder ani electron-updater, jen vlastní
`scripts/package-mac.mjs`. Bez podpisu a notarizace macOS staženou aplikaci odmítne
hlášením „je poškozená“ a automatické aktualizace nejdou udělat bezpečně — proto ten účet
není luxus, ale podmínka.

🛑 **Nákup účtu je Danova stopka** (peníze + účet u Applu). Do té doby se staví všechno,
co na podpisu nezávisí: konfigurace electron-builderu, kanál aktualizací, verzování.

### BD-N43 — Připomínky (DSK-F014) se zatím NESTAVÍ; nastavení patří na server

Dan, 2. 9. 2026 v konverzaci: *„hele, časovač. priorita není. toto nastavení by se měl
udělat v app.ludone a aplikace ho pouze přebírá… není priorita."*

🔴 **Tohle rozhodnutí do dneška nikde nestálo** — žilo jen v chatu. Zapisuje se proto, že
`spec.md` má `DSK-F014` jako `approved` a rozhodnutí **M20** ho výslovně chce („Připomínky
ve zvolené dny a hodiny, když neběží časovač. Nikdy během nahrávání"). Kdokoli, kdo si
přečte jen spec, tu funkci logicky postaví — a půjde proti Danovi, aniž by to tušil.

**Co platí:**

| | |
|---|---|
| M20 (chtěná funkce) | **platí dál**, neruší se |
| priorita | **nízká** — Dan ji výslovně odsunul |
| kde bydlí nastavení | **v app.ludone**, desktop ho jen přebírá |
| stav dnes | `no-code` · `disabled` — a je to **správný stav**, ne nedodělek |

**Důsledek pro pořadí prací:** dokud server nemá, odkud to nastavení vzít, nemá desktopová
implementace o co se opřít. Postavit ji dřív by znamenalo vymyslet si vlastní úložiště
nastavení a pak ho zahodit — přesně ten druh práce, který se dělá dvakrát.

⇒ **Nestavět, dokud Dan neřekne jinak nebo dokud server nezpřístupní ta nastavení.**
