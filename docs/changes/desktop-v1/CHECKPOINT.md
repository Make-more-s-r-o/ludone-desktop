# Checkpoint nočního běhu

**Tenhle soubor se PŘEPISUJE po každé vlně, neroste.** Je to pojistka proti compaction:
kdo ho čte s prázdným kontextem, musí být schopen pokračovat, aniž by se ptal.

**Poslední zápis: 1. 9. 2026, 22:17.** Zadání běhu: [`BEH-NOC.md`](BEH-NOC.md).

---

## Vlna

`1 / 4` — běží

## Hotovo

_(zatím nic uzavřeného — vlna 1 běží)_

**Změřeno a doložené:**
- Baseline na `main` ověřen **nezávisle mnou**, ne převzat: `lint` EXIT=0 · `typecheck` EXIT=0
  · `test:unit` **77 zelených v 9 souborech**. Změřeno i uvnitř worktree `desktop-b1`, takže
  symlinkované `node_modules` prokazatelně fungují.
- Codex ověřen naostro: `EXIT=0`, model `gpt-5.6-sol`, effort `ultra`, CLI **0.152.0**,
  sandbox `workspace-write [workdir, /tmp, $TMPDIR]`.
- Orca orchestrace zapnutá, repo `ludone-desktop` registrované (`fcc669e3`).

## Padá

_(nic — první kolo ještě neskončilo)_

## Přeskočeno

| Story | Proč | Kam zapsáno |
|---|---|---|
| **B2** čísla `B*`/`BD*` | 377 odkazů · `LUDONE_E2E` obsahuje `E2` · tři sabotážní markery v produkčním kódu · 22 souborů s číslem v názvu. Nulová produktová hodnota, nejvyšší riziko vlny. | `DAN-TODO.md` → BD-N1 |
| **B4 vada (c), viditelná půlka** | Žije v `Onboarding.jsx`, který paralelně vlastní B1. Zmrazený plán dává B4 jen `auth.cjs` + `main.cjs`. | `DAN-TODO.md` → BD-N2, doporučení: story B4b |
| **B12** migrace | Živá databáze 24 lidí, patří Danovi. | `BEH-NOC.md` |

## Kde co leží

| Worktree | Větev | Kdo v něm píše | Stav |
|---|---|---|---|
| `~/orca/workspaces/ludone-desktop/desktop-b1` | `orca/desktop-b1` | Codex — B1 `ui-smoke` | běží |
| `~/orca/workspaces/ludone-desktop/desktop-b4` | `orca/desktop-b4` | Codex — B4 tři vady přihlášení | běží |
| `/Users/dan/Dev/ClaudeCode/ludone-desktop` | `main` | orchestrátor (jen dokumenty + `ui-smoke` měření) | čistý |

🔴 **Obě worktree mají `node_modules` jako SYMLINK** do hlavního checkoutu — Codexův sandbox
nemá síť, `npm ci` by tam neprošel. Při úklidu na to pozor.

**Packety** (napsal je orchestrátor, protože neexistovaly): `tasks/B1-ui-smoke.md`,
`tasks/B4-tri-vady-prihlaseni.md` — obojí commitnuto v `main` (`b877fd2`).

## Běžící procesy

| Co | Log | Odpověď |
|---|---|---|
| Codex B1 | `/var/folders/l9/…/T//codex-1788293479.log` | `…479.answer` |
| Codex B4 | `/var/folders/l9/…/T//codex-1788293490.log` | `…490.answer` |
| `ui-smoke` baseline (můj, na skutečném Macu) | `/tmp/beh-noc/ui-smoke-baseline.log` | — |

**Kompaktní hlídač:** `/tmp/beh-noc/stav.sh <cesta-bez-pripony> …` — vypíše velikost, ticho
a `EXIT`, **nikdy obsah logu** (`--json` výstup má stovky kB a zaplavil by kontext).

🔴 **Log bez pohybu 20 minut = mrtvý job** bez ohledu na to, co hlásí stav. Práce ale bývá
hotová na disku — než ho pustíš znovu, podívej se do worktree přes `git status`.

## Souběžná session

`ludone-desktop-09` (socket `uds:/tmp/cc-socks/50721.sock`) píše task packety pro
**B3, B5, B6, B7, B8, B9, B10, B11** a commituje je do `main`. **Před každou vlnou
`git fetch origin main` a adresář `tasks/` přečíst znovu.** Packety pro B1/B2/B4 nepíše —
ty jsou moje, dohodnuto.

## Další krok

Počkat na doběhnutí obou Codexů, **hned poté `git add -A && git commit`** v každém worktree
(sabotážní kolo končí `git checkout -- .` a nad necommitnutou prací by ji smazalo), pak brány,
pak sabotáže podle receptu z `sabotazeRecept`, pak PR. Teprve pak vlna 2 (B3 — drží ji Claude).
