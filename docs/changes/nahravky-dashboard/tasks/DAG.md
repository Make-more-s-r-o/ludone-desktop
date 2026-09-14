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

## Hotspoty pro T-03 po přijetí T-02

Dokud T-02 běží, zůstávají jeho hotspoty výhradně jeho. Následující vlastnictví začne platit až po přijetí a integraci T-02; teprve potom smí koordinátor dispatchovat T-03.

| Soubor | Vlastník | Poznámka |
|---|---|---|
| `electron/queue.cjs` | T-03 | Serializovaný getter; queue a claim kontrakty zůstávají zachované. |
| `electron/main.cjs` | T-03 | Jen queue/dashboard IPC; auth, updater a ostatní bloky jsou read-only. |
| `electron/preload.cjs` | T-03 | Jen most lokálního přehledu a případně existující retry. |
| `src/features/recordings/RecordingsDashboard.jsx` | T-03 | Rozšíření komponenty po T-02 při zachování claim UI. |
| `src/styles.css` | T-03 | Jen styly lokálního přehledu se stávajícími tokeny. |

## Packety a executor

| Task | Packet | Executor |
|---|---|---|
| T-02 | `tasks/T-02.md` | Sol převzetí |
| T-03 | `tasks/T-03.md` | Sol dashboard |

Přesné vlastnictví souborů určuje packet a dispatch. `electron/main.cjs` se dělí pouze na explicitně vyjmenované bloky (auth / queue / updater). Žádné souběžné zápisy do jednoho stromu. Koordinátor píše integrační dokumenty, mění stav masterplánu a provádí přejímku.
