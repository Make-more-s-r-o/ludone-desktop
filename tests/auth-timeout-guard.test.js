import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  DEFAULT_TIMEOUT_MS,
  resolveAuthTimeout,
} = require("../electron/auth.cjs");

const SERVER_PENDING_TTL_MS = 10 * 60 * 1000;

describe("časový limit desktopového přihlášení", () => {
  it("je delší než desetiminutová životnost žádosti na serveru", () => {
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(SERVER_PENDING_TTL_MS);
  });

  it("při chybějící volitelné hodnotě bezpečně použije delší výchozí limit", () => {
    expect(resolveAuthTimeout()).toBe(DEFAULT_TIMEOUT_MS);
    expect(resolveAuthTimeout()).toBeGreaterThan(SERVER_PENDING_TTL_MS);
  });
});
