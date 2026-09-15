# Dashboard nahrávek — zadání pro Codex

**15. 9. 2026 — vydání:** Dan výslovně pověřil koordinátora vydáním 0.1.3 (D19). Tag `v0.1.3`, podpis, notarizace a veřejná publikace jsou dokončené; aktuální [stav a důkazy](STAV.md). Živá přejímka na Macu zůstává samostatná.

**Pro koho:** externí vývojář (Codex / GPT) pracující **jen na téhle desktopové aplikaci**.
**Repo:** `Make-more-s-r-o/ludone-desktop`, větev `main`. 🔴 **Repo je VEŘEJNÉ** — cokoli sem
napíšeš, je veřejné okamžitě a nevratně.
**Zadal:** Dan Jirotka, 14. 9. 2026. **Podklady:** změřeno čtením kódu téhož dne.
**Prošlo kritikou** jako zadání pro samostatný běh; nálezy z ní jsou v sekci 7.

> ## ⏩ Začni tady
>
> 1. Přečti **sekci 12 (Stav práce)** — je tam, co už je hotové a kde skončil minulý běh.
> 2. Vezmi první úkol, který není ✅, a přečti si k němu sekci 8.
> 3. Než sáhneš na kód, projdi **sekci 1 (mantinely)** a **sekci 7 (devět pastí)**.
> 4. Po každém hotovém kroku **commitni kód A zápis do sekce 12**, pak pushni.
>
> 🔴 **Commituj po sobě sám.** Je to doložená slabina: jedno sezení Codexu v desktopové
> aplikaci vyrobilo v jiném repu za 62 minut **176 souborů a git použilo čtyřikrát — pokaždé
> jen `git status`.** Nula `git add`, nula `git commit`. Práce pak ležela den netrackovaná
> a našla se náhodou. **Netrackovaný soubor na konci běhu je vada, ne stav.**
>
> Ptát se Dana můžeš, ale neblokuj tím celou práci — sekce 14 říká, co rozhodnout samostatně
> a co je skutečná otázka na něj.

---

## 0. Co se staví a proč

LuDone Desktop nahrává schůzky a odesílá je do LuDone. Odesílání **poprvé v historii projektu
prošlo 11. 9. 2026** — do té doby ho držely dvě vady v kontraktu, které nikdo neviděl, protože
požadavek vůbec neopustil počítač. Dnes to funguje, ale **uživatel nemá jak zjistit, co se
s jeho nahrávkami stalo.** Panel v liště ukáže jen „N čeká na odeslání".

Tři nahrávky teď stojí ve frontě zablokované a **aplikace nenabízí jediný způsob, jak je
odblokovat** — chybí IPC kanál i tlačítko (sekce 3).

**Cíl:** obrazovka v Nastavení, kde uživatel vidí **živé nahrávky** — co leží na disku, co čeká
ve frontě, co je zablokované a co už v LuDone je — a může s tím něco udělat.

🔴 **Není to archiv a nesmí se jím stát.** `ROZHODNUTI.md:27–28` (tabulka A, „neotvírat znovu"):
**A11** *„Aplikace je spouštěč, ne platforma — archiv, přepisy, hledání a dashboardy patří do
webu"* · **A12** *„archiv nahrávek NE"*. Dan tohle rozhodnutí 14. 9. **potvrdil, že platí dál**.
⇒ **Nezakládej žádné nové úložiště historie.** Když retence nahrávku smaže, zmizí i z dashboardu
— a je to správně. Archiv je na webu.

---

## 1. Mantinely — co se NESMÍ

Tohle nejsou doporučení. Každý bod už jednou něco stál.

1. 🔴 **Nesahat na serverovou stranu.** Server je jiný repozitář a jiný tým. Když se ukáže,
   že něco jde udělat jen změnou serveru, **napiš to jako nález a zastav se** — nevymýšlej
   obchvat. (Sekce 6 jeden takový případ už obsahuje.)
2. 🔴 **Pojistka vlastnictví nahrávky se neobchází.** Brání tomu, aby si pozdější přihlášení
   tiše přivlastnilo cizí nahrávku. Převzetí smí být **výslovný klik u konkrétní položky**,
   nikdy ne automatické a nikdy ne hromadné — **„převzít vše" je zakázané.**
3. 🔴 **Neopravuj měřidlo místo vady.** Zakázané „opravy": změkčení testu, `it.skip`, vypnutí
   brány, výjimka ve skenu tajemství, zvednutí globálního `testTimeout`, zápis do baseline
   `tests/preskocene-baseline.json`, `--force`, `[skip ci]`.
4. 🔴 **`design/**` je cizí práce — jen ke čtení.** `AGENTS.md:66`: *„design/ je samostatná,
   cizí práce; bez výslovného vlastnictví na ni nesahej."*
5. 🔴 **Žádná tajemství do gitu** — tokeny, klíče, `client_id`, e-maily z ostrého provozu.
   Ani v testech, fixturách nebo commit message. Repo je veřejné.
6. 🔴 **Nikdy necommituj zvuk ze skutečné schůzky.** Fixtury generuj, nekopíruj z dat uživatele.
7. 🔴 **Neruš ani neobcházej rozhodnutí z tabulky A v `ROZHODNUTI.md`.** `ROZHODNUTI.md:129`
   je řadí mezi věci, které smí změnit jen Dan.
8. **Testy mají síť zakázanou globálně** (`tests/setup-no-network.js`). **Zákaz neobcházej** —
   kdo si `fetch` nezamockuje, dostane právem červenou. Vznikl proto, že testovací sada
   posílala na ostrý server 6 neúspěšných přihlášení na běh a čerpala tím uživateli limit.
9. **Nemaž ani nepřepisuj data fronty** mimo akce, které si uživatel vyžádá kliknutím.
   *(Výjimka, která už existuje: retence maže sama při startu — viz sekce 5.)*

---

## 2. Danova rozhodnutí (zadání, ne návrh)

| # | otázka | rozhodnutí |
|---|---|---|
| 1 | Kde dashboard žije | **Samostatná obrazovka v Nastavení.** Ne v panelu z lišty. |
| 2 | Zdroj pravdy | **Ptát se serveru a porovnávat** — ukázat skutečný rozdíl „lokálně × v LuDone", ne jen to, co si fronta myslí. Čtení, žádný zápis. ⚠️ Sekce 6 říká, kolik z toho dnes jde. |
| 3 | Akce u položky | **Převzít pod svůj účet · Poslat znovu / zkusit teď · Smazat nahrávku · Otevřít složku se souborem.** Všechny čtyři **vidět v UI**. |
| 4 | Rozsah UI | **Volná ruka včetně Nastavení** — smíš přepracovat i stávající panel. |
| 5 | Archiv × spouštěč | **Jen živé nahrávky. A11 platí dál**, nové úložiště historie se nezakládá. |
| 6 | Pořadí | **Převzetí se staví HNED po datové vrstvě**, ne jako poslední akce. Tři zablokované nahrávky mají být odblokované i tehdy, když vývoj později uvázne. |
| 7 | Vydání verze | **Ano, dotáhnout až k vydání** — včetně chybějícího nahrávacího kroku. Detail a co k tomu potřebuješ od Dana: sekce 11. |

**Proč rozhodnutí 2 stojí za tu práci:** za poslední týden podvedl vlastní záznam aplikace
nejméně třikrát — hlásila „nic se neodeslalo", zatímco na serveru ležely tři nahrávky.
A u odeslané položky si fronta dodnes drží `server.recordingId: null`, přestože server
nahrávku má celou a znormalizovanou. **„Synchronizováno" podle naší fronty není důkaz.**

---

## 3. Proč to bez nové práce nejde: vlastnictví se nedá potvrdit

| vrstva | co tam dnes je |
|---|---|
| `electron/preload.cjs:193–194` | vystavené jen `listQueue` a `retryQueue` |
| `electron/main.cjs:2540, 2548` | IPC kanály jen `queue:list` a `queue:retry` |
| `src/features/queue/QueueCard.jsx:121–138` | pouhý text `role="alert"`, **žádné tlačítko** |

**Kořen je hlouběji než v UI.** `prepareRecoveredRecording` (`electron/queue.cjs:458–565`)
vrací objekt `{ manifest, manifestPath, trackPaths, recoveredIncomplete?, sourceManifestPath? }`
— **pole `ownerFingerprint` v něm vůbec není** (`:556–564`). `recoverOrphanedRecordings`
(`:581–674`) ho předá do `enqueueRecording` (`:780–794`), kde `addOwnerToNewRecording`
normalizuje `undefined` na **`null`**. Při odeslání pak `requireMatchingQueueOwner`
(`electron/upload-client.cjs:423–447`) vrátí `queue_owner_unknown` a **nemá to s čím porovnat**.

Tři reálné zablokované nahrávky uživatele:

| nahrávka | délka | důvod | pomůže přihlášení? |
|---|---|---|---|
| `594223df` | 27 min | otisk prázdný po obnově (`queue_owner_unknown`) | ❌ není co porovnat |
| `8087dd1a` | 64 min | otisk **jiného účtu** (`queue_owner_mismatch`) | ❌ potřebuje převzetí |
| `53ab63fc` | 2 m 47 s | otisk **jiného účtu** (`queue_owner_mismatch`) | ❌ potřebuje převzetí |

🔴 **A „Poslat znovu" jim nepomůže taky** — a je to jiný důvod, než by se zdálo. Vlastnické
chyby mají třídu `paused` (`upload-client.cjs:427, 440, 446`), takže položka zůstává ve stavu
**`ceka`**, ne `selhalo` (`src/lib/queue.js:530–545`). `retryFailedItem` ale vrací beze změny
cokoli, co není `selhalo` (`:362`). **Opakování je u nich no-op z definice.** Jediná cesta je
převzetí — proto je v rozhodnutí 6 posunuté dopředu.

---

## 4. Mapa aplikace — UI vrstva

**Žádný framework navíc.** Bez Tailwindu, bez komponentní knihovny, bez CSS-modules.
Jeden globální stylesheet `src/styles.css` (2 603 řádků) s CSS proměnnými v `:root`
(ř. 52–94): `--panel-page`, `--panel-card`, `--panel-accent`, `--panel-ok`, `--panel-wait`,
`--panel-bad`, `--radius-window: 26px`, `--radius-inset: 18px`, `--radius-control: 10px`.
Barvy v `oklch()`, měkké varianty přes `color-mix(in oklab, …)`.

🔴 **„Nové barvy nevymýšlej" není vkus, je to brána.** `tests/barvy.test.js:29–38` vymáhá
**právě jeden blok `:root`** v `src/styles.css` a čtyři sémantické barvy definované právě
jednou. Vlastní `:root` pro dashboard = červená.

**Tři okna, jeden bundle.** `index.html` načítá `src/main.jsx`, ten podle
`window.location.hash` vybere root komponentu:

| okno | hash | komponenta | kde se vytváří |
|---|---|---|---|
| panel v liště | (žádný) | `App.jsx` | `electron/main.cjs:967` |
| **Nastavení** | `#settings` | `SettingsApp` ze `src/components/Settings.jsx` | `electron/main.cjs:1051`, `loadFile(…, { hash: "settings" })` ř. 1084, okno **448×676** (ř. 1058–1064) |
| varování o liště | `#tray-space-warning` | `TraySpaceWarning.jsx` | `electron/main.cjs:734` |

⚠️ **Okno Nastavení je 448×676 a je ZAMČENÉ** — `min`/`max` rozměry i `resizable: false`
(`main.cjs:1058–1064`). Dashboard se musí vejít, nebo je součástí práce okno odemknout.
Rozhodni a **napiš, cos zvolil**; tabulka o sedmi sloupcích se sem nevejde.

**Nastavení je jeden soubor** — `src/components/Settings.jsx` (966 řádků). Záložky mají
registr (ř. 19–24):

```js
const SETTINGS_TABS = Object.freeze([
  { id: "account", label: "Účet" },
  { id: "audio", label: "Zvuk" },
  { id: "recordings", label: "Záznamy" },
  { id: "diagnostics", label: "Diagnostika" },
]);
```

…ale **obsah panelů registr nemá** — jsou to čtyři natvrdo zapsané
`<section role="tabpanel" hidden={activeTab !== "…"}>` bloky v témže souboru
(`account` 617–781 · `audio` 783–822 · `recordings` 824–854 · `diagnostics` 856+).

🔴 **Kolize se „Záznamy" je nebezpečnější, než vypadá.** Ta záložka řeší **retenci** a její
hodnota bydlí v `localStorage` pod klíčem `ludone.prototype.settings` (`Settings.jsx:15, 179,
268`). **Hlavní proces si ji čte tak, že spustí JavaScript v panelovém rendereru**
(`main.cjs:2082–2087`) — a každá chyba čtení končí `return undefined`, tedy „nic nemaž"
(`:2100–2110`). ⇒ **Když při přepracování panelu tenhle klíč nebo renderer rozbiješ, retence
se tiše vypne a žádná brána si toho nevšimne.** Je to fail-open. Doporučení: **pátá záložka
vedle, ne sloučení** — a když se do toho pustíš, napiš test, který čtení politiky ověří.

**Jak přidat sekci:** (a) záznam do `SETTINGS_TABS`, (b) nový `<section role="tabpanel">`.
Obsah **vytáhni do vlastní komponenty** a jen ji naimportuj — vzor je `SettingsAudioTest`
(`src/components/SettingsAudioTest.jsx`).

**Panel v liště** (`src/features/**`): `queue/QueueCard.jsx` · `recording/RecordingCard.jsx`,
`AudioLevelMeter.jsx`, `microphone-only-capture.js`, `recording-copy.js`,
`system-audio-health.js` · `tracking/TrackingCard.jsx`. Skládá je `src/App.jsx`.

**Jak renderer čte data: pollingem, ne událostí.** `App.jsx:39` drží `queueSnapshot`,
`refreshQueueStatus()` (ř. 172–191) volá `window.ludone.listQueue()`, a `useEffect`
(ř. 225–245) to opakuje rekurzivním `setTimeout` každou **1 s**
(`QUEUE_REFRESH_INTERVAL_MS`, ř. 11). Navíc okamžitý refresh na `visibilitychange`
(ř. 208–217) a při změně `recording.active`/`tracking.active` (ř. 219–223).

🔴 **Tenhle vzor na dashboard NEPŘEBÍREJ beze změny** — sekundový dotaz na server by vystřílel
limit (sekce 6). Pro srovnání: přihlášení jede na skutečné události
(`window.ludone.onAuthSessionChanged`, `App.jsx:108`), takže obě cesty jsou v repu zavedené.

**Jediný most renderer ↔ main** je `electron/preload.cjs:130`
(`contextBridge.exposeInMainWorld("ludone", { … })`). Co tam není, renderer nemá.

**Texty česky natvrdo v JSX**, žádné i18n. Jediná pomůcka je skloňování počtu —
`countLabel(count, singular, few, many)` v `src/lib/count-label.js`. **Piš česky**
(`AGENTS.md`: dokumentace a komentáře česky, commit message anglicky).

**Testy UI:** Vitest, `environment: "node"`, **žádné `@testing-library/react`**. Dva vzory:
`tests/settings.test.js` (ruční `new JSDOM`, `createRoot().render()` uvnitř
`React.act(async …)`, `window.ludone` jako mock, klik přes `button.click()`) a
`tests/queue-card-labels.test.js` (`renderToStaticMarkup` + `JSDOM`). Dashboard s tlačítky
patří k prvnímu.

---

## 5. Mapa aplikace — data

**Kde co leží** (vše z `app.getPath("userData")`):

| co | cesta | zdroj |
|---|---|---|
| nahrávky (audio + manifesty) | `<userData>/nahravky/` | `main.cjs:1492, 2137, 2301` |
| fronta | `<userData>/queue/outgoing.json` | `main.cjs:2044–2046` |
| nastavení aplikace | `<userData>/nastaveni/aplikace.json` | `main.cjs:407–410` |
| **tajemství pro otisk vlastníka** (HMAC klíč ≥32 B, mimo frontu **záměrně**) | `<userData>/nastaveni/fronta-vlastnik.json` | `main.cjs:419–422`, `settings.cjs:116–144` |

**Manifest nahrávky** (`src/lib/manifest.js:64–84`, schema v1), soubor
`<prefix>.manifest.json`, kde `prefix = <ISO-timestamp>-<prvních 8 znaků UUID>`
(`main.cjs:1489–1503`):

```js
{ schemaVersion: 1, clientRecordingId, createdAt, closedAt,
  state: "recording" | "complete" | "incomplete",
  tracks: { microphone: { fileName, sizeBytes, sha256, startedAt, endedAt },
            system:     { …totéž… } } }
```

⚠️ **Manifest nemá název nahrávky ani její délku** a schéma má přesně těch šest klíčů
(`:72–79`) — co do něj nepatří, `createManifest` zahodí. **Délka se musí dopočítat** z
`tracks.*.startedAt/endedAt`, velikost umí `recordingSizeBytes` (`queue.cjs:722–748`).

**Položka fronty** (`src/lib/queue.js:244–261`):

```js
{ attempts, clientRecordingId, enqueuedAt, kind: "recording",
  lastFailureReason, manifestPath, nextAttemptAt, ownerFingerprint,
  recoveredIncomplete?, sentAt, sourceManifestPath?,
  server: { recordingId: string|null, uploadedBytes: { microphone, system } },
  state: "ceka" | "odesila" | "odeslano" | "selhalo",
  tracks: { microphone: "<absolutní cesta>", system: "<absolutní cesta>" } }
```

🔴 **Cesty k souborům jsou v `tracks`, ne v `trackPaths`.** `trackPaths` existuje jen
v mezitvaru z `prepareRecoveredRecording`. Záměna těch dvou polí už jednou smazala 32 manifestů
a nechala 57 audio souborů ležet — tedy smazala **to, podle čeho se nahrávka pozná**, a data
nechala.

**Projekce pro renderer je chudá.** `queue:list` dává jen `id` (= `clientRecordingId`),
`kind`, `state`, `attempts`, `nextAttemptAt`, `lastFailureReason`, volitelně `sizeBytes`
a `requiresHumanAction` (`src/lib/queue.js:316–333`). **Žádné `createdAt`, žádný název.**
Dashboard potřebuje víc — rozšíření projekce je proto první úkol (T0).

**Stavy a jejich význam** (`processNext`, `src/lib/queue.js:444–580`):

| výsledek | co se stane |
|---|---|
| úspěch | `odeslano`, `nextAttemptAt: null` |
| `permanent` | `selhalo`, konec |
| `paused` | zůstává `ceka`, **`attempts` se NEinkrementuje**, nastaví se `requiresHumanAction` |
| `retryable` | `attempts >= maxAttempts` → `selhalo`; jinak `ceka` + `nextAttemptAt = teď + odklad` |

Pole `pausedReason` **neexistuje** — důvod nese `lastFailureReason` + boolean
`requiresHumanAction`. ⚠️ `queueItemRequiresHumanAction` (`:181–184`) vrací `true` **jen pro
`state === "ceka"`**; položky ve stavu `selhalo` potřebují člověka taky, ale hlásí `false`.
Dashboard tedy druhou podmínku mít **musí** — jen ji nepiš jako kopii té první, pojmenuj ji.

Retry policy (`:29–34`): `baseDelayMs: 30 s`, `maxDelayMs: 6 h`, `maxAttempts: 5`,
`jitterRatio: 0.2`; `Retry-After` ze serveru má přednost (`odkladPoSelhani`, `:414–420`).
Pumpa (`electron/queue.cjs:829–846`) posílá nejvýš **20 položek na probuzení** (`:827`).

**Otisk vlastníka** (`deriveQueueOwnerFingerprint`, `electron/queue.cjs:80–112`):
HMAC-SHA256 nad `["cz.ludone.desktop","queue-owner","v1", issuer, "email", email]`,
tajemství ≥32 B, výstup `"sha256:<hex64>"`. Snímá se **při startu nahrávání**
(`main.cjs:1488`). Aktuální otisk dá `readCurrentQueueOwnerFingerprint()` (`:2242–2254`).

🔴 **Z otisku NELZE zjistit, komu patří.** Je to jednosměrný HMAC a komentář nad ním říká
doslova: *„Jméno, e-mail ani token se do outgoing.json nikdy neukládají"* (`queue.cjs:73–79`).
⇒ V UI jde napsat jen **„patří jinému účtu, než kterým jsi přihlášen"**, ne u koho vznikla.
Je to vědomý ústupek proti rozhodnutí 3 a Dan o něm ví.

### 🔴 Retence — subsystém, který dashboardu maže data pod rukama

`electron/retention.cjs` (369 řádků) běží **při každém startu aplikace** (`main.cjs:4029`)
a **maže odeslané nahrávky včetně jejich položek ve frontě** (`retention.cjs:305–365`).
Výchozí lhůta je 7 dní po odeslání (`Settings.jsx:17`).

To není chyba, kterou máš opravit — **je to důvod, proč dashboard ukazuje živé věci a ne
archiv** (sekce 0, rozhodnutí 5). Ale musíš s tím počítat:

- Položka, kterou uživatel právě vidí, **může za vteřinu zmizet**.
- Retence maže **zvukové soubory, ale ne `.manifest.json`** (`:340–353` volá `unlink` jen nad
  `candidate.files`). Při dalším startu takový manifest najde `recoverOrphanedRecordings`
  (`queue.cjs:581`), `prepareRecoveredRecording` spadne na chybějících stopách (`:491–497`)
  a jen zvedne počítadlo `skipped`. **Manifest tam zůstane navždy.** ⇒ „Nahrávky na disku bez
  položky ve frontě" jsou z velké části tihle duchové. Dashboard je má umět zobrazit jako
  „soubory chybí" a nabídnout úklid, ne je tvářit jako nahrávku k odeslání.
- Ve stejném adresáři je **třetí typ souboru** — sidecar `*.manifest.json.recovered-upload-v1.json`
  (`queue.cjs:537`). Nepočítej ho jako nahrávku.

**Kompletní IPC povrch dnes** má 46 kanálů; pro tebe jsou podstatné `queue:list`
(`main.cjs:2540`) a `queue:retry` (`:2548`). ⚠️ **`queue:retry` je povolený jen odesílateli
`"panel"`** — z okna Nastavení je dnes nedosažitelný, takže i kdybys nic jiného neměnil,
tohle rozšířit musíš.

🔴 **Každý nový IPC kanál musí projít kontrolou odesílatele** (`handleValidated`/`onValidated`,
`main.cjs:300–321`; 20 testů v `tests/ipc-sender-guard.test.js`). `AGENTS.md:53–54` řadí
kontrolu odesílatele IPC mezi věci vyžadující review nad diffem. Kanál bez guardu je
bezpečnostní vada.

**Testy, které se tě dotknou:**

| soubor | testů | co drží |
|---|---|---|
| `tests/queue.test.js` | 96 | logika fronty, vlastnictví (ř. 206), stavový automat (657), obnova osiřelých (1467) |
| `tests/queue-wiring.test.js` | 241 | zapojení do `main.cjs`, produkční fronta (3795) |
| `tests/upload-client.test.js` | 66 | kontrakt uploadu, vlastník před odesláním (230) |
| `tests/ipc-sender-guard.test.js` | 20 | ochrana IPC |
| `tests/barvy.test.js` | — | právě jeden `:root`, čtyři sémantické barvy |
| `tests/brany-workflow.test.js` | — | výčet bran smí být v repu jen jednou |
| `tests/packaging.test.js` | — | tvar publikace (dotkne se tě v T6) |

---

## 6. 🔴 NÁLEZ: porovnání se serverem nejde postavit celé

**Přečti dřív, než začneš plánovat.** Aplikace volá na server právě pět cest:

| # | metoda + cesta | k čemu | limit |
|---|---|---|---|
| 1 | `POST /api/nahravky/uploads` | založení uploadu **jedné stopy** (idempotentní) | **30/h** |
| 2 | `GET /api/nahravky/uploads/{recordingId}` | stav **jedné konkrétní** nahrávky | **120/h** |
| 3 | `PUT …/{recordingId}/casti/{index}` | část obsahu | 300/h |
| 4 | `POST …/{recordingId}/dokoncit` | dokončení | 30/h |
| 5 | `GET /api/nahravky/uploads/firmy` | seznam firem | bez limitu |

**Co chybí:** neexistuje endpoint, který by vypsal nahrávky uživatele, ani dotaz podle
`clientRecordingId`. Stav se dá zjistit **jen podle `recordingId`, které přiděluje server**.

**A druhá půlka problému je u nás:** `applyServerProgress` (`src/lib/queue.js:342–356`) —
funkce, která to `recordingId` má uložit — **není odnikud volaná**. Je hotová i otestovaná
(`tests/queue.test.js:1014–1039`), ale v `electron/*.cjs` ji nevolá nikdo.

**Limity** (změřeno serverovým týmem v jejich kódu, commit `1b07fad7`, 11. 9. 2026):

- **Klíčem je UŽIVATEL** — jeden strop webem i desktopem dohromady.
- **Okno je pevné (3 600 s od prvního požadavku), ne klouzavé**; počítadlo drží databáze.
- **Počítá se každé volání včetně idempotentního opakování.**
- ⚠️ **Rozpočet 120/h nesdílíš jen s webem, ale i s vlastním odesíláním** — `uploadTrack` dělá
  po každém init ještě `GET /uploads/{id}` (`upload-client.cjs:779`), takže dvoustopá nahrávka
  spotřebuje 2 ze 120 ještě předtím, než se dashboard na cokoli zeptá.
- Neúspěšné ověření tokenu má vlastní strop **30/min na IP sdílený s `/api/mcp`**.

### Co z toho plyne

- **T1 (uložit `recordingId`) je předpoklad, ne vylepšení.** Bez něj by šlo porovnávat jen
  přes **zapisující** init se stejným `Idempotency-Key` — stejný rozpočet jako skutečné
  odeslání, nutnost mít celý soubor a hash, a při neshodě metadat `idempotency_conflict`.
  **Tudy nechoď.**
- U **starých** nahrávek `recordingId` nikde není a už nevznikne. Dashboard u nich musí říct
  **„na serveru neověřeno"** — ne je přebarvit na zelenou podle toho, co říká fronta.
- **Chybějící endpoint pro výpis je nález pro serverový tým**, ne práce pro tebe. Zapiš a jdi dál.

---

## 7. Devět pastí, na kterých se implementace zasekne

Tohle našla kritika tohoto zadání. Neřeš je znovu od nuly.

**P1. 🔴 `recordingId` je PER STOPU, ne per nahrávku.** `uploadTrack` zakládá upload pro každou
stopu zvlášť a z každé dostane vlastní `recordingId` (`upload-client.cjs:750–764`, cyklus
`:891–898`); `sendRecording` vrací **pole** `uploads` (`:899`). Ale `server.recordingId` je
**jeden string** (`queue.js:256`) a `applyServerProgress` čeká právě jeden (`:347`).
⇒ Rozšiř schéma na stopy. **Kdo uloží jen první id, postaví dashboard, který hlásí „je tam"
podle jedné ze dvou stop** — přesně ta lež, kvůli které Dan porovnání chce. A T3 pak dělá
**dva dotazy na položku**, ne jeden; promítni to do rozpočtu.

**P2. 🔴 `uploadedBytes` u jednostopé nahrávky shodí úspěšnou větev.** `requireUploadedBytes`
vyžaduje **oba** klíče jako celá čísla (`queue.js:192–203`), ale mikrofon-only položka vzniká
s `{ microphone: 0 }` bez `system` (`queue.cjs:190`). Naivní zapojení T1 hodí `TypeError`
**hned po úspěšném odeslání**. Dopočítej `system: 0`. Pozor: fixtury bývají dvoustopé, takže
tohle ti test nemusí chytit — napiš ho schválně jednostopý.

**P3. 🔴 Volání store zevnitř odesílání = deadlock.** `processNext` návratovou hodnotu `send`
zahazuje (`queue.js:497`). Store je `Object.freeze` s pěti metodami (`queue.cjs:889`) a
**každá jde přes `serialize()`** (`:700–704`) — zavolat store zevnitř `send` (což už uvnitř
`serialize` běží) zatuhne. Výsledek musí propadnout ven z `processNext`.

**P4. Pole `idempotent` existuje jen v dokumentu, kterému se nemá věřit.** T1 ho chce číst,
v kódu nikde není; jediný výskyt je `docs/server-modul/kontrakt-desktopu.md:41,46` — tedy
dokument, který sekce 13 označuje za zastaralý. **Čti ho obranně (`=== true`) a neukládej**,
dokud pro něj nemáš doložený tvar.

**P5. ✅ Vyřešeno v T1: `sessionId` se předtím nikdy neukládalo.** Strict manifest je dál
beze změny; serverové `sessionId` se nyní ukládá do položky fronty hned po idempotentním INITu
a další stopa i pokus po restartu ho čtou odtud. Tím se dvě stopy znovu nespojují odhadem.

**P6. Převzetí při nepřihlášeném stavu by pojistku ZRUŠILO.** `readCurrentQueueOwnerFingerprint()`
vrací `null` při chybějící relaci, jiném issueru i chybějícím tajemství (`main.cjs:2242–2254`).
Slepé „přepiš aktuálním otiskem" by platný otisk **vynulovalo**. ⇒ Tlačítko neaktivní bez
přihlášení; zápis `null` odmítni.

**P7. HTTP klient pro T3 se nedá znovu použít.** `createRequester` **není exportovaný**
(`upload-client.cjs:903–911` exportuje 7 jmen). Buď ho vyexportuješ — zásah do bezpečnostně
citlivého modulu, tedy review nad diffem — nebo napíšeš druhého klienta, což je ta „třetí
kopie téže logiky", před kterou tohle zadání varuje jinde. **Doporučení: vyexportovat a napsat
proč.**

**P8. Chybí prázdné a chybové stavy.** Rozmysli a naimplementuj: prázdný dashboard · stav bez
přihlášení (T3 ani převzetí nejdou) · `429` (limit vyčerpán — to je čtvrtý výsledek vedle
„je tam / není tam / nevíme") · poškozený `outgoing.json` · soubor, který mezitím smazala
retence, a uživatel klikne „Otevřít složku".

**P9. Snímek v UI stárne.** Pumpa běží sama, retence při startu. Uživatel klikne „Smazat" nad
seznamem starým půl minuty. `serialize()` chrání **soubor, ne záměr** — není verze ani kontrola
„stav je pořád ten, cos viděl". U nevratné akce nad audiem to ošetři.

---

## 8. Plán práce

Pořadí je závazné. Každý bod je samostatný commit s vlastními testy.

### T0 — Rozšířit povrch fronty *(jinak vznikne třikrát narychlo)*

Store je zamrzlý na pěti metodách (`queue.cjs:889`) a projekce pro renderer dává šest polí
(`queue.js:316–333`). T2, T3 i T4 to potřebují rozšířit. **Udělej to jednou pořádně:**
projekce ať nese i `createdAt`, délku, velikost, `server` a důvod blokace.

### T1 — Zapojit ukládání výsledku odeslání *(předpoklad T3)*

`applyServerProgress` existuje a nikdo ji nevolá. Zapoj ji — s ohledem na P1, P2, P3.

**Důkaz hotovosti:** test, který projde **celou cestou** odeslání přes atrapu serveru a ověří,
že hodnota je **v souboru fronty**. Test volající `applyServerProgress` přímo tuhle vadu
nenajde — takhle byla otestovaná celou dobu, co nefungovala.

### T2 — Převzetí nahrávky *(Danovo rozhodnutí 6: hned, ne nakonec)*

IPC kanál + tlačítko u konkrétní položky, které přepíše `ownerFingerprint` aktuálním otiskem.
Mantinel 2 a past P6 platí bez výjimky. V UI musí být vidět, že přebíráš nahrávku patřící
jinému účtu.

**Tímhle se odblokují ty tři nahrávky ze sekce 3** — je to jediná část zadání s okamžitým
užitkem pro uživatele.

Zvaž i druhou opravu: aby `prepareRecoveredRecording` otisk nastavovalo. Ale pozor — „vlastník
je snapshot z okamžiku nahrávání" je záměr, takže brát aktuální přihlášení při obnově **mění
pravidlo**. Je-li to podle tebe správně, **napiš to jako návrh do sekce 12 a nech rozhodnout
Dana.**

### T3 — Datová vrstva dashboardu

IPC kanál vracející spojený pohled: položky fronty + nahrávky na disku bez položky (včetně
duchů po retenci, viz sekce 5). Guard odesílatele povinný; `queue:retry` rozšířit i na
odesílatele `"settings"`.

### T4 — Ověření proti serveru

Pro položky se známým `recordingId` volej `GET /api/nahravky/uploads/{recordingId}` a porovnej.
Odpověď nese `state` (`"normalized"`/`"stored"` = hotovo), `missing`, `declaredBytes`, `sha256`.

🔴 **Ověřování nesmí běžet v pollingu.** Navrhni ho jako akci uživatele nebo jako ověření při
otevření obrazovky s výsledkem v mezipaměti a viditelným časem posledního ověření. **Napiš,
kam mezipaměť ukládáš** (a ať to není nové úložiště historie — rozhodnutí 5). **A spočítej,
kolik dotazů to v nejhorším za hodinu udělá** — nezapomeň na P1 (dvě stopy = dva dotazy).

### T5 — Zbylé akce a UI

„Poslat znovu" (per položka, viz sekce 3 — u vlastnických blokací je to no-op, tak to
uživateli neslibuj), „Smazat nahrávku" (nevratné → potvrzení; cesty z **`tracks`**),
„Otevřít složku" (`shell.showItemInFolder`, ověř, že cesta leží uvnitř adresáře nahrávek).
Obrazovka v Nastavení podle sekce 4.

### T6 — Vydání verze *(Danovo rozhodnutí 7)*

Viz sekce 11 — má vlastní pravidla a vlastní seznam toho, co potřebuješ od Dana.

---

## 9. Hotovo znamená

1. `npm run gates` zelené — **všechny čtyři brány**. Před PR ještě `npm run gates:clean`.
2. Každá nová funkce má test, který **selže, když ji rozbiješ**. Ověř to: zásah do
   implementace → test musí zčervenat. Tenhle repo má doloženou historii testů, které vadu
   **držely na místě** (test vyžadoval zakázanou hlavičku; test tvrdil, že `clientRecordingId`
   se rovná řetězci, který server odmítá; strop pumpy šel přepsat na 1000 a sada zůstala
   zelená). Test, který opisuje implementaci, není měřidlo.
3. Žádný nový IPC kanál bez kontroly odesílatele.
4. Mazání a převzetí mají potvrzení a jdou vždy jen na jednu konkrétní položku.
5. Sekce 12 je aktuální — včetně rozhodnutí, která jsi udělal za Dana.
6. V PR uveď: co jsi změnil, **co jsi neudělal a proč**, a kolik dotazů na server tvoje řešení
   v nejhorším za hodinu udělá.

---

## 10. Jak pracovat — git, brány, CI

**Git:**

- Větev z `main`. `AGENTS.md:14` chce prefix `feat/` · `fix/` · `docs/` — v posledních ~130 PR
  se to většinou nedodržuje a nekontroluje to žádná brána, takže je to zvyk, ne pravidlo.
- **Commit message anglicky, dokumentace a komentáře česky** (`AGENTS.md:8–9`).
- `main` **není chráněný** (ověřeno přes GitHub API), takže přímý push projde. **Ale zavedená
  praxe je PR + squash merge** — 140 PR, všechny takhle. Drž se jí.
- `AGENTS.md:16–20`: izolovanou práci zakládej v `.claude/worktrees/<účel>`, **jeden zapisovatel
  = jeden worktree**, po převzetí worktree odstraň a větev smaž.
- `AGENTS.md:24`: *„Cizí změny v pracovním stromě nevracej, nepřebírej ani neuklízej."*

**Brány:** `npm run gates` = `lint` → `typecheck` → `test:unit` → `preskocene`
(`package.json:76`). Výčet je **jediný** a hlídá to `tests/brany-workflow.test.js` — vydávací
workflow si ho kdysi opisoval zvlášť, rozešlo se to a vydání jelo o kontrolu chudší.
**Nevypisuj si vlastní seznam bran nikde.** `npm run gates:clean` pustí totéž nad čistým
klonem.

🔴 **`ui-smoke` a `audio-smoke` nespouštěj.** Potřebují GUI, zvuk a oprávnění Záznam obrazovky.
V CI jsou přítomné, ale trvale vypnuté (`if: ${{ false }}`, `.github/workflows/ci.yml:42–49`) —
**je to záměr** (`AGENTS.md:35–36`: *„V CI ani v sandboxu neběží; spouští je člověk na svém
Macu."*).

**CI:** `ci.yml` běží na `ubuntu-latest`, `npm run gates` + `npm run build`, ~75 s.
🔴 **Nepřesouvej ho na self-hosted runner.** Do 9. 9. 2026 běžel na Danově Macu a bylo to
zrušené z důvodu zapsaného v tom souboru (ř. 22–26): repo je veřejné, `pull_request` nemá
omezení, takže kdokoli si udělá fork, přidá soubor do `tests/` a jeho kód se spustí na stroji,
kde leží podpisový certifikát firmy a klíče k produkci.

**Zelenou CI čti přes `gh pr view --json statusCheckRollup`** — aspoň jeden check, všechny
`COMPLETED`/`SUCCESS`, hlavička PR na tvém posledním commitu. Prázdný seznam checků **není
slabší zelená, je to nezměřeno**. ⚠️ Vitest umí vypsat „N passed" a vedle toho řádek `Errors` —
čti oba.

---

## 11. T6 — Vydání verze

Dan chce, aby se to dotáhlo až k vydané verzi. Tady je stav, změřený 14. 9. 2026:

- `.github/workflows/release-macos.yml` se spouští **jen na tag `v*`**, běží na `macos-14`,
  sám podepíše i notarizuje. **Nikdy neproběhl** — v repu je **0 tagů a 0 releases**.
- Před buildem ověřuje, že tag odpovídá `v${package.json.version}` a že existuje pět tajemství
  (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY_P8`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`).
- `package.json:54–60` publikuje přes `provider: "generic"` na `https://stahnout.ludone.cz/desktop/`.
- 🔴 **Krok, který ten soubor nahraje, v repu není.** Žádné `scp`, `rsync`, `curl --upload`,
  S3 ani sftp. A `electron-builder` u providera `generic` s `--publish always` **mlčky neudělá
  nic** — neselže, jen nenahraje.
- `scripts/package-mac.mjs:133–135` naopak **správně shodí** publikaci nepodepsaného nebo
  nenotarizovaného buildu. Tuhle pojistku nech být.
- Aplikace auto-update **umí** (`main.cjs:3180`, `electron-updater`, včetně pojistky proti
  restartu uprostřed nahrávání).

**Co po tobě chci:** postavit ten chybějící nahrávací krok do `release-macos.yml` a upravit
`tests/packaging.test.js`, který tvar publikace kontroluje.

🔴 **Co NEMŮŽEŠ udělat sám a musíš si vyžádat od Dana** — napiš mu to do sekce 12 a pokračuj
zatím na tom, co na tom nezávisí:

1. **Jak se na `stahnout.ludone.cz` nahrává** — SSH/rsync? S3-kompatibilní úložiště? nginx
   s tokenem? Bez odpovědi si to nevymýšlej; špatná volba znamená vyhozenou práci.
2. **Přístupové tajemství k tomu serveru** jako GitHub Secret. **Ty ho nikdy neuvidíš a nesmíš
   o něj žádat v textu** — Dan ho nastaví sám přes `gh secret set`.
3. **Jestli je pět podpisových tajemství už nastavených.** Bez nich workflow spadne hned na
   startu. To si ověří Dan, ne ty.

⚠️ **Tag pushuje Dan, ne ty.** Vydání je nevratné a vidí ho celý tým; tvoje práce končí tím,
že je cesta hotová a ověřená nasucho.

---

## 12. Stav práce — tohle udržuj ty

> **Aktualizace 15. 9.:** PR #141 je sloučený a 0.1.2 vydaná i nainstalovaná. Starší formulace „čeká na vydání“ níže jsou historické. Oprava retry a schválené upozornění na update se připravují pro 0.1.3; aktuální stav je ve [STAV.md](STAV.md).

Dan bude projekt otevírat opakovaně a říkat „pokračuj v práci". **Nemáš paměť mezi běhy —
pamatuje za tebe tenhle soubor.** Úkol není hotový commitem kódu, ale commitem kódu **plus
zápisem sem**. Piš pravdu včetně toho, co nevyšlo.

Aktuální implementační větev je `feat/nahravky-dokonceni`, [draft PR #141](https://github.com/Make-more-s-r-o/ludone-desktop/pull/141). Strojový stav a historie jsou v [masterplánu](progress/index.html); navazující práce je v [STAV.md](STAV.md).

| úkol | stav | commit / PR | poznámka |
|---|---|---|---|
| T0 — rozšířit povrch fronty | 🧪 integrováno, testy zelené | PR #141 | Bezpečná projekce metadata a serverových ID; neznámé hodnoty zůstávají null. |
| T1 — uložit recordingId | 🧪 integrováno, testy zelené | `fdb4535`, `53ca859` | Per-track ID/session/progress se uloží před dalším HTTP krokem; restart otestován na dočasném disku. |
| T2 — převzetí nahrávky | 🧪 integrováno, testy zelené | `a25bd5c` | Jednotlivé potvrzení a čerstvá identita/revize/odesílatel; samo nic neodešle. Root ověřil 440 dotčených testů. |
| T3 — datová vrstva dashboardu | 🧪 integrováno, testy zelené | `0b3f36b` | Queue + primární manifesty, ghost/partial/invalid stavy, bez cest a sítě. Root plná brána: 1388 zelených testů, tři původní skipy, exit 0. |
| T-R1 — limity serveru | 🧪 integrováno, testy zelené | `0addac6` | Trvalý 429 cooldown, zachování attempts, restart a oddělení časových položek. Root plná brána: 1401 zelených testů, tři původní skipy, exit 0. |
| T4 — ověření proti serveru | 🧪 integrováno, testy zelené | `9b233c8` | Ruční GET známých ID, per-track shoda, 60s cache a 30 GET/h procesu. Root brána 1433 PASS, tři původní skipy, exit 0; nezávislé review bez doložených P1/P2. |
| T5 — zbylé akce a UI | 🧪 integrováno, čistý klon zelený | `e225880`, `eefc259`, PR #141 | Per-item souhlas, automatika nových nahrávek, obnova retry, název, koš, Finder a přímé Nastavení bez loginu. Finální čistý klon 1505 PASS; původní CI chyby opravené, historie je v STAV.md. |
| T-A1 + T-A2 — auth | 🧪 integrováno, testy zelené | `f9dd296`, `ccb47e7`, `445fe9f` | Finder default upload scope a výhradní userinfo identita; poslední root auth sady 87/87. |
| T-A3 + T-A4 — firma uploadu | 🧪 integrováno, testy zelené | `0340c8e`, `c25ef2a` | Výběr firmy v Nastavení, vazba na relaci a trvalá firma před prvním INIT. Restart i změna globální firmy zachovají původní upload. |
| T6 — vydání verze | 🧪 kód připraven; 🟡 publikace čeká | PR #141 | Verze 0.1.2, podpis/notarizace vložené aplikace, metadata a atomická SSH publikace s veřejnou HTTPS kontrolou. Čeká konfigurace, záloha klíče, Danův tag a skutečná přejímka. |

Stavy dle AGENTS.md: ✅ ověřeno naostro · 🧪 zelené testy · ⛔ neověřeno · 🟡 podmíněně platné nebo čekající na uvedené ověření · ⚠️ varování. Nic v této tabulce nedokládá skutečný zvuk nebo produkční upload.

### T2 — integrační poznámka pro T5

Převzetí nastaví bezpečný lokální hold přes `requiresHumanAction` a důvod „Převzatá nahrávka
čeká na volbu odeslání“. Integrované T5 přidává výslovné rozhodnutí o uploadu (`held` → schváleno);
samotné převzetí vlastnictví nesmí tento hold odstranit ani spustit pumpu. Malé okno Nastavení
zůstalo 448 × 676 bodů, protože pět záložek i kompaktní seznam se do něj vejdou bez změny
rozměrů.

### Auth packaged aplikace — větev `fix/nahravky-prihlaseni`

🧪 **Auth je po review integrovaný (`f9dd296`, `ccb47e7`); T-A2 v `445fe9f` navíc odstranil fallback tokenové identity při chybě či neúplném userinfo.** Packaged aplikace bez shellových proměnných nově žádá samostatný scope
`nahravky:upload` a identitu výhradně z `userinfo` stejného issueru. Stará relace se scope
`mcp:read` zůstane zachovaná do úspěšného interaktivního přihlášení, ale hlavní proces ji
nepustí do identity, otisku vlastníka ani uploadu; nový login ji atomicky přepíše a kvůli
neshodě issuer/resource/scope provede novou dynamickou registraci.

`invalid_client` z token endpointu i z validovaného loopback callbacku zneplatní právě
odpovídající uloženou relaci. Kód pak nepoužije starý refresh token znovu a nespouští
automatický login; nový klient vznikne až při dalším výslovném přihlášení člověka. OAuth
chybové kódy jdou do zprávy jen přes pevný allowlist, `error_description` ani neznámý
`body.error` se do UI či logu nepropíše.

`premisaPlatila`: ano — bez env přepínače běžel starý scope a pouhá shoda issueru stačila,
aby se stará relace tvářila jako přihlášená. `kontrolniNula`: žádný nový IPC kanál, žádný
zásah do LuTracku, serveru nebo designu a žádné ostré přihlášení. Doslovný výpis `npm run
gates` s exit kódem 0 je v `dukazy/nahravky-dashboard-2026-09-14/auth/REPORT.md`.

Samotná etapa auth ještě transport nezapínala. **Integrované T5 už podle D11 zpřístupňuje
ruční odeslání bez shellových proměnných.** Přepínač v Nastavení řídí pouze automatiku
nových nahrávek; explicitní `DESKTOP_UPLOAD_ENABLED=false` nebo vadná hodnota transport blokuje.

### T6 — kde práce skončila 14. 9. 2026

Read-only dohledání v `LuDone/DAN-TODO.md:1311–1318,15643–15655` našlo dříve zvolený
transport: `scp` stávajícím klíčem. Živý vhost dnes čte provizorní adresář
`/opt/makemore-data/nginx/hub/stahnout/desktop/`; původně navržená cesta
`/opt/makemore-data/stahnout/desktop/` nevznikla. Workflow proto přijímá cílovou cestu
výslovně přes `DOWNLOAD_SSH_PATH` a žádnou si tiše nedosazuje.

Release workflow je integrovaný v PR #141 včetně veřejné kontroly `2499dbb`:
vyrobí metadata a blockmapy,
ověří jejich velikosti a hashe, zkontroluje skutečný Developer ID podpis, stapling a Gatekeeper,
uloží sadu do GitHub Actions ke kontrole a teprve potom ji přenese do dočasného adresáře.
Na serveru znovu ověří SHA-256, přesune verzované soubory a `latest-mac.yml` zveřejní poslední
atomickým přejmenováním. Připnutý `known_hosts` je povinný; `ssh-keyscan` se nepoužívá.

🟡 **T6 není hotové ani vydané.** Pět Apple secrets sice podle dřívějšího měření existuje,
ale v repozitáři není doložené, že `.p12` má zálohu ve firemním správci hesel. Workflow se proto
zastaví před prvním použitím klíče, dokud není repo variable
`MAC_SIGNING_KEY_BACKUP_CONFIRMED=true`. Verze je v integračním commitu `5259d57` koordinovaně zvýšená
z `0.1.1` na `0.1.2`. Dále čeká vytvoření SSH variables/secrets podle
[`T6-VYDANI.md`](T6-VYDANI.md), Danův tag a ostrý test instalace i aktualizace. Aktuální
`0.1.1` už na feedu leží; stejnou verzi s jiným obsahem workflow odmítne přepsat.

### Viditelná automatická aktualizace — větev `fix/nahravky-prihlaseni`

🧪 **Stav dostupnosti a stahování je integrovaný v `14e9d6f`, důkazy v `0e1589a`.**
Zabalená aplikace dál kontroluje vydání automaticky po startu a každých šest hodin. Panel
nově převezme z události `update-available` bezpečně omezenou verzi, oznámí dostupnost a při
`download-progress` ukáže skutečné celé procento z `electron-updater`. Po dokončení zůstává
dosavadní hláška o stažené verzi. Pořadové číslo stavu dál brání tomu, aby opožděný počáteční
snapshot přepsal novější živou událost.

Bezpečnostní brána instalace se nezměnila: restart dál čeká na konec nahrávání, dokončení
uložení, LuTrack, serializační bariéru odchozí fronty a nezměněnou generaci aktivity. Nevznikl
nový IPC kanál, ruční restart ani tlačítko kontroly; metadata verze se před logem a rendererem
omezují na běžný krátký tvar a procento se zaokrouhlí a omezí na rozsah 0–100.

`premisaPlatila`: ano — hlavní proces dosud publikoval jen staženou verzi a opakované selhání,
takže uživatel během automatického stažení neviděl dostupnost ani průběh. `kontrolniNula`:
žádný zásah do auth, LuTracku, fronty, backendu, vydávacího workflow ani designu a žádná živá
aktualizace. Zaměřená sonda main → skutečný preload/IPC → React i celé `npm run gates` skončily
s exit kódem 0; doslovné výpisy jsou v
`dukazy/nahravky-dashboard-2026-09-14/updater/REPORT.md`.

### Původní otázka na zapnutí uploadu — vyřešena vloženým goalem

T5 převzato 15. 9. z `e225880`: root plná brána 1469 PASS a tři původní skipy, exit 0. Obě volby po nahrávání, trvalý název/consent, per-item send/retry, obnovený retry timer, koš/reveal a přímé Nastavení jsou integrované. Nezávislé review potvrdilo opravy duplicitního manifestu a sdíleného audia. Jde o 🧪, skutečný zvuk a produkční upload čekají na Mac.

15. 9. navíc potvrzeno D15: účet s více firmami neměl v aplikaci výběr firmy a vyžadoval terminálovou proměnnou. T-A3 (`0340c8e`) připravil bezpečný selector a atomický zápis firmy; root plná brána 1452 PASS a tři původní skipy, exit 0. T-A4 (`c25ef2a`) už zapojilo Nastavení a ochranu inicializovaných uploadů; root plná brána 1503 PASS, následný společný čistý klon s I1 1505 PASS. Funkce není vydaná ani živě ověřená.

Dan 14. 9. výslovně schválil dokončení přihlášení a odesílání z Finderu i volitelnou automatiku. Rozhodnutí D3/D10/D11 nahrazují dřívější odložení přepínače: T-A1 zapnul odpovídající scope a zdroj identity společně. T5 zpřístupňuje manuální odeslání schválené položky bez shellového nastavení; uložený přepínač řídí pouze automatiku nových nahrávek. Explicitní false/invalid transportní proměnná zůstává tvrdou stopkou. Další souhlas s tímto rozsahem se nevyžaduje.

Pro veřejné vydání stále chybí potvrzení zálohy klíče a publikační GitHub konfigurace. Starý updater z 0.1.1 může ověřit doručení 0.1.2; nové zobrazení dostupné verze/průběhu v 0.1.2 vyžaduje budoucí Danem schválenou vyšší verzi. Podrobný krátký postup je v [OVERENI-NA-MACU.md](OVERENI-NA-MACU.md).

**Když skončíš běh uprostřed**, dopiš pod tabulku „Kde jsem skončil": co je rozdělané, v jaké
větvi, co jsi zkoušel, co je další krok.

**Rozhodnutí za Dana i otázky na něj zapisuj sem** — jedním řádkem, co a proč. Tichý default
je vada.

---

## 13. Pasti tohohle repa

- **`tracks` × `trackPaths`** — nejdražší záměna v projektu (sekce 5).
- **`net.fetch` (Electron/Chromium) × `globalThis.fetch` (Node)** se chovají různě. Chromium
  odmítne zakázané hlavičky (`Content-Length`) chybou `net::ERR_INVALID_ARGUMENT` **před
  odesláním** a protistrana nemá co zaznamenat; Node je propustí. Upload jede přes `net.fetch`.
  **Nepřidávej hlavičky ručně.** Chybám z Chromia navíc chybí `code` i `cause` — příčina je
  jen v textu.
- **Dokumentace v `docs/server-modul/` je ZASTARALÁ.** Popisuje `POST /api/desktop/recordings`,
  `PUT …/tracks/{kind}`, `POST …/complete` — **takové routy neexistují.** Platí
  `/api/nahravky/uploads`; jediný zdroj pravdy je kód. `KONTRAKT.md §7` (ř. 119–150) to sám
  přiznává, zbytek dokumentu ne.
- **Aplikace má jednoinstanční zámek** — druhá instance start vůbec nerozjede.
- **`pgrep -f <cesta>` chytá i vlastní shell skripty**, které tu cestu mají v příkazu.
- **macOS nemá `timeout`** (`AGENTS.md:42`). Stav příkazu měř **před** rourou.
- **Odesílání je za přepínačem** `DESKTOP_UPLOAD_ENABLED`; bez něj se nic neposílá.

---

## 14. Jak pracovat — obecně

- Když narazíš na něco, co jde vyřešit jen změnou serveru, **zastav se a napiš to** (mantinel 1).
- Když najdeš, že tohle zadání někde neodpovídá kódu, **věř kódu a rozpor pojmenuj** —
  podklady jsou měřené 14. 9. 2026 a repo mezitím žije.
- Když si nejsi jistý produktovým rozhodnutím, **zvol variantu, zapiš ji do sekce 12
  a pokračuj**. Neblokuj celou práci kvůli jedné otázce — kromě těch, které sekce 11 výslovně
  označuje jako otázky na Dana.
- Hotovou práci **commitni a pushni**. Netrackovaný soubor na konci běhu je vada, ne stav.
