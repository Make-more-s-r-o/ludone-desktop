#!/usr/bin/env bash
# Akceptace E2. Každá podmínka hlásí vlastní PASS/FAIL.
chyby=0

zkontroluj() {
  local popis="$1"; shift
  if "$@" > /tmp/akc.out 2>&1; then
    echo "PASS  $popis"
  else
    echo "FAIL  $popis"
    sed 's/^/      | /' /tmp/akc.out
    chyby=$((chyby + 1))
  fi
}

zkontroluj "lint je zelený" npm run lint
zkontroluj "typecheck je zelený a kontroluje nové soubory" npm run typecheck
zkontroluj "typecheck rozsah není prázdný" \
  bash -c './node_modules/.bin/tsc --noEmit -p jsconfig.json --listFilesOnly | grep -q "/tests/"'
zkontroluj "unit testy jsou zelené" npm run test:unit
zkontroluj "filtr test:unit vybere manifest test" npm run test:unit -- manifest
zkontroluj "existuje CI workflow" test -f .github/workflows/ci.yml
zkontroluj "audio brána má platnou syntaxi" node --check scripts/audio-smoke.mjs
zkontroluj "audio brána obsahuje práh znečištěného ticha" \
  grep -q "SILENCE_CONTAMINATION_MAX_BYTES" scripts/audio-smoke.mjs
zkontroluj "audio brána rozlišuje znečištění a selhání aplikace" \
  bash -c 'grep -q "measurement-contaminated" scripts/audio-smoke.mjs && grep -q "application-did-not-record" scripts/audio-smoke.mjs'
zkontroluj "CI vysvětluje vypnuté smoke testy" \
  bash -c 'grep -q "GUI" .github/workflows/ci.yml && grep -q "zvuk" .github/workflows/ci.yml && grep -q "Záznam obrazovky" .github/workflows/ci.yml'

echo "---"
echo "chyb: $chyby"
exit $((chyby > 0 ? 1 : 0))
