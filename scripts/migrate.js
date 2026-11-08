import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { loadConfig } from "../src/config/env.js";

const MIGRATION_LOCK_KEY = "radar-comercial-schema-migrations";

export function resolveMigrationDatabaseUrl(config) {
  const url = config.migrationDatabaseUrl || (config.nodeEnv === "production" ? "" : config.databaseUrl);
  if (!url) throw new Error("Configura MIGRATION_DATABASE_URL para ejecutar migraciones (obligatorio en producción).");
  return url;
}

export async function applyMigrations(pool, migrationsDirectory = new URL("../database/migrations/", import.meta.url)) {
  const client = await pool.connect();
  let lockAcquired = false;
  try {
    // Serialize migration runners that share the same PostgreSQL database.
    await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [MIGRATION_LOCK_KEY]);
    lockAcquired = true;

    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(120) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    const files = (await readdir(migrationsDirectory))
      .filter(file => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
      .sort((a, b) => a.localeCompare(b, "en"));
    for (const file of files) {
      const version = file.replace(/\.sql$/i, "");
      await client.query("BEGIN");
      try {
        const existing = await client.query("SELECT version FROM schema_migrations WHERE version = $1", [version]);
        if (existing.rowCount === 0) {
          const sql = await readFile(new URL(file, migrationsDirectory), "utf8");
          await client.query(sql);
          await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", [version]);
          console.info("Migración aplicada:", version);
        } else {
          console.info("Migración ya aplicada:", version);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    await client.query("BEGIN");
    try {
      const runtimeRole = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'radar_runtime'");
      if (runtimeRole.rowCount > 0) {
        // Runtime receives application DML only. Audit history is append-only,
        // and the runtime must never alter migration bookkeeping.
        await client.query("GRANT USAGE ON SCHEMA public TO radar_runtime");
        await client.query("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO radar_runtime");
        await client.query("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO radar_runtime");
        await client.query("REVOKE ALL ON TABLE audit_logs FROM radar_runtime");
        await client.query("GRANT INSERT ON TABLE audit_logs TO radar_runtime");
        await client.query("REVOKE ALL ON TABLE schema_migrations FROM radar_runtime");
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    return { discovered: files.length, versions: files.map(file => file.replace(/\.sql$/i, "")) };
  } finally {
    try {
      if (lockAcquired) {
        await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [MIGRATION_LOCK_KEY]);
      }
    } finally {
      client.release();
    }
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const config = loadConfig();
  const migrationUrl = resolveMigrationDatabaseUrl(config);
  const { Pool } = pg;
  const pool = new Pool({
    connectionString: migrationUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : false
  });
  try {
    const result = await applyMigrations(pool);
    console.info(`Migraciones revisadas: ${result.discovered}`);
  } finally {
    await pool.end();
  }
}
