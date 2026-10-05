# Kompletní návrhy LuDone Desktop · A–E

Dan 1. 10. žádá tři odlišné minimalistické designy **celé aplikace**, všechny se stejnými funkcemi. Předchozí částečné varianty zůstávají archivované. Jde pouze o samostatné HTML makety s fiktivními daty. Produkční aplikaci neimplementovat ani nevydávat před schválením.

## Společný funkční rozsah

Inventář vychází z aktuálního `src/components/Settings.jsx`, `Onboarding.jsx`, `SettingsAudioTest.jsx`, `ApplicationUpdateStatus.jsx`, `features/recording/RecordingCard.jsx`, `features/queue/QueueCard.jsx` a `features/recordings/RecordingsDashboard.jsx` (0.1.7). Historické zadání T0–T6 není důkaz současného stavu.

| Oblast | Povinné obrazovky a akce ve všech návrzích |
|---|---|
| Nahrávání | Připraveno, spuštění, čas a oba zvukové kanály, zastavení, ukládání, výpadek systémového zvuku a obnova / zastavení. Jeden stereo soubor. |
| Po schůzce | Název, firma a přístup (firemní / soukromý), Uložit a odeslat, Nechat na Macu. Automatika pouze nových nahrávek. |
| Historie | Vše / lokální / odesílání, obnova, detail. Nový návrh hledání a období včetně vlastního rozsahu, stránkování. |
| Detail | Oddělený skutečný stav Mac / LuDone, ruční ověření, odeslání, opakování, Finder, bezpečný místní koš s potvrzením, otevření na webu. Přepis a analýza zůstávají webové. |
| Vlastnictví | Výslovné převzetí pod přihlášený účet s potvrzením; převzetí neodesílá. Firma a přístup se zamykají po začátku uploadu. |
| Fronta a chyby | Průběh, další pokus, offline, expirace, limit serveru, vyžadované převzetí, chybějící / neúplný soubor, neověřený serverový stav a obnova po restartu. Žádné tvrzení „odesláno“ jen podle fronty. |
| Účet | Přihlášení přes prohlížeč, čekání, kopírování odkazu, zrušení / další pokus, odhlášení tohoto Macu, stav oprávnění k uploadu. |
| Nastavení | Uložená výchozí firma s explicitním uložením, přepínač automatiky nových nahrávek, Dock, spuštění po přihlášení, světlé / profesionální / tmavé téma, retence (neodeslané nemazat), pokročilá volba prostředí. |
| Zvuk | Mikrofon vlevo a systémový zvuk vpravo, oprávnění a otevření systémových nastavení, zkouška, testovací zvuk, ruční potvrzení slyšených kanálů. Maketa žádný zvuk nezachytává. |
| Diagnostika | Verze, architektura, oprávnění, server, souhrn fronty, export diagnostiky. Technické údaje detailu mimo primární tok. |
| Aktualizace | Automatická kontrola a připomínka, stahování, připravená verze, Později, ruční kontrola a instalace čekající na dokončení nahrávání / uložení. Jednorázové oznámení macOS jako ukázka. |
| První použití | Uvítání, přihlášení, oprávnění, zvuková zkouška, dokončení. Menu bar panel a přehled klávesových zkratek. |
| LuTrack | Pouze malá neaktivní položka „Připravujeme“. Žádné funkční měření ani napojení. |

## Vizuální směry

- A — **Mac**: postranní navigace, systémový toolbar, klidné skupiny nastavení; čitelná systémová typografie.
- B — **Studio**: horizontální navigace, výraznější pracovní plocha a otevřená kompozice, měkký grafitový / fialový akcent.
- C — **Deník**: úzká ikonová navigace, vzdušný teplý povrch, lineární seznam místo množství rámečků, zelená značka.

Značka LuDone a dříve vybrané ikonové pojetí zůstávají společné. Rozdíly nejsou jen změna barvy. Jedna simulace funkcí zajistí srovnatelný rozsah. Toto není canonical preview webového LuDone DS; macOS typografie vychází z Danova současného požadavku. Vnější porovnávací ovladače nejsou součástí produktového UI.

## DOM pro vizuální autory

Sdílený renderer `design/app.js` a základ `design/base.css` vlastní root. Autor A píše pouze `design/mac.css`; autor B pouze `design/studio.css` ve svém izolovaném stromu. Root integruje až po předání. Oba mohou číst živý renderer v root preview stromu.

Struktura: `.desktop-stage > .window > .titlebar + .app-layout`; `.app-layout > .app-nav + .workspace`. Navigace obsahuje `.brand`, `.nav-primary`, `.nav-bottom`, `.nav-user`; tlačítka `.nav-item.active`, `.nav-icon`, `.nav-label`, `.count`. Workspace má `.workspace-head` (h1, subtitle, `.head-actions`), `.global-notice`, `.content`. Home má `.home-grid > .recorder + .recent-section`; `.record-head`, `.record-time`, `.waveform`, `.source-summary`, `.record-actions`, `.context-summary`, `.quiet-row`. Historie: `.filter-bar`, `.segment`, `.search-field`, `.history-list`, `.record-row`, `.row-icon`, `.row-main`, `.row-tail`, `.pagination`. Detail: `.detail-layout > .detail-main + .detail-aside`; `.detail-hero`, `.facts`, `.status-pair`, `.status-cell`, `.form-grid`, `.detail-actions`, `.technical`. Nastavení: `.settings-layout > .settings-nav + .settings-content`; `.settings-section`, `.setting-row`, `.setting-label`, `.field`, `.group`. Další společné: `.page-intro`, `.surface`, `.notice` (warning/error/success), `.queue-row`, `.progress`, `.onboarding`, `.steps`, `.permission-row`, `.update-hero`, `.diag-grid`, `.empty`, `.live-strip`, `.sheet`, `.sheet-head`, `.sheet-body`, `.sheet-actions`. `.btn` varianty `.primary`, `.danger`, `.subtle`, `.icon-btn`; `.badge` varianty `.local/.sent/.waiting/.error`; `.muted`. Všechny ovladače základně funkční přes sdílený renderer. Dialog a toast jsou společné. Téma `[data-theme=dark]` nebo `[data-theme=professional]` na `html`; tokeny --bg,--surface,--surface-alt,--text,--muted,--line,--accent,--accent-soft,--danger,--shadow. Základ fontsize15px, metadata nejméně13px, řádky42px+, žádný dvojitý falešný rám okna. Panel má 360–480 px, okno detailu 720–1100 px; responsivní menší náhled se nesmí horizontálně rozbít.


## Upřesnění Dana 2. 10. 2026

Nahrávání probíhá z ikony LuDone v horní liště. Spuštění, zastavení a rozhodnutí po schůzce neotevírají hlavní okno. Zavření panelu nahrávání nezastaví. Samostatné okno se otevře až při detailu konkrétní nahrávky. Historie, fronta, nastavení, aktualizace a první použití zůstávají v panelu.

Přidány dva směry skutečně vytvořené modelem `claude-sonnet-5-5` přes přihlášený Claude Code:

- D **Sloupec**: grafit, úzký panel 360 px, svislý detail 760 × 820 px.
- E **Kapsle**: průsvitný panel 420–480 px, měkké skupiny, široký detail 1040 × 640 px.

[Zadání Sonnetu](SONNET-BRIEF.md) a [jeho původní poznámky](SONNET-NOTES.md) jsou uložené. Autorské CSS je zachované doslova; `menu-integration.css` obsahuje opravy vůči skutečnému DOM, dostupnosti stavů a překrývání formuláře. Stav „neověřeno“ v původních poznámkách popisuje předání autora; následné prokliky integrace eviduje README a archiv důkazů.

Předchozí tři návrhy a jejich proporce jsou zachované v Git commitu `08db89abc15fabf85e908f3a45f284a8185cd8e4`. Cizí `design/`, produkce a release zůstávají mimo rozsah. Schválení designu je stále nutné před implementací.
