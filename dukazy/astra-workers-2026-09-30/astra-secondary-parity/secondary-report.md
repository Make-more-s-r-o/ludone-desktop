# Sekundární kompozice Astra

Stav: 🧪 zelené cílené testy; 🟡 čeká na nové snímky běžícího Electronu a kontrolu kompozice; ⛔ živý zvuk není ověřen.

- Onboarding má společný menubar, titlebar, navigaci a patičku. Původní kroky účtu, OAuth, oprávnění a zvukové zkoušky zůstávají. Úvod používá Astra titulek a jednoduchou značku. Navigace používá stávající openSettings; neoznačuje onboarding za dokončený.
- Uložení zachovává panel a kompaktní kontext LuTracku. Názvové pole, skutečný interval/délka/objem zachycených dat a jedna nahrávka schůzky tvoří náhled. Finální stereo export vzniká až po volbě; finální velikost ani cestu UI nevymýšlí. Lokální a odesílací akce jsou široké. Firma není přidána bez podporovaných dat/API.
- Banner updateru a stávající selektory/actions zůstávají. Zobrazit aktualizaci otevře samostatnou plochu ve společném shellu; verze a stav pocházejí ze stávajícího updateru, Později/install používají existující IPC. Zpět obnoví banner. Notifikace macOS zůstává řízená mainem.
- Tmavé sekundární popisky mají vyšší kontrast. Hotovo je světlá aktivní akce a Otevřít zkoušku má čitelný obrys. Prohlédnut byl původní 12-nastaveni-tmave.png, nová podoba vyžaduje kontrolu screenshotu.

Příkazy a doslovné výstupy:
- npm run typecheck: secondary-typecheck.txt, EXIT_CODE=0.
- npm run lint: secondary-lint.txt, EXIT_CODE=0.
- npm run test:unit -- tests/recording-card.test.js tests/onboarding-missing-steps.test.js tests/queue-wiring.test.js: secondary-tests.txt, 368 PASS, EXIT_CODE=0.
- Nový test updateru pokrývá rozbalení, autoritativní verzi, odložení přes IPC bez restartu a návrat do banneru. Žádný existující test ani brána nebyly oslabeny.

Rozdíly od demonstrace: onboarding má stále šest bezpečnostních kroků, LuTrack nevyrábí pracovní kontext/minuty, firma ani finální exportní metadata nejsou fiktivní. Nelze tvrdit úplnou pixelovou shodu bez nové vizuální přejímky.
