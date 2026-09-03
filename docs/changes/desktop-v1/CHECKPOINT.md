# CHECKPOINT — LuDone Desktop

Poslední zápis: **3. 9. 2026, 10:40**. Psáno pro někoho s **prázdným kontextem** — konverzaci
sežere compaction, tenhle soubor ne.

---

## Stav jednou větou

Aplikace je **postavená celá**, ale **ověřená naostro skoro vůbec**. Chybí Danova rozhodnutí
a patnáct minut jeho času u počítače.

| | |
|---|---|
| `main` | `924d477`, **589 passed \| 6 skipped (595)**, čistý strom |
| otevřené PR | **0** · worktrees **0** · větve `orca/*` **0** · Codex procesy **0** |
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

## Zbylá práce, kterou běh může udělat sám

1. **Syrové chyby souborového systému jdou do UI i logu** — `electron/main.cjs`, funkce
   `exportCompletedRecording`, větev `catch`: `error.message` jde do hlášky uživateli
   a `error.stack` do logu. Systémová chyba (`ENOSPC`, `EACCES`) nese **absolutní cestu,
   ve které je i název schůzky**.
   **Změřeno, co už hlídá test:** název schůzky v logu ano (`queue-wiring.test.js:1442`),
   **cestu ani hlášku pro uživatele nehlídá nic**.
   *Návrh:* rozlišit vlastní vyhozené chyby (nesou bezpečné české věty) od systémových
   podle `error.code` a ty nahradit obecnou hláškou podle kódu.

2. Po ruce už není nic dalšího doloženého. **Nevymýšlet práci** — dvě adversariální kola
   (interakce, bezpečnost, ztráta dat) proběhla a jejich nálezy jsou vyřešené.

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
