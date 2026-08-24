# Briéf běhu — základ, měřidlo a odchozí fronta

> **Verze 2** (24. 8. 2026 večer). Přepsáno po průzkumu doložených příčin selhání dlouhých
> autonomních běhů a po ověření Codexu, Orcy a OAuth serveru naostro.

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
| Codex je funkční | `codex exec` smoke test: CLI 0.149.1, `gpt-5.6-sol`, effort `ultra`, **EXIT=0** | ✅ |
| OAuth server LuDone je živý | `curl https://app.ludone.cz/.well-known/oauth-authorization-server` → **HTTP 200**. DCR otevřená, loopback redirect povolen, PKCE S256 povinné, veřejný klient bez secretu | ✅ |
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
| **S4** | Smazání worktree `zvuk` nebo čehokoli z `.runtime/` | Jsou to důkazy měření — archivovat, nemazat |
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

### Akceptační kritéria — spustitelné příkazy

Každé vrací **0 = hotovo**. Do checkpointu patří doslovný výpis.

**E1**
```bash
test -f AGENTS.md \
  && ! grep -rn "SYSTÉMOVÝ ZVUK NEFUNGUJE" --include='*.md' . | grep -qv "PŘEKONÁNO" \
  && ! grep -qn "18–30\|repo je zatím jen lokální\|vadnou hlavičku Opus" ROZHODNUTI.md
```

**E1b**
```bash
git merge-base --is-ancestor 2bb09ce main \
  && test -f electron/main.cjs && test -f src/App.jsx \
  && [ "$(git worktree list | wc -l)" -eq 1 ]
```

**E2** — a **sabotáže musí být demonstrované, ne slíbené**:
```bash
npm run gates                      # lint + typecheck + unit, exit 0
# (a) odstraň kontrolu pořadí chunků  → unit test PADNE
# (b) přejmenuj „Zastavit nahrávání"  → ui-smoke PADNE
# (c) tichý běh, zatímco hraje hudba  → brána běh ZAHODÍ a zopakuje
```
🔴 Exit kód měř **před rourou** (`cmd > /tmp/out 2>&1; echo $?`), ne za `| tail` — jinak čteš status
roury a fail-open kontrola vypadá jako nález.

**E3**
```bash
plutil -p "release/LuDone Desktop.app/Contents/Info.plist" | grep -q NSAudioCaptureUsageDescription \
  && codesign --verify --deep --strict "release/LuDone Desktop.app" \
  && ! grep -q "cz.ludone.desktop.prototype" scripts/package-mac.mjs \
  && npm run test:unit -- tray-authority ipc-sender-guard
```

**E4 / E5 / E6** — unit testy nad čistou logikou:
```bash
npm run test:unit -- manifest queue permissions
```
U **E5** musí být mezi testy i ten, který ověří, že při **nenastaveném** `DESKTOP_UPLOAD_ENABLED`
se odesílací vrstva **nezavolá ani jednou** (`toHaveBeenCalledTimes(0)`). Obě polohy přepínače
nestačí — chybějící konfigurace je běžnější stav než špatná.

**E7** — tohle jde ověřit **naostro proti labs**:
```bash
curl -sf https://labs.ludone.cz/.well-known/oauth-authorization-server | jq -e '.registration_endpoint' \
  && npm run test:unit -- pkce oauth-state
```

**E8**
```bash
test -d docs/server-modul \
  && grep -q "recordings" docs/server-modul/datovy-model.md \
  && grep -q "code_challenge_method" docs/server-modul/autentizace.md \
  && grep -q "DESKTOP_UPLOAD_ENABLED" docs/server-modul/kontrakt-desktopu.md
```

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

## Checkpointy

Po každé etapě `▪ CHECKPOINT n/8 — …` s **doslovným výpisem** akceptačního příkazu.
Na konci plný report se sekcemi **Rozhodl jsem sám** a **Čeká na tebe (přeskočeno)**.

🔴 **Každé rozhodnutí, které běh udělal za Dana, musí být v reportu vypsané.** Tichý default je vada.
