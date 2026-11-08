import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

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

export async function writeBackupManifest(backupPath) {
  const manifest = {
    version: 1,
    ...await calculateBackupDigest(backupPath)
  };
  await writeFile(backupManifestPath(backupPath), JSON.stringify(manifest, null, 2) + "\n", {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });
  return manifest;
}

export async function verifyBackupManifest(backupPath) {
  const raw = await readFile(backupManifestPath(backupPath), "utf8");
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
  const actual = await calculateBackupDigest(backupPath);
  if (actual.size !== manifest.size || actual.digest !== manifest.digest) {
    throw new Error("El respaldo no supera la verificación SHA-256; puede estar incompleto o alterado.");
  }
  return actual;
}
