# Proč takhle — návrh Astra

6. září 2026 · Experiment k posouzení, nikoli změna schváleného návrhu nebo implementace.
[Otevřít náhled](nahled.html). Všechny údaje jsou ukázkové. Náhled má 34 stavů: 24 panelů/menu
a 10 stavů ikony, každý na světlém i tmavém pozadí.

## Tři věci jinak

**1. Stálé pořadí místo přeskupování podle aktivity.** Ve
[schváleném náhledu](../../../../design/navrh/nahled.html) se při samostatném měření přesune
LuTrack nad nahrávání. Já nechávám nahrávání nahoře a čas pod ním. Úzký pás drží oba stavy
i při pojmenování nebo otevření fronty. Měřáky stavím vedle sebe: mikrofon vlevo, systém
vpravo, stejně jako kanály exportu. Nezapojený zdroj nazývám „Nezapojen“, nikoli „ticho“.
**Zisk:** poloha pomáhá poznat agendu dřív než čtení; souběh nezmění význam tlačítka Stop.
**Cena:** opakuji stav a samostatný LuTrack je níž. Vypouštím denní souhrny, takže pro ně
člověk musí na web. Také nastavení dělím do čtyř částí v panelu 366 bodů místo vlastního
širšího okna: jednotný vstup za cenu více přechodů a menší plochy. Systémové písmo umožní
samostatný offline soubor, ale vzdaluje návrh písmům dnešního design systému.

**2. Místo neurčitého „hotovo“ pojmenuji místo dat.** Dnešní „Uložit a odeslat“ a patička
„Vše odesláno“ nepopisují ruční cestu z BD-N34. Navrhuji „Připravit pro web“ s vysvětlením
exportu do Stažených a výběru souboru v prohlížeči. Klikací patička „Na tomto Macu“ vede
do fronty, kde má nahrávka i čas vlastní důvod čekání. Vypnuté odesílání nemá odpočet
dalšího pokusu. LuTrack říká „Zkouška · jen na tomto Macu“ už před startem.
**Zisk:** člověk nezamění místní uložení za serverové přijetí nebo vykázanou práci.
**Cena:** omezení jsou v panelu stále vidět a ruční odeslání vyžaduje práci na webu.
Bez potvrzení přijetí zůstává položka čekající; nenabízím ruční prohlášení „odesláno“.

**3. Dvě tvarové pozice v liště a přístup nezávislý na ní.**
[Dnešní ikona](../../../../design/navrh/Lista.dc.html) používá hlavní barvu a odznak druhé
agendy. Navrhuji šablonovou dvojici: plný kruh vlevo pro nahrávání, hodiny vpravo pro čas.
Místo časových titulků má případné omezení samostatný odznak. Zvolený mikrofon označuje M,
nečekaný výpadek vykřičník. Záchranu přes Dock předkládám už ve třetím kroku onboardingu;
výchozí vypnutí Docku z M18 zachovávám. Zkratka a opětovné otevření přes Spotlight mají
ukázat tentýž panel u pravého horního okraje i bez viditelné ikony.
**Zisk:** obě agendy jsou čitelné bez barvy; plná lišta nemusí znamenat nedostupné ovládání.
**Cena:** klidový symbol je širší (32 bodů, s odznakem 43), přesný čas už z lišty nepřečtu
a nový význam symbolů se musím naučit. Zajištění přístupu přidává krok při prvním spuštění.

## Co jsem zvážila a zahodila

- **Záložky Nahrávání / LuTrack:** ušetří výšku, ale schovají druhý běh. Obě agendy proto
  nechávám viditelné, včetně vlastních tlačítek k zastavení.
- **Plovoucí ovladač stále na ploše:** obešel by výřez, ale zakrýval by práci a měnil
  aplikaci v trvalé okno. Volím vyvolatelný panel a druhý vstup přes Dock.
- **Barva jako hlavní stav lišty, blikání a rostoucí časové titulky:** cena v pozornosti,
  proměnlivém kontrastu a šířce. Barva zůstává podpůrná uvnitř panelu; měřáky v náhledu
  jsou záměrně statické, aby nepředstíraly snímání mikrofonu.
- **Automatické rozpoznání skryté ikony:** samotné souřadnice z podkladů neprokazují
  viditelnost. Návrh nečeká na domnělou detekci; cestu zpět ukazuje předem.

## Nejistoty, rozpory a potřebné ověření

**Doručení a retence:** [spec](../spec.md) §8 slibuje automatické doručení, ale §1/S1 a
[rozhodnutí](../decisions.md) BD-N34 určují vypnutý automat a ruční webovou cestu.
Kreslím výslovně druhou variantu. Chybí určení, jak se desktop dozví výsledek ručního
nahrání a tím získá oprávněný začátek sedmidenní retence. Také přesnou cílovou URL a formát
exportu zde neurčuji. Samotné otevření webu nesmí frontu vyprázdnit.

**LuTrack a účet:** C3/BD-N38 odkládají serverový čas, ačkoli spec zobrazuje celé vykazování.
Náhled je místní zkouška, neurčuje pravidla alokací ani budoucí smlouvu serveru. Kdo určí
vlastníka neodeslaných položek při změně účtu a co přesně má odhlášení udělat při souběhu?
Podklady tuto hranu neuzavírají. Přepnutí prostředí a odhlášení proto ukázka nesimuluje
jako úspěšný přenos dat. Sdílenému zařízení také nevymýšlím způsob přiřazení nahrávky.

**Lišta a rozměry:** spec §7 požaduje šablonovou ikonu, grafický podklad barvu.
Tady jde o přiznanou alternativu. Na Macu s výřezem je třeba otestovat zkratku, opětovné
otevření, polohu panelu, Dock i čitelnost odznaků při 1×/2×. Zadat Danovi krátce určit
aktivní agendy a zastavit pouze nahrávání. Změřit omyly a čas, i bez barev. Zkontrolovat
nejvyšší souběh na malé pracovní ploše; délka nabídky „Zastavit i čas?“ 10 s je návrh,
ne změřený práh. Při menší dostupné výšce bude potřeba ověřit rolování a dosažitelnost akcí.

**Stav ověření:** ⛔ vizuální vykreslení a skutečné chování na Macu neověřeno. Samostatný
Chromium odmítl systémový sandbox, prohlížeč Orcy hlásil `runtime_unavailable`. Kontrolu
zdrojového HTML a místních interakcí dokládá [OVERENI.txt](OVERENI.txt); ta nenahrazuje
vykreslení ani zvukovou zkoušku. Historické A12 o kalendáři je překonáno M15; kalendář
se do návrhu nevrací. Připomínky respektují odklad BD-N43.
