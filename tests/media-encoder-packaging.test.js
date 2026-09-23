import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
    expect(lock.opus).toMatchObject({
      version: "1.6.1",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(lock.ffmpeg.url).toMatch(/^https:\/\/ffmpeg\.org\//);
    expect(lock.opus.url).toMatch(/^https:\/\/downloads\.xiph\.org\/releases\/opus\//);
    const args = ffmpegConfigureArguments({
      arch: "arm64",
      deploymentTarget: "12.0",
      opusPrefix: "../opus-prefix",
    });
    expect(args).toEqual(expect.arrayContaining([
      "--disable-autodetect",
      "--disable-everything",
      "--disable-asm",
      "--enable-libopus",
      "--enable-decoder=opus",
      "--enable-encoder=libopus",
      "--enable-demuxer=matroska",
      "--enable-muxer=webm",
    ]));
    expect(args).not.toEqual(expect.arrayContaining([
      "--enable-gpl", "--enable-nonfree", "--enable-version3", "--enable-libmp3lame",
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
    const bytes = syntheticMachO();
    await writeFile(executable, bytes);
    await chmod(executable, 0o700);
    await writeFile(path.join(resources, "BUILD.json"), JSON.stringify({
      arch: "arm64",
      ffmpeg: { version: lock.ffmpeg.version, sha256: lock.ffmpeg.sha256 },
      opus: { version: lock.opus.version, sha256: lock.opus.sha256 },
      binarySha256: "0".repeat(64),
      machOCanonicalSha256: "0".repeat(64),
      configureArguments: [],
    }));
    const run = vi.fn((command) => command === "lipo" ? "arm64" : "");
    await expect(verifyBundledEncoder(root, "arm64", "ABCDE12345", run))
      .rejects.toThrow("Kanonický Mach-O SHA-256");
  });

  it("kanonický hash ignoruje jen podpis a tři velikosti Mach-O", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ludone-encoder-signature-"));
    temporaryRoots.add(root);
    const executable = path.join(root, "fixture");
    const original = syntheticMachO();
    await writeFile(executable, original);
    const originalCanonical = await machOCanonicalSha256(executable);
    const resigned = Buffer.from(original);
    resigned.writeBigUInt64LE(96n, 32 + 32);
    resigned.writeBigUInt64LE(88n, 32 + 48);
    resigned.writeUInt32LE(40, 104 + 12);
    resigned.fill(0x5a, 160);
    await writeFile(executable, resigned);
    expect(await machOCanonicalSha256(executable)).toBe(originalCanonical);
    resigned[145] ^= 0xff;
    await writeFile(executable, resigned);
    expect(await machOCanonicalSha256(executable)).not.toBe(originalCanonical);
  });
});

function syntheticMachO() {
  const bytes = Buffer.alloc(200, 0x3c);
  bytes.writeUInt32LE(0xfeedfacf, 0);
  bytes.writeUInt32LE(2, 16);
  bytes.writeUInt32LE(88, 20);
  bytes.writeUInt32LE(0x19, 32);
  bytes.writeUInt32LE(72, 36);
  bytes.write("__LINKEDIT", 40, "ascii");
  bytes.fill(0, 50, 56);
  bytes.writeUInt32LE(0x1d, 104);
  bytes.writeUInt32LE(16, 108);
  bytes.writeUInt32LE(160, 112);
  bytes.writeUInt32LE(40, 116);
  return bytes;
}
