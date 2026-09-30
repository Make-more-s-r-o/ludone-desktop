# Bezpečnostní review T-12

30.9.2026, nezávislý read-only reviewer Astra; první diff proti8fa0138,
opravy v6db8ea6 a420bd0e. Koordinátor přečetl výsledný diff a zopakoval619 testů.

| Nález | Riziko a oprava | Důkaz uzavření |
|---|---|---|
| P1 retry přebíjí výslovnou firmu | Po403 pro firmuA a defaultB se pin přepsal naB. Store i čistý rebind nyní odmítají takovou implicitní změnu; oprava vyžaduje čerstvou explicitní volbu konkrétní nahrávky. | Regrese skutečného retry/pinu, RED1FAIL před opravou, GREEN; druhé review původníP1 uzavřelo. |
| P2 změna guardu před zápisem | Posloupnost guardu true→false ukládala held preference. Nově celá operace před prvním zápisem odmítne bez změny disku; pokud guard zanikne až po bezpečném held commitu, zůstane held a nikdy approved. | Obě posloupnosti guardu, RED1FAIL před opravou, GREEN; druhé review původníP2 uzavřelo. |
| P2 starší ID v opravě403 | Normalizátor zahazoval legacyRecordingId a helper tím odemykal existující serverovou vazbu. Konzervativní predikát čte původní ID/progress včetně legacyRecordingId, všech stop a mapy bajtů. | Šest regresí skutečného configure odmítne a zachová disk byte-for-byte. RED2FAIL před opravou, GREEN619; třetí review potvrdilo repair=false/locked=true a žádné dalšíP1/P2 v delta diffu. |

Úspěšné preload→main→store průchody save/configure, změna identity či senderu během
čekání na nabídku a stale queue/fileCAS mají skutečné unit integrační regrese.
Nabídka a síť v nich zůstávají simulované. ⛔ Skutečný upload se tím nedokládá.


# UI, finální snímky a měřidlo

Nezávislý Sol low review T-13 odhalil P2: locked picker hlásil dirty a blokoval legitimní retry. Nyní uzamčené, nezměněné volby hlásí čistý stav; změna identity zůstává zneplatněná. RED mutant selhal a GREEN172 testů prošlo. Retry znovuotevřeného zamčeného detailu předává původní CAS, bez nové company nabídky nebo configure. Samostatné review přesného IPC inventáře přijalo jen dva povolené D9 kanály, bez obecné výjimky.

Nezávislý Sol review main E2E screenshotů a focus/filtr synchronizace potvrdil, že čekání míří na stejné původní podmínky; nepřepisuje produkční refresh ani bezpečnostní testy. P3 patička slibující automatické ukládání a kontrast počtu aktivního filtru byly opravené.

Finální read-only review zdroje2bf1da4 a zachycených snímků design-final: žádné zbývajícíP1/P2. OběP3 uzavřené. Kompaktní save formulář ve400px zachovává název, oba selecty, vysvětlení a obě akce v obraze. Zakázané odeslání má konkrétní důvod a Nechat na Macu je dostupné. Časové značky jsou celé a zarovnané. Nastavení/detail ve světlém i tmavém tématu mají čitelnou hierarchii; výpadek zvuku odlišuje funkční mikrofon od chybějící druhé strany. Reviewer hodnotil snímky a úzký diff, sám nespouštěl E2E, fyzický zvuk ani produkční upload.
