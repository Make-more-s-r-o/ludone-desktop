import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { OsaShell } from "./components/osa/index.js";
import { SettingsApp } from "./components/Settings.jsx";
import { TraySpaceWarning } from "./components/TraySpaceWarning.jsx";
import { initializeTheme } from "./lib/theme.js";
import "./styles.css";
import "./astra-parity.css";
import "./osa.css";

initializeTheme();

const isSettingsWindow = window.location.hash === "#settings";
const isTraySpaceWarning = window.location.hash === "#tray-space-warning";

function DetailApp() {
  const [activity, setActivity] = useState({ active: false, title: "" });
  useEffect(() => {
    let cancelled = false;
    let timer;
    const refresh = async () => {
      try { const result = await window.ludone.getRecordingActivity(); if (!cancelled) setActivity(result); } catch { /* Main může právě končit. */ }
      if (!cancelled) timer = window.setTimeout(refresh, 500);
    };
    void refresh();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, []);
  return <OsaShell page="detail" onClose={() => window.ludone.closeSettings()}
    recording={{ ...activity, elapsed: activity.title, onStop: () => window.ludone.requestRecordingStop() }}><SettingsApp /></OsaShell>;
}

createRoot(document.getElementById("root")).render(
  isTraySpaceWarning ? <TraySpaceWarning /> : (isSettingsWindow ? <DetailApp /> : <App />),
);
