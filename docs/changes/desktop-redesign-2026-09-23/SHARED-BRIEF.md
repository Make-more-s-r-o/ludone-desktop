# Společné zadání: nový vzhled LuDone Desktop

## Výsledek
Vytvoř jeden osobitý, dotažený a klikatelný vizuální návrh každodenní malé macOS aplikace pro nahrávání schůzek a odesílání do LuDone. Dan chce moderní, minimalistickou a příjemnou aplikaci s jasností podobnou Plaud; nejde o kopii Plaud. LuDone DS je vizuální základ. Zlepši hierarchii a cestu úkonů, nikoli pouze barvy původních karet.

Toto je nezávislé designové kolo. Nečti návrh druhého autora a nepoužívej jeho soubory. Oba autoři dostávají totožný brief, data, velikosti, scénáře a kritéria. Není to benchmark modelů při shodných nástrojích; hodnotíme použitelnost konkrétních návrhů.

## Skutečný produkt a rozsah
Základ je desktop main 2f142b3 / vydaná 0.1.4. Jen návrh a lokální simulace. Neměň src/, electron/, backend, LuTrack, package.json, testy, původní cizí design/ ani skutečné uživatelské soubory. Nespouštěj nahrávání, upload, přihlašování, publikaci nebo release. Žádná skutečná soukromá data. Nepřidávej kalendář, archiv, AI chat, desktopový přepis, placené funkce ani vymyšlené statistiky.

Panel v liště má dnes šířku 366 px; výška je adaptivní podle obsahu a místa na obrazovce. Nastavení je 448 × 676 px. Zachovej je jako srovnávací rozměry. Větší alternativu smíš doporučit v poznámkách, ale povinné návrhy musí fungovat v původních rozměrech. Dlouhý obsah scrolluje uvnitř, hlavní akce má zůstat dostupná. Není to webový dashboard na celou obrazovku.

Funkce dnes:
- Mikrofon a systémový zvuk; jedna schůzka → jeden stereo WebM/Opus na serveru. Mikrofon L, systém R. Nezatěžuj uživatele kodekem, hashy a surovými ID v běžném toku.
- Start „Nahrát“, běh obou zdrojů a čas, „Ukončit a uložit“, název po stopu, „Uložit a odeslat“ / „Nechat na Macu“.
- Volitelná automatika se týká pouze nových nahrávek. Žádné automatické odeslání starých.
- Přihlášení a výslovně vybraná firma. Právě doložené UX selhání: člověk nahrál a chtěl odeslat, ale nahrávka čekala na chybějící firmu schovanou v Nastavení → Účet. V návrhu musí být cíl odeslání i oprava blokace srozumitelná hned. Výběr firmy sám nezačne odesílat staré položky.
- Fronta: čekání, upload, chyba/opakovat, expirace přihlášení, serverový limit, vlastnictví. „Uloženo na Macu“, „Ve frontě“, „Odesláno“ a „Ověřeno v LuDone“ jsou odlišné skutečnosti.
- Lokální přehled v Nastavení → Nahrávky není týmový archiv. Akce podle stavu: „Obnovit přehled“, „Uložit a odeslat“, „Zkusit znovu“, „Ověřit v LuDone“, „Otevřít v LuDone“, „Ukázat ve Finderu“, „Přesunout do koše“, případně „Převzít pod svůj účet“. Vlastnictví a koš mají konkrétní potvrzení; žádné hromadné převzetí nebo automatické retry cizích dat.
- Nastavení dnes: Účet / Zvuk / Záznamy (retence) / Nahrávky (lokální přehled) / Diagnostika. Přehlednější seskupení můžeš navrhnout při zachování dosahu akcí. Účet: firmy, přihlášení, odhlášení tohoto Macu, Dock/start po přihlášení. Zvuk: oprávnění, zdroje, test, automatické odesílání. Diagnostika: export. Produkce je běžný cíl; labs patří do pokročilého nastavení.
- Aktualizace: proužek s novinkou, jednorázové oznámení macOS, „Zkontrolovat aktualizace“, „Aktualizovat“ / „Později“. Až po kliku a po dokončení nahrávání/ukládání/časovače.
- LuTrack karta má nyní jen ukázkový časovač, projekty ani ukládání z UI nejsou zapojené. Nevydávej ji za funkční vykazování času. Zachovej jí přiměřené místo a poctivé označení, bez velkých nefunkčních formulářů. Podklady: src/features/tracking/TrackingCard.jsx.

## LuDone DS
Read-only zdroj: /Users/dan/Dev/ClaudeCode/LuDone/ludone-app. Nejprve docs/agent/design-system-rules.md, docs/design-system/design.md, inventory.md, relevantní typy komponent a src/app/globals.css. Skill /Users/dan/.agents/skills/ludone-design-system/SKILL.md.
Použij Brockmann nadpisy, Public Sans UI, typografický rytmus, kompaktní geometrii, sémantické barvy, velmi střídmé oddělování ploch. Radius hlavních vnitřních ploch 0, ovladače 2 px, drobnosti do 4 px. Zaoblení vnějšího nativního okna není vnitřní karta. Nepoužívej gradienty, velké barevné karty, dekorativní grafy, emoji jako ikony ani obrazové pozadí. Light primary tmavá, Professional modrá, Dark světlá. Oběma dodáme stejné vytažené tokeny a lokální fonty; měnit lze kompozici, ne značku. Přímé importy Next.js komponent sem nepatří: prototyp označ jako návrh inspirovaný DS, ne jako canonical produkční komponenty.

Povinně light, professional a dark; výchozí light pro první společné porovnání. Viditelný focus, čitelnost textu, označené ikonové akce, nespoléhat na barvu ani hover. Tlačítka běžně 32–36 px vysoká. Menší rozměry mají dávat smysl na Macu, ne být záminkou k drobnému písmu.

## Stejná fiktivní data
Přihlášený uživatel „Alex Novák“; firmy „Studio Sever“ a „Ateliér Jih“. Nahrávka „Týdenní domluva“, 23. září 2026 14:30, délka 12:34, 9,2 MB. Ve frontě jsou tři položky: tato právě odesílaná, „Návrh webu“ uložená pouze na Macu (6:08, 4,5 MB), „Kontrola rozpočtu“ čeká na obnovení přihlášení (8:42, 6,4 MB). V ukázce aktualizace je aktuální 0.1.4 a fiktivně nabízená 0.1.5 s textem „Přehlednější nahrávání a odesílání“. Jasně jde o simulaci, nikoli oznámení skutečného vydání.

## Osm povinných scénářů
1. `idle`: klidový panel 366 px. Co jde udělat teď, aktuální firma, připravenost mikrofonu/systému, stav fronty. Primární „Nahrát“.
2. `recording`: panel 366 px, 12:34, oba vstupy a jejich čitelné indikace, „Ukončit a uložit“. Doplň přístupný simulovaný přepínač selhání systémového zvuku a odpovídající další krok.
3. `saved`: panel 366 px, název po stopu, cíl odeslání, „Uložit a odeslat“ a „Nechat na Macu“ se srozumitelným výsledkem.
4. `blocked-company`: stejná uložená nahrávka, chybí firma. Uživatel má poznat co chybí a mít přímou lokálně funkční cestu vybrat/uložit firmu a pak výslovně odeslat. Výběr sám neodesílá.
5. `uploading`: lokální přehled v okně 448 × 676. Tři výše uvedené položky v rozlišených stavech, upload 42 %, smysluplné akce. Ověření/přechod na web jen po příslušném stavu, bez skutečné navigace do produkce.
6. `retry`: stejné okno 448 × 676. Jedna vlastní schválená nahrávka čeká na síť, „Zkusit znovu“; ukaž také dostupnou cestu opravit přihlášení u jiné položky. Koš vyžaduje potvrzení konkrétní testovací položky.
7. `settings`: 448 × 676, přehledné Nastavení, základní účet/firma, lokálně přepínatelné zvuk/retence/diagnostika. Nepřidávej 50 nových předvoleb. Mapuj všechny současné akce.
8. `update`: panel 366 px, dostupná fiktivní aktualizace, přínos, „Aktualizovat“ / „Později“ a vysvětlení odložené instalace při běhu nahrávání.

## Výstup a technický kontrakt
Vše ukládej výhradně do docs/changes/desktop-redesign-2026-09-23/variants/TVUJ_SLUG/ ve svém worktree. Nepiš do jiné varianty ani společných souborů. Koordinátor dodá přesný TVUJ_SLUG v obálce.
- index.html, styles.css, app.js (nebo samostatný HTML), assets/ pouze co je potřeba. Čisté HTML/CSS/JS bez buildu, externích CDN, síťových požadavků, instalace balíčků a frameworku. Ikony inline SVG. Každé hlavní tlačítko má lokální odezvu.
- URL `index.html?scenario=idle&theme=light`. Podporuj všech 8 scénářů a 3 témata. `document.documentElement.dataset.scenario` a `.dataset.theme` udávají aktuální stav. Samotná stránka má pouze app viewport, ne velký prezentovací rámeček; koordinátor ji vloží do stejně velkého iframe v porovnání.
- `window.addEventListener('message', ...)` přijímá jen zprávy od `window.parent`: `{type:'ludone-design:set', scenario, theme}`; validuj povolené hodnoty. Používej i query parametry při startu. Velikost viewportu je řízena zvenčí, v CSS width:100%. Při vlastní interakci můžeš měnit scénář i lokální stav. Oznámení parentu `{type:'ludone-design:state',scenario,theme}` je volitelné.
- Začni vizuálně výbornou idle/recording/saved kompozicí, potom stejný jazyk aplikuj na zbytek. Neosm nesouvisejících stylů.
- NOTES.md česky: nosná myšlenka do 120 slov; stručná mapa současná akce → nové místo; 3 nejdůležitější UX změny; co je simulace/nový návrh oproti 0.1.4; implementační náročnost S/M/L a rizika. Nepiš marketingovou obhajobu ani předstírané uživatelské testy.
- Manuálně/prohlížečem ověř 366px panel, 448×676 Nastavení, hlavní klikací tok a všechna témata. Když nemáš browser, přiznej to. Nedeklaruj produkční ani živé audio ověření.
- Necommituj, nepushuj, nevytvářej PR. Koordinátor převezme artefakty a uloží dohromady.

## Hodnocení (stejné pro oba)
35 % snadnost každodenního toku; 25 % vizuální klid a kvalita; 20 % jasnost chyb/stavů a dalšího kroku; 10 % soulad s LuDone; 10 % proveditelnost v existující aplikaci. Povinné funkce a bezpečné rozlišení stavů jsou podmínka, ne bonus. Jeden klik navíc či schovaný cíl odeslání je významnější než dekorace. Bez kopírování výstupu soupeře. Jeden první návrh od každého, potom maximálně jedno stejnoměrné kolo opravy objektivních chyb; estetiku mezi autory nemíchat.
