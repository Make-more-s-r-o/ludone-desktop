import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { verifyPublishedRelease } from "../scripts/verify-published-release.mjs";

const metadata = Buffer.from("version: 0.1.2\n");
const validation = {
  artifacts: [
    { name: "latest-mac.yml", size: metadata.length, sha256: createHash("sha256").update(metadata).digest("hex") },
    ...["arm64", "x64"].flatMap((arch) => ["dmg", "zip", "dmg.blockmap", "zip.blockmap"].map((extension) => ({
      name: `LuDone-Desktop-0.1.2-${arch}.${extension}`, size: 123,
    }))),
  ],
};

function responseFor(url) {
  return url.endsWith("latest-mac.yml")
    ? new Response(metadata)
    : new Response(null, { headers: { "content-length": "123" } });
}

describe("veřejná dostupnost vydání po SSH přenosu", () => {
  it("porovná přesný veřejný feed a velikosti všech osmi souborů bez stahování balíčků", async () => {
    const fetchImpl = vi.fn(async (url, options) => {
      expect(options.signal).toBeInstanceOf(AbortSignal);
      return responseFor(url);
    });
    await verifyPublishedRelease(validation, { fetchImpl });
    expect(fetchImpl.mock.calls).toHaveLength(9);
    expect(fetchImpl.mock.calls.map(([, options]) => options.method)).toEqual(["GET", ...Array(8).fill("HEAD")]);
    for (const [url, options] of fetchImpl.mock.calls) {
      expect(url).toMatch(/^https:\/\/stahnout\.ludone\.cz\/desktop\//);
      expect(options.redirect).toBe("error");
      expect(options.headers).toEqual({ "Cache-Control": "no-cache" });
    }
  });

  it("nepřijme starý feed se stejnou délkou", async () => {
    const fetchImpl = vi.fn(async (url) => url.endsWith("latest-mac.yml")
      ? new Response("version: 0.1.1\n") : responseFor(url));
    await expect(verifyPublishedRelease(validation, { fetchImpl })).rejects.toThrow("neodpovídá právě vydané verzi");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("nepřijme chybějící veřejný soubor", async () => {
    const fetchImpl = vi.fn(async (url) => url.endsWith("zip.blockmap")
      ? new Response(null, { status: 404 }) : responseFor(url));
    await expect(verifyPublishedRelease(validation, { fetchImpl })).rejects.toThrow("HTTP 404");
  });

  it.each(["122", "123oops", ""])("odmítne nesprávnou velikost %s", async (size) => {
    const fetchImpl = vi.fn(async (url) => url.endsWith("latest-mac.yml")
      ? responseFor(url) : new Response(null, { headers: { "content-length": size } }));
    await expect(verifyPublishedRelease(validation, { fetchImpl })).rejects.toThrow("veřejná velikost");
  });

  it("síťová chyba nepředstírá dostupné vydání", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("network error"); });
    await expect(verifyPublishedRelease(validation, { fetchImpl })).rejects.toThrow("network error");
  });
});
