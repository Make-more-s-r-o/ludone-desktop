# T-A3 — přejímka koordinátora

15. 9. 2026, 00:02–00:05 Europe/Prague. Zdroj `0340c8e1076eb8b59bfcc9d176f9aa74f57e400a`.

- 🧪 Koordinátor spustil celé `npm run gates` nad předaným stromem: **1452 PASS, tři původní skipy, exit 0**. Úplný výpis je v `root-gates.log`. Proti přijatému T4 přibylo 19 testovacích případů.
- Review zahrnulo celý runtime diff, nové controller/React testy a změnu existujícího testu obnovy tokenu. Ten nově vyžaduje odmítnutí zastaralého snapshotu a nezměněný obnovený token; jde o zpřísnění CAS, nikoli vypuštění kontroly.
- Zápis je v původní token-storage transakci a váže issuer, DCR klienta, resource, upload scope, identitu a access token. Podmíněný reset neodstraní novější firmu. Guard běží synchronně uvnitř transakce.
- Jednorázový token nabídky váže requester, relaci a generaci; výběr ověřuje členství znovu. Komponenta načítá nabídku pouze klikem a při změně auth zahodí opožděný výsledek. Žádný nový transport nebo automatické schválení nahrávek.
- Původní neúspěšný lint/typecheck i dvě reálné sabotáže zůstávají archivované. Testovací tokenové řetězce ve výpisu sabotovaného fixture jsou smyšlené hodnoty, nikoli přístupy k účtu.
- 🟡 Základ je přijatý; teprve T-A4 po T5 vloží selector do Nastavení a zapojí IPC. Existující fetchCompanies normalizuje vadnou 200 odpověď; navazující adapter musí zachovat možnost ji odmítnout.
- ⛔ Neověřeno na produkčním účtu, z Finderu ani v instalovaném balíčku. Tato přejímka nevytváří live důkaz zvuku nebo uploadu.
