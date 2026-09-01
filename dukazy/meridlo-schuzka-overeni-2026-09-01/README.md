# Ověření měřidla pro skutečnou schůzku

Skript `scripts/schuzka-mereni.mjs` měří kritérium A6 **bez referenčního signálu** — vezme
dvě stopy z běžné nahrané schůzky a rozhodne, jestli systémová stopa nese hlas protistrany.

Ověřeno **1. 9. 2026** na syntetických datech, kde je odpověď známá dopředu.

| Scénář | korelace obálek | Závěr | Očekáváno |
|---|---|---|---|
| **A** — protistrana mluví, mikrofon mlčí | 0,006 | ✅ FUNGUJE | FUNGUJE |
| **B** — v systémové stopě není řeč | 0,010 | 🔴 NEFUNGUJE | NEFUNGUJE |
| **C** — táž řeč v obou stopách | 0,998 | ⚠️ NEPLATNÉ | NEPLATNÉ |

**Scénář C je ten, na kterém záleží.** Bez sluchátek hraje reproduktor protistranu do mikrofonu,
takže systémová stopa vypadá plná řeči a všechna ostatní čísla ukazují úspěch. Kdyby měřidlo
sledovalo jen systémovou stopu, prohlásilo by přeslech za funkční zachycení — a projekt by se
postavil na závěru, který neplatí. Odhalí ho jedině korelace mezi stopami.

## Jak metoda funguje

Nemáme referenční signál. Místo korelace s ním se hledají úseky, kdy **mikrofon mlčí
a systémová stopa má řeč** — tam může mluvit jedině protistrana.

- Práh řeči se počítá z nahrávky samotné (10. percentil + 12 dB), ne pevně. Každá místnost
  a každý mikrofon má jinou podlahu.
- Úseky kratší než třetina sekundy se zahazují, aby se nechytaly lupance a dech.
- Když protistrana mluví méně než 5 % času, výsledek je NEPRŮKAZNÝ — na takové schůzce
  se nedá nic dokázat.

## Reprodukce

Syntetická data vzniknou příkazy uvedenými v `dukazy/meridlo-meet-overeni-2026-09-01/README.md`.
Pak stačí spustit skript nad dvojicemi souborů podle tabulky výš.

⚠️ **Tohle NENÍ měření Google Meetu.** Je to ověření nástroje. Skutečné měření A6 vyžaduje
nahranou schůzku s živou protistranou — dělá ho Dan.
