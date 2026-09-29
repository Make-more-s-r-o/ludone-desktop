---
kind: review
ref: desktop-astra-parity-0-1-6
verdict: "🧪 zelené testy"
measuredAt: 2026-09-29T23:12:07.825144+00:00
scope:
  - lokální integrita dokončených i rozpracovaných souborů
measuredFrom:
  - diskové snapshoty a renderer
  - doslovné targeted testové výpisy
---

# Kontrola pravdivosti místního zvuku

🧪 Cílené testy rendereru a snapshotu jsou zelené; širší související sada má níže uvedený kontraktní rozpor.

`complete-audio` nyní vyžaduje dokončený manifest a všechny očekávané nenulové soubory. Rozpracovaný manifest nebo prázdný zvuk používá existující `partial-audio` a přesný důvod, a to pro položky fronty i orphan položky. Zcela chybějící soubory zůstávají `missing-audio`.

## Review diffu

Čtení souborů zůstává pouze read-only, včetně původních kontrol symlinků, stability a bezpečných cest. Změna nezapisuje na disk, nevolá síť, nepřidává IPC a nemění queue/server stav, revizi, vlastníka, upload intent ani výsledek ověření. Nemění pravidla allowedActions. Testy ověřují zachování původních bajtů a serverových faktů a renderer nevykreslí neúplný zvuk jako kompletní. Žádné bezpečnostní oprávnění se nerozšiřuje.

⚠️ Test `tests/queue.test.js:218` očekává staré `complete-audio` u souboru velikosti 0 B. Tento expectation přímo odporuje nyní požadované opravě. Test leží mimo přidělený scope; nebyl změněn, vynechán ani baselinován. Širší sada proto má exit 1 (173/174 PASS). Root musí při integraci vědomě upravit zastaralý expectation podle nové specifikace a znovu ověřit brány.

⛔ Testovací syntetická data neprokazují skutečný zvuk, produkční server ani crash/restart aplikace. Mac smoke a Electron startup fixture ověřuje koordinátor samostatně.

## Doslovné výsledky příkazů

### node_modules/.bin/vitest run tests/recordings-dashboard.test.js

```text

 RUN  v3.2.7 /Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/astra-recording-integrity

 ✓ tests/recordings-dashboard.test.js (21 tests) 306ms

 Test Files  1 passed (1)
      Tests  21 passed (21)
   Start at  01:00:23
   Duration  922ms (transform 44ms, setup 7ms, collect 447ms, tests 306ms, environment 0ms, prepare 31ms)

exit_code=0
```

### npm run typecheck

```text

> ludone-desktop-prototype@0.1.6 typecheck
> tsc --noEmit -p jsconfig.json

exit_code=0
```

### node_modules/.bin/eslint electron/recordings-dashboard.cjs tests/recordings-dashboard.test.js

```text
exit_code=0
```

### node_modules/.bin/vitest run tests/recordings-dashboard.test.js tests/queue.test.js tests/recording-actions.test.js

```text

 RUN  v3.2.7 /Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/astra-recording-integrity

 ✓ tests/recording-actions.test.js (18 tests) 533ms
 ✓ tests/recordings-dashboard.test.js (21 tests) 354ms
 ❯ tests/queue.test.js (135 tests | 1 failed) 1654ms
   × read-only lokální přehled nahrávek > spojí frontu s orphan manifesty, ignoruje sidecar a rozliší úplnost i nulový soubor 37ms
     → expected { …(15) } to match object { source: 'orphan', …(4) }
(10 matching properties omitted from actual)
   ✓ read-only lokální přehled nahrávek > odliší missing a invalid manifest, neuhodne ID a fileRevision reaguje na disk 14ms
   ✓ read-only lokální přehled nahrávek > rozbitou frontu odmítne před scanem a nic na disku nezmění 13ms
   ✓ read-only lokální přehled nahrávek > symlink a podadresář nesmí vytvořit použitelnou orphan kartu 2ms
   ✓ read-only lokální přehled nahrávek > queue řádek bez UUID skončí jen v unreadableCount 2ms
   ✓ read-only lokální přehled nahrávek > odmítne symlink kořene před čtením a nadlimitní manifest jen bezpečně sečte 3ms
   ✓ vlastník nahrávky v perzistentní frontě > ukládá jen stabilní doménově oddělený SHA-256 otisk, ne čitelnou identitu 0ms
   ✓ vlastník nahrávky v perzistentní frontě > bez tajemství se otisk NEODVODÍ — musí vyjít null 0ms
   ✓ vlastník nahrávky v perzistentní frontě > produkční store přidá otisk k dvoustopé i jednostopé položce 30ms
   ✓ vlastník nahrávky v perzistentní frontě > anonymní enqueue zapíše null a pozdější opakování jej nepřivlastní 17ms
   ✓ vlastník nahrávky v perzistentní frontě > starou položku schématu v1 bez pole vlastníka načte beze ztráty jako neznámou 4ms
   ✓ produkční čtení killswitchů > 'bez env smí projít jednotlivě schvále…' 1ms
   ✓ produkční čtení killswitchů > 'false ve vypínači nahrávek zůstane di…' 0ms
   ✓ produkční čtení killswitchů > 'nepřesné TRUE vypínač nahrávek nezapne' 0ms
   ✓ produkční čtení killswitchů > 'přesný řetězec true zapne nahrávky' 0ms
   ✓ produkční čtení killswitchů > 'zapnutý časový vypínač nemění schvále…' 0ms
   ✓ produkční čtení killswitchů > 'nenastavený vypínač času zůstane disa…' 0ms
   ✓ produkční čtení killswitchů > 'false ve vypínači času zůstane disabl…' 0ms
   ✓ produkční čtení killswitchů > 'nepřesné TRUE vypínač času nezapne' 0ms
   ✓ produkční čtení killswitchů > 'přesný řetězec true zapne čas' 0ms
   ✓ produkční čtení killswitchů > 'produkčně zapnutý vypínač nahrávek ne…' 0ms
   ✓ killswitch odchozí fronty > s nenastaveným DESKTOP_UPLOAD_ENABLED záměrně nic neodešle 0ms
   ✓ killswitch odchozí fronty > s hodnotou false nic neodešle a vrátí důvod vypnutí 0ms
   ✓ killswitch odchozí fronty > s hodnotou true zavolá pouze mockovanou odesílací vrstvu 0ms
   ✓ killswitch odchozí fronty > jiná pravdivostní hodnota odesílání nezapne 0ms
   ✓ killswitch odchozí fronty > časová položka používá samostatný zapnutý vypínač 0ms
   ✓ killswitch odchozí fronty > zapnutý vypínač času nepovolí nahrávku 0ms
   ✓ killswitch odchozí fronty > zapnutý vypínač nahrávek nepovolí časovou položku 0ms
   ✓ killswitch odchozí fronty > boolean true časový vypínač fail-closed nezapne 0ms
   ✓ killswitch odchozí fronty > blokovaná položka má přednost před položkou čekající na čas 0ms
   ✓ stavový automat fronty > zařazená nahrávka nese rozlišovač typu 0ms
   ✓ stavový automat fronty > zařazený časový záznam nese typ time a klíč z B5 0ms
   ✓ stavový automat fronty > časový záznam se sazbou se odmítne 0ms
   ✓ stavový automat fronty > do časové položky se nedostane žádné pole se sazbou 0ms
   ✓ stavový automat fronty > dvojí zařazení stejného clientTimeEntryId vytvoří jedinou položku 0ms
   ✓ stavový automat fronty > dvojí zařazení stejného clientRecordingId vytvoří jedinou položku 0ms
   ✓ stavový automat fronty > produkční store zařadí jednostopu pravdivě a idempotentně 11ms
   ✓ stavový automat fronty > shodné ID jiné položky nesmí předstírat idempotentní obnovu nahrávky 0ms
   ✓ stavový automat fronty > neúspěch ponechá položku ve frontě a zvýší počet pokusů 0ms
   ✓ stavový automat fronty > sentAt vznikne až po dokončení odesílání 0ms
   ✓ stavový automat fronty > 🔴 po 429 počká přesně tolik, kolik řekl server, ne podle vlastního rozvrhu 0ms
   ✓ stavový automat fronty > 429 zachová původní attempts i částečný per-track progress a bez intervalu čeká hodinu 0ms
   ✓ stavový automat fronty > HTTP 429 u timeentry zachová původní retryable kontrakt bez rate_limited outcome 0ms
   ✓ stavový automat fronty > cooldown na přesné hraně expirace není chyba a dovolí recording send 0ms
   ✓ stavový automat fronty > retry prodlevu počítá až od dokončení neúspěšného pokusu 0ms
   ✓ stavový automat fronty > po vyčerpání pokusů označí položku jako selhalo a nesmaže ji 0ms
   ✓ stavový automat fronty > vrátí selhalo do ceka bez změny důvodu, vlastníka (sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa) a vstupní fronty 0ms
   ✓ stavový automat fronty > vrátí selhalo do ceka bez změny důvodu, vlastníka (null) a vstupní fronty 0ms
   ✓ stavový automat fronty > vrácení položky ve stavu ceka ponechá původní frontu i položku 0ms
   ✓ stavový automat fronty > vrácení položky ve stavu odesila ponechá původní frontu i položku 0ms
   ✓ stavový automat fronty > vrácení položky ve stavu odeslano ponechá původní frontu i položku 0ms
   ✓ stavový automat fronty > vrácená položka se opravdu dostane k dalšímu pokusu, ne jen do stavu ceka 0ms
   ✓ stavový automat fronty > kód rodiny vlastnictví se ručním vrácením neobejde 0ms
   ✓ stavový automat fronty > starší česká hláška se ručním vrácením neobejde 0ms
   ✓ stavový automat fronty > vrácení neznámého clientRecordingId odmítne a frontu nezmění 0ms
   ✓ stavový automat fronty > po selhání permanent umožní nový pokus s obnoveným rozpočtem pokusů 0ms
   ✓ stavový automat fronty > po selhání retryable umožní nový pokus s obnoveným rozpočtem pokusů 0ms
   ✓ stavový automat fronty > opakování používá rostoucí exponenciální prodlevu s pevným stropem 0ms
   ✓ stavový automat fronty > připne firmu jediným pre-init eventem a zachová ji v dalším progressu 0ms
   ✓ stavový automat fronty > explicitní retry přepne firmu jen bez serverových ID a zachová initialized pin 0ms
   ✓ stavový automat fronty > offsety obou stop vždy převezme ze serveru místo lokálního odhadu 0ms
   ✓ stavový automat fronty > ukládá recordingId po stopách a odmítne pozdější změnu ID nebo session 0ms
   ✓ stavový automat fronty > odmítne neplatné nebo společné recordingId dvou stop 0ms
   ✓ stavový automat fronty > propustí ověřený návrat senderu do výsledku i per-stopového stavu fronty 0ms
   ✓ stavový automat fronty > výsledek senderu nesmí uložit neexistující stopu ani označit položku jako odeslanou 0ms
   ✓ stavový automat fronty > postup k neznámé nahrávce odmítne a frontu nezmění 0ms
   ✓ stavový automat fronty > vyžaduje killswitch v podpisu spolu s odesílací vrstvou 0ms
   ✓ stavový automat fronty > trvalá chyba skončí při prvním pokusu a neopakuje se pětkrát 0ms
   ✓ stavový automat fronty > pauza invalid_grant nespotřebuje pokus 0ms
   ✓ stavový automat fronty > starší položka bez kind se čte jako nahrávka 0ms
   ✓ stavový automat fronty > pohled pro renderer neobsahuje absolutní cesty ani manifest 0ms
   ✓ stavový automat fronty > projekce odliší neznámého, vlastního a cizího vlastníka bez zveřejnění otisku 0ms
   ✓ stavový automat fronty > projekce zpřístupní jen bezpečná serverová pole a přesný důvod blokace 0ms
   ✓ stavový automat fronty > NEZNÁMÝ vlastnický důvod se bere jako čekající na člověka: queue_owner_revoked 0ms
   ✓ stavový automat fronty > NEZNÁMÝ vlastnický důvod se bere jako čekající na člověka: session_owner_expired 0ms
   ✓ stavový automat fronty > rozpozná už uložený vlastnický důvod bez nového příznaku: Nahrávka patří jinému účtu 0ms
   ✓ stavový automat fronty > rozpozná už uložený vlastnický důvod bez nového příznaku: Vlastník nahrávky není potvrzený; před odesláním je nutné potvrzení člověkem 0ms
   ✓ stavový automat fronty > rozpozná už uložený vlastnický důvod bez nového příznaku: Identitu aktuálního přihlášení nelze ověřit 0ms
   ✓ stavový automat fronty > nevybraná firma je čekání na člověka, ne tiché stání fronty 0ms
   ✓ stavový automat fronty > nedosažitelný seznam firem je opakovatelný a frontu nezastaví 0ms
   ✓ stavový automat fronty > insufficient_scope (HTTP 403) je čekání na člověka, ne tichá nekonečná smyčka 0ms
   ✓ stavový automat fronty > položka pauznutá na insufficient_scope se další pumpou sama nezkusí 0ms
   ✓ stavový automat fronty > nahrávku bez vlastníka přeskočí a odešle další v pořadí 0ms
   ✓ stavový automat fronty > když jsou všechny připravené bez vlastníka, označí je všechny a nic neodešle 0ms
   ✓ stavový automat fronty > 🔴 chyba přihlášení pump ZASTAVÍ a zbytek fronty vůbec nezkouší 0ms
   ✓ stavový automat fronty > neznámý důvod pauzy pump taky zastaví (fail-closed) 0ms
   ✓ stavový automat fronty > libovolná jiná pauza se slovem owner nepatří bez výslovného kontraktu člověku 0ms
   ✓ stavový automat fronty > volná podobnost historické zprávy nevytvoří lidský zásah: Vlastník databáze je potvrzen, ale server není dostupný 0ms
   ✓ stavový automat fronty > volná podobnost historické zprávy nevytvoří lidský zásah: Identitu zařízení se po přihlášení nepodařilo načíst 0ms
   ✓ stavový automat fronty > volná podobnost historické zprávy nevytvoří lidský zásah: Nahrávka se kvůli síti nepřiřadila jinému účtu 0ms
   ✓ stavový automat fronty > další pumpa položku čekající na člověka sama znovu nezkouší 0ms
   ✓ trvalé uložení fronty > potvrzené převzetí změní jedinou položku, vyčistí cizí serverová ID a zůstane držené 32ms
   ✓ trvalé uložení fronty > stale revision a zamítnutý guard nezapíšou převzetí 15ms
   ✓ trvalé uložení fronty > staré jednostopé serverové schéma načte beze lži o stopě 9ms
   ✓ trvalé uložení fronty > staré dvoustopé serverové schéma načte beze lži o stopě 1ms
   ✓ trvalé uložení fronty > po restartu zachová data a doplní neznámého vlastníka 12ms
   ✓ trvalé uložení fronty > atomický zápis fsyncne data i adresář 0ms
   ✓ čisté převzetí nahrávky > odmítne stav odesila 0ms
   ✓ čisté převzetí nahrávky > odmítne stav odeslano 0ms
   ✓ čisté převzetí nahrávky > odmítne neplatný otisk null 0ms
   ✓ čisté převzetí nahrávky > odmítne neplatný otisk "" 0ms
   ✓ čisté převzetí nahrávky > odmítne neplatný otisk "sha256:kratke" 0ms
   ✓ čisté převzetí nahrávky > odmítne neplatný otisk "sha256:GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG" 0ms
   ✓ čisté převzetí nahrávky > odmítne převzetí pod už uloženého vlastníka 0ms
   ✓ obnova osiřelých nahrávek > obnoví dokončenou jednostopu bez vymyšleného systémového souboru 19ms
   ✓ obnova osiřelých nahrávek > dvojí obnova nevytvoří dvě položky 16ms
   ✓ obnova osiřelých nahrávek > opakovaná obnova zachová už uložený stereo descriptor 29ms
   ✓ obnova osiřelých nahrávek > poškozený manifest obnovu nezastaví, zůstane ležet a neprozradí název 15ms
   ✓ obnova osiřelých nahrávek > incomplete manifest opraví do uploadovatelného sidecaru a originál zachová 37ms
   ✓ obnova osiřelých nahrávek > jednu nulovou stopu zařadí jako chráněný raw incomplete záznam 11ms
   ✓ obnova osiřelých nahrávek > complete manifest s jednou nulovou stopou obnoví do viditelné fronty 17ms
   ✓ obnova osiřelých nahrávek > obě nulové stopy incomplete manifestu nechá na disku bez položky 7ms
   ✓ obnova osiřelých nahrávek > complete stopu nad upload limitem zařadí bez čtení celého souboru 11ms
   ✓ obnova osiřelých nahrávek > selhání zápisu obnovené položky nezamění za vadný manifest 6ms
   ✓ obnova osiřelých nahrávek > existující sidecar přijme jen při přesně shodném bezpečném obsahu 18ms
   ✓ perzistentní pumpa fronty > po restartu ruční retry obnoví schválenou nahrávku pauznutou volbou firmy 103ms
   ✓ perzistentní pumpa fronty > 429 atomicky uloží queue i cooldown a restart ani ruční retry nepošlou request 16ms
   ✓ perzistentní pumpa fronty > cooldowny zůstávají per-owner přes A→B→A a expirace se uklidí atomickou mutací 40ms
   ✓ perzistentní pumpa fronty > vadný cooldown se načte fail-closed a read-only list expirovaný záznam nemaže 2ms
   ✓ perzistentní pumpa fronty > cooldown nahrávek neblokuje časovou položku s vlastním killswitchem 17ms
   ✓ perzistentní pumpa fronty > store ukotví cooldown na okamžik přijetí pomalé 429 odpovědi 25ms
   ✓ perzistentní pumpa fronty > po selhání fsync adresáře znovu načte stav po dokončeném rename 1ms
   ✓ perzistentní pumpa fronty > serializuje souběžná zařazení bez ztráty položky 17ms
   ✓ perzistentní pumpa fronty > trvalý první pokus uloží s attempts 1 a další pumpy ho neopakují 24ms
   ✓ perzistentní pumpa fronty > store retry přepne 403 pin jen zero-ID položce a initialized položku neodešle 50ms
   ✓ perzistentní pumpa fronty > 🔴 jedna pumpa pošle víc nahrávek, ale zastaví se na první systémové chybě 88ms
   ✓ perzistentní pumpa fronty > 🔴 pumpa řekne, KOLIK odeslala, ne jen jak dopadla poslední 72ms
   ✓ perzistentní pumpa fronty > 🔴 jedna pumpa nepřekročí strop, i když je fronta delší  604ms
   ✓ perzistentní pumpa fronty > stará hromadná retry cesta už nahrávku znovu neodešle 31ms
   ✓ perzistentní pumpa fronty > stará hromadná retry cesta neodešle ani běžnou nahrávku vedle lidské blokace 47ms
   ✓ perzistentní pumpa fronty > renderer dostane přesný součet skutečných souborů, ne velikost odhadem z manifestu 13ms
   ✓ perzistentní pumpa fronty > pumpa s vypnutými přepínači položku zachová bez pokusu 18ms
   ✓ trusted detail pro serverové ověření > čte čerstvý primární manifest podle row ID/revize a nevrací cesty 28ms
   ✓ trusted detail pro serverové ověření > recovery sidecar zachová deklarovaná data pro mock GET při chybějícím audiu a zachovaných serverových ID 32ms
   ✓ trusted detail pro serverové ověření > legacy recovery bez ID a bez známého hashe vrátí not_verified a nula GET 25ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/queue.test.js > read-only lokální přehled nahrávek > spojí frontu s orphan manifesty, ignoruje sidecar a rozliší úplnost i nulový soubor
AssertionError: expected { …(15) } to match object { source: 'orphan', …(4) }
(10 matching properties omitted from actual)

- Expected
+ Received

@@ -3,10 +3,10 @@
      "claim": false,
      "delete": true,
      "retry": false,
      "send": false,
    },
-   "localState": "complete-audio",
+   "localState": "partial-audio",
    "revision": null,
    "sizeBytes": 0,
    "source": "orphan",
  }

 ❯ tests/queue.test.js:216:69
    214|         fileRevision: expect.stringMatching(/^sha256:/u),
    215|       });
    216|       expect(snapshot.items.find((item) => item.id === ids.orphan)).to…
       |                                                                     ^
    217|         source: "orphan",
    218|         localState: "complete-audio",

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed | 2 passed (3)
      Tests  1 failed | 173 passed (174)
   Start at  00:59:40
   Duration  1.94s (transform 132ms, setup 19ms, collect 768ms, tests 2.54s, environment 0ms, prepare 105ms)

exit_code=1
```
