# Důkaz viditelného stavu automatické aktualizace — 14. 9. 2026

- Implementační commit: `f3d802a`
- `premisaPlatila`: ano — hlavní proces dosud publikoval jen staženou verzi a opakované selhání kontroly; události `update-available` a `download-progress` se do panelu neposílaly.
- `kontrolniNula`: beze změny zůstaly bezpečnostní podmínky instalace pro běžící nahrávání, nedokončené uložení, LuTrack, odchozí frontu i generační závod. Nevznikl nový IPC kanál, ruční restart ani tlačítko kontroly; změna nezasáhla auth, LuTrack, backend, release publikaci ani design.
- Síť i updater byly v testech nahrazené mockem. Žádná živá kontrola, stažení ani instalace neproběhla.
- Stav důkazu: 🧪 zelené testy.

## Zaměřená sonda main → IPC → renderer

Příkaz:

```sh
npm run test:unit -- tests/queue-wiring.test.js -t "viditelnost automatických aktualizací v panelu" --reporter=verbose --hideSkippedTests
```

Doslovný výstup:

```text

> ludone-desktop-prototype@0.1.1 test:unit
> vitest run tests/queue-wiring.test.js -t viditelnost automatických aktualizací v panelu --reporter=verbose --hideSkippedTests


 RUN  v3.2.7 /Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/nahravky-auth

 ✓ tests/queue-wiring.test.js > viditelnost automatických aktualizací v panelu > verze je přítomná bez interakce (dokončený onboarding: true) 84ms
 ✓ tests/queue-wiring.test.js > viditelnost automatických aktualizací v panelu > verze je přítomná bez interakce (dokončený onboarding: false) 15ms
stdout | tests/queue-wiring.test.js > viditelnost automatických aktualizací v panelu > stažení doručí verzi do živého panelu a tracking dál blokuje instalaci
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-8njGCK/cas/casovac.json

 ✓ tests/queue-wiring.test.js > viditelnost automatických aktualizací v panelu > dostupnost a skutečný průběh projdou z updater události přes IPC do živého panelu 9ms
 ✓ tests/queue-wiring.test.js > viditelnost automatických aktualizací v panelu > opožděný počáteční snapshot nepřepíše novější událost o dostupné verzi 7ms
 ✓ tests/queue-wiring.test.js > viditelnost automatických aktualizací v panelu > stažení doručí verzi do živého panelu a recording dál blokuje instalaci 44ms
 ✓ tests/queue-wiring.test.js > viditelnost automatických aktualizací v panelu > stažení doručí verzi do živého panelu a tracking dál blokuje instalaci 30ms
 ✓ tests/queue-wiring.test.js > viditelnost automatických aktualizací v panelu > panel otevřený až po stažení vyzvedne uložený stav přes preload 17ms
 ✓ tests/queue-wiring.test.js > viditelnost automatických aktualizací v panelu > jedna ani dvě chyby nevarují; třetí varuje a úspěch hlášku i počítadlo vynuluje 8ms
 ✓ tests/queue-wiring.test.js > viditelnost automatických aktualizací v panelu > jednotlivé chyby oddělené úspěchem se nesčítají 14ms
 ✓ tests/queue-wiring.test.js > viditelnost automatických aktualizací v panelu > opakované odmítnutí downloadPromise se také dostane do panelu 7ms
 ✓ tests/queue-wiring.test.js > viditelnost automatických aktualizací v panelu > aktualizační IPC odmítne cizí frame i neočekávaný payload 4ms

 Test Files  1 passed (1)
      Tests  11 passed | 233 skipped (244)
   Start at  21:35:37
   Duration  1.18s (transform 170ms, setup 7ms, collect 714ms, tests 240ms, environment 0ms, prepare 64ms)


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

 ✓ tests/logout-safety.test.js (13 tests) 749ms
 ✓ tests/auth-identity-fallback.test.js (25 tests) 1857ms
stdout | tests/tracking-timer.test.js > vypínač DESKTOP_TIME_ENABLED > produkční wiring s hodnotou true skončí jako started
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-tracking-test-hQrTIO/cas/casovac.json

 ✓ tests/tracking-timer.test.js (58 tests) 1513ms
stderr | tests/queue-wiring.test.js > zjištění uložené OAuth session > nový stav relace rozliší platnost, mez vypršení a chybějící relaci bez mazání tokenů
[auth] Obnova relace selhala: reason=refresh-failed

 ✓ tests/desktop-progress.test.js (3 tests) 2237ms
   ✓ 🧪 se nikdy nevykreslí jako ✅ a offline stránka má data uvnitř  611ms
   ✓ chybějící údaj i nezměřitelné živé fakty skončí jako ‚neměřeno‘  850ms
   ✓ dvojí běh generátoru vyrobí bajtově totožný soubor  775ms
stderr | tests/queue-wiring.test.js > zjištění uložené OAuth session > vypršelá relace přes skutečné IPC ukáže vypršení v obou oknech a zůstane na disku
[auth] Obnova relace selhala: reason=refresh-failed

 ✓ tests/packaging.test.js (6 tests) 2389ms
   ✓ kontrakt electron-builderu > bez podpisových proměnných provede nepodepsaný build plán a nespadne  1172ms
   ✓ kontrakt electron-builderu > úplná tajemství zapnou podpis a notarizaci, ale nikdy se nevypíší  1158ms
 ✓ tests/session-reentry.test.js (11 tests) 1519ms
   ✓ oznámení změny session mezi okny > otevřená okna zjistí vypršení bez změny fokusu a panel nabídne nové přihlášení  1139ms
 ✓ tests/onboarding-missing-steps.test.js (20 tests) 1808ms
   ✓ dva chybějící kroky onboardingu > po skončení pokusu přestane neznámou adresu znovu zjišťovat  877ms
 ✓ tests/idle-panel.test.js (44 tests) 1370ms
 ✓ tests/settings.test.js (44 tests) 1887ms
 ✓ tests/logout.test.js (23 tests | 1 skipped) 694ms
stdout | tests/queue-wiring.test.js > zjištění uložené OAuth session > přímý invoke změny prostředí neobejde blokaci běžícího LuTracku
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-VlkK6R/cas/casovac.json

stdout | tests/queue-wiring.test.js > zjištění uložené OAuth session > přímý invoke změny prostředí neobejde blokaci běžícího LuTracku
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-VlkK6R/cas/casovac.json

 ✓ tests/recording-card.test.js (54 tests) 2261ms
 ✓ tests/renderer-failure-feedback.test.js (29 tests) 657ms
 ✓ tests/settings-persistence.test.js (29 tests) 752ms
 ✓ tests/retention.test.js (32 tests) 867ms
 ✓ tests/auth-cancellation-storage.test.js (11 tests) 745ms
 ✓ tests/auth-error-screens.test.js (13 tests) 443ms
 ✓ tests/tray-ikony.test.js (9 tests) 479ms
   ✓ ikony v liště > generátor opakovaně vyrobí přesně bajty uložené v repozitáři  453ms
stdout | tests/queue-wiring.test.js > viditelnost ikony a klikání na lištu > běžící LuTrack přepne položku na aktivní zastavení přes frontu tray příkazů
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-ZFO8aT/cas/casovac.json

 ✓ tests/auth-refresh.test.js (10 tests) 232ms
stderr | tests/queue-wiring.test.js > viditelnost ikony a klikání na lištu > preload po výjimce prvního příkazu doručí druhý i třetí s rozestupy a vyzvedne další dávku
[tray] Rychlou akci stop-recording se nepodařilo zpracovat: Odběratel prvního příkazu selhal

 ✓ tests/recording-export.test.js (75 tests) 1102ms
 ✓ tests/volba-firmy-v-relaci.test.js (11 tests) 293ms
 ✓ tests/queue.test.js (96 tests) 2040ms
   ✓ perzistentní pumpa fronty > 🔴 jedna pumpa nepřekročí strop, i když je fronta delší  818ms
 ✓ tests/auth-controller-wiring.test.js (48 tests) 180ms
 ✓ tests/main-entry.test.js (1 test) 46ms
 ✓ tests/upload-client.test.js (66 tests) 2013ms
 ✓ tests/auth-wait-lifecycle.test.js (2 tests) 93ms
 ✓ tests/diagnostics.test.js (6 tests) 42ms
 ✓ tests/settings-audio-test.test.js (10 tests) 595ms
 ✓ tests/manifest.test.js (10 tests) 73ms
 ✓ tests/kalendar-zrusen.test.js (4 tests | 1 skipped) 8ms
 ✓ tests/zkratky-bez-kryti.test.js (9 tests) 128ms
 ✓ tests/queue-card-labels.test.js (5 tests) 169ms
 ✓ tests/fronta-neztrati.test.js (8 tests) 4ms
stderr | tests/queue-wiring.test.js > produkční zapojení odchozí fronty > prošlý access token neposkytne uploadu jako platný kontext
[auth] Obnova relace selhala: reason=refresh-failed

 ✓ tests/nazev-zarizeni.test.js (8 tests) 346ms
 ✓ tests/ui-smoke.test.js (17 tests) 9ms
 ✓ tests/settings-audio-permissions.test.js (11 tests) 7ms
 ✓ tests/panel-blur-guard.test.js (6 tests) 2ms
 ✓ tests/permissions.test.js (18 tests) 7ms
 ✓ tests/oauth-state.test.js (10 tests) 11ms
 ✓ tests/ipc-sender-guard.test.js (20 tests) 7ms
 ✓ tests/seznam-firem.test.js (10 tests) 5ms
 ✓ tests/pisma.test.js (4 tests) 7ms
 ✓ tests/zapojeni-odhlaseni.test.js (12 tests | 1 skipped) 5ms
stdout | tests/queue-wiring.test.js > produkční zapojení odchozí fronty > po trvalém uzavření časovače zařadí přes produkční store přesný časový záznam
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-bVGLv6/cas/casovac.json

stdout | tests/queue-wiring.test.js > produkční zapojení odchozí fronty > po trvalém uzavření časovače zařadí přes produkční store přesný časový záznam
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-bVGLv6/cas/casovac.json

 ✓ tests/zjisteni-firmy.test.js (10 tests) 7ms
stdout | tests/queue-wiring.test.js > produkční zapojení odchozí fronty > selhání zařazení času za běhu otevře panel, i když se aplikace neukončuje
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-NJkcud/cas/casovac.json

 ✓ tests/barvy.test.js (1 test) 4ms
stdout | tests/queue-wiring.test.js > produkční zapojení odchozí fronty > selhání zařazení času za běhu otevře panel, i když se aplikace neukončuje
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-NJkcud/cas/casovac.json

 ✓ tests/pkce.test.js (5 tests) 3ms
 ✓ tests/auth-panel-blur-guard.test.js (6 tests) 3ms
 ✓ tests/auth-timeout-guard.test.js (2 tests) 1ms
stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":false} jako signed-out
[tray] 2026-09-14T19:34:37.292Z stav=signed-out nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=false

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true} jako idle
[tray] 2026-09-14T19:34:37.299Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

 ✓ tests/tray-space-warning.test.js (4 tests) 409ms
stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"trackingOwners":[1]} jako tracking
[tray] 2026-09-14T19:34:37.299Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"preparing":[[1,{"cancelled":false}]]} jako recording
[tray] 2026-09-14T19:34:37.299Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"sessions":[["s",{"ownerId":1}]]} jako recording
[tray] 2026-09-14T19:34:37.299Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"queueWaitingCount":1} jako queue-waiting
[tray] 2026-09-14T19:34:37.300Z stav=queue-waiting nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=1 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"systemAudioLostOwners":[1]} jako idle
[tray] 2026-09-14T19:34:37.300Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"preparing":[[1,{"cancelled":false,"sources":["microphone","system"]}]],"systemAudioLostOwners":[1]} jako recording-audio-lost
[tray] 2026-09-14T19:34:37.300Z stav=recording-audio-lost nahrávání=true výpadekZvuku=true jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"trackingOwners":[1],"preparing":[[1,{"cancelled":false}]]} jako recording-tracking
[tray] 2026-09-14T19:34:37.300Z stav=recording-tracking nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"trackingOwners":[1],"preparing":[[1,{"cancelled":false,"sources":["microphone","system"]}]],"queueWaitingCount":2,"systemAudioLostOwners":[1]} jako recording-audio-lost
[tray] 2026-09-14T19:34:37.300Z stav=recording-audio-lost nahrávání=true výpadekZvuku=true jenMikrofon=false lutrack=true fronta=2 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"trackingOwners":[1],"queueWaitingCount":2} jako tracking
[tray] 2026-09-14T19:34:37.301Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=2 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":false,"trackingOwners":[1],"preparing":[[1,{"cancelled":false}]],"queueWaitingCount":2,"systemAudioLostOwners":[1]} jako signed-out
[tray] 2026-09-14T19:34:37.301Z stav=signed-out nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=true fronta=2 přihlášen=false

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"preparing":[[1,{"cancelled":true}]]} jako idle
[tray] 2026-09-14T19:34:37.301Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"sessions":[["s",{"ownerId":1,"finalizePromise":{}}]]} jako idle
[tray] 2026-09-14T19:34:37.301Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > jednostopé nahrávání odliší od plného nahrávání i výpadku: příprava
[tray] 2026-09-14T19:34:37.301Z stav=recording-microphone-only nahrávání=true výpadekZvuku=false jenMikrofon=true lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > jednostopé nahrávání odliší od plného nahrávání i výpadku: živá session
[tray] 2026-09-14T19:34:37.301Z stav=recording-microphone-only nahrávání=true výpadekZvuku=false jenMikrofon=true lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > jednostopé nahrávání odliší od plného nahrávání i výpadku: souběh s LuTrackem
[tray] 2026-09-14T19:34:37.302Z stav=recording-microphone-only nahrávání=true výpadekZvuku=false jenMikrofon=true lutrack=true fronta=2 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > ukončená jednostopá session nepřidá odznak jinému plnému nahrávání: {"preparing":[[1,{"cancelled":true,"sources":["microphone"]}]]}
[tray] 2026-09-14T19:34:37.302Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > ukončená jednostopá session nepřidá odznak jinému plnému nahrávání: {"sessions":[["s",{"ownerId":1,"tracks":{},"finalizePromise":{}}]]}
[tray] 2026-09-14T19:34:37.302Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > skutečný výpadek má přednost před přijatým jednostopým nahráváním
[tray] 2026-09-14T19:34:37.303Z stav=recording-audio-lost nahrávání=true výpadekZvuku=true jenMikrofon=true lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > při souběhu spojí fakt LuTracku se skutečným nahráváním z hlavního procesu
[tray] 2026-09-14T19:34:37.303Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true
[tray] 2026-09-14T19:34:37.303Z stav=recording-tracking nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > pád rendereru > nechá lištu hlásit správný stav, ne ten poslední odeslaný
[tray] 2026-09-14T19:34:37.304Z stav=recording-tracking nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true
[tray] 2026-09-14T19:34:37.304Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true
[tray] 2026-09-14T19:34:37.304Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > pád rendereru > NEODHLÁSÍ uživatele — session drží hlavní proces
[tray] 2026-09-14T19:34:37.304Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true
[tray] 2026-09-14T19:34:37.304Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > pád rendereru > zapomene jen padlé okno, ostatní nechá běžet
[tray] 2026-09-14T19:34:37.304Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > pád rendereru > po pádu odstraní i rendererový fakt výpadku, ne výpadek cizí živé session
[tray] 2026-09-14T19:34:37.304Z stav=recording-audio-lost nahrávání=true výpadekZvuku=true jenMikrofon=false lutrack=false fronta=0 přihlášen=true
[tray] 2026-09-14T19:34:37.304Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stderr | tests/tray-authority.test.js > pád rendereru > po pádu odstraní i rendererový fakt výpadku, ne výpadek cizí živé session
[recording] Session uzavřena po události „pád rendereru“: mikrofon 0 B, systém 0 B.

stdout | tests/tray-authority.test.js > lišta se překresluje jen při skutečné změně > stejný stav podruhé už obrázek nesahá
[tray] 2026-09-14T19:34:37.305Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > lišta se překresluje jen při skutečné změně > změna stavu obrázek i popisek přepíše
[tray] 2026-09-14T19:34:37.305Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true
[tray] 2026-09-14T19:34:37.305Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne hodnotu, která není boolean, a fakta NECHÁ být
[tray] 2026-09-14T19:34:37.306Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > prázdný objekt uživatele NEODHLÁSÍ
[tray] 2026-09-14T19:34:37.306Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne undefined a nechá fakta být
[tray] 2026-09-14T19:34:37.306Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne null a nechá fakta být
[tray] 2026-09-14T19:34:37.306Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne "idle" a nechá fakta být
[tray] 2026-09-14T19:34:37.306Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne 42 a nechá fakta být
[tray] 2026-09-14T19:34:37.306Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne {"panelActionsAvailable":true,"signedIn":1,"systemAudioLost":false,"tracking":false} a nechá fakta být
[tray] 2026-09-14T19:34:37.306Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne {"signedIn":true} a nechá fakta být
[tray] 2026-09-14T19:34:37.306Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne {"signedIn":true,"tracking":false} a nechá fakta být
[tray] 2026-09-14T19:34:37.307Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne {"panelActionsAvailable":true,"signedIn":true,"systemAudioLost":false,"tracking":false,"state":"recording"} a nechá fakta být
[tray] 2026-09-14T19:34:37.307Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne {"panelActionsAvailable":true,"signedIn":true,"systemAudioLost":false,"tracking":false,"icon":"recording"} a nechá fakta být
[tray] 2026-09-14T19:34:37.307Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > platnou čtveřici boolean přijme
[tray] 2026-09-14T19:34:37.307Z stav=signed-out nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=false
[tray] 2026-09-14T19:34:37.307Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > výpadek přijme jen jako boolean, neplatný report stav nezmění a obnova vrátí nahrávání
[tray] 2026-09-14T19:34:37.307Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true
[tray] 2026-09-14T19:34:37.307Z stav=recording-audio-lost nahrávání=true výpadekZvuku=true jenMikrofon=false lutrack=false fronta=0 přihlášen=true
[tray] 2026-09-14T19:34:37.307Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > první vykreslení lišty > nastaví obrázek i popisek, i když se stav nezměnil
[tray] 2026-09-14T19:34:37.307Z stav=signed-out nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=false

stdout | tests/tray-authority.test.js > první vykreslení lišty > podruhé už na lištu nesahá
[tray] 2026-09-14T19:34:37.307Z stav=signed-out nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=false

 ✓ tests/tracking-card.test.js (10 tests) 1143ms
   ✓ LuTrack jako ukázka (compact=false) > hned po vykreslení bez interakce viditelně říká, že se čas nikam neuloží  328ms
 ✓ tests/proc-je-ticho.test.js (15 tests) 18ms
 ✓ tests/tray-authority.test.js (81 tests) 48ms
 ✓ tests/firma-pro-odeslani.test.js (8 tests) 3ms
 ✓ tests/opravneni-k-odesilani.test.js (14 tests) 4ms
 ✓ tests/brany-workflow.test.js (5 tests) 4ms
 ✓ tests/electron-verze.test.js (3 tests) 1ms
 ✓ tests/recording-order-guard.test.js (1 test) 2ms
 ✓ tests/fronta-symetrie.test.js (3 tests) 2ms
 ✓ tests/zachyceni-zdroju.test.js (3 tests) 3ms
 ✓ tests/ikona-aplikace.test.js (4 tests) 6483ms
   ✓ ikona aplikace > build.mac.icon ukazuje na existující neprázdnou sadu ICNS  744ms
   ✓ ikona aplikace > generátor vytváří všech deset PNG a reprodukovatelné ICNS  1583ms
   ✓ ikona aplikace > změna sdílených bodů, šířky i plátna mění glyf aplikace i lišty  3584ms
   ✓ ikona aplikace > balení vytvoří chybějící ikonu dříve, než spustí electron-builder  571ms
stdout | tests/queue-wiring.test.js > bezpečné ukončení aplikace > selhání zařazení časového záznamu při ukončení otevře panel a vyžádá potvrzení
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-3aRPKG/cas/casovac.json

stdout | tests/queue-wiring.test.js > bezpečné ukončení aplikace > selhání zařazení časového záznamu při ukončení otevře panel a vyžádá potvrzení
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-3aRPKG/cas/casovac.json

stdout | tests/queue-wiring.test.js > produkční zapojení automatických aktualizací > běžící LuTrack odloží restart a po zastavení jej uplatní
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-1DBR8V/cas/casovac.json

stdout | tests/queue-wiring.test.js > produkční zapojení automatických aktualizací > běžící LuTrack odloží restart a po zastavení jej uplatní
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-1DBR8V/cas/casovac.json

stdout | tests/queue-wiring.test.js > viditelnost automatických aktualizací v panelu > stažení doručí verzi do živého panelu a tracking dál blokuje instalaci
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-hSWlTr/cas/casovac.json

 ✓ tests/queue-wiring.test.js (244 tests) 6882ms

 Test Files  60 passed (60)
      Tests  1317 passed | 3 skipped (1320)
   Start at  21:34:31
   Duration  8.41s (transform 1.05s, setup 574ms, collect 12.65s, tests 44.67s, environment 317ms, prepare 3.12s)


> ludone-desktop-prototype@0.1.1 preskocene
> node scripts/preskocene.mjs

[preskocene] 3 přeskočených, baseline 3 — v pořádku.

EXIT_CODE=0
```

