# Autentizace desktopu a hranice uploadu

## Co je a není dnes pokryté

Rozhodnutí D1 určuje OAuth 2.1 s PKCE a loopback redirectem.
Discovery bylo 24. 8. 2026 ověřeno s HTTP 200 v labs prostředí i na `app.ludone.cz`.
Pokus o nové ověření příkazem `curl -sf` v omezeném běhu 25. 8. 2026 skončil
kódem 6 (DNS), proto následující hodnoty označujeme jako měření z 24. 8., ne jako
nově potvrzený stav.

Tehdy discovery uvádělo:

- `code_challenge_methods_supported` bylo přesně `["S256"]`;
- `token_endpoint_auth_methods_supported` obsahovalo `none`;
- `registration_endpoint` existoval a byl otevřený pro dynamickou registraci;
- `scopes_supported` bylo přesně `["mcp:read","mcp:draft"]`;
- autorizační, tokenový, registrační i revokační endpoint ležel pod `/api/mcp/`.

Jde tedy o OAuth server MCP serveru, ne o obecný autorizační server LuDone REST API.
Desktop se touto cestou může přihlásit a zjistit identitu uživatele, ale získaný token
nemá scope pro upload nahrávky.
Dokud se nezvolí a nenasadí jedna z variant níže, odesílání musí zůstat vypnuté.

## Tok OAuth 2.1 + PKCE

1. Desktop otevře lokální HTTP listener výhradně na `127.0.0.1` a nechá operační
   systém vybrat volný port; redirect URI je například `http://127.0.0.1:49152/callback`.
2. Desktop pošle na `registration_endpoint` dynamickou registraci veřejného klienta,
   včetně přesného loopback redirect URI a typu `authorization_code`.
3. Odpověď vrátí `client_id`. Protože endpoint byl otevřený, desktop si jej vyžádá
   sám; nepotřebuje ruční zásah člověka ani distribuovaný `client_secret`.
4. Pro každý pokus desktop kryptograficky náhodně vytvoří `code_verifier` a `state`.
5. Z verifieru vypočte Base64URL otisk SHA-256 jako `code_challenge`.
6. V systémovém prohlížeči otevře autorizační URL s `response_type=code`,
   `client_id`, přesným `redirect_uri`, požadovaným MCP scope, `state`,
   `code_challenge` a `code_challenge_method=S256`.
7. Autorizační server ověří přihlášení a souhlas a přesměruje prohlížeč
   na loopback URI s jednorázovým `code` a `state`.
8. Listener přijme pouze očekávanou cestu, port a první callback, konstantním časem
   porovná `state`, uzavře listener a odmítne callback po vypršení času.
9. Desktop pošle na token endpoint formulář s `grant_type=authorization_code`, kódem,
   `client_id`, totožným `redirect_uri` a původním `code_verifier`.
10. Veřejný klient použije metodu `none`; neposílá secret. Server ověří PKCE S256
    a vydá krátkodobý access token a, pokud je podporován, refresh token.
11. Před vypršením access tokenu desktop použije `grant_type=refresh_token`, `client_id`
    a refresh token. Rotovaný refresh token atomicky nahradí starý.
12. `invalid_grant` znamená odhlášení nebo odvolaný souhlas: fronta zůstane zachována,
    síťové pokusy se pozastaví a uživatel se musí znovu přihlásit.

Redirect na loopback je HTTP pouze na lokální adrese; všechny vzdálené endpointy musí
být HTTPS. Desktop musí validovat issuer z discovery a nikdy nesledovat tokenový endpoint
na cizí origin.

## Chybějící autorizace uploadu

### Varianta A — rozšířit stávající OAuth server

Přidat scope například `desktop:upload` a naučit REST příjem ověřit stejný access token.
Výhodou je jedna identita, jeden consent a standardní refresh/revokace.
Cenou je rozšíření bezpečnostního povrchu MCP autorizačního serveru, nová politika
scope a nutnost důsledného RBAC a company-scope na každé upload routě.

### Varianta B — samostatný REST příjem s vlastní autorizací

Oddělený issuer a audience izoluje upload od MCP.
Cenou je druhá registrace, tokenový životní cyklus, revokace, consent i provozní dohled;
uživatel může skončit se dvěma zdánlivě nesouvisejícími přihlášeními.

### Varianta C — most MCP tokenu na krátkodobý upload token

Most ověří MCP token a vymění ho za token s úzkou audience, scope pouze pro upload,
krátkou platností a vazbou na konkrétního uživatele.
Urychlí experiment a omezí dopad úniku upload tokenu, ale zavádí nestandardní výměnu,
další endpoint, auditní vazbu a pravidla revokace.
Podle D3 smí takový most vzniknout pouze na labs, nikdy jako skrytá produkční zkratka.

Doporučení pro cílové řešení je varianta A, pokud vlastník OAuth potvrdí, že server
má být sdíleným issuerem i pro desktop REST API; zachová jeden životní cyklus identity.
Varianta C je přijatelná jen jako explicitně označený labs experiment.
Variantu B volit jen tehdy, když je oddělení autorizačních domén důležitější než
provozní a uživatelská složitost.
Produkční rozhodnutí ale zatím nepadlo a tento dokument je nenahrazuje.

## Uložení tokenů na macOS

Access i refresh token patří do klíčenky macOS jako položka omezená na identitu aplikace.
Renderer token nikdy nedostane; s tokenem pracuje pouze privilegovaná hlavní vrstva desktopu.
Soubor vedle kódu, manifestu nebo fronty lze přečíst ze zálohy, omylem commitnout nebo
zkopírovat spolu s diagnostikou a nemá ochranu klíčenky ani řízené odstranění.
Odhlášení nejprve zavolá revokaci, potom smaže lokální položky; nahrávky ve frontě
nesmaže a bez nové autorizace je neodesílá.
