---
kind: review
ref: c21eca6811b71ea42de32bc982acb20bc4552f7b
verdict: partial
measuredAt: 2026-09-14T22:43:00Z
scope: [T-05, CI]
measuredFrom: [GitHub Actions 34904595978, místní test karty v UTC a Europe/Prague]
---

# Opravy po prvním CI T5

⚠️ Run [34904595978](https://github.com/Make-more-s-r-o/ludone-desktop/actions/runs/34904595978)
na `c21eca6` selhal: 6 FAIL, 1482 PASS a tři původní skipy. Doslovný log a metadata
jsou ve vedlejších souborech. Místní plná brána 1488 PASS tento výsledek nenahrazuje.

Pět selhání má stejnou příčinu: nová přesná aserce názvu čekala místních 14:00,
ale fixture nesla pevné 12:00 UTC, což v pražském pásmu odpovídá 14:00 a na CI 12:00.
Fixture nyní vyrábí ISO okamžik pro místní 14:00. Produkční formátování zůstává
beze změny a očekávaný název stále přesně `2. září 2026, 14:00`; žádná aserce,
skip ani brána nebyly odstraněny. 🧪 Samostatně 59 PASS v UTC a 59 PASS v Europe/Prague,
oba příkazy exit 0; úplné výstupy jsou v `recording-card-*.log`.

Šesté selhání je `ENOTEMPTY` při úklidu dočasné fronty v killswitch testu
`tests/queue-wiring.test.js`. Tento soubor vlastní právě probíhající T-A4;
koordinátor předal skutečný log a požadavek na řádné dokončení async lifecycle.
Oprava a nové CI zatím čekají. Není přidané potlačení chyby ani opakování úklidu.

## Proč to není chyba měřidla

Původní časová fixture závisela na časovém pásmu hostitele, zatímco produkt záměrně
používá čas uživatele. Změnil se vstup testu, nikoli očekávaný text nebo produkční
chování. Běhy v obou pásmech ověřují stejnou přesnou aserci. Druhá chyba zatím
zůstává otevřená a žádný zelený dílčí test se nevydává za zelené celé CI.
