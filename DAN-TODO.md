# Co musí udělat Dan — LuDone Desktop

## 🔴 PRVNÍ VĚC PO PROBUZENÍ — GitHub Actions nám zastavil CI (změřeno 2. 9. v 15:57)

**Žádný PR se nedá zelený a tím pádem se nedá nic mergnout.** Není to vada v kódu —
brána se vůbec nespustí. GitHub k tomu říká doslova:

> The job was not started because recent account payments have failed or your spending
> limit needs to be increased. Please check the 'Billing & plans' section in your settings

Změřený předěl: **14:30 běh na `main` ještě prošel, v 15:57 už se nespustil.** Zopakoval
jsem to dvakrát, pokaždé stejně — trvalé, ne výpadek.

**Co s tím musíš udělat ty:** Billing & plans na GitHubu (Make-more-s-r-o) — buď dorovnat
platbu, nebo zvednout spending limit. Je to peníze a cizí účet, takže na to nesahám.

**Co to blokuje:** PR **#25** (export schůzky do jednoho souboru) je hotový a čeká otevřený.
Lokálně mám `lint=0`, `typecheck=0`, `build=0` a **426 zelených testů** — a `npm run gates`
v CI je přesně `lint && typecheck && test:unit`, tedy totéž. Chybí jen razítko z CI, ne práce.
🔴 **Nemergoval jsem to** — merge s červenými checky by bylo obcházení brány.

Až billing spravíš, stačí `gh run rerun` na posledním běhu; nic se nemusí dělat znovu.

**Než zaplatíš, mrkni na PR #28** — snižuje naši spotřebu Actions ~20× (runner Linux místo
macOS, který je 10× dražší a nic macOS-specifického tam neběží; a konec dvojích běhů
z `push` + `pull_request`). Možná zjistíš, že limit stačí i bez navyšování.

**Varianty, kdyby se ti platit nechtělo:** vlastní runner na tvém Macu (zdarma, a jen tak
půjdou někdy spustit smoke testy, na které GitHubí runner nemá zvuk ani oprávnění), nebo
zveřejnit repo (Actions zdarma — ale je to firemní kód, nedoporučuju).

---

## ✅ VYŘEŠENO 2. 9. — ikona v liště (bývalá první položka)

Prázdná ikona v horní liště je **opravená a v `main`** (PR #24, commit `51d1b5b`): osm PNG
souborů v `electron/ikony/` a `nativeImage.createFromBuffer` místo SVG, které Electron 37
nedekóduje.

⚠️ **Pořád to ale nikdo neviděl běžet.** Ty jsi mi psal „ikonu v horní liště nevidím" —
potřebuju od tebe potvrzení, že je po téhle opravě vidět. To je jediná věc, která z 🧪
udělá ✅.

---

---

## 🔴 DVĚ VĚCI OD TEBE (rozhodnuto 2. 9. večer)

### 1. 🛑 PŘEPNUTÍ NA PUBLIC ZASTAVENO — nový nález (2. 9. ve 21:15)

**Nepřepínej to, dokud si nepřečteš tohle.** Rozhodnutí BD-N41 platí v záměru, ale změnil se
podklad: serverová session upozornila na věc, kterou jsem sám neměřil, a měla pravdu.

**V `DAN-TODO.md` (ř. 1075–1108) je podrobný popis toho, že `/uploads/**` na produkci
nevyžaduje přihlášení** — konkrétní cesty, `PUBLIC_PATHS` v `src/proxy.ts:19`, číslo řádku
s jedinou zakázanou předponou. Ty tři veřejné prefixy jsi schválil vědomě, takže to **není
díra**; ale zveřejnit k tomu návod je jiná věc než mít to tak. A netýká se to desktopu,
ale `ludone-app`.

🔴 **Pročištění souborů to NEVYŘEŠÍ.** V historii je `/uploads/` **15×** a historie je
u veřejného repa veřejná taky.

**Varianty (rozhodni ráno, na noc to nemá vliv):**

| | co to je | cena |
|---|---|---|
| **A** | zůstat privátní, spravit billing | peníze; ale PR #28 sráží spotřebu ~20×, možná limit stačí |
| **B** | přepsat historii (`git filter-repo`) a pak public | rozbije 4 otevřené PR a všechny klony |
| **C** | nový veřejný repozitář se slitou historií | čisté, ale ztratí 226 commitů provenience |
| **D** | public i s tím | ⚠️ nedoporučuju — je to cizí systém, ne jen náš |

**Na noční práci to nemá vliv** — stavím a skládám PR bez ohledu na to; merge počká na ráno.

### 1b. Původní zadání (platí, až se rozhodne výš)

Rozhodl jsi „public, ale docs napřed pročistit" (BD-N41). Pročištění běží; **až ti ho ukážu,
přepni to.** U veřejných repozitářů jsou Actions zdarma a bez limitu minut, a **GitHub
Releases** je rovnou distribuční kanál i feed pro aktualizace.

```
gh repo edit Make-more-s-r-o/ludone-desktop --visibility public --accept-visibility-change-consequences
```

🔴 **Zveřejní se i celá historie**, ne jen současné soubory. Změřeno, co v ní je:
`labs.ludone.cz`, `data.ludone.cz`, `/opt/ludone-uploads{,-prod}`, `/opt/ludone-app`.
Dva hostnames a tři cesty, **žádné přihlašovací údaje** (gitleaks nad 204 commity: jediný
nález je falešný token v ukázce). Doporučení: přijmout — nulová stopa by stála přepsání
historie a rozbití otevřených PR.

### 2. Koupit Apple Developer (99 USD/rok)

Bez něj **nejde podpis ani automatické aktualizace** — macOS nepodepsanou a nenotarizovanou
aplikaci po stažení odmítne slovy „je poškozená". Rozhodl jsi to postavit pořádně (BD-N42).

Do koupě se staví všechno, co na podpisu nezávisí: konfigurace `electron-builder`, kanál
aktualizací, verzování. Podpis a notarizace jsou poslední krok, ne první.

---

## 🔴 IKONA V LIŠTĚ — příčina nalezena, a není naše (2. 9. ve 21:35)

**Tvoje horní lišta je plná.** LuDone se do ní nevejde a macOS to nikde neohlásí.

### Co jsem změřil, než jsem to prohlásil

| měření | výsledek |
|---|---|
| obrázek ikony | `isEmpty=false`, 18×18, 427 B PNG, alfa 54 % krycích pixelů — **v pořádku** |
| tvar ikony | vykreslený alfa kanál dává čitelnou bublinu s přeškrtnutím — **v pořádku** |
| `tray.getBounds()` v běžící aplikaci | `{x:599, y:0, width:34, height:33}` — macOS tvrdí, že ji umístil |
| lišta sejmutá před a po spuštění | **numericky identická** přes celou šířku, po 200px pásech |
| text vedle ikony (`setTitle`) | rozměry narostly na 145 px, **text se taky nevykreslil** |
| správce lišty (Bartender, Ice…) | žádný neběží |
| počet displejů | jeden |
| **klik na hlášené souřadnice** | trefil **`menu bar 1 of application process Orca`** |

Ten poslední řádek to rozhoduje: na místě, kam macOS naši ikonu „dal", je ve skutečnosti
**oblast aplikačního menu**, ne pás stavových ikon. Systém položku přijme, přidělí jí
souřadnice, ohlásí nenulové rozměry — a **nevykreslí ji**, protože vpravo od výřezu už je
obsazeno (napočítal jsem tam ~14 ikon).

### Co s tím uděláš ty (5 sekund)

**Ukonči jednu aplikaci v horní liště** — třeba Notion nebo přehrávač — a LuDone se objeví.
Nebo si nainstaluj správce lišty (Ice je zdarma), který schované položky zpřístupní.

### Co s tím uděláme my

🔴 **Aplikace se dnes tváří, že běží v pořádku, i když ji uživatel nikde nevidí.** To je vada,
i když příčina je v systému — nový uživatel s plnou lištou usoudí, že LuDone nefunguje.
Zapsáno jako práce: po startu porovnat `tray.getBounds().x` s pásem stavových ikon a při
podezření otevřít okno s vysvětlením místo tichého mlčení.

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

---

## Před nočním během / ráno po něm (1. 9. 2026)

**Rozhodnutí, která běh udělal za tebe** — všechna jsou zápis, ne beton:

- **Návrhy šesti sekcí masterplánu se nevložily do zmrazeného specu.** Skeptická revize v nich
  našla nepravdy (neexistující `app.getAppLogsPath()`, číslo odvozené z poloviny vlastní citace,
  brána zelená tím, že nic nenajde). Leží v `docs/changes/desktop-v1/sekce-navrhy/` i s revizemi.
  Do specu šlo jen pět pravidel, která revizi přežila — `spec.md` §11.
- **Třináctý agent workflow se zasekl** (20 minut bez zápisu) a byl zastaven. Dvanáct výsledků
  je v hrsti, chybí jedna skeptická revize sekce „journeys/IA". Ta sekce se stejně nevkládá.

**Čeká to na tebe:**

- 🔴 **Změřit A6 na skutečné schůzce.** `node scripts/schuzka-mereni.mjs` — potřebuje živý hovor
  a sluchátka. Do té doby je nahrávání systémového zvuku `tests-green`, ne ověřené. **A vzniklý
  zvuk necommituj** — `.gitignore` to teď blokuje, ale ať to víš proč: je v tom cizí hlas.
- 🔴 **B12 migrace** — jeden běžící časovač na člověka a zákaz překryvů. Zásah do živé databáze
  24 lidí a **na tabulce s existujícími překryvy migrace selže**. Nejdřív změřit, kolik jich tam
  je, pak rozhodnout, co s nimi. Noční běh to nedělá.
- **A2 — Apple Developer Program (99 $/rok).** Doporučení zůstává NE, dokud neproběhne P1/P2.
  Bez něj se ale nedá nic rozvézt týmu, takže tohle blokuje rozvoz, ne vývoj.
- **Pět edge funkcí LuTracku běží s `verify_jwt = false`.** Cizí systém, patří jeho majiteli.
- **Podklady z Claude Designu** — `/design-login` umíš spustit jen ty. Schválený návrh je
  kompletní lokálně; chybí jen tokeny mimo barvy (písmo, tvar, pohyb, mezery). **Až úplně
  nakonec**, jak jsi řekl.
  ⚠️ **OPRAVA 2. 9. ráno: včerejší věta „artefakty jsou pryč" byla přestřelená.**
  Změřeno teď: MCP `claude-design` se připojí, ale volání vrací `needs_design_scopes`
  — *„This token doesn't include Claude Design access. Run /design-login and retry."*
  **Token nemá právo, což není totéž jako smazaný artefakt.** Ta hlášky o ukončeném
  sledování („no such artifact for this account") vypadá stejně v obou případech.
  **Nejdřív spusť `/design-login`**, teprve pak se dá říct, jestli se něco ztratilo.
  Rozdíl je velký: přihlásit se je minuta, vytvořit design znovu je den.

  Původní (zřejmě nadsazený) zápis z 1. 9.:
  🔴 **Artefakty v Claude Designu už pro tenhle účet NEEXISTUJÍ. Ani jeden.**
  Přišla dvě oznámení, že sledování skončilo: „Přístroj LuDone" (`88609f77-…`) ve 22:0x
  a „Přístroj — startovací čára" (`638ea0b2-…`) ve 23:0x. Obojí nenalezeno (smazané, nebo
  nesdílené s tímhle účtem po přepnutí). **Nejde tedy o jeden ztracený artefakt, ale o celou
  sadu** — takže to nebude „stažení", ale **vytvoření znovu**, a tokeny mimo barvy se
  odtamtud vzít nedají vůbec.
  ⚠️ Praktický důsledek: buď je dopíšeme z artboardů ručně (jsou lokálně v `design/navrh/`),
  nebo se design systém založí nanovo. Rozhodni, až na to dojde — **nic to teď neblokuje.**

---

## 🔴 NÁLEZ 1. 9. 22:07 — B2 není přejmenování v próze

Noční běh se zeptal na mapu starých čísel na nová a při ověřování se ukázalo, že **B2 je
mnohem rizikovější, než jak ho `plan.md` odhaduje („0 řádků kódu")**. Změřeno:

| Co | Kolik |
|---|---|
| Odkazů na `E<číslo>` v `.md`, `.sh`, `.mjs`, `.yml` | **377** |
| Souborů, které mají E-číslo **v názvu** | **22** — `specs/E5-server-prijem.md`, `scripts/akceptace/E7.sh`, … |
| Míst s proměnnou `LUDONE_E2E` | **8** |
| Sabotážních markerů zapsaných **do produkčního kódu** | `E2_SABOTAZ_CHUNK_ORDER_REMOVED`, `E2_SABOTAZ_STOP_NAHRAVANI`, `E2_SABOTAZ_AUDIO_CONTAMINATION` |

**Tři pasti, každá tichá:**

1. 🔴 **`LUDONE_E2E` obsahuje řetězec `E2`.** Nedbalé `s/E2/B2/g` z něj udělá `LUDONE_B2E`
   a rozbije `audio-smoke.mjs` i `E2-sabotaze.sh` — bez chybové hlášky, jen přestane platit
   podmínka a test se začne chovat jinak.
2. 🔴 **Sabotážní markery se zapisují do `electron/main.cjs` a pak se na ně grepuje.**
   Přejmenování jen na jedné straně znamená, že sabotáž **tiše přestane měřit** — přesně ta
   třída vady, kvůli které v tomhle repu existuje pravidlo o kanárkovi.
3. ⚠️ **22 souborů má číslo v názvu.** Přejmenování souboru rozbije odkazy z ostatních
   dokumentů a z `.sh` skriptů, které je volají cestou.

**Doporučení: B2 dnes v noci NEDĚLAT.** Má nulovou produktovou hodnotu (je to konzistence
značení) a nejvyšší poměr rizika k užitku ze všech stories. Přejmenování 377 míst včetně
názvů souborů a markerů v produkčním kódu patří do samostatného PR za denního světla,
kde se dá projít očima — ne do noční vlny vedle skutečné práce.

`plan.md` §2 to ostatně už říká: *„B2, B10 a B12 mají soubory neurčené a nesmí se pouštět,
dokud se neurčí."* Tenhle nález je důvod, proč to platí silněji, než jak to bylo míněno.


---

## 🔴 ROZHODNUTÍ NOČNÍHO BĚHU 1./2. 9. 2026 — co jsem udělal za tebe

Tenhle oddíl píše noční implementační session. **Tichý default je vada**, takže tady je
vypsané každé rozhodnutí, které jsem udělal místo tebe, i s tím, co bys musel udělat,
kdybys ho chtěl zvrátit.

### BD-N1 — B2 se dnes v noci NEPOUŠTÍ

**Rozhodl jsem: přeskočit.** Souběžná session změřila rozsah (nález 22:07 výš: 377 odkazů,
`LUDONE_E2E` obsahuje `E2`, tři sabotážní markery v produkčním kódu, 22 souborů s číslem
v názvu). Je to jediná story vlny 1 s nulovou produktovou hodnotou a nejvyšším rizikem,
a `plan.md` §2 ji sám označuje jako story s neurčenými soubory.

**Kdybys to chtěl jinak:** je to samostatný PR za denního světla, ne noční práce.

### BD-N2 — B4 se zastaví na hranici hlavního procesu

**Rozhodl jsem: rozdělit vadu (c) a postavit jen strojovou půlku.**

Zmrazený `plan.md` §2b dává B4 soubory `electron/auth.cjs` a `electron/main.cjs`. Ale třetí
vada („čekání nemá konec ani únik") žije **z poloviny v rendereru** — změřeno naostro:
`src/components/Onboarding.jsx:174` drží `authBusy ? "Čekám na prohlížeč…" : "Přihlásit
v prohlížeči"`. Odpočet, tlačítko Zrušit a adresa k ručnímu zkopírování jsou tedy JSX.

Ten soubor přitom **paralelně vlastní story B1** (dostává `data-testid`). Dva zapisovatelé
v jednom souboru dělají důkaz neplatným, i když oba doběhnou úspěšně.

**Takže:** B4 staví konec čekání, zrušení a dostupnost adresy v hlavním procesu; viditelnou
půlku nechává být. **Neopravoval jsem zmrazený plán za pochodu** — tím by se ztratilo, že
se rozhodnutí změnilo.

🔴 **Mezera, kterou to nechává:** po B4 má čekání konec strojově, ale člověk pořád vidí jen
„Čekám na prohlížeč…" bez odpočtu a bez úniku. **Doporučený default: samostatná story B4b**
(renderer, po mergi B1 i B4), odhad do 60 řádků diffu.

### BD-N3 — `--display-name` u Orca worktree v téhle verzi neexistuje

Drobnost, ale `CLAUDE.md` i `BEH-NOC.md` ho uvádějí jako platný přepínač. Ověřeno naostro:
`orca worktree create --display-name` vrací `invalid_argument — Unknown flag`. Worktrees
jsem tedy založil jen s `--name` (`orca/desktop-b1`, `orca/desktop-b4`).

**Pro tebe:** až se bude `CLAUDE.md` příště upravovat, ten přepínač z pravidla 1b vyhodit
nebo nahradit tím, co ta verze Orcy umí.

### BD-N4 — závislosti ve worktree jsem vyřešil symlinkem

Codexův sandbox **nemá síť** (ověřeno v skillu `codex-delegace-orchestrace`), takže si
`npm ci` ve worktree spustit nemůže. Nalinkoval jsem `node_modules` z kořenového checkoutu.
Ověřeno naostro ve worktree `desktop-b1`: `lint` EXIT=0 · `typecheck` EXIT=0 ·
`test:unit` **77 zelených**.

**Pozor při úklidu:** ty symlinky odkazují do hlavního checkoutu. `orca worktree rm` je
odstraní s worktree, ale kdyby někdo mazal ručně, `rm -rf` na worktree by šel po symlinku.

---

## 🔴 STOPKA PRO TEBE — `ui-smoke` nedojede do zelené bez tvého kliknutí (1. 9. 22:38)

**Oprava B1 funguje.** Původní pád na `ui-smoke.mjs:301` (tlačítko „Povolit", které po E6
neexistovalo) je **pryč** — test projde celým onboardingem. Padá až o šedesát řádků dál:

```
Error: Timeout: text „Obě stopy ověřeny"
  ... "Nahrávání se nespustilo: systémový zvuk: Permission denied."
  at ui-smoke.mjs:364
```

Změřeno **dvakrát** (ve worktree i v hlavním checkoutu, `package:mac` EXIT=0, aplikace naběhla).

**Příčina není v kódu.** Balíčku `release/LuDone Desktop.app` macOS neudělil **Nahrávání
obrazovky** — a to je oprávnění, které nejde udělit programově. Musí ho odklepnout člověk.

### Co udělat (dvě minuty)

1. **Nastavení systému → Soukromí a zabezpečení → Nahrávání obrazovky**
2. Přidat `release/LuDone Desktop.app` (v repozitáři, `⌘⇧G` a vlož cestu) a **zapnout**
3. Ověřit: `npm run package:mac && node scripts/ui-smoke.mjs` — má dojít až na „Obě stopy ověřeny"

⚠️ **Electron dokumentuje, že po změně oprávnění je nutný restart aplikace**, takže když to
napoprvé nezabere, nespěchej hlásit vadu — zavři appku a spusť znovu.

### Co se kvůli tomu NEUDĚLALO

Druhá půlka cíle B1 — **doběhnout sabotáže (b) a (c)** v `E2-sabotaze.sh`. Ta brána správně
odmítá měřit nad červeným baseline, jen ta červená má teď **jinou příčinu** než ráno.
Noční běh místo toho měří **posun místa selhání** (sabotáž musí shodit test dřív a jinou
hláškou než reference) — je to poctivý důkaz, že kontrola kouše, ale **není to náhrada**.
Až oprávnění udělíš, doběhne to normálně.

---

## Kalendář: schválil jsi jeho zrušení, ale nikdo ho neodstraňuje (nález 1. 9. 22:4x)

Rozhodnutí M15/M16 kalendář ruší a `design/approved.json` to má v `explicitlyCut`. Komponenta
`src/features/calendar/TodayAgenda.jsx` ale **žije dál** a `scripts/ui-smoke.mjs` ji na pěti
místech **vyžaduje**. Žádná story B1–B12 ji neodstraňuje — **díra v plánu, ne v designu**.

**Rozhodl jsem za tebe (bezpečný default):** dnes v noci se kalendář **neodstraňuje** (je to
user-visible změna bez packetu = hard gate) a vzniká story **B13** na později. Detail
a odůvodnění pořadí je v `decisions.md`, O14.

**Co po tobě chci:** až se na to podíváš, potvrď, že B13 má vzniknout — nebo řekni, že
kalendář má zůstat, a pak je potřeba změnit `approved.json`, ne kód.


### BD-N9 — brána IPC kanálů má díru, kterou nezavedl tenhle běh

Nezávislé review B3 našlo v `tests/ipc-sender-guard.test.js` slabinu, která tu byla **už
předtím**: kontrola drží úplný výčet dvanácti IPC kanálů, ale **nevidí dynamickou registraci**
`ipcMain.on(channel, ...)` s proměnnou místo doslovného řetězce. Druhá, pozdější deklarace
`onValidated` může za běhu guard obejít, zatímco textová kontrola dál čte tu první, bezpečnou.

**Neopravoval jsem to v B3** — není to vada, kterou tenhle běh způsobil, a rozšiřovat kvůli ní
rozsah bezpečnostní brány uprostřed noci by znamenalo sáhnout na měřidlo, které zrovna používám
k měření jiné práce.

**Doporučený default:** samostatná drobná story — zakázat každou syrovou registraci `ipcMain`
mimo jediný validační modul, a to kontrolou nad AST, ne regulárním výrazem nad textem.
Odhad do 60 řádků diffu včetně testu.

### BD-N11 — `orca-codex.sh` srazí dva joby spuštěné v téže vteřině

**Změřeno naostro 2. 9. 2026 v 00:32.** Spustil jsem B6 a B7 hned po sobě a **oba dostaly
tentýž log i tentýž soubor s odpovědí** (`codex-1788297166`). Skript pojmenovává výstupy
časovým razítkem **v sekundách**, takže dva starty ve stejné vteřině sdílejí obojí.

**Proč to bolí:** práce na disku se nesrazí (každý job má svůj worktree), ale **output contract
druhého jobu přepíše ten první** — a to je jediné místo, kde se dozvíš `premisaPlatila`,
očekávané počty testů a recept na sabotáže. Ztratí se tiše; ve výpisu to vypadá, že se
spustil jen jeden job.

**Jak to poznáš:** `orca-codex.sh start` vrátí u obou spuštění **stejnou cestu k logu**.
Kdo si toho nevšimne, čeká na dvě odpovědi a dostane jednu.

**Co jsem udělal:** druhý job jsem zabil (ztráta ~1 minuta) a spustil ho znovu vlastním
launcher skriptem s explicitní cestou k logu, panel v Orce přes `orca terminal create`.
Sandbox i síťová klec zůstávají — `-s workspace-write` visí na `codex exec`, ne na Orce.

**Doporučený default:** do `orca-codex.sh` přidat do názvu logu ještě PID nebo náhodný přípon
(`codex-<ts>-$$.log`). Do té doby: **mezi dvěma starty počkej vteřinu, nebo si log pojmenuj sám.**

### ~~BD-N13~~ — dva nálezy z adversariálního review · ✅ OBA OPRAVENY (2. 9., vlna 5)

Review tří otevřených PR (4 čočky, 52 agentů, každý nález ověřen dvěma nezávislými skeptiky)
vrátilo **9 potvrzených nálezů z 24**. Sedm je opravených v příslušných PR; tyhle dva ne,
protože patří jinam než k práci toho běhu.

**1. Test čítače přihlášení měří ROZHODNUTÍ, ne ZAPOJENÍ** (`tests/auth-panel-blur-guard.test.js:45`).
Sestaví si vstupní objekt a sám zavolá čistou funkci `shouldHidePanelOnBlur`. **Nic v celé
sadě nehlídá, že blur handler na `main.cjs:342` ten čítač do volání opravdu předá.** Zbylé
dva testy v souboru jsou strukturální regexy nad textem.

Je to **tatáž třída, kterou tenhle běh potkal třikrát** (tray přepočet, klíč proti duplikaci,
kanárek měřící komentář). Oprava patří k testu založenému v `04e87fc`, ne k B4.
**Doporučený default:** test, který blur handler skutečně zavolá s podstrčeným čítačem.

**2. Počítadlo mutací hlídá jen ČLENSTVÍ ve dvou mapách** (`tests/tray-authority.test.js`).
`hasLiveRecording()` čte **čtyři** fakta — kromě členství taky `preparation.cancelled`
a `recordingSession.finalizePromise`. Obě se mění mimo hlídané vzory, takže by mohlo přibýt
šesté místo, které lištu nepřepočítá, a počítadlo by mlčelo.

**Doporučený default:** rozšířit počítadlo o obě přiřazení. **Nedělal jsem to dnes v noci**,
protože B3 už má za sebou dvě kola oprav a třetí zásah do téhož měřidla bez klidné hlavy je
přesně ten způsob, jak se do brány zanese chyba.

🔴 **Patnáct nálezů review VYVRÁTILI skeptici** — mimo jiné tvrzení, že zpřísněný kanál faktů
je fail-open, že se `abort` posluchač připojuje pozdě, a že oprava B1 vzorkuje stav jen jednou.
Ověřovací kolo tedy dělalo svou práci oběma směry, ne jen potvrzovací.

### ~~BD-N14~~ — B9 nebyla bezpečnostně dokončená · ✅ VYŘEŠENO v PR #10 (B9b)

Vykonavatel B9 si udělal vlastní bezpečnostní průchod a **sám oznámil**, že diff nelze označit
za hotový. To je přesně to chování, které od něj chceme — a proto to nezastírám.

| nález | dopad |
|---|---|
| **Race `auth:begin` × `auth:logout`** | odhlášení v průběhu přihlašování může nechat platnou session, nebo naopak zahodit právě získanou |
| **Chybí deadline u discovery a revoke** | zaseknutá serverová odpověď zablokuje odhlášení bez konce |
| **Možné zbylé `.oauth.enc.*.tmp`** | po pádu během zápisu může na disku zůstat dočasný soubor se session |

**Neopravil jsem to a je to vědomé rozhodnutí.** Tři důvody:

1. Oprava sahá do bloků, které vlastní **B8**, nebo vyžaduje persistenci — tedy rozšíření
   rozsahu uprostřed noci.
2. **Nedá se ověřit naostro.** Bez `LUDONE_OAUTH_CLIENT_ID` se přihlášení ani nepokusí, takže
   souběh přihlášení a odhlášení nemám jak vyvolat.
3. Je to autentizace. Improvizovaná noční oprava bez živého ověření je přesně to, čím se
   bezpečnostní chyby zanášejí.

**Doporučený default:** samostatná story **B9b** — jeden zámek přes obě operace, deadline na
discovery i revoke, úklid dočasných souborů při startu. Odhad do 120 řádků včetně testů.
**Musí se dělat až s možností ověřit to naostro**, tedy po zřízení statického OAuth klienta.

### BD-N15 — chyba v MÉM zadání, ne v práci vykonavatele

Společný dodatek pro vlnu 4 tvrdil, že **B3 je hotová v každém stromě**. Není: `b9` stojí na
`b8` → `b4` → `main`, kdežto **B3 je sourozenecká větev**, ne předek. Vykonavatel B9 to změřil,
napsal `premisaPlatila: false` a rozdíl vypsal — takže se nic nerozbilo.

**Ponaučení:** u stohovaných větví nestačí napsat „tyhle story jsou hotové". Musí se napsat,
**KTERÉ jsou v TOMHLE stromě** — jinak vykonavatel hledá kód, který tam z principu není,
a v horším případě si ho dopíše podruhé.

### ✅ Vlna 5 uzavřela BD-N13 i BD-N14 — co se změnilo

**BD-N13 bod 1** (test čítače přihlášení měřil rozhodnutí, ne zapojení) — opraveno na `b4`.
Nová kontrola porovnává **parametry funkce s klíči, které jí volající skutečně předává**, takže
chytí obojí: když volající pole vypustí, i když funkce dostane parametr, který jí nikdo neposílá.
Obě sabotáže padají právě na ní.

**BD-N13 bod 2** (počítadlo mutací hlídalo dvě fakta ze čtyř) — opraveno na `b3`. Doplněno
o `preparation.cancelled` a přibyl **test pořadí**: přepočet musí stát **za** smyčkou, protože
před ní by viděl stav, kde část session ještě nemá přiřazenou finalizaci.

**BD-N14** (race `auth:begin` × `auth:logout`, chybějící deadliny, zbylé dočasné soubory) —
vyřešeno v **PR #10**. Fail-closed zámek, při souběhu vyhrává odhlášení; deadliny 5 s na
discovery i revoke s pravdivým `serverRevoked: false` při timeoutu; úklid tempů podle striktního
UUIDv4 vzoru, který nechá `oauth.enc` i cizí soubory být.

🔴 **Co tím NEZMIZELO:** živé chování proti serveru je pořád **⛔ neověřené** a bude, dokud
nebude `LUDONE_OAUTH_CLIENT_ID`. Deadliny 5 s jsou **inženýrská volba, ne měření** — vykonavatel
to sám takhle označil. A zůstává přiznaný okrajový případ: při exotické chybě `chmod`/`fsync`
po úspěšném `rename` může souběh poslat revokaci dvakrát (idempotentní, fail-closed).
---

## 🔴 B6 — výběr projektu blokuje chybějící stav vypínače v rendereru

Předpoklad o dokončené B5 platí jen zčásti: `electron/tracking.cjs` existuje a preload
vystavuje `tracking:start`, `tracking:switch-project`, `tracking:stop` a
`tracking:get-state`. Hodnota `DESKTOP_TIME_ENABLED` ale zůstává jen v hlavním procesu;
`tracking:get-state` vrací samotný perzistentní stav časovače a renderer z něj nepozná,
zda je časová agenda zapnutá.

**B6 proto nepokračovala do produkčního kódu.** Bez změny v `electron/main.cjs` nebo
`electron/preload.cjs`, které B6 podle pracovního výkladu vlastnictví nevlastní, by musela
buď nabízet projekty i při vypnutém flagu, nebo zůstat trvale fail-closed a nenabídnout nic.
Obě varianty porušují R18 a předepsanou pozitivní kontrolu. Doporučený default pro vlastníka
B5: vystavit rendereru jen neměnnou informaci, zda je časová agenda zapnutá; neposílat tím
žádná další data ani business pravidla.

**Rozpor vlastnictví OQ-5:** `docs/changes/desktop-v1/plan.md:170` a
`podklady-vytezene.md:172` připisují B6 zásahy do `main.cjs`/`preload.cjs`, zatímco
`plan.md:147` a tabulka vlastnictví bloků B6 žádný takový blok nedávají. Tento běh použil
bezpečnější druhý výklad a do obou souborů nesáhl.

**Money hranice OQ-2:** aktuální zadání výslovně říká, že se smějí nabízet jen projekty
s platnou alokací a čerpáním **pod 110 %**. To je pro tento běh nadřazené pracovní rozhodnutí,
ale zmrazený `spec.md` R7 stále říká „nad 110 % je zašedlý a s důvodem“ a `plan.md:147`
říká, že přečerpaný projekt v nabídce není. Dan určí, které zmrazené texty se mají sjednotit;
do té doby se přesných 110,0 % ani projekty nad hranicí nesmějí implementovat odhadem.

**Další známé návaznosti B6:** prázdný stav nemá schválený artboard; nulová alokace a stav
„všechny alokace jsou přečerpané“ nemají sjednocené chování; `scripts/ui-smoke.mjs` na
řádcích 224, 226, 234 a 338–342 očekává odstraňovaný `<select>`; preload nemá bezpečný
`openExternal` pro odkaz z prázdného stavu. Tyto body se v zablokovaném běhu neměnily.
---

## ⚠️ Nálezy B7 — zapojení odchozí fronty (2. 9. 2026)

Tyto body B7 nerozhoduje ani neopravuje mimo své vlastnictví:

1. `src/lib/queue.js` je hlavní soubor B7, ale `docs/changes/desktop-v1/plan.md` §2b jej
   ve výčtu souborů story neuvádí.
2. Schválený artboard `design/canvas/Fronta.dc.html` říká „Vzdáno po 6 pokusech“, zatímco
   kontrakt i `DEFAULT_RETRY_POLICY.maxAttempts` určují 5. B7 zachovává 5.
3. R22 vyžaduje plný GUID v názvu souboru nebo sidecar, ale žádná story v plánu tuto změnu
   nevlastní.
4. Obnova položky, která po pádu zůstane ve stavu `odesila`, není v B7 ani v jiné story.
5. Akceptační brána E5 původně neměřila `fsync` v `saveQueueAtomically`; B7 proto přidala
   behaviorální unit test pořadí `write → fsync dat → rename → fsync adresáře`.
6. E5 vůbec nehledá zapnutý `DESKTOP_TIME_ENABLED` a neměří jeho výchozí fail-closed hodnotu.
7. `tests/ipc-sender-guard.test.js` drží ručně udržovaný uzavřený allowlist IPC kanálů,
   který musí každá story s novým IPC rozšířit bez oslabení `toEqual`; plán to neříká.
8. Vlastnictví B6 je rozporné: tabulka bloků ji vynechává, §2b jí nedává `main.cjs` ani
   `preload.cjs`, ale vytěžené podklady je uvádějí jako sdílené. Souběh B6/B7 tím není doložený.
9. Nahrávky uzavřené po pádu rendereru, zničení okna nebo navigaci jako `incomplete` se do
   fronty nezařadí. B7 zařazuje jen explicitní `recording:finish`; je potřeba produktové rozhodnutí.
10. Značka `⛔` má v plánu dva významy: skutečnou stopku B12 a vazbu na rozhodnutí u B6/B7/B9.
11. Probouzení fronty přes `powerMonitor`/`net.isOnline()` a varovný stav ikony nemají vlastní
    story. Bez nich se čekající fronta sama po návratu sítě neprobudí.
12. Packet očekával B5 klíč `trackingId`, ale skutečný uzavřený úsek používá
    `clientTimeEntryId`. Čistá logika B7 používá skutečný klíč a přijímá jej jako idempotency key.
13. Okamžité zařazení uzavřeného času by vyžadovalo změnit B5 blok `runTrackingMutation`, který
    §12 packetu B7 nepřiděluje. Navíc `resolveRecovered("zahodit")` vrací také `closed`, ale
    s nulou minut a důvodem `zahozeno-clovekem`; není rozhodnuto, zda se smí odeslat.
14. Mezi atomickým uložením uzavřeného času v B5 a zápisem do fronty může proces spadnout.
    Opakovaný Stop je potom `noop`; chybí rozhodnutí a test startupové reconciliace `uzavrene`.
15. Packet B7 říká, že pumpu smějí probudit jen start aplikace a `queue:retry`, ale jeho
    kanárek K3 nad novým prázdným datovým adresářem vyžaduje po dokončení první nahrávky log
    „odesílání je vypnuté“. Startupová pumpa v té chvíli už prázdnou frontu zpracovala, takže
    obě podmínky současně splnit nejdou. B7 zachovává výslovné pravidlo dvou budíčků, takže
    K3 v popsaném čerstvém scénáři nemůže projít; Dan musí potvrdit, zda přidat třetí budíček
    po zařazení nahrávky, nebo změnit scénář K3.

---

## ⚠️ Otevřené body B11 — retence lokálních kopií (2. 9. 2026)

B3 už rozhoduje lokální výchozí retenci „7 dní, nastavitelné“. Následující body toto
rozhodnutí neotvírají; zachycují rozpory mezi zmrazeným specem, plánem a proveditelným
zapojením. Do jejich rozhodnutí platí bezpečný směr packetu: neodeslané soubory ani manifesty
se nemažou a neznámá volba znamená „Nemazat“.

| ID | Co je potřeba rozhodnout nebo přiřadit | Proč |
|---|---|---|
| **O-B11-1** | Kdo a v jaké story zapojí `electron/retention.cjs` do hlavního procesu? | B11 vlastní v `main.cjs` i `preload.cjs` „nic“, takže modul nikdo nezavolá a R23 zůstane nesplněné. |
| **O-B11-2** | Má v1 někdy mazat i neodeslané nahrávky po N dnech? | R19 dovoluje mazat až po úspěšném odeslání, ale S1 drží odesílání vypnuté; bez dalšího rozhodnutí retence nic nesmaže. Do rozhodnutí se neodeslané soubory nemažou. |
| **O-B11-3** | Kde trvale bydlí nastavení retence a kdo vlastní implementaci? | Architecture Spine vyžaduje stav přežívající pád v hlavním procesu; starší E6 požaduje `electron/settings.cjs`, `nastaveni.json` a IPC, plán B11 je nevlastní. |
| **O-B11-4** | Má po smazání vzniknout stav manifestu `purged`, nebo musí manifest zůstat bajtově beze změny? | Starší E6 chce `purged`, současné schéma tento stav nemá a R22 vyžaduje zachovat klíč proti duplikaci. |
| **O-B11-5** | Kdo schválí podobu částí Nastavení „Zvuk“ a „Záznamy“? | Pro tyto části chybí schválená kresba; B11 smí jen minimálně změnit dnešní výběr retence. |
| **O-B11-6** | Potvrdit přesné uživatelské popisky, zejména „Nemazat“ a zachování čtyř stávajících voleb. | Copy není ve zmrazeném specu ani plánu určeno. |
| **O-B11-7** | Patří prahy volného místa 2 GB / 5 GB do B11, nebo do samostatné story? | R23 na ně odkazuje, ale plán B11 je ve scope nemá. |
| **O-B11-8** | Potvrdit, že stáří se počítá z `sentAt`, nikoli z `mtime`. | Plán říká jen „soubor starší 7 dnů“; volba mění chování po obnově nebo kopírování. |
| **O-B11-9** | Aktualizovat předpoklad a fixturu B11 podle skutečného kontraktu dokončené B7. | B7 už proběhla: položka má `kind` a `processNext` bere objekt obou killswitchů. Packetův argument `"true"` je zastaralý. |
| **O-B11-10** | Potvrdit, že `exposure` DSK-F015 zůstává `labs`, ne `disabled`. | Matice má F015 už na `labs`; B11 dosažitelnost okna nemění. |
| **O-B11-11** | Patří mazací mechanismus pod DSK-F015, nebo má vzniknout DSK-F017? | Funkční matice samostatnou retenci nemá. |
| **O-B11-12** | Má B11 zavést guard, že cesty stop musí ležet pod adresářem nahrávek, a jeho test? | Bez něj může podvržená položka fronty ukázat na cizí soubor; jde o nové bezpečnostní pravidlo mimo zmrazený plán. |
| **O-B11-13** | Kdo opraví `ui-smoke`, aby po změně výchozí hodnoty neměřil tautologii? | Má nejdřív ověřit výchozí stav a potom nastavit jinou hodnotu, například „30 dní po odeslání“. Starší zápisy o onboardingu a oprávnění tento nový problém nepokrývají. |

---

## `orca-codex.sh` neumí ve dvou pokusech pustit Codex ve worktree (2. 9. 2026)

Delegace mechaniky na Codex dnes **dvakrát selhala** a práci nakonec udělal Claude.

| pokus | jak spuštěno | výsledek |
|---|---|---|
| 1 | `orca-codex.sh start "<úkol>" "<prompt>"` z kořene hlavního checkoutu | job běžel, ale zápis odmítl sandbox: `patch rejected: writing outside of the project` |
| 2 | totéž zevnitř worktree + selektor `worktree` | **panel se vůbec nezaložil**, po 2 minutách timeout, žádný log ani proces |

**Proč to stojí za tvůj čas:** tvoje pravidlo je „mechanika primárně Codex". Dokud tohle
neprojde, každá taková práce spadne zpátky na Claude a jde z Claude limitu — tedy přesně
z toho, co delegace měla šetřit.

**Co ověřit:** jak `orca-codex.sh` předat kořen worktree, aby ho sandbox `workspace-write`
uznal. Kandidáti: `codex exec -C <cesta>`, nebo `orca terminal create --worktree path:<cesta>`
s explicitní cestou v `--command`.

**Doporučený default do té doby:** delegovat Codexu jen práci v **hlavním checkoutu**,
a ve worktree ji dělat Claude.

---

## 🔴 Rozhodnutí pro tebe: smí odhlášení zhasnout ikonu nad běžícím mikrofonem? (2. 9. 2026)

Vyplynulo z třetího review (`docs/changes/desktop-v1/review-3-integrace.md`).

**Fakt:** `deriveTrayState` dává `signed-out` přednost před `recording`. Tak to má B3
**předepsané** — packet `B3-tray-autorita.md:597` i `specs/E3-vady-a-identita.md:48` to říkají
doslova, takže to není chyba implementace.

**Důsledek, který tehdy nikdo nedomyslel:** až půjde odhlásit se **za běhu nahrávky**, tím
kliknutím zhasne **jediný indikátor, že mikrofon nahrává** — a nahrávka poběží dál. Člověk
uvidí „odhlášeno" a bude si myslet, že je hotovo.

**Proč to nerozhodl běh:** je to změna designového pravidla ve **zmrazeném** dokumentu, tedy
hard gate. Přeskočeno, běh pokračoval na tom, co na tom nezávisí.

**Varianty:**

| | co udělat | pro | proti |
|---|---|---|---|
| **A** ⭐ | odhlášení běžící nahrávku **nejdřív ukončí**, teprve pak odhlásí | nic se neztratí, ikona nelže | odhlášení chvíli trvá |
| **B** | odhlášení při běžící nahrávce **odmítnout** s vysvětlením | nejjednodušší | otravné, když člověk chce rychle pryč |
| **C** | nechat prioritu být a spolehnout se na jiný indikátor | žádná změna specu | **žádný jiný indikátor neexistuje** |

**Doporučuju A.** Odhlášení je bezpečnostní akce — nesmí po sobě nechat běžet mikrofon.

**Do té doby to nikoho neohrozí:** `auth:logout` dnes **nemá v UI volajícího** (změřeno,
0 výskytů v `src/`). Hlídá to `tests/zapojeni-odhlaseni.test.js` — jakmile někdo tlačítko
zapojí, brána zčervená a připomene tohle rozhodnutí i další dvě věci (časovač poběží dál
a panel odhlášení tiše vrátí zpět).

---

## OAuth + Apple Developer — co udělat (2. 9. 2026, na Danův dotaz)

**Pořadí je důležité:** client ID odblokuje první živý běh aplikace, podpis až distribuci.

### 1. OAuth klient — TEĎ, blokuje všechno ostatní
Detail v [`docs/changes/desktop-v1/OAUTH-CO-ZALOZIT.md`](docs/changes/desktop-v1/OAUTH-CO-ZALOZIT.md).
Zkráceně: **nový** public/native klient bez secretu · PKCE `S256` povinné · grants
`authorization_code` + `refresh_token` · redirect `http://127.0.0.1/callback` a `http://[::1]/callback`
· scope `mcp:read`.

🔴 **Port v redirectu je náhodný** — server musí u loopbacku ignorovat port (RFC 8252 §7.3).
Jinak to spadne na `redirect_uri_mismatch` až v prohlížeči. `localhost` nepoužívat.

🔴 Server musí vystavit `/.well-known/oauth-authorization-server` s issuerem přesně rovným
originu a **všemi endpointy na tomtéž originu**.

**Pak pošli client ID** — uloží se mimo git.

### 2. Apple Developer účet (99 USD/rok) — kup, ale až po client ID
- **Distribuce:** bez podpisu a notarizace dostane každý kolega Gatekeeper varování.
- **Méně zjevné:** macOS váže Nahrávání obrazovky a mikrofon na **podpis binárky**. Nepodepsaná
  aplikace mění otisk při každém rebuildu, takže se povolení resetují — to je přesně ten opruz,
  co dnes drží `ui-smoke`.
- **Není to dnešní blocker:** bez client ID se aplikace nedostane přes první obrazovku.

### 3. Multi-tenant — rozhodnout, až bude čas (BD-N29)
`main.cjs:970` má seznam dvou povolených hostitelů; instalace jiného klienta se odmítne.
Doporučení: origin zadá správce při instalaci, s viditelným potvrzením, komu se přihlašuje.
**A client ID musí být uložené v páru s originem** — jedna globální proměnná multi-tenant neuveze.

---

## Námět: macOS má užší oprávnění „Jen záznam systémového zvuku" (2. 9. 2026)

Na Danově snímku Systémových nastavení je vedle „Záznam obrazovky a systémového zvuku"
i samostatná sekce **„Jen záznam systémového zvuku"** (mají ji tam Notion, Orca, Plaud).

**Proč to stojí za prověření:** aplikace dnes žádá o plné nahrávání obrazovky, přestože
obraz vůbec nepotřebuje — bere si ze streamu jen zvukovou stopu. Schválený design to sám
přiznává: *„macOS tomu říká nahrávání obrazovky, ale obraz se neukládá."* Užší oprávnění by
znamenalo, že si aplikace **o obraz nikdy neřekne** — méně vysvětlování kolegům a menší
plocha důvěry.

**Není to na teď** a nic neblokuje. Ověřit: od které verze macOS to je, jestli to Electron
umí vyžádat (`systemPreferences` / `getDisplayMedia` s audio-only), a jestli tím nepřijdeme
o něco, co dnes funguje.

**Změřeno u toho i tohle:** oprávnění pro binárku, ze které se dnes spouští, jsou v pořádku
(`mikrofon: granted`, `obrazovka: granted`). Chyba „systémový zvuk: Permission denied"
tedy **není o oprávnění** a hledá se v kódu panelu. Apple Developer účet kvůli ní kupovat netřeba.

---

## Pro server: `ludone_ping` (nebo `userinfo`) potřebuje vracet i JMÉNO (2. 9. 2026)

Vyplynulo z prvního živého přihlášení. Desktop dnes nemá **odkud vzít jméno uživatele**:

- token endpoint vrací jen OAuth pole, žádnou identitu;
- discovery nemá `userinfo_endpoint`;
- `ludone_ping` vrací pouze `user` = e-mail (`ludone-app/src/mcp/tools/ping.ts:70`).

Schválený design má přitom na obrazovce „Přihlášeno" **Jméno · E-mail · Zařízení**.

**Desktop je odblokovaný** (chybějící jméno už přihlášení nezahodí), ale dokud jméno nepřijde,
ukáže místo něj e-mail. Až server jméno začne vracet, desktop ho zobrazí bez další práce.

**Nejmenší zásah:** přidat do odpovědi `ludone_ping` jméno přihlášeného uživatele.

---

## `RecordingCard` nemá unit pokrytí vůbec (2. 9. 2026)

Změřeno sabotáží při odstraňování kalendáře: přejmenování `start()` v
`src/features/recording/RecordingCard.jsx` prošlo **`328 passed`** a čistým lintem.

Karta nahrávání je přitom hlavní funkce aplikace. Není to věc žádné běžící story — hlásím
zvlášť, ať to nezapadne mezi zelené brány.

---

## Drobnost: v DB zůstal druhý, nepoužívaný OAuth klient (2. 9. 2026)

Registrační `curl` se pustil dvakrát, takže vznikly **dva klienty**:

| client_id | stav |
|---|---|
| `ldmcp_oauth_client_prod_v1_Mti3tDvq…` | **používaný**, v `.env.local`, ověřený naostro (`authorize` → `HTTP 302`) |
| `ldmcp_oauth_client_prod_v1_dgsYAL5m…` | **nepoužívaný sirotek** |

Nic to nerozbíjí. Kdybys chtěl uklidit, jde to jen zásahem do `ludata.mcp_oauth_clients`
(nastavit `revoked_at`) — admin obrazovka na správu klientů podle auditu neexistuje.

⚠️ **Připomínka k limitu:** registrace má strop **20 pokusů za hodinu na IP**. Opakované
spouštění toho `curl` ho vyčerpá — proto se client ID zakládá **jednou** a uloží.

---

## Serverová strana: předávací specifikace hotová (2. 9. 2026)

[`docs/changes/desktop-v1/SERVER-CO-POSTAVIT.md`](docs/changes/desktop-v1/SERVER-CO-POSTAVIT.md)

**Ze tří čtvrtin je to hotové a stabilní.** Příjem nahrávek má 329řádkový spec (`E5`), tvar
dat z desktopu je zmrazený (`schemaVersion: 1`).

🔴 **Dvě věci brání začít:**
1. **Chybí OAuth scope pro zápis.** Server zná jen `mcp:read` a `mcp:draft`; ani jeden
   neumožňuje nahrát soubor ani zapsat čas. Doporučuju nový `mcp:upload`. **Rozhodnout dřív
   než psát endpointy** — jinak nebude čím se k nim přihlásit.
2. **Příjem naměřeného času není specifikovaný vůbec** — `E5` řeší jen nahrávky (0 zmínek
   o LuTracku). Desktop přitom čas do fronty už zařazuje (PR #15).

⚠️ A jedna věc, kterou umíš změřit jen ty: **`E5` krok 1 je blokující** — skutečný nginx strop
a timeouty na hostu přes SSH. Hodinové audio má 40–120 MB na stopu a stopy jsou dvě.

**Doporučené pořadí:** scope → nginx měření → **příjem času** (malý, ověří celý řetěz) →
příjem nahrávek.

---

## ✅ Nginx strop ZMĚŘEN — `E5` krok 1 už není blocker (2. 9. 2026)

Nemusíš na host lézt. SSH funguje aliasem `hetzner-data` z `~/.ssh/config` a `app.ludone.cz`
běží na tomtéž stroji jako `data.ludone.cz` (23.88.61.12).

```
client_max_body_size 50m     ← /etc/nginx/nginx.conf:18, platí globálně
app.ludone.cz to nepřepisuje
```

🔴 **Hodinová stopa má 40–120 MB, strop 50 MB** — upload v jednom kuse spadne.

**Zbývá tedy jediné tvoje rozhodnutí:** scope pro zápis (`mcp:upload`), viz
[`PROMPT-SERVER-SESSION.md`](docs/changes/desktop-v1/PROMPT-SERVER-SESSION.md) §1.

---

## Po zjednodušení plánu zbyla jedna díra a dvě potvrzení (2. 9. 2026)

Tvoje zjednodušení (nahrává prohlížeč, ne desktop) **odložilo scope u nahrávek** — ale
neplatí to na všechno.

### ✅ VYŘEŠENO 2. 9. — LuTrack se odkládá a kontrakt určí aplikace (BD-N38)

Dan: *„ten LuTrack bych zatím neřešil na serveru… naopak, že to vymyslí app a desktop se pak
přizpůsobí."* Díra tím zmizela: čas se neodesílá, scope se neřeší, a až na to dojde, rozhodne
tvar `ludone-app`.

⚠️ **Zbývá jedna věc k pojmenování:** LuTrack v panelu tak zůstane funkční jen lokálně
a naměřený čas nikam neodejde. Je to vědomý stav, ale **nesmí vypadat jako hotová funkce** —
jinak si někdo odklikne den práce, který se nikam nezapíše.

### ~~Kudy půjde naměřený ČAS?~~ (už neplatí)

Nahrávky nově chodí z prohlížeče. **Naměřený čas ale posílá desktop sám**, a ten se
autorizovat musí. Takže:

| varianta | důsledek |
|---|---|
| **A** odložit celou časovou agendu do fáze 2 | scope se neřeší teď; LuTrack zůstane nezapojený |
| **B** udělat scope hned kvůli času | fáze 1 přestane být „bez nového práva" |
| **C** čas taky přes prohlížeč | nesmysl — nikdo nebude ručně nahrávat záznam o dvou hodinách |

**Doporučuju A.** Nahrávky jsou to, kvůli čemu aplikace vzniká; čas počká na fázi 2 a scope
se udělá jednou pro obojí.

### Dvě potvrzení (rozhodl běh, ne ty)

1. **Plná kvóta = odmítnout nahrávání**, nikdy nemazat automaticky. Tiché smazání dat,
   o která nikdo nepožádal, je horší než odmítnutá nahrávka.
2. **Přepisová služba musí umět diarizaci a češtinu.** Bez toho je ze zápisu ze schůzky
   jeden slepý text.

### Co nikdo zatím neřešil: cena přepisu

„Všechno na klik" cenu **odkládá, neruší**. U hodinové schůzky to nejsou drobné. Serverová
session by ti měla přinést cenu za minutu u dvou tří služeb jako číslo — je to rozhodnutí
o penězích, tedy tvoje.

---

## 🔴 BD-N34 vyžaduje práci na desktopu, která NEEXISTUJE (odhaleno 2. 9.)

Serverová session se zeptala na tvar souboru a odhalila, že **rozhodnutí BD-N34 jsem zapsal
jako plán, ale desktop ho neumí.** Chybí:

1. **Export schůzky do JEDNOHO stereo souboru** (mikrofon vlevo, systém vpravo).
2. **Tlačítko**, které ho uloží do Stažených a otevře nahrávací stránku app.ludone.

⚠️ **Riziko, které jsem dřív nezmínil:** mikrofon a systém jsou dnes **dva nezávislé
`MediaRecorder`y**, které startují s malým rozdílem a můžou se během schůzky rozejít.
Sloučení do jedné stereo stopy vyžaduje **zarovnání** a může selhat. Zkusíme jeden soubor;
pokud to nebude spolehlivé, fáze 1 pošle dva a serverová session to musí vědět předem.

**Co desktop o schůzce ví (změřeno v `src/lib/manifest.js`):**
`clientRecordingId` · `createdAt` · `closedAt` · `state` · velikosti a hashe stop.
🔴 **Žádný název, zařízení, účastníci ani projekt.** Pojmenování je `DSK-F008`, pořád `no-code`.
⇒ V první fázi se název zadá ve webovém formuláři.

**Pořadí, které navrhuju:** napřed doladit zbývající obrazovky podle schváleného designu
(chceš je vidět), pak stereo export a tlačítko — až bude jasné, jaký tvar souboru a URL
serverová session určí.

---

## ✅ VYŘEŠENO: `/uploads/**` na produkci (2. 9. 2026)

Nález i oprava patří serverové straně (`ludone-app`), ne desktopu — proto je tady jen odkaz.
Zavřeno allowlistem; Dan vědomě ponechal tři prefixy veřejné. Detail vede serverová session
ve svém repozitáři.

🔴 **Otevřený follow-up (návrh serverové session):** ty tři prefixy servírovat vlastní routou
se session gate místo veřejného prefixu. U dvou z nich na ně nikdo prohlížečovou URL nestaví,
u třetího už existuje správná token routa. Odhad jedno odpoledne. Přínos není jen kosmetický —
zmizí URL, které platí navždy, nejdou odvolat a nikdo neloguje, kdo je použil.

## Mezera: odebrání retina ikony (`@2x`) nikdo nechytí (2. 9. 2026)

Změřeno sabotáží při opravě neviditelné ikony (PR #24): odstranění `addRepresentation`
s `@2x` variantou prošlo **`411 passed`**.

⇒ Kdyby to někdo odstranil, ikona bude na retina displeji **rozmazaná** a žádná brána
nezakřičí. Není to blocker — ikona bude vidět — ale je to měřidlo, které nic neměří.

**Levná oprava:** test, který ověří, že se pro každý stav registruje i `@2x` reprezentace.
