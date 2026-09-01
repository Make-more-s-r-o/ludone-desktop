# Mechanické vytěžení podkladů pro spec a plan

Průzkum je vztažený k hlavnímu checkoutu `/Users/dan/Dev/ClaudeCode/ludone-desktop`. Repozitář nebyl měněn.

## 1. Inventář obrazovek

Měřicí pravidlo: jako obrazovku počítám každý samostatně nakreslený blok `.pv` v `design/navrh/nahled.html`. Takových bloků je **23**. Sekce 05 a 06 byly také projity celé, ale neobsahují další `.pv`: sekce 05 vysvětluje zrušení kalendáře a sekce 06 je tabulka rozhodnutí. `Cesta.dc.html` eviduje 31 momentů cesty, z toho 20 „bez obrazovky“; tyto momenty proto nepřičítám.

| Název | Kde se odehrává (panel / plné okno / systémový dialog / prohlížeč / lišta) | Co je na ní | Stavy, které kreslí |
|---|---|---|---|
| 00.1 Ikona v liště | lišta | Ikona LuDone, barevný stav a případný text času | Náhled kreslí nahrávání `12:41`; `Lista.dc.html`: `Nepřihlášeno`, `Klid`, `Nahrává`, `Měří čas`, `Nahrává + měří`, `Čeká fronta`, `Výpadek zvuku`, `Bez spojení` |
| 00.2 Levý klik → panel | panel | Účet, rozbalené nahrávání, čas, měřáky obou stop, stop, sbalený LuTrack, sync, Nastavení | Připojeno, nahrávání aktivní, LuTrack neaktivní, vše odesláno |
| 00.3 Pravý klik → menu | lišta | Ukončit nahrávání, spustit LuTrack, otevřít panel/web/Nastavení/O aplikaci, ukončit aplikaci, zkratky | Nahrávání aktivní + LuTrack neaktivní; DC doplňuje zastavení času, přepnutí projektu a čekající frontu |
| 01.1 Uvítání | panel | Značka, účel aplikace, „Přihlásit přes app.ludone.cz“ | První spuštění, nepřihlášeno |
| 01.2 Čekání | panel | Spinner, odpočet `9:42`, OAuth odkaz/Kopírovat, ruční otevření, Zrušit | OAuth čeká na prohlížeč, běží limit |
| 01.3 Prohlížeč — souhlas | prohlížeč | OAuth authorize, účel, e-mail, zařízení, prostředí, Povolit/Odmítnout, jiný účet | Čekající souhlas konkrétního účtu a zařízení |
| 01.4 Hotovo | panel | Zelené potvrzení, jméno, e-mail, zařízení, Pokračovat | Přihlášení úspěšné |
| 01.5 Vypršelo | panel | „Přihlášení vypršelo“, vysvětlení, Zkusit znovu, možné příčiny | OAuth vypršel po deseti minutách |
| 01.6 Účet nemá přístup | panel | Chyba, konkrétní e-mail, chybějící oprávnění desktopu, jiný účet, správce | Autentizace proběhla, autorizace chybí |
| 01.7 Bez sítě | panel | Offline vysvětlení, lokální nahrávání/čas, Zkusit znovu | Přihlášení nelze dokončit, lokální agendy mohou pokračovat |
| 02.1 Oprávnění — přehled | panel | Mikrofon a Ostatní zvuk zvlášť, stav, vysvětlení screen capture, Nastavení systému, jednostopý režim | Mikrofon `Povoleno`, ostatní zvuk `Neověřeno`; částečné povolení |
| 02.2 Oprávnění — zkouška | panel | Pokyny, dva měřáky, volba mikrofonu, zkušební zvuk, blokované Pokračovat | Mikrofon `slyším`, ostatní zvuk `ticho`; test neprošel |
| 02.3 Oprávnění — připraveno | panel | Zelené potvrzení obou kanálů, Hotovo | Obě oprávnění i oba signály ověřené |
| 03.1 Klid | panel | Sbalené Nahrávání a LuTrack, dnešní souhrny, Nahrát/Spustit, sync, Nastavení | Nic neběží, vše odesláno |
| 03.2 Výběr projektu | panel | Hledání, naposledy/všechny, zbývající alokace, vyčerpaný projekt | Platná alokace volitelná; vyčerpaný projekt zakázaný s důvodem |
| 03.3 Měří se čas | panel | Od kdy, `5h 16m`, projekt, alokace/metr, Přepnout/Stop, nahrávání sbalené | LuTrack aktivní, nahrávání neaktivní |
| 03.4 Běží obojí | panel | Dvě rozbalené nezávislé karty, časy, měřáky, samostatné ovládání | Nahrávání i LuTrack aktivní |
| 03.5 Konec nahrávky → pojmenování | panel | Datum/čas od–do, délka, velikost, fokusované předvyplněné jméno, Uložit a odeslat | Nahrávka uložena, čeká na potvrzení názvu |
| 03.6 Výpadek ostatního zvuku | panel | „Nahrává se omezeně“, mikrofon `ok`, ostatní zvuk `ticho`, vysvětlení, Pokračovat/Ukončit | Nahrávání pokračuje jen s mikrofonem |
| 03.7 Čeká fronta | panel | 3 položky, 412 MB, další pokus, Zkusit teď, sbalené agendy, sync | Tři čekají na odeslání, nic neběží |
| 04.1 Nastavení — Účet a zvuk | plné okno | Záložky Účet/Zvuk/Záznamy/Diagnostika, identita, zařízení, prostředí, odhlášení, Dock, autostart | Přihlášeno do produkce; Dock vypnutý; autostart zapnutý |
| 04.2 Nastavení — Diagnostika | plné okno | Verze/build, architektura, oprávnění, server, fronta, export bez citlivých dat | Obě oprávnění povolena, server v pořádku, fronta prázdná |
| 04.3 Nastavení — Připomínky | plné okno | Zapnutí, dny, od–do, četnost, náhled systémového oznámení a akce | Zapnuto po–pá 09:00–17:00 každou hodinu; so/ne vypnuto; během nahrávání bez oznámení |

### Kontrola sekcí 05 a 06

- **05 — Kalendář:** žádná další obrazovka. Jméno nahrávky nahradí datum, čas, délka a projekt z LuTracku; ruční upřesnění přijde při stopu; automatické nahrávání odpadá; účastníci se ztrácejí.
- **06 — Rozhodnuto:** žádná další obrazovka. Fixuje sbalenou klidovou agendu, Dock výchozí vypnutý s přepínačem, pojmenování při stopu a připomínky. Aktualizace, odinstalování a odebrání z firmy jsou odložené obrazovky.

## 2. Datové modely, které v kódu už existují

Počet požadovaných struktur: **5**.

### 2.1 Manifest sezení — `src/lib/manifest.js`

```ts
{
  schemaVersion: 1,
  clientRecordingId: string,        // neprázdný; bez defaultu
  createdAt: string | null,          // platný timestamp nebo null; bez defaultu
  closedAt: string | null,           // platný timestamp nebo null; bez defaultu
  state: "recording" | "complete" | "incomplete", // povinný argument, bez defaultu
  tracks: {
    microphone: {
      endedAt: string | null,
      fileName: string,
      sha256: string | null,          // 64 malých hex znaků nebo null
      sizeBytes: number,              // nezáporné safe integer
      startedAt: string | null
    },
    system: {
      endedAt: string | null,
      fileName: string,
      sha256: string | null,
      sizeBytes: number,
      startedAt: string | null
    }
  }
}
```

Počáteční hodnoty v `electron/main.cjs`: `clientRecordingId = randomUUID()`, `createdAt = startedAt.toISOString()`, `closedAt = null`, stav v paměti `recording`; u obou stop `startedAt = createdAt`, `endedAt = null`, `sizeBytes = 0`, `sha256 = null`. Na disk se před vrácením session rendereru zapíše obnovovací kopie se stavem `incomplete`. Při konci se přepíše na `complete` nebo `incomplete`; `complete` musí mít `closedAt`.

- **Uložení:** disk, atomický `*.manifest.json` v `path.join(app.getPath("userData"), "nahravky")`, režim `0o600`; aktivní kopie i v paměti.
- **Přežije pád:** **ano na disku**; paměťová session ne.

### 2.2 Položka fronty — `src/lib/queue.js`

Obal: `{ schemaVersion: 1, items: [] }`.

```ts
{
  attempts: 0,
  clientRecordingId: string,
  enqueuedAt: string,                     // ISO z now
  lastFailureReason: null | string,       // default null
  manifestPath: string,
  nextAttemptAt: null | number,           // default null; později epoch ms
  sentAt: null | string,                  // default null; později ISO
  server: {
    recordingId: null | string,           // default null
    uploadedBytes: { microphone: 0 | number, system: 0 | number }
  },
  state: "ceka" | "odesila" | "odeslano" | "selhalo", // default "ceka"
  tracks: { microphone: string, system: string }
}
```

`normalizeTrackPaths` dovoluje právě `microphone` a `system`. `validateManifest` vyžaduje neprázdný `clientRecordingId`, objekt `tracks` a obě stopy. Idempotence je podle `clientRecordingId`.

Retry defaulty: `{ baseDelayMs: 30_000, maxDelayMs: 6 * 60 * 60 * 1_000, maxAttempts: 5, jitterRatio: 0.2 }`.

- **Uložení:** v aktuální aplikaci **nikde**. `src/lib/queue.js` volají jen testy. `electron/queue.cjs` umí atomické load/save, ale produkce ho neimportuje.
- **Přežije pád:** **ne v aktuálním zapojení**.

### 2.3 Stav časovače — `TrackingCard.jsx` + `useElapsedTime.js`

```ts
PROJECTS = ["LuDone Desktop", "Web · klientská zóna", "Interní provoz"]
{
  project: "LuDone Desktop",
  description: "",
  active: false,
  startedAt: null,          // null | number, při startu Date.now()
  lastMessage: "",
  elapsedSeconds: 0
}
```

Při startu: `lastMessage = ""`, `startedAt = Date.now()`, `active = true`. Při stopu: `active = false`, `startedAt = null`, zpráva `Čas zastaven · uložení do LuTracku je ukázkové.`. Hook po 250 ms počítá celé sekundy; rodiči se posílá jen `{ active, project, description }`.

- **Uložení:** jen React paměť rendereru.
- **Přežije pád:** **ne**.

### 2.4 Stav tray ikony — `electron/main.cjs`

```ts
let trayState = "signed-out";
type TrayState = "signed-out" | "idle" | "recording" | "tracking";
```

`trayIconName` přijme tyto čtyři hodnoty, jinou vrátí jako `signed-out`. `updateTray` nastaví normalizovaný `trayState`, obrázek a tooltipy: `LuDone · nepřihlášeno`, `LuDone · připraveno`, `LuDone · nahrává`, `LuDone · LuTrack běží`.

`VALID_TRAY_STATES` v aktuálním souboru **není**; ekvivalent je ve `switch` v `trayIconName`. Renderer volí bez uživatele `signed-out`, pak prioritně `recording`, pak `tracking`, jinak `idle`. Souběh se zobrazí jen jako recording.

- **Uložení:** jen paměť main procesu; názor posílá renderer přes `tray:set-state`.
- **Přežije pád:** **ne**; restart vrátí `signed-out` a pád rendereru může nechat nepravdivý poslední stav.

### 2.5 Co drží renderer — `src/App.jsx`

```ts
ONBOARDING_KEY = "ludone.prototype.onboarding-complete"
DEFAULT_USER = { name: "Daniel Novák", email: "daniel@ludone.cz" }
runtime = { emptyCalendar: boolean, resetOnboarding: boolean }
initiallyComplete = !runtime.resetOnboarding
  && localStorage.getItem(ONBOARDING_KEY) === "true"
{
  onboardingComplete: initiallyComplete,
  user: initiallyComplete ? DEFAULT_USER : null,
  recording: { active: false, busy: false, context: null },
  tracking: { active: false },
  recordingRequest: null // později { id: "${event.id}-${Date.now()}", event }
}
```

Po callbacku má recording `{ active, busy, context }` a tracking `{ active, project, description }`. `trayState` je odvozený `useMemo`, ne vlastní uložený stav.

- **Uložení:** jen příznak onboardingu v `localStorage`. Uživatel se po reloadu rekonstruuje jako `DEFAULT_USER`; ostatní je jen paměť.
- **Přežije pád:** **částečně** — onboarding ano, ostatní ne.

## 3. Přesné soubory pro stories B1 až B12

„Neurčeno“ znamená, že zdroj nefixuje přesnou cestu a žádnou si nedomýšlím.

| Story | Konkrétní soubory ke změně nebo založení | Neurčeno / důvod |
|---|---|---|
| **B1** | `scripts/ui-smoke.mjs` | `scripts/akceptace/E2-sabotaze.sh` se má jen spustit, ne měnit. |
| **B2** | **neurčeno** | Chybí mapa staré `E1–E8` → `B1–B8` a hranice, zda se mění jen dokumenty, i `specs/E*.md`, `scripts/akceptace/E*.sh`, historické briefy a názvy souborů. |
| **B3** | `electron/main.cjs`; `electron/preload.cjs`; `src/App.jsx`; `src/styles.css`; `tests/tray-authority.test.js`; `scripts/ui-smoke.mjs` | Jméno případného nového modulu/testu tray není fixováno. Starší spec navrhuje `electron/tray-state.cjs`, ale B3 je užší než celá tehdejší E3. |
| **B4** | `electron/auth.cjs`; `electron/main.cjs`; `electron/preload.cjs`; `src/components/Onboarding.jsx`; `src/styles.css`; `tests/panel-blur-guard.test.js`; `tests/ipc-sender-guard.test.js` | Jméno nového testu timeoutu/zrušení není určeno. |
| **B5** | `electron/tracking.cjs` **(nový, výslovně v Architecture Spine)**; `electron/main.cjs`; `electron/preload.cjs`; `src/App.jsx`; `src/features/tracking/TrackingCard.jsx`; `src/hooks/useElapsedTime.js` | Jméno testu perzistence není určeno. |
| **B6** | `electron/tracking.cjs`; `electron/main.cjs`; `electron/preload.cjs`; `src/features/tracking/TrackingCard.jsx` | Plan fixuje nový adresář `src/lib/adapters/`, ale ne jméno adaptéru ani testu. |
| **B7** | `src/lib/queue.js`; `electron/queue.cjs`; `electron/main.cjs`; `electron/preload.cjs`; `src/App.jsx`; `src/features/recording/RecordingCard.jsx`; `src/features/tracking/TrackingCard.jsx`; `src/features/queue/QueueCard.jsx` **(nový dle existující specifikace)**; `tests/queue.test.js` | Jméno integračního testu zapojení není určeno. |
| **B8** | `electron/auth.cjs`; `electron/main.cjs`; `electron/preload.cjs`; `src/App.jsx`; `src/components/Onboarding.jsx`; `tests/ipc-sender-guard.test.js`; `tests/oauth-state.test.js`; `tests/pkce.test.js` | Jméno samostatného testu controlleru není určeno. |
| **B9** | `electron/auth.cjs`; `electron/main.cjs`; `electron/preload.cjs`; `src/App.jsx`; `src/components/Settings.jsx`; `src/styles.css`; `tests/ipc-sender-guard.test.js` | Jméno testu revokace/single-flight není určeno. |
| **B10** | **neurčeno** | Nejdřív se požaduje návrh. Není rozhodnuto rozpoznání sdíleného zařízení, vlastník nahrávky, dopad do manifestu/fronty ani časovač. Jisté jsou jen oblasti auth, manifest, queue, renderer a RBAC. |
| **B11** | `electron/queue.cjs`; `electron/main.cjs`; `electron/preload.cjs`; `src/components/Settings.jsx`; `src/styles.css`; `tests/queue.test.js` | Není rozhodnuto, zda janitor zůstane v `electron/queue.cjs`, nebo vznikne zvlášť; starší spec uvádí `electron/queue/janitor.cjs`, Architecture Spine jediný `electron/queue.cjs`. |
| **B12** | **neurčeno v tomto repozitáři** | Měření a migrace živé DB LuTracku jsou Danova práce mimo desktop. Plan neuvádí repo, tabulku ani migrační soubor a současně říká, že desktop v1 nemá migraci. |

### Sdílené soubory

| Soubor | Stories |
|---|---|
| `scripts/ui-smoke.mjs` | B1, B3 |
| `electron/main.cjs` | B3, B4, B5, B6, B7, B8, B9, B11 |
| `electron/preload.cjs` | B3, B4, B5, B6, B7, B8, B9, B11 |
| `src/App.jsx` | B3, B5, B7, B8, B9 |
| `src/styles.css` | B3, B4, B9, B11 |
| `tests/ipc-sender-guard.test.js` | B4, B8, B9 |
| `electron/tracking.cjs` | B5, B6 |
| `src/features/tracking/TrackingCard.jsx` | B5, B6, B7 |
| `electron/auth.cjs` | B4, B8, B9 |
| `electron/queue.cjs` | B7, B11 |
| `tests/queue.test.js` | B7, B11 |
| `src/components/Settings.jsx` | B9, B11 |

**9 stories** prokazatelně sdílí alespoň jeden konkrétní soubor: B1, B3, B4, B5, B6, B7, B8, B9 a B11. B10 se pravděpodobně překryje také, ale jeho přesné cesty jsou neurčené, proto jej do mechanického počtu nezapočítávám.

```json
{
  "summary": "Úplný statický náhled obsahuje 23 samostatně nakreslených obrazovek; sekce 05 a 06 přidávají rozhodnutí, ne další obrazovky. Kód obsahuje pět požadovaných skupin datových struktur, ale časovač, tray i téměř celý rendererový stav jsou jen v paměti a čistá fronta není produkčně zapojena. Pro všech 12 stories je uveden konkrétní souborový dopad nebo výslovné neurčeno; devět stories má mechanicky prokázaný sdílený soubor.",
  "premisaPlatila": true,
  "premisaPoznamka": "Tvrzení 17+ platí: v nahled.html je skutečně 23 bloků .pv (starší decisions.md stále uvádí 22). Plan.md obsahuje přesně 12 stories B1 až B12.",
  "pocty": {
    "obrazovek": 23,
    "datovychStruktur": 5,
    "storiesSeSouborovymSeznamem": 12,
    "storiesSdilejicichSoubor": 9,
    "zmenenychSouboruRepozitare": 0
  },
  "notes": "Nejednoznačné jsou mapa B2, kontrakt B10, cílový repozitář/migrace B12 a názvy několika nových testů či adaptéru. Orchestrátor má ověřit i rozpor electron/queue.cjs proti staršímu electron/queue/janitor.cjs. VALID_TRAY_STATES v main.cjs neexistuje. Počet 23 zahrnuje Připomínky, které jsou kvůli uzavírací značce mimo section 04, ale mají vlastní .pv a jsou samostatnou obrazovkou."
}
```
