# E0 — Startovací čára: kód na main a jeden zdroj pravdy

> Vzniklo 24. 8. 2026 z ultracode analýzy. Master plán: [`../PLAN.md`](../PLAN.md).

## Cíl

Na větvi `main` bude poprvé ležet spustitelný kód aplikace (dnes tam není ani řádek), repozitář dostane `AGENTS.md` jako závazná pravidla práce, dokumentace přestane sama sobě odporovat (systémový zvuk „nefunguje“ × „funguje“, odhady 18–30 × 14,5–23,5, „repo je jen lokální“ × je na GitHubu) a v repozitáři zůstane právě jeden pracovní strom bez zombie větví. Po E0 smí kdokoli přijít, přečíst `ROZHODNUTI.md` + `AGENTS.md`, spustit `npm ci && npm run build && npm run package:mac` a dostat běžící `.app` — bez znalosti historie a bez hledání kódu po lokálních worktrees.

## Kroky

### 1. Zajistit startovní čáru: záložní tagy a čistý strom

V `/Users/dan/Dev/ClaudeCode/ludone-desktop` (kořen, větev main):
```sh
git tag pred-E0/main d84e2d8
git tag pred-E0/kostra 2bb09ce
git tag pred-E0/zvuk 446c467
git push origin pred-E0/main pred-E0/kostra pred-E0/zvuk
git add odpoved-spojeni.json && git commit -m "Record the third Codex run's answer file"
git status --porcelain   # musí být prázdné
```
Tagy jsou jediná pojistka: kdyby se úklid pokazil, `git reset --hard pred-E0/main` vrátí přesně dnešní stav. `odpoved-spojeni.json` se commituje samostatně, aby se nezamíchal do merge commitu.

**Hotovo když:** `git tag | grep pred-E0` vypíše tři tagy, `git ls-remote --tags origin | grep pred-E0` také tři, a `git status --porcelain` je prázdné.

### 2. Mergnout feat/kostra-appky do main (merge, ne rebase ani cherry-pick)

**Skutečný stav ověřený gitem:** `git merge-base main feat/kostra-appky` = `a1ac454` (společný kořenový commit „Start a home for the LuDone desktop launcher"). Od něj main přidal 8 commitů čisté dokumentace (624 řádků: ROZHODNUTI.md, zadani-*.md, schema-*.json, spust-*.sh, odpoved-*.json) a kostra 2 commity čistého kódu (6 443 řádků: electron/, src/, scripts/, package*.json, KOSTRA.md, NAHRAVANI.md). `git merge-tree --write-tree main feat/kostra-appky` skončil s **jediným** konfliktem — `.gitignore`. README.md se slučuje automaticky (main ho od kořene nezměnil, kostra přidala oddíl „Lokální spuštění").

**Volba: `git merge`.** Zdůvodnění:
- **Rebase odpadá** — přepsal by hashe `32da5e2` a `2bb09ce`, které jsou jmenovitě citované v `ROZHODNUTI.md:40` a `NAHRAVANI.md:5`; dokumentace by ukazovala na neexistující commity. Navíc je větev na `origin`, takže by následoval force-push.
- **Cherry-pick odpadá** — má tutéž vadu (nové hashe) a navíc zahodí příbuznost, takže by `git branch --merged` nikdy neukázal, že je kostra v mainu, a nešlo by ji bezpečně smazat.
- **Squash odpadá** — slepil by kostru a nahrávání do jednoho commitu a zahodil dělící čáru mezi „UI existuje" a „zvuk opravdu teče".
- **Merge zachová obojí** a rozešlost tu není problém: obě strany sahají na jiné soubory, konflikt je právě jeden a je triviální.

```sh
cd /Users/dan/Dev/ClaudeCode/ludone-desktop
git merge --no-ff feat/kostra-appky -m "Bring the working app skeleton onto main"
# → CONFLICT (content): Merge conflict in .gitignore  (očekávané, řeší krok 3)
```

**Hotovo když:** `git status` hlásí právě jeden nevyřešený soubor `.gitignore`; `git diff --name-only --diff-filter=U` vypíše jen jeho.

### 3. Vyřešit konflikt .gitignore sjednocením obou stran

Konflikt vzniká proto, že main přidal `release/ nahravky/ .claude/worktrees/` a kostra `.electron-cache/ .npm-cache/ .runtime/` + duplicity. Řešením je **sjednocení bez duplicit**, doplněné o výjimku pro důkazní logy. Přepiš `/Users/dan/Dev/ClaudeCode/ludone-desktop/.gitignore` na přesně tohle:
```gitignore
# Závislosti a sestavení
node_modules/
dist/
out/
release/

# Běhové a cache adresáře pokusů
.runtime/
.runtime-tmp/
.npm-cache/
.electron-cache/
.electron-user-data/
.electron-session-data/

# Nahrávky vzniklé při běhu aplikace
nahravky/

# Systém, logy, tajemství
.DS_Store
*.log
.env*

# Kurátorské důkazy do repozitáře PATŘÍ, i když končí na .log
!dukazy/**/*.log

# Pracovní stromy agentů
.claude/worktrees/
```
Potom:
```sh
git add .gitignore && git commit --no-edit
git merge-base --is-ancestor 2bb09ce main && echo "KOD-NA-MAIN OK"
ls electron/main.cjs src/App.jsx scripts/audio-smoke.mjs
```
**Rozhodnutí o `.runtime/`: zůstává ignorovaná.** Jedna složka `audio-proof-*` má 3,8 MB, z toho ~3,6 MB je Chromium profil (`session-data/GPUCache`, `DawnGraphiteCache`, `DawnWebGPUCache`, `Local Storage`, `Trust Tokens`, `DIPS`) — data, která nic nedokazují a při každém běhu se liší. Ve worktree je takových složek 20+ (celkem ~40 MB). Do repozitáře jde jen ručně vybraný zlomek (krok 4).

**Hotovo když:** Merge commit existuje (`git log --oneline -1` = „Bring the working app skeleton onto main"), `git status --porcelain` je prázdné, `.gitignore` obsahuje `!dukazy/**/*.log` a `git check-ignore -v .runtime/x` hlásí shodu na řádku `.runtime/`.

### 4. Vybrat důkazní artefakty do dukazy/ (a zbytek .runtime nechat ignorovaný)

**Rozhodnutí: do repozitáře jde jen kurátorský výběr ~205 KB, ne celé `.runtime/`.** Kritérium: commitujeme jen to, co bez běhu nejde znovu vyrobit a co samo o sobě něco dokazuje — tedy nahrávky, strojový manifest měření a aplikační log. Chromium profil se zahazuje.

Zdroj: `.claude/worktrees/kostra/.runtime/audio-proof-20260821-committable-packaged` (běh ze zabaleného `release/LuDone Desktop.app`, tedy nejsilnější doklad).
```sh
cd /Users/dan/Dev/ClaudeCode/ludone-desktop
P=.claude/worktrees/kostra/.runtime/audio-proof-20260821-committable-packaged
mkdir -p dukazy/zvuk-2026-08-21
cp "$P/silence/user-data/nahravky/2026-08-21T06-39-05-699Z-ae649b64-mikrofon.webm" dukazy/zvuk-2026-08-21/ticho-mikrofon.webm     # 85 169 B
cp "$P/silence/user-data/nahravky/2026-08-21T06-39-05-699Z-ae649b64-system.webm"   dukazy/zvuk-2026-08-21/ticho-system.webm       # 1 351 B
cp "$P/sound/user-data/nahravky/2026-08-21T06-39-12-336Z-e806fb48-mikrofon.webm"   dukazy/zvuk-2026-08-21/zvuk-mikrofon.webm      # 85 517 B
cp "$P/sound/user-data/nahravky/2026-08-21T06-39-12-336Z-e806fb48-system.webm"     dukazy/zvuk-2026-08-21/zvuk-system.webm        # 27 993 B
cp "$P/proof-files.json"          dukazy/zvuk-2026-08-21/proof-files.json
cp "$P/silence/application.log"   dukazy/zvuk-2026-08-21/ticho-application.log
cp "$P/sound/application.log"     dukazy/zvuk-2026-08-21/zvuk-application.log
cp .claude/worktrees/zvuk/NALEZ-OPAKOVANI.md dukazy/zvuk-2026-08-21/
chmod 644 dukazy/zvuk-2026-08-21/*
du -sh dukazy/   # očekávaně ~205 KB
afplay dukazy/zvuk-2026-08-21/ticho-mikrofon.webm 2>/dev/null || ffplay -autoexit -nodisp dukazy/zvuk-2026-08-21/ticho-mikrofon.webm
```
**NEcommituje se:** `session-data/`, `user-data/` mimo `nahravky`, `packaged*/`, `traytest/`, `smoke/` (1,1 MB PNG snímků UI — zestárnou první změnou stylů), ani ostatních 19 složek `audio-proof-*` (mezikroky, které překonal poslední běh).

Napiš `dukazy/zvuk-2026-08-21/MERENI.md` — musí obsahovat: (a) mapu původní název → nový název, (b) tabulku velikostí 85 169 / 1 351 / 85 517 / 27 993 B, (c) FFmpeg hladiny −91,0 dB (ticho) × −20,0 dB (zvuk) a 244 800 / 241 920 vzorků, (d) korelaci s `Glass.aiff` 0,9638 (systém) × 0,0098 (mikrofon), (e) mikrofon se zvukem −46,0 dB × v tichu −44,2 dB, (f) **příkaz, kterým se korelace přepočítá** (`ffmpeg -i zvuk-system.webm -i /System/Library/Sounds/Glass.aiff …` + použitý skript), (g) větu, že tenhle důkaz nahradil dřívější argument poměrem bajtů.
A `dukazy/README.md`: co v `dukazy/` je, proč `.runtime/` je ignorovaná, a pravidlo „číslo bez souboru tady je tvrzení, ne měření".
```sh
git add dukazy && git commit -m "Keep the audio evidence that proves system capture works"
```

**Hotovo když:** `git ls-files dukazy | wc -l` ≥ 11, `du -sh dukazy` ≤ 300 KB, `git check-ignore dukazy/zvuk-2026-08-21/zvuk-application.log` nevrátí nic (výjimka funguje) a `git ls-files dukazy | grep -c GPUCache` = 0.

### 5. Opravit rozpory v ROZHODNUTI.md (přesné řádky a náhrady)

Soubor `/Users/dan/Dev/ClaudeCode/ludone-desktop/ROZHODNUTI.md`, čísla řádků platí pro `main` na `d84e2d8`.

**ROZHODNUTI.md:38 (B1 — má být 🟡 do Meet testu)**
nahradit celý řádek za:
`| B1 | 🟡 **Electron platí pro zvuk — zbývá Google Meet** | Systémový zvuk naměřen naostro: stopa `System audio`, korelace zachycené stopy s přehrávaným signálem **0,9638**. Otázka „umí to Electron" je uzavřená | Otevřené zůstává A6: nahrát skutečnou schůzku v Google Meet v prohlížeči. Do té doby je B1 podmíněné — měří se v etapě E1 a dělá to Dan |`

**ROZHODNUTI.md:40 (B5 — přepsat důkaz na korelaci)**
nahradit celý řádek za:
`| B5 | ✅ **Aplikace opravdu nahrává** (21. 8., commit `2bb09ce`) | Dvě oddělené stopy. Systémová stopa koreluje s přehrávaným `Glass.aiff` na **0,9638**, mikrofonní jen na **0,0098** — signál tedy teče do systémové stopy, ne do mikrofonní. Mikrofon byl se zvukem dokonce **tišší** (−46,0 dB) než v tichu (−44,2 dB), takže nejde o přeslech přes reproduktory. Doplňkově: systémová stopa 1 351 B → 27 993 B, FFmpeg −91,0 dB → −20,0 dB. Data v `dukazy/zvuk-2026-08-21/` | Nic |`

**ROZHODNUTI.md:41 (B6 — hlavička Opus JE platná)**
nahradit celý řádek za:
`| B6 | ⚠️ **WebM z nahrávání nemá zapsanou celkovou délku** | Hlavička Opus je platná — jednorázové `Error parsing Opus packet header` z FFmpegu se týká prvního paketu a celý měřený interval se dekódoval (244 800 a 241 920 vzorků). Skutečná vada je chybějící `Duration` v hlavičce WebM, důsledek zápisu po sekundových chuncích | Vyřešit remuxem na serveru v etapě E5. Teď nevadí, u přepisu může |`

**ROZHODNUTI.md:42 (B2 — z Anarlogu se nepřebírá NIC)**
nahradit celý řádek za:
`| B2 | ~~Z Anarlogu převzít jediný modul~~ → **z Anarlogu se nepřebírá nic** | Poslední kandidát — ořezané rozpoznání schůzky podle mikrofonu, 1 500–2 000 řádků cizího kódu — je zrušený a nahradil ho kalendář. Zdroj: `luplaud-vyzkum/vystup/05-ZAVERY-A-ROZHODNUTI.md`, oddíl 7.2 | Nic. Firma nebude vlastnit ani řádek nativního audio kódu |`

**ROZHODNUTI.md:44 (B4 — odhad 14,5–23,5, ne 18–30)**
nahradit celý řádek za:
`| B4 | Odhad **5,5–8 ČD na první použitelnou dodávku** (etapy 0+1) a **14,5–23,5 ČD** na celou aplikaci na Macu | Přepočet po A11 (spouštěč): `05-ZAVERY-A-ROZHODNUTI.md`, oddíl 7.1. Původních 18–30 už neplatí | Server a web jsou dalších 8,5–15 ČD a v tomhle čísle NEJSOU |`

**ROZHODNUTI.md:50 (C1 — má být ⛔)**
nahradit celý řádek za:
`| C1 | ⛔ **Apple Developer Program, 99 $/rok — stopka. Agent to nesmí koupit, rozhoduje Dan** | **Doporučení: začít bez placení.** Měřením se ukázalo, že jde o dvě nezávislé věci, ne o jednu — podrobně níž |`

**ROZHODNUTI.md:51 (C2 — repozitář JE na GitHubu)**
nahradit celý řádek za:
`| C2 | ✅ **GitHub — hotovo, otázka uzavřená.** Repozitář běží na `github.com/Make-more-s-r-o/ludone-desktop` (privátní, org Make more), založen 21. 8. Tvrzení „repo je zatím jen lokální" už neplatí | Nic. Řádek zůstává, aby se otázka neotevřela znovu |`

**ROZHODNUTI.md:136 (tabulka D — překonaný zápis)**
na konec řádku před poslední `|` doplnit: ` **PŘEKONÁNO 21. 8. — viz zápis o založení repozitáře níž.**`

```sh
git add ROZHODNUTI.md && git commit -m "Correct the decision log: audio works, estimates and GitHub state were stale"
```

**Hotovo když:** `grep -n "18–30\|repo je zatím jen lokální\|vadnou hlavičku Opus\|POTVRZENO 21. 8. měřením" ROZHODNUTI.md` nevrátí nic; `grep -c "0,9638" ROZHODNUTI.md` ≥ 2; `grep -n "^| C1 | ⛔" ROZHODNUTI.md` najde řádek.

### 6. Přepsat důkaz systémového zvuku v NAHRAVANI.md

Soubor `/Users/dan/Dev/ClaudeCode/ludone-desktop/NAHRAVANI.md` (na main po mergu). Nahraď **celý oddíl „## Měření", řádky 56–74**, tímhle textem — poměr bajtů klesá na doplněk, hlavním důkazem je korelace:

```markdown
## Měření

### Hlavní důkaz — korelace se známým signálem

Běh se zvukem přehrál třikrát `/System/Library/Sounds/Glass.aiff`. Zachycené stopy jsem porovnal
s tímhle známým signálem:

| Stopa | Korelace s `Glass.aiff` |
|---|---:|
| systémový zvuk | **0,9638** |
| mikrofon | **0,0098** |

Signál tedy teče do systémové stopy a do mikrofonní prakticky vůbec. To je podstatné: vylučuje to
nejpravděpodobnější falešný pozitiv, totiž že se „systémový zvuk" ve skutečnosti nahrává
reproduktorem přes mikrofon.

### Kontrola proti přeslechu

Mikrofonní stopa byla **se zvukem tišší než v tichu**:

| Běh | Hladina mikrofonu |
|---|---:|
| 5 s ticho | −44,2 dB |
| 5 s + 3× Glass.aiff | **−46,0 dB** |

Kdyby zvuk přicházel přes reproduktor, mikrofon by byl hlasitější. Je tišší. Cesta je tedy
softwarová (Core Audio tap), ne akustická.

### Hladiny systémové stopy

Nezávislá kontrola přes `ffmpeg` dekódovala ze systémových souborů 244 800 a 241 920 vzorků,
tedy přibližně 5,10 a 5,04 s při 48 kHz. Tichá stopa měla průměr i maximum −91,0 dB; zvuková
stopa průměr −20,0 dB a maximum 0,0 dB.

### Doplněk — velikosti souborů

| Běh | Mikrofon | Systémový zvuk |
|---|---:|---:|
| 5 s ticho | 85 169 B | 1 351 B |
| 5 s + 3× Glass.aiff | 85 517 B | 27 993 B |

Systémová stopa se zvukem je 20,72× větší a splňuje automatickou hranici
`max(ticho × 3, ticho + 4096) = 5 447 B`, kterou hlídá `npm run test:audio`.
**Poměr velikostí ale sám o sobě není důkaz** — kodek na tichu tvoří skoro nic i tehdy, když do
stopy neteče nic užitečného. Bereme ho jen jako automatickou pojistku v bráně, ne jako argument.

### Poznámka ke kontejneru

Dekodér u každého souboru jednou vypsal `Error parsing Opus packet header`. Hlavička Opus je
přitom platná; skutečná vada je, že WebM nemá zapsanou celkovou délku, což plyne ze zápisu po
sekundových chuncích. Před zpracováním na serveru (E5) to vyřeší remux.

Surová data: `dukazy/zvuk-2026-08-21/` (`MERENI.md` má mapu souborů a příkaz k přepočtu korelace).
```

```sh
git add NAHRAVANI.md && git commit -m "Base the audio proof on signal correlation, not on file sizes"
```

**Hotovo když:** `grep -c "0,9638" NAHRAVANI.md` ≥ 1, `grep -c "−46,0 dB" NAHRAVANI.md` ≥ 1, `grep -n "Poměr velikostí ale sám o sobě není důkaz" NAHRAVANI.md` najde řádek, a v souboru už není věta „Rozdíl jednoznačně potvrzuje".

### 7. Označit překonaný NALEZ.md a archivovat strojové odpovědi Codexu

**A) Oprava na archivní větvi** (aby překonaný závěr nestál v čele souboru, na který někdo narazí):
```sh
cd /Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/zvuk
```
`NALEZ.md:1` — nahradit `# Nález: zachycení systémového zvuku v Electronu na tomto Macu`
za `# Nález z 20. 8. 2026 — PŘEKONÁNO (zachycení systémového zvuku v Electronu na tomto Macu)`

`NALEZ.md:4` — nahradit `Výsledek: **SYSTÉMOVÝ ZVUK NEFUNGUJE.** Mikrofon se v tomto běhu také nepodařilo otevřít.`
za:
```markdown
Výsledek: **v tomto běhu se nepodařilo otevřít ani systémový, ani mikrofonní stream.** Sandbox
neměl přístup k žádnému zvukovému zařízení — macOS jich v té relaci nehlásil vůbec žádné.

> 🔴 **PŘEKONÁNO. Tenhle dokument NEDOKAZUJE, že systémový zvuk v Electronu nefunguje.**
> Opakování 21. 8. 2026 v přihlášené Danově relaci ukázalo, že **funguje**: stopa `System audio`,
> korelace se signálem 0,9638. Viz `NALEZ-OPAKOVANI.md` a na `main` soubor `NAHRAVANI.md`.
> Necituj tenhle soubor jako platný závěr o Electronu — je to záznam běhu bez audio zařízení.
```
```sh
git add NALEZ.md && git commit -m "Mark the first audio finding as superseded by the retest"
git push origin feat/zvuk-dukaz
cd /Users/dan/Dev/ClaudeCode/ludone-desktop
mkdir -p dukazy/zvuk-2026-08-20
cp .claude/worktrees/zvuk/NALEZ.md dukazy/zvuk-2026-08-20/NALEZ.md
```

**B) `odpoved-zvuk.json` — NEmutovat, archivovat.** Soubor tvrdí `systemovyZvukFunguje:false`, ale je to pravdivý záznam běhu bez zvukových zařízení; navíc `schema-zvuk.json` má `additionalProperties: false`, takže přidání vysvětlujícího klíče by soubor rozbilo proti vlastnímu schématu. Řešení = přesun do archivu se sousední cedulí:
```sh
mkdir -p dukazy/behy
git mv odpoved-kostra.json odpoved-zvuk.json odpoved-spojeni.json dukazy/behy/
git mv schema-kostra.json schema-zvuk.json schema-spojeni.json dukazy/behy/
git mv zadani-kostra.md zadani-zvuk.md zadani-spojeni.md dukazy/behy/
git mv spust-kostra.sh spust-zvuk.sh spust-spojeni.sh dukazy/behy/
```
Napiš `dukazy/behy/README.md` s tímhle obsahem (zkráceně): „Archiv tří Codex běhů z 20.–21. 8. 2026. Nejsou to plány ani platné závěry, jsou to záznamy toho, co běh vrátil. 🔴 `odpoved-zvuk.json` nese `systemovyZvukFunguje:false` — to je pravda **o tom běhu**, který neměl přístup k žádnému audio zařízení, ne o Electronu. Platný stav zvuku je v `/NAHRAVANI.md` a `/dukazy/zvuk-2026-08-21/`. Soubory se nemění: `schema-*.json` mají `additionalProperties: false`, takže jakýkoli dopsaný klíč by je rozbil."
```sh
git add dukazy && git commit -m "Archive the Codex run records and label the superseded audio answer"
```

**Hotovo když:** `grep -rn "SYSTÉMOVÝ ZVUK NEFUNGUJE" --include='*.md' .` nevrátí nic; `ls dukazy/behy | wc -l` = 13; `ls *.json *.sh zadani-*.md 2>/dev/null` v kořeni nevrátí nic; `git -C .claude/worktrees/zvuk status --porcelain` je prázdné a větev je pushnutá.

### 8. Napsat AGENTS.md — celý text k vložení

Vytvoř `/Users/dan/Dev/ClaudeCode/ludone-desktop/AGENTS.md` s tímhle přesným obsahem:

```markdown
# AGENTS.md — LuDone Desktop

Platí pro každého agenta i člověka, kdo v tomhle repozitáři něco mění. Přečti ho dřív, než uděláš
první `git` příkaz. Když je v rozporu s promptem, platí tenhle soubor.

## 0. Co se tu staví

Spouštěč na macOS: nahrává schůzky (mikrofon a systémový zvuk odděleně) a měří čas. Archiv,
přepis, hledání a dashboardy **nejsou** v aplikaci — jsou v `app.ludone.cz`.
**Aplikace je spouštěč, ne platforma.** Kdo sem chce přidat seznam nahrávek, hledání nebo přehledy,
porušuje rozhodnutí A11.

## 1. Mantinely — porušení zastavuje běh

### 1.1 Žádné zvyšování práv

- **Zakázáno:** `sudo`, `su`, `osascript … with administrator privileges`, `security authorizationdb`,
  `launchctl` na systémové domény, `installer -pkg`, `chown`/`chmod` mimo tenhle repozitář, zápis do
  `/System`, `/Library`, `/usr/local`, sáhnutí na klíčenky mimo vlastní dočasnou.
- 🔴 **Když ti vyskočí dialog na heslo správce, je to vada běhu, ne obtíž.** Dialog zavři, práci
  zastav a do reportu napiš, který příkaz ho vyvolal. 21. 8. 2026 takový dialog Danovi vyskočil a
  nikdo neuměl říct proč — proto tohle pravidlo existuje.
- Ad-hoc podpis `codesign --force --deep --sign -` je povolený (heslo nechce). Cokoli, co si řekne
  o heslo, povolené není.

### 1.2 Žádná tajemství v gitu

- Do repozitáře nikdy nejde token, klíč, heslo, cookie, `.env`, `auth.json`, obsah klíčenky ani
  Google/Apple credentials. `.env*` je v `.gitignore` — ber to jako druhou pojistku, ne jako první.
- 🔴 **Klíč k přepisu v aplikaci nikdy nebude** (rozhodnutí B3): desktop běží na cizím stroji a klíč
  se z něj dá vytáhnout. Přepis jde přes prostředníka na serveru.
- Před každým `git push`: `git diff --stat origin/main..HEAD` a očima nad seznamem nových souborů.
  Binárky (`.webm`, `.png`, `.app`) commituj jen vědomě a s důvodem v commit message.
- Zápis do Tabidoo z tohohle repozitáře nedělá nikdo. Nikdy.

### 1.3 Jeden zapisovatel na strom

- 🔴 **V jednom pracovním stromu smí zapisovat právě jedna session nebo jeden Codex běh.** Dvě
  zapisující session si přepíší práci a výsledek pak vypadá jako důkaz, i když není. Čtení,
  průzkum a paralelní běhy nad týmž stromem jsou v pořádku.
- Dvě věci naráz = dva stromy. Zakládej je viditelně:
  `orca worktree create --name "<ascii-bez-mezer>" --display-name "LuDone Desktop: <účel>"`.
- Po dokončení: strom odstranit **a** větev smazat lokálně i na `origin`. Zombie strom znamená, že
  příští běh staví na starém kódu.
- `.claude/worktrees/` je ignorovaný adresář. Nic, co má přežít, tam nesmí zůstat jen tam.

### 1.4 Nevratné věci — stopky

Bez výslovného Danova pokynu se nedělá: platba (Apple Developer Program), zveřejnění čehokoli mimo
tenhle privátní repozitář, zásah do `ludone-app` nebo do produkce, a změna kteréhokoli rozhodnutí
z tabulky A v `ROZHODNUTI.md`. Na stopce se **přeskakuje, nezastavuje**: položka jde do reportu a
do `DAN-TODO.md` a běh pokračuje na tom, co na ní nezávisí.

## 2. Pořadí zdrojů pravdy

Když se dva dokumenty neshodnou, vyhrává ten výš.

| # | Dokument | Co v něm platí |
|---|---|---|
| 1 | `ROZHODNUTI.md` | Rozhodnutí. Tabulka A se neotvírá, B je podmíněné měřením, C čeká na Dana |
| 2 | `AGENTS.md` (tenhle soubor) | Jak se tu pracuje |
| 3 | `NAHRAVANI.md` | Jak nahrávání skutečně funguje a čím je to změřené |
| 4 | `KOSTRA.md` | Co v UI existuje a co je záměrně předstírané |
| 5 | `dukazy/` | Naměřená data. **Číslo bez souboru v `dukazy/` je tvrzení, ne měření** |
| 6 | `README.md` | Jak to spustit |

**Překonané — necituj jako platné:**

| Dokument | Čím je překonaný |
|---|---|
| `dukazy/zvuk-2026-08-20/NALEZ.md` | `dukazy/zvuk-2026-08-21/NALEZ-OPAKOVANI.md` a `NAHRAVANI.md`. Systémový zvuk **funguje**; noční běh jen neměl audio zařízení |
| `dukazy/behy/odpoved-zvuk.json` | Totéž. `systemovyZvukFunguje:false` je pravda o běhu bez zvukových zařízení, ne fakt o Electronu |
| `dukazy/behy/zadani-*.md`, `schema-*.json`, `spust-*.sh` | Archiv zadání Codex běhů z 20.–21. 8. Nejsou to plány |
| `luplaud-vyzkum/vystup/*` | Podklad k rozhodnutí, ne specifikace. Platné odhady jsou v oddílu 7.1 (14,5–23,5 ČD), starších 18–30 se nedovolávej |

Mimo repozitář: `/Users/dan/Dev/ClaudeCode/luplaud-vyzkum/` (průzkum) a `DAN-TODO.md` (co čeká na Dana).

## 3. Brány — čím se pouští a co je zelená

Pouští se **z hostitelského terminálu (Orca panel), ne z omezeného sandboxu.** GUI Electron ze
sandboxu skončí na `kLSNoExecutableErr` / `SIGABRT` v `_RegisterApplication` ještě před rendererem.

| Brána | Příkaz | Co je zelená |
|---|---|---|
| Instalace | `npm ci` | doběhne bez chyby |
| Sestavení | `npm run build` | vznikne `dist/index.html` |
| Klikací test UI | `npm run test:ui` | všechny kontroly projdou, snímky v `.runtime/smoke/` |
| Balík | `npm run package:mac` | vznikne `release/LuDone Desktop.app` a `codesign --verify --deep --strict` projde |
| Zvuk naostro | `npm run test:audio` | systémová stopa se zvukem > `max(ticho × 3, ticho + 4096)` B |
| Sonda loopbacku | `npm run probe:loopback` | vypíše `VYSLEDEK` s `audioLabel:"System audio"` a nenulovým `bajtu` |

🔴 **Brána se opravuje na straně vady, nikdy na straně měřidla.** Zakázané „opravy": změkčení prahu,
vypnutí kontroly, přeskočení běhu, `--force`, `[skip ci]`. Po třech neúspěšných kolech se běh
zastaví a do reportu se napíše, co přesně padá.

## 4. Zelený test není důkaz funkčnosti

🔴 **Zelený test není důkaz funkčnosti.** Test říká, že kód doběhl. Neříká, že aplikace dělá to, co
od ní člověk čeká. Tady to platí dvojnásob: nahrávání může vesele běžet a zapisovat ticho.

Každé tvrzení v reportu nese jednu ze tří značek:

- ✅ **ověřeno naostro** — spuštěné GUI, skutečný klik, soubor na disku, změřená hladina
- 🧪 **zelené testy** — kód proběhl, nikdo to neviděl
- ⛔ **neověřeno** — napsáno, nespuštěno

Tvrzení o zvuku platí jen s číslem a se souborem v `dukazy/`. „Nahrává to" bez čísla neplatí.
Poměr velikostí souborů je nejslabší z důkazů — kodek na tichu tvoří skoro nic. Platný důkaz je
**korelace zachycené stopy s přehrávaným signálem** nebo hladina v dB.

## 5. Formát reportu

Každý běh končí zápisem. Netriviální běh takhle:

```
━━━ REPORT · <modul>: <co se děje> ━━━
🟢 HOTOVO | 🟡 ČEKÁ NA TEST | 🔵 ROZDĚLANÉ | 🔴 BLOKOVÁNO · větev · PR · labs/prod

Problém — co se rozbilo nebo chybělo
Zadání — co jsem měl udělat
Stav vývoje — co je napsané a kde to leží
Stav nasazení — větev, commity, čistý strom; co jsi neměřil, označ jako neměřené
Otestováno — každý řádek s ✅ / 🧪 / ⛔
Otestuj ty — konkrétní příkaz nebo klik a očekávaný výsledek; když není co, řekni to naplno
Další krok — jedna věta, nebo „HOTOVO, session můžeš zavřít" + co jsi uklidil
```

Když běh udělal něco nevratného (commit, push, merge, smazání větve, zabalení), přidej sekci
**Provedeno bez ptaní** a vyjmenuj to. Nevypsaná nevratná akce je horší než nepovolená — nikdo
o ní neví. Když běh rozhodl něco za Dana, přidej **Rozhodl jsem sám**.

Triviální běh: jeden řádek `▪ RUN — ⚪ bez změn · <co jsem udělal> · <co dál>`.

## 6. Git

- Commit messages **anglicky**; komentáře v kódu a dokumentace **česky**.
- Pracuje se na větvi, ne rovnou na `main` (výjimka: úklidová etapa E0).
- 🔴 **Hashe citované v dokumentaci se nepřepisují.** `2bb09ce`, `32da5e2` a `446c467` jsou jmenovitě
  v `ROZHODNUTI.md` a `NAHRAVANI.md`. Žádný rebase ani squash nad historií, na kterou se dokumenty
  odkazují. Rozešlé větve se slučují mergem.
- `.runtime/`, `release/`, `node_modules/`, `dist/`, `*.log` do repozitáře nepatří. Důkazy se ručně
  vybírají do `dukazy/`, nesypou se hromadně.
```

```sh
git add AGENTS.md && git commit -m "Write down how work happens in this repository"
```

**Hotovo když:** `test -f AGENTS.md`, `grep -c "Zelený test není důkaz funkčnosti" AGENTS.md` ≥ 1, `grep -c "heslo správce" AGENTS.md` ≥ 1, `grep -c "jedna session nebo jeden Codex běh" AGENTS.md` ≥ 1, a všech šest bran z oddílu 3 má existující npm skript (`node -e "const s=require('./package.json').scripts; ['build','test:ui','package:mac','test:audio','probe:loopback'].forEach(k=>{if(!s[k])throw new Error('chybi '+k)})"`).

### 9. Přenést sondu loopbacku ze zvuk větve a doplnit npm skripty + bundle identifier (D2)

**A) `scripts/loopback-probe.html`** (převzato z `feat/zvuk-dukaz:t.html`; MUSÍ zůstat souborem — `file://` je zabezpečený kontext, `data:` URL není a `getDisplayMedia` by v něm selhalo):
```html
<!doctype html><meta charset="utf-8"><title>sonda loopbacku</title><body>sonda</body>
```

**B) `scripts/loopback-probe.mjs`** — konverze `feat/zvuk-dukaz:test-loopback.js` z CommonJS na ESM (`package.json` má `"type": "module"`, takže `require` by spadl; `__dirname` v ESM neexistuje):
```js
// Rychlá sonda: vidí Electron v TÉHLE relaci systémový zvuk (loopback)?
// Spuštění z hostitelského terminálu: npm run probe:loopback
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, session, desktopCapturer } from "electron";

const adresarSkriptu = path.dirname(fileURLToPath(import.meta.url));

app.whenReady().then(async () => {
  const okno = new BrowserWindow({ show: false });
  session.defaultSession.setDisplayMediaRequestHandler(
    async (_zadost, odpoved) => {
      try {
        const zdroje = await desktopCapturer.getSources({ types: ["screen"] });
        odpoved({ video: zdroje[0], audio: "loopback" });
      } catch {
        odpoved({});
      }
    },
    { useSystemPicker: false },
  );
  await okno.loadFile(path.join(adresarSkriptu, "loopback-probe.html"));
  const vysledek = await okno.webContents.executeJavaScript(`(async () => {
    const r = {};
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const a = s.getAudioTracks();
      r.audioStop = a.length;
      r.videoStop = s.getVideoTracks().length;
      r.audioLabel = a.length ? a[0].label : null;
      if (a.length) {
        const rec = new MediaRecorder(new MediaStream([a[0]]));
        const chunky = [];
        rec.ondataavailable = (e) => chunky.push(e.data);
        rec.start();
        await new Promise((x) => setTimeout(x, 5000));
        await new Promise((x) => { rec.onstop = x; rec.stop(); });
        r.bajtu = chunky.reduce((n, c) => n + c.size, 0);
      }
      s.getTracks().forEach((t) => t.stop());
    } catch (e) { r.chyba = e.name + " — " + e.message; }
    return r;
  })()`);
  console.log("VYSLEDEK " + JSON.stringify(vysledek));
  app.quit();
});

setTimeout(() => { console.log('VYSLEDEK {"timeout":true}'); app.quit(); }, 40_000);
```

**C) `package.json` — doplnit dva chybějící skripty** (`ui-smoke.mjs` dnes existuje, ale nemá vstupní bod, takže brána klikacího testu je fakticky neviditelná):
```json
"test:ui": "node scripts/ui-smoke.mjs",
"probe:loopback": "electron scripts/loopback-probe.mjs"
```

**D) `scripts/package-mac.mjs:56` — bundle identifier (rozhodnutí D2):**
nahradit `  "cz.ludone.desktop.prototype",` za `  "cz.ludone.desktop",`

⚠️ `package.json:2` (`"name": "ludone-desktop-prototype"`) a klíče `ludone.prototype.*` v `src/App.jsx:8` a `src/components/Settings.jsx:13` **v E0 neměň** — `package-lock.json` na jméno navazuje (`npm ci` by spadl na neshodě) a přejmenování localStorage klíčů by resetovalo onboarding uprostřed úklidu. Zapiš to jako úkol do E2.

```sh
git add scripts package.json && git commit -m "Carry the loopback probe over from the audio branch and wire the missing gates"
```

**Hotovo když:** `npm run probe:loopback` z hostitelského terminálu vypíše `VYSLEDEK {"audioStop":1,…,"audioLabel":"System audio","bajtu":<nenulové>}`; `grep -c prototype scripts/package-mac.mjs` = 0; `npm run test:ui` doběhne a vytvoří PNG v `.runtime/smoke/`.

### 10. Projít brány naostro, uklidit worktrees a větve, pushnout

**A) Brány** (hostitelský terminál, kořen repozitáře, větev main). Po změně bundle id si macOS znovu řekne o oprávnění — nechat Dana kliknout, jinak `test:audio` spadne:
```sh
cd /Users/dan/Dev/ClaudeCode/ludone-desktop
npm ci
npm run build
npm run test:ui
npm run package:mac
codesign --verify --deep --strict "release/LuDone Desktop.app"
npm run test:audio
```

**B) Úklid worktree `kostra`** — kód už je celý v main, uchovávat ho nemá důvod. Důkazy jsou vytažené v kroku 4; `dist/`, `release/`, `node_modules/` (308 MB) a `.runtime/` (~40 MB) zmizí, přeinstalace stojí ~25 s:
```sh
git merge-base --is-ancestor 2bb09ce main || { echo "STOP: kostra NENI v main"; exit 1; }
git worktree remove --force .claude/worktrees/kostra
git branch -d feat/kostra-appky            # -d, ne -D: musí projít bez námitek
git push origin --delete feat/kostra-appky
```

**C) Úklid worktree `zvuk`** — větev **zůstává archivní** (obsahuje samostatný pokusný Electron projekt `main.js`/`renderer.js`, který se do main nepřenáší; přenáší se z něj jen sonda, krok 9):
```sh
git tag archiv/zvuk-dukaz-2026-08-21 feat/zvuk-dukaz
git push origin archiv/zvuk-dukaz-2026-08-21
git worktree remove --force .claude/worktrees/zvuk
git worktree prune
# větev feat/zvuk-dukaz se NEMAŽE ani lokálně, ani na originu
```

**D) Push a kontrola:**
```sh
git push origin main
git status --porcelain     # prázdné
git worktree list          # jediný řádek = kořen
git branch -a              # main, feat/zvuk-dukaz, jejich remote protějšky; žádná kostra
ls -la .claude/worktrees   # prázdné nebo neexistuje
pgrep -fl "Electron|LuDone Desktop" || echo "zadne zombie procesy"
```

**E) Report** podle oddílu 5 v `AGENTS.md`, povinně se sekcí **Provedeno bez ptaní** (merge do main, push, smazání větve `feat/kostra-appky` lokálně i na originu, tagy) a s tříúrovňovým označením u každého tvrzení. Do „Otestuj ty" patří konkrétně: `open "release/LuDone Desktop.app"`, kliknout na ikonu LuDone v horní liště, spustit nahrávání na 5 s, a ověřit, že v `~/Library/Application Support/…/nahravky/` vznikly dva soubory a systémový je výrazně větší než 1,4 kB.

**Hotovo když:** Všech šest bran skončilo úspěchem; `git worktree list | wc -l` = 1; `git branch -a | grep -c kostra` = 0; `git tag | grep -c archiv/zvuk-dukaz-2026-08-21` = 1; `git log --oneline origin/main -1` je shodné s lokálním HEAD; `git status --porcelain` prázdné; report zapsaný.

## Měřítko etapy

Spustitelná posloupnost v kořeni `/Users/dan/Dev/ClaudeCode/ludone-desktop` na `main`, všechno musí projít:

```sh
cd /Users/dan/Dev/ClaudeCode/ludone-desktop
# 1) kód kostry je opravdu předkem main, s původními hashi
git merge-base --is-ancestor 2bb09ce main && git merge-base --is-ancestor 32da5e2 main && echo "KOD-NA-MAIN OK"
# 2) klíčové soubory existují
for f in AGENTS.md electron/main.cjs src/App.jsx scripts/loopback-probe.mjs scripts/loopback-probe.html \
         dukazy/zvuk-2026-08-21/MERENI.md dukazy/zvuk-2026-08-21/zvuk-system.webm; do test -f "$f" || echo "CHYBI $f"; done
# 3) žádný nevyvrácený rozpor
grep -rn "SYSTÉMOVÝ ZVUK NEFUNGUJE" --include='*.md' . | grep -v PŘEKONÁNO   # musí vrátit prázdno
grep -n "18–30\|repo je zatím jen lokální\|vadnou hlavičku Opus" ROZHODNUTI.md  # musí vrátit prázdno
grep -c "cz.ludone.desktop.prototype" scripts/package-mac.mjs                  # musí být 0
# 4) brány naostro (hostitelský terminál, NE sandbox)
npm ci && npm run build && npm run test:ui && npm run package:mac && npm run test:audio
codesign --verify --deep --strict "release/LuDone Desktop.app" && echo "PODPIS OK"
# 5) čistý strom, jediný worktree, vše pushnuté
git status --porcelain            # prázdné
git worktree list | wc -l         # 1
git log --oneline origin/main -1  # shodné s HEAD
git branch -a | grep kostra       # nic (větev smazána lokálně i na originu)
git tag | grep archiv/zvuk        # tag archiv/zvuk-dukaz-2026-08-21 existuje
```

`npm run test:audio` je jediná brána, která říká „nahrává to doopravdy“: musí skončit s tím, že systémová stopa se zvukem překročila práh `max(ticho × 3, ticho + 4096)` B a vypsat cestu do nové složky `.runtime/audio-proof-*`.

## Dotčené soubory

- `/Users/dan/Dev/ClaudeCode/ludone-desktop/AGENTS.md (nový)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/.gitignore (ruční řešení konfliktu)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/ROZHODNUTI.md (řádky 38, 40, 41, 42, 44, 50, 51, 136)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/NAHRAVANI.md (přijde mergem; přepis oddílu Měření, řádky 56–74)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/KOSTRA.md (přijde mergem, beze změny)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/README.md (auto-merge, kostra přidá oddíl Lokální spuštění)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/package.json (přijde mergem; name + skripty test:ui, probe:loopback)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/package-lock.json (přijde mergem; regenerovat po změně name)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/electron/main.cjs, electron/preload.cjs (přijdou mergem)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/src/** (App.jsx, main.jsx, styles.css, components/*, features/*, hooks/*) — přijdou mergem`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/index.html, vite.config.js (přijdou mergem)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/scripts/audio-smoke.mjs, scripts/ui-smoke.mjs (přijdou mergem)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/scripts/package-mac.mjs (přijde mergem; řádek 56 bundle id)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/scripts/loopback-probe.mjs (nový, z feat/zvuk-dukaz:test-loopback.js)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/scripts/loopback-probe.html (nový, z feat/zvuk-dukaz:t.html)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/dukazy/README.md (nový)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/dukazy/zvuk-2026-08-21/{ticho-mikrofon.webm, ticho-system.webm, zvuk-mikrofon.webm, zvuk-system.webm, proof-files.json, ticho-application.log, zvuk-application.log, MERENI.md, NALEZ-OPAKOVANI.md} (nové)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/dukazy/zvuk-2026-08-20/NALEZ.md (nový, opravená kopie z feat/zvuk-dukaz)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/dukazy/behy/{odpoved-kostra.json, odpoved-zvuk.json, odpoved-spojeni.json, schema-*.json, zadani-*.md, spust-*.sh, README.md} (git mv z kořene + nový README)`
- `/Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/zvuk/NALEZ.md (oprava na archivní větvi feat/zvuk-dukaz)`
- `SMAZÁNO: .claude/worktrees/kostra, .claude/worktrees/zvuk (worktrees), větev feat/kostra-appky lokálně i na originu`

## Pasti — co tuhle etapu shodí

- 🔴 `.gitignore` je JEDINÝ konfliktní soubor — ověřeno `git merge-tree --write-tree main feat/kostra-appky` (exit 1, CONFLICT jen v `.gitignore`). Kdo konflikt vyřeší převzetím jedné strany, ztratí buď `.claude/worktrees/` (→ 300 MB node_modules poletí do indexu) nebo `.runtime/` (→ 3,8 MB Chromium profilu na commit). Musí to být ruční sjednocení obou stran.
- 🔴 `*.log` v `.gitignore` tiše zahodí `dukazy/**/application.log`. Bez výjimky `!dukazy/**/*.log` se důkazní logy prostě nepřidají a `git add` na to ani neupozorní (bez `-f`).
- 🔴 `nahravky/` v `.gitignore` zahodí důkazní `.webm`, pokud se zkopírují i s původní cestou `.../user-data/nahravky/...`. Proto se soubory do `dukazy/` MUSÍ přejmenovat naplocho (ticho-system.webm, …), ne kopírovat se strukturou.
- 🔴 NEREBASOVAT a NESQUASHOVAT. `ROZHODNUTI.md:40` cituje commit `2bb09ce`, `NAHRAVANI.md:5` cituje `32da5e2`, `odpoved-zvuk.json` cituje `41f3661` a `307e210`. Rebase přepíše hashe a dokumentace začne odkazovat do prázdna. Navíc jsou všechny tři větve už na `origin` — přepis by vynutil force-push.
- 🔴 `dist/` a `release/` jsou v `.gitignore`, ale ve worktree `kostra` fyzicky existují (dist z 24. 8. 13:21). `git worktree remove` je odmítne smazat bez `--force`. Nejdřív z nich vytáhnout důkazy, pak `--force`.
- 🔴 Změna bundle identifieru `cz.ludone.desktop.prototype` → `cz.ludone.desktop` (D2) RESETUJE oprávnění TCC — macOS je vede na bundle id. Po ní si aplikace při prvním `npm run test:audio` znovu řekne o Záznam obrazovky a mikrofon, a dokud Dan neklikne, brána zvuku spadne. Naplánovat to jako poslední krok před branami a počítat s jedním klikem.
- 🔴 `package-lock.json` má `"name": "ludone-desktop-prototype"`. Když se změní `name` v `package.json` a lock se nepřegeneruje (`npm install --package-lock-only`), `npm ci` skončí na neshodě. Buď změnit obojí, nebo `name` v E0 vůbec nesahat (povinná je jen `CFBundleIdentifier`).
- 🔴 GUI Electron NEJDE spustit z omezeného sandboxu — skončí `kLSNoExecutableErr` / `SIGABRT` v `_RegisterApplication` ještě před rendererem (doloženo NAHRAVANI.md, oddíl Odchylky). Brány `test:ui`, `package:mac`, `test:audio` a `probe:loopback` se pouštějí z hostitelského Orca panelu, ne z Codex sandboxu.
- 🔴 `test-loopback.js` je CommonJS (`require`, `__dirname`) a `package.json` kostry má `"type": "module"` — prosté zkopírování jako `.mjs` spadne na `require is not defined`. Nutná konverze na `import` + `fileURLToPath(import.meta.url)`.
- 🔴 Sonda NESMÍ načítat testovací stránku přes `data:` URL — to je opaque origin, tedy nezabezpečený kontext, a `getDisplayMedia` v něm selže. Musí zůstat `loadFile()` nad skutečným souborem `scripts/loopback-probe.html` (`file://` je zabezpečený kontext, doloženo `proof-files.json` → `secureContext.secure: true`).
- ⚠️ `odpoved-zvuk.json` se NESMÍ opravovat přidáním klíče: `schema-zvuk.json` má `additionalProperties: false` na každé úrovni, takže jakýkoli nový klíč soubor rozbije proti vlastnímu schématu. Řeší se přesunem do archivu + sousedním `PREKONANO.md`.
- ⚠️ Korelační čísla (0,9638 × 0,0098; −46,0 dB × −44,2 dB) v repozitáři DNES nejsou — grep je nenajde ani v `ludone-desktop`, ani v `luplaud-vyzkum`. Do `MERENI.md` je nestačí opsat: musí se k nim doplnit soubor a příkaz, kterým se dají přepočítat, jinak z nich za týden bude další nedoložené tvrzení.
- ⚠️ Mikrofonní `.webm` v `dukazy/` obsahují 5 s reálného zvuku z Danova pokoje. Před commitem je poslouchnout (`afplay` / `ffplay`) a v reportu potvrdit, že tam není řeč — jde do repozitáře, který se dá později otevřít týmu.
- ⚠️ `ui-smoke.mjs` existuje, ale v `package.json` NEMÁ npm skript. Kdo brány jen opíše z `package.json`, klikací test úplně vynechá.
- ⚠️ V kořeni je netrackovaný `odpoved-spojeni.json`. Zapadne-li do merge commitu, smíchá se úklid s cizí změnou; commitnout ho samostatně před mergem.
