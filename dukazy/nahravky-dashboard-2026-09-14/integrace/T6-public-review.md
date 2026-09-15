---
kind: review
ref: T6-public-feed
verdict: tests-green
measuredAt: 2026-09-14T19:53:49Z
scope: [release-workflow, public-feed-check]
measuredFrom: [workflow-diff, mocked-http-tests, hash-sabotage]
---

# Kontrola veřejné publikace

🧪 Po SSH přenosu workflow porovná veřejná metadata přesným SHA-256 a velikostí s ověřeným lokálním souborem. Osm balíčků a blockmap ověří pomocí HEAD (HTTP 200 a přesná Content-Length); instalačky znovu nestahuje. Adresa je pevná https://stahnout.ludone.cz/desktop/, redirect odmítá a požadavky mají patnáctisekundový limit. Nový test vazby hlídá pořadí veřejné kontroly až po remote promote.

Lint, typecheck a 16 testů prošly (viz T6-public-testy.log). Mutace vypínající hash check způsobila, že test starých metadat stejné délky chybně uspěl; regresní test to odmítl s exit 1. Po obnovení je sada opět zelená. Všechny odpovědi jsou mockované, nebyl proveden release ani žádný síťový zápis. Ostrý podpis/notarizace a veřejné vydání 0.1.2 zůstávají 🟡 do předání přístupů, potvrzení zálohy klíče a Danova tagu.
