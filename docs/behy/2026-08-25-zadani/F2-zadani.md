# Opravné kolo F2 — zbytek nálezů z review (kolo 2 ze 3)

Worktree: **`/Users/dan/orca/workspaces/ludone-desktop/f2-opravy`**, větev `orca/f2-opravy`.
Společná pravidla: **přečti si `_spolecne.md` ve stejném adresáři jako tohle zadání.**

## Co se děje
Kolo F1 opravilo sedm nálezů. Tohle kolo bere **zbytek, který je mechanický
a bezpečnostní**. Architektonické nálezy a ty, které potřebují skutečný Mac, se **neopravují**
— jdou Danovi (nejsou v tomhle zadání, neřeš je).

🔴 **Opravuješ VADU, ne MĚŘIDLO.** A **každý nález nejdřív ověř v kódu** — reviewer se mýlí.
Když se nález nepotvrdí, **neopravuj nic** a zapiš to do `notes` a do `nepotvrzenychNalezu`.

## Soubory, které VLASTNÍŠ
```
electron/main.cjs   electron/auth.cjs
tests/pkce.test.js  tests/oauth-state.test.js  tests/permissions.test.js
tests/ipc-sender-guard.test.js
scripts/akceptace/E3.sh  scripts/akceptace/E6.sh  scripts/akceptace/E7.sh
```
NESMÍŠ MĚNIT: `src/**` · `electron/queue.cjs` · `scripts/package-mac.mjs`
· `src/components/Onboarding.jsx` · ostatní brány a testy
· `docs/**` `specs/**` `dukazy/**` `design/**` `package.json` `.github/**`

---

## N8 — 🔴 Oprávnění na média nerozlišují, KDO o ně žádá

`electron/main.cjs`, `setPermissionCheckHandler` / `setPermissionRequestHandler`
(hledej je, čísla řádků se posunula po F1).

Reviewer tvrdí dvě věci — **ověř obě**:
1. handlery **nerozlišují panel od okna nastavení** ani hlavní rám od stejnoadresového
   podrámu ⇒ okno nastavení může získat mikrofon nebo desktop capture, i když nemá;
2. obecné oprávnění `media` **nekontroluje požadované `mediaTypes`** ⇒ žádost o video
   projde stejně jako o zvuk.

**Oprava:** použij stejné rozlišení odesílatele, jaké F1 zavedlo pro IPC
(`trustedSenderKind` / `requireTrustedSender` a seznam povolených „kinds"). Oprávnění na
mikrofon a `display-capture` má dostat **jen panel**, ne nastavení. U `media` ověř
`mediaTypes` a povol jen to, co aplikace opravdu potřebuje.
🔴 Přidej test do `tests/ipc-sender-guard.test.js` (nebo nový popisný blok tamtéž), který
ověří, že **žádost z okna nastavení o mikrofon je odmítnuta**.

## N9 — `ludone://app` přijímá libovolnou cestu

`isTrustedAppUrl`: pro `protocol === "ludone:" && hostname === "app"` vrací `true`
**bez ohledu na cestu**, kdežto u `file:` porovnává přesně s `dist/index.html`.
⇒ Jakýkoli budoucí obsah na tom protokolu se automaticky stane důvěryhodným původem.

**Oprava:** i u `ludone://app` vyžaduj **jediný očekávaný dokument** (stejná přísnost jako
u `file:`). Doplň test, že `ludone://app/neco-jineho` je **odmítnuto**.

## N10 — Mapper typů oprávnění není sám fail-closed

Mapper podporovaných typů oprávnění je obyčejný objekt, takže **zděděné klíče**
(`constructor`, `toString`, `__proto__`) se chovají jako podporovaný typ.

**Oprava:** použij `Object.create(null)`, `Map`, nebo `Object.hasOwn` při čtení.
Doplň test, že `"constructor"` a `"__proto__"` jsou **nepodporované** a končí NEuděleno.

## N11 — Test `state` připustí konstantní hodnotu

`tests/oauth-state.test.js`: test generování `state` projde i tehdy, kdyby funkce vracela
**pořád stejný** 43znakový řetězec. Pak by ale `state` nevázal odpověď na zahájený tok
a celá obrana proti podvržení by byla k ničemu — a měřidlo by zůstalo zelené.

**Oprava:** doplň test, že **N po sobě vygenerovaných `state` je N různých** (např. 50)
a že mají dost entropie. 🔴 Ověř, že test opravdu kouše: dočasně nech funkci vracet
konstantu, spusť (**musí spadnout**), vrať zpět. Doslovný výpis obou běhů do `dukaz`.

## N12 — Test PKCE neprokáže využití celé náhodnosti

`tests/pkce.test.js`: mutant, který zopakuje **jediný náhodný bajt** 32×, splní současné
aserce (délka, abeceda, rozdílnost dvou verifierů), a přitom má jen 8 bitů entropie.

**Oprava:** doplň test, který ukáže, že se využívají **všechny** dodané náhodné bajty —
například tak, že změna **kteréhokoli** bajtu vstupu změní výsledný `code_verifier`.
🔴 Znovu: dočasně nasaď mutanta „opakuj první bajt", ověř, že test **spadne**, vrať zpět,
a oba výpisy dej do `dukaz`.

## N13 — Úložiště tokenu může skončit v pracovním stromě

`electron/auth.cjs` ukládá token do `app.getPath('userData')`. V tomhle repu ale existuje
mechanismus `LUDONE_DATA_DIR`, který `userData` přesměrovává do `.runtime/` **uvnitř
pracovního stromu**. Při vývojovém běhu by tedy credential blob ležel vedle kódu.
`.gitignore` ho ochrání před commitem, ale ne před archivací worktree nebo diagnostickou kopií.

**Oprava:** ověř, kam se ukládá, a zajisti, že tokeny **nikdy neskončí uvnitř repozitáře**
— buď je ukládej mimo pracovní strom, nebo při přesměrovaném `userData` odmítni token uložit
na disk a řekni proč. Do `notes` napiš, kterou variantu jsi zvolil a proč.

---

## Jak to otestuješ
```bash
npm run gates > /tmp/f2-g.out 2>&1; echo "GATES EXIT=$?"; tail -20 /tmp/f2-g.out
npm run package:mac > /tmp/f2-p.out 2>&1; echo "PACKAGE EXIT=$?"
for g in E3 E6 E7; do bash scripts/akceptace/$g.sh > /tmp/f2-$g.out 2>&1; echo "$g EXIT=$?"; done
```
🔴 Vlastní názvy dočasných souborů (`/tmp/f2-*`).

## Důkaz hotovosti
`npm run gates` = 0 · `npm run package:mac` = 0 · brány E3, E6, E7 = 0 ·
a u **N11 i N12** doslovný RED (s mutantem) i GREEN (po vrácení) výpis.

## Output contract
```json
{
  "summary": "<co jsi opravil>",
  "premisaPlatila": true,
  "ocekavanePocty": {
    "opravenychNalezu": 0,
    "nepotvrzenychNalezu": 0,
    "novychTestu": 0,
    "celkemTestuVeSpustenychSouborech": 0,
    "tokenuUvnitrRepozitare": 0,
    "zmenenychSouboruMimoVlastnictvi": 0
  },
  "dukaz": "<DOSLOVNÝ výpis vč. RED/GREEN u N11 a N12>",
  "commitMessage": "<anglicky, imperativ>",
  "notes": ["<co se NEpotvrdilo a proč>", "<volba u N13>"]
}
```
🔴 `tokenuUvnitrRepozitare` a `zmenenychSouboruMimoVlastnictvi` = **0**.
