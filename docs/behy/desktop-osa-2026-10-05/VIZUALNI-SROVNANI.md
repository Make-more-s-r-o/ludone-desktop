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
