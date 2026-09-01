# UI kit — LuDone Desktop (macOS spouštěč)

> ZÁLOHA opsaná 1. 9. 2026 z Claude Designu, projekt „LuDone Přístroj Design System"
> (c5ee8498), cesta `ui_kits/ludone-desktop/README.md`. Doslovně, beze změn.

Klikací srovnání tří směrů. Otevři `index.html`. Koncept k rozhodnutí, **ne implementace** —
do repozitáře `ludone-desktop` z tohohle kitu nic nešlo.

## Co se rozhoduje

| Směr | Co to je | Kdy dává smysl |
|---|---|---|
| **A** | Kompaktní panel 312 bodů, jediná plocha. Ikona v liště nese stav sama, žádný notch. Větší okno jen pro první spuštění a nastavení. | Nejmenší rozsah, nejrychlejší cesta k použitelné appce |
| **B1** ★ | Hybrid: notch → panel 380 bodů → soustředěné okno bez sidebaru. **LuTrack a nahrávání jsou dvě nezávislé agendy**, každá s vlastním startem i stopem. | Rovnováha rychlosti a kontextu, respektuje závaznou korekci |
| **B2** ⚠ | Týž layout, ale **jedna společná relace** s jedním „Spustit relaci" a jedním „Zastavit relaci". Původní podoba hybridu. | Jednodušší model, ale LuTrack tím dostane životní cyklus schůzky, který nemá |
| **C** | Širší pracovní konzole: notch → Control Center → dnešní konzole se sidebarem a inspektorem. | Ucelený systém pro další růst, největší riziko rozsahu |

**B1 a B2 se liší jen tím, jestli je Stop jeden, nebo dva.** Jsou tam obě schválně — rozhodnutí se
dělá pohledem na stavy *Změna projektu* a *Výpadek zvuku*, kde se ukáže, jestli si agendy vzájemně
sahají do života.

## Osm stavů

`Klid` · `Jen LuTrack` · `Jen nahrávání` · `Obojí` · `Změna projektu LuTracku během nahrávání` ·
`Výpadek systémového zvuku` · `Čeká na odeslání` · `Plné okno a nastavení`

Všech osm kreslí **B1 a B2**. Směry **A** a **C** kreslí jen ty stavy, kde se od nich opravdu liší
— zbylá tlačítka jsou zašedlá.

## Jak to ovládat

- Nahoře vlevo se přepíná **směr** (A · B1 ★ · B2 ⚠ · C), vpravo **stav** a **tmavý režim**.
- Panel i okno sedí pod skutečnou macOS lištou. Ikona LuDone je tam mezi sedmnácti cizími
  ikonami — schválně, aby šlo posoudit, jestli je v provozu vůbec k rozeznání.
- Směry s notchem (B, C) ukazují stav uprostřed lišty jako `TIME 38:12` / `REC 12:41`.
  Směr A notch nemá a nese stav samotnou ikonou.

## Co tenhle kit záměrně nedělá

- **Žádný archiv, přepisy, hledání ani dashboardy.** Zůstávají v `app.ludone.cz`; desktop je spouštěč.
- **Žádné companion pohledy pro iPhone a Watch** z původního návrhu Ekosystém. Rozhodnutí A5 mobil
  zavírá a iPhone druhou stranu hovoru zachytit neumí — kreslit je by slibovalo funkci, která nebude.
- **Žádná zelená z mockupů.** Kit jede na tokenech Přístroje (`--accent` indigová, `--state-ok`,
  `--state-bad`, `--state-wait`). Jestli má mít desktop vlastní zelený akcent, je otevřené
  rozhodnutí — patřilo by pak do `tokens/desktop.css`, ne do sdíleného `tokens/colors.css`.

## Reference

Ve složce `reference/` leží tři původní návrhy z VPS (`navrh-1-ekosystem`, `navrh-z-prvni-seasion`,
`navrh-3-hybrid`) i s náhledy a srovnávací tabulkou, a `BRIEF.md` — funkční zadání, které je
autoritativní. Vizuální návrhy jsou podklad k porovnání, ne schválené zadání.

🔴 **Původní Ekosystém i Hybrid modelovaly jednu společnou pracovní relaci** („Nová pracovní relace",
„Zastavit relaci", LuTrack a nahrávání jako dva přepínače jedné věci). To je v rozporu se závaznou
korekcí. Jediný, kdo agendy odděloval už v původní kresbě, je návrh z první session.
