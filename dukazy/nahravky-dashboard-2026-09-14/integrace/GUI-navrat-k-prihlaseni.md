---
kind: observation
ref: T-A1
verdict: conditional
measuredAt: 2026-09-14T20:19:00Z
scope:
  - návrat od dokončeného onboardingu k přihlášení
measuredFrom:
  - CUA accessibility strom a screenshot skutečného okna Electronu
  - npm run build a izolovaný proces npm start nad a25bd5c
---

🟡 Aplikace po novém buildu otevřela v odděleném profilu `.runtime/gui-review` skutečné okno s verzí 0.1.2, nadpisem „Nejsi připojený“ a tlačítkem „Přihlásit v prohlížeči“. Předchozí zaseknutá závěrečná obrazovka se neobjevila. Spuštění použilo `LUDONE_E2E=1`, tedy fake auth bez produkční relace a s vypnutými aktualizacemi; na přihlášení se neklikalo.

Pozorovaný accessibility výřez:

```text
Window: "LuDone Desktop", App: Electron.
5 text LuDone Verze  0.1.2
6 záhlaví Nejsi připojený
8 text Otevře se ti prohlížeč. Po potvrzení se sem vrátíš sám.
9 tlačítko Přihlásit v prohlížeči
```

Na této obrazovce chybí přímé Nastavení. Existující kontextové menu ikony je obsahuje; T-05 doplní přímý přístup také při odhlášení. GUI průchod neověřil přihlášení, nahrávání, převzetí, server ani update. Testovací proces byl ukončen Cmd+Q, exit 0.
