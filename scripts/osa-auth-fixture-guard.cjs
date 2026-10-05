const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

// Veřejná syntetická identita smí žít jen v samostatném temp profilu. Produkce
// ani běžný vývoj tuto větev nikdy nezapnou; žádné skutečné tokeny se zde nečtou.
function isOsaAuthFixture({ isPackaged, env }) {
  if (isPackaged !== false || env.LUDONE_E2E !== "1" || env.LUDONE_DESIGN_E2E !== "1"
    || env.LUDONE_OSA_AUTH_E2E !== "1" || !path.isAbsolute(env.LUDONE_DATA_DIR ?? "")) return false;
  try {
    const root = path.resolve(env.LUDONE_DATA_DIR);
    const parent = path.dirname(root);
    if (path.basename(root) !== "isolated-data" || !/^ludone-osa-auth-e2e-[A-Za-z0-9]+$/u.test(path.basename(parent))
      || fs.realpathSync(path.dirname(parent)) !== fs.realpathSync(os.tmpdir())
      || fs.realpathSync(root) !== root) return false;
    return fs.readFileSync(path.join(root, ".public-synthetic-identity"), "utf8") === "OSA_PUBLIC_FIXTURE_V1\n";
  } catch { return false; }
}
module.exports = { isOsaAuthFixture };
