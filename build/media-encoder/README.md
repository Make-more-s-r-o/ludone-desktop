# Media encoder v LuDone Desktop

Aplikace spouští tento program jako samostatný proces. Živé stereo WebM/Opus pouze
přebalí do WebM s délkou záznamu bez nové ztrátové komprese. Starší oddělené stopy
zarovná a zakóduje jako stereo Opus 96 kb/s (mikrofon vlevo, systém vpravo).
Binárka je minimální sestavení FFmpeg 6.1.6 s nativním Opus decoderem a staticky
připojenou knihovnou libopus 1.6.1.
Nevyžaduje Homebrew, systémový `PATH` ani stažení za běhu.

Přesné URL, SHA-256, verze a cíl macOS jsou v `media-encoder-lock.json`.
Součástí aplikace je adresář `sources/` s původními zdrojovými archivy, build
skriptem a lockem. Reprodukce z checkoutu na Macu s Xcode Command Line Tools:

```sh
node scripts/prepare-media-encoder.mjs --arch all --force
```

Reprodukce z distribuovaného balíčku: zkopírujte celý adresář `sources/` do
zapisovatelného umístění, přejděte do něj a spusťte:

```sh
node prepare-media-encoder.mjs --arch all --force
```

Binárky pak vzniknou v `sources/.runtime/media-encoder/ffmpeg-6.1.6/`.

Výsledné binárky jsou v
`.runtime/media-encoder/ffmpeg-6.1.6/darwin-{arm64,x64}/ffmpeg`.
macOS systémové knihovny zůstávají dynamické; FFmpeg a libopus jsou vůči sobě
propojené staticky. Projekt nezapíná volby FFmpeg `--enable-gpl`,
`--enable-version3` ani `--enable-nonfree`.
