const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SCHEMA_VERSION = 1;

function report(log, message) {
  try {
    log(message);
  } catch {
    // Diagnostika nesmí změnit bezpečný výchozí stav ani výsledek zápisu.
  }
}

function closeIgnoringErrors(fileDescriptor) {
  if (fileDescriptor === undefined) return;
  try {
    fs.closeSync(fileDescriptor);
  } catch {
    // Při úklidu zachováváme původní chybu souborové operace.
  }
}

function readDockVisibility(filePath, log) {
  try {
    const stored = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (
      !stored
      || Array.isArray(stored)
      || stored.schemaVersion !== SCHEMA_VERSION
      || typeof stored.dockVisible !== "boolean"
    ) {
      throw new TypeError("Soubor nastavení nemá platné schéma");
    }
    return stored.dockVisible;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      report(log, `[settings] Nastavení Docku nelze načíst, používám vypnuto: ${error.message}`);
    }
    return false;
  }
}

function saveDockVisibility(filePath, dockVisible, log) {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${randomUUID()}.tmp`,
  );
  let fileDescriptor;

  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    fileDescriptor = fs.openSync(temporaryPath, "wx", 0o600);
    fs.writeFileSync(fileDescriptor, `${JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      dockVisible,
    })}\n`, "utf8");
    fs.fsyncSync(fileDescriptor);
    fs.closeSync(fileDescriptor);
    fileDescriptor = undefined;
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    closeIgnoringErrors(fileDescriptor);
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch {
      // Původní chyba zápisu je pro volajícího důležitější než úklid temp souboru.
    }
    throw error;
  }

  // fsync souboru chrání obsah; fsync adresáře chrání samotné přejmenování. Po
  // rename už je nová hodnota commitnutá, proto případná chyba fsync nesmí vrátit
  // stav paměti zpět za stav viditelný na disku.
  let directoryDescriptor;
  try {
    directoryDescriptor = fs.openSync(directory, "r");
    fs.fsyncSync(directoryDescriptor);
    fs.closeSync(directoryDescriptor);
    directoryDescriptor = undefined;
  } catch (error) {
    closeIgnoringErrors(directoryDescriptor);
    report(log, `[settings] Nelze potvrdit zápis adresáře nastavení: ${error.message}`);
  }
}

/**
 * @param {{filePath?: unknown, log?: unknown}} [options]
 */
function createDockVisibilityStore({ filePath, log = console.warn } = {}) {
  if (typeof filePath !== "string" || filePath.length === 0) {
    throw new TypeError("Nastavení Docku vyžaduje cestu k souboru");
  }
  if (typeof log !== "function") {
    throw new TypeError("Logger nastavení Docku musí být funkce");
  }

  let dockVisible = readDockVisibility(filePath, log);
  return Object.freeze({
    get() {
      return dockVisible;
    },
    async set(nextValue) {
      if (typeof nextValue !== "boolean") {
        throw new TypeError("Viditelnost Docku musí být boolean");
      }
      // Volba je malá a mění se vzácně. Dokončený synchronní atomický zápis před
      // návratem brání tomu, aby okamžité Cmd+Q předběhlo uložení.
      saveDockVisibility(filePath, nextValue, log);
      dockVisible = nextValue;
      return dockVisible;
    },
  });
}

module.exports = {
  createDockVisibilityStore,
};
