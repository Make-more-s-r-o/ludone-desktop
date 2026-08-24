# Nález: zachycení systémového zvuku v Electronu na tomto Macu

> [!WARNING]
> **PŘEKONÁNO 21. 8. 2026.** Měření z 20. 8. bylo o den později vyvráceno
> závěrem v [`NALEZ-OPAKOVANI.md`](NALEZ-OPAKOVANI.md). Citovaná křížová korelace
> **0,9638** pro systém a **0,0098** pro mikrofon v tomto adresáři doložená není,
> protože se surová data nedochovala. Reprodukovatelný důkaz z 21. 8. je v
> [`../nahravani-2026-08-21/`](../nahravani-2026-08-21/); kontext a pořadí čtení
> shrnuje zdejší [`README.md`](README.md).


Datum pokusu: 20. 8. 2026  
Výsledek: **SYSTÉMOVÝ ZVUK NEFUNGUJE.** Mikrofon se v tomto běhu také nepodařilo otevřít.

## Krátký závěr

Aplikaci jsem skutečně spustil jako macOS GUI, přivedl její okno dopředu a na tlačítko
„Nahrát 10 sekund“ poslal skutečné události `mousePressed` a `mouseReleased`. Vyzkoušel jsem
přesně tři cesty systémového zvuku. Ani jedna nevrátila použitelný audio stream: volání vždy
zůstalo neukončeně čekat v capture vrstvě a nevyvolalo chybu. Proto se dva MediaRecordery
nemohly spustit a žádný WebM soubor nevznikl.

Tohle není důkaz, že macOS CATap v Electronu obecně nefunguje. Je to důkaz, že v konkrétní
relaci tohoto Macu nešlo otevřít ani systémový, ani mikrofonní stream; systém zároveň
nehlásil žádné dostupné audio zařízení.

## Verze

- Electron: **43.4.1** (aktuální stabilní verze podle release indexu v den pokusu)
- Chromium: **150.0.7871.224**
- Node uvnitř Electronu: **24.18.1**
- macOS: **26.4**, build **25E246**, arm64 (`process.getSystemVersion()` vrátilo `26.4.0`)
- Bundle spuštěné aplikace: `com.github.Electron`
- Skutečné verze byly vypsané běžícím hlavním procesem z `process.versions`, ne jen přečtené
  z `package.json`.

Oficiální dokumentace Electronu 43.4.1 pořád píše, že řetězcové hodnoty `loopback` a
`loopbackWithMute` podporuje jen Windows. Bundlované Chromium M150 přitom obsahuje feature
`MacCatapLoopbackAudioForScreenShare`, která je na macOS od 14.2 dostupná a v M150 zapnutá
ve výchozím stavu. Právě tento rozpor měl pokus ověřit za běhu.

## Tři vyzkoušené cesty

### 1. `setDisplayMediaRequestHandler`, `audio: 'loopback'`, bez přepínače

- Tlačítko dostalo skutečný klik; handler zaznamenal `userGesture=true`.
- `desktopCapturer` vrátil zdroj **„Celá obrazovka“**.
- Handler zavolal callback s videem a `audio=loopback`.
- `navigator.mediaDevices.getDisplayMedia()` se potom nevyřešilo ani nezamítlo po více než
  60 sekundách. Nebyla chybová hláška; přesný pozorovaný problém je timeout/neukončené čekání.
- Aplikace byla cíleně ukončena. Žádný MediaRecorder se nespustil a nevznikl soubor.

### 2. `setDisplayMediaRequestHandler`, `audio: 'loopbackWithMute'`

- Handler se zavolal, ale `desktopCapturer.getSources()` se nevyřešilo po více než 45 sekundách.
- Tento běh měl v handleru `userGesture=false`, protože diagnostické okno Nastavení systému
  bylo v tu chvíli před Electronem. Cestu proto nepovažuji za stejně silný test jako cesty 1 a 3.
- Proces bylo nutné cíleně ukončit; žádný soubor nevznikl.

### 3. `audio: 'loopback'` a explicitní feature flag

- Před `app.ready` byl nastaven
  `--enable-features=MacCatapLoopbackAudioForScreenShare`.
- Okno bylo přes DevTools protokol výslovně přivedeno dopředu a klik měl
  `userGesture=true`.
- Pro vyloučení vedlejšího deadlocku byl pomocný Web Audio test vypnutý a thumbnails pro
  `desktopCapturer` měly velikost `0 × 0`.
- Handler se zavolal, ale `desktopCapturer.getSources()` se nevyřešilo po více než 45 sekundách.
  Opět nepřišla výjimka ani callback s chybou.
- Žádný MediaRecorder se nespustil a nevznikl soubor.

Další systémovou cestu jsem nezkoušel. Explicitní zapnutí feature je v Chromium M150 podle
zdrojů redundantní, protože je zapnutá už ve výchozím stavu.

## Mikrofonní kontrola

Po vyčerpání tří systémových cest jsem stejnou aplikaci a stejné tlačítko spustil v režimu,
který volá jen `getUserMedia({audio: true})`. Nejde o čtvrtou cestu systémového zvuku.

- Stav oprávnění byl `granted`.
- `getUserMedia` nevrátilo stream ani chybu.
- Po **30,007 s** skončila aplikace měřeným
  `TimeoutError: Mikrofon nevrátil stream do 30 s`.
- MediaRecorder se tedy nespustil ani pro mikrofon.

`system_profiler SPAudioDataType -detailLevel mini` při závěrečné kontrole vypsal prázdnou
sekci `Devices`. Samostatný test přehrávání systémového zvuku přes `afplay` skončil
`AudioQueueStart (-66680)`, tedy neplatným audio zařízením. To je pozorovaný stav prostředí;
není to prokázaná příčina zamrznutí Electron API.

## Oprávnění a dialogy

Před každým pokusem běžící Electron vypsal:

- mikrofon: `granted`
- obrazovka: `granted`

Během kliknutí se **neobjevil žádný nový systémový povolovací dialog**. Nemohu proto poctivě
říct, zda by čistý profil dostal dialog jen pro systémový zvuk, nebo dialog pro záznam
obrazovky. Diagnostický nástroj otevřel ručně stránku Nastavení systému s názvem
„Záznam obrazovky a systémového zvuku“; nebyla to žádost vyvolaná Electron aplikací a
nezapočítávám ji jako dialog pokusu.

Electron interně požádal session handler o oprávnění `media` a handler je povolil. Skutečný
bundle obsahuje oba plist klíče `NSMicrophoneUsageDescription` a
`NSAudioCaptureUsageDescription`, takže výsledek nevznikl jejich absencí.

## Soubory a přehratelnost

Závěrečná kontrola na disku:

```text
nahravky/mikrofon.webm CHYBI
nahravky/system.webm CHYBI
```

- `mikrofon.webm`: **0 B** (soubor neexistuje)
- `system.webm`: **0 B** (soubor neexistuje)
- Počet vytvořených nahrávek: **0**
- Přehraje se mikrofon: **NE**, není co dekódovat
- Přehraje se systémový zvuk: **NE**, není co dekódovat
- Slyšitelný obsah: **neověřitelný**, žádná data nevznikla

FFprobe a FFmpeg byly připravené k ověření streamu, počtu paketů, dekódování a hlasitosti,
ale nad chybějícími soubory nebylo co spustit. Nulovou velikost nepovažuji za úspěch.

## Instalace a velikost

Projekt má jedinou přímou závislost, přesně připnutý Electron 43.4.1.

- `npm install --no-audit --no-fund`: **1,97 s**
- první lazy-download a rozbalení binárky Electronu: **22,50 s**
- celkem první instalace/bootstrap: **24,47 s**
- `node_modules`: **315 604 KiB**, zaokrouhleně **308 MiB** podle `du`
- lokální npm cache: přibližně 22 MiB
- lokální Electron cache: přibližně 117 MiB

Všechny cache, user data, session data a dočasné cesty byly přesměrované dovnitř tohoto
worktree.

## Co bylo jinak, než zadání předpokládalo

1. Electron 43 už nestáhl binárku během `npm install`; balíček ji stáhl lazy přes svůj
   `install-electron` skript.
2. Stažený generický `Electron.app` měl neúplný ad-hoc podpis. Pro platné spuštění bylo nutné
   neinteraktivně ad-hoc přepodepsat kopii uvnitř ignorovaného `node_modules`.
3. Izolovaný shell neměl Aqua/WindowServer relaci a syrový start končil `SIGABRT` v
   `_RegisterApplication`. Skutečné GUI proto běželo v novém hostitelském Orca terminálu;
   zdrojový pracovní adresář zůstal tento worktree.
4. macOS v této relaci nehlásil žádné vstupní ani výstupní audio zařízení. Nešlo proto
   dokončit ani mikrofonní kontrolu.
5. Capture API místo dokumentované chyby opakovaně zůstalo neukončeně čekat.
6. Žádný nový dialog oprávnění se neobjevil, protože mikrofon i screen status už byly
   `granted`.
7. Přes skutečné spuštění aplikace a kliknutí se kvůli chybějícím streamům nikdy nedošlo ke
   startu MediaRecorderu. `spustilJsemToOpravdu=true` tedy znamená spuštěné GUI a skutečný
   klik, ne úspěšný záznam.
