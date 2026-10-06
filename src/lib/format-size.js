/**
 * Sdílený popis velikosti souboru pro celou aplikaci: desítkové jednotky
 * (1 MB = 1 000 000 B), česká čísla, jedno desetinné místo.
 */
const NUMBER = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 });

export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1_000))} kB`;
  if (bytes < 1_000_000_000) return `${NUMBER.format(bytes / 1_000_000)} MB`;
  return `${NUMBER.format(bytes / 1_000_000_000)} GB`;
}

function originalsLabel(count) {
  if (count === 1) return "1 původní stopa";
  return count <= 4 ? `${count} původní stopy` : `${count} původních stop`;
}

/**
 * Velikost nahrávky: hlavní údaj je soubor, který jde na server, místní původní
 * stopy jsou uvedené zvlášť. Bez odesílaného souboru se neuvádí nic vymyšleného.
 */
export function recordingSizeText({ uploadBytes, originalsBytes, originalsCount }) {
  const hasUpload = Number.isFinite(uploadBytes);
  const originals = Number.isFinite(originalsBytes) && originalsCount > 0
    ? `${originalsLabel(originalsCount)} ${formatSize(originalsBytes)}`
    : null;
  if (hasUpload) {
    return originals ? `${formatSize(uploadBytes)} · místně navíc ${originals}` : formatSize(uploadBytes);
  }
  return originals ? `původní stopy na Macu ${formatSize(originalsBytes)}` : null;
}
