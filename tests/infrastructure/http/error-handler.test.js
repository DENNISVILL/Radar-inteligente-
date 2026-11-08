import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../../../src/app.js";
import { loadConfig } from "../../../src/config/env.js";

test("unhandled server errors return a generic response without leaking internal details", async () => {
  const app = buildApp({
    config: loadConfig(),
    database: { async query() { return { rows: [] }; } },
    logger: false
  });

  app.get("/__test/internal-error", async () => {
    throw new Error("postgres://internal-user:private-password@db.internal/radar");
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/__test/internal-error"
    });

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.json(), {
      error: "INTERNAL_SERVER_ERROR",
      message: "Ocurrió un error interno."
    });
    assert.doesNotMatch(response.body, /postgres|private-password|internal-user|db\.internal/);
    assert.doesNotMatch(response.body, /stack|Error:/i);
  } finally {
    await app.close();
  }
});
