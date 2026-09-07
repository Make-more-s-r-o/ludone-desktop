# OAuth: co přesně založit v app.ludone

> 🔴 **AKTUALIZOVÁNO 2. 9. 2026 po ŽIVÉM MĚŘENÍ.** Původní verze tohohle dokumentu vznikla
> jen ze čtení desktopového kódu a **dvě její obavy se ukázaly jako bezpředmětné**. Opravené
> pasáže jsou označené. Poučení do procesu: než napíšu člověku úkol, mám se podívat i na
> **druhou stranu rozhraní** — ne jen na tu svoji.

> ⚠️ **Přeměřeno 7. 9. 2026.** Všechna VĚCNÁ tvrzení níž platí dál — ověřeno proti kódu
> jedno po druhém. Ale **čísla řádků odplula** (nejvíc o 95 řádků) a odkazovala do prázdna;
> jsou opravená. Kdo je bude ověřovat příště, ať se ptá `grep` na obsah, ne na číslo:
> `grep -n "S256\|listen(0\|grant_types\|validatedMcpScope\|api/mcp" electron/auth.cjs`.

**Pro Dana, 2. 9. 2026.** Ptal ses „dej mi vědět, co mám založit, už OAuth mám nějak na
ludone app, můžu rozšířit, nebo nový" — a přidal jsi požadavek, aby aplikace fungovala
i pro **jiné instalace app.ludone pro jiné klienty**.

Všechno níž je **opsané z kódu**, ne z hlavy. Čísla řádků odkazují na `electron/auth.cjs`
a `electron/main.cjs` ve stavu `main` k 2. 9. 2026.

---

## Krátká odpověď

🔴 **NENÍ to Google Console.** `app.ludone.cz` **sám je OAuth server** — tentýž, přes který
se ke tvému MCP konektoru přihlašuje Claude. Kód je v `LuDone/ludone-app`, `src/mcp/oauth/`.
Ověřeno živým dotazem 2. 9. 2026: discovery vrací `HTTP 200`, `S256`, scopy `mcp:read`
a `mcp:draft`, a nabízí i registrační endpoint.

**Založ NOVÝ klient, nerozšiřuj stávající.** Desktop je *veřejný* klient (native app) bez
tajemství — nesmí sdílet registraci s webem, který tajemství má. Kdyby sdílely, únik
z desktopu by kompromitoval i web.

---

## 1. Co registrovat

| položka | hodnota | proč zrovna tahle |
|---|---|---|
| **typ klienta** | `public` (native app), **bez client secret** | desktop nedokáže secret udržet; kdokoli si ho vytáhne z .app balíčku |
| **PKCE** | **povinné**, metoda `S256` | `auth.cjs:112` — když discovery nehlásí `S256`, aplikace přihlášení **odmítne** |
| **grant types** | `authorization_code`, `refresh_token` | `auth.cjs:257` |
| **redirect URI** | `http://127.0.0.1:<PORT>/callback` | `auth.cjs:242` |
| **scope** | `mcp:read` | `auth.cjs:1010`; `validatedMcpScope` pustí **jen MCP scopy** |
| **resource** | `https://<origin>/api/mcp` | `auth.cjs:1011` |

### ✅ Redirect URI: port je náhodný, ale server to UŽ ŘEŠÍ

`server.listen(0, "127.0.0.1")` (`auth.cjs:224`) říká systému „dej mi jakýkoli volný port".
Port se tedy při každém přihlášení liší a **nelze ho zaregistrovat napevno**.

✅ **Změřeno v `ludone-app/src/mcp/oauth/dcr.ts:108–119`: server port u loopbacku odstraňuje
u obou stran, než je porovná.** Registrace `http://127.0.0.1/callback` proto sedne na jakýkoli
port. Původně jsem to psal jako riziko a blocker — **není to ani jedno**.

Zaregistruj obojí, ať pokryješ obě smyčky:

```
http://127.0.0.1/callback
http://[::1]/callback
```

✅ Server uznává `localhost`, `127.0.0.1` i `[::1]` (`dcr.ts:80–87`), a `http` pouští
**jen** u loopbacku (`dcr.ts:102`). Desktop sám používá doslova `127.0.0.1` (`auth.cjs:7`),
takže stačí registrovat ten.

## 2. Co musí server vystavit, jinak přihlášení nezačne

Aplikace si endpointy **nehádá, hledá je**:

```
GET https://<origin>/.well-known/oauth-authorization-server
```

Z odpovědi kontroluje (`auth.cjs:102–119`):

- `issuer` **musí přesně odpovídat** origin, na který se ptala — jinak `OAuth discovery
  vrátil jiné issuer`;
- `code_challenge_methods_supported` **musí obsahovat `S256`**;
- **všechny endpointy musí ležet na stejném originu jako issuer** (`auth.cjs:59–68`).
  Autorizační endpoint na `accounts.google.com` a token endpoint na `app.ludone.cz`
  aplikace **odmítne**. Když se přihlašuje přes Google, musí to být app.ludone, kdo
  vystupuje jako OAuth server, a Google být až za ním.

## 3. 🔴 Multi-tenant: tady je tvrdá překážka

Chceš, aby aplikace fungovala i proti instalacím jiných klientů. **Architektura to už
umí — jedna kontrola to ale zakazuje.**

**Dobrá zpráva:** v `auth.cjs` **není zadrátovaná ani jedna adresa serveru**. Issuer je
parametr a endpointy se dohledávají. To je přesně tvar, který multi-tenant potřebuje.

**Špatná zpráva** — `main.cjs:3002–3024`. Následující ukázka používá symbolické názvy;
přesné dva hostitele určuje neveřejná konfigurace nasazení:

```js
if (![PRODUCTION_HOST, LABS_HOST].includes(issuer.host)) {
  throw new Error("Adresa přihlášení míří na nepovoleného hostitele");
}
```

Instalace jiného klienta (`app.klient.cz`) se odmítne. Ta kontrola tam vznikla správně —
brání tomu, aby podvržená konfigurace poslala token na cizí server. Pro multi-tenant ji ale
nejde jen smazat; musí ji něco nahradit.

### Tři cesty, doporučuju B

| | jak | pro | proti |
|---|---|---|---|
| **A** rozšířit seznam | přidat hosty klientů do kódu | triviální | nový klient = **nový release aplikace** |
| **B** origin zadá správce při instalaci ⭐ | jednorázově, uložený lokálně, aplikace ho pak drží | nový klient bez releasu | musí být vidět, **komu se přihlašuješ** |
| **C** libovolný origin z běhu | bez omezení | nejpružnější | podvržená konfigurace pošle token kamkoli — **nedoporučuju** |

**U varianty B navrhuju tři pojistky:** origin jde zadat **jen při prvním nastavení**, ne
za běhu · před otevřením prohlížeče se ukáže **naplno, na jaký server se přihlašuješ**
· jednou uložený origin se změní jen výslovnou akcí, ne tiše.

🔴 **A hlavně: každá instalace má vlastní OAuth server, tedy VLASTNÍ client ID.** Jedna
proměnná `LUDONE_OAUTH_CLIENT_ID` pro celou aplikaci proto multi-tenant neuveze — client
ID musí být uložené **spolu s originem**, jako dvojice.

**To je změna specu, ne implementační detail** (F003 je `security`), takže ji nedělám sám.

## 4. ✅ JEDEN PŘÍKAZ — audit doběhl, takhle se klient založí

Audit serveru (2. 9. 2026) zjistil, že **admin UI ani seed skript pro OAuth klienty
neexistuje**. Jediné dvě cesty do tabulky `ludata.mcp_oauth_clients` jsou dynamická
registrace (DCR) a CIMD.

**Nejčistší podporovaný postup: udělat DCR JEDNOU ručně a vrácené ID si uložit.**

```bash
curl --fail-with-body \
  -H 'Content-Type: application/json' \
  --data '{
    "client_name": "LuDone Desktop",
    "token_endpoint_auth_method": "none",
    "redirect_uris": ["http://127.0.0.1/callback"],
    "scope": "mcp:read"
  }' \
  https://app.ludone.cz/api/mcp/oauth/register
```

Odpověď `201` obsahuje **trvalé `client_id`**; veřejný klient secret nedostane.

🔴 **`scope` se MUSÍ uvést.** Bez něj DCR zaregistruje `mcp:read mcp:draft`, tedy víc práv,
než desktop potřebuje.

🔴 **Registruj `http://127.0.0.1/callback`, ne `localhost`.** Audit ověřil, že
`127.0.0.1`, `localhost` a `[::1]` **nejsou vzájemně zaměnitelné** — a desktop používá
doslova `127.0.0.1`. (Opravuje to moje dřívější rada registrovat obojí.)

### Proč ne dynamickou registraci pokaždé

**Změřený limit: 20 registrací za hodinu na jednu IP**, klíč `oauth_dcr:<X-Real-IP>`,
pevné okno. Kancelář za jednou NAT adresou ho vyčerpá — rozhodnutí BD-N6 bylo správné
a teď je doložené číslem, ne odhadem.
2. ~~Potvrdit, že server ignoruje port~~ — ✅ **hotovo, změřeno v kódu serveru.**
3. **Rozhodnout multi-tenant A/B/C.** Doporučuju B; do té doby zůstává seznam dvou hostů.

## 🔴 POTVRZENO: scope pro ODESÍLÁNÍ NEEXISTUJE

Server zná **pouze `mcp:read` a `mcp:draft`**. Ani jeden neumožňuje nahrát soubor nebo
zapsat naměřený čas.

⇒ **`DSK-F010` (odeslání na server) je blokovaná na SERVERU, ne na desktopu.** Musí vzniknout
nový scope a endpointy, které nahrávku a časový záznam přijmou. Do té doby může desktop
frontu jen plnit, ne vyprazdňovat — a to je přesně stav, ve kterém dnes je.

⚠️ Audit našel i nesoulad: `mcp:read` **není doslova jen čtení** — dovolí i tři mutace
(mimo jiné odeslat support report), ale obrazovka souhlasu mluví jen o čtení. To je věc
`ludone-app`, ne desktopu; hlásím to jako nález.

✅ **Naše odhlášení je v pořádku.** Audit varuje, že odvolání access tokenu není odhlášení,
protože refresh token přežije. `electron/auth.cjs:622–640` posílá k odvolání **refresh token**,
když ho má — B9 to udělala správně.

## 5. Co udělám hned, jak přijde client ID

`LUDONE_OAUTH_CLIENT_ID=<hodnota>` → poprvé za celý projekt půjde spustit aplikaci a projít
přihlášením naostro. **Tím se otevře stupeň DEPLOY a první `verified-live` v matici** —
dneska je na nule, protože bez client ID se nedá projít ani první obrazovkou.
