# Task packet B9 (revidovaná verze)

> **Jak tenhle packet číst.** Je dlouhý, protože nese změřené věci, ne proto, že je upovídaný.
> Nečti ho lineárně. **Minimum před první editací:** §12 (vlastnictví bloků — co smíš změnit
> a čeho se nesmíš dotknout ani o řádek), §13 (TDD kroky s doslovnými červenými výpisy),
> §14 (sabotáže). Zbytek je odůvodnění, do kterého se vracej, až něco nesedí.
>
> 🔴 **Sekce `Co NEBYLO ověřeno v kódu` na konci není formalita.** Skeptik packet četl proti
> kódu a tohle zůstalo bez důkazu — než na tom postavíš implementaci, otevři to.
>
> Packet napsal agent, přečetl skeptik proti kódu. **Když v něm najdeš nepravdu, je to nález,
> ne překážka** — zapiš ho a jeď dál podle `spec.md` a `plan.md`, ty jsou nadřazené.

---


> Packet podle masterplánu §9 (`docs/MASTERPLAN.md:608–647`). Vykonavatel dostává **jen tenhle dokument** — ne celý plán.
> Uložení: `docs/changes/desktop-v1/tasks/B9.md`. ⚠️ Adresář **už není prázdný** — leží v něm `README.md`, `B1-ui-smoke.md` a `B4-tri-vady-prihlaseni.md`.

---

## 1. Plan ID a Plan SHA

| Co | Hodnota | Jak změřeno |
|---|---|---|
| **Plan ID** | `desktop-v1` → `docs/changes/desktop-v1/plan.md` (ZMRAZENO 1. 9. 2026) | — |
| **Plan SHA** | `c7b1bb715f87f53ca0a209d5d3b96e6018e1e437` | `git log -1 --format=%H -- docs/changes/desktop-v1/plan.md` ✅ |
| **Spec SHA** | 🔴 **`1e9709779e94a654a0c3c959d260082d42801acc`** — **NE stejný commit jako plán** | `git log -1 --format=%H -- docs/changes/desktop-v1/spec.md` ✅ |
| **HEAD** | ❌ **nepinuje se** — viz níž | — |

🔴 **Návrh packetu tvrdil, že spec i plán jsou zmrazené ve stejném commitu `c7b1bb7`. Není to pravda.**
`spec.md` má o jeden commit navíc: `1e97097 Keep the drafted sections out of the frozen spec until they are true`.
Ten commit je mladší než `c7b1bb7` a mění právě spec. Kdo by si spec vytáhl podle `c7b1bb7`, dostal by **starší verzi**, než je zmrazená.

🔴 **HEAD do packetu nepatří jako fixní hodnota.** Během psaní téhle revize se `main` posunul dvakrát
(`cb1de26` → `0380bc0` → `d91558a`) — do repozitáře souběžně commituje jiná session.
Návrh packetu uváděl `cb1de26…` jako „HEAD při psaní"; ten commit existuje, ale byl v okamžiku revize
už **šest commitů pozadu**. Kotvou jsou **Plan SHA a Spec SHA**, ne HEAD.

⚠️ Návrh psal „strom čistý (kromě netrackovaného `design/`)". **`design/` je trackovaný** — `git ls-files design`
vrací **25 souborů**. Netrackované jsou jen dva generované balíky vyloučené v `.gitignore:46–47`.
Pracovní strom byl při revizi **úplně čistý** (`git status --porcelain` prázdný).

🔴 **Když se `plan.md` nebo `spec.md` mezitím změní, tenhle packet je neplatný** — vrať se pro nový, nedopočítávej si rozdíl sám.

---

## 2. Task ID

**B9** — `plan.md:92` (tabulka Task DAG). Název PR (anglicky, `plan.md:150`):
`Revoke the token on logout`.

🔴 **DAG nese u B9 značku, kterou návrh packetu vynechal.** `plan.md:79`:

```
B4 ── přihlášení: 3 vady ──▶ B8 zapojit auth ──▶ B9 odhlášení ⛔B2
```

`⛔B2` odkazuje na **rozhodnutí B2** z `decisions.md:68`: *„Nahrávky jsou **majetkem firmy**. **Admin vidí vše**."*
Pro B9 z toho plyne přesně to, co říká R12: **odhlášení nesmí zlikvidovat data, která patří firmě.**
Není to odkaz na úkol B2 (přejmenování běhových čísel) — ten s odhlášením nesouvisí.

---

## 3. Feature ID

**`DSK-F004` — Odhlášení s odvoláním na serveru.** `spec.md:81`, doslova:

```
| `DSK-F004` | Odhlášení s odvoláním na serveru | security | approved | no-code | disabled | unverified |
```

| osa | před (ověřeno v `spec.md:81`) | po B9 (cíl) |
|---|---|---|
| scope | `approved` | `approved` |
| delivery | `no-code` | `pr-open` |
| exposure | `disabled` | `disabled` (**nemění se** — v B9 nevzniká tlačítko) |
| verification | `unverified` | `tests-green` (na `verified-live` sáhne jen člověk, viz §16) |

Riziko funkce: **security** ⇒ diff čte Claude povinně (`plan.md:183`, DoD bod 5).

---

## 4. Cíl story

Do `electron/auth.cjs` přibude **odhlášení**, které **nejdřív odvolá přístup na serveru
a teprve pak smaže lokální šifrovanou session**, vystavené do rendereru jedním novým IPC
kanálem `auth:logout`.

Dnes v repozitáři **odhlášení neexistuje vůbec**. Ověřeno otevřením kódu (čísla řádků změřena):

- `electron/auth.cjs` (**506 řádků** ✅) má `createAuthController` na **`:325`** ✅, který vrací
  **objekt s jedinou metodou `begin()`** (`:343–417`) ✅. Žádný `logout`, `revoke` ani obnova.
- `persistEncryptedSession` (**`:296`** ✅) session **jen zapisuje**.
- 🔴 **`safeStorage.decryptString` se v celém repozitáři nevolá ani jednou** (`grep -rn decryptString electron/ src/ tests/ scripts/` → nula).
  `logout()` bude **první čtenář** uloženého blobu, jaký tenhle repozitář má.
- `discoverEndpoints` (**`:76`** ✅) vrací `authorizationEndpoint`, `tokenEndpoint`, `registrationEndpoint`.
  **`revocation_endpoint` nečte.** ✅
- `module.exports` (**`:501–506`** ✅) vystavuje přesně čtyři jména:
  `createAuthController`, `createPermissionRequestHandler`, `decidePermissionResult`, `tokenStorageDirectory`.
- `electron/preload.cjs` (**22 řádků** ✅) nemá `logout`. `electron/main.cjs` (**752 řádků** ✅) nemá kanál `auth:logout`.
- `electron/queue.cjs` (**69 řádků** ✅) umí jen `loadQueue` / `saveQueueAtomically`.
  🔴 **`main.cjs` ho zatím vůbec nerequiruje** (`grep -n queue electron/main.cjs` trefí jen `track.queue`, což je promise-řetěz nahrávání, ne fronta) — to je práce B7.

---

## 5. User-visible chování

🔴 **V B9 nevzniká žádné UI.** `plan.md:150` vyjmenovává pro B9 soubory
`electron/auth.cjs`, `main.cjs`, `preload.cjs` — **žádný soubor v `src/**`**. Tlačítko
„Odhlásit tento Mac" je ve schváleném designu, ale **staví ho jiná story**.
Přidat ho tady = rozšíření scope, což masterplán §9 zakazuje.

Chování, které tahle story dodává, je chování **rozhraní**, ne obrazovky:

1. Renderer zavolá `window.ludone.logout()`.
2. Aplikace **nejdřív pošle odvolání na autorizační server**.
3. **Teprve potom** smaže šifrovaný soubor se session.
4. Ikona v liště přejde na `signed-out`.
5. **Fronta neodeslaných nahrávek se nesmí ani dotknout.**
6. Volajícímu se vrátí **strukturovaný výsledek**, ze kterého pozdější UI story postaví text.
7. **Bez sítě se nikdy netvrdí, že je přístup odvolaný.** Lokálně odhlášeno ano, odvoláno ne.
8. 🔴 **`auth:logout` se NIKDY neodmítne (nereject).** `handleValidated` (`main.cjs:151–156`) výjimku z handleru
   propaguje do rendereru jako odmítnutý promise — a odmítnutý promise nenese `reason`, tedy nenese pravdu.
   Každý selhavší krok musí skončit jako **hodnota** s `reason`, ne jako výjimka.
   (Výjimka: `requireTrustedSender` odmítne cizí odesílatele **před** handlerem — to tak má být.)

Co uživatel po B9 **neuvidí**: nic. Funkce je dostupná jen přes `window.ludone.logout()`.
Odpovídá to ose `exposure: disabled`.

---

## 6. Odkaz na schválený Claude Design artefakt

| Co | Kde | Ověřeno |
|---|---|---|
| Schválení | `design/approved.json` — `status: "approved"`, `approvedBy: "Dan"`, `approvedAt: "2026-09-01"` | ✅ otevřeno |
| Náhled | `design/navrh/nahled.html` | ✅ |
| Relevantní obrazovka | `coveredScreens` → **„nastavení — účet"** | ✅ |
| Konkrétní prvek | **`design/navrh/nahled.html:557`** — tlačítko „Odhlásit tento Mac", vedle něj „Fronta zůstane. Nahrávky se odešlou po dalším přihlášení." | ✅ řádek sedí |
| Zadání designu | **`design/zadani/BRIEF.md:133`** — „Účet a zařízení: jméno/e-mail, prostředí, odhlásit tento Mac" | ✅ řádek sedí |
| 🔴 **Artboard, který návrh packetu PŘEHLÉDL** | **`design/navrh/Cesta.dc.html:180`** | ✅ nově nalezeno |

🔴 **`design/navrh/Cesta.dc.html:180` kreslí odhlášení jako moment cesty a nese obě pravidla B9 doslova:**

> `mk('Odhlášení', 'panel', 'Nejdřív odvolat na serveru, teprve pak smazat lokálně.', 'Opačné pořadí znamená, že token už nemáme a odvolat ho nikdy nepůjde. Fronta se nesmí smazat.', true)`

Návrh packetu ho nenašel, protože grepoval na „Odhlásit"; tenhle artboard používá „Odhlášení".
Je to **druhý nezávislý zdroj R13 i R12 přímo ve schváleném designu** — a znamená to, že
odhlášení **artboard má**, jen ne jako obrazovku selhání.

🔴 **`design/**` se v této story NESMÍ editovat** (`plan.md:190`, `BEH-NOC.md:133`).

⚠️ **Design je starší než spec.** `approved.json` → `"specVersion": "před sepsáním spec.md; schváleno nad commitem babdd5a"`.
Kde se design a spec rozejdou, **platí spec** (`spec.md:10–15`).

⚠️ **Mezera v designu, kterou B9 nesmí zaplnit vlastní invencí:** stav „přístup na serveru se odvolat
nepodařilo" **nemá vlastní artboard** (`approved.json` → `openDesignQuestions` ho nezmiňuje — ověřeno,
zmiňuje jen ikonu v liště, přetečení fronty a obrazovky aktualizace/odinstalace).
Protože B9 nedělá UI, nevadí to — ale **nevymýšlej copy ani stav obrazovky**; vrať strukturovaný kód.

---

## 7. Relevantní výřez EXPERIENCE.md

🔴 **`EXPERIENCE.md` v tomhle repozitáři NEEXISTUJE** (masterplán ho žádá na `:621`; repozitář ho nemá).
Jeho roli hraje **`docs/ux/cesta-uzivatele-2026-09-01.md`** (139 řádků, 45 KB). Řádky ověřeny.

### `cesta-uzivatele-2026-09-01.md:57` — moment M27 Odhlášení (doslova)

> | 27 | M27 Odhlášení | panel | Tlačítko Odhlásit. | Odhlásit se — pořadí je závazné: nejdřív revokace na serveru, teprve pak smazat blob a přepnout ikonu. | Odhlášení bez sítě: blob je pryč, na serveru token žije dál (access 15 min, refresh 30 dnů). Tvrzení „přístup odvolán“ je tady lež o třicet dnů. Musí padnout pravda plus „Zkusit odvolat teď“. Odhlášení taky nesmí sáhnout na frontu — nahrávky zůstávají, pokusy se pauzují a nezapočítávají. | ma kde probehnout |

### `cesta-uzivatele-2026-09-01.md:23` — segment ODHLÁŠENÍ

⚠️ Upřesnění proti návrhu packetu: `:23` **není samostatný odstavec o odhlášení**, je to jeden velmi
dlouhý odstavec o celé přihlašovací cestě; ODHLÁŠENÍ je jeho úsek. Citace je doslovná:

> ODHLÁŠENÍ: pořadí je závazné — nejdřív revokace na serveru, teprve pak smazat blob a přepnout
> ikonu. Opačné pořadí znamená, že appka token už nemá a odvolat ho nikdy nepůjde. Bez sítě
> se NESMÍ tvrdit, že je přístup odvolaný (access žije 15 min, refresh 30 dnů): „Odhlášeno na
> tomhle Macu. Přístup na serveru se odvolat nepodařilo — zkusím to znovu, až budeš připojený“
> + „Zkusit odvolat teď“ + odkaz do LuDone → MCP. Odhlášení nesahá na frontu; přihlašovací
> obrazovka po něm nese řádek „3 nahrávky čekají na přihlášení (412 MB)“.

> STAV, KTERÝ SE MUSÍ POSTAVIT: v electron/auth.cjs je dnes JEN begin(). Obnova tokenu,
> single-flight brána, revoke ani odhlášení tam neexistují; electron/queue.cjs (69 řádků)
> umí jen načíst a uložit JSON.

### 🔴 Rozpor mezi tímhle dokumentem a zmrazenou spec

`cesta-uzivatele` chce v textu pro uživatele **„odkaz do LuDone → MCP"**.
`spec.md:226` říká: **„🔴 Nikdy „MCP", „scope", „token" v textu, který vidí uživatel."**

⚠️ **Korekce návrhu packetu:** návrh tvrdil, že spec §„Autorita při rozporu" říká *„chování určuje spec,
ne výzkum"*. **Tuhle větu tam nenajdeš.** `spec.md:10–15` říká: *„Chování → tenhle dokument… **Implementátor
rozpor neřeší sám** — zastaví se a vrátí konkrétní otázku."*
Rozpor tedy **rozhodl koordinátor** (viz D-B9-4), ne dokument. Pro B9 je bez dopadu (žádné UI),
ale je to důvod navíc, proč hlavní proces **nesmí vyrábět české věty pro uživatele**.

---

## 8. Relevantní business pravidla

Doslovně ze zmrazené `spec.md` §4 (`:159–172`), ověřeno řádek po řádku:

| ID | Znění | Co z toho pro B9 plyne |
|---|---|---|
| **R12** (`:160`) | „Odhlášení **nesmí smazat frontu**." | 🔴 Vlastní test — a **návrhový test na to nestačil**, viz §13 krok 4. |
| **R13** (`:161`) | „Odhlášení odvolá přístup **nejdřív na serveru**, teprve pak smaže lokálně." | 🔴 **Jádro story.** |
| **R14** (`:162`) | „Vypršelý token se během nahrávání **neprojeví nijak** — zvuk jde na disk." | Logout nesmí vyvolat modální dialog ani skok do prohlížeče. |
| **R16** (`:164`) | „`403` a „uzavřený týden" jsou **trvalé** chyby: neopakovat, data zachovat, říct důvod." | Neúspěšné odvolání se **neopakuje ve smyčce**. Jeden pokus, pak pravdivý výsledek. |
| **R17** (`:165`) | „`invalid_grant` je **pauza**, ne selhání — nespotřebovává pokusy." | Neúspěšné odvolání nesmí zablokovat lokální odhlášení ani vyrobit z 4xx „selhání appky". Ale **ani netvrď „odvoláno"**, když server řekl 4xx. |
| **R18** (`:166`) | „Dva samostatné vypínače (`DESKTOP_UPLOAD_ENABLED`, `DESKTOP_TIME_ENABLED`), oba fail-closed." | 🔴 **B9 nezavádí žádný nový vypínač a žádný cizí neflipuje.** Odvolání přístupu **není** odesílání dat. |

Z `spec.md:44–57` a `plan.md:36–44`: **RBAC desktop nevyhodnocuje sám.**
Odhlášení **nerozhoduje o žádném money ani RBAC pravidle** — a rozhodnout ho je podle §9 zakázané.

---

## 9. Relevantní Architecture Spine invarianty

Z `plan.md:7–70`. Platí bez výjimky a **story je nesmí předefinovat**:

| Invariant | Doslova / důsledek pro B9 |
|---|---|
| **`electron/auth.cjs`** (`:17`) | Vlastní „přihlášení, obnova, **odvolání**". Nesmí „ukládat token jinam než přes `safeStorage`". ⇒ žádná druhá kopie session nikde jinde. |
| **`electron/main.cjs`** (`:14`) | Vlastní „okno, tray, IPC, životní cyklus". Nesmí „rozhodovat o stavu podle rendereru". ⇒ `auth:logout` je příkaz, ne oznámení stavu. |
| **`electron/queue.cjs`** (`:16`) | Vlastní odchozí frontu. ⇒ **B9 do něj nesahá ani jedním znakem.** |
| **`src/**`** (`:18`) | Renderer „jen zobrazení", nesmí „držet stav, který musí přežít pád". ⇒ token **nikdy nepřejde přes IPC do rendereru**. |
| **Kdo vlastní stav** (`:25`) | „Stav, který musí přežít pád rendereru, vlastní hlavní proces." |
| **RBAC** (`:38`) | „Desktop **žádnou z nich nevyhodnocuje sám** — ptá se serveru a odpověď respektuje." |
| **Peníze** (`:51`) | „**Zápis do Tabidoo přímo z desktopu je zakázaný** za všech okolností." |
| **Co plán NEPOKRÝVÁ** (`:58–64`) | 🔴 **Serverovou stranu (S1).** B9 **nesmí stavět, měnit ani volat** `/api/desktop/*`. Volání autorizačního serveru pod `/api/mcp/oauth/` je jiná věc: existuje a `begin()` ho už používá. |
| **Rollback** (`:68`) | „Každá story je samostatně revertovatelná. Žádná migrace v1." |

---

## 10. Vstupní a výstupní rozhraní

### 10.1 Rozhodnutí packetu (NE volba implementátora)

Rozhodl **koordinátor**, protože je zmrazená spec ani plán neurčují a implementátor je podle §9
rozhodovat nesmí. Nesouhlasíš-li, **vrať otázku**.

| # | Rozhodnutí | Podklad |
|---|---|---|
| **D-B9-1** | Adresu odvolání ber z **OAuth discovery** jako `revocation_endpoint`, ověřenou stávající `trustedRemoteEndpoint(...)` (`auth.cjs:41`). 🔴 **V `discoverEndpoints` musí být VOLITELNÝ** — povinný by rozbil `begin()` na serveru, který ho nevrací. | ✅ **ZMĚŘENO NAOSTRO 1. 9. 2026** — viz níž. |
| **D-B9-2** | Když `revocation_endpoint` v discovery **chybí**, **nevymýšlej URL a nedosazuj konstantu.** Odhlášení proběhne lokálně a výsledek řekne `serverRevoked: false, reason: "no-revocation-endpoint"`. | Fabrikovaná URL = nový API kontrakt bez aktualizace plánu (§9 zakazuje). |
| **D-B9-3** | Tvar požadavku: `POST <revocationEndpoint>`, `content-type: application/x-www-form-urlencoded`, tělo `client_id` + `token=<refresh token>` + `token_type_hint=refresh_token`, **bez client secretu**, `redirect: "error"`. Když session refresh token nemá (`refreshToken: null`), pošli access token s `token_type_hint=access_token`. Když nemá ani ten → `reason: "no-token"`, nic se neposílá. | `specs/E6-prihlaseni-a-fronta.md:37` + ✅ **discovery měřením** (viz níž). ⚠️ E6 je jinak prokazatelně zastaralý — viz varování pod tabulkou. |
| **D-B9-4** | Hlavní proces **nevrací české věty pro uživatele**, vrací kód. Copy je věcí UI story. | Rozpor v §7 + `spec.md:226`. |
| **D-B9-5** 🆕 | 🔴 **Vlastnictví uvnitř `electron/auth.cjs` plán NEURČUJE** — tabulka `plan.md:117–125` má sloupce jen pro `main.cjs` a `preload.cjs`, přitom do `auth.cjs` píše B4, B8 **i** B9. Koordinátor proto určuje: **B9 vlastní v `auth.cjs` výhradně nově přidané funkce a novou metodu `logout` v objektu z `createAuthController`. `begin()` (`:343–417`), `persistEncryptedSession` a `tokenStorageDirectory` jsou CIZÍ.** Jediná povolená změna cizího kódu: **přidání volitelného `revocationEndpoint` do návratového objektu `discoverEndpoints`** (`:88–103`). | Mezera v plánu; bez rozhodnutí by vykonavatel hádal. |
| **D-B9-6** 🆕 | **Exportuj `discoverEndpoints`** z `auth.cjs`. Bez toho **neexistuje způsob, jak sabotáž S7 doložit** (viz §14) — dnes ji nemá co chytit. | Měřeno: `grep -rn "discoverEndpoints\|createAuthController\|revocation" tests/ scripts/ src/` → **nula výskytů**. |
| **D-B9-7** 🆕 | `logout()` **volá `discoverEndpoints` znovu** při každém odhlášení. Neukládá se do blobu při přihlášení — to by měnilo tvar `{v:1,…}` a sahalo do `begin()`, tedy do cizího bloku. **Důsledek: každé odhlášení dělá DVĚ HTTP volání, discovery napřed.** Testy to musí počítat (§13). | Alternativa (uložit endpoint do blobu) padá na D-B9-5. |

#### ✅ ZMĚŘENO NAOSTRO 1. 9. 2026 — discovery revocation_endpoint

Návrh packetu tohle uváděl jako neověřené („necurloval jsem to"). **Změřeno, obojí odpovědělo:**

```
$ curl -fsS https://labs.ludone.cz/.well-known/oauth-authorization-server
  "revocation_endpoint": "https://labs.ludone.cz/api/mcp/oauth/revoke"
  "revocation_endpoint_auth_methods_supported": ["none","client_secret_post"]
  "token_endpoint_auth_methods_supported": ["none","client_secret_post"]
  "code_challenge_methods_supported": ["S256"]
  "scopes_supported": ["mcp:read","mcp:draft"]

$ curl -fsS https://app.ludone.cz/.well-known/oauth-authorization-server
  "revocation_endpoint": "https://app.ludone.cz/api/mcp/oauth/revoke"
  "revocation_endpoint_auth_methods_supported": ["none","client_secret_post"]
```

Z toho plyne třikrát pravda, kterou návrh packetu jen předpokládal:
1. **`revocation_endpoint` v discovery JE** — na labs i na produkci. D-B9-1 stojí na měření, ne na dokumentu.
2. Leží **na originu issueru**, takže `trustedRemoteEndpoint` ho přijme beze změny.
3. **`none` je mezi podporovanými auth metodami revokace** ⇒ „bez client secretu" v D-B9-3 je potvrzené.

⚠️ **Přesto D-B9-2 (větev „endpoint chybí") NERUŠ.** Změřen je dnešek, ne budoucnost, a fail-closed
větev je levná. Ale **měření mění §16**: krok 4 smí očekávat `serverRevoked: true`.

🔴 **Varování k `specs/E6-prihlaseni-a-fronta.md:37` — je to zastaralý dokument, ne kontrakt.**
Tentýž řádek, ze kterého bereme tvar revoke požadavku, tvrdí v sousední větě dvě věci, které
v kódu **neplatí**:
- říká blob `path.join(app.getPath('userData'),'auth','tokens.enc')` — skutečnost je
  `appData` + `cz.ludone.desktop/auth/oauth.enc` (`auth.cjs:284–294`, `:11`);
- `specs/E6…:31` chce scope `desktop:upload` a resource `/api/desktop` — `auth.cjs:55–62` a `:328–332`
  **vynucují `mcp:read`/`mcp:draft` a resource `${issuer}/api/mcp`** a jiné odmítnou výjimkou.

Proto: **tvar těla požadavku z E6 ber jako návrh, ne jako změřený kontrakt.** Serverové chování
(`revokeOauthToken`, `revokeRefreshFamily`, „zneplatní celou rodinu jedním voláním") žije v repozitáři
`ludone-app` a **v tomhle běhu ho nikdo neotevřel** — viz otevřená otázka O-B9-1.

### 10.2 Vstupní rozhraní

Odhlášení čte **uloženou session** — soubor, který dnes zapisuje `persistEncryptedSession`
(`auth.cjs:296`), tvar (`auth.cjs:397–411`):

```js
{ v: 1, issuer, clientId, resource, scope, accessToken,
  refreshToken /* string | null */, tokenType, accessExpiresAt, identity: { name, email } }
```

Cesta: `tokenStorageDirectory(app)` (`auth.cjs:284`, exportovaná) + `TOKEN_FILE = "oauth.enc"`
(`auth.cjs:11`, **neexportovaná**). Na macOS `~/Library/Application Support/cz.ludone.desktop/auth/oauth.enc`.

🔴 **`LUDONE_DATA_DIR` tuhle cestu NEPŘESMĚRUJE.** `configureWritablePaths()`
(**`main.cjs:170–191`** — návrh psal `170–190`, funkce končí na `:191`) přemapuje jen
`userData`, `sessionData`, `cache`, `crashDumps`, `temp`; `tokenStorageDirectory` staví na
`app.getPath("appData")`. Je to záměr a zamyká to `tests/permissions.test.js:126–133`. **Nespravuj to.**

⚠️ `tokenStorageDirectory` **vyhodí výjimku**, když cílová cesta leží uvnitř repozitáře
(`auth.cjs:290–292`, hlídá i přes symlinky). Týká se to fixture v testech — viz §13.

### 10.3 Výstupní rozhraní (co B9 přidává)

```js
// electron/auth.cjs — rozšíření objektu, který vrací createAuthController(options)
{
  async begin() { /* beze změny, patří B8 */ },
  async logout(): Promise<{
    signedOutLocally: boolean,               // 🔴 boolean, NE literál true — viz níž
    serverRevoked: boolean,                  // NIKDY true bez úspěšné HTTP odpovědi
    reason: null
      | "offline"                            // fetch odmítl / síť (týká se i discovery volání)
      | "no-revocation-endpoint"             // discovery ho nevrátilo (D-B9-2)
      | "no-token"                           // session neexistuje, nebo v ní není refresh ani access token
      | "unreadable-session"                 // 🆕 blob je, ale nejde dešifrovat / safeStorage není k dispozici
      | "local-delete-failed"                // 🆕 revoke proběhl, blob se ale nepodařilo smazat
      | `http-${number}`                     // server odpověděl, ale ne ok
  }>
}
```

🔴 **Dvě opravy proti návrhu packetu, obě z třídy „měřidlo, které lže":**

1. **`signedOutLocally` NESMÍ být literál `true`.** Návrh ho typoval jako `true` s poznámkou
   „vždy true, když se blob povedlo odstranit" — to si odporuje. Natvrdo vrácené `true` je
   **přesně ta lež, kterou u `serverRevoked` sabotáž S2 hlídá**, jen o patro níž.
   Hodnota musí vzniknout **z výsledku mazání** (neexistující soubor = úspěch, `EACCES` = `false`).
2. **Přibyly `unreadable-session` a `local-delete-failed`.** Návrh je do enumu nezahrnul,
   takže dvě reálná selhání neměla jak být pravdivě popsána — a jediná cesta ven by bylo
   buď zalhat, nebo vyhodit výjimku (což §5 bod 8 zakazuje).

Pomocné funkce v `auth.cjs` (drž je co nejužší):

- `tokenSessionFilePath(app)` → absolutní cesta k blobu. **Exportuj ji** — test ji musí použít
  místo vlastní kopie skládání cesty.
- `readEncryptedSession(app, safeStorage)` → objekt session, nebo `null`. **Nikdy nesmí vyhodit výjimku ven.**
- `clearEncryptedSession(app)` → smaže blob; neexistující soubor **není chyba** (`ENOENT` spolkni);
  **jiná chyba se musí projevit v návratové hodnotě**, ne zmizet.
- `discoverEndpoints` → **exportuj** (D-B9-6).

⚠️ **Když B8 některou z těchhle funkcí do `auth.cjs` už přidal, POUŽIJ JI** a nevyráběj druhou.

### 10.4 IPC a preload

```js
// electron/main.cjs — nový blok, patří B9, HNED ZA řádek 692
handleValidated("auth:logout", ["panel"], () => authController.logout());

// electron/preload.cjs — jeden řádek, patří B9
logout: () => ipcRenderer.invoke("auth:logout"),
```

🔴 **`handleValidated`, nikdy holý `ipcMain.handle`.** `handleValidated` (**`main.cjs:151–156`** ✅)
volá `requireTrustedSender` a je to jediné, co brání cizímu `webContents` sáhnout na kanál.
`tests/ipc-sender-guard.test.js:205` to hlídá.

🔴 **Název kanálu MUSÍ být řetězcový literál přímo v registraci.** Brána je regulární výraz nad
zdrojem (`ipc-sender-guard.test.js:188`) a hledá `handleValidated(` / `ipcMain.handle(` následované
uvozovkou. **Registrace přes konstantu (`ipcMain.handle(AUTH_LOGOUT, …)`) tou branou projde neviděna** —
změřeno čtením regexu, viz sabotáž S8.

🔴 **Handler nesmí návratovou hodnotu obohacovat.** Vrací **beze změny** to, co vrátil
`controller.logout()`. Do rendereru nesmí projít token ani `clientId`. Má na to dva testy (§13 krok 5).

### 10.5 Tray

Po úspěšném lokálním odhlášení zavolej **existující** `updateTray("signed-out")` (**`main.cjs:255`** ✅).

⚠️ **Funkci `updateTray` NEUPRAVUJ** — patří B3 a `tests/tray-authority.test.js:39–41`
zamyká její obsah (`expect(functionSource(mainSource, "updateTray")).toContain("trayIconName(nextState)")`).
**Volat cizí funkci ze svého bloku je v pořádku. Editovat ji ne.**

### 10.6 Log

🔴 **Přidej do `logout()` jeden řádek logu s prefixem `[auth]`** — jeden pro úspěch, jeden pro
neúspěch odvolání, oba **bez tokenu, bez e-mailu, bez URL s parametry**.

Proč je to v zadání, a ne jen v ověřovacím scénáři: **`grep -rn "\[auth\]" electron/ src/ scripts/` vrací
dnes NULU.** Návrh packetu po Danovi v kroku 5 živého ověření chtěl, aby ten řádek v terminálu
našel — ale nikde nepředepsal, že má vzniknout. Kanárek, který hledá něco, co nikdo nepostavil,
skončí vždycky výsledkem „NEMĚŘENO". Existující prefixy v `main.cjs` jsou `[ipc]` (`:164`),
`[recording]` (`:313`), `[test]` (`:736`) — `[auth]` do té řady zapadá.

---

## 11. Dependencies

| Závislost | Stav | Proč |
|---|---|---|
| **B8** — `Use the real auth controller instead of the stub` | 🔴 **tvrdá, `plan.md:91–92`** | Dokud `main.cjs:681–692` vrací atrapu (`token: "mock-token-not-persisted"`, `user: { name: "Daniel Novák", … }` — ověřeno na `:689–690`), není co odvolávat a `authController` v main procesu neexistuje. |
| **B4** → B8 | řetěz (`plan.md:91`) | B9 je čtvrtý článek: B1 → B4 → B8 → **B9**. |
| Sdílené soubory | 🔴 **jeden strom = jeden zapisovatel** | B4, B8 i B9 sahají do `electron/auth.cjs`. Jsou v jednom řetězu ⇒ **nikdy neběží paralelně**. Nespouštěj B9 dřív, než je B8 commitnutá. |
| B3 (tray autorita) | měkká | B9 `updateTray` jen volá. |
| B7 (fronta) | **žádná** | R12 se testuje bez B7 — ale **jinak, než navrhoval původní packet**, viz §13 krok 4. |
| **Rozhodnutí B2** (`decisions.md:68`) | značka `⛔B2` v DAG | „Nahrávky jsou majetkem firmy." ⇒ odhlášení nesmí zlikvidovat cizí data. |

`plan.md:171`: **čtvrtá vlna** — „B9 (po B8) · B11 (po B7) · B10".

---

## 12. Přesné soubory

### 12.1 Soubory, které B9 mění

| Soubor | Co v něm |
|---|---|
| `electron/auth.cjs` | `logout()`; `readEncryptedSession`, `clearEncryptedSession`, `tokenSessionFilePath`; **volitelné** `revocationEndpoint` v `discoverEndpoints`; doplnění `module.exports` (+ `discoverEndpoints`, D-B9-6) |
| `electron/main.cjs` | **jen** nový blok `auth:logout` za `:692` |
| `electron/preload.cjs` | **jen** řádek `logout` |
| `tests/logout.test.js` | **NOVÝ**, patří celý B9 |
| `tests/ipc-sender-guard.test.js` | **jediná povolená změna:** doplnit `"auth:logout"` do inventáře (`:191–204`) |

**Nic jiného.** Odhad diffu bez testů (`plan.md:150`): **~80 řádků**. Přes ~250 se story dělí
(`plan.md:136`) — zastav a vrať otázku, nedělej to sám.

### 12.2 🔴 VLASTNICTVÍ BLOKŮ

Opsáno z `plan.md:110–125`, s **opravenými rozsahy řádků** (návrh packetu měl tři posunuté):

> 🔴 **Task packet musí vlastnictví zadat VÝČTEM, ne větou „nesahej na cizí".** Próza prohraje
> s prvním „tady to logicky patří taky".

| Story | Vlastní v `main.cjs` | Vlastní v `preload.cjs` |
|---|---|---|
| **B3** | `trayIconName`, `updateTray`, `deriveTrayState`, registrace tray | odebrat `setTrayState` |
| **B4** | `shouldHidePanelOnBlur` a jeho čítače | nic |
| **B5** | registrace `tracking:*` kanálů, hook na pád rendereru | přidat `tracking:*` |
| **B7** | zapojení fronty, `queue:*` kanály | přidat `queue:*` |
| **B8** | `auth:begin` a jeho okolí | `beginAuth` |
| **B9** | **`auth:logout`** | **přidat `logout`** |
| **B11** | nic | nic |

✅ **Smíš psát:**
- nový blok `handleValidated("auth:logout", …)` v `main.cjs`, **hned za `:692`** (`:693` je prázdný řádek, `:694` je `const requestPermission = …`)
- nový řádek `logout:` v `preload.cjs`
- v `auth.cjs` výhradně to, co vyjmenovává D-B9-5
- **volání** existujících funkcí (`updateTray`, `handleValidated`) ze svého bloku

⛔ **NESMÍŠ sáhnout ani na jeden znak** (rozsahy změřené, ne odhadnuté):

| Rozsah | Co to je | Čí to je |
|---|---|---|
| `main.cjs:681–692` | blok `auth:begin` | **B8** |
| `main.cjs:202–236` | `traySvg` (`:202`), `trayIconName` (`:220`) | **B3** |
| `main.cjs:248–266` | `trayImage` (`:248`), `updateTray` (`:255`) | **B3** |
| `main.cjs:237–247` | `permissionPromptsInFlight` (**`:237`**) a `shouldHidePanelOnBlur` (`:241–247`) | **B4** |
| `main.cjs:662–663` | `tray:set-state` (**`:662`**) a `tray:get-state` (**`:663`**) | **B3** |
| `main.cjs:151–168` | `handleValidated` / `onValidated` — společná infrastruktura | **měnit smí jen story, která to má v zadání; B9 ne** |
| `main.cjs:432–661` | celý nahrávací blok | — |
| `electron/queue.cjs`, `src/lib/queue.js` | fronta | **B7** (a R12 zakazuje sahat na frontu i logicky) |
| `src/**` | renderer | B9 tam nemá v `plan.md:150` jediný soubor |
| `design/**` | schválené | `plan.md:190`, `BEH-NOC.md:133` |
| `docs/changes/desktop-v1/spec.md`, `plan.md` | **ZMRAZENO** | chybu v nich zapiš do `DAN-TODO.md` a jeď dál |

🔴 **Oprava proti návrhu packetu:** ten uváděl B3 jako `202–266` a B4 jako `241–247`. **Ty dva rozsahy
se překrývaly** — `202–266` v sobě má i `237–247`, tedy B4. Výčet, ve kterém dva vlastníci vlastní tentýž
řádek, je přesně to, před čím `plan.md:127` varuje. Rozsahy výš jsou rozdělené tak, aby se nepřekrývaly.
Návrh taky uváděl `tray:set-state` na `:663` — je na `:662`.

---

## 13. TDD kroky

Podle `MASTERPLAN.md:810–822` (RED–GREEN–REFACTOR) a `plan.md:180` bod 1.
**Poměr: 6 červených testů : 3 zelené, které musí zůstat zelené** (`plan.md:183` žádá 2–3 : 1).

🔴 **Do PR patří DOSLOVNÝ výpis červeného testu.** Výpisy níž jsou **očekávaný tvar**;
do PR kopíruj skutečný výstup.

### ✅ Změřený baseline (1. 9. 2026, tenhle strom, před jakoukoli změnou)

Návrh packetu **nespustil ani jednu bránu**. Spuštěny byly:

```
npm run lint        → EXIT=0
npm run typecheck   → EXIT=0
npm run test:unit   → EXIT=0    Test Files 9 passed (9) · Tests 77 passed (77)
bash scripts/akceptace/E6.sh → EXIT=0   (3× PASS)
bash scripts/akceptace/E7.sh → EXIT=0   (5× PASS, chyb: 0; přeskočeno: 0)
```

⚠️ **Poznámka k E7:** návrh packetu čekal `SKIP  živé OAuth discovery: DNS není v tomto prostředí
dostupné (curl 6)`. **Dnes NESKIPUJE — živá kontrola prošla.** Síť tu je. Když ti E7 vypíše SKIP,
je to **změna prostředí, ne normál**, a do PR to piš jako SKIP, nikdy jako ✅.

### Krok 0 — příprava testu bez produkčního kódu

Nový `tests/logout.test.js`. Vzor: `tests/permissions.test.js:1–11` (načítá `auth.cjs` přes
`createRequire`, protože `package.json` má `"type": "module"` a auth je CJS) a
`tests/queue.test.js:201` (dočasný adresář přes `mkdtemp`).

```js
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
const require = createRequire(import.meta.url);
const {
  createAuthController, tokenSessionFilePath, discoverEndpoints,
} = require("../electron/auth.cjs");
```

Pravidla pro fixture — každé z nich odpovídá na konkrétní past v tomhle repozitáři:

- 🔴 **appData přes `mkdtemp(path.join(tmpdir(), "ludone-logout-"))`, NIKDY holý `os.tmpdir()`.**
  Návrh packetu psal „appData ber z `os.tmpdir()`" — to je **jedna sdílená cesta**.
  `tokenStorageDirectory` z ní udělá `<tmpdir>/cz.ludone.desktop/auth/`, tedy **tentýž adresář pro každý
  souběžně běžící testovací soubor**. Vitest pouští soubory paralelně ⇒ vzájemné mazání blobů a náhodná zelená.
- Adresář **uklízej v `finally`** (`rm(dir, { recursive: true, force: true })`), jako to dělá `queue.test.js:207–209`.
- Cesta **nesmí ležet uvnitř repozitáře** — `tokenStorageDirectory` (`auth.cjs:290`) ji odmítne výjimkou
  „cílové úložiště leží uvnitř repozitáře". Kontrola prochází i symlinky, `tmpdir` na macOS je bezpečný.
- `safeStorage` atrapa musí umět `isEncryptionAvailable()`, `encryptString()` **a `decryptString()`**.
  Stačí `Buffer.from(text, "utf8")` a `buffer.toString("utf8")`.
  ⚠️ `decryptString` se dnes v repozitáři **nikde nevolá** — tvar atrapy je odvozen z Electron API.
- Blob **zapiš na cestu z produkční `tokenSessionFilePath(app)`**, ne z ručně složené cesty.
- 🔴 **Hodnoty tokenů v fixture musí být krátké a nesmí vypadat jako token.** Použij `"fake-refresh"`,
  `"fake-access"`. ✅ **Ověřeno spuštěním skutečného skeneru z `E7.sh:20` nad zkušebním souborem:**
  `refreshToken: "fake-refresh"`, `accessToken: "fake-access"` i `token=fake-refresh&token_type_hint=refresh_token`
  **skener nechytá**; realistické hodnoty (`ldmcp_oauth_refresh_…`, `access_token = "<26 znaků>"`) **chytá**.
- `typecheck` **kontroluje `tests/**`** (`jsconfig.json:16` → `include: ["src/lib/**/*.js","tests/**/*.js"]`, `checkJs: true`).
  ⚠️ Ale **žádnou jistotu o tvaru návratu ti nedá** — `createRequire(...)("../electron/auth.cjs")` je pro TS `any`
  a `electron/**` je v `exclude`. Netvrď v PR, že typecheck ověřil kontrakt.
- `lint` je nad `tests/**` **přísný**: výjimka `"no-unused-vars": "off"` v `eslint.config.js` platí
  **jen pro `src/**`**. Nepoužitý import v testu = `EXIT=1`.

### Krok 1 — RED #1: funkce vůbec neexistuje

```
 FAIL  tests/logout.test.js > odhlášení > odvolá na serveru dřív, než smaže lokální session
TypeError: controller.logout is not a function
```

⚠️ **Jakýkoli jiný důvod** (chybějící export, `TypeError: Chybí Electron app, safeStorage nebo shell`,
`Error: cílové úložiště leží uvnitř repozitáře`) **znamená vadu testu, ne chybějící funkci.**

### Krok 2 — RED #2: pořadí (R13)

🔴 **Tady byl návrh packetu vyloženě špatně a test podle něj by nešel napsat.**
Návrh dával `fetchImpl`, který na **každé** volání vrací `{ ok: true, status: 200, json: async () => ({}) }`,
a pak tvrdil, že `steps` má mít **právě 1 položku**.

Podle D-B9-7 ale `logout()` volá **nejdřív `discoverEndpoints`**, a to je **taky fetch**. Tedy:
1. `steps` bude mít **DVĚ** položky, ne jednu — návrhová assertion je nesplnitelná;
2. `json: async () => ({})` u prvního volání **rozbije discovery** ještě před revoke:
   `discoverEndpoints` (`auth.cjs:86–88`) vyhodí `OAuth server nepodporuje povinné PKCE S256`.

Test tedy zčervená ze **špatného důvodu** a — hůř — kdyby implementátor zabalil celý `logout()`
do jednoho `try/catch` s návratem `reason: "offline"`, **test #3 by zezelenal s úplně rozbitou funkcí**.

**Správná atrapa fetche** (rozlišuje discovery od revoke a hlídá blob u obou):

```js
const steps = [];
const metadata = {
  issuer: "https://labs.ludone.cz",
  authorization_endpoint: "https://labs.ludone.cz/api/mcp/oauth/authorize",
  token_endpoint: "https://labs.ludone.cz/api/mcp/oauth/token",
  registration_endpoint: "https://labs.ludone.cz/api/mcp/oauth/register",
  revocation_endpoint: "https://labs.ludone.cz/api/mcp/oauth/revoke",
  code_challenge_methods_supported: ["S256"],
};
const fetchImpl = async (url, init = {}) => {
  steps.push({
    url: String(url),
    body: init.body === undefined ? null : String(init.body),
    blobExists: fs.existsSync(blobPath),      // ← tohle měří R13
  });
  if (String(url).includes("/.well-known/")) {
    return { ok: true, status: 200, json: async () => metadata };
  }
  return { ok: true, status: 200, json: async () => ({}) };
};
```

Assertions, které tenhle test musí nést:

1. `steps` má **právě 2** položky;
2. `steps[0].url` končí na `/.well-known/oauth-authorization-server`;
3. `steps[1].url === metadata.revocation_endpoint`;
4. `steps[1].body` obsahuje `token_type_hint=refresh_token` **a** `client_id=`;
5. 🔴 **`steps[0].blobExists === true` A `steps[1].blobExists === true`** ← tohle je R13;
6. po doběhnutí `fs.existsSync(blobPath) === false`;
7. `result` = `{ signedOutLocally: true, serverRevoked: true, reason: null }`.

Nejdřív přidej `async logout() { … }`, který **jen smaže blob a nic neposílá**:

```
AssertionError: expected [] to have a length of 2 but got +0
```

pak volání ve **špatném pořadí**:

```
AssertionError: expected false to be true // Object.is equality
 ❯ tests/logout.test.js:NN  expect(steps[1].blobExists).toBe(true)
```

### Krok 3 — RED #3: bez sítě se nesmí lhát

`fetchImpl` hodí `new Error("fetch failed")` **na prvním volání** (tedy už na discovery — to je
věrné: bez sítě neprojde ani jedno). Test žádá `serverRevoked === false`, `reason === "offline"`,
**blob přesto smazaný**, **žádná výjimka ven**.

```
 FAIL  tests/logout.test.js > odhlášení > bez sítě netvrdí, že je přístup odvolaný
Error: fetch failed
```

### Krok 4 — RED #4: nic mimo blob nesmí zmizet (R12, ⛔B2)

🔴 **Návrhový test byl fiktivní brána a musel se zahodit.**
Návrh chtěl založit soubor fronty „ve stejném dočasném adresáři" a porovnat bajty.
Jenže **produkční `logout()` cestu k tomu souboru nezná a znát nemůže** — je to náhodný `mkdtemp`.
Test tedy **projde i tehdy, když logout frontu doopravdy maže**, protože maže **produkční** cestu,
ne testovací. A sabotáž S3 („přidej `fs.rmSync(queuePath)`") by šla provést jen tak, že saboteur
napíše do produkce odkaz na testovací fixture — což nikdo nikdy neudělá. To je přesně
„test nad kopií logiky" ze čtyř tříd lhavých bran.

**Nahrazeno dvěma testy, které měří to, co logout doopravdy udělat může:**

**4a — snímek celého jmenného prostoru aplikace.** Fixture položí vedle `auth/` ještě
`<appData>/cz.ludone.desktop/queue/outgoing.json` — zapsaný **produkční funkcí**
`saveQueueAtomically` z `electron/queue.cjs` — a k tomu `<appData>/cz.ludone.desktop/nahravky/x.bin`.
Test si udělá **rekurzivní seznam souborů před a po** a tvrdí:
**jediný rozdíl je zmizelý `auth/oauth.enc`.**

To chytá realistickou vadu (`fs.rm(<namespace>, { recursive: true })`, „uklidím po sobě"),
kterou návrhový test nechytal.

```
 FAIL  tests/logout.test.js > odhlášení > nesmaže nic než vlastní blob
AssertionError: expected [ 'auth/oauth.enc' ] to deeply equal [ 'auth/oauth.enc', 'queue/outgoing.json' ]
```

**4b — `auth.cjs` o frontě vůbec neví.** Strukturální kontrola nad zdrojem, ve stylu, který
tenhle repozitář už používá (`tray-authority.test.js:36`, `ipc-sender-guard.test.js:206`):

```js
const authSource = readFileSync(new URL("../electron/auth.cjs", import.meta.url), "utf8");
expect(authSource).not.toMatch(/queue|fronta|outgoing/i);
```

⚠️ **Přiznaná mez 4b:** chytá saboteura, který cokoli pojmenuje „queue"; nechytá toho,
kdo napíše holé `path.join(dir, "outgoing.json")` bez toho slova. Proto 4a **i** 4b, ne jen jedno.

### Krok 5 — RED #5: přes IPC nesmí projít token

Dva testy, ne jeden — návrh měl jen první a **ten hlídá jen controller, ne kanál**:

**5a — návratová hodnota controlleru:**
```js
expect(Object.keys(result).sort()).toEqual(["reason", "serverRevoked", "signedOutLocally"]);
expect(JSON.stringify(result)).not.toContain("fake-refresh");
expect(JSON.stringify(result)).not.toContain("fake-access");
```

**5b — blok `auth:logout` v `main.cjs` nic nepřidává.** Vyřízni ze zdroje `main.cjs` úsek registrace
`auth:logout` a tvrď, že neobsahuje `token`, `clientId`, `identity` ani `...` (spread).
Bez 5b může handler klidně vrátit `{ ...result, clientId }` a **5a o tom neví**.

```
 FAIL  tests/logout.test.js > odhlášení > nevrací volajícímu žádný token
AssertionError: expected [ 'accessToken', 'reason', … ] to deeply equal [ 'reason', 'serverRevoked', 'signedOutLocally' ]
```

### Krok 6 — RED #6: discovery bez revoke endpointu (D-B9-2 + D-B9-6)

Dva testy nad **exportovaným** `discoverEndpoints`:

1. metadata **s** `revocation_endpoint` → vrátí ho ověřený `trustedRemoteEndpoint`em;
2. metadata **bez** `revocation_endpoint` → **`discoverEndpoints` NESMÍ vyhodit výjimku**
   a `revocationEndpoint` je `undefined`; `logout()` nad takovým serverem vrátí
   `{ signedOutLocally: true, serverRevoked: false, reason: "no-revocation-endpoint" }`.

Bod 2 je zároveň jediná brána, která chrání `begin()` před tichou regresí (viz S7).

```
 FAIL  tests/logout.test.js > discovery > revocation_endpoint je volitelný
TypeError: discoverEndpoints is not a function
```

### Krok 7 — GREEN a testy, které musí ZŮSTAT zelené

Doimplementuj minimum, spusť `npm run test:unit; echo "EXIT=$?"` a nad rámec vlastních šesti **dolož zeleně**:

1. `tests/ipc-sender-guard.test.js:186` — „všechny IPC kanály z produkčního kódu registruje přes validační wrapper".
   🔴 **Doplnění `"auth:logout"` do seznamu na `:191–204` NENÍ oslabení testu** — je to **úplný inventář**
   kanálů a nová položka ho udržuje úplným. Assertions na `:205–207` (`registrations.filter(… startsWith("ipcMain."))`
   a obě `toContain("requireTrustedSender")`) **se nesmí dotknout ani znakem.**
2. `tests/tray-authority.test.js` (7 testů) — zelený **bez jediné úpravy** (důkaz, že jsi nesáhl na `updateTray`).
3. `tests/permissions.test.js` (14 testů) — zelený **bez úprav**, zvlášť „používá systémové appData nezávislé
   na přesměrovaném userData" (`:126`) — důkaz, že jsi nesáhl na `tokenStorageDirectory`.

Baseline k porovnání: **77 testů v 9 souborech, všechny zelené.**

---

## 14. Sabotážní testy

`plan.md:182`: sabotáž musí **prokazatelně chytat odstranění guardu**, s doslovným výpisem.
Postup: rozbij → `npm run test:unit; echo "EXIT=$?"` → **zkopíruj doslovný výstup do PR**
→ `git checkout -- <soubor>` → ověř, že je zase zeleno.

🔴 **Sabotáž, kterou brána nechytí, je důkaz, že brána neměří.** Taková sabotáž se nesmí
„odbýt" poznámkou — je to nález, který patří do PR a do `DAN-TODO.md`.

| # | Co rozbít | Která brána musí zčervenat | Očekávaný tvar |
|---|---|---|---|
| **S1** | V `logout()` **prohoď pořadí**: nejdřív `clearEncryptedSession`, pak revoke | `logout.test.js` — „odvolá na serveru dřív…" | `AssertionError: expected false to be true` na `steps[1].blobExists` |
| **S2** | Vrať natvrdo `serverRevoked: true` bez ohledu na výsledek fetche | `logout.test.js` — „bez sítě netvrdí…" | `AssertionError: expected true to be false` |
| **S2b** 🆕 | Vrať natvrdo `signedOutLocally: true` a mazání blobu úplně vynech | `logout.test.js` — „odvolá na serveru dřív…", assertion 6 | `AssertionError: expected true to be false` na `fs.existsSync(blobPath)` |
| **S3** 🔄 | **Nahrazeno.** Do `logout()` přidej `fs.rmSync(path.dirname(tokenStorageDirectory(app)), { recursive: true, force: true })` — tedy realistický „úklid celého jmenného prostoru" | `logout.test.js` — „nesmaže nic než vlastní blob" (4a) | `AssertionError: expected [ … ] to deeply equal [ 'auth/oauth.enc', 'queue/outgoing.json', 'nahravky/x.bin' ]` |
| **S3b** 🆕 | Do `auth.cjs` přidej `require("./queue.cjs")` | `logout.test.js` — 4b | `AssertionError: expected '…' not to match /queue|fronta|outgoing/i` |
| **S4** | Zaměň `handleValidated("auth:logout", …)` za holé `ipcMain.handle("auth:logout", …)` | `ipc-sender-guard.test.js:205` | `AssertionError: expected [ { registration: 'ipcMain.handle', channel: 'auth:logout' } ] to deeply equal []` |
| **S5** | Nech kanál v `main.cjs`, ale **vyndej `"auth:logout"` z inventáře** v testu | `ipc-sender-guard.test.js:191` | `AssertionError: expected [ 'auth:begin', 'auth:logout', … ] to deeply equal [ 'auth:begin', 'panel:hide', … ]` |
| **S6** 🔄 | **Přeformulováno.** Nech `logout()` po smazání blobu **držet session v modulové proměnné a při druhém volání ji poslat znovu** | `logout.test.js` — „druhé odhlášení už nic neposílá" (`reason: "no-token"`, `steps.length` po dvou voláních zůstane 2) | `AssertionError: expected 4 to be 2` |
| **S7** 🔄 | Udělej `revocationEndpoint` v `discoverEndpoints` **povinný** (`trustedRemoteEndpoint` bez ochrany proti `undefined`) | `logout.test.js` krok 6 bod 2 | `TypeError: revocation_endpoint musí být neprázdný řetězec` |
| **S8** 🆕 | Zaregistruj kanál jako `ipcMain.handle(AUTH_LOGOUT_CHANNEL, …)` s konstantou místo literálu, a `"auth:logout"` do inventáře **nepřidávej** | ⛔ **ŽÁDNÁ. Očekává se, že celá sada zůstane ZELENÁ.** | `Test Files 10 passed · EXIT=0` — a to je **nález**, ne úspěch |

🔴 **Tři opravy proti návrhu packetu, které by jinak vyrobily falešný důkaz:**

- **S3 byla neproveditelná.** Návrh chtěl `fs.rmSync(queuePath)`, kde `queuePath` je cesta,
  kterou zná jen test. Sabotáž, kterou nejde napsat, nedokazuje nic.
- **S6 sabotovala stav, který neexistuje.** Návrh psal „nevynuluj session v paměti (nech proměnnou žít)".
  **Dnešní `createAuthController` žádnou session v paměti nedrží** — `begin()` ji zapíše a zapomene
  (`auth.cjs:397–414`). Po prvním odhlášení je blob pryč, takže druhé volání nemá co poslat samo od sebe.
  Přeformulováno tak, aby sabotáž **přidávala** cache — což je vada, kterou implementátor opravdu udělat může.
  Návrhový očekávaný výpis `expected 2 to be 1` je navíc špatně i číslem (discovery je taky fetch).
- **S7 neměla co zčervenat.** 🔴 Změřeno: `grep -rn "discoverEndpoints\|createAuthController\|begin()\|revocation" tests/ scripts/ src/`
  vrací **NULU**. V repozitáři **není jediný test, který by se dotkl `discoverEndpoints` nebo `begin()`**.
  Návrh se odvolával na „test `begin()` / discovery" — ten neexistuje. Proto D-B9-6 (export) + krok 6.

⚠️ **S5 je sabotáž na testu, ne na produkci** — je tam schválně: dokazuje, že inventář je měřidlo, ne dekorace. Hned ji vrať.

⚠️ **S8 je sabotáž, o které se dopředu ví, že projde** — a přesně proto v seznamu je.
Regulární výraz na `ipc-sender-guard.test.js:188` hledá jen `…Validated(` / `ipcMain.…(`
následované **uvozovkou**. Kanál zaregistrovaný přes konstantu je pro bránu neviditelný v obou
assertions naráz. **Dolož to a zapiš do `DAN-TODO.md`** jako díru v bráně (oprava té brány
patří jiné story — `ipc-sender-guard.test.js` smí B9 měnit jen doplněním inventáře, §12.1).

---

## 15. Projektové brány

Všechny **měř před rourou** — `npm run lint | tee log` ti EXIT kód schová.
Používej `npm run <x>; echo "EXIT=$?"`.

| Brána | Příkaz | Musí | Baseline změřený 1. 9. |
|---|---|---|---|
| Lint | `npm run lint; echo "EXIT=$?"` | `EXIT=0` | ✅ 0 |
| Typecheck | `npm run typecheck; echo "EXIT=$?"` | `EXIT=0` | ✅ 0 |
| Unit | `npm run test:unit; echo "EXIT=$?"` | `EXIT=0` | ✅ 0 · 77 testů / 9 souborů |
| Vše naráz | `npm run gates; echo "EXIT=$?"` | `EXIT=0` | = lint && typecheck && test:unit (`package.json:14`) |
| Akceptace E7 (bezpečnost OAuth) | `bash scripts/akceptace/E7.sh; echo "EXIT=$?"` | `EXIT=0` | ✅ 0 · 5× PASS, **0 skipů** |
| Akceptace E6 (oprávnění) | `bash scripts/akceptace/E6.sh; echo "EXIT=$?"` | `EXIT=0` | ✅ 0 · 3× PASS |
| CI | `.github/workflows/ci.yml` → job `gates`, `runs-on: macos-latest`, `node-version: 22`: `npm ci` → `npm run gates` → `npm run build` | zeleno | ✅ soubor přečten |

🔴 **Past v E7 — ověřená spuštěním, ne přečtením:** `zadny_ulozeny_token` (`E7.sh:18–37`) pouští
`git grep --untracked` přes celý repozitář (tedy **i přes tvůj zatím necommitnutý test**) a hledá
čtyři vzory: Google `ya29.…`, JWT, `ldmcp_oauth_(access|refresh)_…` a snake_case přiřazení
`access_token`/`refresh_token` s hodnotou 20+ znaků v uvozovkách.
**Fixture v `tests/logout.test.js` proto musí mít krátké, nerealistické hodnoty.**
Řetězce `token_type_hint=refresh_token` a `client_id=` v těle požadavku jsou v pořádku — vzor
potřebuje za názvem `:` nebo `=` a pak uvozovku, ne `&`.

🆕 **Nález o E7, který patří do `DAN-TODO.md` (a NENÍ úkol pro B9):**
E7 skener **nemá kanárka** — když by regulární výraz přestal fungovat, brána hlásí PASS a nikdo
se to nedozví (`spec.md:280+` přitom právě tohle pravidlo zavádí: grep bez kanárka je rozbitý grep).
Změřeno navíc: skener **vidí jen snake_case** `access_token`/`refresh_token`. Skutečný blob i kód
používají **camelCase** `refreshToken` — tedy uniklý pravý refresh token zapsaný v camelCase
by E7 **neodhalil**. `scripts/akceptace/E7.sh` **není soubor B9** (§12.1); nález zapiš, neopravuj.

⛔ **`node scripts/ui-smoke.mjs` NEPOUŠTĚJ.** Potřebuje skutečné okno; `BEH-NOC.md:139` to
v sandboxu zakazuje, v CI je za `if: ${{ false }}` (`ci.yml:27`) a `BEH-NOC.md:98` říká,
že je **na `main` červený a je to úkol B1** — jeho červená není tvoje vina a není tvůj úkol.

---

## 16. Live-verification scénář

Kroky **pro člověka u Macu** (Dan). Vykonavatel je **nesmí odškrtnout za něj** — dokud je
nikdo neprovedl, verification zůstává `tests-green` (🧪), nikdy `verified-live` (✅).

**Předpoklad:** B8 je hotová, takže `auth:begin` se opravdu přihlašuje. Bez toho je scénář ⛔ NEMĚŘENO.

```
0)  npm ci && npm run build

1)  KANÁREK #1 — čistý start:
    ls -l ~/Library/Application\ Support/cz.ludone.desktop/auth/oauth.enc
    ⇒ MUSÍ hlásit "No such file or directory".
    Když soubor existuje ze staršího běhu, smaž ho ručně — jinak krok 3 nic nedokazuje.

2)  LUDONE_E2E=1 npm start
    (LUDONE_E2E=1 → IS_TEST_RUN, main.cjs:26; shouldHidePanelOnBlur pak vrací false, main.cjs:242,
     a panel při ztrátě fokusu nezmizí. Volání ověřeno na main.cjs:329–334.)
    Klikni „Přihlásit v prohlížeči", dokonči souhlas.

3)  🔴 KANÁREK #2 — TOHLE JE TA KONTROLA, KTERÁ MUSÍ NĚCO NAJÍT:
    ls -l ~/Library/Application\ Support/cz.ludone.desktop/auth/oauth.enc
    ⇒ soubor MUSÍ existovat, práva -rw------- (auth.cjs:311, chmod 0o600).
    ⛔ KDYŽ HO TU NENAJDEŠ, SCÉNÁŘ KONČÍ VÝSLEDKEM „⛔ NEMĚŘENO", NE „✅".
       Kontrola, která nevidí ani to, co tam být MÁ, neumí dokázat ani že něco zmizelo.

3b) KANÁREK #2b — co v tom adresáři ještě leží:
    ls -R ~/Library/Application\ Support/cz.ludone.desktop/
    ⇒ zapiš si výpis. Po kroku 6 musí být IDENTICKÝ až na chybějící auth/oauth.enc.
       Tohle je živý protějšek testu 4a a jediný způsob, jak R12 na Macu opravdu změřit.

4)  V panelu ⌥⌘I (DevTools) → konzole:
       await window.ludone.logout()
    ⇒ vrátí { signedOutLocally: true, serverRevoked: true, reason: null }
    (⇒ serverRevoked: true se očekává právem: discovery na labs i prod revocation_endpoint
       vrací — změřeno 1. 9. 2026, viz §10.1.)

5)  KANÁREK #3 — log:
    V terminálu, kde běží npm start, musí být řádek s prefixem [auth] (§10.6).
    ⛔ Když tam žádný [auth] řádek NENÍ, je výsledek NEMĚŘENO — ne „proběhlo tiše".
       Pozn.: appka spuštěná z Finderu stdout nemá. Pouštěj z Terminálu.

6)  Opakuj příkaz z kroku 3.  ⇒ teď MUSÍ hlásit "No such file or directory".
    A zopakuj 3b — kromě blobu se nesmí lišit ani jedna položka.

7)  MUSÍ ZŮSTAT ZELENÉ:
    security find-generic-password -s 'LuDone Desktop Safe Storage'
    ⇒ položku NAJDE. Odhlášení maže blob, ne hlavní klíč safeStorage.
       Kdyby zmizela i ta, je to nález — zapiš ho.

8)  Ikona v liště je „nepřihlášeno" (tooltip „LuDone · nepřihlášeno", main.cjs:259).

9)  VĚTEV BEZ SÍTĚ:
    Přihlas se znovu (kroky 2–3), pak vypni Wi-Fi a zopakuj krok 4.
    ⇒ { signedOutLocally: true, serverRevoked: false, reason: "offline" }
    ⇒ blob je i tak pryč (krok 6 platí)
    ⇒ v logu [auth] řádek říká, že se odvolat NEPODAŘILO
    ⛔ Kdyby to vrátilo serverRevoked: true, je to lež o třicet dnů — R13 / M27.
```

⚠️ **Dvě věci v tomhle scénáři nejsou ověřené, jsou odvozené z kódu** (a nikdo je na Macu neviděl):
**dostupnost DevTools v panelu** (`main.cjs` nikde nevolá `Menu.setApplicationMenu` ani nevypíná
`webPreferences.devTools`, tedy platí výchozí menu s ⌥⌘I) a **chování panelu s odpojeným okénkem
DevTools** při `LUDONE_E2E=1`. Když ⌥⌘I nezabere, není to vada B9 — zapiš to a použij jinou cestu
k volání (např. dočasný `LUDONE_E2E` hook), ale **nepiš „ověřeno"**.

🔴 **Co tímhle scénářem ověřit NEJDE, a musí se to tak i napsat:**
**že token na serveru opravdu přestal platit.** Serverová strana je mimo rozsah (S1, `spec.md:32`,
`plan.md:58–62`), tenhle repozitář na ni nevidí. Serverová půlka F004 je **⛔ NEMĚŘENO**, dokud to
Dan neověří v `app.ludone.cz` (návod: `specs/E6-prihlaseni-a-fronta.md:39` — „po odhlášení vrátí
uploadový endpoint na dříve zachycený access token 401 a v DB je `revoked_at` na celé rodině").
**Nepiš „ověřeno naostro" za obě půlky, když jsi viděl jen jednu.**

---

## 17. Rollback

- **Jedním revertem:** `git revert <sha PR B9>`. `plan.md:68`: „Každá story je samostatně
  revertovatelná. **Žádná migrace v1** (desktop nikam nepíše)."
- **Žádná změna formátu dat.** B9 blob **čte a maže**, tvar `{v:1, …}` (`auth.cjs:397–411`) nemění.
- **Žádný nový vypínač**, žádný cizí neflipnutý ⇒ není co vracet v konfiguraci.
- **Stopy mimo tři produkční soubory:** položka `"auth:logout"` v inventáři
  `tests/ipc-sender-guard.test.js` a nový `tests/logout.test.js`. Revert je odstraní spolu se
  zbytkem, takže inventář zůstane úplný.
- **Po revertu zmizí `window.ludone.logout`.** B9 nepřidává žádného volajícího v `src/**`,
  nemá to co rozbít. 🔴 Kdyby mezitím vznikla UI story, která ho volá, **revertují se obě**.
- 🆕 **Revert vrátí i export `discoverEndpoints`** (D-B9-6). Nic jiného ho nepoužívá — ověřeno
  (`grep` v `tests/`, `src/`, `scripts/` → nula), takže revert nikoho neshodí.
- **Co revert nevrátí:** už provedená odvolání na serveru. To je správně — odvolaný přístup
  se nevrací a je to bezpečná strana selhání.

---

## 18. Definition of Done

**Z plánu (`plan.md:178–186`, doslova):**

1. Cílený test **napřed** a viděný **červený** ze správného důvodu.
2. `npm run lint`, `typecheck`, `test:unit` — všechny EXIT=0, **měřeno před rourou**.
3. Sabotáž, která prokazatelně chytá odstranění guardu, s **doslovným výpisem**.
4. Nejméně jeden případ, který musí zůstat **zelený** (poměr 2–3 červené : 1 zelená).
5. **Diff přečtený Claudem**, u money a RBAC povinně. *(F004 je `security` ⇒ povinně.)*
6. PR odkazuje na Feature ID a tenhle plán.
7. **Bez produkce a bez merge** před Danovým finálním schválením.

**Navíc, specificky pro B9:**

- **B9-1** V PR doslovný výpis **všech šesti** červených testů z §13, každý s uvedením, proč je to „červená ze správného důvodu".
- **B9-2** V PR doslovný výpis **všech deseti** sabotáží z §14 — **včetně S8, u které se očekává, že brána NEZČERVENÁ**. Nezčervenalá sabotáž je nález, ne důvod k mlčení.
- **B9-3** Doloženo, že `tests/tray-authority.test.js` a `tests/permissions.test.js` jsou zelené **bez jediné úpravy**.
- **B9-4** Doloženo, že jediná změna v `tests/ipc-sender-guard.test.js` je **přidání** `"auth:logout"` do inventáře. `git diff tests/ipc-sender-guard.test.js` v PR.
- **B9-5** `bash scripts/akceptace/E7.sh` a `E6.sh` zelené. **Případný `SKIP` u živého discovery je v PR označený jako SKIP, ne jako pass** — a je to změna proti baseline (1. 9. neskipoval nic).
- **B9-6** V PR **čtyři osy** F004 po změně, formát `spec.md:66–71`: `approved / pr-open / disabled / tests-green`.
  🔴 `verified-live` **nesmí** PR tvrdit (`plan.md:162–165`).
- **B9-7** V PR napsáno, že **serverová půlka odvolání je ⛔ NEMĚŘENO** (S1) a co přesně musí udělat Dan.
- **B9-8** V PR vypsané **každé rozhodnutí, které jsi udělal za Dana** (`BEH-NOC.md:156`: „Tichý default je vada"). Rozhodnutí D-B9-1 až D-B9-7 nepočítej — ta udělal koordinátor. Počítej jen ta tvoje navíc.
- **B9-9** 🆕 V PR uvedený **počet testů před a po** (baseline: 77 / 9 souborů). Klesající počet bez vysvětlení = smazaný test.
- **B9-10** 🆕 V PR uvedený **Plan SHA `c7b1bb7…` a Spec SHA `1e97097…`** a potvrzení, že se od psaní packetu nezměnily.

---

## 19. Implementátor

**Codex** (`plan.md:92`, sloupec Vykonavatel u B9).

Spouštět **viditelně v Orce**: `~/.claude/scripts/orca-codex.sh start "<úkol>" "<prompt>"`.

🔴 **Codex ve worktree nedělá ŽÁDNOU git operaci** — edituje jen soubory. `git add/commit/checkout/merge`
mu spadnou na „Operation not permitted". Do zadání dej tu větu doslova a **commituj po něm sám,
hned po doběhnutí** — sabotážní kolo končí `git checkout -- .` a nad necommitnutou prací by ji smazalo.

🔴 **Jeden strom = jeden zapisovatel.** B4, B8 i B9 sahají do `electron/auth.cjs`.
Dva souběžní zapisovatelé si práci přepíší a **důkaz z takového běhu je neplatný, i když
obě strany doběhnou „úspěšně"**.

⚠️ **Do `main` mezitím commituje jiná session** (HEAD se během revize posunul dvakrát).
Před startem si udělej `git pull --ff-only` a zkontroluj, že Plan SHA a Spec SHA sedí.

### 🔴 Co implementátor NESMÍ (`MASTERPLAN.md:635–645`, doslova)

- **rozšířit scope;**
- **změnit schválený design;**
- **vytvořit nový design-system pattern** bez tasku a schválení;
- **změnit API/datový kontrakt** bez aktualizace plánu;
- **oslabit test;**
- **obejít bránu;**
- **rozhodnout nové money nebo RBAC pravidlo.**

**Pokud task packet nestačí, vrátí konkrétní otázku koordinátorovi. Nehádá.** (`:647`)

K tomu `MASTERPLAN.md:824–836` („Zákaz změkčení měřidla"), když padá test nebo brána:
**oprav vadu · neoslabuj assertion · nemaž test · nepřidávej baseline · nepoužívej force ·
nevypínej workflow · nepoužívej skip CI.**
**Po třetím neúspěšném opravném kole zastav a vrať přesný blocker a důkazy.**

---

## 20. Reviewer

**Claude** — konsolidace je vždy na hlavní session (`BEH-NOC.md`: diff, brány, commit a PR čte a dělá Claude, i u Codexovy práce).
F004 má v `spec.md:81` riziko **`security`**, takže diff je podle `plan.md:183` **povinně čtený**.

| Pass | Co u B9 konkrétně |
|---|---|
| **Pass 2 — Security a RBAC** | Kanál přes `handleValidated` **a s literálovým názvem** (S8); přes IPC neprojde token ani `clientId` (5a **i** 5b); blob se maže po revoke, ne před ním; `safeStorage` zůstává jediné úložiště; `logout` nikdy nereject |
| **Pass 3 — Money safety** | R12 + ⛔B2: snímek jmenného prostoru (4a) i strukturální kontrola (4b). Smazaná fronta = ztracená práce, kterou nikdo nespočítá |
| **Pass 4 — Spec compliance** | R13, R12, R14, R16, R17, R18 podle §8 |
| **Pass 5 — Plan compliance** | Vlastnictví bloků podle §12.2 — **řádek po řádku diffu**, ne od oka. Zvlášť: nesáhl někdo do `begin()`? |
| **Pass 7 — Verification evidence** | Doslovné výpisy; **S8 doložená jako nezčervenalá**; žádné `verified-live` bez člověka |

---

## Otevřené otázky — NEHÁDEJ, vrať je

| # | Otázka | Proč to nejde rozhodnout tady |
|---|---|---|
| **O-B9-1** | Odpoví `POST /api/mcp/oauth/revoke` na veřejného klienta bez secretu `200`, a zneplatní **celou rodinu** jedním voláním? | Serverový kód (`revokeOauthToken`, `revokeRefreshFamily`) žije v repozitáři **`ludone-app`**, který v tomhle běhu nikdo neotevřel. Discovery ✅ říká, že endpoint existuje a `none` je podporovaná auth metoda — **chování po zavolání změřeno není**. Dopad: `reason: "http-<n>"` může být v praxi častější, než čekáme. |
| **O-B9-2** | Má `logout()` po `http-4xx` (typicky `invalid_grant`, R17) hlásit `serverRevoked: false`, nebo `true`? | R17 říká, že `invalid_grant` je pauza, ne selhání — token už neplatí, takže z pohledu uživatele je odvoláno. Packet volí **konzervativní `false` + `reason: "http-400"`** (nikdy netvrdit odvoláno bez potvrzení). **Je to rozhodnutí koordinátora, ne spec** — když ho Dan chce jinak, řekne to. |
| **O-B9-3** | Vadí, že `logout()` je přes `discoverEndpoints` závislý i na `registration_endpoint`? Server, který přestane nabízet registraci, tím **rozbije odhlášení**. | Alternativa (vlastní úzká funkce jen pro revoke) by duplikovala načítání metadat. Packet volí jeden zdroj pravdy; **riziko zapiš do `DAN-TODO.md`**. |
| **O-B9-4** | Kdo opraví díru v `ipc-sender-guard` (S8) a chybějícího kanárka v E7? | Ani jeden soubor B9 nevlastní. Nálezy patří do `DAN-TODO.md`. |

---

## Co revize opravila

**Faktické lži proti kódu a gitu**

1. 🔴 **Spec SHA byla špatná.** Packet tvrdil, že `spec.md` je zmrazená ve stejném commitu jako plán (`c7b1bb7`). Skutečnost: `1e97097`. Kdo by si spec vytáhl podle packetu, četl by **starší verzi**, než je ta zmrazená.
2. 🔴 **HEAD byl šest commitů pozadu** (`cb1de26` vs. `0380bc0`, během revize dál na `d91558a` — do repozitáře souběžně píše jiná session). HEAD z packetu odstraněn; kotvou jsou Plan SHA a Spec SHA.
3. **`design/` NENÍ netrackovaný** — `git ls-files design` vrací 25 souborů. Strom byl při revizi úplně čistý.
4. **`tasks/` už není prázdný** — leží tam `B1-ui-smoke.md` a `B4-tri-vady-prihlaseni.md`.
5. **Tři posunutá čísla řádků:** `configureWritablePaths` končí na `:191` (ne `:190`); `tray:set-state` je na `:662` (ne `:663`); `permissionPromptsInFlight` je na `:237`, tedy **mimo** rozsah `241–247`, kterým ho packet vymezoval.
6. **Rozsahy vlastnictví se překrývaly:** B3 (`202–266`) v sobě mělo celý blok B4 (`237–247`). Výčet se dvěma vlastníky téhož řádku je přesně to, před čím `plan.md:127` varuje. Rozděleno na `202–236` + `248–266`.

**Testy, které by byly zelené i s vadou**

7. 🔴 **Test na R12 (fronta) byl fiktivní brána.** Fixture ležela v náhodném `mkdtemp` adresáři, který produkční `logout()` nezná — test **projde i tehdy, když logout frontu doopravdy maže**. Nahrazeno snímkem celého jmenného prostoru aplikace (4a) + strukturální kontrolou, že `auth.cjs` o frontě neví (4b).
8. 🔴 **Fetch atrapa v kroku 1 byla neslučitelná s vlastním rozhodnutím packetu.** `logout()` musí volat discovery (endpoint se nikam neukládá), takže `steps` má **dvě** položky, ne jednu; a `json: async () => ({})` rozbije discovery na `code_challenge_methods_supported` dřív, než dojde na revoke. Všechny assertions kroku 2 i očekávaný výpis S6 byly tím pádem nesplnitelné — a implementace s jedním `try/catch` by test #3 udělala zeleným s úplně rozbitou funkcí.
9. **Test na „token přes IPC" hlídal jen controller, ne kanál.** Handler v `main.cjs` mohl vrátit `{ ...result, clientId }` a nikdo by se to nedozvěděl. Přidán test 5b nad zdrojem registrace.
10. **`signedOutLocally: true` bylo typované jako literál** s poznámkou „vždy true, když se blob povedlo odstranit" — to si odporuje a natvrdo vrácené `true` je táž lež, kterou o řádek výš hlídá sabotáž S2. Změněno na `boolean` + nová sabotáž S2b.
11. **`os.tmpdir()` jako appData je sdílená cesta.** Vitest pouští soubory paralelně; dva testy by si přepisovaly tentýž blob. Nahrazeno `mkdtemp` (vzor je v repu: `queue.test.js:201`).

**Sabotáže, které by nic nedokázaly**

12. 🔴 **S7 neměla co zčervenat.** Změřeno: v `tests/` **není jediný test, který by se dotkl `discoverEndpoints` nebo `begin()`** (grep → nula). Packet se odvolával na test, který neexistuje. Doplněno rozhodnutí D-B9-6 (exportovat `discoverEndpoints`) a krok 6 v TDD.
13. **S3 nešla provést.** Sabotáž měla mazat cestu, kterou zná jen test. Nahrazena realistickou („uklidím celý jmenný prostor"), kterou nový test 4a chytá.
14. **S6 sabotovala neexistující stav.** Dnešní controller **žádnou session v paměti nedrží** — `begin()` ji zapíše a zapomene. Přeformulováno na sabotáž, která cache přidává; opraven i očekávaný výpis (discovery je taky fetch).
15. 🆕 **Přidána S8 — sabotáž, o které se dopředu ví, že projde.** Regulární výraz na `ipc-sender-guard.test.js:188` chytá jen kanál zapsaný **řetězcovým literálem**; `ipcMain.handle(AUTH_LOGOUT, …)` projde oběma assertions neviděn. Doloží se jako nález do `DAN-TODO.md`.

**Ověření naostro, které packet nechal jako dohad**

16. ✅ **`revocation_endpoint` v discovery ZMĚŘEN** — `curl` na `labs.ludone.cz` i `app.ludone.cz` vrací `…/api/mcp/oauth/revoke` a `revocation_endpoint_auth_methods_supported: ["none","client_secret_post"]`. Byla to největší neověřená domněnka packetu (a zároveň potvrzuje „bez client secretu" v D-B9-3).
17. ✅ **Brány spuštěny:** lint 0, typecheck 0, test:unit 0 (**77 testů / 9 souborů**), E6 0, E7 0. Packet nespustil nic. Navíc: **E7 dnes NESKIPUJE** živé discovery, ačkoli to packet předpokládal — SKIP je tedy signál změny prostředí, ne normál.
18. ✅ **Skener tajemství z `E7.sh:20` spuštěn nad zkušebním souborem.** Navržené hodnoty `"fake-refresh"` / `"fake-access"` i tělo `token_type_hint=refresh_token` **projdou**; realistické tokeny **padnou**. Varování packetu bylo správné — teď je i změřené.
19. 🆕 **Nález: E7 nemá kanárka a vidí jen snake_case.** Skutečná session používá camelCase `refreshToken`, takže uniklý pravý token v camelCase by E7 **neodhalil**. Do `DAN-TODO.md`, není to soubor B9.

**Chybějící vstupy, které by vykonavatel musel uhádnout**

20. 🔴 **Log `[auth]` v repozitáři NEEXISTUJE** (grep → nula), a přitom po něm živý scénář chtěl, aby ho Dan v terminálu našel. Kanárek hledající něco, co nikdo nepostavil, vždycky skončí „NEMĚŘENO". Přidána §10.6 jako **požadavek na stavbu**.
21. 🔴 **Plán vlastnictví uvnitř `electron/auth.cjs` NEURČUJE** — tabulka `plan.md:117–125` má sloupce jen pro `main.cjs` a `preload.cjs`, přitom tam píše B4, B8 i B9. Packet to prezentoval jako opsané z plánu. Doplněno jako výslovné rozhodnutí D-B9-5.
22. **Enum `reason` neuměl popsat dvě reálná selhání** (nečitelný blob, neúspěšné mazání). Bez nich zbývalo buď zalhat, nebo vyhodit výjimku. Přidány `unreadable-session` a `local-delete-failed` + pravidlo, že `auth:logout` nikdy nerejectuje.
23. **Vynechaná značka `⛔B2`** z `plan.md:79` — odkaz na rozhodnutí „nahrávky jsou majetkem firmy", což je druhý zdroj R12. Doplněno do §2 a §11.
24. **Vynechaný artboard `design/navrh/Cesta.dc.html:180`**, který odhlášení kreslí a nese R13 i R12 doslova. Packet ho minul, protože grepoval „Odhlásit"; artboard používá „Odhlášení". Autor to sám označil za riziko — potvrdilo se.
25. **Vynechaný test předepsaný plánem** — `plan.md:150` žádá jako první test „Po odhlášení není token v `safeStorage` **ani na serveru**". Druhá půlka je v tomhle repozitáři neměřitelná (S1) a musí to být v PR napsané.
26. **Přeložený zdroj pravdy o revoke.** `specs/E6…:37` je prokazatelně zastaralý: v sousedních větách uvádí blob `userData/auth/tokens.enc` (skutečnost: `appData/cz.ludone.desktop/auth/oauth.enc`) a scope `desktop:upload` (kód vynucuje `mcp:read`/`mcp:draft` a jiné odmítne). Jeho tvrzení o revoke je proto **návrh, ne kontrakt** — a otevřená otázka O-B9-1.
27. **Nepřesná citace autority.** Packet přisuzoval `spec.md` větu „chování určuje spec, ne výzkum". Ta tam není; spec říká, že **implementátor rozpor neřeší sám**. Rozpor rozhodl koordinátor (D-B9-4) a je to teď takhle označené.
28. **Nadsazená důvěra v typecheck.** `createRequire(...)("../electron/auth.cjs")` je pro TS `any` a `electron/**` je v `exclude` — typecheck kontrakt `logout()` neověří. Doplněno varování + poznámka, že `no-unused-vars` je nad `tests/**` zapnuté (výjimka platí jen pro `src/**`).

## Co packetu chybí ve spec/plan

- Serverové chování /api/mcp/oauth/revoke: discovery endpoint jsem ZMĚŘIL (existuje na labs i prod, auth metoda 'none' podporovaná), ale co endpoint na volání odpoví a jestli opravdu zneplatní celou rodinu jedním voláním, není v tomhle repozitáři zjistitelné — kód žije v ludone-app. Bez toho je nejistý poměr větví serverRevoked:true vs. reason:'http-<n>'.
- Rozhodnutí, jak má logout hlásit HTTP 4xx odpověď serveru (typicky invalid_grant): spec R17 říká 'pauza, ne selhání' a z pohledu uživatele je odvoláno, ale R13 zakazuje tvrdit 'odvoláno' bez potvrzení. Packet volí konzervativní serverRevoked:false — je to rozhodnutí koordinátora, ne specu, a Dan ho může chtít jinak (O-B9-2).
- Vlastnictví bloků uvnitř electron/auth.cjs: plan.md §2 má tabulku jen pro main.cjs a preload.cjs, přitom do auth.cjs píšou B4, B8 i B9. Museli jsme to rozhodnout v packetu (D-B9-5); plán to neurčuje.
- Kdo a kdy opraví dvě nalezené díry v branách — regulární výraz v tests/ipc-sender-guard.test.js:188 nevidí kanál registrovaný přes konstantu, a scripts/akceptace/E7.sh nemá kanárka a vidí jen snake_case token názvy (skutečný blob používá camelCase refreshToken). Ani jeden soubor B9 nevlastní.
- Jestli má logout zůstat závislý na registration_endpoint přes sdílené discoverEndpoints (server, který přestane nabízet dynamickou registraci, tím rozbije odhlášení), nebo dostat vlastní úzkou funkci za cenu duplikace načítání metadat (O-B9-3).
- Design nemá artboard pro stav 'odvolat se nepodařilo' — approved.json to ani neuvádí mezi openDesignQuestions. Pro B9 to nevadí (nedělá UI), ale UI story ten artboard bude potřebovat a dnes neexistuje.

## 🔴 Co NEBYLO ověřeno v kódu

Skeptik packet přečetl proti kódu, ale tohle zůstalo bez důkazu.
**Než na tom postavíš implementaci, otevři to.**

- Serverovou implementaci revokace. Funkce revokeOauthToken a revokeRefreshFamily ani chování 'zneplatní celou rodinu jedním voláním' jsem NEOTEVŘEL — žijí v repozitáři ludone-app, mimo tenhle strom. Ověřil jsem jen to, že discovery endpoint existuje (curl na labs i prod) a že podporuje auth metodu 'none'. Co vrátí na skutečné volání, nevím.
- Dostupnost DevTools v panelu (krok 4 živého scénáře) a chování panelu s odpojeným DevTools okénkem při LUDONE_E2E=1. Odvodil jsem to z kódu (main.cjs:26, :241-247, :329-334 — shouldHidePanelOnBlur vrací při isTestRun false; Menu.setApplicationMenu se nikde nevolá, devTools se nevypíná), ale na Macu jsem to neviděl.
- Že safeStorage.decryptString funguje tak, jak atrapa v testu předpokládá. Změřil jsem, že se v celém repozitáři NEVOLÁ ani jednou (grep -rn decryptString → nula); tvar atrapy je odvozen z Electron API, ne z použití v tomhle repu.
- Vlastní běh testu tests/logout.test.js — neexistuje, nemohl jsem ho spustit. Očekávané červené výpisy v §13 a §14 jsou PŘEDPOVĚĎ tvaru, ne pozorovaný výstup. Změřil jsem ale baseline (lint 0, typecheck 0, test:unit 0 se 77 testy v 9 souborech, E6 0, E7 0) a chování E7 skeneru nad zkušebním souborem s navrženými fixture hodnotami.
- Že sabotáže S1-S8 dopadnou přesně tak, jak tabulka v §14 předpovídá. Zdroj testů i regulárních výrazů jsem přečetl řádek po řádku a u S4, S5 a S8 dopad odvodil z konkrétního regexu na ipc-sender-guard.test.js:188 — ale žádnou sabotáž jsem neprovedl (zadání je read-only).
- Zda B8 přidá do auth.cjs vlastní funkci pro čtení session. B8 zatím neexistuje; packet na to jen upozorňuje instrukcí 'když už tam je, použij ji'.
- Chování na skutečném macOS Keychainu (krok 7 scénáře, security find-generic-password -s 'LuDone Desktop Safe Storage'). Název služby přebírám ze specs/E6-prihlaseni-a-fronta.md:37, což je dokument, u kterého jsem naopak DOLOŽIL, že je ve dvou sousedních tvrzeních zastaralý.
- Celý docs/ux/cesta-uzivatele-2026-09-01.md (139 řádků, 45 KB) jsem nečetl souvisle — ověřil jsem doslovným čtením citované řádky 23 a 57 a jejich okolí (55-59, 20-27).
- Celý electron/main.cjs (752 řádků) jsem nečetl souvisle. Otevřel jsem :140-200, :195-275, :320-340, :640-752 a zbytek zmapoval cílenými grepy na jména funkcí, registrace IPC a proměnné prostředí. Nahrávací blok :432-639 jsem četl jen přes grep.
- Celý docs/MASTERPLAN.md jsem nečetl — otevřel jsem §9 (:605-655) a sekce Produkční kód / Zákaz změkčení měřidla (:810-860), zbytek zmapoval přes výpis nadpisů a grepy.
- Artboardy v design/canvas/*.dc.html jsem neotevřel jednotlivě. Grepoval jsem ale širším vzorem než původní packet (Odhlás|odhlás|logout|Odvol|odvol) a tím našel design/navrh/Cesta.dc.html:180, který původní packet minul. Že nějaký další artboard kreslí odhlášení pod úplně jiným slovem, vyloučit nemůžu.
