# Zadání T-SR — bezpečná retence stereo MP3

Pracuješ ve worktree {{WORKTREE}}. Na začátku spusť `pwd` a ověř přidělený strom. Nejdřív ověř `pwd`. Feature NRD-09, rozhodnutí D20, plný kontrakt [STEREO-MP3](../STEREO-MP3.md). T-S0 je dokumentační předpoklad. Helper kontrakt poskytuje T-S1; integraci vlastní T-S3.

> D21 / 23. 9.: výsledný soubor je WebM/Opus 96 kb/s stereo. Nové živé audio se pouze přebalí bez překódování; staré dvojice se převádějí do Opusu. Starší odkazy na MP3 níže jsou pro tento běh překonané. API převodníku je `prepareStereoWebm`, MIME `audio/webm`.

## Mantinely

- **NEDĚLEJ ŽÁDNOU ZÁPISOVOU GIT OPERACI**; jediný povolený Git příkaz je závěrečný read-only self-check v postupu.
- Žádný příkaz nesmí čekat na vstup ani `stdin`.
- **NIC NEINSTALUJ**; instalace provádí root.
- **NEVYRÁBĚJ VÝJIMKU Z BRÁNY**; žádný exempt marker, skip, oslabený test ani baseline místo opravy.

- **SMÍŠ MĚNIT VÝHRADNĚ:**
  - `electron/retention.cjs`
  - `electron/retention.test.cjs`
  - `tests/retention.test.js`
  - `dukazy/stereo-mp3-2026-09-15/T-SR/report.json`

- Žádný backend, LuTrack, design/, produkční účet, soukromé audio ani ostrý upload. Owner, consent, IPC, idempotence a existující brány zůstávají. Root vlastní docs, T-S1 runtime, T-SR retenci a T-S2 balení; jejich soubory se nekříží. Nový soubor mimo allowlist předem dohodni s rootem.

## Implementace

1. T-S1 předal retenci samostatnému agentovi. Helper `meeting-audio.cjs` čti z jeho worktree, domluv společné API; dočasnou kopii závislosti nezařazuj do diffu.
2. Před mutací ověř všechny originály, primary/recovery/meeting sidecar, MP3 a stereo master. Cesty musí přesně patřit danému manifestu; identita, hash, časování a kanály souhlasit. Cizí cesty a symlinky blokují celé mazání.
3. Odstraň deriváty i originály, primary manifest poslední. Částečné selhání zachová položku fronty. Pending stav nepředstírá hotový MP3.
4. Testuj úspěšný úklid, poškozený nebo podvržený derivát, symlink a částečné selhání; původní bezpečné chování zůstává.

## Sabotáže

### MUSÍ ZČERVENAT

Odstraň testovanou záruku (ověření všech souborů před první mutací), ověř červený test a obnov kód.

### MUSÍ ZŮSTAT ZELENÉ

Po obnovení kódu stejné scénáře i původní bezpečnostní regrese projdou.

## Postup — dodrž pořadí

1. Ověř premisu a implementuj pouze povolený rozsah; uchovej důkazy v přiděleném adresáři.
2. Spusť `npm run typecheck` a ulož doslovný výpis i exit kód.
3. Spusť testy `npm run test:unit -- retention`, ulož doslovný výpis a exit kód; proveď popsanou sabotáž a návrat.
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
