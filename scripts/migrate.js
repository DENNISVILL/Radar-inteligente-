import { readFile } from "node:fs/promises";
import pg from "pg";
import { loadConfig } from "../src/config/env.js";
const config = loadConfig();
if (!config.databaseUrl) throw new Error("Configura DATABASE_URL antes de ejecutar migraciones.");
const { Pool } = pg;
const pool = new Pool({ connectionString: config.databaseUrl, ssl: config.databaseSsl ? { rejectUnauthorized: true } : false });
const sql = await readFile(new URL("../database/migrations/001_initial_schema.sql", import.meta.url), "utf8");
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(120) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  const version = "001_initial_schema";
  const existing = await client.query("SELECT version FROM schema_migrations WHERE version = $1", [version]);
  if (existing.rowCount === 0) {
    await client.query(sql); await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", [version]);
    console.info("Migración aplicada:", version);
  } else console.info("Migración ya aplicada:", version);
  await client.query("COMMIT");
} catch (error) { await client.query("ROLLBACK"); throw error; }
finally { client.release(); await pool.end(); }
