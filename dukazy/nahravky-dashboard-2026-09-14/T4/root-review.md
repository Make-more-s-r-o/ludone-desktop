# T4 — integrační přejímka

- Zdrojový commit: `9b233c8`; merge: `0078c9350320ea105c4c665c8eb09d5c31445089`.
- 🧪 `npm run gates`: 67 sad, 1433 PASS, tři původní baseline skipy, exit 0. Doslovný výpis je v `root-gates-final.log`.
- První root brána skončila exit 1 na izolované fixture logout handleru: chyběla nová závislost `invalidateRecordingVerifier`. Root doplnil spy a assertion invalidace před logout. Původní assertions zůstaly; runtime se kvůli bráně neměnil. Původní výpis je v `root-gates.log`.
- Workerovy dvě skutečné sabotáže odstranily kontrolu hashe a current guard; obě RED exit 1, obnovené ochrany GREEN exit 0. Doslovné logy jsou verzované.

## Review výsledného chování

Root průběžně reviewoval nový verifier, export existujícího requesteru, serializovaný getter, auth/IPC a renderer. Před převzetím byly opraveny: single-track výběr, skalární validace, úplný tvar serverové odpovědi, oddělení rezervací od skutečných GET časů, 429 přijaté během logoutu, recheck cooldownu po awaitu, zahození starého výsledku v UI a recovery metadata. Nezávislý Sol reviewer dokončil read-only review pevného diffu `ea338b5..9b233c8` bez doložených P1/P2. Posoudil verifier, getter, requester, main/preload a UI. Nespouštěl testy, GUI ani síť a neposuzoval navazující T5.

- Getter čte čerstvý T3 snapshot, kontroluje vlastníka a revizi a používá omezené stabilní čtení bez následování symlinků. Známý recovery sidecar přijímá pouze podle D14. Cesty a fingerprint zůstávají v main procesu.
- GET jde přes zpevněný existující requester na pevnou relativní cestu. Renderer předává ID řádku a revizi, nikoli URL nebo serverové ID. Webovou HTTPS adresu skládá main.
- Kontext zahrnuje platnou session, issuer, resource, upload scope, owner a generation; po awaitu se znovu ověřuje. Logout nečeká na běžící GET.
- 30 skutečných GET v klouzavé hodině a 60s cache jsou jen procesová ochrana, nikoli příslib zbývající sdílené kvóty serveru. 429 blokace stejného issueru/vlastníka přežije invalidaci cache a opětovný login.
- Legacy bez ID dává neověřeno a nula GET, také s neznámým hashem. Chybějící audio nebrání ověření zachovaných ID; skutečná retence může odstranit i queue položku a tím ID. Historie se nevytváří.

## Meze důkazu

⛔ Produkční login, server, GUI ani skutečný zvuk nebyly ověřeny. Žádné `ui-smoke` ani `audio-smoke` se nespouštělo. Testy pokrývají temp-disk getter, mockované HTTP, chráněný main/preload a React klik; nejde o živý průchod instalovanou aplikací.

Worker uvedl 517 cílených testů bez archivovaného plného výpisu této sady. Autoritativní důkaz je proto samostatná plná root brána. Skutečný přírůstek proti předchozí plné bráně je 32 testů (1401 → 1433).
