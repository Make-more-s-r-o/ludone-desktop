const { randomBytes, randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SCHEMA_VERSION = 1;
const DEFAULT_AUTH_ORIGIN = "https://app.ludone.cz";
const AUTH_ORIGINS = Object.freeze([
  DEFAULT_AUTH_ORIGIN,
  "https://labs.ludone.cz",
]);

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

function readApplicationSettings(filePath, log) {
  try {
    const stored = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (
      !stored
      || typeof stored !== "object"
      || Array.isArray(stored)
      || stored.schemaVersion !== SCHEMA_VERSION
    ) {
      throw new TypeError("Soubor nastavení nemá platné schéma");
    }
    return stored;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      report(log, `[settings] Nastavení aplikace nelze načíst, používám vypnuto: ${error.message}`);
    }
    return {};
  }
}

function saveSettingsAtomically(filePath, value, log) {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${randomUUID()}.tmp`,
  );
  let fileDescriptor;

  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    fileDescriptor = fs.openSync(temporaryPath, "wx", 0o600);
    fs.writeFileSync(fileDescriptor, `${JSON.stringify(value)}\n`, "utf8");
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

function readQueueOwnerSecret(filePath) {
  try {
    const ulozene = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (ulozene?.schemaVersion !== SCHEMA_VERSION) return null;
    if (typeof ulozene.secret !== "string") return null;
    const buffer = Buffer.from(ulozene.secret, "base64");
    // Kratší tajemství než 32 bajtů bereme jako poškozené a přepíšeme — slabé
    // tajemství je horší než žádné, protože vypadá jako ochrana.
    return buffer.length >= 32 ? buffer : null;
  } catch {
    // Chybějící soubor je běžný stav při první instalaci.
    return null;
  }
}

// Náhodné tajemství per instalace pro otisk vlastníka fronty.
//
// 🔴 PROČ: bez něj je otisk jen sha256 z e-mailu a známé domény, takže kdo má soubor
// fronty, prostě vyzkouší e-maily kolegů a zjistí, komu nahrávka patří. Slovníkový útok
// na e-mail je triviální — je jich v firmě pár desítek. S tajemstvím to nejde.
//
// Tajemství leží MIMO frontu (v adresáři nastavení, režim 0600), aby ho útočník
// s kopií `outgoing.json` neměl.
/**
 * @param {{filePath?: unknown, log?: unknown}} [options]
 */
function createQueueOwnerSecretStore({ filePath, log = console.warn } = {}) {
  let secret;
  return {
    // Vrací Buffer, nebo null. 🔴 Null znamená „nelze bezpečně určit vlastníka",
    // což volající MUSÍ přeložit na „vlastník neznámý" — tedy pauzu. Nikdy ne na
    // nesolený otisk: tichý návrat ke slabší ochraně je horší než přiznaná nedostupnost.
    get() {
      if (secret !== undefined) return secret;
      const ulozene = readQueueOwnerSecret(filePath);
      if (ulozene !== null) {
        secret = ulozene;
        return secret;
      }
      try {
        const novy = randomBytes(32);
        saveSettingsAtomically(
          filePath,
          { schemaVersion: SCHEMA_VERSION, secret: novy.toString("base64") },
          log,
        );
        secret = novy;
      } catch (error) {
        report(log, `[nastaveni] Tajemství vlastníka fronty nelze uložit: ${error.message}`);
        secret = null;
      }
      return secret;
    },
  };
}

/**
 * @param {{filePath?: unknown, log?: unknown}} [options]
 */
function createApplicationSettingsStore({ filePath, log = console.warn } = {}) {
  if (typeof filePath !== "string" || filePath.length === 0) {
    throw new TypeError("Nastavení aplikace vyžaduje cestu k souboru");
  }
  if (typeof log !== "function") {
    throw new TypeError("Logger nastavení aplikace musí být funkce");
  }

  const keys = new Set(["dockVisible", "uploadEnabled"]);
  function requireKey(key) {
    if (!keys.has(key)) throw new TypeError("Neznámý klíč nastavení aplikace");
  }

  // Čtení nic nezapisuje. Starší soubor může obsahovat jen Dock; chybějící nebo
  // typově poškozená hodnota je vypnuto, zapíná výhradně skutečný boolean true.
  let settings = readApplicationSettings(filePath, log);
  return Object.freeze({
    get(key) {
      requireKey(key);
      return Object.prototype.hasOwnProperty.call(settings, key) && settings[key] === true;
    },
    async set(key, nextValue) {
      requireKey(key);
      if (typeof nextValue !== "boolean") {
        throw new TypeError("Nastavení aplikace musí být boolean");
      }
      // Volba je malá a mění se vzácně. Dokončený synchronní atomický zápis před
      // návratem brání tomu, aby okamžité Cmd+Q předběhlo uložení.
      const nextSettings = { ...settings, schemaVersion: SCHEMA_VERSION, [key]: nextValue };
      saveSettingsAtomically(filePath, nextSettings, log);
      settings = nextSettings;
      return nextValue;
    },
  });
}

/**
 * @param {{filePath?: unknown, log?: unknown, settingsStore?: ReturnType<typeof createApplicationSettingsStore>}} [options]
 */
function createDockVisibilityStore({ filePath, log = console.warn, settingsStore } = {}) {
  // Dock i vypínač odesílání sdílejí jednu instanci a jeden soubor. Zápis jedné volby tak
  // zachová ostatní i při návratu Docku po selhání nativního API.
  const store = settingsStore ?? createApplicationSettingsStore({ filePath, log });
  return Object.freeze({
    get: () => store.get("dockVisible"),
    set: (value) => store.set("dockVisible", value),
  });
}

function isKnownAuthOrigin(value) {
  return typeof value === "string" && AUTH_ORIGINS.includes(value);
}

function readAuthOrigin(filePath, log) {
  try {
    const stored = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (
      !stored
      || Array.isArray(stored)
      || stored.schemaVersion !== SCHEMA_VERSION
      || !isKnownAuthOrigin(stored.authOrigin)
    ) {
      throw new TypeError("Soubor prostředí nemá platné schéma");
    }
    return stored.authOrigin;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      report(
        log,
        `[settings] Prostředí nelze načíst, používám produkci: ${error.message}`,
      );
    }
    return DEFAULT_AUTH_ORIGIN;
  }
}

/**
 * @param {{filePath?: unknown, log?: unknown}} [options]
 */
function createAuthOriginStore({ filePath, log = console.warn } = {}) {
  if (typeof filePath !== "string" || filePath.length === 0) {
    throw new TypeError("Nastavení prostředí vyžaduje cestu k souboru");
  }
  if (typeof log !== "function") {
    throw new TypeError("Logger nastavení prostředí musí být funkce");
  }

  let authOrigin = readAuthOrigin(filePath, log);
  return Object.freeze({
    get() {
      return authOrigin;
    },
    async set(nextValue) {
      if (!isKnownAuthOrigin(nextValue)) {
        throw new TypeError("Hodnota prostředí musí být jeden ze dvou známých originů");
      }
      saveSettingsAtomically(filePath, {
        schemaVersion: SCHEMA_VERSION,
        authOrigin: nextValue,
      }, log);
      authOrigin = nextValue;
      return authOrigin;
    },
  });
}

module.exports = {
  createQueueOwnerSecretStore,
  AUTH_ORIGINS,
  DEFAULT_AUTH_ORIGIN,
  createApplicationSettingsStore,
  createAuthOriginStore,
  createDockVisibilityStore,
};
