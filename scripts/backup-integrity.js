import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { lstat, readFile, unlink, mkdtemp, rm, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export function backupManifestPath(backupPath) {
  return backupPath + ".sha256.json";
}

function normalizePem(value) {
  return String(value).replace(/\\n/g, "\n");
}

function signaturePayload(manifest) {
  return Buffer.from(JSON.stringify({
    version: manifest.version,
    algorithm: manifest.algorithm,
    digest: manifest.digest,
    size: manifest.size
  }), "utf8");
}

function requiredSignature(options) {
  return options.requireSignature === true ||
    ["true", "1", "yes"].includes(String(process.env.BACKUP_REQUIRE_SIGNATURE ?? "").toLowerCase());
}

function signingPrivateKey(options) {
  return options.privateKey ?? process.env.BACKUP_SIGNING_PRIVATE_KEY;
}

function verificationPublicKey(options) {
  return options.publicKey ?? process.env.BACKUP_SIGNING_PUBLIC_KEY;
}

function parseEd25519Key(value, kind) {
  if (!value) {
    throw new Error("Falta la clave " + (kind === "private" ? "privada" : "pública") + " Ed25519.");
  }
  const key = kind === "private"
    ? createPrivateKey(normalizePem(value))
    : createPublicKey(normalizePem(value));
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error("La clave configurada no es una clave Ed25519.");
  }
  return key;
}

function verifyManifestSignature(manifest, options = {}) {
  const signature = manifest.signature;
  const mustSign = requiredSignature(options);
  if (!signature) {
    if (mustSign) {
      throw new Error("Restauración bloqueada: el manifiesto no contiene una firma Ed25519 obligatoria.");
    }
    return false;
  }
  if (
    !signature ||
    signature.algorithm !== "ed25519" ||
    typeof signature.value !== "string" ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(signature.value)
  ) {
    throw new Error("La firma Ed25519 del manifiesto tiene un formato inválido.");
  }
  const publicKeyValue = verificationPublicKey(options);
  if (!publicKeyValue) {
    throw new Error("El manifiesto está firmado, pero falta BACKUP_SIGNING_PUBLIC_KEY para verificarlo.");
  }
  const publicKey = parseEd25519Key(publicKeyValue, "public");
  const signatureBytes = Buffer.from(signature.value, "base64");
  if (signatureBytes.toString("base64") !== signature.value) {
    throw new Error("La firma Ed25519 del manifiesto no contiene Base64 canónico.");
  }
  if (!verify(null, signaturePayload(manifest), publicKey, signatureBytes)) {
    throw new Error("La firma Ed25519 del manifiesto no es válida; se bloquea la restauración.");
  }
  return true;
}

async function readBackupManifest(backupPath, options = {}) {
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
  verifyManifestSignature(manifest, options);
  return manifest;
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

export async function writeBackupManifest(backupPath, options = {}) {
  const manifest = {
    version: 1,
    ...await calculateBackupDigest(backupPath)
  };
  const privateKeyValue = signingPrivateKey(options);
  if (privateKeyValue) {
    const privateKey = parseEd25519Key(privateKeyValue, "private");
    manifest.signature = {
      algorithm: "ed25519",
      value: sign(null, signaturePayload(manifest), privateKey).toString("base64")
    };
  } else if (requiredSignature(options)) {
    throw new Error("BACKUP_REQUIRE_SIGNATURE está activo, pero falta BACKUP_SIGNING_PRIVATE_KEY.");
  }
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

export async function verifyBackupManifest(backupPath, options = {}) {
  const manifest = await readBackupManifest(backupPath, options);
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

export async function stageVerifiedBackup(backupPath, options = {}) {
  const manifest = await readBackupManifest(backupPath, options);
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
      signed: Boolean(manifest.signature),
      cleanup: () => rm(directory, { recursive: true, force: true })
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
