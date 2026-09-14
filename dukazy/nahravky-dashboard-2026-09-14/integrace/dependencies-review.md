---
kind: review
ref: release-runtime-dependencies
verdict: tests-green
measuredAt: 2026-09-14T19:56:30Z
scope: [package-lock, updater-yaml]
measuredFrom: [npm-audit, lockfile-diff, upstream-advisory]
---

# Závislosti aktualizací

Před přejímkou vydání `npm audit --omit=dev` našel runtime js-yaml 4.3.1 s vysokou závažností CVE-2026-84375 (neomezená práce při sloučení prázdných YAML map). electron-updater ho používá ke čtení metadat. Podle [upstream advisory](https://github.com/nodeca/js-yaml/security/advisories/GHSA-2883-xcg3-v3hh) je opravena řada 4.3.2. `npm update js-yaml --ignore-scripts` změnil výhradně tento záznam lockfilu, bez změny přímých verzí nebo semver rozsahů. Následný runtime audit má exit 0 a žádný nález (doslovný výpis vedle).

⚠️ Úplný audit má nadále pět vývojových nálezů: Vitest/mockovací nástroje a extract-zip přes instalační balíček Electronu. Npm navrhuje hlavní verze Vitest 5 a Electron 44; nejde o aktualizaci, kterou by bylo správné skrytě přimíchat k tomuto běhu nahrávek bez posouzení podpory macOS a zvukové cesty. Audit ani existující brány nebyly oslabené. Runtime audit sám netvrdí bezpečnost celé aplikace.
