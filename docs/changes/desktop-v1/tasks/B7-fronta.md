# Task packet B7 (revidovaná verze)

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


**Rozlišovač typu položky ve frontě + zapojení fronty**

> Tahle verze vznikla skeptickou revizí návrhu **nad otevřeným kódem**. Všechna čísla řádků, jména funkcí, obsah bran a výstupy bran níž jsou **změřené 1. 9. 2026**, ne odvozené ze zadání. Co změřené není, je označené jako **otevřená otázka** — a implementátor ji nehádá.

---

## 1. Plan ID a Plan SHA

| | |
|---|---|
| **Plan ID** | `docs/changes/desktop-v1/plan.md` — „Plan: LuDone Desktop v1", change-id `desktop-v1` |
| **Plan SHA** | `c7b1bb715f87f53ca0a209d5d3b96e6018e1e437` ✅ ověřeno `git log -1 --format=%H -- docs/changes/desktop-v1/plan.md` |
| **Spec SHA** (zmrazeno) | `1e9709779e94a654a0c3c959d260082d42801acc` ✅ ověřeno |
| **Design SHA** (`design/approved.json`) | `26a06abd2ff8449cd74862ca3df7fb36f2db0005` ✅ ověřeno |
| **HEAD při revizi packetu** | `0380bc0014c54231d1bbe045d7d87176ddbce847`, větev `main`, strom **čistý** ✅ |

⚠️ **Oprava proti návrhu.** Návrh uváděl HEAD `73322adc744e0af88395050108d54926e1568f9b`. Ten commit existuje, ale je **7 commitů za dnešním HEAD** (`git rev-list --count 73322ad..HEAD` → `7`). Tři SHA dokumentů se nezměnily, takže zadání platí; **HEAD ale ne**. Větev zakládej nad aktuálním `main`, ne nad `73322ad`.

🔴 **Spec i plán jsou ZMRAZENÉ.** Když v nich najdeš chybu, **zapiš ji do `DAN-TODO.md` a pokračuj po tom, co na ní nezávisí** (`BEH-NOC.md`). Neopravuj je za pochodu.
⚠️ Soubory v `docs/changes/desktop-v1/sekce-navrhy/` **nejsou zadání** (`BEH-NOC.md`, `spec.md` §11).

---

## 2. Task ID

**B7** — `plan.md` §2 řádek 90: „Rozlišovač typu položky ve frontě + zapojení | Codex | Závisí: B5 | Blokuje: —" ✅ ověřeno doslovně.
Název PR (anglicky, `plan.md` §2b řádek 148): **`Wire the outbound queue for both item kinds`** ✅.
Odhad diffu bez testů: **~180 řádků**, PR **není dělitelné** ✅ (plan.md §2b).

⚠️ **Značka `⛔C2` v DAG diagramu (`plan.md` řádek 76: „B7 fronta ⛔C2").** Návrh ji zamlčel. Změřeno: `decisions.md` řádek 72 vede C2 jako **běžné rozhodnutí** („Dva samostatné vypínače", sloupec „Proti doporučení? → ne"), **ne jako stopku**; jediná skutečná stopka je B12 (`plan.md` řádek 95, „⛔ **STOPKA**"). ⇒ `⛔C2` čti jako *„tuhle story svazuje rozhodnutí C2"*, ne *„B7 je blokovaná"*. **Kolizi značení zapiš do `DAN-TODO.md`** — `⛔` má v jednom dokumentu dva významy.

---

## 3. Feature ID

**`DSK-F009` — Odchozí fronta s opakováním** (`spec.md` řádek 86).

Stav před B7 ✅ ověřeno v `spec.md` i v kódu:
`scope: approved` · `delivery: coded` · `exposure: disabled` · `verification: tests-green`

Footnote ⁵ ověřena naostro: `grep -rn "lib/queue\|queue.cjs\|processNext\|enqueueRecording" src electron scripts tests` vrací **v `src/` a `electron/` jen definice v `src/lib/queue.js` samotném; jediný konzument je `tests/queue.test.js`**. Zelené testy nad nezapojeným kódem — potvrzeno.

Cílový stav po B7: `delivery: coded → pr-open` · `exposure: **disabled** (nemění se)` · `verification: **tests-green** (nikdy `verified-live`)`.

🔴 **`DSK-F010` zůstává `scope: draft`, `delivery: no-code`** (`spec.md` řádek 87, rozhodnutí S1). B7 se ho nesmí dotknout.

---

## 4. Cíl story

Dvě věci, jeden PR:

1. **Rozlišovač typu položky.** Fronta dnes umí jen nahrávky (`enqueueRecording`, `src/lib/queue.js:120` ✅). Aplikace má dvě agendy (M9, `decisions.md:24` ✅) a Architecture Spine dává `electron/queue.cjs` do vlastnictví „**odchozí fronta obou typů položek**" (`plan.md:18` ✅). Položka dostane pole `kind` (`recording` | `time`) a fronta druhý vstup.
2. **Zapojení fronty do hlavního procesu.** Hotová logika se poprvé někým zavolá.

Tři pravidla, která dnes fronta porušuje:

- **Trvalá chyba se neopakuje pětkrát** (R16, `KONTRAKT.md` §5) — dnes `processNext` opakuje každou chybu do `maxAttempts` (`queue.js:238-253` ✅).
- **`invalid_grant` je pauza, ne selhání** (R17) — nesmí spotřebovat pokus.
- **Dva samostatné vypínače** (R18, C2) — `processNext` má dnes jediný `uploadEnabled` (`queue.js:195, 202` ✅).

🔴 **Co B7 NENÍ:** není to odesílání (`plan.md` §4). Fronta se naplní, uloží, přečte a **nic neodešle**.

🔴 **A hlavně: B7 NENÍ hotové, dokud existující vada `DSK-F009` — „kód je, nikdo ho nevolá" — nepadne měřitelně.** Tohle je jediný skutečný smysl story. Viz §13 T7.

---

## 5. User-visible chování

B7 **nemá v rozsahu ani jeden soubor v `src/` mimo `src/lib/queue.js`** (§12), takže sám nic nevykresluje.

| Situace | Co se stane po B7 | Co se NEstane |
|---|---|---|
| Uživatel dokončí nahrávku **tlačítkem Stop** | Nahrávka se zařadí do trvalé fronty na disku. Panel dál hlásí „Uloženo místně: … Odeslání zůstává vypnuté." (`RecordingCard.jsx:242` ✅ ověřeno) | Nic se neodešle |
| Zavření notebooku, pád, restart | Fronta je po restartu stejná (klíč `clientRecordingId`, `queue.js:126-129` ✅) | Fronta se nesmaže |
| Trvalá chyba (403, uzavřený týden) | Položka skončí `selhalo` **s důvodem**, hned | Nezmizí, neopakuje se |
| Vypršelé přihlášení (`invalid_grant`) | Fronta se pauzuje, pokusy se nezapočítávají | Nespálí retry budget |
| Odhlášení | Fronta zůstává (R12) | — |

🔴 **Rozhodnutí, které návrh mlčky udělal a neřekl — teď je vypsané a je závazné.**
Nahrávky uzavřené **cestou po pádu / zničení okna / navigaci** se do fronty **NEZAŘADÍ**. Změřeno: `createPanelWindow` volá `finalizeRecordingSessionsForOwner(...)` na `electron/main.cjs:314, 317, 321`, ta volá `finalizeRecordingSession(sessionId, "incomplete")` (`main.cjs:654`). Zařazení dělá B7 **výhradně v IPC handleru `recording:finish`** (`main.cjs:676-679`), takže `incomplete` nahrávky frontu minou. Je to obhajitelné (neúplnou nahrávku nemá smysl posílat), ale je to **produktové rozhodnutí, ne detail** — a M30 („na starém Macu zůstane fronta, kterou nikdo nespočítá") mu odporuje.
⇒ **Napiš to do PR a do `DAN-TODO.md` jako otevřenou otázku.** Neřeš to v B7.

Copy: česky, bez „MCP", „scope", „token" (`spec.md` §7). V tomhle PR jde jen o `lastFailureReason` uložený v položce.

---

## 6. Odkaz na schválený Claude Design artefakt

**`design/approved.json`** ✅ přečteno celé — `status: approved`, `approvedBy: Dan`, `approvedAt: 2026-09-01`, `approvedVia: "statická náhledová stránka design/navrh/nahled.html, Danova věta „za mě teda schváleno""`, `specVersion: "…schváleno nad commitem babdd5a"`.

Pokryté a relevantní: `coveredScreens` obsahuje **„panel — čeká fronta"** ✅ · `coveredStates` obsahuje **„čeká fronta"**, **„offline"**, **„přihlášení vypršelo"** ✅.

Artboard **`design/canvas/Fronta.dc.html`** ✅ ověřeno grepem: sedm stavů `queue.waiting` · `queue.sending` · `queue.done` · `queue.retry` · `queue.failed` · `queue.gaveup` · `queue.reauth`, hlavička „3 čekají · 1 selhalo" (řádek 39) a pravidlo *„Prázdná fronta není chyba. Když není co odesílat, karta se v panelu vůbec nezobrazí…"* (řádek 78).

**Co z toho pro B7 plyne:** B7 nekreslí. Jeho jediná designová povinnost je, aby **datový model uměl těch sedm stavů nasytit**. Dnešní schéma (`queue.js:131-145` ✅) to splňuje; B7 přidá `kind`.

🔴 **Na `design/**` se nesahá** (`plan.md` §4; `AGENTS.md:66` *„`design/` je samostatná, cizí práce; bez výslovného vlastnictví na ni nesahej"* ✅).

⚠️ **Rozpor, který NEŘEŠÍŠ ty** — ověřen na obou stranách: artboard `Fronta.dc.html:127` má literál `Vzdáno po 6 pokusech`, zatímco `DEFAULT_RETRY_POLICY.maxAttempts = 5` (`queue.js:15` ✅) a `KONTRAKT.md` §5 říká „5 pokusů" ✅. **Nech `maxAttempts` na 5, nic nepřepisuj, rozpor napiš do PR a `DAN-TODO.md`.**

⚠️ Otevřená designová otázka (`approved.json`): *„Chování panelu při dvaceti a více položkách ve frontě"* — mimo rozsah B7.

⚠️ **Doplněno revizí:** `approved.json` uvádí `designProject: "… v době schválení **nedostupný**, viz design/zadani/README.md"` a poslední commit na `main` zní „Note that the design artifact is gone". Živý Claude Design canvas **neexistuje**; jediný designový podklad pro B7 je lokální `design/canvas/Fronta.dc.html` + `approved.json`. Nehledej ho online.

---

## 7. Relevantní výřez EXPERIENCE.md

🔴 **`EXPERIENCE.md` v tomhle repozitáři NEEXISTUJE** ✅ ověřeno. Jeho roli hraje **`docs/ux/cesta-uzivatele-2026-09-01.md`**. Výřez ✅ ověřen doslovně proti řádkům 52, 53, 55, 56, 57, 60:

> **M22 — Ztráta sítě a fronta** (ř. 52). *Patičku panelu se souhrnem „3 čekají, 1 selhalo" a u položek stav, procenta, odpočet dalšího pokusu. Nechat běžet — backoff min(30s×2^(n-1), 6h) s jitterem, budíky přes powerMonitor a net.isOnline(). Po týdnu offline naroste fronta na dvacet položek a do 366 px se nevejde; přetečení návrh neřeší. A kdo panel neotevře, neví o ní — potřebuje stav „pozor" na ikoně.*

> **M23 — Plný disk** (ř. 53). *…Retence navíc maže až po odeslání, takže **neodeslaná fronta disk sama drží**.*

> **M25 — Vypršení přihlášení uprostřed dne** (ř. 55). *…nahrávání jde na disk bez sítě a přihlášení nikdy nesmí nahrávku zastavit ani vyvolat dialog. Při probuzení notebooku si naráz sáhne pro token fronta, měřidlo i panel; bez jedné sdílené single-flight brány spustí souběžný refresh reuse detekci a revokuje CELOU rodinu.*

> **M26 — Nové přihlášení po 30 dnech** (ř. 56). *Fronta se přitom **nesmí ani dotknout** — panel musí říct „tvých N nahrávek je v bezpečí na disku".*

> **M27 — Odhlášení** (ř. 57). *Odhlášení taky nesmí sáhnout na frontu — nahrávky zůstávají, **pokusy se pauzují a nezapočítávají**.*

> **M30 — Změna Macu** (ř. 60). *Na STARÉM Macu zůstane fronta neodeslaných nahrávek, které nikdy nedojdou, a nikdo je nespočítá.*

**Co si odnést do B7:** backoff a jitter už v kódu jsou a nemění se · pauza místo spotřebovaného pokusu je R17 a je to jedna ze tří hlavních změn · budíky (`powerMonitor`, `net.isOnline()`) a „pozor" na ikoně **v B7 nejsou** (ikona je B3; budíky nemá žádná story — do `DAN-TODO.md`).

Ze seznamu „momenty, které nemají kde proběhnout" se B7 týká **přetečení fronty při dvaceti položkách** — mimo rozsah, je to otevřená designová otázka.

---

## 8. Relevantní business pravidla

Ze zmrazené `spec.md` §4 (ř. 141-169) a §11 (ř. 287-306) — ✅ všechna znění ověřena proti souboru:

| Pravidlo | Znění | Dopad na B7 |
|---|---|---|
| **R2** | Chunky jdou na disk **dřív, než se cokoli pošle**. | Zařazení až po uzavření souborů. |
| **R6** | Identita projektu je **GUID**, nikdy název. | `projectId` časové položky je GUID; validace odmítne prázdný řetězec. |
| **R8** | Klient **nikdy neposílá hodinovou sazbu**. | 🔴 money: `kind: "time"` **nesmí** nést sazbu; validace ji odmítne. |
| **R9** | Start i stop se ořezávají na **celé minuty**. | ⚠️ B7 **neořezává** — to je B5. Fronta bere časy tak, jak přijdou. |
| **R10** | 🔴 Klíč proti duplikaci vzniká **při STARTU**. | Klíč časové položky je `trackingId` z B5; fronta ho **nevyrábí**. |
| **R12** | Odhlášení **nesmí smazat frontu**. | B7 nikde nemaže soubor fronty. |
| **R13** | Odhlášení odvolá přístup nejdřív na serveru. | Kontext pro B9. |
| **R16** | `403` a „uzavřený týden" jsou **trvalé** chyby. | 🔴 **hlavní změna B7.** |
| **R17** | `invalid_grant` je **pauza**, nespotřebovává pokusy. | 🔴 **druhá hlavní změna.** |
| **R18** | **Dva samostatné vypínače** (C2), oba fail-closed, **každý musí mít vlastní test**. | 🔴 **třetí hlavní změna.** Viz T4 — návrh měl jen tři případy a čtvrtý chyběl. |
| **R19** | *„Lokální kopie nahrávky se po úspěšném odeslání smaže za **7 dní** (B3). Nastavitelné včetně ‚nemazat'."* | Mimo B7 (story B11). ⚠️ Návrh citoval R19 „doslovně" a **vypustil `(B3)`** — to je odkaz na *rozhodnutí* B3, ne na story B3. |
| **R20** | Nahrávky jsou **majetkem firmy** (B2). Admin je vidí všechny. | RBAC vyhodnocuje server. |
| **R22** | *Jméno souboru dnes nese jen `sessionId.slice(0, 8)` (`main.cjs:478`) …* ✅ ověřeno, `main.cjs:478` je `const prefix = \`${timestamp}-${sessionId.slice(0, 8)}\`` | ⚠️ **Mimo rozsah B7** — do `DAN-TODO.md`. |
| **R23** | Retence musí v v1 opravdu běžet. | Kontext pro B11. |

Z `KONTRAKT.md` §5 (ř. 88-101) — ✅ tabulka ověřena doslovně:

| Kód | Význam | Klient |
|---|---|---|
| `401` | Token vypršel | Obnoví token, **nespotřebuje pokus** |
| `403 company_out_of_scope` | Nemá právo | **Trvalá chyba** — neopakovat, data zachovat, říct důvod |
| `403 access_revoked` | Odebrán z firmy | Přestane odesílat i nabízet, **lokální soubory nemaže** |
| `409` | Idempotenční klíč už existuje | Není chyba — pokračuje s vráceným záznamem |
| `413` | Část moc velká | Zmenší část a zkusí znovu |
| `5xx` | Chyba serveru | Opakuje s odstupem: 30 s základ, strop 6 h, 5 pokusů, rozptyl 20 % |

> 🔴 `KONTRAKT.md` §5 (ř. 100-101): *„Trvalá chyba se nesmí opakovat pětkrát a skončit jako ‚failed' bez důvodu. **To je dnešní chování fronty a je to vada.**"* ✅ doslovně.

🔴 **Oprava proti návrhu:** návrh psal, že zdrojem třídy `permanent` je „`KONTRAKT.md` §5 (403, **400**)". **Kód `400` se v `KONTRAKT.md` nevyskytuje ani jednou** (`grep -n "400" docs/server-modul/KONTRAKT.md` → prázdno). Trvalá chyba podle kontraktu je **403**, plus „uzavřený týden" z R16. `400` do klasifikace **nezaváděj** — bylo by to nové pravidlo bez zadání.

---

## 9. Relevantní Architecture Spine invarianty

Z `plan.md` §1 (ř. 9-68) — **„Podřízené úkoly tato rozhodnutí nesmějí předefinovat."**

| Modul | Vlastní | Nesmí |
|---|---|---|
| `electron/main.cjs` | okno, tray, IPC, životní cyklus | rozhodovat o stavu podle rendereru |
| `electron/queue.cjs` | **odchozí fronta obou typů položek** | **znát obsah nahrávky** |
| `src/**` (renderer) | **jen zobrazení** | držet stav, který musí přežít pád |

🔴 *„Stav, který musí přežít pád rendereru, vlastní hlavní proces."* ⇒ frontu vlastní **main**, renderer dostává jen redukovaný pohled.

**RBAC:** *„Desktop žádnou z nich nevyhodnocuje sám."* ⇒ B7 nezavede jediné vlastní RBAC rozhodnutí.
**Peníze:** klient neposílá sazbu · klíč vzniká při startu · **zápis do Tabidoo z desktopu zakázán**.
**Vypínače:** dva, oba fail-closed, **vlastní test**.
**Rollback:** *„Každá story je samostatně revertovatelná. Žádná migrace v v1."*

🔴 **Invariant, který si vyžaduje výklad — teď se třemi doloženými důvody, ne dvěma.**
Spine dává frontu `electron/queue.cjs`, ale čistá logika leží v `src/lib/queue.js`. **Nepřesouvej ji.**
- (a) `scripts/akceptace/E5.sh:60` kontroluje `test -s src/lib/queue.js` ✅ ověřeno — přesun ji **okamžitě zčervená**.
- (b) `main.cjs:23-25` už dnes takhle importuje `src/lib/manifest.js` dynamickým `import(pathToFileURL(...))` ✅ ověřeno — „`src/**` je jen zobrazení" míří na React komponenty, ne na `src/lib/`.
- (c) 🔴 **NOVÉ, změřeno revizí:** `scripts/package-mac.mjs:26-27` kopíruje **celý adresář `src/lib`** do bundlu (`await cp(path.join(projectRoot, "src", "lib"), path.join(bundledAppDir, "src", "lib"), …)`). `src/lib/queue.js` se tedy do zabalené aplikace dostane a živé ověření (§16) může proběhnout. **Bez tohohle faktu by celý §16 stál na domněnce.**

Rozdělení pro B7: **`src/lib/queue.js` = čistá logika a pravidla · `electron/queue.cjs` = perzistence a pumpa · `electron/main.cjs` = zapojení a IPC.**

---

## 10. Vstupní a výstupní rozhraní

### 10.1 Co B7 čte (vstup)

**A) Dokončená nahrávka — ✅ ověřeno v `electron/main.cjs`:**

- `ownedRecordingSession(event, sessionId)` (**`main.cjs:537-545`** ✅) vrací živou session s `manifest`, `manifestPath`, `tracks` (Map `source → { filePath, handle, queue, … }`).
- `finalizeRecordingSession(sessionId, "complete")` (**`main.cjs:581-647`** ✅) vrací `{ startedAt, files }`, kde `files[source] = { name, size, sha256 }` (`main.cjs:610-614`).

🔴 **Past 1 (byla v návrhu, potvrzena):** `finalizeRecordingSession` **maže session z mapy na `main.cjs:638`** ✅ ještě před returnem. Reference si vezmi z `ownedRecordingSession(...)` **PŘED** finalizací.

🔴 **Past 2 — NOVÁ, návrh ji neměl a je zrádnější.** `recordingSession.manifest` držený v paměti je **manifest PŘED uzavřením**: vznikl na `main.cjs:491-496` se stavem `"recording"`, `sizeBytes: 0` a `sha256: null` (`recordingManifestTracks(tracks, startedAt)` s `files = null`, `main.cjs:457-458`) a `closedAt: null`. Finální manifest vzniká na `main.cjs:623` jako **nový objekt** a **nikdy se nezapíše zpět** do `recordingSession.manifest`.
⇒ Dnešní `validateManifest` (`queue.js:53-61`) kontroluje jen `clientRecordingId` a přítomnost obou stop, takže to **projde** a položka fronty z manifestu bere jen `clientRecordingId` (`queue.js:133`) — je to tedy bezpečné. **Ale nikdy ten manifest do položky neukládej celý**, uložil bys nuly a `null` hashe. Kdyby to někdo v B11 udělal, tiše by to lhalo.

`enqueueRecording` (`queue.js:120-151` ✅) vyžaduje přesně:

```js
{
  manifest,                       // clientRecordingId + tracks.microphone i tracks.system
  manifestPath: "<absolutní cesta>",
  trackPaths: { microphone: "<absolutní cesta>", system: "<absolutní cesta>" }
}
```

`normalizeTrackPaths` (`queue.js:41-51` ✅) vyhodí, když klíče nejsou **přesně** `microphone` + `system`. `RECORDING_TRACKS` (`main.cjs:30-33`) obsahuje přesně tyhle dva ✅.

**B) Dokončený časový záznam — z `electron/tracking.cjs` (story B5):**

🔴 **Zpřísněno oproti návrhu.** Nejen že soubor dnes neexistuje — **neexistoval nikdy v žádné větvi**: `git log --all --oneline -- electron/tracking.cjs` vrací **prázdno** ✅ změřeno. Větve v repu jsou `main`, `feat/kostra-appky`, `feat/zvuk-dukaz`, `fix/tray-prazdna-ikona`, `orca/desktop-b1`, `orca/desktop-b4` — žádná B5.
⇒ **B7 se dnes NESMÍ začít.** Není to varování, je to blokující podmínka (§11).

Až B5 bude v `main`: **přečti si její skutečný kód a přizpůsob se mu — nehádej.** Očekávaný tvar podle `plan.md` §1 a R6/R9/R10:

```js
{ trackingId, projectId /* GUID */, startedAt /* ISO UTC */, endedAt /* ISO UTC */ }
```

Když B5 vrací jinou strukturu, **použij jeho** a rozdíl napiš do PR.

**C) Vypínače:** `process.env.DESKTOP_UPLOAD_ENABLED` a `process.env.DESKTOP_TIME_ENABLED`, čtené v `main.cjs`, předávané do `processNext` jako **syrové řetězce**. Zapnuto = přesná hodnota `"true"`. Cokoli jiného, včetně booleanu `true` a `undefined`, znamená vypnuto.

### 10.2 Co B7 vystavuje (výstup)

**Fronta na disku:** `path.join(app.getPath("userData"), "queue", "outgoing.json")`.
Pod `LUDONE_DATA_DIR` to `configureWritablePaths()` (**`main.cjs:170-191`** ✅) přesměruje: `userData: path.join(dataRoot, "user-data")` (`main.cjs:176` ✅) ⇒ `<LUDONE_DATA_DIR>/user-data/queue/outgoing.json`. 🟡 **Odvozeno z kódu, ne z běhu** — §16 to má ověřit naostro.

**Položka fronty po B7** (dnešní tvar `queue.js:131-145` ✅ + jedno nové pole):

```js
{
  kind: "recording" | "time",     // 🔴 NOVÉ; chybějící hodnota se čte jako "recording"
  clientRecordingId,              // idempotenční klíč: clientRecordingId | trackingId
  attempts, enqueuedAt, lastFailureReason, nextAttemptAt, sentAt, state,
  manifestPath, tracks,           // jen kind === "recording"
  entry,                          // jen kind === "time": { projectId, startedAt, endedAt }
  server: { recordingId, uploadedBytes: { microphone, system } }
}
```

**API `src/lib/queue.js` po B7:**

```js
export const QUEUE_ITEM_KINDS = Object.freeze({ RECORDING: "recording", TIME: "time" });
export const FAILURE_CLASSES  = Object.freeze({ PERMANENT: "permanent", PAUSED: "paused", RETRYABLE: "retryable" });

export function enqueueRecording(queue, recording, now)   // beze změny chování, doplní kind: "recording"
export function enqueueTimeEntry(queue, entry, now)       // NOVÁ; klíč trackingId, doplní kind: "time"
export function killswitchNameForKind(kind)               // NOVÁ
export function reduceQueueForRenderer(queue)             // NOVÁ (T8)
export async function processNext(queue, killswitches, send, options)
```

- `killswitches` je **objekt syrových řetězců**: `{ DESKTOP_UPLOAD_ENABLED, DESKTOP_TIME_ENABLED }`. Fail-closed platí **per klíč**.
- `processNext` vybírá první položku ve stavu `ceka`, která je připravená časem **A jejíž typ má zapnutý vypínač**.
- **Návratové `outcome`:** `disabled` (+ `reason: UPLOAD_DISABLED_REASON`, `queue.js:10` ✅) tam, kde brání vypínač; `idle` tam, kde je fronta prázdná nebo všechno čeká na čas. Když ve frontě je položka blokovaná vypínačem **a zároveň** položka čekající na čas, **vrať `disabled`** — vypínač je silnější důvod a existující test to tak čte.
  ⚠️ Tenhle bod je jmenovitě přidělený B7: `spec.md` §11, tabulka „Co revize našla" — *„`processNext` vrací i `disabled` (`:203`) a `idle` (`:213`) — pravidlo je na ně slepé | packet **B7**"* ✅. Návrh to řešil, ale necitoval; teď je to doložené zadání.
- 🔴 **Změna podpisu `processNext` je API změna, kterou zmrazený plán neuvádí.** Tenhle packet ji fixuje a je součástí zadání. **Odchylka = otázka koordinátorovi, ne vlastní rozhodnutí.**
- ⚠️ **Kontrola arity musí přežít.** `queue.js:197-199` má `if (arguments.length < 3) throw new TypeError("queue, uploadEnabled a send jsou povinné argumenty")` a existující test `tests/queue.test.js:194-196` na ni asertuje `rejects.toThrow(/povinné argumenty/)`. **Řetězec „povinné argumenty" musí ve zprávě zůstat.**

**Klasifikace selhání** — `send` smí vyhodit chybu s polem `failureClass`:

| `failureClass` | Chování | Zdroj pravidla |
|---|---|---|
| `"permanent"` | `state: "selhalo"`, `nextAttemptAt: null`, uložit `lastFailureReason`, **žádný další pokus** | R16, `KONTRAKT.md` §5 (**403**) |
| `"paused"` | `state` zůstává `"ceka"`, **`attempts` se NEZVÝŠÍ**, `nextAttemptAt` beze změny, uložit důvod | R17, M27 |
| `"retryable"` nebo chybí | dnešní chování: `attempts+1`, backoff, po `maxAttempts` → `selhalo` | `queue.js:238-253` |

Neznámá hodnota = `"retryable"`.

⚠️ **Pozor na pořadí u `paused`.** Dnešní kód zvyšuje `attempts` **před** voláním `send` (`queue.js:216-220`), takže „nezvýšit pokus" znamená v `catch` větvi **vrátit se k původní hodnotě `queue.items[index].attempts`**, ne jen „neinkrementovat".

**Odesílací vrstva v této verzi neexistuje** (S1). `main.cjs` předává `send`, které při zavolání vyhodí chybu s `failureClass: "paused"` a českou zprávou. Při fail-closed vypínačích se **nikdy nezavolá**.

**IPC kanály (přesně dva):**

| Kanál | Typ | Povolení | Vrací / dělá |
|---|---|---|---|
| `queue:list` | `handleValidated` | `["panel", "settings"]` | Redukovaný pohled: `{ id, kind, state, attempts, nextAttemptAt, lastFailureReason }`. 🔴 **Žádné absolutní cesty, manifesty, tokeny.** |
| `queue:retry` | `handleValidated` | `["panel"]` | Vynuluje `nextAttemptAt` u položek ve stavu `ceka`, uloží, probudí pumpu. **Nikdy nevolá `send()` samo.** |

Použij `handleValidated` / `onValidated` (**`main.cjs:151-168`** ✅) — mají v sobě `requireTrustedSender`. Povolené druhy odesílatele jsou přesně `"panel"` a `"settings"` (`trustedSenderKind`, `main.cjs:109-113` ✅). **Nepiš `ipcMain.handle` napřímo** — vynucuje to test, viz §12.4.

**`electron/preload.cjs`** (dnes 22 řádků ✅) — přidat právě dva klíče:

```js
listQueue: () => ipcRenderer.invoke("queue:list"),
retryQueue: () => ipcRenderer.invoke("queue:retry"),
```

**Zámek nad souborem fronty:** serializační řetěz promisů, stejný vzor jako `track.queue` (**`main.cjs:560, 575-577`** ✅). Ne boolean, ne časovač.

**Probouzení pumpy v B7:** jen dvě místa — jeden průchod po `app.whenReady()` a `queue:retry`. **Žádný `powerMonitor`, `net.isOnline()`, žádné timery.**

---

## 11. Dependencies

| Závislost | Stav | Co z toho plyne |
|---|---|---|
| **B5 — Časovač do hlavního procesu** | 🔴 **BLOKUJÍCÍ. `electron/tracking.cjs` neexistuje v ŽÁDNÉ větvi** ✅ změřeno (`git log --all -- electron/tracking.cjs` prázdné) | **B7 se nezačíná.** Bez B5 nemá `enqueueTimeEntry` odkud brát `trackingId` ani `projectId`. Větev zakládej nad commitem, kde je B5 v `main`. |
| **B3 — autorita tray stavu** | nepřímo přes B5 | B7 se tray nedotýká. |
| **B11 — retence 7 dní** | `plan.md` §2: „B11 Závisí: B7" | B11 čeká na tebe. Janitor nepiš. |
| **`DSK-F010` / server** | S1 | Nezapojuj. |
| **B12** ⛔ | `plan.md` §4, §2 ř. 95 | **Nepouštět vůbec.** Skutečná stopka, Danova migrace. |

**Vlna:** `BEH-NOC.md:44` řadí B7 do vlny 3 spolu s **B6 a B8** ✅.

🔴 **OTEVŘENÁ OTÁZKA — souběh s B6 NENÍ prokázaný a návrh to tvrdil.**
Návrh psal *„B6 sahá do jiných bloků `main.cjs` (viz §12) — souběh je proto v pořádku."* Změřeno:
- `plan.md` §2 tabulka vlastnictví bloků (ř. 116-124) **nemá řádek B6 vůbec** ✅.
- `plan.md` §2b (ř. 147) dává B6 soubory `src/lib/adapters/`, `TrackingCard.jsx` — **žádný `main.cjs`, žádný `preload.cjs`** ✅.
- `podklady-vytezene.md:185-186` naopak vede `electron/main.cjs` i `electron/preload.cjs` jako sdílené mimo jiné **s B6** ✅.
⇒ Tři zdroje si odporují a §12 tohohle packetu žádný B6 řádek nemá (odkaz „viz §12" byl slepý). **Nehádej.** Před startem si u koordinátora vyžádej potvrzení, že B6 nesahá do `main.cjs`/`preload.cjs`, a **zapiš díru do `DAN-TODO.md`**. Do té doby: **jeden strom = jeden zapisovatel** (`AGENTS.md:19-20` ✅), B7 a B6 nikdy do stejného worktree.

---

## 12. Přesné soubory

### 12.1 🔴 Vlastnictví bloků

> `plan.md` ř. 126-127: *„Task packet musí vlastnictví zadat VÝČTEM, ne větou ‚nesahej na cizí'. Próza prohraje s prvním ‚tady to logicky patří taky'."* ✅ doslovně.

| Story | Vlastní v `main.cjs` | Vlastní v `preload.cjs` |
|---|---|---|
| **B3** | `trayIconName`, `updateTray`, `deriveTrayState`, registrace tray | odebrat `setTrayState` |
| **B4** | `shouldHidePanelOnBlur` a jeho čítače | nic |
| **B5** | registrace `tracking:*` kanálů, hook na pád rendereru | přidat `tracking:*` |
| **B7** | **zapojení fronty, `queue:*` kanály** | **přidat `queue:*`** |
| **B8** | `auth:begin` a jeho okolí | `beginAuth` |
| **B9** | `auth:logout` | přidat `logout` |
| **B11** | nic | nic |

**Filtr pro dnešní `main.cjs`** (✅ všechny rozsahy přeměřené; ⚠️ opravené proti návrhu):

| Řádky | Blok | Smíš? |
|---|---|---|
| 202-230, 248-266 | `traySvg`, `trayIconName`, `trayImage`, `updateTray` | ❌ **B3** |
| **237, 239-246** | `permissionPromptsInFlight` (ř. 237) + `shouldHidePanelOnBlur` (ř. 241-246) | ❌ **B4** — ⚠️ návrh psal „241-246" a čítač na ř. 237 vynechal; a jeho rozsah B3 „202-266" tenhle blok **pohlcoval**. Rozsahy výš jsou už disjunktní. |
| 282-345 | `createPanelWindow` (uvnitř ř. 314/317/321 hook na pád) | ❌ **B5** |
| 462-535 | `createRecordingSession` | ❌ cizí |
| 537-545 | `ownedRecordingSession` | ❌ cizí — **jen volat**, neměnit |
| 581-647 | `finalizeRecordingSession` | ❌ cizí — **jen volat**, neměnit |
| 649-660 | `finalizeRecordingSessionsForOwner` | ❌ **B5** („hook na pád rendereru") |
| 662-671 | `tray:*`, `test:click-tray`, `panel:hide`, `settings:*` | ❌ cizí |
| 681-692 | `auth:begin` (atrapa) | ❌ **B8** |
| 694-707 | `permission:request` | ❌ cizí (hlídá `E6.sh`) |
| **709-714** | `test:quit` | ❌ cizí — ⚠️ **v návrhu chyběl**, přestože tvrdil „ověřeno proti celé tabulce" |
| 23-25, 27-41 | modulové konstanty a lazy import `manifest.js` | ✅ **smíš přidat** `queueModulePromise`, `queueStore`, cestu k souboru fronty, serializační řetěz |
| 676-679 | `handleValidated("recording:finish", …)` | ✅ **jen tenhle** — je to „zapojení fronty"; žádná jiná story ho v `plan.md` §2 nemá |
| za 679 | nové `handleValidated("queue:list" …)` a `("queue:retry" …)` | ✅ **B7** |
| 724-740 | `app.whenReady()` | ✅ **jen přidat jeden řádek** — první průchod pumpy. Na `tray` a `createPanelWindow()` nesahej (B3). |

🔴 **Nesahej na `finalizeRecordingSession` ani `createRecordingSession`.** Zařazuj v handleru `recording:finish`.
🔴 **Nezměň návratový tvar `recording:finish`.** Renderer čte `result.files.{microphone,system}.{name,size}` (**`RecordingCard.jsx:240-243`** ✅ ověřeno, funkce `savedMessage`) a `RecordingCard.jsx` **není v rozsahu B7**. Selhání zařazení se **loguje a nevyhazuje** — podle R2 jsou soubory bezpečně na disku.

### 12.2 Soubory podle `plan.md` §2b (ř. 148)

| Story | Název PR | Soubory | Test napřed | ~diff | Dělitelné? |
|---|---|---|---|---|---|
| **B7** | `Wire the outbound queue for both item kinds` | `electron/queue.cjs`, `main.cjs`, `preload.cjs` | Trvalá chyba se **neopakuje pětkrát**; rozlišovač typu | 180 | ne |

### 12.3 Skutečný pracovní seznam

| Soubor | Co s ním | Zdroj oprávnění |
|---|---|---|
| `src/lib/queue.js` | ✅ **hlavní práce** | ⚠️ **Ve `plan.md` §2b chybí.** ✅ Ověřeno revizí: `podklady-vytezene.md:173` ho pro B7 uvádí a v tabulce sdílených souborů (ř. 185-194) **není** — vlastní ho tedy jen B7, kolize nehrozí. **Díru zapiš do `DAN-TODO.md`.** |
| `electron/queue.cjs` | ✅ pumpa a serializační zámek nad `loadQueue`/`saveQueueAtomically` | `plan.md` §2b |
| `electron/main.cjs` | ✅ **jen bloky z 12.1** | `plan.md` §2 + §2b |
| `electron/preload.cjs` | ✅ přidat právě `listQueue` a `retryQueue` | `plan.md` §2 + §2b |
| `tests/queue.test.js` | ✅ rozšířit — 🔴 **nesmazat ani nepřejmenovat** existující (12.4) | sloupec „Test napřed" |
| `tests/queue-wiring.test.js` | ✅ **nový** (jméno fixuje tenhle packet) | `podklady-vytezene.md:173`: *„Jméno integračního testu zapojení není určeno."* ✅ |
| `tests/ipc-sender-guard.test.js` | 🔴 ✅ **MUSÍŠ upravit — jinak je celý build červený.** Viz 12.4 bod 4. | vynucená změna, ne volba |
| `.env.example` | ✅ **přidat jediný řádek** `DESKTOP_TIME_ENABLED=false` | R18. Nad rámec §2b — uveď v PR. ✅ Ověřeno, že `grep -Fxq "DESKTOP_UPLOAD_ENABLED=false"` (`E5.sh:66`) tím nerozbiješ. |
| **`src/App.jsx`, `src/features/**`, `src/components/**`, `src/styles.css`** | ❌ **nesahat** | `plan.md` §2b |
| **`design/**`** | ❌ **nesahat** | `plan.md` §4, `AGENTS.md:66` |
| **`scripts/akceptace/*.sh`**, **`scripts/package-mac.mjs`** | ❌ neupravovat | `AGENTS.md:40` *„Na měřidlo se nesahá."* |

### 12.4 Čtyři měřidla, která tě chytnou — návrh znal tři

**1. `scripts/akceptace/E5.sh:13-19` grepuje `tests/queue.test.js` na přesné řetězce** ✅ ověřeno. Smazat/přepsat je = brána zčervená a bude to vypadat jako regrese:

1. `s nenastaveným DESKTOP_UPLOAD_ENABLED záměrně nic neodešle`
2. `delete process.env.DESKTOP_UPLOAD_ENABLED`
3. `expect(send).toHaveBeenCalledTimes(0)`

**2. `E5.sh:21-58` hledá literál `DESKTOP_UPLOAD_ENABLED=true`** ✅ ověřeno — cíle jsou přesně `(.env .env.example .env.local src electron scripts .github package.json)` (`E5.sh:36`).
⚠️ **Oprava proti návrhu:** `tests/` **v seznamu NENÍ**. Trik `["tr","ue"].join("")` (`queue.test.js:95, 128, 148`) je tedy v testech **konvence, ne vynucení**. Drž ji stejně — ale nespoléhej, že tě brána chytí. **V `src`, `electron`, `scripts`, `.github`, `package.json` a `.env*` ten literál nesmí být ani v komentáři, a tam tě brána chytí.**
⚠️ **A hlavně: E5 nehledá `DESKTOP_TIME_ENABLED=true` vůbec.** Nový vypínač zapnutý v repu projde **všemi branami**. Do `DAN-TODO.md`.

**3. `E5.sh:62` pouští `npm run test:unit -- queue`** ✅. Změřeno, že vitest filtruje **podsubstringem cesty** (`npx vitest run authority` → spustí `tests/tray-authority.test.js`). ⇒ **`tests/queue-wiring.test.js` se do tohohle filtru chytí sám** a E5 ho tím vynucuje. **Využij to** — je to jediný způsob, jak zapojení uhlídat bez sahání na bránu.

**4. 🔴 `tests/ipc-sender-guard.test.js:186-210` drží UZAVŘENÝ SEZNAM IPC KANÁLŮ. Návrh o něm nevěděl a B7 ho zaručeně rozbije.**
Změřeno — test regexem projde `electron/main.cjs`, vytáhne každou registraci `ipcMain.on|handle` i `on|handleValidated` a asertuje `toEqual` proti přesně dvanácti kanálům:

```
auth:begin · panel:hide · permission:request · recording:append · recording:begin ·
recording:finish · settings:close · settings:open · test:click-tray · test:quit ·
tray:get-state · tray:set-state
```

Přidání `queue:list` a `queue:retry` tenhle test **shodí**, a s ním:
`npm run test:unit` · `npm run gates` · **CI** (`.github/workflows/ci.yml:20`) · **`scripts/akceptace/E3.sh:73`** („unit test kontroly odesílatele IPC je zelený").

🔴 **Jak to opravit správně:** do seznamu **PŘIDEJ `"queue:list"` a `"queue:retry"`, nic neubírej.** To není změkčení měřidla — allowlist se rozšiřuje o kanály, které story legitimně zavádí, a test dál hlídá, že nevznikl žádný **další**. **Zakázané je** seznam smazat, nahradit ho `expect.arrayContaining`, nebo test přeskočit. Rozšíření **jmenovitě popiš v PR** (`AGENTS.md:42`).
Řádky 205-207 téhož testu (`žádné ipcMain.` napřímo + `handleValidated`/`onValidated` obsahují `requireTrustedSender`) **nech beze změny** — vynucují §10.2.

**5. `scripts/akceptace/E3.sh:24-64` (`balene_src_moduly_existuji`)** ✅ NOVÉ. Parsuje všechny `electron/**/*.cjs` na vzor `path.join(… "src" …)` a vyžaduje, aby každý odvozený soubor byl **i v zabaleném bundlu**. B7 do té množiny přidá `src/lib/queue.js`.
⇒ **Cestu k frontě piš stejným tvarem jako `main.cjs:24`**, tedy `path.join(PROJECT_ROOT, "src", "lib", "queue.js")` s literály. Kdybys použil proměnnou nebo template string, brána tě neuvidí (**fail-open**) a `npm run package:mac` by mohl vyrobit bundle bez fronty.
✅ Ověřeno, že `scripts/package-mac.mjs:26-27` kopíruje celé `src/lib`, takže po správném zápisu brána projde.

**6. `scripts/akceptace/E2-sabotaze.sh:68, 82, 85`** ✅ NOVÉ. Skript vyžaduje **čistý `electron/main.cjs`** (`over_cisty_cil electron/main.cjs || exit 1`) a obnovuje ho `git checkout HEAD -- electron/main.cjs`. ⇒ **Nikdy ho nepouštěj nad necommitnutou prací** — smaže ti změny v `main.cjs`.

**7. `jsconfig.json`** ✅ NOVÉ. `include: ["src/lib/**/*.js", "tests/**/*.js"]`, `exclude: ["electron/**", …]`, `checkJs: true`. ⇒ **`src/lib/queue.js` a OBA testy typecheckem procházejí**, `electron/main.cjs` a `electron/queue.cjs` ne. Nové exporty a testy musí projít `npm run typecheck`.

---

## 13. TDD kroky

Postup: `plan.md` §3 bod 1 + masterplán §13 — **cílený test napřed, viděný červený ze správného důvodu, doslovný výpis do PR.** Spouštěj `npx vitest run tests/queue.test.js tests/queue-wiring.test.js` a **měř stav před rourou** (`AGENTS.md:45`; na macOS nepoužívej `timeout`).

🔴 **Všechny „červené" výpisy níž jsou PŘEDPOVĚDI tvaru chyby, ne zachycený výstup** (revize neměla psát kód). **Do PR patří skutečný výpis, ne tenhle.** Když se tvar liší, řídí se PR skutečností.

✅ **Změřená výchozí čára (1. 9. 2026, čistý `main`)** — proti ní poměřuj:
```
npm run lint       → EXIT=0
npm run typecheck  → EXIT=0
npm run test:unit  → EXIT=0   Test Files 9 passed (9) · Tests 77 passed (77)
npm run test:unit -- queue → tests/queue.test.js (11 tests) ✓
bash scripts/akceptace/E5.sh → 6× PASS, "chyb: 0", EXIT=0
```

⚠️ **Dvoufázová červená u nových exportů.** Test importující neexistující export spadne už při načítání modulu. **(1)** červená z načtení, **(2)** přidej stub házející `new Error("neimplementováno")`, **(3)** červená na assertu — teprve ta je správná. Do PR patří obě.

### T1 — `enqueueRecording` označí položku jako nahrávku
`tests/queue.test.js`, do `describe("stavový automat fronty")`.
```js
it("zařazená nahrávka nese rozlišovač typu", () => {
  const { item } = enqueueRecording(createQueue(), recording(), 1_777_000_000_000);
  expect(item.kind).toBe("recording");
});
```
**Předpokládaná červená:** `AssertionError: expected undefined to be 'recording'`.

### T2 — časový záznam se zařadí s vlastním typem a klíčem
```js
it("zařazený časový záznam nese typ time a klíč trackingId", () => {
  const { item } = enqueueTimeEntry(createQueue(), {
    trackingId: "7c1f…", projectId: "b3d0…",
    startedAt: "2026-09-01T08:00:00.000Z", endedAt: "2026-09-01T09:00:00.000Z",
  }, 1_777_000_000_000);
  expect(item).toMatchObject({ kind: "time", clientRecordingId: "7c1f…", state: QUEUE_STATES.WAITING });
});
```
**Fáze 1:** `SyntaxError: … does not provide an export named 'enqueueTimeEntry'`. **Fáze 2:** `Error: neimplementováno`.

### T3 — 🔴 money: časová položka odmítne sazbu (R8)
```js
it("časový záznam se sazbou se odmítne", () => {
  expect(() => enqueueTimeEntry(createQueue(), { …platný…, hourlyRate: 850 }, now))
    .toThrow(/sazb/i);
});
it("do položky se nedostane žádné pole se sazbou", () => {
  const { item } = enqueueTimeEntry(createQueue(), platnyZaznam, now);
  expect(Object.keys(item.entry)).toEqual(["projectId", "startedAt", "endedAt"]);
});
```
⚠️ **Zpřísněno oproti návrhu.** Samotné `/sazb/i` jde splnit hláškou a nedokazuje, že se sazba nepropašuje jinak pojmenovaným polem. Druhý případ zamyká **tvar položky** — to je ta money-relevantní vlastnost.

### T4 — 🔴 dva nezávislé vypínače (R18), oba fail-closed
`describe("killswitch odchozí fronty")`; hodnotu `"true"` skládej jako `["tr","ue"].join("")`.
1. `DESKTOP_TIME_ENABLED` zapnutý, `DESKTOP_UPLOAD_ENABLED` nenastavený, fronta má **časovou** položku ⇒ `send` **1×**.
2. Totéž, položka je **nahrávka** ⇒ `send` **0×**, `outcome === "disabled"`.
3. Oba nenastavené ⇒ `send` **0×**, `outcome === "disabled"`.
4. 🔴 **NOVÝ — návrh ho neměl.** `DESKTOP_TIME_ENABLED` = boolean `true` (ne řetězec), položka časová ⇒ `send` **0×**.
   *Proč: R18 říká „oba fail-closed … a **musí mít vlastní test**". Pro `DESKTOP_UPLOAD_ENABLED` to plní existující „jiná pravdivostní hodnota odesílání nezapne" (`queue.test.js:110-114`). Pro `DESKTOP_TIME_ENABLED` neplnil nikdo — R18 by byl splněný jen z poloviny.*

**Předpokládaná červená u případu 1:** `AssertionError: expected "spy" to be called 1 times, but got 0 times`.

### T5 — 🔴 test, který `plan.md` §2b jmenuje: trvalá chyba se neopakuje pětkrát
```js
it("trvalá chyba skončí hned a neopakuje se pětkrát", async () => {
  const send = vi.fn(async () => { throw Object.assign(new Error("403 company_out_of_scope"), { failureClass: "permanent" }); });
  let queue = oneItemQueue();
  for (let pass = 0; pass < 5; pass += 1) {
    const result = await processNext(queue, { DESKTOP_UPLOAD_ENABLED: ["tr","ue"].join("") }, send, { now: 1_777_000_001_000 });
    queue = result.queue;
  }
  expect(send).toHaveBeenCalledTimes(1);
  expect(queue.items[0]).toMatchObject({
    attempts: 1, state: QUEUE_STATES.FAILED, nextAttemptAt: null,
    lastFailureReason: "403 company_out_of_scope",
  });
});
```
**Předpokládaná červená:** `expected "spy" to be called 1 times, but got 5 times` + `expected 'ceka' to be 'selhalo'`.

### T6 — pauza nespotřebuje pokus (R17)
`send` vyhodí chybu s `failureClass: "paused"` a zprávou `invalid_grant`.
Očekávej `attempts === 0`, `state === "ceka"`, `nextAttemptAt === null`, `lastFailureReason` nese důvod.
**Předpokládaná červená:** `AssertionError: expected 1 to be +0`.

### T7 — 🔴 ZAPOJENÍ — přepsáno, návrhová verze byla obejitelná

⚠️ **Proč se návrh zahazuje.** Navrhoval: *„vytáhni z `main.cjs` funkci, která `send` vyrábí, a ověř, že s prázdným prostředím `processNext` skončí `disabled` a `send` se nezavolá."* To je **totožné tvrzení jako T4 případ 3** a plyne výhradně ze `src/lib/queue.js`. **Továrna na `send`, kterou `main.cjs` nikdy nezavolá, takový test projde** — tedy přesně dnešní vada `DSK-F009` (footnote ⁵) by prošla znovu, se zelenými testy. To je ta „lhoucí brána", kvůli které tenhle packet existuje.

**Místo toho `tests/queue-wiring.test.js` musí tvrdit, že main frontu OPRAVDU volá.** Vzor převezmi z `tests/tray-authority.test.js:1-22` a `tests/ipc-sender-guard.test.js` — čtou `electron/main.cjs` přes `readFileSync` a asertují nad produkčním zdrojem:

```js
const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");

it("hlavní proces načítá modul fronty ze src/lib", () => {
  expect(mainSource).toContain('path.join(PROJECT_ROOT, "src", "lib", "queue.js")');
});

it("dokončení nahrávky zařazuje do fronty", () => {
  const finish = mainSource.slice(mainSource.indexOf('handleValidated("recording:finish"'));
  expect(finish.slice(0, 800)).toMatch(/enqueueRecording/);
});

it("po startu aplikace proběhne pumpa fronty", () => {
  expect(mainSource).toMatch(/processNext/);
});

it("preload vystavuje oba kanály fronty", () => { /* viz T9 */ });
```

🔴 **Buď poctivý o síle tohohle měřidla a napiš to do PR:** je to kontrola **zdrojového textu**, ne chování. Dokazuje, že volání v kódu **je** — nedokazuje, že za běhu **proběhne**. Runtime důkaz dodávají až kanárci K2/K3 v §16. Tenhle repozitář takové testy už používá (`tray-authority`, `ipc-sender-guard`), takže je to jeho zavedený vzor, ne improvizace.

🔴 **`functionSource` má past.** Helper hledá doslova `function <jméno>(` (`tray-authority.test.js:5`). ⇒ **Funkce, kterou budeš z `main.cjs` vytahovat, MUSÍ být deklarovaná jako `function jmeno(...)`**, ne `const jmeno = () => …` — jinak test hlásí `Error: Funkce <jméno> nebyla nalezena` navždy a nejde zezelenat.

**Předpokládaná červená (dnešní `main.cjs` frontu nezná):** `AssertionError: expected '…' to contain 'path.join(PROJECT_ROOT, "src", "lib", "queue.js")'`.

### T8 — redukovaný pohled pro renderer neprozradí cesty
```js
it("pohled pro renderer neobsahuje absolutní cesty ani manifest", () => {
  const view = reduceQueueForRenderer(queueSAbsolutnimiCestami);
  expect(JSON.stringify(view)).not.toContain("/Users/");
  expect(JSON.stringify(view)).not.toContain("manifestPath");
});
```
**Předpokládaná červená:** `Error: … does not provide an export named 'reduceQueueForRenderer'`, po stubu `expected '…/Users/dan/…' not to contain '/Users/'`.

### T9 — preload vystavuje oba kanály
Zdrojová kontrola nad `electron/preload.cjs` (22 řádků ✅) přes `readFileSync`: musí obsahovat `queue:list`, `queue:retry` a obojí přes `ipcRenderer.invoke`.
**Předpokládaná červená:** `expected '…contextBridge…' to contain 'queue:list'`.

### T10 — 🟢 co musí zůstat ZELENÉ (poměr 2–3 červené : 1 zelená, `plan.md` §3 bod 4)
Bez jediné úpravy asertací musí dál procházet (✅ všechny dnes zelené, změřeno):
- `„s nenastaveným DESKTOP_UPLOAD_ENABLED záměrně nic neodešle"` (`queue.test.js:65`, grepuje ho `E5.sh`)
- `„jiná pravdivostní hodnota odesílání nezapne"` (`:110`)
- `„vyžaduje killswitch v podpisu spolu s odesílací vrstvou"` (`:194`) — ⚠️ **návrh ho vynechal**; hlídá řetězec „povinné argumenty"
- `„opakování používá rostoucí exponenciální prodlevu s pevným stropem"` (`:165`)
- `„dvojí zařazení stejného clientRecordingId vytvoří jedinou položku"` (`:118`)
- `„uložená a po restartu načtená fronta je stejná"` (`:200`)
- `„offsety obou stop vždy převezme ze serveru místo lokálního odhadu"` (`:173`)

Přizpůsobit smíš **jen volání** (`processNext` má nový druhý argument), **nikdy asertaci**.

---

## 14. Sabotážní testy

Metodika `scripts/akceptace/E2-sabotaze.sh`: zmutuj **produkční** kód, ukaž doslovný červený výpis, obnov z HEAD. 🔴 **Sabotuje se až nad commitnutou prací** — `E2-sabotaze.sh:85` dělá `git checkout HEAD -- electron/main.cjs` a `:68` odmítne běžet nad špinavým `main.cjs` ✅.

| # | Co rozbít | Která brána musí zčervenat | Očekávaný výpis |
|---|---|---|---|
| **S1** | V `src/lib/queue.js` odstraň větev `failureClass === "permanent"` | T5 | `expected "spy" to be called 1 times, but got 5 times` |
| **S2** | V `processNext` změň `=== "true"` na pravdivostní test | existující „jiná pravdivostní hodnota odesílání nezapne" | `expected "spy" to be called 0 times, but got 1 times` |
| **S3** | Prohoď vypínače: časová položka ať se řídí `DESKTOP_UPLOAD_ENABLED` | T4 případ 1 | `expected "spy" to be called 1 times, but got 0 times` |
| **S4** | Ve větvi `paused` nech `attempts` inkrementovat | T6 | `expected 1 to be +0` |
| **S5** | V `reduceQueueForRenderer` vrať položku beze změny | T8 | `expected '…/Users/…' not to contain '/Users/'` |
| **S6** | Odstraň `kind` z `enqueueRecording` | T1 | `expected undefined to be 'recording'` |
| **S7** | Napiš do `electron/queue.cjs` komentář s literálem `DESKTOP_UPLOAD_ENABLED=true` | `bash scripts/akceptace/E5.sh` | `FAIL  nikde v repu není killswitch zapnutý` + vypsaný nález ✅ (`E5.sh:67`, `electron` je v cílech `:36`) |
| **S8** | 🔴 **NOVÁ, povinná — sabotáž zapojení.** V `main.cjs` smaž volání `enqueueRecording` z handleru `recording:finish` (zbytek nech) | T7 | `expected '…' to match /enqueueRecording/` |
| **S9** | 🔴 **NOVÁ.** Přidej do `main.cjs` třetí kanál, např. `handleValidated("queue:debug", …)` | `tests/ipc-sender-guard.test.js` | rozdíl v `toEqual` seznamu kanálů — důkaz, že allowlist po tvé úpravě pořád měří |

**S10 — ✅ NÁLEZ, ne sonda. Návrh to jen tušil; revize to změřila.**
Odstranění `await handle.sync()` z `saveQueueAtomically` **nechytne dnes žádný test**.
- ⚠️ **Oprava čísla řádku:** `await handle.sync()` je na **`electron/queue.cjs:48`**, ne `:47` (`:47` je `await handle.writeFile(...)`).
- **Změřeno** nad kopií souboru mimo repozitář (produkční soubor zůstal nedotčený): po odstranění řádku 48 je `saveQueueAtomically` → `loadQueue` **stále rovné** (`ROVNOST bez fsync: true`). Persistence test (`queue.test.js:200-211`) dělá jen save+load ve stejném procesu, takže na fsync nemůže být citlivý **z principu**.
⇒ **Je to potvrzená díra v měřidle, ne domněnka.** Přidej test, který volání `sync()` ověří (monkeypatch `fs.promises.open` a spočítej `sync` volání), **napiš nález do PR i do `DAN-TODO.md`**, a nikdy ho neschovávej. Sabotáž, kterou brána nechytí, je důkaz, že brána neměří.

---

## 15. Projektové brány

Všechny **měř před rourou**, do PR doslovný výpis včetně `EXIT`:

```bash
npm run lint;      echo "EXIT=$?"
npm run typecheck; echo "EXIT=$?"     # pokrývá src/lib/**.js a tests/**.js, NE electron/**
npm run test:unit; echo "EXIT=$?"     # 9 souborů / 77 testů na výchozí čáře
npm run build;     echo "EXIT=$?"     # CI ho pouští taky
bash scripts/akceptace/E5.sh; echo "EXIT=$?"   # fronta + killswitch
bash scripts/akceptace/E6.sh; echo "EXIT=$?"   # sahal jsi do main.cjs
bash scripts/akceptace/E3.sh; echo "EXIT=$?"   # 🔴 NOVĚ POVINNÁ — pouští ipc-sender-guard (:73)
                                                #    a kontroluje src/ moduly v bundlu (:89)
```

`npm run gates` = `lint && typecheck && test:unit` ✅. CI (`.github/workflows/ci.yml`) běží na `macos-latest`: `npm ci` → `npm run gates` → `npm run build`; oba smoke testy jsou vypnuté přes `if: ${{ false }}` ✅ (ř. 27, 30).

⚠️ `E3.sh` část s bundlem projde jen tehdy, když `release/LuDone Desktop.app` existuje; jinak hlásí *„release bundle existuje; spusť npm run package:mac"*. To je v pořádku — **ale kontrolu `unit test kontroly odesílatele IPC je zelený` (`:73`) pustí vždycky**, a to je ta, kterou B7 rozbíjí.

⛔ **`scripts/ui-smoke.mjs` v sandboxu nepouštěj** — `plan.md` §4, `AGENTS.md:35-36`.

🔴 **Zákaz změkčení měřidla** (masterplán §13 ✅ doslovně: *oprav vadu · neoslabuj assertion · nemaž test · nepřidávej baseline · nepoužívej force · nevypínej workflow · nepoužívej skip CI*). Po **třetím** neúspěšném opravném kole zastav a vrať přesný blocker s důkazy.
⚠️ Jediná povolená úprava cizího testu je **rozšíření allowlistu kanálů** v `ipc-sender-guard.test.js` (§12.4 bod 4) — a musí být v PR jmenovitě popsaná.

---

## 16. Live-verification scénář

Pro člověka u Macu (macOS 26.4, Electron 37.3.1). Pět stavů z `AGENTS.md:28-30`: ✅ ověřeno naostro · 🧪 zelené testy · ⛔ neověřeno · 🟡 podmíněně · ⚠️ rozpor.

```bash
cd ~/Dev/ClaudeCode/ludone-desktop
npm run gates; echo "EXIT=$?"
bash scripts/akceptace/E5.sh; echo "EXIT=$?"
bash scripts/akceptace/E3.sh; echo "EXIT=$?"
npm run package:mac; echo "EXIT=$?"

D=$(mktemp -d /tmp/ludone-b7.XXXXXX)
env LUDONE_DATA_DIR="$D" "release/LuDone Desktop.app/Contents/MacOS/Electron" \
  > "$D/application.log" 2>&1 &
```
*(Spouštěj z terminálu s přesměrovaným stdout. Aplikace z Finderu žádný stdout nemá a „nula nálezů" by vypadala jako zelená — přesně past, kterou `spec.md` §11 pojmenovává u brány `L11`.)*

1. Klikni na ikonu v liště, otevři panel. 2. Nahrávej ~10 s, **zastav tlačítkem** (ne zavřením okna — viz §5). 3. Ukonči aplikaci.

### 🔴 KANÁRCI — bez nich je výsledek ⛔ NEMĚŘENO, ne ✅

> `spec.md` §11 ✅ doslovně: *„Brána, která hledá v logu a nic nenajde, dnes hlásí zelenou. Napříště musí najít **aspoň jeden očekávaný záznam** (`[recording] Uloženo:`); když tam není, výsledek je **⛔ NEMĚŘENO**, ne ✅."*

| # | Příkaz | Podmínka | Když neprojde |
|---|---|---|---|
| **K1** | `grep -c "\[recording\] Uloženo:" "$D/application.log"` | ≥ 1 | ⛔ **NEMĚŘENO. Konec.** Nic dalšího v tomhle scénáři neznamená nic. |
| **K2** | `grep -c "\[queue\] Zařazeno" "$D/application.log"` | ≥ 1 | ⛔ zapojení fronty neproběhlo (nový produkční řádek, který B7 přidává) |
| **K3** | `grep -c "odesílání je vypnuté" "$D/application.log"` | ≥ 1 | ⛔ pumpa vůbec neproběhla. Kladné tvrzení: pumpa běžela **a odmítla odeslat**. Řetězec je `UPLOAD_DISABLED_REASON` (`queue.js:10` ✅) |

✅ **K1 je ověřený kanárek, ne domněnka — návrh to přiznal jako neověřené, revize to změřila.** Produkční řádek je `main.cjs:643` a v archivu `dukazy/nahravani-2026-08-21/` ho **oba** uložené logy skutečně obsahují, každý právě 1×. Doslovný tvar:
```
[recording] Uloženo: mikrofon 85517 B, systém 27993 B.
```

### Vlastní kontroly (až po zelených kanárcích)

4. `cat "$D/user-data/queue/outgoing.json"` ⇒ právě **jedna** položka, `"kind":"recording"`, `"state":"ceka"`, `"attempts":0`, `"schemaVersion":1`. Chybějící soubor ⇒ ⛔ NEMĚŘENO (ne ✅).
5. `grep -Ei "@|token|Bearer" "$D/application.log"` ⇒ jen řádky, které tam byly už před B7. Identifikátory jen jako GUID.
6. **Restart nad týmž `LUDONE_DATA_DIR`:** spusť znovu, chvíli nech běžet, ukonči. `outgoing.json` má **pořád jednu položku** a `attempts` pořád `0`.
7. Úklid: `rm -rf "$D"`.

**Co tenhle scénář NEDOKÁŽE** (napiš to takhle do PR): nedokazuje odeslání, příjem na serveru ani `verified-live` u `DSK-F009`. Server neexistuje (S1). **Nejvyšší poctivý stav po B7 je 🧪 `tests-green`**, plus ✅ u toho, co kanárci opravdu naměřili.

---

## 17. Rollback

- **Jedna story = jeden PR = jeden revert.** `plan.md` §1 ✅: *„Každá story je samostatně revertovatelná. Žádná migrace v v1."*
- 🔴 **`QUEUE_SCHEMA_VERSION` se NESMÍ zvýšit.** Konstanta je zdvojená — **`electron/queue.cjs:5`** a **`src/lib/queue.js:1`** ✅ — a obě validace ji porovnávají tvrdě (`queue.cjs:11-22`, `queue.js:33-39` ✅); `loadQueue` polyká **jen `ENOENT`** (`queue.cjs:30` ✅). Zvýšení by po revertu **shodilo načtení fronty** a neodeslané nahrávky by zmizely z dohledu.
- **`kind` proto přidávej jako volitelné pole s výchozí hodnotou `"recording"`.** ✅ Ověřeno, že obě dnešní validace neznámá pole tolerují (kontrolují jen `schemaVersion` a `Array.isArray(items)`), takže soubor psaný B7 se po revertu načte a soubor psaný před B7 se načte po nasazení B7.
- Po revertu zůstanou na disku položky `kind: "time"`. Starý kód je bude považovat za nahrávky — **při vypnutých vypínačích se s nimi nic nestane**. Napiš tu větu do PR.
- Revert vrátí i allowlist v `ipc-sender-guard.test.js` na dvanáct kanálů, což je konzistentní s revertovaným `main.cjs` — **nic ručního po revertu**.
- `electron/preload.cjs`: přidání dvou klíčů nemá vedlejší efekty.
- Žádné migrace, žádné zápisy do Tabidoo, žádný flip cizího vypínače.

---

## 18. Definition of Done

**Doslova z `plan.md` §3 (ř. 180-186) ✅:**

1. Cílený test **napřed** a viděný **červený** ze správného důvodu.
2. `npm run lint`, `typecheck`, `test:unit` — všechny EXIT=0, **měřeno před rourou**.
3. Sabotáž, která prokazatelně chytá odstranění guardu, s **doslovným výpisem**.
4. Nejméně jeden případ, který musí zůstat **zelený** (poměr 2–3 červené : 1 zelená).
5. Diff přečtený Claudem, u money a RBAC povinně.
6. PR odkazuje na Feature ID a tenhle plán.
7. **Bez produkce a bez merge** před Danovým finálním schválením.

**Specifické pro B7:**

8. **B5 je v `main`** a `electron/tracking.cjs` existuje. Bez toho se story neuzavírá ani nezačíná.
9. `scripts/akceptace/E5.sh` EXIT=0, všech šest podmínek PASS; tři literály z §12.4 v `tests/queue.test.js` beze změny.
10. `scripts/akceptace/E6.sh` zelená (sahal jsi do `main.cjs`).
11. 🔴 **`scripts/akceptace/E3.sh` zelená** — jmenovitě podmínka „unit test kontroly odesílatele IPC je zelený".
12. **`QUEUE_SCHEMA_VERSION` je pořád `1`** na obou místech.
13. **Nikde v `src`, `electron`, `scripts`, `.github`, `package.json`, `.env*` literál `DESKTOP_UPLOAD_ENABLED=true`** — ani v komentáři.
14. Diff **nesahá** na jediný soubor v `src/` mimo `src/lib/queue.js`, na `design/**` ani na `scripts/**`.
15. Diff se drží výčtu bloků z §12.1 — v `main.cjs` žádná změna mimo ně.
16. **Allowlist v `ipc-sender-guard.test.js` je jen ROZŠÍŘENÝ o `queue:list` a `queue:retry`**, nic neubráno, `toEqual` zachováno, a je to v PR popsané.
17. **T7 (zapojení) je zelený a S8 ho prokazatelně shodí.** Bez toho není B7 hotová — je to celý smysl story.
18. Odhad ~180 řádků bez testů dodržen, nebo je překročení v PR zdůvodněné.
19. **Čtyři osy:** `DSK-F009` `delivery` `coded → pr-open`, `exposure` zůstává `disabled`, `verification` zůstává `tests-green`. `DSK-F010` beze změny.
20. PR obsahuje **doslovný výpis červeného testu před opravou**, **co jsem rozbil při sabotáži a čím to dokládám**, a **posun na čtyřech osách**.
21. 🔴 **PR nesmí tvrdit `verified-live`.** `plan.md` §2b ✅: *„zelené testy jsou `tests-green`, nic víc."*
22. Do `DAN-TODO.md` zapsané a v PR jmenovitě uvedené:
    (a) `src/lib/queue.js` chybí ve výčtu souborů `plan.md` §2b ·
    (b) rozpor „6 pokusů" (`Fronta.dc.html:127`) vs. `maxAttempts = 5` ·
    (c) R22 (plný GUID do jména souboru) nevlastní žádná story ·
    (d) obnova položky uvízlé ve stavu `odesila` po pádu není v B7 ·
    (e) nález **S10** — `E5` neměří `fsync` v `saveQueueAtomically` ·
    (f) `E5.sh` neměří `DESKTOP_TIME_ENABLED` vůbec — zapnutý vypínač projde všemi branami ·
    (g) 🔴 **`ipc-sender-guard.test.js` drží uzavřený allowlist kanálů, který každá story s novým IPC musí ručně rozšířit** — plán to nikde neříká, další stories (B5, B8, B9) na to narazí taky ·
    (h) 🔴 **kolize vlastnictví B6** — `plan.md` §2 nemá pro B6 řádek, §2b mu nedává `main.cjs`, `podklady-vytezene.md` ano; souběh ve vlně 3 není doložený ·
    (i) nahrávky uzavřené po pádu/navigaci se do fronty nezařadí (§5) ·
    (j) značka `⛔` má v `plan.md` dva významy (stopka B12 vs. „svázáno rozhodnutím" u B7/B6/B9).

### 🔴 Co implementátor NESMÍ (masterplán §9 ✅ doslovně)

- **rozšířit scope · změnit schválený design · vytvořit nový design-system pattern bez tasku a schválení · změnit API/datový kontrakt bez aktualizace plánu · oslabit test · obejít bránu · rozhodnout nové money nebo RBAC pravidlo.**

> *„Pokud task packet nestačí, vrátí konkrétní otázku koordinátorovi. **Nehádá.**"*

A z `plan.md` §4 ✅: zapojovat frontu k serveru, který neexistuje · sahat na `design/**` · flipovat cizí vypínače · psát do Tabidoo · pushovat do `main` · vyrábět výjimku z brány · pouštět `ui-smoke` v sandboxu · **pouštět migraci B12**.

Provozní pravidlo (`BEH-NOC.md:67` ✅): 🔴 **ve worktree needituj git — jen SOUBORY.** `git add`, `fetch`, `merge`, `checkout` spadnou na `Operation not permitted`. **Commituje orchestrátor.**

---

## 19. Implementátor

**Codex** (`gpt-5.6-sol`), viditelně jako panel v Orce (`plan.md` §2, `BEH-NOC.md`).
Jeden strom = jeden zapisovatel (`AGENTS.md:19-20`). Větev `feat/fronta-zapojeni` **nad zmergovanou B5** — dnes neexistuje, viz §11.

## 20. Reviewer

**Claude** — konsolidace je vždy na hlavní session (`BEH-NOC.md`: *„diff, brány, commit, PR čte a dělá Claude, i u Codexovy práce"*).
Review **povinné nad diffem**: `AGENTS.md:53-54` ✅ řadí *„idempotenci fronty a kontrolu odesílatele IPC"* mezi money-critical a bezpečnostní kód. Masterplán §14 Pass 1–7; nosné jsou **Pass 3 (money — R8, R10, R16, R17)**, **Pass 2 (RBAC — redukovaný pohled bez cest a tokenů + rozšířený allowlist kanálů)** a **Pass 7 (verification evidence — kanárci, ne „nenašel jsem nic")**.

🔴 **Reviewer má jednu otázku navíc, kterou musí položit dřív než všechny ostatní:** *„Volá tenhle diff frontu opravdu z produkční cesty, nebo jen přidal další zelený test nad kódem, který nikdo nespustí?"* Odpověď musí stát na T7 **a** na kanárcích K2/K3, ne na jednom z nich.

---

## Co revize opravila

**Nepravdy a nepřesnosti v návrhu** (ověřeno otevřením kódu):

1. **HEAD lhal.** Návrh uváděl `73322ad`; skutečný HEAD je `0380bc0`, o **7 commitů dál**. Tři SHA dokumentů byly správné.
2. **`electron/queue.cjs:47` → `:48`.** Na `:47` je `writeFile`, `handle.sync()` je na `:48`. Sabotáž mířila na špatný řádek.
3. **`KONTRAKT.md §5 (403, 400)` — kód `400` v kontraktu neexistuje.** Vymyšlené pravidlo; odstraněno.
4. **„B6 sahá do jiných bloků `main.cjs` (viz §12)" — slepý odkaz i nedoložené tvrzení.** §12 žádný B6 řádek neměl, `plan.md` §2 taky ne, §2b dává B6 jen `src/lib/adapters/` a `TrackingCard.jsx`, `podklady-vytezene.md` naopak `main.cjs` i `preload.cjs`. Přepsáno na otevřenou otázku.
5. **Tvrzení, že brána hlídá literál killswitche i v testech.** `E5.sh:36` `tests/` neprohledává; trik `["tr","ue"].join("")` je konvence, ne vynucení.
6. **Rozsahy bloků v §12.1 se překrývaly** (B3 „202-266" pohlcovalo B4 „241-246") a `permissionPromptsInFlight` na ř. 237 byl mimo. Výčet, který nejde použít jako filtr, není výčet — rozsahy jsou nově disjunktní.
7. **Z výčtu bloků chyběl `test:quit` (709-714)**, přestože návrh tvrdil „ověřeno proti celé tabulce".
8. **R19 citováno „doslovně" a přitom zkráceno** (vypuštěné `(B3)`).

**Měřidla, o kterých návrh nevěděl a která by B7 shodila:**

9. 🔴 **`tests/ipc-sender-guard.test.js:186-210` drží UZAVŘENÝ seznam dvanácti IPC kanálů.** Přidání `queue:list` a `queue:retry` shodí `test:unit`, `gates`, CI i `E3.sh:73`. Návrh to nezmínil ani slovem a implementátor by na to narazil až po napsání kódu — v tu chvíli je nejlevnější „oprava" smazat assertion, tedy přesně to, co masterplán §13 zakazuje. Doplněno včetně toho, jak to opravit legálně.
10. 🔴 **`scripts/akceptace/E3.sh:24-64` vyžaduje, aby každý `src/`-modul odvozený z `electron/**/*.cjs` byl v zabaleném bundlu.** B7 do té množiny vstupuje. Ověřeno, že `package-mac.mjs:26-27` kopíruje celé `src/lib`, takže to projde — ale jen když se cesta zapíše literálovým `path.join(PROJECT_ROOT, "src", "lib", "queue.js")`. Jinak brána fail-open a §16 by běžel nad bundlem bez fronty.
11. **`E2-sabotaze.sh:68` odmítne špinavý `main.cjs` a `:85` ho přepíše z HEAD.**
12. **`jsconfig.json` typechecká `src/lib/**` a `tests/**`, ne `electron/**`.**
13. **`functionSource` matchuje jen `function jmeno(`** — vynucuje deklaraci, ne arrow funkci.

**Obejitelnosti, které revize našla:**

14. 🔴 **T7 byl bezzubý.** Návrhové znění („s prázdným prostředím `processNext` vrátí `disabled`") plyne výhradně ze `src/lib/queue.js` a je totožné s T4 případem 3. **Továrna na `send`, kterou `main.cjs` nikdy nezavolá, ho projde** — tedy B7 by mohla znovu vyrobit přesně tu vadu, kterou má odstranit (`DSK-F009` footnote ⁵: „zelené testy nad nezapojeným kódem"). Přepsáno na skutečné tvrzení o zapojení + nová povinná sabotáž **S8**, která ho musí shodit.
15. **R18 byl splněný jen z poloviny.** Fail-closed test pro nepravdivostní hodnotu existoval jen pro `DESKTOP_UPLOAD_ENABLED`. Přidán **T4 případ 4** pro `DESKTOP_TIME_ENABLED`.
16. **T3 šel splnit hláškou.** Přidán druhý případ, který zamyká tvar `item.entry`, takže sazba neprojde ani pod jiným jménem.
17. **`E5` neměří `DESKTOP_TIME_ENABLED=true` vůbec** — nový vypínač zapnutý v repu projde vším. Do `DAN-TODO.md`.
18. Přidána **S9** (allowlist kanálů po úpravě pořád měří) — jinak by šlo rozšíření zneužít k jeho vypnutí.

**Předpovědi povýšené na měření:**

19. **S8/S10 (fsync) — návrh to označil za sondu s nejistým výsledkem; revize to změřila.** Nad kopií mimo repozitář: po odstranění `handle.sync()` je save+load stále rovné (`ROVNOST bez fsync: true`). Je to **potvrzená díra v měřidle**, ne domněnka.
20. **K1 kanárek — návrh ho neověřil; revize otevřela archiv.** `dukazy/nahravani-2026-08-21/{ticho,zvuk}/application.log` obsahují `[recording] Uloženo:` právě 1× každý; doslovný tvar doplněn.
21. **Výchozí čára změřena:** `lint` EXIT=0 · `typecheck` EXIT=0 · `test:unit` EXIT=0 (9 souborů / 77 testů) · `E5.sh` 6× PASS, EXIT=0 · `test:unit -- queue` 11 testů zelených.
22. **Vitest filtruje podsubstringem cesty** (změřeno `vitest run authority`) ⇒ `tests/queue-wiring.test.js` se do `E5.sh:62` chytí sám. Nová páka: zapojení jde vynutit bránou, **aniž by se na bránu sahalo**.

**Doplněná fakta o kódu, která návrh neměl:**

23. **Past 2 u finalizace:** `recordingSession.manifest` v paměti je **předfinální** manifest (`sizeBytes: 0`, `sha256: null`, `closedAt: null`); `transitionManifest` na `main.cjs:623` vyrábí nový objekt a zpět ho nezapisuje. Dnes neškodí, protože položka bere jen `clientRecordingId` — ale je to tiše lhoucí data pro každého, kdo manifest uloží celý.
24. **Nahrávky uzavřené po pádu/zničení okna/navigaci se do fronty nezařadí** (`main.cjs:314/317/321` → `finalizeRecordingSession(..., "incomplete")`). Návrh to udělal mlčky; teď je to vypsané rozhodnutí + otevřená otázka proti M30.
25. **B5 neexistuje v žádné větvi** (`git log --all -- electron/tracking.cjs` prázdné). Z „varování" se stala blokující podmínka.
26. **`spec.md` §11 přiděluje packetu B7 jmenovitě nález o `outcome: disabled`/`idle`** — návrh to řešil, ale necitoval zdroj.
27. **Značka `⛔C2` u B7 v DAG diagramu** byla v návrhu úplně vynechána; doloženo, že C2 je běžné rozhodnutí, ne stopka.
28. **Třetí důvod, proč logika zůstává v `src/lib/queue.js`:** `package-mac.mjs` kopíruje celé `src/lib` do bundlu. Bez toho by §16 stál na domněnce.

## Co packetu chybí ve spec/plan

- B5 vůbec neexistuje — `electron/tracking.cjs` není v žádné větvi (`git log --all -- electron/tracking.cjs` je prázdné). Bez ní není znám tvar `{ trackingId, projectId, startedAt, endedAt }` a `enqueueTimeEntry` se nedá napsat proti skutečnosti. B7 nelze začít.
- Vlastnictví bloků pro B6 není nikde určené: `plan.md` §2 tabulka nemá řádek B6, §2b dává B6 jen `src/lib/adapters/` a `TrackingCard.jsx`, ale `podklady-vytezene.md:185-186` vede B6 jako spolumajitele `electron/main.cjs` i `electron/preload.cjs`. B6 a B7 přitom jedou ve stejné vlně 3 (`BEH-NOC.md:44`). Souběh není doložený.
- Plán nikde neříká, že `tests/ipc-sender-guard.test.js` drží uzavřený allowlist IPC kanálů, který musí ručně rozšířit každá story přidávající kanál (B5, B7, B8, B9). Chybí pravidlo, jestli je takové rozšíření povolené a jak ho odlišit od změkčení měřidla.
- Není rozhodnuto, jestli se do fronty mají zařazovat nahrávky uzavřené cestou po pádu / zničení okna / navigaci (`main.cjs:314/317/321` → stav `incomplete`). Spec ani plán to neřeší, M30 naznačuje opak toho, co packet zavádí.
- Není určeno, co má `processNext` vrátit, když je ve frontě zároveň položka blokovaná vypínačem a položka čekající na čas (`disabled` vs. `idle`). `spec.md` §11 tenhle nález přiděluje packetu B7, ale hodnotu neurčuje.
- `plan.md` §2b nezahrnuje `src/lib/queue.js` do souborů B7, přestože je to hlavní pracovní soubor story.
- `plan.md` §2b nezahrnuje `.env.example` do souborů B7, přestože R18 vyžaduje fail-closed `DESKTOP_TIME_ENABLED`.
- Brána `E5.sh` neměří `DESKTOP_TIME_ENABLED` vůbec — ani fail-closed test, ani zákaz literálu `DESKTOP_TIME_ENABLED=true`. Pro druhý vypínač neexistuje žádná projektová brána.
- Jméno integračního testu zapojení není určeno (`podklady-vytezene.md:173`); packet ho fixuje jako `tests/queue-wiring.test.js` bez opory v plánu.
- Značka `⛔` má v `plan.md` dva různé významy (skutečná stopka u B12 vs. „svázáno rozhodnutím" u B7 `⛔C2`, B6 `⛔B1`, B9 `⛔B2`) a nikde to není vysvětlené.
- Rozpor mezi artboardem (`design/canvas/Fronta.dc.html:127` — „Vzdáno po 6 pokusech") a `DEFAULT_RETRY_POLICY.maxAttempts = 5` / `KONTRAKT.md` §5 („5 pokusů") není rozhodnutý.
- R22 (plný GUID do jména souboru místo `sessionId.slice(0, 8)`) nevlastní žádná story v `plan.md` §2 ani §2b, přestože spec §11 ho vede jako money pravidlo.

## 🔴 Co NEBYLO ověřeno v kódu

Skeptik packet přečetl proti kódu, ale tohle zůstalo bez důkazu.
**Než na tom postavíš implementaci, otevři to.**

- Nespustil jsem `npm run build` (vite) — `dist/` je gitignorovaný, ale build by ho přepsal a zadání znělo pracovat jen pro čtení. Tvrzení, že B7 build nerozbije, zůstává neověřené.
- Nespustil jsem `scripts/akceptace/E3.sh` ani `E6.sh` — E3 část s bundlem potřebuje `npm run package:mac`, což zapisuje do `release/`. Obsah obou skriptů jsem přečetl řádek po řádku, ale jejich EXIT kód jsem neměřil. Konkrétně tvrzení, že `E3.sh:73` dnes prochází, stojí na tom, že `npm run test:unit` je zelený, ne na běhu E3.
- Neověřil jsem během, jak přesně Vitest vypíše selhání uzavřeného allowlistu v `tests/ipc-sender-guard.test.js` po přidání dvou kanálů. Změřený je FAKT, že seznam je uzavřený a asertovaný přes `toEqual` (přečteno na ř. 191-204) — doslovný tvar diffu je předpověď a implementátor ho musí nahradit skutečným výpisem.
- Všechny „červené" výpisy v sekci 13 (T1–T9) jsou předpovědi tvaru chyby Vitestu, ne zachycený výstup. Žádný z navržených testů jsem nenapsal ani nespustil.
- Neotevřel jsem `design/navrh/nahled.html` (schvalovací náhled s 22 obrazovkami) ani ostatní artboardy. `design/canvas/Fronta.dc.html` jsem jen grepnul na stavy a klíčové řetězce, nečetl jsem ho celý.
- Nepřečetl jsem `scripts/ui-smoke.mjs` celý (392 řádků) — jen jsem grepnul, že sahá na `window.ludone.getTrayState/testClickTray/testQuit` a nemá vazbu na frontu. Pro B7 se stejně nespouští.
- Nepřečetl jsem `electron/auth.cjs` (16 870 B). Tvrzení o auth v packetu jsou převzatá ze spec a KONTRAKT, ne ověřená v kódu.
- Neověřil jsem naostro chování `app.getPath("userData")` pod `LUDONE_DATA_DIR`. Cestu `<LUDONE_DATA_DIR>/user-data/…` jsem odvodil z `configureWritablePaths()` (`main.cjs:170-191`), ne z běhu aplikace.
- Neověřil jsem, že zabalená aplikace skutečně vypíše `[recording] Uloženo:` na stdout — změřil jsem jen, že ten řetězec je v archivovaných lozích `dukazy/nahravani-2026-08-21/` (1× v každém) a že produkční `console.log` je na `main.cjs:643`. Původ těch logů (ze zdrojáku vs. z bundlu) jsem nezjišťoval.
- Nespustil jsem živý scénář ze sekce 16 ani `npm run package:mac`. Tvrzení, že `src/lib/queue.js` skončí v bundlu, stojí na čtení `scripts/package-mac.mjs:26-27`, ne na existujícím bundlu.
- Neprohlédl jsem obsah větví `orca/desktop-b1` a `orca/desktop-b4` — obě ukazují na stejný commit jako `main`, ale rozpracovanou práci v jejich worktrees jsem nekontroloval.
- Sabotáže S1–S9 jsem neprovedl — repozitář se nesměl editovat. Jediná skutečně provedená mutace byla S10 (fsync), a to nad KOPIÍ `electron/queue.cjs` ve scratchpadu, ne nad souborem v repu.
- Neověřil jsem chování `enqueueTimeEntry`, `reduceQueueForRenderer` ani `killswitchNameForKind` — neexistují. Jejich navržené API je konstrukce tohohle packetu, ne měření.
- Nepřečetl jsem `docs/MASTERPLAN.md` celý — jen §9 (formát packetu, 20 polí), §13 (TDD, zákaz změkčení) a mapu nadpisů. §14 (Pass 1–7) jsem viděl jen jako seznam nadpisů, ne obsah.
- Nepřečetl jsem `podklady-vytezene.md` celý (16 165 B) — jen grepnuté řádky 77, 103, 173, 177, 185-197, 211. Sekci „§3", na kterou se návrh odvolával, jsem jako číslovanou sekci neověřil.
