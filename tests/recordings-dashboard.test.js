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
 * }} options
 */
async function renderDashboard({
  authState = "signed-in",
  claimRecording = () => Promise.resolve({ claimed: false, items: [ITEM] }),
  listQueue = () => Promise.resolve([ITEM]),
} = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  const ludone = {
    claimRecording: vi.fn(claimRecording),
    listQueue: vi.fn(listQueue),
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
  await vi.waitFor(() => expect(ludone.listQueue).toHaveBeenCalledOnce());
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
      expect(dashboard.document.querySelectorAll(".recording-queue-card button")).toHaveLength(1);
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
    const dashboard = await renderDashboard({ claimRecording: () => pending.promise });
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
      expect(dashboard.document.body.textContent).toContain("Ve frontě nejsou žádné nahrávky");
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
