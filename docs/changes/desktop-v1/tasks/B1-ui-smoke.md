# Task packet B1 — `ui-smoke` musí zčervenat, když se panel neotevře

**Feature ID:** `DSK-F006` (oprávnění mikrofon a systémový zvuk + zkouška)
**Nadřazené:** [`../plan.md`](../plan.md) §2b · [`../spec.md`](../spec.md) §3 · [`../BEH-NOC.md`](../BEH-NOC.md)
**Vykonavatel:** Codex `gpt-5.6-sol` · **Worktree:** `~/orca/workspaces/ludone-desktop/desktop-b1`
**Napsal:** noční orchestrátor 1. 9. 2026 22:08, protože packet neexistoval a práce má přednost před formulářem.

---

## Proč to děláme

`scripts/ui-smoke.mjs` je **jediné měřidlo, které vidí, že se panel opravdu otevře**. CI ho
z principu nespustí (`if: ${{ false }}` — potřebuje GUI a oprávnění, která runner nemá komu
potvrdit). Dnes je červený, a proto `scripts/akceptace/E2-sabotaze.sh` **zastavil na sabotáži (b)**
s hláškou „nedotčená brána není zelená". Sabotáže (b) i (c) tedy **nikdy neproběhly** a chování
zvukové brány je nedoložené.

**Není to výkop, je to srovnání textů.** Příčina je známá na řádek.

## Premisa — ověř ji, čísla ber jako orientační

Tvrzení, ze kterých zadání vychází (změřeno 1. 9. 2026, ale do stromu píše víc rukou — **když
naměříš jiné, řiď se MĚŘENÍM a rozdíl vypiš do `premisaPoznamka`**):

1. `scripts/ui-smoke.mjs` kolem řádku **301** klikne na tlačítko **„Povolit"**.
2. `grep -rn "Povolit" src/` vrací **nula shod** — po etapě E6 to tlačítko neexistuje.
3. Smyčka kolem řádku **300** čeká **tři** oprávnění, zatímco onboarding má **dvě**.
4. Popisky tlačítek v `src/components/Onboarding.jsx` (kolem ř. 202–211) jsou **stavově
   proměnlivé**: „Povoleno" / „Otevřít Nastavení" / „Omezeno systémem" / „Znovu ověřit" / „Požádat".

🔴 **Bod 4 je jádro věci:** test se nesmí chytat textu, který se mění. Proto `data-testid`.

## Co udělat

1. **Projdi CELÝ `ui-smoke.mjs`** a každý selektor i hledaný text ověř proti skutečným komponentám
   v `src/`. Nejen ten jeden řádek — rozešlo se toho víc. Vypiš do `notes`, co všechno nesedělo.
2. **Dej tlačítkům v `Onboarding.jsx` stabilní `data-testid`.** Jen ten atribut, nic jiného.
3. **Srovnej počet očekávaných oprávnění se skutečností.**
4. Test přepiš tak, aby se chytal `data-testid`, ne popisku.

## Vlastnictví — VÝČET, ne próza

**SMÍŠ MĚNIT pouze:**
- `scripts/ui-smoke.mjs` — celý soubor
- `src/components/Onboarding.jsx` — **výhradně přidání atributů `data-testid`**. Žádná změna
  logiky, textů, stavů ani struktury JSX nad rámec toho atributu.
- `tests/**` — nové testovací soubory k tomuhle úkolu

**NESMÍŠ SE DOTKNOUT:** `electron/**` · `src/**` mimo `Onboarding.jsx` · `docs/**` ·
`design/**` · `scripts/**` mimo `ui-smoke.mjs` · `.github/**` · `package.json`

## 🔴 `ui-smoke` NESPOUŠTĚJ

Potřebuje GUI, skutečné okno a ostře udělená oprávnění. **V sandboxu neběží a pokus o jeho
spuštění je porušení zadání.** Doloží ho **staticky**:

```bash
# každý data-testid, na který se test chytá, MUSÍ existovat v komponentě
grep -o 'data-testid="[^"]*"' scripts/ui-smoke.mjs | sort -u
grep -o 'data-testid="[^"]*"' src/components/Onboarding.jsx | sort -u
# a ty dvě množiny se musí protnout — vypiš obě do notes
```

Do `notes` napiš **přesný příkaz**, kterým to má člověk spustit naostro.

## Sabotáže — poměr 3 červené : 1 zelená

Sabotáže **nespouštíš ty** (v sandboxu po sobě neumíš uklidit — `git checkout` ti spadne na
`Operation not permitted`). **Vypiš je do `notes` jako recept** a spustí je orchestrátor.

**MUSÍ ZČERVENAT:**
- (a) v `Onboarding.jsx` odeber jeden `data-testid`, na který se test chytá
- (b) v `ui-smoke.mjs` změň očekávaný počet oprávnění o jedna
- (c) v `Onboarding.jsx` znemožni otevření panelu (např. tlačítko `disabled`)

**MUSÍ ZŮSTAT ZELENÉ:**
- (d) změň **popisek** tlačítka (třeba „Požádat" → „Požádat o přístup") a nech `data-testid`
  být. Tohle je smysl celé opravy: test se textu držet nesmí. Kdyby (d) zčervenala, udělal
  jsi přesně to, čemu se máme vyhnout.

## Mantinely

- 🔴 **NEDĚLEJ ŽÁDNOU git operaci** — `git add`, `commit`, `fetch`, `merge`, `checkout` ti
  v sandboxu spadnou na `Operation not permitted`, protože index leží mimo pracovní strom.
  Commituje orchestrátor. Ty edituj **jen soubory**.
- **Žádný příkaz nesmí čekat na vstup.** `export GIT_PAGER=cat PAGER=cat`, `git --no-pager`.
- **Výjimku z brány si NEPŘIDÁVEJ** (`skip`, `*-exempt`, baseline, oslabení testu). Když si
  myslíš, že je namístě, napiš do `notes` kterou a proč — rozhodne orchestrátor.
- **Neoslabuj existující testy.** Baseline je 77 zelených v 9 souborech.
- Brány si spusť sám: `npm run lint`, `npm run typecheck`, `npm run test:unit`.
  **Exit kód měř PŘED rourou** (`cmd > /tmp/out 2>&1; echo $?`), ne za `| tail`.
- Když si zadání odporuje se stavem repa, **NEŘEŠ to domyšlením** — udělej nejmenší bezpečnou
  variantu a rozpor zapiš do `notes`.

## Pořadí práce

🔴 **Nejdřív soubory na disk, pak testy, teprve pak odpověď.** JSON je hlášení o práci, která
už na disku JE — ne plán. Před odpovědí spusť `git --no-pager status --porcelain` a ověř, že
tam ty soubory opravdu jsou. Když tam nejsou, **nejsi hotový a nesmíš odpovídat**.

## Output contract

```json
{
  "summary": "<3 věty>",
  "premisaPlatila": true,
  "premisaPoznamka": "<které ze čtyř tvrzení nesedělo a jak>",
  "ocekavanePocty": {
    "novychTestu": 0,
    "celkemTestuVeSpustenychSouborech": 0,
    "oslabenychTestu": 0,
    "pridanychVyjimekZBran": 0,
    "zmenenychSouboruMimoVlastnictvi": 0
  },
  "selektory": {
    "vUiSmoke": ["<data-testid>"],
    "vOnboarding": ["<data-testid>"],
    "chybejici": []
  },
  "sabotazeRecept": [
    {"id": "a", "ocekavani": "cervena", "jak": "<přesný příkaz nebo edit>"},
    {"id": "b", "ocekavani": "cervena", "jak": "..."},
    {"id": "c", "ocekavani": "cervena", "jak": "..."},
    {"id": "d", "ocekavani": "ZELENA", "jak": "..."}
  ],
  "prikazProCloveka": "<jak se ui-smoke spouští naostro>",
  "commitMessage": "<anglicky, imperativ, bez tečky>",
  "notes": "<co nesedělo, co jsi nemohl ověřit, co má orchestrátor přeměřit>"
}
```

🔴 `oslabenychTestu`, `pridanychVyjimekZBran` a `zmenenychSouboruMimoVlastnictvi` **musí být nula**.
🔴 `chybejici` **musí být prázdné pole** — jinak se test chytá selektoru, který v komponentě není.
