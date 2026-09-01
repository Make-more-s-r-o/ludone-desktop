# Návrh sekce: transakce-concurrency

**NEZMRAZENO.** Vzniklo 1. 9. 2026 ve workflow `doplneni-masterplanu`. Skeptická revize
leží v `revize-*.md` vedle a **našla v těchhle sekcích nepravdivá tvrzení** — do `spec.md`
ani `plan.md` se to proto nevkládá celé. Co z toho už platí, je v `spec.md` §11.

---

## 5. Transakční hranice

Desktop nemá databázi. Přesto drží tři stavy, které musí přežít pád: **rozepsanou nahrávku**,
**běžící časovač** a **odchozí frontu**. Tahle sekce říká, co je u každého z nich jedna nedělitelná
operace, kdy je hotová, a co po pádu na disku zůstane.

🔴 **Vzorec „temp → `fsync` → `rename` → `fsync` adresáře“ platí pro STAVOVÉ SOUBORY, ne pro zvuk.**
Zvukový chunk se přejmenovat nedá — soubor roste. Repozitář má dnes tři různé zápisy a jen jeden
z nich má vzorec celý:

| Co se zapisuje | Jak dnes | Kde | Chybí |
|---|---|---|---|
| Soubor fronty | temp → `fsync` → `rename` → `fsync` adresáře | `electron/queue.cjs:36-67` | — |
| Manifest nahrávky | temp → `fsync` → `rename` | `src/lib/manifest.js:132-150` | 🔴 **`fsync` adresáře.** Po pádu stroje může rename zmizet, i když obsah souboru je zapsaný |
| Zvukový chunk | append do otevřeného handle → `fsync` souboru | `electron/main.cjs:560-578` | nic — rename tu nemá co dělat |
| Stav časovače | **neexistuje** | `src/features/tracking/TrackingCard.jsx:15-25` drží stav v paměti rendereru | celý |

### 5.1 Zápis chunku nahrávky

**Jedna transakce = jeden chunk jedné stopy.** Obsahuje kontrolu pořadí
(`sequence === track.nextSequence`), zápis všech bajtů ve smyčce, `handle.sync()` a **teprve pak**
inkrement čítače (`main.cjs:560-573`). Potvrzená je ve chvíli, kdy se `sync()` vrátí — do té doby
můžou bajty ležet jen ve stránkové cache.

Serializaci drží řetěz promisů na stopu (`track.queue`, `main.cjs:560,575-577`). Dvě stopy zapisují
nezávisle, uvnitř jedné stopy nikdy dva zápisy naráz. **První chyba stopu otráví** (`track.writeError`)
a každý další chunk padne na ní — to je správně: po díře ve streamu nemá smysl pokračovat, jako by
se nic nestalo. Vada je jinde a řeší ji R3: dnes se zastaví **obě** stopy, i když vypadla jedna.

Hranice startu je závazná: `.incomplete` manifest se zapíše **dřív, než renderer dostane `sessionId`**
(`main.cjs:497-498`). Nikdy tedy nenastane stav, kdy na disku leží zvuk bez manifestu. Tohle pořadí
se nesmí obrátit.

**Pád uprostřed:**

- *Uprostřed zápisu chunku* — soubor končí utrženým chunkem, poslední až 1 s zvuku té stopy je
  nepoužitelná (timeslice `RecordingCard.jsx:8`). Vše starší je v pořádku, protože každý dřívější
  chunk má za sebou `fsync`.
- *Po restartu* — pravdu o obsahu nese **délka souboru**, ne čítač `nextSequence`; ten žije v paměti
  a s pádem umře. Obnova nic nezkracuje: vezme soubory tak, jak jsou, přečte `.incomplete` manifest
  a nabídne „odeslat / smazat“. 🔴 **Tahle obrazovka neexistuje** (M24) — je to práce, ne popis.
- *Pád rendereru bez pádu hlavního procesu* — pokrytý: `event.sender.once("destroyed")` uzavře session
  jako `incomplete` (`main.cjs:518-524`).
- *Ukončení aplikace během nahrávání* — **nepokryté.** `before-quit` dnes jen nastaví `isQuitting = true`
  (`main.cjs:746-747`), soubory nezavírá a na nic se neptá.

🔴 **Dvě hodiny (Danovo rozhodnutí) se lámou tady.** Při 1s timeslice a 128 kbit/s na stopu
(`RecordingCard.jsx:8,145`) vyjde dvouhodinová schůzka na **7 200 chunků a 7 200 `fsync` na stopu,
14 400 celkem**, ≈ 115 MB na stopu, ≈ 230 MB na schůzku *(výpočet ze zdrojových čísel, NEMĚŘENO)*.
Manifest se přitom přepisuje **dvakrát za nahrávku**, ne jednou za chunk — to je správně a musí to
tak zůstat. Doměřit je potřeba cenu těch 14 400 `fsync`, ne velikost souborů. Do hranice startu navíc
patří kontrola volného místa proti nejdelší povolené délce (2 h ⇒ ≈ 230 MB + rezerva na neodeslanou
frontu); řetězec `ENOSPC` se dnes v repu nevyskytuje ani jednou (M23).

### 5.2 Start a stop časovače

Dnes není co popsat: `TrackingCard.jsx:15-25` drží `active` a `startedAt` v React stavu, takže pád
rendereru časovač beze stopy smaže. Cíl (story **B5**): stav vlastní hlavní proces v
`electron/tracking.cjs`, perzistence týmž vzorem jako fronta.

**Start = jeden atomický zápis jednoho záznamu:**

```
{ trackingId  UUID, vzniká TEĎ
  projectId   GUID, nikdy název (R6)
  startedAt   UTC, ořezáno na celé minuty (R9)
  state       "running"
  deviceId    identifikace stroje }
```

Potvrzený je, až se vrátí `fsync` adresáře. **Teprve pak** se překlopí tlačítko a ikona v liště.
Dnešní pořadí je opačné (`TrackingCard.jsx:22-23` překlopí UI okamžitě) a je to vada: po pádu by
uživatel viděl v liště běžící časovač, který nikde není.

**Stop = překlopení `running → stopped` s `endedAt` (UTC, celé minuty) plus zařazení do odchozí
fronty.** Jsou to dva soubory a ty se atomicky přejmenovat najednou nedají. Pořadí je proto závazné:
**nejdřív fronta, pak stav.** Po restartu se dorovná v obou směrech a obojí je neškodné, protože
klíčem je `trackingId`:

| Co obnova najde | Co udělá |
|---|---|
| `running`, ale `trackingId` už je ve frontě | Doplní `stopped` z položky fronty. Stop se neztratil |
| `stopped`, ale ve frontě není | Zařadí. Duplicitu ustojí klíč (`queue.js:126-129` vrátí existující položku) |
| `running` a ve frontě nic | Časovač skutečně běží. Panel ho ukáže s časem od `startedAt` |

**Pád uprostřed:**

- *Před potvrzením startu* — žádný časovač nevznikl. Panel po restartu **nesmí mlčet**: „Měření se
  nepodařilo spustit, začni znovu.“ Jinak člověk věří, že se měřilo, a hodiny chybí.
- *Mezi frontou a překlopením stavu* — pokryto tabulkou výše.
- *Za běhu* — záznam na disku je nedotčený, panel se otevře s běžícím časovačem a správným časem
  (acceptance `DSK-F011`).

### 5.3 Odchozí fronta

`processNext` (`src/lib/queue.js:195-255`) je čistá funkce: **vrací novou frontu, neukládá ji.**
Uložení je věc volajícího a hranice jsou dvě:

1. `attempts + 1` a `state: SENDING` musí být **na disku PŘED** voláním `send()`. Bez toho pád
   uprostřed odesílání vynuluje počítadlo a klient bude do nekonečna opakovat pokus, který server
   pokaždé odmítne.
2. Výsledek (`sent` / `retry_scheduled` / `failed`) se ukládá po návratu ze `send()`.

**Pád mezi 1 a 2** nechá na disku položku ve stavu `SENDING` — a ten dnešní fronta po restartu neumí
přečíst. Pravidlo do **B7**: `SENDING` nalezené při startu se překlopí zpět na `WAITING` a **pokus se
už nezapočítává znovu**. Je to bezpečné, protože server je idempotentní přes `clientRecordingId`
i přes `Content-Range` (KONTRAKT §3).

### 5.4 Kdo drží zámek, když si o frontu řekne pumpa i tlačítko „Zkusit teď“

🔴 **Zámek vlastní hlavní proces, jmenovitě `electron/queue.cjs`. Renderer ho nemá a mít nesmí** —
podle §1 je renderer jen zobrazení.

- Zámek je **serializační řetěz promisů nad souborem fronty**, stejný vzor jako `track.queue`
  u nahrávacích stop (`main.cjs:575-577`). Ne časovač, ne boolean flag: nový požadavek se zařadí
  za rozpracovaný a `processNext` nikdy neběží dvakrát naráz.
- **„Zkusit teď“ druhý průchod nespouští.** Vynuluje `nextAttemptAt` u položek ve stavu `WAITING`
  a probudí pumpu. Když pumpa právě běží, tlačítko se přepne na „Odesílám…“ a nedělá nic dalšího.
  **Nikdy nesmí volat `send()` samo.**
- `processNext` odbaví nejvýš jednu položku (`queue.js:207`). Pumpa je smyčka nad ním a mezi průchody
  vždy uloží stav — pád uprostřed dlouhé fronty proto stojí nejvýš jednu položku.
- Napříč procesy zámek nepotřebujeme: `app.requestSingleInstanceLock()` (`main.cjs:197`) druhou
  instanci ukončí dřív, než se k frontě dostane. Platí to jen pro týž bundle; `LUDONE_DATA_DIR`
  (`main.cjs:170-190`) navíc testovacímu běhu podstrčí jiný `userData`, takže se s ostrým provozem
  nepotká.

### 5.5 Co se z těchhle operací loguje

Jeden řádek na potvrzený přechod: **stav, GUID, počet bajtů, čas v UTC.** 🔴 Nikdy zvuk, token,
e-mail ani název schůzky; identifikátory výhradně jako GUID. Dnešní řádky (`main.cjs:522,643,655`)
pravidlo splňují. Jediné místo, kde do logu jde řetězec ze systému, je `main.cjs:419` — jméno
**obrazovky** z `desktopCapturer` (`types: ["screen"]`); dnes to pravidlo neporušuje, ale rozšíření
na `window` by do logu pustilo titulek okna, tedy i název schůzky.

---

## 6. Concurrency a idempotence

### 6.1 Souběhy, které nastanou

**S1 — Obě agendy naráz.** Pravidlo, ne výjimka (`spec.md` §5). Nesdílejí start ani stop, ale sdílejí
tři věci a právě tam vzniká souběh:

| Sdílený zdroj | Jak se řeší |
|---|---|
| Odchozí fronta | Jedna fronta, dva typy položek s rozlišovačem (**B7**). Ne dvě fronty — dvě fronty znamenají dva zámky a dvě pumpy nad jedním tokenem |
| Token | Jedna single-flight brána, viz **S3** |
| Ikona v liště | Stav počítá **hlavní proces z obou automatů** (**B3**). Dnes ho počítá renderer z jednoho: `App.jsx` dává `useMemo` prioritu nahrávání, takže lišta zamlčí běžící LuTrack (M19; `spec.md` §6 „pátý stav CHYBÍ“) |

Čtvrtý, který nikdo nečeká: **nečinnost**. `getSystemIdleTime` měří HID, takže během hodinové nahrávané
schůzky by se LuTrack zeptal „byl jsi 43 minut pryč?“ přesně ve chvíli, kdy má aplikace v ruce důkaz
opaku (M21). Práh nečinnosti musí být podmíněný stavem nahrávání a čas se **nikdy nesmí tiše smazat
ani tiše započítat**.

**S2 — Probuzení notebooku.** Na `resume` si naráz sáhnou fronta, časovač i panel. Pořadí:

1. **Token první, a jen jednou** — přes bránu ze **S3**. Nikdo jiný refresh nespouští.
2. **Nahrávání se samo nerozjíždí.** Na `suspend` se obě stopy korektně uzavřou jako `incomplete`,
   na `resume` se nepokračuje — zdroje zvuku už nemusí existovat (M20). Po dobu nahrávání drží
   aplikace `powerSaveBlocker('prevent-app-suspension')`; dnes se `powerMonitor` v `electron/main.cjs`
   neimportuje vůbec.
3. **Časovač počítá stěnový čas z `startedAt` v UTC**, ne z monotonního zdroje. Spánek se tedy
   do měřeného času započítá — a dotaz „byl jsi pryč?“ je samostatná nabídka, ne tichá korekce.
4. **Pumpa fronty čeká.** `net.isOnline()` po probuzení chvíli lže; první pokus se odloží
   *(návrh: 5 s)* a dál jde normálním backoffem.

**S3 — Dva souběžné pokusy o obnovu tokenu.** Nejtišší selhání ze všech: server vyhodnotí druhé
použití refresh tokenu jako reuse a revokuje **celou rodinu**. Uživatel se odhlásí „sám od sebe“
a vypadá to jako náhoda (R15, M25).

- **Jedna single-flight brána v `electron/auth.cjs`**, ne v každém volajícím. Kontrakt:
  `getAccessToken()` vrací promise; druhý a třetí volající dostanou **tutéž promise**, ne druhý
  HTTP požadavek.
- Brána žije v **hlavním procesu**. Renderer o tokenu nesmí vědět nic — jinak by každé okno mělo
  vlastní bránu a ta by nechránila nic.
- Rotovaný refresh token se ukládá **atomicky a dřív**, než se zahodí starý.
- `invalid_grant` je **pauza, ne selhání** (R17): položky zůstávají ve `WAITING`, pokusy se nezapočítávají.
- Stav: obnova, revoke ani odhlášení v `auth.cjs` **neexistují**, je tam jen `begin()`. *(Ověřeno:
  `refresh` se v souboru vyskytuje jen jako `grant_types` na řádku 214 a jako čtení `refresh_token`
  na 404-405.)* Brána je tedy požadavek na **B8**, ne oprava.

**S4 — Týž člověk na dvou Macích.** Nejsou to dva žadatelé o jeden zdroj, ale tři samostatné věci:

- *Token.* Dvě samostatná přihlášení = dvě samostatné rodiny, souběh nevzniká. Nebezpečné je
  **kopírování**: Migration Assistant přenese klíč `safeStorage` i šifrovaný blob, obě kopie použijí
  týž refresh token a reuse detekce odhlásí **oba** stroje naráz (M30). Desktop tomu nezabrání, ale
  musí to pojmenovat — **„Přihlášení bylo použito na dvou počítačích naráz“**, ne generické „vypršelo“.
  Aby šlo odhlásit jen jeden stroj, posílá se `client_name` ve tvaru `LuDone Desktop — <hostname>`;
  jde to bez migrace, sloupec existuje.
- *Časovač.* Dva běžící časovače téhož člověka jsou porušení pravidla, které dnes **nehlídá nikdo**.
  Jedinečnost a zákaz překryvů má zamknout databáze (B4) a to je **stopka B12**. Do té doby desktop
  **nesmí předstírat, že to hlídá**: při startu se zeptá adaptéru a když jinde běží záznam, nabídne
  „Na jiném zařízení běží záznam od 9:12 — zastavit ho a začít tady?“. Když adaptér odpovědět neumí
  (v1 je lokální, N1), **řekne to** a start pustí — s tím, že web ukáže překryv. Tiché sloučení ani
  tiché zahození je zakázané: hodiny jsou money-path.
- *Fronta.* Na opuštěném Macu zůstanou neodeslané nahrávky, které nikdo nespočítá (M30). v1 je nechává
  být; jediné, co slibuje, je že se neztratí.

**S5 — Sdílené zařízení `zasedacka@makemore.cz`** (B1, story **B10**). Nejtěžší souběh, protože účet
je jeden a lidí víc:

| Situace | Pravidlo v1 |
|---|---|
| Komu patří nahrávka | Vzniká pod sdíleným účtem. **Kdo to byl, se ptá až při zastavení**, ne při startu — schůzka už běží a ptát se předem stojí první minuty (týž důvod jako u pojmenování, M19). Do zodpovězení ji vidí jen admin |
| Fronta při střídání lidí | Fronta je **společná a přežívá odhlášení** (R12). Položky nesou vlastníka a **pumpa odesílá jen položky právě přihlášené identity.** Bez toho by druhý člověk odeslal nahrávku prvního pod svým jménem |
| Čas na sdíleném účtu | **Neměří se.** Hodiny jsou money-path a sdílený účet nemá komu je připsat. Panel to řekne větou, ne zašedlým tlačítkem bez důvodu |
| Zapomenuté odhlášení | Jediná obrana v1 je automatické odhlášení po nečinnosti *(návrh: 30 minut, neměřeno)*. Že někdo nahraje schůzku pod cizím jménem, v1 **neřeší a je to vědomé** |

### 6.2 Idempotence

🔴 **Klíč vzniká při STARTU, ne při odeslání.** Pro nahrávku je to `clientRecordingId`
(UUID, `main.cjs:477`), pro časový záznam `trackingId` (UUID, vzniká při startu časovače).

Čtyři důvody:

1. **Odeslání se z definice opakuje.** Klíč vyrobený při odeslání je při každém pokusu jiný, takže
   timeout, který přijde *po* doručení dat, vyrobí druhý záznam a nikdo si toho nevšimne. Celý
   KONTRAKT §3 na tom stojí: server vynucuje unikát na `clientRecordingId` v rámci uživatele.
2. **U času je duplicita neviditelná.** Do Tabidoo teče **týdenní souhrn** (R10) — neobjeví se druhý
   řádek, jen tiše stoupne číslo, které jde přes sklad do mzdových nákladů projektů v HR, táborech,
   rozpočtech a CFO.
3. **Klíč vyrobený při startu přežije pád.** Pád mezi startem a odesláním je běžný stav (zavřené víko,
   restart) a je to přesně okamžik, kdy se klíč nesmí vyrobit znovu.
4. **Jeden klíč spojuje tři místa** — jméno souborů na disku (`main.cjs:477-478`), manifest a položku
   fronty. Žádná další tabulka není potřeba.

**Co se stane při opakovaném odeslání:**

| Krok | Chování | Kde |
|---|---|---|
| Zařazení do fronty | `enqueueRecording` vrátí `{ added: false, item: existing }`. Dvojí zařazení je neškodné — obnova po pádu ho smí dělat naslepo | `queue.js:126-129` |
| Založení nahrávky | Server vrátí `409` s existujícím záznamem. **Není to chyba** — klient pokračuje s vráceným `recordingId`. 🔴 Dnešní fronta by `409` odbavila jako selhání a spotřebovala pokus | KONTRAKT §5 |
| Části stopy | Opakovaný `Content-Range` je idempotentní. Zdrojem pravdy o došlých bajtech je **server**: `applyServerProgress` offsety přepisuje, nepřičítá | `queue.js:157-171`, KONTRAKT §3 |
| Uzavření | `complete` ověří součet bajtů a `sha256` proti tomu, co klient ohlásil při založení. Opakované `complete` na už uzavřené nahrávce musí vrátit **tentýž výsledek**, ne chybu | KONTRAKT §3 |
| Časový záznam | Opakované odeslání s týmž `trackingId` nesmí vyrobit druhý řádek ani posunout existující | 🔴 **v žádném kontraktu to zatím není** — viz níž |

⚠️ **Idempotence času nemá kde být zapsaná.** `KONTRAKT.md` §1 výslovně říká, že vykázaný čas přes něj
neteče, a serverová cesta pro čas neexistuje (N1: „zatím nikam“). Dokud nevznikne, vynucuje `trackingId`
jen **adaptér** — a to je lokální slib, ne záruka. Do doby, než pravidlo drží databáze (B4/B12), je
ochrana peněz na tomhle jednom místě.

---

## Předpoklady, na kterých to stojí

- Zadání říká, že atomický zápis chunku je dnes 'temp -> fsync -> rename -> fsync adresáře, viz electron/queue.cjs'. Ověřil jsem kód a NENÍ to tak: ten vzorec patří souboru FRONTY (queue.cjs:36-67) a manifestu (manifest.js:132-150, tam bez fsync adresáře). Zvukový chunk se append-uje do otevřeného handle a fsyncuje (main.cjs:560-578) — rename tam nemá co dělat, protože soubor roste. Napsal jsem to podle kódu, ne podle zadání, a rozdíl jsem v textu pojmenoval.
- Sekce jsem očísloval jako §5 a §6, tedy na konec plan.md za '4. Co se v noci nesmí'. Pokud se vloží jinam (logicky patří hned za §1 Architecture Spine), je nutné přečíslovat.
- Čísla pro dvouhodinovou nahrávku (7 200 chunků a fsync na stopu, ≈115 MB/stopa, ≈230 MB/schůzka) jsem DOPOČÍTAL ze zdrojových konstant v repu (timeslice 1000 ms na RecordingCard.jsx:8, 128 000 bit/s na RecordingCard.jsx:145). Není to měření a v textu je to takto označené.
- Struktura záznamu časovače (trackingId, projectId, startedAt, state, deviceId) a pořadí 'nejdřív fronta, pak stav' u stopu jsou MŮJ NÁVRH — electron/tracking.cjs neexistuje a plan.md ho jen jmenuje. Zvolil jsem to pořadí proto, že obě selhání dorovná obnova a duplicitu ustojí klíč.
- Odklad prvního pokusu fronty po probuzení (5 s) a automatické odhlášení sdíleného zařízení po nečinnosti (30 min) jsou návrhy bez měření — v textu označené jako (návrh).
- 'Zkusit teď' jen nuluje nextAttemptAt a probouzí pumpu je moje rozhodnutí o mechanice; design má tlačítko, ale chování nikde popsané není. Alternativa (tlačítko spouští vlastní průchod) by potřebovala druhý zámek, proto jsem ji zavrhl.
- Pravidlo, že SENDING nalezené po restartu se překlápí na WAITING bez dalšího započtení pokusu, je můj návrh do B7 — dnešní queue.js tenhle stav po restartu neřeší vůbec.
- Předpokládám, že spánek notebooku se do vykázaného času POČÍTÁ (stěnový čas od startedAt). Vyplývá to z M21 ('čas se nikdy tiše nesmaže ani tiše nezapočítá' ⇒ dotaz místo korekce), ale výslovně to nikde rozhodnuté není — viz otázka pro Dana.

## Otázky na Dana

- Počítá se spánek notebooku do vykázaného času? Napsal jsem, že ano (měří se stěnový čas od startedAt) a že se aplikace nanejvýš zeptá 'byl jsi pryč?', nikdy nekoriguje tiše. Když má být opak, mění to pravidlo měření, ne text.
- Idempotenci ČASOVÉHO záznamu nemá dnes kdo vynutit: KONTRAKT.md §1 říká, že čas přes něj neteče, a serverová cesta neexistuje (N1). Do doby, než pravidlo drží databáze (B4/B12), stojí ochrana proti dvojímu započtení hodin jen na lokálním adaptéru. Má to takhle jít do v1, nebo má vzniknout druhý kontrakt pro čas hned teď?
- Když adaptér neumí odpovědět, jestli už uživateli běží časovač na jiném zařízení, navrhl jsem: řekni to a start pusť (překryv se ukáže na webu). Druhá možnost je start odmítnout. Vybral jsem pustit, protože zablokovaný start znamená chybějící hodiny, což je horší než překryv — potvrzuješ?
- Sdílená zasedačka v1 NEMĚŘÍ čas (nemá komu ho připsat). Souhlas? Je to jediné místo, kde jsem sdílenému účtu ubral funkci.
- Zapomenuté odhlášení na zasedačce řeším jen automatickým odhlášením po nečinnosti — návrh 30 minut, nikdo to neměřil. Jaká hodnota?
- Manifest se zapisuje bez fsync adresáře (manifest.js:132-150), na rozdíl od fronty. Po tvrdém pádu stroje může rename zmizet i u zapsaného souboru. Mám z toho udělat samostatný úkol v DAG, nebo to jde jako součást B7?
