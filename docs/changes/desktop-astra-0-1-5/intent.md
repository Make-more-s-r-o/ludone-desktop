---
tier: L
change_id: desktop-astra-0-1-5
---

# Záměr — LuDone Desktop 0.1.5: Astra Nit dne

**Vznikl:** 24. 9. 2026 · **Autor záměru:** Dan (produktový záměr), Codex (zápis) · **Zdroj:** schválený návrh round 2 a pokyny v tomto vlákně.

## Problém

Desktopová aplikace obsahuje skutečné nahrávání a odchozí frontu, ale její malé okno a navigace ztěžují běžnou práci s nahrávkami. V panelu je také viditelný časovač, který nepředstavuje připravenou integraci LuTracku. Uživatel zvolil směr Astra „Nit dne“ a chce funkční část připravit k vydání.

## Cílový výsledek

LuDone Desktop působí jako rozpoznatelná součást LuDone, dovolí z hlavního panelu přímo otevřít skutečný přehled nahrávek a jasně ukáže, že LuTrack bude doplněn později. Existující nahrávání, souhlas s odesláním, přihlášení a aktualizace zůstanou zachovány. Verze 0.1.5 se připraví k podepsanému vydání.

## Dotčení uživatelé a systémy

- **Dan jako uživatel macOS** — rychleji najde lokální i odeslané nahrávky a jasně rozezná dostupné funkce.
- **LuDone Desktop** — panel, okno Nastavení, IPC pro navigaci, lištové ikony a balení aplikace.
- **app.ludone.cz** — zůstává existujícím cílem uploadu; jeho backend ani webové rozhraní se touto změnou neupravují.

## Hlavní cesta

```text
Otevřít panel LuDone -> nahrát schůzku a vybrat její uložení/odeslání -> stisknout Nahrávky -> zkontrolovat skutečný stav ve frontě
```

## Omezení

- 🔴 **Pracovat pouze v desktopovém repozitáři.** Backend, web LuDone a cizí `design/` nejsou součástí změny.
- 🔴 **LuTrack zatím není připravený k používání ani napojení.** Aplikace nesmí ukazovat falešně běžící čas; připraví jen srozumitelný stav „připravujeme“.
- Zachovat aktuální nahrávací, bezpečnostní a uploadové brány; testy ani akceptační kontroly se neoslabují.

## Co se nedělá

- **Nepřipojuje se LuTrack ani jeho API.** Návrh budoucího společného workflow zůstává v round 2 pro pozdější pokračování.
- **Nepřekresluje se celý dashboard pro web ani design systém LuDone.** Pracuje se jen s existující desktopovou UI a schváleným směrem.

## Signály úspěchu

1. Z panelu se jedním kliknutím otevře skutečná záložka Nahrávek; okno stále splňuje stávající IPC a oprávňovací kontroly.
2. Neaktivní LuTrack se nedá spustit a jeho stav neslibuje běžící ani uložený čas.
3. Automatické brány projdou a vydání 0.1.5 lze získat přes zavedený podepsaný aktualizační kanál.

## Otevřené otázky

Pro implementaci nejsou otevřené produktové otázky. Skutečný záznam zvuku, upload a instalaci aktualizace na Danově Macu ověří Dan podle postupu v předání; tyto kroky se nepovažují za ověřené zelenými testy.

## Doslovné citace zadavatele

> „Tak ten astra navrh. Levna implementace podle navrhu. Pracuj samostatne. Vydej dalsi vezo. Uloz navrhy, kdybych zmejil nazor jeste pak az uvidim naimplěentovane. Jen ty ikony ve z ous navrhu, tam je hezci.“

> „Lutrack jeste neexistuje. Pripravujeme do budoucna zatim teda neimplementuj, jen mej pripraveene az se spistimlutrack. Hlavne to ostatni“

> „Lutrack zatim. Nefungune zbytek samostatne spim neptej se a delej. Design lutrack jo napojeni na app. Ludone ne“
