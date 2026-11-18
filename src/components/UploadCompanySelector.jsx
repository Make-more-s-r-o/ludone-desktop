import { useCallback, useEffect, useId, useRef, useState } from "react";

const COMPANY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

function hasControlCharacters(value) {
  return [...value].some((character) => {
    const code = character.codePointAt(0);
    return code <= 31 || code === 127;
  });
}

function validCompanies(value) {
  if (!Array.isArray(value) || value.length > 100) return null;
  const ids = new Set();
  const companies = [];
  for (const company of value) {
    if (!company || typeof company !== "object" || typeof company.id !== "string" || !COMPANY_ID_PATTERN.test(company.id)
      || typeof company.name !== "string" || company.name.length < 1 || company.name.length > 160
      || company.name.trim() !== company.name || hasControlCharacters(company.name)
      || ids.has(company.id)) return null;
    ids.add(company.id);
    companies.push({ id: company.id, name: company.name });
  }
  return companies;
}

function normalizeOffer(value) {
  const companies = validCompanies(value?.companies);
  if (!companies || typeof value?.offerToken !== "string"
    || value.offerToken.length < 16 || value.offerToken.length > 128) return null;
  const selectedCompanyId = value.selectedCompanyId ?? null;
  if (selectedCompanyId !== null && !companies.some(({ id }) => id === selectedCompanyId)) return null;
  return { companies, offerToken: value.offerToken, selectedCompanyId };
}

export function uploadCompanyErrorMessage(error) {
  const detail = `${typeof error?.code === "string" ? error.code : ""} ${typeof error?.message === "string" ? error.message : ""}`;
  if (/company_removed|company_unavailable/u.test(detail)) return "Firma už není dostupná pro tento účet.";
  if (/http_401|HTTP 401/u.test(detail)) return "Server odmítl přihlášení (HTTP 401). Přihlas se znovu.";
  if (/http_403|HTTP 403/u.test(detail)) return "Účet nemá oprávnění k nabídce firem (HTTP 403).";
  if (/http_429|HTTP 429/u.test(detail)) return "Server dočasně omezil počet požadavků (HTTP 429). Zkus to později.";
  if (/http_5\d\d|HTTP 5\d\d/u.test(detail)) return "Server teď nedokáže nabídku firem načíst. Zkus to později.";
  if (/invalid_context|context_changed|identity_changed/u.test(detail)) return "Přihlášení nebo identitu se nepodařilo ověřit. Zkontroluj přihlášení.";
  if (/offer_timeout|fetch failed|failed to fetch|network|offline|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ERR_(?:INTERNET_DISCONNECTED|CONNECTION_\w+)/iu.test(detail)) return "Nepodařilo se spojit se serverem. Zkontroluj síť a zkus to znovu.";
  if (/invalid_company_offer|invalid_offer/u.test(detail)) return "Server vrátil neplatnou nabídku firem.";
  if (/stale_offer|stale_snapshot/u.test(detail)) return "Přehled nebo nabídka mezitím zastaraly. Načti je znovu.";
  if (/bridge_unavailable/u.test(detail)) return "Načítání firem není v této aplikaci dostupné.";
  return "Důvod se nepodařilo zjistit. Zkus to znovu.";
}

export function UploadCompanySelector({ authState }) {
  const authenticated = authState?.state === "signed-in";
  const lastIdentity = useRef(null);
  const identityKey = authenticated
    ? `${authState.identity?.email ?? ""}:${authState.issuer ?? ""}`
    : authState?.state === "unknown" ? lastIdentity.current ?? "signed-out" : "signed-out";
  const generationRef = useRef(0);
  const previousRef = useRef(null);
  const [view, setView] = useState({ state: "idle" });
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    generationRef.current += 1;
    const previous = previousRef.current;
    previousRef.current = { identityKey, generation: authState?.generation, suspended: authState?.state === "unknown" };
    if (authenticated) lastIdentity.current = identityKey;
    else if (authState?.state !== "unknown") lastIdentity.current = null;
    if (authState?.state === "unknown") {
      setView({ state: "idle" });
      return () => { generationRef.current += 1; };
    }
    const interrupted = authenticated && (previous?.suspended || (previous?.identityKey === identityKey
      && previous.generation !== authState?.generation && viewRef.current.state !== "idle"));
    setView(authenticated && typeof window.ludone?.getUploadCompanyDefault === "function" ? { state: "loading" }
      : interrupted ? { state: "error", reason: "Přihlášení se změnilo. Načti firmy znovu." } : { state: "idle" });
    const generation = generationRef.current;
    if (authenticated && typeof window.ludone?.getUploadCompanyDefault === "function") {
      Promise.resolve().then(() => window.ludone.getUploadCompanyDefault()).then((value) => {
        if (generationRef.current !== generation) return;
        if (typeof value?.companyId === "string" && COMPANY_ID_PATTERN.test(value.companyId)) {
          setView({ state: "loading", storedCompanyId: value.companyId, storedCompanyName: value.companyName });
          void loadCompanies(value.companyId, value.companyName);
        } else setView(interrupted
          ? { state: "error", reason: "Přihlášení se změnilo. Načti firmy znovu." }
          : { state: "idle" });
      }).catch((error) => {
        if (generationRef.current === generation) setView({ state: "error", reason: uploadCompanyErrorMessage(error) });
      });
    }
    return () => { generationRef.current += 1; };
  }, [identityKey, authState?.generation, authState?.state]);

  async function loadCompanies(storedCompanyId = null, storedCompanyName = null) {
    if (!authenticated) return;
    if (typeof window.ludone?.listUploadCompanies !== "function") {
      setView({ state: "error", storedCompanyId, storedCompanyName, reason: uploadCompanyErrorMessage(new Error("bridge_unavailable")) });
      return;
    }
    const generation = ++generationRef.current;
    setView({ state: "loading", storedCompanyId, storedCompanyName });
    try {
      const offer = normalizeOffer(await window.ludone.listUploadCompanies());
      if (generationRef.current !== generation) return;
      if (!offer) throw new Error("invalid_offer");
      if (offer.companies.length === 0) {
        setView({ state: "no-company" });
        return;
      }
      setView({
        state: "ready",
        ...offer,
        choice: offer.selectedCompanyId ?? "",
        storedCompanyId: offer.selectedCompanyId,
        storedCompanyName: offer.selectedCompanyId === storedCompanyId ? storedCompanyName : null,
      });
    } catch (error) {
      if (generationRef.current === generation) setView({ state: "error", storedCompanyId, storedCompanyName, reason: uploadCompanyErrorMessage(error) });
    }
  }

  async function saveCompany() {
    if (!["ready", "saved", "save-error"].includes(view.state) || !COMPANY_ID_PATTERN.test(view.choice)) return;
    const generation = ++generationRef.current;
    const pending = view;
    setView({ ...pending, state: "saving" });
    try {
      let token = pending.offerToken;
      if (typeof window.ludone?.getUploadCompanyDefault === "function") {
        const offer = normalizeOffer(await window.ludone.listUploadCompanies());
        if (generationRef.current !== generation) return;
        if (!offer?.companies.some((company) => company.id === pending.choice)) throw new Error("company_unavailable");
        token = offer.offerToken;
      }
      const result = await window.ludone.selectUploadCompany(token, pending.choice);
      if (generationRef.current !== generation) return;
      if (result?.saved !== true || result.selectedCompanyId !== pending.choice) throw new Error("not_saved");
      setView({ ...pending, storedCompanyId: pending.choice,
        storedCompanyName: pending.companies.find(({ id }) => id === pending.choice)?.name,
        remembered: result.remembered !== false, state: "saved" });
    } catch (error) {
      if (generationRef.current === generation) setView({ ...pending, state: "save-error", reason: uploadCompanyErrorMessage(error) });
    }
  }

  if (!authenticated) {
    return (
      <div className="settings-row settings-row--static upload-company-selector upload-company-selector--signed-out">
        <div>
          <strong>Výchozí cílová firma</strong>
          <small>Po přihlášení ji vybereš v panelu LuDone.</small>
        </div>
        <select aria-label="Výchozí cílová firma" disabled value="">
          <option value="">Vyžaduje přihlášení</option>
        </select>
      </div>
    );
  }

  if (previousRef.current && (previousRef.current.identityKey !== identityKey || previousRef.current.suspended)) {
    return <div className="settings-group upload-company-selector" data-testid="upload-company-default">
      <h3>Výchozí firma pro nové nahrávky</h3><p role="status">Ověřuji uloženou firmu…</p>
    </div>;
  }

  return (
    <div className="settings-group upload-company-selector" data-testid="upload-company-default">
      <h3>Výchozí firma pro nové nahrávky</h3>
      <p>Výběr firmy sám nic neodešle.</p>
      {view.storedCompanyId && <p>Uložená výchozí firma: {view.companies?.find(({ id }) => id === view.storedCompanyId)?.name ?? view.storedCompanyName ?? view.storedCompanyId}</p>}
      {view.state === "idle" && (
        <button className="button button--small" type="button" onClick={() => void loadCompanies(view.storedCompanyId, view.storedCompanyName)}>Načíst firmy</button>
      )}
      {view.state === "loading" && <p role="status" data-testid="upload-company-state">Načítám firmy…</p>}
      {view.state === "error" && (
        <>
          <p role="alert" data-testid="upload-company-state">Firmy se nepodařilo načíst nebo uložit. {view.reason}{view.storedCompanyId ? " Uložená výchozí firma zůstává zachovaná; její název teď nelze ověřit." : ""}</p>
          <button className="button button--small" type="button" onClick={() => void loadCompanies(view.storedCompanyId, view.storedCompanyName)}>Načíst firmy</button>
        </>
      )}
      {view.state === "no-company" && (
        <>
          <p role="status" data-testid="upload-company-state">Pro tento účet není dostupná žádná firma.</p>
          <button className="button button--small" type="button" onClick={() => void loadCompanies(view.storedCompanyId, view.storedCompanyName)}>Načíst firmy</button>
        </>
      )}
      {(["ready", "saving", "saved", "save-error"].includes(view.state)) && (
        <>
          <label htmlFor="upload-company">Firma pro odesílání nahrávek</label>
          <select
            id="upload-company"
            data-testid="upload-company-select"
            disabled={view.state === "saving"}
            value={view.choice}
            onChange={(event) => setView({ ...view, state: "ready", choice: event.target.value })}
          >
            <option value="">Vyber firmu</option>
            {view.companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
          <button
            className="button button--small"
            data-testid="upload-company-save"
            disabled={view.state === "saving" || !view.choice}
            type="button"
            onClick={saveCompany}
          >
            {view.state === "saving" ? "Ukládám…" : (typeof window.ludone?.getUploadCompanyDefault === "function" ? "Uložit výchozí firmu" : "Uložit firmu")}
          </button>
        </>
      )}
      {view.state === "save-error" && <p role="alert" data-testid="upload-company-state">Firmu se nepodařilo uložit. {view.reason} Uložená volba zůstává zachovaná.</p>}
      {view.state === "ready" && <p role="status" data-testid="upload-company-state">{view.choice === view.storedCompanyId ? "Firma je uložená." : "Neuložená změna."}</p>}
      {view.state === "saved" && (
        <>
          <p role="status" data-testid="upload-company-state">{view.remembered === false
            ? "Firma je uložená pro toto přihlášení. Pro trvalé zapamatování je potřeba nové přihlášení."
            : "Firma je uložená."}</p>
          <button className="button button--small" type="button" onClick={() => void loadCompanies(view.storedCompanyId, view.storedCompanyName)}>Změnit firmu</button>
        </>
      )}
    </div>
  );
}

// Jedna nabídka patří konkrétnímu účtu; samotná editace nikdy neschvaluje upload.
export function RecordingUploadPreferences({ initialValue, defaultVisibility = "private", identityKey = "panel",
  disabled = false, busy = false, locked = false, refreshToken = 0, saveVersion = 0, onChange, onUserChange, onConflictChange, onAcceptStored, onSave, stateMessage, stateError = false, surface = "panel" }) {
  const id = useId();
  const generation = useRef(0);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const conflictRef = useRef(onConflictChange);
  conflictRef.current = onConflictChange;
  const lastSaveVersion = useRef(saveVersion);
  const initialCompany = initialValue?.companyId ?? "";
  const initialVisibility = initialValue?.visibility ?? defaultVisibility;
  const baseline = useRef({ choice: initialCompany, visibility: initialVisibility });
  const editBaseline = useRef({ choice: initialCompany, visibility: initialVisibility });
  const edited = useRef(false);
  const [view, setView] = useState(() => ({ state: "loading", choice: initialCompany,
    companies: initialCompany ? [{ id: initialCompany, name: initialValue?.companyName || `Uložená firma (${initialCompany})` }] : [],
    visibility: initialVisibility }));
  const viewRef = useRef(view);
  const setCurrent = useCallback((next) => { viewRef.current = next; setView(next); }, []);
  useEffect(() => {
    const previous = baseline.current;
    baseline.current = { choice: initialCompany, visibility: initialVisibility };
    if (!onSave || (previous.choice === initialCompany && previous.visibility === initialVisibility)) return;
    const current = viewRef.current;
    const conflict = Boolean(current.conflict || current.choice !== initialCompany || current.visibility !== initialVisibility);
    setCurrent({ ...current, conflict });
    conflictRef.current?.(conflict);
  }, [initialCompany, initialVisibility, onSave, setCurrent]);
  useEffect(() => {
    if (lastSaveVersion.current === saveVersion) return;
    lastSaveVersion.current = saveVersion;
    const current = viewRef.current;
    if (current.choice === initialCompany && current.visibility === initialVisibility) {
      editBaseline.current = { choice: initialCompany, visibility: initialVisibility };
      setCurrent({ ...current, conflict: false });
      conflictRef.current?.(false);
    }
  }, [saveVersion, initialCompany, initialVisibility, setCurrent]);
  const load = useCallback(async () => {
    const request = ++generation.current;
    let current = viewRef.current;
    let defaultReason = "";
    changeRef.current?.(null, undefined);
    setCurrent({ ...current, state: "loading", reason: "" });
    if (!current.choice && !edited.current && typeof window.ludone?.getUploadCompanyDefault === "function") {
      try {
        const saved = await window.ludone.getUploadCompanyDefault();
        if (request !== generation.current) return;
        if (typeof saved?.companyId === "string" && COMPANY_ID_PATTERN.test(saved.companyId)) {
          const savedName = validCompanies([{ id: saved.companyId, name: saved.companyName }])?.[0]?.name;
          current = { ...viewRef.current, choice: saved.companyId,
            companies: [{ id: saved.companyId, name: savedName ?? `Uložená firma (${saved.companyId})` }] };
          setCurrent({ ...current, state: "loading" });
        }
      } catch (error) {
        // Nabídka může být dostupná i tehdy, když se lokální předvolba nepřečte.
        defaultReason = uploadCompanyErrorMessage(error);
      }
    }
    if (request !== generation.current) return;
    if (disabled) {
      setCurrent({ ...viewRef.current, state: "error", reason: "Přihlášení není dostupné. Obnov přihlášení." });
      return;
    }
    try {
      if (typeof window.ludone?.listUploadCompanies !== "function") throw new Error("bridge_unavailable");
      const offer = normalizeOffer(await window.ludone.listUploadCompanies());
      if (request !== generation.current) return;
      if (!offer) throw new Error("invalid_offer");
      current = viewRef.current;
      const choice = current.choice || (!edited.current ? offer.selectedCompanyId ?? "" : "");
      if (choice && !offer.companies.some((company) => company.id === choice)) {
        const known = current.companies.find((company) => company.id === choice)
          ?? { id: choice, name: `Uložená firma (${choice})` };
        setCurrent({ ...offer, choice, visibility: current.visibility, conflict: current.conflict, state: "ready",
          companies: [known, ...offer.companies], availableCompanyIds: offer.companies.map(({ id }) => id),
          unavailable: true });
        return;
      }
      if (!edited.current && !baseline.current.choice) editBaseline.current = { choice, visibility: current.visibility };
      setCurrent({ ...offer, choice, visibility: current.visibility, conflict: current.conflict, defaultReason, state: "ready" });
      changeRef.current?.(choice ? { companyId: choice, offerToken: offer.offerToken, visibility: current.visibility } : null, undefined);
    } catch (error) {
      if (request !== generation.current) return;
      setCurrent({ ...viewRef.current, state: "error", reason: uploadCompanyErrorMessage(error) });
    }
  }, [disabled, setCurrent]);
  useEffect(() => {
    if (locked) {
      generation.current += 1;
      changeRef.current?.(null, undefined);
      return;
    }
    void load();
    const unsubscribe = window.ludone?.onAuthSessionChanged?.(() => {
      generation.current += 1;
      changeRef.current?.(null, viewRef.current.state === "loading" && !viewRef.current.choice ? true : undefined);
      setCurrent({ ...viewRef.current, state: "error", reason: "Přihlášení se změnilo. Načti firmy znovu." });
    });
    return () => { generation.current += 1; unsubscribe?.(); };
  }, [load, locked, identityKey, refreshToken, setCurrent]);
  const update = (choice, visibility) => {
    edited.current = true;
    const dirty = choice !== editBaseline.current.choice || visibility !== editBaseline.current.visibility;
    const unavailable = Boolean(choice && view.availableCompanyIds && !view.availableCompanyIds.includes(choice));
    setCurrent({ ...viewRef.current, choice, visibility, unavailable });
    changeRef.current?.(choice && !unavailable ? { companyId: choice, offerToken: view.offerToken, visibility } : null, dirty);
    onUserChange?.(dirty);
  };
  const acceptStored = () => {
    const { choice, visibility } = baseline.current;
    const current = viewRef.current;
    const companies = choice && !current.companies.some((company) => company.id === choice)
      ? [...current.companies, { id: choice, name: initialValue?.companyName || `Uložená firma (${choice})` }]
      : current.companies;
    const available = current.availableCompanyIds ?? current.companies.map((company) => company.id);
    const unavailable = Boolean(choice && !available.includes(choice));
    edited.current = false;
    editBaseline.current = { choice, visibility };
    setCurrent({ ...current, choice, visibility, companies, unavailable, conflict: false });
    changeRef.current?.(choice && !unavailable && current.state === "ready"
      ? { companyId: choice, offerToken: current.offerToken, visibility } : null, false);
    onUserChange?.(false);
    conflictRef.current?.(false);
    if (choice && !unavailable && current.state === "ready") onAcceptStored?.();
  };
  return (
    <div className="recording-upload-preferences" data-testid="recording-upload-preferences" data-surface={surface}>
      {locked ? <p role="status">Firma a přístup jsou zamčené, protože odesílání už začalo.</p> : <>
        <label htmlFor={`${id}-company`}>Cílová firma</label>
        <select id={`${id}-company`} data-testid="recording-upload-company" value={view.choice}
          disabled={disabled || busy || view.state !== "ready"} onChange={(event) => update(event.target.value, view.visibility)}>
          <option value="">{view.state === "loading" ? "Načítám firmy…" : "Vyber firmu"}</option>
          {view.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
        <label htmlFor={`${id}-visibility`}>Přístup k nahrávce</label>
        <select id={`${id}-visibility`} data-testid="recording-upload-visibility" value={view.visibility}
          disabled={disabled || busy || view.state !== "ready"} onChange={(event) => update(view.choice, event.target.value)}>
          <option value="private">Soukromá</option><option value="company">Sdílená ve firmě</option>
        </select>
        <small>Přístup se řídí oprávněními v LuDone. Tyto volby nemění výchozí firmu účtu.</small>
        {view.conflict && <><p role="alert">Volby se mezitím změnily jinde. Ulož viditelné volby, nebo převezmi nové uložené volby.</p>
          <button type="button" className="button button--small" disabled={disabled || busy} onClick={acceptStored}>Převzít nové volby</button></>}
        {view.state === "error" && <><p role="alert">Firmy nelze ověřit. {view.reason} Před odesláním je načti znovu.</p>
          <button type="button" className="button button--small" disabled={disabled || busy} onClick={() => void load()}>Načíst firmy</button></>}
        {view.unavailable && <p role="alert">Zvolenou firmu nelze ověřit. Není v nabídce pro tento účet; vyber jinou firmu.</p>}
        {view.state === "ready" && view.companies.length === 0 && <p role="status">Pro tento účet není dostupná žádná firma.</p>}
        {view.state === "ready" && !view.choice && <p role="status">Vyber cílovou firmu. Výchozí firmu se nepodařilo určit.{view.defaultReason ? ` ${view.defaultReason}` : ""}</p>}
        {onSave && <button type="button" className="button button--small" data-testid="recording-upload-preferences-save"
          disabled={disabled || busy || view.state !== "ready" || !view.choice || view.unavailable} onClick={onSave}>Uložit volby</button>}
      </>}
      <p role={stateError ? "alert" : "status"} data-testid="recording-upload-preferences-state">{stateMessage ?? (locked ? "Volby nelze měnit během odesílání." : view.state === "loading" ? "Načítám volby…" : onSave ? "Uložení voleb samo nic neodešle." : "Volby se uloží spolu s nahrávkou.")}</p>
    </div>
  );
}

// Před explicitním zápisem obnovíme krátkodobou nabídku, nikoli uživatelovu volbu.
export async function freshRecordingUploadPreferences(choice) {
  const offer = normalizeOffer(await window.ludone.listUploadCompanies());
  if (!choice || !offer?.companies.some((company) => company.id === choice.companyId)
    || !["private", "company"].includes(choice.visibility)) throw new Error("company_unavailable");
  return { companyId: choice.companyId, offerToken: offer.offerToken, visibility: choice.visibility };
}
