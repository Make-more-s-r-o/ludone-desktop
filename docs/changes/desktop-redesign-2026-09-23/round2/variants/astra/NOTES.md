# LuDone Desktop — Nit dne

Autor: gpt-6-astra, high · 23. 9. 2026 · nezávislé druhé kolo · DS-inspired HTML návrh.

## Nosná myšlenka

Práce je souvislý kontext, do kterého může vstoupit schůzka. Panel má jeden hlavní úkol: začít práci, sledovat nahrávání nebo dokončit uložení. Při schůzce dostane zvuk prostor; běžící práce se stáhne do výrazného, ale klidného kontextového pásu. Každá činnost má vlastní stop. Můj den ukáže úseky práce i místní nahrávky a jejich vazby. Není to kalendář ani týmový archiv: je to stopa toho, co na tomto Macu skutečně vzniklo. Projekt odpovídá na otázku „na čem pracuji“, firma nahrávky na otázku „komu zvuk posílám“. Vazba ušetří opakování, nenahrazuje souhlas. Aktuální značka LuDone spojuje lištu, panel i Dock; drobné tvarové odznaky rozlišují oba běhy bez závislosti na barvě.

## Otevření a ovládání

Otevřít `index.html`, případně `index.html?scenario=meeting&theme=dark`. Bez instalace, sítě, účtu a build kroku. Doporučený rychlý panel **400 × 700 px**, normální okno **640 × 744 px**, včetně simulované lišty. Vnitřní obsah scrolluje, záhlaví a navigace zůstávají dostupné.

- **Teď** otevírá panel. **Můj den**, detail a Nastavení normální okno; zpět přes Teď. Stav zůstává společný.
- Křížek a Escape skryjí panel; čas a nahrávání pokračují. Lišta jej otevře. Simulovaný Dock otevře den.
- **⌘K / Ctrl+K**: rychlé akce. Nativní HTML dialog drží focus; Escape zavře dialog a vrátí focus na spouštěč.
- **Návrh · simulace**: všech 14 scénářů, témata a řízené výpadky. Volba scénáře vždy resetuje data, běžná navigace je zachovává.
- Pro odeslanou frontu kliknout **Obnovit přehled** v dni nebo **Obnovit stav přenosu** v detailu. Potom **Ověřit v LuDone**. Tyto kroky záměrně zpřístupňují různá potvrzení simulovaného serveru.
- Všechny skutečné systémové a webové akce mají místní náhled konkrétního předání; neotevírají žádnou živou službu.

## Tři produktové nápady

| Nápad | Potřeba a konkrétní chování | Etapa |
|---|---|---|
| Kontextový pás práce | Při schůzce potřebuji hlídat oba běhy bez dvou soutěžících karet. Zvuk je hlavní plocha, práce úzký pás se svým časem, projektem, přepnutím a stopem. | Nyní v návrhu |
| Stopa dne a návrat k práci | Po schůzce chci rychle navázat. Dokončené úseky lze obnovit jako nový úsek se stejným projektem a popisem; záznam schůzky se zobrazí u původního kontextu. | Další etapa integrace LuTracku |
| Rozšíření přes rychlé akce | Nová drobná funkce nemusí být nová záložka. ⌘K → Připojit poznámku k práci uchová místní poznámku a ukáže ji v Mém dni. | Pouze nápad, funkční lokální ukázka |

Detekci nečinnosti nenavrhuji. Neznáme spolehlivé signály ani očekávání člověka. Obnova po restartu je výslovné rozhodnutí o posledním místním bodu, nikoli odhad práce přes noc.

## Mapa dne a povinných cest

| Cesta | Klikací průchod a výsledek |
|---|---|
| 1. Ráno | home → projekt (hledání v přidělené nabídce) → popis → Začít práci → křížek → ikona v liště. Běží stejný úsek. |
| 2. Schůzka při práci | working → Nahrát → Zastavit zvuk a uložit → název + firma → Uložit a odeslat. Čas pokračuje. Zastavit čas → Můj den → samostatné potvrzení času a přenosu. |
| 3. Jen zvuk | home → Nahrát → stop → Nechat na Macu. Bez časového úseku a bez projektové vazby. |
| 4. Jiná práce | meeting → Změnit → Podpora Ateliéru Jih + nový popis → Ukončit úsek a přepnout. Původní úsek zůstane; nahrávka si zachová původní vazbu i Studio Sever. Zastavit čas ponechá zvuk běžet. |
| 5. Chybí firma / účet | attention → Vybrat firmu → uložit bez odeslání → Zkusit znovu → konkrétní potvrzení. Kontrola rozpočtu → Obnovit přihlášení → samostatně Odeslat. |
| 6. Výpadek sítě | offline → stop zvuku → uložit do fronty → stop času → Návrh / Obnovit síť → den. Čas zůstává čekající, zvuk až po obnovení přehledu Odesláno, potom zvlášť Ověřeno. |
| 7. Restart | recovery → uložit jen posledních 32 minut nebo místní kontrola na webu. Žádný aktivní čas ani odeslání samovolně nevznikne. Restart z home či record-only nevymyslí chybějící čas. |
| 8. Den a soubory | Můj den → související Týdenní domluva → detail → přepis / Finder / konkrétní koš. Cizí vlastník je dosažitelný přes Návrh → Nahrávka: cizí vlastník. |
| 9. Aktualizace | update → Připravit → Teď → zastavit každou činnost → uložit → Zobrazit aktualizaci → Aktualizovat a restartovat. Příprava ani skončení činností není souhlas s restartem. |
| 10. První použití | onboarding → simulované přihlášení → dvě samostatná oprávnění → Přejít k práci. Nastavení + identita + tři témata jsou dostupné z navigace a patičky. |

Další dosažitelné situace: vypršení účtu během souběhu zachová Stop; ztráta zdroje ponechá záznam i viditelnou informaci o chybějící části; limit serveru nelze obejít retry před uplynutím; plné úložiště nabízí správu na webu, nikoli bezúčelné retry.

## Pravdivé stavy a bezpečné hranice

Čas: **běží místně → čeká na synchronizaci → potvrzeno serverem**. Potvrzení není schválení výkazu. **Vyžaduje zásah** rozlišuje lokální kontrolu po restartu a skutečné simulované odmítnutí serverem. Opravy historie, ruční doplnění zapomenutého času a odstranění časového záznamu patří na web; desktop nemá vytvářet druhý editor výkazů a jeho doménové validace.

Zvuk: **Uloženo na Macu → Ve frontě → Odesláno → Ověřeno v LuDone**. Kopie bez ověřeného serverového výsledku není kandidátem na retenční úklid. Koš vždy jmenuje konkrétní soubor, velikost, firmu a dopad; neověřená kopie má silnější upozornění. Převzetí vlastníka je konkrétní potvrzení s checkboxem; nezahájí upload.

Změna firmy již schválené čekající položky vrací nahrávku na **Uloženo na Macu**, tedy ruší původní souhlas s odesláním. Nový cíl musí člověk znovu potvrdit. Po odeslání už místní detail změnu cíle nenabízí. Přepnutí projektu neprovede ani tuto změnu firmy.

Automatika platí pouze pro nové nahrávky a snímá se při startu. Po jejich stopu zařadí nový soubor do fronty; název lze později upravit. Starší nahrávky ani změna výchozí firmy tím žádný souhlas nezískají. Při expirovaném přihlášení je odeslání blokované, místní Stop dostupný.

Aktualizace 0.1.5: jedna simulovaná notifikace na nabídku, proužek, příprava, odklad, závěrečný restart. Instalace zůstává nedostupná při čase, zvuku i nedokončeném ukládacím formuláři. Ani dřívější příprava neautorizuje budoucí restart.

## Desktop, web a rozšíření

Desktop vlastní krátký osobní vstup a jeho bezpečné dokončení. Web vlastní management, admin, přidělování projektů a alokací, výkazy a schvalování, finance, uzávěrku týdne, exporty, hluboké statistiky, přepisy, analýzu a týmový archiv. Předání vždy jmenuje cíl a důvod. Pozorovaná adresa současného LuTracku se používá pouze jako text cíle `ludone.cz/time-tracking`; žádný požadavek na ni neodchází. Pro nahrávky se nevymýšlí neznámá URL hlubokého odkazu; předání pojmenuje firmu a konkrétní nahrávku.

**Pravidlo rozšiřování:** do desktopu přidat pouze akci, kterou člověk potřebuje během práce na tomto Macu, vyřídí ji do jednoho krátkého rozhodnutí a její výpadek nebrání bezpečnému stopu. Nejdřív jako kontextovou akci v ⌘K/detailu. Pokud vyžaduje týmový rozsah, delší analýzu nebo správu pravidel, patří na web. Bez prázdných budoucích sekcí, kalendáře, připomínek a AI chatu.

## Mapa dosavadních akcí

| Dosavadní schopnost / úkol | Nové místo |
|---|---|
| Start práce, projekt, popis, zbývající alokace | Teď; alokace jako vedlejší text při měření |
| Přepnout projekt / nová práce, změnit popis | Změnit práci v kontextu; samostatná úprava popisu v běhu |
| Stop času, pokračování | Teď / kontextový pás / ⌘K; pokračování z dne a poslední položky |
| Dnešní úseky a délky od–do | Můj den → Vše / Práce |
| Přidat, opravit, smazat výkaz, přehled týdne, export, uzávěrka | Můj den → Otevřít výkaz (lokální náhled webového předání) |
| Start zvuku, obě úrovně zdrojů, délka, stop | Teď → Nahrát; hlavní plocha během schůzky |
| Zdroje, oprávnění, zkouška zvuku | Přímo Zdroje / ozubené kolečko vedle Nahrát; také Nastavení |
| Název po stopu, cílová firma, uložit a odeslat / jen Mac | Dokončovací formulář v panelu |
| Lokální přehled, obnovení | Můj den → Nahrávky, Obnovit přehled |
| Odeslat, retry, ověřit | Detail nahrávky; čtyři rozlišené kroky uložení |
| Obnova přihlášení, firma, limit a vlastnictví | Kontextový problém přímo v detailu; neopouští rozpracovanou činnost |
| Otevřít v LuDone, Finder, koš | Detail; koš s konkrétním náhledem |
| Login/logout, retence, automatika, start po přihlášení, Dock | Nastavení |
| Diagnostika | Nastavení → Export diagnostiky s náhledem obsahu bez citlivých dat |
| Kontrola / příprava / odklad / instalace aktualizace | Nastavení + proužek + dedikovaný krátký panel |
| Ikona lišty, menu rychlých akcí, Dock | Lišta a ⌘K; identita v patičce ukazuje všechny velikosti a stavy |

## Co existuje a co se teprve navrhuje

| Oblast | Zdrojový stav podle společného zadání | Stav tohoto výstupu |
|---|---|---|
| Záznam zvuku a stereo soubor | Dnešní schopnost desktopu, formát dle D21; nové ostré ověření zde neproběhlo | Návrh zachovává schopnost; zvukové indikátory jsou pouze simulace |
| LuTrack web | Koordinátorem pozorované živé UI na ludone.cz, ne doklad integračního API | Kompletní budoucí desktopové chování bez tvrzení o známém API |
| Integrovaný den, vazba práce/schůzka, obnova | Navržené chování druhého kola | Lokálně klikací, není schválená implementace |
| Firma, vlastnictví, fronta, aktualizace | Dnešní úkoly podle briefu a historických podkladů | Nové uspořádání a explicitní přechody |
| Poznámka v rychlých akcích | Nový produktový nápad | Lokální demonstrace, další scope ke schválení |

## Alternativy, které jsem zvažoval

1. **Jedna hlavní časová osa i v panelu.** Silná kontinuita, ale v šířce 400 px by se běžné start/stop a bezpečné dokončení ztrácely mezi událostmi. Proto je stopa dne až v normálním okně.
2. **Samostatné režimy Práce / Schůzka.** Snadno se vysvětlují, ale přepínač režimů sugeruje vzájemné vyloučení. Při souběhu by skrýval jednu z nezávislých činností. Proto přepínám informační prioritu, nikoli režim aktivity.

## Implementační etapy a závislosti

| Rozsah | Doporučené pořadí a výstup | Závislosti |
|---|---|---|
| S | Panel, kontextový pás, monochromatická lišta, tři témata, konsolidace navigace a pojmenování stavů | Audit současných mostů a událostí desktopu; vizuální schválení směru |
| M | Jednotný detail nahrávky, bezpečná volba cíle / vlastník / retry, uložení a stav aktualizace | Existující model fronty, identity, retence a updateru; review bezpečnostních změn nad diffem |
| L | Skutečný LuTrack v desktopu, místní den, synchronizace, řešení restartu a historie vazeb | Nejdřív ověřit autentizaci, dostupná API, idempotenci, konflikty a oprávnění LuTracku; API ani časové odhady se zde nehádají |
| S, až potom | Kontextová poznámka v rychlých akcích | Rozhodnout o potřebě a o úložišti; není blokátorem hlavního směru |

Začít sjednoceným panelem a bezpečným detailem nahrávky. Integrovaný LuTrack vyvíjet až proti ověřenému kontraktu, bez další přihlašovací identity a bez předstírání serverového výsledku místním časovačem.

## Použité podklady a inspirace

Přečtené lokální zdroje: `ROZHODNUTI.md`, `PLAN.md`, `DAN-TODO.md`, společný `SHARED-BRIEF.md` a `CLARIFICATIONS.md`, LuDone design-system skill a reference tokens/themes/buttons/controls/accent-matrix, `ludone-app/docs/agent/design-system-rules.md`, `docs/design-system/design.md`, `inventory.md`, `src/app/globals.css`; historický společný `design/zadani/dan-vstup-2026-09-01.md` a `design/navrh/nahled.html`, `Main.dc.html`, `Lista.dc.html`.

Typologická inspirace z briefu: Raycast (malý nástroj a rychlé příkazy), Linear (typografická hierarchie a detail), Toggl (kontinuita úseků). Žádná externí stránka nebyla navštívena; nejde o tvrzení o aktuálních funkcích těchto produktů. Návrhy druhého autora ani prvního kola nebyly čteny. Brockmann a Public Sans byly zkopírovány ze společných lokálních assets; Brockmann není tímto výstupem licencovaný k veřejné distribuci. Po posledním Danově upřesnění je Dock/app ikona převzatá beze změny ze společného `shared-assets/brand/LuDone-icon-iOS-Default-1024x1024@1x.png`. Monochromatický znak v záhlaví a liště přebírá přesnou geometrii skupiny `front` ze společného `LuDone.svg`; přidává pouze stavové odznaky. Pracovní historický pulz byl odstraněn. Obrazovka Identity porovnává originál s jemným rohovým odznakem D; doporučuje originál s textovým označením LuDone Desktop, protože zachovává čitelnost i v 16 px. Odznak existuje jen jako návrhová varianta pro větší velikosti. Ostatní ovládací ikony jsou jednoduché lokální tahové SVG, bez CDN.

## Ověření a omezení

🧪 Lokální automatické ověření v Orca browseru a konečný běh v odděleném headless Chromium přes již nainstalovaný Playwright: všech 14 přímých scénářů × tři témata, skutečné DOM akce pro povinné cesty a invarianty. Přesný příkaz, jednotlivé PASS/FAIL a exit kód jsou v `evidence/verification.txt`; konečná reprodukce přes `node evidence/verify-local.cjs` (cesta k již instalovanému Playwrightu je ve skriptu), alternativně `python3 evidence/verify.py <vlastní-browserPageId>`. Konečný výsledek: 42 kombinací, 51 kontrol cest, bez JS chyb, exit 0. Opakovaný běh Orcy přerušil výpadek jejího runtime; doslovný neúspěch je zachovaný v `evidence/orca-runtime-timeout.txt`, byl nahrazen dokončeným během v izolovaném lokálním prohlížeči bez instalace a bez účtu. Snímky `home.png`, `meeting.png`, `save.png`, `day.png` a `meeting-dark.png` jsou skutečné screenshoty lokálního HTML.

⛔ Produkční funkce, skutečný zvuk, API, OAuth, systémová oprávnění, Dock, Finder, koš, updater a trvalé uložení nejsou tímto během ověřeny. HTML stav žije v paměti stránky; běžná navigace i skrytí panelu ho zachovají, simulovaný restart se spouští v nabídce Návrh. Skutečný reload URL obnoví scénář. Časy, velikosti a aktivita měřidel jsou fiktivní. `ui-smoke` ani `audio-smoke` se nespouštěly.

Integrace porovnávače: `data-scenario` / `data-theme`, whitelist vstupních zpráv, `event.source === window.parent`, výstupní stav s celočíselným rozměrem. Při HTTP se posílá na stejný origin; u samostatného `file:` náhledu má origin hodnotu `null`, proto výstupní zpráva používá `*` (obsahuje pouze neosobní rozměr a stav návrhu). Žádné fetch, XHR, audio capture, externí navigace ani opravdové exporty.
