const CLAIMED_HOLD = "Převzatá nahrávka čeká na volbu odeslání";

const REASONS = new Map([
  ["unauthorized", ["server odmítl odeslání", "retry"]],
  ["unauthorized (HTTP 401)", ["server odmítl odeslání", "retry"]],
  ["Odeslání čeká na nové přihlášení.", ["server odmítl odeslání", "retry"]],
  ["Server odmítl odeslání.", ["server odmítl odeslání", "retry"]],
  ["insufficient_scope", ["přihlášení nemá oprávnění k odeslání", "login"]],
  ["insufficient_scope (HTTP 403)", ["přihlášení nemá oprávnění k odeslání", "login"]],
  ["Přihlášení nemá oprávnění k odeslání.", ["přihlášení nemá oprávnění k odeslání", "login"]],
  ["session_owner_unknown", ["identitu přihlášení nelze ověřit", "login"]],
  ["Identitu aktuálního přihlášení nelze ověřit", ["identitu přihlášení nelze ověřit", "login"]],
  ["Pro upload chybí přihlášení", ["chybí přihlášení", "login"]],
  ["Přihlášení pro upload nelze načíst", ["přihlášení nelze ověřit", "login"]],
  ["Přihlášení nelze ověřit.", ["přihlášení nelze ověřit", "login"]],
  ["Pro odeslání chybí přihlášení.", ["chybí přihlášení", "login"]],
  ["Přihlášení patří jinému serveru", ["přihlášení patří jinému serveru", "login"]],
  ["company_not_chosen", ["chybí vybraná firma", "company"]],
  ["Není vybraná firma, pod kterou se má nahrávka odeslat", ["chybí vybraná firma", "company"]],
  ["Pro upload chybí identifikátor firmy", ["chybí vybraná firma", "company"]],
  ["Před odesláním je potřeba vybrat firmu.", ["chybí vybraná firma", "company"]],
  ["company_binding_missing", ["u nahrávky nelze určit firmu", "company"]],
  ["Rozpracovaná nahrávka nemá bezpečně uloženou firmu; otevřete Nastavení", ["u nahrávky nelze určit firmu", "company"]],
  ["Uložená firma nahrávky není platná", ["u nahrávky nelze určit firmu", "company"]],
  ["U této rozpracované nahrávky nelze bezpečně určit firmu. Otevřete Nastavení.", ["u nahrávky nelze určit firmu", "company"]],
  ["company_out_of_scope", ["vybraná firma nahrávku nepřijala", "company"]],
  ["company_out_of_scope (HTTP 403)", ["vybraná firma nahrávku nepřijala", "company"]],
  ["403 company_out_of_scope", ["vybraná firma nahrávku nepřijala", "company"]],
  ["Vybraná firma nahrávku nepřijala. Vyberte jinou firmu v části Účet v Nastavení.", ["vybraná firma nahrávku nepřijala", "company"]],
  ["network_error", ["server není dostupný", "retry"]],
  ["Síťový požadavek uploadu vypršel", ["spojení se serverem se nepodařilo", "retry"]],
  ["Spojení se serverem se nepodařilo.", ["spojení se serverem se nepodařilo", "retry"]],
  ["Úložiště serveru je dočasně vypnuté.", ["úložiště serveru je dočasně vypnuté", "retry"]],
  ["Na serveru není dostatek místa pro nahrávku.", ["na serveru není dostatek místa", "retry"]],
  ["Serverovou relaci nahrávky nelze najít.", ["serverovou relaci nahrávky nelze najít", "retry"]],
  ["Seznam firem se nepodařilo získat; zkontrolujte přihlášení a spojení", ["seznam firem není dostupný", "retry"]],
  ["Seznam firem není dostupný.", ["seznam firem není dostupný", "retry"]],
  ["Server není dostupný.", ["server není dostupný", "retry"]],
  ["Nahrávka patří jinému účtu", ["nahrávka patří jinému účtu", "claim"]],
  ["Vlastník nahrávky není potvrzený; před odesláním je nutné potvrzení člověkem", ["vlastník nahrávky není potvrzený", "claim"]],
  ["Nahrávka čeká na potvrzení vlastnictví.", ["vlastník nahrávky není potvrzený", "claim"]],
  ["Nedokončenou obnovenou nahrávku nelze bezpečně převést na stereo WebM", ["nahrávka nebyla dokončena", "retry"]],
  ["Nedokončenou nahrávku nelze bezpečně převést na stereo WebM", ["nahrávka nebyla dokončena", "retry"]],
  ["Nahrávka nebyla dokončena a nelze ji bezpečně převést na stereo WebM.", ["nahrávka nebyla dokončena", "retry"]],
  ["WebM po možném zahájení uploadu chybí; nesmí se znovu vytvořit s jinými bajty", ["připravený zvukový soubor chybí", "retry"]],
  ["WebM po možném zahájení odeslání chybí. Nahrávka je pozastavená, aby se nezměnila její identita.", ["připravený zvukový soubor chybí", "retry"]],
  ["Uložený WebM neodpovídá neměnné identitě připravené před uploadem", ["připravený zvukový soubor se změnil", "retry"]],
  ["Uložený WebM se změnil proti souboru připravenému před odesláním.", ["připravený zvukový soubor se změnil", "retry"]],
  ["Připravenému souboru chybí trvalá identita v sidecaru", ["soubor nelze bezpečně ověřit", "retry"]],
  ["Připravenému souboru chybí ověřitelná identita. Odeslání je bezpečně pozastavené.", ["soubor nelze bezpečně ověřit", "retry"]],
  ["Delivery sidecar neodpovídá neměnné identitě této nahrávky", ["soubor nelze bezpečně ověřit", "retry"]],
  ["Uložená identita souboru nesouhlasí s nahrávkou. Odeslání je bezpečně pozastavené.", ["soubor nelze bezpečně ověřit", "retry"]],
  ["Ready delivery sidecar změnil neměnnou identitu WebM", ["soubor nelze bezpečně ověřit", "retry"]],
  ["Uložená identita připraveného souboru se změnila. Odeslání je bezpečně pozastavené.", ["soubor nelze bezpečně ověřit", "retry"]],
  ["Rozpracovaný WebM nelze bezpečně nahradit", ["soubor nelze bezpečně obnovit", "retry"]],
  ["Rozpracovaný soubor nelze bezpečně obnovit; původní stopy zůstávají uložené.", ["soubor nelze bezpečně obnovit", "retry"]],
  ["Starší nahrávka mohla být na serveru už založena; automatický převod by vytvořil další záznam", ["nahrávka už mohla být odeslána", "retry"]],
  ["Starší nahrávka mohla být na serveru už založena. Automatické odeslání je pozastavené, aby nevznikl duplicitní záznam.", ["nahrávka už mohla být odeslána", "retry"]],
  ["Stereo master se před převodem změnil", ["zdrojový zvukový soubor se změnil", "retry"]],
  ["Stereo master se před převodem změnil; originály zůstávají uložené.", ["zdrojový zvukový soubor se změnil", "retry"]],
]);

const LOCAL_REASONS = Object.freeze({
  incomplete: "nahrávka není dokončená",
  "partial-audio": "část zvuku chybí",
  "missing-audio": "zvukové soubory chybí",
  "invalid-manifest": "data nahrávky jsou poškozená",
  unreadable: "data nahrávky nelze přečíst",
});

const ACTION_LABELS = Object.freeze({ send: "Odeslat", retry: "Zkusit znovu", claim: "Převzít nahrávku", login: "Přihlásit se", company: "Vybrat firmu" });

function permitted(item, action) {
  const key = `can${action[0].toUpperCase()}${action.slice(1)}`;
  return item[key] === true || item.allowedActions?.[action] === true;
}

function actionFor(item, type) {
  if (!type) return null;
  if (["send", "retry", "claim"].includes(type) && !permitted(item, type)) return null;
  if (type === "company" && item.ownership !== "current") return null;
  return { type, label: ACTION_LABELS[type] };
}

function disabledReason(item, context) {
  if (item.recordingInProgress) return "Počkej na dokončení nahrávání.";
  if (item.sendingDisabledReason || context.sendingDisabled) return "Odesílání je vypnuté.";
  if (context.busy) return "Probíhá jiná akce. Počkej na její dokončení.";
  if (context.missingRevision) return "Obnov přehled; nahrávku teď nelze bezpečně ověřit.";
  if (context.preferenceConflict) return "Volby se změnily jinde. Ulož viditelné volby nebo převezmi uložené.";
  if (context.preferenceFailed) return "Uložení voleb se nepodařilo ověřit. Ulož volby znovu.";
  if (context.preferenceDirty || context.preferencesMismatch) return "Ulož změněné volby firmy a přístupu.";
  return null;
}

/**
 * Prezentační stav nepovoluje ani nespouští žádnou operaci s nahrávkou.
 * @param {any} item
 * @param {{verified?: boolean, authState?: string, busy?: boolean, missingRevision?: boolean,
 *   preferenceDirty?: boolean, preferenceConflict?: boolean, preferencesMismatch?: boolean,
 *   preferenceFailed?: boolean, sendingDisabled?: boolean, incompleteSnapshot?: boolean}} [context]
 */
export function recordingDeliveryStatus(item, context = {}) {
  const disabled = disabledReason(item, context);
  const result = (tone, label, reason = null, type = null) => ({
    tone, label, reason, action: actionFor(item, type), disabledReason: disabled,
  });
  if (item.recordingInProgress) return result("waiting", "Nahrává se");
  if (context.incompleteSnapshot) return result("unknown", "Stav odeslání zjistíš v historii");
  if (context.verified) return result("sent", "V LuDone ✓");
  if (item.state === "odeslano") return result("sent", "Odesláno");

  const localReason = Object.hasOwn(LOCAL_REASONS, item.localState) ? LOCAL_REASONS[item.localState] : null;
  const heldAfterClaim = item.state === "ceka" && item.uploadIntent === "held"
    && !["other", "unknown"].includes(item.ownership) && item.blockReason === CLAIMED_HOLD;
  const signedOut = context.authState === "expired" || context.authState === "signed-out";
  const healthyHeld = item.state === "ceka" && item.uploadIntent === "held"
    && (heldAfterClaim || (!item.requiresHumanAction && !item.blockReason));
  if (item.source === "orphan" && !localReason) return result("local", "Jen na Macu");
  if (healthyHeld && !localReason) {
    const type = signedOut ? "login" : ["other", "unknown"].includes(item.ownership) ? "claim" : "send";
    return result("local", "Jen na Macu", heldAfterClaim ? CLAIMED_HOLD : null, type);
  }

  let reason = null;
  let type = null;
  if (signedOut) {
    reason = context.authState === "expired" ? "přihlášení vypršelo" : "nejsi přihlášený";
    type = "login";
  } else if (item.source !== "orphan" && ["ceka", "selhalo"].includes(item.state)
    && ["unknown", "other"].includes(item.ownership)) {
    reason = item.ownership === "other" ? "nahrávka patří jinému účtu" : "vlastník nahrávky není potvrzený";
    type = "claim";
  } else if (!heldAfterClaim && (item.state === "selhalo" || item.requiresHumanAction || item.blockReason)) {
    const raw = item.blockReason || item.lastFailureReason;
    const mapped = REASONS.get(raw) ?? (/^queue_owner_[a-z0-9-]+$/u.test(raw ?? "")
      ? ["vlastník nahrávky není potvrzený", "claim"] : ["důvod nezjištěn", "retry"]);
    [reason, type] = mapped;
    if (type === "claim" && !permitted(item, "claim") && permitted(item, "retry")) type = "retry";
  } else if (item.uploadIntent === "approved" && (item.sendingDisabledReason || context.sendingDisabled)) {
    reason = "odesílání je vypnuté";
  }
  if (localReason || reason) {
    const details = [localReason, reason].filter(Boolean).join(" · ");
    return result("attention", `${item.source === "orphan" ? "Problém" : "Neodešlo"} — ${details}`, details,
      type ?? (localReason && !reason ? (permitted(item, "claim") ? "claim" : "retry") : null));
  }
  if (!item.state) {
    return result("local", "Jen na Macu", heldAfterClaim ? CLAIMED_HOLD : null, "send");
  }
  if (item.state === "odesila") return result("waiting", "Odesílá se…");
  if (item.state === "ceka") {
    const time = Number.isSafeInteger(item.nextAttemptAt) && item.nextAttemptAt > 0 ? new Date(item.nextAttemptAt) : null;
    const next = time && Number.isFinite(time.getTime())
      ? ` · další pokus v ${new Intl.DateTimeFormat("cs-CZ", { hour: "2-digit", minute: "2-digit" }).format(time)}` : "";
    return result("waiting", `Čeká na odeslání${next}`);
  }
  return result("attention", "Stav odeslání není známý");
}
