import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat, access } from "node:fs/promises";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withPostgresCliEnv } from "../../scripts/postgres-cli.js";
import { postgresSslConfig } from "../../src/infrastructure/database/postgres-ssl.js";

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
      assert.equal(env.PGSSLMODE, "verify-full");
      assert.equal("PGPASSWORD" in env, false);
      const file = await stat(passfile);
      assert.equal(file.mode & 0o777, 0o600);
      assert.equal(
        await readFile(passfile, "utf8"),
        "db.example.test:5544:radar db:radar\\:user:p@ss\\:word\n"
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

test("restore preflight uses verified TLS when URL sslmode requests encryption", () => {
  assert.deepEqual(
    postgresSslConfig("postgres://radar:secret@db.example.test/radar?sslmode=require"),
    { rejectUnauthorized: true }
  );
  assert.deepEqual(
    postgresSslConfig("postgres://radar:secret@db.example.test/radar?sslmode=verify-full"),
    { rejectUnauthorized: true }
  );
});

test("restore preflight honors explicit DB_SSL and refuses downgrade modes", () => {
  assert.deepEqual(
    postgresSslConfig("postgres://radar:secret@db.example.test/radar?sslmode=disable", true),
    { rejectUnauthorized: true }
  );
  assert.equal(
    postgresSslConfig("postgres://radar:secret@db.example.test/radar?sslmode=disable", false),
    false
  );
  assert.deepEqual(
    postgresSslConfig("postgres://radar:secret@db.example.test/radar", true),
    { rejectUnauthorized: true }
  );
  assert.throws(
    () => postgresSslConfig("postgres://radar:secret@db.example.test/radar?sslmode=prefer"),
    /sslmode inseguro/
  );
  assert.throws(
    () => postgresSslConfig("postgres://radar:secret@db.example.test/radar?sslmode=allow"),
    /sslmode inseguro/
  );
});

test("PostgreSQL TLS helper loads a provider CA certificate from sslrootcert", () => {
  const directory = mkdtempSync(join(tmpdir(), "radar-ca-test-"));
  const certificatePath = join(directory, "provider-ca.pem");
  const certificate = "-----BEGIN CERTIFICATE-----\\nTEST CA MATERIAL\\n-----END CERTIFICATE-----\\n";
  try {
    writeFileSync(certificatePath, certificate, "utf8");
    assert.deepEqual(
      postgresSslConfig("postgres://radar:secret@db.example.test/radar?sslmode=verify-full&sslrootcert=" + encodeURIComponent(certificatePath)),
      { rejectUnauthorized: true, ca: certificate }
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("PostgreSQL CLI rejects downgrade sslmodes and applies DB_SSL consistently", async () => {
  await assert.rejects(
    withPostgresCliEnv("postgres://radar:secret@db.example.test/radar?sslmode=prefer", async () => {}),
    /sslmode inseguro/
  );
  const previous = process.env.DB_SSL;
  process.env.DB_SSL = "true";
  try {
    await withPostgresCliEnv("postgres://radar:secret@db.example.test/radar?sslmode=disable", async env => {
      assert.equal(env.PGSSLMODE, "verify-full");
    });
  } finally {
    if (previous == null) delete process.env.DB_SSL;
    else process.env.DB_SSL = previous;
  }
});
