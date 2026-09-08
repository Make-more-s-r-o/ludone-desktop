#!/usr/bin/env bash
# Akceptace E5. Vypíše PASS/FAIL za každou podmínku a skončí 1, když aspoň jedna padne.
chyby=0
zkontroluj() {                     # zkontroluj "<popis>" <příkaz…>
  local popis="$1"; shift
  if "$@" > /tmp/e5-akc.out 2>&1; then
    echo "PASS  $popis"
  else
    echo "FAIL  $popis"; sed 's/^/      | /' /tmp/e5-akc.out; chyby=$((chyby+1))
  fi
}

test_nenastaveneho_killswitche() {
  grep -Fq \
    "s nenastaveným DESKTOP_UPLOAD_ENABLED záměrně nic neodešle" \
    tests/queue.test.js \
    && grep -Fq "delete process.env.DESKTOP_UPLOAD_ENABLED" tests/queue.test.js \
    && grep -Fq "expect(send).toHaveBeenCalledTimes(0)" tests/queue.test.js
}

# Hlídá se KAŽDÝ killswitch zvlášť — rozhodnutí R18 žádá dva vypínače, každý
# s vlastním testem. Do 7. 9. 2026 se tu ptalo jen na odesílání, takže časový
# vypínač šel zapnout a projít celou akceptací.
zadny_zapnuty_killswitch() {       # zadny_zapnuty_killswitch <JMÉNO_VYPÍNAČE>
  local jmeno="$1"
  local vystup="/tmp/e5-killswitch-true.out"
  local hledany_retezec="$jmeno""=true"
  : > "$vystup" || return 1
  # Schválně `grep -r`, ne `rg`: ripgrep je v sandboxu Codexu, ale ne na tomhle Macu
  # ani na runneru CI — a brána, která běží jen v jednom prostředí, není brána.
  # `git grep` se sem nehodí, protože ignorované soubory nevidí, a `.env.example`
  # je právě takový soubor. Musí se tedy prohledat i to, co git ignoruje.
  #
  # 🔴 Hledá se v KONKRÉTNÍCH CESTÁCH, ne v celém stromě. Kritérium tvaru „nikde v repu
  # nesmí být řetězec X" zčervená i na dokumentaci, která X jen POPISUJE — a přesně to
  # se 25. 8. stalo: archiv zadání v `docs/behy/` ten řetězec cituje ve větě o tom, jak
  # se má tahle kontrola napsat, a brána na něm spadla. Killswitch se dá ZAPNOUT jen
  # v konfiguraci nebo v kódu, takže se prohledávají jen ta místa; `docs/` popisuje,
  # nenastavuje.
  local cile=(.env .env.example .env.local src electron scripts .github package.json)
  local existujici=()
  local c
  for c in "${cile[@]}"; do
    [ -e "$c" ] && existujici+=("$c")
  done
  # Prázdný seznam cílů = brána nemá co měřit a nesmí projít (fail-closed).
  if [ "${#existujici[@]}" -eq 0 ]; then
    echo "žádný z hlídaných cílů neexistuje — brána nemá co měřit"
    return 1
  fi
  grep -r -n -F "$hledany_retezec" "${existujici[@]}" \
    --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=out \
    --exclude-dir=release --exclude-dir=.runtime > "$vystup" 2>&1
  local stav=$?

  # Nejdřív odmítneme jakýkoli neprázdný nález, včetně diagnostiky chyby grepu.
  if test -s "$vystup"; then
    cat "$vystup"
    return 1
  fi
  test "$stav" -eq 1
}

zkontroluj "src/lib/queue.js existuje a není prázdný" test -s src/lib/queue.js
zkontroluj "electron/queue.cjs existuje a není prázdný" test -s electron/queue.cjs
zkontroluj "unit testy queue jsou zelené" npm run test:unit -- queue
zkontroluj "jmenovitý test nenastaveného killswitche je fail-closed" \
  test_nenastaveneho_killswitche
# 🔴 Druhé měření téhož vypínače, a schválně jiného druhu. Podmínka nad tímhle řádkem se
# ptá na NÁZVY tří tvrzení v `tests/queue.test.js` — chytne smazaný test, ale ne přepsaný:
# kdo nechá řetězce na místě a vyprázdní tvrzení uvnitř, nechá ji zelenou. Sonda proto měří
# CHOVÁNÍ: spouští produkční `pumpOutboundQueue`, `queueKillswitches`
# a `addQueueSendingAvailability` z `main.cjs` nad skutečným úložištěm fronty. Změřeno
# 8. 9. 2026 sabotáží: s vyprázdněnými testy a zapnutým vypínačem natvrdo zůstala grepová
# podmínka zelená a spadla jedině sonda. Obě se doplňují, ani jedna nenahrazuje druhou.
zkontroluj "vypínač odesílání je fail-closed i v produkční cestě (chování)" \
  node scripts/akceptace/fronta-sondy.mjs vypinac-odesilani-fail-closed
zkontroluj ".env.example drží killswitch odesílání vypnutý" \
  grep -Fxq "DESKTOP_UPLOAD_ENABLED=false" .env.example
zkontroluj ".env.example drží časový killswitch vypnutý" \
  grep -Fxq "DESKTOP_TIME_ENABLED=false" .env.example
zkontroluj "nikde v repu není killswitch odesílání zapnutý" \
  zadny_zapnuty_killswitch DESKTOP_UPLOAD_ENABLED
zkontroluj "nikde v repu není časový killswitch zapnutý" \
  zadny_zapnuty_killswitch DESKTOP_TIME_ENABLED
zkontroluj "chybějící hodnota časového killswitche nic nezaznamená (fail-closed)" \
  node scripts/akceptace/casovac-sondy.mjs vypinac-fail-closed

echo "---"; echo "chyb: $chyby"; exit $(( chyby > 0 ? 1 : 0 ))
