# Rozpory původních kontrol a jejich uzavření

🧪 Původních 111 FAIL je nyní vyřešeno rovnocennou migrací schválenou Danem. Celá sada má 1708 PASS / 0 FAIL / 3 původní skipy. Čistá brána nad `56800d3` prošla (exit 0). Historická tabulka níže uchovává doslovné první chyby původního checkpointu; samotné první chyby nejsou analýzou příčin.

| Příčina | Konkrétní řešení a review |
|---|---|
| Původní Astra DOM/okno/pořadí/šířka | Stejné funkční podmínky přes skutečné F selektory a původní testové služby; [UI mapa](MIGRACE-UI-TESTU.md), [queue mapa](MIGRACE-QUEUE-TESTU.md) |
| Panel získal oprávněné settings služby | Záporné testy měří samostatné cizí BrowserWindow stejného původu; všechny podřízené rámce, payloady a scoped identity zachované |
| Starý tray harness a priority | Skutečné main dependencies, F záznam/saving/decision/offline/attention souběhy; původních109 případů zachováno a22 přidáno; [mapa](MIGRACE-AUTHORITY-TESTU.md) |
| Ztracený feedback při prázdné frontě a dlouhý obsah | Skutečné produkční opravy `2d26ba7`, původní funkční testy znovu zelené |
| Oslabené exact-once během migrace | Nezávislé review zachytilo P2; obnoveno přesné jedno volání, nikoli pouze přítomnost události; [review](REVIEW-AUTH-UI.md) |
| Runtime komprese PNG, lint návrhových podkladů a závislosti | Node24.19.0, explicitní importy/global vazby bez ESLint výjimek, minimální bezpečné patch verze; oficiální runtime ověřen na Macu i Linux CI; golden beze změny |

Automatické review první dávku geometrie odmítlo jako možné oslabení. Dávka se neprovedla; následně schválené silnější měření obsahuje přesnou F výšku, intrinsic budget, dosažitelnost a scroll. Počty původních případů zachované, žádné nové skipy/baseline. Přechod F není povolením vynechat bezpečnostní podmínky.

## Historický checkpoint před migrací

Celkem 1682: 1568 PASS, 111 FAIL, 3 původní skipy. Assertions zůstávají zachované.

| Soubor | Kontrola | Doslovná první chyba |
|---|---|---|
| diagnostics.test.js | produkční zapojení diagnostiky přijímá oba kanály jen z Nastavení, bez payloadu a bez HTTP sondy | AssertionError: expected 'handleValidated("diagnostics:get", ["…' to contain 'handleValidated("diagnostics:get", ["…' |
| diagnostics.test.js | produkční zapojení diagnostiky název zařízení čte přes os.hostname v hlavním procesu bez payloadu | AssertionError: expected 'const {\n  app,\n  BrowserWindow,\n  …' to contain 'handleValidated("settings:get-device-…' |
| idle-panel.test.js | schválený klidový panel ukazuje nahrávání, připravovaný LuTrack a pravdivý náhled dne v Astra pořadí | TypeError: Cannot read properties of null (reading 'children') |
| idle-panel.test.js | schválený klidový panel po startu ověří uloženou session a v hlavičce ukáže přihlášený stav | AssertionError: expected undefined to be 'signed-in' // Object.is equality |
| idle-panel.test.js | schválený klidový panel bez uložené session nezobrazí identitu z pouhé localStorage jako přihlášenou | AssertionError: expected undefined to be 'Nejsi připojený' // Object.is equality |
| idle-panel.test.js | schválený klidový panel přihlášený a nepřihlášený stav jsou viditelně odlišné bez vazby na formulaci | AssertionError: expected undefined to be 'signed-in' // Object.is equality |
| idle-panel.test.js | schválený klidový panel při odmítnutém dotazu na session skončí viditelně jako nepřihlášený | AssertionError: expected undefined to be 'Nejsi připojený' // Object.is equality |
| idle-panel.test.js | schválený klidový panel po právě úspěšném OAuth přepne hlavičku do přihlášeného stavu | AssertionError: expected undefined to be 'signed-in' // Object.is equality |
| idle-panel.test.js | schválený klidový panel úspěšnou session bez identity po OAuth nepovažuje za odhlášenou | AssertionError: expected undefined to be 'signed-in' // Object.is equality |
| idle-panel.test.js | schválený klidový panel po právě úspěšném OAuth bez jména použije skutečný e-mail | AssertionError: expected undefined to be 'signed-in' // Object.is equality |
| idle-panel.test.js | schválený klidový panel bez denních dat nevyrenderuje žádný souhrn ani náhradní nulu | AssertionError: the given combination of arguments (undefined and string) is invalid for this assertion. You can use an array, a map, an object, a set, a string, or a weakset instead of a string |
| idle-panel.test.js | schválený klidový panel má textové Nastavení a zachovává kontrakt selektorů ui-smoke | AssertionError: expected ' Nahrávat schůzku' to be 'Nahrát' // Object.is equality |
| idle-panel.test.js | schválený klidový panel samé běžné čekající položky zobrazí jako dnes | AssertionError: expected undefined to be '2 čekají' // Object.is equality |
| idle-panel.test.js | schválený klidový panel ukáže lidský zásah a nezapočítá ho mezi běžně čekající položky | AssertionError: expected undefined to be '1 čeká · 1 čeká na potvrzení' // Object.is equality |
| idle-panel.test.js | schválený klidový panel při zapnutém odesílání otevře frontu s časem dalšího pokusu a retry jako dosud | AssertionError: expected undefined to be '1 čeká' // Object.is equality |
| idle-panel.test.js | schválený klidový panel při vypnutém odesílání bez naplánovaného času ukáže důvod bez dalšího pokusu a bez tlačítka | AssertionError: expected undefined to be '1 čeká' // Object.is equality |
| idle-panel.test.js | schválený klidový panel při vypnutém odesílání s budoucím naplánovaným časem ukáže důvod bez dalšího pokusu a bez tlačítka | AssertionError: expected undefined to be '1 čeká' // Object.is equality |
| idle-panel.test.js | schválený klidový panel Zkusit teď vyvolá skutečný retry a po jeho dokončení obnoví data | AssertionError: expected undefined to be '1 čeká' // Object.is equality |
| idle-panel.test.js | schválený klidový panel vrácený neúspěšný výsledek retry disabled ukáže uživateli jeho důvod | AssertionError: expected undefined to be '1 čeká' // Object.is equality |
| idle-panel.test.js | schválený klidový panel vrácený neúspěšný výsledek retry idle ukáže uživateli jeho důvod | AssertionError: expected undefined to be '1 čeká' // Object.is equality |
| idle-panel.test.js | schválený klidový panel vrácený neúspěšný výsledek retry failed ukáže uživateli jeho důvod | AssertionError: expected undefined to be '1 čeká' // Object.is equality |
| idle-panel.test.js | schválený klidový panel vrácený neúspěšný výsledek retry paused ukáže uživateli jeho důvod | AssertionError: expected undefined to be '1 čeká' // Object.is equality |
| idle-panel.test.js | schválený klidový panel vrácený neúspěšný výsledek retry retry_scheduled ukáže uživateli jeho důvod | AssertionError: expected undefined to be '1 čeká' // Object.is equality |
| idle-panel.test.js | schválený klidový panel vrácený budoucí neúspěšný výsledek retry future_failure ukáže bezpečný důvod | AssertionError: expected undefined to be '1 čeká' // Object.is equality |
| idle-panel.test.js | schválený klidový panel vrácený budoucí neúspěšný výsledek retry future_failure ukáže bezpečný důvod | AssertionError: expected undefined to be '1 čeká' // Object.is equality |
| idle-panel.test.js | schválený klidový panel vrácený neúspěch nezablokuje následným čtením fronty | AssertionError: expected undefined to be '1 čeká' // Object.is equality |
| idle-panel.test.js | schválený klidový panel vrácený neúspěch zůstane viditelný i po vyprázdnění fronty | AssertionError: expected undefined to be '1 čeká' // Object.is equality |
| idle-panel.test.js | schválený klidový panel zpětná vazba starého retry zmizí po skutečně novém snapshotu fronty | AssertionError: expected undefined to be '1 čeká' // Object.is equality |
| idle-panel.test.js | schválený klidový panel čekání na vlastníka je od běžného čekání viditelně oddělené a retry ho nenabízí | AssertionError: expected undefined to be '1 čeká · 1 čeká na potvrzení' // Object.is equality |
| idle-panel.test.js | schválený klidový panel samotné čekání na vlastníka ukáže přesnou velikost, důvod a žádný retry | AssertionError: expected undefined to be '1 čeká na potvrzení' // Object.is equality |
| idle-panel.test.js | schválený klidový panel prázdnou frontu zobrazí jako Vše odesláno | AssertionError: expected undefined to be 'Vše odesláno' // Object.is equality |
| idle-panel.test.js | schválený klidový panel viditelný panel přečte změnu background pumpy i s připravovaným LuTrackem | AssertionError: expected undefined to be '1 čeká' // Object.is equality |
| idle-panel.test.js | schválený klidový panel znovupřihlášení nahlásí výšku celého obsahu včetně tlačítka | AssertionError: expected undefined to be 'Nejsi připojený' // Object.is equality |
| idle-panel.test.js | schválený klidový panel běžný onboarding si zachová původní třířádkovou výšku bez přetečení | AssertionError: expected { buttonFits: true, …(6) } to deeply equal { buttonFits: true, …(6) } |
| idle-panel.test.js | schválený klidový panel po přepnutí přihlašovacího stavu přepočítá nahlášenou výšku | AssertionError: expected undefined to be 'Nejsi připojený' // Object.is equality |
| idle-panel.test.js | schválený klidový panel Astra panel drží návrhovou výšku a změna obsahu neposune místo ve scrollu | AssertionError: expected "vi.fn()" to be called once with arguments: [ 700 ] |
| idle-panel.test.js | schválený klidový panel připravovaný LuTrack je viditelný a jeho budoucí ovládání zůstává vypnuté | AssertionError: the given combination of arguments (undefined and string) is invalid for this assertion. You can use an array, a map, an object, a set, a string, or a weakset instead of a string |
| idle-panel.test.js | schválený klidový panel rychlé příkazy LuTracku nepřekročí neaktivní přípravu | AssertionError: the given combination of arguments (undefined and string) is invalid for this assertion. You can use an array, a map, an object, a set, a string, or a weakset instead of a string |
| idle-panel.test.js | schválený klidový panel nepřipravený onboarding znepřístupní rychlou akci a starý příkaz později nespustí | AssertionError: the given combination of arguments (undefined and string) is invalid for this assertion. You can use an array, a map, an object, a set, a string, or a weakset instead of a string |
| ipc-sender-guard.test.js | ochrana odesílatele nahrávacího IPC všechny IPC kanály z produkčního kódu registruje přes validační wrapper | AssertionError: expected [ 'auth:begin', 'auth:cancel', …(69) ] to deeply equal [ 'auth:begin', 'auth:cancel', …(61) ] |
| ipc-sender-guard.test.js | ochrana odesílatele nahrávacího IPC 🔴 výběr firmy přijímá jen hlavní rám okna Nastavení | AssertionError: expected 'const {\n  app,\n  BrowserWindow,\n  …' to contain 'handleValidated("upload-companies:sel…' |
| ipc-sender-guard.test.js | ochrana odesílatele nahrávacího IPC preference nahrávky a čtení výchozí firmy mají jen oprávnění Nastavení | AssertionError: expected 'const {\n  app,\n  BrowserWindow,\n  …' to contain 'handleValidated("recordings:configure…' |
| queue-wiring.test.js | zobrazení přehledu nahrávek z hlavního panelu otevře širší okno rovnou na nahrávkách a nepřijímá neznámé záložky | TypeError: Cannot read properties of undefined (reading 'getSize') |
| queue-wiring.test.js | zobrazení přehledu nahrávek z hlavního panelu otevře nastavení zvukových zdrojů přímo na odpovídající záložce | TypeError: Cannot read properties of undefined (reading 'loadCalls') |
| queue-wiring.test.js | zobrazení přehledu nahrávek z hlavního panelu otevře Můj den a návrat do Teď povolí pouze ověřenému oknu Nastavení | AssertionError: expected { hash: 'settings', …(1) } to deeply equal { hash: 'settings', …(1) } |
| queue-wiring.test.js | zobrazení přehledu nahrávek z hlavního panelu přesměruje už otevřené okno bez nového načtení | AssertionError: expected "vi.fn()" to be called once with arguments: [ 'settings:select-tab', 'account' ] |
| queue-wiring.test.js | uložený vypínač odesílání v hlavním procesu IPC odmítne cizí okno, podřízený rám, neplatný boolean i argumenty navíc | AssertionError: expected [Function] to throw an error |
| queue-wiring.test.js | zjištění uložené OAuth session vypršelá relace přes skutečné IPC ukáže vypršení v obou oknech a zůstane na disku | AssertionError: expected undefined to be 'Přihlásit se znovu' // Object.is equality |
| queue-wiring.test.js | zjištění uložené OAuth session atomické přepnutí odmítne cizí okno i neplatný payload před logoutem | AssertionError: expected [Function] to throw an error |
| queue-wiring.test.js | zjištění uložené OAuth session kanál identity vrátí nastavení jen jméno a e-mail z platné šifrované session | AssertionError: expected [Function] to throw an error |
| queue-wiring.test.js | zjištění uložené OAuth session origin vrací validovanou konfiguraci a identitu nespojí se session jiného originu | AssertionError: expected [Function] to throw an error |
| queue-wiring.test.js | zjištění uložené OAuth session kanál změny prostředí přijme jen okno settings | AssertionError: expected [Function] to throw an error |
| queue-wiring.test.js | výška panelu podle obsahu výšku pod rozumným minimem ořízne na 180 bodů a šířku nechá 400 | AssertionError: expected "vi.fn()" to be called once with arguments: [ 400, 180, false ] |
| queue-wiring.test.js | výška panelu podle obsahu výšku nad monitorem ořízne pod spodní hranu pracovní plochy | AssertionError: expected { Object (x, y, ...) } to deeply equal { Object (x, y, ...) } |
| queue-wiring.test.js | výška panelu podle obsahu po skutečné změně výšky panel znovu přilepí pod ikonu | AssertionError: expected "vi.fn()" to be called once with arguments: [ 400, 320, false ] |
| queue-wiring.test.js | výška panelu podle obsahu po změně parametrů monitoru hned omezí a pak obnoví přirozenou výšku | AssertionError: expected "vi.fn()" to be called once with arguments: [ 400, 366, false ] |
| queue-wiring.test.js | šablonové ikony v liště aktivní stav tracking použije šablonu se stejnými bajty v obou motivech | AssertionError: expected 'idle' to be 'tracking' // Object.is equality |
| queue-wiring.test.js | šablonové ikony v liště aktivní stav recording použije šablonu se stejnými bajty v obou motivech | AssertionError: expected false to be true // Object.is equality |
| queue-wiring.test.js | šablonové ikony v liště aktivní stav recording-tracking použije šablonu se stejnými bajty v obou motivech | AssertionError: expected 'recording' to be 'recording-tracking' // Object.is equality |
| queue-wiring.test.js | šablonové ikony v liště aktivní stav recording-audio-lost použije šablonu se stejnými bajty v obou motivech | AssertionError: expected false to be true // Object.is equality |
| queue-wiring.test.js | šablonové ikony v liště aktivní stav recording-microphone-only použije šablonu se stejnými bajty v obou motivech | AssertionError: expected false to be true // Object.is equality |
| queue-wiring.test.js | viditelnost ikony a klikání na lištu levý klik dál otevře a napozicuje panel, nikoli kontextové menu | AssertionError: expected "vi.fn()" to be called once with arguments: [ 1032, 26, false ] |
| queue-wiring.test.js | průběžný titulek lišty boolean výpadku nevytvoří systémovou stopu v nahrávání jen s mikrofonem | AssertionError: expected last "vi.fn()" call to have been called with [ 'LuDone · nahrává jen mikrofon' ] |
| queue-wiring.test.js | produkční zapojení odchozí fronty ruční serverové ověření jde přes trusted store a open-web URL skládá jen main | AssertionError: expected [Function] to throw an error |
| queue-wiring.test.js | produkční zapojení odchozí fronty IPC fronty používá předepsané role odesílatele | AssertionError: expected 'const {\n  app,\n  BrowserWindow,\n  …' to contain 'handleValidated("queue:claim-recordin…' |
| queue-wiring.test.js | produkční zapojení odchozí fronty zrušení dialogu a cizí IPC odesílatel nezpůsobí převzetí | AssertionError: expected [Function] to throw an error |
| queue-wiring.test.js | produkční zapojení odchozí fronty čekající položku z vlastního store promítne do lišty, když nic neběží | AssertionError: expected 'idle' to be 'queue-waiting' // Object.is equality |
| queue-wiring.test.js | produkční zapojení odchozí fronty persistovanou čekající frontu ukáže už před dlouhou obnovou při startu | AssertionError: expected 'idle' to be 'queue-waiting' // Object.is equality |
| queue-wiring.test.js | produkční zapojení odchozí fronty lokální přehled projde z disku přes store a chráněné IPC bez recovery nebo sítě | Error: promise resolved "{ items: [ { …(23) } ], …(1) }" instead of rejecting |
| queue-wiring.test.js | viditelnost automatických aktualizací v panelu verze je přítomná bez interakce (dokončený onboarding: true) | AssertionError: expected undefined to be 'Verze 0.1.8' // Object.is equality |
| queue-wiring.test.js | viditelnost automatických aktualizací v panelu skutečné settings IPC načte nabídku a uloží explicitní firmu stejné relace | AssertionError: expected [Function] to throw an error |
| queue-wiring.test.js | úzké IPC preferencí nahrávky panel smí načíst nabídku ale nesmí měnit account default ani detail | AssertionError: expected [Function] to throw an error |
| queue-wiring.test.js | lokální uložený default firmy vrátí pouze uložený GUID ze scoped platné relace, bez sítě a jen Settings | AssertionError: expected [Function] to throw an error |
| recording-card.test.js | produktové dotažení Teď aktivní Teď zůstane v panelu; den a nastavení mají vlastní cíl | TypeError: Cannot read properties of null (reading 'querySelectorAll') |
| recording-card.test.js | produktové dotažení Teď velká fronta zůstává za nahráváním a odkaz otevře její přehled | Error: Test očekával dostupné tlačítko |
| recording-card.test.js | nahrávání při zneplatnění relace stav expired ponechá Stop i lokální uložení, ale zavře odesílání | Error: Test očekával dostupné tlačítko |
| recording-card.test.js | nahrávání při zneplatnění relace stav none ponechá Stop i lokální uložení, ale zavře odesílání | Error: Test očekával dostupné tlačítko |
| recording-card.test.js | RecordingCard s rozbalenou frontou jsou po dokončení nahrávky obě akce dosažitelné na 400px ploše | AssertionError: expected null not to be null |
| recording-card.test.js | RecordingCard App ponechá připravovaný LuTrack neaktivní i během nahrávání | AssertionError: expected <section …(1)>…(1)</section> to be null // Object.is equality |
| renderer-failure-feedback.test.js | 1 — neznámá fronta a legitimně prázdná fronta oznámí odmítnuté čtení v panelu | AssertionError: expected undefined to be 'Stav fronty není dostupný. Počet čeka…' // Object.is equality |
| renderer-failure-feedback.test.js | 1 — neznámá fronta a legitimně prázdná fronta oznámí neplatná odpověď v panelu | AssertionError: expected undefined to be 'Stav fronty není dostupný. Počet čeka…' // Object.is equality |
| renderer-failure-feedback.test.js | 1 — neznámá fronta a legitimně prázdná fronta po selhání a obnově na prázdnou frontu odstraní upozornění | AssertionError: expected 'LuDoneDesktopPřipraveno k nahrávání M…' to contain 'Stav fronty není dostupný. Počet čeka…' |
| renderer-failure-feedback.test.js | 1 — neznámá fronta a legitimně prázdná fronta prázdná fronta zůstane bez výstrahy i bez karty | AssertionError: expected 'LuDoneDesktopPřipraveno k nahrávání M…' to contain 'Vše odesláno' |
| session-reentry.test.js | návrat do aplikace po ztrátě session dokončení úvodního průvodce bez platné relace otevře nový přihlašovací krok | AssertionError: expected undefined to be 'Nejsi připojený' // Object.is equality |
| session-reentry.test.js | návrat do aplikace po ztrátě session po dokončeném onboardingu a bez session nabídne jediný přihlašovací krok | AssertionError: expected undefined to be 'Nejsi připojený' // Object.is equality |
| session-reentry.test.js | návrat do aplikace po ztrátě session po akci odhlášení v Nastavení živý panel přestane tvrdit Přihlášeno | AssertionError: expected undefined to be 'signed-in' // Object.is equality |
| session-reentry.test.js | návrat do aplikace po ztrátě session po akci přepnutí prostředí živý panel přestane tvrdit Přihlášeno | AssertionError: expected undefined to be 'signed-in' // Object.is equality |
| session-reentry.test.js | návrat do aplikace po ztrátě session během první kontroly session nenabízí anonymní akce | AssertionError: expected <section …(9)>…(4)</section> to have a length of +0 but got 1 |
| session-reentry.test.js | návrat do aplikace po ztrátě session příkaz LuTracku z lišty během znovupřihlášení zůstane neaktivní | AssertionError: expected undefined to be 'Nejsi připojený' // Object.is equality |
| session-reentry.test.js | návrat do aplikace po ztrátě session příkaz LuTracku z lišty neaktivuje připravovanou kartu ani po přihlášení | AssertionError: expected undefined to be 'signed-in' // Object.is equality |
| session-reentry.test.js | návrat do aplikace po ztrátě session návrat fokusu během čekání nepřeruší rozpracované znovupřihlášení | AssertionError: expected undefined to be 'Nejsi připojený' // Object.is equality |
| session-reentry.test.js | návrat do aplikace po ztrátě session po znovupřihlášení vrátí nahrávání a připravený LuTrack bez opakování onboardingu | AssertionError: expected undefined to be 'Nejsi připojený' // Object.is equality |
| session-reentry.test.js | návrat do aplikace po ztrátě session s platnou session zachová dosavadní panel beze změny | AssertionError: expected undefined to be 'signed-in' // Object.is equality |
| session-reentry.test.js | oznámení změny session mezi okny otevřená okna zjistí vypršení bez změny fokusu a panel nabídne nové přihlášení | AssertionError: expected undefined to be 'signed-in' // Object.is equality |
| settings.test.js | pět částí Nastavení ukáže sekce Nastavení v jednom přehledu a zachová jejich samostatné ovládání | AssertionError: expected [ 'Účet', 'Zvuk', 'Záznamy', …(2) ] to deeply equal [ 'Účet', 'Zvuk', 'Záznamy', …(2) ] |
| settings.test.js | pět částí Nastavení kliknutí na záložku Nahrávky a její akci předá přesný snímek | AssertionError: Záložka Nahrávky neexistuje: expected undefined to be defined |
| settings.test.js | přímý vstup do části Nastavení otevře Nahrávky z hlavního panelu a přijímá jen známé záložky | AssertionError: expected undefined to be 'settings-tab-recordingQueue' // Object.is equality |
| tray-authority.test.js | autorita stavu tray ikony uložený stav lišty používá stejné čisté mapování | AssertionError: expected 'function refreshTray() {\n  const rec…' to contain 'trayIconName(' |
| tray-authority.test.js | stav vlastní hlavní proces, ne renderer odvodí stav {"signedIn":true,"trackingOwners":[1]} jako tracking | AssertionError: expected 'idle' to be 'tracking' // Object.is equality |
| tray-authority.test.js | stav vlastní hlavní proces, ne renderer odvodí stav {"signedIn":true,"trackingOwners":[1],"preparing":[[1,{"cancelled":false}]]} jako recording-tracking | AssertionError: expected 'recording' to be 'recording-tracking' // Object.is equality |
| tray-authority.test.js | stav vlastní hlavní proces, ne renderer odvodí stav {"signedIn":true,"trackingOwners":[1],"queueWaitingCount":2} jako tracking | AssertionError: expected 'queue-waiting' to be 'tracking' // Object.is equality |
| tray-authority.test.js | stav vlastní hlavní proces, ne renderer odvodí stav {"signedIn":false,"trackingOwners":[1],"preparing":[[1,{"cancelled":false}]],"queueWaitingCount":2,"systemAudioLostOwners":[1]} jako signed-out | AssertionError: expected 'recording' to be 'signed-out' // Object.is equality |
| tray-authority.test.js | stav vlastní hlavní proces, ne renderer jednostopé nahrávání odliší od plného nahrávání i výpadku: příprava | AssertionError: expected 'LuDone · Nahrává se · jen mikrofon' to be 'L·jen mikrofon' // Object.is equality |
| tray-authority.test.js | stav vlastní hlavní proces, ne renderer jednostopé nahrávání odliší od plného nahrávání i výpadku: živá session | AssertionError: expected 'LuDone · Nahrává se · jen mikrofon' to be 'L·jen mikrofon' // Object.is equality |
| tray-authority.test.js | stav vlastní hlavní proces, ne renderer jednostopé nahrávání odliší od plného nahrávání i výpadku: souběh s LuTrackem | AssertionError: expected 'LuDone · Nahrává se · jen mikrofon · …' to be 'L·jen mikrofon' // Object.is equality |
| tray-authority.test.js | stav vlastní hlavní proces, ne renderer při souběhu spojí fakt LuTracku se skutečným nahráváním z hlavního procesu | AssertionError: expected 'recording' to be 'recording-tracking' // Object.is equality |
| tray-authority.test.js | pád rendereru nechá lištu hlásit správný stav, ne ten poslední odeslaný | AssertionError: expected 'recording' to be 'recording-tracking' // Object.is equality |
| tray-authority.test.js | pád rendereru zapomene jen padlé okno, ostatní nechá běžet | AssertionError: expected 'idle' to be 'tracking' // Object.is equality |
| tray-authority.test.js | lišta se překresluje jen při skutečné změně změna stavu obrázek i popisek přepíše | AssertionError: expected 'idle' to be 'tracking' // Object.is equality |
| tray-authority.test.js | kanál faktů nesmí být tray:set-state pod jiným jménem platnou čtveřici boolean přijme | AssertionError: expected 'idle' to be 'tracking' // Object.is equality |
| tray-authority.test.js | první vykreslení lišty nastaví obrázek i popisek, i když se stav nezměnil | AssertionError: expected 'LuDone · Přihlásit se' to be 'L·odhlášeno' // Object.is equality |
