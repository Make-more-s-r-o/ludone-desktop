## Prostředí a mantinely — platí pro každou etapu

🔴 **Na začátku si ověř `pwd`.** Když nesedí s worktree v zadání, přepni se — cesty jsou
absolutní schválně. Píšeš **česky** (kód anglicky, komentáře a dokumentace česky).
**NECOMMITUJEŠ, NEPUSHUJEŠ, NEMERGUJEŠ** — commit dělá orchestrátor.

- **Nemáš síť.** `npm install`, `npm ci`, `curl` neprojdou (ověřeno: DNS, kód 6).
  Balíčky **už jsou nainstalované** včetně `package.json`. Když ti něco chybí,
  **NEINSTALUJ** — zapiš do `notes` a vystač si s tím, co je.
- **Žádný příkaz nesmí čekat na vstup**: `git --no-pager …`, `GIT_PAGER=cat`, `PAGER=cat`.
  Totéž pro cokoli interaktivního — na pozadí ti vstup nikdo nedodá a job umře.
- **macOS nemá `timeout`** — nepoužívej ho nikde, vrací `EXIT=127`, což vypadá jako pád.
- 🔴 **Exit kód měř PŘED rourou**: `cmd > /tmp/out 2>&1; echo $?`. Za `| tail` čteš
  status roury a fail-open brána vypadá jako úspěch.
- 🔴 **NESPOUŠTĚJ nic, co potřebuje GUI, zvuk nebo oprávnění** — Electron ze sandboxu
  nenaskočí a zvukové zařízení tam není. `ui-smoke` ani `audio-smoke` **nespouštěj**.
  Etapa, která by tvrdila, že je „ověřila", lže.
- **Když něco ověřit nejde, označ to za nedoložené a datuj starším měřením.** Přiznaná
  nemožnost ověřit je cennější než domyšlená jistota — je to správné chování, ne selhání.

### Co NESMÍŠ (platí vždy)
- sahat na existující testy a brány kvůli průchodu — **opravuje se VADA, ne MĚŘIDLO**
- přidat si výjimku z brány (`*-exempt` marker, `skip`, `it.skip`, zápis do baseline).
  Když si myslíš, že je namístě, napiš **KTEROU a PROČ** do `notes` a rozhodne orchestrátor
- sahat na `design/` — je to **cizí netrackovaná práce**
- tvrdit, že něco funguje, když jsi to nespustil

### Když si zadání odporuje se stavem repa
Neřeš to domyšlením. Udělej **nejmenší bezpečnou variantu** a rozpor zapiš do `notes`.
Počty a čísla řádků ber jako **orientační** — když naměříš jiné, řiď se **MĚŘENÍM**.

### Test, který nic nehlídá, je horší než žádný
🔴 U každého testu si polož otázku: **„kudy se to, co testuju, projeví do něčeho, co test
vidí?"** Když je odpověď „přes návratovou hodnotu mocku, který ji vrací natvrdo", ten test
nehlídá nic. Radši `it.todo` s poznámkou, co by bylo potřeba, než falešná zelená.
