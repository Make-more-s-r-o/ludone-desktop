# Etapa E1r — opravit, co našlo nezávislé review, a podepřít pravdivý závěr správným důkazem

Worktree: **`/Users/dan/orca/workspaces/ludone-desktop/e1r-dukazy`**, větev `orca/e1r-dukazy`.
🔴 Na začátku si ověř `pwd`. Když nesedí, přepni se — cesta je absolutní schválně.
Píšeš **česky**. **NECOMMITUJEŠ** (commit dělá orchestrátor).

## 1. Co se staví

Dvě věci naráz, protože sahají na tytéž soubory:
1. **Sedm nálezů z nezávislého review** etapy E1 se opraví — hlavně **fail-open brána**.
2. Řádky **B1** a **B5** v `ROZHODNUTI.md` přestanou svůj závěr dokazovat **poměrem
   velikostí souborů** a začnou ho dokazovat měřením, které původ zvuku opravdu rozliší.

## 2. Proč

**K bodu 1:** `scripts/akceptace/E1.sh` je dnes **fail-open** — tři kontroly mají tvar
`bash -c '! grep -Fq "…" ROZHODNUTI.md'`. Když soubor **neexistuje**, `grep` vrátí 2,
negace z toho udělá 0 a kontrola **projde**. Doloženo naostro:
`bash -c '! grep -Fq "18–30" NEEXISTUJE.md'` → `$? = 0`. Brána, která projde nad
smazaným souborem, neměří nic.

**K bodu 2:** závěr „systémový zvuk se opravdu zachytává" **je pravdivý**, ale argument
pod ním neplatí. B1 dnes tvrdí *„ticho 996 B × se zvukem 43 339 B"*, B5 *„systém 1 351 B →
27 993 B (20,7×), potvrzeno i FFmpegem (−91 dB → −20 dB)"*.
🔴 **Poměr velikostí nerozliší, ODKUD zvuk přišel.** Opus s DTX smrskne ticho na
osmibajtové pakety, takže stopu nafoukne **jakýkoli** zvuk — včetně přeslechu
z reproduktorů do mikrofonu. Kdo to bude po nás číst, tu argumentaci shodí a bude mít pravdu.

## 3. Soubory, které VLASTNÍŠ

SMÍŠ MĚNIT (a jen tyhle):
```
ROZHODNUTI.md                          (řádky B1 a B5)
AGENTS.md                              (jen sjednocení značek, viz nález 5)
PLAN.md                                (JEN označit rozpor, viz nález 2 — NIC jiného)
DAN-TODO.md                            (přidat položku pro Dana, viz nález 2)
dukazy/zvuk-2026-08-20/README.md       (nový)
dukazy/zvuk-2026-08-20/NALEZ.md        (jen varovný blok na začátku, viz nález 6)
scripts/akceptace/E1.sh                (opravy bran)
```

NESMÍŠ MĚNIT — ani o řádek:
```
dukazy/zvuk-2026-08-20/NALEZ-OPAKOVANI.md      ← historický nález, nepřepisuje se
dukazy/zvuk-2026-08-20/nastroje/**             ← archiv, napsal ho orchestrátor
dukazy/nahravani-2026-08-21/**                 ← archiv, napsal ho orchestrátor
electron/**   src/**   scripts/akceptace/E2.sh   scripts/akceptace/E8.sh
docs/**   specs/**   .github/**   package.json   package-lock.json
design/                                        ← CIZÍ netrackovaná práce, nesahat
jakýkoli .js .jsx .cjs .mjs
```
Když v pracovním stromě najdeš změny mimo svůj výčet, **NECH JE BÝT** a zapiš je do `notes`.

## 4. Pořadí kroků

🔴 **Nejdřív soubory na disk, pak kontroly, teprve potom odpověď.**
JSON na konci je hlášení o práci, která na disku UŽ JE — ne plán.

**🔴 PROSTŘEDÍ:**
- **Nemáš síť.** `curl` skončí kódem 6 (DNS). Nic proti živé službě neověřuj — když něco
  ověřit nejde, **označ to za nedoložené a datuj starším měřením**. To je správné chování,
  ne selhání.
- macOS **nemá `timeout`** — nepoužívej ho nikde, vrací `EXIT=127`.
- Žádný příkaz nesmí čekat na vstup: `git --no-pager …`, `GIT_PAGER=cat`, `PAGER=cat`.

### Krok 1 — oprava brány `scripts/akceptace/E1.sh` (nálezy 1, 3, 4)

**Nález 1 (P1, fail-open).** Tři kontroly „soubor NEOBSAHUJE řetězec" musí nejdřív ověřit,
že **soubor existuje a není prázdný**, a teprve pak hledat. Tvar, který funguje:
```bash
neobsahuje() {            # neobsahuje <soubor> <řetězec>
  test -s "$1" || return 1          # neexistuje/prázdný ⇒ SELHÁNÍ, ne úspěch
  ! grep -Fq "$2" "$1"
}
```
🔴 Po opravě si to **sám ověř oběma směry** a doslovný výpis dej do `dukaz`:
- nad skutečným souborem musí kontrola **projít**,
- nad neexistujícím souborem musí **spadnout** (dnes prochází).

**Nález 3 (P2).** `test -f` u archivovaných souborů → **`test -s`** (projde i nad prázdným).

**Nález 4 (P2).** Kontrola „aspoň 40 řádků" projde i nad 40 **prázdnými** řádky.
Počítej **neprázdné**: `awk 'NF { n++ } END { exit !(n >= 40) }' <soubor>`.
(Etapa E8 to má přesně takhle — koukni do `scripts/akceptace/E8.sh` a udělej to stejně,
ať se brány v repu neliší stylem. Ten soubor **jen čteš**, neměníš.)

**Nález 6** přidá do brány ještě jednu kontrolu, viz krok 3.

### Krok 2 — B1 a B5 dostanou důkaz, který obstojí (nález 7 = E1c)

V obou řádcích nahraď argument poměrem velikostí těmito **naměřenými** hodnotami.
Poměr bajtů smíš nechat nanejvýš jako doplněk, **ne jako hlavní důkaz**:

- 🔴 **Mikrofon byl SE ZVUKEM tišší než v tichu** — `max_volume` **−46,0 dB** se zvukem
  proti **−44,2 dB** v tichu. To je nejsilnější část důkazu, protože **přeslech by se
  choval přesně opačně**: kdyby zvuk pronikal z reproduktoru do mikrofonu, mikrofon by byl
  hlasitější, ne tišší.
- Totéž potvrzuje i průměr: `mean_volume` **−59,0 dB** se zvukem proti **−58,2 dB** v tichu.
- 🔴 **Napiš výslovně, že −44,2 a −46,0 dB jsou `max_volume`, ne průměr.** Jinde v repu to
  uvedené není a kdo to bude ověřovat přes `mean_volume`, naměří −58,2 a −59,0 a bude si
  myslet, že čísla nesedí.
- Systémová stopa v tichu je na **přesné digitální nule −91,0 dB**, kterou žádný analogový
  vstup nevyrobí; se zvukem −20,0 dB.
- Reprodukováno v **5 bězích**, na Electronu **37 i 43**.
- 🔴 **Křížovou korelaci (0,9638 / 0,0098) smíš zmínit, ale MUSÍŠ u ní napsat, že ji dnes
  nic v repu nereprodukuje** — surová data z toho měření se nedochovala (ověřeno
  orchestrátorem 25. 8.: adresář `nahravky/` ve worktree `zvuk` byl prázdný). Datuj ji
  k měření 20.–21. 8. 2026. Hlavní důkaz musí stát na hodnotách výš, ne na ní.

**Odkud ta čísla jsou:** všechna kromě korelace jsou v repu a jdou přepočítat —
`dukazy/nahravani-2026-08-21/` a jeho `README.md`. **Odkazuj na tu cestu**, ať čtenář ví,
kde si to ověří.

**A ještě jedna změna v B1:** dnes končí sloupcem *„Nic. Otázka je uzavřená."* To
přestřeluje — **A6 (Google Meet) je vyřazovací kritérium a netestoval se**; testoval se
`afplay`. Přepni B1 z ✅ na 🟡 a do posledního sloupce napiš, co konkrétně zbývá.

### Krok 3 — `dukazy/zvuk-2026-08-20/README.md` a varování v `NALEZ.md` (nález 6)

**Nález 6 (P2, věcně nejdůležitější):** varovný blok v archivovaném `NALEZ.md` cituje
korelaci **0,9638 / 0,0098** a odkazuje na `NALEZ-OPAKOVANI.md` — jenže **ten soubor ta
čísla vůbec neobsahuje** (ověř si `grep -c`). Čtenář tedy nemá jak varování ověřit.

Napiš **`dukazy/zvuk-2026-08-20/README.md`**, který:
- řekne, co v adresáři je a v jakém pořadí se to má číst (`NALEZ.md` = původní závěr,
  `NALEZ-OPAKOVANI.md` = o den pozdější vyvrácení, `nastroje/` = čím se měřilo),
- 🔴 **jmenovitě řekne, že korelační čísla nejsou v tomhle adresáři doložená** a odkáže na
  `dukazy/nahravani-2026-08-21/`, kde reprodukovatelný důkaz **je**,
- popíše, jak se dá měření zopakovat (nástroje jsou v `nastroje/`, ale surová data chybí).

Ve varovném bloku v `NALEZ.md` **oprav odkaz** tak, aby nesliboval víc, než je uvnitř:
korelaci označ za nedoloženou a pošli čtenáře na archiv z 21. 8. **Nic jiného v `NALEZ.md`
neměň** — historie se doplňuje, nepřepisuje.

Do `scripts/akceptace/E1.sh` přidej kontrolu, že `README.md` v tom adresáři **existuje,
je neprázdný a odkazuje na `nahravani-2026-08-21`**.

### Krok 4 — rozpor v `PLAN.md` (nález 2) 🛑 NEROZHODUJ ZA DANA

`PLAN.md` má **dva různé odhady téže věci**: ř. 60 říká desktop **12,5–20 ČD**, ř. 192
říká **14,5–23,5 ČD**. Čísla si ověř `grep -n`, protože se mohla posunout.

🔴 **Nevybírej, který platí** — to je Danovo rozhodnutí, ne tvoje. Udělej tohle:
- k **oběma** místům přidej jednu viditelnou větu, že si odhady odporují a který druhý
  řádek to je (např. `⚠️ Rozpor: ř. 192 uvádí 14,5–23,5 ČD. Platný odhad zvolí Dan.`),
- do `DAN-TODO.md` přidej položku „PLAN.md má dva různé odhady desktopu — rozhodni, který
  platí" s oběma čísly a čísly řádků,
- 🔴 **žádné číslo neměň ani nemaž.**

### Krok 5 — značky v `AGENTS.md` (nález 5)

`AGENTS.md` zavádí tři značky (✅ ověřeno naostro · 🧪 zelené testy · ⛔ neověřeno), ale
zdroje pravdy v repu používají i **🟡** a **⚠️**. Doplň do `AGENTS.md` i tyhle dvě
s jednoznačným významem, ať se dá tabulka použít beze zbytku. **Nepřepisuj význam těch tří
původních** a nesahej na zbytek souboru.

## 5. Jak to otestuješ

```bash
bash scripts/akceptace/E1.sh > /tmp/e1.out 2>&1; echo "EXIT=$?"; cat /tmp/e1.out
# fail-open musí být pryč — obojí spusť a obojí dej do dukazu:
cp ROZHODNUTI.md /tmp/z.md; ( cd /tmp && bash -c 'test -s NENI.md || exit 1; ! grep -Fq "x" NENI.md' ); echo "nad neexistujicim: $? (musi byt 1)"
grep -c "0,9638" dukazy/zvuk-2026-08-20/NALEZ-OPAKOVANI.md   # doklad k nálezu 6
grep -n "12,5\|14,5" PLAN.md                                  # doklad k nálezu 2
```
🔴 Exit kód měř **před rourou** (`cmd > /tmp/out 2>&1; echo $?`), ne za `| tail`.

## 6. Důkaz hotovosti

`bash scripts/akceptace/E1.sh` vrátí **0** a 0× FAIL, a **navíc** doložíš, že opravená
kontrola nad **neexistujícím** souborem vrací **1**.
Před odpovědí spusť `git --no-pager status --porcelain`. Když tam tvoje soubory nejsou,
**nejsi hotový a nesmíš odpovídat**.

## 7. Co NESMÍŠ

- rozhodnout za Dana, který odhad v `PLAN.md` platí
- přepsat historii v `NALEZ.md` / `NALEZ-OPAKOVANI.md` (doplňuje se, nemaže)
- tvrdit, že korelace je doložená, když surová data nejsou v repu
- přidat si výjimku z brány (`*-exempt`, `skip`, baseline) — když si myslíš, že je
  namístě, napiš KTEROU a PROČ do `notes` a nech rozhodnutí na orchestrátorovi
- oslabit kontrolu, aby brána prošla
- spouštět cokoli, co čeká na vstup
- commitovat, pushovat, mergovat

## 8. Když si zadání odporuje se stavem repa

Neřeš to domyšlením. Udělej **nejmenší bezpečnou variantu** a rozpor zapiš do `notes`.
Počty a čísla řádků ber jako **orientační** — když naměříš jiné, řiď se **MĚŘENÍM**.

## 9. Output contract

Na konci odpovědi vrať JSON:
```json
{
  "summary": "<co jsi udělal>",
  "premisaPlatila": true,
  "ocekavanePocty": {
    "opravenychNalezu": 0,
    "novychSouboru": 0,
    "kontrolVBraneE1": 0,
    "korelaceVNalezOpakovani": 0,
    "zmenenychCiselVPlanMd": 0,
    "zmenenychSouboruMimoVlastnictvi": 0
  },
  "dukaz": "<DOSLOVNÝ výpis E1.sh včetně EXIT= a důkaz, že fail-open je pryč>",
  "commitMessage": "<anglicky, imperativ>",
  "notes": ["<rozpory, co jsi nechal být, co nešlo ověřit>"]
}
```
🔴 `opravenychNalezu` musí být **> 0** (nula znamená, že se nestalo nic) ·
🔴 `korelaceVNalezOpakovani` a `zmenenychCiselVPlanMd` musí být **0** — spočítej si je,
neodhaduj · `kontrolVBraneE1` odečti ze skutečného běhu.
