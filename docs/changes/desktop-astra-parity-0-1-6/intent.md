---
tier: L
change_id: desktop-astra-parity-0-1-6
---

# Záměr — LuDone Desktop 0.1.6: celý schválený směr Astra

**Vznikl:** 24. 9. 2026 · **Autor:** Codex · **Zdroj:** zadání Dana v této konverzaci a screenshot nainstalované verze.

## Problém

Dan aktualizoval desktop na 0.1.5 a vidí jiné rozložení i tok, než schválil v prototypu Astra „Nit dne“. Vydaná verze převzala pouze omezený výřez L1: ikonu, zúženou navigaci a přímý odkaz na Nahrávky. Hlavní obrazovka, Můj den, nastavení a sjednocená cesta záznamu zůstaly v původním rozhraní. Předchozí předání tak vytvořilo dojem, že je hotový celý návrh, ačkoli dokumentace rozsah označovala jako částečný.

## Cílový výsledek

LuDone Desktop má být soudržná, každodenně použitelná macOS aplikace podle schválené plné varianty Astra: přehled „Teď“, společná stopa dne, detail nahrávky a nastavení sdílejí značku, navigaci, typografii, barvy, stavové zprávy a očekávané chování. Nahrávání, místní fronta, serverové ověření, opravy a aktualizace zůstávají skutečné funkce aplikace; prototypové údaje se do produktu nepřenášejí. LuTrack zůstane nefunkčním, pravdivě označeným budoucím místem bez měření a bez napojení na server.

## Dotčení uživatelé a systémy

- **Dan na Macu** — dostane jednotný a čitelný tok pro záznam schůzky, jeho uložení/odeslání, kontrolu stavu a nalezení výsledku.
- **Desktopový renderer a hlavní proces** — dostanou nové plochy/navigaci, ale zachovají současná bezpečnostní oprávnění IPC, audio a upload kontrakty.

## Hlavní cesta

```text
ikona v liště → Teď → nahrát schůzku → uložit a odeslat / nechat na Macu → Můj den → ověřit detail a stav
```

## Omezení

- 🔴 **Pracujeme pouze v desktopovém repozitáři.** Žádný backend, LuTrack, `app.ludone.cz` ani cizí `design/`.
- **LuTrack se neimplementuje.** Zůstane připravený, neaktivní slot; aplikace nesmí vyrábět falešný čas ani falešný výsledek.
- **Nové vydání je podmíněno E2E designovou přejímkou.** Zelené unit testy ani lokální prototyp nestačí; přejímka musí ověřit zabalený renderer/desktopový tok a porovnat důkaz se schválenou Astrou.

## Co se nedělá

- **Nový serverový kontrakt nebo změny webu** — uživatel jejich výslovně nepovolil.
- **Funkční měření či synchronizace LuTracku** — služba není v tomto běhu připravena.
- **Nový vizuální směr** — platí dřívější schválení Astra „Nit dne“, ne návrat k výběru variant.

## Signály úspěchu

1. Teď, Můj den, detail, nastavení, přihlášení, offline/recovery a update působí jako obrazovky jedné Astra aplikace a jsou ověřené na skutečném desktopovém UI.
2. Skutečný záznam lze uložit lokálně nebo odeslat a jeho stav, další akce a přístup k souboru odpovídají realitě; aplikace nikdy nevykreslí smyšlené časové úseky.
3. Všechny projektové brány projdou a E2E vizuální/designová přejímka má uložené screenshoty a doslovný výsledek před jakýmkoli tagem či publikací.

## Otevřené otázky

Žádné otevřené. D10 výslovně potvrzuje dotažený panel; finální brána se obnoví
podle tohoto konkrétního artefaktu při zachování všech funkčních a bezpečnostních kontrol.

## Doslovné citace zadavatele

> „Tak ten astra navrh. Levna implementace podle navrhu. Pracuj samostatne. Vydej dalsi vezo.“

> „než vydášznova tak e2E že to odpovídá návrhu co hsem schvákik“

> „Lutrack ještě neexistuje. Pripravujeme do budoucna zatim teda neimplementuj, jen mej pripraveene az se spistimlutrack.“
