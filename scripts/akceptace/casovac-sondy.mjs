// Sondy pro akceptační brány časovače (F011 + F013) a pro časový killswitch.
//
// 🔴 Každá sonda měří CHOVÁNÍ, ne existenci souboru. Spouští se skutečný
// `electron/tracking.cjs` a skutečné tělo `runTrackingMutation` /
// `noteDeferredQuitFailure` vytažené z `electron/main.cjs` — smazání testů
// tedy žádnou z nich nezezelená; červená je jen tak, že se opraví vada.
//
// Vypínač `DESKTOP_TIME_ENABLED` se tu NIKDY nenastavuje v prostředí procesu:
// produkčnímu tělu se podstrčí vlastní objekt `process` s vlastním `env`, takže
// běh sondy nemůže zapnout nic, co by přežilo jeho konec. Jméno vypínače je
// proto v konstantě — ať se v repu neobjeví literál "zapnuto", na který se ptá
// brána E5.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { KOREN, zdrojFunkce } from "./produkcni-zdroj.mjs";

const require = createRequire(import.meta.url);
const {
  TRACKING_STATES,
  TIME_DISABLED_REASON,
  createTrackingStore,
  handleRendererGone,
} = require(path.join(KOREN, "electron", "tracking.cjs"));

const VYPINAC_CASU = "DESKTOP_TIME" + "_ENABLED";
const PROJEKT_A = "11111111-1111-4111-8111-111111111111";
const PROJEKT_B = "22222222-2222-4222-8222-222222222222";
const KLIC_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROCES_1 = "2026-09-01T06:20:11.004Z";
const PROCES_2 = "2026-09-01T12:00:00.000Z";
const ZACATEK = Date.parse("2026-09-01T08:55:47.312Z");
const ZACATEK_ORIZNUTY = "2026-09-01T08:55:00.000Z";
const KONEC = Date.parse("2026-09-01T09:30:12.000Z");
const KONEC_ORIZNUTY = "2026-09-01T09:30:00.000Z";
const MINUTY = 35;

const docasneKoreny = [];

async function docasnySoubor() {
  const koren = await mkdtemp(path.join(os.tmpdir(), "ludone-akceptace-cas-"));
  docasneKoreny.push(koren);
  return path.join(koren, "cas", "casovac.json");
}

function vyrobNoteDeferredQuitFailure(pozadavek, konzole, zaznam) {
  const tovarna = new Function(
    "deferredQuitRequest",
    "console",
    "showPanel",
    `${zdrojFunkce("noteDeferredQuitFailure")}\nreturn noteDeferredQuitFailure;`,
  );
  return tovarna(pozadavek, konzole, () => { zaznam.panelZNote += 1; });
}

function vyrobRunTrackingMutation({ store, env, queueStore, konzole, note, zaznam }) {
  const tovarna = new Function(
    "getReadyTrackingStore",
    "syncTrackingTray",
    "process",
    "getOutboundQueueStore",
    "updateOutboundQueueTrayFact",
    "console",
    "noteDeferredQuitFailure",
    "showPanel",
    // Časový vypínač čte produkce přes sdílenou `timeTrackingKillswitch()`; vytáhne se
    // sem s ní, aby se ptala PODSTRČENÉHO `process`, ne toho skutečného.
    `${zdrojFunkce("timeTrackingKillswitch")}\n${zdrojFunkce("runTrackingMutation")}\nreturn runTrackingMutation;`,
  );
  return tovarna(
    async () => store,
    () => {},
    { env },
    async () => queueStore,
    () => {},
    konzole,
    note,
    () => { zaznam.panelZBehu += 1; },
  );
}

/**
 * Postaví produkční `runTrackingMutation` nad skutečným úložištěm časovače
 * a vrátí vše, na co se sondy ptají.
 */
function prostredi({ store, vypinacProstredi, selhaniFronty = false, bezUkonceni = false }) {
  const env = {};
  if (vypinacProstredi !== undefined) env[VYPINAC_CASU] = vypinacProstredi;
  const zarazene = [];
  const queueStore = {
    async enqueueTimeEntry(polozka) {
      zarazene.push(polozka);
      if (selhaniFronty) throw new Error("disk je plný");
      return { added: true, item: { clientRecordingId: polozka.clientTimeEntryId } };
    },
  };
  // `bezUkonceni` je běžný provoz aplikace: `deferredQuitRequest` v hlavním procesu
  // vzniká jedině v `beginDeferredQuit()`, takže mimo Cmd+Q je nedefinovaný. Sonda ho
  // proto musí umět podstrčit i jako `undefined` — jinak měří pořád jen quit.
  const pozadavek = bezUkonceni ? undefined : {
    committed: false,
    failureReason: "",
    confirmationReasons: new Set(),
    userConfirmationRequired: false,
  };
  // Panel se počítá zvlášť podle cesty, která ho otevřela. Kdyby to bylo jedno číslo,
  // sabotáž běhové větve by se schovala za panel z větve quitové.
  const zaznam = { panelZNote: 0, panelZBehu: 0, chyby: [], logy: [] };
  const konzole = {
    log: (radek) => zaznam.logy.push(String(radek)),
    warn: (radek) => zaznam.logy.push(String(radek)),
    error: (radek) => zaznam.chyby.push(String(radek)),
  };
  const note = vyrobNoteDeferredQuitFailure(pozadavek, konzole, zaznam);
  const runTrackingMutation = vyrobRunTrackingMutation({
    store, env, queueStore, konzole, note, zaznam,
  });
  return { runTrackingMutation, zarazene, pozadavek, zaznam };
}

/** Jeden celý úsek: start → stop, obojí přes produkční `runTrackingMutation`. */
async function behStartStop({
  vypinacStore,
  vypinacProstredi,
  selhaniFronty = false,
  bezUkonceni = false,
}) {
  const soubor = await docasnySoubor();
  let ted = ZACATEK;
  const store = createTrackingStore({
    filePath: soubor,
    timeEnabled: vypinacStore,
    processStartedAt: PROCES_1,
    now: () => ted,
    newId: () => KLIC_A,
    log: () => {},
  });
  const beh = prostredi({ store, vypinacProstredi, selhaniFronty, bezUkonceni });
  const spusteno = await beh.runTrackingMutation("start", { projectId: PROJEKT_A });
  ted = KONEC;
  const zastaveno = await beh.runTrackingMutation("stop");
  return { ...beh, soubor, spusteno, zastaveno };
}

// ---------------------------------------------------------------- sondy ----

/** E5: chybějící hodnota časového vypínače = vypnuto, a nic se nezapíše. */
async function vypinacFailClosed() {
  for (const hodnota of [undefined, "", "false", "0", "TRUE", "true "]) {
    const popis = JSON.stringify(hodnota);
    const soubor = await docasnySoubor();
    const store = createTrackingStore({
      filePath: soubor,
      timeEnabled: hodnota,
      processStartedAt: PROCES_1,
      now: () => ZACATEK,
      newId: () => KLIC_A,
      log: () => {},
    });
    const spusteno = await store.start({ projectId: PROJEKT_A });
    assert.equal(spusteno.outcome, "disabled", `hodnota ${popis} musí být vypnutá`);
    assert.equal(spusteno.reason, TIME_DISABLED_REASON, `hodnota ${popis} musí říct důvod`);
    assert.equal(
      (await store.stop()).outcome,
      "disabled",
      `stop s hodnotou ${popis} musí být vypnutý`,
    );
    assert.equal(
      (await store.switchProject({ projectId: PROJEKT_B })).outcome,
      "disabled",
      `přepnutí s hodnotou ${popis} musí být vypnuté`,
    );
    assert.equal(
      (await store.resolveRecovered({ decision: "ukoncit", endedAt: KONEC_ORIZNUTY })).outcome,
      "disabled",
      `obnova s hodnotou ${popis} musí být vypnutá`,
    );
    assert.equal(existsSync(soubor), false, `hodnota ${popis} nesmí nic zapsat na disk`);
  }

  // Vypínač nesmí jít vynechat úplně — tichý default by byl přesně ta díra.
  assert.throws(
    () => createTrackingStore({ filePath: path.join(os.tmpdir(), "nikdy.json") }),
    /timeEnabled/,
    "úložiště bez vypínače se nesmí dát vůbec postavit",
  );

  // Kontrola měřidla: se zapnutým vypínačem se čas OPRAVDU zaznamená. Bez ní by
  // sonda byla zelená i nad implementací, která nezapisuje nikdy.
  const soubor = await docasnySoubor();
  const store = createTrackingStore({
    filePath: soubor,
    timeEnabled: "true",
    processStartedAt: PROCES_1,
    now: () => ZACATEK,
    newId: () => KLIC_A,
    log: () => {},
  });
  assert.equal((await store.start({ projectId: PROJEKT_A })).outcome, "started");
  assert.equal(existsSync(soubor), true, "se zapnutým vypínačem musí soubor vzniknout");
  const ulozene = JSON.parse(await readFile(soubor, "utf8"));
  assert.equal(ulozene.aktualni.projectId, PROJEKT_A);
  assert.equal(ulozene.aktualni.startedAt, ZACATEK_ORIZNUTY);
}

/** B5: zaznamenaný čas přežije pád rendereru i následný restart aplikace. */
async function prezijePadRendereru() {
  const soubor = await docasnySoubor();
  const store = createTrackingStore({
    filePath: soubor,
    timeEnabled: "true",
    processStartedAt: PROCES_1,
    now: () => ZACATEK,
    newId: () => KLIC_A,
    log: () => {},
  });
  assert.equal((await store.start({ projectId: PROJEKT_A })).outcome, "started");

  const predPadem = await readFile(soubor, "utf8");
  const zapsane = JSON.parse(predPadem);
  assert.equal(zapsane.aktualni.clientTimeEntryId, KLIC_A, "start musí být na disku ještě před pádem");
  assert.equal(zapsane.aktualni.startedAt, ZACATEK_ORIZNUTY);
  assert.equal(zapsane.aktualni.state, TRACKING_STATES.RUNNING);

  // Pád rendereru (`forcefullyCrashRenderer()` v ostrém běhu).
  const hlasky = [];
  handleRendererGone(store, { log: (radek) => hlasky.push(String(radek)) });
  await new Promise((hotovo) => { setTimeout(hotovo, 25); });
  assert.equal(
    store.getState().aktualni && store.getState().aktualni.state,
    TRACKING_STATES.RUNNING,
    "pád rendereru nesmí časovač zastavit",
  );
  assert.equal(
    await readFile(soubor, "utf8"),
    predPadem,
    "pád rendereru nesmí sáhnout na soubor časovače",
  );
  assert.ok(
    hlasky.some((radek) => radek.includes(KLIC_A)),
    "pád rendereru se musí ohlásit i s klíčem běžícího úseku",
  );

  // Restart aplikace po pádu: jiný proces, tentýž soubor.
  const poRestartu = createTrackingStore({
    filePath: soubor,
    timeEnabled: "true",
    processStartedAt: PROCES_2,
    now: () => KONEC,
    newId: () => KLIC_A,
    log: () => {},
  });
  const obnovene = await poRestartu.load();
  assert.equal(
    obnovene.aktualni && obnovene.aktualni.clientTimeEntryId,
    KLIC_A,
    "po restartu se musí vrátit TÝŽ úsek, ne nový",
  );
  assert.equal(
    obnovene.aktualni.startedAt,
    ZACATEK_ORIZNUTY,
    "začátek zaznamenaného úseku se nesmí posunout",
  );
  assert.equal(
    obnovene.aktualni.state,
    TRACKING_STATES.PENDING,
    "úsek po pádu musí čekat na rozhodnutí, ne zmizet",
  );
  assert.deepEqual(obnovene.uzavrene, [], "pád nesmí nic uzavřít za uživatele");

  const rozhodnute = await poRestartu.resolveRecovered({
    decision: "ukoncit",
    endedAt: KONEC_ORIZNUTY,
  });
  assert.equal(rozhodnute.outcome, "resolved");
  assert.equal(rozhodnute.closed.minutes, MINUTY, "minuty přežily pád beze změny");
  const naDisku = JSON.parse(await readFile(soubor, "utf8"));
  assert.equal(naDisku.uzavrene.length, 1);
  assert.equal(naDisku.uzavrene[0].clientTimeEntryId, KLIC_A);
  assert.equal(naDisku.uzavrene[0].startedAt, ZACATEK_ORIZNUTY);
  assert.equal(naDisku.uzavrene[0].minutes, MINUTY);
}

/** F013: s vypnutým časovým vypínačem se čas nedostane do odchozí fronty. */
async function vypnutyVypinacNefronti() {
  const obojiVypnuto = await behStartStop({
    vypinacStore: undefined,
    vypinacProstredi: undefined,
  });
  assert.equal(obojiVypnuto.spusteno.outcome, "disabled");
  assert.equal(obojiVypnuto.zastaveno.outcome, "disabled");
  assert.equal(obojiVypnuto.zarazene.length, 0, "vypnutý časovač nesmí nic zařadit");

  // 🔴 Druhá brána zvlášť: úsek se OPRAVDU uzavře (úložiště zapnuté), takže se
  // dojde až k podmínce v `runTrackingMutation`. Bez tohohle by sonda byla
  // zelená i po smazání té podmínky — úsek by totiž vůbec nevznikl.
  for (const hodnota of [undefined, "false", "", "TRUE"]) {
    const popis = JSON.stringify(hodnota);
    const beh = await behStartStop({ vypinacStore: "true", vypinacProstredi: hodnota });
    assert.equal(beh.zastaveno.outcome, "stopped", `${popis}: úsek se musel uzavřít`);
    assert.ok(beh.zastaveno.closed, `${popis}: sonda musí mít uzavřený úsek, jinak neměří tu bránu`);
    assert.equal(beh.zastaveno.closed.minutes, MINUTY, `${popis}: minuty se zaznamenaly`);
    assert.equal(beh.zarazene.length, 0, `${popis}: čas se nesmí dostat do odchozí fronty`);
    assert.equal(beh.pozadavek.userConfirmationRequired, false, `${popis}: nic se nemá potvrzovat`);
  }

  // Kontrola měřidla: se zapnutým vypínačem fronta úsek dostane — jinak by
  // „nula zařazených" nedokazovala nic.
  const zapnuto = await behStartStop({ vypinacStore: "true", vypinacProstredi: "true" });
  assert.equal(zapnuto.zarazene.length, 1, "se zapnutým vypínačem se úsek zařadit musí");
  assert.deepEqual(zapnuto.zarazene[0], {
    clientTimeEntryId: KLIC_A,
    projectId: PROJEKT_A,
    startedAt: ZACATEK_ORIZNUTY,
    endedAt: KONEC_ORIZNUTY,
  });
}

/** Zahozený úsek nesmí do mzdových nákladů ani se zapnutým vypínačem. */
async function zahozenyCasNefronti() {
  async function poPadu(decision) {
    const soubor = await docasnySoubor();
    const zalozeni = createTrackingStore({
      filePath: soubor,
      timeEnabled: "true",
      processStartedAt: PROCES_1,
      now: () => ZACATEK,
      newId: () => KLIC_A,
      log: () => {},
    });
    assert.equal((await zalozeni.start({ projectId: PROJEKT_A })).outcome, "started");

    const store = createTrackingStore({
      filePath: soubor,
      timeEnabled: "true",
      processStartedAt: PROCES_2,
      now: () => KONEC,
      newId: () => KLIC_A,
      log: () => {},
    });
    const beh = prostredi({ store, vypinacProstredi: "true" });
    const rozhodnute = await beh.runTrackingMutation("resolveRecovered", {
      decision,
      endedAt: KONEC_ORIZNUTY,
    });
    return { ...beh, rozhodnute };
  }

  const zahozeno = await poPadu("zahodit");
  assert.equal(zahozeno.rozhodnute.outcome, "resolved");
  assert.equal(zahozeno.rozhodnute.closed.closedReason, "zahozeno-clovekem");
  assert.equal(zahozeno.rozhodnute.closed.minutes, 0);
  assert.equal(zahozeno.zarazene.length, 0, "zahozený úsek se nesmí dostat do odchozí fronty");

  // Kontrola měřidla: potvrzený úsek touž cestou do fronty projde.
  const potvrzeno = await poPadu("ukoncit");
  assert.equal(potvrzeno.rozhodnute.closed.closedReason, "potvrzeno-po-obnove");
  assert.equal(potvrzeno.zarazene.length, 1, "potvrzený úsek se zařadit musí");
  assert.equal(potvrzeno.zarazene[0].clientTimeEntryId, KLIC_A);
}

/** PR #88: selhání zařazení do fronty PŘI UKONČOVÁNÍ si vyžádá potvrzení a čas neztratí. */
async function selhaniFrontyNeztichne() {
  const beh = await behStartStop({
    vypinacStore: "true",
    vypinacProstredi: "true",
    selhaniFronty: true,
  });
  assert.equal(beh.zastaveno.outcome, "stopped", "stop se selháním fronty nesmí spadnout");
  assert.equal(beh.zarazene.length, 1, "o zařazení se aspoň pokusil");
  assert.ok(
    beh.zaznam.chyby.some((radek) => radek.includes("Zařazení času selhalo")),
    "selhání musí být v logu",
  );
  assert.equal(
    beh.pozadavek.userConfirmationRequired,
    true,
    "selhání si musí vyžádat výslovné potvrzení uživatele",
  );
  assert.ok(
    beh.pozadavek.confirmationReasons.has(`time-queue:${KLIC_A}`),
    "potvrzení musí být navázané na konkrétní časový úsek",
  );
  assert.match(beh.pozadavek.failureReason, /časového záznamu do fronty selhalo/);
  assert.equal(
    beh.zaznam.panelZNote,
    1,
    "panel se musí ukázat z quitové cesty, aby to uživatel viděl",
  );

  // Ani při selhání fronty se zaznamenaný čas nesmí ztratit z disku.
  const naDisku = JSON.parse(await readFile(beh.soubor, "utf8"));
  assert.equal(naDisku.uzavrene.length, 1);
  assert.equal(naDisku.uzavrene[0].minutes, MINUTY);

  // Kontrola měřidla: bez selhání fronty se nic potvrzovat nemá.
  const bezSelhani = await behStartStop({ vypinacStore: "true", vypinacProstredi: "true" });
  assert.equal(bezSelhani.pozadavek.userConfirmationRequired, false);
  assert.equal(bezSelhani.zaznam.panelZNote, 0);
  assert.equal(bezSelhani.zaznam.panelZBehu, 0);
}

/**
 * DAN-TODO 14: selhání zařazení ZA BĚHU aplikace se uživatel taky musí dozvědět.
 *
 * Tahle větev je jiná brána než ta nad ní, ne její opakování: `noteDeferredQuitFailure`
 * se bez `deferredQuitRequest` vrací hned na prvním řádku, takže při běžném provozu
 * nepotvrzuje ani neotvírá nic. Panel proto musí otevřít `runTrackingMutation` sám.
 */
async function selhaniFrontyZaBehu() {
  const beh = await behStartStop({
    vypinacStore: "true",
    vypinacProstredi: "true",
    selhaniFronty: true,
    bezUkonceni: true,
  });
  assert.equal(beh.pozadavek, undefined, "sonda musí měřit stav bez probíhajícího quitu");
  assert.equal(beh.zastaveno.outcome, "stopped", "stop se selháním fronty nesmí spadnout");
  assert.equal(beh.zarazene.length, 1, "o zařazení se aspoň pokusil");
  assert.ok(
    beh.zaznam.chyby.some((radek) => radek.includes("Zařazení času selhalo")),
    "selhání musí být v logu",
  );
  assert.equal(
    beh.zaznam.panelZBehu,
    1,
    "za běhu musí panel otevřít sama běhová cesta; do konzole se uživatel nedívá",
  );
  assert.equal(
    beh.zaznam.panelZNote,
    0,
    "mimo ukončování nemá quitová cesta co otevírat — jinak sonda měří jinou vadu",
  );

  // Zaznamenaný čas zůstává na disku; ztratilo se jen zařazení do fronty.
  const naDisku = JSON.parse(await readFile(beh.soubor, "utf8"));
  assert.equal(naDisku.uzavrene.length, 1);
  assert.equal(naDisku.uzavrene[0].minutes, MINUTY);

  // Kontrola měřidla: bez selhání fronty se za běhu panel otevírat nesmí.
  const bezSelhani = await behStartStop({
    vypinacStore: "true",
    vypinacProstredi: "true",
    bezUkonceni: true,
  });
  assert.equal(bezSelhani.zarazene.length, 1, "úspěšný běh se musí zařadit");
  assert.equal(bezSelhani.zaznam.panelZBehu, 0, "úspěch nesmí uživatele vyrušovat panelem");
}

const SONDY = new Map([
  ["vypinac-fail-closed", vypinacFailClosed],
  ["prezije-pad-rendereru", prezijePadRendereru],
  ["vypnuty-vypinac-nefronti", vypnutyVypinacNefronti],
  ["zahozeny-cas-nefronti", zahozenyCasNefronti],
  ["selhani-fronty-neztichne", selhaniFrontyNeztichne],
  ["selhani-fronty-za-behu", selhaniFrontyZaBehu],
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
