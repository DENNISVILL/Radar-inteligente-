import { mkdtemp, writeFile, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function escapePassfileField(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/:/g, "\\:");
}

export async function withPostgresCliEnv(connection, operation) {
  const url = new URL(connection);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new TypeError("La conexión PostgreSQL debe utilizar postgres:// o postgresql://.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const port = url.port || "5432";
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const username = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  if (!host || !database || !username) {
    throw new TypeError("La URL PostgreSQL debe incluir host, base de datos y usuario.");
  }

  const directory = await mkdtemp(join(tmpdir(), "radar-pgpass-"));
  const passfile = join(directory, "pgpass");
  try {
    const line = [host, port, database, username, password].map(escapePassfileField).join(":") + "\n";
    await writeFile(passfile, line, { mode: 0o600 });
    await chmod(passfile, 0o600);
    const env = {
      PGHOST: host,
      PGPORT: port,
      PGDATABASE: database,
      PGUSER: username,
      PGPASSFILE: passfile
    };
    const sslmode = url.searchParams.get("sslmode");
    const sslrootcert = url.searchParams.get("sslrootcert");
    if (sslmode) env.PGSSLMODE = sslmode;
    if (sslrootcert) env.PGSSLROOTCERT = sslrootcert;
    return await operation(env);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
