# T6 — důkaz přípravy vydání

Datum: 14. 9. 2026
Větev: `feat/nahravky-vydani`

## Kontrola živého feedu před změnou

`curl -fsS https://stahnout.ludone.cz/desktop/latest-mac.yml`

- Exit kód: `0`
- ✅ živě vrácena verze `0.1.1`
- ✅ metadata obsahovala DMG i ZIP pro `arm64` a `x64`

`curl -fsSI https://stahnout.ludone.cz/desktop/`

- Exit kód: `0`
- ✅ živě vráceno HTTP `200 OK`

## Akceptační příkaz

Doslovný příkaz, spuštěný bez roury:

```text
npm run gates
```

Exit kód převzatý přímo z procesu: `0`.

Koncový výpis:

```text
Test Files  64 passed (64)
     Tests  1316 passed | 3 skipped (1319)

> ludone-desktop-prototype@0.1.2 preskocene
> node scripts/preskocene.mjs

[preskocene] 3 přeskočených, baseline 3 — v pořádku.
```

Doslovný příkaz nad čistým klonem commitu `d361f9f0`, také bez roury:

```text
npm run gates:clean
```

Exit kód převzatý přímo z procesu: `0`.

Koncový výpis:

```text
Test Files  64 passed (64)
     Tests  1316 passed | 3 skipped (1319)
[preskocene] 3 přeskočených, baseline 3 — v pořádku.
✓ built in 511ms

🟢 Brány nad čistým klonem d361f9f0 prošly.
```

🧪 Zelené testy dokazují validaci metadat a hashů, mapování `x64` → `x86_64`, read-only mount
DMG, úklid mountu při chybě a pořadí serverové publikace. Test serverové části prokázal, že
při vadném SHA-256 zůstane dosavadní `latest-mac.yml` beze změny.

⛔ Nepoužit žádný podpisový ani SSH klíč. Nevznikl podepsaný build, tag ani síťový přenos na
server. `npm run release:mac`, skutečný SCP a instalace/aktualizace proto zůstávají neověřené.
