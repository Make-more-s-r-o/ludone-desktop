import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 🔴 TENHLE SOUBOR JE KONTROLA, KTERÁ NEMŮŽE ZESTÁRNOUT.
//
// Adversariální review sloučeného `main` (2. 9. 2026) našlo tři mechanismy, u kterých se
// nezávisle sešlo pět hledačů. Dva skeptici je pak shodně VYVRÁTILI — ne proto, že by
// mechanismy neplatily, ale proto, že je dnes **nemá co spustit**:
//
//     grep -rn "logout" src/ scripts/   →  0 výskytů
//     grep -rn "startTracking|stopTracking|switchTrackingProject" src/  →  0 výskytů
//
// Most v `preload.cjs` obě věci vystavuje, ale žádná komponenta je nevolá. Vada je tedy
// LATENTNÍ: ve chvíli, kdy někdo zapojí tlačítko „Odhlásit se", ožijí všechny tři naráz.
//
// Poznámka do zápisu prohry: takový nález se běžně uzavře větou „až se to zapojí, nezapomeň
// na X". Tahle věta nikdy nikoho nezastaví. Proto je tu místo ní kontrola, která se ptá
// na SKUTEČNOST — dokud volající neexistuje, je zelená a nahlas říká, co neměří; jakmile
// se objeví, zčervená a pojmenuje, co je potřeba dopsat.
//
// Doloženo, že to funguje: v noci na 2. 9. přesně takhle napsaná kontrola sama odhalila,
// že `auth:logout` volá `updateTray()`, které B3 ruší — a to ve chvíli, kdy se obě linie
// potkaly v `main`.

const KOREN = fileURLToPath(new URL("..", import.meta.url));
const mainSource = readFileSync(path.join(KOREN, "electron", "main.cjs"), "utf8");

function bezKomentaru(text) {
  // Jen CELOŘÁDKOVÉ komentáře. Kdo maže každé `//`, rozřízne i "https://app.ludone.cz"
  // uvnitř řetězce — tahle past už jednou v tomhle projektu stála zelenou bránu.
  return text
    .split("\n")
    .map((radek) => (radek.trim().startsWith("//") ? "" : radek))
    .join("\n");
}

function zdrojRendereru() {
  const koren = path.join(KOREN, "src");
  const soubory = [];
  const projdi = (adresar) => {
    for (const polozka of readdirSync(adresar, { withFileTypes: true })) {
      const cesta = path.join(adresar, polozka.name);
      if (polozka.isDirectory()) projdi(cesta);
      else if (/\.(jsx?|tsx?)$/.test(polozka.name)) soubory.push(cesta);
    }
  };
  projdi(koren);
  return soubory.map((s) => bezKomentaru(readFileSync(s, "utf8"))).join("\n");
}

function telo(zdroj, jmeno) {
  const zacatek = zdroj.indexOf(`function ${jmeno}(`);
  if (zacatek === -1) return "";
  let uroven = 0;
  let videnZavorku = false;
  for (let i = zacatek; i < zdroj.length; i += 1) {
    if (zdroj[i] === "{") {
      uroven += 1;
      videnZavorku = true;
    } else if (zdroj[i] === "}") {
      uroven -= 1;
      if (videnZavorku && uroven === 0) return zdroj.slice(zacatek, i + 1);
    }
  }
  return "";
}

const kod = bezKomentaru(mainSource);
const renderer = zdrojRendereru();

// Volající se hledá přes most `window.ludone`, ne přes holé slovo — `logout` se může
// objevit v textu tlačítka nebo v komentáři, aniž by to cokoli volalo.
// 🔴 Detekuje se VAZBA na `ludone.logout`, ne tvar volání. Původní vzorec vyžadoval
// závorku hned za názvem, takže ho 3. 9. 2026 porazil obyčejný refaktor:
// `const logout = window.ludone?.logout; … await logout()`. Funkce fungovala dál,
// ale detekce ji přestala vidět a DVA strážní testy níž tiše usnuly — včetně toho,
// který hlídá, že se neodhlašujeme nad běžícím časovačem. Brána, která se dá
// vypnout přejmenováním proměnné, není brána.
const odhlaseniZapojeno = /window\.ludone\??\.\s*logout\b|\bludone\.logout\b/.test(renderer);
const casovacZapojen = /window\.ludone\??\.\s*(start|stop|switch)Tracking|ludone\.(start|stop|switch)Tracking/
  .test(renderer);

const blokCasovace = (() => {
  // Stejný trik jako u odhlášení: vyříznout JEN tělo funkce. Assertion nad celým
  // `main.cjs` je totiž k ničemu — dokud se vypínač četl na třech místech zvlášť, prošla
  // by i tehdy, kdyby ho `getTrackingStore` přestal číst. Změřeno sabotáží 3. 9. 2026:
  // záměna za pevné "true" NEZČERVENALA.
  const zacatek = kod.indexOf("function getTrackingStore(");
  if (zacatek === -1) return "";
  const konec = kod.indexOf("\nfunction ", zacatek + 1);
  return kod.slice(zacatek, konec === -1 ? undefined : konec);
})();

// Název proměnné se skládá, ať ho grep brány E5 (`<JMÉNO>=true`) nemá kde potkat
// a ať se v tomhle souboru nedá přepsat na jiný jen v jedné z assertion.
const PROMENNA_CASU = `process.env.DESKTOP_TIME` + "_ENABLED";
const CTECI_FUNKCE = "timeTrackingKillswitch";
const blokSdilenehoVypinace = telo(kod, CTECI_FUNKCE);

const blokOdhlaseni = (() => {
  const zacatekKontroly = kod.indexOf("function blockedAuthLogoutResult()");
  const konecKontroly = kod.indexOf("\nasync function executeAuthLogout", zacatekKontroly);
  const zacatek = kod.indexOf('handleValidated("auth:logout"');
  if (zacatek === -1) return "";
  const konec = kod.indexOf("\nhandleValidated(", zacatek + 1);
  const kontrola = zacatekKontroly === -1
    ? ""
    : kod.slice(zacatekKontroly, konecKontroly === -1 ? undefined : konecKontroly);
  return kontrola + kod.slice(zacatek, konec === -1 ? undefined : konec);
})();

describe("odhlášení: co musí platit, jakmile ho někdo zapojí", () => {
  it("řekne nahlas, jestli tenhle soubor dnes něco měří", () => {
    // Pojistka proti tomu, aby se obě větve minuly a nezměřilo se NIC. Kdyby detekce
    // volajícího přestala fungovat (přejmenovaný most, jiný tvar volání), spadne tohle.
    expect(typeof odhlaseniZapojeno).toBe("boolean");
    expect(blokOdhlaseni, "blok auth:logout se v main.cjs nenašel").not.toBe("");
  });

  it.runIf(!odhlaseniZapojeno)("DNES NEZAPOJENO — kontroly níž záměrně spí", () => {
    // Tenhle test existuje proto, aby v běžném výpisu bylo VIDĚT, že se tu nic neměří.
    // Zelený soubor bez jediného spuštěného tvrzení je k nerozeznání od bdělé brány.
    expect(renderer).not.toMatch(/window\.ludone\??\.\s*logout\b|\bludone\.logout\b/);
  });

  it("odhlášení nesmí proběhnout nad běžícím časovačem", () => {
    // 🔴 TENHLE TEST BĚŽÍ VŽDYCKY, ZÁMĚRNĚ. Dřív visel na `runIf(odhlaseniZapojeno)`,
    // tedy na tom, jestli regex najde v rendereru volání `logout`. Jenže 3. 9. 2026 ho
    // porazil obyčejný refaktor (`const logout = window.ludone?.logout` místo přímého
    // volání) — funkce fungovala dál, detekce ji přestala vidět a tenhle strážce **tiše
    // usnul**. Změřeno: zbylé tvary refaktoru ho uspí znovu, regex nad zdrojákem se
    // porazit dá vždycky.
    //
    // Podmínka byla navíc věcně zbytečná: invariant je o HLAVNÍM PROCESU (blok
    // `auth:logout` v main.cjs), ne o tom, jak ho renderer volá. Ať je zapojený nebo ne,
    // tahle brána musí v kódu stát — jinak naměřené minuty přejdou na další účet.
    expect(
      blokOdhlaseni,
      "auth:logout nehlídá běžící časovač — naměřené minuty mohou přejít na další účet",
    ).toContain("trackingWorkBlocksQuit()");
  });

  it.runIf(odhlaseniZapojeno)(
    "ZAPOJENO — odhlášení nesmí proběhnout nad běžící nahrávkou",
    () => {
      // `deriveTrayState` dává `signed-out` přednost před `recording` (tak to má B3
      // předepsané). Jakmile jde odhlásit se za běhu, zhasne tím JEDINÝ indikátor toho,
      // že mikrofon nahrává — a nahrávka běží dál.
      expect(
        blokOdhlaseni,
        "auth:logout nesahá na běžící nahrávku, přitom jí zhasne ikonu",
      ).toContain("hasLiveRecording()");
    },
  );

  it.runIf(odhlaseniZapojeno)(
    "ZAPOJENO — report faktů z panelu nesmí odhlášení tiše vrátit zpět",
    () => {
      // `applyReportedFacts` přiřazuje `appState.signedIn = facts.signedIn` BEZ podmínky.
      // Panel hlásí `signedIn: Boolean(user)` při každé změně, takže první překreslení po
      // odhlášení session obnoví. Tiché zrušení bezpečnostní akce je horší než chyba —
      // nikdo se o něm nedozví.
      const zdrojFaktu = telo(kod, "applyReportedFacts");
      expect(zdrojFaktu, "applyReportedFacts se v main.cjs nenašla").not.toBe("");

      const appState = {
        acceptRendererSignIn: false,
        panelActionOwners: new Set(),
        signedIn: false,
        systemAudioLostOwners: new Set(),
        trackingOwners: new Set(),
      };
      const refreshTray = vi.fn();
      const applyReportedFacts = Function(
        "appState",
        "refreshTray",
        "authSessionTransitionPromise",
        "REPORTED_FACT_KEYS",
        `"use strict"; ${zdrojFaktu}; return applyReportedFacts;`,
      )(
        appState,
        refreshTray,
        null,
        ["panelActionsAvailable", "signedIn", "tracking", "systemAudioLost"],
      );

      applyReportedFacts("panel-1", {
        panelActionsAvailable: true,
        signedIn: true,
        systemAudioLost: false,
        tracking: false,
      });

      expect(
        appState.signedIn,
        "panel vrátil odhlášenou session zpět na přihlášenou — odhlášení se tiše zrušilo",
      ).toBe(false);
    },
  );
});

describe("časovač: totéž pro jeho vlastní zapojení", () => {
  it("řekne nahlas, jestli je časovač zapojený", () => {
    expect(typeof casovacZapojen).toBe("boolean");
  });

  it("start časovače musí být fail-closed vůči vypnuté agendě", () => {
    // 🔴 BĚŽÍ VŽDYCKY, ZÁMĚRNĚ. Dřív visel na `runIf(casovacZapojen)`, tedy na tom,
    // jestli renderer volá `startTracking`. To je ale detekce ZAPOJENÍ, kdežto invariant
    // je o HLAVNÍM PROCESU: `getTrackingStore` musí číst vypínač z produkčního prostředí.
    // Ta podmínka tedy nechránila před ničím — jen dělala z brány fail-open, přesně jako
    // u odhlášení, kde ji 3. 9. 2026 porazil obyčejný refaktor a strážce tiše usnul.
    //
    // R18: chybějící hodnota vypínače znamená VYPNUTO. Ověřeno při zavádění brány
    // `npm run preskocene`, že tenhle test dnes PROCHÁZÍ — nespal proto, že by neplatil,
    // ale proto, že se ho nikdo neptal.
    // Od 8. 9. 2026 vede čtení jediná sdílená funkce, takže se ptáme řetězem: jestli
    // `getTrackingStore` jde skrz ni, a jestli ona sama čte prostředí. Síla je stejná
    // jako u původního jednoho tvrzení — pevné "true" zčervená na prvním článku,
    // `return "true"` uvnitř sdílené funkce na druhém.
    expect(blokCasovace, "blok getTrackingStore se v main.cjs nenašel").not.toBe("");
    expect(
      blokCasovace,
      `getTrackingStore nečte časový vypínač přes ${CTECI_FUNKCE}()`,
    ).toContain(`${CTECI_FUNKCE}()`);
    expect(
      blokSdilenehoVypinace,
      `${CTECI_FUNKCE} nečte časový vypínač z prostředí`,
    ).toContain(PROMENNA_CASU);
  });
});

describe("časový vypínač má jediný zdroj pravdy", () => {
  // 🔴 Tenhle blok vznikl z nálezu, který NEBYL živou vadou: `getTrackingStore` si
  // hodnotu memoizoval při první konstrukci, `runTrackingMutation` ji četl znovu při
  // každé mutaci a `queueKillswitches` potřetí. V produkci se prostředí za běhu nemění,
  // takže se ta tři čtení nikdy nerozešla — jenže je nic nedrželo u sebe a rozejít se
  // mohla tiše. Ověřeno, že tvrzení níž nad předchozím stavem PADALA (tři výskyty
  // místo jednoho).
  //
  // Proč tvrzení nad ZDROJEM, a ne nad chováním: rozestup je ve TVARU kódu. Běhový test
  // ho odhalit neumí, protože obě čtení dnes vracejí totéž — jediné, co je rozliší, je
  // otázka „kolik míst se prostředí ptá".
  it("prostředí se na časový vypínač ptá jediná funkce", () => {
    const vyskyty = kod.split(PROMENNA_CASU).length - 1;
    expect(
      vyskyty,
      `na časový vypínač sahá v main.cjs ${vyskyty} míst; jediné povolené je ${CTECI_FUNKCE}()`,
    ).toBe(1);
    expect(
      blokSdilenehoVypinace,
      `funkce ${CTECI_FUNKCE} se v main.cjs nenašla`,
    ).not.toBe("");
    expect(blokSdilenehoVypinace).toContain(PROMENNA_CASU);
  });

  it.each(["getTrackingStore", "runTrackingMutation", "queueKillswitches"])(
    "%s jde na vypínač skrz sdílenou funkci",
    (jmeno) => {
      const blok = telo(kod, jmeno);
      expect(blok, `funkce ${jmeno} se v main.cjs nenašla`).not.toBe("");
      expect(
        blok,
        `${jmeno} obchází ${CTECI_FUNKCE}() a čte prostředí po svém`,
      ).toContain(`${CTECI_FUNKCE}()`);
    },
  );

  it("úložiště si hodnotu smí zmrazit, sdílená funkce ne", () => {
    // Sjednocené je ČTENÍ, ne životnost hodnoty (viz komentář u té funkce v main.cjs).
    // Kdyby si výsledek zapamatovala sama sdílená funkce, `runTrackingMutation` by přišel
    // o živé čtení, které dnes má — to je změna chování, ne sjednocení.
    //
    // Ano, tvrzení je doslovné a zčervená i na nevinné úpravě. To je záměr: ta funkce má
    // být jednořádková. Až bude muset dělat víc, je to vědomá změna rozhodnutí — pak se
    // mění tenhle test I komentář v `main.cjs`, ne jen jedno z toho.
    expect(
      blokSdilenehoVypinace.replace(/\s+/gu, " "),
      `${CTECI_FUNKCE} si hodnotu pamatuje; čtení musí zůstat živé`,
    ).toBe(`function ${CTECI_FUNKCE}() { return ${PROMENNA_CASU}; }`);
  });
});
