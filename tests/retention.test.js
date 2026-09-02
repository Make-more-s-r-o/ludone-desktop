import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import retention from "../electron/retention.cjs";
import { createManifest } from "../src/lib/manifest.js";
import {
  QUEUE_STATES,
  createQueue,
  enqueueRecording,
  enqueueTimeEntry,
  processNext,
} from "../src/lib/queue.js";

const { RETENTION_POLICIES, applyRetention, retentionMs } = retention;
const DAY_MS = 24 * 60 * 60 * 1_000;
const NOW = Date.parse("2026-09-02T12:00:00.000Z");
const ENABLED_SETTING = ["tr", "ue"].join("");

let temporaryDirectory;

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "ludone-retention-"));
});

afterEach(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

async function createQueuedRecording({
  queue = createQueue(),
  clientRecordingId = "9e586e55-d688-43f1-8a80-a3d61e754f3e",
  recordedAt = NOW - DAY_MS,
  suffix = "jedna",
}) {
  const microphonePath = path.join(temporaryDirectory, `${suffix}-mikrofon.webm`);
  const systemPath = path.join(temporaryDirectory, `${suffix}-system.webm`);
  const manifestPath = path.join(temporaryDirectory, `${suffix}.manifest.json`);
  const startedAt = new Date(recordedAt - 60_000).toISOString();
  const endedAt = new Date(recordedAt - 30_000).toISOString();
  const manifest = createManifest({
    clientRecordingId,
    createdAt: startedAt,
    closedAt: endedAt,
    tracks: {
      microphone: {
        fileName: path.basename(microphonePath),
        startedAt,
        endedAt,
        sizeBytes: 10,
        sha256: "a".repeat(64),
      },
      system: {
        fileName: path.basename(systemPath),
        startedAt,
        endedAt,
        sizeBytes: 10,
        sha256: "b".repeat(64),
      },
    },
  }, "complete");

  await Promise.all([
    writeFile(microphonePath, "mikrofon", { mode: 0o600 }),
    writeFile(systemPath, "system", { mode: 0o600 }),
    writeFile(manifestPath, JSON.stringify(manifest), { mode: 0o600 }),
  ]);

  const queued = enqueueRecording(queue, {
    manifest,
    manifestPath,
    trackPaths: { microphone: microphonePath, system: systemPath },
  }, recordedAt - 1_000).queue;

  return {
    queue: queued,
    microphonePath,
    systemPath,
    manifestPath,
  };
}

async function createSentRecording({ queue = createQueue(), sentAt, ...recordingOptions }) {
  const recording = await createQueuedRecording({
    ...recordingOptions,
    queue,
    recordedAt: sentAt - 30_000,
  });
  const sent = await processNext(recording.queue, {
    DESKTOP_UPLOAD_ENABLED: ENABLED_SETTING,
    DESKTOP_TIME_ENABLED: undefined,
  }, async () => {}, { now: sentAt });

  expect(sent.outcome).toBe("sent");
  expect(sent.item).toMatchObject({
    state: QUEUE_STATES.SENT,
    sentAt: new Date(sentAt).toISOString(),
  });
  return {
    ...recording,
    queue: sent.queue,
  };
}

describe("retence 7 dní", () => {
  it("smaže obě stopy nahrávky odeslané před osmi dny", async () => {
    const recording = await createSentRecording({ sentAt: NOW - 8 * DAY_MS });

    expect(existsSync(recording.microphonePath)).toBe(true);
    expect(existsSync(recording.systemPath)).toBe(true);

    await applyRetention({
      queue: recording.queue,
      policy: RETENTION_POLICIES.DNI_7,
      now: NOW,
    });

    expect(existsSync(recording.microphonePath)).toBe(false);
    expect(existsSync(recording.systemPath)).toBe(false);
  });

  it("«Ihned smazat» smaže hned po odeslání", async () => {
    const recording = await createSentRecording({ sentAt: NOW });

    expect(existsSync(recording.microphonePath)).toBe(true);
    expect(existsSync(recording.systemPath)).toBe(true);

    await applyRetention({
      queue: recording.queue,
      policy: RETENTION_POLICIES.IHNED,
      now: NOW,
    });

    expect(existsSync(recording.microphonePath)).toBe(false);
    expect(existsSync(recording.systemPath)).toBe(false);
  });

  it("nechá nahrávku odeslanou před šesti dny a smaže jen tu osmidenní", async () => {
    const oldRecording = await createSentRecording({
      clientRecordingId: "3d4e7b61-e3d4-483c-94cc-a512454f6976",
      sentAt: NOW - 8 * DAY_MS,
      suffix: "stara",
    });
    const freshRecording = await createSentRecording({
      queue: oldRecording.queue,
      clientRecordingId: "c45bb88a-b885-49c5-993d-01f75f41d845",
      sentAt: NOW - 6 * DAY_MS,
      suffix: "cerstva",
    });

    expect(existsSync(oldRecording.microphonePath)).toBe(true);
    expect(existsSync(oldRecording.systemPath)).toBe(true);
    expect(existsSync(freshRecording.microphonePath)).toBe(true);
    expect(existsSync(freshRecording.systemPath)).toBe(true);

    await applyRetention({
      queue: freshRecording.queue,
      policy: RETENTION_POLICIES.DNI_7,
      now: NOW,
    });

    expect(existsSync(oldRecording.microphonePath)).toBe(false);
    expect(existsSync(oldRecording.systemPath)).toBe(false);
    expect(existsSync(freshRecording.microphonePath)).toBe(true);
    expect(existsSync(freshRecording.systemPath)).toBe(true);
  });

  it("NEODESLANOU nahrávku nesmaže, ani když je stará osm dní", async () => {
    // 🔴 Tenhle test chyběl a odhalila to sabotáž, která zůstala ZELENÁ: nahradil jsem
    // podmínku `item.state === "odeslano"` literálem `true` — tedy stav, kdy se maže
    // i to, co nikam neodešlo — a všech 199 testů prošlo. Ochrana existovala, ale nikdo
    // ji neměřil, protože každý test pracoval s odeslanou položkou.
    //
    // Na cestě, která maže data, je to nejdražší možná díra: nahrávka, která se ještě
    // neodeslala, je jediná kopie toho, co se na schůzce řeklo.
    const recording = await createQueuedRecording({
      clientRecordingId: "9f1c2f5e-6a3b-4c8d-9e0f-1a2b3c4d5e6f",
      recordedAt: NOW - 8 * DAY_MS,
      suffix: "neodeslana",
    });

    // Kanárek: soubory před úklidem prokazatelně JSOU, a položka prokazatelně NENÍ odeslaná.
    expect(existsSync(recording.microphonePath)).toBe(true);
    expect(existsSync(recording.systemPath)).toBe(true);
    expect(recording.queue.items.at(-1).state).not.toBe(QUEUE_STATES.SENT);

    await applyRetention({
      queue: recording.queue,
      policy: RETENTION_POLICIES.DNI_7,
      now: NOW,
    });

    expect(existsSync(recording.microphonePath)).toBe(true);
    expect(existsSync(recording.systemPath)).toBe(true);
  });

  it("položka s časem odeslání, ale NEODESLANÝM stavem, přežije", async () => {
    // 🔴 Tenhle test dělá kontrolu stavu NOSNOU. Bez něj je `item.state === "odeslano"`
    // redundantní: neodeslaná položka nemá `sentAt`, takže ji stejně zachytí následující
    // `Number.isFinite(sentAtMs)`. Sabotáž, která kontrolu stavu odstraní, proto zůstávala
    // ZELENÁ — invariant přežil, protože ho nesla jiná podmínka.
    //
    // Dnes takový stav queue API nevyrobí (`sentAt` se nastavuje jen při odeslání a přechod
    // pryč ze SENT neexistuje). Až ho vyrobí — třeba opakovaným odesláním po chybě, které
    // si `sentAt` ponechá — bude tahle podmínka jediné, co brání smazání. Test to zamyká
    // dřív, než ta cesta vznikne.
    const recording = await createSentRecording({
      clientRecordingId: "5c7d9e11-2b4a-4d6f-8a1c-3e5f7a9b1d3e",
      sentAt: NOW - 8 * DAY_MS,
      suffix: "selhala-po-odeslani",
    });
    const polozka = recording.queue.items.at(-1);
    const queue = {
      ...recording.queue,
      items: [{ ...polozka, state: QUEUE_STATES.FAILED }],
    };

    expect(existsSync(recording.microphonePath)).toBe(true);
    expect(queue.items[0].sentAt).toBeTruthy();
    expect(queue.items[0].state).not.toBe(QUEUE_STATES.SENT);

    await applyRetention({ queue, policy: RETENTION_POLICIES.DNI_7, now: NOW });

    expect(existsSync(recording.microphonePath)).toBe(true);
    expect(existsSync(recording.systemPath)).toBe(true);
  });

  it("neznámá hodnota nastavení nemaže nic (fail-closed)", async () => {
    const recording = await createSentRecording({ sentAt: NOW - 400 * DAY_MS });

    expect(existsSync(recording.microphonePath)).toBe(true);
    expect(existsSync(recording.systemPath)).toBe(true);

    await applyRetention({
      queue: recording.queue,
      policy: "nesmysl z budoucí verze",
      now: NOW,
    });

    expect(existsSync(recording.microphonePath)).toBe(true);
    expect(existsSync(recording.systemPath)).toBe(true);
  });

  it("nekanonický čas odeslání nemaže nic (fail-closed)", async () => {
    const recording = await createSentRecording({ sentAt: NOW - 400 * DAY_MS });
    const queueWithInvalidSentAt = {
      ...recording.queue,
      items: recording.queue.items.map((item) => ({ ...item, sentAt: "0" })),
    };

    expect(existsSync(recording.microphonePath)).toBe(true);
    expect(existsSync(recording.systemPath)).toBe(true);

    await applyRetention({
      queue: queueWithInvalidSentAt,
      policy: RETENTION_POLICIES.DNI_7,
      now: NOW,
    });

    expect(existsSync(recording.microphonePath)).toBe(true);
    expect(existsSync(recording.systemPath)).toBe(true);
  });

  it("«Nemazat» nechá i rok starou odeslanou nahrávku na disku", async () => {
    const recording = await createSentRecording({ sentAt: NOW - 365 * DAY_MS });

    expect(existsSync(recording.microphonePath)).toBe(true);
    expect(existsSync(recording.systemPath)).toBe(true);

    await applyRetention({
      queue: recording.queue,
      policy: RETENTION_POLICIES.NEMAZAT,
      now: NOW,
    });

    expect(existsSync(recording.microphonePath)).toBe(true);
    expect(existsSync(recording.systemPath)).toBe(true);
  });

  it("nikdy nesmaže položku, která ještě nebyla odeslána", async () => {
    const recording = await createQueuedRecording({ recordedAt: NOW - 400 * DAY_MS });
    const oldDate = new Date(NOW - 400 * DAY_MS);
    await Promise.all([
      utimes(recording.microphonePath, oldDate, oldDate),
      utimes(recording.systemPath, oldDate, oldDate),
    ]);

    expect(existsSync(recording.microphonePath)).toBe(true);
    expect(existsSync(recording.systemPath)).toBe(true);

    await applyRetention({
      queue: recording.queue,
      policy: RETENTION_POLICIES.IHNED,
      now: NOW,
    });

    expect(existsSync(recording.microphonePath)).toBe(true);
    expect(existsSync(recording.systemPath)).toBe(true);
  });

  it("manifest zůstane na disku i po smazání obou stop", async () => {
    const recording = await createSentRecording({ sentAt: NOW - 8 * DAY_MS });
    const manifestBefore = await readFile(recording.manifestPath);

    expect(existsSync(recording.microphonePath)).toBe(true);
    expect(existsSync(recording.systemPath)).toBe(true);
    expect(existsSync(recording.manifestPath)).toBe(true);

    await applyRetention({
      queue: recording.queue,
      policy: RETENTION_POLICIES.DNI_7,
      now: NOW,
    });

    expect(existsSync(recording.microphonePath)).toBe(false);
    expect(existsSync(recording.systemPath)).toBe(false);
    expect(existsSync(recording.manifestPath)).toBe(true);
    expect(await readFile(recording.manifestPath)).toEqual(manifestBefore);
  });

  it("smaže nahrávku přesně na hranici sedmi dnů", async () => {
    const recording = await createSentRecording({ sentAt: NOW - 7 * DAY_MS });

    expect(existsSync(recording.microphonePath)).toBe(true);
    expect(existsSync(recording.systemPath)).toBe(true);

    await applyRetention({
      queue: recording.queue,
      policy: RETENTION_POLICIES.DNI_7,
      now: NOW,
    });

    expect(existsSync(recording.microphonePath)).toBe(false);
    expect(existsSync(recording.systemPath)).toBe(false);
  });

  it("chybějící stopu považuje za uklizenou a smaže druhou", async () => {
    const recording = await createSentRecording({ sentAt: NOW - 8 * DAY_MS });

    expect(existsSync(recording.microphonePath)).toBe(true);
    expect(existsSync(recording.systemPath)).toBe(true);
    await unlink(recording.microphonePath);
    expect(existsSync(recording.microphonePath)).toBe(false);

    const result = await applyRetention({
      queue: recording.queue,
      policy: RETENTION_POLICIES.DNI_7,
      now: NOW,
    });

    expect(existsSync(recording.systemPath)).toBe(false);
    expect(result.errors).toEqual([]);
    expect(result.deletedItems).toHaveLength(1);
    expect(result.keptItems).toEqual([]);
  });

  it("částečné selhání ponechá položku a nezastaví úklid další nahrávky", async () => {
    const partial = await createSentRecording({
      clientRecordingId: "5edc7c43-5fd6-42c8-920f-a6ef34125854",
      sentAt: NOW - 8 * DAY_MS,
      suffix: "castecna",
    });
    const complete = await createSentRecording({
      queue: partial.queue,
      clientRecordingId: "80ddb9de-8e4c-4f29-b943-317c6c06fd84",
      sentAt: NOW - 8 * DAY_MS,
      suffix: "dalsi",
    });

    expect(existsSync(partial.microphonePath)).toBe(true);
    expect(existsSync(partial.systemPath)).toBe(true);
    expect(existsSync(complete.microphonePath)).toBe(true);
    expect(existsSync(complete.systemPath)).toBe(true);
    await unlink(partial.systemPath);
    await mkdir(partial.systemPath);

    const result = await applyRetention({
      queue: complete.queue,
      policy: RETENTION_POLICIES.DNI_7,
      now: NOW,
    });

    expect(existsSync(partial.microphonePath)).toBe(false);
    expect(existsSync(partial.systemPath)).toBe(true);
    expect(existsSync(complete.microphonePath)).toBe(false);
    expect(existsSync(complete.systemPath)).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.keptItems).toContain(complete.queue.items[0]);
    expect(result.deletedItems).toContain(complete.queue.items[1]);
  });

  it("odeslanou časovou položku ignoruje a neskenuje dočasný adresář", async () => {
    const sentinelPath = path.join(temporaryDirectory, "cas-kanarek.webm");
    await writeFile(sentinelPath, "kanarek", { mode: 0o600 });
    const queued = enqueueTimeEntry(createQueue(), {
      clientTimeEntryId: "22bd8e2c-5e6e-47a5-b39a-7fa15eec5f8c",
      projectId: "b3d0d7ee-53c2-4bc9-9e74-59f7f62b799f",
      startedAt: "2026-08-20T08:00:00.000Z",
      endedAt: "2026-08-20T09:00:00.000Z",
    }, NOW - 8 * DAY_MS).queue;
    const sent = await processNext(queued, {
      DESKTOP_UPLOAD_ENABLED: undefined,
      DESKTOP_TIME_ENABLED: ENABLED_SETTING,
    }, async () => {}, { now: NOW - 8 * DAY_MS });

    expect(sent.outcome).toBe("sent");
    expect(existsSync(sentinelPath)).toBe(true);

    const result = await applyRetention({
      queue: sent.queue,
      policy: RETENTION_POLICIES.DNI_7,
      now: NOW,
    });

    expect(existsSync(sentinelPath)).toBe(true);
    expect(result.deletedItems).toEqual([]);
    expect(result.keptItems).toEqual(sent.queue.items);
  });

  it("mapuje přesné popisky nastavení na bezpečné doby retence", () => {
    expect(RETENTION_POLICIES).toEqual({
      IHNED: "Ihned smazat",
      HODINY_24: "24 hodin po odeslání",
      DNI_7: "7 dní po odeslání",
      DNI_30: "30 dní po odeslání",
      NEMAZAT: "Nemazat",
    });
    expect([
      retentionMs("Ihned smazat"),
      retentionMs("24 hodin po odeslání"),
      retentionMs("7 dní po odeslání"),
      retentionMs("30 dní po odeslání"),
      retentionMs("Nemazat"),
      retentionMs("neznámá hodnota"),
      retentionMs(undefined),
    ]).toEqual([
      0,
      DAY_MS,
      7 * DAY_MS,
      30 * DAY_MS,
      null,
      null,
      null,
    ]);
  });
});

describe("ui-smoke nastavuje retenci na hodnotu, která v nabídce existuje", () => {
  // Levný statický kanárek. `ui-smoke` potřebuje GUI a v CI ani v sandboxu neběží, takže
  // překlep v názvu volby by se projevil až u člověka — a zmateně: select by tiše zůstal
  // na původní hodnotě a test by spadl na „jiné hodnoty" místo na „takovou volbu neznám".
  const uiSmoke = readFileSync(new URL("../scripts/ui-smoke.mjs", import.meta.url), "utf8");
  const settings = readFileSync(new URL("../src/components/Settings.jsx", import.meta.url), "utf8");

  const volby = [...settings.matchAll(/<option>([^<]+)<\/option>/g)].map((m) => m[1]);

  it.each([
    ["OCEKAVANA_VYCHOZI_RETENCE"],
    ["NASTAVOVANA_RETENCE"],
  ])("%s je jedna z nabízených voleb", (jmeno) => {
    const nalez = new RegExp(`const ${jmeno} = "([^"]+)"`).exec(uiSmoke);
    expect(nalez, `konstanta ${jmeno} se v ui-smoke.mjs nenašla`).not.toBeNull();
    expect(volby).toContain(nalez[1]);
  });

  it("nastavovaná hodnota se LIŠÍ od výchozí, jinak by kontrola byla tautologie", () => {
    const vychozi = /const OCEKAVANA_VYCHOZI_RETENCE = "([^"]+)"/.exec(uiSmoke)[1];
    const nastavovana = /const NASTAVOVANA_RETENCE = "([^"]+)"/.exec(uiSmoke)[1];
    expect(nastavovana).not.toBe(vychozi);
  });

  it("očekávaná výchozí hodnota sedí s tou v Settings.jsx", () => {
    const vychoziVUi = /const OCEKAVANA_VYCHOZI_RETENCE = "([^"]+)"/.exec(uiSmoke)[1];
    const vychoziVKodu = /retention: "([^"]+)"/.exec(settings)[1];
    expect(vychoziVUi).toBe(vychoziVKodu);
  });
});
