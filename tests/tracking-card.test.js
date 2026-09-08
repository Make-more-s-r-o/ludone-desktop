import * as React from "react";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { TrackingCard } from "../src/features/tracking/TrackingCard.jsx";

const RENDERER_STYLES = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const mountedRoots = [];

async function renderTrackingCard(compact) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-08T09:00:00Z"));
  const dom = new JSDOM('<div id="root"></div>', { url: "https://ludone.test" });
  const style = dom.window.document.createElement("style");
  style.textContent = RENDERER_STYLES;
  dom.window.document.head.append(style);
  const bridge = {
    startTracking: vi.fn(),
    stopTracking: vi.fn(),
    switchTrackingProject: vi.fn(),
  };
  Object.defineProperty(dom.window, "ludone", { value: bridge });
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("Node", dom.window.Node);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(dom.window.document.querySelector("#root"));
  mountedRoots.push({ dom, root });
  const onActivityChange = vi.fn();
  const render = async (props = {}) => React.act(async () => {
    root.render(React.createElement(TrackingCard, { compact, onActivityChange, ...props }));
  });
  await render();
  return {
    bridge,
    document: dom.window.document,
    onActivityChange,
    render,
    view: dom.window,
    async click(label) {
      const button = [...dom.window.document.querySelectorAll(`button[aria-label="${label}"]`)]
        .find((element) => !element.closest("[hidden]"));
      expect(button, `Chybí viditelné tlačítko ${label}`).toBeTruthy();
      await React.act(async () => button.click());
    },
  };
}

function expectVisibleWarning(panel) {
  const warning = panel.document.querySelector('[role="note"]');
  expect(warning?.textContent).toMatch(/uložení do LuTracku je (zatím )?ukázkové\./i);
  expect(warning?.textContent).toContain("Ukládání není zapojené.");
  expect(warning?.textContent).toContain("Odměřený čas se nikam neuloží.");
  expect(warning.closest('[hidden], [aria-hidden="true"], .sr-only')).toBeNull();
  // Kontrolujeme i rodiče: samotná přítomnost textu v DOM nestačí.
  for (let element = warning; element; element = element.parentElement) {
    const style = panel.view.getComputedStyle(element);
    expect(style.display).not.toBe("none");
    expect(style.visibility).toBe("visible");
    expect(style.opacity).not.toBe("0");
  }
  const action = [...panel.document.querySelectorAll("button")]
    .find((element) => !element.closest("[hidden]"));
  expect(action.getAttribute("aria-describedby")).toBe(warning.id);
}

function expectNoTrackingIpc(panel) {
  for (const method of Object.values(panel.bridge)) expect(method).not.toHaveBeenCalled();
}

afterEach(async () => {
  while (mountedRoots.length > 0) {
    const { dom, root } = mountedRoots.pop();
    await React.act(async () => root.unmount());
    dom.window.close();
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe.each([false, true])("LuTrack jako ukázka (compact=%s)", (compact) => {
  it("hned po vykreslení bez interakce viditelně říká, že se čas nikam neuloží", async () => {
    const panel = await renderTrackingCard(compact);

    expectVisibleWarning(panel);
    expect(panel.document.querySelector('[aria-label="Spustit LuTrack"]').title)
      .toBe("Spustit ukázku časovače");
    expect(panel.document.querySelector('[data-activity-state="idle"]')).not.toBeNull();
    expectNoTrackingIpc(panel);
  });

  it("upozornění zůstane viditelné po spuštění i během odměřování času", async () => {
    const panel = await renderTrackingCard(compact);
    await panel.click("Spustit LuTrack");

    expectVisibleWarning(panel);
    expect(panel.document.querySelector('[data-activity-state="tracking"]')).not.toBeNull();
    await React.act(async () => {
      vi.setSystemTime(new Date("2026-09-08T12:00:00Z"));
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(panel.document.querySelector(compact ? ".tracking-compact__time" : ".tracking-time").textContent)
      .toBe(compact ? "3h 0m" : "03:00:00");
    expectVisibleWarning(panel);
    expectNoTrackingIpc(panel);
  });

  it("po zastavení zachová informaci o neukládání a znovu ji ukáže i po dalším startu", async () => {
    const panel = await renderTrackingCard(compact);
    await panel.click("Spustit LuTrack");
    await panel.click("Zastavit LuTrack");

    expect(panel.document.querySelector('[data-activity-state="idle"]')).not.toBeNull();
    const warning = panel.document.querySelector('[role="note"]');
    expect(warning.textContent).toContain("Čas zastaven · uložení do LuTracku je ukázkové.");
    expectVisibleWarning(panel);

    await panel.click("Spustit LuTrack");
    expectVisibleWarning(panel);
    expectNoTrackingIpc(panel);
  });

  it("nenabízí skutečné ani smyšlené projekty a nehlásí projekt do okolí", async () => {
    const panel = await renderTrackingCard(compact);
    const expectUnavailableProjects = () => {
      const select = panel.document.querySelector("select");
      expect(select.disabled).toBe(true);
      expect(select.value).toBe("");
      expect([...select.options].map((option) => option.value)).toEqual([""]);
      expect(select.textContent).toBe("Projekty nejsou zapojené");
      expect(panel.document.querySelector('[aria-label="Přepnout projekt"]')).toBeNull();
      expect(panel.onActivityChange.mock.lastCall[0]).toMatchObject({ project: null, description: "" });
    };
    expectUnavailableProjects();
    await panel.click("Spustit LuTrack");
    expectUnavailableProjects();
    await panel.click("Zastavit LuTrack");
    expectUnavailableProjects();
    expectNoTrackingIpc(panel);
  });

  it("upozornění zachová také při startu a stopu z kontextového menu", async () => {
    const panel = await renderTrackingCard(compact);
    await panel.render({ trayCommand: { id: 1, name: "start-tracking" } });

    expect(panel.document.querySelector('[data-activity-state="tracking"]')).not.toBeNull();
    expectVisibleWarning(panel);

    await panel.render({ trayCommand: { id: 2, name: "stop-tracking" } });
    expect(panel.document.querySelector('[data-activity-state="idle"]')).not.toBeNull();
    expectVisibleWarning(panel);
    expectNoTrackingIpc(panel);
  });
});
