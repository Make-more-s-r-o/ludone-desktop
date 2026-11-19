import * as React from "react";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
const dashboardModule = /** @type {Promise<{ RecordingsDashboard: React.ComponentType<any> }>} */
  (vi.importActual("../src/features/recordings/RecordingsDashboard.jsx"));
const dayPreviewModule = /** @type {Promise<{ RecordingDayPreview: React.ComponentType<any> }>} */
  (vi.importActual("../src/features/recordings/RecordingDayPreview.jsx"));
const osaShellModule = /** @type {Promise<{ OsaShell: React.ComponentType<{ page: string, children?: React.ReactNode }> }>} */
  (vi.importActual("../src/components/osa/OsaShell.jsx"));
const settingsModule = /** @type {Promise<{ SettingsApp: React.ComponentType }>} */
  (vi.importActual("../src/components/Settings.jsx"));
const { RecordingsDashboard } = await dashboardModule;
const { RecordingDayPreview } = await dayPreviewModule;
const { OsaShell } = await osaShellModule;
const { SettingsApp } = await settingsModule;

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
 *   detailId?: string|null,
 *   exportRecordingCopy?: (...args: any[]) => Promise<any>,
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
  detailId = null,
  exportRecordingCopy = () => Promise.resolve({ ok: true, fileName: "LuDone-porada.webm" }),
  listQueue,
  listLocalRecordings = listQueue
    ? async () => ({ items: await listQueue(), unreadableCount: 0 })
    : () => Promise.resolve({ items: [ITEM], unreadableCount: 0 }),
  verifyRecording = () => Promise.resolve({}),
  openRecordingInLuDone = () => Promise.resolve({ opened: true }),
  retryRecording = () => Promise.resolve({ outcome: "sent" }),
} = {}) {
  const dom = new JSDOM('<div class="settings-content"><div id="root"></div></div>', { url: "https://ludone.test" });
  dom.window.confirm = vi.fn(() => true);
  const ludone = {
    claimRecording: vi.fn(claimRecording),
    deleteRecording: vi.fn(deleteRecording),
    exportRecordingCopy: vi.fn(exportRecordingCopy),
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
    root.render(React.createElement(RecordingsDashboard, { authState, detailId, authIdentity: { email: "test@ludone.cz" }, authOrigin: "https://ludone.test" }));
  });
  await vi.waitFor(() => expect(ludone.listLocalRecordings).toHaveBeenCalledOnce());
  return {
    document: dom.window.document,
    async rerender(authState, email = "test@ludone.cz", authOrigin = "https://ludone.test") {
      await React.act(async () => root.render(React.createElement(RecordingsDashboard, { authState, detailId, authIdentity: email ? { email } : null, authOrigin })));
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
    .find((button) => button.textContent.trim().includes("Převzít a odeslat"));
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
      const automatic = await createLocalRecordingsSnapshot({
        queue, queueItems: [{ ...projected, requiresHumanAction: false, blockReason: null,
          lastFailureReason: "Síťový požadavek uploadu vypršel", nextAttemptAt: 1_800_000_000_000 }],
        recordingsDirectory: root,
      });
      expect(automatic.items[0]).toMatchObject({ blockReason: null, nextAttemptAt: 1_800_000_000_000,
        allowedActions: { retry: false } });
      for (const [blockReason, expected] of [
        ["unauthorized (HTTP 401)", "Server odmítl odeslání."],
        ["insufficient_scope (HTTP 403)", "Přihlášení nemá oprávnění k odeslání."],
        ["Není vybraná firma, pod kterou se má nahrávka odeslat", "Před odesláním je potřeba vybrat firmu."],
        ["Rozpracovaná nahrávka nemá bezpečně uloženou firmu; otevřete Nastavení", "U této rozpracované nahrávky nelze bezpečně určit firmu. Otevřete Nastavení."],
        ["403 company_out_of_scope", "Vybraná firma nahrávku nepřijala. Vyberte jinou firmu v části Účet v Nastavení."],
        ["Seznam firem se nepodařilo získat; zkontrolujte přihlášení a spojení", "Seznam firem není dostupný."],
      ]) {
        const blocked = await createLocalRecordingsSnapshot({ queue,
          queueItems: [{ ...projected, blockReason }], recordingsDirectory: root });
        expect(blocked.items[0].blockReason).toBe(expected);
      }
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
    const deleteRecording = vi.fn(async () => ({ outcome: "partial_failure", reason: "file_changed" }));
    const dashboard = await renderDashboard({
      deleteRecording,
      listLocalRecordings: async () => ({ items: [deletable], unreadableCount: 0 }),
    });
    try {
      const button = [...dashboard.document.querySelectorAll("button")]
        .find((candidate) => candidate.textContent.trim() === "Smazat nahrávku");
      await React.act(async () => button.click());
      await vi.waitFor(() => expect(dashboard.document.body.textContent)
        .toContain("Soubor se změnil během přesunu do koše."));
      expect(dashboard.document.body.textContent)
        .toContain("Zbývající soubory i záznam ve frontě zůstaly zachované.");
      expect(deleteRecording).toHaveBeenCalledExactlyOnceWith({
        id: ID,
        queueRev: REVISION,
        fileRev: ITEM.fileRevision,
      });
    } finally {
      await dashboard.cleanup();
    }
  });

  it.each([
    ["guard_changed", "Bezpečný stav pro mazání už nelze potvrdit."],
    ["access_denied", "macOS nepovolil přístup k některému souboru."],
    ["trash_failed", "Přesun do koše selhal; podrobnější důvod není k dispozici."],
  ])("u částečného přesunu zobrazí důvod %s", async (reason, message) => {
    const deletable = { ...ITEM, allowedActions: { ...ITEM.allowedActions, delete: true } };
    const dashboard = await renderDashboard({
      deleteRecording: async () => ({ outcome: "partial_failure", reason }),
      listLocalRecordings: async () => ({ items: [deletable], unreadableCount: 0 }),
    });
    try {
      const button = [...dashboard.document.querySelectorAll("button")]
        .find((candidate) => candidate.textContent.trim() === "Smazat nahrávku");
      await React.act(async () => button.click());
      const row = dashboard.document.querySelector(`[data-recording-id="${ID}"]`);
      await vi.waitFor(() => expect(row.querySelector(".recording-queue-card__verification-error")?.textContent)
        .toContain(message));
    } finally { await dashboard.cleanup(); }
  });

  it.each([
    ["Nahrávka se právě odesílá", "Nahrávka se právě odesílá. Počkej na dokončení"],
    ["Odesílání už začalo; nahrávku nelze smazat", "Odesílání už začalo, nahrávku nelze smazat."],
    ["Snímek nahrávky je neaktuální; načtěte seznam znovu", "Nahrávka nebo její soubory se změnily."],
  ])("při odmítnutí mazání %s zobrazí skutečný důvod", async (reason, message) => {
    const deletable = { ...ITEM, allowedActions: { ...ITEM.allowedActions, delete: true } };
    const dashboard = await renderDashboard({
      deleteRecording: async () => { throw new Error(reason); },
      listLocalRecordings: async () => ({ items: [deletable], unreadableCount: 0 }),
    });
    try {
      const button = [...dashboard.document.querySelectorAll("button")]
        .find((candidate) => candidate.textContent.trim() === "Smazat nahrávku");
      await React.act(async () => button.click());
      const row = dashboard.document.querySelector(`[data-recording-id="${ID}"]`);
      await vi.waitFor(() => expect(row.querySelector(".recording-queue-card__verification-error")?.textContent)
        .toContain(message));
    } finally { await dashboard.cleanup(); }
  });

  it("zrušení nativního koše v přehledu neohlásí chybu a zachová položku", async () => {
    const deletable = { ...ITEM, allowedActions: { ...ITEM.allowedActions, delete: true } };
    const dashboard = await renderDashboard({
      deleteRecording: async () => ({ outcome: "cancelled" }),
      listLocalRecordings: async () => ({ items: [deletable], unreadableCount: 0 }),
    });
    try {
      const button = [...dashboard.document.querySelectorAll("button")]
        .find((candidate) => candidate.textContent.trim() === "Smazat nahrávku");
      await React.act(async () => button.click());
      expect(dashboard.ludone.deleteRecording).toHaveBeenCalledOnce();
      await vi.waitFor(() => expect(dashboard.ludone.listLocalRecordings).toHaveBeenCalledTimes(2));
      const row = dashboard.document.querySelector(`[data-recording-id="${ID}"]`);
      expect(row).not.toBeNull();
      expect(row.querySelector(".recording-queue-card__verification-error")).toBeNull();
      expect(row.querySelector(".recording-action--delete")?.hasAttribute("disabled")).toBe(false);
    } finally { await dashboard.cleanup(); }
  });

  it("před smazáním vyžádá potvrzení a při odmítnutí nevolá IPC", async () => {
    const deletable = { ...ITEM, ownership: "current", allowedActions: { ...ITEM.allowedActions, delete: true } };
    const dashboard = await renderDashboard({ listLocalRecordings: async () => ({ items: [deletable], unreadableCount: 0 }) });
    dashboard.document.defaultView.confirm.mockReturnValue(false);
    try {
      const button = [...dashboard.document.querySelectorAll("button")].find((candidate) => candidate.textContent.includes("Smazat nahrávku"));
      await React.act(async () => button.click());
      expect(dashboard.document.defaultView.confirm).toHaveBeenCalledWith("Opravdu smazat? Nahrávka se smaže z tohoto Macu a nejde vrátit.");
      expect(dashboard.ludone.deleteRecording).not.toHaveBeenCalled();
    } finally { await dashboard.cleanup(); }
  });

  it("neukáže smazání pro položku s důkazem zahájeného uploadu", async () => {
    const locked = { ...ITEM, uploadLocked: true, ownership: "current", allowedActions: { ...ITEM.allowedActions, delete: false } };
    const dashboard = await renderDashboard({ listLocalRecordings: async () => ({ items: [locked], unreadableCount: 0 }) });
    try {
      expect([...dashboard.document.querySelectorAll("button")].some((button) => button.textContent.includes("Smazat nahrávku"))).toBe(false);
    } finally { await dashboard.cleanup(); }
  });
  it("W3 u stavu Odesláno samostatně uvádí, že server nebyl ověřen", async () => {
    const dashboard = await renderDashboard({
      listLocalRecordings: async () => ({
        items: [{ ...ITEM, state: "odeslano", ownership: "current" }], unreadableCount: 0,
      }),
    });
    try {
      const server = dashboard.document.querySelector('[data-station="pending"]');
      expect(server.querySelector(":scope > strong").textContent).toBe("Odesláno");
      expect(server.querySelector(":scope > p").textContent).toBe("Na serveru neověřeno");
      expect(dashboard.ludone.verifyRecording).not.toHaveBeenCalled();
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
        .filter((button) => button.textContent.includes("Převzít a odeslat"))).toHaveLength(1);
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

  it("hlavní velikost je odesílaný soubor a původní stopy jsou uvedené zvlášť", async () => {
    const dashboard = await renderDashboard({
      listQueue: () => Promise.resolve([{
        ...ITEM,
        sizeBytes: 200_000_000,
        uploadSizeBytes: 46_300_000,
        originalsSizeBytes: 153_700_000,
        originalsCount: 2,
      }]),
    });
    try {
      await vi.waitFor(() => expect(
        dashboard.document.body.textContent.replace(/\s/gu, " "),
      ).toContain("46,3 MB · místně navíc 2 původní stopy 153,7 MB"));
      expect(dashboard.document.body.textContent).not.toContain("200 MB");
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
        "Smazat nahrávku",
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
  ])("stav %s vysvětlí blokaci a skryje akci bez ověřeného účtu", async (authState, explanation) => {
    const dashboard = await renderDashboard({ authState });
    try {
      expect(claimButton(dashboard)).toBeUndefined();
      expect(dashboard.document.body.textContent).toContain(explanation);
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
  it("dlouhou historii seskupí po místním dni a řadí od nejnovějších při zachování filtrů", async () => {
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
      expect([...days[0].querySelectorAll("time")].map((time) => time.dateTime)).toEqual(items.filter((item) => new Date(item.createdAt).getDate() === 30).map((item) => item.createdAt).sort().reverse());
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


it("neznámý origin nedovolí ověření ani při změně přihlášeného účtu", async () => {
  const dashboard = await renderDashboard({
    listLocalRecordings: async () => ({ items: [{ ...ITEM, ownership: "current" }] }),
    verifyRecording: async () => ({ id: ID, revision: REVISION, verifiedAt: "2026-09-30T10:00:00Z", tracks: { delivery: { status: "complete", mismatchFields: [] } } }),
  });
  try {
    await dashboard.rerender("signed-in", "first@ludone.cz", null);
    expect(dashboard.document.querySelector(".recording-action--verify")).toBeNull();
    expect(dashboard.document.body.textContent).toContain("potvrzený účet i prostředí LuDone");
    expect(dashboard.ludone.verifyRecording).not.toHaveBeenCalled();
    await dashboard.rerender("signed-in", "second@ludone.cz", null);
    expect(dashboard.document.querySelector(".recording-action--verify")).toBeNull();
    expect(dashboard.document.body.textContent).not.toContain("Otevřít v LuDone");
    await dashboard.rerender("signed-in", "second@ludone.cz", "https://ludone.test");
    await React.act(async () => dashboard.document.querySelector(".recording-action--verify").click());
    expect(dashboard.ludone.verifyRecording).toHaveBeenCalledExactlyOnceWith(ID, REVISION);
    expect(dashboard.document.body.textContent).toContain("Otevřít v LuDone");
    await dashboard.rerender("signed-in", "second@ludone.cz", null);
    expect(dashboard.document.body.textContent).not.toContain("Otevřít v LuDone");
  } finally { await dashboard.cleanup(); }
});

async function openUploadDetail(panel) {
  await React.act(async () => {
    const detail = panel.document.querySelector('details[data-testid="recording-detail"]');
    detail.open = true;
    detail.dispatchEvent(new panel.document.defaultView.Event("toggle", { bubbles: true }));
  });
}
async function chooseUpload(panel, selector, value) {
  await React.act(async () => { const select = panel.document.querySelector(selector); select.value = value;
    select.dispatchEvent(new panel.document.defaultView.Event("change", { bubbles: true })); });
}

it("K2 prázdné uložené volby se předvyplní bez konfliktu i po obnově a lze je potvrdit a odeslat", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  let item = { ...ITEM, ownership: "current", uploadIntent: "held", uploadPreferencesLocked: false,
    uploadPreferences: null, allowedActions: { send: true } };
  const panel = await renderDashboard({ listLocalRecordings: async () => ({ items: [item], unreadableCount: 0 }) });
  panel.ludone.getUploadCompanyDefault = vi.fn(async () => ({ companyId, companyName: "Beta" }));
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Beta" }],
    selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" }));
  panel.ludone.configureRecordingUpload = vi.fn(async ({ visibility }) => {
    item = { ...item, uploadPreferences: { companyId, companyName: "Beta", visibility }, revision: `sha256:${"b".repeat(64)}` };
    return { configured: true };
  });
  panel.ludone.sendRecording = vi.fn(async () => ({ outcome: "queued" }));
  try {
    await openUploadDetail(panel);
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(companyId);
    expect(panel.document.body.textContent).not.toMatch(/volby.*mezitím.*změnil/iu);
    await React.act(async () => [...panel.document.querySelectorAll("button")].find((button) => button.textContent.includes("Obnovit přehled")).click());
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(companyId);
    expect(panel.document.body.textContent).not.toMatch(/volby.*mezitím.*změnil/iu);
    await React.act(async () => panel.document.querySelector('[data-testid="recording-upload-preferences-save"]').click());
    expect(panel.document.querySelector('.recording-action--send').disabled).toBe(false);
    await React.act(async () => panel.document.querySelector('.recording-action--send').click());
    expect(panel.ludone.sendRecording).toHaveBeenCalledOnce();
  } finally { await panel.cleanup(); }
});

it.each(["signed-out", "expired"])("K3 místní nahrávku lze smazat při stavu %s", async (authState) => {
  const item = { ...ITEM, source: "orphan", ownership: "unavailable", revision: null,
    allowedActions: { claim: false, delete: true, retry: false, send: false } };
  const panel = await renderDashboard({ authState, listLocalRecordings: async () => ({ items: [item], unreadableCount: 0 }) });
  try {
    await openUploadDetail(panel);
    const button = panel.document.querySelector('.recording-action--delete');
    expect(button).not.toBeNull();
    await React.act(async () => button.click());
    expect(panel.ludone.deleteRecording).toHaveBeenCalledExactlyOnceWith({ id: ID, queueRev: null, fileRev: item.fileRevision });
    expect(panel.document.defaultView.confirm).toHaveBeenCalledOnce();
  } finally { await panel.cleanup(); }
});

it("K4 stale_snapshot po převzetí ověřených nových voleb dovolí odeslání", async () => {
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";
  let item = { ...ITEM, ownership: "current", uploadIntent: "held", uploadPreferencesLocked: false,
    uploadPreferences: { companyId: first, companyName: "Alfa", visibility: "private" }, allowedActions: { send: true } };
  const panel = await renderDashboard({ listLocalRecordings: async () => ({ items: [item], unreadableCount: 0 }) });
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: first, name: "Alfa" }, { id: second, name: "Beta" }],
    selectedCompanyId: first, offerToken: "offer-token-0000000000000001" }));
  panel.ludone.configureRecordingUpload = vi.fn(async () => {
    item = { ...item, revision: `sha256:${"b".repeat(64)}`, uploadPreferences: { companyId: second, companyName: "Beta", visibility: "private" } };
    throw new Error("stale_snapshot");
  });
  panel.ludone.sendRecording = vi.fn(async () => ({ outcome: "queued" }));
  try {
    await openUploadDetail(panel);
    await chooseUpload(panel, '[data-testid="recording-upload-visibility"]', "company");
    await React.act(async () => panel.document.querySelector('[data-testid="recording-upload-preferences-save"]').click());
    expect(panel.document.body.textContent).toContain("Volby se nepodařilo uložit");
    await React.act(async () => [...panel.document.querySelectorAll("button")].find((button) => button.textContent.includes("Převzít nové volby")).click());
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(second);
    expect(panel.document.querySelector('.recording-action--send').disabled).toBe(false);
    await React.act(async () => panel.document.querySelector('.recording-action--send').click());
    expect(panel.ludone.sendRecording).toHaveBeenCalledOnce();
  } finally { await panel.cleanup(); }
});

it("obnova přehledu nechá otevřený editor, jeho volbu a scroll na místě", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const pending = deferred(); let loads = 0;
  const item = { ...ITEM, ownership: "current", uploadIntent: "held", uploadPreferencesLocked: false,
    uploadPreferences: { companyId, companyName: "Beta", visibility: "private" }, allowedActions: { send: true } };
  const panel = await renderDashboard({ detailId: ID, listLocalRecordings: async () => ++loads === 1
    ? { items: [item], unreadableCount: 0 } : pending.promise });
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Beta" }],
    selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" }));
  panel.ludone.configureRecordingUpload = vi.fn();
  panel.ludone.setDetailDirty = vi.fn(async () => {});
  try {
    await panel.rerender("signed-in");
    await openUploadDetail(panel);
    const editor = panel.document.querySelector('[data-testid="recording-upload-preferences"]');
    const scroller = panel.document.querySelector('.settings-content');
    scroller.scrollTop = 240;
    await chooseUpload(panel, '[data-testid="recording-upload-visibility"]', "company");
    expect(panel.ludone.setDetailDirty).toHaveBeenCalledWith(true);
    panel.ludone.setDetailDirty.mockClear();
    await React.act(async () => [...panel.document.querySelectorAll("button")].find((button) => button.textContent.includes("Obnovit přehled")).click());
    expect(panel.document.querySelector('[data-testid="recording-upload-preferences"]')).toBe(editor);
    await React.act(async () => pending.resolve({ items: [{ ...item, revision: `sha256:${"b".repeat(64)}` }], unreadableCount: 0 }));
    expect(panel.document.querySelector('[data-testid="recording-upload-preferences"]')).toBe(editor);
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(companyId);
    expect(scroller.scrollTop).toBe(240);
    expect(panel.ludone.setDetailDirty).not.toHaveBeenCalled();
  } finally { await panel.cleanup(); }
});

it("N1 změna uloženého přístupu ve snímku zablokuje odeslání do potvrzení viditelné volby", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  let item = { ...ITEM, ownership: "current", uploadIntent: "held", uploadPreferencesLocked: false,
    uploadPreferences: { companyId, companyName: "Beta", visibility: "private" }, allowedActions: { send: true } };
  const panel = await renderDashboard({ listLocalRecordings: async () => ({ items: [item], unreadableCount: 0 }) });
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Beta" }],
    selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" }));
  panel.ludone.configureRecordingUpload = vi.fn(async (preferences) => {
    item = { ...item, revision: `sha256:${"c".repeat(64)}`,
      uploadPreferences: { companyId, companyName: "Beta", visibility: preferences.visibility } };
    return { configured: true };
  });
  panel.ludone.sendRecording = vi.fn();
  try {
    await openUploadDetail(panel);
    expect(panel.document.querySelector('.recording-action--send').disabled).toBe(false);
    item = { ...item, revision: `sha256:${"b".repeat(64)}`, uploadPreferences: { ...item.uploadPreferences, visibility: "company" } };
    await React.act(async () => [...panel.document.querySelectorAll("button")].find((button) => button.textContent.includes("Obnovit přehled")).click());
    expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("private");
    expect(panel.document.querySelector('.recording-action--send').disabled).toBe(true);
    expect(panel.document.body.textContent).toMatch(/volby.*mezitím.*změnil/iu);
    await React.act(async () => panel.document.querySelector('[data-testid="recording-upload-preferences-save"]').click());
    expect(panel.ludone.configureRecordingUpload).toHaveBeenCalledWith(expect.objectContaining({ visibility: "private" }));
    expect(panel.document.body.textContent).not.toMatch(/volby.*mezitím.*změnil/iu);
    expect(panel.document.querySelector('.recording-action--send').disabled).toBe(false);
  } finally { await panel.cleanup(); }
});

it("N1 uložení ručně dorovnaných voleb zruší konflikt teprve po potvrzení", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  let item = { ...ITEM, ownership: "current", uploadIntent: "held", uploadPreferencesLocked: false,
    uploadPreferences: { companyId, companyName: "Beta", visibility: "private" }, allowedActions: { send: true } };
  const panel = await renderDashboard({ listLocalRecordings: async () => ({ items: [item], unreadableCount: 0 }) });
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Beta" }],
    selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" }));
  panel.ludone.configureRecordingUpload = vi.fn(async () => ({ configured: true }));
  try {
    await openUploadDetail(panel);
    item = { ...item, revision: `sha256:${"b".repeat(64)}`, uploadPreferences: { ...item.uploadPreferences, visibility: "company" } };
    await React.act(async () => [...panel.document.querySelectorAll("button")].find((button) => button.textContent.includes("Obnovit přehled")).click());
    await chooseUpload(panel, '[data-testid="recording-upload-visibility"]', "company");
    expect(panel.document.querySelector('.recording-action--send').disabled).toBe(true);
    await React.act(async () => panel.document.querySelector('[data-testid="recording-upload-preferences-save"]').click());
    expect(panel.document.body.textContent).not.toMatch(/volby.*mezitím.*změnil/iu);
    expect(panel.document.querySelector('.recording-action--send').disabled).toBe(false);
  } finally { await panel.cleanup(); }
});

it("N1 změna firmy jinde zachová rozpracovaný přístup a umožní převzít nové volby", async () => {
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";
  let item = { ...ITEM, ownership: "current", uploadIntent: "held", uploadPreferencesLocked: false,
    uploadPreferences: { companyId: first, companyName: "Alfa", visibility: "private" }, allowedActions: { send: true } };
  const panel = await renderDashboard({ listLocalRecordings: async () => ({ items: [item], unreadableCount: 0 }) });
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: first, name: "Alfa" }, { id: second, name: "Beta" }],
    selectedCompanyId: first, offerToken: "offer-token-0000000000000001" }));
  panel.ludone.configureRecordingUpload = vi.fn(); panel.ludone.sendRecording = vi.fn(async () => ({ outcome: "queued" }));
  try {
    await openUploadDetail(panel);
    await chooseUpload(panel, '[data-testid="recording-upload-visibility"]', "company");
    item = { ...item, revision: `sha256:${"b".repeat(64)}`,
      uploadPreferences: { companyId: second, companyName: "Beta", visibility: "private" } };
    await React.act(async () => [...panel.document.querySelectorAll("button")].find((button) => button.textContent.includes("Obnovit přehled")).click());
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(first);
    expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("company");
    expect(panel.document.querySelector('.recording-action--send').disabled).toBe(true);
    await chooseUpload(panel, '[data-testid="recording-upload-company"]', second);
    await chooseUpload(panel, '[data-testid="recording-upload-visibility"]', "private");
    expect(panel.document.querySelector('.recording-action--send').disabled).toBe(true);
    await React.act(async () => [...panel.document.querySelectorAll("button")].find((button) => button.textContent.includes("Převzít nové volby")).click());
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(second);
    expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("private");
    expect(panel.document.querySelector('.recording-action--send').disabled).toBe(false);
    await React.act(async () => panel.document.querySelector('.recording-action--send').click());
    expect(panel.ludone.sendRecording).toHaveBeenCalledOnce();
    expect(panel.ludone.configureRecordingUpload).not.toHaveBeenCalled();
  } finally { await panel.cleanup(); }
});

it.each(["čekající", "neúspěšné"])("N3 %s obnovení po změně účtu skryje cizí firmu a nepovolí cizí akce", async (stav) => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const item = { ...ITEM, ownership: "current", uploadIntent: "held", uploadPreferencesLocked: false,
    uploadPreferences: { companyId, companyName: "Soukromá firma Alfa", visibility: "company" },
    allowedActions: { send: true, retry: true, claim: false, delete: false } };
  const pending = deferred(); let loads = 0;
  const panel = await renderDashboard({ listLocalRecordings: async () => ++loads === 1
    ? { items: [item], unreadableCount: 0 } : pending.promise });
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Soukromá firma Alfa" }],
    selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" }));
  panel.ludone.configureRecordingUpload = vi.fn();
  try {
    await openUploadDetail(panel);
    await panel.rerender("signed-in", "jiny@ludone.cz");
    if (stav === "neúspěšné") await React.act(async () => pending.reject(new Error("offline")));
    expect(panel.document.body.textContent).not.toContain("Soukromá firma Alfa");
    expect(panel.document.querySelector('.recording-action--send')?.disabled ?? true).toBe(true);
    expect(panel.document.querySelector('.recording-action--retry')?.disabled ?? true).toBe(true);
    expect(panel.document.querySelector('.recording-action--verify')?.disabled ?? true).toBe(true);
  } finally { if (stav === "čekající") await React.act(async () => pending.resolve({ items: [], unreadableCount: 0 })); await panel.cleanup(); }
});

it("N3 po unknown zůstane firma skrytá až do čerstvého snímku i při stejném e-mailu", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const item = { ...ITEM, ownership: "current", uploadIntent: "held", uploadPreferencesLocked: false,
    uploadPreferences: { companyId, companyName: "Firma Alfa", visibility: "private" }, allowedActions: { send: true } };
  const pending = deferred(); let loads = 0;
  const panel = await renderDashboard({ listLocalRecordings: async () => ++loads === 1
    ? { items: [item], unreadableCount: 0 } : pending.promise });
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Firma Alfa" }],
    selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" }));
  panel.ludone.configureRecordingUpload = vi.fn();
  try {
    await openUploadDetail(panel);
    await chooseUpload(panel, '[data-testid="recording-upload-visibility"]', "company");
    await panel.rerender("unknown", null);
    await panel.rerender("signed-in");
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').closest('[hidden]')).not.toBeNull();
    expect(panel.document.querySelector('.recording-action--send')).toBeNull();
    await React.act(async () => pending.resolve({ items: [item], unreadableCount: 0 }));
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').closest('[hidden]')).toBeNull();
    expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("company");
  } finally { await panel.cleanup(); }
});

it("N3 přerušené ukládání nepokračuje po návratu stejného e-mailu bez nového potvrzení", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const item = { ...ITEM, ownership: "current", uploadIntent: "held", uploadPreferencesLocked: false,
    uploadPreferences: { companyId, companyName: "Beta", visibility: "private" }, allowedActions: { send: true } };
  const panel = await renderDashboard({ listLocalRecordings: async () => ({ items: [item], unreadableCount: 0 }) });
  const pending = deferred(); let calls = 0;
  const offer = { companies: [{ id: companyId, name: "Beta" }], selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" };
  panel.ludone.listUploadCompanies = vi.fn(async () => ++calls === 2 ? pending.promise : offer);
  panel.ludone.configureRecordingUpload = vi.fn(async () => ({ configured: true }));
  try {
    await openUploadDetail(panel);
    await chooseUpload(panel, '[data-testid="recording-upload-visibility"]', "company");
    await React.act(async () => panel.document.querySelector('[data-testid="recording-upload-preferences-save"]').click());
    await panel.rerender("unknown", null);
    await panel.rerender("signed-in");
    await React.act(async () => pending.resolve(offer));
    expect(panel.ludone.configureRecordingUpload).not.toHaveBeenCalled();
  } finally { await panel.cleanup(); }
});

it("K9 detail hlásí skutečnou editaci a při obnově zachová scroll produkčního OsaShellu", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const item = { ...ITEM, ownership: "current", uploadIntent: "held", uploadPreferencesLocked: false,
    uploadPreferences: { companyId, companyName: "Beta", visibility: "private" }, allowedActions: { send: true } };
  const dom = new JSDOM('<div id="root"></div>', { url: `https://ludone.test/?recordingId=${ID}#settings` });
  const style = dom.window.document.createElement("style");
  style.textContent = readFileSync(new URL("../src/osa.css", import.meta.url), "utf8");
  dom.window.document.head.append(style);
  const listeners = new Set();
  const ludone = {
    getAuthSessionState: vi.fn(async () => "valid"),
    getAuthIdentity: vi.fn(async () => ({ email: "test@ludone.cz", name: "Test" })),
    getAuthOrigin: vi.fn(async () => "https://ludone.test"),
    onAuthSessionChanged: (callback) => { listeners.add(callback); return () => listeners.delete(callback); },
    listLocalRecordings: vi.fn(async () => ({ items: [item], unreadableCount: 0 })),
    listUploadCompanies: vi.fn(async () => ({ companies: [{ id: companyId, name: "Beta" }],
      selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" })),
    configureRecordingUpload: vi.fn(), setDetailDirty: vi.fn(async () => {}),
  };
  Object.defineProperty(dom.window, "ludone", { value: ludone });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    Node: dom.window.Node, HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true })) vi.stubGlobal(key, value);
  const root = createRoot(dom.window.document.querySelector("#root"));
  const panel = { document: dom.window.document };
  try {
    await React.act(async () => root.render(React.createElement(OsaShell, { page: "detail" }, React.createElement(SettingsApp))));
    await vi.waitFor(() => expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]')).not.toBeNull());
    const scroller = panel.document.querySelector('.osa-workspace');
    expect(scroller).not.toBeNull();
    expect(panel.document.defaultView.getComputedStyle(panel.document.querySelector('.recordings-dashboard__toolbar')).display).toBe("none");
    scroller.scrollTop = 240;
    await chooseUpload(panel, '[data-testid="recording-upload-visibility"]', "company");
    expect(ludone.setDetailDirty).toHaveBeenCalledWith(true);
    ludone.setDetailDirty.mockClear();
    const previousLoads = ludone.listLocalRecordings.mock.calls.length;
    const pending = deferred(); ludone.getAuthIdentity.mockImplementationOnce(() => pending.promise);
    await React.act(async () => { for (const listener of [...listeners]) listener(); });
    await React.act(async () => pending.resolve({ email: "test@ludone.cz", name: "Test" }));
    await vi.waitFor(() => expect(ludone.listLocalRecordings.mock.calls.length).toBeGreaterThan(previousLoads));
    expect(panel.document.querySelector('.osa-workspace')).toBe(scroller);
    expect(scroller.scrollTop).toBe(240);
    expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("company");
    expect(ludone.setDetailDirty).not.toHaveBeenCalled();
  } finally { await React.act(async () => root.unmount()); dom.window.close(); }
});

async function renderFocusDetail(readyExport = false) {
  const companyId = "22222222-2222-4222-8222-222222222222";
  let item = { ...ITEM, ownership: "current", uploadIntent: "held", uploadPreferencesLocked: false,
    ...(readyExport ? { deliveryState: "ready", title: "Porada výroby" } : {}),
    uploadPreferences: { companyId, companyName: "Beta", visibility: "private" }, allowedActions: { send: true } };
  const dom = new JSDOM('<div id="root"></div>', { url: `https://ludone.test/?recordingId=${ID}#settings` });
  const style = dom.window.document.createElement("style");
  style.textContent = readFileSync(new URL("../src/osa.css", import.meta.url), "utf8");
  dom.window.document.head.append(style);
  const ludone = {
    getAuthSessionState: vi.fn(async () => "valid"),
    getAuthIdentity: vi.fn(async () => ({ email: "test@ludone.cz", name: "Test" })),
    getAuthOrigin: vi.fn(async () => "https://ludone.test"),
    listLocalRecordings: vi.fn(async () => ({ items: [item], unreadableCount: 0 })),
    exportRecordingCopy: vi.fn(async () => ({ ok: true, fileName: "kopie.webm" })),
    listUploadCompanies: vi.fn(async () => ({ companies: [{ id: companyId, name: "Beta" }],
      selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" })),
    configureRecordingUpload: vi.fn(async ({ visibility }) => {
      item = { ...item, revision: `sha256:${"b".repeat(64)}`,
        uploadPreferences: { ...item.uploadPreferences, visibility } };
      return { configured: true };
    }),
    setDetailDirty: vi.fn(async () => {}),
    sendRecording: vi.fn(async () => ({ outcome: "queued" })),
  };
  Object.defineProperty(dom.window, "ludone", { value: ludone });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    Node: dom.window.Node, HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true })) vi.stubGlobal(key, value);
  const root = createRoot(dom.window.document.querySelector("#root"));
  await React.act(async () => root.render(React.createElement(OsaShell, { page: "detail" }, React.createElement(SettingsApp))));
  await vi.waitFor(() => expect(dom.window.document.querySelector('[data-testid="recording-upload-visibility"]')).not.toBeNull());
  return {
    document: dom.window.document,
    ludone,
    snapshot: () => ({ items: [item], unreadableCount: 0 }),
    async focus() { await React.act(async () => dom.window.dispatchEvent(new dom.window.Event("focus"))); },
    async cleanup() { await React.act(async () => root.unmount()); dom.window.close(); },
  };
}

it("E1 focus zachová místo exportu a zablokuje ovládání při ověřování i čekání na snímek", async () => {
  const panel = await renderFocusDetail(true);
  const identity = deferred();
  const snapshot = deferred();
  panel.ludone.getAuthIdentity.mockImplementationOnce(() => identity.promise);
  panel.ludone.listLocalRecordings.mockImplementationOnce(() => snapshot.promise);
  try {
    const section = panel.document.querySelector('[aria-label="Export kopie"]');
    const input = section.querySelector('[data-testid="recording-copy-name"]');
    const button = section.querySelector('[data-testid="export-saved-recording-copy"]');
    const scroller = panel.document.querySelector(".osa-workspace");
    expect(input.value).toBe("Porada výroby");
    expect(input.disabled).toBe(false);
    expect(button.disabled).toBe(false);
    const valueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value").set;
    await React.act(async () => {
      valueSetter.call(input, "Vlastní název kopie");
      input.dispatchEvent(new panel.document.defaultView.InputEvent("input", { bubbles: true }));
    });
    scroller.scrollTop = 240;

    const expectReserved = () => {
      expect(panel.document.querySelector('[aria-label="Export kopie"]')).toBe(section);
      expect(panel.document.defaultView.getComputedStyle(section).display).not.toBe("none");
      expect(panel.document.defaultView.getComputedStyle(section).visibility).toBe("hidden");
      expect(input.disabled).toBe(true);
      expect(button.disabled).toBe(true);
      expect(scroller.scrollTop).toBe(240);
      button.click();
      expect(panel.ludone.exportRecordingCopy).not.toHaveBeenCalled();
    };

    await panel.focus();
    expectReserved();
    await React.act(async () => identity.resolve({ email: "test@ludone.cz", name: "Test" }));
    expectReserved();
    await React.act(async () => snapshot.resolve(panel.snapshot()));
    expect(panel.document.querySelector('[aria-label="Export kopie"]')).toBe(section);
    expect(panel.document.defaultView.getComputedStyle(section).visibility).toBe("visible");
    expect(input.disabled).toBe(false);
    expect(button.disabled).toBe(false);
    expect(input.value).toBe("Vlastní název kopie");
    expect(scroller.scrollTop).toBe(240);
  } finally {
    await React.act(async () => { identity.resolve({ email: "test@ludone.cz" }); snapshot.resolve(panel.snapshot()); });
    await panel.cleanup();
  }
});

it("E1 export zůstane skrytý a neaktivní pro neověřený účet a při změně účtu zmizí", async () => {
  const panel = await renderFocusDetail(true);
  const identity = deferred();
  const snapshot = deferred();
  panel.ludone.getAuthIdentity.mockImplementationOnce(() => identity.promise);
  panel.ludone.listLocalRecordings.mockImplementationOnce(() => snapshot.promise);
  try {
    await panel.focus();
    const section = panel.document.querySelector('[aria-label="Export kopie"]');
    expect(panel.document.defaultView.getComputedStyle(section).visibility).toBe("hidden");
    expect(section.querySelector('[data-testid="recording-copy-name"]').disabled).toBe(true);
    expect(section.querySelector('[data-testid="export-saved-recording-copy"]').disabled).toBe(true);
    await React.act(async () => identity.resolve({ email: "jiny@ludone.cz", name: "Jiný" }));
    expect(panel.document.querySelector('[aria-label="Export kopie"]')).toBeNull();
    const otherSnapshot = panel.snapshot();
    otherSnapshot.items = otherSnapshot.items.map((item) => ({ ...item, ownership: "other" }));
    await React.act(async () => snapshot.resolve(otherSnapshot));
    expect(panel.document.querySelector('[aria-label="Export kopie"]')).toBeNull();
    expect(panel.ludone.exportRecordingCopy).not.toHaveBeenCalled();
  } finally {
    await React.act(async () => { identity.resolve({ email: "jiny@ludone.cz" }); snapshot.resolve(panel.snapshot()); });
    await panel.cleanup();
  }
});

it("T2 focus během ověřování a čekání na snímek zachová místo editoru i scroll bez dirty", async () => {
  const panel = await renderFocusDetail();
  const identity = deferred();
  const snapshot = deferred();
  panel.ludone.getAuthIdentity.mockImplementationOnce(() => identity.promise);
  panel.ludone.listLocalRecordings.mockImplementationOnce(() => snapshot.promise);
  try {
    const scroller = panel.document.querySelector(".osa-workspace");
    const editor = panel.document.querySelector('[data-testid="recording-upload-preferences"]').parentElement;
    const previousLoads = panel.ludone.listLocalRecordings.mock.calls.length;
    scroller.scrollTop = 240;
    panel.ludone.setDetailDirty.mockClear();
    await panel.focus();
    expect(panel.document.defaultView.getComputedStyle(editor).display).not.toBe("none");
    expect(panel.document.defaultView.getComputedStyle(editor).visibility).toBe("hidden");
    expect(scroller.scrollTop).toBe(240);
    await React.act(async () => identity.resolve({ email: "test@ludone.cz", name: "Test" }));
    expect(panel.ludone.listLocalRecordings).toHaveBeenCalledTimes(previousLoads + 1);
    expect(panel.document.defaultView.getComputedStyle(editor).display).not.toBe("none");
    expect(scroller.scrollTop).toBe(240);
    expect(panel.ludone.setDetailDirty).not.toHaveBeenCalled();
    await React.act(async () => snapshot.resolve(panel.snapshot()));
    expect(panel.document.defaultView.getComputedStyle(editor).visibility).toBe("visible");
    expect(scroller.scrollTop).toBe(240);
    expect(panel.ludone.setDetailDirty).not.toHaveBeenCalled();
  } finally {
    await React.act(async () => { identity.resolve({ email: "test@ludone.cz" }); snapshot.resolve(panel.snapshot()); });
    await panel.cleanup();
  }
});

it("T3 potvrzené uložení po focusu počká na nový snímek téhož účtu", async () => {
  const panel = await renderFocusDetail();
  const identity = deferred();
  const snapshot = deferred();
  try {
    await chooseUpload(panel, '[data-testid="recording-upload-visibility"]', "company");
    expect(panel.ludone.setDetailDirty).toHaveBeenCalledWith(true);
    panel.ludone.listLocalRecordings.mockImplementationOnce(() => snapshot.promise);
    await React.act(async () => panel.document.querySelector('[data-testid="recording-upload-preferences-save"]').click());
    expect(panel.ludone.configureRecordingUpload).toHaveBeenCalledOnce();
    panel.ludone.getAuthIdentity.mockImplementationOnce(() => identity.promise);
    await panel.focus();
    await React.act(async () => snapshot.resolve(panel.snapshot()));
    expect(panel.document.body.textContent).not.toContain("Volby se nepodařilo uložit");
    await React.act(async () => identity.resolve({ email: "test@ludone.cz", name: "Test" }));
    await vi.waitFor(() => expect(panel.document.body.textContent).toContain("Volby jsou uložené"));
    expect(panel.document.body.textContent).not.toContain("Volby se nepodařilo uložit");
    expect(panel.document.querySelector(".recording-action--send").disabled).toBe(false);
    expect(panel.ludone.setDetailDirty).toHaveBeenLastCalledWith(false);
  } finally {
    await React.act(async () => { identity.resolve({ email: "test@ludone.cz" }); snapshot.resolve(panel.snapshot()); });
    await panel.cleanup();
  }
});

it("T3 potvrzený zápis neoznačí za ověřený pod jiným účtem", async () => {
  const panel = await renderFocusDetail();
  const snapshot = deferred();
  try {
    await chooseUpload(panel, '[data-testid="recording-upload-visibility"]', "company");
    panel.ludone.listLocalRecordings.mockImplementationOnce(() => snapshot.promise);
    await React.act(async () => panel.document.querySelector('[data-testid="recording-upload-preferences-save"]').click());
    expect(panel.ludone.configureRecordingUpload).toHaveBeenCalledOnce();
    panel.ludone.getAuthIdentity.mockResolvedValueOnce({ email: "jiny@ludone.cz", name: "Jiný" });
    await panel.focus();
    await React.act(async () => snapshot.resolve(panel.snapshot()));
    expect(panel.ludone.setDetailDirty).not.toHaveBeenCalledWith(false);
    expect(panel.document.body.textContent).not.toContain("Volby jsou uložené");
    expect(panel.document.querySelector(".recording-action--send")?.disabled ?? true).toBe(true);
  } finally {
    await React.act(async () => snapshot.resolve(panel.snapshot()));
    await panel.cleanup();
  }
});

it("T3 změna voleb po potvrzeném zápisu neodblokuje odeslání", async () => {
  const panel = await renderFocusDetail();
  try {
    await chooseUpload(panel, '[data-testid="recording-upload-visibility"]', "company");
    panel.ludone.listLocalRecordings.mockImplementationOnce(async () => {
      const snapshot = panel.snapshot();
      return { ...snapshot, items: snapshot.items.map((item) => ({ ...item,
        uploadPreferences: { ...item.uploadPreferences, visibility: "private" } })) };
    });
    await React.act(async () => panel.document.querySelector('[data-testid="recording-upload-preferences-save"]').click());
    expect(panel.ludone.configureRecordingUpload).toHaveBeenCalledOnce();
    expect(panel.ludone.setDetailDirty).not.toHaveBeenCalledWith(false);
    expect(panel.document.body.textContent).toContain("Uložení bylo potvrzeno, ale výsledek nelze ověřit");
    expect(panel.document.querySelector(".recording-action--send").disabled).toBe(true);
  } finally { await panel.cleanup(); }
});

it("T3 chyba snímku po potvrzeném zápisu nehlásí neúspěšné uložení", async () => {
  const panel = await renderFocusDetail();
  try {
    await chooseUpload(panel, '[data-testid="recording-upload-visibility"]', "company");
    panel.ludone.listLocalRecordings.mockRejectedValueOnce(new Error("disk"));
    await React.act(async () => panel.document.querySelector('[data-testid="recording-upload-preferences-save"]').click());
    expect(panel.ludone.configureRecordingUpload).toHaveBeenCalledOnce();
    expect(panel.document.body.textContent).toContain("Uložení bylo potvrzeno, ale výsledek nelze ověřit");
    expect(panel.document.body.textContent).not.toContain("Volby se nepodařilo uložit");
    expect(panel.ludone.setDetailDirty).not.toHaveBeenCalledWith(false);
    expect(panel.document.querySelector(".recording-action--send").disabled).toBe(true);
  } finally { await panel.cleanup(); }
});

it("dočasně neznámé přihlášení neshodí editor ani volbu při návratu stejného účtu", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const original = { ...ITEM, ownership: "current", uploadIntent: "held", uploadPreferencesLocked: false,
    uploadPreferences: { companyId, companyName: "Beta", visibility: "private" }, allowedActions: { send: true } };
  let item = original;
  const panel = await renderDashboard({ listLocalRecordings: async () => ({ items: [item], unreadableCount: 0 }) });
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Beta" }],
    selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" }));
  panel.ludone.configureRecordingUpload = vi.fn();
  try {
    await openUploadDetail(panel);
    await chooseUpload(panel, '[data-testid="recording-upload-visibility"]', "company");
    item = { ...original, ownership: "unknown" };
    await panel.rerender("unknown", null);
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(companyId);
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').closest('[hidden]')).not.toBeNull();
    item = original;
    await panel.rerender("signed-in");
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(companyId);
    expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("company");
  } finally { await panel.cleanup(); }
});

it("odhlášení ponechá rozpracovanou volbu viditelnou a po návratu téhož účtu ji obnoví", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const original = { ...ITEM, ownership: "current", uploadIntent: "held", uploadPreferencesLocked: false,
    uploadPreferences: { companyId, companyName: "Beta", visibility: "private" }, allowedActions: { send: true } };
  let item = original;
  const panel = await renderDashboard({ listLocalRecordings: async () => ({ items: [item], unreadableCount: 0 }) });
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Beta" }],
    selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" }));
  panel.ludone.configureRecordingUpload = vi.fn();
  try {
    await openUploadDetail(panel);
    await chooseUpload(panel, '[data-testid="recording-upload-visibility"]', "company");
    item = { ...original, ownership: "unknown" };
    await panel.rerender("signed-out", null);
    const select = panel.document.querySelector('[data-testid="recording-upload-company"]');
    expect(select.value).toBe(companyId);
    expect(select.disabled).toBe(true);
    expect(select.closest('[hidden]')).not.toBeNull();
    item = original;
    await panel.rerender("signed-in");
    expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("company");
  } finally { await panel.cleanup(); }
});

it("při přepnutí na jiný účet neukáže jeho uživateli předchozí rozpracovanou volbu", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const original = { ...ITEM, ownership: "current", uploadIntent: "held", uploadPreferencesLocked: false,
    uploadPreferences: { companyId, companyName: "Beta", visibility: "private" }, allowedActions: { send: true } };
  const pending = deferred(); let count = 0;
  const panel = await renderDashboard({ listLocalRecordings: async () => ++count === 1
    ? { items: [original], unreadableCount: 0 } : pending.promise });
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Beta" }],
    selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" }));
  panel.ludone.configureRecordingUpload = vi.fn();
  try {
    await openUploadDetail(panel);
    await panel.rerender("signed-in", "other@ludone.cz");
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]')).toBeNull();
    await React.act(async () => pending.resolve({ items: [{ ...original, ownership: "other" }], unreadableCount: 0 }));
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]')).toBeNull();
  } finally { await panel.cleanup(); }
});

it("selhání uložení s odstraněnou firmou vysvětlí důvod a ponechá volbu", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const item = { ...ITEM, ownership: "current", uploadIntent: "held", uploadPreferencesLocked: false,
    uploadPreferences: { companyId, companyName: "Beta", visibility: "private" }, allowedActions: { send: true } };
  const panel = await renderDashboard({ listLocalRecordings: async () => ({ items: [item], unreadableCount: 0 }) });
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Beta" }],
    selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" }));
  panel.ludone.configureRecordingUpload = vi.fn(async () => { throw Object.assign(new Error("company_removed"), { code: "company_removed" }); });
  try {
    await openUploadDetail(panel);
    await chooseUpload(panel, '[data-testid="recording-upload-visibility"]', "company");
    await React.act(async () => panel.document.querySelector('[data-testid="recording-upload-preferences-save"]').click());
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(companyId);
    expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("company");
    expect(panel.document.querySelector('[data-testid="recording-upload-preferences-state"]').textContent)
      .toMatch(/firma.*(oprávnění|dostupná)|oprávnění.*firm/iu);
  } finally { await panel.cleanup(); }
});
it.each([
  ["odeslané", "odeslano"],
  ["ponechané", "ceka"],
])("detail %s nahrávky nabízí výslovný export připraveného delivery", async (_label, state) => {
  const item = {
    ...ITEM,
    ownership: "current",
    state,
    title: "Porada výroby",
    deliveryState: "ready",
    allowedActions: { claim: false, delete: false, retry: false, send: false },
  };
  const panel = await renderDashboard({
    listLocalRecordings: async () => ({ items: [item], unreadableCount: 0 }),
  });
  try {
    await openUploadDetail(panel);
    const input = panel.document.querySelector('[data-testid="recording-copy-name"]');
    expect(input.value).toBe("Porada výroby");
    await React.act(async () => panel.document.querySelector('[data-testid="export-saved-recording-copy"]').click());

    expect(panel.ludone.exportRecordingCopy).toHaveBeenCalledExactlyOnceWith(ID, {
      queueRev: REVISION,
      fileRev: ITEM.fileRevision,
      recordingName: "Porada výroby",
    });
    expect(panel.document.querySelector('[data-testid="recording-copy-export-status"]')?.textContent)
      .toContain("Kopie LuDone-porada.webm je uložená ve Stažených.");
  } finally { await panel.cleanup(); }
});
it("po několika skutečných úpravách exportuje poslední název se snapshot revizemi", async () => {
  const item = {
    ...ITEM,
    ownership: "current",
    state: "ceka",
    title: "Původní název",
    deliveryState: "ready",
    allowedActions: { claim: false, delete: false, retry: false, send: false },
  };
  const panel = await renderDashboard({
    listLocalRecordings: async () => ({ items: [item], unreadableCount: 0 }),
  });
  try {
    await openUploadDetail(panel);
    const input = panel.document.querySelector('[data-testid="recording-copy-name"]');
    const valueSetter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(input),
      "value",
    ).set;
    for (const value of ["První změna", "Druhá změna", "Poslední název"]) {
      await React.act(async () => {
        valueSetter.call(input, value);
        input.dispatchEvent(new panel.document.defaultView.InputEvent("input", {
          bubbles: true,
          data: value,
          inputType: "insertText",
        }));
      });
    }

    await React.act(async () => panel.document.querySelector(
      '[data-testid="export-saved-recording-copy"]',
    ).click());

    expect(panel.ludone.exportRecordingCopy).toHaveBeenCalledExactlyOnceWith(ID, {
      queueRev: REVISION,
      fileRev: ITEM.fileRevision,
      recordingName: "Poslední název",
    });
  } finally { await panel.cleanup(); }
});

it("změna revize uvolní starý export a jeho pozdní finally neodblokuje novější kopii", async () => {
  const first = deferred();
  const second = deferred();
  const nextRevision = `sha256:${"d".repeat(64)}`;
  let item = {
    ...ITEM,
    ownership: "current",
    state: "ceka",
    title: "Porada výroby",
    deliveryState: "ready",
    allowedActions: { claim: false, delete: false, retry: false, send: false },
  };
  const exportRecordingCopy = vi.fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const panel = await renderDashboard({
    exportRecordingCopy,
    listLocalRecordings: async () => ({ items: [item], unreadableCount: 0 }),
  });
  try {
    await openUploadDetail(panel);
    const selector = '[data-testid="export-saved-recording-copy"]';
    await React.act(async () => panel.document.querySelector(selector).click());
    expect(panel.document.querySelector(selector).disabled).toBe(true);

    item = { ...item, revision: nextRevision };
    await React.act(async () => [...panel.document.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Obnovit přehled")).click());
    await vi.waitFor(() => expect(panel.ludone.listLocalRecordings).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(panel.document.querySelector(selector).disabled).toBe(false));

    await React.act(async () => panel.document.querySelector(selector).click());
    expect(exportRecordingCopy).toHaveBeenCalledTimes(2);
    expect(panel.document.querySelector(selector).disabled).toBe(true);
    first.resolve({ ok: true, fileName: "stara-kopie.webm" });
    await React.act(async () => { await Promise.resolve(); });
    expect(panel.document.querySelector(selector).disabled).toBe(true);
    expect(panel.document.querySelector('[data-testid="recording-copy-export-status"]')).toBeNull();

    second.resolve({ ok: true, fileName: "nova-kopie.webm" });
    await vi.waitFor(() => expect(panel.document.querySelector(
      '[data-testid="recording-copy-export-status"]',
    )?.textContent).toContain("nova-kopie.webm"));
  } finally {
    first.resolve({ ok: true, fileName: "stara-kopie.webm" });
    second.resolve({ ok: true, fileName: "nova-kopie.webm" });
    await panel.cleanup();
  }
});

it("změna identity a odmountování ignorují pozdní výsledek kopie", async () => {
  const pending = deferred();
  const item = {
    ...ITEM,
    ownership: "current",
    state: "ceka",
    title: "Porada výroby",
    deliveryState: "ready",
    allowedActions: { claim: false, delete: false, retry: false, send: false },
  };
  const panel = await renderDashboard({
    exportRecordingCopy: () => pending.promise,
    listLocalRecordings: async () => ({ items: [item], unreadableCount: 0 }),
  });
  await openUploadDetail(panel);
  await React.act(async () => panel.document.querySelector(
    '[data-testid="export-saved-recording-copy"]',
  ).click());

  await panel.rerender("signed-in", "other@ludone.cz");
  await vi.waitFor(() => expect(panel.ludone.listLocalRecordings).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(panel.document.querySelector(
    '[data-testid="export-saved-recording-copy"]',
  ).disabled).toBe(false));
  await panel.cleanup();
  pending.resolve({ ok: true, fileName: "pozdni-kopie.webm" });
  await React.act(async () => { await Promise.resolve(); });
});

it("detail uloží přesný CAS payload bez send, obnoví revize a nový explicitní send používá novou revizi", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const offerToken = "offer-token-0000000000000001";
  const nextRev = `sha256:${"b".repeat(64)}`;
  let item = { ...ITEM, ownership: "current", uploadIntent: "held", uploadPreferencesLocked: false,
    uploadPreferences: { companyId, visibility: "private", companyName: "Beta" }, allowedActions: { send: true } };
  const panel = await renderDashboard({ listLocalRecordings: async () => ({ items: [item], unreadableCount: 0 }) });
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Beta" }], selectedCompanyId: companyId, offerToken }));
  panel.ludone.configureRecordingUpload = vi.fn(async ({ visibility }) => {
    item = { ...item, revision: nextRev, uploadPreferences: { ...item.uploadPreferences, visibility } };
    return { configured: true };
  });
  panel.ludone.sendRecording = vi.fn(async () => ({ outcome: "queued" }));
  panel.ludone.selectUploadCompany = vi.fn();
  try {
    await openUploadDetail(panel);
    expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("private");
    await chooseUpload(panel, '[data-testid="recording-upload-visibility"]', "company");
    expect(panel.ludone.sendRecording).not.toHaveBeenCalled();
    await React.act(async () => panel.document.querySelector('[data-testid="recording-upload-preferences-save"]').click());
    expect(panel.ludone.configureRecordingUpload).toHaveBeenCalledExactlyOnceWith({ id: ID, queueRev: REVISION, fileRev: ITEM.fileRevision, companyId, offerToken, visibility: "company" });
    expect(panel.ludone.sendRecording).not.toHaveBeenCalled();
    expect(panel.document.querySelector('[data-testid="recording-upload-preferences-state"]').getAttribute("role")).toBe("status");
    await React.act(async () => panel.document.querySelector('.recording-action--send').click());
    expect(panel.ludone.sendRecording).toHaveBeenCalledExactlyOnceWith({ id: ID, queueRev: nextRev, fileRev: ITEM.fileRevision });
    expect(panel.ludone.selectUploadCompany).not.toHaveBeenCalled();
  } finally { await panel.cleanup(); }
});
it("stale preference chyba obnoví přehled a další send zůstane blokovaný i po nové nabídce", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const panel = await renderDashboard({ listLocalRecordings: async () => ({ items: [{ ...ITEM, ownership: "current", uploadIntent: "held", allowedActions: { send: true } }], unreadableCount: 0 }) });
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Beta" }], selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" }));
  panel.ludone.configureRecordingUpload = vi.fn(async () => { throw new Error("stale_snapshot"); });
  panel.ludone.sendRecording = vi.fn();
  try {
    await openUploadDetail(panel);
    await chooseUpload(panel, '[data-testid="recording-upload-visibility"]', "company");
    await React.act(async () => panel.document.querySelector('[data-testid="recording-upload-preferences-save"]').click());
    expect(panel.ludone.listLocalRecordings).toHaveBeenCalledTimes(2);
    expect(panel.document.querySelector('.recording-action--send').disabled).toBe(true);
    await React.act(async () => panel.document.querySelector('.recording-action--send').click());
    expect(panel.ludone.sendRecording).not.toHaveBeenCalled();
    expect(panel.document.body.textContent).toContain("Volby se nepodařilo uložit");
    expect(panel.document.body.textContent).toMatch(/přehled.*zastaral.*načti/iu);
    expect(panel.document.querySelector('[data-testid="recording-upload-preferences-state"]').getAttribute("role")).toBe("alert");
  } finally { await panel.cleanup(); }
});
it("výslovná zero-progress 403 oprava je editovatelná, progress zůstává zamčený", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  let item = { ...ITEM, ownership: "current", state: "selhalo", uploadIntent: "approved", uploadPreferencesLocked: false,
    blockReason: "company_out_of_scope", allowedActions: { retry: true } };
  const panel = await renderDashboard({ listLocalRecordings: async () => ({ items: [item], unreadableCount: 0 }) });
  panel.ludone.listUploadCompanies = vi.fn(async () => ({ companies: [{ id: companyId, name: "Beta" }], selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" }));
  panel.ludone.configureRecordingUpload = vi.fn(async () => { item = { ...item, state: "ceka", uploadIntent: "held", revision: `sha256:${"b".repeat(64)}`, uploadPreferencesLocked: true }; return { configured: true }; });
  try {
    await openUploadDetail(panel);
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]').disabled).toBe(false);
    await React.act(async () => panel.document.querySelector('[data-testid="recording-upload-preferences-save"]').click());
    expect(panel.ludone.configureRecordingUpload).toHaveBeenCalledOnce();
    expect(panel.document.querySelector('[data-testid="recording-upload-company"]')).toBeNull();
    expect(panel.document.body.textContent).toContain("odesílání už začalo");
  } finally { await panel.cleanup(); }
});
it("zamčený failed progress detail nezmění draft a dovolí původní retry i po znovuotevření", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const prefs = Object.freeze({ companyId, visibility: "private", companyName: "Beta" });
  const item = { ...ITEM, ownership: "current", state: "selhalo", uploadIntent: "approved",
    uploadPreferencesLocked: true, uploadPreferences: prefs, allowedActions: { retry: true } };
  const panel = await renderDashboard({ listLocalRecordings: async () => ({ items: [item], unreadableCount: 0 }) });
  panel.ludone.listUploadCompanies = vi.fn(); panel.ludone.configureRecordingUpload = vi.fn();
  try {
    await openUploadDetail(panel);
    expect(panel.document.querySelector('.recording-action--retry').disabled).toBe(false);
    await React.act(async () => panel.document.querySelector('.recording-action--retry').click());
    expect(panel.ludone.retryRecording).toHaveBeenCalledExactlyOnceWith({ id: ID, queueRev: REVISION, fileRev: ITEM.fileRevision });
    expect(item.uploadPreferences).toBe(prefs);
    const detail = panel.document.querySelector('details[data-testid="recording-detail"]');
    await React.act(async () => { detail.open = false; detail.dispatchEvent(new panel.document.defaultView.Event("toggle", { bubbles: true })); });
    await openUploadDetail(panel);
    expect(panel.document.querySelector('.recording-action--retry').disabled).toBe(false);
    expect(panel.ludone.listUploadCompanies).not.toHaveBeenCalled();
    expect(panel.ludone.configureRecordingUpload).not.toHaveBeenCalled();
  } finally { await panel.cleanup(); }
});
