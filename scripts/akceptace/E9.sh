#!/usr/bin/env bash
# Akceptace E9 — časovač (F011 + F013). Vypíše PASS/FAIL za každou podmínku
# a skončí 1, když aspoň jedna padne.
#
# Proč vlastní skript, a ne přílepek k E5: E5 hlídá KILLSWITCHE napříč moduly
# (hygienu vypínačů), kdežto tady jde o agendu časovače — že zaznamenaný čas
# přežije pád, že se nedostane do mzdových nákladů, když nemá, a že se jeho
# ztráta nedá přehlédnout. Kdyby to viselo v E5, zčervenalá brána by neřekla,
# jestli je vada ve vypínači, nebo v časovači.
#
# 🔴 Podmínky měří CHOVÁNÍ. Sonda spouští skutečný `electron/tracking.cjs`
# i skutečné tělo `runTrackingMutation` a `noteDeferredQuitFailure` vytažené
# z `electron/main.cjs`, takže smazání testů žádnou z nich nezezelená.
chyby=0
zkontroluj() {                     # zkontroluj "<popis>" <příkaz…>
  local popis="$1"; shift
  if "$@" > /tmp/e9-akc.out 2>&1; then
    echo "PASS  $popis"
  else
    echo "FAIL  $popis"; sed 's/^/      | /' /tmp/e9-akc.out; chyby=$((chyby+1))
  fi
}

sonda() { node scripts/akceptace/casovac-sondy.mjs "$1"; }

zkontroluj "electron/tracking.cjs existuje a není prázdný" test -s electron/tracking.cjs
zkontroluj "unit testy časovače jsou zelené" npm run test:unit -- tracking-timer
zkontroluj "zaznamenaný čas přežije pád rendereru i restart aplikace" \
  sonda prezije-pad-rendereru
zkontroluj "s vypnutým časovým vypínačem se čas nedostane do odchozí fronty" \
  sonda vypnuty-vypinac-nefronti
zkontroluj "zahozený úsek se do fronty nedostane ani se zapnutým vypínačem" \
  sonda zahozeny-cas-nefronti
zkontroluj "selhání zařazení času do fronty si vyžádá potvrzení a čas neztratí" \
  sonda selhani-fronty-neztichne

echo "---"; echo "chyb: $chyby"; exit $(( chyby > 0 ? 1 : 0 ))
