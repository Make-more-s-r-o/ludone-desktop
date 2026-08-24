import { mkdtemp, readFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  createManifest,
  manifestSha256,
  transitionManifest,
  writeManifestAtomically,
} from "../src/lib/manifest.js";

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

const STARTED_AT = "2026-08-25T08:00:00.000Z";
const ENDED_AT = "2026-08-25T08:30:00.000Z";

function manifestMetadata() {
  return {
    clientRecordingId: "9e586e55-d688-43f1-8a80-a3d61e754f3e",
    createdAt: STARTED_AT,
    closedAt: null,
    tracks: {
      microphone: {
        fileName: "session-mikrofon.webm",
        startedAt: STARTED_AT,
        endedAt: null,
        sizeBytes: 0,
        sha256: null,
      },
      system: {
        fileName: "session-system.webm",
        startedAt: STARTED_AT,
        endedAt: null,
        sizeBytes: 0,
        sha256: null,
      },
    },
  };
}

function closedTracks() {
  const metadata = manifestMetadata();
  return {
    microphone: {
      ...metadata.tracks.microphone,
      endedAt: ENDED_AT,
      sizeBytes: 120,
      sha256: "a".repeat(64),
    },
    system: {
      ...metadata.tracks.system,
      endedAt: ENDED_AT,
      sizeBytes: 240,
      sha256: "b".repeat(64),
    },
  };
}

describe("manifest nahrávacího sezení", () => {
  it("vyžaduje stav jako povinný argument bez implicitního defaultu", () => {
    expect(() => createManifest(manifestMetadata())).toThrow(/state/);
  });

  it("po simulovaném pádu před prvním chunkem manifest existuje a má stav incomplete", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-manifest-crash-"));
    const manifestPath = path.join(directory, "session.manifest.json");
    try {
      const recording = createManifest(manifestMetadata(), "recording");
      await writeManifestAtomically(
        manifestPath,
        transitionManifest(recording, "incomplete"),
      );
      // Pád je právě absence volání dokončovacího kroku.
      const onDisk = JSON.parse(await readFile(manifestPath, "utf8"));
      expect(onDisk.state).toBe("incomplete");
      expect(onDisk.closedAt).toBeNull();

      const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
      const writeIndex = mainSource.indexOf("await writeManifestAtomically(manifestPath");
      const returnIndex = mainSource.indexOf("return { sessionId, startedAt:", writeIndex);
      expect(writeIndex).toBeGreaterThan(-1);
      expect(returnIndex).toBeGreaterThan(writeIndex);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("řádně ukončené sezení přepíše manifest atomicky do stavu complete", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ludone-manifest-complete-"));
    const manifestPath = path.join(directory, "session.manifest.json");
    try {
      const recording = createManifest(manifestMetadata(), "recording");
      await writeManifestAtomically(manifestPath, transitionManifest(recording, "incomplete"));
      await writeManifestAtomically(manifestPath, transitionManifest(recording, "complete", {
        closedAt: ENDED_AT,
        tracks: closedTracks(),
      }));

      const onDisk = JSON.parse(await readFile(manifestPath, "utf8"));
      expect(onDisk).toMatchObject({ state: "complete", closedAt: ENDED_AT });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("kanonický JSON řadí klíče rekurzivně a stejný vstup má dvakrát stejný hash", () => {
    const value = { z: 3, a: { z: 1, a: 2 }, list: [{ b: 2, a: 1 }] };
    expect(canonicalJson(value)).toBe('{"a":{"a":2,"z":1},"list":[{"a":1,"b":2}],"z":3}');
    expect(manifestSha256(value)).toBe(manifestSha256(value));
  });

  it("přeházené pořadí klíčů na vstupu dává týž hash", () => {
    const first = { schemaVersion: 1, tracks: { system: { sizeBytes: 2 }, microphone: { sizeBytes: 1 } } };
    const shuffled = { tracks: { microphone: { sizeBytes: 1 }, system: { sizeBytes: 2 } }, schemaVersion: 1 };
    expect(manifestSha256(first)).toBe(manifestSha256(shuffled));
  });

  it("jiná hodnota v manifestu dává jiný hash", () => {
    const first = createManifest(manifestMetadata(), "recording");
    const changed = createManifest({ ...manifestMetadata(), clientRecordingId: "jiné-id" }, "recording");
    expect(manifestSha256(first)).not.toBe(manifestSha256(changed));
  });

  it("obsahuje právě obě stopy microphone a system", () => {
    const manifest = createManifest(manifestMetadata(), "recording");
    expect(Object.keys(manifest.tracks).sort()).toEqual(["microphone", "system"]);
    expect(manifest.tracks.microphone.fileName).toBe("session-mikrofon.webm");
    expect(manifest.tracks.system.fileName).toBe("session-system.webm");
  });

  it("povoluje jen přechody recording na complete nebo incomplete", () => {
    const recording = createManifest(manifestMetadata(), "recording");
    const incomplete = transitionManifest(recording, "incomplete");
    expect(incomplete.state).toBe("incomplete");
    expect(() => transitionManifest(incomplete, "complete", {
      closedAt: ENDED_AT,
      tracks: closedTracks(),
    })).toThrow(/jen z manifestu ve stavu recording/);
  });
});
