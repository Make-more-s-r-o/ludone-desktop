# Zadání C: zapojit skutečné nahrávání do kostry

Kostra aplikace existuje, ale nahrávání v ní jen předstírá. Zachycení zvuku je od 21. 8. **ověřené
měřením**. Tvým úkolem je spojit obojí, aby aplikace opravdu nahrávala.

## POSTUP — závazné pořadí

1. Ověř `pwd` = `/Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/kostra`.
2. Přečti podklady (níž) — hlavně `NALEZ-OPAKOVANI.md` z větve `zvuk`, tam je ověřený postup.
3. Napiš kód **na disk**.
4. **Spusť aplikaci a opravdu nahraj** — ne „mělo by to fungovat“.
5. Ověř nahrávku měřením: ticho proti zvuku (viz „Jak ověřit“ níž).
6. Zapiš `NAHRAVANI.md`, commitni na větev `feat/kostra-appky`.
7. Teprve pak odpověz JSON.

## 🔴 ZÁKAZ ZVYŠOVÁNÍ PRÁV

Nic v tomhle projektu nepotřebuje heslo správce ani `sudo`. Když na to narazíš:

- **NEPOKOUŠEJ SE o to.** Žádné `sudo`, žádné `osascript ... with administrator privileges`,
  žádná instalace systémových komponent, žádná změna systémového nastavení.
- **Zapiš do `notes`, na čem jsi narazil, a pokračuj jinou cestou** nebo ten krok vynech.
- Totéž platí pro dialogy klíčenky: nepokoušej se o podpis, který vyžaduje heslo uživatele.

Důvod: majiteli 21. 8. vyskočil dialog žádající heslo správce a on ho (správně) odmítl. Nikdo
nevěděl, odkud je. Cokoli, co si o taková práva řekne, zastaví práci a vyvolá nedůvěru.

## MANTINELY

- `GIT_PAGER=cat`, `PAGER=cat`, `git --no-pager`. Nic interaktivního, nic čekajícího na vstup.
- Do `/tmp` nesmíš. **SMÍŠ MĚNIT jen worktree `kostra`.** Sousední `zvuk` je jen ke ČTENÍ.
- Máš síť, ale **neinstaluj nic nového**. Všechno potřebné v projektu je.
- Commituj průběžně, nepushuj.
- 🔴 **Nepředstírej úspěch.** Když se něco nepovede, zapiš to. Nedokončený pokus poctivě popsaný
  je cennější než hlášení, které neodpovídá disku.

## PODKLADY

| Kde | Co tam je |
|---|---|
| `../zvuk/NALEZ-OPAKOVANI.md` | **Ověřený postup**, jak zachytit systémový zvuk. Čti první |
| `../zvuk/test-loopback.js` | Funkční ukázka — přesně tenhle kód prokazatelně nahrál zvuk |
| `../zvuk/main.js`, `../zvuk/renderer.js` | Pokus se dvěma oddělenými stopami |
| `KOSTRA.md` | Tvůj vlastní popis kostry z minulého běhu |

## OVĚŘENÝ POSTUP (z měření 21. 8., ne z dokumentace)

V hlavním procesu:

```js
session.defaultSession.setDisplayMediaRequestHandler(async (req, cb) => {
  const src = await desktopCapturer.getSources({ types: ['screen'] })
  cb({ video: src[0], audio: 'loopback' })
}, { useSystemPicker: false })
```

V okně pak `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })` vrátí stopu
s názvem `System audio`. **Obrazový proud se musí vyžádat, ale okamžitě se zahodí a nikdy neukládá.**

Mikrofon je běžné `getUserMedia({ audio: true })`.

⚠️ **Zabezpečený kontext je podmínka.** Z `data:` URL je `navigator.mediaDevices` nedostupné —
stránka musí být načtená přes `loadFile` nebo z lokálního serveru Vite.

## CO POSTAVIT

1. **Dvě oddělené stopy.** Mikrofon a systémový zvuk každý svým `MediaRecorder`, dva soubory.
   Nemíchat — oddělenost je to, co dělá rozpoznání „já × oni“ spolehlivým.
2. **Zapojit na existující rozhraní kostry.** Tlačítko, které dosud předstíralo, ať opravdu nahrává.
   Běžící čas ať odpovídá skutečnosti. Zastavení ať uloží soubory.
3. **Kam se ukládá:** do složky uživatelských dat aplikace (`app.getPath('userData')`), podsložka
   `nahravky`, jméno podle času začátku. Do repozitáře nic nezapisuj.
4. 🔴 **Kontrola před nahráváním.** Než se začne nahrávat, ověř, že systém obě stopy opravdu dává,
   a když ne, řekni to člověku **předem** — ne až po schůzce. Tohle je nejdůležitější věc celého
   zadání: nahrávka, kde chybí druhá strana, se pozná pozdě a je k ničemu.
5. **Odolnost:** nahrávej po kouscích (`MediaRecorder` s `timeslice`), ať se při pádu neztratí vše.
   Když aplikace spadne uprostřed, ať zůstane, co bylo do té chvíle.

**Co NEDĚLAT:** odesílání na server, přepis, přihlášení, kalendář. Ty zůstávají předstírané.
Tenhle běh řeší **jen zvuk**.

## JAK OVĚŘIT — měřením, ne dojmem

Postup, který ověřil, že zvuk opravdu teče (proveden 21. 8.):

1. Nahraj 5 sekund **v tichu** a zapiš velikost obou souborů.
2. Nahraj 5 sekund, **zatímco hraje zvuk** (`afplay /System/Library/Sounds/Glass.aiff` třikrát
   na pozadí), a zapiš velikosti.
3. Systémová stopa musí být **výrazně větší** (v měření 996 B proti 43 339 B).

Obě čísla dej do `NAHRAVANI.md` i do odpovědi. **Bez tohohle porovnání nemáš důkaz** — prázdná
stopa vypadá stejně jako funkční.

## OUTPUT CONTRACT

```json
{
  "summary": "3-5 vět",
  "spustilJsemToOpravdu": true,
  "nahravaniFunguje": true,
  "mereni": {
    "tichoMikrofonBajtu": 0,
    "tichoSystemBajtu": 0,
    "seZvukemMikrofonBajtu": 0,
    "seZvukemSystemBajtu": 0
  },
  "kontrolaPredNahravanim": "jak jsi ověřil, že systém dává obě stopy",
  "ocekavanePocty": {
    "zmenenychSouboru": 0,
    "novychRadku": 0,
    "poctCommitu": 0,
    "zmenenychSouboruMimoWorktree": 0
  },
  "coZustavaPredstirane": ["seznam"],
  "notes": ["co bylo jinak, než zadání čekalo"]
}
```

`seZvukemSystemBajtu` musí být výrazně větší než `tichoSystemBajtu` — jinak nahrávání nefunguje,
ať contract tvrdí cokoli. `zmenenychSouboruMimoWorktree` musí být 0.
