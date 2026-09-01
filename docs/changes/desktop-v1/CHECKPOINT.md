# Checkpoint nočního běhu

**PŘEPISUJE se po každé vlně, neroste.** Pojistka proti compaction: kdo to čte s prázdným
kontextem, musí pokračovat, aniž by se ptal. Zadání: [`BEH-NOC.md`](BEH-NOC.md).

**Poslední zápis: 2. 9. 2026, 01:30.**

🔴 **Režim od 23:15 (Dan): NEPTAT SE.** Bezpečné vratné defaulty rozhodni a zapiš do
`decisions.md`. Hard gate (produkce, DB, Tabidoo, killswitch, money/RBAC/design) fail-closed:
přeskoč **jen dotčený task**, zapiš blocker, jeď dál. Celý běh nezastavuj, dokud je bezpečná
práce. Mechanika Codex, Claude koordinace a review.

---

## Vlna `4 / 4`

| Story | PR | CI | Testy (měřil jsem já, před rourou) | Stav |
|---|---|---|---|---|
| **B1** `ui-smoke` | [#2](https://github.com/Make-more-s-r-o/ludone-desktop/pull/2) | 🟢 | 77/77 | hotovo |
| **B4** tři vady přihlášení | [#3](https://github.com/Make-more-s-r-o/ludone-desktop/pull/3) | 🟢 | 86/86 | hotovo, **P0 z review opraveno** |
| **B3** autorita tray | [#4](https://github.com/Make-more-s-r-o/ludone-desktop/pull/4) | 🟢 | 113/113 | hotovo, **3 kola oprav** |
| **B8** zapojit auth | [#5](https://github.com/Make-more-s-r-o/ludone-desktop/pull/5) *(nad b4)* | 🟢 | 117/117 | hotovo |
| **B5** časovač do main | [#6](https://github.com/Make-more-s-r-o/ludone-desktop/pull/6) *(nad b3)* | ⏳ | 159/159 | hotovo |
| **B7** fronta | — | — | — | 🔄 Codex píše |
| **B9** odhlášení | — | — | — | 🔄 Codex píše |
| **B6** výběr projektu | — | — | — | 🛑 **STOP**, viz BD-N12 |
| **B10** sdílené zařízení | — | — | — | 🛑 **návrh napsán**, stavba čeká na Dana |
| **B11** retence | — | — | — | čeká na B7 |

🔴 **Žádná netvrdí `verified-live`.** Vše je 🧪, ne ✅.

## Běží

| Co | Log | Konec |
|---|---|---|
| Codex **B7** | `/tmp/beh-noc/b7-codex.log` | hlídač na pozadí |
| Codex **B9** | `/tmp/beh-noc/b9-codex.log` | hlídač na pozadí |

🔴 Log bez pohybu 20 min = mrtvý job. Práce bývá na disku — `git status` ve worktree.
🔴 **Po doběhnutí COMMITNI HNED**, teprve pak brány a sabotáže.
🔴 **B7 a B9 stojí na starších podobách b5/b8** — po převzetí je přebasovat (b3 i b4 se
mezitím posunuly o opravy z review). Konflikt v `tray-authority.test.js` bývá „oba přidali
blok na konec" ⇒ nechat OBĚ sady.

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

1. Převzít **B7** a **B9**: commit → rebase na aktuální b5/b4 → brány → diff → sabotáže → PR.
2. Pak **B11** (po B7).
3. Ráno: plný report + verdikt pilota podle masterplánu §20.
