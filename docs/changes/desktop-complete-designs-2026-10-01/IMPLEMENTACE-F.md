# Implementace F Osa — samostatné zadání

Připraveno 5. 10. 2026 pro další běh na vývojovém Macu. **Příprava není zahájení implementace.** Dan zvolil celou F Osa a upřesnil hlavně systémové ikony; jejich poslední podobu nyní posoudí. Toto zadání se provádí až po pokynu začít. Bez nového pokynu nevytváří release ani nepřepisuje nainstalovanou aplikaci.

## Cíl a podklady

Převést **celou vybranou F Osa** do funkční LuDone Desktop. Nahrávání, zastavení a rozhodnutí po schůzce proběhnou v panelu horní lišty. Historie, odesílání, nastavení, onboarding a aktualizace také zůstanou v panelu. Samostatné okno vznikne až pro detail konkrétní nahrávky. Zachovat existující funkční zvuk, frontu a přihlášení; nevydat jen nové barvy starého rozvržení.

Čti `AGENTS.md` → `ROZHODNUTI.md` → `PLAN.md` → `DAN-TODO.md` a pak tento brief. Starší historické checklisty nepovažuj za dnešní backlog, novější rozhodnutí mají přednost.

| Podklad | Cesta od kořene repa |
|---|---|
| Celá F, všechny obrazovky | `docs/changes/desktop-complete-designs-2026-10-01/design/viewer.html?variant=f` |
| Autorská kompozice | `.../design/sonnet-f.css`, `.../design/sonnet-f-layout.js` |
| Společný funkční mock | `.../design/app.js`, `.../design/menu*.css`, `.../design/creative-integration.css` |
| Ovládací ikony | `.../design/f-icons.js`, `.../design/f-icons.css` |
| Systémové ikony | [F-TRAY-KONTRAKT.md](F-TRAY-KONTRAKT.md), `.../design/f-tray-assets/manifest.json` |
| Všechny funkce makety | `.../design/coverage.html` |
| Původní návrhy a autorství | [README.md](README.md), Sonnet briefy/poznámky a verzované `dukazy/` |
| Funkční serverový rozsah | `docs/changes/nahravky-dashboard/ZADANI-PRO-CODEX.md`, `STAV.md` |
| Produkční stav 0.1.7 | `docs/changes/desktop-astra-parity-0-1-6/`, `produktove-dotazeni/` pokud existuje; skutečné soubory si ověř |

`...` v tabulce znamená stejný adresář `docs/changes/desktop-complete-designs-2026-10-01`, nikoli cestu mimo checkout. Živý VPN server je pouze pomocný; vše potřebné musí jít spustit z checkoutu bez původního Danova Macu. HTML viewer spouštěj jen nad složkou návrhu na loopbacku.

Design obsahuje fiktivní data a simulace. **Nepřenášej `seed()`, intervaly, pevná metadata nebo toasty místo skutečných operací.** Produkce 0.1.7 už řadu funkcí obsahuje: použij její služby/IPC a jejich ochrany, přestav prezentační vrstvu. Pro nové hledání, rozsah dat a okno detailu doplň skutečné adaptéry.

## Pevná produktová pravidla

- Systémové SF, základní čitelný text přibližně 15 px podle F; žádné další webové písmo. Zachovat světlé, profesionální i tmavé téma.
- Kompaktní panel F: 420 px běžné situace, historie 460 px, onboarding 440 px; detail 860 × 580 px. Rozměry jsou návrhový cíl. Panel se vejde do dostupného prostoru obrazovky, přizpůsobí se výřezu a více monitorům. Žádný webový rám uvnitř dalšího rámu okna.
- Originální LuDone/Opus Dock ikona. Horní lišta podle samostatného kontraktu; běžící čas a finalizace mají pravdivý zdroj v main procesu.
- Nahrávání je první, LuTrack pouze malá neaktivní položka „Připravujeme“. Žádné LuTrack API, časovač ani pracovní data.
- Jeden výsledný WebM/Opus stereo soubor schůzky (mikrofon vlevo, systémový zvuk vpravo), jeden upload a jeden serverový záznam. Rozhodnutí o formátu ani bezpečný export nepřestavovat kvůli UI.
- Po stopu jsou vedle sebe „Uložit a odeslat“ a „Nechat na Macu“. Změnit lze název, firmu i přístup před prvním uploadem. Nové jsou výchozí firemní; historické soukromí se nemění. Uložená výchozí firma platí pro nové nahrávky. Automatika také pouze pro nové; nic historického nesmí začít odcházet po zapnutí.
- Metadata po schváleném začátku odeslání jsou zamčená. Převzetí vlastnictví je samostatné výslovné potvrzení, které nic neodešle.
- Odhlášení/síť nebrání místnímu nahrávání. Quit, restart a update nesmí přerušit nahrávání ani finalizaci/rozhodnutí. Zavření panelu nebo detailu samo nahrávání neukončí.
- Mac a server mají oddělené stavy. „Ověřeno“ vyžaduje skutečné ověření serverového ID, nestačí lokální stav fronty. Přepis a analýza zůstávají na webu.
- Backend, LuTrack a cizí kořenový `design/` se nemění. Dokumentaci a komentáře česky, commity anglicky. Tajemství a osobní nahrávky nepatří do Git ani cloudové makety.

## Postup a vlastnictví

Koordinátor vede integraci a review. Rutinní UI, data adapter a čtecí review deleguj levně na Sol s nízkým effortem, nejvýš 2–3 souběžně. Každý zapisovatel vlastní oddělený `.claude/worktrees/<účel>` a jasné soubory. Sdílený shell, main/preload a frontu mění jen jeden zapisovatel. Závislé kroky nejsou souběžné.

1. **Inventář a výchozí stav:** založ čistou `feat/desktop-osa` z aktuálního `origin/main`; přenes pouze verzované podklady F z přípravné větve. Ověř původní gates a dohledatelné chování produkce, sepiš mapu mock → skutečné API. Nevytvářej jiný design.
2. **Systémový shell:** skutečný tray/panel, pozice a rozměry, řídicí životní cyklus main procesu, nové masky a titulky; detail samostatné okno s návratem. Zkouška zavřeného panelu a stop dostupný i v historii/frontě. Main/preload změny projdou nezávislým review.
3. **Nahrávání a uložení:** napoj existující recording/export služby, chyby kanálů a dokončování. Zachovej obnovu po pádu/restartu, skutečné metadata a neodeslaný draft. Žádný toast nesmí předstírat poslech nebo uložený soubor.
4. **Historie a odesílání:** hledání, 7/30/180 dní/vše/vlastní rozsah, stavové filtry a stránkování po 7 položkách z reálných dat. Dostupné musejí být všechny položky fronty; nepřenést mock limit 9. Obnovit, retry, převzetí, serverové ověření, Finder, web a bezpečný místní koš. Zachovat idempotenci, vlastníka, retry limity a uložená serverová ID.
5. **Všechna nastavení:** účet, zvuk, zařízení, ukládání, diagnostika; všechny existující volby viditelné ve F. Persistentní firma a přístup, skutečný Dock/autostart/retence/diagnostický export podle stávajících služeb. Retence nesmí smazat neodeslané či neověřené. Onboarding zachová skutečná oprávnění a člověkem potvrzený poslech. Update kontrola, proužek a jednorázové oznámení za verzi; instalace až po kliknutí a bezpečném uložení.
6. **Přejímka a příprava vydání:** proklikat skutečný Electron, uložit srovnání návrh/aplikace, funkční scénáře, doslovné výpisy a nezávislé review. Průběžné commity, push, PR, aktualizovaný plán/rozhodnutí a krátký postup pro Dana. Připravit podepsané vydání existujícím workflow; publikovat jen s platným oprávněním pro tento nový běh a po požadované vizuální kontrole. Nevyvozovat release oprávnění z tohoto přípravného dokumentu.

## Akceptace, kterou nelze obejít

Příprava podkladů měří pouze `design/check-f-tray.mjs`. Implementace potřebuje `npm run gates:clean`, build, skutečné `npm run test:tray-image` na Macu a odpovídající Electron E2E. Dle etapy zkontroluj příslušné skripty v `scripts/akceptace/` a ulož doslovný výpis s exit kódem.

`astra-design-e2e.mjs` má konkrétní starý Astra shell, taby a souřadnice 400 × 700. F je výslovně zvolený nový směr, ale **stávající testy ani baseline se tímto během přípravy nemění**. Implementátor připraví F akceptační scénáře vedle původních a sepíše případný rozpor. Přechod nebo výjimka vyžaduje lidské rozhodnutí dle AGENTS.md; nesmí z něj vzniknout méně funkčních nebo bezpečnostních podmínek. Totéž platí pro přesné staré alfa masky. Zachovat assertions autority main procesu, IPC vlastníka, originu a fronty; přidat testy souběhů nových tray stavů.

| Oblast | Povinné ověření skutečné implementace |
|---|---|
| F jako celek | 24 situací vieweru × tři témata; dlouhý název/firma, úzký prostor, fokus/klávesnice, všechny akce dosažitelné. Srovnání maketa/Electron vedle sebe s odůvodněním nativních rozdílů. |
| Lišta | 18/36 px, skutečně světlá/tmavá systémová lišta, více monitorů, čas pokračuje při skrytém rendereru, crash rendereru, pravý klik a bezpečné ukončení. Nahrávání při expiraci/offline zůstává vidět. |
| Výstup | Uložit lokálně i zařadit; dokončení a restart draftu; jeden stereo soubor a jeden vzdálený záznam. |
| Historie | Dnes/prázdná/posledních 180 dní/vše/vlastní data/hledání/filtr/stránkování; žádné půlroční nekonečné scrollování. Časové pásmo a hranice dne. |
| Upload | Souhlas, firma/přístup, zámek, uložená výchozí firma po restartu, idempotentní retry/limit/offline/expirace/vlastník. Žádné odeslání při pouhém převzetí či změně firmy. |
| Místní akce | Skutečný Finder, přehrávání, otevření správné webové adresy podle serverového ID, potvrzený koš bez změny serverového záznamu. |
| Nastavení | Pět sekcí, perzistence, skutečné oprávnění a diagnostika bez tokenů, bezpečná retence, environment switch nesmí potichu převzít jiného vlastníka. |
| Update | Automatický check, chyba/defer/download, jedna notifikace pro verzi, ručně vyžádaná instalace čeká na záznam a finální uložení. |

Zvuková cesta má nejvýš 🧪, dokud ji člověk neověří na fyzickém Macu. `ui-smoke`/`audio-smoke` nespouštět v CI/sandboxu a nevydávat mock za fyzické ověření. Rozlišuj ✅ naostro, 🧪 testy, ⛔ neověřeno, 🟡 konkrétně čekající, ⚠️ rozpor. P1/P2 nálezy odstranit před vydáním. Neopakovat historii, kdy byla vydána aplikace s jiným rozvržením než schválená maketa.
