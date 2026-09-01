# Návrh sekce: performance-responzivita

**NEZMRAZENO.** Vzniklo 1. 9. 2026 ve workflow `doplneni-masterplanu`. Skeptická revize
leží v `revize-*.md` vedle a **našla v těchhle sekcích nepravdivá tvrzení** — do `spec.md`
ani `plan.md` se to proto nevkládá celé. Co z toho už platí, je v `spec.md` §11.

---

## Performance expectations

Každé číslo nese značku: **ZMĚŘENO** (existuje důkaz v repu, uveden odkaz) nebo **NÁVRH** (cíl,
který první běh měřítka E4 potvrdí, nebo nahradí naměřenou hodnotou). Nezměřené číslo se nesmí
opsat do reportu ani do release notes jako fakt.

### Referenční zátěž: schůzka dlouhá 2 hodiny

Danovo rozhodnutí 1. 9.: **nahrávka do 2 hodin musí projít spolehlivě.** Dvě hodiny jsou požadavek
na spolehlivost, ne strop chování — co dělá aplikace po překročení, spec zatím neurčuje (viz §
Otevřené).

| Veličina | Hodnota | Značka a zdroj |
|---|---|---|
| Nastavený tok jedné stopy | 128 kbit/s = 57,6 MB/h | **ZMĚŘENO** — `audioBitsPerSecond: 128_000`, `src/features/recording/RecordingCard.jsx:142-148` |
| Skutečný tok mikrofonní stopy včetně kontejneru | 17,0 kB/s ≈ **61 MB/h** | **ZMĚŘENO** — 85 169 B za 5,01 s, `NAHRAVANI.md:58-64` |
| Systémová stopa v tichu | 1 351 B za 5 s ≈ 1 MB/h | **ZMĚŘENO** — tamtéž; Opus na tichu netvoří skoro nic |
| Dvě stopy za 2 h | **125 až 245 MB** podle toho, kolik mluví druhá strana | **DOPOČTENO** z obou měření výše |
| Číslo pro dimenzování (disk, fronta, varování) | **250 MB na jednu 2h schůzku** | **NÁVRH** — horní konec dopočtu, zaokrouhleno |

⚠️ **Číslo 160 MB ze zadání je odhad, ne měření.** Odpovídá systémové stopě aktivní zhruba třetinu
času. Naměřený tok mikrofonu ho na dvou hodinách sám o sobě překročí (≈123 MB), takže **na
dimenzování se používá 250 MB**, ne 160. Nezávisle to potvrzuje `specs/E5-server-prijem.md:7`,
které počítá s 40–120 MB za hodinu obou stop, tedy 80–240 MB za dvě.

### Časy — jak dlouho co smí trvat

| Úkon | Cíl | Značka a zdroj |
|---|---|---|
| Klik na ikonu → **viditelný panel** (aplikace už běží) | **≤ 150 ms** (p95) | **NÁVRH** — okno panelu existuje od startu, klik je jen `show()`: `electron/main.cjs:387-395`, `730`. Nic se nenačítá, tak nemá co trvat |
| První klik po startu aplikace, než proběhne `ready-to-show` | **≤ 1 s**, a **nikdy prázdná plocha** | **NÁVRH**; podklad okna je nastavený (`main.cjs:301`), takže bílé bliknutí je vada |
| Klik na „Nahrát" → stav **nahrává** (oprávnění už udělená) | **≤ 1,5 s** (p95), **≤ 3 s** vždy | **NÁVRH** |
| Mezistav, když příprava zvuku trvá déle | zobrazit po **800 ms** | **NÁVRH**; fáze `checking` v kódu už existuje (`RecordingCard.jsx:303-310`) |
| Systémový dialog o oprávnění | **neměří se** | Hodiny běží uživateli, ne aplikaci. Panel se přitom nesmí schovat — ošetřeno, `main.cjs:232-245` |
| Rozjezd obou stop **vůči sobě** | **≤ 200 ms**, měřeno korelací cvaknutí | **MĚŘÍTKO ZADANÉ** — `PLAN.md:111` (E4). Samotné měření zatím **neproběhlo** |
| „Zastavit" → nahrávka uzavřená na disku (manifest + `sha256` obou stop), 2h nahrávka | **≤ 5 s** | **NÁVRH** — `sha256` se počítá streamem přes ~120 MB na stopu (`specs/E6-prihlaseni-a-fronta.md:47`). Po celou dobu panel ukazuje „Ukládám" a aplikace nesmí jít ukončit tiše |
| Časovač: odchylka měřeného času po probuzení ze spánku | **≤ 1 s za 8 h** | **NÁVRH**, ale je to money-path: R9 ořezává na celé minuty, takže drift smí posunout hranici minuty nejvýš jednou za pracovní den. Čas se počítá **z uložených razítek**, nikdy sčítáním tiků |

### Paměť

- Chunk padá na disk **každou 1 s** (`RECORDING_TIMESLICE_MS = 1_000`, **ZMĚŘENO**,
  `src/features/recording/RecordingCard.jsx:8`), takže v paměti je nanejvýš ~16 kB na stopu.
  Jediný chunk nesmí přesáhnout **8 MiB** (**ZMĚŘENO**, `electron/main.cjs:29`).
  🔴 **Nahrávka se nikdy nedrží v paměti celá** — to je R2, ne optimalizace.
- **Požadavek na tvar křivky, ne na jedno číslo:** RSS mezi **5. a 120. minutou** nahrávání nesmí
  vzrůst o víc než **50 MB** a růst nesmí být lineární k délce nahrávky. **NÁVRH** — `PLAN.md:111`
  žádá „paměť neroste lineárně", ale žádné číslo nedává.
- Absolutní strop **500 MB** RSS za všechny procesy aplikace během 2h nahrávání. **NÁVRH se
  slabým podkladem:** klidová spotřeba Electronu na tomhle Macu **nikdy nebyla změřena**. První běh
  E4 tohle číslo buď potvrdí, nebo ho nahradí. Do té doby se nesmí citovat jako fakt.
- **CPU: neuvádím žádné číslo, protože žádné neexistuje.** E4 ho změří a doplní sem.

### Disk

- **Kontrola před startem** (dnes chybí, `inventar-povrchu` F23): nahrávání se nespustí, když je
  volného místa **< 2 GB** nebo složka s nahrávkami **> 5 GB** — **POPSÁNO** v
  `specs/E6-prihlaseni-a-fronta.md:65-69`, v kódu neexistuje. Odmítnutí musí říct **proč**,
  ukázat aktuální čísla a nabídnout „Smazat odeslané teď" a otevření složky.
- Potřebné místo na jednu schůzku se počítá jako **250 MB** (viz výše), ne 160.
- 🔴 **Dojde-li místo za běhu (ENOSPC), nahrávání se nezastaví celé.** Zastaví se zápis postižené
  stopy, druhá **pokračuje**, panel řekne **která** stopa přestala a **kdy byla poslední uložená
  minuta**, manifest se uzavře jako „nedokončeno" a aplikace **sama nic nemaže**. Je to stejné
  pravidlo jako R3 pro výpadek stopy. Dnešní chování je vada: chyba zápisu shodí obě stopy
  s technickou hláškou (`electron/main.cjs:560-578`).
- **Varování dřív než na nule:** klesne-li volné místo během nahrávání pod **500 MB**, žlutý pruh
  v kartě se zbývajícím časem podle měřeného toku. **NÁVRH.**
- Retence 7 dní (R19) maže **jen** položky ve stavu `uploaded`; janitor běží při startu a pak
  každých 15 min (**POPSÁNO**, `specs/E6-prihlaseni-a-fronta.md:65-69`). ⚠️ Dokud je
  `DESKTOP_UPLOAD_ENABLED` vypnutý (S1), **nic se neodešle, a tedy nic nesmaže** — disk poroste.
  Nastavení proto musí ukazovat skutečné číslo („na tomhle Macu: 6 nahrávek, 1,4 GB").

### Spolehlivost dvouhodinové nahrávky — čím se ověří

**2h nahrávka projde**
Given udělená oprávnění a nejméně 2 GB volného místa · When nahrávám dvě hodiny · Then obě stopy
jsou nenulové, pořadí chunků souvislé, manifest uzavřený, `sha256` sedí a **počet dekódovaných
vzorků odpovídá reálné délce s odchylkou ≤ 1 s na hodinu** (NÁVRH).
🔴 Délka se **nečte z hlavičky WebM** — ta celkovou délku nemá (**ZMĚŘENO**, `ROZHODNUTI.md:41`).
Měří se počtem vzorků po dekódování, jinak měřidlo lže.

### Co se smí zapsat při měření

Výkonnostní záznam nese `recordingId` jako GUID, délku, bajty, časy a názvy fází. **Nikdy zvuk,
token, e-mail ani název schůzky** (Danovo rozhodnutí 1. 9.). Diagnostika, kterou uživatel odešle,
se řídí týmž pravidlem.

---

## Responzivita

Dnešní panel má **pevných 366 × 792 px** a je zamčený `minHeight` i `maxHeight` při
`resizable: false` (**ZMĚŘENO**, `electron/main.cjs:27-28` a `286-291`). Na displeji 1280 × 800 je
použitelná výška kolem **775 px** (plocha bez horní lišty; se zobrazeným Dockem ještě míň), takže
panel **přeteče mimo plochu** a spodní část včetně patičky je nedosažitelná.

### Pravidlo výšky

- **Výška = `min(792, dostupná výška − 16 px)`.** Dostupnou výšku dává `workArea` displeje pod
  ikonou (`screen.getDisplayNearestPoint(...)`) — už má odečtenou horní lištu i Dock. Rezerva
  16 px je **NÁVRH**.
- Na 1280 × 800 z toho vychází **759 px** místo dnešních 792 (**DOPOČTENO**: 775 − 16).
- **Šířka zůstává 366 px vždy.** Panel neroluje vodorovně a nikdy se nezalamuje do dvou sloupců.
- **Minimální výška 360 px** (**NÁVRH**; hlavička 52 + patička 34 + rámeček 2 + vnitřní odsazení 28
  + dvě sbalené agendy 46 + 46 + mezera 11 = 219 px, zbytek je rolovací prostor). Je-li dostupná
  výška menší, panel zabere celou plochu a roluje — **nikdy nepřeteče**.
- Uživatel panel **nezvětšuje**; `resizable: false` zůstává. Výšku počítá aplikace, ne myš.
- Obsahová plocha při plné výšce: 792 − 52 − 34 − 2 (rámeček) − 28 (odsazení) = **676 px**
  dopočteno z návrhu; zadání uvádí změřených **670 px**. Rozdíl 6 px je v mezích měření, počítá se
  s **670 px**.

### Co je přilepené a co roluje

- **Hlavička 52 px a patička 34 px jsou pevné a nikdy nerolují.** Výšky jsou z návrhu
  (**ZMĚŘENO**, `design/navrh/nahled.html:48` a `:54`).
- 🔴 **Patička v návrhu nemá `flex-shrink: 0`** (`nahled.html:54`, na rozdíl od hlavičky na řádku
  48). Při zkrácení panelu se smrskne. Musí ho dostat — jinak celé tohle pravidlo tiše selže.
- Roluje **jen prostřední blok** (`.pb`), svisle, s `overscroll-behavior: contain`, aby rolování
  nepropadlo na okno a panel se nezavřel.
- **Běžící agenda je první** a při otevření je pohled na začátku, takže primární tlačítko
  („Zastavit") je vidět **bez rolování**. Pruhy, které přibývají za běhu (výpadek stopy, fronta,
  offline), zvětšují **rolovaný obsah**, ne výšku panelu.
- Karta se nikdy nekrátí, nezmenšuje písmem ani neschovává obsah do „…". Přeteče-li, roluje se.

### Jak se pozná, že obsah pokračuje

- Na hraně mezi rolovaným blokem a přilepenou částí je vlásková linka a krátký přechod podkladu —
  viditelný **jen když se tím směrem dá rolovat**, nahoru a dolů nezávisle.
- Signál je vždy **dvojí**: hrana **a** viditelně useknutý řádek. Obsah nikdy nekončí přesně na
  hraně karty, aby to nevypadalo jako konec seznamu (§7: stav se nesděluje jen barvou — a tady ani
  jen stínem).
- Rolovaný blok je dosažitelný **klávesnicí** (↑ ↓ PageUp PageDown Home End). Přesun fokusu na
  prvek mimo pohled ho **doroluje** (`scrollIntoView({ block: 'nearest' })`).
- `prefers-reduced-motion` vypíná plynulé rolování — **už je ošetřené** (**ZMĚŘENO**,
  `src/styles.css:1337-1343`).
- Ukazatel rolování se **nesmí objevit, když se rolovat nedá** — na velkém displeji panel neroluje
  skoro nikdy.

### Změna rozlišení a displeje za běhu

- Výška se přepočítá při: **každém otevření panelu**, `display-metrics-changed`, `display-added`,
  `display-removed` a probuzení (`powerMonitor` `resume`).
- 🔴 **Přepočet nesmí zasáhnout do agend.** Nahrávání ani časovač se nezastaví, neresetuje
  a nepřeruší; renderer se znovu nenačítá.
- Panel visí pod ikonou, takže se **horní hrana nehýbe** a mění se spodní. Pozice rolování zůstává
  ukotvená na horní okraj viditelného bloku.
- Odpojení externího monitoru za běhu je týž případ: panel se zkrátí, obsah zůstane dostupný
  rolováním, nic se neschová.
- Je-li panel zavřený, nová výška se jen uloží a použije při dalším otevření.

### Acceptance scenarios

**Panel se vejde na malý displej**
Given displej 1280 × 800 se skrytým Dockem (dostupná výška 775 px) · When otevřu panel · Then je
vysoký nejvýš **759 px**, spodní hrana je nad okrajem plochy a **patička je celá vidět**.

**Krácení nic neschová**
Given panel zkrácený na minimum a obě agendy běžící · When roluji · Then je dosažitelný každý
ovládací prvek, hlavička i patička zůstávají na místě a v obou krajních polohách je poznat,
kterým směrem obsah pokračuje.

**Změna rozlišení nezastaví nahrávání**
Given běžící nahrávání a otevřený panel · When odpojím externí monitor · Then se panel překreslí
na novou výšku, **nahrávání běží dál bez přerušení stopy** a časovač si drží čas.


---

## Předpoklady, na kterých to stojí

- Sekce jsem napsal BEZ čísel v nadpisech. spec.md čísluje ## 1.–## 10.; přirozené místo je za §7 (Přístupnost a copy), ale protože do dokumentu vkládá blok víc agentů naráz, čísla musí doplnit ten, kdo bloky slučuje.
- 2 hodiny beru jako požadavek na spolehlivost, ne jako tvrdý strop. Co se stane ve 121. minutě (pokračuje / rozdělí / varuje) nikde rozhodnuté není a nevymýšlím to.
- Číslo 160 MB ze zadání jsem NEPŘEVZAL jako fakt — naměřený tok mikrofonu (85 169 B / 5,01 s, NAHRAVANI.md) dává na 2 h sám o sobě ~123 MB. Uvádím dopočtený rozsah 125–245 MB a pro dimenzování 250 MB. Pokud Dan trvá na 160 MB, je to jeho rozhodnutí a musí být označené jako odhad.
- Dostupnou výškou rozumím workArea displeje pod ikonou (Electron screen API) — už má odečtenou horní lištu i Dock. Zadaných 775 px na 1280×800 tedy platí pro SKRYTÝ Dock; se zobrazeným je jich méně a vzorec platí dál.
- Rezerva 16 px pod panelem, minimum 360 px a práh varování 500 MB volného místa jsou moje návrhy, nikde v repu nejsou.
- Časové limity píšu jako p95 — repo žádný percentil nedefinuje, ale jednoduché „vždy pod X" u startu nahrávání není měřitelné na stroji, kde běží jiné aplikace.
- Strop paměti 500 MB je zástupné číslo bez podkladu: klidová spotřeba Electronu na Danově Macu nebyla nikdy změřena. Napsal jsem to do specu otevřeně.
- Chování při ENOSPC (zastavit jen postiženou stopu, druhá pokračuje) jsem odvodil z R3, které totéž nařizuje pro výpadek stopy. Dan to pro disk výslovně nerozhodl.
- Obsahová plocha: ze schváleného návrhu vychází 676 px (792 − 52 hlavička − 34 patička − 2 rámeček − 28 odsazení), zadání uvádí změřených 670 px. Rozdíl 6 px jsem nechal být a počítám s 670.

## Otázky na Dana

- Dvě hodiny = spolehlivost, nebo strop? Co má aplikace udělat ve 121. minutě — nahrávat dál bez omezení, uzavřít stopu a založit navazující, nebo aspoň varovat?
- Dimenzování na 250 MB místo 160 MB na jednu 2h schůzku (měřený tok mikrofonu sám dá ~123 MB) — bereš?
- Pojistka na disk z E6 zní 2 GB volno / složka do 5 GB. Dokud je odesílání vypnuté (S1), nic se nemaže a 5 GB dojde po ~20 schůzkách. Má se pak nahrávání ODMÍTNOUT, nebo limit zvednout?
- Můžu si na tvém Macu vyžádat jeden 2h měřicí běh (paměť, CPU, rozjezd stop, velikosti)? Bez něj zůstane strop paměti i CPU jako nepodložený návrh — agent to nezměří.
- Minimální výška panelu 360 px a rezerva 16 px pod spodní hranou — sedí, nebo chceš jiné dno?
- Práh varování „dochází místo" během nahrávání: 500 MB volna, nebo raději zbývající čas nahrávání (např. „vystačí na 35 minut")?
