---
kind: verification
ref: 4332e4a + integrační úprava rozložení
verdict: tests-green
measuredAt: 2026-09-15T08:22:00Z
scope:
  - updater-consent
  - update-banner
measuredFrom:
  - root-targeted.log
  - root-sabotaz-odklad.log
  - integrace-gates-after-layout.log
---

# Viditelné aktualizace a souhlas s instalací

🧪 Aktualizace se kontrolují po startu a každých šest hodin, stahují automaticky,
ale instalují až po tlačítku Aktualizovat. Později zruší také již potvrzený požadavek
čekající na bezpečnou chvíli. Zůstávají bariéry nahrávání, ukládání, fronty a časovače.
Opakovaná kontrola téže verze nezmění souhlas; nová verze jej nepřebírá.

Proužek obsahuje skutečné poznámky vydání převedené na krátký prostý text. Oznámení
macOS si pamatuje již oznámené verze přes restart. Kliknutí na oznámení otevírá panel.
Ruční kontrola nedeklaruje aktuálnost bez výsledku updateru. Nové IPC má omezené
odesílatele a nepřijímá payload. Historie oznámení využívá stávající atomické nastavení.

- Root: čtyři cílené testové soubory, **350 PASS, exit 0** (`root-targeted.log`).
- Sabotáž odstraněním opětovné kontroly požadavku po asynchronní bariéře: relevantní test **FAIL, exit 1** (`root-sabotaz-odklad.log`). Zdroj byl přesně obnoven. Filtrované testy nejsou změnou baseline.
- První společné brány: **1 FAIL, exit 1**, zachyceno v `integrace-gates.log`. Ruční kontrola vložila třetí přímý prvek mezi dvě agendy panelu. Produkční rozložení bylo opraveno: aktualizace leží mezi hlavičkou a rolovatelnými agendami; původní test zůstal beze změny.
- Opakované společné brány: **1514 PASS, 3 původní skipy; lint, typecheck, kontrola baseline — exit 0**. Build **exit 0**. Doslovný výpis `integrace-gates-after-layout.log`. Existující React act varování v activity UI testech jsou ve výpisu zachována.
- Sol implementace a nezávislé review doplnilo trvalou historii více verzí a odstranění zastaralé chyby akce. Root zkontroloval diff a explicitně otestoval odložení uprostřed bezpečnostní bariéry.

## Omezená vizuální kontrola

🟡 Koordinátor proklikal skutečnou React komponentu a styly v lokálním prohlížeči
na syntetickém stavu, při šířce panelu 366 px: staženo, Později, Aktualizovat čekající
na bezpečnou chvíli, průběh 42 %, bez aktualizace a ruční kontrola s výsledkem.
Text a tlačítka byly viditelné bez překryvu s oběma agendami. Náhled výslovně uváděl,
že nic nestahuje ani neinstaluje. Dočasný harness není součást aplikace.

⛔ Nativní aplikaci se v tomto běhu nepodařilo zpřístupnit přes ovládací nástroj.
Oznámení macOS, stažení skutečného archivu, instalace a zvuk po restartu proto nejsou
ověřené naostro. `ui-smoke` ani `audio-smoke` agent nespouštěl. Přechod 0.1.2 → 0.1.3
řídí starý updater; nové podmínky instalace vyžadují další schválené vydání.

`premisaPlatila: true`. `kontrolniNula`: 0 skutečných instalací v náhledu,
0 produkčních uploadů, 0 změn backendu/LuTracku/designu a 0 oslabených bran.
