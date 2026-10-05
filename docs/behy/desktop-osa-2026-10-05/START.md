# Zahájení vývoje F Osa na Macu mini

5. 10. 2026. Dan v původním chatu přímo schválil celou vybranou F Osa i poslední ikony a požádal o zahájení: „ok, schvaluju, můžeš to pustit ty? nebo ne musím já?“ Tím je splněna podmínka zahájení v přípravném promptu. Historické čekání na schválení v podkladech popisuje stav před tímto pokynem.

## Rozsah a vlastnictví

- Host `dev-ludone`, izolovaný checkout `/Users/dev_ludone/Dev/ludone-desktop/.claude/worktrees/desktop-osa`, větev `feat/desktop-osa`.
- Výchozí main `2dd73fb2821f81fad3d9087381c72fd4d127e927`, podklady `docs/desktop-clarity-preview` `95ff0b2c7a6d92a6f92efe80f9a030fc57d240ea`. Přeneseny jen `docs/changes/desktop-complete-designs-2026-10-01/` a související důkazy; novější produkční dokumentace se nepřepisuje.
- Celá F: menu bar panel pro nahrávání, rozhodnutí po stopu, historii, frontu, nastavení a aktualizace; samostatné okno až pro detail. Poslední ikony dle F-TRAY-KONTRAKT.md.
- Rutinní implementace a koordinace běhu: `gpt-6.1-sol`, reasoning `low`; nejvýše dva další pracovníci, každý zapisovatel ve vlastním worktree. Jeden zapisovatel main/preload a integračního shellu. Povinné nezávislé review citlivých změn.
- Backend, LuTrack napojení a cizí kořenový `design/` se nemění. Zvuk, fronta, tokeny a IPC ochrany z 0.1.7 zůstávají skutečné a zachované.
- Úplná implementace, ověření, commity, push a PR jsou součástí běhu. Finální publikace/tag čekají na review skutečného výsledku a výslovný pokyn k vydání. Nainstalovaná aplikace se tímto startem nenahrazuje.

## První checkpoint

Změřit výchozí brány a zmapovat F na současné služby. Domluvit props/datový model, potom implementovat skutečný shell: panel 420/460/440 px, levá navigace a detail 860 × 580 px. Doložit dostupný stop, main čas při skrytém panelu, návrat z detailu a ochranu quit/update. Zelené testy nezaměňovat za fyzické audio měření.

## Provoz

Start připraven `2026-10-05T10:57:51.046170+00:00`. Codex CLI 0.160.0, autentizace existujícím přihlášením přes ChatGPT. Použitý workspace sandbox a automatické posouzení žádostí; bez vypnutí sandboxu, bez hesla správce. Runtime logy jsou v `.runtime/osa-vyvoj-2026-10-05/`; nejsou automaticky součástí Git. Trvalé ověřovací důkazy po kontrole ukládat do `dukazy/desktop-osa-2026-10-05/`.

🟡 Implementace probíhá; ⛔ skutečný nativní tray, fyzický zvuk a nové vydání tímto záznamem nejsou ověřené.
