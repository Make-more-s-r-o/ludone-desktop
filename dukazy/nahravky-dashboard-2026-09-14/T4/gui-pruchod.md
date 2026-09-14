# T4 — omezený GUI průchod integrační aplikací

14. 9. 2026, 23:53–23:55 Europe/Prague; integrační HEAD `81b8c0b`.

- 🧪 `npm run build` exit 0. Doslovný výpis je v `gui-build.log`.
- Aplikace spuštěna pomocí `LUDONE_DATA_DIR="$PWD/.runtime/gui-review" LUDONE_E2E=1 npm start`, tedy v samostatném testovacím profilu. Produkční tokeny se nepoužily, updater je v tomto režimu vypnutý.
- Native AX i screenshot ukázaly LuDone 0.1.2, „Nejsi připojený“ a „Přihlásit v prohlížeči“. Login se neklikal.
- ⛔ Okno Nastavení a dashboard se v tomto průchodu neověřily. Odhlášený panel ještě nemá přímý vstup (doplní T5); dostupné AX menu aplikace neobsahovalo Nastavení. Přístup ke systémové liště přes SystemUIServer skončil timeoutem a klávesnicový pokus nepřinesl nové UI. Další proklikání bude po T5 přes přímý vstup.
- Cmd+Q ukončilo startovací proces s exit 0. Po ukončení se již nevolalo getApp/getAXState, které by aplikaci mohlo nechtěně spustit znovu.
- Žádná síť na produkční účet, nahrávání, `ui-smoke` ani `audio-smoke`. Screenshot byl pouze zobrazen nástrojem; nevznikl vymyšlený soubor s obrazovým důkazem.

Toto je omezené pozorování unpackaged okna, nikoli ověření instalace, přihlášení nebo zvukové cesty.
