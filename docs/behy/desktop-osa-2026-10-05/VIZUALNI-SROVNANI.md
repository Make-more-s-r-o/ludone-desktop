# Dílčí vizuální srovnání skutečného rendereru s F Osa

5. 10. 2026. Čtecí review snímků, bez úprav produkce či testů.

## Rozsah a pravdivý stav

🟡 Jde o dílčí přejímku konkrétních snímků z integračního worktree, nikoli schválení celé F nebo kontrolu 24 × 3 situací. Vizuálně bylo otevřeno 25 skutečných Electron snímků a 19 referencí. Reference obsahuje 72 souborů, ale všechny zde prohlédnuty nebyly.

Zdroj skutečných snímků: `.runtime/osa-auth-e2e/2026-10-05T14-55-08.548Z/`. Reference: `dukazy/desktop-osa-2026-10-05/reference/`, její `index.json` uvádí F Osa a `referenceOnly=true`. Referenční data jsou fiktivní. Čas, názvy, počet položek, vlastník, firma a stav ověření se nesrovnávají jako identické hodnoty.

| Skutečně otevřené situace | Témata |
|---|---|
| `complete-*-ready`, `history`, `account`, `recording`, `save`, `detail`, `local-detail` | light, professional, dark, všech 21 snímků |
| `complete-light-audio` | light |
| `complete-professional-device` | professional |
| `complete-dark-storage`, `complete-dark-diagnostics` | dark |

Otevřené reference: ready ve třech tématech; professional/dark history; dark settings; light/professional recording; light/dark save; detail ve třech tématech; light audio; professional device; dark storage; dark diagnostics. Celkem 19.

⚠️ U posuzovaného runtime `14-55-08.548Z/results.json` je `exitCode=1`, přestože všech 96 uložených observations má `pass=true`. Proto jej tento záznam neoznačuje za úplně zelený běh. V novějším `14-56-43.679Z/results.json` bylo čtením ověřeno `exitCode=0`, 99 observations bez selhání, včetně Stay/Discard/Save skutečného dirty dialogu. Jeho snímky zde nebyly znovu vizuálně převzaty.

Oba běhy používají syntetickou identitu/transport. Posuzovaný runtime uvádí `syntheticIdentity=true`, `syntheticTransport=true`, `productionServerVerified=false`. ⛔ Fyzický zvuk, lidská kontrola nativní horní lišty na Macu ani serverová produkce tím nejsou ověřené. Nová úplná matice běží nezávisle a potřebuje nové srovnání po opravách.

## Konkrétní nálezy v posuzovaných snímcích

### P2 — dvě rovnocenné volby po nahrávání nejsou současně viditelné

Důkaz: `complete-light-save.png`, `complete-professional-save.png`, `complete-dark-save.png` proti `reference/light-save.png` a `reference/dark-save.png`.

Ve skutečném panelu 420 × 660 je hlavní Uložit a odeslat dole, Nechat na Macu pod spodní hranou. Reference save má 420 × 648 a obě plné volby. Produkční meta box, několik pomocných sdělení a vertikální mezery spotřebují přibližně horní dvě třetiny formuláře. Navíc ve F referenci mají Název/Firma/Přístup vlastní uzly svislé osy, skutečný formulář jen horní uzel. To je odchylka prvního rozhodnutí, nikoli důkaz nefunkčního lokálního uložení: scroll a následné pointer scénáře mohou volbu zpřístupnit. Náprava: kompaktní meta/hinty a společný blok obou akcí, kontrola skutečné první viditelné polohy v 660 px i v menším prostoru, obnovit uzly osy.

### P2 — návrat v odeslaném detailu je na horní hraně obsahu

Důkaz: `complete-{light,professional,dark}-detail.png`. Text Zpět do panelu je u spodní hrany hlavičky, kolem y=48; v `complete-*-local-detail.png` je kolem y=78 a v referenci detail přibližně y=85.

Nález se týká zachycené počáteční polohy a možného přenesení scroll pozice, nikoli prokázané neschopnosti kliknout. Náprava: nový detail otevírat s jasnou horní polohou nebo umístit návrat do stálé samostatné oblasti; ověřit elementFromPoint a první viewport při otevření odeslaného i lokálního detailu.

### P2 / čeká na ustálený snímek — čitelnost akcí detailu při změně tématu

`complete-dark-local-detail.png` zachycuje velmi světlý text na velmi světlém podkladu u Přehrát dostupný zvuk, Finder, koše, ověření a odeslání. `complete-dark-detail.png` již má čitelné tmavé podklady. V light/professional ověřeném detailu je naopak tlačítko Ověřit v LuDone velmi tmavé s tmavým textem; z obrázku samotného nelze spolehlivě určit disabled/busy stav.

Čtecí příčina přechodového local-detail snímku: `scripts/osa-auth-e2e.mjs` v cyklu local-detail nastavuje `dataset.theme` a hned volá capture. Capture bez čekání zavolá `testCaptureWindow`. `.button` v `src/styles.css` má `background 100ms` transition, textová barva se přepne okamžitě. Toto je silná hypotéza prvního animovaného frame, nikoli potvrzená trvalá CSS chyba. Aliasy pozadí jsou `--surface-elevated-2` → `--panel-raised` → `--osa-alt`; foreground přebírá `--osa-text`. Náprava: skutečně uložit/aplikovat téma a snímek zachytit až po ustálení computed background/color; prověřit `.osa-station__actions .button` v enabled i disabled stavu. Koordinátor již připravuje explicitní F styling disabled akcí. Nelze označit opraveno bez nové zachycené dark varianty.

### P2 — slité potvrzení po lokálním uložení

Důkaz: `complete-professional-ready.png` a `complete-dark-ready.png`: „Připraveno k nahráváníNahrávka zůstala jen na tomto…“ se spojuje bez mezery nebo jasného oddělení. Jde o ready po předchozím uložení, nikoli o stejný čerstvý stav jako light-ready. Náprava: samostatný status blok potvrzení a zřetelné oddělení od nadpisu. Stav uložené nahrávky ani text potvrzení nemažte.

### P2 — změněná struktura nastavení a příliš rozbalený účet

Skutečné sekce mají pořadí Účet/Zvuk/Ukládání/Zařízení/Diagnostika; reference má Účet/Zvuk/Zařízení/Ukládání/Diagnostika. Ve skutečném účtu všech tří témat je Prostředí rozbalené a spolu s dodatečnými mezitexty tlačí ostatní sekce a odhlášení mimo první viewport. Referenční dark-settings má odhlášení v horní account kartě a Prostředí jako sbalené Pokročilé. Ikony sekcí v aktuálním rendereru chybí.

Skutečné ovladače se nesmějí odstranit; náprava je kompozice F, pořadí sekcí a sbalené pokročilé prostředí se zachovaným bezpečným výslovným přepnutím. Ze snímku není prokázána blokace scroll přístupu.

### P3 — historie nemá spojitou osu a denní uzel se ořezává

Důkaz: complete history ve všech třech tématech proti professional/dark reference history. V runtime jsou izolované body, první kruhový uzel u Dnes je vlevo oříznutý; reference má souvislou svislou osu a celé denní uzly. Obnovit propojující linku, explicitní prostor pro pseudo-elementy a jejich skutečný pixelový bounds.

Reference history je 460 × 924, runtime 460 × 660. Proto rozdílný počet viditelných řádků není sám o sobě platný důkaz chyby. Skutečný runtime má více řádků téhož dne; reference převážně samostatné dny. Stránkování a dosažitelnost sedmé položky je nutné ověřovat funkcí, nikoli očekávat identický obrázek s odlišnými daty.

### P3 — nahrávání není kompozičně celé F

Runtime recording všech tří témat zachovává hlavní red Stop, čas, kanály a rail signalizaci. Přidává skutečné měřiče a titul Nahrávání schůzky, ale z první obrazovky odstraňuje cíl firmy i náhled posledních schůzek, které v light/professional F recording zůstávají. Prázdná dolní část panelu tak není pouze důsledkem krátkého syntetického času. Nápravu rozhodnout jako věrnost vybrané F; měřiče musejí dál vycházet ze skutečných dat a nesmí se obětovat dostupnost Stop.

## Co není nález chyby

Systémové písmo, svislý rail, tématický akcent, rozlišení Mac/server a skutečná přístupová metadata jsou v prohlédnutých obrázcích čitelné. Krátký čas syntetického záznamu, nahrávky bez uživatelského názvu a testovací účet/firma nejsou samy designovou vadou. Zamčená metadata odeslaného detailu se nesmějí zaměnit za nedokončené pole lokálního detailu; předuploadová editace musí být převzata samostatným scénářem.

## Stav po předání koordinátorovi

🟡 Koordinátor průběžně opravuje kompaktní save a blok akcí, osu historie, pořadí nastavení, sbalené prostředí a skutečnou perzistenci tématu. Tento dokument zachycuje nálezy před těmito opravami. Nepotvrzuje jejich odstranění; převzetí potřebuje nový skutečný runtime, snímky po ustálení a kontrolu zbývajících situací. P1/P2 nálezy nesmějí být vydávány za kosmetickou výjimku bez vyřešení.


## Opakované převzetí po opravách — runtime 15-07-29.395Z

🧪 Čtením `.runtime/osa-auth-e2e/2026-10-05T15-07-29.395Z/results.json` ověřeno: exit 0, 422 observations, žádný FAIL, včetně `matrix-24-scenarios-three-themes` a `light/professional/dark-save-actions-side-by-side-visible`. To dokládá novou úplnou automatickou matici; neznamená, že čtecí reviewer vizuálně otevřel všech 72 obrázků.

V tomto opakování skutečně otevřeno 12 snímků: save ve třech tématech; professional-detail; dark-local-detail; professional-history; dark-ready a professional-ready; dark-account a light-account; light-audio; professional-device. Reference se použily z předchozí výslovně uvedené kontroly. Fyzický Mac, jeho nativní lišta, fyzický zvuk a produkční server zůstávají ⛔ neověřené tímto review.

### Odstraněné nálezy v nových snímcích

- 🧪 Save: obě rovnocenné volby jsou plně viditelné vedle sebe ve všech třech tématech, přibližně y=503–547, v 660px viewportu. Název, firma a přístup mají jednotlivé kruhové uzly osy; meta/hinty jsou kompaktnější. Potvrzeno obrazem i samostatnými viewport assertions.
- 🧪 Dark local detail: po ustálení tématu jsou skutečné akce čitelné, světlý text na tmavém podkladu. Předchozí snímek velmi světlého pozadí nepředstavoval prokázanou ustálenou chybu; nové zachycení odstranilo tento konkrétní problém.
- 🧪 Účet: Pokročilé nastavení je sbalené a odhlášení znovu viditelné v prvním viewportu, v light i dark.
- 🧪 Pořadí sekcí: light-audio a professional-device ukazují Účet/Zvuk/Zařízení/Ukládání/Diagnostika podle F.
- 🧪 Historie: spojitá svislá osa skutečných řádků je nově viditelná.

### Přetrvávající konkrétní P2

**P2 — slité potvrzení po uložení:** `complete-dark-ready.png` i `complete-professional-ready.png` stále zobrazují „Připraveno k nahráváníNahrávka zůstala…“. Čtecí příčina: `src/osa.css` mění `.idle-feature-row__copy` z flex sloupce na `display:block`; její `strong` a `small` zůstávají inline. Náprava: skutečné blokové oddělení nadpisu a notice nebo obnovení flex column se zachovanou notice a odkazy. Nález nelze uzavřít jen zeleným testem počtu nebo fontu.

**P2 — hover kontrast ověření v light/professional detailu:** `complete-professional-detail.png` má po pointer ověření nadále téměř černý text na tmavém pozadí. Čtecí příčina je konkrétní `.button:not(:disabled):hover` v `src/styles.css`: podklad `oklch(0.3 0 0)` se přepne bez změny tmavé `--foreground`. Pointer po kliknutí zůstává nad tlačítkem. Původní náprava disabled selectoru tento enabled hover neřeší. Úzká náprava: `.osa-shell .osa-station__actions .button:not(:disabled):hover` s F `--osa-soft`, `--osa-text` a `--osa-line`; ověřit skutečný hover i pohyb pointeru mimo akci v light/professional, zachovat disabled a busy kontrakt.

### Zbývající P3 a omezení pozorování

Professional-history: denní uzel u Dnes je stále levá polovina kruhu; zbytek osy je již opravený. `.recordings-day__heading:before` má `left:-30px`, ale heading začíná kolem x=88 a scroll content clip kolem x=70, tedy levá část uzlu kolem x=58 se ořezává. Posunout uzel či inset tak, aby měl celý skutečný bounds v scroll regionu.

Professional-detail: návrat není v zachyceném prvním obrázku vůbec vidět. Capture následuje po pointer verify, který skutečně používá scrollIntoView; z tohoto scrolled snímku nelze prokázat trvalé překrytí nebo nepřístupnost návratu. Původní P2 návratu proto nyní zůstává 🟡 k cílenému ověření počátečního scrollTop, návratu po otevření i návratu po skutečné akci. Dark-local-detail má návrat viditelný, kolem y=78. Nesprávná poloha návratu se nesmí tvrdit jako potvrzená chyba bez rozlišení stavu scrollu.

P3 nahrávací kompozice popsaná výše se v tomto opakování neotevírala znovu. Závěr o jejím odstranění zde není.

Koordinátor dostal konkrétní selektory a příčiny zbývajících P2. Stav vizuální přejímky zůstává 🟡, dokud nebudou tyto dva nálezy odstraněny a znovu zachyceny. Automatické pokrytí 24 × 3 ani systémový font nesmějí nahrazovat tento konkrétní pixelový review.


## Cílené uzavření zbývajících P2 — runtime 15-13-21.576Z

V tomto čtecím opakování otevřeno pět nových skutečných snímků: `complete-professional-ready.png`, `complete-dark-ready.png`, `complete-professional-history.png`, `complete-professional-detail.png`, `complete-light-detail.png`. Zdroj `.runtime/osa-auth-e2e/2026-10-05T15-13-21.576Z/`, produkční oprava koordinátora `a8a14bd`. V době zápisu celý běh ještě neměl `results.json`; ⛔ jeho konečný exit ani celkové font/hover assertions tímto dodatkem nejsou prohlášeny za zelené.

- 🧪 P2 slitého statusu odstraněn: professional i dark ready mají samostatný nadpis, potvrzení na vlastních řádcích a samostatný odkaz. Text uložené nahrávky zůstal zachován.
- 🧪 P2 kontrastu ověření odstraněn v novém light/professional detailu: Ověřit v LuDone je čitelné, tmavý text na světlém podkladu. Definitivní automatický hover/kontrast výsledek musí uvést koordinátor z dokončeného běhu; review neodvozuje konkrétní poměr kontrastu pouze z obrázku.
- 🧪 Cílená nejistota počátečního návratu uzavřena pro light/professional detail: po explicitním počátečním scrollTop=0 je Zpět do panelu plně viditelné v oddělené oblasti kolem y=78. Předchozí capture po pointer verify nebylo důkazem trvalého překrytí.
- 🧪 History denní kruh Dnes již není oříznutý a svislá linka je viditelná.

⚠️ Zůstává drobný P3 osy historie: v professional-history je spojitá linka kolem x=93 a denní kruh kolem x=98, ale malé kruhy nahrávek kolem x=123, tedy zhruba 25 px vpravo od hlavní osy. Čtecí příčina: vyšší specificita `.osa-shell:not(.osa-shell--detail) .settings-window[data-page] .recordings-timeline__entry:before` stále používá `left:5px`, zatímco změna paddingu seznamu posunula samotné položky. Reference má denní a položkové uzly na jedné ose. Koordinátorovi předáno; tento bod se neoznačuje za opravený pouze proto, že kruhy již nejsou oříznuté.

V pěti znovu otevřených snímcích nebyl nalezen další konkrétní P2. To není obecné schválení celé F ani lidská přejímka fyzického Macu. Dosavadní vědomě omezený stav fyzického zvuku/lišty a syntetického transportu platí dál.
