import test from "node:test";
import assert from "node:assert/strict";
import { createShutdownHandler } from "../../../src/infrastructure/http/shutdown.js";

test("shutdown closes Fastify and PostgreSQL once when multiple signals arrive", async () => {
  const calls = [];
  const app = { log: { info: () => {}, error: () => {} }, async close() { calls.push("app"); } };
  const shutdown = createShutdownHandler({ app, closeDatabase: async () => { calls.push("database"); } });
  const first = shutdown("SIGTERM");
  const second = shutdown("SIGINT");
  assert.equal(first, second);
  await Promise.all([first, second]);
  assert.deepEqual(calls, ["app", "database"]);
});

test("shutdown still closes PostgreSQL when Fastify close fails", async () => {
  let databaseClosed = false;
  const app = {
    log: { info: () => {}, error: () => {} },
    async close() { throw new Error("fastify close failed"); }
  };
  const shutdown = createShutdownHandler({
    app,
    closeDatabase: async () => { databaseClosed = true; }
  });
  await assert.rejects(shutdown("SIGTERM"), /fastify close failed/);
  assert.equal(databaseClosed, true);
});
