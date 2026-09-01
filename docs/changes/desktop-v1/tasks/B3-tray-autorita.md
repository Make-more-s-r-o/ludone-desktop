# Task packet B3 — REVIDOVANÁ VERZE

> **Jak tenhle packet číst.** Je dlouhý, protože nese změřené věci, ne proto, že je upovídaný.
> Nečti ho lineárně. **Minimum před první editací:** §12 (vlastnictví bloků — co smíš změnit
> a čeho se nesmíš dotknout ani o řádek), §13 (TDD kroky s doslovnými červenými výpisy),
> §14 (sabotáže). Zbytek je odůvodnění, do kterého se vracej, až něco nesedí.
>
> 🔴 **Sekce `Co NEBYLO ověřeno v kódu` na konci není formalita.** Skeptik packet četl proti
> kódu a tohle zůstalo bez důkazu — než na tom postavíš implementaci, otevři to.
>
> Packet napsal agent, přečetl skeptik proti kódu. **Když v něm najdeš nepravdu, je to nález,
> ne překážka** — zapiš ho a jeď dál podle `spec.md` a `plan.md`, ty jsou nadřazené.

---


> Přesun autority tray stavu do hlavního procesu. Packet je podle masterplánu §9 jediné zadání,
> které implementátor dostane — plán ani spec číst nemusí, ale **nesmí si nic domýšlet**.
> Když packet nestačí, vrať konkrétní otázku koordinátorovi. Nehádej.
>
> 🔴 **Tahle verze prošla adversariální revizí nad skutečným kódem 1. 9. 2026.** Seznam toho,
> co revize v návrhu opravila, je na konci v sekci „Co revize opravila". Tvrzení označená
> ✅ jsem sám změřil, 🧪 jsem odvodil ze čtení kódu, ⛔ jsem neměřil vůbec.

---

## 1. Plan ID a Plan SHA

Masterplán §14 chce v PR **Intent ID i Spec ID včetně commitů**, ne jen plán. Návrh packetu je
neuváděl, takže by podle něj nešel napsat vyhovující PR. Doplněno:

| Co | Hodnota | Jak zjištěno |
|---|---|---|
| **Intent ID** | `docs/changes/desktop-v1/intent.md` @ `8ba74d25d69ad0e1da39a126743e17582e5397d9` | ✅ `git log -1 --format=%H -- …/intent.md` |
| **Spec ID** | `docs/changes/desktop-v1/spec.md` @ `1e9709779e94a654a0c3c959d260082d42801acc` — **ZMRAZENO** | ✅ tamtéž |
| **Plan ID / Plan SHA** | `docs/changes/desktop-v1/plan.md` @ `c7b1bb715f87f53ca0a209d5d3b96e6018e1e437` — **ZMRAZENO** | ✅ tamtéž |
| **decisions.md** | @ `ff77092063ecf04d0eb7f7a41f654fb19138ad9b` | ✅ tamtéž |

### 🔴 Kódový základ — návrh packetu tady uváděl nepravdu

Návrh tvrdil „`main` @ `73322ad`". **`73322ad` není `main`** — je to commit *„Add the checkpoint
file the run overwrites each wave"*, který je o **čtyři commity pozadu** za skutečnou hlavou.

| Co | Hodnota |
|---|---|
| **Skutečná hlava `main`** | `590a57febe5eaa3a3b2f4a044de6793b9dc19881` — *„Measure what B2 would actually touch…"*, 1. 9. 2026 22:07 |
| Strom | ✅ čistý (`git status --porcelain` prázdný) |

✅ **Změřeno, a je to dobrá zpráva:** `git diff --stat 73322ad HEAD` mění **jen tři dokumenty**
(`DAN-TODO.md`, `BEH-NOC.md`, `PROMPT-IMPLEMENTACE.md`) a `git diff --stat 73322ad HEAD --
electron/ src/ tests/ scripts/ package.json` je **prázdný**. Kód je bajt po bajtu totožný,
takže **všechna čísla řádků v tomhle packetu platí i na `590a57f`**.

🔴 Přesto: **před editací si každé číslo řádku ověř `grep -n`**, ne slepě podle packetu.

### Brány na základu — změřeno mnou, ne převzato

| Brána | Výsledek |
|---|---|
| `npm run lint` | ✅ EXIT=0 |
| `npm run typecheck` | ✅ EXIT=0 |
| `npm run test:unit` | ✅ EXIT=0 — **9 souborů, 77 testů** |
| `npm run build` | ⛔ **nespuštěno** (nezkoušel jsem; CI ho pouští po `gates`) |

---

## 2. Task ID

**B3** — `plan.md` §2, tabulka DAG, řádek B3. ✅ Ověřeno na `plan.md:86`.
Název PR (anglicky, doslovně podle `plan.md:144`): `Move tray state authority into the main process`.

Odhad diffu bez testů: **~120 řádků** (`plan.md` §2b), PR se **nedělí**.
⚠️ To číslo je **odhad z plánu, ne měření** — ani já, ani autor návrhu jsme skutečný diff neměřili.

---

## 3. Feature ID

**`DSK-F001`** — *„Ikona v liště nese stav, klik otevře panel"*, riziko `normal`.
✅ Ověřeno na `spec.md:78`.

Čtyři osy (slovník ✅ ověřen na `spec.md:65-70`; `spec.md` §3 zakazuje jeden sloupec „hotovo"):

| Osa | Před B3 | Po B3 |
|---|---|---|
| scope | `approved` | `approved` (nemění se) |
| delivery | `committed` ¹ | `pr-open` |
| exposure | `disabled` | `disabled` — 🔴 **nic se nezapíná** |
| verification | `tests-green` | `tests-green`; `verified-live` smí napsat **jen člověk**, který to viděl běžet |

¹ ✅ Ověřeno na `spec.md:97-100`: „committed" odkazuje na **nemergovaný** commit
`ce2bea6b40f3bd5193d667a0c8ca5270deb94c2e` na větvi `fix/tray-prazdna-ikona` (úkol T1, PNG ikony).
Je **zmrazený**; B3 ho nemerguje ani nerozmrazuje. **Čti §11 — T1 je pro B3 mina, ne poznámka pod čarou.**

Dotčené, ale **nedodávané** funkce: `DSK-F011` (časovač v main) a `DSK-F013` (časovač přežije pád) —
B3 jim staví půdu, ale **žádnou jejich část neimplementuje**. To je story B5.

---

## 4. Cíl story

Stav ikony v liště dnes **určuje renderer**. ✅ Ověřeno v kódu:

- `src/App.jsx:20-25` — `useMemo` spočítá stav (`signed-out`/`recording`/`tracking`/`idle`).
- `src/App.jsx:34-36` — `useEffect` ho pošle přes `window.ludone.setTrayState(trayState)`.
- `electron/preload.cjs:18` — `setTrayState: (state) => ipcRenderer.send("tray:set-state", state)`.
- `electron/main.cjs:662` — `onValidated("tray:set-state", ["panel"], (_event, state) => updateTray(state));`

✅ `grep -rn "setTrayState" src electron tests scripts` má **právě dvě shody v produkčním kódu**
(`src/App.jsx:35`, `electron/preload.cjs:18`) — jiný volající neexistuje.

Když renderer spadne, zůstane poslední názor mrtvého okna — lišta dál tvrdí „nahrává se".

**Cíl:** hlavní proces si stav **odvozuje** z faktů, které vlastní nebo kterým rozumí. Renderer
fakta jen **hlásí**. Kanál, kterým renderer stav diktoval, zmizí.

To je jediná architektonická změna celého plánu (`plan.md:25-27`) a proto ji drží Claude, ne Codex.

---

## 5. User-visible chování

| Situace | Co se má stát |
|---|---|
| Běží nahrávání, renderer spadne | Tooltip lišty **přestane tvrdit „nahrává"** a řekne **„LuDone · připraveno"**. Nahrávka se uzavře jako dnes |
| Po pádu rendereru | Lišta **NESMÍ** skočit na „nepřihlášeno". Přihlášení vlastní hlavní proces a pád okna ho nemění |
| Běží nahrávání **i** časovač | Tooltip řekne obojí: **„LuDone · nahrává + LuTrack běží"**. Dnes se tenhle stav tiše překlopí na „nepřihlášeno" (✅ `spec.md:208`) |
| Uživatel není přihlášen | **„LuDone · nepřihlášeno"** bez ohledu na ostatní fakta |
| Všechno ostatní | **Beze změny.** Panel vypadá stejně, levý klik ho otevírá stejně, onboarding je stejný |

⚠️ **Návrh packetu sliboval „do ~2 s". To číslo bylo vymyšlené — nikdo ho neměřil a v kódu pro
něj není opora.** Odstraněno. Uzavření session po pádu jede přes `finalizeRecordingSession`
(`main.cjs:581-647`), které dělá `handle.sync()`, `fs.stat` a **sha256 obou .webm stop**; jak
dlouho to trvá, **nikdo nezměřil** (viz §16, měření M1). Do PR se píše naměřená hodnota, ne slib.

🔴 **Co B3 vědomě NEDĚLÁ** (a nikdo to po něm nesmí chtít):
nekreslí novou ikonu · nepřidává odznak · nepřidává text ani čas vedle ikony (`tray.setTitle`) ·
nemění panel ani jeho hlavičku vizuálně · nezavádí kontextové menu · nezavádí perzistenci session ·
**neposílá stav zpátky do rendererů** (viz §10.4).

⚠️ `main.cjs:729` volá `tray.setTitle("")`. **Nechat beze změny.** `spec.md:207` u stavu „Jen čas"
chce „zelená **+ text**", ale ten text je práce B5 (`tray.setTitle` s časem), ne B3.

---

## 6. Odkaz na schválený Claude Design artefakt

**`design/approved.json`** — ✅ ověřeno celé: `status: approved`, `approvedBy: "Dan"`,
`approvedAt: "2026-09-01"`, `approvedDirection: "strong-fit"`, `approvedVia` = statická náhledová
stránka `design/navrh/nahled.html` + Danova věta „za mě teda schváleno",
`specVersion: "před sepsáním spec.md; schváleno nad commitem babdd5a"`.

⚠️ **Schválení je STARŠÍ než spec** — artefakt to sám přiznává. Kde se rozcházejí, platí
`spec.md` a `plan.md` (autorita při rozporu, `spec.md:10`).

Relevantní části (**výběr, ne úplný obsah** — návrh packetu vydával čtyři položky za celý seznam):

- `coveredScreens` má **22 položek**; pro B3 je relevantní **„lišta — ikona a stavy"**.
- `coveredStates` má **11 položek**; pro B3 jsou relevantní **„klid", „jen nahrávání", „jen čas", „obojí"**.
- `openDesignQuestions[0]`, ✅ doslovně: *„Přesná kresba ikony v liště pro všech osm stavů — zatím
  jen popis, ne artboard. Řeší úkol T1."*
- ✅ `design/navrh/nahled.html:147` doslovně: *„Nahrává se dvanáct minut. Kdyby běžel i časovač,
  přibude vedle druhý údaj."*
- ✅ `design/navrh/Lista.dc.html:151` doslovně: *„Souběh potřebuje odznak, ne pátou ikonu. Barva
  nese hlavní agendu, odznak tu druhou — a stav nikdy nesmí záviset jen na barvě."*

### 🔴 Kolik stavů vlastně má být — rozpor, který packet NEŘEŠÍ, jen hlásí

| Zdroj | Počet stavů lišty |
|---|---|
| `design/approved.json` → `openDesignQuestions[0]` | **osm** |
| `docs/ux/cesta-uzivatele-2026-09-01.md:49` (M19) | artboard má **sedm** |
| `design/navrh/Lista.dc.html:149` | *„Osm stavů, čtyři existují."* |
| Dnešní kód (`main.cjs:220-230`) | **čtyři** |
| **Co dodá B3** | **pět** logických (pátý sdílí kresbu se čtvrtým) |

**B3 dodává pátý stav a tři až čtyři zbývající nechává otevřené** (fronta, výpadek zvuku, offline).
To je vědomé, ne opomenutí — ale **není to nikde rozhodnuté**, viz otevřená otázka O7.

**Co z designu plyne jako mantinel pro B3:**
odznak i „druhý údaj vedle ikony" jsou práce **T1 + B5**, ne B3. Souběh proto B3 rozlišuje
**výhradně textem tooltipu** — text je jediný nosič stavu, který nezávisí na barvě (`spec.md:223`)
a **nesahá na zmrazenou kresbu**. Adresář `design/**` je pro tenhle běh **zakázaný**
(✅ `plan.md:190`, a nezávisle ✅ `AGENTS.md:66`).

---

## 7. Relevantní výřez EXPERIENCE.md

🔴 ✅ **`EXPERIENCE.md` v repozitáři NEEXISTUJE** — ověřeno `find . -name "EXPERIENCE.md"
-not -path "./node_modules/*"`, nula shod. Masterplán §7 ho jmenuje jako přílohu specu, ale
tenhle projekt ji nikdy nevytvořil. Jeho roli hraje **`docs/ux/cesta-uzivatele-2026-09-01.md`**.
Uvádím to výslovně, aby ho implementátor nehledal a nedomýšlel si obsah.

**Výřez — M19 „Souběh obou agend" (`docs/ux/cesta-uzivatele-2026-09-01.md:49`).**
⚠️ Je to jeden **řádek tabulky**; citace níž je slepená ze dvou jeho sloupců („co je dnes"
a „riziko"), proto to `[…]`. Text je jinak doslovný:

> „Jednu ikonu. App.jsx dává useMemo prioritu nahrávání, takže lišta ZAMLČÍ, že běží LuTrack.
> Kód má 4 stavy, artboard Lista.dc.html jich má 7. […] **Autoritou stavu ikony je dnes renderer,
> ne hlavní proces — po pádu okna zůstane v liště falešné „nahrává se".** Ikona musí být template
> (černá + alfa), takže zelená #2f9e44 pro recording nepřežije: **stav nese TVAR, ne barva.**
> Vedle ikony smí být nejvýš JEDNO číslo (tray.setTitle s monospacedDigit), s pevnou šířkou,
> ať lišta neposkakuje."

**Výřez — M24, správný název je *„Pád aplikace nebo ukončení během nahrávání"*
(`docs/ux/cesta-uzivatele-2026-09-01.md:54`; návrh packetu ho zkrátil):**

> „Po pádu okna **falešné „nahrává se" v liště**. Po restartu nic o tom, že zůstala půlka nahrávky."

⚠️ Druhá půlka M24 (obrazovka „našel jsem nedokončenou nahrávku") **není v rozsahu B3**.

---

## 8. Relevantní business pravidla

Ze `spec.md`, všechno ✅ ověřeno na uvedených řádcích:

- **§6 matice stavů, řádek „Obojí"** (`spec.md:208`): 🔴 *„pátý stav CHYBÍ — tiše se překlopí na
  'nepřihlášeno'"*. V kódu je to `main.cjs:220-230`: `trayIconName()` vrací pro neznámý stav
  `"signed-out"` (řádek 228).
- **§7 přístupnost** (`spec.md:223`): *„Stav se **nikdy** nesděluje jen barvou — vždy i tvarem,
  textem nebo odznakem."* ⇒ tooltip je v B3 nositelem textu.
- **§7 copy** (`spec.md:226-227`): česky, v jazyce uživatele. 🔴 Nikdy „MCP", „scope", „token"
  v textu, který vidí uživatel.
- **§7 šablonová ikona** (`spec.md:225`): *„Ikona v liště je **šablonová** (černá s průhledností)"*.
  ⚠️ To si odporuje s §6, kde se stavy popisují barvami („červená", „zelená"). **B3 ten rozpor
  neřeší** — kresbu vlastní T1 (který už `setTemplateImage(true)` nastavuje). Zapiš do `DAN-TODO.md`.
- **§8 acceptance `DSK-F001`** (`spec.md:233-235`): *„Given čerstvě nainstalovaná aplikace · When
  ji spustím · Then je v liště **neprázdná** ikona (`isEmpty() === false`, rozměr nad nulu)
  a klik otevře panel."*
  ⛔ Že to dnes na `main` neplatí (prázdná ikona), je tvrzení z commit message `ce2bea6`
  a z `spec.md:97-100` — **nikdo z nás to na Macu neviděl**. **B3 to nesmí zhoršit a nesmí to opravovat.**
- **§11 R21–R25**: žádné se B3 přímo netýká; R21 (časovač po pádu se musí zeptat) je **B5**.

**Money a RBAC:** 🔴 **žádné.** ✅ Ověřeno: pravidla o penězích v čase jsou R6–R11 (`spec.md:150-157`)
a role jsou §2 — B3 nesahá na sazby, hodiny, alokace, tokeny ani práva. Implementátor
o nich **nesmí rozhodnout nic nového**.

### 🔴 Past se jménem „B3" — návrh packetu na ni neupozornil

V tomhle repozitáři **`B3` znamená dvě různé věci**:

| Kde | Co „B3" znamená |
|---|---|
| `plan.md` §2 (a tenhle packet) | **story** „Přesun autority tray stavu do hlavního procesu" |
| ✅ `decisions.md:69` | **rozhodnutí** „Retence **7 dní**, nastavitelné" |
| ✅ `spec.md:168` (R19) | „…smaže za 7 dní **(B3)**" — odkaz na to rozhodnutí, **ne na tuhle story** |

⇒ **Retence NENÍ v rozsahu B3.** Kdo bude v `spec.md` grepovat „B3", najde R19 a splete se.
Story `B2` v plánu existuje právě proto, aby se tahle čísla přejmenovala, a ✅ commit `590a57f`
(*„Measure what B2 would actually touch, and recommend not doing it tonight"*) říká, že se to
dnes v noci dělat nebude. Kolize tedy **zůstává živá** — viz DoD 14 a otevřená otázka O5.

**Vypínače:** B3 žádný nezavádí, nečte ani neflipuje. `DESKTOP_UPLOAD_ENABLED` a
`DESKTOP_TIME_ENABLED` patří B7 a B5/B11 (`spec.md:167`, `plan.md:55`).

---

## 9. Relevantní Architecture Spine invarianty

Z `plan.md` §1, ✅ ověřeno doslovně — **podřízené úkoly tato rozhodnutí nesmějí předefinovat**:

1. 🔴 `plan.md:25-27`: **„Stav, který musí přežít pád rendereru, vlastní hlavní proces. Renderer
   hlásí fakta, neurčuje stav."** — tohle je invariant, který B3 **dodává**. Jediná architektonická
   změna celého plánu.
2. `plan.md:16`: **`electron/main.cjs`** vlastní okno, tray, IPC a životní cyklus a **nesmí
   rozhodovat o stavu podle rendereru**.
3. `plan.md:20`: **`src/**` (renderer)** vlastní **jen zobrazení** a **nesmí držet stav, který
   musí přežít pád**.
4. `plan.md:68`: **Rollback** — každá story je samostatně revertovatelná; v1 nemá migraci.
5. `plan.md:58-64`: **Co plán nepokrývá** — serverová strana (S1) a MCP nástroje (S2).
   B3 se jich nesmí dotknout.

---

## 10. Vstupní a výstupní rozhraní

### 10.1 Fakta, ze kterých se stav odvozuje

| Fakt | Kdo ho vlastní **po B3** | Odkud ho main bere |
|---|---|---|
| `recording` | 🟢 **hlavní proces** (už dnes) | `recordingOwnersPreparing` + `recordingSessions` (✅ `main.cjs:34-35`) |
| `tracking` | 🟡 zatím **renderer** | hlásí se přes nový kanál `panel:facts`; **B5 to nahradí** vlastním časovačem v main |
| `signedIn` | 🟡 zatím **renderer** | hlásí se přes `panel:facts`; **B8 to nahradí** skutečným `createAuthController` |

🔴 **„Zatím renderer" znamená: renderer hlásí FAKT („časovač běží"), ne STAV („ikona má být
zelená"). A `recording` se v `panel:facts` NESMÍ objevit vůbec** — main ho zná sám. Kdyby ho
renderer poslal a main ho použil, story by byla dodaná jen naoko. Proti tomu stojí sabotáž S5.

### 10.2 Kontrakt IPC

| Kanál | Před B3 | Po B3 |
|---|---|---|
| `tray:set-state` (`send`) | ✅ `main.cjs:662` — renderer diktuje stav, main volá `updateTray(state)` | 🔴 **SMAZAT celý** |
| `panel:facts` (`send`) | — | 🆕 **NOVÝ.** Payload **přesně `{ signedIn: boolean, tracking: boolean }`** a nic víc. Jen odesílatel `["panel"]` |
| `tray:get-state` (`invoke`) | ✅ `main.cjs:663` — `() => trayState` | **kontrakt beze změny**: dál vrací **jméno ikony**. Protože `trayState` bude nově logický stav (pět hodnot), handler MUSÍ vracet `trayIconName(trayState)` |
| preload `setTrayState` | ✅ `electron/preload.cjs:18` | 🔴 **odebrat** (`plan.md:118` to jmenuje výslovně) |
| preload `reportPanelFacts` | — | 🆕 `reportPanelFacts: (facts) => ipcRenderer.send("panel:facts", facts)` |

**Odmítnutí neplatného tvaru:** cokoli jiného než dva booleany se **ignoruje**, předchozí fakta
zůstávají. ✅ Ověřeno v kódu, že to jde udělat elegantně: `onValidated` (`main.cjs:158-168`) už
handler obaluje `try/catch` a loguje `[ipc] Odmítnuto ${channel}: ${error.message}`. **Stačí tedy
z handleru vyhodit `new Error("neplatný tvar")`** a v logu vznikne přesně
`[ipc] Odmítnuto panel:facts: neplatný tvar`. Nepiš vlastní `console.error`.

🔴 **Tohle rozšíření kontraktu (`panel:facts`) v `plan.md` NENÍ.** ✅ Ověřeno — `plan.md` §1
„Kontrakty" mluví jen o serveru, času a GUID. Bez `panel:facts` se hlavní proces mezi B3 a B5/B8
nemá jak dozvědět o přihlášení ani o časovači a lišta by uvázla na „nepřihlášeno". Packet ho
proto předepisuje **a zároveň platí masterplán §14 (`MASTERPLAN.md:911-919`)**: implementátor ho
**nesmí měnit** a koordinátor ho musí propsat do `plan.md` + `decisions.md` **ve stejném logickém
commitu jako PR**. *„Tichá odchylka je blocker."*

### 10.3 Vnitřní rozhraní v `main.cjs` (nová a měněná)

```js
// jediný zdroj pravdy o faktech, které main nevidí sám
const appState = { signedIn: false, trackingOwners: new Set() };

// 🔴 ČISTÁ funkce, dostává mapy argumentem — jinak ji nejde otestovat bez Electronu.
// Vrací true, pokud:
//  - některá příprava v `preparations` NEMÁ cancelled === true, NEBO
//  - některá session v `sessions` NEMÁ nastavené finalizePromise.
// Obě půlky jsou nosné, viz komentář pod blokem.
function hasLiveRecording(sessions, preparations) { … }

// ČISTÁ funkce — bez modulových proměnných, bez Electronu. Na tom stojí celá brána.
function deriveTrayState({ signedIn, recording, tracking }) {
  if (!signedIn) return "signed-out";
  if (recording && tracking) return "recording-tracking";
  if (recording) return "recording";
  if (tracking) return "tracking";
  return "idle";
}

// mapa logického stavu na jméno ikony; PÁTÝ stav sdílí kresbu se čtvrtým (viz §6)
function trayIconName(state) { … "recording-tracking" → "recording" … }

// BEZ ARGUMENTU. Nikdo zvenčí stav nediktuje.
// recording MUSÍ přijít z hasLiveRecording(recordingSessions, recordingOwnersPreparing),
// NIKDY z panel:facts.
function refreshTray() { … }

// jediná cesta, kterou se uklízí po mrtvém rendereru
function forgetOwnerActivity(ownerId, reason) {
  finalizeRecordingSessionsForOwner(ownerId, reason);
  appState.trackingOwners.delete(ownerId);
  refreshTray();
}
```

#### 🔴 Proč je definice `hasLiveRecording` nosná — návrh packetu z ní ztratil polovinu

Návrh psal jen *„true, dokud existuje rozdělaná příprava nebo session, která se ještě neuzavírá"*,
což svádí k `sessions.size > 0 || preparations.size > 0`. **To by story tiše rozbilo** a
✅ ověřil jsem v kódu proč:

- `finalizeRecordingSessionsForOwner` (`main.cjs:649-660`) je **fire-and-forget** — volá
  `void finalizeRecordingSession(...)` a nečeká.
- `recordingSessions.delete(sessionId)` je až na `main.cjs:638`, **uvnitř async IIFE**, tedy po
  `handle.sync()`, `fs.stat` a sha256 obou stop.
- `recordingOwnersPreparing.delete(ownerId)` je v **async `finally`** na `main.cjs:531-533`.
- Naopak `recordingSession.finalizePromise = (async () => {…})()` na `main.cjs:589` se přiřadí
  **synchronně** (IIFE běží do prvního `await`), a `preparation.cancelled = true` na `main.cjs:651`
  taky synchronně.

⇒ Se správnou definicí je synchronní `refreshTray()` hned za smyčkou pravdivý.
Se `size > 0` by lišta po pádu tvrdila „nahrává" ještě celé sekundy — **a žádná brána z návrhu
by nezčervenala**. Přesná formulace pochází z `specs/E3-vady-a-identita.md:46`.

**Tooltipy** (uvnitř `refreshTray`, česky, `spec.md:226`):

| Stav | Tooltip |
|---|---|
| `signed-out` | `LuDone · nepřihlášeno` |
| `idle` | `LuDone · připraveno` |
| `recording` | `LuDone · nahrává` |
| `tracking` | `LuDone · LuTrack běží` |
| `recording-tracking` | 🆕 `LuDone · nahrává + LuTrack běží` |

✅ První čtyři jsou doslova dnešní `labels` z `main.cjs:258-263`; přibývá jen pátý.

**Měřidlo (log):** `refreshTray()` vypíše **jen při skutečné změně** řádek

```
[tray] <ISO čas> stav=<x> nahrávání=<bool> lutrack=<bool> přihlášen=<bool>
```

Tenhle řádek **je** měřidlo živého ověření (§16) a **je** kanárek.

### 10.4 Co se z původního návrhu VĚDOMĚ vypouští

`specs/E3-vady-a-identita.md:46` u téhle práce žádá navíc *„poslat push do všech živých rendererů"*.
**B3 to NEDĚLÁ.** Panel si hlavičku (`global-status`) dál počítá sám z vlastního `useMemo`
(`src/App.jsx:20-25`), takže se s lištou může teoreticky rozejít. Je to vědomý řez, ne opomenutí:
push by znamenal nový kanál navíc a zásah do `src/App.jsx` nad rámec `plan.md` §2b.
**Zapiš do `decisions.md` spolu s `panel:facts`.**

---

## 11. Dependencies

| Vztah | Stav — **změřený, ne převzatý** |
|---|---|
| **Závisí na B1** | ✅ `plan.md:86` to říká. 🔴 **B1 NENÍ v `main`.** Změřeno: `git rev-list --count main..orca/desktop-b1` = **2 ahead, 4 behind**, tedy B1 právě běží ve worktree a **není mergovaný**. Návrh packetu tuhle podmínku uváděl jako splněnou premisu — není. **B3 nesmí začít, dokud B1 nepřistane v `main`**; jinak §16 měří něco jiného, než tvrdí |
| **Blokuje B5** | `plan.md:88`. B5 nahradí `tracking` v `panel:facts` skutečným časovačem. B5 je nejtěžší kus a visí na něm pět dalších stories (`plan.md:173-174`) — B3 ho nesmí zdržet |
| **Souběžně smí běžet** | B2 (jen dokumenty) a B4 (`electron/auth.cjs` + `shouldHidePanelOnBlur`) — ✅ `plan.md:108-109` |
| ⚠️ **Kolize s B5 uvnitř `main.cjs`** | Viz §12.1 — **`plan.md` §2 dává „hook na pád rendereru" story B5, ne B3.** Musí to rozhodnout koordinátor (otevřená otázka O2) |
| 🔴 **Nemergovaná T1** | Viz níž — je to horší, než návrh packetu tvrdil |

### 🔴 T1 (`ce2bea6`) — proč to není poznámka pod čarou

✅ Ověřeno `git diff $(git merge-base main ce2bea6) ce2bea6 -- electron/main.cjs`. T1 funkci
`trayIconName` **nerozšiřuje, ale celou přepisuje** na:

```js
function trayIconName(state) {
  const names = ["signed-out", "idle", "recording", "tracking"];
  // Brána čte seznam bez druhého výčtu; nový stav se tak přidává na jediné místo.
  if (arguments.length === 0) return [...names];
  return names.includes(state) ? state : "signed-out";
}
```

Důsledky, které návrh packetu neuvedl:

1. **Konflikt je jistý a je to konflikt těla funkce, ne signatury.** „Zachovám signaturu"
   nestačí — obě verze přepisují týž blok.
2. 🔴 **Kdyby při slučování vyhrála verze T1, `trayIconName("recording-tracking")` vrátí
   `"signed-out"`** — tedy přesně ta vada z `spec.md:208`, kterou B3 odstraňuje, jen tiše
   a znovu. **Záchranná síť je jediná: případ `["recording-tracking", "recording"]` v existujícím
   `it.each` v `tests/tray-authority.test.js`** (krok 4). Ten se **nesmí** z PR vynechat.
3. T1 taky vyhazuje `traySvg` a `trayImage` přepisuje na čtení PNG z `electron/ikony/`.
   **B3 se ani jednoho nedotkne.**
4. T1 přidává do `package.json` skript `test:tray-image`, který **není v `gates`** a CI ho nepustí.
   Není to věc B3, ale patří to do `DAN-TODO.md`.
5. **Kdo a kdy T1 sloučí, nikdo neurčil** — otevřená otázka O6.

Zmenšení konfliktu, které B3 udělat MŮŽE: (a) nesáhne na `traySvg` ani `trayImage`,
(b) zachová signaturu `trayIconName(state) → jméno`, (c) **nepřidá pátou kresbu** —
`recording-tracking` sdílí ikonu s `recording`, takže čtyři PNG od T1 dál stačí.
**T1 se v tomhle běhu nerozmrazuje.**

---

## 12. Přesné soubory a **VLASTNICTVÍ BLOKŮ**

🔴 ✅ `plan.md:104-106`: **Devět z dvanácti stories sahá do `electron/main.cjs`, osm do
`electron/preload.cjs`.** Věta „nesahej na cizí" tady prokazatelně nestačí.
**Tohle je výčet, který se používá jako filtr při KAŽDÉ editaci. Co v něm není, se nemění.**

### 12.1 Tabulka vlastnictví z `plan.md` §2 — doslovný opis (`plan.md:116-124`)

| Story | Vlastní v `main.cjs` | Vlastní v `preload.cjs` |
|---|---|---|
| **B3** | `trayIconName`, `updateTray`, `deriveTrayState`, registrace tray | odebrat `setTrayState` |
| B4 | `shouldHidePanelOnBlur` a jeho čítače | nic |
| B5 | registrace `tracking:*` kanálů, **hook na pád rendereru** | přidat `tracking:*` |
| B7 | zapojení fronty, `queue:*` kanály | přidat `queue:*` |
| B8 | `auth:begin` a jeho okolí | `beginAuth` |
| B9 | `auth:logout` | přidat `logout` |
| B11 | nic | nic |

### 🔴 12.1b Kde §12.2 sahá ZA tuhle tabulku — přiznaná odchylka

Návrh packetu tvrdil, že §12 je *„doslovný opis tabulky vlastnictví"*. **Není.** Zmrazený plán dává
B3 v `main.cjs` **čtyři bloky**. Následující §12.2 mu jich dává **osm**. Rozdíl je tenhle:

| Blok navíc | Komu ho `plan.md` §2 dává | Proč ho B3 přesto potřebuje |
|---|---|---|
| tři posluchače smrti rendereru v `createPanelWindow` | **B5** („hook na pád rendereru") | Bez nich `refreshTray()` po pádu nikdo nezavolá a story nedodá nic |
| `finalizeRecordingSessionsForOwner` (konec funkce) | nikomu jmenovitě | Tamtéž |
| pět míst, kde se mění nahrávací fakt (471, 521, 532, 589, 638) | nikomu jmenovitě | Bez nich se lišta nepřepočítá při běžném startu/stopu |
| handler `tray:get-state` (663) | nikomu jmenovitě | `trayState` bude nově logický stav, handler musí mapovat na jméno ikony |

🔴 **To je změna kontraktu dependency, a masterplán §9 ji implementátorovi zakazuje udělat sám.**
Proto: **koordinátor to musí rozhodnout a propsat do `plan.md` PŘED startem B3** (otevřená otázka O2).
Dokud to nerozhodne, implementátor **nezačíná** — a rozhodně to neřeší tím, že „to tam logicky patří taky".

### 12.2 Co B3 SMÍ změnit — jmenovitý výčet

✅ Všechna čísla řádků jsem otevřel a ověřil na `main` @ `590a57f`.

**`electron/main.cjs`** (soubor z `plan.md:144`):

| Řádky | Blok | Co s ním |
|---|---|---|
| 37–40 | `let tray; … let trayState = "signed-out";` | přidat `const appState = { signedIn: false, trackingOwners: new Set() }` |
| **220–230** | `function trayIconName(state)` | rozšířit o pátý stav → jméno ikony `recording` |
| **255–266** | `function updateTray(nextState)` | 🔴 **nahradit** funkcí `refreshTray()` bez argumentu + `deriveTrayState` + `hasLiveRecording` + log `[tray]` |
| **312–323** | tři posluchače smrti rendereru v `createPanelWindow`: `render-process-gone` (312), `destroyed` (316), `did-start-navigation` (319) | přesměrovat všechny tři na `forgetOwnerActivity(panelContents.id, …)`. ⚠️ **Zachovat `console.error` na 313** — je to kanárek K4 |
| 471, 521, 532, 589, 638 | ✅ `recordingOwnersPreparing.set` / `recordingSessions.set` / `delete` ve `finally` / přiřazení `finalizePromise` / `recordingSessions.delete` | přidat volání `refreshTray()` |
| 649–660 | `finalizeRecordingSessionsForOwner` | přidat **synchronní** `refreshTray()` na KONEC, za smyčku (proč to stačí → §10.3) |
| **662** | `onValidated("tray:set-state", ["panel"], (_event, state) => updateTray(state));` | 🔴 **smazat celý řádek**, nahradit `onValidated("panel:facts", ["panel"], …)` |
| **663** | `handleValidated("tray:get-state", ["panel","settings"], () => trayState);` | ponechat kanál, vracet **`trayIconName(trayState)`** |
| **728–731** | registrace tray v `app.whenReady` | `updateTray(trayState)` → `refreshTray()`. ⚠️ `tray.setTitle("")` na 729 **nechat** |

**`electron/preload.cjs`:** ✅ řádek **18** (`setTrayState`) smazat, přidat `reportPanelFacts`.
Soubor má celkem 22 řádků.

**`src/App.jsx`** (soubor z `plan.md:144`): ✅ řádky **34–36** — `useEffect` s `setTrayState`
nahradit hlášením faktů (`window.ludone.reportPanelFacts({ signedIn: Boolean(user), tracking: tracking.active })`).
Lokální `useMemo` na 20–25 pro **hlavičku panelu** může zůstat, ale **už neřídí lištu**.

🔴 ⚠️ **`src/App.jsx` NEMÁ ŽÁDNOU BRÁNU. Změřeno:**
- `jsconfig.json` ho má v `exclude` → `npm run typecheck` ho nekontroluje;
- `eslint.config.js` vypíná `no-unused-vars` pro `src/**`;
- žádný test v `tests/` ho nečte (✅ `grep -rn "App.jsx" tests scripts` → jen `scripts/akceptace/E1b.sh`);
- `ui-smoke` je v CI vypnutý.

⇒ Kdo odebere `setTrayState` z preloadu a **nechá** volání v `App.jsx:35`, dostane při každé změně
stavu `TypeError` v rendereru — a **všechny brány zůstanou zelené**. Proti tomu stojí nová
assertion v kroku 2b a sabotáž S8.

⚠️ CSS třída `global-status--<x>` **musí zůstat na čtyřech hodnotách** — ✅ `src/styles.css`
definuje jen `--recording`, `--tracking`, `--idle` (a základ), `.global-status--recording-tracking`
v něm **neexistuje** a `src/styles.css` **není** v seznamu souborů B3.

**`tests/tray-authority.test.js`** — domovská brána téhle story (✅ 42 řádků, helper `functionSource`
na 4–16), rozšířit a přepsat (§13).
**`tests/ipc-sender-guard.test.js`** — ✅ tvrdý výčet kanálů je pole na **řádcích 191–204**
(návrh psal 192–205); celý test je 186–210. Odebrat `"tray:set-state"` (řádek 203), přidat `"panel:facts"`.

### 12.3 🔴 Čeho se B3 NESMÍ dotknout ani o řádek

| Soubor / blok | Řádky | Čí to je |
|---|---|---|
| `main.cjs` → `traySvg` | ✅ 202–218 | **T1** (zmrazeno) |
| `main.cjs` → `trayImage` | ✅ 248–253 | **T1** (zmrazeno) — kresba ikony |
| `main.cjs` → `permissionPromptsInFlight` + `shouldHidePanelOnBlur` | ✅ 232–246 | **B4** |
| `main.cjs` → `handleValidated("auth:begin", …)` | ✅ 681–692 (návrh psal 680–692) | **B8** |
| `main.cjs` → `permission:request` | ✅ 694–707 | B4/B6 okolí |
| `electron/auth.cjs`, `electron/queue.cjs` | celé | B4/B8/B9, B7 |
| `scripts/ui-smoke.mjs` | celé | **B1** — a B1 do něj **právě teď zapisuje** |
| `src/styles.css`, `src/features/**`, `src/components/**` | celé | B5/B6/B7 (a `Onboarding.jsx` právě mění B1) |
| `design/**` | celé | 🔴 zakázáno pro celý běh (`plan.md:190`, `AGENTS.md:66`) |
| `docs/changes/desktop-v1/spec.md`, `plan.md` | celé | 🔴 **ZMRAZENO** — chybu zapiš do `DAN-TODO.md`, neopravuj. **Výjimka: propsání `panel:facts` do `plan.md` dělá KOORDINÁTOR, ne implementátor** (DoD 14) |

---

## 13. TDD kroky

Masterplán §13 (`MASTERPLAN.md:812-820`): napiš cílený failing test, **spusť ho a ověř správný
důvod selhání**, teprve pak implementuj. Brána se **nezměkčuje** (`MASTERPLAN.md:824-836`).
Všechny výpisy měř **před rourou**; na macOS nepoužívej `timeout` (✅ `AGENTS.md:45`).

### 🔴 Krok 0 — jak testy vůbec psát, aby šly vidět červené

Návrh packetu předepisoval extrakci na úrovni modulu:

```js
const deriveTrayState = Function(`…${functionSource(mainSource, "deriveTrayState")}…`)();
```

✅ **Změřeno naostro, že s ní kroky 2 a 3 NIKDY neuvidíš.** Pustil jsem v opravdovém vitestu
(v3.2.7) soubor, který takhle extrahuje `deriveTrayState` a **navíc** obsahuje assertion kroku 2.
Doslovný výstup:

```
 FAIL  …/b3-probe.test.js [ …/b3-probe.test.js ]
Error: Funkce deriveTrayState nebyla nalezena
 ❯ functionSource …/b3-probe.test.js:6:24
      4| function functionSource(source, name) {
      5|   const start = source.indexOf(`function ${name}(`);
      6|   if (start < 0) throw new Error(`Funkce ${name} nebyla nalezena`);
       |                        ^

 Test Files  2 failed (2)
      Tests  1 failed (1)
```

Soubor spadl jako **Failed Suite** a přispěl **nulou testů** — assertion kroku 2 v témž souboru
**vůbec neproběhla**. Návrh přitom sliboval, že se u kroku 2 zapíše „očekávaná červená (obojí)".
To nejde.

🔴 **Proto: extrahuj funkce LÍNĚ uvnitř každého testu**, ne na úrovni modulu:

```js
function loadFn(name) {
  return Function(`"use strict"; ${functionSource(mainSource, name)}; return ${name};`)();
}
```

Pak každý test spadne se svou vlastní hláškou a „ověř správný důvod selhání" je proveditelné.

⚠️ Návrh packetu u kroků 1 a 2 tvrdil *„Ověřeno … tímtéž helperem"*. **Nebylo** — autor to
reprodukoval vlastním node skriptem mimo vitest, což sám přiznal. Výpisy níž jsou **moje měření
skutečným vitestem**, resp. skutečným node během helperu.

### Krok 1 — RED #1: odvození stavu z faktů

Soubor: **`tests/tray-authority.test.js`**.

```js
describe("stav lišty se odvozuje z faktů, ne z názoru rendereru", () => {
  it.each([
    [{ signedIn: false, recording: true, tracking: true }, "signed-out"],
    [{ signedIn: true, recording: true, tracking: true }, "recording-tracking"],
    [{ signedIn: true, recording: true, tracking: false }, "recording"],
    [{ signedIn: true, recording: false, tracking: true }, "tracking"],
    [{ signedIn: true, recording: false, tracking: false }, "idle"],
  ])("%o → %s", (facts, expected) => {
    expect(loadFn("deriveTrayState")(facts)).toBe(expected);
  });
});
```

Spusť `npx vitest run tests/tray-authority.test.js`. **Musí spadnout na:**

```
Error: Funkce deriveTrayState nebyla nalezena
```

✅ Ověřeno mnou dvakrát: skutečným vitestem (výpis výš) i přímým během helperu nad
`electron/main.cjs`. Funkce v souboru není.

✅ **Změřeno navíc:** `it.each` s heterogenními n-ticemi **projde `npm run typecheck`** — pustil
jsem `tsc` se stejnými `compilerOptions` nad ekvivalentním souborem, EXIT=0. `tests/**` typovou
kontrolou prochází, tohle ji nerozbije.

🔴 **Když spadne na něčem jiném** (např. `expected undefined to be 'idle'`), je červený ze špatného
důvodu — zastav a zjisti proč.

### Krok 2 — RED #2: renderer už stav nediktuje

```js
it("hlavní proces nepřebírá stav od rendereru", () => {
  expect(mainSource).not.toContain("tray:set-state");
  expect(preloadSource).not.toContain("setTrayState");
});

it("stav lišty se počítá, nepřebírá", () => {
  expect(mainSource).toMatch(/function refreshTray\(\)\s*\{/);   // BEZ argumentu
  const refresh = functionSource(mainSource, "refreshTray");
  expect(refresh).toContain("deriveTrayState(");
  expect(refresh).toContain("hasLiveRecording(");   // 🔴 recording NESMÍ přijít z rendereru
});
```

Očekávané červené (doslova zapsat do PR — každá zvlášť, díky kroku 0):

```
AssertionError: expected '…' not to contain "tray:set-state"
Error: Funkce refreshTray nebyla nalezena
```

✅ Ověřeno: `tray:set-state` je dnes v `main.cjs:662` i `preload.cjs:18`, `setTrayState`
v `preload.cjs:18`, `refreshTray` neexistuje.

🔴 **`toContain("hasLiveRecording(")` je nová a je nutná.** Bez ní jde `refreshTray` napsat tak,
že `recording` vezme z `panel:facts` — renderer dál diktuje, brána zůstane zelená, story je
dodaná jen naoko. Chytá to sabotáž S5.

### Krok 2b — RED #2b: renderer opravdu přestal volat (nová, návrh ji neměl)

```js
it("panel hlásí fakta a nediktuje stav", () => {
  const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  expect(appSource).not.toContain("setTrayState");
  expect(appSource).toContain("reportPanelFacts(");
  expect(preloadSource).toContain("reportPanelFacts");
});
```

Očekávaná červená: `expected '…' to contain "reportPanelFacts("`.

🔴 **Tohle je jediná brána, která kdy uvidí `src/App.jsx`** (viz §12.2). Bez ní projde
zapomenuté volání do mrtvého API a všechny ostatní brány zůstanou zelené. Chytá to sabotáž S8.

### Krok 2c — RED #2c: `tray:get-state` vrací jméno ikony (nová, návrh ji neměl)

```js
it("tray:get-state vrací jméno ikony, ne logický stav", () => {
  expect(mainSource).toMatch(
    /handleValidated\(\s*"tray:get-state"[\s\S]{0,160}?trayIconName\(/,
  );
});
```

🔴 Bez téhle assertion může handler dál vracet `trayState`, tedy nově i `"recording-tracking"` —
a `scripts/ui-smoke.mjs` na to spadne. **Žádná unit brána by to dnes nechytila.** Sabotáž S7.

### Krok 3 — RED #3: pád rendereru přepočítá lištu (jádro story)

```js
it("smrt rendereru jde jedinou cestou a nesahá na přihlášení", () => {
  const forget = functionSource(mainSource, "forgetOwnerActivity");
  expect(forget).toContain("finalizeRecordingSessionsForOwner(");
  expect(forget).toContain("refreshTray()");
  expect(forget).not.toContain("signedIn");           // pád okna přihlášení NEMĚNÍ

  const panel = functionSource(mainSource, "createPanelWindow");
  expect(panel.match(/forgetOwnerActivity\(/g)).toHaveLength(3);   // všechny tři posluchače
  expect(panel).not.toContain("finalizeRecordingSessionsForOwner(");
});
```

Očekávaná červená: `Error: Funkce forgetOwnerActivity nebyla nalezena`.

✅ Ověřeno, že to dnes měří skutečnost: `functionSource(mainSource, "createPanelWindow")` vrací
64 řádků a obsahuje **právě 3** výskyty `finalizeRecordingSessionsForOwner(`. Počítání závorek
v helperu na dnešním zdroji funguje správně (ověřeno i pro `finalizeRecordingSession`,
`finalizeRecordingSessionsForOwner`, `updateTray`, `trayIconName`).

⚠️ **Poctivě: `expect(forget).not.toContain("signedIn")` nedokazuje, že `signedIn` pád přežije** —
je to kontrola nepřítomnosti řetězce, kterou splní i prázdná funkce. Skutečný důkaz je až
živé ověření §16 s kanárkem K5. Návrh packetu tuhle assertion vydával za víc, než je.

### Krok 3b — RED #3b: `hasLiveRecording` (nová, návrh ji neměl vůbec)

```js
it("nahrávání je živé jen dokud se neuzavírá", () => {
  const hasLive = loadFn("hasLiveRecording");
  const live = new Map([["s1", { finalizePromise: null }]]);
  const closing = new Map([["s1", { finalizePromise: Promise.resolve() }]]);
  const prepLive = new Map([["o1", { cancelled: false }]]);
  const prepCancelled = new Map([["o1", { cancelled: true }]]);

  expect(hasLive(live, new Map())).toBe(true);
  expect(hasLive(closing, new Map())).toBe(false);        // 🔴 jádro: uzavírá se ⇒ není živé
  expect(hasLive(new Map(), prepLive)).toBe(true);
  expect(hasLive(new Map(), prepCancelled)).toBe(false);  // 🔴 zrušená příprava ⇒ není živé
  expect(hasLive(new Map(), new Map())).toBe(false);
});
```

Očekávaná červená: `Error: Funkce hasLiveRecording nebyla nalezena`.

🔴 **Proto musí `hasLiveRecording` brát mapy argumentem, ne sahat na modulové proměnné** — jinak
ji nejde vyhodnotit přes `Function(...)` a tenhle test nejde napsat. Chytá to sabotáž S6.

### Krok 4 — přepis testu, který zamyká OPAČNÝ směr

✅ `tests/tray-authority.test.js:39-41` dnes doslova tvrdí:

```js
it("uložený stav lišty používá stejné čisté mapování", () => {
  expect(functionSource(mainSource, "updateTray")).toContain("trayIconName(nextState)");
});
```

To je assertion, která **zamyká starou architekturu** (`updateTray` bere stav zvenčí). `plan.md:98-99`
ji jmenovitě předvídá: *„B3 je architektonická změna, kterou spec fixuje a která se dotýká testu
zamykajícího opačný směr."* **Nahradit** přísnějším tvrzením nad `refreshTray` (krok 2)
a v PR **výslovně zdůvodnit**.

🔴 **Tohle je jediná povolená změna existujícího měřidla v téhle story.** Nová assertion musí být
**přísnější, ne volnější**. Cokoli dalšího by bylo změkčení měřidla (`MASTERPLAN.md:824-836`,
`AGENTS.md:40-42`).

**Musí zůstat ZELENÉ:** existující `it.each` mapování `trayIconName`
(`signed-out`/`idle`/`recording`/`tracking`/neznámý → `signed-out`, ✅ řádky 25-33)
+ **přibude případ `["recording-tracking", "recording"]`**.
🔴 **Ten přidaný případ je jediná záchranná síť proti tichému návratu vady při slučování T1** (§11).
Nesmí z PR vypadnout a nesmí se oslabit.

**Musí zůstat ZELENÝ i test na řádku 35-37** (`trayImage` obsahuje `trayIconName(state)`) —
B3 na `trayImage` nesahá.

### Krok 5 — implementace, minimum

Podle §10.3 a §12.2. Nic navíc.
⚠️ `eslint` má pro `electron/**` zapnuté `no-unused-vars` (✅ ověřeno v `eslint.config.js` — vypnuté
je jen pro `src/**`), takže nepoužitá `hasLiveRecording` nebo `deriveTrayState` shodí lint. To je
užitečné, ne překážka.

### Krok 6 — GREEN

`npm run test:unit` → EXIT=0, **77 + nové testy** zelených, **žádný ubývající**.
🔴 Kontroluj řádek `Test Files`, ne jen `Tests` — soubor, který spadne při sběru, hlásí
`Tests 0` a dá se přehlédnout (viz měření v kroku 0).

### Krok 7 — RED #4: výčet kanálů (nechat spadnout ZÁMĚRNĚ)

✅ `tests/ipc-sender-guard.test.js:191-204` drží **tvrdý výčet** registrovaných IPC kanálů.
Po smazání `tray:set-state` a přidání `panel:facts` **musí spadnout**. Nejdřív ho nech spadnout
a zapiš doslovný výpis — je to důkaz, že ten test kanály opravdu hlídá a není dekorace.
Teprve pak výčet srovnej.
🔴 Assertion na ✅ řádku 205 (`expect(registrations.filter(… "ipcMain."))` — žádný kanál mimo
validační wrapper) **zůstává beze změny**. Stejně tak řádky 206-209.

### Krok 8 — brány

Viz §15.

---

## 14. Sabotážní testy

Sabotáž, kterou brána nechytí, je důkaz, že brána neměří. **Každou proveď v produkčním kódu,
spusť bránu, zapiš doslovný výpis + EXIT kód, a hned ji vrať** (`git checkout -- <soubor>`).

🔴 **Oprava poměru:** návrh packetu tvrdil *„Poměr podle `plan.md` §3 bod 4: 4 červené : 1 zelená"*.
✅ `plan.md:183` doslova říká **„poměr 2–3 červené : 1 zelená"**. Návrh si tedy plán vymyslel
a sám si v §18 protiřečil. Níž je **8 červených : 3 zelené ≈ 2,7 : 1**, tedy uvnitř pásma.

| # | Co v produkčním kódu rozbít | Která brána to MUSÍ chytit | Očekávaný výpis |
|---|---|---|---|
| **S1** | Vrátit `main.cjs:662` do původního tvaru `onValidated("tray:set-state", ["panel"], (_event, state) => updateTray(state));` (⚠️ návrh tu předepisoval řádek `trayState = s`, který v repu **nikdy nebyl**) | krok 2 **a** `ipc-sender-guard` | `expected '…' not to contain "tray:set-state"` + neshoda výčtu kanálů |
| **S2** | V `deriveTrayState` dát `if (recording) return "recording";` **před** kontrolu `signedIn` | krok 1, první případ | `expected 'recording' to be 'signed-out'` |
| **S3** | Z `forgetOwnerActivity` smazat volání `refreshTray()` | krok 3 | `expected '…' to contain "refreshTray()"` |
| **S4** | V `createPanelWindow` vrátit **jeden** ze tří posluchačů na přímé `finalizeRecordingSessionsForOwner(...)` | krok 3 | `expected [ … ] to have a length of 3 but got 2` |
| **S5** 🆕 | V `refreshTray` vzít `recording` z uložených faktů (`appState.recording`) místo z `hasLiveRecording(...)` | krok 2 | `expected '…' to contain "hasLiveRecording("` |
| **S6** 🆕 | `hasLiveRecording` implementovat jako `sessions.size > 0 \|\| preparations.size > 0` | krok 3b | `expected true to be false` (případ „uzavírá se") |
| **S7** 🆕 | `tray:get-state` vrátit zpět na `() => trayState` | krok 2c | `expected '…' to match /handleValidated\(\s*"tray:get-state"…/` |
| **S8** 🆕 | Odebrat `setTrayState` z preloadu, ale **nechat** `window.ludone.setTrayState(...)` v `src/App.jsx:35` | krok 2b | `expected '…' not to contain "setTrayState"` |
| **G1 — ZELENÁ** | Přejmenovat tooltip `LuDone · připraveno` → `LuDone · nachystáno` | žádná | brána zůstane zelená ⇒ **měří logiku, ne copy** |
| **G2 — ZELENÁ** | Přidat do řádku `[tray] …` další pole na konec | žádná | zelená ⇒ měřidlo se smí rozšířit, aniž zčervená unit brána |
| **G3 — ZELENÁ** | Přejmenovat lokální proměnné uvnitř `hasLiveRecording` | žádná | zelená ⇒ krok 3b měří **chování**, ne identifikátory |

⚠️ **G1–G3 jsou stejně důležité jako S1–S8.** Brána, která červená na všechno, se za měsíc obejde.

---

## 15. Projektové brány

✅ Všechno ověřeno v `package.json`, `jsconfig.json`, `eslint.config.js`, `.github/workflows/ci.yml`
a změřeno spuštěním.

| Brána | Příkaz | Očekávání | Základ na `main` @ `590a57f` |
|---|---|---|---|
| Lint | `npm run lint` (= `eslint .`) | EXIT=0 | ✅ EXIT=0 (změřeno mnou) |
| Typecheck | `npm run typecheck` (= `tsc --noEmit -p jsconfig.json`) | EXIT=0 | ✅ EXIT=0 (změřeno mnou) |
| Unit | `npm run test:unit` (= `vitest run`) | EXIT=0, **žádný ubývající test** | ✅ 9 souborů / **77 testů** (změřeno mnou) |
| Vše najednou | `npm run gates` | EXIT=0 | = lint && typecheck && test:unit |
| Build | `npm run build` (= `vite build`) | EXIT=0 | ⛔ **nezměřeno** — CI ho pouští hned po `gates` |
| CI | `.github/workflows/ci.yml` na `macos-latest` | `npm ci` → `npm run gates` → `npm run build` | ✅ `ui-smoke` i `audio-smoke` mají `if: ${{ false }}` (řádky 27, 30) |

🔴 **Rozsah typecheck — přesně:** `jsconfig.json` má `include: ["src/lib/**/*.js", "tests/**/*.js"]`
a `exclude: ["src/components/**", "src/App.jsx", "electron/**", "scripts/**"]`.
⇒ Nové **testy** typovou kontrolou projít **musí**. ⇒ **`electron/main.cjs` ani `src/App.jsx`
typecheck nekontroluje vůbec** — to je důvod, proč §13 potřebuje kroky 2b a 2c.

🔴 **Stav příkazu měř PŘED rourou. Na macOS nepoužívej `timeout`** (✅ `AGENTS.md:45`).
🔴 **`ui-smoke` se nikdy nespouští v sandboxu** (✅ `plan.md:191`, `AGENTS.md:35-36`). Pouští ho
**člověk na Macu** — §16.

---

## 16. Live-verification scénář

Pro **člověka u Macu** (Dan). Bez tohohle kroku smí PR tvrdit nejvýš 🧪 **zelené testy**,
nikdy ✅ ověřeno naostro (`plan.md:162-164`, `MASTERPLAN.md:989-999`).

**Předpoklady, které se nesmí přehlédnout:**
- ⛔ **Na `main` je ikona v liště pravděpodobně PRÁZDNÁ.** Zdroj: commit message `ce2bea6`
  a `spec.md:97-100`. **Nikdo z nás to neviděl.** Ověřuje se proto **TOOLTIP a LOG, ne pixely**;
  v liště klikáš do prázdného místa vpravo nahoře.
- 🔴 **B1 musí být v `main`.** Pokud není (dnes není), krok 10 se **vynechá** a v evidenci se
  označí ⛔ NEMĚŘENO — ne ✅.

1. `npm run build` → EXIT=0.
2. `npm start` **z terminálu** — 🔴 jen tak je vidět stdout hlavního procesu. Aplikace spuštěná
   z Finderu stdout nemá (✅ `spec.md:328`). Výstup si rovnou přesměruj do souboru pro kanárky.
3. Klik do lišty → panel se otevře. Projít onboarding až na panel.
4. Najet myší na místo ikony → tooltip **„LuDone · připraveno"**. V logu `[tray] … stav=idle …`.
5. Spustit nahrávání → tooltip **„LuDone · nahrává"**, log `[tray] … stav=recording nahrávání=true`.
6. Spustit LuTrack (Start) → tooltip **„LuDone · nahrává + LuTrack běží"**,
   log `[tray] … stav=recording-tracking nahrávání=true lutrack=true`.
7. 🔴 **Shodit renderer.** ⚠️ Návrh packetu tu předepisoval `ps | grep | kill -9` a sám přiznal,
   že to nikdy nezkoušel. **Primární metoda je proto ta, kterou `plan.md:146` jmenuje u B5:**

   ```
   webContents.forcefullyCrashRenderer()
   ```

   (zavolat z hlavního procesu, např. dočasným `test:*` kanálem pod `IS_TEST_RUN`, nebo z Electron
   devtools). Je opakovatelná a netrefí cizí aplikaci.
   *Náhradní ruční cesta:* Monitor aktivity → proces Renderer **téhle** aplikace → Ukončit ihned.
   *`kill -9` na PID z `ps` použij až jako poslední možnost* a jen když `ps -A -o pid=,command= |
   grep -- "--type=renderer" | grep "ludone-desktop"` vrátí **právě jedno** PID.
   ⛔ **Nikdo neověřil, že kterákoli z těch cest v tomhle buildu vyvolá `render-process-gone`
   a ne `destroyed`.** Do evidence zapiš, která událost se v logu objevila.

8. **Změř M1:** kolik uplynulo mezi zabitím rendereru a řádkem `[tray] … stav=idle`.
   Tooltip musí říct **„LuDone · připraveno"** — **NE** „nahrává" a **NE** „nepřihlášeno".
   🔴 **Číslo se do PR zapisuje naměřené. Žádné „do ~2 s" bez měření.**
9. 🔴 **KANÁRCI — bez nich je výsledek ⛔ NEMĚŘENO, ne ✅** (✅ `spec.md:332-335`: *„Grep, který
   nenajde ani kanárka, je rozbitý grep — ne důkaz čistoty."*):

   | # | Kanárek | Když chybí |
   |---|---|---|
   | **K1** | `grep '\[tray\]' <log>` vrátí **aspoň jeden** řádek | měřidlo vůbec neběželo → ⛔ NEMĚŘENO |
   | **K2** | `grep -E 'Uloženo:\|Session uzavřena\|Uzavření po události' <log>` vrátí aspoň jeden řádek | nahrávání nikdy neběželo ⇒ „nahrávání=false" je triviálně pravdivé → ⛔ NEMĚŘENO. ⚠️ **Vzor rozšířen oproti návrhu**: `[recording] Uloženo:` (`main.cjs:643`) se loguje **jen když finalizace nechybovala**, a po pádu se místo úspěšné hlášky (`:655`) může objevit chybová (`:657`) |
   | **K3** | `grep 'stav=recording-tracking' <log>` vrátí aspoň jeden řádek | pátý stav se neměřil → ⛔ NEMĚŘENO |
   | **K4** 🆕 | `grep 'Renderer skončil' <log>` vrátí aspoň jeden řádek | **renderer vůbec nespadl** — celý krok 7 měřil něco jiného → ⛔ NEMĚŘENO |
   | **K5** 🆕 | `grep 'stav=idle' <log>` má na posledním `[tray]` řádku `přihlášen=true` | tvrzení „nepřeskočilo to na nepřihlášeno" jinak splní i aplikace, která se nikdy nepřihlásila → ⛔ NEMĚŘENO |

10. `node scripts/ui-smoke.mjs` **na Macu** (nikdy v sandboxu).

    🔴 **Návrh packetu tvrdil „Očekávané tray stavy v ui-smoke se nemění". To tvrzení je
    nepodložené a pravděpodobně nesprávné.** Co jsem změřil ve zdrojích:

    - ✅ `scripts/ui-smoke.mjs:180-187` — `assertTray` volá `waitFor`, a `waitFor` (řádky 17-30)
      **vrací první *truthy* výsledek**. Stav lišty je vždy neprázdný řetězec ⇒ **truthy** ⇒
      `assertTray` přečte hodnotu **jedinkrát a hned porovná. Neopakuje.** Žádné okno na doběhnutí.
    - ✅ `src/features/recording/RecordingCard.jsx:267` — `finishRuntime` nastaví
      `phase: "stopping"` **ještě před** `await` rekordérů, takže `isRecording` v rendereru
      zhasne během jednoho Reactího ticku. Proto `assertTray(panel, "tracking")` na
      `ui-smoke.mjs:329` (hned po `clickByText`, které čeká jen `delay(120)`) **dnes prochází**.
    - 🧪 **Po B3** main pustí `recording` až po doběhu `finalizeRecordingSession`
      (`main.cjs:589-645`): `await track.queue`, `handle.sync()`, `fs.stat` a **sha256 obou
      .webm stop**, pak zápis manifestu. To se do 120 ms vejít nemusí.

    ⇒ **Rizikové jsou `ui-smoke.mjs:329` (`"tracking"`) a `:354` (`"idle"`)**, obojí hned po
    „Zastavit nahrávání". A `:324` (`"recording"` při souběhu) projde **jen** tehdy, když
    `tray:get-state` opravdu vrací `trayIconName(trayState)` (krok 2c).

    ✅ **Změřeno, že to nikdo nezachrání:** B1 (větev `orca/desktop-b1`, 2 commity, **nemergováno**)
    se `assertTray` ani `waitFor` **vůbec nedotýká** — mění jen selektory oprávnění v onboardingu.
    A `ui-smoke` je v CI vypnutý. **Žádná brána tuhle regresi neuvidí.**

    🔴 **Proto: `ui-smoke` po B3 pusť a výsledek zapiš, ať dopadne jakkoli.**
    Když spadne na `assertTray`, **NEOPRAVUJ to úpravou `ui-smoke.mjs`** (cizí soubor B1 a bylo by
    to změkčení měřidla) **ani zrychlováním finalizace**. Zapiš doslovný výpis, označ ⛔, a vrať
    koordinátorovi otevřenou otázku O3.

    ⚠️ B1 přidává do `ui-smoke.mjs` ~47 řádků nad řádkem 168, takže **všechna čísla řádků
    v `ui-smoke.mjs` se po jeho mergi posunou.** Odkazuj se na jména funkcí, ne na čísla.

11. ⚠️ **Masterplán §13 „Design verification"** (`MASTERPLAN.md:838-850`) žádá u user-visible tasku
    screenshot a porovnání proti schválenému artefaktu. **Tooltip lišty se screenshotem zachytit
    prakticky nedá** a kresba ikony je zmrazená (T1). Zapiš proto do evidence výslovně:
    *„Design verification podle §13 neproběhla — B3 nemá vizuální výstup mimo tooltip; kresbu
    vlastní T1."* **Nevydávej to za splněné.**

12. Výsledek se všemi doslovnými výpisy ulož do ✅ existujícího adresáře
    `docs/changes/desktop-v1/evidence/verification/` a označ podle **pěti** stavů, které žádá
    ✅ `AGENTS.md:28-30`: ✅ ověřeno naostro · 🧪 zelené testy · ⛔ neověřeno · 🟡 podmíněně platné ·
    ⚠️ varování nebo rozpor. (Návrh packetu nabízel jen tři.)

---

## 17. Rollback

- **Jak:** `git revert <sha commitu B3>` — jeden logický commit, **žádná migrace, žádný killswitch,
  žádný stav na disku, žádný serverový zápis**. ✅ `plan.md:68`: „Každá story je samostatně
  revertovatelná. Žádná migrace v1 (desktop nikam nepíše)."
- **Po revertu ověř:** `npm run gates` EXIT=0 a `npm run test:unit` zpět na **77 zelených**
  (revert vrací i testy).
- **Kontrola, že revert opravdu proběhl:** `grep -n "tray:set-state" electron/main.cjs` řádek zase
  najde a `grep -n "setTrayState" electron/preload.cjs` také. Lišta po pádu rendereru zase lže —
  to je **očekávané**, je to návrat do výchozího stavu, ne nová vada.
- ⚠️ **Pořadí:** jakmile je nad B3 postavená **B5**, samostatný revert B3 rozbije B5.
  Revertuje se v opačném pořadí (B5, pak B3).
- ⚠️ **Revert B3 sám o sobě nevrátí propsání `panel:facts` do `plan.md` a `decisions.md`**, pokud
  je koordinátor commitne zvlášť. Musí být ve **stejném logickém commitu** (DoD 14) — jinak po
  revertu zůstane v plánu kontrakt, který v kódu neexistuje.
- **Expozice:** nic se nezapíná, `exposure` zůstává `disabled` — rollback nemá uživatelský dopad.

---

## 18. Definition of Done

**Převzato z `plan.md` §3 (✅ `plan.md:180-186`, platí pro každou story):**

1. Cílený test **napřed** a viděný **červený** ze správného důvodu.
2. `npm run lint`, `typecheck`, `test:unit` — všechny **EXIT=0**, **měřeno před rourou**.
3. Sabotáž, která prokazatelně chytá odstranění guardu, s **doslovným výpisem**.
4. Nejméně jeden případ, který musí zůstat **zelený** (**poměr 2–3 červené : 1 zelená**).
5. Diff přečtený Claudem, u money a RBAC povinně.
6. PR odkazuje na Feature ID a tenhle plán.
7. **Bez produkce a bez merge** před Danovým finálním schválením.

**Specifické pro B3 — navíc:**

8. `grep -n "updateTray\|tray:set-state" electron/main.cjs` **nevrátí nic**
   a `grep -n "setTrayState" electron/preload.cjs src/App.jsx` **nevrátí nic**.
   (⚠️ oproti návrhu přibyl `src/App.jsx` — je to jediný další volající.)
9. `deriveTrayState` **i** `hasLiveRecording` jsou **čisté funkce** — vyhodnotitelné přes
   `Function(...)` bez mocků, bez modulových proměnných, bez `require("electron")`.
   `hasLiveRecording` proto **bere mapy argumentem**. Na tom stojí kroky 1 a 3b.
10. Výčet kanálů v `tests/ipc-sender-guard.test.js` sedí s produkcí a PR nese **doslovný výpis
    toho, jak spadl, než se srovnal**.
11. `traySvg`, `trayImage`, `shouldHidePanelOnBlur`, `permissionPromptsInFlight` a
    `handleValidated("auth:begin", …)` mají v `git diff` **nula změněných řádků**
    (cizí vlastnictví: T1, T1, B4, B4, B8). Ověř `git diff --stat` + očima.
12. `src/styles.css`, `scripts/ui-smoke.mjs`, `src/components/**`, `design/**` **nejsou v diffu vůbec**.
13. PR vypisuje **čtyři osy** `DSK-F001` po změně (§3). 🔴 **`spec.md` se needituje** — je zmrazený;
    osy jdou do textu PR.
14. 🔴 Rozšíření kontraktu `panel:facts` **a** vědomý řez „bez push do rendererů" (§10.4) jsou
    propsané do `plan.md` a `decisions.md` **ve stejném logickém commitu** — dělá to **koordinátor**
    (`MASTERPLAN.md:911-919`: *„Tichá odchylka je blocker."*).
    ⚠️ Při zápisu do `decisions.md` **výslovně napiš „story B3"**, protože `decisions.md:69` už
    jedno rozhodnutí `B3` má (retence 7 dní) — viz §8.
15. 🔴 Přiznaná odchylka od `plan.md` §2 (bloky navíc, §12.1b) je v `plan.md` **rozhodnutá
    koordinátorem PŘED startem**, ne dodatečně omluvená v PR.
16. PR **netvrdí `verified-live`**, dokud §16 neproběhl u člověka. Zelené testy = 🧪, nic víc.
17. PR nese podle `MASTERPLAN.md:870-880` **Intent ID + commit, Spec ID + commit, Plan ID + SHA,
    Task ID, Feature ID, odkaz na `design/approved.json`, test evidence, live-verification
    evidence a každou vědomou odchylku** — hodnoty jsou v §1.
18. PR nese **naměřené číslo M1** (§16 krok 8), ne slib.
19. PR nese výsledek `ui-smoke` (§16 krok 10), i když je ⛔ nebo červený.

---

## 19. Implementátor

**Claude (Opus)** — ✅ `plan.md:98-99` to určuje jmenovitě: *„B3 je architektonická změna, kterou
spec fixuje a která se dotýká testu zamykajícího opačný směr."* Masterplán §10 nechává architekturu
na Claudovi. **Nedelegovat na Codex.**

Prostředí: vlastní worktree, **jeden zapisovatel** (✅ `AGENTS.md:19-20`).
⚠️ Souběžně už běží **B1** (`orca/desktop-b1`, píše do `scripts/ui-smoke.mjs` a
`src/components/Onboarding.jsx`) a je založená větev `orca/desktop-b4`. Ani jedna se s B3
nepřekrývá — ale **B3 na B1 čeká** (§11).

### 🔴 Implementátor NESMÍ (masterplán §9, ✅ `MASTERPLAN.md:637-647`, doslova)

- rozšířit scope;
- změnit schválený design;
- vytvořit nový design-system pattern bez tasku a schválení;
- změnit API/datový kontrakt bez aktualizace plánu;
- oslabit test;
- obejít bránu;
- rozhodnout nové money nebo RBAC pravidlo.

*Pokud task packet nestačí, vrátí konkrétní otázku koordinátorovi. **Nehádá.***

🔴 **Konkrétně pro B3: otevřené otázky O1–O3 musí být zodpovězené PŘED prvním commitem.**
O2 (vlastnictví bloků) a O3 (`ui-smoke`) jsou **blokující** — bez nich by implementátor
rozhodoval za koordinátora o dependency kontraktu, což mu masterplán §9 zakazuje.

---

## 20. Reviewer

| Průchod | Kdo | Co konkrétně |
|---|---|---|
| Adversariální review nad diffem | **Codex** (`/codex:adversarial-review`) | ✅ `MASTERPLAN.md:909`: *„Agent, který napsal kód, nesmí být jedinou autoritou pro jeho schválení."* |
| Pass 1 Correctness | **koordinátor** | zejména: může `refreshTray` vzít `recording` odjinud než z `hasLiveRecording`? je `hasLiveRecording` odolné vůči „session se uzavírá"? |
| Pass 4 Spec compliance | **koordinátor** | sedí pátý stav s `spec.md:208`? nese tooltip text podle `spec.md:223`? |
| Pass 5 Plan compliance | **koordinátor** | sedí vlastnictví bloků z §12? **je odchylka §12.1b rozhodnutá v `plan.md`?** je `panel:facts` propsaný? |
| Pass 6 Design compliance | **koordinátor** | nevznikla nová kresba ani nový DS prvek? sedí to s `approved.json` a s „odznak, ne pátá ikona"? |
| Pass 7 Verification evidence | **Dan** | živé ověření §16 včetně **pěti** kanárků K1–K5 a výsledku `ui-smoke`. **Jen člověk smí napsat ✅ ověřeno naostro** |

**Pass 2 (Security/RBAC) a Pass 3 (Money safety):** formálně **N/A** — B3 nesahá na peníze, práva
ani tokeny. ⚠️ Reviewer to má **potvrdit pohledem do diffu**, ne převzít z tohohle řádku.
⚠️ `AGENTS.md:53-54` počítá **kontrolu odesílatele IPC** mezi věci, které review nad diffem
vyžadují — a B3 zavádí nový kanál. **Pass 2 tedy N/A není úplně:** `onValidated("panel:facts",
["panel"], …)` se musí zkontrolovat očima.

---

## Otevřené otázky — na tyhle se ZEPTEJ, nehádej

| # | Otázka | Blokuje start? |
|---|---|---|
| **O1** | **`panel:facts` v `plan.md` není.** Packet ho předepisuje, protože bez něj se main mezi B3 a B5/B8 nedozví o přihlášení ani o časovači. Koordinátor to musí propsat do `plan.md` + `decisions.md`. | 🟡 ne, ale musí být ve stejném commitu |
| **O2** | 🔴 **Vlastnictví bloků.** `plan.md:120` dává **„hook na pád rendereru" story B5**, ne B3. Packet §12.2 ho přesto dává B3 (a k tomu `finalizeRecordingSessionsForOwner`, pět míst změny nahrávacího faktu a handler `tray:get-state`). Bez těch bloků B3 nedodá nic; s nimi je to změna dependency kontraktu, kterou implementátor udělat nesmí. **Rozhodni a zapiš do `plan.md`.** | 🔴 **ANO** |
| **O3** | 🔴 **`ui-smoke` po B3.** Změřeno, že `assertTray` **neopakuje** čtení a že renderer dnes zhasíná `isRecording` o mnoho dřív, než main dokončí finalizaci. Řádky 329 a 354 tedy pravděpodobně zčervenají. Otázky pro koordinátora: (a) **je správné, aby lišta během ukládání dál říkala „nahrává"?** (b) kdo pak smí upravit očekávání v `ui-smoke.mjs` — B1, B3, nebo nová story? | 🔴 **ANO** |
| **O4** | **`tray:get-state` vrací čtyři jména ikon, ne pátý logický stav** — jinak by se musel změnit `scripts/ui-smoke.mjs` (soubor B1, mimo seznam souborů B3). Kdyby koordinátor chtěl pět hodnot, mění se obojí naráz a plán s tím. | 🟡 ne |
| **O5** | 🔴 **Kolize jména „B3".** ✅ `decisions.md:69` = rozhodnutí „Retence 7 dní"; `spec.md:168` (R19) na ně odkazuje jako „(B3)". Story B2, která to má přejmenovat, byla dnes v noci odložena (`590a57f`). **Jak se má implementátor v `decisions.md` odlišit?** | 🟡 ne |
| **O6** | **Nemergovaná větev T1 (`ce2bea6`)** přepisuje celé tělo `trayIconName` na `names.includes(state)`. Po jejím sloučení může pátý stav tiše spadnout na `"signed-out"`. **Kdo a kdy T1 sloučí a kdo za pořadí odpovídá?** T1 navíc přidává skript `test:tray-image`, který není v `gates`. | 🟡 ne |
| **O7** | **Kolik stavů má lišta mít.** `approved.json` říká osm, UX M19 sedm, kód čtyři, B3 dodá pět. Kam patří zbylé (fronta, výpadek zvuku, offline) a čí to je story? | 🟡 ne |
| **O8** | **Perzistence `signedIn` přes restart** neexistuje a B3 ji nezavádí — po restartu je lišta „nepřihlášeno", dokud panel nenaběhne a neohlásí fakta. Je to dnešní chování, ale nikde zapsané není. `specs/E3-vady-a-identita.md:58` na to navrhuje `electron/session-store.cjs`; **v `plan.md` žádná story taková není.** | 🟡 ne |
| **O9** | **Rozpor se starším `specs/E3-vady-a-identita.md`.** ⚠️ Upřesnění oproti návrhu packetu: E3 **není jen konkurenční návrh — je to prakticky předloha tohohle packetu** (`E3:46` obsahuje `appState`, `hasLiveRecording`, `refreshTray`, `forgetOwnerActivity`, formát logu `[tray]` i pátý tooltip, jen se staršími čísly řádků). Rozchází se ve dvou věcech: E3 chce `deriveTrayState` v novém `electron/tray-state.cjs` a chce push stavu do rendererů. **Packet jde podle zmrazeného `plan.md`, který `deriveTrayState` výslovně uvádí ve sloupci `main.cjs` (`plan.md:118`)** — proto zůstává blokem v `main.cjs`. Push se vypouští (§10.4). **Hlásím, neřeším sám.** | 🟡 ne |
| **O10** | ⛔ **Nezměřeno, jestli `forcefullyCrashRenderer()` / `kill -9` v tomhle buildu vyvolá `render-process-gone`, nebo `destroyed`.** Na tom stojí celý §16 krok 7. Ověří se prvním živým během. | 🟡 ne |

---

## Co revize opravila

Revize prošla `main` @ `590a57f`, otevřela veškerý dotčený kód a **sama spustila** lint, typecheck,
unit testy, vitest nad sondou a `tsc` nad sondou. Nálezy, seřazené podle toho, kolik by stály:

### Brány, které by zůstaly zelené s přítomnou vadou (5 nálezů)

1. **Kroky 2 a 3 nešlo vidět červené.** Extrakce `deriveTrayState` přes `Function(...)` na úrovni
   modulu shodí celý soubor při sběru; ✅ změřeno skutečným vitestem: `Test Files 2 failed`,
   `Tests 1 failed` — assertion kroku 2 ve stejném souboru **vůbec neproběhla**. Návrh přitom
   sliboval „očekávaná červená (obojí)". → přidán **krok 0** s línou extrakcí.
   Zároveň opraveno tvrzení „Ověřeno tímtéž helperem" — nebylo, autor to pouštěl mimo vitest.
2. **Nic nebránilo tomu, aby `recording` dál diktoval renderer.** `refreshTray` mohl vzít
   `recording` z `panel:facts` a všechny navržené brány by zůstaly zelené — story dodaná naoko.
   → assertion `toContain("hasLiveRecording(")` v kroku 2 + sabotáž **S5**.
3. **`hasLiveRecording` neměl žádný test a packet ztratil polovinu jeho definice.** ✅ Ověřeno
   v kódu, že naivní `size > 0` po pádu rendereru nechá tooltip na „nahrává" (mazání session je
   na `main.cjs:638` uvnitř async IIFE, mazání přípravy v async `finally` na 531-533).
   → funkce udělána čistou (bere mapy argumentem), přidán **krok 3b** a sabotáž **S6**.
   Přesná definice doplněna z `specs/E3-vady-a-identita.md:46`.
4. **`src/App.jsx` nemá žádnou bránu.** ✅ Změřeno: je v `exclude` typecheck, `no-unused-vars`
   je pro `src/**` vypnuté, žádný test ho nečte, `ui-smoke` je v CI off. Zapomenuté volání
   `window.ludone.setTrayState` by prošlo se všemi zelenými branami a rozbilo renderer.
   → přidán **krok 2b**, sabotáž **S8** a `src/App.jsx` do DoD 8.
5. **`tray:get-state` → `trayIconName(trayState)` nikdo netestoval.** Kdyby se na to zapomnělo,
   vrací se `"recording-tracking"` a padá to až v `ui-smoke`, který v CI neběží.
   → přidán **krok 2c** a sabotáž **S7**.

### Nepravdivá nebo nepodložená tvrzení (6 nálezů)

6. **„Kódový základ `main` @ `73322ad`" — `73322ad` není `main`.** Skutečná hlava je `590a57f`,
   `73322ad` je o čtyři commity pozadu. ✅ Zmírněno tím, že jsem změřil, že se mezi nimi **žádný
   kód nezměnil**, takže čísla řádků platí. Opraveno i tak.
7. 🔴 **„Očekávané tray stavy v `ui-smoke` se nemění" — nepodložené a nejspíš nesprávné.**
   ✅ Změřeno, že `assertTray` čte hodnotu **jedinkrát** (`waitFor` vrací první truthy výsledek)
   a že renderer dnes zhasíná `isRecording` už na `RecordingCard.jsx:267`, před `await`. Po B3
   pustí main `recording` až po sha256 obou stop. ⇒ `ui-smoke:329` a `:354` jsou reálná regrese,
   kterou **žádná brána neuvidí** (CI má `if: ${{ false }}`). ✅ Změřeno, že B1 `assertTray` ani
   `waitFor` nemění. → povýšeno na blokující otevřenou otázku **O3** a přepsán §16 krok 10.
8. **„Poměr podle `plan.md` §3 bod 4: 4 červené : 1 zelená" — plán říká 2–3 : 1.** Návrh si
   plán vymyslel a v §18 si sám protiřečil. → §14 přepsán na 8 : 3.
9. **§12 se vydávalo za „doslovný opis tabulky vlastnictví z `plan.md` §2". Nebylo.** Plán dává
   B3 čtyři bloky, packet osm — a jeden z nich (**hook na pád rendereru**) `plan.md:120` výslovně
   dává **B5**. → přidána sekce **§12.1b** s přiznanou odchylkou a blokující otázka **O2**.
10. **„do ~2 s"** — číslo nikdo neměřil a v kódu pro ně není opora. → nahrazeno povinným
    **měřením M1** zapsaným do PR.
11. **Drobnosti:** `main.cjs:662` nedělá `trayState = s`, ale `updateTray(state)` (sabotáž S1
    obnovovala řádek, který nikdy neexistoval) · výčet kanálů je na 191–204, ne 192–205 ·
    `auth:begin` je 681–692, ne 680–692 · M24 se jmenuje „Pád aplikace **nebo ukončení** během
    nahrávání" · `coveredStates` má 11 položek, ne 4.

### Chybějící vstupy a mantinely (5 nálezů)

12. **B3 „závisí na B1", ale B1 v `main` není.** ✅ Změřeno: `orca/desktop-b1` je 2 commity
    napřed a 4 pozadu — právě běží, nemergováno. Návrh to uváděl jako splněnou premisu.
    → §11 přepsán, §16 dostal podmínku pro krok 10.
13. **Masterplán §14 chce v PR Intent ID i Spec ID s commity.** Packet je neměl, takže by podle
    něj nešel napsat vyhovující PR. → doplněno do §1 a do DoD 17.
14. **Kolize jména „B3".** ✅ `decisions.md:69` je rozhodnutí „Retence 7 dní" a `spec.md:168`
    (R19) na ně odkazuje jako „(B3)". Packet přitom implementátora posílá psát do `decisions.md`.
    → varování v §8, doplněno do DoD 14, otázka **O5**.
15. **T1 byl podceněn.** ✅ Přečten diff `ce2bea6`: `trayIconName` je tam přepsaná na variadickou
    funkci nad polem čtyř jmen. Po sloučení by pátý stav tiše padal na `"signed-out"` — přesně
    ta vada ze `spec.md:208`. → §11 rozšířena, případ `["recording-tracking","recording"]`
    v kroku 4 označen jako jediná záchranná síť.
16. **Kanárci nechytali dva prázdné běhy.** K2 hlídal jen `Uloženo:`, které se po chybě vůbec
    nezaloguje; chyběl důkaz, že renderer opravdu spadl, a důkaz, že `signedIn` přežil.
    → K2 rozšířen, přidány **K4** a **K5**. `kill -9` nahrazen `forcefullyCrashRenderer()`
    z `plan.md:146`. Doplněno pět stavů ověření podle `AGENTS.md:28-30` místo tří a chybějící
    krok „Design verification" z masterplánu §13 (poctivě označený jako neproveditelný).

### Co revize ověřila jako správné

Plan SHA `c7b1bb7` ✅ · citace ze `spec.md` §6/§7/§8/§11 ✅ doslovné · citace z `approved.json`,
`design/navrh/nahled.html:147` a `design/navrh/Lista.dc.html:151` ✅ doslovné ·
`EXPERIENCE.md` opravdu neexistuje ✅ · adresář `evidence/verification/` existuje ✅ ·
`AGENTS.md` o rouře a `timeout` ✅ · zákaz `design/**` ✅ · CI má oba smoke testy vypnuté ✅ ·
všech pět míst změny nahrávacího faktu (471, 521, 532, 589, 638) ✅ · rozsahy 202–218, 220–230,
232–246, 248–253, 255–266, 312–323, 649–660, 662, 663, 728–731 ✅ · `preload.cjs:18` ✅ ·
`src/App.jsx:20-36` ✅ · `tray-authority.test.js:39-41` ✅ · helper `functionSource` počítá závorky
na dnešním zdroji správně ✅ · `it.each` s heterogenními n-ticemi projde typecheck ✅ (EXIT=0) ·
baseline 77 zelených testů, lint a typecheck EXIT=0 ✅.

## Co packetu chybí ve spec/plan

- ROZHODNUTÍ O VLASTNICTVÍ BLOKŮ (blokující): plan.md:120 dává 'hook na pád rendereru' story B5, ale bez těch tří posluchačů v createPanelWindow B3 nedodá nic. Stejně tak plan.md §2 nedává B3 ani finalizeRecordingSessionsForOwner, ani pět míst změny nahrávacího faktu, ani handler tray:get-state. Koordinátor to musí rozhodnout a zapsat do plan.md PŘED startem — implementátor to podle masterplánu §9 udělat nesmí.
- ROZHODNUTÍ O ui-smoke (blokující): po B3 pustí main 'recording' až po doběhu finalizeRecordingSession (sha256 obou .webm stop), zatímco assertTray v ui-smoke.mjs:180-187 čte hodnotu jedinkrát bez opakování a řádky 329 a 354 očekávají 'tracking'/'idle' hned 120 ms po kliknutí na Zastavit. Chybí produktové rozhodnutí, jestli lišta smí během ukládání dál říkat 'nahrává', a chybí určení, kdo pak smí upravit očekávání v ui-smoke.mjs (soubor patří B1).
- KONTRAKT panel:facts v plan.md vůbec není. Plan §1 'Kontrakty' mluví jen o serveru, čase a GUID. Bez něj se main mezi B3 a B5/B8 nedozví o přihlášení ani o časovači a lišta uvázne na 'nepřihlášeno'.
- SPEC ID A INTENT ID s commity pro hlavičku PR — masterplán §14 (MASTERPLAN.md:870-880) je vyžaduje, návrh packetu je neuváděl. (Dohledal jsem je a doplnil, ale patří to do zadání koordinátora.)
- STAV ZÁVISLOSTI B1: plan.md:86 říká, že B3 závisí na B1, ale B1 není v main (orca/desktop-b1 = 2 commity napřed, nemergováno). Chybí určení, jestli B3 čeká, nebo jede a živé ověření se degraduje na ⛔.
- PRAVIDLO PRO KOLIZI JMÉNA 'B3': decisions.md:69 je rozhodnutí 'Retence 7 dní', spec.md:168 (R19) na ně odkazuje jako '(B3)'. Story B2, která to má přejmenovat, byla odložena. Chybí konvence, jak se má zápis do decisions.md odlišit.
- VLASTNÍK A POŘADÍ MERGE VĚTVE T1 (ce2bea6): přepisuje celé tělo trayIconName na names.includes(state) nad polem čtyř jmen, takže po sloučení může pátý stav tiše padat na 'signed-out'. Nikdo neurčil, kdo a kdy to sloučí.
- ROZHODNUTÍ O PUSH STAVU DO RENDERERŮ: specs/E3-vady-a-identita.md:46 ho u téhle práce žádá ('poslat push do všech živých rendererů'), plan.md o něm mlčí, návrh packetu ho tiše vypustil. Panel si hlavičku dál počítá sám a může se s lištou rozejít.
- KOLIK STAVŮ MÁ LIŠTA MÍT: approved.json (openDesignQuestions[0]) říká osm, docs/ux M19 sedm, kód čtyři, B3 dodá pět. Chybí určení, kam patří zbylé (fronta, výpadek zvuku, offline) a čí to je story.
- PERZISTENCE signedIn PŘES RESTART: neexistuje a žádná story v plan.md ji nemá. specs/E3:58 na to navrhuje electron/session-store.cjs. Po restartu bude lišta 'nepřihlášeno', dokud panel nenaběhne — nikde to není zapsané jako přijaté chování.
- ROZPOR spec.md §6 vs §7: §7 (řádek 225) chce šablonovou ikonu (černá + alfa), §6 popisuje stavy barvami ('červená', 'zelená'). Není rozhodnuté, který text platí; kresbu vlastní zmrazený T1.

## 🔴 Co NEBYLO ověřeno v kódu

Skeptik packet přečetl proti kódu, ale tohle zůstalo bez důkazu.
**Než na tom postavíš implementaci, otevři to.**

- Nespustil jsem aplikaci (npm start) ani node scripts/ui-smoke.mjs — vyžadují GUI, zvuk a oprávnění Záznam obrazovky; AGENTS.md:35-36 a plan.md:191 to v sandboxu zakazují. Klíčové tvrzení revize, že ui-smoke:329 a :354 po B3 zčervenají, je odvozené ze čtení kódu (ui-smoke.mjs:17-30 waitFor, 180-187 assertTray, 329/354; RecordingCard.jsx:267; main.cjs:589-645), NENÍ změřené. Je to hypotéza s doloženým mechanismem, ne měření.
- Nespustil jsem npm run build. Změřil jsem jen npm run lint (EXIT=0), npm run typecheck (EXIT=0) a npm run test:unit (9 souborů / 77 testů, EXIT=0).
- Neměřil jsem, jak dlouho finalizeRecordingSession na Danově stroji trvá (sha256 dvou .webm stop + fsync + zápis manifestu). Celé číslo M1 v §16 je proto předepsané jako povinné měření, ne jako tvrzení.
- Neověřil jsem naostro, že forcefullyCrashRenderer() ani kill -9 v tomhle buildu vyvolá událost render-process-gone (main.cjs:312) a ne destroyed (316). Krok 7 živého ověření na tom stojí a je označený ⛔.
- Neověřil jsem, že ikona v liště je na main opravdu prázdná. Mám to z commit message ce2bea6 a ze spec.md:97-100, ne z vlastního pozorování.
- Neověřil jsem chování variantry trayIconName z větve T1 za běhu (arguments.length === 0 vrací seznam) — jen jsem přečetl diff ce2bea6 proti merge-base 6e09e7d. Nikdy jsem tu funkci nespustil.
- Nespustil jsem tests/tray-image-electron.js z větve T1 ani jsem ten soubor neotevřel — vím jen ze stat diffu, že má 66 řádků a že T1 k němu přidává npm skript test:tray-image, který není v gates.
- Neověřil jsem GREEN stranu TDD — pustil jsem jen RED (že deriveTrayState/refreshTray/forgetOwnerActivity/hasLiveRecording v main.cjs nejsou). Nenapsal jsem funkční implementaci a neviděl jsem navrhované testy zezelenat. Nesměl jsem editovat repo.
- Neověřil jsem za běhu, že onValidated('panel:facts', ['panel'], …) opravdu propustí panel a odmítne okno nastavení — přečetl jsem jen requireTrustedSender/trustedSenderKind (main.cjs:109-120) a src/main.jsx (settings renderuje SettingsApp, ne App), takže je to úsudek ze zdroje.
- Neověřil jsem, že vyhození chyby z handleru panel:facts vyprodukuje přesně řádek '[ipc] Odmítnuto panel:facts: neplatný tvar' — odvodil jsem to z onValidated (main.cjs:158-168), nespustil.
- Neměřil jsem, kolik řádků diffu B3 opravdu bude; číslo ~120 je opsané z plan.md:144 a označil jsem ho v packetu jako odhad.
- Nečetl jsem docs/ux/cesta-uzivatele-2026-09-01.md celý (46 KB) — otevřel jsem řádky 44-58 (momenty M14-M28) plus cílené grepy. Zbytek jsem neviděl.
- Nečetl jsem všechny designové artboardy. Otevřel jsem design/approved.json celý, design/navrh/Lista.dc.html řádky 145-160 plus grepy na 'odznak', design/navrh/nahled.html řádky 140-155. Zbylých ~20 souborů v design/canvas a design/navrh jsem neviděl.
- Nečetl jsem spec.md celý — otevřel jsem §3 (59-136), §4 (137-171), §5, §6, §7, §8 (201-262) a §11 (280-336). §1, §2, §9 a §10 jsem neviděl.
- Nečetl jsem specs/E3-vady-a-identita.md celý — jen výsledky grepu na tray-state.cjs/session-store/deriveTrayState, tedy řádky 34, 36, 46, 48, 58, 126, 129. Zbytek dokumentu jsem neotevřel.
- Nečetl jsem decisions.md celý (jen řádky 1-30 a grep na B*), ani intent.md, podklady-vytezene.md, rozhodovaci-balik.md, STAV.md, BEH-NOC.md, PROMPT-IMPLEMENTACE.md a sekce-navrhy/.
- Nečetl jsem MASTERPLAN.md celý — otevřel jsem §9 (608-649), §13 (808-866), §14 (868-921) a §18 (985-1022) plus seznam nadpisů. Sekce 1-8, 10-12, 15-17 a 19-22 jsem neviděl.
- Neověřil jsem, jestli ostatní existující testy (panel-blur-guard, permissions, manifest, queue, oauth-state, pkce, recording-order-guard) na změnu main.cjs nezareagují jinak, než čekám — spustil jsem je jen nad nezměněným main.
- Neověřil jsem obsah B4 packetu (docs/changes/desktop-v1/tasks/B4-tri-vady-prihlaseni.md) — u B1 jsem grepoval na assertTray/waitFor/tray (nula shod) a přečetl prvních 40 řádků, u B4 nic. Tvrzení, že B4 s B3 nekoliduje, mám z plan.md:108-109, ne z vlastního čtení jeho packetu.
- Nespustil jsem scripts/akceptace/*.sh ani jsem tyto brány neotevřel — o E2-sabotaze.sh vím jen z citace v B1 packetu.
