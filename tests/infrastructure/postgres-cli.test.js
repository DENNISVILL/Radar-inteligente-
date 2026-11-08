import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat, access } from "node:fs/promises";
import { withPostgresCliEnv } from "../../scripts/postgres-cli.js";

test("PostgreSQL CLI credentials use a private temporary passfile, not argv or environment passwords", async () => {
  let passfile;
  await withPostgresCliEnv(
    "postgresql://radar%3Auser:p%40ss%3Aword@db.example.test:5544/radar%20db?sslmode=require",
    async env => {
      passfile = env.PGPASSFILE;
      assert.equal(env.PGHOST, "db.example.test");
      assert.equal(env.PGPORT, "5544");
      assert.equal(env.PGDATABASE, "radar db");
      assert.equal(env.PGUSER, "radar:user");
      assert.equal(env.PGSSLMODE, "require");
      assert.equal("PGPASSWORD" in env, false);
      const file = await stat(passfile);
      assert.equal(file.mode & 0o777, 0o600);
      assert.equal(
        await readFile(passfile, "utf8"),
        "db.example.test:5544:radar db:radar\\\\:user:p@ss\\\\:word\n"
      );
    }
  );
  await assert.rejects(access(passfile));
});

test("PostgreSQL CLI passfile is removed when the command fails", async () => {
  let passfile;
  await assert.rejects(
    withPostgresCliEnv("postgres://radar:secret@localhost:5432/radar", async env => {
      passfile = env.PGPASSFILE;
      throw new Error("simulated command failure");
    }),
    /simulated command failure/
  );
  await assert.rejects(access(passfile));
});

test("PostgreSQL CLI rejects non-PostgreSQL and incomplete connection URLs", async () => {
  await assert.rejects(withPostgresCliEnv("https://example.test/db", async () => {}), /postgres/);
  await assert.rejects(withPostgresCliEnv("postgres://localhost", async () => {}), /host, base de datos y usuario/);
});
