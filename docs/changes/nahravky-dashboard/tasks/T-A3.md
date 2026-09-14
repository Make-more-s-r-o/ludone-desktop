# Zadání T-A3 — bezpečný základ výběru upload firmy

Pracuješ ve worktree {{WORKTREE}}. Na začátku spusť `pwd` a ověř přidělený strom.

Plan ID `nahravky-dashboard`; feature `NRD-07`; zdrojový commit `1fa7311`. Závislost T-A2 je přijatá. T-A3 připravuje samostatný controller, komponentu a bezpečný zápis relace. Main/preload/Settings/queue se zapojí až samostatným navazujícím taskem po T-05. T5 do těchto nových souborů ani auth.cjs nezapisuje.

## Mantinely

- Pouze desktop, mock HTTP a dočasná data. Žádný backend, LuTrack, design/, produkční účet, síť naostro, GUI ani audio smoke.
- **NEDĚLEJ ŽÁDNOU ZÁPISOVOU GIT OPERACI** (`add`, `commit`, `checkout`, `fetch`, `merge`, `rebase`, `stash`, `push`, `reset`, `tag`, `branch`, `cherry-pick`, `revert`, `clean`, `switch`, `restore`); jediný povolený Git příkaz je závěrečný read-only self-check uvedený v postupu.
- Žádný příkaz nesmí čekat na vstup ani na `stdin`; nastav `GIT_PAGER=cat`, `PAGER=cat` a vstup přesměruj z `/dev/null`, když je to potřeba.
- **NIC NEINSTALUJ** a nespouštěj `npm install`, `npm ci` ani jiný správce balíčků v instalačním režimu.
- **NEVYRÁBĚJ VÝJIMKU Z BRÁNY**; nepřidávej exempt marker, skip, neoslabuj ani nemaž test a nezapisuj baseline místo opravy.
- **SMÍŠ MĚNIT VÝHRADNĚ** tyto soubory:
  - `electron/auth.cjs`
  - `electron/auth.test.cjs`
  - `electron/upload-company-selection.cjs`
  - `electron/upload-company-selection.test.cjs`
  - `src/components/UploadCompanySelector.jsx`
  - `src/components/UploadCompanySelector.test.jsx`
  - `tests/upload-company-selection.test.js`
  - `tests/upload-company-selector.test.js`
  - `tests/volba-firmy-v-relaci.test.js`
  - `docs/changes/nahravky-dashboard/evidence/tasks/T-A3.report.json`
  - `dukazy/nahravky-dashboard-2026-09-14/A3/typecheck.log`
  - `dukazy/nahravky-dashboard-2026-09-14/A3/gates.log`
  - `dukazy/nahravky-dashboard-2026-09-14/A3/sabotaz-owner.log`
  - `dukazy/nahravky-dashboard-2026-09-14/A3/sabotaz-offer.log`

- Hotspot `electron/auth.cjs` vlastní výhradně T-A3; měň jen atomický zápis/odstranění upload firmy a jeho guard. Login/refresh/logout nepřestavuj.
- Hotspot `electron/upload-company-selection.cjs` vlastní výhradně T-A3; nový controller je bez Electron importu a závislosti přijímá injekcí.
- Hotspot `src/components/UploadCompanySelector.jsx` vlastní výhradně T-A3; samostatná komponenta používá existující styl, ještě se nevkládá do Settings.
- Bez změny main/preload/queue/upload klienta. Commity a masterplan dělá root.

## Co si přečti jako první

1. AGENTS.md, rozhodnutí D15 a NRD-07 ve spec.md.
2. electron/companies.cjs, src/lib/upload-company.js a upload-company-resolution.js.
3. updateStoredAuthSessionCompany a withTokenStorageTransaction v electron/auth.cjs, tests/volba-firmy-v-relaci.test.js.
4. Existující Settings/Onboarding pouze jako styl a testovací vzor; nepřebírej jejich vlastnictví.

## Tělo zadání

### Atomický zápis stejné relace

Dnešní updateStoredAuthSessionCompany porovnává jen issuer/clientId/resource. Stejný DCR klient může přežít přihlášení jiného účtu. Zpevni CAS uvnitř existující token storage transakce: vedle těchto polí vyžaduj upload scope, shodnou skutečnou identitu a stejnou session. Konzervativní shoda access tokenu je přípustná: refresh během výběru bezpečně odmítne starý výběr a UI načte novou nabídku. Nepřestavuj auth coordinator jen kvůli tolerování takového závodu. Přidej volitelný synchronní guard generace/senderu od volajícího, zkontrolovaný uvnitř transakce těsně před persist; guard nesmí reentrantně načítat session ani čekat na tentýž zámek. Původní automatický výběr jediné firmy musí dál fungovat s platným čerstvým snapshotem.

Přidej úzkou možnost podmíněně smazat firmu pomocí explicitního null + expectedCompanyId. Smazání smí uspět jen pro stále stejnou relaci/identitu a přesně odmítnuté původní ID, nikdy nepřepíše mezitím novou volbu. Neplatný GUID a chybějící snapshot se odmítnou. Žádné tokeny nebo identity do rendereru/logu.

### Controller nabídky

Přidej createUploadCompanySelectionController se závislostmi readContext, isContextCurrent, fetchOffer, commitChoice, now a randomUUID; rozhraní load({requesterKey,guard}), select({requesterKey,offerToken,companyId,guard}), invalidate(). Context obsahuje platnou usable session, issuer/resource/upload scope, owner fingerprint a generation; raw session zůstává main-only. Po každém await znovu ověř current i sender guard.

load deleguje HTTP existující fetchCompanies cestě přes injektovaný fetchOffer (žádný druhý HTTP klient); omez request časem a abort signalem. Celou nabídku validuj: GUID, neprázdné omezené jméno, jedinečná ID, default jen v nabídce. Vadný payload není prázdná nabídka. Vrať jen bezpečné companies, selectedCompanyId a náhodný offerToken. Snapshot má TTL 60 sekund, nejvýše jeden na requester; je vázaný na issuer/owner/generation a requester. Nevytvářej historii. Po invalidate nesmí pending load nabídku znovu uložit.

select přijme pouze platné ID z daného platného snapshotu; před commit znovu načte skutečnou nabídku a odmítne odebranou firmu. Výběr je jednorázový, souběžné select nesmí oba commitnout. commitChoice musí použít výše zpevněný atomický helper a guard. Neúspěšný/odmítnutý commit není saved. Výběr nikdy nevybírá první firmu, nevolá pumpu ani nepřepisuje queue/consent.

### Samostatná komponenta

UploadCompanySelector přijímá authState a používá úzké API (navrhni a zdokumentuj přesné názvy list/select pro budoucí preload). Nabídku načítej pouze tlačítkem „Načíst firmy“ nebo „Změnit firmu“, bez GET při mountu/pollingu. Signed-out/expired nevolá síť. Stavy loading/error/no-company/ready/saving/saved jsou rozlišitelné; select bez uložené volby začíná placeholderem „Vyber firmu“, nikoli první položkou. Explicitní „Uložit firmu“ ukládá ID, ne název. Popisek vysvětlí, že výběr sám nic neodešle. Generation/ref chrání pozdní výsledky po auth změně/unmountu. HTML seznam vykreslí jen validované názvy, žádné raw chyby. Použij existující classes a přístupné labely; CSS není v allowlistu.

### Hranice navazujícího zapojení

T-A3 nemění klasifikaci company_out_of_scope ani serverová ID. Report předá přesné rozhraní a připomene, že navazující main wiring musí podmíněně vyčistit odmítnutou globální firmu. Jednotlivý retry po nové volbě může být povolen pouze bez jakéhokoli serverového ID/session; již inicializovaná nahrávka se nesmí tiše přesunout do jiné firmy. V tomto tasku se toto wiring NEIMPLEMENTUJE.

## Akceptace

- Temp-storage regrese A → B se stejným issuer/client/resource odmítne stale volbu A; platný tentýž snapshot uspěje a refresh race bezpečně odmítne starý výběr.
- Podmíněný null reset nesmaže mezitím novou firmu ani cizí relaci. Guard false znamená nula zápisů.
- Zero/one/many nabídka, invalid/duplicate ID, stale token, cizí requester, TTL, dvě současné select, pending auth změna a nově odebrané ID jsou mockované a mají přesné počty fetch/commit.
- Skutečný React klik load → select → save zachová explicitní ID; mount, signed-out, expired, zrušená/pozdní odpověď a prázdná nabídka nic neuloží. Žádné automatické schválení první firmy.
- Existující auth testy a tok jediné firmy zůstávají. Žádná živá síť a žádný zásah do T5 hotspotů.

## Sabotáže — spusť je, vypiš doslovný výstup

### MUSÍ ZČERVENAT

1. Dočasně vyřaď atomickou kontrolu identity/session při zápisu firmy; A → B regrese musí zčervenat. Obnov kód.
2. Dočasně vyřaď membership recheck nové nabídky při select; test odebrané firmy musí zčervenat. Obnov kód.

### MUSÍ ZŮSTAT ZELENÉ

Po obnovení ochran platný výběr stejné relace, nulový commit při stale/forged nabídce, podmíněný reset a React explicitní klik zůstanou zelené.

## Postup — dodrž pořadí

1. Přečti skutečný kód, napiš konkrétní RED regrese a nejmenší implementaci v allowlistu.
2. Spusť `npm run typecheck` a ulož úplný doslovný výpis a exit kód do A3/typecheck.log.
3. Spusť testy příkazem `npm run gates` a ulož úplný doslovný výpis a exit kód do A3/gates.log. Po konkrétní opravě appendni cílené ověření do téhož logu; nic nezahazuj.
4. Proveď dvě skutečné sabotáže, úplné výstupy a exit kódy ulož do určených logů. Obnov produkční kód.
5. Jediný povolený závěrečný Git self-check je `git --no-pager status --porcelain`. Ověř nulový zásah mimo allowlist.
6. Zapiš report podle output contractu a předej konkrétní rozhraní root.

## Output contract

```json
{
  "summary": "Připravené rozhraní a skutečný výsledek.",
  "premisaPlatila": true,
  "premisaPoznamka": "Skutečné kontrakty a jejich odchylky.",
  "ocekavanePocty": {"commitProCiziRelaci":0,"automatickychVoledPrvniFirmy":0,"produkcnichRequestu":0},
  "kontrolniNula": {"souboruMimoAllowlist":0,"zmenT5Hotspotu":0,"novychSkipuBaseline":0,"gitZapisu":0},
  "rozhraniProZapojeni": {},
  "sabotaze": [{"nazev":"","ocekavano":"","vysledek":"","doslovnyVystup":"Úplný výstup včetně exit kódu."}],
  "doslovnyVystupTestu":"Úplné výstupy včetně exit kódů, ne jejich parafráze.",
  "coJsemNEOVERIL": ["Main/preload/Settings wiring, produkce, GUI a audio."],
  "notes": []
}
```

Stejný objekt ulož do evidence/tasks/T-A3.report.json. Když premisa neplatí, popiš skutečný výsledek a doběhni. Neptej se uživatele.
