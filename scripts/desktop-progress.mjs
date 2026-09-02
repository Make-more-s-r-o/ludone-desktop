#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

const CESTA_SKRIPTU = fileURLToPath(import.meta.url);
const VYCHOZI_KOREN = path.resolve(path.dirname(CESTA_SKRIPTU), "..");
const VYCHOZI_STATUS = path.join(
  VYCHOZI_KOREN,
  "docs",
  "changes",
  "desktop-v1",
  "progress",
  "status.json",
);
const VYCHOZI_VYSTUP = path.join(
  VYCHOZI_KOREN,
  "docs",
  "changes",
  "desktop-v1",
  "progress",
  "index.html",
);
const NEMERENO = "neměřeno";
const LIMIT_OTEVRENYCH_PR = 100;

const POPISKY_OS = {
  rozsah: {
    approved: { text: "schváleno", tone: "approved" },
    draft: { text: "návrh", tone: "draft" },
    rejected: { text: "zamítnuto", tone: "rejected" },
  },
  dodani: {
    "no-code": { text: "bez kódu", tone: "none" },
    coded: { text: "napsáno", tone: "coded" },
    committed: { text: "commitnuto", tone: "coded" },
    "pr-open": { text: "otevřené PR", tone: "active" },
    merged: { text: "sloučeno", tone: "merged" },
  },
  vystaveni: {
    disabled: { text: "vypnuto", tone: "none" },
    labs: { text: "jen ze zdrojáku", tone: "active" },
    production: { text: "v rukou týmu", tone: "production" },
  },
  overeni: {
    "verified-live": { text: "✅ ověřeno naostro", tone: "live" },
    "tests-green": { text: "🧪 zelené testy", tone: "tests" },
    unverified: { text: "⛔ neověřeno", tone: "unverified" },
  },
};

const POPISKY_RIZIK = {
  normal: "běžné",
  security: "bezpečnost",
  money: "peníze",
  rbac: "přístupová práva",
};

function nactiArgumenty(argv) {
  const volby = {
    status: VYCHOZI_STATUS,
    output: VYCHOZI_VYSTUP,
    repoRoot: VYCHOZI_KOREN,
    check: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check") {
      volby.check = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      console.log(
        "Použití: node scripts/desktop-progress.mjs [--status cesta] [--output cesta] [--repo-root cesta] [--check]",
      );
      process.exit(0);
    }

    const prepinaceCest = new Map([
      ["--status", "status"],
      ["--output", "output"],
      ["--repo-root", "repoRoot"],
    ]);
    const cil = prepinaceCest.get(argument);
    if (!cil) throw new Error(`Neznámý argument „${argument}“.`);
    const hodnota = argv[index + 1];
    if (!hodnota || hodnota.startsWith("--")) {
      throw new Error(`Za ${argument} chybí cesta.`);
    }
    volby[cil] = path.resolve(hodnota);
    index += 1;
  }

  return volby;
}

function jeObjekt(hodnota) {
  return hodnota !== null && typeof hodnota === "object" && !Array.isArray(hodnota);
}

function textNeboNemereno(hodnota) {
  return typeof hodnota === "string" && hodnota.trim() ? hodnota.trim() : NEMERENO;
}

function hodnotaNeboNemereno(hodnota) {
  if (typeof hodnota === "number" && Number.isFinite(hodnota)) return String(hodnota);
  return textNeboNemereno(hodnota);
}

function poleNeboPrazdne(hodnota) {
  return Array.isArray(hodnota) ? hodnota : [];
}

function escapeHtml(hodnota) {
  return String(hodnota)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bezpecnyOdkaz(hodnota) {
  if (typeof hodnota !== "string" || !hodnota.trim()) return null;
  const odkaz = hodnota.trim();
  const maRizenyZnak = [...odkaz].some((znak) => {
    const kod = znak.codePointAt(0);
    return kod !== undefined && (kod <= 31 || kod === 127);
  });
  if (/^[\\/]{2}/.test(odkaz) || odkaz.includes("\\") || maRizenyZnak) return null;
  const schema = odkaz.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!schema) return odkaz;
  try {
    const url = new URL(odkaz);
    return url.protocol === "https:" || url.protocol === "http:" ? odkaz : null;
  } catch {
    return null;
  }
}

function cisteProstredi() {
  const env = { ...process.env, NO_COLOR: "1", GIT_PAGER: "cat", PAGER: "cat" };
  delete env.FORCE_COLOR;
  return env;
}

function spust(prikaz, argumenty, { cwd, timeout }) {
  return spawnSync(prikaz, argumenty, {
    cwd,
    encoding: "utf8",
    shell: false,
    env: cisteProstredi(),
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
    maxBuffer: 16 * 1024 * 1024,
  });
}

function odstranAnsi(text) {
  return stripVTControlCharacters(String(text ?? ""));
}

const FORMAT_DATA = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: "Europe/Prague",
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const FORMAT_CASU = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: "Europe/Prague",
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDatum(hodnota, vcetneCasu = false) {
  if (!jePlatneIsoDatum(hodnota)) return NEMERENO;
  return (vcetneCasu ? FORMAT_CASU : FORMAT_DATA).format(new Date(hodnota));
}

function jePlatneIsoDatum(hodnota) {
  if (typeof hodnota !== "string") return false;
  const shoda = hodnota.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/,
  );
  if (!shoda) return false;
  const [, rokText, mesicText, denText, hodinaText, minutaText, sekundaText, zona] = shoda;
  const rok = Number(rokText);
  const mesic = Number(mesicText);
  const den = Number(denText);
  const dnuVMesici = mesic >= 1 && mesic <= 12
    ? new Date(Date.UTC(rok, mesic, 0)).getUTCDate()
    : 0;
  if (den < 1 || den > dnuVMesici) return false;
  if (hodinaText === undefined) return Number.isFinite(Date.parse(`${hodnota}T00:00:00Z`));

  const hodina = Number(hodinaText);
  const minuta = Number(minutaText);
  const sekunda = Number(sekundaText);
  if (hodina > 23 || minuta > 59 || sekunda > 59) return false;
  if (zona !== "Z") {
    const hodinyZony = Number(zona.slice(1, 3));
    const minutyZony = Number(zona.slice(4, 6));
    if (hodinyZony > 23 || minutyZony > 59) return false;
  }
  return Number.isFinite(Date.parse(hodnota));
}

function zmerCommit(repoRoot) {
  const vysledek = spust(
    "git",
    ["--no-pager", "log", "-1", "--format=%H%n%cI"],
    { cwd: repoRoot, timeout: 15_000 },
  );
  if (vysledek.error || vysledek.status !== 0) {
    return {
      measured: false,
      value: NEMERENO,
      detail: "Git nevrátil poslední commit.",
    };
  }

  const [sha, datum] = String(vysledek.stdout ?? "").trim().split(/\r?\n/);
  if (!/^[0-9a-f]{7,64}$/i.test(sha ?? "") || !jePlatneIsoDatum(datum)) {
    return {
      measured: false,
      value: NEMERENO,
      detail: "Git nevrátil platné SHA a datum.",
    };
  }

  return {
    measured: true,
    value: `${sha.slice(0, 8)} · ${formatDatum(datum, true)}`,
    detail: "Poslední commit v tomto worktree.",
    sha,
    datum,
  };
}

function zmerTesty(repoRoot) {
  const vysledek = spust("npm", ["run", "test:unit"], {
    cwd: repoRoot,
    timeout: 180_000,
  });
  if (vysledek.error || vysledek.status !== 0) {
    return {
      measured: false,
      value: NEMERENO,
      detail: "npm run test:unit se nepodařilo dokončit zeleně.",
    };
  }

  const vystup = odstranAnsi(`${vysledek.stdout ?? ""}\n${vysledek.stderr ?? ""}`);
  const shody = [...vystup.matchAll(/^\s*Tests\s+.*\((\d+)\)\s*$/gm)];
  const posledni = shody.at(-1);
  const pocet = posledni ? Number(posledni[1]) : Number.NaN;
  if (!Number.isSafeInteger(pocet) || pocet < 0) {
    return {
      measured: false,
      value: NEMERENO,
      detail: "Testy doběhly, ale jejich počet nešel bezpečně přečíst.",
    };
  }

  return {
    measured: true,
    value: String(pocet),
    detail: "Testů v posledním zeleném běhu npm run test:unit.",
    count: pocet,
  };
}

function zmerPullRequesty(repoRoot) {
  const vysledek = spust(
    "gh",
    ["pr", "list", "--state", "open", "--limit", String(LIMIT_OTEVRENYCH_PR), "--json", "number,title,url,isDraft"],
    { cwd: repoRoot, timeout: 30_000 },
  );
  if (vysledek.error || vysledek.status !== 0) {
    return {
      measured: false,
      value: NEMERENO,
      detail: "gh pr list není dostupné nebo nemá spojení.",
      items: [],
    };
  }

  try {
    const data = JSON.parse(String(vysledek.stdout ?? ""));
    if (!Array.isArray(data) || data.some((item) => !jeObjekt(item) || !Number.isInteger(item.number))) {
      throw new Error("neočekávaný tvar");
    }
    if (data.length >= LIMIT_OTEVRENYCH_PR) {
      return {
        measured: false,
        value: NEMERENO,
        detail: `Seznam dosáhl limitu ${LIMIT_OTEVRENYCH_PR}; přesný počet proto nelze tvrdit.`,
        items: [],
      };
    }
    const items = data
      .map((item) => ({
        number: item.number,
        title: textNeboNemereno(item.title),
        url: bezpecnyOdkaz(item.url),
        isDraft: item.isDraft === true,
      }))
      .sort((a, b) => a.number - b.number);
    return {
      measured: true,
      value: String(items.length),
      detail: items.length === 1 ? "Otevřené PR podle gh pr list." : "Otevřená PR podle gh pr list.",
      items,
    };
  } catch {
    return {
      measured: false,
      value: NEMERENO,
      detail: "gh pr list nevrátilo čitelný seznam.",
      items: [],
    };
  }
}

function zmerZivaFakta(repoRoot) {
  return {
    commit: zmerCommit(repoRoot),
    tests: zmerTesty(repoRoot),
    pullRequests: zmerPullRequesty(repoRoot),
  };
}

function popisekOsy(osa, hodnota) {
  const klic = typeof hodnota === "string" ? hodnota : "";
  const mapa = POPISKY_OS[osa];
  return mapa && Object.hasOwn(mapa, klic)
    ? mapa[klic]
    : { text: NEMERENO, tone: "missing" };
}

function renderOsa(osa, hodnota) {
  const popisek = popisekOsy(osa, hodnota);
  return `<span class="axis axis-${popisek.tone}">${escapeHtml(popisek.text)}</span>`;
}

function renderTextovySeznam(polozky, prazdnyText = NEMERENO) {
  const platne = poleNeboPrazdne(polozky).filter(
    (polozka) => typeof polozka === "string" && polozka.trim(),
  );
  if (platne.length === 0) return `<p class="missing-value">${escapeHtml(prazdnyText)}</p>`;
  return `<ul>${platne.map((polozka) => `<li>${escapeHtml(polozka.trim())}</li>`).join("")}</ul>`;
}

function souhrnOvereni(funkce) {
  const souhrn = { live: 0, tests: 0, unverified: 0, missing: 0 };
  for (const polozka of funkce) {
    if (polozka?.overeni === "verified-live") souhrn.live += 1;
    else if (polozka?.overeni === "tests-green") souhrn.tests += 1;
    else if (polozka?.overeni === "unverified") souhrn.unverified += 1;
    else souhrn.missing += 1;
  }
  return souhrn;
}

function pocetFunkci(pocet) {
  if (pocet === 1) return "1 funkce";
  if (pocet >= 2 && pocet <= 4) return `${pocet} funkce`;
  return `${pocet} funkcí`;
}

function renderFunkce(funkce) {
  if (funkce.length === 0) {
    return `<div class="empty-state"><strong>${NEMERENO}</strong><span>Zdroj pravdy neobsahuje žádnou funkci.</span></div>`;
  }

  return `<div class="table-shell" role="region" tabindex="0" aria-label="Tabulka funkcí; na úzké obrazovce ji lze posouvat do stran">
    <table>
      <caption>Funkce LuDone Desktop a jejich stav ve čtyřech nezávislých osách</caption>
      <thead>
        <tr>
          <th scope="col">Funkce</th>
          <th scope="col">Rozsah</th>
          <th scope="col">Dodání</th>
          <th scope="col">Vystavení</th>
          <th scope="col">Ověření</th>
          <th scope="col">Další pravdivý krok</th>
        </tr>
      </thead>
      <tbody>
        ${funkce
          .map((polozka) => {
            const id = textNeboNemereno(polozka?.id);
            const nazev = textNeboNemereno(polozka?.nazev);
            const overeni = Object.hasOwn(POPISKY_OS.overeni, polozka?.overeni)
              ? polozka.overeni
              : "missing";
            const riziko = Object.hasOwn(POPISKY_RIZIK, polozka?.riziko)
              ? POPISKY_RIZIK[polozka.riziko]
              : NEMERENO;
            return `<tr data-feature-id="${escapeHtml(id)}" data-verification="${escapeHtml(overeni)}">
              <th scope="row">
                <span class="feature-id">${escapeHtml(id)}</span>
                <span class="feature-name">${escapeHtml(nazev)}</span>
                <span class="mobile-verification">${renderOsa("overeni", polozka?.overeni)}</span>
                <span class="risk">Riziko: ${escapeHtml(riziko)}</span>
              </th>
              <td data-axis="rozsah">${renderOsa("rozsah", polozka?.rozsah)}</td>
              <td data-axis="dodani">${renderOsa("dodani", polozka?.dodani)}</td>
              <td data-axis="vystaveni">${renderOsa("vystaveni", polozka?.vystaveni)}</td>
              <td data-axis="overeni">${renderOsa("overeni", polozka?.overeni)}</td>
              <td class="next-step">${escapeHtml(textNeboNemereno(polozka?.dalsiKrok))}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  </div>`;
}

function renderFaze(zivotniCyklus) {
  const aktualni = textNeboNemereno(zivotniCyklus?.aktualni);
  const kroky = poleNeboPrazdne(zivotniCyklus?.kroky);
  if (kroky.length === 0) return `<p class="missing-value">${NEMERENO}</p>`;
  const aktualniKrok = kroky.find((krok) => krok?.id === aktualni || krok?.stav === "aktualni");

  return `<div class="current-phase">
    <span>Aktuální fáze</span>
    <strong>${escapeHtml(textNeboNemereno(aktualniKrok?.nazev))}</strong>
    <p>${escapeHtml(textNeboNemereno(aktualniKrok?.detail))}</p>
  </div>
  <ol class="lifecycle" aria-label="Kroky životního cyklu od záměru po dodání">
    ${kroky
      .map((krok, index) => {
        const stav = ["uzavreno", "aktualni", "ceka"].includes(krok?.stav)
          ? krok.stav
          : "nemereno";
        const jeAktualni = krok?.id === aktualni || stav === "aktualni";
        const stavText = {
          uzavreno: "uzavřeno",
          aktualni: "právě teď",
          ceka: "čeká",
          nemereno: NEMERENO,
        }[stav];
        return `<li class="phase phase-${stav}"${jeAktualni ? ' aria-current="step"' : ""}>
          <span class="phase-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
          <span class="phase-state">${escapeHtml(stavText)}</span>
          <h3>${escapeHtml(textNeboNemereno(krok?.nazev))}</h3>
          <p>${escapeHtml(textNeboNemereno(krok?.detail))}</p>
        </li>`;
      })
      .join("")}
  </ol>`;
}

function renderStavba(polozky) {
  if (polozky.length === 0) return `<p class="missing-value">${NEMERENO}</p>`;
  return `<div class="build-grid">
    ${polozky
      .map((polozka) => {
        const overeni = popisekOsy("overeni", polozka?.overeni);
        return `<article class="build-card" data-verification="${escapeHtml(polozka?.overeni ?? "missing")}">
          <div class="card-topline">
            <span class="feature-id">${escapeHtml(textNeboNemereno(polozka?.oznaceni))}</span>
            <span class="axis axis-${overeni.tone}">${escapeHtml(overeni.text)}</span>
          </div>
          <h3>${escapeHtml(textNeboNemereno(polozka?.nazev))}</h3>
          <p>${escapeHtml(textNeboNemereno(polozka?.stav))}</p>
          <p class="card-note">${escapeHtml(textNeboNemereno(polozka?.poznamka))}</p>
        </article>`;
      })
      .join("")}
  </div>`;
}

function renderPullRequesty(fakt) {
  if (!fakt.measured || fakt.items.length === 0) return "";
  return `<ul class="pr-list">
    ${fakt.items
      .map((item) => {
        const popisek = `#${item.number} ${item.title}${item.isDraft ? " · návrh" : ""}`;
        return item.url
          ? `<li><a href="${escapeHtml(item.url)}">${escapeHtml(popisek)}</a></li>`
          : `<li>${escapeHtml(popisek)}</li>`;
      })
      .join("")}
  </ul>`;
}

function renderFakt({ id, label, fact, extra = "" }) {
  return `<article class="fact-card${fact.measured ? "" : " fact-unmeasured"}" data-live-fact="${id}">
    <span class="fact-label">${escapeHtml(label)}</span>
    <strong>${escapeHtml(fact.value)}</strong>
    <p>${escapeHtml(fact.detail)}</p>
    ${extra}
  </article>`;
}

function renderZdroje(zdroje) {
  if (zdroje.length === 0) return `<p class="missing-value">${NEMERENO}</p>`;
  return `<ul class="source-list">
    ${zdroje
      .map((zdroj) => {
        const nazev = textNeboNemereno(zdroj?.nazev);
        const odkaz = bezpecnyOdkaz(zdroj?.cesta);
        return odkaz
          ? `<li><a href="${escapeHtml(odkaz)}">${escapeHtml(nazev)}</a></li>`
          : `<li>${escapeHtml(nazev)} <span class="missing-value">(${NEMERENO})</span></li>`;
      })
      .join("")}
  </ul>`;
}

function vytvorHtml(status, fakta) {
  const projekt = jeObjekt(status.projekt) ? status.projekt : {};
  const zivotniCyklus = jeObjekt(status.zivotniCyklus) ? status.zivotniCyklus : {};
  const design = jeObjekt(status.design) ? status.design : {};
  const funkce = poleNeboPrazdne(status.funkce);
  const odlozeno = poleNeboPrazdne(projekt.odlozeno);
  const stavba = poleNeboPrazdne(status.praveSeStavi);
  const blockery = poleNeboPrazdne(status.blockery);
  const nemereno = poleNeboPrazdne(status.nemereno);
  const zdroje = poleNeboPrazdne(status.zdroje);
  const souhrn = souhrnOvereni(funkce);
  const aktualizovano = formatDatum(projekt.aktualizovano);
  const nazev = textNeboNemereno(projekt.nazev);
  const chybejiciSouhrn = souhrn.missing
    ? `<span class="summary-footnote">Dalších ${souhrn.missing} položek má stav neměřeno.</span>`
    : "";

  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <title>${escapeHtml(nazev)} — stav vývoje</title>
  <style>
    :root {
      color-scheme: dark;
      --page: oklch(0.185 0.012 262);
      --card: oklch(0.235 0.012 262);
      --raised: oklch(0.265 0.012 262);
      --sunken: oklch(0.16 0.012 262);
      --hair: oklch(0.305 0.013 262);
      --subtle: oklch(0.66 0.012 262);
      --muted: oklch(0.75 0.01 262);
      --text: oklch(0.925 0.005 262);
      --strong: oklch(0.975 0.003 262);
      --accent: oklch(0.72 0.14 268);
      --accent-t: color-mix(in oklab, var(--accent) 15%, transparent);
      --accent-r: color-mix(in oklab, var(--accent) 38%, transparent);
      --ok: oklch(0.78 0.11 178);
      --ok-t: color-mix(in oklab, var(--ok) 12%, transparent);
      --ok-r: color-mix(in oklab, var(--ok) 34%, transparent);
      --wait: oklch(0.8 0.13 76);
      --wait-t: color-mix(in oklab, var(--wait) 13%, transparent);
      --wait-r: color-mix(in oklab, var(--wait) 34%, transparent);
      --bad: oklch(0.75 0.14 34);
      --bad-t: color-mix(in oklab, var(--bad) 12%, transparent);
      --bad-r: color-mix(in oklab, var(--bad) 34%, transparent);
      --shadow: rgb(0 0 0 / 32%);
    }

    @media (prefers-color-scheme: light) {
      :root {
        color-scheme: light;
        --page: oklch(0.975 0.005 85);
        --card: oklch(0.998 0.002 85);
        --raised: oklch(0.955 0.006 85);
        --sunken: oklch(0.935 0.007 85);
        --hair: oklch(0.86 0.01 262);
        --subtle: oklch(0.49 0.018 262);
        --muted: oklch(0.4 0.017 262);
        --text: oklch(0.27 0.017 262);
        --strong: oklch(0.19 0.018 262);
        --accent: oklch(0.49 0.17 268);
        --ok: oklch(0.45 0.12 178);
        --wait: oklch(0.51 0.13 76);
        --bad: oklch(0.53 0.17 34);
        --shadow: rgb(44 45 54 / 12%);
      }
    }

    :root[data-theme="dark"] {
      color-scheme: dark;
      --page: oklch(0.185 0.012 262);
      --card: oklch(0.235 0.012 262);
      --raised: oklch(0.265 0.012 262);
      --sunken: oklch(0.16 0.012 262);
      --hair: oklch(0.305 0.013 262);
      --subtle: oklch(0.66 0.012 262);
      --muted: oklch(0.75 0.01 262);
      --text: oklch(0.925 0.005 262);
      --strong: oklch(0.975 0.003 262);
      --accent: oklch(0.72 0.14 268);
      --ok: oklch(0.78 0.11 178);
      --wait: oklch(0.8 0.13 76);
      --bad: oklch(0.75 0.14 34);
      --shadow: rgb(0 0 0 / 32%);
    }

    :root[data-theme="light"] {
      color-scheme: light;
      --page: oklch(0.975 0.005 85);
      --card: oklch(0.998 0.002 85);
      --raised: oklch(0.955 0.006 85);
      --sunken: oklch(0.935 0.007 85);
      --hair: oklch(0.86 0.01 262);
      --subtle: oklch(0.49 0.018 262);
      --muted: oklch(0.4 0.017 262);
      --text: oklch(0.27 0.017 262);
      --strong: oklch(0.19 0.018 262);
      --accent: oklch(0.49 0.17 268);
      --ok: oklch(0.45 0.12 178);
      --wait: oklch(0.51 0.13 76);
      --bad: oklch(0.53 0.17 34);
      --shadow: rgb(44 45 54 / 12%);
    }

    * { box-sizing: border-box; }
    html { min-height: 100%; background: var(--page); }
    body {
      min-height: 100vh;
      margin: 0;
      background: var(--page);
      color: var(--text);
      font-family: "Public Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
    }
    a { color: var(--accent); text-underline-offset: 0.2em; }
    a:hover { color: var(--strong); }
    button, a { -webkit-tap-highlight-color: transparent; }
    :focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
    h1, h2, h3 {
      margin: 0;
      color: var(--strong);
      font-family: "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      letter-spacing: -0.02em;
      text-wrap: balance;
    }
    p { margin: 0; }
    ul { margin: 0; padding-left: 1.2rem; }
    li + li { margin-top: 0.45rem; }
    code {
      padding: 0.08em 0.34em;
      border: 1px solid var(--hair);
      border-radius: 4px;
      background: var(--sunken);
      color: var(--strong);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.88em;
    }
    .skip-link {
      position: fixed;
      z-index: 20;
      top: 10px;
      left: 10px;
      translate: 0 -150%;
      padding: 10px 14px;
      border-radius: 8px;
      background: var(--strong);
      color: var(--page);
    }
    .skip-link:focus { translate: 0; }
    .wrap { width: min(1340px, calc(100% - 56px)); margin: 0 auto; }
    .topbar {
      display: flex;
      min-height: 64px;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      border-bottom: 1px solid var(--hair);
    }
    .brand { display: flex; align-items: center; gap: 10px; color: var(--strong); font-weight: 650; }
    .brand-mark {
      display: grid;
      width: 28px;
      height: 28px;
      place-items: center;
      border-radius: 8px;
      background: var(--accent);
      color: var(--page);
      font-weight: 800;
    }
    .theme-toggle {
      min-height: 40px;
      padding: 0 13px;
      border: 1px solid var(--hair);
      border-radius: 10px;
      background: var(--card);
      color: var(--text);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .hero { padding: 64px 0 42px; }
    .eyebrow {
      margin-bottom: 10px;
      color: var(--accent);
      font-family: "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      font-size: 11px;
      font-weight: 750;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    h1 { max-width: 18ch; font-size: clamp(38px, 6vw, 72px); font-weight: 750; line-height: 1.02; }
    .hero-lead { max-width: 72ch; margin-top: 18px; color: var(--muted); font-size: 18px; }
    .hero-meta { margin-top: 16px; color: var(--subtle); font-size: 12px; }
    .truth-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 34px;
    }
    .truth-card {
      min-height: 144px;
      padding: 18px;
      border: 1px solid var(--hair);
      border-radius: 14px;
      background: var(--card);
      box-shadow: 0 14px 38px -28px var(--shadow);
    }
    .truth-card strong { display: block; color: var(--strong); font-size: 36px; line-height: 1; }
    .truth-card h2 { margin-top: 12px; font-size: 16px; }
    .truth-card p { margin-top: 6px; color: var(--subtle); font-size: 12px; }
    .truth-live { border-color: var(--ok-r); background: var(--ok-t); }
    .truth-live h2 { color: var(--ok); }
    .truth-tests { border-color: var(--accent-r); background: var(--accent-t); }
    .truth-tests h2 { color: var(--accent); }
    .truth-unverified { border-color: var(--bad-r); background: var(--bad-t); }
    .truth-unverified h2 { color: var(--bad); }
    .summary-footnote { display: block; margin-top: 10px; color: var(--wait); font-size: 12px; }
    section { padding: 44px 0; border-top: 1px solid var(--hair); }
    .section-head { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(280px, 1.1fr); gap: 38px; }
    h2 { font-size: 26px; font-weight: 650; }
    .section-lead { max-width: 76ch; color: var(--muted); font-size: 15.5px; }
    .story-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 26px; }
    .story-card, .fact-card, .build-card, .attention-card {
      padding: 18px;
      border: 1px solid var(--hair);
      border-radius: 14px;
      background: var(--card);
    }
    .story-card h3, .build-card h3, .attention-card h3 { font-size: 17px; }
    .story-card p, .story-card ul, .build-card p, .attention-card ul { margin-top: 10px; color: var(--muted); }
    .story-target { border-color: var(--accent-r); }
    .story-out { background: var(--sunken); }
    .story-deferred { border-color: var(--wait-r); background: var(--wait-t); }
    .design-note {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 20px;
      margin-top: 16px;
      padding: 14px 16px;
      border: 1px solid var(--accent-r);
      border-radius: 12px;
      background: var(--accent-t);
      color: var(--muted);
    }
    .design-note strong { color: var(--strong); }
    .current-phase {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 2px 16px;
      align-items: baseline;
      margin-top: 26px;
      padding: 14px 16px;
      border: 1px solid var(--accent-r);
      border-radius: 12px;
      background: var(--accent-t);
    }
    .current-phase span {
      color: var(--accent);
      font-size: 10.5px;
      font-weight: 750;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }
    .current-phase strong {
      color: var(--strong);
      font-family: "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      font-size: 17px;
    }
    .current-phase p { grid-column: 2; color: var(--muted); font-size: 12px; }
    .lifecycle {
      display: grid;
      grid-template-columns: repeat(8, minmax(132px, 1fr));
      gap: 9px;
      margin: 28px 0 0;
      padding: 0;
      list-style: none;
      overflow-x: auto;
      scrollbar-color: var(--hair) transparent;
    }
    .phase {
      position: relative;
      min-height: 184px;
      padding: 14px;
      border: 1px solid var(--hair);
      border-radius: 12px;
      background: var(--card);
    }
    .phase-number { color: var(--subtle); font: 700 11px/1 ui-monospace, monospace; }
    .phase-state {
      display: block;
      margin-top: 20px;
      color: var(--subtle);
      font-size: 10px;
      font-weight: 750;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }
    .phase h3 { margin-top: 5px; font-size: 15px; }
    .phase p { margin-top: 8px; color: var(--subtle); font-size: 11.5px; line-height: 1.45; }
    .phase-uzavreno { border-color: var(--accent-r); }
    .phase-uzavreno .phase-state { color: var(--accent); }
    .phase-aktualni { border-color: var(--accent); background: var(--accent-t); box-shadow: inset 0 3px 0 var(--accent); }
    .phase-aktualni .phase-state, .phase-aktualni h3 { color: var(--accent); }
    .phase-ceka { background: var(--sunken); }
    .fact-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 26px; }
    .fact-card { min-height: 150px; }
    .fact-card .fact-label {
      display: block;
      color: var(--subtle);
      font-size: 10.5px;
      font-weight: 750;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }
    .fact-card strong { display: block; margin-top: 12px; color: var(--strong); font-size: clamp(21px, 3vw, 31px); line-height: 1.1; }
    .fact-card p { margin-top: 9px; color: var(--subtle); font-size: 12px; }
    .fact-unmeasured { border-color: var(--wait-r); background: var(--wait-t); }
    .fact-unmeasured strong { color: var(--wait); font-size: 25px; }
    .pr-list { margin-top: 12px; color: var(--muted); font-size: 12px; }
    .build-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 26px; }
    .build-card { min-height: 220px; }
    .card-topline { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .build-card h3 { margin-top: 16px; }
    .build-card .card-note { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--hair); color: var(--subtle); font-size: 12px; }
    .feature-id { color: var(--accent); font: 700 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .table-shell { margin-top: 26px; overflow-x: auto; border: 1px solid var(--hair); border-radius: 14px; background: var(--card); }
    caption {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    table { width: 100%; min-width: 1110px; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 14px 12px; border-bottom: 1px solid var(--hair); text-align: left; vertical-align: top; }
    thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--sunken);
      color: var(--subtle);
      font-family: "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }
    tbody tr:last-child th, tbody tr:last-child td { border-bottom: 0; }
    tbody tr[data-verification="verified-live"] { box-shadow: inset 4px 0 0 var(--ok); }
    tbody tr[data-verification="tests-green"] { box-shadow: inset 4px 0 0 var(--accent); }
    tbody tr[data-verification="unverified"] { box-shadow: inset 4px 0 0 var(--bad); }
    tbody tr[data-verification="missing"] { box-shadow: inset 4px 0 0 var(--wait); }
    tbody tr:hover { background: var(--raised); }
    tbody th { width: 265px; padding-left: 18px; font-weight: 400; }
    .feature-name { display: block; margin-top: 7px; color: var(--strong); font-size: 14px; font-weight: 650; line-height: 1.35; }
    .mobile-verification { display: none; margin-top: 9px; }
    .risk { display: block; margin-top: 7px; color: var(--subtle); font-size: 10.5px; }
    .axis {
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      padding: 3px 8px;
      border: 1px solid var(--hair);
      border-radius: 6px;
      background: var(--sunken);
      color: var(--muted);
      font-size: 11px;
      font-weight: 650;
      line-height: 1.25;
      white-space: nowrap;
    }
    .axis-live { border-color: var(--ok-r); background: var(--ok-t); color: var(--ok); }
    .axis-tests, .axis-active, .axis-approved, .axis-merged { border-color: var(--accent-r); background: var(--accent-t); color: var(--accent); }
    .axis-unverified, .axis-rejected { border-color: var(--bad-r); background: var(--bad-t); color: var(--bad); }
    .axis-missing, .axis-draft { border-color: var(--wait-r); background: var(--wait-t); color: var(--wait); }
    .axis-production { border-color: var(--hair); color: var(--text); }
    .next-step { width: 290px; color: var(--muted); font-size: 12px; }
    .attention-grid { display: grid; grid-template-columns: 1.08fr 0.92fr; gap: 16px; margin-top: 26px; }
    .attention-blockers { border-color: var(--bad-r); background: var(--bad-t); }
    .attention-unseen { border-color: var(--wait-r); background: var(--wait-t); }
    .attention-card ul { padding-left: 1.1rem; }
    .attention-card li { padding-left: 0.2rem; }
    .source-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; padding: 36px 0 70px; border-top: 1px solid var(--hair); }
    .source-footer h2 { font-size: 18px; }
    .source-footer p, .source-list { margin-top: 10px; color: var(--subtle); font-size: 12px; }
    .missing-value { color: var(--wait); font-weight: 650; }
    .empty-state { display: flex; gap: 12px; margin-top: 24px; padding: 18px; border: 1px solid var(--wait-r); border-radius: 14px; background: var(--wait-t); }
    .empty-state strong { color: var(--wait); }

    @media (max-width: 900px) {
      .truth-grid, .story-grid, .fact-grid, .build-grid { grid-template-columns: 1fr; }
      .section-head, .attention-grid, .source-footer { grid-template-columns: 1fr; }
      .truth-card, .fact-card, .build-card { min-height: 0; }
    }
    @media (max-width: 620px) {
      .wrap { width: min(100% - 28px, 1340px); }
      .hero { padding-top: 44px; }
      h1 { font-size: 39px; }
      section { padding: 36px 0; }
      .design-note { align-items: flex-start; flex-direction: column; }
      .current-phase { grid-template-columns: 1fr; }
      .current-phase p { grid-column: 1; margin-top: 5px; }
      .lifecycle { grid-template-columns: 1fr; overflow-x: visible; }
      .phase { min-height: 0; }
      .mobile-verification { display: block; }
    }
    @media print {
      :root, :root[data-theme="dark"], :root[data-theme="light"] {
        color-scheme: light;
        --page: #ffffff;
        --card: #ffffff;
        --raised: #f5f5f7;
        --sunken: #f0f0f3;
        --hair: #d6d6dc;
        --subtle: #555963;
        --muted: #3e424b;
        --text: #292c33;
        --strong: #17191e;
        --accent: #4d55b8;
        --ok: #237e69;
        --wait: #8a6100;
        --bad: #a53f32;
        --shadow: transparent;
      }
      html, body { background: var(--page); color: var(--text); }
      .theme-toggle, .skip-link { display: none; }
      .wrap { width: 100%; }
      section, .truth-card, .story-card, .fact-card, .build-card, .attention-card { break-inside: avoid; }
      .table-shell { overflow: visible; break-inside: auto; }
      table { min-width: 0; table-layout: fixed; font-size: 9px; }
      th, td { padding: 6px 5px; }
      .next-step { width: auto; }
      tbody tr { break-inside: avoid; }
      a { color: inherit; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#obsah">Přeskočit na obsah</a>
  <div class="wrap">
    <div class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">L</span>${escapeHtml(nazev)}</div>
      <button class="theme-toggle" type="button" data-theme-toggle aria-label="Přepnout vzhled">Změnit vzhled</button>
    </div>

    <header class="hero">
      <p class="eyebrow">Stav vývoje · podklady k ${escapeHtml(aktualizovano)}</p>
      <h1>Co už má kód, co se staví a co ještě nikdo neviděl běžet.</h1>
      <p class="hero-lead">Tahle stránka schválně nerozpouští všechno do jednoho slova „hotovo“. Sloučený kód, zelený test a funkce ověřená člověkem jsou tři různé věci.</p>
      <div class="truth-grid" aria-label="Souhrn úrovní ověření">
        <article class="truth-card truth-live">
          <strong>${souhrn.live}</strong>
          <h2>✅ ověřeno naostro</h2>
          <p>Celá funkce splnila živý scénář. Dílčí sondy se sem nepočítají. Podle matice: ${souhrn.live} z ${funkce.length}.</p>
        </article>
        <article class="truth-card truth-tests">
          <strong>${souhrn.tests}</strong>
          <h2>🧪 zelené testy</h2>
          <p>Kód prošel automatem. Tohle samo o sobě není živé ověření.</p>
        </article>
        <article class="truth-card truth-unverified">
          <strong>${souhrn.unverified}</strong>
          <h2>⛔ neověřeno</h2>
          <p>Funkce je napsaná nebo plánovaná, ale potřebný běh nikdo nedoložil.</p>
          ${chybejiciSouhrn}
        </article>
      </div>
    </header>

    <main id="obsah">
      <section aria-labelledby="co-vznika">
        <div class="section-head">
          <div>
            <p class="eyebrow">01 · Smysl</p>
            <h2 id="co-vznika">Co vzniká</h2>
          </div>
          <p class="section-lead">Desktop je spouštěč se dvěma agendami, ne nový archiv ani druhá webová aplikace.</p>
        </div>
        <div class="story-grid">
          <article class="story-card">
            <h3>Problém</h3>
            <p>${escapeHtml(textNeboNemereno(projekt.problem))}</p>
          </article>
          <article class="story-card story-target">
            <h3>Cílový výsledek</h3>
            <p>${escapeHtml(textNeboNemereno(projekt.cil))}</p>
          </article>
          <article class="story-card story-out">
            <h3>Vědomě mimo rozsah</h3>
            ${renderTextovySeznam(projekt.mimoRozsah)}
          </article>
          ${odlozeno.length ? `<article class="story-card story-deferred">
            <h3>Odloženo, ne zrušeno</h3>
            ${renderTextovySeznam(odlozeno)}
          </article>` : ""}
        </div>
        <div class="design-note">
          <span><strong>${escapeHtml(hodnotaNeboNemereno(design.schvalenoObrazovek))} obrazovek je schválených.</strong> Se skutečnou aplikací jsou zatím sladěné ${escapeHtml(hodnotaNeboNemereno(design.sladenoObrazovek))}.</span>
          <span>${escapeHtml(textNeboNemereno(design.poznamka))}</span>
        </div>
      </section>

      <section aria-labelledby="kde-jsme">
        <div class="section-head">
          <div>
            <p class="eyebrow">02 · Životní cyklus</p>
            <h2 id="kde-jsme">Kde právě jsme</h2>
          </div>
          <p class="section-lead">${escapeHtml(textNeboNemereno(zivotniCyklus.poznamka))}</p>
        </div>
        ${renderFaze(zivotniCyklus)}
      </section>

      <section aria-labelledby="ziva-fakta">
        <div class="section-head">
          <div>
            <p class="eyebrow">03 · Bez ručního přepisování</p>
            <h2 id="ziva-fakta">Živá fakta z repozitáře</h2>
          </div>
          <p class="section-lead">Generátor je při každém běhu znovu změří. Když příkaz chybí, selže nebo nevrátí čitelný údaj, stránka ukáže „neměřeno“.</p>
        </div>
        <div class="fact-grid">
          ${renderFakt({ id: "commit", label: "Poslední commit", fact: fakta.commit })}
          ${renderFakt({ id: "test-count", label: "Počet unit testů", fact: fakta.tests })}
          ${renderFakt({
            id: "open-prs",
            label: "Otevřená PR",
            fact: fakta.pullRequests,
            extra: renderPullRequesty(fakta.pullRequests),
          })}
        </div>
      </section>

      <section aria-labelledby="co-se-stavi">
        <div class="section-head">
          <div>
            <p class="eyebrow">04 · Rozpracováno</p>
            <h2 id="co-se-stavi">Co se právě staví</h2>
          </div>
          <p class="section-lead">Checkpoint popisuje změny čekající na dokončení. Jejich automatické výsledky jsou oddělené od toho, co ještě musí vidět nebo slyšet člověk.</p>
        </div>
        ${renderStavba(stavba)}
      </section>

      <section aria-labelledby="funkce">
        <div class="section-head">
          <div>
            <p class="eyebrow">05 · Funkční matice</p>
            <h2 id="funkce">${pocetFunkci(funkce.length)}, čtyři nezávislé osy</h2>
          </div>
          <p class="section-lead"><strong>Rozsah</strong> říká, zda funkci chceme. <strong>Dodání</strong>, kde leží kód. <strong>Vystavení</strong>, zda se k ní člověk dostane. Teprve <strong>ověření</strong> říká, jestli ji někdo viděl fungovat.</p>
        </div>
        ${renderFunkce(funkce)}
      </section>

      <section aria-labelledby="pozornost">
        <div class="section-head">
          <div>
            <p class="eyebrow">06 · Co nepřehlédnout</p>
            <h2 id="pozornost">Co brání pokračování a co zůstává neměřené</h2>
          </div>
          <p class="section-lead">Tohle jsou místa, kde by zelená barva vytvořila falešnou jistotu. Proto zůstávají nahlas viditelná.</p>
        </div>
        <div class="attention-grid">
          <article class="attention-card attention-blockers">
            <h3>Blockery a stopky</h3>
            ${renderTextovySeznam(blockery)}
          </article>
          <article class="attention-card attention-unseen">
            <h3>Ještě nikdo nedoložil</h3>
            ${renderTextovySeznam(nemereno)}
          </article>
        </div>
      </section>
    </main>

    <footer class="source-footer">
      <div>
        <h2>Zdroj pravdy</h2>
        <p>Ručně se upravuje <code>status.json</code>. Tento soubor je vygenerovaný a ručně se neupravuje. Všechna data už jsou uvnitř stránky, takže funguje i při otevření přes <code>file://</code>.</p>
      </div>
      <div>
        <h2>Podklady pro ruční stav</h2>
        ${renderZdroje(zdroje)}
      </div>
    </footer>
  </div>

  <script>
    (function () {
      var button = document.querySelector("[data-theme-toggle]");
      if (!button) return;
      var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
      function isDark() {
        var selected = document.documentElement.getAttribute("data-theme");
        return selected ? selected === "dark" : Boolean(media && media.matches);
      }
      function updateButton() {
        var dark = isDark();
        button.setAttribute("aria-label", dark ? "Přepnout na světlý vzhled" : "Přepnout na tmavý vzhled");
        button.textContent = dark ? "Světlý vzhled" : "Tmavý vzhled";
      }
      button.addEventListener("click", function () {
        document.documentElement.setAttribute("data-theme", isDark() ? "light" : "dark");
        updateButton();
      });
      if (media && media.addEventListener) {
        media.addEventListener("change", function () {
          if (!document.documentElement.hasAttribute("data-theme")) updateButton();
        });
      }
      updateButton();
    }());
  </script>
</body>
</html>
`;
}

async function nactiStatus(cesta) {
  let raw;
  try {
    raw = await readFile(cesta, "utf8");
  } catch (error) {
    throw new Error(`Nelze přečíst status.json: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const status = JSON.parse(raw);
    if (!jeObjekt(status)) throw new Error("kořen musí být objekt");
    return status;
  } catch (error) {
    throw new Error(`status.json není platný: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function hlavni() {
  const volby = nactiArgumenty(process.argv.slice(2));
  const status = await nactiStatus(volby.status);
  const fakta = zmerZivaFakta(volby.repoRoot);
  const html = vytvorHtml(status, fakta);

  if (volby.check) {
    let existujici = null;
    try {
      existujici = await readFile(volby.output, "utf8");
    } catch {
      // Chybějící soubor je pro kontrolní režim běžný červený výsledek.
    }
    if (existujici !== html) {
      console.error(`NEAKTUÁLNÍ: ${volby.output}`);
      process.exitCode = 1;
      return;
    }
    console.log(`AKTUÁLNÍ: ${volby.output}`);
    return;
  }

  await mkdir(path.dirname(volby.output), { recursive: true });
  await writeFile(volby.output, html, "utf8");
  console.log(`Vygenerováno: ${volby.output}`);
}

hlavni().catch((error) => {
  console.error(`Generátor se zastavil: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
});
