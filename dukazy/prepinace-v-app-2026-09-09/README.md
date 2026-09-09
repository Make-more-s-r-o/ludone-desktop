# Perzistentní vypínač odesílání — 9. 9. 2026

Jediný nový perzistentní vypínač je `uploadEnabled`. Používá existující
`userData/nastaveni/aplikace.json`, atomický zápis a společnou instanci nastavení
s viditelností Docku. Změna jedné volby zachová ostatní. Start ani čtení nevytváří
soubor a nepřidává výchozí hodnoty do staršího souboru.

Pořadí je prostředí, pokud existuje, potom uložený boolean, potom vypnuto.
I prázdná či neplatná proměnná prostředí přebíjí uložené zapnutí. Neplatný JSON,
schéma nebo typ uložené hodnoty odesílání nezapne. Čerstvá instalace bez prostředí
předá frontě vypínač odesílání jako řetězec `"false"`.

Hlavní proces poskytuje `setUploadEnabled(value)`. Přes preload jsou dostupné
`window.ludone.getUploadEnabled()` a `setUploadEnabled(value)`, přes kanály
`settings:get-upload-enabled` a `settings:set-upload-enabled`. IPC přijímá pouze
hlavní rám důvěryhodného okna Nastavení; setter vyžaduje právě jeden boolean.
Vrací účinný stav po započtení případného přebití prostředím. Fronta čte hodnotu
při dalším pokusu i při výpisu dostupnosti odesílání. `desktopKillswitch` přijímá
úložiště jako parametr s výchozí hodnotou `applicationSettingsStore`, takže lze
produkční funkci spouštět také ve výřezech s podstrčeným úložištěm.

## Proč tu není časový přepínač

`getTrackingStore()` zmrazí vypínač při první konstrukci. Živé nastavení času by
po změně hlásilo zapnuto, ale časovač by do restartu zůstal vypnutý. Proto tato
změna neukládá `timeEnabled`, nemá časové IPC kanály ani funkce v preloadu.
`timeTrackingKillswitch()` má původní komentář a vrací pouze
`process.env.DESKTOP_TIME_ENABLED`; životnost hodnoty u čtenářů se nemění.

## Ověření

Původní `eslint.log` a `tsc.log` zůstávají zachované. Zastaralé `vitest.log`,
`preskocene.log` a `E5.log` byly odstraněny; poslední dva obsahovaly selhání zápisu
konfigurace ve sdíleném `node_modules/.vite-temp`, nikoli měření vady aplikace.
Nové doslovné výstupy všech čtyř příkazů včetně exit kódů jsou v
[`overeni-opravy.log`](overeni-opravy.log). Příkazy běžely bez roury; exit kód
byl převzat přímo z procesu. Vitest a E5 se v tomto běhu nepřekrývaly.

| Příkaz | Exit kód | Výsledek po opravě |
|---|---:|---|
| `npx eslint .` | 0 | Bez výstupu |
| `npx tsc --noEmit -p jsconfig.json` | 0 | Bez výstupu |
| `npx vitest run --configLoader runner --no-file-parallelism` | 0 | 53 souborů, 1169 prošlých testů, 3 původně přeskočené |
| `bash scripts/akceptace/E5.sh` | 1 | V obou pokusech závěrečný řádek `chyb: 2` |

🧪 zelené testy: celý Vitest včetně nezměněného `zapojeni-odhlaseni.test.js`
a nezměněných tvrzení `tracking-timer.test.js`. Testy perzistence a zapojení
z předchozího kola jsou omezené na odesílání; ověřují také odmítnutí časového
klíče a nepřítomnost časových IPC kanálů a funkcí preloadu.

⚠️ varování či rozpor: E5 zůstává červená ze dvou oddělených důvodů:

- `unit testy queue jsou zelené`: Vitest uvnitř E5 skončil před spuštěním testů
  na EPERM při zápisu konfigurace do `node_modules/.vite-temp`. Podle zadání
  byl celý příkaz zopakován; EPERM přetrval. `node_modules` odkazuje na
  `/Users/dan/Dev/ClaudeCode/ludone-desktop/node_modules`, mimo zapisovatelný
  worktree. To je selhání prostředí, nikoli červený test aplikace; samotnou
  souběžnou kolizi tento běh neprokázal.
- `vypínač odesílání je fail-closed i v produkční cestě (chování)`: sonda
  vyžaduje pro chybějící proměnnou prostředí přesně `undefined`, ale nový
  vypínač s uloženou volbou vypnuto vrací `"false"`. Tvrzení sondy zůstalo
  beze změny a jeho úpravu podle zadání přebírá orchestrátor.

Původní log měl 20 pádů na chybějícím `desktopKillswitch`, jeden na doslovném
starém těle časového vypínače a jeden na starém soupisu IPC kanálů. Premisa
jediné příčiny všech 22 pádů tedy nebyla přesná. Výřezy nyní dostávají funkci
i atrapu úložiště vracející vypnuto. Tvrzení v `queue.test.js`,
`tracking-timer.test.js`, `tray-authority.test.js` a v sondě E5 byla porovnána
s počáteční kopií a jsou beze změny. Původní časový komentář i funkce byly
obnoveny doslova podle souboru v hlavním pracovním stromu, bez git operace.

⛔ neověřeno: skutečná zabalená aplikace spuštěná z Finderu a ostré odesílání.
Žádný provozní vypínač ani skutečné uživatelské nastavení se v tomto běhu nemění.
Review nad diffem a verzování důkazů přebírá orchestrátor; tento běh podle zadání
neprovádí žádnou git operaci.
