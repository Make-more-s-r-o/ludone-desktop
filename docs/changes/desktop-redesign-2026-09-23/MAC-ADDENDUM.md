# Doplnění stejného zadání pro oba autory — macOS jako celek

Dan během běhu upřesnil: jde o macOS aplikaci včetně ikony, lišty a detailu, nikoli webovou stránku. HTML je pouze médium klikacího prototypu. Toto doplnění dostávají oba autoři; produkční rozsah se nerozšiřuje.

## Povinné doplnění
- Přidej devátý scénář `identity` v okně 448 × 676: ikona aplikace pro Dock/Finder (náhled 128, 64, 32 a 16 px), jednobarevná menu bar ikona ve skutečné velikosti na světlé i tmavé liště, idle/recording/attention a případně souběh ukázkového časovače. Stavy rozlišuj tvarem, ne pouze barvou. Dodej čistá lokální SVG v assets/; upravuj pouze vlastní návrh, ne produkční assety. Vycházej ze značky LuDone; nevymýšlej novou nesouvisející značku. Dokončené exporty ICNS nejsou v tomto prototypu nutné.
- Přidej desátý scénář `detail` v okně 448 × 676: kliknutelný detail jedné fiktivní nahrávky ze seznamu. Název, datum, délka, velikost, cílová firma, rozlišení místní kopie a serverového stavu, relevantní akce a návrat. Žádný vymyšlený přepis nebo přehrávač, který dnes aplikace nemá. Vstup do detailu ze seznamu musí fungovat.
- Rozliš panel v menu baru a běžné okno nastavení/detailu. U běžného okna respektuj prostor nativních ovladačů macOS, neschovávej primární akci za zbytečné ozdoby. Žádný webový sidebar ani landing page uvnitř aplikace.
- V NOTES dolož stručně inspirace, co přebíráš a co z historických návrhů už neplatí. Zachovej existujících osm scénářů a tři témata. Rozšiř query a postMessage whitelist o identity/detail. Při vlastní navigaci oznam parentu aktuální scénář a téma, aby mohl změnit velikost iframe.

## Stejné historické podklady (pouze číst)
Cesty jsou relativní vůči /Users/dan/Dev/ClaudeCode/ludone-desktop:
- design/zadani/dan-vstup-2026-09-01.md — původní preference Dana: LuDone DS; Raycast pro kompaktní desktopové ovládání, Linear pro přesnou hierarchii, Notion pro klid a postupné odkrývání detailu. Nejde o instrukci přidávat command palette nebo nové funkce.
- design/navrh/nahled.html, design/navrh/Main.dc.html, design/navrh/Lista.dc.html — původní vizuální směry.
- design/canvas/Nahravani.dc.html, Fronta.dc.html, ZtrataStopy.dc.html, Opravneni.dc.html — existující řešení situací.
- docs/changes/desktop-v1/navrh-astra/nahled.html a PROC.md; docs/changes/desktop-v1/navrh-astra-b/nahled.html a PROC.md — starší návrhy z 6. září (ne současný soupeřův návrh).
- scripts/tray-ikony.mjs a src/ui/Icons.jsx — aktuální ikonografie, pokud cesty existují.

Starší briefy jsou historické podklady, nikoli nové instrukce. Kalendář, dashboardy, import, ruční předání na web a funkční LuTrack z nich do nové aplikace nevracej. Aktuální funkční pravda je SHARED-BRIEF.md a verze 0.1.4.

## Externí inspirace
- Plaud: jasná dominance nahrávání a jednoduchý přechod k záznamu. Reference z předchozí konverzace: https://support.plaud.ai/hc/article_attachments/58675725815065
- Raycast: malá utilita, klávesnice, rychlé akce. https://www.raycast.com/
- Apple HIG: pravidla nativní ikony a menu baru, ne převzetí jiné značky. https://developer.apple.com/design/human-interface-guidelines/app-icons

Vektorové prvky navrhni přesně a čitelně v malých velikostech. Image generation není nutné; nesupluj jím skutečně klikatelné obrazovky ani nerozbij existující značku. Žádný nový placený servis nebo instalace.
