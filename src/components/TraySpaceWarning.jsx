import { LuDoneMark } from "./Icons.jsx";

export function TraySpaceWarning() {
  return (
    <main
      className="panel window-surface auth-error-panel tray-space-warning"
      data-testid="tray-space-warning"
      role="status"
      aria-live="polite"
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
        Tohle okno můžeš zavřít. LuDone zůstane spuštěné.
      </p>
    </main>
  );
}
