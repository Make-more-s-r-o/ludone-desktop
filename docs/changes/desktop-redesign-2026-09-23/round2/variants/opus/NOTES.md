# Dvě stopy — LuDone Desktop, druhé kolo (varianta `opus`)

> Návrh a lokální simulace s fiktivními daty. Nic z toho není vydaná funkce ani schválená implementace.
> Otevření: `index.html?scenario=home&theme=light`. Vlevo nahoře v simulované liště je nabídka
> „Návrh · simulace", která přepíná síť, restart, ztrátu zdroje a odpovědi serveru.

## Nosná myšlenka

Den má dvě stopy: **práci** (čas v LuTracku) a **zvuk** (nahrávky schůzek). Běží vedle sebe na jedné
časové ose, každá se zapíná a vypíná sama. Schůzka nad prací je jen **časový překryv**. Nahrávka proto
nikdy nezaloží čas a změna projektu nikdy nepřesune nahrávku do jiné firmy. Firmu nahrávky aplikace
navrhne podle běžící práce, ale ukáže ji jako samostatné pole a potvrdíš ji až po skončení.
**Panel v liště** ukazuje, co běží teď: nahoře živá stopa, pod ní „Čeká na tebe" a nakonec dnešek.
**Okno** ukazuje celý den, detail položky a nastavení. Všechno, co se týká týdne, týmu nebo peněz,
předá aplikace webu s konkrétním cílem. Ikona aplikace používá dodaný originál LuDone;
dvě stopy jsou modelem práce, nikoli novou značkou.

## Tři produktové nápady

| Nápad | Jakou potřebu řeší | V prototypu | Stav |
|---|---|---|---|
| **Jeden řádek „Projekt a co děláš"** — hledání pozná projekt i popis naráz (`sever příprava` → Web Studia Sever · Příprava obsahu) a nabídne i příkazy (`nahr`, `den`). | Ráno ani při přepnutí nechci klikat přes dva výběry a znovu psát stejný popis. | Funkční, šipky + Enter, klávesy `/`, `1–3`, `R`, `P`. | Nyní |
| **Souvislost schůzky s prací** — nahrávka pořízená během práce ukáže, kdy práce běžela, a navrhne její firmu. Při přepnutí projektu aplikace vysvětlí rozdíl a nabídne „Ponechat / Změnit". | Nechci ručně vybírat firmu u každé schůzky, ale taky nechci, aby se nahrávka tiše přestěhovala. | Funkční, cesty 2 a 4. | Nyní |
| **„Začal jsem dřív"** — posunutí začátku běžícího úseku o 5/15/30 min nebo na přesný čas, nejdřív na konec předchozího úseku. | Nejčastější zapomenutý čas je pozdě spuštěný časovač. Kvůli tomu nemá smysl chodit na web. | Funkční, s kontrolou hranic. | Nyní |

Další nápady jsou jen výhled:
- **Detekce nečinnosti** (Další etapa, nový nápad): nabídla by „Ukončit v čase poslední aktivity". V prototypu ji zastupuje jen obnova po restartu, kde aplikace zná čas, kdy byl Mac naposledy aktivní.
- **Pojmenování podle opakované schůzky** (Pouze nápad): v listu je jen chip „Dříve použité", žádné odvozování z kalendáře.

## Mapa dne (povinné cesty)

| # | Co člověk dělá | Kde | Co vidí |
|---|---|---|---|
| 1 | Ráno napíše `sever příprava`, dvakrát Enter | panel · Práce | Běží místně, velký čas; zavřením panelu nic nekončí a v liště je `0:00+` |
| 2 | `R` během práce → Ukončit nahrávání → list „Pojmenuj" → Uložit a odeslat | panel | Obě stopy mají svůj svislý pruh (zelený a červený). Čas běží dál a v listu to stojí výslovně |
| 2b | Zastavit čas | panel · karta „Hotovo" | Úsek (čeká → potvrzeno) i nahrávka (odesílá se → ověřeno) a další krok: Pokračovat / Přepis na webu |
| 3 | Nahrát bez projektu → Nechat na Macu | panel | Stopa zvuku jde nahoru, výběr projektu se zmenší, čas nevznikne |
| 4 | Přepnout práci během nahrávání | panel · Práce | Popis, co se uzavře (s délkou). Ve stopě zvuku: „Práce patří k Ateliér Jih, nahrávka dál míří do Studio Sever" |
| 5 | Chybí firma / vypršelo přihlášení | panel · Čeká na tebe | Oprava na místě (výběr firmy, Přihlásit znovu) a potom samostatné tlačítko „Odeslat do …" |
| 6 | Síť vypadne při souběhu | panel · proužek | „Bez sítě, vše se ukládá na Mac". Po obnově se čekající položky potvrdí nebo ověří a „Na Macu" zůstane „Na Macu" |
| 7 | Restart | panel · list | Ukončit v čase poslední aktivity / v jiném čase / neukládat. Nic se nevykáže samo a čekající nahrávky list jen vypíše |
| 8 | Den → detail | okno | Stopa dne, řádky, detail se čtyřmi kroky stavu, souvislost s prací, Finder, Koš s potvrzením, web |
| 9 | Aktualizace při souběhu | oznámení → list → proužek | Připravit / Později. Stav „připraveno, čeká na měření a nahrávání", tlačítko restartu jen když nic neběží |
| 10 | První spuštění, nastavení, identita | panel / okno | 3 kroky (přihlášení v prohlížeči, co budeš dělat, oprávnění), nastavení, ikony |

## Panel, okno a návrat

- **Panel (400 px, v rámu 416 × 680)** otevře klik na znak LuDone v liště nebo `⌥⌘L`. Zavře ho Esc nebo klik mimo. **Zavření nikdy nic nezastaví.**
- **Okno (684 px, v rámu 700 × 760)** otevře tlačítko „Den" v panelu, klik na položku dne nebo ikona nahrávek či nastavení. V titulku okna je živý štítek s během, klik na něj vrátí do panelu. Semafor okno zavře a měření i nahrávání běží dál. Ikona v Docku je ve výchozím stavu vidět, jen když je okno otevřené.
- Ovládání běhu je jen v panelu, okno běh jen ukazuje. Nevzniknou tak dvě místa, odkud se dá zastavit čas.

## Hranice desktop / web

**Pravidlo pro budoucí rozšiřování:** funkce patří do desktopu, jen když splní všechny tři podmínky:
(1) týká se toho, co dělám **teď nebo dnes já**; (2) dá se dokončit **do deseti vteřin bez tabulky**;
(3) dává smysl **i bez sítě**. Jinak patří na web a desktop na ni nabídne odkaz s konkrétním cílem
(například „LuTrack na webu · Přehled, týden 39").

| Desktop | Web |
|---|---|
| start, stop a přepnutí práce; popis; posunutí začátku běžícího úseku | týden, uzávěrka týdne, export, schvalování výkazů |
| dnešní úseky: úprava času a popisu, doplnění zapomenutého úseku **jen dnes a jen vlastního** | starší dny, mazání a dělení potvrzeného času, cizí úseky |
| nahrávání, pojmenování, cílová firma, odeslání, retry, ověření, Finder, Koš, převzetí vlastnictví | přepis, analýza, týmový archiv, přesun odeslané nahrávky mezi firmami |
| alokace jen jako nenápadný údaj „zbývá 18 h 40 min" | přidělování projektů a alokací, finanční výpočty, statistiky, správa |

**Rychlá oprava zapomenutého času:** desktop umí jen dnešek a jen vlastní úseky (začátek běžícího
úseku, úprava a doplnění dnešního úseku bez překryvu). Starší dny, mazání a dělení jdou na web.
Výhoda je, že nejčastější chyba se opraví hned tam, kde vznikla. Cena je druhé místo s editací času,
proto má jen úzký, jasně ohraničený rozsah a každá úprava se znovu posílá ke potvrzení serverem.

**Bod rozšíření:** řádek „Projekt a co děláš" už dnes umí i příkazy (`nahr`, `den`, `nahravky`,
`nastaveni`). Nová schopnost se napřed přidá jako příkaz. Vlastní místo v panelu dostane, až když se
podle měření používá denně. Díky tomu nevznikne boční panel s položkami „Již brzy".

## Stavy (jeden model pro obě stopy)

- Práce: **Běží místně** → **Čeká na synchronizaci** → **Potvrzeno serverem** (LuTrack úsek přijal; neznamená schválený výkaz), případně **Vyžaduje zásah**.
- Nahrávka: **Uloženo na Macu** → **Ve frontě** → **Odesláno** (server soubor přijal) → **Ověřeno v LuDone** (sedí délka i velikost), případně **Vyžaduje zásah** (firma, přihlášení, limit serveru, vlastník).
- Stav nenese jen barva, ale vždy ikona a text. Monochromatický znak v liště zachovává geometrii originálu LuDone; tečka značí zvuk, čas práci a plný trojúhelník pozornost. Trojúhelník se ukáže jen tehdy, když něco stojí (přihlášení, ztracený zdroj, rozhodnutí po restartu). Jednotlivá neodeslaná nahrávka je jen v panelu. Ikona Docku je statická.
- Síť a přihlášení: čas se po návratu synchronizuje sám. Nahrávku odešle jen člověk, výjimkou je automatika zapnutá pro nové nahrávky.

## Současná funkce vs. navržená

| Oblast | Dnes (podle společného zadání) | V tomto návrhu |
|---|---|---|
| Nahrávky | desktop 0.1.4: mikrofon + systémový zvuk, jedna schůzka = jeden stereo soubor, pojmenování, firma, odeslání, lokální přehled | stejné schopnosti, přeskládané do stopy „Zvuk", listu po skončení a detailu se čtyřmi kroky |
| LuTrack | jen web ludone.cz/time-tracking (Časovač, Přehled, Management, Admin); desktopová integrace ani API nejsou známé | stopa „Práce" v panelu, dnešek v okně; server v prototypu jen simulovaný |
| Souvislost | žádná | časový překryv, návrh firmy, vysvětlení při přepnutí |
| Aktualizace | vydávání 0.1.x | proužek, jedno oznámení, instalace až po výslovném kliknutí a jen když nic neběží |

## Mapa dosavadních akcí na nové místo

| Akce | Nové místo |
|---|---|
| Vybrat/hledat projekt, popis, Start | panel · Práce · řádek „Projekt a co děláš" → Začít měřit (Enter) |
| Běžící čas, změna popisu | panel · Práce · velký čas a popis upravitelný na místě |
| Nová / přepnout projekt | panel · Práce · Přepnout práci (`P`) |
| Zastavit | panel · Práce · Zastavit čas |
| Dnešní záznamy, přidat, upravit | panel · Dnes (5 posledních) → okno · Den; přidat/upravit jen dnešek |
| Smazat záznam | detail úseku → web (Smazat nebo rozdělit na webu) |
| Přehled týdne, souhrny, export, uzavření týdne | okno · Den → web, týden 39 |
| Management, Admin, alokace | web; alokace jen jako údaj v panelu |
| Nahrát, připravenost zdrojů, oprava oprávnění | panel · Zvuk · Nahrát schůzku (`R`), řádky Mikrofon / Systémový zvuk s Povolit/Opravit |
| Ztráta zdroje | panel · Zvuk · Znovu připojit / Pokračovat jen s mikrofonem |
| Ukončit, pojmenovat, firma, Uložit a odeslat / Nechat na Macu | list „Pojmenuj nahrávku" po ukončení |
| Obnovit přehled | okno · Nahrávky · Obnovit přehled |
| Odeslat, zkusit znovu, ověřit | panel · Čeká na tebe; okno · detail nahrávky |
| Otevřít v LuDone, ukázat ve Finderu | detail nahrávky (předání je jen popsané, neprovede se) |
| Přesunout do koše | detail → konkrétní potvrzení s názvem a informací, zda jde o jedinou kopii; Vrátit |
| Převzít vlastníka | Čeká na tebe / detail → Převzít jako Alex Novák… |
| Obnova přihlášení | Čeká na tebe · Přihlásit znovu; také v listu uložení a v detailu |
| Cílová firma výchozí, automatika, retence, spuštění při přihlášení, Dock, diagnostika | okno · Nastavení |
| Aktualizace | proužek v panelu, Nastavení › O aplikaci |

## Zvažované alternativy

1. **„Schůzka jako obal"**: tlačítko „Zahájit schůzku" by spustilo zvuk i čas najednou a „Ukončit schůzku" obojí zastavilo. Kombinace je pohodlná, ale jedno tlačítko se dvěma důsledky porušuje invariant nejčastěji: lidé ho zmáčknou i na hovor, který se nevykazuje. Odmítl jsem ho, souvislost vzniká jen časovým překryvem.
2. **Časová osa jako hlavní plocha panelu**: panel by byl celý jedna svislá osa dne s živým koncem nahoře (jako u aplikace Timing). Den je z ní krásně čitelný, jenže ranní start by potřeboval hledat projekt pod osou a panel by vypadal jako dashboard. Osa proto zůstala jako pomocný pruh „Dnes" a velká je až v okně.

## Implementační etapy (odhad velikosti, bez určování API)

| Etapa | Velikost | Obsah | Závisí na |
|---|---|---|---|
| E1 | S | Nový panel nad dnešními nahrávkami: stopa Zvuk, list po skončení, Čeká na tebe, čtyři stavy | dnešní desktop 0.1.4 |
| E2 | M | Stav v liště (tvar + čas), okno Den a Nahrávky, detail, Koš s potvrzením | E1 |
| E3 | M | Stopa Práce v režimu jen na Macu (start, stop, přepnutí, obnova po restartu), bez odesílání | rozhodnutí, jak desktop zapisuje čas (Danův vstup 1. 9.: „dávat inputy do DB") |
| E4 | L | Synchronizace času se serverem, stavy čeká / potvrzeno / vyžaduje zásah, úpravy dneška | **ověřené** rozhraní LuTracku; dnes neznámé, odhadem se neurčuje |
| E5 | S | Souvislost schůzky s prací (návrh firmy, vysvětlení při přepnutí) | E1 + E3; mapování projekt → firma z LuTracku |
| E6 | S | Aktualizace při souběhu (proužek, oznámení, restart jen v klidu) | stávající mechanismus aktualizací |

## Inspirace (skutečně použité)

Žádnou externí stránku jsem v tomto běhu nenavštívil. Vycházel jsem jen z typologie uvedené v zadání:
Plaud (rychlé zachycení), Raycast (jeden řádek a klávesnice), Linear (hierarchie seznam → detail),
Toggl Track / Timing (pokračování poslední práce, osa dne) a Apple HIG (menu bar extra + okno).
Ze společných podkladů jsem četl: `SHARED-BRIEF.md`, `shared-assets/tokens.css`,
`ludone-design-system/SKILL.md` a `references/tokens.md`, `design/zadani/dan-vstup-2026-09-01.md`
a začátek `design/navrh/Lista.dc.html` (historický podklad). Variantu druhého autora ani návrhy
z prvního kola jsem nečetl.

## Finalizace po dodání značky

Původní návrh vytvořil Claude Opus 5.5. Následnou omezenou finalizaci provedl Codex Sol po
upřesnění `ICON-ADDENDUM.md` a `CLARIFICATIONS.md`. Dock, notifikace a hlavička nyní používají
kopii canonical `LuDone.svg` z dodaných podkladů; Identity porovnává původní ikonu s jemně
označenou variantou Desktop. Doporučena je původní ikona pro shodu s LuDone. Tray zůstává
samostatným monochromatickým stavovým znakem s původní geometrií. Staré obrázky v `evidence/`
zachycují stav **před finalizací ikony** a nejsou jejím vizuálním důkazem.

Omezené review opravilo přepis neuložené nahrávky při dalším startu, její zachování v simulaci
restartu a reset souhlasu při změně cílové firmy místní/chybové nahrávky. Dřívější potvrzení
odeslání do jiné firmy se tím znovu nepoužije. Serverem již přijatý cíl zůstává needitovatelný.
Připravení aktualizace nedává souhlas k restartu; tlačítko „Aktualizovat a restartovat“ se nabízí
teprve po skončení času, zvuku a uložení. Žádný zásah neprokazuje produkční funkci.

## Ověření a omezení

- ⚠️ Původní autor uváděl 14 scénářů × 3 témata a 34 kontrol cest, ale jeho autorský běh přerušila obnova Orcy a soubor `evidence/overeni.txt` se nezachoval. Tento úplný běh proto nepovažujeme za doložený. Skript a původní screenshoty v `evidence/` zůstávají historickým podkladem.
- 🧪 Finalizace Sol má syntaktickou kontrolu s exit 0 a shodu originální značky; koordinátor následně proklikal hlavní cesty hotového HTML. Přesný rozsah a omezení jsou v `../../../../../../dukazy/desktop-experience-2026-09-23/ROOT-REVIEW.md`.
- Je to simulace. Web, Finder, Nastavení systému, oprávnění a Dock jsou jen popsané předání v hlášce „Simulace — nic se neotevřelo". Zelená kontrola cesty neznamená, že funkce běží v produkci.
- Brockmann je jen místní podklad bez licence k veřejnému publikování.
