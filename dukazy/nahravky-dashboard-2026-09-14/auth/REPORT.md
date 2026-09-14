# Důkaz auth pro upload nahrávek

Datum: 14. 9. 2026
Větev: `fix/nahravky-prihlaseni`
Implementační commity: `99ac8e7`, `e2e7ed7`

## Kontrolní zpráva

- `premisaPlatila`: ano — packaged `.app` bez shellového prostředí skutečně volila starý `mcp:read`; stará relace se v hlavním procesu považovala za přihlášenou jen podle issueru.
- `kontrolniNula`: řešení nemění LuTrack, server, design ani IPC kanály; při `invalid_client` nevzniká automatický login ani druhý pokus se starým refresh tokenem.
- `kontrolniNulaBezpecnost`: neznámé `body.error` ani `error_description` se nepropíší do chyby; allowlistovaný `invalid_client` se obslouží stejně z token endpointu i validovaného loopback callbacku.
- 🧪 Ověřeno automatickými branami a mockovanou sítí. Ostré OAuth přihlášení ani UI/audio smoke nebyly spuštěny.

## Doslovný výpis akceptačního příkazu

Příkaz:

```sh
npm run gates
```

Výstup:

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

 ✓ tests/recording-export.test.js (75 tests) 1040ms
 ✓ tests/desktop-progress.test.js (3 tests) 2701ms
   ✓ 🧪 se nikdy nevykreslí jako ✅ a offline stránka má data uvnitř  933ms
   ✓ chybějící údaj i nezměřitelné živé fakty skončí jako ‚neměřeno‘  687ms
   ✓ dvojí běh generátoru vyrobí bajtově totožný soubor  1079ms
 ✓ tests/queue.test.js (96 tests) 2641ms
   ✓ perzistentní pumpa fronty > 🔴 jedna pumpa nepřekročí strop, i když je fronta delší  972ms
stdout | tests/tracking-timer.test.js > vypínač DESKTOP_TIME_ENABLED > produkční wiring s hodnotou true skončí jako started
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-tracking-test-UqkcfV/cas/casovac.json

 ✓ tests/tracking-timer.test.js (58 tests) 1859ms
stderr | tests/queue-wiring.test.js > zjištění uložené OAuth session > nový stav relace rozliší platnost, mez vypršení a chybějící relaci bez mazání tokenů
[auth] Obnova relace selhala: reason=refresh-failed

stderr | tests/queue-wiring.test.js > zjištění uložené OAuth session > vypršelá relace přes skutečné IPC ukáže vypršení v obou oknech a zůstane na disku
[auth] Obnova relace selhala: reason=refresh-failed

 ✓ tests/onboarding-missing-steps.test.js (20 tests) 2135ms
   ✓ dva chybějící kroky onboardingu > doplní adresu přihlášení, i když ji hlavní proces zveřejní později  321ms
   ✓ dva chybějící kroky onboardingu > po skončení pokusu přestane neznámou adresu znovu zjišťovat  885ms
 ✓ tests/idle-panel.test.js (44 tests) 2044ms
 ✓ tests/logout.test.js (23 tests | 1 skipped) 946ms
 ✓ tests/packaging.test.js (6 tests) 4002ms
   ✓ kontrakt electron-builderu > bez podpisových proměnných provede nepodepsaný build plán a nespadne  2154ms
   ✓ kontrakt electron-builderu > úplná tajemství zapnou podpis a notarizaci, ale nikdy se nevypíší  1795ms
 ✓ tests/logout-safety.test.js (13 tests) 772ms
 ✓ tests/session-reentry.test.js (11 tests) 1967ms
   ✓ návrat do aplikace po ztrátě session > starý příkaz z lišty se po odhlášení a novém přihlášení neopakuje  323ms
   ✓ oznámení změny session mezi okny > otevřená okna zjistí vypršení bez změny fokusu a panel nabídne nové přihlášení  1149ms
stdout | tests/queue-wiring.test.js > zjištění uložené OAuth session > přímý invoke změny prostředí neobejde blokaci běžícího LuTracku
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-7OpvRn/cas/casovac.json

stdout | tests/queue-wiring.test.js > zjištění uložené OAuth session > přímý invoke změny prostředí neobejde blokaci běžícího LuTracku
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-7OpvRn/cas/casovac.json

 ✓ tests/auth-cancellation-storage.test.js (11 tests) 846ms
 ✓ tests/settings-persistence.test.js (29 tests) 675ms
 ✓ tests/retention.test.js (32 tests) 860ms
stdout | tests/queue-wiring.test.js > viditelnost ikony a klikání na lištu > běžící LuTrack přepne položku na aktivní zastavení přes frontu tray příkazů
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-cGgw70/cas/casovac.json

 ✓ tests/settings.test.js (44 tests) 3755ms
   ✓ poctivý výsledek odhlášení v Nastavení > potvrzené odhlášení na Macu i serveru zachová dosavadní úspěch  409ms
stderr | tests/queue-wiring.test.js > viditelnost ikony a klikání na lištu > preload po výjimce prvního příkazu doručí druhý i třetí s rozestupy a vyzvedne další dávku
[tray] Rychlou akci stop-recording se nepodařilo zpracovat: Odběratel prvního příkazu selhal

 ✓ tests/upload-client.test.js (66 tests) 1984ms
 ✓ tests/tray-ikony.test.js (9 tests) 424ms
   ✓ ikony v liště > generátor opakovaně vyrobí přesně bajty uložené v repozitáři  375ms
 ✓ tests/volba-firmy-v-relaci.test.js (11 tests) 261ms
 ✓ tests/recording-card.test.js (54 tests) 3942ms
 ✓ tests/tracking-card.test.js (10 tests) 913ms
   ✓ LuTrack jako ukázka (compact=false) > hned po vykreslení bez interakce viditelně říká, že se čas nikam neuloží  382ms
 ✓ tests/nazev-zarizeni.test.js (8 tests) 220ms
 ✓ tests/auth-wait-lifecycle.test.js (2 tests) 59ms
 ✓ tests/renderer-failure-feedback.test.js (29 tests) 857ms
 ✓ tests/auth-error-screens.test.js (13 tests) 650ms
 ✓ tests/auth-controller-wiring.test.js (48 tests) 172ms
 ✓ tests/diagnostics.test.js (6 tests) 39ms
 ✓ tests/manifest.test.js (10 tests) 62ms
 ✓ tests/main-entry.test.js (1 test) 74ms
 ✓ tests/settings-audio-test.test.js (10 tests) 545ms
 ✓ tests/ui-smoke.test.js (17 tests) 11ms
 ✓ tests/tray-space-warning.test.js (4 tests) 194ms
stderr | tests/queue-wiring.test.js > produkční zapojení odchozí fronty > prošlý access token neposkytne uploadu jako platný kontext
[auth] Obnova relace selhala: reason=refresh-failed

 ✓ tests/seznam-firem.test.js (10 tests) 6ms
 ✓ tests/zkratky-bez-kryti.test.js (9 tests) 87ms
 ✓ tests/queue-card-labels.test.js (5 tests) 91ms
 ✓ tests/firma-pro-odeslani.test.js (8 tests) 4ms
 ✓ tests/settings-audio-permissions.test.js (11 tests) 11ms
 ✓ tests/auth-refresh.test.js (10 tests) 271ms
 ✓ tests/kalendar-zrusen.test.js (4 tests | 1 skipped) 7ms
 ✓ tests/permissions.test.js (18 tests) 10ms
 ✓ tests/pisma.test.js (4 tests) 12ms
 ✓ tests/oauth-state.test.js (10 tests) 5ms
 ✓ tests/zjisteni-firmy.test.js (10 tests) 5ms
 ✓ tests/ipc-sender-guard.test.js (20 tests) 11ms
 ✓ tests/auth-panel-blur-guard.test.js (6 tests) 3ms
 ✓ tests/pkce.test.js (5 tests) 4ms
 ✓ tests/brany-workflow.test.js (5 tests) 5ms
stdout | tests/queue-wiring.test.js > produkční zapojení odchozí fronty > po trvalém uzavření časovače zařadí přes produkční store přesný časový záznam
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-4fM8GA/cas/casovac.json

 ✓ tests/auth-identity-fallback.test.js (25 tests) 1504ms
stdout | tests/queue-wiring.test.js > produkční zapojení odchozí fronty > po trvalém uzavření časovače zařadí přes produkční store přesný časový záznam
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-4fM8GA/cas/casovac.json

 ✓ tests/opravneni-k-odesilani.test.js (14 tests) 5ms
 ✓ tests/proc-je-ticho.test.js (15 tests) 11ms
 ✓ tests/fronta-neztrati.test.js (8 tests) 7ms
stdout | tests/queue-wiring.test.js > produkční zapojení odchozí fronty > selhání zařazení času za běhu otevře panel, i když se aplikace neukončuje
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-bTGUTm/cas/casovac.json

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":false} jako signed-out
[tray] 2026-09-14T19:26:32.920Z stav=signed-out nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=false

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true} jako idle
[tray] 2026-09-14T19:26:32.922Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"trackingOwners":[1]} jako tracking
[tray] 2026-09-14T19:26:32.922Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"preparing":[[1,{"cancelled":false}]]} jako recording
[tray] 2026-09-14T19:26:32.922Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"sessions":[["s",{"ownerId":1}]]} jako recording
[tray] 2026-09-14T19:26:32.922Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"queueWaitingCount":1} jako queue-waiting
[tray] 2026-09-14T19:26:32.923Z stav=queue-waiting nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=1 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"systemAudioLostOwners":[1]} jako idle
[tray] 2026-09-14T19:26:32.923Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"preparing":[[1,{"cancelled":false,"sources":["microphone","system"]}]],"systemAudioLostOwners":[1]} jako recording-audio-lost
[tray] 2026-09-14T19:26:32.923Z stav=recording-audio-lost nahrávání=true výpadekZvuku=true jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"trackingOwners":[1],"preparing":[[1,{"cancelled":false}]]} jako recording-tracking
[tray] 2026-09-14T19:26:32.923Z stav=recording-tracking nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"trackingOwners":[1],"preparing":[[1,{"cancelled":false,"sources":["microphone","system"]}]],"queueWaitingCount":2,"systemAudioLostOwners":[1]} jako recording-audio-lost
[tray] 2026-09-14T19:26:32.923Z stav=recording-audio-lost nahrávání=true výpadekZvuku=true jenMikrofon=false lutrack=true fronta=2 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"trackingOwners":[1],"queueWaitingCount":2} jako tracking
[tray] 2026-09-14T19:26:32.924Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=2 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":false,"trackingOwners":[1],"preparing":[[1,{"cancelled":false}]],"queueWaitingCount":2,"systemAudioLostOwners":[1]} jako signed-out
[tray] 2026-09-14T19:26:32.924Z stav=signed-out nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=true fronta=2 přihlášen=false

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"preparing":[[1,{"cancelled":true}]]} jako idle
[tray] 2026-09-14T19:26:32.924Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > odvodí stav {"signedIn":true,"sessions":[["s",{"ownerId":1,"finalizePromise":{}}]]} jako idle
[tray] 2026-09-14T19:26:32.924Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > jednostopé nahrávání odliší od plného nahrávání i výpadku: příprava
[tray] 2026-09-14T19:26:32.925Z stav=recording-microphone-only nahrávání=true výpadekZvuku=false jenMikrofon=true lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > jednostopé nahrávání odliší od plného nahrávání i výpadku: živá session
[tray] 2026-09-14T19:26:32.925Z stav=recording-microphone-only nahrávání=true výpadekZvuku=false jenMikrofon=true lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > jednostopé nahrávání odliší od plného nahrávání i výpadku: souběh s LuTrackem
[tray] 2026-09-14T19:26:32.925Z stav=recording-microphone-only nahrávání=true výpadekZvuku=false jenMikrofon=true lutrack=true fronta=2 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > ukončená jednostopá session nepřidá odznak jinému plnému nahrávání: {"preparing":[[1,{"cancelled":true,"sources":["microphone"]}]]}
[tray] 2026-09-14T19:26:32.926Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > ukončená jednostopá session nepřidá odznak jinému plnému nahrávání: {"sessions":[["s",{"ownerId":1,"tracks":{},"finalizePromise":{}}]]}
[tray] 2026-09-14T19:26:32.926Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > skutečný výpadek má přednost před přijatým jednostopým nahráváním
[tray] 2026-09-14T19:26:32.926Z stav=recording-audio-lost nahrávání=true výpadekZvuku=true jenMikrofon=true lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > stav vlastní hlavní proces, ne renderer > při souběhu spojí fakt LuTracku se skutečným nahráváním z hlavního procesu
[tray] 2026-09-14T19:26:32.926Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true
[tray] 2026-09-14T19:26:32.926Z stav=recording-tracking nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

 ✓ tests/panel-blur-guard.test.js (6 tests) 2ms
stdout | tests/tray-authority.test.js > pád rendereru > nechá lištu hlásit správný stav, ne ten poslední odeslaný
[tray] 2026-09-14T19:26:32.926Z stav=recording-tracking nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true
[tray] 2026-09-14T19:26:32.926Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true
[tray] 2026-09-14T19:26:32.926Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > pád rendereru > NEODHLÁSÍ uživatele — session drží hlavní proces
[tray] 2026-09-14T19:26:32.926Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true
[tray] 2026-09-14T19:26:32.926Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > pád rendereru > zapomene jen padlé okno, ostatní nechá běžet
[tray] 2026-09-14T19:26:32.927Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > pád rendereru > po pádu odstraní i rendererový fakt výpadku, ne výpadek cizí živé session
[tray] 2026-09-14T19:26:32.927Z stav=recording-audio-lost nahrávání=true výpadekZvuku=true jenMikrofon=false lutrack=false fronta=0 přihlášen=true
[tray] 2026-09-14T19:26:32.927Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > lišta se překresluje jen při skutečné změně > stejný stav podruhé už obrázek nesahá
[tray] 2026-09-14T19:26:32.927Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > lišta se překresluje jen při skutečné změně > změna stavu obrázek i popisek přepíše
[tray] 2026-09-14T19:26:32.927Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true
[tray] 2026-09-14T19:26:32.927Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne hodnotu, která není boolean, a fakta NECHÁ být
[tray] 2026-09-14T19:26:32.928Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > prázdný objekt uživatele NEODHLÁSÍ
[tray] 2026-09-14T19:26:32.928Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne undefined a nechá fakta být
[tray] 2026-09-14T19:26:32.929Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne null a nechá fakta být
[tray] 2026-09-14T19:26:32.929Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stderr | tests/tray-authority.test.js > pád rendereru > po pádu odstraní i rendererový fakt výpadku, ne výpadek cizí živé session
[recording] Session uzavřena po události „pád rendereru“: mikrofon 0 B, systém 0 B.

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne "idle" a nechá fakta být
[tray] 2026-09-14T19:26:32.929Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne 42 a nechá fakta být
[tray] 2026-09-14T19:26:32.929Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne {"panelActionsAvailable":true,"signedIn":1,"systemAudioLost":false,"tracking":false} a nechá fakta být
[tray] 2026-09-14T19:26:32.929Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne {"signedIn":true} a nechá fakta být
[tray] 2026-09-14T19:26:32.929Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne {"signedIn":true,"tracking":false} a nechá fakta být
[tray] 2026-09-14T19:26:32.929Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne {"panelActionsAvailable":true,"signedIn":true,"systemAudioLost":false,"tracking":false,"state":"recording"} a nechá fakta být
[tray] 2026-09-14T19:26:32.929Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > odmítne {"panelActionsAvailable":true,"signedIn":true,"systemAudioLost":false,"tracking":false,"icon":"recording"} a nechá fakta být
[tray] 2026-09-14T19:26:32.929Z stav=idle nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > platnou čtveřici boolean přijme
[tray] 2026-09-14T19:26:32.930Z stav=signed-out nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=false
[tray] 2026-09-14T19:26:32.930Z stav=tracking nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=true fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > kanál faktů nesmí být tray:set-state pod jiným jménem > výpadek přijme jen jako boolean, neplatný report stav nezmění a obnova vrátí nahrávání
[tray] 2026-09-14T19:26:32.930Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true
[tray] 2026-09-14T19:26:32.930Z stav=recording-audio-lost nahrávání=true výpadekZvuku=true jenMikrofon=false lutrack=false fronta=0 přihlášen=true
[tray] 2026-09-14T19:26:32.930Z stav=recording nahrávání=true výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=true

stdout | tests/tray-authority.test.js > první vykreslení lišty > nastaví obrázek i popisek, i když se stav nezměnil
[tray] 2026-09-14T19:26:32.930Z stav=signed-out nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=false

stdout | tests/tray-authority.test.js > první vykreslení lišty > podruhé už na lištu nesahá
[tray] 2026-09-14T19:26:32.930Z stav=signed-out nahrávání=false výpadekZvuku=false jenMikrofon=false lutrack=false fronta=0 přihlášen=false

stdout | tests/queue-wiring.test.js > produkční zapojení odchozí fronty > selhání zařazení času za běhu otevře panel, i když se aplikace neukončuje
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-bTGUTm/cas/casovac.json

 ✓ tests/tray-authority.test.js (81 tests) 24ms
 ✓ tests/zapojeni-odhlaseni.test.js (12 tests | 1 skipped) 6ms
 ✓ tests/barvy.test.js (1 test) 3ms
 ✓ tests/electron-verze.test.js (3 tests) 2ms
 ✓ tests/recording-order-guard.test.js (1 test) 2ms
 ✓ tests/auth-timeout-guard.test.js (2 tests) 1ms
 ✓ tests/fronta-symetrie.test.js (3 tests) 2ms
 ✓ tests/zachyceni-zdroju.test.js (3 tests) 3ms
 ✓ tests/ikona-aplikace.test.js (4 tests) 8475ms
   ✓ ikona aplikace > build.mac.icon ukazuje na existující neprázdnou sadu ICNS  1729ms
   ✓ ikona aplikace > generátor vytváří všech deset PNG a reprodukovatelné ICNS  2650ms
   ✓ ikona aplikace > změna sdílených bodů, šířky i plátna mění glyf aplikace i lišty  3580ms
   ✓ ikona aplikace > balení vytvoří chybějící ikonu dříve, než spustí electron-builder  515ms
stdout | tests/queue-wiring.test.js > bezpečné ukončení aplikace > selhání zařazení časového záznamu při ukončení otevře panel a vyžádá potvrzení
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-kE62Te/cas/casovac.json

stdout | tests/queue-wiring.test.js > bezpečné ukončení aplikace > selhání zařazení časového záznamu při ukončení otevře panel a vyžádá potvrzení
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-kE62Te/cas/casovac.json

stdout | tests/queue-wiring.test.js > produkční zapojení automatických aktualizací > běžící LuTrack odloží restart a po zastavení jej uplatní
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-lu8DUn/cas/casovac.json

stdout | tests/queue-wiring.test.js > produkční zapojení automatických aktualizací > běžící LuTrack odloží restart a po zastavení jej uplatní
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-lu8DUn/cas/casovac.json

stderr | tests/queue-wiring.test.js > viditelnost automatických aktualizací v panelu > stažení doručí verzi do živého panelu a recording dál blokuje instalaci
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
[tracking] Uloženo: /var/folders/l9/yvbg4nr522z6qzg0bnqr12zw0000gn/T/ludone-main-queue-test-lHLJBA/cas/casovac.json

 ✓ tests/queue-wiring.test.js (242 tests) 7874ms
   ✓ zjištění uložené OAuth session > vypršelá relace přes skutečné IPC ukáže vypršení v obou oknech a zůstane na disku  349ms

 Test Files  60 passed (60)
      Tests  1315 passed | 3 skipped (1318)
   Start at  21:26:25
   Duration  10.21s (transform 1.45s, setup 932ms, collect 18.57s, tests 55.11s, environment 289ms, prepare 3.47s)


> ludone-desktop-prototype@0.1.1 preskocene
> node scripts/preskocene.mjs

[preskocene] 3 přeskočených, baseline 3 — v pořádku.

EXIT CODE: 0

```
