# LuTrack · poznámky ke klikacímu návrhu

Tento soubor doprovází pouze lokální HTML simulaci. Stav návrhu: ⛔ neověřeno v produktu. Otevři `index.html` přímo v prohlížeči; scénáře a témata lze volit také přes `?scenario=ready&theme=light` (`ready|running|saved|blocked`, `light|professional|dark`). Okno má 448 × 676 px. Při integraci se použije společný `../shared-assets/tokens.css`; zde je v `assets/` jeho lokální kopie s fonty, aby proklik fungoval i samostatně. Jde o podvýběr DS tokenů, ne canonical knihovnu (zdroj kopie: `desktop-design-compare/docs/changes/desktop-redesign-2026-09-23/shared-assets/README.md`).

## Co proklik ukazuje

- **Připraveno:** výběr výslovně fiktivního projektu a popis práce. Start spustí pouze místní JavaScript časovač.
- **Běží:** projekt, práce, čas zaokrouhlený na minuty, přepnutí projektu a Stop. Ukázka nahrávání má samostatný ovladač; její zastavení neovládá časovač a naopak.
- **Místně uloženo:** po Stop ukáže čistě místní položky v paměti otevřené stránky. Výrazný stav „Není odesláno do LuTracku“ brání dojmu hotového výkazu. Obnovení stránky simulační položky smaže.
- **Nedostupné:** vysvětluje, proč produkt zatím neumí výběr skutečného projektu ani odeslání času; vede k dnešnímu LuTracku v prohlížeči.

Všechny příklady projektů mají prefix „Ukázka“. Nejsou to firemní data ani produkční alokace. Nejsou zde sazby, peníze, konflikty synchronizace, serverový souhrn dne ani tvrzení o úspěšném zápisu. Simulace zachová napsaný popis po Stop a při místním přepnutí projektu. **Současný desktopový klient popis v uzavřeném záznamu nepřenáší:** `electron/tracking.cjs:190-202` jej z uzavřené položky vynechává, `src/lib/queue.js:386-424` jej nedává do odchozí položky. Tento rozdíl je záměrně podkladem pro další implementační specifikaci, nikoli hotovou funkcí.

## Hranice proti dnešnímu produktu

Viditelná karta dnes používá `useState`, nenabízí skutečný projekt a přímo říká, že se čas neuloží (`src/features/tracking/TrackingCard.jsx:17-46,139-169`). Hlavní proces má atomický místní časovač, obnovení po restartu a IPC start/přepnutí/stop (`electron/tracking.cjs:205-235,291-325,348-443`; `electron/main.cjs:3697-3720`), ale vyžaduje GUID projektu a zapnutý `DESKTOP_TIME_ENABLED` (`electron/tracking.cjs:348-351`; `electron/main.cjs:3334-3345`). Odesílač položku času výslovně pozastaví jako `time_upload_unavailable` (`electron/upload-client.cjs:1022-1027`). V `ludone-app` je `/lutrack` jen stránka „Modul ve vývoji“ (`/Users/dan/Dev/ClaudeCode/LuDone/ludone-app/src/app/(app)/lutrack/page.tsx:4-37`). Tamní návrh kontraktu výslovně uvádí, že endpoint pro projekty přihlášeného člověka ani zápis času zatím neexistují (`docs/changes/_archive/nahravky-v2/kontrakt-alokace-lutrack.md:14-37` v `ludone-app`).

Produktové hranice: desktop je jedna aplikace se dvěma agendami, časovač pouze v panelu, vzhled LuDone DS (`docs/behy/2026-09-01-masterplan-a-design.md:20-32`). Zastavení nahrávky nezastaví časovač (`docs/changes/desktop-v1/spec.md:292-308`). Dan odložil serverovou část času a určil, že kontrakt bude vlastnit `ludone-app`, desktop se přizpůsobí (`docs/changes/desktop-v1/decisions.md:803-826`). Proto návrh neotvírá skutečné vykazování bez hotového kontraktu a review money-path.

## Ověření návrhu

HTML/CSS/JS nemění produkt. Soubory lze otevřít bez instalace. Syntaxe `app.js` prošla kontrolou `node --check` (exit 0). Koordinátor převzal vizuální kontrolu v Codex In-app Browser: start s vlastním popisem, změna projektu, místní položky po Stop, nezávislé zastavení nahrávky, čtyři scénáře a tři témata. Rozsah a omezení jsou v `dukazy/desktop-design-2026-09-23/lutrack/ROOT-REVIEW.md`. 🧪 Ověřena je simulace; skutečný LuTrack ani vydaná aplikace tím ověřené nejsou.
