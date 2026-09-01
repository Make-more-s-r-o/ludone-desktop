# Task packet B10 — OPRAVENÁ VERZE po adversariální revizi

> **Jak tenhle packet číst.** Je dlouhý, protože nese změřené věci, ne proto, že je upovídaný.
> Nečti ho lineárně. **Minimum před první editací:** §12 (vlastnictví bloků), §13 (TDD kroky
> s doslovnými červenými výpisy), §14 (sabotáže). Zbytek je odůvodnění, do kterého se vracej.
>
> 🔴 **Sekce `Co NEBYLO ověřeno v kódu` na konci není formalita.** Skeptik packet četl proti
> kódu a tohle zůstalo bez důkazu — než na tom postavíš implementaci, otevři to.
>
> Packet napsal agent, přečetl skeptik. **Když v něm najdeš nepravdu, je to nález, ne překážka** —
> zapiš ho a jeď dál podle `spec.md` a `plan.md`, ty jsou nadřazené.

---


> Sdílené zařízení `zasedacka@makemore.cz` odlišit od osobního účtu.
> **Vykonavatel: Claude návrh (tenhle dokument), Codex stavba.**
> Packet je psaný podle `MASTERPLAN.md` §9 (dvacet polí, řádky 614–635). Implementátor nedostává celý plán — dostane tohle.
>
> 🔴 **Tato verze vznikla revizí předchozího návrhu.** Revize v návrhu našla **šest blokerů**, kvůli kterým by stavba narazila na červenou bránu, na kterou zároveň nesměla sáhnout, a **dvacet nepravdivých tvrzení o kódu**. Co se opravilo, je vypsané v poslední sekci — čti ji, i když packet znáš.

---

## 1. Plan ID a Plan SHA

| | |
|---|---|
| **Plan ID** | `docs/changes/desktop-v1/plan.md` (change-id `desktop-v1`) |
| **Plan SHA** | `c7b1bb715f87f53ca0a209d5d3b96e6018e1e437` — *„Replace the single done column with four independent axes"* (`git log -1 --format=%H -- docs/changes/desktop-v1/plan.md`) ✅ ověřeno |
| **Spec SHA** | `1e9709779e94a654a0c3c959d260082d42801acc` (`spec.md`, ZMRAZENO) ✅ ověřeno |
| **Design SHA** | `26a06abd2ff8449cd74862ca3df7fb36f2db0005` (`design/approved.json`) ✅ ověřeno |
| **HEAD při psaní packetu** | 🔴 **`9863d535ef04c2e41df0e8b87d2dce92bdbe3110`** — *„Capture the red ui-smoke run the fix has to turn green"*, větev `main`, strom čistý |

🔴 **Oprava proti návrhu:** návrh uváděl HEAD `73322adc…`. To je **sedm commitů zpátky**. Ověřeno, že `73322ad` je předek HEAD a že `git log 73322adc..HEAD -- electron/main.cjs` je **prázdný** — čísla řádků v `main.cjs` proto platí i na HEAD. Kotvy tedy nejsou vadné, ale **baseline v packetu byl.** Kotvy níž platí pro `9863d53`.

**Změřený baseline na `9863d53` (spuštěno, ne odhadnuto):**

| Brána | EXIT |
|---|---|
| `npm run lint` | **0** |
| `npm run typecheck` | **0** |
| `npm run test:unit` | **0** — 9 souborů, **77 testů**, Vitest **3.2.7** |
| `bash scripts/akceptace/E6.sh` | **0** — `chyb: 0` |

🔴 **Spec i plán jsou ZMRAZENÉ.** Chybu v nich zapiš do `DAN-TODO.md` a jeď dál po tom, co na ní nezávisí. Neměň je.

---

## 2. Task ID

**B10** — `Tell a shared device apart from a personal one` (název PR anglicky, `plan.md` §2b řádek 151).

Větev: `feat/sdilene-zarizeni` (`AGENTS.md:14` — `<typ>/<oblast>-<popis>`).

⚠️ **Odchylka od zmrazeného plánu, kterou musíš přiznat v PR:** `plan.md` §2b má u B10 ve sloupci „Dělitelné?" hodnotu **„ano, návrh + stavba"** — tedy dělení na *návrh* a *stavbu*, ne na dva souborové PR. Rozdělení B10a/B10b v §12.2 je **náš** šev navíc. Je povolený (plán zakazuje překročit ~250 řádků, ne dělit jinak), ale patří do `DAN-TODO.md` jako odchylka od zmrazeného plánu.

---

## 3. Feature ID

🔴 **OTEVŘENÁ OTÁZKA, NEHÁDEJ: B10 nemá vlastní Feature ID.** Ověřeno v `spec.md` §3 (řádky 78–93): matice má šestnáct řádků `DSK-F001`–`DSK-F016` a **žádný z nich není sdílené zařízení**. Sdílené zařízení je ve specu jen na dvou místech mimo matici — `spec.md:52` (role a viditelnost) a `spec.md:217` (matice stavů, sloupec „Kde je dnes" = **chybí**).

**Návrh v předchozí verzi packetu přiřadil B10 k `DSK-F003` a to je špatně.** `DSK-F003` je „Přihlášení OAuth 2.1 + PKCE, loopback", třída **security**, dnes `approved · coded ² · disabled · unverified` (ověřeno, `spec.md:80`). Na `committed` ho posune **B8** („Zapojit `createAuthController` místo atrapy", `plan.md:91`), ne B10. B10 do relace jen přidá pole.

**Co s tím udělat, dokud Dan nerozhodne:**
- V PR uveď Feature ID jako **`DSK-F003` (dotčeno) + „bez vlastního ID, viz `DAN-TODO.md`"**.
- 🔴 **Nehlas posun `DSK-F003` na `committed`.** Ten posun patří B8. B10 na osách `DSK-F003` **nemění nic**.
- Do `DAN-TODO.md` zapiš: *„B10 nemá řádek ve `spec.md` §3. Masterplán §9 Feature ID vyžaduje. Spec je zmrazený — chybějící řádek `DSK-F017 Sdílené zařízení` musí doplnit orchestrátor při rozmrazení."*

**Dotčené, ale touto story neposouvané funkce:** `DSK-F007` (nahrávání, `merged · labs · tests-green ⁴`), `DSK-F009` (fronta, `coded ⁵ · disabled · tests-green`), `DSK-F008` (pojmenování při stopu, `no-code`), `DSK-F011`/`DSK-F012` (časovač a výběr projektu — B10 je **skrývá**, nestaví).

🔴 **`verified-live` nesmí v PR padnout ani jednou**, dokud to člověk neviděl běžet na Macu (`plan.md:162–164`).

---

## 4. Cíl story

Aplikace musí umět rozeznat **sdílené zařízení** (Mac v zasedačce, trvale přihlášený účtem `zasedacka@makemore.cz`) od **osobního Macu**, a podle toho se chovat jinak ve třech věcech:

1. **Panel vždy nese jméno účtu, pod kterým se nahrává** — na zasedačce tedy jméno zasedačky, ne domnělé osoby.
2. **Časová agenda se na sdíleném zařízení nenabízí** — hodiny jsou money-path a sdílený účet nemá komu je připsat (`transakce-concurrency.md:214`).
3. **Po zastavení nahrávky se sdílené zařízení ptá, čí to bylo**, odpověď se uloží k nahrávce a fronta pak odesílá jen položky právě přihlášené identity (`transakce-concurrency.md:212–213`).

**Rozpoznání nesmí stát na heuristice podle e-mailu** (`spec.md:150`, R6 — identita je GUID, ne název; přejmenování sedmi firem 23. 7. 2026).

### Co v této story NENÍ (napiš to do PR, ať se to nezkusí přidat)

- Automatické odhlášení sdíleného účtu po nečinnosti (návrh 30 min, **neměřeno** — `transakce-concurrency.md:215`) → `DAN-TODO.md`.
- Serverové rozhodnutí, komu nahrávka nakonec patří, ani seznam lidí k výběru — **S1, mimo rozsah**.
- RBAC filtr exportu diagnostiky (`revize-3.md` §4.2, řádek 123) — export dnes neexistuje.
- Obrazovka pojmenování při stopu `DSK-F008` / M19 — nemá vlastní story (viz §11).
- Retence na sdíleném disku — to je **B11**.
- Jakákoli změna vypínačů.
- 🔴 **Obrazovka volby profilu při přihlášení** — viz §10.0, je to otevřená otázka, ne úkol B10.

---

## 5. User-visible chování

### Osobní Mac (profil `personal`) — nic se nemění

- Patička panelu nese jméno a e-mail účtu (dnešní tvar, `App.jsx:89–102`).
- Karta LuTrack je v panelu jako dnes (`App.jsx:86`).
- Po zastavení nahrávky se **nikdo neptá, čí to bylo** — vlastníkem je přihlášený účet.

### Sdílené zařízení (profil `shared`)

- **Účet + odznak `Sdílené zařízení`.** Odznak je text + tvar, nikdy jen barva (`spec.md:223`).
  🔴 **Oprava proti návrhu — kam odznak patří:** návrh psal „hlavička nese jméno a e-mail účtu". **V kódu jméno a e-mail v hlavičce nejsou.** Ověřeno: `App.jsx:62–75` je hlavička (značka `LuDone` + stavový text + zavřít), účet je v **patičce** `App.jsx:89–102` (`.account-summary`, `{user.name}` / `{user.email}`). Návrh popisoval statický mock (`nahled.html:404`), ne kód. **Odznak proto patří k účtu v patičce**, do stejného bloku `.account-summary`; hlavička se nemění.
- **Místo karty LuTrack** je jedna věta, ne zašedlé tlačítko:
  > **Na sdíleném zařízení se čas neměří.** Vykaž ho na svém Macu nebo v LuDone.

  🔴 „Nenabízí se" jde splnit i mrtvým tlačítkem — proto je znění závazné (`revize-5.md:66`).
- **Nahrávání se spouští bez přihlášení** — kdokoli přijde, otevře panel, klikne Nahrát.
- **Po stisku tlačítka „Zastavit nahrávání"** (⚠️ to je skutečný text v kódu, `RecordingCard.jsx:448`; „Ukončit a uložit" je text z mocku `nahled.html:471`) panel ukáže jedno pole navíc: *„Čí to bylo?"* Volný text, předvyplněný prázdný, fokus v poli, Enter potvrdí.
- 🔴 **Prázdná odpověď uložení NIKDY neblokuje** — a tady je oprava, bez které to nejde postavit:

  Ověřeno v kódu: `finalizeRecordingSession` (`main.cjs:581–647`) zapíše finální manifest (`:632`) a **hned nato session smaže** (`:638`). Druhý zápis neexistuje. ⇒ **Odpověď musí dorazit PŘED voláním `finishRecording`, jinak se do manifestu nedostane nikdy.** To znamená, že mezi stopem a uložením vzniká okno, ve kterém člověk může panel zavřít.

  **Závazné pravidlo:** panel volá `finishRecording(sessionId, { attributedTo: null })` **sám** ve všech třech případech: (a) Enter v prázdném poli, (b) klik na „Přeskočit", (c) zavření panelu nebo odchod z fáze `attributing` z jakéhokoli důvodu. **Prodleva nesmí být nekonečná** — po 30 s bez odpovědi se uloží s `null`. Má to vlastní test (TDD-7).
- **Ve frontě** se odesílají jen položky přihlášené identity. Patička to řekne otevřeně: „3 čekají · 1 patří jinému účtu" — nikdy nesmí položka jiného člověka tiše zmizet (`transakce-concurrency.md:213`, R12).

### Neznámý profil

Relace bez zapsaného profilu se chová jako **sdílená** a panel řekne proč:
> Typ tohoto Macu není nastavený, proto se chová jako sdílený. Odhlas se a přihlas znovu.

---

## 6. Odkaz na schválený Claude Design artefakt

**Artefakt:** [`design/approved.json`](../../../design/approved.json) — `status: approved`, `approvedBy: Dan`, `approvedAt: 2026-09-01`, `approvedVia` = statická náhledová stránka [`design/navrh/nahled.html`](../../../design/navrh/nahled.html) (690 řádků).

🔴 **Pro sdílené zařízení schválená obrazovka NEEXISTUJE.** ✅ Ověřeno strojově: `coveredScreens` má **22** položek, `coveredStates` **11**, v žádné není sdílený stav a `openDesignQuestions` (3 položky) ho nezmiňuje. Zároveň `spec.md:217` to chování požaduje. ⚠️ Navíc: `approved.json` sám říká `"specVersion": "před sepsáním spec.md; schváleno nad commitem babdd5a"` — **design byl schválen dřív, než vznikl spec**.

**Z toho plyne závazný postup:** B10 **skládá nové obrazovky výhradně ze schválených vzorů.** Vzory s ověřenými čísly řádků:

| Co stavím | Schválený vzor | Ověřeno |
|---|---|---|
| účet vedle značky | `nahled.html:404` — `LuDone` + `Dan Jirotka · připojeno` | ✅ řádek sedí |
| jednořádková klidová agenda (M17) | `nahled.html:405–413` (řádky Nahrávání a LuTrack) | ✅ sedí |
| pole s fokusem při stopu | `nahled.html:489–493` (karta „Nahrávka uložena" + `class="field focus"`) | ✅ sedí |
| odznak / pill | 🔴 **`nahled.html:340` nebo `:346`** (`class="pill"`, „Povoleno" / „Neověřeno"), případně `:581–583` | 🔴 **oprava: `:474` pill NEOBSAHUJE** — je to rowline „Měří se čas" |

🔴 **OTEVŘENÁ OTÁZKA, NEHÁDEJ — rozpor návrh × story:** schválená obrazovka `nahled.html:489–493` **už jedno pole má** — je to **název nahrávky**, předvyplněný podle projektu (`:491` „Porada provozu", `:492` „Předvyplněno podle projektu, na kterém běží čas"). B10 na tutéž obrazovku dává **druhé, jiné** pole („Čí to bylo?"), a `DSK-F008` (pojmenování) přitom nemá story. `spec.md` § „Autorita při rozporu" říká, že **implementátor rozpor neřeší sám** (a `revize-5.md:78–80` na tenhle konkrétní typ rozporu už jednou upozornila). ⇒ **Postav jen pole „Čí to bylo?" a rozpor napiš do PR i do `DAN-TODO.md`. Nekresli obrazovku se dvěma poli.**

🔴 **Nový design-system pattern implementátor vytvořit nesmí** (`MASTERPLAN.md:641`). Když vzor nestačí, **zastav a vrať otázku**.

---

## 7. Relevantní výřez EXPERIENCE.md

🔴 **`EXPERIENCE.md` v repozitáři NEEXISTUJE.** ✅ Ověřeno (`find . -iname 'EXPERIENCE*'` mimo `node_modules` vrací nula souborů). Jeho roli hraje **[`docs/ux/cesta-uzivatele-2026-09-01.md`](../../ux/cesta-uzivatele-2026-09-01.md)**.

⚠️ **Ten dokument sdílené zařízení nikde neřeší** — ✅ `grep -c zasedac` = **0**. Relevantní je nepřímo, čtyřmi místy:

**a) Účet, pod kterým se právě jedná, musí být vidět (řádek 23, moment M07)** ✅ citace ověřena doslova:
> „…musí přibýt řádek ‚Přihlášen jako <e-mail>' s odkazem na přihlášení jiným účtem (e-mail ze session je tam k dispozici, jen se nikde nezobrazuje) — **jinak lidé povolí přístup identitě, pod kterou jsou zrovna v prohlížeči**."

**b) Zákaz osobních údajů v textech, které vidí okolí (řádek 101)** ✅ citace ověřena doslova:
> „Jméno klienta a projektu do textu **NEDÁVAT** — na sdílené obrazovce by bylo vidět."

Rozšiřuje se na odpověď „čí to bylo": **do logu ani do notifikace nepatří**.

**c) Moment, na kterém „čí to bylo" stojí, dnes nemá kde proběhnout** — 🔴 **oprava čísla řádku: je to řádek 72, položka 6** (návrh psal „řádek 71, položka 6"; řádek 71 je položka 5 o „Přihlášen jako"):
> „6. Pole pro poznámku k nahrávce, nabídnuté při STOPu s fokusem a předvyplněným datem, časem, délkou a projektem"

je v seznamu **„Momenty, které dnes nemají kde proběhnout"** (nadpis na řádku 65).

**d) Dvě různá úložiště, obě přežijí smazání appky (řádek 61, moment M31)** ✅ citace ověřena doslova:
> „Zůstanou nahrávky ze schůzek v `~/Library/Application Support/LuDone Desktop/nahravky`, šifrovaná session v **JINÉM** adresáři `~/Library/Application Support/cz.ludone.desktop/auth`"

✅ Ověřeno v kódu: `main.cjs:479` bere `app.getPath("userData")`; `auth.cjs:284–294` (`tokenStorageDirectory`) staví cestu z `app.getPath("appData")` + `cz.ludone.desktop/auth`. Důsledek pro živé ověření viz §16.

---

## 8. Relevantní business pravidla

Ze zmrazené `spec.md` §4 a §11 — **doslovně, tohle jsou mantinely story:**

| ID | Pravidlo (ověřený řádek) | Co z něj pro B10 plyne |
|---|---|---|
| **R6** (`:150`) | „Nabízet **jen projekty s platnou alokací k dnešnímu datu**. Identita projektu je **GUID**, nikdy název…" | Profil zařízení se **NIKDY neodvozuje z e-mailu účtu**. E-mail je název, ne identita. |
| **R8** (`:153`) | „Klient **nikdy neposílá hodinovou sazbu**. Dosazuje ji databáze z alokace." | Skrytí časové agendy nesmí být obcházeno posláním čehokoli o sazbě. |
| **R10** (`:155`) | „🔴 **Klíč proti duplikaci vzniká při STARTU** časovače, ne při odeslání." | `clientRecordingId` vzniká při startu (`main.cjs:477`, `const sessionId = randomUUID()`). B10 na klíč **nesahá**. |
| **R12** (`:161`) | „Odhlášení **nesmí smazat frontu**." | Střídání lidí u zasedačky frontu nemaže. Cizí položky se **přeskakují**, nemažou. |
| **R18** (`:167`) | „**Dva samostatné vypínače** (C2): `DESKTOP_UPLOAD_ENABLED` a `DESKTOP_TIME_ENABLED`. Oba fail-closed…" | 🔴 viz oprava níž |
| **R20** (`:169`) | „Nahrávky jsou **majetkem firmy** (B2). Admin je vidí všechny." | Nahrávka bez odpovědi není ztracená — patří účtu a admin ji vidí. |
| **R22** (`:295`) | „Klíč proti duplikaci musí přežít ztrátu manifestu…" | B10 do manifestu přidává pole — nesmí rozbít, co R22 chrání. |
| **R24** (`:308`) | „Zvuk ze skutečných schůzek nikdy do gitu" | Do `dukazy/` patří jen `vysledek.json` a `README.md`. |

🔴 **Oprava k R18 — vypínač `DESKTOP_TIME_ENABLED` v kódu NEEXISTUJE.** ✅ Změřeno: řetězec `DESKTOP_TIME_ENABLED` se v `electron/`, `src/`, `tests/`, `scripts/` ani v `.env.example` **nevyskytuje ani jednou**; žije jen v dokumentech (`plan.md:55`, `spec.md:167`, `sekce-navrhy/*`). `.env.example` obsahuje **jediný řádek** `DESKTOP_UPLOAD_ENABLED=false`. Navíc `processNext` **žádnou proměnnou prostředí nečte** — killswitch dostává jako **argument** (`src/lib/queue.js:195, 202`).
⇒ Návrh psal, že oba vypínače existují „každý s vlastním testem". **Neexistuje ani jeden test pro `DESKTOP_TIME_ENABLED`, protože neexistuje ani ten vypínač.** Pro B10 to nic nemění (nesahá na ně), ale **PR to nesmí tvrdit jinak**.

Ze `spec.md` §2 (role a viditelnost, řádek 52) ✅ doslova:
> | **Sdílené zařízení** (`zasedacka@makemore.cz`) | 🔴 **Součást v1.** Vlastní etapa, viz `plan.md` B10 |

Z `decisions.md:89–92` ✅ doslova — **čtyři otázky, které tahle story musí zodpovědět:**
> „jak se pozná sdílené zařízení od osobního · komu se přiřadí nahrávka, když se u jednoho Macu vystřídají tři lidé · co se stane s frontou při odhlášení uprostřed odesílání · jestli sdílený účet smí měřit čas (a komu by se ty hodiny připsaly)."

---

## 9. Relevantní Architecture Spine invarianty

Z `plan.md` §1 (řádky 14–68) — **implementátor je nesmí předefinovat:**

**Hranice modulů** ✅ opsáno doslova z `plan.md:14–21`:

| Modul | Vlastní | Nesmí |
|---|---|---|
| `electron/main.cjs` | okno, tray, IPC, životní cyklus | rozhodovat o stavu podle rendereru |
| `electron/queue.cjs` | odchozí fronta obou typů položek | znát obsah nahrávky |
| `electron/auth.cjs` | přihlášení, obnova, odvolání | ukládat token jinam než přes `safeStorage` |
| `src/**` (renderer) | **jen zobrazení** | držet stav, který musí přežít pád |

**Kdo vlastní stav** (`plan.md:25–27`):
> 🔴 **Stav, který musí přežít pád rendereru, vlastní hlavní proces.** Renderer hlásí fakta, neurčuje stav.

⇒ **Profil zařízení nesmí bydlet v Nastavení rendereru.** ✅ Ověřeno: `Settings.jsx:13` má `STORAGE_KEY = "ludone.prototype.settings"`, `loadSettings` (`:20–26`) a `useEffect` (`:32–34`) drží veškerá nastavení v `window.localStorage` — editovatelné komukoli, kdo v zasedačce otevře DevTools. `revize-5.md:68–72` (A6) to označuje za **money-path přepínač bez auditu** a doslova říká: *„buď příznak zamknout (nastavuje se jednou při prvním přihlášení a v panelu je jen ke čtení, změna vyžaduje odhlášení), nebo J4 označit jako blokované rozhodnutím, ne jako návrh."*

**Jak se vymáhá RBAC** (`plan.md:38–44`):
> Default-deny na třech osách. Desktop **žádnou z nich nevyhodnocuje sám** — ptá se serveru a odpověď respektuje. v1 vidí každý **jen své vlastní**; **admin vidí vše** (B2).

⇒ 🔴 **Desktop nerozhoduje, komu nahrávka nakonec patří.** Jen zajistí, aby data nesla vlastníka.

**Jak se chrání peníze** (`plan.md:48–51`): 1. klient neposílá sazbu, nikdy · 2. klíč proti duplikaci při startu · 4. **zápis do Tabidoo přímo z desktopu je zakázaný** za všech okolností.

**Rollback** (`plan.md:68`): „Každá story je samostatně revertovatelná. Žádná migrace v1 (desktop nikam nepíše)."

---

## 10. Vstupní a výstupní rozhraní

### 10.0 🔴 OTEVŘENÁ OTÁZKA, KTEROU NÁVRH MLČKY PŘESKOČIL: odkud se profil vezme

Návrh napsal, že `createAuthController(options)` přijme `options.deviceProfile`, a živé ověření začíná větou „Přihlas se a **zvol Osobní Mac**". **Ta volba nikde není:**

- obrazovka volby profilu **není v `approved.json`** (22 obrazovek, žádná taková);
- **není ve `spec.md`** (šestnáct funkcí, žádná taková);
- volající `createAuthController` **neexistuje** (viz §11), a až vznikne, bude v bloku `auth:begin`, který **vlastní B8**, ne B10;
- `revize-5.md:72` (A6) říká, že autoritativní zdroj (atribut účtu ze serveru) je **mimo rozsah S1** a že je potřeba to napsat rovnou.

**Závazné řešení pro B10 — postav jen to, co jde postavit bez rozhodnutí:**

1. B10 staví **čtení a vynucení** profilu: `resolveDeviceProfile`, `sharedDeviceRules`, uložení do relace, chování panelu, fronty a manifestu.
2. B10 **NESTAVÍ** obrazovku volby. `createAuthController` přijme `options.deviceProfile` a uloží ho — kdo hodnotu dodá, řeší B8 nebo pozdější story.
3. Dokud volič není, je hodnota vždy `undefined` ⇒ fail-closed ⇒ **`shared`**. To je záměr a je to vidět (věta v panelu).
4. **Do `DAN-TODO.md`:** *„B10: profil zařízení se nastavuje jedině při přihlášení, ale obrazovka volby neexistuje a není schválená. Otázka pro Dana: přepínač při prvním přihlášení (potřebuje design), nebo atribut účtu ze serveru (S1, mimo rozsah v1)? Do rozhodnutí je každý Mac `shared`."*
5. **Živé ověření kroku 1 a 2 (§16) proto do rozhodnutí NEJDE provést** a hlásí se ⛔ NEMĚŘENO, ne ✅.

### 10.1 Rozhodnutí návrhu (Claude), která stavba **nesmí měnit**

**BD-B10-1 · Profil zařízení žije v šifrované relaci, ne v Nastavení.**
Hodnoty `"personal" | "shared"`, pole `deviceProfile` v objektu, který `persistEncryptedSession` šifruje (✅ ověřeno: definice `auth.cjs:296–323`, volání `auth.cjs:397–410`). Tři důvody: (a) změna profilu pak **strukturálně vyžaduje odhlášení** — přesně oprava, kterou žádá `revize-5.md:72`; (b) Nastavení je renderer + `localStorage`, tedy neautoritativní; (c) heuristika podle e-mailu je zakázaná R6.

**BD-B10-2 · Neznámý profil = sdílený (fail-closed).**
Cokoli jiného než přesný řetězec `"personal"` (včetně `undefined`, `null`, `"Personal"`, `"personal "`, objektu) se čte jako `"shared"`. **Důvod:** obě tiché chyby jsou money chyby — sdílený Mac označený jako osobní tiše připíše hodiny zasedačce a nahrávky nikomu; osobní Mac označený jako sdílený jen **hlučně** otravuje otázkou navíc. Fail-closed = hlučná strana.
⚠️ Důsledek: relace vzniklá před B10 udělá z osobního Macu sdílený. Je to záměr a nic není v produkci (`spec.md:73`: „**Do `production` dnes nesahá nic**").

**BD-B10-3 · Skrytí časové agendy je samostatné pravidlo, ne podmíněný killswitch** (`revize-5.md:66`).

**BD-B10-4 · Na „čí to bylo" se ptá až při STOPU, volným textem, odpověď je nepovinná a NIKDY neblokuje uložení.** Prodleva je omezená (30 s) a každý únik z fáze volá `finishRecording` s `attributedTo: null` — viz §5 a TDD-7. Volný text proto, že seznam lidí umí dodat jen server (S1).

**BD-B10-5 · Fronta odesílá jen položky přihlášené identity; ostatní přeskakuje s uvedeným důvodem, nemaže je** (`transakce-concurrency.md:213`, R12).
🔴 **Fail-closed má DVĚ poloviny a obě mají test:** položka s **cizím** `owner` se neodešle (TDD-4) **a** položka **bez** `owner` se neodešle taky (TDD-4b). Bez druhé půlky projde implementace „přeskoč, jen když owner existuje a liší se", což je fail-open.

**BD-B10-6 · Manifest zůstává na `schemaVersion: 1`, nová pole mají fail-closed defaulty.**
Bump na 2 s povinnými poli je **zavržený**: povinná pole by shodila fixturu `recording()` v `tests/queue.test.js:25–58` (✅ ověřeno, že fixtura tam je a jak vypadá), tedy by si vynutila editaci cizího testu. Místo toho: `owner` default `null`, `attributedTo` default `null`, **`deviceProfile` default `"shared"`**. Znovu neotevírat.

**BD-B10-7 · (NOVÉ) Killswitch se ve frontě vyhodnocuje PŘED identitou.**
`processNext` musí i po změně vrátit `outcome: "disabled"` dřív, než se podívá na `signedInAs`. Bez toho zčervená `tests/queue.test.js:65` a `:110`, tedy dva testy, které mají zůstat zelené. Má to vlastní test (TDD-5b).

### 10.2 `electron/auth.cjs` — nové exporty

```js
/** Povolené profily zařízení. Zmrazený seznam, ne volný řetězec. */
const DEVICE_PROFILES = Object.freeze(["personal", "shared"]);

/**
 * Fail-closed čtení profilu z uložené relace.
 * Cokoli jiného než přesně "personal" je "shared".
 * @param {object|null|undefined} session
 * @returns {"personal"|"shared"}
 */
function resolveDeviceProfile(session)

/**
 * Co profil znamená pro chování panelu. Čistá funkce, žádný Electron.
 * @param {string} profile
 * @returns {{ offersTimeAgenda: boolean, asksAttribution: boolean }}
 */
function sharedDeviceRules(profile)
// "personal"    -> { offersTimeAgenda: true,  asksAttribution: false }
// cokoli jiného -> { offersTimeAgenda: false, asksAttribution: true }
```

`createAuthController(options)` přijme `options.deviceProfile` a uloží ho do relace jako
`deviceProfile: resolveDeviceProfile({ deviceProfile: options.deviceProfile })` — tedy i tady projde fail-closed normalizací, ne syrově. (✅ Ověřeno, že `persistEncryptedSession` se volá jen jednou, `auth.cjs:397`.)

**Do `module.exports` (`auth.cjs:501–506`) přidat tři položky, nic neubírat.** ✅ Ověřeno, že dnes exportuje `createAuthController, createPermissionRequestHandler, decidePermissionResult, tokenStorageDirectory` a že `tests/permissions.test.js:11` je destrukturuje jmenovitě — **přidání exportu je bezpečné**.

🔴 **Oprava proti návrhu k bráně E6:** návrh tvrdil, že `E6.sh` grepuje oba řetězce **v `auth.cjs`** a že *„přeformátování exportů v `auth.cjs` ji shodí"*. **Není to pravda.** ✅ Přečteno `scripts/akceptace/E6.sh`:

| Řádek E6 | Co skutečně kontroluje |
|---|---|
| `:15` | `grep -c "granted: true" electron/main.cjs` **musí být 0** |
| `:20` | `grep -Fq "function createPermissionRequestHandler"` v **`electron/auth.cjs`** |
| `:21` | `grep -Fq "createPermissionRequestHandler({ systemPreferences, shell })"` v 🔴 **`electron/main.cjs`** (řádek 694), ne v auth.cjs |
| `:22` | `grep -Fq "requestPermission(permission)"` v **`electron/main.cjs`** (návrh tenhle grep vůbec nezmínil) |
| `:30` | `npm run test:unit -- permissions` |

`module.exports` E6 **nekontroluje vůbec** — přeformátovat ho je bezpečné. Naopak: **nesahej na `main.cjs:694`** a **nepiš nikam do `main.cjs` řetězec `granted: true`**. Skutečná definice v auth.cjs je navíc `function createPermissionRequestHandler({ systemPreferences, shell, logger = console })` (`auth.cjs:461`) — tři parametry, ne dva; grep `:20` je na prefix, takže projde, ale packet to musí říkat správně.

### 10.3 `electron/preload.cjs` (dnes 22 řádků, ✅ přečten celý)

```js
getDeviceProfile: () => ipcRenderer.invoke("device:get-profile"),
// -> { profile: "personal"|"shared", accountName: string|null, accountEmail: string|null }

// ZMĚNA PODPISU, aditivní a zpětně kompatibilní (dnes preload.cjs:14):
finishRecording: (sessionId, attribution) =>
  ipcRenderer.invoke("recording:finish", sessionId, attribution),
// attribution?: { attributedTo: string|null }
```

🔴 **Jediná změna API kontraktu v celé story.** Je aditivní, ale `MASTERPLAN.md:642` ji vyžaduje mít v plánu. Plán je zmrazený ⇒ **zapiš ji do `DAN-TODO.md`** s odkazem na tenhle packet; do `plan.md` ji propíše orchestrátor, ne implementátor.

### 10.4 `src/lib/manifest.js` (✅ přečten celý, 150 řádků)

`createManifest(metadata, state)` (`:64–84`) skládá **pevný objekt o šesti klíčích**. Přidat do něj:

```js
owner:         metadata.owner ?? null,            // { accountEmail: string } | null
attributedTo:  metadata.attributedTo ?? null,     // string | null
deviceProfile: metadata.deviceProfile === "personal" ? "personal" : "shared", // fail-closed
```

⚠️ `canonicalJson` (`:123`) **hází výjimku na `undefined`** (`:112–114`) — proto jsou defaulty `null`, ne `undefined`.

🔴 **`transitionManifest` (`:87–100`) musí všechna tři pole přenést A NAVÍC honorovat `updates.attributedTo`.**
✅ Ověřeno: dnes skládá výsledek ze **čtyř jmenovaných polí** (`:95–98` — `clientRecordingId`, `createdAt`, `closedAt`, `tracks`), takže pole přidané jen do `createManifest` se při uzavření **tiše zahodí**. `revize-3.md:119` tuhle past našla na poli `label` a doslova říká: *„`transitionManifest` musí `label` přenášet, jinak funkce DSK-F008 zmizí bez chybové hlášky."*

🔴 **Oprava proti návrhu — bez `updates.attributedTo` je story nesplnitelná.** Návrh psal jen „musí všechna tři pole přenést", tedy **přenést ze zdrojového manifestu**. Jenže `attributedTo` vzniká **až při stopu**, ve zdrojovém manifestu je vždycky `null`. Živé ověření §16 krok 3 přitom po `attributedTo == "Marcela"` v uzavřeném manifestu **výslovně sahá**. Jak to bylo napsané, nemohlo to nikdy nastat. Závazný tvar:

```js
return createManifest({
  clientRecordingId: manifest.clientRecordingId,
  createdAt:     manifest.createdAt,
  closedAt:      Object.hasOwn(updates, "closedAt") ? updates.closedAt : manifest.closedAt,
  tracks:        Object.hasOwn(updates, "tracks")   ? updates.tracks   : manifest.tracks,
  owner:         manifest.owner,          // přenos ze zdroje
  deviceProfile: manifest.deviceProfile,  // přenos ze zdroje
  attributedTo:  Object.hasOwn(updates, "attributedTo") ? updates.attributedTo : manifest.attributedTo,
}, nextState);
```

### 10.5 `src/lib/queue.js` (✅ přečten celý, 255 řádků)

```js
// enqueueRecording (:120-151) skládá PEVNÝ objekt položky (:131-145) -> owner přidat výslovně
enqueueRecording(queue, recording, now)
// recording.owner?: { accountEmail: string } -> item.owner = recording.owner ?? null

// processNext: options UŽ EXISTUJE (:195, dnes nese now/retryPolicy/random).
// Přibývá do něj JEDEN KLÍČ, nový parametr to není.
processNext(queue, uploadEnabled, send, options)
// options.signedInAs?: string|null — e-mail právě přihlášené identity

// Pořadí vyhodnocení je ZÁVAZNÉ (BD-B10-7):
//  1) uploadEnabled !== "true"  -> { item:null, outcome:"disabled", queue, reason: UPLOAD_DISABLED_REASON }
//  2) signedInAs prázdné/chybí  -> { item:null, outcome:"no_identity", queue, reason:"fronta nezná přihlášenou identitu" }
//  3) výběr položky: WAITING && čas dozrál && item.owner?.accountEmail === signedInAs
//  4) nic nevybráno -> { item:null, outcome:"idle", queue, reason:"žádná položka není připravená" }

/** Aby cizí položka tiše nezmizela: souhrn pro patičku. */
queueOwnerSummary(queue, signedInAs) // -> { mine: number, others: number, unowned: number }
```

🔴 **Oprava proti návrhu:** návrh u `no_identity` vracel `{ item, outcome, reason }` **bez `queue`**. Všechny ostatní návraty `processNext` `queue` obsahují (`:203, :212, :232–237, :248–253`) a existující test na řádku 135 sahá na `result.queue.items` — bez `queue` by to skončilo `TypeError`, ne assertion. **`queue` vracej vždy.**

`QUEUE_SCHEMA_VERSION` zůstává **1**. Stará položka bez `owner` je fail-closed „není moje" (BD-B10-5).

### 10.6 `electron/main.cjs`

```js
// nový modulový stav — autorita je hlavní proces, ne renderer
let deviceProfile = "shared";              // fail-closed startovní hodnota
let signedInAccount = null;                // { name, email } | null
function currentDeviceProfile()            // -> "personal" | "shared"

// nový IPC kanál přes existující handleValidated (:151-156)
handleValidated("device:get-profile", ["panel", "settings"], () => ({ ... }));
```

🔴 **ZMĚNA PODPISU, kterou návrh zapomněl a bez které to nejde:**

```js
// dnes (:581): async function finalizeRecordingSession(sessionId, finalState)
async function finalizeRecordingSession(sessionId, finalState, attribution = null)
```

✅ Ověřeno, že funkce má **tři volající** a dva z nich jsou pádové cesty, kde se nikdo neptá:

| Volající | Řádek | Co předat |
|---|---|---|
| handler `recording:finish` | `:678` | druhý argument z IPC |
| `destroyedListener` (pád rendereru) | `:516` | **nic — fail-closed `null`** |
| `finalizeRecordingSessionsForOwner` | `:654` | **nic — fail-closed `null`** |

`updates` předávané do `transitionManifest` (`:623–631`) pak nese navíc `attributedTo: attribution?.attributedTo ?? null`.

---

## 11. Dependencies

| Závislost | Stav ✅ ověřený v kódu | Co z toho plyne |
|---|---|---|
| **B8** — zapojit `createAuthController` | ⛔ **NEHOTOVO.** `grep -rn createAuthController electron src tests scripts` vrací **jen** definici (`auth.cjs:325`) a export (`:502`). `main.cjs:681–692` je atrapa vracející natvrdo `user: { name: "Daniel Novák", email: "daniel@ludone.cz" }`. | 🔴 **B10 se nesmí začít stavět dřív, než je B8 v `main`.** Bez B8 neexistuje skutečná identita ani relace, do které by se profil ukládal. |
| 🔴 **Druhá atrapa uživatele, kterou návrh nezmínil** | ⛔ `src/App.jsx:9` má `const DEFAULT_USER = { name: "Daniel Novák", email: "daniel@ludone.cz" }`, používá se na `:15` a `:52`. | Patička dnes zobrazuje **rendererovu konstantu**, ne účet z relace. Dokud to platí, „panel nese jméno účtu, pod kterým se nahrává" **není pravda a nejde ověřit**. Vlastnictví `App.jsx:9` **plán neurčuje** → viz §12.1. |
| **B7** — zapojit frontu | ⛔ nehotovo. ✅ `src/lib/queue.js` (255 řádků) importuje **jen `tests/queue.test.js:15`**; `scripts/akceptace/E5.sh:60` jen kontroluje, že soubor není prázdný. | ⚠️ B7 i B10 sahají do `src/lib/queue.js`. `plan.md` §2 řeší vlastnictví bloků jen pro `main.cjs` a `preload.cjs`. B10 se pouští **až po mergnutí B7**, jinak jeho fronta-část jde do B10b. |
| **B3** — autorita tray stavu | ⛔ nehotovo. ✅ `deriveTrayState` v `electron/` neexistuje (žije jen v `plan.md:118` a `specs/E3-vady-a-identita.md`). B3 sahá do `src/App.jsx`, kam sahá i B10. | B10 běží až po B3 (vlna 2 < vlna 4). |
| **B6** — výběr projektu | ⛔ nehotovo. Vlastní `src/features/tracking/TrackingCard.jsx` (77 řádků). | 🔴 **B10 do `TrackingCard.jsx` NESAHÁ.** Skrývání řeší `App.jsx:86` tím, že komponentu nevykreslí. |
| **B5** — `electron/tracking.cjs` | ⛔ ✅ soubor neexistuje (`ls electron/` = `auth.cjs`, `ikony`, `main.cjs`, `preload.cjs`, `queue.cjs`). | ⚠️ `plan.md:151` uvádí u B10 soubor `tracking.cjs`. **Tenhle packet ho z rozsahu vyřazuje** — B10 časovač neupravuje, jen ho nevykresluje. Vynucení uvnitř `tracking.cjs` je práce po B5 a patří do samostatného tasku. |
| **`DSK-F008`** — pojmenování při stopu (M19) | ⛔ ✅ nemá story v B1–B12 (`plan.md` §2b, řádky 142–153). UX doc řádek 72 ho vede mezi momenty, které „nemají kde proběhnout". | B10 staví pole „čí to bylo" jako **samostatný krok po stopu**, konstruovaný tak, aby ho budoucí obrazovka pojmenování pohltila. Rozpor s návrhem viz §6. |
| **T1** — `fix/tray-prazdna-ikona` | ✅ **ZMĚŘENO, ne odhadnuto:** `git diff main fix/tray-prazdna-ikona -- electron/main.cjs` mění jen hunky `@@ -199,34 @@` a `@@ -246,10 @@`, tedy oblast tray ikon a `shouldHidePanelOnBlur`. | ✅ **Žádný překryv s bloky B10** (462–535, 581–647, 676–679, 708). Tuhle položku měl předchozí návrh mezi neověřenými — teď je změřená. |

**Pořadí podle `plan.md:171`:** čtvrtá vlna, „B10 (návrh po B8, stavba až po návrhu)". Tenhle packet **je ten návrh**. Stavba smí začít, jakmile jsou v `main` B3, B7 a B8.

---

## 12. Přesné soubory

### 12.1 Vlastnictví bloků ve sdílených souborech

🔴 **`plan.md:126–127` doslova:** *„Task packet musí vlastnictví zadat VÝČTEM, ne větou ‚nesahej na cizí'. Próza prohraje s prvním ‚tady to logicky patří taky'; výčet umí vykonavatel použít jako filtr při každé editaci."* — a `plan.md:104–106`: **devět z dvanácti stories sahá do `electron/main.cjs`, osm do `electron/preload.cjs`.**

**Tabulka z `plan.md:116–124`, opsaná doslova (cizí bloky — NESAHAT):**

| Story | Vlastní v `main.cjs` | Vlastní v `preload.cjs` |
|---|---|---|
| **B3** | `trayIconName`, `updateTray`, `deriveTrayState`, registrace tray | odebrat `setTrayState` |
| **B4** | `shouldHidePanelOnBlur` a jeho čítače | nic |
| **B5** | registrace `tracking:*` kanálů, hook na pád rendereru | přidat `tracking:*` |
| **B7** | zapojení fronty, `queue:*` kanály | přidat `queue:*` |
| **B8** | `auth:begin` a jeho okolí | `beginAuth` |
| **B9** | `auth:logout` | přidat `logout` |
| **B11** | nic | nic |

⚠️ **B10 v té tabulce řádek NEMÁ** — `plan.md:129–130` to přiznává: *„B2, B10 a B12 mají soubory neurčené a nesmí se pouštět, dokud se neurčí… B10 nejdřív návrh."* Řádek doplňuje tenhle packet:

| Story | Vlastní v `main.cjs` | Vlastní v `preload.cjs` | Vlastní jinde |
|---|---|---|---|
| **B10** | `deviceProfile` / `signedInAccount` / `currentDeviceProfile` (nové) · registrace `device:get-profile` · **v `createRecordingSession` jen objektový literál `:491–496`** · **podpis `finalizeRecordingSession` `:581` + `updates` literál `:623–631` + `attribution` na volajících `:516` a `:654`** · **v handleru `recording:finish` `:676–679` jen průchod druhého argumentu** | přidat `getDeviceProfile`, rozšířit `finishRecording` (`:14`) o druhý argument | `App.jsx` odznak v patičce + nevykreslení `TrackingCard` · `RecordingCard.jsx` fáze `attributing` |

🔴 **NOVĚ přidané do vlastnictví (návrh je neměl a bez nich se story nedá postavit):** podpis `finalizeRecordingSession` a jeho dva pádové volající. Bez toho se `attributedTo` do manifestu nedostane a implementátor by musel scope rozšířit sám — což mu `MASTERPLAN.md:639` zakazuje.

🔴 **NEURČENÉ VLASTNICTVÍ — OTEVŘENÁ OTÁZKA:** `src/App.jsx:9` (`DEFAULT_USER`). Odstranit ho patří k B8 (skutečná identita), ale plán to nikomu nepřidělil. **B10 na `App.jsx:9` NESAHÁ**; do PR napiš, že patička proto pořád ukazuje konstantu, a do `DAN-TODO.md`, že vlastníka téhle atrapy musí určit orchestrátor.

**Filtr pro KAŽDOU editaci `main.cjs`** (kotvy ✅ ověřené na `9863d53`; `main.cjs` má 752 řádků):

| Rozsah | Co tam je | B10 |
|---|---|---|
| `:170–191` | `configureWritablePaths` (🔴 oprava: návrh psal `170–201`) | ⛔ nesahat |
| `:202–230` | `traySvg`, `trayIconName` | ⛔ **cizí — B3** |
| `:232–246` | komentář + `permissionPromptsInFlight` (`:237`) + `shouldHidePanelOnBlur` (`:241–246`) | ⛔ **cizí — B4** (🔴 oprava: návrh psal `241–247` a čítač na `:237` mu vypadl) |
| `:248–266` | `trayImage`, `updateTray` | ⛔ **cizí — B3** |
| `:462–535` | `createRecordingSession` (🔴 oprava: návrh psal `462–536`) | ✅ **jen `:491–496`** (literál pro `createManifest`) |
| `:581–647` | `finalizeRecordingSession` | ✅ **podpis `:581` a `updates` literál `:623–631`** |
| `:649–660` | `finalizeRecordingSessionsForOwner` | ✅ **jen volání `:654`** (dopsat `null`) |
| `:662–675` | registrace `tray:*`, `recording:begin/append` (🔴 oprava: návrh začínal `:664`, `tray:set-state` je na `:662`) | ⛔ nesahat |
| `:676–679` | `recording:finish` | ✅ **průchod druhého argumentu** |
| `:681–692` | `auth:begin` (atrapa) | ⛔ **cizí — B8.** Po mergnutí B8 sem B10 přidá **jediný řádek**: `deviceProfile` do `createAuthController` |
| `:694` | `const requestPermission = createPermissionRequestHandler({ systemPreferences, shell });` | ⛔ 🔴 **NESAHAT — tenhle přesný řetězec grepuje `E6.sh:21`** |
| `:695–707` | `permission:request` | ⛔ nesahat; a **nikdy sem nepiš `granted: true`** (`E6.sh:15`) |
| **mezi `:707` a `:709`** | prázdný řádek `:708` | ✅ **sem patří registrace `device:get-profile`** |
| `:709–714` | `test:quit` | ⛔ nesahat |

**Jeden strom = jeden zapisovatel.** Ve vlně 4 běží souběžně B9 (`auth:logout`) a B11 (v `main.cjs` nic) — s B10 se neprotínají. ✅ Ověřeno, že ani zmrazená větev `fix/tray-prazdna-ikona` se s B10 neprotíná.

### 12.2 Soubory, které story mění

| Soubor | Co se v něm dělá | ~řádky bez testů |
|---|---|---|
| `electron/auth.cjs` | `DEVICE_PROFILES`, `resolveDeviceProfile`, `sharedDeviceRules`, uložení do relace, doplnění exportů | ~45 |
| `electron/main.cjs` | jen bloky z §12.1 (včetně podpisu `finalizeRecordingSession` a dvou pádových volajících) | ~40 |
| `electron/preload.cjs` | `getDeviceProfile`, druhý argument u `finishRecording` | ~4 |
| `src/lib/manifest.js` | tři pole v `createManifest`, jejich přenos + `updates.attributedTo` v `transitionManifest` | ~24 |
| `src/lib/queue.js` | `owner` na položce, dvoustupňový filtr v `processNext`, `queueOwnerSummary` | ~40 |
| `src/App.jsx` | odznak v **patičce**, věta místo karty času, nevykreslení `TrackingCard` | ~45 |
| `src/features/recording/RecordingCard.jsx` | fáze `attributing` + pole + tři úniky s `null` + 30s strop | ~70 |
| **celkem** | | **≈ 268** — 🔴 **nad limitem** |

🔴 **Oprava proti návrhu:** návrh odhadoval 234 („těsně pod") a stavěl na tom, že se dělit nemusí. Po doplnění chybějících kusů (podpis `finalizeRecordingSession`, `updates.attributedTo`, tři únikové cesty z fáze `attributing`, druhá půlka fail-closed filtru) je odhad **~268**, tedy **nad ~250** z `plan.md:137`. ⚠️ Je to pořád **odhad, ne změřený diff**. **Postupuj tak, že dělíš:**

- **B10a** — `auth.cjs` + `manifest.js` + `main.cjs` + `preload.cjs` + odznak a věta v `App.jsx`;
- **B10b** — `queue.js` (vlastník + dvoustupňový filtr + souhrn) + fáze `attributing` v `RecordingCard.jsx`.

Když ti změřený diff B10a+B10b vyjde pod 250 řádků, smíš to spojit — ale **změř to (`git diff --stat` bez `tests/`), nehádej**.

### 12.3 Nové soubory

| Soubor | Účel |
|---|---|
| `tests/device-profile.test.js` | fail-closed profil, pravidla profilu, kanárkovaný detektor úniku |

### 12.4 Kam se NESMÍ sáhnout

`design/**` (`plan.md:190`, `AGENTS.md`) · `docs/changes/desktop-v1/spec.md` a `plan.md` (zmrazené) · `src/features/tracking/TrackingCard.jsx` (B6) · `scripts/akceptace/**` (brány) · `src/App.jsx:9` `DEFAULT_USER` (neurčené vlastnictví) · `.env*`, `*.key`, `*.pem`.

---

## 13. TDD kroky

`MASTERPLAN.md:808–820`: napiš failing test → **spusť ho a ověř správný důvod selhání** → minimální řešení → GREEN → širší brány. `plan.md:180` bod 1: *„Cílený test **napřed** a viděný **červený** ze správného důvodu."* Bod 2 (`:181`): *„všechny EXIT=0, **měřeno před rourou**."*

Styl testů v repu (✅ ověřeno, dodrž): `.cjs` se načítá přes `createRequire` (viz `tests/permissions.test.js:1–11`), `src/lib/**` běžným ESM importem (viz `tests/queue.test.js:5–15`). Běží `npm run test:unit`, prostředí `node` (`vitest.config.js`).

⚠️ **Úryvky níž jsou ilustrace, ne hotové soubory.** `tests/**/*.js` je pod `checkJs` typecheckem (`jsconfig.json` `include`) i pod `js.configs.recommended` lintem — **každý identifikátor musí být naimportovaný** (`readFileSync`, `vi`, …). Úryvek, který zkopíruješ bez importů, shodí `npm run lint`.

🔴 **Doslovné výpisy níž jsou ODVOZENÉ z formátu Vitestu 3.2.7, ne opsané z běhu.** Do PR patří to, co vypsal **tvůj** běh. Když se tvar liší, vyhrává tvůj běh — ale rozdíl napiš.

### TDD-1 · Neznámý profil je sdílený (fail-closed)

**Soubor:** `tests/device-profile.test.js` (nový)

```js
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
const require = createRequire(import.meta.url);
const { resolveDeviceProfile } = require("../electron/auth.cjs");

describe("profil zařízení je fail-closed", () => {
  it.each([
    [undefined], [null], [{}], [{ deviceProfile: "" }],
    [{ deviceProfile: "Personal" }], [{ deviceProfile: "personal " }],
    [{ deviceProfile: "shared" }], [{ deviceProfile: { value: "personal" } }],
  ])("z %o dělá sdílené zařízení", (session) => {
    expect(resolveDeviceProfile(session)).toBe("shared");
  });

  it("jen přesné \"personal\" znamená osobní Mac", () => {
    expect(resolveDeviceProfile({ deviceProfile: "personal" })).toBe("personal");
  });
});
```

**Jak ho vidět červený ze SPRÁVNÉHO důvodu — dvě fáze, druhá je ta, o kterou jde:**

*Fáze A* (funkce ještě není): `npm run test:unit -- device-profile` vypíše `TypeError: resolveDeviceProfile is not a function`. Legitimní start, ale **není to důkaz, že pravidlo měří**.

*Fáze B* (naivní implementace `return session?.deviceProfile;`) musí vypsat sedm selhání typu:
```
AssertionError: expected undefined to be 'shared' // Object.is equality
AssertionError: expected 'Personal' to be 'shared' // Object.is equality
```
🔴 **Do PR patří fáze B, ne fáze A** (`plan.md:158`: *„Doslovný výpis červeného testu před opravou. Ne ‚test padal', ale co vypsal."*).

### TDD-2 · Sdílené zařízení nenabízí čas

```js
expect(sharedDeviceRules("shared")).toEqual({ offersTimeAgenda: false, asksAttribution: true });
expect(sharedDeviceRules(undefined)).toEqual({ offersTimeAgenda: false, asksAttribution: true });
expect(sharedDeviceRules("personal")).toEqual({ offersTimeAgenda: true, asksAttribution: false });
```

### TDD-3 · Uzavření manifestu nesmí vlastníka ani přiřazení tiše zahodit 🔴

**Soubor:** `tests/manifest.test.js` (nový `describe`, existující bloky nesahat)

🔴 **Oprava proti návrhu — návrh měl na `deviceProfile` PRÁZDNOU assertion.** Fail-closed default v `createManifest` je `"shared"`. Kdyby otevřený manifest nesl `deviceProfile: "shared"` a `transitionManifest` pole zahodil, `createManifest` ho **dosadí zpátky jako `"shared"`** a `expect(closed.deviceProfile).toBe("shared")` **projde i s vadou**. Právě tu vadu má test chytat. ⇒ **Otevřený manifest musí nést `"personal"`**, tedy hodnotu, kterou default nikdy nevyrobí.

```js
const open = createManifest({
  clientRecordingId: "9e586e55-d688-43f1-8a80-a3d61e754f3e",
  createdAt: STARTED_AT, closedAt: null, tracks: manifestMetadata().tracks,
  owner: { accountEmail: "zasedacka@makemore.cz" },
  deviceProfile: "personal",            // 🔴 NE "shared" — jinak assertion nic neměří
}, "recording");

const closed = transitionManifest(open, "complete", {
  closedAt: ENDED_AT, tracks: closedTracks(),
  attributedTo: "Marcela",              // 🔴 přichází až při stopu, přes updates
});

expect(closed.owner).toEqual({ accountEmail: "zasedacka@makemore.cz" });
expect(closed.deviceProfile).toBe("personal");
expect(closed.attributedTo).toBe("Marcela");
```

**Jak ho vidět červený ze správného důvodu:** nejdřív rozšiř **jen** `createManifest`, `transitionManifest` nech být. Očekávaný tvar (🔴 **oprava: `null`, ne `undefined`** — návrh psal `expected undefined`, ale `createManifest` má `?? null`):
```
AssertionError: expected null to deeply equal { accountEmail: 'zasedacka@makemore.cz' }
AssertionError: expected 'shared' to be 'personal' // Object.is equality
AssertionError: expected null to be 'Marcela' // Object.is equality
```
⚠️ **Změřená past, ne hypotéza:** `manifest.js:94–99` skládá výsledek ze čtyř jmenovaných polí. `revize-3.md:119` ji našla na poli `label`.

### TDD-4 · Fronta neodešle nahrávku jiného člověka 🔴 money/RBAC

**Soubor:** `tests/queue.test.js` (nový `describe`)

🔴 **Oprava proti návrhu:** návrh nastavoval `process.env.DESKTOP_UPLOAD_ENABLED = "true"`. `processNext` **žádnou proměnnou prostředí nečte** (✅ ověřeno, `queue.js:195–204`) — killswitch dostává jako argument. Řádek je zbytečný a naznačuje, že se test nikdy nespustil. Vynech ho.

```js
const send = vi.fn();
const q = enqueueRecording(createQueue(), {
  ...recording(), owner: { accountEmail: "anna@makemore.cz" },
}, 1_777_000_000_000).queue;

const result = await processNext(q, "true", send, {
  now: 1_777_000_001_000, signedInAs: "bohus@makemore.cz",
});

expect(send).not.toHaveBeenCalled();
expect(result.outcome).toBe("idle");
expect(result.item).toBeNull();
expect(result.queue.items[0].state).toBe(QUEUE_STATES.WAITING); // R12: nesmaže se
```

**Očekávaný červený výpis před filtrem:**
```
AssertionError: expected "spy" to not be called at all, but actually been called 1 times
```
🔴 Tohle je jádro celé story: **bez filtru odešle Bohuš Aninu schůzku pod svým jménem.**

### TDD-4b · 🔴 NOVÝ — položka BEZ vlastníka se taky neodešle

Bez tohohle testu projde fail-open implementace „přeskoč, jen když `owner` existuje a liší se". Přesně ta implementace odešle **každou položku z doby před B10**.

```js
const q = enqueueRecording(createQueue(), recording(), 1_777_000_000_000).queue; // bez owner
const result = await processNext(q, "true", send, { now: 1_777_000_001_000, signedInAs: "bohus@makemore.cz" });
expect(send).not.toHaveBeenCalled();
expect(result.outcome).toBe("idle");
```

### TDD-5 · Chybějící identita je fail-closed

```js
const result = await processNext(q, "true", send, { now: 1_777_000_001_000 });
expect(send).not.toHaveBeenCalled();
expect(result.outcome).toBe("no_identity");
expect(result.reason).toBe("fronta nezná přihlášenou identitu");
expect(result.queue.items).toHaveLength(1);   // 🔴 queue MUSÍ být v návratu
```

### TDD-5b · 🔴 NOVÝ — killswitch se vyhodnocuje PŘED identitou

Chrání `tests/queue.test.js:65` a `:110`, které mají zůstat zelené (BD-B10-7).

```js
const result = await processNext(oneItemQueue(), undefined, send, { signedInAs: "kdokoli@makemore.cz" });
expect(result.outcome).toBe("disabled");      // ne "no_identity"
expect(result.reason).toBe(UPLOAD_DISABLED_REASON);
```

### TDD-6 · Odpověď „čí to bylo" se nesmí dostat do logu — s KANÁRKY

**Soubor:** `tests/device-profile.test.js`

🔴 **Oprava proti návrhu — jeden kanárek nestačí.** Detektor má dvě alternativy (`attributedTo`, `accountEmail`); sabotáž, která odstraní jen `accountEmail`, nechá kanárek na `attributedTo` zelený. **Kanárek musí být na každou alternativu.**

```js
import { readFileSync } from "node:fs";

const SLEDOVANE = ["attributedTo", "accountEmail"];
function najdiUnik(zdroj) {
  const re = new RegExp(`console\\.(log|warn|error|info)[^\\n]*\\b(${SLEDOVANE.join("|")})\\b`);
  return zdroj.split("\n").flatMap((r, i) => (re.test(r) ? [i + 1] : []));
}

it.each(SLEDOVANE)("KANÁRKO: detektor najde vlastní podvrh s %s", (jmeno) => {   // MUSÍ být první
  expect(najdiUnik("console.log(`[recording] ${" + jmeno + "}`);")).toHaveLength(1);
});

it.each(["../electron/main.cjs", "../electron/auth.cjs", "../src/features/recording/RecordingCard.jsx"])(
  "%s nikam neloguje přiřazení ani e-mail účtu",
  (cesta) => {
    expect(najdiUnik(readFileSync(new URL(cesta, import.meta.url), "utf8"))).toEqual([]);
  },
);
```

🔴 **Bez kanárka je to rozbitý grep** (`spec.md:334`: *„Grep, který nenajde ani kanárka, je rozbitý grep — ne důkaz čistoty."*).

🔴 **PŘIZNANÁ HRANICE MĚŘIDLA — napiš ji do PR, ať se nevydává za víc, než je.** Detektor chytá **jen** `console.*` s **doslovným** názvem pole na **stejném řádku**. Nechytá: přejmenovanou proměnnou (`const kdo = attribution.attributedTo; console.log(kdo)`), víceřádkové volání, `process.stdout.write`, ani text vložený do `Error.message`, který se pak vypíše přes `error.stack` (a to `main.cjs` dělá na `:517`, `:657`). ⇒ Zelený TDD-6 je 🧪, ne ✅; jediný důkaz čistoty je **krok 4 živého ověření** (§16).

### TDD-7 · 🔴 NOVÝ — prázdná odpověď uložení neblokuje

`RecordingCard` musí ve všech třech únikových cestách zavolat `finishRecording(sessionId, { attributedTo: null })`. Test nad čistou funkcí rozhodování (vytáhni ji z komponenty ven, ať jde měřit bez GUI — stejný důvod, proč je `shouldHidePanelOnBlur` samostatná funkce, viz komentář `main.cjs:239–240`):

```js
expect(attributionOutcome({ reason: "enter", text: "" })).toEqual({ attributedTo: null, finish: true });
expect(attributionOutcome({ reason: "skip" })).toEqual({ attributedTo: null, finish: true });
expect(attributionOutcome({ reason: "panel-closed" })).toEqual({ attributedTo: null, finish: true });
expect(attributionOutcome({ reason: "timeout" })).toEqual({ attributedTo: null, finish: true });
expect(attributionOutcome({ reason: "enter", text: "Marcela" })).toEqual({ attributedTo: "Marcela", finish: true });
```

### 🔴 Testy, které se MUSÍ upravit — a proč to NENÍ změkčení měřidla

Tohle je největší oprava celé revize. **Návrh prohlásil dva soubory za „nedotknutelné a musí zůstat zelené". Obojí naráz je nesplnitelné.** Změřeno na `9863d53`:

**(1) `tests/ipc-sender-guard.test.js:186–210` vyjmenovává VŠECH DVANÁCT kanálů vyčerpávajícím `toEqual`.** Nový kanál `device:get-profile` ho zaručeně shodí:
```
AssertionError: expected [ 'auth:begin', 'device:get-profile', …13 more ] to deeply equal [ 'auth:begin', 'panel:hide', …10 more ]
```
**Závazný postup:** do pole na `:191–204` přidej **jediný řetězec `"device:get-profile"`**. Assertions na `:205–209` (žádné holé `ipcMain.`, `handleValidated` obsahuje `requireTrustedSender`, …) zůstávají **bajt po bajtu stejné**. **Důkaz do PR:** `git diff tests/ipc-sender-guard.test.js` musí mít **přesně jeden přidaný řádek a nula odebraných**. Zapsat nový kanál do inventury není oslabení assertion — je to registrace kanálu, kterou ten test právě vynucuje. Odebrat kterýkoli jiný řádek **je** změkčení a je zakázané (`MASTERPLAN.md:825–832`).

**(2) Tři existující testy v `tests/queue.test.js` volají `processNext` BEZ `signedInAs`** a pod BD-B10-5 by zčervenaly:

| Řádek | Test | Co by se stalo bez opravy |
|---|---|---|
| `:94–108` | „s hodnotou true zavolá pouze mockovanou odesílací vrstvu" | `expected "spy" to be called 1 times, but got 0 times` |
| `:127–142` | „neúspěch ponechá položku ve frontě a zvýší počet pokusů" | čte `result.queue.items` → **TypeError**, kdyby `no_identity` nevracelo `queue` |
| `:144–163` | „po vyčerpání pokusů označí položku jako selhalo a nesmaže ji" | `expected 'no_identity' to be 'failed'` |

**Závazný postup:** do `options` každého z těch tří volání přidej `signedInAs` a do fixtury `recording()` odpovídající `owner`. **Ani jeden `expect` se nesmí změnit.** **Důkaz do PR:** `git diff tests/queue.test.js` obsahuje jen přidané klíče `signedInAs:` / `owner:` — **žádný řádek začínající `-` uvnitř `expect(`**. Dodat funkci povinný vstup není oslabení assertion; oslabení by bylo assertion smazat nebo změkčit.

🔴 **Kdyby ti tohle vyšlo jinak — zastav a vrať otázku.** Nepřepisuj assertions, ať jsou zelené.

### Případy, které musí zůstat ZELENÉ a NEDOTČENÉ

`plan.md:183` chce poměr 2–3 červené : 1 zelená.

| Test | Proč právě on | Ověřeno |
|---|---|---|
| `tests/queue.test.js:65` „s nenastaveným `DESKTOP_UPLOAD_ENABLED` záměrně nic neodešle" | killswitch musí přežít beze změny (R18) — chrání ho BD-B10-7 a TDD-5b | ✅ řádek sedí |
| `tests/queue.test.js:110` „jiná pravdivostní hodnota odesílání nezapne" | totéž, boolean `true` | ✅ |
| `tests/queue.test.js:118` „dvojí zařazení stejného `clientRecordingId` vytvoří jedinou položku" | idempotence R10/R22, nový `owner` ji nesmí rozbít | ✅ |
| `tests/queue.test.js:194` „vyžaduje killswitch v podpisu spolu s odesílací vrstvou" | `arguments.length < 3` — nová logika ho nesmí předběhnout | ✅ |
| `tests/manifest.test.js:98–102` | 🔴 **past, kterou návrh neuvedl:** ten test **grepuje `main.cjs`** na doslovné řetězce `await writeManifestAtomically(manifestPath` (`main.cjs:498`) a `return { sessionId, startedAt:` (`main.cjs:523`) a hlídá jejich **pořadí**. Blok, který B10 edituje (`:491–496`), leží **mezi nimi**. **Nepřeformátuj `:498` ani `:523`.** | ✅ přečteno |
| `tests/permissions.test.js` | `auth.cjs` mění exporty; ✅ ověřeno, že test destrukturuje jmenovitě (`:11`), takže přidání exportu je bezpečné | ✅ |
| `tests/recording-order-guard.test.js`, `tests/tray-authority.test.js` | ✅ ověřeno, že grepují jen `appendRecordingChunk`, `trayImage`, `updateTray` — B10 se jich netýká | ✅ |

---

## 14. Sabotážní testy

`plan.md:182`: *„Sabotáž, která prokazatelně chytá odstranění guardu, s **doslovným výpisem**."*
**Postup u každé:** rozbij → `npm run test:unit` → ulož doslovný výpis → `git checkout -- <soubor>`.
🔴 **Sabotáž, kterou brána nechytí, je důkaz, že brána neměří** — takovou nahlas jako blocker, ne jako drobnost.

| # | Co rozbít v produkčním kódu | Která brána musí zčervenat | Očekávaný tvar výpisu |
|---|---|---|---|
| **SB-1** | `auth.cjs`, `resolveDeviceProfile`: fail-closed default `"shared"` → `"personal"` | TDD-1 | `AssertionError: expected 'personal' to be 'shared'` — **osmkrát**, jednou za každý řádek `it.each` |
| **SB-2** | `manifest.js`, `transitionManifest`: vypustit `owner` z přeskládaného objektu | TDD-3 | 🔴 `expected null to deeply equal { accountEmail: 'zasedacka@makemore.cz' }` (**`null`, ne `undefined`** — `createManifest` má `?? null`) |
| **SB-2b** | 🔴 **NOVÁ** — `transitionManifest`: přestat honorovat `updates.attributedTo` | TDD-3 | `expected null to be 'Marcela'` |
| **SB-2c** | 🔴 **NOVÁ** — `transitionManifest`: vypustit `deviceProfile` | TDD-3 | `expected 'shared' to be 'personal'` — **tahle sabotáž byla v návrhu neodhalitelná**, protože se testovalo proti default hodnotě |
| **SB-3** | `queue.js`, `processNext`: smazat podmínku vlastníka z `findIndex` | TDD-4 | `expected "spy" to not be called at all, but actually been called 1 times` |
| **SB-3b** | 🔴 **NOVÁ** — filtr změnit na fail-open (`!item.owner \|\| item.owner.accountEmail === signedInAs`) | TDD-4b | tentýž tvar; **TDD-4 zůstane zelený** — proto TDD-4b existuje |
| **SB-4** | `auth.cjs`, `sharedDeviceRules`: vrátit `{ offersTimeAgenda: true, asksAttribution: false }` pro všechno | TDD-2 | `expected { offersTimeAgenda: true, … } to deeply equal { offersTimeAgenda: false, … }` |
| **SB-5** | `main.cjs`: přidat `console.log(\`[recording] ${attribution?.attributedTo}\`)` do `finalizeRecordingSession` | TDD-6 (kontrola souborů) | `AssertionError: expected [ <číslo řádku> ] to deeply equal []` — ⚠️ **číslo je to, kam log vložíš**; nevymýšlej ho dopředu |
| **SB-6** | **sabotáž měřidla:** v TDD-6 zkaz jednu alternativu (`attributedTo` → `attributedToX`) | TDD-6 (**kanárek**) | `expected [] to have a length of 1 but got +0` |
| **SB-6b** | 🔴 **NOVÁ** — zkaz **druhou** alternativu (`accountEmail`) | TDD-6 (**druhý kanárek**) | totéž; **v návrhu s jediným kanárkem tahle sabotáž prošla nepovšimnuta** |
| **SB-7** | `queue.js`: `signedInAs` prázdné ať propadne na `idle` místo `no_identity` | TDD-5 | `expected 'idle' to be 'no_identity'` |
| **SB-7b** | 🔴 **NOVÁ** — prohoď pořadí: identita se vyhodnotí před killswitchem | TDD-5b **a** `queue.test.js:65` | `expected 'no_identity' to be 'disabled'` |
| **SB-9** | 🔴 **NOVÁ** — `RecordingCard`: při prázdném poli `finishRecording` nezavolat | TDD-7 | `expected { finish: false … } to deeply equal { attributedTo: null, finish: true }` |

**SB-8 — sabotáž, kterou unit testy NECHYTÍ, a to je nález, ne selhání:**
smaž `deviceProfile` z objektu ukládaného v `persistEncryptedSession` (`auth.cjs:397–410`). Testy zůstanou zelené, protože fail-closed pravidlo pořád platí — jenže po restartu se **z osobního Macu stane sdílený**.
🔴 Chytá to **jen krok 5 živého ověření** (§16). Napiš to do PR jako **známou hranici bran**, ne jako zamlčenou díru.

---

## 15. Projektové brány

**Před rourou měř EXIT** (`AGENTS.md`; `plan.md:181`). Na macOS nepoužívej `timeout`.

```bash
npm run lint        # eslint; design/**, dukazy/**, dist/**, release/**, .runtime/** ignorováno
npm run typecheck   # tsc --noEmit -p jsconfig.json
npm run test:unit   # vitest run, tests/**/*.test.js
npm run gates       # lint && typecheck && test:unit, v tomhle pořadí
npm run build       # vite build — CI ho pouští taky
bash scripts/akceptace/E6.sh   # oprávnění
bash scripts/akceptace/E7.sh   # přihlášení + scanner tajemství nad celým repem
```

**✅ Změřený baseline na `9863d53` (před tvou první editací):** lint `EXIT=0` · typecheck `EXIT=0` · test:unit `EXIT=0`, 77 testů / 9 souborů · E6 `EXIT=0`, `chyb: 0`. **Když ti kterákoli z nich zčervená hned na startu, nesahej na kód — nejdřív zjisti, proč se liší od téhle změřené výchozí hodnoty.**

🔴 **`typecheck` NEKONTROLUJE `electron/**`.** ✅ Ověřeno v `jsconfig.json`: `"include": ["src/lib/**/*.js", "tests/**/*.js"]`, `"exclude": ["src/components/**", "src/App.jsx", "electron/**", "scripts/**"]`. Zelený `typecheck` **není** důkaz, že `auth.cjs` a `main.cjs` jsou v pořádku. ⚠️ Zároveň to znamená, že **tvůj nový testovací soubor typecheckem PROJDE** (`tests/**` je v `include`, `checkJs: true`) — tam nepořádek zčervená.

⚠️ **`E6.sh`** — přesně co kontroluje, je v §10.2. Shrnutí: **nesahej na `main.cjs:694`** a **nepiš `granted: true` do `main.cjs`**. Kdybys E6 upravoval, byla by to **oprava měřidla, ne vady** (`MASTERPLAN.md:825–832`).

⚠️ **`E7.sh`** (✅ přečten) projíždí repozitář `git grep --untracked` scannerem tajemství (`:20–37`). Fixtury s e-maily (`anna@makemore.cz`) jsou v pořádku; **nikdy tam nedávej řetězec vypadající jako token** (`eyJ…`, `ldmcp_oauth_…`, `ya29.…`). Bez DNS vypíše `SKIP  živé OAuth discovery` (`:55`) — to je v pořádku, ne FAIL.
✅ **`jq` na Danově Macu JE** (`/usr/bin/jq`) — předchozí návrh to vedl jako neověřené. E7 ho používá na `:48`.

⛔ **`node scripts/ui-smoke.mjs` v sandboxu NEPOUŠTĚT** (`AGENTS.md`, `plan.md:191`) — potřebuje GUI, zvuk a Záznam obrazovky. Pouští ho člověk na Macu.

**CI** (`.github/workflows/ci.yml`, `macos-latest`): `npm ci` → `npm run gates` → `npm run build`.

---

## 16. Live-verification scénář

**Pro člověka u Macu.** `MASTERPLAN.md:846–852`: user-visible task **není ověřený jen unit testy**; musí proběhnout spuštění aplikace, otevření flow, **screenshot nebo jiné vizuální zachycení** a **porovnání proti schválenému Claude Design artefaktu**.
🔴 **Oprava proti návrhu:** návrh screenshot ani porovnání s návrhem neměl. Doplněno jako krok 0 a krok 7.
🔴 **Každý krok má kanárka. Když kontrola nic nenajde a kanárek chybí, výsledek je ⛔ NEMĚŘENO, nikdy ✅** (`spec.md:334`).

### Příprava

```bash
cd /Users/dan/Dev/ClaudeCode/ludone-desktop
npm run build
LUDONE_DATA_DIR=/tmp/ludone-b10 npm start 2>&1 | tee /tmp/ludone-b10-run.log
```

⚠️ **`LUDONE_DATA_DIR` neizoluje šifrovanou relaci.** ✅ Ověřeno: `configureWritablePaths` (`main.cjs:170–191`) přemapuje `userData`, `sessionData`, `cache`, `crashDumps` a `temp` — **`appData` ne**. `auth.cjs:284–294` staví cestu k tokenu z `appData`, takže blob jde vždy do `~/Library/Application Support/cz.ludone.desktop/auth/oauth.enc`. Nahrávky naopak do `/tmp/ludone-b10/user-data/nahravky`. **Než začneš, zálohuj si blob** — jinak si přepíšeš vlastní přihlášení.

### Krok 0 — vizuální zachycení (povinné, `MASTERPLAN.md:846–852`)

Screenshot panelu v obou profilech a obrazovky s polem „Čí to bylo?". Přilož je k PR a porovnej se vzory z `nahled.html` (§6). Bez screenshotu **nelze uzavřít žádný user-visible krok jako ✅**.

### Krok 1 — osobní profil vypadá jako dřív (referenční měření)

🔴 **Blokováno otevřenou otázkou z §10.0** — obrazovka volby profilu neexistuje. Dokud ji Dan nerozhodne, je tenhle krok **⛔ NEMĚŘENO** a musí se tak i zapsat. Postup, až volba vznikne:

1. Přihlas se a zvol **Osobní Mac**.
2. **KANÁRKO K1:** v panelu **musí být vidět karta LuTrack**. Když tam není, celý krok 2 je ⛔ NEMĚŘENO — „časovač není vidět" by mohlo znamenat jen to, že se panel nevykreslil.
3. Patička ukazuje tvoje jméno a e-mail, **bez** odznaku „Sdílené zařízení".
   ⚠️ Dokud `App.jsx:9` drží `DEFAULT_USER` (viz §11), ukazuje patička **konstantu**, ne účet — tenhle bod je pak ⛔, i kdyby text seděl.

### Krok 2 — sdílený profil skryje čas a řekne proč

1. Odhlas se, přihlas znovu, zvol **Sdílené zařízení**.
2. ✅ jen tehdy, když platí **všechno**: odznak `Sdílené zařízení` u účtu · karta LuTrack **není** · na jejím místě je věta „Na sdíleném zařízení se čas neměří…".
3. **KANÁRKO K2:** zašedlé tlačítko „Spustit", které nic nedělá, je **FAIL**, ne PASS (`revize-5.md:66`).

### Krok 3 — po stopu se panel zeptá, čí to bylo

1. Spusť a po ~20 s stiskni **„Zastavit nahrávání"**. Napiš do pole `Marcela`, Enter.
2. Zopakuj a pole nech **prázdné**, potvrď Enterem. ✅ jen tehdy, když se nahrávka uloží i tak.
3. **Zopakuj potřetí a panel během otázky ZAVŘI.** ✅ jen tehdy, když manifest skončí `state: "complete"` s `attributedTo: null` — ne `incomplete`. (Tohle měří BD-B10-4; návrh tenhle případ neměl a přitom je to jediná cesta, jak se ztratí schůzka.)
4. **KANÁRKO K3 — manifest:**
   ```bash
   ls -1 /tmp/ludone-b10/user-data/nahravky/*.manifest.json | tail -3
   jq '{clientRecordingId, state, deviceProfile, attributedTo, owner}' <soubor>
   ```
   Nejdřív musí `jq` vypsat **neprázdné `clientRecordingId` a `state: "complete"`**. Když soubor neexistuje nebo je pole prázdné, výsledek je ⛔ NEMĚŘENO. Teprve pak se čte, že `deviceProfile == "shared"`, `owner.accountEmail` je e-mail zasedačky a `attributedTo` je `"Marcela"` (u druhé a třetí nahrávky `null`).

### Krok 4 — jméno člověka se nedostalo do logu

```bash
grep -c '\[recording\] Uloženo:' /tmp/ludone-b10-run.log   # KANÁRKO K4: musí být >= 3
grep -nE 'Marcela|attributedTo|@makemore\.cz' /tmp/ludone-b10-run.log   # musí vrátit 0 řádků
```
✅ Ověřeno, že řetězec `[recording] Uloženo:` v produkčním kódu **existuje** (`main.cjs:643`) — kanárek tedy měří něco skutečného.
🔴 **Pořadí je závazné.** Když první příkaz vrátí `0`, log se nepíše tam, kam se díváš, a druhý příkaz **neměří nic** — výsledek je ⛔ NEMĚŘENO, ne ✅ (`spec.md:334`).
🔴 **Tenhle krok je jediný skutečný důkaz čistoty logu** — TDD-6 má přiznanou hranici (§13).

### Krok 5 — profil přežije restart a jde změnit jen odhlášením

1. Ukonči appku a spusť znovu. ✅ profil je pořád `Sdílené zařízení`.
2. Otevři Nastavení. ✅ profil je tam **jen ke čtení**, s větou „Změna vyžaduje odhlášení".
3. **KANÁRKO K5 — negativní kontrola:** v DevTools panelu spusť
   `localStorage.setItem("ludone.prototype.settings", JSON.stringify({deviceProfile:"personal"}))`
   (✅ klíč ověřen, `Settings.jsx:13`) a restartuj. ✅ jen tehdy, když profil **zůstane sdílený**. Když se přepne, autorita sedí v rendereru a je to porušení Architecture Spine — **blocker, ne kosmetika**.
   ⚠️ Tenhle krok je jediná obrana proti sabotáži **SB-8**.

### Krok 6 — fronta při střídání lidí

1. Se sdíleným účtem vyrob nahrávku, odhlas se, přihlas jiným účtem.
2. ✅ fronta je **neprázdná** (R12) a patička říká, kolik položek patří jinému účtu.
3. **KANÁRKO K6:** než prohlásíš „cizí se neodesílá", musíš vidět, že **vlastní** položka projde pumpou. Když neprojde ani ta, měření nic nedokazuje.
   ⚠️ `DESKTOP_UPLOAD_ENABLED` **zůstává `false`** — ověřuje se výběr položky, ne odeslání (S1: server neexistuje).
   ⚠️ Krok jde provést až po B7; do té doby ⛔ NEMĚŘENO.

### Krok 7 — porovnání se schváleným návrhem

Projdi screenshoty z kroku 0 proti `nahled.html` podle seznamu z `MASTERPLAN.md:855–867` (hierarchie, layout, spacing, hustota, copy, komponenty, interakce, focus a klávesnice). **Rozpor „dvě pole na obrazovce stopu"** z §6 je známý — zapiš ho, neřeš ho sám.

### Zápis výsledku

Každý bod uzavři jednou ze značek: **✅ ověřeno naostro · 🧪 zelené testy · ⛔ neověřeno** (`AGENTS.md`, `MASTERPLAN.md:985`). 🔴 **„Zelené testy" NENÍ „ověřeno".**

---

## 17. Rollback

**Jeden revert, žádná migrace.** `plan.md:68`: *„Každá story je samostatně revertovatelná. Žádná migrace v1 (desktop nikam nepíše)."*

```bash
git revert -m 1 <sha merge commitu B10>     # nebo <sha commitu>, když PR není merge
npm run gates && npm run build
```
⚠️ Při rozdělení na B10a/B10b se revertuje **v opačném pořadí** (B10b, pak B10a) — B10b staví na `owner` z B10a.

**Co po revertu zůstane na disku a proč to nevadí — ✅ ověřeno v kódu:**

| Artefakt | Stav po revertu |
|---|---|
| `deviceProfile` v `auth/oauth.enc` | Neznámé pole navíc. `persistEncryptedSession` (`auth.cjs:296–323`) šifruje libovolný objekt a **žádný čtenář dnes neexistuje** (B8 není hotové) — ignoruje se. |
| `owner`, `attributedTo`, `deviceProfile` v manifestech | Vrácený `createManifest` (`manifest.js:72–79`) skládá **pevný objekt** a neznámá pole **zahodí**; `canonicalJson` na nich nespadne. Manifest se dnes nikde zpětně nečte (jen testy). |
| `owner` na položkách fronty | `validateQueue` (`electron/queue.cjs:11–22`) kontroluje jen `schemaVersion` a pole `items` — položka navíc s `owner` projde. Vrácený `processNext` pole ignoruje. |
| Data na serveru | **Žádná.** `DESKTOP_UPLOAD_ENABLED=false` (`.env.example`), server neexistuje (S1). |
| Tabidoo | **Nic.** Zápis z desktopu je zakázaný za všech okolností (`plan.md:51`). |

**Co revert vrátí zpět jako riziko:** sdílené zařízení se zase bude tvářit jako osobní. To je návrat do dnešního stavu, ne nová vada.

---

## 18. Definition of Done

**Převzato doslova z `plan.md:180–186`:**

1. Cílený test **napřed** a viděný **červený** ze správného důvodu.
2. `npm run lint`, `typecheck`, `test:unit` — všechny EXIT=0, **měřeno před rourou**.
3. Sabotáž, která prokazatelně chytá odstranění guardu, s **doslovným výpisem**.
4. Nejméně jeden případ, který musí zůstat **zelený** (poměr 2–3 červené : 1 zelená).
5. Diff přečtený Claudem, u money a RBAC povinně.
6. PR odkazuje na Feature ID a tenhle plán.
7. **Bez produkce a bez merge** před Danovým finálním schválením.

**Navíc, specificky pro B10:**

8. 🔴 **Diff čte Claude povinně** — story se dotýká RBAC i money (`MASTERPLAN.md` §10).
9. V PR je **vlastnictví bloků z §12.1 opsané** a u každého dotčeného místa v `main.cjs` uvedeno, proč do B10 patří.
10. V PR jsou **doslovné výpisy** z TDD-1 fáze B, TDD-3, TDD-4, TDD-4b, TDD-5b, TDD-7 a ze sabotáží SB-1 až SB-9, včetně SB-6 a SB-6b (kanárky měřidla).
11. 🔴 **PR NEHLÁSÍ posun `DSK-F003`.** Uvede, že B10 nemá Feature ID, a odkáže na položku v `DAN-TODO.md`. `exposure` zůstává `disabled` u všeho.
12. 🔴 **Nikde v PR nesmí být `verified-live`**, dokud to člověk neviděl běžet (`plan.md:162`).
13. **Killswitche se nezměnily** — `git diff .env.example` je prázdný a v diffu není žádný nový výskyt `DESKTOP_TIME_ENABLED` (který ✅ v kódu ani neexistuje).
14. `bash scripts/akceptace/E6.sh` a `E7.sh` doběhly bez FAIL (SKIP u živého discovery je v pořádku). **Změřený baseline obou před editací je v §15** — uveď „před" i „po".
15. 🔴 **Důkaz, že úpravy cizích testů byly registrace, ne změkčení:** `git diff tests/ipc-sender-guard.test.js` = přesně **jeden přidaný řádek, nula odebraných**; `git diff tests/queue.test.js` neobsahuje **žádný odebraný řádek uvnitř `expect(`**. Obojí opsané do PR.
16. **Screenshoty z §16 kroku 0 a porovnání z kroku 7 jsou v PR** (`MASTERPLAN.md:846–852`).
17. **V PR je vypsaná přiznaná hranice měřidla TDD-6** (§13) a sabotáž **SB-8**, kterou unit testy nechytí.
18. Aditivní změna podpisu `finishRecording` a **změna podpisu `finalizeRecordingSession`** jsou **zapsané do `DAN-TODO.md`** s odkazem na tenhle packet (plán je zmrazený, propíše je orchestrátor).
19. Do `DAN-TODO.md` jsou zapsané i **otevřené otázky a odložené věci**: odkud se profil vezme (§10.0) · chybějící Feature ID (§3) · rozpor „dvě pole na obrazovce stopu" (§6) · neurčené vlastnictví `App.jsx:9` (§12.1) · odchylka od dělení podle `plan.md:151` (§2) · automatické odhlášení po nečinnosti · RBAC filtr exportu diagnostiky · chybějící story pro `DSK-F008` · volný text vs. seznam ze serveru.
20. **Žádná zvuková stopa ze skutečné schůzky v gitu** (R24, `spec.md:308`). Do `dukazy/` patří jen `vysledek.json` a `README.md`.
21. Worktree uklizený, větev smazaná lokálně i na remote (`AGENTS.md`).

---

## 19. Implementátor

**Codex** (`gpt-5.6-sol`), spuštěný **viditelně v Orce**:
`~/.claude/scripts/orca-codex.sh start "B10 sdílené zařízení" "<prompt>"`.

Mantinely pro běh:
- 🔴 **NEDĚLEJ ŽÁDNOU git operaci** — index leží mimo pracovní strom, `git add/commit/checkout` spadnou na „Operation not permitted". Commituje orchestrátor hned po doběhnutí.
- Jeden strom = jeden zapisovatel.
- 🔴 **Změř baseline bran DŘÍV, než sáhneš na kód** (§15) a porovnej s hodnotami v packetu. Tenhle projekt má doloženou historii bran, které hlásily zelenou nad nespuštěnou prací.
- Když packet nestačí, **vrať konkrétní otázku, nehádej** (`MASTERPLAN.md:647`). V §3, §6, §10.0 a §12.1 jsou čtyři místa, kde je správná odpověď „vracím otázku".

### Co implementátor NESMÍ (`MASTERPLAN.md:637–645`, doslovně)

> - rozšířit scope;
> - změnit schválený design;
> - vytvořit nový design-system pattern bez tasku a schválení;
> - změnit API/datový kontrakt bez aktualizace plánu;
> - oslabit test;
> - obejít bránu;
> - rozhodnout nové money nebo RBAC pravidlo.

A z `MASTERPLAN.md:825–834`: *„oprav vadu; neoslabuj assertion; nemaž test; nepřidávej baseline; nepoužívej force; nevypínej workflow; nepoužívej skip CI jako cestu kolem skutečné brány. Po třetím neúspěšném opravném kole zastav a vrať přesný blocker a důkazy."*

🔴 **Konkrétně v této story to znamená:** neupravovat `scripts/akceptace/E6.sh` ani `E7.sh` · nesahat na `main.cjs:694` · nepsat `granted: true` do `main.cjs` · nepřeformátovat `main.cjs:498` a `:523` (grepuje je `manifest.test.js`) · neměnit **žádný `expect`** v cizích testech (povolené je jen doplnění vstupu podle §13) · nerozhodovat, komu nahrávka nakonec v LuDone patří (to je RBAC pravidlo a patří serveru) · nezapínat žádný killswitch · nesahat na `src/App.jsx:9`.

---

## 20. Reviewer

**Claude (Opus)** — nezávislé review nad diffem, **povinné**, protože story je RBAC + money (`MASTERPLAN.md` §10, `plan.md:184`, `AGENTS.md` § Bezpečnostní mantinely).

Review projde sedm passů z `MASTERPLAN.md` §14, se zvláštním důrazem na:

| Pass | Co konkrétně u B10 hledat |
|---|---|
| **2 · Security a RBAC** | Nový kanál `device:get-profile` prochází `handleValidated` → `requireTrustedSender` (`main.cjs:151–156`) a **je v inventuře v `ipc-sender-guard.test.js`**. Profil se nedá přepsat z rendereru. Desktop nikde nerozhoduje viditelnost. |
| **3 · Money safety** | Časová agenda skrytá **pravidlem, ne killswitchem**. Klient neposílá sazbu. `clientRecordingId` (`main.cjs:477`) se nezměnil. |
| **4 · Spec compliance** | R6 (žádná heuristika podle e-mailu), R12 (fronta se nemaže, cizí se přeskakuje), R18 (vypínače beze změny), R20, R22, R24. |
| **5 · Plan compliance** | Vlastnictví bloků z §12.1 dodrženo — v diffu `main.cjs` **nejsou** cizí bloky B3/B4/B5/B7/B8/B9. Odchylka od dělení podle `plan.md:151` je přiznaná. |
| **6 · Design compliance** | Žádný nový design-system pattern. Odznak i věta složené ze vzorů (`nahled.html:340/346`, `:405–413`, `:489–493`). Copy bez slov „MCP", „scope", „token" (`spec.md` §7). Rozpor z §6 je zapsaný, ne vyřešený implementátorem. |
| **7 · Verification evidence** | 🔴 **Nejdůležitější pass u téhle story.** Doslovné výpisy červených testů a sabotáží. Kanárky skutečně proběhly. Diff cizích testů odpovídá pravidlu z DoD #15. Screenshoty a porovnání s návrhem existují. Nikde `verified-live` bez člověka. Přiznaná hranice TDD-6 a sabotáž SB-8 jsou v PR napsané. |

**Finální přejímka a rozhodnutí o splnění DoD zůstává na Claudovi** (`MASTERPLAN.md` §10).
🔴 **Merge do `main` ani produkce až po Danově výslovném schválení** (`decisions.md:13`, M4: globální „dotáhni to sám až na prod bez ptaní" se **v tomhle repu ruší**).

---

## Co revize opravila

Revize otevřela `electron/main.cjs`, `auth.cjs`, `preload.cjs`, `queue.cjs`, `src/lib/manifest.js`, `src/lib/queue.js`, `src/App.jsx`, `Settings.jsx`, `RecordingCard.jsx`, všech devět testů, `E6.sh`, `E7.sh`, `jsconfig.json`, `eslint.config.js`, `.env.example`, `design/approved.json`, `nahled.html`, a spustila lint / typecheck / test:unit / E6. Nálezy:

### Šest blokerů — návrh se nedal postavit, jak byl napsaný

1. **`tests/ipc-sender-guard.test.js:186–210` vyjmenovává všech dvanáct IPC kanálů vyčerpávajícím `toEqual`.** Nový kanál `device:get-profile` ho zaručeně shodí. Návrh ten soubor **zároveň** uváděl mezi testy, které „musí zůstat zelené" a „needituj je". Obojí naráz je nesplnitelné — implementátor by narazil na červenou bránu, na kterou nesmí sáhnout, a po třech kolech by zastavil. Opraveno: přesně jeden přidaný řádek do inventury, ostatní assertions bajt po bajtu stejné, s pravidlem pro důkaz v `git diff`.
2. **Tři existující testy v `tests/queue.test.js` (`:94`, `:127`, `:144`) volají `processNext` bez `signedInAs`** a pod pravidlem BD-B10-5 by zčervenaly. Návrh je nezmínil. Navíc jeho tvar návratu `no_identity` **neobsahoval `queue`**, takže test na `:135` by skončil `TypeError`, ne assertion. Opraveno: `queue` se vrací vždy, tři volání dostanou `signedInAs` jako vstup (žádný `expect` se nemění), a přibyl TDD-5b, který zamyká pořadí killswitch-před-identitou, jinak by zčervenaly i `:65` a `:110`.
3. **TDD-3 měl na `deviceProfile` prázdnou assertion.** Fail-closed default je `"shared"`, takže `expect(closed.deviceProfile).toBe("shared")` **projde i tehdy, když `transitionManifest` pole zahodí** — což je přesně vada, kterou má test chytat. Opraveno: otevřený manifest nese `"personal"`, hodnotu, kterou default nikdy nevyrobí. Přibyla sabotáž SB-2c, která to dokládá.
4. **`attributedTo` se do uzavřeného manifestu nemohlo dostat nikdy.** Návrh chtěl po `transitionManifest` jen „přenést tři pole ze zdroje", jenže odpověď vzniká **až při stopu** a ve zdrojovém manifestu je vždycky `null` — zatímco živé ověření kroku 3 po `attributedTo == "Marcela"` výslovně sahá. Opraveno: `transitionManifest` honoruje `updates.attributedTo`, s vlastní sabotáží SB-2b.
5. **`finalizeRecordingSession(sessionId, finalState)` nemá třetí parametr a má tři volající**, dva z nich pádové (`main.cjs:516`, `:654`). Bez změny podpisu se přiřazení do manifestu nedostane — a návrh změnu podpisu do vlastnictví bloků nezahrnul, takže by ji implementátor musel udělat mimo zadaný rozsah, což mu masterplán zakazuje. Doplněno do §10.6 i §12.1, s fail-closed `null` na obou pádových cestách.
6. **„Prázdná odpověď uložení neblokuje" nešlo splnit.** `main.cjs:632` zapíše finální manifest a `:638` hned smaže session; druhý zápis neexistuje, takže se musí ptát **před** `finishRecording`. Návrh neřekl, co se stane, když člověk panel během otázky zavře — a to je jediná cesta, jak se schůzka ztratí. Doplněno pravidlo tří únikových cest + 30s strop, test TDD-7 a sabotáž SB-9.

### Dvacet tvrzení, která v kódu neplatila

7. **HEAD byl uvedený jako `73322adc`, ve skutečnosti je `9863d535`** — sedm commitů zpátky. (Ověřeno, že `main.cjs` se mezi nimi nezměnil, takže kotvy držely; baseline ne.)
8. **`E6.sh` grepuje `createPermissionRequestHandler({ systemPreferences, shell })` v `main.cjs` (řádek 694), ne v `auth.cjs`.** Návrh varoval, že „přeformátování exportů v `auth.cjs` bránu shodí" — E6 se na `module.exports` **vůbec nedívá**. Zároveň mu vypadly dvě další kontroly, které E6 dělá (`requestPermission(permission)` v main.cjs, a `grep -c "granted: true" == 0`). A skutečná signatura má tři parametry (`{ systemPreferences, shell, logger = console }`), ne dva.
9. **`nahled.html:474` neobsahuje `class="pill"`** — je to rowline „Měří se čas". Skutečné pill vzory: `:340`, `:346`, `:581–583`.
10. **UX doc: „Pole pro poznámku…" je řádek 72, položka 6**, ne řádek 71 (tam je položka 5 o „Přihlášen jako").
11. **`configureWritablePaths` je `main.cjs:170–191`**, ne 170–201.
12. **`processNext` už `options` parametr má** (`queue.js:195`, nese `now`/`retryPolicy`/`random`). Návrh ho popisoval jako nový.
13. **`DESKTOP_TIME_ENABLED` v kódu, v `.env.example` ani v testech neexistuje** — žije jen v dokumentech. Návrh psal, že oba vypínače jsou hotové „každý s vlastním testem". `.env.example` má jediný řádek. A `processNext` nečte prostředí vůbec — killswitch dostává argumentem.
14. **Účet je v patičce panelu (`App.jsx:89–102`), ne v hlavičce** (`:62–75` = značka + stav + zavřít). Návrh popisoval mock, ne kód. Odznak proto patří k patičce.
15. **`App.jsx:9` má druhou zadrátovanou atrapu uživatele** (`DEFAULT_USER`), o které návrh mlčel, přestože bez jejího odstranění není „panel nese jméno účtu" pravda. Vlastníka toho řádku plán nikomu nepřidělil → otevřená otázka.
16. **Tlačítko v kódu se jmenuje „Zastavit nahrávání"** (`RecordingCard.jsx:448`), ne „Ukončit a uložit" (to je mock `nahled.html:471`).
17. **`plan.md:151` dělí B10 na „návrh + stavba", ne na dva souborové PR.** Šev B10a/B10b je odchylka od zmrazeného plánu a musí se přiznat.
18. **`plan.md:151` má u B10 vedoucí test „Nahrávka ze `zasedacka@` se přiřadí člověku, ne zařízení."** Návrh staví přesný opak (`owner` = sdílený účet, komu patří řeší server, S1) a žádný z jeho testů ten vedoucí test není. Odchylka teď pojmenovaná.
19. **B10 nemá Feature ID.** Ve `spec.md` §3 (16 řádků) sdílené zařízení není. Návrh si vypůjčil `DSK-F003` (Přihlášení OAuth) a hlásil jeho posun na `committed` — ten posun ale patří **B8**. Nahrazeno otevřenou otázkou a zákazem hlásit posun.
20. **`MASTERPLAN.md:846–852` vyžaduje u user-visible tasku screenshot a porovnání se schváleným design artefaktem.** Živé ověření v návrhu nemělo ani jedno. Doplněno jako krok 0 a krok 7.
21. **`tests/manifest.test.js:98–102` grepuje `main.cjs`** na doslovné řetězce, které **obklopují blok, jejž B10 edituje** (`:498` a `:523`). Návrh celý soubor prohlásil za „musí zůstat zelený", aniž tuhle vazbu pojmenoval.
22. **Doslovné výpisy v TDD-3 a SB-2 říkaly `expected undefined`; správně je `expected null`** — protože §10.4 sám předepisuje `?? null`. Fabrikované literály, které by implementátora poslaly hledat neexistující rozdíl.
23. **TDD-4 nastavoval `process.env.DESKTOP_UPLOAD_ENABLED`**, kterou `processNext` nikdy nečte. Cargo cult, který prozrazuje, že se test nespustil.
24. **Kanárek v TDD-6 byl jen jeden**, na alternativu `attributedTo`. Sabotáž, která odstraní jen `accountEmail`, by ho nechala zelený. Detektor navíc scanoval jen `main.cjs`, jen `console.*`, jen doslovné názvy — přejmenovaná proměnná mu projde. Opraveno: kanárek na každou alternativu, tři skenované soubory, a **přiznaná hranice měřidla přímo v packetu**.
25. **`queueOwnerSummary` nemělo žádný test** (přitom je to jediná pojistka proti tichému zmizení cizí položky) a **fail-closed pravidlo mělo otestovanou jen půlku** — položku s cizím vlastníkem. Implementace „přeskoč, jen když owner existuje a liší se" prošla všemi testy návrhu a odeslala by každou položku z doby před B10. Doplněn TDD-4b a sabotáž SB-3b.
26. **Návrh nikdy neřekl, odkud se profil vezme.** Živé ověření začínalo „zvol Osobní Mac" — obrazovka, která není v `approved.json` (22 obrazovek), není ve specu, a bydlela by v bloku `auth:begin`, který vlastní B8. `revize-5.md:72` přitom výslovně říká, že rozpoznání je **blokované rozhodnutím**. Nahrazeno otevřenou otázkou §10.0 a označením kroků 1–2 živého ověření jako ⛔ do rozhodnutí.
27. **Schválená obrazovka stopu (`nahled.html:489–493`) už jedno pole má — název nahrávky.** B10 na ni dává druhé, jiné, zatímco `DSK-F008` nemá story. Návrh to vydával za pokryté vzorem; teď je to zapsaný rozpor návrh × story, který implementátor neřeší sám.

### Co revize naopak DOMĚŘILA (návrh to vedl jako neověřené)

- **`jq` na stroji JE** — `/usr/bin/jq`.
- **Baseline bran:** lint `EXIT=0`, typecheck `EXIT=0`, test:unit `EXIT=0` (77 testů, 9 souborů, Vitest 3.2.7), E6 `EXIT=0 · chyb: 0`.
- **Větev `fix/tray-prazdna-ikona` se s B10 nesráží** — mění v `main.cjs` jen hunky `@@ -199,34 @@` a `@@ -246,10 @@`, tedy bloky B3 a B4.
- **`73322ad..HEAD` nesahá na `electron/main.cjs`** — čísla řádků v packetu proto platí i na HEAD.

### Co revize potvrdila jako správné (nechává beze změny)

SHA plánu, specu i designu · `coveredScreens` 22 / `coveredStates` 11 bez sdíleného stavu · absence `EXPERIENCE.md` · doslovné citace UX doc na řádcích 23, 61 a 101 · nepoužitý `createAuthController` · chybějící `deriveTrayState` a `tracking.cjs` · `src/lib/queue.js` importovaný jen testy · pasti v `manifest.js:87–100` a `enqueueRecording` · klíč `ludone.prototype.settings` · kotvy `main.cjs:477`, `:479`, `:491–496`, `:581–647`, `:676–679`, `:709–714` · `auth.cjs:284–294`, `:296–323`, `:325`, `:397–410`, `:501–506` · fakt, že `appData` se nepřemapovává · `electron/queue.cjs:11–22` · existence log řetězce `[recording] Uloženo:` · citace R6/R8/R10/R12/R18/R20/R22/R24, `spec.md` §7 a §11, `decisions.md` B1 a M4, `plan.md` §1/§2/§2b/§3/§4, `transakce-concurrency.md` S5, `revize-5.md` A5 a A6, `revize-3.md` §4.1 a §4.2.

## Co packetu chybí ve spec/plan

- Odkud se bere profil zařízení. Packet předpokládá volbu 'Osobní Mac / Sdílené zařízení' při přihlášení, ale ta obrazovka není v design/approved.json (22 obrazovek, žádná taková), není ve spec.md (16 funkcí, žádná taková), a bydlela by v bloku auth:begin, který plan.md:122 přiděluje B8. revize-5.md:72 (A6) navíc říká, že autoritativní zdroj (atribut účtu ze serveru) je mimo rozsah S1. Bez Danova rozhodnutí je každý Mac 'shared' a kroky 1-2 živého ověření jsou neproveditelné.
- Feature ID pro B10. spec.md §3 (řádky 78-93) má šestnáct řádků DSK-F001 až DSK-F016 a sdílené zařízení mezi nimi není. MASTERPLAN.md:617 Feature ID vyžaduje. Spec je zmrazený, takže chybějící řádek nelze doplnit z packetu.
- Rozhodnutí rozporu na obrazovce stopu. nahled.html:489-493 má schválené pole pro NÁZEV nahrávky předvyplněný podle projektu; B10 na tutéž obrazovku dává druhé, jiné pole ('Čí to bylo?'), zatímco DSK-F008 (pojmenování) nemá žádnou story v B1-B12. spec.md § 'Autorita při rozporu' říká, že implementátor rozpor neřeší sám.
- Vlastník řádku src/App.jsx:9 (DEFAULT_USER = { name: 'Daniel Novák', email: 'daniel@ludone.cz' }). Je to druhá atrapa uživatele vedle main.cjs:681-692. Dokud existuje, patička zobrazuje konstantu a tvrzení 'panel nese jméno účtu, pod kterým se nahrává' nejde ověřit. plan.md §2 tenhle blok nikomu nepřidělil.
- Zda 'čí to bylo' má být volný text, nebo seznam lidí ze serveru. decisions.md:89-92 to nechává otevřené, S1 seznam ze serveru vylučuje z v1 — takže volný text je nouzové řešení, ne rozhodnutí.
- Zda se automatické odhlášení po nečinnosti (transakce-concurrency.md:215, návrh 30 minut, výslovně 'neměřeno') má stavět, a s jakou lhůtou. Bez něj v1 vědomě nechává otevřené, že někdo nahraje schůzku pod cizím jménem.
- Sankce pro dělení B10 na dva souborové PR (B10a/B10b). plan.md:151 dělí B10 na 'návrh + stavba', ne podle souborů; odhad diffu ~268 řádků překračuje limit ~250 z plan.md:137, ale samotný odhad není změřený diff.
- Zda smí být do inventury kanálů v tests/ipc-sender-guard.test.js:191-204 přidán řádek 'device:get-profile' a zda smí tři volání processNext v tests/queue.test.js (:98, :128, :148) dostat vstup signedInAs. Bez explicitního sankcionování to implementátor podle MASTERPLAN.md:825-832 nesmí udělat a story se nedá dokončit.

## 🔴 Co NEBYLO ověřeno v kódu

Skeptik packet přečetl proti kódu, ale tohle zůstalo bez důkazu.
**Než na tom postavíš implementaci, otevři to.**

- Zda účet zasedacka@makemore.cz existuje v Google Workspace nebo v LuDone a jak se chová — neotevřel jsem žádný živý systém, jen repozitář.
- Chování createAuthController za běhu. Přečetl jsem auth.cjs:325-418 celé, ale funkce se nikde neimportuje (ověřeno grepem), takže žádné pozorování běhu neexistuje.
- Zda navržený tvar resolveDeviceProfile, sharedDeviceRules, queueOwnerSummary a attributionOutcome projde lintem a typecheckem — nenapsal jsem je ani nespustil. Změřil jsem jen baseline PŘED změnou (lint EXIT=0, typecheck EXIT=0, test:unit EXIT=0 se 77 testy, E6 EXIT=0).
- Doslovné znění červených výpisů v §13 a §14. Je odvozené z formátu Vitestu 3.2.7 a z existujících testů, ne opsané ze skutečného běhu — nevyrobil jsem ani jeden červený stav. Packet to na dvou místech výslovně říká implementátorovi.
- Číslo řádku ve výpisu sabotáže SB-5 — závisí na tom, kam implementátor console.log vloží. V packetu je nahrazeno zástupným textem místo vymyšleného čísla.
- Odhad ~268 řádků diffu bez testů. Je to můj odhad podle rozsahu dotčených funkcí, ne git diff --stat nad skutečnou implementací.
- Chování safeStorage a přežití relace přes restart na macOS. Čerpám ze specs/E6-prihlaseni-a-fronta.md a z UX doc, sám jsem nic nespustil. persistEncryptedSession jsem četl, ale nikdy nespustil.
- Zda npm run build a bash scripts/akceptace/E7.sh na tomhle stroji projdou. Spustil jsem lint, typecheck, test:unit a E6.sh; build a E7 ne (E7 chodí na síť na labs.ludone.cz a jeho scanner tajemství jsem jen přečetl).
- Obsah docs/server-modul/autentizace.md, datovy-model.md a kontrakt-desktopu.md. Ověřil jsem, že ty tři soubory v repu existují (vedle KONTRAKT.md), ale neotevřel jsem je — tvrzení předchozího návrhu, že je KONTRAKT.md ruší, jsem tedy nepotvrdil ani nevyvrátil.
- Většinu docs/MASTERPLAN.md. Přečetl jsem §9 (řádky 608-648), §10 (651-707) a §13 (808-867) a osnovu nadpisů; §1-§8, §11, §12, §14-§22 jsem nečetl. §14 (sedm review passů) v packetu cituji jen jménem sekce, ne obsahem — jejich znění jsem neotevřel.
- Většinu docs/changes/desktop-v1/sekce-navrhy/*. Četl jsem cíleně jen okolí nálezů ke sdílenému zařízení: journeys-ia.md:84, transakce-concurrency.md:207-221, revize-3.md:116-123 a 210-211, revize-5.md:16-127 a 164. live-verification.md, distribuce.md, audit-redaction.md, performance-responzivita.md a revize-1/2/4/6 jsem nečetl celé.
- docs/changes/desktop-v1/intent.md jsem neotevřel vůbec, přestože plan.md:3 ho uvádí jako nadřazený artefakt.
- src/features/recording/RecordingCard.jsx jsem přečetl jen po částech (řádky 190, 240-300, 440-478 a grep na klíčová slova), ne celých 478 řádků. Odhad ~70 řádků na fázi 'attributing' proto stojí na neúplném obrazu funkce finishRuntime a jejích volajících.
- src/features/tracking/TrackingCard.jsx (77 řádků) a src/features/calendar/TodayAgenda.jsx jsem neotevřel — spoléhám na to, že B10 do nich nesahá, což je rozhodnutí packetu, ne změřený fakt o jejich obsahu.
- Zda 'device:get-profile' skutečně projde requireTrustedSender správně pro sender kind 'settings'. Přečetl jsem trustedSenderKind (main.cjs:109-113) a requireTrustedSender (:115-120), ale nespustil je s oknem Nastavení.
- Zda dnešní scripts/ui-smoke.mjs je červený, jak tvrdí HEAD commit 'Capture the red ui-smoke run the fix has to turn green'. Skript se v sandboxu pouštět nesmí (plan.md:191), takže jsem to nezměřil.
- Zda by přidání tří polí do manifestu nerozbilo něco mimo tests/. Ověřil jsem, že manifest se čte jen v testech a v main.cjs, ale nehledal jsem čtenáře v scripts/schuzka-mereni.mjs, meet-mereni.mjs ani audio-smoke.mjs.
