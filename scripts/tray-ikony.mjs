import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const PLATNO = 24;
const PULZ = [
  [4, 18],
  [10, 6],
  [14, 14],
  [20, 9],
];
const SIRKA_PULZU = 2.2;
const STRED_ODZNAKU = [19, 18.5];
const POLOMER_ODZNAKU = 2.5;
const SIRKA_PRSTYNKU = 1.8;
const PRESKRTNUTI = [[4, 20], [20, 4]];
const STAVY = ["signed-out", "idle", "recording", "tracking"];
const VELIKOSTI = [
  { rozmer: 18, pripona: "" },
  { rozmer: 36, pripona: "@2x" },
];
const PNG_PODPIS = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function omez(hodnota, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, hodnota));
}

function vzdalenostOdUsecky(x, y, [[x1, y1], [x2, y2]]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const delkaNaDruhou = dx * dx + dy * dy;
  const poloha = delkaNaDruhou === 0
    ? 0
    : omez(((x - x1) * dx + (y - y1) * dy) / delkaNaDruhou, 0, 1);
  return Math.hypot(x - (x1 + poloha * dx), y - (y1 + poloha * dy));
}

function vzdalenostOdLomeneCary(x, y, body) {
  let vzdalenost = Number.POSITIVE_INFINITY;
  for (let index = 1; index < body.length; index += 1) {
    vzdalenost = Math.min(
      vzdalenost,
      vzdalenostOdUsecky(x, y, [body[index - 1], body[index]]),
    );
  }
  return vzdalenost;
}

function podepsanaVzdalenost(x, y, stav) {
  const pulz = vzdalenostOdLomeneCary(x, y, PULZ) - SIRKA_PULZU / 2;

  if (stav === "idle") return pulz;
  if (stav === "signed-out") {
    const skrt = vzdalenostOdUsecky(x, y, PRESKRTNUTI) - SIRKA_PULZU / 2;
    return Math.min(pulz, skrt);
  }

  const vzdalenostOdStredu = Math.hypot(x - STRED_ODZNAKU[0], y - STRED_ODZNAKU[1]);
  if (stav === "recording") {
    return Math.min(pulz, vzdalenostOdStredu - POLOMER_ODZNAKU);
  }
  if (stav === "tracking") {
    const prstynek = Math.abs(vzdalenostOdStredu - POLOMER_ODZNAKU) - SIRKA_PRSTYNKU / 2;
    return Math.min(pulz, prstynek);
  }

  throw new Error(`Neznámý stav ikony: ${stav}`);
}

function alfaPixelu(x, y, rozmer, stav) {
  const velikostPixelu = PLATNO / rozmer;
  const bodX = (x + 0.5) * velikostPixelu;
  const bodY = (y + 0.5) * velikostPixelu;
  const vzdalenost = podepsanaVzdalenost(bodX, bodY, stav);

  // Lineární přechod přes šířku jednoho pixelu aproximuje jeho plošné krytí. Vzdálenost
  // od konečné úsečky zároveň vytvoří přesnou tloušťku a kulaté konce bez kreslicí knihovny.
  const kryti = omez(0.5 - vzdalenost / velikostPixelu, 0, 1);
  return Math.round(kryti * 255);
}

function pixely(stav, rozmer) {
  const radek = 1 + rozmer * 4;
  const data = Buffer.alloc(radek * rozmer);

  for (let y = 0; y < rozmer; y += 1) {
    const zacatekRadku = y * radek;
    data[zacatekRadku] = 0;
    for (let x = 0; x < rozmer; x += 1) {
      const offset = zacatekRadku + 1 + x * 4;
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = alfaPixelu(x, y, rozmer, stav);
    }
  }

  return data;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(typ, data) {
  const typBuffer = Buffer.from(typ, "ascii");
  const delka = Buffer.alloc(4);
  const kontrolniSoucet = Buffer.alloc(4);
  delka.writeUInt32BE(data.length);
  kontrolniSoucet.writeUInt32BE(crc32(Buffer.concat([typBuffer, data])));
  return Buffer.concat([delka, typBuffer, data, kontrolniSoucet]);
}

function png(stav, rozmer) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(rozmer, 0);
  ihdr.writeUInt32BE(rozmer, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_PODPIS,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(pixely(stav, rozmer), { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function vystupniAdresar(argumenty) {
  if (argumenty.length === 0) {
    const adresarSkriptu = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(adresarSkriptu, "../electron/ikony");
  }
  if (argumenty.length === 2 && argumenty[0] === "--output" && argumenty[1]) {
    return path.resolve(argumenty[1]);
  }
  throw new Error("Použití: node scripts/tray-ikony.mjs [--output <adresář>]");
}

const cil = vystupniAdresar(process.argv.slice(2));
fs.mkdirSync(cil, { recursive: true });

for (const stav of STAVY) {
  for (const { rozmer, pripona } of VELIKOSTI) {
    const nazev = `${stav}${pripona}.png`;
    fs.writeFileSync(path.join(cil, nazev), png(stav, rozmer));
  }
}

console.log(`Vygenerováno ${STAVY.length * VELIKOSTI.length} ikon do ${cil}`);
