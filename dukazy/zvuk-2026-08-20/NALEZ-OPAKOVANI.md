# Opakovaný pokus, 21. 8. 2026 — systémový zvuk FUNGUJE

Noční pokus (20. 8.) skončil bez nahrávek, ale **nebyl to výsledek o Electronu** — běh v sandboxu
neměl přístup k audio zařízením vůbec (nešel ani mikrofon s oprávněním `granted`).

Zopakováno v přihlášené relaci uživatele. Výsledky:

## 1. Vidí Electron zvuková zařízení?

**Ano.** `enumerateDevices()` vrátil sedm položek, mimo jiné `Mikrofon MacBook Pro (Built-in)`,
`Mikrofon zařízení Daň`, `Microsoft Teams Audio Device (Virtual)` a výstupy.
`getUserMedia({audio:true})` vrátil funkční stopu.

## 2. Funguje systémový zvuk (loopback)?

**Ano.** Přes `session.setDisplayMediaRequestHandler` s `{video: <zdroj>, audio: 'loopback'}`
a `navigator.mediaDevices.getDisplayMedia()`:

- vznikla **jedna audio stopa** s názvem **`System audio`**
- `MediaRecorder` nad ní produkoval data

**Kontrolní měření, které vylučuje, že jde o prázdnou stopu:**

| Co hrálo během 5 s nahrávání | Velikost nahrávky |
|---|---|
| ticho | 996 B |
| systémový zvuk (3× `Glass.aiff` přes `afplay`) | **43 339 B** |

Poměr 43:1. Zvuk se tedy skutečně zachytává, ne jen deklaruje.

## 3. Jaké dialogy to vyžádalo?

**Žádné.** Test proběhl bez jediného systémového okna — oprávnění k záznamu obrazovky bylo uděleno
už 20. 8. večer (uživatel tehdy klikl na dialog, který vyskočil při nočním běhu).

⚠️ **Neověřeno:** jak dialog vypadá u čisté instalace na cizím Macu, a jestli si řekne o „Záznam
obrazovky“ nebo o „Systémový zvuk“. To se dá změřit jen na stroji, kde oprávnění ještě uděleno není.

## Co z toho plyne

- **Volba Electronu je potvrzená měřením**, ne jen zdrojovým kódem Chromia.
- Cesta vede přes `getDisplayMedia`, tedy s obrazovým proudem, který se zahodí — což je ta známá
  nevýhoda. Ale funguje.
- Zbývající otevřená otázka je **oprávnění na čistém stroji**, ne technologie.

Použité skripty: `test-zarizeni.js` (výčet zařízení a mikrofon), `test-loopback.js` (systémový zvuk).
