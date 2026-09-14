# Stav běhu `nahravky-dashboard` — odkud pokračovat

**Aktualizováno 14. 9. 2026.** Kanonický strojový stav je [progress/status.json](progress/status.json); [HTML přehled](progress/index.html) je jeho generovaná projekce.

## Co je integrované

- 🧪 **T-00 — bezpečná projekce fronty:** integrováno, regresní testy zelené; report je v `evidence/tasks/T0.report.json`.
- 🧪 **T-01 — trvalé per-track výsledky:** po review integrovány commity `fdb4535` a `53ca859`; 417 cílených testů zelených. Živý upload se tím neověřil.
- 🧪 **T-A1 — přihlášení a upload scope:** integrováno a otestováno; report je v `evidence/tasks/A1.report.json`. Přihlášení z Finderu dosud nemá live důkaz.

Žádné z těchto tvrzení není důkaz reálného zvuku. Agentní běh `ui-smoke` ani `audio-smoke` nespouštěl.

## Co právě navazuje

1. **T-02 — výslovné převzetí jedné nahrávky:** packet [tasks/T-02.md](tasks/T-02.md) prošel `mp-lint --packet T-02` bez nálezu a je připravený k dispatchi po T-01.
2. **T-03 až T-05 a T-R1:** čekají podle [DAG](tasks/DAG.md).
3. **Updater a T-06:** implementace existuje ve workerech a prochází review; podepsaný build ani veřejná verze nevznikly.

## Co blokuje jen veřejné vydání

| Blokovaná část | Čeká na |
|---|---|
| Podepsaný a notarizovaný build | Potvrzení zálohy podpisového klíče ve firemním správci hesel. |
| Publikace na existující download hosting | Nastavené GitHub Secrets/Variables pro SSH přenos a přijetí finálního workflow. |
| Release 0.1.2 | Dokončený funkční řetězec, zelené finální brány a Danův tag. |
| Stav ✅ pro instalaci a update | Danův skutečný test na Macu. |

Stávající veřejný feed verze 0.1.1 a jeho čtyři balíčky byly read-only ověřeny HTTP 200. Neprokazuje to novou implementaci, nový updater ani budoucí cílovou cestu.

## Autoritativní zdroje

- Produktový rozsah: [intent](intent.md) a [zadání](ZADANI-PRO-CODEX.md).
- Chování: [specifikace](spec.md) a [rozhodnutí](decisions.md).
- Realizace: [plán](plan.md), [DAG](tasks/DAG.md) a lintnuté packety.
- Historie původní desktopové etapy: [desktop-v1](../desktop-v1/STAV.md); jde o historický snapshot, ne dnešní stav.
