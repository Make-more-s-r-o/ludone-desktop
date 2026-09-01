# Prompt pro noční implementační session

Zkopírovat **celý blok** jako první zprávu do nové session v `/Users/dan/Dev/ClaudeCode/ludone-desktop`.

Režimy odpovídají masterplánu §11: `/effort ultracode` · `/beh` · `/goal` · `/loop`.
🔴 **`/loop` je tu úmyslně úzký** — masterplán ho zakazuje jako stavový automat i jako důkaz
dokončení. Motor běhu je task DAG, ne smyčka.

---

```
/effort ultracode

Pracuj podle LuDone masterplánu v režimu /beh (autonomní execution policy, §11).
Zadání je v repozitáři, ne v týhle konverzaci — konverzaci sežere compaction, repozitář ne:

  docs/changes/desktop-v1/BEH-NOC.md

První krok: přečti BEH-NOC.md a podívej se do docs/changes/desktop-v1/tasks/.

🔴 TASK PACKETY TAM PRŮBĚŽNĚ PŘIBÝVAJÍ. Píše je souběžná session a commituje je do main.
Proto:
- PŘED KAŽDOU VLNOU udělej `git fetch origin main` a adresář si přečti ZNOVU.
- Když packet pro story existuje, je závazný — má přesné soubory, vlastnictví bloků,
  TDD kroky, sabotáže a live-verification scénář (masterplán §9).
- Když packet NEEXISTUJE, zadání je kompletní i bez něj: plan.md §2b (rozpad na PR:
  soubory, test co jde napřed, velikost diffu), plan.md §2 (vlastnictví bloků uvnitř
  main.cjs a preload.cjs) a spec.md (Feature ID, pravidla R1-R25, acceptance §8).
  V tom případě si packet napiš SÁM před implementací a ulož do tasks/ — ať je stejný
  doklad jako u ostatních.
- Nečekej na packet. Práce má přednost před formulářem.

Zmrazené a neměnit: spec.md, plan.md. Chybu v nich zapiš do DAN-TODO.md a jeď dál po tom,
co na ní nezávisí.

═══ /goal — kdy je story hotová ═══

Story je hotová POUZE pokud:
- splňuje acceptance criteria ze spec.md a její Feature ID má v matici §3 posunuté osy,
- cílené i projektové brány jsou zelené, měřeno PŘED rourou (lint, typecheck, test:unit),
- v transcriptu je DOSLOVNÝ výpis testu VIDĚNÉHO ČERVENÉHO ze správného důvodu,
- sabotážní test prokazatelně chytá odstranění guardu, doložený doslovným výpisem,
- PR je otevřený proti aktuálnímu main a diff se nerozešel s plan.md,
- diff přečetl Claude; u money a RBAC povinně,
- packet nezůstal s otevřenou otázkou, která mění chování,
- jinak pokračuj nebo vrať PŘESNÝ blocker.

🔴 Goal vyžaduje důkaz v transcriptu a v repozitáři. "Feature je hotová" není důkaz.
🔴 Žádná story nesmí ráno tvrdit ✅ ověřeno naostro — to smí říct jen člověk, který to
viděl běžet. Zelené testy jsou 🧪.

═══ Ekonomika kontextu — hlavní session musí zůstat krátká ═══

Tohle je bod, na kterém běh padá dřív než na kódu. Masterplán §20 to měří jako kritérium
úspěchu celého procesu.

- Hlavní smyčka NEČTE velké soubory do svého kontextu. Čtení, hledání a průzkum deleguj
  (Agent tool / Codex) a nech si vrátit ZÁVĚR, ne obsah.
- Diff čti cíleně: git diff --stat, pak jen soubory, kde jde o money, RBAC nebo architekturu.
- Po KAŽDÉ vlně zapiš stav do docs/changes/desktop-v1/CHECKPOINT.md (přepiš ho, ať neroste):
  co hotovo, co padá, co přeskočeno, kde jsou worktrees a větve, co dělat dál.
  Ten soubor je tvoje pojistka proti compaction — piš ho tak, aby podle něj pokračoval
  někdo s prázdným kontextem.
- Nedrž si v hlavě, co je v repu. Radši si to přečti znovu.

═══ Delegace — bulk odedře Codex ═══

Výchozí vykonavatel je Codex, viditelně v Orce:
  ~/.claude/scripts/orca-codex.sh start "<úkol>" "<prompt>"

Claude si nechává B3 a B8 (architektura, bezpečnost) a VŽDY konsolidaci: diff, brány,
commit, PR. Money-critical kód od Codexu nikdy nemerguj bez přečtení diffu.

🔴 Codex ve worktree needituje git, edituje jen SOUBORY — git add/fetch/merge/checkout mu
spadnou na "Operation not permitted", protože index leží mimo pracovní strom. Do KAŽDÉHO
zadání dej větu "NEDĚLEJ ŽÁDNOU git operaci, jediná povolená je git --no-pager status
--porcelain, ta jen čte" a commituj po něm sám, HNED po doběhnutí:
sabotážní kolo končí git checkout -- . a nad necommitnutou prací by ji smazalo.

🔴 Codexův job, jehož log se nehýbe 20 minut, je mrtvý bez ohledu na to, co hlásí status.
Práce ale bývá hotová na disku — než ho pustíš znovu, podívej se do worktree.

🔴 Jeden strom = jeden zapisovatel. Dva souběžné zapisovatelé si přepíší práci a důkaz
z takového běhu je neplatný, i když obě strany doběhnou "úspěšně". Vlastnictví bloků
uvnitř main.cjs opiš do zadání VÝČTEM z packetu — věta "nesahej na cizí" nestačí.

═══ /loop — jen na čekání, ne jako motor ═══

Masterplán §11: /loop není stavový automat, důkaz dokončení ani náhrada task DAG.
Použij ho VÝHRADNĚ když čekáš na něco mimo session: doběhnutí Codexe, CI, nebo RESET
LIMITŮ. Když narazíš na limit, nastav /loop na dobu do resetu, zapiš CHECKPOINT.md
a pokračuj po probuzení. Nepoužívej ho k "průběžné kontrole, jestli už je hotovo".

═══ Na stopce se PŘESKAKUJE ═══

Odložitelné rozhodnutí → DAN-TODO.md s doporučeným defaultem, a jeď dál po nezávislé
větvi DAG. Celý běh zastav jen tehdy, když bez toho rozhodnutí není co dělat.
Stopky: ostrý zápis do Tabidoo, flip killswitche, produkční migrace, peníze, mazání dat,
secrets, externí komunikace.

🔴 Každé rozhodnutí, které uděláš za Dana, musí být ráno vypsané. Tichý default je vada.

═══ Nesmíš ═══

Merge kódu do main · zapojit frontu k neexistujícímu serveru · pustit migraci B12 ·
sahat na design/** · flipnout cizí killswitch · psát do Tabidoo · číst secrets ·
commitnout zvuk ze skutečné schůzky · rozmrazit T1 · pouštět ui-smoke v sandboxu ·
oslabit test · obejít bránu · rozhodnout nové money nebo RBAC pravidlo.

Při selhání oprav VADU, ne měřidlo, nejvýš tři kola. Zakázané "opravy": změkčení testu,
vypnutí brány, --force, [skip ci]. Po třetím neúspěchu zastav, nech PR otevřený a napiš,
co přesně padá.

═══ Ráno ═══

Plný report ━━━ REPORT · Desktop: noční běh ━━━ se sekcemi Problém · Zadání · Stav vývoje ·
Stav nasazení · Otestováno · Otestuj ty · Další krok, plus "Rozhodl jsem sám" a "Čeká na tebe".
Značky povinně: ✅ ověřeno naostro · 🧪 zelené testy · ⛔ neověřeno.

A NAVÍC, protože tenhle modul je podle masterplánu §20 PILOT celého procesu — vrať verdikt:

  VALIDATED    — proces lze použít na reálný modul
  PARTIAL      — funguje za popsaných omezení, workflow se upraví
  INVALIDATED  — proces nebo jeho část nevytváří spolehlivý výsledek

Posuď zvlášť: dal se packet implementovat bez produktového hádání? Odhalilo Claude review
odchylky? Zůstala hlavní session kontextově úsporná? Neúspěšný pilot je platný výsledek,
pokud přesně ukáže, co změnit.
```

---

## Co ten prompt dělá a co ne

| Otázka | Odpověď |
|---|---|
| Šetří hlavní session? | Ano — má na to vlastní sekci a `CHECKPOINT.md` místo paměti |
| Deleguje na Codex? | Ano, výchozí vykonavatel, s pastmi sandboxu vypsanými |
| Přežije autocompact? | Ano — zadání je v repu, stav v `CHECKPOINT.md` |
| Je v něm `/goal`? | Ano, měřitelný, vyžaduje důkaz v transcriptu |
| Je v něm `/loop`? | Ano, ale **úzce** — jen čekání a reset limitů, jak velí §11 |
| Samo-zlepšuje se? | Ano přes §20 — běh ráno soudí i sám proces, ne jen kód |

## Volitelně souběžně: Fable review plánu

Jde pustit paralelně, je to čtení. Prompt v [`PROMPT-FABLE.md`](PROMPT-FABLE.md).
⚠️ Když Fable najde díru, zastav noční běh a rozhodni — proto má smysl pustit ho hned, ne ráno.
