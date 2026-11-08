import { stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import pg from "pg";
import { resolve } from "node:path";
import { withPostgresCliEnv } from "./postgres-cli.js";
import { postgresSslConfig } from "../src/infrastructure/database/postgres-ssl.js";

function run(command, args, extraEnv = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: { ...process.env, ...extraEnv } });
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
  ssl: postgresSslConfig(connection, process.env.DB_SSL === "true" || process.env.DB_SSL === "1" || process.env.DB_SSL === "yes")
});
await client.connect();
try {
  const identity = await client.query(
    "SELECT current_user AS role, pg_get_userbyid(datdba) AS owner " +
    "FROM pg_database WHERE datname=current_database()"
  );
  if (identity.rows[0].role !== "radar_migration_owner" || identity.rows[0].owner !== "radar_migration_owner") {
    throw new Error("La restauración debe ejecutarse como radar_migration_owner y la base destino debe pertenecer a ese rol.");
  }
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

await withPostgresCliEnv(connection, env => run("pg_restore", [
  "--exit-on-error", "--single-transaction", "--no-owner", "--no-privileges",
  "--dbname=" + database,
  file
], env));
console.info("Restauración completada en la base " + database + ". Verifica el servicio antes de cambiar el tráfico.");
