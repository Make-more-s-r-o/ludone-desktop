# Převzetí T-R1 — 14. 9. 2026

🧪 Koordinátor zkontroloval diff nad `4bbbd0a` a samostatně spustil plné `npm run gates`. Finální výstup [root-gates-final.log](root-gates-final.log) má exit 0: 66 souborů, 1401 zelených testů a tři původní baseline skipy. Předchozí červené běhy zůstávají archivované, žádná brána ani timeout se neoslabily.

HTTP 429 u nahrávky zachová attempts i per-track progress a atomicky uloží položku se sdíleným cooldownem vlastníka. Restart, ruční retry, claim ani přepnutí A → B → A pauzu neruší. Vlastník je existující HMAC e-mailu a issueru; změna e-mailu stejného serverového účtu může vytvořit nový lokální otisk. Nejde o podpis souboru fronty. Platné serverové sekundy mají přednost do šesti hodin, jinak je pauza hodinu.

Review opravilo novou 429 větev pro časové položky (ty zachovávají původní retry kontrakt), typovou validaci fingerprintu bez převodu pole na string, neúmyslné zastavení obnovitelné expirované relace před transportem a výpočet termínu od začátku pomalého requestu. Termín se nyní odvozuje od přijetí 429; právě uplynulý cooldown je neaktivní, nikoli neplatný vstup. Výsledek store obsahuje stejnou frontu s cooldownem jako atomický zápis na disku.

První root brána zachytila test převzetí, který současně spouštěl startupovou obnovu expirované relace. Zákaz sítě request zastavil. Fixture nyní počká na prázdný startup a nastaví expiraci až před samotným lokálním převzetím; samostatně výslovně ověří nula volání obou fetch cest. Jiné regrese dál dokazují úspěšnou i neúspěšnou obnovu při startupu. Zelený výsledek proto nevznikl polknutím síťového zákazu.

Worker provedl skutečné sabotáže odstranění store cooldown guardu a ponechání zvýšených attempts: obě RED exit 1, po obnovení ochrany GREEN. Doslovné logy jsou v tomto adresáři.

⛔ Nebyl použit produkční účet, živý server, audio ani GUI smoke. T-R1 nepřidává časovač; obnovení schválených odložených pokusů doplní T-05. Aktuální celkovou integrační bránu bude nutné provést po navazujících etapách.
