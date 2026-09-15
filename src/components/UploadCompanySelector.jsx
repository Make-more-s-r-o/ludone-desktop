import { useEffect, useRef, useState } from "react";

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
    return () => { generationRef.current += 1; };
  }, [identityKey]);

  async function loadCompanies() {
    if (!authenticated || typeof window.ludone?.listUploadCompanies !== "function") return;
    const generation = ++generationRef.current;
    setView({ state: "loading" });
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
      });
    } catch {
      if (generationRef.current === generation) setView({ state: "error" });
    }
  }

  async function saveCompany() {
    if (view.state !== "ready" || !COMPANY_ID_PATTERN.test(view.choice)) return;
    const generation = ++generationRef.current;
    const pending = view;
    setView({ ...pending, state: "saving" });
    try {
      const result = await window.ludone.selectUploadCompany(pending.offerToken, pending.choice);
      if (generationRef.current !== generation) return;
      if (result?.saved !== true || result.selectedCompanyId !== pending.choice) throw new Error("not_saved");
      setView({ ...pending, state: "saved" });
    } catch {
      if (generationRef.current === generation) setView({ state: "error" });
    }
  }

  if (!authenticated) {
    return <p className="settings-row">Pro výběr firmy se přihlas.</p>;
  }

  return (
    <div className="settings-group">
      <p>Výběr firmy sám nic neodešle.</p>
      {view.state === "idle" && (
        <button className="button button--small" type="button" onClick={loadCompanies}>Načíst firmy</button>
      )}
      {view.state === "loading" && <p role="status">Načítám firmy…</p>}
      {view.state === "error" && (
        <>
          <p role="alert">Firmy se nepodařilo načíst nebo uložit.</p>
          <button className="button button--small" type="button" onClick={loadCompanies}>Načíst firmy</button>
        </>
      )}
      {view.state === "no-company" && (
        <>
          <p role="status">Pro tento účet není dostupná žádná firma.</p>
          <button className="button button--small" type="button" onClick={loadCompanies}>Načíst firmy</button>
        </>
      )}
      {(view.state === "ready" || view.state === "saving") && (
        <>
          <label htmlFor="upload-company">Firma pro odesílání nahrávek</label>
          <select
            id="upload-company"
            disabled={view.state === "saving"}
            value={view.choice}
            onChange={(event) => setView({ ...view, choice: event.target.value })}
          >
            <option value="">Vyber firmu</option>
            {view.companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
          <button
            className="button button--small"
            disabled={view.state === "saving" || !view.choice}
            type="button"
            onClick={saveCompany}
          >
            {view.state === "saving" ? "Ukládám…" : "Uložit firmu"}
          </button>
        </>
      )}
      {view.state === "saved" && (
        <>
          <p role="status">Firma je uložená.</p>
          <button className="button button--small" type="button" onClick={loadCompanies}>Změnit firmu</button>
        </>
      )}
    </div>
  );
}
