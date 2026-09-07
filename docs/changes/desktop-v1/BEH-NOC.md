# Briéf nočního běhu — 7./8. 9. 2026

> Zadání Dana večer 7. 9.: *„nastav /beh, aktualizuj a pokračuj samostatně, ultracode,
> delegace na codex co nejvíc. Audit na konci celého masterplánu, že je hotové. E2E testing.
> Opravit, ať může jít ráno na produkci."*

## 🔴 Nejdřív poctivě: „ráno na produkci" NENÍ celé dosažitelné

Tohle musí být v briéfu první, ať se běh nesnaží o nemožné:

| co brání | proč to nejde obejít |
|---|---|
| **chybí certifikát Apple** | balíček **nemá `Contents/_CodeSignature` vůbec** — `signingPlan()` podepisování bez certifikátových proměnných vypíná. Bez podpisu a notarizace macOS aplikaci nespustí ostatním lidem. Čeká se na schválení programu. |
| **10 ze 17 funkcí má `exposure: disabled`** | killswitche jsou **Danova vědomá rozhodnutí**; přepnout je je **stopka**, ne úkol běhu. |
| **`DSK-F010` blokovaná na SERVERU** | scope pro zápis (upload) neexistuje; server zná jen `mcp:read` a `mcp:draft`. |

⇒ **Cíl běhu je proto: mít v `main` stav, který PŮJDE vydat v okamžiku, kdy dorazí
certifikát** — ne vydat ho. Vše ostatní se dotáhne.

## Co běh dělá

1. **Audit dokončenosti** — osm nezávislých pohledů (matice vs. kód · doklady
   `verified-live` · brány, které nic neměří · killswitche · bezpečnost IPC · pokrytí E2E ·
   připravenost produkce · dokumentace vs. kód), každý nález **adversariálně ověřený**.
2. **E2E** — `scripts/akceptace/E1..E8`. 🔴 `E2-sabotaze.sh` **NESPOUŠTĚT** (volá `ui-smoke`,
   v sandboxu zakázáno).
3. **Opravy** potvrzených nálezů přes Codex, konsolidace v Claude.

## Mantinely (platí beze změny)

- Killswitche **nesahat**; ostrý zápis do Tabidoo zakázán; secrets nikdy do gitu.
- `design/**` jen ke čtení; `spec.md`/`plan.md` požadavky zmrazené, osy stavu se udržovat smí.
- **Nikdy neopravovat měřidlo místo vady.** Zakázané: změkčení aserce, `it.skip`, vypnutí
  brány, výjimka ve skenu tajemství, globální zvednutí `testTimeout`, `--force`, `[skip ci]`.
- Max **3 kola** na vadu, pak `failed` + položka „čeká na tebe".
- **Nespouštět těžké běhy při `load average` nad 20** — CI běží na Danově Macu
  (`runs-on: [self-hosted, macos]`). Doloženo: commit s pouhým Markdownem vyrobil
  **24 vypršení testů** při load 130 a byl zelený při load 16.
- Výsledek CI číst přes `gh … --json conclusion`, **nikdy** přes návratový kód
  (`gh run watch --exit-status` vrátilo 0 u běhu s `conclusion=failure`).
- Sabotáže **3🔴:1🟢 nad CELOU sadou** a nad **commitnutou** prací. U zelené sabotáže vždy
  ověř, že jsi **trefil cíl** — a u projektu s generovanými soubory ověř čistotu stromu
  **i pro untracked** (`git status --porcelain` bez filtru na `??`).
- 🔴 **Před ohlášením nálezu si přečti, co už je zapsané** v `decisions.md`, poznámkách
  pod čarou ve `spec.md`, ve `vzorky/README.md` a v komentářích. Dnes se **pětkrát** stalo,
  že se jako nález ohlásilo vědomé rozhodnutí — jednou to dokonce šlo Danovi jako otázka.

## Kde je stav

- `docs/changes/desktop-v1/spec.md` — matice 17 funkcí, čtyři osy
- `docs/changes/desktop-v1/CHECKPOINT.md` — průběh (poslední zápisy z 7. 9.)
- `docs/changes/desktop-v1/decisions.md` — rozhodnutí
- `DAN-TODO.md` — co čeká na Dana
- ⚠️ `progress/status.json` je **prázdný** — masterplán se pro tuhle změnu nikdy nenaplnil,
  stav žije ve `spec.md`. Nepokoušet se z něj číst pravdu.

## Stav při zadání běhu

`main` zelený · **1049 zelených testů** · **15 PR mergnuto 7. 9.** · 0 otevřených PR ·
akceptace **55 PASS / 3 FAIL** (podpis bez certifikátu · jeden test přes 5 s · sken tajemství
našel testovací atrapu).
