import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  createDiagnosticsSnapshot,
  formatDiagnosticsExport,
  writeDiagnosticsExport,
} from "../src/lib/diagnostics.js";

const createdDirectories = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "ludone-diagnostics-test-"));
  createdDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(createdDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

describe("diagnostický snapshot", () => {
  it("bere verzi, čitelnou architekturu, oprávnění a stav fronty jen z doložených dat", () => {
    const snapshot = createDiagnosticsSnapshot({
      appVersion: "9.8.7",
      architecture: "arm64",
      microphoneStatus: "granted",
      observedAt: new Date("2026-09-03T12:00:00.000Z"),
      queueItems: [
        { state: "ceka" },
        { state: "ceka" },
        { state: "odesila" },
        { state: "selhalo" },
        { state: "odeslano", sentAt: "2026-09-03T11:05:00.000Z" },
        { state: "odeslano", sentAt: "neplatny-cas" },
      ],
      systemAudioStatus: "denied",
    });

    expect(snapshot).toMatchObject({
      version: "9.8.7",
      architecture: "Apple Silicon",
      permissions: {
        microphone: { status: "granted", label: "Povoleno" },
        systemAudio: { status: "denied", label: "Nepovoleno" },
      },
      serverConnection: {
        status: "last-success",
        lastSuccessfulAt: "2026-09-03T11:05:00.000Z",
      },
      queue: { available: true, waiting: 2, sending: 1, failed: 1 },
    });
  });

  it("bez potvrzeného odeslání neprohlašuje server za dostupný", () => {
    const snapshot = createDiagnosticsSnapshot({
      appVersion: "0.1.0",
      architecture: "x64",
      microphoneStatus: "not-determined",
      queueItems: [{ state: "ceka" }],
      systemAudioStatus: "restricted",
    });

    expect(snapshot.architecture).toBe("Intel");
    expect(snapshot.serverConnection).toEqual({
      status: "unknown",
      label: "Zatím bez zaznamenaného úspěšného volání",
      lastSuccessfulAt: null,
    });
    expect(snapshot.serverConnection.label).not.toMatch(/v pořádku|připojeno/iu);
  });

  it("poškozená fronta ani budoucí či nekanonický čas nevytvoří zelený stav", () => {
    const suspiciousTimes = createDiagnosticsSnapshot({
      appVersion: "0.1.0",
      architecture: "arm64",
      microphoneStatus: "granted",
      observedAt: new Date("2026-09-03T12:00:00.000Z"),
      queueItems: [
        { state: "odeslano", sentAt: "2099-01-01T00:00:00.000Z" },
        { state: "odeslano", sentAt: "0" },
      ],
      systemAudioStatus: "granted",
    });
    const corruptQueue = createDiagnosticsSnapshot({
      appVersion: "0.1.0",
      architecture: "arm64",
      microphoneStatus: "granted",
      queueItems: [{ state: "novy-neznamy-stav" }],
      systemAudioStatus: "granted",
    });

    expect(suspiciousTimes.serverConnection.status).toBe("unknown");
    expect(corruptQueue.queue.available).toBe(false);
    expect(corruptQueue.serverConnection.status).toBe("unknown");
    expect(formatDiagnosticsExport({
      ...suspiciousTimes,
      serverConnection: {
        status: "last-success",
        lastSuccessfulAt: "2099-01-01T00:00:00.000Z",
      },
    }, new Date("2026-09-03T12:00:00.000Z"))).toContain(
      "Spojení se serverem: zatím bez zaznamenaného úspěšného volání",
    );
  });
});

describe("export diagnostiky", () => {
  it("zapíše skutečný txt jen z allowlistu bez tokenu, názvu schůzky, cesty nebo zvuku", async () => {
    const downloadsDirectory = await temporaryDirectory();
    const token = "Bearer eyJ-TAJNY-TOKEN";
    const meetingTitle = "TAJNÁ SCHŮZKA O AKVIZICI";
    const filePath = "/Users/dan/Nahravky/tajna-schuzka.webm";
    const audio = "T2dnUwACAAAAAAAAAABTENTINEL-ZVUK";
    const unsafeInputs = {
      appVersion: "9.8.7",
      architecture: "arm64",
      microphoneStatus: "granted",
      queueItems: [
        {
          state: "ceka",
          accessToken: token,
          meetingTitle,
          tracks: { microphone: filePath },
          lastFailureReason: `${token} ${meetingTitle} ${filePath}`,
          audio,
        },
        {
          state: "odeslano",
          sentAt: "2026-09-03T11:05:00.000Z",
        },
      ],
      systemAudioStatus: "denied",
      accessToken: token,
      meetingTitle,
      filePath,
      audio,
    };
    const snapshot = createDiagnosticsSnapshot(unsafeInputs);
    // I kdyby někdo do objektu pro export později přidal nové citlivé pole nebo
    // podvrhl zobrazovaný label, zapisovač smí číst jen pevný výčet primitiv.
    const contaminatedSnapshot = {
      ...snapshot,
      version: token,
      accessToken: token,
      meetingTitle,
      filePath,
      audio,
      permissions: {
        ...snapshot.permissions,
        microphone: { ...snapshot.permissions.microphone, label: token },
      },
      serverConnection: { ...snapshot.serverConnection, label: meetingTitle },
    };

    const result = await writeDiagnosticsExport({
      downloadsDirectory,
      exportedAt: new Date("2026-09-03T11:05:06.000Z"),
      snapshot: contaminatedSnapshot,
    });

    expect(result).toEqual({
      ok: true,
      fileName: "ludone-diagnostika-2026-09-03-110506.txt",
    });
    expect(Object.keys(result).sort()).toEqual(["fileName", "ok"]);
    const exportedPath = path.join(downloadsDirectory, result.fileName);
    const contents = await readFile(exportedPath, "utf8");
    expect(contents).toBe([
      "LuDone Desktop — diagnostika",
      "Verze: Neznámá",
      "Architektura: Apple Silicon",
      "Mikrofon: Povoleno",
      "Ostatní zvuk: Nepovoleno",
      "Spojení se serverem: naposledy potvrzeno 2026-09-03T11:05:00.000Z",
      "Fronta: čeká 1; odesílá se 0; selhalo 0",
      "",
      "Soubor neobsahuje zvuk, přihlašovací údaje, tokeny, názvy schůzek ani cesty k souborům.",
      "",
    ].join("\n"));
    expect(contents).not.toContain(token);
    expect(contents).not.toContain(meetingTitle);
    expect(contents).not.toContain(filePath);
    expect(contents).not.toContain(audio);
    expect((await stat(exportedPath)).mode & 0o777).toBe(0o600);
  });
});

describe("produkční zapojení diagnostiky", () => {
  const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
  const preloadSource = readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8");

  it("přijímá oba kanály jen z Nastavení, bez payloadu a bez HTTP sondy", () => {
    const start = mainSource.indexOf('handleValidated("diagnostics:get"');
    const end = mainSource.indexOf('handleValidated("auth:pending-url"', start);
    expect(start, "diagnostics:get není registrovaný").toBeGreaterThan(-1);
    expect(end, "blok diagnostiky nemá bezpečnou hranici").toBeGreaterThan(start);
    const block = mainSource.slice(start, end);

    expect(block).toContain('handleValidated("diagnostics:get", ["settings"]');
    expect(block).toContain('requireNoPayload("diagnostics:get"');
    expect(block).toContain("Stav diagnostiky není dostupný");
    expect(block).toContain("return null");
    expect(block).toContain('handleValidated("diagnostics:export", ["settings"]');
    expect(block).toContain('requireNoPayload("diagnostics:export"');
    expect(block).not.toMatch(/net\.fetch|https?:\/\//u);
    expect(preloadSource).toContain('ipcRenderer.invoke("diagnostics:get")');
    expect(preloadSource).toContain('ipcRenderer.invoke("diagnostics:export")');
  });

  it("název zařízení čte přes os.hostname v hlavním procesu bez payloadu", () => {
    expect(mainSource).toContain('const os = require("node:os")');
    expect(mainSource).toContain(
      'handleValidated("settings:get-device-name", ["settings"]',
    );
    expect(mainSource).toContain('requireNoPayload("settings:get-device-name"');
    expect(mainSource).toContain("os.hostname()");
    expect(preloadSource).toContain('ipcRenderer.invoke("settings:get-device-name")');
  });
});
