# Etapa E7 — LuDone auth, strana desktopu

Worktree: **`/Users/dan/orca/workspaces/ludone-desktop/e7-auth`**, větev `orca/e7-auth`.
Společná pravidla: **přečti si `_spolecne.md` ve stejném adresáři jako tohle zadání.**

## 1. Co se staví
Desktop se umí **skutečně přihlásit** k LuDone přes OAuth 2.1 s PKCE a zná identitu
přihlášeného uživatele. Čistá logika (PKCE, stav, výměna kódu) je oddělená a otestovaná.

## 2. Proč
Rozhodnutí **D1**: přihlášení je **LuDone auth**, ne holý Google ani vlepený bearer token.
Změřeno naostro 24. 8. 2026: `curl` na `.well-known/oauth-authorization-server` vrací
**HTTP 200 na labs i na produkci**, dynamická registrace klienta je otevřená, loopback
redirect povolený, **PKCE S256 povinné**, veřejný klient bez tajemství.

🔴 **A teď to nejdůležitější, co si musíš odnést, jinak etapa skončí lží:**
ten OAuth server patří **MCP serveru, ne obecnému LuDone účtu**. `scopes_supported` je
**`["mcp:read", "mcp:draft"]`** a `registration_endpoint` je `…/api/mcp/oauth/register` —
všechny endpointy leží pod `/api/mcp/`.
⇒ **Token odtud NEMÁ scope, kterým by šlo nahrát nahrávku.**
⇒ **E7 tedy NESMÍ tvrdit, že desktop umí odesílat.** Smí tvrdit jen, že se **přihlásí**
a **zná identitu uživatele**. Most na REST je obsah dokumentace v E8 a podle **D3** se
staví **jen na labs**. Kdekoli budeš psát komentář nebo text, drž tuhle hranici.

## 3. Soubory, které VLASTNÍŠ
SMÍŠ MĚNIT (a jen tyhle):
```
src/lib/oauth.js             (nový — čistá logika, ŽÁDNÝ Electron, ŽÁDNÁ síť)
electron/auth.cjs            (nový — okno, loopback posluchač, úložiště tokenu)
tests/pkce.test.js           (nový)
tests/oauth-state.test.js    (nový)
scripts/akceptace/E7.sh      (nový)
```
NESMÍŠ MĚNIT — ani o řádek:
```
electron/main.cjs            ← 🔴 VÝSLOVNĚ ZAKÁZÁNO (sdílí ho tři jiné etapy)
src/components/Settings.jsx  ← výslovně cizí
ostatní testy a brány · package.json · package-lock.json · .github/**
docs/**  specs/**  dukazy/**  design/  AGENTS.md  ROZHODNUTI.md  PLAN.md  DAN-TODO.md
```
⚠️ `electron/auth.cjs` napiš jako **samostatný modul, který si `main.cjs` teprve někdy
zavolá**. Zapojení do `main.cjs` **NEDĚLEJ** — ten soubor nevlastníš. Do `notes` napiš
přesně jeden řádek, jak se má zapojit, ať to má orchestrátor připravené.

## 4. Pořadí kroků
🔴 **Nejdřív soubory na disk, pak testy, teprve potom odpověď.**

**Krok 1 — `src/lib/oauth.js`** (čistá logika, testovatelná bez sítě i bez Electronu):
- **PKCE**: `code_verifier` (43–128 znaků z povolené abecedy), `code_challenge` =
  base64url(SHA-256(verifier)) **bez zarovnávacích `=`**, `code_challenge_method = "S256"`,
- **`state`**: vygenerování a **ověření při návratu**,
- sestavení autorizační URL a těla požadavku na výměnu kódu,
- 🔴 **náhodnost ber jako povinný argument** (funkce dostane zdroj náhodnosti), ať jde
  v testu determinizovat. Co nesmí mít default, patří do podpisu.

**Krok 2 — `electron/auth.cjs`**: otevření systémového prohlížeče, **loopback** posluchač
na `127.0.0.1` s **náhodným portem**, převzetí `code`, výměna za token, uložení tokenu.
🔴 **Token NIKDY nesmí skončit v repozitáři ani v logu.** Ukládej ho do uživatelských dat
aplikace, ne do pracovního stromu. Do logu piš nanejvýš, že token *je* — ne jeho hodnotu.

**Krok 3 — testy.**
`tests/pkce.test.js`:
- challenge se shoduje s ručně spočítanou base64url(SHA-256(verifier)) pro **známý vstup**
  (napiš si očekávanou hodnotu z `node:crypto`, ne odhadem),
- v challenge **není `=`, `+` ani `/`** (je to base64**url**),
- verifier má délku v povoleném rozsahu a jen povolené znaky,
- 🔴 **dva různé verifiery dají různé challenge** (jinak funkce nic nepočítá).

`tests/oauth-state.test.js`:
- shodný `state` ⇒ **přijato**,
- 🔴 **odlišný `state` ⇒ ODMÍTNUTO** (to je celá obrana proti podvržení),
- 🔴 **chybějící / prázdný / `undefined` state ⇒ ODMÍTNUTO** (fail-closed; „nic" se nesmí
  rovnat „souhlasí"),
- 🔴 **porovnání nesmí projít na prefixu** — `state` `"abc"` proti `"abcdef"` ⇒ odmítnuto.

**Krok 4 — `scripts/akceptace/E7.sh`** ve tvaru PASS/FAIL (vzor `scripts/akceptace/E1b.sh`).
Kontroluje: unit testy `pkce` a `oauth-state` zelené · `src/lib/oauth.js` obsahuje
`code_challenge_method` a `S256` · 🔴 **`git grep` nenajde v repu nic, co vypadá jako
uložený token** (napiš kontrolu, která hledá vzor tokenu, ne konkrétní hodnotu).
🔴 **Kontrolu proti živé službě (`curl` na `.well-known`) do skriptu NEDÁVEJ jako povinnou** —
v sandboxu selže vždycky (DNS, kód 6). Dej ji za podmínku „síť je dostupná", ať skript
funguje i bez sítě, a do výpisu napiš, že se přeskočila. **Živé ověření spustí orchestrátor.**

## 5. Jak to otestuješ
```bash
npm run test:unit -- pkce > /tmp/p.out 2>&1; echo "EXIT=$?"; tail -25 /tmp/p.out
npm run test:unit -- oauth-state > /tmp/o.out 2>&1; echo "EXIT=$?"; tail -25 /tmp/o.out
npm run gates > /tmp/g.out 2>&1; echo "GATES EXIT=$?"; tail -20 /tmp/g.out
bash scripts/akceptace/E7.sh > /tmp/e7.out 2>&1; echo "EXIT=$?"; cat /tmp/e7.out
node --check electron/auth.cjs; echo "syntaxe: $?"
```
⚠️ **Nespouštěj přihlašovací tok** — otevřel by prohlížeč a čekal na člověka.

## 6. Důkaz hotovosti
`npm run gates` = **0**, `bash scripts/akceptace/E7.sh` = **0** s 0× FAIL.
Před odpovědí `git --no-pager status --porcelain` — když tam tvoje soubory nejsou,
**nejsi hotový a nesmíš odpovídat**.

## 7. Co NESMÍŠ (navíc ke společným)
- **tvrdit, že desktop umí odesílat nahrávky** — token na to nemá scope (viz bod 2)
- zapsat token, klíč nebo tajemství do repozitáře nebo do logu
- sáhnout na `electron/main.cjs`
- spustit přihlašovací tok nebo cokoli, co otevře prohlížeč

## 9. Output contract
```json
{
  "summary": "<co jsi udělal>",
  "premisaPlatila": true,
  "ocekavanePocty": {
    "novychTestu": 0,
    "celkemTestuVeSpustenychSouborech": 0,
    "tvrzeniOOdesilaniNahravek": 0,
    "tajemstviVRepu": 0,
    "zmenenychSouboruMimoVlastnictvi": 0
  },
  "dukaz": "<DOSLOVNÝ výpis testů, gates a E7.sh včetně EXIT=>",
  "commitMessage": "<anglicky, imperativ>",
  "notes": ["<jak zapojit auth.cjs do main.cjs — přesně jeden řádek>", "<co nešlo ověřit>"]
}
```
🔴 `novychTestu` **> 0** · `tvrzeniOOdesilaniNahravek`, `tajemstviVRepu`
a `zmenenychSouboruMimoVlastnictvi` musí být **0** — spočítej si je, neodhaduj.
