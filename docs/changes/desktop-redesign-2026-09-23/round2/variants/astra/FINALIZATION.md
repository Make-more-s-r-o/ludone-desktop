# Finalizace návrhu Astra

Původní autor: gpt-6-astra. Dokončení a omezené review: gpt-6-sol, 23. 9. 2026.

## Změna

V obrazovce Identity přibylo přímé porovnání původní ikony LuDone a téže ikony s malým rohovým odznakem „D“. Doporučená je původní ikona s vedlejším názvem „LuDone Desktop“, protože zůstává čitelná i v 16 px. Původní geometrie značky se neměnila. Podklady `LuDone.svg` a iOS PNG v `assets/brand/` se shodují se SHA-256 ve společném `ICON-ADDENDUM.md`.

## Kontrola stavového modelu

- Změna firmy položky ve frontě ji vrací do stavu „Uloženo na Macu“; nové odeslání vyžaduje samostatné potvrzení. Samotné obnovení přehledu ji neodešle.
- Simulovaný restart z `home` a `record-only` nevytvoří rozpracovaný čas; nahrávka zůstane lokálně zachovaná.
- Volba „Nejdřív zkontrolovat na webu“ používá stav místní kontroly a předání výslovně říká, že server úsek neodmítl. Skutečné simulované odmítnutí má samostatnou cestu.

## Ověření a omezení

Předchozí automatické ověření autora je doslovně v `evidence/verification.txt`: 42 přímých kombinací scénářů a témat, 51 kontrol cest, exit 0. Po této finalizaci byl spuštěn `node --check app.js`: exit 0, bez výstupu. Prohlížeč ani klikací testy se při finalizaci znovu nespouštěly; nový blok Identity tedy čeká na vizuální kontrolu v porovnávači. HTML je místní simulace, nikoli důkaz produkčního zvuku, API, systému macOS či vydané aplikace.

Doporučené kroky vizuální přejímky: otevřít Identity ve světlém i tmavém tématu a porovnat obě možnosti ikony; zkontrolovat čitelnost originálu ve 16 px a stavové ikony lišty; krátce projít `attention`, `record-only` a `recovery`.
