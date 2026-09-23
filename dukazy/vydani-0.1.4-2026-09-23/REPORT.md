---
kind: deploy
ref: cb47c7532e9cbc1c75c160f7528aadfc36f9d72f
verdict: verified-live
measuredAt: 2026-09-23T11:20:39.192Z
scope:
  - desktop-release-0.1.4
measuredFrom:
  - release-run.json
  - release-run.log
  - public-check.json
  - public-check.log
  - latest-mac.yml
---

# Vydání LuDone Desktop 0.1.4

✅ **Publikace ověřena naostro.** Dan výslovně pověřil koordinátora „Ano, tak vydej“ (D22). Tag `v0.1.4` ukazuje na již sloučený commit `cb47c7532e9cbc1c75c160f7528aadfc36f9d72f`.

[Release 35852937848](https://github.com/Make-more-s-r-o/ludone-desktop/actions/runs/35852937848) je COMPLETED/SUCCESS, dokončený 2026-09-23T11:20:20Z. Skutečný macOS runner prošel společnými branami (**1554 PASS**, tři původní skipy), sestavením obou encoderů, Developer ID podpisem, notarizací a ověřením DMG i ZIP pro arm64 a x64, archivací, SSH publikací a veřejnou HTTPS kontrolou. Release log má osm výslovně označených redakcí provozní SSH konfigurace ([popis](REDACTION.md)); ověřovací výstupy ani exit kód nejsou změněné. Důkaz podpisu pochází z kroku „Podepsání, notarizace a ověření DMG + ZIP“, nikoli z podobně pojmenovaných mockových PASS uvnitř testů.

Aktualizační feed [latest-mac.yml](https://stahnout.ludone.cz/desktop/latest-mac.yml) obsahuje **0.1.4**. Workflow ověřil lokální hashe vydaných artefaktů, kontrolní součty při publikaci a shodu veřejných metadat a velikostí. Root následně nezávisle načetl veřejný feed, zkontroloval verzi, přesný text poznámek, úplnou sadu čtyř balíčků, HEAD HTTP 200 všech osmi souborů a velikosti balíčků proti metadatům. `public-check.log` obsahuje jednotlivé PASS a `COMMAND_EXIT_CODE=0`.

Nezávislá kontrola z Macu nestahovala celé binární balíčky: HEAD není důkaz jejich bajtového obsahu ani podpisu. Tyto závěry opíráme o předchozí skutečné ověření balíčků v release workflow. [Read-only review](REVIEW.md) tento rozsah důkazů odděluje.

## Co verze doručuje

- Jedna nová schůzka se odesílá jako jeden stereo **WebM/Opus** s cílovým tokem 96 kb/s celkem: mikrofon vlevo, systémový zvuk vpravo. Nový živý záznam se přebalí bez další ztrátové konverze.
- Trvalý společný soubor a jedno serverové ID se zachovají při restartu i opakování. Původní lokální soubory zůstávají podle retence.
- Bezpečné staré dvojice bez zahájeného uploadu lze spojit; historické rozpracované uploady se automaticky nepřepínají na novou identitu. Již odeslané dvě stopy se zpětně nemění.
- Přibalený encoder pro oba Macy nevyžaduje další instalaci. Dosavadní upozornění na aktualizaci a instalace po kliknutí zůstávají dostupné.

[Technická přejímka](../stereo-opus-2026-09-23/REPORT.md) obsahuje čistý klon, syntetické stereo, hodinový soubor, úplnost balení a review produktového diffu.

## První neúspěšné CI není skryté

⚠️ První post-merge CI 35849447839 selhalo na čekání na app.quit v jednom testu. Nezměněný druhý pokus nad totožným commitem prošel. Oba výpisy zůstávají archivované; [review](REVIEW.md) vysvětluje hranici závěru. Žádný test, timeout, skip, baseline ani produktová bariéra se kvůli vydání neměnily. Release brány následně znovu prošly na macOS.

## Co ještě ověří člověk

⛔ Read-only kontrola před vydáním ukázala nainstalovanou **0.1.3** (`installed-before.txt`). Tento běh aplikaci neinstaloval ani neovládal. Publikace není instalace: skutečný přechod 0.1.3 → 0.1.4, oznámení macOS, živý stereo záznam, produkční upload a společný přepis čekají na [krátkou přejímku na Macu](../../docs/changes/nahravky-dashboard/OVERENI-NA-MACU.md#přejímka-stereo-webmopus--nrd-09-po-vydání-navazující-verze). Zvuková cesta má zatím nejvýš 🧪 zelené testy.

`premisaPlatila: true`. `kontrolniNula`: 0 změn backendu/LuTracku/designu, 0 nových přístupů, 0 produkčních uploadů a 0 provedených ui-smoke/audio-smoke.
