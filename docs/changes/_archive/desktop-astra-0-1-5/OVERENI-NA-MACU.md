# Krátké ověření 0.1.5 na Macu

Automatické testy neověří systémový zvuk, skutečný upload, podepsanou instalaci ani automatickou aktualizaci. Po vydání projdi tyto kroky:

1. **Aktualizace:** otevři LuDone Desktop 0.1.4, počkej na proužek a jednorázové oznámení macOS, zvol „Později“ a ověř, že aplikace běží dál. Později zvol „Aktualizovat“; po restartu v Nastavení ověř verzi **0.1.5**.
2. **Nahrávky:** z panelu otevři **Nahrávky**. Okno se má otevřít přímo na existujícím přehledu.
3. **Krátký záznam:** při přehrávání běžného zvuku z Macu krátce nahraj testovací hlas. Zastav, zvol **Uložit a odeslat** a zkontroluj, že dashboard ukazuje právě jednu novou položku.
4. **Web a přepis:** ověř, že na `app.ludone.cz` vznikl jeden záznam schůzky a přepis obsahuje jak hlas, tak přehrávaný systémový zvuk. Když něco chybí, zapiš verzi aplikace a stav z diagnostiky.
5. **LuTrack:** vrať se na panel a ověř, že karta říká **Připravujeme**, neukazuje běžící čas a nejde spustit.

Výsledky zapiš jako ✅ ověřeno naostro nebo ⚠️ s popisem rozdílu. Testovací obsah použij takový, který můžeš bezpečně nahrát do své aplikace.
