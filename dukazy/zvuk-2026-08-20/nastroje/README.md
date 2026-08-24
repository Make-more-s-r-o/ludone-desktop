# Nástroje měření z 20.–21. 8. 2026

Skripty, kterými se měřilo, jestli Electron na tomhle Macu zachytí systémový zvuk.
Archivovaly se 25. 8. 2026 z worktree `.claude/worktrees/zvuk` (větev `feat/zvuk-dukaz`)
těsně předtím, než se ten worktree odstranil.

| Soubor | K čemu byl |
|---|---|
| `test-zarizeni.js` | výpis zvukových zařízení, která Electron vidí |
| `test-loopback.js` | pokus o loopback zachycení přes `getDisplayMedia` |
| `t.html` | minimální stránka, ve které ty testy běžely |

🔴 **Surová data z tohohle měření se NEDOCHOVALA.** Adresář `nahravky/` v tom worktree
byl při archivaci **prázdný** a nikde na disku už nejsou ani nahrávky, ze kterých se
počítala **křížová korelace 0,9638 (systém) a 0,0098 (mikrofon)**. Ta čísla se v repu
citují na několika místech, ale **žádný artefakt je dnes nereprodukuje** — jsou to
tvrzení z měření 20.–21. 8. 2026, ne něco, co si čtenář může přepočítat.

✅ **Co reprodukovatelné JE:** běh z 21. 8. archivovaný v `dukazy/nahravani-2026-08-21/`.
Ten stojí na jiné cestě k témuž závěru — mikrofon byl **se zvukem tišší než v tichu**,
takže do něj reproduktor neslyšel — a jde přepočítat jedním `ffmpeg` příkazem.
Když potřebuješ závěr o systémovém zvuku podepřít, odkazuj **na něj**, ne na korelaci.
