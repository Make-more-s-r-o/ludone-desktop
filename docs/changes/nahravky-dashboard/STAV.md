# Stav běhu `nahravky-dashboard`
> **Doplnění 15. 9. — D20 / NRD-09:** Dan schválil jediný stereo MP3 a jeden serverový záznam za schůzku. [Kontrakt a plán](STEREO-MP3.md) mají pro tento nový rozsah přednost před historickými per-track uploady níže. Implementace zatím čeká; produkčně vydaná je 0.1.3.


**Aktualizováno 15. 9. 2026: verze 0.1.3 je vydaná.** Tag `v0.1.3` ukazuje na
`28a6563`; Dan jeho publikací výslovně pověřil koordinátora (D19).

✅ [Release 34948618429](https://github.com/Make-more-s-r-o/ludone-desktop/actions/runs/34948618429)
prošel podpisem, notarizací obou architektur, publikací a veřejnou kontrolou.
Root nezávisle potvrdil feed 0.1.3, přesné poznámky a všech osm balíčků/blockmap.
[Záznam a důkazy vydání](../../../dukazy/vydani-0.1.3-2026-09-15/REPORT.md).

0.1.3 obsahuje opravu chybějícího retry pozastavených nahrávek a schválené ovládání
aktualizací: proužek, jednorázové oznámení macOS, automatické stažení, instalaci po
kliknutí a možnost odložit. Souhlas je vázaný na konkrétní zobrazenou verzi.

🧪 Finální čistý klon runtime `20238192`: **1515 PASS, tři původní skipy, lint,
typecheck, baseline a build — exit 0**. [Výpis](../../../dukazy/aktualizace-2026-09-15/gates-clean-final.log)
a [review](../../../dukazy/aktualizace-2026-09-15/REPORT.md). PR #142 a #143 jsou sloučené,
CI prošlo také nad release commitem `28a6563`.

⛔ Na Macu po publikaci stále nainstalovaná 0.1.2. Skutečný update, produkční upload,
zvuk a oznámení macOS se neodvozují z vydání ani unit testů.

## Dokončená implementace

| Část | Výsledek a důkaz |
|---|---|
| T0–T1, R1 | Bezpečná projekce, trvalá per-track ID/session/progress, obnova fronty a restartovatelná 429 pauza. |
| T2 | Výslovné převzetí s identitou, revizí a nativním potvrzením; reset serverového stavu a zachování held. |
| T3–T4 | Lokální přehled kompletních/částečných/chybějících dat; ruční porovnání známých ID s velikostí, SHA-256 a stavem obou stop. |
| T5 | Send/keep, trvalý název a consent, automatika jen nových nahrávek, per-item retry, bezpečný koš a Finder. Uložení nečeká na dokončení sítě. |
| A1–A4 | Finder upload scope, identita z userinfo, výběr firmy v Nastavení a trvalá firma před prvním INIT. Změna globální firmy nepřesune rozpracovaný upload. |
| I1 | Pravdivé stavové popisky, datum a krátké ID pro korelaci s potvrzovacím dialogem. |
| T6 | Vydaná 0.1.3 pro arm64/x64, podpis a notarizace, feed zveřejněný poslední; proužek, jednorázové oznámení a instalace na výslovnou akci. |

🧪 **Finální čistý klon `33938351`: 1505 PASS, tři původní skipy, lint, typecheck, kontrola baseline i build — exit 0.** [Doslovný výpis](../../../dukazy/nahravky-dashboard-2026-09-14/final/gates-clean-after-ci.log) a [review/přejímka](../../../dukazy/nahravky-dashboard-2026-09-14/final/OVERENI.md).

Převzaté poslední zdroje: T-A4 `c25ef2a` a T-I1 `d6bdfdd`. Root před commitem samostatně ověřil T-A4 1503 testy a I1 17 cílenými testy. Reporty i skutečné sabotáže jsou v `evidence/tasks/` a `dukazy/nahravky-dashboard-2026-09-14/`.

⚠️ Starší CI na `c21eca6` selhalo: časová fixture a cleanup před dokončením startup pumpy. Obě příčiny jsou opravené bez oslabení asercí nebo úklidových výjimek. [Původní důkazy](../../../dukazy/nahravky-dashboard-2026-09-14/integrace/ci-opravy/review.md) jsou zachované; pozdější časově citlivá aserce updateru je rovněž opravená bez změny runtime. **Finální [GitHub CI 34907553077](https://github.com/Make-more-s-r-o/ludone-desktop/actions/runs/34907553077) na `33938351` prošlo**, 1505 PASS a build. Metadata a celý log jsou ve `final/ci-green.*`.

🟡 **Nativní GUI 0.1.2**: samostatný profil s vypnutým transportem, dostupná Nastavení bez loginu, čitelný Účet s firmou a prázdný přehled. Aplikace po kontrole ukončená. Nejde o produkční login, zvuk nebo ruční akce nad reálnými nahrávkami. `ui-smoke` a `audio-smoke` agent nespouštěl.

## Živá přejímka a aktuální blokace

- ✅ Vydání 0.1.3: release workflow a nezávislá veřejná kontrola úspěšné. Instalace na Macu zatím stále 0.1.2.
- ⚠️ Čtyři schválené staré položky v 0.1.2 zůstaly `ceka` po chybě nevybrané firmy.
  Dashboard v 0.1.2 chybně nenabízí retry. Oprava je publikovaná v 0.1.3, živé opakování čeká.
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
