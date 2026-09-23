# Převzetí návrhů macOS — 23. září 2026

Rozsah: samostatné HTML návrhy A (Claude Opus 5.5 high) a B (gpt-6-astra high), společný brief a dodatek macOS. Skutečné modely jsou potvrzené v launch requested/effective z Orcy; PROVENANCE.json uchovává identifikátory a hash zadání. Produkční kód, backend, původní design/ ani uživatelská data nebyly změněné.

## Co koordinátor přímo ověřil v Codex In-app Browser

🧪 Vykreslení obou návrhů společně: světlý klidový panel 366 px, tmavé Nastavení 448 × 676, ikony pro Dock a menu bar, rozeznatelné stavy a rozbalené souborové akce. Samostatný focus.html zachovává rozměr okna a po přechodu panel → přehled rozšíří iframe podle zprávy návrhu.

🧪 U obou variant: Nahrát → Ukončit a uložit → změna názvu na fiktivní „Zkouška návrhu“ → Nechat na Macu. Výsledek výslovně uvádí, že se neodeslalo. Zkusit znovu přepne síťovou chybu na ukázkové odesílání; odeslaná položka v A nabízí samostatné ověření. Souborové akce pro Návrh webu otevřou potvrzení s konkrétním názvem a rozměrem; Zrušit/Ponechat ponechá položku v seznamu.

🧪 Finální B: ve scénáři chybějící firmy jsou v selectu skutečně Studio Sever i Ateliér Jih. Výběr a Uložit firmu ukáže „Žádná nahrávka se tím neodeslala“. Až Enter na Uložit a odeslat přepne nahrávku do fronty a rozšíří okno. Toto konkrétní klávesové potvrzení v CUA prošlo; neověřuje celé pořadí Tab ani VoiceOver.

🧪 node --check pro oba app.js a společné compare.js/focus.js: doslovný výstup a exit kódy v syntax-root.txt.

## Autorské důkazy a opravné kolo

Astra předala matici 10 scénářů × 3 témata a 67 PASS, následně cílenou kontrolu výběru obou firem a automatiky pouze nové položky (23 PASS). Připojený Enter smoke v nástroji Orcy nedoručil keydown a skončil FAIL; původní výpis se zachoval beze změny. Koordinátor prokázal výše uvedenou Enter cestu jiným browserovým nástrojem. Přesný rozsah je v astra/verification.txt, verification-focused.txt a keyboard-tool-diagnostic.txt.

Opus předal deset scénářů a tři témata; po nalezené chybě aktualizace absolvoval omezenou korekci ve stejném terminálu. updates-review.txt obsahuje 12/12 PASS a EXIT=0 pro čekání aktualizace na nahrávání, uložení a časovač i cestu Nastavení → kontrola → nabídka. Sabotáž s původní verzí obě vady reprodukovala. Autorské důkazy jsou uchované v opus/.

⚠️ Dodatečný hromadný průchod koordinátora pomocí uloženého iframe locatoru se nedokončil kvůli timeoutu locatoru po navigaci. Za úspěšný jej nepočítáme. Čitelné DOM/snímky a konkrétní interakce výše proběhly; finální opravu firem koordinátor ověřil přes čerstvý samostatný náhled a accessibility API.

## Co tím prokázané není

⛔ Živé audio, skutečný upload, přihlášení, přepis, chování Docku/menu baru, nativní titulková lišta, VoiceOver a notarizovaný build s novým designem. Toto je návrh, nikoli změna nainstalované aplikace.

🟡 Výběr vzhledu čeká na Dana. LuTrack je samostatný budoucí návrh pracovního toku; žádný serverový time sync se tímto během nezprovoznil. Fonty Brockmann jsou pouze lokální náhledové podklady a necommitují se. Open-source Public Sans má přiloženou OFL licenci.
