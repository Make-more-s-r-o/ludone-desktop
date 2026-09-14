import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { RecordingsDashboard } from "../src/features/recordings/RecordingsDashboard.jsx";

const ID = "9e586e55-d688-43f1-8a80-a3d61e754f3e";
const REVISION = `sha256:${"a".repeat(64)}`;
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
 *   listQueue?: () => Promise<any[]>,
 *   listLocalRecordings?: () => Promise<any>,
 *   verifyRecording?: (...args: any[]) => Promise<any>,
 *   openRecordingInLuDone?: (...args: any[]) => Promise<any>,
 * }} options
 */
async function renderDashboard({
  authState = "signed-in",
  claimRecording = () => Promise.resolve({ claimed: false, items: [ITEM] }),
  listQueue,
  listLocalRecordings = listQueue
    ? async () => ({ items: await listQueue(), unreadableCount: 0 })
    : () => Promise.resolve({ items: [ITEM], unreadableCount: 0 }),
  verifyRecording = () => Promise.resolve({}),
  openRecordingInLuDone = () => Promise.resolve({ opened: true }),
} = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  const ludone = {
    claimRecording: vi.fn(claimRecording),
    listLocalRecordings: vi.fn(listLocalRecordings),
    verifyRecording: vi.fn(verifyRecording),
    openRecordingInLuDone: vi.fn(openRecordingInLuDone),
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
    root.render(React.createElement(RecordingsDashboard, { authState }));
  });
  await vi.waitFor(() => expect(ludone.listLocalRecordings).toHaveBeenCalledOnce());
  return {
    document: dom.window.document,
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
      expect(dashboard.document.body.textContent).toContain("Převzetí ji neodešle");
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
          allowedActions: { claim: false, delete: false, retry: false, send: false },
        }],
        unreadableCount: 1,
      })
      .mockResolvedValueOnce({ items: [], unreadableCount: 0 });
    const dashboard = await renderDashboard({ listLocalRecordings });
    try {
      await vi.waitFor(() => expect(dashboard.document.body.textContent).toContain("Zvukové soubory chybí"));
      expect(dashboard.document.body.textContent).toContain("Jen na Macu");
      expect(dashboard.document.body.textContent).toContain("Poškozená data bez bezpečné identity");
      expect(dashboard.document.querySelectorAll(".recording-queue-card button")).toHaveLength(0);
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
