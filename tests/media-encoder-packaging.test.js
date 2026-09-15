import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ffmpegConfigureArguments,
  machOCanonicalSha256,
  parseArguments,
} from "../scripts/prepare-media-encoder.mjs";
import { verifyBundledEncoder } from "../scripts/verify-macos-release.mjs";

const require = createRequire(import.meta.url);
const lock = require("../scripts/media-encoder-lock.json");
const temporaryRoots = new Set();

afterEach(async () => {
  await Promise.all([...temporaryRoots].map((root) => rm(root, { recursive: true, force: true })));
  temporaryRoots.clear();
});

describe("příprava a kontrola media encoderu", () => {
  it("má připnuté HTTPS zdroje a minimální LGPL konfiguraci bez autodetekce", () => {
    expect(lock.ffmpeg).toMatchObject({
      version: "6.1.6",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(lock.lame).toMatchObject({
      version: "3.100",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(lock.ffmpeg.url).toMatch(/^https:\/\/ffmpeg\.org\//);
    expect(lock.lame.url).toMatch(/^https:\/\/downloads\.sourceforge\.net\//);
    const args = ffmpegConfigureArguments({
      arch: "arm64",
      deploymentTarget: "12.0",
      lamePrefix: "../lame-prefix",
    });
    expect(args).toEqual(expect.arrayContaining([
      "--disable-autodetect",
      "--disable-everything",
      "--disable-asm",
      "--enable-libmp3lame",
      "--enable-decoder=opus",
      "--enable-encoder=libmp3lame",
      "--enable-demuxer=matroska",
      "--enable-muxer=mp3",
    ]));
    expect(args).not.toEqual(expect.arrayContaining([
      "--enable-gpl", "--enable-nonfree", "--enable-version3", "--enable-libopus",
    ]));
    expect(args.join(" ")).not.toContain(process.cwd());
  });

  it("check režim je výslovný a nelze jej spojit s přepisem", () => {
    expect(parseArguments(["--check", "--arch", "x64"])).toEqual({
      architectures: ["x64"], check: true, force: false,
    });
    expect(() => parseArguments(["--check", "--force"])).toThrow("nelze kombinovat");
  });

  it("release verifier odmítne binárku s jiným hashem než BUILD.json", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ludone-encoder-package-"));
    temporaryRoots.add(root);
    const resources = path.join(root, "Contents", "Resources", "media-encoder");
    await mkdir(resources, { recursive: true });
    const executable = path.join(resources, "ffmpeg");
    await cp(process.execPath, executable);
    await chmod(executable, 0o700);
    await writeFile(path.join(resources, "BUILD.json"), JSON.stringify({
      arch: "arm64",
      ffmpeg: { version: lock.ffmpeg.version, sha256: lock.ffmpeg.sha256 },
      lame: { version: lock.lame.version, sha256: lock.lame.sha256 },
      binarySha256: "0".repeat(64),
      machOCanonicalSha256: "0".repeat(64),
      configureArguments: [],
    }));
    const run = vi.fn((command) => command === "lipo" ? "arm64" : "");
    await expect(verifyBundledEncoder(root, "arm64", "ABCDE12345", run))
      .rejects.toThrow("Kanonický Mach-O SHA-256");
  }, 30_000);

  it("kanonický hash zůstane stejný po skutečném ad-hoc codesign", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ludone-encoder-signature-"));
    temporaryRoots.add(root);
    const executable = path.join(root, "signed-copy");
    await cp(process.execPath, executable);
    await chmod(executable, 0o700);
    const originalBytes = createHash("sha256").update(await readFile(executable)).digest("hex");
    const originalCanonical = await machOCanonicalSha256(executable);
    const signed = spawnSync("codesign", [
      "--force", "--sign", "-", "--timestamp=none", "--options", "runtime",
      "--identifier", "cz.ludone.desktop.media-encoder.test-with-longer-identifier",
      executable,
    ], {
      encoding: "utf8",
      env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin" },
    });
    expect(signed.status, signed.stderr).toBe(0);
    const signedBytes = createHash("sha256").update(await readFile(executable)).digest("hex");
    expect(signedBytes).not.toBe(originalBytes);
    expect(await machOCanonicalSha256(executable)).toBe(originalCanonical);
  }, 30_000);
});
