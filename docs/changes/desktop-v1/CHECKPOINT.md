# CHECKPOINT — LuDone Desktop

Poslední zápis: **3. 9. 2026, 10:40**. Psáno pro někoho s **prázdným kontextem** — konverzaci
sežere compaction, tenhle soubor ne.

---

## Stav jednou větou

Aplikace je **postavená celá**, ale **ověřená naostro skoro vůbec**. Chybí Danova rozhodnutí
a patnáct minut jeho času u počítače.

| | |
|---|---|
| `main` | `15da2da`, **607 passed \| 6 skipped (613)**, čistý strom |
| otevřené PR | **0** · worktrees **0** · větve `orca/*` **0** · mergnuto 3. 9.: **#41 #42 #43 #44** |
| design | **21 z 21** desktopových obrazovek stojí (22. je serverová) |
| repozitář | 🔴 **PRIVÁTNÍ** (vráceno 3. 9. ráno, důvod níž) |
| CI | běží na **vlastním runneru `danuv-mac`**, ne na hostovaném |

## 🔴 První příkazy po probuzení

```bash
cd /Users/dan/Dev/ClaudeCode/ludone-desktop
git fetch -q origin && git status --porcelain      # musí být prázdné
gh pr list                                          # musí být prázdné
gh api repos/Make-more-s-r-o/ludone-desktop/actions/runners --jq '.runners[].status'
```

⚠️ **Runner musí být `online`.** Repozitář je privátní, takže hostované minuty Actions jsou
vyčerpané a **brána běží výhradně na Danově Macu**. Když je Mac vypnutý, job **čeká ve frontě**
místo aby spadl — nevypadá to jako chyba, ale nic se nezměří.
Návrat na hostovaný runner je jednořádkový: `runs-on: ubuntu-latest` v `.github/workflows/ci.yml`.

---

## ✅ Co je ověřeno naostro (člověk to viděl běžet)

- 🔴 **Stereo export má oddělené kanály** — Dan 3. 9. přehrál soubor: vlevo mikrofon,
  vpravo ostatní zvuk. **Nejcennější ověření celého modulu**; rozdíl startů stop 4 ms.
- **`Cmd+Q` během nahrávání nahrávku neztratí** — Dan: „neukončila se hned".
- **Pojmenování, export a zařazení do fronty** projdou celou cestou.

- **Ikona v liště funguje.** Nebyla vidět, protože Danova lišta byla plná — ne kvůli vadě.
  `tray.getBounds()` přitom celou dobu hlásil nenulové rozměry; spor rozhodl až klik na
  hlášené souřadnice, který trefil aplikační menu.
- **Panel se otevře a odpovídá schválenému návrhu.**
- **`npm run gates:clean`** — brány nad čistým klonem, spuštěno a zelené.
- **Vlastní GitHub runner** — job na něm proběhl zeleně.

## 🧪 Co je postavené, ale nikdo to neviděl běžet

Prakticky všechno ostatní: stereo export · pojmenování schůzky · onboarding s testem záznamu ·
adresa přihlášení · výpadek ostatního zvuku · kontextové menu · hláška při plné liště ·
přibalená písma · balení a aktualizace · odesílací klient (vypnutý) · obnova při startu.

🔴 **Nejcennější věc, kterou může Dan udělat:** `docs/changes/desktop-v1/OVERENI-NAOSTRO.md`,
šest bodů na 15 minut. Body 1 a 2 (přehrát stereo nahrávku, odpojit sluchátka během nahrávání)
jsou vady, které se **projeví jen tichem**.

---

## 🛑 Co čeká na Dana — nic z toho běh rozhodnout nesmí

Plné znění s doporučeními je v **`DAN-TODO.md`**, tady jen výčet:

| # | co | doporučení |
|---|---|---|
| **expozice** | popisy tří produkčních vad `ludone-app` byly ~10 h ve veřejném repu | **A — opravit ty vady** (jediné, co odstraní důvod, ne stopu) |
| **B5** | Electron **37.3.1**, opravy až v **39.8.10**; context-isolation bypass se nás týká | upgradovat na 39.8.10 **se živým ověřením**, ne rovnou na 44 |
| **B1** | Apple Developer — Individual × Organization (nepřechází se) | firma, pokud má D-U-N-S |
| **B2** | barva hlavního tlačítka: panel modrý, onboarding zelený | sjednotit na modrou; ukázka `progress/barva-tlacitka.html` |
| **B3** | allowlist vydavatelů v `main.cjs` brání jiným instalacím | uzavřený výčet, ale z konfigurace instalace |

---

## 🔴 NÁVRH IKONU V LIŠTĚ PŘEDEPISUJE — dřívější zápis „glyf není určen" byl chybný

`design/navrh/Lista.dc.html` to má na řádcích 32–40, jen jsem to minule nenašel:

- **glyf** (ř. 35): `<path d="M4 18 L10 6 L14 14 L20 9">`, stroke 2.2, kulaté konce, viewBox 24 —
  tedy **klikatá čára / pulz**, ne dnešní terč.
- **odznak** (ř. 37): kolečko 7 px s 1.5px obrysem v barvě lišty, posunuté doprava dolů —
  nese DRUHOU agendu, když běží obě.
- **popisek** (ř. 40): čas, tabulární číslice — ✅ **hotovo, mergnuto PR #41**.
- **osm stavů** s barvou z palety: nepřihlášeno/bez spojení `subtle` · klid `text` ·
  nahrává `bad` · měří `ok` · fronta a výpadek `wait`.
- závěr návrhu doslova: *„Souběh potřebuje odznak, ne pátou ikonu. Barva nese hlavní
  agendu, odznak tu druhou — a stav nikdy nesmí záviset jen na barvě."*

🔴 **Překážka, kterou je nutné vyřešit, ne obejít:** `electron/main.cjs:308` volá
`image.setTemplateImage(true)`. **Šablonová ikona se na macOS kreslí jen z alfa kanálu —
barva se zahodí.** Barevné stavy tedy vyžadují nešablonový obrázek pro aktivní stavy.
Zjištěno měřením, ne odhadem.

⚠️ `design/approved.json` uvádí přesnou kresbu všech osmi stavů jako otevřenou otázku
úkolu **T1, který je ZMRAZENÝ**. Základní glyf ale nakreslený je — stavět podle něj
není vymýšlení.

## Zbylá práce, kterou běh může udělat sám

0. ~~**Glyf ikony**~~ — ✅ **hotovo, PR #44.** Generátor `npm run ikony` vyrábí PNG přímo
   ze souřadnic návrhu; brána hlídá i to, že opakované spuštění dá tytéž bajty.
   Původní zápis: 🔴 **Úzký záběr schválně:** jen překreslení
   čtyř existujících ikon pulzem z návrhu. Barva, odznak a pátý stav spadají pod
   **zmrazený T1** — běh ho nerozmrazil, rozhodnutí leží v `DAN-TODO.md`.

1. ~~**Syrové chyby souborového systému**~~ — ✅ **hotovo, PR #42.** Vlastní chyby dostaly
   třídu `RecordingExportUserError`; jen ta smí předat text uživateli. Při tom nalezena
   a opravena latentní vada: `finally` uvolňoval odkládací plochu i volání, které si
   export nikdy nezabralo — druhé kliknutí mohlo shodit první běžící export.

2. ~~**Barvy**~~ — ✅ **hotovo, PR #43.**

3. **Starý bod (ponechán pro kontext):** syrové chyby souborového systému — `electron/main.cjs`, funkce
   `exportCompletedRecording`, větev `catch`: `error.message` jde do hlášky uživateli
   a `error.stack` do logu. Systémová chyba (`ENOSPC`, `EACCES`) nese **absolutní cestu,
   ve které je i název schůzky**.
   ⚠️ **Zpřesněno měřením 3. 9.:** log je už v pořádku (`error.stack` se do něj nedostane),
   **uniká jen `error.message` do panelu**. Řeší běžící úloha `desktop-hlasky`.
   *Návrh:* rozlišit vlastní vyhozené chyby (nesou bezpečné české věty) od systémových
   podle `error.code` a ty nahradit obecnou hláškou podle kódu.

🔴 **Doložená samostatná práce DOŠLA.** Změřeno 3. 9.: `DSK-F012` (výběr projektu) čeká
na serverový kontrakt — je to **money cesta a desktop nesmí hádat pravidlo 110 %**;
`DSK-F010` (odeslání na server) je fáze 2. Obojí je vědomé, ne zapomenuté.
Kontrakt na alokace jsem si vyžádal od serverové session.

**Nevymýšlet práci.** Místo toho běží čtecí **audit odchylek od návrhu** — obrazovku po
obrazovce, každá odchylka s citací z návrhu i z kódu. Dvakrát měl Dan konkrétní pravdu
tam, kde jsem tvrdil hotovo (čas v liště, glyf ikony); tohle to má najít dřív než on.

---

## 🔴 Pravidla, která tenhle běh zaplatil vlastní kůží

- **Commituj PŘED sabotáží.** `git checkout -- .` nerozlišuje autora; **čtyřikrát** to
  smazalo právě napsaný test. Signál: `nothing to commit` po skutečné práci, nebo klesnuvší
  celkový počet testů.
- **Po každé mutaci ověř `grep -c`, že opravdu nastala.** Neproběhlá sabotáž je **nezměřeno**,
  ne zelená — a vypadá stejně jako obrana, která drží.
- **Zelená po sabotáži má tři příčiny:** slabý test · minutá sabotáž · invariant drží něco
  jiného. Jen první je nález.
- **Fixture ověř dřív, než obviníš kód.** Test bez `recordingsDirectory` odmítne všechno
  a projde, aniž cokoli měří.
- **Než z něčeho uděláš blocker, projdi `decisions.md`.** Jednou tam byl označen za vadu
  stav, který byl v našem vlastním rozhodnutí navržený.
- **Merguj jen při `CLEAN` a aspoň jedné položce kontrol.** `UNSTABLE` s prázdným seznamem
  není slabší zelená, je to nezměřeno.
- **Před zveřejněním repozitáře patří adversariální kolo PŘED, ne po.** Hledá se
  trojí: tajemství · infrastruktura · **popisy cizích slabin**.
