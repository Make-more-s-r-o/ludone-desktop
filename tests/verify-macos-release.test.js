import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectedReleaseFileNames } from "../scripts/release-artifacts.mjs";
import { verifyMacRelease } from "../scripts/verify-macos-release.mjs";

const require = createRequire(import.meta.url);
const packageManifest = require("../package.json");
const temporaryRoots = new Set();

afterEach(async () => {
  await Promise.all([...temporaryRoots].map((root) => rm(root, { recursive: true, force: true })));
  temporaryRoots.clear();
});

function sha512(content) {
  return createHash("sha512").update(content).digest("base64");
}

async function releaseFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "ludone-verify-macos-"));
  temporaryRoots.add(root);
  const expected = expectedReleaseFileNames();
  const entries = [];
  for (const name of expected.packages) {
    const content = Buffer.from(`balíček:${name}`);
    await writeFile(path.join(root, name), content);
    entries.push({ content, name });
  }
  for (const name of expected.blockmaps) await writeFile(path.join(root, name), `blockmap:${name}`);
  const primary = entries.find(({ name }) => name.endsWith("-x64.zip"));
  await writeFile(path.join(root, expected.metadata), [
    `version: ${packageManifest.version}`,
    "files:",
    ...entries.flatMap(({ content, name }) => [
      `  - url: ${name}`,
      `    sha512: ${sha512(content)}`,
      `    size: ${content.length}`,
    ]),
    `path: ${primary.name}`,
    `sha512: ${sha512(primary.content)}`,
    "releaseDate: '2026-09-14T12:00:00.000Z'",
    "",
  ].join("\n"));
  return root;
}

function successfulCommandRunner() {
  const calls = [];
  const lipoResults = ["arm64", "x86_64", "arm64", "x86_64"];
  const run = vi.fn((command, arguments_) => {
    calls.push({ arguments_, command });
    if (command === "plutil") {
      const key = arguments_[1];
      if (key === "CFBundleIdentifier") return packageManifest.build.appId;
      if (key === "CFBundleShortVersionString") return packageManifest.version;
      if (key === "CFBundleExecutable") return packageManifest.build.productName;
    }
    if (command === "lipo") return lipoResults.shift();
    if (command === "codesign" && arguments_[0] === "--display") {
      return "Authority=Developer ID Application: Make more s.r.o.\nTeamIdentifier=ABCDE12345";
    }
    return "";
  });
  const verifyEncoder = vi.fn(async (...arguments_) => arguments_.length);
  return { calls, run, verifyEncoder };
}

describe("ověření podepsaného macOS releasu", () => {
  it("mapuje x64 na Mach-O x86_64 a ověří aplikace uvnitř read-only DMG i ZIP", async () => {
    const root = await releaseFixture();
    const { calls, run, verifyEncoder } = successfulCommandRunner();

    await verifyMacRelease(root, { platform: "darwin", run, verifyEncoder });

    const attaches = calls.filter(({ command, arguments_ }) => command === "hdiutil" && arguments_[0] === "attach");
    expect(attaches).toHaveLength(2);
    for (const { arguments_ } of attaches) expect(arguments_).toEqual(expect.arrayContaining(["-readonly", "-nobrowse"]));
    expect(calls.filter(({ command, arguments_ }) => command === "hdiutil" && arguments_[0] === "detach")).toHaveLength(2);
    expect(calls.filter(({ command }) => command === "lipo").map(({ arguments_ }) => arguments_.at(-1))).toHaveLength(4);
    const stapledTargets = calls
      .filter(({ command, arguments_ }) => command === "xcrun" && arguments_[0] === "stapler")
      .map(({ arguments_ }) => arguments_.at(-1));
    expect(stapledTargets).toHaveLength(4);
    expect(stapledTargets.every((target) => target.endsWith("LuDone Desktop.app"))).toBe(true);
    expect(verifyEncoder).toHaveBeenCalledTimes(4);
    expect(verifyEncoder.mock.calls.map(([, arch]) => arch)).toEqual(["arm64", "x64", "arm64", "x64"]);
  });

  it("odpojí DMG a uklidí mount i při selhání kontroly aplikace", async () => {
    const root = await releaseFixture();
    const { calls, run: baseRun, verifyEncoder } = successfulCommandRunner();
    const run = vi.fn((command, arguments_) => {
      if (command === "codesign" && arguments_[0] === "--verify") throw new Error("vadný podpis");
      return baseRun(command, arguments_);
    });
    const removed = [];
    const remove = vi.fn(async (target, options) => {
      removed.push(target);
      await rm(target, options);
    });

    await expect(verifyMacRelease(root, {
      platform: "darwin", remove, run, verifyEncoder,
    })).rejects.toThrow("vadný podpis");

    expect(calls.some(({ command, arguments_ }) => command === "hdiutil" && arguments_[0] === "detach")).toBe(true);
    expect(removed.some((target) => target.includes("ludone-release-dmg-"))).toBe(true);
  });
});
