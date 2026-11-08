import { readFileSync } from "node:fs";

/**
 * Resolve PostgreSQL TLS consistently for node-postgres clients.
 * Explicit URL modes are honored instead of being overridden by ssl:false.
 * TLS connections always verify the server certificate.
 */
export function postgresSslConfig(connection, forceSsl = false) {
  const url = new URL(connection);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new TypeError("La conexión PostgreSQL debe utilizar postgres:// o postgresql://.");
  }
  const mode = url.searchParams.get("sslmode")?.toLowerCase();
  if (mode && !["disable", "require", "verify-ca", "verify-full"].includes(mode)) {
    throw new TypeError("sslmode inseguro o no soportado para PostgreSQL.");
  }
  const enabled = forceSsl || (mode != null && mode !== "disable");
  if (!enabled) return false;

  const ssl = { rejectUnauthorized: true };
  const rootCertificate = url.searchParams.get("sslrootcert");
  if (rootCertificate) ssl.ca = readFileSync(rootCertificate, "utf8");
  return ssl;
}

/**
 * Remove libpq TLS query parameters before passing the URL to node-postgres.
 * node-postgres can otherwise replace an explicit ssl object with URL options.
 */
export function postgresConnectionOptions(connection, forceSsl = false) {
  const url = new URL(connection);
  const ssl = postgresSslConfig(connection, forceSsl);
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) {
    url.searchParams.delete(key);
  }
  return { connectionString: url.toString(), ssl };
}
