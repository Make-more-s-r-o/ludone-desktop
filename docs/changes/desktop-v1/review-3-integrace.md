# Třetí review: sloučený `main` — 2. 9. 2026

**Rozsah:** 5 nezávislých hledačů + 12 skeptiků (2 na každý vážný nález) nad `main` poté,
co se v něm poprvé potkaly obě linie stories.

**Výsledek: 16 nálezů, 10 postoupilo k ověření, 1 POTVRZEN oběma skeptiky, 9 vyvráceno.**

🔴 **Oprava dřívějšího zápisu:** tenhle dokument nejdřív tvrdil „0 potvrzených". Bylo to
napsané z rozečteného journalu ve chvíli, kdy doběhlo devět verdiktů — všechny vyvracející.
Běh pokračoval a desátý nález oběma skeptikům **obstál**. Závěr o „nula potvrzených" byl
tedy předčasný, ne chybný v měření: chyběla mu polovina dat.

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

---

## Potvrzený nález: brána, která hlídala prázdný adresář

**`tests/logout.test.js:449` — „odhlášení nesmaže nic jiného" měřilo cestu, kterou produkce
nepoužívá.** Opraveno v PR #13.

B9 psala tu bránu v době, kdy fronta ani časovač na disku neexistovaly, a položila atrapy pod
`<appData>/cz.ludone.desktop/{queue,nahravky}`. B5 a B7 pak uložily skutečná data pod
`app.getPath("userData")` — kvůli `app.setName("LuDone Desktop")` je to **sourozenecký strom**,
ne potomek. Snímek procházel jen `cz.ludone.desktop`, takže do produkčních dat neviděl.

**Proč to není akademické:** `sekce-navrhy/journeys-ia.md:142` má v návrhu Nastavení připravenou
položku „Odhlásit a smazat moje data před odinstalací" — tedy přesně tu story, která by ten
úklid do odhlašovací cesty přidala. Bez opravy by smazání fronty, naměřeného času i všech
nahrávek prošlo **všemi branami zeleně**.

🔴 **Oba skeptici nález nejen potvrdili, ale ZESÍLILI.** Předkladatelova sabotáž byla
vykonstruovaná (počítala cestu přes dvojité `path.dirname`); skeptici ji nahradili dvěma
běžnými implementacemi ve stylu tohohle repa a obě prošly zeleně. Adversariální kolo tu
posloužilo jako zlepšovák důkazu, ne jen jako filtr.

## Chyba v mém postupu, která málem nechala bránu slepou

První kolo sabotáží jsem vložil do **jiné funkce** (`auth.cjs:503`), než jakou test spouští
(`:789`). Test zčervenal — jenže padal na **lexikální bráně**, protože moje sabotáž obsahovala
slovo `queue`. Vypadalo to jako doklad, že opravená brána funguje.

⇒ **„Něco padá" není doklad. Doklad je „padá TENHLE test a z TOHOTO důvodu".** Kdybych se
spokojil s prvním výsledkem, zůstala by brána slepá a měl bych na to zelený papír.

## Čtvrtá próza za jeden běh

Brána „auth modul o frontě neví" se chytala i **komentářů** — falešná červená, která nutí
přeformulovat poznámku místo opravy kódu. Stejná léčba jako u předchozích tří: odstranit
celořádkové komentáře, a jen je.
