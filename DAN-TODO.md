# Co čeká na Dana — LuDone Desktop

**Přerovnáno 7. 9. 2026.** Soubor měl 58 sekcí a 1870 řádků od 24. srpna; většina už byla
vyřízená, ale nebylo to poznat. 🔴 **Tři položky, které vypadaly otevřeně, jsem ověřil
a byly dávno hotové** — CI je zelené, `ui-smoke` opravený (#72), kalendář ze zdrojáku pryč.
Historie se nemaže, přestěhovala se do [`DAN-TODO-archiv.md`](DAN-TODO-archiv.md).

**Níž je jen to, co je opravdu otevřené. Nic z toho neblokuje vývoj.**

---

## 🔴 JEDNO ROZHODNUTÍ O NÁVRHU, KTERÉ SI VZÍT NESMÍM

🔴 **OPRAVA MÉ DIAGNÓZY (4. 9. v noci):** tvoje „ikona není vidět" **NENÍ o kontrastu.**
Změřil jsem to naostro: macOS hlásí položku na x=806 z 1512 bodů, tedy **ve výřezu (notch)**,
a v tom místě je 7168 pixelů, ze kterých **ani jeden není jasnější než 32** — nekreslí se tam
nic. Soubory ikon jsou přitom v pořádku (94 a 323 neprůhledných pixelů). Vpravo pro ni
nezbylo místo, tak ji macOS položil pod výřez a nevykreslil.
**Návrh s tím počítal** (`nahled.html:674`): *„na přítomnost ikony v liště se nemá spoléhat —
schová ji notch nebo jiná aplikace"*, a schválená záchrana je **přepínač „Zobrazovat i ikonu
v Docku"**, který jsme nepostavili. Stavím ho. Rozhodovat nemusíš nic.

**Barevné ikony v liště propadají kontrastem na SVĚTLÉ liště.** To je *jiná* a pořád platná
věc (spočítaná, ne pozorovaná) — rozhodnutí níž stojí:

| barva | na bílé | na černé |
|---|---|---|
| korálová `oklch(0.75 0.14 34)` | 🔴 **2,35 : 1** | 8,94 : 1 |
| tyrkysová `oklch(0.78 0.11 178)` | 🔴 **1,91 : 1** | 11,01 : 1 |

Obě propadají i mírné hranici **3 : 1**. PR #64 opravil tvůj případ tím, že **klidové stavy
vrátil na šablonové** (macOS je tónuje sám podle skutečné lišty) — ale u **aktivních stavů**
`recording` a `tracking` zůstává barva z návrhu a **na světlé liště je špatně vidět**.

**Vlastní odstín jsem si nevymyslel** — rozešel by se se schváleným návrhem. Varianty:

| | co to znamená |
|---|---|
| **kontrastní obrys nebo halo** kolem ikony | barva zůstane, přidá se tenký obrys v barvě lišty; ikona se mírně „ztuční" |
| **přesunout barvu mimo ikonu** | ikona šablonová vždy, barvu nést v **textu vedle** (čas nahrávání je tam už dnes) |
| **obětovat barvu úplně** | šablonové i pro nahrávání; stav pozná jen tvar. Nejbezpečnější, nejchudší |

Jsou to všechno zásahy do schváleného návrhu, proto se ptám.


## 🟡 POZOROVÁNÍ K LUTRACKU (nesahal jsem na to, je to tvoje odložené rozhodnutí)

Pustil jsem měření času naostro a zastavil ho. Funguje, projekt si vybere, čas běží.
Po zastavení ale aplikace teprve řekne: **„Čas zastaven · uložení do LuTracku je ukázkové."**

Před spuštěním o tom **není ani slovo** — na kartě je jen „LuTrack / Spustit". Kdo si odměří
tři hodiny práce, dozví se až na konci, že se nikam neuložily. Je to táž třída vady, jakou
jsem dnes v noci opravoval u fronty („další pokus teď", který nikdy nepřijde).

**Neopravil jsem to,** protože `decisions.md` C3 říká *„LuTrack: jen příprava"* a M11 nechává
osud živého LuTracku **odložený na tebe**. Věta o ukázkovém uložení navíc není ve specifikaci
ani v návrhu — vznikla v kódu. Kdybych přesunul sdělení dopředu, rozhodoval bych o produktu.

**Doporučení, až na to dojde:** říct to **před** spuštěním, ne po zastavení.


## 🟡 POZOROVÁNÍ Z NAHRÁVÁNÍ NAOSTRO (6. 9.) — jedno rozhodnutí je tvoje

Prohnal jsem nahrávání živě s **podstrčeným syntetickým zvukem** (440 Hz mikrofon, 880 Hz
systém), abych ti nenahrával pokoj. Celý tok funguje: start · měřáky · souběh s LuTrackem ·
zastavení · pojmenování · export do Stažených · zařazení do fronty. Po sobě jsem uklidil,
fronta i složka nahrávek jsou přesně jako předtím (16 položek, 49 souborů).

**Co jsem NEROZHODL a nechávám tobě:** když se systémový zvuk nepodaří získat, aplikace
správně nabídne pokračovat jen s mikrofonem a panel to říká naplno („NAHRÁVÁ SE OMEZENĚ ·
Ostatní zvuk: ticho"). **Lišta ale v tu chvíli ukazuje obyčejné nahrávání** — `výpadekZvuku=false`.

Rozlišují se totiž dva stavy: `unavailable` (jen mikrofon, uživatel to přijal) a `lost`
(zvuk se získal a spadl uprostřed). Červený odznak v liště se rozsvítí jen u druhého.

- **Argument pro změnu:** návrh u toho stavu píše *„je to právě chvíle, kdy je panel zavřený"* —
  a při zavřeném panelu nemáš jak poznat, že se druhá strana nenahrává.
- **Argument proti:** uživatel na jednostopé nahrávání **výslovně kývl**, takže červený
  poplach by byl křik o něčem, co sám zvolil.

Je to produktové rozhodnutí o tom, kdy má lišta křičet — nesahal jsem na to. Kdyby ti to
mělo hrát roli, doporučuju **tichý odznak** místo červeného: informace bez poplachu.


## 🔴 JEDNO ROZHODNUTÍ Z AUDITU (6. 9.) — co znamená „přihlášen"

Audit našel a já ověřil: **po vypršení access tokenu panel dál hlásí „připojeno"** a Nastavení
zelené „Přihlášen", ačkoli nahrávací kontext už vrací `null`. Jsou to dvě různá pojetí:
`hasStoredAuthSession` kontroluje jen vydavatele, `recordingUploadContext` navíc `accessExpiresAt`.

**Neopravil jsem to sám**, protože odpověď je produktová:
- **a)** vypršelý token = odhlášen (uživatel projde přihlášením znovu), nebo
- **b)** zůstat „přihlášen" a nabídnout znovupřihlášení, až bude potřeba.

`spec.md` navíc už přiznává, že chybí samostatná obrazovka **„Přihlášení vypršelo"** — takže
tohle rozhodnutí se s ní potká. Doporučuju **(a)**: tvrdit „připojeno" o spojení, které
nefunguje, je táž nepoctivost jako „další pokus teď" u vypnutého odesílání.

Druhý vysoký nález (**odhlášení, které server neodvolal**) neřeším přes tebe — opravuju ho,
protože tam je správná odpověď jednoznačná: uživatel se to musí dozvědět.


## ✅ A2 VYŘEŠENO (7. 9. 2026) — Dan požádal o Apple Developer Program

Čeká se na schválení Applem. Tím padá blokátor osy `exposure`: dokud nebyl program, nemohl
vzniknout podepsaný build a **nic se nemohlo dostat k týmu**.

**Co dělám mezitím:** připravím celou podepisovací a notarizační cestu tak, aby po schválení
zbylo jen vložit certifikát — ne aby se to teprve začalo řešit. Certifikát ani Team ID
po tobě nechci, dokud nedorazí.


## 🔴 NÁLEZ K ROZHODNUTÍ — neplatná relace ti vezme Stop uprostřed nahrávání

Ověřeno na nezměněném `main`, není to novinka z mých změn: **když relace zneplatní během
nahrávání, panel schová ovládání nahrávání i frontu — ale nahrávání běží dál.**

**Slepá ulička to není:** pravý klik na ikonu v liště má „Ukončit nahrávání".
⚠️ Jenže ta ikona se ti schovává pod výřezem, takže záchrana visí na něčem, co nevidíš.

**Neopravil jsem to sám**, protože odpověď je produktová i bezpečnostní:
- **a)** běžící nahrávání má ovládání ponechat, i když relace vypršela (dokončit, co běží),
- **b)** neplatná relace má ovládání vzít (nikdo bez platné relace nemá sahat na data).

Doporučuju **(a)**: nahrávka už na disku vzniká, takže odepřením tlačítka Stop nic nechráníš —
jen znemožníš její řádné ukončení. A je to táž logika jako u „Jen uložit": nebrat uživateli
cestu ven z něčeho, co běží.

**Souvisí s tím moje odložené rozhodnutí R1** (vypršelý token = odhlášen). Nechal jsem ho
nepostavené právě proto, že by tenhle případ zhoršilo.

