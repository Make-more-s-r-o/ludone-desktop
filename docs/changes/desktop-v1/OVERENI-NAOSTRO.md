# Co ověřit naostro — 15 minut na Macu

Aplikace má **504 zelených testů**, ale skoro nic z toho není ✅ **ověřeno naostro**.
V LuDone to znamená jediné: **člověk to viděl běžet.** Tenhle soupis je ta cesta —
každý bod říká, co udělat a **co má vyjít**.

🔴 Body 1 a 2 jsou nejcennější: obojí je vada, která se **neprojeví chybou**, jen tichem.
Přesně na téhle třídě už tenhle modul dvakrát pohořel.

Spuštění: `npm start`

---

## 1. 🔴 Slyšet obě strany — nejdražší vada modulu

Nahrávání systémového zvuku bylo měsíce rozbité a **aplikace mlčky ukládala ticho**.

1. Pusť si v prohlížeči libovolné video se zvukem.
2. V panelu **Nahrát**, mluv do mikrofonu a nech video hrát ~20 s.
3. **Ukončit a uložit**, schůzku pojmenuj.
4. Otevři soubor ze **Stažených** v přehrávači, který umí kanály.

**Má vyjít:** jeden `.webm`, **vlevo tvůj hlas, vpravo zvuk z videa**. Když je jeden kanál
ticho, je to ta vada — a je vidět jen takhle, testy ji nechytí.

## 2. 🔴 Výpadek ostatního zvuku se ohlásí

Během nahrávání **odpoj sluchátka** (nebo přepni výstup).

**Má vyjít:** panel do dvou sekund ukáže, že se druhá strana nenahrává, a **nahrávání
pokračuje dál**. Když panel mlčí, je to táž vada jako v bodě 1. Když se nahrávání zastaví,
je to vada opačná — přijít o polovinu zvuku je lepší než o celou schůzku.

## 3. Hláška při plné liště

Nech si lištu zaplněnou jako včera a spusť aplikaci.

**Má vyjít:** okno „LuDone běží", které vysvětlí, že se ikona nevešla. **A hlavně:** když
lišta plná NENÍ, **žádné okno se objevit nesmí** — falešné varování je horší než mlčení.

## 4. Nastavení ukazuje tvůj účet

Panel → **Nastavení**.

**Má vyjít:** tvoje jméno nebo e-mail. **Nikdy „Daniel Novák"** — to byla atrapa, dnes
odstraněná; kdyby se objevila, něco se vrátilo. Když nejsi přihlášený, musí být vidět
nepřipojený stav, ne „Připojeno".

## 5. Onboarding — test záznamu

Smaž onboarding (`LUDONE_RESET_ONBOARDING=1 npm start`) a projdi ho.

**Má vyjít:** krok „Test záznamu" se **dvěma živými měřáky** — mikrofon a systémový zvuk
zvlášť. Mluv → hýbe se levý; pusť zvuk → pravý. **Pokračovat se odemkne až když se hýbou oba.**
Cesta ven „Pokračovat bez testu" musí být dostupná — a „Hotovo" pak **nesmí tvrdit**,
že se oba kanály ověřily.

## 6. Kontextové menu a písmo

Pravý klik na ikonu → menu. Levý klik → panel (obojí musí fungovat).

**Má vyjít:** text panelu v **Instrument Sans / Public Sans**, ne v systémovém písmu.
Poznáš to podle diakritiky — háčky a čárky musí vypadat stejně jako zbytek písma, ne
„vypůjčeně" z jiného řezu.

---

## Co ověřit NELZE, dokud nebude Apple Developer

Automatické aktualizace a trvalá oprávnění po aktualizaci. Bez podpisu to nejde
z principu, ne kvůli nedodělku — viz `DAN-TODO.md`, blocker B1.
