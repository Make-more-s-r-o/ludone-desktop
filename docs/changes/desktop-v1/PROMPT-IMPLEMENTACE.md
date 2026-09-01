# Prompt pro noční implementační session

Zkopírovat celé jako první zprávu do nové session v `/Users/dan/Dev/ClaudeCode/ludone-desktop`.

---

```
Pracuj autonomně přes noc. Nezastavuj se na dotazech — na stopce PŘESKAKUJ a pokračuj
po tom, co na ní nezávisí.

Zadání je v repozitáři, ne v týhle konverzaci:

  docs/changes/desktop-v1/BEH-NOC.md

Přečti ho celé jako první krok, i s tím, na co odkazuje: spec.md (zmrazený, §3 čtyři osy,
§11 co našla skeptická revize), plan.md (zmrazený, §2 vlastnictví bloků, §2b rozpad na PR),
decisions.md a DAN-TODO.md. Spec ani plán neměň — chybu v nich zapiš do DAN-TODO a jeď dál.

Cíl: z B1–B11 mít ráno co nejvíc hotových jako samostatné PR, každá s červeným testem
viděným napřed, zelenými bránami a přečteným diffem. Nic ráno nesmí tvrdit "ověřeno",
co nikdo neviděl běžet — zelené testy jsou 🧪, ne ✅.

Dělba práce: staví Codex viditelně v Orce přes ~/.claude/scripts/orca-codex.sh, B3 a B8
si nech (architektura a bezpečnost). Diff, brány, commity a PR čteš a děláš ty, i u
Codexovy práce. Codex ve worktree needituje git, jen soubory — do každého zadání dej
"NEDĚLEJ ŽÁDNOU git operaci" a commituj po něm sám, hned po jeho doběhnutí.

Jeden strom = jeden zapisovatel. Vlastnictví bloků uvnitř main.cjs opiš do zadání VÝČTEM
z plan.md §2 — věta "nesahej na cizí" nestačí.

Nesmíš: merge kódu do main, zapojit frontu k neexistujícímu serveru, pustit migraci B12,
sahat na design/**, flipnout cizí killswitch, psát do Tabidoo, číst secrets, commitnout
zvuk ze skutečné schůzky, rozmrazit T1, pouštět ui-smoke v sandboxu.

Při selhání oprav VADU, ne měřidlo, nejvýš tři kola. Po třetím zastav, nech PR otevřený
a napiš, co přesně padá.

Po každé vlně ▪ CHECKPOINT n/4. Ráno plný report ━━━ REPORT · Desktop: noční běh ━━━
včetně sekcí "Rozhodl jsem sám" a "Čeká na tebe".
```

---

## Volitelně souběžně: Fable review plánu

**Jde pustit paralelně** — je to čtení, do stromu nesahá. Prompt v [`PROMPT-FABLE.md`](PROMPT-FABLE.md).

⚠️ Když Fable najde díru, **zastav noční běh a rozhodni** — proto má smysl pustit ho dřív
nebo zároveň, ne až ráno.
