# Stav běhu `desktop-astra-0-1-5` — odkud pokračovat

**Aktualizováno 24. 9. 2026.** Kanonický strojový stav je `progress/status.json`; tento soubor je jeho lidský rozcestník.

## Kde co leží

| větev / worktree | co | stav |
|---|---|---|
| `feat/desktop-astra-next-v0-1-5` | implementace a zachované designové návrhy | plné brány, build a nezávislé review prošly; samostatná E5 sonda má doložený rozpor se schváleným D3/D11; commit, PR a vydání čekají |

## Co je hotové a ověřené

- **Plné projektové brány** — 76 testovacích souborů, 1 557 testů prošlo a 3 původní skipy odpovídají baseline; stav 🧪.
- **Produkční sestavení rendereru** — `npm run build` prošel; stav 🧪.
- **Přímé směrování do Nahrávek** — query parametr otevře skutečný přehled a zachová `#settings` pro kontrolu oprávnění; zahrnuto v plných branách.
- **Stav LuTracku** — časovač, nabídka v liště i klávesová zkratka jsou vypnuté; zůstává pouze pravdivá informace o připravované funkci.
- **Nezávislé review** — dvě drobné připomínky (závod při přepnutí záložky a zdvojené tlačítko Nastavení) byly opravené a cílené testy i následné plné brány prošly; stav 🧪.
- **E5 — samostatná sonda historického vypínače uploadu** — 7 podmínek PASS, 1 FAIL. Chybějící env hodnota je podle staré sondy vypnuto, ale pozdější D3/D11 výslovně vyžadují ruční odeslání z Finderu bez shellových proměnných a souhlas po položkách. V tomto vydání se neměnil kód fronty ani E5; přesný výpis je v [`evidence/acceptance/E5.log`](evidence/acceptance/E5.log), rozhodnutí a dopad v review.
- **Vizuální kontrola živého okna** — neproběhla: lokální Orca hlásila `runtime_unavailable` („Could not connect to the running Orca app. Restart Orca and try again.“). Automatické brány neprohlašujeme za vizuální ověření.

## Co blokuje co

| blokuje | čeká na |
|---|---|
| Pull request a tag `v0.1.5` | commit, push, zelené GitHub CI a podepsané vydání |
| Ověření skutečného záznamu, uploadu a aktualizace na Macu | instalaci výsledného podepsaného vydání a ruční postup v [`OVERENI-NA-MACU.md`](OVERENI-NA-MACU.md) |
| Rozhodnutí, zda historickou E5 sondu sladit se schváleným D3/D11 | samostatné budoucí rozhodnutí; tato změna sondu neobchází ani nemění |

## Rozhodnutí zadavatele

- [D1](decisions.md#d1--pro-015-použít-směr-astra-nit-dne) — vybrán Astra směr a oba návrhy zůstávají.
- [D2](decisions.md#d2--lutrack-zůstává-vypnutý-do-připravenosti-služby) — LuTrack se zatím neintegruje.
- [D4](decisions.md#d4--verzi-015-připravit-a-vydat-desktopovým-workflow) — připravit a vydat 0.1.5.

Úplné znění rozhodnutí je v `decisions.md` a strojový průběh v `progress/status.json`.

## Task packety

- `tasks/T-01.md` — značka a navigace.
- `tasks/T-02.md` — neaktivní stav LuTracku.
- `tasks/T-03.md` — review, brány a vydání.

## Fakta neodvoditelná z kódu

1. Dan výslovně schválil Astra směr, současný výřez a vydání; schválení designu je zaznamenané ručním fallbackem se zdrojem v konverzaci.
2. Uživatelský screenshot je z 23. 9. 2026; runtime screenshot nové verze zatím pořízen není.
3. Zvuková cesta, produkční upload a instalace aktualizace musí být ověřeny na skutečném Macu; automatické testy je nenahrazují.
