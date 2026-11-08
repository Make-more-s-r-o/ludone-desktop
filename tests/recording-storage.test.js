import { mkdtemp, mkdir, writeFile, link, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import storage from "../electron/recording-storage.cjs";
import settings from "../electron/settings.cjs";

const roots = [];
async function root() {
  const value = await mkdtemp(path.join(tmpdir(), "desktop-179-"));
  roots.push(value);
  return value;
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map(value => rm(value, { recursive: true, force: true })));
});

it("sečte originály, system, master, delivery, manifesty, queue i dočasné JSON a encoder; bez Stažených a symlinků", async () => {
  const userData = await root();
  const entries = [
    ["nahravky/mikrofon.webm", 11], ["nahravky/system.webm", 23],
    ["nahravky/stereo-master.webm", 37], ["nahravky/stereo.webm", 41],
    ["nahravky/a.manifest.json", 53], ["nahravky/a.meeting-audio-v1.json", 67],
    ["nahravky/.zbytek.json.tmp", 79], ["nahravky/.media-encoder-1/tmp.webm", 83],
    ["queue/outgoing.json", 97], ["queue/.outgoing.json.tmp", 101],
  ];
  for (const [name, bytes] of entries) {
    const file = path.join(userData, String(name));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.alloc(Number(bytes)));
  }
  const foreign = await root();
  await writeFile(path.join(foreign, "export.webm"), Buffer.alloc(1000));
  await symlink(foreign, path.join(userData, "nahravky", "cizi"));
  await link(path.join(userData, "nahravky/stereo.webm"), path.join(userData, "nahravky/.media-encoder-1/hardlink.webm"));
  expect(await storage.measureRecordingStorage(userData)).toMatchObject({ bytes: 592, files: 10, complete: true });
  await rm(path.join(userData, "nahravky"), { recursive: true });
  expect(await storage.measureRecordingStorage(userData)).toMatchObject({ bytes: 198, files: 2 });
});

it.each([undefined, null, "vadná", 7, "7 dní po odeslání", "Ihned smazat", "Nemazat"])("migrace %s zachová bezpečný účinný výsledek i po restartu", async value => {
  const filePath = path.join(await root(), "retence.json");
  const store = settings.createRetentionSettingsStore({ filePath });
  const expected = typeof value === "string" && ["7 dní po odeslání", "Ihned smazat", "Nemazat"].includes(value) ? value : "Nemazat";
  expect(store.migrate(value)).toBe(expected);
  expect(settings.createRetentionSettingsStore({ filePath }).get()).toBe(expected);
  expect(store.migrate("30 dní po odeslání")).toBe(expected);
});
