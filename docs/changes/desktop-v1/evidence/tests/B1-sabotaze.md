# B1 — sabotážní kolo, měřeno diferenciálně

**Spustil orchestrátor** 1. 9. 2026 ve 22:30–22:40 na skutečném Macu. Ne Codex — ten
v sandboxu po sobě neumí uklidit (`git checkout` mu spadne na `Operation not permitted`),
takže by nechal mutaci ve stromě a další sabotáž by měřila kontaminovaný strom.

## Proč diferenciálně, a ne „červená / zelená"

🔴 **`ui-smoke` dnes do zelené dojet NEMŮŽE, a není to vada B1.** Aplikaci chybí systémové
oprávnění **Nahrávání obrazovky**, takže běh vždycky skončí na `ui-smoke.mjs:364` hláškou
`systémový zvuk: Permission denied`. Změřeno dvakrát nezávisle — ve worktree i v hlavním
checkoutu, obojí s `package:mac` EXIT=0 a nastartovanou aplikací. Uděluje se to klikem
v Nastavení, takže to za člověka nikdo neudělá.

Sabotážní skript to poznal sám: **odmítl měřit nad červeným baseline a nic neuklidil** —
tak, jak má. Kdyby zálohoval „původní stav", zálohoval by stav se sabotáží.

Měřidlo je proto **posun místa selhání**: sabotáž musí shodit test **dřív** a **jinou
hláškou** než reference. Kontrola, která kouše, se ozve dřív než blokátor za ní.

## Výsledek — 3 červené : 1 zelená

| sabotáž | očekávání | místo pádu | doslovná hláška | verdikt |
|---|---|---|---|---|
| *reference* | — | `:364` | `Timeout: text „Obě stopy ověřeny"` | blokátor oprávnění |
| **a** `data-testid` → `permission-SABOTAZ_A` | dřívější pád | **`:346`** | `Selektor [data-testid="permission-action"]: čekám 2 prvků, nalezeno 0.` | ✅ |
| **b** `EXPECTED_PERMISSION_COUNT` 2 → 3 | dřívější pád | **`:346`** | `Selektor [data-testid="permission-action"]: čekám 3 prvků, nalezeno 2.` | ✅ |
| **c** `is-granted` → `is-granted-SABOTAZ_C` | dřívější pád | **`:351`** | `Oprávnění nejsou všechna udělená: {"count":2,"granted":0,"disabled":2}.` | ✅ |
| **d** popisek `"Požádat"` → `"Požádat o přístup SABOTAZ_D"` | **beze změny** | `:364` | shodná s referencí | ✅ |

**U každé sabotáže byl spuštěn kanárek** `grep -c` na vložený řetězec a všechny vrátily
**1 výskyt** — mutace tedy prokazatelně dopadly. Nula by znamenala prázdný běh, ze kterého
se o bráně nedozvíš nic.

## 🔴 Co dokazuje sabotáž (c)

Je to důkaz vady, kterou našlo Claude review v Codexově první verzi. Ta kontrola se ptala
`disabled === 2`. Sabotáž (c) vyrobila přesně stav `{"count":2, "granted":0, "disabled":2}`
— **dvě mrtvá tlačítka, nula udělených oprávnění**.

Původní kontrola by tenhle stav prohlásila za **zelený**. Tlačítko je totiž `disabled`
i tehdy, když systém oprávnění **odepře** (`Onboarding.jsx:206`:
`disabled={state.granted || state.disabled || permissionBusy === permission.id}`), takže
brána měřila sjednocení úspěchu se selháním.

Opravená kontrola se ptá na `.permission-row.is-granted`, což visí jen na `state.granted`
(`Onboarding.jsx:193`). Commit `0140911`.

## Co sabotáž (d) hlídá

Že se test **nechytá textu**. Popisky tlačítek se mění se stavem („Povoleno" / „Otevřít
Nastavení" / „Omezeno systémem" / „Znovu ověřit" / „Požádat"), a přesně na tom se `ui-smoke`
rozbil původně. Kdyby (d) zčervenala, byla by oprava jen přesunutím téže křehkosti jinam.

## Co tohle kolo NEDOKAZUJE

- ⛔ **Že `ui-smoke` projde.** Neprojde, dokud nebude udělené oprávnění Nahrávání obrazovky.
- ⛔ **Chování zvukové brány.** Sabotáže (b) a (c) ze `scripts/akceptace/E2-sabotaze.sh`
  pořád nedoběhly — čekají na tutéž zelenou. To byla druhá půlka zadání B1 a **zůstává
  nesplněná**, blokovaná na člověku.
- ⚠️ Měřeno v režimu `LUDONE_E2E=1` s resetem onboardingu, ne v běžném spuštění.
