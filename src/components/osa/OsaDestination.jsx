import { useEffect, useState } from "react";
import { OsaIcon } from "./OsaIcon.jsx";

// Jen čte uloženou firmu stejné identity. Nevybírá firmu ani nespouští upload.
export function OsaDestination({ identity, onOpenAccount }) {
  const [label, setLabel] = useState(null);
  useEffect(() => {
    let current = true;
    setLabel(null);
    if (!identity) return undefined;
    Promise.resolve().then(() => window.ludone.getUploadCompanyDefault()).then(async (stored) => {
      if (!current || !stored?.companyId) return;
      const offer = await window.ludone.listUploadCompanies();
      if (!current) return;
      const company = offer?.companies?.find((item) => item.id === stored.companyId);
      if (typeof company?.name === "string") setLabel(company.name);
    }).catch(() => { if (current) setLabel("Firma není dostupná"); });
    return () => { current = false; };
  }, [identity]);
  return <button type="button" className="osa-destination" onClick={onOpenAccount}>
    <OsaIcon name="cloud" size={18} /><span>{label || "Firmu zvolíte před odesláním"} · Rozhodnete po schůzce</span>
  </button>;
}
