---
kind: review
ref: T1-A1-updater-T6
verdict: tests-green
measuredAt: 2026-09-14T19:43:30Z
scope: [queue-persistence, updater-state, release-workflow]
measuredFrom: [source-diff, local-vitest-and-gates, persistence-sabotage]
---

# Integrační review T1, aktualizací a přípravy vydání

🧪 Root zkontroloval výsledné změny a nezávisle spustil cílené testy i celou bránu na integrovaném kódu (včetně auth A1). `T1-testy.log`: 417 testů, exit 0. `T1-A1-updater-T6-gates.log`: 64 souborů, 1341 testů, tři původní skip podle nezměněné baseline, exit 0.

## Fronta

Callback průběhu se awaitne před prvním GET/chunky a zapisuje přes již vlastněnou serializaci; nezavádí re-entry deadlock. Serverové UUID a společná session jsou stabilní, dvě stopy nesmějí sdílet recordingId. Ukládá se obnovitelná čekající položka. Obnovení po INITu čte session z fronty. Povinné sessionId prvního INITu odpovídá i read-only serverovému kontraktu (uploads/route.ts, větve created a replay). Sabotáž nahrazení persistProgress prázdným callbackem shodila test pádu po INITu na skutečném obsahu outgoing.json (exit 1). Kód byl obnoven v finally a následná celá brána je zelená.

## Aktualizace a vydání

Dostupná verze a průběh jsou projekce stávajícího updateru, hodnoty z metadat jsou omezené a revize chrání před starým snímkem. Bezpečné bariéry instalace zůstávají. Release kontroluje čtyři balíčky, velikosti, SHA-512 a blockmapy; ZIP i DMG kontrolují vloženou podepsanou a notarizovanou aplikaci, Intel se porovnává jako x86_64. SSH používá předem uložený host key a úzké hodnoty host/user/path. Remote helper kontroluje SHA-256 před přesunem a feed mění posledním atomickým rename; konfliktní obsah stejné verze odmítá.

🟡 Žádná klíčová hodnota nebyla přečtena ani použita. Podpis, notarizace, přenos na produkci a automatická instalace této verze nebyly provedeny. Před Danovým release tagem je nutná záloha podpisového klíče a publikační konfigurace v GitHubu. Chybějící konfigurace je ve workflow pojistka před použitím klíče. Reálné audio, Finder přihlášení a aktualizaci ověří Dan podle předávacího postupu.
