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

## Hotspoty a globální vlastnictví sdílených souborů

Aktuální etapa je T-03. Tabulka jmenuje právě jednoho současného vlastníka a závazné pořadí budoucího předání. Není to autorizace souběhu: další vlastník začne zapisovat až po převzetí a integraci předchozí etapy.

| Soubor | Aktuální vlastník | Pořadí předání | Poznámka |
|---|---|---|---|
| `src/lib/queue.js` | T-R1 | T-R1 → T-05 | T-03 soubor nemění; T-R1 jej převezme po integraci T-03. |
| `src/lib/queue.test.js` | T-R1 | T-R1 → T-05 | Testovací sibling čisté queue logiky. |
| `electron/queue.cjs` | T-03 | T-03 → T-R1 → T-04 → T-05 | Store, dashboard detail, cooldown, verify target a consent postupně. |
| `electron/queue.test.cjs` | T-03 | T-03 → T-R1 → T-04 → T-05 | Testovací sibling store. |
| `electron/main.cjs` | T-03 | T-03 → T-R1 → T-04 → T-05 | IPC a lifecycle bloky se předávají sekvenčně. |
| `electron/main.test.cjs` | T-03 | T-03 → T-R1 → T-04 → T-05 | Testovací sibling hlavního procesu. |
| `electron/preload.cjs` | T-03 | T-03 → T-04 → T-05 | Úzké mosty dashboardu, ověření a akcí. |
| `electron/preload.test.cjs` | T-03 | T-03 → T-04 → T-05 | Testovací sibling preloadu. |
| `src/features/recordings/RecordingsDashboard.jsx` | T-03 | T-03 → T-04 → T-05 | Lokální přehled, serverové výsledky a akce. |
| `src/features/recordings/RecordingsDashboard.test.jsx` | T-03 | T-03 → T-04 → T-05 | Testovací sibling dashboardu. |
| `src/styles.css` | T-03 | T-03 → T-04 → T-05 | Jen existující tokeny a kompozice. |
| `electron/recordings-dashboard.cjs` | T-03 | T-03 → T-05 | Trusted diskový snapshot a pozdější akce. |
| `electron/recordings-dashboard.test.cjs` | T-03 | T-03 → T-05 | Testovací sibling diskového snapshotu. |
| `tests/queue.test.js` | T-03 | T-03 → T-R1 → T-04 → T-05 | Sdílené queue a store regrese. |
| `tests/queue-wiring.test.js` | T-03 | T-03 → T-R1 → T-04 → T-05 | Sdílené main/IPC wiring regrese. |
| `tests/ipc-sender-guard.test.js` | T-03 | T-03 → T-04 → T-05 | Ochrana odesílatele nových kanálů. |
| `tests/recordings-dashboard.test.js` | T-03 | T-03 → T-04 → T-05 | Integrační renderer test dashboardu. |
| `tests/settings.test.js` | T-03 | T-03 → T-05 | T-03 jej vlastní po review `19b89b4`; T-05 naváže později. |
| `src/components/Settings.jsx` | T-05 | T-05 | T-02 je přijatý; do další změny soubor nikdo jiný nepřebírá. |
| `src/components/Settings.test.jsx` | T-05 | T-05 | Testovací sibling Nastavení. |
| `electron/upload-client.cjs` | T-R1 | T-R1 → T-04 → T-05 | Strict Retry-After, requester export a title INIT postupně. |
| `electron/upload-client.test.cjs` | T-R1 | T-R1 → T-04 → T-05 | Testovací sibling upload klienta. |
| `tests/upload-client.test.js` | T-R1 | T-R1 → T-04 → T-05 | Sdílené HTTP a upload regrese. |

## Packety a executor

| Task | Packet | Executor |
|---|---|---|
| T-00 | `tasks/T-00.md` | Sol fronta — zpětný přehled |
| T-01 | `tasks/T-01.md` | Sol fronta — zpětný přehled |
| T-02 | `tasks/T-02.md` | Sol převzetí |
| T-03 | `tasks/T-03.md` | Sol dashboard |
| T-R1 | `tasks/T-R1.md` | Sol 429 cooldown |
| T-04 | `tasks/T-04.md` | Sol serverové ověření |
| T-05 | `tasks/T-05.md` | Sol consent a per-item akce |
| T-A1 | `tasks/T-A1.md` | Sol auth — zpětný přehled |
| T-06 | `tasks/T-06.md` | Sol vydání — zpětný přehled |

Přesné vlastnictví souborů určuje packet a dispatch. `electron/main.cjs` se dělí pouze na explicitně vyjmenované bloky (auth / queue / updater). Žádné souběžné zápisy do jednoho stromu. Koordinátor píše integrační dokumenty, mění stav masterplánu a provádí přejímku.
