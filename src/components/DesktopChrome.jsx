import { useEffect, useRef, useState } from "react";
import {
  AccessDeniedIcon,
  CloseIcon,
  KeyboardIcon,
  LuDoneGlyph,
  OfflineIcon,
  UserIcon,
  WaitingIcon,
} from "./Icons.jsx";
import { ApplicationVersion } from "./ApplicationUpdateStatus.jsx";
import luDoneMark from "../assets/LuDone.svg";

function currentTime() {
  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function useOnlineState() {
  const [online, setOnline] = useState(() => window.navigator?.onLine !== false);
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  return online;
}

export function DesktopMenubar({ status = "Připojeno", authState = "unknown", accountLabel = "" }) {
  const [time, setTime] = useState(currentTime);
  const online = useOnlineState();

  useEffect(() => {
    const interval = window.setInterval(() => setTime(currentTime()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="desktop-menubar" aria-label="Stav aplikace">
      <img className="panel-brand-mark sr-only" src={luDoneMark} alt="" />
      <span className="desktop-menubar__name">LuDone Desktop</span>
      <small className="sr-only" data-auth-state={authState}>{accountLabel}</small>
      <span className="sr-only"><ApplicationVersion withBuildDate={false} /></span>
      <span className="desktop-menubar__status" role="status"
        aria-label={online ? status : `${status} · Bez připojení`}
        title={online ? status : `${status} · Bez připojení`}>
        {!online ? <OfflineIcon />
          : authState === "signed-in" ? <UserIcon />
          : authState === "expired" ? <AccessDeniedIcon />
            : authState === "checking" || authState === "unknown" ? <WaitingIcon />
              : <OfflineIcon />}
        <span className="sr-only">{online ? status : `${status} · Bez připojení`}</span>
      </span>
      <time className="desktop-menubar__time">{time}</time>
    </div>
  );
}

export function DesktopConnectivityNotice() {
  const online = useOnlineState();
  if (online) return null;
  return (
    <div className="desktop-connectivity-notice" role="status" data-testid="offline-notice">
      <strong>Bez připojení. Nahrávky zůstávají na Macu.</strong>
      <span>Synchronizace a odesílání počkají.</span>
    </div>
  );
}

export function DesktopQuickActions({ actions = [] }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector("button:not(:disabled)")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const runAction = (action) => {
    dialogRef.current?.close();
    setOpen(false);
    action.onSelect();
  };

  return (
    <>
      <button
        type="button"
        className="desktop-titlebar__quick-actions"
        aria-label="Rychlé akce (⌘K)"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <KeyboardIcon />
      </button>
      <dialog
        ref={dialogRef}
        className="desktop-quick-actions"
        aria-labelledby="desktop-quick-actions-title"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            dialogRef.current.close();
            setOpen(false);
          }
        }}
      >
        <div className="desktop-quick-actions__heading">
          <div>
            <p className="eyebrow">LuDone Desktop</p>
            <h2 id="desktop-quick-actions-title">Rychlé akce</h2>
          </div>
          <kbd>⌘ K</kbd>
        </div>
        <div className="desktop-quick-actions__items">
          {actions.map((action) => (
            <button
              type="button"
              className="desktop-quick-actions__item"
              key={action.id}
              disabled={action.disabled}
              onClick={() => runAction(action)}
            >
              <span className="desktop-quick-actions__icon" aria-hidden="true">{action.icon}</span>
              <span className="desktop-quick-actions__copy">
                <strong>{action.label}</strong>
                {action.description && <small>{action.description}</small>}
              </span>
              {action.shortcut && <kbd>{action.shortcut}</kbd>}
            </button>
          ))}
        </div>
        <div className="desktop-quick-actions__footer">Esc · Zavřít</div>
      </dialog>
    </>
  );
}

export function DesktopTitlebar({ onClose, closeLabel = "Zavřít panel", quickActions = [] }) {
  return (
    <div className="desktop-titlebar" aria-label="LuDone">
      <div className="desktop-titlebar__controls">
        {onClose ? (
          <button type="button" className="desktop-titlebar__close" aria-label={closeLabel} onClick={onClose}>
            <CloseIcon />
          </button>
        ) : (
          <span className="desktop-titlebar__close desktop-titlebar__close--inactive" />
        )}
        <span className="desktop-titlebar__light" />
        <span className="desktop-titlebar__light" />
      </div>
      <div className="desktop-titlebar__brand">
        <LuDoneGlyph />
        <span>LuDone</span>
      </div>
      <div className="desktop-titlebar__end">
        <DesktopQuickActions actions={quickActions} />
      </div>
    </div>
  );
}
