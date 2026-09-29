# Rozhodnutí — LuDone Desktop 0.1.6

## D1 — Implementovat celý schválený návrh Astra „Nit dne“

- **Kdo:** Dan, nejprve volbou Astra a následným výslovným pokynem implementovat návrh samostatně.
- **Volba:** Předělat skutečný desktopový tok tak, aby odpovídal celé variantě B; nejde jen o ikonu a vstup na stránku Nahrávky.
- **Důkaz:** `round2/variants/astra/manifest.json`, `FINALIZATION.md` a uživatelské zprávy z 23.–24. 9. 2026.

## D2 — LuTrack zůstává pouze připraveným placeholderem

- **Kdo:** Dan, pokynem „LuTrack ještě neexistuje… zatím teda neimplementuj“.
- **Volba:** Žádný lokální časovač, časové zápisy, synchronizace ani propojení s `app.ludone.cz`; UI musí pravdivě říct, že funkce není připravena.

## D3 — Produktová data nejsou data prototypu

- **Kdo:** Bezpečný výchozí stav vyplývající z účelu schválené makety a současných API.
- **Volba:** Ve skutečné aplikaci se zobrazují pouze dostupné lokální/frontové/serverem ověřené údaje. Demo jména, časové úseky ani úspěšné stavy se nepřebírají.

## D4 — Před dalším vydáním musí projít designová E2E brána

- **Kdo:** Dan, aktuálním výslovným pokynem.
- **Volba:** Ověřit skutečně sestavený desktopový renderer a klíčové cesty, uložit screenshoty a porovnat je se schváleným návrhem. Bez tohoto důkazu se nevytváří release tag ani publikace.

## D5 — Zachovat serverové a IPC hranice

- **Kdo:** Projektová bezpečnostní pravidla.
- **Volba:** Neměnit backend, LuTrack ani cizí `design/`; nepřidávat nové pravomoci rendereru. Jestli UI vyžaduje novou capability nebo API, zůstává dotčená část blokovaná a výsledek se nezamlčí.
