import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const korenStylu = path.dirname(fileURLToPath(new URL("../src/styles.css", import.meta.url)));
const styly = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

/**
 * Vytáhne z CSS deklarace @font-face jako objekty.
 *
 * 🔴 Komentáře se odstraňují PŘED hledáním. Bez toho brala tahle brána zakomentovaný
 * blok jako platnou deklaraci — takže by šla obejít tím, že se skutečná písma
 * zakomentují a vedle nich zůstane komentář, který vypadá správně. Nepřišlo se na to
 * přemýšlením, ale sabotáží: „povinně zelená" zčervenala.
 */
function deklarace() {
  const bezKomentaru = styly.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...bezKomentaru.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, telo]) => ({
    rodina: telo.match(/font-family:\s*"([^"]+)"/)?.[1],
    vaha: telo.match(/font-weight:\s*([^;]+)/)?.[1]?.trim(),
    soubor: telo.match(/url\("\.\/([^"]+)"\)/)?.[1],
    rozsah: telo.match(/unicode-range:\s*([^;]+)/)?.[1] ?? "",
  }));
}

describe("přibalená písma", () => {
  it("deklaruje obě rodiny ze schváleného návrhu", () => {
    const rodiny = new Set(deklarace().map((d) => d.rodina));
    expect(rodiny).toContain("Instrument Sans");
    expect(rodiny).toContain("Public Sans");
  });

  it("každý deklarovaný soubor na disku existuje a je to opravdu woff2", () => {
    // Chybějící soubor písma se navenek neprojeví ničím: prohlížeč mlčky spadne
    // na náhradní systémové písmo a aplikace prostě vypadá jinak než návrh.
    // Přesně tohle se tu už jednou stalo, proto se to měří, ne předpokládá.
    const soubory = deklarace().map((d) => d.soubor);
    expect(soubory.length).toBeGreaterThan(0);
    for (const soubor of soubory) {
      const cesta = path.join(korenStylu, soubor);
      expect(existsSync(cesta), `chybí soubor písma ${soubor}`).toBe(true);
      expect(readFileSync(cesta).subarray(0, 4).toString("latin1")).toBe("wOF2");
    }
  });

  it("obě rodiny pokrývají latin-ext, jinak by čeština ztratila diakritiku", () => {
    // ě š č ř ž ý ů leží v latin-ext. Bez téhle sady vypadne písmo právě
    // u háčků a čárek — tedy u poloviny českého textu.
    const cesky = ["0x11B", "0x161", "0x10D", "0x159", "0x17E", "0x16F"];
    for (const rodina of ["Instrument Sans", "Public Sans"]) {
      const rozsahy = deklarace().filter((d) => d.rodina === rodina).map((d) => d.rozsah).join(" ");
      for (const znak of cesky) {
        const kod = Number(znak);
        const pokryto = [...rozsahy.matchAll(/U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?/g)]
          .some(([, od, doo]) => {
            const a = parseInt(od, 16);
            const b = doo ? parseInt(doo, 16) : a;
            return kod >= a && kod <= b;
          });
        expect(pokryto, `${rodina} nepokrývá U+${kod.toString(16).toUpperCase()}`).toBe(true);
      }
    }
  });

  it("používá variabilní řez, ne šestnáct souborů", () => {
    for (const d of deklarace()) expect(d.vaha).toMatch(/\d+\s+\d+/);
  });
});
