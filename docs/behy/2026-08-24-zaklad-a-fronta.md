# Briéf běhu — základ, měřidlo a odchozí fronta

Vznikl 24. 8. 2026. Řídí dlouhý autonomní běh (režim B). **Běh se řídí tímhle souborem, ne
konverzací** — konverzaci sežere komprese, soubor ne.

Navazuje na [`PLAN.md`](../../PLAN.md) (11 etap), [`DAN-TODO.md`](../../DAN-TODO.md) (co dělá Dan)
a `specs/E*.md` (detail po soubor a řádek).

---

## Problém a cíl

**Problém.** Zachycení dvou zvukových stop na macOS je změřené a funguje, ale kolem něj není nic:
kód aplikace není ani na `main`, projekt nemá jediný automatický test, přihlášení a oprávnění jsou
atrapy, a nahrávka po skončení nikam nejde — jen leží na disku bez záznamu o tom, že vznikla.

**Cíl běhu.** Dostat projekt do stavu, kdy má **odkud startovat** (kód na `main`, mantinely),
**čím se měřit** (brány, kterým se dá věřit), **opravené doložené vady** a **odchozí frontu**,
která nahrávku bezpečně podrží, dokud nevznikne server. Plus **kompletní technickou dokumentaci**
serverového modulu, aby se podle ní dalo později stavět bez dalšího výzkumu.

**Jak poznáme, že je hotovo.** Čerstvý `git clone` + `npm ci && npm run build && npm run package:mac`
vyrobí spustitelný `.app`; `npm run gates` projde a **umí zčervenat** (doloženo třemi sabotážemi);
po nahrávání existuje manifest sezení a položka ve frontě; a v `docs/server-modul/` leží předávka,
kterou lze vzít do jiného repozitáře a stavět podle ní.

---

## Etapy

| # | Etapa | Akceptační kritérium | KDO |
|---|---|---|---|
| **1** | **Kód na `main` a jeden zdroj pravdy** — mergnout `feat/kostra-appky`, napsat `AGENTS.md`, opravit doložené rozpory v dokumentech | Čerstvý `git clone` + `npm ci && npm run build && npm run package:mac` vyrobí spustitelný `.app` bez sáhnutí do worktrees. `grep -rn "SYSTÉMOVÝ ZVUK NEFUNGUJE" --include='*.md' .` bez značky PŘEKONÁNO vrací **prázdno**. `AGENTS.md` existuje na `main`. `git worktree list \| wc -l` = 1 | **Claude** |
| **2** | **Měřidlo** — ESLint, typecheck přes JSDoc, Vitest nad čistou logikou, GitHub Actions; **oprava audio brány** | Tři umělé regrese jsou chycené a **demonstrované doslovným výpisem**: (a) odstraněná kontrola pořadí chunků → padne unit test; (b) přejmenované tlačítko „Zastavit nahrávání" → padne `ui-smoke`; (c) tichý běh, zatímco hraje hudba → brána běh **zahodí a zopakuje**, ne vyhlásí neúspěch | **Codex** |
| **3** | **Doložené vady kódu** — tray lže při pádu rendereru, IPC kanály bez kontroly odesílatele, chybějící `NSAudioCaptureUsageDescription`, mrtvý kód `ludone://`, bundle id | `kill -9` rendereru během nahrávání → tray do 1 s `idle`. `tray:set-state` z netrusted frame **odmítnut**. `plutil -p` na release bundlu vypíše `NSAudioCaptureUsageDescription`. `codesign --verify --deep --strict` projde | **Claude** |
| **4** | **Manifest sezení** — trvalý záznam o nahrávání (start, konec, obě stopy, stav, důvod ukončení), obnova po pádu | Po `kill -9` uprostřed nahrávání existuje manifest se stavem `nedokonceno` a oběma cestami k souborům; po restartu appka sezení najde a nabídne dokončení. Ověřeno unit testem nad logikou + jedním ručním během | **Codex** |
| **5** | **Odchozí fronta** — perzistentní stav na disku, exponenciální backoff, idempotence, viditelný stav; **odesílání za killswitchem `DESKTOP_UPLOAD_ENABLED` (výchozí OFF)** | Fronta přežije restart appky a drží pořadí. Při vypnutém killswitchi se **nikdy nezavolá síť** — ověřeno testem, který mockuje odesílací vrstvu a assertuje `toHaveBeenCalledTimes(0)`, včetně stavu, kdy proměnná **není nastavená vůbec** | **Codex** |
| **6** | **Skutečná oprávnění místo atrapy** — `systemPreferences.askForMediaAccess('microphone')` a `getMediaAccessStatus('screen')`; onboarding ukáže pravdu | `permission:request` už nevrací natvrdo `{granted:true}`. Odmítnutí mikrofonu se v onboardingu projeví **červeně** a tlačítko vede do Nastavení systému, ne k dialogu (macOS ho po odmítnutí znovu nezobrazí). Kalendář je **volitelný** — jeho odmítnutí onboarding nezablokuje | **Codex** |
| **7** | **Přihlášení LuDone (jen strana desktopu)** — OAuth 2.1 + PKCE S256, loopback `127.0.0.1`, token v Klíčence přes `safeStorage`, odhlášení maže token | Kód existuje, je pokrytý testy nad `code_verifier`/`code_challenge` a nad ověřením `state`. **Naostro se nespouští** — registrace klienta na serveru je stopka S3 | **Codex** |
| **8** | **Dokumentace serverového modulu** — `docs/server-modul/` | Předávka obsahuje: datový model a SQL migrace, kontrakt endpointů (chunked upload, dokončení, idempotence), RBAC, frontu přepisu, a **co přesně desktop od serveru potřebuje**. Psaná tak, aby šla vzít do jiného repozitáře a stavět podle ní bez dalšího výzkumu | **Codex** |

**Pořadí:** 1 → 2 → 3, pak 4–8 podle toho, co je volné. **Etapa 2 musí být před 3** — bez měřidla
se opravy neověří.

---

## Rozhodnutí

### Rozhodnutá — neotvírat znovu

| # | Rozhodnutí | Kdy |
|---|---|---|
| **D1** | **Přihlášení = LuDone auth** (OAuth 2.1 + PKCE proti `app.ludone.cz`), ne holý Google a ne bearer token | 24. 8. |
| **D2** | **Bez certifikátu.** Ad-hoc podpis, testuje Dan na svém Macu. Bundle id `cz.ludone.desktop` | 24. 8. |
| **D3** | **Server se teď nevyvíjí** — vzniká jen dokumentace modulu | 24. 8. |
| **D4** | **Fronta se postaví, odesílání zůstane za killswitchem** (výchozí OFF) | 24. 8. |
| **D5** | **Kalendář čte server**, je **volitelný**, a **nahrávat jde i bez schůzky v kalendáři** | 24. 8. |
| **D6** | **LuTrack a nahrávání jsou dvě samostatné agendy** s nezávislým životním cyklem. Sdílí shell, projektový kontext a doporučení z kalendáře — **nejsou jedna společná relace** | 24. 8. |
| **D7** | **Companion pohledy (iPhone, Watch) se nedělají** — A5 mobil zavírá a iPhone druhou stranu hovoru zachytit neumí | 24. 8. |

### Otevřená — běh je NEŘEŠÍ, jede kolem nich

| # | Otázka | Co s tím běh udělá |
|---|---|---|
| **O1** | **Výtvarný směr** (A / B1 / B2 / C) a v něm písmo a akcent | Běh **nekreslí nové obrazovky.** Sahá jen na chování, které na vzhledu nestojí: tray, oprávnění, fronta, manifest |
| **O2** | **Čím přepisovat a kolik hodin měsíčně** | Jde do dokumentace jako otevřený parametr s dopadem na cenu a limit délky požadavku |
| **O3** | **Právní rámec nahrávání** (souhlas, retence) | Nutná podmínka **ostrého použití**, ne vývoje. Zapsáno v `DAN-TODO.md` |
| **O4** | **Kanál distribuce a automatické aktualizace** | Mimo rozsah — testuje Dan na svém Macu |

---

## 🛑 Stopky — co běh NESMÍ sám

Na stopce se **přeskakuje, nezastavuje**. Položka jde do `DAN-TODO.md` i do checkpointu jako
„čeká na tebe" a běh pokračuje na tom, co na ní nezávisí.

| # | Stopka | Místo toho |
|---|---|---|
| **S1** | **Jakýkoli zápis do `ludone-app`** — je to produkční repozitář a D3 říká, že se teď nevyvíjí | Zapsat do dokumentace, co by tam bylo potřeba |
| **S2** | **Zapnutí killswitche `DESKTOP_UPLOAD_ENABLED`** | Nechat OFF, do checkpointu napsat, že je připravený |
| **S3** | **Registrace OAuth klienta na serveru** — zásah do produkční autentizace | Napsat přesně, co zaregistrovat, do `docs/server-modul/` a do `DAN-TODO.md` |
| **S4** | **Vytvoření nebo instalace podpisového certifikátu**, změna klíčenky, cokoli, co chce heslo správce | Zůstat u ad-hoc podpisu (D2) |
| **S5** | **Smazání worktree `zvuk`** nebo čehokoli z `.runtime/` | Jsou to důkazy měření — archivovat, nemazat |
| **S6** | **Jakýkoli zápis do Tabidoo**, rotace secretů, externí komunikace | Zapsat do checkpointu |
| **S7** | **Nové obrazovky nebo změna vzhledu** — výtvarný směr není vybraný (O1) | Sahat jen na chování, ne na vzhled |

---

## Mantinely a premisy

### Mantinely

- **Zákaz zvyšování práv.** Nic, co si řekne o heslo správce. (21. 8. Danovi takový dialog vyskočil
  a pravidlo tehdy chybělo.)
- **Zákaz commitu tajemství.** Token, klíč ani `.p12` nikdy do repozitáře.
- **Jeden worktree = jeden zapisovatel.** Dvě zapisující session v jednom stromě si přepisují práci.
- **Zákaz vyrábět si výjimku z brány.** Žádný `skip`, žádný `*-exempt` marker, žádný zápis do
  baseline. Když si vykonavatel myslí, že je namístě, napíše to do `notes` a rozhodne orchestrátor.
- **🔴 Zelený test není důkaz funkčnosti.** Rozlišuj ✅ ověřeno naostro · 🧪 zelené testy ·
  ⛔ neověřeno. Tvrzení o zvukové cestě smí být nejvýš 🧪, pokud ho nespustil člověk.
- **Money-critical a bezpečnostní kód od Codexu vždy přes Claude review nad diffem.** Sem patří
  fronta (idempotence), přihlášení (token) a kontrola odesílatele IPC.

### Premisy — a čísla, kterými jsou změřené

| Premisa | Změřeno |
|---|---|
| Zachycení systémového zvuku na macOS v Electronu **funguje** | Křížová korelace systémové stopy s `Glass.aiff` **0,9638**, u mikrofonu **0,0098**; mikrofon byl **se zvukem tišší** (−46,0 dB) než v tichu (−44,2 dB) ⇒ přeslech vyloučen. Reprodukováno v 5 bězích, Electron 37 i 43 |
| Dvoustopé nahrávání je zapojené a odolné | Uříznutý soubor se dekóduje čistě do posledního celého paketu |
| WebM je zvukově v pořádku | 84 paketů, souvislé PTS po 60 ms, 241 920 vzorků = přesně 5,040 s. Hlavička Opus je **platná** |
| Chybí jen celková délka | `ffprobe` vrací `N/A`; po `ffmpeg -c copy` vrací 5,040000, dekódovaný zvuk **bitově totožný** |
| 🔴 **Rozhoduje Záznam obrazovky, ne mikrofon** | Loopback jde přes `getDisplayMedia` ⇒ `kTCCServiceScreenCapture` |
| ⛔ **Google Meet netestován** | Testoval se `afplay`. A6 je vyřazovací kritérium — viz `DAN-TODO.md` |
| ⛔ **Rozjezd stop na hodinové nahrávce neměřen** | Všechna měření trvala 5 sekund |

🔴 **Premisu, na které stavíš, ověř spuštěním, ne přečtením.** Počty a čísla řádků v zadání ber
jako orientační; když naměříš jiné, řiď se **měřením** a rozdíl zapiš.

---

## Co běh NEDĚLÁ

- **Nekreslí nové obrazovky ani nemění vzhled** — výtvarný směr není vybraný.
- **Nesahá do `ludone-app`.**
- **Nespouští nic, co potřebuje GUI, zvuk nebo oprávnění.** Electron z omezeného sandboxu
  nenaskočí (noční pokus 20.–21. 8. skončil na `kLSNoExecutableErr`) a sandbox nemá audio zařízení.
  ⇒ **`ui-smoke` a `audio-smoke` se v běhu NESPOUŠTÍ**; napíší se, zařadí do CI s komentářem, proč
  tam nepoběží, a spustí je Dan.
- **Neřeší distribuci, certifikát ani přepis.**

---

## Rozpočet a čas

| | |
|---|---|
| **Odhad** | 6,5–10 člověkodnů práce vykonavatelů |
| **Hotovost** | 0 Kč — nic se nekupuje (S4 zakazuje certifikát, D3 vylučuje serverové náklady) |
| **Dělba** | **Codex** etapy 2, 4, 5, 6, 7, 8 · **Claude** etapy 1 a 3 (konsolidace zdrojů pravdy a bezpečnostní hranice IPC) |
| **Konsolidace** | Vždy Claude: přečíst diff, pustit brány, commitnout, odpovídat za výsledek |

**Dotažení do produkce** se tu netýká ničeho — `ludone-desktop` nemá nasazení. Etapa končí
commitem na `main` přes PR se zelenými checky.

---

## Checkpointy

Po každé etapě `▪ CHECKPOINT n/8 — …` se stavem akceptačního kritéria. Na konci běhu plný report
se sekcemi **Rozhodl jsem sám** a **Čeká na tebe (přeskočeno)**.
