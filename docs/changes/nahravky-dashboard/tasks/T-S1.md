# Zadání T-S1 — jediný stereo MP3 v produkční frontě

Pracuješ ve worktree {{WORKTREE}}. Na začátku spusť `pwd` a ověř přidělený strom. Nejdřív ověř `pwd`. Feature NRD-09, rozhodnutí D20, plný kontrakt [STEREO-MP3](../STEREO-MP3.md). T-S0 je dokumentační předpoklad. T-S1 a T-S2 jsou nezávislé; integraci vlastní T-S3.

> D21 / 23. 9.: výsledný soubor je WebM/Opus 96 kb/s stereo. Nové živé audio se pouze přebalí bez překódování; staré dvojice se převádějí do Opusu. Starší odkazy na MP3 níže jsou pro tento běh překonané. API převodníku je `prepareStereoWebm`, MIME `audio/webm`.

## Mantinely

- **NEDĚLEJ ŽÁDNOU ZÁPISOVOU GIT OPERACI**; jediný povolený Git příkaz je závěrečný read-only self-check v postupu.
- Žádný příkaz nesmí čekat na vstup ani `stdin`.
- **NIC NEINSTALUJ**; instalace provádí root.
- **NEVYRÁBĚJ VÝJIMKU Z BRÁNY**; žádný exempt marker, skip, oslabený test ani baseline místo opravy.

- **SMÍŠ MĚNIT VÝHRADNĚ:**
  - `electron/main.cjs`
  - `electron/preload.cjs`
  - `electron/upload-client.cjs`
  - `electron/queue.cjs`
  - `electron/recording-export.cjs`
  - `electron/recordings-dashboard.cjs`
  - `electron/recording-verification.cjs`
  - `src/lib/queue.js`
  - `src/lib/manifest.js`
  - `electron/meeting-audio.cjs`
  - `src/features/recording/RecordingCard.jsx`
  - `src/features/recordings/RecordingsDashboard.jsx`
  - `tests/queue-wiring.test.js`
  - `tests/queue.test.js`
  - `tests/upload-client.test.js`
  - `tests/recording-export.test.js`
  - `tests/recording-verification.test.js`
  - `tests/recordings-dashboard.test.js`
  - `tests/recording-actions.test.js`
  - `tests/recording-card.test.js`
  - `tests/manifest.test.js`
  - `tests/meeting-audio.test.js`
  - `tests/meeting-upload.test.js`
  - `dukazy/stereo-mp3-2026-09-15/T-S1/report.json`

  - `electron/main.test.cjs`
  - `electron/preload.test.cjs`
  - `electron/upload-client.test.cjs`
  - `electron/queue.test.cjs`
  - `electron/recording-export.test.cjs`
  - `electron/recordings-dashboard.test.cjs`
  - `electron/recording-verification.test.cjs`
  - `src/lib/queue.test.js`
  - `src/lib/manifest.test.js`
  - `electron/meeting-audio.test.cjs`
  - `src/features/recording/RecordingCard.test.jsx`
  - `src/features/recordings/RecordingsDashboard.test.jsx`

- Žádný backend, LuTrack, design/, produkční účet, soukromé audio ani ostrý upload. Owner, consent, IPC, idempotence a existující brány zůstávají. Root vlastní docs, T-S1 runtime a T-S2 balení; jejich soubory se nekříží. Nový soubor mimo allowlist předem dohodni s rootem.

Retence byla během běhu vyčleněna do T-SR; T-S1 dál vlastní sdílené ověření derivátů a ruční koš.

## Implementace

1. Navrhni explicitní trvalý delivery asset s vazbou na originály/manifest, vlastní verzí a bezpečnými cestami. Živé stereo ukládej na disk, pak MP3 atomicky. Encoder běží odděleně bez celé nahrávky v paměti.
2. Před HTTP ověř a ulož identitu/metadata MP3; na restartu nepřekóduj již inicializované bajty. Zachovej company pin, owner, consent, 429 a IPC guard.
3. Pro nový formát proveď jediný upload se stereo metadata a názvem bez přípony mikrofon/systém. Legacy initialized zastav; bezpečné staré complete bez HTTP lze převést, jinak pravdivá chyba.
4. Uprav projekci, serverové ověření, web akci, koš/retenci a recovery pro nové soubory; nikdy nepřiřaď jedno recordingId oběma originálům.
5. Ověř relevantní Vitest testy, lint/typecheck, mockovaný průchod skutečnou frontou a restart. Podklady do `dukazy/stereo-mp3-2026-09-15/T-S1/` (bez soukromých dat).

## Sabotáže

### MUSÍ ZČERVENAT

Odstraň testovanou záruku (jediný upload a stabilní identita u T-S1; přibalený encoder a úspěšný převod u T-S2), ověř červený test a obnov kód.

### MUSÍ ZŮSTAT ZELENÉ

Po obnovení kódu stejné scénáře i původní bezpečnostní regrese projdou.

## Postup — dodrž pořadí

1. Ověř premisu a implementuj pouze povolený rozsah; uchovej důkazy v přiděleném adresáři.
2. Spusť `npm run typecheck` a ulož doslovný výpis i exit kód.
3. Spusť testy `npm run gates`, ulož doslovný výpis a exit kód; proveď popsanou sabotáž a návrat.
4. Jediný závěrečný Git self-check: `git --no-pager status --porcelain`.
5. Ulož report a předej výsledky rootovi.

## Output contract

```json
{
  "summary": "Skutečný výsledek a zbývající hranice.",
  "premisaPlatila": true,
  "kontrolniNula": {"souboruMimoAllowlist": 0, "zmenBackendLuTrackDesign": 0, "novychSkipuBaseline": 0, "gitZapisu": 0, "produkcnichUploadu": 0},
  "zmenyExistujicichTestu": [],
  "sabotaze": [{"nazev": "", "vysledek": "", "doslovnyVystup": "Úplný výpis včetně exit kódu."}],
  "doslovnyVystupTestu": "Úplné doslovné výstupy včetně exit kódů.",
  "coJsemNEOVERIL": ["Produkční upload, skutečný zvuk, instalaci a aktualizaci."]
}
```

Stejný objekt ulož do přiděleného report.json v dukazy/stereo-mp3-2026-09-15/. Root spouští vlastní integrační brány.
