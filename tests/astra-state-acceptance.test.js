import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("stavová brána odmítá neúplné reporty a síť i pod samostatným Node runnerem", () => {
  const output = execFileSync(process.execPath, ["--test", "scripts/astra-state-e2e.test.mjs", "scripts/astra-state-e2e-bootstrap.test.cjs"], { encoding: "utf8" });
  expect(output).toContain("# pass 10");
  expect(output).toContain("# fail 0");
});
