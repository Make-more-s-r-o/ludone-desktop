# Jak zmenšit nahrávky — návrh k #179

9. 11. 2026; podklad: commit `7e043c228ec7b85dafcf57cdb87d401496d1f596`.

## Stav

Varianta A je provedena v aktuálním panelu: `send`, `keep` ani automatické odeslání
kopii do Stažených nevytváří. Kopii vytvoří jen výslovné „Exportovat kopii…“; lze
ji vyžádat i později v detailu uložené nahrávky. Starší `recording:export` IPC
zůstává kompatibilní cestou pro rozhodnutí send/keep, ale soubor nekopíruje.
Upload dál čte delivery soubor z `nahravky/`. Varianty B a C čekají na rozhodnutí.

**Doporučení:** přestat automaticky vytvářet kopii do Stažených a ponechat ji jako
výslovné „Exportovat kopii…“. To v tomto vzorku ušetří **40,01 MB na hodinu** bez
změny zvuku a bez mazání existujících souborů. Dále navrhuji k samostatnému
schválení uvolnění masteru **až po potvrzeném uploadu a ověření výstupu**;
celková úspora by pak byla **80,02 MB/h (37,69 %)**. Originální stopy zůstávají.

**64 kb/s je kandidát k poslechu a porovnání přepisu**, nikoli ověřená náhrada D21.
S oběma výše uvedenými opatřeními by celkové audio kleslo z **212,30 na 118,44 MB/h**.
48 kb/s je další srovnávací vzorek. Tento dokument nemění aplikaci, nastavení,
retenci ani soubory uživatele. Implementace varianty A nemění nastavení, retenci
ani existující soubory. Nezavádí strop místa ani mazání neodeslaných nahrávek.

🧪 Výpočty, existence souborů, dekódování a shoda paketů při remuxu prošly kontrolou.
🟡 Čísla jsou extrapolací tříminutové simulace ve FFmpeg, nikoli změřením živého
záznamu v aplikaci. ⛔ Lidský poslech, GUI, živý záznam a přepis Gemini neověřeny.

## Co dnes vzniká na disku

`<data>` znamená `app.getPath("userData")`, `<prefix>` čas a prvních osm znaků UUID.
D21 stanovuje **jeden stereo WebM/Opus, cíl 96 kb/s celkem**, mikrofon vlevo,
systém vpravo, bez druhého ztrátového překódování
([ROZHODNUTI.md, D21](../ROZHODNUTI.md#d21--stereo-opus-místo-povinného-mp3-23-9-2026)).
96 kb/s se netýká originálů: ty mají každý požadavek 128 000 b/s.

| Soubor na jednu schůzku | Formát a parametry | Vznik a zánik dnes | Zdroj soubor:řádek |
|---|---|---|---|
| `<data>/nahravky/<prefix>-mikrofon.webm` | WebM/Opus, požadavek 128 kb/s; kanály a vstupní vzorkování určí zařízení/Chromium, nejsou vynucené. V simulaci mono, 48 kHz. | Otevření na začátku; sekundové chunky se připojují do stejného souboru. Po stop se uzavře a spočítá hash. Zůstává podle existující retence. | `src/features/recording/RecordingCard.jsx:43`, `:629`, `:114`; `electron/main.cjs:1464`, `:1748`, `:1900` |
| `<data>/nahravky/<prefix>-system.webm` (jen při systémovém zvuku) | WebM/Opus, požadavek 128 kb/s; Web Audio destination má explicitně dva kanály. Jeho rate vychází ze sdíleného AudioContextu. V simulaci 48 kHz, mono zdroj zduplikovaný L/R. | Vznik a konec jako mikrofon; při výpadku fyzického zdroje běží stabilní větev dál s tichem. | `src/lib/stereo-recording.js:42`, `:68`; `src/features/recording/RecordingCard.jsx:631`; `electron/main.cjs:1464` |
| `<data>/nahravky/<prefix>-stereo-master.webm` | Živý WebM/Opus 96 kb/s, dva kanály L=mikrofon/R=systém. AudioContext nemá vynucený sampleRate; Opus dekódování se běžně hlásí jako 48 kHz. | Současně s originály; začne první, skončí poslední. Platný master se při úspěšném exportu hned nemaže. Retence jej ověřuje a maže společně s příslušnou odeslanou nahrávkou. Chybný staging má i samostatné chybové úklidové větve. | `src/features/recording/RecordingCard.jsx:636`; `src/lib/stereo-recording.js:26`; `electron/main.cjs:1478`, `:1870`; `electron/meeting-audio.cjs:651`; `electron/retention.cjs:341` |
| `<data>/nahravky/<prefix>-stereo.webm` | Uploadový WebM/Opus. U živé nahrávky **remux `-c:a copy` z masteru**, stejné audio pakety; rozdílný kontejner. | V přípravě exportu nebo fronty. Po potvrzení uploadu zůstává do existující retence. Starší bezpečné dvojice se místo remuxu zarovnají na 48 kHz a zakódují libopus 96k, VBR on, stereo. | `electron/meeting-audio.cjs:42`, `:593`; `electron/media-encoder.cjs:46`, `:70`, `:92`; `electron/main.cjs:3043` |
| `Stažené/LuDone-<čas>-<název>-<UUID>.webm` | Bajtová kopie uploadového souboru, žádné další kódování. | **Před variantou A:** `send`, `keep` i automatické odeslání vytvářely kopii. **Po variantě A:** vznikne jen výslovným „Exportovat kopii…“ v panelu nebo detailu uložené nahrávky. Není to kopie každého rozpracovaného záznamu ihned po startu. Aplikační retence tuto cizí složku neuklízí; kopie zůstává do zásahu uživatele. | `electron/main.cjs` (`recording:export-copy`); `electron/recording-export.cjs`; `src/features/recording/RecordingCard.jsx`; `src/features/recordings/RecordingsDashboard.jsx` |
| `<prefix>.manifest.json`, `<prefix>.manifest.json.meeting-audio-v1.json` | JSON identity, časy, velikosti, SHA-256 a stav přípravy. Druhý soubor popisuje delivery a master. Bez bitrate. | Obnovovací manifest ještě před prvním chunkem, poté atomicky aktualizovaný. Delivery sidecar po dokončení masteru, následně ready. Existující retence je zahrnuje do ověřeného úklidu. | `electron/main.cjs:1627`, `:1641`, `:2861`; `src/lib/manifest.js:132`; `electron/meeting-audio.cjs:49`, `:183`, `:623`; `electron/retention.cjs:350` |
| `<data>/queue/outgoing.json` | Sdílený JSON všech položek fronty; **neobsahuje další kopii audia**, jen cesty a stav. | Zařazení a každý postup se atomicky ukládají přes `.tmp`, fsync a rename. Neodeslané soubory jsou stále tytéž originály/master/delivery v `nahravky/`. Odstranění dokončené položky navazuje na existující retenci. | `electron/main.cjs:2228`; `electron/queue.cjs:393`; `src/lib/queue.js:330`; `electron/retention.cjs:475` |
| `.media-encoder-*/<UUID>.webm`, JSON `.tmp`, případný `.recovered-upload-v1.json` | Pracovní WebM a malé JSON soubory při převodu, atomickém zápisu nebo obnově. | Převod nejprve zapíše celý výstup do soukromého adresáře; publikuje jej **hardlinkem**, pak odstraní dočasné jméno. Po pádu mohou zbýt pozůstatky. Obnovovací sidecar vzniká jen při recovery. | `electron/media-encoder.cjs:286`, `:319`, `:348`; `electron/meeting-audio.cjs:183`; `electron/queue.cjs:642`; `electron/retention.cjs:12` |
| Uploadové části | Buffery v RAM, formát jsou úseky téhož WebM; žádné další trvalé lokální `.part` audio. | Čtou se z delivery při odesílání a mizí z paměti. Serverové části nejsou lokální úložiště Macu. | `electron/upload-client.cjs:824`, `:938` |

Existující retence vybírá pouze `odeslano` s platným `sentAt`, po uplynutí zvolené
lhůty, s kontrolou identity všech souborů; `recoveredIncomplete` chrání. Volby jsou
„Ihned smazat“, 24 h, 7 dní, 30 dní a „Nemazat“; chybějící/vadná hodnota nemaže
(`electron/retention.cjs:12`, `:23`, `:475`). Neznáme uživatelovu účinnou volbu,
proto níže počítáme soubory **před uplynutím retence**. Toto je popis kódu,
ne souhlas s novým mazáním. Chyby exportu a ruční mazání nejsou scénář měření.

Samostatně nebyl měřen skutečný capture rate ani kanály fyzického mikrofonu.
`captureAudioSources` vypíná echo cancellation, noise suppression a auto gain
(`src/lib/audio-levels.js:142`); simulace také nepřidává tyto procesory.
Bez systémového zvuku vzniká jen jeden originál, ale master i delivery nadále
mají dva kanály, pravý je tichý (`src/features/recording/microphone-only-capture.js:43`).
Níže uvedené součty jsou pro **dvouzdrojovou schůzku**, ne pro tento menší případ.

## Měření velikosti

Použito 180,000 s PCM 48 kHz stereo. Zdroj je již existující **syntetická** česká
řeč Zuzana, `dukazy/meet-2026-09-01/referencni.aiff` (28,548934 s, mono, 22 050 Hz,
16 bitů), nikoli soukromá schůzka. Její generování a text dokládá
`scripts/meet-mereni.mjs:57` a `:229`. SHA-256 zdroje:
`74a2c5cd6c4b31d3f6094a47fa41f73d3cc87677c9c8574fb7a0fb2197233f56`.

Řeč se opakuje; v každém 30s okně mikrofon mluví 0–18 s, systém 12–27 s,
12–18 s nastává překryv, 27–30 s pauza obou. Pravá větev je posunutá o 7 s.
Přimíchán slabý růžový šum, amplitude 0,002, pevné seedy 179/180.
Opakování jednoho hlasu ani omezené pásmo původního TTS nenahrazují skutečné
mluvčí, vzdálený mikrofon, hluk či hudbu. Z výsledku nelze odvodit kvalitu přepisu.

### Shoda a rozdíly proti aplikaci

V checkoutu chybí `node_modules/electron` i `.runtime/media-encoder`.
Použit místní **FFmpeg 9.0.2 + libopus 1.6.1**. Produkce pro živý master používá
**Chromium MediaRecorder**; přibalený FFmpeg **6.1.6 + libopus 1.6.1** jej následně
jen remuxuje (`scripts/media-encoder-lock.json:4`). Pro historické originály
přibalený FFmpeg provádí skutečné kódování. Nejde tedy o přesné měření Chromium.

Zachováno: WebM/Opus, VBR, cílový tok 96/64/48 kb/s **pro celé stereo**, mapování
L/R, vstup 48 kHz, originály 128 kb/s a následný bezztrátový remux. Simulace používá
`-application audio -frame_duration 60`; aplikace tyto dvě volby explicitně nenastavuje.
60 ms odpovídá starším měřením Chromium v `ROZHODNUTI.md`, není to garance dnešní
verze. Web Audio, délka rámců, politika VBR, kontejnerové chunky a verze encoderu
mohou měnit skutečnou velikost. Simulovaný systémový originál má zduplikovaný mono
obsah, skutečná systémová stopa může obsahovat nezávislé stereo a být větší.

Parametry remuxu byly získány přímo voláním produkční
`conversionArguments({stereoWebmPath, temporaryPath})`; tři kontroly ověřily shodu
syrových Opus paketů master → delivery. Neproběhlo kódování 64/48 z 96kb/s výstupu:
všechny varianty mají tentýž neztrátový PCM vstup.

| Varianta / soubor | Bajtů za 180 s | MB/h | Nominální tok × 3600 / 8 (MB/h) |
|---|---:|---:|---:|
| Originál mikrofon 128 kb/s, mono | 2 616 396 | 52,32792 | 57,60 |
| Originál systém 128 kb/s, dva kanály | 1 997 040 | 39,94080 | 57,60 |
| D21 master 96 kb/s, stereo | 2 000 581 | 40,01162 | 43,20 |
| D21 upload 96 kb/s, stereo | 2 000 537 | **40,01074** | 43,20 |
| Master 64 kb/s, stereo | 1 308 384 | 26,16768 | 28,80 |
| Upload 64 kb/s, stereo | 1 308 340 | **26,16680** | 28,80 |
| Master 48 kb/s, stereo | 991 714 | 19,83428 | 21,60 |
| Upload 48 kb/s, stereo | 991 670 | **19,83340** | 21,60 |
| Výzkumné mono 16 kHz / 48 kb/s | 1 060 644 | 21,21288 | 21,60 |

MB = 1 000 000 B, ne MiB. Přepočet je `bajty / 1 000 000 × 3600 / 180`.
Jde o extrapolaci tří minut včetně hlaviček, nikoli skutečný hodinový soubor.
VBR znamená, že požadovaných 96 kb/s není naměřená konstanta ani pevný strop.
Dekódované délky byly 180,000 s, kontejner hlásí 180,008 s kvůli kodekovému obalu;
pro extrapolaci je jmenovatelem 180 s původního obsahu.

Mono/16 kHz zde **nevyšlo menší než stereo/48 kb/s**. Není to obecný závěr o mono;
lišily se rozhodování kodeku a reprezentace vstupu. Opus i u 16kHz vstupu hlásí
dekódování 48 kHz. Mono navíc slije mikrofon a systém, zruší D21 mapování mluvčích;
pro tuto změnu jej nedoporučuji.

## Celkové lokální místo na hodinu

`O = mikrofon + systém = 92,26872 MB/h`; `M` je master, `U` uploadový soubor.
Kopie do Stažených má přesně `U` bajtů. **Fronta nezvyšuje počet audio kopií.**

| Scénář (originály vždy zachovány) | Vzorec | 96 kb/s D21 | 64 kb/s kandidát | 48 kb/s experiment |
|---|---|---:|---:|---:|
| Dnešní struktura kopií po exportu, před retencí | O + M + 2U | **212,30182** | 170,77000 | 151,76980 |
| Bez nové automatické kopie do Stažených; před potvrzením uploadu | O + M + U | **172,29108** | 144,60320 | 131,93640 |
| Bez automatické kopie; až po ověřeném uploadu a schváleném uvolnění masteru | O + U | **132,27946** | **118,43552** | 112,10212 |

Úspora proti dnešním 212,30182 MB/h: bez Stažených při D21 **40,01074 MB/h**;
navíc po uvolnění masteru při D21 **80,02236 MB/h**; při 64 kb/s obě opatření
**93,86630 MB/h (44,21 %)**; při 48 kb/s **100,19970 MB/h (47,20 %)**.
Samotný 64kb/s upload je o 13,84394 MB/h (34,60 %) menší než D21 upload.

Tabulka sčítá **všechny trvalé audio kopie** pro tuto cestu. K fyzickému součtu se
přičítají skutečné JSON manifesty, delivery sidecar a přírůstek sdílené fronty;
ty nemají univerzální MB/h (závisí na počtu schůzek, cestách, názvu, průběhu a
recovery). Jejich velikost v reálném profilu zde nebyla změřena, proto tabulka
není přesným celkovým diskovým účetnictvím. Není v ní serverové úložiště,
aplikační cache, režie bloků APFS ani dříve ručně vytvořené kopie uživatele.

Během remuxu celý dočasný výstup roste místo budoucího `U`; při publikaci je
to hardlink na stejný inode, nikoli další fyzická kopie. Běžná špička před kopírováním
Stažených je proto přibližně `O + M + U`, po kopírování `O + M + 2U`.
Pozůstatky po pádu a opakované ruční exporty mohou tento model překročit.
Dnešní měřič prostoru deduplikuje hardlinky (`electron/recording-storage.cjs:7`).

## Navržené změny a podmínky

1. **Stažené — provedeno:** automatickou kopii nahradilo výslovné „Exportovat kopii…“.
   Uložení i upload dál pracují s interní delivery. Již existující soubory ve
   Stažených se neprocházejí ani nemažou.
2. **Master:** jen návrh k samostatnému schválení. Smí zaniknout až při současném
   splnění: hotový a dekódovatelný výstup s očekávanou délkou a oběma správnými
   kanály; trvalý lokální SHA-256 a velikost delivery; serverový `stored` se shodnou
   velikostí, SHA-256 a `recordingId`; úspěch trvale zaznamenaný ve frontě; žádná
   aktivní příprava, export, přehrávání či upload. Pouhé HTTP 200 nebo existence
   WebM nestačí (`electron/upload-client.cjs:714`, `:956`). Při jakékoli nejistotě,
   offline stavu, chybě, neodeslané či neúplně obnovené nahrávce **NIKDY**.
   Originály toto opatření neuvolňuje. Varianta retence „Nemazat“ musí být před
   implementací výslovně vyřešena; tento návrh ji neopravňuje obejít.
3. **Trvalý stav po uvolnění masteru:** dnešní delivery schema a retence vyžadují
   existující master s původním hashem (`electron/meeting-audio.cjs:636`, `:651`).
   Nestačí vložit `unlink`: je nutný odlišitelný stav legitimně uvolněného masteru,
   odolný vůči pádu, migrace a test obnovy/retence/exportu. Dokud toto není navrženo,
   přezkoumáno a schváleno, platí pouze úspora bez nové kopie ve Stažených.
4. **Bitrate:** připravit poslechový a přepisový pokus s 64 kb/s stereo; 96 kb/s
   zůstává výchozí do jeho vyhodnocení. Případná změna musí nastat při živém
   kódování masteru, nikoli dalším ztrátovým překódováním hotového 96kb/s souboru.
   Sjednotit také 96k fallback historického encoderu; rozpracované uploady a jejich
   neměnné bajty nikdy nepřekódovávat. Původních 128 kb/s v této kalkulaci neměním.

Nezavádí se limit velikosti disku, kratší retence, mazání fronty ani snižování
kvality originálů. Neodeslané audio zůstává zachované. Provedena je pouze varianta A;
varianty B a C čekají na rozhodnutí.

## Co ověřit před vydáním

- Lidský zaslepený poslech stejné minuty 96/64/48 kb/s: každý kanál zvlášť i dohromady,
  sluchátka i reproduktor; tichá řeč, sykavky, jména, čísla, překryvy a pauzy.
- Na autorizovaném testovacím prostředí přepsat stejné vzorky Gemini se stejným
  modelem a promptem; porovnat s referenčním textem po kanálech. Změřit chyby slov,
  kritických čísel/jmen a záměny mluvčích. Žádné volání Gemini zde neproběhlo.
  Syntetický opakovaný hlas doplnit skutečnými různými českými mluvčími a hlukem.
- Na skutečném Macu změřit nejméně hodinový MediaRecorder záznam, skutečný rate,
  kanály, WebM velikosti i špičku všech kopií. Vyzkoušet mikrofon samotný, mikrofon
  + systém, odpojení/obnovení systému, delší ticho a ukončení aplikace.
- GUI ověřit: automatické odesílání, `send`, `keep`, export na vyžádání a hlášky;
  následně upload a potvrzení identity, offline režim, restart/pád mezi jednotlivými
  kroky, nedostatek místa a nastavení „Nemazat“. Žádný chybný či neodeslaný soubor
  nesmí zmizet; do testů zahrnout zákaz uvolnění masteru při nejasném stavu.
- Budoucí implementaci ověřit existujícími příslušnými branami včetně stereo,
  retence/fronty a lidské Mac přejímky. `ui-smoke` ani `audio-smoke` v tomto sandboxu
  spuštěny nebyly. Zelená simulace nedokládá skutečnou zvukovou cestu.

## Poslechové soubory a reprodukce

Tři poslechové vzorky (96/64/48 kb/s), skripty měření a výsledky jsou v repozitáři v adresáři:

```text
../dukazy/2026-11-09-velikost-179/
```

Ostatní soubory měření (originály 128 kb/s, 180s varianty, mono vzorek a neztrátové
reference WAV, celkem asi 60 MB) zůstaly **mimo repozitář**, jen v dočasném adresáři
na Dev_LuDone. Kontrolní skript `overeni.py` proto v čistém checkoutu všech 13 souborů
nenajde; jeho výpis níže pochází z běhu nad úplnou sadou.

| Soubor (tentýž úsek původní simulace 30–90 s) | Bajtů |
|---|---:|
| `poslech-96kbps-60s.webm` | 667 387 |
| `poslech-64kbps-60s.webm` | 436 819 |
| `poslech-48kbps-60s.webm` | 331 088 |
| `mono-16khz-48kbps-60s.webm` (výzkumné srovnání) | 352 842 |

Vedle nich jsou neztrátové `reference-180s.wav` a `reference-60s.wav`, celé
180s varianty, `mereni.py`, doslovná argv a exit kódy v `prikazy.json` a
velikosti, ffprobe a SHA-256 v `vysledky.json`. Počáteční soubor `rec-zuzana.aiff`
je **vadný nulové délky**, vznikl pokusem `say`, a není použit v měření ani určen
k poslechu. `say` vrátil exit 0, ale oznámil `sandbox_extension_issue_file failed`;
ffprobe odhalil 0 s. Kontrola délky zabránila měření ticha místo řeči.

Reprodukce: v tomto checkoutu spustit `python3 "$DIR/mereni.py"` s proměnnou `DIR`
nastavenou na adresář výše; skript používá `-n`, existující výstupy nepřepisuje.
Pro nový běh zkopírovat skript do nového prázdného adresáře. Potřebuje dostupné
binárky `/opt/homebrew/bin/ffmpeg`, `/opt/homebrew/bin/ffprobe`, Node a libopus.
`mereni.py` obsahuje celý filtr, parametry i zdrojový textový odkaz. Nový adresář
zajistí, že se žádný uživatelský soubor nemaže kvůli opakování měření.

Na začátku bylo ověřeno pwd, poslední commit a čistý `git status --porcelain`.
`gh issue view 179 -R Make-more-s-r-o/ludone-desktop` skončilo exit 1:
`error connecting to api.github.com`. Obsah issue se proto nepodařilo přečíst;
rozsah vychází z celého předaného `packet-179.md` a citovaného Danova rozhodnutí.
Žádné MCP, subagenti, zapisující příkazy Git ani odesílání ven nebyly použity.


### Doslovný výpis akceptačního příkazu

```text
python3 ../dukazy/2026-11-09-velikost-179/overeni.py
PASS všech 13 měřených souborů existuje; bajty i SHA-256 souhlasí
PASS přepočet MB/h ze skutečných velikostí a dekódované délky 180/60 s
PASS tři poslechové varianty: správné velikosti, WebM/Opus stereo 48 kHz, stejná minuta
PASS součty všech audio kopií dnes a ve třech variantách návrhu
PASS všechny uložené příkazy měření mají exit 0; shoda Opus paketů kontrolována v mereni.py
🧪 Simulace a výpočty prošly; ⛔ živá aplikace, poslech a Gemini přepis neověřeny
exit_code: 0
```
