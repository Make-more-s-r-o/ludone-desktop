# Plán F/G: Osa a Příkaz

Autor: Sonnet 5.5, 2. 10. 2026. Jen makety, žádná produkční implementace.

## 1. Šest kompozic

1. **Osa**: celý panel je páska dne. Nahrávání je aktuální uzel na svislé lince, schůzky jsou starší uzly.
2. **Příkaz**: panel začíná jedním příkazovým řádkem jako v Raycastu. Seznam pod ním je výsledek, ne dashboard.
3. **Plátno**: schůzka je dokument, ovladače se odkryjí jen u textu. To je blízko dokumentu D, proto ne.
4. **Dvě pole**: levý seznam, pravý kontext. Hodí se jen pro nastavení a historii, ne pro celý panel.
5. **Kapsle**: pruh, který se rozbalí. To je E, proto ne.
6. **Linka stavů**: pipeline Mac → server jako hlavní motiv detailu. Použito uvnitř Osy.

**Vybráno: F = Osa a G = Příkaz.** Liší se ve čtyřech věcech, které s barvou, fontem ani zaoblením nesouvisí:
- **Navigace:** F má levou ikonovou lištu, G nemá žádnou trvalou lištu, jen rozbalovací titulek.
- **Dominantní prvek:** F má linku s uzly, G má široký příkazový řádek.
- **Rozhodnutí po schůzce:** F má formulář nahoře a dva akční řádky dole. G má dvě velké volby nahoře a formulář pod nimi.
- **Historie a detail:** F má měsíční osu a pipeline s akcemi u stavu. G má boční fazety, větu o stavu a spodní dok s akcemi.

D/E měly stejné pořadí čas → vlna → zdroje → tlačítko → poslední. F ani G ho nemají. Idle F nemá žádný čas ani vlnu. Idle G má řádek a seznam. Recording F je uzel s časem a dvěma kanály. Recording G je červený rámeček s časem vpravo.

## 2. Tokeny

**F Osa**

| Token | Hex |
|---|---|
| Inkoust | `#16222b` |
| Křída | `#f4f6f5` |
| Linka | `#cfd8d4` |
| Měřidlo (akcent) | `#0d7a6b` |
| Záznam | `#d6383f` |
| Pozor | `#a86a0a` |

**G Příkaz**

| Token | Hex |
|---|---|
| Uhel | `#202124` |
| Papír | `#fafaf8` |
| Mez | `#e2e2de` |
| Šeď | `#6a6c70` |
| Cinobr (nahrávání) | `#d9421f` |
| Les (hotovo) | `#2f7a4f` |

Tmavá a profesionální varianta jsou odvozené v CSS, obě pro F i G.

## 3. Typografie a rozměry

Obě používají systémové SF (`-apple-system`). Text má 15 px, názvy 16–18 px, metadata 13 px a jen sekundárně.
- F používá pro časy tabulární číslice a SF Mono.
- G používá jednu tloušťku 600 pro zvýraznění a krátké kbd nápovědy.

| | F Osa | G Příkaz |
|---|---|---|
| Panel | 420 px, historie 460 px | 380 px, historie a nastavení 640 px, fronta 520 px |
| Detail | 860 × 580, na šířku | 700 × 540, plátno s dokem |
| Navigace | levá lišta 52 px | titulek s rozbalením |
| Kontejnerové dotazy | šířka popoveru a okna | šířka popoveru a okna |

## 4. Kompozice (ASCII)

```
F ready               F recording            F draft
|▫| ○ Připraveno      |▫| ● Nahrává se       |▫| Schůzka je nahraná
|▫| │ ● Mikrofon      |▫| │ 24:18            |▫| ○ Název [_____]
|▫| │ ● Zvuk schůzky  |▫| │ ● ● oba kanály   |▫| ○ Firma [____]
|▫| │ [ Nahrávat ]    |▫| │ [ Zastavit ]     |▫| ○ Přístup [__]
|▫| ● Týdenní… ✓      |▫| ● starší…          |▫| [Uložit a odeslat]
|▫| ● Návrh…          |                      |▫| [Nechat na Macu]

F history             F detail (860x580)
|▫| [hledat][období]  Název                      facts
|▫| [Vše|Mac|…]       ●────────────────●
|▫| ○ 1. října        Na Macu          V LuDone
|▫| │ ● řádek         Zvuk je uložený  Neověřeno
|▫| │ ● řádek         [Finder][Koš]    [Odeslat][Ověřit]
|▫| 1–7 z 46 [<][>]   Firma [..]  Přístup [..]

G ready               G recording            G draft
[≡ Nahrávání ⌄]       [≡ Nahrávání ⌄]        [≡ Po schůzce ⌄]
[● Nahrávat   ⌘⇧R]    ┌ Nahrává se  24:18 ┐   [Uložit a odeslat][Nechat na Macu]
 Mikrofon · Zvuk      │ [   Zastavit    ] │   Název [______]
 Nedávné   Všechny    │ ● Mik  ● Zvuk     │   Firma [___]  Přístup [___]
  řádek      stav     └───────────────────┘
  řádek      stav      Nedávné …

G history (640)       G detail (700x540)
[≡ Nahrávky ⌄]        ‹ Zpět
Období ▾ | [hledat]   Název
Stav:    | řádek      ● Na Macu: Zvuk je uložený
 Vše     | řádek      ● V LuDone: Neověřeno
 Na Macu | 1–7 z 46   Firma [..]  Přístup [..]
 …       |            ─────────────────────────
                      [Odeslat][Ověřit][Finder]   [Koš]
```

**Nastavení:** F má akordeon, pět řádků pod sebou a aktivní se rozbalí. G má dvě pole: levý seznam částí a vpravo obsah.
**Fronta:** F má řádky na lince s barevným uzlem. G má tabulku se stavovým bodem a upozornění jako horní pás.
**Onboarding:** F má kroky jako svislou linku. G má „Krok n z 5" jako text.
**Chyby:** F má boční barevnou linku. G má horní pás.

## 5. Kritika proti kritériím a opravy

1. **Šedá škála.** Osa je linka plus rail a Příkaz je řádek plus fazety. To je kompozice, ne barva. ✔
2. **Dva různé dominantní prvky.** Původní plán F měl uprostřed čas. To jsem zrušil: idle F čas nemá, recording ho má v uzlu na lince. ✔
3. **Navigace.** Dvě levé lišty by byly pořád tytéž taby natočené o 90°. Proto G dostal rozbalovací titulek bez trvalé lišty. Objevitelnost drží chevron, počet ve frontě a ikona nastavení v hlavičce. ✔
4. **Účel stavů.** Idle F je stav kanálů a pásek dne. Idle G je příkaz a výsledky. Recording F je uzel. Recording G je rámeček. Draft je jiný. ✔
5. **Po schůzce.** Původní plán měl u obou pevné akce dole. Opraveno: G má volby nahoře. Firma a přístup jsou viditelné vždy. ✔
6. **Historie.** Osa má měsíční uzly a G postranní fazety. Všechny filtry, období, hledání a stránkování zůstávají. ✔
7. **Detail.** F má pipeline s akcemi u stavů, G dok na dně. Žádný dokument ani inspector. ✔
8. **Koncept se promítne dál.** Nastavení, fronta, onboarding, aktualizace i chyby jsou přepsané výše. ✔

**Slabé místo, které jsem opravil.** Při plánu mi vycházelo, že obě makety zabírají v idle přibližně stejný svislý prostor. Proto má G širší panel (640 px) pro seznamové stránky. F zůstává úzký a vysoký.

## 6. Funkční mantinely

- Nikde se nemění app.js ani jeho renderery.
- Hook se jmenuje `window.applyLuDoneLayout`, je idempotentní a jen přesouvá existující uzly.
- Nic se neklonuje, žádný formulář nemá dvojníka.
- Stop je viditelný okamžitě. Výpadek zvuku a neúplný zvuk zůstávají v poznámkách a upozorněních.
- Zamčené metadata zůstávají zamčená.
