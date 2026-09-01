import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Funkce ${name} nebyla nalezena`);

  const openingBrace = source.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Funkce ${name} nemá uzavřené tělo`);
}

const mainSource = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
const preloadSource = readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8");
const queueStoreSource = readFileSync(new URL("../electron/queue.cjs", import.meta.url), "utf8");

describe("produkční zapojení odchozí fronty", () => {
  it("hlavní proces načítá modul fronty ze src/lib", () => {
    expect(mainSource).toContain('path.join(PROJECT_ROOT, "src", "lib", "queue.js")');
  });

  it("dokončení nahrávky zařazuje do fronty", () => {
    expect(mainSource).toContain(
      'handleValidated("recording:finish", ["panel"], finishRecordingAndEnqueue)',
    );
    const finish = functionSource(mainSource, "finishRecordingAndEnqueue");
    expect(finish).toContain("ownedRecordingSession");
    expect(finish).toContain("finalizeRecordingSession");
    expect(finish).toContain("enqueueRecording");
    expect(finish.indexOf("enqueueRecording")).toBeGreaterThan(
      finish.indexOf("finalizeRecordingSession"),
    );
    expect(finish).not.toContain("pumpOutboundQueue");
  });

  it("po startu aplikace proběhne pumpa produkční fronty bez testového override", () => {
    const ready = mainSource.slice(mainSource.indexOf("app.whenReady()"));
    expect(ready.slice(0, 1_500)).toContain("pumpOutboundQueue()");
    expect(functionSource(mainSource, "pumpOutboundQueue")).toContain(".pump(");
    expect(queueStoreSource).toContain("queueModule.processNext");
  });

  it("produkční odesílací vrstva je pouze pauza a nevolá server", () => {
    const unavailableSend = functionSource(mainSource, "unavailableQueueSend");
    expect(unavailableSend).toContain('failureClass = "paused"');
    expect(unavailableSend).not.toMatch(/fetch|https?:\/\//);
  });

  it("preload vystavuje oba validační kanály fronty", () => {
    expect(preloadSource).toContain('ipcRenderer.invoke("queue:list")');
    expect(preloadSource).toContain('ipcRenderer.invoke("queue:retry")');
  });

  it("IPC fronty používá předepsané role odesílatele", () => {
    expect(mainSource).toContain('handleValidated("queue:list", ["panel", "settings"]');
    expect(mainSource).toContain('handleValidated("queue:retry", ["panel"]');
  });
});
