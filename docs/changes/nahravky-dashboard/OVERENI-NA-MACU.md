# Ruční ověření dashboardu nahrávek na Macu

Tento postup je příprava pro Dana po dokončení a integraci T-05 a T-A4. Sám o sobě nedokládá živou funkčnost. Před použitím root porovná názvy tlačítek a pořadí kroků se skutečným finálním UI.

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

## Instalace a aktualizace dvou verzí

Tato část začíná až po přijetí T-05 a finální kontrole release diffu. Verze `0.1.1` je starší výchozí instalace stažená prohlížečem; nikdy ji nezapisuj jako „staženou aktualizaci“. Aktualizací je až novější verze publikovaná aktuálním T6 workflow.

Před tagem musí být podpisový `.p12` včetně hesla ověřený ve firemním správci hesel a GitHub musí mít úplné `DOWNLOAD_SSH_*` variables/secrets. Dan jako jediný vytvoří a pushne finální tag. Workflow musí nejdřív podepsat a notarizovat aplikaci, ověřit artefakty a až potom publikovat verzované soubory a `latest-mac.yml` jako poslední.

| # | Krok | PASS poznáš podle | Stav |
|---|---|---|---|
| 1 | Před publikací nové verze stáhni přes prohlížeč správný DMG `0.1.1`, nainstaluj jej přetažením do `/Applications` a spusť z Finderu. | Gatekeeper aplikaci přijme bez obcházení ochrany a aplikace skutečně ukazuje `0.1.1`. Jde o baseline instalaci, ne update. | ☐ ⛔ |
| 2 | Po záloze klíče a nastavení SSH hodnot nech Dana pushnout tag vyšší verze. V Actions otevři právě tento běh T6. | Zelené jsou podpis/notarizace, validace, review artifact, SCP publikace i veřejná HTTPS kontrola feedu a všech balíčků/blockmap. | ☐ ⛔ |
| 3 | Po publikaci spusť starší aplikaci znovu, aby zkontrolovala feed, a vyčkej na stažení vyšší verze. | Původní `0.1.1` hlásí až staženou aktualizaci; nové hlášení dostupnosti a průběhu ještě neobsahuje. Existence feedu se nezapisuje jako stažená nebo nainstalovaná aktualizace. | ☐ ⛔ |
| 4 | Pro zkoušku bariéry spusť postradatelnou nahrávku obou stop už během stahování a ponech ji aktivní přes dokončení aktualizace; potom dokonči uložení. U staré 0.1.1 průběh stahování není vidět, proto je tento pokus časově podmíněný. | Aplikace se během nahrávání ani ukládání nerestartuje. Restart se uvolní až po dokončení bariéry. Pokud stažení skončí ve stavu idle dřív, než nahrávání zahájíš, appka může ihned restartovat; bod zůstává `⛔` a zopakuje se s další schválenou dvojicí verzí. | ☐ ⛔ |
| 5 | Nech odložený restart dokončit a aplikaci znovu otevři z Finderu. | Aplikace ukazuje novou verzi, zachovala přihlášení a macOS znovu nežádá už udělená oprávnění. Krátká syntetická nahrávka obou stop po update funguje. | ☐ ⛔ |

Přechod `0.1.1 → 0.1.2` ověřuje doručení nového balíčku přes původní updater. Nové hlášení dostupnosti, průběhu stahování a jeho nové propojení s UI lze naostro ověřit až z nainstalované `0.1.2` proti další Danem schválené vyšší verzi; tu kvůli testu tento běh sám nezveřejňuje. Tento druhý průchod zatím zůstává `⛔`.

Příslušný přechod označ `✅` pouze tehdy, když prošla baseline instalace, podpis a notarizace nové verze, veřejná publikace, viditelný update, bariéra během nahrávání/ukládání a nové číslo po restartu. Pokud některý pozorovaný stav chybí, ponech jej `⛔`; nedoplňuj výsledek z unit testu nebo z existence souboru na feedu.

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
