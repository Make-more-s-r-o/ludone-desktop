# Checkpoint nočního běhu

**PŘEPISUJE se po každé vlně, neroste.** Pojistka proti compaction: kdo to čte s prázdným
kontextem, musí pokračovat, aniž by se ptal. Zadání: [`BEH-NOC.md`](BEH-NOC.md).

**Poslední zápis: 2. 9. 2026 — VLNA 5 po obnovení limitů.**

🔴 **Režim od 23:15 (Dan): NEPTAT SE.** Bezpečné vratné defaulty rozhodni a zapiš do
`decisions.md`. Hard gate (produkce, DB, Tabidoo, killswitch, money/RBAC/design) fail-closed:
přeskoč **jen dotčený task**, zapiš blocker, jeď dál. Celý běh nezastavuj, dokud je bezpečná
práce. Mechanika Codex, Claude koordinace a review.

---

## Vlna `5` — po obnovení limitů

| Story | PR | CI | Testy (měřil jsem já, před rourou) | Stav |
|---|---|---|---|---|
| **B1** `ui-smoke` | [#2](https://github.com/Make-more-s-r-o/ludone-desktop/pull/2) | 🟢 | 77/77 | hotovo |
| **B4** tři vady přihlášení | [#3](https://github.com/Make-more-s-r-o/ludone-desktop/pull/3) | 🟢 | 86/86 | hotovo, **P0 z review opraveno** |
| **B3** autorita tray | [#4](https://github.com/Make-more-s-r-o/ludone-desktop/pull/4) | 🟢 | 113/113 | hotovo, **3 kola oprav** |
| **B8** zapojit auth | [#5](https://github.com/Make-more-s-r-o/ludone-desktop/pull/5) *(nad b4)* | 🟢 | 117/117 | hotovo |
| **B5** časovač do main | [#6](https://github.com/Make-more-s-r-o/ludone-desktop/pull/6) *(nad b3)* | ⏳ | 159/159 | hotovo |
| **B7** fronta | [#7](https://github.com/Make-more-s-r-o/ludone-desktop/pull/7) *(nad b5)* | ⏳ | 186/186 (26 nových) | hotovo |
| **B9** odhlášení | [#8](https://github.com/Make-more-s-r-o/ludone-desktop/pull/8) *(nad b8)* | ⏳ | 134/134 (17 nových) | hotovo, 🔴 **race NEOPRAVENA**, BD-N14 |
| **B6** výběr projektu | — | — | — | 🛑 **STOP**, viz BD-N12 |
| **B10** sdílené zařízení | — | — | — | 🛑 **návrh napsán**, stavba čeká na Dana |
| **B11** retence | [#9](https://github.com/Make-more-s-r-o/ludone-desktop/pull/9) *(nad b7)* | ⏳ | 201/201 (13+2 nových) | hotovo |

🔴 **Žádná netvrdí `verified-live`.** Vše je 🧪, ne ✅.

## Běží

| Co | Log | Konec |
|---|---|---|
| Codex **B9b** bezpečnost odhlášení | `/tmp/beh-noc/b9b-codex.log` | hlídač na pozadí |
| Workflow **review druhé vlny** | 5 čoček nad b5/b7/b8/b9/b11 | task `ws42r5dai`, ozve se samo |

🔴 Log bez pohybu 20 min = mrtvý job. Práce bývá na disku — `git status` ve worktree.
🔴 **Po doběhnutí COMMITNI HNED**, teprve pak brány a sabotáže.
🔴 **Celý stoh je srovnaný** (02:10): b4 nad main, b8 nad b4, b9 nad b8; b5 nad b3, b7 nad b5,
b11 nad b7. Po převzetí B11 ji přebasovat na aktuální b7.
🔴 **Při rebase stohu uveď STAROU špičku výslovně** (`git rebase --onto <nova> <stara-spicka>`)
— po přebasování rodiče už jeho stará špička není předkem a `merge-base` vrátí bod, ze kterého
se přehraje i cizí commit. Konflikt „add/add" v testech bývá „oba přidali blok na konec"
⇒ nechat OBĚ sady.

## 🛑 Zastavené s blockerem (jen dotčený task, běh jede dál)

| Co | Proč | Kde |
|---|---|---|
| **B6** | `spec.md` R7 („nad 110 % **zašedlý**") a `plan.md:147` („**není v nabídce**") si odporují — **money pravidlo, hard gate** | BD-N12 |
| **B10** | přiřazení nahrávky člověku je **RBAC**, a nikdo neověřil, že účet `zasedacka@` existuje | `B10-navrh-sdilene-zarizeni.md` |
| **B2** | 377 odkazů, `LUDONE_E2E` obsahuje `E2`, markery v produkčním kódu | BD-N1 |
| **B12** | živá DB 24 lidí | `BEH-NOC.md` |
| **B13** kalendář | design ho ruší, `ui-smoke` ho vyžaduje — user-visible změna bez packetu | O14 |
| pátý stav tray | ikony ve **zmrazené T1** | BD-N5 |

## Čeká na Dana

1. 🔴 **Oprávnění Nahrávání obrazovky** pro `release/LuDone Desktop.app` — bez něj `ui-smoke`
   nedojede do zelené a sabotáže zvukové brány nedoběhnou.
2. 🔴 **Statický OAuth klient na serveru** → `LUDONE_OAUTH_CLIENT_ID`. Bez něj se přihlášení
   naostro **ani nepokusí** — záměr BD-N6.
3. **B6:** který zmrazený text vyhrává (doporučuju `spec.md` R7).
4. **B10:** existuje `zasedacka@makemore.cz`? A volný text, nebo výběr ze seznamu?

## Rozhodnutí koordinátora (všechna v `decisions.md`)

BD-N6 statická registrace fail-closed · BD-N7 `LUDONE_ORIGIN` · BD-N8 kontrakt
`tray:report-facts` (dočasný) · BD-N10 `LUDONE_OAUTH_CLIENT_ID` · BD-N11 kolize logů
`orca-codex.sh` · BD-N12 B6 stop · BD-N13 dva neopravené nálezy review

## Worktrees

`desktop-b1/b3/b4/b5/b8` = větve otevřených PR · `desktop-b6` = zastavená · `desktop-b7/b9`
= Codex píše. Všechny mají `node_modules` jako **symlink**.
🔴 **V hlavním checkoutu NIKDY `git add -A`** — je v něm i souběžná session.

## 🔴 Co se tenhle běh naučil (nejcennější výstup noci)

Všechno je jedna třída: **brána, která nic nenajde, není zelená — je nezměřená.**

1. **„Umí to rozhodnout správně" ≠ „zeptá se toho někdo?"** B3: správné odvození, 92 zelených
   testů, a lišta by nahrávání neukázala nikdy. Testy chování si obsluhu volaly samy.
2. **Kritérium „nic se nestalo" má víc příčin.** B1: `disabled === 2` procházelo i tehdy,
   když systém oprávnění **odepřel** (`granted:0, disabled:2`).
3. **Spouští test produkční cestu, nebo tu podstrčenou?** B5: konstantní klíč proti duplikaci
   — dvakrát vykázaný čas — prošel 158 testy, protože se produkční generátor nikdy nespustil.
4. 🔴 **Strukturální test MUSÍ odstranit komentáře.** Dvakrát za noc: jednou padal na zmínku
   v komentáři, podruhé kvůli zmínce v komentáři **prošel** — kanárek měřil vlastní větu
   „`refreshTray()` musí přijít až ZA ním" místo skutečného volání.
5. **Inventura, která zná jen literál, oslepne u konstanty.** B4 zavedla první kanál
   pojmenovaný konstantou a bezpečnostní brána ztichla přesně tam, kde dostala co hlídat.
6. **Vykonavatel si vymyslí hodnotu, když ji nemá kde vzít** — a přizná to v téže odpovědi.
   Uhodnutý `clientId` **není fail-closed**.
7. **Klasifikátor chyb se nesmí chytat jmen proměnných.** `ReferenceError:
   resolveAuthClientId…` se hlásil jako „konfigurace", tedy vada kódu jako vada nastavení.

## Další krok

**Vlna 5 (po obnovení limitů):**

1. ✅ **BD-N13 bod 2 opraven** — počítadlo mutací hlídalo dvě fakta ze čtyř; doplněno
   o `preparation.cancelled` + test pořadí (přepočet musí být ZA smyčkou). Stoh přebasován,
   b5 161 · b7 187 · b11 202 testů, vše zelené.
2. ✅ **Skill `codex-delegace-orchestrace` rozšířen** o pět nových doložených pastí
   (+129 řádků, snapshot `.bak-*` před editem).
3. 🔄 **B9b** — zámek přes přihlášení i odhlášení, deadliny, úklid dočasných souborů.
   Rozhodnutí revidované v BD-N16.
4. 🔄 **Review druhé vlny** — pět čoček nad b5/b7/b8/b9/b11, které první kolo nevidělo.
5. ⏳ **BD-N13 bod 1 čeká** na doběhnutí B9b — je na `b4`, nad kterou B9b staví.

**Až bude hotovo:** merge zdola nahoru (b1, b3, b4 → main; pak b5, b8; pak b7, b9;
nakonec b11 a b9b). **Merge je Danovo rozhodnutí** — masterplán M4 ruší „dotáhni to sám".
