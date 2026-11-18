import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recordingDisplayTitle } from "../src/lib/recording-display.js";

const dashboardModule = /** @type {Promise<{ RecordingsDashboard: React.ComponentType<any> }>} */
  (vi.importActual("../src/features/recordings/RecordingsDashboard.jsx"));
const previewModule = /** @type {Promise<{ RecordingDayPreview: React.ComponentType<any> }>} */
  (vi.importActual("../src/features/recordings/RecordingDayPreview.jsx"));
const controlsModule = /** @type {Promise<{ OsaHistoryControls: React.ComponentType<any> }>} */
  (vi.importActual("../src/components/osa/OsaHistoryControls.jsx"));
const shellModule = /** @type {Promise<{ OsaShell: React.ComponentType<any> }>} */
  (vi.importActual("../src/components/osa/OsaShell.jsx"));
const { RecordingsDashboard } = await dashboardModule;
const { RecordingDayPreview } = await previewModule;
const { OsaHistoryControls } = await controlsModule;
const { OsaShell } = await shellModule;

const REVISION = `sha256:${"a".repeat(64)}`;
const IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
];

function recording(id, overrides = {}) {
  return {
    id, kind: "recording", title: "Porada", createdAt: "2026-11-18T14:00:00.000Z",
    durationMs: 60_000, sizeBytes: 1024, state: "ceka", uploadIntent: "held",
    source: "queue", localState: "complete-audio", ownership: "current",
    revision: REVISION, fileRevision: REVISION,
    allowedActions: { claim: false, delete: false, retry: false, send: false },
    ...overrides,
  };
}

async function mount(element, ludone = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test", pretendToBeVisual: true });
  Object.defineProperty(dom.window, "ludone", { configurable: true, value: ludone });
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("Node", dom.window.Node);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(dom.window.document.querySelector("#root"));
  await React.act(async () => root.render(element));
  return {
    document: dom.window.document,
    window: dom.window,
    async render(next) { await React.act(async () => root.render(next)); },
    async cleanup() { await React.act(async () => root.unmount()); dom.window.close(); },
  };
}

async function dashboard(items, options = {}) {
  const ludone = {
    listLocalRecordings: vi.fn(async () => ({ items, unreadableCount: 0, ...options })),
    verifyRecording: vi.fn(async (id) => ({
      id, revision: REVISION, verifiedAt: "2026-11-18T15:00:00.000Z",
      tracks: { delivery: { status: "complete", mismatchFields: [] } },
    })),
  };
  const panel = await mount(React.createElement(RecordingsDashboard, {
    authState: "signed-in", authIdentity: { email: "test@ludone.cz" },
    authOrigin: "https://ludone.test", osa: true,
  }), ludone);
  await vi.waitFor(() => expect(ludone.listLocalRecordings).toHaveBeenCalledOnce());
  return panel;
}

afterEach(() => vi.unstubAllGlobals());

describe("#187 – drobnosti v panelu", () => {
  it("U5 řadí dny i nahrávky uvnitř dne od nejnovějších", async () => {
    const panel = await dashboard([
      recording(IDS[0], { title: "Ráno", createdAt: "2026-11-18T08:00:00Z" }),
      recording(IDS[1], { title: "Včera", createdAt: "2026-11-17T20:00:00Z" }),
      recording(IDS[2], { title: "Večer", createdAt: "2026-11-18T20:00:00Z" }),
      recording(IDS[3], { title: "Bez data", createdAt: null }),
    ]);
    try {
      const rows = [...panel.document.querySelectorAll("[data-recording-id]")];
      expect(rows.map((row) => row.getAttribute("data-recording-id"))).toEqual([IDS[2], IDS[0], IDS[1], IDS[3]]);
    } finally { await panel.cleanup(); }
  });

  it("U6 oddělí automatické datum od názvu v seznamu i náhledu bez úpravy dat", async () => {
    const items = [
      recording(IDS[0], { title: "18. listopadu 2026, 15:00 - Porada výroby" }),
      recording(IDS[1], { title: "18. listopadu 2026, 15:00" }),
      recording(IDS[2], { title: "Porada 18. listopadu" }),
    ];
    const panel = await dashboard(items);
    try {
      const titles = [...panel.document.querySelectorAll(".recording-queue-card__heading strong")].map((node) => node.textContent);
      expect(titles).toEqual(["Porada výroby", "Schůzka", "Porada 18. listopadu"]);
      expect(panel.document.querySelector(".recording-queue-card__facts").textContent).toContain("18. 11. 2026");
      expect(items[0].title).toBe("18. listopadu 2026, 15:00 - Porada výroby");
    } finally { await panel.cleanup(); }
    const preview = await mount(React.createElement(RecordingDayPreview, { items }));
    try {
      const titles = [...preview.document.querySelectorAll(".day-preview__item-copy strong")].map((node) => node.textContent);
      expect(titles).toEqual(["Porada výroby", "Schůzka", "Porada 18. listopadu"]);
      expect(preview.document.querySelector(".day-preview__item-copy small").textContent).toContain("18. 11. 2026");
    } finally { await preview.cleanup(); }
  });

  it.each([
    [null, "Schůzka"],
    ["   ", "Schůzka"],
    ["2. září 2026, 14:00 – Rozpočet – porada", "Rozpočet – porada"],
    ["Poznámky k 2. září 2026, 14:00", "Poznámky k 2. září 2026, 14:00"],
  ])("U6 u názvu %s zobrazí %s", (title, expected) => {
    expect(recordingDisplayTitle(title)).toBe(expected);
  });

  it("U7 skloňuje počty ve stránkování včetně nuly a dvaceti jedna", async () => {
    const panel = await mount(React.createElement(OsaHistoryControls, { result: { total: 0 } }));
    try {
      for (const [count, label] of [[0, "0 nahrávek"], [1, "1 nahrávka"], [2, "2 nahrávky"], [3, "3 nahrávky"], [4, "4 nahrávky"], [5, "5 nahrávek"], [21, "21 nahrávek"]]) {
        await panel.render(React.createElement(OsaHistoryControls, { result: { total: count } }));
        expect(panel.document.querySelector(".osa-pagination [role=status]").textContent).toContain(label);
      }
    } finally { await panel.cleanup(); }
  });

  it("U7 skloňuje i počet nečitelných nahrávek", async () => {
    const panel = await dashboard([], { unreadableCount: 2 });
    try {
      expect(panel.document.querySelector('[data-testid="unreadable-recordings"]').textContent).toContain("2 nahrávky");
    } finally { await panel.cleanup(); }
  });

  it("U8 vysvětlí převzetí u příslušné akce a bez ní upozornění nevypisuje", async () => {
    const noClaim = await dashboard([recording(IDS[0])]);
    try { expect(noClaim.document.body.textContent).not.toContain("Převzetí nahrávky ji neodešle"); }
    finally { await noClaim.cleanup(); }
    const claim = await dashboard([recording(IDS[0], { ownership: "other", allowedActions: { claim: true } })]);
    try {
      const actions = claim.document.querySelector('[data-station="pending"] .osa-station__actions');
      expect(actions.textContent).toContain("Převzít pod svůj účet");
      expect(actions.textContent).toContain("Převzetí nahrávky ji neodešle");
      expect(claim.document.querySelector(".recordings-dashboard__toolbar").parentElement.querySelector(":scope > .recordings-dashboard__notice")).toBeNull();
    } finally { await claim.cleanup(); }
  });

  it("U9 zkrátí stav odeslání a ověřený stav ukáže až po odpovědi serveru", async () => {
    const item = recording(IDS[0], { state: "odeslano" });
    const panel = await dashboard([item]);
    try {
      const status = () => panel.document.querySelector(".recording-queue-card__heading .recording-queue-card__delivery").textContent;
      expect(status()).toBe("Odesláno");
      expect([...panel.document.querySelectorAll(".osa-status-filters button")].map((button) => button.textContent)).toContain("Odesláno");
      expect(panel.document.querySelector("[data-recording-id]").getAttribute("data-osa-node")).toBe("unverified");
      expect(panel.document.body.textContent).toContain("Na serveru neověřeno");
      await React.act(async () => panel.document.querySelector(".recording-action--verify").click());
      expect(status()).toBe("V LuDone ✓");
      expect(panel.document.querySelector("[data-recording-id]").getAttribute("data-osa-node")).toBe("verified");
    } finally { await panel.cleanup(); }
    const preview = await mount(React.createElement(RecordingDayPreview, { items: [item] }));
    try { expect(preview.document.querySelector(".day-preview__state").textContent).toBe("Odesláno"); }
    finally { await preview.cleanup(); }
  });

  it("U9 neoznačí částečné nebo chybné serverové ověření za shodu", async () => {
    const item = recording(IDS[0], { state: "odeslano" });
    const ludone = {
      listLocalRecordings: vi.fn(async () => ({ items: [item], unreadableCount: 0 })),
      verifyRecording: vi.fn(async () => ({
        id: IDS[0], revision: REVISION, verifiedAt: "2026-11-18T15:00:00.000Z",
        tracks: { microphone: { status: "complete", mismatchFields: [] }, system: { status: "mismatch", mismatchFields: ["sha256"] } },
      })),
    };
    const panel = await mount(React.createElement(RecordingsDashboard, {
      authState: "signed-in", authIdentity: { email: "test@ludone.cz" }, authOrigin: "https://ludone.test", osa: true,
    }), ludone);
    try {
      await vi.waitFor(() => expect(ludone.listLocalRecordings).toHaveBeenCalledOnce());
      await React.act(async () => panel.document.querySelector(".recording-action--verify").click());
      expect(panel.document.querySelector("[data-recording-id]").getAttribute("data-osa-node")).toBe("unverified");
      expect(panel.document.querySelector('[data-station="error"]').textContent).toContain("neshodují");
      expect(panel.document.querySelector(".recording-queue-card__heading").textContent).not.toContain("V LuDone ✓");
    } finally { await panel.cleanup(); }
  });

  it("U11 vrátí panel po skrytí a opětovném zobrazení nahoru, ne při pouhém focusu", async () => {
    const panel = await mount(React.createElement(OsaShell, { page: "library" }, "Obsah"));
    try {
      const workspace = /** @type {HTMLElement} */ (panel.document.querySelector(".osa-workspace"));
      let visibility = "visible";
      Object.defineProperty(panel.document, "visibilityState", { configurable: true, get: () => visibility });
      workspace.scrollTop = 240;
      panel.window.dispatchEvent(new panel.window.Event("focus"));
      expect(workspace.scrollTop).toBe(240);
      visibility = "hidden";
      panel.document.dispatchEvent(new panel.window.Event("visibilitychange"));
      expect(workspace.scrollTop).toBe(240);
      visibility = "visible";
      panel.document.dispatchEvent(new panel.window.Event("visibilitychange"));
      expect(workspace.scrollTop).toBe(0);
    } finally { await panel.cleanup(); }
  });

  it("U11 nezasahuje do samostatného detailu při návratu z jiného okna", async () => {
    const panel = await mount(React.createElement(OsaShell, { page: "detail" }, "Detail"));
    try {
      const workspace = /** @type {HTMLElement} */ (panel.document.querySelector(".osa-workspace"));
      let visibility = "hidden";
      Object.defineProperty(panel.document, "visibilityState", { configurable: true, get: () => visibility });
      workspace.scrollTop = 240;
      panel.document.dispatchEvent(new panel.window.Event("visibilitychange"));
      visibility = "visible";
      panel.document.dispatchEvent(new panel.window.Event("visibilitychange"));
      expect(workspace.scrollTop).toBe(240);
    } finally { await panel.cleanup(); }
  });
});
