---
kind: verification
ref: mac-ui-0.1.6
verdict: warning
measuredAt: "2026-09-30T06:45:00Z"
scope: ["nainstalované UI 0.1.6"]
measuredFrom: ["native accessibility a snímky běžící aplikace", "zdrojový Settings.jsx a RecordingsDashboard.jsx"]
---

# Kontrola nainstalované aplikace 0.1.6 na Macu

30. 9. 2026, přibližně 08:28–08:45 Europe/Prague. Dan potvrdil instalaci a
požádal o proklikání výsledku. Kontrola proběhla v již běžící
`/Applications/LuDone Desktop.app`, nikoli v prototypu nebo vývojovém rendereru.
Verze 0.1.6 je uvedená ve skutečném UI. Použité nástroje: Orca computer-use a
následně native computer-use v Codexu.

## Výsledek

⚠️ Vizuální přejímku nelze uzavřít jako bezchybnou. Skutečná historie a čekající
fronta odhalily nedostatky, které dosavadní lokální fixture nepokryly. Předchozí
zelené testy zůstávají platné v jejich uvedeném rozsahu; nejsou důkazem přijetí
této instalace na reálných datech.

| Stav | Kontrola | Zjištění |
|---|---|---|
| ✅ | Instalovaná verze a přechody mezi Teď, Můj den a Nastavení | Otevřena skutečná aplikace 0.1.6 z Applications; nové obrazovky se zobrazují. Nejde o ověření celého mechanismu aktualizace ani nové instalace od začátku. |
| ✅ | Účet a cílové prostředí | UI zobrazuje identitu přihlášeného účtu a produkci `app.ludone.cz`. Nové přihlášení ani upload nebyly provedeny. |
| ⚠️ | Můj den na skutečné historii | Pod dnešním datem je celá historie od nejstarší nahrávky. Dnešní záznam je až na konci. Mezi dny nejsou samostatné nadpisy; levá časová osa obsahuje jen hodiny. Datum záznamu je v metadatech řádku, ale celková denní kompozice je zavádějící. |
| ⚠️ | Teď s čekající frontou | Rozbalená fronta zabírá značnou část malého panelu a odsouvá hlavní nahrávání. Výsledek uložení obsahuje dlouhý technický název souboru včetně identifikátoru a instrukcí pro externí přehrávač. |
| ⚠️ | Odkaz na správu nahrávek | Text „Nahrávky spravuješ jednotlivě v Nastavení.“ neodpovídá nové navigaci; nahrávky jsou v Můj den. |
| ⚠️ | Nastavení / diagnostika | Při opakovaném otevření přes běžnou navigaci zůstává fronta na „Načítám stav fronty…“ a diagnostika včetně verze na „Stav není známý“. Ostatní části aplikace data mají. |
| ⚠️ | Rozpracované nahrávání v přehledu | Při běžícím nahrávání se jeho rozpracovaný soubor objevil mezi lokálními nahrávkami jako „Část zvuku chybí“ a s neznámou délkou. Stav má rozlišit probíhající nahrávání od dokončené neúplné nahrávky. Na akce této položky se neklikalo. |
| 🟡 | Detail, filtry, rychlé akce, témata a kontrola aktualizací | Tento živý průchod je neuzavřel. Později běželo nahrávání a okna měnil uživatel; kontrola nebyla dokončena souběžným ovládáním jeho panelu. Dosavadní automatické E2E těchto ploch mají pouze stav 🧪. |
| 🟡 | Skutečný zvuk a nové produkční odeslání | Nebyl spuštěn nový zvukový test, přehrávání ani upload. Pozorovaný běžící časovač a měřidla samy nedokazují obsah výsledného souboru. |

## Příčina potvrzená čtením kódu

`src/components/Settings.jsx` načítá diagnostiku jen při `activeTab ===
"recordings"` nebo `"diagnostics"`. Nová obrazovka zobrazuje všechny skupiny
nastavení společně a původní záložky jsou skryté; běžná navigace ponechá
`activeTab === "account"`. Načítání diagnostiky se proto při běžném vstupu
nespustí. Nejde jen o pomalé načtení z produkce.

Přehled v `RecordingsDashboard.jsx` filtruje pouze podle stavu. Chybí denní
rozsah/seskupení i řazení, které by zajistilo viditelnost dnešních nahrávek.

Čtením `recordingFileActionGuard` v `electron/main.cjs` byla nalezena ochrana
souborových akcí při aktivních nahrávacích sessions. Mazání nebylo vyzkoušeno;
z pozorování rozpracované položky neplyne tvrzení, že lze smazat běžící záznam.

## Co musí následovat

1. Navázat načítání diagnostiky na skutečně viditelnou stránku nastavení.
2. Zachovat dostupnost historie a uspořádat ji po dnech, s dnešními záznamy
   snadno dostupnými. Potom zopakovat porovnání s uloženou Astrou.
3. Udržet ovládání nahrávání viditelné i s větší čekající frontou; zkrátit
   potvrzení uložení a opravit odkaz na Můj den.
4. Odlišit právě pořizovanou nahrávku od neúplné dokončené nahrávky.
5. Zopakovat živý proklik na dlouhé historii a čekající frontě a doplnit
   neuzavřené kontroly v tabulce. Opravy vyžadují odpovídající regresní ověření.

V této kontrole se zdrojový kód aplikace ani vydaná verze nezměnily. Žádný
soubor nebyl smazán, nahrávka odeslána, vlastnictví převzato ani účet odhlášen.

## Soukromé podklady

Snímky obsahují osobní údaje a skutečné názvy nahrávek, proto zůstávají pouze
v ignorovaném lokálním adresáři `.runtime/mac-ui-review-2026-09-30/` hlavního
checkoutu: `day-history.png`, `now-queue.png`, `settings-unknown.png`.
Tento verzovaný text je anonymizovaný; osobní snímky nejsou určeny pro GitHub.
