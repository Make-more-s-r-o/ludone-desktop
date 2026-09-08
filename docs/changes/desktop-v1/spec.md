# Spec: LuDone Desktop v1

**Stav: ZMRAZENO 1. 9. 2026.** Všech deset otázek rozhodovacího balíku je zodpovězeno
(`decisions.md`, kolo 2). Zbývají už jen dvě **měření**, ne rozhodnutí — viz §9.

Nadřazené: [`intent.md`](intent.md) · [`decisions.md`](decisions.md) ·
schválený design [`../../design/approved.json`](../../../design/approved.json) a jeho náhled
[`../../design/navrh/nahled.html`](../../../design/navrh/nahled.html)

## Autorita při rozporu

Produktový záměr → `intent.md`. Chování → tenhle dokument. Vzhled a interakce → schválený design
interpretovaný přes tenhle dokument. Technická realizace → `plan.md`.
**Implementátor rozpor neřeší sám** — zastaví se a vrátí konkrétní otázku.

---

## 1. Rozsah

### Je v rozsahu

- Nahrání schůzky dvěma oddělenými stopami, uložení na disk, odeslání na server.
- Měření času na projektu: spustit, přepnout projekt, zastavit.
- Přihlášení k `app.ludone.cz`, odhlášení, obnova tokenu.
- Oprávnění na mikrofon a systémový zvuk včetně zkoušky.
- Panel pod ikonou v liště, kontextové menu, nastavení, diagnostika.
- Připomínky, když neběží časovač.

### Není v rozsahu

Archiv, přepisy, hledání, grafy, přehledy, management a admin LuTracku — všechno na webu.
Kalendář (M15). Seznam účastníků schůzky — **ztrácí se bez náhrady**. Mobilní aplikace (A5).

🔴 **Serverová strana není v rozsahu této změny** (S1). Desktop ukládá na disk a řadí do fronty,
ale odesílání zůstává za vypnutým `DESKTOP_UPLOAD_ENABLED`. Příjem na `app.ludone.cz` dostane
vlastní průchod masterplánem; most je [`docs/server-modul/KONTRAKT.md`](../../server-modul/KONTRAKT.md).

🔴 **MCP nástroje nejsou v rozsahu** (S2). Ptát se bude přes LuDone MCP nad aplikací. Desktop má
jedinou povinnost: **data, která odešle, musí být přes MCP čitelná** — nesou vlastníka, projekt
jako GUID a časy v UTC.

---

## 2. Role a viditelnost

| Role | Co smí |
|---|---|
| **Uživatel** | Nahrávat, měřit čas, vidět a odeslat vlastní záznamy |
| **Vedoucí projektu** | v1 nic navíc — vidí jen své vlastní záznamy |
| **Admin** | Vidí **vše**. Nahrávky jsou majetkem firmy (B2) |
| **Odebraný z firmy** | Server data **zachová a odepře přístup**. Desktop přestane odesílat i nabízet, lokální soubory nemaže — smazání je vědomý krok správce |
| **Sdílené zařízení** (`zasedacka@makemore.cz`) | 🔴 **Součást v1.** Vlastní etapa, viz `plan.md` B10 |

🔴 **Tři nezávislé osy práv** (dědí se z `ludone-app`, neobcházet): modul-gate × company-scope ×
citlivá pole. Vše **default-deny**.

---

## 3. Funkční matice

🔴 **Čtyři nezávislé osy, ne jeden sloupec „hotovo".** Masterplán §8 to jmenovitě zakazuje a tenhle
repozitář ví proč: v srpnu tu devět zelených bran hlásilo hotovou práci, která se nikdy nespustila.
Funkce může být **napsaná, nikam nezapojená a neověřená naráz** — jeden sloupec to neumí říct.

| Osa | Hodnoty | Odpovídá na otázku |
|---|---|---|
| **scope** | `approved` · `draft` · `rejected` | Je to schválené do téhle vlny? |
| **delivery** | `no-code` · `coded` · `committed` · `pr-open` · `merged` | Existuje kód a kde leží? |
| **exposure** | `disabled` · `labs` · `production` | Dostane se k tomu člověk? |
| **verification** | `unverified` · `tests-green` · `verified-live` | Kdo to viděl fungovat? |

⚠️ **Osa `exposure` je pro desktop přeložená**, protože se nic nerozváží: `labs` = běží ze zdrojáku
na Danově Macu · `production` = podepsaný build v rukou týmu. **Do `production` dnes nesahá nic**
a nedostane se tam, dokud nepadne A2 (Apple Developer Program). To není nedodělek, to je stav.

| ID | Funkce | Riziko | scope | delivery | exposure | verification |
|---|---|---|---|---|---|---|
| `DSK-F001` | Ikona v liště nese stav, klik otevře panel | normal | approved | **merged** | **labs** | tests-green ¹⁷ |
| `DSK-F002` | Kontextové menu na ikoně se zkratkami | normal | approved | **merged** | labs | **verified-live** ²⁰ |
| `DSK-F003` | Přihlášení OAuth 2.1 + PKCE, loopback | security | approved | **merged** | disabled ⁹ | unverified |
| `DSK-F004` | Odhlášení s odvoláním na serveru | security | approved | **merged** | disabled ¹⁰ | tests-green |
| `DSK-F005` | Obnova tokenu, jednovláknová | security | approved | no-code ²¹ | disabled | unverified |
| `DSK-F006` | Oprávnění mikrofon a systémový zvuk + zkouška | normal | approved | **merged** | labs | **verified-live** ¹⁹ |
| `DSK-F007` | Nahrávání dvou stop na disk | normal | approved | merged | labs | **verified-live** ¹⁴ |
| `DSK-F008` | Pojmenování nahrávky při zastavení | normal | approved | **merged** | labs | **verified-live** ¹⁴ |
| `DSK-F009` | Odchozí fronta s opakováním | normal | approved | **merged** | disabled ¹⁰ | tests-green |
| `DSK-F010` | Odeslání na server | rbac | **draft** | **merged** ²² | disabled | unverified |
| `DSK-F011` | Časovač: start, přepnutí projektu, stop | **money** | approved | **merged** | disabled ¹⁰ | tests-green |
| `DSK-F012` | Výběr projektu z alokací | **money** | approved | no-code ¹¹ ¹⁵ | disabled | unverified |
| `DSK-F013` | Časovač přežije pád a restart | **money** | approved | **merged** | disabled ¹⁰ | tests-green |
| `DSK-F014` | Připomínky, když neběží časovač | normal | approved | no-code | disabled | unverified |
| `DSK-F015` | Nastavení: účet, zvuk, záznamy, připomínky, diagnostika ¹³ | normal | approved | **merged** | labs | **verified-live** ¹⁸ |
| `DSK-F016` | Ikona v Docku jako volba | normal | approved | **merged** | labs | **verified-live** ¹⁶ |
| `DSK-F017` | Mazání lokálních kopií po 7 dnech | normal | approved ¹² | **merged** | disabled | tests-green |

¹³ **Upřesněno 3. 9. 2026.** Název funkce vyjmenovává pět částí, ale `merged` neplatilo
pro všechny. **Diagnostika do 3. 9. neexistovala vůbec** — dostavěna PR #51 spolu s přestavbou
Nastavení na čtyři záložky podle návrhu (Účet · Zvuk · Záznamy · Diagnostika).
🔴 **Připomínky se vědomě NESTAVÍ** (rozhodnutí BD-N43: „nastavení patří na server, aplikace
ho pouze přebírá"), takže `merged` u téhle funkce znamená **čtyři části z pěti**.
Osa se opravuje podle BD-N30 — zmrazení chrání požadavky, ne sloupce o stavu.


¹⁸ **Ověřeno naostro 7. 9.** na buildu `62f04cb`: okno Nastavení otevřeno z panelu a projity
všechny čtyři karty se skutečným obsahem — Účet (e-mail, zařízení, prostředí labs), Zvuk,
Záznamy (retenční volby), Diagnostika (verze, architektura, oprávnění, fronta).
⚠️ Ověřeno je **zobrazení**, ne zápis systémových voleb: přepínače Docku a spouštění po
přihlášení sahají na macOS a ty jsem záměrně nepřepínal.

🔴 **Aktualizováno 7. 9. 2026 — matice byla ČTYŘI DNY po realitě.** Od 3. 9. přibylo 39 PR
(#41–#79) a matice se neudržovala, takže hlásila `no-code` u funkcí, které stojí. Tohle je
přesně to, kvůli čemu se Dan ve vývoji ztratil, a je to vada dokumentu, ne kódu.

¹⁴ **Ověřeno naostro 6. 9.**: nahrávání prohnáno celým tokem s **podstrčeným syntetickým
zvukem** (mikrofon 440 Hz, systém 880 Hz) — start · měřáky · souběh s LuTrackem · zastavení ·
pojmenování · export do Stažených · zařazení do fronty. Recept je v `CHECKPOINT.md`.

¹⁵ 🔴 **Pozor, vypadá to hotově a není:** UI výběru projektu existuje (`Přepnout projekt`
+ most `switchTrackingProject`), ale seznam je **natvrdo v `TrackingCard.jsx:6–9`** — čtyři
vymyšlené názvy. Skutečné alokace čekají na kontrakt fáze 2. Osa proto zůstává `no-code`:
existující obal bez dat není funkce.

¹⁶ **Ověřeno naostro 6. 9.**: přepínač v Nastavení + záchrana z výstražného okna (#69);
macOS potvrdil položku v Docku.

¹⁷ 🔴 **Sníženo na `tests-green` 7. 9. 2026 — předchozí `verified-live` popíralo vlastní doklad.**
Změřeno naostro 4. 9. bylo tohle: ikona se na Danově stroji **nevykreslila**. macOS ji položil
pod výřez a `screencapture -R 796,0,56,32` vrátil **7168 pixelů, všechny RGB 32, ani jeden
jasnější než 100** (`CHECKPOINT.md:32–47`). To je doklad **selhání**, ne ověření. Ověřené je
jen to, co přišlo po opravě: aplikace ten stav **pozná a řekne** (#67 — výstražné okno se po
restartu skutečně otevřelo) a **nabídne cestu do Docku** (#69).

🔴 **Druhá půlka názvu — „klik otevře panel“ — nemá doklad žádný.** Kód existuje
(`electron/main.cjs:3724`, `tray.on("click", togglePanel)`), ale v bránách na něj nikdo nesahá:
`testClickTray` volá jedině `scripts/ui-smoke.mjs:446`, a ten v `npm run gates` neběží
(`tests/ui-smoke.test.js` testuje pomocnou knihovnu `src/lib/ui-smoke.js`, ne ten klik).
Na Macu ten klik neprovedl nikdo — ikona nebyla vidět.

Stavovou půlku názvu drží testy (`tray-ikony`, `tray-authority`, `tray-space-warning`), proto
`tests-green`. Zpět na `verified-live` až poté, co někdo klikne na **viditelnou** ikonu a panel
se otevře.

²¹ 🔴 **Uvedeno na pravou míru 7. 9. 2026: ten kód NEEXISTUJE.** Matice tu do dneška hlásila
`merged` + `tests-green` u **bezpečnostní** funkce. Změřeno: jediná výměna tokenu v repu je
`grant_type: "authorization_code"` (`src/lib/oauth.js:109`); refresh token se používá
**výhradně k odvolání** při odhlášení (`electron/auth.cjs:727`, `sessionTokenForRevocation`).
Žádná jednovláknová brána — `grep -rn "single.flight\|inFlight\|singleFlight" src/ electron/`
vrací **0** — a žádný test. `auth.cjs:257`
(`grant_types: ["authorization_code", "refresh_token"]`) je jen ohláška v dynamické registraci,
ne implementace.

🔴 **Nestavět to nebyl přehlédnutý dluh, ale rozhodnutí:** `tasks/B8-zapojit-auth.md:126`
(*„Co B8 NENÍ: obnova tokenu (F005)“*) a `:284` (*„B8 obnovu nepřidává (F005)“*).
🔴 **Stojí na ní R15** („dva souběžné pokusy odhlásí uživatele samého od sebe“). Kdo tuhle osu
příště překlopí zpátky na `merged`, ať nejdřív ukáže tu jednovláknovou bránu a test, který ji drží.

²² 🔴 **Uvedeno na pravou míru 7. 9. 2026: ten kód EXISTUJE.** Matice tu držela `no-code`,
ale `electron/upload-client.cjs` má **665 řádků**, `electron/main.cjs:39` ho importuje
(`createRecordingUploadSend`), `electron/main.cjs:2130` ho zapojuje do odesílacího pokusu fronty
a `tests/upload-client.test.js` má 889 řádků. Kód dojel do `main` **3. 9.** (PR #37 `484ec28`,
PR #56 `7432497`).

**D29 („nestavět proti němu nic, ani za vypnutým killswitchem“) je pokyn DO BUDOUCNA ze 7. 9.**,
tedy o čtyři dny mladší než ten kód — věta *„`DSK-F010` tím zůstává `no-code`“*
(`decisions.md:1000`) popisuje záměr, ne stav repozitáře.

`scope` proto zůstává `draft` a `exposure` `disabled`: chybí scope `mcp:upload` (D29) a serverová
strana je S1. **D36** to shrnuje přesně — *„odesíláme, ale celá cesta nefunguje“*: naše strana je
hotová (PR #83), ale `declaredCaptureSources` u nás **končí v adrese nahrávací stránky**.

🔴 **Zmírněno 8. 9. 2026 — dřívější znění „hodnota dorazí a zahodí se“ tvrdilo víc, než je
doložené.** Oprava přišla od **serverové session (8. 9.)**, není to naše měření: **prohlížečová
cesta parametr vůbec neposílá dál** — je to parametr od desktopu — takže se k příjmu nedostane
a jejich záznam má u toho pole **`NULL`**. Hodnota `microphone+system` **dosud neprošla žádným
skutečným požadavkem**; kryjí ji jen naše unit testy (`tests/recording-export.test.js`) a `CHECK`
v jejich databázi. Ne „dorazí a zahodí se“, ale **nedorazí**. Podrobně `decisions.md` **D36b**.

⚠️ `verification` nechávám na `unverified` — tenhle běh měnil výhradně osu `delivery`. Testy
`tests/upload-client.test.js` ale běží nad produkčním modulem, takže osa je kandidát na
`tests-green`; ať ji posune ten, kdo o F010 rozhoduje.

🔴 **Aktualizováno 2. 9. 2026 po sloučení celého stohu** (PR #2–#13). Dan schválil, že se
stavové osy smějí udržovat, i když je zbytek specu zmrazený — zmrazení chrání POŽADAVKY
(R1–R25, acceptance), ne sloupce o stavu (rozhodnutí BD-N30). Osy jsou podle masterplánu
jediný zdroj pravdy o stavu; nechat je lhát je horší než je upravit.

**Souhrn — spočteno z matice výš 7. 9. 2026: ze 17 funkcí je 14 `merged`, 7 v `labs`
a 6 `verified-live`.** Rozdíl mezi 14 a 7 zůstává nejdůležitějším číslem projektu: most
`preload.cjs` vystavuje **41** funkcí, `src/` jich volá **31** a **10 zůstává nezavolaných**
(`getTrackingState`, `getTrayState`, `hidePanel`, `resolveRecoveredTracking`, `setAuthOrigin`,
`startTracking`, `stopTracking`, `switchTrackingProject` — plus testovací háky `testClickTray`
a `testQuit`). **Časová agenda je postavená, otestovaná a nezapojená**; odhlášení a fronta
už volajícího mají (viz poznámka ¹⁰).

🔴 **`production` má dál nula funkcí** a nic se tam nedostane, dokud nepadne A2.
⚠️ **Staré znění tohohle odstavce tvrdilo „11 merged, 4 labs, nula verified-live, 16 funkcí“ —
ani jedno ze čtyř čísel neodpovídalo matici o šedesát řádků výš.** Kdo je bude měnit, ať je
**přepočítá z tabulky**, ne z paměti.

**Poznámky — každá je změřená, ne odhadnutá:**

⚠️ **Poznámky ¹–⁸ jsou HISTORICKÉ (stav k 2. 9. 2026) a matice na ně už neodkazuje** — žádný
řádek tabulky výš nenese značku ¹ až ⁸. Zapsané zůstávají jako záznam, čím ta místa tehdy byla,
**ale nejsou popisem dneška**. Kde se stav od té doby pohnul, je to u poznámky dopsané; čísla
řádků v nich odplula stejně jako jinde v tomhle dokumentu.

¹ Commit `ce2bea6` na větvi `fix/tray-prazdna-ikona`, **záměrně nemergováno** — je to user-visible
implementace bez schváleného specu, tedy přesně to, co tenhle masterplán zakazuje. Brána volá
produkční `trayImage()`, takže neměří kopii logiky. Ale `verified-live` to není: po opravě
ikonu nikdo na Macu neviděl.

² *(historické, 2. 9.)* `createAuthController` je v `electron/auth.cjs:1008` definovaná a na
řádku 1341 exportovaná — a **nikde v repozitáři se neimportuje**. Je to hotová logika mimo
provoz. 🔴 Navíc má token scope jen `mcp:read` a `mcp:draft` (`MCP_SCOPES`, `auth.cjs:30`),
tedy **nemůže zapisovat**; bez zápisového scope je serverový kontrakt nepoužitelný.
🔴 **Opraveny čtyři ukazatele 7. 9. 2026** — všechny čtyři mířily jinam
(`325` je hlavička `content-type`, `502` je `removeOrphanedTokenTemps`, `14` je
`REVOKE_TIMEOUT_MS`). **A první věta už neplatí:** `electron/main.cjs:26` ten controller importuje
a `electron/main.cjs:3263` ho zapojuje (`createAuthBeginHandler(createAuthController)`).
Mimo provoz to není. Druhá věta — scope jen `mcp:read` a `mcp:draft` — platí beze změny (D29).

³ Existuje, ale zamyká celou aplikaci — odepřené oprávnění dnes shodí i časovou agendu, která
s mikrofonem nemá co do činění.

⁴ **Tady je hranice, na které tenhle projekt už jednou uklouzl.** Změřeno je: dvě stopy vzniknou
na disku a zvuk z loopbacku nese řeč (`meet-mereni.mjs`, referenční soubor: úspěch 0,9983 ·
odebrané AEC 0,0696 · přeslech odhalen). **Nezměřeno je to podstatné** — že to funguje na
skutečné schůzce s živým protějškem (A6, čeká na Dana). A cesta, po které to jede, je ta,
kterou `IsSystemLoopbackCaptureSupported()` na macOS 26.4 hlásí jako nepodporovanou. Proto
`tests-green`, ne `verified-live`.

⁵ *(historické, 2. 9.)* `src/lib/queue.js` má 200+ řádků a vlastní testy, ale **žádný soubor
v `src/` ani `electron/` ji neimportuje**. Zelené testy nad nezapojeným kódem.
🔴 **Neplatí od 7. 9. 2026 — a je to učebnice lhavého grepu.** `electron/main.cjs:65` ten modul
načítá (`const queueModulePromise = import(pathToFileURL(path.join(PROJECT_ROOT, "src", "lib",
"queue.js")).href)`) a `main.cjs:2076` a `:2148` z něj čerpají. Cesta se skládá za běhu, takže
`grep -rn "lib/queue" electron/` vrací **0 zásahů** — nula, která neznamená „nezapojeno“,
ale „nehledal jsem tak, jak se to volá“.

⁶ **Jediná funkce se scope `draft`, a je to úmysl.** Serverová strana je S1 — dostane vlastní
průchod masterplánem v `ludone-app`. Zapojit frontu k serveru, který neexistuje, je v `plan.md`
výslovně zakázané. Zadání pro ten běh je `docs/server-modul/KONTRAKT.md`.

⁷ `src/features/tracking/TrackingCard.jsx` má **77 řádků a všechen stav v `useState`** — tedy
v rendereru, kde ho zabije každý pád okna. Atrapa není `coded`; kdyby byla, matice by lhala
přesně tím způsobem, kvůli kterému tahle tabulka má čtyři sloupce.

⁸ Tamtéž, řádek 5: `const PROJECTS = ["LuDone Desktop", "Web · klientská zóna", "Interní provoz"]`.
Tři řetězce natvrdo. Žádná alokace, žádné GUID.

**Součet, ať se to nemusí počítat očima (přepočteno z matice 7. 9. 2026):** ze **sedmnácti**
funkcí má **čtrnáct** kód v `main` (`merged`), **sedm** z nich je dosažitelných ze zdrojáku na
Macu (`labs`) a **šest** někdo viděl fungovat naostro (`verified-live`: F002, F006, F007, F008,
F015, F016). Bez kódu zůstávají **tři** — F005 (obnova tokenu, rozhodnuto nestavět v B8),
F012 (výběr projektu, BD-N28) a F014 (připomínky, BD-N43). **Nic není v `production`.**

---

## 4. Business pravidla

### Nahrávání

- **R1** Obě stopy se ukládají **odděleně**, nikdy nemíchané.
- **R2** Chunky jdou na disk **dřív, než se cokoli pošle** na server.
- **R3** Když vypadne jedna stopa, nahrávání **pokračuje** a řekne, **která** chybí.
  🔴 Kód dnes zastaví obě — to je vada, ne chování.
- **R4** Zastavení nahrávání **nezastaví časovač**. Nabídne se „Zastavit i měření času?“ a nabídka zmizí sama (C1).
- **R5** Aktualizace se **nikdy** nenabídne během nahrávání ani ukládání.

### Čas

- **R6** Nabízet **jen projekty s platnou alokací k dnešnímu datu**. Identita projektu je **GUID**,
  nikdy název — přejmenování firem 23. 7. 2026 srazilo platby na pět dní.
- **R7** Projekt s čerpáním **nad 110 %** je zašedlý a s důvodem. Databáze to nehlídá.
- **R8** Klient **nikdy neposílá hodinovou sazbu**. Dosazuje ji databáze z alokace.
- **R9** Start i stop se ořezávají na **celé minuty**, zobrazuje se `5h 16m`, ne `5:16:07`.
- **R10** 🔴 **Klíč proti duplikaci vzniká při STARTU** časovače, ne při odeslání. Do Tabidoo teče
  týdenní souhrn, takže duplicita není vidět — jen tiše zvedne hodiny do mzdových nákladů.
- **R11** Přepnutí projektu za běhu časovač **nezastaví**.

### Fronta a přihlášení

- **R12** Odhlášení **nesmí smazat frontu**.
- **R13** Odhlášení odvolá přístup **nejdřív na serveru**, teprve pak smaže lokálně.
- **R14** Vypršelý token se během nahrávání **neprojeví nijak** — zvuk jde na disk.
- **R15** Obnova tokenu je **jednovláknová**. Dva souběžné pokusy odhlásí uživatele „sám od sebe".
- **R16** `403` a „uzavřený týden" jsou **trvalé** chyby: neopakovat, data zachovat, říct důvod.
- **R17** `invalid_grant` je **pauza**, ne selhání — nespotřebovává pokusy.
- **R18** **Dva samostatné vypínače** (C2): `DESKTOP_UPLOAD_ENABLED` a `DESKTOP_TIME_ENABLED`. Oba fail-closed — chybějící hodnota znamená vypnuto a musí mít vlastní test.
- **R19** Lokální kopie nahrávky se po úspěšném odeslání smaže za **7 dní** (B3). Nastavitelné včetně „nemazat“.
- **R20** Nahrávky jsou **majetkem firmy** (B2). Admin je vidí všechny.

---

## 5. Stavový automat panelu

```
        ┌──────────────┐
        │ NEPŘIHLÁŠEN  │──přihlásit──▶ ČEKÁ NA PROHLÍŽEČ ──┐
        └──────────────┘◀──zrušit / vypršelo ──────────────┘
                │ přihlášeno
                ▼
        ┌──────────────┐   povolit    ┌──────────────┐
        │ BEZ OPRÁVNĚNÍ│─────────────▶│    KLID      │
        └──────────────┘              └──────────────┘
                                       │           │
                          nahrát ──────┘           └────── spustit čas
                                       ▼                        ▼
                              ┌────────────────┐      ┌──────────────┐
                              │   NAHRÁVÁ      │◀────▶│  MĚŘÍ ČAS    │
                              └────────────────┘ obojí└──────────────┘
                                  │        │
                       vypadne ───┘        └─── ukončit ──▶ POJMENOVÁNÍ ──▶ FRONTA
                       stopa
                          ▼
                  NAHRÁVÁ OMEZENĚ
```

**Souběh je pravidlo, ne výjimka.** Obě agendy mají vlastní automat a vlastní start i stop.

---

## 6. Matice stavů

| Stav | Panel | Lišta | Kde je dnes |
|---|---|---|---|
| Klid | dva sbalené řádky | běžná ikona | částečně |
| Jen nahrávání | karta rozbalená | červená | částečně |
| Jen čas | karta rozbalená | zelená + text | atrapa |
| Obojí | obě rozbalené | 🔴 **pátý stav CHYBÍ** — tiše se překlopí na „nepřihlášeno" | chybí |
| Výpadek zvuku | žlutý pruh v kartě | žlutá + odznak | chybí |
| Čeká fronta | pruh s počtem a „Zkusit teď" | odznak | chybí |
| Bez sítě | patička říká, že se odešle později | šedá | chybí |
| Přihlášení vypršelo | „Zkusit znovu" + Co se mohlo stát | — | chybí |
| Účet nemá přístup | jméno účtu + přihlásit jiným | — | chybí |
| Oprávnění zamítnuto | částečné povolení funguje dál | — | 🔴 zamyká celou appku |
| Projekt přečerpán | zašedlý s důvodem | — | chybí |
| Prázdno (žádná alokace) | „Nemáš dnes žádný projekt s alokací“ + odkaz do LuDone | — | chybí |
| Sdílené zařízení | jméno účtu v hlavičce, po zastavení se ptá čí to bylo | — | chybí |

---

## 7. Přístupnost a copy

- Stav se **nikdy nesděluje jen barvou** — vždy i tvarem, textem nebo odznakem.
- Vše ovladatelné klávesnicí; viditelný focus; `prefers-reduced-motion` se respektuje.
- Ikona v liště je **šablonová** (černá s průhledností) — barvu řeší systém.
- Copy česky, v jazyce uživatele: „Zbývá z alokace", „Přepnout projekt", „Ukončit a uložit".
  🔴 Nikdy „MCP", „scope", „token" v textu, který vidí uživatel.

---

## 8. Acceptance scenarios

**`DSK-F001` ikona je vidět**
Given čerstvě nainstalovaná aplikace · When ji spustím · Then je v liště **neprázdná** ikona
(`isEmpty() === false`, rozměr nad nulu) a klik otevře panel.

**`DSK-F007` + `DSK-F009` nahrávka přežije zavření notebooku**
Given běžící nahrávání · When zavřu víko a za hodinu otevřu · Then nahrávka je na serveru
**bez ručního zásahu a bez duplikátu**.

**`DSK-F011` čas přežije pád**
Given běžící časovač · When zabiju renderer · Then panel se otevře s **běžícím** časovačem
a správným časem.

**`DSK-F013` duplicita nevznikne**
Given start časovače, síť vypadne, klient pokus zopakuje · When se obojí odešle ·
Then na serveru je **jeden** záznam.

**`DSK-F012` přečerpaný projekt nejde vybrat**
Given projekt s čerpáním 112 % · When otevřu výběr · Then je zašedlý s důvodem
a **nejde na něj vykázat**.

**`DSK-F003` vypršelé přihlášení řekne důvod**
Given přihlášení otevřené déle než 10 minut · When se vrátím · Then panel řekne, že vypršelo,
a nabídne „Zkusit znovu" — **ne mlčí**.

**R3 výpadek stopy nezastaví nahrávání**
Given běžící nahrávání · When vypadne systémový zvuk · Then nahrávání pokračuje, panel řekne
**která** stopa chybí, a nabídne pokračovat či ukončit.

---

## 9. Otevřené — blokuje spec

**Všech deset otázek balíku je zodpovězeno.** Zbývají dvě věci, které nejsou rozhodnutí,
ale měření:

| Co | Proč to blokuje |
|---|---|
| Kolik překrývajících se časových záznamů dnes v živých datech je | Bez toho migrace k B4 buď selže, nebo tiše projde nad daty, která pravidlo porušují |
| Měření A6 na skutečné schůzce | Vyřazovací kritérium projektu |

## 10. Vědomě odložené

Aktualizace, odinstalování a odebrání z firmy jako **obrazovky** — patří do etapy o rozvozu.
Chování panelu při dvaceti a více položkách ve frontě. Přesná kresba ikony pro všech osm stavů.

---

## 11. Co našla skeptická revize — a co z toho je pravidlo

**1. 9. 2026** psalo šest agentů chybějící sekce masterplánu a dalších šest je četlo se zadáním
„najdi, čím se to dá obejít nebo v čem to lže". Našli nepravdy. **Sekce se proto celé nevkládají**
— leží jako návrhy v [`sekce-navrhy/`](sekce-navrhy/) i s revizemi vedle. Sem jde jen to, co
revizi přežilo a mění chování.

### R21 · Časovač, který přežil pád, se musí ZEPTAT 🔴 money

Je-li `startedAt` starší než start procesu, časovač **nepokračuje ani se nezahodí** — zeptá se.

⚠️ Bez tohohle pravidla zavřené víko v pátek vyfakturuje víkend. Spec už jednou totéž řekla
správně pro nečinnost (M21: „nikdy tiše nesmazat ani tiše nezapočítat"), ale pro pád to pravidlo
neplatilo. Ta nekonzistence byla uvnitř jedné sekce a našel ji až skeptik.

### R22 · Klíč proti duplikaci musí přežít ztrátu manifestu 🔴 money

Jméno souboru dnes nese jen `sessionId.slice(0, 8)` (`main.cjs:478`), tedy **32 bitů**; celý
`clientRecordingId` žije **jen v manifestu**. Zmizí manifest ⇒ obnova vyrobí nový klíč ⇒ vznikne
duplikát, proti kterému R10 celá stojí. **Do jména souboru patří plný GUID**, nebo sidecar
vedle každé stopy.

### R23 · Retence musí v v1 opravdu běžet

Bez ní se disk zaplní a **aplikace po zhruba 38 hodinách schůzek přestane nahrávat** — prahy
2 GB / 5 GB jsou v `specs/E6:67`. Retence tedy není nastavení navíc (B11), je to podmínka, aby
nahrávání fungovalo dál než pár týdnů.

### R24 · Zvuk ze skutečných schůzek nikdy do gitu

`.gitignore` měl `!dukazy/**` a v repozitáři **už leží pět zvukových souborů**. Jsou syntetické
(tón, ticho, referenční stopa), takže zůstávají. Ale měření A6 vyrobí nahrávku **s hlasem cizí
protistrany** — a Dan zvažuje repozitář zveřejnit. Z historie gitu se to nemaže. Pravidlo je
proto v `.gitignore`, ne v dokumentu: do `dukazy/` patří `vysledek.json` a `README.md`.

### R25 · Odepřené oprávnění po návratu z Nastavení: platforma vyžaduje restart

Electron dokumentuje u `askForMediaAccess`: *„the app must be restarted for new permissions to
take effect."* Scénář, který jako úspěch žádá zachycení bez restartu, by tedy zapsal
**zdokumentované chování platformy jako vadu aplikace**. Rozděluje se: panel po návratu
**zobrazí** stav z `getMediaAccessStatus('screen')` bez restartu (to jít má) · že se rozjede
i zachycení, je **nezměřené** a zapisuje se jako zjištění, ne jako pass/fail.

### Co revize našla a co s tím dělá `plan.md`

| Nález | Kam patří |
|---|---|
| `processNext` vrací i `disabled` (`:203`) a `idle` (`:213`) — pravidlo je na ně slepé | packet **B7** |
| Brána `L11` je zaručeně zelená: `setAppLogsPath` běží jen pod `LUDONE_DATA_DIR` a appka z Finderu nemá stdout ⇒ nula nálezů = ✅ | **kanárek** v protokolu, viz níž |
| `app.getAppLogsPath()` **neexistuje** | vyhozeno z návrhu, nevkládá se |
| 250 MB pro dimenzování je odvozeno z **poloviny** citovaného měření (blíž pravdě je 160 MB) | číslo se do specu nedostalo |

🔴 **Kanárek místo „nenašel jsem nic".** Brána, která hledá v logu a nic nenajde, dnes hlásí
zelenou. Napříště musí najít **aspoň jeden očekávaný záznam** (`[recording] Uloženo:`); když
tam není, výsledek je **⛔ NEMĚŘENO**, ne ✅. Grep, který nenajde ani kanárka, je rozbitý grep —
ne důkaz čistoty.


⁹ 🔴 **Přepsáno 7. 9. 2026 — předchozí znění tvrdilo opak toho, co kód dělá.** Stálo tu, že
`DSK-F003` je *„fail-closed na chybějící `LUDONE_OAUTH_CLIENT_ID`“*, s ukazatelem na
`main.cjs:939`; na tom řádku je ale plumbing okna (`createPanelWindow` začíná až o pět řádků
níž), žádná brána.

**Skutečnost:** `resolveAuthClientId` (`electron/main.cjs:3020`) při chybějící **i prázdné**
hodnotě vrací `undefined`, `electron/main.cjs:3173` pak `clientId` do controlleru vůbec
nepředá a `auth.cjs` si veřejného klienta **zaregistruje dynamicky**. Komentář nad tou funkcí
to říká otevřeně: *„prázdná hodnota DCR nevypíná“*. **Nic se nezavírá.**

🔴 **Je to rozpor s rozhodnutím, ne jen s poznámkou.** BD-N6 (`decisions.md:236–240`) rozhodl,
že *„`clientId` je POVINNÝ … dynamická registrace se NEPOUŽIJE ANI JAKO ZÁLOHA“*,
a `decisions.md:42` už jednou zapsal, že *„dnešní kód dělá DCR … obojí se musí srovnat“*.
Kód dnes dělá zamítnutou variantu — **je to nález v kódu**, který tenhle běh (oprava
dokumentace) vědomě neopravoval.

⚠️ **`exposure` proto zůstává `disabled`, ale z jiného důvodu, než tu stál:** ne že by přihlášení
bylo zavřené, ale že ho **nikdo nedokončil naostro** — osa `verification` je `unverified`
a živý průchod chybí. Kdo ho na labs projde do konce, ať osu posune **a napíše sem měření**,
ne naopak. Co přesně založit → [`OAUTH-CO-ZALOZIT.md`](OAUTH-CO-ZALOZIT.md).

¹⁰ ⚠️ **Půlka téhle poznámky odpadla 7. 9. 2026.** Stálo tu, že kód je v `main` a otestovaný,
ale žádná komponenta v `src/` ho nevolá — změřeno `grep -rn "logout" src/` → 0.
**Totéž měření dnes vrací 18 zásahů**: `src/components/Settings.jsx:735` má tlačítko
„Odhlásit tento Mac“, které volá `window.ludone.logout`, a fronta má v panelu vlastní kartu
(`src/App.jsx:6`, `QueueCard`, přes mosty `listQueue` a `retryQueue`). O `DSK-F004`
a `DSK-F009` tahle věta tedy **už nic nedokazuje** a jejich `exposure` čeká na samostatné
rozhodnutí, ne na tuhle poznámku.

🔴 **Co platí beze změny, je časová agenda:** `grep -rn "startTracking\|stopTracking" src/`
→ **0**. Most je vystavený, volající chybí — a právě to drží `exposure: disabled`
u `DSK-F011` a `DSK-F013`. Hlídá to `tests/zapojeni-odhlaseni.test.js`: dnes zelený, červený
v sekundě, kdy volající přibude.

¹¹ `DSK-F012` je zablokovaná rozhodnutím **BD-N28**: pravidlo 110 % patří na server, desktop
ho jen přebírá. Nezadrátovat ani jednu variantu ze sporu `spec.md` R7 × `plan.md` B6.

¹² `DSK-F017` je **nové ID přidělené 2. 9. 2026** — retence vznikla v B11 a v matici do té
doby vůbec nebyla. Kód je hotový a otestovaný; zapojení do startu aplikace právě běží.

¹⁹ **Ověřeno naostro 7. 9. 2026** na buildu z `20f5c22`, ale **jen půlka funkce** — stejná
výhrada jako u ¹³.

**Co ověřeno:** appka čte SKUTEČNÝ stav oprávnění ze systému. Most `getPermissionStatus`
vrátil pro `microphone` i `system-audio` shodně `granted`, a **nezávislý Electron proces**
čtoucí `systemPreferences.getMediaAccessStatus` vrátil totéž (`microphone: granted`,
`screen: granted`). Dva různé procesy, tatáž odpověď — takže to není appka, která si stav
domýšlí z vlastního uloženého stavu.

🔴 **Co ověřeno NENÍ: zkouška zvuku.** V době měření (build z `20f5c22`, 7. 9. 12:21)
existovala jen jako krok onboardingu (`Onboarding.jsx:628`) a ten leží **za přihlášením**,
které bez dokončeného OAuth toku neprojde (týž blokátor jako u `DSK-F003`).

✅ **Jednorázová už ale NENÍ — opraveno v poznámce 7. 9. 2026.** PR #92 (`40f17f2`, 7. 9. v 18:11)
přidal `src/components/SettingsAudioTest.jsx` a `src/components/Settings.jsx:821` ho vykresluje
na kartě **Zvuk**: tlačítko „Spustit zkoušku“ a měřidla z `RecordingTestStep`, kryté testy
`tests/settings-audio-test.test.js` a `tests/settings-audio-permissions.test.js`. Věta, že karta
Zvuk zkoušku nenabízí, tedy od té chvíle neplatí.

⚠️ **Naostro to pořád ověřené není** — všechny tři živé zkoušky ze 7. 9. běžely na buildech
**starších** než #92 (`62f04cb` 10:54 · `20f5c22` 12:21 · `0a1d7cf` 15:01). Druhá půlka
`DSK-F006` tak čeká na první spuštění zkoušky z Nastavení, ne na rozhodnutí o návrhu.

⚠️ **Past při měření:** `getPermissionStatus()` bez argumentu vrací `status: "unknown"`,
`granted: false`. Vypadá to jako vada appky a **není** — most bere jméno oprávnění
(`"microphone"` / `"system-audio"`). Než z toho někdo udělá nález, ať zkontroluje volání.

²⁰ **Ověřeno naostro 7. 9. 2026** na buildu z `0a1d7cf`. Menu se otevřelo **skutečným pravým
klikem** na položku v liště (`CGEventPost` s `kCGEventRightMouseDown`; `AXShowMenu` nestačí —
Electron menu vykresluje jako samostatné okno, ne jako potomka položky, takže se přes
přístupnostní akci nedá vyvolat). Přečtený obsah:

| položka | dostupná |
|---|---|
| Ukončit nahrávání | ne — nic se nenahrává |
| Spustit LuTrack | ne — `DESKTOP_TIME_ENABLED` je vypnutý |
| Otevřít panel | ano |
| Otevřít LuDone v prohlížeči | ano |
| Nastavení… | ano |
| O aplikaci | ano |
| Ukončit LuDone | ano |

✅ **Menu tedy nic nepředstírá:** akce, které v daném stavu nejdou, jsou zašedlé, ne aktivní
a mlčky selhávající. To je právě ten rozdíl, který jsme dnes opravovali jinde.

⚠️ Ověřen **obsah a dostupnost**, ne provedení jednotlivých akcí — na ty by bylo potřeba do
menu klikat, a „Ukončit LuDone" by běh ukončilo.

🔴 **Doplněno 7. 9. 2026: „se zkratkami“ z názvu funkce ověřené NENÍ — a nejspíš ani nemá čím.**
V repu jsou **popisky** `accelerator` v šabloně menu (`electron/main.cjs:1171, 1177, 1192, 1202,
1212` — ⌃⌥R, ⌃⌥T, ⌃⌥L, ⌘, a ⌘Q). Co v repu **není**, je jediná registrace zkratky:
`grep -rn "globalShortcut" electron/ src/` → **0 zásahů**. Aplikace navíc běží jako accessory
(`LSUIElement: true`, `package.json:49`), takže nekreslí lištu menu a lokální akcelerátory
nemají kde vzniknout (`docs/ux/cesta-uzivatele-2026-09-01.md:99`).
**Popisek zkratky, který nic nespustí, je slib bez krytí** — `verified-live` u `DSK-F002` proto
pokrývá obsah a dostupnost menu, **ne zkratky**.
