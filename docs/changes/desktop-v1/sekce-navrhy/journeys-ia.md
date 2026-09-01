# Návrh sekce: journeys-ia

**NEZMRAZENO.** Vzniklo 1. 9. 2026 ve workflow `doplneni-masterplanu`. Skeptická revize
leží v `revize-*.md` vedle a **našla v těchhle sekcích nepravdivá tvrzení** — do `spec.md`
ani `plan.md` se to proto nevkládá celé. Co z toho už platí, je v `spec.md` §11.

---

## 4. User journeys

Vychází z 31 momentů v [`docs/ux/cesta-uzivatele-2026-09-01.md`](../../ux/cesta-uzivatele-2026-09-01.md).
Momenty jsou seskupené do čtyř cest; ID u kroku (`M07`) ukazuje na důkaz. Kde je krok návrh nebo
otevřená věc, je to napsané u něj — **implementátor si to nedovyplňuje sám**.

### J1 — Od stažení k první nahrávce (M01–M16)

| # | Co vidí | Co udělá | Pravidlo / stav |
|---|---|---|---|
| 1 | Nemá kde appku vzít. Build vyrábí jen `release/LuDone Desktop.app`, stahovací stránka neexistuje | Dostane appku od Dana (AirDrop, `scp`) | 🔴 **Distribuce je otevřená.** Dan zvažuje veřejný GitHub jako místo ke stažení; není rozhodnuto, jestli to jde (`decisions.md` dnes drží „nezveřejňovat repo“) ani jak by fungovaly aktualizace bez Developer ID. M01, M28 |
| 2 | Gatekeeper: „Apple nemůže ověřit, že aplikace neobsahuje škodlivý software“ s Hotovo / Přesunout do koše. Tlačítko Otevřít tam **není** | Nastavení systému → Soukromí a zabezpečení → Otevřít stejně → Touch ID | Pravý klik → Otevřít od macOS 15 neexistuje. Kdo appku dostane AirDropem, nedostane karanténní příznak a dialog nikdy neuvidí — dva lidé, dva různé zážitky. M02 |
| 3 | Nic | Přetáhne appku **ve Finderu** do Aplikací | Bez toho běží z read-only cesty (App Translocation): aktualizace nemůže fungovat a do TCC přibude druhá cesta. M03 |
| 4 | Panel se při úplně prvním spuštění otevře **sám** a appka se jednorázově ukáže i v Docku | — | Pojistka proti nejrizikovějšímu momentu cesty: ikona v liště je dnes měřeně prázdná (`isEmpty=true`, 0×0) a selhání je neviditelné. M04 |
| 5 | Uvítání jednou větou, tlačítko „Přihlásit přes app.ludone.cz“ a vedle něj **vždy viditelnou adresu + Kopírovat** | Klikne | Pojistka pro okno otevřené do pozadí nebo na druhou plochu. M06 |
| 6 | „Čekám na prohlížeč · zbývá 9:42“ s odpočtem a tlačítkem **Zrušit** | Čeká, nebo zruší | Panel se přitom **nesmí schovat** při ztrátě fokusu. Listener musí žít déle než serverová žádost — server drží 10 minut, desktop dnes zavírá po 5 (`auth.cjs:9`). M06, M10 |
| 7 | V prohlížeči souhlas: co appka bude smět, **„Přihlášen jako <e-mail>“**, zařízení, prostředí, odkaz „Nejsi to ty?“ | Povolí | Bez řádku s e-mailem lidé povolí přístup identitě, pod kterou jsou zrovna v prohlížeči. Text nesmí mluvit jazykem MCP. M07 |
| 8 | Appka se přepne dopředu sama, panel ukáže jméno, e-mail a zařízení | Pokračuje | Kartu v prohlížeči appka nezavírá — `window.close()` prohlížeč zablokuje. M09 |
| 9 | Dvě oprávnění zvlášť: Mikrofon (appka umí vyžádat sama) · Ostatní zvuk (jde jen odkaz do Nastavení systému) | Povolí jedno nebo obě | **Částečné povolení musí fungovat**: samotný mikrofon stačí na časovač i na jednostopou nahrávku. macOS se ptá na „nahrávání obrazovky“, i když se bere jen zvuk. M11, M12 |
| 10 | Zkoušku se dvěma měřáky. „Připraveno“ se ukáže, až když oba kanály dávají signál | Řekne něco a pustí zvuk | Bez zkoušky se nedá tvrdit, že to funguje. M14 |
| 11 | Klid: dvě sbalené agendy, shrnutí dneška, patička | Klikne Nahrát | |
| 12 | Kontrolu obou stop, pak běžící čas a zdroje | Nechá běžet | Nahrávání musí spolehlivě dojet **do 2 hodin délky** (Dan, 1. 9.). Před startem kontrola volného místa: pod 2 GB volna nebo nad 5 GB ve složce se nahrávání nespustí a řekne proč (`specs/E6:67` — popsáno, nezapojeno). Nad 60 minut se počítadlo přepne na `h:mm:ss` s pevnou šířkou (**návrh**). M23 |
| 13 | „Ukončit a uložit“ | Ukončí | R4/C1 — časovač se nezastaví, jen se nabídne |
| 14 | Pojmenování: předvyplněné datum, čas od–do, délka a projekt z běžícího časovače, kurzor v poli | Enter, nebo přepíše | Jediný okamžik, kdy se appka ptá. Text jde do manifestu, ne do názvu souboru. M15, M19 |
| 15 | „Uloženo na disk. Odesílání je v této verzi vypnuté.“ | Nic | 🔴 v1 **nemá kam odesílat** (S1, `DESKTOP_UPLOAD_ENABLED` fail-closed). Panel to musí říct rovnou — nesmí předstírat odeslání ani ukazovat frontu, která nikam nejde |

### J2 — Běžný den, obě agendy naráz (M17–M21, M25)

| # | Co vidí | Co udělá | Pravidlo / stav |
|---|---|---|---|
| 1 | Ikonu v liště, vedle ní nejvýš jedno číslo | Klikne levým tlačítkem | Zkratky ⌃⌥L / ⌃⌥R / ⌃⌥T jsou v návrhu, **nejsou implementované** a na české klávesnici neověřené (electron#19747). M17 |
| 2 | Klid: „Nahrávání · Dnes 2 nahrávky · 1h 12m“ a „LuTrack · Dnes vykázáno 3h 05m“ | Spustí LuTrack | |
| 3 | Výběr projektu: hledání, Naposledy, Všechny; u každého zbývající hodiny z alokace | Vybere projekt | R6 — jen projekty s platnou alokací k dnešku, identita je **GUID**. R7 — nad 110 % zašedlý s důvodem. Prázdný stav: „Nemáš dnes žádný projekt s alokací“ + odkaz do LuDone. R8 — sazba se neposílá ani nezobrazuje |
| 4 | Kartu času rozbalenou (`5h 16m`, projekt, Zbývá z alokace), nahrávání jako **jeden řádek** | Pracuje | M17 — klidová agenda je jeden řádek, rozbaluje se jen běžící |
| 5 | Přijde schůzka | Klikne Nahrát | Časovač běží dál. Agendy nesdílejí start ani stop (závazná korekce 24. 8.) |
| 6 | Z lišty musí poznat, že běží **obojí**, i se zavřeným panelem | Zavře panel | 🔴 Pátý stav dnes chybí a lišta LuTrack zamlčí. Stav nese **tvar**, ne barva (šablonová ikona). M19 |
| 7 | Po „Ukončit a uložit“ pojmenování a pak nabídku „Zastavit i měření času?“, která zmizí sama | Potvrdí, nebo ignoruje | C1 |
| 8 | Odpoledne „Přepnout projekt“ | Vybere jiný | R11 — časovač se nezastaví. R10 — klíč proti duplikaci vznikl už při startu |
| 9 | Stop časovače | Zastaví | R9 — ořez na celé minuty, zobrazuje se `5h 16m` |
| 10 | Zavře notebook uprostřed nahrávání; po probuzení panel řekne, co se uložilo a co se stalo s nedokončenou stopou | Rozhodne, jestli pokračovat | Po dobu nahrávání drží `prevent-app-suspension`; na `suspend` se obě stopy uzavřou, na `resume` se appka **nerozjíždí sama**. M20 |
| 11 | Dotaz „byl jsi 43 minut pryč?“ **nepřijde**, dokud běží nahrávání | — | M21 — appka má v ruce důkaz opaku. Čas se nikdy tiše nesmaže ani tiše nezapočítá |
| 12 | Vypršení přihlášení nepozná nijak | — | R14, R15. M25 |

### J3 — Když se něco pokazí

**A · Vypadne jedna stopa** (R3, M14)
1. Vidí „Nahrává se omezeně“ a u stop `Mikrofon ok` / `Ostatní zvuk ticho` — vždy textem, nikdy jen barvou.
2. Čte, co to znamená: „Druhá strana hovoru se nenahrává. Tvůj hlas ano.“
3. Volí Pokračovat, nebo Ukončit. Nahrávání běží dál i bez volby. 🔴 Dnešní kód zastaví obě stopy — to je vada, ne chování.
4. Do manifestu jde, **která** stopa a od kdy chybí. **Otevřené:** jak se chybějící stopa ohlásí v `POST /api/desktop/recordings` — kontrakt počítá vždy se dvěma stopami. Návrh: `bytes: 0` a hash prázdné stopy.

**B · Ztráta sítě a fronta** (M22, R12, R16, R17)
1. Nahrávání běží dál — zvuk jde na disk, síť je potřeba až pro odeslání (R2, R14).
2. Po zastavení patička: „3 čekají · 412 MB · další pokus za 2 min“ + „Zkusit teď“.
3. Opakování: základ 30 s, zdvojnásobení, strop 6 h, 5 pokusů, rozptyl 20 % (`KONTRAKT.md` §5).
4. Kdo panel neotevře, musí stav poznat z lišty — odznak „pozor“ tvarem, ne barvou.
5. `403` a „uzavřený týden“ se **neopakují**: důvod se ukáže, data zůstanou (R16).
6. Patička nese jen souhrn; seznam se rozbalí nejvýš na tři položky + „a dalších X“ (**návrh**). Chování nad 20 položkami je vědomě odložené.
7. Retence 7 dní běží až od potvrzeného odeslání (R19) — neodeslaná fronta drží disk sama.

**C · Vypršelé přihlášení** (M08, M10, M25, M26, M30)
1. Během nahrávání **nic** — žádné modální okno, žádný skok do prohlížeče, žádná výzva (R14).
2. Obnovu tokenu dělá jediné vlákno (R15). Dva souběžné pokusy odhlásí uživatele „sám od sebe“.
3. `invalid_grant` frontu **pauzuje** a nespotřebovává pokusy (R17).
4. Jednou za 30 dní přijde povinné nové přihlášení včetně nového souhlasu. Panel to podá jako běžnou věc a přidá „tvých N nahrávek je v bezpečí na disku“.
5. Když přihlášení nedojde do konce (vypršelo, nepovolený účet, nesedí iniciátor), panel po timeoutu nabídne „Zkusit znovu“ a krátké „Co se mohlo stát“. 🔴 Dnes se do appky vrací jen odmítnutí souhlasu; zbytek končí stránkou v prohlížeči a panel mlčí (M08).
6. Po přenosu na nový Mac se odhlásí oba stroje naráz. Panel řekne proč („Přihlášení bylo použito na dvou počítačích naráz“), ne generické „vypršelo“ (M30).

### J4 — Sdílené zařízení `zasedacka@makemore.cz` (B1, součást v1)

1. Mac v zasedačce je přihlášený **trvale** sdíleným účtem. Hlavička panelu nese jméno **účtu, ne osoby** — kdokoli u něj musí na první pohled poznat, že nahrává „pod zasedačkou“.
2. Přijde kdokoli, otevře panel, klikne Nahrát. **Nepřihlašuje se** — jinak sdílené zařízení ztrácí smysl.
3. Po „Ukončit a uložit“ se panel navíc ptá, **čí to bylo**. To je jediné místo, kde se sdílené zařízení liší od osobního.
4. **Otevřené:** čím se ten člověk vybere. Seznam lidí umí dodat jen server a serverová strana není v rozsahu (S1). Do té doby zůstává pole **textové** a skutečné přiřazení dořeší web (**návrh, ne rozhodnutí**).
5. Nahrávka je majetkem firmy (B2), admin ji vidí vždy. Jestli ji uvidí i vybraný člověk, závisí na tom, jak server přiřazení uloží — **v desktopu se to rozhodnout nedá**.
6. **Časová agenda se na sdíleném účtu nenabízí** (**návrh, fail-closed**). `decisions.md` B1 nechává otevřené, komu by se hodiny připsaly; hodiny jsou money-path a hodiny připsané zasedačce jsou tichá chyba v mzdových nákladech. Dokud Dan nerozhodne, `DESKTOP_TIME_ENABLED` na tomhle účtu neplatí.
7. Odhlášení sdíleného účtu uprostřed odesílání frontu **nesmaže** (R12). **Otevřené:** položky ve frontě patří lidem, ne účtu — kdo je smí odeslat po přihlášení jiného účtu.
8. Retence 7 dní (R19) platí i tady, ale disk zasedačky drží nahrávky víc lidí naráz. Kontrola volného místa je tu důležitější než na osobním Macu.
9. **Jak se sdílené zařízení pozná:** příznak v Nastavení, ne heuristika podle e-mailu (**návrh**). Účet se může přejmenovat — a přejmenování už jednou peníze stálo (R6).

---

## 5. Information architecture

Panel je **366 bodů široký** (`electron/main.cjs:27`) a je to **spouštěč**. Každá položka v něm musí
obhájit, proč není na webu (A11, A12). Hranice je stejně závazná jako obsah — viz §5.6.

### 5.1 Čtyři povrchy a systém pod nimi

| Povrch | Rozměr | Co tam patří | Co tam nikdy nepatří |
|---|---|---|---|
| **Lišta** | ikona 16×16 + 32×32@2x, vedle nejvýš jedno číslo | Stav obou agend, kontextové menu s rychlými akcemi | Text delší než jedno číslo; barva jako jediný nositel stavu |
| **Panel** | 366 × ≤792 (`main.cjs:27-28`) | Dvě agendy, výběr projektu, pojmenování při zastavení, stavové pruhy, souhrn fronty | Cokoli, co se dá vyřídit později na webu |
| **Okno** | Nastavení 448×676 (`main.cjs:355-356`), O aplikaci | Účet, zvuk, záznamy, připomínky, diagnostika | Nic, co je potřeba **během** nahrávání |
| **Web `app.ludone.cz`** | — | Archiv, přehrávání, přepis, hledání, úprava názvu, přehledy hodin, admin, správa přístupů a klíčů přepisu (A3) | — |
| **Systém macOS** | — | Dialogy oprávnění, oznámení, Nastavení systému | Název schůzky, jméno klienta ani e-mail v textu oznámení — na sdílené obrazovce je vidět |

### 5.2 Panel: tři pásma, roluje jen prostředek

Dan 1. 9.: panel se při malé obrazovce **zkrátí podle plochy**, hlavička a patička zůstanou
přilepené, prostředek roluje. Změřeno: na 1280×800 dnešních pevných 792 bodů přeteče mimo plochu.

| Pásmo | Obsah | Chování |
|---|---|---|
| Hlavička | Logo, jméno účtu, stav připojení | Přilepená, nikdy neroluje. Na sdíleném zařízení nese jméno účtu (J4) |
| Prostředek | Běžící agenda rozbalená · klidová agenda jako jeden řádek (M17) · stavové pruhy (výpadek stopy, přečerpaný projekt, prázdná alokace) · pojmenování při zastavení | **Jediné rolující pásmo** |
| Patička | Souhrn fronty a poslední sync · Nastavení · verze drobným písmem | Přilepená, nikdy neroluje |

Pravidla výšky:

- Výška = `min(792, využitelná výška obrazovky pod lištou − rezerva)`. 792 je dnešní konstanta (`main.cjs:28`), rezerva je **návrh** (24 bodů) — přesnou výšku systémové lišty na macOS 26 jsem neměřil.
- Šířka 366 je pevná; panel se nezužuje.
- Rozpočet obsahu je 670 bodů z 792 (schválený návrh, sekce 06). Při zkrácení mizí rozpočet obsahu, ne pásma.
- Běžící agenda je vždy nahoře a při otevření panelu **musí být vidět bez rolování**. Když se nevejde obojí, roluje klidová agenda (**návrh**).
- Ovládání běžící agendy („Ukončit a uložit“, „Stop“) nesmí skončit pod rolováním; při nedostatku výšky se přesune do patičky (**návrh**).
- Nahrávka běží **do 2 hodin** (Dan): počítadlo se dopočítává ze startu drženého v hlavním procesu, aby ho zavřený panel ani pád rendereru neovlivnily. Odhad velikosti: návrh kreslí 38 minut = 42 MB, tedy ≈ 1,1 MB/min → 2 hodiny ≈ 130 MB (**dopočet z návrhu, neměřeno**).

### 5.3 Lišta

- Ikona je **šablonová** (černá + alfa), takže stav nese **tvar**, ne barva. Dnešních 18×18 (`main.cjs:252`) je mimo doporučené velikosti a obrázek je měřeně prázdný.
- Autoritou stavu je **hlavní proces**, ne renderer — jinak po pádu okna zůstane v liště falešné „nahrává se“.
- Vedle ikony nejvýš **jedno** číslo, pevná šířka, ať lišta neposkakuje. **Otevřené:** které číslo, když běží obojí — dnešní přednost nahrávání je důsledek kódu, ne rozhodnutí.
- Kontextové menu (pravý klik i Ctrl+klik), nejvýš tři skupiny: rychlé akce obou agend · Otevřít LuDone / Nastavení… ⌘, / O aplikaci · Odhlásit / Ukončit ⌘Q. Nedostupné položky se **skrývají**, nezašeďují.
- Ikona v Docku je **volba** v Nastavení, výchozí vypnutá (M18) — záchranná cesta, když lištu sežere notch nebo Bartender.

### 5.4 Okno Nastavení

Pět karet: **Účet · Zvuk · Záznamy · Připomínky · Diagnostika**.
⚠️ Schválený návrh kreslí čtyři a Připomínky (M20) do nich přibyly později — návrh je v tomhle sám
se sebou v rozporu, spec ho sjednocuje na pět.

| Karta | Obsah |
|---|---|
| Účet | Jméno, e-mail, zařízení, prostředí · „Odhlásit tento Mac“ (fronta zůstane) · „Odhlásit a smazat moje data“ před odinstalací · přepínače „Zobrazovat i ikonu v Docku“ (výchozí vypnuto) a „Spouštět po přihlášení do systému“ |
| Zvuk | Zdroje, zkouška obou stop, stav obou oprávnění čtený při **každém** otevření |
| Záznamy | Složka s nahrávkami a Zobrazit ve Finderu · kolik je na disku · retence 7 dní výchozí, nastavitelná včetně „nemazat“ (R19, B3) |
| Připomínky | Dny, od–do, jak často. Nikdy během nahrávání (M20) |
| Diagnostika | Verze a build, architektura, stav oprávnění, spojení, fronta, „Exportovat diagnostiku“ |

🔴 **Do logu ani do exportu diagnostiky nikdy: zvuk, token, e-mail, název schůzky.** Identifikátory
výhradně jako GUID (`clientRecordingId`, `projectId`). Platí i pro texty oznámení (Dan, 1. 9.).

Okno se otevírá s dočasným přepnutím do režimu `regular`, jinak nemají ⌘, a ⌘Q kde vzniknout.

### 5.5 Kde bydlí data

| Co | Kde | Poznámka |
|---|---|---|
| Nahrávky a manifesty | `~/Library/Application Support/LuDone Desktop/nahravky`, adresář 0700, soubory 0600 | 0600 **není** šifrování v klidu |
| Šifrovaná session | `~/Library/Application Support/cz.ludone.desktop/auth` | **Jiný adresář než nahrávky** — past při odinstalaci (M31) |
| Klíč k session | login Keychain | `safeStorage` dává do Keychainu jen klíč, ne token. Bez šifrování se token neukládá vůbec a panel to musí říct |
| Fronta | lokální JSON (`electron/queue.cjs`) | Odhlášení ji nemaže (R12) |
| Stav časovače | hlavní proces, atomická perzistence | Musí přežít pád rendereru (`DSK-F013`) |
| Nastavení | dnes `localStorage` rendereru | 🔴 Patří do hlavního procesu — mazat umí jen on a do `localStorage` nevidí |

### 5.6 Co v panelu NENÍ a proč

| Co | Kam patří | Proč ne do panelu |
|---|---|---|
| Archiv nahrávek a přehrávání | web | A11/A12 — desktop je spouštěč. 366 bodů neunese seznam, který každý týden roste |
| Přepis a hledání v přepisu | web | Přepis běží v cloudu (A4), klíče se spravují v `app.ludone.cz` (A3) |
| Týdenní souhrn hodin, grafy, přehledy | web | M10 — desktopový LuTrack je **jen časovač** |
| Management a admin LuTracku | web | M10 |
| Kalendář a „dnešní schůzky“ | nikam | M15/M16 — zdroj neexistuje a napojení leží v cizím projektu |
| Seznam účastníků schůzky | nikam | Ztrácí se bez náhrady, doloženo měřením (název okna vrací jen „Google Meet“) |
| Hodinová sazba, částky, čerpání v korunách | nikam do klienta | R8 — klient sazbu neposílá ani nezobrazuje. Panel smí ukázat jen **zbývající hodiny** z alokace |
| Nastavení a diagnostika | vlastní okno 448×676 | Panel se skrývá při ztrátě fokusu a dlouhý formulář by v 366 bodech ukradl rolování agendám |
| Plný seznam fronty | patička = souhrn | Nad 20 položkami je chování vědomě odložené |
| Aktualizace, odinstalování, odebrání z firmy | odloženo, resp. server | Odvolání přístupu člověku, který odešel, desktop vědět nemůže (M29) |
| MCP nástroje | aplikace | S2 — ptát se bude přes LuDone MCP nad `app.ludone.cz` |
| Stahovací stránka, changelog, návod ke Gatekeeperu | **nerozhodnuto** | Dan zvažuje veřejný GitHub, `decisions.md` dnes drží „nezveřejňovat repo“. Bez rozhodnutí nemá M01 ani M28 kde bydlet |

---

## Předpoklady, na kterých to stojí

- Umístění v dokumentu: obě sekce jsou psané jako §4 a §5 vkládané ZA stávající §3 Funkční matice. Stávající §4–§10 se tím přečíslují na §6–§12. Uvnitř textu odkazuji jen na ID pravidel (R1…R20), funkcí (DSK-F0xx) a rozhodnutí (M/A/B/C/S), ne na čísla sekcí, aby přečíslování nic nerozbilo.
- Výška panelu: vzorec min(792, plocha − rezerva) je můj návrh; 792 je doložená konstanta (main.cjs:28), rezerva 24 bodů je odhad — přesnou výšku systémové lišty na macOS 26 jsem neměřil.
- Velikost dvouhodinové nahrávky ≈ 130 MB je dopočet z čísla ve schváleném návrhu (38 minut = 42 MB), ne měření.
- Formát počítadla nad 60 minut (h:mm:ss s pevnou šířkou) je návrh — návrh kreslí jen 12:41 a 5h 16m, delší nahrávka v něm nakreslená není.
- Časová agenda se na sdíleném účtu zasedačky v1 nenabízí — návrh fail-closed, protože decisions.md B1 nechává otevřené, komu by se hodiny připsaly, a hodiny jsou money-path.
- Rozpoznání sdíleného zařízení příznakem v Nastavení (ne heuristikou podle e-mailu) je návrh.
- Chybějící stopa se v POST /api/desktop/recordings ohlásí jako bytes 0 — návrh, KONTRAKT.md počítá vždy se dvěma stopami a tenhle případ neřeší.
- Nastavení má pět karet — schválený návrh kreslí čtyři a Připomínky (M20) do nich přibyly později; sjednotil jsem to na pět a rozpor jsem v textu označil.
- Rozbalení fronty nejvýš na tři položky + „a dalších X“ je návrh; chování nad 20 položkami zůstává vědomě odložené podle §10.
- Přednost nahrávání u čísla vedle ikony jsem NEpovýšil na pravidlo — v textu je označená jako důsledek dnešního kódu a otevřená otázka.
- Panel v J1 kroku 15 říká „odesílání je v této verzi vypnuté“ — plyne to z S1 a fail-closed DESKTOP_UPLOAD_ENABLED, ale konkrétní znění copy v návrhu není.

## Otázky na Dana

- Zasedačka: smí na sdíleném účtu běžet LuTrack, a komu by se ty hodiny připsaly? Do rozhodnutí to mám ve specu jako fail-closed (časová agenda se na tom účtu nenabízí).
- Zasedačka: čím se po zastavení vybere člověk, kterému nahrávka patří? Seznam lidí umí dodat jen server, a ten není v rozsahu (S1). Zatím jsem napsal textové pole + dořešení na webu.
- Zasedačka: fronta při střídání lidí — když se sdílený účet odhlásí uprostřed odesílání, kdo smí položky odeslat po přihlášení jiného účtu?
- Distribuce: veřejný GitHub jako místo ke stažení znamená buď zveřejnit repo (dnes je v decisions.md rozhodnuto opačně), nebo samostatný veřejný repo jen na Releases. Co z toho? A jak mají fungovat aktualizace bez Developer ID?
- Když běží obě agendy, které jedno číslo má být vedle ikony v liště — nahrávání, nebo čas? Dnešní přednost nahrávání je jen důsledek kódu.
- Nastavení: sjednotit na pět karet (Účet, Zvuk, Záznamy, Připomínky, Diagnostika)? Schválený návrh kreslí čtyři a Připomínky do nich přibyly až rozhodnutím M20.
- Minimální výška panelu: má se pod určitou výškou něco skrýt úplně, nebo stačí, že prostředek roluje a hlavička s patičkou zůstávají?
