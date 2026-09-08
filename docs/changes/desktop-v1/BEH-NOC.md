# Briéf běhu — 8. 9. 2026

> Zadání Dana: *„nastav /beh, aktualizuj a pokračuj samostatně, ultracode, delegace na codex
> co nejvíc. Audit na konci celého masterplánu, že je hotové. E2E testing. Opravit, ať může
> jít ráno na produkci. Codex obnovený, nasaď to."*

## 🔴 Nejdřív: dvě třetiny zadání jsou hotové z noci 7./8. 9.

Aby běh neopakoval hotovou práci:

| zadání | stav |
|---|---|
| **Audit masterplánu** | ✅ **hotový** — 8 pohledů, 49 agentů, 41 nálezů, **26 potvrzených** adversariálním ověřením, všechny zpracované nebo zapsané |
| **E2E** | ✅ **hotové** — akceptace rozšířená o **`E9.sh`** pro money agendu, která do té doby neměla ani jednu podmínku; `E1..E9` zelená mimo `E3` (chybí zabalená `.app`) |
| **„ráno na produkci"** | ❌ **nejde a není to vinou kódu** — bez certifikátu Apple nemá balíček `_CodeSignature` **vůbec**, macOS ho nikomu jinému nespustí |

## Co běh dělá

1. **Ověřit, že Codex opravdu jede** (Dan to tvrdí; limit měl vypršet 13. 9.) — měřením,
   ne domněnkou.
2. **Dodělat tři drobnosti z `DAN-TODO` bodu 15**, pokud po přeměření pořád platí:
   - dva časové vypínače bez společného zdroje pravdy (memoizovaný × čtený při každé mutaci)
   - uploadový killswitch hlídaný **grepem přes názvy testů**, kdežto časový má
     behaviorální sondu — táž asymetrie, jakou jsme včera opravovali
   - `switchTrackingProject` je vystavený most, který nikdo nevolá
3. Cokoli dalšího, co přeměření ukáže jako nedodělané.

## Mantinely

- **Killswitche nesahat.** `design/**` jen ke čtení, `spec.md`/`plan.md` požadavky zmrazené
  (osy stavu se udržovat smí, BD-N30).
- **Nikdy neopravovat měřidlo místo vady.** Zakázané: změkčení aserce, `it.skip`, vypnutí
  brány, výjimka ve skenu tajemství, globální `testTimeout`, `--force`, `[skip ci]`.
- Max **3 kola** na vadu, pak `failed` + položka „čeká na tebe".
- 🔴 **Sabotáž měř nad CELOU sadou, sériově** (`--no-file-parallelism`) — stroj sdílí CI
  a cizí projekty, `load` běžně 20–330. **Zelená pod zátěží je silný důkaz, červená slabý.**
- 🔴 **Úklid po sabotáži = `git checkout -- .` A `rm -rf build/ikona-aplikace`.** Untracked
  generovaný artefakt checkout neobnoví; dvakrát 7. 9. vyrobil falešnou červenou.
  Čistotu ověřuj `git status --porcelain --untracked-files=all`.
- Výsledek CI číst přes `gh pr view --json statusCheckRollup`, **nikdy** přes návratový kód.
- 🔴 **Před ohlášením nálezu si přečti, co už je zapsané** v `decisions.md`, poznámkách pod
  čarou ve `spec.md` a v komentářích. 7. 9. se **pětkrát** stalo, že se jako nález ohlásilo
  vědomé rozhodnutí — jednou to dokonce šlo Danovi jako otázka.
- 🔴 **Když opravuješ A podle B, změř i B.** A **korekci vlastní chyby změř taky** — přehnaná
  sebekritika je stejná nepřesnost jako přehnané tvrzení, jen zní zodpovědně.
- ⚠️ **Packet brief nenechávej ve worktree** — sken tajemství (`E7`) prohledává pracovní
  strom, takže i necommitnuté soubory. 7. 9. na tom E7 spadl.

## Kde je stav

- `docs/changes/desktop-v1/spec.md` — matice 17 funkcí (od #97 **říká pravdu**)
- `docs/changes/desktop-v1/CHECKPOINT.md` — poslední zápis 7./8. 9.
- `DAN-TODO.md` — **body 11–15 jsou rozhodnutí pro Dana, na ta se nesahá**
- ⚠️ `progress/status.json` je prázdný — masterplán se pro tuhle změnu nikdy nenaplnil.

## Stav při zadání běhu

`main` zelený · **1074 zelených testů** · **21 PR mergnuto 7. 9.** · 0 otevřených PR ·
akceptace `E1..E9` zelená mimo `E3`.
