#!/usr/bin/env bash
# Akceptace E1. Vypíše PASS/FAIL za každou podmínku a skončí 1, když aspoň jedna padne.
chyby=0
zkontroluj() {                     # zkontroluj "<popis>" <příkaz…>
  local popis="$1"; shift
  if "$@" > /tmp/akc.out 2>&1; then
    echo "PASS  $popis"
  else
    echo "FAIL  $popis"; sed 's/^/      | /' /tmp/akc.out; chyby=$((chyby+1))
  fi
}

neobsahuje() {                     # neobsahuje <soubor> <řetězec>
  test -s "$1" || return 1
  ! grep -Fq "$2" "$1"
}

zkontroluj "AGENTS.md existuje a má aspoň 40 neprázdných řádků" \
  awk 'NF { n++ } END { exit !(n >= 40) }' AGENTS.md
zkontroluj "archivovaný NALEZ.md existuje a není prázdný" \
  test -s dukazy/zvuk-2026-08-20/NALEZ.md
zkontroluj "archivovaný NALEZ-OPAKOVANI.md existuje a není prázdný" \
  test -s dukazy/zvuk-2026-08-20/NALEZ-OPAKOVANI.md
zkontroluj "archivovaný závěr odkazuje na opakování a obsahuje korelaci 0,9638" \
  bash -c 'grep -Fq "NALEZ-OPAKOVANI.md" dukazy/zvuk-2026-08-20/NALEZ.md && grep -Fq "0,9638" dukazy/zvuk-2026-08-20/NALEZ.md'
zkontroluj "README archivu zvuku existuje a odkazuje na reprodukovatelný důkaz" \
  bash -c 'test -s dukazy/zvuk-2026-08-20/README.md && grep -Fq "nahravani-2026-08-21" dukazy/zvuk-2026-08-20/README.md'
zkontroluj "ROZHODNUTI.md neobsahuje starý odhad 18–30" \
  neobsahuje ROZHODNUTI.md "18–30"
zkontroluj "ROZHODNUTI.md netvrdí, že repo je jen lokální" \
  neobsahuje ROZHODNUTI.md "repo je zatím jen lokální"
zkontroluj "ROZHODNUTI.md netvrdí, že Opus má vadnou hlavičku" \
  neobsahuje ROZHODNUTI.md "vadnou hlavičku Opus"

echo "---"; echo "chyb: $chyby"; exit $(( chyby > 0 ? 1 : 0 ))
