# STAV BĚHU — bod obnovy

**Zapsáno 2. 9. 2026, 12:0x, před vyčerpáním Claude limitu.**
Tenhle soubor je psaný pro někoho s **prázdným kontextem**. Konverzace neexistuje, repozitář ano.

---

## 🔴 PRVNÍ AKCE PO RESUME — přesně tohle, nic jiného

```bash
cd /Users/dan/Dev/ClaudeCode/ludone-desktop
pgrep -f "codex exec -C .*desktop-zvuk" | wc -l          # 0 = doběhl, >0 = ještě píše
git -C ~/orca/workspaces/ludone-desktop/desktop-zvuk status --porcelain
```

**Když je 0 a strom má změny** → Codex doběhl a jeho práce je NECOMMITNUTÁ. Udělej v tomhle
pořadí, bez přeskakování:

```bash
cd ~/orca/workspaces/ludone-desktop/desktop-zvuk
git add -A && git commit -m "Let screen capture through the media permission gate"
npm run lint && npm run typecheck && npm run test:unit     # brány PŘED rourou
git fetch origin && git rebase origin/main
```
Pak přečti diff, spusť sabotáže (níž), otevři PR, počkej na zelenou CI, mergni, ukliď worktree.

🔴 **Na větvi `orca/desktop-zvuk` je na originu WIP commit `e0f82a2` — NEMERGOVAT.**
Vznikl jako záloha uprostřed psaní, když docházel limit: brány neproběhly, sabotáže neproběhly,
diff nikdo nečetl. Je to pojistka proti ztrátě, ne hotová práce. Po resume nad ním normálně
pokračuj (Codex do stromu píše dál) a **teprve pak** brány, sabotáže a PR.

**Když je >0** → job běží dál, nech ho. Mrtvý je až tehdy, když se jeho log
`/tmp/beh-noc/zvuk.log` nehýbe **20 minut** — status ani počet procesů nejsou důkaz.

---

## Cíl běhu

Postavit LuDone Desktop podle masterplánu: menu-bar aplikace, která nahrává schůzky
a měří čas, s frontou odesílající na `app.ludone.cz`. Zadání: `BEH-NOC.md`, stav funkcí
`spec.md` §3, rozhodnutí `decisions.md`.

## Hotovo a v `main` (vše mergnuté, `main` = `a5ce4cf`)

| PR | co |
|---|---|
| #2–#11 | noční běh: lišta, přihlášení, časovač, fronta, retence, odhlášení |
| #12 | brána na tři latentní vady odhlášení |
| #13 | oprava bezpečnostní brány odhlášení (hlídala prázdný adresář) |
| #14 | odstraněn kalendář zrušený na approval gate + brána proti návratu |
| #15 | zapojena retence a zařazení času do fronty |
| #16 | přihlášení nepadá na chybějícím jménu |
| #17 | z logu je poznat, jak přihlášení dopadlo |
| #18 | klidový panel sladěn se schváleným designem |

**`main`: 372 testů, 6 přeskočených. Nula otevřených PR.**

## ✅ Ověřeno naostro (jediné dvě funkce s `verified-live`)

1. **Retence `DSK-F017`** — 10 dní stará odeslaná nahrávka smazána skutečným během aplikace.
2. **Přihlášení `DSK-F003`** — Dan potvrdil souhlas, token vznikl:
   `~/Library/Application Support/cz.ludone.desktop/auth/oauth.enc` (483 B, práva 0600).

🔴 **Všechno ostatní je jen 🧪 zelené testy.** Nikdo to neviděl fungovat.

## Rozdělaná práce — JEDEN worktree, JEDEN job

| | |
|---|---|
| **worktree** | `~/orca/workspaces/ludone-desktop/desktop-zvuk` |
| **větev** | `orca/desktop-zvuk` (z `origin/main`) |
| **Orca panel** | `term_9a67eaac-4343-471d-ac9f-927248a75cd2` — „⚙ Codex: systémový zvuk nikdy nemohl fungovat" |
| **log** | `/tmp/beh-noc/zvuk.log` |
| **zadání** | `/tmp/beh-noc/codex-zvuk.txt` |
| **rozdělané** | `electron/main.cjs`, `tests/ipc-sender-guard.test.js` |

⚠️ `git worktree list` ukazuje 2 — hlavní checkout a `desktop-zvuk`. Nic jiného viset nemá.

### Co ten job opravuje — příčina je ZMĚŘENÁ

Nahrávání systémového zvuku vždycky selže `NotAllowedError: Permission denied`, přestože
macOS oprávnění jsou v pořádku (`getMediaAccessStatus("screen") === "granted"`).

Sondou v běžící aplikaci změřeno, že pro `getDisplayMedia({video:true,audio:true})` dorazí do
`isAllowedMediaPermission` (`electron/main.cjs:145`) tohle:

```json
{"permission":"media","url":"file:///…/dist/index.html","mediaTypes":[]}
```

A kontrola vyžaduje `mediaTypes.length === 1 && mediaTypes[0] === "audio"` → prázdné pole
neprojde → odmítnuto **dřív, než se zavolá `setDisplayMediaRequestHandler`** (doloženo tím,
že sonda v tom handleru nikdy nevypsala ani řádek).

⚠️ Větev `if (permission === "display-capture") return true;` (ř. 155) se **nikdy neuplatní** —
Electron posílá `media`, ne `display-capture`.

### Sabotáže, které na tom PR musí proběhnout

Je to **bezpečnostní** kontrola, takže sabotáže musí dokázat, že se neuvolnilo víc, než mělo:

| sabotáž | očekávání |
|---|---|
| `mediaTypes: ["video"]` projde | 🔴 kamera musí zůstat zakázaná |
| `mediaTypes: ["audio","video"]` projde | 🔴 |
| nedůvěryhodná URL s `mediaTypes: []` projde | 🔴 |
| obejít `requireTrustedSender` | 🔴 |
| komentář zmiňující `display-capture` | 🟢 povinně zelená |

## 🔴 Blockers — všechny na SERVERU, žádný na desktopu

| co | dopad |
|---|---|
| **chybí OAuth scope pro zápis** | server zná jen `mcp:read` a `mcp:draft`; desktop může frontu jen plnit, ne vyprazdňovat → `DSK-F010` stojí |
| **server nevrací jméno uživatele** | `ludone_ping` dá jen e-mail; panel proto píše „připojení neověřeno" |
| **nginx strop neznámý** | `E5` krok 1, měří se přes SSH — umí to jen Dan |
| **příjem času nespecifikován** | `E5` řeší jen nahrávky |

Předávací dokument pro serverovou stranu: [`SERVER-CO-POSTAVIT.md`](SERVER-CO-POSTAVIT.md).

## Otevřené na desktopu (neblokuje, pořadí podle hodnoty)

1. **`RecordingCard` nemá unit pokrytí vůbec** — změřeno sabotáží: přejmenování `start()`
   prošlo zeleně.
2. **Panel je vizuálně prázdný uprostřed** — okno má pevných 366×792, obsah se po sladění
   s designem zkrátil. Výška je v `electron/main.cjs`.
3. **Živý OAuth stav nejde po restartu ověřit** bez nového getteru v `electron/**`.
4. Chybí fontové soubory Public Sans / Instrument Sans → systémový fallback.

## Konfigurace, kterou po resume potřebuješ

- `.env.local` (mimo git, ověřeno `git check-ignore`) drží
  `LUDONE_OAUTH_CLIENT_ID=ldmcp_oauth_client_prod_v1_Mti3tDvq…` — **ověřený, používaný**.
  Druhý klient (`…dgsYAL5m…`) je nepoužívaný sirotek, viz `DAN-TODO.md`.
- 🔴 **`LUDONE_DATA_DIR` přesměruje `userData`, `sessionData`, `cache`, `crashDumps`, `temp` —
  ale NE `appData`.** Token proto vždy leží ve skutečném `~/Library/Application Support/cz.ludone.desktop/`.
  Kdo ho hledá v testovacím adresáři, nenajde ho a bude si myslet, že přihlášení selhalo.

## Pravidla, která tenhle běh zaplatil a nemá se od nich ustupovat

- **Jeden SOUBOR = jeden job**, ne jen jeden worktree. Tři úkoly do `main.cjs` = konflikty při rebase.
- **Codex ve worktree needituje git** — `codex exec -C <worktree> -s workspace-write`,
  a commit dělá orchestrátor HNED po doběhnutí, dřív než cokoli jiného.
- **Zelené testy nejsou ověření.** Tenhle den našel tři vady, které 331 zelených testů přehlédlo.
- 🔴 **Napřed ověř měřidlo, teprve pak obviň kód.** Čtyřikrát za den vypadala moje chybná
  příprava testu jako vada v implementaci.
