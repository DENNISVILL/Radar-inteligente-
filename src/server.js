import { buildApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { closePool, getPool } from "./infrastructure/database/pool.js";
const config = loadConfig();
const database = getPool(config);
const app = buildApp({ config, database });
try {
  await database.query("SELECT 1");
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error, "No fue posible iniciar Radar Comercial API");
  await closePool();
  process.exitCode = 1;
}
const shutdown = async signal => {
  app.log.info({ signal }, "Cerrando servidor");
  await app.close(); await closePool(); process.exit(0);
};
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
