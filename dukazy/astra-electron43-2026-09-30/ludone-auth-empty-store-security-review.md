---
kind: review
ref: desktop-astra-parity-0-1-6-electron43
verdict: "🧪 zelené testy"
measuredAt: 2026-09-30T00:05:00Z
scope: [nezávislé review nebo report příslušného diffu]
measuredFrom:
  - posouzený produkční diff nebo skutečné Electron snímky podle textu reportu
  - uložené doslovné testové výpisy a E2E diagnostika podle textu reportu
---

# Read-only security review: prázdné úložiště identity

**Výsledek:** Žádné P1/P2 nálezy v minimálním diffu `electron/main.cjs` a novém `tests/auth-empty-store.test.js`. `git diff --check` prošel.

Změna pouze přesouvá `readFile(tokenSessionFilePath(app))` před `safeStorage.isEncryptionAvailable()`. Při `ENOENT` vrací `null` bez dotazu na Keychain; jakákoli jiná chyba čtení stále vyvolá obecnou chybu bez cesty či tokenu. U existujícího blobu zůstává kontrola dostupnosti šifrování, dešifrování, JSON a metadat i odmítnutí neplatné identity. Cesta tokenu dál prochází ochranou `tokenStorageDirectory`; změna nic nezapisuje a nemění OAuth endpointy, token projection ani IPC sender guard.

Race s odhlášením zůstává bezpečný: probíhající logout je odmítnut před I/O; u existujícího blobu závěrečná kontrola `authLogoutsInFlight` a `authSessionGeneration` před vrácením identity zabrání vydání starého tokenu. Pokud při race zmizí soubor a čtení vrátí `ENOENT`, výsledkem je pouze `null`. Nových devět případů pokrývá prázdný profil s/bez adresáře, nedostupný/házející Keychain s blobem, validní blob, jinou chybu čtení, selhání decryptu/neplatný formát, logout a změnu generace. Test používá doslovné tělo produkční funkce nad skutečným dočasným filesystemem; není to integrační test nativního Keychainu.

**Meze ověření:** Review je statické; skutečný Electron 43/Keychain prázdného profilu a plné `queue-wiring` podle zadání běží samostatně. Zvuk ani síťový OAuth jsem neověřoval.
