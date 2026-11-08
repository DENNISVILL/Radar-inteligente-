import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyMigrations } from "../../scripts/migrate.js";

test("failed migration rolls back only its own transaction and preserves prior applied migrations", {
  skip: !process.env.TEST_DATABASE_URL
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const directory = await mkdtemp(join(tmpdir(), "radar-migration-recovery-"));
  const applied = "990_recovery_probe_success";
  const failed = "991_recovery_probe_failure";
  try {
    await pool.query("DELETE FROM schema_migrations WHERE version = ANY($1::varchar[])", [[applied, failed]]);
    await pool.query("DROP TABLE IF EXISTS recovery_probe_success, recovery_probe_rolled_back");
    await writeFile(join(directory, applied + ".sql"), "CREATE TABLE recovery_probe_success(id integer PRIMARY KEY);");
    await writeFile(join(directory, failed + ".sql"), "CREATE TABLE recovery_probe_rolled_back(id integer PRIMARY KEY); SELECT 1 / 0;");
    await assert.rejects(() => applyMigrations(pool, directory), /division by zero/i);
    const success = await pool.query("SELECT to_regclass('public.recovery_probe_success') AS name");
    const rolledBack = await pool.query("SELECT to_regclass('public.recovery_probe_rolled_back') AS name");
    const ledger = await pool.query("SELECT version FROM schema_migrations WHERE version = ANY($1::varchar[])", [[applied, failed]]);
    assert.equal(success.rows[0].name, "recovery_probe_success");
    assert.equal(rolledBack.rows[0].name, null);
    assert.deepEqual(ledger.rows.map(row => row.version), [applied]);
  } finally {
    await pool.query("DELETE FROM schema_migrations WHERE version = ANY($1::varchar[])", [[applied, failed]]).catch(() => {});
    await pool.query("DROP TABLE IF EXISTS recovery_probe_success, recovery_probe_rolled_back").catch(() => {});
    await rm(directory, { recursive: true, force: true });
    await pool.end();
  }
});
