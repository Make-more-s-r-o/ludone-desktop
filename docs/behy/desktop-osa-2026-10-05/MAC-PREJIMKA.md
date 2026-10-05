# Krátká fyzická přejímka F Osa

⛔ Čeká na Dana na skutečném Macu. Automatizované nahrávky používají syntetické oscilátory; neposlechl je člověk a nedokládají zvuk z aplikací ani macOS oprávnění.

1. Otevřít vývojovou aplikaci z této větve. Projít nahrávání, historii, odesílání, pět sekcí nastavení, onboarding, aktualizace a konkrétní detail ve světlém, profesionálním a tmavém tématu. Porovnat se schválenou F; dlouhý název/firma, úzký monitor, klávesnice/fokus a stop dostupný mimo domovskou stránku.
2. Spustit původní `ui-smoke` a `audio-smoke` dle jejich návodu na Macu s GUI a Záznamem obrazovky. Poslechnout mikrofon i druhou stranu, jeden stereo výstup, výpadek systémového zdroje a režim jen mikrofonu. Výpisy včetně exit kódu uložit do `dukazy/`.
3. Přihlášení do skutečné firmy: uložený default přežije restart; nová nahrávka má firemní přístup. Změna firmy/přístupu před odesláním sama nic neodešle. Převzetí původně nepřiřazené nahrávky také neodešle nic. Výslovné odeslání vytvoří jeden serverový záznam, potom ověřit server a web. Retry po offline/expiraci zachová idempotenci a správného vlastníka.
4. Během nahrávání skrýt panel, změnit monitor, ztratit připojení/session. Ikona i skutečný čas zůstávají aktivní. Stop, místní uložení a návrat z detailu. Ověřit fyzickou světlou/tmavou lištu, pravý klik a tray při nedostatku prostoru.
5. Ukončení a stažená aktualizace nesmějí přerušit nahrávku ani export. Ověřit obnovu draftu po restartu, bezpečný Finder a potvrzený koš bez zásahu do serveru. Skutečnou instalaci aktualizace provést až ve zvlášť povolené release přejímce.

## Před vydáním

🟡 Verze připravena na 0.1.8. Bundle ID, hardened runtime, entitlements, notarizace, oba architekturní cíle a generický update feed zůstávají v existujícím workflow. Encoder pro arm64 i x64 odpovídá připnutým hashům a architekturám. Podpisové klíče ani účty tento běh nečetl nebo nepřenášel.

⚠️ Nejdřív rozhodnout přechod starých Astra kontraktů na F se zachováním bezpečnostních podmínek a vyřešit červenou původní bránu. `F-Osa.mjs` je doplňkové měřidlo, nepovoluje výjimku. Podepsané/notarizované vydání se spustí stávajícím `release-macos.yml` až po review, fyzické přejímce a novém výslovném pokynu. Tag, merge, publikace a produkční instalace v tomto běhu neproběhly.
