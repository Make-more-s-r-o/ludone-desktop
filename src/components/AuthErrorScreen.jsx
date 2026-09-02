import { AccessDeniedIcon, OfflineIcon, TimerIcon } from "./Icons.jsx";

const GENERIC_FAILURE = {
  state: "generic",
  title: "Přihlášení se nepodařilo",
  message: "Přihlášení se nepodařilo dokončit. Zkus to prosím znovu.",
  action: "Zkusit znovu",
  actionKind: "retry",
  actionTone: "primary",
  icon: AccessDeniedIcon,
  iconTone: "bad",
};

const FAILURES = {
  vyprselo: {
    state: "expired",
    title: "Přihlášení vypršelo",
    message: "Okno v prohlížeči zůstalo moc dlouho otevřené.",
    action: "Zkusit znovu",
    actionKind: "retry",
    actionTone: "primary",
    icon: TimerIcon,
    iconTone: "wait",
    details: [
      "okno se otevřelo na druhé ploše",
      "jsi v prohlížeči pod jiným účtem",
      "účet nemá v LuDone povolený přístup",
    ],
  },
  odmitnuto: {
    state: "access",
    title: "Účet nemá přístup",
    message: "Přihlášení proběhlo, ale práva chybí.",
    action: "Přihlásit jiným účtem",
    actionKind: "switch-account",
    actionTone: "quiet",
    icon: AccessDeniedIcon,
    iconTone: "bad",
    guidance: "Napiš správci, ať ti přístup povolí.",
  },
  "bez-site": {
    state: "offline",
    title: "Nejsi připojený",
    message: "Přihlásit se teď nejde.",
    action: "Zkusit znovu",
    actionKind: "retry",
    actionTone: "quiet",
    icon: OfflineIcon,
    iconTone: "wait",
    offline: true,
  },
};

export function AuthErrorScreen({ busy, onRetry, reason }) {
  const failure = FAILURES[reason] || GENERIC_FAILURE;
  const Icon = failure.icon;

  return (
    <main
      className="panel window-surface auth-error-panel"
      data-testid="auth-error-screen"
      data-auth-error-reason={reason}
      data-auth-error-state={failure.state}
      aria-labelledby="auth-error-title"
    >
      <div
        className="auth-error-panel__announcement"
        data-testid="auth-error-announcement"
        role="alert"
      >
        <div className="auth-error-panel__heading">
          <span className={`auth-error-panel__icon auth-error-panel__icon--${failure.iconTone}`}>
            {failure.state === "expired" ? <Icon variant="idle" /> : <Icon />}
          </span>
          <h1 id="auth-error-title">{failure.title}</h1>
        </div>

        <p className="auth-error-panel__message" data-testid="auth-error-message">
          {failure.message}
          {failure.offline && (
            <>
              {" "}
              <strong data-testid="auth-offline-continuity">
                Nahrávat a měřit čas můžeš dál
              </strong>
              {" — uloží se to na disk a odešle později."}
            </>
          )}
        </p>
      </div>

      <button
        type="button"
        className={`button auth-error-panel__action auth-error-panel__action--${failure.actionTone}`}
        data-testid="auth-error-action"
        data-auth-error-action-kind={failure.actionKind}
        disabled={busy}
        onClick={onRetry}
        autoFocus
      >
        {busy ? "Čekám na prohlížeč…" : failure.action}
      </button>

      {failure.details && (
        <div className="auth-error-panel__details" data-testid="auth-error-details">
          <h2>Co se mohlo stát</h2>
          <ul>
            {failure.details.map((detail) => <li key={detail}>{detail}</li>)}
          </ul>
        </div>
      )}

      {failure.guidance && (
        <p className="auth-error-panel__guidance" data-testid="auth-admin-guidance">
          {failure.guidance}
        </p>
      )}
    </main>
  );
}
