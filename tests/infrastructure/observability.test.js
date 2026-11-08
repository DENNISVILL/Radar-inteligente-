import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../../src/app.js";
import { loadConfig } from "../../src/config/env.js";

function makeApp(metricsEnabled = true) {
  return buildApp({
    config: { logLevel: "silent", metricsEnabled },
    database: { query: async () => ({ rows: [] }) },
    logger: false
  });
}

test("metrics expose request totals, duration histogram and active gauge", async () => {
  const app = makeApp();
  const health = await app.inject({ method: "GET", url: "/health" });
  assert.equal(health.statusCode, 200);

  const metrics = await app.inject({ method: "GET", url: "/metrics" });
  assert.equal(metrics.statusCode, 200);
  assert.match(metrics.headers["content-type"], /text\/plain/);
  assert.match(metrics.body, /radar_http_requests_total\{method="GET",route="\/health",status="200"\} 1/);
  assert.match(metrics.body, /radar_http_request_duration_seconds_bucket/);
  assert.match(metrics.body, /radar_http_requests_active 0/);
  assert.doesNotMatch(metrics.body, /route="\/metrics"/);
  await app.close();
});

test("trace context accepts W3C traceparent and returns a server span", async () => {
  const app = makeApp();
  const response = await app.inject({
    method: "GET",
    url: "/health",
    headers: { traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["x-trace-id"], "4bf92f3577b34da6a3ce929d0e0e4736");
  assert.match(response.headers.traceparent, /^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/);
  assert.notEqual(response.headers.traceparent.split("-")[2], "00f067aa0ba902b7");
  await app.close();
});

test("invalid traceparent is replaced with a fresh trace id", async () => {
  const app = makeApp();
  const response = await app.inject({
    method: "GET",
    url: "/health",
    headers: { traceparent: "not-a-valid-trace" }
  });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers["x-trace-id"], /^[0-9a-f]{32}$/);
  assert.notEqual(response.headers["x-trace-id"], "not-a-valid-trace");
  await app.close();
});

test("metrics endpoint can be disabled", async () => {
  const app = makeApp(false);
  const response = await app.inject({ method: "GET", url: "/metrics" });
  assert.equal(response.statusCode, 404);
  await app.close();
});


test("metrics endpoint is absent with the default application configuration", async () => {
  const app = buildApp({
    config: loadConfig({}),
    database: { query: async () => ({ rows: [] }) },
    logger: false
  });
  const response = await app.inject({ method: "GET", url: "/metrics" });
  assert.equal(response.statusCode, 404);
  await app.close();
});
