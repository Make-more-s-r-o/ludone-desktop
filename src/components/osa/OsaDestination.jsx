import { useEffect, useState } from "react";
import { OsaIcon } from "./OsaIcon.jsx";

// Jen čte uloženou firmu stejné identity. Nevybírá firmu ani nespouští upload.
export function OsaDestination({ identity, onOpenAccount, readOnly = false }) {
  const [label, setLabel] = useState(null);
  useEffect(() => {
    let current = true;
    setLabel(null);
    if (!identity) return undefined;
    Promise.resolve().then(() => window.ludone.getUploadCompanyDefault()).then(async (stored) => {
      if (!current || !stored?.companyId) return;
      setLabel("Výchozí firma uložená");
    }).catch(() => { if (current) setLabel("Firma není dostupná"); });
    return () => { current = false; };
  }, [identity]);
  return <button type="button" className="osa-destination" disabled={readOnly} onClick={onOpenAccount}>
    <OsaIcon name="cloud" size={18} /><span>{label || "Firmu zvolíte před odesláním"} · Rozhodnete po schůzce</span>
  </button>;
}
