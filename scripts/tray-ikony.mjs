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
const SIRKA_OBRYSU_ODZNAKU = 1.5;
const SIRKA_PRSTYNKU = 1.8;
const PRESKRTNUTI = [[4, 20], [20, 4]];
const STAVY = ["signed-out", "idle", "recording", "tracking", "recording-tracking"];
const MOTIVY = ["dark", "light"];
const VELIKOSTI = [
  { rozmer: 18, pripona: "" },
  { rozmer: 36, pripona: "@2x" },
];
const PNG_PODPIS = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Doslovné tokeny z obou větví renderVals() v design/navrh/Lista.dc.html.
const PALETY = {
  dark: {
    subtle: "oklch(0.585 0.014 262)",
    text: "oklch(0.925 0.005 262)",
    bad: "oklch(0.75 0.14 34)",
    ok: "oklch(0.78 0.11 178)",
    listaPozadi: "oklch(0.12 0.01 262)",
  },
  light: {
    subtle: "oklch(0.635 0.013 260)",
    text: "oklch(0.245 0.019 266)",
    bad: "oklch(0.5 0.15 32)",
    ok: "oklch(0.46 0.1 178)",
    listaPozadi: "oklch(0.92 0.005 85)",
  },
};

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

function krytiPodepsaneVzdalenosti(vzdalenost, velikostPixelu) {
  return omez(0.5 - vzdalenost / velikostPixelu, 0, 1);
}

function krytiTahu(x, y, usecka, sirka, velikostPixelu) {
  return krytiPodepsaneVzdalenosti(
    vzdalenostOdUsecky(x, y, usecka) - sirka / 2,
    velikostPixelu,
  );
}

function krytiLomeneCary(x, y, body, sirka, velikostPixelu) {
  return krytiPodepsaneVzdalenosti(
    vzdalenostOdLomeneCary(x, y, body) - sirka / 2,
    velikostPixelu,
  );
}

function krytiKruhu(x, y, stred, polomer, velikostPixelu) {
  return krytiPodepsaneVzdalenosti(
    Math.hypot(x - stred[0], y - stred[1]) - polomer,
    velikostPixelu,
  );
}

function krytiPrstynku(x, y, stred, polomer, sirka, velikostPixelu) {
  const vzdalenost = Math.hypot(x - stred[0], y - stred[1]);
  return krytiPodepsaneVzdalenosti(
    Math.abs(vzdalenost - polomer) - sirka / 2,
    velikostPixelu,
  );
}

function sjednoceniKryti(...hodnoty) {
  return 1 - hodnoty.reduce((zbytek, hodnota) => zbytek * (1 - hodnota), 1);
}

function oklchNaRgb(hodnota) {
  const shoda = /^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)$/.exec(hodnota);
  if (!shoda) throw new Error(`Neplatná OKLCH barva: ${hodnota}`);
  const [, lText, cText, hText] = shoda;
  const lightness = Number(lText);
  const chroma = Number(cText);
  const hue = Number(hText) * Math.PI / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = lightness - 0.0894841775 * a - 1.2914855480 * b;
  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return linear.map((kanal) => {
    const srgb = kanal <= 0.0031308
      ? 12.92 * kanal
      : 1.055 * kanal ** (1 / 2.4) - 0.055;
    return Math.round(omez(srgb, 0, 1) * 255);
  });
}

function barvyStavu(motiv, stav) {
  const paleta = PALETY[motiv];
  const hlavniToken = {
    "signed-out": "subtle",
    idle: "text",
    recording: "bad",
    tracking: "ok",
    "recording-tracking": "bad",
  }[stav];
  const odznakToken = stav === "recording-tracking" ? "ok" : "bad";
  return {
    hlavni: oklchNaRgb(paleta[hlavniToken]),
    odznak: oklchNaRgb(paleta[odznakToken]),
    obrys: oklchNaRgb(paleta.listaPozadi),
  };
}

function prekryj(cil, barva, kryti) {
  if (kryti <= 0) return cil;
  const zdrojAlfa = omez(kryti, 0, 1);
  const cilAlfa = cil[3];
  const vyslednaAlfa = zdrojAlfa + cilAlfa * (1 - zdrojAlfa);
  if (vyslednaAlfa === 0) return [0, 0, 0, 0];
  return [
    (barva[0] * zdrojAlfa + cil[0] * cilAlfa * (1 - zdrojAlfa)) / vyslednaAlfa,
    (barva[1] * zdrojAlfa + cil[1] * cilAlfa * (1 - zdrojAlfa)) / vyslednaAlfa,
    (barva[2] * zdrojAlfa + cil[2] * cilAlfa * (1 - zdrojAlfa)) / vyslednaAlfa,
    vyslednaAlfa,
  ];
}

function pixelStavu(x, y, rozmer, motiv, stav) {
  const velikostPixelu = PLATNO / rozmer;
  const bodX = (x + 0.5) * velikostPixelu;
  const bodY = (y + 0.5) * velikostPixelu;
  const barvy = barvyStavu(motiv, stav);
  const pulz = krytiLomeneCary(
    bodX,
    bodY,
    PULZ,
    SIRKA_PULZU,
    velikostPixelu,
  );
  let hlavniKryti = pulz;

  if (stav === "signed-out") {
    hlavniKryti = sjednoceniKryti(
      pulz,
      krytiTahu(bodX, bodY, PRESKRTNUTI, SIRKA_PULZU, velikostPixelu),
    );
  } else if (stav === "tracking") {
    hlavniKryti = sjednoceniKryti(
      pulz,
      krytiPrstynku(
        bodX,
        bodY,
        STRED_ODZNAKU,
        POLOMER_ODZNAKU,
        SIRKA_PRSTYNKU,
        velikostPixelu,
      ),
    );
  }

  let pixel = prekryj([0, 0, 0, 0], barvy.hlavni, hlavniKryti);
  if (stav === "recording" || stav === "recording-tracking") {
    const vnejsiKruh = krytiKruhu(
      bodX,
      bodY,
      STRED_ODZNAKU,
      POLOMER_ODZNAKU,
      velikostPixelu,
    );
    const vnitrniKruh = krytiKruhu(
      bodX,
      bodY,
      STRED_ODZNAKU,
      POLOMER_ODZNAKU - SIRKA_OBRYSU_ODZNAKU,
      velikostPixelu,
    );
    pixel = prekryj(pixel, barvy.obrys, vnejsiKruh);
    pixel = prekryj(pixel, barvy.odznak, vnitrniKruh);
  }

  return [
    Math.round(pixel[0]),
    Math.round(pixel[1]),
    Math.round(pixel[2]),
    Math.round(pixel[3] * 255),
  ];
}

function pixely(motiv, stav, rozmer) {
  const radek = 1 + rozmer * 4;
  const data = Buffer.alloc(radek * rozmer);

  for (let y = 0; y < rozmer; y += 1) {
    const zacatekRadku = y * radek;
    data[zacatekRadku] = 0;
    for (let x = 0; x < rozmer; x += 1) {
      const offset = zacatekRadku + 1 + x * 4;
      const pixel = pixelStavu(x, y, rozmer, motiv, stav);
      data.set(pixel, offset);
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

function png(motiv, stav, rozmer) {
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
    pngChunk("IDAT", deflateSync(pixely(motiv, stav, rozmer), { level: 9 })),
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

for (const motiv of MOTIVY) {
  for (const stav of STAVY) {
    for (const { rozmer, pripona } of VELIKOSTI) {
      const nazev = `${motiv}-${stav}${pripona}.png`;
      fs.writeFileSync(path.join(cil, nazev), png(motiv, stav, rozmer));
    }
  }
}

console.log(`Vygenerováno ${MOTIVY.length * STAVY.length * VELIKOSTI.length} ikon do ${cil}`);
