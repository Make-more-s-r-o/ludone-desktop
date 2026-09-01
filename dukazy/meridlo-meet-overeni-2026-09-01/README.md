# Ověření měřidla A6 — umí ta brána vůbec zčervenat?

Ověřeno **1. 9. 2026** na syntetických datech, kde je odpověď známá dopředu.
Skript: `scripts/meet-mereni.mjs`. Surová syntetická data se nearchivují — jsou
reprodukovatelná třemi příkazy `ffmpeg` uvedenými níž.

Důvod, proč tenhle soubor existuje: `PLAN.md:108` požaduje „demonstrované, ne slíbené"
brány, a discovery 1. 9. našlo, že několik dnešních bran v repu měří jen přítomnost
textu v souboru a zčervenat neumí. Nové měřidlo tedy musí ukázat obojí.

## Výsledky

| Scénář | systém | mikrofon | rozdíl | Závěr |
|---|---|---|---|---|
| **1 — úspěch** (zvuk projde, sluchátka nasazená) | 0,9983 | 0,0431 | 0,9553 | ✅ PASS |
| **2 — selhání AEC** (Meet hlas odečetl) | 0,0696 | 0,0431 | 0,0265 | 🔴 FAIL |
| **3 — přeslech** (reproduktor slyšel do mikrofonu) | 0,9983 | 0,9974 | 0,0010 | 🔴 FAIL |

**Scénář 3 je ten, na kterém záleží nejvíc.** Systémová korelace je 0,9983, tedy
vypadá jako plný úspěch. Kdyby měřidlo sledovalo jen systémovou stopu, prohlásilo by
přeslech za zachycení systémového zvuku — což je přesně chyba, kvůli které se
argument z 20. 8. musel přepsat. Odhalí ho jedině porovnání s mikrofonem.

## Jak se to reprodukuje

```
node scripts/meet-mereni.mjs --priprav --nazev test-meridla
REF=dukazy/test-meridla-*/referencni.aiff
# 1 — úspěch: reference posunutá o 5 s, dopadovaná tichem, protažená přes Opus jako v Meetu
ffmpeg -i "$REF" -ac 1 -ar 48000 -af "adelay=5000,apad=pad_dur=5" -t 38 -c:a libopus -b:a 24k -application voip fake_system.webm
# 2 — mikrofon se sluchátky: jen tichý šum
ffmpeg -f lavfi -i "anoisesrc=r=48000:a=0.002:d=38" -ac 1 -c:a libopus -b:a 24k fake_mic.webm
# 3 — přeslech: tatáž řeč i v mikrofonu, jen tišší
ffmpeg -i "$REF" -ac 1 -ar 48000 -af "adelay=5000,apad=pad_dur=5,volume=0.3" -t 38 -c:a libopus -b:a 24k fake_mic_preslech.webm
```

## Proč obálka energie, a ne vzorková korelace

Měření z 20.–21. 8. korelovalo vzorky, protože `Glass.aiff` hrál lokálně a fáze se
zachovala. Přes Meet jde zvuk zakódovaný Opusem, převzorkovaný a zpožděný — vzorková
korelace by vyšla nízká **i tehdy, když zachycení funguje**, a měření by vyrobilo
falešný poplach na vyřazovacím kritériu projektu.

⚠️ **Tohle NENÍ měření Google Meetu.** Je to ověření nástroje. Skutečné měření A6
vyžaduje druhé zařízení, sluchátka a živý hovor — dělá ho Dan.
