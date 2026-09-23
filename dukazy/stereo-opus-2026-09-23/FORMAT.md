# Volba formátu D21

23. 9. 2026 Dan zrušil pevnou preferenci MP3 a zadal výběr podle velikosti a účelu.
Zvolen WebM/Opus, stereo 48 kHz, cílových 96 kb/s celkem (orientačně 43,2 MB/h před
režií; VBR není pevná velikost). Živý Opus se přebalí bez překódování; staré dvě
ověřené stopy lze spojit libopus encoderem. Původní stopy zůstávají lokálně.

## Read-only serverový audit

Checkout `LuDone/ludone-app`, HEAD `e3e7dbac`; žádná serverová změna ani produkční HTTP.

- `src/lib/nahravky/private-recording-storage.ts:21–40`: MIME WebM/Ogg/MP4/MPEG/WAV,
  limit 512 MiB, části 8 MiB. Řádky 129–154 rozlišují hlavičky souborů.
- `src/app/api/nahravky/uploads/route.ts:202–230`: deklarace velikosti/chunkování.
- `src/app/api/nahravky/uploads/[recordingId]/dokoncit/route.ts:441–518`:
  kontrola hashe, MIME a uložení. Jde o vlastní chunk protokol, nikoli tus.
- `src/lib/nahravky/normalize.ts:542–601`: `-map 0:a -c copy -f webm`, ffprobe kanály.
- `src/lib/nahravky/transcribe/run.ts:1470–1479,1770–1785,1858–1867`:
  původní normalizovaný soubor nebo díly bez překódování → Google Files API/Gemini.
- `src/lib/nahravky/transcribe/ffmpeg-args.ts:35–55`: časové dělení s `-c copy`.
- `src/lib/nahravky/transcribe/client.ts:650–715,905–970`: MIME+soubor poskytovateli.
- `src/app/(app)/nahravky/nahrat/file-drop-zone.tsx:99–104`: přijímá `.webm`.

🟡 Kompatibilita je doložená kódem checkoutu. Nasazená verze a správnost živého přepisu
z tohoto čtení nevyplývají. Server zachová stereo, ale prompt nemá explicitní pravidlo
pro rozpoznání mluvčího podle kanálu; to musí potvrdit skutečná přejímka.

Oficiální Gemini dokumentace navíc uvádí `audio/webm` mezi podporovanými vstupy:
https://ai.google.dev/gemini-api/docs/generate-content/audio
To není měření výsledného společného přepisu schůzky.

## Podklad pro volbu kodeku

Oficiální popis Opusu: https://opus-codec.org/ (řeč i obecné audio).
RFC 7587, doporučené datové toky: https://www.rfc-editor.org/rfc/rfc7587.html
96 kb/s stereo je naše volba kompromisu pro dvě současné řečové větve, nikoli naměřené
optimum kvality přepisu. Vyhne se další ztrátové konverzi již pořízeného Opusu do MP3.

Starší MP3 měření jsou zachovaná v `dukazy/stereo-mp3-2026-09-15/` a nepočítají se
jako splnění akceptace D21.
