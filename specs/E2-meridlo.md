# E2 — Měřidlo: brány, kterým se dá věřit

> Vzniklo 24. 8. 2026 z ultracode analýzy. Master plán: [`../PLAN.md`](../PLAN.md).

## Cíl

Postavit nad existující kostrou čtyři brány, které jdou spustit jedním příkazem a které při rozbití kódu opravdu zčervenají: lint, typecheck, unit testy nad čistou logikou a dvě end-to-end brány (ui-smoke, audio-smoke). Zároveň OPRAVIT současnou audio bránu, která měří poměr bajtů proti nekontrolovanému „tichému" běhu — a proto by u funkční aplikace mohla vyhlásit neúspěch. Nová brána hodnotí systémovou stopu ABSOLUTNĚ: tichý běh musí být doložitelně digitální ticho (−91,0 dB mean i max), zvučný běh se posuzuje normalizovanou křížovou korelací se známým souborem a hlasitostí. Vykonavatel: Codex gpt-5.6-sol. Pracovní strom: /Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/kostra (větev feat/kostra-appky) — POZOR, na main žádný kód aplikace není. VŠECHNY hodnoty a verze níže jsou naměřené na kopii skutečného kódu, ne odhadnuté.

## Kroky

### 1. Základna a nástroje (ověřené verze)

Vyjít z větve, na které je kód aplikace: `feat/kostra-appky` (commit 2bb09ce), případně z větve, na kterou ji odloží E0. NIKDY ne z `main` — `main` obsahuje jen ROZHODNUTI.md a zadání, žádné electron/ ani src/.

Instalovat PŘESNĚ tyto verze (`npm i -D`):
  eslint@10.9.0 · @eslint/js@10.0.1 · globals@17.11.0 · eslint-plugin-react-hooks@7.1.1
  typescript@7.0.2 · @types/node@26.2.0 · @types/react@19.2.18 · @types/react-dom@19.2.5
  vitest@4.1.11

🔴 eslint-plugin-react SE NEINSTALUJE. Naměřeno: eslint-plugin-react@7.37.5 má peer `eslint@"^3 || … || ^9.7"` a proti ESLint 10 spadne na ERESOLVE. ESLint 9 (maintenance 9.39.5) npm už při instalaci hlásí jako „no longer supported". React 19 + automatický JSX transform stejně dělá většinu pravidel toho pluginu bezpředmětnou (react-in-jsx-scope, prop-types). Znovuotevřít, až vyjde eslint-plugin-react s peerem `^10`.

@eslint/js MUSÍ být přímá devDependency — ESLint 10 ho už nehoistuje a `import js from "@eslint/js"` jinak padne na ERR_MODULE_NOT_FOUND.

**Hotovo když:** `npx eslint --version` → v10.9.0, `npx tsc --version` → 7.0.2, `npx vitest --version` → 4.1.11. `git branch --show-current` ukazuje větev, kde existuje electron/main.cjs.

### 2. ESLint flat config + oprava čtyř skutečných nálezů

Vytvořit `eslint.config.js` (ESM, projekt je "type":"module") — ověřená podoba:

```js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/**", "release/**", ".runtime/**", "node_modules/**"] },
  js.configs.recommended,
  { files: ["src/**/*.{js,jsx}"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs["recommended-latest"].rules } },
  { files: ["electron/**/*.cjs"],
    languageOptions: { ecmaVersion: 2024, sourceType: "commonjs", globals: { ...globals.node } } },
  { files: ["scripts/**/*.mjs", "vite.config.js", "vitest.config.js", "test/**/*.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.node } } },
];
```
(Pozn.: v eslint-plugin-react-hooks@7 se flat konfigurace jmenuje `recommended-latest`; exportují se `recommended`, `recommended-latest`, `flat`. Blok pro `test/**` je povinný — bez něj `Buffer` a `TextEncoder` v testech spadnou na no-undef, změřeno.)

První běh vrátí PŘESNĚ 4 nálezy (změřeno na skutečném kódu). Opravit VADU, ne pravidlo:
1. `scripts/audio-smoke.mjs:385` — pravidlo `preserve-caught-error` (nové v recommended ESLint 10): `throw new Error(\`${mode}: …\`)` uvnitř catch bez příčiny → přidat druhý argument `{ cause: error }`.
2. `scripts/ui-smoke.mjs:135` — totéž v `assertText`, přidat `{ cause: error }`.
3. `src/hooks/useElapsedTime.js:8` — `react-hooks/set-state-in-effect` (error): `setElapsedSeconds(0)` v těle efektu. Řeší krok 4 přepisem hooku, NE vypnutím pravidla.
4. `src/features/recording/RecordingCard.jsx:391` — `react-hooks/exhaustive-deps` (warning): chybí `start`. Přidat úzké `// eslint-disable-next-line react-hooks/exhaustive-deps -- start() je zámerně mimo deps, opakování hlídá ref handledRequest + startInFlight`. Je to jediná povolená výjimka, na jednom řádku, s důvodem; konfigurace se NEMĚKČÍ. Znovuotevřít v E6/E9, až se `start` zmemoizuje.

Skript: `"lint": "eslint . --max-warnings=0"`.

**Hotovo když:** `npm run lint` skončí s kódem 0 a bez jediného řádku výstupu. Naměřený čas: 1,0 s.

### 3. Typecheck bez přepisu na TypeScript

Vytvořit `tsconfig.json` v kořeni (NE jsconfig — potřebujeme `-p` a `--noEmit`; Vite tenhle soubor nečte, `vite.config.js` zůstává beze změny):

```json
{ "compilerOptions": {
    "target": "ES2023", "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext", "moduleResolution": "bundler",
    "allowJs": true, "checkJs": true, "noEmit": true,
    "jsx": "react-jsx", "strict": false, "skipLibCheck": true,
    "resolveJsonModule": true, "types": ["node"] },
  "include": ["types/**/*.d.ts", "src/**/*.js", "src/**/*.jsx",
              "electron/**/*.cjs", "scripts/**/*.mjs", "vite.config.js"] }
```
`strict: false` schválně — cílem je odhalit skutečné vady, ne rozjet migraci na TS.

První běh vrátí PŘESNĚ 30 chyb (změřeno). Rozpad a oprava:

(a) 12× TS2339 `Property 'ludone' does not exist on Window` (App.jsx 4×, Onboarding 2×, Settings 2×, RecordingCard 3×, …) + 1× TS2882 `./styles.css`. → Vytvořit `types/ludone.d.ts`, který popisuje most z `electron/preload.cjs` 1:1 (runtime, beginAuth, requestPermission, beginRecording, appendRecordingChunk, finishRecording, getTrayState, testClickTray, testQuit, setTrayState, hidePanel, openSettings, closeSettings) plus `declare module "*.css";`. `appendRecordingChunk` typovat jako `(sessionId: string, source: "microphone" | "system", sequence: number, arrayBuffer: ArrayBuffer) => Promise<{sequence:number,bytes:number}>`, `getTrayState` jako `Promise<"signed-out"|"idle"|"recording"|"tracking">`. Tohle je JEDINÉ místo v repu, kde je bridge popsaný — E6 na něj naváže.

(b) 13× TS2322 v `src/components/Icons.jsx` — `baseProps.strokeLinecap: string` se nevejde do `"butt"|"round"|…`. → Nad `const baseProps = {` na řádku 1 přidat `/** @type {import("react").SVGProps<SVGSVGElement>} */`. Jedna anotace smaže všech 13.

(c) 3× TS2810 `new Promise() needs a JSDoc hint` — `RecordingCard.jsx:53` (waitUntilUnmuted), `audio-smoke.mjs:54` a `:183` (runAfplay). → Obalit `return /** @type {Promise<void>} */ (new Promise((resolve, reject) => { … }));` (nezapomenout na uzavírací `}));`).

(d) 1× TS2769 + 1× TS2339 v `audio-smoke.mjs:51,55` — `server.listen(0, "127.0.0.1", resolve)` a `address.port`. → `server.listen(0, "127.0.0.1", () => resolve())` a před `return address.port` doplnit `if (!address || typeof address === "string") throw new Error("Nepodařilo se získat volný port");`. Tohle je SKUTEČNÁ latentní vada, ne kosmetika.

Skript: `"typecheck": "tsc --noEmit -p tsconfig.json"`.

**Hotovo když:** `npm run typecheck` vypíše nic a skončí kódem 0 (z 30 chyb na 0 — ověřeno na kopii skutečného kódu). Naměřený čas: 0,30 s.

### 4. Vyříznout testovatelné jádro (bez toho unit testy nejdou napsat)

🔴 `electron/main.cjs` NEJDE v testu naimportovat: nic neexportuje a při načtení volá `protocol.registerSchemesAsPrivileged`, `configureWritablePaths()`, `app.setName`, `app.requestSingleInstanceLock()` a `app.whenReady()`. Mockovat celý Electron je horší než udělat šev. Vyříznout tři moduly s VSTŘIKOVANOU závislostí; `main.cjs` je pak jen `require`uje a chová se stejně:

1. `electron/trusted-url.cjs` → `isTrustedAppUrl(distRoot, value)` — přesně tělo dnešní funkce z main.cjs:63-72, jen `DIST_ROOT` se stane parametrem. V main.cjs zůstane tenká obálka `const isTrustedAppUrl = (v) => trustedUrl.isTrustedAppUrl(DIST_ROOT, v);`.
2. `electron/recording-guard.cjs` → `isTrustedWebContents(webContents, isTrustedUrl)` a `assertTrustedRecordingSender(event, { panelWebContents, isTrustedUrl })` — tělo z main.cjs:74-87, `panelWindow.webContents` se stane parametrem. `requireTrustedRecordingSender(event)` v main.cjs zůstane jako obálka volající `assertTrustedRecordingSender(event, { panelWebContents: panelWindow?.webContents, isTrustedUrl })` — všechna tři volání (`createRecordingSession`, `ownedRecordingSession`, `test:quit`) se nemění.
3. `electron/recording-track.cjs` → `createRecordingTrack(source, filePath, handle)` s metodou `append(sequence, arrayBuffer)` a exportem `MAX_RECORDING_CHUNK_BYTES = 8 * 1024 * 1024`. Přenést BEZE ZMĚNY CHOVÁNÍ validace i frontu z `appendRecordingChunk` (main.cjs:394-426): kontrola `Number.isSafeInteger(sequence) && sequence >= 0`, `instanceof ArrayBuffer`, `0 < length <= 8 MiB`, `track.queue.then(…)`, kontrola `sequence !== track.nextSequence`, smyčka částečného zápisu `while (offset < bytes.length)`, `handle.sync()`, `nextSequence += 1`, `track.queue = operation.catch(e => { track.writeError = e; })`. `openRecordingTrack` v main.cjs pak jen otevře `fs.promises.open(filePath, "wx", 0o600)` a předá handle do `createRecordingTrack`; `appendRecordingChunk` se zredukuje na `ownedRecordingSession(...)` + `track.append(sequence, arrayBuffer)`.

🔴 Typová past (změřena): v novém modulu anotovat `/** @type {Promise<any>} */` nad `queue: Promise.resolve(),` — jinak `tsc` hlásí TS2322 `Promise<void | {sequence,bytes}> not assignable to Promise<void>`.

4. `src/hooks/useElapsedTime.js` — přepsat tak, aby zmizel `set-state-in-effect` a vzniklo čisté jádro:
```js
export function computeElapsedSeconds(nowMs, startedAt, active) {
  if (!active || !startedAt) return 0;
  return Math.max(0, Math.floor((nowMs - startedAt) / 1000));
}
export function useElapsedTime(active, startedAt) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !startedAt) return undefined;
    const interval = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [active, startedAt]);
  return computeElapsedSeconds(nowMs, startedAt, active);
}
```
Chování se nemění: dokud `active` nebo `startedAt` chybí, vrací 0; při startu je `nowMs < startedAt`, takže se ukáže 0 a po 250 ms naskočí tik. `formatElapsed` zůstává beze změny (jen se doplní JSDoc `@param {number}`).

**Hotovo když:** `npm run lint` i `npm run typecheck` jsou zelené PO refaktoru; `npm run package:mac && npm run test:audio` projde stejně jako před ním (chování se nezměnilo).

### 5. Vitest + unit testy nad čistou logikou

`vitest.config.js`: `{ test: { environment: "node", include: ["test/unit/**/*.test.js"] } }`. 🔴 ŽÁDNÝ jsdom a ŽÁDNÉ @testing-library — zadání zní „čistá logika" a fast loop musí zůstat v sekundách. Tikání hooku pokrývá ui-smoke (assert `"00:00:01"`), ne unit test.

CJS moduly se v ESM testu načtou přes `createRequire(import.meta.url)`.

`test/unit/elapsed.test.js` — `computeElapsedSeconds` + `formatElapsed`:
 • vrací 0 když `active === false` a když `startedAt === null` (aby běžící stopky po zastavení nepokračovaly)
 • zaokrouhluje DOLŮ: 5 999→0, 6 000→1, 6 999→1 (posun o 1 ms nesmí přeskočit sekundu)
 • nikdy nezáporná hodnota při posunu hodin zpět: (4 000, 5 000, true) → 0
 • `formatElapsed`: 0→"00:00:00", 1→"00:00:01" (přesně to, co tvrdí ui-smoke), 59→"00:00:59", 3 661→"01:01:01", 36 000→"10:00:00"

`test/unit/trusted-url.test.js` — `isTrustedAppUrl(distRoot, value)`:
 • `ludone://app/index.html` → true; `ludone://evil/index.html` → false (hostname se opravdu kontroluje)
 • `file://<dist>/index.html` → true; `file://<dist>/jine.html` → false
 • `file://<dist>/../index.html` → false (únik z dist přes `..` se opravdu normalizuje)
 • `https://app.ludone.cz/index.html` → false; `"tohle není URL"` → false; `""` → false (catch větev)

`test/unit/recording-guard.test.js` — `assertTrustedRecordingSender`:
 • projde pro `{ sender: panel, senderFrame: panel.mainFrame }` s důvěryhodnou URL
 • hodí pro CIZÍ okno se STEJNOU důvěryhodnou URL (identita webContents, ne jen URL)
 • hodí pro vnořený iframe panelu (`senderFrame !== sender.mainFrame`)
 • hodí, když panel navigoval na `https://zlo.example/…`
 • hodí pro zničené webContents (`isDestroyed() === true`)
 Falešné webContents: `{ isDestroyed: () => …, getURL: () => …, mainFrame }`, `isTrustedUrl` jako předaná funkce.

`test/unit/recording-track.test.js` — `createRecordingTrack(...).append` s falešným handle, který sbírá zápisy:
 • dva chunky po sobě → na disku je „aabb", `nextSequence === 2`, `sync()` volán 2×
 • chunk mimo pořadí (0, pak 2) → `rejects` s hláškou `/čekám 1, přišlo 2/`, A NAVÍC následný správný chunk 1 taky padne (stopa je otrávená přes `writeError`) a do handle se nic nezapsalo — TOHLE je test na integritu pořadí
 • tři `append` volané SOUČASNĚ bez `await` → výsledky `[0,1,2]` a na disku „112233" (fronta drží pořadí i pod souběhem)
 • částečný zápis (handle vrací `bytesWritten: 1`) → 4 volání `write`, výsledek „abcd" (smyčka dopisuje)
 • synchronní odmítnutí: prázdný ArrayBuffer, `MAX_RECORDING_CHUNK_BYTES + 1`, `sequence = -1`, `sequence = 1.5`, `arrayBuffer = "nejsem buffer"`
 • chunk PŘESNĚ 8 MiB projde (hranice je inkluzivní)

Skript: `"test:unit": "vitest run"`.

**Hotovo když:** `npm run test:unit` → 4 soubory, ≥21 testů, vše zelené. Naměřeno: 21 testů / 120 ms (≈6 s včetně startu vitestu).

### 6. 🔴 OPRAVA AUDIO BRÁNY — absolutní měření místo poměru bajtů

Vytvořit `scripts/audio-analysis.mjs` (čisté funkce nad ffmpeg, bez Electronu):

```js
export const FFMPEG = process.env.LUDONE_FFMPEG || "ffmpeg";
export const ANALYSIS_RATE = 4_000;          // 4 kHz stačí, korelace 5 s stopy trvá ~30 ms
export const SILENCE_FLOOR_DB = -91.0;
export const SILENCE_TOLERANCE_DB = 0.05;
export const MIN_CORRELATION = 0.8;
export const MIN_SOUND_MEAN_DB = -40.0;
export const MIN_DECODED_SECONDS = 3.0;
export const SILENCE_ATTEMPTS = 3;
```
• `volumeStats(file)` → `ffmpeg -hide_banner -nostdin -i F -map 0:a:0 -af volumedetect -f null -`, ze stderr vyparsovat `mean_volume` a `max_volume` regexem `/mean_volume:\s*(-?\d+(?:\.\d+)?)/`.
• `decodePcm(file, rate)` → `ffmpeg -hide_banner -loglevel error -nostdin -i F -map 0:a:0 -ac 1 -ar 4000 -f f32le -` → `Float32Array`.
• `maxNormalizedCorrelation(signal, reference)` — KLOUZAVÁ normalizovaná křížová korelace: referenci vycentrovat (odečíst průměr) a spočítat její normu; nad signálem předpočítat prefixové součty `sum` a `sumSq`; pro každý posun `lag` spočítat `dot = Σ centered[i]·signal[lag+i]`, rozptyl okna `var = (sumSq[lag+M]-sumSq[lag]) − (windowSum²/M)`, okna s `var <= 1e-12` (digitální ticho) přeskočit, a `value = |dot / (refNorm · √var)|`. Vrátit maximum přes všechny posuny a jeho `lagSeconds`. Normalizace na okno délky reference je podstatná — korelace přes celých 5 s by 1,65 s zvuk zředila.
• `isDigitalSilence({meanDb,maxDb})` → `|mean − (−91,0)| ≤ 0,05 && |max − (−91,0)| ≤ 0,05`.

Algoritmus brány v `scripts/audio-smoke.mjs` (nahradí řádky 402-426):
```
1. Preflight: `ffmpeg -version`; když chybí → SELHAT hned s hláškou
   „Brána potřebuje ffmpeg (např. /Users/dan/.local/bin/ffmpeg); nastav LUDONE_FFMPEG."
2. for pokus = 1..3:
       silence = runRecording("silence")            // ~10 s
       stats   = volumeStats(silence.system)
       if isDigitalSilence(stats): break
       zalogovat „tichý běh zahozen (pokus N/3): mean X dB, max Y dB — během měření
                  na stroji něco hrálo", běh ZAHODIT a opakovat po 2 s pauze
   else: SELHAT „Systémová stopa nebyla ani jednou úplně tichá. Ztlum stroj a pusť znovu."
3. sound = runRecording("sound")                    // Glass.aiff 3× jako dnes
4. Brány nad sound.system:  sekundy ≥ 3,0
                            meanDb  > −40,0
                            korelace s /System/Library/Sounds/Glass.aiff > 0,8
5. Brány nad sound.mikrofon: sekundy ≥ 3,0 · NENÍ digitální ticho
   🔴 na mikrofon se korelační brána NEDÁVÁ — naměřeno 0,018: akustické
      prosáknutí přes místnost korelaci zničí (dozvuk, zpoždění, charakteristika mikrofonu).
6. Brány nad silence.system: isDigitalSilence == true · korelace < 0,2
7. Zapsat proof-files.json se VŠEMI naměřenými čísly (mean, max, sekundy, korelace, lag, počet pokusů).
```
🔴 SMAZAT `const requiredSystemBytes = Math.max(silenceSystemBytes * 3, silenceSystemBytes + 4_096)` a celý blok `comparison.passes`. Poměr bajtů se nikde nepočítá.

Naměřené hodnoty na skutečných souborech v repu (ffmpeg 8.0.1, /Users/dan/.local/bin/ffmpeg):
| soubor | mean | max | s | dig. ticho | korelace |
|---|---|---|---|---|---|
| .runtime/audio-proof-20260821-committable-packaged/silence/…-system.webm | −91,0 | −91,0 | 5,10 | ANO | 0,000 |
| …/sound/…-system.webm | −20,0 | 0,0 | 5,04 | NE | **0,993** |
| .runtime/audio-proof-2026-08-24T11-22-38-333Z/silence/…-system.webm (hrála hudba) | **−33,8** | −20,8 | 3,24 | **NE → zahodit** | 0,019 |
| …/sound/…-mikrofon.webm | −59,0 | −46,0 | 5,40 | NE | 0,018 |
Práh 0,8 leží v propasti mezi 0,993 a 0,019; práh −40 dB mezi −20,0 a −91,0. Jedna analýza trvá ~165 ms.

Podloženo: `-91.0 dB` je podlaha volumedetectu pro s16 — ověřeno syntetickým `anullsrc` (−91,0/−91,0) i tónem −80 dB, který po Opusu spadne na nulu (taky −91,0). Podmínka „mean i max = −91,0" je tedy přesně „dekódovaný s16 jsou samé nuly".

🔴 ffmpeg u těchto souborů píše do stderr `Error parsing Opus packet header` (WebM z MediaRecorder chunků nemá kompletní hlavičku, `Duration: N/A`). Dekóduje správně. Selhání se pozná POUZE podle nenulového exit kódu, NIKDY podle neprázdného stderr.

Pozn.: přehrávání zůstává `playGlassThreeTimes` (3 souběžné `afplay`) — takto naměřeno 0,993. Kdyby brána někdy na tišším stroji spadla, první krok je snížit na JEDNO přehrání, NE snížit práh.

**Hotovo když:** `npm run test:audio` na tichém stroji projde a v proof-files.json je `silenceAttempts: 1`, korelace > 0,99 a mean systémové stopy zvučného běhu kolem −20 dB. Při hrající hudbě se v logu objeví „tichý běh zahozen (pokus 1/3)".

### 7. Fixtures + testy, které měří samotnou bránu

Zkopírovat tři skutečné důkazy z `.runtime` do `test/fixtures/` a commitnout (~80 kB celkem, `.runtime/` je gitignorovaný, `test/` ne):
 • `ticho-ciste-system.webm` ← .runtime/audio-proof-20260821-committable-packaged/silence/user-data/nahravky/2026-08-21T06-39-05-699Z-ae649b64-system.webm (1 351 B, −91,0 dB)
 • `zvuk-glass-system.webm` ← …/sound/…-e806fb48-system.webm (27 993 B, −20,0 dB)
 • `ticho-znecistene-system.webm` ← .runtime/audio-proof-2026-08-24T11-22-38-333Z/silence/user-data/nahravky/2026-08-24T11-22-39-718Z-914b66c6-system.webm (50 107 B, −33,8 dB) — TOHLE je doklad vady staré brány

`test/gate/audio-analysis.test.js` (samostatná sada, protože potřebuje ffmpeg):
 • `isDigitalSilence(volumeStats(ticho-ciste))` === true
 • `isDigitalSilence(volumeStats(ticho-znecistene))` === false, a `meanDb` je v rozmezí (−34,5; −33,0) — přímý regresní test na to, že brána znečištěný běh POZNÁ
 • `maxNormalizedCorrelation(decodePcm(zvuk-glass), decodePcm(Glass.aiff))` > 0,8 (očekáváno 0,99±0,01)
 • `maxNormalizedCorrelation(decodePcm(ticho-znecistene), Glass)` < 0,2 — cizí zvuk se neprohlásí za náš
 • `maxNormalizedCorrelation` vrací 0 pro digitální ticho (nulový rozptyl se nesmí projevit dělením nulou)
 • REGRESNÍ TEST STARÉ BRÁNY: `Math.max(1351*3, 1351+4096) = 5447 < 27993` prošlo, ale `Math.max(50107*3, 50107+4096) = 150321 > 27993` by vyhlásilo NEÚSPĚCH u funkční aplikace — natvrdo v testu spočítat a doložit komentářem, proč se poměr bajtů zrušil.

Skript `"test:gate": "vitest run --config vitest.gate.config.js"` (include `test/gate/**`). Do rychlé smyčky NEPATŘÍ — závisí na ffmpeg.

**Hotovo když:** `npm run test:gate` je zelený a doba běhu pod 3 s (6 souborů × ~165 ms).

### 8. ui-smoke: skutečné kliknutí místo element.click()

🔴 Proč: `element.click()` (ui-smoke.mjs:148, 160, 172) obchází hit-testing. Tlačítko zakryté overlayem, s `pointer-events:none`, s nulovou plochou nebo mimo `.panel-scroll` viewport se „naklikne" a test projde, i když člověk by na něj nedosáhl. `scripts/audio-smoke.mjs:131-155` už ukazuje správnou cestu (rect → `Input.dispatchMouseEvent`); ui-smoke ji jen nepřevzal.

Nahradit `clickByText` (142-154), `clickByAria` (156-166) i `clickFirstMeeting` (168-178) JEDNÍM pomocníkem:
```js
async function clickElement(client, label, locator) {
  const point = await client.evaluate(`(() => {
    const element = (${locator});
    if (!element) return { ok: false, reason: "prvek nenalezen" };
    if (element.disabled) return { ok: false, reason: "prvek je disabled" };
    element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { ok: false, reason: "nulová plocha" };
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight)
      return { ok: false, reason: \`bod [\${x|0},\${y|0}] je mimo viewport \${innerWidth}×\${innerHeight}\` };
    const hit = document.elementFromPoint(x, y);
    if (!hit || !(hit === element || element.contains(hit) || hit.contains(element)))
      return { ok: false, reason: \`bod překrývá <\${hit ? hit.tagName : "nic"}>\` };
    return { ok: true, x, y, text: element.textContent.replace(/\\s+/g, " ").trim() };
  })()`);
  if (!point.ok) throw new Error(`Nelze kliknout na „${label}“: ${point.reason}`);
  const at = { x: point.x, y: point.y, clickCount: 1 };
  await client.send("Input.dispatchMouseEvent", { ...at, type: "mouseMoved", button: "none", buttons: 0 });
  await client.send("Input.dispatchMouseEvent", { ...at, type: "mousePressed", button: "left", buttons: 1 });
  await client.send("Input.dispatchMouseEvent", { ...at, type: "mouseReleased", button: "left", buttons: 0 });
  observations.push({ action: "click", target: label, point: [Math.round(point.x), Math.round(point.y)] });
  await delay(120);
}
```
Tři klíčové rozdíly proti dnešku: `scrollIntoView` PŘED čtením rect (layout je po něm synchronně platný), kontrola viewportu a hlavně `elementFromPoint` — bez ní by nová brána měřila stejně málo jako stará.

Lokátory pro tři dnešní varianty (předávají se jako řetězec výrazu):
 • podle textu: `[...document.querySelectorAll("button")].find(b => b.textContent.replace(/\s+/g," ").trim().includes(<JSON text>) && !b.disabled)`
 • podle aria: `document.querySelector('[aria-label="<label>"]')`
 • první schůzka: `document.querySelector('button[aria-label^="Nahrát schůzku"]')`

Přepsat i `setSettings` (241-263): `auto.click()` a `ask.click()` → `clickElement(...)` s aria-label „Automaticky nahrávat schůzky z kalendáře" a „Ptát se před nahráváním ostatních hovorů". `<select>` (retence, projekt v LuTracku) zůstává programový `value` + `dispatchEvent(new Event("change"))` — nativní rozbalovací nabídka macOS není přes CDP dosažitelná; přidat k tomu komentář, aby to nikdo omylem „neopravil".

Coordinate space: CDP `Input.dispatchMouseEvent` bere CSS pixely top-level rámce, `getBoundingClientRect` vrací totéž. Panel má pevných 366×792, žádný zoom, žádné iframy — přepočet netřeba.

**Hotovo když:** `npm run test:ui` projde a `observations.json` obsahuje u každého kliknutí i souřadnice `point`. Grep přes scripts/ui-smoke.mjs nenajde `.click()`.

### 9. Sdílený spouštěč aplikace — ui-smoke musí jít spustit jedním příkazem

🔴 Dnes `scripts/ui-smoke.mjs` NELZE spustit: připojuje se na `http://127.0.0.1:9333/json/list` k aplikaci, kterou musí někdo ručně nastartovat s `--remote-debugging-port=9333`, a nikde v repu (package.json, KOSTRA.md, NAHRAVANI.md, README.md) není řečeno jak. Brána, kterou nikdo neumí pustit, není brána.

Vytvořit `scripts/electron-app.mjs` a přesunout do něj kód, který dnes existuje ve DVOU skoro shodných kopiích:
 • `class CdpClient` (audio-smoke 58-102 × ui-smoke 38-87 — liší se jen sběrem eventů; ponechat sběr, ui-smoke ho používá v diagnostice)
 • `delay`, `waitFor`, `freePort`, `cdpTargets`, `connectTarget`
 • `launchPackagedApp({ dataRoot, env })` — přímý spawn `release/LuDone Desktop.app/Contents/MacOS/Electron` s `--remote-debugging-port=<volný port>` (vzor audio-smoke 253-273), plus `waitForExit` s SIGTERM → SIGKILL (audio-smoke 197-220) a `persistApplicationLog`.

`ui-smoke.mjs` pak aplikaci spustí sám s prostředím:
 `LUDONE_E2E=1` (jinak `panelWindow.on("blur")` panel schová a CDP klikání ho odrovná — main.cjs:220),
 `LUDONE_RESET_ONBOARDING=1` (scénář začíná na „Rozhovory a čas.", tj. od onboardingu),
 `LUDONE_E2E_HARD_STOP_MS=120000`, `LUDONE_DATA_DIR=<čerstvý adresář pod .runtime/>`,
 a pro prázdný kalendář navíc `LUDONE_EMPTY_CALENDAR=1` + `LUDONE_EXPECT_EMPTY_CALENDAR=1`.
Na konci `window.ludone.testQuit()` + `waitForExit` (vzor audio-smoke 362-366). Port zjišťovat přes `freePort()`, ne pevných 9333 — dva souběžné běhy si jinak lezou do zelí. `LUDONE_DEBUG_PORT` ponechat jako override pro ruční ladění.

Duplicitu je nutné odstranit i proto, že jinak by E2 opravil `preserve-caught-error` nebo klikání jen v jedné z kopií.

**Hotovo když:** `npm run test:ui` a `npm run test:ui:empty` běží z čistého stroje bez jakékoli přípravy a po sobě uklidí (žádný zbylý proces Electron: `pgrep -f 'LuDone Desktop'` nic nevrátí).

### 10. Rozdělení bran: rychlá smyčka × checkpoint

`package.json` scripts — přesné názvy:
```json
"build":        "vite build",
"start":        "electron .",
"lint":         "eslint . --max-warnings=0",
"typecheck":    "tsc --noEmit -p tsconfig.json",
"test:unit":    "vitest run",
"verify":       "npm run lint && npm run typecheck && npm run test:unit && npm run build",

"package:mac":  "npm run build && node scripts/package-mac.mjs",
"test:gate":    "vitest run --config vitest.gate.config.js",
"test:ui":      "node scripts/ui-smoke.mjs",
"test:ui:empty":"LUDONE_EMPTY_CALENDAR=1 LUDONE_EXPECT_EMPTY_CALENDAR=1 node scripts/ui-smoke.mjs",
"test:audio":   "node scripts/audio-smoke.mjs",
"verify:full":  "npm run verify && npm run test:gate && npm run package:mac && npm run test:ui && npm run test:ui:empty && npm run test:audio"
```
RYCHLÁ SMYČKA = `npm run verify`. Pořadí od nejlevnějšího: lint 1,0 s + typecheck 0,30 s + unit ~6 s (z toho 0,12 s vlastní testy) + build 0,85 s ≈ **8 s** (naměřeno). Pouští se po každé změně, i uvnitř Codex běhu.
CHECKPOINT = `npm run verify:full`. Přidává test:gate (~3 s), package:mac (~10 s) a tři e2e běhy Electronu (ui-smoke ~40 s, ui-smoke:empty ~15 s, audio-smoke ~25 s při jednom pokusu, až ~55 s při opakování tichého běhu) ≈ **2–3 minuty**. Pouští se před commitem a před předáním etapy.

`test:audio` zůstává pod stávajícím jménem, ať se nerozbijí dosavadní zvyklosti a zadání.

**Hotovo když:** `npm run verify` doběhne pod 15 s a je zelený; `npm run verify:full` doběhne na Danově Macu zelený a vypíše cestu k proof-files.json a k observations.json.

### 11. GitHub Actions na macOS runneru — co tam jde a co ne

Vytvořit `.github/workflows/ci.yml` (repo dnes `.github` NEMÁ):
```yaml
name: CI
on: { push: { branches: [main] }, pull_request: {} }
permissions: { contents: read }
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }
jobs:
  rychla-smycka:
    runs-on: macos-15
    env: { ELECTRON_CACHE: ~/.cache/electron, ELECTRON_SKIP_BINARY_DOWNLOAD: "" }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: npm }
      - uses: actions/cache@v4
        with: { path: ~/.cache/electron, key: electron-${{ runner.os }}-${{ hashFiles('package-lock.json') }} }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:unit
      - run: npm run build
      - run: npm run package:mac      # ad-hoc `codesign --sign -` na runneru projde
```
🔴 Do workflow napsat komentářem, PROČ tam e2e brány nejsou (a neobcházet je):
```
# ZÁMĚRNĚ TU NENÍ `npm run test:audio`.
# audio-smoke potřebuje (1) fyzický vstup zvuku a systémový loopback
# a (2) udělené TCC oprávnění Mikrofon + Nahrávání obrazovky. GitHub macOS runner
# nemá zvukový hardware a TCC souhlas na něm nemá kdo odklepnout. Brána by tu
# buď hlásila falešný neúspěch, nebo by se musela změkčit — a měřidlo se neopravuje.
# audio-smoke a ui-smoke jsou LOKÁLNÍ checkpoint brána (`npm run verify:full`) na Danově Macu.
#
# `npm run test:ui` tu taky není: scénář v kroku „Spustit nahrávání“ očekává
# `Obě stopy ověřeny`, což znamená skutečný getUserMedia + getDisplayMedia — stejné omezení.
#
# `npm run test:gate` tu není proto, že runner nemá ffmpeg. Zapnout lze přidáním kroku:
#   - run: brew install ffmpeg   (několik minut) a pak `- run: npm run test:gate`.
```
Co v CI reálně chrání: lint, typecheck, unit testy nad pořadím chunků a nad důvěryhodností IPC, build a zabalení .app. To je právě ta část, kterou lze měřit bez hardwaru — a přesně proto je rozdělení bran z kroku 10 nutné.
Doporučený follow-up (NE součást E2): self-hosted runner na Danově Macu, kde by `verify:full` šlo pustit i z PR.

**Hotovo když:** Workflow je v repu, na PR se spustí a doběhne zelený; job trvá do 5 minut. `npm run test:audio` v žádném kroku není.

### 12. DŮKAZ, ŽE MĚŘIDLO MĚŘÍ — tři umělé regrese

Každou regresi zavést, spustit bránu, doložit ČERVENOU, vrátit zpět (`git checkout -- <soubor>`), spustit znovu a doložit ZELENOU. Výstupy zapsat do `MERIDLO.md` (nový soubor v repu) včetně doslovných hlášek.

(a) POŘADÍ CHUNKŮ — z `electron/recording-track.cjs` odstranit blok
    `if (sequence !== track.nextSequence) { throw new Error(...) }` a pustit `npm run test:unit`.
    ✅ OVĚŘENO NAOSTRO na kopii kódu: padne přesně 1 test — `recording-track.test.js ▸ „odmítne chunk mimo pořadí a stopu otráví"`, ostatních 20 zůstane zelených. Výstup `Tests 1 failed | 20 passed (21)`. Zásah je zacílený, ne plošný — to je ten důkaz.

(b) PŘEJMENOVANÉ TLAČÍTKO — v `src/features/recording/RecordingCard.jsx:449` změnit `Zastavit nahrávání` na cokoli jiného (např. `Stop nahrávání`), `npm run build`, `npm run package:mac`, `npm run test:ui`.
    Očekávaná chyba: `Nelze kliknout na „Zastavit nahrávání“: prvek nenalezen` na kroku ui-smoke.mjs:328, `observations.json` má `ok: false` a poslední pořízený screenshot je `05-recording-and-tracking.png`. (Bez opravy z kroku 8 by se dalo obejít i tím, že prvek existuje, ale je zakrytý — proto se pro úplnost dělá i varianta (b2): tlačítku dát `style="pointer-events:none"` a doložit, že stará brána s `element.click()` PROJDE a nová spadne s `bod překrývá <DIV>`.)

(c) HRAJÍCÍ HUDBA BĚHEM TICHÉHO BĚHU — spustit `npm run test:audio` a souběžně pustit `afplay /System/Library/Sounds/Sosumi.aiff` ve smyčce (nebo jakoukoli hudbu).
    Očekávané chování: brána tichý běh ZAHODÍ a zopakuje — v logu `tichý běh zahozen (pokus 1/3): mean −XX,X dB, max −YY,Y dB — během měření na stroji něco hrálo`. Po ztišení stroje projde na druhý či třetí pokus; když hudba hraje pořád, po třetím pokusu skončí s `Systémová stopa nebyla ani jednou úplně tichá. Ztlum stroj a pusť znovu.` a NIKDY nevyhlásí neúspěch nahrávání.
    ✅ ČÁST TOHOTO DŮKAZU JE UŽ V REPU a je pokrytá testem z kroku 7: `.runtime/audio-proof-2026-08-24T11-22-38-333Z/silence/user-data/nahravky/2026-08-24T11-22-39-718Z-914b66c6-system.webm` má 50 107 B a −33,8 dB mean / −20,8 dB max. Stará brána by proti němu požadovala `max(50107·3, 50107+4096) = 150 321 B`, zatímco funkční zvučný běh vyrobí 27 993 B → stará brána by u FUNKČNÍ aplikace vyhlásila NEÚSPĚCH. Nová brána ten soubor rozpozná jako znečištěný (`isDigitalSilence == false`) a zároveň ví, že to není náš zvuk (korelace 0,019).

Do `MERIDLO.md` napsat i tabulku naměřených hodnot z kroku 6 a jednu větu, která zakazuje budoucí „opravy": při selhání se opravuje VADA, ne práh; snížit `MIN_CORRELATION`, `MIN_SOUND_MEAN_DB` nebo zvednout `SILENCE_TOLERANCE_DB` je zakázané.

**Hotovo když:** MERIDLO.md obsahuje pro každou ze tří regresí doslovný červený výstup a doslovný zelený výstup po vrácení změny. `git status` je po dokončení čistý (žádná regrese v repu nezůstala).

## Měřítko etapy

Etapa je hotová, když na Danově Macu projde zelený `npm run verify:full` (rychlá smyčka + brána nad brány + zabalení + ui-smoke + ui-smoke:empty + audio-smoke) A ZÁROVEŇ všechny tři umělé regrese z kroku 12 jsou v MERIDLO.md doložené dvojicí červený/zelený výstup. Spustitelně:

  cd <worktree> && npm ci
  npm run verify        # < 15 s, kód 0, bez výstupu z lintu a tsc
  npm run verify:full   # 2–3 min, kód 0

Kontrolní čísla, která musí sedět (naměřeno předem na skutečném kódu, ne odhad):
  • eslint: 0 chyb, 0 varování (z výchozích 4 nálezů) — 1,0 s
  • tsc: 0 chyb (z výchozích 30) — 0,30 s
  • vitest: ≥21 testů zelených ve 4 souborech — 120 ms
  • vite build: ~0,36 s
  • proof-files.json: silence.system mean = max = −91,0 dB · sound.system mean ≈ −20 dB, korelace s Glass.aiff ≥ 0,95 (práh 0,8) · sound.mikrofon není digitální ticho
  • observations.json: každé kliknutí nese souřadnice `point`; `grep -c "\.click()" scripts/ui-smoke.mjs` == 0
  • CI job `rychla-smycka` na PR zelený do 5 minut, bez test:audio a bez test:ui

## Dotčené soubory

- `NOVÉ — eslint.config.js`
- `NOVÉ — tsconfig.json`
- `NOVÉ — types/ludone.d.ts`
- `NOVÉ — vitest.config.js`
- `NOVÉ — vitest.gate.config.js`
- `NOVÉ — electron/trusted-url.cjs`
- `NOVÉ — electron/recording-guard.cjs`
- `NOVÉ — electron/recording-track.cjs`
- `NOVÉ — scripts/electron-app.mjs (sdílený CdpClient + launchPackagedApp, dnes duplicitní ve dvou skriptech)`
- `NOVÉ — scripts/audio-analysis.mjs (volumeStats, decodePcm, maxNormalizedCorrelation, isDigitalSilence)`
- `NOVÉ — test/unit/elapsed.test.js`
- `NOVÉ — test/unit/trusted-url.test.js`
- `NOVÉ — test/unit/recording-guard.test.js`
- `NOVÉ — test/unit/recording-track.test.js`
- `NOVÉ — test/gate/audio-analysis.test.js`
- `NOVÉ — test/fixtures/ticho-ciste-system.webm (1 351 B)`
- `NOVÉ — test/fixtures/zvuk-glass-system.webm (27 993 B)`
- `NOVÉ — test/fixtures/ticho-znecistene-system.webm (50 107 B, −33,8 dB — doklad vady staré brány)`
- `NOVÉ — .github/workflows/ci.yml`
- `NOVÉ — MERIDLO.md (důkaz, že měřidlo měří)`
- `ZMĚNA — package.json (scripts lint/typecheck/test:unit/test:gate/test:ui/test:ui:empty/verify/verify:full + devDependencies)`
- `ZMĚNA — package-lock.json`
- `ZMĚNA — scripts/audio-smoke.mjs (smazat poměr bajtů ř. 402-426, doplnit smyčku pokusů + korelační brány, { cause }, freePort typy)`
- `ZMĚNA — scripts/ui-smoke.mjs (clickElement přes Input.dispatchMouseEvent, vlastní spuštění aplikace, { cause })`
- `ZMĚNA — electron/main.cjs (obálky nad vyříznuté moduly, chování beze změny)`
- `ZMĚNA — src/hooks/useElapsedTime.js (computeElapsedSeconds + přepis hooku bez setState v efektu)`
- `ZMĚNA — src/components/Icons.jsx (jedna JSDoc anotace baseProps)`
- `ZMĚNA — src/features/recording/RecordingCard.jsx (JSDoc Promise<void>, jedno cílené eslint-disable s důvodem)`
- `ZMĚNA — .gitignore (přidat .runtime/ do worktree větve, pokud tam po E0 chybí)`
- `BEZE ZMĚNY — scripts/package-mac.mjs (bundle identifier řeší D2 v jiné etapě, viz pasti)`
- `BEZE ZMĚNY — vite.config.js, index.html, src/styles.css`

## Pasti — co tuhle etapu shodí

- 🔴 VĚTEV. Kód aplikace je na `feat/kostra-appky` (2bb09ce), NE na `main` — `main` má jen ROZHODNUTI.md a zadání. Kdo založí E2 nad `main`, nemá co lintovat. Existuje ještě třetí, nesloučená větev `feat/zvuk-dukaz` (446c467) s vlastní kopií pokusů (`test-loopback.js`, `test-zarizeni.js`) — do E2 nepatří, ale nesmí se omylem vzít jako základ.
- 🔴 BUNDLE ID A macOS TCC. D2 mění `cz.ludone.desktop.prototype` → `cz.ludone.desktop` (scripts/package-mac.mjs:56). macOS váže souhlas s Mikrofonem a Nahráváním obrazovky na bundle identifier + podpis. Jakmile se identifikátor změní, PRVNÍ `npm run test:audio` po přebalení bude vypadat jako rozbitá audio brána, přestože jde o systémový dialog, který nemá kdo odklepnout. Toto je STOPKA pro autonomní běh: patří do DAN-TODO.md („jednou klikni Povolit u LuDone Desktop po přejmenování bundle id“), ne do opravy prahů.
- 🔴 ZMĚKČOVÁNÍ MĚŘIDLA. Když audio brána spadne, zakázané „opravy“ jsou: snížit MIN_CORRELATION pod 0,8, snížit MIN_SOUND_MEAN_DB pod −40, zvednout SILENCE_TOLERANCE_DB nad 0,05, vrátit poměr bajtů, nebo přidat retry na zvučný běh. Povolený první krok je zmenšit přehrávání ze tří souběžných afplay na jedno. Naměřená propast 0,993 vs 0,019 dává obrovskou rezervu — když brána spadne, opravdu je něco jinak.
- 🔴 KORELACE NA MIKROFON NEPATŘÍ. Naměřeno 0,018 u mikrofonní stopy ve zvučném běhu — akustické prosáknutí přes místnost korelaci zničí. Kdo bránu z hlouposti použije i na mikrofon, dostane trvale červený checkpoint u funkční aplikace. Mikrofon se hlídá jen tím, že se dekóduje, má ≥3 s a NENÍ digitální ticho.
- 🔴 ffmpeg NENÍ V PATH SAMOZŘEJMOST. Na Danově stroji je v /Users/dan/.local/bin/ffmpeg (verze 8.0.1), na GitHub runneru není vůbec. Brána musí na začátku ověřit `ffmpeg -version` a při chybějícím binárce hlásit srozumitelně, ne padnout na ENOENT uprostřed měření. `LUDONE_FFMPEG` musí být respektovaný override.
- 🔴 STDERR ffmpeg NENÍ CHYBA. U WebM z MediaRecorder chunků ffmpeg vždy vypíše `Error parsing Opus packet header` a `Duration: N/A` — soubor přesto správně dekóduje (změřeno na všech čtyřech důkazních souborech). Kdo bude selhání odvozovat od neprázdného stderr, zablokuje bránu natrvalo. Rozhoduje POUZE exit kód.
- 🔴 SOUBĚH SE ZBYTKEM BĚHU. E5 (server upload) a E6 (desktop přihlášení + fronta) běží podle D3 souběžně ve dvou worktrees a OBĚ sáhnou do `electron/main.cjs` a `electron/preload.cjs` — přesně do souborů, které E2 refaktoruje (vyříznutí trusted-url / recording-guard / recording-track). Buď E2 doběhne a smerguje se PŘED startem E5/E6, nebo se ten refaktor odloží. Dva zapisovatelé v jednom stromu si práci přepíšou.
- 🔴 ui-smoke DNES NIKDO NEUMÍ SPUSTIT. Skript se připojuje na port 9333 k aplikaci, kterou musí někdo předem nastartovat s `--remote-debugging-port`, a ani package.json, ani KOSTRA.md, ani NAHRAVANI.md, ani README.md to neříkají. Kdyby E2 jen přidal `"test:ui": "node scripts/ui-smoke.mjs"` bez spouštěče z kroku 9, vznikne brána, která visí na timeoutu a vypadá jako rozbitá aplikace.
- 🔴 LUDONE_E2E=1 JE POVINNÉ PRO ui-smoke. Bez něj `panelWindow.on("blur")` (main.cjs:220) panel schová, jakmile CDP klikne, a scénář se rozpadne v půlce na nesouvisejících hláškách. Stejně tak `LUDONE_RESET_ONBOARDING=1` — scénář začíná na uvítací obrazovce „Rozhovory a čas.“.
- 🔴 ESLint 10 × eslint-plugin-react. Instalace eslint-plugin-react@7.37.5 vedle ESLint 10 skončí na ERESOLVE (peer končí u ^9.7) a `--legacy-peer-deps` by tiše nainstaloval nekompatibilní plugin. ESLint 9 zase npm už hlásí jako nepodporovaný. Nesahat na `--force`; plugin prostě není součástí E2.
- 🔴 @eslint/js MUSÍ být přímá devDependency, jinak `eslint.config.js` spadne na ERR_MODULE_NOT_FOUND (ESLint 10 už ho nehoistuje). Vypadá to jako chyba konfigurace, je to chybějící balíček.
- 🔴 TYPOVÁ PAST PŘI VYŘÍZNUTÍ recording-track.cjs: `track.queue = operation.catch(...)` proti `queue: Promise.resolve()` dá TS2322 `Promise<void | {sequence,bytes}> not assignable to Promise<void>` — v původním main.cjs se to neprojevilo, protože objekt vznikal jinak. Řeší jediná anotace `/** @type {Promise<any>} */` nad vlastností `queue`. Bez ní bude Codex zbytečně přepisovat funkční frontu.
- 🔴 ESLint blok pro `test/**` se snadno zapomene — bez něj `Buffer` a `TextEncoder` v testech shodí lint na `no-undef` a vypadá to, jako by byly špatně testy. Změřeno: 6 falešných chyb.
- 🔴 ŽÁDNÝ jsdom, žádné @testing-library. Zadání zní „unit testy nad čistou logikou“; jakmile se do rychlé smyčky dostane DOM prostředí, přestane být rychlá a začne se testovat React místo naší logiky. Tikání hooku pokrývá ui-smoke assertem `00:00:01`.
- 🔴 UMĚLÉ REGRESE SE MUSÍ VRÁTIT ZPĚT. Po kroku 12 nesmí v repu zůstat ani odstraněná kontrola pořadí, ani přejmenované tlačítko, ani `pointer-events:none`. Kontrola: `git status` čistý a `npm run verify:full` zelený jako poslední akce etapy.
