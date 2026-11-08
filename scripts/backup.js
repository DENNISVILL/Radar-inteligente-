import { access, chmod, stat, open, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { withPostgresCliEnv } from "./postgres-cli.js";
import { backupManifestPath, writeBackupManifest } from "./backup-integrity.js";

function run(command, args, extraEnv = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: { ...process.env, ...extraEnv } });
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolvePromise() : reject(new Error(command + " terminó con código " + code)));
  });
}

export function backupArguments(outputPath) {
  return ["--format=custom", "--no-owner", "--no-privileges", "--file=" + outputPath];
}

const connection = process.env.BACKUP_DATABASE_URL;
const output = process.env.BACKUP_FILE;
if (!connection || !output) throw new Error("Define BACKUP_DATABASE_URL y BACKUP_FILE.");
const target = resolve(output);
const manifestPath = backupManifestPath(target);
for (const candidate of [target, manifestPath]) {
  try {
    await access(candidate, constants.F_OK);
    throw new Error("El archivo de respaldo o su manifiesto ya existe; no se sobrescribirá.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

let created = false;
let manifestCreated = false;
try {
  const handle = await open(target, "wx", 0o600);
  await handle.close();
  created = true;
  await withPostgresCliEnv(connection, env => run("pg_dump", backupArguments(target), env));
  await chmod(target, 0o600);
  const info = await stat(target);
  if (info.size === 0) throw new Error("El archivo de respaldo quedó vacío.");
  await run("pg_restore", ["--list", target]);
  const manifest = await writeBackupManifest(target);
  manifestCreated = true;
  await chmod(manifestPath, 0o600);
  console.info("Respaldo creado y verificable: " + target + " (" + info.size + " bytes, SHA-256 " + manifest.digest + ").");
} catch (error) {
  if (manifestCreated) await unlink(manifestPath).catch(() => {});
  if (created) await unlink(target).catch(() => {});
  throw error;
}
