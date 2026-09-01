# Task packet B4 — tři vady přihlášení

**Feature ID:** `DSK-F003` (přihlášení OAuth 2.1 + PKCE, loopback)
**Nadřazené:** [`../plan.md`](../plan.md) §2b · [`../spec.md`](../spec.md) §3 · [`../BEH-NOC.md`](../BEH-NOC.md)
**Vykonavatel:** Codex `gpt-5.6-sol` · **Worktree:** `~/orca/workspaces/ludone-desktop/desktop-b4`
**Napsal:** noční orchestrátor 1. 9. 2026 22:10.

---

## Premisa — ZMĚŘENA ORCHESTRÁTOREM, ne opsána

Všechny tři vady jsou ověřené naostro 1. 9. 2026 ve 22:09. **Čísla řádků ber jako orientační**
(do stromu píše víc rukou) — když naměříš jiná, **řiď se MĚŘENÍM** a rozdíl vypiš do
`premisaPoznamka`.

| # | Pozorování (změřené) | Závěr (smíš ho zpochybnit) |
|---|---|---|
| a | `electron/auth.cjs:9` → `DEFAULT_TIMEOUT_MS = 5 * 60 * 1000`. Server: `ludone-app/src/mcp/oauth/authorize.ts:23` → `PENDING_TTL_MS = 10 * 60 * 1000` | Desktop přestane naslouchat dřív, než serveru vyprší žádost |
| b | `electron/main.cjs:241` → `shouldHidePanelOnBlur({isTestRun, permissionPromptsInFlight, settingsVisible})`, výjimky jen na ř. 243–244 | Pro běžící přihlášení čítač chybí |
| c | `src/components/Onboarding.jsx:174` → `authBusy ? "Čekám na prohlížeč…" : "Přihlásit v prohlížeči"` | Čekání nemá konec, únik ani zobrazenou adresu |

## Co udělat

### (a) Srovnat časy — 5 min ↔ 10 min

Kdo se vrátí v sedmé minutě, dostane od prohlížeče „nelze se připojit" — a **na serveru mu
přitom vznikne souhlas, který nepatří k žádnému zařízení** a nejde spárovat. Duchové souhlasů.

Srovnej desktop na **10 minut plus rezerva**. Rezervu zvol tak, aby desktop naslouchal
prokazatelně **déle** než server drží žádost, a to zdůvodni v komentáři (proč, ne co).

### (b) Panel nesmí zmizet během přihlašování

**Vzor je hotový v commitu `04e87fc`**, který touž vadu opravil pro dialog oprávnění
(`permissionPromptsInFlight`). Udělej totéž pro přihlášení: vlastní čítač, inkrement při
zahájení, dekrement v `finally`, a výjimka v `shouldHidePanelOnBlur`.

🔴 **Čítač, ne boolean.** Boolean se rozbije při druhém souběžném pokusu; commit `04e87fc`
zvolil čítač schválně.

### (c) Čekání musí mít konec a únik — HLAVNÍ PROCES

🔴 **Viditelná půlka (odpočet, tlačítko Zrušit a adresa k zkopírování v panelu) NENÍ v rozsahu
B4** — zmrazený `plan.md` §2b dává B4 soubory `electron/auth.cjs` a `electron/main.cjs`, nikoli
`Onboarding.jsx`. Ten navíc paralelně vlastní story B1. Orchestrátor to zapsal do `DAN-TODO.md`
jako mezeru v plánu; ty ji **neřeš a nesahej na renderer**.

V rozsahu B4 je **strojová půlka**, celá v hlavním procesu:

1. Čekání **skončí samo** po vypršení (a nezůstane viset).
2. Jde ho **zrušit** — cesta, kterou renderer později zavolá.
3. Adresa k přihlášení je **dostupná** volajícímu (aby ji šlo zobrazit, když se okno otevře
   do pozadí nebo na druhou plochu).

## Vlastnictví — VÝČET, ne próza

**SMÍŠ MĚNIT pouze:**
- `electron/auth.cjs` — celý soubor
- `electron/main.cjs` — **výhradně** `shouldHidePanelOnBlur`, jeho čítače (okolí ř. 237–244),
  jeho volání (okolí ř. 330–333) a registrace IPC kanálů pro zrušení přihlášení
- `tests/**` — nové testovací soubory k tomuhle úkolu

**NESMÍŠ SE DOTKNOUT:** `src/**` (celý renderer, včetně `Onboarding.jsx` — vlastní ho B1) ·
`electron/**` mimo `auth.cjs` a vyjmenované bloky `main.cjs` · `electron/queue.cjs` ·
`scripts/**` · `docs/**` · `design/**` · `.github/**` · `package.json`

🔴 **`createAuthController` NEZAPOJUJ.** Je definovaná v `auth.cjs:325` a nikde se neimportuje —
to je **story B8, kterou drží Claude** (bezpečnostní cesta, masterplán §10). Tady se opravují
jen ty tři vady.

## Sabotáže — poměr 3 červené : 1 zelená

**Nespouštíš je ty** — v sandboxu po sobě neumíš uklidit (`git checkout` spadne na
`Operation not permitted`). **Vypiš je do `notes` jako recept**, spustí je orchestrátor.

**MUSÍ ZČERVENAT:**
- (a1) vrať `DEFAULT_TIMEOUT_MS` na 5 minut → test časů spadne
- (b1) odeber výjimku pro přihlášení ze `shouldHidePanelOnBlur` → test panelu spadne
- (c1) odeber ukončení čekání (nech běžet donekonečna) → test konce spadne

**MUSÍ ZŮSTAT ZELENÉ:**
- (d1) **`permissionPromptsInFlight` nech beze změny a ověř, že jeho test dál prochází.**
  Tvoje změna se nesmí dotknout vady, kterou opravil `04e87fc`. Kdyby (d1) zčervenala,
  rozbil jsi cizí opravu.

🔴 **U časů sabotuj i CHYBĚJÍCÍ hodnotu, ne jen špatnou.** Když je timeout konfigurovatelný,
musí mít test i stav „hodnota není nastavená" — chybějící konfigurace je běžnější než špatná.

## Mantinely

- 🔴 **NEDĚLEJ ŽÁDNOU git operaci.** `git add`, `commit`, `fetch`, `merge`, `checkout` ti
  v sandboxu spadnou na `Operation not permitted` — index leží mimo pracovní strom.
  Commituje orchestrátor. Ty edituj **jen soubory**.
- **Žádný příkaz nesmí čekat na vstup.** `export GIT_PAGER=cat PAGER=cat`, `git --no-pager`.
- **Nečti ani nevypisuj secrets** — `.env*`, `*.key`, `*.pem`, `~/.ssh`. Ani do `notes`.
- **Výjimku z brány si NEPŘIDÁVEJ** (`skip`, `*-exempt`, baseline, oslabení testu). Napiš do
  `notes` kterou a proč; rozhodne orchestrátor.
- **Neoslabuj existující testy.** Baseline je 77 zelených v 9 souborech.
- Brány si spusť: `npm run lint`, `npm run typecheck`, `npm run test:unit`.
  **Exit kód měř PŘED rourou** (`cmd > /tmp/out 2>&1; echo $?`).
- Rozpor mezi zadáním a stavem repa **nedomýšlej** — nejmenší bezpečná varianta + zápis do `notes`.

## Pořadí práce

🔴 **Nejdřív soubory na disk, pak testy, teprve pak odpověď.** JSON je hlášení o práci, která
už na disku JE — ne plán. Před odpovědí spusť `git --no-pager status --porcelain` a ověř, že
tam ty soubory opravdu jsou. Když tam nejsou, **nejsi hotový a nesmíš odpovídat**.

**Testy piš napřed** a nech je spadnout ze správného důvodu — doslovný výpis červeného běhu
patří do `cerveneVypisy`. Není to formalita: PR bez něj se podle `plan.md` §3 nedá uzavřít.

## Output contract

```json
{
  "summary": "<3 věty>",
  "premisaPlatila": true,
  "premisaPoznamka": "<která ze tří pozorování nesedla a jak>",
  "ocekavanePocty": {
    "novychTestu": 0,
    "celkemTestuVeSpustenychSouborech": 0,
    "oslabenychTestu": 0,
    "pridanychVyjimekZBran": 0,
    "zmenenychSouboruMimoVlastnictvi": 0,
    "dotcenychRadkuVOnboardingJsx": 0
  },
  "cerveneVypisy": [
    {"vada": "a", "doslovnyVypis": "<co test vypsal, když byl červený>"},
    {"vada": "b", "doslovnyVypis": "..."},
    {"vada": "c", "doslovnyVypis": "..."}
  ],
  "sabotazeRecept": [
    {"id": "a1", "ocekavani": "cervena", "jak": "<přesný edit>"},
    {"id": "b1", "ocekavani": "cervena", "jak": "..."},
    {"id": "c1", "ocekavani": "cervena", "jak": "..."},
    {"id": "d1", "ocekavani": "ZELENA", "jak": "..."}
  ],
  "casy": {"desktopMs": 0, "serverMs": 600000, "rezervaMs": 0, "zduvodneni": "<proč tahle rezerva>"},
  "commitMessage": "<anglicky, imperativ, bez tečky>",
  "notes": "<rozpory, co jsi nemohl ověřit, co má orchestrátor přeměřit>"
}
```

🔴 `novychTestu` **musí být větší než nula** — tahle story přidává tři měřidla.
🔴 `oslabenychTestu`, `pridanychVyjimekZBran`, `zmenenychSouboruMimoVlastnictvi`
a `dotcenychRadkuVOnboardingJsx` **musí být nula**.
