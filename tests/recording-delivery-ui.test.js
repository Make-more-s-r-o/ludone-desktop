import * as React from "react";
import { readFileSync } from "node:fs";
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

function snapshotItem(item) {
  const actions = item.actions ?? Object.fromEntries(["send", "retry", "claim"].map(key => {
    const limited = key !== "claim" && item.uploadRetryAt > Date.now();
    const disabled = key !== "claim" && item.sendingDisabledReason;
    return [key, limited ? { allowed: false, reason: "Server dočasně omezil odesílání.", retryAt: item.uploadRetryAt }
      : disabled ? { allowed: false, reason: "Odesílání je vypnuté." }
        : { allowed: item.allowedActions?.[key] === true, reason: null }];
  }));
  const canConfigureUpload = item.canConfigureUpload ?? (!item.uploadPreferencesLocked
    && (item.uploadIntent === "held" || (item.state === "selhalo" && String(item.blockReason).includes("company_out_of_scope"))));
  return { ...item, actions, canConfigureUpload };
}

async function mount(Component, props, methods = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  const ludone = { listLocalRecordings: vi.fn(async () => ({ items: [props.item ?? base], unreadableCount: 0 })),
    claimRecording: vi.fn(async () => ({ claimed: false })), ...methods };
  if (typeof ludone.listLocalRecordings === "function") {
    const list = ludone.listLocalRecordings;
    ludone.listLocalRecordings = vi.fn(async () => {
      const snapshot = await list();
      return { ...snapshot, items: snapshot.items.map(snapshotItem) };
    });
  }
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

it("náhled i seznam vysvětlí blokaci vlastnictví", async () => {
  const item = { ...base, ownership: "unknown", requiresHumanAction: true, blockReason: "queue_owner_unknown",
    allowedActions: { claim: true } };
  const preview = await mount(RecordingDayPreview, { items: [item], onOpenDay: vi.fn() }, {
    listLocalRecordings: vi.fn(async () => ({ items: [item], unreadableCount: 0 })),
  });
  try { await vi.waitFor(() => expect(preview.document.body.textContent).toContain("Neodešlo — vlastník nahrávky není potvrzený")); }
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

it("K1 náhled bez místní projekce zobrazí známý stav fronty", async () => {
  const { localState, ...queueOnly } = base;
  expect(localState).toBe("complete-audio");
  const preview = await mount(RecordingDayPreview, { items: [queueOnly], onOpenDay: vi.fn() }, { listLocalRecordings: undefined });
  try {
    expect(preview.document.body.textContent).toContain("Čeká na odeslání");
  } finally { await preview.cleanup(); }
});

it("K1 záložní snímek fronty nezamlčí známou blokaci ani neprozradí interní text", async () => {
  const item = { ...base, requiresHumanAction: true, blockReason: "Síťový požadavek uploadu selhal: soukromá adresa" };
  const preview = await mount(RecordingDayPreview, { items: [item], onOpenDay: vi.fn() }, { listLocalRecordings: undefined });
  try {
    expect(preview.document.body.textContent).toContain("Neodešlo — spojení se serverem se nepodařilo");
    expect(preview.document.body.textContent).not.toContain("soukromá adresa");
  } finally { await preview.cleanup(); }
});

it.each([
  [{ ...base, uploadIntent: "held", allowedActions: { send: true } }, "Jen na Macu"],
  [{ ...base, state: "odeslano" }, "Odesláno"],
  [{ ...base, requiresHumanAction: true, blockReason: "unauthorized", allowedActions: { retry: true } }, "Neodešlo — server odmítl odeslání"],
])("K1 náhled a historie přečtou tentýž místní snímek pro %s", async (item, expected) => {
  const listLocalRecordings = vi.fn(async () => ({ items: [item], unreadableCount: 0 }));
  const preview = await mount(RecordingDayPreview, { items: [{ ...item, blockReason: null }], onOpenDay: vi.fn() }, { listLocalRecordings });
  try {
    await vi.waitFor(() => expect(preview.document.querySelector(".day-preview__state")?.textContent).toBe(expected));
    expect(listLocalRecordings).toHaveBeenCalled();
  } finally { await preview.cleanup(); }
  const dashboard = await mount(RecordingsDashboard, { item });
  try { expect(dashboard.document.querySelector("summary .recording-queue-card__delivery").textContent).toBe(expected); }
  finally { await dashboard.cleanup(); }
});

it("K1 změna účtu zahodí opožděný snímek předchozího účtu", async () => {
  let finishOld;
  let authChanged;
  const oldSnapshot = new Promise((resolve) => { finishOld = resolve; });
  const item = { ...base, requiresHumanAction: true, blockReason: "unauthorized", allowedActions: { retry: true } };
  const listLocalRecordings = vi.fn().mockImplementationOnce(() => oldSnapshot)
    .mockResolvedValue({ items: [item], unreadableCount: 0 });
  const preview = await mount(RecordingDayPreview, { items: [base], onOpenDay: vi.fn() }, {
    listLocalRecordings, getAuthSessionState: vi.fn(async () => "valid"),
    onAuthSessionChanged: (callback) => { authChanged = callback; return () => {}; },
  });
  try {
    await vi.waitFor(() => expect(listLocalRecordings).toHaveBeenCalledOnce());
    await React.act(async () => authChanged());
    await vi.waitFor(() => expect(preview.document.body.textContent).toContain("Neodešlo — server odmítl odeslání"));
    await React.act(async () => finishOld({ items: [{ ...base, state: "odeslano" }] }));
    expect(preview.document.body.textContent).toContain("Neodešlo — server odmítl odeslání");
    expect(preview.document.body.textContent).not.toContain("Odesláno");
  } finally { await preview.cleanup(); }
});

it("K1 náhled po vypršení relace obnoví stejný stav jako historie", async () => {
  let session = "valid";
  const preview = await mount(RecordingDayPreview, { items: [base], onOpenDay: vi.fn() }, {
    getAuthSessionState: vi.fn(async () => session),
    listLocalRecordings: vi.fn(async () => ({ items: [base], unreadableCount: 0 })),
  });
  try {
    await vi.waitFor(() => expect(preview.document.body.textContent).toContain("Čeká na odeslání"));
    session = "expired";
    await vi.waitFor(() => expect(preview.document.body.textContent).toContain("Neodešlo — přihlášení vypršelo"), { timeout: 2_500 });
  } finally { await preview.cleanup(); }
});

it.each([
  [{ ...base, requiresHumanAction: true, blockReason: "insufficient_scope" }, "Přihlásit se v detailu"],
  [{ ...base, requiresHumanAction: true, blockReason: "company_not_chosen" }, "Vybrat firmu v detailu"],
])("K2 seznam neslibuje nepřítomné tlačítko v detailu", async (item, falsePromise) => {
  const dashboard = await mount(RecordingsDashboard, { item, detailId: ID });
  try {
    expect(dashboard.document.querySelector("summary").textContent).not.toContain(falsePromise);
    expect(dashboard.document.body.textContent).toContain("V panelu LuDone");
  } finally { await dashboard.cleanup(); }
});

it("K4 zamčená připnutá výchozí firma může po obnovení přístupu zkusit odeslání znovu", async () => {
  const item = { ...base, state: "selhalo", blockReason: "company_out_of_scope (HTTP 403)",
    uploadPreferences: { companyId: null, visibility: "private" }, uploadPreferencesLocked: true,
    allowedActions: { retry: true } };
  const retryRecording = vi.fn(async () => ({ outcome: "sent" }));
  const dashboard = await mount(RecordingsDashboard, { item, detailId: ID }, { retryRecording });
  try {
    const retry = dashboard.document.querySelector(".recording-action--retry");
    expect(retry.disabled).toBe(false);
    expect(dashboard.document.body.textContent).toContain("Po obnovení přístupu k této firmě");
    expect(dashboard.document.body.textContent).not.toContain("vyber firmu pro odesílání");
    await React.act(async () => retry.click());
    expect(retryRecording).toHaveBeenCalledExactlyOnceWith({ id: ID, queueRev: REV, fileRev: REV });
  } finally { await dashboard.cleanup(); }
});

it.each(["complete-audio", "partial-audio"])("K4 chybějící vazba firmy při stavu %s nevymýšlí řešení změnou výchozí firmy", async (localState) => {
  const item = { ...base, localState, requiresHumanAction: true, blockReason: "company_binding_missing", allowedActions: { retry: true } };
  const dashboard = await mount(RecordingsDashboard, { item, detailId: ID });
  try {
    expect(dashboard.document.body.textContent).toContain("u nahrávky nelze určit firmu");
    expect(dashboard.document.body.textContent).not.toContain("vyber firmu pro odesílání");
    expect(dashboard.document.querySelector(".recording-action--company")).toBeNull();
    expect(dashboard.document.querySelector(".recording-action--retry")).toBeNull();
  } finally { await dashboard.cleanup(); }
});

it("K5 vypnutý transport neblokuje povolené místní převzetí", async () => {
  const item = { ...base, ownership: "other", requiresHumanAction: true, sendingDisabledReason: "odesílání je vypnuté",
    allowedActions: { claim: true } };
  const dashboard = await mount(RecordingsDashboard, { item, detailId: ID });
  try {
    const claim = dashboard.document.querySelector(".recording-action--claim");
    expect(claim.disabled).toBe(false);
    await React.act(async () => claim.click());
    expect(dashboard.ludone.claimRecording).toHaveBeenCalledExactlyOnceWith(ID, REV);
  } finally { await dashboard.cleanup(); }
});

it.each(["send", "retry"])("K5 aktivní limit účtu vypne %s a ukáže čas z odpovědi", async (action) => {
  const retryAt = Date.now() + 120_000;
  const item = action === "send" ? { ...base, uploadIntent: "held", allowedActions: { send: true } }
    : { ...base, state: "selhalo", blockReason: "unauthorized", allowedActions: { retry: true } };
  const sendRecording = vi.fn(async () => ({ outcome: "rate_limited", retryAt }));
  const retryRecording = vi.fn(async () => ({ outcome: "rate_limited", retryAt }));
  const dashboard = await mount(RecordingsDashboard, { item, detailId: ID }, { sendRecording, retryRecording });
  try {
    const button = dashboard.document.querySelector(`.recording-action--${action}`);
    expect(button.disabled).toBe(false);
    await React.act(async () => button.click());
    expect(dashboard.document.querySelector(`.recording-action--${action}`).disabled).toBe(true);
    const clock = new Intl.DateTimeFormat("cs-CZ", { hour: "2-digit", minute: "2-digit" }).format(new Date(retryAt));
    expect(button.parentElement.textContent).toContain(`do ${clock}`);
    expect(action === "send" ? sendRecording : retryRecording).toHaveBeenCalledOnce();
  } finally { await dashboard.cleanup(); }
});

it("K5 limit načtený z projekce po vypršení zpřístupní opakování", async () => {
  const retryAt = Date.now() + 600;
  const item = { ...base, state: "selhalo", blockReason: "unauthorized", uploadRetryAt: retryAt,
    allowedActions: { retry: true } };
  const dashboard = await mount(RecordingsDashboard, { item, detailId: ID });
  try {
    expect(dashboard.document.querySelector(".recording-action--retry")).toBeNull();
    const clock = new Intl.DateTimeFormat("cs-CZ", { hour: "2-digit", minute: "2-digit" }).format(new Date(retryAt));
    expect(dashboard.document.body.textContent).toContain(`do ${clock}`);
    await vi.waitFor(() => expect(dashboard.document.querySelector(".recording-action--retry")?.disabled).toBe(false), { timeout: 2_000 });
  } finally { await dashboard.cleanup(); }
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
    uploadPreferencesLocked: true, allowedActions: { retry: false },
    actions: { retry: { allowed: false, reason: "Firmu této nahrávky už nelze změnit. Obrať se na správce LuDone." } } };
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
    expect(dashboard.document.querySelector(".recording-action--send")).toBeNull();
    expect(dashboard.document.body.textContent).toContain("Odesílání je vypnuté.");
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

it("N4 po rate_limited ukáže čas i v novém schváleném čekajícím snímku bez tlačítka", async () => {
  const retryAt = Date.now() + 120_000;
  const yes = { allowed: true, reason: null };
  const no = { allowed: false, reason: "Server dočasně omezil odesílání.", retryAt };
  /** @type {any} */
  let latest = { ...base, uploadIntent: "held", allowedActions: { send: true },
    actions: { send: yes, retry: { allowed: false, reason: "Čeká na odeslání." }, claim: { allowed: false, reason: null } } };
  const listLocalRecordings = vi.fn(async () => ({ items: [latest], unreadableCount: 0 }));
  const sendRecording = vi.fn(async () => {
    latest = { ...base, allowedActions: { send: false, retry: false }, actions: { send: no, retry: no, claim: { allowed: false, reason: null } } };
    return { outcome: "rate_limited", retryAt };
  });
  const dashboard = await mount(RecordingsDashboard, { item: latest, detailId: ID }, { listLocalRecordings, sendRecording });
  try {
    await React.act(async () => dashboard.document.querySelector(".recording-action--send").click());
    expect(sendRecording).toHaveBeenCalledOnce();
    expect(dashboard.document.querySelector(".recording-action--send")).toBeNull();
    expect(dashboard.document.querySelector(".recording-action--retry")).toBeNull();
    const clock = new Intl.DateTimeFormat("cs-CZ", { hour: "2-digit", minute: "2-digit" }).format(new Date(retryAt));
    expect(dashboard.document.body.textContent).toContain(clock);
  } finally { await dashboard.cleanup(); }
});

it("N2 chybějící zvuk skryje nepovolené retry a žádný pokyn jej neslibuje", async () => {
  const item = { ...base, requiresHumanAction: true, blockReason: "company_not_chosen", localState: "missing-audio",
    allowedActions: { retry: true }, actions: { retry: { allowed: false, reason: "Zvukové soubory chybí." },
      send: { allowed: false, reason: "Zvukové soubory chybí." }, claim: { allowed: false, reason: null } } };
  const dashboard = await mount(RecordingsDashboard, { item, detailId: ID });
  try {
    expect(dashboard.document.querySelector(".recording-action--retry")).toBeNull();
    expect(dashboard.document.body.textContent).not.toContain("zvol Zkusit znovu");
    expect(dashboard.document.body.textContent).toContain("Zvukové soubory chybí");
  } finally { await dashboard.cleanup(); }
});

it("N5 čekající položka náhledu používá barvu čekání", async () => {
  const preview = await mount(RecordingDayPreview, { items: [base], onOpenDay: vi.fn() });
  try {
    await vi.waitFor(() => expect(preview.document.querySelector(".day-preview__state--waiting")).not.toBeNull());
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.day-preview__state--waiting\s*\{\s*color:\s*var\(--panel-wait\)/u);
  } finally { await preview.cleanup(); }
});

it("důvod zakázaného retry nezakáže samostatně povolené odeslání", async () => {
  const item = { ...base, uploadIntent: "held", requiresHumanAction: true, blockReason: "unauthorized",
    actions: { send: { allowed: true, reason: null }, retry: { allowed: false, reason: "Opakování není dostupné." },
      claim: { allowed: false, reason: null } } };
  const dashboard = await mount(RecordingsDashboard, { item, detailId: ID });
  try {
    expect(dashboard.document.querySelector(".recording-action--send").disabled).toBe(false);
    expect(dashboard.document.querySelector(".recording-action--retry")).toBeNull();
  } finally { await dashboard.cleanup(); }
});

it("zamčený editor firmy neblokuje povolené opakování v otevřeném detailu (review k4)", async () => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const item = { ...base, requiresHumanAction: true, canConfigureUpload: false,
    blockReason: "Není vybraná firma, pod kterou se má nahrávka odeslat", allowedActions: { retry: true } };
  const retryRecording = vi.fn(async () => ({ outcome: "sent" }));
  const dashboard = await mount(RecordingsDashboard, { item }, { retryRecording, configureRecordingUpload: vi.fn(),
    listUploadCompanies: vi.fn(async () => ({ companies: [{ id: companyId, name: "Alfa" }], selectedCompanyId: companyId,
      offerToken: "offer-token-0000000000000001" })) });
  try {
    const detail = dashboard.document.querySelector("details.recording-queue-card");
    await React.act(async () => { detail.open = true; detail.dispatchEvent(new dashboard.document.defaultView.Event("toggle")); });
    const retry = dashboard.document.querySelector(".recording-action--retry");
    await vi.waitFor(() => expect(retry.disabled).toBe(false));
    expect(retry.parentElement.textContent).not.toContain("Ulož změněné volby");
    await React.act(async () => { retry.click(); });
    await vi.waitFor(() => expect(retryRecording).toHaveBeenCalledOnce());
  } finally { await dashboard.cleanup(); }
});
