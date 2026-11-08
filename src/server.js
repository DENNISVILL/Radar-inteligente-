import { buildApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { closePool, getPool } from "./infrastructure/database/pool.js";
import { createShutdownHandler } from "./infrastructure/http/shutdown.js";

const config = loadConfig();
const database = getPool(config);
const app = buildApp({ config, database });
const shutdown = createShutdownHandler({ app, closeDatabase: closePool });

try {
  await database.query("SELECT 1");
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error, "No fue posible iniciar Radar Comercial API");
  try {
    await app.close();
  } catch (closeError) {
    app.log.error(closeError, "No fue posible cerrar Fastify después de un error de inicio");
  }
  try {
    await closePool();
  } catch (closeError) {
    app.log.error(closeError, "No fue posible cerrar el pool PostgreSQL después de un error de inicio");
  }
  process.exitCode = 1;
}

process.once("SIGINT", () => {
  void shutdown("SIGINT").catch(() => { process.exitCode = 1; });
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM").catch(() => { process.exitCode = 1; });
});
