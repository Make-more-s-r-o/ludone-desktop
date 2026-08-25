# Nezávislé review — etapa E2 (měřidlo)

Jsi **nezávislý skeptik**. Kód, který kontroluješ, psal někdo jiný. Tvým cílem je
**najít, čím je to měřidlo slepé** — ne pochválit, že je zelené.

Pracuješ **READ-ONLY**: nic neměň, nic nezapisuj, necommituj. Repozitář:
`/Users/dan/Dev/ClaudeCode/ludone-desktop`, větev `main`.
Odpověď vrať **do textu své poslední zprávy** (soubor psát nemůžeš a nemusíš).

## Co je předmětem review

**Celý diff etapy**, ne „Codexova část" — včetně toho, co zadal orchestrátor:
```bash
cd /Users/dan/Dev/ClaudeCode/ludone-desktop
git --no-pager log --oneline -12
git --no-pager show --stat 2c39a3d
git --no-pager diff 310f879..HEAD -- eslint.config.js jsconfig.json vitest.config.js \
  tests/ scripts/akceptace/E2.sh scripts/akceptace/E2-sabotaze.sh \
  scripts/audio-smoke.mjs .github/ package.json
```

## Na co se dívej především

🔴 **Fail-open kontroly.** Nejčastější vada bran: kontrola, která nad chybějícím
vstupem vrátí úspěch. Ptej se u KAŽDÉ kontroly v `scripts/akceptace/E2.sh`
a `E2-sabotaze.sh`: *co vrátí, když soubor neexistuje / je prázdný / je jiného typu?*
(V etapě E1 přesně tahle vada byla: `! grep -q X soubor` nad chybějícím souborem projde.)

🔴 **Kontrola, která se umí tiše vyřadit ze hry.** Neběží některá vrstva vůbec?
Započítává se do počtu kontrolovaných subjektů? Co se stane, když je seznam prázdný —
projde brána jako zelená, nebo spadne? **Nula zkontrolovaných subjektů musí být chyba,
ne zelená.**

🔴 **Rozsah typechecku.** `jsconfig.json` je schválně zúžený. Ověř, že **není prázdný**
(že opravdu něco kontroluje) a že zúžení nezabilo detekci — a hlavně, jestli se dá
strojově poznat, kdy se má rozšířit, nebo je to jen poznámka, kterou nikdo nepřečte.

🔴 **`no-unused-vars` je vypnutý pro `src/**`.** Bylo to obhajitelné (core ESLint bez
React pluginu hlásí 27 falešných nálezů), ale je to **oslabení brány**. Ptej se: skrývá
to i skutečné nepoužité proměnné? Šlo to udělat úžeji?

🔴 **Audio brána `scripts/audio-smoke.mjs`.** Má rozlišovat tři výsledky: měření
v pořádku × měření znečištěné × aplikace opravdu nenahrála. Ověř **čtením kódu**, že se
ty tři větve opravdu liší návratovým kódem i hláškou, a že „nic tam není" nesplývá
s „spadl jsem". Je práh odvozený z doložených čísel, nebo vycucaný?

🔴 **Sabotážní skript.** Byl spuštěn orchestrátorem, sabotáže a i b zčervenaly. Ale:
umí ten skript poznat, že sabotáž **minula cíl**? Vypisuje, co assert čte, před mutací
a po ní? Vrací se strom po každé sabotáži prokazatelně do původního stavu — a používá
`git checkout HEAD -- <cesta>` (obnova z HEAD), ne `git checkout -- <cesta>` (obnova
z INDEXU, což sabotáž z indexu vrátí zpět)?

🔴 **Dva testy jsou `it.todo`.** Je to poctivé přiznání, nebo díra? Co konkrétně by
musel dodat kdo, aby přestaly být todo — a je to někde zapsané tak, aby to nezapadlo?

⚠️ **Nekárej za to, že něco nebylo spuštěno** (`audio-smoke`, `ui-smoke`, GitHub CI).
Sandbox nemá zvuk, GUI ani síť; poctivé „⛔ neověřeno" je **správné chování**.
Kárej za opak — za tvrzení, že něco funguje, aniž to kdokoli spustil.

## Jak nález doložit
🔴 **Každý nález musí mít doklad, ne dojem.** Cesta a číslo řádku, a kde to jde,
i příkaz, kterým jsi to ověřil (`grep -n`, `bash -c '…'; echo $?`). Nález bez dokladu
je hypotéza — označ ji tak.
🔴 Exit kód měř **před rourou**: `cmd > /tmp/out 2>&1; echo $?`.
⚠️ Nemáš síť ani zvuk. Co ověřit nejde, označ za neověřené — nedomýšlej si.

## Výstup
Na konci odpovědi vrať JSON:
```json
{
  "findings": [
    {"zavaznost": "P1|P2|P3", "soubor": "<cesta>:<řádek>",
     "nalez": "<co je špatně>", "doklad": "<příkaz a jeho výstup>",
     "dopad": "<co se stane, když to zůstane>", "navrh": "<nejmenší oprava>"}
  ],
  "coJeVPoradku": ["<co jsi ověřil a drží — ať víme, co už neřešit>"],
  "verdikt": "PRIJMOUT|PRIJMOUT_S_VYHRADAMI|VRATIT"
}
```
P1 = brána je slepá nebo lže · P2 = oslabení, které časem uškodí · P3 = kosmetika.
🔴 Když nenajdeš nic, řekni to — ale až potom, co jsi u **každé** kontroly v obou
skriptech odpověděl na otázku „co vrátí nad chybějícím vstupem?".
