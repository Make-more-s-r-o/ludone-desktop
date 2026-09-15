# Ruční ověření dashboardu nahrávek na Macu

Aktuální výchozí instalace je 0.1.2; vydaná oprava má verzi 0.1.3. Tento postup sám o sobě nedokládá živou funkčnost. Názvy akcí odpovídají implementovanému UI.

Použij jen vlastní postradatelná testovací data. Nahraj přibližně 30 sekund syntetické řeči a systémového zvuku, nikdy schůzku ani cizí obsah. Do veřejného Gitu neukládej audio, tokeny, e-mail, plná serverová UUID, lokální cesty ani hodnoty release secrets. V protokolu použij jedinečný neškodný název a krátké ID z UI (prvních osm znaků); stejný prefix používá potvrzovací dialog.

## Protokol běhu

| Údaj | Hodnota |
|---|---|
| Datum a čas | — |
| Tester | Dan |
| Model Macu / architektura | — |
| Verze macOS | — |
| Verze aplikace | — |
| Bezpečná ID testovacích nahrávek | — |
| Výsledek | ☐ ⛔ neověřeno |

Stav změň na `✅ ověřeno naostro` jen po pozorování popsaného výsledku. Testy bez skutečného přihlášení, audia nebo vydané aplikace mají nejvýš `🧪 zelené testy`.

## Základní průchod do 10 minut

Před začátkem vypni automatické odesílání a poznamenej si jednu starší lokální položku. Aplikaci úplně ukonči a spusť ji z Finderu v `/Applications`, ne z terminálu, aby nepřebírala shellové proměnné.

| # | Krok | PASS poznáš podle | Stav |
|---|---|---|---|
| 1 | Na standalone obrazovce po odhlášení nebo expiraci nejdřív otevři a zavři Nastavení. Potom se přihlas přes produkční `app.ludone.cz`. | Nastavení je dostupné i bez přihlášení a jeho otevření samo neposílá upload; přihlášení skončí zpět v aplikaci. | ☐ ⛔ |
| 1a | V části Účet načti firmy, při více firmách výslovně vyber svou testovací firmu a ulož ji. | Seznam pochází ze skutečné nabídky; bez uložené volby nezačíná první firmou. Výběr neodešle žádnou starší nahrávku. | ☐ ⛔ |
| 2 | Po přihlášení chvíli sleduj dříve uloženou položku při vypnuté automatice. Nic u ní nepotvrzuj. | Stará `held` položka se sama nezačne odesílat a nevznikne nové serverové ID. | ☐ ⛔ |
| 3 | Nahraj vlastní 30s syntetickou ukázku mikrofonu a systémového zvuku, zadej neškodný název a zvol „Nechat na Macu“. Restartuj aplikaci z Finderu. | Obě lokální stopy jsou po restartu v přehledu, název zůstal a položka není odeslaná. | ☐ ⛔ |
| 4 | Pořiď druhou syntetickou ukázku a zvol „Uložit a odeslat“. Po potvrzení uložení otevři Nastavení → Nahrávky. | UI potvrdí uložení a zařazení bez čekání na dokončení uploadu; zapiš skutečný aktuální stav karty. Rychlá síť může přechodný stav přeskočit. Zařazení ani stav fronty se nevydávají za serverovou shodu. | ☐ ⛔ |
| 5 | U druhé položky ručně zvol „Ověřit v LuDone“ a potom otevři existující webový detail. | Obě známá per-track ID mají samostatnou shodu; web otevře detail stejné vlastní položky. Chybějící stopa nebo 404 se nesmí vydávat za úplnou shodu. | ☐ ⛔ |
| 6 | Nech automatiku vypnutou, spusť třetí krátkou nahrávku a během ní automatiku zapni. Nahrávku dokonči. Potom spusť ještě jednu novou testovací nahrávku. | Rozpracovaná nahrávka zdědí snapshot `vypnuto` a stále nabídne obě volby. Až následující nová nahrávka použije automatiku; staré položky zůstávají beze změny. | ☐ ⛔ |
| 7 | Na vlastní postradatelné testovací položce zvol otevření složky. Jinou takovou položku smaž, v prvním dialogu nejdřív ověř výchozí „Zrušit“ a až potom smazání potvrď. | Reveal ukáže správný lokální soubor. Zrušení nic nezmění; potvrzené soubory skončí v systémovém koši a položka zmizí až po úspěšném dokončení. | ☐ ⛔ |

Převzetí staré položky jiného vlastníka proveď pouze tehdy, když Dan výslovně vybere konkrétní postradatelnou položku. Ověř, že dialog cílí její krátké ID, a potvrď jen tuto jednu položku. PASS znamená nový vlastník, stav `held`, vyčištěná stará serverová ID a žádný automatický upload. Bez této explicitní volby krok ponech `⛔` a položky se nedotýkej.

HTTP 401, 429, vyčerpání limitu a chybové odpovědi se ověřují mocky. Nezkoušej je ručním opakováním requestů proti produkci a nezatěžuj sdílený limit 120 GET/h/user.

## Aktualizace současné instalace 0.1.2 na 0.1.3

Read-only kontrola z 15. 9. potvrzuje nainstalovanou 0.1.2. Starší 0.1.1 už pro tuto
přejímku neinstaluj. Záloha podpisového klíče je potvrzená a GitHub publikační přístup
je nastavený; znovu jej není potřeba hledat.

Původní vlastník tagu byl Dan. Pro `v0.1.3` platí jednorázová výjimka: Dan 15. 9.
výslovně odpověděl „Ano, vydej 0.1.3 sám“, takže koordinátor smí tag vytvořit a pushnout
a spustit podepsané vydání na `stahnout.ludone.cz`. Toto pověření samo nedokládá úspěšné
vydání. Až dokončený workflow a veřejná kontrola dovolí označit publikaci za úspěšnou;
živou instalaci a funkčnost dál potvrzuje člověk podle tohoto protokolu.

1. Před vydáním dokonči a ulož rozpracovanou nahrávku a zastav měření času.
2. Po publikaci 0.1.3 zkontroluje koordinátor úspěšný release workflow, podepsání,
   notarizaci, verzované soubory i veřejný feed. Existence feedu není důkaz instalace.
3. Spusť současnou aplikaci 0.1.2 z Finderu. Její updater kontroluje dostupnou verzi
   a stáhne ji. Tato starší verze ještě instaluje automaticky po uvolnění bariér;
   tlačítka Aktualizovat/Později se v ní zpětně neobjeví.
4. Po restartu ověř v aplikaci číslo 0.1.3, zachované přihlášení a oprávnění. Proveď
   krátkou syntetickou nahrávku obou stop a níže uvedenou zkoušku opraveného retry.

Bariéru aktualizace během nahrávání označ jako ověřenou pouze tehdy, pokud nahrávání
skutečně běželo přes dokončení stahování a aplikace počkala až na uložení. Pokud se
aktualizace stihla nainstalovat dříve, zůstává tato část ⛔ neověřená. Následující
zkouška nového souhlasu začíná až z nainstalované 0.1.3 proti další schválené verzi.

## Přejímka opravy a upozornění od verze 0.1.3

1. V Účet načíst firmy, vybrat a uložit správnou firmu. V Nahrávky obnovit přehled.
   U vlastní dříve schválené položky pozastavené kvůli firmě musí být „Zkusit znovu“.
2. Zvolit tuto akci u jedné vlastní testovací položky. Po dokončení ručně ověřit
   stav na serveru přes „Ověřit v LuDone“. `held` položku tímto testem neodesílat.
3. V nové verzi ručně zkontrolovat aktualizace: musí být vidět skutečný výsledek
   kontroly. Odpojená síť nesmí skončit hláškou, že je aplikace aktuální.
4. Až bude schválené další vydání, ověřit proužek s jeho skutečným přínosem a jedno
   oznámení macOS. Opakovaná kontrola stejné verze ani restart nesmějí oznámení opakovat.
5. Po stažení se aplikace sama nerestartuje. „Později“ ponechá připomínku; klik
   „Aktualizovat“ dovolí instalaci až po dokončení nahrávání, uložení a dalších bariér.
   Odložení během čekání musí připravený restart zrušit.

Příchod 0.1.3 do 0.1.2 stále řídí starý automatický updater. Nové čekání na kliknutí
lze naostro prokázat až aktualizací z 0.1.3 na další schválenou verzi. Další vydání
se nevytváří jen kvůli tomuto testu. Jednotkové testy se nezapisují jako živá přejímka.

## Přejímka stereo MP3 — NRD-09 (po vydání navazující verze)

Tento postup zatím není důkaz funkčnosti ani oznámení vydání. Produkčně je doložená 0.1.3; nový kód musí nejdřív projít integrací a vydáním.

1. V Nastavení ověř verzi obsahující NRD-09 a správnou firmu. Nahraj krátkou schůzku: řekni „tohle je mikrofon“, nech protistranu říct „tohle je systémový zvuk“. Použij sluchátka, aby kontrolu nerušil přeslech z reproduktorů.
2. Zvol „Uložit a odeslat“. Po dokončení má na webu vzniknout **jeden** záznam s názvem celé schůzky. Spusť přepis právě u něj; musí obsahovat obě strany ve správném pořadí.
3. Zkontroluj výsledný MP3 ve sluchátkách: mikrofon vlevo, protistrana vpravo. Lokální originály mají zůstat dostupné podle nastavené retence.
4. Druhou krátkou nahrávku nech na Macu, aplikaci zavři a znovu otevři. Z přehledu ji výslovně odešli; opět vznikne jen jeden záznam.
5. Při jedné vlastní testovací nahrávce přeruš síť během odesílání, potom ji obnov a použij případné „Zkusit znovu“. Na webu nesmí vzniknout druhý záznam téže schůzky.

Staré už odeslané dvě stopy se automaticky nemění. Starý rozpracovaný upload může vyžadovat samostatné vypořádání; jeho ID se při přechodu nesmějí zahodit a založit vedle nich další záznam.
