# Kontext projektu — desktop-astra-parity-0-1-6

Verze výřezu: 24. 9. 2026. Projektový `.masterplan/` overlay v repozitáři chybí; změna proto používá univerzální masterplan proces a pravidla `AGENTS.md`.

## Repozitář a pracovní prostor

- Dokumentaci a komentáře píšeme česky, commity anglicky; izolovaná práce patří do vlastního worktree (`AGENTS.md:6-24`).
- Cizí změny nevracíme ani nepřebíráme; `design/` je samostatná práce (`AGENTS.md:18-24,56-66`).

## Produkt a uživatelé

- Hlavní panel nyní skládá skutečný `RecordingCard`, frontu a neaktivní `TrackingCard`; nastavení otevírá zvláštní okno (`src/App.jsx:311-419`, `src/components/Settings.jsx:607-645`).
- Schválená Astra popisuje okamžitý panel, Můj den, detail, uložení/odeslání, chybové a obnovovací stavy, nastavení, update, onboarding a identitu (`docs/changes/desktop-redesign-2026-09-23/round2/variants/astra/manifest.json:1-13`).
- Starší rozhodnutí výslovně ponechává LuTrack bez časovače a integrace (`docs/changes/_archive/desktop-astra-0-1-5/decisions.md:10-14`).

## Technologie

- Renderer používá React/Vite a Electron; zachová se izolace rendereru a stávající most `window.ludone` (`package.json:7-8,91-127`, `electron/main.cjs:990-1014`).
- Hlavní proces vytváří samostatný 400px panel a 640×744px nastavení; změna jejich navigace nebo velikosti musí zachovat pozici u ikony a ochranu IPC (`electron/main.cjs:877-950,990-1095`).

## Příkazy a brány

- `npm run gates` — lint, typová kontrola, unit testy a kontrola baseline přeskočení (`package.json:102-110`).
- `npm run build` — produkční sestavení rendereru (`package.json:91-98`).
- `ui-smoke` a `audio-smoke` vyžadují GUI a skutečné oprávnění Záznam obrazovky; důkaz z automatického CI je nenahrazuje (`AGENTS.md:26-45`).

## Architektonické invarianty

- Panel běží v `#panel`, Nastavení v `#settings`; hash a trusted-sender kontroly jsou bezpečnostní hranice (`electron/main.cjs:990-1014`, `tests/ipc-sender-guard.test.js`).
- Automatické aktualizace jsou v test režimu vypnuté; update UI má používat existující IPC a čekat na souhlas uživatele (`electron/main.cjs:4018-4024`, `tests/release-workflow.test.js`).

## Doménová pravidla

- Jedna schůzka se ukládá jako jedna stereo nahrávka; souhlas s odesláním zůstává výslovný, místní kopie i fronta zachovávají autoritativní stav (`docs/changes/nahravky-dashboard/ZADANI-PRO-CODEX.md`, `src/features/recording/RecordingCard.jsx`).
- Serverové ID a skutečný stav se ukazují jen po ověření přes stávající desktopový API klient; UI nesmí nahrazovat neznámé údaje odhadem (`src/features/recordings/RecordingsDashboard.jsx`, `src/lib/queue.js`).

## Bezpečnost a schvalování

- Tajemství ani podpisové klíče nepatří do repozitáře; žádná nová role IPC ani oslabení sender guardu není součástí návrhu (`AGENTS.md:47-54`).
- Vydání je blokované do úspěšného E2E designového průchodu a review diffu; uživatelův nynější požadavek nahrazuje předchozí očekávání okamžité publikace.

## Zdroje

1. `AGENTS.md` — pracovní, bezpečnostní a důkazní pravidla (`AGENTS.md:1-69`).
2. `ROZHODNUTI.md`, `PLAN.md`, `DAN-TODO.md` — rozhodnutí a aktuální desktopové limity.
3. Schválený design `docs/changes/desktop-redesign-2026-09-23/round2/variants/astra/` — vizuální a interakční autorita; původní HTML zůstává nedotčené.
4. Stávající renderer, IPC, testy a akceptační skripty — pravda o aktuálním chování.
