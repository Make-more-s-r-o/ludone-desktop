const fs = require("node:fs");
const { Readable } = require("node:stream");

// Každý seek znovu ověřuje revizi. Soubor se otevírá bez následování symlinků.
async function recordingAudioResponse(request, resolveFile) {
  const resolved = await resolveFile();
  const filePath = typeof resolved === "string" ? resolved : resolved.filePath;
  const mime = typeof resolved === "string" ? "audio/webm" : resolved.mime;
  const handle = await fs.promises.open(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const opened = await handle.stat();
    const current = await fs.promises.lstat(filePath);
    if (!opened.isFile() || !current.isFile() || current.isSymbolicLink()
      || opened.dev !== current.dev || opened.ino !== current.ino || opened.size !== current.size
      || opened.mtimeMs !== current.mtimeMs) throw new Error("Zvukový soubor se změnil");
    await resolveFile();
    let start = 0;
    let end = opened.size - 1;
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/u.exec(range);
      if (!match) { await handle.close(); return new Response(null, { status: 416 }); }
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : end;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= opened.size) {
        await handle.close();
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${opened.size}` } });
      }
      end = Math.min(end, opened.size - 1);
    }
    const headers = { "Content-Type": mime, "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1), "Cache-Control": "no-store" };
    if (range) headers["Content-Range"] = `bytes ${start}-${end}/${opened.size}`;
    const stream = handle.createReadStream({ start, end, autoClose: true });
    return new Response(Readable.toWeb(stream), { status: range ? 206 : 200, headers });
  } catch (error) { await handle.close().catch(() => {}); throw error; }
}
module.exports = { recordingAudioResponse };
