# Task DAG

`T-00` → `T-01` → `T-02` → `T-03` → `T-04` → `T-05` → přejímka. `T-A1` běží nezávisle a předchází přejímce; `T-R1` navazuje na `T-02`. `T-06` připravuje vydání nezávisle, zveřejnění čeká na přejímku a Dana.

## Závislosti

| Task | Závisí na | Důvod |
|---|---|---|
| T-00 | — | Bezpečná projekce je základ dalších operací fronty. |
| T-01 | T-00 | Trvalý výsledek uploadu rozšiřuje projekci. |
| T-02 | T-01 | Převzetí navazuje na trvalý stav položky; `T-01` už zahrnuje `T-00`. |
| T-03 | T-02 | Dashboard skládá frontu až po bezpečném převzetí. |
| T-04 | T-03 | Serverové ověření rozšiřuje hotový lokální přehled. |
| T-05 | T-04 | Akce a volba odeslání navazují na pravdivé stavy přehledu. |
| T-A1 | — | Přihlášení se integruje nezávisle. |
| T-R1 | T-02 | Chování 429 se doplní po serializovaném převzetí. |
| T-06 | — | Příprava vydání je nezávislá; zveřejnění má vlastní brány. |

## Hotspoty pro T-04 po přijetí T-03

Dokud T-03 není přijatý a integrovaný, zůstávají jeho hotspoty výhradně jeho. Následující vlastnictví začne platit až po jeho přijetí; teprve potom smí koordinátor dispatchovat T-04.

| Soubor | Vlastník | Poznámka |
|---|---|---|
| `electron/recording-verification.cjs` | T-04 | Jediný verifier, cache, rozpočet a mapování výsledků. |
| `electron/upload-client.cjs` | T-04 | Jen export a zpevnění stávajícího `createRequester`. |
| `electron/queue.cjs` | T-04 | Jen trusted getter detailu nad přijatým store kontraktem T-03. |
| `electron/main.cjs` | T-04 | Jen verify/open-web IPC a auth invalidace cache. |
| `electron/preload.cjs` | T-04 | Jen úzký verify/open-web most. |
| `src/features/recordings/RecordingsDashboard.jsx` | T-04 | Ruční ověření a zobrazení per-track výsledků v přehledu T-03. |
| `src/styles.css` | T-04 | Jen styly výsledků ověření se stávajícími tokeny. |

## Packety a executor

| Task | Packet | Executor |
|---|---|---|
| T-02 | `tasks/T-02.md` | Sol převzetí |
| T-03 | `tasks/T-03.md` | Sol dashboard |
| T-04 | `tasks/T-04.md` | Sol serverové ověření |

Přesné vlastnictví souborů určuje packet a dispatch. `electron/main.cjs` se dělí pouze na explicitně vyjmenované bloky (auth / queue / updater). Žádné souběžné zápisy do jednoho stromu. Koordinátor píše integrační dokumenty, mění stav masterplánu a provádí přejímku.
