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
| `DSK-F001` | Ikona v liště nese stav, klik otevře panel | normal | approved | committed ¹ | disabled | tests-green |
| `DSK-F002` | Kontextové menu na ikoně se zkratkami | normal | approved | no-code | disabled | unverified |
| `DSK-F003` | Přihlášení OAuth 2.1 + PKCE, loopback | security | approved | coded ² | disabled | unverified |
| `DSK-F004` | Odhlášení s odvoláním na serveru | security | approved | no-code | disabled | unverified |
| `DSK-F005` | Obnova tokenu, jednovláknová | security | approved | no-code | disabled | unverified |
| `DSK-F006` | Oprávnění mikrofon a systémový zvuk + zkouška | normal | approved | coded ³ | labs | unverified |
| `DSK-F007` | Nahrávání dvou stop na disk | normal | approved | merged | labs | tests-green ⁴ |
| `DSK-F008` | Pojmenování nahrávky při zastavení | normal | approved | no-code | disabled | unverified |
| `DSK-F009` | Odchozí fronta s opakováním | normal | approved | coded ⁵ | disabled | tests-green |
| `DSK-F010` | Odeslání na server | rbac | **draft** ⁶ | no-code | disabled | unverified |
| `DSK-F011` | Časovač: start, přepnutí projektu, stop | **money** | approved | no-code ⁷ | disabled | unverified |
| `DSK-F012` | Výběr projektu z alokací | **money** | approved | no-code ⁸ | disabled | unverified |
| `DSK-F013` | Časovač přežije pád a restart | **money** | approved | no-code | disabled | unverified |
| `DSK-F014` | Připomínky, když neběží časovač | normal | approved | no-code | disabled | unverified |
| `DSK-F015` | Nastavení: účet, zvuk, záznamy, připomínky, diagnostika | normal | approved | coded | labs | unverified |
| `DSK-F016` | Ikona v Docku jako volba | normal | approved | no-code | disabled | unverified |

**Poznámky — každá je změřená, ne odhadnutá (1. 9. 2026):**

¹ Commit `ce2bea6` na větvi `fix/tray-prazdna-ikona`, **záměrně nemergováno** — je to user-visible
implementace bez schváleného specu, tedy přesně to, co tenhle masterplán zakazuje. Brána volá
produkční `trayImage()`, takže neměří kopii logiky. Ale `verified-live` to není: po opravě
ikonu nikdo na Macu neviděl.

² `createAuthController` je v `electron/auth.cjs:325` definovaná a na řádku 502 exportovaná —
a **nikde v repozitáři se neimportuje**. Je to hotová logika mimo provoz. 🔴 Navíc má token scope
jen `mcp:read` a `mcp:draft` (`auth.cjs:14`), tedy **nemůže zapisovat**; bez zápisového scope
je serverový kontrakt nepoužitelný.

³ Existuje, ale zamyká celou aplikaci — odepřené oprávnění dnes shodí i časovou agendu, která
s mikrofonem nemá co do činění.

⁴ **Tady je hranice, na které tenhle projekt už jednou uklouzl.** Změřeno je: dvě stopy vzniknou
na disku a zvuk z loopbacku nese řeč (`meet-mereni.mjs`, referenční soubor: úspěch 0,9983 ·
odebrané AEC 0,0696 · přeslech odhalen). **Nezměřeno je to podstatné** — že to funguje na
skutečné schůzce s živým protějškem (A6, čeká na Dana). A cesta, po které to jede, je ta,
kterou `IsSystemLoopbackCaptureSupported()` na macOS 26.4 hlásí jako nepodporovanou. Proto
`tests-green`, ne `verified-live`.

⁵ `src/lib/queue.js` má 200+ řádků a vlastní testy, ale **žádný soubor v `src/` ani `electron/`
ji neimportuje**. Zelené testy nad nezapojeným kódem.

⁶ **Jediná funkce se scope `draft`, a je to úmysl.** Serverová strana je S1 — dostane vlastní
průchod masterplánem v `ludone-app`. Zapojit frontu k serveru, který neexistuje, je v `plan.md`
výslovně zakázané. Zadání pro ten běh je `docs/server-modul/KONTRAKT.md`.

⁷ `src/features/tracking/TrackingCard.jsx` má **77 řádků a všechen stav v `useState`** — tedy
v rendereru, kde ho zabije každý pád okna. Atrapa není `coded`; kdyby byla, matice by lhala
přesně tím způsobem, kvůli kterému tahle tabulka má čtyři sloupce.

⁸ Tamtéž, řádek 5: `const PROJECTS = ["LuDone Desktop", "Web · klientská zóna", "Interní provoz"]`.
Tři řetězce natvrdo. Žádná alokace, žádné GUID.

**Součet, ať se to nemusí počítat očima:** ze šestnácti funkcí je **jedna** v `main` a běží
(F007), **čtyři** mají kód mimo provoz (F001, F003, F006/F015, F009), **jedenáct** neexistuje.
Nic není `verified-live`. **Nic není v `production`.**

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
