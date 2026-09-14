import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { UploadCompanySelector } from "../src/components/UploadCompanySelector.jsx";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const mounted = [];

/**
 * @param {{ authState?: Record<string, unknown>, ludone?: Record<string, any> }} [options]
 */
async function renderSelector({ authState = { state: "signed-in", generation: 1 }, ludone } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  Object.defineProperty(dom.window, "ludone", { value: ludone ?? {
    listUploadCompanies: vi.fn(), selectUploadCompany: vi.fn(),
  } });
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("Node", dom.window.Node);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(dom.window.document.querySelector("#root"));
  await React.act(async () => root.render(React.createElement(UploadCompanySelector, { authState })));
  const result = {
    document: dom.window.document, ludone: dom.window.ludone,
    rerender: async (state) => React.act(async () => root.render(
      React.createElement(UploadCompanySelector, { authState: state }),
    )),
  };
  mounted.push({ dom, root });
  return result;
}

function button(document, text) {
  return [...document.querySelectorAll("button")].find((item) => item.textContent.includes(text));
}

afterEach(async () => {
  for (const { dom, root } of mounted.splice(0).reverse()) {
    await React.act(async () => root.unmount());
    dom.window.close();
  }
  vi.unstubAllGlobals();
});

describe("samostatný výběr firmy", () => {
  it("mount nic nenačte a klik load → select → save uloží explicitní ID", async () => {
    const ludone = {
      listUploadCompanies: vi.fn(async () => ({
        companies: [{ id: A, name: "Alfa" }, { id: B, name: "Beta" }],
        selectedCompanyId: null,
        offerToken: "offer-token-0000000000000001",
      })),
      selectUploadCompany: vi.fn(async (_token, companyId) => ({ saved: true, selectedCompanyId: companyId })),
    };
    const panel = await renderSelector({ ludone });
    expect(ludone.listUploadCompanies).not.toHaveBeenCalled();
    await React.act(async () => button(panel.document, "Načíst firmy").click());
    const select = panel.document.querySelector("select");
    expect(select.value).toBe("");
    expect(select.options[0].textContent).toBe("Vyber firmu");
    await React.act(async () => {
      select.value = B;
      select.dispatchEvent(new panel.document.defaultView.Event("change", { bubbles: true }));
    });
    await React.act(async () => button(panel.document, "Uložit firmu").click());
    expect(ludone.selectUploadCompany)
      .toHaveBeenCalledExactlyOnceWith("offer-token-0000000000000001", B);
    expect(panel.document.body.textContent).toContain("Firma je uložená");
  });

  it.each([{ state: "signed-out" }, { state: "expired" }])("nepřihlášený stav %s síť nevolá", async (authState) => {
    const panel = await renderSelector({ authState });
    expect(panel.ludone.listUploadCompanies).not.toHaveBeenCalled();
    expect(panel.ludone.selectUploadCompany).not.toHaveBeenCalled();
  });

  it("po změně auth zahodí pozdní odpověď a prázdná nabídka nic neuloží", async () => {
    let resolve;
    const ludone = {
      listUploadCompanies: vi.fn(() => new Promise((done) => { resolve = done; })),
      selectUploadCompany: vi.fn(),
    };
    const panel = await renderSelector({ ludone });
    await React.act(async () => button(panel.document, "Načíst firmy").click());
    await panel.rerender({ state: "signed-in", generation: 2 });
    await React.act(async () => resolve({
      companies: [{ id: A, name: "Alfa" }], selectedCompanyId: null,
      offerToken: "offer-token-0000000000000001",
    }));
    expect(panel.document.querySelector("select")).toBeNull();
    ludone.listUploadCompanies.mockResolvedValueOnce({
      companies: [], selectedCompanyId: null, offerToken: "offer-token-0000000000000002",
    });
    await React.act(async () => button(panel.document, "Načíst firmy").click());
    expect(panel.document.body.textContent).toContain("žádná firma");
    expect(ludone.selectUploadCompany).not.toHaveBeenCalled();
  });
});
