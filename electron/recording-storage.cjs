const { lstat, readdir } = require("node:fs/promises");
const path = require("node:path");

// Počítáme skutečné soubory v obou spravovaných kořenech, včetně zbytků po pádu.
// Symlinky se nenásledují; hardlinky zabírají místo jen jednou.
async function measureRecordingStorage(userData) {
  const seen = new Set();
  let bytes = 0;
  let files = 0;
  let complete = true;
  async function visit(candidate) {
    try {
      const stats = await lstat(candidate);
      if (stats.isSymbolicLink()) return;
      if (stats.isDirectory()) {
        for (const name of await readdir(candidate)) await visit(path.join(candidate, name));
      } else if (stats.isFile()) {
        const identity = `${stats.dev}:${stats.ino}`;
        if (seen.has(identity)) return;
        seen.add(identity);
        bytes += stats.size;
        files += 1;
      }
    } catch (error) {
      if (error.code !== "ENOENT") complete = false;
    }
  }
  await visit(path.join(userData, "nahravky"));
  await visit(path.join(userData, "queue"));
  return { bytes, files, complete, measuredAt: new Date().toISOString() };
}

module.exports = { measureRecordingStorage };
