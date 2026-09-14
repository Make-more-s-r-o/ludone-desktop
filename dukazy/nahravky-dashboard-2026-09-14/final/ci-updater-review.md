---
kind: review
ref: 42f922e4efafe5df852f09fc16f6700b28147630
verdict: partial
measuredAt: 2026-09-14T23:09:00Z
scope: [CI, bariéra aktualizace]
measuredFrom: [GitHub Actions 34907258323, nezávislé čtení runtime a testu rootem a Sol reviewerem]
---

CI skončilo 1504 PASS, 1 FAIL, tři původní skipy. Doslovný log a metadata jsou
v `34907258323-failed.log` a `34907258323.json`. Jediný pád je předčasná aserce
`quitAndInstall` v testu „čeká po finalizaci nahrávky na serializační bariéru fronty“.

## Proč to není chyba měřidla vydávaná za produktovou opravu

Test správně ponechá instalaci blokovanou do uvolnění enqueue. Po uložení se asynchronně
spustí kontrola bezpečného restartu, která ještě čte skutečný tracking store z disku
a potom čeká na serializační list fronty. Posun fake timers nedokončuje toto I/O.
Okamžitá aserce proto může vidět nulu volání, ačkoli rozběhnutý kontrolní Promise
po dokončení I/O správně restartuje. Root a nezávislý Sol reviewer došli ke stejné příčině.
V tomto testu `approved:false` navíc vůbec nespouští novou background upload pumpu.

Oprava mění pouze čekání na přesný pozitivní výsledek přes existující testovací
`vi.waitFor`. Zachována aserce **nula restartů před uvolněním** a **přesně jeden po
uvolnění**, žádná změna timeoutu, baseline nebo produkčního kódu. Stejný vzor již
používá sousední test bariéry. 🧪 Celých 270 queue-wiring testů v UTC prošlo, exit 0
(`updater-bariera-oprava.log`). Nový čistý klon nad `33938351` i GitHub CI `34907553077` prošly s 1505 PASS a buildem; předchozí neúspěch zůstává zachovaný.
