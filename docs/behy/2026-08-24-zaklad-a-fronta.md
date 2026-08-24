# Briéf běhu — základ, měřidlo a odchozí fronta

> ## ✅ VERZE 3 — HOTOVO, SPUSTITELNÉ
>
> **Naposledy upraveno 24. 8. 2026 ve 22:05.** Když čteš tohle, čteš finální verzi — nespouštěj
> nic, co ti zbylo v hlavě z dřívějška.
>
> **Změny proti verzi 2** (všechny z nálezů session, která běh povede, změřených proti repozitáři):
>
> 1. 🔴 **Kritérium E1 bylo NESPLNITELNÉ a je přepsané.** Zakazovalo řetězec, který sedí na šesti
>    místech včetně tohoto briéfu — brána by zčervenala na vlastním zadání. Skutečná práce je
>    **archivovat důkazy do repa**, protože `NALEZ.md` dnes v gitu není vůbec.
> 2. 🔴 **Rozpor E1b × S4 vyřešen.** E1b chtěl jediný worktree, S4 zakazovala mazat ten s důkazy.
>    Nově: **archivovat, commitnout, teprve pak odstranit.**
> 3. ⚠️ **OAuth server je MCP serveru, ne LuDone účtu** (`scopes_supported` = `mcp:read`,
>    `mcp:draft`) ⇒ **E7 nesmí tvrdit, že desktop umí odesílat.**
> 4. **`npm run gates` ani `test:unit` neexistují** — E2 je zakládá od nuly; E3–E7 je nesmí
>    předpokládat.
> 5. **macOS nemá `timeout`** — do akceptačních skriptů ho nedávat, `EXIT=127` vypadá jako pád.
>
> *Verze 2 (téhož večera) přepsala verzi 1 po průzkumu doložených příčin selhání dlouhých
> autonomních běhů a po ověření Codexu, Orcy a OAuth serveru naostro.*

---

## ZAČNI TADY

Tenhle soubor je **soběstačný**. Kdo ho čte, nepotřebuje žádnou konverzaci — a nesmí ji potřebovat,
protože běh spouští **nová session**, která u přípravy nebyla.

**Pořadí čtení:**

1. tenhle soubor celý
2. `../../PLAN.md` — širší kontext (11 etap, z toho tenhle běh dělá osm)
3. `../../DAN-TODO.md` — co dělá Dan, čeho se běh nedotýká
4. `../../specs/E*.md` — detail po soubor a řádek, když etapa potřebuje víc

**Běh se řídí tímhle souborem, ne konverzací.** Konverzaci sežere komprese, soubor ne. Když si
zadání odporuje se stavem repozitáře, platí **měření**, ne text — a rozdíl se zapíše.

---

## Problém a cíl

**Problém.** Zachycení dvou zvukových stop na macOS je změřené a funguje, ale kolem něj není nic:
kód aplikace není ani na `main`, projekt nemá jediný automatický test, přihlášení a oprávnění jsou
atrapy, a nahrávka po skončení nikam nejde — jen leží na disku bez záznamu, že vznikla.

**Cíl.** Dostat projekt do stavu, kdy má **odkud startovat**, **čím se měřit**, opravené **doložené
vady**, **odchozí frontu**, která nahrávku podrží, **skutečné přihlášení** a **dokumentaci
serverového modulu** pro pozdější stavbu.

**Jak se pozná hotovo.** Všech osm etap má zelené akceptační kritérium, každé je spustitelný příkaz
s exit kódem, a v checkpointu je u každého **doslovný výpis**, ne věta „hotovo".

---

## 🔴 Tři pravidla, která drží celý běh

Pocházejí z doložených příčin selhání autonomních běhů. Nejsou to formality — každé z nich stojí
proti jedné konkrétní, změřené kategorii selhání.

### 1. Hotovo znamená DOLOŽENO, ne prohlášeno

Největší kategorie selhání agentních běhů je **„agent tvrdí, že je hotovo" — 38,5 % případů**.
Mechanismus: agent zavolá nástroj, dostane chybu, vyhodnotí ji jako zotavitelnou a úkol prohlásí
za dokončený. Výstup přitom nemusí být nepravdivý, jen neúplný — proto se to špatně chytá.

**Proto:** akceptační kritérium každé etapy je **příkaz vracející exit kód**, a do checkpointu
patří jeho **doslovný výpis**. Sebehodnocení („ověřil jsem, funguje") není důkaz a nesmí etapu
uzavřít.

### 2. Na měřidlo se nesahá

Doloženo napříč modely: agent pod tlakem **smaže nebo změkčí padající test** místo opravy kódu,
a **silnější modely to dělají víc, ne míň**. Není to vada, která zmizí s lepším modelem.

**Proto:** existující testy a brány se nesmí upravovat kvůli průchodu. Když se etapa domnívá, že
je výjimka namístě, napíše to do `notes` a rozhodne orchestrátor. Zákaz platí i na `*-exempt`
markery, `skip` a zápis do baseline. **Při selhání se opravuje VADA, ne MĚŘIDLO.**

### 3. Zapisuje vždy jen jeden

Paralelní agenti selhávají na rozptýlených rozhodnutích — doložený případ: dva agenti stavěli
tutéž hru a jeden začal kreslit pozadí v cizím výtvarném stylu, ačkoli oba viděli zadání.
Závěr praxe: **víc agentů smí myslet, zapisovat smí jen jeden.**

**Proto:** jeden worktree = jeden zapisovatel. Souběžné etapy jedou ve dvou **různých** worktrees.
Diff čte, brány pouští a commituje vždy orchestrátor.

---

## Co je změřené — a co ne

Premisy s čísly. **Tvrzení o dnešním stavu kódu ověř spuštěním, ne přečtením** — počty a čísla
řádků v zadání jsou orientační a stárnou už během běhu.

| Premisa | Čím je změřená | Stav |
|---|---|---|
| Zachycení systémového zvuku v Electronu funguje | Křížová korelace systémové stopy s `Glass.aiff` **0,9638**, u mikrofonu **0,0098**; mikrofon byl **se zvukem tišší** (−46,0 dB) než v tichu (−44,2 dB) ⇒ přeslech vyloučen. 5 běhů, Electron 37 i 43 | ✅ |
| Dvoustopé nahrávání je odolné | Uříznutý soubor se dekóduje čistě do posledního celého paketu | ✅ |
| WebM je zvukově v pořádku | 84 paketů, souvislé PTS po 60 ms, 241 920 vzorků = přesně 5,040 s. Hlavička Opus **platná** | ✅ |
| Chybí jen celková délka | `ffprobe` vrací `N/A`; po `ffmpeg -c copy` vrací 5,040000, dekódovaný zvuk **bitově totožný** | ✅ |
| Rozhoduje **Záznam obrazovky**, ne mikrofon | Loopback jde přes `getDisplayMedia` ⇒ `kTCCServiceScreenCapture` | ✅ |
| Codex je funkční | `codex exec` smoke test: CLI 0.149.1, `gpt-5.6-sol`, **EXIT=0**, `Logged in using ChatGPT`. Sandbox hlásí `workspace-write [workdir, /tmp, $TMPDIR]` ⇒ **`/tmp` je zapsatelný**, věta o `.lab/` je na téhle verzi zbytečná | ✅ |
| OAuth server LuDone je živý | `curl .well-known/oauth-authorization-server` → **HTTP 200 na labs i prod**. DCR otevřená, loopback redirect povolen, PKCE S256 povinné, veřejný klient bez secretu | ✅ |
| 🔴 **Ten OAuth server je MCP serveru, ne LuDone účtu** | `scopes_supported` = **`["mcp:read","mcp:draft"]`**, `registration_endpoint` = `…/api/mcp/oauth/register` — **všechny endpointy pod `/api/mcp/`**. Token z něj **nemá scope, kterým by se dala nahrát nahrávka** | ⚠️ |
| Stroj je vytížený | `load average 8,4`, 64 GB volných z 460 | ⚠️ počítej s tím u detekce mrtvého jobu |

⚠️ **Co z toho plyne pro E7 a E8 — a co by jinak nikdo nezachytil:** E7 může skončit „hotovo"
s tokenem, který **na E5 (upload) nestačí**. Přihlášení tím opravdu funguje, ale je to přihlášení
**k MCP toolům**, ne k obecnému REST API. **E7 tedy nesmí tvrdit, že desktop umí odesílat** — smí
tvrdit jen, že se přihlásí a zná identitu uživatele. Most na REST je obsah dokumentace v **E8**
(`kontrakt-desktopu.md`) a podle D3 se staví **jen na labs**.
| 🔴 **Google Meet netestován** | Testoval se `afplay`. A6 je **vyřazovací kritérium** | ⛔ dělá Dan |
| ⛔ **Rozjezd stop na hodinové nahrávce neměřen** | Všechna měření trvala 5 sekund | ⛔ dělá Dan |
| ⛔ **Podpisový řetěz neověřen** | Měřil se mechanismus, ne řetěz — a špatné oprávnění | ⛔ odloženo (D2) |

---

## Rozhodnutí

### Platná — neotvírat znovu

| # | Rozhodnutí |
|---|---|
| **D1** | Přihlášení = **LuDone auth** (OAuth 2.1 + PKCE proti `app.ludone.cz`), ne holý Google, ne bearer token |
| **D2** | **Bez certifikátu.** Ad-hoc podpis, testuje Dan na svém Macu. Bundle id `cz.ludone.desktop` |
| **D3** | Serverový modul se **nevyvíjí**, vzniká dokumentace. **Výjimka: most OAuth → REST smí vzniknout, ale jen na labs** |
| **D4** | Fronta se postaví, **odesílání zůstane za killswitchem** (výchozí OFF) |
| **D5** | Kalendář čte server, je **volitelný**, a **nahrávat jde i bez schůzky v kalendáři** |
| **D6** | **LuTrack a nahrávání jsou dvě samostatné agendy** s nezávislým životním cyklem — sdílí shell, projektový kontext a doporučení z kalendáře, ale **nejsou jedna společná relace** |
| **D7** | Companion pohledy (iPhone, Watch) se **nedělají** |

### Otevřená — běh je NEŘEŠÍ

| # | Otázka | Co s tím běh udělá |
|---|---|---|
| **O1** | Výtvarný směr, písmo, akcent | **Nekreslí nové obrazovky.** Sahá jen na chování, které na vzhledu nestojí |
| **O2** | Čím přepisovat, kolik hodin měsíčně | Do dokumentace jako otevřený parametr s dopadem na cenu a limit délky |
| **O3** | Právní rámec (souhlas, retence) | Podmínka **ostrého použití**, ne vývoje |
| **O4** | Distribuce a aktualizace | Mimo rozsah — testuje Dan na svém Macu |

---

## 🛑 Stopky

Na stopce se **přeskakuje, nezastavuje**. Položka jde do `DAN-TODO.md` i do checkpointu jako
„čeká na tebe", a běh pokračuje na tom, co na ní nezávisí. Celý běh se zastaví jen tehdy, když bez
toho rozhodnutí není co dělat.

| # | Stopka | Místo toho |
|---|---|---|
| **S1** | 🔴 **Merge do `main` v `ludone-app`** — merge tam spouští **deploy na produkci** | Práce na větvi, nasazení na **labs**, PR nechat otevřený |
| **S2** | Zapnutí killswitche `DESKTOP_UPLOAD_ENABLED` | Nechat OFF, do checkpointu napsat, že je připravený |
| **S3** | Vytvoření nebo instalace podpisového certifikátu, změna klíčenky, cokoli s heslem správce | Zůstat u ad-hoc podpisu (D2) |
| **S4** | Smazání worktree `zvuk` nebo `.runtime/` **BEZ PŘEDCHOZÍ ARCHIVACE** | Nejdřív zkopírovat do `dukazy/` a commitnout, **teprve pak** smět worktree odstranit *(upřesněno: původní znění „archivovat, nemazat" si odporovalo s kritériem E1b, které chce jediný worktree)* |
| **S5** | Jakýkoli zápis do Tabidoo, rotace secretů, externí komunikace | Zapsat do checkpointu |
| **S6** | Nové obrazovky nebo změna vzhledu (O1) | Sahat na chování, ne na vzhled |
| **S7** | Cokoli, co si řekne o **heslo správce** | Zastavit a zapsat |

---

## Mantinely

- **Zákaz zvyšování práv.** Nic, co si řekne o heslo správce. *(21. 8. Danovi takový dialog vyskočil
  a pravidlo tehdy chybělo.)*
- **Zákaz commitu tajemství.** Token, klíč ani `.p12` nikdy do repozitáře.
- **Zákaz vyrábět si výjimku z brány** (pravidlo 2 výš).
- **Zelený test není důkaz funkčnosti.** Rozlišuj ✅ ověřeno naostro · 🧪 zelené testy ·
  ⛔ neověřeno. Tvrzení o zvukové cestě smí být nejvýš 🧪, pokud ho nespustil člověk.
- **Money-critical a bezpečnostní kód vždy přes review nad diffem** — fronta (idempotence),
  přihlášení (token), kontrola odesílatele IPC.
- **Max 3 opravná kola na etapu.** Pak zastavit, nechat rozdělané a napsat, co přesně padá.

---

## Etapy jako DAG

Závislosti jdou do `orca orchestration task-create --deps`, takže pořadí drží Orca, ne něčí hlava.
`task-list --ready` řekne, co smí start.

| # | Etapa | Závisí na | Kdo píše |
|---|---|---|---|
| **E1** | `AGENTS.md` + oprava rozporů v dokumentech | — | Codex |
| **E1b** | Merge `feat/kostra-appky` do `main` | E1 | **Claude** (sandbox neumí git index) |
| **E2** | Měřidlo — lint, typecheck, unit testy, CI, **oprava audio brány** | E1b | Codex |
| **E3** | Doložené vady — tray, IPC, plist, bundle id | E2 | Codex |
| **E4** | Manifest sezení a obnova po pádu | E2 | Codex |
| **E5** | Odchozí fronta + killswitch | E4 | Codex |
| **E6** | Skutečná oprávnění místo atrapy | E2 | Codex |
| **E7** | LuDone auth — strana desktopu | E2 | Codex |
| **E8** | Dokumentace serverového modulu | — | Codex |

**Souběh:** E3, E4, E6, E7 na sobě nezávisí. Můžou jet paralelně, **ale každá ve vlastním worktree**
— dva zapisovatelé v jednom stromě si přepisují práci a důkaz z takového běhu je neplatný, i když
oba doběhnou „úspěšně". E8 nezávisí na ničem a dá se pustit hned.

### Vlastnictví souborů

🔴 **Tohle patří do zadání každé etapy jako VÝČET CEST, ne jako zákaz v próze.** Próza prohraje
s „tady to logicky patří taky"; výčet umí Codex použít jako filtr při každé jednotlivé editaci.
Doloženo, že to funguje: v běhu, kde ve stromě pracovaly tři ruce, si Codex cizích změn všiml,
napsal do `notes`, že jsou mimo jeho vlastnictví, a **nedotkl se jich**.

Cesty jsou relativní ke kořeni repozitáře **po etapě E1b** (do té doby leží kód aplikace na větvi
`feat/kostra-appky` ve worktree `.claude/worktrees/kostra`).

| ID | SMÍŠ MĚNIT | NESMÍŠ MĚNIT |
|---|---|---|
| **E1** | `AGENTS.md` · `ROZHODNUTI.md` · `README.md` · `dukazy/**` | jakýkoli `.js/.jsx/.cjs/.mjs` · `package.json` · `.github/**` |
| **E2** | `eslint.config.js` · `jsconfig.json` · `vitest.config.js` · `tests/**` · `scripts/akceptace/**` · `scripts/audio-smoke.mjs` · `.github/workflows/**` · `package.json` *(jen pole `scripts` a `devDependencies`)* | `electron/**` · `src/**` — E2 staví měřidlo, neopravuje kód |
| **E3** | `electron/main.cjs` · `electron/preload.cjs` · `src/App.jsx` · `scripts/package-mac.mjs` · `tests/tray-authority.test.js` · `tests/ipc-sender-guard.test.js` | `src/features/**` · `src/components/**` · existující testy jiných etap |
| **E4** | `electron/main.cjs` *(jen zápis manifestu)* · `src/lib/manifest.js` *(nový)* · `tests/manifest.test.js` | `src/features/recording/RecordingCard.jsx` · cokoli z E5 |
| **E5** | `src/lib/queue.js` *(nový)* · `electron/queue.cjs` *(nový)* · `tests/queue.test.js` · `.env.example` | `src/lib/manifest.js` *(vlastní E4)* · `electron/main.cjs` |
| **E6** | `electron/main.cjs` *(jen `permission:request`)* · `src/components/Onboarding.jsx` · `tests/permissions.test.js` | `src/App.jsx` · cokoli z E3 |
| **E7** | `src/lib/oauth.js` *(nový)* · `electron/auth.cjs` *(nový)* · `tests/pkce.test.js` · `tests/oauth-state.test.js` | `electron/main.cjs` · `src/components/Settings.jsx` |
| **E8** | `docs/server-modul/**` | **cokoli mimo `docs/`** — E8 nepíše ani řádek kódu |

**Když etapa najde v pracovním stromě změny mimo svůj výčet: nechá je být a zapíše je do `notes`.**
Neuklízí je, nevrací, nepřebírá.

⚠️ **Kolize, kterou souběh vyrábí:** E3, E4 a E6 všechny chtějí `electron/main.cjs`. Buď je pusť
**za sebou**, nebo každou ve vlastním worktree a **sloučení nech na orchestrátorovi** — ale nikdy
dvě naráz do téhož stromu.

### Akceptační kritéria — spustitelné skripty

🔴 **Každá etapa si jako součást své práce vytvoří skript `scripts/akceptace/<ID>.sh`.** Kritérium
není řetěz podmínek slepený `&&` — ten při selhání neřekne, **co** selhalo, a jedna přehlédnutá
negace ho promění v bránu, která projde vždycky.

**Tvar, který každý ten skript má mít:**

```bash
#!/usr/bin/env bash
# Akceptace <ID>. Vypíše PASS/FAIL za každou podmínku a skončí 1, když aspoň jedna padne.
chyby=0
zkontroluj() {                     # zkontroluj "<popis>" <příkaz…>
  local popis="$1"; shift
  if "$@" > /tmp/akc.out 2>&1; then
    echo "PASS  $popis"
  else
    echo "FAIL  $popis"; sed 's/^/      | /' /tmp/akc.out; chyby=$((chyby+1))
  fi
}
# … jednotlivé kontroly …
echo "---"; echo "chyb: $chyby"; exit $(( chyby > 0 ? 1 : 0 ))
```

Proč zrovna takhle: **výpis skriptu JE ten důkaz**, který patří do checkpointu. Řádek `FAIL` se
jménem podmínky říká, co opravit; `&&` řetěz řekne jen „nula". A exit kód se měří **před rourou**
(`cmd > /tmp/out 2>&1; echo $?`) — za `| tail` čteš status roury a fail-open brána vypadá jako
úspěch.

**Co má která etapa kontrolovat:**

| ID | Podmínky |
|---|---|
| **E1** | `AGENTS.md` existuje · **archivovaný `dukazy/zvuk-2026-08-20/NALEZ.md` existuje a jeho závěr odkazuje na `NALEZ-OPAKOVANI.md`** · `ROZHODNUTI.md` neobsahuje „18–30", „repo je zatím jen lokální" ani „vadnou hlavičku Opus" · každý opravený rozpor má zapsáno, čím byl nahrazen |
| **E1b** | `git merge-base --is-ancestor 2bb09ce main` · `electron/main.cjs` a `src/App.jsx` existují v kořeni · **`dukazy/` obsahuje archiv z obou worktrees** · `git worktree list` má **1 řádek** · `npm ci && npm run build && npm run package:mac` projde na čerstvém klonu |

🔴 **Past, na kterou první verze tohohle briéfu naletěla** (našla ji session, která běh povede —
změřeno 24. 8. ve 21:40, díky):

Kritérium E1 původně znělo *„žádný výskyt řetězce «SYSTÉMOVÝ ZVUK NEFUNGUJE» bez značky PŘEKONÁNO"*.
**Takové kritérium nemohlo zezelenat nikdy.** Ten řetězec dnes sedí na **šesti místech a ani jedno
z nich není ten rozpor** — jsou to dokumenty, které o rozporu **mluví**: `PLAN.md:42`,
`specs/E0-startovaci-cara.md:233,265,554` a **sám tenhle briéf**. Brána by tedy zčervenala na svém
vlastním zadání.

A skutečný `NALEZ.md` **v gitu vůbec není** — leží v `.claude/worktrees/zvuk/NALEZ.md`, a worktrees
jsou v `.gitignore`. `grep -rn` po disku ho najde, `git grep` ne, `git clone` ho nedostane vůbec.
**Ten důkaz měření dnes existuje v jediné kopii mimo verzování.**

**Z toho plyne skutečná práce E1 a E1b**, kterou původní znění zakrývalo:

1. **E1 archivuje důkazy do repa.** `dukazy/zvuk-2026-08-20/` dostane `NALEZ.md` a
   `NALEZ-OPAKOVANI.md` z worktree `zvuk`; do závěru `NALEZ.md` se **na první obrazovku** doplní,
   že ho o den později vyvrátilo `NALEZ-OPAKOVANI.md`, i s korelačními čísly. Nemazat ani
   nepřepisovat historii — doplnit.
2. **E1b archivuje i `.runtime/audio-proof-*` z worktree `kostra`** (aspoň jeden tichý a jeden
   zvukový běh + `proof-files.json`), teprve pak worktrees odstraní.
3. Dokumenty, které o rozporu **mluví** (`PLAN.md`, `specs/**`, tenhle briéf), se **nemění** — je
   to jejich obsah, ne dluh.

⚠️ **A obecné poučení, které si odnes do všech dalších bran:** kritérium tvaru „nikde v repu
nesmí být řetězec X" **zčervená i na dokumentaci, která X popisuje** — včetně sebe sama. Když
takové kritérium píšeš, hledej v **konkrétních cestách**, ne v celém stromě.
| **E2** | `npm run gates` = 0 · **a tři sabotáže demonstrované skriptem** (níž) |
| **E3** | `plutil -p` na release bundlu vypíše `NSAudioCaptureUsageDescription` · `codesign --verify --deep --strict` projde · `scripts/package-mac.mjs` neobsahuje `cz.ludone.desktop.prototype` · unit testy `tray-authority` a `ipc-sender-guard` zelené |
| **E4** | unit testy `manifest` zelené · mezi nimi test, že po simulovaném pádu **před prvním chunkem** manifest existuje se stavem `nedokonceno` |
| **E5** | unit testy `queue` zelené · **a test s NENASTAVENÝM `DESKTOP_UPLOAD_ENABLED`**, který assertuje `toHaveBeenCalledTimes(0)` na odesílací vrstvě |
| **E6** | unit testy `permissions` zelené · `grep -c "granted: true" electron/main.cjs` = **0** (atrapa je pryč) · test, že odmítnutý mikrofon nevrací `granted` |
| **E7** | `curl -sf https://labs.ludone.cz/.well-known/oauth-authorization-server \| jq -e .registration_endpoint` — **ověřitelné naostro** · unit testy `pkce` a `oauth-state` zelené |
| **E8** | `docs/server-modul/` existuje · `datovy-model.md` obsahuje `recordings` · `autentizace.md` obsahuje `code_challenge_method` · `kontrakt-desktopu.md` obsahuje `DESKTOP_UPLOAD_ENABLED` · každý soubor má aspoň 40 řádků *(kontrola proti prázdné slupce)* |

### 🔴 E2: sabotáže jsou KROK, ne komentář

Sabotáž popsaná v komentáři nikdo nespustí. E2 proto vytvoří **`scripts/akceptace/E2-sabotaze.sh`**,
který každou z nich provede, změří a vrátí strom do původního stavu.

```bash
# Kostra jedné sabotáže — a POŘADÍ, které se nesmí obrátit:
# 1) brána nad NEDOTČENÝM stromem musí být ZELENÁ, jinak STOP (neuklízej, neměř)
# 2) mutace → grep -c na vložený vzorec MUSÍ být > 0, jinak sabotáž MINULA a o bráně nevíš nic
# 3) spustit bránu → očekává se ČERVENÁ, doslovný výpis do logu
# 4) git checkout HEAD -- <cesta>   (HEAD, ne `--` samotné: to obnovuje z INDEXU)
# 5) brána znovu ZELENÁ, jinak zbyla půlka sabotáže v kódu
```

**Tři povinné sabotáže:**

| # | Mutace | Očekávání |
|---|---|---|
| a | odstranit kontrolu pořadí chunků v `appendRecordingChunk` | unit test **PADNE** |
| b | přejmenovat tlačítko „Zastavit nahrávání" | `ui-smoke` **PADNE** |
| c | tichý běh, zatímco na pozadí hraje zvuk | brána běh **ZAHODÍ a zopakuje** — ne vyhlásí neúspěch |

⚠️ Sabotáž **c** potřebuje zvuk, takže **ji spustí Dan, ne běh.** E2 ji připraví jako skript
a v checkpointu ji označí ⛔ neověřeno. Sabotáže **a** a **b** běh provést umí a musí.

⚠️ A pozor na past, která vypadá jako nález: **zelená po sabotáži má tři různé příčiny** — test je
slabý (artefakt, který assert čte, se změnil) × sabotáž minula cíl (artefakt je bajt po bajtu
stejný) × invariant přežil. Rozliší je jedině to, že si vypíšeš, **co assert čte, před mutací
a po ní.** Bez toho „nezčervenalo" není nález, ale prázdný běh.

---

## Šablona zadání pro jednu etapu

Každá etapa dostane **vlastní soubor** ve scratchpadu a Codexovi se předá **cesta k němu**, nikdy
obsah přes `$(cat …)` — ten se ověřeně uřízne uprostřed věty. Soubor musí obsahovat všech devět
bodů; chybějící bod je díra, kterou si Codex vyplní po svém.

```markdown
# Etapa <ID> — <název>

## 1. Co se staví
<jedna věta, co má na konci existovat>

## 2. Proč
<odkaz na rozhodnutí Dxx nebo na nález; ne „protože to je lepší">

## 3. Soubory, které VLASTNÍŠ
SMÍŠ MĚNIT: <výčet cest>
NESMÍŠ MĚNIT: <výčet cest — zvlášť existující testy a brány>
Když v pracovním stromě najdeš změny mimo svůj výčet, NECH JE BÝT a zapiš je do notes.

## 4. Pořadí kroků
🔴 Nejdřív soubory na disk, pak testy, teprve potom odpověď.
JSON na konci je hlášení o práci, která na disku UŽ JE — ne plán.
<číslované kroky>

## 5. Jak to otestuješ
<konkrétní příkazy; ve worktree nejsou node_modules — cesty do kořene>

## 6. Důkaz hotovosti
<příkaz, který vrátí 0>
Před odpovědí spusť `git --no-pager status --porcelain`. Když tam tvoje soubory nejsou,
nejsi hotový a nesmíš odpovídat.

## 7. Co NESMÍŠ
- sahat na existující testy a brány kvůli průchodu
- přidávat si výjimku z brány (*-exempt marker, skip, zápis do baseline) — když si myslíš,
  že je namístě, napiš KTEROU a PROČ do notes a nech rozhodnutí na orchestrátorovi
- spouštět cokoli, co čeká na vstup (`GIT_PAGER=cat`, `PAGER=cat`, `git --no-pager`)
- commitovat, pushovat, mergovat

## 8. Když si zadání odporuje se stavem repa
Neřeš to domyšlením. Udělej nejmenší bezpečnou variantu a rozpor zapiš do notes.
Počty a čísla řádků ber jako orientační — když naměříš jiné, řiď se MĚŘENÍM.

## 9. Output contract
Na konci odpovědi vrať JSON:
{
  "summary": "<co jsi udělal>",
  "premisaPlatila": true|false,     // seděl popis stavu repa v zadání? čím se lišil?
  "ocekavanePocty": {
    "novychSouboru": <n>,
    "novychTestu": <n>,             // 🔴 MUSÍ být > 0, nula znamená, že se nestalo nic
    "celkemTestuVeSpustenychSouborech": <n>,
    "zmenenychSouboruMimoVlastnictvi": 0   // 🔴 MUSÍ být 0
  },
  "dukaz": "<DOSLOVNÝ výpis akceptačního příkazu včetně exit kódu>",
  "commitMessage": "<návrh, commit dělá orchestrátor>",
  "notes": ["<rozpory, výjimky, co jsi nechal být>"]
}
```

**Proč zrovna tyhle položky:** `premisaPlatila` třikrát naostro odhalilo, že čísla v zadání
neplatila (jednou „12 mocků" proti 13 naměřeným). `ocekavanePocty` sedělo **pětkrát v řadě** na
kus — je to nejlevnější důkaz, že testy opravdu **běžely**, ne že o nich někdo napsal. A číslo,
které **musí vyjít nula**, si Codex musí spočítat, čímž si sám nastaví past.

---

## Jak se pouští Codex

Kompletní pravidla a pasti: skill **`codex-delegace-orchestrace`** (verze 1.32.0) — **načíst před
návrhem orchestrace, ne až když se to rozbije.**

**Dvě cesty, obě ověřené:**

**A. `codex exec` v panelu Orcy** — sandbox i síťová klec zůstávají, Dan vidí panel:
```bash
~/.claude/scripts/orca-codex.sh start "<etapa>" "<prompt s CESTOU k zadání>" [worktree]
```

**B. `orca orchestration`** — když chceš DAG a blokující čekání:
```bash
orca skills get orchestration --full          # 🔴 NEJDŘÍV: návod od binárky, ne z paměti
orca orchestration run-create --objective "..." --json
orca orchestration task-create --spec "..." --deps '["<task_id>"]' --json
orca orchestration worker-start --task <id> --worktree path:<wt> --agent codex --json
orca orchestration check --wait --types worker_done,escalation,question --timeout-ms 900000 --json
orca orchestration check --ack <deliveryId> --json      # 🔴 bez ACK dostaneš tutéž dávku navěky
orca orchestration worker-release --dispatch <ctx_…>    # 🔴 PŘED `worktree rm`
```
⚠️ **Cena varianty B: Orca startuje agenty BEZ SANDBOXU.** Práci kolem tokenů a přihlášení (E7)
pouštěj variantou A.

**Co po každém běhu udělá orchestrátor, ne Codex:**
1. `git status --porcelain` ve worktree — soubory tam jsou i tehdy, když Codex hlásil, že nemohl commitnout
2. spustit brány **sám**, nevěřit tvrzení
3. přečíst diff **i commit message** — výjimky z bran se píšou tam
4. `git add -A && commit` — **první akce po každém `--write` běhu**, teprve pak sabotáže
5. sabotáže pouští orchestrátor (Codex v sandboxu neumí `git checkout`, takže po sobě neuklidí)

**Detekce mrtvého jobu:** `stat -f %m` na logu, ticho přes 20 minut = mrtvý. `status: running`
v registru **není důkaz života**. `check --wait` timeout je checkpoint — ale **nerozliší živého
od mrtvého**, na to je jen mtime.

---

## Co běh NEDĚLÁ

- **Nekreslí nové obrazovky ani nemění vzhled** (O1).
- **Nemerguje do `main` v `ludone-app`** (S1) — merge tam je deploy na produkci.
- **Nespouští nic, co potřebuje GUI, zvuk nebo oprávnění.** Electron z omezeného sandboxu
  nenaskočí (noční pokus 20.–21. 8. skončil na `kLSNoExecutableErr`) a sandbox nemá audio zařízení.
  ⇒ **`ui-smoke` a `audio-smoke` se v běhu NESPOUŠTÍ.** Napíší se, zařadí do CI **s komentářem,
  proč tam nepoběží**, a spustí je Dan. Etapa, která je „ověří", lže.
- **Neřeší distribuci, certifikát ani přepis.**

---

## Rozpočet, čas, dělba

| | |
|---|---|
| **Odhad** | 6,5–10 člověkodnů práce vykonavatelů |
| **Hotovost** | 0 Kč |
| **Píše** | **Codex `gpt-5.6-sol`** — všech osm etap |
| **Konsoliduje** | **Claude** — merge (E1b), čtení diffu, brány, commity, sabotáže, odpovědnost za výsledek |

**Předletová kontrola** (skill má úplný checklist): Codex jede · místo na disku · žádný cizí job
ve stejném worktree · Orca orchestrace zapnutá.

---

## 🔴 Dvě věci, které si Codex jinak vymyslí

**1. `npm run gates` ani `npm run test:unit` v repu NEEXISTUJÍ.** Dnešní `package.json` má jen
`build`, `start`, `package:mac`, `test:audio`, a v `devDependencies` je **pouze `electron` a `vite`**
— žádný test runner, žádný lint, žádný typecheck. **Etapa E2 je zakládá od nuly**, včetně volby
runneru. Když to v jejím zadání nebude napsané, Codex si příkaz vymyslí, dostane
`command not found` a bránu ohlásí jako nespustitelnou.

*Dobrá zpráva:* `node_modules` ve worktree `kostra` **jsou** (80 balíčků), takže na rozdíl od
`ludone-app` se tam nemusí nic doinstalovávat, aby šlo spustit `vite`.

Etapy E3–E7 tedy **nesmí předpokládat, že `npm run gates` existuje** — dokud E2 nedoběhne, běží
jen `npm run build`. Proto E2 stojí v DAGu před nimi.

**2. macOS nemá `timeout`.** `timeout 180 codex exec …` skončí `EXIT=127, command not found` —
což vypadá jako pád Codexu a vede na úplně špatnou diagnózu. (Chytlo to dnes obě session, každou
zvlášť.) Je to `gtimeout` z coreutils, nebo vlastní strop:

```bash
( sleep 900; kill $$ ) & <prikaz>
```

**Do akceptačních skriptů `timeout` nedávej vůbec** — 127 se pak tváří jako selhání kontroly.

---

## Checkpointy

Po každé etapě `▪ CHECKPOINT n/8 — …` s **doslovným výpisem** akceptačního příkazu.
Na konci plný report se sekcemi **Rozhodl jsem sám** a **Čeká na tebe (přeskočeno)**.

🔴 **Každé rozhodnutí, které běh udělal za Dana, musí být v reportu vypsané.** Tichý default je vada.
