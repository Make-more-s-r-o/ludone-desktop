#!/usr/bin/env bash
# Akceptace E6. Vypíše PASS/FAIL za každou podmínku a skončí 1, když aspoň jedna padne.
chyby=0
zkontroluj() {                     # zkontroluj "<popis>" <příkaz…>
  local popis="$1"; shift
  if "$@" > /tmp/akc-e6.out 2>&1; then
    echo "PASS  $popis"
  else
    echo "FAIL  $popis"; sed 's/^/      | /' /tmp/akc-e6.out; chyby=$((chyby+1))
  fi
}

bez_atrapy_granted_true() {
  test -s electron/main.cjs || return 1
  test "$(grep -c "granted: true" electron/main.cjs || true)" -eq 0
}

obsahuje_cteni_stavu() {
  test -s electron/main.cjs || return 1
  grep -Fq "getMediaAccessStatus" electron/main.cjs
}

zkontroluj "permission:request už neobsahuje atrapu granted: true" \
  bez_atrapy_granted_true
zkontroluj "permission:request čte skutečný stav přes getMediaAccessStatus" \
  obsahuje_cteni_stavu
zkontroluj "unit testy oprávnění jsou zelené" \
  npm run test:unit -- permissions

echo "---"; echo "chyb: $chyby"; exit $(( chyby > 0 ? 1 : 0 ))
