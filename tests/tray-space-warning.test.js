import { JSDOM } from "jsdom";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { TraySpaceWarning } from "../src/components/TraySpaceWarning.jsx";

describe("upozornění na ikonu, která se nevešla do lišty", () => {
  it("vykreslí samostatný přístupný stav se dvěma cestami k nápravě", () => {
    vi.stubGlobal("React", React);
    try {
      const markup = renderToStaticMarkup(React.createElement(TraySpaceWarning));
      const dom = new JSDOM(markup);
      const document = dom.window.document;
      const warning = document.querySelector('[data-testid="tray-space-warning"]');

      expect(warning).not.toBeNull();
      expect(warning.getAttribute("role")).toBe("status");
      expect(document.getElementById(warning.getAttribute("aria-labelledby")).textContent.trim())
        .not.toBe("");
      expect(warning.querySelector('[role="group"][aria-label]')).not.toBeNull();
      const solutions = [...warning.querySelectorAll("[data-solution]")];
      expect(solutions).toHaveLength(2);
      expect(solutions.every((solution) => solution.textContent.trim().length > 0)).toBe(true);
      expect(warning.querySelector("[autofocus]")).toBeNull();
      dom.window.close();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
