# T5 — review a přejímka koordinátora

15. 9. 2026, zdroj `e225880ec2f8fff1ba7c4460d3436d000fdde8ae`, běžný merge `eefc259`.

- 🧪 Vlastní plné `npm run gates` koordinátora nad předaným worker stromem: **1469 PASS, tři původní skipy, exit 0**, viz `root-gates.log`. Proti T4 je to 36 nových případů; původní odhad 37 v reportu opraven.
- Review nad runtime diffem zahrnulo consent a migraci před transportem, snapshot při startu, save-copy → durable rozhodnutí → cleanup, konkrétní send/retry, scheduler, IPC a lokální soubory. Původní transportní fixtures nyní obsahují výslovný souhlas; původní požadavky na odeslání, zachování dat a retenci zůstaly. Změnu runtime i očekávání starého globálního retry opravňuje D11: žádné hromadné schvalování nahrávek.
- Kontrolou opraveny konkrétní chyby: opakovaný refresh stejného timeru zneplatňoval callback; auth loss po exportní kopii nebyl pravdivě odlišen; ruční upload potřeboval usable token refresh; partial trash failure potřebovalo zprávu v UI.
- Nezávislé Sol review našlo duplicitní orphan UUID a sdílenou audio cestu. Finální úzký recheck potvrdil opravu obou: orphan má právě jeden manifest a sdílení se kontroluje přes jiné manifesty i queue položky bez manifestu. Existují konkrétní diskové regrese s nulovým košem. Guard je po asynchronním statu a bezprostředně před systémovým košem.
- Ověření sidecaru při delete/reveal už nevolá recovery ani nehashuje celé audio. Používá omezené stabilní čtení a shodu identity/známých metadat; obnovená nahrávka se zbylým manifestem může být uklizena i bez audia.
- ⚠️ Systémový koš přijímá cestu, nikoli ověřený file descriptor. Mezi poslední kontrolou a otevřením cesty košem zůstává malé TOCTOU okno; omezuje jej soukromý přímý adresář, serializace, O_NOFOLLOW/O_NONBLOCK, shoda stat a opakovaný guard. Test guardu ověřuje změnu během preflightu; neizoluje přesně změnu až po posledním statu.
- Čtyři skutečné sabotáže mají archivované RED exit 1 a obnovený kód GREEN exit 0. Filtrované běhy ve výpisech uvádějí ostatní nevybrané testy jako skipped; zdrojové skipy ani baseline se nepřidávaly.
- ⛔ Žádný skutečný zvuk, produkční upload, instalace nebo aktualizace tímto review nebyly ověřeny. Výběr firmy a vazba firmy rozpracovaného uploadu ještě čekají na T-A4.

Po merge T5 s již přijatým A3 proběhla samostatná integrační brána nad `eefc259`: **1488 PASS, tři původní skipy, 71 sad, exit 0**. Doslovný výpis je v `integracni-gates.log`. T-A4 navazuje z této společné zelené základny.
