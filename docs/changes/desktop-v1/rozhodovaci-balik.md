# Rozhodovací balík — LuDone Desktop v1

**Deset otázek, jeden průchod.** U každé je první uvedený doporučený default — když ho přijmeš,
stačí říct „beru defaulty" a běh pokračuje. Rozhodnutí zapíšu do `decisions.md` a propíšu
do `spec.md`.

**Jak číst značky:** 🔴 **blokuje** = bez odpovědi se nedá napsat spec nebo začít etapu ·
🟡 **odložitelné** = default drží obě budoucnosti otevřené a běh jede dál.

---

## A. Peníze a právo

### A1 · Kdy smí vzniknout první ostrá nahrávka? 🔴 blokuje první použití

**Doporučeno: až po sepsání souhlasu účastníků a retenční lhůty; do té doby jen tvoje vlastní
testovací nahrávky.**

Nahrávky obsahují hlasy lidí, kteří o aplikaci nevědí, včetně lidí mimo firmu. Jakmile jednou
vzniknou, mažou se hůř, než by nevznikaly.

*Trade-off:* zdrží první ostré použití o hodinu tvého času. Opačná volba znamená mít na disku
záznamy třetích stran bez jakéhokoli rámce.

*Dopad na DAG:* neblokuje vývoj ani měření A6. Blokuje **E9 (přepis)** a rozvoz týmu.

---

### A2 · Kupovat Apple Developer Program (99 $/rok)? 🔴 blokuje rozvoz

**Doporučeno: NE, dokud neproběhne párový experiment P1/P2.**

Bez certifikátu projde každý příjemce šestikrokovým dialogem v Nastavení systému a automatické
aktualizace nefungují rozumně. Ale zatím není změřeno, jestli přepodepsání zachová udělená
oprávnění — a to je jediný důvod, proč certifikát kupovat.

*Trade-off:* bez něj nejde rozvézt aplikaci týmu ani slíbit „po aktualizaci zůstaneš přihlášený".
S ním platíš za něco, co možná nepotřebuješ.

*Dopad na DAG:* blokuje **E10**. Nic dřívějšího.

---

### A3 · Potvrdit `gemini-3.5-transcribe` jako přepisovač? 🟡 odložitelné

**Doporučeno: ano jako volbu poskytovatele, ale podmíněně — po jednom ostrém testu na tvé české
hodinovce, cena pod 10 $.**

Vyšel 26. 8., stojí 0,60 $ za hodinu schůzky (dvě stopy), LuDone už Gemini API volá jinde.
🔴 **Kvalita češtiny je ale neměřená** — Google publikuje průměry přes „top locales" bez češtiny
a Vertex ji značí „Experimental", zatímco polština i ukrajinština jsou „Supported".

*Trade-off:* přijmout bez testu znamená postavit E9 na marketingu. Test stojí půl dne a pod 10 $.

*Dopad na DAG:* blokuje **E9**, nic jiného. Cena mezi kandidáty se liší o méně než 20 $/měsíc,
takže rozhoduje přesnost, ne peníze.

---

## B. Data, práva a retence

### B1 · Kdo vidí čí nahrávky? 🔴 blokuje serverový kontrakt

**Doporučeno: vidí je vlastník a lidé se stejným company scope jako projekt, ke kterému nahrávka
patří. Ne „všichni všechno".**

Rozhodnutí A7 říká „archiv pohromadě pro celý tým" — ale doslovně vzato by to znamenalo, že
každý slyší každou schůzku, včetně mzdových jednání a hovorů s klienty jiné firmy.

*Trade-off:* užší viditelnost znamená víc práce na serveru a občasné „proč to nevidím".
Širší znamená, že první citlivá schůzka bude průšvih, který nejde vzít zpět.

*Dopad na DAG:* blokuje **E5 (serverový příjem)** — RBAC se musí navrhnout s ním, ne po něm.

---

### B2 · Co se stane s nahrávkami, když někdo odejde z firmy? 🔴 blokuje spec

**Doporučeno: server data zachová a odepře přístup; desktop při odepření přístupu přestane
odesílat a lokální soubory ponechá, ale přestane je nabízet — smazání je vědomý krok správce.**

Server dnes na odebraný přístup vrací 403 a data si nechá. Desktop pro to nemá pravidlo vůbec —
takže na notebooku bývalého kolegy zůstane firemní zvuk a nikdo neví, že tam je.

*Trade-off:* automatické mazání by mohlo zničit důkazy, které ještě někdo potřebuje. Nechat to
bez pravidla znamená nevědět, kde firemní nahrávky jsou.

*Dopad na DAG:* blokuje **E6 (fronta a přihlášení)** — chování při 403 je součást fronty.

---

### B3 · Jak dlouho zůstávají nahrávky na disku po odeslání? 🟡 odložitelné

**Doporučeno: 7 dní, pak se lokální kopie smaže sama; nastavitelné, s možností „nemazat".**

Hodinová schůzka ve dvou stopách je zhruba 80 MB. Bez retence se disk zaplní a plný disk umí
zabít probíhající nahrávání.

*Trade-off:* kratší lhůta šetří disk, ale po výpadku serveru nemusí být z čeho obnovit.

*Dopad na DAG:* patří do **Nastavení**, neblokuje nic. Default lze změnit kdykoli.

---

### B4 · Přesunout pravidla časovače do databáze, než se desktop připojí? 🟡 odložitelné

**Doporučeno: NE teď. Místo toho spec výslovně popíše, jak se desktop zachová, když pravidla
poruší jiný klient.**

Dnes „jeden běžící časovač na člověka" a „záznamy se nesmí překrývat" nehlídá databáze, ale
klient — mezi kontrolou a zápisem je mezera. Desktop by byl třetí klient v témže závodě.

*Trade-off:* přidat do databáze unikátní index a zákaz překryvů je zásah do ostrého provozu
24 lidí. Nedělat to znamená, že tichá díra zůstane otevřená právě tam, kde jde o peníze.

*Dopad na DAG:* neblokuje — desktop zatím nikam nepíše (tvoje rozhodnutí N1). Blokovalo by to
až skutečné napojení.

---

## C. Produkt a chování

### C1 · Zastaví se časovač, když skončí nahrávání? 🔴 blokuje spec

**Doporučeno: NE. Po zastavení nahrávky se jen nabídne „Zastavit i měření času?" a nabídka zmizí
sama.**

Schůzka končí, práce na projektu často ne. Automatické zastavení by lidem ukrajovalo vykázaný čas
a všimli by si toho až v pátek.

*Trade-off:* nabídka je jeden klik navíc. Automatika je pohodlnější, ale tichá — a tichá věc,
která ubírá vykázané hodiny, je horší než klik.

*Dopad na DAG:* blokuje **spec panelu** — je to chování na hranici obou agend.

---

### C2 · Vlastní vypínač pro časovou agendu, oddělený od nahrávání? 🔴 blokuje spec

**Doporučeno: ano, dva samostatné.**

Nahrávání je experiment blokovaný nerozhodnutým právním rámcem (A1). LuTrack je ostrý provoz
celého týmu. Jeden společný přepínač by je spojil — a vypnutí experimentu by zastavilo výkazy
hodin.

*Trade-off:* dva přepínače místo jednoho, tedy o jeden víc na zapamatování.

*Dopad na DAG:* blokuje **E6** a všechno kolem fronty.

---

### C3 · Zůstane LuTrack samostatnou aplikací, nebo se přestěhuje do `ludone-app`? 🟡 odložitelné

**Doporučeno: nerozhodovat teď. Desktop jde přes adaptér, takže obě budoucnosti zůstanou otevřené.**

Tohle je tvoje odložené rozhodnutí M11 a default ho drží otevřené záměrně — adaptér stojí pár
hodin práce navíc a ušetří přepis, ať dopadne cokoli.

*Trade-off:* adaptér je vrstva navíc. Bez něj by jedna z tvých dvou budoucností znamenala přepsat
celou časovou agendu.

*Dopad na DAG:* neblokuje. Ovlivní až etapu skutečného napojení.

---

## Co NENÍ v balíku, protože jsem to rozhodl sám

Masterplán §4 velí technické rozhodnutí s bezpečným defaultem udělat a zapsat. Tato jsou
v `decisions.md`:

- serverový kontrakt `/api/desktop/recordings` (hotová fronta na něm stojí),
- **statická** registrace klienta místo dynamické (jediná odvolatelná jedním UPDATE),
- přejmenování běhových čísel na `B1–B8`,
- neplatit GitHub Pro ani nezveřejňovat repozitář.

Když s kterýmkoli nesouhlasíš, řekni — je to zápis, ne beton.

---

## Co po odpovědích udělám

1. Zapíšu rozhodnutí do `decisions.md` a propíšu je do `spec.md`.
2. Dokončím `spec.md`, `plan.md` a task DAG s Feature ID.
3. Připravím task packety pro noční běh — Codex staví v izolovaných Orca worktrees, Claude čte
   diff, pouští brány a drží architekturu, RBAC a money.
4. **Nic nejde na produkci** bez tvého finálního schválení.
