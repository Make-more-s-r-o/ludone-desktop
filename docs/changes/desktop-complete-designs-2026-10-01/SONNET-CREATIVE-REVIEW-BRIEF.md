# Druhý průchod — dokončení autorského návrhu F/G

Oba návrhy jsou hotové, první výstup je archivovaný. Při prvním běhu nebyl dostupný úplný frontend-design skill; nyní je přímo v tomto worktree. Přečti v pořadí AGENTS.md, ROZHODNUTI.md, PLAN.md, DAN-TODO.md (aktuální návrhový checkpoint je na konci), potom references/frontend-design-skill.md a svůj SONNET-CREATIVE-PLAN.md, NOTES.md. Všechny cesty návrhů jsou relativně k docs/changes/desktop-complete-designs-2026-10-01/.

Review proti skutečnému skillu. Zkontroluj kompozici a minimalistický macOS; nativní systémové písmo podle aktuálního Dana má přednost před starými výtvarnými rozhodnutími. Původní návrhy neměň. Doplň jen konkrétní nutné opravy do tvých 4 CSS/JS souborů a výsledek ulož do SONNET-CREATIVE-REVIEW.md (nově povolený soubor). Nic dalšího nezapisuj, nemáš browser, žádné tvrzení o runtime QA.

Koordinátor už připojil oba hooky; jeho app.js je pro čtení v references/integration-app.js. Případné změny app.js nesmíš dělat. Přečtení state je povolené, zápis nikoli.

Konkrétní rizika review Sol:
- F nesmí naznačovat ověřený server zeleným uzlem, když je skutečný stav neověřený. Text je zdroj pravdy, barva nemá přehánět výsledek. Svislá osa není sama o sobě nový UX: záměrné využití pro současnost / minulost a umístění akcí u Mac / LuDone.
- G draft: odesílací akce nahoře nesmí dovolit přehlédnout firmu a přístup. Přidej k primární akci konkrétní stručný souhrn komu / s jakým přístupem půjde, aktualizovaný z existujících DOM hodnot při hooku. Neskrývat oba původní selects či Nechat na Macu; neměnit význam disabled.
- G historie při běžícím nahrávání: facets() prepends g-lib před live-strip a tím může stop schovat pod dlouhý seznam. Zachovej live-strip jako první uzel a viditelnou bezpečnou prioritu.
- F nastavení: použij aria-expanded pro akordeonové tlačítko (aria-current zůstává); jeden aktivní obsah, žádné kopie.
- Poznámka plánu slibuje měsíční osu, ale renderer seskupuje dny. Popiš skutečně navržené členění, nevymýšlej neprovedenou změnu.

Dokonči review konkrétně a přiznej co čeká na browser QA. Jen návrhy, produkční aplikace nedotčená.
