# Stav běhu `nahravky-dashboard`

**Aktualizováno 15. 9. 2026.** PR #141 je sloučený a verze **0.1.2 je vydaná**.
[Release 34941430582](https://github.com/Make-more-s-r-o/ludone-desktop/actions/runs/34941430582)
na `f789f49` prošel včetně podpisu, notarizace a veřejné kontroly download feedu.
Read-only kontrola potvrzuje instalaci 0.1.2 na Danově Macu. Skutečný upload ani
aktualizační přechod tím nejsou ověřené.

**Implementováno pro 0.1.3, před vydáním:** oprava chybějícího retry pozastavených nahrávek a Danem
schválené upozornění na aktualizace (proužek + jednorázové oznámení macOS,
automatické stažení, instalace po kliknutí, možnost odložit).

🧪 Společné brány 0.1.3: **1514 PASS, tři původní skipy, lint, typecheck, baseline
i build — exit 0**. [Report aktualizací](../../../dukazy/aktualizace-2026-09-15/REPORT.md).
Čistý klon a GitHub CI jsou samostatné navazující kontroly.

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

## Živá přejímka a aktuální blokace

- ✅ Vydání 0.1.2: GitHub release workflow úspěšný; aplikace 0.1.2 nainstalovaná na Macu.
- ⚠️ Čtyři schválené staré položky v 0.1.2 zůstaly `ceka` po chybě nevybrané firmy.
  Dashboard chybně nenabízí retry. Oprava je součástí připravované 0.1.3.
- ⛔ Úspěšný produkční upload a shoda obou stop zatím nedoloženy. Starší `odeslano`
  z 11. 9. bez serverového ID není důkaz uploadu v nové verzi.
- ⛔ Aktualizace mezi dvěma verzemi a skutečná zvuková cesta po ní čekají na Mac.
  Příchod 0.1.3 řídí ještě updater 0.1.2; novou instalaci po kliknutí lze naostro
  ověřit až při dalším schváleném vydání.

Záloha podpisového klíče byla Danem potvrzena a publikační konfigurace už existuje.
Nevyžaduje se znovu. [Postup na Macu](OVERENI-NA-MACU.md) doplňuje aktuální
[report opravy](../../../dukazy/nahravky-retry-2026-09-15/REPORT.md).

## Procesní hranice

Global masterplan lint ponechává známý C2: chybí hook artifact `artifacts/design/approved.json`. Rozsah a odložení redesignu schválil uživatel explicitním goalem (D10); žádné schválení ani výjimka nebyly vyrobené. Jednotlivé implementační packety prošly lintem. Známé malé TOCTOU okno systémového koše je popsané v [T5 review](../../../dukazy/nahravky-dashboard-2026-09-14/T5/root-review.md).
