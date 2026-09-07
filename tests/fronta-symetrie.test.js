import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");

// 🔴 Test se dívá na KÓD, ne na prózu. Bez tohohle kroku by ho uspokojil komentář,
// který zmiňuje `noteDeferredQuitFailure` — a přesně takhle už jednou v tomhle
// repozitáři prošla sabotáž. Mažeme jen CELOŘÁDKOVÉ komentáře: kdo by mazal každé
// `//`, rozřízne i adresu uvnitř řetězce.
const kodBezKomentaru = mainSource
  .split("\n")
  .map((radek) => (radek.trim().startsWith("//") ? "" : radek))
  .join("\n");

/** Vrátí tělo `catch` bloku, který následuje po daném volání. */
function catchBlokPo(zdroj, volani) {
  const start = zdroj.indexOf(volani);
  if (start === -1) return null;
  const catchIndex = zdroj.indexOf("} catch", start);
  if (catchIndex === -1) return null;
  const otevreni = zdroj.indexOf("{", zdroj.indexOf(")", catchIndex));
  let hloubka = 0;
  for (let i = otevreni; i < zdroj.length; i += 1) {
    if (zdroj[i] === "{") hloubka += 1;
    if (zdroj[i] === "}") {
      hloubka -= 1;
      if (hloubka === 0) return zdroj.slice(otevreni, i + 1);
    }
  }
  return null;
}

describe("obě cesty do odchozí fronty se brání stejně", () => {
  // Nahrávka a záznam času zařazují do TÉŽE fronty a selhat můžou stejně. Přesto
  // se rozešly: nahrávka uživatele zastavila, čas jen zapsal do konzole — záznam
  // zůstal lokálně uzavřený, do fronty se nedostal a nikdo se to nedozvěděl.
  //
  // Ten rozdíl nikdo nezvolil; vznikl tím, že se ty cesty psaly zvlášť. Chování
  // hlídají testy v `queue-wiring`, tenhle hlídá SYMETRII — aby se nerozešly znovu,
  // až někdo přidá třetí druh záznamu nebo jednu z větví přepíše.
  it.each([
    ["nahrávka", "store.enqueueRecording("],
    ["záznam času", "queueStore.enqueueTimeEntry("],
  ])("%s: selhání zařazení si vyžádá potvrzení uživatele", (_popis, volani) => {
    const blok = catchBlokPo(kodBezKomentaru, volani);

    expect(blok, `catch blok po ${volani} se nenašel`).not.toBeNull();
    expect(blok).toContain("noteDeferredQuitFailure");
    expect(blok).toContain("requiresUserConfirmation: true");
    expect(blok).toContain("confirmationReason:");
  });
});

describe("odeslání se ptá na PLATNOU relaci, ne na jakoukoli", () => {
  // Chování hlídá `queue-wiring`. Tenhle zámek je jiného DRUHU: čte zdroj a trvá na
  // přesném porovnání. Sabotáž `!== "valid"` → `=== "none"` totiž propustí vypršelou
  // relaci k odeslání a v diffu vypadá jako drobná úprava podmínky.
  it("recordingUploadContext porovnává proti valid, ne proti opaku none", () => {
    const zacatek = kodBezKomentaru.indexOf("async function recordingUploadContext(");
    expect(zacatek, "funkce recordingUploadContext se nenašla").toBeGreaterThan(-1);
    const telo = kodBezKomentaru.slice(zacatek, zacatek + 600);

    expect(telo).toContain('storedAuthSessionState(storedSession) !== "valid"');
  });
});
