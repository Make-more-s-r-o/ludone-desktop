import { useRef, useState } from "react";
import { LuDoneMark } from "./Icons.jsx";

export function TraySpaceWarning() {
  const [dockStatus, setDockStatus] = useState("idle");
  const dockRequestInFlight = useRef(false);

  const enableDockIcon = async () => {
    if (dockRequestInFlight.current) return;
    dockRequestInFlight.current = true;
    setDockStatus("enabling");
    try {
      await window.ludoneTraySpaceWarning.enableDockIcon();
      setDockStatus("enabled");
    } catch {
      setDockStatus("error");
      dockRequestInFlight.current = false;
    }
  };

  return (
    <main
      className="panel window-surface auth-error-panel tray-space-warning"
      data-testid="tray-space-warning"
      aria-labelledby="tray-space-warning-title"
    >
      <div className="auth-error-panel__announcement">
        <div className="auth-error-panel__heading tray-space-warning__heading">
          <span className="tray-space-warning__mark"><LuDoneMark size={22} variant="panel" /></span>
          <h1 id="tray-space-warning-title">LuDone běží</h1>
        </div>
        <p className="auth-error-panel__message">
          Ikona se do horní lišty nevešla. Aplikace dál běží, ale z lišty ji teď neuvidíš.
        </p>
      </div>

      <div className="tray-space-warning__dock-action">
        {dockStatus !== "enabled" && (
          <button
            type="button"
            className="button auth-error-panel__action auth-error-panel__action--primary"
            data-testid="tray-space-warning-enable-dock"
            disabled={dockStatus === "enabling"}
            onClick={enableDockIcon}
          >
            {dockStatus === "enabling" ? "Zapínám ikonu v Docku…" : "Zapnout ikonu v Docku"}
          </button>
        )}

        <div
          className="tray-space-warning__dock-feedback"
          aria-atomic="true"
          aria-live="polite"
        >
          {dockStatus === "enabled" && (
            <p
              className="tray-space-warning__dock-result tray-space-warning__dock-result--success"
              data-testid="tray-space-warning-dock-success"
            >
              Ikona v Docku je zapnutá. LuDone teď najdeš i v Docku.
            </p>
          )}
        </div>

        {dockStatus === "error" && (
          <p
            className="tray-space-warning__dock-result tray-space-warning__dock-result--error"
            data-testid="tray-space-warning-dock-error"
            role="alert"
          >
            Ikonu v Docku se nepodařilo zapnout. Zkus to prosím znovu.
          </p>
        )}
      </div>

      <div
        className="tray-space-warning__solutions"
        role="group"
        aria-label="Jak ikonu zpřístupnit"
      >
        <p data-solution="close-other-item">
          Uvolni místo ukončením jiné aplikace, která má ikonu v horní liště.
        </p>
        <p data-solution="menu-bar-manager">
          Nebo použij správce lišty, který schované ikony zpřístupní.
        </p>
      </div>

      <p className="auth-error-panel__guidance">
        {dockStatus === "enabled" ? "Hotovo. " : ""}
        Tohle okno můžeš zavřít. LuDone zůstane spuštěné.
      </p>
    </main>
  );
}
