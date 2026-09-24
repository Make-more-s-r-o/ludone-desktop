---
kind: deploy
ref: v0.1.5-candidate
verdict: partial
measuredAt: 2026-09-24T00:59:06Z
scope: [macOS-app, updater-feed, stahnout.ludone.cz]
measuredFrom:
  - "package.json, .github/workflows/release-macos.yml a ověřovací testy releasu"
  - "Lokální npm run gates a npm run build; evidence/tests/npm-gates.log a npm-build.log"
---

# Příprava vydání 0.1.5

## Stav

Kandidát je připraven lokálně jako `0.1.5`; produkční renderer se sestaví a projektové
brány prošly. Podepsaný balíček, notarizace, aktualizační metadata ani soubory na
`stahnout.ludone.cz` zatím nebyly vytvořeny ani zveřejněny. Větev byla pushnuta v commitech
`434d893` a `69ce81f` a PR [#149](https://github.com/Make-more-s-r-o/ludone-desktop/pull/149)
je otevřený, čistě slučitelný a jeho CI kontrola `gates` prošla za 1 min 37 s. Podepsané
vydání workflow se spustí až po merge.

Workflow už zahrnuje přípravu encoderu, podpis, notarizaci, nahrání instalačních souborů
a zveřejnění feedu jako posledního kroku. Tajemství nejsou v repozitáři ani v tomto
dokumentu. Veřejný výsledek se smí označit za vydaný až po úspěchu workflow a read-only
ověření feedu a obou architektur.

## Čeká

- Sloučit čistě slučitelný PR #149 po zeleném GitHub CI.
- Po oprávněném merge vytvořit tag `v0.1.5` a sledovat podepsané vydávací workflow.
- Zkontrolovat veřejná metadata a instalační soubory; nevyvozovat jejich existenci z
  konfigurace workflow.
- Na Danově Macu provést postup z [`../../OVERENI-NA-MACU.md`](../../OVERENI-NA-MACU.md):
  aktualizační proužek a oznámení, odložení, ruční instalace, vstup do Nahrávek, stereo
  záznam a ověření jediného záznamu na webu.

## Lokální omezení

Živý náhled přes Orca se nepodařilo otevřít: `orca computer capabilities --json` vrátil
`runtime_unavailable` a „Could not connect to the running Orca app. Restart Orca and try
again.“ Tento výsledek nic neříká o podepsaném vydání ani o veřejném feedu.
