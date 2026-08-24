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

oauth_mcp_bez_uploadu() {
  local soubor=docs/server-modul/autentizace.md
  grep -q 'OAuth server MCP serveru' "$soubor" &&
    grep -q 'nemá scope pro upload nahrávky' "$soubor" &&
    grep -q 'odesílání musí zůstat vypnuté' "$soubor"
}

killswitch_ma_tri_stavy() {
  local soubor=docs/server-modul/kontrakt-desktopu.md
  grep -Eq '^\| `true` \| Zapnuto \|.*síťová volání' "$soubor" &&
    grep -Eq '^\| `false` \| Vypnuto \|.*neotevře žádné upload spojení' "$soubor" &&
    grep -Eq '^\| nenastaveno \| Chybějící konfigurace \|.*`false` \(fail-closed\)' "$soubor" &&
    awk -F'|' '$2 ~ /^[[:space:]]*`(true|false)`[[:space:]]*$/ || $2 ~ /^[[:space:]]*nenastaveno[[:space:]]*$/ { n++ } END { exit !(n == 3) }' "$soubor"
}

kontrakt_ma_dve_stopy() {
  local soubor=docs/server-modul/kontrakt-desktopu.md
  grep -q 'přesně dvě položky `tracks`' "$soubor" &&
    grep -Fq '`{kind: "microphone"|"system", sizeBytes, sha256, mime}`.' "$soubor"
}

o2_je_otevrene() {
  local soubor=docs/server-modul/kontrakt-desktopu.md
  grep -q '^## Přepis — otevřený parametr O2$' "$soubor" &&
    grep -q '^Poskytovatel ani způsob přepisu nejsou rozhodnuté\.$' "$soubor"
}

o3_je_otevrene() {
  local soubor=docs/server-modul/datovy-model.md
  grep -q '^## Retence — otevřený parametr O3$' "$soubor" &&
    grep -q '^Délka retence ani právní pravidla zatím nejsou rozhodnuté\.$' "$soubor"
}

zkontroluj "adresář docs/server-modul existuje" test -d docs/server-modul
zkontroluj "datový model obsahuje recordings" grep -q recordings docs/server-modul/datovy-model.md
zkontroluj "autentizace obsahuje code_challenge_method" grep -q code_challenge_method docs/server-modul/autentizace.md
zkontroluj "kontrakt obsahuje DESKTOP_UPLOAD_ENABLED" grep -q DESKTOP_UPLOAD_ENABLED docs/server-modul/kontrakt-desktopu.md
zkontroluj "datový model má aspoň 40 neprázdných řádků" awk 'NF { n++ } END { exit !(n >= 40) }' docs/server-modul/datovy-model.md
zkontroluj "autentizace má aspoň 40 neprázdných řádků" awk 'NF { n++ } END { exit !(n >= 40) }' docs/server-modul/autentizace.md
zkontroluj "kontrakt má aspoň 40 neprázdných řádků" awk 'NF { n++ } END { exit !(n >= 40) }' docs/server-modul/kontrakt-desktopu.md
zkontroluj "MCP OAuth token nemá upload scope a odesílání zůstává vypnuté" oauth_mcp_bez_uploadu
zkontroluj "killswitch má právě tři stavy včetně nenastaveno jako fail-closed" killswitch_ma_tri_stavy
zkontroluj "nahrávka má přesně dvě stopy microphone a system" kontrakt_ma_dve_stopy
zkontroluj "přepis O2 zůstává otevřený" o2_je_otevrene
zkontroluj "retence a právní rámec O3 zůstávají otevřené" o3_je_otevrene

echo "---"; echo "chyb: $chyby"; exit $(( chyby > 0 ? 1 : 0 ))
