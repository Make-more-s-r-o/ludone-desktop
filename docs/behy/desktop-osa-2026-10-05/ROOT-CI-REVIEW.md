# Nezávislé převzetí CI a review — 5. 10. 2026

Root kontroluje Danem schválenou F Osa v draft PR #160. Tato úzká změna není
merge, tag, vydání ani instalace aplikace. Základ review: `e1e4af8`.

## Runtime obou workflow

Mac mini může pushnout běžnou implementaci, jeho GitHub přihlášení však odmítlo
změnu workflow pro chybějící rozsah `workflow`. Root ověřil dostupný rozsah na
svém přihlášení bez čtení nebo přenosu tajných hodnot a přebírá přesný
`NODE-WORKFLOW.patch` v samostatném `.claude/worktrees/osa-ci-review`.

Obě workflow nyní čtou již verzovanou `.nvmrc` s `24.19.0`. Mění se pouze zdroj
verze runtime. Původní `gates`, build, assertions, golden PNG, oprávnění,
spouštěcí podmínky a publikační kroky zůstávají beze změny.

- 🧪 Oficiální distribuce Node 24.19.0 pro macOS arm64 byla stažena do dočasné
  složky a ověřena proti oficiálnímu SHA256. Není systémově instalovaná.
  Hash archivu: `8294b7aa9b03997481c06babf1e8b270c859358f27da57a11509afe537ac381d`.
  Runtime hlásí zlib `1.3.2.1-motley-3246f1b`.
- 🧪 Čistá instalace lockfile tímto runtime: exit 0.
- 🧪 Původní `brany-workflow.test.js` a `tray-ikony.test.js`: 14 PASS, 0 FAIL,
  exit 0. Reprodukce původních PNG nemění generátor ani očekávané soubory.
- 🧪 Samostatné čtecí Sol review úzkého diffu bez P1/P2. Nezměnilo se měřidlo
  ani pravidla publikace.
- 🟡 Oficiální Linux runtime a celé GitHub CI po této změně musí projít novým
  během; macOS kontrola sama tento důkaz neposkytuje.

Primární zdroje: [vydání Node 24.19.0](https://nodejs.org/en/blog/release/v24.19.0)
a [oficiální kontrolní součty](https://nodejs.org/dist/v24.19.0/SHASUMS256.txt).
Doslovné výpisy jsou v `dukazy/desktop-osa-2026-10-05/root-ci-runtime/`.

## Celá přejímka zůstává otevřená

⚠️ GitHub CI běh `37322989536` nad `e1e4af8` ověřen samostatně: 111 FAIL,
1568 PASS, 3 původní skipy, exit 1. Původní doslovný výpis je uložen beze změny
v `ci-37322989536.txt.gz`; SHA256 rozbaleného souboru:
`9986facc2ee70aac91645df0e345edb61e3928baacaa9eb68abd2b0cf165e60f`.
Tento stav není zelená přejímka.

Nezávislé čtecí review čtyř migrací testovacího setupu potvrdilo zachování
dosavadních assertions. Zbývá doplnit stejné pozitivní služby přes panel,
negativní průchody přes skutečně cizí webContents a původní origin/frame,
payload, vlastnické a scoped kontroly. Nové souběhy finalizace/offline/attention
v tray potřebují skutečné vstupy, nikoli pevné prázdné hodnoty harnessu.
Rovnocenná migrace selektoru či vstupu na schválenou F není výjimka z brány;
žádná ochranná assertion nesmí být odstraněna nebo oslabena.

Review guardu detailu nedoložilo nový P1/P2: Save konfiguruje s CAS bez uploadu,
nonce/epoch chrání rozhodnutí a dirty detail odkládá aktualizaci. Uzly historie
a počet problémových položek jsou opravené. Test přehrávání nyní prochází
React tlačítkem a skutečným audio prvkem. Toto čtení ani DOM klik samo o sobě
nepotvrzují fyzickou dosažitelnost a poslech.

🟡 Zbývá rovnocenně dokončit celou sadu, skutečné UI průchody
uložit/zahodit/zůstat a porovnání Electronu s F ve 24 situacích × 3 tématech.
⛔ Fyzický zvuk a produkční server nejsou tímto review ověřeny.
