# DAG — desktop-astra-parity-0-1-6

## Závislosti

| task | závislosti | důvod |
|---|---|---|
| T-01 | — | Zjištění a designový kontrakt |
| T-02 | T-01 | Společný shell a navigace |
| T-03 | T-02 | Teď, záznam a uložení |
| T-04 | T-03 | Můj den a detail |
| T-05 | T-04 | Nastavení, identita a update |
| T-06 | T-05 | Electron E2E a vizuální porovnání |
| T-07 | T-06 | Review, CI a vydání |

## Hotspoty

| soubor | vlastník | důvod |
|---|---|---|
| `src/App.jsx` | koordinátor | Sekvenční převzetí T-02 a T-03; jediný zapisovatel. |
| `src/styles.css` | koordinátor | Sekvenční převzetí T-02 až T-05. |
| `src/App.test.jsx` | koordinátor | Testovací hotspot T-02 a T-03. |
| `src/components/Settings.test.jsx` | koordinátor | Testovací hotspot T-02 a T-05. |
| `tests/settings.test.js` | koordinátor | Testovací hotspot T-02 a T-05. |
| `src/astra-parity.css` | koordinátor | Sdílená Astra kompozice. |
| `electron/main.cjs` | koordinátor | Okna a sender guard T-02. |
| `electron/preload.cjs` | koordinátor | Capability API T-02. |
| `src/components/Settings.jsx` | koordinátor | Sekvenční převzetí T-02 a T-05. |
| `scripts/astra-design-e2e.mjs` | koordinátor | Převzetí T-06 před každou další změnou. |

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

Souběžné práce používají oddělené worktree; koordinátor integruje sekvenčně. Historickou implementaci nepřevádíme zpětně na formálně schválený dispatch.
