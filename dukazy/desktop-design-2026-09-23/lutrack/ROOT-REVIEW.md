# LuTrack — převzetí návrhu koordinátorem

🧪 Klikací HTML simulace; ⛔ skutečný LuTrack tím není ověřený. Kontrola v Codex In-app Browser dne 23. 9. 2026. Nejde o automatickou akceptaci produktu ani o změnu backendu.

## Přímo prokliknuté cesty

- PASS: Připraveno → projekt „Ukázka — podpora týmu“, vlastní popis „Zkouška návrhu LuTracku“ → Start. Běh zobrazuje správný projekt a popis.
- PASS: Běh → spustit simulaci nahrávky → změnit projekt na „Ukázka — redakce webu“ → Zastavit čas. Dvě místní položky mají oba projekty a původní popis; nahrávka pokračuje samostatně. Stav výslovně říká „Není odesláno do LuTracku“.
- PASS: Scénář Běží → zastavit ukázku nahrávání. Časovač stále běží, nahrávka uvádí „Neběží“.
- PASS: Běží → Zastavit čas → Nové měření. Stále běžící nahrávka zůstává viditelná a lze ji samostatně zastavit.
- PASS: Přepnutí scénáře obnoví ukázková data; scénář Běží vrátí 32 minut a výchozí projekt/popis.
- PASS: Vizuálně zkontrolované místní položky ve světlém tématu, běh v tmavém tématu a nedostupné propojení v Professional. Čtyři scénáře mají přístupné ovládací prvky. Nejde o úplnou matici všech 12 kombinací ani audit VoiceOver.

⚠️ CUA setValue nad projektovým selectem dvakrát ohlásilo „Select did not retain the requested option“, protože změna nahradila element při renderu. Následný čerstvý strom prokázal správný vybraný projekt a výsledné uložené položky prokázaly oba projekty; původní tool chybu nevydáváme za úspěšnou odpověď nástroje.

## Integrace a limity

Sol-original uchovává pět původních zdrojových dokumentů/prototypu. source-sha256.json uchovává hash všech předaných souborů. Koordinátor přidal návrat na porovnání, stávající značku LuDone, obnovu ukázkových scénářů a viditelnost nahrávky při novém měření. Dokumentaci aktualizoval o Danovo potvrzení instalované 0.1.4. Syntaxe je zachycená doslovně v syntax.txt.

Prototyp používá jen fiktivní projekty a data v paměti otevřené stránky. Žádné přihlášení, skutečný projekt, audio, zápis do fronty, serverová synchronizace ani nové vydání se nespouští. Design čeká na výběr Dana. Plán další verze je NEXT-RELEASE.md u prototypu.
