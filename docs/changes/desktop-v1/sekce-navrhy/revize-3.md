# Skeptická revize 3

**Adversariální čtení návrhu sekce.** Zadání znělo najít, čím se dá
tvrzení obejít nebo v čem lže — ne schválit.

---

# Skeptická revize sekcí „Redaction" (spec §11) a „Audit a observability" (plan §5)

Ověřováno proti kódu na `main` (`8ba74d2`), Electron 37.3.1, oficiální dokumentaci Electronu a citovaným dokumentům. Vše níže jsem změřil, ne odhadl; kde jsem neměřil, píšu to.

---

## 1. Co je v pořádku — ověřeno, nechat beze změny

| Tvrzení v textu | Ověření |
|---|---|
| 11 volání `console.*` v `electron/**` a `src/**` | `grep -rnE "console\.(log\|error\|warn\|info)" electron src` → **přesně 11**, všechna v `main.cjs`. Číslo sedí. |
| `main.cjs:195` = `app.commandLine.appendSwitch("disable-breakpad")` | sedí (mechanismus je ale špatně popsaný, viz 2.3) |
| `main.cjs:170-190` — `setAppLogsPath` jen pod `LUDONE_DATA_DIR` | sedí, `configureWritablePaths()` má `if (!requestedRoot) return;` na ř. 172 |
| `main.cjs:419` loguje `sources[0].name` | sedí (dopad je ale nadsazený, viz 2.2) |
| `main.cjs:434,478` — název `<značka>-<8 znaků GUID>-<stopa>.webm` | sedí: ř. 478 `sessionId.slice(0, 8)`, ř. 434 `${prefix}-${suffix}.webm` |
| práva `0600` / `0700` | sedí: `fs.promises.open(filePath, "wx", 0o600)` ř. 433, `mkdir(..., mode: 0o700)` ř. 480 |
| `bytes` a `sha256` jsou kontraktní údaj | sedí, `main.cjs:447` `createHash("sha256")`, ř. 613, a KONTRAKT §3 |
| Politika opakování 30 s / 6 h / 5 / 20 % | sedí, `DEFAULT_RETRY_POLICY` v `src/lib/queue.js` — jen **rozsah je 12–17**, ne 12–16 (`Object.freeze` se zavírá na 17) |
| `RECORDING_TIMESLICE_MS = 1_000` na `RecordingCard.jsx:8` | sedí. 7 200 / 14 400 je korektní dopočet — v textu ale doplnit „**dopočet, neměřeno**": `MediaRecorder` negarantuje jednu událost na interval |
| Doslovná citace ze schváleného designu | sedí **doslova**, `design/navrh/nahled.html:587`. Dobrá práce — tohle je jediné místo v obou sekcích, kde citace obstála beze zbytku |
| „Zařízení — MacBook Pro — Dan" v panelu | sedí, `nahled.html:245, 267, 554`. Past je reálná |
| B10 „O aplikaci/diagnostika CHYBÍ" | sedí, `inventar-povrchu-2026-09-01.md:24` |
| ESLint je k dispozici (`eslint.config.js`, `npm run lint`) | sedí — RD-3 je proveditelný |

Věcně nejlepší části: **§11.4 (allowlist místo blocklistu)**, **§11.5 (redakce neřeší samotné `.webm`)**, **§5.0 (změřený stav dneška)** a **poctivá výhrada v §5.4, že v1 je audit lokální fronty, ne důkaz o serveru**. Ty nechat.

---

## 2. Čtyři tvrzení, která **nejsou pravda** (opravit před vložením)

### 2.1 🔴 `app.getAppLogsPath()` neexistuje
Plan §5.3 staví celé „Kam" na neexistujícím API. Electron má **`app.setAppLogsPath([path])`** (setter) a čtení jde přes **`app.getPath("logs")`**. Getter s tímhle jménem v API není.

Navíc dva důsledky, které v textu nejsou:
- Cesta se skládá jako `~/Library/Logs/<jméno aplikace>` (`electron_paths.cc`, `GetPossiblyOverriddenApplicationName()`). `package.json` má `name: "ludone-desktop-prototype"` a **`app.setName("LuDone Desktop")` běží až na `main.cjs:193`, tedy PO `configureWritablePaths()` na ř. 192.** Kdo si cestu vyhodnotí při načtení modulu, dostane `~/Library/Logs/ludone-desktop-prototype/`. Slíbená cesta je splnitelná, ale jen s explicitním pořadím.
- Když se `setAppLogsPath` volá **s** cestou, Electron adresář **nevytváří** (`App::SetAppLogsPath` jen přepíše `PathService`). Logger si ho musí založit sám. `mode: 0o700` se navíc uplatní jen při vzniku a podléhá umask — u existujícího adresáře je ignorován.

**Oprava:** `app.getPath("logs")`, vyhodnotit až po `app.setName(...)`, adresář zakládat sám, práva ověřit `fs.stat`, ne předpokládat.

### 2.2 🔴 Nález na `main.cjs:419` je podložený citací, která říká **opak**
Text tvrdí: *„Měření z `docs/ux/cesta-uzivatele-2026-09-01.md` ukazuje, že názvy oken nesou předmět e-mailu, jméno PDF v Náhledu nebo skladbu ve Spotify."* Ten dokument (ř. 17) říká, že skeptik změřil pravý opak: **konferenční okna se jmenovala doslova „Google Meet"**, Zoom „Zoom Meetings", a identifikaci nesly **jen okna, která se schůzkou nesouvisejí** — tedy ta, o která tady vůbec nejde.

A hlavně: `main.cjs:418` volá `getSources({ types: ["screen"] })`. Podle `DesktopCapturerSource` je `name` u screen zdroje **„Entire Screen" nebo „Screen \<index\>"** — název okna se do něj nedostane, protože žádné okno se neenumeruje. **Ten řádek dnes nemůže vytéct předmět mailu ani skladbu.**

Zbytkové riziko je jiné a menší: jméno displeje může být uživatelské (externí monitor, Sidecar → „Danův iPad"). To je důvod k preventivnímu úklidu, ne 🔴 vada.

**Oprava:** v §11.2 a §11.7 přepsat na: *„`main.cjs:419` loguje `name` obrazovky. Dnes `types:["screen"]`, takže hodnota je „Entire Screen"/„Screen N" nebo jméno displeje — únik obsahu schůzky to není. Redigovat preventivně, protože rozšíření na `types:['window']` by z toho únik udělalo bez další změny."* Citaci na `cesta-uzivatele` **odstranit**, ta tvrdí opak.

### 2.3 🔴 P5 pojmenovává špatný mechanismus
*„Breakpad je vypnutý (`main.cjs:195`)"* — Electron používá na macOS **Crashpad, ne Breakpad**, a klíčový fakt je jiný: **crash reporty se nesbírají ani neodesílají, dokud se nezavolá `crashReporter.start()`.** `--disable-breakpad` je nedokumentovaný Chromium přepínač; spoléhat se na něj jako na záruku je fail-open.

**Oprava:** záruka zní „**`crashReporter.start()` se nikdy nevolá**" + statický test, že se v `electron/**` nevyskytuje. Přepínač nechat jako pás navíc, ne jako důvod. ⚠️ Neověřeno mnou: macOS `ReportCrash` píše `.ips` do `~/Library/Logs/DiagnosticReports/` nezávisle na aplikaci — pokud to platí, P5 ho nepokrývá a text to má přiznat, ne mlčet.

### 2.4 Dvě křížové reference a jedno číslo
- §11.4: *„Obsah exportu vyjmenovává `plan.md` §5.4"* → je to **§5.5**. §5.4 jsou peníze.
- §11.6: *„poměr červené : zelené odpovídá `plan.md` §3"* → RD-1…RD-5 červené, RD-6 zelená = **5 : 1**. Plan §3 bod 4 žádá **2–3 : 1**. Věta o souladu je nepravdivá; buď rozdělit RD-6 na tři zelené případy, nebo větu škrtnout.
- `src/lib/queue.js:12-16` → `12-17`.

---

## 3. Jak se sekce dá splnit formálně a přitom obejít

### 3.1 🔴 RD-3 hlídá slovo `console`, ne odchod dat
Nejvíc nosný test je nejsnáze obejitelný. Projde jím: `process.stdout.write` / `process.stderr.write`, `util.debuglog`, jakákoli knihovna typu `electron-log`, neodchycený `throw`, a `// eslint-disable-next-line no-console`. Navíc `ELECTRON_ENABLE_LOGGING` / `--enable-logging` pošle konzoli rendereru na stderr **bez ohledu na naše pravidlo**.

Druhá díra: *„mimo jediný modul loggeru"* — třířádkový průchoďák `export const log = (...a) => console.log(...a)` splní RD-3 doslova a zruší redakci úplně.

**Oprava:** (a) test hlídá **odchozí kanály** (`process.stdout.write`, `process.stderr.write`, `console.*`) mimo logger; (b) v CI `eslint --no-inline-config`, aby `disable` komentář nefungoval; (c) RD-3 navíc tvrdí, že **veřejné API loggeru přijímá jen `(ev, fields)`**, nikdy hotový řetězec — jinak je logger jen jiná cesta ke stejnému stderr.

### 3.2 🔴 „`ev` je uzavřený výčet" nikdo nevynucuje — je to přání
Plan §5.3 označuje uzavřený výčet za **jedinou obranu proti volnému textu** (a §11.6 na to spoléhá v odstavci „co testy nechytnou"). Nikde ale není brána, která by neznámé `ev` zachytila. Když to někdo poruší, **nevšimne si toho nic**.

**Oprava:** logger na neznámé `ev` **vyhodí výjimku ve vývoji a zahodí řádek v produkci**; test RD-7 nad tím. Bez toho ten odstavec o obraně neplatí.

### 3.3 RD-2 / RD-4 / RD-5 se dají splnit blokací čtyř konkrétních řetězců
RD-4 jmenuje `"Porada provozu"`, `"dan.jirotka@makemore.cz"`, `"ya29.TESTOVACI"`, `"MacBook Pro — Dan"` — implementace, která ty čtyři literály prostě nahradí, projde. RD-5 („nové pole") projde i allowlist vyrobený jako snímek `Object.keys(state)` v době buildu.

**Oprava:** hodnoty i názvy klíčů **generovat náhodně při každém běhu testu** (marker `RD4-<uuid>`), pak tvrdit nepřítomnost markeru. Tím se z blocklistu na literály stane test vlastnosti.

### 3.4 RD-1 mine zvuk, který prošel serializací
`instanceof Buffer` nechytne `JSON.parse(JSON.stringify(buf))` → `{"type":"Buffer","data":[…]}`, ani base64 řetězec (§11.2 ho zakazuje, žádný test ho nehledá), `DataView`, stream, `MediaStream`. A přesně tahle cesta v repu existuje: `preload.cjs` posílá `appendRecordingChunk(sessionId, source, sequence, arrayBuffer)`, a `main.cjs:164` už dnes loguje **každý odmítnutý IPC kanál i s `error.message`**.

**Oprava, jedno pravidlo místo pěti:** **strop na každý řetězec a každé pole v logu** (návrh: 200 znaků / 32 prvků, pak `…+N`). Chytne serializovaný Buffer, base64, dlouhou `error.message` s cestou **i případ, který §11.6 sama přiznává jako nechycený** (název schůzky předaný jako `errorCode`). Doplnit tvar `{type:"Buffer"}` a scrub domovského adresáře.

### 3.5 Sabotáž, jak je napsaná, RD-5 nezčervená
*„Odstraň redakční filtr z cesty zápisu. RD-4 a RD-5 musí zčervenat."* RD-5 měří **allowlist v exportu**, což je jiný kód než redakční filtr zapisovatele. Odstranění filtru RD-5 nezmění → sabotáž svou vlastní podmínku nesplní a někdo ji „opraví" tím, že obě cesty slepí dohromady.

**Oprava:** dvě sabotáže. (a) filtr pryč ze zapisovatele → RD-1, RD-2, RD-4 červené; (b) allowlist nahrazen blocklistem → RD-5 červená. RD-6 zelená v obou.

### 3.6 „Pravidlo je stejné na všech pěti povrchech" je past, a P3 nemá test
Na P3 (text chyby pro člověka) platí **přísnější a jiné** pravidlo: spec §7 zakazuje technický šum, §11.3 zakazuje identifikátory. Implementace, která do UI vysype redigovaný řádek logu, splní §11 doslova a **poruší §7**. Zároveň P3, P4 a P5 nemají v RD-1…RD-6 **ani jeden test** — všech šest míří na zapisovatele a export.

**Oprava:** §11.1 rozdělit — P1/P2 „co se smí zapsat", P3 „co se smí ukázat" (žádné kódy, žádné GUID; cesta k detailu je tlačítko „Zkopírovat podrobnosti"). Buď P3 dát vlastní test nad formátovačem chyb, nebo ho ze sekce vyškrtnout. Deklarovaný a netestovaný povrch je horší než nedeklarovaný.

### 3.7 Sekce 7 exportu ruší záruku, kterou §11.4 slibuje
Export má sedm sekcí, sedmá je **2 000 řádků logu** — tedy zdaleka největší část souboru. Ta **není chráněná allowlistem**, jen redakcí. §11.4 přitom tvrdí, že export je bezpečný právě proto, že se skládá z allowlistu. To je přesně to tiché lhaní, které se v takové sekci hledá.

**Oprava:** buď to napsat naplno („sekci 7 chrání redakce, ne allowlist"), nebo do exportu pouštět jen řádky, jejichž `ev` je ve výčtu a jejichž pole projdou allowlistem.

### 3.8 §11.3 a P4 si odporují o délce GUID
§11.3: *„vždy celý GUID, nikdy zkrácený… zkrácený záznam nejde dohledat."* P4: název souboru s **8 znaky** GUID *„vyhovuje."* Přitom název souboru je právě to, co člověk s exportem páruje.

**Oprava:** doplnit, že název souboru je vědomá výjimka (přejmenování by rozbilo potvrzené chunky a hashe — doloženo v `cesta-uzivatele`), a že **export musí vedle sebe uvádět prefix i celý `clientRecordingId`** z manifestu. Jinak §11.3 svůj vlastní důvod popírá.

---

## 4. Chybí úplně

### 4.1 🔴 Manifest je **šestý povrch** a v sekci není
`<prefix>.manifest.json` leží vedle `.webm`. Podle `cesta-uzivatele-2026-09-01.md:17` má do manifestu jít **název schůzky** (M19) — do názvu souboru schválně ne. Manifest je tedy soubor, který nese zakázaný obsah, jde snadno poslat („pošli mi ten manifest") a §5.5 bod 5 z něj do exportu bere „stav manifestu".

Živá past ve stejném zdroji, ověřená mnou v `src/lib/manifest.js:86-101`: **`transitionManifest` skládá výsledek ze čtyř jmenovaných polí** (`clientRecordingId`, `createdAt`, `closedAt`, `tracks`), takže `label` přidaný jen do `createManifest` se při uzavření **tiše zahodí**.

**Doplnit jako P6:** manifest smí nést název (stejná ochranná třída jako zvuk, `0600`/`0700`), ale **nikdy se nekopíruje do logu ani do exportu** — export bere jen `state`, ne obsah. A `transitionManifest` musí `label` přenášet, jinak funkce DSK-F008 zmizí bez chybové hlášky.

### 4.2 🔴 Export nemá RBAC filtr — obchází „každý vidí jen svoje"
Spec §2 i plan §1: v1 vidí každý jen své záznamy, admin vše. Sdílené zařízení `zasedacka@makemore.cz` **je v rozsahu v1** (B1). Na tom Macu je **jeden log a jeden export**, které nesou GUIDy nahrávek a časové záznamy **všech, kdo se tam vystřídali**. Kdokoli klikne na „Exportovat diagnostiku", vynese je ven.

Plan §5.7 to odbývá větou, že „čí to bylo" je věc B10. To je jiná otázka. **Tohle je únik dveřmi diagnostiky, ne otázka přiřazení.**

**Doplnit požadavek:** export obsahuje záznamy **jen aktuálně přihlášeného `userId`**; na sdíleném zařízení je buď omezený na aktuální relaci, nebo je to akce jen pro admina. A RD-8: export sestavený nad stavem se dvěma `userId` nese jen jedno.

### 4.3 Renderer nemá kudy logovat
RD-3 zakazuje `console.*` i v `src/**`, logger je `electron/log.cjs` (hlavní proces) a `electron/preload.cjs` (22 řádků) žádný logovací kanál nevystavuje. Buď renderer přestane logovat úplně, nebo vznikne nový IPC kanál — tedy **nový únikový povrch na téže sběrnici, po které už teče `ArrayBuffer` se zvukem**.

**Doplnit:** jméno kanálu, směr, že renderer posílá **jen `(ev, fields)`**, nikdy hotový text, a že projde `requireTrustedSender` (`main.cjs:157-167`). Bez toho je RD-3 v rendereru nesplnitelný.

### 4.4 Logger nesmí spadnout do volajícího
Sedí na cestě chunku (2 h = 14 400 zápisů). Plný disk nebo read-only adresář nesmí ukončit nahrávání. Nikde to není napsáno.

### 4.5 Bouře selhaných chunků
*„Chunk se loguje jednotlivě jen tehdy, když selže."* Systémové selhání (plný disk) shodí **všech 7 200 chunků na stopu** → 7 200 řádků, každý s `fs` chybou nesoucí **plnou cestu**. Zároveň nafouknutí souboru i zesílení úniku.

**Doplnit:** slučování podle kódu chyby s počítadlem, strop řádků za minutu.

### 4.6 `error.message`, ne jen `error.stack`
§11.3 řeší `stack`. Node `fs` chyby nesou hodnotu v **message**: `ENOENT: no such file or directory, open '/Users/dan/Library/.../2026-09-01T...webm'`. Tam je i jméno uživatele, i název souboru. Řeší to strop řetězce z bodu 3.4 + scrub `$HOME → ~`, ale musí to být napsané.

### 4.7 Chybějící klíče v RD-2
Doplnit `url`, `href`, `location`, `redirect_uri`, `query`, `state`, `id_token`, `cookie`, `set-cookie`. OAuth loopback callback nese `code` a `state` **v URL** — zalogovat celý callback URL při `auth.done` je to nejpřirozenější, co kdo udělá, a dnešní seznam to nezakazuje.

### 4.8 Retence logu nemá bránu ani story
14 dní / 20 MB je návrh bez testu, bez úkolu a bez vlastníka — zatímco retence nahrávek (R19) má **B11**. Zároveň nikde není, že se rotace provede i po restartu. Bez brány to sekce sama definuje jako přání.

### 4.9 „Poslední kód chyby" v exportu smí být volný text
§5.5 bod 4. Když se tam uloží **zpráva** ze serveru místo kódu z výčtu, je to volný cizí text v allowlistovaném poli. **Požadavek:** jen kód z výčtu, jinak `unknown`.

### 4.10 Kam export padá a kdo ho smí udělat
Není řečeno, že nesmí skončit v adresáři nahrávek, že se nikdy nevytváří automaticky, ani kdo na sdíleném Macu smí kliknout. A nově vymyšlené **okno náhledu** musí splnit Danovo čerstvé pravidlo o malé obrazovce: zkrátit se podle plochy, hlavička a patička přilepené, prostředek roluje — dnešních pevných 792 px na 1280×800 přetéká.

### 4.11 Veřejný GitHub mění laťku a v sekci není
Dan drží distribuci otevřenou a zvažuje veřejný GitHub. `decisions.md` přitom nese starší rozhodnutí *„Neplatit GitHub Pro ani nezveřejňovat repo"* — **ty dvě věci si odporují a redakce je místo, kde to bolí**: veřejné issues znamenají, že export je věc, kterou lidé vlepí na veřejnou stránku. Zároveň §5.7 správně ruší Sentry (A2), takže **veřejné issue je jediný kanál**.

**Doplnit jednu větu:** export je navržený tak, aby šel zveřejnit — nebo naopak výslovně ne, a šablona issue si ho pak nesmí říct. Bez rozhodnutí to zůstane na tom, kdo to zrovna pošle.

---

## 5. Peníze: §5.4 hlídá duplikát, který kontrakt už zakazuje

### 5.1 🔴 AU-2 měří špatnou věc
*„Dva různé `serverEntryId` u jednoho `timeEntryId` znamenají duplikát."* Jenže KONTRAKT §3 a §5 říká, že **server vynucuje unikát na idempotenčním klíči** a na `409` vrací **ten existující záznam**. Po dokumentované cestě tedy dva různé `serverEntryId` u jednoho klíče **vzniknout nemohou**. AU-2 hlídá případ, který je už ošetřený jinde.

Reálné riziko je opačné a v sekci není: **dva různé `timeEntryId` pro tutéž práci.** Vznikne, když (a) padne renderer nebo appka a perzistence časovače se ztratí — přesně selhání, které řeší B5, (b) týž úsek vykáže webový LuTrack i desktop. Do Tabidoo teče **týdenní souhrn**, takže se ta dvě čísla sečtou a v mzdových nákladech vypadají jako poctivě odpracovaný den (R10). Přesně to je důvod pro B12 („zákaz překryvů") a přesně to je měření, které spec §9 označuje za chybějící.

**Oprava:** export tiskne **překryvy intervalů napříč různými `timeEntryId`** na uživatele a den, ne jen shodu `serverEntryId`. Sabotáž: odstranit porovnání překryvů → test červený. AU-2 v dnešní podobě nechat jako doplněk, ne jako hlavní obranu.

### 5.2 §5.4 předrozhoduje serverové rozhraní času
*„`timeEntryId` je zároveň idempotenční klíč vůči serveru."* KONTRAKT §1 výslovně říká, že **vykázaný čas přes ten kontrakt neteče**, a N1/M11 nechávají backend času otevřený za adaptérem (plan §1: adaptér nesmí obsahovat business pravidla). Spec tímhle fixuje rozhraní, které je vědomě otevřené.

**Oprava:** „lokální klíč proti duplikaci, vzniká při startu (R10); jestli ho převezme i budoucí backend, rozhodne jeho vlastní průchod."

### 5.3 Tři z osmi událostí v v1 nemohou nastat
`time.send_attempt`, `time.send_result`, `time.duplicate_rejected` — `DESKTOP_TIME_ENABLED` je vypnutý a server neexistuje (S1). AU-1 („každá z osmi má test, že se zapíše") je pro ně splnitelný jen nad falešným adaptérem. Napsat to, jinak je to zelená brána nad kódem, který nikdo nespustil.

### 5.4 Vypínače nemají test, i když R18 ho žádá
§5.3 loguje `flag.state`, ale žádná brána netvrdí, že **chybějící hodnota se zaloguje jako vypnuto**. R18 vlastní test výslovně vyžaduje.

---

## 6. Zařazení do plánu — dvě chyby, které způsobí konflikt

### 6.1 🔴 B13 patří do sekvenčního řetězce nad `main.cjs`
B13 přepisuje 11 volání a řádek 419 — všechno v `electron/main.cjs`. Plan §2 „Rozvržení do worktrees" ale říká: **B3 → B5 → B6/B7 sdílí `electron/main.cjs` → sekvenčně v jednom stromu.** Blok deklaruje jen `Závisí: B3`, což čtenáře pustí do paralelního worktree a skončí to přepsanou prací (globální pravidlo: dva zapisovatelé v jednom stromu si práci přepisují).

**Oprava:** `Závisí: B3, B5, B7` a explicitně „**běží v témže stromu jako B3/B5/B6/B7, sekvenčně**".

### 6.2 „Doplněk do §1 / §2" vyrobí dva zdroje pravdy
Když §5.1 a §5.2 zůstanou v §5, pak modulová tabulka v §1 **neobsahuje `log.cjs`** a DAG v §2 **neobsahuje B13 ani B14** — kdo čte DAG, ty stories nikdy neuvidí. Když se přesunou, zůstanou v §5 díry.

**Oprava:** napsat, že §5.1 a §5.2 jsou **vkládaný text pro §1 a §2** a v §5 po nich zůstane jednořádkový odkaz. Ne obojí.

### 6.3 Drobnost k předpokladům autora
`electron/log.cjs` sedí k dnešní konvenci (`auth.cjs`, `queue.cjs`, `main.cjs`, `preload.cjs`) — ověřeno, v pořádku jako návrh. Číslování B13/B14 je konzistentní s dnešním plánem (poslední je B12). Zadání mluví o **17 obrazovkách** návrhu, `decisions.md` O7 o **22** — nesouvisí s těmito sekcemi, ale ten rozpor někde žije a jednou se o něj někdo praští.

---

## 7. Pořadí oprav, kdybych měl čas jen na část

1. §5.3 — `app.getPath("logs")` místo neexistujícího getteru (2.1)
2. §11.7 + §11.2 — přepsat nález na ř. 419 a smazat citaci, která tvrdí opak (2.2)
3. §5.4 — překryvy místo shody `serverEntryId` (5.1)
4. §11.6 — RD-3 na odchozí kanály, náhodné markery v RD-4/RD-5, strop řetězce v RD-1, dvě sabotáže (3.1, 3.3, 3.4, 3.5)
5. Nový P6 manifest + `transitionManifest` past (4.1)
6. RBAC filtr exportu kvůli sdílené zasedačce (4.2)
7. Vynucení uzavřeného výčtu `ev` (3.2)
8. B13 do sekvenčního řetězce (6.1)

Zbytek je poctivá dokumentační hygiena a dá se dodělat po vložení.