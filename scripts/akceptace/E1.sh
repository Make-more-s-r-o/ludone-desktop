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

zkontroluj "AGENTS.md existuje a má aspoň 40 řádků" \
  bash -c 'test -f AGENTS.md && test "$(wc -l < AGENTS.md)" -ge 40'
zkontroluj "archivovaný NALEZ.md existuje" \
  test -f dukazy/zvuk-2026-08-20/NALEZ.md
zkontroluj "archivovaný NALEZ-OPAKOVANI.md existuje" \
  test -f dukazy/zvuk-2026-08-20/NALEZ-OPAKOVANI.md
zkontroluj "archivovaný závěr odkazuje na opakování a obsahuje korelaci 0,9638" \
  bash -c 'grep -Fq "NALEZ-OPAKOVANI.md" dukazy/zvuk-2026-08-20/NALEZ.md && grep -Fq "0,9638" dukazy/zvuk-2026-08-20/NALEZ.md'
zkontroluj "ROZHODNUTI.md neobsahuje starý odhad 18–30" \
  bash -c '! grep -Fq "18–30" ROZHODNUTI.md'
zkontroluj "ROZHODNUTI.md netvrdí, že repo je jen lokální" \
  bash -c '! grep -Fq "repo je zatím jen lokální" ROZHODNUTI.md'
zkontroluj "ROZHODNUTI.md netvrdí, že Opus má vadnou hlavičku" \
  bash -c '! grep -Fq "vadnou hlavičku Opus" ROZHODNUTI.md'

echo "---"; echo "chyb: $chyby"; exit $(( chyby > 0 ? 1 : 0 ))
