# Porovnání návrhů LuDone Desktop

Stav: hotové dva nezávislé HTML návrhy podle [stejného zadání](SHARED-BRIEF.md). Jde pouze o vizuální prototypy s fiktivními daty; ne o schválený vzhled ani vydání.

Základ: 0.1.4 / main 2f142b3. Požadavek Dana z 23. 9. otevírá designové kolo po dokončení funkčního rozsahu. Původní design/ zůstává nedotčený. Astra a Claude Opus 5.5 dostali totožné scénáře a podklady; autoři neuvidí výstup druhého před dokončením.

Po zhodnocení a volbě se připraví samostatná implementace. Tento běh nic nenasazuje. Přímý přístup Claude Design při přípravě vracel 403; Claude Code je přihlášený. Volba nástroje se zaznamená u skutečného výstupu.

## Co patří do další verze

Doporučený následující krok je UX nahrávání a odesílání podle vybraného návrhu: viditelná cílová firma, přímé řešení blokace, srozumitelný stav lokálního uložení/fronty/serverového ověření, klidný panel a použitelný přehled v Nastavení. Nový backend není v tomto rozsahu.

Základní funkční rozsah nahrávek T0–T6 a společný stereo soubor NRD-09 jsou implementované a 0.1.4 vydaná. Dan v této konverzaci potvrdil aktualizaci; read-only kontrola instalace a podpisu prošla. Krátká uživatelská nahrávka vytvořila jeden stereo WebM/Opus, ale při kontrole čekala na výběr firmy. Úspěšný upload a společný přepis této verze proto tento designový běh nevydává za ověřené.

Samostatná budoucí funkční etapa je skutečné zapojení desktopového UI LuTracku. V aktuálním TrackingCard je časovač výslovně ukázkový a projekty/ukládání nejsou zapojené. Návrhy to nesmějí maskovat. Kalendář byl zrušen, přepisy a týmový archiv zůstávají na webu.

## Jak se rozhoduje

Oba autoři mají stejné zadání a lokální fonty/tokeny, každý svůj pracovní strom. Dan výslovně vybral dva klikatelné HTML prototypy. První kolo je nezávislé. Koordinátor sjednotí pouze prezentaci a opraví objektivní nedostatky před porovnáním; nemíchá vizuální nápady mezi autory. Přesné modely a starty eviduje PROVENANCE.json.

Návrhy se nejdřív hodnotí anonymně jako A/B, autory lze odhalit. Hodnotí se každodenní použití 35 %, vizuální klid 25 %, jasnost stavů 20 %, LuDone identita 10 % a proveditelnost 10 %. Povinná funkce nesmí zmizet výměnou za hezčí screenshot. Volba návrhu ani tento prototyp nejsou schválením produkčního vydání.

## Doplnění macOS celku

Během tvorby Dan výslovně upřesnil ikonu, lištu, detail a historické inspirace. Oba autoři dostali stejné [doplnění](MAC-ADDENDUM.md). Porovnání zahrnuje deset scénářů včetně ikon v reálných malých velikostech a detailu nahrávky. HTML je médium návrhu macOS aplikace, nikoli návrh webu. Starší návrhy se pouze čtou; překonané funkce se do produktu nevracejí.

## Převzetí a návrat k porovnání

A = Claude Opus 5.5; B = Astra. Volbu zobrazuje tlačítko Odhalit autory. Otevři index.html nebo spusť místní server v této složce. focus.html umožní samostatné proklikávání ve skutečné šířce panelu/okna. Oba návrhy jsou převzaté po jednom kole objektivních oprav; původní estetika zůstala nezávislá. Důkazy jsou zachované také v dukazy/desktop-design-2026-09-23.

Dan následně autorizoval přípravu další verze a návrhu LuTracku. LuTrack proto vzniká jako oddělený budoucí pracovní tok, nikoli jako tvrzení, že současná aplikace ukládá čas na server. Design A/B zatím není vybraný a produkční změny nejsou v tomto běhu nasazené.
