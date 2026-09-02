import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const renderer = vi.hoisted(() => ({
  createRoot: vi.fn(),
  render: vi.fn(),
}));

vi.mock("react-dom/client", () => ({
  createRoot: renderer.createRoot,
}));

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  renderer.createRoot.mockReset();
  renderer.render.mockReset();
});

describe("vstupní bod rendereru", () => {
  it("pro hash varovného okna vykreslí stav nedostatku místa v liště", async () => {
    const rootElement = {};
    renderer.createRoot.mockReturnValue({ render: renderer.render });
    vi.stubGlobal("React", React);
    vi.stubGlobal("window", { location: { hash: "#tray-space-warning" } });
    vi.stubGlobal("document", {
      getElementById: vi.fn(() => rootElement),
    });

    // @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
    await import("../src/main.jsx");

    expect(renderer.createRoot).toHaveBeenCalledExactlyOnceWith(rootElement);
    expect(renderer.render).toHaveBeenCalledOnce();
    const renderedView = renderer.render.mock.calls[0][0];
    expect(renderedView.type.name).toBe("TraySpaceWarning");
  });
});
