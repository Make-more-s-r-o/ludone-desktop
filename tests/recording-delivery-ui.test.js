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

it("náhled odkáže do historie a seznam vysvětlí blokaci vlastnictví", async () => {
  const item = { ...base, ownership: "unknown", requiresHumanAction: true, blockReason: "queue_owner_unknown",
    allowedActions: { claim: true } };
  const preview = await mount(RecordingDayPreview, { items: [item], onOpenDay: vi.fn() });
  try { expect(preview.document.body.textContent).toContain("Stav odeslání zjistíš v historii"); }
  finally { await preview.cleanup(); }
  const dashboard = await mount(RecordingsDashboard, { item });
  try {
    const row = dashboard.document.querySelector("[data-recording-id]");
    expect(row.dataset.osaNode).toBe("error");
    expect(row.querySelector("summary").textContent).toContain("Neodešlo — vlastník nahrávky není potvrzený");
    expect(row.querySelector("summary").textContent).toContain("Převzít nahrávku v detailu");
    const claim = dashboard.document.querySelector(".recording-action--claim");
    expect(claim.textContent).toContain("Převzít nahrávku");
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
    expect(dashboard.document.querySelector(".recording-action--company")).toBeNull();
    expect(dashboard.document.body.textContent).toContain("V panelu LuDone otevři Nastavení → Účet");
    expect(openSettings).not.toHaveBeenCalled();
    expect(dashboard.document.querySelector(".recording-action--retry").disabled).toBe(false);
  } finally { await dashboard.cleanup(); }
});

it("přechod na firmu v otevřeném detailu zaostří skutečný výběr", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const item = { ...base, state: "selhalo", requiresHumanAction: true, blockReason: "company_out_of_scope (HTTP 403)", allowedActions: { retry: true } };
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
  const item = { ...base, state: "selhalo", blockReason: "company_out_of_scope (HTTP 403)",
    uploadPreferences: { companyId: null, visibility: "private" }, allowedActions: { retry: true } };
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
    expect(dashboard.document.querySelector(".recording-action--login")).toBeNull();
    expect(dashboard.document.body.textContent).toContain("V panelu LuDone otevři přihlášení");
    expect(returnToNowPanel).not.toHaveBeenCalled();
  } finally { await dashboard.cleanup(); }
});

it("chybějící oprávnění otevře účet a samo uživatele neodhlásí", async () => {
  const item = { ...base, requiresHumanAction: true, blockReason: "insufficient_scope (HTTP 403)", allowedActions: { retry: true } };
  const openSettings = vi.fn();
  const signOut = vi.fn();
  const dashboard = await mount(RecordingsDashboard, { item }, { openSettings, signOut });
  try {
    expect(dashboard.document.querySelector("summary").textContent).toContain("přihlášení nemá oprávnění k odeslání");
    expect(dashboard.document.querySelector(".recording-action--login")).toBeNull();
    expect(dashboard.document.body.textContent).toContain("V panelu LuDone otevři Nastavení → Účet");
    expect(openSettings).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  } finally { await dashboard.cleanup(); }
});

it("R1 náhled bez kontroly souborů a přihlášení neodvozuje výsledek odeslání", async () => {
  const { localState, ...queueOnly } = base;
  expect(localState).toBe("complete-audio");
  const preview = await mount(RecordingDayPreview, { items: [queueOnly], onOpenDay: vi.fn() });
  try {
    expect(preview.document.body.textContent).toContain("Stav odeslání zjistíš v historii");
    expect(preview.document.body.textContent).not.toContain("Čeká na odeslání");
  } finally { await preview.cleanup(); }
});

it("R1 filtr historie používá vypršelou relaci stejně jako červený řádek", async () => {
  const dashboard = await mount(RecordingsDashboard, { item: base, authState: "expired", osa: true });
  try {
    const button = [...dashboard.document.querySelectorAll(".osa-status-filters button")].find((node) => node.textContent === "Pozornost");
    await React.act(async () => button.click());
    const row = dashboard.document.querySelector("[data-recording-id]");
    expect(row?.dataset.osaNode).toBe("error");
    expect(row?.textContent).toContain("přihlášení vypršelo");
  } finally { await dashboard.cleanup(); }
});

it("R2 detail bez oprávnění k otevření nastavení dává pokyn pro účet", async () => {
  const item = { ...base, requiresHumanAction: true, blockReason: "insufficient_scope" };
  const openSettings = vi.fn();
  const dashboard = await mount(RecordingsDashboard, { item, detailId: ID }, { openSettings });
  try {
    expect(dashboard.document.body.textContent).toContain("V panelu LuDone otevři Nastavení → Účet");
    expect(dashboard.document.querySelector(".recording-action--login")).toBeNull();
    expect(openSettings).not.toHaveBeenCalled();
  } finally { await dashboard.cleanup(); }
});

it("R3 schválená položka bez firmy neotevírá nezapisovatelný editor", async () => {
  const item = { ...base, requiresHumanAction: true, blockReason: "company_not_chosen", allowedActions: { retry: true } };
  const dashboard = await mount(RecordingsDashboard, { item, detailId: ID }, { openSettings: vi.fn() });
  try {
    expect(dashboard.document.querySelector(".recording-action--company")).toBeNull();
    expect(dashboard.document.body.textContent).toContain("V panelu LuDone otevři Nastavení → Účet");
  } finally { await dashboard.cleanup(); }
});

it("R3 odmítnutou zamčenou konkrétní firmu nelze opakovat", async () => {
  const item = { ...base, state: "selhalo", blockReason: "company_out_of_scope (HTTP 403)",
    uploadPreferences: { companyId: "22222222-2222-4222-8222-222222222222", visibility: "private" },
    uploadPreferencesLocked: true, allowedActions: { retry: true } };
  const dashboard = await mount(RecordingsDashboard, { item, detailId: ID });
  try {
    const retry = dashboard.document.querySelector(".recording-action--retry");
    expect(!retry || retry.disabled).toBe(true);
    expect(dashboard.document.body.textContent).toContain("Firmu této nahrávky už nelze změnit");
  } finally { await dashboard.cleanup(); }
});

it("R8 transport vypnutý při načtení vysvětlí disabled tlačítko", async () => {
  const item = { ...base, uploadIntent: "held", sendingDisabledReason: "odesílání je vypnuté", allowedActions: { send: true } };
  const dashboard = await mount(RecordingsDashboard, { item, detailId: ID });
  try {
    const send = dashboard.document.querySelector(".recording-action--send");
    expect(send.disabled).toBe(true);
    expect(send.parentElement.textContent).toContain("Odesílání je vypnuté.");
  } finally { await dashboard.cleanup(); }
});

it("R8 výsledek disabled po kliknutí zůstane viditelný", async () => {
  const item = { ...base, uploadIntent: "held", allowedActions: { send: true } };
  let latest = item;
  const sendRecording = vi.fn(async () => {
    latest = { ...base, uploadIntent: "approved", allowedActions: { send: false } };
    return { outcome: "disabled", reason: "odesílání je vypnuté" };
  });
  const listLocalRecordings = vi.fn(async () => ({ items: [latest], unreadableCount: 0 }));
  const dashboard = await mount(RecordingsDashboard, { item, detailId: ID }, { sendRecording, listLocalRecordings });
  try {
    await React.act(async () => dashboard.document.querySelector(".recording-action--send").click());
    expect(sendRecording).toHaveBeenCalledExactlyOnceWith({ id: ID, queueRev: REV, fileRev: REV });
    expect(dashboard.document.body.textContent).toContain("Neodešlo — odesílání je vypnuté");
    expect(dashboard.document.querySelector("[data-recording-id]").dataset.osaNode).toBe("error");
    expect(dashboard.document.body.textContent).not.toContain("Čeká na odeslání");
  } finally { await dashboard.cleanup(); }
});

it.each(["ceka", "selhalo"])("R5 ověřená serverová kopie stavu %s projde filtrem Odesláno a nemá retry", async (state) => {
  const item = { ...base, state, allowedActions: { retry: state === "selhalo" } };
  const verifyRecording = vi.fn(async () => ({ id: ID, revision: REV, verifiedAt: "2026-11-19T12:00:00Z",
    tracks: { delivery: { status: "complete", mismatchFields: [] } } }));
  const dashboard = await mount(RecordingsDashboard, { item, osa: true }, { verifyRecording });
  try {
    await React.act(async () => dashboard.document.querySelector(".recording-action--verify").click());
    expect(verifyRecording).toHaveBeenCalledExactlyOnceWith(ID, REV);
    const sentFilter = [...dashboard.document.querySelectorAll(".osa-status-filters button")].find((node) => node.textContent === "Odesláno");
    await React.act(async () => sentFilter.click());
    const row = dashboard.document.querySelector("[data-recording-id]");
    expect(row?.dataset.osaNode).toBe("verified");
    expect(row?.textContent).toContain("V LuDone ✓");
    expect(dashboard.document.querySelector(".recording-action--retry")).toBeNull();
  } finally { await dashboard.cleanup(); }
});

it("R7 chybějící část zvuku neschová blokaci oprávnění a nenabídne marné retry", async () => {
  const item = { ...base, localState: "partial-audio", requiresHumanAction: true,
    blockReason: "insufficient_scope", allowedActions: { retry: true } };
  const dashboard = await mount(RecordingsDashboard, { item, detailId: ID });
  try {
    const text = dashboard.document.body.textContent;
    expect(text).toContain("část zvuku chybí");
    expect(text).toContain("přihlášení nemá oprávnění k odeslání");
    expect(text).toContain("V panelu LuDone otevři Nastavení → Účet");
    expect(dashboard.document.querySelector(".recording-action--retry")).toBeNull();
  } finally { await dashboard.cleanup(); }
});

it("P3 po potvrzeném převzetí ukáže další výslovný krok odeslání", async () => {
  const other = { ...base, ownership: "other", allowedActions: { claim: true } };
  /** @type {any} */
  let latest = other;
  const listLocalRecordings = vi.fn(async () => ({ items: [latest], unreadableCount: 0 }));
  const claimRecording = vi.fn(async () => {
    latest = { ...base, ownership: "current", uploadIntent: "held", requiresHumanAction: true,
      blockReason: "Převzatá nahrávka čeká na volbu odeslání", allowedActions: { send: true } };
    return { claimed: true };
  });
  const dashboard = await mount(RecordingsDashboard, { item: other }, { claimRecording, listLocalRecordings });
  try {
    const claim = dashboard.document.querySelector(".recording-action--claim");
    expect(claim.textContent).toBe("Převzít nahrávku");
    await React.act(async () => claim.click());
    expect(claimRecording).toHaveBeenCalledExactlyOnceWith(ID, REV);
    expect(dashboard.document.body.textContent).toContain("Jen na Macu");
    expect(dashboard.document.body.textContent).toContain("Vyber firmu a potvrď Odeslat");
    expect(dashboard.document.querySelector(".recording-action--send")).not.toBeNull();
  } finally { await dashboard.cleanup(); }
});

it("R6 cizí held zůstane lokální a v detailu dovolí rozhodnout o převzetí", async () => {
  const item = { ...base, uploadIntent: "held", ownership: "other", allowedActions: { claim: true } };
  const dashboard = await mount(RecordingsDashboard, { item });
  try {
    const row = dashboard.document.querySelector("[data-recording-id]");
    expect(row.dataset.osaNode).toBe("local");
    expect(row.querySelector("summary").textContent).toContain("Jen na Macu");
    expect(dashboard.document.querySelector(".recording-action--claim").textContent).toBe("Převzít nahrávku");
    expect(dashboard.document.body.textContent).toContain("Převzetí nahrávky ji neodešle");
  } finally { await dashboard.cleanup(); }
});
