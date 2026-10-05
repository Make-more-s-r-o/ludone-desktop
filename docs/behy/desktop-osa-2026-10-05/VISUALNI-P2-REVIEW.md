# Čtecí vizuální P2 review F Osa

5. 10. 2026. Posuzovaný skutečný Electron renderer z integračního běhu
`.runtime/osa-auth-e2e/2026-10-05T19-24-52.724Z` proti verzovaným
`dukazy/desktop-osa-2026-10-05/reference/`.

🧪 Oba níže historicky zaznamenané P2 byly uzavřeny opakováním nad `c8b2fb5`.
Celkovou funkční ani fyzickou přejímku tento čtecí report neprohlašuje za hotovou.

## Rozsah

Osobně otevřeno všech 24 kontaktlistů: ready, recording, saving, save, history,
detail, sent, queue, offline, expired, unclaimed, rate, missing, system-lost,
microphone-only, companies-error, onboarding, settings, settings-audio,
settings-device, settings-storage, settings-diagnostics, updates a tray.
Každý list obsahoval všechny tři motivy reference a aplikace. U čtyř podsekcí
nastavení mají reference jména audio/device/storage/diagnostics.
Dále otevřeny tři kontaktlisty se všemi šesti skutečnými kroky onboardingu:
welcome, auth, waiting, permissions, audio a done. Celkem prohlédnuto
72 kanonických aplikačních situací a 15 dalších onboarding PNG.

Kontaktlisty vznikly pouze v `/tmp/osa-p2-review`, nemění originály a nejsou
subpixelové měření. Konkrétní níže popsané vady potvrzeny v originálních PNG
otevřených v plné velikosti. Čtyři neměněné kopie a SHA-256 jsou v
`dukazy/desktop-osa-2026-10-05/p2-review/`.

## P2 — onboarding nemá svislou osu, uzly překrývají nadpis

Důkaz: `complete-light-onboarding.png`, `complete-light-onboarding-audio.png`,
stejná kompozice ve professional i dark a v ostatních krocích.
Vnořená Astra hlavička a falešné semafory jsou odstraněné, ale uzly nové osy
leží vodorovně přes horní řádek stanice. V audio kroku překrývají „Test záznamu“.
Referencia má uzly vlevo na skutečné svislé ose. Oprava musí zajišťovat svislé
rozmístění v aplikaci při skutečném pořadí importů CSS a bez překrytí obsahu.

Čtecí vysvětlení: `osa-onboarding.css` dává `.osa-onboarding__axis` display block,
ale pozdější `styles.css` má stejně specifickou `.step-track` s display grid
přes šest sloupců. JSDOM test načítal tyto listy v opačném pořadí. To vysvětluje,
proč zelené geometry testy nebyly důkazem skutečné kompozice.

## P2 — dvojitý stažený update banner v historii a frontě

Důkaz: `complete-professional-history.png`, `complete-dark-queue.png`, dále
`complete-dark-history.png` a `complete-professional-queue.png`.
Dva identické bloky „Nová verze 0.1.9 je stažená“ se současnými akcemi
Aktualizovat/Později zabírají první viewport. V queue je první blok navíc
zachycen nahoře jen od tlačítka; druhý vytlačuje seznam nahrávek dolů.
Light capture byl pořízen před stažením a tuto duplicitu neukazuje.
Je třeba jediný vlastník update sdělení v celé F kompozici; zůstávají dostupné
skutečné akce i čekání na bezpečné dokončení nahrávání.

## Ostatní cílené nálezy

🧪 Nové snímky system-lost mají čitelný aktivní Stop ve všech tématech.
Nahrávání i degraded stav zachovávají read-only cíl a poslední schůzky.
V plném originálu dark je „Ukončit“ bílý text na červeném tlačítku.

🧪 Lokální detail v 860 × 580 má rozlišené primární Uložit a odeslat,
červený koš a firmu/přístup i Uložit volby v prvním viewportu. Sent/locked,
unclaimed, missing a rate zachovávají odlišné pravdivé stavy; rate ukazuje
omezení serveru a Ověřit v LuDone již v prvním viewportu.

🧪 Companies-error je nyní správný skutečný post-stop draft se zachovaným
názvem, chybou firem, Načíst firmy, blokovaným odesláním a dostupným
Nechat na Macu. Updates ukazuje staženou verzi a viditelné Aktualizovat/Později
bez viditelného horizontálního přetečení ve třech motivech.

Snímky samy nedokládají enabled/hit-test, bezpečné odeslání či instalaci;
pro tyto podmínky je nutné číst odpovídající výsledky skutečných E2E assertions.
Tento review nemění produkci, testy ani měřidla.

⛔ Fyzický Mac zvuk, lidský poslech, produkční síť/upload, skutečná systémová
lišta, nativní dialogy a instalace aktualizace tímto nejsou ověřené.
Identita a transport jsou syntetické; zelená automatická cesta je nejvýše 🧪.

## Opakovaná přejímka obou P2 nad c8b2fb5

Nový skutečný Electron běh `2026-10-05T19-30-41.850Z`.
Osobně otevřeny všechny nové onboarding kroky v light/professional/dark
(18 PNG) a history/queue v každém ze tří témat (6 PNG).
Na třech onboarding kontaktlistech a v plném originálu audio je osa svislá,
šest uzlů má společnou levou souřadnici a nepřekrývá ikony ani nadpisy.
P2 onboardingu je tímto vizuálně uzavřen; root doplnil skutečnou DOM assertion
pořadí uzlů nad skutečně načtenou kaskádou CSS.

History a queue již obsahují nejvýše jeden update banner.
Professional/dark mají jediný stažený update blok; light zachycuje stav před
stažením. Na queue zůstává při zachované scroll pozici horní část jediného
banneru mimo viewport, druhý banner již nikde není a seznam je dostupný v
prvním viewportu. P2 duplicity je tímto vizuálně uzavřen; root doplnil DOM
assertion nejvýše jednoho banneru pro history/queue.

Všechny nové originály byly zkopírovány bez úprav do
`dukazy/desktop-osa-2026-10-05/p2-review/final/`, SHA-256 v jeho `ORIGINALY.md`.
Ostatní situace jsou pokryty předchozím úplným review; tento follow-up posuzuje
jen změněnou osu a vlastníka update sdělení. Žádný nový P2 v obnovované části.

⛔ Fyzický zvuk a lidský poslech na Macu, produkční upload, nativní dialogy,
systémová lišta a instalace zůstávají neověřené. Výsledek je nejvýše 🧪.
