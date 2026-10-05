F Osa nahrazuje Astra shell: nahrávání, rozhodnutí po stopu, historie, odesílání, nastavení a aktualizace běží v tray panelu. Samostatné okno se otevírá až pro UUID detail nahrávky. Zachovává skutečné služby 0.1.7 a přidává hledání/období/filtry/stránkování, main autoritu F stavů, obnovu rendereru a bezpečné místní přehrávání s revizemi a range streamem. LuTrack zůstává neaktivní. Geometrie ovládacích ikon a tray masky odpovídají schváleným podkladům.

🧪 Build, scoped lint a typecheck PASS; 15 F unit a 385 core regresních testů PASS. Původní i F nativeImage PASS. Izolované skutečné Electron E2E: 45 podmínek PASS včetně tří témat, skrytého panelu/main hodin, výpadku systémového zvuku, jednoho stereo derivátu, místního uložení, chráněného přehrávání, crash zachování a restartu. Nezávislé auth/IPC/queue review bez zbývajících konkrétních P1/P2. Produkční audit 0 zranitelností. ⚠️ Úplný audit má 7 nálezů ve vývojových závislostech (3 high, 4 moderate); lock závislostí se v tomto redesignu neměnil. Výpis je uložen pro dependency review.

⚠️ **Draft pro review, původní brány nejsou zelené.** `gates:clean` má 155 lint chyb v převzatých návrhových skriptech, stejné jako vstupní commit. Celá unit sada: 201 FAIL / 1468 PASS / 3 původní skipy; staré kontrakty očekávají Astra DOM, původní tray harness a druhé okno nastavení. Žádný původní test, gate, skip, baseline ani CI nebyl změněn. Doplňková F akceptace tyto FAIL měří samostatně a správně končí exit 1. Přechod zachovávající bezpečnostní assertions vyžaduje lidské rozhodnutí před mergem.

⛔ Zvuk je pouze synteticky testovaný. Fyzický ui-smoke/audio-smoke, skutečný serverový účet/upload/expirace, monitory a update instalace čekají na Mac přejímku. 72 archivovaných referencí představuje návrh, nikoli 72 ověřených produkčních stavů.

🟡 Verze připravena na 0.1.8 a encoder arm64/x64 ověřen proti locku. Existující signing/notarization workflow zachován. Žádný tag, merge, publikace ani produkční instalace neproběhly.

- [Stav a checkpointy](docs/behy/desktop-osa-2026-10-05/STAV.md)
- [Doslovné důkazy a snímky návrh/aplikace](dukazy/desktop-osa-2026-10-05/README.md)
- [Konkrétní rozpor bran](docs/behy/desktop-osa-2026-10-05/ROZPOR-BRAN.md)
- [Nezávislé review](docs/behy/desktop-osa-2026-10-05/REVIEW.md)
- [Krátká Mac přejímka](docs/behy/desktop-osa-2026-10-05/MAC-PREJIMKA.md)
