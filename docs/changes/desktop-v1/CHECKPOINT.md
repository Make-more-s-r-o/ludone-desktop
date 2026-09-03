# CHECKPOINT — LuDone Desktop

Poslední zápis: **3. 9. 2026, 10:40**. Psáno pro někoho s **prázdným kontextem** — konverzaci
sežere compaction, tenhle soubor ne.

---

## Stav jednou větou

Aplikace je **postavená celá**, ale **ověřená naostro skoro vůbec**. Chybí Danova rozhodnutí
a patnáct minut jeho času u počítače.

| | |
|---|---|
| `main` | `7432497`, **716 passed \| 3 skipped (719)**, čistý strom, **Electron 39.8.10** | 3 skipped (708)**, čistý strom, **Electron 39.8.10** | 4 skipped (658)**, čistý strom, **Electron 39.8.10** |
| otevřené PR | **0** · worktrees **0** · mergnuto 3. 9.: **#41–#56 (19 PR)** |
| design | **21 z 21** desktopových obrazovek stojí (22. je serverová) |
| repozitář | 🔴 **PRIVÁTNÍ** (vráceno 3. 9. ráno, důvod níž) |
| CI | běží na **vlastním runneru `danuv-mac`**, ne na hostovaném |


## ✅ HOTOVO 3. 9. — sedm PR (#41–#47)

| PR | co |
|---|---|
| #41 | čas nahrávání vedle ikony v liště |
| #42 | únik cest a názvů schůzek do chybových hlášek + latentní vada souběžného exportu |
| #43 | barvy sjednoceny na schválenou paletu (onboarding a Nastavení je dědily špatně) |
| #44 | ikona lišty překreslena glyfem z návrhu, generátor `npm run ikony` |
| #45 | Electron 37.3.1 → **39.8.10** + deklarované minimum macOS 12 |
| #46 | ořez názvu předávky podle **UTF-16 jednotek**, ne znaků (interop chyba se serverem) |
| #47 | **T1 rozmrazen**: barevná ikona pro obě lišty + pátý stav „nahrává + měří" |

🔴 **Tři poznatky, které tenhle den zaplatil** (a jsou v memory):
- **Čtvrtá příčina zelené sabotáže:** data na kulaté hranici, kde správná i vadná
  implementace dávají totéž. Léčba: lichá data, hodnoty těsně vedle prahu.
- **Úspěšná odpověď kanálu není důkaz o obsahu** — `openExternal` uspěje i u 404;
  `307 na /login` vrací i neexistující routa. Ověřuj proti ZNÁMÉ neexistující adrese.
- 🔴 **Codex v sandboxu nemá síť.** `npm install` mu selže na `ENOTFOUND`, ale
  `package.json` a lockfile se aktualizují — **zelené brány pak běží nad STAROU
  závislostí**. U každého upgradu balíčku si závislost doinstaluj a brány pusť SÁM.


## ✅ NASTAVENÍ SLADĚNO S NÁVRHEM (PR #50, #51)

Čtyři záložky **Účet · Zvuk · Záznamy · Diagnostika** podle `nahled.html:520–600`.
Přibylo: **Zařízení** · **Prostředí** (jen ke čtení) · přepínač **ikony v Docku** ·
**spouštění po přihlášení** · celá **Diagnostika** s exportem.

🔴 **Dvě věci, které se u toho vyřešily správně a stojí za zapamatování:**

1. **Export diagnostiky je pevný allowlist, ne serializace stavu.** V kódu záměrně není
   `JSON.stringify` ani spread — **nové pole ve stavu aplikace se do exportu samo nikdy
   nedostane**. Ověřeno mimo testy: do položky fronty nacpán token, název schůzky,
   absolutní cesta i tajemství → **do exportu neproniklo nic**.
2. **„Spojení se serverem" se NEMĚŘÍ HTTP dotazem.** Naše adresa vrací nepřihlášenému
   307 na `/login` — a **totéž vrací adresa, která neexistuje**. Místo falešné zelené
   fajfky se ukazuje **poslední potvrzené odeslání** (čas z uploadu, který server
   potvrdil jako `stored`). Historický důkaz, ne live health-check.

**Prostředí je zatím jen ke čtení.** Je to ale schválené místo pro přepínač labs × produkce,
který Dan chce — serverová session potvrdila, že labs žije, modul tam je (`enabled_envs =
{labs}` na obou DB, tedy na produkci schválně ne), Danův účet je tam admin a dynamickou
registraci klienta už umíme. **Zbývá jen přepnutí + odhlášení.**


## 🔴 TŘI VĚCI, KTERÉ TENHLE DEN NAUČIL O BRANÁCH

1. **Brána, která visí na detekci zapojení, je fail-open.** `it.runIf(odhlaseniZapojeno)`
   porazil obyčejný refaktor (`const logout = window.ludone?.logout` místo přímého volání) —
   funkce fungovala dál, ale **dva strážci tiše usnuli**. Oprava detekce nestačila; správné
   bylo **podmínku odebrat celou**, protože invariant byl o hlavním procesu.
2. **Assertion nad celým souborem skoro nic neměří.** `expect(kod).toContain("process.env.
   DESKTOP_TIME_ENABLED")` procházelo, i když ho `getTrackingStore` přestal číst — ten
   řetězec je v `main.cjs` na třech místech. Řešení: vyříznout blok funkce.
3. **Baseline musí být změřený stav, ne stav, jaký zrovna byl.** Nastavil jsem `preskocene`
   baseline na 4 bez auditu; jeden z těch čtyř uspával strážce R18. Po auditu **3**,
   každý pojmenovaný.

⇒ Vznikla z toho brána **`npm run preskocene`** (v `gates` i v CI): když přibude přeskočený
test, gates spadnou. Ověřeno tím, že jsem na ni pustil přesně tu dnešní regresi — chytla ji.

## ⚠️ CO ZPOMALILO BĚH (a jak to poznat příště)

Codexova úloha „vypadala zamrzle" 36 minut. **Nebyla to vada Codexu:** `uptime` ukázal
**load average 143**, protože Spotlight indexoval `node_modules` z deseti worktree
založených během dne (`fileproviderd` 100 %, osm `mdworker_shared`).

🔴 **Než z nehybného logu usoudíš na mrtvý job, spusť `uptime`.** Práce byla přitom hotová
na disku — převzal jsem ji, brány spustil sám a diff přečetl bez opory o Codexovo hlášení,
protože výstupní kontrakt nedopsal. Založena značka `~/orca/workspaces/.metadata_never_index`.


## ✅ FRONTA ZNÁ SVÉHO VLASTNÍKA (PR #56)

Nahrávka se odešle **jen pod účtem, který ji pořídil**. Cizí session → pauza, ne odeslání.
Nahrávka bez známého vlastníka (pořízená odhlášeně) **čeká na potvrzení člověkem** —
přiřadit ji prvnímu přihlášenému by zopakovalo přesně tu vadu, kvůli které úkol vznikl.

🔴 **Otisk je HMAC s tajemstvím per instalace**, ne holý sha256. Delegovaný běh sám přiznal,
že bez tajemství jde otisk uhodnout ze seznamu firemních e-mailů — doplněno při konsolidaci.
Tajemství leží **mimo frontu** (`nastaveni/fronta-vlastnik.json`, 0600), takže útočník
s kopií `outgoing.json` ho nemá. **Fail-closed:** bez tajemství se otisk neodvodí a položka
zůstane čekat; nikdy se nespadne zpátky na slabší variantu.

## 🛑 ZBÝVÁ — a většina čeká na někoho jiného

| co | na čem visí |
|---|---|
| tři stavy lišty (fronta · výpadek zvuku · bez spojení) | rozšíření `REPORTED_FACT_KEYS`, tedy zásah do kontraktu hlídaného 53 testy |
| obrazovka pro potvrzení nahrávky bez vlastníka | navazuje na #56, samostatný úkol |
| `DSK-F012` výběr projektu | **kontrakt fáze 2** od serverové session; práh 110 % je hodnota, ne rozhraní, a nesmí být u nás zadrátovaný |
| `DSK-F010` odeslání na server | fáze 2 |
| offline slib „nahrávat můžeš dál" | část vyřešena (#55 jednostopé, #56 vlastník); zbývá produktové rozhodnutí, co smí běžet před dokončeným onboardingem |

## 🛑 Zbývá — a nic z toho není samostatná práce

1. **Tři stavy lišty z návrhu** (čeká fronta · výpadek zvuku · bez spojení) — vyžadují
   rozšíření `REPORTED_FACT_KEYS`, tedy zásah do kontraktu, který hlídá 53 testů.
   Nedělat bez měření, co má být zdrojem každého faktu.
2. **Přepínač prostředí labs × produkce** — zadání hotové, serverová session potvrdila
   všechna fakta. **Dynamickou registraci klienta už umíme** (`registerPublicClient`),
   takže přepnutí = jiný origin + odhlášení. Připraveno k postavení.
3. `DSK-F012` výběr projektu — čeká na kontrakt fáze 2 (money, nehádat).

## 🔴 První příkazy po probuzení

```bash
cd /Users/dan/Dev/ClaudeCode/ludone-desktop
git fetch -q origin && git status --porcelain      # musí být prázdné
gh pr list                                          # musí být prázdné
gh api repos/Make-more-s-r-o/ludone-desktop/actions/runners --jq '.runners[].status'
```

⚠️ **Runner musí být `online`.** Repozitář je privátní, takže hostované minuty Actions jsou
vyčerpané a **brána běží výhradně na Danově Macu**. Když je Mac vypnutý, job **čeká ve frontě**
místo aby spadl — nevypadá to jako chyba, ale nic se nezměří.
Návrat na hostovaný runner je jednořádkový: `runs-on: ubuntu-latest` v `.github/workflows/ci.yml`.

---

## ✅ Co je ověřeno naostro (člověk to viděl běžet)

- 🔴 **Stereo export má oddělené kanály** — Dan 3. 9. přehrál soubor: vlevo mikrofon,
  vpravo ostatní zvuk. **Nejcennější ověření celého modulu**; rozdíl startů stop 4 ms.
- **`Cmd+Q` během nahrávání nahrávku neztratí** — Dan: „neukončila se hned".
- **Pojmenování, export a zařazení do fronty** projdou celou cestou.

- **Ikona v liště funguje.** Nebyla vidět, protože Danova lišta byla plná — ne kvůli vadě.
  `tray.getBounds()` přitom celou dobu hlásil nenulové rozměry; spor rozhodl až klik na
  hlášené souřadnice, který trefil aplikační menu.
- **Panel se otevře a odpovídá schválenému návrhu.**
- **`npm run gates:clean`** — brány nad čistým klonem, spuštěno a zelené.
- **Vlastní GitHub runner** — job na něm proběhl zeleně.

## 🧪 Co je postavené, ale nikdo to neviděl běžet

Prakticky všechno ostatní: stereo export · pojmenování schůzky · onboarding s testem záznamu ·
adresa přihlášení · výpadek ostatního zvuku · kontextové menu · hláška při plné liště ·
přibalená písma · balení a aktualizace · odesílací klient (vypnutý) · obnova při startu.

🔴 **Nejcennější věc, kterou může Dan udělat:** `docs/changes/desktop-v1/OVERENI-NAOSTRO.md`,
šest bodů na 15 minut. Body 1 a 2 (přehrát stereo nahrávku, odpojit sluchátka během nahrávání)
jsou vady, které se **projeví jen tichem**.

---


## ⚠️ ŽIVÝ ODKAZ, KTERÝ NIKDO NEPOTVRDIL (nalezeno 3. 9.)

`electron/recording-export.cjs:121` staví `new URL("/nahravky/nahrat", origin)` a po exportu
ji otevře v prohlížeči. **Serverová session 3. 9. napsala, že za existenci té routy pod tímhle
jménem NERUČÍ** — přitom v zadání, podle kterého se to stavělo, stálo „potvrzeno serverovou
session".

**Změřený dopad, kdyby routa neexistovala:**
- 🟢 nahrávka je v bezpečí — soubor je ve Stažených **před** otevřením odkazu, obě stopy zůstávají
- 🔴 **404 nepoznáme**: `openExternal` uspěje i u neexistující stránky. Ošetření chyby se
  spustí jen když selže otevření prohlížeče, ne když selže stránka. Uživatel vidí „hotovo"
  a rozbitou stránku.

**Čeká na skutečný seznam podstránek od serverové session.** Pak je to změna jednoho řádku —
cesta je schválně na jednom místě.

## 🔧 PŘEPÍNAČ PROSTŘEDÍ (labs × produkce) — zadání je hotové, staví se až po potvrzení

Dan 3. 9.: *„zprovoznit ten labs, teď mě odkazuje na app a tam ten modul není ještě."*

Povolený seznam v `resolveAuthIssuer` obsahuje **obojí**; chybí jen způsob, jak přepnout —
výchozí je natvrdo produkce. Dohodnuto se serverovou session:
1. přepínač v Nastavení, uložený lokálně, prostředí **viditelné v UI**
2. 🔴 **přepnutí ODHLÁSÍ** — token z jednoho prostředí nesmí přežít do druhého, jinak panel
   ukazuje odsud a odesílá tamhle a obojí vrací 200
3. handover URL se odvozuje ze **stejného** originu (už tak je)

**Text hlášky má vysvětlit dvě věci, které potvrdila serverová session z kódu:**
- modul je **záměrně jen na labs** (`enabled_envs = ['labs']`) — na produkci není schválně
- modul je **admin-only** (`allowed_roles` prázdné) — „přepnul jsem a je prázdno" má jinou
  příčinu než mrtvá adresa

## 🛑 Co čeká na Dana — nic z toho běh rozhodnout nesmí

Plné znění s doporučeními je v **`DAN-TODO.md`**, tady jen výčet:

| # | co | doporučení |
|---|---|---|
| **expozice** | popisy tří produkčních vad `ludone-app` byly ~10 h ve veřejném repu | **A — opravit ty vady** (jediné, co odstraní důvod, ne stopu) |
| **B5** | Electron **37.3.1**, opravy až v **39.8.10**; context-isolation bypass se nás týká | upgradovat na 39.8.10 **se živým ověřením**, ne rovnou na 44 |
| **B1** | Apple Developer — Individual × Organization (nepřechází se) | firma, pokud má D-U-N-S |
| **B2** | barva hlavního tlačítka: panel modrý, onboarding zelený | sjednotit na modrou; ukázka `progress/barva-tlacitka.html` |
| **B3** | allowlist vydavatelů v `main.cjs` brání jiným instalacím | uzavřený výčet, ale z konfigurace instalace |

---

## 🔴 NÁVRH IKONU V LIŠTĚ PŘEDEPISUJE — dřívější zápis „glyf není určen" byl chybný

`design/navrh/Lista.dc.html` to má na řádcích 32–40, jen jsem to minule nenašel:

- **glyf** (ř. 35): `<path d="M4 18 L10 6 L14 14 L20 9">`, stroke 2.2, kulaté konce, viewBox 24 —
  tedy **klikatá čára / pulz**, ne dnešní terč.
- **odznak** (ř. 37): kolečko 7 px s 1.5px obrysem v barvě lišty, posunuté doprava dolů —
  nese DRUHOU agendu, když běží obě.
- **popisek** (ř. 40): čas, tabulární číslice — ✅ **hotovo, mergnuto PR #41**.
- **osm stavů** s barvou z palety: nepřihlášeno/bez spojení `subtle` · klid `text` ·
  nahrává `bad` · měří `ok` · fronta a výpadek `wait`.
- závěr návrhu doslova: *„Souběh potřebuje odznak, ne pátou ikonu. Barva nese hlavní
  agendu, odznak tu druhou — a stav nikdy nesmí záviset jen na barvě."*

🔴 **Překážka, kterou je nutné vyřešit, ne obejít:** `electron/main.cjs:308` volá
`image.setTemplateImage(true)`. **Šablonová ikona se na macOS kreslí jen z alfa kanálu —
barva se zahodí.** Barevné stavy tedy vyžadují nešablonový obrázek pro aktivní stavy.
Zjištěno měřením, ne odhadem.

⚠️ `design/approved.json` uvádí přesnou kresbu všech osmi stavů jako otevřenou otázku
úkolu **T1, který je ZMRAZENÝ**. Základní glyf ale nakreslený je — stavět podle něj
není vymýšlení.

## Zbylá práce, kterou běh může udělat sám

0. ~~**Glyf ikony**~~ — ✅ **hotovo, PR #44.** Generátor `npm run ikony` vyrábí PNG přímo
   ze souřadnic návrhu; brána hlídá i to, že opakované spuštění dá tytéž bajty.
   Původní zápis: 🔴 **Úzký záběr schválně:** jen překreslení
   čtyř existujících ikon pulzem z návrhu. Barva, odznak a pátý stav spadají pod
   **zmrazený T1** — běh ho nerozmrazil, rozhodnutí leží v `DAN-TODO.md`.

1. ~~**Syrové chyby souborového systému**~~ — ✅ **hotovo, PR #42.** Vlastní chyby dostaly
   třídu `RecordingExportUserError`; jen ta smí předat text uživateli. Při tom nalezena
   a opravena latentní vada: `finally` uvolňoval odkládací plochu i volání, které si
   export nikdy nezabralo — druhé kliknutí mohlo shodit první běžící export.

2. ~~**Barvy**~~ — ✅ **hotovo, PR #43.**

3. **Starý bod (ponechán pro kontext):** syrové chyby souborového systému — `electron/main.cjs`, funkce
   `exportCompletedRecording`, větev `catch`: `error.message` jde do hlášky uživateli
   a `error.stack` do logu. Systémová chyba (`ENOSPC`, `EACCES`) nese **absolutní cestu,
   ve které je i název schůzky**.
   ⚠️ **Zpřesněno měřením 3. 9.:** log je už v pořádku (`error.stack` se do něj nedostane),
   **uniká jen `error.message` do panelu**. Řeší běžící úloha `desktop-hlasky`.
   *Návrh:* rozlišit vlastní vyhozené chyby (nesou bezpečné české věty) od systémových
   podle `error.code` a ty nahradit obecnou hláškou podle kódu.

🔴 **Doložená samostatná práce DOŠLA.** Změřeno 3. 9.: `DSK-F012` (výběr projektu) čeká
na serverový kontrakt — je to **money cesta a desktop nesmí hádat pravidlo 110 %**;
`DSK-F010` (odeslání na server) je fáze 2. Obojí je vědomé, ne zapomenuté.
Kontrakt na alokace jsem si vyžádal od serverové session.

**Nevymýšlet práci.** Místo toho běží čtecí **audit odchylek od návrhu** — obrazovku po
obrazovce, každá odchylka s citací z návrhu i z kódu. Dvakrát měl Dan konkrétní pravdu
tam, kde jsem tvrdil hotovo (čas v liště, glyf ikony); tohle to má najít dřív než on.

---

## 🔴 Pravidla, která tenhle běh zaplatil vlastní kůží

- **Commituj PŘED sabotáží.** `git checkout -- .` nerozlišuje autora; **čtyřikrát** to
  smazalo právě napsaný test. Signál: `nothing to commit` po skutečné práci, nebo klesnuvší
  celkový počet testů.
- **Po každé mutaci ověř `grep -c`, že opravdu nastala.** Neproběhlá sabotáž je **nezměřeno**,
  ne zelená — a vypadá stejně jako obrana, která drží.
- **Zelená po sabotáži má tři příčiny:** slabý test · minutá sabotáž · invariant drží něco
  jiného. Jen první je nález.
- **Fixture ověř dřív, než obviníš kód.** Test bez `recordingsDirectory` odmítne všechno
  a projde, aniž cokoli měří.
- **Než z něčeho uděláš blocker, projdi `decisions.md`.** Jednou tam byl označen za vadu
  stav, který byl v našem vlastním rozhodnutí navržený.
- **Merguj jen při `CLEAN` a aspoň jedné položce kontrol.** `UNSTABLE` s prázdným seznamem
  není slabší zelená, je to nezměřeno.
- **Před zveřejněním repozitáře patří adversariální kolo PŘED, ne po.** Hledá se
  trojí: tajemství · infrastruktura · **popisy cizích slabin**.
