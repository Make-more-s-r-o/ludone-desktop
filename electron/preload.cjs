const { contextBridge, ipcRenderer } = require("electron");

const AUTH_ORIGINS = Object.freeze([
  "https://app.ludone.cz",
  "https://labs.ludone.cz",
]);
const AUTH_SESSION_STATUS_CHANNEL = "auth:has-session";
const SETTINGS_TAB_CHANNEL = "settings:select-tab";
const SETTINGS_TABS = Object.freeze(["account", "recordingQueue"]);
const QUEUE_ITEM_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const QUEUE_ITEM_REVISION_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const COMPANY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const OFFER_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const UPDATE_VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/u;
let settingsTabSubscriber = null;
let pendingSettingsTab;

ipcRenderer.on(SETTINGS_TAB_CHANNEL, (_event, tab) => {
  if (!SETTINGS_TABS.includes(tab)) return;
  if (settingsTabSubscriber) {
    settingsTabSubscriber(tab);
    return;
  }
  pendingSettingsTab = tab;
});

function onSettingsTabRequested(callback) {
  if (typeof callback !== "function") {
    throw new TypeError("Odběratel přepnutí nastavení musí být funkce");
  }
  settingsTabSubscriber = callback;
  if (pendingSettingsTab !== undefined) {
    const tab = pendingSettingsTab;
    pendingSettingsTab = undefined;
    callback(tab);
  }
  return () => {
    if (settingsTabSubscriber === callback) settingsTabSubscriber = null;
  };
}

function requireUploadCompanyOffer(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !Array.isArray(value.companies) || typeof value.offerToken !== "string"
    || !OFFER_TOKEN_PATTERN.test(value.offerToken)
    || (value.selectedCompanyId !== null && !COMPANY_ID_PATTERN.test(value.selectedCompanyId))) {
    throw new TypeError("Hlavní proces nevrátil platnou nabídku firem");
  }
  const seen = new Set();
  const companies = value.companies.map((company) => {
    if (!company || typeof company !== "object" || Array.isArray(company)
      || typeof company.id !== "string" || !COMPANY_ID_PATTERN.test(company.id)
      || typeof company.name !== "string" || company.name.length < 1 || company.name.length > 160
      || company.name.trim() !== company.name || seen.has(company.id)) {
      throw new TypeError("Hlavní proces vrátil neplatnou firmu");
    }
    seen.add(company.id);
    return { id: company.id, name: company.name };
  });
  if (value.selectedCompanyId !== null && !seen.has(value.selectedCompanyId)) {
    throw new TypeError("Vybraná firma není v nabídce");
  }
  return { companies, offerToken: value.offerToken, selectedCompanyId: value.selectedCompanyId };
}

function requireUploadCompanySelection(value, companyId) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || value.saved !== true || value.selectedCompanyId !== companyId) {
    throw new TypeError("Hlavní proces nepotvrdil výběr firmy");
  }
  return { saved: true, selectedCompanyId: companyId };
}

function requireRecordingAction(value, queueRevisionRequired = false) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || typeof value.id !== "string" || !QUEUE_ITEM_ID_PATTERN.test(value.id)
    || (queueRevisionRequired && typeof value.queueRev !== "string")
    || (value.queueRev !== null
      && (typeof value.queueRev !== "string" || !QUEUE_ITEM_REVISION_PATTERN.test(value.queueRev)))
    || typeof value.fileRev !== "string" || !QUEUE_ITEM_REVISION_PATTERN.test(value.fileRev)) {
    throw new TypeError("Akce nahrávky vyžaduje GUID a platné revize");
  }
  return { id: value.id, queueRev: value.queueRev, fileRev: value.fileRev };
}

function requireRecordingDecision(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !["send", "keep"].includes(value.decision)
    || typeof value.recordingName !== "string") {
    throw new TypeError("Rozhodnutí nahrávky vyžaduje název a volbu send nebo keep");
  }
  return { recordingName: value.recordingName, decision: value.decision };
}

function requireAuthOrigin(value) {
  if (!AUTH_ORIGINS.includes(value)) {
    throw new TypeError("Hodnota prostředí musí být jeden ze dvou známých originů");
  }
  return value;
}

function requireAuthOriginSwitchResponse(value) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || typeof value.signedOutLocally !== "boolean"
    || typeof value.serverRevoked !== "boolean"
    || (value.reason !== null && typeof value.reason !== "string")
    || (value.origin !== null && !AUTH_ORIGINS.includes(value.origin))
  ) {
    throw new TypeError("Hlavní proces nevrátil platný výsledek změny prostředí");
  }
  return {
    signedOutLocally: value.signedOutLocally,
    serverRevoked: value.serverRevoked,
    reason: value.reason,
    origin: value.origin,
  };
}

function setPanelContentHeight(height) {
  if (typeof height !== "number" || !Number.isFinite(height)) {
    throw new TypeError("Výška obsahu panelu musí být konečné číslo");
  }
  return ipcRenderer.invoke("panel:set-content-height", height);
}

function getBooleanSetting(channel) {
  return ipcRenderer.invoke(channel).then(requireBooleanSettingResponse);
}

function requireBooleanSettingResponse(value) {
  if (typeof value !== "boolean") {
    throw new TypeError("Hlavní proces nevrátil boolean systémového nastavení");
  }
  return value;
}

function setBooleanSetting(channel, value) {
  if (typeof value !== "boolean") {
    throw new TypeError("Systémové nastavení musí být boolean");
  }
  return ipcRenderer.invoke(channel, value).then(requireBooleanSettingResponse);
}

function requireRecordingReference(clientRecordingId, expectedRevision) {
  if (
    typeof clientRecordingId !== "string"
    || !QUEUE_ITEM_ID_PATTERN.test(clientRecordingId)
    || typeof expectedRevision !== "string"
    || !QUEUE_ITEM_REVISION_PATTERN.test(expectedRevision)
  ) throw new TypeError("Akce vyžaduje GUID nahrávky a platnou revizi");
}

function onAuthSessionChanged(callback) {
  if (typeof callback !== "function") {
    throw new TypeError("Odběratel změny přihlášení musí být funkce");
  }
  const listener = () => callback();
  ipcRenderer.on(AUTH_SESSION_STATUS_CHANNEL, listener);
  return () => ipcRenderer.removeListener(AUTH_SESSION_STATUS_CHANNEL, listener);
}

function onTrayCommand(callback) {
  if (typeof callback !== "function") {
    throw new TypeError("Odběratel rychlé akce musí být funkce");
  }
  let active = true;
  let draining = false;
  let drainRequested = false;
  const drain = async () => {
    if (!active) return;
    if (draining) {
      // Wake může dorazit během rozpracovaného invoke. Příznak zajistí ještě
      // jedno vyzvednutí po jeho dokončení a zachová pořadí callbacků.
      drainRequested = true;
      return;
    }
    draining = true;
    try {
      do {
        drainRequested = false;
        const commands = await ipcRenderer.invoke("tray:command");
        if (!Array.isArray(commands)) return;
        for (let index = 0; index < commands.length; index += 1) {
          const command = commands[index];
          if (!active) return;
          if (
            command === "stop-recording"
            || command === "start-tracking"
            || command === "stop-tracking"
          ) {
            try {
              callback(command);
            } catch (error) {
              console.error(`[tray] Rychlou akci ${command} se nepodařilo zpracovat: ${error.message}`);
            }
            // Každý příkaz dostane vlastní event-loop tah. React by jinak víc
            // synchronních setState sloučil a komponenty by viděly jen poslední akci.
            if (index < commands.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }
        }
      } while (active && drainRequested);
    } catch (error) {
      console.error(`[tray] Rychlou akci se nepodařilo převzít: ${error.message}`);
    } finally {
      draining = false;
      if (active && drainRequested) void drain();
    }
  };
  const listener = () => drain();
  ipcRenderer.on("tray:command", listener);
  // První vyzvednutí je handshake pro kliknutí, které přišlo ještě před
  // instalací listeneru. Probouzecí událost sama totiž nemá trvalou frontu.
  void drain();
  return () => {
    active = false;
    ipcRenderer.removeListener("tray:command", listener);
  };
}

contextBridge.exposeInMainWorld("ludone", {
  runtime: Object.freeze({
    resetOnboarding: process.env.LUDONE_RESET_ONBOARDING === "1",
  }),
  beginAuth: () => ipcRenderer.invoke("auth:begin"),
  cancelAuth: () => ipcRenderer.invoke("auth:cancel"),
  pendingAuthUrl: () => ipcRenderer.invoke("auth:pending-url"),
  copyPendingAuthUrl: async () => (
    (await ipcRenderer.invoke("auth:copy-pending-url")) === true
  ),
  hasAuthSession: async () => (await ipcRenderer.invoke(AUTH_SESSION_STATUS_CHANNEL)) === true,
  getAuthSessionState: async () => {
    const state = await ipcRenderer.invoke("auth:session-state");
    return ["none", "expired", "valid"].includes(state) ? state : "none";
  },
  onAuthSessionChanged,
  getUpdateStatus: () => ipcRenderer.invoke("updater:get-state"),
  checkForUpdates: () => ipcRenderer.invoke("updater:check-now"),
  installUpdate: (expectedVersion) => {
    if (typeof expectedVersion !== "string" || !UPDATE_VERSION_PATTERN.test(expectedVersion)) {
      throw new TypeError("Instalace vyžaduje platnou očekávanou verzi");
    }
    return ipcRenderer.invoke("updater:install", { expectedVersion });
  },
  deferUpdate: () => ipcRenderer.invoke("updater:defer"),
  onUpdateStatusChanged: (callback) => {
    if (typeof callback !== "function") {
      throw new TypeError("Odběratel stavu aktualizací musí být funkce");
    }
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("updater:state-changed", listener);
    return () => ipcRenderer.removeListener("updater:state-changed", listener);
  },
  getAuthIdentity: () => ipcRenderer.invoke("auth:identity"),
  getAuthOrigin: () => ipcRenderer.invoke("auth:origin"),
  setAuthOrigin: (value) => {
    const authOrigin = requireAuthOrigin(value);
    return ipcRenderer.invoke("auth:set-origin", authOrigin).then(requireAuthOrigin);
  },
  switchAuthOrigin: (value) => {
    const authOrigin = requireAuthOrigin(value);
    return ipcRenderer.invoke("auth:switch-origin", authOrigin)
      .then(requireAuthOriginSwitchResponse);
  },
  logout: () => ipcRenderer.invoke("auth:logout"),
  listUploadCompanies: () => ipcRenderer.invoke("upload-companies:list")
    .then(requireUploadCompanyOffer),
  selectUploadCompany: (offerToken, companyId) => {
    if (typeof offerToken !== "string" || !OFFER_TOKEN_PATTERN.test(offerToken)
      || typeof companyId !== "string" || !COMPANY_ID_PATTERN.test(companyId)) {
      throw new TypeError("Výběr firmy vyžaduje platný token nabídky a GUID firmy");
    }
    return ipcRenderer.invoke("upload-companies:select", offerToken, companyId)
      .then((value) => requireUploadCompanySelection(value, companyId));
  },
  getDeviceName: () => ipcRenderer.invoke("settings:get-device-name"),
  getDockVisible: () => getBooleanSetting("settings:get-dock-visible"),
  setDockVisible: (value) => setBooleanSetting("settings:set-dock-visible", value),
  getOpenAtLogin: () => getBooleanSetting("settings:get-open-at-login"),
  setOpenAtLogin: (value) => setBooleanSetting("settings:set-open-at-login", value),
  getUploadEnabled: () => getBooleanSetting("settings:get-upload-enabled"),
  setUploadEnabled: (value) => setBooleanSetting("settings:set-upload-enabled", value),
  getDiagnostics: () => ipcRenderer.invoke("diagnostics:get"),
  exportDiagnostics: () => ipcRenderer.invoke("diagnostics:export"),
  getPermissionStatus: (permission) =>
    ipcRenderer.invoke("permission:status", permission),
  requestPermission: (permission) =>
    ipcRenderer.invoke("permission:request", permission),
  beginRecording: (sources) => ipcRenderer.invoke("recording:begin", sources),
  appendRecordingChunk: (sessionId, source, sequence, arrayBuffer) =>
    ipcRenderer.invoke("recording:append", sessionId, source, sequence, arrayBuffer),
  finishRecording: (sessionId, trackTimings) =>
    ipcRenderer.invoke("recording:finish", sessionId, trackTimings),
  finishRecordingExport: (sessionId, outcome) =>
    ipcRenderer.invoke("recording:finish-export", sessionId, outcome),
  confirmRecordingExportFailure: (sessionId) =>
    ipcRenderer.invoke("recording:confirm-export-failure", sessionId),
  saveRecordingDecision: (clientRecordingId, volby) =>
    ipcRenderer.invoke("recording:save-decision", clientRecordingId, requireRecordingDecision(volby)),
  exportRecording: (clientRecordingId, volby) =>
    ipcRenderer.invoke("recording:export", clientRecordingId, volby),
  listQueue: () => ipcRenderer.invoke("queue:list"),
  listLocalRecordings: () => ipcRenderer.invoke("recordings:list-local"),
  sendRecording: (value) => ipcRenderer.invoke("recordings:send", requireRecordingAction(value, true)),
  retryRecording: (value) => ipcRenderer.invoke("recordings:retry", requireRecordingAction(value, true)),
  deleteRecording: (value) => ipcRenderer.invoke("recordings:delete", requireRecordingAction(value)),
  revealRecording: (value) => ipcRenderer.invoke("recordings:reveal", requireRecordingAction(value)),
  verifyRecording: (clientRecordingId, expectedRevision) => {
    requireRecordingReference(clientRecordingId, expectedRevision);
    return ipcRenderer.invoke("recordings:verify", clientRecordingId, expectedRevision);
  },
  openRecordingInLuDone: (clientRecordingId, expectedRevision, track) => {
    requireRecordingReference(clientRecordingId, expectedRevision);
    if (!["delivery", "microphone", "system"].includes(track)) {
      throw new TypeError("Otevření vyžaduje známou stopu");
    }
    return ipcRenderer.invoke("recordings:open-web", clientRecordingId, expectedRevision, track);
  },
  claimRecording: (clientRecordingId, expectedRevision) => {
    if (
      typeof clientRecordingId !== "string"
      || !QUEUE_ITEM_ID_PATTERN.test(clientRecordingId)
      || typeof expectedRevision !== "string"
      || !QUEUE_ITEM_REVISION_PATTERN.test(expectedRevision)
    ) {
      throw new TypeError("Převzetí vyžaduje GUID nahrávky a platnou revizi");
    }
    return ipcRenderer.invoke("queue:claim-recording", clientRecordingId, expectedRevision);
  },
  retryQueue: () => ipcRenderer.invoke("queue:retry"),
  startTracking: (payload) => ipcRenderer.invoke("tracking:start", payload),
  switchTrackingProject: (payload) =>
    ipcRenderer.invoke("tracking:switch-project", payload),
  stopTracking: () => ipcRenderer.invoke("tracking:stop"),
  getTrackingState: () => ipcRenderer.invoke("tracking:get-state"),
  resolveRecoveredTracking: (payload) =>
    ipcRenderer.invoke("tracking:resolve-recovered", payload),
  getTrayState: () => ipcRenderer.invoke("tray:get-state"),
  onTrayCommand,
  testClickTray: () => ipcRenderer.invoke("test:click-tray"),
  testQuit: () => ipcRenderer.invoke("test:quit"),
  setPanelContentHeight,
  reportTrayFacts: (facts) => ipcRenderer.send("tray:report-facts", facts),
  hidePanel: () => ipcRenderer.send("panel:hide"),
  openSettings: (initialTab) => {
    if (initialTab === undefined) {
      ipcRenderer.send("settings:open");
      return;
    }
    if (!["account", "recordingQueue"].includes(initialTab)) {
      throw new TypeError("Nastavení lze otevřít jen v podporované části");
    }
    ipcRenderer.send("settings:open", initialTab);
  },
  onSettingsTabRequested,
  closeSettings: () => ipcRenderer.send("settings:close"),
});
