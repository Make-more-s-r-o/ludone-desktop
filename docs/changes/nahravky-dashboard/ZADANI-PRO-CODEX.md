# Dashboard nahrávek — zadání pro Codex

**Pro koho:** externí vývojář (Codex / GPT) pracující **jen na téhle desktopové aplikaci**.
**Repo:** `Make-more-s-r-o/ludone-desktop`, větev `main`.
**Zadal:** Dan Jirotka, 14. 9. 2026. **Podklady:** změřeno čtením kódu téhož dne, ne z paměti.

---

## 0. Co se staví a proč

LuDone Desktop nahrává schůzky a odesílá je do LuDone. Odesílání **poprvé v historii projektu
prošlo 11. 9. 2026** — do té doby ho držely dvě vady v kontraktu, které nikdo neviděl, protože
požadavek vůbec neopustil počítač. Dnes to funguje, ale **uživatel nemá jak zjistit, co se
s jeho nahrávkami stalo.** Panel v liště ukáže jen „N čeká na odeslání".

Tři nahrávky teď stojí ve frontě zablokované a **aplikace nenabízí jediný způsob, jak je
odblokovat** — chybí IPC kanál i tlačítko (sekce 3).

**Cíl:** obrazovka v Nastavení, kde uživatel vidí každou svou nahrávku, její skutečný stav
včetně toho, co o ní ví server, a může s ní něco udělat.

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
   Ani v testech, fixturách nebo commit message.
6. 🔴 **Nikdy necommituj zvuk ze skutečné schůzky.** Fixtury generuj, nekopíruj z dat uživatele.
7. **Testy mají síť zakázanou globálně** (`tests/setup-no-network.js`). **Zákaz neobcházej** —
   kdo si `fetch` nezamockuje, dostane právem červenou. Vznikl proto, že testovací sada
   posílala na ostrý server 6 neúspěšných přihlášení na běh a čerpala tím uživateli limit.
8. **Nemaž ani nepřepisuj data fronty** mimo akce, které si uživatel vyžádá kliknutím.

---

## 2. Danova rozhodnutí (zadání, ne návrh)

| # | otázka | rozhodnutí |
|---|---|---|
| 1 | Kde dashboard žije | **Samostatná obrazovka v Nastavení.** Ne v panelu z lišty. |
| 2 | Zdroj pravdy | **Ptát se serveru a porovnávat** — ukázat skutečný rozdíl „lokálně × v LuDone", ne jen to, co si fronta myslí. Čtení, žádný zápis. ⚠️ Sekce 6 říká, kolik z toho dnes jde. |
| 3 | Akce u položky | **Převzít pod svůj účet · Poslat znovu / zkusit teď · Smazat nahrávku · Otevřít složku se souborem.** Všechny čtyři **vidět v UI**. |
| 4 | Rozsah UI | **Volná ruka včetně Nastavení** — smíš přepracovat i stávající panel. |

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
| `src/features/queue/QueueCard.jsx:117–135` | pouhý text `role="alert"`, **žádné tlačítko** |

**Kořen je hlouběji než v UI.** `prepareRecoveredRecording` (`electron/queue.cjs:458–565`)
vrací objekt `{ manifest, manifestPath, trackPaths, recoveredIncomplete?, sourceManifestPath? }`
— **pole `ownerFingerprint` v něm vůbec není.** `recoverOrphanedRecordings`
(`electron/queue.cjs:581–674`) ho předá do `enqueueRecording` (`:780–794`), kde
`addOwnerToNewRecording` normalizuje `undefined` na **`null`**. Při odeslání pak
`requireMatchingQueueOwner` (`electron/upload-client.cjs:423–447`) vrátí `queue_owner_unknown`
a **nemá to s čím porovnat** — žádné další přihlášení to nespraví.

`retryFailedItem` (`src/lib/queue.js:358–389`) navíc **výslovně odmítá** tuhle blokádu obejít
u položek se `selhalo` a důvodem `queue_owner_*` (komentář na ř. 366–369). Je to záměr.

Tři reálné zablokované nahrávky uživatele:

| nahrávka | délka | důvod | pomůže přihlášení? |
|---|---|---|---|
| `594223df` | 27 min | otisk prázdný po obnově (`queue_owner_unknown`) | ❌ není co porovnat |
| `8087dd1a` | 64 min | otisk **jiného účtu** (`queue_owner_mismatch`) | ❌ potřebuje převzetí |
| `53ab63fc` | 2 m 47 s | otisk **jiného účtu** (`queue_owner_mismatch`) | ❌ potřebuje převzetí |

---

## 4. Mapa aplikace — UI vrstva

**Žádný framework navíc.** Bez Tailwindu, bez komponentní knihovny, bez CSS-modules.
Jeden globální stylesheet `src/styles.css` (2 603 řádků) s CSS proměnnými v `:root`
(ř. 52–94): `--panel-page`, `--panel-card`, `--panel-accent`, `--panel-ok`, `--panel-wait`,
`--panel-bad`, `--radius-window: 26px`, `--radius-inset: 18px`, `--radius-control: 10px`.
Barvy v `oklch()`, měkké varianty přes `color-mix(in oklab, …)`. **Nové barvy nevymýšlej.**

**Tři okna, jeden bundle.** `index.html` načítá `src/main.jsx`, ten podle
`window.location.hash` vybere root komponentu:

| okno | hash | komponenta | kde se vytváří |
|---|---|---|---|
| panel v liště | (žádný) | `App.jsx` | `electron/main.cjs:967` |
| **Nastavení** | `#settings` | `SettingsApp` ze `src/components/Settings.jsx` | `electron/main.cjs:1051`, `loadFile(…, { hash: "settings" })` ř. 1084, okno **448×676** (ř. 1058–1064) |
| varování o liště | `#tray-space-warning` | `TraySpaceWarning.jsx` | `electron/main.cjs:734` |

⚠️ **Okno Nastavení je 448 px široké a pevné.** Dashboard se musí vejít do téhle šířky, nebo
je součástí zadání okno zvětšit — rozhodni a **napiš, cos zvolil**; tabulka o sedmi sloupcích
se sem nevejde.

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

⚠️ **Kolize názvů:** záložka `recordings` („Záznamy") už existuje a řeší **lokální retenci** —
jak dlouho se soubory drží na disku. Dashboard je něco jiného. Rozhodni, jestli je to pátá
záložka vedle ní, nebo jestli se obě slijí; **uživatel nesmí mít v Nastavení dvě různé věci
se stejným jménem.**

**Jak přidat sekci:** (a) záznam do `SETTINGS_TABS`, (b) nový `<section role="tabpanel">`.
Obsah **vytáhni do vlastní komponenty** a jen ji naimportuj — vzor je `SettingsAudioTest`
(`src/components/SettingsAudioTest.jsx`). Devět set řádků v jednom souboru stačí.

**Panel v liště** (`src/features/**`): `queue/QueueCard.jsx` · `recording/RecordingCard.jsx`,
`AudioLevelMeter.jsx`, `microphone-only-capture.js`, `recording-copy.js`,
`system-audio-health.js` · `tracking/TrackingCard.jsx`. Skládá je `src/App.jsx`.
`QueueCard` je čistě prezentační — dostane `items`, `onRetry`, `onRetryFeedback`,
`retryError` (ř. 39); odvozená čísla počítá `queuePanelSummary()` z `src/lib/panel.js`.

**Jak renderer čte data: pollingem, ne událostí.** `App.jsx:39` drží `queueSnapshot`,
`refreshQueueStatus()` (ř. 172–191) volá `window.ludone.listQueue()`, a `useEffect`
(ř. 226–245) to opakuje rekurzivním `setTimeout` každou **1 s**
(`QUEUE_REFRESH_INTERVAL_MS`, ř. 11) — vždy až po dokončení předchozího dotazu. Navíc
okamžitý refresh na `visibilitychange` (ř. 207–217) a při změně
`recording.active`/`tracking.active` (ř. 219–223).

🔴 **Tenhle vzor na dashboard NEPŘEBÍREJ beze změny.** Sekundový polling je v pořádku pro
kartu v panelu; na obrazovce, která se navíc ptá serveru, by znamenal dotaz na server každou
vteřinu — a limity jsou tvrdé (sekce 6). Pro srovnání: přihlášení jede na skutečné události
(`window.ludone.onAuthSessionChanged`, `App.jsx:108`), takže obě cesty jsou v repu zavedené.

**Jediný most renderer ↔ main** je `electron/preload.cjs:130`
(`contextBridge.exposeInMainWorld("ludone", { … })`). Co tam není, renderer nemá.

**Texty česky natvrdo v JSX**, žádné i18n. Jediná pomůcka je skloňování počtu —
`countLabel(count, singular, few, many)` v `src/lib/count-label.js`. **Piš česky**
(`AGENTS.md`: dokumentace a komentáře česky, commit message anglicky).

**Testy UI:** Vitest, `environment: "node"`, **žádné `@testing-library/react`**. Testy leží
v `tests/*.test.js`. Dva zavedené vzory:

- **plné mountování s interakcí** — `tests/settings.test.js`: ruční `new JSDOM(…)`,
  `createRoot().render()` uvnitř `React.act(async …)`, `window.ludone` jako mock, klik přes
  `button.click()`, assert na mock;
- **statický markup** — `tests/queue-card-labels.test.js`: `renderToStaticMarkup(<QueueCard …/>)`
  obalený do `new JSDOM(markup)`.

Dashboard s tlačítky patří k prvnímu vzoru.

---

## 5. Mapa aplikace — data

**Kde co leží** (vše z `app.getPath("userData")`, nic natvrdo):

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

Přechody stavu manifestu (`transitionManifest`, ř. 87–100) jen `recording → complete` nebo
`recording → incomplete`. Zápis atomicky (temp + fsync + rename, ř. 132–150).

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
v mezitvaru z `prepareRecoveredRecording`. Záměna těch dvou polí už jednou smazala
32 manifestů a nechala 57 audio souborů ležet — tedy smazala **to, podle čeho se nahrávka
pozná**, a data nechala. Napiš si to za uši u každé akce, která sahá na soubory.

**Stavy a jejich význam** (`processNext`, `src/lib/queue.js:444–580`):

| výsledek | co se stane |
|---|---|
| úspěch | `odeslano`, `nextAttemptAt: null` |
| `permanent` | `selhalo`, konec |
| `paused` | zůstává `ceka`, **`attempts` se NEinkrementuje**, nastaví se `requiresHumanAction` |
| `retryable` | `attempts >= maxAttempts` → `selhalo`; jinak `ceka` + `nextAttemptAt = teď + odklad` |

Pole `pausedReason` **neexistuje** — důvod nese `lastFailureReason` (text) + boolean
`requiresHumanAction`. Autoritativní klasifikace je `queueItemRequiresHumanAction`
(`src/lib/queue.js:181–184`); používá ji projekce, pumpa i ruční retry. **Dashboard ať čte
tuhle funkci, nepíše si vlastní podmínku** — třetí kopie téže logiky by se rozešla.

Retry policy (`src/lib/queue.js:29–34`): `baseDelayMs: 30 s`, `maxDelayMs: 6 h`,
`maxAttempts: 5`, `jitterRatio: 0.2`. `Retry-After` ze serveru má přednost
(`odkladPoSelhani`, ř. 414–420).

Pumpa (`electron/queue.cjs:829–846`) posílá nejvýš **20 položek na jedno probuzení**
(`MAX_POLOZEK_NA_JEDNU_PUMPU`, ř. 827) a pokračuje jen po `outcome === "sent"`.

**Otisk vlastníka** (`deriveQueueOwnerFingerprint`, `electron/queue.cjs:80–112`):
HMAC-SHA256 nad `["cz.ludone.desktop","queue-owner","v1", issuer, "email", email]`,
tajemství ≥32 B, výstup `"sha256:<hex64>"`. Snímá se **při startu nahrávání**
(`main.cjs:1488`) — tedy je to snímek okamžiku pořízení, ne aktuálního přihlášení.
Aktuální otisk pro porovnání dá `readCurrentQueueOwnerFingerprint()` (`main.cjs:2242–2254`).

**Kompletní IPC povrch dnes** má 50 kanálů; pro tebe jsou podstatné `queue:list`
(`main.cjs:2540`) a `queue:retry` (`main.cjs:2548`), vystavené v `preload.cjs:193–194`.

🔴 **Každý nový IPC kanál musí projít kontrolou odesílatele.** V repu na to je
`handleValidated`/`onValidated` (`main.cjs:300–321`) a celá testovací sada
`tests/ipc-sender-guard.test.js` (21 testů). `AGENTS.md:53–54` říká, že přihlášení, tokeny,
idempotence fronty a **kontrola odesílatele IPC** vyžadují review nad diffem. Kanál bez
guardu je bezpečnostní vada, ne opomenutí.

**Testy, které se tě dotknou:**

| soubor | testů | co drží |
|---|---|---|
| `tests/queue.test.js` | 69 | logika fronty, vlastnictví (ř. 206), stavový automat (657), obnova osiřelých (1467) |
| `tests/queue-wiring.test.js` | 252 | zapojení do `main.cjs`, produkční fronta (3795) |
| `tests/upload-client.test.js` | 46 | kontrakt uploadu, vlastník před odesláním (230) |
| `tests/ipc-sender-guard.test.js` | 21 | ochrana IPC |
| `tests/settings.test.js` | — | vzor pro UI test s interakcí |

**Brány** (`package.json`): `npm run gates` = `lint` (eslint) → `typecheck`
(`tsc --noEmit -p jsconfig.json`) → `test:unit` (`vitest run`) → `preskocene`
(hlídá, aby nerostl počet přeskočených testů). **Musí projít všechny čtyři** — v tomhle repu
každá chytá jinou třídu vad a je to doložené: `tsc` našel chybu, kterou 1 305 zelených testů
propustilo, a `eslint` nedosažitelný `return`, který přežil 1 289 testů.

---

## 6. 🔴 NÁLEZ: porovnání se serverem dnes nejde postavit celé

**Tohle je nejdůležitější věta celého zadání. Přečti ji dřív, než začneš plánovat.**

Aplikace volá na server právě pět cest (`electron/upload-client.cjs`, `electron/companies.cjs`):

| # | metoda + cesta | k čemu | limit |
|---|---|---|---|
| 1 | `POST /api/nahravky/uploads` | založení uploadu jedné stopy (idempotentní) | **30/h** |
| 2 | `GET /api/nahravky/uploads/{recordingId}` | stav **jedné konkrétní** nahrávky | **120/h** |
| 3 | `PUT …/{recordingId}/casti/{index}` | část obsahu | 300/h |
| 4 | `POST …/{recordingId}/dokoncit` | dokončení | 30/h |
| 5 | `GET /api/nahravky/uploads/firmy` | seznam firem | bez limitu |

**Co chybí:** neexistuje endpoint, který by vypsal nahrávky uživatele, ani takový, který by
odpověděl na dotaz podle `clientRecordingId`. Stav se dá zjistit **jen podle `recordingId`,
které přiděluje server** — a to aplikace zná pouze bezprostředně po vlastním init volání.

**A druhá půlka problému je u nás:** funkce, která to `recordingId` má uložit
(`applyServerProgress`, `src/lib/queue.js:342–356`), **není odnikud volaná**. Je hotová
i otestovaná (`tests/queue.test.js:1014–1039`), ale v `electron/*.cjs` ji nevolá nikdo, takže
`server.recordingId` zůstává `null` i u nahrávek, které na serveru bezpečně leží.

**Limity, na které se nesmí zapomenout** (změřeno serverovým týmem v jejich kódu, commit
`1b07fad7`, 11. 9. 2026):

- **Klíčem je UŽIVATEL**, ne IP ani token — uživatel čerpá **jeden strop webem i desktopem**.
- **Okno je pevné (3 600 s od prvního požadavku), ne klouzavé**, a počítadlo drží databáze,
  takže restart serveru ho nevynuluje.
- **Počítá se každé volání včetně idempotentního opakování.**
- Neúspěšné ověření tokenu má vlastní strop **30/min na IP a sdílí ho s `/api/mcp`** —
  rozbitá session hnaná přes celou frontu shodí uživateli i MCP.

### Co z toho plyne pro zadání

**„Zeptat se serveru" jde jen u nahrávek, u kterých známe `recordingId`.** Proto:

- **T1 níž (uložit `recordingId`) je předpoklad, ne vylepšení.** Bez něj je porovnání
  postavitelné pouze tak, že se na server pošle **zapisující** init se stejným
  `Idempotency-Key` — což stojí stejný rozpočet jako skutečné odeslání (30/h), vyžaduje mít
  po ruce celý soubor a jeho hash, a při sebemenší neshodě metadat vrátí `idempotency_conflict`.
  **Tudy nechoď.**
- U **starých** nahrávek (odeslaných před T1) `recordingId` nikde není a už nevznikne.
  Dashboard u nich musí poctivě říct **„na serveru neověřeno"** — ne je přebarvit na zelenou
  podle toho, že fronta říká `odeslano`. Tohle je přesně ta třída omylu, kvůli které Dan
  porovnání se serverem chce.
- **Chybějící endpoint pro výpis / dotaz podle `clientRecordingId` je nález pro serverový
  tým, ne práce pro tebe.** Zapiš ho do reportu a jdi dál.

---

## 7. Plán práce

Pořadí je závazné — T1 je předpoklad T3. Každý bod je samostatný commit s vlastními testy.

### T1 — Zapojit ukládání výsledku odeslání *(předpoklad všeho ostatního)*

`applyServerProgress` (`src/lib/queue.js:342–356`) existuje a je otestovaná, ale nikdo ji
nevolá. Zapoj ji tak, aby se po úspěšném odeslání uložilo `server.recordingId` a
`server.uploadedBytes`; z odpovědi čti i pole `idempotent`, které dnes ignorujeme.

**Důkaz hotovosti:** test, který projde celou cestou odeslání přes atrapu serveru a ověří,
že se hodnota **v souboru fronty** objevila. Test volající jen `applyServerProgress` přímo
tuhle vadu nenajde — ta funkce byla takhle otestovaná celou dobu, co nefungovala.

### T2 — Datová vrstva dashboardu (main proces)

Nový IPC kanál, který vrátí **spojený pohled**: položky fronty + nahrávky ležící na disku,
které ve frontě nejsou. Na položku aspoň: identifikátor, kdy vznikla, délka/velikost, stav
fronty, `requiresHumanAction` a lidsky čitelný důvod, jestli známe `server.recordingId`,
a cesty k souborům pro akci „otevřít složku".

**Guard odesílatele je povinný** (`handleValidated`, `main.cjs:300–321`).

### T3 — Ověření proti serveru

Pro položky, kde známe `recordingId`, volej `GET /api/nahravky/uploads/{recordingId}`
a porovnej se stavem fronty. Odpověď nese `state` (`"normalized"` / `"stored"` = hotovo),
`missing` (chybějící části), `declaredBytes`, `sha256`.

🔴 **Ověřování nesmí běžet v pollingu.** Rozpočet je 120 dotazů na hodinu **sdílený s webem**.
Navrhni to jako **akci uživatele** (tlačítko „Zkontrolovat proti LuDone") nebo jako ověření
při otevření obrazovky s výsledkem uloženým do mezipaměti a viditelným časem posledního
ověření. **Do zadání napiš, cos zvolil a kolik dotazů to v nejhorším udělá.**

Tři možné výsledky, tři různá sdělení: **je tam** · **není tam** · **nevíme** (chybí
`recordingId`, nedosáhli jsme na server, došel limit). Třetí se nesmí tvářit jako první.

### T4 — Čtyři akce u položky

| akce | co dělá | na co pozor |
|---|---|---|
| **Převzít pod svůj účet** | přepíše `ownerFingerprint` položky aktuálním otiskem (`readCurrentQueueOwnerFingerprint()`) a položka jde normální cestou | 🔴 jen u konkrétní položky, jen na klik, **nikdy hromadně**; v UI musí být vidět, že přebíráš cizí nahrávku, a u koho vznikla |
| **Poslat znovu / zkusit teď** | vyvolá pokus u jedné položky | dnešní `queue:retry` pracuje nad frontou jako celkem; tohle je per-položka |
| **Smazat nahrávku** | odstraní položku fronty, manifest **i audio soubory** | 🔴 nevratné → potvrzovací dotaz; cesty ber z **`tracks`**, ne z `trackPaths` |
| **Otevřít složku se souborem** | `shell.showItemInFolder` | ověř, že cesta leží uvnitř adresáře nahrávek — neotevírej, co přijde z rendereru bez kontroly |

Převzetí je zároveň jediná cesta, jak vyřešit `queue_owner_unknown` u obnovených nahrávek
(sekce 3). **Zvaž i druhou opravu:** aby `prepareRecoveredRecording` otisk vůbec nastavoval —
ale pozor, „vlastník je snapshot z okamžiku nahrávání" je záměr, takže převzít otisk
aktuálního přihlášení při obnově **mění pravidlo**. Je-li to podle tebe správně, **napiš to
jako návrh a nech to rozhodnout Dana**, neprosaď to potichu.

### T5 — UI

Obrazovka v Nastavení podle sekce 4. Volná ruka včetně přepracování panelu — ale co dnes
funguje (lišta, nahrávání, stavy), musí fungovat dál.

---

## 8. Hotovo znamená

1. `npm run gates` zelené — **všechny čtyři brány**, ne jen testy.
2. Každá nová funkce má test, který **selže, když ji rozbiješ**. Ověř to: zásah do
   implementace → test musí zčervenat. Tenhle repo má doloženou historii testů, které
   **držely vadu na místě** (test vyžadoval zakázanou hlavičku; test tvrdil, že
   `clientRecordingId` se rovná řetězci, který server odmítá; strop pumpy šel přepsat na 1000
   a sada zůstala zelená). Test, který jen opisuje implementaci, není měřidlo.
3. Žádný nový IPC kanál bez kontroly odesílatele.
4. Mazání a převzetí mají v UI potvrzení a jdou vždy jen na jednu konkrétní položku.
5. V reportu uveď: co jsi změnil, **co jsi neudělal a proč**, kolik dotazů na server tvoje
   řešení v nejhorším za hodinu udělá, a každou věc, kterou jsi musel rozhodnout za Dana.

---

## 9. Pasti tohohle repa (ušetří ti to kolo)

- **`tracks` × `trackPaths`** — viz sekce 5. Nejdražší záměna v projektu.
- **Fronta má dvě čtení „potřebuje člověka"** — používej `queueItemRequiresHumanAction`,
  nepiš si třetí.
- **`net.fetch` (Electron/Chromium) × `globalThis.fetch` (Node)** se chovají různě. Chromium
  odmítne zakázané hlavičky (`Content-Length`) chybou `net::ERR_INVALID_ARGUMENT` **před
  odesláním** a protistrana nemá co zaznamenat; Node je propustí. Upload jede přes `net.fetch`.
  **Nepřidávej hlavičky ručně.**
- **Chybám z Chromia chybí `code` i `cause`** — příčina je jen v textu zprávy.
- **Dokumentace v `docs/server-modul/` je ZASTARALÁ.** Popisuje `POST /api/desktop/recordings`,
  `PUT …/tracks/{kind}`, `POST …/complete` — **takové routy neexistují.** Platí
  `/api/nahravky/uploads` a jediný zdroj pravdy je kód (`electron/upload-client.cjs`,
  `electron/companies.cjs`). `KONTRAKT.md §7` (ř. 119–159) to sám přiznává; zbytek dokumentu
  ne. Nenech se tím poslat špatným směrem.
- **Vitest umí vypsat „N passed" a vedle toho řádek `Errors`.** Kontroluj i ten.
- **Aplikace má jednoinstanční zámek** — druhá instance start vůbec nerozjede.
- **`pgrep -f <cesta>` chytá i vlastní shell skripty**, které tu cestu mají v příkazu.
  Nehledej podle toho běžící instance.

---

## 10. Jak pracovat

- Větev z `main`, malé commity, **commit message anglicky**, dokumentace a komentáře **česky**.
- Před commitem `npm run gates`. Necommituj s červenou branou.
- Když narazíš na něco, co jde vyřešit jen změnou serveru, **zastav se a napiš to** (sekce 1).
- Když najdeš, že tohle zadání někde neodpovídá kódu, **věř kódu a rozpor pojmenuj** —
  podklady jsou měřené 14. 9. 2026 a repo mezitím žije.
