---
kind: review
ref: v0.1.5
verdict: partial
measuredAt: 2026-09-24T01:25:10Z
scope: [desktop-shell, settings-navigation, tray-icons, lutrack-placeholder, release]
measuredFrom:
  - "Diff a repozitář na merge commitu 46b313cc9a270f321e9c81b9cd8d61a7c06f7f9f"
  - "Nezávislé review agenta review_v015 a následná kontrola opravených míst"
  - "npm run gates, npm run build, GitHub workflow 35941431564 a veřejná HTTP kontrola feedu"
---

# Review LuDone Desktop 0.1.5

## Výsledek

Implementace odpovídá schválenému směru Astra. Nezávislá kontrola našla závod při předání
záložky Nastavení a možný duplicitní vstup do Nastavení; obojí bylo opraveno. Plné brány,
produkční build a GitHub CI prošly. PR #149 je sloučen a podepsané/notarizované vydání 0.1.5
je dostupné na `stahnout.ludone.cz`; veřejný feed a soubory obou architektur byly
nezávisle ověřeny.

Celkové review zůstává `partial`: běžící UI, instalaci, systémový zvuk a upload musí ještě
pozorovat člověk na Danově Macu. Samostatná historická sonda E5 také zaznamenala jeden fail
kvůli rozporu s později schváleným chováním Finderu. Úspěch publikace se nevydává za
přejímku aplikace po instalaci.

Vydání je doloženo samostatně v [`../release/release.md`](../release/release.md).
Distribuční cesta je web projektu; workflow nezakládá GitHub Release stránku.

## Osm review průchodů

1. **Správnost:** Panel otevře skutečnou záložku Nahrávky i v již otevřeném okně. Preload
   bezpečně podrží platný požadavek, který dorazí před přihlášením React odběratele. Test
   tohoto pořadí je v `tests/queue-wiring.test.js`.
2. **Bezpečnost a oprávnění:** Hlavní proces přijímá jen `account` a `recordingQueue`;
   preload používá stejný allowlist. Okno nadále používá `#settings`, takže se nemění
   existující kontrola oprávnění systémového zvuku. Nezávislý reviewer nenašel změnu
   sender guardu ani upload souhlasu.
3. **Doménové invarianty:** LuTrack neměří ani neposílá čas; jeho ovládání v panelu, menu
   ikony a zkratce je vypnuté. Nahrávání zůstává dostupné a serverový dashboard ani fronta
   se touto změnou nemění.
4. **Intent a specifikace:** Implementace používá vybraný Astra směr, zachovává Astra i
   Opus prototypy a připravuje LuTrack pouze jako budoucí návrh. Neobsahuje backend, server
   ani produkční integraci LuTracku.
5. **Plán a architektura:** Záložka je předána buď allowlistovaným parametrem URL, nebo
   validovaným IPC do existujícího okna. Nevzniká nové okno pro každou záložku ani další
   cesta kolem hash oprávnění.
6. **Schválený design:** Hlavní panel používá sdílenou značku LuDone Desktop a vybraný
   klidový panel. Stavové ikony lišty navazují na vybraný Opus motiv, jak Dan výslovně
   požadoval. Kompletní HTML návrhy zůstávají uložené. Živý screenshot vydané aplikace
   po instalaci chybí, proto vizuální shodu označujeme 🟡 čekající.
7. **Kvalita důkazů:** `npm run gates`: 76 souborů, 1 557 testů PASS, 3 baseline skipy,
   exit 0. `npm run build`: 55 modulů, exit 0. PR CI prošlo. Podepsaný release workflow
   skončil úspěchem a samostatná kontrola potvrdila feed verze 0.1.5 i osm dostupných
   souborů. E5 samostatně: 7 PASS a 1 FAIL; viz [`../acceptance/E5.log`](../acceptance/E5.log).
   Skutečný zvuk, upload a instalace zůstávají čekající na fyzickém Macu.
8. **Pravdivost přehledu:** Distribuce je sloučená a zveřejněná. CI a HTTP HEAD se
   nevydávají za přejímku samotného UI. Orca runtime vrátil `runtime_unavailable`:
   „Could not connect to the running Orca app. Restart Orca and try again.“ Postup Mac
   přejímky zůstává v [`../../OVERENI-NA-MACU.md`](../../OVERENI-NA-MACU.md).

## E5: rozpor se schváleným D3/D11

E5 správně naměřila, že při chybějícím `DESKTOP_UPLOAD_ENABLED` produkční helper vrátí
`"true"`. To odpovídá současnému kódu a umožňuje výslovně schválené ruční odeslání z Finderu
bez shellových proměnných. Každá nová položka přesto začíná se souhlasem `held`; souhlas
`approved` vzniká až výslovnou akcí uživatele. D3 a D11 tento Finder scénář schvalují,
zatímco historická E5 sonda stále vyžaduje „chybějící proměnná = vypnuto“.

Brána ani upload kód se nezměnily. Toto vydání nemění upload/frontu a `npm run gates` E5
nespouští. Rozpor se zveřejňuje jako ⚠️ varování, ne jako zelený výsledek; před budoucí
změnou uploadu je potřeba sladit dokumentaci a akceptační očekávání.

## Proč to není chyba měřidla

- E5 spouští skutečné produkční tělo `queueKillswitches` nad izolovaným objektem `process`;
  selhává přesně při porovnání výchozí hodnoty s vlastním tvrzením fail-closed. Výpis je
  opakovatelné měření, ne grepový vedlejší účinek.
- Veřejný release se ověřil dvěma různými cestami: workflow dokončilo publikaci a read-only
  klient zvlášť stáhl metadata a zkontroloval HTTP hlavičky všech balíků.
- Nedostupný Orca runtime je pozorovaný stav lokálního nástroje, nikoli důkaz, že vydaná
  aplikace selhává nebo že její vzhled byl vizuálně přijat.
