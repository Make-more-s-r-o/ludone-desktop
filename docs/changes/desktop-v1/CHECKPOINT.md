# CHECKPOINT — LuDone Desktop

Poslední zápis: **4. 9. 2026, 02:15**. Psáno pro někoho s **prázdným kontextem** — konverzaci
sežere compaction, tenhle soubor ne.

---

## 🔴 ŽIVÉ OVĚŘENÍ 4. 9. v noci — co našlo spuštění aplikace

Audit úplnosti sám přiznal, že **nespustil živý build**. Spustil jsem ho a řídil přes CDP
(`--remote-debugging-port=9333`). Recept: `scratchpad/ovladac.mjs` — připojí se na panel,
provede JS a udělá snímek. **Dva nálezy, oba doložené měřením, ne dojmem.**

### 1. Fronta slibuje pokus, který nikdy nepřijde ✅ HOTOVO — **PR #68 mergnut**

Panel ukazuje „16 čeká · 29,0 MB · **další pokus teď**" a tlačítko „Zkusit teď".
Odesílání je přitom vypnuté killswitchem `DESKTOP_UPLOAD_ENABLED` (spec.md:35 — tak to má být).

✅ **Ověřeno naostro PO opravě:** karta říká `29,0 MB · odesílání je vypnuté`
a tlačítko se u vypnutého odesílání vůbec nenabízí.

| měření | výsledek |
|---|---|
| klik na „Zkusit teď" přes CDP | **nestane se vůbec nic** — žádná hláška, žádná změna |
| log hlavního procesu | `[queue] odesílání je vypnuté` (2×) |
| `queue/outgoing.json` | všech 16 položek `attempts: 0` — pokus nikdy neproběhl |

Příčina: `queue:retry` ten výsledek **vrací**, ale `QueueCard.retryNow()` hlídá jen `catch`.
A `queue:list` (main.cjs:2322) vrací jen položky — karta nemá odkud vědět, že se odesílat nebude.
🔴 **Tohle je Danova stížnost „píše čeká, ale nejde na to kliknout".** Kliknout jde; nic se nestane.

### 2. ✅ HOTOVO — **PR #67 mergnut** · Ikona v liště se nekreslí — a moje dřívější diagnóza „kontrast" byla MIMO

| měření | výsledek |
|---|---|
| macOS Accessibility (`System Events`) | položka **existuje**: x=806, y=4, 36×24 bodů |
| `screencapture -R 796,0,56,32` | 7168 pixelů, **všechny RGB 32**, ani jeden jasnější než 100 |
| soubory ikon | v pořádku: 18×18 s 94 a 36×36 s 323 neprůhlednými pixely |
| `trayIsProbablyOutsideStatusArea` | `842 < 680` = **false** ⇒ pojistka mlčí |

Položka skončila **ve výřezu (notch)**, protože vpravo nezbylo místo. Práh 45 % míří na jiný
případ (odsun doleva); tenhle leží na 55,7 %.

✅ **Ověřeno naostro PO opravě:** `internal=true`, horní inset **34 bodů**, ikona `773+34`
⇒ funkce vrací **true**, a po restartu se **výstražné okno skutečně otevřelo** (CDP vidí cíl
`ludone://tray-warning/`). 🔴 Práh je 32 a naměřeno 34 — **rezerva jsou 2 body**. Kdyby to
bylo na jiném Macu těsné, snížit práh, NErozšiřovat pás.

🔴 **Návrh to předvídal jmenovitě** (`design/navrh/nahled.html:674`): *„na přítomnost ikony
v liště se nemá spoléhat — schová ji notch nebo jiná aplikace"*, a schválil záchranu:
přepínač **„Zobrazovat i ikonu v Docku"**. Ten JE postavený (`Settings.jsx:713`).

### 3. ✅ HOTOVO — **PR #69 mergnut** · Záchrana ležela za ikonou, kterou není vidět

`TraySpaceWarning.jsx` radí „ukonči jinou aplikaci" nebo „použij správce lišty" — ale
**nenabídne zapnutí ikony v Docku**, tedy vlastní schválenou záchranu. A do Nastavení, kde
přepínač je, se uživatel bez viditelné ikony **nedostane**. Kruh se uzavírá.
Okno teď umí ikonu v Docku **zapnout**. Dostalo **vlastní minimální preload** s jedinou
zmrazenou funkcí; nový kanál `tray-space-warning:enable-dock` nenese payload a přijme se jen
od odesílatele, který je zároveň webContents toho okna, jeho hlavní rám a **doslovná URL**
výstrahy. `settings:set-dock-visible` nedostal dalšího volajícího.

✅ **Ověřeno naostro celým řetězem:** po restartu se výstraha otevřela · klik na „Zapnout ikonu
v Docku" ji přepnul · okno potvrdilo *„Ikona v Docku je zapnutá"* · a **macOS potvrdil položku
v Docku** (`System Events` → proces Dock obsahuje `Electron`). Aplikace je tedy dosažitelná
i bez viditelné ikony v liště.

🔴 **PROVEDENO BEZ PTANÍ:** ikonu v Docku jsem na Danově instalaci **nechal zapnutou** —
jinak by ráno neměl aplikaci jak otevřít. Vypnout jde v Nastavení jedním přepnutím.

### Co živé ověření naopak VYVRÁTILO (abych to nehlásil jako vadu)

- **Prázdný panel pod obsahem** — můj vlastní artefakt vynucené výšky. Skutečné okno je
  366×239 a sedí na obsah přesně.
- **Malý terč patičky fronty** — `BUTTON.queue-status` měří **280×33**, dost velký.
- **Chybějící ikona jako taková** — ikona existuje, jen se nekreslí (viz výš).

### 4. ✅ HOTOVO — **PR #70 mergnut** · Tři vady v okně Nastavení

Otevřel jsem Nastavení v běžící aplikaci a proměřil je.

| vada | měření | stav |
|---|---|---|
| **„16 čekají"** místo „16 čeká" na kartách Záznamy i Diagnostika | dvojtvarové skloňování v `Settings.jsx:136`; čeština má tři tvary | ✅ `16 čeká` |
| karta Účet **opisovala e-mail** sama pod sebou | `getAuthIdentity()` vrací `name: null`, fallback dosadil e-mail | ✅ řádek se bez jména nekreslí |
| hodnoty se lámaly **uprostřed slova** | sloupec hodnoty **134 px** ve 448 px okně, `overflow-wrap: anywhere`; vinu nesl třetí sloupec mřížky s odznakem | ✅ **202 px, výška 14 px = jeden řádek** |

🔴 **Skloňování je vidět až od PĚTI položek** — při 2–4 dá dvojtvar náhodou správný výsledek.
Proto prošlo. Testy teď berou hranice 1 · 2 · 4 · 5 · 16. Pomocník `countLabel` je nově
sdílený (`src/lib/count-label.js`), dřív žil jen v panelu.

### LuTrack — pustil jsem ho naostro, NEOPRAVOVAL

Měření času funguje (projekt si vybere sám, čas běží, Stop zastaví). Po zastavení ale teprve
řekne *„uložení do LuTracku je ukázkové."* — **před spuštěním o tom není ani slovo**.
Je to táž třída vady jako fronta slibující pokus. **Nesahal jsem na to**: `decisions.md` C3
říká „LuTrack: jen příprava" a M11 nechává jeho osud **odložený na Dana**. Zapsáno v `DAN-TODO.md`.

### 5. ✅ HOTOVO — **PR #71 mergnut** · Devět hlášených zranitelností

Změřeno přes `dependabot/alerts`: **všech 9 bylo `development` scope** — 8× dev server Vite,
1× `extract-zip` v build nástrojích. Do zabalené aplikace se nedostane ani jedna (hotová
aplikace načítá `dist` a dev server nespouští), ohrožený byl vývojář, ne uživatel.

`vite` 7.1.3 → **7.3.6** (nejvyšší požadovaná oprava byla 7.3.5), **připnuto přesně** jako
`electron` — npm sám zapsal stříšku, což by rozbilo reprodukovatelnost buildu.
`extract-zip` **zůstává**: `first_patched_version` je `null`, není na co povýšit.

✅ **Ověřeno naostro:** po přestavbě aplikace spuštěna a řízena přes CDP · otevřených
hlášení **9 → 1** (změřeno API, ne odhad).

### 6. ✅ HOTOVO — **PR #72 mergnut** · `ui-smoke` byla brána, která nemohla projít

CI ho má vypnutý (`if: ${{ false }}`), spouští ho člověk na Macu. Spustil jsem ho:
**deset minut visel a spadl** na `Timeout` u obrazovky oprávnění, protože mezi přihlášením
a oprávněními je krok „Čekám na prohlížeč", kudy se bez člověka projít nedá.

🔴 **Zelený mohl být jen tam, kde je přihlášení ROZBITÉ** (dřív chybějící
`LUDONE_OAUTH_CLIENT_ID` krok propadl dál). Zelená dokazovala opak toho, co měla.
`LUDONE_E2E=1` přihlášení nezastupuje — odemyká jen `test:quit` a kontrolu lišty.

Teď projde vše až k hranici OAuth včetně čekací obrazovky a jejích východů (adresa ·
Kopírovat · Zkusit znovu s **novým `state`** · Zrušit **bez slepé uličky**), na hranici
**skončí do 3 sekund**, vyjmenuje ověřené i **neověřené** obrazovky a vrátí **kód 2** —
ne 0 („vše prošlo") ani 1 („selhalo"). Nad přihlášeným profilem jede dál na panel a nastavení.
Origin bere z `AUTH_ORIGINS` v kódu aplikace, protože `auth:origin` panelu nepatří.

### 7. ✅ HOTOVO — **PR #73 mergnut** · Tlačítko „Kopírovat", které nekopírovalo

**Našla to ta opravená brána na svém prvním poctivém běhu.** Ověřeno tvrdě: značka ve
schránce → **skutečný klik myší** přes CDP (s uživatelskou aktivací) → `pbpaste` vrátil
pořád tu značku. `.catch(() => {})` v `Onboarding.jsx:488` chybu spolkl, uživatel nedostal nic.

Příčina byla **správné chování jinde**: aplikace povoluje jen mediální oprávnění, takže
Clipboard API padá. Rozvolnit to kvůli tlačítku by byla špatná směna — kopírování jde teď
přes hlavní proces kanálem, který **nenese žádný text** (jinak by renderer mohl vložit
uživateli do schránky cokoli); adresu si hlavní proces vezme ze svého stavu a ověří ji.

✅ **Ověřeno naostro po opravě:** klik → schránka obsahuje přihlašovací adresu, tlačítko
hlásí „Zkopírováno".

---

## 🎙 NAHRÁVÁNÍ OVĚŘENO NAOSTRO (6. 9.) — bez zachyceného zvuku

Nahrávání byl poslední velký tok, který nikdo neviděl běžet. Nešlo ho ověřit, aniž by se
zachytil Danův pokoj — **dokud se nepodstrčí syntetický proud**:

```js
Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true,
  writable: true, value: async () => proudZOscilatoru(440) });   // systém 880 Hz
```

Tenhle recept **používej i příště**: mikrofon 440 Hz, systém 880 Hz, žádné oprávnění není
potřeba a nic skutečného se nenahraje. Ovladač je `scratchpad/podstrc.mjs`.

### Co průchod ověřil ✅

start · **měřáky se počítají** (výplň 207,094 z 218 px, ne natvrdo 100 %) · „Obě stopy
ověřeny" · **souběh s LuTrackem** (`stav=recording-tracking`, panel ukazuje obojí) ·
zastavení · pojmenování · **export do Stažených** · zařazení do fronty (16 → 17) ·
**výpadek systémového zvuku** (panel: „NAHRÁVÁ SE OMEZENĚ · Ostatní zvuk: ticho").

🔴 **Po každé zkoušce ukliď.** Fronta i `nahravky/` a Stažené se vracely na základ
(16 položek, 49 souborů) — ověřeno po každém kole. Zkušební položky poznáš podle
`enqueuedAt` s dnešním datem.

### 8. ✅ HOTOVO — **PR #74 mergnut** · Osmisekundová nahrávka hlásila „1 minuta"

`Math.max(1, Math.round(ms / 60_000))` dělalo z každé krátké nahrávky minutu a `Math.round`
hlásil minutu i pro 89 s. Teď se pod minutu říkají sekundy a **o jednotce se rozhoduje až po
zaokrouhlení**, takže 59,6 s je „1 minuta", ne „60 sekund".
✅ **Ověřeno naostro po opravě:** `6 sekund · 187 kB`.

### Co jsem NEZMĚNIL, ačkoli to vypadá jako vada

**Lišta při jednostopé nahrávce nehlásí výpadek** (`výpadekZvuku=false`). Rozlišují se dva
stavy: `unavailable` (uživatel kývl na jen mikrofon) a `lost` (zvuk spadl uprostřed); červený
odznak patří jen druhému. Návrh u toho stavu píše *„je to právě chvíle, kdy je panel zavřený"*,
což mluví pro změnu — ale uživatel na jednostopé nahrávání **výslovně kývl**. Je to produktové
rozhodnutí, leží v `DAN-TODO.md` s doporučením tichého odznaku místo červeného.

### Zastaralé poznámky, které jsem při té příležitosti opravil

- „při souběhu chybí druhý údaj vedle ikony" — **je implementovaný** (`"nahrávání · časovač"`).
- „tři stavy lišty chybí" — `queue-waiting` i `recording-audio-lost` **stojí**.

---

## 🌐 6. 9. — prohlížeč se otevíral po KAŽDÉM nahrávání (PR #75)

Dan: *„vždy když ukončím nahrávání, tak se mi otevře prohlížeč, to není ideální."*

| měření | výsledek |
|---|---|
| panely Safari před × po kliknutí na „Přeskočit" | **70 → 71** |
| co v tom panelu bylo | `app.ludone.cz/nahravky/nahrat?clientRecordingId=…` |
| co v seznamu panelů viselo | nahrávací stránky z **2. i 3. září** — každá nahrávka nechávala panel |

Obě tlačítka volala tutéž cestu a `recording-export.cjs:272` otevíralo stránku
**bezpodmínečně**. 🔴 **Otevírání samo o sobě vada NENÍ** — BD-N34 dává fázi 1 nahrávat
prohlížeči a návrh (`nahled.html:493`) má jediné tlačítko „Uložit a **odeslat**". Vada byla,
že totéž dělala i cesta, která odeslat nechtěla.

Rozhodnutí je teď **povinný boolean bez defaultu** (chybí ⇒ chyba, na dvou vrstvách).
Druhé tlačítko se jmenuje **„Jen uložit"**, soubor uloží a **neotevře nic**.

✅ **Ověřeno naostro po opravě: 71 panelů před i po**, soubor ve Stažených.

### Rozhodl jsem sám (workflow spadlo na limit, tak jsem architekturu rozhodl)

Ultracode workflow devíti agentů **spadlo celé** — všech 9 narazilo na limit Claude session.
Návrh jsem tedy udělal sám a zapisuji ho: *„Uložit a odeslat" zůstává beze změny včetně
otevření stránky; „Jen uložit" soubor uloží do Stažených (nic se neztratí) a neodesílá.*
Alternativa „neexportovat vůbec" by nahrávku nechala jen v `userData`, odkud ji retence
časem smaže — proto ne.

### 🔴 Model `gpt-6-astra` FUNGUJE — moje předchozí tvrzení bylo chybné

4. 9. jsem zapsal, že „astra na ChatGPT účtu nejede". Testoval jsem `astra`, `gpt-astra`,
`gpt-5.7-astra`, `gpt-5.6-astra` — **neexistující jména**. Hláška *„model is not supported
when using Codex with a ChatGPT account"* zní jako výrok o účtu, ale server ji vrací i na
překlep. **Správný slug je `gpt-6-astra`** a je v `~/.codex/models_cache.json`.
Tenhle PR napsala astra (`xhigh`): 14 nových testů, všechny brány zelené na první pokus.
Dělba podle skillu: **psát kód → astra · hledat cizí vady → sol na ultra**.

---

## 6. 9. večer — délka názvu, návrh od astry, a JEDNA MOJE CHYBNÁ PREMISA

### ✅ #76 — tiché zkracování názvu pro server

Název se cestou do URL **tiše ořízl na 200 jednotek** ⇒ dvě nahrávky mohly nést týž název.
Serverová session dodala své číslo (**500 UTF-16 jednotek po `trim()`**, `route.ts:150`),
takže je teď shodné a v pojmenované konstantě; delší se **odmítne v panelu**, ne až u nich.

🔴 **A moje chyba, ať se neopakuje:** zadal jsem to s premisou, že *„export už dnes padá na
dlouhém českém názvu"*. **Nepadá.** Změřil jsem **ručně poskládaný název souboru** a vynechal
`sanitizeRecordingName`, která ho odjakživa ořezává na 40 kódových bodů. Astra vrátila
`premisaPlatila: false` a měla pravdu. **Tutéž chybu jsem pak zopakoval ještě jednou** —
při ověřování astřiny verze jsem volal jen sanitizaci, ačkoli ořez přesunula do
`exportFileName`. Teprve třetí měření (přes `vm`, skutečnou funkcí) dalo pravdu:
246–247 B na obou větvích, obojí bezpečné.
⇒ **Změna názvu souboru je VYLEPŠENÍ, ne oprava** (zachová 2× víc názvu). Nechal jsem ji,
protože je změřená a otestovaná, ale v PR i commitu to stojí naplno.

### 🎨 #77 — designový návrh od astry (Danovo zadání, k posouzení)

`docs/changes/desktop-v1/navrh-astra/nahled.html` — 34 stavů, bez sítě, otevře se dvojklikem.
✅ Vykreslil jsem ho v Electronu: **9098 px, 0 chyb v konzoli**, snímky prohlédnuté.
Astra vykreslení sama ověřit nemohla a **napsala to**, místo aby to předstírala.
Dvě z jeho tří změn nezávisle trefily otevřené položky z `DAN-TODO.md` (Zkouška u LuTracku
před startem · tvar místo barvy v liště ⇒ padá i otázka kontrastu).

### Model `gpt-6-astra` v praxi

Tři běhy, všechny `EXIT=0` napoprvé, brány zelené bez opravného kola. Vrátila
`premisaPlatila: false` tam, kde jsem se mýlil — to je přesně to, kvůli čemu ta položka
v kontraktu je. Podle skillu platí dělba: **psát kód → astra · hledat cizí vady → sol/ultra**.

---

## 🔎 AUDIT ÚPLNOSTI #2 (6. 9. večer, `sol/ultra`, read-only)

Prošel **63 rozvržením odlišných stavů** a vrátil **14 nálezů**. Do zadání šly konkrétní
příklady osmi už opravených vad — a auditor je **poctivě nehlásil znovu**, stejně jako
vědomě odložené položky z `decisions.md` a `DAN-TODO.md`. Všechny nálezy jsou 🟡 (doložené
zdrojovým tokem, ne živým během) a sám vypsal sedm věcí, které ověřit nemohl.

🔴 **Nálezy jsou téže třídy, jakou tu lovíme celý den: akce, která selže a mlčí.**

| záv. | kde | co |
|---|---|---|
| ~~vysoká~~ | `Settings.jsx:437` | ✅ **OPRAVENO (#79)** — „odhlášeno" i když server relaci neodvolal |
| **vysoká** | `main.cjs:3304` | po vypršení tokenu panel dál hlásí „připojeno" |
| ~~střední~~ | `Settings.jsx:755` | ✅ **ODSTRANĚN (#79)** — přepínač, který nikdo nečetl |
| střední | `App.jsx:158` | poškozený `outgoing.json` ⇒ fronta se tiše skryje |
| střední | `QueueCard.jsx:80` | „nic se neztratilo" i u trvale selhané položky |
| střední | `audio-levels.js:405` | suspended AudioContext hlásí nuly jako **naměřené** |
| střední | `main.cjs:571` | lišta počítá čas dřív, než `MediaRecorder` začne |
| střední | `AuthErrorScreen.jsx:55` | neplatný origin se ukáže jako obecná chyba |
| střední | `auth.cjs:1319` | „Otevřít Nastavení" selže bez hlášky |
| nízká ×5 | Nastavení, test tónu, tray menu | selhání viditelné jen v konzoli |

**Ověřil jsem si oba vysoké sám v kódu — platí.** `Settings.jsx` se ptá jen na
`signedOutLocally` a `serverRevoked` nečte; `hasStoredAuthSession` kontroluje jen vydavatele,
kdežto `recordingUploadContext` navíc hlídá `accessExpiresAt`. Dvě různá pojetí „přihlášen"
a uživatel vidí to optimistické.

🔴 **Druhý vysoký nález NEŘEŠÍM sám:** změnit, co se počítá jako „přihlášen", je produktové
rozhodnutí (odhlásit? nabídnout znovupřihlášení?) a `spec.md` navíc už přiznává chybějící
obrazovku „Přihlášení vypršelo". Leží v `DAN-TODO.md`.

---

## 🎨 DVA NÁVRHY OD ASTRY — Dan se na ně podívá ráno (#77, #78)

| | `navrh-astra/` (A) | `navrh-astra-b/` (B) |
|---|---|---|
| rozvržení | skládané karty, stálé pořadí agend | **dva sloupce vedle sebe** |
| grafika | oblé, systémové písmo | rovné hrany, velká proporční čísla, svislé měřáky |
| fronta | v patičce | **nahoře** |
| lišta | šablonová dvojice + odznak | **dělený znak** |
| stavů | 34 | 34 (**stejné, dají se porovnat kus po kuse**) |

Oba jsou **samostatné soubory bez sítě** (0 externích zdrojů), oba jsem **vykreslil
v Electronu a prohlédl** (9098 a 9314 px, nula chyb v konzoli). Astra u obou přiznala,
že vykreslení sama ověřit nemohla — místo aby to předstírala.

🔎 **Návrh A nezávisle trefil dvě otevřené položky z `DAN-TODO.md`**: „Zkouška" u LuTracku
**před** startem a rozlišení agend **tvarem místo barvy** (⇒ padá i otázka kontrastu).
**Návrh B poctivě píše, co A dělá líp** — bylo to v zadání a splnil to.

⚠️ **Past, na kterou #78 málem doplatil:** B přiložil vlastní kontrolní skript `overit.mjs`
pod `docs/`, kde ESLint nedává Node globals ⇒ **brány zčervenaly na jinak dokumentačním PR**.
Smazal jsem skript (jeho výstup zůstal v `OVERENI.txt`), místo abych kvůli jednorázovému
souboru rozšiřoval sdílenou konfiguraci.

---

## Stav jednou větou

Aplikace je **postavená celá**, ale **ověřená naostro skoro vůbec**. Chybí Danova rozhodnutí
a patnáct minut jeho času u počítače.

| | |
|---|---|
| `main` | `ab0acb6`, **879 passed \| 3 skipped (882)**, čistý strom, **Electron 39.8.10**, **Vite 7.3.6** |
| otevřené PR | **0** · worktrees **0** · větve `orca/*` **0** · mergnuto 3.–6. 9.: **#41–#74 (38 PR)** |
| zranitelnosti | **9 → 1** (zbylá `extract-zip` opravu nemá) |
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


## ✅ VŠECHNY TŘI DANOVY VEČERNÍ NÁLEZY OPRAVENÉ

| co | PR | co bylo špatně |
|---|---|---|
| **měřáky se nehýbaly** | #63 | pruh byl **dekorace** — `width: 100%` natvrdo; **lhal**, ukazoval plno i při tichu |
| **ikona nebyla vidět** | #64 | `shouldUseDarkColors` popisuje **aplikaci**, ne **lištu**; PR #47 zahodil šablonové ikony |
| **„15 čeká" nešlo kliknout** | #65 | počet bez akce; PR #57 navíc přidal stav „čeká na potvrzení", který nebylo kde potvrdit |

🔴 **Všechny tři prošly přes 758–788 zelených testů.** Společná příčina: testy ověřovaly,
že prvek **existuje**, ne že **funguje**. Tlačítko v DOM bylo a nešlo vidět; měřák
existoval a neměřil; počet se zobrazoval a nikam nevedl.

⇒ **Nové testy proto měří chování:** nahlášená výška proti skutečné · pohyb pruhu při
změně amplitudy (>40 bodů) · vyvolání retry, ne jen změna textu.

🛑 **Zbývá jediné rozhodnutí pro Dana:** barevné ikony propadají kontrastem na **světlé**
liště (korálová 2,35 : 1, tyrkysová 1,91 : 1). Tři varianty v `DAN-TODO.md`.


## 🔎 AUDIT ÚPLNOSTI — recept, který se osvědčil a stojí za zopakování

Dan našel večer **tři vady za dvacet minut** tím, že se na aplikaci **podíval**. Všechny
prošly stovkami zelených testů. Pustil jsem proto audit, který se ptá **jeho třemi
otázkami**, a našel **tři další** — z toho jednu vážnou, starou hodinu.

| otázka | co hledá | co našla |
|---|---|---|
| **vejde se to?** | pevné mřížky, `overflow: hidden` bez scrollu, podmíněně vypnuté prvky | tlačítka „Uložit a odeslat" **pod hranou panelu** |
| **měří to?** | prvek, co vypadá jako ukazatel a hodnotu nedostává | onboarding **neobnovil oprávnění** po návratu ze systému |
| **vede to někam?** | číslo nebo hláška o problému bez akce | „Spustit LuTrack" z lišty se **tiše zahodilo** |

⇒ **Tenhle audit pouštět po každém větším bloku UI práce.** Zadání je v
`/tmp/beh-noc/codex-uplnost.txt`; podstatné je, že do něj patří **konkrétní příklady
už nalezených vad** — bez nich hledá obecně a najde míň.

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
4. **`declaredCaptureSources`** — tvar dohodnutý se serverem (D28b), staví se ve fázi 2.
   🔴 Serverová session výslovně prosí NESTAVĚT dřív, ať to u nás nevisí bez protistrany.

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

---

## 7. 9. — vlna 1 a 3 (PR #80, #81, #82)

`main` **968 passed | 3 skipped**, 0 PR, 0 worktrees.

### ✅ Vlna 1 — dvanáct nálezů auditu

**#80** opravil šest podob jedné vady v rendereru („akce selže a mlčí"): poškozená fronta
čtená jako prázdná · protimluv v kartě fronty · zastavený `AudioContext` hlásící nuly jako
naměřené · konkrétní chyba konfigurace ukázaná jako obecná · přepínač vracející se beze slova ·
němý zkušební tón. **Každá oprava je pár**: selhání je vidět a legitimní tichý stav zůstává tichý.

**#81** dal menu lišty nativní dialog, když nejde otevřít prohlížeč.

🔴 **Dvě věci ZÁMĚRNĚ nepostaveny** (pojistka v zadání zabrala): vypršelý token jako
„nepřihlášen" by schoval ovládání běžícího nahrávání, a čas v liště od skutečného startu
vyžaduje zakázaný renderer.

### 🔴 Nález pro Dana: neplatná relace bere Stop uprostřed nahrávání

Ověřeno i na nezměněném `main`. Cesta ven existuje (tray menu), ale ikona bývá pod výřezem.
Rozhodnutí v `DAN-TODO.md`.

### ✅ Vlna 3 — balení POPRVÉ proběhlo (#82)

🔴 **`npm run package:mac` padal od PR #35** na neplatném klíči `allowMissingDependencies`
— a **test ten klíč vyžadoval**, takže hlídal, aby balení zůstalo rozbité. Test je obrácený:
teď hlídá, že se vada nevrátí.

✅ **Naostro:** EXIT=0, vznikly `LuDone Desktop-0.1.0-arm64.dmg` (106,7 MB) a `-x64.dmg`
(111,9 MB), bundle `cz.ludone.desktop`, minimum macOS 12.0.0, česká hláška o mikrofonu,
podpis `adhoc`. **Až přijde certifikát, mění se jen přihlašovací údaje, ne cesta.**

⚠️ **Poučení pro další vlny:** briéf jsem psal ze zastaralého předpokladu, že podepisovací
cesta se teprve staví — přitom byla hotová a jen nikdy nespuštěná. **Před zadáním vlny změř,
co už stojí**; matice i briéf stárnou rychleji než běh.

### Co dál

1. **`declaredCaptureSources`** (D28b) — server to chce, Dan schválil fázi 2.
2. **Vlna 4** — zvednout `verification` na `verified-live` syntetickým zvukem.
3. Zbylých pět nízkých nálezů auditu.
🔴 `DSK-F010` ani `DSK-F012` nestavět (D29, D33).

---

## 7. 9. odpoledne — declaredCaptureSources (PR #83)

`main` **984 passed | 3 skipped**, 0 PR, 0 worktrees.

🔴 **Naše strana hotová, CELÁ CESTA NE.** Serverová session změřila, že parametr u nich zatím
**nikdo nečte** (nula výskytů, staví se jako T-04) — hodnota dorazí a zahodí se, a my se to
nedozvíme, protože upload projde. Drž to jako *odesíláme*, ne *funguje* (D36).

Nahrávací stránka teď dostává `declaredCaptureSources=microphone` nebo `=microphone%2Bsystem`.
**Hodnota jde ze stop v manifestu, které zapsal hlavní proces** — ne z rendereru a ne z počtu
kanálů (jednostopý export má taky dva, vpravo digitální ticho).

🔴 **Přitvrzeno nad rámec dohody:** manifest jen se systémovou stopou parametr **nepošle**.
Obě hodnoty tvrdí mikrofon; bez jeho stopy nemáme co ohlásit. Nedosažitelné dnes, ale
`declared` server bere jako naše slovo.

⚠️ **Poučení k sabotážím:** kontrola neznámých druhů je v souboru **dvakrát** (validátor
manifestu + nová funkce) a `replace(..., 1)` trefil ten první — sabotáž tedy minula cíl
a vypadalo to jako díra v testech. Když mutuješ výraz, který se v souboru opakuje,
**cíl vybírej podle řádku, ne podle prvního výskytu**.

## Co dál

1. **Vlna 4** — zvednout `verification` na `verified-live` receptem se syntetickým zvukem.
2. Zbylých pět nízkých nálezů auditu.
3. Po schválení A2: podepsaný build a skutečné soubory pro serverové měření.
🔴 `DSK-F010` ani `DSK-F012` nestavět (D29, D33).

---

## 7. 9. — vlna 4: co šlo ověřit naostro (a co ne)

Sweep na buildu `62f04cb`, panel řízený přes CDP.

**✅ Ověřeno naostro:** karta fronty (17 položek, 29,2 MB, „odesílání je vypnuté") ·
LuTrack start i stop (lišta přepnula na `stav=tracking`, `lutrack=true`) · přepnutí projektu ·
**všechny čtyři karty Nastavení** se skutečným obsahem → `DSK-F015` zvednuto na `verified-live`.

**🔴 Nezvedl jsem `DSK-F009` ani `DSK-F011`/`F013`**, ačkoli jsem je viděl běžet: ověřil jsem
jen ZOBRAZENÍ. Poznámka ¹⁰ v matici to popisuje přesně — *„most je vystavený, volající chybí"*.
Doměřeno: `getTrackingState()` vrací `aktualni: null` i při běžícím časovači a po zastavení
zůstává `uzavrene: []`. **Panelový časovač je atrapa** (rozhodnutí C3 „LuTrack: jen příprava"),
persistovaná implementace v hlavním procesu je nezapojená. Zvednout ověření by tvrdilo něco,
co neplatí.

⚠️ **Počtvrté mě zachránilo, že jsem se podíval dřív, než jsem ohlásil nález.** Vypadalo to
jako vada money funkce; bylo to už zapsané v poznámce ¹⁰ i v C3.

⚠️ A dvakrát mi lhalo vlastní měřidlo: „Přepnout projekt" jsem hledal jako tlačítko (je to
`select`) a jako „zobrazený projekt" jsem sbíral položky rozbalovacího seznamu. Obojí vypadalo
jako rozpor, obojí byla chyba sondy.

---

## 7. 9. — měření síly zámků (PR #84)

Serverová session přišla s heuristikou, kterou stojí za to používat dál:

🔴 **Počet červených testů říká, kolika NEZÁVISLÝMI podmínkami ten invariant držíš.
Jedna červená u důležité věci je varování, ne úspěch.**

Vyzkoušeno na třech zámcích tohohle repa:

| zámek | červených | verdikt |
|---|---|---|
| strážce odesílatele IPC (`requireTrustedSender`) | **12** | silný |
| fail-closed brána odesílání (killswitch) | **17** | silný |
| „manifest musí mít mikrofonní stopu" | **0 → 1** | byl **bez obhájce**, PR #84 |

Ten třetí šel smazat celý a 984 testů zůstalo zelených — přitom v produkci vyhazuje výjimku
a podpírá `declaredCaptureSources` (obě hodnoty mikrofon slibují).

**Recept, ať to jde zopakovat:** vyřaď zámek (`if (true) return;`, `=== "true"` → `true`,
smazání podmínky), spusť **celou** sadu, spočítej červené, vrať zpět a ověř čistý strom.
Ptej se **„co musím rozbít, aby zčervenala?"** — když je odpověď „nic", zámek tam není,
jen to tak vypadá.

---

## 7. 9. — druhý zámek bez obhájců (PR #85)

Serverová session udělala z heuristiky **předpověď**, a ta zabrala napoprvé:

🔴 **Zámky bez obhájců se dají hledat podle toho, JAK VZNIKLY.** Bezpečnostní práce si
sabotáže nese s sebou; **validace tvaru, parser a obranný `assert` se píšou jako hygiena** —
a invariant nese ten, kdo na něm stojí, ne ten, kdo ho psal. Hledej tam, kde je odstup mezi
**tvarem kódu** a **váhou toho, co drží**.

Podle toho jsem prošel kandidáty v `recording-export.cjs`:

| zámek | červených | poznámka |
|---|---|---|
| sanitizace jména (lomítka, tečky) | 3 → **6** | brání `..` a `/` stát se segmentem cesty |
| kontrola kontejneru Opus/WebM | 3 | v pořádku |
| **„název opustil složku Stažené"** | **0 → 1** | 🔴 **bez obhájce**, PR #85 |

**Poučení navíc:** záchranná vrstva je nedosažitelná, dokud první funguje — proto měla nulu
a proto ji **behaviorální test zamknout nemůže**. Drží ji strukturální test, který
**odstraňuje komentáře** (ověřeno, že řádek citující tu kontrolu ho neuspokojí).

⚠️ Upřesnění od serverové session k dřívějšímu pravidlu: **jedna červená neznamená „varování",
znamená „nevíš"** — může to být křehká aserce, nebo jediné poctivé místo, kde ta pravda žije.
Lepší odpověď než přidat druhý test na totéž je **doložit, že to drží dvě různá místa**.
