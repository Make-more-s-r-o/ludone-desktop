# Co čeká na Dana — LuDone Desktop

**Přerovnáno 7. 9. 2026.** Soubor měl 58 sekcí a 1870 řádků od 24. srpna; většina už byla
vyřízená, ale nebylo to poznat. 🔴 **Tři položky, které vypadaly otevřeně, jsem ověřil
a byly dávno hotové** — CI je zelené, `ui-smoke` opravený (#72), kalendář ze zdrojáku pryč.
Historie se nemaže, přestěhovala se do [`DAN-TODO-archiv.md`](DAN-TODO-archiv.md).

**Níž je jen to, co je opravdu otevřené. Nic z toho neblokuje vývoj.**

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

## 11. 🔴 Codex je do 13. 9. mimo — vyčerpaný limit ChatGPT účtu

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

## 15. Tři drobnosti z auditu, které nikdo neopravil

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
