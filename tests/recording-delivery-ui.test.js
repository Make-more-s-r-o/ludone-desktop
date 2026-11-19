import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, expect, it, vi } from "vitest";

const dashboardModule = /** @type {Promise<{ RecordingsDashboard: React.ComponentType<any> }>} */
  (vi.importActual("../src/features/recordings/RecordingsDashboard.jsx"));
const previewModule = /** @type {Promise<{ RecordingDayPreview: React.ComponentType<any> }>} */
  (vi.importActual("../src/features/recordings/RecordingDayPreview.jsx"));
const { RecordingsDashboard } = await dashboardModule;
const { RecordingDayPreview } = await previewModule;
const ID = "9e586e55-d688-43f1-8a80-a3d61e754f3e";
const REV = `sha256:${"a".repeat(64)}`;
const base = { id: ID, kind: "recording", title: "Klárka", source: "queue", state: "ceka",
  uploadIntent: "approved", ownership: "current", localState: "complete-audio", revision: REV,
  fileRevision: REV, createdAt: "2026-11-19T12:00:00.000Z", durationMs: 60_000,
  allowedActions: { claim: false, retry: false, send: false } };

async function mount(Component, props, methods = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  const ludone = { listLocalRecordings: vi.fn(async () => ({ items: [props.item ?? base], unreadableCount: 0 })),
    claimRecording: vi.fn(async () => ({ claimed: false })), ...methods };
  Object.defineProperty(dom.window, "ludone", { value: ludone });
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("Node", dom.window.Node);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(dom.window.document.querySelector("#root"));
  const componentProps = Component === RecordingsDashboard
    ? { authState: "signed-in", authIdentity: { email: "test@ludone.cz" }, authOrigin: "https://ludone.test", ...props }
    : props;
  await React.act(async () => root.render(React.createElement(Component, componentProps)));
  if (Component === RecordingsDashboard) await vi.waitFor(() => expect(dom.window.document.querySelector("[data-recording-id]")).not.toBeNull());
  return { document: /** @type {any} */ (dom.window.document), ludone: /** @type {any} */ (ludone),
    async cleanup() { await React.act(async () => root.unmount()); dom.window.close(); } };
}

afterEach(() => vi.unstubAllGlobals());

it("náhled i seznam vysvětlí stejnou blokaci vlastnictví", async () => {
  const item = { ...base, ownership: "unknown", requiresHumanAction: true, blockReason: "queue_owner_unknown",
    allowedActions: { claim: true } };
  const preview = await mount(RecordingDayPreview, { items: [item], onOpenDay: vi.fn() });
  try { expect(preview.document.body.textContent).toContain("Neodešlo — vlastník nahrávky není potvrzený"); }
  finally { await preview.cleanup(); }
  const dashboard = await mount(RecordingsDashboard, { item });
  try {
    const row = dashboard.document.querySelector("[data-recording-id]");
    expect(row.dataset.osaNode).toBe("error");
    expect(row.querySelector("summary").textContent).toContain("Neodešlo — vlastník nahrávky není potvrzený");
    expect(row.querySelector("summary").textContent).toContain("Převzít a odeslat v detailu");
    const claim = dashboard.document.querySelector(".recording-action--claim");
    expect(claim.textContent).toContain("Převzít a odeslat");
    expect(dashboard.document.body.textContent).toContain("Převzetí nahrávky ji neodešle");
    await React.act(async () => claim.click());
    expect(dashboard.ludone.claimRecording).toHaveBeenCalledExactlyOnceWith(ID, REV);
  } finally { await dashboard.cleanup(); }
});

it("vlastní zablokovaná položka nabídne opakování s lidským důvodem", async () => {
  const item = { ...base, requiresHumanAction: true, blockReason: "unauthorized", allowedActions: { retry: true } };
  const dashboard = await mount(RecordingsDashboard, { item });
  try {
    expect(dashboard.document.querySelector("summary").textContent).toContain("Neodešlo — server odmítl odeslání");
    expect(dashboard.document.querySelector(".recording-action--retry").disabled).toBe(false);
  } finally { await dashboard.cleanup(); }
});

it("šedé tlačítko při neuložených volbách vysvětlí, co udělat", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const item = { ...base, uploadIntent: "held", uploadPreferences: { companyId, visibility: "private" }, allowedActions: { send: true } };
  const dashboard = await mount(RecordingsDashboard, { item }, {
    configureRecordingUpload: vi.fn(),
    listUploadCompanies: vi.fn(async () => ({ companies: [{ id: companyId, name: "Alfa" }], selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" })),
  });
  try {
    const detail = dashboard.document.querySelector("details.recording-queue-card");
    await React.act(async () => { detail.open = true; detail.dispatchEvent(new dashboard.document.defaultView.Event("toggle")); });
    await vi.waitFor(() => expect(dashboard.document.querySelector('[data-testid="recording-upload-visibility"]')?.disabled).toBe(false));
    const select = dashboard.document.querySelector('[data-testid="recording-upload-visibility"]');
    await React.act(async () => { select.value = "company"; select.dispatchEvent(new dashboard.document.defaultView.Event("change", { bubbles: true })); });
    const send = dashboard.document.querySelector(".recording-action--send");
    expect(send.disabled).toBe(true);
    expect(send.parentElement.textContent).toContain("Ulož změněné volby");
  } finally { await dashboard.cleanup(); }
});

it("nevybraná firma nabídne přechod na volbu firmy bez odeslání", async () => {
  const item = { ...base, requiresHumanAction: true,
    blockReason: "Není vybraná firma, pod kterou se má nahrávka odeslat", allowedActions: { retry: true } };
  const openSettings = vi.fn();
  const dashboard = await mount(RecordingsDashboard, { item }, { openSettings });
  try {
    expect(dashboard.document.querySelector("summary").textContent).toContain("Neodešlo — chybí vybraná firma");
    const action = dashboard.document.querySelector(".recording-action--company");
    expect(action.textContent).toBe("Vybrat firmu");
    await React.act(async () => action.click());
    expect(openSettings).toHaveBeenCalledExactlyOnceWith("account");
    expect(dashboard.document.querySelector(".recording-action--retry").disabled).toBe(false);
  } finally { await dashboard.cleanup(); }
});

it("přechod na firmu v otevřeném detailu zaostří skutečný výběr", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const item = { ...base, requiresHumanAction: true, blockReason: "company_not_chosen", allowedActions: { retry: true } };
  const openSettings = vi.fn();
  const dashboard = await mount(RecordingsDashboard, { item }, {
    openSettings, configureRecordingUpload: vi.fn(),
    listUploadCompanies: vi.fn(async () => ({ companies: [{ id: companyId, name: "Alfa" }], selectedCompanyId: null, offerToken: "offer-token-0000000000000001" })),
  });
  try {
    const detail = dashboard.document.querySelector("details.recording-queue-card");
    await React.act(async () => { detail.open = true; detail.dispatchEvent(new dashboard.document.defaultView.Event("toggle")); });
    await vi.waitFor(() => expect(dashboard.document.querySelector('[data-testid="recording-upload-company"]')?.disabled).toBe(false));
    await React.act(async () => dashboard.document.querySelector(".recording-action--company").click());
    expect(dashboard.document.activeElement).toBe(dashboard.document.querySelector('[data-testid="recording-upload-company"]'));
    expect(openSettings).not.toHaveBeenCalled();
    expect(dashboard.ludone.configureRecordingUpload).not.toHaveBeenCalled();
  } finally { await dashboard.cleanup(); }
});

it("i šedé opakování vysvětlí neuloženou změnu voleb", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const item = { ...base, state: "selhalo", blockReason: "network_error",
    uploadPreferences: { companyId, visibility: "private" }, allowedActions: { retry: true } };
  const dashboard = await mount(RecordingsDashboard, { item }, {
    configureRecordingUpload: vi.fn(),
    listUploadCompanies: vi.fn(async () => ({ companies: [{ id: companyId, name: "Alfa" }], selectedCompanyId: companyId, offerToken: "offer-token-0000000000000001" })),
  });
  try {
    const detail = dashboard.document.querySelector("details.recording-queue-card");
    await React.act(async () => { detail.open = true; detail.dispatchEvent(new dashboard.document.defaultView.Event("toggle")); });
    await vi.waitFor(() => expect(dashboard.document.querySelector('[data-testid="recording-upload-visibility"]')?.disabled).toBe(false));
    const select = dashboard.document.querySelector('[data-testid="recording-upload-visibility"]');
    await React.act(async () => { select.value = "company"; select.dispatchEvent(new dashboard.document.defaultView.Event("change", { bubbles: true })); });
    const retry = dashboard.document.querySelector(".recording-action--retry");
    expect(retry.disabled).toBe(true);
    expect(retry.parentElement.textContent).toContain("Ulož změněné volby");
  } finally { await dashboard.cleanup(); }
});

it("vypršené přihlášení nabídne cestu zpět k přihlášení, ne převzetí", async () => {
  const item = { ...base, ownership: "unknown", requiresHumanAction: true,
    blockReason: "queue_owner_unknown", allowedActions: { claim: true } };
  const returnToNowPanel = vi.fn();
  const dashboard = await mount(RecordingsDashboard, { item, authState: "expired" }, { returnToNowPanel });
  try {
    expect(dashboard.document.querySelector("summary").textContent).toContain("Neodešlo — přihlášení vypršelo");
    expect(dashboard.document.querySelector("[data-recording-id]").dataset.osaNode).toBe("error");
    expect(dashboard.document.querySelector(".recording-action--claim")).toBeNull();
    await React.act(async () => dashboard.document.querySelector(".recording-action--login").click());
    expect(returnToNowPanel).toHaveBeenCalledOnce();
  } finally { await dashboard.cleanup(); }
});

it("chybějící oprávnění otevře účet a samo uživatele neodhlásí", async () => {
  const item = { ...base, requiresHumanAction: true, blockReason: "insufficient_scope (HTTP 403)", allowedActions: { retry: true } };
  const openSettings = vi.fn();
  const signOut = vi.fn();
  const dashboard = await mount(RecordingsDashboard, { item }, { openSettings, signOut });
  try {
    expect(dashboard.document.querySelector("summary").textContent).toContain("přihlášení nemá oprávnění k odeslání");
    await React.act(async () => dashboard.document.querySelector(".recording-action--login").click());
    expect(openSettings).toHaveBeenCalledExactlyOnceWith("account");
    expect(signOut).not.toHaveBeenCalled();
  } finally { await dashboard.cleanup(); }
});
