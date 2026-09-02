# Task packet B8 — OPRAVENÁ VERZE PO ADVERSARIÁLNÍ REVIZI

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


> Zapojit `createAuthController` místo atrapy · vykonavatel **Claude** · Feature ID **DSK-F003**
> Revize proti skutečnému kódu na commitu `0380bc0` (main, čistý strom), 1. 9. 2026.

---

## 🔴 ČTI NEJDŘÍV: dva blokery, které se musí vyřešit PŘED psaním kódu

Tenhle packet **není hotové zadání**. Revize našla dva rozpory, které vykonavatel podle
`spec.md` § *Autorita při rozporu* (řádek 10) a masterplánu §9 (*„Nehádá."*) **nesmí rozhodnout sám**.

### 🛑 BLOKER 1 — B8 by zapojil registraci klienta, kterou rozhodnutí ZAMÍTLO

| Zdroj | Co říká |
|---|---|
| `decisions.md:42` | „**Statická** registrace klienta, ne dynamická \| Jediná varianta odvolatelná jedním UPDATE. **Dnešní kód dělá DCR a vynucuje ji i brána `E7.sh:49` — obojí se musí srovnat**" |
| `electron/auth.cjs:352` | `const clientId = options.clientId ?? await registerPublicClient(...)` — bez `clientId` proběhne **dynamická registrace při KAŽDÉM `begin()`** |
| `docs/ux/cesta-uzivatele-2026-09-01.md` (změřeno) | „desktop dělá dynamickou registraci klienta při KAŽDÉM `begin()`, takže se hromadí consenty nerozlišitelné jménem a **kancelář za jednou NAT IP vyčerpá rate limit 20 registrací za hodinu a přihlášení padne s 429**" |
| `docs/server-modul/autentizace.md:15,28` | discovery 24. 8. mělo `registration_endpoint` otevřený pro DCR; popsaný tok krok 2 je DCR |

**Původní packet to schoval do „chybějících vstupů" větou „To B8 neřeší a nesmí ten řádek změnit."**
To je vada packetu. B8 je *právě to* zapojení — pokud proběhne bez `clientId`, B8 **nasadí do provozu
přesně tu variantu, kterou Dan zamítl**, a to s doloženým 429 po dvaceti přihlášeních z jedné kanceláře.

**Otázka koordinátorovi (nutná odpověď před kódem):**
> Má B8 (a) předat `clientId` z konfigurace a statickou registraci zařídit napřed, (b) vědomě
> zapojit DCR jako dočasný stav s tím, že se `decisions.md` doplní o odklad, nebo (c) počkat,
> až statickou registraci dodá serverová strana (S1)?
> Varianta (a) rozšiřuje rozsah o zdroj `clientId` (další env proměnná — viz Bloker 2).

### 🛑 BLOKER 2 — název proměnné pro issuer je změna kontraktu, ne rozhodnutí packetu

Původní packet rozhodl (P1) o **nové** proměnné `LUDONE_ISSUER`. Revize v kódu našla:

| Zdroj | Co říká |
|---|---|
| `specs/E6-prihlaseni-a-fronta.md` §11 | „konstanta `LUDONE_ORIGIN` (default `https://app.ludone.cz`, **přebít jen proměnnou prostředí `LUDONE_ORIGIN`** pro labs)" + jediná funkce `apiFetch` pro každý odchozí požadavek |
| `E7.sh:45-46` | jediná živá brána v repu dotazuje **labs prostředí**, ne `app.ludone.cz` |
| `tests/oauth-state.test.js:45,51,54` | jediné existující OAuth testy používají **origin labs prostředí** |
| `electron/main.cjs:683` | atrapa otevírá natvrdo `https://app.ludone.cz` |

Zavést vedle `LUDONE_ORIGIN` druhou proměnnou pro **tentýž origin** je přesně to, co masterplán §9
zakazuje: *„změnit API/datový kontrakt bez aktualizace plánu"*. Navíc žádné měření v repu neprošlo
OAuth tok proti `app.ludone.cz` — jen discovery HTTP 200 z 24. 8. (`docs/server-modul/autentizace.md:6`).

**Otázka koordinátorovi:** `LUDONE_ORIGIN` (existující konvence z E6 §11), nebo `LUDONE_ISSUER`
(nový název)? A je výchozí hodnota `app.ludone.cz`, když všechna živá evidence v repu míří na `labs`?

> Do zodpovězení obou otázek **nepiš produkční kód**. TDD kroky 1–5 a 7 (§13) jdou napsat už teď —
> jsou na názvu proměnné nezávislé. Krok 6 na odpovědi visí.

---

## 1. Plan ID a Plan SHA

| | |
|---|---|
| **Plan ID** | `desktop-v1` — `docs/changes/desktop-v1/plan.md` (**ZMRAZENO 1. 9. 2026**) |
| **Plan SHA** | `c7b1bb715f87f53ca0a209d5d3b96e6018e1e437` ✅ **ověřeno** `git log -1 --format=%H -- docs/changes/desktop-v1/plan.md` |
| **Spec SHA** | `1e9709779e94a654a0c3c959d260082d42801acc` ✅ **ověřeno** |
| **Design SHA** | `26a06abd2ff8449cd74862ca3df7fb36f2db0005` ✅ **ověřeno**; `design/` **je** verzované v gitu (`git ls-files design/` vrací 20 souborů) |
| Základ revize | `0380bc0` „Note that the design artifact is gone…", strom čistý |

🔴 **Spec i plán jsou zmrazené.** Rozpor ⇒ **needituj je**, zastav se a vrať otázku koordinátorovi
(`spec.md:10` § *Autorita při rozporu*, masterplán §9 poslední věta). **Tenhle packet už dva takové
rozpory nese — viz blokery výš.**

## 2. Task ID

**B8** — `Use the real auth controller instead of the stub` ✅ ověřeno v `plan.md` §2b, řádek B8.

## 3. Feature ID

**`DSK-F003`** — „Přihlášení OAuth 2.1 + PKCE, loopback", riziko **security** ✅ `spec.md:80`.

Stav dnes (`spec.md` §3): `scope: approved` · `delivery: coded ²` · `exposure: disabled` · `verification: unverified`
Stav po B8: `scope: approved` · `delivery: pr-open` · `exposure: disabled` · `verification: tests-green`

🔴 **`verified-live` se nesmí napsat, dokud přihlášení někdo neviděl na Macu** (`plan.md` §2b).
🔴 **A ani `verified-live` by neznamenalo „F003 hotová"** — viz §8, spec má pro F003 přejímací
scénář, který B8 splnit **nemůže**.

## 4. Cíl story

`createAuthController` existuje, je otestovaná okolo (PKCE, state) a **nikdo ji nevolá**.
✅ Doloženo v tomhle review naostro:

- `electron/auth.cjs:325` definice · `electron/auth.cjs:502` export;
- `grep -rn "createAuthController" --include="*.cjs" --include="*.js" --include="*.mjs" --include="*.jsx" .` (bez `node_modules`) vrací **přesně dva řádky, oba v `auth.cjs`** (325 a 502). Mimo `auth.cjs` **nula**;
- `electron/main.cjs:681-692` místo ní vrací atrapu (**pozor: blok končí na 692, ne 691**):

```js
handleValidated("auth:begin", ["panel"], async () => {          // 681
  if (process.env.LUDONE_OPEN_AUTH_BROWSER === "1") {           // 682
    await shell.openExternal("https://app.ludone.cz");          // 683
  }                                                             // 684
  await new Promise((resolve) => setTimeout(resolve, 650));     // 685
  return {                                                      // 686
    ok: true,                                                   // 687
    callback: "ludone://auth/callback?code=demo-code",           // 688
    token: "mock-token-not-persisted",                          // 689
    user: { name: "Daniel Novák", email: "daniel@ludone.cz" },   // 690
  };                                                            // 691
});                                                             // 692
```

**Cíl:** kanál `auth:begin` provede skutečný OAuth 2.1 + PKCE S256 tok přes `createAuthController`,
uloží session přes `safeStorage` a vrátí do panelu **jen identitu**, nikdy token. Rozsah je
zapojení + fail-closed konfigurace + bezpečný tvar chyby. **Nic víc.**

**Co B8 NENÍ:** obnova tokenu (F005) · odhlášení a revokace (F004 / B9) · UI odpočtu a Zrušit (B4)
· sdílené zařízení (B10) · fronta (B7) · scope pro upload (S1) · **statická registrace klienta
(Bloker 1, nerozhodnuto)** · **překlad `duvod` na obrazovky (dnes není kam — viz §5)**.

## 5. User-visible chování

🔴 **OPRAVA PROTI PŮVODNÍMU PACKETU — tady se lhalo nejvíc.**

Skutečný stav rendereru, `src/components/Onboarding.jsx:40-52` (přečteno v tomhle review):

```js
async function beginAuth() {
  setAuthBusy(true);
  setAuthError("");
  try {
    const result = await window.ludone.beginAuth();                       // :44
    if (!result?.ok) throw new Error("Přihlášení se nevrátilo do aplikace."); // :45
    onAuthenticated(result.user);                                          // :46
    setStep(2);
  } catch (error) {
    setAuthError(error.message);                                           // :50
  } finally { setAuthBusy(false); }
}
```

**Z toho plynou tři fakta, která původní packet popřel:**

1. 🔴 **`duvod` se ZAHODÍ.** `{ ok:false, duvod:"vyprselo" }` se v panelu zobrazí jako
   **„Přihlášení se nevrátilo do aplikace."** — stejně jako `bez-site`, `konfigurace` i `uloziste`.
   Původní packet tvrdil „tvar je zpětně kompatibilní a **renderer se nemusí měnit**". Kompatibilní
   je, ale **kódy jsou mrtvá data**, dokud je nezapojí jiná story. To musí být v PR napsané naplno.
2. 🔴 **Věta „panel řekne českou větu bez odborných slov" NENÍ zásluha B8** — je to napevno zadaný
   literál v `Onboarding.jsx:45`, který tam byl před B8 a bude i po něm.
3. ✅ **Riziko úniku technického textu je ale SKUTEČNÉ**: `catch` na řádku 49-50 dělá
   `setAuthError(error.message)` a `Onboarding.jsx:176` to vykreslí do `<p className="error-note" role="alert">`.
   Když handler **vyhodí** místo aby vrátil objekt, technická věta se do panelu dostane.
   ⛔ **Neověřeno:** přesný prefix, kterým Electron 37.3.1 obaluje odmítnutí z `ipcMain.handle`
   (očekává se `Error invoking remote method 'auth:begin': …`). Závěr stojí na četbě `Onboarding.jsx:49-50`,
   ne na měření. **Na rozhodnutí to nic nemění** — původní text je v `error.message` tak či tak.

Cesta, kterou člověk projde:

1. Krok **Přihlášení** s tlačítkem **„Přihlásit v prohlížeči"** — `Onboarding.jsx:174`
   (blok tlačítka 168-175). ⚠️ Design má **jiný text** na dvou místech, viz §6.
2. Klik otevře výchozí prohlížeč na autorizační adresu skutečného issueru.
3. Prohlížeč ukáže „Hotovo, vraťte se do LuDone Desktop." ✅ `auth.cjs:168` (ne 168? — **ověřeno: přesně 168**).
   B8 tu stránku **nepředělává**.
4. ⚠️ **„Aplikace se přepne dopředu sama"** — viz §12.3, rozhodnutí P3. **Dnes to neumí nikdo:**
   `grep -n "app.focus\|steal" electron/main.cjs` → **nula výskytů**.
5. Při neúspěchu panel ukáže **„Přihlášení se nevrátilo do aplikace."** a jde zkusit znovu.
   Bod 1 výš říká, proč to není víc.

⚠️ **Nález mimo B8, který si implementátor musí přečíst, aby se nelekl při živé zkoušce:**
`src/App.jsx:9` má `const DEFAULT_USER = { name: "Daniel Novák", email: "daniel@ludone.cz" }` a
`App.jsx:15` ho dosadí pokaždé, když je onboarding v `localStorage` označený za dokončený
(`initiallyComplete ? DEFAULT_USER : null`). ✅ Ověřeno v kódu. Obnova session z disku v aplikaci
**neexistuje** (žádný `auth:status`, žádný `auth:restore`). **To NENÍ B8** — hlásí se koordinátorovi
a živé ověření se dělá s `LUDONE_RESET_ONBOARDING=1` (`preload.cjs:6` tu proměnnou skutečně čte).

## 6. Odkaz na schválený Claude Design artefakt

| Co | Kde | Stav ověření |
|---|---|---|
| Schválení | `design/approved.json` — `status: approved`, `approvedBy: Dan`, `approvedAt: 2026-09-01`, `approvedDirection: strong-fit` | ✅ přečteno |
| Náhled | `design/navrh/nahled.html`, oddíl **„01 — První spuštění"** (řádek 197) | ✅ přečteno |
| Artboard | `design/canvas/Prihlaseni.dc.html` | ✅ **v této revizi OTEVŘENO** (původní packet přiznal, že ne) |
| Rozcestník | `docs/changes/desktop-v1/artifacts/design/design-manifest.md` | ✅ soubor existuje |
| Bydliště designu | rozhodnutí **O10** (`decisions.md:121`) — design zůstává v `design/` | ✅ ověřeno |

### 🔴 Co artboard obsahuje a co z toho plyne (původní packet to neviděl)

**a) Artboard uvádí o uložení tokenu NEPRAVDU.** Doslova:
> „Token bydlí v Klíčence, ne v localStorage."

To je v rozporu se změřeným `docs/ux/cesta-uzivatele-2026-09-01.md`:
> „`safeStorage` **neukládá token do klíčenky** — do Keychainu jde jen šifrovací klíč, samotný token leží jako šifrovaný soubor."

⇒ **B8 implementuje změřené chování** (`persistEncryptedSession`, `auth.cjs:296-323`: šifrovaný
soubor `oauth.enc`, klíč v Keychainu), **ne větu z artboardu.** Kdo se bude řídit artboardem,
postaví špatnou věc. **Nález patří do PR jako design-compliance odchylka** (Pass 6) — artboard
se přitom **needituje**, `design/` je cizí práce.

**b) Artboard má PĚT stavů, jiných než ty, které původní packet vypsal z `nahled.html`:**
`auth.idle` · `auth.browser-wait` · `auth.cancelled` („Přihlášení se nedokončilo") ·
`auth.state-mismatch` („Odpověď nesouhlasí") · `auth.other-account` („Přihlášen jiný účet").
`auth.state-mismatch` ani `auth.other-account` v `nahled.html` **nejsou**. Původní packet uváděl
„Vypršelo · Účet nemá přístup · Bez sítě" — ty jsou z náhledu. **Obě sady patří B4, ne B8**, ale
B4 by měl vědět, že jsou dvě různé a nesouhlasí spolu.

**c) Tlačítko má tři různé texty** — artboard „Přihlásit se" · `nahled.html:211` „Přihlásit přes
app.ludone.cz" · kód `Onboarding.jsx:174` „Přihlásit v prohlížeči". **B8 to nemůže srovnat**
(`src/**` je zakázané, §12.2) — jen to nahlásí.

**d) Artboard potvrzuje výchozí stav:** „Dnešní kód je 650ms atrapa" ⇒ sedí s `main.cjs:685`.

🔴 **`design/` je cizí práce — B8 na ni NESAHÁ** (`AGENTS.md:66`: *„`design/` je samostatná, cizí
práce; bez výslovného vlastnictví na ni nesahej"*; `plan.md` §4 to opakuje jako zákaz pro noční běh).

Z designu B8 plní **nejvýš jednu věc: skutečnou identitu místo `Daniel Novák`.** Přepnutí dopředu
je otevřená otázka (P3, §12.3). Odpočet, „Zrušit", zobrazená adresa a chybové obrazovky jsou **B4**.

## 7. Relevantní výřez EXPERIENCE.md

🔴 **`EXPERIENCE.md` v tomhle repozitáři NEEXISTUJE** (masterplán §3 ho předepisuje).
Jeho roli hraje **`docs/ux/cesta-uzivatele-2026-09-01.md`**. ⛔ **Nepřečten celý** (44 KB) — v této
revizi čtena sekce „Přihlášení očima uživatele" (jeden dlouhý odstavec) a momenty M06, M08, M09,
M10, M28, M30. Doslovné citace, ověřené znak po znaku:

**Odchod a návrat (M06, M09):**
> „Klik otevře výchozí prohlížeč na app.ludone.cz." · „Aplikace se dopředu nedostane sama: musí zavolat `app.focus({steal:true})`, znovu otevřít panel a ukázat „Přihlášeno jako <e-mail>"." · „kartu programově NEZAVÍRAT, `window.close()` na stránce, kterou neotevřel skript, prohlížeč zablokuje."

**Uložení:**
> „`safeStorage` neukládá token do klíčenky — do Keychainu jde jen šifrovací klíč, samotný token leží jako šifrovaný soubor." · „Když šifrování není k dispozici, token se NEUKLÁDÁ vůbec a panel řekne pravdu: „Přihlášení platí jen do zavření aplikace." Nikdy plaintext." · „Async varianty `safeStorage` v Electronu 37.3.1 NEEXISTUJÍ (grep vrací nulu)."

**Chybové stavy (M08, největší díra):**
> „do aplikace se vrací JEN odmítnutí souhlasu (`access_denied`). Vypršelá žádost, nesedící iniciátor, nepovolený účet i `invalid_origin` končí `failLocally`, tedy stránkou v prohlížeči — v panelu to vypadá identicky s tím, že uživatel odešel od počítače."

**Časy (M10) — story B4, ne B8:**
> „server drží žádost 10 minut (`PENDING_TTL_MS`), desktop zavírá listener po 5 (`DEFAULT_TIMEOUT_MS`, `auth.cjs:9`)… Sjednotit na 10 minut + rezerva."

**🔴 Vada, kterou původní packet z tohoto dokumentu VYNECHAL a která patří přímo k Blokeru 1:**
> „desktop dělá **dynamickou registraci klienta při KAŽDÉM `begin()`**, takže se hromadí consenty nerozlišitelné jménem a kancelář za jednou NAT IP **vyčerpá rate limit 20 registrací za hodinu a přihlášení padne s 429**"

**Vada, kterou B8 nesmí zavléct zpátky (M06):**
> „Panel se navíc při ztrátě fokusu schová — `shouldHidePanelOnBlur` má výjimku jen pro `permissionPromptsInFlight` a `settingsVisible`, pro běžící OAuth žádnou. Chybí čítač `authFlowInFlight` po vzoru commitu `04e87fc`."

✅ Ověřeno v kódu: `main.cjs:241-246` — `shouldHidePanelOnBlur({ isTestRun, permissionPromptsInFlight, settingsVisible })`, žádný `authFlowInFlight`.
🔴 **Ten čítač dodává B4.** B8 na `shouldHidePanelOnBlur` **nesahá** (§12).

## 8. Relevantní business pravidla

### 8.1 🔴 Přejímací scénář pro DSK-F003 — původní packet ho VYNECHAL

`spec.md:253-255`, doslova:

> **`DSK-F003` vypršelé přihlášení řekne důvod**
> Given přihlášení otevřené déle než 10 minut · When se vrátím · Then panel **řekne, že vypršelo**,
> a nabídne „Zkusit znovu" — **ne mlčí**.

**Po B8 tenhle scénář stále NEPROJDE**, a to ze dvou nezávislých důvodů:

| Proč | Doklad | Kdo to opraví |
|---|---|---|
| Panel `duvod` nezobrazuje — vždy „Přihlášení se nevrátilo do aplikace." | `Onboarding.jsx:45` | ⛔ **nikdo — žádná story to nevlastní** |
| Listener zavírá po 5 minutách, ne po 10 | `auth.cjs:9` `DEFAULT_TIMEOUT_MS = 5 * 60 * 1000` | **B4** |

🔴 **To MUSÍ být v PR napsané.** F003 se posune na `tests-green`, ale **jeho jediný přejímací
scénář zůstává nesplněný** a nikdo nevlastní zobrazení důvodu v panelu. **Otázka koordinátorovi:
kdo dodá napojení `duvod` → text v panelu?** (kandidát B4, ale `plan.md` §2b mu dává jen
„časy 5↔10 min · panel nemizí · čekání má konec").

### 8.2 Pravidla z `spec.md` §4 a §2

| Pravidlo | Doslovné znění (`spec.md:161-167`) | Co z něj plyne pro B8 |
|---|---|---|
| **R12** | „Odhlášení **nesmí smazat frontu**." | B8 na frontu nesahá (`electron/queue.cjs`, `src/lib/queue.js` mimo rozsah) |
| **R13** | „Odhlášení odvolá přístup **nejdřív na serveru**, teprve pak smaže lokálně." | **B9.** B8 odhlášení neimplementuje |
| **R14** | „Vypršelý token se během nahrávání **neprojeví nijak** — zvuk jde na disk." | *(interpretace, ne text pravidla)* `auth:begin` se spouští **jen z výslovné akce uživatele**. Žádné automatické volání, žádné otevření prohlížeče na pozadí, žádný modál |
| **R15** | „Obnova tokenu je **jednovláknová**. Dva souběžné pokusy odhlásí uživatele „sám od sebe"." | B8 obnovu **nepřidává** (F005) |
| **R16** | „`403` a „uzavřený týden" jsou **trvalé** chyby: neopakovat, data zachovat, říct důvod." | Chyba přihlášení se **neopakuje automaticky**; žádná retry smyčka |
| **R17** | „`invalid_grant` je **pauza**, ne selhání — nespotřebovává pokusy." | Fronta (B7) — B8 se nedotýká |
| **R18** | „**Dva samostatné vypínače** (C2): `DESKTOP_UPLOAD_ENABLED` a `DESKTOP_TIME_ENABLED`. Oba fail-closed." | 🔴 B8 **žádný neflipuje**. ⚠️ **Měřeno: `.env.example` obsahuje JEN `DESKTOP_UPLOAD_ENABLED=false`; `DESKTOP_TIME_ENABLED` v kódu ani v env souborech NEEXISTUJE** — žije jen v dokumentech |
| **§1 role** | „v1 vidí každý **jen své vlastní** záznamy; **admin vidí vše**" (`plan.md` §1) | Desktop o právech **nerozhoduje** |
| **§7 copy** | „Nikdy „MCP", „scope", „token" v textu, který vidí uživatel." ✅ `spec.md` §7 | Testovatelné — ale **jen na hranici IPC**, ne v panelu (§5 bod 1) |
| **spec §3 pozn. ²** | „token scope jen `mcp:read` a `mcp:draft` (`auth.cjs:14`), tedy **nemůže zapisovat**" | 🔴 B8 **nevymýšlí nový scope**. `validatedMcpScope` (`auth.cjs:55-62`) cokoli jiného odmítne |

**Money:** B8 nepočítá peníze a nic nezapisuje. Platí mantinel z Architecture Spine
(`plan.md` §1): **zápis do Tabidoo přímo z desktopu je zakázaný za všech okolností**;
**klient nikdy neposílá sazbu**.

## 9. Relevantní Architecture Spine invarianty

`plan.md` §1, doslovně (✅ ověřeno v souboru):

| Modul | Vlastní | Nesmí |
|---|---|---|
| `electron/main.cjs` | okno, tray, IPC, životní cyklus | rozhodovat o stavu podle rendereru |
| `electron/auth.cjs` | přihlášení, obnova, odvolání | **ukládat token jinam než přes `safeStorage`** |
| `src/**` (renderer) | **jen zobrazení** | držet stav, který musí přežít pád |

- 🔴 „**Stav, který musí přežít pád rendereru, vlastní hlavní proces. Renderer hlásí fakta,
  neurčuje stav.**" ⇒ session žije v hlavním procesu a na disku, **nikdy v `useState`**, a
  **token nikdy neputuje přes IPC do rendereru**.
- **Kontrakty:** identita projektu je GUID, nikdy název (B8 se netýká, nesmí ji rozbít).
- **RBAC:** „Default-deny na třech osách. Desktop **žádnou z nich nevyhodnocuje sám**." ⇒ žádná
  větev typu „tenhle účet je admin".
- **Serverová strana není v rozsahu (S1).**
- **Rollback:** „Každá story je samostatně revertovatelná. Žádná migrace v1."
- `AGENTS.md:54`: přihlášení, tokeny, idempotence fronty a **kontrola odesílatele IPC** jsou
  money/security kód a vyžadují review nad diffem.

Invarianty v kódu, které musí zůstat beze změny (✅ všechny ověřeny čtením):

| Invariant | Místo | Co dělá |
|---|---|---|
| `handleValidated(channel, allowedKinds, handler)` | `main.cjs:151-156` | volá `requireTrustedSender(event, allowedKinds)` **před** handlerem; `auth:begin` je `["panel"]` |
| `tokenStorageDirectory(app)` | `auth.cjs:284-294` | **hodí výjimku**, když by úložiště leželo uvnitř repozitáře (`isPathInside` + `physicalPotentialPath` na obou stranách symlinku) |
| `persistEncryptedSession` | `auth.cjs:296-299` | selže, když `safeStorage.isEncryptionAvailable()` vrátí falsy. **Fail-closed, nikdy plaintext** |
| `trustedRemoteEndpoint` | `auth.cjs:41-53` | jen HTTPS, jen origin issueru, bez username/password/hash |
| loopback listener | `auth.cjs:117-201` | jen `GET`, jen správný `Host`, jen cesta `/callback`, jen první callback (`settled`), `state` konstantním časem |

## 10. Vstupní a výstupní rozhraní

### 10.1 IPC `auth:begin`

| | Dnes (atrapa) | Po B8 |
|---|---|---|
| Registrace | `handleValidated("auth:begin", ["panel"], …)` `main.cjs:681` | **beze změny** |
| Preload | `beginAuth: () => ipcRenderer.invoke("auth:begin")` ✅ `preload.cjs:8` | **beze změny** |
| Úspěch | `{ ok, callback, token, user }` | `{ ok: true, user: { name, email } }` — **přesně tyhle dva klíče** |
| Neúspěch | prakticky nenastane (`ok` je vždy `true`) | `{ ok: false, duvod: "<kód>" }` — **nikdy výjimka s technickým textem** |

**Kódy důvodu:** `vyprselo` · `odmitnuto` · `bez-site` · `konfigurace` · `uloziste` · `neznama`.

🔴 **Kódy jsou dnes MRTVÁ DATA** — `Onboarding.jsx:45` je zahodí (§5). Zavádějí se pro budoucí
napojení; PR to musí říct, jinak vypadají jako dodaná funkce.

🔴 **Mapování musí vycházet ze SKUTEČNÝCH vět, které `auth.cjs` hází** (ověřeno čtením zdrojáku):

| Skutečná výjimka | Kde | Kód |
|---|---|---|
| „Přihlášení se v časovém limitu nevrátilo" | `auth.cjs:198` | `vyprselo` |
| „OAuth odmítl přihlášení: `access_denied`" / „Chybí autorizační kód" | `auth.cjs:161` | `odmitnuto` |
| „OAuth issuer musí být čistá HTTPS adresa" · „E7 se smí autorizovat jen k MCP resource issueru" · „E7 smí žádat jen MCP scopy…" · „Chybí Electron app, safeStorage nebo shell" | `auth.cjs:36`, `339`, `60`, `338` | `konfigurace` |
| „Bezpečné úložiště systému není dostupné…" · „…cílové úložiště leží uvnitř repozitáře" | `auth.cjs:298`, `291` | `uloziste` |
| `TypeError` z `fetch` (síť), `net::ERR_*` | runtime | `bez-site` |
| cokoli ostatní, včetně „LuDone nevrátilo úplnou identitu uživatele" (`auth.cjs:229`) | — | `neznama` |

⚠️ **Mapování podle textu výjimky je křehké.** Když B4 znění vět změní, mapování tiše spadne na
`neznama`. **Otevřená otázka:** má `auth.cjs` dostat strojově čitelné kódy (např. `error.code`)?
To by ale byla editace `auth.cjs`, tedy hřiště B4/B9 — **rozhodne koordinátor**.

### 10.2 `createAuthController(options)` — `auth.cjs:325`

```js
createAuthController({
  issuer,                   // POVINNÉ; auth.cjs:326 → normalizedIssuer() — HÁZÍ SYNCHRONNĚ
  app, safeStorage, shell,  // POVINNÉ; auth.cjs:336-338 — HÁZÍ SYNCHRONNĚ
  scope,                    // volitelné, default "mcp:read"; auth.cjs:327 → validatedMcpScope() — HÁZÍ SYNCHRONNĚ
  resource,                 // volitelné, MUSÍ být `${issuer}/api/mcp`; auth.cjs:339-341 — HÁZÍ SYNCHRONNĚ
  timeoutMs,                // volitelné, default DEFAULT_TIMEOUT_MS = 5 min (auth.cjs:9)
  clientId,                 // volitelné; když chybí → DYNAMICKÁ REGISTRACE (auth.cjs:352) ← BLOKER 1
  fetchImpl, randomSource,  // volitelné, pro testy
  identityEndpoint | resolveIdentity, // volitelné; jinak identita z odpovědi tokenu (auth.cjs:234-250)
}) // → { begin(): Promise<{ ok: true, user: { name, email } }> }
```

🔴 **NEJDŮLEŽITĚJŠÍ NÁLEZ REVIZE V TOMHLE POLI:**
**`createAuthController(...)` hází SYNCHRONNĚ, ve FACTORY, ne v `begin()`.**
Řádky 326, 327, 336-338 a 339-341 běží při konstrukci. Původní packet to nikde neuvedl a jeho
TDD krok 5 to testoval **na špatném místě** (viz §13, krok 5b). Praktický důsledek:

```js
// ❌ ŠPATNĚ — projde krokem 5 původního packetu a přesto pustí technický text do panelu
const controller = createAuthController({ issuer, app, safeStorage, shell });
try { return await controller.begin(); } catch (e) { return { ok:false, duvod: prelozit(e) }; }

// ✅ SPRÁVNĚ — try obepíná i konstrukci
try {
  const controller = createAuthController({ issuer, app, safeStorage, shell });
  return await controller.begin();
} catch (e) { return { ok:false, duvod: prelozit(e) }; }
```

Ironie: **věta, kterou původní packet použil jako příklad („E7 se smí autorizovat jen k MCP resource
issueru"), pochází z `auth.cjs:340` — tedy z factory.** Jeho vlastní test ji chytit nemohl.

🔴 **`timeoutMs` NEPŘEDÁVEJ** — sjednocení 5↔10 min je B4 v `DEFAULT_TIMEOUT_MS`.
🔴 **`scope` NEPŘEDÁVEJ** — nech default `"mcp:read"`.
🔴 **`resource` NEPŘEDÁVEJ** — default `${issuer}/api/mcp` je jediná přípustná hodnota (`auth.cjs:328-329`).
🛑 **`clientId` — NEROZHODNUTO, viz Bloker 1.**

### 10.3 Perzistence (dělá `auth.cjs`, B8 ji jen spouští)

`${app.getPath("appData")}/cz.ludone.desktop/auth/oauth.enc`; adresář `0700`, soubor `0600`;
zápis `tmp` (`open` s `wx`) + `fsync` + `rename` + `fsync` adresáře (`auth.cjs:296-323`).
Obsah: `safeStorage.encryptString(JSON.stringify({ v:1, issuer, clientId, resource, scope,
accessToken, refreshToken, tokenType, accessExpiresAt, identity }))` (`auth.cjs:395-411`).

⚠️ **Změřeno v této revizi:** `configureWritablePaths()` (`main.cjs:170-190`) přemapovává
`userData`, `sessionData`, `cache`, `crashDumps`, `temp` — **`appData` NE**. Token se tedy
i pod `LUDONE_DATA_DIR` ukládá do skutečného uživatelského profilu. ⇒ **automatizovaný běh nesmí
projít skutečným přihlášením** (§12.3, P2).

### 10.4 Síť

- Discovery `GET ${issuer}/.well-known/oauth-authorization-server`; `auth.cjs:83` navíc kontroluje,
  že `metadata.issuer` po normalizaci **sedí** na požadovaný issuer.
- Autorizace / token / registrace: jen HTTPS, jen origin issueru (`trustedRemoteEndpoint`).
- Redirect `http://127.0.0.1:<efemérní port>/callback` (`server.listen(0)`).
- ⛔ **Neověřeno živě.** `docs/server-modul/autentizace.md:6-16` uvádí měření z **24. 8. 2026**
  (HTTP 200 na labs i app; `code_challenge_methods_supported === ["S256"]`;
  `scopes_supported === ["mcp:read","mcp:draft"]`; `registration_endpoint` otevřený pro DCR).
  Tentýž dokument (řádky 7-9) sám říká, že pokus o **nové** ověření 25. 8. skončil `curl 6` (DNS),
  takže to je **měření z 24. 8., ne potvrzený současný stav**. V této revizi žádný síťový
  požadavek neproběhl.

## 11. Dependencies

| | |
|---|---|
| **Závisí na** | **B4** (Tři vady přihlášení) — `plan.md` §2 DAG. Bez B4 se panel při odchodu do prohlížeče schová a čekání nemá konec ⇒ **živé ověření B8 nejde spolehlivě provést** |
| **Stav B4** | 🔴 **ZMĚŘENO: B4 NENÍ hotová.** `git branch -a` na `0380bc0` má jen `main`, `feat/kostra-appky`, `feat/zvuk-dukaz`, `fix/tray-prazdna-ikona` (+ `origin/docs/plan-2026-08-24`). Žádná B4 větev; `shouldHidePanelOnBlur` (`main.cjs:241`) stále nemá `authFlowInFlight` a `DEFAULT_TIMEOUT_MS` je stále 5 min. Původní packet ji uváděl jako předpoklad **bez ověření** |
| **Blokuje** | **B9** (odhlášení s odvoláním) — bez skutečné session není co odvolat |
| **Pořadí** | Třetí vlna: „B6 · B7 (obě po B5) · **B8 (po B4)**" ✅ `plan.md` §2b |
| **Soubězi** | B6 a B7 ve stejné vlně, sahají do **jiných bloků** `main.cjs` ⇒ §12 je závazný výčtem |
| ⚠️ Zrušený zákaz | `docs/behy/2026-09-01-nocni-beh-zadani.md:89`: „🔴 **Nezapojuj `createAuthController`.** Ten je součástí etapy E6 a čeká na rozhodnutí N1 (kam desktop píše)." ✅ Ověřeno. **Zmrazený `plan.md` ho přebíjí** — B8 JE to zapojení, a N1 je rozhodnuté (`intent.md:90`: „Dan rozhodl: **zatím nikam**, později přes `app.ludone.cz`"), navíc se týká **zápisu hodin**, ne přihlášení |

## 12. Přesné soubory

### 12.1 Vlastnictví bloků — opsáno doslova z `plan.md` §2 (✅ ověřeno)

> 🔴 **Původní rozvržení bylo špatně a Codexovo vytěžení to odhalilo.** Devět z dvanácti stories
> sahá do `electron/main.cjs`, osm do `electron/preload.cjs`.

| Story | Vlastní v `main.cjs` | Vlastní v `preload.cjs` |
|---|---|---|
| **B3** | `trayIconName`, `updateTray`, `deriveTrayState`, registrace tray | odebrat `setTrayState` |
| **B4** | `shouldHidePanelOnBlur` a jeho čítače | nic |
| **B5** | registrace `tracking:*`, hook na pád rendereru | přidat `tracking:*` |
| **B7** | zapojení fronty, `queue:*` kanály | přidat `queue:*` |
| **B8** | **`auth:begin` a jeho okolí** | **`beginAuth`** |
| **B9** | `auth:logout` | přidat `logout` |
| **B11** | nic | nic |

> 🔴 **Task packet musí vlastnictví zadat VÝČTEM, ne větou „nesahej na cizí".**

### 12.2 Filtr pro každou jednotlivou editaci

**SMÍM sáhnout jen sem** (řádky ověřené v této revizi):

| Soubor | Přesný blok | Řádky dnes |
|---|---|---|
| `electron/main.cjs` | destrukturovaný `require("electron")` — **přidat `safeStorage`** (dnes tam **není**, ověřeno) | **1–14** |
| `electron/main.cjs` | `const { createPermissionRequestHandler } = require("./auth.cjs");` → přidat `createAuthController` | **19** |
| `electron/main.cjs` | **nová** `function resolveAuthIssuer(env)` — těsně nad registrací | ~680 |
| `electron/main.cjs` | **nová** `function createAuthBeginHandler(createAuthController)` — tamtéž | ~680 |
| `electron/main.cjs` | tělo `handleValidated("auth:begin", ["panel"], …)` | **681–692** ⚠️ (ne 681–691) |
| `electron/preload.cjs` | `beginAuth: () => ipcRenderer.invoke("auth:begin"),` — **beze změny** | **8** |
| `tests/auth-controller-wiring.test.js` | **nový soubor**, vlastní B8 | — |
| `scripts/akceptace/E7.sh` | **jen přidání** na konec, nikdy oslabení ⚠️ **soubor NENÍ v `plan.md` §2b pro B8** — vědomá odchylka, do PR | — |

🔴 **Dvě tvrdá omezení pro obě nové funkce** (plynou z toho, jak testy vytahují zdroj):

1. **Musí být `function` deklarace, ne `const … = () =>`.** `functionSource`
   (`tests/panel-blur-guard.test.js:8`) hledá doslova `function <jméno>(`. Šipková funkce
   skončí `Error: Funkce … nebyla nalezena` — což vypadá jako správná červená, ale není.
2. **Nesmějí sahat na modulový scope `main.cjs`** (`shell`, `app`, `safeStorage`, `IS_TEST_RUN`,
   `panelWindow`). V `Function()` sandboxu neexistují ⇒ `ReferenceError`. Všechno přijde parametrem.

**NESMÍM sáhnout:**

- `electron/auth.cjs` — 🔴 **cíl je nula změn.** `plan.md` §2b ho u B8 uvádí, ale celý soubor je
  hřištěm **B4** (`DEFAULT_TIMEOUT_MS:9`, chybové stavy) a **B9** (revoke). Když se změně
  nevyhneš, jen vnitřek `createAuthController` (325–418), nikdy polovinu s oprávněními
  (**420–499**, ověřeno), a napiš to do PR jako vědomou odchylku.
- `shouldHidePanelOnBlur` (**241–246**), `permissionPromptsInFlight` (**237**, **332**, a také
  **696/700** uvnitř `permission:request`) → **B4** *(původní packet uváděl 230-246 a 326-338 —
  přibližně; skutečná místa jsou tato)*.
- `trayImage`, `updateTray`, `trayIconName`, `traySvg`, registrace tray → **B3**.
- `recording:*`, `finalizeRecordingSession*`, `createRecordingSession` → cizí, hotové.
- `tracking:*` → **B5** · `queue:*`, `electron/queue.cjs`, `src/lib/queue.js` → **B7** · `auth:logout` → **B9**.
- `src/**` — celý renderer, zvlášť `src/components/Onboarding.jsx` a `src/App.jsx`.
- `design/**` — cizí práce (`AGENTS.md:66`).
- `docs/changes/desktop-v1/spec.md` a `plan.md` — **ZMRAZENO**.
- `scripts/ui-smoke.mjs` → **B1**.

**Očekávaný `git diff --stat`:** `electron/main.cjs` (~60 ř.) · `tests/auth-controller-wiring.test.js`
(nový) · volitelně `scripts/akceptace/E7.sh`. ⚠️ Odhad `plan.md` §2b je **~110 řádků diffu bez testů**;
číslo „~60 v main.cjs" je **odhad, nepřepočítaný**. Přes ~250 se PR dělí.

⚠️ **Konflikt na řádcích 1–19 je očekávaný a triviální** — víc stories tam přidává importy.
Řeší se sloučením obou seznamů, nikdy přepsáním cizího.

### 12.3 Rozhodnutí a otevřené otázky přijaté / vrácené v tomhle packetu

**P1 — odkud se bere issuer → 🛑 VRÁCENO JAKO OTÁZKA (Bloker 2).** Původní packet to rozhodl sám;
revize ukázala, že to koliduje s `specs/E6…:73` (`LUDONE_ORIGIN`) a že výchozí hodnota
`app.ludone.cz` nemá v repu žádnou oporu v měření OAuth toku. **Nerozhoduj — zeptej se.**
Nezávisle na názvu platí: **jen čistá HTTPS adresa bez uživatele, hesla, dotazu a fragmentu;
cokoli jiného je `konfigurace` a NEODEŠLE SE ŽÁDNÝ SÍŤOVÝ POŽADAVEK.** Tuhle část testuj hned.

**P2 — co dělá `auth:begin` pod testovacím během.** ✅ Důvod potvrzen: `scripts/ui-smoke.mjs:297`
klikne „Přihlásit v prohlížeči" a `:298` hned čeká „Aby LuDone pomohlo"; se skutečným tokem by běh
visel do timeoutu a psal do skutečného profilu (§10.3). `createAuthBeginHandler` dostane
`isTestRun` **parametrem** a pod ním vrátí pevnou zkušební identitu bez sítě a bez prohlížeče.

🔴 **BEZPEČNOSTNÍ OPRAVA, kterou původní packet neměl.** `main.cjs:26` je
`const IS_TEST_RUN = process.env.LUDONE_E2E === "1";` a **`app.isPackaged` se v repu nevyskytuje
ani jednou.** Doslova jak to původní packet napsal, by **kdokoli mohl spustit podepsaný build
s `LUDONE_E2E=1` a dostat `{ok:true, user:…}` bez jakéhokoli přihlášení.** V security story je
to nejnebezpečnější řádek celého packetu a **žádná ze sabotáží S1–S7 ho nechytala.**

⇒ **Závazné:** testovací větev se smí použít **jen když platí obojí** —
`process.env.LUDONE_E2E === "1"` **A** `app.isPackaged !== true`. Příznak se do handleru předává
jako **jedna už vyhodnocená hodnota**, a **test S8 to zamyká z obou stran** (§13 krok 4c, §14 S8).

**P3 — kdo přepne aplikaci dopředu → 🛑 OTEVŘENÁ OTÁZKA.** `nahled.html:258` slibuje
„Aplikace se sama přepne dopředu a ukáže, kdo jsi." a `cesta-uzivatele` M09 říká, že to jde
jen přes `app.focus({steal:true})` + znovuotevření panelu. **Změřeno: `app.focus` ani `steal`
nejsou v `main.cjs` nikde**, a §12.2 to B8 nedovoluje přidat mimo `auth:begin`.
**Otázka:** patří `app.focus({steal:true})` + `panelWindow.show()` do „`auth:begin` a jeho okolí"
(tedy B8), nebo je to B4 / vlastní story? **Dokud to není rozhodnuté, krok A5 živého ověření
NELZE považovat za kritérium B8** a musí být v PR označený jako neaplikovatelný, ne jako selhání.

## 13. TDD kroky

Masterplán §13 (řádky 810-818): failing test → **ověř správný důvod selhání** → minimální řešení →
GREEN → širší brány. Poměr dle `plan.md` §3 bod 4: **2–3 červené : 1 zelená.** ✅ ověřeno.

Soubor: **`tests/auth-controller-wiring.test.js`**. ✅ `vitest.config.js` má
`environment: "node"`, `include: ["tests/**/*.test.js"]`.

Pomocník `functionSource(source, name)` **zkopíruj z `tests/panel-blur-guard.test.js:7-37`** ✅ —
ta verze umí destrukturovaný parametr (komentář v souboru to vysvětluje), verze z
`tray-authority.test.js` ne. Vzor injektáže přes `Function(...)` je `tests/ipc-sender-guard.test.js:23-56` ✅.

> 🔴 **VŠECHNY „červené výpisy" níž jsou OČEKÁVANÉ TVARY, odvozené z formátu vitest a ze
> skutečného obsahu souborů — NE zachycený výstup skutečného běhu.** V této revizi ani v původním
> packetu neběžel jediný test (zadání bylo read-only). **Implementátor do PR zapíše to, co uvidí ON.**
> Kde se tvar liší, platí jeho výpis, ne tenhle.

### Krok 1 — RED: atrapa je pryč, kanárek drží

```js
const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");

it("KANÁREK: auth:begin je pořád registrovaný přes handleValidated s ['panel']", () => {
  expect(mainSource).toMatch(/handleValidated\(\s*"auth:begin",\s*\["panel"\]/);
});

it("produkční auth:begin nevrací atrapu", () => {
  expect(mainSource.split("mock-token-not-persisted").length - 1).toBe(0);
  expect(mainSource.split("Daniel Novák").length - 1).toBe(0);
});
```

Očekávaný tvar červené (kanárek je přitom **zelený** — důkaz, že hledá na správném místě):

```
 FAIL  tests/auth-controller-wiring.test.js > produkční auth:begin nevrací atrapu
AssertionError: expected 1 to be +0 // Object.is equality
```

🔴 **Počítej výskyty, ne `toContain`** — `not.toContain` vysype celý ~25 kB soubor do výpisu.

⚠️ **PŘIZNANÁ SLABINA tohoto kroku (původní packet ji zamlčel):** test je splnitelný pouhým
**přejmenováním literálů** — nech atrapu a napiš `token: "demo"`, `name: "Jan Novák"` a je zeleno.
Skutečnou práci měří až **krok 3**. Proto je v §14 sabotáž **S8**, která tuhle hranici doloží.

### Krok 2 — RED: funkce ještě neexistují

```js
const createAuthBeginHandler = Function(
  "createAuthController",
  `"use strict";
   ${functionSource(mainSource, "resolveAuthIssuer")}
   ${functionSource(mainSource, "createAuthBeginHandler")}
   return createAuthBeginHandler;`,
);
```

Očekávaný tvar: `Error: Funkce resolveAuthIssuer nebyla nalezena` — ✅ přesně tuhle větu hodí
`panel-blur-guard.test.js:9`. Správný důvod: funkce v produkčním kódu ještě není.

### Krok 3 — RED, který měří chování, ne existenci

Přidej do `main.cjs` obě funkce, ale **nech je zatím vracet dnešní atrapu**.

```js
it("auth:begin vrací identitu ze skutečného controlleru", async () => {
  const volani = [];
  const handler = createAuthBeginHandler((options) => {
    volani.push(options);
    return { async begin() {
      return { ok: true, user: { name: "Zkušební Účet", email: "zkouska@makemore.cz" } };
    } };
  })({ app: fakeApp, safeStorage: fakeSafeStorage, shell: fakeShell, env: {}, isTestRun: false });

  const vysledek = await handler();
  expect(volani).toHaveLength(1);
  expect(volani[0].issuer).toMatch(/^https:\/\//);
  expect(volani[0].timeoutMs).toBeUndefined();   // B4 vlastní DEFAULT_TIMEOUT_MS
  expect(volani[0].scope).toBeUndefined();       // default z auth.cjs
  expect(volani[0].resource).toBeUndefined();    // default ${issuer}/api/mcp
  expect(vysledek).toEqual({ ok: true, user: { name: "Zkušební Účet", email: "zkouska@makemore.cz" } });
});
```

Očekávaný tvar (a tenhle je ten důležitý):
`AssertionError: expected [] to have a length of 1 but got +0` ⇒ controller se **nezavolal ani jednou**.

### Krok 4 — RED: tvar odpovědi a testovací větev

**4a — z IPC neodejde token ani callback**

```js
expect(Object.keys(await handler()).sort()).toEqual(["ok", "user"]);
```
Očekávaný tvar nad atrapou z kroku 3:
`AssertionError: expected [ 'callback', 'ok', 'token', 'user' ] to deeply equal [ 'ok', 'user' ]`

**4b — pod testovacím během se nesáhne na síť ani na prohlížeč**

```js
const handlerE2E = createAuthBeginHandler(() => { throw new Error("controller se pod E2E volat nesmí"); })(
  { app: fakeApp, safeStorage: fakeSafeStorage, shell: fakeShell, env: {}, isTestRun: true },
);
expect((await handlerE2E()).ok).toBe(true);
expect(fakeShell.openExternal).not.toHaveBeenCalled();
```

**4c — 🔴 NOVÝ, bez něj je P2 zadní vrátka do produkce**

```js
it("v zabaleném buildu se testovací větev NEPOUŽIJE ani s LUDONE_E2E=1", async () => {
  const volani = [];
  const handler = createAuthBeginHandler((o) => { volani.push(o); return { async begin() {
    return { ok: true, user: { name: "Skutečný", email: "skutecny@makemore.cz" } }; } }; })(
    { app: { ...fakeApp, isPackaged: true }, safeStorage: fakeSafeStorage, shell: fakeShell,
      env: { LUDONE_E2E: "1" }, isTestRun: true },
  );
  expect((await handler()).user.email).toBe("skutecny@makemore.cz");
  expect(volani).toHaveLength(1);   // controller SE MUSÍ zavolat
});
```

**4d — s `isTestRun:false` se testovací větev nepoužije** (identita z kroku 3).

### Krok 5 — RED: k uživateli se nedostane odborné slovo

**5a — výjimka z `begin()`**

```js
const handlerChyba = createAuthBeginHandler(() => ({
  async begin() { throw new Error("E7 se smí autorizovat jen k MCP resource issueru; scope mcp:read, token nevydán"); },
}))({ app: fakeApp, safeStorage: fakeSafeStorage, shell: fakeShell, env: {}, isTestRun: false });

const v = await handlerChyba();
expect(v.ok).toBe(false);
expect(JSON.stringify(v)).not.toMatch(/MCP|scope|token/i);
```

**5b — 🔴 NOVÝ A DŮLEŽITĚJŠÍ: výjimka z FACTORY** (§10.2 — `auth.cjs:326-341` hází synchronně)

```js
it("technická výjimka z konstrukce controlleru se taky přeloží", async () => {
  const handlerFactory = createAuthBeginHandler(() => {
    throw new Error("E7 se smí autorizovat jen k MCP resource issueru");
  })({ app: fakeApp, safeStorage: fakeSafeStorage, shell: fakeShell, env: {}, isTestRun: false });
  const v = await handlerFactory();
  expect(v.ok).toBe(false);
  expect(JSON.stringify(v)).not.toMatch(/MCP|scope|token/i);
});
```

Bez 5b projde implementace, která má `createAuthController(...)` **mimo** `try` — a přesně tu větu
z příkladu (`auth.cjs:340`) pustí do panelu. Očekávaný tvar červené u obou:
`AssertionError: promise rejected "Error: E7 se smí autorizovat jen k MCP…" instead of resolving`

**5c — 🔴 NOVÝ: mapování kódů, aby `neznama` neprošlo na všechno** (§10.1 tabulka)

```js
it.each([
  ["Přihlášení se v časovém limitu nevrátilo", "vyprselo"],
  ["OAuth odmítl přihlášení: access_denied", "odmitnuto"],
  ["Bezpečné úložiště systému není dostupné; přihlašovací údaje se neuložily", "uloziste"],
  ["OAuth issuer musí být čistá HTTPS adresa", "konfigurace"],
])("výjimku %s přeloží na %s", async (zprava, kod) => { … expect(v.duvod).toBe(kod); });
```

Bez tohohle testu projde implementace, která vrací `neznama` na úplně všechno — a kódy z §10.1
jsou pak dvakrát mrtvé: nikdo je nezobrazuje (§5) **a** nikdo je neměří.

### Krok 6 — RED: fail-closed konfigurace 🛑 *(druhá polovina čeká na Bloker 2)*

```js
it.each(["http://app.ludone.cz", "https://app.ludone.cz?x=1", "https://a:b@app.ludone.cz",
         "https://app.ludone.cz#x", "ludone.cz", ""])(
  "nedůvěryhodný issuer %s neodešle nic a vrátí důvod konfigurace", async (hodnota) => {
    … expect(vysledek.duvod).toBe("konfigurace");
    expect(fakeShell.openExternal).not.toHaveBeenCalled();
  },
);
```

🛑 **Druhý test („výchozí issuer je …") NEPIŠ, dokud Bloker 2 není rozhodnutý.** Přišpendlit
`https://app.ludone.cz` teď by znamenalo, že packet rozhodl kontrakt sám — přesně to, co
masterplán §9 zakazuje.

### Krok 7 — musí zůstat ZELENÉ (poměr 2–3 : 1)

`tests/permissions.test.js` · `ipc-sender-guard.test.js` · `pkce.test.js` · `oauth-state.test.js` ·
`panel-blur-guard.test.js` · `tray-authority.test.js` · `queue.test.js` · `manifest.test.js` ·
`recording-order-guard.test.js` — ✅ všech devět souborů ověřeno, že existují. **Beze změny a zelené.**
Zčervená-li kterýkoli, sáhl jsi do cizího bloku. Kanárek z kroku 1 je zelený **před i po**.

### Krok 8 — doporučené: plný tok proti falešnému serveru

`createAuthController` jde otestovat celý v procesu: `fetchImpl` vrátí discovery + registraci +
token; `shell.openExternal` z předané URL vyzobne `redirect_uri` a `state` a **sám udělá `GET`
na loopback** s `?code=…&state=…`; `app.getPath("appData")` ukáže do `os.tmpdir()`
(🔴 **mimo repozitář** — jinak `tokenStorageDirectory`, `auth.cjs:284-294`, správně hodí výjimku);
`safeStorage` je dvojice `isEncryptionAvailable()/encryptString()`.
Ověř: vrácenou identitu · zapsaný `oauth.enc` s `0600` · že **`encryptString` dostal řetězec
obsahující token, ale IPC odpověď ne**.

## 14. Sabotážní testy

Postup dle `scripts/akceptace/E2-sabotaze.sh` (✅ přečteno, řádky 1-30): **napřed ověř, že
nedotčená brána je zelená** (funkce `zelena_brana`, jinak `STOP`), pak jedna mutace, pak
`npm run test:unit`, pak `git checkout -- <soubor>` a znovu zelená. Na konci **`git diff HEAD`
prázdný**.

| # | Co rozbít | Která brána musí zčervenat | Poznámka |
|---|---|---|---|
| **S1** | Vrať `token: "mock-token-not-persisted"` do odpovědi | krok 1 + krok 4a | dva různé důkazy téhož |
| **S2** | Přejmenuj kanál na `auth:start` (v `main.cjs` i `preload.cjs`) | **kanárek** kroku 1 | důkaz, že grep není fail-open |
| **S3** | Změň `["panel"]` na `["panel", "settings"]` | kanárek kroku 1 | ✅ ověřeno, že regex `\["panel"\]` tuhle podobu **nematchne** — okno Nastavení nesmí umět spustit přihlášení |
| **S4** | Smaž kontrolu protokolu v `resolveAuthIssuer` (pusť `http://`) | krok 6 | ⚠️ **Očekávaný výpis původního packetu byl VYMYŠLENÝ.** Fake controller v testu `http://` přijme a vrátí `ok:true` ⇒ `duvod` je `undefined`, takže vitest napíše `expected undefined to be "konfigurace"`, **ne** `expected "neznama" to be "konfigurace"`. Červená to je, výpis byl smyšlený |
| **S5** | Vrať výjimku z `begin()` rovnou ven | krok 5a | `promise rejected … instead of resolving` |
| **S5b** | 🔴 **NOVÁ** — přesuň `createAuthController(...)` **mimo** `try` | **krok 5b** | tuhle vadu původní packet nechytal vůbec (§10.2) |
| **S5c** | 🔴 **NOVÁ** — vrať `neznama` na všechno | **krok 5c** | jinak jsou kódy z §10.1 neměřené |
| **S6** | Otoč podmínku testovací větve (`if (!isTestRun)`) | krok 4b + 4d | `Error: controller se pod E2E volat nesmí` na jedné straně, chybějící identita na druhé |
| **S6b** | 🔴 **NOVÁ** — smaž podmínku `app.isPackaged !== true` | **krok 4c** | **nejdůležitější sabotáž celého packetu** — bez ní je P2 falešné přihlášení v produkci |
| **S8** | 🔴 **NOVÁ, přiznávací** — nech atrapu, jen přejmenuj literály (`token: "demo"`, `name: "Jan Novák"`) | **krok 1 musí ZŮSTAT ZELENÝ, krok 3 MUSÍ zčervenat** | jediný poctivý způsob, jak ukázat, které měřidlo doopravdy měří |
| **S7** | *(zrušena)* — „změň default issueru na labs" | — | 🛑 test, který ji chytal, se nepíše, dokud není rozhodnutý Bloker 2 |

🔴 **Sabotáž, kterou brána nechytí, je důkaz, že brána neměří.** Projde-li některá zeleně,
**nedopisuj kód — doplň test** a napiš to do PR. Zakázané „opravy" (masterplán §824-834):
oslabit assertion · smazat test · přidat baseline · `--force` · vypnout workflow · `[skip ci]`.
**Po třetím neúspěšném opravném kole zastav** a vrať přesný blocker s důkazy.

### 🔴 Vědomá slepá místa, která tyhle sabotáže NEPOKRÝVAJÍ — patří do PR

1. **`ui-smoke` o přihlášení po B8 neměří nic** (P2). ✅ Ověřeno: `ui-smoke.mjs:297-298`.
2. **Žádný unit test nesahá na skutečný `auth.cjs`.** Všechny injektují fake `createAuthController`.
   Kdyby handler stavěl options ve špatném tvaru, celá sada zůstane zelená. **Jediné, co spojení
   s realitou hlídá, je grep v `E7.sh` a `npm run build`.** ⇒ **doporučeno přidat levný smoke test:**
   `expect(typeof require("../electron/auth.cjs").createAuthController).toBe("function")`
   \+ `expect(mainSource).toMatch(/require\("\.\/auth\.cjs"\)/)` a že destrukturovaný seznam obsahuje `createAuthController`.
3. **Skutečná odpověď issueru na discovery / registraci / token je neověřená** — brání se jí
   jen `trustedRemoteEndpoint` (`auth.cjs:41-53`) a kontrola `metadata.issuer` (`auth.cjs:83`).
4. **Cesta k identitě je proti skutečnému serveru neověřená.** `DAN-TODO.md` §3b bod 5 doslova:
   *„Výchozí cesta k identitě uživatele v `electron/auth.cjs` hledá jméno a e-mail přímo v odpovědi
   s tokenem. Proti skutečnému LuDone endpointu to podle reviewera neprojde."* ✅ ověřeno;
   kód je `resolveUserIdentity` `auth.cjs:234-250` + `normalizeIdentity` `auth.cjs:224-232`.
5. **Dynamická registrace (Bloker 1) není pokrytá žádnou bránou** — a je to změřená vada s 429.

## 15. Projektové brány

Spusť **v tomhle pořadí** a ulož **doslovný výpis a exit kód**.
`AGENTS.md:45`: *„Stav příkazu měř před případnou rourou. Na macOS nepoužívej příkaz `timeout`."*

| # | Příkaz | Požadavek |
|---|---|---|
| 1 | `npm run lint` (= `eslint .`) | EXIT=0 |
| 2 | `npm run typecheck` (= `tsc --noEmit -p jsconfig.json`) | EXIT=0 |
| 3 | `npm run test:unit` (= `vitest run`) | EXIT=0, **nula skipnutých** v novém souboru |
| 4 | `npm run build` (= `vite build`) | EXIT=0 |
| 5 | `bash scripts/akceptace/E7.sh` | `chyb: 0`. Živé discovery smí být jen **SKIP** s `curl 6`; jiný stav = FAIL |
| 6 | `bash scripts/akceptace/E6.sh` | `chyb: 0` — hlídá `createPermissionRequestHandler` (E6.sh:18-23), tedy druhou polovinu `auth.cjs` |
| 7 | `npm run gates` (= lint && typecheck && test:unit) | EXIT=0 |

✅ Všech sedm příkazů ověřeno v `package.json` a v souborech skriptů.

⛔ **`node scripts/ui-smoke.mjs` a `npm run test:audio` v sandboxu ani v CI neběží.**
B8 mění cestu, kterou `ui-smoke` proklikává ⇒ **musí se pustit ručně**, postup v §16.

⚠️ **Dvě věci o `E7.sh`, které původní packet přehlédl:**

1. 🔴 **Živé discovery v `E7.sh:45-46` cílí do labs prostředí, ne na `app.ludone.cz`.**
   Jediná síťová brána v repu tedy o výchozím issueru z P1 **neříká nic**. Přímo souvisí s Blokerem 2.
2. `zkontroluj` na řádcích 39-40 pouští `npm run test:unit -- pkce` a `-- oauth-state`, tedy
   **filtrovaně**. Nový soubor `auth-controller-wiring` **E7 nespustí** — pokrývá ho až brána 3/7.

🔴 **Brány se posilují, nikdy neoslabují.** Doporučené přidání na konec `E7.sh`
(**opraveno oproti původnímu packetu**):

```bash
zapojeny_auth_controller() {
  grep -Fq "createAuthController" electron/main.cjs \
    && grep -Eq 'handleValidated\([[:space:]]*"auth:begin",[[:space:]]*\["panel"\]' electron/main.cjs \
    && test "$(grep -c "mock-token-not-persisted" electron/main.cjs || true)" -eq 0
}
zkontroluj "produkční auth:begin používá skutečný createAuthController" zapojeny_auth_controller
```

🔴 **Proč `[[:space:]]` a ne `\s`:** `\s` v `grep -E` je rozšíření GNU. Na tomhle stroji `grep`
rozhodl `ugrep 7.8.4` a `\s` **matchne** (ověřeno naostro), stejně jako GNU grep v CI. Na stroji
se stock BSD `/usr/bin/grep` by ale pattern **nikdy nematchnul** a brána by byla trvale červená —
a doložená historie tohohle repa říká, co se s trvale červenou bránou dělá. `[[:space:]]` je
ověřeno, že matchne taky.

⚠️ **`E7.sh:47-51` vyžaduje, aby živé discovery mělo `registration_endpoint`** — tedy **vynucuje
dynamickou registraci**, proti `decisions.md:42`. To je **součást Blokeru 1**, ne poznámka
pod čarou. B8 ten řádek **nemění**.

## 16. Live-verification scénář

Pro **člověka u Macu** (macOS 26.4, Electron 37.3.1). Bez tohohle průchodu smí PR tvrdit nejvýš
🧪 **zelené testy**, nikdy ✅ ověřeno naostro.

**Předpoklady**

1. 🔴 **B4 je mergovaný.** ⚠️ **K dnešku NENÍ** (§11). Bez něj se panel při odchodu do prohlížeče
   schová a krok A4/A5 se nedá pozorovat.
2. 🛑 **Bloker 1 a 2 zodpovězené.** Bez toho není co pouštět.
3. `ps aux | grep "[l]udone-desktop.*Electron"` je **prázdné**. Osiřelá instance tiše zabije
   každou další — `main.cjs:197-199` `app.requestSingleInstanceLock()` → `app.quit()`, bez hlášky.
4. `npm run build`.
5. Účet s povoleným přístupem v LuDone.

**Průchod A — šťastná cesta**

| Krok | Co udělat | Co musí nastat |
|---|---|---|
| A1 | `LUDONE_RESET_ONBOARDING=1 npm start` | Ikona v liště, klik otevře panel |
| A2 | „Začít" → **„Přihlásit v prohlížeči"** (text z `Onboarding.jsx:174`) | Otevře se **výchozí prohlížeč** na autorizační URL |
| A3 | Zkontroluj parametry v adresním řádku | `response_type=code` · `code_challenge_method=S256` · `state=` · `redirect_uri=http://127.0.0.1:<port>/callback` · `resource=<issuer>/api/mcp` |
| A4 | Potvrdit souhlas | Prohlížeč: **„Hotovo, vraťte se do LuDone Desktop."** (`auth.cjs:168`) |
| A5 | Nesahat na myš 3 s | 🛑 **NENÍ kritérium B8, dokud není rozhodnuté P3** (§12.3). `app.focus({steal:true})` v `main.cjs` neexistuje. Když se appka nepřepne, zapiš to jako **očekávaný stav**, ne jako selhání |
| A6 | Otevři panel ručně | Panel ukáže **tvoje** jméno a e-mail — 🔴 když je tam „Daniel Novák", běží pořád atrapa **nebo** `DEFAULT_USER` z `App.jsx:9` (rozliš: po `LUDONE_RESET_ONBOARDING=1` může být jen atrapa) |

**Průchod B — chybová cesta**

| Krok | Co udělat | Co musí nastat |
|---|---|---|
| B1 | Spusť s nedosažitelným issuerem *(proměnná dle Blokeru 2)*, klik na přihlášení | Panel ukáže větu **„Přihlášení se nevrátilo do aplikace."** (⚠️ **ne** větu o vypršení — `Onboarding.jsx:45`, viz §5). Prohlížeč **se neotevře** |
| B2 | Spusť s `http://…` issuerem, klik | Totéž, a **nula síťových požadavků** — fail-closed |
| B3 | 🔴 **NOVÝ** — spusť **zabalený** build (`release/…/MacOS/Electron`) s `LUDONE_E2E=1` bez přihlášení | 🔴 **NESMÍ se přihlásit.** Musí se otevřít prohlížeč / vrátit chyba. Když se objeví identita, je to **zadní vrátka z P2** a PR se nesmí mergovat |

**Průchod C — `ui-smoke` nesmí zůstat rozbitý**

```bash
LUDONE_E2E=1 LUDONE_RESET_ONBOARDING=1 LUDONE_DATA_DIR=$(mktemp -d) \
  "release/LuDone Desktop.app/Contents/MacOS/Electron" --remote-debugging-port=9333 &
node scripts/ui-smoke.mjs
```
Musí projít za „Aby LuDone pomohlo" (`ui-smoke.mjs:298`) a **nesmí otevřít prohlížeč**.
`node scripts/ui-smoke.mjs` sám aplikaci nespouští — bez běžící instance vrátí
`Timeout: nenalezen CDP target`, což vypadá jako rozbitá appka.

### 🔴 Kanárci — bez nich je výsledek ⛔ NEMĚŘENO, ne ✅

`spec.md` §11: *„Grep, který nenajde ani kanárka, je rozbitý grep — ne důkaz čistoty."*

| Kontrola | Kanárek (MUSÍ být NALEZEN) | Teprve pak negativní část | Bez kanárka |
|---|---|---|---|
| **K1 · log** | Ve stdout je `[auth] Přihlášení zahájeno` — **implementátor ho musí do handleru přidat** | stdout **neobsahuje** `access_token`, `refresh_token`, `Bearer `, `mock-token` | ⛔ NEMĚŘENO |
| **K2 · session** | `ls -l "$HOME/Library/Application Support/cz.ludone.desktop/auth/oauth.enc"` → existuje, neprázdný, práva `-rw-------` | `LC_ALL=C grep -c "access_token" <soubor>` → `0`; `file <soubor>` **není** ASCII text | ⛔ NEMĚŘENO — „token v plaintextu jsem nenašel" nad neexistujícím souborem neznamená nic |
| **K3 · panel** | 🔴 **PŘEPSÁN.** Původní znění („objeví se chybová věta bez MCP/scope/token") **NEMOHLO selhat**: ta věta je napevno zadaný literál v `Onboarding.jsx:45`. Nový kanárek: **v průchodu B se v panelu objeví `role="alert"`** (`Onboarding.jsx:176`) a **zároveň je v logu hlavního procesu vidět `{ ok: false, duvod: "<kód>" }`** | ten log **neobsahuje** „MCP", „scope", „token", `http://127.0.0.1` ani číslo portu | ⛔ NEMĚŘENO |
| **K4 · adresa** | V A3 jsi **našel** `code_challenge_method=S256` | a **nenašel** `client_secret` | ⛔ NEMĚŘENO |
| **K5 · registrace** 🔴 NOVÝ | Po dvou přihlášeních za sebou zkontroluj v LuDone → MCP, **kolik consentů přibylo** | 🔴 když **dva**, běží DCR při každém `begin()` — **Bloker 1 je živý** a PR to musí říct | ⛔ NEMĚŘENO |

**Zápis důkazů:** doslovné výpisy + exit kódy do `docs/changes/desktop-v1/evidence/verification/`
(✅ adresář existuje).
🔴 **R24 (`spec.md` §11 + `.gitignore:33-40`): do `dukazy/` patří jen `vysledek.json` a `README.md`**
— žádný zvuk, žádné screenshoty s cizí identitou, a **nikdy token, ani zkrácený**.

## 17. Rollback

- **Jeden revert.** `git revert -m 1 <merge commit PR>` vrátí atrapu a nic dalšího.
  `plan.md` §1: *„Každá story je samostatně revertovatelná. Žádná migrace v1 (desktop nikam nepíše)."*
- **Žádná migrace, žádné schéma, žádný vypínač.** 🔴 Cizí vypínače ležící OFF se nesahají.
  ⚠️ **Měřeno: `.env.example` obsahuje jen `DESKTOP_UPLOAD_ENABLED=false`; `DESKTOP_TIME_ENABLED`
  v repu jako proměnná neexistuje** — nelze tedy tvrdit „zůstává, jak byl".
- **Ruční úklid po živé zkoušce** (revert ho neudělá):
  1. `rm -rf "$HOME/Library/Application Support/cz.ludone.desktop/auth"` — smaže uloženou session;
  2. **souhlas na serveru zůstane platný** — odvolat ručně v LuDone → MCP. Desktop to zatím neumí
     (revoke je **B9**), a bez sítě by tvrzení „přístup odvolán" bylo lež o 30 dnů.
  3. 🔴 **Když běžela DCR (Bloker 1), zůstane na serveru i registrovaný klient** — a jich přibude
     jeden za každé přihlášení. Odvolat je taky, jinak z živé zkoušky zůstane nepořádek.
- **Když se revertuje po B9**, pořadí je opačné: nejdřív odvolat na serveru, pak mazat lokálně (R13).
- Bez Danova finálního schválení **žádný merge a žádná produkce** (`plan.md` §3 bod 7;
  `decisions.md:13` **M4**: *„Masterplán vyhrává všude. Globální „dotáhni to sám až na prod bez ptaní"
  se v tomhle repu ruší."*).

## 18. Definition of Done

### Sedm bodů z `plan.md` §3 — doslova (✅ ověřeno)

1. Cílený test **napřed** a viděný **červený** ze správného důvodu.
2. `npm run lint`, `typecheck`, `test:unit` — všechny EXIT=0, **měřeno před rourou**.
3. Sabotáž, která prokazatelně chytá odstranění guardu, s **doslovným výpisem**.
4. Nejméně jeden případ, který musí zůstat **zelený** (poměr 2–3 červené : 1 zelená).
5. Diff přečtený Claudem, u money a RBAC povinně.
6. PR odkazuje na Feature ID a tenhle plán.
7. **Bez produkce a bez merge** před Danovým finálním schválením.

### Navíc specificky pro B8

8. `grep -rn "createAuthController" electron/` má **aspoň jeden výskyt mimo `auth.cjs`** (dnes
   ověřeno nula) — doslovný výpis v PR.
9. `grep -c "mock-token-not-persisted\|Daniel Novák" electron/main.cjs` = **0**.
10. IPC odpověď má **přesně klíče `ok` a `user`** (nebo `ok` a `duvod`). Žádný token, callback,
    cesta na disk ani číslo portu.
11. `git diff --stat` obsahuje **jen** soubory z §12.2. Je-li mezi nimi `electron/auth.cjs`
    nebo `scripts/akceptace/E7.sh`, je to v PR **zdůvodněná odchylka** (E7.sh není v `plan.md` §2b).
12. `bash scripts/akceptace/E7.sh` i `E6.sh` hlásí `chyb: 0`; žádná existující podmínka nebyla
    oslabena ani smazána.
13. V PR jsou **čtyři osy** F003 po změně: `approved · pr-open · disabled · tests-green`
    (`verified-live` jen po §16). 🔴 **A věta, že přejímací scénář F003 (`spec.md:253`) tím
    splněný NENÍ** — viz §8.1.
14. V PR je **doslovný červený výpis z vlastního běhu** kroků 1–6 (ne tvary z tohohle packetu)
    a tabulka sabotáží S1–S8 s výsledkem.
15. V PR jsou vypsaná **slepá místa** — všech pět z §14, plus:
    `ui-smoke` o přihlášení neměří nic · identita proti skutečnému serveru neověřená ·
    `App.jsx:9` po restartu ukazuje `DEFAULT_USER` · `duvod` se v panelu nezobrazuje ·
    artboard tvrdí o uložení tokenu nepravdu (§6a).
16. `spec.md` ani `plan.md` **nebyly editované**. Odchylka → zápis do `decisions.md` a
    **zastavit se s otázkou** (masterplán §14: tichá odchylka je blocker).
17. Ve stromu nezůstal osiřelý Electron: `ps aux | grep "[l]udone-desktop.*Electron"` prázdné,
    a `git diff HEAD` po sabotážích taky.
18. 🔴 **NOVÉ:** v PR je odpověď na **Bloker 1** (registrace klienta) a **Bloker 2** (issuer)
    od koordinátora, nebo je PR označený jako **DRAFT / neslučitelný**.
19. 🔴 **NOVÉ:** v PR je doložený **průchod B3** (§16) — zabalený build s `LUDONE_E2E=1`
    se nepřihlásí.

### 🔴 Co implementátor NESMÍ (masterplán §9, doslova, řádky 636-644)

- **rozšířit scope;**
- **změnit schválený design;**
- **vytvořit nový design-system pattern bez tasku a schválení;**
- **změnit API/datový kontrakt bez aktualizace plánu;**
- **oslabit test;**
- **obejít bránu;**
- **rozhodnout nové money nebo RBAC pravidlo.**

> *„Pokud task packet nestačí, vrátí konkrétní otázku koordinátorovi. **Nehádá.**"* (§9, řádek 647)
>
> 🔴 **Původní packet tuhle větu odcitoval a hned proti ní jednal** — sám rozhodl název env
> proměnné (P1) a nechal projít zamítnutou registraci klienta. Obojí je v této verzi vráceno
> jako otázka.

## 19. Implementátor

**Claude (Opus), ne Codex.** ✅ `plan.md` §2 sloupec „Vykonavatel: **Claude**" + odůvodnění
*„B8 je bezpečnostní cesta — masterplán §10 nechává security na Claudovi."*

Pracovní strom: ⚠️ **dva zdroje si odporují** — `decisions.md:16` **M7** říká
„Worktrees = Orca `~/orca/workspaces/`", `AGENTS.md:18` říká „Izolovanou práci zakládej
v `.claude/worktrees/<účel>`". Podle *Autority při rozporu* vyhrává Danovo rozhodnutí **M7**;
založ přes `orca worktree create --name "<ASCII bez mezer>" --display-name "…"`.
🔴 **Dva zapisovatelé nesmí sdílet strom** (`AGENTS.md:19`) — B6 a B7 běží ve stejné vlně.
Po dokončení `orca worktree rm` + smazat větev; důkazy napřed archivovat (`AGENTS.md:21-22`).

## 20. Reviewer

**Hlavní Claude Code session (orchestrátor)** nad diffem — masterplán §14:
*„Agent, který napsal kód, nesmí být jedinou autoritou pro jeho schválení."* Povinné průchody
(masterplán řádky 887-905):

- **Pass 2 — Security and RBAC** 🔴 povinný. Zvlášť: **P2 backdoor** (`app.isPackaged`),
  tvar IPC odpovědi, umístění `try` kolem factory (§10.2), hranice `["panel"]`.
- **Pass 5 — Plan compliance** — Architecture Spine + **výčet vlastnictví bloků z §12.1**,
  a soubory mimo `plan.md` §2b (E7.sh).
- **Pass 4 — Spec compliance** — R12–R18, §7 copy, čtyři osy F003, **a přejímací scénář
  `spec.md:253`, který splněný není**.
- **Pass 6 — Design compliance** — a **zápis obou designových nesrovnalostí** z §6 (Klíčenka
  vs. šifrovaný soubor; tři různé texty tlačítka).
- **Pass 7 — Verification evidence** — červené výpisy **z vlastního běhu**, sabotáže S1–S8,
  kanárci K1–K5.

**Finální schválení: Dan.** `decisions.md:13` **M4** ruší v tomhle repozitáři globální
„dotáhni to sám až na prod bez ptaní"; `plan.md` §3 bod 7 to opakuje.

---

## Co revize opravila

Revize otevřela `electron/main.cjs`, `electron/auth.cjs`, `electron/preload.cjs`, `src/App.jsx`,
`src/components/Onboarding.jsx`, `scripts/ui-smoke.mjs`, `scripts/akceptace/E6.sh` a `E7.sh`,
`scripts/akceptace/E2-sabotaze.sh`, `tests/panel-blur-guard.test.js`, `tests/ipc-sender-guard.test.js`,
`vitest.config.js`, `package.json`, `.env.example`, `.gitignore`, `AGENTS.md`, `DAN-TODO.md`,
`docs/MASTERPLAN.md` §9/§13, `spec.md`, `plan.md`, `decisions.md`, `intent.md`,
`docs/ux/cesta-uzivatele-2026-09-01.md`, `docs/server-modul/autentizace.md`,
`specs/E6-prihlaseni-a-fronta.md`, `design/approved.json`, `design/navrh/nahled.html`
a **`design/canvas/Prihlaseni.dc.html`** (ten, který autor packetu přiznaně neotevřel).

**Dva blokery povýšené z poznámky pod čarou na stopku:**

1. **Zamítnutá registrace klienta.** `decisions.md:42` rozhodl **statickou** registraci; `auth.cjs:352`
   dělá dynamickou při každém `begin()`; změřený důsledek je **429 po dvaceti přihlášeních z jedné
   NAT IP** (`cesta-uzivatele`). Původní packet to odbyl větou „To B8 neřeší". B8 by tím nasadil
   do provozu variantu, kterou Dan zamítl.
2. **Název proměnné pro issuer.** P1 zaváděl nový `LUDONE_ISSUER`, ačkoli `specs/E6…` §11 už
   předepisuje `LUDONE_ORIGIN` pro tentýž origin — a všechna živá evidence v repu (`E7.sh:46`,
   `tests/oauth-state.test.js`) míří na **labs**, ne na app. Rozhodnutí kontraktu packetu nepřísluší.

**Prokázané nepravdy v původním packetu:**

- **„Renderer se nemusí měnit, tvar je zpětně kompatibilní."** `Onboarding.jsx:45`
  (`if (!result?.ok) throw new Error("Přihlášení se nevrátilo do aplikace.")`) **`duvod` zahodí**.
  Šest kódů z §10.1 je mrtvých dat. Věta „panel řekne českou větu" tedy není zásluha B8.
- **Kanárek K3 nemohl selhat.** Testoval, že napevno zadaný literál v rendereru neobsahuje
  „MCP/scope/token" — což je pravda vždy, bez ohledu na B8. Přepsán na kotvu v logu hlavního procesu.
- **`createAuthController` hází SYNCHRONNĚ ve factory** (`auth.cjs:326, 327, 336-338, 339-341`),
  ne v `begin()`. Krok 5 původního packetu testoval throw z `begin()` ⇒ implementace s
  `createAuthController(...)` mimo `try` prošla zeleně a přesto pustila technický text do panelu.
  Ironicky: příkladová věta packetu („E7 se smí autorizovat jen k MCP resource issueru") pochází
  z `auth.cjs:340`, tedy právě z factory. Přidán krok 5b a sabotáž S5b.
- **P2 byl produkční zadní vrátka.** `main.cjs:26` = `process.env.LUDONE_E2E === "1"`,
  `app.isPackaged` se v repu **nevyskytuje ani jednou** ⇒ podepsaný build s `LUDONE_E2E=1`
  by vrátil `{ok:true, user:…}` bez přihlášení. Žádná z S1–S7 to nechytala. Přidán krok 4c,
  sabotáž S6b a živý průchod B3.
- **Šest kódů `duvod`, jeden testovaný.** `neznama` na všechno by prošlo každou bránou. Přidán
  krok 5c s mapováním na **skutečné věty**, které `auth.cjs` opravdu hází, a sabotáž S5c.
- **Krok 1 je splnitelný přejmenováním literálů.** Přidána přiznávací sabotáž S8: krok 1 zůstává
  zelený, krok 3 červená — jediný poctivý způsob, jak ukázat, které měřidlo měří.
- **Očekávaný výpis sabotáže S4 byl vymyšlený.** Fake controller `http://` přijme ⇒ vitest napíše
  `expected undefined to be "konfigurace"`, ne `expected "neznama" …`. Doplněna hlavička nad §13,
  že **všechny** výpisy jsou tvary, ne zachycený běh.
- **Návrh přidání do `E7.sh` používal `\s` v `grep -E`.** Změřeno: zdejší `grep` je ugrep 7.8.4
  a matchne, GNU grep taky — **stock BSD grep ne** ⇒ trvale červená brána. Přepsáno na `[[:space:]]`
  (ověřeno, že matchne).
- **`E7.sh` živě testuje labs prostředí, ne `app.ludone.cz`** (řádek 46) a pouští jen filtrované
  testy `pkce`/`oauth-state` (39-40) — nový soubor nespustí.
- **`spec.md:253` má pro DSK-F003 přejímací scénář, který packet vynechal** — a který po B8 stále
  neprojde ze dvou nezávislých důvodů (panel důvod nezobrazuje; timeout je 5 min, ne 10).
- **`app.focus({steal:true})` nevlastní žádná story** (`grep` v `main.cjs` = nula), a §12.2 to B8
  zakazovala přidat — přesto A5 živého scénáře to vyžadovalo. Povýšeno na otázku P3; A5 přestal
  být kritérium B8.
- **B4 byla uvedena jako splněný předpoklad bez ověření.** Změřeno: na `0380bc0` po ní není větev,
  `shouldHidePanelOnBlur` nemá `authFlowInFlight`, `DEFAULT_TIMEOUT_MS` je 5 min ⇒ **B4 hotová není**.
- **Artboard `design/canvas/Prihlaseni.dc.html` tvrdí „Token bydlí v Klíčence"** — což odporuje
  změřenému `cesta-uzivatele` (v Keychainu je jen klíč, token je šifrovaný soubor). Kdo se řídí
  artboardem, postaví špatnou věc. Artboard má navíc **pět** stavů (`auth.cancelled`,
  `auth.state-mismatch`, `auth.other-account` …), jiných než tři z `nahled.html`, a **třetí
  variantu textu tlačítka**.
- **`DESKTOP_TIME_ENABLED` v kódu ani v env souborech neexistuje** — `.env.example` má jen
  `DESKTOP_UPLOAD_ENABLED=false`. Nelze tvrdit „oba vypínače zůstávají, jak byly".
- **`functionSource` vyžaduje `function` deklaraci** (`panel-blur-guard.test.js:8`) a `Function()`
  sandbox nezná modulový scope — obojí doplněno jako tvrdé omezení, jinak krok 2 zčervená
  z nesprávného důvodu.
- **Řádkové opravy:** `auth:begin` blok je **681–692** (ne 681–691 — původní rozsah vynechával
  `});`, které se musí nahradit) · `configureWritablePaths` **170–190** (ne 169–189) ·
  `shouldHidePanelOnBlur` **241–246** a čítač `permissionPromptsInFlight` na **237, 332, 696, 700**
  (ne „230-246, 326-338").
- **Konflikt M7 vs. AGENTS.md o umístění worktree** — packet oba citoval, jako by souhlasily.

**Potvrzeno jako pravdivé** (ověřeno v kódu, ne převzato): všechny tři SHA · `auth.cjs:325` /
`:502` a **nula** referencí mimo `auth.cjs` · `preload.cjs:8` · `App.jsx:9` a `:15` ·
`Onboarding.jsx:174`, `:176` · `ui-smoke.mjs:297-298` · `handleValidated` 151-156 ·
`tokenStorageDirectory` 284-294 · `persistEncryptedSession` 296 · `trustedRemoteEndpoint` 41-53 ·
listener 117-201 · `DEFAULT_TIMEOUT_MS` `auth.cjs:9` · `MCP_SCOPES` `auth.cjs:14` ·
`normalizedIssuer` 33 · `validatedMcpScope` 55 · `resolveUserIdentity` 234-250 ·
„Hotovo, vraťte se do LuDone Desktop." `auth.cjs:168` · `functionSource` `panel-blur-guard.test.js:7-37` ·
injektáž `ipc-sender-guard.test.js:23-56` · `E7.sh:45-51` · `evidence/verification/` existuje ·
`design-manifest.md` existuje · všech sedm bran v `package.json` · `plan.md` §2 tabulka vlastnictví
a §2b řádek B8 · `plan.md` §3 sedm bodů DoD · masterplán §9 dvacet polí a sedm zákazů ·
`AGENTS.md:45,54,66` · `DAN-TODO.md` §3b bod 5 · `decisions.md` M4/M7/O10 ·
`docs/behy/…:89` zákaz + `intent.md:90` N1.

## Co packetu chybí ve spec/plan

- 🛑 BLOKER 1 — registrace klienta. decisions.md:42 rozhodl STATICKOU registraci; auth.cjs:352 dělá dynamickou při každém begin(); cesta-uzivatele to změřila jako 429 po 20 přihlášeních z jedné NAT IP; E7.sh:47-51 dynamickou registraci navíc VYNUCUJE. Spec ani plán neříkají, odkud má B8 vzít clientId. Bez odpovědi B8 nasadí zamítnutou variantu.
- 🛑 BLOKER 2 — jméno a výchozí hodnota proměnné pro issuer. specs/E6-prihlaseni-a-fronta.md §11 předepisuje LUDONE_ORIGIN (default https://app.ludone.cz); původní packet zavedl nový LUDONE_ISSUER. Zároveň všechna živá evidence v repu (E7.sh:46, tests/oauth-state.test.js:45,51,54) míří do labs prostředí. Volba názvu i defaultu je změna kontraktu, kterou packet nesmí udělat sám.
- 🛑 P3 — kdo vlastní app.focus({steal:true}) + znovuotevření panelu. nahled.html:258 a cesta-uzivatele M09 to vyžadují, v main.cjs to neexistuje (grep = nula) a §12.2 to B8 zakazuje. Bez rozhodnutí nelze krok A5 živého scénáře považovat za kritérium B8.
- Kdo napojí kód `duvod` na text v panelu. Onboarding.jsx:45 ho zahazuje a nahrazuje pevnou větou. plan.md §2 dává B4 jen 'časy 5↔10 min · panel nemizí · čekání má konec'. Bez vlastníka zůstává přejímací scénář spec.md:253 (DSK-F003 'panel řekne, že vypršelo') trvale nesplněný.
- Má auth.cjs dostat strojově čitelné kódy chyb (error.code) místo mapování podle textu výjimky? Mapování podle textu tiše spadne na 'neznama', jakmile B4 znění vět změní. Editace auth.cjs je ale hřiště B4/B9.
- EXPERIENCE.md, který masterplán §3 a §9 vyžadují, v repozitáři neexistuje. Jeho roli hraje docs/ux/cesta-uzivatele-2026-09-01.md — potvrdit, že to je závazná náhrada.
- Konflikt umístění worktree: decisions.md:16 (M7) říká Orca ~/orca/workspaces/, AGENTS.md:18 říká .claude/worktrees/<účel>. Který platí pro B8.
- Je přidání podmínky do scripts/akceptace/E7.sh povolené? Ten soubor není v plan.md §2b mezi soubory B8 (jsou tam jen electron/main.cjs a auth.cjs), takže i posílení brány je formálně odchylka od zmrazeného plánu.
- Nikde není určeno, zda má B8 přidat obnovu session z disku při startu (auth:status / auth:restore). Dnes App.jsx:15 po restartu dosadí natvrdo DEFAULT_USER, takže i po úspěšném přihlášení panel po restartu lže. Žádná story to nevlastní.
- Neexistuje potvrzený současný stav OAuth discovery. docs/server-modul/autentizace.md:6-9 sám říká, že hodnoty jsou měření z 24. 8. 2026 a že nové ověření 25. 8. skončilo curl 6 (DNS). Před živým průchodem A je potřeba čerstvé měření.

## 🔴 Co NEBYLO ověřeno v kódu

Skeptik packet přečetl proti kódu, ale tohle zůstalo bez důkazu.
**Než na tom postavíš implementaci, otevři to.**

- Nespustil jsem ani jednu bránu, jeden test ani build — zadání bylo přísně read-only. Všechny 'očekávané červené výpisy' v §13 a §14 jsou TVARY odvozené z formátu vitest a ze skutečného obsahu souborů, NE zachycený výstup běhu. Platí to i pro opravené znění S4. Implementátor musí zapsat, co uvidí on.
- Neověřil jsem, že sabotáže S1–S8 skutečně zčervenají. Jsou odvozené z toho, co testy tvrdí, a doložit je musí implementátor naostro.
- Neprovedl jsem žádný síťový požadavek. Tvrzení o discovery v produkčním i labs prostředí (code_challenge_methods_supported ['S256'], scopes_supported ['mcp:read','mcp:draft'], otevřený registration_endpoint) přebírám z docs/server-modul/autentizace.md:6-16, kde jsou samy označené jako měření z 24. 8. 2026, ne jako potvrzený současný stav.
- Neověřil jsem chování createAuthController proti skutečnému serveru. Popis toku v §10 stojí na četbě electron/auth.cjs:325-418, ne na běhu. Zvlášť neověřeno: že normalizeIdentity (auth.cjs:224-232) najde name a email v odpovědi tokenu skutečného LuDone — DAN-TODO.md §3b bod 5 tvrdí opak.
- Neověřil jsem přesný tvar, kterým Electron 37.3.1 obaluje odmítnutí z ipcMain.handle směrem k rendereru (očekává se prefix "Error invoking remote method 'auth:begin': …"). Závěr, že se technický text dostane do panelu, stojí na četbě Onboarding.jsx:49-50 (setAuthError(error.message)) a na obecné znalosti Electronu, ne na měření zde.
- Neověřil jsem, že app.isPackaged je v Electronu 37.3.1 spolehlivě false při `npm start` a true v zabaleném buildu — jen jsem změřil, že se to slovo v repozitáři nevyskytuje ani jednou. Doporučená obrana v P2 na tom předpokladu stojí a musí ji doložit průchod B3.
- Nepřečetl jsem celý docs/ux/cesta-uzivatele-2026-09-01.md (44 KB). Četl jsem odstavec 'Přihlášení očima uživatele' a řádky vrácené grepem (momenty M06, M08, M09, M10, M28, M30 a řádek 117). Zbytek dokumentu jsem neviděl.
- Neotevřel jsem ostatní .dc.html artboardy (Main, Lista, Fronta, Nahravani, Opravneni, ZtrataStopy, LuTrack, Akcenty, Pisma) ani design/navrh/Cesta|Conservative|Divergent|Propojeni. Pro B8 relevantní Prihlaseni.dc.html jsem otevřel a citoval doslova; z nahled.html jsem četl jen okolí oddílu '01 — První spuštění' přes grep, ne celý soubor.
- Neotevřel jsem src/lib/queue.js, src/lib/oauth.js, src/features/tracking/TrackingCard.jsx, src/components/Settings.jsx (mimo dva grep zásahy), tests/queue.test.js, tests/manifest.test.js, tests/recording-order-guard.test.js, tests/pkce.test.js, tests/oauth-state.test.js (mimo grep), tests/permissions.test.js, tests/tray-authority.test.js ani scripts/audio-smoke.mjs. U tests/* jsem ověřil jen, že soubory existují — ne že jsou dnes zelené.
- Neověřil jsem, jestli `npm run lint`, `typecheck`, `test:unit` a `build` jsou dnes na main zelené. Poznámka v git logu ('Record that ui-smoke is red on main') naznačuje, že aspoň ui-smoke zelený není. Implementátor musí změřit výchozí zelenou PŘED první sabotáží (E2-sabotaze.sh to vynucuje funkcí zelena_brana).
- Číslo '~60 řádků v main.cjs' jsem nepřepočítal — je to odhad převzatý z původního packetu. '~110 řádků' je z plan.md §2b, taky nezměřeno.
- Neověřil jsem, jak se grep chová v CI (GNU grep vs. ugrep). Změřil jsem jen, že na tomhle stroji je `grep` = ugrep 7.8.4 a že tam \s i [[:space:]] matchnou. Tvrzení, že stock BSD /usr/bin/grep \s nepodporuje, je obecná znalost, ne měření zde.
- Neověřil jsem obsah scripts/akceptace/E1–E5 a E8 ani .github workflows — tvrzení původního packetu, že CI má ui-smoke a test:audio za `if: ${{ false }}`, jsem NEPŘEZKOUMAL a v opravené verzi ho neopakuji jako fakt.
- Neověřil jsem stav vzdálených větví nad rámec `git branch -a` (origin/main, origin/docs/plan-2026-08-24, origin/feat/*). Závěr, že B4 není hotová, stojí na tomhle výpisu a na tom, že v main.cjs chybí authFlowInFlight a DEFAULT_TIMEOUT_MS je 5 min — ne na dotazu do PR fronty nebo na GitHub.
