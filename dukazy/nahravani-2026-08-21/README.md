# Nahrávací běh 21. 8. 2026 — archiv měření

Tenhle adresář je **surový důkaz**, na kterém stojí řádky B1 a B5 v `ROZHODNUTI.md`.
Do repa se dostal 25. 8. 2026 při etapě E1b; do té doby ležel v jediné kopii
v `.claude/worktrees/kostra/.runtime/`, tedy v adresáři, který `.gitignore` ignoruje
a `git clone` nedostane vůbec.

Pochází z běhu `audio-proof-20260821-committable-packaged` — zabalená aplikace,
dva běhy po pěti sekundách: jeden v **tichu**, druhý **se zvukem** (`afplay` na
`Glass.aiff`). Chromium session-data a cache se nearchivovaly, nejsou to důkazy.

## Co v adresáři je

| Cesta | Co to je |
|---|---|
| `proof-files.json` | strojový záznam běhu — popisky zařízení, délky, velikosti |
| `ticho/`, `zvuk/` | dvě stopy z každého běhu (`-mikrofon.webm`, `-system.webm`) + `application.log` |

Nahrávky jsou schválně **rozbalené**, ne v podadresáři `nahravky/` — ten je
v `.gitignore` jako adresář, takže by do něj git vůbec nevlezl a výjimka
`!dukazy/**` by ho nezachránila.

## Jak měření zopakovat

```bash
cd dukazy/nahravani-2026-08-21
for f in ticho/*.webm zvuk/*.webm; do
  echo "$f  $(stat -f %z "$f") B"
  ffmpeg -hide_banner -i "$f" -af volumedetect -f null /dev/null 2>&1 \
    | grep -E 'mean_volume|max_volume'
done
```

## Naměřeno 25. 8. 2026 při archivaci

| Stopa | Velikost | `mean_volume` | `max_volume` |
|---|---|---|---|
| systém, ticho | 1 351 B | −91,0 dB | −91,0 dB |
| systém, zvuk | 27 993 B | −20,0 dB | 0,0 dB |
| mikrofon, ticho | 85 169 B | −58,2 dB | −44,2 dB |
| mikrofon, zvuk | 85 517 B | −59,0 dB | −46,0 dB |

Systémová stopa: **20,7×** (1 351 → 27 993 B), přesně jak tvrdí B5.

🔴 **Upřesnění, které jinde v repu chybí:** hodnoty **−44,2 dB a −46,0 dB**, kterými se
argumentuje na několika místech, jsou **`max_volume`**, ne průměr. Kdo je bude ověřovat
přes `mean_volume`, naměří −58,2 a −59,0 dB a bude si myslet, že čísla nesedí. Směr
tvrzení je u obou metrik **stejný** a to je to podstatné: mikrofon byl **se zvukem
tišší než v tichu** (−46,0 < −44,2 i −59,0 < −58,2), takže reproduktor do něj neslyšel
a přeslech je vyloučený. Kdyby zvuk do mikrofonu pronikal, čísla by šla opačně.

⚠️ **Co tenhle archiv NEDOKLÁDÁ.** Křížová korelace se `Glass.aiff` (0,9638 pro systém,
0,0098 pro mikrofon) se tady **nepočítá** — pochází z měření v `dukazy/zvuk-2026-08-20/`.
Zdrojový `Glass.aiff` navíc není součástí repa (je to systémový soubor macOS
v `/System/Library/Sounds/`), takže korelace jde zopakovat jen na Macu.
Velikosti a hladiny výš jsou reprodukovatelné odkudkoli.
