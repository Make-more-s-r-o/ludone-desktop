# Rovnocenná migrace rendererových testů na F Osa

5. 10. 2026. Samostatný zapisovatel ve worktree `osa-tests-f`, základ `e1e4af8`.
Dan výslovně schválil přechod původních očekávání na vybranou F; koordinátor zadal zachovat počet testů, skutečné funkční i bezpečnostní podmínky a nezávislé review diffu.

## Rozsah a výsledek

🧪 Všech 214 testů v pěti přidělených souborech je zelených, exit 0. Původní běh měl rovněž 214 případů. Definice testů ani parametrizované řádky nebyly odstraněny; žádný skip, baseline či změna konfigurace. Počty: idle 43, session 12, recording 68, feedback 29, settings 62.

Tento commit vlastní pouze uvedené testy a tento záznam. Produkční opravy koordinátora `2d26ba7` byly do izolovaného worktree převzaty jen pro ověření. Nejsou součástí migračního diffu.

🟡 Nezávislé převzetí diffu a celkové gates provádí koordinátor. ⛔ Tento běh nedokládá fyzický zvuk, skutečný Electron ani vizuální přejímku F na Macu.

## Přesná mapa původní podmínky → F

| Soubor / původní kompozice | Nová aserce a zachovaná podmínka |
|---|---|
| `idle-panel`: `.panel-scroll`, LuTrack jako velká karta před nahráváním | Domovská sekce F obsahuje nahrávání před náhledem schůzek a neaktivním řádkem `.osa-lutrack`; řádek má `aria-disabled=true` a žádné ovládání. LuTrack příkazy stále nesmějí vytvořit běžící čas. |
| `.panel-header small` a jméno v hlavičce | `.osa-auth-status[data-auth-state]` stále prokazuje autoritativní session, skutečné jméno/e-mail se testují v účtu otevřeném přes F rail. `getAuthIdentity` fixture odpovídá ověřené OAuth identitě; localStorage sama zůstává nedostatečná. |
| Automatické přesměrování při session `none` | F zachová místní režim a výslovné tlačítko Přihlásit se. Test klikne na skutečný ovladač a pak zachová původní přihlašovací/OAuth aserce, stale response ochranu, focus a auth cancel podmínky. Stav `checking` nenaznačuje přihlášení, místní recording ovladač zůstává dostupný. |
| Footer `queue-status` se slovy počtu | Rail nese skutečný celkový počet. Podrobné čekání, vlastník, objemy, retry termíny a důvody se ověřují v reálné `QueueCard` po otevření Odesílání. Přesné čekání na vlastníka zůstává oddělené od běžného čekání; test background pumpy zvlášť ověřuje změnu na lidské potvrzení při stejném celkovém počtu. Čisté testy `queueFooterStatus` zůstaly beze změny. |
| Automatické sbalení fronty při obnovení položky po úspěšném retry | F zachová stránku queue. Test ověřuje skutečně obnovený počet i waiting summary, aktivní stránku a skutečný návrat rail ovladačem na home, kde je queue karta odstraněná a nahrávání dostupné. Retry výsledky, neúspěšné důvody, další čtení a stale snapshot ochrany zůstaly. |
| Dynamické Astra výšky 336/493/402, počáteční 700 | Přesná hlášená výška F 660; geometrická fixture stále modeluje intrinsic obsah podle skutečného CSS a DOM. Navíc počítá skutečnou hlavičku 48 px a vertikální padding 36 px. Přesná potřebná výška 420/577/486, workspace 612 a `overflowY=auto`; akce se musí vejít do viewportu a report musí odpovídat přesnému F viewportu. Vnější výška se při auth waiting nesmí měnit, nový obsah se musí objevit. Test zachování scroll pozice při mutation zůstává. JSDOM nemá fyzický layout engine. |
| `recording-card`: otevření dne/nastavení do okna, souběžná rozbalená fronta | Rail otevírá skutečné stránky library/settings v panelu; 30. důvod fronty je stále dostupný a navigace nic nenahrává. Test 400px pracovní plochy stále kontroluje obě uložené akce uvnitř 366px dostupného panelu, jen měří `.osa-shell` a skutečný přechod queue → home → queue. |
| Expirace / ztráta session během recording | Zachována stejná instance RecordingCard, skutečný Stop, finish a lokální export se stejným payloadem. Navíc se explicitně otevře queue po expiraci: retry není dostupný a live-strip Stop zůstává aktivní. Po návratu home se uloží lokálně; Uložit a odeslat nesmí být dostupné. |
| `renderer-failure-feedback`: starý footer alert a „Vše odesláno“ | F `.osa-queue-unavailable[role=status]` přesně oznamuje neověřený počet. Po obnově musí tento prvek zmizet. Prázdná fronta nemá varování ani queue kartu a náhled říká „Zatím tu nejsou schůzky“. Malformed a odmítnuté čtení nejsou prezentovány jako úspěch. |
| `settings`: tab Nahrávky mezi pěti sekcemi | Pět skutečných sekcí je Účet, Zvuk, Ukládání, Zařízení, Diagnostika. Historie je cíl day mimo nastavení; test převzetí stále předává přesné ID a revizi a ověřuje počet obnovení dat. Přímý vstup recordingQueue stále prokazuje skutečnou viditelnou historii a odmítnutí neznámého cíle. Zachovány systémové boolean IPC, retence, prostředí/origin, payload a závody identity. Embedded F sekce se kontrolují také přes App navigaci v recording testu. |

## Odhalené produkční chyby

Migrace nepřekryla dva skutečné regrese: při návratu retry s prázdným `items` mizel důvod selhání; dlouhý F panel neměl omezeného scroll vlastníka. Koordinátor opravil produkci v `2d26ba7`. Původní funkční podmínky pak prošly: důvod zůstává skutečným alertem i bez queue karty, `.osa-workspace` je scrollovatelný a omezený výškou viewportu.

Automatická kontrola odmítla první návrh pouhého přepsání geometrických očekávání a změny null/non-null. Návrh nebyl proveden. Po doložení výslovného souhlasu a zpřesnění návrhu prošla silnější F fixture s přesnou výškou, měřeným obsahem, hlavičkou, paddingem, scroll vlastníkem a skutečným návratem navigace. Žádná výjimka brány nevznikla.

## Doslovný akceptační příkaz a výpis

Pracovní adresář: `/Users/dev_ludone/Dev/ludone-desktop/.claude/worktrees/osa-tests-f`.

```sh
/Users/dev_ludone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run tests/idle-panel.test.js tests/session-reentry.test.js tests/recording-card.test.js tests/renderer-failure-feedback.test.js tests/settings.test.js --reporter=dot
```

```text

 RUN  v4.1.11 /Users/dev_ludone/Dev/ludone-desktop/.claude/worktrees/osa-tests-f

······················································································································································································································

 Test Files  5 passed (5)
      Tests  214 passed (214)
   Start at  16:46:06
   Duration  3.34s (transform 921ms, setup 47ms, import 2.65s, tests 8.72s, environment 0ms)


EXIT_CODE=0
```

Samostatně `git diff --check`: exit 0, bez výstupu.
