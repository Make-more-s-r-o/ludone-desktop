# Nezávislé převzetí F Osa — vráceno k opravě

5. 10. 2026, review `998d86a13557fe5b5b432154af6aeedd7868d678` v draft PR #160.
⚠️ Automatické brány jsou zelené, ale produktová a vizuální přejímka není dokončená.
Žádný merge, tag, vydání ani instalace. Opravy pokračují v původním schváleném rozsahu.

## Doložené výsledky a rozsah review

- 🧪 Root ověřil GitHub CI `37334535319`: SUCCESS. Čistý klon a F akceptace
  mají doslovné výpisy s exit 0; celá sada 1708 PASS, 0 FAIL, 3 původní skipy.
- 🧪 Archivovaný audit celého lockfile uvádí 0 známých nálezů, exit 0.
- 🧪 `application-root-review-998d86a/results.json`: exit 0, 458 observations bez FAIL,
  72 kanonických PNG a další dirty-dialog snímek. Identita a transport jsou
  výslovně syntetické, `productionServerVerified=false`.
- Tři nezávislí čtecí Sol revieweři skutečně otevřeli všech 24 kontaktních
  listů, tedy všechny tři motivy každé situace, proti původním verzovaným
  referencím. Podezřelá místa ověřili v originálních PNG. Root osobně otevřel
  save, history, detail, ready, recording, onboarding, system-lost a
  companies-error ve všech tématech. Kontaktní listy pouze řadí kopie snímků;
  originální důkazy nejsou měněné. Škálovaný list není subpixelové měření.
- Čtecí bezpečnostní audit nedoložil nový P1: panel/detail IPC mají důvěryhodné
  role a frame/origin; configure používá vlastníka a CAS bez uploadu;
  playback má náhodnou capability, expiraci, revize, opakované resolve,
  `O_NOFOLLOW`, inode/stat a validaci range. Syntetický entrypoint je pouze
  v `scripts/`, není importován produkčním main ani zahrnut do balení.
- Review migrace původních měřidel nezjistilo nový skip, baseline, odstraněný
  testový případ ani snížení počtu `expect` v některém změněném existujícím
  souboru. Bezpečnostní podmínky zůstávají. Níže nalezený chybný selector je
  však skutečná mezera důkazu, kterou je třeba opravit.

⛔ Fyzická zvuková cesta, produkční upload, nativní dialogy/selecty, skutečná
systémová lišta a instalace aktualizace nejsou tímto review ověřené.

## P2-01 — aktivní Stop při výpadku není čitelný

Důkaz: `application-root-review-998d86a/{light,professional,dark}-system-lost.png`.
`RecordingCard.jsx` má aktivní `.recording-outage__stop`, ale zděděná barva
`--panel-sunken` splývá s později změněným pozadím `--panel-card`.
„Ukončit“ vypadá zakázané; v dark je téměř černé na černém. Test jej přesto klikne.

Oprava: výslovný F styl bezpečného Stop v degraded stavu, čitelnost ve všech
třech tématech. Zachovat aktivní Stop a skutečné rozlišení ticha/ztráty zdroje.
Přejímka musí ověřit enabled stav, kontrast, hit-test a pointer průchod.

## P2-02 — detail nemá hierarchii akcí a voleb F

Důkaz: `application-root-review-998d86a/{light,professional,dark}-detail.png` proti
`reference/*-detail.png`; root i reviewer potvrdili aktuálního vlastníka.
„Uložit a odeslat“ má jen `button button--small`, stejný neutrální vzhled jako
Finder/ověření. Koš ztratil výstražnou roli. Editovatelné volby firmy/přístupu
jsou za rozsáhlým read-only blokem a mimo první viewport 860 × 580.

Oprava: obnovit primární upload, význam destruktivního koše a příslušné ikony;
editovatelné volby v prvním viewportu podle F. Pravdivé vlastnické údaje,
serverové ověření a zámky nesmějí zmizet, lze je kompaktně seskupit.
Přejímka local/locked/error ve třech tématech, CAS a Save bez uploadu.

## P2-03 — onboarding je stále starý rám uvnitř F

Důkaz: `application-root-review-998d86a/*-onboarding.png`. Vnější F hlavička obsahuje další
Astra rám s falešnými semafory a Teď / Můj den / Nastavení. Reference má
jednoduchý průvodce s vlastní svislou osou. Jde o skutečnou kompoziční odchylku,
nikoli rozdíl testovacích jmen.

Oprava: F prezentační obal všech kroků bez vnořeného starého okna/navigace;
zachovat skutečné permission/auth/audio kroky a lidské potvrzení poslechu.
Nové snímky a průchody ve třech tématech, nikoli pouze úvodní welcome capture.

## P2-04 — scroll test měří nesprávný prvek

`tests/idle-panel.test.js:1458–1467` kontroluje `scrollTop` `.osa-content`.
Skutečný scroll owner je `.osa-workspace` (`src/osa.css:17`). Zelený test tak
nepotvrzuje zachování uživatelské pozice.

Oprava: měřit skutečného vlastníka, jeho `overflowY`, obsah vyšší než viewport,
nenulový scroll a stabilitu po změně obsahu. Zachovat původní invariant
omezující výšku panelu; žádný skip, výjimka ani baseline.

## P2-05 — tři sémantické díry v matici 24 × 3

- `companies-error`: skutečný snímek je chybějící zvuk v detailu; F reference
  je chyba nabídky firem při rozhodnutí po nahrávání. Assertion textu chyby
  firmy nepřebírá odpovídající flow. Ověřit skutečný draft po stopu, zachovaný
  název/default, retry nabídky, blokaci odeslání a dostupné Nechat na Macu.
- `updates`: skutečný snímek ukazuje disabled kontrolu vývojového buildu.
  F ukazuje připravenou aktualizaci. Navigace a capture neověřují dostupnost,
  download/defer, oznámení jednou za verzi ani bezpečnou ruční instalaci.
  Doplnit izolovaný veřejný updater adaptér pouze v test bootstrapu přes
  skutečný controller/IPC/UI; nespouštět skutečné podepisování ani instalaci.
- `rate`: verifier assertion má `rate_limited`, ale první zachycený viewport
  ukazuje Odesláno podle stavu fronty bez limitu/recovery. Ověřit skutečný
  chybový stav a jeho dostupné akce ve třech tématech, ne pouhou existenci PNG.

Přejímka každého stavu má ověřit semantic state, viditelné sdělení a enabled /
disabled akce před snímkem. Špatný snímek neopravovat přejmenováním fixture
nebo snižováním kontraktu. Produkční síť/upload/install jsou stále zakázané.

## Další dotažení původní F

- V aktivním nahrávání reference ponechává cíl a poslední schůzky; aktuální
  renderer je odstraňuje a nechává velké prázdné místo. Obnovit read-only
  kontext a kompozici F při zachování pravdivých měřičů, bezpečného Stop a
  zákazu změn cizího vlastníka. Stav kanálu nesmí být zelený bez důkazu.
- Nastavení: doložit nebo doplnit skutečné vazby Klávesové zkratky / Panel
  v liště, Zobrazit složku / Přejít na odesílání, Ověřit zvuk. Nepřenášet
  mock toast; propojit dostupné služby/pohledy. Zachovat pět sekcí.
- P3: offline sdělení je v prvním viewportu dvakrát a vytlačuje frontu.
  Sjednotit sdělení bez ztráty bezpečného lokálního režimu a recovery.

## Následující checkpoint

Stejný jediný zapisovatel na `feat/desktop-osa`, Sol 6.1 low, opraví nálezy
v původním schváleném rozsahu. Root ani revieweři neimplementovali produkční
změny. Po opravě původní brány, relevantní regressions a nové sémanticky
správné snímky; root znovu nezávisle převezme výsledek. Dosavadní zelené
výpisy jsou platným checkpointem, nikoli hotovou vizuální přejímkou.
