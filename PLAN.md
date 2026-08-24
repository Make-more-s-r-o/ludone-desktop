# Implementační plán — LuDone Desktop

Vzniklo **24. 8. 2026** z ultracode analýzy (15 agentů, ~1,8 M tokenů) nad kódem, výzkumem,
rozhodnutími a repozitářem `ludone-app`. Nahrazuje odhady z `luplaud-vyzkum`, které byly psané
před měřením.

**Čti v tomhle pořadí:** `ROZHODNUTI.md` (co je rozhodnuté) → tenhle soubor (co se bude dělat) →
`DAN-TODO.md` (co musí udělat Dan) → `specs/E*.md` (jak přesně).

---

## Stav v jedné větě

Zachycení dvou zvukových stop na Macu **je skutečně ověřené a je to nejcennější aktivum projektu**,
ale kód aplikace není ani na `main`, všechno kolem zvuku je přiznaná atrapa, projekt nemá žádné
automatické měřidlo, a vyřazovací kritérium A6 (Google Meet) se nikdy netestovalo.

### Co je ověřeno naostro ✅

| Co | Důkaz |
|---|---|
| **Systémový zvuk se opravdu zachytává** | Křížová korelace systémové stopy s `Glass.aiff` = **0,9638**, u mikrofonu **0,0098**. Mikrofon byl **se zvukem tišší** (−46,0 dB) než v tichu (−44,2 dB) ⇒ akustický přeslech vyloučen. Tiché ticho na přesné digitální nule −91,0 dB. Reprodukováno v 5 bězích, Electron 37 i 43 |
| **Dvoustopé nahrávání je poctivé** | Dva nezávislé `MediaRecorder`y, chunky po 1 s přes IPC, kontrola pořadí, limit 8 MiB, `FileHandle.sync()`, soubory `0o600`. Odolnost proti pádu ověřena uříznutím souboru |
| **WebM je zvukově v pořádku** | 84 paketů, souvislé PTS po 60 ms, 241 920 vzorků = přesně 5,040 s. Nic se nezahodí |
| **Klikatelná kostra běží** | Dockless bezrámový panel 366×792 pod tray ikonou, 4 stavy ikony, onboarding, okno nastavení. Ověřeno spuštěním |

🔴 **Důkaz zapsaný v `ROZHODNUTI.md` je ale špatný.** Poměr velikostí 20,7× ani −91 → −20 dB
nedokazují, **odkud** zvuk přišel — rozliší jen „něco × nic“. Opus s DTX smrskne ticho na 8bajtové
pakety, takže **jakýkoli** zvuk stopu nafoukne stejně, včetně přeslechu. Závěr platí, argument se
musí přepsat (E0), jinak ho první skeptik shodí, přestože je pravdivý.

### Co je atrapa nebo přestřelené ⛔

| | |
|---|---|
| 🔴 **Na `main` není ani řádek kódu** | Kód žije na `feat/kostra-appky` (2bb09ce) v ignorovaném worktree. **Kdo naklonuje repo, nedostane appku** — autonomní běh nemá odkud startovat |
| 🔴 **B1 „otázka je uzavřená“ přestřeluje** | Testoval se `afplay`. Meet má „communication“ audio relaci + aktivní AEC + drží sám mikrofon. Obava: **AEC odečte hlas protistrany a odbočka vrátí ticho** |
| 🔴 **C1 je ⛔, ne ✅** | Měřilo se **špatné oprávnění** (loopback jde přes `getDisplayMedia` ⇒ rozhoduje Záznam obrazovky). Binárka je ad-hoc podepsaná, certifikát smazán, `NSAudioCaptureUsageDescription` v bundlu chybí |
| 🔴 **Appka vypadá jako směr B, který A14 zabil** | `styles.css` deklaruje Public Sans, ale v repu **není jediný `.woff2` ani `@font-face`** a CSP `default-src 'self'` blokuje Google Fonts ⇒ vykresluje se **San Francisco**, tedy nativní macOS vzhled |
| Atrapy | přihlášení (mock token po 650 ms) · oprávnění (`{granted:true}` po 280 ms bez volání macOS API) · schůzky (natvrdo „Čtvrtek 20. srpna“) · LuTrack (reload smaže naměřený čas) · **odeslání na server neexistuje vůbec** |
| Měřidlo | žádný lint, typecheck, unit test ani CI. **Audio brána je vyvratitelná** — běh z 24. 8. má „silence“ stopu 50 107 B cizího zvuku |
| Rozpory | `NALEZ.md` křičí „SYSTÉMOVÝ ZVUK NEFUNGUJE“ · `odpoved-zvuk.json` tvrdí `false` · dva výzkumy tvrdí 1 vs. 0 balíčků z Anarlogu a 18–30 vs. 14,5–23,5 ČD |

---

## Rozhodnutí Dana z 24. 8. — plán je respektuje

| # | Rozhodnutí |
|---|---|
| **D1** | Přihlášení = **OAuth 2.1 + PKCE, loopback redirect.** Ne bearer token |
| **D2** | Bundle identifier = **`cz.ludone.desktop`** (dnes `.prototype`) |
| **D3** | **E5 a E6 souběžně** ve dvou worktrees. Kalendář a LuTrack až po nich |
| — | První autonomní běh = **E0 + E2 + E3.** Meet test (E1) až po nich |
| — | Design: Claude Design **je připojený**, nic se neinstaluje. Nejdřív technika, pak design a funkce přes Claude Design |

---

## Etapy

**Celkem 19–29 ČD**, z toho desktop 12,5–20 ČD. Zbytek je serverová práce, kterou žádný dosavadní
odhad nezahrnoval.

⚠️ **Rozpor:** ř. 194 uvádí desktop **14,5–23,5 ČD**. Platný odhad zvolí Dan.

| # | Etapa | Kdo | ČD | Spec |
|---|---|---|---|---|
| **E0** | Startovací čára — kód na `main`, `AGENTS.md`, jeden zdroj pravdy | Claude Opus | 0,5–1 | [`specs/E0`](specs/E0-startovaci-cara.md) |
| **E1** | 🔴 Vyřazovací test A6 — Google Meet | **Dan** | 0,5 | `DAN-TODO.md` |
| **E2** | Měřidlo — brány, kterým se dá věřit | Codex | 1,5–2,5 | [`specs/E2`](specs/E2-meridlo.md) |
| **E3** | Doložené vady kódu a identity | Claude Opus | 1–1,5 | [`specs/E3`](specs/E3-vady-a-identita.md) |
| **ED** | Designová větev — canvas do repa, tokeny, chybějící stavy | Claude Opus | 2–3 | [`specs/ED`](specs/ED-design.md) |
| **E4** | Provozní podmínky — hodinová schůzka místo pěti sekund | Claude + **Dan** | 2–3 | `DAN-TODO.md` |
| **E5** | Serverová cesta — příjem nahrávky na `app.ludone.cz` | Codex | 3–4,5 | [`specs/E5`](specs/E5-server-prijem.md) |
| **E6** | Přihlášení a odchozí fronta v desktopu | Claude Opus | 2,5–4 | [`specs/E6`](specs/E6-prihlaseni-a-fronta.md) |
| **E7** | Dnešní schůzky z kalendáře | Codex | 1,5–2,5 | čeká na D5 |
| **E8** | LuTrack — časovač, který si něco pamatuje | Codex | 1,5–2,5 | — |
| **E9** | Přepis na serveru | Codex | 3–4,5 | čeká na D4 |
| **E10** | Podpis, oprávnění a rozvoz | **Dan** | 1,5–2,5 | `DAN-TODO.md` |

### Pořadí a souběh

```
E0 ──> E2 ──> E3 ──┬──> E1 (Dan) ──> E4 (Dan) ──> E10 (Dan)
       │           │
       └── ED ─────┴──> E5 (worktree A) ──┬──> E7 ──> E9
                        E6 (worktree B) ──┘    E8
```

- **E0 je první bezpodmínečně** — bez kódu na `main` a bez `AGENTS.md` nemá běh odkud startovat
  a bude si číst protiřečící si dokumenty.
- **E2 musí být hotová dřív než E3**, protože bez měřidla se opravy vad neověří.
- **ED (design) blokuje E5 a E6.** Artboardy `Fronta.dc.html` a `Prihlaseni.dc.html` musí být
  hotové a odsouhlasené Danem dřív, než se E5/E6 spustí — jinak se kreslí dvakrát.
- **E5 a E6 běží ve dvou oddělených worktrees.** Dvě zapisující session v jednom stromě si
  přepisují práci.
- **E7, E8, E9 až po E5+E6** — potřebují hotový serverový kontrakt a frontu.

---

## Měřítka etap — čím se pozná hotovo

Žádné „modul funguje“. Každá etapa má spustitelnou podmínku.

| # | Měřítko |
|---|---|
| **E0** | `git clone` čerstvé kopie + `npm ci && npm run build && npm run package:mac` vyrobí spustitelný `.app`, aniž by se sáhlo do worktrees. `grep "SYSTÉMOVÝ ZVUK NEFUNGUJE"` bez značky PŘEKONÁNO vrací prázdno. Jediný worktree, žádná zombie větev |
| **E1** | Korelace systémové stopy se známým souborem **> 0,8** a střední hlasitost nad **−40 dB**, pro Meet i Teams |
| **E2** | Tři umělé regrese jsou chycené: (a) odstraním kontrolu pořadí chunků → padne unit test; (b) přejmenuji „Zastavit nahrávání“ → padne ui-smoke; (c) pustím tichý běh, zatímco hraje hudba → brána běh **zahodí a zopakuje**, ne vyhlásí neúspěch. Demonstrované, ne slíbené |
| **E3** | `kill -9` rendereru během nahrávání → tray do 1 s idle · `tray:set-state` z netrusted frame odmítnut · `plutil -p` vypíše `NSAudioCaptureUsageDescription` · `codesign --verify --deep --strict` projde a všechny vnořené bundly hlásí tutéž identitu |
| **ED** | `npm run design:gate` vrátí 0 · žádný artboard mimo archiv není širší než 1200 px · canvas publikovaný na **původní** adresu obsahuje 9 artboardů a ani jeden ze směru B |
| **E4** | 60min nahrávka: rozjezd stop **pod 200 ms** měřený korelací cvaknutí · paměť neroste lineárně · obě stopy nenulové ve všech čtyřech stavech (ztlumeno, AirPods…) · po `kill -9` existuje manifest se stavem „nedokončeno“ |
| **E5** | 60min stopa doputuje · `ffprobe` vrátí správnou délku · dekódovaný zvuk **bitově totožný** s originálem · uživatel mimo modul-gate nebo company-scope dostane **403 ověřeno druhým účtem**, ne přečtením kódu |
| **E6** | Nahrát → zavřít notebook uprostřed uploadu → otevřít → nahrávka doputuje **bez ručního zásahu a bez duplikátu** · odhlášení skutečně zneplatní token na serveru · odmítnutí mikrofonu se v onboardingu projeví **červeně** |
| **E7** | Nová událost v kalendáři je po refreshi v panelu · odpojení sítě zobrazí cache + varovný stav, ne prázdný seznam |
| **E8** | Spustit časovač → `kill -9` rendereru → panel se otevře s **běžícím** časovačem a správným časem |
| **E9** | 60min nahrávka projde frontou a vrátí text odpovídající kontrolní pasáži · přepis syrového a remuxovaného souboru shodný slovo po slovu · selhání poskytovatele nechá záznam ve `failed` s důvodem, ne v `processing` navždy |
| **E10** | **P1 zelené** (nahrává po přepodepsání bez dialogu) **a zároveň P2 červené** (ad-hoc si o oprávnění řekne znovu). Projde-li obojí, závěr zní „macOS 26 se neptá“, ne „certifikát funguje“ |

---

## Router — kdo co dělá

> Router vybírá **vykonavatele, ne odpovědnost.** Konsolidace zůstává na hlavní session: diff od
> Codexu čte, brány pouští a commituje vždycky Claude.

**Dan** (E1, E4, E10 + rozhodnutí D4–D6) — vše, co potřebuje fyzický svět nebo peníze: druhé
zařízení pro Meet, sluchátka připojovaná za běhu, ztlumení klávesou, čistý uživatelský účet,
restart Macu, certifikát a jeho záloha. **Žádný agent tohle nezměří** a jakékoli tvrzení agenta
o tom je nutné brát jako neověřené.

**Claude Opus** (E0, E3, E6, ED) — tři místa, kde chyba stojí víc než ušetřený limit: konsolidace
protiřečících si zdrojů pravdy a merge na `main` je architektonická práce; IPC hranice, kontrola
odesílatele a podpisová identita jsou bezpečnostně citlivé; přihlášení, token v Keychainu a fronta
s idempotencí je money-path.

**Codex `gpt-5.6-sol`** (E2, E5, E7, E8, E9) — většina ČD v tomhle plánu. Testovací infrastruktura,
upload endpoint, fronta na přepis, kalendářový endpoint, LuTrack persistence. Všude existuje
v `ludone-app` hotová šablona k následování (`private-file-storage.ts`, `mcp/http/auth.ts`,
`cron-auth.ts`).

🔴 **U E5, E6 a E9 platí povinné Claude review nad diffem** — jsou to cizí nahrávky, tokeny a klíč
k přepisu. Nemergovat naslepo.

**Viditelnost v Orce:** Codex běhy přes `~/.claude/scripts/orca-codex.sh start "<úkol>" "<prompt>"`,
delegované Claude session přes `orca-codex.sh claude`. Subagenti z Agent toolu v Orce vidět
**nejdou** — když má být etapa vidět samostatně, musí být session v panelu, ne subagent.

---

## Rizika

| Riziko | Dopad | Protiopatření |
|---|---|---|
| 🔴 **Meet neprojde** — AEC odečte hlas protistrany a odbočka vrátí ticho | A6 padá, projekt v současné podobě ztrácí smysl. Zjištěno po 20 ČD by to bylo nejdražší selhání plánu | E1 je test na půl dne. Do jeho výsledku má B1 stav 🟡. Záložní cesta: **Windows**, kde je loopback oficiálně podporovaný |
| 🔴 **Update Chromia tiše odstraní `audio:'loopback'`** na macOS | Appka přestane nahrávat druhou stranu a **nikdo si toho nevšimne**, protože UI bude dál ukazovat, že nahrává | Chování je **nezdokumentované** (Electron docs píší jen Windows) ⇒ changelog nevaruje. Povinný audio-smoke po každém bumpu, verze připnutá přesně, tray který nelže (E3) |
| 🔴 **Rozjezd dvou stop na hodinové nahrávce** | Dva soubory, dvoje nezávislé hodiny, žádná společná časová osa. Na 5 s neviditelné, na 60 min to **rozbije přepis dvou mluvčích** — tedy hlavní hodnotu | E4 měří korelací cvaknutí, práh pod 200 ms. Když se rozejde: společná časová značka v manifestu + resample na serveru |
| 🔴 **Ztráta podpisového klíče nebo přejmenování bundle id** | Vynuluje oprávnění **všem**, nevratně. Horší a trvalejší než 99 $/rok | D2 v E3: ostrý bundle id hned, `.p12` do firemního správce hesel **ještě před prvním použitím** |
| 🔴 **Tichý běh v audio bráně není řízená podmínka** | Brána vyhlásí neúspěch u funkce, která funguje, kdykoli na pozadí hraje cizí aplikace. Běh pak stráví noc opravováním něčeho, co není rozbité — nebo, hůř, **„opraví“ měřidlo** | Doklad leží v repu (`.runtime/audio-proof-2026-08-24T11-22-38-333Z`, „silence“ 50 107 B). E2: tvrdě ověřit −91,0 dB, jinak běh **zahodit** |
| **Autonomní běh v sandboxu, kde Electron GUI nenaskočí** | `ui-smoke` i `audio-smoke` nespustitelné, jediné brány zůstanou build/lint/unit — žádná kontrola zvukové cesty | Noční běh 20.–21. 8. skončil na `kLSNoExecutableErr`. Běh na startu zkusí spustit Electron a podle výsledku zařadí brány do smyčky nebo na manuální checkpoint |
| 🔴 **Právní rámec až po první ostré nahrávce** | Riziko č. 1 z doložených precedentů — konkurenční případ z dubna 2026 padl přesně na tomhle, ne na kódu | D6 je hodina rozhovoru, ne ČD implementace. Nezdržuje vývoj, ale je **tvrdou podmínkou ostrého použití** |
| **Běh uvěří dokumentaci v repu** | Čtyři dokumenty tvrdí čtyři různé věci. Agent může znovu řešit zodpovězenou otázku, nebo stavět na vyvráceném závěru | E0 je první právě proto. `AGENTS.md` jako jediný vstupní bod s explicitním pořadím zdrojů pravdy |

---

## Designová větev (ED) — shrnutí

Detail v [`specs/ED-design.md`](specs/ED-design.md). Tři věci, které stojí za vypíchnutí:

1. **Appka dnes vypadá jako směr B**, který rozhodnutí A14 zabilo. `styles.css:3` deklaruje
   Public Sans, ale v repu není **žádné `@font-face`, žádný `.woff2`, žádný `public/`** a CSP
   `default-src 'self'` blokuje Google Fonts. Vykresluje se San Francisco. Kdo posuzuje vzhled
   ze screenshotů, posuzuje jiný produkt, než jaký je naspecifikovaný.
2. **Dva z pěti artboardů kreslí něco, co do appky nepatří.** `Main.dc.html` a `TmavyRezim.dc.html`
   ukazují okno 1080×700 se sidebarem, hledáním v zápisech a archivem nahrávek — přesně to, co
   A11 („spouštěč, ne platforma“) a A12 („archiv NE“) z aplikace vyloučily. Kód je v tomhle
   správně: panel 366×792 bez rámu. Artboardy se **archivují jako podklad pro modul na webu**,
   nemažou.
3. **Design system: nezakládat třetí projekt.** Přisadit desktop k existujícímu
   **„LuDone Přístroj Design System“** (`c5ee8498`, aktualizován 5. 8., už dnes odděluje
   `ui_kits/ludone-app/**` od tokenů) jako sourozence `ui_kits/ludone-desktop/**` + `tokens/desktop.css`.
   Do starého „LuDone Design System“ (`86e837a2`, leží od 27. 4.) **nezapisovat**. Zelená patří
   desktopu, ne sdíleným tokenům — zapsat ji do `tokens/colors.css` by přebarvilo i `ludone-app`.

🔴 **Canvas dnes existuje v jediné kopii** v cizím repu `luplaud-vyzkum`, který **nemá nic
commitnuté a nemá remote** (`git ls-files mockupy` vrací prázdno). Dokud neprojde push do
`ludone-desktop`, nesmí se tam nic mazat ani přesouvat.

---

## Co se změnilo proti dosavadním odhadům

| | Bylo | Je |
|---|---|---|
| Odhad desktopu | 18–30 ČD (`00-FINALNI-NAVRH.md`) | **14,5–23,5 ČD** (`05-ZAVERY`, po A11) <br>⚠️ **Rozpor:** ř. 60 uvádí desktop **12,5–20 ČD**. Platný odhad zvolí Dan. |
| Serverová část | nezahrnuta v žádném odhadu | **+6,5–9 ČD** (E5 + E9) |
| Balíčky z Anarlogu | 1 (`detect`) | **0** — `05-ZAVERY` oddíl 7.2 ruší i ten poslední, nahrazuje ho kalendář |
| B6 „vadná hlavička Opus“ | riziko pro přepis | **kosmetika.** Hlavička je platná; skutečný problém je chybějící délka, opraví ji `ffmpeg -c copy` při příjmu |
| C1 podpis | ✅ potvrzeno | **⛔ neověřeno** — měřilo se špatné oprávnění |
| B1 Electron | ✅ uzavřeno | **🟡** dokud neproběhne E1 |
