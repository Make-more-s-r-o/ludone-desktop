# Nezávislé review — etapa E7 (LuDone auth, OAuth 2.1 + PKCE)
Společná pravidla: **přečti si `_review-spolecne.md` ve stejném adresáři.**

## Diff k prohlédnutí
```bash
cd /Users/dan/Dev/ClaudeCode/ludone-desktop
git --no-pager show --stat 3e1a2b7
git --no-pager diff 898aedd^..3e1a2b7 -- src/lib/oauth.js electron/auth.cjs \
  tests/pkce.test.js tests/oauth-state.test.js scripts/akceptace/E7.sh
```

## Na co se dívej především

🔴 **Tvrzení o rozsahu.** Autorizační server patří **MCP serveru**: `scopes_supported`
je `["mcp:read","mcp:draft"]` (ověřeno naostro 25. 8. na labs i produkci). Token odtud
**nemá scope na nahrání nahrávky**. Projdi celý diff včetně komentářů a textů a najdi
**každé místo, kde se tvrdí nebo naznačuje, že desktop umí odesílat nahrávky**. Takové
tvrzení je **P1**, i když je jen v komentáři — je to nepravda, kterou někdo použije.

🔴 **Ověření `state`.** Tohle je celá obrana proti podvržení odpovědi. Ověři **čtením kódu**:
- projde prázdný / chybějící / `undefined` / `null` state? (musí ODMÍTNOUT — fail-closed)
- porovnává se na **shodu**, nebo by prošel **prefix** (`"abc"` proti `"abcdef"`)?
- je porovnání odolné, nebo se dá obejít typem (číslo × řetězec, pole × řetězec)?
🔴 **Zkus obranu obejít z JINÉHO úhlu, než na jaký míří testy.** „Test zčervenal" je
tvrzení o té konkrétní mutaci, ne o obraně. Nejlevnější zkouška: **smaž celé tělo
kontroly** (v hlavě, ne na disku) a zeptej se, které testy by to opravdu chytily.

🔴 **PKCE.** `code_challenge` = base64url(SHA-256(verifier)) **bez `=`**. Ověř, že se
nepoužívá obyčejný base64 (znaky `+` a `/` tam nesmí být). Má verifier dost entropie?
Bere funkce zdroj náhodnosti **jako argument** (aby šel v testu determinizovat), nebo si
ho bere zevnitř — a když zevnitř, dá se to vůbec otestovat?

🔴 **Token a tajemství.** Neuloží se token do repozitáře, do pracovního stromu nebo
do **logu**? Projdi `electron/auth.cjs` a hledej každé místo, kde se token může dostat
do `console.log`, do souboru ve stromě nebo do chybové hlášky.

🔴 **Loopback posluchač.** Poslouchá jen na `127.0.0.1` (ne `0.0.0.0`)? Přijme odpověď
od kohokoli, nebo ověřuje, že jde o jeho vlastní požadavek? Zavře se po použití?

🔴 **Brána `scripts/akceptace/E7.sh`.** U KAŽDÉ kontroly odpověz: *co vrátí, když soubor
neexistuje nebo je prázdný?* Kontrola tvaru `! grep -q X soubor` je nad chybějícím
souborem **fail-open** (přesně tahle vada v repu už jednou byla). A kontrola „v repu není
tajemství" — hledá vzor, nebo konkrétní hodnotu, kterou stačí změnit?
