# BĚH — dotažení desktopu (od 7. 9. 2026)

🔴 **Tenhle soubor je zadání. Konverzaci sežere compaction, tenhle soubor ne.**
Stav běhu je v `CHECKPOINT.md`, rozhodnutí v `decisions.md`, Danovy věci v `DAN-TODO.md`.

## Kde produkt stojí (změřeno 7. 9., ne odhad)

**14 ze 17 funkcí postaveno.** Chybí tři a **žádná z nich není na nás**:

| | co | proč |
|---|---|---|
| `F010` | odeslání na server | fáze 2, čeká na scope |
| `F012` | výběr projektu z alokací | fáze 2, money — UI existuje, ale seznam jsou **čtyři vymyšlené názvy natvrdo** v `TrackingCard.jsx:6–9` |
| `F014` | připomínky | **vědomě zrušeno**, BD-N43 |

✅ **A2 padlo 7. 9.** — Dan požádal o Apple Developer Program, čeká na schválení.

## Co tedy zbývá udělat

### ✅ Vlna 1 HOTOVA (#80, #81) - dvanact nalezu auditu

Audit #2 (`sol/ultra`, 63 stavů) našel 14 vad, dvě jsou opravené (#79). Zbylých dvanáct:

| záv. | kde | co |
|---|---|---|
| vysoká | `main.cjs:3304` | po vypršení tokenu panel dál hlásí „připojeno" — **rozhodnutí níž** |
| střední | `App.jsx:158` | poškozený `outgoing.json` ⇒ fronta se tiše skryje, počet spadne na nulu |
| střední | `QueueCard.jsx:80` | „nic se neztratilo" i u trvale selhané položky |
| střední | `audio-levels.js:405` | suspended AudioContext hlásí **nuly jako naměřené** |
| střední | `main.cjs:571` | lišta počítá čas dřív, než `MediaRecorder` začne |
| střední | `AuthErrorScreen.jsx:55` | neplatný origin se ukáže jako obecná chyba |
| střední | `auth.cjs:1319` | „Otevřít Nastavení" selže bez hlášky |
| nízká ×5 | Nastavení, test tónu, tray menu, Dock přepínač | selhání viditelné jen v konzoli |

🔴 **Vzor je pokaždé týž: něco selže a uživatel se to nedozví.** Oprava není „zobrazit chybu",
ale **rozlišit selhání od záměru** — viz čtvrtá příčina zelené v `codex-delegace-orchestrace`.

### Vlna 2 — co znamená „přihlášen" (rozhodl jsem sám, viz níž)

`hasStoredAuthSession` kontroluje jen vydavatele, `recordingUploadContext` navíc
`accessExpiresAt`. Dvě pojetí, uživatel vidí to optimistické.

### Vlna 3 — podepisování a notarizace, PŘIPRAVIT NASUCHO

Po schválení A2 má zbýt jen vložit certifikát. Připravit: konfiguraci `electron-builder`
pro podpis a notarizaci, entitlements (mikrofon, systémový zvuk), hardened runtime, cestu
pro `notarytool`, a **ověřit vše, co jde ověřit bez certifikátu**.
🔴 **Nežádat Dana o certifikát ani Team ID, dokud schválení nedorazí.**

### Vlna 4 — zvednout `verification` z `tests-green` na `verified-live`

Naostro jsou ověřené čtyři funkce ze čtrnácti. Recept na živé ověření bez zachyceného zvuku
je v `CHECKPOINT.md` (podstrčený syntetický proud, 440/880 Hz) — **používat ho**.
🔴 **Po každé zkoušce uklidit**: fronta i `nahravky/` zpět na základ, Danovy nahrávky nechat.

## Rozhodnutí, která jsem udělal SÁM (Dan řekl „dotáhni to")

**R1 — vypršelý token = odhlášen.** Tvrdit „připojeno" o spojení, které nefunguje, je táž
nepoctivost jako „další pokus teď" u vypnutého odesílání. Sjednotit obě pojetí na to přísnější.
⚠️ Když se ukáže, že to uživatele vyhazuje z rozdělané práce, zastavit a zapsat Danovi.

**R2 — `declaredCaptureSources` se NESTAVÍ** (D28b): serverová session výslovně prosí
nestavět dřív než ona. Fáze 2.

**R3 — pořadí vln podle rizika, ne podle pohodlí:** nejdřív to, co uživatel vidí (vlna 1),
pak pravdivost stavu (2), pak distribuce (3), pak důkazy (4).

## Mantinely (beze změny)

Zákaz zápisu do Tabidoo · killswitche `DESKTOP_UPLOAD_ENABLED` a `DESKTOP_TIME_ENABLED`
zůstávají vypnuté · `design/**` zmrazený · `spec.md`/`plan.md` požadavky zmrazené (osy stavu
se udržovat SMÍ, BD-N30) · nikdy necommitovat zvuk ze skutečné schůzky · `ui-smoke` nespouštět
v sandboxu · při selhání opravovat VADU, ne měřidlo, nejvýš tři kola · zakázané „opravy":
oslabení testu, `it.skip`, vypnutí brány, zápis do baseline, `--force`, `[skip ci]`.

## Jak se pracuje

**Codex dělá, Claude konsoliduje.** Model podle skillu `codex-delegace-orchestrace`:
**psát kód → `gpt-6-astra`** (`xhigh`) · **hledat cizí vady → `gpt-5.6-sol`** (`ultra`).
Jeden worktree = jeden zapisovatel; **jeden SOUBOR = jeden job** (hotspot je `main.cjs`).
Panel v Orce přes `orca terminal create`, zadání **cestou k souboru**, `< /dev/null`.
Claude si nechává: diff, brány, sabotáže 3🔴:1🟢 včetně povinně zelené, commit, PR, merge.

---

## Stav běhu k 7. 9. 2026, 10:15

**Hotovo:** vlna 1a (#80, šest tichých selhání v rendereru) a 1b (#81, dialog u menu lišty).
`main` **968 passed | 3 skipped**, 0 PR, 0 worktrees.

**Dvě věci z vlny 1b ZÁMĚRNĚ nepostaveny** — pojistka v zadání zabrala:
- **vypršelý token jako nepřihlášen** (R1): zpřísnění schová ovládání nahrávání i frontu,
  zatímco recordery běží dál,
- **čas v liště od skutečného startu**: vyžaduje renderer a preload, které zadání zakázalo.

🔴 **A našla se přitom SKUTEČNÁ existující vada** (ověřeno i na nezměněném `main`):
**neplatná relace během nahrávání sebere z panelu ovládání i frontu, ale nahrávání běží dál.**
Cesta ven existuje (pravý klik → Ukončit nahrávání), takže to není slepá ulička — ale na
Danově stroji je ta ikona pod výřezem. **Rozhodnutí patří Danovi, leží v DAN-TODO.md.**

## Co dál (pořadí pro další kola)

1. **Vlna 3 — podepisování a notarizace nasucho.** A2 podáno, čeká na schválení Applem.
   Připravit `electron-builder`, entitlements (mikrofon, systémový zvuk), hardened runtime,
   cestu pro `notarytool`. **Ověřit vše, co jde bez certifikátu.**
   🔴 Nežádat Dana o certifikát ani Team ID, dokud schválení nedorazí.
2. **`declaredCaptureSources`** (D28b) — serverová session to teď chce, Dan schválil fázi 2.
   Parametr do URL nahrávací stránky, hodnoty `microphone` × `microphone+system`,
   **chybějící hodnota = nevím**. Po dokončení dát vědět serverové session k proměření.
3. **Vlna 4 — zvednout `verification`** z `tests-green` na `verified-live` receptem
   s podstrčeným syntetickým zvukem. Po každé zkoušce uklidit.
4. **Zbylých pět nízkých nálezů auditu**, pokud zbyde čas.

🔴 **`DSK-F010` ani `DSK-F012` NESTAVĚT** — `mcp:upload` scope neexistuje (D29, Danova stopka)
a alokace čekají na užší projekci (D33).
