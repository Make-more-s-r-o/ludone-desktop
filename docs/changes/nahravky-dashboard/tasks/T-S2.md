# Zadání T-S2 — přibalený MP3 encoder

Pracuješ ve worktree {{WORKTREE}}. Na začátku spusť `pwd` a ověř přidělený strom. Feature NRD-09, rozhodnutí D20, kontrakt [STEREO-MP3](../STEREO-MP3.md). Závisí na dokumentaci T-S0; T-S1 běží nezávisle, integrace T-S3.

> D21 / 23. 9.: výsledný soubor je WebM/Opus 96 kb/s stereo. Nové živé audio se pouze přebalí bez překódování; staré dvojice se převádějí do Opusu. Starší odkazy na MP3 níže jsou pro tento běh překonané. API převodníku je `prepareStereoWebm`, MIME `audio/webm`.

## Mantinely

- **NEDĚLEJ ŽÁDNOU ZÁPISOVOU GIT OPERACI**; jediný povolený Git příkaz je závěrečný read-only self-check v postupu.
- Žádný příkaz nesmí čekat na vstup ani `stdin`.
- **NIC NEINSTALUJ**; instalace provádí root.
- **NEVYRÁBĚJ VÝJIMKU Z BRÁNY**; žádný exempt marker, skip, oslabený test ani baseline místo opravy.

- **SMÍŠ MĚNIT VÝHRADNĚ:**
  - `electron/media-encoder.cjs`
  - `scripts/package-mac.mjs`
  - `scripts/prepare-media-encoder.mjs`
  - `scripts/verify-macos-release.mjs`
  - `scripts/media-encoder-lock.json`
  - `package.json`
  - `package-lock.json`
  - `.gitignore`
  - `build/media-encoder/README.md`
  - `build/media-encoder/LICENSE.txt`
  - `tests/packaging.test.js`
  - `tests/verify-macos-release.test.js`
  - `tests/media-encoder.test.js`
  - `tests/media-encoder-packaging.test.js`
  - `dukazy/stereo-mp3-2026-09-15/T-S2/report.json`

  - `electron/media-encoder.test.cjs`
  - `scripts/package-mac.test.mjs`
  - `scripts/prepare-media-encoder.test.mjs`
  - `scripts/verify-macos-release.test.mjs`

- Žádný backend, LuTrack, design/, produkční účet, soukromé audio ani ostrý upload. Owner, consent, IPC, idempotence a existující brány zůstávají. Root vlastní docs, T-S1 runtime a T-S2 balení; jejich soubory se nekříží. Nový soubor mimo allowlist předem dohodni s rootem.

## Výsledek

1. Zvol reprodukovatelný encoder pro arm64 i x64 a ověřený původ/verzi/hash. Připrav offline běh z aplikace bez PATH/Homebrew a bez runtime downloadu. Licenční texty a zdrojové podklady přilož podle skutečného buildu.
2. Dohodni s T-S1 malé rozhraní pro převod WebM na stereo MP3 a případné zarovnání dvou vstupů. Zachovej L/R, proudové zpracování a atomický výsledek; proces nesmí zdědit tokeny ani vypsat soukromé cesty do běžného logu.
3. Balení vybere správnou architekturu i při sestavení obou verzí na jednom stroji. Podpis zahrne encoder. Balicí kontrola odmítne chybějící, cizí nebo nesprávně podepsanou binárku.
4. Relevantní testy a syntetický převod archivuj do `dukazy/stereo-mp3-2026-09-15/T-S2/`. Syntetické audio není live důkaz.

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
