import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { ApplicationUpdateStatus } from "../src/components/ApplicationUpdateStatus.jsx";

const mountedRoots = [];

async function click(element, view) {
  await React.act(async () => {
    element.dispatchEvent(new view.MouseEvent("click", { bubbles: true }));
  });
}

async function renderUpdateStatus() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  const update = { revision: 1, availableVersion: "0.1.11" };
  Object.defineProperty(dom.window, "ludone", {
    value: {
      onUpdateStatusChanged: vi.fn(() => () => {}),
      getUpdateStatus: vi.fn(async () => update),
    },
  });

  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("navigator", dom.window.navigator);
  vi.stubGlobal("Node", dom.window.Node);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  const root = createRoot(dom.window.document.querySelector("#root"));
  mountedRoots.push({ dom, root });
  await React.act(async () => {
    root.render(React.createElement(ApplicationUpdateStatus));
    await Promise.resolve();
    await Promise.resolve();
  });

  return { document: dom.window.document, view: dom.window };
}

afterEach(async () => {
  while (mountedRoots.length > 0) {
    const { dom, root } = mountedRoots.pop();
    await React.act(async () => root.unmount());
    dom.window.close();
  }
  vi.unstubAllGlobals();
});

describe("zavírání rozbalené aktualizace", () => {
  it("klávesa Esc zavře detail aktualizace a vrátí focus na spouštěč", async () => {
    const panel = await renderUpdateStatus();
    const trigger = panel.document.querySelector(".application-update-detail__open");
    trigger.focus();
    await click(trigger, panel.view);
    expect(panel.document.querySelector(".application-update-detail__intro")).not.toBeNull();

    await React.act(async () => {
      panel.document.dispatchEvent(new panel.view.KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
      }));
    });

    expect(panel.document.querySelector(".application-update-detail__intro")).toBeNull();
    expect(panel.document.activeElement).toBe(
      panel.document.querySelector(".application-update-detail__open"),
    );
  });

  it("klik mimo detail aktualizace jej zavře", async () => {
    const panel = await renderUpdateStatus();
    const outside = panel.document.createElement("button");
    outside.textContent = "Mimo aktualizaci";
    panel.document.body.append(outside);

    await click(panel.document.querySelector(".application-update-detail__open"), panel.view);
    expect(panel.document.querySelector(".application-update-detail__intro")).not.toBeNull();

    await click(outside, panel.view);
    expect(panel.document.querySelector(".application-update-detail__intro")).toBeNull();
  });
});
