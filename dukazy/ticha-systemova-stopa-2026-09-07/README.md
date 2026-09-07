# Zkušební nahrávka: systémová stopa EXISTUJE, ale mlčí

Vyrobeno 7. 9. 2026 pro serverovou session, aby si mohla ověřit, že **dvoukanálový soubor
není důkaz dvou mluvčích**. Zvuk je **syntetický** — vstříknutý oscilátorem přes override
`getUserMedia` / `getDisplayMedia`. **Není to nahrávka skutečného hovoru ani pokoje** (D32).

## Naše tvrzení, PŘED jejich měřením

| stopa | co jsme do ní pustili |
|---|---|
| **mikrofon** | sinus **440 Hz**, zisk 0,5 — souvislý tón po celou dobu |
| **systémový zvuk** | reálná stopa ze sinu 880 Hz, ale **zisk 0** ⇒ digitální ticho |

Stopa tedy **existuje, běží a končí spolu s mikrofonní** — jen v ní není nic slyšet.
Manifest deklaruje **obě**, takže `declaredCaptureSources` = `microphone+system`.

## Nezávislé měření (ffmpeg `volumedetect`, ne naše tvrzení)

| stopa | velikost | mean | max |
|---|---|---|---|
| mikrofon | **710 859 B** | **−9,0 dB** | −5,9 dB |
| systém | **11 139 B** | **−91,0 dB** | **−91,0 dB** |

🔴 **Rozhodující je poslední sloupec: u systémové stopy se `mean` ROVNÁ `max`.** U tichého,
ale živého zvuku se liší. Shoda obou hodnot na −91 dB je podpis konstantního ticha.

Druhý, hrubší rozlišovač: **64× menší soubor při stejné délce** (44 s). Opus umí ticho
zabalit skoro do ničeho.

## Kde soubory leží

Zvuk se do gitu nedává. Stopy, manifest i kombinovaný export:
`~/Documents/ludone-zkusebni-nahravky/ticha-systemova-stopa-2026-09-07/`

## Co se při výrobě našlo (dva nálezy k opravě)

1. **`RecordingCard.jsx:963`** — hlášku *„Obě stopy ověřeny"* nese `<span>`, který je
   **zároveň `sr-only` a `aria-hidden="true"`**. To se vylučuje: `sr-only` ji skryje očím,
   `aria-hidden` odečítačům. Text tedy nevidí **nikdo** a **žádný test ho nehlídá**.
2. **A hlavně to slovo.** Podmínka je `!systemAudioLost && !microphoneOnly`, tedy „stopa
   nezmizela". Naše mlčící stopa ji splnila a appka o ní tvrdila „**ověřeny**", ačkoli
   ověřená není — jen **přítomná**. Dnes to nikoho neplete, protože to není vidět; jakmile
   ale někdo opraví nález 1, stane se z neviditelné nepravdy viditelná.
