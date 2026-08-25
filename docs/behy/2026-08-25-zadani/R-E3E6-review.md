# Nezávislé review — etapy E3 (vady) a E6 (oprávnění)
Společná pravidla: **přečti si `_review-spolecne.md` ve stejném adresáři.**

## Diff k prohlédnutí
```bash
cd /Users/dan/Dev/ClaudeCode/ludone-desktop
git --no-pager show --stat c1bdec5    # E3
git --no-pager show --stat 2dfd840    # E6
git --no-pager diff 7047b28..c1bdec5 -- electron/ src/ scripts/ tests/
```
⚠️ Obě etapy psaly do **téhož** `electron/main.cjs` ze dvou různých worktrees a merge
proběhl bez konfliktu. 🔴 **Bezkonfliktní merge NENÍ důkaz, že je výsledek správný** —
ověř, že se ty dvě sady změn nepoškozují navzájem a že v souboru nezůstal osiřelý kus.

## Na co se dívej především

🔴 **Kontrola odesílatele IPC (E3).** Tohle je bezpečnostní kód. Ověř čtením:
- propustí URL, která jen **začíná** povoleným prefixem
  (`file:///…/dist/index.html.evil`, `https://app.ludone.cz.utocnik.cz`)?
- co když je `webContents` zničené — odmítne, nebo vyhodí výjimku (a kdo ji chytí)?
- co když `senderFrame` chybí / je `undefined`? Musí ODMÍTNOUT, ne projít.
- 🔴 **je guard opravdu POUŽITÝ u všech IPC handlerů**, nebo jen existuje a část
  handlerů se ptá jinak / vůbec? Vyjmenuj handlery a u každého řekni, čím je chráněný.
  To je nejpravděpodobnější díra: obrana, která existuje, ale někde se nevolá.

🔴 **Oprávnění (E6).** `grep -c "granted: true" electron/main.cjs` musí být 0 — ověř.
Pak se ptej na to podstatnější: **může funkce vrátit „uděleno" ve stavu, kdy macOS nic
neudělil?** Projdi všechny větve včetně `default`, chybějícího stavu, neznámého typu
oprávnění a výjimky. **Fail-closed znamená, že KAŽDÁ neznámá cesta končí NEuděleno.**
Zvlášť: co vrátí, když `systemPreferences` není k dispozici nebo hodí výjimku?

🔴 **Rozlišení stavů.** Etapa slibuje rozlišit „ještě se nikdo neptal" × „uživatel odmítl"
× „zakázáno politikou". Ověř, že to rozhraní opravdu dostane a že se ty stavy neslévají
zpátky do jednoho `granted: false` někde po cestě.

🔴 **Testy.** U každého nového testu se ptej: **„kudy se to, co testuje, projeví do něčeho,
co test vidí?"** Když assert čte návratovou hodnotu mocku, který ji vrací natvrdo, ten test
nehlídá nic. Zvlášť u testů, které mají hlídat guard — ty bývají psané přes mock, přes který
je hlídaná podmínka **nepozorovatelná**.

🔴 **Brány `E3.sh` a `E6.sh`.** U KAŽDÉ kontroly: *co vrátí nad neexistujícím / prázdným
souborem?* A kontroly `plutil`/`codesign` jsou podmíněné existencí bundlu — 🔴 **projdou
jako ZELENÉ, když bundle chybí?** Když ano, je to fail-open a je to nález.
