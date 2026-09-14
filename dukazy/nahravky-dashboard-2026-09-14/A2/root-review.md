# Nezávislé auth/release review a převzetí T-A2

🧪 Nezávislý Sol reviewer prozkoumal diff `0109d0e..bf4aa92` pro přihlášení, auth IPC, updater, SSH publikaci a release validátory. Potvrdil jeden nález: explicitní userinfo cesta při výpadku či neúplné odpovědi přebírala identitu z token response. Syntetická sonda s HTTP 503 uložila `wrong@example.invalid`; nešlo o produkční request.

Oprava T-A2 začíná v explicitní cestě neznámou identitou a přijímá jen odpověď resolveru. Zachovává legacy větev bez resolveru a identitu uložené relace při refreshi. Koordinátor zkontroloval sedmiřádkovou runtime změnu, odstranil dva zastaralé komentáře a sjednotil původní HTTP 500 testovací fixture s HTTP 503 z packetu a sondy; obě varianty mají stejnou větev zpracování.

Koordinátor samostatně spustil typecheck a všechny tři dotčené auth sady: 87/87 testů zelených, oba exit 0. Doslovný výstup je v [root-testy.log](root-testy.log). Workerova skutečná sabotáž obnovení tokenové identity má RED exit 1 a obnovený GREEN exit 0 v [sabotaz.log](sabotaz.log). Brány, timeouty ani baseline se neměnily.

Podezření na chybějící notarizaci samotného DMG obalu nebylo přijato jako závada: aktuální smlouva výslovně garantuje podepsanou a notarizovanou vloženou aplikaci. Validátor kontroluje integritu DMG a verzi, architekturu, podpis, stapling a Gatekeeper této aplikace; netvrdí notarizaci ZIP či DMG obalu. Ve zbytku vymezeného review nebyl doložen další P1/P2. Review nenahrazuje skutečný release nebo instalaci.

⛔ Produkční přihlášení z Finderu, skutečný zvuk, podepsaný build, instalace ani aktualizace tímto ověřeny nebyly.
