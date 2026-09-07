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
  konfigurace: {
    // Text říká pravdu (opakování to nespraví, spraví to správce), ale akce ZŮSTÁVÁ:
    // tahle obrazovka se vrací místo celého panelu, takže bez tlačítka je z ní slepá
    // ulička — a tu už tenhle repozitář jednou vyrobil (PR #51/#52).
    action: "Zkusit znovu",
    actionKind: "retry",
    // Bez tónu vznikne třída `--undefined`, kterou styly neznají; `quiet` je tu
    // navíc pravdivější — opakování příčinu nespraví, jen odsud vede ven.
    actionTone: "quiet",
    state: "configuration",
    title: "Chyba nastavení aplikace",
    message: "Přihlášení blokuje neplatné nastavení aplikace.",
    guidance: "Obrať se na správce aplikace; opakování přihlášení to samo nespraví.",
    icon: AccessDeniedIcon,
    iconTone: "bad",
  },
  uloziste: {
    // Stejně jako u konfigurace zůstává akce cestou ven po nápravě příčiny.
    state: "storage",
    title: "Přihlašovací údaje nejde bezpečně uložit",
    message: "Systémové úložiště není dostupné. Přihlašovací údaje se neuložily.",
    guidance: "Odemkni Klíčenku nebo se obrať na správce aplikace. Samotné opakování přihlášení nepomůže.",
    action: "Zkusit znovu",
    actionKind: "retry",
    actionTone: "quiet",
    icon: AccessDeniedIcon,
    iconTone: "bad",
  },
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
  "relace-vyprsela": {
    // `vyprselo` znamená timeout čekání na prohlížeč. Uložená relace vyprší
    // i bez otevřeného prohlížeče, proto potřebuje vlastní vysvětlení.
    state: "session-expired",
    title: "Přihlášení vypršelo",
    message: "Platnost přihlášení skončila. Pro odesílání nahrávek se přihlas znovu.",
    action: "Přihlásit se znovu",
    actionKind: "retry",
    actionTone: "primary",
    icon: TimerIcon,
    iconTone: "wait",
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

export function AuthErrorScreen({ busy, onRetry, reason, embedded = false }) {
  const failure = FAILURES[reason] || GENERIC_FAILURE;
  const Icon = failure.icon;
  const Container = embedded ? "section" : "main";

  return (
    <Container
      className={embedded ? "auth-error-panel auth-error-panel--embedded" : "panel window-surface auth-error-panel"}
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

      {failure.action && <button
        type="button"
        className={`button auth-error-panel__action auth-error-panel__action--${failure.actionTone}`}
        data-testid="auth-error-action"
        data-auth-error-action-kind={failure.actionKind}
        disabled={busy}
        onClick={onRetry}
        autoFocus
      >
        {busy ? "Čekám na prohlížeč…" : failure.action}
      </button>}

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
    </Container>
  );
}
