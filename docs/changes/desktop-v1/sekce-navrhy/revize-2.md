# Skeptická revize 2

**Adversariální čtení návrhu sekce.** Zadání znělo najít, čím se dá
tvrzení obejít nebo v čem lže — ne schválit.

---

# Skeptická revize sekcí „Performance expectations" a „Responzivita"

Ověřoval jsem každou citaci proti repu a každé tvrzení o Electronu proti dokumentaci. Sekce je nadprůměrná — hlavně tím, že sama odděluje ZMĚŘENO od NÁVRHU. Právě proto stojí za to ukázat, kde ta značka **lže**.

---

## 1. Co je v pořádku (a nechat beze změny)

| Tvrzení | Ověření |
|---|---|
| `audioBitsPerSecond: 128_000` na `RecordingCard.jsx:145` | ✅ sedí (řádek 145, ne 142–148; rozsah je o tři řádky delší, než je) |
| `RECORDING_TIMESLICE_MS = 1_000` na `:8` | ✅ přesně |
| `MAX_RECORDING_CHUNK_BYTES = 8 MiB` na `main.cjs:29` | ✅ přesně |
| Pevných 366 × 792, `resizable:false` | ✅ `main.cjs:27-28`, konstanty přesně |
| Fáze `checking` existuje | ✅ `RecordingCard.jsx:303-310` |
| Ochrana panelu při dialogu o oprávnění | ✅ `main.cjs:232-245`, i s doloženým důvodem v komentáři |
| `togglePanel` je jen `show()` | ✅ `main.cjs:387-395`, `tray.on("click")` na `:730` |
| `prefers-reduced-motion` je ošetřený | ✅ `styles.css:1337-1343` |
| Hlavička 52 px / patička 34 px | ✅ `nahled.html:48` a `:54` |
| 🔴 **Patička nemá `flex-shrink:0`** | ✅ **potvrzeno doslova** — `.ph` ho má, `.pf` ne. Nejlepší nález celé sekce |
| WebM nemá celkovou délku v hlavičce | ✅ `ROZHODNUTI.md` B6 — a přidává, co sekce neví: **remux `ffmpeg -c copy` délku doplní a zvuk je bitově totožný**, takže existuje i druhé měřidlo |
| E4 měřidlo 200 ms je zadané | ✅ `PLAN.md:111` |
| Preflight disku 2 GB / 5 GB je jen popsaný | ✅ `E6:65-69` (krok 10), a `inventar F23` dokládá `EXIT=1` na `rg ENOSPC` |
| Retence maže jen `uploaded` | ✅ `E6` krok 10 |
| Dnešní chyba zápisu shodí obě stopy | ✅ ale ne tam, kam sekce ukazuje — viz nález 6 |

---

## 2. Jak se to dá obejít, nebo jak to lže

### 🔴 N1 — Číslo pro dimenzování je odvozené z **poloviny** citovaného měření. 160 MB je ve skutečnosti bližší pravdě než 250.

Sekce zavrhla Danových 160 MB s tím, že „naměřený tok mikrofonu ho sám o sobě překročí". Vzala z tabulky v `NAHRAVANI.md:58-64` **jen řádek „5 s ticho"**. Druhý řádek téže tabulky — systémová stopa se skutečným zvukem — je 27 993 B / 5 s:

| | naměřeno | na 1 h | na 2 h |
|---|---:|---:|---:|
| Mikrofon (ticho i zvuk, prakticky CBR: 85 169 vs 85 517 B) | 17,0 kB/s | 61 MB | 123 MB |
| Systém **v tichu** | 0,27 kB/s | 1 MB | 2 MB |
| Systém **se zvukem** (3× Glass.aiff) | **5,6 kB/s** | **20 MB** | **40 MB** |

Z **měření** tedy plyne 125 až **163** MB, ne 125 až 245. Horní hranice 245 vznikla dosazením mikrofonního toku do systémové stopy — což je přesně to, co měření vyvrací (Opus na systémové stopě jede silně variabilně). Sekce označila 125–245 jako **DOPOČTENO**, ale dopočet z naměřených hodnot to není.

**Jak to opravit:** rozdělit na dvě čísla s různou značkou a nezavrhovat Danovo číslo.
- *Typický 2h záznam ≈ 165 MB* — **DOPOČTENO** z obou řádků `NAHRAVANI.md:58-64`.
- *Dimenzování 250 MB* — **NÁVRH, nejhorší případ:** předpokládá, že druhá strana mluví nepřetržitě plným tokem. Měření to nedokládá, protože 3 pípnutí za 5 s nejsou dvouhodinový hovor.
- Větu „číslo 160 MB ze zadání je odhad, ne měření" **vyškrtnout** — 160 MB měření odpovídá.

⚠️ Navíc: 17,0 kB/s je extrapolace **pětisekundového** vzorku, který nese fixní hlavičku WebM. Nastavených 128 kbit/s dává 57,6 MB/h; naměřených 61 MB/h je z větší části amortizovaná hlavička. Na dvou hodinách konverguje k ~115 MB, ne 123. Označit jako *extrapolace krátkého vzorku*, ne jako tok.

### 🔴 N2 — „E4 to potvrdí" je odkaz na měřidlo, které to potvrdit **nemůže**. Přímý rozpor s `plan.md`.

Sekce se na E4 odvolává pětkrát (strop RSS, CPU, tvar křivky paměti, 200 ms). `PLAN.md:111` ale E4 definuje jako **„60min nahrávka"**. Požadavek „RSS mezi **5. a 120. minutou**" je v šedesátiminutovém běhu neměřitelný — a přesto by E4 prošlo zeleně. To je učebnicová lhavá brána: brána zezelená, aniž by se cokoli z toho ověřilo.

**Oprava:** buď sekce žádá změnu E4 na 120 min (a plan.md se mění spolu s ní), nebo si zavádí vlastní měřidlo **E4b — dvouhodinový běh**, a všechny odkazy vedou tam. Bez toho zůstává dvouhodinová spolehlivost — Danovo jediné čerstvé rozhodnutí o výkonu — **bez jediného měřidla**.

### 🔴 N3 — „Nahrávka se nikdy nedrží v paměti celá" není v kódu vynucené. Je to přání.

Odůvodnění „chunk padá na disk každou 1 s, takže v paměti je nanejvýš ~16 kB na stopu" **neplatí**, protože zápis nemá žádný strop fronty:

- `RecordingCard.jsx:184-191` — `ondataavailable` řetězí `writeQueue = writeQueue.then(...)` **bez omezení hloubky**; každý článek drží referenci na `event.data`.
- `main.cjs:560-578` — `track.queue = operation.catch(...)`, opět nekonečný řetěz.

Když se zápis zpomalí nebo zastaví (plný disk, FileVault, Time Machine, USB disk), chunky se **hromadí v paměti lineárně s délkou nahrávky** — tedy přesně v situaci, kterou tahle sekce řeší. Nic si toho nevšimne: žádný čítač, žádný test.

**Oprava:** z R2 udělat vynutitelné pravidlo. *„Nezapsaných chunků smí být nejvýš N (návrh: 30 ≈ 30 s). Při překročení jde postižená stopa do stavu podle R3 a panel to řekne."* Plus sabotáž: zpomalit zápis a ověřit, že se fronta zastaví na N, ne že RSS roste.

### 🔴 N4 — Panel je při nahrávání **skrytý**, a nikdo nevypnul škrcení na pozadí.

`main.cjs:328-342` panel schová při ztrátě fokusu. Během dvouhodinové schůzky je tedy skrytý prakticky pořád — a chunkování běží v **rendereru** (`recorder.start(1000)`).

Ověřeno v dokumentaci Electronu: `webPreferences.backgroundThrottling` (výchozí `true`) *„throttles animations and timers when the page becomes backgrounded"*; existují `contents.setBackgroundThrottling()` a `powerSaveBlocker.start('prevent-app-suspension')`.

V repu **není ani jedno**: `grep -rn "backgroundThrottling\|powerSaveBlocker\|powerMonitor" electron src scripts` → nic, a `webPreferences` na `main.cjs:302-307` má jen preload/contextIsolation/nodeIntegration/sandbox.

Tohle je nejpravděpodobnější způsob, jak dvouhodinová nahrávka selže — a sekce o výkonu ho nezmiňuje.

**Oprava:** vlastní požadavek. *„Po dobu nahrávání i běžícího časovače má panel `backgroundThrottling: false` a drží `powerSaveBlocker('prevent-app-suspension')`. Blokátor se pouští při startu a **pouští se explicitně**, ne jako vedlejší efekt. Měřidlo: 2h nahrávka se zavřeným panelem má souvislé pořadí chunků bez díry."*

### 🔴 N5 — Kontrola délky se rozbije o scénář, který už v `spec.md` §8 je.

Nový acceptance požaduje *„počet dekódovaných vzorků odpovídá reálné délce s odchylkou ≤ 1 s na hodinu"*. `spec.md:182-184` přitom požaduje, aby nahrávka **přežila zavření notebooku na hodinu**. Po uspání Mac přestane dodávat zvuk; obnovený zápis pokračuje do téhož souboru a **v kontejneru po hodině spánku není nic**. Dekódovaných vzorků bude o hodinu míň než „reálná délka" a scénář N5 spadne — přestože se aplikace zachovala správně.

**Oprava:** definovat, co je „reálná délka": *„počet vzorků odpovídá součtu **aktivních** intervalů zaznamenaných v manifestu (`suspend`/`resume` z `powerMonitor` se do manifestu zapisují), ne rozdílu `endedAt − startedAt`."* Bez toho měřidlo lže v obou směrech.

### N6 — Citace ukazuje na místo, kde se chyba jen **vyhodí**, ne kde obě stopy umírají.

„Chyba zápisu shodí obě stopy s technickou hláškou (`main.cjs:560-578`)" — efekt je správný, adresa ne. `main.cjs:560-578` chybu jen vyhodí. Zabíjí obě stopy renderer: `reportFailure` → `onFailure` → `reportRuntimeFailure` (`RecordingCard.jsx:298-301`) → `finishRuntime`. Implementátor, který půjde na `main.cjs:560`, opraví hlášku a ne chování.

**Oprava:** citovat `RecordingCard.jsx:169-177` a `:298-301`.

### N7 — „p95" bez populace je nefalzifikovatelné.

Čtyři z osmi časových řádků jsou p95, ale nikde není, z kolika běhů, na jakém stroji a čím měřeno. Kdokoli může prohlásit splněno. To je přání, ne požadavek.

**Oprava:** *„20 běhů na referenčním Macu (MacBook Pro, macOS 26), medián ≤ X, nejhorší běh ≤ 2×X. Naměřené hodnoty se zapisují do `dukazy/vykon-<datum>/`."* Bez uloženého důkazu se to při dalším běhu neporovná.

### N8 — 150 ms „nemá co trvat" je úvaha, ne měření — a přehlíží N4.

Panel skrytý dvě hodiny má uvolněný kompozitor. První `show()` po dlouhém skrytí může ukázat prázdný nebo starý snímek dřív než čerstvý — což je **přesně** ta „prázdná plocha", kterou druhý řádek zakazuje. Argument „nic se nenačítá, tak nemá co trvat" ten případ nepokrývá.

**Oprava:** přidat k řádku podmínku *„i po ≥ 2 h skrytí"* a měřit až po dvouhodinovém běhu, ne na čerstvě spuštěné aplikaci.

### N9 — Odchylka „≤ 1 s za 8 h" nedokazuje to, co si sekce myslí, že dokazuje.

Sekce z ní odvozuje: *„drift smí posunout hranici minuty nejvýš jednou za pracovní den."* To **neplyne**. Když skutečný čas stopu padne na `:59,9`, hranici minuty posune drift jakkoli malý. Zároveň: pokud se čas počítá z uložených razítek (což sekce správně žádá), pak *drift měření neexistuje* — existuje jen skok systémových hodin (NTP, ruční přenastavení, změna časového pásma), a o tom sekce nemá ani slovo. Je to money-path pod R9/R10.

**Oprava:** vyměnit číslo za vlastnost. *„Časovač počítá z monotónních hodin pro zobrazení a z UTC razítek pro zápis. Skok systémových hodin nesmí změnit už zapsaný start. Měřidlo: posunout hodiny o −10 min během běhu → zapsaný start se nezmění."*

### N10 — Strop 500 MB RSS se na macOS **nedá poctivě změřit tak, jak je napsaný**.

„500 MB RSS **za všechny procesy aplikace**" — sečtený RSS napříč procesy Electronu **vícekrát započítá sdílené stránky frameworku**, takže číslo bude nafouknuté a brána spadne i u zdravé aplikace. Nebo se naopak bude měřit jen main proces a projde cokoli.

**Oprava:** *„měří se `phys_footprint` (`footprint -p`, sloupec Memory v Monitoru aktivity), sečtený přes strom procesů"*, a číslo se **doplní** po prvním běhu, ne teď.

### N11 — Preflight disku + S1 + R19 se vzájemně vylučují: aplikace **přestane nahrávat** a nabídne nefunkční východisko.

Sekce si všimla poloviny („nic se neodešle, a tedy nic nesmaže — disk poroste"), ale ne důsledku. Když je `DESKTOP_UPLOAD_ENABLED` vypnutý (S1, a v celém v1 zůstane), nikdy nic nepřejde do `uploaded`, janitor tedy nikdy nic nesmaže, složka po ~20 schůzkách překročí 5 GB — a **preflight nahrávání zakáže**. Jediné nabízené východisko „Smazat odeslané teď" je za těch podmínek prázdná operace.

**Oprava:** buď preflight v1 hlásí jen varování a nespouští odmítnutí, dokud je upload vypnutý, nebo se přidá „Smazat i neodeslané" s explicitním potvrzením. Rozhodnout musí Dan — je to ztráta dat. **Do `DAN-TODO.md`.**

### N12 — Pravidlo výšky je správné číslem, ale špatné vzorcem.

`min(792, dostupná výška − 16)` funguje jen náhodou. `positionPanel` (`main.cjs:268-280`) posazuje panel na `y = max(workArea.y + 8, trayBounds.y + trayBounds.height + 8)`. Dostupná výška pro panel není `workArea.height − 16`, ale `workArea.y + workArea.height − y − 8`. Dnes to vychází stejně, protože tray leží v horní liště; jakmile se odsazení nebo pozice změní, vzorec tiše přeteče znovu.

Zároveň: 775 px v úvodním odstavci **nemá značku** — a je to číslo, na kterém stojí celá sekce. Porušuje vlastní pravidlo sekce hned v prvním odstavci.

**Oprava:** vzorec odvodit od horní hrany panelu; 775 px označit **PŘEVZATO z Danova měření 1. 9.** a doplnit, že platí pro skrytý Dock.

### N13 — Rozvržení, které sekce žádá, dnešní CSS nedovoluje. Splní se formálně (okno je 759 px) a věcně ne (obsah se ořízne).

`.panel` je `display:flex;flex-direction:column;overflow:hidden`, `.pb` je `padding:14px;display:flex;flex-direction:column;gap:11px` — **bez `flex`, bez `min-height:0`, bez `overflow-y`**. Flexbox položku nesmrskne pod obsah, dokud nedostane `min-height:0`; s `overflow:hidden` na rodiči se přebytek **uřízne a nejde k němu dorolovat**. Sekce jmenuje jen `overscroll-behavior`, tedy jedinou ze čtyř potřebných vlastností.

**Oprava — napsat do sekce doslova:** `.pb { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }` a `.pf { flex-shrink: 0; }`. A přidat kontrolu, která by chybu chytla: *„ui-smoke při výšce 600 px ověří `panel.scrollHeight <= panel.clientHeight` na kořeni a `pb.scrollHeight > pb.clientHeight` uvnitř"* — jinak se ořezaný obsah od rolovaného nepozná.

### N14 — Změna výšky za běhu na zamčeném okně nemusí projít; dokumentace si v tom protiřečí.

Okno má `resizable:false` a `minHeight === maxHeight === 792` (`main.cjs:286-289`). Dokumentace Electronu k tomu říká dvě různé věci: `BaseWindow` — *„size constraints only apply to user interactions; setBounds or setSize can still override"*; `BrowserWindow` — *„setSize respects minimum size constraints, causing the window to snap to those limits"*. Který z nich platí na macOS, se z dokumentace **nezjistí**.

**Oprava:** do sekce napsat postup i důvod, proč se ověřuje empiricky: *„výška se mění přes `setMinimumSize`/`setMaximumSize` a teprve pak `setBounds`; `resizable:false` zůstává. Chování je nutné ověřit během, ne z dokumentace — ta si v tomhle bodě odporuje."* Bez toho vznikne implementace, kde `setBounds` tiše nic neudělá a panel přetéká dál.

### N15 — Zákaz v logu se dá dodržet do písmene a stejně vyzradit jméno.

„Nikdy zvuk, token, e-mail ani název schůzky" je dobře, ale diagnostika nese cesty typu `/Users/jan.novak/Library/Application Support/…` a názvy souborů nahrávek. Jméno v cestě není na seznamu, přitom je to osobní údaj. `E6` krok 9 už absolutní cesty zakazuje **rendereru** — ne diagnostickému balíčku.

**Oprava:** doplnit *„a žádné absolutní cesty; domovský adresář se nahrazuje `~`"*, plus vynucení: rozšířit `scripts/b3-gate.mjs` (dnes hledá tvary klíčů) o tvar `/Users/<cokoli>/`. Jinak je to kázeň, ne brána.

### N16 — Drobné nepřesnosti citací (v sekci, která stojí na citacích, se počítají)

- `RecordingCard.jsx:142-148` → bitrate je na **145**.
- `main.cjs:301` pro podklad okna → `backgroundColor` je na **293**.
- `main.cjs:286-291` pro zámek výšky → zámek je **286-289**, 290-291 jsou `show`/`frame`.
- `E5:7` „nezávisle to potvrzuje" — **není to nezávislé**. `40–120 MB/h` je odhad z téhož projektu, bez měření. Odhad potvrzující odhad není potvrzení. Napsat *„shoduje se s odhadem v E5, který ale sám měřený není."*
- Značka **ZMĚŘENO** u `audioBitsPerSecond: 128_000` a u výšek z `nahled.html` — to jsou **nastavené konstanty**, ne měření. Sekce si tím sama podkopává značku: hned vedle ukazuje, že skutečný tok (17,0 kB/s) je od nastavených 16 kB/s jiný. Zavést třetí značku **NASTAVENO** a nechat **ZMĚŘENO** jen tomu, co vzniklo z běhu.

---

## 3. Co chybí úplně

1. **Napájení a spánek.** `powerSaveBlocker`, `powerMonitor` (`suspend`/`resume`), chování při zavření víka, běh na baterii. Viz N4 a N5. Nejzávažnější díra sekce.
2. **Měřidlo pro dvouhodinovou zátěž.** E4 je 60min (N2). Bez E4b není Danovo rozhodnutí ničím kryté.
3. **Odkaz „viz § Otevřené" je slepý.** `spec.md` §9 obsahuje dvě položky a ani jedna není „co se stane ve 121. minutě". Slučovatel musí §9 doplnit, jinak sekce odkazuje na prázdno. (Autor to sám avizuje v předpokladech — ale odkaz už v textu je.)
4. **Zvětšené písmo a zoom.** Veškerá matematika (52 / 34 / 676 / minimum 219) platí při zoomu 1. Při systémově zvětšeném textu nebo `setZoomFactor > 1` panel přeteče znovu — na Danově Macu to projde, u kolegy ne. Chybí buď zámek zoomu, nebo měřidlo při 150 %.
5. **Chování při ENOSPC je nové business pravidlo, ale je schované ve výkonové sekci.** Zastavit jen postiženou stopu je správné (odvozeno z R3), ale patří do `spec.md` §4 jako **R21**, jinak ho nikdo netestuje jako pravidlo. Totéž preflight disku → **R22**. Jak sekce sama píše: Dan to pro disk nerozhodl. **Do `DAN-TODO.md`.**
6. **Přepnutí zvukového zařízení za běhu** (AirPods, dok, externí mikrofon). `PLAN.md:111` to u E4 žádá („ztlumeno, AirPods…"), sekce o spolehlivosti 2h nahrávky mlčí. Přitom je to při dvouhodinové schůzce běžnější než plný disk.
7. **Klidová spotřeba.** Sekce měří jen nahrávání. Aplikace ale běží 8 h denně v klidu — bez čísla pro klid nejde poznat, jestli 500 MB při nahrávání je hodně, nebo málo. Změřit dřív než strop.
8. **Fronta při 20+ položkách.** `spec.md` §10 to vědomě odkládá; sekce o frontě mluví, aniž by na odklad odkázala. Doplnit jednu větu, ať se to nezačne řešit dvakrát.
9. **Kam se naměřené hodnoty ukládají.** Sekce žádá, aby se nezměřené číslo neopsalo do reportu, ale neříká, kam se změřené zapíše. Bez uloženého artefaktu (`dukazy/vykon-<datum>/`) se příští běh nemá s čím porovnat a všechno spadne zpátky na „opsáno z paměti".

---

## 4. Tři věci, které je nutné opravit před vložením do `spec.md`

1. **250 MB → přepsat na měřený typ ≈165 MB + návrh worst-case 250 MB**, a zrušit tvrzení, že Danových 160 MB je vyvrácených. Je to jediné číslo v sekci, které říká opak toho, co dokládá citované měření (N1).
2. **Nahradit odkazy na E4 novým měřidlem E4b (120 min)** — jinak celá sekce zezelená bez ověření (N2).
3. **Doplnit `backgroundThrottling: false` + `powerSaveBlocker`** jako požadavek, včetně měřidla se skrytým panelem (N4).

**Do `DAN-TODO.md`** (rozhodnutí, ne návrh): chování při ENOSPC (N5/§3.5), a co dělat s 5GB stropem, když se v1 nikdy nic nemaže (N11).