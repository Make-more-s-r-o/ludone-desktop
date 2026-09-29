import assert from "node:assert/strict";
import test from "node:test";
import { REQUIRED_STATE_SCENARIOS, stateAcceptanceExitCode } from "./astra-state-acceptance.mjs";

const complete = () => REQUIRED_STATE_SCENARIOS.map(name => ({ name, status: "PASS", fixtureOnly: true, screenshot: `${name}.png` }));
test("úplná izolovaná matice projde", () => assert.equal(stateAcceptanceExitCode(complete(), 0), 0));
test("prázdný nebo chybějící scénář nesmí projít", () => {
  assert.equal(stateAcceptanceExitCode([], 0), 1);
  assert.equal(stateAcceptanceExitCode(complete().slice(1), 0), 1);
});
test("duplicitní nebo cizí scénář nenahradí povinný", () => {
  const rows = complete(); rows[0] = rows[1];
  assert.equal(stateAcceptanceExitCode(rows, 0), 1);
  rows[0] = { ...rows[0], name: "unknown" };
  assert.equal(stateAcceptanceExitCode(rows, 0), 1);
});
test("FAIL a chybějící screenshot zčervenají", () => {
  const rows = complete(); rows[0].status = "FAIL";
  assert.equal(stateAcceptanceExitCode(rows, 0), 1);
  rows[0].status = "PASS"; delete rows[0].screenshot;
  assert.equal(stateAcceptanceExitCode(rows, 0), 1);
});
test("pokus o externí síť zčervená i při PASS matice", () => {
  assert.equal(stateAcceptanceExitCode(complete(), 1), 1);
  assert.equal(stateAcceptanceExitCode(complete(), undefined), 1);
});
test("scénář bez výslovné izolace nesmí projít", () => {
  const rows = complete(); rows[0].fixtureOnly = false;
  assert.equal(stateAcceptanceExitCode(rows, 0), 1);
});
