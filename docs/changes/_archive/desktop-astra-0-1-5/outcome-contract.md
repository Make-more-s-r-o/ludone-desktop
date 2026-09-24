# Kontrakt výsledku — LuDone Desktop 0.1.5

## Aktér a cesta

Dan používá LuDone Desktop na macOS během pracovního dne. Z úzkého hlavního panelu spustí nebo zastaví skutečné nahrávání. Po skončení zvolí stávající volbu uložení/odeslání. Když potřebuje nahrávky spravovat, klikne na **Nahrávky**; otevře se větší okno přímo na existujícím přehledu a ukáže skutečný stav lokálních i odeslaných souborů. Pokud nahrávání není dostupné, aplikace ukáže existující chybu oprávnění či služby. Funkce LuTracku zůstane výslovně vypnutá a uživatel pozná, že připravujeme pozdější integraci.

## Obrazovky a důsledky akcí

| obrazovka | akce | očekávaný výsledek |
|---|---|---|
| Hlavní panel | Spustit/zastavit nahrávání | Stávající záznam se spustí nebo bezpečně ukončí; změna jeho zvukové cesty není součástí práce. |
| Hlavní panel | **Nahrávky** | Nastavení se otevře v širším okně na správě nahrávek. Cíl je povolen jen přes validované IPC z panelu. |
| Nastavení | Přijmout požadavek otevření záložky | Při prvním otevření se používá `#settings` a volitelný parametr `settingsTab`; při již otevřeném okně se použije validovaná volba záložky. |
| Nahrávky | Odeslat, opakovat, smazat, zobrazit či otevřít | Použije se dosavadní přehled a jeho serverové/lokální akce; jejich oprávnění se nemění. |
| Hlavní panel | LuTrack | Ukáže jasný neaktivní stav „Připravujeme“, bez falešného časovače, zápisu času nebo volání serveru. |

## Matice stavů

| stav | kde | pozorovatelný výsledek a další krok |
|---|---|---|
| `default` | Panel, Nahrávky | Uživatel vidí značku LuDone, dostupné nahrávání a přímou akci Nahrávky. |
| `pending/loading` | Nahrávky | Stávající indikátor načítání zůstane viditelný a chrání před dvojitou akcí. |
| `empty/no-op` | Nahrávky, LuTrack | Prázdný seznam používá existující prázdný stav; LuTrack zůstává neaktivní. |
| `success` | Nahrávky | Existující potvrzení a aktualizovaný stav ukazují skutečné dokončení. |
| `partial success` | Nahrávky | Stav souborů zachová dokončené položky odděleně od chybějících či chybných. |
| `recoverable error` | Nahrávky, oprávnění | Původní chybová zpráva a akce opakovat zůstávají dostupné. |
| `fatal/unavailable` | Panel, Nahrávky | Nelze spustit nepřipravenou funkci; vysvětlení sděluje stav a další dostupný krok. |
| `timeout/offline` | Nahrávky | Lokální seznam zůstává použitelný a stav sítě vychází ze stávající implementace. |
| `invalid input` | IPC Nastavení | Neznámý název záložky se odmítne bez otevření dalšího okna. |
| `conflict/concurrency` | Nahrávky | Platí stávající pravidla převzetí vlastnictví a revizí; tato změna je nemění. |
| `forbidden/redacted` | Nahrávky, nastavení | Platí existující serverové a lokální autorizace; nepřidávají se nové údaje ani oprávnění. |
| `disabled/degraded` | LuTrack | Zobrazené „Připravujeme“ nemá ovládání časovače a nevytváří časový záznam. |
| `retry/rollback` | Nahrávky, okno Nastavení | Opakování zůstává u existující položky. Neplatné IPC nemění právě otevřenou záložku. |
| `archived/superseded` | Prototypy | Oba návrhy zůstávají uložené; nejsou zdrojem runtime dat ani falešnou produkční funkcí. |

## Oprávnění a ochrana dat

Oprávnění zůstávají beze změny: panel může otevřít jen povolené záložky; Renderer posílá požadavek přes preload a hlavní proces dále ověřuje důvěryhodný dokument i okno. Všechny systémové požadavky okna Nastavení zůstávají na hash `#settings`, protože oprávnění pro audio capture na této identitě závisí. Nový `settingsTab` je jen neprivilegovaný směrovací parametr. Změna neukládá nové osobní ani produkční údaje.

## Důkaz přejímky

- Automatické jednotkové testy ověří trasu přehledu, zakázané cíle, stavy LuTracku a zachování IPC guardu.
- Build a akceptační brány ověří zabalení a projektové invarianty.
- Skutečný zvuk, upload, update z distribučního kanálu a běh po restartu se označí nejvýš 🧪, dokud je na skutečném Macu neprojde Dan.
