import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../src/config/env.js";
test("loads safe defaults", () => { const c = loadConfig({}); assert.equal(c.host, "127.0.0.1"); assert.equal(c.port, 3000); });
test("rejects invalid port", () => assert.throws(() => loadConfig({ PORT: "70000" }), /PORT/));
test("rejects unsupported environment", () => assert.throws(() => loadConfig({ NODE_ENV: "staging" }), /NODE_ENV/));
test("parses database SSL", () => assert.equal(loadConfig({ DB_SSL: "true" }).databaseSsl, true));

test("loads conservative rate limit defaults", () => {
 const c=loadConfig({});
 assert.equal(c.rateLimitMax,120);
 assert.equal(c.rateLimitAuthMax,10);
 assert.equal(c.rateLimitWindowMs,60000);
});
test("rejects out-of-range rate limit settings", () => {
 assert.throws(() => loadConfig({RATE_LIMIT_MAX:"0"}),/RATE_LIMIT_MAX/);
 assert.throws(() => loadConfig({RATE_LIMIT_AUTH_MAX:"1001"}),/RATE_LIMIT_AUTH_MAX/);
 assert.throws(() => loadConfig({RATE_LIMIT_WINDOW_MS:"999"}),/RATE_LIMIT_WINDOW_MS/);
});

test("metrics are enabled by default and can be disabled", () => {
 assert.equal(loadConfig({}).metricsEnabled, true);
 assert.equal(loadConfig({ METRICS_ENABLED: "false" }).metricsEnabled, false);
});
