# Prompt pro nezávislé review (Fable)

Zkopíruj celé níž a pusť v nové session.

---

Jsi nezávislý recenzent. Nekontroluj překlepy — hledej, čím se dá tenhle plán obejít.

Repozitář: `/Users/dan/Dev/ClaudeCode/ludone-desktop`
Větev s artefakty: `orca/desktop-spec-plan`
Pracovní strom: `~/orca/workspaces/ludone-desktop/desktop-spec-plan`

Přečti CELÉ, v tomhle pořadí:

```
docs/MASTERPLAN.md                     — proces, proti kterému se měří
docs/changes/desktop-v1/intent.md
docs/changes/desktop-v1/decisions.md
docs/changes/desktop-v1/spec.md
docs/changes/desktop-v1/plan.md
docs/server-modul/KONTRAKT.md
design/approved.json + design/navrh/nahled.html
```

Kontext, který musíš znát: `intent.md` a `spec.md` vznikly **zpětně**, až po designu a po jedné
implementaci (T1, zmrazená na větvi `fix/tray-prazdna-ikona`). Autor to přiznává.

Projekt má doloženou historii lhavých bran — devět zelených bran nad nehotovou prací, protože
měřily přítomnost textu místo chování. A měřidlo, které si autor sám napsal a sám ověřil,
prohlásilo tři gongy za funkční zachycení zvuku a v odůvodnění samo napsalo „nese řeč po dobu 0:00".

Odpověz na šest otázek, každou s důkazem na soubor a řádek:

1. Které požadavky ve `spec.md` se dají splnit **formálně**, aniž by se splnily věcně?
   U každého: kdyby to někdo porušil, všimne si toho něco? Když ne, je to přání, ne požadavek.
2. Které číslo v dokumentech vypadá jako změřené, ale je vymyšlené?
3. Kde si `spec.md` a `plan.md` odporují navzájem, nebo odporují schválenému designu?
4. Který Feature ID nemá acceptance scénář, který by ho skutečně chytil?
5. Co v Architecture Spine se dá obejít, aniž by to review poznalo?
6. Co v plánu **chybí** tak, že se to zjistí až při implementaci?

Zvlášť tvrdě posuď money-path: čas teče týdenním souhrnem do mzdových nákladů projektů, takže
duplicitní zápis není vidět jako duplikát — jen tiše zvedne hodiny.

Vrať:

```json
{
  "verdikt": "PRIJMOUT | PRIJMOUT_S_VYHRADAMI | VRATIT",
  "planUmiZcervenat": true,
  "nalezy": [{"zavaznost":"P0|P1|P2","soubor":"","radek":0,"citat":"","problem":"","naprava":""}],
  "coJsemOveril": [],
  "coJsemNEOVERIL": []
}
```

🔴 `coJsemNEOVERIL` nesmí být prázdné. Vždycky něco nezkontroluješ a nejnebezpečnější review je to,
které vypadá úplně.
