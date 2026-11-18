import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, expect, it, vi } from "vitest";
import { RecordingUploadPreferences, UploadCompanySelector, uploadCompanyErrorMessage } from "../src/components/UploadCompanySelector.jsx";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const offer = { companies: [{ id: A, name: "Alfa" }, { id: B, name: "Beta" }],
  selectedCompanyId: A, offerToken: "offer-token-0000000000000001" };
const mounted = [];

async function mount(Component, props, ludone) {
  const dom = new JSDOM('<div id="root"></div>');
  Object.defineProperty(dom.window, "ludone", { value: ludone });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    React, IS_REACT_ACT_ENVIRONMENT: true })) vi.stubGlobal(key, value);
  const root = createRoot(dom.window.document.querySelector("#root"));
  const render = async (next) => React.act(async () => root.render(React.createElement(Component, next)));
  await render(props);
  mounted.push({ dom, root });
  return { document: dom.window.document, render };
}

afterEach(async () => {
  for (const { dom, root } of mounted.splice(0).reverse()) {
    vi.stubGlobal("window", dom.window); vi.stubGlobal("document", dom.window.document);
    await React.act(async () => root.unmount()); dom.window.close();
  }
  vi.unstubAllGlobals();
});

it.each([
  ["Seznam firem selhal (HTTP 401)", /přihlášení.*401/u],
  ["Seznam firem selhal (HTTP 403)", /oprávnění.*403/u],
  ["TypeError: Failed to fetch", /Zkontroluj síť/u],
  ["invalid_company_offer", /neplatnou nabídku/u],
  ["neznámá chyba", /Důvod se nepodařilo zjistit/u],
])("uživatelská chyba vychází z dostupného důvodu %s", (detail, expected) => {
  expect(uploadCompanyErrorMessage(new Error(detail))).toMatch(expected);
});

it("změna generace při načítání účtu neskončí bez zprávy v idle", async () => {
  let resolve;
  const props = { authState: { state: "signed-in", generation: 1, issuer: "https://app.ludone.cz", identity: { email: "a@test.cz" } } };
  const panel = await mount(UploadCompanySelector, props, {
    getUploadCompanyDefault: async () => ({ companyId: null }),
    listUploadCompanies: () => new Promise((done) => { resolve = done; }),
  });
  await React.act(async () => panel.document.querySelector("button").click());
  await panel.render({ authState: { ...props.authState, generation: 2 } });
  await React.act(async () => resolve(offer));
  expect(panel.document.querySelector('[data-testid="upload-company-select"], [role="alert"]')).not.toBeNull();
  expect(panel.document.body.textContent).toContain("Výchozí firma pro nové nahrávky");
});

it("nedostupný most firem po kliku vysvětlí chybu", async () => {
  const panel = await mount(UploadCompanySelector, { authState: { state: "signed-in" } }, {});
  await React.act(async () => panel.document.querySelector("button").click());
  expect(panel.document.querySelector('[role="alert"]')).not.toBeNull();
});

it("v účtu při výpadku ukáže poslední známý název uložené firmy", async () => {
  const panel = await mount(UploadCompanySelector, { authState: { state: "signed-in" } }, {
    getUploadCompanyDefault: async () => ({ companyId: A, companyName: "Alfa" }),
    listUploadCompanies: async () => { throw new TypeError("fetch failed"); },
  });
  expect(panel.document.body.textContent).toContain("Uložená výchozí firma: Alfa");
  expect(panel.document.body.textContent).toContain("Zkontroluj síť");
});

it("dočasné ověřování účtu během načítání neskončí návratem na tiché idle", async () => {
  let resolve;
  const authState = { state: "signed-in", issuer: "https://app.ludone.cz", identity: { email: "a@test.cz" } };
  const panel = await mount(UploadCompanySelector, { authState }, {
    getUploadCompanyDefault: async () => ({ companyId: null }),
    listUploadCompanies: () => new Promise((done) => { resolve = done; }),
  });
  await React.act(async () => panel.document.querySelector("button").click());
  await panel.render({ authState: { state: "unknown", issuer: authState.issuer } });
  await panel.render({ authState });
  await React.act(async () => resolve(offer));
  expect(panel.document.querySelector('[data-testid="upload-company-select"], [role="alert"]')).not.toBeNull();
});

it("po změně přihlášení ponechá viditelnou volbu a neoznačí ji za editaci", async () => {
  let changed;
  const onChange = vi.fn();
  const panel = await mount(RecordingUploadPreferences,
    { initialValue: { companyId: A, companyName: "Alfa", visibility: "private" }, onChange },
    { listUploadCompanies: async () => offer, onAuthSessionChanged: (callback) => { changed = callback; return () => {}; } });
  onChange.mockClear();
  await React.act(async () => changed());
  const select = panel.document.querySelector('[data-testid="recording-upload-company"]');
  expect(select.value).toBe(A);
  expect(select.selectedOptions[0].textContent).toContain("Alfa");
  expect(panel.document.body.textContent).toMatch(/nelze ověřit|nejde ověřit/u);
  expect(onChange.mock.calls.some(([, dirty]) => dirty)).toBe(false);
});

it("selhání nové nabídky zachová uživatelem zvolenou firmu", async () => {
  const list = vi.fn().mockResolvedValueOnce(offer).mockRejectedValueOnce(new TypeError("fetch failed"));
  const onChange = vi.fn();
  const panel = await mount(RecordingUploadPreferences, { onChange }, { listUploadCompanies: list });
  const select = panel.document.querySelector('[data-testid="recording-upload-company"]');
  await React.act(async () => { select.value = B; select.dispatchEvent(new panel.document.defaultView.Event("change", { bubbles: true })); });
  onChange.mockClear();
  await panel.render({ onChange, refreshToken: 1 });
  expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(B);
  expect(panel.document.body.textContent).toContain("Beta");
  expect(panel.document.body.textContent).toMatch(/nelze ověřit|nejde ověřit/u);
  expect(onChange.mock.calls.some(([, dirty]) => dirty)).toBe(false);
});

it("nová nahrávka při nedostupné nabídce ukáže lokálně uloženou firmu a upozornění", async () => {
  const onChange = vi.fn();
  const panel = await mount(RecordingUploadPreferences, { onChange }, {
    getUploadCompanyDefault: async () => ({ companyId: A, companyName: "Alfa" }),
    listUploadCompanies: async () => { throw new TypeError("fetch failed"); },
  });
  const select = panel.document.querySelector('[data-testid="recording-upload-company"]');
  expect(select.value).toBe(A);
  expect(select.selectedOptions[0].textContent).toBe("Alfa");
  expect(panel.document.body.textContent).toMatch(/nelze ověřit|nejde ověřit/u);
  expect(onChange.mock.calls.every(([value]) => value === null)).toBe(true);
});

it("pokud firma v nové nabídce chybí, zachová název a umožní vybrat oprávněnou firmu", async () => {
  const onChange = vi.fn();
  const panel = await mount(RecordingUploadPreferences,
    { initialValue: { companyId: A, companyName: "Alfa", visibility: "private" }, onChange, onSave: vi.fn() },
    { listUploadCompanies: async () => ({ ...offer, companies: [{ id: B, name: "Beta" }], selectedCompanyId: B }) });
  const select = panel.document.querySelector('[data-testid="recording-upload-company"]');
  expect(select.value).toBe(A);
  expect(select.selectedOptions[0].textContent).toBe("Alfa");
  expect(panel.document.querySelector('[data-testid="recording-upload-preferences-save"]').disabled).toBe(true);
  await React.act(async () => { select.value = B; select.dispatchEvent(new panel.document.defaultView.Event("change", { bubbles: true })); });
  expect(onChange).toHaveBeenLastCalledWith({ companyId: B, offerToken: offer.offerToken, visibility: "private" }, true);
  expect(panel.document.querySelector('[data-testid="recording-upload-preferences-save"]').disabled).toBe(false);
});

it("obnovená nabídka nepřepíše rozpracovanou uživatelskou volbu", async () => {
  const onChange = vi.fn();
  const panel = await mount(RecordingUploadPreferences,
    { initialValue: { companyId: A, companyName: "Alfa", visibility: "private" }, onChange },
    { listUploadCompanies: async () => offer });
  const select = panel.document.querySelector('[data-testid="recording-upload-company"]');
  await React.act(async () => { select.value = B; select.dispatchEvent(new panel.document.defaultView.Event("change", { bubbles: true })); });
  onChange.mockClear();
  await panel.render({ initialValue: { companyId: A, companyName: "Alfa", visibility: "private" }, onChange, refreshToken: 1 });
  expect(panel.document.querySelector('[data-testid="recording-upload-company"]').value).toBe(B);
  expect(onChange.mock.calls.some(([, dirty]) => dirty === true)).toBe(false);
});

it("navrácení původní volby zruší příznak skutečné uživatelské změny", async () => {
  const onUserChange = vi.fn();
  const panel = await mount(RecordingUploadPreferences,
    { initialValue: { companyId: A, companyName: "Alfa", visibility: "private" }, onUserChange },
    { listUploadCompanies: async () => offer });
  const select = panel.document.querySelector('[data-testid="recording-upload-visibility"]');
  await React.act(async () => { select.value = "company"; select.dispatchEvent(new panel.document.defaultView.Event("change", { bubbles: true })); });
  await React.act(async () => { select.value = "private"; select.dispatchEvent(new panel.document.defaultView.Event("change", { bubbles: true })); });
  expect(onUserChange.mock.calls).toEqual([[true], [false]]);
});
