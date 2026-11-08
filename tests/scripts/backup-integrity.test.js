import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  backupManifestPath,
  calculateBackupDigest,
  verifyBackupManifest,
  writeBackupManifest
} from "../../scripts/backup-integrity.js";

test("backup manifest records SHA-256 and verifies an unchanged artifact", async () => {
  const directory = await mkdtemp(join(tmpdir(), "radar-backup-integrity-"));
  const backup = join(directory, "radar.dump");
  try {
    await writeFile(backup, Buffer.from("postgres-backup-fixture"));
    const manifest = await writeBackupManifest(backup);
    assert.equal(manifest.algorithm, "sha256");
    assert.equal(manifest.size, Buffer.byteLength("postgres-backup-fixture"));
    assert.deepEqual(await verifyBackupManifest(backup), await calculateBackupDigest(backup));
    await assert.rejects(writeBackupManifest(backup), { code: "EEXIST" });
    const stored = JSON.parse(await readFile(backupManifestPath(backup), "utf8"));
    assert.equal(stored.digest, manifest.digest);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("backup verification rejects altered bytes and malformed manifests", async () => {
  const directory = await mkdtemp(join(tmpdir(), "radar-backup-integrity-"));
  const backup = join(directory, "radar.dump");
  try {
    await writeFile(backup, "original");
    await writeBackupManifest(backup);
    await writeFile(backup, "tampered");
    await assert.rejects(verifyBackupManifest(backup), /no supera la verificación SHA-256/);
    await writeFile(backupManifestPath(backup), "{invalid");
    await assert.rejects(verifyBackupManifest(backup), /JSON válido/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
