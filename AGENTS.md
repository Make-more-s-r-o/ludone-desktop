# Pravidla práce v repozitáři LuDone Desktop

Tento soubor je vstupní bod pro každého člověka i agenta, který v repozitáři pracuje.
Konkrétní zadání etapy má přednost pro vlastnictví souborů a rozsah daného běhu.

## Jazyk

- Dokumentaci a komentáře piš česky.
- Commit messages piš anglicky.
- Názvy veřejných rozhraní a zavedené technické názvy neměň jen kvůli překladu.

## Git a pracovní stromy

- Větve pojmenovávej `<typ>/<oblast>-<popis>`; používej zejména prefixy `feat/`,
  `fix/` a `docs/`.
- Dnešní větve ukazují zamýšlený tvar: `feat/kostra-appky`, `feat/zvuk-dukaz`
  a `docs/server-modul-e8`.
- Izolovanou práci zakládej v `.claude/worktrees/<účel>`.
- Jeden zapisovatel pracuje v jednom worktree. Souběžné etapy nesmějí zapisovat do
  stejného stromu.
- Po dokončení a bezpečném převzetí práce worktree odstraň a jeho větev smaž.
- Před odstraněním worktree nejdřív archivuj všechny unikátní důkazy do `dukazy/`
  a ověř, že jsou verzované.
- Cizí změny v pracovním stromě nevracej, nepřebírej ani neuklízej.

## Důkaz a stav ověření

- Používej přesně pět stavů: ✅ ověřeno naostro, 🧪 zelené testy, ⛔ neověřeno,
  🟡 podmíněně platné nebo čekající na výslovně uvedené ověření a ⚠️ varování či
  rozpor vyžadující pozornost, který sám o sobě neurčuje stav ověření.
- Zelený test není důkaz skutečné funkčnosti.
- Tvrzení o zvukové cestě smí mít nejvýš stav 🧪, dokud ji nespustí člověk na
  skutečném Macu.
- U checkpointu ukládej doslovný výpis akceptačního příkazu včetně exit kódu.
- `ui-smoke` a `audio-smoke` potřebují GUI, zvuk a oprávnění Záznam obrazovky.
  V CI ani v sandboxu neběží; spouští je člověk na svém Macu.

## Brány a testy

- Na měřidlo se nesahá: existující testy a brány neupravuj jen proto, aby změna prošla.
- Nevyráběj výjimky, přeskočení ani baseline pro vlastní změnu.
- Domnělou oprávněnou výjimku popiš v poznámce včetně důvodu a rozhodnutí nech člověku.
- Každou etapu ověř jejím akceptačním skriptem; jednotlivé podmínky musí hlásit
  samostatné PASS nebo FAIL.
- Stav příkazu měř před případnou rourou. Na macOS nepoužívej příkaz `timeout`.

## Bezpečnostní mantinely

- Nezvyšuj oprávnění a nespouštěj nic, co si řekne o heslo správce.
- Tajemství nikdy nepatří do repozitáře: token, klíč ani soubor `.p12`.
- Podpisový klíč musí být před prvním použitím uložen ve firemním správci hesel,
  nikoli jen na jednom disku.
- Money-critical a bezpečnostní kód vyžaduje review nad diffem; týká se zejména
  přihlášení, tokenů, idempotence fronty a kontroly odesílatele IPC.

## Mapa repozitáře a zdroje pravdy

- `ROZHODNUTI.md` eviduje přijatá rozhodnutí a důvody, aby se znovu neotvírala.
- `PLAN.md` je aktuální implementační plán, pořadí etap, odhady a akceptační cíle.
- `DAN-TODO.md` obsahuje rozhodnutí a měření, která bez Dana nejdou provést.
- `specs/` obsahuje podrobné specifikace jednotlivých etap.
- `docs/behy/` obsahuje soběstačné briefy a provozní záznamy běhů.
- `dukazy/` je verzovaný archiv nenahraditelných měření a jejich výstupů.
- `scripts/akceptace/` obsahuje spustitelné brány etap s oddělenými výsledky
  PASS/FAIL.
- `design/` je samostatná, cizí práce; bez výslovného vlastnictví na ni nesahej.

Před prací čti dokumenty v pořadí `ROZHODNUTI.md` → `PLAN.md` →
`DAN-TODO.md` → příslušná specifikace nebo brief v `docs/behy/`.
