import test from "node:test";
import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  backupManifestPath,
  calculateBackupDigest,
  stageVerifiedBackup,
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

test("restore staging verifies and isolates a private copy from later source changes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "radar-backup-stage-"));
  const backup = join(directory, "radar.dump");
  let staged;
  try {
    await writeFile(backup, "verified-source");
    await writeBackupManifest(backup);
    staged = await stageVerifiedBackup(backup);
    const stagedInfo = await lstat(staged.filePath);
    assert.equal(stagedInfo.isFile(), true);
    assert.equal(stagedInfo.mode & 0o777, 0o600);
    assert.equal(await readFile(staged.filePath, "utf8"), "verified-source");
    await writeFile(backup, "changed-after-staging");
    assert.equal(await readFile(staged.filePath, "utf8"), "verified-source");
    assert.equal(staged.integrity.size, Buffer.byteLength("verified-source"));
  } finally {
    await staged?.cleanup();
    await rm(directory, { recursive: true, force: true });
  }
});

test("restore staging rejects a symbolic-link backup", async () => {
  const directory = await mkdtemp(join(tmpdir(), "radar-backup-stage-"));
  const source = join(directory, "source.dump");
  const backup = join(directory, "linked.dump");
  try {
    await writeFile(source, "backup");
    await writeBackupManifest(source);
    await symlink(source, backup);
    await writeFile(backupManifestPath(backup), await readFile(backupManifestPath(source)));
    await assert.rejects(stageVerifiedBackup(backup), /archivo regular y no un enlace simbólico/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
