# Nezávislé review F Osa

Review provedl samostatný read-only pracovník Sol nad integračním diffem auth / IPC / queue / playback. Nepsal do integračního worktree.

Průběžné konkrétní P2 byly opraveny: tooltip při změně počtu bez změny ikony; refresh po dokončení a při začátku exportu; správný rodič potvrzení převzetí; výběr skutečného audio derivátu a jeho MIME místo Finder resolveru; neblokující otevření při výměně souboru za FIFO. Poslední závod pokrývá regresní test.

Finální doslovný závěr pracovníka:

> Finální read-only review: žádné další konkrétní P1/P2 nálezy v kontrolovaném auth/IPC/queue/playback diffu.
>
> FIFO závod je opraven přidáním O_NONBLOCK; nový regresní test přímo pokrývá výměnu za FIFO. Předchozí nálezy jsou uzavřené.
>
> test:capture-window má přiměřeně úzký rozsah: odmítá payload, ověřuje panel/settings odesílatele a hlavní rám, funguje pouze v nezabaleném IS_TEST_RUN + DESIGN_E2E a zachytí pouze vlastní okno. Nepřijímá cestu ani nezapisuje soubor.
>
> Výsledky posledního Electron E2E přebírám ze zprávy integrátora; v tomto review jsem je znovu nespouštěl. Fyzický poslech na Macu zůstává samostatnou přejímkou.

🧪 Review nad diffem není důkaz fyzické zvukové cesty. Neřeší prominutí starých červených bran.

## Pokračování — runtime, dependencies a detail guard

Čtecí Sol review schválilo pin Node 24.19.0, minimální Vitest 4.1.11 a kompatibilní patch opravy bez změny PNG/assertions. Oficiální CI distribuci nutno ověřit samostatně.

Detail guard review našlo konflikt `isQuitting` během update, trvale pending ACK a phantom dirty při načítání nabídky. Opraveno: update čeká na dirty detail, nonce má 30s timeout a reset při renderer-gone včetně epochu, editace hlásí samostatné onUserChange. Save volá configure CAS a ne upload. Testy guardu ověřují i cizí/staré nonce, selhání zápisu a změnu během dialogu.

Review přijalo pouze změny prostředí původních testů: skutečné otevření detailu pro settings-role služby; explicitní TAP reporter; typově ekvivalentní mock forwarding; doplnění skutečných závislostí F do tray factory. Každá původní assertion je zachována, včetně červených rozporů. Aktuální výpis 1568 PASS / 111 FAIL / 3 původní skipy není zelená přejímka.
