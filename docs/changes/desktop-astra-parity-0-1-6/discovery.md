# Zjištění — desktop-astra-parity-0-1-6

| Požadavek | Existuje | Částečně | Chybí | Důkaz | Dopad |
|---|---|---|---|---|---|
| Jeden společný Astra shell „Teď / Můj den / Nastavení“ | Značka, panel a settings window | 0.1.5 má ikonu a přímý vstup do Nahrávek | Sdílená navigace a společná kompozice | `src/App.jsx:316-419`, `src/components/Settings.jsx:607-645`, `electron/main.cjs:990-1095` | Nutná změna shellu; IPC hash `#settings` zůstává. |
| Můj den se skutečnými lokálními/odeslanými nahrávkami | Dashboard a čtení fronty | Je izolovaný v Nastavení | Denní kompozice, prázdné/chybové stavy a cesta do detailu | `src/features/recordings/RecordingsDashboard.jsx`, `src/App.jsx:311-351` | Reuse stávajícího zdroje dat a akcí, nevymýšlet historii. |
| LuTrack přítomný v návrhu, ale nefunkční | Placeholder disabled | Je vidět v panelu | Jeho vizuální role v novém shellu | `src/features/tracking/TrackingCard.jsx` a D2 z minulé změny | Zachovat neaktivitu; žádný timer ani časový záznam. |
| Styl odpovídá Astra „Nit dne“ | Oficiální LuDone značka a některé ikony | Úprava identity v 0.1.5 | Typografie, navigace, typografická hierarchie, prázdné/chybové stavy, den a nastavení | Astra `index.html`, `styles.css`, `assets/tokens.css`; screenshot dodaný 24. 9. | Portovat přes stávající komponenty; testovat světlé i tmavé téma. |
| End-to-end důkaz před vydáním | Unit, integrace a stávající `ui-smoke` | `ui-smoke` ověřuje přihlášení, panel, záznam a nastavení; neporovnává Astra plochy | Paritní E2E průchod/screenshoty Teď–Můj den–detail–Nastavení–update | `scripts/ui-smoke.mjs`, `src/lib/ui-smoke.js`, `tests/ui-smoke.test.js`, `AGENTS.md:26-45` | Přidat samostatnou bránu; živý Mac průchod oddělit od testů CI. |
| Aktualizace a off-line stav | Stávající updater, queue a UI feedback | Nejsou ve sdíleném shellu a screenshot důkazu Astra | Jejich jednotná navigace a přejímka | `src/components/ApplicationUpdateStatus.jsx`, `src/lib/queue.js`, `tests/release-workflow.test.js` | Zachovat stávající funkčnost a souhlas uživatele. |

## Závěr

Premisa uživatele platí: nainstalovaná 0.1.5 není celý schválený Astra návrh. Změna je UI L; backend, LuTrack služba a nový serverový kontrakt jsou mimo rozsah. Zdroj pravdy pro vzhled je původní `round2/variants/astra/`, pro skutečná oprávnění a data současný desktop kód.
