# Specifikace — LuDone Desktop 0.1.5

## Cíle

1. Zachovat současné nahrávání, souhlas s odesláním, frontu a automatické aktualizace.
2. Z hlavního panelu otevřít existující přehled Nahrávek jedním kliknutím a použít značku LuDone i čitelný stav lišty.
3. Pravdivě označit LuTrack jako připravovaný a vydat desktopovou verzi 0.1.5 zavedeným workflow.

## Non-goals

- Neimplementovat LuTrack, lokální náhradu timeru ani síťové volání pro záznam času.
- Neměnit backend, web, serverový kontrakt, repo LuTracku ani cizí `design/`.
- Nepřekreslovat kompletní aplikaci ani měnit consent pro odeslání nahrávky.

## Feature katalog

### DESKTOP-ASTRA-0-1-5-01 — Každodenní používání desktopu

Umožní uživateli LuDone rychle otevřít skutečné nahrávky, rozpoznat aplikaci a bezpečně poznat, že LuTrack zatím není dostupný.

## Doménová pravidla a hranice

- Okno Nastavení zůstává dokumentem `#settings`; `settingsTab` smí vybrat pouze `account` nebo `recordingQueue`.
- Odeslání nahrávky se řídí existujícím rozhodnutím uživatele. Automatické odesílání ani serverové změny do této práce nepatří.
- LuTrack v aktuálním desktopu nemá běžící, ukládaný ani odesílaný čas. Jeho společný budoucí UX návrh zůstává uložen v `docs/changes/desktop-redesign-2026-09-23/lutrack/`.
- Stav testů, skutečné pozorování aplikace, produkční publikace a ověření na Macu jsou oddělené důkazy.

## Kontrakty rozhraní

### Přímá navigace do Nastavení

| část | kontrakt |
|---|---|
| vstup | Panel požádá o `account` nebo `recordingQueue`. Renderer i hlavní proces ověří allowlist. |
| úspěch | Jediné okno Nastavení se otevře nebo přepne na žádanou kartu. První otevření předá kartu query parametrem. |
| bezpečnost | Hash dokumentu zůstává `#settings`, takže stávající kontrola odesílatele IPC a systémového zvuku platí beze změny. |
| chyba | Neznámá karta se odmítne; nové okno nevznikne a stav nahrávání se nezmění. Událost doručená před registrací React odběratele se podrží v preloadu. |

### Budoucí stav LuTracku

| část | kontrakt |
|---|---|
| viditelnost | Panel zobrazí „Připravujeme“ a sdělí, že časovač není součástí desktopové verze. |
| akce | Žádné tlačítko, tray položka ani globální zkratka pro start/stop. |
| důsledek | Kliknutí, reload ani tray událost nevytvoří lokální či serverový časový záznam. |

## Akceptační scénáře

### DESKTOP-ASTRA-0-1-5-01

#### AC-01.1 — Přímý vstup do Nahrávek

**Given** je panel připraven a uživatel může pracovat s aplikací, **when** zvolí Nahrávky, **then** se otevře skutečný dashboard v širším okně Nastavení bez dalšího kliknutí.

#### AC-01.2 — Bezpečnostní identita a opakované otevření

**Given** okno Nastavení už existuje nebo právě načítá, **when** uživatel zvolí podporovanou kartu, **then** se použije stejné okno a dokument zůstane na `#settings`; rychlé přepnutí se neztratí.

#### AC-01.3 — Neznámá karta

**Given** renderer předá nepodporovaný název karty, **when** požadavek zpracuje hlavní proces, **then** požadavek odmítne a nevytvoří nové okno.

#### AC-01.4 — Připravovaný LuTrack

**Given** uživatel otevře panel, **when** LuTrack ještě není dostupný, **then** vidí pouze vysvětlující stav bez tlačítek a hodnoty naměřeného času; tray příkaz timer nespustí.

#### AC-01.5 — Automatické kontroly a vydání

**Given** desktopová verze má být vydána, **when** proběhnou projektové brány a existující release workflow, **then** se ověří build, podpis, notarizace, publikované soubory a metadata aktualizace; žádný z těchto kroků se nevydává za skutečný test zvuku nebo instalace.

## Odložený rozsah

- Společný návrh budoucího workflow LuTracku a Nahrávek je uložen v `docs/changes/desktop-redesign-2026-09-23/lutrack/`.
- Implementace LuTrack služby, její API, účetní pravidla a předávání času do `app.ludone.cz` začnou až po připravenosti této služby a jako samostatná schválená změna.

## Otevřené otázky

Žádná otázka neblokuje tento implementační výřez. Skutečné nahrávání, produkční upload a instalaci aktualizace ověří Dan na skutečném Macu podle `OVERENI-NA-MACU.md`; tyto ruční kroky jsou čekající důkazy, nikoli otevřené produktové volby.

## Konflikty, které specifikace řeší nahlas

- **Demo timer v původní UI vs. připravenost služby:** aktuální uživatelský pokyn D2 je autoritativní; timer je vypnutý a budoucí design zůstává pouze návrhem.
- **Rychlá karta vs. oprávňovací hash:** query parametr určuje výchozí kartu, zatímco `#settings` zůstává podle bezpečnostního kódu a IPC testů.
- **Zelené testy vs. živé vydání:** testy dokazují jen kontrolovaný software; skutečný zvuk, server a update se za ověřené označí až po pozorování na daném Macu.
