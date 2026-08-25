#!/usr/bin/env bash
# Akceptace E7. Vypíše PASS/FAIL za každou podmínku a skončí 1, když aspoň jedna padne.
chyby=0
preskoceno=0
vystup=$(mktemp "${TMPDIR:-/tmp}/ludone-e7-akceptace.XXXXXX")
metadata=$(mktemp "${TMPDIR:-/tmp}/ludone-e7-metadata.XXXXXX")
curl_chyba=$(mktemp "${TMPDIR:-/tmp}/ludone-e7-curl.XXXXXX")
trap 'rm -f "$vystup" "$metadata" "$curl_chyba"' EXIT
zkontroluj() {                     # zkontroluj "<popis>" <příkaz…>
  local popis="$1"; shift
  if "$@" > "$vystup" 2>&1; then
    echo "PASS  $popis"
  else
    echo "FAIL  $popis"; sed 's/^/      | /' "$vystup"; chyby=$((chyby+1))
  fi
}

zadny_ulozeny_token() {
  local vzor report git_status
  vzor="(ya29\\.[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}|ldmcp_oauth_(access|refresh)_[A-Za-z0-9_-]{16,}|(access|refresh)_token[[:space:]]*[:=][[:space:]]*['\"][A-Za-z0-9._~-]{20,}['\"])"
  report=$(mktemp "${TMPDIR:-/tmp}/ludone-e7-nalezy.XXXXXX")
  git grep --untracked -nEI "$vzor" -- . ':(exclude)scripts/akceptace/E7.sh' \
    | awk -F: '{ print $1 ":" $2 }' > "$report"
  git_status=${PIPESTATUS[0]}
  if test "$git_status" -eq 0; then
    echo "Nálezy (hodnoty jsou záměrně skryté):"
    sed 's/^/  /' "$report"
    rm -f "$report"
    return 1
  fi
  rm -f "$report"
  if test "$git_status" -eq 1; then
    return 0
  fi
  echo "Scanner tajemství selhal s kódem $git_status"
  return "$git_status"
}

zkontroluj "unit testy PKCE jsou zelené" npm run test:unit -- pkce
zkontroluj "unit testy OAuth state jsou zelené" npm run test:unit -- oauth-state
zkontroluj "čistá OAuth logika vynucuje code_challenge_method S256" \
  bash -c 'grep -q "code_challenge_method" src/lib/oauth.js && grep -q "S256" src/lib/oauth.js'
zkontroluj "repozitář neobsahuje hodnotu vypadající jako uložený token" zadny_ulozeny_token

if curl -fsS --connect-timeout 3 --max-time 8 \
  https://labs.ludone.cz/.well-known/oauth-authorization-server > "$metadata" 2>"$curl_chyba"; then
  zkontroluj "živé OAuth discovery má platná metadata a podporuje PKCE S256" \
    jq -e 'type == "object"
      and (.registration_endpoint | type == "string")
      and (.code_challenge_methods_supported | type == "array" and (index("S256") != null))' \
      "$metadata"
else
  curl_status=$?
  if test "$curl_status" -eq 6; then
    echo "SKIP  živé OAuth discovery: DNS není v tomto prostředí dostupné (curl 6)"
    preskoceno=$((preskoceno+1))
  else
    echo "FAIL  živé OAuth discovery: curl skončil kódem $curl_status"
    sed 's/^/      | /' "$curl_chyba"
    chyby=$((chyby+1))
  fi
fi

echo "---"; echo "chyb: $chyby; přeskočeno: $preskoceno"; exit $(( chyby > 0 ? 1 : 0 ))
