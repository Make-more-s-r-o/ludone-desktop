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
const POLOMER_PRSTYNKU_ODZNAKU = 1.9;
const SIRKA_PRSTYNKU_ODZNAKU = 1.2;
const CEKAJICI_TECKY = [[17.45, 18.5], [20.55, 18.5]];
const POLOMER_CEKAJICI_TECKY = 1.05;
const PRESKRTNUTI = [[4, 20], [20, 4]];
const STAVY = [
  "signed-out",
  "idle",
  "recording",
  "tracking",
  "recording-tracking",
  "queue-waiting",
  "recording-audio-lost",
  "recording-microphone-only",
];
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
    wait: "oklch(0.8 0.13 76)",
    listaPozadi: "oklch(0.12 0.01 262)",
  },
  light: {
    subtle: "oklch(0.635 0.013 260)",
    text: "oklch(0.245 0.019 266)",
    bad: "oklch(0.5 0.15 32)",
    ok: "oklch(0.46 0.1 178)",
    wait: "oklch(0.52 0.12 70)",
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
    "queue-waiting": "wait",
    "recording-audio-lost": "wait",
    "recording-microphone-only": "bad",
  }[stav];
  const odznakToken = {
    recording: "bad",
    "recording-tracking": "ok",
    "queue-waiting": "wait",
    "recording-audio-lost": "bad",
    "recording-microphone-only": "subtle",
  }[stav] ?? "bad";
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
  // U výpadku končí pulz před posledním úsekem. Stav je díky tomu rozeznatelný
  // i bez barvy, přesto zůstává věrný návrhovému glyfu a odznaku.
  const pulzBody = stav === "recording-audio-lost" ? PULZ.slice(0, 3) : PULZ;
  const pulz = krytiLomeneCary(
    bodX,
    bodY,
    pulzBody,
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
  if ([
    "recording",
    "recording-tracking",
    "queue-waiting",
    "recording-audio-lost",
    "recording-microphone-only",
  ].includes(stav)) {
    // Barevné kolečko má v souřadnicích návrhu poloměr 2,5. Obrys široký 1,5
    // kreslíme vně, aby nezmenšil čitelnou barevnou část odznaku.
    const obrys = krytiPrstynku(
      bodX,
      bodY,
      STRED_ODZNAKU,
      POLOMER_ODZNAKU + SIRKA_OBRYSU_ODZNAKU / 2,
      SIRKA_OBRYSU_ODZNAKU,
      velikostPixelu,
    );
    let odznak;
    if (stav === "recording-tracking") {
      odznak = krytiPrstynku(
        bodX,
        bodY,
        STRED_ODZNAKU,
        POLOMER_PRSTYNKU_ODZNAKU,
        SIRKA_PRSTYNKU_ODZNAKU,
        velikostPixelu,
      );
    } else if (stav === "queue-waiting") {
      odznak = sjednoceniKryti(...CEKAJICI_TECKY.map((stred) => (
        krytiKruhu(bodX, bodY, stred, POLOMER_CEKAJICI_TECKY, velikostPixelu)
      )));
    } else {
      odznak = krytiKruhu(
        bodX,
        bodY,
        STRED_ODZNAKU,
        POLOMER_ODZNAKU,
        velikostPixelu,
      );
      if (stav === "recording-microphone-only") {
        // Polovina sdíleného kolečka značí jedinou přijatou stopu. Pravá půlka
        // je průhledná, takže informaci zachová i systémové tónování šablony.
        odznak *= krytiPodepsaneVzdalenosti(bodX - STRED_ODZNAKU[0], velikostPixelu);
      }
    }
    pixel = prekryj(pixel, barvy.obrys, obrys);
    // Prstýnek souběhu a dvě tečky fronty zachovávají význam i bez barvy.
    pixel = prekryj(pixel, barvy.odznak, odznak);
  }

  return [
    Math.round(pixel[0]),
    Math.round(pixel[1]),
    Math.round(pixel[2]),
    Math.round(pixel[3] * 255),
  ];
}

function pixely(rozmer, vykresliPixel) {
  const radek = 1 + rozmer * 4;
  const data = Buffer.alloc(radek * rozmer);

  for (let y = 0; y < rozmer; y += 1) {
    const zacatekRadku = y * radek;
    data[zacatekRadku] = 0;
    for (let x = 0; x < rozmer; x += 1) {
      const offset = zacatekRadku + 1 + x * 4;
      const pixel = vykresliPixel(x, y);
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

function png(rozmer, vykresliPixel) {
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
    pngChunk("IDAT", deflateSync(pixely(rozmer, vykresliPixel), { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pixelAplikace(x, y, rozmer, barvy) {
  const velikostPixelu = PLATNO / rozmer;
  const bodX = (x + 0.5) * velikostPixelu;
  const bodY = (y + 0.5) * velikostPixelu;
  const stred = PLATNO / 2;
  // Podklad má vně 1/16 plátna volnou; zaoblení zabírá pětinu plátna.
  const polovinaPodkladu = PLATNO * 7 / 16;
  const polomer = PLATNO / 5;
  const qx = Math.abs(bodX - stred) - (polovinaPodkladu - polomer);
  const qy = Math.abs(bodY - stred) - (polovinaPodkladu - polomer);
  const vzdalenostPodkladu = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
    + Math.min(Math.max(qx, qy), 0) - polomer;
  const podklad = krytiPodepsaneVzdalenosti(vzdalenostPodkladu, velikostPixelu);
  // Tentýž pulz, šířka a plátno jako v liště; pouze ho zmenšíme kolem středu,
  // aby mezi tahem a hranou neprůhledného podkladu zůstal čitelný okraj.
  const meritko = 0.85;
  const glyf = krytiLomeneCary(
    (bodX - stred) / meritko + stred,
    (bodY - stred) / meritko + stred,
    PULZ,
    SIRKA_PULZU,
    velikostPixelu / meritko,
  );
  const pixel = prekryj(prekryj([0, 0, 0, 0], barvy.podklad, podklad), barvy.glyf, glyf);
  return [
    Math.round(pixel[0]), Math.round(pixel[1]), Math.round(pixel[2]),
    Math.round(pixel[3] * 255),
  ];
}

// ICNS uchovává PNG pod čtyřznakovými typy; každý blok včetně hlavičky
// nese svou délku. Zápis v Node umožní stejné generování i testy na Linuxu.
//
// 🔴 Typ bloku NENÍ jen jmenovka — říká systému, JAK data přečíst. Do 10. 9. 2026 se sem
// psaly 16px a 32px pod `icp4`/`icp5`, jenže to jsou historické typy pro RLE, ne pro PNG:
// macOS ta data rozbalil jako RLE a v seznamu ve Finderu z ikony vyšel barevný šum.
// Velký náhled byl přitom v pořádku, protože ten bere jinou velikost — vada byla vidět
// jen tam, kam se nikdo nedíval. Měřeno: průměrná barva 16px vyšla (124, 11, 0) proti
// (22, 24, 26) u zdravých velikostí, a alfa 255 místo 187, protože RLE průhlednost nemá.
function icns(casti) {
  const bloky = casti.map(({ typ, data }) => {
    const hlavicka = Buffer.alloc(8);
    hlavicka.write(typ, 0, "ascii");
    hlavicka.writeUInt32BE(data.length + 8, 4);
    return Buffer.concat([hlavicka, data]);
  });
  const hlavicka = Buffer.alloc(8);
  hlavicka.write("icns", 0, "ascii");
  hlavicka.writeUInt32BE(8 + bloky.reduce((soucet, blok) => soucet + blok.length, 0), 4);
  return Buffer.concat([hlavicka, ...bloky]);
}

export function generujIkonuAplikace(soubor) {
  const iconset = soubor.replace(/\.icns$/, ".iconset");
  fs.mkdirSync(iconset, { recursive: true });
  // Neutrální dark.text na dark.listaPozadi zachovává identitu lišty a dobrou
  // čitelnost; ikona aplikace tak nepředstírá barevný stav nahrávání či času.
  const barvy = {
    podklad: oklchNaRgb(PALETY.dark.listaPozadi),
    glyf: oklchNaRgb(PALETY.dark.text),
  };
  const velikosti = [
    // `null` = velikost se zapíše do `.iconset`, ale do ICNS nejde. Pro 16 a 32 bodů
    // neexistuje typ, který by nesl PNG: `icp4`/`icp5` čeká RLE a `ic04`/`ic05` ARGB
    // (obojí změřeno — obojí dá šum). macOS si proto malé velikosti dopočítá z retinových
    // `ic11`/`ic12`, což je přesně to, co dělá i vlastní nástroj Applu.
    { zaklad: 16, typy: [null, "ic11"] },
    { zaklad: 32, typy: [null, "ic12"] },
    { zaklad: 128, typy: ["ic07", "ic13"] },
    { zaklad: 256, typy: ["ic08", "ic14"] },
    { zaklad: 512, typy: ["ic09", "ic10"] },
  ];
  const casti = [];
  const obrazky = new Map();
  for (const { zaklad, typy } of velikosti) {
    for (const [index, typ] of typy.entries()) {
      const rozmer = zaklad * (index + 1);
      if (!obrazky.has(rozmer)) {
        obrazky.set(rozmer, png(rozmer, (x, y) => pixelAplikace(x, y, rozmer, barvy)));
      }
      const data = obrazky.get(rozmer);
      const nazev = `icon_${zaklad}x${zaklad}${index === 1 ? "@2x" : ""}.png`;
      fs.writeFileSync(path.join(iconset, nazev), data);
      if (typ !== null) casti.push({ typ, data });
    }
  }
  fs.writeFileSync(soubor, icns(casti));
  console.log(`Vygenerována ikona aplikace (${casti.length} bloků ICNS) do ${soubor}`);
}

function vystupniAdresar(argumenty, aplikace) {
  if (argumenty.length === 0) {
    const adresarSkriptu = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(adresarSkriptu, aplikace ? "../build/ikona-aplikace" : "../electron/ikony");
  }
  if (argumenty.length === 2 && argumenty[0] === "--output" && argumenty[1]) {
    return path.resolve(argumenty[1]);
  }
  throw new Error("Použití: node scripts/tray-ikony.mjs [--app] [--output <adresář>]");
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argumenty = process.argv.slice(2);
  const aplikace = argumenty[0] === "--app";
  const cil = vystupniAdresar(aplikace ? argumenty.slice(1) : argumenty, aplikace);
  if (aplikace) {
    generujIkonuAplikace(path.join(cil, "LuDone.icns"));
  } else {
    fs.mkdirSync(cil, { recursive: true });
    for (const motiv of MOTIVY) {
      for (const stav of STAVY) {
        for (const { rozmer, pripona } of VELIKOSTI) {
          const nazev = `${motiv}-${stav}${pripona}.png`;
          fs.writeFileSync(path.join(cil, nazev), png(
            rozmer,
            (x, y) => pixelStavu(x, y, rozmer, motiv, stav),
          ));
        }
      }
    }
    console.log(`Vygenerováno ${MOTIVY.length * STAVY.length * VELIKOSTI.length} ikon do ${cil}`);
  }
}
