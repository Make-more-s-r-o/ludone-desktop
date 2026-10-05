import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const { recordingAudioResponse } = createRequire(import.meta.url)("../electron/osa-playback.cjs");
async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), "osa-playback-"));
  try { const file = path.join(root, "audio.webm"); await writeFile(file, "0123456789"); await run(file, root); }
  finally { await rm(root, { recursive: true, force: true }); }
}
describe("bezpečné místní přehrávání", () => {
  it("seek streamuje jen rozsah a znovu ověří revizi", async () => fixture(async (file) => {
    let checks = 0;
    const response = await recordingAudioResponse(new Request("https://example.invalid", { headers: { range: "bytes=3-5" } }), async () => { checks++; return file; });
    expect(response.status).toBe(206); expect(response.headers.get("Content-Range")).toBe("bytes 3-5/10");
    expect(await response.text()).toBe("345"); expect(checks).toBe(2);
  }));
  it("odmítne stale revizi před otevřením", async () => {
    await expect(recordingAudioResponse(new Request("https://example.invalid"), async () => { throw new Error("stale"); })).rejects.toThrow("stale");
  });
  it("odmítne výměnu za FIFO bez čekání na zapisovatele", async () => fixture(async (file) => {
    await expect(recordingAudioResponse(new Request("https://example.invalid"), async () => {
      await rm(file);
      await promisify(execFile)("mkfifo", [file]);
      return file;
    })).rejects.toThrow("Zvukový soubor se změnil");
  }));
  it("nesleduje symlink a odmítá neplatný rozsah", async () => fixture(async (file, root) => {
    const link = path.join(root, "link.webm"); await symlink(file, link);
    await expect(recordingAudioResponse(new Request("https://example.invalid"), async () => link)).rejects.toThrow();
    const response = await recordingAudioResponse(new Request("https://example.invalid", { headers: { range: "bytes=999-" } }), async () => file);
    expect(response.status).toBe(416);
  }));
});
