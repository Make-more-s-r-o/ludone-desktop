---
kind: review
ref: c0cc32e
verdict: pass
measuredAt: 2026-09-14T19:29:49Z
scope: [oauth, session-migration, upload-identity]
measuredFrom: [production-diff, independent-vitest-run, regression-sabotage]
---

# A1 – přihlášení a migrace oprávnění

🧪 Nezávislé spuštění koordinátorem: 345 testů, exit 0 (`A1-testy.log`). Scope, resource a issuer tvoří jeden kontrakt použitelné relace. Starý mcp:read token se pro upload nepoužije; nové přihlášení zapisuje přes stávající šifrovanou atomickou transakci.

Review vyžádalo dvě opravy: neomezený OAuth error text mohl uniknout do zprávy; invalid_client přicházející validovaným loopback callbackem původně neinvalidoval cache. Obě opravy jsou v `ccb47e7`, včetně sentinel testu. Odmítnutí klienta nezkouší znovu použitý refresh token ani samo neotevírá prohlížeč.

## Proč to není chyba měřidla

Sabotáž allowlistu v produkčním modulu vedla ke konkrétní regresi nad citlivým sentinel textem, exit 1 (`A1-sabotaz.log`). Původní modul byl obnoven v `finally`. Testy procházejí kontrolerem a šifrovaným úložištěm, nikoli izolovanou kopií podmínek.

Bezpečnostní invarianty: beze změn serveru, bez přidání cookie přihlášení, bez nových IPC kanálů, bez plaintext ukládání. Nový vzhled není součástí této změny. Důkazy neslibují skutečný login na produkci; ten čeká na aplikaci z Finderu a Danovo přihlášení.

Samotný auth nezapíná odesílání. Souhlas s nahrávkou a zpřístupnění uploadu zůstávají navazující úlohou.
