# Archiv měření zvuku z 20.–21. 8. 2026

Tento adresář zachovává původní pokus, jeho pozdější vyvrácení a nástroje, kterými
se měřilo. Čti ho v tomto pořadí:

1. [`NALEZ.md`](NALEZ.md) — původní závěr z 20. 8., kdy izolovaná relace neměla
   zvuková zařízení a zachycení se nepodařilo.
2. [`NALEZ-OPAKOVANI.md`](NALEZ-OPAKOVANI.md) — o den pozdější vyvrácení po
   opakování v přihlášené uživatelské relaci.
3. [`nastroje/`](nastroje/) — archiv skriptů a minimální stránky použitých při
   měření.

## Co tu není doložené

Korelační hodnoty **0,9638** pro systémovou stopu a **0,0098** pro mikrofon nejsou
v tomto adresáři reprodukovatelné. Surové nahrávky, ze kterých byly 20.–21. 8. 2026
spočítány, se nedochovaly; adresář `nahravky/` byl při archivaci prázdný. Čísla jsou
proto historickým tvrzením z měření, ne důkazem, který lze z obsahu repozitáře přepočítat.

Reprodukovatelný důkaz stejného závěru je v
[`../nahravani-2026-08-21/`](../nahravani-2026-08-21/). Obsahuje archivované WebM
stopy i příkaz pro přepočet hlasitostí: mikrofon byl se zvukem tišší než v tichu,
zatímco systémová stopa přešla z přesné digitální nuly na zřetelný zvuk.

## Jak měření zopakovat

Postup a účel jednotlivých souborů popisuje [`nastroje/README.md`](nastroje/README.md).
Skripty `test-zarizeni.js` a `test-loopback.js` lze znovu spustit v Electronu na Macu
s dostupnými zvukovými zařízeními a oprávněními. Pro nové ověření je nutné vzniklé
WebM nahrávky uchovat spolu se známým referenčním zvukem a znovu nad nimi spočítat
hlasitosti, případně korelaci. Původní korelaci samotnými archivovanými nástroji bez
chybějících surových dat zpětně obnovit nelze.
