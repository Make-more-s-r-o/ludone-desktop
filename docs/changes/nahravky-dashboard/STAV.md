# Stav běhu `nahravky-dashboard`

**Aktualizováno 15. 9. 2026.** Implementace je převzatá v [draft PR #141](https://github.com/Make-more-s-r-o/ludone-desktop/pull/141), větev `feat/nahravky-dokonceni`. Veřejné vydání čeká na podmínky níže. [Masterplan](progress/index.html) odděluje implementaci, dostupnost a ověření.

## Dokončená implementace

| Část | Výsledek a důkaz |
|---|---|
| T0–T1, R1 | Bezpečná projekce, trvalá per-track ID/session/progress, obnova fronty a restartovatelná 429 pauza. |
| T2 | Výslovné převzetí s identitou, revizí a nativním potvrzením; reset serverového stavu a zachování held. |
| T3–T4 | Lokální přehled kompletních/částečných/chybějících dat; ruční porovnání známých ID s velikostí, SHA-256 a stavem obou stop. |
| T5 | Send/keep, trvalý název a consent, automatika jen nových nahrávek, per-item retry, bezpečný koš a Finder. Uložení nečeká na dokončení sítě. |
| A1–A4 | Finder upload scope, identita z userinfo, výběr firmy v Nastavení a trvalá firma před prvním INIT. Změna globální firmy nepřesune rozpracovaný upload. |
| I1 | Pravdivé stavové popisky, datum a krátké ID pro korelaci s potvrzovacím dialogem. |
| T6 | Verze 0.1.2, kontrolované podepsání/notarizace, release metadata a SSH workflow s feedem posledním; viditelná dostupnost a průběh aktualizace. |

🧪 **Finální čistý klon `33938351`: 1505 PASS, tři původní skipy, lint, typecheck, kontrola baseline i build — exit 0.** [Doslovný výpis](../../../dukazy/nahravky-dashboard-2026-09-14/final/gates-clean-after-ci.log) a [review/přejímka](../../../dukazy/nahravky-dashboard-2026-09-14/final/OVERENI.md).

Převzaté poslední zdroje: T-A4 `c25ef2a` a T-I1 `d6bdfdd`. Root před commitem samostatně ověřil T-A4 1503 testy a I1 17 cílenými testy. Reporty i skutečné sabotáže jsou v `evidence/tasks/` a `dukazy/nahravky-dashboard-2026-09-14/`.

⚠️ Starší CI na `c21eca6` selhalo: časová fixture a cleanup před dokončením startup pumpy. Obě příčiny jsou opravené bez oslabení asercí nebo úklidových výjimek. [Původní důkazy](../../../dukazy/nahravky-dashboard-2026-09-14/integrace/ci-opravy/review.md) jsou zachované; pozdější časově citlivá aserce updateru je rovněž opravená bez změny runtime. **Finální [GitHub CI 34907553077](https://github.com/Make-more-s-r-o/ludone-desktop/actions/runs/34907553077) na `33938351` prošlo**, 1505 PASS a build. Metadata a celý log jsou ve `final/ci-green.*`.

🟡 **Nativní GUI 0.1.2**: samostatný profil s vypnutým transportem, dostupná Nastavení bez loginu, čitelný Účet s firmou a prázdný přehled. Aplikace po kontrole ukončená. Nejde o produkční login, zvuk nebo ruční akce nad reálnými nahrávkami. `ui-smoke` a `audio-smoke` agent nespouštěl.

## Co čeká na Dana

| Část | Nutná podmínka |
|---|---|
| Podepsaný a notarizovaný build | Potvrzená záloha `.p12` včetně hesla ve firemním správci hesel. |
| Publikace na download hosting | GitHub SSH Secrets/Variables podle [T6-VYDANI.md](T6-VYDANI.md); host, účet a přístup se nehádají. |
| Release 0.1.2 | Kontrola PR a finální tag, který pushuje výhradně Dan. |
| ✅ živé ověření | [Krátký postup na Macu](OVERENI-NA-MACU.md): Finder login, nahrávání, obě stopy, instalace a update. |

Stávající veřejný feed 0.1.1 a jeho čtyři balíčky byly read-only ověřeny HTTP 200. Nová verze tím nebyla publikována. Přechod 0.1.1 → 0.1.2 ověří doručení přes původní updater; nové hlášení dostupnosti a průběhu v 0.1.2 potřebuje další schválenou vyšší verzi.

## Procesní hranice

Global masterplan lint ponechává známý C2: chybí hook artifact `artifacts/design/approved.json`. Rozsah a odložení redesignu schválil uživatel explicitním goalem (D10); žádné schválení ani výjimka nebyly vyrobené. Jednotlivé implementační packety prošly lintem. Známé malé TOCTOU okno systémového koše je popsané v [T5 review](../../../dukazy/nahravky-dashboard-2026-09-14/T5/root-review.md).
