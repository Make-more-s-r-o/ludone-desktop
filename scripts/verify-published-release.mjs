import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateReleaseArtifacts } from "./release-artifacts.mjs";

const DOWNLOAD_BASE = "https://stahnout.ludone.cz/desktop/";

// Kontrola veřejné cesty je oddělená od SSH: správný přenos do chybného adresáře
// nesmí vypadat jako úspěšné vydání dostupné updateru.
export async function verifyPublishedRelease(validation, { fetchImpl = fetch } = {}) {
  const metadata = validation.artifacts.find(({ name }) => name === "latest-mac.yml");
  if (!metadata) throw new Error("Chybí ověřená lokální metadata vydání");
  for (const artifact of validation.artifacts) {
    if (!/^[A-Za-z0-9.-]+$/.test(artifact.name)) throw new Error("Neplatný název artefaktu");
    const isMetadata = artifact.name === metadata.name;
    const response = await fetchImpl(new URL(artifact.name, DOWNLOAD_BASE).href, {
      method: isMetadata ? "GET" : "HEAD",
      redirect: "error",
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status !== 200) throw new Error(`${artifact.name}: HTTP ${response.status}`);
    if (isMetadata) {
      const bytes = Buffer.from(await response.arrayBuffer());
      const hash = createHash("sha256").update(bytes).digest("hex");
      if (bytes.length !== artifact.size || hash !== artifact.sha256) {
        throw new Error("Veřejný latest-mac.yml neodpovídá právě vydané verzi");
      }
    } else {
      const rawSize = response.headers.get("content-length") ?? "";
      if (!/^\d+$/.test(rawSize) || Number(rawSize) !== artifact.size) {
        throw new Error(`${artifact.name}: veřejná velikost neodpovídá vydanému souboru`);
      }
    }
  }
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const validation = await validateReleaseArtifacts(path.join(root, "release"));
  await verifyPublishedRelease(validation);
  console.log(`PASS veřejný feed: metadata verze ${validation.version} a všech osm balíčků/blockmap jsou dostupné`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`FAIL veřejné vydání: ${error.message}`);
    process.exitCode = 1;
  });
}
