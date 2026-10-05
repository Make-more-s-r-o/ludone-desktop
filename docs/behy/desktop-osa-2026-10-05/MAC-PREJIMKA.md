# Krátká fyzická přejímka F Osa

⛔ Čeká na Dana na skutečném Macu. Automatizované nahrávky používají syntetické oscilátory; neposlechl je člověk a nedokládají zvuk z aplikací ani macOS oprávnění.

1. Aktualizovat na vydanou 0.1.8 přes Nastavení → Zkontrolovat aktualizace → Aktualizovat a otevřít aplikaci. Projít nahrávání, historii, odesílání, pět sekcí nastavení, onboarding, aktualizace a konkrétní detail ve světlém, profesionálním a tmavém tématu. Porovnat se schválenou F; dlouhý název/firma, úzký monitor, klávesnice/fokus a stop dostupný mimo domovskou stránku. V detailu změnit firmu/přístup a vyzkoušet skutečný macOS dialog Uložit / Zahodit / Zůstat i nativní select popup. Automatika měří skutečné React/IPC/CAS cesty, volbu nativního dialogu dodává izolovaný testovací adaptér.
2. Spustit původní `ui-smoke` a `audio-smoke` dle jejich návodu na Macu s GUI a Záznamem obrazovky. Poslechnout mikrofon i druhou stranu, jeden stereo výstup, výpadek systémového zdroje a režim jen mikrofonu. Výpisy včetně exit kódu uložit do `dukazy/`.
3. Přihlášení do skutečné firmy: uložený default přežije restart; nová nahrávka má firemní přístup. Změna firmy/přístupu před odesláním sama nic neodešle. Převzetí původně nepřiřazené nahrávky také neodešle nic. Výslovné odeslání vytvoří jeden serverový záznam, potom ověřit server a web. Retry po offline/expiraci zachová idempotenci a správného vlastníka.
4. Během nahrávání skrýt panel, změnit monitor, ztratit připojení/session. Ikona i skutečný čas zůstávají aktivní. Stop, místní uložení a návrat z detailu. Ověřit fyzickou světlou/tmavou lištu, pravý klik a tray při nedostatku prostoru.
5. Ukončení a stažená aktualizace nesmějí přerušit nahrávku ani export. Ověřit obnovu draftu po restartu, bezpečný Finder a potvrzený koš bez zásahu do serveru. Skutečnou instalaci aktualizace provést až ve zvlášť povolené release přejímce.

## Vydání dokončeno

✅ 0.1.8 je podepsaná, notarizovaná a publikovaná pro arm64 i x64. Dan vydání výslovně pověřil; release workflow 37368725559 attempt 3 SUCCESS. Nezávislé veřejné ověření celých souborů a feedu exit 0. Záloha klíče byla dříve potvrzena; tajemství se znovu nehledají.

🧪 Audit zamčeného stromu 0 nálezů, 1715 testů PASS a původní tři skipy, všech deset F bran PASS, nezávislé review bez P1/P2. Fyzická přejímka výše zůstává neprovedená.

Po korekcích P2 člověk navíc potvrdí poslech checkboxem v audio kroku; měřiče samotné potvrzení nenahradí. Ověří kontrast Stop při ztrátě systému, volby a hierarchii detailu v prvním viewportu, skutečné zkratky přijaté macOS, zobrazení složky ve Finderu, návrat do odesílání a jednu update/offline zprávu. Automatizovaný updater důkaz používá inertní adaptér; skutečný download, podepsaný restart a instalace zůstávají budoucí lidskou přejímkou po novém pokynu.
