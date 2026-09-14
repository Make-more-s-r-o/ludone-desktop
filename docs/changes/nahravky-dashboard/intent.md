# Záměr: dokončení nahrávek v LuDone Desktop

Dan schválil tento běh v konverzaci Codex 14. 9. 2026 vložením celého goalu a následným pokynem pokračovat samostatně. Tier L odpovídá více etapám, bezpečnostnímu převzetí vlastnictví a doplnění UI. Záměr se znovu neotevírá.

## Problém

Desktop umí nahrávat a má upload klienta, ale běžná aplikace z Finderu nenabízí úplnou cestu od uložení k odeslání a spolehlivému přehledu výsledku. Staré blokované položky nelze výslovně převzít. Vydávací workflow nenahrává výsledné soubory na existující hosting.

## Výsledek

Nahrát → pojmenovat → „Uložit a odeslat“ nebo „Nechat na Macu“ → vidět lokální i ověřený serverový stav → otevřít přepis a analýzu na webu. Volba automatického odesílání působí jen na nově pořízené nahrávky.

Pracujeme pouze v desktopovém repozitáři. Backend, LuTrack a cizí `design/` se nemění. Redesign je výslovně odložený; doplňují se existující styly a komponenty. Ostatní repozitáře lze číst kvůli doložení kontraktu a publikačního postupu.

## Autonomie a hranice

Astra koordinuje, integruje a kontroluje diff; nejvýše tři Sol workery implementují v oddělených worktree. Commity, push a PR jsou schválené. Release tag pushuje Dan. Skutečné nahrávání, instalaci a aktualizaci ověřuje Dan na Macu; zelené testy jsou pouze 🧪.

Autoritativní podrobné zadání: [ZADANI-PRO-CODEX.md](ZADANI-PRO-CODEX.md). Novější rozhodnutí tohoto běhu: [decisions.md](decisions.md).
