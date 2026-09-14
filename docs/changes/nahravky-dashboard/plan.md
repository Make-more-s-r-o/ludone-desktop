---
status: draft
approvedBy:
approvedAt:
sha:
approvedVia:
---

# Plán — dokončení nahrávek (`nahravky-dashboard`)

Schválený Danův goal z 14. 9. 2026 určuje rozsah a autonomii běhu. Frontmatter zůstává `draft`, protože neexistuje hookový approval konkrétního souboru; žádný `approved.json`, hook ani SHA se zpětně nevyrábí. Rozhodnutí D10 dovoluje pokračovat bez nového kola schvalování a bez redesignu. Výchozí commit zadání je `0109d0e`.

## Kontext

Desktop už nahrává a obsahuje upload klienta, ale uživatelská cesta z Finderu dosud nemá úplný, pravdivý přehled, bezpečné převzetí staré položky, volbu odeslání ani doložené vydání nové verze. Autoritativní vstupy jsou [intent](intent.md), [zadání](ZADANI-PRO-CODEX.md), [rozhodnutí](decisions.md) a [specifikace](spec.md).

## Změřeno

| Co | Hodnota | Důkaz |
|---|---|---|
| Stávající download feed | Verze 0.1.1 a čtyři instalační balíčky vracejí HTTP 200 | Read-only měření běhu 14. 9.; nejde o ověření nové verze. |
| T-00 a T-A1 | Integrované; testy zelené, bez live audio/login | Reporty `evidence/tasks/T0.report.json` a `evidence/tasks/A1.report.json`. |
| T-01 | Integrované po review; 417 cílených testů zelených | Commity `fdb4535` a `53ca859`; živý upload se tím nedokládá. |
| T-06 a updater | Integrované, včetně veřejné HTTPS kontroly po SSH; nová verze nezveřejněná | Commit `2499dbb`; koordinátorova brána: 1341 testů zelených, tři známé baseline skipy, exit 0. Signed build nebyl vytvořen. |

## Architecture Spine

### Hlavní proces a fronta

- Hlavní proces vlastní trvalý stav, identitu relace a kontrolu IPC odesílatele.
- Fronta serializuje mutace; upload nesmí vstoupit do téže serializace podruhé.
- Renderer dostává bezpečnou projekci bez absolutních cest, tokenů a otisků vlastníka.
- Převzetí, smazání a další mutace validují ID i revizi čerstvého snímku.

### Serverové ověření a vydání

- Serverové ověření je read-only GET pouze podle známých ID; lokální a serverový stav se neslévají.
- Release validuje balíčky před přenosem. Verzované soubory a blockmapy se přenesou před feedem; `latest-mac.yml` se povýší poslední atomickou operací.
- Úspěch uploadu není úspěch veřejného vydání; po přenosu musí navazovat ověření veřejného feedu a souborů.

## Feature matrix a dělba práce

| Task | Feature | KDO | Závisí na | Přijetí |
|---|---|---|---|---|
| T-00 | NRD-01 | Sol fronta | — | Bezpečná projekce včetně legacy položek, bez interních cest. |
| T-01 | NRD-01 | Sol fronta | T-00 | Per-track ID/session přežijí částečný úspěch a restart. |
| T-02 | NRD-02 | Sol převzetí | T-01 | Platná identita, potvrzení, stale revision a IPC guard. |
| T-03 | NRD-03 | Sol dashboard | T-02 | Fronta, osiřelé/chybějící soubory a poškozená data mají vlastní stavy. |
| T-04 | NRD-04 | Sol dashboard | T-R1 | Jen GET známých ID, obě stopy, cache, 404/429/auth/network stavy. |
| T-05 | NRD-05, NRD-06 | Sol integrace/UI | T-04 | Consent, automatika jen nových záznamů a per-item akce. |
| T-A1 | NRD-07 | Sol auth | — | Finder default, scope a bezpečná obnova `invalid_client`. |
| T-A3 | NRD-07 | Sol firma | T-A2; wiring až po T5 | Controller nabídky, explicitní UI volba a atomická vazba na skutečnou relaci. |
| T-A4 | NRD-07, NRD-01, NRD-06 | Sol firma | T-05, T-A3 | Skutečné Settings/IPC a trvalá firma uploadu před INIT; změna globální firmy nepřesune rozpracované stopy. |
| T-R1 | NRD-01 | Sol fronta | T-03 | `429` neubírá pokus a respektuje společné `Retry-After`. |
| T-06 | NRD-08 | Sol vydání | — pro přípravu; T-05, T-A1 a T-R1 pro release | Validace, archiv pro review, bezpečné SCP, feed poslední, stav aktualizace v UI. |
| M-01 | všechny | Astra | všechny implementace | Review diffu, `gates`, `gates:clean`, evidence a přejímka. |

Přesný graf a aktuální vlastnictví hotspotů je v [DAG](tasks/DAG.md). `electron/main.cjs`, `electron/preload.cjs`, `src/components/Settings.jsx` a `src/styles.css` má v jednom okamžiku právě jednoho zapisovatele; vlastník se přiděluje před každým packetem.

## Pořadí

1. Převzít integrované T-00, T-01, T-A1, updater a T-06; T-02 už běží podle lintnutého packetu.
2. Po přijetí T-02 pokračovat T-03, potom T-R1 a T-04. Závislé změny fronty a main procesu mají jednoho zapisovatele a integrují se postupně.
3. T-05 spojí consent, akce a hotový přehled. T-A3 základ výběru firmy je přijatý; T-A4 zapojí main/preload/Settings sekvenčně po T5 a před finální přejímkou.
4. T-06 lze reviewovat průběžně, ale veřejné vydání čeká na přijetí funkčního řetězce, publikační konfiguraci, zálohu klíče a Danův tag.
5. Koordinátor provede finální review, brány a předání Danovi k živému testu.

## Definition of Done po etapách — ČÍM to ověřím

| Task | Čím | Očekávaný výsledek a evidence |
|---|---|---|
| T-00/T-01 | Cílené queue/upload testy + `npm run gates` | Per-track stav a restart zelené; doslovné logy v `dukazy/nahravky-dashboard-2026-09-14/`. |
| T-02 | `mp-lint --packet T-02`, cílené queue/IPC/UI testy, sabotáže | Lint 0 nálezů; stale/owner guard zčervená po odstranění a legitimní cesta zůstane zelená. |
| T-03/T-04 | Dashboard testy a mock server bez zápisu | Poškození není empty; GET stavy a obě stopy jsou rozlišitelné. |
| T-05/T-R1 | Consent/retry/delete testy a 429 mock | Staré položky se samy nerozešlou; pumpa respektuje serverový limit. |
| T-A1 | Auth/IPC testy, potom Danův Finder login | Testy jsou 🧪; živé přihlášení teprve dává ✅. |
| T-A3/T-A4 | Skutečný company CAS, mock nabídka, Settings/IPC a restart uploadu | Výběr neodesílá, pin je durable před INIT, změna firmy nemění initialized upload. |
| T-06 | Release validátor, mocked SSH publication a veřejná read-only kontrola | Testy jsou 🧪; signed/notarized instalace a update na Macu teprve dávají ✅. |
| M-01 | `npm run gates` a `npm run gates:clean` | Oba příkazy exit 0, doslovné výpisy archivované. |

## Rizika a pasti

- Vlastník se může změnit během potvrzení; generační a revizní kontrola musí proběhnout při skutečném zápisu.
- Init serverového uploadu je zapisující operace; nesmí se použít pro zjišťování starého ID.
- Zapnutí automatiky může tiše rozeslat staré položky, pokud consent není uložen per-item.
- Zelené SSH/SCP může mířit do špatného adresáře; veřejný feed a artefakty se musí po povýšení zkontrolovat read-only.
- Electron builder notarizuje vloženou `.app`; dokumentace a validace DMG musí popisovat skutečný obsah balíčku, ne tvrdit notarizaci samotného DMG/ZIP.

## Hranice autonomie

Běh nesmí měnit backend, LuTrack ani `design/`, číst hodnoty secrets, použít podpisový klíč bez potvrzené zálohy, vytvořit release tag nebo veřejně publikovat před splněním bran. Dan pushuje tag a provádí skutečný test instalace a aktualizace.

## Rollback a stopky

Každý task je samostatně revertovatelný před vydáním. Při neplatné identitě, nejasné revizi, chybějící publikační konfiguraci nebo neověřeném klíči se zastaví jen závislá větev. Veřejný feed se nepovýší, dokud nejsou soubory kompletní; při selhání zůstává předchozí feed 0.1.1 autoritativní.
