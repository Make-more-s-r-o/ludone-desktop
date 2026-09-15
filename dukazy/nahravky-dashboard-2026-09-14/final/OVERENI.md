---
kind: verification
ref: 33938351
verdict: partial
measuredAt: 2026-09-14T23:13:43.290030+00:00
scope: [T0–T6, T-A4, T-I1]
measuredFrom: [čistý klon s novým npm ci, nativní GUI izolované aplikace]
---

# Integrační přejímka před vydáním

🧪 **`npm run gates:clean` exit 0** nad `33938351`: čistý klon, nové npm ci,
lint, typecheck, **1505 PASS**, tři původní skipy, kontrola baseline a build.
Doslovný výstup je v `gates-clean-after-ci.log` (původní běh nad `475c77bf` zůstává v `gates-clean.log`). Kontroly ani baseline nebyly oslabené.
Výsledná A4 byla navíc před commitem nezávisle ověřena 1503 testy; T-I1 přidává dva testy.

🟡 **Nativní GUI 15. 9. 00:57–00:58, verze 0.1.2:** nový root build exit 0
(`gui-build.log`), oddělený již dříve založený profil `.runtime/gui-review`,
`LUDONE_E2E=1`, transport výslovně vypnutý. Otevřena standalone obrazovka bez loginu,
tlačítko Nastavení, Účet a Nahrávky. Skutečná accessibility vrstva i screenshot
potvrdily nové vysvětlení prostředí, text „Pro výběr firmy se přihlas“ a opravené
vysvětlení odhlášení. Okno 448 × 676 zůstává čitelné, Hotovo dostupné. Prázdný přehled
správně hlásí, že na testovacím profilu nejsou nahrávky. Aplikace ukončena Cmd+Q,
proces skončil exit 0. Screenshot je pouze v konverzaci; veřejný Git nearchivuje
název skutečného zařízení z obrazovky. Ojedinělá systémová zpráva Electron menu při
ukončení zůstává v nástrojovém výstupu; aplikace skončila úspěšně.

⛔ **Nebyly provedeny:** produkční login a upload, načtení skutečných firem,
audio, akce nad osobními soubory, podpis, notarizace, instalace a update.
`ui-smoke` ani `audio-smoke` agent nespouštěl. Postup pro Dana je v
`docs/changes/nahravky-dashboard/OVERENI-NA-MACU.md`.

## Review výsledného rozsahu

1. Správnost: převzaty T0–T5, auth A1–A4, limity R1 a příprava T6; navazující opravné
   úlohy uzavřely konkrétní nálezy. T-I1 neoznačuje stav fronty za skutečnou serverovou shodu.
2. Bezpečnost: root review auth/IPC/vlastnictví/idempotence a release je archivované po
   etapách; nezávislé T5 review a A4 root review mají doložené opravy. Tokeny zůstávají v main.
3. Kritické invarianty: consent starých položek, per-track IDs, pin firmy před INIT,
   retry limity, serializace vlastnictví a zrušení mazání mají regrese a sabotážní důkazy.
4. Intent/spec: bez backendu, LuTrack změn nebo nového archivu. Přepis/analýza jsou na webu.
5. Plán: závěrečné opravy běžely ve dvou oddělených stromech, hotspoty se předávaly postupně.
6. Design: existující UI doplněné dle D10; redesign odložený. Chybějící hook artifact
   `artifacts/design/approved.json` zůstává pravdivý procesní nález C2; souhlas se rozsahem
   vychází z výslovného uživatelského goalu, žádné schválení nebylo vyrobené.
7. Evidence: úspěšné i neúspěšné příkazy archivované s exit kódy; původní CI selhání
   `34904595978` je zachované, nová časová fixture prošla UTC i Europe/Prague.
8. Progress: implementační tasky completed, funkce nejvýš tests-green a exposure unavailable.
   Vydání ani živé ověření se nevydávají za dokončené.

## Proč to není chyba měřidla

Čistý klon nevyužívá necommitnutý runtime ani root node_modules. Regrese měří podle
potřeby disk, main/preload, mockované HTTP i skutečný React renderer. Nativní GUI je
druhý druh pozorování, ale pouze pro výslovně popsané odhlášené obrazovky; nepotvrzuje
síť ani zvuk. Review a dílčí důkazy jsou ve složkách jednotlivých etap.

## Co zbývá

- Potvrzená firemní záloha `.p12` s heslem a GitHub `DOWNLOAD_SSH_*` konfigurace.
- Danův finální tag, skutečný podpis/notarizace, publikace a veřejná kontrola T6.
- Ruční přejímka Finder loginu, audia, doručení obou stop, instalace a aktualizace.
- Známá hranice bezpečného koše: po posledním ověření FD zůstává malé TOCTOU okno
  systémového `shell.trashItem(path)`; detaily v `T5/root-review.md`.

🧪 **GitHub CI 34907553077 na `33938351` skončilo success:** 1505 PASS, tři původní skipy a build. Metadata `ci-green.json`, úplný doslovný log `ci-green.log`. Druhý CI nález a oprava pouze testovacího čekání jsou popsané v `ci-updater-review.md`; negativní i přesná pozitivní aserce zůstaly. Runtime se proti GUI pozorovanému nad `475c77bf` nezměnil. Pozdější commity archivují pouze dokumentaci a důkazy.
