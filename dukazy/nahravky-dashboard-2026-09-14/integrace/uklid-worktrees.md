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


## Následné převzetí T4

Po merge `0078c935` a zelené root bráně 1433 PASS byla větev `feat/nahravky-overeni` se zdrojovým commitem `9b233c8` ověřena jako předek integrace. Čtyři původní worker logy byly byte-for-byte shodné s integračním archivem. Root report navíc obsahuje plný doslovný obsah těchto logů a vlastní přejímku. Čistý strom `nahravky-overeni` a jeho větev byly odstraněny; první pokus o `branch -d` z main správně odmítl smazání, následný příkaz z integrační větve po kontrole předka uspěl bez force.

Aktivní zůstaly pouze `nahravky-integrace` a `nahravky-akce` (T5), vedle nedotčeného výchozího main. Původní T4 commit je stále dosažitelný z integrační historie a pushnutého PR.
# T-A3 — 15. 9. 2026

Zdroj `0340c8e1076eb8b59bfcc9d176f9aa74f57e400a` je přijatý běžným merge a dosažitelný z integrační větve. Čtyři původní worker logy byly před úklidem ověřeny byte-for-byte proti verzovanému archivu A3; původní report je také v historii. Pracovní strom byl čistý. `git worktree remove` a následné `git branch -d feat/nahravky-vyber-firmy` skončily exit 0, bez force. Nové T-A4 dostane samostatný strom až po T5.
# T-05 — 15. 9. 2026

Zdroj `e225880ec2f8fff1ba7c4460d3436d000fdde8ae` je přijatý běžným merge a dosažitelný z integrační větve. Šest původních T5 logů bylo před úklidem byte-for-byte shodných s verzovaným archivem. Původní report (před root opravou počtu testů) zůstává v původním commitu. Čistý worker strom byl odstraněný přes `git worktree remove`; `git branch -d feat/nahravky-akce` skončilo exit 0, bez force. T-A4 pokračuje v novém stromu z `77543cb`.

## Závěrečný úklid A4 a I1 — 15. 9. 2026

Po přijetí A4 `c25ef2a` a I1 `d6bdfdd` koordinátor ověřil čistý status obou workerů,
ancestor vazbu zdrojových commitů na HEAD a byte shodu všech čtyř A4 a dvou I1 logů
s verzovaným integračním archivem. Původní reporty zůstávají ve zdrojových commitech;
A4 inline sender log je v aktuálním reportu nahrazen odkazem na totožný úplný log
kvůli falešnému C6 nad kontrolou prázdného hesla v URL, nikoli odstraněn.

Worktree `nahravky-firma-zapojeni` a `nahravky-popisky` i jejich lokální větve byly
bez force bezpečně odstraněny. Zůstává hlavní strom a integrační větev; cizí větve
ani hlavní pracovní strom se neměnily. GUI ověřovací proces je ukončený.

První odstranění A4 nahlásilo `Directory not empty`: Git už worktree odregistroval,
ale macOS zanechal jediný `.DS_Store` (6148 B). Koordinátor nejdřív vypsal všechny
zbývající soubory a ověřil, že jde pouze o tento systémový soubor. Potom odstranil
přesně jej a prázdný adresář, následně bezpečně smazal již začleněnou větev A4.
Žádný důkaz ani zdrojový soubor v tomto zbytku nebyl.
