import { LuDoneMark } from "../Icons.jsx";

import { OsaIcon } from "./OsaIcon.jsx";

const pages = [
  ["home", "Nahrávání", "record"],
  ["library", "Nahrávky", "library"],
  ["queue", "Odesílání", "cloud"],
  ["settings", "Nastavení", "settings"],
  ["updates", "Aktualizace", "update"],
];

// Stav i čas přicházejí z řídicího procesu; shell je pouze zobrazuje.
export function OsaShell({ page = "home", onNavigate, recording, queueCount = 0, children, onClose }) {
  const activePage = page === "detail" ? "library" : page;
  const title = pages.find(([key]) => key === activePage)?.[1] ?? "LuDone Desktop";
  return <main className={`osa-shell osa-shell--${page}`} data-osa-page={page} data-osa-recording={recording?.active ? "true" : "false"}>
    <header className="osa-header">
      <div className="osa-brand"><LuDoneMark size={26} /><strong>LuDone</strong><span>Desktop</span></div>
      {onClose && <button type="button" className="osa-icon-button" aria-label="Zavřít panel" onClick={onClose}><OsaIcon name="close" /></button>}
    </header>
    <div className="osa-body">
      {page !== "onboarding" && page !== "detail" && <nav className="osa-rail" aria-label="Části LuDone">
        {pages.map(([key, label, icon]) => <button type="button" key={key} data-page={key}
          className={key === "settings" ? "osa-rail__low" : undefined}
          aria-current={activePage === key ? "page" : undefined}
          aria-label={key === "queue" && queueCount ? `${label}, čeká ${queueCount}` : label}
          title={label} onClick={() => onNavigate?.(key)}>
          <OsaIcon name={icon} />{key === "queue" && queueCount > 0 && <span className="osa-count" aria-hidden="true">{queueCount}</span>}
        </button>)}
      </nav>}
      <div className="osa-workspace">
        {recording?.active && page !== "home" && <div className="osa-live-strip" role="status">
          <span className="osa-live-dot" aria-hidden="true" /><span>{recording.label ?? "Nahrává se"}</span>
          <strong>{recording.elapsed}</strong>
          <button type="button" onClick={recording.onStop} disabled={!recording.onStop}>Zastavit</button>
        </div>}
        {page !== "home" && page !== "detail" && page !== "onboarding" && <h1 className="osa-page-title">{title}</h1>}
        <div className="osa-content">{children}</div>
      </div>
    </div>
  </main>;
}
