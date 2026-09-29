# DAG — desktop-astra-parity-0-1-6

| task | náplň | závisí na | výstup |
|---|---|---|---|
| T-01 | Zjištění, rozhodnutí, Astra kontrakt, příprava E2E a schválení | — | intent, discovery, outcome, mockup, spec, plán a schválení |
| T-02 | Společný shell, navigace, velikosti a zachování IPC | T-01 | Teď/Můj den/Nastavení se stejnou navigací a zachovaným sender guard |
| T-03 | Teď, záznam a uložení | T-02 | Idle/nahrávání/save/local/queue ve skutečných datech |
| T-04 | Můj den, nahrávky a detail | T-03 | Časová stopa a akce z reálného zdroje; disabled LuTrack |
| T-05 | Nastavení, onboarding, identita a update | T-04 | Konzistentní plochy se stávajícím API |
| T-06 | Electron E2E a vizuální porovnání | T-05 | PASS/FAIL, screenshoty, diff, doslovný log |
| T-07 | Review, plné brány, CI a release | T-06 | release candidate; tag až po zelené E2E |

Všechny kroky má sekvenčně jeden zapisovatel. Každá změna hotspotu se integruje před dalším taskem; žádné souběžné úpravy stejného souboru.
