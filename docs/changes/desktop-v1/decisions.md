# Rozhodnutí — LuDone Desktop v1

Auditní stopa. **Není to paralelní specifikace** — schválené rozhodnutí se musí propsat i do
`intent.md`, `spec.md` nebo `plan.md` podle povahy.

## Proces (1. 9. 2026)

| # | Rozhodnutí | Kdo |
|---|---|---|
| M1 | Masterplán platí pro LuDone Desktop; brief pro modul do `ludone-app` až na konci | Dan |
| M2 | Řez = co je na `main`. Nová práce jde přes `docs/changes/<id>/` | Dan |
| M3 | Design gate stojí na Claude Design | Dan |
| M4 | Masterplán vyhrává všude. Globální „dotáhni to sám až na prod bez ptaní" se **v tomhle repu ruší** | Dan |
| M5 | Rozsah = dotáhnout až po E10, plná náhrada Plaudu | Dan |
| M6 | Vynucení jen dokumentem a AGENTS.md. Žádný hook, žádný skill | Dan |
| M7 | Worktrees = Orca `~/orca/workspaces/` | Dan |
| M8 | Úklid stromu i oprava `ui-smoke` před startem | Dan |
| M13 | Bezpečnostní nálezy C4 expedovány do `LuDone/DAN-TODO.md`, **necommitnuto** | Dan |

## Produkt

| # | Rozhodnutí | Kdo |
|---|---|---|
| M9 | Jedna aplikace, dvě agendy — nahrávání schůzek a výkaz času | Dan |
| M10 | Desktopový LuTrack = **jen časovač**. Přehled, Management i Admin na webu | Dan |
| M11 | 🟡 **Odloženo:** osud živého LuTracku | Dan |
| M12 | Vzhled = LuDone Přístroj DS. Z LuTracku jen logika a názvosloví | Dan |
| M15 | **Kalendář se ruší.** Nahrávku identifikuje datum, čas, projekt z časovače a pole při stopu | Dan + doložení |
| M16 | **Varianta Divergent zrušena** — stála na časové ose dne, tedy na rušeném kalendáři | Claude, Dan potvrdil |
| M17 | Klidová agenda je v panelu jeden řádek, rozbalí se jen běžící | Claude (Dan: „rozhodni") |
| M18 | Ikona v Docku výchozí vypnutá, přepínač v Nastavení | Claude, Dan potvrdil |
| M19 | Pojmenování při stopu: předvyplněný název + čas od–do, editovatelné; čas se ukládá zvlášť | Dan |
| M20 | Připomínky ve zvolené dny a hodiny, když neběží časovač. Nikdy během nahrávání | Dan |

## Technická rozhodnutí přijatá orchestrátorem

Dan u nich řekl „je mi jedno" nebo „nerozumím" — masterplán §4 velí rozhodnout a zapsat.

| Rozhodnutí | Důvod |
|---|---|
| Serverový kontrakt `/api/desktop/recordings` | Hotová fronta stojí na něm; druhá varianta znamená přepsat frontu i testy |
| **Statická** registrace klienta, ne dynamická | Jediná varianta odvolatelná jedním UPDATE. Dnešní kód dělá DCR a vynucuje ji i brána `E7.sh:49` — obojí se musí srovnat |
| Přejmenovat běhová čísla na `B1–B8`, rozhodnutí běhu na `BD1–BD7` | `E0–E10` a `D1–D7` patří výhradně plánu. Bez toho si masterplán odškrtne 4,5–7 ČD neexistující práce |
| Neplatit GitHub Pro ani nezveřejňovat repo | Bránu drží orchestrátor + sedm bran do CI. Nestojí to nic |

## Odchylky od masterplánu, přijaté vědomě

| # | Odchylka | Důvod |
|---|---|---|
| **O8** | T1 běžel v hlavním checkoutu, ne ve worktree | Worktree nemá `node_modules`, takže by v něm brána neběžela. Jediný zapisovatel, strom čistý a commitnutý |
| **O9** | Obě měřidla A6 psal orchestrátor, ne Codex | Měřidlo vyřazovacího kritéria je nástroj, kterým se rozhoduje o projektu. Příště delegovat |
| **O7** | Design approval gate proběhl bez samostatného UX contract draftu | Jeho obsah nese `design/zadani/BRIEF.md`, který se sám označuje za závazné zadání, a statický náhled s 22 obrazovkami |

## Otevřené, s doporučeným defaultem

Viz `intent.md` § Open questions. Nic z toho neblokuje práci na nezávislých větvích DAG.
