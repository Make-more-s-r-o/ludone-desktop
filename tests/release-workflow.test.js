import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/release-macos.yml", import.meta.url),
  "utf8",
);
const remotePublish = readFileSync(
  new URL("../scripts/publish-release-remote.sh", import.meta.url),
  "utf8",
);

describe("publikace macOS releasu", () => {
  it("nepoužije podpisový klíč bez potvrzené firemní zálohy", () => {
    const backupGate = workflow.indexOf("MAC_SIGNING_KEY_BACKUP_CONFIRMED");
    const signingStep = workflow.indexOf("Příprava notářského klíče");
    expect(backupGate).toBeGreaterThan(-1);
    expect(signingStep).toBeGreaterThan(backupGate);
    expect(workflow).toContain('!== "true"');
  });

  it("archivuje ověřené artefakty před prvním síťovým přenosem", () => {
    const validation = workflow.indexOf("npm run release:mac");
    const archive = workflow.indexOf("actions/upload-artifact@v4");
    const transfer = workflow.indexOf("scp ");
    expect(validation).toBeGreaterThan(-1);
    expect(archive).toBeGreaterThan(validation);
    expect(transfer).toBeGreaterThan(archive);
  });

  it("používá připnutý host key a zveřejňuje metadata až po balíčcích", () => {
    expect(workflow).toContain("StrictHostKeyChecking=yes");
    expect(workflow).toContain("DOWNLOAD_SSH_KNOWN_HOSTS");
    expect(workflow).not.toContain("ssh-keyscan");
    expect(workflow).toContain("< scripts/publish-release-remote.sh");
    const packageMove = remotePublish.indexOf('mv "$file" "$publish_path/$file"');
    const metadataMove = remotePublish.indexOf('mv -f latest-mac.yml "$publish_path/latest-mac.yml"');
    expect(packageMove).toBeGreaterThan(-1);
    expect(metadataMove).toBeGreaterThan(packageMove);
  });
});
