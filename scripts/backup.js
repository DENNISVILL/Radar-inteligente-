import { access, chmod, stat, open, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { withPostgresCliEnv } from "./postgres-cli.js";

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
try {
  await access(target, constants.F_OK);
  throw new Error("El archivo de respaldo ya existe; no se sobrescribirá.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

let created = false;
try {
  const handle = await open(target, "wx", 0o600);
  await handle.close();
  created = true;
  await withPostgresCliEnv(connection, env => run("pg_dump", backupArguments(target), env));
  await chmod(target, 0o600);
  const info = await stat(target);
  if (info.size === 0) throw new Error("El archivo de respaldo quedó vacío.");
  await run("pg_restore", ["--list", target]);
  console.info("Respaldo creado y verificable: " + target + " (" + info.size + " bytes).");
} catch (error) {
  if (created) await unlink(target).catch(() => {});
  throw error;
}
