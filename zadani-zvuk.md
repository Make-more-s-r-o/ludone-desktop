# Zadání A: dokázat, že zachycení zvuku v Electronu funguje

Tohle je **pokus, ne produkt**. Cílem není hezká aplikace, ale jednoznačná odpověď na otázku,
na které stojí celý projekt: **umí Electron na tomhle Macu zachytit systémový zvuk a mikrofon
jako dvě oddělené stopy?**

## POSTUP — závazné pořadí

1. Ověř `pwd` = `/Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/zvuk`. Cesty jsou absolutní schválně.
2. Založ projekt a napiš kód **na disk**.
3. Spusť ho a **skutečně nahraj zvuk**. Ne „mělo by to fungovat" — spusť to.
4. Ověř výsledek: existují soubory, mají nenulovou délku, jde je přehrát.
5. Zapiš `NALEZ.md` s tím, co se stalo — včetně toho, když to nefunguje.
6. `git --no-pager status --porcelain` a commitni (necommituj do `main`, jsi na větvi `feat/zvuk-dukaz`).
7. Teprve pak odpověz JSON.

**JSON je hlášení o práci, která už na disku je.** Když jsi nespustil nahrávání, nejsi hotový.

## 🔴 ZÁKAZ ZVYŠOVÁNÍ PRÁV

Nic v tomhle projektu nepotřebuje heslo správce ani `sudo`. Když na to narazíš:

- **NEPOKOUŠEJ SE o to.** Žádné `sudo`, žádné `osascript ... with administrator privileges`,
  žádná instalace systémových komponent, žádná změna systémového nastavení.
- **Zapiš do `notes`, na čem jsi narazil, a pokračuj jinou cestou** nebo ten krok vynech.
- Totéž platí pro dialogy klíčenky: nepokoušej se o podpis, který vyžaduje heslo uživatele.

Důvod: majiteli 21. 8. vyskočil dialog žádající heslo správce a on ho (správně) odmítl. Nikdo
nevěděl, odkud je. Cokoli, co si o taková práva řekne, zastaví práci a vyvolá nedůvěru.

## MANTINELY

- `GIT_PAGER=cat`, `PAGER=cat`, `git --no-pager`. Nic interaktivního — žádný příkaz nesmí čekat na vstup.
- **Do `/tmp` nesmíš.** Pracuj ve svém worktree.
- **SMÍŠ MĚNIT jen obsah svého worktree.** Sousední worktree `kostra` je cizí, nesahej na něj.
- Máš síť (běžíš s povoleným přístupem), takže `npm install` funguje. Ale **instaluj co nejmíň** —
  disk má okolo 16 GB volných a Electron je velký. Žádné zbytečné závislosti.
- Commituj, nepushuj. Malé commity průběžně, ne jeden na konci.

## CO POSTAVIT

Nejmenší možná Electron aplikace:

- `package.json`, hlavní proces, jedno okno s jedním tlačítkem „Nahrát 10 sekund".
- Po stisku nahraje **deset sekund** a uloží **dva soubory** do `./nahravky/`:
  `mikrofon.webm` a `system.webm`.
- Vypíše do okna i do konzole, co se povedlo a co ne.

### Jak na systémový zvuk — tohle je jádro pokusu

Zjištění, ze kterého vycházíme (ověřeno ve zdrojácích Chromia, ale **v Electronu neověřeno** —
právě to máš dokázat):

- Chromium má od verze 141 na macOS zapnuté zachycení systémového zvuku přes Core Audio process tap
  (`media/audio/mac/catap_audio_input_stream.h`, `API_AVAILABLE(macos(14.2))`,
  `kMacCatapLoopbackAudioForScreenShare` je `FEATURE_ENABLED_BY_DEFAULT`).
- V Electronu se k němu jde dostat přes `session.setDisplayMediaRequestHandler` a v něm vrátit
  `{video: …, audio: 'loopback'}`, pak v okně zavolat `navigator.mediaDevices.getDisplayMedia()`.
- 🔴 **Dokumentace Electronu ale tvrdí, že loopback je jen na Windows.** Proto ten pokus.
  Když to nejde takhle, zkus i `audio: 'loopbackWithMute'` a zkus zjistit, jestli to chce nějaký
  přepínač (`--enable-features=...`). Vyzkoušej nejvýš tři cesty a každou zapiš.
- Mikrofon je běžné `navigator.mediaDevices.getUserMedia({audio: true})`.
- Obojí ukládej **odděleně**, každý svým `MediaRecorder`. Nemíchej je do jedné stopy —
  oddělenost je to, co má pokus dokázat.

Použij aktuální Electron (běžíš 20. 8. 2026, tak si zjisti, co je aktuální). Uveď verzi v nálezu.

## CO ZMĚŘIT A ZAPSAT DO `NALEZ.md`

Piš to jako zápis z pokusu, česky, bez příkras:

1. **Funguje systémový zvuk? ANO / NE**, a kterou cestou. Když ne, co přesně selhalo (chybová hláška).
2. Verze Electronu a Chromia (`process.versions`), verze macOS.
3. **Jaké oprávnění si systém vyžádal** — mikrofon, záznam obrazovky, systémový zvuk? Vypiš dialogy,
   které se objevily. Tohle je důležité: jestli si to řekne o „Záznam obrazovky", je to pro nás horší
   zpráva, než když si řekne o „Systémový zvuk".
4. Velikost obou souborů a jestli v nich je slyšet zvuk (velikost nad pár kilobajtů = něco tam je;
   napiš, jestli jsi to ověřil jinak).
5. Kolik zabírá `node_modules` a jak dlouho trvalo první sestavení.
6. **Co bylo jinak, než zadání předpokládalo.** Cokoli.

🔴 **Když to nefunguje, je to platný a cenný výsledek.** Nepředstírej úspěch, nezkoušej to obejít
mimo tři popsané cesty, a hlavně: nezapisuj do nálezu domněnku jako měření. Zapiš, co jsi viděl.

## OUTPUT CONTRACT

```json
{
  "summary": "3-5 vět: co jsi zkusil a jak to dopadlo",
  "systemovyZvukFunguje": true,
  "kterouCestou": "setDisplayMediaRequestHandler s audio loopback | jinak | nefunguje",
  "vyzadanaOpravneni": ["seznam dialogů, které se objevily"],
  "verzeElectron": "",
  "verzeChromium": "",
  "verzeMacOS": "",
  "ocekavanePocty": {
    "vytvorenychSouboru": 0,
    "velikostMikrofonBajtu": 0,
    "velikostSystemBajtu": 0,
    "poctCommitu": 0,
    "zmenenychSouboruMimoWorktree": 0
  },
  "spustilJsemToOpravdu": true,
  "prekvapeni": ["co bylo jinak, než zadání čekalo"],
  "notes": ["cokoli dalšího"]
}
```

`velikostSystemBajtu` větší než nula znamená, že systémový zvuk opravdu tekl.
`zmenenychSouboruMimoWorktree` musí být 0. `spustilJsemToOpravdu` napiš `true` jen tehdy,
když jsi aplikaci skutečně spustil a klikl na tlačítko.
