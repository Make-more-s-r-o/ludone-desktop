# Skeptická revize 5

**Adversariální čtení návrhu sekce.** Zadání znělo najít, čím se dá
tvrzení obejít nebo v čem lže — ne schválit.

---

## Verdikt

Sekce je věcně nejlepší část dokumentu — 31 momentů je poctivě přetavených, návrhy jsou označené jako návrhy a většina čísel má zdroj (ověřil jsem `main.cjs:27-28` = 366/792, `main.cjs:252` = resize 18×18, `main.cjs:355-356` = 448/676, `auth.cjs:9` = 5 min, `specs/E6:67` = 2 GB/5 GB, 670 px je doslova v `nahled.html:673`, zkratky `⌃⌥R/⌃⌥T/⌃⌥L` jsou v `design/navrh/Lista.dc.html:138-141`). Přesto **v ní je jedna vada, která v1 zastaví úplně**, pět míst, která jdou splnit formálně a nesplnit věcně, a devět momentů, které v ní nejsou vůbec.

---

## A. Co se dá obejít nebo co lže

### A1. Retence se v v1 NIKDY nespustí a appka po ~38 hodinách schůzek přestane nahrávat (nejzávažnější)

Tři věty ze sekce, každá zvlášť pravdivá, dohromady tvoří past, kterou sekce nepojmenovává:

- J1 #12: „pod 2 GB volna **nebo nad 5 GB ve složce** se nahrávání nespustí“ (`specs/E6:67`, doloženo)
- J1 #15 + J3-B: odesílání je v v1 vypnuté (S1, `DESKTOP_UPLOAD_ENABLED` fail-closed)
- J3-B7: „retence 7 dní běží až od potvrzeného odeslání (R19)“

`specs/E6:67` říká doslova: *„Smazat se smí VÝHRADNĚ položka ve stavu `uploaded`“* a `deleteAfter` se razítkuje při přechodu do `uploaded`. Když se v v1 nikdy neodesílá, **nic se nikdy nestane `uploaded`, janitor nikdy nic nesmaže a složka roste monotónně** až na 5 GB. Při vlastním dopočtu sekce (~1,1 MB/min) je to ~75 hodin zvuku, při dvou stopách ~38 hodin — tedy pár týdnů běžného provozu. Pak appka odmítne nahrávat a jediná cesta ven je Finder.

**Oprava (patří do J3 i do §5.4 Záznamy):** v1 musí mít cestu k místu nezávislou na odeslání. Tři varianty, rozhodnout musí Dan (jde o mazání firemního záznamu):
1. karta Záznamy dostane „Smazat vybrané“ + trvale viditelné „Na tomto Macu: N nahrávek, X GB z 5 GB“ (ruční, bezpečné, ale spoléhá na kázeň);
2. varovný pruh v panelu od 80 % stropu, ne až odmítnutí startu;
3. retence i pro **neodeslané** záznamy — to je ztráta dat a musí to být Danovo rozhodnutí, ne default.
Minimum bez rozhodnutí: napsat do sekce, že strop 5 GB je v v1 tvrdý konec provozu, a doplnit k J1 #12 větu „nespustí a **řekne, co s tím uživatel může udělat**“ — dnešní text končí u „řekne proč“, což je z pohledu člověka slepá ulička.

### A2. Nejmíň pět řádků je práce serveru, která v desktopovém specu nemá vlastníka

`S1` říká, že serverová strana není v rozsahu. Přesto sekce zadává:

| Řádek | Co požaduje | Kdo to může splnit |
|---|---|---|
| J1 #1 | stahovací stránka | web / nerozhodnuto |
| J1 #7 | „Přihlášen jako &lt;e-mail&gt;“, souhlas nemluvící jazykem MCP | **server** (výzkum to říká výslovně: „na serveru, ne v desktopu“) |
| J3-C5 | vrátit do appky `expired_or_consumed`, `initiator_mismatch`, `account_not_allowed` | **server** — dnes končí `failLocally` v prohlížeči |
| J3-C6 | text „použito na dvou počítačích naráz“ | **server** (reuse detection) |
| J4 #4 | seznam lidí pro „čí to bylo“ | **server** |

Sekce u J4 #4 správně přiznává „server není v rozsahu“, u ostatních čtyř ne. Důsledek: desktop projde svým DoD se zelenou, zatímco cesta zůstane rozbitá, a nikdo si toho nevšimne, protože ten požadavek nemá čí story.

**Oprava:** přidat každému řádku obou tabulek J1–J4 sloupec **„kdo splní: desktop / server / nerozhodnuto“** a všechny serverové řádky zároveň vypsat do `KONTRAKT.md` jako požadavek na příští běh. Bez toho jsou to přání, ne požadavky.

### A3. R7 a „zbývající hodiny z alokace“ jsou v v1 měřidlo bez zdroje dat

J2 #3 slibuje „u každého projektu zbývající hodiny z alokace“ a R7 „nad 110 % zašedlý s důvodem“. Jenže N1 zní „zatím nikam, později přes `app.ludone.cz`“ a `plan.md` má v1 adaptér **lokální**. Zdroj čerpání i alokací tedy v v1 neexistuje.

Co se stane doopravdy: implementátor vezme fixture, `spec.md §8` („projekt s čerpáním 112 % nejde vybrat“) se rozsvítí zeleně nad vymyšleným číslem, a v panelu bude money-path obrazovka ukazující zbývající hodiny, které si appka vymyslela. To je přesně ta třída vady, kterou tenhle projekt už jednou zaplatil.

**Oprava — dvě věty do J2 #3:** „Zbývající hodiny se zobrazují **jen tehdy, když je adaptér dostal z autoritativního zdroje**; jinak se u projektu neukáže žádné číslo a napíše se ‚Zbývající hodiny ukáže LuDone‘. Placeholder ani odhad se nekreslí nikdy.“ A k R7 doplnit **fail-closed větev**: když čerpání není známé, nabízí se projekt, nebo ne? To je otevřená otázka pro Dana (money-path), ne detail k dovyplnění.

### A4. J2 #12 „Vypršení přihlášení nepozná nijak“ odporuje `spec.md §6` i `§8`

Matice stavů má řádek „Přihlášení vypršelo → panel ‚Zkusit znovu‘ + Co se mohlo stát“ a akceptační scénář `DSK-F003` končí slovy **„ne mlčí“**. Řádek J2 #12 ve své zkratce říká opak a jde splnit doslova tím, že panel nikdy nic neřekne — a R14/R15 v poznámce to zdánlivě posvětí.

**Oprava:** rozdělit dvě různé věci. „Tichá obnova tokenu na pozadí uživatele nezajímá a **nesmí** se projevit (R14). Když obnova selže, panel mlčí do chvíle, kdy uživatel chce něco, co potřebuje síť — pak řekne důvod a nabídne ‚Zkusit znovu‘.“ Tak je řádek testovatelný a nekoliduje s §8.

### A5. J4 #6 přebíjí killswitch podle účtu — nová mechanika mimo R18

Text: *„Dokud Dan nerozhodne, `DESKTOP_TIME_ENABLED` na tomhle účtu neplatí.“* R18 i `plan.md` znají jen dva globální fail-closed vypínače. Podmínit vypínač účtem znamená, že test „`DESKTOP_TIME_ENABLED=1` ⇒ časovač jde“ projde na osobním Macu a mlčky selže na zasedačce — bez vlastního testu.

**Oprava:** vypínač nechat na pokoji a napsat to jako **vlastnost profilu zařízení**: „Na sdíleném zařízení se časová agenda nenabízí. Je to samostatné pravidlo (návrh, fail-closed) s vlastním testem; `DESKTOP_TIME_ENABLED` se tím nemění.“ A dopsat, co uživatel na zasedačce **vidí místo** karty času — dnešní text říká jen „nenabízí se“, což jde splnit i mrtvým tlačítkem.

### A6. Rozpoznání sdíleného zařízení přepínačem v Nastavení je money-path přepínač bez auditu

J4 #9 navrhuje příznak v Nastavení. Nastavení otevře na zasedačce kdokoli. Vypnutím příznaku zmizí otázka „čí to bylo“ a nahrávky se tiše přiřadí zasedačce; zapnutím na **osobním** Macu naopak zmizí časová agenda a hodiny se přestanou vykazovat. Obojí je tichá chyba a `decisions.md B1` má „jak se pozná sdílené zařízení“ mezi otevřenými body — sekce to překlápí na „návrh“, tedy měkčeji, než to je.

**Oprava:** buď příznak zamknout (nastavuje se jednou při prvním přihlášení a v panelu je jen ke čtení, změna vyžaduje odhlášení), nebo J4 označit jako **blokované rozhodnutím**, ne jako návrh. Autoritativní zdroj (atribut účtu ze serveru) je mimo rozsah S1 — to je potřeba napsat rovnou.

### A7. Copy „Odesílání je v této verzi vypnuté“ je natvrdo verze místo stavu, a odporuje schválenému návrhu

Dvě věci naráz:
- `DESKTOP_UPLOAD_ENABLED` je **vypínač**, ne verze. Kdo ho flipne, dostane appku, která odesílá a přitom tvrdí, že odesílání je vypnuté. Text musí vycházet z běhového stavu vlajky.
- Schválený návrh kreslí na téže obrazovce primární tlačítko **„Uložit a odeslat“** (`nahled.html:490-493`). Podle `spec.md` § „Autorita při rozporu“ se vzhled řídí návrhem interpretovaným specem a **implementátor rozpor neřeší sám**. Sekce ten rozpor mlčky rozhoduje.

**Oprava:** označit to jako rozpor návrh × spec s návrhem řešení („Uložit“ + řádek pod tlačítkem odvozený z vlajky) a nechat to potvrdit — jinak tuhle změnu copy někdo při implementaci vrátí zpět na návrh.

### A8. Zákaz citlivých dat v logu je uvnitř §5.4 sám se sebou v rozporu — a nemá měřidlo

§5.4 dává do exportu diagnostiky **frontu**, a položky fronty nesou `label`, tedy název schůzky. Pravidlo o dva odstavce níž název schůzky v exportu zakazuje. Návrh kreslí jen stav „Fronta prázdná“, takže rozpor v obrázku není vidět.

Druhá půlka problému: zákaz je dnes splnitelný trivialitou — nikdo nic neloguje, takže „projde“, a první `console.log(user)` ho tiše poruší. Bez měřidla je to přání.

**Oprava:** (a) do exportu jen **počty a stavy**, nikdy `label`; (b) doplnit mechanickou bránu: test, který vyrobí export nad frontou se štítkem „Porada s klientem“ a e-mailem v session a **grepne** výstup na `@`, na ten štítek a na prefix tokenu; identifikátory musí odpovídat `^[0-9a-f-]{36}$`. K tomu sabotáž, která do exportu e-mail přidá a musí zčervenat. Bez toho ten červený odstavec nic nevynucuje.

### A9. Rezerva 24 bodů je odhad, který Electron dělat nemusí

Autor přiznává, že výšku systémové lišty na macOS 26 neměřil. Nemusí: `screen.getDisplayNearestPoint(point).workArea` (ověřeno v dokumentaci Electronu) už lištu i Dock odečítá, a `screen.getMenuBarHeight()` je v breaking-changes **označené za nahrazené právě `workArea`**. Odhad je tedy zbytečný a navíc křehčí (Dock dole, druhý displej bez lišty, notch).

**Oprava vzorce:** `výška = clamp(minimum, workArea.height − okraj panelu, 792)`, kde `workArea` se bere z displeje pod ikonou v liště a přepočítává se na `display-metrics-changed`. Zůstane jediné neměřené číslo (okraj), a to je kosmetika.

### A10. Panel „se zkrátí“ nemá dolní mez — a nejdůležitější tlačítko se stěhuje

Dvě díry ve stejném pravidle:
- Bez minima jde pravidlo splnit i panelem vysokým 140 bodů, kde hlavička a patička sežerou vše a prostředek roluje po řádku. Doplnit **podlahu** (návrh: 420) a říct, co se stane pod ní.
- „Ovládání běžící agendy se při nedostatku výšky přesune do patičky (návrh)“ znamená, že **„Ukončit a uložit“ mění místo podle velikosti obrazovky** — a patička má podle téže tabulky nést souhrn fronty a Nastavení. Lepší a testovatelnější: akční řádek běžící agendy je **přilepený vždy**, tedy pásma jsou hlavička / rolující prostředek / akce+patička, a nestěhuje se nikdy.
- „Běžící agenda musí být vidět bez rolování“ je při **dvou** běžících agendách nerozhodnutelné. Sekce u lišty poctivě přiznává, že přednost nahrávání je důsledek kódu a otevřená otázka — v panelu si tutéž přednost mlčky bere. Buď ji napsat s důvodem (nahrávání má nevratnou stopu, čas jde dorovnat), nebo označit stejně otevřeně.

### A11. Odpočet „zbývá 9:42“ je číslo, které desktop nemá odkud vzít

10 minut je TTL **serveru** (`PENDING_TTL_MS`); desktop dnes zavírá listener po 5 (`auth.cjs:9`) a v `KONTRAKT.md` žádné pole s TTL není. Panel by tedy odpočítával konstantu opsanou z cizího kódu — a až se serverová hodnota změní, panel bude lhát s přesností na vteřiny.

**Oprava:** buď TTL doplnit do `KONTRAKT.md §3` jako závaznou hodnotu a v panelu ji odvozovat z ní, nebo (levněji) neukazovat „zbývá“, ale „čekám 1:12“ + Zrušit. Požadavek „listener musí žít déle než serverová žádost“ zůstává a je správně.

### A12. `bytes: 0` jako signál chybějící stopy koliduje s vlastním kontraktem

`KONTRAKT.md §3` má v ukázce zakládacího POSTu **obě** stopy s `"bytes": 0` (je to placeholder). Server tedy nerozezná „stopa chybí“ od „klient ještě nedoplnil“. Navíc §3 nechá `complete` ověřit součet i `sha256` — chybějící stopa s hashem prázdna projde jako **platná prázdná nahrávka**, a přes MCP se pak čte jako „schůzka nahrána“.

**Oprava návrhu:** explicitní pole, ne magická nula — `tracks[].status: "ok" | "missing" | "partial"` + `missingFrom` (ISO UTC). A dopsat, že je to **změna `KONTRAKT.md`**, tedy rozhodnutí serverového běhu, ne věc, kterou si desktop vyřeší sám.

### A13. Dvě hodiny ≈ 130 MB stojí na kresbě, ne na měření

Sekce to označuje jako dopočet, to je poctivé. Chybí ale, že zdrojové číslo (`38 minut · 42 MB`, `nahled.html:490`) je **údaj v ilustraci** a **není z něj poznat, jestli je to jedna stopa, nebo obě** — a R1 velí dvě oddělené stopy, takže skutečnost může být dvojnásobek. Přidat jednu větu, že je to nezměřené, a měřitelnou cestu (5 minut současným řetězcem, změřit obě `.webm`, vynásobit). Souvisí to přímo s A1: při dvojnásobku je strop 5 GB dvakrát blíž.

### A14. Pojistka v J1 #4 umí zakrýt přesně tu vadu, proti které je

„Panel se při prvním spuštění otevře sám“ způsobí, že člověk aplikaci najde **i s prázdnou ikonou** — a testér projde J1 bez zádrhelu, zatímco `isEmpty=true` trvá. Doplnit větu: pojistka nenahrazuje akceptaci `DSK-F001` (`isEmpty() === false`, rozměr nad nulu), obojí platí zvlášť. A svázat „jednorázově“ s podmínkou, kterou lze změřit (Dock ikona zmizí po prvním zavření panelu, stav se zapíše do nastavení), ne se slovem.

### A15. R9 umí vyrobit nulový záznam

Ořez startu i stopu na celé minuty (10:00:40 → 10:01, 10:01:10 → 10:01) dává **0 minut**. Co se s ním stane, nikde není. V money-path buď tiše zmizí, nebo se zapíše nula. Rozhodnout (návrh: nezapisovat a říct to; nebo minimum 1 minuta) — patří to Danovi.

### A16. Nic z §4 a §5 dnes nemá měřidlo

Sekce přidává zhruba čtyřicet požadavků. Žádný z nich není v `spec.md §8` a žádná ze stories `B1–B12` nepokrývá výšku a rolování panelu, souhrn fronty v patičce, jméno účtu na sdíleném zařízení, jedno číslo u ikony, obsah oznámení ani redakci logu. `plan.md` DoD přitom vyžaduje cílený test **na story**. Nesplnění tedy nikdo nezachytí.

**Oprava:** ke každému červenému pravidlu v §5 dopsat, čím se pozná porušení (test, sabotáž, nebo „ověří člověk očima, protože jinak to nejde“ — i to je poctivá odpověď). Alespoň čtyři nové akceptační scénáře: výška panelu na 1280×800, redakce exportu diagnostiky, souběh obou agend v liště, dvouhodinová nahrávka.

---

## B. Co chybí úplně

| # | Chybí | Proč to je díra |
|---|---|---|
| B1 | **Pád appky a ⌘Q během nahrávání** (M24) | J3 řeší stopu, síť a přihlášení, ale ne ztrátu poloviny záznamu. Chybí obě obrazovky z výzkumu: „nahrávání běží 41 minut, opravdu ukončit?“ a po restartu „našel jsem nedokončenou nahrávku“. `spec.md §8` má přežití pádu jen pro **časovač** |
| B2 | **Plný disk uprostřed nahrávání** (M23) | J1 #12 řeší jen kontrolu před startem. Zápis selže v 38. minutě a člověk se to dnes nedozví — a při dvouhodinovém požadavku je to ten pravděpodobnější případ |
| B3 | **Spánek s běžícím časovačem** | J2 #10 popisuje jen uzavření obou **stop**. Zavřené víko přes noc = 8 hodin na projektu. Money-path díra; návrh: čas nad prahem se do rozhodnutí člověka nezapočítá (fail-closed) |
| B4 | **Co se stane na hranici dvou hodin a za ní** | Danův požadavek je „spolehlivě do 2 h“. Není řečeno, jestli je to záruka, nebo strop; co appka udělá v 2:01; a neexistuje k tomu jediný akceptační scénář |
| B5 | **Které oznámení vůbec existují** | §5.1 zakazuje v oznámení jména, ale nikde není seznam. Výzkum ho má hotový: neoznamovat start/stop/přihlášení; oznamovat dokončený nebo selhaný upload, nahrávání ukončené uspáním, odebrané oprávnění za běhu, časovač běžící po pracovní době. Nikdy Time Sensitive |
| B6 | **Odhlášení jako cesta** (M27, story B9) | §5.4 má tlačítko, §4 tu cestu nikdy neprojde: pořadí R13 (nejdřív server), odhlášení **bez sítě** (tvrzení „přístup odvolán“ je pak lež o 30 dnů) a fronta, která zůstává (R12) |
| B7 | **Dostupnost bez myši v v1** | Zkratky nejsou implementované, ikona je jediný vstup. `spec.md §7` slibuje „vše ovladatelné klávesnicí“ — v v1 se do panelu klávesnicí nedostaneš vůbec. Napsat to jako známé omezení, ne to nechat vypadat splněné |
| B8 | **Účet bez přístupu v panelu** | `spec.md §6` má stav „Účet nemá přístup — jméno účtu + přihlásit jiným“; v J3-C je jen jako slepá ulička v prohlížeči |
| B9 | **Kam se v panelu klikne na hotovou nahrávku** (M16) | §5.6 posílá archiv na web, ale odkaz z panelu jde dnes na kořen `app.ludone.cz`. Jediný most mezi spouštěčem a platformou je slepý a v cestě to není |

---

## C. Co je v pořádku a nesahat na to

- Vazba na ID momentů (`M07`) a věta „implementátor si to nedovyplňuje sám“ — to je jediný důvod, proč se dá sekce vůbec auditovat.
- Rozdělení „vidí / udělá / pravidlo“ místo prózy; červené řádky odlišené od modrých návrhů.
- §5.6 „Co v panelu NENÍ a proč“ je nejsilnější část celého dokumentu — hranice s vlastníkem u každého řádku. Přesně tenhle tvar chybí v §4 (viz A2).
- Přiznaný rozpor v návrhu Nastavení (čtyři karty × pět) — ověřeno v `nahled.html:601`: artboard Připomínek skutečně **vypouští Záznamy**, zatímco titulek sekce říká „Čtyři části“. Sjednocení na pět sedí s `DSK-F015`.
- „Stav nese tvar, ne barva“, autorita stavu v hlavním procesu, `prevent-app-suspension`, kartu v prohlížeči nezavírat, částečné povolení oprávnění — všechno doložené a správně.
- Rozdíl mezi Gatekeeperem u staženého a AirDropnutého buildu (J1 #2) je věcně správný a přesně ten typ detailu, který jinak stojí půlden podpory.

## D. Tři věci, které bych chtěl od Dana, než se sekce vloží

1. **A1** — co s nahrávkami, které se nemají kam odeslat, než složka narazí na 5 GB. Bez rozhodnutí má v1 datum expirace.
2. **A3** — nabízí se projekt, u kterého se čerpání nedá zjistit (v1 nemá zdroj)? Ano = riziko přečerpání, ne = v1 nenabídne nic.
3. **A6** — čím se pozná zasedačka. Přepínač v Nastavení je dnes nejslabší článek celé J4 a `decisions.md B1` to nechává otevřené.