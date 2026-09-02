# OAuth: co přesně založit v app.ludone

> 🔴 **AKTUALIZOVÁNO 2. 9. 2026 po ŽIVÉM MĚŘENÍ.** Původní verze tohohle dokumentu vznikla
> jen ze čtení desktopového kódu a **dvě její obavy se ukázaly jako bezpředmětné**. Opravené
> pasáže jsou označené. Poučení do procesu: než napíšu člověku úkol, mám se podívat i na
> **druhou stranu rozhraní** — ne jen na tu svoji.

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
| **PKCE** | **povinné**, metoda `S256` | `auth.cjs:108` — když discovery nehlásí `S256`, aplikace přihlášení **odmítne** |
| **grant types** | `authorization_code`, `refresh_token` | `auth.cjs:253` |
| **redirect URI** | `http://127.0.0.1:<PORT>/callback` | `auth.cjs:238` |
| **scope** | `mcp:read` | `auth.cjs:915`; `validatedMcpScope` pustí **jen MCP scopy** |
| **resource** | `https://<origin>/api/mcp` | `auth.cjs:916` |

### ✅ Redirect URI: port je náhodný, ale server to UŽ ŘEŠÍ

`server.listen(0, "127.0.0.1")` (`auth.cjs:220`) říká systému „dej mi jakýkoli volný port".
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

Z odpovědi kontroluje (`auth.cjs:98–115`):

- `issuer` **musí přesně odpovídat** origin, na který se ptala — jinak `OAuth discovery
  vrátil jiné issuer`;
- `code_challenge_methods_supported` **musí obsahovat `S256`**;
- **všechny endpointy musí ležet na stejném originu jako issuer** (`auth.cjs:55–64`).
  Autorizační endpoint na `accounts.google.com` a token endpoint na `app.ludone.cz`
  aplikace **odmítne**. Když se přihlašuje přes Google, musí to být app.ludone, kdo
  vystupuje jako OAuth server, a Google být až za ním.

## 3. 🔴 Multi-tenant: tady je tvrdá překážka

Chceš, aby aplikace fungovala i proti instalacím jiných klientů. **Architektura to už
umí — jedna kontrola to ale zakazuje.**

**Dobrá zpráva:** v `auth.cjs` **není zadrátovaná ani jedna adresa serveru**. Issuer je
parametr a endpointy se dohledávají. To je přesně tvar, který multi-tenant potřebuje.

**Špatná zpráva** — `main.cjs:970`:

```js
if (!["app.ludone.cz", "labs.ludone.cz"].includes(issuer.host)) {
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

## 4. Co potřebuju od tebe, seřazeno

1. **Client ID** se stabilní hodnotou pro `https://app.ludone.cz`. Jak přesně ho v tomhle
   systému založit ručně, **zjišťuje běžící Codex audit** — dokud nedoběhne, nic nezakládej.
2. ~~Potvrdit, že server ignoruje port~~ — ✅ **hotovo, změřeno v kódu serveru.**
3. **Rozhodnout multi-tenant A/B/C.** Doporučuju B; do té doby zůstává seznam dvou hostů.

⚠️ **Podezření, které audit ověřuje:** server nabízí jen `mcp:read` a `mcp:draft`. Pokud
neexistuje scope pro **odesílání** nahrávek a naměřeného času, je to skutečný blocker pro
`DSK-F010` — a znamená to serverovou práci, ne desktopovou.

## 5. Co udělám hned, jak přijde client ID

`LUDONE_OAUTH_CLIENT_ID=<hodnota>` → poprvé za celý projekt půjde spustit aplikaci a projít
přihlášením naostro. **Tím se otevře stupeň DEPLOY a první `verified-live` v matici** —
dneska je na nule, protože bez client ID se nedá projít ani první obrazovkou.
