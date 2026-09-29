# Přejímka LuDone Desktop 0.1.6 na Macu

**Stav:** 🟡 čeká na vydání a skutečné měření člověkem. Čas: přibližně 10 minut. Nepotřebuješ živý hovor; pro zvuk stačí vlastní hlas a krátké video přehrané na Macu.

1. Po oznámení vydání aktualizuj aplikaci přes proužek **Aktualizovat**. Otevři ji z Finderu; v Nastavení zkontroluj verzi **0.1.6**. Samotný HTML prototyp není aplikace.
2. Z lišty otevři **Teď → Můj den → Nastavení → Teď**. Porovnej rozložení s Astrou: společná horní navigace, stopa dne, detail nahrávky, nastavení účtu a zdrojů. Zkus světlé a tmavé téma. LuTrack ukazuje **Připravujeme**, nejde spustit a nezobrazuje naměřené minuty.
3. V Nastavení ověř přihlášení a vyber správnou firmu. Při přihlášení se otevře obvyklý webový postup; do chatu neposílej token ani heslo. Pokud macOS požádá o mikrofon či záznam systémového zvuku, oprávnění povol podle běžného dialogu.
4. Spusť asi 20 sekund nahrávání. Řekni několik slov a zároveň přehraj video se zvukem. Zastav a zvol **Nechat na Macu**. V Můj den otevři detail a **Ukázat ve Finderu**. Přehraj výsledný stereo soubor: hlas i video musí být slyšet; vzniká jeden výsledný záznam schůzky.
5. Aplikaci úplně ukonči a znovu otevři z Finderu. Nahrávka musí zůstat v Můj den jako místní. Samovolně se nesmí odeslat.
6. V jejím detailu zvol odeslání. Počkej na dokončení fronty, pak **Ověřit v LuDone** a otevři nahrávku na webu. Musí tam být jeden záznam, se správnou firmou a slyšitelnými oběma zdroji. Teprve serverové ověření smí změnit označení na ověřenou nahrávku.
7. Při dalším krátkém záznamu dočasně vypni Wi‑Fi. Nahrávání musí pokračovat místně, fronta nesmí tvrdit dokončený upload. Znovu připoj síť a podle zobrazeného stavu obnov odeslání. Přihlášení nebo limit musí mít čitelný důvod a další krok; testovací data nemaž, dokud není výsledek ověřený.
8. V Nastavení zkontroluj aktualizace. Je-li dostupná další podepsaná verze, upozornění má přijít proužkem a nejvýš jednou oznámením macOS pro danou verzi. Instalace začne až po tvém kliknutí a po dokončení nahrávání/uložení; lze ji odložit. Na aktuální verzi lze ověřit kontrolu feedu, samotnou budoucí instalaci až s další verzí.

Pošli jen verzi, body které prošly/neprošly a případný screenshot chyby. Tím doplníme ✅ ověřeno naostro. Automatická E2E s fixturami má pouze stav 🧪 a tuto přejímku nenahrazuje.

Pro vývojářský ruční checkpoint v desktopovém repozitáři jsou zachovány `node scripts/ui-smoke.mjs` a `npm run test:audio`; spouští je člověk s GUI a oprávněním Záznam obrazovky. Výpis i exit kód uloží do důkazů. Běžný uživatel pro kroky výše terminál nepotřebuje.
