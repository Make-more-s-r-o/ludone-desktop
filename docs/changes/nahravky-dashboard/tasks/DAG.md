# Task DAG

`T-00` → `T-01` → `T-02` → `T-03` → `T-R1` → `T-04` → `T-05` → přejímka. `T-A1` běží nezávisle a předchází přejímce. `T-06` připravuje vydání nezávisle, zveřejnění čeká na přejímku a Dana.

## Závislosti

| Task | Závisí na | Důvod |
|---|---|---|
| T-00 | — | Bezpečná projekce je základ dalších operací fronty. |
| T-01 | T-00 | Trvalý výsledek uploadu rozšiřuje projekci. |
| T-02 | T-01 | Převzetí navazuje na trvalý stav položky; `T-01` už zahrnuje `T-00`. |
| T-03 | T-02 | Dashboard skládá frontu až po bezpečném převzetí. |
| T-04 | T-R1 | Serverové ověření navazuje až po 429 ochraně kvůli sdíleným hotspotům. |
| T-05 | T-04 | Akce a volba odeslání navazují na pravdivé stavy přehledu. |
| T-A1 | — | Přihlášení se integruje nezávisle. |
| T-R1 | T-03 | Chování 429 se doplní po hotovém lokálním store a před serverovým ověřením. |
| T-06 | — | Příprava vydání je nezávislá; zveřejnění má vlastní brány. |

## Hotspoty pro T-R1 po přijetí T-03

Dokud T-03 není přijatý a integrovaný, zůstávají jeho hotspoty výhradně jeho. Následující vlastnictví začne platit až po jeho přijetí; teprve potom smí koordinátor dispatchovat T-R1. T-04 se dispatchuje až po převzetí T-R1.

| Soubor | Vlastník | Poznámka |
|---|---|---|
| `src/lib/queue.js` | T-R1 | Jen outcome 429 při zachování ostatních klasifikací a progressu. |
| `electron/queue.cjs` | T-R1 | Perzistentní owner cooldown, atomická mutace a kontroly pump/retry. |
| `electron/main.cjs` | T-R1 | Jen předání current owner do všech existujících vstupů pumpy a retry. |

## Packety a executor

| Task | Packet | Executor |
|---|---|---|
| T-02 | `tasks/T-02.md` | Sol převzetí |
| T-03 | `tasks/T-03.md` | Sol dashboard |
| T-R1 | `tasks/T-R1.md` | Sol 429 cooldown |
| T-04 | `tasks/T-04.md` | Sol serverové ověření |

Přesné vlastnictví souborů určuje packet a dispatch. `electron/main.cjs` se dělí pouze na explicitně vyjmenované bloky (auth / queue / updater). Žádné souběžné zápisy do jednoho stromu. Koordinátor píše integrační dokumenty, mění stav masterplánu a provádí přejímku.
