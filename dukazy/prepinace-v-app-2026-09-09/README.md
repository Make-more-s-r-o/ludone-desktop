# Perzistentní vypínače odesílání — 9. 9. 2026

Původní přepínače byly čtené pouze z prostředí. Nyní používají existující
`userData/nastaveni/aplikace.json`, stejný atomický zápis a stejnou instanci
nastavení jako viditelnost Docku. Ukládají se jako booleany `uploadEnabled`
a `timeEnabled`. Změna jedné volby zachová ostatní. Start ani čtení nevytváří
soubor a nepřidává výchozí hodnoty do staršího souboru.

Pořadí je prostředí, pokud existuje, potom uložený boolean, potom vypnuto.
I prázdná či neplatná proměnná prostředí přebíjí uložené zapnutí. Neplatný JSON,
schéma nebo typ uložené hodnoty nezapne příslušný vypínač. Čerstvá instalace
bez prostředí předá frontě oba vypínače jako řetězec `"false"`.

Hlavní proces poskytuje `setUploadEnabled(value)` a `setTimeEnabled(value)`.
Přes preload jsou dostupné `window.ludone.getUploadEnabled()`,
`setUploadEnabled(value)`, `getTimeEnabled()` a `setTimeEnabled(value)`.
Používají kanály `settings:get-upload-enabled`, `settings:set-upload-enabled`,
`settings:get-time-enabled` a `settings:set-time-enabled`. IPC přijímá pouze
hlavní rám důvěryhodného okna Nastavení; setter vyžaduje právě jeden boolean.
Vrací účinný stav po započtení případného přebití prostředím.

Fronta čte nové hodnoty při dalším pokusu i při výpisu dostupnosti odesílání.
Samotné úložiště časovače si podle dosavadního kontraktu ponechává hodnotu
z konstrukce až do restartu. Životnost časovače se v tomto úkolu nemění.

## Ověření

Doslovné výstupy včetně příkazů a exit kódů jsou v sousedních souborech.
Příkazy se spouštěly bez roury; exit kód je návratový kód procesu.

| Příkaz | Exit kód | Výsledek |
|---|---:|---|
| `npx eslint .` | 0 | Bez výstupu |
| `npx tsc --noEmit -p jsconfig.json` | 0 | Bez výstupu |
| `npx vitest run --configLoader runner --no-file-parallelism` | 1 | 22 selhání, 1147 průchodů, 3 přeskočené |
| `npm run preskocene` | 1 | EPERM při zápisu konfigurace do sdíleného `node_modules/.vite-temp` |
| `bash scripts/akceptace/E5.sh` | 1 | `chyb: 2` |

🧪 zelené testy: `tests/queue-wiring.test.js` a
`tests/settings-persistence.test.js`, celkem 268/268. Nové testy ověřují čerstvou
instalaci bez zápisu, restart nad skutečným dočasným souborem, přebití prostředím
včetně neplatných hodnot, poškozená data, zachování voleb při změně Docku,
chybu zápisu, předání hodnot frontě a validaci IPC i preloadu.
Před přidáváním testů byly přečteny existující testy i jejich pomocníci v obou
souborech. Dosavadní testy nebyly přepsány.

⚠️ varování či rozpor: celý testovací běh a E5 zelené nejsou. Podrobnosti:

- 20 testů v `queue.test.js`, `tracking-timer.test.js` a
  `tray-authority.test.js` spouští vytažená těla funkcí bez nové závislosti
  `desktopKillswitch` a končí na `ReferenceError`.
- `zapojeni-odhlaseni.test.js` vyžaduje doslovné původní tělo
  `timeTrackingKillswitch`, které vrací pouze proměnnou prostředí. To je v přímém
  rozporu s nově zadanou perzistencí.
- `ipc-sender-guard.test.js` vyžaduje přesný původní seznam kanálů; nové čtyři
  validované kanály v jeho seznamu nejsou.
- Sonda E5 také spouští výřez funkcí bez úložiště a nové závislosti. Navíc
  výslovně vyžaduje přesné vrácení původní hodnoty z prostředí, včetně
  `undefined`, bez doplnění výchozí hodnoty. Předpokládá tedy původní kontrakt.
  Proto je v předání `premisaPlatila: false` podle pokynu pro neodpovídající
  bránu, přestože původní čtení pouze z prostředí bylo potvrzeno.
- Druhé selhání E5 je stejný zákaz zápisu konfigurace Vitestu jako u
  `preskocene`. Kontroly vypnutých hodnot v `.env.example` i nepřítomnosti
  zapnutých vypínačů v provozním kódu prošly.

Timeout nenastal; žádný běh nebyl kvůli timeoutu opakován. Nebyly měněny brány,
baseline, pravidla lintu ani timeouty. Nebyla provedena git operace, přidáno
tlačítko ani změněno skutečné uživatelské nastavení. Zapnuté hodnoty vznikaly
pouze v izolovaných dočasných testovacích datech.

⛔ neověřeno: skutečná zabalená aplikace spuštěná z Finderu a ostré odesílání.
Review nad diffem a zařazení důkazů do verzování přebírá orchestrátor;
tento běh podle zadání neprováděl commit ani jinou git operaci.
