# Důkaz obnovení přihlašovacího kroku po ztrátě relace — 14. 9. 2026

- Implementační commit: `8fdd78c`
- `premisaPlatila`: ano — oba návraty komponenty `Onboarding` měly ve stejné pozici stromu stejnou React identitu. Po dokončení úvodního průvodce bez platné relace se proto zachoval krok 5, ale nový režim už nepředával `onComplete`; tlačítko „Otevřít můj panel“ zůstalo bez účinku.
- `kontrolniNula`: změněny jsou jen React klíče úvodního a opakovaného přihlášení a skutečný React regresní test. Beze změny zůstaly E2E fake auth, `sessionMatchesAuthContext`, Electron main/preload, Settings, updater, fronta, aktivní nahrávání i `pendingSave`.
- Stav důkazu: 🧪 zelené testy. Skutečný produkční OAuth ani živé vypršení relace nebyly spuštěné.
- ⚠️ Úplná brána skončila úspěšně, ale v souběžném `queue-wiring` updater testu vypsal React tři existující upozornění na update mimo `act`; nebyla z této sondy a test ani bránu neshodila.

## Sabotáž bez React klíčů

Oba přidané klíče byly dočasně odstraněny. Tentýž test musel zčervenat; po měření byly klíče obnoveny.

Příkaz:

```sh
npm run test:unit -- tests/session-reentry.test.js -t "dokončení úvodního průvodce bez platné relace"
```

Doslovný výstup:

```text

> ludone-desktop-prototype@0.1.1 test:unit
> vitest run tests/session-reentry.test.js -t dokončení úvodního průvodce bez platné relace


 RUN  v3.2.7 /Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/nahravky-auth

 ❯ tests/session-reentry.test.js (12 tests | 1 failed | 11 skipped) 2192ms
   × návrat do aplikace po ztrátě session > dokončení úvodního průvodce bez platné relace otevře nový přihlašovací krok 2192ms
     → expected undefined to be 'Nejsi připojený' // Object.is equality
   ↓ návrat do aplikace po ztrátě session > po dokončeném onboardingu a bez session nabídne jediný přihlašovací krok
   ↓ návrat do aplikace po ztrátě session > po akci odhlášení v Nastavení živý panel přestane tvrdit Přihlášeno
   ↓ návrat do aplikace po ztrátě session > po akci přepnutí prostředí živý panel přestane tvrdit Přihlášeno
   ↓ návrat do aplikace po ztrátě session > během první kontroly session nenabízí anonymní akce
   ↓ návrat do aplikace po ztrátě session > příkaz z lišty během znovupřihlášení se po přihlášení neprovede opožděně
   ↓ návrat do aplikace po ztrátě session > starý příkaz z lišty se po odhlášení a novém přihlášení neopakuje
   ↓ návrat do aplikace po ztrátě session > návrat fokusu během čekání nepřeruší rozpracované znovupřihlášení
   ↓ návrat do aplikace po ztrátě session > po znovupřihlášení vrátí funkční panel a neopakuje onboarding
   ↓ návrat do aplikace po ztrátě session > s platnou session zachová dosavadní panel beze změny
   ↓ oznámení změny session mezi okny > otevřená okna zjistí vypršení bez změny fokusu a panel nabídne nové přihlášení
   ↓ oznámení změny session mezi okny > používá existující validovaný session kanál jako probuzení bez dat

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/session-reentry.test.js > návrat do aplikace po ztrátě session > dokončení úvodního průvodce bez platné relace otevře nový přihlašovací krok
AssertionError: expected undefined to be 'Nejsi připojený' // Object.is equality

- Expected: 
"Nejsi připojený"

+ Received: 
undefined

 ❯ tests/session-reentry.test.js:195:8
    193|   await vi.waitFor(() => {
    194|     expect(panel.document.querySelector(".auth-step h1")?.textContent.…
    195|       .toBe("Nejsi připojený");
       |        ^
    196|   });
    197| }

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 11 skipped (12)
   Start at  21:52:12
   Duration  3.13s (transform 123ms, setup 8ms, collect 640ms, tests 2.19s, environment 0ms, prepare 38ms)


EXIT_CODE=1
```

## Zaměřený test finální opravy

Příkaz:

```sh
npm run test:unit -- tests/session-reentry.test.js -t "dokončení úvodního průvodce bez platné relace" --reporter=verbose --hideSkippedTests
```

Doslovný výstup:

```text

> ludone-desktop-prototype@0.1.1 test:unit
> vitest run tests/session-reentry.test.js -t dokončení úvodního průvodce bez platné relace --reporter=verbose --hideSkippedTests


 RUN  v3.2.7 /Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/nahravky-auth

 ✓ tests/session-reentry.test.js > návrat do aplikace po ztrátě session > dokončení úvodního průvodce bez platné relace otevře nový přihlašovací krok 1209ms

 Test Files  1 passed (1)
      Tests  1 passed | 11 skipped (12)
   Start at  21:53:41
   Duration  2.34s (transform 159ms, setup 10ms, collect 817ms, tests 1.21s, environment 0ms, prepare 116ms)


EXIT_CODE=0
```

## Úplná repozitářová brána

Příkaz:

```sh
npm run gates
```

Doslovný výstup:

```text

> ludone-desktop-prototype@0.1.1 gates
> npm run lint && npm run typecheck && npm run test:unit && npm run preskocene


> ludone-desktop-prototype@0.1.1 lint
> eslint .


> ludone-desktop-prototype@0.1.1 typecheck
> tsc --noEmit -p jsconfig.json


> ludone-desktop-prototype@0.1.1 test:unit
> vitest run


 RUN  v3.2.7 /Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/nahravky-auth

 ✓ tests/logout-safety.test.js (13 tests) 1040ms
 ✓ tests/auth-identity-fallback.test.js (25 tests) 2409ms
stdout | tests/tracking-timer.test.js > vypínač DESKTOP_TIME_ENABLED > produkční wiring s hodnotou true skončí jako started
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-tracking-test-1hpEqX/cas/casovac.json

 ✓ tests/upload-client.test.js (66 tests) 2744ms
   ✓ resumable upload > části všech stop posílá přísně sériově  419ms
 ✓ tests/tracking-timer.test.js (58 tests) 2222ms
 ✓ tests/onboarding-missing-steps.test.js (20 tests) 1862ms
   ✓ dva chybějící kroky onboardingu > po skončení pokusu přestane neznámou adresu znovu zjišťovat  901ms
 ✓ tests/queue.test.js (96 tests) 2949ms
   ✓ perzistentní pumpa fronty > 🔴 jedna pumpa nepřekročí strop, i když je fronta delší  1132ms
 ✓ tests/packaging.test.js (6 tests) 3203ms
   ✓ kontrakt electron-builderu > bez podpisových proměnných provede nepodepsaný build plán a nespadne  1525ms
   ✓ kontrakt electron-builderu > úplná tajemství zapnou podpis a notarizaci, ale nikdy se nevypíší  1609ms
 ✓ tests/desktop-progress.test.js (3 tests) 3640ms
   ✓ 🧪 se nikdy nevykreslí jako ✅ a offline stránka má data uvnitř  1249ms
   ✓ chybějící údaj i nezměřitelné živé fakty skončí jako ‚neměřeno‘  1250ms
   ✓ dvojí běh generátoru vyrobí bajtově totožný soubor  1140ms
 ✓ tests/logout.test.js (23 tests | 1 skipped) 973ms
 ✓ tests/settings-persistence.test.js (29 tests) 702ms
 ✓ tests/session-reentry.test.js (12 tests) 2902ms
   ✓ návrat do aplikace po ztrátě session > dokončení úvodního průvodce bez platné relace otevře nový přihlašovací krok  1298ms
   ✓ oznámení změny session mezi okny > otevřená okna zjistí vypršení bez změny fokusu a panel nabídne nové přihlášení  1228ms
 ✓ tests/retention.test.js (32 tests) 942ms
 ✓ tests/recording-export.test.js (75 tests) 1156ms
 ✓ tests/auth-cancellation-storage.test.js (11 tests) 1034ms
 ✓ tests/recording-card.test.js (54 tests) 4019ms
   ✓ RecordingCard > úspěšné obnovení vrátí systémovou stopu bez restartu nahrávání  308ms
 ✓ tests/volba-firmy-v-relaci.test.js (11 tests) 407ms
 ✓ tests/tray-ikony.test.js (9 tests) 1259ms
   ✓ ikony v liště > generátor opakovaně vyrobí přesně bajty uložené v repozitáři  1208ms
 ✓ tests/settings.test.js (44 tests) 4378ms
   ✓ pravdivá identita v Nastavení > po opětovném zaostření znovu ověří session a nenechá připojený starý účet  522ms
 ✓ tests/auth-controller-wiring.test.js (48 tests) 259ms
 ✓ tests/auth-refresh.test.js (10 tests) 334ms
 ✓ tests/renderer-failure-feedback.test.js (29 tests) 2797ms
   ✓ 1 — neznámá fronta a legitimně prázdná fronta > oznámí odmítnuté čtení v panelu  368ms
   ✓ 5 — neuložený přepínač a úmyslné vypnutí > Spouštět po přihlášení do systému: výchozí vypnutí i úspěšné zapnutí a vypnutí zůstanou tiché  348ms
 ✓ tests/zkratky-bez-kryti.test.js (9 tests) 538ms
   ✓ zkratky v liště nejsou slib bez krytí > přijatá zkratka se ukáže v nabídce, nepřijatá ne  527ms
 ✓ tests/nazev-zarizeni.test.js (8 tests) 886ms
   ✓ název zvukového zařízení bez domýšlení hardwaru > známá jména zachová včetně okolních mezer, bez hlášení nebo zvýraznění  326ms
 ✓ tests/auth-error-screens.test.js (13 tests) 2460ms
   ✓ chybové obrazovky přihlášení > žádný z šesti důvodů nenechá panel prázdný  755ms
   ✓ chybové obrazovky přihlášení > tlačítko každé obrazovky má tón, který styly znají  519ms
 ✓ tests/settings-audio-test.test.js (10 tests) 2098ms
   ✓ opakovaná zkouška zvuku v Nastavení > kliknutí spustí sdílená dvě měřidla a zastavení uvolní všechny stopy  409ms
   ✓ opakovaná zkouška zvuku v Nastavení > ztráta stopy během zkoušky zastaví oba zdroje a ukáže chybu  422ms
 ✓ tests/manifest.test.js (10 tests) 266ms
 ✓ tests/queue-card-labels.test.js (5 tests) 652ms
   ✓ skloňování v panelové kartě fronty > zachová dnešní tvary pro 1  546ms
 ✓ tests/tray-space-warning.test.js (4 tests) 610ms
   ✓ upozornění na ikonu, která se nevešla do lišty > vykreslí samostatný přístupný stav a zachová obě původní rady  316ms
 ✓ tests/main-entry.test.js (1 test) 164ms
 ✓ tests/auth-wait-lifecycle.test.js (2 tests) 205ms
 ✓ tests/diagnostics.test.js (6 tests) 149ms
 ✓ tests/settings-audio-permissions.test.js (11 tests) 16ms
 ✓ tests/ipc-sender-guard.test.js (20 tests) 5ms
 ✓ tests/seznam-firem.test.js (10 tests) 4ms
 ✓ tests/ui-smoke.test.js (17 tests) 72ms
 ✓ tests/oauth-state.test.js (10 tests) 144ms
stderr | tests/queue-wiring.test.js > zjištění uložené OAuth session > nový stav relace rozliší platnost, mez vypršení a chybějící relaci bez mazání tokenů
[auth] Obnova relace selhala: reason=refresh-failed

 ✓ tests/tracking-card.test.js (10 tests) 2928ms
   ✓ LuTrack jako ukázka (compact=false) > hned po vykreslení bez interakce viditelně říká, že se čas nikam neuloží  946ms
   ✓ LuTrack jako ukázka (compact=false) > upozornění zůstane viditelné po spuštění i během odměřování času  338ms
   ✓ LuTrack jako ukázka (compact=false) > nenabízí skutečné ani smyšlené projekty a nehlásí projekt do okolí  395ms
 ✓ tests/kalendar-zrusen.test.js (4 tests | 1 skipped) 43ms
 ✓ tests/zjisteni-firmy.test.js (10 tests) 7ms
 ✓ tests/pisma.test.js (4 tests) 4ms
 ✓ tests/auth-panel-blur-guard.test.js (6 tests) 6ms
 ✓ tests/permissions.test.js (18 tests) 42ms
 ✓ tests/firma-pro-odeslani.test.js (8 tests) 5ms
 ✓ tests/brany-workflow.test.js (5 tests) 26ms
stderr | tests/queue-wiring.test.js > zjištění uložené OAuth session > vypršelá relace přes skutečné IPC ukáže vypršení v obou oknech a zůstane na disku
[auth] Obnova relace selhala: reason=refresh-failed

 ✓ tests/opravneni-k-odesilani.test.js (14 tests) 4ms
 ✓ tests/barvy.test.js (1 test) 186ms
 ✓ tests/pkce.test.js (5 tests) 9ms
 ✓ tests/proc-je-ticho.test.js (15 tests) 5ms
 ✓ tests/zapojeni-odhlaseni.test.js (12 tests | 1 skipped) 56ms
 ✓ tests/fronta-neztrati.test.js (8 tests) 3ms
 ✓ tests/electron-verze.test.js (3 tests) 3ms
 ✓ tests/fronta-symetrie.test.js (3 tests) 4ms
 ✓ tests/idle-panel.test.js (44 tests) 6800ms
   ✓ schválený klidový panel > po startu ověří uloženou session a v hlavičce ukáže přihlášený stav  303ms
   ✓ schválený klidový panel > při zapnutém odesílání otevře frontu s časem dalšího pokusu a retry jako dosud  543ms
   ✓ schválený klidový panel > Zkusit teď vyvolá skutečný retry a po jeho dokončení obnoví data  378ms
   ✓ schválený klidový panel > LuTrack před prvním spuštěním viditelně přizná ukázkové uložení  325ms
   ✓ schválený klidový panel > nepřipravený onboarding znepřístupní rychlou akci a starý příkaz později nespustí  434ms
   ✓ schválený klidový panel > chybu startu nahrávání neskrývá před vidícím uživatelem  444ms
 ✓ tests/recording-order-guard.test.js (1 test) 20ms
 ✓ tests/auth-timeout-guard.test.js (2 tests) 3ms
 ✓ tests/panel-blur-guard.test.js (6 tests) 3ms
stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":false} jako signed-out
[tray] 2026-09-14T19:52:48.536Z stav=signed-out nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=false

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true} jako idle
[tray] 2026-09-14T19:52:48.538Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"trackingOwners":[1]} jako tracking
[tray] 2026-09-14T19:52:48.538Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"preparing":[[1,{"cancelled":false}]]} jako recording
[tray] 2026-09-14T19:52:48.539Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"sessions":[["s",{"ownerId":1}]]} jako recording
[tray] 2026-09-14T19:52:48.539Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"queueWaitingCount":1} jako queue-waiting
[tray] 2026-09-14T19:52:48.539Z stav=queue-waiting nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=1 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"systemAudioLostOwners":[1]} jako idle
[tray] 2026-09-14T19:52:48.539Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"preparing":[[1,{"cancelled":false,"sources":["microphone","system"]}]],"systemAudioLostOwners":[1]} jako recording-audio-lost
[tray] 2026-09-14T19:52:48.539Z stav=recording-audio-lost nahrávání=true výpadekZvuku=true jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"trackingOwners":[1],"preparing":[[1,{"cancelled":false}]]} jako recording-tracking
[tray] 2026-09-14T19:52:48.539Z stav=recording-tracking nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"trackingOwners":[1],"preparing":[[1,{"cancelled":false,"sources":["microphone","system"]}]],"queueWaitingCount":2,"systemAudioLostOwners":[1]} jako recording-audio-lost
[tray] 2026-09-14T19:52:48.540Z stav=recording-audio-lost nahrávání=true výpadekZvuku=true jenMikrofon=false lutrack=true fronta=2 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"trackingOwners":[1],"queueWaitingCount":2} jako tracking
[tray] 2026-09-14T19:52:48.540Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=2 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":false,"trackingOwners":[1],"preparing":[[1,{"cancelled":false}]],"queueWaitingCount":2,"systemAudioLostOwners":[1]} jako signed-out
[tray] 2026-09-14T19:52:48.540Z stav=signed-out nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=true fronta=2 přihlášen=false

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"preparing":[[1,{"cancelled":true}]]} jako idle
[tray] 2026-09-14T19:52:48.540Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"sessions":[["s",{"ownerId":1,"finalizePromise":{}}]]} jako idle
[tray] 2026-09-14T19:52:48.540Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > jednostopé nahrávání odliší od plného nahrávání i výpadku: příprava
[tray] 2026-09-14T19:52:48.541Z stav=recording-microphone-only nahrávání=true výpadekZvuku=false jenMikrofon=true lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > jednostopé nahrávání odliší od plného nahrávání i výpadku: živá session
[tray] 2026-09-14T19:52:48.591Z stav=recording-microphone-only nahrávání=true výpadekZvuku=false jenMikrofon=true lutrack=false fronta=0 přihlášen=true

stdout | tests/queue-wiring.test.js > zjištění uložené OAuth session > přímý invoke změny prostředí neobejde blokaci běžícího LuTracku
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-yOF1kG/cas/casovac.json

stdout | tests/queue-wiring.test.js > zjištění uložené OAuth session > přímý invoke změny prostředí neobejde blokaci běžícího LuTracku
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-yOF1kG/cas/casovac.json

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > jednostopé nahrávání odliší od plného nahrávání i výpadku: souběh s LuTrackem
[tray] 2026-09-14T19:52:48.716Z stav=recording-microphone-only nahrávání=true výpadekZvuku=false jenMikrofon=true lutrack=true fronta=2 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > ukončená jednostopá session nepřidá odznak jinému plnému nahrávání: {"preparing":[[1,{"cancelled":true,"sources":["microphone"]}]]}
[tray] 2026-09-14T19:52:48.717Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > ukončená jednostopá session nepřidá odznak jinému plnému nahrávání: {"sessions":[["s",{"ownerId":1,"tracks":{},"finalizePromise":{}}]]}
[tray] 2026-09-14T19:52:48.717Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > skutečný výpadek má přednost před přijatým jednostopým nahráváním
[tray] 2026-09-14T19:52:48.717Z stav=recording-audio-lost nahrávání=true výpadekZvuku=true jenMikrofon=true lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > při souběhu spojí fakt LuTracku se skutečným nahráváním z hlavního procesu
[tray] 2026-09-14T19:52:48.717Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true
[tray] 2026-09-14T19:52:48.717Z stav=recording-tracking nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > pád rendereru > nechá lištu hlásit správný stav, ne ten poslední odeslaný
[tray] 2026-09-14T19:52:48.717Z stav=recording-tracking nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true
[tray] 2026-09-14T19:52:48.717Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true
[tray] 2026-09-14T19:52:48.717Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > pád rendereru > NEODHLÁSÍ uživatele — session drží hlavní proces
[tray] 2026-09-14T19:52:48.717Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true
[tray] 2026-09-14T19:52:48.717Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > pád rendereru > zapomene jen padlé okno, ostatní nechá běžet
[tray] 2026-09-14T19:52:48.718Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > pád rendereru > po pádu odstraní i rendererový fakt výpadku, ne výpadek cizí živé session
[tray] 2026-09-14T19:52:48.718Z stav=recording-audio-lost nahrávání=true výpadekZvuku=true jenMikrofon=false lutrack=false fronta=0 přihlášen=true
[tray] 2026-09-14T19:52:48.718Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stderr | tests/tray-authority.test.js > pád rendereru > po pádu odstraní i rendererový fakt výpadku, ne výpadek cizí živé session
[recording] Session uzavřena po události „pád rendereru“: mikrofon 0 B, systém 0 B.

stdout | tests/tray-authority.test.js > lišta se překresluje jen při skutečné změně > stejný stav podruhé už obrázek nesahá
[tray] 2026-09-14T19:52:48.719Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > lišta se překresluje jen při skutečné změně > změna stavu obrázek i popisek přepíše
[tray] 2026-09-14T19:52:48.719Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true
[tray] 2026-09-14T19:52:48.719Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne hodnotu, která není boolean, a fakta NECHÁ být
[tray] 2026-09-14T19:52:48.720Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > prázdný objekt uživatele NEODHLÁSÍ
[tray] 2026-09-14T19:52:48.720Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne undefined a nechá fakta být
[tray] 2026-09-14T19:52:48.720Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne null a nechá fakta být
[tray] 2026-09-14T19:52:48.720Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne "idle" a nechá fakta být
[tray] 2026-09-14T19:52:48.720Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne 42 a nechá fakta být
[tray] 2026-09-14T19:52:48.720Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne {"panelActionsAvailable":true,"signedIn":1,"systemAudioLost":false,"tracking":false} a nechá fakta být
[tray] 2026-09-14T19:52:48.720Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne {"signedIn":true} a nechá fakta být
[tray] 2026-09-14T19:52:48.720Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne {"signedIn":true,"tracking":false} a nechá fakta být
[tray] 2026-09-14T19:52:48.720Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne {"panelActionsAvailable":true,"signedIn":true,"systemAudioLost":false,"tracking":false,"state":"recording"} a nechá fakta být
[tray] 2026-09-14T19:52:48.720Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne {"panelActionsAvailable":true,"signedIn":true,"systemAudioLost":false,"tracking":false,"icon":"recording"} a nechá fakta být
[tray] 2026-09-14T19:52:48.721Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > platnou čtveřici boolean přijme
[tray] 2026-09-14T19:52:48.721Z stav=signed-out nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=false
[tray] 2026-09-14T19:52:48.721Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > výpadek přijme jen jako boolean, neplatný report stav nezmění a obnova vrátí nahrávání
[tray] 2026-09-14T19:52:48.721Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true
[tray] 2026-09-14T19:52:48.721Z stav=recording-audio-lost nahrávání=true výpadekZvuku=true jenMikrofon=false lutrack=false fronta=0 přihlášen=true
[tray] 2026-09-14T19:52:48.721Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > první vykreslení lišty > nastaví obrázek i popisek, i když se stav nezměnil
[tray] 2026-09-14T19:52:48.721Z stav=signed-out nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=false

stdout | tests/tray-authority.test.js > první vykreslení lišty > podruhé už na lištu nesahá
[tray] 2026-09-14T19:52:48.721Z stav=signed-out nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=false

 ✓ tests/tray-authority.test.js (81 tests) 194ms
stdout | tests/queue-wiring.test.js > viditelnost ikony a klikání na lištu > běžící LuTrack přepne položku na aktivní zastavení přes frontu tray příkazů
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-VhahGY/cas/casovac.json

 ✓ tests/zachyceni-zdroju.test.js (3 tests) 4ms
stderr | tests/queue-wiring.test.js > viditelnost ikony a klikání na lištu > preload po výjimce prvního příkazu doručí druhý i třetí s rozestupy a vyzvedne další dávku
[tray] Rychlou akci stop-recording se nepodařilo zpracovat: Odběratel prvního příkazu selhal

stderr | tests/queue-wiring.test.js > produkční zapojení odchozí fronty > prošlý access token neposkytne uploadu jako platný kontext
[auth] Obnova relace selhala: reason=refresh-failed

stdout | tests/queue-wiring.test.js > produkční zapojení odchozí fronty > po trvalém uzavření časovače zařadí přes produkční store přesný časový záznam
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-MiRlvJ/cas/casovac.json

stdout | tests/queue-wiring.test.js > produkční zapojení odchozí fronty > po trvalém uzavření časovače zařadí přes produkční store přesný časový záznam
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-MiRlvJ/cas/casovac.json

stdout | tests/queue-wiring.test.js > produkční zapojení odchozí fronty > selhání zařazení času za běhu otevře panel, i když se aplikace neukončuje
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-DvJrVs/cas/casovac.json

stdout | tests/queue-wiring.test.js > produkční zapojení odchozí fronty > selhání zařazení času za běhu otevře panel, i když se aplikace neukončuje
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-DvJrVs/cas/casovac.json

 ✓ tests/ikona-aplikace.test.js (4 tests) 14272ms
   ✓ ikona aplikace > build.mac.icon ukazuje na existující neprázdnou sadu ICNS  929ms
   ✓ ikona aplikace > generátor vytváří všech deset PNG a reprodukovatelné ICNS  1962ms
   ✓ ikona aplikace > změna sdílených bodů, šířky i plátna mění glyf aplikace i lišty  10397ms
   ✓ ikona aplikace > balení vytvoří chybějící ikonu dříve, než spustí electron-builder  984ms
stdout | tests/queue-wiring.test.js > bezpečné ukončení aplikace > selhání zařazení časového záznamu při ukončení otevře panel a vyžádá potvrzení
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-eXXNLr/cas/casovac.json

stdout | tests/queue-wiring.test.js > bezpečné ukončení aplikace > selhání zařazení časového záznamu při ukončení otevře panel a vyžádá potvrzení
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-eXXNLr/cas/casovac.json

stdout | tests/queue-wiring.test.js > produkční zapojení automatických aktualizací > běžící LuTrack odloží restart a po zastavení jej uplatní
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-bjoAi5/cas/casovac.json

stdout | tests/queue-wiring.test.js > produkční zapojení automatických aktualizací > běžící LuTrack odloží restart a po zastavení jej uplatní
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-bjoAi5/cas/casovac.json

stderr | tests/queue-wiring.test.js > viditelnost automatických aktualizací v panelu > stažení doručí verzi do živého panelu a tracking dál blokuje instalaci
An update to App inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act
An update to App inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act
An update to App inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

stdout | tests/queue-wiring.test.js > viditelnost automatických aktualizací v panelu > stažení doručí verzi do živého panelu a tracking dál blokuje instalaci
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-1whe8e/cas/casovac.json

 ✓ tests/queue-wiring.test.js (244 tests) 9531ms
   ✓ zjištění uložené OAuth session > vypršelá relace přes skutečné IPC ukáže vypršení v obou oknech a zůstane na disku  472ms
   ✓ zjištění uložené OAuth session > během souběžného odhlášení počká na stabilní výsledek  381ms
   ✓ zjištění uložené OAuth session > rozpracované čtení po neúspěšném odhlášení vrátí stabilní true  304ms

 Test Files  60 passed (60)
      Tests  1318 passed | 3 skipped (1321)
   Start at  21:52:36
   Duration  17.70s (transform 1.51s, setup 1.53s, collect 27.24s, tests 83.66s, environment 1.07s, prepare 7.05s)


> ludone-desktop-prototype@0.1.1 preskocene
> node scripts/preskocene.mjs

[preskocene] 3 přeskočených, baseline 3 — v pořádku.

EXIT_CODE=0
```

