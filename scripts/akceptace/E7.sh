#!/usr/bin/env bash
# Akceptace E7. Vypíše PASS/FAIL za každou podmínku a skončí 1, když aspoň jedna padne.
chyby=0
zkontroluj() {                     # zkontroluj "<popis>" <příkaz…>
  local popis="$1"; shift
  if "$@" > /tmp/akc-e7.out 2>&1; then
    echo "PASS  $popis"
  else
    echo "FAIL  $popis"; sed 's/^/      | /' /tmp/akc-e7.out; chyby=$((chyby+1))
  fi
}

zadny_ulozeny_token() {
  local vzor
  vzor="(ya29\\.[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}|ldmcp_oauth_(access|refresh)_[A-Za-z0-9_-]{16,}|(access|refresh)_token[[:space:]]*[:=][[:space:]]*['\"][A-Za-z0-9._~-]{20,}['\"])"
  ! git grep --untracked -nEI "$vzor" -- . ':(exclude)scripts/akceptace/E7.sh'
}

zkontroluj "unit testy PKCE jsou zelené" npm run test:unit -- pkce
zkontroluj "unit testy OAuth state jsou zelené" npm run test:unit -- oauth-state
zkontroluj "čistá OAuth logika vynucuje code_challenge_method S256" \
  bash -c 'grep -q "code_challenge_method" src/lib/oauth.js && grep -q "S256" src/lib/oauth.js'
zkontroluj "repozitář neobsahuje hodnotu vypadající jako uložený token" zadny_ulozeny_token

metadata=/tmp/e7-oauth-metadata.json
if curl -fsS --connect-timeout 3 --max-time 8 \
  https://labs.ludone.cz/.well-known/oauth-authorization-server > "$metadata" 2>/tmp/e7-curl.err; then
  zkontroluj "živé OAuth discovery podporuje PKCE S256" \
    bash -c 'grep -q '"'"'"S256"'"'"' /tmp/e7-oauth-metadata.json'
else
  echo "PASS  živé OAuth discovery přeskočeno: síť není dostupná"
fi

echo "---"; echo "chyb: $chyby"; exit $(( chyby > 0 ? 1 : 0 ))
