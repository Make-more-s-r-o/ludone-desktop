#!/usr/bin/env bash
# Důkaz, že E2 brány umějí zčervenat. Skript záměrně mutuje cizí kód,
# doslovně vypisuje červené logy a každou změnu obnovuje výhradně z HEAD.
# Spouští ho orchestrátor až nad commitnutým E2 stromem. Audio sabotáž je
# volitelná přepínačem --audio, protože potřebuje fyzický zvuk a oprávnění.
set -u

cd "$(git rev-parse --show-toplevel)" || exit 1

audio_sabotaz=0
if [[ "${1:-}" == "--audio" ]]; then audio_sabotaz=1; fi

zelena_brana() {
  local popis="$1" log="$2"; shift 2
  if "$@" > "$log" 2>&1; then
    echo "PASS  výchozí/obnovená brána: $popis"
    cat "$log"
    return 0
  fi
  echo "STOP  nedotčená nebo obnovená brána není zelená: $popis"
  cat "$log"
  return 1
}

cervena_brana() {
  local popis="$1" log="$2"; shift 2
  if "$@" > "$log" 2>&1; then
    echo "FAIL  sabotáž bránu nezbarvila červeně: $popis"
    cat "$log"
    return 1
  fi
  echo "PASS  sabotáž zbarvila bránu červeně: $popis"
  cat "$log"
  return 0
}

over_cisty_cil() {
  local cesta="$1"
  if ! git diff --quiet HEAD -- "$cesta" || ! git diff --cached --quiet HEAD -- "$cesta"; then
    echo "STOP  cíl sabotáže není shodný s HEAD: $cesta"
    return 1
  fi
}

vypis_assert_chunku() {
  sed -n '/async function appendRecordingChunk/,/^}/p' electron/main.cjs \
    | grep -E 'sequence.*track\.nextSequence|track\.nextSequence.*\+=' || true
}

spust_ui_branu() {
  local data_root app_executable app_pid exit_code
  data_root="$(mktemp -d /tmp/ludone-e2-ui.XXXXXX)" || return 1
  npm run package:mac || { rm -rf "$data_root"; return 1; }
  app_executable="release/LuDone Desktop.app/Contents/MacOS/LuDone Desktop"
  if [[ ! -x "$app_executable" ]]; then
    app_executable="release/LuDone Desktop.app/Contents/MacOS/Electron"
  fi
  env LUDONE_E2E=1 LUDONE_RESET_ONBOARDING=1 \
    LUDONE_E2E_HARD_STOP_MS=120000 LUDONE_DATA_DIR="$data_root" \
    "$app_executable" \
    --remote-debugging-port=9333 > "$data_root/application.log" 2>&1 &
  app_pid=$!
  node scripts/ui-smoke.mjs
  exit_code=$?
  kill "$app_pid" 2>/dev/null || true
  wait "$app_pid" 2>/dev/null || true
  rm -rf "$data_root"
  return "$exit_code"
}

echo "=== sabotáž a: pořadí chunků ==="
over_cisty_cil electron/main.cjs || exit 1
zelena_brana "test pořadí chunků před mutací" /tmp/e2-sabotaz-a-pred.log \
  npm run test:unit -- recording-order-guard || exit 1
echo "ASSERT ČTE PŘED MUTACÍ:"
vypis_assert_chunku
perl -0pi -e 's/    if \(sequence !== track\.nextSequence\) \{\n.*?\n    \}/    \/\* E2_SABOTAZ_CHUNK_ORDER_REMOVED \*\//s' electron/main.cjs
if [[ "$(grep -c 'E2_SABOTAZ_CHUNK_ORDER_REMOVED' electron/main.cjs)" -le 0 ]]; then
  echo "STOP  sabotáž a minula cíl"
  exit 1
fi
echo "ASSERT ČTE PO MUTACI:"
vypis_assert_chunku
if ! cervena_brana "odstraněná kontrola pořadí chunků" /tmp/e2-sabotaz-a-cervena.log \
  npm run test:unit -- recording-order-guard; then
  git checkout HEAD -- electron/main.cjs
  exit 1
fi
git checkout HEAD -- electron/main.cjs
zelena_brana "test pořadí chunků po obnově" /tmp/e2-sabotaz-a-po.log \
  npm run test:unit -- recording-order-guard || exit 1

echo "=== sabotáž b: přejmenované tlačítko ==="
ui_cil="src/features/recording/RecordingCard.jsx"
over_cisty_cil "$ui_cil" || exit 1
zelena_brana "ui-smoke před mutací" /tmp/e2-sabotaz-b-pred.log spust_ui_branu || exit 1
perl -0pi -e 's/Ukončit a uložit/E2_SABOTAZ_UKONCIT_A_ULOZIT/g' "$ui_cil"
if [[ "$(grep -c 'E2_SABOTAZ_UKONCIT_A_ULOZIT' "$ui_cil")" -le 0 ]]; then
  echo "STOP  sabotáž b minula cíl"
  exit 1
fi
if ! cervena_brana "přejmenované tlačítko Ukončit a uložit" /tmp/e2-sabotaz-b-cervena.log \
  spust_ui_branu; then
  git checkout HEAD -- "$ui_cil"
  exit 1
fi
git checkout HEAD -- "$ui_cil"
zelena_brana "ui-smoke po obnově" /tmp/e2-sabotaz-b-po.log spust_ui_branu || exit 1

echo "=== sabotáž c: znečištěný tichý běh ==="
if [[ "$audio_sabotaz" -ne 1 ]]; then
  echo "SKIP  spusť znovu s --audio na skutečném Macu se zvukem a oprávněními"
  exit 0
fi

audio_cil="scripts/audio-smoke.mjs"
over_cisty_cil "$audio_cil" || exit 1
zelena_brana "audio-smoke před znečištěním" /tmp/e2-sabotaz-c-pred.log npm run test:audio || exit 1
perl -0pi -e 's/(const MAX_SILENCE_ATTEMPTS = 3;)/$1\n\/\* E2_SABOTAZ_AUDIO_CONTAMINATION \*\//' "$audio_cil"
if [[ "$(grep -c 'E2_SABOTAZ_AUDIO_CONTAMINATION' "$audio_cil")" -le 0 ]]; then
  echo "STOP  sabotáž c minula cíl"
  exit 1
fi
while :; do /usr/bin/afplay /System/Library/Sounds/Sosumi.aiff; done &
audio_pid=$!
cervena_brana "opakovaně znečištěné měření" /tmp/e2-sabotaz-c-cervena.log npm run test:audio
audio_cervena=$?
kill "$audio_pid" 2>/dev/null || true
wait "$audio_pid" 2>/dev/null || true
git checkout HEAD -- "$audio_cil"
if [[ "$audio_cervena" -ne 0 ]]; then exit 1; fi
if ! grep -q "Tichý běh zahozen" /tmp/e2-sabotaz-c-cervena.log \
  || ! grep -q "opakovaně znečištěné" /tmp/e2-sabotaz-c-cervena.log; then
  echo "FAIL  audio brána nerozlišila zahození a vyčerpání pokusů"
  exit 1
fi
zelena_brana "audio-smoke po odstranění znečištění" /tmp/e2-sabotaz-c-po.log \
  npm run test:audio || exit 1
