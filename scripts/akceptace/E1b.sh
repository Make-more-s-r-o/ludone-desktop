#!/usr/bin/env bash
# Akceptace E1b. Vypíše PASS/FAIL za každou podmínku a skončí 1, když aspoň jedna padne.
#
# E1b = kód aplikace se dostal na `main` a důkazy měření se dostaly do gitu.
# Etapu dělal orchestrátor (Claude), ne Codex: sandbox neumí sáhnout na git index.
chyby=0
zkontroluj() {                     # zkontroluj "<popis>" <příkaz…>
  local popis="$1"; shift
  if "$@" > /tmp/akc.out 2>&1; then
    echo "PASS  $popis"
  else
    echo "FAIL  $popis"; sed 's/^/      | /' /tmp/akc.out; chyby=$((chyby+1))
  fi
}

# Archiv musí být NEPRÁZDNÝ. `test -f` projde i nad nulovým souborem, což je
# přesně ten druh zelené, kvůli kterému archiv vzniká.
neprazdny() { test -s "$1"; }

# Žádný ze STARÝCH worktrees, které držely nezálohované důkazy, už nesmí existovat.
# Schválně se neptáme na „git worktree list má 1 řádek": orchestrátor podle Danova
# pokynu z 24. 8. pracuje ve VLASTNÍM odděleném Orca worktree ("jeden zapisovatel =
# jeden worktree, nikdy main"), takže jeden řádek navíc je správný stav, ne dluh.
# Ptáme se tedy na to, na čem doopravdy záleží — na stopce S4.
zadny_stary_worktree() {
  ! git worktree list --porcelain | grep -qE 'worktree .*/\.claude/worktrees/(kostra|zvuk|e8-docs)$'
}

zkontroluj "commit s nahráváním (2bb09ce) je předek main" \
  git merge-base --is-ancestor 2bb09ce main
zkontroluj "electron/main.cjs je v kořeni" test -s electron/main.cjs
zkontroluj "src/App.jsx je v kořeni" test -s src/App.jsx
zkontroluj "package.json má skript package:mac" \
  grep -Fq '"package:mac"' package.json

zkontroluj "archiv nahrávacího běhu: proof-files.json" \
  neprazdny dukazy/nahravani-2026-08-21/proof-files.json
zkontroluj "archiv nahrávacího běhu: tichá systémová stopa" \
  bash -c 'ls dukazy/nahravani-2026-08-21/ticho/*-system.webm >/dev/null 2>&1'
zkontroluj "archiv nahrávacího běhu: zvuková systémová stopa" \
  bash -c 'ls dukazy/nahravani-2026-08-21/zvuk/*-system.webm >/dev/null 2>&1'
zkontroluj "archiv nahrávacího běhu má README s postupem přeměření" \
  bash -c 'test -s dukazy/nahravani-2026-08-21/README.md && grep -Fq "volumedetect" dukazy/nahravani-2026-08-21/README.md'
zkontroluj "archiv z worktree zvuk: NALEZ.md" \
  neprazdny dukazy/zvuk-2026-08-20/NALEZ.md
zkontroluj "archiv z worktree zvuk: NALEZ-OPAKOVANI.md" \
  neprazdny dukazy/zvuk-2026-08-20/NALEZ-OPAKOVANI.md
zkontroluj "archiv z worktree zvuk: nástroje měření" \
  neprazdny dukazy/zvuk-2026-08-20/nastroje/test-loopback.js

zkontroluj "žádný ze starých worktrees (kostra, zvuk, e8-docs) už neexistuje" \
  zadny_stary_worktree
# .DS_Store se do archivu dostal přes výjimku !dukazy/** a musel se vyndat z indexu;
# macOS ho přepisuje sám, takže by `git status` už nikdy nebyl čistý.
zkontroluj "do archivu se nedostalo binární smetí (.DS_Store)" \
  bash -c '! git ls-files dukazy/ | grep -q "\.DS_Store$"'

echo "---"; echo "chyb: $chyby"; exit $(( chyby > 0 ? 1 : 0 ))
