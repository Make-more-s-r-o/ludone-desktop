import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { RecordingsDashboard } from "../src/features/recordings/RecordingsDashboard.jsx";

const ID = "9e586e55-d688-43f1-8a80-a3d61e754f3e";
const item = { id: ID, kind: "recording", source: "queue", state: "ceka", title: "Porada",
  localState: "complete-audio", revision: `sha256:${"a".repeat(64)}`,
  fileRevision: `sha256:${"b".repeat(64)}`, ownership: "current", allowedActions: {},
  createdAt: "2026-10-12T10:00:00.000Z" };

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function render(playRecording) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  dom.window.ludone = { listLocalRecordings: vi.fn(async () => ({ items: [item], unreadableCount: 0 })), playRecording };
  const root = createRoot(dom.window.document.querySelector("#root"));
  await React.act(async () => root.render(React.createElement(RecordingsDashboard, { osa: true, detailId: ID, authState: "signed-out" })));
  const button = [...dom.window.document.querySelectorAll("button")].find((value) => value.textContent.includes("Přehrát dostupný zvuk"));
  expect(button).toBeTruthy();
  return { document: dom.window.document,
    click: () => React.act(async () => button.click()),
    cleanup: async () => { await React.act(async () => root.unmount()); dom.window.close(); } };
}

describe("srozumitelné příčiny přehrávání", () => {
  it.each([
    ["missing", "Zvuk na tomto Macu chybí nebo je neúplný. Původní stopy zkontroluj ve Finderu."],
    ["stale", "Přehled nahrávek je zastaralý. Obnov ho a zkus přehrání znovu."],
    ["unconfirmed", "Přehrání teď nejde bezpečně potvrdit. Zkus to znovu."],
    ["unknown", "Přehrání teď nejde bezpečně potvrdit. Zkus to znovu."],
  ])("zobrazí větu pro %s", async (outcome, message) => {
    const test = await render(vi.fn(async () => ({ outcome })));
    try { await test.click(); expect(test.document.body.textContent).toContain(message); expect(test.document.querySelector("audio")).toBeNull(); }
    finally { await test.cleanup(); }
  });
  it("ready otevře audio a další neúspěch odstraní staré přehrávání", async () => {
    const url = "ludone://app/media/11111111-1111-4111-8111-111111111111";
    const play = vi.fn().mockResolvedValueOnce({ outcome: "ready", url, label: "Místní zvuk" }).mockResolvedValueOnce({ outcome: "missing" });
    const test = await render(play);
    try {
      await test.click(); expect(test.document.querySelector("audio").getAttribute("src")).toBe(url);
      expect(play).toHaveBeenCalledWith({ id: ID, queueRev: item.revision, fileRev: item.fileRevision });
      await test.click(); expect(test.document.querySelector("audio")).toBeNull();
    } finally { await test.cleanup(); }
  });
  it("ready s neplatnou URL selže uzavřeně", async () => {
    const test = await render(vi.fn(async () => ({ outcome: "ready", url: "file:///tajne.webm" })));
    try { await test.click(); expect(test.document.body.textContent).toContain("Přehrání teď nejde bezpečně potvrdit."); expect(test.document.querySelector("audio")).toBeNull(); }
    finally { await test.cleanup(); }
  });
  it("výjimka má vlastní větu a zachová původní chybu v console.error", async () => {
    const error = new Error("IPC selhalo");
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    const test = await render(vi.fn(async () => { throw error; }));
    try {
      await test.click(); expect(test.document.body.textContent).toContain("Při otevírání zvuku došlo k chybě aplikace. Zkus přehrání znovu.");
      expect(logger).toHaveBeenCalledWith("Přehrávání místní nahrávky selhalo", error);
    } finally { await test.cleanup(); }
  });
});
