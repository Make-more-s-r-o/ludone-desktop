# Důkazy F Osa — závěrečná akceptace 5. 10. 2026

🧪 Zelené automatizované testy. Fyzický zvuk a skutečný server tím nejsou ověřené. Auth/transport používá pouze veřejnou syntetickou identitu v izolovaném profilu; žádný skutečný účet, upload ani externí síť. Profily a nahrávky nejsou archivované.

| Kontrola | Výsledek | Doslovný výpis |
|---|---|---|
| Původní brány v čistém klonu | 🧪 exit 0 | [gates:clean](gates-clean-final.txt) |
| Celá sada | 🧪 1715 PASS / 0 FAIL / 3 původní skipy | [unit](akceptace/unit-vsechny-puvodni-i-nove.txt) |
| Kompletní F akceptace | 🧪 všech 10 samostatných PASS, exit 0 | [F](akceptace-f-final.txt) |
| Audit lockfile | 🧪 0 známých nálezů, exit 0 | [audit](audit-final.json) |
| Encoder obou architektur | 🧪 exit 0 | [encoder](encoder-final.txt) |
| Skutečný Electron 24 situací × 3 témata | 🧪 72 snímků, exit 0 | [výpis](akceptace/Electron-F-24x3-auth-a-detail.txt), [manifest](application-final/results.json) |

Electron ověřuje skutečné služby a disková data: hlavní čas při skrytí panelu, ztrátu systému a jen mikrofon, stereo derivát a dekodér, crash/restart, převzetí vlastníka bez uploadu, CAS detailu a Save/Discard/Stay, zachování výchozí firmy po restartu i firemní přístup nové nahrávky. Testovací adaptér odpovídá na nativní dialogy a změny selectu vyvolává přes renderer události. Skutečný server je výslovně `productionServerVerified: false`.

`reference/` obsahuje schválený návrh ze samostatné návrhové podsložky na loopbacku. `application-final/` obsahuje aktuální skutečný Electron, 72 kanonických snímků a veřejný audit transportu. `application/` je dřívější průběžný archiv. `akceptace-pred-migraci/` zachovává předchozí doslovné neúspěšné výpisy; nejsou finálním výsledkem. V Git historii zůstávají další checkpointy.

| Situace | Schválený návrh | Skutečný Electron |
|---|---|---|
| Připravené nahrávání | [reference](reference/light-ready.png) | [aplikace](application-final/light-ready.png) |
| Historie | [reference](reference/light-history.png) | [aplikace](application-final/light-history.png) |
| Detail | [reference](reference/light-detail.png) | [aplikace](application-final/light-detail.png) |
| Fronta | [reference](reference/dark-queue.png) | [aplikace](application-final/dark-queue.png) |

Panel má skutečně omezenou výšku a vnitřní posouvání. Nepotvrzuje zeleně zvuk před jeho spuštěním; uloženou firmu bez načteného názvu označuje pravdivým obecným textem. Historie má skutečně změřené středy uzlů na ose do 1 px. Vizuální review a fyzická přejímka jsou v [dokumentaci běhu](../../docs/behy/desktop-osa-2026-10-05/STAV.md).

## Korekce po root review

Aktuální `application-final/` pochází z finálního P2 běhu nad `c8b2fb5`. Včetně všech kroků onboardingu navíc. Syntetické auth/permission/updater adaptéry jsou explicitně označené v manifestu/auditu; žádný skutečný účet, OS oprávnění, produkční server ani instalátor. Updater controller ověřuje blokaci při nahrávání, odklad a inertní callback až po explicitním potvrzení, jednou oznámení na verzi napříč dvěma procesy.

Historické snímky vrácené rootem k opravě zůstávají v `application-root-review-998d86a/`, původní zelené výpisy v `akceptace-pred-p2/` a všechny selhávající korekce v `p2-correction/`. Přísnější skutečné měření zahrnuje kontrast a pointer Stop, první viewport editací, nenulový skutečný scroll owner, svislou osu, jediný banner a sémantické chyby/recovery. [Úplné vizuální review a následné uzavření P2](../../docs/behy/desktop-osa-2026-10-05/VISUALNI-P2-REVIEW.md).
