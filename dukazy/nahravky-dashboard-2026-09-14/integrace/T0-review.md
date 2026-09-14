---
kind: review
ref: 5e9145f
verdict: pass
measuredAt: 2026-09-14T19:25:00Z
scope: [queue-projection]
measuredFrom: [production-diff, independent-vitest-run]
---

# T0 – přejímka projekce fronty

🧪 Koordinátor zkontroloval `electron/queue.cjs`, `src/lib/queue.js` a testový diff. Znovu spustil 97 queue testů, exit 0; doslovný výstup je v `T0-testy.log`.

Projekce nevrací cesty, otisky vlastníka ani neočekávaná serverová pole. Neúplný manifest nezpůsobí pád celého soupisu. Staré nejednoznačné ID se nepřiděluje oběma stopám. `sizeBytes: null` znamená neznámou velikost, nikoli nulu.

## Proč to není chyba měřidla

Test čte skutečný manifest a soubory přes znovu otevřený store; zmizelý soubor mění velikost na null. Samostatný test podstrčí citlivá pole a ověřuje jejich nepřítomnost v rendererové projekci. Existující assertion neztratily původní význam.

Tento důkaz neověřuje nové UI ani skutečné odesílání na server. T1 a navazující bezpečnostní akce zůstávají samostatné etapy.
