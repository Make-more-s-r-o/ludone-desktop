# Checkpoint nočního běhu

**Tenhle soubor se PŘEPISUJE po každé vlně, neroste.** Je to pojistka proti compaction:
kdo ho čte s prázdným kontextem, musí být schopen pokračovat, aniž by se ptal.

**Poslední zápis: 1. 9. 2026, 23:05.** Zadání běhu: [`BEH-NOC.md`](BEH-NOC.md).

---

## Vlna

`2 / 4` — B3 hotová v kódu, čeká na nezávislé review od Codexe, pak PR.

## Hotovo

| Story | PR | Brány | Doloženo |
|---|---|---|---|
| **B1** `ui-smoke` | [#2](https://github.com/Make-more-s-r-o/ludone-desktop/pull/2) 🟢 CI SUCCESS | lint 0 · typecheck 0 · **77/77** | červený baseline naostro + 4 sabotáže diferenciálně |
| **B4** tři vady přihlášení | [#3](https://github.com/Make-more-s-r-o/ludone-desktop/pull/3) 🟢 CI SUCCESS | lint 0 · typecheck 0 · **86/86** (9 nových) | 3 doslovné červené výpisy + recept na 4 sabotáže |
| **B3** autorita tray | ⏳ PR ještě ne | lint 0 · typecheck 0 · **98/98** (6 nových) | 4 sabotáže 3🔴:1🟢 + cílená sabotáž jediného přepočtu |

🔴 **Ani jedna netvrdí `verified-live`.** Osy po změně: `delivery: pr-open` · `exposure`
beze změny · `verification: tests-green`. Naostro to nikdo neviděl.

**Brány jsem měřil SÁM po rebase**, ne převzal od Codexu. `test:unit` u B4 dalo **86** —
přesně to číslo, které Codex předpověděl v `ocekavanePocty`, což je nejlevnější důkaz,
že testy opravdu spustil.

## Padá

**Nic rozbitého tímhle během.** Jediná červená je `ui-smoke` a je to blokátor na člověku:

🔴 **`ui-smoke` nedojede do zelené, dokud Dan neudělí oprávnění Nahrávání obrazovky.**
Každý běh končí na `ui-smoke.mjs:364` hláškou `systémový zvuk: Permission denied`. Změřeno
**dvakrát nezávisle** — ve worktree i v hlavním checkoutu, obojí s `package:mac` EXIT=0.
Původní pád na `:301` je prokazatelně pryč, takže **oprava B1 funguje**; padá o 60 řádků dál
z jiné příčiny. Postup pro Dana je v `DAN-TODO.md` (commit `189d345`).

⇒ **Druhá půlka zadání B1 (doběhnout sabotáže (b) a (c) v `E2-sabotaze.sh`) zůstává
nesplněná.** Ta brána správně odmítá měřit nad červeným baseline.

## Přeskočeno

| Story | Proč | Kam zapsáno |
|---|---|---|
| **B2** čísla `B*`/`BD*` | 377 odkazů · `LUDONE_E2E` obsahuje `E2` · 3 sabotážní markery v produkčním kódu · 22 souborů s číslem v názvu | `DAN-TODO.md` → BD-N1 |
| **B4 vada (c), viditelná půlka** | `Onboarding.jsx` vlastní B1; zmrazený plán dává B4 jen `auth.cjs` + `main.cjs` | `DAN-TODO.md` → BD-N2, návrh story **B4b** |
| **B12** migrace | Živá databáze 24 lidí | `BEH-NOC.md` |

## Kde co leží

| Worktree | Větev | Stav |
|---|---|---|
| `~/orca/workspaces/ludone-desktop/desktop-b1` | `orca/desktop-b1` | ✅ pushnuto, PR #2, **volný** |
| `~/orca/workspaces/ludone-desktop/desktop-b4` | `orca/desktop-b4` | ✅ pushnuto, PR #3, **volný** |
| `~/orca/workspaces/ludone-desktop/desktop-b3` | `orca/desktop-b3` | 3 commity, **nepushnuto**, čeká na review |
| `/Users/dan/Dev/ClaudeCode/ludone-desktop` | `main` | čistý, srovnaný s `origin/main` |

🔴 **Obě worktree mají `node_modules` jako SYMLINK** do hlavního checkoutu (Codexův sandbox
nemá síť, `npm ci` by tam neprošel). Při úklidu na to pozor.

🔴 **V hlavním checkoutu NIKDY `git add -A`** — pracuje v něm i souběžná session a jednou
už si tím vzala moji rozdělanou práci. Stageuj jmenovitými cestami.

## Běžící procesy

**Codex review B3** — read-only, panel „🔎 Codex review: B3 autorita tray“,
log `/tmp/beh-noc/b3-review.log`. 🔴 **V read-only kleci Codex NEZAPÍŠE soubor `-o`** —
odpověď se čte z LOGU, ne z `.answer`. Hlídač: `/tmp/beh-noc/cekej-review.sh`.

**Kompaktní hlídač:** `/tmp/beh-noc/stav.sh <cesta-bez-pripony>` — velikost, ticho, `EXIT`,
nikdy obsah logu (`--json` má stovky kB a zaplavil by kontext).
**Čekání na job:** `/tmp/beh-noc/cekej.sh <cesta-bez-pripony> <jmeno>` na pozadí — hlídá
oba konce, odpověď i úmrtí (ticho > 20 min).

## Souběžná session

`ludone-desktop-09` (`uds:/tmp/cc-socks/50721.sock`) — má **11 draftů packetů**, skeptici je
čtou proti kódu, **B9 ověřený**. Píše B3, B5, B6, B7, B8, B9, B10, B11.
**Před každou vlnou `git fetch origin main` a `tasks/` přečíst znovu.**

## Další krok

**B3 — přesun autority tray stavu do hlavního procesu.** Drží ji Claude (`plan.md` §2:
architektonická změna). Recept je hotový v `specs/E3-vady-a-identita.md` §3.

🔴 **Past, kterou už mám změřenou:** `tests/tray-authority.test.js:39` vyžaduje, aby
`updateTray` obsahoval `trayIconName(nextState)`, zatímco `specs/E3` §3 přikazuje `updateTray`
**smazat** a nahradit bezargumentovým `refreshTray()`. Ten test tu změnu **blokuje**. Přepsat
ho není oslabení — je to výměna zámku na překonaný směr za zámek na nový, který `plan.md` §1
výslovně zavádí. Nový test musí být **striktně silnější**: `grep updateTray` nesmí nic vrátit
a kanál `tray:set-state` musí zmizet.

⚠️ **B3 sahá do `main.cjs` blízko bloku, který změnila B4** (řádky ~237–244 vs ~255).
PR #3 zatím není mergnutý, takže B3 vzniká nad `main` bez něj — konflikt je nepravděpodobný
(11 řádků odstup), ale kdyby nastal, řeší se při merge, ne přebasováním B3 na B4.

---

## 🔴 Co našlo review B3 na MNĚ (a co se z toho učí)

Packet pro B3 (od souběžné session, commit `ae507ff`) našel v mé hotové implementaci
**skutečnou díru**: `refreshTray()` chyběl na **pěti místech**, kde se mění nahrávací fakt.
Odvození stavu bylo správné, ale nikdo se ho po startu nahrávání nezeptal — lišta by
nahrávání **neukázala nikdy**.

🔴 **Prošlo to 92 zelenými testy.** Testy chování volaly `refreshTray()` samy, takže dokázaly
ROZHODNUTÍ a nikdy ZAPOJENÍ. Přesně ta třída, kvůli které v tomhle repu existuje pravidlo
o kanárkovi.

Opraveno v `bd6dd7a` + nový kanárek, který padne, když zmizí **jediný** přepočet (ověřeno
cílenou sabotáží: 1 failed | 97 passed, a padl právě ten správný test).

**Ponaučení do dalších vln:** ke každému „umí to rozhodnout správně" patří druhá otázka
**„zeptá se toho někdo?"**. Test, který si obsluhu zavolá sám, na ni neodpoví.
