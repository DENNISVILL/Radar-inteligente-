import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../src/config/env.js";
test("loads safe defaults", () => { const c = loadConfig({}); assert.equal(c.host, "127.0.0.1"); assert.equal(c.port, 3000); });
test("rejects invalid port", () => assert.throws(() => loadConfig({ PORT: "70000" }), /PORT/));
test("rejects unsupported environment", () => assert.throws(() => loadConfig({ NODE_ENV: "staging" }), /NODE_ENV/));
test("parses database SSL", () => assert.equal(loadConfig({ DB_SSL: "true" }).databaseSsl, true));
