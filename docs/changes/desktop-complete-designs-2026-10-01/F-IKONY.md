# F Osa — výběr a rozpracování ikon

Dan 5. 10. 2026 zvolil: „Tak varianta F jen ikony jště rozpracovat.“ F je vybraný směr; tato etapa dotahuje pouze ikony v maketě. Nejde o pokyn k implementaci produkce nebo vydání. Dřívější požadavek schválit návrh před implementací platí dál.

## Podoba k posouzení

- Původní značka LuDone z katalogu DS a návrhu Opus. Dodaný `LuDone.svg` zůstává beze změny; SHA-256 je shodné s kopií Opus: `dd15c49cb35f53b3d08e9a0b72ccb9378630df44493022557d82ac8a60d9f06a`.
- Horní lišta používá přesnou geometrii tří tahů jako monochromatický znak bez dlaždice. Nahrávání má tečku a čas; nedokončené rozhodnutí má složku a „Uložit“; omezený zvuk navíc výstražný symbol a přístupný název.
- Jedna rodina obrysových ikon 20 px, tah 1,75, zaoblené konce. Nahrávky používají dokument se zvukem místo krabice; Nastavení kolo místo filtrů; Aktualizace dvě kruhové šipky místo hodin. Nabídka má tři tečky.
- Spuštění je plný kroužek, zastavení plný čtverec. Ikona mikrofonu dál znamená zdroj i část Nahrávání.
- Navigace zachovává cíle 40 × 40 px; hlavička má 36 × 36 px. Aktivní část má také postranní značku. Názvy jsou v tooltipu při najetí a fokusu, zároveň v přístupném názvu.

[Upravená F](design/viewer.html?variant=f&preview=icons-20261005) · [přehled ikon](design/f-icons.html) · [původní F](design/viewer.html?variant=f&icons=original&preview=icons-20261005).

## Rozsah a autorství

Kompozice F zůstává od Sonnetu 5.5; ikonovou revizi navrhl a integroval Codex podle skillu LuDone Design System a dodaného brand katalogu. Nezávislé read-only review provedl Sol s nízkým effortem. Autorské `sonnet-f.css` a `sonnet-f-layout.js` se nemění. Nová vrstva je `f-icons.js` a `f-icons.css`; galerie používá stejnou definici SVG.

Revize je opt-in pouze pro F. Parametr `icons=original` ji vypne. A–E/G mají původní kresbu i styly. Žádný produkční soubor, backend, zvuk, test nebo brána se nemění. HTML dále používá fiktivní data a simulace.

🧪 69 kontrol obrazovek a témat, konkrétní tok nahrát → zavřít/otevřít → zastavit → firma/přístup → místní uložení a fokusovaný tooltip. [Důkazy](../../../dukazy/desktop-f-ikony-2026-10-05/README.md).

🟡 Dan posoudí rozpracované ikony. ⛔ Implementace F v nainstalované aplikaci, skutečná systémová tray ikona a zvuk/upload nejsou tímto náhledem ověřené.
