# Návrh sekce: audit-redaction

**NEZMRAZENO.** Vzniklo 1. 9. 2026 ve workflow `doplneni-masterplanu`. Skeptická revize
leží v `revize-*.md` vedle a **našla v těchhle sekcích nepravdivá tvrzení** — do `spec.md`
ani `plan.md` se to proto nevkládá celé. Co z toho už platí, je v `spec.md` §11.

---

## ČÁST A — do `spec.md`

> Vložit jako **`## 11. Redaction`** za dosavadní §10. Kdo ji vloží jinam, přečísluje.

---

## 11. Redaction

Aplikace nahrává hlasy lidí, kteří o ní nevědí (přijaté riziko A1), a běží na cizím Macu.
Log, export diagnostiky a chybová hláška jsou tři místa, kde obsah schůzky **opouští**
chráněný adresář nahrávek a putuje dál — do Slacku, do e-mailu, do issue. Tahle sekce říká,
co tam nikdy nesmí být, co se zapíše místo toho, a jak se to vynutí.

### 11.1 Kde pravidlo platí

Pět povrchů. Pravidlo je stejné na všech.

| # | Povrch | Poznámka |
|---|---|---|
| P1 | Soubor s logem | Dnes neexistuje — viz `plan.md` §5 |
| P2 | Export diagnostiky | Tlačítko v Nastavení → Diagnostika (schválený design, sekce 04) |
| P3 | Text chyby, který vidí uživatel | Včetně tooltipu ikony v liště a textu oznámení |
| P4 | Název souboru a název adresáře | Dnes `<časová značka>-<8 znaků GUID>-<stopa>.webm` (`electron/main.cjs:434,478`) — vyhovuje |
| P5 | Crash dump | Breakpad je vypnutý (`electron/main.cjs:195`). **Je to rozhodnutí, ne náhoda:** dump procesu, který drží zvukový buffer, by nesl zvuk |

### 11.2 Co nikdy ven, a co místo toho

| Nikdy | Kde by to vzniklo | Místo toho |
|---|---|---|
| **Zvuk** v jakékoli podobě — WebM, PCM, `Blob`, `Buffer`, base64, dataURI | Chyba zápisu chunku, dump stavu rekordéru | `bytes` a `sha256` stopy (obojí už kontraktní údaj, `electron/main.cjs:447,613`) |
| **Token** — `access_token`, `refresh_token`, `code`, `code_verifier`, `client_secret`, hlavička `Authorization`, obsah `safeStorage` blobu | Auth cesta, obnova, odhlášení | Kód chyby z výčtu (`invalid_grant`, `access_denied`) a relativní platnost (`vyprší za 12 min`). Nikdy hodnota, nikdy prefix hodnoty |
| **E-mail, jméno, jméno počítače** | Panel po přihlášení, `client_name` posílaný serveru, `os.hostname()`, absolutní cesta `/Users/<jméno>/…` | `userId` jako GUID. Cesty zkracovat na `~/…` nebo jen na jméno souboru |
| **Název schůzky** — `label` z pole při zastavení | Manifest, fronta, potvrzení odeslání | `clientRecordingId` (GUID) + délka v minutách + `projectId` (GUID) |
| **Název okna nebo obrazovky** z `desktopCapturer` | 🔴 Dnes se **loguje** (`electron/main.cjs:419` píše `sources[0].name`) | `screenCount` a index vybraného zdroje. Nic víc |
| **Název projektu, firmy, alokace** | Výběr projektu, časovač | `projectId` jako GUID (pravidlo R6) |
| **Hodinová sazba, částka, mzdový náklad** | Nikde — klient je nezná (R8) | Nic. Kdyby se objevily v logu, znamená to, že je klient drží, a to je vada, ne log |

⚠️ **Jméno počítače je past.** Schválený design ukazuje v Nastavení řádek
„Zařízení — MacBook Pro — Dan". Ten řetězec nese jméno člověka. Do exportu diagnostiky proto
**nepatří**, i když ho panel zobrazuje; na server jde jako `client_name` kvůli odhlášení
konkrétního Macu, což je jiná cesta a jiné pravidlo.

### 11.3 Identifikátory

- Identifikátor v logu a v exportu je vždy **celý GUID**, nikdy zkrácený. Zkrácení na osm znaků
  je sice čitelnější, ale záznam pak nejde dohledat, a diagnostika bez dohledatelnosti je papír.
- Identifikátor se **nikdy neukazuje uživateli** v běžné hlášce — spec §7 zakazuje technický šum
  v textu, který vidí člověk. Cesta k němu je tlačítko „Zkopírovat podrobnosti" u chyby.
- `error.stack` patří do logu (se zkrácenou cestou), **nikdy do UI**.

### 11.4 Export se skládá z allowlistu, ne z blocklistu

🔴 **Tohle je jediné pravidlo, které stárne dobře.** Blocklist chrání jen před poli, která už
někdo pojmenoval; první nové pole s citlivým obsahem projde. Export proto **vyjmenovává, co do
něj patří**, a všechno ostatní ignoruje. Přidání pole do stavu aplikace ho do exportu nedostane.

Obsah exportu vyjmenovává `plan.md` §5.4.

### 11.5 Co redaction neřeší

Samotné soubory `.webm` obsahují zvuk z podstaty. Chrání je práva `0600`, adresář `0700`
(`electron/main.cjs:475-499`) a retence 7 dní (R19) — **ne redakce**. Redakce začíná tam, kde
se o nahrávce něco *píše*.

### 11.6 Jak se to vynutí

Bez testu je tahle sekce přání. Šest bodů, poměr červené : zelené odpovídá `plan.md` §3.

| # | Test | Co chytne |
|---|---|---|
| **RD-1** | Jednotkový nad redigujícím zapisovatelem: `Buffer`, `Uint8Array`, `Blob` a `ArrayBuffer` v libovolné hloubce zanoření vyjdou jako `[binární data <N> B]` | Zvuk vyteklý dumpem objektu |
| **RD-2** | Jednotkový: klíče `label`, `name`, `title`, `email`, `hostname`, `access_token`, `refresh_token`, `code`, `code_verifier`, `authorization` vyjdou jako `[redigováno]` — porovnání názvu klíče bez ohledu na velikost písmen a v každé úrovni zanoření | Přímý únik pojmenovaným polem |
| **RD-3** | Statický nad zdrojem: v `electron/**` a `src/**` **není žádné přímé volání `console.*`** mimo jediný modul loggeru. Doplněno pravidlem `no-console` v ESLintu | Obejití redakce zapsáním rovnou na stderr — dnešní stav je 11 takových volání |
| **RD-4** | Nad exportem: sestav stav, kde `label = "Porada provozu"`, `email = "dan.jirotka@makemore.cz"`, `access_token = "ya29.TESTOVACI"` a jméno zařízení `"MacBook Pro — Dan"`. Výstup **žádný z těch čtyř řetězců neobsahuje** a přitom obsahuje `clientRecordingId` | Únik jakoukoli ze čtyř zakázaných tříd |
| **RD-5** | Nad allowlistem: přidej do stavu **nové, dosud neznámé pole** s citlivou hodnotou. V exportu **není** | Blocklistové myšlení. Tenhle test padne u každé implementace, která jen filtruje známé názvy |
| **RD-6** | 🟢 Musí zůstat zelené: v exportu **jsou** verze, kód chyby, GUID nahrávky, GUID projektu, délka v minutách a počet pokusů fronty | Přeredigování na nepoužitelnost. Diagnostika, ze které se nic nedozvíš, je stejná vada jako diagnostika, která prozradí schůzku |

**Sabotáž (povinná, `plan.md` §3 bod 3):** odstraň redakční filtr z cesty zápisu.
**RD-4 a RD-5 musí zčervenat**, RD-6 zůstat zelený. Doslovný výpis do PR.

**Co testy nechytnou, a je poctivé to napsat:** nechytnou citlivý obsah vložený do **hodnoty**
pole, které je na allowlistu — třeba když někdo předá název schůzky jako `errorCode`. Proti
tomu stojí jen review diffu (§3 bod 5) a to, že `ev` je uzavřený výčet kódů událostí, ne volný
text.

### 11.7 Dnešní porušení

| Kde | Co |
|---|---|
| `electron/main.cjs:419` | Loguje název zdroje obrazovky. Měření z `docs/ux/cesta-uzivatele-2026-09-01.md` ukazuje, že názvy oken nesou předmět e-mailu, jméno PDF v Náhledu nebo skladbu ve Spotify — tedy přesně obsah, kterému se tahle sekce brání. **Vada, ne chování.** |
| `electron/main.cjs` × 11 | Volání `console.*` mimo jakoukoli redakci (změřeno 1. 9. 2026). Jsou to všechno dnes neškodné řetězce kromě řádku 419 — ale je to cesta, kudy příští únik projde bez odporu |

---

## ČÁST B — do `plan.md`

> Vložit jako **`## 5. Audit a observability`** za §4. Součástí jsou dva doplňky do §1 a §2,
> vyznačené jako podnadpisy — ty patří do svých původních sekcí.

---

## 5. Audit a observability

Desktop je offline-first aplikace na cizím počítači. **Serverový log neexistuje a v této vlně
existovat nebude** (S1) — jediný zdroj pravdy o tom, co se u kolegy stalo, je to, co si appka
zapsala sama, a to, co z toho umí vyexportovat. Zároveň tudy tečou peníze: časový záznam se
přes týdenní souhrn propíše do mzdových nákladů projektu, a duplicita tam **není vidět**
(pravidlo R10).

### 5.0 Stav dneška (změřeno 1. 9. 2026)

| Zjištění | Důkaz |
|---|---|
| Žádný soubor s logem nevzniká | `app.setAppLogsPath` se volá jen když je nastavená `LUDONE_DATA_DIR`, tedy pouze v testech — `electron/main.cjs:170-190` |
| 11 volání `console.*` píše na stderr | `grep -rnE "console\.(log\|error\|warn\|info)" electron src` |
| U appky spuštěné z Finderu ten stderr nikdo nenajde | Plyne z předchozího |
| Diagnostika a „O aplikaci" neexistují | `docs/ux/inventar-povrchu-2026-09-01.md`, položka B10 |
| Crash dumpy jsou vypnuté | `electron/main.cjs:195` |

**Závěr:** dnes nejde zjistit vůbec nic. Když kolegovi něco nefunguje, jediný nástroj je
telefonát.

### 5.1 Doplněk do §1 — Hranice modulů

| Modul | Vlastní | Nesmí |
|---|---|---|
| `electron/log.cjs` *(nový)* | zápis, redakci, rotaci, sestavení exportu | znát obsah nahrávky, sahat na síť, volat renderer |

**Jediný modul, který smí volat `console.*`.** Všechno ostatní loguje přes něj — jinak je
redakce (spec §11) obejitelná jednou řádkou.

### 5.2 Doplněk do §2 — Task DAG

| # | Úkol | Vykonavatel | Závisí | Blokuje |
|---|---|---|---|---|
| **B13** | Redigující logger `electron/log.cjs`, přesměrování 11 dnešních volání, oprava úniku názvu obrazovky na `main.cjs:419`, testy RD-1 až RD-6 + sabotáž | Codex | B3 | B14 |
| **B14** | Export diagnostiky: sestavení z allowlistu, náhled před uložením, obrazovka v Nastavení | Codex, **diff s peněžní částí čte Claude** | B13, B5, B7 | — |

B13 patří za B3, protože teprve po přesunu autority do hlavního procesu je jasné, kdo události
vlastní. B14 potřebuje B5 (časovač) a B7 (fronta) — bez nich není co exportovat.

### 5.3 Log: co, kam, jak dlouho

**Kam.** Jeden soubor na den v `app.getAppLogsPath()`, tedy
`~/Library/Logs/LuDone Desktop/desktop-<RRRR-MM-DD>.log`, práva `0600`. Standardní místo pro
macOS a Console.app ho umí otevřít bez našeho přičinění.

**Jak dlouho.** *Návrh:* **14 dní nebo 20 MB, co nastane dřív.** Není to 7 dní jako u nahrávek
(R19) schválně — kolega hlásí problém typicky až po víkendu a diagnostiku exportuje ještě
později; sedmidenní log by v té chvíli už neobsahoval den, kdy se to stalo. **Číslo není
rozhodnuté, čeká na Dana.**

**Formát.** Jeden řádek = jeden JSON s pevnými klíči:

```
{"ts":"2026-09-01T12:41:07.412Z","lvl":"info","mod":"recording","ev":"recording.track_lost",
 "clientRecordingId":"6f0c1d2e-8b44-4f6a-9c31-2ad5e0771a10","track":"system","elapsedSec":761}
```

`ts` je vždy UTC. `ev` je **uzavřený výčet kódů**, ne věta — jinak do logu doteče volný text
a s ním obsah schůzky. Zprávu pro člověka skládá až čtečka.

**Úrovně.** `error` · `warn` · `info` standardně. `debug` jen po zapnutí v Nastavení →
Diagnostika a *návrh:* **sám se vypne po 24 hodinách**, aby zapnutý debug netekl měsíce.

🔴 **Objem u dlouhé nahrávky.** Timeslice je 1 000 ms (`src/features/recording/RecordingCard.jsx:8`),
takže Danova dvouhodinová nahrávka znamená **7 200 chunků na stopu, 14 400 na obě**. Logovat
chunk po chunku je tedy vyloučené. Pravidlo: **v cestě, kudy teče zvuk, se loguje po intervalu,
ne po položce** — *návrh:* jeden souhrnný řádek za 60 s s počtem chunků a bajty za obě stopy.
Chunk se loguje jednotlivě jen tehdy, když **selže**.

**Události, které musí být v logu** (kódy `ev`, výčet se rozšiřuje jen se změnou téhle sekce):

| Oblast | Události |
|---|---|
| Životní cyklus | `app.start` (verze, build, architektura, verze macOS) · `app.quit` · `app.crash_recovered` |
| Přihlášení | `auth.begin` · `auth.done` · `auth.failed` (kód) · `auth.refresh` · `auth.revoked` · `auth.signed_out` |
| Oprávnění | `perm.state` při každém otevření panelu — mikrofon a systémový zvuk zvlášť |
| Nahrávání | `recording.start` · `recording.chunk_failed` · `recording.track_lost` · `recording.stop` · `recording.finalized` (stav `complete` / `incomplete`, bajty, `sha256`) |
| Fronta | `queue.enqueued` · `queue.attempt` · `queue.result` · `queue.permanent_failure` (kód) · `queue.gave_up` |
| Vypínače | `flag.state` při startu — `DESKTOP_UPLOAD_ENABLED` a `DESKTOP_TIME_ENABLED` zvlášť. Fail-closed stav se musí dát dokázat zpětně |
| Retence | `retention.deleted` (GUID, stáří, bajty) — po smazání souboru je to jediná stopa, že existoval |
| Čas | viz §5.4 |

### 5.4 🔴 Peníze: co musí jít zpětně zjistit

Otázka, na kterou tenhle log existuje: **„vznikl ten záznam kdy, a neodešel dvakrát?"**

**Klíč.** Každý časový záznam dostane `timeEntryId` (UUID) **při startu časovače**, ne při
odeslání (R10). Je to zároveň idempotenční klíč vůči serveru a zároveň klíč, podle kterého se
v logu spojí celý život záznamu.

**Povinné události, každá nese `timeEntryId`:**

| `ev` | Kdy | Nese navíc |
|---|---|---|
| `time.start` | klik na Spustit | `projectId` (GUID), `startedAt` (UTC, po ořezu na minuty dle R9), `observedAt` (skutečný okamžik kliknutí, sekundy) |
| `time.persist` | po atomickém zápisu na disk (story B5) | `ok` / kód chyby |
| `time.project_switch` | přepnutí za běhu (R11) | `fromProjectId`, `toProjectId` — obojí GUID |
| `time.stop` | klik na Stop | `endedAt`, `minutes` |
| `time.send_attempt` | každý pokus fronty | `attempt` (pořadí), `flagEnabled` |
| `time.send_result` | odpověď serveru | `httpStatus`, **`serverEntryId`** |
| `time.duplicate_rejected` | server vrátil `409` | `serverEntryId` toho existujícího záznamu. **Není to chyba** — kontrakt §5 to má jako správné chování po opakování |
| `time.day_summary` | *návrh:* jednou denně | minuty za den po projektech. Umožní porovnat, čemu věří appka, s tím, co je v LuTracku |

**`observedAt` vedle `startedAt` je schválně.** R9 ořezává start na celé minuty; když se ořez
někdy začne chovat jinak, než má, je rozdíl těch dvou hodnot jediné místo, kde to uvidíš.

🔴 **Do logu nikdy `rate`, `hourlyRate`, `amount`, `mzda`.** Klient sazbu nezná (R8). Kdyby se
v logu objevila, není to vada logu — je to důkaz, že ji klient drží.

**Jak se z toho pozná duplikát.** V exportu je tabulka **jeden řádek na `timeEntryId`**:

```
timeEntryId                            projectId                              od–do (UTC)     min  pokusů  serverEntryId
6f0c1d2e-8b44-4f6a-9c31-2ad5e0771a10   a91b7c33-0d1e-4a77-b210-58c4f9e6d204   06:55–12:11     316  2       e17c…9b
```

🔴 **Dva různé `serverEntryId` u jednoho `timeEntryId` znamenají duplikát na serveru.** Tohle je
jediné místo, kde ho vůbec uvidíš: do Tabidoo teče **týdenní souhrn**, takže dva záznamy po
316 minutách se sečtou do jednoho většího čísla a v mzdových nákladech projektu vypadají jako
poctivě odpracovaný den (R10).

**Poctivá výhrada k v1.** Desktop v této vlně **nikam neposílá** — `DESKTOP_TIME_ENABLED` je
vypnutý a serverová strana není v rozsahu (S1). Peněžní log je tedy v1 **auditem lokální fronty,
ne důkazem o serveru**. Skutečnou obranu proti duplicitě drží unikát nad idempotenčním klíčem na
serveru (kontrakt §3) a zámek v databázi (B12, stopka). Log je nástroj, jak duplikát **najít**,
ne jak mu zabránit.

### 5.5 Export diagnostiky

**Odkud.** Nastavení → Diagnostika → „Exportovat diagnostiku" (schválený design, sekce 04).
Design tam už má slíbeno: *„Textový soubor. Nikdy neobsahuje zvuk, přihlašovací údaje ani názvy
schůzek."* §5.6 je způsob, jak ten slib nezůstane textem na obrazovce.

**Co to je.** **Jeden textový soubor**, `ludone-diagnostika-<RRRR-MM-DD-HHmm>.txt`, uložený tam,
kam ho člověk uloží. Nikdy archiv, nikdy s přílohou, **nikdy s nahrávkou**.

**Obsah — allowlist, sedm sekcí a nic mimo ně:**

1. **Hlavička** — verze a build appky, architektura, verze macOS, čas exportu v UTC i místní,
   `userId` jako GUID.
2. **Oprávnění** — mikrofon a systémový zvuk, stav a čas posledního čtení.
3. **Vypínače** — `DESKTOP_UPLOAD_ENABLED`, `DESKTOP_TIME_ENABLED` a jak byla hodnota získaná
   (nastaveno / chybí → vypnuto).
4. **Fronta** — souhrn a jeden řádek na položku: GUID, typ (nahrávka / čas), stav, počet pokusů,
   poslední kód chyby, bajty, čas dalšího pokusu. Politika opakování je 30 s základ, strop 6 h,
   5 pokusů, rozptyl 20 % (`src/lib/queue.js:12-16`) — do exportu se vypíše, aby šlo poznat, jestli
   běží ta, kterou čekáme.
5. **Nahrávky na disku** — GUID, stav manifestu, délka v minutách, bajty a `sha256` obou stop,
   stáří. **Žádný název, žádná cesta s domovským adresářem.**
6. **Časové záznamy** — tabulka z §5.4.
7. **Log** — *návrh:* posledních **2 000 řádků**, už redigovaných.

Na konci souboru **věta o tom, co v něm není** — stejnými slovy, jaká jsou v Nastavení.
Člověk, který soubor posílá dál, má vidět, co posílá.

**Náhled před uložením** *(návrh)*: export se nejdřív ukáže v rolovacím okně a teprve pak se
ukládá. Diagnostika, kterou člověk pošle bez podívání, je diagnostika, které nevěří.

### 5.6 Jak se to vynutí

Testy RD-1 až RD-6 a jejich sabotáž popisuje `spec.md` §11.6 — jsou to zároveň brány story B13
a B14 a bez nich žádná z nich není hotová (§3 body 1–4).

Nad rámec redakce ještě dvě brány u peněz:

- **AU-1** — každá z osmi událostí `time.*` z §5.4 má test, že se zapíše, a že nese `timeEntryId`.
  Chybějící událost = díra v auditní stopě, kterou nikdo nenajde, dokud ji nepotřebuje.
- **AU-2** — nad připraveným logem, kde jeden `timeEntryId` má dva různé `serverEntryId`:
  export ten řádek **označí jako duplikát**. Sabotáž: odstraň porovnání, test musí zčervenat.

### 5.7 Co se v1 vědomě nedělá

Žádná telemetrie, žádné „phone home", žádný Sentry ani jiná služba sbírající chyby. Důvody dva:
nulový měsíční paušál je tvrdé kritérium (A2) a serverová strana neexistuje (S1). Diagnostika
odchází **jen tak, že ji člověk vědomě vyexportuje a pošle**.

Neřeší se ani vzdálený sběr ze sdíleného zařízení `zasedacka@makemore.cz` — u něj je logika
„čí to bylo" věcí story B10, ne logu.


---

## Předpoklady, na kterých to stojí

- Umístění sekcí: Redaction jsem napsal jako spec.md §11 (za dosavadní §10) a Audit a observability jako plan.md §5 (za §4). Kdo je vloží jinam, musí přečíslovat; obsah na číslech nezávisí, jen odkazy uvnitř bloku ('spec.md §11.6', 'plan.md §5.4').
- Čísla stories B13 a B14 předpokládají, že B12 je v plan.md §2 poslední. Kdyby mezitím přibyla jiná story, čísla se posunou.
- Název modulu 'electron/log.cjs' jsem zvolil podle dnešní konvence v electron/ (auth.cjs, queue.cjs, main.cjs, preload.cjs). Není nikde rozhodnutý.
- Retence logu 14 dní / 20 MB, náhled exportu, 2 000 řádků logu v exportu, souhrnný řádek po 60 s, auto-vypnutí debugu po 24 h a denní time.day_summary jsou MOJE NÁVRHY, v textu tak označené. Žádné z nich Dan nerozhodl.
- Formát logu jako JSON na řádek a 'ev' jako uzavřený výčet je návrh; volil jsem ho proto, že uzavřený výčet je jediná obrana proti volnému textu, kterým by do logu doteklo, co redakce zakazuje.
- Předpokládám, že 'identifikátory jen jako GUID' znamená CELÝ GUID (ne zkrácený), protože zkrácený identifikátor nejde v LuDone dohledat. Pokud Dan myslel jen 'ne názvy, ale ID', platí totéž.
- Předpokládám, že export diagnostiky je prostý text s pojmenovanými sekcemi, ne JSON — design říká 'Textový soubor'.
- Peněžní auditní stopa je v v1 nutně jen lokální: DESKTOP_TIME_ENABLED je vypnutý a server neexistuje (S1). Sekce 5.4 to říká naplno, ale je to předpoklad, ne měření.
- Neověřoval jsem naostro nic z toho, co jsem napsal — všechny odkazy na kód jsou statické čtení repozitáře k 1. 9. 2026 (grep + čtení souborů), žádný běh aplikace.
- Číslo 14 400 chunků za dvouhodinovou nahrávku je dopočet z RECORDING_TIMESLICE_MS = 1_000 (src/features/recording/RecordingCard.jsx:8), ne měření skutečné dvouhodinové nahrávky.

## Otázky na Dana

- Jak dlouho držet log? Navrhuji 14 dní nebo 20 MB (co nastane dřív) — schválně víc než 7denní retence nahrávek, protože kolega hlásí problém typicky až po víkendu. Srovnat na 7 dní, nebo nechat 14?
- Kudy se export diagnostiky posílá — Slack, e-mail, GitHub issue? Podle toho se rozhodne, jestli v něm smí být GUID uživatele a GUID projektů (jsou dohledatelné v LuDone, tedy pro cizího čtenáře nic, pro kolegu všechno).
- Smí být v exportu tabulka časových záznamů? Je to seznam projektů, na kterých člověk pracoval, s časy od–do. Pro diagnózu duplicit je nepostradatelná, ale kdo ji pošle kolegovi, prozradí mu svůj celý den. Alternativa: peněžní sekci exportovat jen na vyžádání zvláštním tlačítkem.
- Podrobný (debug) log — smí si ho zapnout každý uživatel sám v Nastavení, nebo jen ty? A má se sám vypnout po 24 hodinách, jak navrhuji?
- Když appka najde vlastní duplicitní odeslání času (dva různé serverEntryId u jednoho timeEntryId), má to jen zapsat do logu, nebo to má uživateli aktivně ukázat v panelu? Druhá varianta znamená obrazovku, kterou schválený design nemá.
- Distribuce přes veřejný GitHub (zvažuješ ji) mění tuhle sekci: veřejné issue znamená, že export diagnostiky může skončit na internetu. Máme allowlist stavět rovnou na tenhle horší případ, nebo počítat s tím, že exporty chodí jen interně?
