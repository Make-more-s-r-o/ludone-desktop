import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  conversionArguments,
  prepareStereoWebm,
  resolveMediaEncoderPath,
} = require("../electron/media-encoder.cjs");
const temporaryRoots = new Set();

afterEach(async () => {
  await Promise.all([...temporaryRoots].map((root) => rm(root, { recursive: true, force: true })));
  temporaryRoots.clear();
});

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "ludone-media-encoder-"));
  temporaryRoots.add(root);
  const input = path.join(root, "private-meeting.webm");
  const output = path.join(root, "meeting.webm");
  const capture = path.join(root, "args.json");
  const encoder = path.join(root, "ffmpeg-stub.cjs");
  await writeFile(input, "synteticky-vstup");
  await writeFile(encoder, `#!${process.execPath}
const { writeFileSync } = require("node:fs");
const args = process.argv.slice(2);
writeFileSync(${JSON.stringify(capture)}, JSON.stringify({ args, env: process.env }));
writeFileSync(args.at(-1), Buffer.from("synteticky-webm"));
`);
  await chmod(encoder, 0o700);
  return { capture, encoder, input, output, root };
}

describe("přibalený media encoder", () => {
  it("řeší packaged a development cestu bez PATH", () => {
    expect(resolveMediaEncoderPath({
      arch: "arm64",
      isPackaged: true,
      platform: "darwin",
      resourcesPath: "/Aplikace/LuDone.app/Contents/Resources",
    })).toBe("/Aplikace/LuDone.app/Contents/Resources/media-encoder/ffmpeg");
    expect(resolveMediaEncoderPath({
      arch: "x64",
      isPackaged: false,
      platform: "darwin",
      projectRoot: "/repo",
    })).toBe("/repo/.runtime/media-encoder/ffmpeg-6.1.6/darwin-x64/ffmpeg");
  });

  it("živé stereo přebalí beze ztrátového překódování", () => {
    const arguments_ = conversionArguments({
      stereoWebmPath: "/private/live.webm",
      temporaryPath: "/private/out.webm",
    });
    expect(arguments_).toEqual(expect.arrayContaining([
      "-nostdin", "-n", "-i", "/private/live.webm", "-c:a", "copy", "-f", "webm", "-map_metadata", "-1",
    ]));
    expect(arguments_).not.toContain("libopus");
  });

  it("fallback zarovná dvě mono stopy a spojí mikrofon vlevo a systém vpravo", () => {
    const arguments_ = conversionArguments({
      microphoneWebmPath: "/private/mic.webm",
      systemWebmPath: "/private/system.webm",
      timing: { durationMs: 12_345, microphoneDelayMs: 120, systemDelayMs: 450 },
      temporaryPath: "/private/out.webm",
    });
    const filter = arguments_[arguments_.indexOf("-filter_complex") + 1];
    expect(filter).toContain("adelay=120:all=1");
    expect(filter).toContain("adelay=450:all=1");
    expect(filter).toContain("atrim=duration=12.345");
    expect(filter).toContain("[mic][sys]join=inputs=2:channel_layout=stereo[out]");
    expect(arguments_).toEqual(expect.arrayContaining(["-c:a", "libopus", "-b:a", "96k", "-vbr", "on", "-ac", "2"]));
  });

  it("u samotného mikrofonu zapíše pravý kanál jako ticho", () => {
    const arguments_ = conversionArguments({
      microphoneWebmPath: "/private/mic.webm",
      timing: { durationMs: 1_000 },
      temporaryPath: "/private/out.webm",
    });
    expect(arguments_[arguments_.indexOf("-filter_complex") + 1]).toContain("pan=stereo|c0=c0|c1=0*c0[out]");
    expect(arguments_).toEqual(expect.arrayContaining(["-c:a", "libopus", "-b:a", "96k"]));
  });

  it("publikuje atomicky nový soubor mode 0600 a procesu nepředá rodičovské proměnné", async () => {
    const item = await fixture();
    process.env.LUDONE_PRIVATE_TOKEN_SENTINEL = "tajemstvi";
    try {
      const result = await prepareStereoWebm({
        encoderPath: item.encoder,
        outputPath: item.output,
        stereoWebmPath: item.input,
      });
      expect(await readFile(item.output, "utf8")).toBe("synteticky-webm");
      expect((await stat(item.output)).mode & 0o777).toBe(0o600);
      expect(result).toMatchObject({
        channels: 2,
        encoderVersion: "6.1.6",
        mime: "audio/webm",
        source: "live-stereo",
      });
      const capture = JSON.parse(await readFile(item.capture, "utf8"));
      expect(capture.env).toEqual(expect.objectContaining({ LANG: "C", LC_ALL: "C", TZ: "UTC" }));
      expect(capture.env.LUDONE_PRIVATE_TOKEN_SENTINEL).toBeUndefined();
      expect(capture.args.at(-1)).not.toBe(item.output);
    } finally {
      delete process.env.LUDONE_PRIVATE_TOKEN_SENTINEL;
    }
  });

  it("existující WebM nepřepíše ani nespustí encoder", async () => {
    const item = await fixture();
    await writeFile(item.output, "puvodni");
    await expect(prepareStereoWebm({
      encoderPath: item.encoder,
      outputPath: item.output,
      stereoWebmPath: item.input,
    })).rejects.toThrow("už existuje");
    expect(await readFile(item.output, "utf8")).toBe("puvodni");
    await expect(readFile(item.capture, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("ukončí zaseknutý encoder podle omezeného timeoutu", async () => {
    const item = await fixture();
    await writeFile(item.encoder, `#!${process.execPath}
process.on("SIGTERM", () => process.exit(255));
setInterval(() => {}, 10_000);
`);
    await chmod(item.encoder, 0o700);
    await expect(prepareStereoWebm({
      encoderPath: item.encoder,
      outputPath: item.output,
      stereoWebmPath: item.input,
      timeoutMs: 50,
    })).rejects.toMatchObject({ code: "MEDIA_ENCODER_TIMEOUT" });
    await expect(readFile(item.output)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
