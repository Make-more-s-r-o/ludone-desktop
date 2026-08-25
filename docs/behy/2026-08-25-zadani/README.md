# Zadání a review z běhu 25. 8. 2026

Tohle je **archiv toho, co se Codexu doopravdy poslalo** při běhu podle
[`../2026-08-24-zaklad-a-fronta.md`](../2026-08-24-zaklad-a-fronta.md). Ne převyprávění —
doslovné soubory, které dostal na vstupu. Běh dokončil všech osm etap a dvě opravná kola.

Uloženo proto, že příští běh nemá začínat od prázdné stránky. Briéf říká **co** se má
udělat; tyhle soubory ukazují, **jak to napsat, aby to vykonavatel udělal správně**.

## Co je co

| Soubor | K čemu byl |
|---|---|
| `_spolecne.md` | pravidla, která platí pro každou etapu — předávalo se ke každému zadání |
| `E*-zadani.md` | jedna etapa = jeden soubor, devět povinných bodů |
| `F1-zadani.md`, `F2-zadani.md` | dvě opravná kola po nezávislém review |
| `_review-spolecne.md` | pravidla pro nezávislého skeptika |
| `R-*-review.md` | tři zadání pro nezávislé review |

`E1-zadani.md` a `E8-zadani.md` tu nejsou — vznikly v předchozí session a ta je psala
do svého scratchpadu, který už neexistuje. Jejich výsledek v repu je (`AGENTS.md`,
`dukazy/`, `docs/server-modul/`), zadání ne.

## Co se na těchhle zadáních osvědčilo

- **Vlastnictví jako VÝČET CEST, ne zákaz v próze** — a uvnitř sdíleného souboru
  ještě **vlastnictví bloku** („smíš `permission:request`, nic jiného"). Tři etapy psaly
  souběžně do `electron/main.cjs` ze tří worktrees a **všechny čtyři merge proběhly bez
  jediného konfliktu**.
- **Sekce „Pořadí kroků" s větou „nejdřív soubory na disk, pak testy, teprve potom
  odpověď"** — bez ní umí vykonavatel vrátit vyplněný output contract a nenapsat nic.
- **Kontrolní číslo, které MUSÍ vyjít nula** (`zmenenychSouboruMimoVlastnictvi`,
  `vyskytuGrantedTrue`, `tvrzeniOOdesilaniNahravek`) vedle čísla, které **musí být větší
  než nula** (`novychTestu`). Vykonavatel si je musí spočítat, čímž si sám nastaví past.
- **Vyjmenované případy, na kterých má test zčervenat** — včetně těch, které mají zůstat
  zelené. Obecné „napiš pořádné testy" dá testy, které nic nehlídají.
- **Požadavek na RED/GREEN důkaz** u testů, o kterých se dá pochybovat, že něco měří:
  dočasně nasadit mutanta, ukázat, že test spadne, vrátit, a **oba výpisy dát do odpovědi**.
  Odhalilo to dva testy, které vypadaly silně a nehlídaly nic.

## Co se na nich NEosvědčilo — a je to v nich pořád vidět

🔴 **Zadání E3 vyrobilo fail-open bránu.** Stojí v něm *„`plutil` a `codesign` dej za
podmínku, že bundle existuje"* — a výsledkem byla brána, která nad **neexistujícím**
bundlem vypsala **2× PASS a EXIT=0**. Chybějící artefakt hlásila jako úspěch.
Kdo z těchhle souborů opisuje, ať tuhle větu **neopisuje**: chybějící artefakt musí být
FAIL, přeskočená kontrola SKIP, který se nepočítá mezi úspěchy.

🔴 **Sdílené názvy dočasných souborů.** Všechna zadání psala do `/tmp/g.out`, takže si
souběžné etapy výpisy navzájem přepsaly. Jedna si toho všimla a zapsala to; ostatní ne.
Dávej každé etapě vlastní předponu (`/tmp/e3-*`).

Obojí našlo až **nezávislé review** — a našlo to jen proto, že dostalo za cíl **celý diff
včetně toho, co zadal orchestrátor**, ne „Codexovu část".
