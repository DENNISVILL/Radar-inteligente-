import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { lstat, readFile, writeFile, unlink, mkdtemp, rm, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export function backupManifestPath(backupPath) {
  return backupPath + ".sha256.json";
}

export async function calculateBackupDigest(backupPath) {
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(backupPath)) {
    hash.update(chunk);
    size += chunk.length;
  }
  return { algorithm: "sha256", digest: hash.digest("hex"), size };
}

async function readBackupManifest(backupPath) {
  const manifestPath = backupManifestPath(backupPath);
  const info = await lstat(manifestPath);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error("El manifiesto SHA-256 debe ser un archivo regular y no un enlace simbólico.");
  }
  const raw = await readFile(manifestPath, "utf8");
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch {
    throw new Error("El manifiesto SHA-256 del respaldo no contiene JSON válido.");
  }
  if (
    !manifest ||
    manifest.version !== 1 ||
    manifest.algorithm !== "sha256" ||
    typeof manifest.digest !== "string" ||
    !/^[a-f0-9]{64}$/.test(manifest.digest) ||
    !Number.isSafeInteger(manifest.size) ||
    manifest.size <= 0
  ) {
    throw new Error("El manifiesto SHA-256 del respaldo tiene un formato inválido.");
  }
  return manifest;
}

export async function writeBackupManifest(backupPath) {
  const manifest = {
    version: 1,
    ...await calculateBackupDigest(backupPath)
  };
  const path = backupManifestPath(backupPath);
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(manifest, null, 2) + "\n", "utf8");
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => {});
    await unlink(path).catch(() => {});
    throw error;
  }
  await handle.close();
  return manifest;
}

export async function verifyBackupManifest(backupPath) {
  const manifest = await readBackupManifest(backupPath);
  const info = await lstat(backupPath);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error("El respaldo debe ser un archivo regular y no un enlace simbólico.");
  }
  const actual = await calculateBackupDigest(backupPath);
  if (actual.size !== manifest.size || actual.digest !== manifest.digest) {
    throw new Error("El respaldo no supera la verificación SHA-256; puede estar incompleto o alterado.");
  }
  return actual;
}

export async function stageVerifiedBackup(backupPath) {
  const manifest = await readBackupManifest(backupPath);
  const sourceInfo = await lstat(backupPath);
  if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) {
    throw new Error("El respaldo debe ser un archivo regular y no un enlace simbólico.");
  }

  const directory = await mkdtemp(join(tmpdir(), "radar-verified-backup-"));
  const stagedPath = join(directory, basename(backupPath));
  const hash = createHash("sha256");
  let size = 0;
  const meter = new Transform({
    transform(chunk, encoding, callback) {
      hash.update(chunk);
      size += chunk.length;
      callback(null, chunk);
    }
  });

  try {
    await pipeline(
      createReadStream(backupPath),
      meter,
      createWriteStream(stagedPath, { flags: "wx", mode: 0o600 })
    );
    const actual = { algorithm: "sha256", digest: hash.digest("hex"), size };
    if (actual.size !== manifest.size || actual.digest !== manifest.digest) {
      throw new Error("El respaldo no supera la verificación SHA-256 durante su copia segura; puede estar incompleto o alterado.");
    }
    return {
      filePath: stagedPath,
      integrity: actual,
      cleanup: () => rm(directory, { recursive: true, force: true })
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
