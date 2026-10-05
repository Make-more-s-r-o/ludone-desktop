# Předání na dev-ludone Mac mini

5. 10. 2026. Doporučený další běh: **dev-ludone Mac mini**, nikoli zasedačkový `macmini`. Vývoj používá skutečné macOS; cloud může sloužit pro omezený renderer/unit test experiment a review. Finální tray, oprávnění, oba zvukové kanály a balíček musí ověřit Mac.

## Ověřená připravenost

✅ Čtecí SSH přes Tailscale na `dev-ludone` funguje, systém Darwin/macOS 27.0.1. Node v22.23.3, Git 2.54.0, Swift a macOS SDK jsou dostupné. Codex CLI 0.160.0 je přihlášený přes ChatGPT. Při neinteraktivním SSH má Node jinou PATH; explicitní `/opt/homebrew/bin` funguje. Nečti ani nepřenášej auth.json, klíče nebo tokeny.

✅ `git ls-remote` z Macu mini přečetl repozitář `Make-more-s-r-o/ludone-desktop` a HEAD `2dd73fb2821f81fad3d9087381c72fd4d127e927`. V kontrolovaných cestách `/Users/dev_ludone/Dev/ludone-desktop`, `/Users/dev_ludone/Dev/ClaudeCode/ludone-desktop`, `/Users/dev_ludone/Dev/ClaudeCode/LuDone/ludone-desktop` desktopový checkout nebyl. Existující `/Users/dev_ludone/Dev/ClaudeCode/LuDone` je širší cizí workspace; nepřepsat ani použít jeho webové repo jako desktop.

⛔ GUI session, dostupnost oprávnění pro automatizaci, fyzické audio vstupy, mikrofon/systémový zvuk a podpisové prostředí se tímto připojením neověřily. Plný Xcode není potvrzený; aktivní Command Line Tools mají Swift i SDK. Neinstaluj Xcode ani nic vyžadujícího heslo správce preventivně; nejdřív ověř skutečný build.

Codex app tento místní chat nemůže přemístit sám sebe. V inventáři projektů byl desktop uveden jen jako místní; host `dev-ludone` je dostupný pro remote handoff jiného chatu. Připravený prompt lze vložit do nové úlohy na tomto hostu. Po výslovném pokynu založit/spustit vzdálenou úlohu lze využít dostupné Codex nástroje; nynější běh připravuje podklady a žádnou takovou úlohu nespustil.

## Přenos bez závislosti na původním Macu

Podklady jsou ve větvi `docs/desktop-clarity-preview`. Nejsou změnou `main` ani produkčním buildem. Po zahájení dalšího běhu:

1. Čistě klonovat desktopové repo například do `/Users/dev_ludone/Dev/ludone-desktop`, pokud vhodný checkout stále neexistuje. Bez přesunu nebo resetu cizích checkoutů.
2. Fetch `origin/main` a přípravnou větev. Zaznamenat jejich SHA do nového provozního briefu. Zkontrolovat, že podklady a manifest obsahují deset SVG a dvacet PNG.
3. V samostatném `.claude/worktrees/desktop-osa` založit `feat/desktop-osa` z aktuálního `origin/main`. Přenést **jen podklady**, například `docs/changes/desktop-complete-designs-2026-10-01/` a související důkazy. Nepřepsat starším `ROZHODNUTI.md`, `PLAN.md` ani `DAN-TODO.md` případné novější produkční zápisy.
4. Číst [IMPLEMENTACE-F.md](IMPLEMENTACE-F.md), [kontrakt ikon](F-TRAY-KONTRAKT.md) a [prompt](PROMPT-MAC-MINI.txt). Pro posouzení lokálně spustit HTML server jen nad `design/`, na loopbacku; žádný veřejný server nad repem.
5. Zkontrolovat běžné Node závislosti z lockfile a projektové brány. Balení využije stávající media encoder workflow. Podpisová tajemství zůstanou v GitHub Secrets; nic se nekopíruje z Danova disku.

Původní makety A–G i vybraný F autorův zdroj zůstávají verzované. Změny podle review mají vlastní vrstvu; původní Sonnet a Opus podklady se nepřepisují. Živý VPN odkaz slouží k rychlému posouzení, ale Mac mini nepotřebuje běžící lokální server na Danově počítači.

## Cloud jako volitelný pokus

Aktuální Codex Cloud potřebuje publikované prostředí s repozitářem; po vytvoření může pracovat, i když původní počítač spí ([oficiální průvodce](https://learn.chatgpt.com/docs/environments/cloud-environments)). Remote naproti tomu spouští práci na připojeném vývojovém hostu ([oficiální popis](https://developers.openai.com/blog/mastering-codex-remote-for-engineering)). Dostupnost publikovaného cloudového prostředí pro toto repo nebyla ověřená.

Pro zkušební cloud úlohu dát jen renderer komponenty, mapování stavů a unit testy z izolované větve. Žádné osobní zvukové soubory, přihlašovací nebo podpisové klíče. Je to rozdělení práce pro tento projekt, nikoli tvrzení, že cloudový proklik nahrazuje macOS E2E. Integraci a Mac přejímku vlastní jediný koordinátor na dev-ludone.

## Co je předané a co čeká

🧪 Uložený klikací F, stavové assety, jejich reprodukovatelná kontrola, samostatné zadání a prompt. ✅ Jen výše popsané čtecí připojení a nástroje na Macu mini. 🟡 Posouzení poslední podoby ikon a pokyn zahájit nový implementační běh. ⛔ Produkční implementace F, fyzický zvuk, nativní tray a nové vydání.

Doslovné výsledky preflightu a kontrol jsou v [archivu](../../../dukazy/desktop-f-tray-predani-2026-10-05/README.md). Remote přípravě nebyly přiděleny žádné nové credentialy, instalace ani proces běžícího agenta.
