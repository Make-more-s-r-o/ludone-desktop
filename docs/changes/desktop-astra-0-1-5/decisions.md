# Rozhodnutí — LuDone Desktop 0.1.5

## D1 — Pro 0.1.5 použít směr Astra „Nit dne“

- **Kdo:** Dan, výslovným pokynem v chatu 24. 9. 2026.
- **Volba:** Implementovat vybraný směr Astra; zachovat původní návrhy Astra i Opus jako editovatelné HTML artefakty pro případ pozdější změny názoru.
- **Dopad:** Jde o omezené dokončení existující desktopové aplikace, ne o kompletní přestavbu ani o implementaci všech fiktivních stavů z prototypů.
- **Záznam:** `docs/changes/desktop-redesign-2026-09-23/round2/VYBER.md` a uživatelský pokyn „Tak ten astra navrh. Levna implementace podle navrhu…“.

## D2 — LuTrack zůstává vypnutý do připravenosti služby

- **Kdo:** Dan, pokynem „LuTrack ještě neexistuje… zatím teda neimplementuj“.
- **Volba:** Nevytvářet integraci ani použitelný lokální časovač. Nahradit zavádějící ovládání neaktivním vysvětlením. Budoucí propojené UX zůstává jako návrh.
- **Dopad:** Žádný upload času, síťové volání, měření práce ani změna v backendu.

## D3 — Zachovat bezpečnostní identitu Nastavení

- **Kdo:** Codex jako bezpečný technický detail vyplývající ze stávající IPC brány.
- **Volba:** Výchozí záložku Nahrávky předávat jako `settingsTab` query parametr, ale všechna okna Nastavení ponechat na hash `#settings`.
- **Důvod:** Stávající `isAllowedMediaPermission` a `isTrustedSettingsAudioFrame` kontrolují přesný hash `#settings`. Alternativní hash by přerušil systémový zvuk a změnil oprávňovací hranici.

## D4 — Verzi 0.1.5 připravit a vydat desktopovým workflow

- **Kdo:** Dan, výslovným následným pokynem „Vydej další verzi“ a dřívějším „Ano, vydej 0.1.3 sám“ / „Ano, tak vydej“ v rámci stejné práce na vydání.
- **Volba:** Zvednout desktop na 0.1.5 a po review a zeleném CI provést publikaci přes existující release workflow.
- **Hranice:** Neprovádět žádné změny v serverovém repozitáři a neoznačit zvukové ani instalační ověření na Macu za dokončené.
