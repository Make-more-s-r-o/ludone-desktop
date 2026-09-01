# B10 — sdílené zařízení: návrh k rozhodnutí

**Napsal koordinátor nočního běhu 2. 9. 2026 v 01:05.** `plan.md` §2 dává B10 tvar
**„Claude návrh, Codex stavba"** — tohle je ta první půlka. **Stavba dnes v noci neproběhla**
a níž je napsané proč.

🔴 **Tenhle dokument nic nerozhoduje.** Přiřazení nahrávky člověku je RBAC pravidlo, tedy
hard gate. Rozhoduje Dan.

---

## Problém jednou větou

V zasedačce stojí Mac, na kterém je přihlášený **jeden** účet `zasedacka@makemore.cz`, ale
nahrávky na něm pořizuje **kdokoli, kdo přijde**. Token je jeden, lidí je mnoho — takže
otázka „čí je tahle nahrávka" nemá z přihlášení odpověď.

Rozhodnutí **B1** říká, že sdílené zařízení **je v rozsahu v1**, a rozhodnutí **B1** zároveň
říká, že *„každý vidí jen svoje, admin vše"*. Ty dvě věty se na sdíleném zařízení potkávají
a někdo musí říct, co „svoje" znamená.

## 🔴 Premisa, kterou NIKDO neověřil

Skeptik packetu to přiznává jako první položku svého seznamu:

> *„Zda účet `zasedacka@makemore.cz` existuje v Google Workspace nebo v LuDone a jak se chová —
> neotevřel jsem žádný živý systém, jen repozitář."*

**Celá story stojí na účtu, o kterém nikdo neví, jestli existuje.** To je důvod, proč se dnes
v noci nestavěla, i kdyby bylo rozhodnuto všechno ostatní.

**Ověřit se to dá jedním dotazem** — jestli ten účet v Google Workspace je, kdo k němu má
heslo a jestli se s ním jde přihlásit do LuDone.

---

## Otázka D-B10/1 — jak zařízení pozná, že je sdílené?

| varianta | jak to funguje | pro | proti |
|---|---|---|---|
| **A. Podle účtu** | seznam sdílených účtů, `zasedacka@` je na něm | nic navíc se nenastavuje | seznam musí být někde udržovaný; nový sdílený Mac = změna kódu nebo konfigurace |
| **B. Podle serveru** ⭐ | server u identity vrací příznak „tenhle účet je sdílený" | jedno místo pravdy, admin to změní bez releasu | **potřebuje serverovou práci (S1, jiný repozitář)** |
| **C. Podle lokálního nastavení** | při prvním spuštění se Mac označí | funguje bez serveru | označí ho ten, kdo instaluje — a když to neudělá, chová se osobní Mac jako sdílený nebo naopak |

**Doporučuju B**, s **fail-closed přemostěním do doby, než server bude**: dokud příznak nepřijde,
**chová se zařízení jako SDÍLENÉ**. Packet to tak už navrhuje a je to správně — z těch dvou
omylů je bezpečnější ten, kdy se aplikace zeptá „čí to bylo" na osobním Macu, než ten, kdy
tiše přiřkne cizí nahrávku majiteli zasedačky.

## Otázka D-B10/2 — čím se určí, komu nahrávka patří?

Packet navrhuje **volný text**: po zastavení se objeví pole *„Čí to bylo?"*.

| varianta | pro | proti |
|---|---|---|
| **A. Volný text** (návrh packetu) | funguje bez serveru, nikoho nezdrží | „Petr", „petr", „P.N." jsou tři různí lidé; nedá se z toho nic spolehlivě vykázat |
| **B. Výběr ze seznamu lidí** | jednoznačné, dá se na tom stavět | potřebuje seznam z serveru (S1) |
| **C. Přihlásit se na okamžik** | nejpřesnější, sedí to s RBAC | v zasedačce před schůzkou se nikdo přihlašovat nebude — a když ano, je to jiná story |

**Doporučuju A pro v1, ale s vědomím, že je to ŠTÍTEK, ne identita.** Musí to být napsané
i v kódu: pole se nesmí jmenovat `userId` ani `owner`, protože to není. Návrh packetu používá
`attributedTo` — to je dobrý název, protože nic neslibuje.

🔴 **A z toho plyne důsledek, který patří do rozhodnutí:** dokud je přiřazení volný text,
**nesmí na něm viset nic, co rozhoduje o přístupu k datům**. Kdo nahrávku uvidí, se musí řídit
účtem, ne tím štítkem.

## Otázka D-B10/3 — co když člověk neodpoví?

Tady packet **našel skutečnou past v kódu** a stojí za to ji ocenit:

`finalizeRecordingSession` (`main.cjs:581–647`) zapíše finální manifest a **hned nato session
smaže**. Druhý zápis neexistuje. ⇒ **Odpověď musí dorazit PŘED uložením, jinak se do manifestu
nedostane nikdy.** Mezi „Zastavit" a uložením tedy vzniká okno, ve kterém může někdo panel
zavřít a odejít.

**Návrh packetu:** prázdná odpověď uložení **nikdy neblokuje**; po 30 s bez odpovědi se uloží
s `null`. **Souhlasím a doporučuju to přijmout.** Nahrávka, která se neuloží, protože se nikdo
nepodepsal, je horší než nahrávka bez podpisu.

## Otázka D-B10/4 — co s frontou, když se u Macu vystřídají lidé?

Návrh: odesílají se **jen položky přihlášené identity**, a patička to řekne otevřeně —
*„3 čekají · 1 patří jinému účtu"*.

**Doporučuju přijmout.** Klíčové je to druhé číslo: **cizí položka nesmí tiše zmizet**. Když
zmizí bez zmínky, člověk si myslí, že se nahrávka odeslala, a ona leží na disku.

---

## Co se dnes v noci NEUDĚLALO a proč

| | |
|---|---|
| **Stavba B10** | přiřazení nahrávky člověku je **RBAC**, tedy hard gate — a navíc stojí na neověřené premise o účtu `zasedacka@` |
| **Rozhodnutí D-B10/1 až /4** | jsou to product a RBAC volby, ne technické detaily |

**Běh se kvůli tomu nezastavil** — přeskočil se jen tenhle task, jak velí Danův pokyn.

## Co potřebuju od Dana, seřazeno podle toho, co blokuje dřív

1. **Existuje `zasedacka@makemore.cz`?** Bez toho nemá smysl řešit zbytek.
2. **D-B10/2 — volný text, nebo výběr ze seznamu?** Určuje, jestli B10 jde postavit bez serveru.
3. **D-B10/1 — odkud se pozná sdílené zařízení?** Varianta B čeká na S1.
4. D-B10/3 a /4 — u obou mám doporučení a **není mezi nimi spor**, takže stačí „beru".

## Až se to rozhodne

Packet [`tasks/B10-sdilene-zarizeni.md`](tasks/B10-sdilene-zarizeni.md) je hotový a má TDD kroky
i sabotáže. **Jeho §5 je ale psané pro variantu „volný text" a fail-closed profil** — jiné
rozhodnutí znamená packet přepsat, ne jen doimplementovat.
