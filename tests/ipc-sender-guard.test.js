import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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
const reportedFactKeys = Function(
  `"use strict"; ${/const REPORTED_FACT_KEYS = \[[^\]]*\];/.exec(mainSource)[0]}; return REPORTED_FACT_KEYS;`,
)();
const distRoot = path.resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const trustedUrl = pathToFileURL(path.join(distRoot, "index.html")).toString();
const traySpaceWarningUrl = "ludone://tray-warning/index.html#tray-space-warning";
const createGuard = Function(
  "path",
  "fileURLToPath",
  "DIST_ROOT",
  `"use strict";
  ${functionSource(mainSource, "isTrustedAppUrl")}
  ${functionSource(mainSource, "isTrustedWebContents")}
  ${functionSource(mainSource, "isTrustedRecordingSender")}
  return isTrustedRecordingSender;`,
);
const isTrustedRecordingSender = createGuard(path, fileURLToPath, distRoot);

const createPermissionGuard = Function(
  "path",
  "fileURLToPath",
  "DIST_ROOT",
  "TRAY_SPACE_WARNING_URL",
  `"use strict";
  let panelWindow;
  let settingsWindow;
  let traySpaceWarningWindow;
  ${functionSource(mainSource, "isTrustedAppUrl")}
  ${functionSource(mainSource, "isTrustedWebContents")}
  ${functionSource(mainSource, "isTrustedRecordingSender")}
  ${functionSource(mainSource, "trustedSenderKind")}
  ${functionSource(mainSource, "requireTrustedSender")}
  ${functionSource(mainSource, "isAllowedMediaPermission")}
  return {
    isAllowedMediaPermission,
    setWindows(panel, settings, traySpaceWarning) {
      panelWindow = panel;
      settingsWindow = settings;
      traySpaceWarningWindow = traySpaceWarning;
    },
  };`,
);
const permissionGuard = createPermissionGuard(
  path,
  fileURLToPath,
  distRoot,
  traySpaceWarningUrl,
);

function createWebContents(url = trustedUrl, destroyed = false) {
  const mainFrame = {};
  return {
    mainFrame,
    isDestroyed: () => destroyed,
    getURL: () => url,
  };
}

describe("ochrana odesílatele nahrávacího IPC", () => {
  it("povolí očekávané okno a jeho hlavní rám", () => {
    const expected = createWebContents();
    expect(isTrustedRecordingSender(
      { sender: expected, senderFrame: expected.mainFrame },
      expected,
    )).toBe(true);
  });

  it("odmítne jiné webContents", () => {
    const expected = createWebContents();
    const foreign = createWebContents();
    expect(isTrustedRecordingSender(
      { sender: foreign, senderFrame: foreign.mainFrame },
      expected,
    )).toBe(false);
  });

  it("odmítne iframe očekávaného okna", () => {
    const expected = createWebContents();
    expect(isTrustedRecordingSender(
      { sender: expected, senderFrame: {} },
      expected,
    )).toBe(false);
  });

  it("odmítne chybějící senderFrame", () => {
    const expected = createWebContents();
    expect(isTrustedRecordingSender(
      { sender: expected },
      expected,
    )).toBe(false);
  });

  it("odmítne senderFrame s hodnotou null", () => {
    const expected = createWebContents();
    expect(isTrustedRecordingSender(
      { sender: expected, senderFrame: null },
      expected,
    )).toBe(false);
  });

  it("odmítne zničené webContents bez výjimky", () => {
    const destroyed = createWebContents(trustedUrl, true);
    expect(() => isTrustedRecordingSender(
      { sender: destroyed, senderFrame: destroyed.mainFrame },
      destroyed,
    )).not.toThrow();
    expect(isTrustedRecordingSender(
      { sender: destroyed, senderFrame: destroyed.mainFrame },
      destroyed,
    )).toBe(false);
  });

  it("odmítne souborovou URL, která jen začíná povolenou cestou", () => {
    const malicious = createWebContents(`${trustedUrl}.evil`);
    expect(isTrustedRecordingSender(
      { sender: malicious, senderFrame: malicious.mainFrame },
      malicious,
    )).toBe(false);
  });

  it("odmítne HTTPS doménu, která jen začíná povoleným názvem", () => {
    const malicious = createWebContents("https://app.ludone.cz.utocnik.cz");
    expect(isTrustedRecordingSender(
      { sender: malicious, senderFrame: malicious.mainFrame },
      malicious,
    )).toBe(false);
  });

  it("odmítne jiný dokument na interním protokolu ludone", () => {
    const malicious = createWebContents("ludone://app/neco-jineho");
    expect(isTrustedRecordingSender(
      { sender: malicious, senderFrame: malicious.mainFrame },
      malicious,
    )).toBe(false);
  });

  it("odmítne žádost okna nastavení o mikrofon", () => {
    const panel = createWebContents();
    const settings = createWebContents();
    permissionGuard.setWindows({ webContents: panel }, { webContents: settings });

    expect(permissionGuard.isAllowedMediaPermission(settings, "media", {
      isMainFrame: true,
      requestingUrl: trustedUrl,
      mediaTypes: ["audio"],
    })).toBe(false);
  });

  it("povolí panelu zachytávání obrazovky se systémovým zvukem hlášené jako prázdné mediaTypes", () => {
    const panel = createWebContents();
    const settings = createWebContents();
    permissionGuard.setWindows({ webContents: panel }, { webContents: settings });

    expect(permissionGuard.isAllowedMediaPermission(panel, "media", {
      isMainFrame: true,
      requestingUrl: trustedUrl,
      mediaTypes: [],
    })).toBe(true);
  });

  it("ponechá zakázanou kameru", () => {
    const panel = createWebContents();
    const settings = createWebContents();
    permissionGuard.setWindows({ webContents: panel }, { webContents: settings });

    expect(permissionGuard.isAllowedMediaPermission(panel, "media", {
      isMainFrame: true,
      requestingUrl: trustedUrl,
      mediaTypes: ["video"],
    })).toBe(false);
  });

  it("ponechá zakázanou kombinaci mikrofonu a kamery", () => {
    const panel = createWebContents();
    const settings = createWebContents();
    permissionGuard.setWindows({ webContents: panel }, { webContents: settings });

    expect(permissionGuard.isAllowedMediaPermission(panel, "media", {
      isMainFrame: true,
      requestingUrl: trustedUrl,
      mediaTypes: ["audio", "video"],
    })).toBe(false);
  });

  it("odmítne prázdné mediaTypes z nedůvěryhodné URL", () => {
    const panel = createWebContents();
    const settings = createWebContents();
    permissionGuard.setWindows({ webContents: panel }, { webContents: settings });

    expect(permissionGuard.isAllowedMediaPermission(panel, "media", {
      isMainFrame: true,
      requestingUrl: "https://utocnik.example/",
      mediaTypes: [],
    })).toBe(false);
  });

  it("odmítne prázdné mediaTypes od nedůvěryhodného odesílatele", () => {
    const panel = createWebContents();
    const settings = createWebContents();
    const foreign = createWebContents();
    permissionGuard.setWindows({ webContents: panel }, { webContents: settings });

    expect(permissionGuard.isAllowedMediaPermission(foreign, "media", {
      isMainFrame: true,
      requestingUrl: trustedUrl,
      mediaTypes: [],
    })).toBe(false);
  });

  it("ponechá povolený mikrofon", () => {
    const panel = createWebContents();
    const settings = createWebContents();
    permissionGuard.setWindows({ webContents: panel }, { webContents: settings });

    expect(permissionGuard.isAllowedMediaPermission(panel, "media", {
      isMainFrame: true,
      requestingUrl: trustedUrl,
      mediaTypes: ["audio"],
    })).toBe(true);
  });

  it("povolí panelu pouze žádost o zvuk", () => {
    const panel = createWebContents();
    const settings = createWebContents();
    permissionGuard.setWindows({ webContents: panel }, { webContents: settings });

    expect(permissionGuard.isAllowedMediaPermission(panel, "media", {
      isMainFrame: true,
      requestingUrl: trustedUrl,
      mediaTypes: ["audio"],
    })).toBe(true);
    expect(permissionGuard.isAllowedMediaPermission(panel, "media", {
      isMainFrame: true,
      requestingUrl: trustedUrl,
      mediaTypes: ["video"],
    })).toBe(false);
  });

  it("odmítne žádost o média z podrámu panelu", () => {
    const panel = createWebContents();
    const settings = createWebContents();
    permissionGuard.setWindows({ webContents: panel }, { webContents: settings });

    expect(permissionGuard.isAllowedMediaPermission(panel, "media", {
      isMainFrame: false,
      requestingUrl: trustedUrl,
      mediaTypes: ["audio"],
    })).toBe(false);
  });

  it("všechny IPC kanály z produkčního kódu registruje přes validační wrapper", () => {
    // 🔴 Jméno kanálu NEMUSÍ být řetězcový literál. Dokud tenhle výraz uměl jen literál,
    // byl kanál registrovaný konstantou pro inventuru NEVIDITELNÝ — a inventura je jediné
    // měřidlo, které hlídá, že se nikdo nezaregistruje syrovým ipcMain bez ověření
    // odesílatele. Doloženo nezávislým review: `handleValidated(AUTH_CANCEL_CHANNEL, …)`
    // do seznamu nespadl a dvanáctipoložkový výčet prošel beze změny.
    // Definice obou wrapperů obsahují jedinou POVOLENOU syrovou registraci
    // (`ipcMain.handle(channel, …)` uvnitř `handleValidated`). Že jdou přes
    // `requireTrustedSender`, hlídají samostatné asserce níž — z inventury je proto
    // vyřízneme, jinak by se hlásily jako kanál, jehož jméno neumíme rozluštit.
    // 🔴 Inventura se dívá na KÓD, ne na prózu. Bez tohohle kroku ji rozbil obyčejný
    // komentář, který ukazuje registraci kanálu — sabotáž `// handleValidated("auth:begin", …)`
    // shodila test, přestože v kódu se nic nezměnilo. Odstraňujeme jen CELOŘÁDKOVÉ
    // komentáře: kdo by mazal každé `//`, rozřízne i `"https://app.ludone.cz"` uvnitř řetězce.
    const kodBezKomentaru = mainSource
      .split("\n")
      .map((radek) => (radek.trim().startsWith("//") ? "" : radek))
      .join("\n");

    const zdrojBezWrapperu = [
      functionSource(kodBezKomentaru, "handleValidated"),
      functionSource(kodBezKomentaru, "onValidated"),
    ].reduce((text, telo) => text.replace(telo, ""), kodBezKomentaru);

    const konstanty = Object.fromEntries(
      [...kodBezKomentaru.matchAll(/^const\s+([A-Z0-9_]+)\s*=\s*["']([^"']+)["'];/gm)]
        .map((m) => [m[1], m[2]]),
    );
    const registrations = [...zdrojBezWrapperu.matchAll(
      /\b(ipcMain\.(?:on|handle)|(?:on|handle)Validated)\(\s*(?:["']([^"']+)["']|([A-Za-z_$][\w$]*))/g,
    )].map((match) => {
      const channel = match[2] ?? konstanty[match[3]];
      // Kanál pojmenovaný něčím, co neumíme rozluštit, je NÁLEZ, ne důvod ho přeskočit.
      expect(channel, `kanál registrovaný výrazem, který neumím rozluštit: ${match[3]}`)
        .toBeTruthy();
      return { registration: match[1], channel };
    });

    // Dvojí registrace téhož kanálu je v Electronu výjimka při startu. Porovnání
    // seřazených polí ji chytne taky, ale hlásí ji jako nesrovnalost dvou seznamů —
    // tahle asserce řekne rovnou, o který kanál jde. Vzniklo při slučování dvou linií,
    // kde jedna nesla atrapu `auth:begin` a druhá skutečný handler.
    const jmena = registrations.map(({ channel }) => channel);
    const dvakrat = [...new Set(jmena.filter((j, i) => jmena.indexOf(j) !== i))];
    expect(dvakrat, `kanál registrovaný dvakrát: ${dvakrat.join(", ")}`).toEqual([]);

    expect(jmena.sort()).toEqual([
      "auth:begin",
      "auth:cancel",
      "auth:copy-pending-url",
      "auth:has-session",
      "auth:identity",
      "auth:logout",
      "auth:origin",
      "auth:pending-url",
      "auth:session-state",
      "auth:set-origin",
      "auth:switch-origin",
      "diagnostics:export",
      "diagnostics:get",
      "panel:hide",
      "panel:set-content-height",
      "permission:request",
      "permission:status",
      "queue:list",
      "queue:retry",
      "recording:append",
      "recording:begin",
      "recording:confirm-export-failure",
      // Payload: (clientRecordingId, { recordingName, openUploadPage: boolean }).
      // openUploadPage je povinný bez defaultu; volbu i průchod preloadem spouští
      // tests/queue-wiring.test.js v „výslovná volba stránky přes exportní IPC“.
      "recording:export",
      "recording:finish",
      "recording:finish-export",
      "settings:close",
      "settings:get-dock-visible",
      "settings:get-device-name",
      "settings:get-open-at-login",
      "settings:open",
      "settings:set-dock-visible",
      "settings:set-open-at-login",
      "test:click-tray",
      "test:quit",
      "tracking:get-state",
      "tracking:resolve-recovered",
      "tracking:start",
      "tracking:stop",
      "tracking:switch-project",
      "tray:command",
      "tray:get-state",
      "tray:report-facts",
      "tray-space-warning:enable-dock",
    ].sort());
    expect(registrations.filter(({ registration }) => registration.startsWith("ipcMain."))).toEqual([]);
    expect(functionSource(mainSource, "handleValidated")).toContain("requireTrustedSender");
    expect(functionSource(mainSource, "onValidated")).toContain("requireTrustedSender");
    expect(functionSource(mainSource, "installMediaHandlers")).toContain("isAllowedMediaPermission");
    expect(functionSource(mainSource, "installMediaHandlers")).toContain("isTrustedPanelFrame");
  });

  it("inventarizuje přesně čtyři boolean fakta přijímaná tray kanálem", () => {
    // Nový fakt není nový IPC kanál. Patří ale do bezpečnostní inventury stejné hranice:
    // renderer smí hlásit jen tyto skutečnosti, nikdy jméno ikony ani volný objekt.
    expect([...reportedFactKeys].sort()).toEqual([
      "panelActionsAvailable",
      "signedIn",
      "systemAudioLost",
      "tracking",
    ]);
  });
});
