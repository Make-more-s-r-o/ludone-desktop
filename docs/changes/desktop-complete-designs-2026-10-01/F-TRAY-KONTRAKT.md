# F Osa — horní lišta macOS

5. 10. 2026. Dan upřesnil, že rozpracovat chce hlavně ikony **v systémové horní liště**. Výběr F platí. Toto je podoba k posouzení a podklad budoucí implementace; produkce se nemění.

## Podoba

[Klikatelný přehled](design/f-tray.html) ukazuje skutečných 18 px, Retina export při stejné logické velikosti a zvětšený detail. Každý stav má světlou i tmavou lištu. Ze situace lze otevřít F. Písmo je systémové, čas používá číslice stejné šířky. Dock dál používá originální `LuDone.svg`/existující ICNS z Opus podkladu.

Značka má přesnou geometrii tří původních obdélníků, jednotně zmenšenou a posunutou; nepřekresluje se ani nepřeškrtává. Stav má vlastní prostor v pravém horním rohu. Všechny masky jsou monochromatické, bez pozadí; macOS template režim určí kontrast podle skutečné systémové lišty, nezávisle na tématu aplikace. Barva není nositelem významu. Hlavní obrázek se nepulsuje a nemění šířku; titulky přibudou pouze během nahrávání, ukládání a rozhodnutí.

| Stav | Tvar vedle značky | Text v liště | Základ tooltipu |
|---|---|---|---|
| `idle` | žádný | žádný | LuDone · Připraveno |
| `recording` | plná tečka | skutečný běžící čas | LuDone · Nahrává se |
| `recording-audio-lost` | výstražný trojúhelník | skutečný běžící čas | LuDone · Nahrává se · výpadek systémového zvuku |
| `recording-microphone-only` | poloviční kruh | skutečný běžící čas | LuDone · Nahrává se · jen mikrofon |
| `saving` | šipka dolů | Ukládá se | LuDone · Ukládá se |
| `decision` | dokument | Uložit | LuDone · Čeká na uložení |
| `signed-out` | účet | žádný | LuDone · Přihlásit se |
| `offline` | samostatný přeškrtnutý kruh | žádný | LuDone · Odesílání čeká na připojení |
| `attention` | vykřičník | žádný | LuDone · Odesílání vyžaduje pozornost |
| `queue-waiting` | dvě tečky | žádný | LuDone · Čeká na odeslání |

Počet a podrobnosti jsou v panelu a tooltipu, aby se lišta zbytečně neroztahovala pod výřez. Výpadek zvuku a vědomé „jen mikrofon“ jsou odlišné situace. Poloviční kruh je návrh, jeho rozpoznatelnost člověkem při 18 px čeká na Mac přejímku.

## Pravdivý stav a souběhy

Priorita: živé nahrávání s výpadkem → živé jen mikrofon → živé nahrávání → skutečné dokončování souboru → čekající rozhodnutí → chybějící přihlášení → offline s čekající frontou → nutný zásah → čekající fronta → připraveno. Odhlášení ani nedostupná síť nepřekryjí aktivní místní nahrávání. Další omezení doplní tooltip a panel. Offline bez čekajícího odeslání samo nevytváří problémovou ikonu.

**Současná produkce má jinou prioritu:** `signed-out` je nad nahráváním a nemá samostatné `saving`/`decision`. Budoucí změna potřebuje testy souběhů a review; nelze jen přepsat očekávání starého testu. Main proces musí určovat nahrávání, zdroje, výpadek, finalizaci i export stage. Renderer nesmí tvrdit, že se nahrává, ani přímo vybírat název tray stavu. Čas zůstane od skutečného začátku session v main procesu. Chyba dokončení není nekonečné „Ukládá se“ ani návrat do „Připraveno“; musí vést k existující bezpečné obnově a vysvětlení v panelu.

HTML `f-tray.js` je čistá funkce návrhu s fiktivními vstupy. Maketa obsahuje i historické fiktivní chyby, takže po otevření běžné obrazovky může ukazovat zásah; galerie odděleně ukazuje čisté stavy. Není to zdroj produkční autority.

## Předané soubory

- `design/f-tray.js`: kresba a prezentační kontrakt.
- `design/f-tray-assets/`: deset SVG a dvacet PNG (18/36 px), manifest s SHA-256.
- `design/generate-f-tray.mjs`: reprodukovatelné exporty pouze do složky návrhu. Není závislý na platformě či externím balíčku.
- `design/check-f-tray.mjs`: samostatné PASS/FAIL pro přípravu, pořadí souběhů, rozměry, monochromatické alfa masky, úplnost a identitu značky.

Při integraci bude `nativeImage` mít logickou velikost 18 × 18 a reprezentaci 36 × 36 při `scaleFactor: 2`, `setTemplateImage(true)`. Nepřekreslovat bitmapu jiným generátorem. Zachovat skutečný tooltip, titulky, klik/pravý klik, nabídku ukončení a všechny ochrany záznamu. LuTrack nepřidává nový aktivní stav; jeho produkční integrace zůstává mimo rozsah.

## Ověření a rozhodnutí

🧪 Přípravu měří `node docs/changes/desktop-complete-designs-2026-10-01/design/check-f-tray.mjs`; doslovný výpis včetně exit kódu je v [důkazech](../../../dukazy/desktop-f-tray-predani-2026-10-05/README.md).

🟡 Tato poslední podoba ikon čeká na Danovo posouzení. ⛔ Systémová lišta, fyzické oba zvukové kanály, serverový upload a instalace nové aplikace nejsou tímto návrhem ověřené.
