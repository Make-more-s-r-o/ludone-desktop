# T5 — izolovaný GUI průchod

15. 9. 2026, 00:28–00:31 Europe/Prague. Runtime integračního commitu `77543cb`, verze 0.1.2. Build exit 0, úplný výpis `gui-build.log`.

Spuštění: `LUDONE_DATA_DIR="$PWD/.runtime/gui-review" LUDONE_E2E=1 DESKTOP_UPLOAD_ENABLED=false npm start`. Použitý testovací profil nemá produkční přihlášení, upload má explicitní tvrdou stopku a updater je v E2E režimu vypnutý.

Pozorování přes skutečné native AX a screenshot:

- Z odhlášeného panelu tlačítko **Nastavení** otevřelo skutečné okno `#settings`.
- Záložka **Nahrávky** zobrazila prázdný lokální přehled a vysvětlení přihlášení. Klik **Obnovit přehled** zachoval prázdný stav. Screenshot ukázal čitelné karty, navigaci a footer bez překryvu v okně 448 × 676.
- Záložka **Zvuk** zobrazila **Automaticky odesílat nové nahrávky** a upozornění, že staré záznamy se nezmění. Klik změnil skutečný AX switch off → on → off; testovací volba byla vrácená na vypnuto. Následné čtení pouze této preference z testovacího souboru potvrdilo uploadEnabled=false. Zkouška zvuku se neklikala.
- Záložka **Záznamy** zobrazila sedmidenní retenci po odeslání a informaci, že se neodeslané nahrávky automaticky nemažou.
- Po **Hotovo** zůstalo viditelné existující okno upozornění na ikonu, která se nevešla do horní lišty. Nabízelo zapnutí ikony v Docku; tento systémový přepínač se neměnil. Cmd+Q ukončilo testovací proces s exit 0.

⚠️ V části Účet byly pozorovány dva zastaralé texty: tvrzení o záměrně chybějícím produkčním modulu a bezpodmínečné odeslání fronty po přihlášení. Oba jsou předané T-A4, který tuto část nyní vlastní; musí je srovnat s produkčním cílem a per-item consentem.

🟡 Jde o omezený průchod unpackaged UI v izolovaném profilu. ⛔ Produkční login, přehled se skutečnými položkami, skutečný koš, zvuk, instalace a aktualizace se tím neověřily. `ui-smoke` ani `audio-smoke` se nespouštěly. Screenshot byl zobrazen přímo nástrojem, nevznikl samostatný PNG soubor.
