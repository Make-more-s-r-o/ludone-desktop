#!/usr/bin/env bash
# Akceptace E8. Vypíše PASS/FAIL za každou podmínku a skončí 1, když aspoň jedna padne.
chyby=0
zkontroluj() {                     # zkontroluj "<popis>" <příkaz…>
  local popis="$1"; shift
  if "$@" > /tmp/akc.out 2>&1; then
    echo "PASS  $popis"
  else
    echo "FAIL  $popis"; sed 's/^/      | /' /tmp/akc.out; chyby=$((chyby+1))
  fi
}

zkontroluj "adresář docs/server-modul existuje" test -d docs/server-modul
zkontroluj "datový model obsahuje recordings" grep -q recordings docs/server-modul/datovy-model.md
zkontroluj "autentizace obsahuje code_challenge_method" grep -q code_challenge_method docs/server-modul/autentizace.md
zkontroluj "kontrakt obsahuje DESKTOP_UPLOAD_ENABLED" grep -q DESKTOP_UPLOAD_ENABLED docs/server-modul/kontrakt-desktopu.md
zkontroluj "datový model má aspoň 40 řádků" sh -c '[ "$(wc -l < "$1")" -ge 40 ]' sh docs/server-modul/datovy-model.md
zkontroluj "autentizace má aspoň 40 řádků" sh -c '[ "$(wc -l < "$1")" -ge 40 ]' sh docs/server-modul/autentizace.md
zkontroluj "kontrakt má aspoň 40 řádků" sh -c '[ "$(wc -l < "$1")" -ge 40 ]' sh docs/server-modul/kontrakt-desktopu.md

echo "---"; echo "chyb: $chyby"; exit $(( chyby > 0 ? 1 : 0 ))
