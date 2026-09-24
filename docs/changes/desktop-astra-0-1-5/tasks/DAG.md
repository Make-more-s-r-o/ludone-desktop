# DAG — LuDone Desktop 0.1.5

**Plan ID:** `desktop-astra-0-1-5` · **větev:** `feat/desktop-astra-next-v0-1-5`.

```text
T-01 Značka a navigace ---> T-02 Pravdivý stav LuTracku ---> T-03 Review a vydání
```

## Závislosti a proč

| task | čeká na | důvod |
|---|---|---|
| T-01 | — | Připraví existující vstup do nahrávek, značku a navigaci, na kterou naváže úprava panelu. |
| T-02 | T-01 | Upraví panel a odstraní falešné ovládání LuTracku až po uzavření společných změn panelu. |
| T-03 | T-01, T-02 | Review, brány a vydání popisují jeden finální diff, ne mezistav jedné části. |

## Hotspot soubory — jeden job na soubor, ne jeden na worktree

| soubor | vlastník | nesmí souběžně měnit |
|---|---|---|
| `src/App.jsx` | T-01 | T-02, T-03 |
| `src/components/Settings.jsx` | T-01 | T-02, T-03 |
| `electron/main.cjs` | T-01 | T-02, T-03 |
| `electron/preload.cjs` | T-01 | T-02, T-03 |
| `src/features/tracking/TrackingCard.jsx` | T-02 | T-01, T-03 |
| `scripts/tray-ikony.mjs` | T-01 | T-02, T-03 |

## Packety a jejich executor

| task | packet | executor |
|---|---|---|
| T-01 | `tasks/T-01.md` | `codex` |
| T-02 | `tasks/T-02.md` | `codex` |
| T-03 | `tasks/T-03.md` | `codex` |
