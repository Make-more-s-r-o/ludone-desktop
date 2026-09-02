# Checkpoint nočního běhu

**PŘEPISUJE se po každé vlně, neroste.** Pojistka proti compaction: kdo to čte s prázdným
kontextem, musí pokračovat, aniž by se ptal. Zadání: [`BEH-NOC.md`](BEH-NOC.md).

**Poslední zápis: 2. 9. 2026 — CELÝ STOH JE V `main`. Devět stories, žádný otevřený PR.**

🔴 **Režim od 23:15 (Dan): NEPTAT SE.** Bezpečné vratné defaulty rozhodni a zapiš do
`decisions.md`. Hard gate (produkce, DB, Tabidoo, killswitch, money/RBAC/design) fail-closed:
přeskoč **jen dotčený task**, zapiš blocker, jeď dál. Celý běh nezastavuj, dokud je bezpečná
práce. Mechanika Codex, Claude koordinace a review.

---

## Vlna `6` — uzavřena

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
| — | — | **žádné, všechny joby doběhly** |

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

---

## Vlna 5, druhá půlka — co udělalo adversariální review druhé vlny

**55 agentů, 15 potvrzených nálezů z 25**, deset skeptici vyvrátili. Vše v
[`review-2-nalezy.md`](review-2-nalezy.md), včetně vyvrácených a s důvodem.

### ✅ Opraveno

| nález | kde | doloženo |
|---|---|---|
| 🔴 **`cancel()` byl po doručení kódu no-op** — uživatel klikl Zrušit a **skončil přihlášený s tokeny na disku** | `b8` → PR #5 | ověřeno reviewerem **spuštěním**; sabotáž `6 failed` |
| 🔴 **`resolveAuthIssuer` neověřoval hostitele** — prošel libovolný čistý HTTPS origin | `b8` → PR #5 | test dá cizímu originu **platný `clientId`** a stejně čeká odmítnutí |
| 🔴 **úložiště se ověřovalo až PO výměně tokenu** | `b8` → PR #5 | preflight s `fsync` **před** `openExternal`; sabotáž `9 failed` |
| **tautologická kontrola retence v `ui-smoke`** | `b11` → PR #9 | 4 sabotáže, statický kanárek na volby |
| **test čítače přihlášení měřil rozhodnutí, ne zapojení** | `b4` → PR #3 | porovnává parametry funkce s klíči volajícího |
| **počítadlo mutací hlídalo 2 fakta ze 4** | `b3` → PR #4 | + test pořadí přepočtu vůči smyčce |

### Stoh po dvou konfliktech v `auth.cjs`

Obě strany si přepsaly vrstvu úložiště a měly **neslučitelné signatury**. Rebase rozjel
orchestrátor, přeeditování dostal Codex s **výčtem invariantů**, dokončení a měření zase
orchestrátor. Výsledek ověřen **měřením, ne tvrzením**:

`b4 → b8 (131) → b9 (148) → b9b (162)` · `b3 (114) → b5 (161) → b7 (187) → b11 (206)`

🔴 **Čísla testů musí po slučování SEDĚT na součet** — 135 + 13 = 148 a 148 + 14 = 162.
Když nesedí, něco se při slučování ztratilo a je to vidět dřív než v provozu.

### 🛑 Nálezy, které NEJDOU opravit bez Dana

| co | proč |
|---|---|
| **čas se nikdy nedostane do fronty** (`enqueueTimeEntry` nemá volajícího) | zapojení nemá vlastníka; B5 ani B7 ho podle §12 nevlastní |
| **retenční modul nikdo nevolá** | totéž; PR #9 to sám přiznává |
| **selhání zařazení do fronty se jen zaloguje** | potřebuje reconciliaci na startu — návrh, ne oprava |

---

## Vlna 6 — měřidla, která četla text, teď spouštějí kód

Posledních pět nálezů review byla jedna třída: **testy měřící TEXT místo CHOVÁNÍ.**

| nález | co se nespouštělo | co se spouští teď |
|---|---|---|
| 9 | přepočet lišty po změně časovače | vyříznuté `runTrackingMutation` + `syncTrackingTray` nad řízenou mutací |
| 10 | produkční čtení `DESKTOP_TIME_ENABLED` | `getTrackingStore` nad izolovaným `process.env` |
| 11 | trvanlivost zápisu `casovac.json` | `start → commit → writeStateAtomically` nad async `fs`, **sled událostí** |
| 12 | že nahrávka skutečně skončí ve frontě | celý `main.cjs` s podstrčeným Electronem, reálná session přes IPC, čtení přes `queue:list` |
| 13 | produkční čtení obou vypínačů fronty | spuštěné `queueKillswitches()`, včetně **nenastaveného** stavu |

**Sabotáže u obou:** b5 2🔴:1🟢 · b7 3🔴:1🟢. **Produkční kód beze změny** — měnily se jen
vlastněné testovací soubory.

🔴 **Obě povinně zelené sabotáže vkládaly KOMENTÁŘ, který vypadá jako deklarace.** Tenhle
běh na tom dvakrát uklouzl, pokaždé v opačném směru (jednou test padal na zmínku v komentáři,
podruhé kvůli zmínce v komentáři prošel) — teď je to doložené z obou stran.

## Konečný stav stohu

```
main ─┬─ b1 (#2)
      ├─ b3 (#4, 114) ─ b5 (#6, 181) ─ b7 (#7, 219) ─ b11 (#9, 238)
      └─ b4 (#3,  87) ─ b8 (#5, 131) ─ b9 (#8, 165) ─ b9b (#10, 179)
```

🔴 **Čísla musí sedět na součet.** Po každém slučování jsem je kontroloval — je to
nejlevnější detektor toho, že se při rebase něco ztratilo.

## Z 15 nálezů review: 10 opraveno, 5 čeká na Dana

**Čeká, protože to nejde rozhodnout za něj:** tři díry v zapojení (čas do fronty, volání
retence, tiché selhání zařazení) · zda retence patří pod `DSK-F015` · a `updateTray`
v odhlášení, kde je ale **zabudovaná kontrola**, která spadne v okamžiku, kdy se obě
linie potkají (BD-N20).

---

# ✅ SLOUČENO DO `main` — 2. 9. 2026

**Devět stories v `main`, žádný otevřený PR, žádná zbylá větev ani worktree.**

```
lint EXIT=0 · typecheck EXIT=0 · test:unit EXIT=0
19 souborů · 325 testů · 1 přeskočený
```

## Pořadí, ve kterém to šlo bezpečně

Textové „MERGEABLE / CLEAN" u všech devíti PR **byla lež o použitelnosti**. Zkušební
sloučení nanečisto ukázalo, že union obou linií **neprojde branami** — a to je jediný
důvod, proč se to nesloučilo rozbité:

| krok | co | doklad |
|---|---|---|
| 1 | B1 + celá linie přihlášení | 164 testů zeleně |
| 2 | B3 + integrační oprava `auth:logout` | 201, sabotáže 3🔴:1🟢 |
| 3 | B5 + rozřešení konfliktu (atrapa `auth:begin` pryč) | 268 |
| 4 | B7, přebazovaná se **starou špičkou uvedenou výslovně** | 306 |
| 5 | B11 | 325 |

🔴 **Počty testů po každém kroku sedí na SOUČET** (202+67=269, 269+38=307, 307+19=326).
Je to nejlevnější detektor toho, že se při rebase stohu nic neztratilo — a použil jsem ho
u každého kroku.

## Tři vady, které nemohl najít žádný per-PR review

Vznikají teprve **souběhem** obou linií:

1. `auth:logout` volal `updateTray()`, které B3 ruší → odhlásit se nešlo bez rozbité lišty.
   **Našla to kontrola napsaná tak, aby nemohla zestárnout** — zelená, dokud B3 chybí,
   červená v sekundě, kdy přistane.
2. Linie časovače nesla **atrapu `auth:begin`** → dvojí registrace kanálu → výjimka
   v Electronu **při startu**, tedy aplikace, která se neotevře.
3. Inventura IPC kanálů četla **prózu jako kód** — potřetí za tenhle běh táž třída vady.

## Co se ukázalo o slučování stohu

🔴 **`gh pr merge` na stohovaný PR ho sloučí do RODIČE, ne do `main`** (BD-N22). Vypadá to
jako úspěch: pět PR hlásí `MERGED`, seznam otevřených je prázdný, nic nezčervená — a přitom
tři čtvrtiny práce na `main` nejsou. Jediné, co to odhalí, je `git merge-base --is-ancestor`.

## Co zůstává na Danovi

Beze změny proti nočnímu reportu: Screen Recording · statický OAuth client · spor o money
pravidlo v B6 · účet `zasedacka@` pro B10 · tři díry v zapojení. Nově přibylo:
**`orca-codex.sh` neumí pustit Codex ve worktree** (dnes dvakrát selhal, viz `DAN-TODO.md`).
