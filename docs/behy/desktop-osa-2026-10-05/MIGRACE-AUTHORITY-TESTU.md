# Rovnocenná migrace autority testů na F Osa — 5. 10. 2026

Výslovné pověření Dana předané rootem dovoluje rovnocenně převést stará očekávání na schválený F kontrakt. Práce vychází z integračního `995626f` a vlastní větev `fix/osa-authority-tests` mění jen tři svěřené testy a tento záznam. Žádný produkční soubor, původní golden PNG, baseline ani skip se nemění.

## Mapa zachovaných podmínek

- `tray-authority`: původní mapování `trayIconName`, template varianty a všechny původní scénáře zůstávají. Runtime měří skutečný `deriveOsaTrayState`/`refreshTray`: místní záznam před přihlášením, LuTrack bez aktivní F ikony, přesný skutečný tooltip. Invariant čistého výběru runtime nyní ověřuje F derive i následné `osaTrayImage(trayState)`; historický image mapping je ověřován dál samostatně.
- Autorita po pádu, zrušené přípravy, finalizované session, izolované zapomenutí vlastníka, validace přesně čtyř boolean faktů a všechny mutační přepočty zůstávají. Přeživší tracking owner je nově přímo kontrolován, protože se ve F už neprojevuje aktivní ikonou.
- Harness parametrizuje skutečná queue fakta, dostupnost sítě, export stages a dokončovací session. Přidává souběhy saving/decision/attention/offline, přesnou inventuru deseti F stavů a měnící se tooltip bez nové bitmapy. Skutečný main queue reduktor testuje held versus approved intent, nutný lidský zásah, offline důvod a nezměněná fakta při neznámém výsledku.
- `ipc-sender-guard`: úplná inventura doplněna o osm skutečných F kanálů. Žádný starý kanál nebyl vypuštěn. Všechny kontroly validačního wrapperu, duplicity, média/kamera/cizí URL/rám/zničené okno zůstávají. Schválené panel+settings role mají navíc obousměrné runtime assertions skutečně vlastněného webContents, mainFrame, chybějícího rámu a nesprávné role.
- `diagnostics`: přesné roles jsou nyní vlastní panel+detail. Snapshot, whitelist exportu, zákaz HTTP sondy/payloadu, vyřazení tokenů/zvuku/názvů/cest a souborový režim 0600 se nemění.

Původních **109 případů** zůstává, přibylo **22** případů; finální sada má **131 případů, 0 skip**. Výchozí F konflikty byly 19 FAIL/90 PASS, nikoli ReferenceError vyplněný falešnými funkcemi. Počet zápisů assertionů neklesá:

- `tests/tray-authority.test.js`: původně 79 zápisů `expect`, nyní 106.
- `tests/ipc-sender-guard.test.js`: původně 35 zápisů `expect`, nyní 40.
- `tests/diagnostics.test.js`: původně 32 zápisů `expect`, nyní 32.

## Ověření

🧪 Tři svěřené sady jsou zelené na připnutém Node 24.19.0 / Vitest 4.1.11. Nejde o fyzickou přejímku ani o zelený stav celého integračního gates.

Doslovný příkaz:

```sh
/Users/dev_ludone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run tests/tray-authority.test.js tests/ipc-sender-guard.test.js tests/diagnostics.test.js
```

Doslovný výpis:

```text

 RUN  v4.1.11 /Users/dev_ludone/Dev/ludone-desktop/.claude/worktrees/osa-authority-tests


 Test Files  3 passed (3)
      Tests  131 passed (131)
   Start at  16:42:23
   Duration  418ms (transform 62ms, setup 34ms, import 367ms, tests 41ms, environment 0ms)

exit code: 0
```

Další kontrola:

```sh
/Users/dev_ludone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/eslint/bin/eslint.js tests/tray-authority.test.js tests/ipc-sender-guard.test.js tests/diagnostics.test.js
git diff --check
```

Obě kontroly bez výstupu, exit code: 0. Push nebyl proveden. Bezpečné převzetí a kompletní integrační brány vlastní root.
