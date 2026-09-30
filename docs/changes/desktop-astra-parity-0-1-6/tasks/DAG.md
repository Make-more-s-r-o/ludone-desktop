# DAG — desktop-astra-parity-0-1-6

## Závislosti

| task | závislosti | důvod |
|---|---|---|
| T-01 | — | Původní zjištění |
| T-02 | T-01 | Původní shell |
| T-03 | T-02 | Původní Teď |
| T-04 | T-03 | Původní den |
| T-05 | T-04 | Původní nastavení |
| T-06 | T-05 | Původní E2E |
| T-07 | T-06 | Původní vydání |
| T-08 | — | Produktové nastavení |
| T-09 | — | Produktový den |
| T-10 | — | Produktový panel |
| T-11 | T-08, T-09, T-10 | Integrace a přejímka |

## Hotspoty

| soubor | vlastník | důvod |
|---|---|---|
| `src/App.jsx` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `src/App.test.jsx` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `src/styles.css` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `src/astra-parity.css` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `src/components/Settings.jsx` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `src/components/Settings.test.jsx` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `tests/settings.test.js` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `src/components/ApplicationUpdateStatus.jsx` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `src/components/ApplicationUpdateStatus.test.jsx` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `src/features/recording/RecordingCard.jsx` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `tests/recording-card.test.js` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `src/features/recordings/RecordingsDashboard.jsx` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `src/features/recordings/RecordingsDashboard.test.jsx` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `src/features/recordings/RecordingDayPreview.jsx` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `src/features/recordings/RecordingDayPreview.test.jsx` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `tests/recordings-dashboard.test.js` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `electron/main.cjs` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `electron/preload.cjs` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `tests/queue-wiring.test.js` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `scripts/astra-design-e2e.mjs` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |
| `package.json` | koordinátor | Sekvenční převzetí původních a nových packetů; nový běh: Settings T-08, dashboard T-09, panel T-10, ostatní T-11. |

## Packety a executor

| task | packet | executor |
|---|---|---|
| T-01 | `tasks/T-01.md` | codex |
| T-02 | `tasks/T-02.md` | codex |
| T-03 | `tasks/T-03.md` | codex |
| T-04 | `tasks/T-04.md` | codex |
| T-05 | `tasks/T-05.md` | codex |
| T-06 | `tasks/T-06.md` | codex |
| T-07 | `tasks/T-07.md` | codex |
| T-08 | `tasks/T-08.md` | codex |
| T-09 | `tasks/T-09.md` | codex |
| T-10 | `tasks/T-10.md` | codex |
| T-11 | `tasks/T-11.md` | codex |

T-08/T-09/T-10 pracují souběžně v samostatných worktrees, se svými scoped CSS.
T-11 vlastní sdílené CSS, main/preload, audit, dokumentaci a verzi. Historické
tasky ani schvalovací hook nepřevádíme zpětně na proběhlý dispatch.
