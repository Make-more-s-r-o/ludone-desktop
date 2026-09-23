# Release review 0.1.4

Read-only kontrola koordinátora a nezávislého Sol review na `cb47c7532e9cbc1c75c160f7528aadfc36f9d72f` nenašla potvrzený P1/P2 blocker vydání. Zkontrolováno: správná architektura encoderu, zdrojové hashe, Developer ID stejného týmu, codesign/stapler/spctl pro DMG i ZIP, hash/velikost aktualizačních metadat a atomické zveřejnění feedu až po souborech.

⚠️ První post-merge CI 35849447839 selhalo jedinou asercí v `tests/queue-wiring.test.js:6918`: bezpečné ukončení po rozpracovaném startu LuTracku nestihlo zavolat app.quit během výchozího přibližně sekundového vi.waitFor. Kontrola vyvolání stop prošla. Produkční ukončení potom ještě čeká na dokončení stop/zařazení do fronty a serializované list(), zatímco startovní recovery také probíhá asynchronně. Mezi předchozím zeleným main 5f915f4 a cb47c75 se změnily jen dokumenty/důkazy. Z toho samotného nelze prokázat chybu produktu ani příčinu časového zpoždění.

Nezměněný druhý pokus stejné CI brány prošel s 1554 PASS, třemi původními skipy a buildem. Žádný test, timeout, baseline ani quit bariéra se neměnily. První log zůstal v `main-ci-attempt-1-failed.log`; nový výsledek v `main-ci-attempt-2.json` a `.log`. Tag směřuje přesně na tento ověřený commit. Release workflow navíc znovu spouští celé společné brány na macOS.

Tento review záznam není důkaz podpisu, publikace, instalace ani skutečného zvuku. Tyto závěry musí mít vlastní pozorovací body.

Závěrečný dokumentační review: lokální odkazy nových důkazů existují. `git diff --check` nad dokumentační změnou měl exit 0; po přidání doslovných GitHub logů vrací `git diff --cached --check` exit 2 výhradně kvůli jejich původním koncovým mezerám. Logy se kvůli kosmetice neupravují a žádné měřidlo ani pravidlo se nevypíná.

Nezávislé závěrečné Sol review potvrdilo rozsah důkazů a funkční odkazy. Nález provozních SSH hodnot v release logu byl před commitem vyřešen přesnou redakcí osmi hodnot; [evidence redakce](REDACTION.md). Tajné klíče a tokeny už byly maskované runnerem.

Kontrola `mp-progress nahravky-dashboard --check` po dokumentačním commitu nejprve hlásila exit 1: generátor porovnává čas statusu s časem libovolného posledního commitu, takže samotný commit důkazů přepnul očekávaný banner na zastaralý. Oficiální přegenerování HTML a opakovaný `--check` mají exit 0. Čas statusu se nefinguje a varovný banner zůstává; věcný obsah a důkazy vydání 0.1.4 jsou aktuální.
