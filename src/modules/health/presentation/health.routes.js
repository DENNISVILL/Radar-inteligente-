export async function healthRoutes(app, options) {
  app.get("/health", async () => ({ status: "ok", service: "radar-comercial-api", timestamp: new Date().toISOString() }));
  app.get("/ready", async (_request, reply) => {
    try { await options.database.query("SELECT 1"); return { status: "ready", dependencies: { database: "available" } }; }
    catch { return reply.code(503).send({ status: "not_ready", dependencies: { database: "unavailable" } }); }
  });
}
