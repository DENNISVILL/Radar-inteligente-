import pg from "pg";
import { loadConfig } from "../../config/env.js";
const { Pool } = pg;
let pool;
export function getPool(config = loadConfig()) {
  if (!config.databaseUrl) throw new Error("DATABASE_URL es obligatorio para conectar con PostgreSQL.");
  if (!pool) {
    pool = new Pool({ connectionString: config.databaseUrl, ssl: config.databaseSsl ? { rejectUnauthorized: true } : false, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000, application_name: "radar-comercial-api" });
    pool.on("error", error => console.error("Error inesperado en PostgreSQL:", error.message));
  }
  return pool;
}
export async function closePool() {
  if (pool) { const current = pool; pool = undefined; await current.end(); }
}
