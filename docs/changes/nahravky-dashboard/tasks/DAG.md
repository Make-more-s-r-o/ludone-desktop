# Task DAG

T0 → T1 → T2 → T3 → T4 → T5 → přejímka. A1 (přihlášení) běží nezávisle a předchází přejímce; R1 (429) navazuje na T2. T6 připravuje vydání nezávisle, zveřejnění čeká na přejímku a Dana.

| Etapa | Závislost | Kdo |
|---|---|---|
| T0 | — | Sol fronta |
| T1 | T0 | Sol fronta |
| T2 | T1 | Sol převzetí |
| T3 | T2 | Sol dashboard |
| T4 | T3 | Sol dashboard |
| T5 | T4 | Sol odesílání/UI |
| A1 | — | Sol auth |
| R1 | T2 | Sol fronta |
| T6 | — | Sol vydání |

Přesné vlastnictví souborů určuje packet a dispatch. `main.cjs` se dělí pouze na explicitně vyjmenované bloky (auth / queue / updater); `Settings.jsx` a renderer nahrávek mají vždy jediného workera. Žádné souběžné zápisy do jednoho stromu. Root píše integrační dokumenty a provádí přejímku.
