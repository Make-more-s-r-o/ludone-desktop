# LuDone Desktop — druhé kolo: celá zkušenost práce a schůzek

## Pro koho a jaký výsledek
Dan chce aplikaci pro Mac, kterou bude chtít denně používat. V prvním kole dostal dva návrhy zaměřené na nahrávky a zvlášť demo LuTracku. Nyní výslovně žádá **jeden promyšlený celek LuTrack + Nahrávky**. Ne přilepit dvě karty k sobě. Navrhni svůj osobitý mentální model, hierarchii a plynulý pracovní den. Buď kreativní a produktově odvážný: současná kompozice, rozměry, rozdělení záložek ani první návrhy nejsou závazné. Některé budoucí funkce ještě nejsou definované. Navrhni užitečné možnosti a vysvětli, co doporučuješ udělat první.

Výsledek je dotažený klikací HTML prototyp **macOS aplikace**, vizuální identita (Dock/menu bar), mapa cest a stručné zdůvodnění. HTML je médium pro porovnání; nesmí to vypadat jako SaaS dashboard nebo velký web nalepený do okna. Oba autoři dostávají přesně totožné zadání, fiktivní data a podklady. Pracují nezávisle. Nečti variantu druhého autora ani obě varianty z prvního kola; můžeš číst historické společné podklady níže. Dodej jeden silný celkový směr. V poznámkách stručně popiš ještě dvě možné alternativy, které jsi zvažoval; není potřeba vyrábět tři celé aplikace.

## Nové pozorování: současný živý LuTrack
Koordinátor dne 23. 9. 2026 četl otevřenou PWA LuDone a Danův přiložený screenshot. Skutečný současný LuTrack je na **https://ludone.cz/time-tracking**, nikoli rozpracovaná placeholder stránka v novém app.ludone.cz. To opravuje příliš široký závěr předchozího auditu. Desktopová integrace přesto ještě hotová není; přítomnost webového UI není důkaz známého API.

Pozorované ovládání (jen read-only, nic se nezastavovalo, nevykazovalo ani neměnilo):
- Časovač / Přehled / Management / Admin jako hlavní webové oblasti.
- Aktivní záznam: vybraný projekt, uběhlý čas, zbývající alokace, změna popisu, „Nová“, přepnutí na jiný projekt a „Zastavit“.
- Dnešní záznamy: aktivní i ukončené úseky, časy od–do, délka, přidat záznam, upravit a smazat.
- Přehled: týdenní zobrazení jako seznam/timeline, souhrny, rozdělení podle projektů, alokace, podrobná tabulka, export a uzavření týdne.
- Současná PWA má výrazné velké karty, modré pozadí, barevná primární tlačítka. To není cílový vizuální vzor; přebíráme úkoly člověka, ne starý vzhled.
Používej jen níže uvedená fiktivní data. Skutečné názvy firem/projektů, osobní výkazy a screenshot do prototypu nebo důkazů nekopíruj. Neproklikávej živou PWA ani produkci; potřebné poznatky dostali oba stejně.

## Produktový záměr — rychlý každodenní společník
Desktop vlastní **teď a tady**: začít práci, vědět co běží, snadno přepnout projekt, začít schůzku, neztratit její záznam, pochopit stav odeslání a vrátit se k práci. Web vlastní podrobnosti, tým a správu. Zkus člověku ušetřit rozhodování a opakované vyplňování, nikoli jen kliky za cenu překvapení.

Navrhni, jak spolu souvisejí projekt, popis práce, schůzka a nahrávka. Uživatel může:
- pouze měřit čas;
- pouze nahrávat (i bez projektu);
- dělat obojí současně;
- nahrávání ukončit a dál pracovat;
- čas zastavit a nechat nahrávání běžet.
**Dvě nezávislé činnosti jsou tvrdý invariant.** Volitelnou výslovnou akci typu „Zahájit schůzku“ nebo „Ukončit oboje“ můžeš navrhnout, ale její důsledky musí být předem jasné. Nahrávání nikdy nesmí nepozorovaně založit vykázaný čas. Při změně projektu nesmí již pořízený zvuk zmizet nebo se automaticky odeslat do jiné firmy. Projekt LuTracku a cílová firma nahrávky nejsou jedno pole; můžeš doporučit kontext, ale uživatel vidí a ovládá případný rozdíl.

Dovol si vlastní uspořádání (společný přehled, kontextový panel, jemné záložky, rozbalený detail…). Nenuť obě funkce vždy soutěžit dvěma stejně velkými kartami. Jeden hlavní úkol v konkrétním stavu; souběh musí zůstat přehledný. Žádné zbytečné přepínání do Nastavení při běžné práci. Můžeš přidat 2–3 promyšlené UX nápady, např. poslední projekty, pokračování poslední práce, klávesové rychlé akce nebo souvislost schůzky s prací. Každý nový nápad musí řešit konkrétní potřebu, mít funkční místní odezvu nebo jasně být výhled v poznámkách.

## Co musí zůstat dosažitelné
### LuTrack — budoucí integrovaný zážitek, nikoli dnešní demo karta
- Výběr/hledání projektu z přidělených možností, krátký popis, Start; běžící čas, změna práce/projektu, Stop.
- Malý přehled dnešních posledních položek a návrat k poslední práci. Rozhodni, zda rychlé opravení zapomenutého času patří do desktopu, nebo jednoznačně odkáže na web; vysvětli tradeoff.
- Přesné stavy: běží místně / čeká na synchronizaci / potvrzeno serverem / vyžaduje zásah. Místní měření není automaticky schválený výkaz. V prototypu server pouze simuluješ.
- Ztráta sítě a obnova po restartu: nabídni konkrétní srozumitelné rozhodnutí, žádné tiché vykázání celé noci. Pokud navrhneš detekci nečinnosti, označ ji v matici jako nový nápad.
- Alokace může být nenápadná kontextová informace. Nevnucuj finanční dashboard. Nespecifikuj vlastní pravidla mezd, sazeb, schvalování nebo nových alokací.
### Nahrávky — zachovat dnešní schopnosti
- Mikrofon + systémový zvuk, jedna schůzka → jeden stereo soubor na serveru. Běžného uživatele netrap kodekem či interními ID.
- Start, délka, srozumitelná připravenost zdrojů, chyba/ztráta zdroje s dalším krokem, bezpečné ukončení a uložení.
- Název po stopu, cílová firma, „Uložit a odeslat“ / „Nechat na Macu“. Volitelná automatika pouze pro nové nahrávky. Výběr firmy nikdy sám neodešle staré položky.
- Lokální přehled a detail: Uloženo na Macu / Ve frontě / Odesláno / Ověřeno v LuDone jsou různé skutečnosti. Retry, obnova přihlášení, limit serveru, vlastnictví a bezpečné konkrétní potvrzení koše musí mít dosažitelnou cestu. Přepis, analýza a týmový archiv se otevírají na webu.
- Akce: obnovit přehled, odeslat, zkusit znovu, ověřit, otevřít v LuDone, ukázat ve Finderu, přesunout do koše, výslovně převzít vlastníka. V prototypu bez reálných efektů.
### Celek a macOS
- Menu bar: neaktivní / čas / zvuk / obojí / vyžaduje pozornost. Čitelná 18px monochromatická stavová ikona, tvar + případný čas, ne jen barva. Ukázka světlé/tmavé lišty i ikona v Docku/Finderu v 16/32/64/128 px. Vycházej ze značky LuDone (existující pulz), není potřeba vytvářet novou značku.
- Rychlý panel + případné normální okno pro den/detail/nastavení. Rozhodni, kdy co otevřít, jak se vrátit, co zůstane běžet při zavření panelu. Nepředstírej, že HTML opravdu ovládá Dock nebo systémová oprávnění.
- Přihlášení, cílová firma, zdroje/opravení oprávnění, retence lokálních kopií, volitelná automatika, spuštění při přihlášení, Dock, export diagnostiky.
- Aktualizace: proužek s přínosem, jednorázová macOS notifikace v návrhu, kontrola, Aktualizovat/Později. Nikdy nepřerušit běžící čas, nahrávání nebo ukládání. Restart aktualizace až po výslovné akci a skončení obou činností.
- První použití má rychle dovést k hodnotě. Stačí realistický onboarding/login/permissions scénář; ne deset prázdných obrazovek.

## Co má zůstat na webu a jak budoucnost nerozbije panel
Management, admin, přidělování projektů/alokací, finanční výpočty, výkazy a jejich schvalování, uzávěrka týdne, exporty, hluboké statistiky, přepisy, analýza a týmový archiv zůstávají na webu. Desktopové rychlé odkazy musí mít srozumitelný cíl a důvod. Nenavrátit zrušený kalendář, připomínky schůzek ani AI chat jako údajně požadované funkce.

Ukaž **jeden věrohodný bod rozšíření** pro budoucí funkci (např. rychlá akce/detail kontextu), bez dutého sidebaru s šesti „Již brzy“. V NOTES napiš pravidlo, podle kterého poznáme, co do desktopu přidat a co dát na web. Pro odvážnější nápady rozliš Nyní / Další etapa / Pouze nápad. Nesměšuj dnešní kód, návrh budoucího chování a již schválenou implementaci.

## Vizuální základ a inspirace
LuDone DS: Brockmann nadpisy, Public Sans UI, tři témata light/professional/dark, sémantické barvy, kompaktní geometrie. Vnitřní velké plochy radius 0, ovladače 2px, drobnosti do 4px; vnější macOS okno může mít nativní zaoblení. Vyvážená typografie, střídmá dělení, barva jen pro význam. Žádný automatický SaaS sidebar, hero dashboard, gradientové karty, dekorativní grafy, emoji místo ikon nebo galerie povinných placeholderů. Povolená kreativita je ve vztazích, kompozici, toku a interakci; značka má zůstat LuDone. Prototyp je DS-inspired, nikoli canonical React komponenty.

Společné podklady ke čtení:
- /Users/dan/.agents/skills/ludone-design-system/SKILL.md a jeho relevantní reference.
- /Users/dan/Dev/ClaudeCode/LuDone/ludone-app/docs/agent/design-system-rules.md, docs/design-system/design.md, inventory.md, src/app/globals.css (read-only).
- /Users/dan/Dev/ClaudeCode/ludone-desktop/design/zadani/dan-vstup-2026-09-01.md a design/navrh/nahled.html, Main.dc.html, Lista.dc.html (historie, neměnit).
- Typologie inspirace: Plaud — rychlé zachycení; Raycast — kompaktní utilita/klávesnice; Linear — hierarchie; Toggl Track/Timing — kontinuita práce; Apple HIG — menu bar a okna. Nekopíruj cizí produkt ani jeho povinné funkce. Pokud použiješ externí stránku, uveď v NOTES skutečně navštívený zdroj; neztrácej čas rozsáhlým researchem.
Koordinátor poskytuje sdílené lokální fonty a tokens.css. Můžeš je kopírovat do vlastní assets/. Brockmann je pouze lokální podklad, ne publikovatelná licence. Logo/ikonografie přes SVG; imagegen není nutný, nesmí nahradit klikací UI.

## Stejný scénář dne a data
Fiktivní Alex Novák. Firmy Studio Sever a Ateliér Jih. Projekty: „Web Studia Sever“, „Interní rozvoj“, „Podpora Ateliéru Jih“. Náplň práce „Příprava obsahu“. Při aktivním měření běží 32 minut, dnes již dokončeno 1h 25m. Ukázková zbývající alokace projektu 18h 40m (pokud ji použiješ).
Schůzka „Týdenní domluva“ trvá 12:34, 9,2 MB, cílová firma Studio Sever; jedna nahrávka. Další místní „Návrh webu“ 6:08/4,5 MB; „Kontrola rozpočtu“ 8:42/6,4 MB čeká na obnovení přihlášení. Fiktivní aktualizace 0.1.5 z nainstalované 0.1.4; přínos „Práce a schůzky na jednom místě“. Žádná skutečná data nebo API požadavky.

## Povinné klikací cesty (nejen galerie screenshotů)
1. Ráno otevřu aplikaci, vyberu projekt a popis, spustím práci. Zavřu/otevřu simulovaný panel: v menu baru vidím běh a stav se neztratí.
2. Přichází schůzka: během práce spustím nahrávání; obě činnosti jasně běží. Zastavím pouze zvuk, pojmenuji a odešlu; měření práce pokračuje. Poté zastavím čas, vidím oba výsledky a další krok.
3. Ad hoc nahrávka bez projektu i bez časovače; uložit pouze na Macu. Žádný falešný výkaz.
4. Během práce přepnu projekt; předchozí úsek je zachován s popisem, nový běží. Během nahrávání je dopad změny na nahrávku vysvětlený a cílová firma se tiše nepřepne.
5. Chybějící firma/přihlášení: oprava přímo z místa úkonu, jasně oddělené potvrzení odeslání.
6. Síť vypadne při souběhu; práce i zvuk se místně zachovají, fronta má další krok. Po obnovení je rozpoznatelný rozdíl mezi místním uložením a potvrzeným serverovým výsledkem.
7. Návrat po restartu: rozhodnutí o rozpracovaném čase a čekajících nahrávkách; žádné tiché automatické vykázání.
8. Dnešní krátký souhrn a detail propojené práce/schůzky; smysluplný přechod na web, bezpečné lokální souborové akce.
9. Aktualizace při souběhu: odložit nebo připravit; instalace čeká na obě činnosti a uložení, jejich ukončení samo o sobě neinstaluje nic bez dřívějšího výslovného souhlasu.
10. Nastavení / první použití / identita celé Mac aplikace, společný vizuální systém ve všech tématech.

## Technický kontrakt pro porovnání
Piš pouze do `docs/changes/desktop-redesign-2026-09-23/round2/variants/TVUJ_SLUG/` ve svém izolovaném worktree. Neměň src/, electron/, testy, brány, package.json, backend, LuTrack zdroje ani cizí design/. Žádné commity/push/PR/release, instalace balíčků nebo skutečné side effecty. Žádní další agenti. Čisté HTML/CSS/JS, lokální assets, žádné CDN/API/fetch skutečných služeb. Soubory index.html, styles.css, app.js, NOTES.md, evidence/.

Návrh musí mít jeden souvislý stavový model. Primární tlačítka fungují; žádné tlačítko „jen na ukázku“, které bez odezvy nedělá nic. Na web/Finder navrhni věrohodné lokální předání s konkrétním cílem, ale nevykonávej ho.

Přímé scénáře přes `?scenario=home&theme=light`:
`home`, `working`, `meeting`, `save`, `record-only`, `day`, `detail`, `attention`, `offline`, `recovery`, `settings`, `update`, `onboarding`, `identity`.
Scénář není omezení vlastní navigace, slouží jako stejný checkpoint pro oba autory. Vlastní pohledy jsou dovolené. `meeting` = čas i zvuk, `save` = zastavený zvuk/čas stále běží, `attention` = chybějící firma + cesta chyby/retry, `offline` = oba běží/síť není, `recovery` = nejistý čas po restartu, `update` = nabízená aktualizace při souběhu. Při změně scénáře v přepínači obnov stejná vstupní data. Při běžném prokliku je naopak zachovávej, ať cesta navazuje.

Prototypová stránka uvnitř iframe obsahuje app viewport (může zahrnout krátký simulovaný menu bar), bez vnější galerie/prezentačního záhlaví. Porovnání a velké přepínače dodá koordinátor. Uvnitř stačí decentní „Návrh · simulace“, nikoli varování v každé kartě, které přehluší budoucí produktový zážitek.

Tři témata. Výchozí panel zvol sám v rozsahu **360–420 px**, maximální výška 720 px; doporučený rozšířený pohled/normální okno **480–720 px × nejvýš 760 px**. Umísti k hlavním akcím viditelný focus a přístupné názvy. Žádný horizontální overflow ve vlastní doporučené velikosti; dlouhý obsah scrolluje uvnitř. Vnější macOS ovladače odliš od vnitřních karet. Dodrž proporce malého nástroje, nevyráběj fullscreen dashboard.

`document.documentElement.dataset.scenario` a `.dataset.theme`. Přijímej od parentu `{type:'ludone-experience:set',scenario,theme}` jen když `event.source===window.parent` a validní whitelist. Při renderu/navigaci oznam `{type:'ludone-experience:state',scenario,theme,view,width,height}` parentu (same origin); width/height integer v uvedených mezích. Koordinátor mění rozměr rámu podle zprávy. Přidej `manifest.json` se jménem konceptu, doporučenou panelWidth/panelHeight/windowWidth/windowHeight, vlastním slugem a krátkou tezí. Název modelu nesmí přebít název konceptu uvnitř aplikace.

## Poznámky a ověření
NOTES.md: nosná myšlenka (do 150 slov), 3 skutečné produktové nápady a důvod, mapa dne, hranice desktop/web, současná funkce vs. navržená, 2 alternativy které jsi zvažoval, pravidlo pro budoucí rozšiřování, mapa všech dosavadních akcí na nové místo, implementační etapy S/M/L a závislosti (API neurčuj odhadem), skutečně použité inspirace.

Ověř lokálně syntax, všech 14 přímých scénářů a témata, povinné souvislé cesty. Ulož stručný doslovný výsledek a realistické screenshoty (ne všechny kombinace, stačí home/meeting/save/day a dark). Když browser nemáš, napiš omezení; nesnaž se připojovat k živému účtu/PWA. Testy/simulace nejsou důkaz produkční funkce. Celý výstup je návrh, ne nově vydaná funkce.

Kritéria: 40 % souvislý každodenní zážitek a pochopitelné vazby; 25 % výtvarná kvalita/klid/identita; 20 % jasné souběhy, chyby a obnova; 10 % smysluplné vymezení desktopu; 5 % proveditelnost a rozšiřování. Nepiš marketing ani předstírané uživatelské testy. Dodej celý klikací návrh, ne pouze plán.
