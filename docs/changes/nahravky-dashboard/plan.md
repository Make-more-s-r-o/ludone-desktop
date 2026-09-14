# Plán dokončení nahrávek

Plán schválen Danovým vloženým goalem 14. 9. 2026. Tento zápis přenáší schválený rozsah do repozitáře; nepředstírá dodatečné schválení hookem. Výchozí commit `0109d0e`.

## Společná architektura

Hlavní proces vlastní trvalý stav a kontroluje IPC odesílatele. Fronta serializuje všechny operace; odesílání nesmí vstupovat do stejné serializace podruhé. Výsledek uploadu patří každé stopě zvlášť. Renderer dostává bezpečnou projekci bez absolutních cest, tokenů a otisků vlastníka.

Smazání a převzetí musí validovat konkrétní položku i čerstvost záměru. Neznámý starý serverový identifikátor se nezjišťuje zapisujícím init požadavkem. Retence zůstává zdrojem životnosti lokálních záznamů.

## Pořadí a vlastnictví

| Úkol | Kdo | Závisí na | Přijetí |
|---|---|---|---|
| T0 – projekce fronty | Sol fronta | — | Metadata i legacy položky bez úniku interních cest. |
| T1 – trvalé výsledky uploadu | Sol fronta | T0 | Mock server → skutečný soubor fronty; jedna/dvě stopy, částečný výsledek a restart. |
| T2 – explicitní převzetí | Sol fronta + UI, postupně | T1 | Platná identita, potvrzení, stale snapshot a guard v testech. |
| T3 – lokální dashboard | Sol dashboard | T2 | Fronta + osiřelé soubory + poškozená data; retence bez falešného archivu. |
| T4 – ověření na serveru | Sol dashboard | T3 | Jen GET podle známých ID, shoda obou stop, cache, limit a poctivé chybové stavy. |
| T5 – akce a odesílání | Sol integrace/UI | T4 | Per-item retry/delete/reveal/web; ruční volba a automatika pouze nových nahrávek. |
| A1 – přihlášení a scope | Sol auth | — | Finder default, staré session, invalid_client bez reuse refresh tokenu. |
| R1 – limity fronty | Sol fronta | T2 | 429 neubírá pokus a zastaví celou pumpu podle Retry-After. |
| T6 – vydání a aktualizace | Sol vydání | — pro přípravu; T5+A1+R1 pro release | Validace balíčků, SCP s feedem posledním, informace v UI, postup reálného update. |
| M1 – přejímka a masterplán | Astra | všechny implementace | Review diffu, gates, gates:clean, evidence, push a PR, aktuální přehled. |

Implementační soubory každého workera jsou vymezeny v jeho předání. `main.cjs`, `preload.cjs`, `Settings.jsx` a `styles.css` se integrují postupně; nikdy dva zapisovatelé v jednom stromu. T0/T1/T2 mají přednost před dashboardem. Auth a vydání jsou nezávislé větve.

## Ověření a dodání

Koordinátor znovu spustí relevantní testy nad převzatým diffem. Před PR běží `npm run gates` a `npm run gates:clean`, výpisy včetně exit kódu zůstávají v `dukazy/`. Neoslabovat existující měřidla. Nové chování musí mít doloženou regresní sabotáž.

Žádné `ui-smoke` ani `audio-smoke` v agentním běhu. Dan dostane krátký postup pro skutečný Mac. Nová verze se nevydává tagem od agenta. Do ověření na Macu se stav drží nejvýše 🧪; nasazení je oddělené od existence kódu.
