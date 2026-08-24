# Co musí udělat Dan — LuDone Desktop

Vzniklo 24. 8. 2026 z ultracode analýzy (9 agentů nad kódem, výzkumem a rozhodnutími).
Tenhle soubor obsahuje **jen to, co za tebe nikdo jiný neudělá.** Všechno ostatní je v `PLAN.md`.

Pravidlo: agent smí tvrdit, že něco funguje, jen když to změřil. Nic z tohoto seznamu
se změřit nedá bez tebe — druhé zařízení, sluchátka, restart Macu, peníze, právní rozhodnutí.

---

## 1. Rozhodnutí, která jsi udělal 24. 8. (zapsáno, neotvírá se znovu)

| # | Otázka | Rozhodnutí |
|---|---|---|
| D1 | Přihlášení desktopu k `app.ludone.cz` | **OAuth 2.1 + PKCE, loopback redirect.** Ne bearer token — onboarding už má tlačítko „Přihlásit se“ a OAuth server je na produkci živě ověřený s Claude Desktop |
| D2 | Bundle identifier | **`cz.ludone.desktop`** (dnes `cz.ludone.desktop.prototype`). Mění se v E3, dokud oprávnění nemá nikdo kromě tebe |
| D3 | Pořadí práce | **Prokládat** — E5 (server) a E6 (desktop fronta) souběžně ve dvou worktrees. Kalendář a LuTrack až po nich |
| — | Rozsah prvního běhu | **E0 + E2 + E3.** Meet test (E1) až po nich |
| — | Design | Claude Design **je připojený, nic se neinstaluje.** Nejdřív technické otázky, pak výsledný design a funkce přes Claude Design |

---

## 2. Rozhodnutí, která ještě potřebuju — seřazená podle toho, kdy blokují

### 🟡 D4 — Čím se bude přepisovat? *(blokuje E9, tedy poslední etapu)*

Potřebuju od tebe **jedno číslo: kolik hodin audia měsíčně.** Dnes 58 % objemu vzniká
na krabičce od Plaudu, která podle A5 zmizí — takže odhad „co zbude“, ne „co je dnes“.

Doporučení: **hostovaná služba s platbou za spotřebu** (Whisper API / Deepgram / AssemblyAI).
A2 (nulový měsíční paušál) to připouští, platba za spotřebu je výslovně v pořádku.
A4 (lokální přepis se nepoužije, „nefunguje dobře“) variantu se self-hosted whisper zavírá.

Volba mezi poskytovateli mění cenu za hodinu češtiny, limit délky jednoho požadavku
(a tím povinné dělení hodinové schůzky) a jestli je v ceně diarizace dvou mluvčích.
Bez tvého objemu to nespočítám.

### 🟡 D5 — Kalendář: čte ho server, nebo appka? *(blokuje E7)*

**Doporučení: server čte Google Kalendář přes OAuth, appka jen zobrazí hotový seznam.**
Sedí k A11 („aplikace je spouštěč“), nepřidává jedinou nativní komponentu, u budoucího
Windows ušetří 5–10 ČD. Varianta B (EventKit na Macu) znamená nativní Swift komponentu
a **další TCC dialog** navíc k záznamu obrazovky.

Řekni ano/ne, nebo že to má být jinak.

### 🔴 D6 — Právní rámec nahrávání *(neblokuje vývoj, blokuje OSTRÉ POUŽITÍ)*

Není to řádek kódu, je to hodina rozhovoru. Ale **musí být hotové dřív, než vznikne
první ostrá nahrávka**, protože pak už nahrávky existují a mažou se hůř, než by
nevznikaly. Výzkum to řadí jako **riziko č. 1 z doložených precedentů** — konkurenční
případ z dubna 2026 padl přesně na tomhle, ne na kódu.

Rozhodnout dvě věci:
1. **Souhlas** — nahrávat jen interní schůzky a externí až po písemném souhlasu? Nebo
   ohlásit nahrávání na začátku každé schůzky (appka připomene)?
2. **Retence** — jak dlouho se nahrávky drží a co se s nimi pak stane? Určuje to, co se
   na serveru implementuje.

Ohlášení nahrávání patří **do UI jako viditelný prvek, ne do Nastavení.**

---

## 2b. Designové stopky — na těchhle šesti se PŘESKAKUJE, běh nezastavují

Detail v [`specs/ED-design.md`](specs/ED-design.md). Dokud neodpovíš, běh pokračuje na tom,
co na nich nezávisí, a rozhodnutí zapíše do tabulky D v `ROZHODNUTI.md`.

| # | Otázka | Kde je dnes rozpor |
|---|---|---|
| **D-A** | **Písmo nadpisů** | Mockup má Schibsted Grotesk · Přístroj DS má Instrument Sans · `ludone-app` má licencovaný Brockmann (Přístroj ho záměrně nepoužívá). Kód má `ui-rounded`, tedy systémové |
| **D-B** | **Světlý režim, tmavý, nebo oba?** | Kód umí **jen tmavý** (`color-scheme: dark` natvrdo, žádný `prefers-color-scheme`), mockup kreslí **jen světlý**, a ty máš v systému zapnutý tmavý s omezenou průhledností |
| **D-C** | **Zelený akcent vedle indigové z Přístroje** — a smí se objevit ve sdílených tokenech? | Doporučení: **ne.** Zápis do `tokens/colors.css` by přebarvil i `ui_kits/ludone-app`. Override patří do `tokens/desktop.css`. Navíc mockupová `#1B7A43` je laděná na světlé pozadí a na tmavém propadne kontrastem — tmavý režim potřebuje vlastní odstín |
| **D-D** | **Co dělat, když spadne systémová stopa uprostřed schůzky?** | Dnešní kód **ukončí celé nahrávání**. Alternativa: banner + volba „Pokračovat jen s mikrofonem“ × „Ukončit a uložit“, s údajem, kolik minut je už bezpečně na disku |
| **D-E** | **Pauza — ano, nebo ne?** | V mockupu nakreslená, v kódu **neexistuje** (`MediaRecorder.pause()` se nevolá). Se dvěma nezávislými rekordéry se nesynchronní pauza projeví jako **trvalý posun mezi stopami** ⇒ přepis, kde si lidé skáčou do řeči |
| **D-F** | **Kalendář v onboardingu — povinný, nebo volitelný?** | Kód má `disabled={!allGranted}`, tedy **všechna tři oprávnění povinně**. Mockup ho označuje jako „volitelné“. Když dnes odmítneš kalendář, appka zůstane viset na třetím kroku a je z ní cihla |

⚠️ **Jedna věc, kterou stojí za to vědět hned:** appka se dnes vykresluje v **San Franciscu**, tedy
nativním systémovém písmu — to je výtvarný **směr B, který jsi rozhodnutím A14 zabil**.
`styles.css:3` sice deklaruje Public Sans, ale v repu není žádné `@font-face`, žádný `.woff2`
a CSP `default-src 'self'` blokuje Google Fonts. Kdo posuzuje vzhled ze screenshotů, posuzuje
jiný produkt, než jaký je naspecifikovaný.

---

## 3. Měření, která umím připravit, ale spustit je musíš ty

### 🔴 E1 — Google Meet *(vyřazovací kritérium A6, po E0–E3)*

**Tohle může projekt zabít.** A6 říká, že Meet v prohlížeči je vyřazovací kritérium —
a dosud se testoval jen `afplay`, triviální lokální přehrávač. Meet je jiná situace hned
třikrát: Chrome pouští hovor přes „communication“ audio relaci, je aktivní **potlačení
ozvěny (AEC)**, a aplikace zároveň sama drží mikrofon.

Reálná obava: **AEC odečte hlas protistrany z mixu a odbočka vrátí ticho** přesně u toho
jediného streamu, na kterém záleží.

Co potřebuješ: **druhé zařízení s druhým účtem, ~30 minut.**
Připravím ti skript, který nahraje 60 s a rovnou spočítá korelaci — ty jen pustíš Meet,
necháš protistranu přehrát známý soubor (30 s hudby) a spustíš skript.

**Prošlo = korelace > 0,8 a střední hlasitost nad −40 dB.** Zopakovat pro Teams.
Neprošlo = plán se od E5 dál mění (Windows, kde je loopback oficiálně podporovaný).

### 🟡 E4 — Provozní podmínky *(všechna dosavadní měření trvala 5 sekund)*

Neměřené zůstávají úplně všechny podmínky, za kterých se to reálně používá.
Skripty napíšu, tlačítka mačkáš ty:

| Test | Co děláš | Proč to není teorie |
|---|---|---|
| **W2** | 60 min nahrávka, cvaknutí každých 5 min | Mikrofon a systém jsou **dva soubory se dvěma nezávislými hodinami bez společné časové osy.** Na 5 s to není vidět, na 60 min to rozbije přepis dvou mluvčích — tedy hlavní hodnotu produktu |
| **S2** | Reproduktory na 100 % / ztlumeno klávesou / hlasitost 0 / AirPods | „Ztlumený uživatel se nenahraje“ by byla tichá a drahá vada |
| **S3** | Za běhu připojit AirPods v 10. s, odpojit ve 20. | Klasický zabiják Core Audio odboček — odumřelá stopa |
| **W3** | `kill -9` uprostřed skutečné nahrávky | Dosud jen simulováno uříznutím souboru |

### 🔴 E10 — Podpis a oprávnění *(dnes ⛔ neověřeno, ne ✅)*

C1 v `ROZHODNUTI.md` tvrdí, že oprávnění drží i s vlastním certifikátem. **To zatím
neplyne z ničeho** — a analýza k tomu našla čtyři díry, které v dokumentu nejsou:

- 🔴 **Měřilo se špatné oprávnění.** Loopback jde přes `getDisplayMedia`, takže rozhoduje
  **Záznam obrazovky**, ne mikrofon — a právě ten má opakované vyžádání souhlasu
  (po čase a po restartu), **nezávisle na podpisu.** Stabilní designated requirement na
  tohle nesahá vůbec.
- 🔴 **Binárka, která nahrává, je ad-hoc podepsaná** — tedy přesně ta konfigurace, kterou
  měření označilo za nestabilní. Obě měření nikdy neproběhla nad jedním artefaktem.
- 🔴 **Testovací certifikát byl smazán.** Výsledek je nereprodukovatelný — a hlavně nikde
  není rozhodnuto, **kde bude bydlet a jak se zálohuje ostrý podpisový klíč.**
- 🔴 **V release bundlu chybí `NSAudioCaptureUsageDescription`** (je tam jen
  `NSMicrophoneUsageDescription`). Na tvém Macu s uděleným oprávněním neviditelné,
  na čistém stroji přesně příčina chybějící nebo divné výzvy.

**Co uděláš (na čistém lokálním účtu):**
1. Vyrobit ostrý certifikát a **NEJDŘÍV zazálohovat `.p12` do správce hesel**
2. Podepsat bundle zevnitř ven, ověřit `--deep --strict`, zapsat `codesign -d -r-`
3. Spustit, udělit **Záznam obrazovky i mikrofon**, nahrát 5 s
4. Změnit řádek kódu, přeložit, podepsat **týmž** certifikátem, ověřit, že `codesign -d -r-`
   je znak po znaku stejné
5. Spustit a nahrát znovu **bez sáhnutí do Nastavení**
6. 🔴 **P2 — negativní kontrola, bez ní P1 nic neznamená:** totéž s ad-hoc podpisem
   **musí selhat.** Kdyby prošlo obojí, znamená to jen, že se macOS 26 už neptá,
   a certifikát nedělá nic
7. **P3** — po zeleném P1 restartovat Mac a spustit znovu

Věcně to doporučení „začít bez placení“ nejspíš platí a mýlka stojí jen 99 $ zpětně,
takže to **nic neblokuje** — jen se to nesmí vydávat za změřené.

⚠️ **Riziko, které v tabulce D není ani řádkem:** ztráta podpisového klíče vynuluje
oprávnění **všem**, kdo appku mají, nevratně. To je horší a trvalejší problém než 99 $/rok.
Nikdy nepodepisovat klíčem, který existuje jen na jednom disku.

---

## 4. Dluhy z jiných projektů, které tu visí

### C4 — Tři bezpečnostní nálezy v `ludone-app` *(platí na produkci DNES)*

Čeká to od 20. 8. na tvoje svolení zapsat. S tímhle projektem nesouvisí, ale je to živé:

| Nález | Kde | Co to znamená |
|---|---|---|
| Deaktivace člověka **neodvolá** jeho přístupové klíče | `consents.ts:129` bez volajícího | Odejde ze firmy a klíč mu funguje dál |
| Prázdný výběr nástrojů vydá **plný** klíč | `mcp/actions.ts:90` (fail-open) | Kdo nic nevybere, dostane všechno |
| Rozsah firmy má jedinou větev | `business-roles.ts:166-181` | Jedna cesta = jedna chyba = plný přístup |

**Akce: zapsat do `LuDone/DAN-TODO.md` jako samostatný úkol.** Řekni, jestli to mám udělat.

### Plaud — kdy se přestane platit

A1 říká „přestat platit za Plaud, není to cílový stav ani přechodně dlouho“.
Migrace historie je řešitelná skriptem (`get_file` vrací surové MP3).
**Neurčené: kdy.** Doporučuju vázat to na zelené E6 (nahrávka doputuje na server bez
ručního zásahu), ne na kalendářní datum.

---

## 5. Co NEDĚLAT, i kdyby to vypadalo lákavě

- **Nesahat na Apple Developer Program (99 $/rok), dokud neproběhne E10.** Doporučení
  „začít bez placení“ zatím stojí na nezměřeném řetězu. Až bude P1/P2/P3, bude to jasné.
- **Nepouštět appku na ostrou schůzku, dokud není hotové D6.** Nahrávky, které vzniknou
  před právním rozhodnutím, se mažou hůř, než by nevznikly.
- **Nevěřit tvrzení „proklikáno“.** Dnešní `ui-smoke` používá programové `element.click()`,
  což obchází hit-testing, překryvy a z-order. Opravuje se v E2.
