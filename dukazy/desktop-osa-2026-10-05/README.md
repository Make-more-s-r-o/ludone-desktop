# Důkazy F Osa — 5. 10. 2026

🧪 Izolované testy, nikoli fyzická zvuková přejímka. Poslední Electron běh: 45 samostatných PASS, exit 0; `osa-e2e-visual-final.txt`. Syntetický mikrofon 440 Hz, systém 880 Hz, oddělený profil a upload vypnutý. Nahrávky ani profile data nejsou součástí tohoto archivu.

## Výsledky

| Kontrola | Stav | Výpis |
|---|---|---|
| F logika, stav tray, bezpečné audio range / FIFO / stale revize | 🧪 15 PASS | `akceptace/unit-F.txt` |
| Auth / queue / export / dashboard základní regresní moduly | 🧪 385 PASS | `core-unit.txt` |
| Lint implementačních cest, typecheck, build | 🧪 exit 0 | `osa-lint.txt`, `akceptace/typecheck.txt`, `osa-build.txt` |
| Původní tray nativeImage a nové F masky 18/36 px | 🧪 exit 0 | `akceptace/tray-image-puvodni.txt`, `akceptace/tray-image-F.txt` |
| Electron shell, tři témata, panel / UUID detail, search, dvě stránky historie | 🧪 PASS | `osa-e2e-visual-final.txt` |
| Main čas při skrytém panelu, offline/signed-out aktivita, výpadek systémového zvuku | 🧪 PASS | stejný výpis |
| Skutečný audio decoder, jeden stereo derivát, chráněné přehrávání tohoto derivátu | 🧪 PASS | stejný výpis |
| Stop mimo home, rozhodnutí, místní uložení bez uploadu, crash zachování, restart | 🧪 PASS | stejný výpis |
| Encoder arm64 + x64: zdrojové hashe, Mach-O, podpisová odolnost | 🧪 exit 0 | `encoder-check.txt` |
| Audit produkčních závislostí | 🧪 0 zranitelností | `audit-production.json` |
| Celá původní unit sada | ⚠️ 201 FAIL / 1468 PASS / 3 původní skipy | `akceptace/unit-vsechny-puvodni-i-nove.txt` |
| Původní čistá brána | ⚠️ 155 výchozích lint chyb | `final-gates-clean.txt` |
| F doplňková akceptace včetně původních kontrol | ⚠️ exit 1, dvě samostatné FAIL | `akceptace-final.txt` |
| Fyzický zvuk, produkční server, monitory a instalace aktualizace | ⛔ neověřeno | [Mac přejímka](../../docs/behy/desktop-osa-2026-10-05/MAC-PREJIMKA.md) |

Průběžné neúspěšné výpisy zůstávají zachované. Jejich FAIL se nesmí zaměňovat za finální PASS nebo skrývat. Výpisy jsou doslovné včetně whitespace testovacího runneru. [Rozpor bran](../../docs/behy/desktop-osa-2026-10-05/ROZPOR-BRAN.md) a [nezávislé review](../../docs/behy/desktop-osa-2026-10-05/REVIEW.md).

## Návrh a skutečná aplikace

`reference/`: všech 24 schválených situací × 3 témata, 72 referenčních snímků ze samotné návrhové podsložky na loopbacku. `application/`: skutečný Electron se syntetickými lokálními daty. Nejde o 72 funkčně ověřených produkčních stavů; přihlášené serverové scénáře a fyzické systémové dialogy čekají na Mac přejímku.

| Kompozice | Návrh | Electron |
|---|---|---|
| Světlé nahrávání | [reference](reference/light-ready.png) | [aplikace](application/light-home.png) |
| Profesionální nahrávání | [reference](reference/professional-ready.png) | [aplikace](application/professional-home.png) |
| Tmavé nahrávání | [reference](reference/dark-ready.png) | [aplikace](application/dark-home.png) |
| Samostatný detail / dvě stanice | [reference](reference/light-detail.png) | [aplikace](application/detail.png) |
| Historie / sedm položek na stránku | [reference](reference/light-history.png) | [aplikace](application/light-library.png) |

Rozdíly jsou věcné: skutečná aplikace nevykresluje zelené ověření zdrojů před spuštěním/poslechem, neověřená lokální fixtura nemá potvrzeného vlastníka ani firmu, serverovou stanici nelze naplnit pouhým odesláním a skutečné Mac / LuDone akce mají vlastní guards. Přidané místní přehrávání skutečně otevírá povolený audio soubor. Reference má ukázkovou přihlášenou firmu a fiktivní serverové stavy; v izolovaném běhu jsou tyto akce pravdivě zamčené. Systémové písmo, levá rail navigace, svislá osa a dvě stanice jsou převzaty z F.
