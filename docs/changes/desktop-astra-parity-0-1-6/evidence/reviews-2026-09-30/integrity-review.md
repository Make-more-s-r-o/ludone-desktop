---
kind: review
ref: desktop-astra-parity-0-1-6
verdict: "🧪 zelené testy"
measuredAt: 2026-09-29T23:12:07.825144+00:00
scope:
  - pravdivost lokálních stavů a zachování souborů
measuredFrom:
  - electron/recordings-dashboard.cjs
  - tests/recordings-dashboard.test.js
---

# Read-only review integrity místních nahrávek

**Závěr:** Žádné P1/P2 nálezy v diffu `ea41bc0` → aktuální worktree pro `electron/recordings-dashboard.cjs` a `tests/recordings-dashboard.test.js`.

`localState` označí `complete-audio` jen při úplném manifestu, přítomnosti všech očekávaných původních/odvozených souborů a nenulové velikosti každého z nich. Neúplný manifest nebo prázdný očekávaný soubor přechází do `partial-audio`; při absenci všech souborů zůstává `missing-audio`. `localReason` se předává jak frontové, tak osiřelé položce. Projekce `state`, `ownership`, `uploadIntent`, `revision` a dosavadní výpočet `allowedActions` se v diffu nemění; kód soubory ani oprávnění nemění. Test pokrývá complete/incomplete/zero/missing systémovou stopu, stav fronty i orphan variantu a kontroluje zachování souborů.

`git diff --check ea41bc0` prošel. Starý test `tests/queue.test.js:218` očekávající `complete-audio` pro nulový soubor je mimo tento diff a podle zadání jej opravuje hlavní agent.
