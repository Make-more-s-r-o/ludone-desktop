# Task packet B5 (revidovaná verze)

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


> **Vykonavatel: Codex (`gpt-5.6-sol`).**
> 🔴 **MONEY PATH.** Chyba tady stojí lidi vykázané hodiny — a protože do Tabidoo teče
> **týdenní souhrn**, duplicita ani ztráta minut nejsou vidět (R10). Kde ti něco chybí,
> **vrať konkrétní otázku koordinátorovi. Nehádej.**
>
> ⚠️ Tahle verze vznikla revizí návrhu. Návrh obsahoval **prokazatelně nepravdivé tvrzení
> o bráně**, **test, který zůstane zelený i pod vlastní sabotáží**, **rozpor se zmrazeným
> specem** a **pět money cest bez měřidla**. Viz „Co revize opravila" na konci — nečti
> packet bez ní.

---

## 1. Plan ID a Plan SHA

Změřeno `git log -1 --format=%H -- <soubor>` 1. 9. 2026, `git status --porcelain` prázdný.

| | |
|---|---|
| **Plan ID** | `desktop-v1` → `docs/changes/desktop-v1/plan.md` (ZMRAZENO) |
| **Plan SHA** | `c7b1bb715f87f53ca0a209d5d3b96e6018e1e437` ✅ ověřeno |
| **Spec SHA** | `1e9709779e94a654a0c3c959d260082d42801acc` ✅ ověřeno |
| **Design SHA** | `26a06abd2ff8449cd74862ca3df7fb36f2db0005` (`design/approved.json`) ✅ ověřeno |
| **Cesta uživatele SHA** | `babdd5a0b31921d78cea6b6a14cce7f1aa191f72` ✅ ověřeno |

🔴 **HEAD se během psaní packetu posunul** (`04e87fc` → `0380bc0` → `9863d53`) — v repu píše
souběžná session. SHA těch čtyř dokumentů se přitom **nezměnily**. Platnost packetu visí na
nich, ne na HEAD. Před prvním commitem si je znovu změř; kterýkoli jiný ⇒ packet neplatí.

### Naměřený baseline bran (1. 9. 2026, `main`, čistý strom)

| Brána | Výsledek |
|---|---|
| `npm run lint` | **EXIT=0** ✅ ověřeno naostro |
| `npm run typecheck` | **EXIT=0** ✅ ověřeno naostro |
| `npm run test:unit` | **EXIT=0**, 9 souborů, **77 testů** ✅ ověřeno naostro |
| `node scripts/ui-smoke.mjs` | 🔴 **na `main` ČERVENÝ** (`DAN-TODO.md` §3a), opravuje B1 |

Po B5 musí `test:unit` hlásit **77 + tvoje nové testy**. Klesne-li počet, něco zmizelo.

---

## 2. Task ID

**B5** — *Časovač do hlavního procesu, atomická perzistence.*
PR název (`plan.md` §2b): `Own the timer in the main process`.
Odhad diffu bez testů: **~220 řádků**. **Nedělitelné.**

---

## 3. Feature ID

- **`DSK-F011`** — Časovač: start, přepnutí projektu, stop. Riziko **money**. Dnes
  `scope: approved · delivery: no-code · exposure: disabled · verification: unverified`.
- **`DSK-F013`** — Časovač přežije pád a restart. Riziko **money**. Dnes tytéž čtyři hodnoty.

Po B5: `delivery: coded` (`committed` až po mergi), `exposure` zůstává **`disabled`**,
`verification` nejvýš **`tests-green`**.
🔴 **PR nesmí tvrdit `verified-live`, dokud to někdo neviděl běžet** (`plan.md` §2b).

---

## 4. Cíl story

Přesunout **stav časovače a jeho perzistenci** z rendereru do hlavního procesu, do nového modulu
`electron/tracking.cjs`, a uložit ho **atomicky na disk dřív, než se o něm dozví renderer**.

Dnešní stav je atrapa: `src/features/tracking/TrackingCard.jsx` má 77 řádků a stav v `useState`
(`:8-12`, `useElapsedTime` na `:13`) — ✅ ověřeno otevřením souboru. Spec to jmenovitě označuje
za důvod, proč `DSK-F011` **není** `coded` (spec §3, pozn. ⁷).

Po B5 platí: **pád rendereru se časovače nedotkne a časovač BĚŽÍ DÁL**, restart aplikace najde
rozdělaný záznam a **zeptá se na něj** (R21), a klíč proti duplikaci existuje na disku od
okamžiku startu (R10).

🔴 **Pád rendereru a restart aplikace jsou DVA RŮZNÉ případy s OPAČNÝM výsledkem.** Viz §5 a §13
krok 3 — návrh packetu je sléval do jednoho a tím porušoval spec §8.

**B5 je práce POUZE v hlavním procesu a v mostu.** Renderer se v tomhle PR nemění — jeho zapojení
je **B6**. Je to hranice vlastnictví bloků (§12), ne opomenutí.

---

## 5. User-visible chování

**V této story přímo žádné.** `exposure` zůstává `disabled`, `TrackingCard.jsx` dál běží na
atrapě a nový most nikdo z UI nevolá. B5 staví autoritu stavu, B6 na ni napojí obrazovku.

Chování, které B5 musí **umožnit** a nesmí znemožnit:

| Co uživatel udělá | Co musí být pravda po B5 |
|---|---|
| Spustí čas na projektu | Vznikne záznam s **GUID projektu** a klíčem proti duplikaci, oboje **na disku** dřív, než volající dostane odpověď |
| Klikne **„Přepnout projekt"** za běhu | Časovač **se nezastaví** (R11). První úsek se uzavře na hranici minuty, druhý na téže hranici začne — žádná díra, žádný překryv. **Uzavřený úsek je na disku** |
| Zastaví nahrávání | Časovač **běží dál** (R4/C1). Nabídka „Zastavit i měření času?" je věc UI |
| **Spadne mu okno panelu** | Časovač **BĚŽÍ DÁL** a stav zůstává `bezi`. Spec §8 `DSK-F011` doslova: *„When zabiju renderer · Then panel se otevře s **běžícím** časovačem a správným časem."* **Ne `ceka-na-potvrzeni`** |
| **Ukončí a znovu spustí aplikaci** | Rozdělaný záznam se nezahodí ani tiše nezapočítá — je ve stavu `ceka-na-potvrzeni` a čeká na člověka (R21, M21) |
| Zastaví čas | Panel ukáže `5h 16m`, ne `5:16:07` (R9) — formát je B6, ale **hodnota** je ořezaná už tady |

---

## 6. Odkaz na schválený Claude Design artefakt

- **Schválení:** `design/approved.json` — `status: approved`, `approvedBy: Dan`, `2026-09-01`,
  směr **strong-fit**, `approvedVia: statická náhledová stránka design/navrh/nahled.html`.
- **Náhled (jediný závazný obraz):** `design/navrh/nahled.html` — čísla řádků ✅ ověřena:
  - sekce **2 — Výběr projektu** (`nahled.html:419-441`, podtitulek na `:421`):
    „Jen projekty, na které máš dnes platnou alokaci."
  - sekce **3 — Měří se čas** (`nahled.html:443-459`): `od 08:55` (`:449`) · `5h 16m` (`:450`) ·
    `Zbývá z alokace 116:19` (`:452`) · `Přepnout projekt` + `Stop` (`:454`).
    Podtitulek (`:445`) doslova: **„Projekt jde přepnout za běhu, časovač se nezastaví."**
  - sekce **4 — Běží obojí** (`nahled.html:461-480`): dvě samostatné karty, každá s vlastním
    Stopem; podtitulek (`:463`): **„Dvě nezávislé věci. Každá se zastaví zvlášť."**
- **Pokryté stavy** (`approved.json → coveredStates`, celkem jedenáct — **relevantní podmnožina**):
  `klid`, `jen čas`, `obojí`, `projekt s vyčerpaným rozpočtem (zablokovaný)`.

🔴 **Kontrola konzistence:** `08:55 → 14:11` je přesně `5h 16m`. Když ti ořez vyjde jinak, je vada
v ořezu, ne v návrhu.
⚠️ **Ale pozor: návrh ukazuje MÍSTNÍ čas, tvůj soubor drží UTC.** 1. 9. 2026 je Praha na UTC+2,
takže místní `08:55` je `06:55Z`. Test T2 používá `Z` časy jako **kontrolu délky úseku**, ne jako
tvrzení, že se uložená hodnota rovná zobrazené. Převod na místní čas je věc B6.

🔴 **Obrazovka „časovač po pádu se ptá" (R21) ve schváleném designu NENÍ** — ✅ ověřeno: není
mezi `coveredScreens` ani `openDesignQuestions`. **Nevymýšlej ji.** B5 drží jen *stav*
`ceka-na-potvrzeni` a rozhraní, kterým se rozhodnutí přijme. Kdo tu obrazovku nakreslí, je
otevřená otázka **O-B5-1** (§21).

---

## 7. Relevantní výřez EXPERIENCE.md

🔴 **`EXPERIENCE.md` v tomhle repozitáři NEEXISTUJE** (✅ ověřeno). Jeho roli hraje
**`docs/ux/cesta-uzivatele-2026-09-01.md`** — 31 momentů, výzkum 13 agentů (6 průzkumníků +
6 skeptiků + syntéza), část měřená naostro na Danově Macu. Čísla řádků ✅ ověřena.

**M19 — Souběh obou agend** (řádek 49):
> „`App.jsx` dává `useMemo` prioritu nahrávání, takže lišta **ZAMLČÍ**, že běží LuTrack. […]
> **Autoritou stavu ikony je dnes renderer, ne hlavní proces — po pádu okna zůstane v liště
> falešné ‚nahrává se'.** Ikona musí být template (černá + alfa) […] stav nese **TVAR**, ne barva."

✅ Ověřeno v kódu: `src/App.jsx:20-25` je přesně ten `useMemo` s prioritou `recording` nad
`tracking`. **Autoritu tray řeší B3, ne ty** — ale je to důvod, proč J5 krok (b) v §16 padá.

**M21 — Nečinnost a LuTrack** (řádek 51):
> „Past dvou agend: `getSystemIdleTime` měří HID […] **Čas se nikdy tiše nesmaže ani tiše
> nezapočítá.**"
> → Pro B5: **žádný default při obnově.** Ani „pokračuj", ani „zahoď".

**M24 — Pád aplikace nebo ukončení během nahrávání** (řádek 54):
> „Po pádu okna falešné ‚nahrává se' v liště. Po restartu nic o tom, že zůstala půlka nahrávky.
> […] `app.on('before-quit')` nastavuje jen `isQuitting = true`, žádné potvrzení, žádné uzavření
> souborů."

✅ Ověřeno: `main.cjs:746-748` opravdu dělá jen `isQuitting = true`.

**M25 — Vypršení přihlášení uprostřed dne** (řádek 55):
> „nahrávání jde na disk bez sítě a přihlášení nikdy nesmí nahrávku zastavit ani vyvolat dialog."
> → Totéž pro čas: měření času nesmí záviset na přihlášení ani na síti (R14).

**Hranice, kterou nesmíš překročit** — sekce **„Verdikt: kalendář" (řádek 17)**, ne moment M15:
> „projekt se smí jen PŘEDVYPLNIT, nikdy z něj nesmí vzniknout podmínka ‚nejdřív spusť LuTrack,
> pak smíš nahrávat' — agendy nesdílejí start ani stop"

🔴 **Návrh packetu tenhle citát připisoval momentu M15 (řádek 45). Tam není.** Řádek 45 mluví
o poznámce k nahrávce a o pasti v `transitionManifest`. Táž zásada je i v `intent.md:61`
(„závazná korekce 24. 8.") a ve spec §5 („Obě agendy mají vlastní automat a vlastní start i stop").

---

## 8. Relevantní business pravidla

Doslovně ze `spec.md` §4 a §11 (ZMRAZENO), znění ✅ ověřeno proti souboru.

| ID | Pravidlo | Co z toho plyne pro B5 |
|---|---|---|
| **R6** 🔴 money | „Nabízet **jen projekty s platnou alokací k dnešnímu datu**. Identita projektu je **GUID**, nikdy název — přejmenování firem 23. 7. 2026 srazilo platby na pět dní." | Výběr alokací je **B6**. B5 vynucuje jen tvrdou půlku: `tracking:start` **odmítne cokoli, co není GUID**. Dnešní atrapa posílá `"LuDone Desktop"` (`TrackingCard.jsx:5`) — takový start musí spadnout. ⚠️ **Co přesně je „GUID", žádný zmrazený dokument neříká** → otevřená otázka **O-B5-2** |
| **R8** 🔴 money | „Klient **nikdy neposílá hodinovou sazbu**. Dosazuje ji databáze z alokace." | V persistovaném stavu **není** sazba, částka ani měna, a nesmí přibýt |
| **R9** 🔴 money | „Start i stop se ořezávají na **celé minuty**, zobrazuje se `5h 16m`, ne `5:16:07`." | Ořez dělá **B5** (hodnota). Formát dělá B6. **`minutes` se počítá z OŘEZANÝCH konců**, ne z rozdílu surových časů |
| **R10** 🔴 money | „**Klíč proti duplikaci vzniká při STARTU** časovače, ne při odeslání. Do Tabidoo teče týdenní souhrn, takže duplicita není vidět — jen tiše zvedne hodiny do mzdových nákladů." | `clientTimeEntryId` vzniká v `start()`, je **neprázdný UUID** a je na disku dřív, než se vrátí volajícímu. **Nikdy se nemění** — ani při obnově |
| **R11** | „Přepnutí projektu za běhu časovač **nezastaví**." | `switchProject()` uzavře úsek a hned otevře nový. Nikdy nevrací stav „stojí" |
| **R4 / C1** | „Zastavení nahrávání **nezastaví časovač**. Nabídne se ‚Zastavit i měření času?' a nabídka zmizí sama (C1)." | Žádná cesta v nahrávacím kódu nesmí sáhnout na stav času — **včetně hooku na pád rendereru** |
| **R14** | „Vypršelý token se během nahrávání **neprojeví nijak**." | Časovač nevolá auth, síť ani server. `tracking.cjs` **nesmí volat server přímo** (`plan.md` §1) |
| **R18** 🔴 | „**Dva samostatné vypínače** (C2) […] Oba fail-closed — chybějící hodnota znamená vypnuto a **musí mít vlastní test**." | `DESKTOP_TIME_ENABLED` je **povinný argument**, porovnává se `=== "true"`. Vzor: `src/lib/queue.js:202-204` |
| **R21** 🔴 money | „Je-li `startedAt` starší než start procesu, časovač **nepokračuje ani se nezahodí — zeptá se**. ⚠️ Bez tohohle pravidla **zavřené víko v pátek vyfakturuje víkend**." | Obnova **po restartu procesu** ústí do `ceka-na-potvrzeni`. Žádný default. 🔴 **Netýká se pádu rendereru** — tam proces žije dál (spec §8 `DSK-F011`) |
| **R22** | „Zmizí manifest ⇒ obnova vyrobí nový klíč ⇒ vznikne duplikát… **do jména souboru patří plný GUID**." | Pravidlo o nahrávkách (B7/B11), ale **stejná past hrozí času**: klíč nesmí žít jen v paměti a `resolveRecovered` ho nesmí přerazit novým |

**Ze `plan.md` §1 „Jak se chrání peníze" — všechny čtyři body platí doslova:**
1. **Klient neposílá sazbu. Nikdy.** 2. **Klíč proti duplikaci vzniká při startu.**
3. Nabízí se jen projekty s platnou alokací a čerpáním pod 110 % *(vynucuje B6)*.
4. **Zápis do Tabidoo přímo z desktopu je zakázaný za všech okolností.**

---

## 9. Relevantní Architecture Spine invarianty

Doslovně z `plan.md` §1. **Podřízené úkoly tato rozhodnutí nesmějí předefinovat.**

| Modul | Vlastní | Nesmí |
|---|---|---|
| `electron/main.cjs` | okno, tray, IPC, životní cyklus | **rozhodovat o stavu podle rendereru** |
| `electron/tracking.cjs` *(nový — tvoje story)* | **stav časovače a jeho perzistence** | **volat server přímo** |
| `electron/queue.cjs` | odchozí fronta obou typů položek | znát obsah nahrávky |
| `src/**` (renderer) | **jen zobrazení** | **držet stav, který musí přežít pád** |
| `src/lib/adapters/**` *(nový, B6)* | překlad do backendu | obsahovat business pravidla |

**Kdo vlastní stav:**
> 🔴 „**Stav, který musí přežít pád rendereru, vlastní hlavní proces.** Renderer hlásí fakta,
> neurčuje stav. To ruší dnešní směr, kde renderer posílá tray svůj názor — a je to **jediná
> architektonická změna v tomhle plánu**."

**Kontrakty:**
- Čas jde **přes adaptér** — N1 zní „zatím nikam, později přes `app.ludone.cz`".
  ⚠️ Plán neříká, na které straně IPC adaptér leží (`src/lib/adapters/**` je renderer, `tracking.cjs`
  je main). **B5 definuje jen IPC povrch a neplete se do toho** → otevřená otázka **O-B5-3**.
- **Identita projektu je GUID, nikdy název.**
- `docs/server-modul/KONTRAKT.md:17` doslova: „**Vykázaný čas přes tenhle kontrakt neteče.**"
  ✅ ověřeno v souboru ⇒ B5 nesmí sáhnout na `POST /api/desktop/recordings` ani na frontu.

**RBAC:** „Desktop **žádnou z os nevyhodnocuje sám** — ptá se serveru a odpověď respektuje."
⇒ B5 nezavádí žádné vlastní rozhodnutí o právech. **Sdílené zařízení (B10) neřeš.**

**Rollback:** „Každá story je samostatně revertovatelná. **Žádná migrace v1.**"

---

## 10. Vstupní a výstupní rozhraní

### 10.1 Nový modul `electron/tracking.cjs`

🔴 **Nesmí volat `require("electron")`.** Jen `node:fs`, `node:path`, `node:crypto`.
✅ **Ověřený důvod:** `tests/queue.test.js:5` importuje `electron/queue.cjs` přímo do vitestu
(`import queueStore from "../electron/queue.cjs"`, `vitest.config.js` má `environment: "node"`),
a `electron/auth.cjs` (`:1-5`) také nesahá na Electron, proto ho umí načíst
`tests/permissions.test.js` přes `createRequire`. Jakmile modul sáhne na Electron, **přestane jít
otestovat** a zbude ti grep nad zdrojákem — přesně ta třída lhavé brány, kvůli které tenhle
repozitář v srpnu hlásil hotovou práci, co se nikdy nespustila.

```js
// electron/tracking.cjs
module.exports = {
  TRACKING_SCHEMA_VERSION,   // = 1
  TRACKING_STATES,           // { RUNNING: "bezi", PENDING: "ceka-na-potvrzeni", CLOSED: "uzavreno" }
  TIME_DISABLED_REASON,      // "měření času je vypnuté"
  TRACKING_SAVED_LOG_PREFIX, // "[tracking] Uloženo:"  — kanárek, viz §16
  floorToMinute,             // (isoNeboMs) → ISO 8601 UTC ořezané DOLŮ na celou minutu
  createTrackingStore,
  handleRendererGone,        // (store, { log }) → void; volá ho main.cjs, viz 10.3
};

/**
 * @param {object} deps
 * @param {string}   deps.filePath          cesta k souboru stavu
 * @param {string|undefined} deps.timeEnabled  POVINNÝ argument — hodnota DESKTOP_TIME_ENABLED
 * @param {string}   [deps.processStartedAt] ISO okamžik startu TOHOTO procesu; default new Date().toISOString()
 * @param {object}   [deps.fs]              injektovatelné fs (default node:fs) — kvůli T11/S5
 * @param {Function} [deps.now]             default Date.now
 * @param {Function} [deps.newId]           default randomUUID
 * @param {Function} [deps.log]             default console.log — kvůli T12
 */
function createTrackingStore(deps) → {
  load(),                                  // async → stav; PROVEDE obnovu podle R21
  getState(),                              // sync → poslední načtený stav (bez I/O)
  start({ projectId, note }),              // async
  switchProject({ projectId }),            // async
  stop(),                                  // async
  resolveRecovered({ decision, endedAt }), // async; "pokracovat"|"ukoncit"|"zahodit"
}
```

🔴 **`processStartedAt` MUSÍ být injektovatelná závislost.** Bez toho nejde R21 v unit testu
změřit — obě instance store běží v témže procesu a jakýkoli odvozený „start procesu" by u obou
vyšel stejně. Návrh packetu ji měl jen jako pole ve schématu a test T3 by na korektní
implementaci padal.

**Pravidlo obnovy (operační tvar R21), závazné:**
- `load()` načte soubor. Má-li `aktualni.state === "bezi"` **a** `aktualni.processStartedAt`
  se **liší** od `deps.processStartedAt` ⇒ přepne na `ceka-na-potvrzeni` a uloží.
- **Shodují-li se, stav zůstane `bezi`.** To pokrývá pád rendereru (proces žije, stejná hodnota)
  i opakované zavolání `load()` — ani jedno nesmí živý časovač shodit do `ceka-na-potvrzeni`.
- Neexistující soubor ⇒ prázdný stav (`aktualni: null`, `uzavrene: []`).
- 🔴 **Jakákoli JINÁ chyba čtení než `ENOENT` se HÁZÍ**, nikdy nepřevádí na prázdný stav.
  Vzor je `electron/queue.cjs:29-32` (`if (error.code === "ENOENT") return emptyQueue(); throw error;`)
  — a je to jediné bezpečné chování: „nečitelný soubor = žádné hodiny" tiše smaže den práce.

**Serializace zápisů:** všechny čtyři zapisující metody jedou **jedním promise řetězcem**
(interní `queue = queue.then(...)`). Dva souběžné `invoke` z panelu jinak přečtou týž stav,
oba ho přepíšou a jeden úsek zmizí. Měří to `T13`.

**Tvar odpovědi u všech zapisujících metod** (vzor: `src/lib/queue.js:195-254`):
```js
{ outcome: "started"|"switched"|"stopped"|"resolved"|"disabled"|"noop", entry, closed, reason }
```
- `outcome: "disabled"` + `reason: TIME_DISABLED_REASON` — když `timeEnabled !== "true"`.
  Platí pro `start`, `switchProject`, `stop` i `resolveRecovered`, **ne pro `load`/`getState`**.
- **Chyba vstupu se hází jako `TypeError`**, nevrací se jako outcome (vzor `src/lib/queue.js:19-39`,
  `src/lib/manifest.js:9-23`; české mluvící hlášky).

**Validace vstupů, které přicházejí z rendereru** (renderer je podle Spine nedůvěryhodný zdroj):
- `projectId` — musí projít kontrolou GUID (viz O-B5-2). Prázdný řetězec, `null`, název ⇒ `TypeError`.
- `decision` — právě jedna ze tří hodnot, jinak `TypeError`.
- `endedAt` — **povinný pro `ukoncit`**, musí být platná ISO značka, **≥ `startedAt`** a
  **≤ `now()`**. Jinak `TypeError`. 🔴 Bez téhle kontroly si renderer nadiktuje libovolný počet
  fakturovaných minut, což je přesně ta chyba, proti které R21 stojí.
- `minutes` **nikdy záporné**; `endedAt < startedAt` po ořezu ⇒ `TypeError`, ne tichá nula.

### 10.2 Persistovaný stav — schéma v1

Cesta: `path.join(app.getPath("userData"), "cas", "casovac.json")`
*(analogicky k `nahravky` na `main.cjs:479` ✅ ověřeno; adresář `mkdir(..., { recursive: true, mode: 0o700 })` jako `queue.cjs:39`)*

```json
{
  "schemaVersion": 1,
  "aktualni": {
    "clientTimeEntryId": "3f7c1e2a-…",
    "projectId": "…GUID…",
    "startedAt":    "2026-09-01T06:55:00.000Z",
    "startedAtRaw": "2026-09-01T06:55:47.312Z",
    "processStartedAt": "2026-09-01T06:20:11.004Z",
    "note": null,
    "state": "bezi"
  },
  "uzavrene": [
    {
      "clientTimeEntryId": "…", "projectId": "…GUID…",
      "startedAt": "…", "endedAt": "…", "minutes": 316,
      "state": "uzavreno",
      "closedReason": "stop" | "switch" | "potvrzeno-po-obnove" | "zahozeno-clovekem"
    }
  ]
}
```

🔴 **Sazba, částka ani měna v souboru NEJSOU a nesmí přibýt** (R8, `plan.md` §1 bod 1).
🔴 **Časy jsou v UTC.** ⚠️ Návrh packetu to opíral o `decisions.md` S2 — **S2 mluví o datech,
která desktop POŠLE** (spec §1: „data, která odešle, musí být přes MCP čitelná — nesou vlastníka,
projekt jako GUID a časy v UTC"; totéž `KONTRAKT.md:117`). **B5 nic neposílá**, takže S2 se na
tenhle soubor přímo nevztahuje. UTC je přesto správná volba: je to jediný tvar, který přežije
změnu časové zóny a letní čas, a `main.cjs` už ho používá (`startedAt.toISOString()`, `:493`).
⚠️ **Pole „vlastník" schéma NEMÁ** a B5 ho nedoplňuje — kdo je vlastník na sdíleném zařízení,
řeší B10 a je to otevřené (`decisions.md` B1). Uveď to v PR.
🔴 **Uzavřené úseky se nemažou.** Není kam je poslat (S1: server neexistuje, fronta je B7),
takže jediné bezpečné místo je tenhle soubor. Zahození = ztracené hodiny.

### 10.3 IPC kanály (registrace v `main.cjs`)

Použij **výhradně** existující `handleValidated(channel, allowedKinds, handler)`
(`main.cjs:151-156` ✅ ověřeno) — volá `requireTrustedSender` (`:115`) a je to jediná ochrana
odesílatele, kterou repozitář má. **Nepiš vlastní `ipcMain.handle`.**

| Kanál | Typ | `allowedKinds` | Argumenty | Vrací |
|---|---|---|---|---|
| `tracking:start` | `invoke` | `["panel"]` | `{ projectId, note }` | výsledek `start()` |
| `tracking:switch-project` | `invoke` | `["panel"]` | `{ projectId }` | výsledek `switchProject()` |
| `tracking:stop` | `invoke` | `["panel"]` | — | výsledek `stop()` |
| `tracking:get-state` | `invoke` | `["panel", "settings"]` | — | `getState()` |
| `tracking:resolve-recovered` | `invoke` | `["panel"]` | `{ decision, endedAt }` | výsledek `resolveRecovered()` |

Blok registrací patří **za řádek 679** (konec bloku `recording:finish`, `:676-679`) a **před
`auth:begin` na `:681`** — ✅ ověřeno, `:680` je prázdný řádek.

**Hook na pád rendereru** (plan §2 ho jmenovitě přiděluje B5): v `createPanelWindow` přidej
**jednu novou** registraci hned za stávající listener (`:312-315`):
```js
panelContents.on("render-process-gone", () => handleRendererGone(getTrackingStore(), {}));
```
🔴 **`handleRendererGone` žije v `tracking.cjs` a smí dělat právě dvě věci:** přečíst
`store.getState()` a zalogovat, že časovač pádem rendereru neprošel. **Nesmí volat `stop`,
`switchProject`, `resolveRecovered` ani nic zapisovat** — to je R4/C1 na hranici pádu.
Měří to `T14` (chování) a `T15` (strukturálně). Bez těch testů je hook dekorace, kterou lze
smazat se všemi branami zelenými — přesně to měl návrh packetu.

### 10.4 `preload.cjs` — most

Doplnit do existujícího objektu (`preload.cjs:3-22` ✅ ověřeno), nic v něm nepřejmenovávat:
```js
  startTracking: (payload) => ipcRenderer.invoke("tracking:start", payload),
  switchTrackingProject: (payload) => ipcRenderer.invoke("tracking:switch-project", payload),
  stopTracking: () => ipcRenderer.invoke("tracking:stop"),
  getTrackingState: () => ipcRenderer.invoke("tracking:get-state"),
  resolveRecoveredTracking: (payload) => ipcRenderer.invoke("tracking:resolve-recovered", payload),
```

### 10.5 Vypínač

```js
timeEnabled: process.env.DESKTOP_TIME_ENABLED   // v main.cjs, v getTrackingStore()
```
**Nedosazovat default.** `undefined` musí projít až do `createTrackingStore` a tam znamenat vypnuto.
Doplň do `.env.example` (verzovaný schválně — ✅ ověřeno, `.gitignore:8-11` má výjimku `!.env.example`):
```
# R18/C2: druhý, nezávislý vypínač. Fail-closed — chybějící hodnota znamená vypnuto.
DESKTOP_TIME_ENABLED=false
```
⚠️ `.env.example` **není** v seznamu souborů B5 v `plan.md` §2b — je to **vědomá odchylka**,
zdůvodněná tím, že R18 žádá doložitelný vypínač a `.gitignore` k tomu ten soubor určuje.
**Napiš ji do PR** (MASTERPLAN §14: tichá odchylka je blocker).

---

## 11. Dependencies

| Směr | Story | Stav | Co z toho plyne |
|---|---|---|---|
| **B5 závisí na** | **B3** — přesun autority tray stavu do hlavního procesu (drží **Claude**) | musí být hotová a mergnutá dřív | B3 vlastní `deriveTrayState` a `updateTray`. B5 **jen volá**, co B3 nechá, a nepřepisuje jejich tělo |
| | *tranzitivně* **B1** — oprava `ui-smoke` | | Bez ní je `ui-smoke` na `main` **červený** (✅ ověřeno v `DAN-TODO.md` §3a), takže živé ověření nemá baseline |
| **B5 blokuje** | **B6** — výběr projektu z alokací přes adaptér | | B6 vlastní `TrackingCard.jsx` a `src/lib/adapters/**`. **Nesahej tam** |
| | **B7** — rozlišovač typu položky ve frontě | | B7 vlastní `electron/queue.cjs`. **Nesahej tam** |
| **Mimo dosah** | **B12** ⛔ **STOPKA** | | Danova migrace v LuTracku, v tomhle repu to není PR. `plan.md` §4 ji jmenovitě zakazuje |

🔴 **`deriveTrayState` v `electron/main.cjs` DNES NEEXISTUJE** — ✅ ověřeno grepem, v souboru jsou
jen `trayIconName` (`:220`), `trayImage` (`:248`) a `updateTray` (`:255`). Vytvoří ji B3.
**Až B3 doběhne a `deriveTrayState` nebude mít tvar, do kterého se dá vložit stav času, ZASTAV
a vrať otázku.** Nepřepisuj ho — je to B3-ho blok a architektonické rozhodnutí, které už padlo.

⚠️ **`plan.md` §2b přiděluje `electron/tracking.cjs` také story B10** („návrh napřed, pak
`auth.cjs`, `tracking.cjs"). B10 přitom v tabulce vlastnictví bloků (§2) **žádný řádek nemá**.
Vlastnictví uvnitř `tracking.cjs` po B5 je tedy neurčené → otevřená otázka **O-B5-5**. Pro tenhle
PR to nic nemění (B10 běží až po B8), ale **napiš to do PR**, ať to nespadne na B10.

---

## 12. Přesné soubory — a u sdílených souborů VÝČET BLOKŮ

### 12.1 Proč výčet, a ne věta

Doslova z `plan.md` §2:
> „**Devět z dvanácti stories sahá do `electron/main.cjs`, osm do `electron/preload.cjs`.** […]
> Řešení není serializovat celý zbytek — je to **vlastnictví bloku uvnitř souboru**. […] při běhu
> 25. 8. psaly tři etapy souběžně do `electron/main.cjs` ze tří worktrees a **všechny čtyři merge
> proběhly bez jediného konfliktu**, protože každá měla vlastnictví zadané jako **výčet bloků**."
>
> 🔴 „Task packet musí vlastnictví zadat **VÝČTEM**, ne větou ‚nesahej na cizí'."

### 12.2 Tabulka vlastnictví — opsaná doslova z `plan.md` §2

| Story | Vlastní v `main.cjs` | Vlastní v `preload.cjs` |
|---|---|---|
| **B3** | `trayIconName`, `updateTray`, `deriveTrayState`, registrace tray | odebrat `setTrayState` |
| **B4** | `shouldHidePanelOnBlur` a jeho čítače | nic |
| **B5** | **registrace `tracking:*` kanálů, hook na pád rendereru** | **přidat `tracking:*`** |
| **B7** | zapojení fronty, `queue:*` kanály | přidat `queue:*` |
| **B8** | `auth:begin` a jeho okolí | `beginAuth` |
| **B9** | `auth:logout` | přidat `logout` |
| **B11** | nic | nic |

### 12.3 Filtr, který si pusť u KAŽDÉ editace

Všechna čísla řádků ✅ ověřena otevřením `electron/main.cjs` (752 řádků).

| Soubor | Co smíš | Co v něm NESMÍŠ |
|---|---|---|
| `electron/tracking.cjs` **(nový)** | celý — je tvůj | `require("electron")` · volat server · sazby a částky |
| `electron/main.cjs` | **(a)** `require("./tracking.cjs")` k importům (`:15-19`) · **(b)** memoizovaná tovární `getTrackingStore()` v modulovém rozsahu · **(c)** blok `handleValidated("tracking:*", …)` **za `:679`, před `:681`** · **(d)** **jedna nová** registrace `panelContents.on("render-process-gone", …)` hned za `:315` | přepsat `trayIconName` (`:220`), `trayImage` (`:248`), `updateTray` (`:255`), **registraci tray (`:727-730`)** — **B3** · `shouldHidePanelOnBlur` (`:241`) — **B4** · `auth:begin` (`:681`) — **B8** · **tělo stávajících listenerů `:312-323`** (nahrávání) · cokoli v `openRecordingTrack`…`finalizeRecordingSessionsForOwner` (`:432-660`) |
| `electron/preload.cjs` | přidat **pět** klíčů `tracking:*` do objektu (`:3-22`) | odebrat `setTrayState` (`:18`) — **B3** · `queue:*` — **B7** · `logout` — **B9** · přejmenovat cokoli stávajícího |
| `tests/tracking-timer.test.js` **(nový)** | celý — je tvůj | — |
| `.env.example` | přidat řádek `DESKTOP_TIME_ENABLED=false` s komentářem | měnit řádek `DESKTOP_UPLOAD_ENABLED` (`:2`) |
| `scripts/akceptace/B5-sabotaze.sh` **(nový)** | celý (vzor: `scripts/akceptace/E2-sabotaze.sh`) | měnit `E2-sabotaze.sh` |

🔴 **Oprava proti návrhu packetu:** registrace tray je na **`:727-730`**
(`tray = new Tray(trayImage(trayState))` je `:727`, `updateTray(trayState)` je `:730`).
Návrh psal `:728-731` — `:731` je `createPanelWindow()`, což tray není, a `:727` by filtru
propadlo. U filtru, který se má pouštět „při každé editaci", je posun o řádek celá jeho hodnota.

**Soubory, kterých se v tomhle PR NEDOTKNEŠ — ani „když to tam logicky patří":**

`src/features/tracking/TrackingCard.jsx` (**B6**) · `src/hooks/useElapsedTime.js` (**B6**;
`formatElapsed` na `:23-27` vrací `HH:MM:SS` a **porušuje R9** — ✅ ověřeno, je to skutečná vada,
ale **cizí**) · `src/App.jsx` (**B3**; `useMemo` na `:20-25`) · `electron/queue.cjs` a
`src/lib/queue.js` (**B7**) · `electron/auth.cjs` (**B4/B8/B9**) · `scripts/ui-smoke.mjs` (**B1**) ·
`design/**` (`plan.md` §4 a `AGENTS.md`: cizí práce) · `jsconfig.json` (viz §15) ·
`docs/changes/desktop-v1/*` (zmrazeno; odchylku hlásíš, nezapisuješ sám).

### 12.4 Kód, ze kterého vycházíš (přečti si ho, než začneš psát)

| Kde | Co si z toho vezmi |
|---|---|
| `electron/queue.cjs:36-67` `saveQueueAtomically` | ✅ **Ověřený vzor atomického zápisu v tomhle repu**: `mkdir(…, {recursive:true, mode:0o700})` → `open(tmp, "wx", 0o600)` → `writeFile` → `handle.sync()` → `close` → `rename` → **`fsync` adresáře** → v `catch` `close` + `unlink` tempu. Napiš totéž uvnitř `tracking.cjs` — **`queue.cjs` needituj** |
| `electron/queue.cjs:25-33` `loadQueue` | Vzor čtení: **jen `ENOENT` znamená prázdno, všechno ostatní se hází** |
| `electron/main.cjs:497` | Komentář, který je pro B5 doslova zadáním: *„Recovery kopie musí existovat dřív, než session ID dostane renderer a může poslat první chunk."* Tvoje obdoba: **stav musí být na disku dřív, než `start()` vrátí `clientTimeEntryId`** |
| `src/lib/queue.js:195-204` | Vzor fail-closed vypínače: povinný argument, `if (uploadEnabled !== "true") return { outcome: "disabled", … }` |
| `src/lib/manifest.js:9-23` | Vzor validace vstupů: `requireNonEmptyString`, `requireTimestampOrNull`, mluvící české chyby |
| `tests/queue.test.js:5, 18-23` | Import `.cjs` do vitestu; uložení a obnova `process.env` v `afterEach` |
| `tests/tray-authority.test.js:4-22` | Vzor strukturálního testu (`functionSource` + `Function()`). ⚠️ `functionSource` hledá doslova `function <jméno>(` — **deklaruj `writeStateAtomically` a `handleRendererGone` jako `async function …(`**, ne jako arrow konstantu, jinak testy zčervenají ze špatného důvodu |
| `scripts/akceptace/E2-sabotaze.sh` | Vzor sabotážního harnessu — včetně **kontroly, že mutace trefila cíl** (`:74-77`, `:94-97`) |

---

## 13. TDD kroky

Pořadí je závazné (`MASTERPLAN` §13): **napiš test → spusť → ověř SPRÁVNÝ důvod červené →
minimální implementace → zelená → širší brány.**

Testový soubor: **`tests/tracking-timer.test.js`**. Jeden test:
```
npm run test:unit -- tracking-timer
```
⚠️ Exit kód měř **před rourou**; na macOS nepoužívej `timeout` (`AGENTS.md`).

🔴 **Výpisy níž jsou OČEKÁVANÝ TVAR, ne naměřený text.** Autor packetu nespustil ani jeden test.
**Do PR patří tvůj skutečný výpis**, ne tenhle.

### Krok 0 — první červená: modul neexistuje
`import trackingStore from "../electron/tracking.cjs";` → očekávané:
`Error: Failed to load url ../electron/tracking.cjs`.
**Tohle je jediná červená, kterou smíš odbýt „soubor ještě není".**

### Krok 1 — `T1` 🔴 · R10: klíč vzniká při STARTU a je na disku dřív, než ho dostane volající
```js
const result = await store.start({ projectId: GUID });
const naDisku = JSON.parse(await readFile(filePath, "utf8"));
expect(result.entry.clientTimeEntryId, "R10: start() musí klíč vyrobit, ne vrátit undefined")
  .toMatch(/^[0-9a-f-]{36}$/);
expect(naDisku.aktualni?.clientTimeEntryId, "R10: klíč musí být na disku dřív, než ho start() vrátí")
  .toBe(result.entry.clientTimeEntryId);
```
🔴 **První assertion je nová a je nutná.** Bez ní projde sabotáž S1 zeleně: když se `newId()`
přesune do `stop()`, je klíč `undefined` **na disku i v návratové hodnotě**, `JSON.stringify`
klíč s `undefined` zahodí, a `expect(undefined).toBe(undefined)` **PROJDE**. Návrh packetu měl
jen druhou assertion a jeho vlastní sabotáž S1 by ji nezbarvila.

### Krok 2 — `T2` · R9: ořez na celé minuty, oběma směry dolů
```js
// (a) případ ze schváleného návrhu: 08:55:47 → 08:55, 14:11:59 → 14:11, 316 min = 5h 16m
expect(zaznam.startedAt).toBe("2026-09-01T08:55:00.000Z");
expect(zaznam.endedAt).toBe("2026-09-01T14:11:00.000Z");
expect(zaznam.minutes, "R9: 08:55 → 14:11 je 5h 16m").toBe(316);
// (b) případ, kde se OŘEZANÝ a SUROVÝ výpočet ROZCHÁZEJÍ:
//     start 08:55:59 → 08:55 ; stop 09:56:01 → 09:56 ⇒ 61 minut
//     surový rozdíl je 3602 s = 60,03 min ⇒ 60. Musí vyjít 61.
expect(zaznam2.minutes, "R9: minuty se počítají z OŘEZANÝCH konců, ne z rozdílu surových časů")
  .toBe(61);
```
🔴 **Případ (b) je nový a je nutný.** V případu (a) vyjde 316 minut **i při chybném výpočtu ze
surových časů**, takže sám o sobě nic neměří.

### Krok 3 — `T3` 🔴 · R21/`DSK-F013`: restart procesu končí dotazem
*(návrh packetu tenhle krok označoval „R13/F013" — **R13 je o odvolání tokenu při odhlášení**
a s časem nemá nic společného. Správně R21 a `DSK-F013`.)*

Pád **celého procesu** se v testu modeluje jediným poctivým způsobem: zahodíš instanci a
postavíš novou nad týmž souborem **s JINÝM `processStartedAt`**.
```js
const prvni = createTrackingStore({ filePath, timeEnabled: "true", processStartedAt: P1, now: () => T0 });
await prvni.start({ projectId: GUID });                    // proces „spadne" – žádný stop
const druhy = createTrackingStore({ filePath, timeEnabled: "true", processStartedAt: P2 });
const stav = await druhy.load();
expect(stav.aktualni.clientTimeEntryId).toBe(puvodniId);   // R10 – klíč je TÝŽ
expect(stav.aktualni.startedAt).toBe(puvodniStart);        // minuta se nehnula
expect(stav.aktualni.state,
  "R21: po restartu se ani nepokračuje, ani nezahazuje — ptá se").toBe("ceka-na-potvrzeni");
```

### Krok 3b — `T3b` 🔴 · spec §8 `DSK-F011`: pád rendereru časovač NEZASTAVÍ
```js
const stav = await store.load();   // TÝŽ processStartedAt jako při start()
expect(stav.aktualni.state,
  "spec §8 DSK-F011: renderer spadl, proces žije — časovač BĚŽÍ DÁL").toBe("bezi");
```
🔴 **Nový test.** Spec §8 doslova: *„When zabiju renderer · Then panel se otevře s **běžícím**
časovačem a správným časem."* Implementace, která by na `load()` shodila do
`ceka-na-potvrzeni` cokoli nalezeného na disku, projde T3 a **poruší spec §8**. T3 a T3b se drží
navzájem: samotný T3 svádí k příliš hrubému pravidlu.

### Krok 4 — `T4` · R21: obnovený záznam nemá žádný default
```js
expect(stav.uzavrene, "R21/M21: nesmí se tiše započítat").toHaveLength(0);
await expect(druhy.resolveRecovered({}))
  .rejects.toThrow("decision musí být pokracovat, ukoncit nebo zahodit");
```

### Krok 4b — `T4b` 🔴 money · `resolveRecovered` nesmí přerazit klíč ani ztratit úsek
```js
// pokracovat: TÝŽ klíč, TÝŽ startedAt, stav zpět na "bezi"
const r1 = await s.resolveRecovered({ decision: "pokracovat" });
expect(r1.entry.clientTimeEntryId, "R10/R22: obnova NESMÍ vyrobit nový klíč").toBe(puvodniId);
expect(r1.entry.startedAt).toBe(puvodniStart);
expect(r1.entry.state).toBe("bezi");

// ukoncit: úsek JE NA DISKU, s minutami
const r2 = await s2.resolveRecovered({ decision: "ukoncit", endedAt: KONEC });
const d = JSON.parse(await readFile(filePath, "utf8"));
expect(d.uzavrene, "ukončený úsek musí být na disku, ne jen v návratové hodnotě").toHaveLength(1);
expect(d.uzavrene[0].closedReason).toBe("potvrzeno-po-obnove");
expect(d.aktualni).toBeNull();

// endedAt z rendereru je nedůvěryhodný vstup
await expect(s3.resolveRecovered({ decision: "ukoncit", endedAt: PRED_STARTEM }))
  .rejects.toThrow("endedAt nesmí být dřív než startedAt");
await expect(s3.resolveRecovered({ decision: "ukoncit", endedAt: BUDOUCNOST }))
  .rejects.toThrow("endedAt nesmí být v budoucnosti");
```
🔴 **Celý tento krok je nový.** Návrh packetu neměřil ani jednu z těchto cest. Implementace,
která při „pokracovat" vyrobí nový `clientTimeEntryId`, projde všechny testy návrhu a vyrobí
přesně ten duplikát, proti kterému R10 a R22 stojí.

### Krok 5 — `T5` 🔴 · R11: přepnutí nezastaví čas, nevyrobí díru ani překryv — a uloží se
```js
const r = await store.switchProject({ projectId: GUID_B });
expect(r.closed.endedAt, "úseky na sebe musí navazovat na tutéž minutu").toBe(r.entry.startedAt);
expect(r.entry.clientTimeEntryId, "R10: nový úsek = nový klíč").not.toBe(r.closed.clientTimeEntryId);
expect(store.getState().aktualni.state).toBe("bezi");      // R11 – neustal
const d = JSON.parse(await readFile(filePath, "utf8"));
expect(d.uzavrene, "uzavřený úsek musí být NA DISKU").toHaveLength(1);
expect(d.uzavrene[0].projectId, "uzavřel se STARÝ projekt").toBe(GUID_A);
expect(d.aktualni.projectId).toBe(GUID_B);
```
🔴 **Poslední čtyři assertiony jsou nové.** Návrh kontroloval jen návratovou hodnotu — přepnutí,
které uzavřený úsek nikam nezapíše, mu projde zeleně a ztratí odpracované minuty.

### Krok 5b — `T5b` 🔴 · `stop()` uloží uzavřený úsek na disk
```js
await store.stop();
const d = JSON.parse(await readFile(filePath, "utf8"));
expect(d.uzavrene, "R10: zastavený úsek musí přežít pád procesu").toHaveLength(1);
expect(d.uzavrene[0].closedReason).toBe("stop");
expect(d.aktualni).toBeNull();
```
🔴 **Nový test.** V návrhu packetu **neexistoval jediný test, který by četl disk po `stop()`.**
Implementace, která uzavřený úsek jen vrátí a nezapíše, projde všech deset testů návrhu.

### Krok 6 — `T6` · R18: `DESKTOP_TIME_ENABLED` je fail-closed a má **vlastní** test
Tři případy: `undefined` · `"false"` · `"1"` (i `"1"` je vypnuto — povoluje se jen `"true"`).
```js
expect(await store.start({ projectId: GUID }))
  .toMatchObject({ outcome: "disabled", reason: TIME_DISABLED_REASON });
expect(existsSync(filePath), "vypnutá agenda nesmí založit ani soubor").toBe(false);
```
**A totéž pro zbylé tři zapisující metody** (`switchProject`, `stop`, `resolveRecovered`) —
jinak stačí vypínač zkontrolovat jen v `start()` a zbytek zapisuje dál.

### Krok 7 — `T7` · R6: `projectId` je GUID, nikdy název
```js
await expect(store.start({ projectId: "LuDone Desktop" }))
  .rejects.toThrow("projectId musí být GUID projektu, ne název");
await expect(store.start({ projectId: "" })).rejects.toThrow();
await expect(store.start({})).rejects.toThrow();
```
*(Řetězec `"LuDone Desktop"` je ✅ doslova dnešní atrapa z `TrackingCard.jsx:5`.)*
⚠️ Přesná podoba kontroly závisí na odpovědi na **O-B5-2**. Do vyřešení použij regulární výraz
`/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/`
(RFC 4122 bez kontroly verze) a **v PR to označ jako předpoklad k potvrzení**.

### Krok 8 — `T8` · obnova funguje i s vypnutým vypínačem
Vypínač smí zakázat **měřit**, nikdy **číst a vrátit rozdělaný záznam**.
```js
const po = createTrackingStore({ filePath, timeEnabled: undefined, processStartedAt: P2 });
expect((await po.load()).aktualni.clientTimeEntryId).toBe(puvodniId);
```

### Krok 9 — `T9` · atomický zápis: po úspěchu nezůstane temp, adresář má 0o700
```js
const casDir = path.join(tmpRoot, "cas");     // adresář, který založil KÓD, ne mkdtemp
expect((await readdir(casDir)).filter((n) => n.endsWith(".tmp"))).toHaveLength(0);
expect((await stat(casDir)).mode & 0o777).toBe(0o700);
```
🔴 **`filePath` musí ležet v podadresáři, který zakládá kód.** Návrh statoval adresář z
`mkdtemp`, který má `0700` sám od sebe — assertion by prošla, i kdyby kód žádný `mode` nepředal.

### Krok 10 — `T10` (**strukturální, přiznaně slabý**) · tvar atomického zápisu
`fsync` se z běžného testu pozorovat nedá. Proto navíc test ve stylu `tests/tray-authority.test.js`:
zdroj `writeStateAtomically` **musí obsahovat** `open(`, `"wx"`, `.sync()`, `rename(` — a `rename`
musí stát **za** `.sync()`.
🔴 **Do PR napiš, že tenhle test měří tvar kódu, ne chování**, a že odpověď dává až `J6`.

### Krok 11 — `T11` 🔴 · selhání uprostřed zápisu nesmí rozbít předchozí stav
```js
// fs, jehož writeFile hodí po prvním úspěšném uložení
const store = createTrackingStore({ filePath, timeEnabled: "true", fs: selhavajiciFs });
await expect(store.stop()).rejects.toThrow();
const d = JSON.parse(await readFile(filePath, "utf8"));   // NESMÍ hodit SyntaxError
expect(d.aktualni.clientTimeEntryId, "předchozí stav musí zůstat celý").toBe(puvodniId);
expect((await readdir(casDir)).filter((n) => n.endsWith(".tmp")),
  "po selhání se temp uklidí").toHaveLength(0);
```
🔴 **Nový test.** Sabotáž S5 se v návrhu odvolávala na „test s injektovaným `fs`" — takový test
§13 návrhu **vůbec nedefinovala**. Bez něj je hlavním chytačem S5 jen strukturální `T10`.

### Krok 12 — `T12` 🐤 · kanárek se opravdu loguje
```js
const radky = [];
const store = createTrackingStore({ filePath, timeEnabled: "true", log: (m) => radky.push(m) });
await store.start({ projectId: GUID });
expect(radky.some((r) => r.startsWith(TRACKING_SAVED_LOG_PREFIX)),
  "bez tohohle řádku je celý živý scénář J3 nepoužitelný").toBe(true);
```
🔴 **Nový test.** Kanárek, který sám nemá bránu, se dá smazat se všemi branami zelenými a `J3`
pak navždy hlásí ⛔ NEMĚŘENO. Spec §11 to říká přímo: „Grep, který nenajde ani kanárka, je
rozbitý grep."

### Krok 13 — `T13` 🔴 · dva souběžné zápisy neztratí úsek
```js
await Promise.all([store.start({ projectId: GUID_A }), store.start({ projectId: GUID_B })]);
// druhý start nad běžícím časovačem = definované chování (viz níž), nikdy tichá ztráta
const d = JSON.parse(await readFile(filePath, "utf8"));
expect(d.uzavrene.length + (d.aktualni ? 1 : 0),
  "žádný úsek se souběhem neztratí").toBeGreaterThanOrEqual(1);
```
⚠️ **Co má dělat `start()` nad už běžícím časovačem, žádný zmrazený dokument neříká** →
otevřená otázka **O-B5-4**. Do vyřešení: **`{ outcome: "noop" }` a stav se nemění** (jediná
varianta, která nemůže ztratit ani zdvojit minuty). **Označ to v PR jako rozhodnutí k potvrzení.**

### Krok 14 — `T14` a `T15` 🔴 · R4/C1 na hranici pádu rendereru
```js
// T14 – chování: hook se stavu ANI NEDOTKNE
const pred = JSON.parse(await readFile(filePath, "utf8"));
handleRendererGone(store, { log: () => {} });
expect(JSON.parse(await readFile(filePath, "utf8")), "R4/C1: pád rendereru nesmí sáhnout na čas")
  .toEqual(pred);
expect(store.getState().aktualni.state).toBe("bezi");

// T15 – strukturálně: tělo hooku nesmí volat mutující metody
const zdroj = functionSource(trackingSource, "handleRendererGone");
for (const zakazane of ["stop(", "switchProject(", "resolveRecovered(", "writeStateAtomically("]) {
  expect(zdroj, `R4/C1: hook nesmí volat ${zakazane}`).not.toContain(zakazane);
}
```
🔴 **Nové testy.** Návrh packetu žádal hook v `main.cjs`, ale **neurčil, co má dělat, a neměřil
ho ničím**. Smazat ho by nechalo všechny brány zelené.

### Krok 15 — kontrolní ZELENÉ případy (DoD §3 bod 4, poměr 2–3 : 1)
Musí zůstat zelené **pod každou sabotáží ze §14**, jinak sabotáž trefila jinam, než měla:
- **`Z1`** — `start` s platným GUID a `timeEnabled: "true"` vrátí `outcome: "started"` a soubor vznikne.
- **`Z2`** — `stop` bez běžícího časovače vrátí `outcome: "noop"`, **nehodí výjimku** a soubor nechá být.
- **`Z3`** — `load()` nad neexistujícím souborem vrátí `{ aktualni: null, uzavrene: [] }` a **nic nezaloží**.
- **`Z4`** — `npm run test:unit -- queue` (cizí brána) zůstane zelená — důkaz, že jsi nesáhl do fronty.
- **`Z5`** — celý `npm run test:unit` hlásí **≥ 77 + tvoje testy**; žádný ubylý.

---

## 14. Sabotážní testy

Napiš `scripts/akceptace/B5-sabotaze.sh` podle vzoru `scripts/akceptace/E2-sabotaze.sh`:
`over_cisty_cil` před každou mutací · `zelena_brana` před · `cervena_brana` pod mutací ·
obnova **výhradně** `git checkout HEAD -- <soubor>` · `zelena_brana` po obnově.

🔴 **KAŽDÁ mutace musí vložit grepovatelný marker a skript musí ověřit, že marker po mutaci
v souboru JE** — přesně jako `E2-sabotaze.sh:74-77` a `:94-97` (`if grep -c … -le 0 → STOP
sabotáž minula cíl`). Bez toho se sed, který mine cíl, tváří jako „brána nezčervenala".
`DAN-TODO.md` (nález 1. 9. 22:07) ukazuje, že tenhle repozitář si tuhle past už jednou vyrobil:
sabotážní markery se zapisují do produkčního kódu a grepuje se na ně — přejmenování jen na jedné
straně by znamenalo, že **sabotáž tiše přestane měřit**.

**Do PR patří doslovný výpis, ne parafráze** (`plan.md` §2b).

| # | Co v produkčním kódu rozbiju | Kdo to má chytit |
|---|---|---|
| **S1** 🔴 money | `newId()` v `start()` přesunu do `stop()` (klíč vzniká až při ukončení) | `T1` (**první assertion**), `T3` |
| **S2** 🔴 money | `Math.floor` → `Math.round` ve `floorToMinute` | `T2` (varianta a i b) |
| **S3** 🔴 money | V obnově nastavím `state = "bezi"` místo `"ceka-na-potvrzeni"` | `T3`, `T4` |
| **S4** | `if (timeEnabled !== "true")` → `if (timeEnabled === "false")` (fail-open) | `T6` |
| **S5** | Atomický zápis nahradím `fs.promises.writeFile(filePath, JSON.stringify(stav))` | `T11` (**chování**) a `T10` (tvar) |
| **S6** | V `switchProject` posunu `startedAt` nového úseku o `+1` minutu | `T5` |
| **S7** 🔴 money | Ze `stop()` odstraním zápis uzavřeného úseku (vrátí ho, neuloží) | `T5b` |
| **S8** 🔴 money | V `resolveRecovered("pokracovat")` vyrobím nový `clientTimeEntryId` | `T4b` |
| **S9** 🔴 money | V `load()` rozšířím `catch` tak, aby na **každou** chybu vrátil prázdný stav | `T11` (rozbitý soubor pak tiše zmizí) |
| **S10** 🐤 | Odstraním logovací řádek `[tracking] Uloženo:` | `T12` |
| **S11** | Smažu registraci hooku na pád rendereru z `main.cjs` a `handleRendererGone` z `tracking.cjs` | `T14`, `T15` |
| **S12** | V hooku na pád rendereru zavolám `store.stop()` (porušení R4/C1) | `T14`, `T15` |

🔴 **Sabotáž, kterou brána nechytí, je důkaz, že brána neměří.** Když některá zůstane zelená,
**oprav bránu, ne sabotáž** — a nikdy neoslabuj assertion, abys to „srovnal".

⚠️ **Před spuštěním harnessu musí být `git status` čistý.** `over_cisty_cil` kontroluje jen
jmenovaný soubor; přidej na začátek skriptu kontrolu celého stromu.

---

## 15. Projektové brány

| Brána | Příkaz | Musí | Poznámka |
|---|---|---|---|
| Lint | `npm run lint` | `EXIT=0` | `eslint.config.js:29-36` má pro `electron/**/*.cjs` blok se `sourceType: "commonjs"` a node globals — ✅ ověřeno, nový soubor tam spadne sám |
| Typecheck | `npm run typecheck` | `EXIT=0` | 🔴 **viz opravu níž** |
| Unit testy | `npm run test:unit` | `EXIT=0`, **žádný `.skip`, `.only`, `.todo`** | baseline 77 testů |
| Vše najednou | `npm run gates` | `EXIT=0` | = `lint && typecheck && test:unit` |
| Build | `npm run build` | `EXIT=0` | ✅ CI (`.github/workflows`) pouští `gates`, pak `build` |
| Sabotáže | `bash scripts/akceptace/B5-sabotaze.sh` | všech **dvanáct** hlásí `PASS` | doslovný výpis do PR |
| `ui-smoke` | `node scripts/ui-smoke.mjs` | **NESPOUŠTĚJ v sandboxu** | `plan.md` §4 to jmenovitě zakazuje; v CI je `if: ${{ false }}`. Pouští ho člověk na Macu |

### 🔴 Oprava proti návrhu packetu — typecheck `electron/tracking.cjs` VIDÍ

Návrh tvrdil: *„`jsconfig.json:16-17` má `exclude: [\"electron/**\"]`. Typecheck tedy
`electron/tracking.cjs` NEVIDÍ. Zelený typecheck není tvrzení o tvém modulu — napiš to do PR."*
**To je nepravda a měřením se vyvrací:**

- `npx tsc --noEmit -p jsconfig.json --listFiles` ✅ vypisuje **`electron/queue.cjs`
  i `electron/auth.cjs`** — obojí je v `exclude`, obojí se do programu dostane importem
  z testu, který v `include` je.
- Kontrolní pokus v odděleném adresáři (stejný `jsconfig`, `exclude: ["electron/**"]`, test
  importující `.cjs` se záměrnou typovou chybou) ✅ vrátil
  `electron/broken.cjs(3,15): error TS2345 … EXIT=1`.

`exclude` vyřazuje soubory jen z **počátečního výběru**; co si program natáhne importem, se
kontroluje. Jakmile `tests/tracking-timer.test.js` naimportuje `electron/tracking.cjs`,
**typová chyba v něm shodí `npm run typecheck` na EXIT=1**.

⇒ **Do PR napiš pravdu: typecheck tvůj modul pokrývá**, protože ho test importuje.
⇒ **`jsconfig.json` přesto NEROZŠIŘUJ**: pustilo by to kontrolu na starý Electron a skripty,
které jí nikdy neprošly.

**Exit kód měř před případnou rourou. Na macOS nepoužívej `timeout`** (`AGENTS.md`).

🔴 **Zákaz změkčení měřidla** (`MASTERPLAN` §13, doslova ✅ ověřeno): „oprav vadu; **neoslabuj
assertion; nemaž test; nepřidávej baseline; nepoužívej force; nevypínej workflow; nepoužívej
skip CI** jako cestu kolem skutečné brány. Po **třetím** neúspěšném opravném kole zastav a vrať
přesný blocker a důkazy."

---

## 16. Live-verification scénář

**Dělá to člověk u Macu** (macOS 26.4, Electron 37.3.1). Codex tenhle scénář **nespouští** —
připraví ho a odevzdá jako přesný postup. ⛔ **Celá tato sekce je návrh postupu, ne provedené
měření.**

🔴 **PRAVIDLO KANÁRKA** (spec §11, ✅ ověřeno doslova): *„Brána, která hledá v logu a nic nenajde,
dnes hlásí zelenou. Napříště musí najít **aspoň jeden očekávaný záznam**; když tam není, výsledek
je ⛔ NEMĚŘENO, ne ✅. **Grep, který nenajde ani kanárka, je rozbitý grep.**"*
Kanárek pro B5 je **`[tracking] Uloženo:`** (obdoba `[recording] Uloženo:` na `main.cjs:643`).

### Příprava
- **J0** `ps aux | grep "[l]udone-desktop.*Electron"` **musí být prázdné.**
  🔴 `main.cjs:197-200` volá `requestSingleInstanceLock()` a druhá instance skončí **exit 0 bez
  hlášky** — osiřelá appka tiše zabije celé měření (✅ `DAN-TODO.md` §3a, bod 2).
- **J1** `DATA=$(mktemp -d /tmp/ludone-b5.XXXXXX)`; `npm run package:mac`; spustit:
  ```
  env LUDONE_E2E=0 DESKTOP_TIME_ENABLED=true LUDONE_DATA_DIR="$DATA" \
    "release/LuDone Desktop.app/Contents/MacOS/Electron" \
    --remote-debugging-port=9333 > "$DATA/application.log" 2>&1 &
  ```
  ✅ `main.cjs:170-192` mapuje `LUDONE_DATA_DIR` na `userData = <root>/user-data` — cesta v J4 sedí.

### Měření
- **J2 — start.** Přes CDP v kontextu panelu:
  `await window.ludone.startTracking({ projectId: "<GUID>", note: "B5 zkouška" })`
  Očekávané: `{ outcome: "started", entry: { clientTimeEntryId: "…", startedAt: "…:00.000Z" } }`.
  🔴 **`startedAt` musí končit `:00.000Z`.** Vteřiny = vada v R9.
  ✅ Že je `window.ludone.*` přes CDP dosažitelné a projde `requireTrustedSender`, dokládá
  `scripts/ui-smoke.mjs:182` (`client.evaluate("window.ludone.getTrayState()")`).
  ⚠️ **Kde vzít `<GUID>`, B5 neřeší** — alokace jsou B6. Použij libovolný platný GUID; B5 ověřuje
  **tvar**, ne existenci projektu (viz O-B5-2).
- **J3 — 🐤 kanárek v logu.** `grep -c '^\[tracking\] Uloženo:' "$DATA/application.log"`
  **≥ 1 ⇒ pokračuj. `0` ⇒ ⛔ NEMĚŘENO** — logovací cesta neběžela a nic dalšího nic nedokazuje.
- **J4 — 🐤 kanárek na disku.** `cat "$DATA/user-data/cas/casovac.json"`
  Soubor musí existovat a nést týž `clientTimeEntryId` jako J2. Když není ⇒ **⛔ NEMĚŘENO**.
- **J5 — pád rendereru (`DSK-F011` + `DSK-F013`, jádro story).**
  ```
  pgrep -fl "Renderer"      # ⚠️ přesný název helperu NEOVĚŘEN, ověř si ho a zapiš skutečný
  kill -9 <PID rendereru>
  ```
  Pak: **(a)** hlavní proces žije dál; **(b)** po znovuotevření panelu vrátí
  `await window.ludone.getTrackingState()` **týž `clientTimeEntryId`, týž `startedAt`
  a `state: "bezi"`** (spec §8 `DSK-F011`); **(c)** `casovac.json` je bajt po bajtu stejný
  jako v J4 (`shasum` před a po).
  🔴 **Krok „ikona v liště dál hlásí běžící čas" z návrhu packetu ODSTRANĚN.** Autoritu tray
  drží dnes renderer (`App.jsx:20-25`, moment M19) a její přesun je **B3**, ne B5. Časovač
  spuštěný přes DevTools se navíc do tray nikdy nedostane, protože `TrackingCard.jsx` se v tomhle
  PR nemění. Ten bod by na správné implementaci **spolehlivě selhal** a tlačil by tě do cizího
  bloku. Do B5 nepatří; ověří ho B3.
- **J6 — pád celého procesu uprostřed zápisu (atomicita).**
  Spustit `switchTrackingProject` a během něj `kill -9` hlavního procesu (5× nad kopií dat).
  Po každém pokusu `python3 -c "import json,sys;json.load(open(sys.argv[1]))" "$DATA/user-data/cas/casovac.json"`
  **musí projít.** 🔴 **Jediný neparsovatelný soubor = vada, ne smůla.**
  ⚠️ **A tady taky potřebuješ kanárka:** doložit, že `kill` opravdu trefil okno zápisu — jinak
  pět úspěchů může znamenat jen to, že zabíjíš mezi zápisy. Doporučený důkaz: po každém pokusu
  zkontrolovat, že poslední řádek logu **není** `[tracking] Uloženo:`, nebo že v adresáři
  `cas/` zbyl `.tmp`. **Bez tohoto důkazu je J6 ⛔ NEMĚŘENO, ne ✅.**
  ⛔ Metodika sama je **neověřená** — nikdo ji nespustil. `T11` je její laboratorní náhrada.
- **J7 — restart a R21.** Ukončit appku, spustit znovu se **stejným** `LUDONE_DATA_DIR`, pak
  `getTrackingState()` → `state: "ceka-na-potvrzeni"`, týž klíč, `uzavrene` **prázdné**.
  🔴 Když vrátí `"bezi"`, je to **R21 porušené** — ta chyba vyfakturuje víkend.
- **J8 — vypínač.** Restart bez `DESKTOP_TIME_ENABLED` → `startTracking(...)` vrátí
  `{ outcome: "disabled" }`, `getTrackingState()` **pořád vrací rozdělaný záznam z J7**,
  a `shasum casovac.json` je **stejný jako před restartem** (vypínač nesmí sežrat hodiny).

### Zápis výsledku
- Do `dukazy/b5-casovac-<datum>/vysledek.json` + `README.md` (✅ konvence sedí na
  `dukazy/meet-2026-09-01`, `dukazy/zvuk-2026-08-20`).
  🔴 `.gitignore:18-40` do `dukazy/` pouští jen tohle — žádný zvuk (R24); `*.log` projde díky
  výjimce `!dukazy/**`.
- Každé tvrzení označ jedním z **pěti** stavů podle `AGENTS.md`: **✅ ověřeno naostro · 🧪 zelené
  testy · ⛔ neověřeno · 🟡 podmíněně platné · ⚠️ varování/rozpor**. *(Návrh packetu uváděl jen
  tři; `AGENTS.md` říká „přesně pět stavů".)* **„Zelené testy" NENÍ „ověřeno".**
- Body, které Codex označí ⛔, protože je nespouštěl, **musí v PR zůstat ⛔**.

---

## 17. Rollback

- **Jedním revertem.** `git revert <merge commit PR>` odstraní `electron/tracking.cjs`,
  `tests/tracking-timer.test.js`, `scripts/akceptace/B5-sabotaze.sh` a tvoje bloky z
  `main.cjs`, `preload.cjs`, `.env.example`.
- **Žádná migrace** (`plan.md` §1: „Žádná migrace v1 — desktop nikam nepíše").
- **Server se nedotkne ničeho** — B5 nevolá `POST /api/desktop/recordings` ani frontu.
- **Zbytek na disku:** `~/Library/Application Support/LuDone Desktop/cas/casovac.json` po revertu
  zůstane. **Je inertní** (nikdo ho nečte) a **nemaže se**: M21 zakazuje tiše smazat čas.
  Do PR napiš cestu.
- **Expozice se nemění:** `DESKTOP_TIME_ENABLED` zůstává vypnuté, `TrackingCard.jsx` dál na atrapě
  ⇒ revert nemá **žádný** viditelný dopad na uživatele.
- **Nevratné akce v tomhle PR nejsou žádné.** Když ti nějaká vyjde, **zastav a zeptej se.**

---

## 18. Definition of Done

**Z `plan.md` §3 doslova:**
1. Cílený test **napřed** a viděný **červený** ze správného důvodu.
2. `npm run lint`, `typecheck`, `test:unit` — všechny **EXIT=0**, **měřeno před rourou**.
3. Sabotáž, která prokazatelně chytá odstranění guardu, s **doslovným výpisem**.
4. Nejméně jeden případ, který musí zůstat **zelený** (poměr 2–3 červené : 1 zelená).
5. **Diff přečtený Claudem, u money a RBAC povinně.**
6. PR odkazuje na Feature ID a tenhle plán.
7. **Bez produkce a bez merge** před Danovým finálním schválením.

**Z `plan.md` §2b — co musí být v PR napsané:** Feature ID a odkaz na plán · **doslovný výpis
červeného testu** před opravou · **sabotáž**: co jsem rozbil a čím to doložím · **čtyři osy** po změně.

**Specifické pro B5:**
8. `electron/tracking.cjs` **neobsahuje řetězec `require("electron")`** *(grep + výsledek přilož)*.
9. **Renderer se nezměnil**: `git diff --stat` neukazuje ani jeden soubor z `src/**`.
10. **Ani jeden cizí blok** ze seznamu v §12.3 není v diffu — projdi ho řádek po řádku.
11. Klíč proti duplikaci je na disku **dřív**, než ho dostane volající (`T1` zelený, `S1` červená).
12. `DESKTOP_TIME_ENABLED` má **vlastní** test se třemi hodnotami × čtyřmi zapisujícími metodami.
13. Restart končí v `ceka-na-potvrzeni` (`T3`), **pád rendereru zůstává `bezi`** (`T3b`).
14. **`stop()` i `switchProject()` mají uzavřený úsek NA DISKU** (`T5`, `T5b`).
15. **`resolveRecovered("pokracovat")` nemění `clientTimeEntryId`** (`T4b`).
16. Kanárek `[tracking] Uloženo:` má vlastní test (`T12`).
17. Hook na pád rendereru má chování i strukturální test (`T14`, `T15`).
18. Čtyři osy v PR: `DSK-F011` a `DSK-F013` → `scope: approved` · `delivery: coded` ·
    **`exposure: disabled`** · **`verification: tests-green`** (`verified-live` teprve až
    člověk odevzdá `dukazy/b5-casovac-*`).
19. V PR je věta, že **typecheck `electron/tracking.cjs` POKRÝVÁ**, protože ho test importuje
    (§15) — a že `jsconfig.json` se přesto nerozšiřoval.
20. V PR jsou vypsané **vědomé odchylky**: `.env.example` mimo seznam souborů v `plan.md` §2b,
    a náhrada testu `webContents.forcefullyCrashRenderer()` unit testy `T3`/`T3b`/`T14` (§21).
21. V PR jsou vypsané **odpovědi nebo trvající otevřenost** otázek O-B5-1 až O-B5-5 (§21).
22. **Verdikt k pilotu procesu** (`decisions.md` O12): šel packet implementovat bez produktového
    hádání? Kde jsi musel zastavit a ptát se? **Neúspěch je platný výsledek**, když přesně řekne,
    co změnit.

---

## 19. Implementátor

**Codex, model `gpt-5.6-sol`** (`plan.md` §2, sloupec „Vykonavatel" u B5).
Pouštět jako **viditelný panel v Orce**, ne jako proces na pozadí.
Jeden zapisovatel v jednom worktree (`AGENTS.md`).

🔴 **Co implementátor NESMÍ — doslova z `MASTERPLAN` §9:**
> - **rozšířit scope; změnit schválený design; vytvořit nový design-system pattern bez tasku
>   a schválení; změnit API/datový kontrakt bez aktualizace plánu; oslabit test; obejít bránu;
>   rozhodnout nové money nebo RBAC pravidlo.**
> „Pokud task packet nestačí, vrátí **konkrétní otázku** koordinátorovi. **Nehádá.**"

**Konkrétně tady:** nedokreslovat obrazovku „časovač se ptá" · nesahat na `TrackingCard.jsx`,
`useElapsedTime.js` ani `App.jsx`, i když tam vidíš vadu (`formatElapsed` na `:23-27` opravdu
porušuje R9 — **nahlas to, neopravuj**) · nerozšiřovat `jsconfig.json` · nerozhodovat, jestli
sdílený účet smí měřit čas (B10) · nespouštět migraci B12 · neflipovat `DESKTOP_UPLOAD_ENABLED`
ani jiný cizí vypínač · **nerozhodovat otevřené otázky ze §21 potichu** — když na ně narazíš,
napiš zvolený předpoklad do PR a označ ho jako předpoklad.

---

## 20. Reviewer

**Claude (Opus) nad diffem — povinně, protože je to money path.**
`MASTERPLAN` §10 (✅ doslova): *„Money-critical kód od Codexu vždy projde nezávislým Claude review
nad diffem. Nemerguj money-critical změnu pouze na základě testů nebo self-review autora."*
§14: *„Agent, který napsal kód, nesmí být jedinou autoritou pro jeho schválení."*

⚠️ **`REVIEW.md` není soubor** — je to sekce uvnitř `docs/MASTERPLAN.md` (§14, od řádku 885).
✅ Ověřeno; v repozitáři žádný `REVIEW.md` neexistuje.

| Pass | Na co se u B5 dívat |
|---|---|
| **1 — Correctness** | Souběh `start`/`switch`/`stop` (serializace, `T13`), pořadí zápisu vs. návratu, ENOSPC, rozbitý JSON na vstupu, `endedAt` z rendereru |
| **3 — Money safety** | R9 ořez a výpočet minut z ořezaných konců · R10 klíč při startu a jeho neměnnost při obnově · R11 návaznost bez díry a překryvu · R21 žádný default · **nikde žádná sazba** · **každá uzavřená minuta je na disku** |
| **5 — Plan compliance** | Vlastnictví bloků podle §12 — **řádek po řádku**. Devět stories v jednom souboru odpouští málo |
| **7 — Verification evidence** | Doslovné výpisy červené · dvanáct sabotáží · **kanárci J3, J4 a J6**: když grep nic nenašel, je výsledek ⛔, ne ✅ |

**Odchylka od plánu se neřeší tichem** (`MASTERPLAN` §14): důvod do `decisions.md`, úprava
`plan.md`/`spec.md`, **ve stejném commitu**, a review ji musí výslovně posoudit.
**Tichá odchylka je blocker.**

---

## 21. Otevřené otázky a vědomé odchylky (nové pole — bez něj packet lže mlčením)

### Otázky pro koordinátora — implementátor je NEROZHODUJE

| # | Otázka | Proč to nejde uhodnout |
|---|---|---|
| **O-B5-1** | Kdo nakreslí obrazovku „časovač po pádu se ptá" (R21)? | `approved.json` ji nemá mezi `coveredScreens` ani `openDesignQuestions`. B5 drží jen stav a rozhraní; bez obrazovky se `ceka-na-potvrzeni` nikdy nedostane k člověku |
| **O-B5-2** | 🔴 **Co přesně je „GUID projektu"?** RFC 4122 v4? Jakýkoli 36znakový identifikátor z LuTracku? | `KONTRAKT.md:43` říká jen `"<GUID projektu z LuTracku, nebo null>"`, žádný zmrazený dokument nedává tvar. **Když B5 zamkne přísný v4 regex a skutečná ID LuTracku mají jiný tvar, odmítne B5 každý reálný start a zablokuje B6.** |
| **O-B5-3** | Na které straně IPC leží „adaptér času" z `plan.md` §1? `src/lib/adapters/**` je renderer, `tracking.cjs` je hlavní proces | Plán říká „čas jde přes adaptér", ale nepřiděluje mu stranu. B5 definuje jen IPC povrch |
| **O-B5-4** | 🔴 Co má dělat `start()` nad **už běžícím** časovačem? A smí se „pokracovat" nabídnout i po víkendu, nebo musí člověk vždycky zadat konec? | Money rozhodnutí. R21 varuje před vyfakturovaným víkendem, ale neříká, jestli „pokracovat" počítá i dobu, kdy appka neběžela. **Interim (k potvrzení): `start` nad běžícím = `noop`; `pokracovat` nechává `startedAt` beze změny a fakta o mezeře vrací volajícímu, aby rozhodl člověk.** |
| **O-B5-5** | Kdo vlastní bloky uvnitř `electron/tracking.cjs` po B5? | `plan.md` §2b dává `tracking.cjs` i B10, ale tabulka vlastnictví bloků (§2) řádek pro B10 nemá |
| **O-B5-6** | Má se u „zahodit" záznam smazat, nebo uložit do `uzavrene` s `minutes: 0`? | M21 zakazuje **tiché** smazání; výslovné zahození člověkem tiché není. **Interim (k potvrzení): uložit s `closedReason: "zahozeno-clovekem"` a `minutes: 0`** — jediná varianta, která nemůže nevratně ztratit data |

### Vědomé odchylky od zmrazeného plánu — patří do PR i do `decisions.md`

| # | Odchylka | Důvod |
|---|---|---|
| **D-B5-1** 🔴 | `plan.md` §2b předepisuje pro B5 test *„Čas přežije `webContents.forcefullyCrashRenderer()`"*. Ten je Electron-only a v `environment: "node"` ho spustit nejde. **Nahrazen `T3` + `T3b` + `T14` a živým krokem `J5`.** | Bez deklarace by to byla **tichá odchylka od zmrazeného plánu = blocker** (MASTERPLAN §14). Návrh packetu ji provedl mlčky |
| **D-B5-2** | `.env.example` není v seznamu souborů B5 v `plan.md` §2b | R18 žádá doložitelný vypínač; `.gitignore:8-11` k tomu ten soubor výslovně určuje |
| **D-B5-3** | `processStartedAt` je **injektovatelná závislost**, ne jen pole ve schématu | Bez toho není R21 v unit testu měřitelná — obě instance store běží v témže procesu |
| **D-B5-4** | Nový kanárek `[tracking] Uloženo:` vedle spec-ového `[recording] Uloženo:` | Spec §11 zavádí pravidlo kanárka, ale jmenuje jen nahrávací. Časová agenda potřebuje vlastní |

---

## Co revize opravila

**Ověřeno v kódu, ne v zadání.** Baseline bran, SHA čtyř dokumentů, všechna čísla řádků
v `main.cjs`, `preload.cjs`, `queue.cjs`, `queue.js`, `manifest.js`, `TrackingCard.jsx`,
`useElapsedTime.js`, `App.jsx`, `nahled.html`, `E2-sabotaze.sh` a `.gitignore` jsem otevřel
a změřil. Co našla:

**1. Nepravdivé tvrzení o bráně (nejzávažnější).** Návrh tvrdil, že typecheck `electron/**`
nevidí, a v DoD bod 15 nutil implementátora tuhle nepravdu **napsat do PR**. `tsc --listFiles`
ukazuje `electron/queue.cjs` i `electron/auth.cjs` v programu; kontrolní pokus se záměrnou
typovou chybou v `exclude`ovaném `.cjs` vrátil `TS2345` a `EXIT=1`. `exclude` vyřazuje jen
počáteční výběr, ne importované soubory. Opraveno v §15 a DoD 19.

**2. Test, který zůstane zelený pod vlastní sabotáží.** `T1` porovnával jen hodnotu z disku
s hodnotou z návratu. Pod sabotáží S1 (`newId()` přesunuto do `stop()`) jsou **obě `undefined`**
(`JSON.stringify` klíč s `undefined` zahodí) a `expect(undefined).toBe(undefined)` **projde**.
Doplněna assertion na neprázdný UUID.

**3. Rozpor se zmrazeným specem.** `T3` tvrdil, že po pádu rendereru je stav `ceka-na-potvrzeni`.
Spec §8 `DSK-F011` doslova žádá opak: *„When zabiju renderer · Then panel se otevře s **běžícím**
časovačem."* R21 mluví o `startedAt` starším než **start procesu** — renderer crash proces
nerestartuje. Rozděleno na `T3` (restart) a nový `T3b` (pád rendereru), s injektovatelným
`processStartedAt`, bez kterého by `T3` na korektní implementaci padal (obě instance běží
v témže procesu).

**4. Pět money cest bez jakéhokoli měřidla** — všechny by prošly se všemi branami zelenými:
`stop()` nemusel uzavřený úsek uložit na disk · `switchProject()` také ne · `resolveRecovered
("pokracovat")` směl vyrobit nový `clientTimeEntryId` (přesně duplikát z R10/R22) ·
`endedAt` z rendereru nebyl nijak validovaný · `load()` mohl mít široký `catch`, který nečitelný
soubor promění v prázdný stav. Přidány `T4b`, `T5`, `T5b`, `T11` a sabotáže S7–S9.

**5. Hook bez účelu a bez brány.** Návrh žádal `panelContents.on("render-process-gone", …)`,
ale neřekl, co má dělat, a neměřil to. Šel smazat se vším zeleným. Přesunut do
`handleRendererGone` v `tracking.cjs` (testovatelné bez Electronu) a pokryt `T14`/`T15`.

**6. Kanárek bez kanárka.** `J3` grepuje `[tracking] Uloženo:`, ale nic nehlídalo, že se ten
řádek vůbec loguje — smazat ho nechá brány zelené a `J3` navždy ⛔. Přidán `T12` a sabotáž S10.
Stejná díra v `J6`: pět úspěšných parsování nedokazuje nic, když `kill` mohl pokaždé trefit
mezeru mezi zápisy. Doplněn požadavek na důkaz, že zásah do okna zápisu opravdu padl.

**7. Živý krok, který na správné implementaci selže.** `J5(b)` žádal, aby lišta po pádu
rendereru „dál hlásila běžící čas". Autoritu tray drží dnes renderer (`App.jsx:20-25`) a její
přesun je **B3**; časovač spuštěný přes DevTools se do tray nedostane, protože `TrackingCard.jsx`
se nemění. Krok odstraněn a předán B3.

**8. Sabotážní harness bez kontroly zásahu.** §14 opisovala z `E2-sabotaze.sh` tři funkce,
ale vynechala tu nejdůležitější: `if grep -c <marker> -le 0 → STOP sabotáž minula cíl`
(`E2:74-77`, `:94-97`). Doplněno, včetně odkazu na nález v `DAN-TODO.md` o markerech v produkčním kódu.

**9. Tichá odchylka od zmrazeného plánu.** `plan.md` §2b předepisuje pro B5 test
`webContents.forcefullyCrashRenderer()`; návrh ho beze slova nahradil. Podle MASTERPLAN §14 je
tichá odchylka blocker. Deklarována jako **D-B5-1** v novém poli §21.

**10. Chybné citace a ukazatele** (implementátor by podle nich sáhl vedle):
citát „projekt se smí jen PŘEDVYPLNIT… agendy nesdílejí start ani stop" není v momentu M15
(řádek 45), ale v sekci „Verdikt: kalendář" (řádek 17) · krok 3 byl označen „R13/F013" —
**R13 je o odvolání tokenu při odhlášení** · registrace tray je `:727-730`, ne `:728-731`
(`:731` je `createPanelWindow()`) · `deriveTrayState` v `main.cjs` **dnes neexistuje**, vytvoří
ho B3 · `REVIEW.md` není soubor, je to sekce v `MASTERPLAN.md` od řádku 885 · `AGENTS.md`
definuje **pět** stavů ověření, ne tři · požadavek „vlastník, GUID, UTC" patří podle
`decisions.md` S2 a `KONTRAKT.md:117` na **odesílaná data**, ne na lokální soubor — a schéma
z těch tří částí implementuje dvě (vlastník chybí, patří B10) · návrh vydával čtyři z jedenácti
`coveredStates` za úplný výčet · design ukazuje **místní** `08:55`, soubor drží UTC (1. 9. 2026
je Praha na UTC+2), takže `T2` měří **délku úseku**, ne shodu se zobrazenou hodnotou.

**11. Slabé assertiony, které nic neměřily.** `T2` v původní podobě vrací 316 minut i při
výpočtu ze surových časů (rozdíl 5h16m12s zaokrouhlí stejně) — doplněn případ, kde se ořezaný
a surový výpočet rozcházejí (61 vs. 60) · `T9` statoval adresář z `mkdtemp`, který má `0700` sám
od sebe, takže by prošel i bez `mode` v kódu — přesměrován na adresář `cas/`, který zakládá kód ·
`T6` kontroloval vypínač jen u `start()` — rozšířen na všechny čtyři zapisující metody ·
sabotáž `S5` se odvolávala na „test s injektovaným `fs`", který §13 vůbec nedefinovala — doplněn
jako `T11` · `T10` a `T15` používají `functionSource`, který hledá doslova `function <jméno>(`,
takže doplněn požadavek na deklaraci `async function …`, jinak testy červenají ze špatného důvodu.

**12. Nedefinované chování, které jsem NEUHODL.** Šest otevřených otázek (§21): tvar GUID,
souběžný `start`, započítání mezery při „pokracovat", osud zahozeného záznamu, strana adaptéru
a vlastnictví `tracking.cjs` po B5. U tří z nich je uvedeno interim chování — vždy ta varianta,
která nemůže nevratně ztratit ani zdvojit minuty — a **označené jako předpoklad k potvrzení**,
ne jako rozhodnutí.

## Co packetu chybí ve spec/plan

- Tvar identifikátoru projektu. Žádný zmrazený dokument neříká, co je „GUID projektu" — `docs/server-modul/KONTRAKT.md:43` má jen `"<GUID projektu z LuTracku, nebo null>"`. B5 má podle R6 odmítnout „cokoli, co není GUID", ale bez tvaru to nejde napsat. Když se zamkne přísný RFC 4122 v4 regex a skutečná ID LuTracku mají jiný tvar, B5 odmítne každý reálný start a zablokuje B6.
- Chování `start()` nad už běžícím časovačem. Spec ani plan to neřeší. Varianty (noop / implicitní switch / TypeError) mají různý dopad na peníze.
- Započítává se při `resolveRecovered("pokracovat")` doba, kdy aplikace neběžela? R21 varuje před vyfakturovaným víkendem, ale neříká, jestli obnovený úsek počítá od původního `startedAt`. To je money rozhodnutí, ne implementační detail.
- Osud záznamu při `decision: "zahodit"` — smazat, nebo uložit s `minutes: 0`? M21 zakazuje jen TICHÉ smazání; výslovné zahození člověkem tiché není.
- Kdo nakreslí obrazovku „časovač po pádu se ptá" (R21). V `design/approved.json` není ani mezi `coveredScreens`, ani mezi `openDesignQuestions`. Bez ní se stav `ceka-na-potvrzeni` nikdy nedostane k člověku a celé R21 je slepá ulička.
- Na které straně IPC leží „adaptér času" z `plan.md` §1. `src/lib/adapters/**` je podle Spine renderer, `electron/tracking.cjs` je hlavní proces; plán říká „čas jde přes adaptér", ale stranu nepřidělí.
- Vlastnictví bloků uvnitř `electron/tracking.cjs` po B5. `plan.md` §2b dává `tracking.cjs` i story B10, ale tabulka vlastnictví bloků (§2) pro B10 řádek nemá.
- Přesný název macOS helper procesu rendereru pro krok J5 (`pgrep -fl ...`). Nezměřeno; je to živý krok, který musí spustit člověk na Macu.
- Ověřitelná metoda pro J6 (kill -9 uprostřed atomického zápisu) — jak doložit, že zásah opravdu padl do okna mezi `rename` a `fsync`, a ne mezi dva zápisy. Bez toho je pět úspěšných parsování ⛔ NEMĚŘENO.

## 🔴 Co NEBYLO ověřeno v kódu

Skeptik packet přečetl proti kódu, ale tohle zůstalo bez důkazu.
**Než na tom postavíš implementaci, otevři to.**

- Nespustil jsem žádný z navržených testů T1–T15 ani Z1–Z5 — modul `electron/tracking.cjs` neexistuje, takže je nebylo nad čím spustit. Všechny očekávané červené výpisy v §13 jsou TVAR, ne naměřený text.
- Nespustil jsem `npm run build`, `npm run package:mac`, `ui-smoke` ani `audio-smoke`. Baseline lint/typecheck/test:unit jsem naopak spustil naostro (všechny EXIT=0, 77 testů) — to je změřené.
- Neověřil jsem spuštěním, že vitest naimportuje nově vzniklý `electron/tracking.cjs`. Odvozeno z toho, že `tests/queue.test.js:5` importuje `../electron/queue.cjs` a ten test dnes běží zeleně (viděl jsem to v běhu 77 testů) — ale nový soubor jsem nevytvářel.
- Neověřil jsem, že `handleValidated` propustí `tracking:*` kanály z panelu za běhu aplikace. Přečetl jsem `main.cjs:115-156` a `scripts/ui-smoke.mjs:182` (kde `window.ludone.getTrayState()` přes CDP prokazatelně projde), ale sám jsem aplikaci nespustil.
- Neověřil jsem, že `app.getPath("userData")` je k dispozici v okamžiku líné inicializace store. Vychází to z toho, že `configureWritablePaths()` běží na `main.cjs:193` při načtení modulu a `main.cjs:479` volá `getPath` uvnitř handleru — ale nespustil jsem to.
- Neověřil jsem, že `render-process-gone` v Electronu doručí událost všem registrovaným listenerům, když už jeden existuje (`main.cjs:312`). Je to standardní chování EventEmitteru, ale neměřil jsem ho.
- Neotevřel jsem implementaci B3 (neexistuje), B6 ani B7. Tvrzení o tom, co B5 smí volat, stojí na tabulce v `plan.md` §2 a na tom, že `deriveTrayState` v `main.cjs` dnes prokazatelně není (to jsem grepem ověřil).
- Neověřil jsem, jestli `randomUUID()` a formát ID projektů v LuTracku/Tabidoo mají stejný tvar — to je otevřená otázka O-B5-2, ne ověřené tvrzení.
- Nepřečetl jsem celý `docs/ux/cesta-uzivatele-2026-09-01.md` (139 řádků, ale velmi dlouhé řádky). Přečetl jsem hlavičku, verdikty Dock/kalendář a celý blok momentů M10–M30; sekce mimo tento rozsah jsem viděl jen přes cílený grep.
- Nepřečetl jsem `docs/changes/desktop-v1/intent.md` celý (jen řádek 61 přes grep), ani obsah `sekce-navrhy/**` — spec §11 je označuje za NEzávazné návrhy, tak jsem z nich nic nepřevzal jako pravidlo.
- Neověřil jsem vlastním měřením spec tvrzení o cizím kódu, která pro B5 nejsou load-bearing (např. že `createAuthController` se nikde neimportuje). Ověřil jsem jen to, čeho se B5 dotýká.
- Nespustil jsem `scripts/akceptace/E2-sabotaze.sh` — přečetl jsem ho celý a citace idiomů (`over_cisty_cil`, `zelena_brana`, `cervena_brana`, kontrola markeru na `:74-77` a `:94-97`) jsou ze zdrojáku, ne z běhu.
- Neověřil jsem konce bloků v `design/navrh/nahled.html` do posledního řádku — začátky sekcí (419, 443, 461) a všechny citované texty jsem ověřil grepem a `sed`, konce jsem odvodil z pozice následující sekce.
