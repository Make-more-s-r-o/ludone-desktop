import { mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
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
const FILE_PREFIX = "LuDone-2026-09-02T12-00-00-100Z-";
const FILE_SUFFIX = `-${CLIENT_RECORDING_ID}.webm`;
// Rezerva pro osmibajtový dodatek při vytvoření kopie ve Finderu.
const NAME_BYTE_BUDGET = 255 - Buffer.byteLength(FILE_PREFIX + FILE_SUFFIX, "utf8") - 8;

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

function microphoneOnlyManifest() {
  const manifest = completeManifest();
  delete manifest.tracks.system;
  return manifest;
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
    openUploadPage: true,
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

describe("deklarace zdrojů z manifestu v nahrávací URL", () => {
  const metadata = {
    clientRecordingId: CLIENT_RECORDING_ID,
    startedAt: MICROPHONE_STARTED_AT,
    endedAt: SYSTEM_ENDED_AT,
    nazev: "Porada provozu + vývoj",
  };
  const originalUrl = "https://app.ludone.cz/nahravky/nahrat"
    + `?clientRecordingId=${CLIENT_RECORDING_ID}`
    + "&startedAt=2026-09-02T12%3A00%3A00.100Z"
    + "&endedAt=2026-09-02T13%3A00%3A00.158Z"
    + "&nazev=Porada+provozu+%2B+v%C3%BDvoj";

  it.each([
    ["mikrofon a systém", completeManifest(), "microphone+system", "microphone%2Bsystem"],
    ["jen mikrofon", microphoneOnlyManifest(), "microphone", "microphone"],
  ])("%s: přidá jediný parametr a zachová ostatní hodnoty i pořadí", (
    _label, manifest, expected, encoded,
  ) => {
    const href = buildRecordingUploadUrl("https://app.ludone.cz", metadata, manifest);
    expect(href).toBe(`${originalUrl}&declaredCaptureSources=${encoded}`);
    const url = new URL(href);
    expect(url.searchParams.getAll("declaredCaptureSources")).toEqual([expected]);
    url.searchParams.delete("declaredCaptureSources");
    expect(url.href).toBe(originalUrl);
    expect(Object.fromEntries(url.searchParams)).toEqual(metadata);
  });

  it.each([
    ["chybějící manifest", undefined],
    ["nedostupný manifest", null],
    ["manifest bez tracks", {}],
    ["tracks null", { tracks: null }],
    ["tracks jako pole", { tracks: ["microphone", "system"] }],
    ["tracks jako text", { tracks: "microphone+system" }],
    ["prázdné tracks", { tracks: {} }],
    ["neznámá stopa", { tracks: { camera: {} } }],
    ["mikrofon a neznámá stopa", { tracks: { microphone: {}, camera: {} } }],
    ["obě známé a neznámá stopa", { tracks: { microphone: {}, system: {}, camera: {} } }],
  ])("%s: zdroje vynechá bez prázdné hodnoty a bez změny původní URL", (
    _label, manifest,
  ) => {
    const href = buildRecordingUploadUrl("https://app.ludone.cz", metadata, manifest);
    expect(new URL(href).searchParams.has("declaredCaptureSources")).toBe(false);
    expect(href).toBe(originalUrl);
  });

  it("stopa bez mikrofonu neohlásí zdroje vůbec", () => {
    // Obě ohlašované hodnoty tvrdí mikrofon. Nahrávání bez něj dnes nezačne, ale server
    // bere `declared` jako naše slovo — tvrzení, které neumíme podložit, se neposílá ani
    // z nedosažitelné větve.
    const url = new URL(buildRecordingUploadUrl(
      "https://app.ludone.cz",
      { clientRecordingId: "b1d0f8a2-0000-4000-8000-000000000000" },
      { tracks: { system: { fileName: "s.webm" } } },
    ));
    expect(url.searchParams.has("declaredCaptureSources")).toBe(false);
  });

  it("přítomnou systémovou stopu deklaruje i při nulové velikosti", () => {
    const manifest = completeManifest();
    manifest.tracks.system.sizeBytes = 0;
    const url = new URL(buildRecordingUploadUrl("https://app.ludone.cz", metadata, manifest));
    expect(url.searchParams.get("declaredCaptureSources")).toBe("microphone+system");
  });

  it("tvrzení v metadatech nenahradí autoritativní manifest", () => {
    const href = buildRecordingUploadUrl("https://app.ludone.cz", {
      ...metadata,
      declaredCaptureSources: "microphone+system",
      channels: 2,
    });
    expect(href).toBe(originalUrl);
  });
});

describe("bajtové hranice názvu souboru", () => {
  it.each([200, 500])("%i českých znaků uloží do souboru do 255 bajtů a do URL celé", async (count) => {
    const name = "ř".repeat(count);
    const { result } = await exportFixture(name);
    expect(Buffer.byteLength(result.fileName, "utf8")).toBeLessThanOrEqual(255);
    expect(result.fileName).toBe(
      `${FILE_PREFIX}${"ř".repeat(Math.floor(NAME_BYTE_BUDGET / 2))}${FILE_SUFFIX}`,
    );
    await expect(readFile(result.filePath)).resolves.toEqual(stereoWebmBytes());
    expect(new URL(result.uploadUrl).searchParams.get("nazev")).toBe(name);
  });

  it("200 ASCII znaků zkrátí jen o nezbytný přesah bajtového rozpočtu", async () => {
    // Celých 200 + čas + GUID se do 255 B nevejde; starý strop 40 znaků je zbytečný.
    const { result } = await exportFixture("a".repeat(200));
    expect(result.fileName).toBe(`${FILE_PREFIX}${"a".repeat(NAME_BYTE_BUDGET)}${FILE_SUFFIX}`);
    expect(Buffer.byteLength(result.fileName, "utf8")).toBe(247);
    await expect(readFile(result.filePath)).resolves.toEqual(stereoWebmBytes());
  });

  it.each([
    ["český znak přesně na hraně", "ř", 0],
    ["český znak přes hranu", "ř", 1],
    ["emoji přesně na hraně", "😀", 0],
    ["emoji přes hranu", "😀", 1],
    ["ZWJ emoji přesně na hraně", "👨‍👩‍👧‍👦", 0],
    ["ZWJ emoji přes hranu", "👨‍👩‍👧‍👦", 1],
    ["kombinovaný znak přes hranu", "q\u0301", 1],
  ])("%s nerozřízne", async (_label, grapheme, overflow) => {
    const prefix = "a".repeat(NAME_BYTE_BUDGET - Buffer.byteLength(grapheme, "utf8") + overflow);
    const { result } = await exportFixture(`${prefix}${grapheme}x`);
    expect(result.fileName).toBe(`${FILE_PREFIX}${prefix}${overflow ? "" : grapheme}${FILE_SUFFIX}`);
    const bytes = Buffer.from(result.fileName, "utf8");
    expect(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).toBe(result.fileName);
    expect(result.fileName).not.toContain("\ufffd");
    expect(bytes.length).toBeLessThanOrEqual(255);
    await expect(readFile(result.filePath)).resolves.toEqual(stereoWebmBytes());
  });

  it("rozpočet uplatní až po rozšíření názvu normalizací NFKC", async () => {
    const name = "ﷺ".repeat(20);
    expect(Buffer.byteLength(name.normalize("NFKC"), "utf8")).toBeGreaterThan(255);
    const { result } = await exportFixture(name);
    expect(Buffer.byteLength(result.fileName, "utf8")).toBeLessThanOrEqual(255);
    expect(new URL(result.uploadUrl).searchParams.get("nazev")).toBe(name);
    await expect(readFile(result.filePath)).resolves.toEqual(stereoWebmBytes());
  });

  it.each(["", "   ", "../ : ", `q${"\u0301".repeat(100)}`])(
    "nepoužitelný název %j uloží pod časem a GUID",
    async (name) => {
      const { result } = await exportFixture(name);
      expect(result.fileName).toBe(`${FILE_PREFIX}${CLIENT_RECORDING_ID}.webm`);
      await expect(readFile(result.filePath)).resolves.toEqual(stereoWebmBytes());
    },
  );
});

describe("serverová hranice 500 UTF-16 jednotek po trim", () => {
  it.each(["ř".repeat(500), "😀".repeat(250), `${"👨‍👩‍👧‍👦".repeat(45)}abcde`])(
    "přesně 500 jednotek přijme bez změny včetně emoji (%#)",
    (name) => {
      expect(name.length).toBe(500);
      const url = new URL(buildRecordingUploadUrl("https://labs.ludone.cz", { nazev: `  ${name}  ` }));
      expect(url.searchParams.get("nazev")).toBe(name);
    },
  );

  it.each(["ř".repeat(501), `a${"😀".repeat(250)}`])("501 jednotek odmítne (%#)", (name) => {
    expect(name.length).toBe(501);
    expect(() => buildRecordingUploadUrl("https://labs.ludone.cz", { nazev: ` ${name} ` }))
      .toThrow(/Název je příliš dlouhý/);
  });

  it.each(["", " \t\n ", undefined])("prázdný název %j vynechá z URL", (name) => {
    const url = new URL(buildRecordingUploadUrl("https://labs.ludone.cz", { nazev: name }));
    expect(url.searchParams.has("nazev")).toBe(false);
  });
});

describe("povinné rozhodnutí o otevření stránky", () => {
  async function prepareCopy() {
    const root = await mkdtemp(path.join(tmpdir(), "ludone-export-decision-test-"));
    roots.add(root);
    const downloadsDirectory = path.join(root, "downloads");
    const stagePath = path.join(root, "schuzka-stereo.webm");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(downloadsDirectory);
    await writeFile(stagePath, stereoWebmBytes());
    return {
      downloadsDirectory,
      manifest: completeManifest(),
      openExternal: vi.fn(async () => undefined),
      origin: "https://app.ludone.cz",
      stagePath,
      stereoTiming: {
        startedAt: "2026-09-02T12:00:00.090Z",
        endedAt: "2026-09-02T13:00:00.170Z",
      },
    };
  }

  it("Jen uložit vytvoří soubor ve Stažených a prohlížeč otevře přesně nulakrát", async () => {
    const options = await prepareCopy();
    const result = await exportRecordingCopy({ ...options, openUploadPage: false });

    expect(path.dirname(result.filePath)).toBe(options.downloadsDirectory);
    await expect(readFile(result.filePath)).resolves.toEqual(stereoWebmBytes());
    await expect(readFile(options.stagePath)).resolves.toEqual(stereoWebmBytes());
    expect(options.openExternal).toHaveBeenCalledTimes(0);
  });

  it("501 jednotek odmítne před kopírováním a ponechá stereo pro opravu názvu", async () => {
    const options = await prepareCopy();
    await expect(exportRecordingCopy({
      ...options, openUploadPage: true, recordingName: "ř".repeat(501),
    })).rejects.toThrow(/Název je příliš dlouhý/);
    await expect(readdir(options.downloadsDirectory)).resolves.toEqual([]);
    await expect(readFile(options.stagePath)).resolves.toEqual(stereoWebmBytes());
    expect(options.openExternal).not.toHaveBeenCalled();
    const result = await exportRecordingCopy({
      ...options, openUploadPage: true, recordingName: "ř".repeat(500),
    });
    await expect(readFile(result.filePath)).resolves.toEqual(stereoWebmBytes());
    expect(options.openExternal).toHaveBeenCalledExactlyOnceWith(result.uploadUrl);
  });

  it("Uložit a odeslat vytvoří soubor a otevře nahrávací stránku", async () => {
    const options = await prepareCopy();
    const result = await exportRecordingCopy({ ...options, openUploadPage: true });

    expect(path.dirname(result.filePath)).toBe(options.downloadsDirectory);
    await expect(readFile(result.filePath)).resolves.toEqual(stereoWebmBytes());
    expect(options.openExternal).toHaveBeenCalledExactlyOnceWith(result.uploadUrl);
  });

  it("chybějící rozhodnutí odmítne před kopírováním a otevřením prohlížeče", async () => {
    const options = await prepareCopy();

    // Záměrně obejdeme typovou kontrolu, abychom spustili neplatné volání za běhu.
    await expect(Reflect.apply(exportRecordingCopy, undefined, [options]))
      .rejects.toThrow(/openUploadPage/);
    await expect(readdir(options.downloadsDirectory)).resolves.toEqual([]);
    expect(options.openExternal).toHaveBeenCalledTimes(0);
  });
});

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

  it("dlouhé pojmenování využije bajtový rozpočet a soubor pořád uloží", async () => {
    const { result } = await exportFixture("P".repeat(300));

    expect(result.fileName).toBe(
      `${FILE_PREFIX}${"P".repeat(NAME_BYTE_BUDGET)}${FILE_SUFFIX}`,
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

  it("u jednostopy nepředstírá porovnání s neexistující systémovou stopou", () => {
    expect(recordingTimeline(microphoneOnlyManifest(), {
      startedAt: "2026-09-02T12:00:00.090Z",
      endedAt: "2026-09-02T13:00:00.170Z",
    })).toEqual({
      startedAt: MICROPHONE_STARTED_AT,
      endedAt: MICROPHONE_ENDED_AT,
      stereoStartedAt: "2026-09-02T12:00:00.090Z",
      stereoEndedAt: "2026-09-02T13:00:00.170Z",
      trackStartDeltaMs: null,
      trackDurationDeltaMs: null,
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
      openUploadPage: true,
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
      + "&endedAt=2026-09-02T13%3A00%3A00.158Z"
      + "&declaredCaptureSources=microphone%2Bsystem",
    );
    await expect(stat(microphonePath)).resolves.toMatchObject({ size: 8 });
    await expect(stat(systemPath)).resolves.toMatchObject({ size: 6 });
  });

  it("jednostopu předá jako dvoukanálový soubor s mikrofonem vlevo a tichem vpravo", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ludone-export-microphone-only-test-"));
    roots.add(root);
    const downloadsDirectory = path.join(root, "downloads");
    const stagePath = path.join(root, "schuzka-microphone-only-stereo.webm");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(downloadsDirectory);
    await writeFile(stagePath, stereoWebmBytes());
    const openExternal = vi.fn(async () => undefined);

    const result = await exportRecordingCopy({
      openUploadPage: true,
      downloadsDirectory,
      manifest: microphoneOnlyManifest(),
      openExternal,
      origin: "https://app.ludone.cz",
      stagePath,
      stereoTiming: {
        startedAt: "2026-09-02T12:00:00.090Z",
        endedAt: "2026-09-02T13:00:00.170Z",
      },
    });

    expect(result).toMatchObject({
      format: { channels: 2, codec: "Opus", container: "WebM" },
      startedAt: MICROPHONE_STARTED_AT,
      endedAt: MICROPHONE_ENDED_AT,
      trackStartDeltaMs: null,
      trackDurationDeltaMs: null,
    });
    await expect(readFile(result.filePath)).resolves.toEqual(stereoWebmBytes());
    expect(openExternal).toHaveBeenCalledWith(
      "https://app.ludone.cz/nahravky/nahrat"
      + `?clientRecordingId=${CLIENT_RECORDING_ID}`
      + "&startedAt=2026-09-02T12%3A00%3A00.100Z"
      + "&endedAt=2026-09-02T13%3A00%3A00.120Z"
      + "&declaredCaptureSources=microphone",
    );
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
      openUploadPage: true,
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

  it("400 českých znaků předá serveru beze zkrácení", () => {
    const url = new URL(buildRecordingUploadUrl("https://app.ludone.cz", {
      clientRecordingId: CLIENT_RECORDING_ID,
      startedAt: MICROPHONE_STARTED_AT,
      endedAt: SYSTEM_ENDED_AT,
      nazev: "Ř".repeat(400),
    }));
    expect(url.searchParams.get("nazev")).toBe("Ř".repeat(400));
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

describe("odmítnutí názvu nad serverovým limitem", () => {
  function nazevZUrl(url) {
    return new URL(url).searchParams.get("nazev");
  }

  it("600 jednotek ze samých emoji odmítne bez tichého ořezu", () => {
    const nazev = "😀".repeat(300);
    expect(() => buildRecordingUploadUrl("https://labs.ludone.cz", { nazev }))
      .toThrow(/Název je příliš dlouhý/);
  });

  it("přijatý název nikdy nerozpůlí znak — nevznikne osamocený surrogate", () => {
    // Lichý prefix odhalí starý ořez na 200 jednotek i případný řez uprostřed páru.
    const nazev = `a${"😀".repeat(249)}`;
    const odeslany = nazevZUrl(
      buildRecordingUploadUrl("https://labs.ludone.cz", { nazev }),
    );
    expect(odeslany).toBe(nazev);
    expect([...odeslany].every((znak) => znak.codePointAt(0) !== 0xfffd)).toBe(true);
    expect([...odeslany].join("")).toBe(odeslany);
    for (const znak of odeslany) {
      const kod = znak.codePointAt(0);
      expect(kod >= 0xd800 && kod <= 0xdfff, "osamocený surrogate").toBe(false);
    }
  });

  it("dlouhý běžný text projde celý", () => {
    const odeslany = nazevZUrl(
      buildRecordingUploadUrl("https://labs.ludone.cz", { nazev: "a".repeat(300) }),
    );
    expect(odeslany).toBe("a".repeat(300));
  });

  it("krátký název s diakritikou projde beze změny", () => {
    const nazev = "Porada provozu — příští čtvrtek";
    expect(
      nazevZUrl(buildRecordingUploadUrl("https://labs.ludone.cz", { nazev })),
    ).toBe(nazev);
  });
});
