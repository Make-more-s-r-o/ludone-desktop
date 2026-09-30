import { describe, it } from "node:test";
import assert from "node:assert/strict";
const expect = (actual) => ({ toBe: (expected) => assert.equal(actual, expected) });
import { auditExitCode, REQUIRED_PATHS } from "./desktop-product-audit.mjs";

// Sabotáže důkazu: úspěšné kliknutí bez úplného screenshotu nestačí.
const evidence = (name) => ({ name, status: "PASS", screenshot: "/fixture/a.png", screenshotBytes: 10,
  viewportScreenshots: [400, 640].map(width => ({ width, screenshot: `/fixture/${width}.png`, bytes: 10, overflows: [] })) });
const complete = () => REQUIRED_PATHS.map(evidence);
describe("produktový audit končí bezpečně", () => {
  it("přijme úplný lokální důkaz bez síťového pokusu", () => {
    expect(auditExitCode(complete(), 0)).toBe(0);
  });
  it("odmítne prázdný výsledek i chybějící výsledek", () => {
    expect(auditExitCode([], 0)).toBe(1);
    expect(auditExitCode(complete().slice(1), 0)).toBe(1);
    expect(auditExitCode(null, 0)).toBe(1);
    for (const name of ["day-dark", "day-professional", "now-dark"]) {
      assert.ok(REQUIRED_PATHS.includes(name));
      expect(auditExitCode(complete().filter(row => row.name !== name), 0)).toBe(1);
    }
  });
  it("odmítne každý síťový pokus i neznámé počítadlo", () => {
    expect(auditExitCode(complete(), 1)).toBe(1);
    expect(auditExitCode(complete(), undefined)).toBe(1);
  });
  it("odmítne selhání, chybějící a prázdné screenshoty", () => {
    for (const mutation of [{ status: "FAIL" }, { screenshot: null }, { screenshotBytes: 0 },
      { screenshotError: "capture failed" }, { viewportScreenshots: [] },
      { viewportScreenshots: [400, 640].map(width => ({ width, screenshot: "/fixture/a.png", bytes: 10, overflows: [{ selector: ".panel-scroll", scrollWidth: 700, clientWidth: 400 }] })) },
      { viewportScreenshots: [{ width: 400, screenshot: "/fixture/a.png", bytes: 10 }] }]) {
      expect(auditExitCode(complete().map((row, i) => i === 0 ? { ...row, ...mutation } : row), 0)).toBe(1);
    }
  });
});
