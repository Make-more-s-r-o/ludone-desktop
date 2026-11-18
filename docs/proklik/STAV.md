# Stav session „🖥 LuDone Desktop: opravy z prokliku“

Session na Dev_LuDone (Orca worktree `ludone-desktop-opravy`, terminál
`term_95205035-b628-40b2-bb1d-ebc74a85f74d`). Danova vlastní session, žádný koordinátor.
Založeno 18. 11. 2026. Tenhle soubor je zdroj pravdy pro budík; konverzaci sežere komprese.

## Cíl

Brát GitHub issues v `Make-more-s-r-o/ludone-desktop` se štítkem `proklik` (nálezy z Danova
prokliku nainstalované verze na MacBooku) a opravovat je až po sloučený PR.
Starší otevřené issues #167–#179 jen na Danův pokyn.

## Tok jedné opravy

1. Rozbor příčiny + komentář do issue „Řeší 🖥 opravy na Devu“.
2. Větev `fix/<oblast>-<popis>` z `origin/main` v Orca worktree `ludone-desktop-opravy`.
3. Implementace: Codex `gpt-6.1-terra`, effort `max`, `-s workspace-write`, viditelný panel přes
   `~/.claude/scripts/orca-codex.sh start …`. Jeden Codex zápis na worktree naráz.
4. Review: Codex `gpt-6.2-sol`, effort `max`, read-only, bez subagentů, na přesném SHA.
   Přihlášení, tokeny, fronta, IPC → navíc Claude review nad diffem.
5. PR „Fixes #N“ + co má Dan ověřit na MacBooku (kroky, očekávaný výsledek). Do té doby nejvýš 🧪.
6. Zelené CI → sloučit → smazat větev, zavřít vlastní Codex panely.

## Prostředí (ověřeno 18. 11. 2026)

- ✅ Lokální brány potřebují **oficiální** Node 24.19.0 (stejný jako CI z `.nvmrc`):
  `export PATH="$HOME/.local/node/node-v24.19.0-darwin-arm64/bin:$PATH"`.
  Staženo z nodejs.org, SHA256 ověřené. `tests/tray-ikony.test.js` s ním 9/9 PASS.
- ⚠️ Homebrew `node@24` (24.22.2) i výchozí Node 22.23.4 v tomtéž testu padají
  (`dark-signed-out.png … se liší od výstupu generátoru`). Nestačí tedy „nějaká 24“; jde
  o sestavení binárky, ne o verzi zlib (obě hlásí 1.2.12). Doplňuje issue #176.
- `npm ci` pod Node 24.19 je v Orca worktree hotové; npm 11 nespustil install skripty
  (bez binárky Electronu) — cílené unit testy to nepotřebují.
- ⚠️ V prostředí je `VITEST_MAX_WORKERS=6` (globální pravidlo uvádí 2). Nepřebíjím; lokálně
  pouštím jen jednotlivé soubory.
- Kanál otázek: `AGENTS.md` řádek „Komunikace s Danem“ neurčuje ⇒ chat této session +
  `otazka new --modul ludone-desktop … --pane term_95205035-b628-40b2-bb1d-ebc74a85f74d`.

## Fronta issues `proklik`

Pořadí: 1) #182+#183 → 2) #186 → 3) #185 → 4) #187 → 5) #184 (čeká na Danovu odpověď).

| Issue | Název | Stav | Větev / PR | Poznámka |
|---|---|---|---|---|
| #182 | Nová nahrávka nedostane výchozí firmu | 🔵 Codex implementuje | `fix/upload-company-default` | společný PR s #183; kód přihlášení ⇒ Claude review nad diffem |
| #183 | Detail: obnova smaže výběr firmy, scroll, dotaz | 🔵 Codex implementuje | `fix/upload-company-default` | — |
| #186 | Čerstvou nahrávku nejde smazat | ⏳ ve frontě | — | hypotéza: čeká na `-stereo.webm`; překlep „vratit“ |
| #185 | Není poznat, že nahrává | ⏳ ve frontě | — | zvuk ⇒ nejvýš 🧪, ověření Dan na Macu |
| #187 | UI drobnosti | ⏳ ve frontě | — | rutina (luna); bod 10 udělá už PR #182 |
| #184 | Méně kliků: Soukromá/Firemní → Nahrávat | ❓ čeká na Dana | — | otázka Q-20261118-144830-ludone-desktop-a6dd; bez odpovědi do 19. 11. 12:00 varianta A (pamatuje poslední volbu) |

### Rozbor #182 (čtení kódu, ⛔ neověřeno během)
- Výchozí firma je v šifrované session (`companyTabidooId`). Refresh ji zachová, **nové přihlášení
  zapíše session od nuly bez firmy** ⇒ každé přihlášení po vypršení ji smaže.
- `upload-companies:default` vrací `null`, když je přístupový token prošlý (Mac po uspání).
- Nastavení resetuje stav na `idle` při změně `identityKey` ⇒ „Načíst firmy“ bez reakce (hypotéza).

## Rozhodl jsem sám

- Model: brief říká Codex `gpt-6.1-terra` max + review `gpt-6.2-sol` max; issues nesou poznámku
  „levný model (sol medium / luna)“ od proklik session. Jedu podle briefu a skillu (user turn),
  #187 jako rutina na lunu. Rozpor nahlášen Danovi v reportu.

## Vlastní Codex panely

| Handle | Úkol | Log | Stav |
|---|---|---|---|
| `term_464c0a7a-dc84-430f-8acd-0f7648a5601a` | #182+#183 implementace, terra max | `~/.claude/runs/.codex-logy/2026-11-18/oprava-vychozi-firmy-182-183-1795013407939.log` | běží od 15:50 |

Zadání: `scratchpad/packet-182-183.md` (session scratchpad).

## Deník tiků

- 18. 11. 2026 15:20 — start: pravidla přečtena, Node 24.19 ověřen, fronta `proklik` prázdná.
- 18. 11. 2026 15:50 — 6 nových issues (#182–#187), komentáře s rozborem, otázka k #184, Codex na #182+#183.
