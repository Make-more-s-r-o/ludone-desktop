# Skeptická revize 4

**Adversariální čtení návrhu sekce.** Zadání znělo najít, čím se dá
tvrzení obejít nebo v čem lže — ne schválit.

---

## A. Co je v pořádku (ověřeno v kódu, ne přečteno ze zadání)

- **Korekce zadání je správná a je to nejcennější věc na celé sekci.** `/Users/dan/Dev/ClaudeCode/ludone-desktop/electron/queue.cjs:35-67` má vzorec celý včetně `open(directory,"r")` + `.sync()`; `src/lib/manifest.js:132-150` končí `rename` bez fsync adresáře; chunk je `write` ve smyčce + `handle.sync()` (`electron/main.cjs:560-573`). Tabulka tří zápisů sedí přesně.
- **Hranice startu sedí.** Manifest `incomplete` se zapisuje na `main.cjs:498`, `sessionId` se vrací až na `main.cjs:521`, a v kódu je i komentář, který to pojmenovává. `randomUUID()` na 477.
- **Pád rendereru** je opravdu pokrytý: `main.cjs:515-520` (sekce píše 518-524 — posun o tři řádky).
- **`before-quit` opravdu jen `isQuitting = true`** (`main.cjs:746-747`).
- **Negativní tvrzení jsou pravdivá:** `powerMonitor`, `powerSaveBlocker`, `ENOSPC`, `getSystemIdleTime` se v `electron/` ani `src/` nevyskytují ani jednou. `auth.cjs` má opravdu jen `begin()`, `refresh` jen jako `grant_types` na 214 a čtení `refresh_token` na 404-405 — to je poctivě doložený zdroj a mělo by se to takhle psát všude.
- **`App.jsx:20-25`** dává `useMemo` prioritu nahrávání, LuTrack zamlčí. Pátý stav skutečně chybí.
- **`queue.js`**: `processNext` je čistá funkce, odbaví nejvýš jednu položku (`:207`), `enqueueRecording` vrací `{added:false, item:existing}` (`:126-129`), `applyServerProgress` offsety přepisuje (`:157-171`).
- **Aritmetika 2 h sedí.** 128 000 bit/s = 16 000 B/s → 7 200 chunků, 115,2 MB/stopa, 230,4 MB/schůzka. `MAX_RECORDING_CHUNK_BYTES = 8 MB` (`main.cjs:29`) je 500× nad 1s chunkem, tudy riziko nevede.
- **Jména API sedí proti dokumentaci Electronu** (ověřeno v docs, ne z hlavy): `net.isOnline()` i `net.online`, `powerSaveBlocker.start('prevent-app-suspension')`, `powerMonitor` události `suspend`/`resume`/`shutdown`, `getSystemIdleTime()`/`getSystemIdleState()`, `app.requestSingleInstanceLock()`. `desktopCapturer.getSources({types:["screen"]})` na `main.cjs:417`, jméno do logu na 419 — a poznámka o rozšíření na `window` je věcně správná, u okna je `.name` titulek.

## B. Měření, které sekce žádá — provedeno, výsledek ruší její vlastní obavu

Sekce píše „doměřit je potřeba cenu těch 14 400 `fsync`". Změřeno teď, na tomhle stroji (darwin 25.4.0, APFS interní disk, Node v22.22.0, N=300 po warmupu, skript `/private/tmp/claude-501/-Users-dan-Dev-ClaudeCode-ludone-desktop/8587ed88-97d6-4ae0-b293-e21e38032adb/scratchpad/fsync-bench.mjs`):

| Operace | Naměřeno |
|---|---|
| zápis 16 kB + `handle.sync()` | **3,71 ms** |
| zápis 16 kB bez sync | **0,030 ms** |
| 14 400 `fsync` (2 stopy × 2 h) | **≈ 53 s rozprostřených do 7 200 s, tj. ≈ 0,7 % času** |

Poměr 3,71 : 0,03 potvrzuje, že Node na macOS jde přes plný flush cache disku (`F_FULLFSYNC`), ne přes laciný `fsync(2)` — takže to není podhodnocené číslo. **Cena fsync není problém a sekce ho může přestat vést jako otevřené riziko.** Platí pro interní APFS; na externím nebo síťovém disku ne.

Vedle toho ověřeno, že `fs.promises.open(dir,"r")` + `.sync()` na macOS **funguje** — `queue.cjs:53-58` není mrtvý kód.

Skutečná neměřená rizika u dvou hodin zůstávají dvě, obě jinde: volné místo (M23) a **dekódovatelnost utrženého WebM**.

## C. Kudy se to dá obejít nebo kde to lže

**C1. §5.3 bod 1 je proti dnešnímu `processNext` nesplnitelný.** Požadavek zní „`attempts+1` a `SENDING` musí být na disku PŘED voláním `send()`". `processNext` (`src/lib/queue.js:216-222`) si `sendingQueue` postaví interně a volajícímu ji **nikdy nevydá** — vrátí se až po `await send(...)`. Volající tedy fyzicky nemá co uložit. Formální splnění: někdo si `attempts+1` spočítá sám před voláním, uloží, a logika se zdvojí. Oprava: `processNext` musí dostat `persist` callback volaný nad `sendingQueue` před `await send()`, nebo se rozdělit na `beginSend`/`finishSend`. Vymáhání: falešný `send`, který si přečte soubor fronty a tvrdí `SENDING`; bez toho porušení nikdo nepozná.

**C2. §5.3 výčet výsledků je neúplný.** `processNext` vrací i `disabled` (`:203`) a `idle` (`:213`). Pravidlo 2 na ně neplatí a implementátor bude ukládat stav zbytečně.

**C3. §5.3 pravidlo `SENDING → WAITING` bez započtení pokusu vyrábí nekonečnou smyčku.** Když padá samo odesílání (OOM nad 115MB souborem), každý restart pokus odškrtne a `maxAttempts` se nikdy nedosáhne — přesně to nekonečné opakování, kterému mělo pravidlo zabránit, jen posunuté o vrstvu. Potřebuje druhý čítač (`crashedAttempts`) nebo strop.

**C4. §5.3 zdůvodnění je věcně špatně.** „Pád uprostřed odesílání **vynuluje** počítadlo" — nevynuluje, jen ho nezvýší. Je to tvrzení o mechanismu, tak ať sedí.

**C5. §5.4 jmenuje soubor, který to neumí a plán mu to nedává.** `electron/queue.cjs` exportuje jen `{ loadQueue, saveQueueAtomically }` — žádná pumpa, žádný řetěz. `plan.md` §2 přiděluje B7 bloky **v `main.cjs`** („zapojení fronty, `queue:*` kanály"). Sekce tedy zadává vlastnictví do souboru, který plán pro tuhle práci nevlastní. Buď se rozšíří výčet bloků pro B7, nebo se §5.4 přepíše na `main.cjs`.

**C6. §5.4 se v single-instance mýlí dvakrát.**
- Zámek se váže na **`userData`**, ne na bundle. Dvě kopie téže aplikace (což je přesně scénář „stáhni z GitHubu do Downloads") sdílejí `app.setName("LuDone Desktop")`, tedy i zámek. Naopak `LUDONE_DATA_DIR` (`main.cjs:170-190`) podstrčí **jiný `userData`, a tím zámek vypne** — je to díra v zámku, ne ochrana. Že se testovací běh nepotká s ostrým, plyne z jiné cesty k souboru fronty, ne ze zámku.
- Kód nedodržuje dokumentovaný vzor. Electron docs mají `if (!gotTheLock) { app.quit() } else { …celý zbytek… }`. `main.cjs:197-199` `else` větev nemá, `app.quit()` je asynchronní a modul běží dál až k `app.whenReady()` na 724. Tvrzení „druhou instanci ukončí **dřív, než se k frontě dostane**" tenhle kód nezaručuje. Oprava je jednořádková a patří do stejné story jako zapojení fronty.

**C7. §5.1 si odporuje sama se sebou.** Tabulka přiznává, že manifestu chybí fsync adresáře („po pádu stroje může rename zmizet"), a o dva odstavce níž stojí „**Nikdy** tedy nenastane stav, kdy na disku leží zvuk bez manifestu". Po pádu **stroje** nastane. Navíc soubory stop se otevírají na `main.cjs:482-484`, tedy **před** manifestem na 498: pád mezi tím nechá na disku sirotčí `.webm`, které obnova (čte manifesty) nikdy neuvidí a retence nikdy nesmaže. Oprava: doplnit fsync adresáře do `manifest.js` a záruku formulovat jako „zvuk **s obsahem**", ne „zvuk".

**C8. §6.2 „jeden klíč spojuje tři místa" je nepravda přesně v tom selhání, které §5 přiznává.** Jméno souboru nese jen `sessionId.slice(0, 8)` (`main.cjs:478`) — 32 bitů; plný `clientRecordingId` žije **jen v manifestu**. Ztráta manifestu (C7) ⇒ obnova musí vyrobit nový klíč ⇒ duplikát, proti kterému celá §6.2 stojí. Oprava: plný GUID do jména souboru nebo sidecar vedle každé stopy.

**C9. §5.2 řádek „running a ve frontě nic" je otevřená díra do peněz.** Nerozliší běžící časovač od časovače, který přežil víkend s vypnutým strojem. Ve spojení s §6.1 S2 bodem 3 (spánek se do měřeného času **počítá**) zavřené víko v pátek vyfakturuje víkend. §6.1 přitom pro nečinnost říká správně „nikdy tiše nesmazat ani tiše nezapočítat" (M21) — pro pád to samé pravidlo neplatí. Nekonzistence uvnitř sekce. Chybí: `startedAt` starší než start procesu ⇒ **zeptat se**, ne pokračovat.

**C10. §5.2 tiše mění pravidlo o zobrazení na pravidlo o úložišti.** `spec.md` R9 („Start i stop se ořezávají na celé minuty, zobrazuje se `5h 16m`") lze číst jako pravidlo o formátu. §5.2 z toho dělá **ořez při zápisu** — sekundy jsou pryč nevratně, a je to `truncate`, ne `round`, tedy systematická jednosměrná odchylka na money path. Pokud to má být tak, musí to rozhodnout Dan a stát to ve `spec.md`, ne v plánu. Bezpečnější varianta: ukládat plné UTC, ořezávat až při odeslání a zobrazení.

**C11. §6.1 S2 bod 4 — pět sekund je číslo bez měření, které nic neřeší.** Dokumentace Electronu výslovně říká, že `true` z `net.isOnline()` je **nezávazné** („a true value is inconclusive"), takže odklad o 5 s nic nezlepší. Lepší pravidlo, které jde vymáhat: `false` je jediná spolehlivá informace ⇒ **selhání při `isOnline() === false` pokus nezapočítává** (stejná třída jako `invalid_grant` v R17); `true` se jako zelená nepoužívá vůbec.

**C12. §6.1 S2 bod 2 slibuje víc, než `prevent-app-suspension` umí.** Podle dokumentace „Keeps system active but allows screen to be turned off" — brání **idle** uspání. Zavření víka uspí Mac tak jako tak. S pravidlem „na `resume` se nerozjíždí" z toho plyne, že zavření víka nahrávku **ukončí**. To je přímý rozpor s akceptačním scénářem `spec.md` §8 `DSK-F007` + `DSK-F009` („zavřu víko a za hodinu otevřu · Then nahrávka je na serveru bez ručního zásahu"). Jedno z toho musí padnout — buď scénář, nebo pravidlo. Doporučuju scénář přeformulovat („zavření víka nahrávku uzavře jako neúplnou a po probuzení ji nabídne odeslat") a doměřit na skutečném Macu.

## D. Rozpory s ostatními dokumenty

**D1. §6.1 S1 vs `spec.md` R18 a rozhodnutí C2 — nejtvrdší rozpor.** Sekce chce **jednu frontu a jednu pumpu** pro oba typy položek. `processNext` má **jediný** killswitch `uploadEnabled` a při `!== "true"` vrací `disabled` pro **celou** frontu (`queue.js:202-204`). Dva nezávislé vypínače nad jednou pumpou tedy dnes nejdou: vypnutý `DESKTOP_UPLOAD_ENABLED` by zastavil i čas. Sekce to musí buď vyřešit (killswitch se vyhodnocuje per položku podle typu), nebo přiznat, že „jedna fronta" má cenu druhého argumentu ve funkci.

**D2. §6.1 S5 „položky nesou vlastníka" je změna schématu, kterou plán nemá v rozsahu.** Dnešní položka (`queue.js:131-144`) vlastníka nemá; B7 má v `plan.md` jen „rozlišovač typu položky". A `schemaVersion` se validuje tvrdě (`queue.cjs:16`, `queue.js:35`) a `loadQueue` polyká **jen `ENOENT`** — takže revert B7 na v1 build shodí načtení fronty a uživateli neodeslané nahrávky zmizí. To vyvrací `plan.md` §3 „každá story je samostatně revertovatelná". Chybí pravidlo o dopředné/zpětné kompatibilitě souboru fronty. Bonus: konstanta `QUEUE_SCHEMA_VERSION` je **zdvojená ve dvou souborech** bez sdíleného zdroje — bump jednoho a zapomenutí druhého je tichý rozjezd.

**D3. §5.5 nemá kde bydlet.** Zákaz zvuku, tokenu, e-mailu a názvu schůzky v logu je **chování**, a podle `spec.md` „Autorita při rozporu" chování vlastní `spec.md`, ne `plan.md`. Ve `spec.md` §4 žádné takové R-pravidlo není. Patří tam jako R21, jinak ho v plánu při první revizi nikdo nenajde.

**D4. §6.1 S4 „jde to bez migrace, sloupec existuje" je tvrzení bez zdroje, které vypadá jako změřené.** `KONTRAKT.md` §8 přitom měřeně tvrdí opak o serverové straně („není routa, migrace ani větev"). Buď doplnit, kde ten sloupec je (patrně tabulka OAuth klientů v `ludone-app`), nebo označit jako návrh.

**D5. `client_name` = `LuDone Desktop — <hostname>` vs §5.5.** Hostname Macu běžně obsahuje celé jméno člověka. Není to spor (§5.5 mluví o logu, tohle jde na server), ale musí u toho stát jedna věta, že se hostname **neloguje**.

## E. Chybí úplně

1. **Vymáhání.** U žádného ze čtrnácti pravidel §5 a §6 není řečeno, čím se porušení pozná. Bez toho je to seznam přání. Minimum, které jde napsat hned:
   - odstranění `await handle.sync()` v `queue.cjs` musí zčervenat jeden test;
   - fsync adresáře se testuje nad deskriptorem **adresáře** (jinak to někdo „splní" fsyncem souboru);
   - „Zkusit teď nikdy nesmí volat `send()`" se testuje špionem na `send` a stiskem během běžící pumpy;
   - „`SENDING` na disku před `send()`" se testuje `send`em, který si přečte soubor fronty.
2. **Definice pumpy.** §5.4 o ní mluví jako o existující věci. Není nikde: ani soubor, ani perioda, ani kdo ji budí, ani co s ní dělá odhlášení (R12 říká, že fronta přežije, R13 určuje pořadí — pumpa v tom nefiguruje).
3. **Docházející místo BĚHEM nahrávání.** §5.1 řeší jen preflight na startu. M23 přitom popisuje selhání v 38. minutě; dnes to podle §5.1 otráví stopu generickou chybou a podle R3 zastaví obě. Chybí stav „na disku je málo místa, nahrávání se zastavilo".
4. **Kdo maže sirotky.** Retence 7 dní (R19/B3) visí na úspěšném odeslání. Co se `.incomplete` manifesty a jejich zvukem, které uživatel na obrazovce M24 nikdy neodklikne, §5 neříká — takže retence disk nikdy neuvolní, a to je přímá cesta zpátky k bodu 3.
5. **Transakční pravidlo pro ukončení aplikace.** Sekce ho označí za nepokryté a tím skončí. `before-quit` je jediné místo, kde jde ještě `preventDefault()` a stopy s manifestem uzavřít jako `incomplete`. Patří sem i `powerMonitor` `shutdown` (macOS, umí `preventDefault`) — jediná obrana proti vypnutí Macu uprostřed nahrávky; §5 ani §6 ho nezmiňují, M20 ano.
6. **Dekódovatelnost utrženého WebM.** „Obnova nic nezkracuje, vezme soubory tak, jak jsou" mlčky předpokládá, že Opus v Matroska bez `Cues` a `Duration` a s useknutým posledním clusterem jde přepsat. Nezměřeno. Měření je levné (useknout hotový `.webm`, pustit `ffprobe`) a je vyřazovací — celý smysl nahrávky je přepis. Pozn.: `KONTRAKT.md` §8 hlásí, že `ffmpeg` chybí i v `Dockerfile:33`.
7. **`deviceId`** v návrhu záznamu časovače: odkud se bere a jestli je stabilní přes reinstalaci. Bez toho je to pole, které vyplní každý jinak.

## F. Čísla, která vypadají změřeně a nejsou

- **„poslední až 1 s zvuku té stopy je nepoužitelná"** — 1 s je timeslice, ne naměřená ztráta. Ztratí se poslední neuzavřený cluster, a §5.1 sama říká, že `nextSequence` po pádu neexistuje, takže neví, kde ten cluster začal. Psát „poslední neuzavřený chunk", nebo změřit.
- **„≈ 115 MB na stopu"** — `audioBitsPerSecond: 128_000` (`RecordingCard.jsx:145`) je **požadavek** na MediaRecorder, Opus jede VBR a k tomu přičti režii kontejneru. Je to odhad ze zdrojové konstanty, ne velikost souboru. Sekce to označuje jako NEMĚŘENO správně, ale slovo „vyjde" naznačuje jistotu, kterou to nemá.
- **„návrh: 5 s"** a **„návrh: 30 minut"** — poctivě označené jako návrh, to je v pořádku; u 5 s ale viz C11, tam nepomůže ani měření, protože je to špatná páka.