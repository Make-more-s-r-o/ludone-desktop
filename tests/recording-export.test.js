import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStereoCapture } from "../src/lib/stereo-recording.js";

const require = createRequire(import.meta.url);
const {
  buildRecordingUploadUrl,
  exportRecordingCopy,
  inspectOpusWebm,
  recordingTimeline,
} = require("../electron/recording-export.cjs");

const CLIENT_RECORDING_ID = "d5236f2a-94d7-42ce-b95f-77c3f973d266";
const MICROPHONE_STARTED_AT = "2026-09-02T12:00:00.100Z";
const SYSTEM_STARTED_AT = "2026-09-02T12:00:00.137Z";
const MICROPHONE_ENDED_AT = "2026-09-02T13:00:00.120Z";
const SYSTEM_ENDED_AT = "2026-09-02T13:00:00.158Z";
const roots = new Set();

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all([...roots].map((root) => rm(root, { recursive: true, force: true })));
  roots.clear();
});

function completeManifest() {
  return {
    schemaVersion: 1,
    clientRecordingId: CLIENT_RECORDING_ID,
    createdAt: "2026-09-02T12:00:00.000Z",
    closedAt: "2026-09-02T13:00:00.200Z",
    state: "complete",
    tracks: {
      microphone: {
        fileName: "schuzka-mikrofon.webm",
        startedAt: MICROPHONE_STARTED_AT,
        endedAt: MICROPHONE_ENDED_AT,
        sizeBytes: 4,
        sha256: "a".repeat(64),
      },
      system: {
        fileName: "schuzka-system.webm",
        startedAt: SYSTEM_STARTED_AT,
        endedAt: SYSTEM_ENDED_AT,
        sizeBytes: 6,
        sha256: "b".repeat(64),
      },
    },
  };
}

function stereoWebmBytes(channelCount = 2) {
  return Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
    Buffer.from("test-WebM-Opus-"),
    Buffer.from("OpusHead", "ascii"),
    Buffer.from([1, channelCount, 0, 0, 0x80, 0xbb, 0, 0, 0, 0, 0]),
    Buffer.from("audio-payload"),
  ]);
}

async function exportFixture(recordingName) {
  const root = await mkdtemp(path.join(tmpdir(), "ludone-export-name-test-"));
  roots.add(root);
  const downloadsDirectory = path.join(root, "downloads");
  const stagePath = path.join(root, "schuzka-stereo.webm");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(downloadsDirectory);
  await writeFile(stagePath, stereoWebmBytes());
  const openExternal = vi.fn(async () => undefined);
  const result = await exportRecordingCopy({
    downloadsDirectory,
    manifest: completeManifest(),
    openExternal,
    origin: "https://app.ludone.cz",
    recordingName,
    stagePath,
    stereoTiming: {
      startedAt: "2026-09-02T12:00:00.090Z",
      endedAt: "2026-09-02T13:00:00.170Z",
    },
  });
  return { downloadsDirectory, openExternal, result };
}

describe("živý stereo derivát", () => {
  it("vede mikrofon výhradně vlevo a systémový zvuk výhradně vpravo", async () => {
    const microphoneTrack = /** @type {MediaStreamTrack} */ (/** @type {unknown} */ ({
      id: "microphone",
    }));
    const systemTrack = /** @type {MediaStreamTrack} */ (/** @type {unknown} */ ({
      id: "system",
    }));
    const replacementSystemTrack = /** @type {MediaStreamTrack} */ (/** @type {unknown} */ ({
      enabled: true,
      id: "system-replacement",
      kind: "audio",
      muted: false,
      readyState: "live",
    }));
    const connections = [];
    const sources = [];
    const destinationTrack = {
      kind: "audio",
      getSettings: () => ({ channelCount: 2, sampleRate: 48_000 }),
    };
    const stereoDestination = {
      stream: { getAudioTracks: () => [destinationTrack] },
    };
    const systemDestination = {
      stream: { getAudioTracks: () => [{ kind: "audio" }] },
    };
    const merger = { connect: vi.fn(), disconnect: vi.fn() };
    const context = {
      close: vi.fn(async () => undefined),
      createChannelMerger: vi.fn(() => merger),
      createMediaStreamDestination: vi.fn()
        .mockReturnValueOnce(stereoDestination)
        .mockReturnValueOnce(systemDestination),
      createMediaStreamSource: vi.fn((stream) => {
        const source = {
          id: stream.getAudioTracks()[0].id,
          connect(target, output, input) {
            connections.push({ source: source.id, target, output, input });
          },
          disconnect: vi.fn(),
        };
        sources.push(source);
        return source;
      }),
      resume: vi.fn(async () => undefined),
      state: "suspended",
    };
    class FakeAudioContext {
      constructor() {
        return context;
      }
    }
    class FakeMediaStream {
      constructor(tracks) {
        this.tracks = tracks;
      }

      getAudioTracks() {
        return this.tracks;
      }
    }

    const capture = await createStereoCapture(microphoneTrack, systemTrack, {
      AudioContext: /** @type {any} */ (FakeAudioContext),
      MediaStream: /** @type {any} */ (FakeMediaStream),
    });

    expect(context.createChannelMerger).toHaveBeenCalledWith(2);
    expect(connections).toEqual([
      { source: "microphone", target: merger, output: 0, input: 0 },
      { source: "system", target: merger, output: 0, input: 1 },
      {
        source: "system",
        target: systemDestination,
        output: undefined,
        input: undefined,
      },
    ]);
    expect(merger.connect).toHaveBeenCalledWith(stereoDestination);
    expect(capture.stream).toBe(stereoDestination.stream);
    expect(capture.systemStream).toBe(systemDestination.stream);
    expect(capture.format).toEqual({ channels: 2, sampleRate: 48_000 });

    const stableSystemStream = capture.systemStream;
    await capture.replaceSystemTrack(replacementSystemTrack);
    expect(connections.slice(3)).toEqual([
      { source: "system-replacement", target: merger, output: 0, input: 1 },
      {
        source: "system-replacement",
        target: systemDestination,
        output: undefined,
        input: undefined,
      },
    ]);
    expect(sources.find((source) => source.id === "system")?.disconnect).toHaveBeenCalledOnce();
    expect(sources.find((source) => source.id === "microphone")?.disconnect).not.toHaveBeenCalled();
    expect(capture.systemStream).toBe(stableSystemStream);

    await capture.close();
    expect(context.close).toHaveBeenCalledTimes(1);
  });
});

describe("export dokončené schůzky", () => {
  it("pojmenování sanitizuje lomítka, dvojtečku i tečky a zůstane ve Stažených", async () => {
    const { downloadsDirectory, result } = await exportFixture(
      "../../Klient: vývoj / Q3.. 🧪",
    );

    expect(path.dirname(result.filePath)).toBe(downloadsDirectory);
    expect(result.fileName).toContain("Klient");
    expect(result.fileName).toContain("🧪");
    expect(result.fileName).not.toMatch(/[/:]/);
    expect(result.fileName).not.toContain("..");
    expect(result.fileName).toContain(CLIENT_RECORDING_ID);
    await expect(stat(result.filePath)).resolves.toMatchObject({
      size: stereoWebmBytes().length,
    });
  });

  it("prázdné pojmenování nechá původní jméno s časem a GUID", async () => {
    const { result } = await exportFixture("   ");

    expect(result.fileName).toBe(
      `LuDone-2026-09-02T12-00-00-100Z-${CLIENT_RECORDING_ID}.webm`,
    );
  });

  it("dlouhé pojmenování ořízne na 40 znaků a soubor pořád uloží", async () => {
    const { result } = await exportFixture("P".repeat(300));

    expect(result.fileName).toBe(
      `LuDone-2026-09-02T12-00-00-100Z-${"P".repeat(40)}-${CLIENT_RECORDING_ID}.webm`,
    );
    await expect(stat(result.filePath)).resolves.toMatchObject({
      size: stereoWebmBytes().length,
    });
  });

  it("pojmenování zachová složené emoji se ZWJ", async () => {
    const { result } = await exportFixture("Rodinná porada 👨‍👩‍👧‍👦");

    expect(result.fileName).toContain("Rodinná-porada-👨‍👩‍👧‍👦");
  });

  it("změří oddělené starty z manifestu a ověří jejich společný stereo obal", () => {
    expect(recordingTimeline(completeManifest(), {
      startedAt: "2026-09-02T12:00:00.090Z",
      endedAt: "2026-09-02T13:00:00.170Z",
    })).toEqual({
      startedAt: MICROPHONE_STARTED_AT,
      endedAt: SYSTEM_ENDED_AT,
      stereoStartedAt: "2026-09-02T12:00:00.090Z",
      stereoEndedAt: "2026-09-02T13:00:00.170Z",
      trackStartDeltaMs: 37,
      trackDurationDeltaMs: 1,
    });
  });

  it("odmítne stopy, které se v čase rozešly, místo tichého slepení", () => {
    const rozesle = completeManifest();
    rozesle.tracks.microphone.startedAt = "2026-09-02T12:00:02.100Z";
    expect(() => recordingTimeline(rozesle, {
      startedAt: "2026-09-02T12:00:00.090Z",
      endedAt: "2026-09-02T13:00:00.170Z",
    })).toThrow(/Rozdíl startů stop/);
  });

  it("odmítne stopy s nestejnou délkou, i když začaly společně", () => {
    const nestejne = completeManifest();
    nestejne.tracks.microphone.endedAt = "2026-09-02T13:00:02.120Z";
    expect(() => recordingTimeline(nestejne, {
      startedAt: "2026-09-02T12:00:00.090Z",
      endedAt: "2026-09-02T13:00:02.200Z",
    })).toThrow(/Rozdíl délek stop/);
  });

  it("odmítne stereo obal, který začal až po první stopě", () => {
    expect(() => recordingTimeline(completeManifest(), {
      startedAt: "2026-09-02T12:00:00.150Z",
      endedAt: "2026-09-02T13:00:00.170Z",
    })).toThrow(/nezačal spolehlivě/);
  });

  it("odmítne stereo obal, který skončil před poslední stopou", () => {
    expect(() => recordingTimeline(completeManifest(), {
      startedAt: "2026-09-02T12:00:00.090Z",
      endedAt: "2026-09-02T13:00:00.150Z",
    })).toThrow(/neskončil spolehlivě/);
  });

  it("uloží jeden WebM/Opus soubor se dvěma kanály a otevře URL se správným GUID", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ludone-export-test-"));
    roots.add(root);
    const recordingsDirectory = path.join(root, "nahravky");
    const downloadsDirectory = path.join(root, "downloads");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(recordingsDirectory);
    await mkdir(downloadsDirectory);
    const microphonePath = path.join(recordingsDirectory, "schuzka-mikrofon.webm");
    const systemPath = path.join(recordingsDirectory, "schuzka-system.webm");
    const stagePath = path.join(root, "schuzka-stereo.webm");
    await Promise.all([
      writeFile(microphonePath, "mikrofon"),
      writeFile(systemPath, "system"),
      writeFile(stagePath, stereoWebmBytes()),
    ]);
    const openExternal = vi.fn(async () => undefined);

    const result = await exportRecordingCopy({
      downloadsDirectory,
      manifest: completeManifest(),
      openExternal,
      origin: "https://app.ludone.cz",
      stagePath,
      stereoTiming: {
        startedAt: "2026-09-02T12:00:00.090Z",
        endedAt: "2026-09-02T13:00:00.170Z",
      },
    });

    const output = await readFile(result.filePath);
    expect(inspectOpusWebm(output)).toEqual({
      channels: 2,
      codec: "Opus",
      container: "WebM",
    });
    expect(path.dirname(result.filePath)).toBe(downloadsDirectory);
    expect(result.fileName).toContain(CLIENT_RECORDING_ID);
    expect(result.trackStartDeltaMs).toBe(37);
    expect(openExternal).toHaveBeenCalledWith(
      "https://app.ludone.cz/nahravky/nahrat"
      + `?clientRecordingId=${CLIENT_RECORDING_ID}`
      + "&startedAt=2026-09-02T12%3A00%3A00.100Z"
      + "&endedAt=2026-09-02T13%3A00%3A00.158Z",
    );
    await expect(stat(microphonePath)).resolves.toMatchObject({ size: 8 });
    await expect(stat(systemPath)).resolves.toMatchObject({ size: 6 });
  });

  it("při selhání otevření ponechá původní obě stopy i exportovanou kopii", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ludone-export-failure-test-"));
    roots.add(root);
    const recordingsDirectory = path.join(root, "nahravky");
    const downloadsDirectory = path.join(root, "downloads");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(recordingsDirectory);
    await mkdir(downloadsDirectory);
    const microphonePath = path.join(recordingsDirectory, "schuzka-mikrofon.webm");
    const systemPath = path.join(recordingsDirectory, "schuzka-system.webm");
    const stagePath = path.join(root, "schuzka-stereo.webm");
    await Promise.all([
      writeFile(microphonePath, "mikrofon"),
      writeFile(systemPath, "system"),
      writeFile(stagePath, stereoWebmBytes()),
    ]);

    await expect(exportRecordingCopy({
      downloadsDirectory,
      manifest: completeManifest(),
      openExternal: vi.fn(async () => {
        throw new Error("Prohlížeč se nepodařilo otevřít");
      }),
      origin: "https://app.ludone.cz",
      stagePath,
      stereoTiming: {
        startedAt: "2026-09-02T12:00:00.090Z",
        endedAt: "2026-09-02T13:00:00.170Z",
      },
    })).rejects.toMatchObject({
      message: "Prohlížeč se nepodařilo otevřít",
      recordingExported: true,
    });
    await expect(stat(microphonePath)).resolves.toMatchObject({ size: 8 });
    await expect(stat(systemPath)).resolves.toMatchObject({ size: 6 });
    await expect(stat(path.join(
      downloadsDirectory,
      `LuDone-2026-09-02T12-00-00-100Z-${CLIENT_RECORDING_ID}.webm`,
    ))).resolves.toMatchObject({ size: stereoWebmBytes().length });
  });

  it("skládá tutéž cestu i pro konfigurované labs prostředí", () => {
    expect(buildRecordingUploadUrl("https://labs.ludone.cz", {
      clientRecordingId: CLIENT_RECORDING_ID,
      startedAt: MICROPHONE_STARTED_AT,
      endedAt: SYSTEM_ENDED_AT,
    })).toBe(
      "https://labs.ludone.cz/nahravky/nahrat"
      + `?clientRecordingId=${CLIENT_RECORDING_ID}`
      + "&startedAt=2026-09-02T12%3A00%3A00.100Z"
      + "&endedAt=2026-09-02T13%3A00%3A00.158Z",
    );
  });

  it("odmítne mono staging místo tichého vydávání za stereo", () => {
    expect(() => inspectOpusWebm(stereoWebmBytes(1))).toThrow(/dva kanály/);
  });
});

describe("předávka názvu do nahrávací stránky", () => {
  it("pošle název jako čitelný text, ne jako jméno souboru", () => {
    const url = new URL(buildRecordingUploadUrl("https://app.ludone.cz", {
      clientRecordingId: CLIENT_RECORDING_ID,
      startedAt: MICROPHONE_STARTED_AT,
      endedAt: SYSTEM_ENDED_AT,
      nazev: "Porada provozu",
    }));
    // Do jména souboru jde „Porada-provozu"; do formuláře patří to, co člověk napsal.
    expect(url.searchParams.get("nazev")).toBe("Porada provozu");
    expect(url.searchParams.get("nazev")).not.toContain("-");
    expect(url.searchParams.get("nazev")).not.toMatch(/\.webm$/u);
  });

  it("bez názvu parametr vůbec nepřidá", () => {
    // Server prázdný ani chybějící parametr neřeší stejně; radši ho neposílat.
    const url = new URL(buildRecordingUploadUrl("https://app.ludone.cz", {
      clientRecordingId: CLIENT_RECORDING_ID,
      startedAt: MICROPHONE_STARTED_AT,
      endedAt: SYSTEM_ENDED_AT,
      nazev: "",
    }));
    expect(url.searchParams.has("nazev")).toBe(false);
  });

  it("dlouhý název ořízne pod serverový limit 200 znaků", () => {
    // Server názvy delší než 200 znaků zahazuje — celý, ne po částech.
    // Poslat delší tedy znamená přijít o název úplně.
    const url = new URL(buildRecordingUploadUrl("https://app.ludone.cz", {
      clientRecordingId: CLIENT_RECORDING_ID,
      startedAt: MICROPHONE_STARTED_AT,
      endedAt: SYSTEM_ENDED_AT,
      nazev: "Ř".repeat(400),
    }));
    expect([...url.searchParams.get("nazev")].length).toBeLessThanOrEqual(200);
  });

  it("export předá do URL jméno, které zadal člověk", async () => {
    const { openExternal } = await exportFixture("Porada provozu");

    expect(openExternal).toHaveBeenCalledOnce();
    const [prvniVolani] = /** @type {any[][]} */ (openExternal.mock.calls);
    const predana = new URL(String(prvniVolani[0]));
    expect(predana.searchParams.get("nazev")).toBe("Porada provozu");
    // Jméno souboru se sanitizuje kvůli disku; do formuláře patří původní text.
    expect(predana.searchParams.get("nazev")).not.toContain("-");
  });
});
