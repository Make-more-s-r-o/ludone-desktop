import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { SettingsApp } from "./components/Settings.jsx";
import "./styles.css";

const isSettingsWindow = window.location.hash === "#settings";

createRoot(document.getElementById("root")).render(
  isSettingsWindow ? <SettingsApp /> : <App />,
);
