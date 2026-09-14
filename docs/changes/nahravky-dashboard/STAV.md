# Stav běhu `nahravky-dashboard` — odkud pokračovat

**Aktualizováno 14. 9. 2026.** Kanonický strojový stav je [progress/status.json](progress/status.json); [HTML přehled](progress/index.html) je jeho generovaná projekce.

## Co je integrované

- 🧪 **T-00 — bezpečná projekce fronty:** integrováno, regresní testy zelené; report je v `evidence/tasks/T0.report.json`.
- 🧪 **T-01 — trvalé per-track výsledky:** po review integrovány commity `fdb4535` a `53ca859`; 417 cílených testů zelených. Živý upload se tím neověřil.
- 🧪 **T-A1 — přihlášení a upload scope:** integrováno a otestováno; report je v `evidence/tasks/A1.report.json`. Přihlášení z Finderu dosud nemá live důkaz.
- 🧪 **T-02 — výslovné převzetí:** integrováno v `a25bd5c`; koordinátor před převzetím samostatně spustil 440 dotčených testů, exit 0. Report a review jsou v `evidence/tasks/T-02.report.json` a `dukazy/nahravky-dashboard-2026-09-14/T2/`.

Žádné z těchto tvrzení není důkaz reálného zvuku. Agentní běh `ui-smoke` ani `audio-smoke` nespouštěl.

## Co právě navazuje

1. **T-03 — lokální přehled:** Sol implementuje ve vlastním worktree ze základu `a25bd5c`. Packet [tasks/T-03.md](tasks/T-03.md) prošel lintem: 28 pravidel, nula nálezů.
2. **T-R1 → T-04 → T-05:** navážou postupně podle [DAG](tasks/DAG.md); sdílejí serializovanou frontu a hlavní proces.
3. 🧪 **Updater a T-06:** implementace je integrovaná včetně veřejné HTTPS kontroly po SSH (`2499dbb`). Koordinátorova brána skončila exit 0: 1341 testů zelených a tři známé baseline skipy. Podepsaný build ani veřejná verze nevznikly.

Izolovaný unpackaged GUI průchod není produkční login ani audio smoke. Oprava návratu z initial onboardingu do reauthenticate je integrovaná v `9158ae6`; opětovné otevření 14. 9. ve 22:19 ukázalo odpovídající odhlášenou obrazovku. T-05 doplní přímé Nastavení také v tomto stavu.

Rozpracované změny jsou v [draft PR #141](https://github.com/Make-more-s-r-o/ludone-desktop/pull/141). Finální souhrnná brána a čistý klon přijdou po zbývající implementaci.

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
