import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../../../src/app.js";
test("health endpoint responds", async () => {
 const app = buildApp({ config: { logLevel: "silent" }, database: { query: async () => ({ rows: [] }) }, logger: false });
 const response = await app.inject({ method: "GET", url: "/health" });
 assert.equal(response.statusCode, 200); assert.equal(response.json().status, "ok"); await app.close();
});
test("readiness reports unavailable database", async () => {
 const app = buildApp({ config: { logLevel: "silent" }, database: { query: async () => { throw new Error("down"); } }, logger: false });
 const response = await app.inject({ method: "GET", url: "/ready" });
 assert.equal(response.statusCode, 503); assert.equal(response.json().status, "not_ready"); await app.close();
});
