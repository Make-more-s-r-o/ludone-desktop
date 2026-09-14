import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { RecordingsDashboard } from "../src/features/recordings/RecordingsDashboard.jsx";

const REVISION = `sha256:${"a".repeat(64)}`;
const FILE_REVISION = `sha256:${"b".repeat(64)}`;
const CREATED_AT = "2026-09-14T10:00:00.000Z";

function recording(id, overrides = {}) {
  return {
    id,
    kind: "recording",
    state: "ceka",
    revision: REVISION,
    requiresHumanAction: false,
    ownership: "current",
    blockReason: null,
    createdAt: CREATED_AT,
    durationMs: 30_000,
    sizeBytes: 1_024,
    source: "queue",
    localState: "complete-audio",
    localReason: null,
    fileRevision: FILE_REVISION,
    uploadIntent: "approved",
    allowedActions: { claim: false, delete: false, retry: false, send: false },
    ...overrides,
  };
}

async function renderItems(items) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  const ludone = {
    listLocalRecordings: vi.fn(async () => ({ items, unreadableCount: 0 })),
  };
  Object.defineProperty(dom.window, "ludone", { configurable: true, value: ludone });
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("Node", dom.window.Node);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(dom.window.document.querySelector("#root"));
  await React.act(async () => root.render(React.createElement(
    RecordingsDashboard,
    { authState: "signed-in" },
  )));
  await vi.waitFor(() => expect(ludone.listLocalRecordings).toHaveBeenCalledOnce());
  return {
    card(id) {
      return dom.window.document.querySelector(`[data-recording-id="${id}"]`);
    },
    async cleanup() {
      await React.act(async () => root.unmount());
      dom.window.close();
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pravdivé stavy lokálních nahrávek", () => {
  it("rozliší stav fronty a consent bez tvrzení o neprovedeném serverovém ověření", async () => {
    const ids = {
      sending: "11111111-1111-4111-8111-111111111111",
      sent: "22222222-2222-4222-8222-222222222222",
      approved: "33333333-3333-4333-8333-333333333333",
      held: "44444444-4444-4444-8444-444444444444",
      failed: "55555555-5555-4555-8555-555555555555",
      unknown: "66666666-6666-4666-8666-666666666666",
      orphan: "77777777-7777-4777-8777-777777777777",
    };
    const dashboard = await renderItems([
      recording(ids.sending, { state: "odesila" }),
      recording(ids.sent, { state: "odeslano" }),
      recording(ids.approved),
      recording(ids.held, { uploadIntent: "held" }),
      recording(ids.failed, {
        state: "selhalo",
        blockReason: "Předchozí bezpečný pokus se nezdařil.",
        localReason: "Jedna lokální stopa chybí.",
      }),
      recording(ids.unknown, { state: "neocekavany-stav" }),
      recording(ids.orphan, {
        source: "orphan", state: "orphan", revision: null, ownership: "unavailable",
      }),
    ]);
    try {
      await vi.waitFor(() => expect(dashboard.card(ids.sent)).not.toBeNull());
      expect(dashboard.card(ids.sending).textContent).toContain("Odesílá se do LuDone");
      expect(dashboard.card(ids.sent).textContent).toContain("Odesláno podle stavu fronty");
      expect(dashboard.card(ids.sent).textContent).not.toContain("čeká ve frontě");
      expect(dashboard.card(ids.sent).textContent).not.toContain("Na serveru je úplná");
      const sentFacts = [...dashboard.card(ids.sent).querySelectorAll(
        ".recording-queue-card__facts span",
      )].map((fact) => fact.textContent.trim());
      expect(sentFacts).toContain("V aplikaci");
      expect(sentFacts).not.toContain("Ve frontě");
      expect(dashboard.card(ids.approved).textContent)
        .toContain("Schváleno k odeslání · čeká ve frontě");
      expect(dashboard.card(ids.held).textContent).toContain("Zůstává na Macu");
      expect(dashboard.card(ids.failed).textContent).toContain("Odeslání selhalo");
      expect(dashboard.card(ids.failed).textContent).toContain("Jedna lokální stopa chybí.");
      expect(dashboard.card(ids.failed).textContent)
        .toContain("Předchozí bezpečný pokus se nezdařil.");
      expect(dashboard.card(ids.unknown).textContent).toContain("Stav odeslání není známý");
      expect(dashboard.card(ids.orphan).textContent).toContain("Zůstává jen na tomto Macu");
    } finally {
      await dashboard.cleanup();
    }
  });

  it("u vlastního názvu zachová datum a zobrazí jen osmiznakový prefix ID", async () => {
    const id = "9e586e55-d688-43f1-8a80-a3d61e754f3e";
    const dashboard = await renderItems([recording(id, { title: "Porada výroby" })]);
    try {
      await vi.waitFor(() => expect(dashboard.card(id)).not.toBeNull());
      const text = dashboard.card(id).textContent;
      const expectedDate = new Intl.DateTimeFormat("cs-CZ", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(CREATED_AT));
      expect(text).toContain("Porada výroby");
      expect(text).toContain(expectedDate);
      expect(text).toContain("ID: 9e586e55");
      expect(text).not.toContain(id);
    } finally {
      await dashboard.cleanup();
    }
  });
});
