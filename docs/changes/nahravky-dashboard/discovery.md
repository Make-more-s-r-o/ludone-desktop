# Discovery — nahravky-dashboard

Zpětná syntéza měření k 14. 9. 2026. Rozlišuje výchozí schopnost, již integrované části a dosud neprovedené živé ověření; neprohlašuje pozdější packet za dřívější dispatch.

| Požadavek | Už existuje | Částečně | Chybí | Důkaz | Dopad |
|---|---|---|---|---|---|
| Nahrání mikrofonu a systému a lokální manifest | ✓ | — | — | Finish zapisuje manifest a enqueue až před návratem (`electron/main.cjs:2502-2564`). | Nový běh navazuje na stávající nahrávání; živý zvuk musí ověřit člověk. |
| Bezpečná queue projekce včetně legacy položek | ✓ | — | — | T-00 je převzatý v reportu `evidence/tasks/T0.report.json`; plán jej eviduje integrovaný (`docs/changes/nahravky-dashboard/plan.md:19-24`). | T-02 až T-05 nesmějí vrátit interní cesty nebo hádat chybějící metadata. |
| Per-track recordingId/session a restart po částečném uploadu | ✓ | — | — | Integrační commity `fdb4535`, `53ca859`; AC zachovává obě identity (`docs/changes/nahravky-dashboard/spec.md:85-91`). | Dashboard a retry mohou pracovat s jednotlivými stopami bez nového INIT. |
| Výslovné převzetí cizí položky | ✓ | — | — | T-02 je převzatý v `a25bd5c` a AC vyžaduje potvrzení i stale guard (`docs/changes/nahravky-dashboard/STAV.md:5-12`, `docs/changes/nahravky-dashboard/spec.md:93-105`). | Převzetí zůstává jednotlivé a nikdy nespouští upload. |
| Lokální dashboard, orphan/ghost a poškozený manifest | — | ✓ | — | T-03 je v aktuálním stavu navazující etapa, ne živě přijatý výsledek (`docs/changes/nahravky-dashboard/STAV.md:15-18`). | T-04/T-05 čekají na jeho skutečný integrační kontrakt. |
| Ruční serverové ověření známých ID | — | — | ✓ | Spec požaduje read-only GET až výslovnou akcí (`docs/changes/nahravky-dashboard/spec.md:115-121`). | Nesmí vzniknout polling, list endpoint ani záměna lokálního a serverového stavu. |
| Per-item consent, automatika nových a bezpečné akce | — | — | ✓ | AC-05/06 popisují restart, neretroaktivitu a fresh-item akce (`docs/changes/nahravky-dashboard/spec.md:123-143`). | T-05 musí durable uložit intent a chránit delete/retry/send revizemi. |
| Produkční OAuth scope a obnova invalid_client | ✓ | — | — | T-A1 má převzatý report bez live loginu (`evidence/tasks/A1.report.json`; `docs/changes/nahravky-dashboard/STAV.md:5-9`). | Kód je 🧪; Finder login zůstává Danovým krokem. |
| Podepsaný release, atomický feed a viditelný updater | — | ✓ | — | Workflow vyžaduje zálohu/konfiguraci, publikuje feed poslední a ověřuje veřejný feed (`.github/workflows/release-macos.yml:27-86`, `.github/workflows/release-macos.yml:96-182`). | Příprava je 🧪; signed build, tag, publikace a update zůstávají ⛔/🟡. |

## Rozpory

- Historický `desktop-v1` odkládal sync a spojoval více druhů dokončení. Současný schválený záměr a D10–D13 určují aktuální rozsah; rozdíl je výslovně veden ve specifikaci (`docs/changes/nahravky-dashboard/spec.md:177-180`).
- Tier L očekává hookový `approved.json`, ale autorizace proběhla vloženým uživatelským záměrem a redesign byl odložen. Agent soubor nevyrábí; design manifest proto ponechává tento C2 nález viditelný (`docs/changes/nahravky-dashboard/plan.md:9-15`).
- Zelené testy T-00/T-01/T-A1/T-06 nejsou důkaz reálného zvuku, Finder loginu ani nového vydání (`AGENTS.md:26-36`, `docs/changes/nahravky-dashboard/STAV.md:5-25`).

## Aktivní worktrees a kolizní práce

| Worktree / role při syntéze | Vlastnictví | Kolize a opatření |
|---|---|---|
| `nahravky-integrace` / koordinátor | Integrace, status a přejímka | Jediný koordinátor zapisuje stav; docs worker jej nemění. |
| `nahravky-masterplan` / docs | Jen masterplan artefakty přidělené packetem | Žádné runtime soubory ani status/progress. |
| T-03 worker | Queue, main, preload a dashboard podle packetu | Sdílené soubory se předávají sekvenčně T-03 → T-R1 → T-04 → T-05 (`docs/changes/nahravky-dashboard/tasks/DAG.md:1-40`). |

Snapshot worktrees je provozní údaj k tomuto běhu, ne trvalý registr. Koordinátor jej před každým dispatchem ověří znovu. Síťové secrets, podpisový klíč, produkční login, skutečný zvuk a nová publikace nebyly v discovery čtené ani provedené.
