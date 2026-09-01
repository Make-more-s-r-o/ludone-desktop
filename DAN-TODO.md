# Co musí udělat Dan — LuDone Desktop

Vzniklo 24. 8. 2026 z ultracode analýzy (9 agentů nad kódem, výzkumem a rozhodnutími).
Tenhle soubor obsahuje **jen to, co za tebe nikdo jiný neudělá.** Všechno ostatní je v `PLAN.md`.

Pravidlo: agent smí tvrdit, že něco funguje, jen když to změřil. Nic z tohoto seznamu
se změřit nedá bez tebe — druhé zařízení, sluchátka, restart Macu, peníze, právní rozhodnutí.

---

## 0. Noční běh je připravený — co k němu patří

Briéf: [`docs/behy/2026-08-24-zaklad-a-fronta.md`](docs/behy/2026-08-24-zaklad-a-fronta.md).
Spouští se **v nové session** přes `/beh` — briéf je soběstačný, konverzaci nepotřebuje.

**Ke spuštění od tebe nic nepotřebuju.** Ověřeno naostro: Codex jede (`EXIT=0`, `gpt-5.6-sol`,
CLI 0.149.1) · Orca orchestrace zapnutá · OAuth server LuDone živý s dynamickou registrací
(desktop si `client_id` vyžádá sám, žádný tvůj zásah) · Google Console beze změny.

**Tři věci, které neblokují start, ale blokují to, co přijde po něm:**

| | Co | Proč to nepočká donekonečna |
|---|---|---|
| 🔴 **1** | **Google Meet test** — půl dne, druhé zařízení | Jsi v Google ekosystému, takže Meet **je** ta platforma. A6 je vyřazovací kritérium a testoval se jen `afplay`. Připravím měřicí skript, ty pustíš hovor. **Dokud to neproběhne, stavíme na nezměřeném předpokladu** |
| **2** | **Kolik hodin audia měsíčně** zbude, až zmizí krabička od Plaudu | Jedno číslo. Určuje volbu přepisu, cenu za hodinu češtiny a jestli je v ní rozlišení mluvčích. Jde do dokumentace (etapa E8) |
| **3** | **Právní rámec** — souhlas účastníků a retence | Není to kód, je to hodina rozhovoru. Ale musí být **dřív, než vznikne první ostrá nahrávka** — pak už nahrávky existují a mažou se hůř, než by nevznikaly |

---

## 0a. 🔴 ROZHODOVACÍ BALÍK — deset otázek, jeden průchod

Plné znění i s trade-offy: [`docs/changes/desktop-v1/rozhodovaci-balik.md`](docs/changes/desktop-v1/rozhodovaci-balik.md).
**Když přijmeš doporučené defaulty, stačí říct „beru defaulty".**

| # | Otázka | Doporučeno | Blokuje |
|---|---|---|---|
| A1 | Kdy smí vzniknout první ostrá nahrávka | až po sepsání souhlasu a retence | 🔴 první použití, E9 |
| A2 | Koupit Apple Developer Program (99 $/rok) | NE, dokud neproběhne P1/P2 | 🔴 rozvoz (E10) |
| A3 | Potvrdit `gemini-3.5-transcribe` | ano, ale po ostrém testu na české hodinovce | 🟡 E9 |
| B1 | Kdo vidí čí nahrávky | vlastník + stejný company scope, ne „všichni všechno" | 🔴 serverový kontrakt (E5) |
| B2 | Nahrávky při odchodu z firmy | server zachová a odepře; desktop přestane nabízet, nemaže | 🔴 fronta (E6) |
| B3 | Retence na disku | 7 dní, nastavitelné | 🟡 nic |
| B4 | Přesun pravidel časovače do DB | NE teď; spec popíše chování při porušení jiným klientem | 🟡 nic |
| C1 | Zastaví se časovač s nahráváním | NE, jen nabídnout | 🔴 spec panelu |
| C2 | Samostatný vypínač pro čas | ano, dva | 🔴 E6 |
| C3 | Osud LuTracku | nerozhodovat, adaptér drží obě cesty | 🟡 nic |

🔴 **Šest z deseti blokuje spec nebo etapu.** Čtyři odložitelné mají default, který drží obě
budoucnosti otevřené — na ty spěch není.

---

## 0b. 🔴 Z běhu 1. 9. 2026 — co čeká na tebe

Plný záznam běhu: [`docs/behy/2026-09-01-masterplan-a-design.md`](docs/behy/2026-09-01-masterplan-a-design.md).
Rozhodnutí M1–M13 tam jsou vypsaná; **do `ROZHODNUTI.md` je zapíšu, až plán schválíš.**

### Rozhodnutí, bez kterých se nedá pokračovat

| # | Co | Proč to nejde za tebe |
|---|---|---|
| 🔴 **N1** | **Kam desktop píše hodiny** — přímo do Supabase pod RLS, nebo přes tenký endpoint na `app.ludone.cz`? | Supabase je hotová cesta a dědí celý řetěz do Tabidoo zadarmo, ale roznese přístupový klíč po noteboocích a přidá **třetího zapisovatele** do systému, kde jedinečnost běžícího timeru hlídá jen klient. Blokuje přihlašovací obrazovku, tvar položky fronty i zpracování chyb — postavily by se dvakrát |
| 🔴 **N2** | **Přesunout pravidla do DB, než se desktop připojí?** Parciální unikátní index na běžící timer a zákaz překryvů | Zásah do ostrého provozu 24 lidí. Bez toho musí spec výslovně popsat, jak se desktop zachová, když pravidla poruší jiný klient |
| **N3** | **Zastaví se časovač, když skončí nahrávání?** | Produktová otázka o tom, jak lidé pracují. Návrh v `LuTrack.dc.html` říká NE a navrhuje nabídnout „Zastavit i měření času?" |
| **Směr** | **Vyber jeden ze tří směrů panelu** | Bez toho se nedá zmrazit spec. Canvas: https://claude.ai/code/artifact/88609f77-b817-4d3f-99b6-1ea0af8f4f75 |
| **D7** | **Odhad desktopu** — `PLAN.md:60` říká 12,5–20 ČD, `PLAN.md:194` říká 14,5–23,5 a cituje třetí číslo 18–30 | 🔴 Ani jeden z těch odhadů nezná mrtvý kód fronty, nezapojený OAuth a nulovou serverovou stranu. **Kterýkoli odhad nad dnešním plánem je nižší než skutečnost** |

### Měření, která umím připravit, ale spustit je musíš ty

**🔴 A6 — Google Meet.** Měřidlo je hotové a ověřené (`scripts/meet-mereni.mjs`), referenční
nahrávka připravená (`dukazy/meet-2026-09-01/referencni.aiff`). Potřebuješ **druhé zařízení
a sluchátka**, asi hodinu.

```
node scripts/meet-mereni.mjs --priprav
```

Vypíše postup. Má **tři běhy**: ostrý, kontrola ticha, kontrola přeslechu. Bez kontrolních běhů
se výsledek nedá obhájit. Je to vyřazovací kritérium — kdyby dopadlo špatně, ušetří ti to všechnu
ostatní práci na projektu.

### Co jsem ti zapsal jinam a čeká to na tvou dávku

**Bezpečnostní nálezy C4** jsou expedované do `LuDone/DAN-TODO.md` — **zapsané, ale NECOMMITNUTÉ**.
V tom repu je merge do `main` fakticky nasazení na produkci, takže doc-only commit tam nepatří jako
vedlejší efekt cizí práce. Leží to tam jako změna v pracovním stromě.

### 🔴 Nález mimo rozsah tohohle projektu

**Pět edge funkcí LuTracku má vypnuté ověřování volajícího** (`verify_jwt = false` bez náhradní
kontroly) — mimo jiné ta, co sype týdenní souhrny do Tabidoo, a ta, co zastavuje zapomenuté
časovače. Kdokoli se znalostí project refu, který je v gitu natvrdo, je může spustit zvenčí.
**Ověřeno v repu, ne naostro.** S desktopem to nesouvisí; patří to majiteli LuTracku.

### Přístup ke Claude Designu

Odpoledne 1. 9. ses přepnul na jiný Claude účet a tím zmizel přístup k projektu **„LuDone Přístroj
Design System"** (`c5ee8498`), kde leží závazné zadání. Zálohoval jsem brief, kit README a barevné
tokeny do `design/zadani/`. **Nezálohovalo se:** `SmerA/B/C.jsx`, tři referenční návrhy z VPS,
`porovnani-navrhu.html` a zbytek tokenů (písmo, tvar, pohyb, mezery). Až se přihlásíš zpět,
stojí za to zálohu dotáhnout.

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

### ✅ D5 — Kalendář: server *(rozhodnuto 24. 8.)*

**Server čte Google Kalendář, appka jen zobrazí hotový seznam.** Sedí k A11 („aplikace je
spouštěč“), nepřidává nativní komponentu, u budoucího Windows ušetří 5–10 ČD a nevyžaduje
další TCC dialog navíc k záznamu obrazovky.

🔴 **Doplněno 24. 8.: napojení kalendáře se právě teď řeší v LuDone Hubu.** To mění etapu E7 —
desktop **nesmí stavět vlastní Google OAuth**, ale má konzumovat, co vzniká tam. Než E7 začne,
je potřeba zjistit: kde ta integrace bydlí, jaký má kontrakt, a jestli umí vrátit „dnešní schůzky
pro přihlášeného člověka“. Do té doby je E7 zablokovaná na cizí práci, ne na rozhodnutí.

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

### ⚠️ D7 — Sjednotit odhad desktopu v `PLAN.md`

`PLAN.md` má dva různé odhady desktopu: ř. 60 uvádí **12,5–20 ČD**, zatímco ř. 194
uvádí **14,5–23,5 ČD**. Rozhodni, který platí; žádné z těchto čísel se zatím nemění ani nemaže.

---

## 2b. Designové stopky — čtyři ze šesti rozhodnuté 24. 8.

Detail v [`specs/ED-design.md`](specs/ED-design.md). Zbylé dvě (D-A, D-C) se neřeší tabulkou —
varianty jsou nakreslené vedle sebe v canvasu a iteruje se nad nimi v Claude Design:
**https://claude.ai/code/artifact/870b288e-a46f-4c89-b3f3-3a1e93d58053**

| # | Stav | Rozhodnutí |
|---|---|---|
| **D-A** | 🟡 **otevřené** | **Písmo nadpisů** — varianty nakreslené vedle sebe v canvasu, iteruje se v Claude Design. Mockup má Schibsted Grotesk · Přístroj DS má Instrument Sans · `ludone-app` má licencovaný Brockmann (Přístroj ho záměrně nepoužívá) |
| **D-B** | ✅ **oba režimy podle systému** | Kód umí jen tmavý, mockup jen světlý — dělá se obojí. Pozor: mockupová `#1B7A43` je laděná na světlé pozadí a na tmavém propadá kontrastem, tmavý režim potřebuje vlastní světlejší odstín |
| **D-C** | 🟡 **otevřené** | **Barva akcentu** — varianty (zelená × indigová, světlý × tmavý) nakreslené v canvasu, iteruje se v Claude Design. Ať vyjde cokoli, zapisuje se **jen do `tokens/desktop.css`** — sdílený `tokens/colors.css` by přebarvil i `ui_kits/ludone-app` |
| **D-D** | ✅ **pokračovat automaticky, jen upozornit** | Nahrávání běží dál, žádný dialog. 🔴 **Pojistka proti scénáři „UI lže“:** hlásí se to **třemi nezávislými způsoby najednou** — trvalý proužek v panelu, který nejde zavřít, dokud nahrávání běží · změna ikony v liště na varovnou · záznam v manifestu sezení, aby se to poznalo i zpětně z archivu |
| **D-E** | ✅ **pauza se nedělá** | Se dvěma nezávislými rekordéry by nesynchronní pauza způsobila **trvalý posun mezi stopami**. Místo pauzy: **spojení dvou navazujících nahrávek** zpětně v archivu na webu (ne v appce) |
| **D-F** | ✅ **kalendář volitelný** | Bez kalendáře se dá nahrávat i měřit čas, jen se nezobrazí dnešní schůzky. Dnešní `disabled={!allGranted}` z appky dělá cihlu, když ho uživatel odmítne |

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

## 3a. 🔴 NÁLEZ Z 25. 8. 10:27 — `ui-smoke` je na `main` ČERVENÝ

Spustil jsem `bash scripts/akceptace/E2-sabotaze.sh`. Výsledek:

| Sabotáž | Výsledek |
|---|---|
| **a — odstraněná kontrola pořadí chunků** | ✅ **prošla správně**: test pod mutací spadl (1 failed), po obnově zelený. Brána umí zčervenat |
| **b — přejmenované tlačítko** | 🔴 **NESPUSTILA SE**: `STOP — nedotčená brána není zelená: ui-smoke před mutací` |
| **c — tiché měření se zvukem na pozadí** | ⛔ nedoběhlo, zastaveno u (b) |

**Příčina (b):** `scripts/ui-smoke.mjs:301` klikne na tlačítko **„Povolit"**, které v
`src/components/Onboarding.jsx` **neexistuje** — `grep` na něj vrací nulu. Etapa **E6** nahradila
atrapu oprávnění skutečným macOS API a tím změnila onboarding, ale `ui-smoke` s ní nikdo neposunul.

**Proč to CI nechytilo:** `ui-smoke` je v CI vypnutý (`if: ${{ false }}`), protože potřebuje GUI
a oprávnění, která runner nemá komu potvrdit. Je to tedy **správně navržené CI, které tuhle třídu
regrese z principu nevidí** — a přesně proto ta ruční měření v seznamu níž existují.

**Co s tím:** srovnat `ui-smoke.mjs` s novým onboardingem (jedna až dvě editace textů kroků),
pak teprve doběhne sabotáž (b) a (c). **Chování audio brány zůstává ⛔ neověřené**, dokud (c)
neproběhne.

⚠️ Sabotážní skript se zachoval správně: **odmítl měřit nad červeným baseline** místo aby vyrobil
nesmyslný výsledek, a strom po sobě uklidil do posledního bajtu (`git diff HEAD` prázdný).

**Potvrzeno nezávisle 25. 8. odpoledne** (druhá session, jiným postupem, stejný závěr) — a k tomu
**dvě pasti, kvůli kterým to vypadá na úplně jinou vadu**, než jaká to je:

1. 🔴 **`node scripts/ui-smoke.mjs` samo o sobě NIC nespustí.** Skript si aplikaci **nespouští** —
   čeká na už běžící instanci s `--remote-debugging-port=9333`. Bez ní vrátí
   `Timeout: nenalezen CDP target: hlavní panel (fetch failed)`, což vypadá, že **appka je
   rozbitá**, ne že chybí tlačítko. Správně se pouští tak, jak to dělá `spust_ui_branu`
   v `scripts/akceptace/E2-sabotaze.sh`: `LUDONE_E2E=1 LUDONE_RESET_ONBOARDING=1
   LUDONE_DATA_DIR=<tmp> "release/LuDone Desktop.app/Contents/MacOS/Electron"
   --remote-debugging-port=9333 &` a **teprve pak** `node scripts/ui-smoke.mjs`.
2. 🔴 **Osiřelá instance aplikace tiše zabije každou další.** `electron/main.cjs:197` volá
   `requestSingleInstanceLock()` a na ř. 199 `app.quit()`. Druhá instance tedy skončí
   **exit 0 bez jediné chybové hlášky** — vypadá to jako čistý konec, ne jako kolize. Zůstane-li
   po nedokončeném běhu viset `npm start` (osiřelý, `PPID 1`), neproběhne pak **žádný** ui-smoke
   a příčina není nikde vidět. Než začneš cokoli ladit:
   `ps aux | grep "[l]udone-desktop.*Electron"` musí být **prázdné**.

---

## 3b. Co zbylo z nočního běhu 25. 8. — nálezy review, které jsem NEOPRAVIL

Běh dokončil všech osm etap a všech devět bran je zelených. Tři nezávislí skeptici pak
prošli hotovou práci a **všichni tři vrátili VRATIT**. Nálezy, které byly mechanické nebo
bezpečnostní, jsem opravil ve dvou kolech (`fa794ce` a další). **Tyhle zbývají — každý
jsem ověřil, že platí, ale opravit je za tebe nemůžu.**

| # | Co | Proč to nechávám tobě |
|---|---|---|
| 🔴 **1** | **Autoritou stavu ikony v liště zůstává renderer.** Hlavní proces sice eviduje `recordingSessions`, ale tray z nich stav neodvozuje — dostane ho zprávou z okna. Pád nebo zamrznutí rendereru tedy nechá v liště **falešný stav** („nahrává se", i když ne) | Je to **architektonická změna**, ne oprava: autorita se musí přesunout do hlavního procesu a tray odvozovat ze sessions. Chci na to tvoje ano, protože to mění, kdo o stavu rozhoduje |
| 🔴 **2** | **Ikona v liště se vyrábí z SVG data URL** a uložené měření pro tohle Electron prostředí říká, že ta cesta vrací **prázdný `nativeImage`**. Testy i brána přitom kontrolují jen textový stav, ne vykreslenou ikonu | **Nemám jak to změřit** — potřebuje spuštěnou aplikaci na tvém Macu a lidské oko. Až appku pustíš, podívej se, jestli ikona v liště **vůbec je vidět**. Když ne, je to tohle |
| 🔴 **3** | **Helper procesy v bundlu mají generické Electron bundle id.** Hlavní bundle už je správně `cz.ludone.desktop`, ale čtyři helpery ne | Souvisí s **TCC a podpisem** — tedy s tím, komu macOS přiděluje oprávnění. Sahat na identitu procesů bez tvého vědomí nechci, zvlášť když se kvůli tomu resetují udělená oprávnění |
| **4** | **Onboarding tvrdě blokuje**, když je systémový zvuk odmítnutý — nepustí dál ani uživatele, který má povolený mikrofon. Specifikace přitom dovoluje pokračovat s trvalým varováním | Je to **UX rozhodnutí** a spadá pod otevřenou otázku **O1** (výtvarný směr). Běh měl zakázáno sahat na vzhled |
| **5** | **Výchozí cesta k identitě uživatele v `electron/auth.cjs`** hledá jméno a e-mail přímo v odpovědi s tokenem. Proti skutečnému LuDone endpointu to podle reviewera neprojde | **Nemám jak ověřit** bez živého přihlášení, které by otevřelo prohlížeč a čekalo na tebe. Až budeš přihlášení zkoušet naostro, tohle spadne první |
| **6** | **Brány etapy E2 měří místy jen přítomnost textu.** Např. „CI vysvětluje vypnuté smoke testy" projde i nad souborem, kde je jen komentář a žádný job | Není to díra, kterou by šlo zneužít — je to **slabina měřidla**. Opravit ji znamená rozhodnout, jak přísné brány chceš; to je tvoje volba, ne moje |

⚠️ **Co z toho plyne prakticky:** body 1 a 2 jsou jediné, které můžou zkazit dojem z první
ostré zkoušky — ikona buď nebude vidět, nebo bude ukazovat nesmysl. Zbytek počká.

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
