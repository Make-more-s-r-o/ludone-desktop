import * as React from "react";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { RecordingsDashboard } from "../src/features/recordings/RecordingsDashboard.jsx";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { RecordingDayPreview } from "../src/features/recordings/RecordingDayPreview.jsx";

const ID = "9e586e55-d688-43f1-8a80-a3d61e754f3e";
const REVISION = `sha256:${"a".repeat(64)}`;
const actualRequire = createRequire(import.meta.url);
const ITEM = Object.freeze({
  id: ID,
  kind: "recording",
  state: "ceka",
  revision: REVISION,
  requiresHumanAction: true,
  ownership: "other",
  blockReason: "queue_owner_unknown",
  createdAt: "2026-09-14T10:00:00.000Z",
  durationMs: 65_000,
  sizeBytes: 2_500_000,
  source: "queue",
  localState: "complete-audio",
  fileRevision: `sha256:${"c".repeat(64)}`,
  allowedActions: { claim: true, delete: false, retry: false, send: false },
  path: "/tajne/porada.webm",
  ownerFingerprint: `sha256:${"f".repeat(64)}`,
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, reject, resolve };
}

/**
 * @param {{
 *   authState?: string,
 *   claimRecording?: (...args: any[]) => Promise<any>,
 *   deleteRecording?: (...args: any[]) => Promise<any>,
 *   listQueue?: () => Promise<any[]>,
 *   listLocalRecordings?: () => Promise<any>,
 *   verifyRecording?: (...args: any[]) => Promise<any>,
 *   openRecordingInLuDone?: (...args: any[]) => Promise<any>,
 *   retryRecording?: (...args: any[]) => Promise<any>,
 * }} options
 */
async function renderDashboard({
  authState = "signed-in",
  claimRecording = () => Promise.resolve({ claimed: false, items: [ITEM] }),
  deleteRecording = () => Promise.resolve({ outcome: "deleted" }),
  listQueue,
  listLocalRecordings = listQueue
    ? async () => ({ items: await listQueue(), unreadableCount: 0 })
    : () => Promise.resolve({ items: [ITEM], unreadableCount: 0 }),
  verifyRecording = () => Promise.resolve({}),
  openRecordingInLuDone = () => Promise.resolve({ opened: true }),
  retryRecording = () => Promise.resolve({ outcome: "sent" }),
} = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  const ludone = {
    claimRecording: vi.fn(claimRecording),
    deleteRecording: vi.fn(deleteRecording),
    listLocalRecordings: vi.fn(listLocalRecordings),
    verifyRecording: vi.fn(verifyRecording),
    openRecordingInLuDone: vi.fn(openRecordingInLuDone),
    retryRecording: vi.fn(retryRecording),
    revealRecording: vi.fn(async () => ({ outcome: "revealed" })),
  };
  Object.defineProperty(dom.window, "ludone", { configurable: true, value: ludone });
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("Node", dom.window.Node);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(dom.window.document.querySelector("#root"));
  await React.act(async () => {
    root.render(React.createElement(RecordingsDashboard, { authState, authIdentity: { email: "test@ludone.cz" }, authOrigin: "https://ludone.test" }));
  });
  await vi.waitFor(() => expect(ludone.listLocalRecordings).toHaveBeenCalledOnce());
  return {
    document: dom.window.document,
    async rerender(authState, email = "test@ludone.cz", authOrigin = "https://ludone.test") {
      await React.act(async () => root.render(React.createElement(RecordingsDashboard, { authState, authIdentity: email ? { email } : null, authOrigin })));
    },
    ludone,
    async cleanup() {
      await React.act(async () => root.unmount());
      dom.window.close();
    },
  };
}

function claimButton(dashboard) {
  return [...dashboard.document.querySelectorAll("button")]
    .find((button) => button.textContent.trim().includes("Převzít pod svůj účet"));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dashboard fronty nahrávek", () => {
  it("čekající schválená nahrávka po volbě firmy nabídne skutečné Zkusit znovu", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ludone-company-retry-ui-"));
    const manifestPath = path.join(root, "ceka.manifest.json");
    const microphonePath = path.join(root, "ceka-microphone.webm");
    const manifest = {
      schemaVersion: 1,
      clientRecordingId: ID,
      createdAt: "2026-09-14T10:00:00.000Z",
      closedAt: "2026-09-14T10:00:01.000Z",
      state: "complete",
      tracks: {
        microphone: {
          fileName: path.basename(microphonePath),
          sha256: "a".repeat(64),
          sizeBytes: 8,
          startedAt: "2026-09-14T10:00:00.000Z",
          endedAt: "2026-09-14T10:00:01.000Z",
        },
      },
    };
    try {
      await Promise.all([
        writeFile(manifestPath, JSON.stringify(manifest)),
        writeFile(microphonePath, "mikrofon"),
      ]);
      const { createLocalRecordingsSnapshot } = actualRequire("../electron/recordings-dashboard.cjs");
      const queue = { items: [{
        clientRecordingId: ID,
        kind: "recording",
        manifestPath,
        tracks: { microphone: microphonePath },
      }] };
      const projected = {
        ...ITEM,
        ownership: "current",
        uploadIntent: "approved",
        blockReason: "company_not_chosen",
        allowedActions: undefined,
      };
      const snapshot = await createLocalRecordingsSnapshot({
        queue,
        queueItems: [projected],
        recordingsDirectory: root,
      });
      expect(snapshot.items[0]).toMatchObject({
        allowedActions: { retry: true, send: false },
        localState: "complete-audio",
        ownership: "current",
        requiresHumanAction: true,
        state: "ceka",
        uploadIntent: "approved",
      });
      for (const protectedItem of [
        { ...projected, uploadIntent: "held" },
        { ...projected, state: "odesila" },
        { ...projected, state: "odeslano" },
        { ...projected, ownership: "other" },
        { ...projected, ownership: "unknown" },
      ]) {
        const protectedSnapshot = await createLocalRecordingsSnapshot({
          queue, queueItems: [protectedItem], recordingsDirectory: root,
        });
        expect(protectedSnapshot.items[0].allowedActions.retry).toBe(false);
      }

      const dashboard = await renderDashboard({
        listLocalRecordings: async () => snapshot,
      });
      try {
        const retry = [...dashboard.document.querySelectorAll("button")]
          .find((button) => button.textContent.trim() === "Zkusit znovu");
        expect(retry).toBeDefined();
        await React.act(async () => retry.click());
        await vi.waitFor(() => expect(dashboard.ludone.retryRecording).toHaveBeenCalledExactlyOnceWith({
          id: ID,
          queueRev: REVISION,
          fileRev: snapshot.items[0].fileRevision,
        }));
      } finally {
        await dashboard.cleanup();
      }
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("initialized nahrávce bez pinu ukáže bezpečný pokyn k volbě firmy", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ludone-company-binding-"));
    try {
      const { createLocalRecordingsSnapshot } = actualRequire("../electron/recordings-dashboard.cjs");
      const manifestPath = path.join(root, "chybi.manifest.json");
      const snapshot = await createLocalRecordingsSnapshot({
        queue: {
          items: [{
            clientRecordingId: ID,
            kind: "recording",
            manifestPath,
            tracks: { microphone: path.join(root, "chybi-microphone.webm") },
          }],
        },
        queueItems: [{ ...ITEM, blockReason: "company_binding_missing" }],
        recordingsDirectory: root,
      });
      expect(snapshot.items[0].blockReason)
        .toBe("U této rozpracované nahrávky nelze bezpečně určit firmu. Otevřete Nastavení.");
      expect(snapshot.items[0].blockReason).not.toContain("company_binding_missing");

      for (const blockReason of ["company_out_of_scope", "company_out_of_scope (HTTP 403)"]) {
        const rejected = await createLocalRecordingsSnapshot({
          queue: {
            items: [{
              clientRecordingId: ID,
              kind: "recording",
              manifestPath,
              tracks: { microphone: path.join(root, "chybi-microphone.webm") },
            }],
          },
          queueItems: [{ ...ITEM, blockReason }],
          recordingsDirectory: root,
        });
        expect(rejected.items[0].blockReason)
          .toBe("Vybraná firma nahrávku nepřijala. Vyberte jinou firmu v části Účet v Nastavení.");
      }
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("částečný koš zobrazí zachování souborů i queue položky", async () => {
    const deletable = {
      ...ITEM,
      ownership: "current",
      allowedActions: { ...ITEM.allowedActions, claim: false, delete: true },
    };
    const deleteRecording = vi.fn(async () => ({ outcome: "partial_failure" }));
    const dashboard = await renderDashboard({
      deleteRecording,
      listLocalRecordings: async () => ({ items: [deletable], unreadableCount: 0 }),
    });
    try {
      const button = [...dashboard.document.querySelectorAll("button")]
        .find((candidate) => candidate.textContent.trim() === "Přesunout do koše");
      await React.act(async () => button.click());
      await vi.waitFor(() => expect(dashboard.document.body.textContent)
        .toContain("Zbývající soubory i záznam ve frontě zůstaly zachované."));
      expect(deleteRecording).toHaveBeenCalledExactlyOnceWith({
        id: ID,
        queueRev: REVISION,
        fileRev: ITEM.fileRevision,
      });
    } finally {
      await dashboard.cleanup();
    }
  });
  it("server nevolá při renderu ani refreshi a ověří obě stopy jen po ručním kliku", async () => {
    const currentItem = { ...ITEM, ownership: "current", allowedActions: { ...ITEM.allowedActions, claim: false } };
    const verifyRecording = vi.fn(async () => ({
      id: ID,
      revision: REVISION,
      verifiedAt: "2026-09-14T12:00:00.000Z",
      tracks: {
        microphone: { status: "complete", mismatchFields: [] },
        system: { status: "mismatch", mismatchFields: ["sha256"] },
      },
    }));
    const dashboard = await renderDashboard({
      listLocalRecordings: () => Promise.resolve({ items: [currentItem], unreadableCount: 0 }),
      verifyRecording,
    });
    try {
      expect(verifyRecording).not.toHaveBeenCalled();
      const refresh = [...dashboard.document.querySelectorAll("button")]
        .find((button) => button.textContent.includes("Obnovit přehled"));
      await React.act(async () => refresh.click());
      expect(verifyRecording).not.toHaveBeenCalled();
      const verifyButton = [...dashboard.document.querySelectorAll("button")]
        .find((button) => button.textContent.includes("Ověřit v LuDone"));
      await React.act(async () => verifyButton.click());
      await vi.waitFor(() => expect(verifyRecording).toHaveBeenCalledExactlyOnceWith(ID, REVISION));
      expect(dashboard.document.body.textContent).toContain("Mikrofon: Na serveru je úplná");
      expect(dashboard.document.body.textContent).toContain("Systémový zvuk: Serverová data se neshodují");
      expect(dashboard.document.body.textContent).toContain("Ověřeno");
    } finally {
      await dashboard.cleanup();
    }
  });

  it("refresh změněné revize odstraní dřívější serverový výsledek", async () => {
    const nextRevision = `sha256:${"b".repeat(64)}`;
    const listLocalRecordings = vi.fn()
      .mockResolvedValueOnce({ items: [{ ...ITEM, ownership: "current" }], unreadableCount: 0 })
      .mockResolvedValue({ items: [{ ...ITEM, ownership: "current", revision: nextRevision }], unreadableCount: 0 });
    const dashboard = await renderDashboard({
      listLocalRecordings,
      verifyRecording: async () => ({
        id: ID, revision: REVISION, verifiedAt: "2026-09-14T12:00:00.000Z",
        tracks: { microphone: { status: "complete", mismatchFields: [] } },
      }),
    });
    try {
      const button = () => [...dashboard.document.querySelectorAll("button")]
        .find((candidate) => candidate.textContent.includes("Ověřit v LuDone"));
      await React.act(async () => button().click());
      await vi.waitFor(() => expect(dashboard.document.body.textContent).toContain("Na serveru je úplná"));
      const refresh = [...dashboard.document.querySelectorAll("button")]
        .find((candidate) => candidate.textContent.includes("Obnovit přehled"));
      await React.act(async () => refresh.click());
      await vi.waitFor(() => expect(listLocalRecordings).toHaveBeenCalledTimes(2));
      expect(dashboard.document.body.textContent).not.toContain("Na serveru je úplná");
    } finally {
      await dashboard.cleanup();
    }
  });

  it("pending ověření po refreshi nesmí zapsat výsledek staré revize", async () => {
    const pending = deferred();
    const dashboard = await renderDashboard({
      listLocalRecordings: () => Promise.resolve({ items: [{ ...ITEM, ownership: "current" }], unreadableCount: 0 }),
      verifyRecording: () => pending.promise,
    });
    try {
      const verifyButton = [...dashboard.document.querySelectorAll("button")]
        .find((candidate) => candidate.textContent.includes("Ověřit v LuDone"));
      await React.act(async () => verifyButton.click());
      const refresh = [...dashboard.document.querySelectorAll("button")]
        .find((candidate) => candidate.textContent.includes("Obnovit přehled"));
      await React.act(async () => refresh.click());
      await React.act(async () => pending.resolve({
        id: ID, revision: REVISION, verifiedAt: "2026-09-14T12:00:00.000Z",
        tracks: { microphone: { status: "complete", mismatchFields: [] } },
      }));
      expect(dashboard.document.body.textContent).not.toContain("Na serveru je úplná");
    } finally {
      await dashboard.cleanup();
    }
  });

  it("nabídne převzetí neznámého vlastníka bez chyby, ale ne vlastní 401", async () => {
    const dashboard = await renderDashboard({
      listQueue: () => Promise.resolve([
        {
          ...ITEM,
          blockReason: null,
          ownership: "unknown",
          requiresHumanAction: false,
        },
        {
          ...ITEM,
          id: "11111111-1111-4111-8111-111111111111",
          blockReason: "unauthorized",
          ownership: "current",
        },
      ]),
    });
    try {
      await vi.waitFor(() => expect(claimButton(dashboard)).toBeDefined());
      expect(dashboard.document.querySelectorAll(".recording-queue-card")).toHaveLength(2);
      expect([...dashboard.document.querySelectorAll(".recording-queue-card button")]
        .filter((button) => button.textContent.includes("Převzít pod svůj účet"))).toHaveLength(1);
    } finally {
      await dashboard.cleanup();
    }
  });

  it("nulovou velikost zobrazí jako 0 B a neplete ji s chybějící hodnotou", async () => {
    const dashboard = await renderDashboard({
      listQueue: () => Promise.resolve([{ ...ITEM, sizeBytes: 0 }]),
    });
    try {
      await vi.waitFor(() => expect(dashboard.document.body.textContent).toContain("0 B"));
      expect(dashboard.document.body.textContent).not.toContain("Velikost není známá");
      expect(dashboard.document.body.textContent).not.toContain("1 kB");
    } finally {
      await dashboard.cleanup();
    }
  });

  it("jiný účet může znovu převzít dosud drženou nahrávku", async () => {
    const dashboard = await renderDashboard({
      listQueue: () => Promise.resolve([{
        ...ITEM,
        blockReason: "Převzatá nahrávka čeká na volbu odeslání",
        ownership: "other",
      }]),
    });
    try {
      await vi.waitFor(() => expect(claimButton(dashboard)).toBeDefined());
      expect(claimButton(dashboard).disabled).toBe(false);
    } finally {
      await dashboard.cleanup();
    }
  });

  it("ukáže bezpečná fakta a dvojklik odešle jediný přesný claim", async () => {
    const pending = deferred();
    const listQueue = vi.fn()
      .mockResolvedValueOnce([ITEM])
      .mockResolvedValue([{
        ...ITEM,
        ownership: "current",
        blockReason: "Převzatá nahrávka čeká na volbu odeslání",
        allowedActions: { ...ITEM.allowedActions, claim: false },
      }]);
    const dashboard = await renderDashboard({ claimRecording: () => pending.promise, listQueue });
    try {
      await vi.waitFor(() => expect(claimButton(dashboard)).toBeDefined());
      const button = claimButton(dashboard);
      expect(dashboard.document.body.textContent).toContain("1 min 5 s");
      expect(dashboard.document.body.textContent).toContain("2,5 MB");
      expect(dashboard.document.body.textContent).toContain("Převzetí nahrávky ji neodešle");
      expect(dashboard.document.body.textContent).not.toContain("/tajne/porada.webm");
      expect(dashboard.document.body.textContent).not.toContain(ITEM.ownerFingerprint);

      await React.act(async () => {
        button.click();
        button.click();
        await Promise.resolve();
      });
      expect(dashboard.ludone.claimRecording).toHaveBeenCalledExactlyOnceWith(ID, REVISION);
      await React.act(async () => {
        pending.resolve({
          claimed: true,
          items: [{
            ...ITEM,
            revision: `sha256:${"b".repeat(64)}`,
            blockReason: "Převzatá nahrávka čeká na volbu odeslání",
            ownership: "current",
          }],
        });
        await pending.promise;
      });
      await vi.waitFor(() => expect(claimButton(dashboard)).toBeUndefined());
      expect(dashboard.document.body.textContent).toContain("Převzatá nahrávka čeká");
    } finally {
      await dashboard.cleanup();
    }
  });

  it("zrušené potvrzení ponechá položku i její akci beze změny", async () => {
    const dashboard = await renderDashboard();
    try {
      await vi.waitFor(() => expect(claimButton(dashboard)).toBeDefined());
      await React.act(async () => {
        claimButton(dashboard).click();
        await Promise.resolve();
      });
      await vi.waitFor(() => expect(dashboard.ludone.claimRecording).toHaveBeenCalledOnce());
      expect(dashboard.document.querySelector('[role="alert"]')).toBeNull();
      expect(claimButton(dashboard)).toBeDefined();
    } finally {
      await dashboard.cleanup();
    }
  });

  it("chyba převzetí nabídne čerstvé načtení a odliší jej od prázdného seznamu", async () => {
    const listQueue = vi.fn()
      .mockResolvedValueOnce([ITEM])
      .mockResolvedValueOnce([]);
    const dashboard = await renderDashboard({
      claimRecording: () => Promise.reject(new Error("stale revision")),
      listQueue,
    });
    try {
      await vi.waitFor(() => expect(claimButton(dashboard)).toBeDefined());
      await React.act(async () => {
        claimButton(dashboard).click();
        await Promise.resolve();
      });
      await vi.waitFor(() => {
        expect(dashboard.document.querySelector('[role="alert"]')?.textContent)
          .toContain("čerstvý seznam");
      });
      const reload = [...dashboard.document.querySelectorAll("button")]
        .find((button) => button.textContent.trim() === "Načíst znovu");
      await React.act(async () => {
        reload.click();
        await Promise.resolve();
      });
      await vi.waitFor(() => expect(listQueue).toHaveBeenCalledTimes(2));
      expect(dashboard.document.body.textContent).toContain("nejsou žádné nahrávky k zobrazení");
      expect(dashboard.document.querySelector('[role="alert"]')).toBeNull();
    } finally {
      await dashboard.cleanup();
    }
  });

  it("ruční obnovení vykreslí retention ghost, vadný souhrn a potom prázdný stav", async () => {
    const listLocalRecordings = vi.fn()
      .mockResolvedValueOnce({
        items: [{
          ...ITEM,
          id: "11111111-1111-4111-8111-111111111111",
          source: "orphan",
          state: "orphan",
          ownership: "unavailable",
          revision: null,
          sizeBytes: null,
          localState: "missing-audio",
          allowedActions: { claim: false, delete: true, retry: false, send: false },
        }],
        unreadableCount: 1,
      })
      .mockResolvedValueOnce({ items: [], unreadableCount: 0 });
    const dashboard = await renderDashboard({ listLocalRecordings });
    try {
      await vi.waitFor(() => expect(dashboard.document.body.textContent).toContain("Zvukové soubory chybí"));
      expect(dashboard.document.body.textContent).toContain("Jen na Macu");
      expect(dashboard.document.body.textContent).toContain("Poškozená data bez bezpečné identity");
      expect([...dashboard.document.querySelectorAll(".recording-queue-card button")]
        .map((button) => button.textContent.trim())).toEqual([
        "Ukázat ve Finderu",
        "Přesunout do koše",
      ]);
      const refresh = [...dashboard.document.querySelectorAll("button")]
        .find((button) => button.textContent.trim() === "Obnovit přehled");
      await React.act(async () => {
        refresh.click();
        await Promise.resolve();
      });
      await vi.waitFor(() => expect(listLocalRecordings).toHaveBeenCalledTimes(2));
      expect(dashboard.document.body.textContent).toContain("nejsou žádné nahrávky k zobrazení");
    } finally {
      await dashboard.cleanup();
    }
  });

  it("chyba prvního načtení není prázdný stav a tlačítko ji opraví", async () => {
    const listLocalRecordings = vi.fn()
      .mockRejectedValueOnce(new Error("rozbitý outgoing.json"))
      .mockResolvedValueOnce({ items: [ITEM], unreadableCount: 0 });
    const dashboard = await renderDashboard({ listLocalRecordings });
    try {
      await vi.waitFor(() => expect(dashboard.document.querySelector('[role="alert"]')).not.toBeNull());
      expect(dashboard.document.body.textContent).not.toContain("nejsou žádné nahrávky k zobrazení");
      const retry = [...dashboard.document.querySelectorAll("button")]
        .find((button) => button.textContent.trim() === "Načíst znovu");
      await React.act(async () => {
        retry.click();
        await Promise.resolve();
      });
      await vi.waitFor(() => expect(dashboard.document.body.textContent).toContain("Zvuk je kompletní"));
      expect(dashboard.document.querySelector('[role="alert"]')).toBeNull();
    } finally {
      await dashboard.cleanup();
    }
  });

  it.each([
    ["signed-out", "nejdřív přihlas"],
    ["expired", "Přihlášení vypršelo"],
    ["unknown", "není ověřený"],
  ])("stav %s vysvětlí blokaci a tlačítko zakáže", async (authState, explanation) => {
    const dashboard = await renderDashboard({ authState });
    try {
      await vi.waitFor(() => expect(claimButton(dashboard)).toBeDefined());
      expect(claimButton(dashboard).disabled).toBe(true);
      expect(dashboard.document.body.textContent).toContain(explanation);
      claimButton(dashboard).click();
      expect(dashboard.ludone.claimRecording).not.toHaveBeenCalled();
    } finally {
      await dashboard.cleanup();
    }
  });
});

describe("pravdivá úplnost místního zvuku", () => {
  it.each([
    ["complete", "systém", "complete-audio", null],
    ["incomplete", "systém", "partial-audio", "Nahrávka nebyla dokončena"],
    ["complete", "", "partial-audio", "Očekávaný zvukový soubor je prázdný"],
    ["complete", null, "partial-audio", null],
  ])("%s manifest a systémová stopa %s zachovají soubory i serverový stav", async (state, system, localState, reason) => {
    const root = await mkdtemp(path.join(tmpdir(), "ludone-local-integrity-"));
    const manifestPath = path.join(root, "integrity.manifest.json");
    const microphonePath = path.join(root, "integrity-microphone.webm");
    const systemPath = path.join(root, "integrity-system.webm");
    const createdAt = "2026-09-14T10:00:00.000Z";
    const endedAt = state === "incomplete" ? null : "2026-09-14T10:00:01.000Z";
    const track = (fileName, bytes) => ({ fileName, startedAt: createdAt, endedAt,
      sizeBytes: state === "incomplete" ? 0 : Buffer.byteLength(bytes),
      sha256: state === "incomplete" ? null : createHash("sha256").update(bytes).digest("hex"),
    });
    const manifestBytes = JSON.stringify({
      schemaVersion: 1, clientRecordingId: ID, createdAt, closedAt: endedAt, state,
      tracks: { microphone: track(path.basename(microphonePath), "mikrofon"), system: track(path.basename(systemPath), system ?? "systém") },
    });
    try {
      await writeFile(manifestPath, manifestBytes);
      await writeFile(microphonePath, "mikrofon");
      if (system !== null) await writeFile(systemPath, system);
      const { createLocalRecordingsSnapshot } = actualRequire("../electron/recordings-dashboard.cjs");
      const projected = { ...ITEM, state: "odeslano", ownership: "current", uploadIntent: "approved", blockReason: null };
      const snapshot = await createLocalRecordingsSnapshot({
        recordingsDirectory: root,
        queue: { items: [{ clientRecordingId: ID, kind: "recording", manifestPath,
          tracks: { microphone: microphonePath, system: systemPath } }] },
        queueItems: [projected],
      });
      const row = snapshot.items[0];
      expect(row).toMatchObject({ localState, state: "odeslano", ownership: "current", uploadIntent: "approved", revision: REVISION });
      expect(row.localReason).toEqual(reason === null ? null : expect.stringContaining(reason));
      const orphan = await createLocalRecordingsSnapshot({ recordingsDirectory: root, queue: { items: [] }, queueItems: [] });
      expect(orphan.items[0]).toMatchObject({ localState, localReason: row.localReason, source: "orphan", revision: null });
      const dashboard = await renderDashboard({ listLocalRecordings: async () => snapshot });
      expect(dashboard.document.body.textContent.includes("Zvuk je kompletní")).toBe(localState === "complete-audio");
      if (reason !== null) expect(dashboard.document.body.textContent).toContain(reason);
      expect(dashboard.document.querySelector('.recording-queue-card__journey li:last-child.is-complete')).toBeNull();
      expect(await readFile(manifestPath, "utf8")).toBe(manifestBytes);
      expect(await readFile(microphonePath, "utf8")).toBe("mikrofon");
      if (system !== null) expect(await readFile(systemPath, "utf8")).toBe(system);
      await dashboard.cleanup();
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});


describe("produktové dotažení dne", () => {
  it("dlouhou historii seskupí po místním dni a zachová chronologii i filtry", async () => {
    const items = Array.from({ length: 24 }, (_, index) => ({ ...ITEM,
      id: `9e586e55-d688-43f1-8a80-${String(index).padStart(12, "0")}`,
      createdAt: new Date(2026, 8, 29 + Math.floor(index / 12), index % 12).toISOString(),
      uploadIntent: index % 2 ? "approved" : "held",
    })).reverse();
    items.push({ ...ITEM, uploadIntent: "held", createdAt: "neplatné" });
    const dashboard = await renderDashboard({ listLocalRecordings: async () => ({ items }) });
    try {
      const days = [...dashboard.document.querySelectorAll("[data-day]")];
      expect(days.map((day) => day.getAttribute("data-day"))).toEqual(["2026-09-30", "2026-09-29", "unknown"]);
      expect(days[0].querySelectorAll("[data-recording-id]")).toHaveLength(12);
      expect([...days[0].querySelectorAll("time")].map((time) => time.dateTime)).toEqual(items.filter((item) => new Date(item.createdAt).getDate() === 30).map((item) => item.createdAt).sort());
      await React.act(async () => dashboard.document.querySelector('[data-filter="delivery"]').click());
      expect(dashboard.document.querySelectorAll("[data-recording-id]")).toHaveLength(12);
    } finally { await dashboard.cleanup(); }
  });

  it("aktivní nahrávání nehlásí poškození a blokuje akce jen své položky", async () => {
    const dashboard = await renderDashboard({ listLocalRecordings: async () => ({ items: [
      { ...ITEM, recordingInProgress: true, localState: "partial-audio", localReason: "Chybí dokončený soubor", allowedActions: { claim: true, send: true, delete: true, retry: true } },
      { ...ITEM, id: "9e586e55-d688-43f1-8a80-000000000002" },
    ] }) });
    try {
      const rows = dashboard.document.querySelectorAll("[data-recording-id]");
      expect(rows[0].textContent).toContain("Nahrává se");
      expect(rows[0].textContent).not.toContain("Chybí dokončený soubor");
      expect([...rows[0].querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
      expect(rows[1].querySelector("button").disabled).toBe(false);
    } finally { await dashboard.cleanup(); }
  });

  it("obnova a dočasný focus unknown zachovají ověření jen shodného účtu, originu a souboru", async () => {
    let item = { ...ITEM, ownership: "current", allowedActions: {} };
    const dashboard = await renderDashboard({ listLocalRecordings: async () => ({ items: [item] }),
      verifyRecording: async () => ({ id: ID, revision: REVISION, verifiedAt: "2026-09-30T10:00:00Z", tracks: { delivery: { status: "complete", mismatchFields: [] } } }),
    });
    try {
      await React.act(async () => dashboard.document.querySelector(".recording-action--verify").click());
      expect(dashboard.document.body.textContent).toContain("Otevřít v LuDone");
      await React.act(async () => [...dashboard.document.querySelectorAll("button")].find((button) => button.textContent.includes("Obnovit přehled")).click());
      expect(dashboard.document.body.textContent).toContain("Otevřít v LuDone");
      await React.act(async () => dashboard.document.querySelector(".recording-action--reveal").click());
      expect(dashboard.document.body.textContent).toContain("Otevřít v LuDone");
      await dashboard.rerender("unknown", null);
      expect(dashboard.document.body.textContent).not.toContain("Otevřít v LuDone");
      await dashboard.rerender("signed-in");
      expect(dashboard.document.body.textContent).toContain("Otevřít v LuDone");
      item = { ...item, fileRevision: `sha256:${"d".repeat(64)}` };
      await React.act(async () => [...dashboard.document.querySelectorAll("button")].find((button) => button.textContent.includes("Obnovit přehled")).click());
      expect(dashboard.document.body.textContent).not.toContain("Otevřít v LuDone");
      await React.act(async () => dashboard.document.querySelector(".recording-action--verify").click());
      await dashboard.rerender("signed-in", "test@ludone.cz", "https://other.test");
      expect(dashboard.document.body.textContent).not.toContain("Otevřít v LuDone");
      await React.act(async () => dashboard.document.querySelector(".recording-action--verify").click());
      await dashboard.rerender("signed-in", "other@ludone.cz", "https://other.test");
      expect(dashboard.document.body.textContent).not.toContain("Otevřít v LuDone");
      await React.act(async () => dashboard.document.querySelector(".recording-action--verify").click());
      await dashboard.rerender("expired", null, "https://other.test");
      expect(dashboard.document.body.textContent).not.toContain("Otevřít v LuDone");
      await dashboard.rerender("signed-in", "other@ludone.cz", "https://other.test");
      expect(dashboard.document.body.textContent).not.toContain("Otevřít v LuDone");
    } finally { await dashboard.cleanup(); }
  });
});

it("náhled má jediný skutečný vstup do dne a pravdivý probíhající stav", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(dom.window.document.querySelector("#root"));
  const open = vi.fn();
  try {
    await React.act(async () => root.render(React.createElement(RecordingDayPreview, { onOpenDay: open, items: [
      { kind: "recording", id: "test", title: "Porada", recordingInProgress: true, state: "ceka" },
    ] })));
    expect(dom.window.document.body.textContent).toContain("Nahrává se");
    expect(dom.window.document.querySelector(".day-preview__item > svg")).toBeNull();
    await React.act(async () => dom.window.document.querySelector("button").click());
    expect(open).toHaveBeenCalledOnce();
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
  }
});
