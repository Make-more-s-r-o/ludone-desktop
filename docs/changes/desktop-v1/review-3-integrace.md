# Třetí review: sloučený `main` — 2. 9. 2026

**Rozsah:** 5 nezávislých hledačů + 12 skeptiků (2 na každý vážný nález) nad `main` poté,
co se v něm poprvé potkaly obě linie stories.

**Výsledek: 16 nálezů, 0 potvrzených.** Všech devět ověřovaných nálezů skeptici vyvrátili.

🔴 **A přesto je tohle nejcennější review z celého projektu** — protože důvod vyvrácení je
sám o sobě nález.

## Proč se to všechno vyvrátilo

Pět hledačů se **nezávisle na sobě** sešlo na téže trojici mechanismů kolem odhlášení za běhu.
Skeptici je nevyvrátili jako smyšlené — potvrdili, že mechanismy platí, a pak změřili, že je
dnes **nemá co spustit**:

```
grep -rn "logout" src/ scripts/                            →  0
grep -rn "startTracking|stopTracking|switchTracking" src/  →  0
```

Most v `electron/preload.cjs` obojí vystavuje (`:10`, `:19–24`), ale žádná komponenta to nevolá.
**Ověřeno mým vlastním měřením**, ne převzato od agentů.

## Tři latentní vady

| # | mechanismus | důsledek, až se to zapojí |
|---|---|---|
| 1 | `auth:logout` nesahá na časovač | naměřené minuty **zdědí další přihlášený** — money cesta |
| 2 | `deriveTrayState` dává `signed-out` přednost před `recording` | zhasne **jediný indikátor běžícího mikrofonu**, nahrávka běží dál |
| 3 | `applyReportedFacts` přiřazuje `signedIn` bez podmínky | první překreslení panelu **tiše vzkřísí odhlášenou session** |

Trojka je nejzávažnější: **tiché zrušení bezpečnostní akce**.

⚠️ Skeptici u dvojky správně namítli, že priorita „nepřihlášeno přebíjí nahrávání" je
**předepsané chování B3** (packet `B3-tray-autorita.md:597`, `specs/E3-vady-a-identita.md:48`),
ne důsledek slučování. To je pravda — a nemění to nic na tom, že v kombinaci s odhlášením za
běhu ta priorita zhasne indikátor nad živým mikrofonem. **Rozhodnutí, jestli je to v pořádku,
patří Danovi**, ne běhu; zapsáno v `DAN-TODO.md`.

## Co s tím běh udělal

Ne poznámku „až se to zapojí, nezapomeň", ale **kontrolu, která nemůže zestárnout** —
`tests/zapojeni-odhlaseni.test.js` (PR #12). Dokud volající neexistuje, je zelená a v běžném
výpisu je vidět, že nic neměří; jakmile se objeví, zčervená a pojmenuje, co dopsat.

**Ověřeno simulací příchodu volajícího**, ne slibem: dočasné `window.ludone.logout()`
v `src/App.jsx` probudilo všechny tři. Trojka je doložená **chováním** — vyříznutá produkční
`applyReportedFacts` odhlášenou session opravdu vzkřísí.

## Co si z toho odnést o adversariálním review

- **Vyvrácený nález není bezcenný.** Devět vyvrácení mělo společný kořen a ten kořen je
  vážnější než kterýkoli z nálezů zvlášť. Kdo počítá jen potvrzené, tohle přehlédne.
- **„Nedosažitelné dnes" není totéž co „není vada".** Je to vada s odloženou splatností —
  a splatnost nastane bez varování, jakmile někdo přidá tlačítko.
- **Skeptikům se nevěří na slovo o faktech.** Klíčové tvrzení („nula volajících") jsem
  přeměřil sám; teprve pak jsem na něm stavěl.
- Jeden agent nahlásil **provozní nález**: v pracovním stromu souběžně mutoval jiný agent.
  Sdílený strom je pro sabotážní kolo špatné místo — platí i pro recenzenty, nejen pro Codex.
