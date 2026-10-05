import { mkdtempSync, realpathSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { afterEach, expect, it } from "vitest";
const { isOsaAuthFixture } = createRequire(import.meta.url)("../scripts/osa-auth-fixture-guard.cjs");
const roots = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
function fixture() {
  const parent = realpathSync(mkdtempSync(path.join(os.tmpdir(), "ludone-osa-auth-e2e-")));
  roots.push(parent);
  const root = path.join(parent, "isolated-data"); mkdirSync(root);
  writeFileSync(path.join(root, ".public-synthetic-identity"), "OSA_PUBLIC_FIXTURE_V1\n");
  return { isPackaged: false, env: { LUDONE_E2E: "1", LUDONE_DESIGN_E2E: "1", LUDONE_OSA_AUTH_E2E: "1", LUDONE_DATA_DIR: root } };
}
it("přijme pouze veřejnou fixturu v canonical temp profilu", () => expect(isOsaAuthFixture(fixture())).toBe(true));
it.each(["LUDONE_E2E", "LUDONE_DESIGN_E2E", "LUDONE_OSA_AUTH_E2E"])("bez %s zůstává uzavřená", flag => {
  const x = fixture(); delete x.env[flag]; expect(isOsaAuthFixture(x)).toBe(false);
});
it("zabalený nebo neznámý runtime neotevře fixturu", () => {
  const x = fixture(); expect(isOsaAuthFixture({ ...x, isPackaged: true })).toBe(false);
  expect(isOsaAuthFixture({ ...x, isPackaged: undefined })).toBe(false);
});
it("chybějící nebo cizí marker neplatí", () => {
  const x = fixture(); const marker = path.join(x.env.LUDONE_DATA_DIR, ".public-synthetic-identity");
  writeFileSync(marker, "wrong"); expect(isOsaAuthFixture(x)).toBe(false);
  rmSync(marker); expect(isOsaAuthFixture(x)).toBe(false);
});
it("běžný profil, relativní cesta i symlink zůstávají zavřené", () => {
  const x = fixture(); expect(isOsaAuthFixture({ ...x, env: { ...x.env, LUDONE_DATA_DIR: "isolated-data" } })).toBe(false);
  const link = path.join(path.dirname(x.env.LUDONE_DATA_DIR), "profile-link"); symlinkSync(x.env.LUDONE_DATA_DIR, link);
  expect(isOsaAuthFixture({ ...x, env: { ...x.env, LUDONE_DATA_DIR: link } })).toBe(false);
  expect(isOsaAuthFixture({ ...x, env: { ...x.env, LUDONE_DATA_DIR: process.cwd() } })).toBe(false);
});
