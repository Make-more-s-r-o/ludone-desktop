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

## Hotspoty

Vlastnictví je pro nejbližší dispatch `T-02`; koordinátor ho před každým dalším packetem přidělí znovu.

| Soubor | Vlastník | Poznámka |
|---|---|---|
| `electron/main.cjs` | T-02 | Jen helpery a IPC fronty; bloky auth a updateru jsou při tomto dispatchu read-only. |
| `electron/preload.cjs` | T-02 | Jen queue most. |
| `src/components/Settings.jsx` | T-02 | Jediný renderer worker. |
| `src/styles.css` | T-02 | Jen styly přehledu se stávajícími tokeny. |

## Packety a executor

| Task | Packet | Executor |
|---|---|---|
| T-02 | `tasks/T-02.md` | Sol převzetí |

Přesné vlastnictví souborů určuje packet a dispatch. `electron/main.cjs` se dělí pouze na explicitně vyjmenované bloky (auth / queue / updater). Žádné souběžné zápisy do jednoho stromu. Koordinátor píše integrační dokumenty, mění stav masterplánu a provádí přejímku.
