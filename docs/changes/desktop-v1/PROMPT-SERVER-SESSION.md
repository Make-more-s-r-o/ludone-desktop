# Zadání pro serverovou session (ludone-app)

**Napsala desktopová session `b1210d54-d06e-4182-93cd-9c5550b8c2d4` dne 2. 9. 2026.**
Když něco nesedí nebo potřebuješ doplnit kontext o desktopové straně, **zeptej se jí** —
běží ve stejné Orce a zná celou historii včetně měření, která jsou tu citovaná.

---

## Co stavíš

Serverovou stranu pro **LuDone Desktop** — aplikaci, která nahrává schůzky a měří čas.
Desktop je **hotový a čeká**: fronta se plní, ale nemá kam odesílat.

**Napřed labs, teprve po ověření produkce.** To je závazné pořadí, ne doporučení.

## Zdroje pravdy — přečti je dřív, než začneš plánovat

| co | kde |
|---|---|
| **přehled a rozhodnutí** | `ludone-desktop/docs/changes/desktop-v1/SERVER-CO-POSTAVIT.md` |
| **spec příjmu nahrávek** (329 řádků, 10 kroků) | `ludone-desktop/specs/E5-server-prijem.md` |
| tvar dat, která desktop pošle | `ludone-desktop/src/lib/queue.js` |
| klientská strana OAuth | `ludone-desktop/electron/auth.cjs` |

🔴 **Desktopový repozitář je pro tebe JEN KE ČTENÍ.** Neupravuj v něm nic; když najdeš vadu
na jeho straně, napiš ji a předej.

## 🔴 ZADÁNÍ SE 2. 9. ODPOLEDNE ZMĚNILO — čti tohle, ne starší verzi

Dan plán zjednodušil. **Nový scope se v první fázi NESTAVÍ.** Rozhodnutí BD-N34 až BD-N37
v `decisions.md`, tady je jejich shrnutí.

### Fáze 1 — nahrává PROHLÍŽEČ, ne desktop. Žádné nové právo.

| krok | kdo |
|---|---|
| po schůzce klik v panelu → schůzka se uloží jako **jeden soubor do Stažených** a otevře se nahrávací stránka | desktop *(jiná session)* |
| člověk soubor nahraje na app.ludone (nebo ho tam přetáhne) | **prohlížeč, běžná session cookie** |

⇒ **Upload endpoint autentizuješ stejně jako každou jinou stránku aplikace.** Žádný OAuth
scope, žádná změna souhlasové obrazovky, žádná přeregistrace klienta.

🔴 **Web musí přijmout JAKÝKOLI zvukový soubor**, ne jen ten z desktopu — Dan výslovně chce
nahrát i nahrávku z telefonu a nechat ji přepsat. Je to tentýž endpoint, jen jiný zdroj.

### Fáze 2 — automatický sync, defaultně VYPNUTÝ

Teprve tady desktop nahrává sám a **teprve tady vzniká potřeba scope pro zápis**
(doporučení: `mcp:upload`, ne rozšiřovat `mcp:draft`). **Nestav to teď** — postav to, až
bude fáze 1 ověřená naostro.

⚠️ Audit našel, že `mcp:read` už dnes dovoluje tři mutace, ale obrazovka souhlasu mluví jen
o čtení. Až na scope dojde, je to příležitost ten rozpor srovnat.

### 2. Příjem naměřeného času — malý, ale money cesta

⚠️ **Pozor: čas jde jinou cestou než nahrávky.** Nahrávky nově chodí z prohlížeče (fáze 1),
ale **naměřený čas posílá desktop sám** — a ten se autorizovat musí. Buď to odlož spolu
s fází 2, nebo to Danovi vysvětli a nech ho rozhodnout. **Nepředpokládej, že to projde
pod `mcp:read`.**

`E5` řeší **jen nahrávky**; čas v něm nepadne ani jednou. Desktop ho přitom do fronty
už zařazuje.

Tvar položky (zmrazený, `schemaVersion: 1`):

```
clientTimeEntryId : GUID   — idempotenční klíč, vzniká na desktopu při STARTU měření
projectId         : GUID   — Tabidoo id projektu
startedAt         : ISO 8601
endedAt           : ISO 8601
```

🔴 **Desktop NIKDY neposílá sazbu.** `enqueueTimeEntry` má tvrdou kontrolu: pole se slovem
`rate` nebo `sazb` zápis shodí výjimkou. **Postav stejnou kontrolu na serveru** — přijde-li
sazba, je to chyba klienta, ne vstup.

🔴 **Idempotence je životně důležitá.** Desktop opakuje odeslání při každém výpadku sítě.
Týž `clientTimeEntryId` podruhé **nesmí** založit druhý záznam. U nahrávky je duplikát
nepořádek, **u času je to dvakrát vykázaná práce a špatně vyúčtovaný projekt.**

**Proč čas před nahrávkami:** je desetkrát menší, desktop ho už umí posílat, a ověříš na něm
celý řetěz (scope → token → idempotence → zápis) na datech, co se vejdou do jednoho JSONu.
Nahrávky pak přidají jen velikost, ne novou nejistotu.

### 3. Příjem nahrávek podle `E5`

Deset kroků: SQL migrace a rollback · Drizzle · streamové úložiště · chunked/resumable
upload (4 routy) · ffmpeg remux · RBAC default-deny · adresáře a práva · brány · ostré ověření.

🔴 **`E5` krok 1 označuje měření nginx stropu jako blokující. UŽ JE ZMĚŘENÝ** — viz níž.
Nezdržuj se tím, jen si to přeověř.

### 4. Přepis, shrnutí, překlad — VŠE AŽ NA KLIKNUTÍ

Nahraná nahrávka jen leží. Teprve klik **Přepsat** vyrobí text; **Shrnout** a **Přeložit**
jsou další samostatné, volitelné kroky. Nic se neplatí za schůzky, které nikdo neotevře.

🔴 **Kritérium pro výběr přepisové služby: musí umět DIARIZACI a ČEŠTINU.** Dan to řekl
výslovně: *„určitě by mělo být poznat, kdo přesně mluvil, když bude víc lidí."* Bez diarizace
je ze zápisu ze schůzky jeden slepý text a ztrácí většinu hodnoty.

⚠️ Desktop posílá **jeden soubor se dvěma kanály** (mikrofon vlevo, systém vpravo). To
zadarmo oddělí „já" × „druhá strana"; víc lidí na druhé straně rozdělí až diarizace.
**Nemixuj kanály do mono při příjmu** — ztratil bys informaci, kterou nikdo jiný nedodá.

**MCP potřebuje nástroj na ČTENÍ přepisu** (spadá pod stávající `mcp:read`). Dan: *„když
agent načte, jemu stačí transkript a může si udělat shrnutí sám."* Shrnutí na serveru je
tedy volba pro člověka, ne povinný krok.

### 5. Kvóta na místo — nastavení modulu, ne konstanty

Dan: *„postavil bych možnosti v nastavení modulu, kde si každý zvolí a bude se počítat místo,
které bude dedikované těm zápisům."*

- Retence i limity jsou **volby v nastavení**, ne čísla v kódu.
- **Zvuk a přepis se počítají zvlášť** — přepis kilobajty, zvuk stovky megabajtů.
- 🔴 **Při plné kvótě nové nahrávání ODMÍTNI se srozumitelnou hláškou. Nikdy nemaž
  automaticky.** Tiché smazání dat, o která uživatel nepožádal, je horší než odmítnutá
  nahrávka. *(Rozhodl běh, ne Dan — nech si to potvrdit.)*

### 6. Jméno uživatele v identitě

`ludone_ping` vrací jen e-mail (`src/mcp/tools/ping.ts:70`). Desktop kvůli tomu píše v panelu
„připojení neověřeno" a na obrazovce „Přihlášeno" nemá co zobrazit — schválený design tam má
**Jméno · E-mail · Zařízení**.

Nejmenší zásah: přidat jméno do odpovědi `ludone_ping`.

---

## ✅ Změřeno za tebe — nemusíš to zjišťovat znovu

**SSH funguje**, alias v `~/.ssh/config`:

```bash
ssh hetzner-data     # 23.88.61.12, root
```

`app.ludone.cz` i `data.ludone.cz` běží **na tomtéž stroji**. Reverse proxy je kontejner
`makemore-nginx` (nginx 1.29.5, image `nginx:alpine`).

🔴 **Strop nahrávání (E5 krok 1, změřeno 2. 9. 2026):**

```
client_max_body_size 50m        ← /etc/nginx/nginx.conf:18, platí GLOBÁLNĚ
app.ludone.cz to NEPŘEPISUJE    ← /etc/nginx/conf.d/09-app-prod-zone.conf nemá vlastní limit
labs                            ← /etc/nginx/conf.d/10-data-hub.conf
```

Příkaz, kterým si to přeověříš:

```bash
ssh hetzner-data 'docker exec makemore-nginx grep -rn "client_max_body_size\|proxy_read_timeout\|proxy_request_buffering" /etc/nginx/'
```

⇒ **Hodinová stopa má 40–120 MB, strop je 50 MB.** Upload v jednom kuse spadne. Buď drž
kousky bezpečně pod 50 MB, nebo pro ten jeden endpoint limit zvyš — a pak **změř, že to
platí**, ne že to je v konfiguraci.

⚠️ Sousední konfigurace už streamovaný upload řeší (`21-supabase.conf:58`
`proxy_request_buffering off`). Podívej se tam, než budeš vymýšlet vlastní.

## Jak pracovat

- **`/effort ultracode`**, **`/beh`**, měřitelný **`/goal`**.
- **Mechaniku deleguj PRIMÁRNĚ na Codex** jako viditelný panel v Orce:
  `codex exec -C <worktree> -s workspace-write`. 🔴 **Načti si skill
  `codex-delegace-orchestrace` DŘÍV, než pustíš první job** — jsou v něm pasti, které stojí
  celé kolo.
- **Jeden worktree = jeden zapisovatel**, a tvrdší pravidlo z praxe: **jeden hotspot soubor
  = jeden job**. Tři joby do téhož souboru si nepřepíšou práci, ale při rebase na sebe narazí.
- **Claude si nechává konsolidaci:** čtení diffu, brány, sabotáže, commit, PR, merge.
  Codex ve worktree **needituje git** — commit dělá orchestrátor HNED po doběhnutí.

## Co si z desktopové strany odnést jako pravidlo

1. 🔴 **Zelené testy nejsou ověření.** Desktop měl 331 zelených testů a první spuštění našlo
   **tři vady**, které přehlédly: zrušená funkce pořád v UI, přihlášení zahazované kvůli
   chybějícímu jménu, a retence, která by nikdy nic nesmazala.
2. 🔴 **Napřed ověř měřidlo, teprve pak obviň kód.** Za jeden den čtyřikrát vypadala chybná
   příprava testu jako vada v implementaci.
3. **Brána, která nic nenajde, není zelená — je nezměřená.** Ke každé nové bráně patří
   sabotáž, včetně jedné **povinně zelené** (např. komentář, který vypadá jako kód).
4. **Idempotence u money cest se testuje dvojím odesláním**, ne přečtením kódu.

## Hranice, které nepřekračuj

- **Ostrý zápis do Tabidoo** dělá výhradně člověk klikem v aplikaci.
- **Produkce až po zeleném labs.** Migrace na obě DB **před** mergem.
- Killswitch flipni jen ten, který patří práci tvého běhu.
- Secrets nikdy do gitu.
