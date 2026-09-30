---
kind: deploy
ref: v0.1.7 / a149a55c702077a657a9123274e5129d9fe18039
verdict: "✅ ověřeno naostro"
measuredAt: 2026-09-30T19:52:31.982Z
scope:
  - podpis, notarizace a publikace obou variant macOS aplikace
  - veřejný aktualizační feed a dostupnost instalaček
measuredFrom:
  - skutečné podpisové a publikační kroky GitHub workflow 36767124908
  - nezávislé HTTPS GET feedu a HEAD osmi souborů po publikaci
---

# Vydání LuDone Desktop 0.1.7

✅ Verze **0.1.7** je podepsaná, notarizovaná a zveřejněná na stahnout.ludone.cz/desktop/. [PR #158](https://github.com/Make-more-s-r-o/ludone-desktop/pull/158) je sloučený v `a149a55c702077a657a9123274e5129d9fe18039`; nový neměnný tag `v0.1.7` míří na tento commit. [Release workflow](https://github.com/Make-more-s-r-o/ludone-desktop/actions/runs/36767124908) je SUCCESS.

🧪 Finální kandidát `2bf1da4` má 1 654 PASS a 3 původní skipy, 35 hlavních Electron podmínek, 18 stavů a 41 produktových cest ve dvou velikostech okna. Merge má stejný strom jako finální kandidát s archivní dokumentací `445493f`; další dokumentační commity nemění produkt ani publikovaný tag. [Akceptace](../acceptance-0-1-7-2026-09-30/README.md) a [zelené CI](https://github.com/Make-more-s-r-o/ludone-desktop/actions/runs/36766593432) před sloučením.

## Skutečně ověřená publikace

- ✅ Podepisovací krok ověřil obě DMG, vložené aplikace a oba ZIP včetně architektury, podpisu, notarizace a přibaleného encoderu. PASS se čtou výhradně ze skutečného podpisového kroku, nikoli z unit fixture.
- ✅ Před publikací je sada podepsaných artefaktů archivovaná v GitHub Actions: ID11121542823, digest `e1b9ac7f002f4c90f8d7792f0211c571196c1999d39e17508f0caa0ad1ab8ae3`, retence 30 dní. Trvalé provozní důkazy jsou zde.
- ✅ Server ověřil SHA256 souborů; feed zveřejnil jako poslední atomickým rename. Právě vydané verzované soubory ani tag se nepřepisovaly.
- ✅ Workflow porovnalo přesné bajty/hash veřejného feedu a velikosti všech osmi souborů s místními ověřenými artefakty. Nezávislý GET vrátil feed 0.1.7; všech osm HEAD má HTTP200 a čtyři instalačky mají velikost shodnou s feedem.

[Doslovný výpis a exit0](public-verification-command.txt) · [veřejné výsledky](public-verification.json) · [feed](published-latest-mac.yml) · [celý release log](release-log.txt) · [stav běhu](release-run.json) · [artefakt](release-artifacts.json) · [identita tagu](tag-identity.json).

## Výsledek pro používání

Panel staví nahrávání první a LuTrack zůstává malý neaktivní řádek. Můj den seskupuje historii a detail ukazuje skutečný lokální/serverový stav. Nastavení si pamatuje výchozí firmu. Před odesláním má každá nahrávka vlastní firmu a **Soukromá / Sdílená ve firmě**; pouhé uložení voleb nic neodesílá. Nové nahrávky začínají firemní, historické soukromí a již zahájené uploady se nepřepínají. Jeden výsledný stereo WebM/Opus pro schůzku zůstává zachovaný.

🟡 Skutečný mikrofon/systémový zvuk, produkční OAuth/upload z Finderu a instalace aktualizace čekají na člověka podle [krátké Mac přejímky](../../MAC-PREJIMKA.md). Zelené E2E používají syntetická média či fixture; jejich výsledek má pouze 🧪. Nezávislá veřejná kontrola nestahovala celé binárky a sama neověřovala jejich podpis, ten dokládá macOS verifier ve workflow.

## Úklid a návrat zpět

Unikátní důkazy workerů byly před odstraněním devíti vlastních čistých worktree verzované; původní commity zůstaly v lokálních refs/archive. [Záznam úklidu](worker-cleanup.json). Cizí design worktree zůstal nedotčený; backend ani aktivní LuTrack se neměnily.

Při zásadní regresi zachovat místní nahrávky a zastavit další rollout. Podepsané 0.1.6 instalačky zůstávají dostupné pod původními verzovanými názvy; případný návrat provést bez smazání userData. Předpublikační feed 0.1.6 je archivovaný. Žádný rollback zde neproběhl; další opravu vydat novým tagem.
