# Intent: LuDone Desktop — nahrávání schůzek a výkaz času

> Psáno **zpětně 1. 9. 2026**. Lifecycle začal rovnou od discovery, takže tenhle dokument
> vzniká až po schváleném designu — audit to vede jako odchylku **O2**. Obsah není domyšlený:
> vychází z Danova doslovného vstupu (`design/zadani/dan-vstup-2026-09-01.md`), ze závazného
> briefu (`design/zadani/BRIEF.md`) a z rozhodnutí M1–M20 (`decisions.md`).

## Problem

Dan platí za krabičku Plaud, která nahrává schůzky, a nechce v tom pokračovat — jednak kvůli
paušálu, jednak proto, že nemůže měnit, co dělá, a používá osekané funkce. Nahrávky navíc končí
u něj, ne u týmu.

Vedle toho tým vykazuje čas v LuTracku, který běží jako samostatná webová aplikace. Kdo pracuje
na Macu, musí kvůli spuštění časovače přepnout do prohlížeče — a když na to zapomene, hodiny
chybí. Dvě činnosti, které se dějí u téhož počítače ve stejnou chvíli, žijí na dvou různých
místech a ani jedna není po ruce.

## Desired outcome

Jedna aplikace na macOS, která je pořád po ruce v horní liště a umí dvě věci:

1. **nahrát schůzku** dvěma oddělenými stopami (můj hlas zvlášť, druhá strana zvlášť) a dostat
   ji na server, kde je dostupná celému týmu;
2. **měřit čas** na projektu — spustit, během dne přepnout projekt, zastavit.

Poznáme to takto: Dan přestane platit za Plaud, aniž by přišel o záznamy ze schůzek; a hodiny
se vykazují, aniž by kvůli tomu kdokoli otevíral prohlížeč.

## Affected users

- **Dan** — první uživatel, zároveň ten, kdo aplikaci udržuje.
- **Tým Make more** (~24 lidí vykazujících čas) — LuTrack používají všichni, takže časová agenda
  se dotýká celé firmy, ne jednoho člověka.
- **Účastníci schůzek**, včetně lidí mimo firmu. Nejsou uživatelé, ale jsou v nahrávkách —
  proto je právní rámec součástí rozsahu, ne příloha.

## Primary journey

Ráno spustím časovač na projektu, na kterém pracuji. Přijde schůzka, kliknu na Nahrát — časovač
běží dál, jsou to dvě nezávislé věci. Po schůzce nahrávání zastavím, potvrdím předvyplněný název
a nahrávka odejde na server. Odpoledne přepnu časovač na jiný projekt. Večer zavřu notebook;
co se nestihlo odeslat, odejde po probuzení samo.

## Affected systems and data

| Systém | Jak se ho to týká |
|---|---|
| **app.ludone.cz** | Přihlášení (OAuth 2.1 + PKCE, loopback). Cílové místo pro nahrávky. Archiv, přepisy a hledání zůstávají tady |
| **LuTrack / Supabase** | Časové záznamy. 🔴 **Money-path** — hodiny tečou týdenním souhrnem do Tabidoo a přes sklad do mzdových nákladů projektů v HR, táborech, rozpočtech a CFO |
| **Tabidoo** | Nepřímo, přes souhrny z LuTracku. Desktop do něj **nikdy nezapisuje přímo** |
| **macOS** | Oprávnění na mikrofon a systémový zvuk, ikona v liště, oznámení, podpis a rozvoz |

## Constraints

- **Nulový měsíční paušál** je tvrdé kritérium (A2). Jednorázové platby a platba za spotřebu ano.
- **Desktop je spouštěč, ne platforma** (A11). Archiv, přepisy, hledání a přehledy zůstávají na webu (A12).
- **Lokální přepis se nepoužije** (A4) — běží v cloudu přes klíč.
- **Žádný nový hardware** (A5).
- **Vzhled se řídí LuDone Přístroj DS**, ne generickým macOS vzhledem (M12).
- **Dvě agendy mají nezávislý životní cyklus** — nesdílejí start ani stop (závazná korekce 24. 8.).
- **Desktop se nesmí přidrátovat k jednomu backendu** — Dan rozhodl „zatím nikam, později do
  app.ludone", takže časová agenda musí jít přes adaptér.
- **Klient nikdy neposílá hodinovou sazbu** — dosazuje ji databáze z alokace.
- 🔴 **Vyřazovací kritérium A6:** když se z Google Meetu nedá nahrát druhá strana hovoru, projekt
  v současné podobě ztrácí smysl. **Zatím nezměřeno.**

## Non-goals

- Archiv, přepisy, hledání a grafy v desktopu — patří na web.
- Mobilní aplikace ani companion pro Watch (A5).
- Management a admin LuTracku — zůstávají na `app.ludone.cz` (M10).
- **Napojení na kalendář** — zrušeno (M15). Nahrávku identifikuje datum, čas, projekt z běžícího
  časovače a textové pole při zastavení.
- Seznam účastníků schůzky — **ztrácí se bez náhrady**, doloženo měřením.

## Success signals

| Co | Jak se to pozná |
|---|---|
| Zachycení druhé strany funguje | Měření A6 na skutečné schůzce vrátí FUNGUJE a ukázka zní jako řeč |
| Nahrávka doputuje sama | Nahraju, zavřu notebook, po probuzení je na serveru — bez zásahu a bez duplikátu |
| Hodiny se vykazují z Macu | Záznam z desktopu se objeví v týdenním souhrnu se správnou sazbou |
| Aplikace je vidět | Po spuštění je ikona v liště rozeznatelná a klik otevře panel |
| Plaud je zbytečný | Dan zruší předplatné, aniž by přišel o záznamy |

## Open questions

| # | Otázka | Doporučený default | Kdo |
|---|---|---|---|
| **N1** | Kam desktop píše hodiny | Dan rozhodl: **zatím nikam**, později přes `app.ludone.cz`. Do té doby lokální úložiště za adaptérem | rozhodnuto |
| **N2** | Přesunout jedinečnost časovače a zákaz překryvů do databáze? | **Ne teď** — zásah do provozu 24 lidí. Spec musí popsat, jak se desktop zachová, když pravidla poruší jiný klient | Dan |
| **M11** | Zůstane LuTrack samostatnou PWA, nebo se přestěhuje do `ludone-app`? | **Nechat otevřené** — adaptér drží obě budoucnosti | Dan |
| **D4** | Čím přepisovat | `gemini-3.5-transcribe`, 0,60 $ za hodinu schůzky. Podmíněno jedním ostrým testem na české hodinovce | Dan |
| **D6** | Právní rámec nahrávání | **Blokuje první ostrou nahrávku**, ne vývoj | Dan |
| **E10** | Apple Developer Program (99 $/rok) | **Nekupovat**, dokud neproběhne párový experiment P1/P2 | Dan |
