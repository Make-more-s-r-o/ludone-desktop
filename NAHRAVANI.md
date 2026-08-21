# Skutečné nahrávání zvuku

Ověřeno 21. 8. 2026 ve worktree
`/Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/kostra` na větvi
`feat/kostra-appky`. Výchozí commit byl `32da5e2`.

## Co je zapojené

- Hlavní panel se načítá přes `loadFile`, tedy v zabezpečeném `file://` kontextu s dostupným
  `navigator.mediaDevices`.
- Mikrofon se získá přes `getUserMedia({ audio: true })`.
- Systémový zvuk se získá přes `getDisplayMedia({ video: true, audio: true })`; main process vrací
  první obrazovku a `audio: "loopback"` přes `setDisplayMediaRequestHandler`. Vyžádaná obrazová
  stopa se ihned zastaví a nikam se nezapisuje.
- Mikrofon a systémový zvuk mají každý vlastní `MediaRecorder` a vlastní soubor WebM.
- Soubory a jejich cesty vytváří výhradně main process v
  `app.getPath("userData")/nahravky`. Název obsahuje čas začátku a krátký náhodný identifikátor.
- `MediaRecorder.start(1000)` odevzdává přibližně sekundové chunky. Renderer je okamžitě a
  sekvenčně posílá přes IPC; main process ověřuje vlastníka session, stopu, pořadí a velikost,
  připojí chunk k souboru a před potvrzením provede `FileHandle.sync()`. Při pádu tak zůstávají
  chunky, které už main process potvrdil.
- Pád rendereru, reload i zničení okna uzavře existující session. Pokud událost přijde během
  přípravy souborů, příprava se zruší, handly se zavřou a rozpracované prázdné soubory odstraní.

## Kontrola před nahráváním

Po stisku tlačítka aplikace nejprve ověří zabezpečený kontext a dostupnost `mediaDevices`, získá
oba streamy a u obou audio stop zkontroluje `kind === "audio"`, `readyState === "live"`,
`enabled === true` a `muted === false`. Ověření se zopakuje bezprostředně před spuštěním obou
rekordérů. Stav UI, tray i časovač se přepnou na nahrávání teprve po události `start` od obou
rekordérů. Při chybě se všechny už získané stopy zastaví a uživatel dostane chybu ještě před
schůzkou.

V úspěšném běhu měly stopy názvy:

- mikrofon: `Default - Mikrofon MacBook Pro (Built-in)`
- systémový zvuk: `System audio`

## Skutečný integrační běh

Finální důkaz běžel v sestaveném balíku `release/LuDone Desktop.app` s Electronem 37.3.1
deklarovaným a přítomným v tomto projektu. Balík byl lokálně ad-hoc podepsaný bez hesla a
`codesign --verify --deep --strict` jej ověřil. Spustil jsem přímo executable balíku; renderer
načetl `Contents/Resources/app/dist/index.html`, tedy kód skutečně z release aplikace. Test přes
skutečné CDP události myši stiskl tlačítka existujícího UI, počkal na potvrzený stav obou
rekordérů, nahrával pět sekund, zastavil nahrávání a počkal na potvrzení obou souborů na disku.
Každý běh měl čerstvé `userData`, `sessionData`, cache i temp pod ignorovanou složkou `.runtime`
tohoto worktree.

Finální artefakty jsou pod
`.runtime/audio-proof-20260821-committable-packaged`. Běh v tichu trval 5 010 ms. Ve zvukovém
běhu byly po dosažení stavu `recording` spuštěny přesně tři procesy
`/usr/bin/afplay /System/Library/Sounds/Glass.aiff` na pozadí; všechny skončily s kódem 0 a
nahrávání trvalo 5 013 ms.

## Měření

Velikosti jsem změřil samostatným `stat` až po ukončení obou běhů:

| Běh | Mikrofon | Systémový zvuk |
|---|---:|---:|
| 5 s ticho | 85 169 B | 1 351 B |
| 5 s + 3× Glass.aiff | 85 517 B | 27 993 B |

Systémový soubor se zvukem je o 26 642 B větší a má 20,72násobek velikosti tiché systémové
stopy. Splňuje i přísnější automatickou hranici `max(ticho × 3, ticho + 4096) = 5 447 B`.
Rozdíl jednoznačně potvrzuje, že do samostatné systémové stopy skutečně teče přehrávaný zvuk.

Nezávislá kontrola přes `ffmpeg` dekódovala ze systémových souborů 244 800 a 241 920 vzorků,
tedy přibližně 5,10 a 5,04 s při 48 kHz. Tichá stopa měla průměr i maximum −91,0 dB; zvuková
stopa měla průměr −20,0 dB a maximum 0,0 dB. Dekodér u každého souboru zároveň jednou vypsal
`Error parsing Opus packet header` a WebM nemá zapsanou celkovou délku v hlavičce; celý měřený
interval přesto dekódoval. Zachycení zvuku je prokázané, ale kompatibilitu kontejneru je vhodné
před budoucím zpracováním na serveru dořešit remuxem nebo cíleným testem přehrávačů.

Konkrétní soubory finálního měření:

- ticho: `2026-08-21T06-39-05-699Z-ae649b64-mikrofon.webm`
- ticho: `2026-08-21T06-39-05-699Z-ae649b64-system.webm`
- zvuk: `2026-08-21T06-39-12-336Z-e806fb48-mikrofon.webm`
- zvuk: `2026-08-21T06-39-12-336Z-e806fb48-system.webm`

## Odchylky a omezení

- GUI proces spuštěný přímo z omezeného příkazového sandboxu macOS skončil ještě před načtením
  rendereru a LaunchServices odtud vracely `kLSNoExecutableErr`. Nepoužil jsem `sudo`, nezvyšoval
  práva a nic neinstaloval; skutečný běh proto proběhl v existujícím hostitelském terminálu.
- Předchozí pokusy spuštěné přes `open` aplikaci otevřely, ale capture skončil na
  `Failed to get sources` / `Invalid capture constraints`. Přímé spuštění executable se stejným
  kódem uspělo opakovaně na Electronu 43, na projektovém zdrojovém Electronu 37 a nakonec i v
  projektovém release balíku; výše jsou čísla z posledního zabaleného běhu po poslední změně kódu.
- Odesílání na server, přepis, přihlášení a kalendář zůstávají záměrně předstírané.
