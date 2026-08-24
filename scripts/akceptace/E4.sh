#!/usr/bin/env bash
# Akceptace E4. Vypíše PASS/FAIL za každou podmínku a skončí 1, když aspoň jedna padne.
chyby=0
zkontroluj() {                     # zkontroluj "<popis>" <příkaz…>
  local popis="$1"; shift
  if "$@" > /tmp/e4-akc.out 2>&1; then
    echo "PASS  $popis"
  else
    echo "FAIL  $popis"; sed 's/^/      | /' /tmp/e4-akc.out; chyby=$((chyby+1))
  fi
}

zkontroluj "src/lib/manifest.js existuje a není prázdný" test -s src/lib/manifest.js
zkontroluj "manifest test jmenovitě pokrývá pád před prvním chunkem" \
  grep -Fq "po simulovaném pádu před prvním chunkem manifest existuje a má stav incomplete" \
  tests/manifest.test.js
zkontroluj "unit testy manifest jsou zelené" npm run test:unit -- manifest

echo "---"; echo "chyb: $chyby"; exit $(( chyby > 0 ? 1 : 0 ))
