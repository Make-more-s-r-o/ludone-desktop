# Uložení důkazů a úklid pracovních stromů — 14. 9. 2026

Před odstraněním byly ověřeny čisté pracovní stromy, převzetí patchů a verzované důkazy. Novější T-03, T-A2 a T-R1 byly převzaty běžným mergem; jejich důkazy byly shodné s integrovaným archivem a zdrojové commity jsou předky integrační větve.

Starší workery už koordinátor převzal cherry-pickem. `git cherry` potvrdil ekvivalenci všech runtime patchů. Pouze dva dokumentační commity (`b9055f8` a `d361f9f`) se lišily kvůli dříve ručně integrované a nyní aktualizované sekci 12 zadání; jejich původní reporty v `dukazy/` byly byte-for-byte shodné s integračním archivem. Historie těchto přijatých workerů se zachovala pomocí merge strategie `ours`, výslovně pouze jako propojení předků. Po každém propojení byl ověřen identický hash Git tree; `git diff --exit-code ea338b5 680eba4` skončil exit 0. Žádný kód ani aktuální dokument nebyl přepsán starší verzí.

| Odstraněný strom | Zachovaný zdrojový commit | Větev byla odstraněna po ověření předka |
|---|---|---|
| nahravky-fronta | `aa0c036` | feat/nahravky-fronta-data |
| nahravky-prevzeti | `57f1696` | feat/nahravky-prevzeti |
| nahravky-masterplan | `d6f03ab` | docs/nahravky-masterplan |
| nahravky-auth | `580763e` | fix/nahravky-prihlaseni |
| nahravky-vydani | `10cdf21` | feat/nahravky-vydani |
| nahravky-dashboard | `0b3f36b` | feat/nahravky-lokalni-prehled |
| nahravky-userinfo | `445fe9f` | fix/nahravky-userinfo |
| nahravky-limity | `0addac6` | fix/nahravky-limity |

Některá odstranění přerušil nově vznikající `.DS_Store`. U zbytku stromu `nahravky-fronta` bylo před dokončením úklidu všech 333 zbývajících trackovaných souborů ověřeno proti původním Git blobům; rozdíly nebyly. Mimo ně zůstávaly pouze závislosti a generované ikony. Úklid nezahrnoval výchozí `main`, cizí větve ani aktivní `nahravky-overeni`.

🧪 GitHub CI pro společný kód T-03, T-R1 a T-A2 na `ea338b5` skončilo SUCCESS: [run 34896911725](https://github.com/Make-more-s-r-o/ludone-desktop/actions/runs/34896911725). Následujících pět archivních merge commitů mělo totožný obsah stromu. Toto není důkaz živého uploadu, instalace nebo zvuku; finální brány čekají na T-04/T-05.
