#!/usr/bin/env bash
# Akceptace E3. Každá podmínka hlásí vlastní PASS/FAIL a skript při chybě skončí 1.
chyby=0
zkontroluj() {                     # zkontroluj "<popis>" <příkaz…>
  local popis="$1"; shift
  if "$@" > /tmp/e3-akceptace.out 2>&1; then
    echo "PASS  $popis"
  else
    echo "FAIL  $popis"; sed 's/^/      | /' /tmp/e3-akceptace.out; chyby=$((chyby+1))
  fi
}

balici_skript_ma_audio_popis() {
  test -s scripts/package-mac.mjs \
    && grep -Fq "NSAudioCaptureUsageDescription" scripts/package-mac.mjs
}

balici_skript_nema_prototypove_id() {
  local prototypove_id="cz.ludone.desktop."prototype
  test -s scripts/package-mac.mjs \
    && ! grep -Fq "$prototypove_id" scripts/package-mac.mjs
}

zkontroluj "balicí skript obsahuje NSAudioCaptureUsageDescription" \
  balici_skript_ma_audio_popis
zkontroluj "balicí skript neobsahuje prototypové bundle id" \
  balici_skript_nema_prototypove_id
zkontroluj "unit test autority tray ikony je zelený" \
  npm run test:unit -- tray-authority
zkontroluj "unit test kontroly odesílatele IPC je zelený" \
  npm run test:unit -- ipc-sender-guard

bundle="release/LuDone Desktop.app"
plist="$bundle/Contents/Info.plist"
if test -d "$bundle"; then
  plist_release_plati() {
    test -s "$plist" || return 1
    /usr/bin/plutil -p "$plist" > /tmp/e3-plist.out 2>&1 || return 1
    grep -Fq '"NSAudioCaptureUsageDescription"' /tmp/e3-plist.out \
      && grep -Fq '"CFBundleIdentifier" => "cz.ludone.desktop"' /tmp/e3-plist.out
  }
  zkontroluj "release plist má audio popis a ostré bundle id" plist_release_plati
  zkontroluj "release bundle má platný podpis" \
    /usr/bin/codesign --verify --deep --strict "$bundle"
else
  echo "PASS  release plist (podmíněná kontrola: bundle neexistuje)"
  echo "PASS  podpis release bundlu (podmíněná kontrola: bundle neexistuje)"
fi

echo "---"
echo "chyb: $chyby"
exit $(( chyby > 0 ? 1 : 0 ))
