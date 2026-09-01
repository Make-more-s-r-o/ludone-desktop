# Design manifest — LuDone Desktop v1

**Kanonický zdroj designu je `design/` v kořeni repozitáře**, ne tenhle adresář.
Masterplán §3 předepisuje `artifacts/design/`; tady se od něj vědomě odchylujeme, protože
`design/` je zavedené místo, na které ukazuje `.gitignore`, náhled i `approved.json`.
**Přesun by rozbil odkazy den před nočním během.** Zapsáno jako odchylka O10 v `decisions.md`.

| Co masterplán chce | Kde to doopravdy je |
|---|---|
| `approved.json` | [`design/approved.json`](../../../../../design/approved.json) |
| `screens/` | [`design/navrh/nahled.html`](../../../../../design/navrh/nahled.html) — 23 obrazovek |
| `flows/` | [`design/navrh/Cesta.dc.html`](../../../../../design/navrh/Cesta.dc.html) |
| `states/` | `spec.md` §6 — matice 13 stavů |
| `comparisons/` | [`design/navrh/tri-smery-pristroje.html`](../../../../../design/navrh/tri-smery-pristroje.html) |
| design systém | `design/zadani/` (tokeny barev) |

⚠️ **Chybí tokeny mimo barvy** — písmo, tvar, pohyb a mezery jsou opsané z artboardů, ne ze
zdroje. Implementátor tedy nemá kde vzít `--space-3` ani poloměr. Doplní se při závěrečném
stažení z Claude Designu (`/design-login`, umí spustit jen Dan).

🔴 **Varianta Divergent je ZRUŠENÁ** (rozhodnutí M16 — stála na kalendáři, který nebude).
Soubor `design/navrh/Divergent.dc.html` v repu zůstává jako historie. **Nestavět podle něj.**
