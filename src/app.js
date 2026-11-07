import Fastify from "fastify";
import { loadConfig } from "./config/env.js";
import { getPool } from "./infrastructure/database/pool.js";
import { createRateLimiter } from "./infrastructure/http/rate-limit.js";
import { healthRoutes } from "./modules/health/presentation/health.routes.js";
import { identityRoutes } from "./modules/identity/presentation/identity.routes.js";
export function buildApp({ config = loadConfig(), database = getPool(config), logger = true } = {}) {
  const app = Fastify({ logger: logger ? { level: config.logLevel, redact: ["req.headers.authorization", "req.headers.cookie"] } : false, bodyLimit: 1048576, requestTimeout: 15000 });
  app.addHook("preHandler",createRateLimiter({
    maxRequests:config.rateLimitMax,
    authMaxRequests:config.rateLimitAuthMax,
    windowMs:config.rateLimitWindowMs
  }));
  app.register(healthRoutes, { database });
  app.register(identityRoutes, { database, config });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: "NOT_FOUND", message: "La ruta solicitada no existe." }));
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Error no controlado");
    const statusCode = error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500;
    reply.code(statusCode).send({ error: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR", message: statusCode === 500 ? "Ocurrió un error interno." : error.message });
  });
  return app;
}
