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
    if (!company || typeof company !== "object" || !COMPANY_ID_PATTERN.test(company.id ?? "")
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

export function UploadCompanySelector({ authState }) {
  const authenticated = authState?.state === "signed-in";
  const identityKey = authenticated
    ? `${authState.generation ?? ""}:${authState.identity?.email ?? ""}:${authState.issuer ?? ""}`
    : "signed-out";
  const generationRef = useRef(0);
  const [view, setView] = useState({ state: "idle" });

  useEffect(() => {
    generationRef.current += 1;
    setView({ state: "idle" });
    const generation = generationRef.current;
    if (authenticated && typeof window.ludone?.getUploadCompanyDefault === "function") {
      Promise.resolve(window.ludone.getUploadCompanyDefault()).then((value) => {
        if (generationRef.current !== generation) return;
        if (COMPANY_ID_PATTERN.test(value?.companyId ?? "")) {
          setView({ state: "loading", storedCompanyId: value.companyId });
          void loadCompanies(value.companyId);
        }
      }).catch(() => {
        if (generationRef.current === generation) setView({ state: "error" });
      });
    }
    return () => { generationRef.current += 1; };
  }, [identityKey]);

  async function loadCompanies(storedCompanyId = null) {
    if (!authenticated || typeof window.ludone?.listUploadCompanies !== "function") return;
    const generation = ++generationRef.current;
    setView({ state: "loading", storedCompanyId });
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
      });
    } catch {
      if (generationRef.current === generation) setView({ state: "error", storedCompanyId });
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
      setView({ ...pending, storedCompanyId: pending.choice, state: "saved" });
    } catch {
      if (generationRef.current === generation) setView({ ...pending, state: "save-error" });
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

  return (
    <div className="settings-group upload-company-selector" data-testid="upload-company-default">
      <p>Výběr firmy sám nic neodešle.</p>
      {view.state === "idle" && (
        <button className="button button--small" type="button" onClick={() => void loadCompanies(view.storedCompanyId)}>Načíst firmy</button>
      )}
      {view.state === "loading" && <p role="status" data-testid="upload-company-state">Načítám firmy…</p>}
      {view.state === "error" && (
        <>
          <p role="alert" data-testid="upload-company-state">Firmy se nepodařilo načíst nebo uložit.{view.storedCompanyId ? " Uložená výchozí firma zůstává zachovaná; její název teď nelze ověřit." : ""}</p>
          <button className="button button--small" type="button" onClick={() => void loadCompanies(view.storedCompanyId)}>Načíst firmy</button>
        </>
      )}
      {view.state === "no-company" && (
        <>
          <p role="status" data-testid="upload-company-state">Pro tento účet není dostupná žádná firma.</p>
          <button className="button button--small" type="button" onClick={() => void loadCompanies(view.storedCompanyId)}>Načíst firmy</button>
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
      {view.state === "save-error" && <p role="alert" data-testid="upload-company-state">Firmu se nepodařilo uložit. Uložená volba zůstává zachovaná.</p>}
      {view.state === "ready" && <p role="status" data-testid="upload-company-state">{view.choice === view.storedCompanyId ? "Firma je uložená." : "Neuložená změna."}</p>}
      {view.state === "saved" && (
        <>
          <p role="status" data-testid="upload-company-state">Firma je uložená.</p>
          <button className="button button--small" type="button" onClick={() => void loadCompanies(view.storedCompanyId)}>Změnit firmu</button>
        </>
      )}
    </div>
  );
}

// Jedna nabídka patří konkrétnímu účtu; samotná editace nikdy neschvaluje upload.
export function RecordingUploadPreferences({ initialValue, defaultVisibility = "private", identityKey = "panel",
  disabled = false, busy = false, locked = false, refreshToken = 0, onChange, onUserChange, onSave, stateMessage, stateError = false, surface = "panel" }) {
  const id = useId();
  const generation = useRef(0);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const [view, setView] = useState({ state: "loading", companies: [], choice: "", visibility: defaultVisibility });
  const initialCompany = initialValue?.companyId ?? "";
  const initialVisibility = initialValue?.visibility ?? defaultVisibility;
  const load = useCallback(async () => {
    const request = ++generation.current;
    changeRef.current?.(null, true);
    setView({ state: "loading", companies: [], choice: initialCompany, visibility: initialVisibility });
    try {
      const offer = normalizeOffer(await window.ludone.listUploadCompanies());
      if (request !== generation.current) return;
      if (!offer) throw new Error("invalid_offer");
      const choice = initialCompany && offer.companies.some((company) => company.id === initialCompany)
        ? initialCompany : initialCompany ? "" : offer.selectedCompanyId ?? "";
      setView({ ...offer, choice, visibility: initialVisibility, state: "ready" });
      changeRef.current?.(choice ? { companyId: choice, offerToken: offer.offerToken, visibility: initialVisibility } : null, false);
    } catch {
      if (request !== generation.current) return;
      setView({ state: "error", companies: [], choice: "", visibility: initialVisibility });
      changeRef.current?.(null, true);
    }
  }, [initialCompany, initialVisibility, identityKey, refreshToken]);
  useEffect(() => {
    if (locked || disabled) {
      generation.current += 1;
      changeRef.current?.(null, !locked);
      setView({ state: "idle", companies: [], choice: "", visibility: initialVisibility });
      return;
    }
    void load();
    const unsubscribe = window.ludone?.onAuthSessionChanged?.(() => {
      generation.current += 1;
      changeRef.current?.(null, true);
      setView({ state: "error", companies: [], choice: "", visibility: initialVisibility });
    });
    return () => { generation.current += 1; unsubscribe?.(); };
  }, [load, locked, disabled, initialVisibility]);
  const update = (choice, visibility) => {
    setView((current) => ({ ...current, choice, visibility }));
    changeRef.current?.(choice ? { companyId: choice, offerToken: view.offerToken, visibility } : null, true);
    onUserChange?.();
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
        {view.state === "error" && <><p role="alert">Firmy nelze ověřit. Před odesláním je načti znovu.</p>
          <button type="button" className="button button--small" disabled={disabled || busy} onClick={() => void load()}>Načíst firmy</button></>}
        {view.state === "ready" && view.companies.length === 0 && <p role="status">Pro tento účet není dostupná žádná firma.</p>}
        {onSave && <button type="button" className="button button--small" data-testid="recording-upload-preferences-save"
          disabled={disabled || busy || view.state !== "ready" || !view.choice} onClick={onSave}>Uložit volby</button>}
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
