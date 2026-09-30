import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, expect, it, vi } from "vitest";
import { UploadCompanySelector, RecordingUploadPreferences } from "./UploadCompanySelector.jsx";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const offer = { companies: [{ id: A, name: "Alfa" }, { id: B, name: "Beta" }], selectedCompanyId: A, offerToken: "offer-token-0000000000000001" };
const mounted = [];
async function mount(Component, props = {}, ludone = {}) {
  const dom = new JSDOM('<div id="root"></div>');
  Object.defineProperty(dom.window, "ludone", { value: ludone });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true })) vi.stubGlobal(key, value);
  const root = createRoot(dom.window.document.querySelector("#root"));
  const render = async (next = props) => React.act(async () => root.render(React.createElement(Component, next)));
  await render(); mounted.push({ dom, root });
  return { document: dom.window.document, render };
}
async function change(document, selector, value) { await React.act(async () => {
  const input = document.querySelector(selector); input.value = value;
  input.dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
}); }
afterEach(async () => { for (const { dom, root } of mounted.splice(0).reverse()) { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("window", dom.window); vi.stubGlobal("document", dom.window.document); await React.act(async () => root.unmount()); dom.window.close(); } vi.unstubAllGlobals(); });
it("lokální uložený default se při otevření i opětovném otevření ukáže a select zůstane po save", async () => {
  let selected = A;
  const ludone = { getUploadCompanyDefault: vi.fn(async () => ({ companyId: selected })),
    listUploadCompanies: vi.fn(async () => ({ ...offer, selectedCompanyId: selected })),
    selectUploadCompany: vi.fn(async (_token, value) => { selected = value; return { saved: true, selectedCompanyId: value }; }) };
  const props = { authState: { state: "signed-in", identity: { email: "a@test.cz" } } };
  const panel = await mount(UploadCompanySelector, props, ludone);
  expect(panel.document.querySelector('[data-testid="upload-company-select"]').value).toBe(A);
  await change(panel.document, 'select', B);
  expect(panel.document.body.textContent).toContain("Neuložená změna");
  await React.act(async () => panel.document.querySelector('[data-testid="upload-company-save"]').click());
  expect(panel.document.querySelector('select').value).toBe(B);
  expect(panel.document.body.textContent).toContain("Firma je uložená");
  await panel.render({ authState: { state: "signed-out" } }); await panel.render(props);
  expect(panel.document.querySelector('select').value).toBe(B);
});
it("offline nabídka nesmaže uložený default ani netvrdí, že firma není vybraná", async () => {
  const panel = await mount(UploadCompanySelector, { authState: { state: "signed-in" } }, {
    getUploadCompanyDefault: async () => ({ companyId: A }), listUploadCompanies: async () => { throw new Error("offline"); } });
  expect(panel.document.body.textContent).toContain("Uložená výchozí firma zůstává zachovaná");
});
it("nová nahrávka company a historická private; editace nevolá account save ani upload", async () => {
  const onChange = vi.fn(); const selectUploadCompany = vi.fn();
  const props = { defaultVisibility: "company", onChange };
  const panel = await mount(RecordingUploadPreferences, props, { listUploadCompanies: async () => offer, selectUploadCompany });
  expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("company");
  await change(panel.document, '[data-testid="recording-upload-company"]', B);
  await change(panel.document, '[data-testid="recording-upload-visibility"]', "private");
  expect(onChange).toHaveBeenLastCalledWith({ companyId: B, offerToken: offer.offerToken, visibility: "private" }, true);
  expect(selectUploadCompany).not.toHaveBeenCalled();
  await panel.render({ onChange, initialValue: { companyId: A, visibility: "private" } });
  expect(panel.document.querySelector('[data-testid="recording-upload-visibility"]').value).toBe("private");
});
it("auth session change zahodí pozdní nabídku a vyžádá nový klik", async () => {
  let changed; let resolve;
  const onChange = vi.fn();
  const panel = await mount(RecordingUploadPreferences, { onChange }, {
    listUploadCompanies: () => new Promise((done) => { resolve = done; }),
    onAuthSessionChanged: (callback) => { changed = callback; return () => {}; } });
  await React.act(async () => { changed(); resolve(offer); });
  expect(panel.document.querySelector('[data-testid="recording-upload-company"]').options).toHaveLength(1);
  expect(onChange).toHaveBeenLastCalledWith(null, true);
});
it("progress zamkne editor a nabídku vůbec nenačítá", async () => {
  const listUploadCompanies = vi.fn();
  const panel = await mount(RecordingUploadPreferences, { locked: true }, { listUploadCompanies });
  expect(listUploadCompanies).not.toHaveBeenCalled();
  expect(panel.document.querySelector('select')).toBeNull();
  expect(panel.document.body.textContent).toContain("odesílání už začalo");
});

it("save pending a error zachová uloženou firmu a novou explicitní volbu", async () => {
  let reject;
  const panel = await mount(UploadCompanySelector, { authState: { state: "signed-in" } }, {
    getUploadCompanyDefault: async () => ({ companyId: A }), listUploadCompanies: async () => offer,
    selectUploadCompany: () => new Promise((_resolve, fail) => { reject = fail; }) });
  await change(panel.document, 'select', B);
  await React.act(async () => panel.document.querySelector('[data-testid="upload-company-save"]').click());
  expect(panel.document.querySelector('select').disabled).toBe(true);
  expect(panel.document.body.textContent).toContain("Ukládám");
  await React.act(async () => reject(new Error("offline")));
  expect(panel.document.querySelector('select').value).toBe(B);
  expect(panel.document.body.textContent).toContain("Uložená volba zůstává zachovaná");
});
it("default getter po změně identity nepřevezme opožděnou cizí firmu", async () => {
  let resolve;
  const listUploadCompanies = vi.fn(async () => offer);
  const panel = await mount(UploadCompanySelector, { authState: { state: "signed-in", identity: { email: "a@test.cz" } } }, {
    getUploadCompanyDefault: () => new Promise((done) => { resolve = done; }), listUploadCompanies });
  await panel.render({ authState: { state: "signed-out" } });
  await React.act(async () => resolve({ companyId: A }));
  expect(listUploadCompanies).not.toHaveBeenCalled();
  expect(panel.document.body.textContent).not.toContain("Alfa");
});

it("opakované uložení obnoví spotřebovaný token a zachová explicitní druhou firmu", async () => {
  let counter = 0; const used = new Set();
  const selectUploadCompany = vi.fn(async (token, selectedCompanyId) => {
    if (used.has(token)) throw new Error("stale_offer");
    used.add(token); return { saved: true, selectedCompanyId };
  });
  const panel = await mount(UploadCompanySelector, { authState: { state: "signed-in" } }, {
    getUploadCompanyDefault: async () => ({ companyId: A }),
    listUploadCompanies: async () => ({ ...offer, offerToken: `offer-token-00000000000000${++counter}` }), selectUploadCompany });
  await React.act(async () => panel.document.querySelector('[data-testid="upload-company-save"]').click());
  await change(panel.document, 'select', B);
  await React.act(async () => panel.document.querySelector('[data-testid="upload-company-save"]').click());
  expect(selectUploadCompany).toHaveBeenCalledTimes(2);
  expect(selectUploadCompany.mock.calls[0][0]).not.toBe(selectUploadCompany.mock.calls[1][0]);
  expect(panel.document.querySelector('select').value).toBe(B);
  expect(panel.document.body.textContent).toContain("Firma je uložená");
});
