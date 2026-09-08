import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

import {
  FAILURE_CLASSES,
  QUEUE_SCHEMA_VERSION,
  QUEUE_STATES,
  processNext,
} from "../src/lib/queue.js";

const require = createRequire(import.meta.url);
const { failureClassForStatus } = require("../electron/upload-client.cjs");

// Chyba ve tvaru, jakým ji upload klient posílá frontě. Nestavíme repliku klienta —
// jen jeho výstupní kontrakt, protože právě ten fronta vyhodnocuje. Třída se počítá
// PRODUKČNÍ funkcí, ne opsanou hodnotou, jinak by test přežil i její rozbití.
function serverovaChyba(status, code) {
  const chyba = new Error(`${code} (HTTP ${status})`);
  chyba.name = "RecordingUploadError";
  chyba.code = code;
  chyba.status = status;
  chyba.failureClass = failureClassForStatus(status, code);
  return chyba;
}

function frontaSJednouPolozkou() {
  return {
    schemaVersion: QUEUE_SCHEMA_VERSION,
    items: [{
      id: "polozka-1",
      kind: "recording",
      state: QUEUE_STATES.WAITING,
      attempts: 0,
      clientRecordingId: "schuzka-1",
      manifestPath: "/tmp/schuzka-1/manifest.json",
      ownerFingerprint: `sha256:${"a".repeat(64)}`,
      tracks: [{ kind: "microphone", path: "/tmp/schuzka-1/mikrofon.webm" }],
      enqueuedAt: 1_777_000_000_000,
      nextAttemptAt: 0,
    }],
  };
}

async function odesliAZmer(chyba) {
  const send = vi.fn().mockRejectedValue(chyba);
  const vysledek = await processNext(
    frontaSJednouPolozkou(),
    { DESKTOP_UPLOAD_ENABLED: "true" },
    send,
    { now: 1_777_000_001_000 },
  );
  return { vysledek, polozka: vysledek.queue.items[0], send };
}

describe("fronta nesmí ztratit nahrávku", () => {
  describe("403 s neznámým kódem", () => {
    it("se nevyhodnotí jako opakovatelný, takže nespotřebuje pokus", () => {
      // Kdyby to zůstalo `retryable`, každý pokus by ubral z rozpočtu a po vyčerpání
      // by nahrávka skončila v `selhalo` — odkud dnes cesta zpět nevede.
      expect(failureClassForStatus(403, "forbidden")).toBe("paused");
      expect(failureClassForStatus(403, "scope_empty")).toBe("paused");
    });

    it("nepřebije kód, který už význam má", () => {
      // `company_out_of_scope` je trvalé odmítnutí i při 403 — stav odpovědi
      // rozhoduje JEN tam, kde kód neznáme.
      expect(failureClassForStatus(403, "company_out_of_scope")).toBe("permanent");
      expect(failureClassForStatus(403, "storage_disabled")).toBe("paused");
    });

    it("běžnou serverovou chybu nechá opakovatelnou", () => {
      expect(failureClassForStatus(500, "upload_failed")).toBe("retryable");
      expect(failureClassForStatus(503, "upload_failed")).toBe("retryable");
    });

    it("položka po 403 zůstane čekat a pokus se nezvýší", async () => {
      const { polozka, send } = await odesliAZmer(serverovaChyba(403, "forbidden"));

      expect(send).toHaveBeenCalledTimes(1);
      expect(polozka.state).toBe(QUEUE_STATES.WAITING);
      expect(polozka.attempts).toBe(0);
    });
  });

  describe("401 přestane být neviditelné", () => {
    it("položka čeká, pokus se nezvýší a je označená jako vyžadující člověka", async () => {
      const { polozka } = await odesliAZmer(serverovaChyba(401, "unauthorized"));

      expect(polozka.state).toBe(QUEUE_STATES.WAITING);
      expect(polozka.attempts).toBe(0);
      // Tohle je ta půlka, která dřív chyběla: bez příznaku položka mlčky stála
      // a v panelu neměla ani tlačítko, ani vysvětlení.
      expect(polozka.requiresHumanAction).toBe(true);
    });

    it("nese s sebou důvod, aby panel neukazoval prázdno", async () => {
      const { polozka } = await odesliAZmer(serverovaChyba(401, "unauthorized"));

      expect(typeof polozka.lastFailureReason).toBe("string");
      expect(polozka.lastFailureReason.length).toBeGreaterThan(0);
    });

    it("🔴 pošle položku na server právě jednou, nezkouší to znovu", async () => {
      // Nejdůležitější aserce celého souboru. Kdyby fronta 401 vyložila jako
      // „vypršel token" a zkusila to znovu, točila by se donekonečna — a souběžná
      // obnova spustí na serveru reuse detekci, která revokuje CELOU rodinu tokenů,
      // tedy odhlásí člověka úplně. 401 na uploadové cestě znamená „tudy cesta nevede".
      // ⚠️ Počítadlo je uvnitř `send`, takže měří SKUTEČNÁ volání ven, ne domněnku.
      const { polozka, send } = await odesliAZmer(serverovaChyba(401, "unauthorized"));

      expect(send).toHaveBeenCalledTimes(1);
      expect(polozka.attempts).toBe(0);
    });

    it("třída zůstane pozastavená, ne trvalá", () => {
      expect(failureClassForStatus(401, "unauthorized")).toBe("paused");
      expect(FAILURE_CLASSES.PAUSED).toBe("paused");
    });
  });
});
