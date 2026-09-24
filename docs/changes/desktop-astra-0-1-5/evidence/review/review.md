---
kind: review
ref: v0.1.5-candidate
verdict: partial
measuredAt: 2026-09-24T00:53:37Z
scope: [desktop-shell, settings-navigation, tray-icons, lutrack-placeholder, release-preparation]
measuredFrom:
  - "Koordinátorský diff proti origin/main v pracovním stromě feat/desktop-astra-next-v0-1-5"
  - "Nezávislé review agenta review_v015 a jeho následná kontrola opravených míst"
  - "npm run gates, npm run build a samostatná scripts/akceptace/E5.sh"
---

# Review LuDone Desktop 0.1.5

## Výsledek

Lokální implementace odpovídá schválenému zúženému směru Astra. Nezávislá kontrola našla
závod při předání záložky Nastavení a možný duplicitní vstup do Nastavení; obojí bylo
opraveno. Plné projektové brány a sestavení jsou zelené. Výsledek je `partial`, protože
živou vizuální kontrolu nešlo provést a samostatná historická E5 sonda skončila jedním
neúspěchem kvůli rozporu s později schváleným chováním Finderu.

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
   Opus prototypy a připravuje LuTrack jako návrh. Neobsahuje backend, server ani produkční
   integraci LuTracku.
5. **Plán a architektura:** Záložka je předána buď allowlistovaným parametrem URL, nebo
   validovaným IPC do existujícího okna. Nevzniká nové okno pro každou záložku ani další
   cesta kolem hash oprávnění.
6. **Schválený design:** Hlavní panel používá sdílenou značku LuDone Desktop a vybraný
   klidový panel. Stavové ikony lišty navazují na vybraný Opus motiv, jak Dan výslovně
   požadoval. Kompletní HTML návrhy zůstávají uložené pro pozdější změnu názoru.
7. **Kvalita důkazů:** `npm run gates` prošel: 76 souborů, 1 557 testů PASS, 3 baseline
   skipy, exit 0. `npm run build` prošel, 55 modulů, exit 0. Nezávislý reviewer po opravách
   ověřil 6 cílených souborů a 409 testů. E5 samostatně: 7 PASS a 1 FAIL; viz
   [`../acceptance/E5.log`](../acceptance/E5.log). Skutečný zvuk, upload a instalace
   zůstávají čekající na fyzickém Macu.
8. **Pravdivost přehledu:** Stav zůstává na `review_delivery`, nikoli `archive` nebo
   „Dodáno“. Vizuální screenshot běžící aplikace chybí. Orca runtime vrátil
   `runtime_unavailable`: „Could not connect to the running Orca app. Restart Orca and
   try again.“ Po aktualizaci stavu `mp-progress --check` potvrdil bajtovou shodu.

## E5: rozpor s rozhodnutím D3/D11

E5 správně naměřila, že při chybějícím `DESKTOP_UPLOAD_ENABLED` produkční helper vrátí
`"true"`. To odpovídá současnému kódu a umožňuje výslovně schválené ruční odeslání z Finderu
bez shellových proměnných. Každá nová položka přesto začíná se souhlasem `held`; souhlas
`approved` vzniká až výslovnou akcí uživatele. D3 a D11 tento Finder scénář schvalují,
zatímco historická E5 sonda stále vyžaduje „chybějící proměnná = vypnuto“.

Brána ani upload kód se nezměnily. Tento release nemění upload/frontu a `npm run gates`
E5 nespouští. Rozpor se zveřejňuje jako varování, ne jako zelený výsledek; před budoucí
změnou uploadu je potřeba sladit dokumentaci a akceptační očekávání.

## Proč to není chyba měřidla

E5 spouští skutečné produkční tělo `queueKillswitches` nad izolovaným objektem `process`;
selhává přesně při porovnání výchozí hodnoty s vlastním tvrzením fail-closed. Výpis je
opakovatelné měření, ne grepový vedlejší účinek. Rozpor vzniká mezi dvěma autoritativními
požadavky z různých etap: historickým R18/E5 a pozdějším výslovným D3/D11. Proto výsledek
zůstává viditelný a gate se neopravuje ani nepřeskakuje.

## Nezávislé review

Reviewer potvrdil opravy dvou nálezů; cílené ověření po opravách pokrylo 409 testů a
`git diff --check`. Přímé počítání tlačítek Nastavení je doplněno pro přihlášený hlavní
panel. Textová varianta se objeví jen během zachovaného aktivního ukládání při nedostupných
akcích relace; samostatná GUI reprodukce kvůli nedostupnému Orca runtime neproběhla.
