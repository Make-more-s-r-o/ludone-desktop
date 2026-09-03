# Syntetické vzorky exportu

Tyto soubory neobsahují žádnou skutečnou schůzku. Příkaz `npm run vzorky`
je vytvořil syntetickými oscilátory ve skrytém Electronu 39.8.10 a skutečným
Chromium `MediaRecorder`, který používá i aplikace. Výstupní adresář:
`docs/changes/desktop-v1/vzorky`.

| soubor | kontejner / kodek | kanály | vzorkovací frekvence | dekódovaná délka | velikost | obsah kanálů |
|---|---|---:|---:|---:|---:|---|
| `dvoustopa-440hz-880hz.webm` | WebM / Opus | 2 | 48000 Hz | 2.220 s | 35621 B | vlevo 440 Hz; vpravo 880 Hz |
| `jednostopa-440hz-ticho.webm` | WebM / Opus | 2 | 48000 Hz | 2.220 s | 35935 B | vlevo 440 Hz; vpravo digitální ticho na vstupu enkodéru |

## Jak vznikly

Generátor načítá přímo produkční funkce `createStereoCapture` a
`createMicrophoneOnlyExportCapture`. Nahrává s produkčními parametry
`audio/webm;codecs=opus`, požadavkem 128 000 bit/s a chunky po 1 000 ms.
Soubory jsou prostým spojením chunků `MediaRecorder`; neproběhl remux ani převod
přes ffmpeg.

U jednostopé varianty je pravý vstup dvoukanálového `ChannelMerger` nezapojený.
Proto do enkodéru vstupuje digitální nula. Opus je ztrátový kodek, takže se po
dekódování kontroluje zanedbatelná úroveň pravého kanálu, ne nulové PCM bajty;
naměřené RMS je −∞ dBFS.

Vzorkovací frekvence v tabulce je hodnota `SamplingFrequency` načtená přímo
z prvku `TrackAudio` ve vyrobeném WebM. Délka vychází z počtu dekódovaných
vzorků; dekodér při měření pracuje při 48 kHz.

## Kontrola

Oba soubory generátor po vytvoření dekóduje, měří oddělení tónů a nechá projít
přímo produkční funkcí `inspectOpusWebm` nad prvními 64 KiB:

- `dvoustopa-440hz-880hz.webm`: PASS {"container":"WebM","codec":"Opus","channels":2}
- `jednostopa-440hz-ticho.webm`: PASS {"container":"WebM","codec":"Opus","channels":2}

Celková délka se měří z počtu dekódovaných vzorků. Streamovaný WebM z Chromium
`MediaRecorder` nemusí mít v kontejneru zapsaný prvek Duration.
