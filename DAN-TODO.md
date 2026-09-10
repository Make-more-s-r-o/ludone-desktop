# Co čeká na Dana — LuDone Desktop

**Přerovnáno 7. 9. 2026.** Soubor měl 58 sekcí a 1870 řádků od 24. srpna; většina už byla
vyřízená, ale nebylo to poznat. 🔴 **Tři položky, které vypadaly otevřeně, jsem ověřil
a byly dávno hotové** — CI je zelené, `ui-smoke` opravený (#72), kalendář ze zdrojáku pryč.
Historie se nemaže, přestěhovala se do [`DAN-TODO-archiv.md`](DAN-TODO-archiv.md).

**Níž je jen to, co je opravdu otevřené. Nic z toho neblokuje vývoj.**

---

## 🔴🔴 NEJVYŠŠÍ PRIORITA (10. 9. 2026 večer) — veřejné repo obsahuje návod na živé systémy

**Změřeno dnes na HEAD `d58e663`, ne převzato z auditu:** `gh repo view` → repo je
**PUBLIC** (`Make-more-s-r-o/ludone-desktop`). A v HEAD (ne jen v historii) leží čitelný
popis **otevřených děr v BĚŽÍCÍCH systémech Make more** — sekce 17 téhle přílohy (K1–K5,
ř. 508–530) a soubory `docs/changes/desktop-v1/OAUTH-CO-ZALOZIT.md`,
`SERVER-CO-POSTAVIT.md`, `DAN-TODO-archiv.md`:

- **K1** — kdokoli z internetu si proti `app.ludone.cz` založí trvalý neodvolatelný OAuth
  klient (přiložený funkční `curl` + změřený rate limit = návod, jak ho obejít)
- **K2** — scope `mcp:read` dovolí zápis, souhlas mluví jen o čtení → s K1 řetěz anonym → zápis do produkce
- **K3** — pět edge funkcí LuTracku `verify_jwt=false` na **money-path** (jmenovitě uvedené)
- **K4** — deaktivace uživatele neodvolá jeho klíče · **K5** — trvale veřejné upload prefixy

🔴 **Proč to píšu jako nové rozhodnutí, i když jsi zveřejnění schválil:** tvé rozhodnutí
publikovat (sekce 25, 9. 9.) vážilo **jen produkční IP a dvě mikrofonní nahrávky** a jeho
zdůvodnění („přístup chrání klíč, ne utajení adresy") je o adresách infrastruktury.
**Nikde v repu není záznam, že by rozhodnutí publikovat zvažovalo obsah K1–K5** — a to
nejsou adresy, ale hotový útočný playbook na živou autorizaci. Produkční IP `23.88.61.12`
je z HEAD pryč (zůstává v historii, cos přijal vědomě); tohle je jiná, nerozhodnutá věc.

**Co jsem NEUDĚLAL a proč:** viditelnost repa jsem **nepřepnul**. Reverzoval bych tím tvé
výslovné písemné rozhodnutí o disklozuře vlastních systémů firmy, a navíc private může
rozbít auto-update/CI, který právě testuješ. To je tvoje volba, ne moje.

**Doporučení + jednořádková oprava, až se probudíš** (private zastaví NOVÉ čtenáře, ale
nevytáhne zpět, co už je forknuté — audit zmiňoval 113 kopií starých PR; skutečná náprava
je oprava těch živých děr, na které jede serverová session):
```
gh repo edit Make-more-s-r-o/ludone-desktop --visibility private
```
Rozhodni: (a) private teď + redakce K1–K5 z HEAD než zase public, nebo (b) nechat public,
protože jsou to tvé vlastní systémy a bereš to. Serverová session mezitím opravuje ty živé díry.

**Druhá věc ze stejného auditu:** `dukazy/nahravani-2026-08-21/**/*-mikrofon.webm` jsou
**dvě skutečné 5s nahrávky pokoje** (trackované, veřejné), a `.gitignore:41` o nich tvrdí,
že jsou „pípání". Nikdo si je neposlechl. Buď smazat z HEAD, nebo potvrdit, že to bereš.

---

## 🔵 BEARER UPLOAD — kde to stojí (10. 9. 2026 v noci)

**Dedup stop: OBRANA JE HOTOVÁ A SPRÁVNÁ, nic neměním.** Bál jsem se díry, kde by server
sloučil dvě odeslání se shodným otiskem a klient by to nepoznal. Serverová session mi to
**doměřila v jejich kódu**: dedup podle otisku běží **jen při dokončení** (`/dokoncit`),
ne při zahájení. Naše kontrola `recording_replaced` (`electron/upload-client.cjs:672`) ho
chytá přesně tam. 🔴 A je to **jediná** obrana v celém řetězu, protože tvar odpovědi je pro
legitimní opakování a pro kolizi identický — držet ji, i až to server jednou opraví.
Kolize obsahu mezi dvěma stopami TÉŽE nahrávky navíc nemůže nastat, blokuje ji `identical_tracks`
kontrola před odesláním. (Serverová session má u sebe tuhle věc zapsanou jako otevřený nález z 8. 9. —
tichá ztráta jedné ze dvou obsahově shodných stop — čeká to na tvé rozhodnutí o datech/schématu na JEJICH straně.)

🔴 **ROZHODNUTÍ PRO TEBE — přepnutí scope na `nahravky:upload` má skrytou závislost.**
Plán byl přepnout přihlášení na samotný upload-scope. Změřil jsem (workflow), že to
**rozbije zjišťování identity**: stejný access token se dnes používá i pro MCP volání
`ludone_ping` (`electron/auth.cjs:354–424`), kterým se po přihlášení dohledá tvůj e-mail
a jméno. Upload-only token na to dostane `403 insufficient_scope`, chyba je odchycená, takže
se login nezhroutí — ale `identity.email`/`name` se **natrvalo uloží jako null**. Není to
závislost na serveru, je to náš vnitřní návrh. **Nepřepínám scope**, dokud nerozhodneš jak dál:
- (a) nechat přihlášení na `mcp:read` a upload-scope žádat zvlášť jen před odesláním (dva tokeny), nebo
- (b) nechat server vracet identitu i s upload-scope, nebo
- (c) vzít identitu z jiného zdroje než z access tokenu.

🔴 **Nová vrstva k tomu (10. 9. v noci, změřeno):** `identity.email` NENÍ jen popisek —
vstupuje do HMAC otisku vlastníka nahrávky (`electron/queue.cjs:75`), který se snímá **na
začátku nahrávání** (`main.cjs:1481,1519`) a při odeslání porovnává (`upload-client.cjs:394`,
`queue_owner_mismatch`). Chrání to před tím, aby si pozdější přihlášení přivlastnilo
anonymně pořízenou nahrávku. Důsledek: **náhradní zdroj identity MUSÍ dodat stabilní,
kanonizovatelný e-mail už v čase nahrávání**, ne až v odpovědi uploadu. Serverem doporučená
cesta 1 (e-mail v odpovědi zahájení uploadu) řeší zobrazení a otisk při přípravě odeslání,
ale **ne ten první snímek na začátku nahrávání** — tam by e-mail pořád chyběl a každá
nahrávka by se pauzla na `session_owner_unknown`. Buď musí e-mail zůstat dostupný už při
přihlášení (třeba claim čitelný přímo z tokenu / userinfo, ne přes MCP), nebo se vědomě mění
návrh otisku vlastníka. Řekl jsem to serverové session, ať cestu 1 nestaví s touhle dírou.
`identity.name` je bezpečně nahraditelný odkudkoli — jen avatar a text.

✅ **Rozhodnutí dosedlo (serverová session, 10. 9. v noci) — ráno je to na kývnutí, ne diskuse:**
doporučená cesta je **`userinfo` endpoint** (vrací jen e-mail/jméno/id, upload-only token na
něj smí, scope se nerozvolní). Claim přímo v tokenu **zamítnut věcně** — jejich tokeny jsou
neprůhledné řetězce ověřované proti DB, claim by měnil formát tokenu pro všechny klienty.
Staví to serverová session (nová autentizační routa, dnes v noci ne — nezreviewované by bylo
horší než nepostavené). **Přejímka:** `userinfo` musí vracet e-mail se **stabilní lokální
částí** (bytově stejnou mezi voláními) — náš otisk lowercasuje jen doménu, lokální část
nechává být, takže kolísání velikosti písmen v lokální části = falešný `queue_owner_mismatch`.
Přesný kanonizační kontrakt jsem jim poslal.

**Drobný latentní nález (nestavěl jsem, šetřím limit):** kdyby server někdy vrátil
`403 insufficient_scope`, fronta ho dnes bere jako běžné „čeká" a **zkouší donekonečna**
bez hlášky, že jde o vadu aplikace (`src/lib/queue.js:132–153` uzná jen tvar `*_owner_*`).
Je to dosažitelné až po přepnutí scope, takže to zatím nehoří — doporučená oprava, až padne rozhodnutí výš.

**Na labs to zatím není** — serverová session hlásí rozbitý `main` (zdvojený klíč), po opravě
tam půjde Bearer i oprava přepisu. Ozvou se jednou větou. Do té doby naostro nic nezkoušej,
protože přepínač Bearer je živý na produkci a na labs ještě ne — dostal bys jiné chování a nebyla by to vada.

---

## 🔴 JEDNO ROZHODNUTÍ O NÁVRHU, KTERÉ SI VZÍT NESMÍM

🔴 **OPRAVA MÉ DIAGNÓZY (4. 9. v noci):** tvoje „ikona není vidět" **NENÍ o kontrastu.**
Změřil jsem to naostro: macOS hlásí položku na x=806 z 1512 bodů, tedy **ve výřezu (notch)**,
a v tom místě je 7168 pixelů, ze kterých **ani jeden není jasnější než 32** — nekreslí se tam
nic. Soubory ikon jsou přitom v pořádku (94 a 323 neprůhledných pixelů). Vpravo pro ni
nezbylo místo, tak ji macOS položil pod výřez a nevykreslil.
**Návrh s tím počítal** (`nahled.html:674`): *„na přítomnost ikony v liště se nemá spoléhat —
schová ji notch nebo jiná aplikace"*, a schválená záchrana je **přepínač „Zobrazovat i ikonu
v Docku"**, který jsme nepostavili. Stavím ho. Rozhodovat nemusíš nic.

**Barevné ikony v liště propadají kontrastem na SVĚTLÉ liště.** To je *jiná* a pořád platná
věc (spočítaná, ne pozorovaná) — rozhodnutí níž stojí:

| barva | na bílé | na černé |
|---|---|---|
| korálová `oklch(0.75 0.14 34)` | 🔴 **2,35 : 1** | 8,94 : 1 |
| tyrkysová `oklch(0.78 0.11 178)` | 🔴 **1,91 : 1** | 11,01 : 1 |

Obě propadají i mírné hranici **3 : 1**. PR #64 opravil tvůj případ tím, že **klidové stavy
vrátil na šablonové** (macOS je tónuje sám podle skutečné lišty) — ale u **aktivních stavů**
`recording` a `tracking` zůstává barva z návrhu a **na světlé liště je špatně vidět**.

**Vlastní odstín jsem si nevymyslel** — rozešel by se se schváleným návrhem. Varianty:

| | co to znamená |
|---|---|
| **kontrastní obrys nebo halo** kolem ikony | barva zůstane, přidá se tenký obrys v barvě lišty; ikona se mírně „ztuční" |
| **přesunout barvu mimo ikonu** | ikona šablonová vždy, barvu nést v **textu vedle** (čas nahrávání je tam už dnes) |
| **obětovat barvu úplně** | šablonové i pro nahrávání; stav pozná jen tvar. Nejbezpečnější, nejchudší |

Jsou to všechno zásahy do schváleného návrhu, proto se ptám.


## 🟡 POZOROVÁNÍ K LUTRACKU (nesahal jsem na to, je to tvoje odložené rozhodnutí)

Pustil jsem měření času naostro a zastavil ho. Funguje, projekt si vybere, čas běží.
Po zastavení ale aplikace teprve řekne: **„Čas zastaven · uložení do LuTracku je ukázkové."**

Před spuštěním o tom **není ani slovo** — na kartě je jen „LuTrack / Spustit". Kdo si odměří
tři hodiny práce, dozví se až na konci, že se nikam neuložily. Je to táž třída vady, jakou
jsem dnes v noci opravoval u fronty („další pokus teď", který nikdy nepřijde).

**Neopravil jsem to,** protože `decisions.md` C3 říká *„LuTrack: jen příprava"* a M11 nechává
osud živého LuTracku **odložený na tebe**. Věta o ukázkovém uložení navíc není ve specifikaci
ani v návrhu — vznikla v kódu. Kdybych přesunul sdělení dopředu, rozhodoval bych o produktu.

**Doporučení, až na to dojde:** říct to **před** spuštěním, ne po zastavení.


## 🟡 POZOROVÁNÍ Z NAHRÁVÁNÍ NAOSTRO (6. 9.) — jedno rozhodnutí je tvoje

Prohnal jsem nahrávání živě s **podstrčeným syntetickým zvukem** (440 Hz mikrofon, 880 Hz
systém), abych ti nenahrával pokoj. Celý tok funguje: start · měřáky · souběh s LuTrackem ·
zastavení · pojmenování · export do Stažených · zařazení do fronty. Po sobě jsem uklidil,
fronta i složka nahrávek jsou přesně jako předtím (16 položek, 49 souborů).

**Co jsem NEROZHODL a nechávám tobě:** když se systémový zvuk nepodaří získat, aplikace
správně nabídne pokračovat jen s mikrofonem a panel to říká naplno („NAHRÁVÁ SE OMEZENĚ ·
Ostatní zvuk: ticho"). **Lišta ale v tu chvíli ukazuje obyčejné nahrávání** — `výpadekZvuku=false`.

Rozlišují se totiž dva stavy: `unavailable` (jen mikrofon, uživatel to přijal) a `lost`
(zvuk se získal a spadl uprostřed). Červený odznak v liště se rozsvítí jen u druhého.

- **Argument pro změnu:** návrh u toho stavu píše *„je to právě chvíle, kdy je panel zavřený"* —
  a při zavřeném panelu nemáš jak poznat, že se druhá strana nenahrává.
- **Argument proti:** uživatel na jednostopé nahrávání **výslovně kývl**, takže červený
  poplach by byl křik o něčem, co sám zvolil.

Je to produktové rozhodnutí o tom, kdy má lišta křičet — nesahal jsem na to. Kdyby ti to
mělo hrát roli, doporučuju **tichý odznak** místo červeného: informace bez poplachu.


## 🔴 JEDNO ROZHODNUTÍ Z AUDITU (6. 9.) — co znamená „přihlášen"

Audit našel a já ověřil: **po vypršení access tokenu panel dál hlásí „připojeno"** a Nastavení
zelené „Přihlášen", ačkoli nahrávací kontext už vrací `null`. Jsou to dvě různá pojetí:
`hasStoredAuthSession` kontroluje jen vydavatele, `recordingUploadContext` navíc `accessExpiresAt`.

**Neopravil jsem to sám**, protože odpověď je produktová:
- **a)** vypršelý token = odhlášen (uživatel projde přihlášením znovu), nebo
- **b)** zůstat „přihlášen" a nabídnout znovupřihlášení, až bude potřeba.

`spec.md` navíc už přiznává, že chybí samostatná obrazovka **„Přihlášení vypršelo"** — takže
tohle rozhodnutí se s ní potká. Doporučuju **(a)**: tvrdit „připojeno" o spojení, které
nefunguje, je táž nepoctivost jako „další pokus teď" u vypnutého odesílání.

Druhý vysoký nález (**odhlášení, které server neodvolal**) neřeším přes tebe — opravuju ho,
protože tam je správná odpověď jednoznačná: uživatel se to musí dozvědět.


## ✅ A2 VYŘEŠENO (7. 9. 2026) — Dan požádal o Apple Developer Program

Čeká se na schválení Applem. Tím padá blokátor osy `exposure`: dokud nebyl program, nemohl
vzniknout podepsaný build a **nic se nemohlo dostat k týmu**.

**Co dělám mezitím:** připravím celou podepisovací a notarizační cestu tak, aby po schválení
zbylo jen vložit certifikát — ne aby se to teprve začalo řešit. Certifikát ani Team ID
po tobě nechci, dokud nedorazí.


## 🔴 NÁLEZ K ROZHODNUTÍ — neplatná relace ti vezme Stop uprostřed nahrávání

Ověřeno na nezměněném `main`, není to novinka z mých změn: **když relace zneplatní během
nahrávání, panel schová ovládání nahrávání i frontu — ale nahrávání běží dál.**

**Slepá ulička to není:** pravý klik na ikonu v liště má „Ukončit nahrávání".
⚠️ Jenže ta ikona se ti schovává pod výřezem, takže záchrana visí na něčem, co nevidíš.

**Neopravil jsem to sám**, protože odpověď je produktová i bezpečnostní:
- **a)** běžící nahrávání má ovládání ponechat, i když relace vypršela (dokončit, co běží),
- **b)** neplatná relace má ovládání vzít (nikdo bez platné relace nemá sahat na data).

Doporučuju **(a)**: nahrávka už na disku vzniká, takže odepřením tlačítka Stop nic nechráníš —
jen znemožníš její řádné ukončení. A je to táž logika jako u „Jen uložit": nebrat uživateli
cestu ven z něčeho, co běží.

**Souvisí s tím moje odložené rozhodnutí R1** (vypršelý token = odhlášen). Nechal jsem ho
nepostavené právě proto, že by tenhle případ zhoršilo.


---

## 8. Ikona v liště — změřeno 7. 9., na tomhle monitoru je vidět

Nechal jsem appku běžet a změřil to systémem, ne odhadem: položka sedí na `{2610, 3}`
o velikosti `36 × 24` a ve výřezu jsou pixely od `29` do `250` — **kreslí se**. Přiložený
snímek: `docs/changes/desktop-v1/evidence/screenshots/2026-09-07-ikona-v-liste.png`.

⚠️ **Netvrdím tím, že tvůj problém neexistuje.** Měřeno na **externím 3440px monitoru bez
výřezu**, kde je vpravo místo; tvoje hlášení bylo o vestavěném displeji s notchem. To je
jiný případ a ten platí dál.

🔴 **Kontrast na SVĚTLÉ liště jsem NEMĚŘIL** — musel bych ti přepnout vzhled systému, a to
bez tvého svolení dělat nebudu. Tady byla lišta tmavá a bílá ikona na ní má kontrast dobrý.

---

## 9. Brány běží na tvém Macu — a moje první rada byla horší než odpověď v repu

🔴 **OPRAVA MÉ RADY (7. 9. večer).** Nabídl jsem ti „přesunout runner na GitHub-hosted
`macos-14`" a dodal, že se platí za minuty. **Sám `ci.yml` v komentáři říká něco lepšího:**

> *„Linux je pro tuhle bránu dost — nic macOS-specifického tu neběží a macOS runner se
> účtuje 10× dráž."*

⇒ Správná varianta tedy není macOS v cloudu, ale **`ubuntu-latest`** — desetkrát levnější
a pro tuhle bránu dostačující. Ptal jsem se tě dřív, než jsem si přečetl, co je zapsané.

**Proč to dnes běží na tvém Macu:** repozitář je od 3. 9. privátní, takže hostované runnery
spotřebovávají placené minuty, a ty jsou vyčerpané. Cena té volby je doložená: **commit
s pouhým Markdownem vyrobil 24 vypršení testů**, protože stroj měl `load 130`.

**Co jsem už udělal sám:** do `ci.yml` přibylo **rušení překonaných běhů**
(`concurrency` + `cancel-in-progress`). Když pushneš dvakrát rychle za sebou, starší běh se
zruší místo aby ti bral výkon, který zároveň měří. Žádnou kontrolu to neoslabuje.

**Zbývá tvoje volba mezi třemi:**
1. **Nechat na tvém Macu** a spoléhat na to, že si běhy hlídám (dnes to fungovalo).
2. **Spravit billing** a vrátit se na `ubuntu-latest` — podle komentáře v `ci.yml`
   jednořádková změna.
3. **Zveřejnit repozitář** → runnery zdarma. ⚠️ **Tohle nedělej bez adversariálního kola.**
   Minule byly deset hodin veřejné popisy tří živých produkčních vad; dnes je v repu
   `CHECKPOINT.md` o 1151 řádcích s dvaceti zmínkami o serveru a produkci. **Nabízím, že to
   projedu a vypíšu ti, co přesně by bylo vidět** — pak se rozhodneš.

## 10. Nahrávku ve Stažených si na vlastním Macu nepustíš dvojklikem

Změřeno 7. 9. na skutečném exportu z aplikace:

```
afinfo ~/Downloads/LuDone-2026-09-07T12-36-02-…webm
→ Fail: AudioFileOpenURL failed
```

Soubor je **WebM / Opus** — formát, který `MediaRecorder` dává a na kterém stojí oddělení
kanálů (BD-N35, a podle D28 je to naše jediná výhoda proti prohlížeči). Jenže **macOS ho
nativně neumí**: QuickTime ani Finder ho neotevřou, `ffprobe` navíc hlásí délku `N/A`
(to je u streamovaného WebM očekávané a je to popsané ve `vzorky/README.md`).

**Není to vada kódu.** Je to vlastnost, kterou jsme nikde nenapsali — uživatel čeká, že
záznam ve Stažených si pustí, a on se mu neotevře.

**Tři cesty, rozhodnutí je tvoje:**
1. **Nechat a říct to v UI** — u hlášky „Soubor … je uložený ve Stažených" dovětek, čím ho
   otevřít. Nejlevnější, nic se nerozbije.
2. **Převádět lokální kopii** (remux do `.m4a`/`.caf`) — uživatel dostane soubor, který mu Mac
   otevře. ⚠️ Chce to ffmpeg v balíčku (~30 MB) a **rozhodnutí, jestli převádět i stereo
   oddělení**, nebo mít dvě verze.
3. **Nechat být** — kdo si to chce poslechnout, jde na web LuDone.

🔴 **Sám to nestavím** — je to volba formátu a produktu, ne oprava.

### ⚠️ Netýká se to jen desktopu — je to JEDNO rozhodnutí pro obě strany

Serverová session si to ověřila u sebe a našla víc, než jsem viděl já:

```
afinfo …-mikrofon.webm            → Fail: AudioFileOpenURL failed
mdls -name kMDItemContentType …   → prázdné
```

macOS ten typ **ani nerozpozná**, nejen nepřehraje. A jejich modul Nahrávky má tlačítko
**„Stáhnout zvuk"** — takže **kdokoli si stáhne nahrávku z webu, dostane týž nezotvíratelný
soubor**. V prohlížeči se přehraje bez potíží, proto si toho dosud nikdo nevšiml.

⇒ **Rozhoduj to prosím pro obě cesty naráz** (desktop i web), ať uživatel nedostane dvě různé
odpovědi na tutéž věc. Tytéž tři možnosti platí pro obojí.


---

## ✅ VYŘEŠENO 7. 9. večer — ikona aplikace v Docku

Tvoje „ikona dole nic moc": `build.mac.icon` v manifestu **vůbec nebyl**, takže balíček
nesl výchozí `electron.icns`. Opraveno v #94 — glyf je **tentýž pulz jako v liště**,
vykreslený ve velkém ze sdílené geometrie, barvy z návrhu.

**Když v Docku pořád vidíš atom:** macOS si ikony balíčků cachuje. Pomůže `killall Dock`,
případně přesunout `.app` a vrátit zpět. Balíček samotný je ověřený —
`CFBundleIconFile = icon.icns`, soubor bajt za bajt shodný s vygenerovaným, žádný
`electron.icns` uvnitř.

⚠️ Kdybys měl skutečné logo (SVG nebo PNG 1024 px), je to lepší zdroj než odvozenina
z glyfu lišty — stačí ho dodat a ikonu z něj vyrobím.

---

## 11. ✅ VYŘEŠENO 8. 9. — Codex nebyl vyčerpaný, Orca ho tiše přepínala na cizí účet

🔴 **NEKUPUJ KREDITY.** Změřeno 8. 9. ve 3:30:

| konfigurace | účet | zkušební běh |
|---|---|---|
| `~/.codex` (výchozí) | **dan.jirotka@makemore.cz** | ✅ **„FUNGUJE"** |
| Orca `CODEX_HOME` | dan.jirotka@gmail.com | ❌ vyčerpáno do 13. 9. |

**Orca injektuje `CODEX_HOME`** do každého panelu podle `codex-pane-accounts.json`, který
mapuje worktree → accountId. Panel `ludone-desktop` má namapovaný **gmail účet**, a ten je
vyčerpaný. V `.zshrc` ani jinde ta proměnná není — přichází přímo v prostředí procesu.

⇒ **Celou noc 7./8. 9. jsem delegoval na účet bez kreditů, zatímco účet s kredity byl volný.**
Práci proto odedřeli Claude podagenti, dvakrát jim došel limit, a tobě jsem napsal, ať zvážíš
nákup kreditů. **Nic z toho nebylo potřeba.**

**Řešení, které jsem zavedl hned:** delegace z téhle session nastavují
`CODEX_HOME=/Users/dan/.codex` výslovně.

### ⚠️ Oprava mé rady (změřeno 8. 9. ve 3:42) — panel přemapovat NEMUSÍŠ

Napsal jsem ti, že *„Codex se musí pouštět mimo Orca panel, protože Orca si `CODEX_HOME`
přepíše po mně"*. **Není to doložené a beru to zpět.**

Ověření logu ukázalo, že běh **přes Orca panel vůbec nespadl**: `turn.completed`, **nula**
chyb, odpověď 32 kB. Můj monitor ho odepsal na `grep "usage limit"` — a ten řetězec byl
**citace z `DAN-TODO.md`**, který si Codex načetl jako podklad. Měřidlo souhlasilo a
neměřilo, co mělo.

⇒ **Nastavení `CODEX_HOME` v příkazu funguje i uvnitř Orca panelu.** Přemapování panelu je
tedy volitelné pohodlí, ne nutnost.

**Co platí dál** (změřeno dvakrát nezávisle, tohle se nemění):
- Orca mapuje tenhle worktree na `dan.jirotka@gmail.com`, který **je** vyčerpaný do 13. 9.
- `~/.codex` = `dan.jirotka@makemore.cz` **funguje**
- **kredity kupovat nemusíš**

**Co si z toho beru:** grep na řetězec v logu je fail-open na citaci. Selhání běhu se pozná
podle `turn.failed` / `"type":"error"`, ne podle toho, že se někde v logu vyskytlo slovo.

**Co můžeš udělat ty (nespěchá):** přemapovat panel v Orce na účet `makemore.cz`, ať to
platí i pro panely, které pouštíš ručně. Jinak bude Orca dál tiše sahat na gmail účet.

### Původní zápis (ponechán, ať je vidět, na čem stála špatná rada)

## 11b. Codex hlásil vyčerpaný limit — a proč to bylo zavádějící

Doslovná hláška z logu (7. 9. večer, oba běhy):

```
You've hit your usage limit. Visit https://chatgpt.com/codex/settings/usage
to purchase more credits or try again at Sep 13th, 2026 10:00 PM.
```

Codex nestihl ani otevřít zadání — přečetl jeden dokument a spadl. **Nic po něm na disku
nezbylo**, takže se nic nedokončuje ručně, jen se to pustí jinde.

🔴 **PŘEMĚŘENO 8. 9. ve 3:10** (řekls „codex obnovený, nasaď to"): **limit se NEOBNOVIL.**
Zkušební běh vrátil za 4 s **tutéž hlášku a totéž datum** — `Sep 13th, 2026 10:00 PM`.
Konfigurační chyba se vyloučila zvlášť (`--skip-git-repo-check`), jiné modely ani účty se
nezkoušely. Do 13. 9. tedy Codex opravdu nejede.

**Co to znamená pro tvoje pravidlo „delegace na Codex co nejvíc":** tenhle týden neplatí.
Router v `~/.claude/CLAUDE.md` posílá na Codex implementaci, refaktory, testy, migrace
i bulk editace — do 13. 9. to všechno spadne zpátky na Claude limit.

**Rozhodnutí je tvoje:**
1. **Dokoupit kredity** (odkaz výš) — router platí dál beze změny.
2. **Počkat do 13. 9.** a do té doby vědomě jet na Claude — dražší na Claude limit, ale funguje.
3. ~~**Zkusit jiný model.**~~ 🔴 **ZMĚŘENO 8. 9. ve 3:15 — nepomůže, tuhle možnost škrtám.**

   | model | výsledek | obnova |
   |---|---|---|
   | `gpt-6-astra` | vyčerpaný limit | 13. 9. 22:00 |
   | `gpt-5.6-sol` | **tentýž** limit | 13. 9. 22:00 |
   | `spark` | *„not supported when using Codex with a ChatGPT account"* | — (neběží z principu) |

   ⇒ **Strop je ÚČTOVÝ, ne modelový.** Přepnutí routeru na jiný model tedy nic nevyřeší
   a dřívější zápis, že „spark má vlastní bucket", je pro ChatGPT účet bezcenný.

Do rozhodnutí jedu variantu 2 — práci, která měla jít na Codex, dělám v Claude podagentech.

---

## 12. 🔴 Automatické aktualizace by tiše nefungovaly

Audit našel a ověřil: `package.json:59` má v `build.publish` položku s `private: false`.
Tím se pro stahování vybere **anonymní** `GitHubProvider` — jenže **repozitář je privátní**.

**Následek:** ani `latest-mac.yml`, ani DMG se nestáhne; GitHub vrátí **404** a chyba spadne
do `catch`, který ji jen zaloguje (`[updater] Kontrola aktualizace selhala`). Uživatel se
nedozví nic a **zůstane na staré verzi** — včetně bezpečnostních oprav.

⚠️ Dnes to nikoho netrápí, protože se nic nevydává. **Trápit to začne v den, kdy vydáš první
podepsaný build** — tedy až dorazí certifikát od Apple.

**Rozhodnutí je tvoje, protože každá cesta má cenu:**
1. **Zveřejnit repozitář** → anonymní provider začne fungovat. ⚠️ Nedělat bez adversariálního
   kola (viz bod 9) — je v něm popis vad a odkazy na server.
2. **Privátní feed s tokenem v aplikaci** → token je v `.app` balíčku, kdokoli si ho vytáhne.
   Musel by to být token jen pro čtení releasů a počítat s tím, že je fakticky veřejný.
3. **Vlastní feed mimo GitHub** (S3, vlastní server) → nejvíc práce, ale žádný token
   v aplikaci a žádné zveřejňování repozitáře.
4. **Vydávat ručně** a aktualizace zatím nepoužívat — pak ale ať to appka **řekne**,
   místo aby tiše selhávala.

🔴 **Sám to nestavím**, protože je to volba mezi zveřejněním kódu, tajemstvím v balíčku
a vlastní infrastrukturou — to není implementační detail.

---

## 13. Chybějící `LUDONE_OAUTH_CLIENT_ID` tiše zapne dynamickou registraci

`electron/main.cjs:3005` — `resolveAuthClientId` při chybějící hodnotě vrací `undefined`
a aplikace pak jde cestou dynamické registrace (`electron/auth.cjs:1046`). Je to **jediný
přepínač v repu, který při chybějící hodnotě akci POVOLÍ**; PR #52 tam původní `throw` smazal.

⚠️ **Není to obejití autorizace** a auditor to výslovně přiznal: allowlist hostitelů, PKCE
S256 i souhlas v prohlížeči platí dál. **A je to přesně ta cesta, díky které tvůj tým nemusí
nic dělat** — appka si klienta zaregistruje sama.

**Proč to sem přesto píšu:** ruší to důvod zapsaný v `decisions.md:42` („odvolatelná jedním
UPDATE") a rozhodnutí BD-N16, které **nikdo neodvolal**. Buď platí ta rozhodnutí, nebo
současné chování — obojí naráz ne.

**Nedělám s tím nic**, dokud neřekneš které. Doporučuju **ponechat současné chování** a
rozhodnutí přepsat: samoregistrace je pro tým bez správce lepší a bezpečnostní vlastnosti
zůstaly. Ale je to změna zapsaného rozhodnutí, takže patří tobě.

---

## 14. ✅ VYŘEŠENO (PR #100) — a nechal jsem tu viset zastaralý úkol

🔴 **Tenhle bod jsem napsal ve 23:37 a ve 23:49 ho sám vyřešil PR #100 — a TODO
neaktualizoval.** Čtyři hodiny tu na tebe čekal úkol, který byl hotový. Je to **přesně ta
vada, kterou jsem celou noc opravoval ve `spec.md`**: dokument stárne rychleji než kód,
a nejrychleji ze všech ten, který sám píšu.

`showPanel()` v běhové cestě `runTrackingMutation` **je v `main`**, akceptační podmínka
v `E9.sh` je rozdělená na quit i běhovou větev, obě sabotované zvlášť.

⚠️ **Co z bodu 14 platí dál:** `TrackingCard.jsx` je pořád atrapa a s opravou #100
nesouvisí — viz bod 15.

### Původní zápis (ponechán, ať je vidět, co se opravovalo)

## 14b. Opravuju vlastní tvrzení: PR #88 platil jen při ukončování aplikace

Napsal jsem ti, že *„zaznamenaný čas se při chybě fronty tiše ztrácel, teď tě appka zastaví"*.
**Platí to jen na cestě ukončování.**

`noteDeferredQuitFailure` (`electron/main.cjs`) začíná řádky
`const request = deferredQuitRequest; if (!request || request.committed) return;`
a `deferredQuitRequest` vzniká **jedině v `beginDeferredQuit()`**, tedy až při Cmd+Q.

⇒ Když zařazení do fronty selže **za běhu aplikace**, zůstane po tom jen `console.error`.
Žádný panel, žádné potvrzení — a `updateOutboundQueueTrayFact` se ani nezavolá, protože
je až za úspěšnou větví.

### ⚠️ Oprava mé vlastní korekce (změřeno o hodinu později)

Napsal jsem sem, že tutéž funkci volá i cesta **nahrávky**, takže tabulka z #88 byla
*„nejspíš nepravdivá v obou sloupcích"*. **To bylo přehnané a měřením se to vyvrátilo.**

Cesta nahrávky **tichá NENÍ**: `finishRecordingAndEnqueue` (`main.cjs:2346–2361`) volá
`noteDeferredQuitFailure`, ale **hned za ním bezpodmínečně `showPanel()`** (ř. 2358) a pak
`throw error` — takže `recording:finish` přes IPC odmítne a `RecordingCard.jsx:310–330` to
chytí a ukáže červenou hlášku *„Nahrávání bylo zastaveno kvůli chybě…"*. Je na to i zelený
test **bez quitu** (`queue-wiring.test.js:4041–4059`), který ověřuje, že panel vyskočí.

⇒ **Sloupec „nahrávka zastaví" držel.** Nepravdivý byl jen sloupec o čase — a to je přesně
to, co #88 měl opravit a opravil jen zčásti.

🔴 **Poučení pro mě:** korekci vlastní chyby je potřeba změřit stejně jako původní tvrzení.
Přehnaná sebekritika je taky nepřesnost — jen se hůř pozná, protože zní zodpovědně.

### A jedna věc navíc, která se u toho našla

`src/features/tracking/TrackingCard.jsx` **je pořád atrapa** — nevolá
`window.ludone.startTracking/stopTracking` vůbec. Takže i kdyby výsledek mutace chybu nesl,
**nemá ji kdo zobrazit**. Oprava hlavního procesu je tedy nutná, ale ne dostatečná; UI
časovače je zvlášť.

**Není to nová vada**, je to vada, kterou #88 měl opravit a neopravil celou. Zapisuju to
takhle naplno, protože jsem ti to ohlásil jako hotové.

**Co s tím:** dodělat běhovou cestu (ukázat panel toutéž cestou, jakou appka používá pro jiná
selhání) a rozšířit podmínku v `E9.sh`, ať měří **obě** větve. Je to práce na jedno kolo,
ne rozhodnutí — jen na ni došel limit.

---

## 15. ✅ VYŘEŠENO (PR #102) — tři drobnosti z auditu

- **Dva časové vypínače nemají společný zdroj pravdy.** `getTrackingStore()` si
  `DESKTOP_TIME_ENABLED` **memoizuje** při první konstrukci, `runTrackingMutation` ho čte
  **znovu při každé mutaci**. V produkci se prostředí za běhu nemění, takže to není živá
  vada — ale je to rozestup, který jednou někoho zmate.
- **Uploadový killswitch je hlídaný grepem přes názvy testů.** `E5` hledá v `queue.test.js`
  tři literály; přepsat tvrzení uvnitř těch testů a nechat řetězce na místě = brána zůstane
  zelená. Časový vypínač má nově měření **chování**, uploadový pořád jen měření **názvu**.
- **`switchTrackingProject` je vystavený most, který nikdo nevolá.** `TrackingCard.jsx`
  přepíná jen natvrdo psaný seznam v rendereru. Poznámka ¹⁵ ve `spec.md` přitom tvrdí,
  že ho UI používá.

✅ **Všechny tři opravené a sloučené 8. 9. 2026 jako PR #102**
(`orca/desktop-tri-drobnosti`, merge 03:38). ⚠️ Do 8. 9. 04:15 tu stálo „nepushnuto, čeká
na tebe" — **to už neplatilo a nic po tobě tenhle bod nechce**; je to stejný nedodělek,
jaký jsem tu nechal u bodu 14. Co se opravilo: (1) časový vypínač čte v `main.cjs` jediná funkce `timeTrackingKillswitch()`
a strážní test hlídá, že se čtenáři nerozdvojí; (2) uploadový vypínač má vedle grepu
i behaviorální sondu `scripts/akceptace/fronta-sondy.mjs` zapojenou do `E5` — změřeno, že
s vyprázdněnými testy a sabotovaným vypínačem zůstane grep zelený a spadne jedině sonda;
(3) poznámka ¹⁵ ve `spec.md` opravená — most **zůstává** (C3 „jen příprava"), lhal
dokument. Killswitche se nepřepínaly, `DESKTOP_TIME_ENABLED` zůstává vypnutý.

## 16. 🍎 Apple: členství zaplaceno — zbývají tři kroky k podepsanému buildu

**8. 9. 2026.** Dan zaplatil Apple Developer Program. Změřeno hned poté:
`security find-identity -v -p codesigning` → **`0 valid identities found`**.
🔴 **Zaplacené členství není certifikát.** Podepsat zatím nejde ničím.

Dobrá zpráva: **vydávací cesta v repu už existuje.** `.github/workflows/release-macos.yml`
se spouští na tagu `v*`, běží na `macos-14` a sám podepíše i notarizuje. Čeká na **pět
tajemství**, a všech pět dnes chybí:

| tajemství | co to je |
|---|---|
| `MAC_CSC_LINK` | certifikát `.p12` zakódovaný do base64 |
| `MAC_CSC_KEY_PASSWORD` | heslo k tomu `.p12` |
| `APPLE_API_KEY_P8` | obsah klíče App Store Connect (`.p8`) |
| `APPLE_API_KEY_ID` | ID toho klíče |
| `APPLE_API_ISSUER` | ID vydavatele |

### Krok 1 — certifikát „Developer ID Application"

Žádost už je vygenerovaná, aby se nemuselo klikat v Keychain Access:
**`~/LuDone-podpis/zadost.certSigningRequest`** (privátní klíč `klic.pem` leží vedle,
práva 600, složka 700).

🔴 **`klic.pem` nesmí nikdy do gitu, do promptu ani do chatu.** Kdo ho má, může podepisovat
jménem Make more.

1. `developer.apple.com/account/resources/certificates` → **+** → **Developer ID Application**
2. nahrát `zadost.certSigningRequest`, stáhnout vydaný `.cer` do `~/LuDone-podpis/`
3. složit `.p12` (řekni a udělám to za tebe — je to jeden příkaz `openssl pkcs12 -export`),
   zvolit heslo
4. `MAC_CSC_LINK` = `base64 -i cert.p12`, `MAC_CSC_KEY_PASSWORD` = to heslo

### Krok 2 — klíč pro notarizaci

`appstoreconnect.apple.com/access/integrations/api` → **+** → role **Developer** → stáhnout
`.p8` (jde stáhnout **jen jednou**). Odtud `APPLE_API_KEY_P8`, `APPLE_API_KEY_ID`
a `APPLE_API_ISSUER`.

### Krok 3 — nahrát a otagovat

`gh secret set <jméno> < soubor` pro každé z pěti, pak `git tag v0.1.0 && git push --tags`.

⚠️ **Riziko, které se ukáže až u prvního tagu:** workflow běží na **`macos-14`**, tedy na
placeném GitHub runneru — a právě kvůli fakturaci se zbytek CI stěhoval na Danův Mac
(bod 9). Může to spadnout na účtování dřív než na podpisu. Pozná se to hned, ne po hodině.

⚠️ Na stroji **není Xcode**, jen command line tools. Pro tuhle cestu to stačí —
`notarytool` i `codesign` jsou v nich.

## 17. 🔴 Adversariální posudek našel OTEVŘENÉ díry v ŽIVÝCH systémech (ne v desktopu)

**8. 9. 2026.** Posudek vznikl kvůli otázce, jestli jde repo zveřejnit. Zveřejnění je mezitím
**mimo hru** (Dan zvolil vlastní server), ale posudek prošel 424 commitů a **našel něco, co
platí bez ohledu na to**: repo je podrobný bezpečnostní deník *cizích produkčních systémů*
a část těch popsaných děr je pořád otevřená.

🔴 **Tohle nejsou vady desktopu. Jsou to vady `ludone-app` a LuTracku, které jsme si sem
jen zapsali** — a zápis je starší než oprava.

| # | Co je otevřené | Kde je to popsané |
|---|---|---|
| **K1** | Kdokoli z internetu si může proti `app.ludone.cz` založit **trvalého OAuth klienta**. Repo k tomu má i změřený rate limit, tedy návod, jak ho obejít. | `OAUTH-CO-ZALOZIT.md` §4 |
| **K2** | `mcp:read` **dovolí tři mutace**, ale souhlasová obrazovka mluví jen o čtení. S K1 je to celý řetěz: založ klienta → nech si odsouhlasit „čtení" → zapisuj do produkce. | `SERVER-CO-POSTAVIT.md:90` |
| **K3** | Pět edge funkcí LuTracku má **`verify_jwt = false` bez náhradní kontroly**, jmenovitě `tabidoo-sync-weekly-summaries` a `auto-stop-timers`. Kdo zná project ref, spustí je zvenčí. `intent.md:50` k tomu dodává, že je to **money-path**. | 4 místa, mj. `DAN-TODO-archiv.md:799` |
| **K4** | Prázdný výběr nástrojů **vydá plný klíč**; deaktivace klíče neodvolá. | `DAN-TODO-archiv.md:358` |
| **K5** | Tři uploadové prefixy zůstávají veřejné, **adresy platí navždy, nejdou odvolat a nikdo neloguje, kdo je použil.** | `DAN-TODO-archiv.md` |

⚠️ **Rozhodnutí je tvoje, ne moje** — jsou to cizí systémy a já do nich nesahám. Ale K1+K2
je dohromady řetěz do produkčního zápisu a K3 je money-path. Nabízím předat to serverové
session, se kterou jsme dnes komunikovali.

### Co posudek NEnašel — ať to nevyzní hůř, než to je

Prošel **každý blob historie**, ne jen HEAD, dvaceti vzorky na tokeny a klíče a entropickým
skenem. **Nula použitelných tajemství.** Devatenáct zásahů byly testovací atrapy
(`HESLO-SENTINEL`, `APPLE-KLIC-SENTINEL`). Podpisový materiál Apple v repu vůbec není —
workflow ho čte z prostředí, píše do `$RUNNER_TEMP` s `umask 077` a má `persist-credentials: false`.
Žádná Slack ID, telefony, jména klientů, částky ani mzdy. Metodika, zvukový výzkum i design
jsou bezpečnostně netečné.

🔴 **Opravuji přitom vlastní starší zápis:** `DAN-TODO-archiv.md:465` doporučoval „přijmout,
nulová stopa by stála přepsání historie" a vyjmenovával „dva hostnames a tři cesty".
**Ve výčtu chybí veřejná IP produkčního stroje s účtem `root`**, která v historii je (3 soubory,
3 commity, odstraněná až commitem `a4529dd`). To je jiná kategorie než cesta k adresáři.
Dnes to nevadí, protože repo zůstává privátní — ale kdyby se zveřejnění někdy vrátilo na stůl,
**tenhle bod je ten drahý**, ne ty ostatní.

### Jedna věc k ověření uchem

`dukazy/nahravani-2026-08-21/` obsahuje dva pětisekundové `.webm` z mikrofonu. `.gitignore:41`
u nich píše „jsou to pípání, ne lidé". Naměřeno **−58 dB, tedy prakticky ticho** — obsahem to
nejspíš sedí. Ale **původem je to skutečný vestavěný mikrofon MacBooku, ne syntéza, a nikdo
si je neposlechl.** Je to na jedno poslechnutí.

## 18. ✅ Rozhodnuto samostatně 8. 9. — runner jako služba, nálezy předány

Dan řekl „dohlídej to, pracuj samostatně". Tři body, které visely, jsem rozhodl sám:

**CI runner je teď služba.** Ráno se stroj restartoval a runner nenaskočil — GitHub ho hlásil
`offline` a **každý PR by čekal ve frontě donekonečna**. Zaregistrován přes `svc.sh install`
jako `actions.runner.Make-more-s-r-o-ludone-desktop.danuv-mac`, po restartu naskočí sám.
Vrátit zpět jde `svc.sh uninstall`.

**Bezpečnostní nálezy K1–K5 předány serverové session** s výslovnou poznámkou, že jsou
**převzaté z naší dokumentace, tedy tvrzení, ne měření**, a že rozhodnutí je Danovo.
Není to externí komunikace — je to peer session na témž stroji, která ty systémy staví.

**Adresa serveru pro distribuci vyžádána** od téže session. Vymyslet ji za Dana nešlo:
v repu žádné místo pro statické soubory není a přístup má mimo repozitář.

### Co je připravené a čeká jen na tu adresu

Podepsané balíčky leží v `release/` (mimo git, `.gitignore` je pokrývá):
`LuDone Desktop-0.1.0-arm64.dmg` (106 MB) a `-x64.dmg` (112 MB), plus `.zip` k oběma.

Až adresa dorazí, zbývají tři kroky: přepnout `build.publish` na `provider: "generic"`,
**upravit `tests/packaging.test.js:150`** (asertuje přesnou hodnotu `provider: "github"`,
takže bez úpravy shodí každý push) a doplnit krok nahrání — 🔴 **`electron-builder` na
vlastní server sám nenahrává**, `--publish always` u `generic` mlčky neudělá nic.

## 19. 🟢 Podepsaná a notarizovaná aplikace existuje — 8. 9. 2026

**Balíčky leží v `release/`** (mimo git). Apple Silicon hotový, Intel zbývá.

| soubor | k čemu | stav |
|---|---|---|
| `LuDone-Desktop-0.1.0-arm64.dmg` (126 MB) | první instalace, tenhle odkaz jde kolegům | podepsaný, notarizace obalu dobíhá |
| `LuDone-Desktop-0.1.0-arm64.zip` (107 MB) | **tímhle se aplikace aktualizuje** | ✅ notarizovaný a přišitý |
| `latest-mac.yml` | podle něj aplikace pozná novou verzi | hotový, součet spočten ze souboru |

✅ **Rozhodující měření prošlo:** `spctl -a -t exec` na aplikaci vrátil
**`accepted · source=Notarized Developer ID`**. Tedy ne „soubor existuje" ani „certifikát je
nainstalovaný" — **spustí se i na Macu, který ji nikdy neviděl.**

### 🔴 Tři pasti, které stály čas a stojí za zapamatování

1. **Ověřil jsem `.app` a odeslal starý `.zip`.** `codesign --verify --deep --strict` řekl
   „valid on disk" — jenže Applu jsem podstrčil archiv z **předchozího dne**, vyrobený dřív,
   než jsme měli certifikát. Apple ho správně odmítl a já skoro hodinu hledal chybu v podpisu,
   který byl v pořádku. **Rozhodly časy souborů, ne obsah.** Zabitý build se k přebalení
   nikdy nedostal a v `release/` zůstaly staré soubory.
2. **Obal a obsah se notarizují zvlášť.** Aplikace uvnitř `.dmg` byla `accepted`, ale samotný
   `.dmg` `rejected`. macOS při stažení kontroluje **obal** — kdo změří jen jedno z toho,
   pošle kolegům balíček s varováním.
3. **Notarizace trvala 25 minut**, ne obvyklých 5–15. Zaseknuté to nebylo.

### Co zbývá

- **nahrát na `stahnout.ludone.cz`**, až serverová session potvrdí, že vhost běží
- **postavit intelovou verzi** — dnes nešlo, systém build dvakrát zabil kvůli paměti
- **doplnit krok nahrání** do vydávacího postupu: 🔴 `electron-builder` na vlastní server
  **sám nenahrává**, u `provider: generic` se `--publish always` mlčky vrátí

⚠️ Staré nepodepsané artefakty jsou odložené v `release/zastarale-pred-podpisem/`.
**Nerozesílat je** — jsou z doby před certifikátem.

## 20. 🔴 Dvě nezapsané vady v odesílání — nalezeny 8. 9. při Danově otázce

Dan se zeptal „nahrává se to teda?". Odpověď je **ne** (viz níž), ale při měření vypadly dvě
vady, které v `decisions.md` ani nikde jinde zapsané **nebyly**.

### A) Údaj o zdrojích zvuku umí jen prohlížečová cesta

`declaredCaptureSources` vkládá do adresy `electron/recording-export.cjs:185` — tedy
**prohlížečová** noha. V `initPayload` nativního klienta (`electron/upload-client.cjs:472`)
to pole **není vůbec**.

⇒ Kdyby se `DESKTOP_UPLOAD_ENABLED` zapnul, nativní upload by u serveru skončil s prázdnou
hodnotou. Celá včerejší práce serverové session (D36c–D36e) by se té cesty netýkala.

🔴 **Neopravuji to**, protože rozhodnutí **D29** zní *„nestavět proti němu nic, ani za vypnutým
killswitchem"* a týká se právě `DSK-F010`. Doplnit jedno pole je pět minut, ale je to stavba
na funkci, kterou jsi zastavil — a to je tvoje rozhodnutí, ne moje.

### B) Jedna schůzka, dva identifikátory ⇒ dva záznamy

Táž nahrávka leží **současně** ve frontě i ve Stažených, a každá cesta pro ni používá jiný klíč:

| cesta | co pošle |
|---|---|
| prohlížeč | syrové `manifest.clientRecordingId` (`recording-export.cjs:305`) |
| nativní klient | odvozené UUID z `deriveUploadIdentity` (`upload-client.cjs:176`) |

⇒ Serverová idempotence je **nespojí**. Kdo nahraje přes prohlížeč a později se zapne
killswitch, dostane ze **stejné schůzky dva záznamy**. To je rozhodnutí o kontraktu se
serverem, ne oprava na jeden řádek — patří serverové session a tobě.

### Proč odesílání dnes nefunguje — tři brány, každá sama stačí

1. **Killswitch je vypnutý** a v zabalené `.app` z Finderu **ho zapnout nejde** — je to
   proměnná prostředí a `.app` dědí prostředí launchd, ne shellu.
2. **Scope `mcp:upload` na serveru neexistuje** (D29). Náš klient si o něj neumí ani říct —
   `auth.cjs:31` povoluje jen `mcp:read` a `mcp:draft`.
   ⚠️ Nativní cesta by tedy poslala `Bearer` s `mcp:read` na zapisující endpoint. **Jak by
   server odpověděl, nikdo nezměřil.**
3. **Obrazovka pro potvrzení nahrávky bez vlastníka není postavená.** Nahrávka pořízená
   odhlášeně skončí jako `queue_owner_unknown` a čeká na člověka, který nemá kam kliknout.

✅ **Nahrávky se ale neztrácejí.** Při vypnutém killswitchi zůstane položka ve stavu `ceka`
a retence maže **výhradně už odeslané** (`electron/retention.cjs:257`).

### Co dnes zažiješ v zabalené aplikaci

Zastavíš nahrávání → dostaneš formulář s názvem → „Uložit a odeslat" zkopíruje soubor do
Stažených a otevře prohlížeč. 🔴 **Na produkci se ale modul nahrávek nezobrazí** — má
`enabled_envs = {labs}`. Panel přesto hlásí úspěch, protože `openExternal` uspěje i u prázdné
stránky. Musel bys v Nastavení přepnout prostředí na labs, což tě odhlásí.

## 21. 🔴 Kontrakt na upload je změřený — `mcp:upload` se stavět NEBUDE

**8. 9. 2026, odpověď serverové session.** Zásadní obrat proti tomu, co jsem předpokládal.

**Uploadové routy `Authorization: Bearer` vůbec nečtou.** Jedou výhradně na next-auth session
(cookie), a `middleware.ts` v jejich repu **není**, takže Bearer nikdo nepřekládá ani o patro
výš. Ověření OAuth tokenu žije jen v `/api/mcp`.

⇒ Postavit `mcp:upload` by neznamenalo přidat konstantu, ale **otevřít novou autentizační
větev na zapisující cestě**. Odmítli to věcně a souhlasím: při ověřování mých nálezů jim
vyšlo, že **registrace OAuth klienta je otevřená komukoli z internetu** (K1 potvrzeno)
a klienta **nejde odvolat** — `revoked_at` nikdo v jejich `src/` nenastavuje.

### Rozhodnutý kontrakt

| věc | jak to je |
|---|---|
| **autentizace** | jako prohlížeč — držet cookie, volat tytéž čtyři routy jako prohlížečová noha |
| **identita** | posílat `manifest.clientRecordingId` z OBOU cest; naše odvozené UUID zůstává interní |
| **idempotence** | klíč je dvojice `(uploaded_by, client_upload_id)`; druhý init vrátí 200 + `idempotent: true` |
| 🔴 **401** | znamená **„tudy cesta nevede"**, NE „vypršel token". Fronta na něj nesmí zkoušet obnovu, jinak se točí donekonečna |
| **409** | `idempotency_conflict` = tentýž klíč od jiného uživatele. Obrana, ne vada |
| **`declaredCaptureSources`** | volitelné pole INITu, fail-soft, ale **přísný allowlist klíčů** — nic navíc neposílat |

### Dvě opravy mých dřívějších tvrzení

⚠️ **Modul UŽ NENÍ labs-only.** Dnes přepnut na `{labs,prod}`, přepínače na produkci zapnuté,
crony ověřené. Psal jsem Danovi, že na produkci uvidí prázdno — **to už neplatí**.
🔴 Jejich seed `module-policies.ts` přitom pořád říká `ENVS_LABS`. **Není to rozpor, pravda je
živá DB** — kdo přečte jen soubor, dojde ke špatnému závěru.

⚠️ **Nález A byl menší, než jsem psal.** `declaredCaptureSources` není pole formuláře, ale
volitelné pole INITu — nativní klient ho může posílat hned, u serveru netřeba nic dostavovat.

### 🔴 Co jsem k tomu našel já a v kontraktu to nebylo

**Desktop by měl DVĚ nezávislá přihlášení.** Aplikace už přihlášená je (OAuth 2.1 + PKCE,
`DSK-F003`). Cookie by byla druhá identita a ty dvě o sobě nevědí:

- **Odhlášení by přestalo být odhlášením** — `logout()` revokuje OAuth token, cookie ne.
  Člověk uvidí odhlášený stav a upload pojede dál pod jeho účtem.
- **Můžou se rozejít na osobě** — u sdílené „zasedačky" hned.
- **Vypršení nepoznáme dopředu** — u cookie nevíme nic.

Navrhl jsem tři cesty a přikláním se k té, kde po přihlášení **ověříme shodu obou identit
a při rozporu upload zablokujeme**. Čeká na odpověď; přihlašovací část zatím nestavím.

### 21b. Kontrakt uzavřen — jak se desktop bude přihlašovat

**Serverová session, 8. 9. odpoledne.** Doplňuje bod 21; přihlašovací část je odblokovaná.

**Zvolena varianta „ověřit shodu, při rozporu blokovat"**, a serverová session ji vylepšila
o dvě věci, obě lepší než můj původní návrh:

1. 🔴 **Kontrola patří PŘED KAŽDÝ upload, ne jen po přihlášení.** Cookie a OAuth token
   vyprší nezávisle a v jinou chvíli; kontrola při startu by po hodině tvrdila něco,
   co už neplatí. (Tohle je přesně ta chyba, kterou v projektu potkávám pořád: změřím
   stav a chovám se, jako by platil navěky.)
2. **`logout()` zahodí i cookie** — trojka chrání před rozporem, tohle brání jeho vzniku.

⚠️ **Vydávat cookie výměnou za OAuth token** (moje varianta 2) **zamítnuto** — byl by to
další autentizační most, tedy přesně to, čemu jsme se u `mcp:upload` vyhnuli.

### 🔴 Tři pasti z jejich měření, které si musím zapsat do kódu

| past | proč je zákeřná |
|---|---|
| `GET /api/auth/session` **bez cookie vrací 200 s tělem `null`** | kdo testuje `res.ok`, dostane „přihlášen" pro nepřihlášeného. **Testovat OBSAH, ne status.** |
| **porovnávat se dá jen e-mailem** | na OAuth straně žádný `userinfo` neexistuje; identitu vrací jen MCP `ludone_ping` a `userId` v ní není. Není to náhražka — server drží obě identity na téže řádce `users` a sám to kontroluje |
| **odhlášený a revokovaný jsou k nerozeznání** | obojí 200 + `null`, liší se jen hlavičkou `Set-Cookie` |

⚠️ Čtvrtý stav: **při výpadku jejich DB** vrátí 200 s pravdivou identitou, ale `role: viewer`
a prázdnými právy. Pro porovnání identity použitelné, pro cokoli o oprávněních ne.
Proto z té odpovědi čtu **jen `email`** a nic jiného.

⚠️ **CORS není překážka** (v jejich aplikaci není jediná `Access-Control-*` hlavička) — ale
právě proto se cookie k cross-origin požadavku z rendereru **nepřipojí**. Půjdu cestou
hlavního procesu s ručně přiloženou cookie.

### Co se staví

1. `clientRecordingId` do nativního initu, odvozené UUID zůstává interní
2. `declaredCaptureSources` do nativního initu — jen ten klíč (přísný allowlist)
3. **401 jako NEOPAKOVATELNÁ třída** ve frontě — „vyžaduje člověka", ne „obnov token"
4. **ověření shody e-mailů před každým uploadem**, při rozporu blokovat
5. **`logout()` zahodí i cookie**
6. killswitch nastavitelný v zabalené aplikaci

Body 4 a 5 dostanou sabotáže navíc — tichá vada tam znamená „nahráno pod cizí účet".

## 22. 🔴 POTVRZENO: druhá stopa nahrávky se na serveru TIŠE ZTRÁCÍ

**8. 9. 2026 večer, doloženo serverovou session v jejím kódu s čísly řádků.** Není to teorie
a není to chyba v ošetření výjimky — **je to hlavní dopředná větev.**

Když mají obě stopy jedné schůzky **bitově stejný obsah** (nejtypičtěji ticho na obou):

1. init druhé stopy hledá jen podle `(uživatel, klíč)` — otisk v podmínce není ⇒ založí nový
   řádek a odpoví **201, „není to duplikát"**
2. při dokončení se ale hledá **výhradně podle `(uživatel, otisk)`** a najde první stopu
3. 🔴 **naše druhá stopa se označí za smazanou A JEJÍ SOUBOR SE FYZICKY SMAŽE**
4. odpověď: **HTTP 200, stav „uloženo", `recordingId` té PRVNÍ stopy**

Zamčeno jejich testem, který přímo očekává, že se vrátí **cizí** `recordingId`.

⇒ **Uživatel by viděl „hotovo" a měl v systému polovinu schůzky.** Naše kontrola
`verifyRemoteIdentity` to nechytí — porovnává velikost a otisk, a ty u kolize sedí.

### ✅ Dvě obrany, které stavím BEZ nich

1. **Porovnat otisky obou stop lokálně** ještě před prvním voláním na server. Oba se počítají
   v `preflightRecording`, takže je to jeden `if` na místě, kde jsou po ruce. (Codex staví.)
2. 🔴 **Porovnat `recordingId` z initu s tím, které přijde z dokončení.** Serverová session
   sama upozornila, že se v takovém případě **liší** — a že je to **detekovatelné u nás už
   dnes, bez jakékoli změny na jejich straně**. To je druhá, nezávislá obrana.

### 🔴 Rozhodnutí pro Dana — pole `track` NENÍ změna kontraktu, ale SCHÉMATU

Chtěl jsem po nich přidat do požadavku pole rozlišující stopu. Změřili to a:

- sloupec `track` v jejich tabulce **neexistuje**
- unikátní index `(sezení, stopa)`, o kterém mluví naše specifikace, **neexistuje** —
  ta věta popisuje záměr, ne jejich kód
- jediné pole pro druh zvuku je `declaredCaptureSources`, které povoluje jen `microphone`
  a `microphone+system` — hodnota pro **samotný systémový zvuk v katalogu není** a kontrola
  by ji odmítla; sémanticky navíc popisuje jednu nahrávku, ne stopu ve dvojici

⇒ **Přidat `track` znamená změnit jejich schéma.** To je Danovo rozhodnutí, ne dohoda dvou
session. Bez něj nemá jejich deduplikace jak poznat, že jde o **dvě legitimní stopy jedné
schůzky**, a ne o duplikát.

⚠️ **Propojení sezení proto zatím NESTAVÍM.** Kdybych ho postavil, obě stopy by šly pod jedním
sezením a server by je neměl podle čeho odlišit — dnešní stav (dvě samostatná sezení) je
ošklivý, ale funguje.

⚠️ Serverová session to **vědomě neopravuje dnes v noci**: deduplikace podle otisku je jejich
záměrný návrh a oprava mění chování nad uživatelskými daty. Souhlasím s tím.

## 23. Nahrávka bez systémového zvuku se nikdy neodeslala (opraveno, PR #111)

**Co bylo špatně:** když jsi nahrával bez povoleného systémového zvuku, aplikace nahrávku
korektně pořídila, zapsala manifest i zařadila do fronty — a upload ji pak shodil **trvalou**
chybou „Položka fronty nemá obě stopy". Trvalá znamená bez opakování: nahrávka by z počítače
nikdy neodešla a nikdo by se to nedozvěděl, protože ve frontě jen tiše zčervená.

**Příčina:** upload si sadu stop bral z konstanty `["microphone","system"]` místo ze samotné
položky. Podmínka, která na to měla myslet (`tracks.length > 1`), byla mrtvý kód — jednostopá
položka se k ní nikdy nedostala.

**Co po tobě chci:** až budeš mít podepsaný build, zkus nahrát schůzku **bez systémového zvuku**
(nepovolit sdílení zvuku obrazovky) a ověř, že položka ve frontě dojde do „odesláno". Zatím je
to ověřené jen testy, naostro to nikdo neproklikal.

## 24. Přihlašovací kontrakt doměřen — a opravil mi premisu (9. 9. 2026)

Serverová session odpověděla na tři otázky, na kterých stálo přihlášení pro upload. Dvě
potvrdila, u třetí ukázala, že **jsem se ptal na neexistující pole**.

**Cookie:** `__Secure-authjs.session-token` na https, ale **číst se musí OBĚ jména** —
i `authjs.session-token`, protože prefix závisí na protokolu v `NEXTAUTH_URL` a ten
z repozitáře určit nejde. Jejich vlastní proxy to řeší přesně takhle. Atributy jsou
z defaultu: `httpOnly`, `sameSite: lax`, `path: /`, `secure`. 🔴 **`domain` se nenastavuje**,
takže cookie je host-only — `labs.ludone.cz` a `app.ludone.cz` jsou **dvě nezávislé cookie**.
Session je JWT s platností 8 hodin.

**Identita — tady jsem se mýlil.** Můj bod 21b říkal „porovnávat e-mail". Změřili, že
`session.user.id` u nich **vůbec neexistuje** (není ani v typu) — kdo ho přečte, dostane
`undefined`, a to je přesně ta třída chyby, která se pozná až naostro. Číselný klíč se
jmenuje **`dbId`** a vlastnictví nahrávky klíčují právě jím (`uploaded_by = user:${dbId}`).
E-mail je unikátní **jen mezi živými řádky**: po soft-delete může tentýž e-mail dostat nový
řádek s jiným `dbId`. ⇒ **autorita je `dbId`, e-mail je druhá, lidsky čitelná kontrola.**

**Nepřihlášený stav:** potvrzeno 200 s tělem doslova `null`. Testovat OBSAH, ne status.
A 200 s `user` ještě neznamená „mám práva" — mají dvě fail-static větve, kdy přijde
pravdivá identita s `role: viewer` a prázdnými právy.

**Jednostopé nahrávky:** `/dokoncit` o stopách neví nic, `microphone` se nikde nechová
jinak než `microphone+system`, podmínku na dvě nahrávky v jednom sezení nenašli.
⇒ ostré doměření to neblokuje.

**Co z toho plyne pro nás:** klient dnes posílá `Authorization: Bearer`, tedy přesně to,
co uploadová routa nečte, a test to dokonce vynucuje. Přestavuje se to na cookie.

**Čeká na tebe:** až první ostrý pokus vrátí **503 `storage_disabled`**, není to naše chyba —
je to jejich killswitch a jeho polohu z repozitáře určit nejde. Poznáš to podle toho kódu.

## 25. Před zveřejněním: brány musí pryč z tvého Macu (9. 9. 2026)

Prověrka celé historie repozitáře (1 541 objektů, všechny větve) **nenašla jediné tajemství** —
žádný klíč, token ani `.env`. Rotovat není co.

🔴 **Zato našla něco, co nás oba nenapadlo: veřejný repozitář + brány běžící na tvém Macu
= kdokoli si na tvém notebooku spustí vlastní kód.** U veřejného repa může kdokoli udělat
fork, přidat do testů jeden soubor a otevřít pull request; ten se pak spustí na `danuv-mac`
pod tvým účtem. Vedle leží `~/LuDone-podpis/` (podpis jménem Make more), tvoje SSH klíče
včetně přístupu na produkci, 15 souborů s hesly a 19 dalších firemních repozitářů.

**Pořadí je proto závazné:** (1) serverová session zavře díru v `redirect_uris`,
(2) brány se přepnou na GitHub a runner se z Macu odregistruje, (3) teprve pak public.
Obráceně stačí pár minut.

**Tvoje rozhodnutí 9. 9.:** zveřejnit **včetně historie**. V ní zůstane adresa produkčního
serveru, `root`, cesty a jména kontejnerů — přístup to nikomu nedá (chrání ho klíč, ne
utajení adresy) a přepsat to stejně nejde: GitHub drží 113 kopií starých pull requestů,
kterých se force-push nedotkne.

**Zbylo na tebe jedno:** v `dukazy/nahravani-2026-08-21/` leží dvě pětisekundové nahrávky
ze skutečného mikrofonu v reálné místnosti. Změřené jsou jako ticho (−58 dB), ale **nikdo je
neposlechl** a `.gitignore` o nich nepravdivě tvrdí, že jsou to pípání. Dvakrát pět vteřin.

## 26. Proč aplikace nadělala šest přihlašovacích klientů (9. 9. 2026)

Serverová session našla v jejich DB **5 klientů na produkci a 1 na labs** jménem `LuDone
Desktop`, které nikdy nedostaly souhlas. Čtyři vznikly v noci mezi 23:55 a 4:05, tak jsem
se lekl, že se aplikace přihlašuje sama. **Nepřihlašuje** — v kódu není jediná automatická
cesta, přihlášení spustí výhradně klik.

Skutečná příčina je jinde a je to vada: **`client_id` se ukládá, ale při dalším přihlášení
se nikdy nepřečte.** Každý pokus proto registruje nového klienta — i ten úspěšný. A protože
registrace běží **dřív, než se otevře prohlížeč**, klient vznikne i tehdy, když prohlížeč
zavřeš nebo přihlášení zrušíš. Kdo dvakrát klikne „Zkusit znovu" a pak to vzdá, nadělá tři.

⚠️ **Vážnější než těch šest osiřelých klientů:** server po dvaceti registracích za hodinu
z jedné IP odpoví odmítnutím. V kanceláři za jedním připojením se to dá vyčerpat běžným
používáním — a přihlášení pak přestane fungovat všem.

Opravuju to: při novém přihlášení se použije uložený `client_id`, když sedí prostředí
a rozsah oprávnění.

## 27. Kde masterplán doopravdy stojí (změřeno 10. 9. 2026)

Prošel jsem všech 17 funkcí ze specifikace proti kódu, ne proti přehledu. **Hotových
a ověřených naostro je 6.** Když se čtou poznámky pod čarou, které u tří z nich část
ověření samy odvolávají, jsou to **3**. V produkci není ani jedna.

🔴 **Přehled `status.json` na několika místech lže** — je z 7. 9. a nezná PR #105–#117.
Pravdu má `spec.md` plus kód. Nejdůležitější rozpor: **blokátor kolem Applu už padl** —
aplikace je podepsaná, notarizovaná a ověřená po stažení, takže cesta do produkce
zavřená není, jen o tom přehled neví.

### Co drží nejvíc naráz

**Tvoje jedno slovo k uploadu odblokuje čtyři funkce** — odchozí frontu, odeslání nahrávky,
mazání kopií po sedmi dnech a část odhlášení. Nic jiného na nich nevisí.

### Tichý dluh, který nikde nefiguroval

- **Sdílené zařízení pro zasedačku** je napsané jako součást první verze a má **nula řádků
  kódu**. Nemá ani vlastní číslo funkce, takže v matici nikde není vidět. Největší dluh,
  který se našel.
- **Money pravidlo R22 není postavené.** Jméno souboru nahrávky nese jen zkrácený
  identifikátor; když se ztratí popisný soubor vedle něj, ztratí se i klíč a obnova vyrobí
  duplikát — přesně to, proti čemu celá ta ochrana stojí. Test, který se jmenuje po tom
  pravidle, měří něco jiného.
- **Zkratky v menu nic nespouštějí.** Popisky u položek jsou, obsluha ne. Slib bez krytí.
- **Časovač je atrapa a je vidět v panelu.** Mosty pro ukládání času nikdo nevolá; karta
  to teď aspoň říká dopředu.

### Co jde dělat hned, bez čekání na kohokoli

Zkratky (malá) · R22 (střední, money) · doměřit věci, které jsou hotové, ale nikdo je
neproklikal: klik na ikonu v liště, zkouška zvuku z Nastavení, oba systémové přepínače,
obnova tokenu (všechno drobné) · sladit zbylých 18 obrazovek s návrhem (velká) ·
sdílené zařízení (velká) · chybějící stavy panelu jako „Přihlášení vypršelo" a „Bez sítě".

### Co je vědomě zrušené a NENÍ dluh

Kalendář · připomínky · seznam účastníků · `mcp:upload` · dvě přihlášení pro uživatele ·
vydávání cookie výměnou za token · obrazovky aktualizace a odinstalování.

## 28. Kde se pokračuje, až budou limity (stav k 10. 9. 2026 večer)

**Zvuk funguje.** Ověřeno naostro: obě stopy, systémová −21 dB se špičkami −1,2 dB.
Příčina byla v systémovém záznamu oprávnění — macOS si u záznamu obrazovky pamatoval
otisk jednoho konkrétního sestavení místo podpisu, takže po každé nové verzi aplikaci
nepoznal. Smazáno a uděleno znovu; teď už si pamatuje podpis a má to vydržet.

**Odesílání na server:** serverová strana Bearer smergovala, ale **na labs to ještě není** —
jejich nasazení blokuje konflikt, který vznikl až složením dvou samostatně zelených PR.
Mají opravu, dají vědět.

### Co se má udělat, až se rozjedeme

1. **Klient uploadu** — přepnout na oprávnění `nahravky:upload` (žádá se samostatně, hotovo
   v PR #119) a doladit podle jejich postupu, který mají poslat. 🔴 Nestavět na volitelné
   velikosti části — server si ji podle všeho určuje sám.
2. **Tlačítko přepínače odesílání v Nastavení.** Dnes ho nikde neklikneš a je to záměr:
   postavená je jen vrstva pod ním (PR #114). Tlačítko je zásah do schváleného návrhu.
3. **Doměřit z pohledu klienta**, jestli obě stopy dorazily oddělené. Server to ze své
   strany nevidí a je to ta vada, která se neprojeví chybou — dvě stopy se slijí a odpověď
   je 200. Nepotřebuju k tomu přehrávat zvuk, stačí porovnat otisky.
4. **Přepsat pravidlo R22** — stojí na nepravdivé premise, ta duplikace není dosažitelná
   (obnova osiřelé stopy vůbec neskenuje). Místo něj do specu patří dvě skutečné vady:
   úklid nechává popisný soubor na disku navždy, a nechává tam i jednostopé nahrávky
   (druhá opravena v PR #120).
5. **Rozhodnutí o časovém přepínači** — dnes jde zapnout jen restartem aplikace, protože
   se hodnota zmrazí při prvním sestavení časovače.
