---
kind: deploy
ref: v0.1.5
verdict: pass
measuredAt: 2026-09-24T01:25:10Z
scope: [signed-notarized-macos-app, updater-feed, stahnout.ludone.cz]
measuredFrom:
  - "GitHub PR #149 and CI; merge commit 46b313cc9a270f321e9c81b9cd8d61a7c06f7f9f"
  - "GitHub release workflow run 35941431564 and its signed/notarized publish steps"
  - "Independent public GET/HEAD checks saved in public-feed-independent.log"
---

# Vydání LuDone Desktop 0.1.5

## Co bylo zveřejněno

PR [#149](https://github.com/Make-more-s-r-o/ludone-desktop/pull/149) byl sloučen 24. 9.
2026 v 01:04 UTC do commitu `46b313cc9a270f321e9c81b9cd8d61a7c06f7f9f`. Jeho CI brána
[`gates`](https://github.com/Make-more-s-r-o/ludone-desktop/actions/runs/35941107885/job/107448948101)
prošla. Tag `v0.1.5` míří na tento commit a spustil podepsaný macOS workflow
[35941431564](https://github.com/Make-more-s-r-o/ludone-desktop/actions/runs/35941431564),
který skončil úspěchem v 01:16 UTC.

Workflow úspěšně sestavil Opus nástroj pro arm64 i x64, ověřil konfiguraci vydání,
spustil `npm run gates`, podepsal a notarizoval DMG i ZIP pro oba typy Macu, před publikací
archivoval artefakty, nahrál je na `stahnout.ludone.cz` a dokončil vlastní ověření veřejného
feedu a souborů. Distribuce probíhá přes web projektu; GitHub Release stránka se nevytváří.

## Nezávislá kontrola veřejného výsledku

Opakovaná read-only kontrola veřejného webu stáhla
[`latest-mac.yml`](https://stahnout.ludone.cz/desktop/latest-mac.yml), obdržela HTTP 200,
verzi `0.1.5` a 1 278 bajtů. HEAD požadavky pro všech osm DMG/ZIP a jejich blockmap souborů
pro arm64 i x64 vrátily HTTP 200 a kladnou délku. Doslovný výstup včetně exit kódu je v
[`public-feed-independent.log`](public-feed-independent.log).

## Proč to není chyba měřidla

- Workflow zaznamenalo úspěšné podepsání a notarizaci před nahráním, následované vlastním
  ověřovacím krokem veřejného feedu.
- Nezávislá přímá HTTP sonda zkontrolovala stejnou živou distribuci zvlášť a ověřila
  metadata i každý artefakt pro obě architektury; nejde pouze o zelenou CI nebo konfiguraci.

## Co zůstává čekající

Tento důkaz potvrzuje publikaci a dostupnost instalačních souborů. Neprokazuje, že Danova
aplikace zobrazila proužek či oznámení, že se ruční aktualizace nainstalovala, ani že na jeho
Macu funguje skutečný záznam a upload. Tyto kroky zůstávají 🟡 a jsou popsané v
[`../../OVERENI-NA-MACU.md`](../../OVERENI-NA-MACU.md). Automatické testy ani veřejná dostupnost
balíku je nenahrazují.

## Co s tím

- **Další krok:** Dan projde krátkou přejímku na Macu po aktualizaci na 0.1.5.
- **Vlastník:** Dan; aplikace a vydání jsou připravené.
- **Ověření nápravy:** zaznamenat přesný výsledek aktualizace, jednoho stereo záznamu,
  jednoho serverového záznamu a přepisu.
