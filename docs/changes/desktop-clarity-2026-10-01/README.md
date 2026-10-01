# Návrh čitelnějšího desktopu — 1. 10. 2026

Samostatná klikací maketa v `design/index.html`. Není nasazená a nemění produkční aplikaci. Čeká na reakci Dana. Všechny záznamy, jména, firmy a výsledky akcí jsou fiktivní; návrh nemá síťové ani zvukové napojení.

## Zjištěné vady

Danův screenshot 0.1.7 ukázal dvojitý rám, příliš malé písmo, vysokou hustotu textu a historii bez hledání a výběru období.

## Zvolený koncept

Jediné okno s maketovou reprezentací nativního titlebaru, systémové písmo, základ 15 px a názvy schůzek 16 px. Klidné šedé plochy a LuDone zelená pouze u hlavních akcí a potvrzeného simulovaného stavu. Navigace Teď / Můj den / Nastavení.

Historie začíná dneškem, nabízí posun data, 7 dní, měsíc, vše, výběr měsíce a skok o půl roku zpět. Hledání a stav filtrují skutečný ukázkový dataset od dubna do října 2026. Stránka má nejvýše 10 řádků a čítač výsledků. Detail rozlišuje místní kopii, přístup a stav odeslání. Akce jsou výslovně lokální simulace.

Teď simuluje start, stop a volbu uložení. Nastavení obsahuje fiktivního Alexe Nováka, explicitní uložení změněné firmy, automatické odesílání a zvukové volby. Firemní přístup ukazuje aktuální default; maketa nezavádí nový uložitelný globální default přístupu. Téma a rozměr 740 / 630 / 400 px se volí nad oknem.

## Stav a ověření

🟡 Návrh čeká na reakci Dana. Produkční kód není změněný; aktuální požadavek je nejdříve návrh ukázat.

🧪 Koordinátor proklikal samostatnou maketu v IAB: hledání a kombinace filtrů, skok do dubna, stránkování, prázdné stavy, detail, uložení firmy, přepínače, vzhled a simulované nahrávání. Měřil čitelnost a přetečení při maketové šířce 400 px. Výsledky, snímky a doslovná kontrola syntaxe jsou ve [verzovaném archivu](../../../dukazy/desktop-clarity-2026-10-01/KONTROLA.md), [galerie](../../../dukazy/desktop-clarity-2026-10-01/index.html).

⛔ Nejde o nativní ani produkční E2E přejímku, skutečný zvuk nebo server. Nasazení ani vydání neproběhlo. Schválené bezpečnostní podmínky a stávající testové brány zůstávají beze změny.

## Prohlížení

`design/index.html` lze otevřít samostatně, bez instalace a závislostí. Během předání slouží také místní náhled na `http://127.0.0.1:53301/index.html`. Vnější ovládání mění téma a ukázkovou šířku; volba Vzhled funguje i v Nastavení. Akce pracují pouze v paměti makety a obnovení stránky je vrátí. Výběr měsíce je pro ukázková data roku 2026.
