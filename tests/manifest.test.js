import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageManifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

describe("manifest automatických bran", () => {
  it("obsahuje samostatné příkazy pro lint, typecheck a unit testy", () => {
    expect(packageManifest.scripts).toMatchObject({
      lint: "eslint .",
      typecheck: "tsc --noEmit -p jsconfig.json",
      "test:unit": "vitest run",
    });
  });

  it("spouští gates v závazném pořadí", () => {
    expect(packageManifest.scripts.gates).toBe(
      "npm run lint && npm run typecheck && npm run test:unit",
    );
  });
});
