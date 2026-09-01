# Ověření měřidla pro skutečnou schůzku

Skript `scripts/schuzka-mereni.mjs` měří kritérium A6 **bez referenčního signálu** — vezme
dvě stopy z běžné nahrané schůzky a rozhodne, jestli systémová stopa nese hlas protistrany.

## 🔴 První verze lhala. Tohle je druhá.

Verze z 1. 9. 16:23 (commit `321a2e6`) prohlásila za funkční zachycení nahrávku **tří gongů**
z `dukazy/nahravani-2026-08-21/` — a v odůvodnění sama napsala *„nese řeč po dobu 0:00"*.
Ta věta si protiřečí sama v sobě a nikdo si toho nevšiml, protože měřidlo nikdo nezkusil
oklamat.

Odhalil to výzkum, jehož **povinnou částí bylo pole „čím se to dá oklamat"**. Skeptici jich
našli šestnáct. Šest nejzávažnějších je opravených, jeden se opravit nedá a je přiznaný.

## Co měřidlo teď kontroluje, než cokoli prohlásí za úspěch

| Kontrola | Proti čemu stojí |
|---|---|
| délky obou stop se shodují | stopy z různých nahrávek — změřeno, že dřív prošly bez výhrady |
| mikrofonní stopa nese řeč | **mrtvý mikrofon byl nejsebejistější možné „funguje"** — bez řeči v mikrofonu projde jako protistrana jakýkoli zvuk |
| mikrofon je u své podlahy, když mluví protistrana | přeslech z reproduktoru |
| systémová stopa kolísá v rytmu řeči | trvalý tón, šum, hukot |
| protistrana mluví ≥ 20 s ve ≥ 4 replikách | jeden osamocený zvuk vydávaný za hovor |

## Výsledky zkoušek

| Scénář | Závěr | Očekáváno |
|---|---|---|
| **A** — střídavý hovor, obě strany mluví | ✅ FUNGUJE | FUNGUJE |
| **B2** — gongy v mezerách mezi replikami | ⚠️ NEPRŮKAZNÉ | nemá projít |
| **C** — v systémové stopě ticho | 🔴 NEFUNGUJE | NEFUNGUJE |
| **D** — protistrana prosakuje do mikrofonu | ⚠️ NEPLATNÉ | NEPLATNÉ |
| **E** — mikrofon nic nezachytil | ⚠️ NEPLATNÉ | NEPLATNÉ |
| **původní** — důkaz z 21. 8., dřív „FUNGUJE" | ⚠️ NEPLATNÉ | nemá projít |

## 🔴 Hranice, kterou neumím odstranit

**Kontrola rytmu řeči nerozliší opakované krátké zvuky.** Změřeno: řada systémových gongů
po 2,5 s dala index 0,875, tedy vysoko nad prahem 0,18 — rychlý doznívající náběh gongu leží
v témže pásmu jako slabiky. Ve scénáři B2 to zachránila až podmínka na délku, a to je náhoda,
ne návrh: delší řada gongů by prošla.

Z obálky se to rozlišit nedá. Proto skript **vždycky vyřízne třicetisekundovou ukázku systémové
stopy** a řekne, ať si ji člověk poslechne. Ucho rozliší řeč od zvonění okamžitě a je to jediná
spolehlivá kontrola, kterou máme.

## Co se opravilo mimo verdikt

- **Práh nebyl adaptivní.** Podlaha obálky `1e-5` dělala z desátého percentilu vždycky −100 dB,
  takže `Math.max(−100, −55) + 12` dávalo pevných −43 dBFS pro obě stopy v každé nahrávce.
  Doloženo v `zk-*.json` z první verze, kde svítilo `system: −43, mikrofon: −43`.
- **Detektor zahazoval řeč.** Vyžadoval 30 souvislých rámců a nepřemosťoval závěry uvnitř slov
  (20–80 ms), takže z jedné promluvy udělal kusy pod minimální délkou. Doloženo měřením
  88,6 % zachycené řeči proti 99,8 % s přemostěním.
- **NEPRŮKAZNÉ končilo nulou**, takže pro jakoukoli bránu vypadalo jako úspěch — a je to přitom
  nejpravděpodobnější výsledek. Nyní končí nenulově všechno kromě FUNGUJE.

⚠️ **Tohle NENÍ měření Google Meetu.** Je to ověření nástroje. Skutečné měření dělá Dan
nahráním běžné schůzky se sluchátky.
