# Task packet B11 (revidovaný)

> **Jak tenhle packet číst.** Je dlouhý, protože nese změřené věci, ne proto, že je upovídaný.
> Nečti ho lineárně. **Minimum před první editací:** §12 (vlastnictví bloků), §13 (TDD kroky
> s doslovnými červenými výpisy), §14 (sabotáže). Zbytek je odůvodnění, do kterého se vracej.
>
> 🔴 **Sekce `Co NEBYLO ověřeno v kódu` na konci není formalita.** Skeptik packet četl proti
> kódu a tohle zůstalo bez důkazu — než na tom postavíš implementaci, otevři to.
>
> Packet napsal agent, přečetl skeptik. **Když v něm najdeš nepravdu, je to nález, ne překážka** —
> zapiš ho a jeď dál podle `spec.md` a `plan.md`, ty jsou nadřazené.

---


**Retence 7 dní + nastavení** · story `B11` z `docs/changes/desktop-v1/plan.md` §2

> Tenhle packet prošel adversariální revizí nad skutečným kódem. Co revize opravila, je
> vypsané na konci. **Brány jsem tentokrát opravdu spustil** — čísla níž jsou změřená, ne citovaná.

---

## 1. Plan ID a Plan SHA

| Co | Hodnota |
|---|---|
| **Plan ID** | `desktop-v1` — `docs/changes/desktop-v1/plan.md` (stav: **ZMRAZENO 1. 9. 2026**) |
| **Plan SHA** | `c7b1bb715f87f53ca0a209d5d3b96e6018e1e437` ✅ ověřeno `git log -1 --format=%H -- docs/changes/desktop-v1/plan.md` |
| **Spec SHA** | `1e9709779e94a654a0c3c959d260082d42801acc` ✅ ověřeno, **ZMRAZENO** |

🔴 **HEAD do packetu NEPATŘÍ — je to údaj s životností v desítkách minut.** Původní návrh
packetu uváděl `HEAD = 0380bc0`; než revize doběhla, main se posunul **devětkrát** (`0380bc0`
→ `a4010fc` → `cef07cb`). Místo HEADu se proto pinují SHA **těch souborů, na kterých packet
stojí** — ty se mění málo a rozejití se pozná:

| Soubor | Poslední commit | Ověř před startem |
|---|---|---|
| `src/components/Settings.jsx` | `32da5e2f7dea50ff816b9df98b2ac53bd8ea1fd6` | `git log -1 --format=%H -- src/components/Settings.jsx` |
| `src/lib/queue.js` | `1ca4bdc3b8dd3ff48d6fedb0d988dac31e925164` | `git log -1 --format=%H -- src/lib/queue.js` |
| `scripts/ui-smoke.mjs` | `a4010fc0fd18d16dd9a04587b9dcaa72ac9fc393` | `git log -1 --format=%H -- scripts/ui-smoke.mjs` |

⚠️ **Sedí-li tyhle tři, packet platí, i když HEAD mezitím poskočil.** Nesedí-li `src/lib/queue.js`,
proběhla B7 a **§10 se musí přeověřit** (viz O-B11-9).

🔴 **Spec a plán se neopravují za pochodu.** Chybu zapiš do `DAN-TODO.md` a pokračuj po tom,
co na ní nezávisí (`BEH-NOC.md`, „Co je rozhodnuté a kde to leží“).

---

## 2. Task ID

`B11`

Pořadí: **vlna 4** (`BEH-NOC.md:45` — `vlna 4  B9 odhlášení · B11 retence · B10 sdílené zařízení`;
totéž `plan.md` §2b:171). Závisí na **B7**, neblokuje nic.

🔴 **Stav sousedů, změřený, ne převzatý z dokumentů:** větev `orca/desktop-b1` existuje a nese
opravu B1 (commit `0140911`), ale **commit `a4010fc` ji vzal z `main` zase pryč** („Take B1's
code back off main, where it landed by my mistake“). `BEH-NOC.md:192` přitom tvrdí *„není to
vada B1, **ta je opravená**“*. **Na `main` opravená NENÍ.** Pro B11 to znamená jediné, ale
důležité: `scripts/ui-smoke.mjs` je v předopravném stavu a kanárek 4 v §16 platí.

---

## 3. Feature ID

`DSK-F015` — *Nastavení: účet, zvuk, záznamy, připomínky, diagnostika*

Stav v matici `spec.md` §3 (řádek 92) **před** touto story — ✅ opsáno ze souboru:

| ID | Funkce | Riziko | scope | delivery | exposure | verification |
|---|---|---|---|---|---|---|
| `DSK-F015` | Nastavení: účet, zvuk, záznamy, připomínky, diagnostika | normal | approved | coded | **labs** | unverified |

Cílový stav **po** této story:
`scope: approved` · `delivery: pr-open` · `exposure: **labs** (beze změny)` · `verification: tests-green`
**pro nový modul; UI polovina zůstává `unverified`.**

🔴 **Původní návrh packetu chtěl `exposure: disabled` — to by matici zhoršilo.** `BEH-NOC.md:13`
sice říká plošně „Hotovo znamená `delivery: pr-open` · `exposure: disabled` · `verification:
tests-green`“, jenže F015 **už dneska `labs` je**: okno Nastavení se z panelu otevře
(`src/App.jsx:94-101` → IPC `settings:open` → `electron/main.cjs:670` → `createSettingsWindow()`
na `:347`) a B11 mu to nebere. Zapsat `disabled` by znamenalo tvrdit, že se k tomu člověk
nedostane — a to je nepravda o vlastní aplikaci. **Osu `exposure` tahle story nehýbe.**
Nedosažitelný je jen *mechanismus mazání* (§12.1), a to patří do textu PR, ne do zhoršené osy.
Rozpor mezi plošným cílem a konkrétním řádkem je otázka **O-B11-10**.

🔴 **Nic v této story nesmí ráno tvrdit `verified-live`.** To smí říct jen člověk, který to
viděl běžet na Macu (`plan.md` §2b:162, `BEH-NOC.md` DoD).

⚠️ **Retence nemá v matici vlastní Feature ID.** `spec.md` §3 zná šestnáct funkcí F001–F016 a
mazací mechanismus mezi nimi není; F015 je nejbližší domov, protože jeho název obsahuje slovo
„záznamy“. Není to díra, kterou má zalepit implementátor — je to **O-B11-11**.

---

## 4. Cíl story

Postavit **skutečné mazání lokálních kopií nahrávek po uplynutí retence** jako samostatný,
testovatelný modul `electron/retention.cjs`, a v okně Nastavení srovnat volbu retence
s rozhodnutím **B3 (7 dní, nastavitelné)** včetně volby „nemazat“.

Dnes retence **neexistuje v žádné podobě.** ✅ Ověřeno grepem nad `electron/`, `src/`, `scripts/`
a `tests/` na řetězce `retention|retence|janitor|deleteAfter|purged|settings.cjs|nastaveni.json`
— **sedm výskytů, ani jeden není mazací logika**:

| Soubor:řádek | Co to je |
|---|---|
| `src/components/Settings.jsx:17` | výchozí hodnota `retention` v `DEFAULTS` |
| `src/components/Settings.jsx:81` | `<select value={settings.retention} …>` |
| `scripts/ui-smoke.mjs:257` | čtení `.settings-select select` |
| `scripts/ui-smoke.mjs:259` | kontrola hodnoty `7 dní po odeslání` |
| `scripts/akceptace/E8.sh:42` | grep `^## Retence — otevřený parametr O3$` |
| `scripts/akceptace/E8.sh:43` | grep `^Délka retence ani právní pravidla zatím nejsou rozhodnuté\.$` |
| `scripts/akceptace/E8.sh:57` | `zkontroluj "retence a právní rámec O3 zůstávají otevřené"` |

*(Původní packet psal „šest výskytů“ a `E8.sh:42` vynechal. Ten řádek je přitom polovina
brány — viz §12.3.)*

`src/components/Settings.jsx:88` to říká sám: *„V prototypu se žádný zvukový soubor nevytváří
ani nemaže.“*

**Proč to není kosmetika** (`spec.md` §11, R23, řádky 302-306, doslova): *„Bez ní se disk zaplní
a **aplikace po zhruba 38 hodinách schůzek přestane nahrávat** — prahy 2 GB / 5 GB jsou
v `specs/E6:67`. Retence tedy není nastavení navíc (B11), je to podmínka, aby nahrávání
fungovalo dál než pár týdnů.“*

---

## 5. User-visible chování

**V okně Nastavení**, sekce **„Co se děje se zvukem“** (`Settings.jsx:74-89`):

1. Rozbalovací seznam **„Ponechat na tomto Macu / Po odeslání do LuDone“** (`:79-87`).
2. **Výchozí hodnota se mění na `7 dní po odeslání`** — dnes `24 hodin po odeslání`
   (`Settings.jsx:17`). Kvůli rozhodnutí **B3** (`DAN-TODO.md`, řádek B3: „Retence na disku ·
   7 dní, nastavitelné“).
   🔴 **Tahle jedna změna neutralizuje cizí bránu. Přečti §12.4 DŘÍV, než ji uděláš.**
3. Seznam nabízí **pět** položek: `Ihned smazat`, `24 hodin po odeslání`, `7 dní po odeslání`,
   `30 dní po odeslání`, **`Nemazat`** (nová — R19 „včetně «nemazat»“).
   **Nové `<option>` se přidávají BEZ atributu `value`** — stávající čtyři ho nemají a
   `ui-smoke` čte `select.value`, tedy textový obsah. Přidání `value=""` kdekoli v seznamu
   rozbije `ui-smoke.mjs:257`.

### 🔴 Věta o prototypu ZŮSTÁVÁ. Nesahej na ni.

Původní packet chtěl `Settings.jsx:88` přepsat na *„Maže se jen to, co už je odeslané.“*
s odůvodněním, že věta „přestává být pravda“. **Nepřestává.** §12.1 dává B11 v `main.cjs`
i `preload.cjs` **nic**, takže modul nikdo nezavolá; `DESKTOP_UPLOAD_ENABLED` je vypnutý
(`.env.example`, ✅ ověřeno E5.sh) a `src/lib/queue.js:202` vrací `disabled`, takže se do stavu
`odeslano` stejně nikdy nic nedostane. **Po B11 aplikace nadále nemaže nic.**

Nahradit pravdivou větu větou, která slibuje mazání, by bylo přesně to, na čem tenhle
repozitář v srpnu devětkrát uklouzl: **tvrzení o kódu, který neběží.** Věta se smaže ve story,
která retenci zapojí (O-B11-1). `specs/E6…` §10 sice říká „smazat větu“ — ale počítá s tím,
že janitor je ve stejné změně zapojený. Tady není.

4. Volba se ukládá okamžitě (patička okna: „Změny se ukládají automaticky“, `Settings.jsx:109`).

**Co uživatel NEUVIDÍ v této story** (a nesmí to být dodáno):

- žádnou záložku, nové okno ani nový vzor design systému (§6);
- číslo „Na tomto Macu: N nahrávek, X MB“ ani tlačítko „Smazat odeslané teď“ — `specs/E6…` §10
  je chce, `plan.md` §2b u B11 ne, a schválený design pro ně nemá kresbu;
- stav „na disku je málo místa“ — samostatný chybějící moment (`cesta-uzivatele`, bod 13);
- **žádné smazání během běhu aplikace** — modul není nikam zapojený (§12.1).

---

## 6. Odkaz na schválený Claude Design artefakt

**Artefakt:** `design/approved.json` — ✅ přečteno: `status: approved`, `approvedBy: "Dan"`,
`approvedAt: "2026-09-01"`, `approvedVia: "statická náhledová stránka design/navrh/nahled.html,
Danova věta „za mě teda schváleno“"`, `specVersion: "…schváleno nad commitem babdd5a"`.
Kanonické místo pojmenovává `docs/changes/desktop-v1/artifacts/design/design-manifest.md`
(odchylka **O10**, `decisions.md:121-128`).

**Co je pro B11 schválené:** `coveredScreens` obsahuje `"nastavení — účet"` a
`"nastavení — diagnostika"`. **Nic víc o Nastavení tam není.**

### 🔴 Nakreslené NENÍ ani „Záznamy“, ani „Zvuk“

Původní packet tvrdil, že §04 náhledu má „tři karty“ a že chybí jen „Záznamy“. ✅ Otevřel jsem
`design/navrh/nahled.html:535-600`. Skutečnost je horší a je potřeba ji vidět celou:

- `:539` lead říká **„Čtyři části“**;
- lišta záložek (`:548`, `:574`) má **čtyři**: `Účet` · `Zvuk` · **`Záznamy`** · `Diagnostika`;
- vykreslené jsou **tři desky**: *Účet a zvuk* (aktivní je ale **jen záložka Účet** — účet,
  ikona v Docku, spouštět po přihlášení), *Diagnostika*, *Připomínky* (ta ani není jednou
  ze čtyř záložek);
- **obsah záložky „Zvuk“ nakreslený NENÍ** a **obsah záložky „Záznamy“ nakreslený NENÍ**.

⚠️ **Ovládací prvek retence, který tahle story mění, tedy leží přesně v té části, kterou
nikdo nenavrhl.** Grep nad `nahled.html` na `Ponechat`, `po odeslání`, `Nemazat`, `retenc`
nevrací **nic** — dnešní copy v `Settings.jsx` ze schváleného designu nepochází.

`approvedNewDesignSystemElements` má tři prvky (měřák zvukové stopy · sbalený řádek klidové
agendy · kontextové menu ikony) — **žádný se Nastavení netýká.**

**Co z toho plyne, závazně:**

- Zůstáváš uvnitř **dnešní** struktury `src/components/Settings.jsx`: `.settings-group` →
  `.settings-select` → `<select>`. Měníš **položky seznamu a výchozí hodnotu**, nic jiného.
- **Nezakládáš záložky, nekreslíš „Záznamy“ ani „Zvuk“, nepřidáváš tlačítka.** Schválený design
  ukazuje záložkové okno, dnešní `Settings.jsx` je jednosloupcový seznam sekcí — **ten rozdíl
  tahle story NEŘEŠÍ.** Bylo by to nakreslení neschválené obrazovky (masterplán §9).
- CSS existuje a stačí: `.settings-select` (`src/styles.css:1185`), `.settings-select select`
  (`:1257`, `max-width: 174px`, `font-size: 10px`), `.settings-hint` (`:1267`).
  **Nepřidávej třídy a neupravuj šířku** — `Nemazat` (7 znaků) je kratší než dnes nejdelší
  `24 hodin po odeslání` (20 znaků), takže se nic nerozbíjí.

---

## 7. Relevantní výřez EXPERIENCE.md

🔴 **`EXPERIENCE.md` v repozitáři NEEXISTUJE.** Masterplán §9 ho jmenuje, tenhle projekt ho
nikdy nevytvořil. Jeho roli plní **`docs/ux/cesta-uzivatele-2026-09-01.md`**. ✅ Citace níž jsou
doslovné a **čísla řádků jsem ověřil**.

**M23 — Plný disk uprostřed schůzky** (řádek **53**; sloupce *Kde* = `nikde`, *Stav* = `nema obrazovku`):

> Systémové upozornění macOS o zaplněném disku. V appce NIC. […] Řetězec ENOSPC se v repu
> nevyskytuje ani jednou. […] Zápis chunku selže v 38. minutě hodinové schůzky a nikdo se to
> nedozví. Chybí kontrola volného místa PŘED startem s odhadem podle délky a stav „na disku je
> málo místa, nahrávání se zastavilo“. **Retence navíc maže až po odeslání, takže neodeslaná
> fronta disk sama drží.**

⚠️ Poslední věta je past, do které tahle story nesmí spadnout — viz §8 a §21.

**M31 — Odinstalování** (řádek **61**) — kde ty soubory leží:

> Zůstanou nahrávky ze schůzek v `~/Library/Application Support/LuDone Desktop/nahravky`,
> šifrovaná session v JINÉM adresáři `~/Library/Application Support/cz.ludone.desktop/auth`
> (`TOKEN_STORAGE_NAMESPACE`, ne název appky) […]

✅ Cesta k nahrávkám ověřena i v kódu: `electron/main.cjs:479`
`path.join(app.getPath("userData"), "nahravky")`.

**Momenty, které dnes nemají kde proběhnout** — hranice scope. ✅ ověřeno:

> 9. Okno Nastavení jako pravé okno (autostart, ikona v Docku ano/ne, zkratky, cesta
>    k nahrávkám, verze, odhlásit a smazat data)
> 13. Stav „na disku je málo místa“ + kontrola volného místa PŘED startem s odhadem podle délky
> 19. „Odhlásit a smazat moje data“ před odinstalací

Body **9, 13 a 19 nejsou B11.** Ani jeden není v `plan.md` §2b u téhle story.

**Co musí rozhodnout Dan** (řádek **114**, bod 5) — otázka, kterou implementátor neřeší:

> Zůstanou nahrávky na disku po odinstalaci (nepřijdeš o ně), nebo se mažou (citlivý obsah
> nezůstane bez appky, která o něm ví)?

🔴 **A jedna podmínka navíc, kterou původní packet neměl:** `DAN-TODO.md` bod A1 zní *„Kdy smí
vzniknout první ostrá nahrávka — až po sepsání souhlasu a retence“*, bod 3 tamtéž: *„Právní
rámec — souhlas účastníků a retence […] musí být **dřív, než vznikne první ostrá nahrávka**“*.
Živé ověření v §16 nahrávku vyrábí — proto je tam **vlastním hlasem nebo tónem, nikdy na
schůzce s druhou stranou** (§16, předpoklad P0).

---

## 8. Relevantní business pravidla

Z `spec.md` §4 a §11 — ✅ doslova ze souboru, jen ta, která se týkají téhle story:

| Pravidlo | Text (doslova) | Co z toho pro B11 plyne |
|---|---|---|
| **R19** (`:168`) | „Lokální kopie nahrávky se po úspěšném odeslání smaže za **7 dní** (B3). Nastavitelné včetně «nemazat».“ | Jádro story. Prahem je **odeslání**, ne vznik souboru. |
| **R23** (`:302-306`) | „Retence musí v v1 opravdu běžet. Bez ní se disk zaplní a aplikace po zhruba 38 hodinách schůzek přestane nahrávat — prahy 2 GB / 5 GB jsou v `specs/E6:67`. Retence tedy není nastavení navíc (B11), je to podmínka, aby nahrávání fungovalo dál než pár týdnů.“ | Důvod existence story. Prahy 2 GB / 5 GB jsou **mimo scope** — v `plan.md` §2b u B11 nejsou. |
| **R12** (`:161`) | „Odhlášení **nesmí smazat frontu**.“ | Retence nesmí sáhnout na neodeslané položky. |
| **R16** (`:165`) | „`403` a «uzavřený týden» jsou **trvalé** chyby: neopakovat, **data zachovat**, říct důvod.“ | Položka ve stavu `selhalo` jsou data, která se **zachovávají**. |
| **R10** (`:155-157`) | 🔴 „Klíč proti duplikaci vzniká při **STARTU** časovače, ne při odeslání. Do Tabidoo teče týdenní souhrn, takže duplicita není vidět — jen tiše zvedne hodiny do mzdových nákladů.“ | Kontext money-path. B11 sám peníze nepočítá, ale sousedí s nimi přes R22. |
| **R22** (`:295-300`) | 🔴 „Jméno souboru dnes nese jen `sessionId.slice(0, 8)` (**`main.cjs:478`**), tedy 32 bitů; celý `clientRecordingId` žije **jen v manifestu**. Zmizí manifest ⇒ obnova vyrobí nový klíč ⇒ vznikne duplikát, proti kterému R10 celá stojí.“ | **Retence NIKDY nemaže ani nepřepisuje `*.manifest.json`.** Maže výhradně `*.webm`. |
| **R20** (`:169`) | „Nahrávky jsou **majetkem firmy** (B2). Admin je vidí všechny.“ | Mažeš **lokální kopii**, ne firemní záznam. |
| **R24** (`:308-313`) | 🔴 „Zvuk ze skutečných schůzek nikdy do gitu… do `dukazy/` patří `vysledek.json` a `README.md`.“ | Živé ověření vyrábí zvuk. **Necommitovat.** |

*(Původní packet u R22 uváděl `main.cjs:475`. ✅ Skutečnost je **`:478`** — a spec sám tam to
číslo píše správně, takže packet byl v rozporu s dokumentem, který cituje.)*

🔴 **Rozpor, který implementátor NEŘEŠÍ SÁM** (masterplán §9; `spec.md` „Autorita při rozporu“):
R19 podmiňuje mazání **úspěšným odesláním**. Podle **S1** a `plan.md` §1 („Co tenhle plán
NEPOKRÝVÁ“) ale desktop v v1 **nemá kam odesílat**; ✅ ověřeno: `src/lib/queue.js:202`
`if (uploadEnabled !== "true") return { …outcome: "disabled"… }`, a `.env.example` drží
`DESKTOP_UPLOAD_ENABLED=false` (E5.sh PASS). **V v1 tedy nikdy nic nedojde do stavu odeslaného
a retence reálně nikdy nic nesmaže** — přesně to, co si R23 od retence slibuje, zůstává nesplněné.

**Chování v tomhle packetu:** stavíš správný mechanismus a **necháváš ho mazat výhradně
odeslané položky**. Že v v1 nebude mít co mazat, je **vědomý, zapsaný důsledek S1**, ne vada.
**Nerozšiřuj pravidlo na neodeslané nahrávky** — bylo by to samostatné produktové rozhodnutí
o mazání dat, tedy stopka pro Dana (**O-B11-2**).

---

## 9. Relevantní Architecture Spine invarianty

Z `plan.md` §1 (řádky 12-27, 53-56). ✅ opsáno doslova. **Podřízené úkoly tato rozhodnutí
nesmějí předefinovat.**

| Modul | Vlastní | Nesmí |
|---|---|---|
| `electron/main.cjs` | okno, tray, IPC, životní cyklus | rozhodovat o stavu podle rendereru |
| `electron/queue.cjs` | odchozí fronta obou typů položek | **znát obsah nahrávky** |
| `src/**` (renderer) | **jen zobrazení** | **držet stav, který musí přežít pád** |

**Kdo vlastní stav** (`plan.md:25-27`):

> 🔴 **Stav, který musí přežít pád rendereru, vlastní hlavní proces.** Renderer hlásí fakta,
> neurčuje stav.

⚠️ **Dnešní `Settings.jsx:13-34` tenhle invariant porušuje** — nastavení leží v
`window.localStorage` rendereru (`:22` čtení, `:33` zápis). `specs/E6-prihlaseni-a-fronta.md`
§10 (řádek 67) to popisuje i s důvodem: *„mazat umí jen main proces a ten do localStorage
rendereru nevidí; navíc se cache rendereru čistí a nastavení by se tiše vrátilo na default.“*
**Náprava (`electron/settings.cjs`, IPC `settings:get`/`settings:set`) NENÍ v `plan.md` §2b
u B11 a B11 na to nemá vlastnictví bloků** (§12.1). Zapiš do `DAN-TODO.md`, nedělej to
(**O-B11-3**).

**Vypínače** (`plan.md:53-56`):

> Dva samostatné: `DESKTOP_UPLOAD_ENABLED` a `DESKTOP_TIME_ENABLED` (C2).
> Oba **fail-closed** — chybějící hodnota znamená vypnuto, a to musí mít vlastní test.

🔴 **Pozor na SMĚR fail-closed u mazání.** U odesílání znamená „chybí hodnota“ *neodesílej*.
U retence znamená bezpečný směr **NEMAZAT**. Neznámá nebo chybějící hodnota retence se proto
chová jako `Nemazat`. Mazání je nevratné; fail-closed tady míří na zachování dat.
**Vlastní test — §13, T4.**

**Jak se chrání peníze** (`plan.md:51`): *„Zápis do Tabidoo přímo z desktopu je zakázaný za
všech okolností.“* — B11 do Tabidoo nesahá ani nepřímo.

**Rollback** (`plan.md:68`): *„Každá story je samostatně revertovatelná. Žádná migrace v1
(desktop nikam nepíše).“*

---

## 10. Vstupní a výstupní rozhraní

🔴 **Tvar rozhraní `plan.md` nefixuje** — §2b (řádek 152) jmenuje jen soubor
`electron/retention.cjs` *(nový)*, „Nastavení“, test *„Soubor starší 7 dnů zmizí; «nemazat»
ho nechá“* a odhad ~130 řádků. Kontrakt níž je proto **rozhodnutý tímhle packetem**.
Implementátor ho **dodrží doslova** a **nevymýšlí vlastní**; kdyby mu nevyhovoval, vrátí
konkrétní otázku (masterplán §9), nemění ho po svém.

**Nový modul `electron/retention.cjs`** — CommonJS. ✅ `package.json:7` má `"type": "module"`,
takže hlavní proces potřebuje příponu `.cjs`; `eslint.config.js:29-36` má pro `electron/**/*.cjs`
`sourceType: "commonjs"` a `globals.node`.

```js
// Popisky jsou zároveň hodnoty ukládané v Nastavení — musí sedět 1:1 s <option> v UI.
const RETENTION_POLICIES = Object.freeze({
  IHNED:      "Ihned smazat",
  HODINY_24:  "24 hodin po odeslání",
  DNI_7:      "7 dní po odeslání",     // výchozí (rozhodnutí B3)
  DNI_30:     "30 dní po odeslání",
  NEMAZAT:    "Nemazat",
});

/** Doba držení v ms. „Nemazat“ i NEZNÁMÁ/chybějící hodnota → null (= nikdy nemazat). */
function retentionMs(policy)                       // → number | null

/** Čistá funkce bez fs: co by se smazalo. Nic nemaže. */
function planRetention(queue, policy, now)         // → { toDelete: [...], kept: [...] }

/** Provede smazání podle planRetention. */
async function applyRetention({ queue, policy, now })  // → { deletedFiles, deletedItems, keptItems, errors }

module.exports = { RETENTION_POLICIES, retentionMs, planRetention, applyRetention };
```

🔴 **`retentionMs("Ihned smazat")` vrací `0`, a `0` je falsy.** Napsat kdekoli
`if (!ms) return` znamená, že „Ihned smazat“ nikdy nic nesmaže. **Porovnávej výhradně
`ms === null`.** Chytá to T2, ale reviewer to má v Pass 1 na seznamu.

**Vstup — položka fronty.** ✅ Tvar je **daný** a opsaný z `src/lib/queue.js:131-145`
(funkce `enqueueRecording`), neměň ho:

```js
{
  attempts: 0,
  clientRecordingId: "9e586e55-…",     // = idempotency key, R10/R22
  enqueuedAt: "2026-08-25T08:00:00.000Z",
  lastFailureReason: null,
  manifestPath: "/…/2026-…-9e586e55.manifest.json",
  nextAttemptAt: null,
  sentAt: null,                         // ISO řetězec; nastaví se na queue.js:229
  server: { recordingId: null, uploadedBytes: { microphone: 0, system: 0 } },
  state: "ceka",                        // QUEUE_STATES (queue.js:3-8): ceka|odesila|odeslano|selhalo
  tracks: { microphone: "/…-mikrofon.webm", system: "/…-system.webm" },
}
```

**Závazná pravidla výběru** (každé má v §13 vlastní test):

1. **Maže se výhradně položka ve stavu `QUEUE_STATES.SENT` (`"odeslano"`)** a jen když má
   `sentAt` neprázdný ISO řetězec. Stavy `ceka`, `odesila`, `selhalo` jsou **nedotknutelné**
   (R12, R16). Odpovídá `specs/E6…:67`: *„**Smazat se smí VÝHRADNĚ položka ve stavu
   `uploaded`**“*.
2. **Stáří se počítá z `sentAt`**, ne z `enqueuedAt`, ne z `mtime` souboru. `mtime` mění
   Time Machine, kopírování i `rsync`; `sentAt` je jediné číslo, které nese kontrakt fronty.
   *(Rozdíl proti doslovnému znění plánu „soubor starší 7 dnů“ → **O-B11-8**.)*
3. **`Ihned smazat` = `retentionMs === 0`**, tedy smazat hned při prvním průchodu po `sentAt`
   — ne „ihned po `recording:finish`“ (`specs/E6…:67` to říká stejně).
4. Mažou se **obě cesty z `item.tracks`**, tedy `*.webm`. **`item.manifestPath` se nemaže
   a nepřepisuje** (R22).
5. **Chybějící soubor (`ENOENT`) není chyba** — položka je už uklizená, pokračuje se dál.
   Jiná chyba se sbírá do `errors[]` a **nezastavuje** zbytek běhu.
6. 🔴 **Částečné selhání: položka se počítá za smazanou, jen když jsou pryč OBĚ stopy**
   (smazané, nebo už dřív neexistující). Když jedna stopa zmizí a druhá selže na jinou chybu
   než `ENOENT`, položka **nepatří do `deletedItems`**, ale do `errors[]` a zůstává mezi
   `keptItems`. *(Rozhodnutí tohoto packetu — plán ani spec to neřeší. Bez něj by „půl smazané“
   nahrávky mizely z evidence.)*
7. `applyRetention` **nepřepisuje soubor fronty**. Zápis fronty vlastní B7
   (`electron/queue.cjs`, `saveQueueAtomically`); B11 vrací výsledek volajícímu.

**Co modul NESMÍ:**

- **sahat na `src/lib/manifest.js`.** ✅ `MANIFEST_STATES` je zmrazený trojlístek
  `["recording", "complete", "incomplete"]` (`manifest.js:6`). Stav `purged`, který chce
  `specs/E6…` §10, **v tomhle schématu neexistuje a jeho přidání je změna datového kontraktu**
  — masterplán §9 to bez aktualizace plánu zakazuje (**O-B11-4**);
- otevírat `.webm` a číst obsah — `plan.md:18` zakazuje frontové vrstvě „znát obsah nahrávky“;
- volat `app`, `ipcMain` ani cokoli z `electron` — modul musí být spustitelný v čistém Node
  procesu pod vitestem. ✅ Vzor: `electron/queue.cjs` importuje jen `node:fs`, `node:path`,
  `node:crypto`.

⚠️ **Proč tenhle kontrakt nevypadá jako `specs/E6…` §10:** ten popisuje janitor, který iteruje
**manifesty** se stavy `uploaded`/`purged` a polem `deleteAfter` (schéma na `specs/E6…:49`).
**Takové schéma v repozitáři neexistuje** — implementované `MANIFEST_STATES` má tři stavy
a stav odeslání drží fronta, ne manifest. E6 §10 tedy nejde postavit nad dnešním kódem;
proto je kontrakt frontový. Rozpor je zapsaný jako **O-B11-3** a **O-B11-4**, ne vyřešený.

---

## 11. Dependencies

| Směr | Story | Stav | Co z toho plyne |
|---|---|---|---|
| **Závisí na** | **B7** — *Wire the outbound queue for both item kinds* | ⛔ neproběhla | B11 čte **tvar položky fronty**, ne její zapojení. Tvar je dnes hotový a otestovaný (`tests/queue.test.js`, ✅ 11 testů zelených). ⚠️ **Před startem ověř `git log -1 --format=%H -- src/lib/queue.js` proti `1ca4bdc…` (§1).** |
| **Blokuje** | — | | Nic na B11 nevisí. |
| Sousedí | **B9** (odhlášení) | vlna 4 | R12. B9 vlastní `auth:logout` v `main.cjs` a `logout` v `preload.cjs`; B11 tam nesahá — **nekolidují**. |
| Sousedí | **B1** (`ui-smoke`) | ⛔ **na `main` NENÍ** | 🔴 B11 se dotýká hodnoty, kterou `ui-smoke` měří. Viz §12.4 — **je to nejtvrdší past téhle story.** |

**Kontext, který se dnes NEIMPORTUJE** — ✅ přeměřeno, a je to horší, než `spec.md` píše.
Poznámka ⁵ (`spec.md:117-118`) říká: *„`src/lib/queue.js` má 200+ řádků a vlastní testy, ale
**žádný soubor v `src/` ani `electron/` ji neimportuje**. Zelené testy nad nezapojeným kódem.“*
Grep ukazuje, že **nezapojený je i `electron/queue.cjs`**: jediné výskyty obou jsou
`tests/queue.test.js:5` a `:15` (plus `scripts/akceptace/E5.sh:60-61`, což je jen `test -s`).
**B11 na tom nic nemění a nesmí měnit** — zapojení fronty je B7.

---

## 12. Přesné soubory

### 12.1 Vlastnictví bloků ve sdílených souborech

✅ Opsáno **doslova** z `plan.md` §2, tabulka na řádcích 116-124:

| Story | Vlastní v `main.cjs` | Vlastní v `preload.cjs` |
|---|---|---|
| **B3** | `trayIconName`, `updateTray`, `deriveTrayState`, registrace tray | odebrat `setTrayState` |
| **B4** | `shouldHidePanelOnBlur` a jeho čítače | nic |
| **B5** | registrace `tracking:*` kanálů, hook na pád rendereru | přidat `tracking:*` |
| **B7** | zapojení fronty, `queue:*` kanály | přidat `queue:*` |
| **B8** | `auth:begin` a jeho okolí | `beginAuth` |
| **B9** | `auth:logout` | přidat `logout` |
| **B11** | **nic** | **nic** |

A doslovné odůvodnění z plánu (`:126-127`):

> 🔴 **Task packet musí vlastnictví zadat VÝČTEM, ne větou „nesahej na cizí“.** Próza prohraje
> s prvním „tady to logicky patří taky“; výčet umí vykonavatel použít jako filtr při každé
> editaci.

🔴 **Čti ten řádek B11 doslova: `electron/main.cjs` ani `electron/preload.cjs` v této story
NEOTEVÍRÁŠ. Ani na jeden řádek.** Vede-li tě něco do těch dvou souborů, jsi mimo scope —
ne že plán zapomněl.

**Důsledek, se kterým se počítá:** modul `electron/retention.cjs` v této story **nikdo
nezavolá**. Není to nedodělek, je to hranice vlastnictví. Zapojení (start při `app.whenReady`,
periodické buzení, přesun nastavení z `localStorage` do `userData`) je práce mimo B11
(**O-B11-1**). **Tenhle fakt musí být v PR napsaný**, ne zamlčený (§18 bod 15).

### 12.2 Soubory, které tahle story mění nebo zakládá

| Soubor | Akce | Přesně co |
|---|---|---|
| `electron/retention.cjs` | **NOVÝ** | Modul podle §10. ✅ Dnes neexistuje. |
| `tests/retention.test.js` | **NOVÝ** | Testy podle §13 (T1-T4, Z1-Z3). |
| `src/components/Settings.jsx` | **MĚNÍ** | **Jen dvě místa:** `:17` výchozí hodnota `retention` → `"7 dní po odeslání"`, a doplnění `<option>Nemazat</option>` do bloku `:82-85`. **Řádek `:88` (věta o prototypu) se NEMĚNÍ — viz §5.** |

**Odhad diffu bez testů: ~110-130 řádků** (`plan.md` §2b uvádí 130). Přes ~250 se PR dělí.

### 12.3 Soubory, které tahle story NESMÍ otevřít

| Soubor | Proč |
|---|---|
| `electron/main.cjs` · `electron/preload.cjs` | B11 vlastní **nic** (§12.1). |
| `scripts/ui-smoke.mjs` | Vlastní **B1** (`plan.md` §2:108 „B1 sahá jen do `scripts/ui-smoke.mjs`“ + §2b:142). Past v §12.4. |
| `src/lib/queue.js` · `electron/queue.cjs` | Vlastní **B7**. B11 z nich **jen čte a v testu importuje**. |
| `src/lib/manifest.js` | Zmrazené schéma v1; přidání stavu = změna kontraktu (§10). |
| 🔴 **`docs/server-modul/**`** | **NOVĚ v seznamu.** `scripts/akceptace/E8.sh:40-44` grepuje v `docs/server-modul/datovy-model.md` řetězce `^## Retence — otevřený parametr O3$` a `^Délka retence ani právní pravidla zatím nejsou rozhodnuté\.$`. Kdo tam „dopíše, že retence je teď 7 dní“, **shodí E8** — a je to cizí brána, kterou B11 nesmí opravovat. Server-side retence (O3) a lokální retence (R19/B3) jsou **dvě různé věci**; O3 zůstává otevřená. |
| `docs/changes/desktop-v1/spec.md` · `plan.md` | **ZMRAZENO.** Chybu zapiš do `DAN-TODO.md`. |
| `design/**` | `BEH-NOC.md:148` „Sahat na `design/**` — je schválené.“ `AGENTS.md:66` „`design/` je samostatná, cizí práce.“ |
| `.env` · `.env.example` · `.env.local` | Flip cizího vypínače. `E5.sh:36` je má mezi cíli. |
| `tests/*.test.js` kromě nového | Na měřidlo se nesahá (`AGENTS.md:40`, masterplán §13). |

🔴 **A jeden řetězec, který nesmí nikam:** `E5.sh:47` grepuje literál
`DESKTOP_UPLOAD_ENABLED=true` v cílech `.env .env.example .env.local src electron scripts
.github package.json`. Nález = **E5 FAIL**. Testy retence pracují s odeslanými položkami —
**killswitch se v nich zapíná výhradně předáním argumentu `"true"` funkci `processNext`,
nikdy proměnnou prostředí v žádném z těch cílů.** *(Adresář `tests/` mezi cíli není, ale
zvyk psát ten řetězec do skriptů je přesně to, co bránu shodí.)*

### 12.4 🔴 Past, která shodí cizí bránu — a druhá, která ji tiše OTUPÍ

`scripts/ui-smoke.mjs` na ten rozbalovací seznam sahá a patří **B1**, ne tobě.
✅ Opsáno ze souboru (funkce `setSettings` na `:241`, volaná na `:364`):

```js
// scripts/ui-smoke.mjs:247-248
const select = document.querySelector('.settings-select select');
select.value = '7 dní po odeslání';
select.dispatchEvent(new Event('change', { bubbles: true }));
// …:257-260
retention: document.querySelector('.settings-select select').value,
if (values.auto !== "true" || values.ask !== "false" || values.retention !== "7 dní po odeslání") {
  throw new Error(`Nastavení má jiné hodnoty: ${JSON.stringify(values)}`);
}
```

**Past A — hlasitá (packet ji měl):**
1. **Selektor `.settings-select select` musí zůstat platný** — nepřebaluj `<select>`, neměň
   strukturu sekce.
2. **Popisek `7 dní po odeslání` musí zůstat přesně takhle**, znak po znaku. Kdo ho zkrátí na
   „7 dní“, shodí `ui-smoke` — a **nesmí ho opravit**, protože ten soubor vlastní B1.
   Nové položky se **přidávají**, stávající se **nepřejmenovávají**, `value` atributy se
   **nedoplňují**.

### 🔴 Past B — TICHÁ. Původní packet ji neměl a je horší než A.

**Změna výchozí hodnoty na `7 dní po odeslání` promění kontrolu na `:259` v tautologii.**

`<select>` v `Settings.jsx:81` je **řízená** React komponenta (`value={settings.retention}`).
Dnes je výchozí `24 hodin po odeslání` (`:17`), takže sekvence „nastav na 7 dní → přečti zpět
7 dní“ **skutečně dokazuje, že se změna propsala**: kdyby `onChange` nefungoval, React vrátí
hodnotu na `24 hodin` a `ui-smoke` zčervená.

Udělej z `7 dní po odeslání` **výchozí** hodnotu a stane se tohle: `select.value = '7 dní po
odeslání'` je no-op, a i s úplně rozbitým `onChange` se přečte `7 dní po odeslání`.
**Brána projde nad mrtvým kódem.**

Je to přesně třída selhání, kterou `BEH-NOC.md:126-135` pojmenoval dnes v noci:
> *„ptej se na stav, který znamená ÚSPĚCH, nikdy na nepřítomnost akce […] **Nula viděných
> subjektů je nález, ne zelená.**“*

**Co s tím B11 udělá — a co NEudělá:**

- ❌ **NEOPRAVUJE `ui-smoke.mjs`.** Vlastní ho B1.
- ❌ **NERUŠÍ změnu výchozí hodnoty.** Je to rozhodnutí B3, nese ji R19.
- ✅ **Zapíše to do `DAN-TODO.md` a do PR** jako známé otupení cizí brány, s doporučenou
  opravou pro vlastníka B1: `ui-smoke` má nastavovat hodnotu **různou od výchozí**
  (`30 dní po odeslání`) a ověřit i výchozí stav **před** změnou. **Doporučení, ne provedení.**
- ✅ V PR je to v sekci „čtyři osy“ jako důvod, proč `verification` u UI poloviny F015 zůstává
  `unverified`.

*(Sabotáž UI v §14 na tuhle past navazuje.)*

---

## 13. TDD kroky

Závazně podle masterplánu §13: *napiš cílený failing test → **spusť ho a ověř správný důvod
selhání** → implementuj minimum → GREEN → širší brány → refaktor → commit.*

### 🔴 Krok −1 — dvě prostředí, která tě překvapí

**(a) `electron/retention.cjs` BUDE typechecknutý.** Původní packet tvrdil opak
(„`electron/**` je z typecheku vyloučené“). ✅ **Změřeno a je to jinak:** `jsconfig.json:17`
sice `electron/**` vylučuje, ale `exclude` filtruje jen vstupní glob — soubor **importovaný**
z typechecknutého testu se do programu dostane. Důkaz:

```
$ tsc --noEmit -p jsconfig.json --listFiles | grep electron
…/electron/auth.cjs
…/electron/queue.cjs
```

Obojí je v programu jen proto, že je importují testy. Kontrolní pokus s úmyslnou typovou vadou
uvnitř importovaného `.cjs`:

```
electron/retention.cjs(4,19): error TS2339: Property 'toUpperCase' does not exist on type '42'.
TSC EXIT=1
```

⇒ **Píšeš `electron/retention.cjs` tak, aby prošel `tsc --noEmit` pod `checkJs`.**
Doplň JSDoc typy, kde je potřeba. 🔴 A kdyby typecheck zčervenal, **oprav modul — nikdy
neodstraňuj import z testu a nepřidávej soubor do `exclude`.** To by bylo změkčení měřidla
(masterplán §13).

**(b) Prostředí testu.** ✅ `vitest.config.js`: `environment: "node"`, `include:
["tests/**/*.test.js"]`. Import CJS modulu vzorem, který v repozitáři funguje —
✅ `tests/queue.test.js:5` (**ne `:6`, jak psal původní packet**):

```js
import retention from "../electron/retention.cjs";
const { RETENTION_POLICIES, retentionMs, planRetention, applyRetention } = retention;
```

### Krok 0 — kostra, aby červená měla správný důvod

Založ `electron/retention.cjs` s exporty ze §10, ale **s neutrálními těly**: `retentionMs`
vrací `null`, `planRetention` vrací `{ toDelete: [], kept: [...] }`, `applyRetention` vrací
`{ deletedFiles: [], deletedItems: [], keptItems: [...], errors: [] }` a **nic nemaže**.

**Proč:** kdyby soubor neexistoval, první červená by byla „Cannot find module“ — selhání
importu, ne selhání pravidla, a masterplán §13 chce **správný důvod**. Neutrální kostra navíc
míří **bezpečným směrem** (nemaže nic), takže rozdělaná story nemůže smazat data.

### Krok 1 — testovací soubor a jeho fixtura

`tests/retention.test.js`.

🔴 **Frontu NESKLÁDEJ ručně z literálu.** Původní packet to nařizoval („Frontu poskládej ručně
podle tvaru z §10“) — a vyrobil by tím **test nad kopií kontraktu**, což `spec.md` §11 jmenuje
mezi třídami lhoucích bran. Kdyby B7 tvar položky změnil, ručně opsaná fixtura by zůstala
zeleně nad zastaralým tvarem (přesně riziko **O-B11-9**).

**Postav ji produkčními funkcemi** — `tests/queue.test.js` to tak dělá a `src/lib/queue.js`
je jen ke čtení, takže import žádné vlastnictví neporušuje:

```js
import { createQueue, enqueueRecording, processNext } from "../src/lib/queue.js";
import { createManifest } from "../src/lib/manifest.js";
// …
const { queue: q1 } = enqueueRecording(createQueue(), recording, T_ENQUEUE);
// killswitch se předává ARGUMENTEM, nikdy proměnnou prostředí (§12.3)
const { queue: q2 } = await processNext(q1, "true", async () => {}, { now: T_SENT });
// q2 nese položku ve stavu "odeslano" se skutečným sentAt — vyrobenou produkčním kódem
```

✅ Ověřeno, že to jde: `processNext` bere `uploadEnabled` jako **argument** (`queue.js:195`)
a `sentAt` razítkuje z `options.now` (`queue.js:229`).

Fixtura na disku: skutečný dočasný adresář (`mkdtemp(path.join(tmpdir(), …))`), v něm reálné
soubory `…-mikrofon.webm`, `…-system.webm` a `….manifest.json`. **Hodiny se injektují
parametrem `now`, nikdy `Date.now()` v testu.**

### 🔴 Krok 1b — jak se smí (a nesmí) tvrdit „smazáno“

**Každý test o mazání se ptá SOUBOROVÉHO SYSTÉMU, nikdy jen návratové hodnoty.**

```js
expect(existsSync(mikrofon)).toBe(false);   // ✅ takhle
expect(vysledek.deletedFiles).toContain(mikrofon);  // ⛔ tohle SAMOTNÉ nestačí
```

Důvod je konkrétní: sabotáž **S4** vyprázdní smyčku s `unlink`. Kdyby test měřil jen
`deletedFiles`, implementace by ten seznam mohla naplnit z `planRetention` a **nic nesmazat** —
sabotáž by nezčervenala a story by odevzdala mazání, které nemaže. `deletedFiles` se smí
kontrolovat **navíc**, nikdy **místo**.

### Krok 2 — čtyři červené testy, každý s jedním důvodem

| # | Název testu (do `it(...)`) | Co dělá | Musí být červený, protože |
|---|---|---|---|
| **T1** | *smaže obě stopy nahrávky odeslané před osmi dny* | policy `7 dní po odeslání`, `sentAt = now − 8 d`, `state: "odeslano"` | kostra nemaže nic → oba soubory na disku zůstanou |
| **T2** | *«Ihned smazat» smaže hned po odeslání* | policy `Ihned smazat`, `sentAt = now` | tamtéž (a chytá i falsy-nulu z §10) |
| **T3** | *nechá nahrávku odeslanou před šesti dny a smaže jen tu osmidenní* | dvě položky v jedné frontě, policy `7 dní` | osmidenní zůstane na disku |
| **T4** | *neznámá hodnota nastavení nemaže nic (fail-closed)* | policy `"nesmysl z budoucí verze"`, `sentAt = now − 400 d` | ⚠️ **červený je až po zeleném T1** — nad kostrou je falešně zelený. **Napiš ho a spusť až po T1**, jinak měříš kostru, ne pravidlo. |

**Očekávaný tvar výpisu u T1** (vitest, `expect(existsSync(mikrofon)).toBe(false)`):

```
 FAIL  tests/retention.test.js > retence 7 dní > smaže obě stopy nahrávky odeslané před osmi dny
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ tests/retention.test.js:<řádek>:<sloupec>
```

🔴 **Tenhle blok je OČEKÁVANÝ TVAR, ne zachycený běh** — revize modul nepsala. **Do PR patří
skutečný výpis z tvého běhu** (`plan.md` §2b:158: *„Doslovný výpis červeného testu před opravou.
Ne «test padal», ale co vypsal.“*). Ne parafráze, ne screenshot, **a ne tenhle vzor opsaný.**

### Krok 3 — TŘI testy, které musí zůstat ZELENÉ od začátku do konce

`plan.md` §3 bod 4 chce nejmíň jeden; tahle story maže data, takže má tři.

| # | Název testu | Co hlídá | Chytá sabotáž |
|---|---|---|---|
| **Z1** | *«Nemazat» nechá i rok starou odeslanou nahrávku na disku* | R19 „včetně «nemazat»“ + plán §2b „«nemazat» ho nechá“ | S1 |
| **Z2** | *nikdy nesmaže položku, která ještě nebyla odeslána* | R12 + R16. `state: "ceka"`, `sentAt: null`, soubory 400 dní staré, policy `Ihned smazat` → **oba soubory musí zůstat** | S2 |
| **Z3** 🔴 | *manifest zůstane na disku i po smazání obou stop* | **R22.** Po zeleném T1 musí platit `existsSync(manifestPath) === true` a jeho obsah být **bajt po bajtu totožný** s obsahem před během | S5 |

🔴 **Z3 v původním packetu CHYBĚL.** §14 měl sabotáž S5 a §18 měl bod „doloženo testem, který
padne na S5“ — ale §13 ten test nikomu neuložil napsat. Šest testů, sedmé pravidlo bez měřidla.
**Bez Z3 projde S5 zeleně a story odevzdá mazání manifestu, tedy výrobu duplikátu v hodinách**
(R22 → R10 → mzdové náklady).

**Z2 a Z3 jsou nejdůležitější testy celé story.** Padne-li Z2, aplikace maže neodeslaná firemní
data. Padne-li Z3, aplikace tiše vyrábí duplicitní vykázané hodiny.

⚠️ **„Zelený nad kostrou“ není důkaz.** Z1–Z3 jsou nad neutrální kostrou zelené triviálně;
jejich cenu prokazuje **až sabotáž** (§14), ne jejich barva.

### Krok 4 — minimální implementace, pak GREEN

Implementuj `retentionMs`, `planRetention`, `applyRetention` podle §10. Spusť `npm run test:unit`
a ověř, že **všech sedm** (T1-T4, Z1-Z3) je zelených a že **dosavadních 77 testů v 9 souborech
zůstalo zelených**.

✅ **Baseline jsem tentokrát změřil, ne opsal** (v tomto repozitáři, čistý strom):

```
 Test Files  9 passed (9)
      Tests  77 passed (77)
   Duration  308ms
EXIT=0
```

Sedí s `BEH-NOC.md:101`.

### Krok 5 — UI

Až po zeleném modulu uprav `src/components/Settings.jsx` podle §5 a §12.2 (**dvě místa: `:17`
a blok `:82-85`; řádek `:88` zůstává**). Ověř znovu všechny brány.

**Test nad `Settings.jsx` tahle story nepřidává** — ✅ repozitář nemá renderer testy
(`vitest.config.js` → `environment: "node"`, žádný jsdom setup, byť je `jsdom`
v `devDependencies`), a zavádět ho je rozšíření scope. Nastavení se ověřuje **živě** (§16),
a dokud to člověk neviděl, je to **⛔ neověřeno**.

---

## 14. Sabotážní testy

Sabotáž, kterou brána nechytí, je důkaz, že brána neměří. Postup: **rozbij produkční kód →
spusť `npm run test:unit` → zapiš doslovný výpis → vrať zpět**.

### 🔴 Jak se sabotáž vrací — pozor, `git checkout -- .` na nový soubor NEFUNGUJE

`BEH-NOC.md:75-76` říká: *„Po každém `--write` běhu je první akce `git add -A && git commit`,
teprve pak brány a sabotáže. Sabotážní kolo končí `git checkout -- .` — nad necommitnutou prací
by ji smazalo.“*

**Příkaz je správný, odůvodnění v původním packetu ne — a chybné odůvodnění zakrývá horší
selhání.** ✅ Změřeno v pokusném repozitáři:

```
$ echo "SABOTAZ" > novy.cjs        # untracked
$ echo "zmena" >> tracked.txt
$ git checkout -- .
$ cat novy.cjs
SABOTAZ                             # ← sabotáž ZŮSTALA
$ cat tracked.txt
tracked                             # ← tracked soubor obnoven
```

`electron/retention.cjs` a `tests/retention.test.js` jsou **nové soubory**. Dokud nejsou
commitnuté, `git checkout -- .` je **beze slova ignoruje** a sabotáž v nich zůstane. Následné
„zelené“ kolo pak měří rozbitý kód a vypadá jako úspěch — což je přesně vzorec, na kterém
tenhle repozitář v srpnu devětkrát uklouzl.

🔴 **Proto: PŘED sabotážním kolem `git add -A && git commit`. Bezvýjimečně.** A po každém
vrácení `git --no-pager status --porcelain` (✅ jediná povolená git operace pro Codexe,
`BEH-NOC.md:71-73`) — **musí být prázdný**. Není-li, sabotáž je pořád v kódu.

### Sabotáže

| # | Co rozbít v `electron/retention.cjs` | Která brána MUSÍ zčervenat | Co dokazuje |
|---|---|---|---|
| **S1** | V `retentionMs` vrať pro neznámou hodnotu `0` místo `null` | **T4** | Že se fail-closed opravdu měří a že „neznámá hodnota“ nemaže. |
| **S2** | Vyhoď z `planRetention` podmínku `item.state === "odeslano"` | **Z2** (a jen ta) | Že nejtvrdší pravidlo story má vlastní měřidlo a žádný jiný test ho nekryje omylem. |
| **S3** | V porovnání stáří nahraď `age >= limit` za `age >= 0` | **T3** | Že se měří **práh**, ne jen přítomnost `sentAt`. |
| **S4** | Vyprázdni v `applyRetention` smyčku, která volá `unlink` | **T1 i T2** | Že testy měří **produkční mazání na disku**, ne návratovou hodnotu (§13 krok 1b). |
| **S5** | V `planRetention` přidej `item.manifestPath` do `toDelete` | **Z3** | R22: smazaný manifest vyrobí duplikát v hodinách. |
| **S6** 🔴 *nové* | V `retentionMs` nahraď `ms === null` za `!ms` (kdekoli se výsledek testuje) | **T2** | Že se „Ihned smazat“ (`0`, falsy) nezamění za „nemazat“. |

**Očekávaný tvar výpisu u S2** (opět **vzor, ne zachycený běh** — do PR patří tvůj skutečný):

```
 FAIL  tests/retention.test.js > retence 7 dní > nikdy nesmaže položku, která ještě nebyla odeslána
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false
```

⚠️ **Sabotáž, po které zůstane všechno zelené, je NÁLEZ, ne úleva.** Zapiš ji do PR jako
„brána tuhle vadu nechytá“ a **dopiš test** — neodepisuj sabotáž.

### Sabotáž UI (patří k živému ověření, ne k `test:unit`)

Změň v `Settings.jsx` popisek `7 dní po odeslání` na `7 dní` → `node scripts/ui-smoke.mjs`
musí spadnout na `Nastavení má jiné hodnoty: {"retention":"7 dní"}`.

🔴 **Dnes to selhat NEMŮŽE ze dvou nezávislých důvodů**, a oba je nutné v PR napsat:
1. `ui-smoke` umře dřív — na `:301` (§16, kanárek 4). Kontrola na `:259` vůbec neproběhne.
2. I po opravě B1 bude tahle sabotáž **slabší**, protože výchozí hodnota bude `7 dní po
   odeslání` (past B v §12.4).

Dokud platí (1), je sabotáž UI **⛔ NEMĚŘENO**, ne ✅.

---

## 15. Projektové brány

Všechny **EXIT=0**, měřeno **před rourou** (`AGENTS.md:45`: *„Stav příkazu měř před případnou
rourou. Na macOS nepoužívej příkaz `timeout`.“*).

✅ **Změřeno v tomto repozitáři nad čistým stromem** (ne opsáno):

| Brána | Příkaz | Výsledek dnes | Poznámka |
|---|---|---|---|
| Lint | `npm run lint` | ✅ **EXIT=0** | `eslint .`; nová `.cjs` spadá pod blok `electron/**/*.cjs` (`eslint.config.js:29-36`) |
| Typecheck | `npm run typecheck` | ✅ **EXIT=0** | `tsc --noEmit -p jsconfig.json`. 🔴 **`electron/retention.cjs` BUDE v programu** — viz §13 krok −1 |
| Unit testy | `npm run test:unit` | ✅ **77 testů / 9 souborů, EXIT=0** | `vitest run`, `include: ["tests/**/*.test.js"]` |
| Vše najednou | `npm run gates` | — | `lint && typecheck && test:unit` (`package.json:16`) |
| Akceptace fronty | `bash scripts/akceptace/E5.sh` | ✅ **PASS 6/6, chyb: 0** | Hlídá i to, že v `.env .env.example .env.local src electron scripts .github package.json` **není killswitch zapnutý** (§12.3) |
| Akceptace dokumentů | `bash scripts/akceptace/E8.sh` | ✅ **PASS 12/12, chyb: 0** | 🔴 **NOVĚ v seznamu.** Drží O3 („retence není rozhodnutá“) otevřený — §12.3 |
| Build | `npm run build` | ⛔ **nespuštěno** | `vite build`; CI ho pouští po `gates` |

**Co brány nezměří** (a proto to nesmíš vydávat za ověřené):

- ✅ `ui-smoke` a `audio-smoke` jsou v CI **vypnuté** — ověřeno v `.github/workflows/ci.yml`,
  kroky mají `if: ${{ false }}` (řádky 27 a 30). `BEH-NOC.md:113`: *„CI tuhle třídu regrese
  z principu nevidí.“*
- 🔴 **CI nepouští ŽÁDNÝ `scripts/akceptace/*.sh`.** ✅ Ověřeno: `ci.yml` běží jen
  `npm run gates` (`:20`) a `npm run build` (`:21`). **E5 i E8 jsou ruční brány** — spusť je
  sám, nikdo to za tebe neudělá.
- 🔴 **`ui-smoke` v sandboxu NESPOUŠTĚJ** (`BEH-NOC.md:154`). Potřebuje skutečné okno.
- `npm run test:unit` **nevidí `src/components/Settings.jsx` vůbec** — pro renderer nejsou testy.

---

## 16. Live-verification scénář

Pro člověka u Macu (macOS 26.4, Electron 37.3.1). **Každý krok má kanárka: když kontrola nic
nenajde, výsledek je ⛔ NEMĚŘENO, ne ✅.** `spec.md` §11: *„Grep, který nenajde ani kanárka,
je rozbitý grep — ne důkaz čistoty.“*

🔴 **P0 — předpoklad, který platí dřív než krok 1.** `DAN-TODO.md` A1 podmiňuje **první ostrou
nahrávku** sepsáním souhlasu a retence. Nahrávka v bodě 1 je proto **vlastní hlas nebo tón,
nikdy hovor s druhou stranou**. Neplatí-li to, celý bod A se **nepouští**.

### A. Modul nad skutečnými soubory

1. `npm start`, projít onboarding, **nahrát ~10 s** a zastavit. Vzniknou soubory
   v `~/Library/Application Support/LuDone Desktop/nahravky` — dvě `*.webm` a jeden
   `*.manifest.json` (✅ `main.cjs:479` adresář, `:489` manifest).
   **🔴 KANÁRKA 1:** `ls -1 ~/Library/Application\ Support/LuDone\ Desktop/nahravky | wc -l`
   musí vrátit **≥ 3**. Vrátí-li 0, nahrávání se nepovedlo a **celý bod A je ⛔ NEMĚŘENO** —
   ne „retence nic nesmazala, tedy funguje“.
2. **Zkopíruj** adresář stranou (`cp -R … /tmp/retence-test`). Nad originálem se **nikdy**
   nezkouší — modul maže nevratně.
3. Postav vstup **v jednom skriptu, ne ručním JSONem.** Původní packet říkal „ručně slož
   `queue.json`“ — jenže **žádnou takovou cestu repozitář nedefinuje** (`electron/queue.cjs`
   bere `filePath` argumentem a nikdo ho nevolá) a `applyRetention` navíc bere **objekt**, ne
   cestu. Napiš proto dočasný soubor `/tmp/retence-test/pokus.cjs`, který:
   - poskládá frontu se **dvěma** položkami podle §10: *(a)* `state: "odeslano"`, `sentAt` osm
     dní zpátky, `tracks` na kopie z bodu 2; *(b)* **kontrolní** `state: "ceka"`,
     `sentAt: null`, `tracks` na druhý pár souborů;
   - zavolá `applyRetention({ queue, policy: "7 dní po odeslání", now: Date.now() })`
     a **vypíše návratovou hodnotu**.
4. Spusť `node /tmp/retence-test/pokus.cjs`.
   ✅ Ověřeno, že to jde: `node -e 'require("./electron/queue.cjs")'` funguje i pod
   `"type": "module"` (`-e` běží jako CommonJS).
   **🔴 KANÁRKA 2:** `toDelete` / `deletedFiles` musí být **neprázdné a musí jmenovat položku
   (a)**. Prázdný seznam je k nerozeznání od špatné cesty nebo špatného schématu →
   **⛔ NEMĚŘENO**.
5. Zkontroluj disk: soubory (a) **jsou pryč**, soubory (b) **jsou tam**, **oba
   `*.manifest.json` jsou tam a mají nezměněnou velikost i obsah** (R22).
   Zmizí-li (b) nebo manifest, je to 🔴 **vada**, ne úspěch — a story se vrací.

### B. Nastavení očima uživatele

6. `npm start` → panel → ikona ozubeného kola v patičce (✅ `App.jsx:94-101`,
   `aria-label="Otevřít nastavení"`) → okno **Nastavení**.
7. V sekci **„Co se děje se zvukem“** ověř: výchozí hodnota je **`7 dní po odeslání`**,
   v seznamu je **`Nemazat`**, a věta *„V prototypu se žádný zvukový soubor nevytváří ani
   nemaže.“* **tam pořád je** (§5 — nemění se).
   **🔴 KANÁRKA 3:** než cokoli prohlásíš, najdi v tom samém okně očekávaný řetězec
   **`Ponechat na tomto Macu`**. Když nenajdeš ani ten, díváš se na špatné okno nebo na starý
   build a výsledek je **⛔ NEMĚŘENO**. (Stejná logika jako brána `L11`, `spec.md` §11: nula
   nálezů ≠ zelená.)
8. Přepni na `Nemazat`, zavři okno, otevři znovu — hodnota se musí vrátit stejná.
   ⚠️ Ukládá se do `localStorage` rendereru (`Settings.jsx:22,33`); při vyčištění cache okna
   se ztratí (§9). **To je známý dluh (O-B11-3), ne vada této story** — a tenhle krok ho
   **neověřuje**, jen ukazuje, že v rámci jednoho běhu drží.
9. 🔴 **Vizuální přejímka podle masterplánu §13 („Design verification“).** Story je
   user-visible, takže patří: screenshot okna + porovnání proti schválenému artefaktu.
   ⚠️ **Porovnávat je proti čemu jen zčásti** — schválený náhled §04 nekreslí ani záložku
   „Zvuk“, ani „Záznamy“ (§6). Porovnej tedy jen to, co nakreslené je (rámec okna, typografie,
   hustota), a **rozdíl „schválený design má záložky, aplikace ne“ zapiš jako známý, nikoli
   jako vadu B11** (**O-B11-5**).

### C. `ui-smoke` — a proč z něj dnes ✅ nebude

10. `node scripts/ui-smoke.mjs` na skutečném Macu (**ne v sandboxu**).
    **🔴 KANÁRKA 4, nejdůležitější:** `setSettings` je definovaná na `:241` a volá se až na
    `:364`, kdežto skript umírá dřív — na **`:301`**, `clickByText(panel, "Povolit")`.
    ✅ **Tentokrát ověřeno v kódu, ne převzato z dokumentu:** `grep -rn "Povolit" src/` vrací
    **nula výskytů**; `Onboarding.jsx:73-110` (`permissionState`) vrací popisky
    `Povoleno` · `Otevřít Nastavení` · `Omezeno systémem` · `Znovu ověřit` · `Požádat`.
    `clickByText` na nenalezené tlačítko **vyhazuje výjimku** (`Klikací tlačítko s textem
    „Povolit" nebylo nalezeno.`), takže skript skutečně končí tam.
    **Dokud `ui-smoke` padá na `:301`, kontrola retence na `:259` NEPROBĚHLA → ⛔ NEMĚŘENO.**
11. 🔴 **A i po opravě B1 bude z bodu C nanejvýš 🟡, ne ✅** — kvůli pasti B (§12.4): s výchozí
    hodnotou `7 dní po odeslání` kontrola na `:259` už nedokazuje, že se změna propsala.
    Do PR to patří větou, ne mlčky.
    ⚠️ Poznámka k prostředí: `BEH-NOC.md:192` uvádí, že `ui-smoke` nedojede do zelené i proto,
    že balíčku `release/LuDone Desktop.app` musí Dan udělit „Nahrávání obrazovky“ — **není to
    vada B11 ani B1**.

### Zápis výsledku

✅ Značky podle `AGENTS.md:28-29`, přesně pět: **✅ ověřeno naostro · 🧪 zelené testy ·
⛔ neověřeno · 🟡 podmíněně platné · ⚠️ rozpor.** **„Zelené testy“ NENÍ „ověřeno“.**

🔴 **Zvuk z bodu A.1 se necommituje** (R24, `.gitignore` má `dukazy/**/*.webm`). Do `dukazy/`
patří jen `vysledek.json` a `README.md`.

---

## 17. Rollback

**Jeden PR = jeden revert.** `plan.md:68`: *„Každá story je samostatně revertovatelná. Žádná
migrace v1 (desktop nikam nepíše).“*

```
git revert <sha PR merge commitu>
```

Po revertu zmizí `electron/retention.cjs` a `tests/retention.test.js`;
`src/components/Settings.jsx` se vrátí na čtyři položky a výchozí `24 hodin po odeslání`.

**Co revert NEVRÁTÍ:** nic v uživatelských datech. Modul není nikam zapojený (§12.1), takže
během běhu aplikace **nesmazal ani jeden soubor**.

⚠️ **Jeden vedlejší účinek revert MÁ:** vrátí výchozí hodnotu na `24 hodin po odeslání`, čímž
**vrátí sílu** kontrole `ui-smoke.mjs:259` (past B, §12.4). Je to tedy revert **do bezpečnějšího
měřicího stavu**, ne z něj.

**Migrace:** žádná. **Vypínač:** žádný nový; `DESKTOP_UPLOAD_ENABLED` **se nesahá** — je cizí
a `E5.sh` na to má bránu.

⚠️ Až bude retence zapojená (jiná story), platí opačně: revert nechá soubory **nesmazané**,
což je bezpečný směr — disk poroste, data se neztratí.

---

## 18. Definition of Done

Sedm bodů ✅ převzatých doslova z `plan.md` §3 (řádky 180-186):

1. Cílený test **napřed** a viděný **červený** ze správného důvodu.
2. `npm run lint`, `typecheck`, `test:unit` — všechny EXIT=0, **měřeno před rourou**.
3. Sabotáž, která prokazatelně chytá odstranění guardu, s **doslovným výpisem**.
4. Nejméně jeden případ, který musí zůstat **zelený** (poměr 2–3 červené : 1 zelená).
5. Diff přečtený Claudem, u money a RBAC povinně.
6. PR odkazuje na Feature ID a tenhle plán.
7. **Bez produkce a bez merge** před Danovým finálním schválením.

**Specificky pro B11 navíc:**

8. `git diff --stat` **neobsahuje `electron/main.cjs` ani `electron/preload.cjs`** — B11 v nich
   vlastní **nic** (§12.1). Jediný řádek = porušení vlastnictví a důvod k vrácení PR.
9. `git diff --stat` neobsahuje `scripts/ui-smoke.mjs`, `src/lib/manifest.js`, `src/lib/queue.js`,
   `electron/queue.cjs`, **`docs/server-modul/**`**, `design/**`, `.env*`, `spec.md` ani `plan.md`.
10. **Z2** je zelený a **S2** ho prokazatelně shodí — doslovný výpis v PR.
11. **Z3 EXISTUJE**, je zelený, a **S5** ho prokazatelně shodí — doslovný výpis v PR.
    *(Bez Z3 se story nepřebírá; R22 je money-path.)*
12. **S4 shodí T1 i T2**, a testy se přitom ptají `existsSync`, ne `deletedFiles` (§13 krok 1b).
13. Popisky `Ihned smazat`, `24 hodin po odeslání`, `7 dní po odeslání`, `30 dní po odeslání`
    a selektor `.settings-select select` **zůstaly beze změny**; nová `<option>` je **bez
    atributu `value`** (§12.4).
14. 🔴 **V PR je výslovně napsané, že změna výchozí hodnoty OTUPILA kontrolu
    `ui-smoke.mjs:259`**, s doporučenou opravou pro vlastníka B1 — a totéž je v `DAN-TODO.md`
    (§12.4, past B). **Nevypsané otupení brány je horší než neopravené.**
15. 🔴 **V PR je výslovně napsané, že `electron/retention.cjs` NIKDO NEVOLÁ** a že aplikace
    po téhle story stále nesmaže ani jeden soubor (§12.1, §5).
16. `bash scripts/akceptace/E5.sh` hlásí **PASS 6/6** a `bash scripts/akceptace/E8.sh`
    **PASS 12/12**. *(CI ani jeden nepouští — §15.)*
17. `npm run typecheck` je EXIT=0 **i s novým modulem v programu** (§13 krok −1), a to bez
    zásahu do `jsconfig.json`.
18. Rozpor R19 × S1 (§8) a všechny otázky ze §21 jsou **zapsané v `DAN-TODO.md`**, ne vyřešené
    vlastním rozhodnutím.
19. V PR jsou **čtyři osy** po změně (`spec.md` §3) — včetně toho, že `exposure` u F015
    **zůstává `labs`** a proč (§3), a že UI polovina zůstává `unverified`.
20. **`verification` nesmí být `verified-live`**, dokud to člověk neviděl podle §16 — a
    kanárek 4 dnes říká, že bod C ✅ být nemůže.

---

## 19. Implementátor

**Codex** (`gpt-5.6-sol`, výchozí model), viditelně v Orce (`BEH-NOC.md:57-61`):

```
~/.claude/scripts/orca-codex.sh start "B11 retence 7 dní" "<zadání = tenhle packet>"
```

🔴 **Codex ve worktree needituje git, edituje jen SOUBORY** (`BEH-NOC.md:67-69`). `git add`,
`fetch`, `merge` i `checkout` mu v sandboxu spadnou na „Operation not permitted“ — index leží
mimo pracovní strom. **Do zadání patří věta „NEDĚLEJ ŽÁDNOU git operaci“**; commituje
orchestrátor, a to **hned** po doběhnutí, ještě před bránami a sabotážemi (§14).

⚠️ **Jediná povolená výjimka** (`BEH-NOC.md:71-73`): `git --no-pager status --porcelain` —
jen čte a nesahá na index. Po každém vrácení sabotáže je **povinná** (§14).

**Worktree:** jeden strom = jeden zapisovatel. B11 nesdílí soubory s B9 ani B10, může běžet
souběžně. Zakládej přes Orcu, ať je vidět v sidebaru:

```
orca worktree create --name desktop-b11 --display-name "Desktop: retence 7 dní"
```

### 🔴 Co implementátor NESMÍ (masterplán §9, doslova)

- **rozšířit scope;**
- **změnit schválený design;**
- **vytvořit nový design-system pattern bez tasku a schválení;**
- **změnit API/datový kontrakt bez aktualizace plánu;**
- **oslabit test;**
- **obejít bránu;**
- **rozhodnout nové money nebo RBAC pravidlo.**

> Pokud task packet nestačí, vrátí konkrétní otázku koordinátorovi. **Nehádá.**

A k tomu z `BEH-NOC.md:143-158` a `AGENTS.md`:

- **Při selhání opravuj VADU, ne měřidlo, a nejvýš tři kola.** Zakázané „opravy“: změkčení
  testu, vypnutí brány, mazání testu, baseline, `--force`, `[skip ci]` — a v téhle story navíc
  **přidání `electron/retention.cjs` do `jsconfig.json` → `exclude`** nebo odstranění importu
  z testu, jen aby prošel typecheck (§13 krok −1). Po třetím neúspěchu **zastav, nech PR
  otevřený a napiš, co přesně padá.**
- **Merge do `main`** čehokoli, co mění chování aplikace, je zakázaný.
- **Psát do Tabidoo** — za všech okolností, i nepřímo.
- **Číst nebo vypisovat secrets** (`.env*`, `*.key`, `*.pem`, `~/.ssh`).
- **Commitnout zvuk ze skutečné schůzky** (R24).
- Chybu ve zmrazeném specu/plánu **neopravuj** — zapiš do `DAN-TODO.md` a jeď dál.

---

## 20. Reviewer

**Claude** (`opus`) nad diffem — konsolidace zůstává vždy na hlavní session
(`BEH-NOC.md:63-65`: *„diff, brány, commit, PR čte a dělá Claude, i u Codexovy práce“*).

Průchody podle masterplánu §14, s důrazem, který si tahle story zaslouží:

| Průchod | Na co se dívat u B11 |
|---|---|
| **Pass 1 — Correctness** | Práh `>=` vs `>`. **`ms === null` vs `!ms`** — nula je falsy a „Ihned smazat“ je nula (§10). Chování při `sentAt === null`, při prázdné frontě, při `ENOENT`, a při **částečném selhání** (jedna stopa smazaná, druhá ne — pravidlo 6 v §10). |
| **Pass 2 — Security a RBAC** | Modul nesmí sáhnout mimo cesty z `item.tracks`. Žádné `..`, žádný glob nad `userData`, žádné `rm -rf` adresáře. Podvržená cesta ve frontě = smazaný cizí soubor. ⚠️ **Test na tohle packet nepředepisuje** — je to **O-B11-12**. |
| **Pass 3 — Money safety** | 🔴 **Nejtvrdší průchod.** Mazání je nevratné. Ověř: maže se **jen** `state === "odeslano"` **a** `sentAt` neprázdné; **manifest se nemaže ani nepřepisuje** (R22 → R10 → hodiny do mzdových nákladů); fail-closed míří na **nemazat**. **Bez zeleného Z3, který padne na S5, se PR nepřebírá.** |
| **Pass 4 — Spec compliance** | R19, R23, R12, R16, R20, R22, R24 · rozpor R19 × S1 zapsaný, ne vyřešený svévolně. |
| **Pass 5 — Plan compliance** | **Vlastnictví: `main.cjs` a `preload.cjs` se v diffu nesmějí objevit.** Soubory sedí s `plan.md` §2b. Diff do ~130 řádků bez testů. **A: je v PR napsané otupení `ui-smoke` (§18/14) a nezapojenost modulu (§18/15)?** |
| **Pass 6 — Měřidla** 🔴 *nové* | Ptají se testy **souborového systému**, ne návratové hodnoty (§13/1b)? Je fixtura postavená **produkčními funkcemi**, ne opsaným literálem (§13/1)? Je po sabotážním kole `git status --porcelain` **prázdný** (§14)? |

**Money-critical klauzule** (`plan.md` §3 bod 5, masterplán §10): story sice nepočítá částky,
ale **maže firemní data** a dotýká se klíče proti duplikaci (R22). **Nemerguj ji na základě
zelených testů ani autorova self-review.** Diff musí přečíst Claude.

---

## 21. Otevřené otázky — vrátit koordinátorovi, NEROZHODOVAT

Masterplán §9: *„Pokud task packet nestačí, vrátí konkrétní otázku koordinátorovi. Nehádá.“*
Každá patří do `DAN-TODO.md`; **žádná neblokuje kód napsaný podle §10-§13.**

| # | Otázka | Proč to implementátor nesmí rozhodnout sám |
|---|---|---|
| **O-B11-1** | **Kdo zapojí `retention.cjs` do hlavního procesu?** `plan.md` §2 dává B11 v `main.cjs` i `preload.cjs` **„nic“**, takže modul nikdo nezavolá a R23 zůstává nesplněné. | Změna tabulky vlastnictví ve zmrazeném plánu. |
| **O-B11-2** | **R19 × S1:** v v1 se nikdy nic neodešle, takže retence nikdy nic nesmaže. Má v1 mazat i **neodeslané** nahrávky po N dnech? | Mazání neodeslaných firemních dat je stopka pro Dana (peníze, mazání dat). |
| **O-B11-3** | **Kde bydlí nastavení?** `specs/E6…:67` předepisuje `electron/settings.cjs` + `userData/nastaveni.json` + IPC `settings:get/set`; `plan.md` §2b u B11 jmenuje jen `electron/retention.cjs` (a E6 mluví o `electron/queue/janitor.cjs`, ne o `retention.cjs`). Který dokument platí a kdo vlastní ty bloky? | Rozpor mezi starým specem a zmrazeným plánem; `spec.md` říká, že rozpor implementátor neřeší. |
| **O-B11-4** | **Stav `purged` v manifestu.** `specs/E6…:67` chce po smazání přepsat manifest na `state:'purged'`, ale `MANIFEST_STATES` (`manifest.js:6`) zná tři stavy a celé E6 schéma manifestu (`specs/E6…:49`) se s implementovaným rozchází. | Přidání stavu = změna datového kontraktu bez aktualizace plánu. |
| **O-B11-5** | **Chybí schválená kresba pro „Zvuk“ i „Záznamy“.** `approved.json` má jen „nastavení — účet“ a „nastavení — diagnostika“; náhled §04 slibuje čtyři záložky a kreslí obsah dvou. Ovládací prvek retence tedy nemá schválenou podobu — a schválený design je záložkový, dnešní `Settings.jsx` ne. | Kreslit ji = změnit schválený design (masterplán §9). |
| **O-B11-6** | **Přesné popisky.** Je „Nemazat“ ten správný text? Zůstává „Ihned smazat“ a „24 hodin po odeslání“, když výchozí je nově 7 dní? Dnešní copy („Ponechat na tomto Macu“) v žádném schváleném artefaktu není. | Copy vidí uživatel; `spec.md` §7 má na copy vlastní pravidla. |
| **O-B11-7** | **Prahy disku 2 GB / 5 GB** (R23, `specs/E6…:67`) — patří do B11, nebo do samostatné story? Packet je drží **mimo scope**, protože v `plan.md` §2b u B11 nejsou. | Rozšíření scope. |
| **O-B11-8** | **Zdroj času.** Packet volí `sentAt`; plán §2b říká jen „soubor starší 7 dnů“. Potvrdit `sentAt` proti `mtime`. | Volba mění, co se smaže po obnově ze zálohy. |
| **O-B11-9** | **B7 ještě neběžela.** Kdyby změnila tvar položky fronty, rozhraní z §10 se rozejde. *(Zmírněno tím, že fixtura se staví produkčními funkcemi — §13 krok 1 — takže se rozejití projeví červeně, ne tiše.)* | Závislost v DAG, ne rozhodnutí implementátora. |
| **O-B11-10** 🔴 *nové* | **Osa `exposure` u F015.** `BEH-NOC.md:13` chce plošně `disabled`, ale `spec.md` §3 má F015 na `labs` a B11 mu dosažitelnost nebere. Zapsat `disabled` = zhoršit matici o vlastní aplikaci. Packet volí **`labs` beze změny** — potvrdit. | Změna významu osy ve zmrazené matici. |
| **O-B11-11** 🔴 *nové* | **Retence nemá vlastní Feature ID.** `spec.md` §3 zná F001–F016 a mazací mechanismus mezi nimi není; packet ho věší na F015 („…záznamy…“). Má vzniknout `DSK-F017`? | Doplnění řádku do zmrazené matice. |
| **O-B11-12** 🔴 *nové* | **Podvržená cesta ve frontě.** Reviewer Pass 2 to má na seznamu, ale §13 na to nemá test. Má B11 přidat guard (cesta musí ležet pod `userData/nahravky`) a test, nebo je to samostatná bezpečnostní story? | Nové bezpečnostní pravidlo = masterplán §10 (security drží Claude). |
| **O-B11-13** 🔴 *nové* | **`ui-smoke` po B11 měří slaběji** (past B, §12.4). Kdo a kdy opraví `ui-smoke.mjs:248-259`, aby se hodnota nastavovala na jinou než výchozí? Patří to do B1, nebo do samostatné opravy? | Cizí soubor (vlastní B1), a je to změna měřidla. |

---

## Co revize opravila

Revize otevřela **skutečný kód** a **spustila brány**. Původní návrh packetu byl v podstatě
poctivý — o to důležitější je těch dvanáct míst, kde neplatil.

### A. Tvrzení, která v kódu neplatila

1. **`HEAD = 0380bc0` bylo neplatné už při psaní.** Main se během revize posunul dvakrát
   (`0380bc0` → `a4010fc` → `cef07cb`, devět commitů). Kódové soubory pro B11 jsou naštěstí
   **byte-identické** (`git diff 0380bc0 HEAD -- scripts/ui-smoke.mjs src/components/Settings.jsx
   src/components/Onboarding.jsx` je prázdný), takže obsah packetu přežil. **HEAD z §1 vypadl
   a nahradily ho SHA tří souborů, na kterých packet stojí.**
2. **`main.cjs:475` → `:478`.** Packet si protiřečil se `spec.md` R22, který sám cituje a který
   číslo `478` uvádí správně.
3. **`tests/queue.test.js:6` → `:5`.** Na `:6` je import `manifest.js`, ne vzor pro CJS.
4. **„šest výskytů“ retence → sedm.** Vypadl `scripts/akceptace/E8.sh:42`, což je polovina
   podmínky brány E8.
5. **`src/styles.css:1184-1272` → `.settings-select` je na `1185`**, `.settings-select select`
   na `1257`, `.settings-hint` na `1267`.
6. **§6 „tři karty“ podhodnocovalo problém.** Schválený náhled §04 říká **„Čtyři části“**
   a kreslí obsah **dvou** ze čtyř záložek. Nenakreslená není jen „Záznamy“ — **nenakreslená
   je i „Zvuk“, tedy přesně ta část, kterou B11 mění.** Grep navíc ukázal, že dnešní copy
   („Ponechat na tomto Macu“, „po odeslání“) v žádném schváleném artefaktu není.
7. **§15 tvrdil, že `electron/**` je z typecheku vyloučené — PROKÁZANĚ NENÍ**, jakmile ho
   importuje typechecknutý test. `tsc --listFiles` ukazuje v programu `electron/auth.cjs`
   i `electron/queue.cjs`; pokusný typový chyták uvnitř importovaného `.cjs` shodil
   `tsc` s `EXIT=1`. Kdyby to packet neřekl, implementátor by červený typecheck „opravil“
   vyloučením souboru — tedy zakázaným zásahem do měřidla.
8. **§14 odůvodňoval `git checkout -- .` opačně, než to funguje.** Změřeno: na **untracked**
   nový soubor příkaz nesáhne a **sabotáž v něm zůstane**. Nebezpečí není „smaže mi práci“,
   ale „myslím si, že jsem vrátil, a měřím rozbitý kód“.
9. **§12.3 neměl `docs/server-modul/**`.** `E8.sh:40-44` drží O3 („délka retence není
   rozhodnutá“) jako **aktivní bránu** nad `datovy-model.md`. Kdo tam dopíše „7 dní“, shodí
   cizí bránu, kterou nesmí opravit.
10. **§3 cílilo `exposure: disabled`, ale F015 je dnes `labs`.** Aplikace ten stav nemění.
    Osa zůstává `labs`; rozpor s plošným cílem `BEH-NOC.md:13` je otázka **O-B11-10**.
11. **§5 chtěl smazat větu „V prototypu se žádný zvukový soubor nevytváří ani nemaže.“ —
    a nahradit ji nepravdou.** §12.1 nechává modul nezapojený, killswitch je vypnutý, do stavu
    `odeslano` se nikdy nic nedostane ⇒ **po B11 aplikace stále nemaže nic.** Věta zůstává.
12. **§15 vynechal `.env.local` z cílů E5** a neřekl, že **CI nepouští žádný akceptační skript**
    (`ci.yml` jede jen `gates` + `build`).

### B. Díry, které v packetu vůbec nebyly

13. 🔴 **Změna výchozí hodnoty na „7 dní po odeslání“ promění kontrolu `ui-smoke.mjs:259`
    v tautologii.** `<select>` je řízená React komponenta: dnes (default `24 hodin`) test
    dokazuje, že se změna propsala; s defaultem `7 dní` projde i s mrtvým `onChange`.
    B11 nesmí `ui-smoke.mjs` opravit (vlastní B1) — musí to **napsat do PR a do `DAN-TODO.md`**
    (§12.4 past B, §18/14, **O-B11-13**). Je to přesně třída selhání, kterou `BEH-NOC.md:126-135`
    pojmenovalo dnes v noci.
14. 🔴 **Pro R22 chyběl test.** Sabotáž **S5** i DoD bod „doloženo testem“ existovaly, ale §13
    ten test nikomu neuložil napsat. Šest testů, sedmé pravidlo bez měřidla — a je to
    money-path (smazaný manifest ⇒ duplikát ⇒ hodiny do mzdových nákladů). **Doplněn Z3.**
15. 🔴 **Testy mohly měřit návratovou hodnotu místo disku.** Pak by se **S4** (prázdná
    `unlink` smyčka) dala obejít naplněním `deletedFiles` z `planRetention`. **Doplněn
    závazný krok 1b: `existsSync`, nikdy jen `deletedFiles`.**
16. 🔴 **Fixtura měla být opsaný literál — tedy kopie kontraktu.** `spec.md` §11 jmenuje „test
    nad kopií logiky“ mezi třídami lhoucích bran. **Fixtura se teď staví produkčním
    `enqueueRecording` + `processNext`** (ověřeno, že `uploadEnabled` je argument, ne env),
    čímž se riziko **O-B11-9** změní z tichého na hlasité.
17. **`retentionMs("Ihned smazat") === 0` je falsy** — `if (!ms)` by z „Ihned smazat“ udělalo
    „nikdy“. Přidána sabotáž **S6** a bod v reviewer Pass 1.
18. **§16 bod A nebyl spustitelný:** `queue.json` nemá v repozitáři definovanou cestu a
    `applyRetention` bere objekt, ne cestu. Přepsáno na skript; ověřeno, že
    `require("./electron/…cjs")` funguje i pod `"type": "module"`.
19. **Masterplán §13 „Design verification“ chyběl v §16** — user-visible story potřebuje
    screenshot a porovnání proti artefaktu. Doplněn bod 9 i s tím, že porovnávat je proti čemu
    jen zčásti (**O-B11-5**).
20. **Nespecifikované částečné selhání** (jedna stopa smazaná, druhá ne). Doplněno jako
    pravidlo 6 v §10 a označeno jako rozhodnutí packetu.
21. **`DAN-TODO.md` A1** („první ostrá nahrávka až po sepsání souhlasu a retence“) se do
    živého scénáře promítl jako předpoklad **P0**, ne jako poznámka pod čarou.
22. **Nezapojený není jen `src/lib/queue.js`, ale i `electron/queue.cjs`** — jediné výskyty
    obou jsou testy. §11 opraveno.
23. **B1 není na `main`.** `BEH-NOC.md:192` tvrdí „ta je opravená“, ale `a4010fc` ji z main
    vzal pryč (žije na `orca/desktop-b1`). Kanárek 4 tím platí, ale rozpor dokumentu s kódem
    je v §2 pojmenovaný.

### C. Co je nově ZMĚŘENO, ne citováno

Autor návrhu přiznal, že nespustil ani jednu bránu. Spustil jsem je:

| Brána | Výsledek |
|---|---|
| `npm run lint` | ✅ **EXIT=0** |
| `npm run typecheck` | ✅ **EXIT=0** |
| `npm run test:unit` | ✅ **77 testů / 9 souborů, EXIT=0** — sedí s `BEH-NOC.md:101` |
| `bash scripts/akceptace/E5.sh` | ✅ **PASS 6/6, chyb: 0** |
| `bash scripts/akceptace/E8.sh` | ✅ **PASS 12/12, chyb: 0** |
| `git status --porcelain` po všem | ✅ prázdný — brány strom nezašpinily |

A dvě věci, které autor vydával za převzaté z dokumentů, jsou teď ověřené v kódu:

- **Tlačítko „Povolit“ v `src/` neexistuje** (`grep -rn "Povolit" src/` → nula).
  `Onboarding.jsx:73-110` vrací popisky `Povoleno` · `Otevřít Nastavení` · `Omezeno systémem` ·
  `Znovu ověřit` · `Požádat`. `clickByText` na nenalezené tlačítko **vyhazuje výjimku** ⇒
  `ui-smoke` skutečně končí na `:301`. Kanárek 4 stojí.
- **Řádková čísla v `cesta-uzivatele-2026-09-01.md`** (M23 = 53, M31 = 61, „Co musí rozhodnout
  Dan“ bod 5 = 114) i všechny citace z `spec.md`, `plan.md`, `AGENTS.md` a `specs/E6…` §10
  **sedí doslova**.

## Co packetu chybí ve spec/plan

- Kdo zapojí `electron/retention.cjs` do hlavního procesu. `plan.md` §2 dává B11 v `main.cjs` i `preload.cjs` doslova „nic“, takže modul po dokončení story NIKDO NEVOLÁ a R23 („retence musí v v1 opravdu běžet“) zůstává nesplněné. Ve spec ani plánu není story, která by to zapojení nesla.
- Rozpor R19 × S1: R19 podmiňuje mazání úspěšným odesláním, ale v1 nemá kam odesílat (`DESKTOP_UPLOAD_ENABLED=false`, `src/lib/queue.js:202` vrací `disabled`), takže do stavu `odeslano` se nikdy nic nedostane a retence nikdy nic nesmaže. Spec ani plán neříkají, co s tím — má v1 mazat i neodeslané nahrávky po N dnech? Je to mazání firemních dat, tedy stopka pro Dana.
- Kde bydlí nastavení. `specs/E6-prihlaseni-a-fronta.md:67` předepisuje `electron/settings.cjs` + `userData/nastaveni.json` + IPC `settings:get`/`settings:set` a jmenuje janitor jako `electron/queue/janitor.cjs`; `plan.md` §2b u B11 jmenuje jen `electron/retention.cjs` a žádné IPC. Který dokument platí a kdo vlastní ty bloky v `main.cjs`/`preload.cjs`.
- Manifest po smazání. `specs/E6…:67` chce přepis na `state:'purged'`, ale implementované `MANIFEST_STATES` (`src/lib/manifest.js:6`) zná jen `recording|complete|incomplete` a celé E6 schéma manifestu (`specs/E6…:49`, s poli `deleteAfter`, `uploadedAt`, `uploaded`) se s implementovaným rozchází. E6 §10 tedy nejde nad dnešním kódem postavit a spec neříká, které schéma platí.
- Schválená kresba pro záložky „Zvuk“ a „Záznamy“ chybí. `design/approved.json` má v `coveredScreens` jen „nastavení — účet“ a „nastavení — diagnostika“; `design/navrh/nahled.html:539` slibuje „Čtyři části“ a kreslí obsah dvou. Ovládací prvek retence, který B11 mění, tak nemá schválenou podobu — a schválený design je záložkové okno, kdežto `src/components/Settings.jsx` je jednosloupcový seznam sekcí.
- Přesné popisky voleb. Text „Nemazat“ není nikde schválený a dnešní copy („Ponechat na tomto Macu“, „Po odeslání do LuDone“, „24 hodin po odeslání“) se v žádném schváleném artefaktu nevyskytuje — grep nad `design/navrh/nahled.html` na tyhle řetězce vrací nulu. `spec.md` §7 má přitom na copy vlastní pravidla.
- Zdroj času pro výpočet stáří. `plan.md` §2b říká jen „soubor starší 7 dnů“; packet volí `sentAt` z položky fronty (proti `mtime`, který mění Time Machine a rsync). Volba mění, co se smaže po obnově ze zálohy, a plán ji nefixuje.
- Prahy volného místa 2 GB / 5 GB. R23 je jmenuje a odkazuje na `specs/E6:67`, ale `plan.md` §2b je u B11 nemá. Není řečeno, jestli patří do B11, nebo do samostatné story.
- Osa `exposure` u DSK-F015. `BEH-NOC.md:13` chce plošně `disabled`, ale `spec.md` §3 řádek 92 má F015 na `labs` a B11 dosažitelnost okna Nastavení nemění. Není rozhodnuté, jestli se osa smí zhoršit, nebo zůstat.
- Retence nemá vlastní Feature ID. `spec.md` §3 zná F001–F016 a mazací mechanismus mezi nimi není; packet ho věší na F015, protože jeho název obsahuje slovo „záznamy“. Není rozhodnuté, jestli má vzniknout nový řádek matice (např. DSK-F017).
- Ochrana proti podvržené cestě ve frontě. Reviewer Pass 2 to má na seznamu (modul nesmí sáhnout mimo `item.tracks`, žádné `..`), ale ani spec, ani plán nepředepisují guard ani test. Nové bezpečnostní pravidlo je podle masterplánu §10 práce pro Claude, ne pro implementátora.
- Kdo opraví `scripts/ui-smoke.mjs:248-259` poté, co B11 změní výchozí hodnotu na „7 dní po odeslání“ a tím z kontroly udělá tautologii. Soubor vlastní B1, oprava je změna měřidla a plán s touhle interakcí nepočítá.
- B7 ještě neběžela a `plan.md` nefixuje tvar položky fronty jako kontrakt. Kdyby B7 tvar změnil, §10 packetu se s ním rozejde — plán neříká, kdo v tom případě rozhoduje.

## 🔴 Co NEBYLO ověřeno v kódu

Skeptik packet přečetl proti kódu, ale tohle zůstalo bez důkazu.
**Než na tom postavíš implementaci, otevři to.**

- Nespustil jsem `scripts/ui-smoke.mjs` — potřebuje GUI a `BEH-NOC.md:154` ho v sandboxu zakazuje. Že skript umírá na `:301`, mám doloženo NEPŘÍMO, ale silně: `grep -rn "Povolit" src/` vrací nula výskytů a `clickByText` na nenalezené tlačítko vyhazuje výjimku. Skutečný běh jsem neviděl.
- Nespustil jsem `npm run build` (`vite build`). Je to poslední krok CI a jediná brána z §15, kterou jsem nezměřil.
- Neprovedl jsem živé ověření podle §16 — žádný `npm start`, žádná nahrávka, žádné okno Nastavení, žádný screenshot. Celý §16 je návrh scénáře, ne protokol z běhu.
- Nenapsal jsem `electron/retention.cjs` ani `tests/retention.test.js` a nespustil jediný červený test. Doslovné výpisy v §13 a §14 jsou OČEKÁVANÝ TVAR výstupu vitestu, ne zachycený běh — v packetu je to označené a implementátor je musí nahradit skutečnými.
- Neověřil jsem spuštěním, že sabotáže S1–S6 opravdu shodí právě ty testy, které packet uvádí, a jen je. Přiřazení sabotáž→test je odvozené z logiky kontraktu §10, ne změřené.
- Z akceptačních skriptů jsem spustil a přečetl jen E5.sh a E8.sh. E1, E1b, E2, E2-sabotaze, E3, E4, E6, E7 jsem neotevřel vůbec — je možné, že některý z nich na retenci nebo na Settings.jsx také sahá.
- Nečetl jsem celý `docs/ux/cesta-uzivatele-2026-09-01.md` (44 KB). Ověřil jsem doslovnost a čísla řádků u M23 (53), M31 (61), seznamu chybějících momentů (body 9, 13, 19) a „Co musí rozhodnout Dan“ bod 5 (114). Zbytek dokumentu neznám.
- Nečetl jsem celý `specs/E6-prihlaseni-a-fronta.md`. Přečetl jsem §8, §9, §10, §11, §12, „Měřítko etapy“ a část „Dotčené soubory“ plus cílené grepy. Sekce 1–7 neznám.
- Neotevřel jsem jednotlivé artboardy `design/canvas/*.dc.html` ani `design/navrh/*.dc.html`. Tvrzení o tom, co je a není nakreslené, stojí na `design/approved.json` (coveredScreens), na výpisu `design/canvas/` (žádný artboard Nastaveni) a na přečtení `design/navrh/nahled.html:535-600` — ne na prohlédnutí každého souboru.
- Z `docs/MASTERPLAN.md` jsem přečetl §9 (task packet, 20 polí), §13 (TDD, zákaz změkčení, Design verification) a osnovu nadpisů. §3 kanonické artefakty, §8 plán, §10 role, §14 PR a review a §20 pilot znám jen z odkazů v ostatních dokumentech.
- Neotevřel jsem `electron/auth.cjs`, `src/features/recording/RecordingCard.jsx` ani `src/features/tracking/TrackingCard.jsx`. Z `electron/main.cjs` jsem četl jen okolí řádků 465-490 plus cílené grepy na `settings`.
- Nečetl jsem `tests/queue.test.js` celý (prvních 30 řádků + grepy). Že názvy testů, které grepuje E5.sh, v souboru opravdu jsou, mám doložené jen tím, že E5.sh PASS — ne přečtením těch testů.
- Neověřil jsem, jak se `git checkout -- .` chová ve WORKTREE (Codex jede v `orca worktree`). Pokus s untracked souborem jsem dělal v čerstvém `git init` repozitáři ve scratchpadu, ne ve worktree.
- Netestoval jsem `npm run typecheck` nad SKUTEČNÝM `electron/retention.cjs` — pokus s vynucenou typovou vadou proběhl nad kopií jsconfig.json v scratchpadu se symlinkem na node_modules. Že se importovaný `.cjs` dostane do programu, je navíc doloženo přímo `tsc --listFiles` nad ostrým projektem (auth.cjs a queue.cjs tam jsou).
- Neověřil jsem, jestli vitest nový soubor `tests/retention.test.js` opravdu nabere — vycházím z `vitest.config.js` (`include: ["tests/**/*.test.js"]`) a z toho, že stejný vzor drží devět existujících souborů.
- Neověřil jsem chování `select` v React 19 experimentálně. Tvrzení o pasti B (že s výchozí hodnotou „7 dní po odeslání“ projde `ui-smoke.mjs:259` i s rozbitým onChange) stojí na sémantice řízené komponenty (`value={settings.retention}` na `Settings.jsx:81`) a na přečteném kódu `setSettings`, ne na spuštěném pokusu.
- Nekontroloval jsem stav větví `orca/desktop-b3` a `orca/desktop-b4` — nevím, jestli tam neleží práce, která se `Settings.jsx` nebo `src/lib/queue.js` dotýká. Ověřoval jsem jen `main`.
- Main se během mé revize dvakrát posunul (0380bc0 → a4010fc → cef07cb). Poslední tři commity jsem ověřil jako čistě dokumentační (`git diff --name-only` nevrátil nic v src/electron/tests/scripts), ale packet může být zastaralý ve chvíli, kdy ho někdo čte.
