---
kind: deploy
ref: 28a6563f9ceb533f5ddad41c20f808ee0c4edde8
verdict: verified-live
measuredAt: 2026-09-15T08:53:58.446Z
scope:
  - desktop-release-0.1.3
measuredFrom:
  - release-run.json
  - release-run.log
  - public-check.json
  - public-check.log
  - latest-mac.yml
---

# Vydání LuDone Desktop 0.1.3

✅ **Publikace ověřena naostro**. Dan výslovně pověřil koordinátora: „Ano, vydej
0.1.3 sám“ (D19). Tag `v0.1.3` ukazuje na již sloučený a CI ověřený commit
`28a6563f9ceb533f5ddad41c20f808ee0c4edde8`.

[Release 34948618429](https://github.com/Make-more-s-r-o/ludone-desktop/actions/runs/34948618429)
je COMPLETED/SUCCESS, dokončený 2026-09-15T08:52:44Z. `gh run watch --exit-status`
vrátil exit 0. Workflow prošel společnými branami, skutečným Developer ID podpisem,
notarizací a ověřením DMG i ZIP pro arm64 a x64, archivací, SSH publikací a veřejnou
HTTPS kontrolou. Podpisové důkazy pocházejí z kroku „Podepsání, notarizace a ověření
DMG + ZIP“; stejně pojmenované PASS výpisy uvnitř unit testů nejsou důkaz podpisu.

Aktualizační feed je [latest-mac.yml](https://stahnout.ludone.cz/desktop/latest-mac.yml).
Workflow ověřil přesnou shodu veřejného feedu a velikostí souborů s vydanými artefakty.
Root následně nezávisle načetl veřejný feed, ověřil verzi **0.1.3**, přesný text
`build/release-notes.md`, úplnou sadu balíčků, HEAD **HTTP 200** všech osmi souborů
a velikosti čtyř balíčků proti metadatům. Celý výpis s jednotlivými PASS a
**COMMAND_EXIT_CODE=0** je v `public-check.log`; vstupy a strojové výsledky jsou
archivované vedle něj. Nezávislá kontrola z Macu znovu nestahovala celé binární balíčky.

## Co změna doručuje

- Retry vlastní schválené nahrávky pozastavené kvůli nevybrané firmě.
- Automatickou kontrolu a stažení aktualizací, proužek se skutečnými novinkami,
  jedno oznámení macOS na verzi a ruční kontrolu.
- Instalaci po potvrzení konkrétní zobrazené verze, možnost odložit a zachované
  bariéry nahrávání, ukládání, fronty a časovače.

## Proč to není chyba měřidla

První pozorovací bod je skutečný runner s podpisem, notarizací a veřejnou kontrolou
proti místním hashům a velikostem. Druhý je samostatný veřejný HTTPS průchod z Macu,
se shodou čísla verze, poznámek a dostupnosti souborů. Na vydaný build se nenahlíží
jen přes zelené mocky. Existující brány ani release workflow se kvůli této publikaci
neupravovaly.

## Co zůstává neověřeno

⛔ Read-only kontrola Macu po publikaci stále ukázala nainstalovanou **0.1.2**
(`installed-version.txt`). Publikace není instalace. Živý produkční upload, kvalita
obou zvukových stop a skutečné oznámení macOS tímto během ověřené nejsou.
Přechod 0.1.2 → 0.1.3 používá starý updater; nový souhlas s instalací se naostro ověří
při dalším schváleném vydání z již nainstalované 0.1.3. [Postup na Macu](../../docs/changes/nahravky-dashboard/OVERENI-NA-MACU.md).

`premisaPlatila: true`. `kontrolniNula`: 0 změn backendu/LuTracku/designu,
0 nových nebo rozšířených přístupů, 0 produkčních uploadů a 0 provedených audio-smoke.
