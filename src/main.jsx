import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { SettingsApp } from "./components/Settings.jsx";
import { TraySpaceWarning } from "./components/TraySpaceWarning.jsx";
import { initializeTheme } from "./lib/theme.js";
import "./styles.css";
import "./astra-parity.css";

initializeTheme();

const isSettingsWindow = window.location.hash === "#settings";
const isTraySpaceWarning = window.location.hash === "#tray-space-warning";

createRoot(document.getElementById("root")).render(
  isTraySpaceWarning ? <TraySpaceWarning /> : (isSettingsWindow ? <SettingsApp /> : <App />),
);
