# Přejímka jednoho stereo WebM/Opus — 23. 9. 2026

Stav: 🧪 zelené testy. D21 mění formát D20 na jeden WebM/Opus s cílem 96 kb/s celkem, mikrofon L / systém R. Nový živý stereo záznam se pouze přebalí; Opus pakety zůstávají stejné. Bezpečné staré dvojice se zarovnají a převedou. Produkčně publikovaná zůstává 0.1.3.

## Implementace a review

- Nová schůzka má trvalý master, jeden výsledný soubor, sidecar a jediný serverový recordingId. Před síťovým požadavkem je uložena jeho identita. Restart zachovává přesné bajty a hash.
- Již zahájený historický dvoustopý upload se neinterpretuje jako nový. Migrační zábrana respektuje i company pin/historii pokusů a přežije převzetí vlastnictví. Žádný fallback na dva uploady.
- Koš a retence ověřují deriváty před mazáním. Dvě review opravy blokují koš při osiřelém souboru bez descriptoru a při pádu mezi publikací souboru a zápisem ready identity.
- Root + nezávislé Sol read-only review produktu na `e585b9197cedb2772430df190f803273c0c41a85`: žádný zbývající potvrzený P1/P2 v single uploadu, obnově identity, IPC, mazání nebo balení/podpisu encoderu. Následný `60b7e1e` pouze rozšiřuje regresi na failed stav.
- Nezměněn backend, LuTrack ani cizí design. Testovací očekávání formátu a počtu uploadů se mění přímo podle D21; žádná výjimka, nový skip ani změna baseline.

## Důkazy přejímky

| Kontrola | Výsledek |
|---|---|
| `npm run gates` | `gates.log`: 1553 PASS, 3 původní skipy, lint/typecheck/baseline, exit 0; před přidáním jedné další regrese failed. |
| Čistý klon `7b76888f` | `gates-clean.log`: vlastní npm ci, 1554 PASS, 3 původní skipy, lint/typecheck/baseline/build; exit 0. |
| Lokální balení obou Maců | `package.log`: DMG + ZIP arm64/x64, bez podpisových proměnných; exit 0. `package-arm64.log`, `package-x64.log`: všech 20 runtime balíčků uvnitř aplikace, architektura, hash encoderu a zdrojové archivy/notice; exit 0. |
| Encoder ze skutečné `.app` | `packaged-native.log`: stejné syntetické audio a restart identity prošly přes moduly a Resources z arm64 aplikace; exit 0. |
| Build / E6 | `build.log`, `E6.log`, exit 0. |
| Nativní 12s syntetika | `native.log`: obě oddělené frekvence správně L/R, 576000 vzorků, mic-only R ticho, zarovnání 250 ms, stejné live Opus pakety, režim 0600, zákaz přepsání, nový proces znovu nepřevádí. Exit 0. |
| Nativní hodinová syntetika | `hour.log`: jeden Opus stream, 48 kHz / 2 kanály, 3600.028 s, 60 522 228 B, přebalení 1.115 s, celé dekódování bez chyby. Exit 0. Velikost při VBR závisí na obsahu; 43 MB/h je nominální odhad, ne limit. |
| Encoder pro oba Macy | `T-S2/native-build.log`, `native-check.log`: připnuté FFmpeg 6.1.6 + Opus 1.6.1, obě architektury, zdrojové hashe, skutečné přepodepsání ad-hoc a stabilní kanonický hash. Exit 0. |
| Regresní a sabotážní důkazy | `T-S1/`, `T-S2/`: cílené testy a skutečný RED → GREEN. Převzatá retence z `dukazy/stereo-mp3-2026-09-15/T-SR/` je prověřena společnou branou i pro Opus. |

## Původní neúspěchy zůstávají dohledatelné

- `gates-initial.log`: nepoužitý parametr nového testu; opraven použitím URL v aserci, původní kontroly zachované.
- `native-initial.log`: místní x64 referenční ffmpeg nešel spustit na arm64 bez Rosetty. `T-S2/test-reference.log` dokládá samostatný testovací arm64 build ze stejných ověřených zdrojů; shipping encoder se tím neměnil.
- `native-harness-initial.log`: nová akceptace špatně četla parametr ffprobe. Opravena parametrizace a vnoření packaged encoder options; aserce neoslabeny.
- `package-initial.log` / `package-audit-initial.log`: builder dokončil lokální balení, ale dočasný symlink na cizí node_modules způsobil chybějící runtime závislosti. `dependency-prepare.log` dokládá vlastní npm ci; finální balení i audit obou architektur prošly. Tyto instalačky nebyly publikované.

## Co není ověřeno

⛔ Skutečný záznam schůzky, instalace/aktualizace 0.1.4, produkční upload a výsledný společný přepis. Syntetické audio ani mock HTTP nejsou náhradou za [živou přejímku](../../docs/changes/nahravky-dashboard/OVERENI-NA-MACU.md). Agent nespouštěl ui-smoke/audio-smoke ani neposílal soukromé audio na server.

🟡 Nový release tag čeká na samostatné pověření: původní uživatelský goal rezervoval tag Danovi a D19 byla konkrétní výjimka pro v0.1.3. Záloha klíče a publikační přístupy jsou dříve potvrzené; není potřeba je znovu vyžadovat.
