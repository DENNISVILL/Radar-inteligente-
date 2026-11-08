import test from "node:test";
import { generateKeyPairSync } from "node:crypto";
import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
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


test("restore staging rejects a symbolic-link integrity manifest", async () => {
  const directory = await mkdtemp(join(tmpdir(), "radar-backup-manifest-"));
  const backup = join(directory, "radar.dump");
  const manifest = backupManifestPath(backup);
  const storedManifest = join(directory, "stored-manifest.json");
  try {
    await writeFile(backup, "backup");
    await writeBackupManifest(backup);
    await rename(manifest, storedManifest);
    await symlink(storedManifest, manifest);
    await assert.rejects(stageVerifiedBackup(backup), /manifiesto SHA-256 debe ser un archivo regular y no un enlace simbólico/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});


function ed25519KeyPair() {
  const pair = generateKeyPairSync("ed25519");
  return {
    privateKey: pair.privateKey.export({ type: "pkcs8", format: "pem" }),
    publicKey: pair.publicKey.export({ type: "spki", format: "pem" })
  };
}

test("Ed25519 signed backup manifests verify and stage only with the matching public key", async () => {
  const directory = await mkdtemp(join(tmpdir(), "radar-backup-signed-"));
  const backup = join(directory, "radar.dump");
  const keys = ed25519KeyPair();
  let staged;
  try {
    await writeFile(backup, "signed-postgres-backup");
    const manifest = await writeBackupManifest(backup, { privateKey: keys.privateKey, requireSignature: true });
    assert.equal(manifest.signature.algorithm, "ed25519");
    assert.deepEqual(await verifyBackupManifest(backup, { publicKey: keys.publicKey, requireSignature: true }), await calculateBackupDigest(backup));
    staged = await stageVerifiedBackup(backup, { publicKey: keys.publicKey, requireSignature: true });
    assert.equal(staged.signed, true);
    assert.equal(await readFile(staged.filePath, "utf8"), "signed-postgres-backup");
  } finally {
    await staged?.cleanup();
    await rm(directory, { recursive: true, force: true });
  }
});

test("Ed25519 verification rejects a different public key", async () => {
  const directory = await mkdtemp(join(tmpdir(), "radar-backup-wrong-key-"));
  const backup = join(directory, "radar.dump");
  const signingKeys = ed25519KeyPair();
  const otherKeys = ed25519KeyPair();
  try {
    await writeFile(backup, "signed-backup");
    await writeBackupManifest(backup, { privateKey: signingKeys.privateKey });
    await assert.rejects(
      verifyBackupManifest(backup, { publicKey: otherKeys.publicKey }),
      /firma Ed25519 del manifiesto no es válida/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("strict restore mode rejects unsigned manifests", async () => {
  const directory = await mkdtemp(join(tmpdir(), "radar-backup-strict-"));
  const backup = join(directory, "radar.dump");
  try {
    await writeFile(backup, "legacy-unsigned-backup");
    await writeBackupManifest(backup);
    await assert.rejects(
      verifyBackupManifest(backup, { requireSignature: true }),
      /no contiene una firma Ed25519 obligatoria/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Ed25519 verification rejects a modified signature", async () => {
  const directory = await mkdtemp(join(tmpdir(), "radar-backup-tampered-signature-"));
  const backup = join(directory, "radar.dump");
  const keys = ed25519KeyPair();
  try {
    await writeFile(backup, "signed-backup");
    await writeBackupManifest(backup, { privateKey: keys.privateKey });
    const manifestPath = backupManifestPath(backup);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const signature = manifest.signature.value;
    manifest.signature.value = signature.slice(0, -1) + (signature.endsWith("A") ? "B" : "A");
    await writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(
      verifyBackupManifest(backup, { publicKey: keys.publicKey }),
      /firma Ed25519 del manifiesto no es válida/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
