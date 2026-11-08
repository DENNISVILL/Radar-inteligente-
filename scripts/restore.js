import { stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import pg from "pg";
import { resolve } from "node:path";

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolvePromise() : reject(new Error(command + " terminó con código " + code)));
  });
}

const backup = process.env.RESTORE_FILE;
const connection = process.env.RESTORE_DATABASE_URL;
if (!backup || !connection) throw new Error("Define RESTORE_FILE y RESTORE_DATABASE_URL.");
const file = resolve(backup);
const info = await stat(file);
if (!info.isFile() || info.size === 0) throw new Error("El respaldo no existe o está vacío.");
await run("pg_restore", ["--list", file]);

const target = new URL(connection);
const database = decodeURIComponent(target.pathname.replace(/^\//, ""));
if (!database || process.env.RESTORE_CONFIRM_DATABASE !== database) {
  throw new Error("Restauración bloqueada: RESTORE_CONFIRM_DATABASE debe coincidir exactamente con el nombre de la base destino.");
}

const client = new pg.Client({
  connectionString: connection,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : false
});
await client.connect();
try {
  const result = await client.query(
    "SELECT count(*)::int AS object_count " +
    "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace " +
    "WHERE n.nspname NOT IN ('pg_catalog','information_schema') " +
    "AND n.nspname NOT LIKE 'pg_toast%' " +
    "AND c.relkind IN ('r','p','v','m','f')"
  );
  if (result.rows[0].object_count !== 0) {
    throw new Error("Restauración bloqueada: la base destino contiene tablas o vistas. Usa una base nueva y vacía.");
  }
} finally {
  await client.end();
}

await run("pg_restore", [
  "--exit-on-error", "--single-transaction", "--no-owner", "--no-privileges",
  "--dbname=" + connection, file
]);
console.info("Restauración completada en la base " + database + ". Verifica el servicio antes de cambiar el tráfico.");
