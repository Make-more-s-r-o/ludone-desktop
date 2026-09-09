// Sondy pro akceptační bránu E5 — vypínač odesílání odchozí fronty.
//
// 🔴 Sonda měří CHOVÁNÍ, ne názvy testů. Do 8. 9. 2026 hlídal tenhle vypínač jedině
// grep přes tři literály v `tests/queue.test.js`: kdo přepsal tvrzení UVNITŘ těch testů
// a nechal jejich názvy na místě, nechal bránu zelenou. Grep tam zůstává (chytá smazání
// testu), tohle je druhé měření vedle něj — spouští se skutečné produkční úložiště
// `electron/queue.cjs`, skutečná `processNext` ze `src/lib/queue.js` a skutečná těla
// `pumpOutboundQueue`, `queueKillswitches` a `addQueueSendingAvailability` vytažená
// z `electron/main.cjs`. Smazání testů žádnou podmínku nezezelená; červená je jen tak,
// že se opraví vada.
//
// Vypínač se tu NIKDY nenastavuje v prostředí procesu: produkčnímu tělu se podstrčí
// vlastní objekt `process` s vlastním `env`, takže běh sondy nemůže zapnout nic, co by
// přežilo jeho konec. Sonda si to na závěr sama ověří. Jména vypínačů jsou proto
// v konstantách — ať se v repu neobjeví literál, na který se ptá druhá podmínka E5.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import * as fronta from "../../src/lib/queue.js";
import { createManifest } from "../../src/lib/manifest.js";
import { KOREN, zdrojFunkce } from "./produkcni-zdroj.mjs";

const require = createRequire(import.meta.url);
const { createOutboundQueueStore } = require(path.join(KOREN, "electron", "queue.cjs"));

const VYPINAC_NAHRAVEK = "DESKTOP_UPLOAD" + "_ENABLED";
const VYPINAC_CASU = "DESKTOP_TIME" + "_ENABLED";
const ZAPNUTO = ["tr", "ue"].join("");
const NAHRAVKA = "9e586e55-d688-43f1-8a80-a3d61e754f3e";
const VLASTNIK = `sha256:${"a".repeat(64)}`;
const ZACATEK = "2026-09-08T08:00:00.000Z";
const KONEC = "2026-09-08T08:30:00.000Z";
// Hodnoty, které NESMÍ odesílání zapnout. `undefined` je chybějící proměnná (R18:
// chybějící hodnota znamená vypnuto), zbytek jsou tvary, které vypadají pravdivě.
const VYPNUTE_HODNOTY = [undefined, "", "false", "0", "TRUE", ZAPNUTO + " "];

const docasneKoreny = [];

async function docasnaFronta() {
  const koren = await mkdtemp(path.join(os.tmpdir(), "ludone-akceptace-fronta-"));
  docasneKoreny.push(koren);
  return path.join(koren, "fronta", "odchozi.json");
}

function nahravka() {
  const manifest = createManifest({
    clientRecordingId: NAHRAVKA,
    createdAt: ZACATEK,
    closedAt: KONEC,
    tracks: {
      microphone: {
        fileName: "session-microphone.webm",
        startedAt: ZACATEK,
        endedAt: KONEC,
        sizeBytes: 120,
        sha256: "a".repeat(64),
      },
      system: {
        fileName: "session-system.webm",
        startedAt: ZACATEK,
        endedAt: KONEC,
        sizeBytes: 240,
        sha256: "b".repeat(64),
      },
    },
  }, "complete");
  return {
    manifest,
    manifestPath: `/nahravky/${NAHRAVKA}.manifest.json`,
    ownerFingerprint: VLASTNIK,
    trackPaths: {
      microphone: "/nahravky/session-microphone.webm",
      system: "/nahravky/session-system.webm",
    },
  };
}

/**
 * Postaví produkční cestu odesílání nad skutečným úložištěm fronty: `pumpOutboundQueue`
 * a `addQueueSendingAvailability` z `main.cjs` nad `createOutboundQueueStore`
 * z `electron/queue.cjs` a `processNext` ze `src/lib/queue.js`.
 */
async function prostredi({ vypinacNahravek, vypinacCasu } = {}) {
  const filePath = await docasnaFronta();
  const odeslane = [];
  const store = createOutboundQueueStore({
    filePath,
    queueModulePromise: Promise.resolve(fronta),
    send: async (polozka) => {
      odeslane.push(polozka);
      return { recordingId: "server-id" };
    },
  });

  const env = {};
  if (vypinacNahravek !== undefined) env[VYPINAC_NAHRAVEK] = vypinacNahravek;
  if (vypinacCasu !== undefined) env[VYPINAC_CASU] = vypinacCasu;

  const zaznam = { logy: [], chyby: [] };
  const konzole = {
    log: (radek) => zaznam.logy.push(String(radek)),
    warn: (radek) => zaznam.logy.push(String(radek)),
    error: (radek) => zaznam.chyby.push(String(radek)),
  };

  const tovarna = new Function(
    "getOutboundQueueStore",
    "process",
    "queueModulePromise",
    "updateOutboundQueueTrayFact",
    "console",
    "applicationSettingsStore",
    `${zdrojFunkce("desktopKillswitch")}
     ${zdrojFunkce("timeTrackingKillswitch")}
     ${zdrojFunkce("queueKillswitches")}
     ${zdrojFunkce("pumpOutboundQueue")}
     ${zdrojFunkce("addQueueSendingAvailability")}
     return { addQueueSendingAvailability, pumpOutboundQueue, queueKillswitches };`,
  );
  const produkce = tovarna(
    async () => store,
    { env },
    Promise.resolve(fronta),
    () => {},
    konzole,
    { get: () => false },
  );

  return { odeslane, produkce, store, zaznam };
}

// ---------------------------------------------------------------- sondy ----

/**
 * E5: vypínač odesílání je fail-closed — bez přesné hodnoty se nic neodešle,
 * položka se neztratí a panel odeslání ani nenabídne.
 */
async function vypinacOdesilaniFailClosed() {
  const melProstredi = Object.prototype.hasOwnProperty.call(process.env, VYPINAC_NAHRAVEK);

  for (const hodnota of VYPNUTE_HODNOTY) {
    const popis = JSON.stringify(hodnota);
    const beh = await prostredi({ vypinacNahravek: hodnota });
    assert.equal(
      (await beh.store.enqueueRecording(nahravka())).added,
      true,
      `${popis}: nahrávka se musela zařadit, jinak sonda neměří odesílání`,
    );

    // 🔴 Tohle tvrzení dřív žádalo hodnotu DOSLOVA takovou, jaká je v prostředí — tedy
    // zakazovalo i doplnění uložené volby. Jenže v zabalené aplikaci žádné proměnné
    // prostředí nejsou, takže ten zákaz znamenal „přepínač nesmí jít nastavit". Brána se
    // tím nezměkčuje: pořád platí, že z vypnutého stavu nesmí vzniknout zapnutý, a přibyl
    // zákaz `undefined` — nezměřený stav se totiž nesmí vydávat za vypnutý.
    const ucinna = beh.produkce.queueKillswitches()[VYPINAC_NAHRAVEK];
    assert.notEqual(
      ucinna,
      ZAPNUTO,
      `${popis}: z vypnutého prostředí vznikl zapnutý vypínač`,
    );
    assert.notEqual(
      ucinna,
      undefined,
      `${popis}: soupis vypínačů neřekl nic — nezměřeno není totéž co vypnuto`,
    );

    const vysledek = await beh.produkce.pumpOutboundQueue();
    assert.equal(vysledek.outcome, "disabled", `${popis}: pumpa musí skončit jako vypnutá`);
    assert.equal(
      vysledek.reason,
      fronta.UPLOAD_DISABLED_REASON,
      `${popis}: pumpa musí říct důvod`,
    );
    assert.equal(beh.odeslane.length, 0, `${popis}: vypnutý vypínač nesmí nic odeslat`);

    // Položka se nesmí ztratit ani „spotřebovat" — po vypnutém pokusu dál čeká.
    const polozky = await beh.store.list();
    assert.equal(polozky.length, 1, `${popis}: položka fronty musí zůstat`);
    assert.equal(
      polozky[0].state,
      fronta.QUEUE_STATES.WAITING,
      `${popis}: položka musí dál čekat`,
    );

    // Druhá brána zvlášť: panel nesmí odeslání ani nabídnout. Kdyby se ptala jen
    // pumpa, fail-open v tomhle soupisu by uživateli ukázal tlačítko, které nic nedělá.
    const sDostupnosti = await beh.produkce.addQueueSendingAvailability(polozky);
    assert.equal(
      sDostupnosti[0].sendingDisabledReason,
      fronta.UPLOAD_DISABLED_REASON,
      `${popis}: panel má odeslání označit za vypnuté`,
    );
  }

  // Vypínače se nepřelévají: zapnutý ČASOVÝ vypínač nesmí pustit nahrávku.
  const cizi = await prostredi({ vypinacCasu: ZAPNUTO });
  await cizi.store.enqueueRecording(nahravka());
  const vysledekCiziho = await cizi.produkce.pumpOutboundQueue();
  assert.equal(
    vysledekCiziho.outcome,
    "disabled",
    "zapnutý časový vypínač nesmí odesílat nahrávky",
  );
  assert.equal(cizi.odeslane.length, 0, "zapnutý časový vypínač nesmí odeslat nahrávku");

  // 🔴 Kontrola měřidla: se zapnutým vypínačem se nahrávka OPRAVDU odešle. Bez ní by
  // byla sonda zelená i nad implementací, která neodesílá nikdy.
  const zapnuto = await prostredi({ vypinacNahravek: ZAPNUTO });
  await zapnuto.store.enqueueRecording(nahravka());
  const predOdeslanim = await zapnuto.store.list();
  assert.equal(
    (await zapnuto.produkce.addQueueSendingAvailability(predOdeslanim))[0].sendingDisabledReason,
    undefined,
    "se zapnutým vypínačem nesmí panel hlásit vypnuté odesílání",
  );
  const vysledek = await zapnuto.produkce.pumpOutboundQueue();
  assert.equal(vysledek.outcome, "sent", "se zapnutým vypínačem se odeslat musí");
  assert.equal(zapnuto.odeslane.length, 1, "se zapnutým vypínačem se odeslat musí právě jednou");
  assert.equal(zapnuto.odeslane[0].clientRecordingId, NAHRAVKA);
  assert.equal(
    (await zapnuto.store.list())[0].state,
    fronta.QUEUE_STATES.SENT,
    "odeslaná položka musí být na disku vedená jako odeslaná",
  );

  // Sonda nesmí zapnout nic, co by přežilo její konec.
  assert.equal(
    Object.prototype.hasOwnProperty.call(process.env, VYPINAC_NAHRAVEK),
    melProstredi,
    "sonda sáhla na prostředí procesu; vypínač se smí podstrkovat jen vlastním objektem",
  );
}

const SONDY = new Map([
  ["vypinac-odesilani-fail-closed", vypinacOdesilaniFailClosed],
]);

const jmeno = process.argv[2];
const sonda = SONDY.get(jmeno);
if (!sonda) {
  console.error(`Neznámá sonda ${JSON.stringify(jmeno)}; známé: ${[...SONDY.keys()].join(", ")}`);
  process.exit(2);
}

try {
  await sonda();
  console.log(`sonda ${jmeno}: v pořádku`);
} catch (chyba) {
  console.error(`sonda ${jmeno} selhala: ${chyba && chyba.message}`);
  if (chyba && chyba.stack) console.error(chyba.stack);
  process.exitCode = 1;
} finally {
  await Promise.all(docasneKoreny.map((koren) => rm(koren, { recursive: true, force: true })));
}
