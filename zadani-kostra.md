# Zadání B: kostra aplikace LuDone Desktop

Postav **klikatelnou kostru** aplikace. Zvuk se v tomhle běhu neřeší vůbec — nahrávání je
předstírané. Souběžně běží druhý pokus, který zvuk dokazuje; ty se soustřeď na to, jak se to ovládá.

## POSTUP — závazné pořadí

1. Ověř `pwd` = `/Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/kostra`.
2. Napiš kód **na disk**.
3. **Spusť to a proklikej.** Ne „mělo by to jít" — spusť aplikaci, otevři panel, přepni stavy.
4. Zapiš `KOSTRA.md` — co funguje, co je předstírané, co chybí.
5. `git --no-pager status --porcelain`, commitni (jsi na větvi `feat/kostra-appky`).
6. Teprve pak odpověz JSON.

## MANTINELY

- `GIT_PAGER=cat`, `PAGER=cat`, `git --no-pager`. Nic interaktivního.
- Do `/tmp` nesmíš. **SMÍŠ MĚNIT jen svůj worktree** — sousední `zvuk` je cizí, nesahej na něj.
- Máš síť, ale **instaluj co nejmíň**. Disk má okolo 16 GB. Žádný stavový nástroj, žádná knihovna
  komponent, žádný router. React, Electron, hotovo.
- Commituj průběžně, nepushuj.

## CO TO JE ZA APLIKACI

**Spouštěč, ne platforma.** Majitel to řekl takhle: *„je to prostě jen spouštěč v pc, který pak
integruješ do app.ludone.cz — musí to být jednoduché, přehledné a nápadité, kreativní."*

Archiv nahrávek, přepisy, hledání a vyhodnocení **jsou ve webu** a do aplikace nepatří.
V aplikaci je jen tolik, kolik je potřeba, aby člověk spustil nahrávání a měřil čas.

🔴 **Jedna výjimka, kterou majitel doplnil:** aplikace **vidí do kalendáře**, aby uměla doporučit
nahrávání. Tedy **dnešní schůzky ano** (co mě čeká, nahrát?), **archiv nahraných ne**.

## OBRAZOVKY

### 1. Ikona v horní liště — hlavní rozhraní

Aplikace nemá ikonu v Docku. Žije v liště. Ikona má **čtyři stavy**, poznatelné na první pohled:
nečinná · nahrává (výrazné, ale ne blikající) · měří čas · nepřihlášeno (tlumené).

### 2. Panel po kliknutí — nejdůležitější obrazovka

Šířka kolem 340 pixelů. Shora dolů:

- **Co mě dnes čeká** — nejbližší dvě až tři události z kalendáře, u každé čas, název a tlačítko
  „Nahrát". Tohle je jádro panelu. Když nic není, řekni to hezky, neukazuj prázdnou tabulku.
- **Nahrávání** — velké tlačítko. Když běží, ukazuje čas a odkud se bere zvuk.
- **Časovač (LuTrack)** — viz níž.
- **Dole** — kdo je přihlášený a ozubené kolečko do nastavení.

### 3. Časovač — připrav na LuTrack od začátku

🔴 Majitel to výslovně chce: *„a taky rovnou přípravu na ten LuTrack, aby bylo kompatibilní
to technické a designové řešení."* A: *„LuTrack je prostě jednoduchý malý toggl styl."*

Tedy: spustit, zastavit, vybrat projekt, volitelně popis. Nic víc — žádné výkazy, žádné grafy.

**Pro tvůj návrh z toho plyne to podstatné:** nahrávání a měření času jsou **dvě rovnocenné funkce
jednoho panelu**, ne hlavní věc a přílepek. Struktura kódu to musí odrážet — společné je okno,
panel, přihlášení, nastavení a stav; každá funkce je samostatný celek, který jde přidat nebo
odebrat, aniž se sáhne na ten druhý. Popiš v `KOSTRA.md`, jak jsi to rozdělil a proč.

### 4. První spuštění

Uvítání → přihlášení do LuDone → udělení oprávnění (mikrofon, systémový zvuk, kalendář) → hotovo.
Přihlášení předstírej tlačítkem, ale **postav to tak, aby šlo doplnit skutečné**: otevře se prohlížeč,
člověk se přihlásí, aplikace dostane token. Nedělej vlastní přihlašovací formulář — heslo aplikace
nikdy nevidí.

### 5. Nastavení

Malé okno, tři skupiny: **kdy nahrávat** (schůzku z kalendáře sám / u ostatních se zeptat),
**co se děje se zvukem** (jak dlouho zůstane na Macu), **účet a připojení** (kam to jde).

## VZHLED

Drž se design systému LuDone z `/Users/dan/Dev/ClaudeCode/LuDone/ludone-app`:

- **Písma:** Brockmann (nadpisy) a Public Sans (text). Brockmann je licencovaný a self-hosted —
  v prototypu použij systémové písmo a napiš to do `KOSTRA.md`.
- **Barvy:** neutrální šedá paleta, akcent zelený `oklch(0.5 0.17 145)`. Vytáhni si přesné hodnoty
  z `src/app/globals.css`.
- 🔴 **Tmavý režim je povinný a je výchozí.** Majitel má na svém Macu tmavý režim a zapnuté
  „Omezit průhlednost" — takže **nepoužívej průhlednost jako nosný prvek**; musí to vypadat dobře
  i jako plná plocha.
- Ikony kresli jako SVG, nikdy emoji.
- Rohy oken: nativní Tahoe má výrazně kulatější rohy než běžné Electron aplikace. Použij poloměr
  kolem 26 px a drž soustřednost (poloměr vnitřního prvku = poloměr rodiče minus odsazení).

## CO ZMĚŘIT A ZAPSAT DO `KOSTRA.md`

1. Co jde skutečně proklikat a co je předstírané. Buď přesný.
2. Jak jsi rozdělil kód a proč — zvlášť to rozdělení nahrávání × časovač.
3. Velikost `node_modules`, doba prvního sestavení, velikost hotové aplikace.
4. **Co v zadání chybělo nebo si odporovalo.**
5. Co bys navrhl jinak — jsi první, kdo to viděl v pohybu, tvůj názor má cenu.

## OUTPUT CONTRACT

```json
{
  "summary": "3-5 vět",
  "spustilJsemToOpravdu": true,
  "coJdeProkliknout": ["seznam obrazovek a stavů, které jsi opravdu viděl"],
  "coJePredstirane": ["seznam"],
  "rozdeleniKodu": "jak jsi oddělil společnou část, nahrávání a časovač",
  "ocekavanePocty": {
    "vytvorenychSouboru": 0,
    "radkuKodu": 0,
    "poctCommitu": 0,
    "velikostNodeModulesMB": 0,
    "zmenenychSouboruMimoWorktree": 0
  },
  "navrhyNaZmenu": ["co bys udělal jinak"],
  "notes": ["co chybělo v zadání"]
}
```

`radkuKodu` a `vytvorenychSouboru` musí být větší než nula, `zmenenychSouboruMimoWorktree` = 0.
`spustilJsemToOpravdu` napiš `true` jen tehdy, když jsi aplikaci opravdu spustil a proklikal.
