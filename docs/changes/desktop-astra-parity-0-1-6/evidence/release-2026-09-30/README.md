---
kind: deploy
ref: v0.1.6 / ba0adfe50eae12cf1d3dcb81e6b851ef351237d2
verdict: "✅ ověřeno naostro"
measuredAt: 2026-09-30T00:31:50.187835+00:00
scope:
  - podpis, notarizace a publikace instalaček pro arm64 a x64
  - veřejný aktualizační feed a dostupnost balíčků
measuredFrom:
  - GitHub macOS workflow 36649506694 a konkrétní podpisové i publikační kroky
  - nezávislé veřejné HTTPS GET a HEAD po publikaci
---

# Vydání LuDone Desktop 0.1.6

✅ Podepsané a notarizované vydání je zveřejněné na stahnout.ludone.cz/desktop/. Tag `v0.1.6` míří na merge commit `ba0adfe50eae12cf1d3dcb81e6b851ef351237d2`; anotovaný objekt `239acfcb0efd4801e4eb2ff78dee5cf8f724d063`. [Release workflow](https://github.com/Make-more-s-r-o/ludone-desktop/actions/runs/36649506694) je SUCCESS. Podepsaný artefakt je v GitHub Actions archivovaný 30 dní; zde je trvalý provozní důkaz.

- 🧪 Release gates: 78 souborů, 1 582 PASS, 3 původní skipy. CI opravy d4428a1 také SUCCESS ([36649216434](https://github.com/Make-more-s-r-o/ludone-desktop/actions/runs/36649216434)).
- ✅ Skutečný krok podpisu ověřil obě DMG a oba ZIP, architektury, podpis/notarizaci a přibalený encoder. Nestačí stejně pojmenované PASS z unit fixture; kontrolní skript filtruje konkrétní skutečný podpisový krok.
- ✅ Server před zpřístupněním zkontroloval SHA256 všech devíti souborů; feed zveřejnil jako poslední atomickým rename. Existující verzované soubory se nesmějí přepsat jinými bajty.
- ✅ Veřejný GET feedu vrací 0.1.6 a nové poznámky Astra. HEAD všech osmi balíčků/blockmap vrací HTTP200, čtyři balíčky mají velikost shodnou s feedem. Workflow navíc porovnalo přesné lokální bajty/hash feedu a všech osm velikostí.

[Doslovný příkaz a exit 0](public-verification-command.txt) · [veřejné výsledky](public-verification.json) · [feed](published-latest-mac.yml) · [celý workflow log](release-log.txt) · [stav běhu](release-run.json).

## Obnova původního nevydaného tagu

První run 36645632382 byl canceled před podpisem, notarizací, archivem a publikací. Před obnovou feed ukazoval 0.1.5 a všechny čtyři instalačky 0.1.6 měly HTTP404 (`before-recovery-proof.json`). Starý objekt bc749378626eb01a2cf3bbd6e8a36f2d7bfe6ea6 je zachovaný v lokálním refs/archive a textovém důkazu. Po zeleném CI a sloučení PR154 byl remote tag změněn přes přesný force-with-lease, nikoli slepý force. Doslovný push a mapování jsou archivované. Nově publikovaný tag ani artefakty se již nepřepisují.

## Proč to není chyba měřidla

Zdrojový commit je svázaný s workflow headSha i tagem. Publikační SHA256 a podpisové PASS se berou ze skutečných příslušných kroků, nikoli unit testových fixture. Veřejné GET/HEAD běží odděleně od SSH přenosu; samotný green build či existence tagu by nestačily. Nezávislá kontrola nestahovala celé veřejné binárky a sama neověřovala jejich podpis; ten dokládá uložený macOS verifier log.

## Co čeká a návrat zpět

🟡 Skutečný mikrofon, systémový zvuk, oprávnění, přihlášení a upload z Finderu i instalace aktualizace čekají na Dana podle [Mac přejímky](../../MAC-PREJIMKA.md). Žádné syntetické E2E nedokládá fyzický zvuk. LuTrack je neaktivní. Backend ani app.ludone.cz se neměnily.

Při zásadní regresi zastavit další rollout a zachovat místní nahrávky; poslední podepsané 0.1.5 balíčky zůstávají dostupné pod původními verzovanými názvy. Případný návrat provést instalací předchozí verze, bez smazání userData; další opravu vydat novým tagem. Archivovaný předchozí feed slouží provoznímu rollbacku, žádný rollback zde nebyl proveden.
