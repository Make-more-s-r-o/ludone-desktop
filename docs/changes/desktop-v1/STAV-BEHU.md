# STAV BĚHU — bod obnovy

**Přepsáno 2. 9. 2026 odpoledne. Psáno pro někoho s PRÁZDNÝM kontextem.**

---

## 🔴 PRVNÍ AKCE PO RESUME — ikona v liště je NEVIDITELNÁ, oprava leží hotová

**Dan hlásí: „ikonu v horní liště nevidím."** Příčina je ZMĚŘENÁ, ne odhadnutá:

```
Electron nativeImage z SVG →  {"prazdna":true, "velikost":{"width":0,"height":0}, "bajtuPNG":0}
```

SVG se na macOS v liště nevykreslí vůbec. **Oprava existuje a je hotová** — nahrazuje SVG
ověřenými PNG:

```
větev:  fix/tray-prazdna-ikona
commit: ce2bea6  "Keep LuDone visible with verified PNG tray icons"
mění:   electron/main.cjs (−31/+18) · electron/ikony/*.png (nové) · package.json
        · tests/tray-image-electron.js (test běžící ve skutečném Electronu)
```

**Proč se to nemergovalo:** v době vzniku to byla user-visible změna bez schváleného designu,
což masterplán zakazoval. **Design byl schválen 1. 9., ten důvod padl.**

### Postup

```bash
cd /Users/dan/Dev/ClaudeCode/ludone-desktop
git worktree add -b orca/desktop-ikona ~/orca/workspaces/ludone-desktop/desktop-ikona origin/main
cd ~/orca/workspaces/ludone-desktop/desktop-ikona
ln -sfn /Users/dan/Dev/ClaudeCode/ludone-desktop/node_modules node_modules
git cherry-pick ce2bea6          # může chtít rozřešit konflikt v main.cjs
npm run lint && npm run typecheck && npm run test:unit
```

🔴 **Sabotáž, která tu MUSÍ proběhnout:** vrátit SVG cestu a ověřit, že
`tests/tray-image-electron.js` zčervená. Test, který nepozná prázdnou ikonu, je bezcenný —
právě proto, že se tahle vada rok schovávala za zelené testy.

🔴 **A ověření naostro:** spustit aplikaci a **podívat se na lištu**. Tuhle vadu nezachytí
žádný headless test; je vidět jen očima.

---

## Stav k tomuhle okamžiku

`main` = **411 testů**, nula worktrees, nula otevřených PR, čistý strom.

| PR | co |
|---|---|
| #14–#18 | kalendář pryč · zapojení retence a času · přihlášení · logování · panel podle designu |
| #19 | systémový zvuk (kontrola oprávnění odmítala prázdné `mediaTypes`) |
| #20 | pokrytí `RecordingCard` (mělo 0 testů) |
| #21 | panel po restartu nelže o přihlášení |
| #22 | tři chybové obrazovky, které panel dřív spolkl |
| #23 | **panel má výšku podle obsahu** (323 px místo napevno 792) |

## ✅ Ověřeno naostro (jen tyhle tři)

1. **Retence** — 10 dní stará odeslaná nahrávka smazána skutečným během.
2. **Přihlášení** — token v `~/Library/Application Support/cz.ludone.desktop/auth/oauth.enc`.
3. **Výška panelu** — okno 366×323 proti obsahu 323 px, vyfoceno.

🔴 **Všechno ostatní je 🧪 zelené testy.**

## Co zbývá na desktopu, po ikoně

1. **Stereo export + tlačítko „nahrát na app.ludone"** — BD-N34 je rozhodnutí, které desktop
   NEUMÍ. ⚠️ Mikrofon a systém jsou dva nezávislé `MediaRecorder`y a mohou driftovat;
   sloučení vyžaduje zarovnání a může selhat. Serverová session to ví.
2. Chybí fontové soubory Public Sans / Instrument Sans → systémový fallback.
3. Zbývající obrazovky ze schválených 22 (onboarding, „nahrává se" s měřáky, výběr projektu).

## Serverová strana — jiná session, nezasahovat

`ludone-app`, session si vede vlastní plán v `orca/nahravky-v1`. Kontrakt domluvený:
URL `/nahravky/nahrat?clientRecordingId=…`, všechny parametry volitelné, **fáze 1 nahrává
prohlížeč** (žádný nový OAuth scope). LuTrack je z jejich rozsahu VENKU (BD-N38) a jeho
kontrakt určí aplikace.

⚠️ Běží jim PR na `/uploads/` allowlist. **Dan řekl, že veřejné PDF nabídky jsou ZÁMĚR** —
rozsah allowlistu si potvrzují přímo s ním, my do toho nezasahujeme.

## Pravidla, která tenhle běh zaplatil

- **Zelené testy nejsou ověření.** Dnešek našel čtyři vady, které stovky zelených testů přehlédly.
- 🔴 **Napřed ověř měřidlo, teprve pak obviň kód.** Pětkrát za den vypadala moje chybná
  příprava jako vada v implementaci.
- **Ochrana, která vypadá funkčně, se nemusí nikdy vykonat** — `if (permission === "display-capture")`
  se neuplatnilo nikdy, protože Electron posílá `media`.
- **Jeden hotspot soubor = jeden Codex job**, ne jen jeden worktree.
- **„Nechráněné" a „nechtěné" nejsou totéž** — než něco eskaluješ jako bezpečnostní nález,
  zjisti, co má být veřejné. Dnes mě to stálo Danův čas.
