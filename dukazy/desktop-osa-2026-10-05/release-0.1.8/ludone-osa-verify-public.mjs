import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { validateReleaseArtifacts } from '/Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/osa-p2-root-review/scripts/release-artifacts.mjs';
import { verifyPublishedRelease } from '/Users/dan/Dev/ClaudeCode/ludone-desktop/.claude/worktrees/osa-p2-root-review/scripts/verify-published-release.mjs';

const directory = '/private/tmp/ludone-release-0.1.8-signed';
const output = '/private/tmp/ludone-osa-public-verification.json';
const results = { version: '0.1.8', startedAt: new Date().toISOString(), checks: [], exitCode: 1 };
try {
  const validation = await validateReleaseArtifacts(directory, { version: '0.1.8' });
  const manifest = JSON.parse(await readFile(`${directory}/release-manifest.json`, 'utf8'));
  assert.equal(manifest.version, validation.version);
  assert.deepEqual(manifest.artifacts, validation.artifacts);
  results.checks.push({ name: 'signed-archive-manifest-and-SHA512', pass: true });
  console.log('PASS podepsaný archiv: manifest, velikosti a SHA-512 čtyř balíčků');
  await verifyPublishedRelease(validation);
  results.checks.push({ name: 'existing-public-release-acceptance', pass: true });
  console.log('PASS původní veřejná přejímka: feed, velikosti a dostupnost všech artefaktů');
  for (const artifact of validation.artifacts) {
    const response = await fetch(new URL(artifact.name, 'https://stahnout.ludone.cz/desktop/'), {
      redirect: 'error', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(600000),
    });
    assert.equal(response.status, 200, `${artifact.name}: HTTP`);
    const digest = createHash('sha256');
    let size = 0;
    for await (const chunk of response.body) { size += chunk.length; digest.update(chunk); }
    const sha256 = digest.digest('hex');
    assert.equal(size, artifact.size, `${artifact.name}: velikost`);
    assert.equal(sha256, artifact.sha256, `${artifact.name}: SHA-256`);
    results.checks.push({ name: artifact.name, size, sha256, pass: true });
    console.log(`PASS ${artifact.name}: celý obsah SHA-256 odpovídá podepsanému archivu`);
  }
  results.exitCode = 0;
} catch (error) {
  results.error = error.message;
  console.error(`FAIL ${error.message}`);
} finally {
  results.completedAt = new Date().toISOString();
  await writeFile(output, JSON.stringify(results, null, 2) + '\n');
  console.log(`EXIT_CODE=${results.exitCode}`);
  process.exitCode = results.exitCode;
}
