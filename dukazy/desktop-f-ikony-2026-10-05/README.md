# Ikony vybrané F — 5. 10. 2026

🧪 Ověřeno v živém HTML náhledu přes adresu Tailscale. Nejde o Electron E2E ani skutečné nahrávání.

- `prokliky.json`: 69 finálních kontrol = 23 situací × 3 témata. Načtení správné situace/tématu, přítomnost ikon, značka v liště, nabídka, počty výstrah a nepřetékání. Pět navigačních tlačítek má přístupné názvy a při zobrazené liště šířku 40 px.
- Počáteční průchod uchovává 18 FAIL: pomocná kontrola nesprávně vyžadovala viditelnou lištu také v samostatném detailu a onboardingu. Tam je záměrně skrytá už v původním F. Produkční brána ani existující test se neupravují; následná kontrola odděluje viditelné a skryté ovladače podle skutečného povrchu a stránky. Finálních 69 kontrol je PASS.
- Konkrétní simulovaný tok prošel: spuštění; zavřený panel s pokračujícím časem 00:07; otevření; zastavení; čekající „Uložit“; Studio Forma a soukromý přístup; „Nechat na Macu“. Vše v panelu, žádný skutečný upload.
- Klávesa Tab v levé liště zaměřila Nahrávky, tooltip měl text „Nahrávky“ a viditelnou opacity 1. `f-keyboard-tooltip.jpg` zachycuje skutečný stav.
- Galerie obsahuje pět navigačních a osmnáct dalších ikon, čtyři stavy lišty a původní značku ve třech velikostech. Světlé a tmavé téma prohlédnuté a zachycené. Při prvním přepnutí galerie se přesný selektor implicitního labelu neshodoval; explicitní `aria-label` na výběru doplněný, přepnutí opakovaně prošlo.
- Read-only review Sol bez funkčního nálezu. Jediný podnět — sjednotit plný kroužek, čtverec a tři tečky mezi galerií a maketou — zapracovaný před finálními snímky.
- `kontroly.txt`: doslovné příkazy, samostatné výsledky a návratové kódy. Snímky jsou skutečné browser screenshots, bez překreslení.
- `dalsi-kontroly.json`: šest původních variant A–E/G zachovává své ikony; původní F po `icons=original` má opět obrázek značky a bez nové ikonové vrstvy. Čtyři přímé kontroly F při 400px viewportu prošly, hlavička zůstává 36 px. První pokus mířil na neaktivní kartu, které viewport override nepřepnul rozměry (iframe zůstal 858 px); čtyři FAIL se uchovávají. Přímá kontrola nové karty ověřila cílový rozměr 385 px obsahu (400 px včetně scrollbar) a panel 361 px, bez přetékání. `f-narrow-recording.jpg` je snímek této skutečné úzké karty.

`f-ready.jpg`, `f-keyboard-tooltip.jpg`, `ikony-light.jpg`, `ikony-dark.jpg` ukazují tuto revizi. Další snímky nebo kontroly úzkého panelu jsou uvedené v `dalsi-kontroly.json`, pokud byly provedené.

⛔ Neověřeno: nainstalovaná aplikace, systémové tray template chování macOS, VoiceOver, skutečný zvuk, OAuth, upload, Finder, aktualizace nebo release. Výběr F není automaticky schválením této rozpracované sady ikon.
